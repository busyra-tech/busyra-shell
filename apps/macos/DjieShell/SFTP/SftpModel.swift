import AppKit
import SwiftUI

/// Satu file / folder di panel lokal atau server.
struct FileItem: Identifiable, Hashable {
    var id: String { path }
    let name: String
    let path: String
    let isDir: Bool
    let size: UInt64
    let modified: Date?
    let permissions: UInt32
}

/// Satu transfer (upload / download) yang sedang berjalan atau selesai.
@MainActor
@Observable
final class Transfer: Identifiable {
    enum Kind { case upload, download }
    enum State: Equatable { case running, done, failed(String), cancelled }

    let id = UUID()
    let kind: Kind
    let name: String
    var done: UInt64 = 0
    var total: UInt64 = 0
    var currentFile = ""
    var state: State = .running
    let started = Date()

    var fraction: Double { total == 0 ? (state == .done ? 1 : 0) : min(1, Double(done) / Double(total)) }

    init(kind: Kind, name: String) {
        self.kind = kind
        self.name = name
    }
}

/// Jembatan progress dari core (thread Rust) ke UI (main thread), dengan throttle ±15 fps.
final class ProgressBridge: TransferProgress, @unchecked Sendable {
    private weak var transfer: Transfer?
    private let lock = NSLock()
    private var cancelled = false
    private var lastPush = Date.distantPast

    init(_ t: Transfer) { transfer = t }

    func cancel() { lock.lock(); cancelled = true; lock.unlock() }

    func onProgress(done: UInt64, total: UInt64, currentFile: String) {
        let now = Date()
        lock.lock()
        let push = now.timeIntervalSince(lastPush) > 0.066 || done == total
        if push { lastPush = now }
        lock.unlock()
        guard push else { return }
        Task { @MainActor [weak transfer] in
            transfer?.done = done
            transfer?.total = total
            transfer?.currentFile = currentFile
        }
    }

    func isCancelled() -> Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
}

@MainActor
@Observable
final class SftpModel {
    enum Status: Equatable { case idle, connecting, connected, failed(String) }

    var host: Host?
    var status: Status = .idle
    var remotePath = ""
    var remoteItems: [FileItem] = []
    var remoteLoading = false
    var localPath = FileManager.default.homeDirectoryForCurrentUser.path
    var localItems: [FileItem] = []
    var showHidden = false
    var transfers: [Transfer] = []
    var error: String?

    /// Item yang sedang di-drag di dalam app (untuk drop antarpanel / banyak file sekaligus).
    @ObservationIgnored var dragging: (remote: Bool, paths: [String])?
    /// Pilihan di panel server (dipakai saat banyak file di-drag ke panel Mac).
    @ObservationIgnored var remoteSelection: Set<String> = []

    @ObservationIgnored private var client: SftpClient?
    @ObservationIgnored private var bridges: [UUID: ProgressBridge] = [:]

    init() { reloadLocal() }

    // MARK: Koneksi

    func connect(_ host: Host, key: SshKey?) async {
        await disconnect()
        self.host = host
        withAnimation(.djie) { status = .connecting }
        let target = SshTarget(
            hostname: host.hostname, port: host.port, username: host.username,
            password: host.auth == .password ? host.password : nil,
            privateKey: host.auth == .key ? key?.privateKey : nil,
            passphrase: host.auth == .key ? key?.passphrase : nil,
            useAgent: true)
        do {
            let c = try await SftpClient.connect(target: target)
            client = c
            let home = try await c.home()
            withAnimation(.djie) { status = .connected }
            await openRemote(home)
        } catch {
            withAnimation(.djie) { status = .failed(error.localizedDescription) }
        }
    }

    func disconnect() async {
        bridges.values.forEach { $0.cancel() }
        if let c = client { await c.close() }
        client = nil
        remoteItems = []
        remotePath = ""
        status = .idle
    }

    // MARK: Server

