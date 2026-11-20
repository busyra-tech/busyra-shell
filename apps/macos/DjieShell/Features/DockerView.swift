import SwiftUI

// MARK: - Model

/// Docker: container, image, dan proyek Compose — di Mac ini atau di server lewat SSH (core: DockerClient).
@MainActor
@Observable
final class DockerModel {
    enum Tab: String, CaseIterable { case containers, images, compose }

    /// nil = Docker di Mac ini; selain itu id host.
    private(set) var targetId: String?
    private(set) var connected = false
    var info: DockerInfo?
    var containers: [DockerContainer] = []
    var stats: [String: DockerStat] = [:]
    var images: [DockerImage] = []
    var projects: [ComposeProject] = []
    var tab: Tab = .containers
    var query = ""
    var loading = false
    var error: String?
    var busy: Set<String> = []

    @ObservationIgnored private var client: DockerClient?
    @ObservationIgnored private var poller: Task<Void, Never>?
    @ObservationIgnored private var generation = 0

    /// Ganti target (Mac ini / host) lalu muat ulang.
    func select(_ id: String?, model: AppModel) async {
        generation += 1
        let gen = generation
        let old = client
        client = nil
        withAnimation(.djie) {
            targetId = id; connected = false; info = nil; error = nil
            containers = []; images = []; projects = []; stats = [:]
            loading = true
        }
        Task { await old?.close() }
        do {
            let c: DockerClient
            if let id {
                guard let t = model.sshTarget(forId: id) else { throw CoreError.NotFound }
                c = try await DockerClient.connect(target: t)
            } else {
                c = try DockerClient.local()
            }
            guard gen == generation else { await c.close(); return }
            client = c
            connected = true
            await refresh()
        } catch {
            guard gen == generation else { return }
            withAnimation(.djie) { self.error = error.djieMessage; loading = false }
        }
    }

    func refresh() async {
        guard let client else { return }
        loading = true
        do {
            async let i = client.info()
            async let c = client.containers()
            async let im = client.images()
            async let p = client.composeProjects()
            let (ii, cc, imm, pp) = try await (i, c, im, p)
            withAnimation(.djie) { info = ii; containers = cc; images = imm; projects = pp; error = nil }
        } catch {
            withAnimation(.djie) { self.error = error.djieMessage }
        }
        loading = false
        await refreshStats()
    }

    func refreshStats() async {
        guard let client, containers.contains(where: { $0.state == "running" }) else { return }
        if let s = try? await client.stats() {
            stats = Dictionary(s.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        }
    }

    /// Perbarui status & statistik berkala selama halaman terbuka.
    func startPolling() {
        poller?.cancel()
        poller = Task { [weak self] in
            var tick = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                guard let self, self.connected, !Task.isCancelled else { continue }
                tick += 1
                if tick % 3 == 0, let c = try? await self.client?.containers() { withAnimation(.djie) { self.containers = c } }
                await self.refreshStats()
            }
        }
    }

    func stopPolling() { poller?.cancel() }

    private func run(_ key: String, _ op: @escaping (DockerClient) async throws -> Void) async {
        guard let client, !busy.contains(key) else { return }
        busy.insert(key)
        do { try await op(client); error = nil } catch { withAnimation(.djie) { self.error = error.djieMessage } }
        busy.remove(key)
        await refresh()
    }

    func action(_ c: DockerContainer, _ action: String) async {
        await run(c.id) { try await $0.containerAction(id: c.id, action: action) }
    }

    func compose(_ name: String, _ action: String) async {
        let files = projects.first { $0.name == name }?.configFiles ?? ""
        await run("compose:\(name)") { _ = try await $0.composeAction(project: name, configFiles: files, action: action) }
    }

    func removeImage(_ i: DockerImage) async {
        await run("img:\(i.id)") { try await $0.removeImage(id: i.id) }
    }

    func logs(_ id: String, tail: UInt32) async -> String {
        guard let client else { return "" }
        do { return try await client.logs(id: id, tail: tail) } catch { return error.djieMessage }
    }

    func execCommand(_ id: String) -> String? { try? client?.execCommand(id: id) }

