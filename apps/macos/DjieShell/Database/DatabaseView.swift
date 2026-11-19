import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct DatabaseView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            if let ws = model.dbWorkspace {
                DbWorkspaceView(ws: ws)
                    .transition(.opacity.combined(with: .move(edge: .trailing)))
            } else {
                DbConnectionList()
                    .transition(.opacity.combined(with: .move(edge: .leading)))
            }
        }
        .animation(.djie, value: model.dbWorkspace?.id)
    }
}

// MARK: - Daftar koneksi

struct DbConnectionList: View {
    @Environment(AppModel.self) private var model
    @AppStorage(PrivacyKeys.hideAddresses) private var hideAddresses = true
    @State private var editing: DbConnection?
    @State private var picking = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                PageHeader(title: "Database", subtitle: "PostgreSQL, MySQL, MariaDB, SQL Server, SQLite, Redis, MongoDB, ClickHouse & lainnya") {
                    Button { picking = true } label: { Label("Koneksi Baru", systemImage: "plus") }
                        .buttonStyle(PrimaryButtonStyle())
                }
                if model.databases.isEmpty {
                    EmptyState(icon: "cylinder.split.1x2", title: "Belum ada koneksi database",
                               text: "Sambungkan langsung, atau lewat tunnel SSH ke database yang hanya bisa diakses dari dalam server.")
                    EngineGrid { p in editing = .blank(p) }
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 14)], spacing: 14) {
                        ForEach(Array(model.databases.enumerated()), id: \.element.id) { i, db in
                            DbCard(db: db, hidden: hideAddresses, onEdit: { editing = db })
                                .staggerIn(i, base: 0)
                        }
                    }
                }
            }
            .padding(28)
        }
        .sheet(isPresented: $picking) {
            VStack(alignment: .leading, spacing: 14) {
                Text("Pilih database").font(.title3.bold())
                EngineGrid { p in picking = false; DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { editing = .blank(p) } }
                HStack { Spacer(); Button("Batal") { picking = false }.buttonStyle(SecondaryButtonStyle()) }
            }
            .padding(24)
            .frame(width: 640)
        }
        .sheet(item: $editing) { DbEditor(original: $0) }
    }
}

/// Logo engine: kotak warna dengan singkatan.
struct EngineBadge: View {
    let preset: DbPreset
    var size: CGFloat = 40
    var body: some View {
        Text(preset.abbr)
            .font(.system(size: size * 0.36, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(hex: preset.color).gradient, in: RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: size * 0.26, style: .continuous).strokeBorder(.white.opacity(0.2)))
            .shadow(color: Color(hex: preset.color).opacity(0.35), radius: 6, y: 2)
    }
}

struct EngineGrid: View {
    var onPick: (DbPreset) -> Void
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
            ForEach(Array(DbPreset.all.enumerated()), id: \.element.id) { i, p in
                Button { onPick(p) } label: {
                    VStack(spacing: 8) {
                        EngineBadge(preset: p, size: 38)
                        Text(p.name).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                        Text(p.hint).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
                .buttonStyle(EngineTileStyle())
                .staggerIn(i, base: 0)
            }
        }
    }
}

private struct EngineTileStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { Tile(configuration: configuration) }
    private struct Tile: View {
        let configuration: Configuration
        @State private var hover = false
        var body: some View {
            configuration.label
                .background(hover ? Theme.cardHover : Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(hover ? Theme.accent.opacity(0.5) : Theme.cardStroke))
                .scaleEffect(configuration.isPressed ? 0.96 : hover ? 1.02 : 1)
                .animation(.djieSnappy, value: hover)
                .animation(.djieSnappy, value: configuration.isPressed)
                .onHover { hover = $0 }
        }
    }
}

struct DbCard: View {
    @Environment(AppModel.self) private var model
    let db: DbConnection
    let hidden: Bool
    var onEdit: () -> Void

    private var preset: DbPreset { DbPreset.find(db) }
    private var address: String {
        if db.engine == .sqlite { return (db.filePath as NSString).abbreviatingWithTildeInPath }
        return hidden ? "\(db.username.isEmpty ? "" : db.username + "@")••••••••" : "\(db.host):\(db.port)"
    }