    func openRemote(_ path: String) async {
        guard let client else { return }
        remoteLoading = true
        defer { remoteLoading = false }
        do {
            let entries = try await client.list(path: path)
            withAnimation(.djieSnappy) {
                remotePath = path
                remoteItems = entries
                    .filter { showHidden || !$0.name.hasPrefix(".") }
                    .map { FileItem(name: $0.name, path: $0.path, isDir: $0.isDir, size: $0.size,
                                    modified: $0.modified > 0 ? Date(timeIntervalSince1970: TimeInterval($0.modified)) : nil,
                                    permissions: $0.permissions) }
            }
        } catch {
            flashError(error)
        }
    }

    func refreshRemote() async { await openRemote(remotePath) }

    func remoteUp() async {
        guard remotePath != "/" else { return }
        let parent = (remotePath as NSString).deletingLastPathComponent
        await openRemote(parent.isEmpty ? "/" : parent)
    }

    func remoteHome() async {
        guard let client, let h = try? await client.home() else { return }
        await openRemote(h)
    }

    func mkdirRemote(_ name: String) async {
        guard let client, !name.isEmpty else { return }
        do { try await client.mkdir(path: join(remotePath, name)); await refreshRemote() } catch { flashError(error) }
    }

    func renameRemote(_ item: FileItem, to name: String) async {
        guard let client, !name.isEmpty, name != item.name else { return }
        do { try await client.rename(from: item.path, to: join(remotePath, name)); await refreshRemote() } catch { flashError(error) }
    }

    func chmodRemote(_ item: FileItem, mode: UInt32) async {
        guard let client else { return }
        do { try await client.chmod(path: item.path, mode: mode); await refreshRemote() } catch { flashError(error) }
    }

    /// Pindahkan item server ke folder server lain (drag di dalam panel server).
    func moveRemote(_ paths: [String], into dir: String) async {
        guard let client, !paths.isEmpty else { return }
        for p in paths {
            do { try await client.rename(from: p, to: join(dir, (p as NSString).lastPathComponent)) } catch { flashError(error) }
        }
        await refreshRemote()
    }

    func deleteRemote(_ items: [FileItem]) async {
        guard let client else { return }
        for i in items {
            do { try await client.remove(path: i.path) } catch { flashError(error) }
        }
        await refreshRemote()
    }

    // MARK: Lokal

