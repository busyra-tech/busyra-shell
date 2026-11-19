import AppKit
import SwiftUI

enum Links {
    static let website = URL(string: "https://masadjie.github.io/djie-shell/")!
    static let github = URL(string: "https://github.com/masadjie/djie-shell")!
    static let issues = URL(string: "https://github.com/masadjie/djie-shell/issues")!
    static let releases = URL(string: "https://github.com/masadjie/djie-shell/releases")!
    static let privacy = URL(string: "https://masadjie.github.io/djie-shell/privacy.html")!
    static let terms = URL(string: "https://masadjie.github.io/djie-shell/terms.html")!
    static let donateWhatsApp = "6281269494591"
    static let donateNumberDisplay = "0812-6949-4591"
}

// MARK: - Tentang

struct AboutView: View {
    @State private var appear = false

    private var version: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return "Versi \(v) (\(b))"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 14) {
                    DjieLogo(size: 96)
                        .scaleEffect(appear ? 1 : 0.7)
                        .rotationEffect(.degrees(appear ? 0 : -12))
                        .opacity(appear ? 1 : 0)
                    Text("Djie Shell").font(.system(size: 34, weight: .heavy, design: .rounded))
                        .staggerIn(1, base: 0.1)
                    TypewriterText("Semua servermu, satu terminal.", delay: 0.4)
                        .font(.system(size: 14, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .frame(height: 20)
                    HStack(spacing: 8) {
                        Badge(text: version.uppercased())
                        Badge(text: "CORE \(coreVersion())", color: Theme.accent2)
                        Badge(text: "MIT", color: Theme.accent3)
                    }
                    .staggerIn(2, base: 0.1)
                }
                .padding(.top, 24)

                Text("SSH client native untuk macOS — gratis, tanpa iklan, tanpa server. Host, SSH key, dan snippet dienkripsi di perangkatmu dan tersinkron lewat Google Drive milikmu sendiri.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: 520)
                    .staggerIn(3, base: 0.1)

                HStack(spacing: 10) {
                    LinkButton(title: "Website", icon: "globe", url: Links.website)
                    LinkButton(title: "GitHub", icon: "chevron.left.forwardslash.chevron.right", url: Links.github)
                    LinkButton(title: "Catatan rilis", icon: "sparkles", url: Links.releases)
                    LinkButton(title: "Laporkan bug", icon: "ladybug", url: Links.issues)
                }
                .staggerIn(4, base: 0.1)

                UpdateStatus()
                    .staggerIn(5, base: 0.1)

                VStack(alignment: .leading, spacing: 0) {
                    InfoRow(label: "Dibuat oleh", value: "Adjie Kurniawan")
                    InfoRow(label: "Antarmuka", value: "SwiftUI (native macOS)")
                    InfoRow(label: "Inti", value: "djie-core · Rust (vault, sync, keychain)")
                    InfoRow(label: "Enkripsi", value: "Argon2id + XChaCha20-Poly1305")
                    InfoRow(label: "Terminal", value: "SwiftTerm · OpenSSH")
                    InfoRow(label: "Sync", value: "Google Drive (appDataFolder), zero-knowledge", last: true)
                }
                .glassCard(padding: 4)
                .frame(maxWidth: 560)
                .staggerIn(5, base: 0.1)

                HStack(spacing: 16) {
                    Link("Kebijakan Privasi", destination: Links.privacy)
                    Link("Syarat Layanan", destination: Links.terms)
                }
                .font(.callout)
                .foregroundStyle(.secondary)

                Text("© 2026 Adjie Kurniawan · Lisensi MIT")
                    .font(.caption).foregroundStyle(.tertiary)
                    .padding(.bottom, 24)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 28)
        }
        .onAppear { withAnimation(.spring(response: 0.6, dampingFraction: 0.65)) { appear = true } }
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    var last = false
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(label).foregroundStyle(.secondary)
                Spacer()
                Text(value).multilineTextAlignment(.trailing)
            }
            .font(.system(size: 13))
            .padding(.horizontal, 14).padding(.vertical, 11)
            if !last { Divider().padding(.horizontal, 14) }
        }
    }
}

struct LinkButton: View {
    let title: String
    let icon: String
    let url: URL
    var body: some View {
        Button { NSWorkspace.shared.open(url) } label: { Label(title, systemImage: icon) }
            .buttonStyle(SecondaryButtonStyle())
    }
}

// MARK: - Donasi