    var filtered: [DockerContainer] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return containers }
        return containers.filter { ([$0.name, $0.image, $0.project, $0.ports]).contains { $0.lowercased().contains(q) } }
    }

    /// Dikelompokkan per proyek Compose; container lepas di grup terakhir.
    var groups: [(String, [DockerContainer])] {
        let d = Dictionary(grouping: filtered, by: \.project)
        return d.keys.sorted { a, b in a.isEmpty ? false : (b.isEmpty ? true : a < b) }.map { ($0, d[$0]!) }
    }
}

// MARK: - Tampilan

private let dockerBlue = Color(hex: "#2496ED")

struct DockerView: View {
    @Environment(AppModel.self) private var model
    @State private var logsFor: DockerContainer?

    private var docker: DockerModel { model.docker }

    var body: some View {
        @Bindable var docker = model.docker
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(title: "Docker", subtitle: "Container, image & Compose — di Mac ini atau di server lewat SSH") {
                    TargetMenu()
                    Button { Task { await docker.refresh() } } label: {
                        Image(systemName: "arrow.clockwise").rotationEffect(.degrees(docker.loading ? 360 : 0))
                            .animation(docker.loading ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: docker.loading)
                    }
                    .buttonStyle(SecondaryButtonStyle()).help("Muat ulang").disabled(!docker.connected)
                }

                if let e = docker.error {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                        Text(e).font(.callout).fixedSize(horizontal: false, vertical: true)
                        Spacer()
                        Button("Coba lagi") { Task { await docker.select(docker.targetId, model: model) } }.buttonStyle(SecondaryButtonStyle())
                    }
                    .padding(14)
                    .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                }

                if let info = docker.info {
                    InfoStrip(info: info, images: docker.images.count)
                    HStack(spacing: 12) {
                        Picker("", selection: $docker.tab) {
                            Text("Container · \(docker.containers.count)").tag(DockerModel.Tab.containers)
                            Text("Image · \(docker.images.count)").tag(DockerModel.Tab.images)
                            Text("Compose · \(docker.projects.count)").tag(DockerModel.Tab.compose)
                        }
                        .pickerStyle(.segmented).labelsHidden().frame(width: 380)
                        Spacer()
                        if docker.tab == .containers { SearchField(text: $docker.query, prompt: "Cari container, image, port…") }
                    }
                    switch docker.tab {
                    case .containers: ContainerList(logsFor: $logsFor)
                    case .images: ImageList()
                    case .compose: ComposeList()
                    }
                } else if docker.loading {
                    HStack(spacing: 10) { ProgressView().controlSize(.small); Text("Menghubungkan ke Docker…").foregroundStyle(.secondary) }
                        .frame(maxWidth: .infinity).padding(.top, 60)
                }
            }
            .padding(28)
            .animation(.djie, value: docker.tab)
        }
        .task {
            if !docker.connected && !docker.loading { await docker.select(docker.targetId, model: model) }
            docker.startPolling()
        }
        .onDisappear { docker.stopPolling() }
        .sheet(item: $logsFor) { c in DockerLogsSheet(container: c) }
    }
}

extension DockerContainer: @retroactive Identifiable {}

/// Pilih Docker: Mac ini atau host tersimpan.
private struct TargetMenu: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        let docker = model.docker
        let current = docker.targetId.flatMap { id in model.hosts.first { $0.id == id } }
        Menu {
            Button { Task { await docker.select(nil, model: model) } } label: { Label("Mac ini", systemImage: "laptopcomputer") }
            if !model.hosts.isEmpty {
                Divider()
                ForEach(model.hosts) { h in
                    Button { Task { await docker.select(h.id, model: model) } } label: { Label(h.title, systemImage: "server.rack") }
                }
            }
        } label: {
            HStack(spacing: 7) {
                Image(systemName: current == nil ? "laptopcomputer" : "server.rack").foregroundStyle(dockerBlue)
                Text(current?.title ?? "Mac ini").font(.system(size: 13, weight: .semibold))
                Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(Theme.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(Theme.cardStroke))
        }
        .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
    }
}

private struct InfoStrip: View {
    let info: DockerInfo
    let images: Int
    var body: some View {
        HStack(spacing: 12) {
            tile("shippingbox.fill", "Docker \(info.version)", info.os + (info.usesSudo ? " · sudo" : ""))
            tile("play.circle.fill", "\(info.running) / \(info.containers)", "container berjalan")
            tile("square.stack.3d.down.right.fill", "\(images)", "image")
            tile("cpu", "\(info.cpus) CPU", ByteCountFormatter.string(fromByteCount: Int64(info.memory), countStyle: .memory) + " RAM")
        }
    }

