import AppKit
import SwiftUI

/// Layanan database siap pakai. Beberapa memakai protokol engine lain (mis. CockroachDB = PostgreSQL).
struct DbPreset: Identifiable, Hashable {
    let id: String
    let name: String
    let engine: DbEngine
    let port: UInt16
    let tls: Bool
    let color: String
    let abbr: String
    let hint: String

    static let all: [DbPreset] = [
        DbPreset(id: "postgres", name: "PostgreSQL", engine: .postgres, port: 5432, tls: false, color: "#336791", abbr: "PG", hint: "Database relasional open source"),
        DbPreset(id: "mysql", name: "MySQL", engine: .mysql, port: 3306, tls: false, color: "#00758F", abbr: "My", hint: "Database relasional populer"),
        DbPreset(id: "mariadb", name: "MariaDB", engine: .mariadb, port: 3306, tls: false, color: "#C0765A", abbr: "Ma", hint: "Turunan MySQL"),
        DbPreset(id: "sqlserver", name: "SQL Server", engine: .sqlserver, port: 1433, tls: false, color: "#CC2927", abbr: "MS", hint: "Microsoft SQL Server / MSSQL"),
        DbPreset(id: "sqlite", name: "SQLite", engine: .sqlite, port: 0, tls: false, color: "#0F80CC", abbr: "SL", hint: "File database lokal"),
        DbPreset(id: "redis", name: "Redis", engine: .redis, port: 6379, tls: false, color: "#DC382D", abbr: "Rd", hint: "Key-value in-memory"),
        DbPreset(id: "mongodb", name: "MongoDB", engine: .mongodb, port: 27017, tls: false, color: "#47A248", abbr: "Mg", hint: "Database dokumen"),
        DbPreset(id: "clickhouse", name: "ClickHouse", engine: .clickhouse, port: 8123, tls: false, color: "#E8B500", abbr: "CH", hint: "Analitik kolumnar (HTTP)"),
        // Kompatibel protokol
        DbPreset(id: "cockroach", name: "CockroachDB", engine: .postgres, port: 26257, tls: true, color: "#6933FF", abbr: "Cr", hint: "Protokol PostgreSQL"),
        DbPreset(id: "timescale", name: "TimescaleDB", engine: .postgres, port: 5432, tls: false, color: "#FDB515", abbr: "Ts", hint: "Time-series di atas PostgreSQL"),
        DbPreset(id: "yugabyte", name: "YugabyteDB", engine: .postgres, port: 5433, tls: false, color: "#FF6E42", abbr: "Yb", hint: "Protokol PostgreSQL"),
        DbPreset(id: "supabase", name: "Supabase", engine: .postgres, port: 5432, tls: true, color: "#3ECF8E", abbr: "Sb", hint: "Postgres terkelola"),
        DbPreset(id: "neon", name: "Neon", engine: .postgres, port: 5432, tls: true, color: "#00E599", abbr: "Ne", hint: "Postgres serverless"),
        DbPreset(id: "rds-pg", name: "Amazon RDS PostgreSQL", engine: .postgres, port: 5432, tls: true, color: "#FF9900", abbr: "RP", hint: "AWS RDS / Aurora PostgreSQL"),
        DbPreset(id: "rds-my", name: "Amazon Aurora MySQL", engine: .mysql, port: 3306, tls: true, color: "#FF9900", abbr: "RM", hint: "AWS RDS / Aurora MySQL"),
        DbPreset(id: "tidb", name: "TiDB", engine: .mysql, port: 4000, tls: false, color: "#E30C34", abbr: "Ti", hint: "Protokol MySQL"),
        DbPreset(id: "planetscale", name: "PlanetScale", engine: .mysql, port: 3306, tls: true, color: "#111111", abbr: "PS", hint: "MySQL serverless"),
        DbPreset(id: "percona", name: "Percona Server", engine: .mysql, port: 3306, tls: false, color: "#E4512B", abbr: "Pc", hint: "Turunan MySQL"),
        DbPreset(id: "azure-sql", name: "Azure SQL", engine: .sqlserver, port: 1433, tls: true, color: "#0078D4", abbr: "Az", hint: "SQL Server di Azure"),
        DbPreset(id: "valkey", name: "Valkey", engine: .redis, port: 6379, tls: false, color: "#6983FF", abbr: "Vk", hint: "Protokol Redis"),
        DbPreset(id: "dragonfly", name: "Dragonfly", engine: .redis, port: 6379, tls: false, color: "#8B5CF6", abbr: "Df", hint: "Protokol Redis"),
        DbPreset(id: "upstash", name: "Upstash Redis", engine: .redis, port: 6379, tls: true, color: "#00E9A3", abbr: "Up", hint: "Redis serverless"),
        DbPreset(id: "atlas", name: "MongoDB Atlas", engine: .mongodb, port: 27017, tls: true, color: "#00684A", abbr: "At", hint: "Tempel URI mongodb+srv:// di kolom host"),
    ]

