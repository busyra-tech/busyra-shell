import Foundation

/// Bahasa app: Indonesia (teks asli di kode) atau Inggris (kamus `en.json` dari folder i18n repo).
/// Pilihan disimpan di Mac ini; berlaku setelah app dibuka ulang.
enum AppLanguage: String, CaseIterable, Identifiable {
    case system, id, en
    var id: String { rawValue }

    static let storageKey = "app.language"

    /// Judul pilihan — sengaja dwibahasa agar bisa dikenali di bahasa mana pun.
    var title: String {
        switch self {
        case .system: L("Ikuti sistem")
        case .id: "Bahasa Indonesia"
        case .en: "English"
        }
    }

    static var choice: AppLanguage {
        get { AppLanguage(rawValue: UserDefaults.standard.string(forKey: storageKey) ?? "") ?? .system }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: storageKey) }
    }

    /// Bahasa yang dipakai sekarang ("id" atau "en"), ditetapkan sekali saat app dibuka.
    static let resolved: String = {
        if let forced = ProcessInfo.processInfo.environment["DJIE_LANG"], ["id", "en"].contains(forced) { return forced }
        switch choice {
        case .id: return "id"
        case .en: return "en"
        case .system: return Locale.preferredLanguages.first.map { $0.hasPrefix("id") || $0.hasPrefix("in") } == true ? "id" : "en"
        }
    }()
}

final class L10n: @unchecked Sendable {
    static let shared = L10n()

    let english: Bool
    private let table: [String: String]
    /// Entri berpola ({} = teks apa saja) untuk pesan dari core.
    private let patterns: [(NSRegularExpression, String)]

    private init() {
        english = AppLanguage.resolved == "en"
        guard english, let url = Bundle.main.url(forResource: "en", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let t = try? JSONDecoder().decode([String: String].self, from: data) else {
            table = [:]; patterns = []; return
        }
        table = t
        patterns = t.compactMap { k, v in
            guard k.contains("{}") else { return nil }
            let parts = k.components(separatedBy: "{}").map(NSRegularExpression.escapedPattern(for:))
            guard let re = try? NSRegularExpression(pattern: "^" + parts.joined(separator: "(.+?)") + "$", options: [.dotMatchesLineSeparators]) else { return nil }
            return (re, v)
        }
        // Pola yang lebih panjang (lebih spesifik) dicoba dulu
        .sorted { $0.0.pattern.count > $1.0.pattern.count }
    }

    func text(_ s: String) -> String { english ? (table[s] ?? s) : s }

    /// Terjemahkan pesan utuh (mis. error dari core) memakai entri persis atau berpola.
    func message(_ s: String) -> String {
        guard english else { return s }
        if let t = table[s] { return t }
        let range = NSRange(s.startIndex..., in: s)
        for (re, out) in patterns {
            guard let m = re.firstMatch(in: s, range: range) else { continue }
            var result = out
            for i in 1..<m.numberOfRanges {
                guard let r = Range(m.range(at: i), in: s), let slot = result.range(of: "{}") else { break }
                // Bagian yang disisipkan bisa berupa pesan lain (mis. alasan error) → terjemahkan juga
                result.replaceSubrange(slot, with: message(String(s[r])))
            }
            return result
        }
        return s
    }
}

/// Teks UI dalam bahasa aktif. `{}` diisi `args` berurutan: `L("Backup {} selesai", name)`.
func L(_ s: String, _ args: Any...) -> String {
    var out = L10n.shared.text(s)
    for a in args {
        guard let r = out.range(of: "{}") else { break }
        out.replaceSubrange(r, with: String(describing: a))
    }
    return out
}

/// Pesan yang berasal dari core / server (dicocokkan juga dengan pola di kamus).
func Lmsg(_ s: String) -> String { L10n.shared.message(s) }