    private func tile(_ icon: String, _ title: String, _ sub: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold)).foregroundStyle(dockerBlue)
                .frame(width: 34, height: 34).background(dockerBlue.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: title).font(.system(size: 14, weight: .bold)).lineLimit(1)
                Text(verbatim: sub).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(Theme.cardStroke))
    }
}

private struct ContainerList: View {
    @Environment(AppModel.self) private var model
    @Binding var logsFor: DockerContainer?

    var body: some View {
        let docker = model.docker
        if docker.containers.isEmpty {
            EmptyState(icon: "shippingbox", title: "Belum ada container", text: "Container yang dibuat dengan docker run atau docker compose akan muncul di sini.")
        } else {
            VStack(alignment: .leading, spacing: 18) {
                ForEach(docker.groups, id: \.0) { project, list in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: project.isEmpty ? "shippingbox" : "square.stack.3d.up").font(.system(size: 11))
                            Text(project.isEmpty ? "CONTAINER LEPAS" : project.uppercased()).font(.system(size: 11, weight: .semibold)).tracking(1.1)
                            Text("\(list.filter { $0.state == "running" }.count)/\(list.count)").font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 6).padding(.vertical, 1).background(Theme.ink.opacity(0.08), in: Capsule())
                            Rectangle().fill(Theme.ink.opacity(0.07)).frame(height: 1)
                            if !project.isEmpty, docker.projects.contains(where: { $0.name == project }) {
                                ComposeButtons(name: project, compact: true)
                            }
                        }
                        .foregroundStyle(.secondary)
                        VStack(spacing: 6) {
                            ForEach(list, id: \.id) { c in ContainerRow(container: c, logsFor: $logsFor) }
                        }
                    }
                }
            }
        }
    }
}

private struct ContainerRow: View {
    @Environment(AppModel.self) private var model
    let container: DockerContainer
    @Binding var logsFor: DockerContainer?
    @State private var confirmRemove = false

    private var running: Bool { container.state == "running" }
    private var color: Color {
        switch container.state {
        case "running": Color(hex: "#4ADE80")
        case "paused": .orange
        case "restarting": .yellow
        default: Color.secondary.opacity(0.6)
        }
    }

    var body: some View {
        let docker = model.docker
        let stat = docker.stats[container.id]
        let busy = docker.busy.contains(container.id)
        HoverCard(padding: 11) {
            HStack(spacing: 12) {
                Circle().fill(color).frame(width: 9, height: 9).shadow(color: running ? color.opacity(0.7) : .clear, radius: 4)
                VStack(alignment: .leading, spacing: 2) {
                    Text(container.service.isEmpty ? container.name : container.service).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Text(container.image).font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1)
                }
                .frame(minWidth: 180, alignment: .leading)
                Text(container.status).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1).frame(width: 150, alignment: .leading)
                PortChips(ports: container.ports)
                Spacer()
                if running, let s = stat {
                    Meter(label: "CPU", value: s.cpuPercent, text: String(format: "%.1f%%", s.cpuPercent))
                    Meter(label: "RAM", value: s.memPercent, text: s.memUsage.components(separatedBy: " / ").first ?? s.memUsage)
                }
                HStack(spacing: 2) {
                    if busy {
                        ProgressView().controlSize(.small).frame(width: 28)
                    } else if running {
                        IconButton(symbol: "stop.fill", help: "Stop") { Task { await docker.action(container, "stop") } }
                    } else {
                        IconButton(symbol: "play.fill", help: "Start", tint: Color(hex: "#4ADE80")) { Task { await docker.action(container, "start") } }
                    }
                    IconButton(symbol: "arrow.clockwise", help: "Restart") { Task { await docker.action(container, "restart") } }
                    IconButton(symbol: "doc.text", help: "Log") { logsFor = container }
                    IconButton(symbol: "terminal", help: "Buka shell di container") { openShell() }
                        .disabled(!running)
                    Menu {
                        if container.state == "paused" {
                            Button("Lanjutkan (unpause)") { Task { await docker.action(container, "unpause") } }
                        } else if running {
                            Button("Jeda (pause)") { Task { await docker.action(container, "pause") } }
                        }
                        Button("Salin ID") { copy(container.id) }
                        Button("Salin nama") { copy(container.name) }
                        Divider()
                        Button("Hapus container…", role: .destructive) { confirmRemove = true }
                    } label: { Image(systemName: "ellipsis").frame(width: 24, height: 24) }
                        .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                }
            }
        }
        .confirmationDialog("Hapus container \(container.name)?", isPresented: $confirmRemove) {
            Button("Hapus", role: .destructive) { Task { await docker.action(container, "rm") } }
        } message: {
            Text("Container dihentikan dan dihapus. Volume dan image tidak ikut terhapus.")
        }
    }

    private func copy(_ s: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(s, forType: .string)
        model.flash("Disalin")
    }

    private func openShell() {
        guard let cmd = model.docker.execCommand(container.id) else { return }
        if let id = model.docker.targetId { model.connect([id], run: cmd) } else { model.openLocalTerminal(run: cmd) }
    }
}