    var body: some View {
        HoverCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    EngineBadge(preset: preset, size: 42)
                    Spacer()
                    IconButton(symbol: "pencil", help: "Edit", action: onEdit)
                    IconButton(symbol: "trash", help: "Hapus", tint: .red) { model.delete(db) }
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(db.title).font(.system(size: 15, weight: .semibold)).lineLimit(1)
                    Text(address).font(.system(size: 11.5, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1)
                }
                HStack(spacing: 6) {
                    Badge(text: preset.name.uppercased(), color: Color(hex: preset.color)).fixedSize()
                    if db.sshHostId != nil {
                        Badge(text: "SSH", color: Theme.accent).fixedSize()
                    }
                    if !db.database.isEmpty { Badge(text: db.database.uppercased(), color: .gray).lineLimit(1) }
                    Spacer(minLength: 0)
                }
                Button { Task { await model.openDatabase(db) } } label: {
                    Label("Buka", systemImage: "bolt.fill").frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle(wide: true))
            }
        }
        .onTapGesture(count: 2) { Task { await model.openDatabase(db) } }
    }
}

// MARK: - Form koneksi

struct DbEditor: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let original: DbConnection
    @State private var c: DbConnection
    @State private var testing = false
    @State private var testResult: String?
    @State private var testOK = false

    init(original: DbConnection) {
        self.original = original
        _c = State(initialValue: original)
    }

    private var preset: DbPreset { DbPreset.find(c) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                EngineBadge(preset: preset, size: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text(original.id.isEmpty ? "Koneksi \(preset.name)" : "Edit koneksi").font(.title3.bold())
                    Text(preset.hint).font(.caption).foregroundStyle(.secondary)
                }
            }
            TextField("Nama (mis. DB produksi)", text: $c.label).djieField()

            if c.engine == .sqlite {
                HStack {
                    TextField("Path file .sqlite / .db", text: $c.filePath).djieField()
                    Button("Pilih…") { pickFile() }.buttonStyle(SecondaryButtonStyle())
                }
            } else {
                HStack(spacing: 8) {
                    TextField(c.engine == .mongodb ? "Host atau URI mongodb+srv://…" : "Host", text: $c.host).djieField()
                    TextField("Port", value: $c.port, format: .number.grouping(.never)).djieField().frame(width: 90)
                }
                HStack(spacing: 8) {
                    TextField(c.engine == .redis ? "Username (opsional)" : "Username", text: $c.username).djieField()
                    SecureField("Password", text: Binding(get: { c.password ?? "" }, set: { c.password = $0.isEmpty ? nil : $0 })).djieField()
                }
                TextField(c.engine == .redis ? "Nomor database (0–15)" : "Database (opsional)", text: $c.database).djieField()
                Toggle(c.engine == .postgres ? "Wajibkan SSL/TLS" : "Pakai SSL/TLS", isOn: $c.tls).toggleStyle(.switch).tint(Theme.accent)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Tunnel SSH").font(.system(size: 12, weight: .semibold))
                    Picker("", selection: $c.sshHostId) {
                        Text("Tanpa tunnel — koneksi langsung").tag(String?.none)
                        ForEach(model.hosts) { h in Text("Lewat \(h.title)").tag(Optional(h.id)) }
                    }
                    .labelsHidden()
                    if c.sshHostId != nil {
                        Text("Host & port di atas dilihat dari sisi server SSH, biasanya 127.0.0.1.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(12)
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 10))
            }

            if let testResult {
                Label(testResult, systemImage: testOK ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(.callout)
                    .foregroundStyle(testOK ? Color(hex: "#4ADE80") : .orange)
                    .lineLimit(3)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            HStack {
                Button {
                    Task { await test() }
                } label: {
                    HStack(spacing: 6) {
                        if testing { ProgressView().controlSize(.small) } else { Image(systemName: "bolt.horizontal") }
                        Text("Tes koneksi")
                    }
                }
                .buttonStyle(SecondaryButtonStyle())
                .disabled(testing)
                Spacer()
                Button("Batal") { dismiss() }.buttonStyle(SecondaryButtonStyle()).keyboardShortcut(.cancelAction)
                Button("Simpan") { save(open: false) }.buttonStyle(SecondaryButtonStyle())
                Button { save(open: true) } label: { Label("Simpan & Buka", systemImage: "bolt.fill") }
                    .buttonStyle(PrimaryButtonStyle())
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(24)
        .frame(width: 520)
        .animation(.djie, value: testResult)
        .animation(.djie, value: c.sshHostId)
    }

    private func save(open: Bool) {
        var x = c
        if x.label.isEmpty { x.label = x.title }
        model.save(x)
        dismiss()
        if open, let saved = model.databases.first(where: { $0.label == x.label && $0.engine == x.engine }) {
            Task { await model.openDatabase(saved) }
        }
    }

    private func test() async {
        testing = true
        defer { testing = false }
        do {
            let s = try await DbSession.connect(conn: c, ssh: model.sshTarget(forId: c.sshHostId))
            let n = (try? await s.tables().count) ?? 0
            testOK = true
            testResult = "Berhasil tersambung — \(n) tabel/koleksi/key ditemukan"
        } catch {
            testOK = false
            testResult = error.localizedDescription
        }
    }

    private func pickFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        if panel.runModal() == .OK, let url = panel.url {
            c.filePath = url.path
            if c.label.isEmpty { c.label = url.deletingPathExtension().lastPathComponent }
        }
    }
}

