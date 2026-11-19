import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct SftpView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let sftp = model.sftp
        VStack(spacing: 0) {
            SftpHeader()
            Divider()
            switch sftp.status {
            case .idle:
                SftpPicker().transition(.opacity)
            case .connecting:
                SftpConnecting(host: sftp.host).transition(.opacity)
            case .failed(let msg):
                SftpFailed(message: msg).transition(.opacity)
            case .connected:
                HSplitView {
                    LocalPane().frame(minWidth: 300)
                    RemotePane().frame(minWidth: 300)
                }
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                if !sftp.transfers.isEmpty {
                    TransferList().transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .animation(.djie, value: sftp.status)
        .animation(.djie, value: sftp.transfers.isEmpty)
        .overlay(alignment: .bottom) {
            if let e = sftp.error {
                Label(e, systemImage: "exclamationmark.triangle.fill")
                    .font(.callout)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(.ultraThickMaterial, in: Capsule())
                    .overlay(Capsule().strokeBorder(.orange.opacity(0.5)))
                    .padding(.bottom, 20)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }
}

// MARK: - Header & pemilih host

struct SftpHeader: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let sftp = model.sftp
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                Text("SFTP").font(.system(size: 22, weight: .bold, design: .rounded))
                Text(sftp.host.map { "Tersambung ke \($0.title)" } ?? "Transfer file Mac ↔ server")
                    .font(.callout).foregroundStyle(.secondary)
            }
            Spacer()
            if sftp.status == .connected {
                Toggle("File tersembunyi", isOn: Binding(get: { sftp.showHidden }, set: { v in
                    sftp.showHidden = v
                    sftp.reloadLocal()
                    Task { await sftp.refreshRemote() }
                }))
                .toggleStyle(.checkbox)
                .font(.callout)
            }
            Menu {
                ForEach(model.hosts) { h in
                    Button(h.title) { Task { await model.openSftp(h) } }
                }
            } label: {
                Label(sftp.host == nil ? "Pilih host" : "Ganti host", systemImage: "server.rack")
            }
            .menuStyle(.button)
            .fixedSize()
            .disabled(model.hosts.isEmpty)
            if sftp.status == .connected {
                Button { Task { await sftp.disconnect() } } label: { Label("Putuskan", systemImage: "xmark.circle") }
                    .buttonStyle(SecondaryButtonStyle())
            }
        }
        .padding(.horizontal, 22).padding(.vertical, 14)
    }
}

struct SftpPicker: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                EmptyState(icon: "folder.badge.gearshape", title: "Pilih server",
                           text: "Buka file di server lewat SFTP — memakai login host yang sudah tersimpan.")
                    .padding(.top, -30)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
                    ForEach(Array(model.hosts.enumerated()), id: \.element.id) { i, h in
                        Button { Task { await model.openSftp(h) } } label: {
                            HStack(spacing: 10) {
                                RoundedRectangle(cornerRadius: 9, style: .continuous)
                                    .fill(Color(hex: h.color).gradient)
                                    .overlay(Image(systemName: "folder.fill").font(.system(size: 14, weight: .bold)).foregroundStyle(.black.opacity(0.7)))
                                    .frame(width: 34, height: 34)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(h.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                                    Text(h.displayAddress(hidden: true)).font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.right.circle.fill").foregroundStyle(Color(hex: h.color))
                            }
                            .padding(12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.cardStroke))
                        .staggerIn(i, base: 0.05)
                    }
                }
            }
            .padding(28)
        }
    }
}

struct SftpConnecting: View {
    let host: Host?
    var body: some View {
        if let host { ConnectingOverlay(host: host).frame(maxWidth: .infinity, maxHeight: .infinity) }
    }
}

