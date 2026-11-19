import SwiftUI

/// Panel kanan untuk membuat / mengedit host.
/// Susunan: Address → General → SSH & Credentials → Lanjutan → Tema terminal.
struct HostEditor: View {
    @Environment(AppModel.self) private var model
    let original: Host
    @State private var h: Host
    @State private var tagsText: String
    @State private var showPassword = false
    @State private var showAdvanced = false
    @State private var newKeyLabel = ""
    @FocusState private var addressFocused: Bool

    init(original: Host) {
        self.original = original
        _h = State(initialValue: original)
        _tagsText = State(initialValue: original.tags.joined(separator: ", "))
        _showAdvanced = State(initialValue: original.agentForwarding || original.jumpHostId != nil
                              || !(original.startupSnippet ?? "").isEmpty || !original.env.isEmpty)
    }

    private var isNew: Bool { original.id.isEmpty }
    private var canSave: Bool { !h.hostname.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 14) {
                    addressCard
                    generalCard
                    sshCard
                    advancedCard
                    themeCard
                    if !isNew {
                        Button(role: .destructive) {
                            model.delete(original)
                            model.editingHost = nil
                        } label: {
                            Label("Hapus host", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(SecondaryButtonStyle(wide: true))
                        .foregroundStyle(.red)
                        .padding(.top, 4)
                    }
                }
                .padding(16)
            }
            footer
        }
        .background(Theme.panel)
        .onAppear { if isNew { addressFocused = true } }
    }

    // MARK: Header / footer

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(isNew ? "Host Baru" : "Edit Host").font(.system(size: 17, weight: .bold))
                Text(model.accountEmail == nil ? "Vault pribadi" : "Vault · \(model.accountEmail!)")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            IconButton(symbol: "xmark", help: "Tutup (Esc)") { model.editingHost = nil }
                .keyboardShortcut(.cancelAction)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .overlay(alignment: .bottom) { Divider() }
    }

    private var footer: some View {
        HStack(spacing: 8) {
            Spacer()
            Button("Simpan") { save(connect: false) }
                .buttonStyle(SecondaryButtonStyle())
                .keyboardShortcut("s")
            Button {
                save(connect: true)
            } label: {
                Label("Connect", systemImage: "bolt.fill").lineLimit(1)
            }
            .help("Simpan lalu connect (⌘⏎)")
            .buttonStyle(PrimaryButtonStyle())
            .keyboardShortcut(.return, modifiers: .command)
        }
        .disabled(!canSave)
        .padding(14)
        .overlay(alignment: .top) { Divider() }
    }

    private func save(connect: Bool) {
        h.hostname = h.hostname.trimmingCharacters(in: .whitespaces)
        h.tags = tagsText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if h.group?.trimmingCharacters(in: .whitespaces).isEmpty == true { h.group = nil }
        guard let saved = model.save(h) else { return }
        model.editingHost = nil
        model.flash(isNew ? "Host “\(saved.title)” ditambahkan" : "Perubahan disimpan")
        if connect { model.connect([saved.id]) }
    }

    // MARK: Cards

    private var addressCard: some View {
        EditorCard("Address") {
            HStack(spacing: 10) {
                Menu {
                    ForEach(Theme.hostColors, id: \.self) { c in
                        Button {
                            withAnimation(.djieSnappy) { h.color = c }
                        } label: {
                            Label(c, systemImage: h.color == c ? "checkmark.circle.fill" : "circle.fill")
                        }
                    }
                } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(hex: h.color).gradient)
                        Image(systemName: "server.rack").font(.system(size: 17, weight: .bold)).foregroundStyle(.black.opacity(0.7))
                    }
                    .frame(width: 44, height: 44)
                }
                .menuStyle(.button).buttonStyle(.plain)
                .help("Ganti warna")

                TextField("IP atau hostname", text: $h.hostname)
                    .focused($addressFocused)
                    .djieField()
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(addressFocused ? Theme.accent : .clear, lineWidth: 1.5))
                    .animation(.djieSnappy, value: addressFocused)
            }
        }
    }

    private var generalCard: some View {
        EditorCard("General") {
            FieldRow(icon: "textformat") { TextField("Label", text: $h.label).textFieldStyle(.plain) }
            FieldRow(icon: "square.stack.3d.up") {
                TextField("Grup", text: Binding(get: { h.group ?? "" }, set: { h.group = $0 }))
                    .textFieldStyle(.plain)
                let groups = Set(model.hosts.compactMap(\.group)).sorted()
                if !groups.isEmpty {
                    Menu {
                        ForEach(groups, id: \.self) { g in Button(g) { h.group = g } }
                    } label: { Image(systemName: "chevron.down") }
                        .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                }
            }
            FieldRow(icon: "tag") { TextField("Tag (pisahkan dengan koma)", text: $tagsText).textFieldStyle(.plain) }
        }
    }

    private var sshCard: some View {
        EditorCard(nil) {
            HStack(spacing: 8) {
                Text("SSH di port").font(.system(size: 14, weight: .semibold))
                TextField("22", value: $h.port, format: .number.grouping(.never))
                    .multilineTextAlignment(.center)
                    .frame(width: 70)
                    .djieField()
            }
            Divider().padding(.vertical, 4)
            Text("Credentials").font(.system(size: 14, weight: .semibold))

            FieldRow(icon: "person.fill") { TextField("Username", text: $h.username).textFieldStyle(.plain) }

            Picker("", selection: $h.auth.animation(.djie)) {
                Text("Password").tag(AuthMethod.password)
                Text("SSH Key").tag(AuthMethod.key)
                Text("Agent").tag(AuthMethod.agent)
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            Group {
                switch h.auth {
                case .password:
                    FieldRow(icon: "ellipsis.rectangle") {
                        Group {
                            if showPassword {
                                TextField("Password", text: passwordBinding)
                            } else {
                                SecureField("Password", text: passwordBinding)
                            }
                        }
                        .textFieldStyle(.plain)
                        Button { showPassword.toggle() } label: {
                            Image(systemName: showPassword ? "eye" : "eye.slash")
                                .contentTransition(.symbolEffect(.replace))
                        }
                        .buttonStyle(.plain).foregroundStyle(.secondary)
                    }
                    Text("Kosongkan jika ingin mengetik password saat connect.")
                        .font(.caption).foregroundStyle(.tertiary)
                case .key:
                    keyPicker
                case .agent:
                    Label("Memakai SSH agent sistem (mis. 1Password, ssh-agent).", systemImage: "person.badge.key")
                        .font(.callout).foregroundStyle(.secondary)
                }
            }
            .transition(.opacity.combined(with: .move(edge: .top)))
        }
    }

    private var passwordBinding: Binding<String> {
        Binding(get: { h.password ?? "" }, set: { h.password = $0.isEmpty ? nil : $0 })
    }

    @ViewBuilder
    private var keyPicker: some View {
        let selected = model.key(id: h.keyId)
        Menu {
            ForEach(model.keys) { k in
                Button {
                    h.keyId = k.id
                } label: {
                    Label("\(k.label) · \(k.keyType)", systemImage: h.keyId == k.id ? "checkmark" : "key")
                }
            }
            if !model.keys.isEmpty { Divider() }
            Button("Generate key Ed25519 baru") {
                if let k = try? model.generateKey(label: h.title.isEmpty ? "host-key" : h.title) {
                    h.keyId = k.id
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(k.publicKey, forType: .string)
                    model.flash("Key dibuat · public key disalin ke clipboard")
                }
            }
            Button("Buka Keychain…") {
                model.editingHost = nil
                model.section = .keychain
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "key.fill").foregroundStyle(Theme.accent)
                VStack(alignment: .leading, spacing: 1) {
                    Text(selected?.label ?? "Pilih SSH key").font(.system(size: 13, weight: .medium))
                    if let s = selected {
                        Text(s.fingerprint).font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                Spacer()
                Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(Theme.field, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.ink.opacity(0.1)))
        }
        .menuStyle(.button).buttonStyle(.plain)
    }

    private var advancedCard: some View {
        EditorCard(nil) {
            Button {
                withAnimation(.djie) { showAdvanced.toggle() }
            } label: {
                HStack {
                    Text("Lanjutan").font(.system(size: 14, weight: .semibold))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .rotationEffect(.degrees(showAdvanced ? 90 : 0))
                        .foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if showAdvanced {
                VStack(spacing: 10) {
                    FieldRow(icon: "shield.lefthalf.filled") {
                        Text("Agent Forwarding")
                        Spacer()
                        Toggle("", isOn: $h.agentForwarding).toggleStyle(.switch).labelsHidden().controlSize(.small)
                    }
                    FieldRow(icon: "curlybraces") {
                        TextField("Startup snippet (dijalankan setelah login)",
                                  text: Binding(get: { h.startupSnippet ?? "" }, set: { h.startupSnippet = $0.isEmpty ? nil : $0 }))
                            .textFieldStyle(.plain).font(.system(size: 13, design: .monospaced))
                    }
                    FieldRow(icon: "point.3.connected.trianglepath.dotted") {
                        Picker("Host Chaining", selection: $h.jumpHostId) {
                            Text("Tanpa jump host").tag(String?.none)
                            ForEach(model.hosts.filter { $0.id != h.id }) { j in
                                Text(j.title).tag(Optional(j.id))
                            }
                        }
                        .labelsHidden()
                        Spacer()
                        Text("Jump host").font(.caption).foregroundStyle(.secondary)
                    }
                    envEditor
                    FieldRow(icon: "character.cursor.ibeam") {
                        Picker("Charset", selection: $h.charset) {
                            Text("UTF-8").tag("UTF-8")
                            Text("ASCII").tag("ASCII")
                        }
                        .labelsHidden()
                        Spacer()
                        Text("Charset").font(.caption).foregroundStyle(.secondary)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private var envEditor: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(h.env.indices, id: \.self) { i in
                HStack(spacing: 6) {
                    TextField("NAMA", text: $h.env[i].name).djieField().font(.system(size: 12, design: .monospaced))
                    TextField("nilai", text: $h.env[i].value).djieField().font(.system(size: 12, design: .monospaced))
                    IconButton(symbol: "minus", help: "Hapus") { withAnimation(.djieSnappy) { _ = h.env.remove(at: i) } }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            Button {
                withAnimation(.djieSnappy) { h.env.append(EnvVar(name: "", value: "")) }
            } label: {
                Label("Environment variable", systemImage: "plus").font(.callout)
            }
            .buttonStyle(.plain).foregroundStyle(.secondary)
            .padding(.leading, 4)
        }
    }

    private var themeCard: some View {
        EditorCard("Tema terminal") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(TerminalThemes.all) { t in
                        let active = TerminalThemes.def(h.terminalTheme).id == t.id
                        VStack(alignment: .leading, spacing: 6) {
                            ThemePreview(theme: t)
                                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(active ? Theme.accent : Theme.ink.opacity(0.1), lineWidth: active ? 2 : 1))
                                .scaleEffect(active ? 1 : 0.95)
                            Text(t.name).font(.caption).foregroundStyle(active ? .primary : .secondary)
                        }
                        .onTapGesture { withAnimation(.djieSnappy) { h.terminalTheme = t.id } }
                    }
                }
                .padding(2)
            }
        }
    }
}

// MARK: - Komponen

struct EditorCard<Content: View>: View {
    let title: String?
    @ViewBuilder var content: () -> Content
    init(_ title: String?, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let title { Text(title).font(.system(size: 14, weight: .semibold)) }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(padding: 14)
    }
}

struct FieldRow<Content: View>: View {
    let icon: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundStyle(.secondary).frame(width: 18)
            content()
        }
        .font(.system(size: 13))
        .padding(.horizontal, 12).frame(minHeight: 38)
        .background(Theme.field, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Theme.ink.opacity(0.1)))
    }
}

struct ThemePreview: View {
    let theme: TerminalThemes.Def
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Capsule().fill(Color(hex: theme.accent)).frame(width: 52, height: 4)
            Capsule().fill(Color(hex: theme.fg).opacity(0.7)).frame(width: 40, height: 4)
            HStack(spacing: 3) {
                Capsule().fill(Color(hex: theme.accent).opacity(0.7)).frame(width: 18, height: 4)
                Capsule().fill(Color(hex: theme.fg).opacity(0.5)).frame(width: 14, height: 4)
                Rectangle().fill(Color(hex: theme.accent)).frame(width: 4, height: 7)
            }
        }
        .padding(10)
        .frame(width: 84, height: 54, alignment: .topLeading)
        .background(Color(hex: theme.bg), in: RoundedRectangle(cornerRadius: 8))
    }
}