// MARK: - Workspace

struct DbWorkspaceView: View {
    @Environment(AppModel.self) private var model
    @Bindable var ws: DbWorkspace
    @State private var tableFilter = ""

    private var preset: DbPreset { DbPreset.find(ws.conn) }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            switch ws.status {
            case .connecting:
                VStack(spacing: 14) {
                    EngineBadge(preset: preset, size: 56).symbolEffect(.pulse)
                    ProgressView().controlSize(.small)
                    Text("Menyambung ke \(ws.conn.title)…").foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let msg):
                VStack(spacing: 12) {
                    Image(systemName: "bolt.horizontal.circle").font(.system(size: 40)).foregroundStyle(.orange)
                    Text("Gagal tersambung").font(.title3.bold())
                    Text(msg).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 480).textSelection(.enabled)
                    HStack {
                        Button("Coba lagi") { Task { await ws.connect(ssh: model.sshTarget(forId: ws.conn.sshHostId)) } }
                            .buttonStyle(PrimaryButtonStyle())
                        Button("Kembali") { model.dbWorkspace = nil }.buttonStyle(SecondaryButtonStyle())
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .ready:
                HSplitView {
                    schemaPanel.frame(minWidth: 200, idealWidth: 240, maxWidth: 360)
                    VSplitView {
                        editor.frame(minHeight: 120, idealHeight: 180)
                        results.frame(minHeight: 160)
                    }
                    .frame(minWidth: 420)
                }
            }
        }
        .animation(.djie, value: ws.status)
    }

    private var header: some View {
        HStack(spacing: 12) {
            IconButton(symbol: "chevron.left", help: "Kembali ke daftar koneksi") { model.dbWorkspace = nil }
            EngineBadge(preset: preset, size: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(ws.conn.title).font(.system(size: 15, weight: .semibold))
                HStack(spacing: 6) {
                    Text(preset.name).font(.caption).foregroundStyle(.secondary)
                    if ws.conn.sshHostId != nil { Badge(text: "SSH TUNNEL", color: Theme.accent) }
                    if ws.status == .ready { PulseDot(color: Color(hex: "#4ADE80")) }
                }
            }
            Spacer()
            if ws.databases.count > 1 {
                Picker("Database", selection: Binding(get: { ws.conn.database }, set: { name in
                    Task { await ws.switchDatabase(name, ssh: model.sshTarget(forId: ws.conn.sshHostId)) }
                })) {
                    if !ws.databases.contains(ws.conn.database) { Text(ws.conn.database.isEmpty ? "(default)" : ws.conn.database).tag(ws.conn.database) }
                    ForEach(ws.databases, id: \.self) { Text($0).tag($0) }
                }
                .frame(maxWidth: 220)
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 12)
    }

    private var filteredTables: [DbTable] {
        tableFilter.isEmpty ? ws.tables : ws.tables.filter { $0.name.localizedCaseInsensitiveContains(tableFilter) }
    }

    private var schemaPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text(ws.conn.engine == .redis ? "KEY" : ws.conn.engine == .mongodb ? "KOLEKSI" : "TABEL")
                    .font(.system(size: 10, weight: .semibold)).tracking(1.2).foregroundStyle(.tertiary)
                Text("\(ws.tables.count)").font(.system(size: 10, weight: .bold))
                    .padding(.horizontal, 6).padding(.vertical, 1).background(Theme.ink.opacity(0.08), in: Capsule())
                Spacer()
                IconButton(symbol: "arrow.clockwise", help: "Muat ulang") { Task { await ws.refreshTables() } }
            }
            .padding(.horizontal, 12).padding(.top, 10)
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary).font(.caption)
                TextField("Cari…", text: $tableFilter).textFieldStyle(.plain).font(.system(size: 12))
            }
            .padding(.horizontal, 9).frame(height: 28)
            .background(Theme.field, in: RoundedRectangle(cornerRadius: 7))
            .padding(10)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 1) {
                    ForEach(filteredTables, id: \.name) { t in
                        TableRow(table: t, engine: ws.conn.engine, selected: ws.selectedTable == t.name) {
                            Task { await ws.openTable(t) }
                        }
                    }
                }
                .padding(.horizontal, 6).padding(.bottom, 8)
            }
        }
        .background(Theme.panel)
    }

    private var editor: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .topLeading) {
                TextEditor(text: $ws.query)
                    .font(.system(size: 13, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(8)
                if ws.query.isEmpty {
                    Text(ws.conn.engine.placeholderQuery)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(.tertiary)
                        .padding(13)
                        .allowsHitTesting(false)
                }
            }
            HStack(spacing: 8) {
                if !ws.history.isEmpty {
                    Menu {
                        ForEach(ws.history, id: \.self) { q in
                            Button(String(q.prefix(80))) { ws.query = q }
                        }
                    } label: { Label("Riwayat", systemImage: "clock.arrow.circlepath") }
                    .menuStyle(.borderlessButton).fixedSize()
                }
                Spacer()
                Text(ws.conn.engine.isSQL ? "⌘⏎ untuk menjalankan" : "Satu perintah per baris")
                    .font(.caption).foregroundStyle(.tertiary)
                Button {
                    Task { await ws.run() }
                } label: {
                    HStack(spacing: 6) {
                        if ws.running { ProgressView().controlSize(.small).tint(.black) } else { Image(systemName: "play.fill") }
                        Text("Jalankan")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(ws.running)
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
        }
        .background(Theme.bg)
    }

    private var results: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                if let e = ws.error {
                    Label(e, systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 12)).foregroundStyle(.orange).lineLimit(2).textSelection(.enabled)
                } else if let r = ws.result {
                    Text(r.columns.isEmpty
                         ? (r.affected.map { "✓ \($0) baris terpengaruh" } ?? "✓ Selesai")
                         : "\(r.rows.count) baris" + (r.truncated ? " (dipotong)" : ""))
                        .font(.system(size: 12, weight: .semibold))
                    Text("· \(r.elapsedMs) ms").font(.system(size: 12)).foregroundStyle(.secondary)
                } else {
                    Text("Jalankan query atau pilih tabel di kiri").font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer()
                if let r = ws.result, !r.columns.isEmpty {
                    Button { ws.exportCSV() } label: { Label("Ekspor CSV", systemImage: "square.and.arrow.down") }
                        .buttonStyle(SecondaryButtonStyle())
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(Theme.panel)
            Divider()
            if let r = ws.result, !r.columns.isEmpty {
                ResultGrid(result: r).id(r.columns.joined() + "\(r.rows.count)\(r.elapsedMs)")
                    .transition(.opacity)
            } else {
                Color.clear
            }
        }
        .animation(.djie, value: ws.result?.elapsedMs)
        .animation(.djie, value: ws.error)
    }
}

struct TableRow: View {
    let table: DbTable
    let engine: DbEngine
    let selected: Bool
    var onOpen: () -> Void
    @State private var hover = false

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 11)).foregroundStyle(table.isView ? Theme.accent3 : Theme.accent2).frame(width: 14)
                Text(table.name).font(.system(size: 12)).lineLimit(1).truncationMode(.middle)
                Spacer(minLength: 0)
                if !table.schema.isEmpty && engine.isSQL && !["public", "dbo", "main"].contains(table.schema) {
                    Text(table.schema).font(.system(size: 9.5)).foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 8).frame(height: 26)
            .background(selected ? Theme.accent.opacity(0.16) : hover ? Theme.ink.opacity(0.05) : .clear,
                        in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hover = $0 }
    }

    private var icon: String {
        switch engine {
        case .redis: "key.fill"
        case .mongodb: "doc.on.doc.fill"
        default: table.isView ? "eye" : "tablecells"
        }
    }
}

