import Foundation

extension Error {
    /// Pesan error yang enak dibaca (bukan nama enum dari binding UniFFI).
    var djieMessage: String {
        guard let e = self as? CoreError else { return localizedDescription }
        switch e {
        case .WrongPassword: return "Master password salah"
        case .AlreadyExists: return "Data sudah ada"
        case .NotFound: return "Data tidak ditemukan"
        case .WeakPassword: return "Password minimal 8 karakter"
        case .KeyMismatch: return "Vault di Google Drive memakai master password lain"
        case .InvalidKey(let msg): return "SSH key tidak valid: \(msg)"
        case .Corrupt(let msg): return "File vault rusak: \(msg)"
        case .Ssh(let msg): return "Koneksi SSH gagal: \(msg)"
        case .Proxy(let msg): return "Proxy: \(msg)"
        case .AuthFailed: return "Login ditolak server — periksa username, password, atau key"
        case .HostKeyChanged: return "Kunci server berubah! Hapus host ini di Known Hosts jika memang server berganti."
        case .Db(let msg): return "Database: \(msg)"
        case .Cancelled: return "Dibatalkan"
        case .Io(let msg): return "Gagal membaca/menulis file: \(msg)"
        case .GoogleAuth: return "Sesi Google berakhir. Masuk lagi dengan Google untuk melanjutkan."
        case .GoogleScope: return "Djie Shell belum diberi izin mengelola file Tim di Google Drive. Masuk ulang dengan Google dan izinkan akses Drive."
        case .Team(let msg): return "Tim: \(msg)"
        case .Docker(let msg): return msg.prefix(1).uppercased() + msg.dropFirst()
        case .Stack(let msg): return msg.prefix(1).uppercased() + msg.dropFirst()
        case .Server(let msg): return msg.prefix(1).uppercased() + msg.dropFirst()
        }
    }
}