struct SftpFailed: View {
    @Environment(AppModel.self) private var model
    let message: String
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "bolt.horizontal.circle").font(.system(size: 40)).foregroundStyle(.orange)
            Text("Tidak bisa membuka SFTP").font(.title3.bold())
            Text(message).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 440)
            HStack {
                Button("Coba lagi") { if let h = model.sftp.host { Task { await model.openSftp(h) } } }
                    .buttonStyle(PrimaryButtonStyle())
                Button("Pilih host lain") { Task { await model.sftp.disconnect() } }
                    .buttonStyle(SecondaryButtonStyle())
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Panel file

struct LocalPane: View {
    @Environment(AppModel.self) private var model
    @State private var selection: Set<String> = []
    @State private var dropTarget = false

    var body: some View {
        let sftp = model.sftp
        FilePane(
            title: "Mac ini", icon: "laptopcomputer", path: sftp.localPath, items: sftp.localItems,
            selection: $selection, isDropTarget: dropTarget,
            onOpen: { item in if item.isDir { sftp.openLocal(item.path) } else { NSWorkspace.shared.open(URL(fileURLWithPath: item.path)) } },
            onUp: { sftp.localUp() },
            onRefresh: { sftp.reloadLocal() },
            onPath: { sftp.openLocal($0) },
            transferTitle: "Upload",
            transferIcon: "arrow.up.circle.fill",
            onTransfer: { sftp.upload(selectedItems.map(\.path)); selection.removeAll() },
            dragValue: { "local:" + $0.path }
        ) { item in
            Button("Upload ke server") { sftp.upload([item.path]) }
            Button("Tampilkan di Finder") { NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: item.path)]) }
        } toolbarExtra: {
            IconButton(symbol: "house", help: "Home") { sftp.openLocal(FileManager.default.homeDirectoryForCurrentUser.path) }
        }
        // Terima drop dari panel server (download) dan dari Finder (diabaikan — sudah lokal)
        .dropDestination(for: String.self) { values, _ in
            let paths = values.filter { $0.hasPrefix("remote:") }.map { String($0.dropFirst(7)) }
            let items = sftp.remoteItems.filter { paths.contains($0.path) }
            guard !items.isEmpty else { return false }
            sftp.download(items)
            return true
        } isTargeted: { dropTarget = $0 }
    }

    private var selectedItems: [FileItem] { model.sftp.localItems.filter { selection.contains($0.id) } }
}

struct RemotePane: View {
    @Environment(AppModel.self) private var model
    @State private var selection: Set<String> = []
    @State private var dropTarget = false
    @State private var renaming: FileItem?
    @State private var chmodding: FileItem?
    @State private var newFolder = false
    @State private var confirmDelete: [FileItem] = []

    var body: some View {
        let sftp = model.sftp
        FilePane(
            title: sftp.host?.title ?? "Server", icon: "server.rack", path: sftp.remotePath, items: sftp.remoteItems,
            selection: $selection, isDropTarget: dropTarget, loading: sftp.remoteLoading,
            onOpen: { item in if item.isDir { Task { await sftp.openRemote(item.path) } } else { sftp.download([item]) } },
            onUp: { Task { await sftp.remoteUp() } },
            onRefresh: { Task { await sftp.refreshRemote() } },
            onPath: { p in Task { await sftp.openRemote(p) } },
            transferTitle: "Download",
            transferIcon: "arrow.down.circle.fill",
            onTransfer: { sftp.download(selectedItems); selection.removeAll() },
            dragValue: { "remote:" + $0.path }
        ) { item in
            Button("Download ke Mac") { sftp.download([item]) }
            Button("Ganti nama…") { renaming = item }
            Button("Ubah izin (chmod)…") { chmodding = item }
            Button("Salin path") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(item.path, forType: .string)
            }
            Divider()
            Button("Hapus", role: .destructive) {
                confirmDelete = selection.contains(item.id) ? selectedItems : [item]
            }
        } toolbarExtra: {
            IconButton(symbol: "house", help: "Home") { Task { await sftp.remoteHome() } }
            IconButton(symbol: "folder.badge.plus", help: "Folder baru") { newFolder = true }
            IconButton(symbol: "trash", help: "Hapus yang dipilih", tint: .red) { confirmDelete = selectedItems }
                .disabled(selection.isEmpty)
        }
        // Drop dari panel Mac atau langsung dari Finder → upload
        .dropDestination(for: URL.self) { urls, _ in
            let files = urls.filter(\.isFileURL).map(\.path)
            guard !files.isEmpty else { return false }
            sftp.upload(files)
            return true
        } isTargeted: { dropTarget = $0 }
        .dropDestination(for: String.self) { values, _ in
            let paths = values.filter { $0.hasPrefix("local:") }.map { String($0.dropFirst(6)) }
            guard !paths.isEmpty else { return false }
            sftp.upload(paths)
            return true
        } isTargeted: { dropTarget = $0 }
        .sheet(item: $renaming) { item in
            TextPromptSheet(title: "Ganti nama", initial: item.name, action: "Simpan") { name in
                Task { await sftp.renameRemote(item, to: name) }
            }
        }
        .sheet(item: $chmodding) { item in ChmodSheet(item: item) { mode in Task { await sftp.chmodRemote(item, mode: mode) } } }
        .sheet(isPresented: $newFolder) {
            TextPromptSheet(title: "Folder baru", initial: "folder-baru", action: "Buat") { name in
                Task { await sftp.mkdirRemote(name) }
            }
        }
        .confirmationDialog("Hapus \(confirmDelete.count) item dari server?",
                            isPresented: Binding(get: { !confirmDelete.isEmpty }, set: { if !$0 { confirmDelete = [] } })) {
            Button("Hapus", role: .destructive) {
                let items = confirmDelete
                selection.removeAll()
                Task { await sftp.deleteRemote(items) }
            }
        } message: {
            Text(confirmDelete.map(\.name).prefix(5).joined(separator: ", ") + " — tidak bisa dibatalkan. Folder dihapus beserta isinya.")
        }
    }

    private var selectedItems: [FileItem] { model.sftp.remoteItems.filter { selection.contains($0.id) } }
}

