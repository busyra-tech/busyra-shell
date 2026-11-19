import SwiftUI

enum Phase: Equatable {
    case welcome
    case createPassword
    case locked
    case main
}

enum Section: String, CaseIterable, Identifiable {
    case hosts, keychain, snippets, forwarding, sftp
    var id: String { rawValue }
    var title: String {
        switch self {
        case .hosts: "Hosts"
        case .keychain: "Keychain"
        case .snippets: "Snippets"
        case .forwarding: "Port Forwarding"
        case .sftp: "SFTP"
        }
    }
    var icon: String {
        switch self {
        case .hosts: "server.rack"
        case .keychain: "key.horizontal"
        case .snippets: "curlybraces.square"
        case .forwarding: "arrow.left.arrow.right"
        case .sftp: "folder"
        }
    }
}

/// State utama app. Semua data persisten lewat `Vault` (djie-core, Rust).
@MainActor
@Observable
final class AppModel {
    var phase: Phase
    var section: Section = .hosts
    var hosts: [Host] = []
    var keys: [SshKey] = []
    var accountEmail: String?
    var pendingAccountEmail: String?

    // Sesi terminal
    var sessions: [TerminalSession] = []
    var activeSessionID: UUID?

    // Multi-select host
    var selection: Set<String> = []

    var toast: String?
    /// Host yang sedang diedit di panel kanan (inspector). `id` kosong = host baru.
    var editingHost: Host?

    private var vault: Vault?

    init() {
        phase = vaultExists(path: Config.vaultPath) ? .locked : .welcome
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-DjieDemo") { loadDemo() }
        #endif
    }

    #if DEBUG
    /// Vault sementara berisi contoh host — hanya untuk build debug (`-DjieDemo`).
    private func loadDemo() {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("djie-demo-\(UUID()).djie").path
        guard let v = try? Vault.create(path: path, password: "demo-password") else { return }
        let samples: [(String, String, String?, [String], String)] = [
            ("prod-api", "10.0.1.10", "Production", ["api", "prod"], "#3FD0B4"),
            ("prod-db", "10.0.1.20", "Production", ["postgres"], "#F0616D"),
            ("staging", "staging.local", "Staging", ["web"], "#5B9CF5"),
            ("homelab", "192.168.1.5", nil, ["pi"], "#9D7CF2"),
        ]
        for (label, hostname, group, tags, color) in samples {
            var h = Host.blank()
            h.label = label; h.hostname = hostname; h.group = group; h.tags = tags; h.color = color
            _ = try? v.upsertHost(host: h)
        }
        _ = try? v.generateKey(label: "MacBook")
        vault = v
        hosts = v.hosts()
        keys = v.keys()
        phase = .main
        if ProcessInfo.processInfo.arguments.contains("-DjieDemoEdit") { editingHost = hosts.first }
        if ProcessInfo.processInfo.arguments.contains("-DjieDemoConnect") {
            var local = Host.blank()
            local.label = "localhost"; local.hostname = "127.0.0.1"; local.auth = .agent
            local.username = NSUserName(); local.color = "#8BD450"
            if let l = try? v.upsertHost(host: local) { hosts = v.hosts(); connect([l.id, hosts[0].id]) }
        }
    }
    #endif

    // MARK: Vault

    func createVault(password: String) async throws {
        let path = Config.vaultPath
        let v = try await Task.detached { try Vault.create(path: path, password: password) }.value
        if let email = pendingAccountEmail { try v.setAccountEmail(email: email) }
        open(v)
        BiometricUnlock.store(key: v.exportKey())
    }

    func unlock(password: String) async throws {
        let path = Config.vaultPath
        let v = try await Task.detached { try Vault.unlock(path: path, password: password) }.value
        open(v)
        BiometricUnlock.store(key: v.exportKey())
    }

    func unlockWithBiometrics() async throws {
        let key = try await BiometricUnlock.retrieve()
        let path = Config.vaultPath
        let v = try await Task.detached { try Vault.unlockWithKey(path: path, key: key) }.value
        open(v)
    }

    func lock() {
        sessions.forEach { $0.terminate() }
        sessions = []
        activeSessionID = nil
        vault = nil
        hosts = []
        keys = []
        withAnimation(.djie) { phase = .locked }
    }

