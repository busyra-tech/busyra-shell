import SwiftUI

enum Phase: Equatable {
    case welcome
    case createPassword
    /// Vault ditemukan di Google Drive — buka dengan master password lama.
    case restore
    case locked
    case main
}

enum Section: String, CaseIterable, Identifiable {
    case hosts, keychain, forwarding, sftp, snippets, knownHosts, logs, donate, about, account
    var id: String { rawValue }
    static let main: [Section] = [.hosts, .keychain, .forwarding, .sftp, .snippets, .knownHosts, .logs]
    static let community: [Section] = [.donate, .about]
    var title: String {
        switch self {
        case .hosts: "Hosts"
        case .keychain: "Keychain"
        case .forwarding: "Port Forwarding"
        case .sftp: "SFTP"
        case .snippets: "Snippets"
        case .knownHosts: "Known Hosts"
        case .logs: "Logs"
        case .donate: "Donasi"
        case .about: "Tentang"
        case .account: "Akun"
        }
    }
    var icon: String {
        switch self {
        case .hosts: "server.rack"
        case .keychain: "key.horizontal.fill"
        case .forwarding: "arrow.right.arrow.left"
        case .sftp: "folder.fill"
        case .snippets: "curlybraces"
        case .knownHosts: "touchid"
        case .logs: "clock.fill"
        case .donate: "heart.fill"
        case .about: "info.circle.fill"
        case .account: "person.crop.circle.fill"
        }
    }
}

enum SyncState: Equatable {
    case off, idle, syncing, synced(Date), failed(String)
    /// Token Google tidak ada / kedaluwarsa — perlu login ulang.
    case needsLogin
}

/// State utama app. Semua data persisten lewat `Vault` (djie-core, Rust).
@MainActor
@Observable
final class AppModel {
    var phase: Phase
    var section: Section = .hosts
    var hosts: [Host] = []
    var keys: [SshKey] = []
    var snippets: [Snippet] = []
    var forwards: [PortForward] = []
    var logs: [SessionLog] = []
    var accountEmail: String?
    var pendingAccountEmail: String?
    /// Vault terenkripsi yang diunduh dari Drive saat login di perangkat baru.
    var pendingRemoteBlob: Data?

    // Sesi terminal
    var sessions: [TerminalSession] = []
    var activeSessionID: UUID?

    // Multi-select host
    var selection: Set<String> = []

    var toast: String?
    /// Host yang sedang diedit di panel kanan (inspector). `id` kosong = host baru.
    var editingHost: Host?

    var sync: SyncState = .off
    /// Rilis baru yang tersedia di GitHub (nil = sudah versi terbaru / belum dicek).
    var update: AvailableUpdate?
    var updateDismissed = false
    let tunnels = TunnelManager()
    let sftp = SftpModel()

    private var vault: Vault?
    @ObservationIgnored private var syncTask: Task<Void, Never>?
    @ObservationIgnored private var remoteFile: DriveClient.RemoteFile?

    init() {
        phase = vaultExists(path: Config.vaultPath) ? .locked : .welcome
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-DjieDemo") { loadDemo() }
        #endif
    }

