import Foundation

enum Config {
    /// OAuth Client ID Google (tipe "iOS" di Google Cloud Console, dipakai juga untuk macOS).
    /// Kosong = tombol "Masuk dengan Google" menampilkan panduan setup.
    static let googleClientID = ""

    static var appSupport: URL {
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Djie Shell", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static var vaultPath: String { appSupport.appendingPathComponent("vault.djie").path }
}
