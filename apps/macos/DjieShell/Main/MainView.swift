import SwiftUI

struct MainView: View {
    @Environment(AppModel.self) private var model
    @State private var columns: NavigationSplitViewVisibility = .all

    var body: some View {
        @Bindable var model = model
        NavigationSplitView(columnVisibility: $columns) {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 210, ideal: 230, max: 290)
        } detail: {
            VStack(spacing: 0) {
                TabStrip(columns: $columns)
                HStack(spacing: 0) {
                ZStack {
                    if model.activeSessionID == nil {
                        SectionContent(section: model.section)
                            .id(model.section)
                            .transition(.opacity)
                    }
                    // Semua sesi tetap hidup walau tidak sedang ditampilkan
                    ForEach(model.sessions) { s in
                        let active = s.id == model.activeSessionID
                        TerminalPane(session: s, active: active)
                            .opacity(active ? 1 : 0)
                            .allowsHitTesting(active)
                            .zIndex(active ? 1 : 0)
                    }
                }
                .animation(.djie, value: model.activeSessionID)
                    if let stats = model.serverStats, model.activeSessionID != nil {
                        Divider()
                        ServerInfoPanel(stats: stats)
                            .frame(width: 330)
                            .id(stats.host.id)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                    }
                }
                .animation(.djie, value: model.serverStats?.host.id)
            }
            .background(Theme.bg)
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
        case .team: TeamView()
        case .keychain: KeychainView()
        case .forwarding: ForwardingView()
        case .sftp: SftpView()
        case .database: DatabaseView()
        case .snippets: SnippetsView()
        case .knownHosts: KnownHostsView()
        case .logs: LogsView()
        case .donate: DonateView()
        case .about: AboutView()
        case .account: AccountView()
        }
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var ns

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 11) {
                DjieLogo(size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Djie Shell").font(.system(size: 15, weight: .bold, design: .rounded)).lineLimit(1)
                    HStack(spacing: 5) {
                        Text("SSH Client").font(.system(size: 10.5)).foregroundStyle(.secondary)
                        Text(AppVersion.current)
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(Theme.accent.opacity(0.14), in: Capsule())
                            .foregroundStyle(Theme.accent)
                    }
                }
                .fixedSize()
                Spacer(minLength: 0)
                AppearanceMenu().foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 18)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 3) {
                    SidebarHeader(text: "Workspace")
                    ForEach(Section.main) { s in row(s) }
                    SidebarHeader(text: "Komunitas").padding(.top, 14)
                    ForEach(Section.community) { s in row(s) }
                }
                .padding(.horizontal, 10)
            }

            if let u = model.update, !model.updateDismissed {
                UpdateCard(update: u)
                    .padding(.horizontal, 10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            AccountFooter()
        }
        .animation(.djieSnappy, value: model.section)
        .animation(.djieSnappy, value: model.activeSessionID == nil)
    }

    private func row(_ s: Section) -> some View {
        SidebarRow(section: s, selected: model.activeSessionID == nil && model.section == s,
                   badge: badge(for: s), ns: ns) {
            model.section = s
            model.showHome()
        }
    }

    private func badge(for s: Section) -> Int {
        switch s {
        case .hosts: model.hosts.count
        case .team: model.teams.count
        case .keychain: model.keys.count
        case .snippets: model.snippets.count
        case .forwarding: model.forwards.count
        case .database: model.databases.count
        default: 0
        }
    }
}

struct SidebarHeader: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .tracking(1.2)
            .foregroundStyle(.tertiary)
            .padding(.horizontal, 10)
            .padding(.bottom, 4)
    }
}

/// Baris menu sidebar: ikon dalam kotak berwarna, sorotan aktif yang meluncur, hover lembut.
struct SidebarRow: View {
    let section: Section
    let selected: Bool
    let badge: Int
    let ns: Namespace.ID
    var action: () -> Void
    @State private var hover = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(section.tint.gradient)
                        .opacity(selected ? 1 : 0.9)
                    Image(systemName: section.icon)
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 24, height: 24)
                .shadow(color: section.tint.opacity(selected ? 0.55 : 0), radius: 6, y: 2)
                .scaleEffect(hover && !selected ? 1.06 : 1)

                Text(section.title)
                    .font(.system(size: 13, weight: selected ? .semibold : .medium))
                    .foregroundStyle(selected ? .primary : .secondary)
                Spacer(minLength: 0)
                if badge > 0 {
                    Text("\(badge)")
                        .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Theme.ink.opacity(selected ? 0.14 : 0.07), in: Capsule())
                        .foregroundStyle(.secondary)
                        .contentTransition(.numericText())
                }
            }
            .padding(.horizontal, 8)
            .frame(height: 36)
            .background {
                if selected {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Theme.ink.opacity(0.09))
                        .overlay(alignment: .leading) {
                            Capsule().fill(section.tint).frame(width: 3, height: 16).offset(x: -2)
                        }
                        .matchedGeometryEffect(id: "sidebarSel", in: ns)
                } else if hover {
                    RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.ink.opacity(0.045))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { h in withAnimation(.djieHover) { hover = h } }
    }
}

