import AppKit
import Foundation

/// Versi app & pengecekan rilis baru di GitHub Releases.
enum AppVersion {
    static var current: String { Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0" }
    static var build: String { Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0" }

    /// Bandingkan versi semantik ("0.1.10" > "0.1.9"). Awalan "v" diabaikan.
    static func isNewer(_ remote: String, than local: String) -> Bool {
        func parts(_ v: String) -> [Int] {
            v.trimmingCharacters(in: CharacterSet(charactersIn: "vV")).split(separator: ".").map { Int($0.prefix { $0.isNumber }) ?? 0 }
        }
        let a = parts(remote), b = parts(local)
        for i in 0..<max(a.count, b.count) {
            let x = i < a.count ? a[i] : 0, y = i < b.count ? b[i] : 0
            if x != y { return x > y }
        }
        return false
    }
}

struct AvailableUpdate: Equatable {
    let version: String
    let notes: String
    let page: URL
    let download: URL?
}

enum UpdateChecker {
    private static let api = URL(string: "https://api.github.com/repos/masadjie/djie-shell/releases/latest")!

    static func check() async throws -> AvailableUpdate? {
        var req = URLRequest(url: api)
        req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: req)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil } // belum ada rilis
        struct Release: Decodable {
            struct Asset: Decodable { let name: String; let browser_download_url: URL }
            let tag_name: String; let html_url: URL; let body: String?; let assets: [Asset]
        }
        let r = try JSONDecoder().decode(Release.self, from: data)
        guard AppVersion.isNewer(r.tag_name, than: AppVersion.current) else { return nil }
        let dmg = r.assets.first { $0.name.hasSuffix(".dmg") }?.browser_download_url
        return AvailableUpdate(version: r.tag_name.trimmingCharacters(in: CharacterSet(charactersIn: "vV")),
                               notes: r.body ?? "", page: r.html_url, download: dmg)
    }
}
