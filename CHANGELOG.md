# Changelog

Semua perubahan penting di Djie Shell. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

Download versi terbaru: [Releases](https://github.com/masadjie/djie-shell/releases/latest) · Website: [masadjie.github.io/djie-shell](https://masadjie.github.io/djie-shell/)

---

## [0.4.0] — 2026-11-20

Tiga fitur besar: server lokal ala MAMP, berbagi host ke tim, dan edit file langsung di server. 🎬 [Video pengenalan](https://masadjie.github.io/djie-shell/#video)

### Baru
- **🧱 Server Lokal** — jalankan web server & database di komputer sendiri, seperti MAMP / XAMPP
  - **Apache atau Nginx + PHP 8.4** dengan port & folder proyek yang bisa diatur, tombol *Buka di browser*
  - **MySQL 8.4, PostgreSQL 17, MongoDB 8** — Start/Stop per database, tombol *Buka di Database*
  - Komponen diunduh otomatis saat pertama dipakai, lengkap dengan progress & tombol batal; Apache bawaan macOS dipakai langsung
  - Hanya mendengarkan di `127.0.0.1`; semua layanan berhenti saat app ditutup, proses sisa dibersihkan saat app dibuka lagi
  - Windows: tombol pasang Microsoft Visual C++ Runtime bila belum ada
- **👥 Tim** — admin membagikan host ke rekan kerja lewat email
  - Buat tim, pilih host yang dibagikan, undang email langsung dari app (Google mengirim email undangan)
  - Rekan bergabung lewat **Tim → Gabung tim** dan halaman [Gabung tim](https://masadjie.github.io/djie-shell/team.html); host tim muncul di daftar Hosts (read-only) lengkap dengan password & SSH key
  - Terenkripsi end-to-end di Google Drive admin: kunci tim dibungkus per anggota (X25519), isi tim ditandatangani admin (Ed25519)
  - Perubahan host oleh admin otomatis terkirim; anggota dikeluarkan → izin Drive dicabut dan kunci tim diganti
- **📝 SFTP: edit & buka dengan app lain**
  - **Editor bawaan**: klik dua kali file teks di server — nomor baris, cari, simpan ⌘S / Ctrl+S, peringatan bila file diubah orang lain, line ending CRLF/LF dijaga
  - **Buka dengan** VS Code, Sublime, Notepad++, Preview, atau app lain — setiap kali disimpan, file otomatis di-upload ke server

### Diubah
- Login Google kini juga meminta izin `drive.file` (hanya file yang dibuat/dipilih lewat Djie Shell) untuk fitur Tim — pengguna lama cukup klik **Izinkan akses Google Drive** di halaman Tim
- Kebijakan privasi diperbarui untuk izin baru tersebut
- Website: bagian Server Lokal, Tim, editor SFTP, dan pilihan video *Baru di v0.4* / *Tur lengkap*

### Diperbaiki
- Windows: editor SFTP sempat hanya menampilkan baris pertama file

## [0.3.0] — 2026-11-20

### Baru
- **📊 Info server** — klik *Info server* di tab SSH yang aktif (⇧⌘I / Ctrl+Shift+I)
  - Spesifikasi: OS & versi, kernel, CPU (model, arsitektur, jumlah core), uptime, load
  - **Grafik live** CPU, RAM, dan kecepatan jaringan, diperbarui tiap 3 detik
  - Pemakaian RAM, swap, dan tiap partisi storage
  - Server Linux (Ubuntu, Debian, CentOS, Alpine, …) & macOS, lewat SSH — ikut key & proxy host, tanpa install apa pun di server
- Video promo dengan narasi dan caption, plus versi 9:16 untuk Reels / TikTok / Shorts

### Diubah
- Build Windows dikunci ke .NET 9 SDK agar stabil di CI

## [0.2.0] — 2026-11-20

### Baru
- **🪟 Versi Windows** (WinUI 3) dengan semua fitur versi Mac; installer `Setup.exe` per user tanpa hak admin (x64 & ARM64)
- **🌐 Proxy SOCKS5 / HTTP** per host, lengkap dengan login — dipakai terminal, SFTP, port forwarding, dan tunnel database
- **🗄️ Database ala phpMyAdmin**: pohon database & tabel, ringkasan tabel, paging, struktur, tab **Cari** per kolom (`=`, `LIKE %…%`, `IN`, `BETWEEN`, `IS NULL`, …), cari cepat di semua kolom, daftar tabel bisa ditampilkan/disembunyikan
- **⌨️ Terminal lokal**: zsh di Mac, PowerShell / CMD / WSL di Windows (⇧⌘T / Ctrl+Shift+T)
- **Autocomplete** perintah di terminal dari riwayat host, snippet, dan perintah umum
- SSH agent di Windows: OpenSSH agent & Pageant
- Website: download langsung DMG / EXE, bagian database, proxy, dan terminal lokal

### Diperbaiki
- Windows: tampilan buram di layar skala tinggi
- Pesan error yang lebih jelas di macOS

## [0.1.0] — 2026-11-20

Rilis pertama (macOS).

### Baru
- Vault terenkripsi (Argon2id + XChaCha20-Poly1305) dengan master password dan **Touch ID**
- **Hosts** dalam grid atau list, grup, tag, warna kartu, connect banyak host sekaligus
- Terminal SSH (password, SSH key, agent), jump host, agent forwarding, startup snippet, env var, 7 tema terminal
- **SFTP** dua panel dengan drag & drop, progress, chmod
- **Keychain** SSH key (buat Ed25519 / impor), **Port forwarding** local/remote/SOCKS, **Snippets**, **Known Hosts**, **Logs**
- Klien database (MySQL, PostgreSQL, SQL Server, SQLite, Redis, MongoDB, ClickHouse, …)
- **Sync Google Drive** (folder tersembunyi `drive.appdata`), halaman Akun, mode gelap & terang
- Website dengan kebijakan privasi & ketentuan

[0.4.0]: https://github.com/masadjie/djie-shell/releases/tag/v0.4.0
[0.3.0]: https://github.com/masadjie/djie-shell/releases/tag/v0.3.0
[0.2.0]: https://github.com/masadjie/djie-shell/releases/tag/v0.2.0
[0.1.0]: https://github.com/masadjie/djie-shell/tree/v0.1.0