    private func open(_ v: Vault) {
        vault = v
        reload()
        accountEmail = v.accountEmail()
        withAnimation(.djie) { phase = .main }
    }

    private func reload() {
        guard let vault else { return }
        hosts = vault.hosts()
        keys = vault.keys()
    }

    func setAccount(_ email: String?) {
        try? vault?.setAccountEmail(email: email)
        accountEmail = email
    }

    // MARK: Hosts

    @discardableResult
    func save(_ host: Host) -> Host? {
        guard let vault else { return nil }
        do {
            let saved = try vault.upsertHost(host: host)
            withAnimation(.djie) { reload() }
            return saved
        } catch {
            flash(error.localizedDescription)
            return nil
        }
    }

    func delete(_ host: Host) {
        try? vault?.deleteHost(id: host.id)
        selection.remove(host.id)
        withAnimation(.djie) { reload() }
    }

    func host(id: String?) -> Host? { hosts.first { $0.id == id } }
    func key(id: String?) -> SshKey? { keys.first { $0.id == id } }

    // MARK: Keychain

    func generateKey(label: String) throws -> SshKey {
        guard let vault else { throw CoreError.NotFound }
        let k = try vault.generateKey(label: label)
        withAnimation(.djie) { reload() }
        return k
    }

    func importKey(label: String, privateKey: String, passphrase: String?) throws {
        guard let vault else { return }
        _ = try vault.importKey(label: label, privateKey: privateKey, passphrase: passphrase)
        withAnimation(.djie) { reload() }
    }

    func renameKey(_ key: SshKey, to label: String) {
        try? vault?.renameKey(id: key.id, label: label)
        reload()
    }

    func deleteKey(_ key: SshKey) {
        try? vault?.deleteKey(id: key.id)
        withAnimation(.djie) { reload() }
    }

    // MARK: Sesi

    func connect(_ ids: [String]) {
        let targets = ids.compactMap { id in hosts.first { $0.id == id } }
        guard !targets.isEmpty else { return }
        var first: UUID?
        for (i, h) in targets.enumerated() {
            // Muncul satu per satu agar animasi tab terasa
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.08) { [self] in
                let s = TerminalSession(host: h, key: key(id: h.keyId), jump: host(id: h.jumpHostId))
                withAnimation(.djieSnappy) {
                    sessions.append(s)
                    if i == 0 { activeSessionID = s.id; first = s.id }
                }
            }
        }
        _ = first
        selection.removeAll()
    }

    func close(_ session: TerminalSession) {
        session.terminate()
        guard let idx = sessions.firstIndex(where: { $0.id == session.id }) else { return }
        withAnimation(.djieSnappy) {
            sessions.remove(at: idx)
            if activeSessionID == session.id {
                activeSessionID = sessions.isEmpty ? nil : sessions[max(0, idx - 1)].id
            }
        }
    }

    func closeActive() {
        if let s = sessions.first(where: { $0.id == activeSessionID }) { close(s) }
    }

    func focusTab(number n: Int) {
        guard n >= 1, n <= sessions.count else { return }
        withAnimation(.djieSnappy) { activeSessionID = sessions[n - 1].id }
    }

    func showHome() {
        withAnimation(.djieSnappy) { activeSessionID = nil }
    }

    func flash(_ message: String) {
        withAnimation(.djie) { toast = message }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) { [self] in
            if toast == message { withAnimation(.djie) { toast = nil } }
        }
    }
}

extension Host {
    static func blank() -> Host {
        Host(id: "", hostname: "", label: "", group: nil, tags: [], color: Theme.hostColors[0],
             port: 22, username: "root", auth: .password, password: nil, keyId: nil,
             agentForwarding: false, startupSnippet: nil, jumpHostId: nil, env: [],
             charset: "UTF-8", terminalTheme: nil, updatedAt: 0, deleted: false)
    }

    var title: String { label.isEmpty ? hostname : label }
    var address: String { "\(username)@\(hostname)" + (port == 22 ? "" : ":\(port)") }
}

extension Host: Identifiable {}
extension SshKey: Identifiable {}