    static func forEngine(_ e: DbEngine) -> DbPreset { all.first { $0.engine == e }! }
    static func find(_ c: DbConnection) -> DbPreset {
        all.first { $0.color.uppercased() == c.color.uppercased() && $0.engine == c.engine } ?? forEngine(c.engine)
    }
}

extension DbEngine {
    var title: String { DbPreset.forEngine(self).name }
    var isSQL: Bool { self != .redis && self != .mongodb }
    var placeholderQuery: String {
        switch self {
        case .redis: "GET key\nHGETALL user:1"
        case .mongodb: "db.users.find({\"aktif\": true})"
        case .sqlserver: "SELECT TOP 100 * FROM dbo.users"
        default: "SELECT * FROM users LIMIT 100;"
        }
    }
}

extension DbConnection {
    static func blank(_ p: DbPreset) -> DbConnection {
        DbConnection(id: "", label: "", engine: p.engine, host: p.engine == .sqlite ? "" : "127.0.0.1", port: p.port,
                     username: defaultUser(p.engine), password: nil, database: "", filePath: "", tls: p.tls,
                     sshHostId: nil, color: p.color, updatedAt: 0, deleted: false)
    }

    static func defaultUser(_ e: DbEngine) -> String {
        switch e {
        case .postgres: "postgres"
        case .mysql, .mariadb: "root"
        case .sqlserver: "sa"
        case .clickhouse: "default"
        default: ""
        }
    }

    var title: String { label.isEmpty ? (engine == .sqlite ? (filePath as NSString).lastPathComponent : host) : label }
}

extension DbConnection: Identifiable {}

/// Database bawaan sistem: disembunyikan di grup tersendiri seperti phpMyAdmin.
extension DbEngine {
    var systemDatabases: Set<String> {
        switch self {
        case .mysql, .mariadb: ["information_schema", "mysql", "performance_schema", "sys"]
        case .sqlserver: ["master", "tempdb", "model", "msdb"]
        case .clickhouse: ["system", "INFORMATION_SCHEMA", "information_schema"]
        case .mongodb: ["admin", "local", "config"]
        default: []
        }
    }

    /// Engine yang bisa membaca tabel database lain tanpa pindah koneksi.
    var listsAcrossDatabases: Bool {
        switch self {
        case .postgres, .redis: false
        default: true
        }
    }

    var supportsStructure: Bool { isSQL }
}

/// Satu koneksi database yang sedang terbuka (tampilan ala phpMyAdmin).
@MainActor
@Observable
final class DbWorkspace: Identifiable {
    enum Status: Equatable { case connecting, ready, failed(String) }
    enum Tab: String, CaseIterable, Identifiable {
        case overview, browse, structure, sql
        var id: String { rawValue }
        var title: String {
            switch self {
            case .overview: "Ringkasan"
            case .browse: "Telusuri"
            case .structure: "Struktur"
            case .sql: "SQL"
            }
        }
        var icon: String {
            switch self {
            case .overview: "square.grid.2x2"
            case .browse: "tablecells"
            case .structure: "list.bullet.rectangle"
            case .sql: "chevron.left.forwardslash.chevron.right"
            }
        }
    }

    let id = UUID()
    var conn: DbConnection
    var status: Status = .connecting

    // Pohon database
    var databases: [String] = []
    var dbTables: [String: [DbTable]] = [:]
    var expanded: Set<String> = []
    var loadingDbs: Set<String> = []
    var activeDatabase: String?
    var showSystem = false

    // Pilihan
    var selectedDb: String?
    var selectedTable: DbTable?
    var tab: Tab = .overview

    // Telusuri (halaman data)
    var page: QueryResult?
    var pageSize: UInt32 = 100
    var offset: UInt64 = 0
    var totalRows: UInt64?
    var totalIsEstimate = false

    // Struktur
    var structure: QueryResult?

    // SQL
    var query = ""
    var result: QueryResult?
    var history: [String] = []

    var running = false
    var error: String?

