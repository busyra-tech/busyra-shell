import SwiftTerm
import SwiftUI

struct TerminalPane: View {
    @Environment(AppModel.self) private var model
    let session: TerminalSession

    var body: some View {
        let theme = TerminalThemes.def(session.host.terminalTheme)
        ZStack {
            Color(hex: theme.bg)
            TerminalRepresentable(session: session)
                .padding(.leading, 10).padding(.top, 6)
                .opacity(session.status == .connecting ? 0.25 : 1)
                .blur(radius: session.status == .connecting ? 2 : 0)

            if session.status == .connecting {
                ConnectingOverlay(host: session.host)
                    .transition(.opacity.combined(with: .scale(scale: 1.05)))
            }
        }
        .overlay(alignment: .bottom) {
            if case .disconnected(let code) = session.status {
                HStack(spacing: 12) {
                    Image(systemName: "bolt.horizontal.circle").foregroundStyle(.orange)
                    Text(code == 0 ? "Sesi selesai" : "Koneksi terputus\(code.map { " (kode \($0))" } ?? "")")
                        .font(.callout.weight(.medium))
                    Button("Reconnect") { session.reconnect() }.buttonStyle(PrimaryButtonStyle())
                    Button("Tutup") { model.close(session) }.buttonStyle(SecondaryButtonStyle())
                }
                .padding(10)
                .background(.ultraThickMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.ink.opacity(0.1)))
                .shadow(radius: 20)
                .padding(.bottom, 20)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.djie, value: session.status)
    }
}

/// Animasi saat menghubungkan: cincin memancar + paket data berjalan.
struct ConnectingOverlay: View {
    let host: Host
    @AppStorage(PrivacyKeys.hideAddresses) private var hideAddresses = true
    @State private var t = false

    var body: some View {
        VStack(spacing: 22) {
            ZStack {
                ForEach(0..<3) { i in
                    Circle()
                        .stroke(Color(hex: host.color).opacity(0.5), lineWidth: 1.5)
                        .frame(width: 64, height: 64)
                        .scaleEffect(t ? 2.4 : 1)
                        .opacity(t ? 0 : 0.9)
                        .animation(.easeOut(duration: 1.8).repeatForever(autoreverses: false).delay(Double(i) * 0.6), value: t)
                }
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(hex: host.color).gradient)
                    .frame(width: 64, height: 64)
                    .shadow(color: Color(hex: host.color).opacity(0.6), radius: 20)
                Image(systemName: "server.rack")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(.black.opacity(0.7))
                    .symbolEffect(.pulse, options: .repeating)
            }
            .frame(height: 160)

            VStack(spacing: 6) {
                Text("Menghubungkan ke \(host.title)").font(.system(size: 16, weight: .semibold))
                Text(host.displayAddress(hidden: hideAddresses)).font(.system(size: 12, design: .monospaced)).foregroundStyle(.secondary)
            }

            HStack(spacing: 6) {
                ForEach(0..<5) { i in
                    Capsule()
                        .fill(Color(hex: host.color))
                        .frame(width: 18, height: 4)
                        .opacity(t ? 1 : 0.15)
                        .animation(.easeInOut(duration: 0.6).repeatForever().delay(Double(i) * 0.12), value: t)
                }
            }
        }
        .onAppear { t = true }
    }
}

struct TerminalRepresentable: NSViewRepresentable {
    let session: TerminalSession

    func makeNSView(context: Context) -> NSView {
        let container = NSView()
        let tv = session.view
        tv.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(tv)
        NSLayoutConstraint.activate([
            tv.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            tv.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            tv.topAnchor.constraint(equalTo: container.topAnchor),
            tv.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        DispatchQueue.main.async { tv.window?.makeFirstResponder(tv) }
        return container
    }

    func updateNSView(_ nsView: NSView, context: Context) {}
}