/// Panel daftar file yang dipakai bersama oleh lokal & server.
struct FilePane<RowMenu: View, Extra: View>: View {
    let title: String
    let icon: String
    let path: String
    let items: [FileItem]
    @Binding var selection: Set<String>
    var isDropTarget = false
    var loading = false
    var onOpen: (FileItem) -> Void
    var onUp: () -> Void
    var onRefresh: () -> Void
    var onPath: (String) -> Void
    var transferTitle: String
    var transferIcon: String
    var onTransfer: () -> Void
    var dragValue: (FileItem) -> String
    @ViewBuilder var rowMenu: (FileItem) -> RowMenu
    @ViewBuilder var toolbarExtra: () -> Extra

    @State private var editingPath = false
    @State private var pathText = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: icon).foregroundStyle(Theme.accent)
                Text(title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                Spacer()
                if loading { ProgressView().controlSize(.small) }
                IconButton(symbol: "chevron.up", help: "Folder induk", action: onUp)
                IconButton(symbol: "arrow.clockwise", help: "Muat ulang", action: onRefresh)
                toolbarExtra()
            }
            .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 6)

            // Path: klik untuk mengetik manual
            Group {
                if editingPath {
                    TextField("Path", text: $pathText, onCommit: { onPath(pathText); editingPath = false })
                        .textFieldStyle(.plain)
                        .font(.system(size: 11, design: .monospaced))
                } else {
                    Breadcrumb(path: path, onTap: onPath)
                        .onTapGesture(count: 2) { pathText = path; editingPath = true }
                }
            }
            .padding(.horizontal, 10).frame(height: 26)
            .background(Theme.field, in: RoundedRectangle(cornerRadius: 7))
            .padding(.horizontal, 12).padding(.bottom, 8)

            Table(items, selection: $selection) {
                TableColumn("Nama") { item in
                    HStack(spacing: 7) {
                        Image(systemName: item.isDir ? "folder.fill" : fileIcon(item.name))
                            .foregroundStyle(item.isDir ? Theme.accent2 : .secondary)
                            .frame(width: 16)
                        Text(item.name).lineLimit(1)
                    }
                    .draggable(dragValue(item))
                }
                .width(min: 140, ideal: 240)
                TableColumn("Ukuran") { item in
                    Text(item.isDir ? "—" : item.size.byteString).foregroundStyle(.secondary).monospacedDigit()
                }
                .width(min: 60, ideal: 80)
                TableColumn("Diubah") { item in
                    Text(item.modified?.formatted(date: .abbreviated, time: .shortened) ?? "—").foregroundStyle(.secondary)
                }
                .width(min: 90, ideal: 130)
                TableColumn("Izin") { item in
                    Text(permissionString(item.permissions, isDir: item.isDir))
                        .font(.system(size: 11, design: .monospaced)).foregroundStyle(.tertiary)
                }
                .width(min: 80, ideal: 90)
            }
            .contextMenu(forSelectionType: String.self) { ids in
                if let id = ids.first, let item = items.first(where: { $0.id == id }) { rowMenu(item) }
            } primaryAction: { ids in
                if ids.count == 1, let id = ids.first, let item = items.first(where: { $0.id == id }) { onOpen(item) }
            }
            .scrollContentBackground(.hidden)

            HStack {
                Text(selection.isEmpty ? "\(items.count) item" : "\(selection.count) dipilih")
                    .font(.caption).foregroundStyle(.secondary)
                    .contentTransition(.numericText())
                Spacer()
                Button(action: onTransfer) { Label(transferTitle, systemImage: transferIcon) }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(selection.isEmpty)
            }
            .padding(10)
        }
        .background(Theme.bg)
        .overlay {
            if isDropTarget {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Theme.accent, style: StrokeStyle(lineWidth: 2, dash: [8, 5]))
                    .background(Theme.accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(Label("Lepas untuk \(transferTitle.lowercased())", systemImage: transferIcon)
                        .font(.headline).foregroundStyle(Theme.accent))
                    .padding(6)
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }
        }
        .animation(.djieSnappy, value: isDropTarget)
    }

    private func fileIcon(_ name: String) -> String {
        switch (name as NSString).pathExtension.lowercased() {
        case "png", "jpg", "jpeg", "gif", "webp", "svg", "heic": "photo"
        case "zip", "gz", "tgz", "tar", "bz2", "xz", "7z", "rar": "doc.zipper"
        case "sh", "py", "js", "ts", "rb", "go", "rs", "php", "swift", "java", "c", "h", "cpp": "chevron.left.forwardslash.chevron.right"
        case "json", "yml", "yaml", "toml", "xml", "conf", "ini", "env": "gearshape"
        case "log", "txt", "md": "doc.text"
        case "sql", "db", "sqlite": "cylinder"
        case "pdf": "doc.richtext"
        default: "doc"
        }
    }
}

