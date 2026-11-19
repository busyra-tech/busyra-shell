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

/// Satu koneksi database yang sedang terbuka.
@MainActor
@Observable
final class DbWorkspace: Identifiable {
    enum Status: Equatable { case connecting, ready, failed(String) }

    let id = UUID()
    var conn: DbConnection
    var status: Status = .connecting
    var databases: [String] = []
    var tables: [DbTable] = []
    var query = ""
    var result: QueryResult?
    var running = false
    var error: String?
    var history: [String] = []
    var selectedTable: String?

    @ObservationIgnored private var session: DbSession?

    init(conn: DbConnection) {
        self.conn = conn
        query = ""
    }

    func connect(ssh: SshTarget?) async {
        withAnimation(.djie) { status = .connecting }
        do {
            let s = try await DbSession.connect(conn: conn, ssh: ssh)
            session = s
            async let dbs = (try? await s.databases()) ?? []
            async let tbls = (try? await s.tables()) ?? []
            let (d, t) = await (dbs, tbls)
            withAnimation(.djie) {
                databases = d
                tables = t
                status = .ready
            }
        } catch {
            withAnimation(.djie) { status = .failed(error.localizedDescription) }
        }
    }

    /// Ganti database aktif (sambung ulang dengan nama database lain).
    func switchDatabase(_ name: String, ssh: SshTarget?) async {
        conn.database = name
        result = nil
        await connect(ssh: ssh)
    }

    func refreshTables() async {
        guard let session else { return }
        let t = (try? await session.tables()) ?? []
        withAnimation(.djieSnappy) { tables = t }
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
            // Perubahan struktur (CREATE/DROP/ALTER) → muat ulang daftar tabel
            if text.range(of: #"^\s*(create|drop|alter|rename)"#, options: [.regularExpression, .caseInsensitive]) != nil {
                await refreshTables()
            }
        } catch {
            withAnimation(.djie) { self.error = error.localizedDescription }
        }
    }

    func openTable(_ t: DbTable) async {
        guard let session else { return }
        selectedTable = t.name
        query = session.previewSql(schema: t.schema, table: t.name, limit: 200)
        withAnimation(.djieSnappy) { running = true; error = nil }
        defer { withAnimation(.djieSnappy) { running = false } }
        do {
            let r = try await session.preview(schema: t.schema, table: t.name)
            withAnimation(.djie) { result = r }
        } catch {
            withAnimation(.djie) { self.error = error.localizedDescription }
        }
    }

    /// Simpan hasil sebagai CSV.
    func exportCSV() {
        guard let r = result, !r.columns.isEmpty else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = (selectedTable ?? "hasil") + ".csv"
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