extension Section {
    /// Warna ikon tiap menu.
    var tint: Color {
        switch self {
        case .hosts: Color(hex: "#3B82F6")
        case .team: Color(hex: "#22C55E")
        case .keychain: Color(hex: "#F59E0B")
        case .forwarding: Color(hex: "#10B981")
        case .sftp: Color(hex: "#06B6D4")
        case .database: Color(hex: "#F97316")
        case .snippets: Color(hex: "#8B5CF6")
        case .knownHosts: Color(hex: "#EC4899")
        case .logs: Color(hex: "#64748B")
        case .donate: Color(hex: "#EF4444")
        case .about: Color(hex: "#6366F1")
        case .account: Color(hex: "#14B8A6")
        }
    }
}

struct AccountFooter: View {
    @Environment(AppModel.self) private var model
    @State private var hover = false
    @State private var connecting = false

    private var statusText: String {
        switch model.sync {
        case .off: "Lokal saja"
        case .idle: "Siap sync"
        case .syncing: "Menyinkronkan…"
        case .synced(let d): Date().timeIntervalSince(d) < 60 ? "Tersinkron" : "Sinkron \(d.formatted(.relative(presentation: .named, unitsStyle: .abbreviated)))"
        case .failed: "Sync gagal — klik untuk ulang"
        case .needsLogin: "Masuk ulang Google"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Avatar(name: model.profileName, email: model.accountEmail, picture: model.profilePicture, size: 30)
                .overlay(alignment: .bottomTrailing) {
                    if model.accountEmail != nil {
                        SyncIcon(state: model.sync)
                            .font(.system(size: 7))
                            .frame(width: 14, height: 14)
                            .background(Theme.brandGradient, in: Circle())
                            .overlay(Circle().strokeBorder(Theme.panel, lineWidth: 1.5))
                            .offset(x: 3, y: 3)
                    }
                }
            VStack(alignment: .leading, spacing: 1) {
                Text(model.profileName ?? model.accountEmail ?? "Tanpa akun")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                TimelineView(.periodic(from: .now, by: 30)) { _ in
                    Text(statusText)
                        .font(.system(size: 11))
                        .minimumScaleFactor(0.85)
                        .foregroundStyle(isFailed ? AnyShapeStyle(.orange) : AnyShapeStyle(.secondary))
                        .lineLimit(1)
                        .contentTransition(.opacity)
                }
            }
            Spacer(minLength: 0)
            Menu {
                if model.accountEmail == nil {
                    Button("Hubungkan Google Drive…") { Task { await connect() } }
                } else if model.sync == .needsLogin {
                    Button("Masuk ulang Google…") { Task { await connect() } }
                } else {
                    Button("Sinkronkan sekarang") { model.syncNow() }
                    Divider()
                    Button("Putuskan akun Google", role: .destructive) { model.disconnectGoogle() }
                }
                Divider()
                Button("Lihat profil") { model.section = .account; model.showHome() }
                Button("Kunci vault") { model.lock() }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
        }
        .padding(12)
        .background(Theme.ink.opacity(hover ? 0.06 : 0.03), in: RoundedRectangle(cornerRadius: 10))
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.djieSnappy) {
                model.section = .account
                model.showHome()
            }
        }
        .help(failureMessage ?? "Lihat profil akun")
        .padding(10)
        .onHover { h in withAnimation(.djieHover) { hover = h } }
    }

    private var isFailed: Bool {
        switch model.sync { case .failed, .needsLogin: true; default: false }
    }
    private var failureMessage: String? { if case .failed(let m) = model.sync { m } else { nil } }

    private func connect() async {
        guard !connecting else { return }
        connecting = true
        defer { connecting = false }
        do { _ = try await model.signInGoogle() }
        catch GoogleAuth.AuthError.cancelled {}
        catch { model.flash(error.localizedDescription) }
    }
}

/// Ikon status sync: berputar saat menyinkronkan, centang saat selesai.
struct SyncIcon: View {
    let state: SyncState
    @State private var spin = false