    @ObservationIgnored private var session: DbSession?
    @ObservationIgnored private var ssh: SshTarget?

    init(conn: DbConnection) {
        self.conn = conn
    }

    var userDatabases: [String] { databases.filter { !conn.engine.systemDatabases.contains($0) } }
    var systemDatabases: [String] { databases.filter { conn.engine.systemDatabases.contains($0) } }
    var availableTabs: [Tab] {
        if selectedTable != nil { return conn.engine.supportsStructure ? [.browse, .structure, .sql] : [.browse, .sql] }
        return [.overview, .sql]
    }

    func connect(ssh: SshTarget?) async {
        self.ssh = ssh
        withAnimation(.djie) { status = .connecting }
        do {
            let s = try await DbSession.connect(conn: conn, ssh: ssh)
            session = s
            var dbs = (try? await s.databases()) ?? []
            if conn.engine == .sqlite { dbs = ["main"] }
            let fallback: String? = switch conn.engine {
                case .sqlite: "main"
                case .postgres: "postgres"
                case .redis: "0"
                default: nil
            }
            let active = conn.database.isEmpty ? fallback : conn.database
            withAnimation(.djie) {
                databases = dbs
                activeDatabase = active
                status = .ready
            }
            // Buka otomatis: database di koneksi, atau satu-satunya database pengguna
            if let a = active ?? (userDatabases.count == 1 ? userDatabases.first : nil) {
                await toggle(a, forceOpen: true)
                if selectedDb == nil { selectedDb = a }
            }
            if conn.engine == .redis || conn.engine == .sqlite, let a = active ?? databases.first {
                await toggle(a, forceOpen: true)
                selectedDb = a
            }
        } catch {
            withAnimation(.djie) { status = .failed(error.localizedDescription) }
        }
    }

    /// Buka/tutup node database di pohon (tabel dimuat saat pertama dibuka).
    func toggle(_ db: String, forceOpen: Bool = false) async {
        if expanded.contains(db) && !forceOpen {
            _ = withAnimation(.djieSnappy) { expanded.remove(db) }
            return
        }
        _ = withAnimation(.djieSnappy) { expanded.insert(db) }
        if dbTables[db] == nil { await loadTables(db) }
    }

    func loadTables(_ db: String) async {
        guard session != nil else { return }
        loadingDbs.insert(db)
        defer { loadingDbs.remove(db) }
        do {
            let t: [DbTable]
            if conn.engine.listsAcrossDatabases {
                t = try await session!.tablesIn(database: db)
            } else {
                if activeDatabase != db { try await useDatabase(db) }
                t = try await session!.tables()
            }
            withAnimation(.djie) { dbTables[db] = t }
        } catch {
            withAnimation(.djie) { self.error = error.localizedDescription }
        }
    }

    func refresh() async {
        guard let session else { return }
        let dbs = (try? await session.databases()) ?? databases
        withAnimation(.djieSnappy) { databases = conn.engine == .sqlite ? ["main"] : dbs }
        for db in expanded { await loadTables(db) }
        if let t = selectedTable, tab == .browse { await loadPage(t) }
    }

    /// Jadikan database aktif (USE / SELECT n / sambung ulang untuk PostgreSQL).
    private func useDatabase(_ db: String) async throws {
        guard let session else { return }
        if try await session.useDatabase(name: db) {
            activeDatabase = db
            return
        }
        // PostgreSQL: satu koneksi = satu database → sambung ulang
        var c = conn
        c.database = db
        let s = try await DbSession.connect(conn: c, ssh: ssh)
        self.session = s
        conn = c
        activeDatabase = db
    }

    /// Klik nama database: tampilkan ringkasan tabelnya.
    func selectDatabase(_ db: String) async {
        withAnimation(.djie) {
            selectedDb = db
            selectedTable = nil
            tab = .overview
            error = nil
        }
        if activeDatabase != db, conn.engine != .sqlite {
            do { try await useDatabase(db) } catch { withAnimation(.djie) { self.error = error.localizedDescription } }
        }
        if !expanded.contains(db) || dbTables[db] == nil { await toggle(db, forceOpen: true) }
    }

