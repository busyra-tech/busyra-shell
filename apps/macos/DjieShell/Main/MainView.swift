import SwiftUI

struct MainView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 200, ideal: 220, max: 280)
        } detail: {
            VStack(spacing: 0) {
                TabStrip()
                ZStack {
                    if model.activeSessionID == nil {
                        SectionContent(section: model.section)
                            .id(model.section)
                            .transition(.opacity)
                    }
                    // Semua sesi tetap hidup walau tidak sedang ditampilkan
                    ForEach(model.sessions) { s in
                        let active = s.id == model.activeSessionID
                        TerminalPane(session: s)
                            .opacity(active ? 1 : 0)
                            .allowsHitTesting(active)
                            .zIndex(active ? 1 : 0)
                    }
                }
                .animation(.djie, value: model.activeSessionID)
            }
            .background(Theme.bg)
            .ignoresSafeArea(.container, edges: .top)
            .toolbar(removing: .title)
            .toolbarBackground(.hidden, for: .windowToolbar)
            .inspector(isPresented: Binding(
                get: { model.editingHost != nil },
                set: { if !$0 { model.editingHost = nil } }
            )) {
                if let host = model.editingHost {
                    HostEditor(original: host)
                        .id(host.id.isEmpty ? "new-\(host.hostname)" : host.id)
                        .inspectorColumnWidth(min: 340, ideal: 380, max: 460)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .djieNewHost)) { _ in
            model.activeSessionID = nil
            model.section = .hosts
            model.editingHost = .blank()
        }
    }
}

struct SectionContent: View {
    let section: Section
    var body: some View {
        switch section {
        case .hosts: HostsView()
        case .keychain: KeychainView()
        case .snippets: ComingSoon(section: section, text: "Simpan perintah favorit dan jalankan ke satu atau banyak host sekaligus.")
        case .forwarding: ComingSoon(section: section, text: "Aturan port forwarding local, remote, dan dynamic (SOCKS).")
        case .sftp: ComingSoon(section: section, text: "Transfer file dua panel dengan drag & drop.")
        }
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                DjieLogo(size: 26)
                Text("Djie Shell").font(.system(size: 15, weight: .semibold, design: .rounded))
                Spacer()
                AppearanceMenu().foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .padding(.bottom, 12)

            List(selection: Binding(
                get: { model.activeSessionID == nil ? model.section : nil },
                set: { if let s = $0 { model.section = s; model.showHome() } }
            )) {
                ForEach(Section.allCases) { s in
                    Label(s.title, systemImage: s.icon)
                        .badge(badge(for: s))
                        .tag(s)
                }
            }
            .listStyle(.sidebar)

            AccountFooter()
        }
    }

    private func badge(for s: Section) -> Int {
        switch s {
        case .hosts: model.hosts.count
        case .keychain: model.keys.count
        default: 0
        }
    }
}

struct AccountFooter: View {
    @Environment(AppModel.self) private var model
    @State private var hover = false

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Theme.brandGradient)
                Image(systemName: model.accountEmail == nil ? "person.fill" : "checkmark.icloud.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.black.opacity(0.75))
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(model.accountEmail ?? "Tanpa akun")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                Text(model.accountEmail == nil ? "Lokal saja" : "Sync Google Drive")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Button {
                model.lock()
            } label: {
                Image(systemName: "lock.fill")
            }
            .buttonStyle(.borderless)
            .help("Kunci vault (⇧⌘L)")
        }
        .padding(12)
        .background(Theme.ink.opacity(hover ? 0.06 : 0.03), in: RoundedRectangle(cornerRadius: 10))
        .padding(10)
        .onHover { h in withAnimation(.djieSnappy) { hover = h } }
    }
}

/// Tombol kecil untuk ganti Sistem / Terang / Gelap.
struct AppearanceMenu: View {
    @AppStorage(AppearanceMode.storageKey) private var appearance: AppearanceMode = .dark

    var body: some View {
        Menu {
            Picker("Tampilan", selection: $appearance) {
                ForEach(AppearanceMode.allCases) { m in Label(m.title, systemImage: m.icon).tag(m) }
            }
            .pickerStyle(.inline)
        } label: {
            Image(systemName: appearance.icon)
                .contentTransition(.symbolEffect(.replace))
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .help("Tampilan: \(appearance.title)")
    }
}

// MARK: - Tab bar

struct TabStrip: View {
    @Environment(AppModel.self) private var model
    @Namespace private var ns

