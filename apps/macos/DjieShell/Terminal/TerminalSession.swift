import AppKit
import SwiftTerm
import SwiftUI

/// Satu tab terminal = satu proses SSH.
///
/// Tahap awal memakai `/usr/bin/ssh` bawaan macOS (mendukung key, agent, known_hosts, ProxyJump).
/// Nanti diganti SSH dari djie-core (russh) agar sama dengan versi Windows.
@MainActor
@Observable
final class TerminalSession: Identifiable {
    enum Status: Equatable { case connecting, connected, disconnected(Int32?) }

    let id = UUID()
    let host: Host
    var title: String
    var status: Status = .connecting

    @ObservationIgnored private let key: SshKey?
    @ObservationIgnored private let jump: Host?
    @ObservationIgnored private let run: String?
    @ObservationIgnored private weak var model: AppModel?
    @ObservationIgnored private var logID: String?
    @ObservationIgnored private var tempFiles: [URL] = []
    @ObservationIgnored private var delegate: Delegate?
    @ObservationIgnored private(set) lazy var view: DjieTerminalView = makeView()

    init(host: Host, key: SshKey?, jump: Host?, run: String? = nil, model: AppModel? = nil) {
        self.host = host
        self.key = key
        self.jump = jump
        self.run = run
        self.model = model
        self.title = host.title
    }

    /// Kirim teks ke terminal (dipakai snippet).
    func send(_ text: String) {
        view.send(txt: text)
    }

    // MARK: Lifecycle

    private func makeView() -> DjieTerminalView {
        let v = DjieTerminalView(frame: NSRect(x: 0, y: 0, width: 800, height: 500))
        TerminalThemes.apply(host.terminalTheme, to: v)
        let d = Delegate(session: self)
        delegate = d
        v.processDelegate = d
        v.onFirstData = { [weak self] in
            guard let self else { return }
            withAnimation(.djie) { self.status = .connected }
            let commands = [host.startupSnippet, run].compactMap { $0 }.filter { !$0.isEmpty }
            for (i, cmd) in commands.enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6 + Double(i) * 0.3) { v.send(txt: cmd + "\n") }
            }
        }
        start(in: v)
        return v
    }

    private func start(in v: DjieTerminalView) {
        let cmd = SSHCommand(host: host, key: key, jump: jump)
        tempFiles = cmd.tempFiles
        v.resetFirstData()
        status = .connecting
        logID = model?.logStart(host)
        v.startProcess(executable: "/usr/bin/ssh", args: cmd.args, environment: cmd.environment, execName: "ssh")
    }

    func reconnect() {
        cleanup()
        view.getTerminal().resetToInitialState()
        start(in: view)
    }

    func terminate() {
        if case .disconnected = status {} else {
            view.terminate()
            model?.logEnd(logID, code: nil)
            logID = nil
        }
        cleanup()
    }

    fileprivate func processEnded(_ raw: Int32?) {
        // SwiftTerm mengirim status mentah dari waitpid; ambil exit code-nya.
        let code = raw.map { $0 > 255 ? ($0 >> 8) & 0xFF : $0 }
        cleanup()
        model?.logEnd(logID, code: code)
        logID = nil
        withAnimation(.djie) { status = .disconnected(code) }
        view.feed(text: "\r\n\u{1b}[2m— sesi berakhir —\u{1b}[0m\r\n")
    }

    private func cleanup() {
        tempFiles.forEach { try? FileManager.default.removeItem(at: $0) }
        tempFiles = []
    }

    private final class Delegate: NSObject, LocalProcessTerminalViewDelegate {
        weak var session: TerminalSession?
        init(session: TerminalSession) { self.session = session }

        func sizeChanged(source: LocalProcessTerminalView, newCols: Int, newRows: Int) {}
        func setTerminalTitle(source: LocalProcessTerminalView, title: String) {
            Task { @MainActor in if !title.isEmpty { self.session?.title = title } }
        }
        func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}
        func processTerminated(source: TerminalView, exitCode: Int32?) {
            Task { @MainActor in self.session?.processEnded(exitCode) }
        }
    }
}

/// Terminal SwiftTerm dengan callback saat data pertama diterima (tanda sudah tersambung).
final class DjieTerminalView: LocalProcessTerminalView {
    var onFirstData: (() -> Void)?
    private var gotData = false

    func resetFirstData() { gotData = false }

    override func dataReceived(slice: ArraySlice<UInt8>) {
        super.dataReceived(slice: slice)
        if !gotData {
            gotData = true
            DispatchQueue.main.async { self.onFirstData?() }
        }
    }
}

/// Susun argumen `ssh` dari data host.
struct SSHCommand {
    var args: [String] = []
    var environment: [String] = []
    var tempFiles: [URL] = []