    var body: some View {
        Group {
            switch state {
            case .off: Image(systemName: "person.fill")
            case .idle, .synced: Image(systemName: "checkmark.icloud.fill")
            case .syncing:
                Image(systemName: "arrow.triangle.2.circlepath")
                    .rotationEffect(.degrees(spin ? 360 : 0))
                    .onAppear { withAnimation(.linear(duration: 1).repeatForever(autoreverses: false)) { spin = true } }
                    .onDisappear { spin = false }
            case .failed, .needsLogin: Image(systemName: "exclamationmark.icloud.fill")
            }
        }
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(.black.opacity(0.75))
        .contentTransition(.symbolEffect(.replace))
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
    @Binding var columns: NavigationSplitViewVisibility
    @Namespace private var ns

    private var sidebarHidden: Bool { columns == .detailOnly }

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
            Button { model.openLocalTerminal() } label: {
                Image(systemName: "plus").font(.system(size: 11, weight: .semibold))
                    .frame(width: 26, height: 26)
                    .background(Theme.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .help("Terminal lokal (⇧⌘T)")
            Spacer(minLength: 0)
            if let s = model.activeSession, !s.isLocal {
                Button {
                    withAnimation(.djie) { model.showServerInfo.toggle() }
                } label: {
                    Label("Info server", systemImage: "cpu")
                        .font(.system(size: 12, weight: model.showServerInfo ? .semibold : .regular))
                        .padding(.horizontal, 9).frame(height: 26)
                        .background(model.showServerInfo ? Theme.accent.opacity(0.16) : .clear, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                        .foregroundStyle(model.showServerInfo ? Theme.accent : .secondary)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help("Spesifikasi & grafik server (⇧⌘I)")
                .keyboardShortcut("i", modifiers: [.command, .shift])
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
            if model.activeSessionID != nil {
                AutocompleteMenu()
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
            if model.activeSessionID != nil && !model.snippets.isEmpty {
                Menu {
                    ForEach(model.snippets) { sn in
                        Button(sn.label) { model.runInActiveSession(sn) }
                    }
                } label: {
                    Label("Snippet", systemImage: "curlybraces")
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .help("Jalankan snippet di tab ini")
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 42)
        .background {
            Rectangle().fill(.bar)
                .contentShape(Rectangle())
                .gesture(WindowDragGesture())
        }
        .overlay(alignment: .bottom) { Divider() }
    }
}

struct TabChip<Label: View>: View {
    let isActive: Bool
    let ns: Namespace.ID
    var onSelect: () -> Void
    @ViewBuilder var label: () -> Label
    @State private var hover = false

    var body: some View {
        // Button sungguhan (bukan onTapGesture) supaya klik tidak tertelan gesture geser jendela
        Button { withAnimation(.djieSnappy) { onSelect() } } label: { chip }
            .buttonStyle(.plain)
            .onHover { h in withAnimation(.easeOut(duration: 0.12)) { hover = h } }
    }

    private var chip: some View {
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
    }
}

struct SessionTab: View {
    @Environment(AppModel.self) private var model
    @AppStorage(PrivacyKeys.hideAddresses) private var hideAddresses = true
    let session: TerminalSession
    let index: Int
    let ns: Namespace.ID
    @State private var hover = false

    var body: some View {
        TabChip(isActive: model.activeSessionID == session.id, ns: ns,
                onSelect: { model.activeSessionID = session.id }) {
            HStack(spacing: 7) {
                if session.isLocal {
                    Image(systemName: "apple.terminal").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(.secondary)
                } else {
                    StatusDot(status: session.status, color: Color(hex: session.host.color))
                }
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
        .help(index < 9 ? "\(session.host.displayAddress(hidden: hideAddresses))  ·  ⌘\(index + 1)"
                        : session.host.displayAddress(hidden: hideAddresses))
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

/// Kartu "versi baru tersedia" di bawah sidebar.
struct UpdateCard: View {
    @Environment(AppModel.self) private var model
    let update: AvailableUpdate
    @State private var shine = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles").foregroundStyle(Theme.brandGradient)
                    .symbolEffect(.bounce, options: .repeat(.periodic(delay: 3)))
                Text("Versi \(update.version) tersedia").font(.system(size: 12, weight: .semibold))
                Spacer()
                Button { withAnimation(.djie) { model.updateDismissed = true } } label: {
                    Image(systemName: "xmark").font(.system(size: 9, weight: .bold))
                }
                .buttonStyle(.plain).foregroundStyle(.secondary)
            }
            Text("Kamu memakai \(AppVersion.current).").font(.system(size: 11)).foregroundStyle(.secondary)
            HStack(spacing: 6) {
                Button("Download") { NSWorkspace.shared.open(update.download ?? update.page) }
                    .buttonStyle(PrimaryButtonStyle())
                Button("Catatan") { NSWorkspace.shared.open(update.page) }
                    .buttonStyle(SecondaryButtonStyle())
            }
        }
        .padding(12)
        .background(Theme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.accent.opacity(0.35)))
    }
}

/// Pengaturan autocomplete terminal di strip tab.
struct AutocompleteMenu: View {
    @AppStorage(AutocompleteKeys.enabled) private var enabled = true
    @State private var confirmClear = false

    var body: some View {
        Menu {
            Toggle("Saran perintah saat mengetik", isOn: $enabled)
            Divider()
            Button("Hapus riwayat perintah (\(CommandHistory.count))", role: .destructive) { confirmClear = true }
        } label: {
            Label("Autocomplete", systemImage: enabled ? "text.cursor" : "text.badge.xmark")
                .foregroundStyle(enabled ? Theme.accent : .secondary)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .help("Saran perintah dari riwayat, snippet, dan perintah umum")
        .confirmationDialog("Hapus semua riwayat perintah?", isPresented: $confirmClear) {
            Button("Hapus", role: .destructive) { CommandHistory.clear() }
        } message: {
            Text("Riwayat hanya tersimpan di Mac ini dan dipakai untuk saran autocomplete.")
        }
    }
}