    #if DEBUG
    /// Vault sementara berisi contoh data — hanya untuk build debug (`-DjieDemo`).
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
        let hs = v.hosts()
        _ = try? v.upsertSnippet(snippet: Snippet(id: "", label: "Cek disk", command: "df -h", updatedAt: 0, deleted: false))
        _ = try? v.upsertSnippet(snippet: Snippet(id: "", label: "Update sistem", command: "sudo apt update && sudo apt upgrade -y", updatedAt: 0, deleted: false))
        _ = try? v.upsertForward(forward: PortForward(id: "", label: "Postgres prod", hostId: hs[1].id, kind: .local,
                                                      bindAddress: "127.0.0.1", bindPort: 5433, destHost: "localhost", destPort: 5432, updatedAt: 0, deleted: false))
        if let l = try? v.startLog(hostId: hs[0].id, hostLabel: hs[0].title, address: hs[0].address) { try? v.finishLog(id: l, exitCode: 0) }
        vault = v
        reload()
        phase = .main
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-DjieDemoEdit") { editingHost = hosts.first }
        if let i = args.firstIndex(of: "-DjieDemoSection"), i + 1 < args.count, let s = Section(rawValue: args[i + 1]) { section = s }
        if args.contains("-DjieDemoSelect") { selection = [hosts[2].id] }
        if args.contains("-DjieDemoConnect") {
            var local = Host.blank()
            local.label = "localhost"; local.hostname = "127.0.0.1"; local.auth = .agent
            local.username = NSUserName(); local.color = "#F2A65A"; local.terminalTheme = "ember"
            if let l = try? v.upsertHost(host: local) { reload(); connect([l.id]) }
        }
        let env = ProcessInfo.processInfo.environment
        if args.contains("-DjieDemoSftp"), let port = env["DJIE_SFTP_PORT"].flatMap(UInt16.init),
           let pem = env["DJIE_SFTP_KEY"].flatMap({ try? String(contentsOfFile: $0, encoding: .utf8) }),
           let k = try? v.importKey(label: "tes-sftp", privateKey: pem, passphrase: nil) {
            var h = Host.blank()
            h.label = "sftp-lokal"; h.hostname = "127.0.0.1"; h.port = port; h.username = NSUserName()
            h.auth = .key; h.keyId = k.id; h.color = "#5B9CF5"
            if let saved = try? v.upsertHost(host: h) {
                reload()
                sftp.localPath = env["DJIE_SFTP_LOCAL"] ?? sftp.localPath
                sftp.reloadLocal()
                Task { await openSftp(saved); if let r = env["DJIE_SFTP_REMOTE"] { await sftp.openRemote(r) } }
            }
        }
        if args.contains("-DjieDemoLockCycle") {
            phase = .welcome
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [self] in open(v) }
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

    /// Pulihkan vault dari Google Drive di perangkat ini.
    func restore(password: String) async throws {
        guard let blob = pendingRemoteBlob else { return }
        let path = Config.vaultPath
        try blob.write(to: URL(fileURLWithPath: path), options: .atomic)
        do {
            let v = try await Task.detached { try Vault.unlock(path: path, password: password) }.value
            if let email = pendingAccountEmail { try v.setAccountEmail(email: email) }
            pendingRemoteBlob = nil
            open(v)
            BiometricUnlock.store(key: v.exportKey())
        } catch {
            try? FileManager.default.removeItem(atPath: path)
            throw error
        }
    }

    func unlockWithBiometrics() async throws {
        let key = try await BiometricUnlock.retrieve()
        let path = Config.vaultPath
        let v = try await Task.detached { try Vault.unlockWithKey(path: path, key: key) }.value
        open(v)
    }

    func lock() {
        Task { await sftp.disconnect() }
        sessions.forEach { $0.terminate() }
        tunnels.stopAll()
        syncTask?.cancel()
        sessions = []
        activeSessionID = nil
        vault = nil
        hosts = []; keys = []; snippets = []; forwards = []; logs = []
        withAnimation(.djie) { phase = .locked }
    }

    private func open(_ v: Vault) {
        vault = v
        reload()
        accountEmail = v.accountEmail()
        sync = accountEmail == nil ? .off : .idle
        withAnimation(.djie) { phase = .main }
        if accountEmail != nil { syncNow() }
        Task { await checkForUpdates(manual: false) }
    }

    /// Cek rilis baru. `manual` = dipanggil dari menu, tampilkan hasil walau sudah terbaru.
    func checkForUpdates(manual: Bool) async {
        do {
            let u = try await UpdateChecker.check()
            withAnimation(.djie) { update = u; if u != nil { updateDismissed = false } }
            if manual && u == nil { flash("Djie Shell \(AppVersion.current) sudah versi terbaru") }
        } catch {
            if manual { flash("Gagal memeriksa pembaruan") }
        }
    }

    private func reload() {
        guard let vault else { return }
        hosts = vault.hosts()
        keys = vault.keys()
        snippets = vault.snippets()
        forwards = vault.forwards()
        logs = vault.logs()
    }

    /// Dipanggil setelah setiap perubahan data: muat ulang tampilan & jadwalkan sync.
    private func changed(animated: Bool = true) {
        if animated { withAnimation(.djie) { reload() } } else { reload() }
        scheduleSync()
    }

    // MARK: Akun Google & sync