    func reloadLocal() {
        let url = URL(fileURLWithPath: localPath)
        let keys: [URLResourceKey] = [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey, .isHiddenKey]
        let urls = (try? FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: keys,
                                                                   options: showHidden ? [] : [.skipsHiddenFiles])) ?? []
        let items = urls.compactMap { u -> FileItem? in
            let v = try? u.resourceValues(forKeys: Set(keys))
            let perms = (try? FileManager.default.attributesOfItem(atPath: u.path)[.posixPermissions] as? NSNumber)?.uint32Value ?? 0
            return FileItem(name: u.lastPathComponent, path: u.path, isDir: v?.isDirectory ?? false,
                            size: UInt64(v?.fileSize ?? 0), modified: v?.contentModificationDate, permissions: perms)
        }
        withAnimation(.djieSnappy) {
            localItems = items.sorted { a, b in a.isDir != b.isDir ? a.isDir : a.name.localizedStandardCompare(b.name) == .orderedAscending }
        }
    }

    func openLocal(_ path: String) {
        localPath = path
        reloadLocal()
    }

    func localUp() {
        let parent = (localPath as NSString).deletingLastPathComponent
        openLocal(parent.isEmpty ? "/" : parent)
    }

    // MARK: Transfer

    func upload(_ paths: [String]) { upload(paths, into: remotePath) }

    /// Upload ke folder server tertentu (mis. saat file dilepas di atas sebuah folder).
    func upload(_ paths: [String], into dir: String) {
        guard let client else { return }
        for p in paths {
            let t = Transfer(kind: .upload, name: (p as NSString).lastPathComponent)
            start(t) { bridge in try await client.upload(local: p, remoteDir: dir, progress: bridge) } onDone: { [weak self] in
                if self?.remotePath == dir { await self?.refreshRemote() }
            }
        }
    }

    func download(_ items: [FileItem]) { download(items, into: localPath) }

    func download(_ items: [FileItem], into dir: String) {
        guard let client else { return }
        for i in items {
            let t = Transfer(kind: .download, name: i.name)
            start(t) { bridge in try await client.download(remote: i.path, localDir: dir, progress: bridge) } onDone: { [weak self] in
                if self?.localPath == dir { self?.reloadLocal() }
            }
        }
    }

    func cancel(_ t: Transfer) { bridges[t.id]?.cancel() }

    /// Dipanggil saat file server di-drag ke Finder: download ke folder sementara, kembalikan lokasinya.
    func exportForDrag(_ item: FileItem) async throws -> URL {
        guard let client else { throw CoreError.NotFound }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("djie-drag-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let t = Transfer(kind: .download, name: item.name)
        let bridge = ProgressBridge(t)
        bridges[t.id] = bridge
        withAnimation(.djieSnappy) { transfers.insert(t, at: 0) }
        defer { bridges[t.id] = nil }
        do {
            try await client.download(remote: item.path, localDir: dir.path, progress: bridge)
            withAnimation(.djie) { t.state = .done; if t.total > 0 { t.done = t.total } }
        } catch {
            withAnimation(.djie) { t.state = .failed(error.localizedDescription) }
            throw error
        }
        return dir.appendingPathComponent(item.name)
    }

    /// File dari Finder dilepas di panel Mac: salin ke folder yang sedang dibuka.
    func copyIntoLocal(_ urls: [URL]) {
        for u in urls where u.deletingLastPathComponent().path != localPath {
            var dest = URL(fileURLWithPath: localPath).appendingPathComponent(u.lastPathComponent)
            var n = 1
            while FileManager.default.fileExists(atPath: dest.path) {
                dest = URL(fileURLWithPath: localPath).appendingPathComponent("\(u.deletingPathExtension().lastPathComponent) (\(n))" + (u.pathExtension.isEmpty ? "" : ".\(u.pathExtension)"))
                n += 1
            }
            try? FileManager.default.copyItem(at: u, to: dest)
        }
        reloadLocal()
    }

    func clearFinished() {
        withAnimation(.djie) { transfers.removeAll { $0.state != .running } }
    }

    private func start(_ t: Transfer, _ work: @escaping (ProgressBridge) async throws -> Void, onDone: @escaping () async -> Void) {
        let bridge = ProgressBridge(t)
        bridges[t.id] = bridge
        withAnimation(.djieSnappy) { transfers.insert(t, at: 0) }
        Task {
            do {
                try await work(bridge)
                withAnimation(.djie) { t.state = .done; if t.total > 0 { t.done = t.total } }
            } catch CoreError.Cancelled {
                withAnimation(.djie) { t.state = .cancelled }
            } catch {
                withAnimation(.djie) { t.state = .failed(error.localizedDescription) }
            }
            bridges[t.id] = nil
            await onDone()
        }
    }

    private func flashError(_ e: Error) {
        withAnimation(.djie) { error = e.localizedDescription }
        let msg = error
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            if self?.error == msg { withAnimation(.djie) { self?.error = nil } }
        }
    }

    private func join(_ dir: String, _ name: String) -> String {
        dir.hasSuffix("/") ? dir + name : dir + "/" + name
    }
}

extension UInt64 {
    var byteString: String { ByteCountFormatter.string(fromByteCount: Int64(self), countStyle: .file) }
}

/// "rwxr-xr-x" dari bit izin.
func permissionString(_ mode: UInt32, isDir: Bool) -> String {
    let chars: [(UInt32, Character)] = [(0o400, "r"), (0o200, "w"), (0o100, "x"), (0o040, "r"), (0o020, "w"), (0o010, "x"),
                                        (0o004, "r"), (0o002, "w"), (0o001, "x")]
    return (isDir ? "d" : "-") + String(chars.map { mode & $0.0 != 0 ? $0.1 : "-" })
}