/// Path yang bisa diklik per bagian: / › var › www.
struct Breadcrumb: View {
    let path: String
    var onTap: (String) -> Void

    var body: some View {
        let parts = path.split(separator: "/").map(String.init)
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                Button("/") { onTap("/") }.buttonStyle(.plain)
                ForEach(parts.indices, id: \.self) { i in
                    Image(systemName: "chevron.right").font(.system(size: 8, weight: .bold)).foregroundStyle(.tertiary)
                    Button(parts[i]) { onTap("/" + parts[...i].joined(separator: "/")) }
                        .buttonStyle(.plain)
                        .foregroundStyle(i == parts.count - 1 ? .primary : .secondary)
                }
            }
            .font(.system(size: 11, design: .monospaced))
        }
    }
}

// MARK: - Antrean transfer

struct TransferList: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let sftp = model.sftp
        VStack(spacing: 0) {
            Divider()
            HStack {
                Text("Transfer").font(.system(size: 12, weight: .semibold))
                let running = sftp.transfers.filter { $0.state == .running }.count
                if running > 0 { Badge(text: "\(running) BERJALAN") }
                Spacer()
                Button("Bersihkan selesai") { sftp.clearFinished() }.buttonStyle(.borderless).font(.caption)
            }
            .padding(.horizontal, 14).padding(.top, 8)
            ScrollView {
                VStack(spacing: 6) {
                    ForEach(sftp.transfers) { t in
                        TransferRow(transfer: t) { sftp.cancel(t) }
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
                .padding(10)
            }
            .frame(height: min(CGFloat(sftp.transfers.count) * 52 + 16, 170))
        }
        .background(Theme.panel)
    }
}

