import SwiftUI

enum TeamLinks {
    static let joinPage = URL(string: "https://masadjie.github.io/djie-shell/team.html")!
}

/// Halaman Tim: admin membagikan host ke email rekan; anggota melihat host tim di daftar Hosts.
struct TeamView: View {
    @Environment(AppModel.self) private var model
    @State private var creating = false
    @State private var joining = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                PageHeader(title: "Tim", subtitle: "Bagikan host ke rekan kerja — terenkripsi end-to-end lewat Google Drive") {
                    if model.teamReady {
                        if model.teamBusy { ProgressView().controlSize(.small) }
                        Button { joining = true } label: { Label("Gabung tim", systemImage: "person.badge.plus") }
                            .buttonStyle(SecondaryButtonStyle())
                        Button { creating = true } label: { Label("Buat tim", systemImage: "plus") }
                            .buttonStyle(PrimaryButtonStyle())
                    }
                }

                if let err = model.teamError {
                    Label(err, systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(.red)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                        .transition(.opacity)
                }

                if !model.teamReady {
                    TeamSetupCard()
                } else {
                    if !model.teamInvites.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            SectionTitle(text: "Undangan")
                            ForEach(model.teamInvites, id: \.fileId) { inv in InviteRow(invite: inv) }
                        }
                    }
                    if model.teams.isEmpty {
                        TeamIntro()
                    } else {
                        ForEach(Array(model.teams.enumerated()), id: \.element.id) { i, t in
                            TeamCard(team: t).staggerIn(i, base: 0)
                        }
                    }
                }
            }
            .padding(28)
            .animation(.djie, value: model.teams)
            .animation(.djie, value: model.teamError)
        }
        .sheet(isPresented: $creating) { CreateTeamSheet() }
        .sheet(isPresented: $joining) { JoinTeamSheet() }
        .task {
            await model.syncTeams()
            await model.refreshInvites()
        }
    }
}

private struct SectionTitle: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold)).tracking(1.2)
            .foregroundStyle(.secondary)
    }
}

/// Belum login Google / login lama tanpa izin drive.file.
private struct TeamSetupCard: View {
    @Environment(AppModel.self) private var model
    @State private var working = false

    var body: some View {
        HoverCard(padding: 22) {
            HStack(alignment: .top, spacing: 18) {
                Image(systemName: "person.2.badge.key.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(Theme.brandGradient)
                    .frame(width: 56, height: 56)
                    .background(Theme.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 8) {
                    Text(model.accountEmail == nil ? "Masuk dengan Google untuk memakai Tim" : "Izinkan Djie Shell mengelola file Tim")
                        .font(.title3.bold())
                    Text(model.accountEmail == nil
                         ? "Tim memakai Google Drive milik admin untuk menyimpan host yang dibagikan. Isinya terenkripsi — Google tidak bisa membacanya."
                         : "Tim butuh izin Google Drive tambahan: hanya file yang dibuat atau kamu pilih di Djie Shell — bukan seluruh Drive-mu. Masuk ulang dengan Google lalu centang izin Drive.")
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        working = true
                        Task { await model.grantTeamAccess(); working = false }
                    } label: {
                        Label(model.accountEmail == nil ? "Masuk dengan Google" : "Izinkan akses Google Drive", systemImage: "g.circle.fill")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(working)
                    .padding(.top, 4)
                }
            }
        }
    }
}

/// Penjelasan singkat saat belum ada tim.
private struct TeamIntro: View {
    var body: some View {
        VStack(spacing: 18) {
            EmptyState(icon: "person.2.fill", title: "Belum ada tim",
                       text: "Buat tim untuk membagikan host ke rekan kerja, atau gabung ke tim yang mengundangmu.")
            HStack(alignment: .top, spacing: 12) {
                step(1, "Buat tim", "Pilih host yang dibagikan — password & SSH key ikut, terenkripsi.")
                step(2, "Undang email", "Google mengirim email undangan ke rekanmu.")
                step(3, "Rekan bergabung", "Mereka klik Gabung tim di Djie Shell; host muncul di daftar Hosts.")
            }
            .frame(maxWidth: 760)
        }
        .frame(maxWidth: .infinity)
    }

    private func step(_ n: Int, _ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(n)").font(.system(size: 12, weight: .bold)).frame(width: 22, height: 22)
                .background(Theme.brandGradient, in: Circle()).foregroundStyle(.black.opacity(0.75))
            Text(title).font(.system(size: 13, weight: .semibold))
            Text(text).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.cardStroke))
    }
}

