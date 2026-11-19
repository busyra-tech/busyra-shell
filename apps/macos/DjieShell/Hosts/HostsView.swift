import SwiftUI

struct HostsView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""

    private var filtered: [Host] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return model.hosts }
        return model.hosts.filter { h in
            ([h.label, h.hostname, h.username, h.group ?? ""] + h.tags).contains { $0.lowercased().contains(q) }
        }
    }

    /// Dikelompokkan per grup; host tanpa grup di bagian "Hosts".
    private var grouped: [(String, [Host])] {
        let dict = Dictionary(grouping: filtered) { $0.group?.isEmpty == false ? $0.group! : "" }
        return dict.keys.sorted { a, b in a.isEmpty ? false : (b.isEmpty ? true : a < b) }
            .map { ($0, dict[$0]!) }
    }

    var body: some View {
        @Bindable var model = model
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header
                    if model.hosts.isEmpty {
                        EmptyHosts { model.editingHost = .blank() }
                    } else if filtered.isEmpty {
                        Text("Tidak ada host yang cocok dengan “\(query)”")
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity).padding(.top, 60)
                    } else {
                        ForEach(grouped, id: \.0) { group, hosts in
                            VStack(alignment: .leading, spacing: 12) {
                                Text(group.isEmpty ? "HOSTS" : group.uppercased())
                                    .font(.system(size: 11, weight: .semibold))
                                    .tracking(1)
                                    .foregroundStyle(.secondary)
                                LazyVGrid(columns: [GridItem(.adaptive(minimum: 270), spacing: 12)], spacing: 12) {
                                    ForEach(Array(hosts.enumerated()), id: \.element.id) { i, h in
                                        HostCard(host: h).staggerIn(i, base: 0)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(28)
                .padding(.bottom, 80)
            }

            if !model.selection.isEmpty {
                SelectionBar(visibleIDs: filtered.map(\.id))
                    .padding(.bottom, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.djie, value: model.selection.isEmpty)
    }

    private var header: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Hosts").font(.system(size: 26, weight: .bold, design: .rounded))
                Text("\(model.hosts.count) server")
                    .font(.callout).foregroundStyle(.secondary)
                    .help("⌘-klik untuk memilih beberapa host · klik dua kali untuk connect")
            }
            Spacer()
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Cari host, IP, tag…", text: $query).textFieldStyle(.plain).frame(width: 200)
            }
            .padding(.horizontal, 10).frame(height: 30)
            .background(Theme.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 9))
            Button {
                model.editingHost = .blank()
            } label: {
                Label("Host Baru", systemImage: "plus")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }
}

struct HostCard: View {
    @Environment(AppModel.self) private var model
    let host: Host
    @State private var hover = false