struct TransferRow: View {
    let transfer: Transfer
    var onCancel: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: transfer.kind == .upload ? "arrow.up.circle.fill" : "arrow.down.circle.fill")
                .font(.system(size: 18))
                .foregroundStyle(color)
                .symbolEffect(.pulse, isActive: transfer.state == .running)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(transfer.name).font(.system(size: 12, weight: .medium)).lineLimit(1)
                    Spacer()
                    Text(statusText).font(.system(size: 11)).foregroundStyle(.secondary).monospacedDigit()
                }
                ProgressView(value: transfer.fraction)
                    .progressViewStyle(.linear)
                    .tint(color)
                    .animation(.easeOut(duration: 0.2), value: transfer.fraction)
            }
            if transfer.state == .running {
                IconButton(symbol: "xmark", help: "Batalkan", action: onCancel)
            } else {
                Image(systemName: icon).foregroundStyle(color).frame(width: 28)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 9))
    }

    private var color: Color {
        switch transfer.state {
        case .running: Theme.accent
        case .done: Color(hex: "#4ADE80")
        case .failed: .orange
        case .cancelled: .gray
        }
    }

    private var icon: String {
        switch transfer.state {
        case .done: "checkmark.circle.fill"
        case .failed: "exclamationmark.triangle.fill"
        default: "minus.circle"
        }
    }

    private var statusText: String {
        switch transfer.state {
        case .running:
            let speed = Double(transfer.done) / max(Date().timeIntervalSince(transfer.started), 0.1)
            return "\(transfer.done.byteString) / \(transfer.total.byteString) · \(UInt64(speed).byteString)/s"
        case .done: return "Selesai · \(transfer.total.byteString)"
        case .failed(let m): return m
        case .cancelled: return "Dibatalkan"
        }
    }
}

// MARK: - Sheet kecil

struct TextPromptSheet: View {
    let title: String
    let initial: String
    let action: String
    var onSubmit: (String) -> Void
    @State private var text = ""

    var body: some View {
        FormSheet(title: title, saveTitle: action, canSave: !text.trimmingCharacters(in: .whitespaces).isEmpty,
                  onSave: { onSubmit(text.trimmingCharacters(in: .whitespaces)) }) {
            TextField("Nama", text: $text).djieField()
        }
        .onAppear { text = initial }
    }
}

struct ChmodSheet: View {
    let item: FileItem
    var onSave: (UInt32) -> Void
    @State private var mode: UInt32 = 0

    private let rows: [(String, UInt32)] = [("Pemilik", 6), ("Grup", 3), ("Lainnya", 0)]
    private let cols: [(String, UInt32)] = [("Baca", 4), ("Tulis", 2), ("Jalankan", 1)]

    var body: some View {
        FormSheet(title: "Izin “\(item.name)”", onSave: { onSave(mode) }) {
            Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 10) {
                GridRow {
                    Text("")
                    ForEach(cols, id: \.0) { Text($0.0).font(.caption).foregroundStyle(.secondary) }
                }
                ForEach(rows, id: \.0) { row in
                    GridRow {
                        Text(row.0)
                        ForEach(cols, id: \.0) { col in
                            let bit = col.1 << row.1
                            Toggle("", isOn: Binding(get: { mode & bit != 0 }, set: { on in
                                withAnimation(.djieSnappy) { mode = on ? mode | bit : mode & ~bit }
                            }))
                            .toggleStyle(.checkbox).labelsHidden()
                        }
                    }
                }
            }
            HStack {
                Text(String(mode, radix: 8).leftPad(3)).font(.system(size: 22, weight: .bold, design: .monospaced))
                    .contentTransition(.numericText())
                Text(permissionString(mode, isDir: item.isDir)).font(.system(size: 13, design: .monospaced)).foregroundStyle(.secondary)
            }
        }
        .onAppear { mode = item.permissions & 0o777 }
    }
}

private extension String {
    func leftPad(_ n: Int) -> String { count >= n ? self : String(repeating: "0", count: n - count) + self }
}
