# Djie Shell

SSH client native untuk macOS (SwiftUI) dan Windows (WinUI 3, menyusul), dengan inti bersama di Rust.

Konsep lengkap: [CONCEPT.md](CONCEPT.md)

## Struktur

```
core/              djie-core (Rust): vault terenkripsi, host, keychain SSH — diekspor via UniFFI
apps/macos/        App macOS (SwiftUI + SwiftTerm), project dibuat dengan XcodeGen
scripts/           build-core-apple.sh → xcframework + binding Swift
site/              Website (GitHub Pages)
.github/workflows/ release.yml, pages.yml
```

## Development (macOS)

Kebutuhan: Xcode, Rust (`rustup`), XcodeGen (`brew install xcodegen`).

```bash
./scripts/build-core-apple.sh
```

```bash
cd apps/macos && xcodegen generate && open DjieShell.xcodeproj
```

Jalankan ulang `build-core-apple.sh` setiap kali kode di `core/` berubah.

Mode demo (build Debug): tambahkan argumen `-DjieDemo` di scheme untuk membuka app dengan vault contoh.

### Test core

```bash
cd core && cargo test
```

Tes integrasi SFTP (menjalankan `sshd` bawaan macOS sementara di 127.0.0.1:2222, tanpa root):

```bash
./scripts/test-sftp.sh
```

Logo, ikon app, favicon, dan gambar share dibuat dari `scripts/render-brand.swift`.

## Login Google

Isi `Config.googleClientID` di `apps/macos/DjieShell/App/Config.swift` dengan OAuth Client ID (tipe iOS) dari Google Cloud Console, dengan Drive API aktif.

## Rilis

```bash
git tag v0.1.0
git push --tags
```

GitHub Actions membuat draft release berisi `Djie-Shell-<versi>-macOS.dmg`.