    private var selected: Bool { model.selection.contains(host.id) }
    private var editing: Bool { model.editingHost?.id == host.id }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(selected ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Color(hex: host.color).gradient))
                Image(systemName: selected ? "checkmark" : "server.rack")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.black.opacity(0.75))
                    .contentTransition(.symbolEffect(.replace))
            }
            .frame(width: 42, height: 42)
            .onTapGesture { toggle() }

            VStack(alignment: .leading, spacing: 3) {
                Text(host.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                Text(host.address).font(.system(size: 12, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1)
                if !host.tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(host.tags.prefix(3), id: \.self) { t in
                            Text(t).font(.system(size: 10, weight: .medium))
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Theme.ink.opacity(0.07), in: Capsule())
                        }
                    }
                    .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)

            if hover && model.selection.isEmpty {
                HStack(spacing: 4) {
                    IconButton(symbol: "pencil", help: "Edit") { model.editingHost = host }
                    IconButton(symbol: "bolt.fill", help: "Connect", tint: Theme.accent) { model.connect([host.id]) }
                }
                .transition(.opacity.combined(with: .scale(scale: 0.8)))
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(hover || selected ? Theme.cardHover : Theme.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(selected || editing ? Theme.accent.opacity(0.8) : Theme.ink.opacity(hover ? 0.14 : 0.07),
                              lineWidth: selected || editing ? 1.5 : 1)
        )
        .shadow(color: Theme.shadow.opacity(hover ? 1 : 0), radius: 12, y: 6)
        .offset(y: hover ? -1 : 0)
        .animation(.djieHover, value: hover)
        .animation(.djieSnappy, value: selected)
        .contentShape(Rectangle())
        .onHover { hover = $0 }
        .onTapGesture(count: 2) { if model.selection.isEmpty { model.connect([host.id]) } }
        .simultaneousGesture(TapGesture().onEnded {
            if NSEvent.modifierFlags.contains(.command) || !model.selection.isEmpty { toggle() }
        })
        .contextMenu {
            Button("Connect") { model.connect([host.id]) }
            Button("Edit") { model.editingHost = host }
            Button("Duplikat") {
                var copy = host
                copy.id = ""
                copy.label = host.title + " (salinan)"
                model.save(copy)
            }
            Button(selected ? "Batal pilih" : "Pilih") { toggle() }
            Divider()
            Button("Hapus", role: .destructive) { model.delete(host) }
        }
    }

    private func toggle() {
        withAnimation(.djieSnappy) {
            if selected { model.selection.remove(host.id) } else { model.selection.insert(host.id) }
        }
    }
}

struct SelectionBar: View {
    @Environment(AppModel.self) private var model
    let visibleIDs: [String]

    var body: some View {
        HStack(spacing: 14) {
            Text("\(model.selection.count)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .frame(minWidth: 24, minHeight: 24)
                .background(Theme.accent, in: Circle())
                .foregroundStyle(.black)
                .contentTransition(.numericText())
            Text("host dipilih").font(.callout)
            Divider().frame(height: 18)
            Button("Pilih semua") { withAnimation(.djieSnappy) { model.selection = Set(visibleIDs) } }
                .buttonStyle(.borderless)
            Button("Batal") { withAnimation(.djieSnappy) { model.selection.removeAll() } }
                .buttonStyle(.borderless)
            Button {
                model.connect(model.hosts.map(\.id).filter { model.selection.contains($0) })
            } label: {
                Label("Connect semua", systemImage: "bolt.fill")
            }
            .buttonStyle(PrimaryButtonStyle())
            .keyboardShortcut(.return)
        }
        .padding(.leading, 14).padding(.trailing, 8).padding(.vertical, 8)
        .background(.ultraThickMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.ink.opacity(0.1)))
        .shadow(color: Theme.shadow, radius: 24, y: 10)
        .animation(.djieSnappy, value: model.selection.count)
    }
}

struct EmptyHosts: View {
    var onAdd: () -> Void
    @State private var animate = false

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                ForEach(0..<3) { i in
                    Circle()
                        .stroke(Theme.accent.opacity(0.35), lineWidth: 1)
                        .frame(width: 70, height: 70)
                        .scaleEffect(animate ? 2.2 : 1)
                        .opacity(animate ? 0 : 0.8)
                        .animation(.easeOut(duration: 2.4).repeatForever(autoreverses: false).delay(Double(i) * 0.8), value: animate)
                }
                Image(systemName: "server.rack")
                    .font(.system(size: 30))
                    .foregroundStyle(Theme.brandGradient)
            }
            .frame(height: 140)
            Text("Belum ada host").font(.title3.bold())
            Text("Tambahkan server pertamamu, lalu connect dengan satu klik.")
                .foregroundStyle(.secondary)
            Button(action: onAdd) { Label("Tambah host", systemImage: "plus") }
                .buttonStyle(PrimaryButtonStyle())
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 50)
        .onAppear { animate = true }
    }
}

struct IconButton: View {
    let symbol: String
    var help: String = ""
    var tint: Color = .primary
    var action: () -> Void
    @State private var hover = false

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .background(Theme.ink.opacity(hover ? 0.12 : 0.06), in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .onHover { hover = $0 }
        .help(help)
    }
}