/// Tabel hasil: header tetap, gulir dua arah, NULL ditampilkan miring, klik ganda menyalin nilai.
struct ResultGrid: View {
    let result: QueryResult
    @State private var copied: String?

    private var widths: [CGFloat] {
        result.columns.enumerated().map { i, name in
            let sample = result.rows.prefix(60).map { ($0[safe: i] ?? nil)?.count ?? 4 }.max() ?? 4
            return min(360, max(70, CGFloat(max(name.count, sample)) * 7.4 + 22))
        }
    }

    var body: some View {
        let w = widths
        ScrollView([.horizontal, .vertical]) {
            LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                SwiftUI.Section {
                    ForEach(result.rows.indices, id: \.self) { r in
                        HStack(spacing: 0) {
                            Text("\(r + 1)").font(.system(size: 10.5, design: .monospaced)).foregroundStyle(.tertiary)
                                .frame(width: 44, alignment: .trailing).padding(.trailing, 8)
                            ForEach(result.columns.indices, id: \.self) { c in
                                cell(result.rows[r][safe: c] ?? nil).frame(width: w[c], alignment: .leading)
                            }
                        }
                        .frame(height: 26)
                        .background(r % 2 == 1 ? Theme.ink.opacity(0.025) : .clear)
                    }
                } header: {
                    HStack(spacing: 0) {
                        Text("#").frame(width: 44, alignment: .trailing).padding(.trailing, 8).foregroundStyle(.tertiary)
                        ForEach(result.columns.indices, id: \.self) { c in
                            Text(result.columns[c]).lineLimit(1).frame(width: w[c], alignment: .leading).padding(.leading, 8)
                        }
                    }
                    .font(.system(size: 11.5, weight: .semibold))
                    .frame(height: 28)
                    .background(.bar)
                    .overlay(alignment: .bottom) { Divider() }
                }
            }
        }
        .background(Theme.bg)
        .overlay(alignment: .bottom) {
            if let copied {
                Text("Disalin: \(copied.prefix(40))")
                    .font(.caption).padding(.horizontal, 12).padding(.vertical, 6)
                    .background(.ultraThickMaterial, in: Capsule()).padding(10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.djie, value: copied)
    }

    private func cell(_ v: String?) -> some View {
        Group {
            if let v {
                Text(v.replacingOccurrences(of: "\n", with: " ⏎ ")).lineLimit(1).truncationMode(.tail)
            } else {
                Text("NULL").italic().foregroundStyle(.tertiary)
            }
        }
        .font(.system(size: 12, design: .monospaced))
        .padding(.leading, 8)
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(v ?? "", forType: .string)
            copied = v ?? "NULL"
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { if copied == (v ?? "NULL") { copied = nil } }
        }
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