struct DonateView: View {
    @Environment(AppModel.self) private var model
    @State private var tilt = false
    @State private var copied = false

    var body: some View {
        ScrollView {
            HStack(alignment: .center, spacing: 44) {
                VStack(spacing: 10) {
                    Image("QRIS")
                        .resizable()
                        .interpolation(.high)
                        .aspectRatio(874.0 / 1240.0, contentMode: .fit)
                        .frame(width: 270)
                        .padding(12)
                        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .shadow(color: Theme.accent.opacity(0.25), radius: 30, y: 12)
                        .rotation3DEffect(.degrees(tilt ? 2 : -2), axis: (x: 0, y: 1, z: 0))
                        .animation(.easeInOut(duration: 3).repeatForever(), value: tilt)
                    HStack {
                        Text("Ruang Kiitaa")
                        Spacer()
                        Text("NMID ID1026525837765")
                    }
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .frame(width: 294)
                }
                .staggerIn(0, base: 0.05)

                VStack(alignment: .leading, spacing: 16) {
                    Text("DONASI").font(.system(size: 11, weight: .semibold, design: .monospaced)).tracking(2)
                        .foregroundStyle(Theme.accent)
                    Text("Traktir kopi\npembuatnya.")
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                        .lineSpacing(-4)
                    (Text("Djie Shell dibuat oleh ") + Text("Adjie Kurniawan").bold()
                        + Text(" dan dibagikan gratis. Donasi membantu fitur berikutnya — termasuk versi Windows — lahir lebih cepat."))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: 10) {
                        Step(n: 1, text: "Buka aplikasi bank atau e-wallet berlogo QRIS: GoPay, OVO, DANA, ShopeePay, atau m-banking.")
                        Step(n: 2, text: "Scan kode QRIS dan isi nominal seikhlasnya.")
                        Step(n: 3, text: "Kirim bukti transfer ke nomor di bawah.")
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("KONFIRMASI DONASI").font(.system(size: 10, weight: .semibold, design: .monospaced)).tracking(1.5)
                            .foregroundStyle(.secondary)
                        Text(Links.donateNumberDisplay).font(.system(size: 30, weight: .heavy, design: .rounded))
                            .textSelection(.enabled)
                        HStack(spacing: 8) {
                            Button {
                                NSWorkspace.shared.open(URL(string: "https://wa.me/\(Links.donateWhatsApp)")!)
                            } label: { Label("Chat WhatsApp", systemImage: "message.fill") }
                                .buttonStyle(PrimaryButtonStyle())
                            Button {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(Links.donateNumberDisplay.replacingOccurrences(of: "-", with: ""), forType: .string)
                                withAnimation(.djieSnappy) { copied = true }
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { withAnimation(.djie) { copied = false } }
                            } label: {
                                Label(copied ? "Tersalin!" : "Salin nomor", systemImage: copied ? "checkmark" : "doc.on.doc")
                                    .contentTransition(.symbolEffect(.replace))
                            }
                            .buttonStyle(SecondaryButtonStyle())
                        }
                    }
                    .glassCard(padding: 16)
                }
                .frame(maxWidth: 440, alignment: .leading)
                .staggerIn(1, base: 0.1)
            }
            .padding(40)
            .frame(maxWidth: .infinity)
        }
        .onAppear { tilt = true }
    }
}

private struct Step: View {
    let n: Int
    let text: String
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(n).").font(.system(size: 12, design: .monospaced)).foregroundStyle(Theme.accent)
            Text(text).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Status versi di halaman Tentang + tombol cek pembaruan.
struct UpdateStatus: View {
    @Environment(AppModel.self) private var model
    @State private var checking = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: model.update == nil ? "checkmark.seal.fill" : "arrow.down.circle.fill")
                .foregroundStyle(model.update == nil ? Theme.accent : .orange)
                .contentTransition(.symbolEffect(.replace))
            Text(model.update.map { "Versi \($0.version) tersedia" } ?? "Kamu memakai versi terbaru (\(AppVersion.current))")
                .font(.callout)
            Button {
                Task {
                    checking = true
                    await model.checkForUpdates(manual: true)
                    checking = false
                }
            } label: {
                if checking { ProgressView().controlSize(.small) } else { Text("Periksa") }
            }
            .buttonStyle(SecondaryButtonStyle())
            if let u = model.update {
                Button("Download") { NSWorkspace.shared.open(u.download ?? u.page) }
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .glassCard(padding: 0)
    }
}