    init(host: Host, key: SshKey?, jump: Host?, extra: [String] = []) {
        args = extra + [
            "-p", String(host.port),
            "-o", "ServerAliveInterval=30",
            // Terima host baru otomatis (TOFU), tolak jika fingerprint berubah.
            "-o", "StrictHostKeyChecking=accept-new",
        ]
        if !host.username.isEmpty { args += ["-l", host.username] }
        if host.agentForwarding { args.append("-A") }
        if let jump { args += ["-J", "\(jump.username)@\(jump.hostname):\(jump.port)"] }

        var secret: String?
        switch host.auth {
        case .password:
            secret = host.password
            args += ["-o", "PreferredAuthentications=password,keyboard-interactive,publickey"]
        case .key:
            if let key, let file = Self.writeKey(key) {
                tempFiles.append(file)
                args += ["-i", file.path, "-o", "IdentitiesOnly=yes"]
                secret = key.passphrase
            }
        case .agent:
            break
        }
        for e in host.env where !e.name.isEmpty {
            args += ["-o", "SetEnv=\(e.name)=\(e.value)"]
        }
        args.append(host.hostname)

        // Environment proses
        let base = ProcessInfo.processInfo.environment
        var env: [String: String] = [
            "TERM": "xterm-256color",
            "COLORTERM": "truecolor",
            "LANG": host.charset.uppercased() == "UTF-8" ? "en_US.UTF-8" : "C",
            "HOME": base["HOME"] ?? NSHomeDirectory(),
            "USER": base["USER"] ?? NSUserName(),
            "PATH": base["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin",
        ]
        if let sock = base["SSH_AUTH_SOCK"] { env["SSH_AUTH_SOCK"] = sock }
        // Password / passphrase dikirim lewat helper askpass, bukan argumen (tidak terlihat di `ps`).
        if let secret, !secret.isEmpty, let askpass = Self.askpassScript() {
            env["SSH_ASKPASS"] = askpass.path
            env["SSH_ASKPASS_REQUIRE"] = "force"
            env["DISPLAY"] = ":0"
            env["DJIE_SECRET"] = secret
        }
        environment = env.map { "\($0.key)=\($0.value)" }
    }

    /// Tulis private key ke file sementara (izin 0600), dihapus saat sesi berakhir.
    private static func writeKey(_ key: SshKey) -> URL? {
        let dir = Config.appSupport.appendingPathComponent("session-keys", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true,
                                                 attributes: [.posixPermissions: 0o700])
        let url = dir.appendingPathComponent(UUID().uuidString)
        let pem = key.privateKey.hasSuffix("\n") ? key.privateKey : key.privateKey + "\n"
        guard FileManager.default.createFile(atPath: url.path, contents: Data(pem.utf8),
                                             attributes: [.posixPermissions: 0o600]) else { return nil }
        return url
    }

    /// Skrip kecil yang menjawab prompt password/passphrase dari variabel DJIE_SECRET.
    private static func askpassScript() -> URL? {
        let url = Config.appSupport.appendingPathComponent("askpass.sh")
        let script = """
        #!/bin/sh
        case "$1" in
          *assword*|*assphrase*|*PIN*) printf '%s\\n' "$DJIE_SECRET" ;;
          *) exit 1 ;;
        esac
        """
        guard FileManager.default.createFile(atPath: url.path, contents: Data(script.utf8),
                                             attributes: [.posixPermissions: 0o700]) else { return nil }
        return url
    }
}

enum TerminalThemes {
    struct Def: Identifiable { let id: String; let name: String; let bg: String; let fg: String; let accent: String }

    static let all: [Def] = [
        Def(id: "djie", name: "Djie Night", bg: "#0B0E13", fg: "#E6EDF3", accent: "#3FD0B4"),
        Def(id: "ocean", name: "Deep Ocean", bg: "#0A1628", fg: "#D6E4F5", accent: "#5B9CF5"),
        Def(id: "violet", name: "Violet Dusk", bg: "#14101F", fg: "#E9E2F7", accent: "#9D7CF2"),
        Def(id: "paper", name: "Paper Light", bg: "#F7F6F2", fg: "#24262B", accent: "#0F9D84"),
    ]

    /// Tanpa pilihan tema: ikut mode app (gelap → Djie Night, terang → Paper Light).
    @MainActor static func def(_ id: String?) -> Def {
        if let t = all.first(where: { $0.id == id }) { return t }
        let dark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        return dark ? all[0] : all[3]
    }

    @MainActor static func apply(_ id: String?, to v: TerminalView) {
        let d = def(id)
        v.nativeBackgroundColor = NSColor(Color(hex: d.bg))
        v.nativeForegroundColor = NSColor(Color(hex: d.fg))
        v.caretColor = NSColor(Color(hex: d.accent))
        v.selectedTextBackgroundColor = NSColor(Color(hex: d.accent)).withAlphaComponent(0.35)
        v.font = NSFont(name: "JetBrains Mono", size: 13) ?? .monospacedSystemFont(ofSize: 13, weight: .regular)
    }
}