    /// Login Google. Jika vault sudah ada di Drive, kembalikan `true` (perlu dipulihkan).
    /// Nama & foto profil Google (hanya disimpan di Mac ini, bukan di vault).
    var profileName: String? = UserDefaults.standard.string(forKey: "profile.name")
    var profilePicture: URL? = UserDefaults.standard.string(forKey: "profile.picture").flatMap(URL.init(string:))

    private func saveProfile(name: String?, picture: String?) {
        UserDefaults.standard.set(name, forKey: "profile.name")
        UserDefaults.standard.set(picture, forKey: "profile.picture")
        profileName = name
        profilePicture = picture.flatMap(URL.init(string:))
    }

    func signInGoogle() async throws -> Bool {
        let r = try await GoogleAuth().signIn()
        saveProfile(name: r.name, picture: r.picture)
        pendingAccountEmail = r.email
        if vault != nil {
            try vault?.setAccountEmail(email: r.email)
            accountEmail = r.email
            sync = .idle
            syncNow()
            return false
        }
        if let file = try await DriveClient.find() {
            pendingRemoteBlob = try await DriveClient.download(file)
            return true
        }
        return false
    }

    func disconnectGoogle() {
        GoogleTokens.forget()
        saveProfile(name: nil, picture: nil)
        try? vault?.setAccountEmail(email: nil)
        accountEmail = nil
        remoteFile = nil
        withAnimation(.djie) { sync = .off }
    }

    /// Keluar dari akun.
    /// - `deleteLocal == false`: putuskan Google & kunci vault; data tetap terenkripsi di Mac ini.
    /// - `deleteLocal == true`: hapus vault, kunci Touch ID, dan token dari Mac ini → kembali ke layar sambutan.
    ///   Salinan di Google Drive tidak dihapus, jadi bisa dipulihkan dengan login lagi.
    func signOut(deleteLocal: Bool) {
        disconnectGoogle()
        lock()
        guard deleteLocal else { return }
        try? FileManager.default.removeItem(atPath: Config.vaultPath)
        BiometricUnlock.forget()
        pendingRemoteBlob = nil
        pendingAccountEmail = nil
        withAnimation(.djie) { phase = .welcome }
    }

    /// Aktifkan Touch ID untuk vault yang sedang terbuka.
    func enableBiometric() {
        if let v = vault { BiometricUnlock.store(key: v.exportKey()) }
    }

    var lastSynced: Date? { if case .synced(let d) = sync { d } else { nil } }