    var body: some View {
        HStack(spacing: 6) {
            TabChip(isActive: model.activeSessionID == nil, ns: ns, onSelect: { model.showHome() }) {
                Image(systemName: "square.grid.2x2.fill")
                    .font(.system(size: 12))
                    .frame(width: 18)
            }
            .help("Daftar host (⌘0)")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Array(model.sessions.enumerated()), id: \.element.id) { i, s in
                        SessionTab(session: s, index: i, ns: ns)
                            .transition(.asymmetric(
                                insertion: .scale(scale: 0.6, anchor: .leading).combined(with: .opacity),
                                removal: .scale(scale: 0.8).combined(with: .opacity)))
                    }
                }
                .padding(.vertical, 1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.top, 6)
        .frame(height: 52)
        .background(.bar)
        .overlay(alignment: .bottom) { Divider() }
        .gesture(WindowDragGesture())
    }
}

struct TabChip<Label: View>: View {
    let isActive: Bool
    let ns: Namespace.ID
    var onSelect: () -> Void
    @ViewBuilder var label: () -> Label
    @State private var hover = false

    var body: some View {
        label()
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background {
                if isActive {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Theme.ink.opacity(0.1))
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.ink.opacity(0.08)))
                        .matchedGeometryEffect(id: "activeTab", in: ns)
                } else if hover {
                    RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Theme.ink.opacity(0.05))
                }
            }
            .foregroundStyle(isActive ? .primary : .secondary)
            .contentShape(Rectangle())
            .onTapGesture { withAnimation(.djieSnappy) { onSelect() } }
            .onHover { h in withAnimation(.easeOut(duration: 0.12)) { hover = h } }
    }
}

struct SessionTab: View {
    @Environment(AppModel.self) private var model
    let session: TerminalSession
    let index: Int
    let ns: Namespace.ID
    @State private var hover = false

    var body: some View {
        TabChip(isActive: model.activeSessionID == session.id, ns: ns,
                onSelect: { model.activeSessionID = session.id }) {
            HStack(spacing: 7) {
                StatusDot(status: session.status, color: Color(hex: session.host.color))
                Text(session.title)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .frame(maxWidth: 150, alignment: .leading)
                Button {
                    model.close(session)
                } label: {
                    Image(systemName: "xmark").font(.system(size: 9, weight: .bold))
                        .frame(width: 16, height: 16)
                        .background(Theme.ink.opacity(hover ? 0.1 : 0), in: Circle())
                }
                .buttonStyle(.plain)
                .opacity(hover || model.activeSessionID == session.id ? 1 : 0)
            }
        }
        .onHover { hover = $0 }
        .help(index < 9 ? "\(session.host.address)  ·  ⌘\(index + 1)" : session.host.address)
    }
}

/// Titik status: berdenyut saat menghubungkan, solid saat tersambung, abu-abu saat terputus.
struct StatusDot: View {
    let status: TerminalSession.Status
    let color: Color
    @State private var pulse = false

    var body: some View {
        ZStack {
            if status == .connecting {
                Circle().stroke(color, lineWidth: 1.5)
                    .scaleEffect(pulse ? 2.2 : 1)
                    .opacity(pulse ? 0 : 0.8)
            }
            Circle().fill(fill)
        }
        .frame(width: 7, height: 7)
        .onAppear {
            withAnimation(.easeOut(duration: 1.1).repeatForever(autoreverses: false)) { pulse = true }
        }
    }

    private var fill: Color {
        switch status {
        case .connecting: color.opacity(0.6)
        case .connected: Color(hex: "#4ADE80")
        case .disconnected: .gray
        }
    }
}

// MARK: - Placeholder

struct ComingSoon: View {
    let section: Section
    let text: String
    @State private var float = false

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: section.icon)
                .font(.system(size: 42, weight: .light))
                .foregroundStyle(Theme.brandGradient)
                .offset(y: float ? -6 : 6)
                .animation(.easeInOut(duration: 2).repeatForever(), value: float)
            Text(section.title).font(.title2.bold())
            Text(text).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 340)
            Text("Segera hadir")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Theme.accent.opacity(0.15), in: Capsule())
                .foregroundStyle(Theme.accent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { float = true }
    }
}