private struct PortChips: View {
    let ports: String
    var body: some View {
        // "0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp" → "8000→8000"
        let published = ports.components(separatedBy: ", ").compactMap { p -> String? in
            guard let r = p.range(of: "->") else { return nil }
            let host = p[..<r.lowerBound].split(separator: ":").last.map(String.init) ?? ""
            let inner = p[r.upperBound...].split(separator: "/").first.map(String.init) ?? ""
            return "\(host)→\(inner)"
        }
        let unique = Array(NSOrderedSet(array: published)) as? [String] ?? []
        HStack(spacing: 4) {
            ForEach(unique.prefix(2), id: \.self) { p in
                Text(verbatim: p).font(.system(size: 10.5, weight: .medium, design: .monospaced))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(dockerBlue.opacity(0.13), in: Capsule()).foregroundStyle(dockerBlue)
            }
            if unique.count > 2 { Text("+\(unique.count - 2)").font(.system(size: 10.5)).foregroundStyle(.secondary) }
        }
    }
}

private struct Meter: View {
    let label: String
    let value: Double
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                Text(label).font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
                Text(verbatim: text).font(.system(size: 10.5, weight: .semibold, design: .monospaced)).lineLimit(1)
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.ink.opacity(0.08))
                    Capsule().fill(value > 80 ? Color.red : value > 50 ? Color.orange : dockerBlue)
                        .frame(width: max(2, g.size.width * min(1, value / 100)))
                }
            }
            .frame(height: 4)
        }
        .frame(width: 92)
    }
}

private struct ComposeButtons: View {
    @Environment(AppModel.self) private var model
    let name: String
    var compact = false
    @State private var confirmDown = false
    var body: some View {
        let docker = model.docker
        let busy = docker.busy.contains("compose:\(name)")
        HStack(spacing: 4) {
            if busy { ProgressView().controlSize(.small) }
            Group {
                Button { Task { await docker.compose(name, "up") } } label: { Label("Up", systemImage: "play.fill") }
                Button { Task { await docker.compose(name, "restart") } } label: { Label("Restart", systemImage: "arrow.clockwise") }
                Button { Task { await docker.compose(name, "stop") } } label: { Label("Stop", systemImage: "stop.fill") }
                if !compact {
                    Button { confirmDown = true } label: { Label("Down", systemImage: "trash") }
                }
            }
            .buttonStyle(SecondaryButtonStyle())
            .controlSize(compact ? .small : .regular)
            .disabled(busy)
        }
        .confirmationDialog("Down proyek \(name)?", isPresented: $confirmDown) {
            Button("Down", role: .destructive) { Task { await docker.compose(name, "down") } }
        } message: {
            Text("Semua container proyek ini dihentikan dan dihapus (docker compose down). Volume tetap aman.")
        }
    }
}