private struct InviteRow: View {
    @Environment(AppModel.self) private var model
    let invite: TeamInvite
    @State private var working = false

    var body: some View {
        HoverCard(padding: 12) {
            HStack(spacing: 12) {
                Image(systemName: "envelope.open.fill").foregroundStyle(Section.team.tint)
                    .frame(width: 34, height: 34)
                    .background(Section.team.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text(invite.name).font(.system(size: 13, weight: .semibold))
                    Text("dari \(invite.ownerEmail)").font(.system(size: 11)).foregroundStyle(.secondary)
                }
                Spacer()
                Button(working ? "Bergabung…" : "Gabung") {
                    working = true
                    Task { _ = await model.joinTeam(fileId: invite.fileId); working = false }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(working)
            }
        }
    }
}

// MARK: - Kartu tim

private struct TeamCard: View {
    @Environment(AppModel.self) private var model
    let team: TeamInfo
    @State private var inviteEmail = ""
    @State private var sharing = false
    @State private var confirmLeave = false
    @State private var removing: String?

    private var sharedHosts: [Host] {
        model.ownHosts.filter { team.sharedHostIds.contains($0.id) }
    }
    private var memberHosts: [Host] {
        model.hosts.filter { $0.id.hasPrefix("team:\(team.id):") }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            if team.isOwner { ownerBody } else { memberBody }
        }
        .padding(18)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.card))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.cardStroke))
        .sheet(isPresented: $sharing) { ShareHostsSheet(team: team) }
        .confirmationDialog(team.isOwner ? "Hapus tim \(team.name)?" : "Keluar dari \(team.name)?", isPresented: $confirmLeave) {
            Button(team.isOwner ? "Hapus tim" : "Keluar", role: .destructive) { Task { await model.leaveTeam(team) } }
        } message: {
            Text(team.isOwner
                 ? "File tim dipindah ke sampah Google Drive-mu dan semua anggota kehilangan akses ke host tim."
                 : "Host tim hilang dari Djie Shell-mu. Admin bisa mengundangmu lagi nanti.")
        }
        .confirmationDialog("Keluarkan \(removing ?? "")?", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } })) {
            Button("Keluarkan", role: .destructive) {
                if let e = removing { Task { await model.removeFromTeam(team, email: e) } }
            }
        } message: {
            Text("Akses Google Drive-nya dicabut dan kunci tim diganti, jadi perubahan host berikutnya tidak bisa dibaca lagi olehnya. Ganti juga password server yang sempat ia lihat.")
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.2.fill")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.black.opacity(0.72))
                .frame(width: 42, height: 42)
                .background(LinearGradient(colors: [Section.team.tint, Section.team.tint.opacity(0.6)], startPoint: .topLeading, endPoint: .bottomTrailing),
                            in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(team.name).font(.system(size: 17, weight: .bold))
                    Badge(text: team.isOwner ? "ADMIN" : "ANGGOTA", color: team.isOwner ? Theme.accent : Theme.accent2)
                    if !team.isOwner { statusBadge }
                }
                Text(subtitle).font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Menu {
                Button("Sinkronkan sekarang") { Task { await model.syncTeams() } }
                Divider()
                Button(team.isOwner ? "Hapus tim…" : "Keluar dari tim…", role: .destructive) { confirmLeave = true }
            } label: {
                Image(systemName: "ellipsis").frame(width: 28, height: 28)
            }
            .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
        }
    }

    private var subtitle: String {
        var parts = [team.isOwner ? "\(team.members.count) anggota" : "Admin: \(team.ownerEmail)"]
        if team.lastSync > 0 {
            parts.append("disinkron " + Date(ms: team.lastSync).formatted(.relative(presentation: .named)))
        }
        if let e = team.error { parts.append("⚠︎ " + e) }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder private var statusBadge: some View {
        switch team.status {
        case .active: Badge(text: "AKTIF", color: Color(hex: "#4ADE80"))
        case .waiting: Badge(text: "MENUNGGU ADMIN", color: .orange)
        case .revoked: Badge(text: "AKSES DICABUT", color: .red)
        }
    }

    // MARK: Admin

    private var ownerBody: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle(text: "Anggota")
                VStack(spacing: 0) {
                    ForEach(team.members, id: \.email) { m in
                        HStack(spacing: 10) {
                            MemberAvatar(email: m.email)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(m.email).font(.system(size: 12.5, weight: .medium)).lineLimit(1)
                                Text(m.isAdmin ? "Admin" : m.status == .joined ? "Aktif" : "Belum bergabung di Djie Shell")
                                    .font(.system(size: 11))
                                    .foregroundStyle(m.isAdmin || m.status == .joined ? .secondary : Color.orange)
                            }
                            Spacer()
                            if !m.isAdmin {
                                IconButton(symbol: "person.fill.xmark", help: "Keluarkan dari tim", tint: .red) { removing = m.email }
                            }
                        }
                        .padding(.vertical, 7)
                        if m.email != team.members.last?.email { Divider().opacity(0.5) }
                    }
                }
                HStack(spacing: 8) {
                    TextField("email@rekan.com", text: $inviteEmail)
                        .djieField()
                        .onSubmit(invite)
                    Button("Undang", action: invite)
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(!inviteEmail.contains("@") || model.teamBusy)
                }
                Text("Google mengirim email undangan. Rekan lalu membuka Tim → Gabung tim di Djie Shell miliknya, masuk dengan email yang diundang.")
                    .font(.system(size: 11)).foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    SectionTitle(text: "Host dibagikan")
                    Spacer()
                    Button { sharing = true } label: { Label("Pilih host", systemImage: "checklist") }
                        .buttonStyle(SecondaryButtonStyle())
                }
                if sharedHosts.isEmpty {
                    Text("Belum ada host yang dibagikan.")
                        .font(.callout).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 80)
                        .background(Theme.ink.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
                } else {
                    VStack(spacing: 6) {
                        ForEach(sharedHosts) { h in HostChip(host: h) }
                    }
                }
                Text("Password & SSH key host ikut dibagikan, terenkripsi. Perubahan host otomatis terkirim ke anggota.")
                    .font(.system(size: 11)).foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func invite() {
        let email = inviteEmail.trimmingCharacters(in: .whitespaces)
        guard email.contains("@") else { return }
        Task { if await model.inviteToTeam(team, email: email) { inviteEmail = "" } }
    }

    // MARK: Anggota

    @ViewBuilder private var memberBody: some View {
        switch team.status {
        case .active:
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    SectionTitle(text: "\(memberHosts.count) host dari tim")
                    Spacer()
                    Button { withAnimation(.djie) { model.section = .hosts } } label: { Label("Buka Hosts", systemImage: "server.rack") }
                        .buttonStyle(SecondaryButtonStyle())
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 8)], spacing: 8) {
                    ForEach(memberHosts) { h in HostChip(host: h) }
                }
            }
        case .waiting:
            Label("Menunggu \(team.ownerEmail) membuka Djie Shell agar kunci tim terkirim. Host tim muncul otomatis setelah itu.",
                  systemImage: "hourglass")
                .font(.callout).foregroundStyle(.secondary)
        case .revoked:
            Label("Akses ke tim ini sudah dicabut atau timnya dihapus.", systemImage: "lock.slash")
                .font(.callout).foregroundStyle(.secondary)
        }
    }
}