    func openTable(_ t: DbTable, in db: String) async {
        if activeDatabase != db, conn.engine != .sqlite {
            do { try await useDatabase(db) } catch { withAnimation(.djie) { self.error = error.localizedDescription }; return }
        }
        withAnimation(.djie) {
            selectedDb = db
            selectedTable = t
            if tab == .overview || (!conn.engine.supportsStructure && tab == .structure) { tab = .browse }
            offset = 0
            page = nil
            structure = nil
            totalRows = t.rows
            totalIsEstimate = t.rows != nil
            error = nil
        }
        if let session { query = session.pageSql(schema: t.schema, table: t.name, limit: pageSize, offset: 0) }
        await loadTab()
        // Hitung baris persis jika tabel tidak terlalu besar
        if conn.engine.isSQL, (t.rows ?? 0) < 2_000_000, let session,
           let n = try? await session.countRows(schema: t.schema, table: t.name), selectedTable?.name == t.name {
            withAnimation(.djieSnappy) { totalRows = n; totalIsEstimate = false }
        }
    }

    func loadTab() async {
        guard let t = selectedTable else { return }
        switch tab {
        case .browse: if page == nil { await loadPage(t) }
        case .structure: if structure == nil { await loadStructure(t) }
        default: break
        }
    }

    func loadPage(_ t: DbTable) async {
        guard let session else { return }
        withAnimation(.djieSnappy) { running = true; error = nil }
        defer { withAnimation(.djieSnappy) { running = false } }
        do {
            let r = try await session.page(schema: t.schema, table: t.name, limit: pageSize, offset: offset)
            withAnimation(.djie) { page = r }
        } catch {
            withAnimation(.djie) { self.error = error.localizedDescription }
        }
    }

    func loadStructure(_ t: DbTable) async {
        guard let session else { return }
        withAnimation(.djieSnappy) { running = true; error = nil }
        defer { withAnimation(.djieSnappy) { running = false } }
        do {
            let r = try await session.columns(schema: t.schema, table: t.name)
            withAnimation(.djie) { structure = r }
        } catch {
            withAnimation(.djie) { self.error = error.localizedDescription }
        }
    }

    func goToPage(offset newOffset: UInt64) async {
        guard let t = selectedTable else { return }
        offset = newOffset
        await loadPage(t)
    }

    func setPageSize(_ n: UInt32) async {
        pageSize = n
        offset = 0
        if let t = selectedTable { await loadPage(t) }
    }

    func run(_ sql: String? = nil) async {
        let text = (sql ?? query).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let session, !text.isEmpty, !running else { return }
        withAnimation(.djieSnappy) { running = true; error = nil }
        defer { withAnimation(.djieSnappy) { running = false } }
        do {
            let r = try await session.run(sql: text)
            withAnimation(.djie) { result = r }
            if history.first != text { history.insert(text, at: 0); history = Array(history.prefix(30)) }
            // USE nama_db → ikuti di pohon
            if let m = text.firstMatch(of: /^\s*use\s+[`\[]?([^`\]\s;]+)/.ignoresCase()) {
                activeDatabase = String(m.1)
                selectedDb = String(m.1)
            }
            // Perubahan struktur → muat ulang pohon & data
            if text.range(of: #"^\s*(create|drop|alter|rename|truncate)"#, options: [.regularExpression, .caseInsensitive]) != nil {
                await refresh()
                structure = nil
            } else if text.range(of: #"^\s*(insert|update|delete|replace)"#, options: [.regularExpression, .caseInsensitive]) != nil {
                page = nil
            }
        } catch {
            withAnimation(.djie) { self.error = error.localizedDescription }
        }
    }

    /// Hasil yang sedang tampil di tab aktif.
    var shownResult: QueryResult? {
        switch tab {
        case .browse: page
        case .structure: structure
        case .sql: result
        case .overview: nil
        }
    }

    /// Simpan hasil yang tampil sebagai CSV.
    func exportCSV() {
        guard let r = shownResult, !r.columns.isEmpty else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = (selectedTable?.name ?? "hasil") + ".csv"
        panel.allowedContentTypes = [.commaSeparatedText]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        func esc(_ v: String?) -> String {
            guard let v else { return "" }
            return v.contains(where: { ",\"\n".contains($0) }) ? "\"" + v.replacingOccurrences(of: "\"", with: "\"\"") + "\"" : v
        }
        var lines = [r.columns.map { esc($0) }.joined(separator: ",")]
        lines += r.rows.map { $0.map(esc).joined(separator: ",") }
        try? (lines.joined(separator: "\n") + "\n").write(to: url, atomically: true, encoding: .utf8)
    }
}

extension DbTable {
    var sizeText: String? {
        guard let size = sizeBytes, size > 0 else { return nil }
        return ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file)
    }
    var rowsText: String? { rows.map { $0.formatted(.number) } }
}