    private func scheduleSync() {
        guard accountEmail != nil else { return }
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2.5))
            guard !Task.isCancelled else { return }
            await self?.performSync()
        }
    }

    func syncNow() {
        guard accountEmail != nil else { return }
        syncTask?.cancel()
        syncTask = Task { [weak self] in await self?.performSync() }
    }

    private func performSync() async {
        guard let vault else { return }
        guard GoogleTokens.hasRefreshToken else {
            withAnimation(.djie) { sync = .needsLogin }
            return
        }
        withAnimation(.djie) { sync = .syncing }
        do {
            let remote = try await DriveClient.find()
            remoteFile = remote
            if let remote {
                let blob = try await DriveClient.download(remote)
                let outcome = try vault.mergeRemote(blob: blob)
                if outcome.localChanged { withAnimation(.djie) { reload() } }
                if outcome.remoteOutdated { try await DriveClient.upload(try vault.encryptedBlob(), replacing: remote) }
            } else {
                try await DriveClient.upload(try vault.encryptedBlob(), replacing: nil)
            }
            withAnimation(.djie) { sync = .synced(Date()) }
        } catch is CancellationError {
        } catch DriveError.notSignedIn {
            withAnimation(.djie) { sync = .needsLogin }
        } catch {
            withAnimation(.djie) { sync = .failed(error.localizedDescription) }
        }
    }

    // MARK: Hosts

    @discardableResult
    func save(_ host: Host) -> Host? {
        guard let vault else { return nil }
        do {
            let saved = try vault.upsertHost(host: host)
            // Tab yang sedang terbuka untuk host ini langsung memakai tema baru
            for s in sessions where s.host.id == saved.id && s.themeID != saved.terminalTheme {
                s.applyTheme(saved.terminalTheme)
            }
            changed()
            return saved
        } catch {
            flash(error.localizedDescription)
            return nil
        }
    }

    func delete(_ host: Host) {
        try? vault?.deleteHost(id: host.id)
        selection.remove(host.id)
        changed()
    }

    func host(id: String?) -> Host? { hosts.first { $0.id == id } }
    func key(id: String?) -> SshKey? { keys.first { $0.id == id } }

    // MARK: Keychain

    func generateKey(label: String) throws -> SshKey {
        guard let vault else { throw CoreError.NotFound }
        let k = try vault.generateKey(label: label)
        changed()
        return k
    }

    func importKey(label: String, privateKey: String, passphrase: String?) throws {
        guard let vault else { return }
        _ = try vault.importKey(label: label, privateKey: privateKey, passphrase: passphrase)
        changed()
    }

    func renameKey(_ key: SshKey, to label: String) {
        try? vault?.renameKey(id: key.id, label: label)
        changed(animated: false)
    }

    func deleteKey(_ key: SshKey) {
        try? vault?.deleteKey(id: key.id)
        changed()
    }

    // MARK: Snippets

    func save(_ snippet: Snippet) {
        do { _ = try vault?.upsertSnippet(snippet: snippet); changed() }
        catch { flash(error.localizedDescription) }
    }

    func delete(_ snippet: Snippet) {
        try? vault?.deleteSnippet(id: snippet.id)
        changed()
    }

    /// Kirim perintah ke tab terminal yang sedang aktif.
    func runInActiveSession(_ snippet: Snippet) {
        guard let s = sessions.first(where: { $0.id == activeSessionID }) else { return }
        s.send(snippet.command + "\n")
    }

    // MARK: Port forwarding

    func save(_ forward: PortForward) {
        do { _ = try vault?.upsertForward(forward: forward); changed() }
        catch { flash(error.localizedDescription) }
    }

    func delete(_ forward: PortForward) {
        tunnels.stop(forward.id)
        try? vault?.deleteForward(id: forward.id)
        changed()
    }

    func toggleTunnel(_ forward: PortForward) {
        if tunnels.isRunning(forward.id) {
            tunnels.stop(forward.id)
        } else if let h = host(id: forward.hostId) {
            tunnels.start(forward, host: h, key: key(id: h.keyId), jump: host(id: h.jumpHostId))
        } else {
            flash("Host untuk aturan ini sudah tidak ada")
        }
    }

    // MARK: SFTP

    func openSftp(_ host: Host) async {
        withAnimation(.djieSnappy) {
            section = .sftp
            activeSessionID = nil
        }
        await sftp.connect(host, key: key(id: host.keyId))
    }

    // MARK: Logs

    func logStart(_ host: Host) -> String? {
        let id = try? vault?.startLog(hostId: host.id, hostLabel: host.title, address: host.address)
        changed(animated: false)
        return id
    }

    func logEnd(_ id: String?, code: Int32?) {
        guard let id else { return }
        try? vault?.finishLog(id: id, exitCode: code)
        changed(animated: false)
    }

    func clearLogs() {
        try? vault?.clearLogs()
        changed()
    }

    // MARK: Sesi

    /// Buka satu tab per host. `run` = perintah yang dikirim setelah tersambung (dari snippet).
    func connect(_ ids: [String], run: String? = nil) {
        let targets = ids.compactMap { id in hosts.first { $0.id == id } }
        guard !targets.isEmpty else { return }
        for (i, h) in targets.enumerated() {
            // Muncul satu per satu agar animasi tab terasa
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.08) { [self] in
                let s = TerminalSession(host: h, key: key(id: h.keyId), jump: host(id: h.jumpHostId), run: run, model: self)
                withAnimation(.djieSnappy) {
                    sessions.append(s)
                    if i == 0 { activeSessionID = s.id }
                }
            }
        }
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

    /// View terminal dari tab yang sedang tampil (nil jika di daftar host).
    var activeTerminalView: DjieTerminalView? {
        sessions.first { $0.id == activeSessionID }?.view
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

    /// Alamat yang disamarkan untuk tampilan (privasi saat berbagi layar).
    func displayAddress(hidden: Bool) -> String {
        hidden ? "\(username)@••••••••" : address
    }
}

extension Host: Identifiable {}
extension SshKey: Identifiable {}
extension Snippet: Identifiable {}
extension PortForward: Identifiable {}
extension SessionLog: Identifiable {}

/// Kunci pengaturan "sembunyikan alamat host".
enum PrivacyKeys {
    static let hideAddresses = "hideAddresses"
}