private struct MemberAvatar: View {
    let email: String
    var body: some View {
        Text(String(email.prefix(1)).uppercased())
            .font(.system(size: 12, weight: .bold))
            .frame(width: 28, height: 28)
            .background(Color(hex: Theme.hostColors[abs(email.hashValue) % Theme.hostColors.count]).opacity(0.25), in: Circle())
    }
}

private struct HostChip: View {
    @Environment(AppModel.self) private var model
    @AppStorage(PrivacyKeys.hideAddresses) private var hideAddresses = true
    let host: Host

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 6).fill(Color(hex: host.color)).frame(width: 8, height: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(host.title).font(.system(size: 12.5, weight: .semibold)).lineLimit(1)
                Text(host.displayAddress(hidden: hideAddresses)).font(.system(size: 10.5, design: .monospaced)).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Image(systemName: host.auth == .key ? "key.fill" : host.auth == .agent ? "person.badge.key" : "ellipsis.rectangle")
                .font(.system(size: 11)).foregroundStyle(.tertiary)
            if host.isTeam {
                IconButton(symbol: "play.fill", help: "Connect") { model.connect([host.id]) }
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(Theme.ink.opacity(0.045), in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Sheet

private struct CreateTeamSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var working = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Buat tim").font(.title3.bold())
            Text("File tim dibuat di Google Drive-mu (\(model.accountEmail ?? "akun Google")). Kamu jadi admin: yang bisa mengundang dan memilih host.")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            TextField("Nama tim (mis. Tim Ops)", text: $name).djieField().onSubmit(create)
            HStack {
                Spacer()
                Button("Batal") { dismiss() }.buttonStyle(SecondaryButtonStyle()).keyboardShortcut(.cancelAction)
                Button(working ? "Membuat…" : "Buat tim", action: create)
                    .buttonStyle(PrimaryButtonStyle()).keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || working)
            }
        }
        .padding(24).frame(width: 460)
    }

    private func create() {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        working = true
        Task {
            if await model.createTeam(name: name.trimmingCharacters(in: .whitespaces)) { dismiss() }
            working = false
        }
    }
}