private struct ImageList: View {
    @Environment(AppModel.self) private var model
    @State private var toDelete: DockerImage?
    var body: some View {
        let docker = model.docker
        VStack(spacing: 6) {
            ForEach(docker.images, id: \.id) { i in
                HoverCard(padding: 11) {
                    HStack(spacing: 12) {
                        Image(systemName: "square.stack.3d.down.right.fill").foregroundStyle(dockerBlue)
                            .frame(width: 30, height: 30).background(dockerBlue.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(i.repository).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                                Badge(text: i.tag, color: Theme.accent2)
                            }
                            Text(i.id).font(.system(size: 10.5, design: .monospaced)).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(i.size).font(.system(size: 12, weight: .semibold, design: .monospaced)).frame(width: 80, alignment: .trailing)
                        Text(i.created).font(.system(size: 11)).foregroundStyle(.secondary).frame(width: 120, alignment: .trailing)
                        if docker.busy.contains("img:\(i.id)") {
                            ProgressView().controlSize(.small).frame(width: 28)
                        } else {
                            IconButton(symbol: "trash", help: "Hapus image", tint: .red) { toDelete = i }
                        }
                    }
                }
            }
        }
        .confirmationDialog("Hapus image \(toDelete?.repository ?? ""):\(toDelete?.tag ?? "")?", isPresented: Binding(get: { toDelete != nil }, set: { if !$0 { toDelete = nil } })) {
            Button("Hapus", role: .destructive) { if let i = toDelete { Task { await docker.removeImage(i) } } }
        } message: {
            Text("Image yang masih dipakai container tidak bisa dihapus.")
        }
    }
}

private struct ComposeList: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        let docker = model.docker
        if docker.projects.isEmpty {
            EmptyState(icon: "square.stack.3d.up", title: "Belum ada proyek Compose", text: "Proyek yang dijalankan dengan docker compose up akan muncul di sini.")
        } else {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 380), spacing: 12, alignment: .top)], spacing: 12) {
                ForEach(docker.projects, id: \.name) { p in
                    let running = p.status.lowercased().contains("running")
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Image(systemName: "square.stack.3d.up.fill").foregroundStyle(.white)
                                .frame(width: 34, height: 34).background(dockerBlue, in: RoundedRectangle(cornerRadius: 9))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.name).font(.system(size: 14, weight: .bold))
                                Text(p.status).font(.system(size: 11, weight: .medium)).foregroundStyle(running ? Color(hex: "#4ADE80") : .secondary)
                            }
                            Spacer()
                        }
                        Text(p.configFiles.replacingOccurrences(of: NSHomeDirectory(), with: "~"))
                            .font(.system(size: 10.5, design: .monospaced)).foregroundStyle(.secondary).lineLimit(2).truncationMode(.middle)
                        ComposeButtons(name: p.name)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(running ? Color(hex: "#4ADE80").opacity(0.4) : Theme.cardStroke))
                }
            }
        }
    }
}

private struct DockerLogsSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let container: DockerContainer
    @State private var text = ""
    @State private var follow = true
    @State private var tail: UInt32 = 300

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "doc.text").foregroundStyle(dockerBlue)
                Text("Log \(container.name)").font(.title3.bold()).lineLimit(1)
                Spacer()
                Picker("", selection: $tail) {
                    Text("300 baris").tag(UInt32(300))
                    Text("1.000 baris").tag(UInt32(1000))
                    Text("5.000 baris").tag(UInt32(5000))
                }
                .labelsHidden().frame(width: 120)
                Toggle("Ikuti", isOn: $follow).toggleStyle(.switch).controlSize(.small)
            }
            ScrollViewReader { proxy in
                ScrollView {
                    Text(text.isEmpty ? "Memuat log…" : text)
                        .font(.system(size: 11, design: .monospaced))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                    Color.clear.frame(height: 1).id("end")
                }
                .onChange(of: text) { if follow { proxy.scrollTo("end", anchor: .bottom) } }
            }
            .frame(height: 440)
            .background(Theme.field, in: RoundedRectangle(cornerRadius: 10))
            HStack {
                Button { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string); model.flash("Log disalin") } label: { Label("Salin", systemImage: "doc.on.doc") }
                    .buttonStyle(SecondaryButtonStyle())
                Spacer()
                Button("Tutup") { dismiss() }.buttonStyle(SecondaryButtonStyle()).keyboardShortcut(.cancelAction)
            }
        }
        .padding(22).frame(width: 820)
        .task(id: "\(tail)-\(follow)") {
            while !Task.isCancelled {
                text = await model.docker.logs(container.id, tail: tail)
                if !follow { break }
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }
}