private struct JoinTeamSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var checking = false
    @State private var link = ""
    @State private var joining = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Gabung tim").font(.title3.bold())
            VStack(alignment: .leading, spacing: 12) {
                row(1, "Buka halaman Gabung tim", "Masuk dengan akun Google yang diundang (\(model.accountEmail ?? "-")), lalu pilih file tim.") {
                    Button { openURL(TeamLinks.joinPage) } label: { Label("Buka halaman", systemImage: "safari") }
                        .buttonStyle(SecondaryButtonStyle())
                }
                row(2, "Kembali ke sini", "Undangan yang sudah kamu pilih muncul di bawah.") {
                    Button {
                        checking = true
                        Task { await model.refreshInvites(); checking = false }
                    } label: { Label(checking ? "Mengecek…" : "Cek undangan", systemImage: "arrow.clockwise") }
                        .buttonStyle(SecondaryButtonStyle()).disabled(checking)
                }
            }
            if !model.teamInvites.isEmpty {
                VStack(spacing: 6) {
                    ForEach(model.teamInvites, id: \.fileId) { inv in InviteRow(invite: inv) }
                }
            }
            Divider()
            Text("Atau tempel link / ID file tim dari halaman Gabung tim:").font(.callout).foregroundStyle(.secondary)
            HStack(spacing: 8) {
                TextField("https://drive.google.com/file/d/…", text: $link).djieField()
                Button(joining ? "Bergabung…" : "Gabung") {
                    joining = true
                    Task {
                        if await model.joinTeam(fileId: link) { dismiss() }
                        joining = false
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(link.trimmingCharacters(in: .whitespaces).count < 10 || joining)
            }
            if let e = model.teamError {
                Text(e).font(.callout).foregroundStyle(.red).fixedSize(horizontal: false, vertical: true)
            }
            HStack {
                Spacer()
                Button("Tutup") { dismiss() }.buttonStyle(SecondaryButtonStyle()).keyboardShortcut(.cancelAction)
            }
        }
        .padding(24).frame(width: 520)
        .task { await model.refreshInvites() }
    }

    private func row<B: View>(_ n: Int, _ title: String, _ text: String, @ViewBuilder button: () -> B) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(n)").font(.system(size: 12, weight: .bold)).frame(width: 22, height: 22)
                .background(Theme.brandGradient, in: Circle()).foregroundStyle(.black.opacity(0.75))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 13, weight: .semibold))
                Text(text).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            button()
        }
    }
}

private struct ShareHostsSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let team: TeamInfo
    @State private var picked: Set<String> = []
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Host untuk \(team.name)").font(.title3.bold())
            Text("Anggota bisa connect ke host ini (termasuk password & SSH key-nya), tapi tidak bisa mengubahnya.")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            ScrollView {
                VStack(spacing: 4) {
                    ForEach(model.ownHosts) { h in
                        Button {
                            if picked.contains(h.id) { picked.remove(h.id) } else { picked.insert(h.id) }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: picked.contains(h.id) ? "checkmark.square.fill" : "square")
                                    .foregroundStyle(picked.contains(h.id) ? Theme.accent : .secondary)
                                RoundedRectangle(cornerRadius: 4).fill(Color(hex: h.color)).frame(width: 6, height: 20)
                                Text(h.title).font(.system(size: 13, weight: .medium))
                                if let g = h.group, !g.isEmpty { Text(g).font(.system(size: 11)).foregroundStyle(.tertiary) }
                                Spacer()
                            }
                            .padding(.horizontal, 10).padding(.vertical, 7)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(height: 300)
            .background(Theme.ink.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
            HStack {
                Text("\(picked.count) dipilih").font(.callout).foregroundStyle(.secondary)
                Spacer()
                Button("Batal") { dismiss() }.buttonStyle(SecondaryButtonStyle()).keyboardShortcut(.cancelAction)
                Button(saving ? "Menyimpan…" : "Simpan") {
                    saving = true
                    Task {
                        await model.shareHosts(team, ids: Array(picked))
                        saving = false
                        dismiss()
                    }
                }
                .buttonStyle(PrimaryButtonStyle()).keyboardShortcut(.defaultAction).disabled(saving)
            }
        }
        .padding(24).frame(width: 480)
        .onAppear { picked = Set(team.sharedHostIds) }
    }
}
