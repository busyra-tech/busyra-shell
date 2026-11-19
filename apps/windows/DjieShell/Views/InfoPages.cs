using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.UI.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using uniffi.djie_core;

namespace DjieShell.Views;

/// <summary>Server yang sudah dipercaya (%USERPROFILE%\.ssh\known_hosts).</summary>
internal sealed class KnownHostsPage : PageBase
{
    private readonly StackPanel _list = Ui.Col(8);
    private string _query = "";

    public KnownHostsPage() : base("data")
    {
        var header = Ui.Header("Known Hosts", "Fingerprint server yang sudah dipercaya — %USERPROFILE%\\.ssh\\known_hosts",
            Ui.Search("Cari host…", "", q => { _query = q; Render(); }, 180),
            Ui.IconBtn(G.Refresh, "Muat ulang", Render).With(b => b.Background = Theme.Ink(0.07)));
        Children.Add(Ui.Scroll(Ui.Col(22, header, _list)));
        Render();
    }

    protected override void Render()
    {
        _list.Children.Clear();
        var entries = KnownHostsFile.Read();
        if (entries.Count == 0)
        {
            _list.Children.Add(Ui.EmptyState(G.Fingerprint, "Belum ada known host", "Fingerprint server otomatis tercatat di sini saat pertama kali kamu connect."));
            return;
        }
        var q = _query.ToLowerInvariant();
        var shown = entries.Where(e => q.Length == 0 || e.Hosts.ToLowerInvariant().Contains(q) || e.KeyType.ToLowerInvariant().Contains(q)).ToList();
        for (int i = 0; i < shown.Count; i++)
        {
            var e = shown[i];
            var icon = new Border { Width = 34, Height = 34, CornerRadius = new CornerRadius(9), Background = Theme.Ink(0.06), Child = new FontIcon { Glyph = G.Fingerprint, FontSize = 17, Foreground = Theme.BrandGradient } };
            var info = Ui.Col(3, Ui.Row(8, Ui.Text(e.Display(M.HideAddresses), 13, FontWeights.SemiBold), Ui.Badge(e.ShortType, Theme.Accent2)),
                Ui.Text(e.Fingerprint, 11, fg: Theme.Text2, mono: true).With(t => { t.IsTextSelectionEnabled = true; t.TextTrimming = TextTrimming.CharacterEllipsis; }));
            var del = Ui.IconBtn(G.Delete, "Hapus dari known hosts", async () =>
            {
                if (!await Ui.Confirm("Hapus fingerprint ini?", "Saat connect berikutnya, fingerprint server akan dicatat ulang. Hapus hanya jika kamu yakin server memang berganti kunci.")) return;
                try { KnownHostsFile.Remove(e.Line); M.Flash("Fingerprint dihapus"); } catch (Exception ex) { M.Flash(ex.Message); }
                Render();
            }, Theme.Brush("#E5484D"));
            var card = Ui.HoverCard(Ui.Columns("Auto,*,Auto", 12, icon, info, del), 12);
            _list.Children.Add(card);
            Ui.StaggerIn(card, i);
        }
    }
}

/// <summary>Riwayat sesi SSH: kapan, ke mana, berapa lama, dan hasilnya.</summary>
internal sealed class LogsPage : PageBase
{
    private readonly StackPanel _list = Ui.Col(18);
    private static readonly CultureInfo Id = new("id-ID");

    public LogsPage() : base("data", "logs", "sessions")
    {
        var clear = Ui.Secondary("Bersihkan", G.Delete, async () =>
        {
            if (await Ui.Confirm("Hapus semua riwayat sesi?", "Riwayat di semua perangkat yang tersinkron ikut terhapus.", "Hapus semua")) M.ClearLogs();
        });
        var header = Ui.Header("Logs", "Riwayat sesi SSH di semua perangkat yang tersinkron", clear);
        Children.Add(Ui.Scroll(Ui.Col(22, header, _list)));
        Render();
    }

    protected override void Render()
    {
        _list.Children.Clear();
        if (M.Logs.Length == 0)
        {
            _list.Children.Add(Ui.EmptyState(G.Clock, "Belum ada riwayat", "Setiap sesi SSH yang kamu buka akan tercatat di sini."));
            return;
        }
        int n = 0;
        foreach (var day in M.Logs.GroupBy(l => Ui.FromMs(l.StartedAt).LocalDateTime.Date).OrderByDescending(g => g.Key))
        {
            var title = day.Key == DateTime.Today ? "Hari ini" : day.Key == DateTime.Today.AddDays(-1) ? "Kemarin" : day.Key.ToString("dddd, d MMMM yyyy", Id);
            var col = Ui.Col(6, Ui.Caps(title));
            foreach (var l in day)
            {
                var row = Row(l);
                col.Children.Add(row);
                Ui.StaggerIn(row, n++);
            }
            _list.Children.Add(col);
        }
    }

    private FrameworkElement Row(SessionLog l)
    {
        var host = M.HostById(l.HostId);
        (string text, string color) status;
        if (l.EndedAt == null)
        {
            var live = M.Sessions.Any(s => s.Host.Id == l.HostId && s.State != TerminalSession.Status.Connecting);
            status = live ? ("Berjalan", Theme.Green) : ("Terputus", "#94A3B8");
        }
        else status = l.ExitCode switch
        {
            0 => ("Selesai", Theme.Accent),
            255 => ("Gagal connect", Theme.Orange),
            int c => ($"Keluar ({c})", "#EAB308"),
            null => ("Ditutup", "#94A3B8"),
        };
        var start = Ui.FromMs(l.StartedAt);
        var end = l.EndedAt is { } e ? Ui.FromMs(e) : DateTimeOffset.Now;
        var secs = Math.Max(0, (end - start).TotalSeconds);
        var dur = secs >= 3600 ? $"{(int)(secs / 3600)}j {(int)(secs % 3600 / 60)}m" : $"{(int)(secs / 60)}m {(int)(secs % 60)}d";
        var addr = l.Address;
        if (M.HideAddresses && addr.IndexOf('@') is var at and >= 0) addr = addr[..(at + 1)] + "••••••••";
        var dot = new Border { Width = 10, Height = 10, CornerRadius = new CornerRadius(5), Background = Theme.Brush(host?.Color ?? "#94A3B8") };
        var info = Ui.Col(2, Ui.Text(l.HostLabel, 13, FontWeights.SemiBold), Ui.Text(addr, 11, fg: Theme.Text2, mono: true));
        var time = Ui.Text(start.LocalDateTime.ToString("HH.mm", Id), 12, fg: Theme.Text2);
        var duration = Ui.Text(dur, 12, fg: Theme.Text2, mono: true).With(t => { t.Width = 70; t.TextAlignment = TextAlignment.Right; });
        var badge = new Border { Width = 110, Child = Ui.Badge(status.text, status.color).With(b => b.HorizontalAlignment = HorizontalAlignment.Right) };
        UIElement? again = host == null ? null : Ui.IconBtn(G.Bolt, "Connect lagi", () => M.Connect([host.Id]), Theme.AccentBrush);
        return Ui.HoverCard(Ui.Columns("Auto,*,Auto,Auto,Auto,Auto", 12, dot, info, time, duration, badge, again ?? new Border { Width = 30 }), 12);
    }
}

/// <summary>Profil akun, status sync, Windows Hello, kunci & keluar.</summary>
internal sealed class AccountPage : PageBase
{
    private readonly StackPanel _body = Ui.Col(18);

    public AccountPage() : base("data", "sync")
    {
        Children.Add(Ui.Scroll(_body));
        Render();
    }

    protected override void Render()
    {
        _body.Children.Clear();
        _body.MaxWidth = 720;
        _body.HorizontalAlignment = HorizontalAlignment.Left;

        // Profil
        var avatar = Ui.Avatar(M.ProfileName, M.AccountEmail, 64);
        var name = Ui.Col(3, Ui.Text(M.ProfileName ?? M.AccountEmail ?? "Tanpa akun", 22, FontWeights.Bold),
            Ui.Secondary(M.AccountEmail ?? "Data hanya tersimpan di PC ini. Hubungkan Google untuk sync antar perangkat.", 13, true));
        _body.Children.Add(Ui.Card(Ui.Columns("Auto,*", 16, avatar, name), 20, 16));

        // Statistik
        var stats = new Grid { ColumnSpacing = 10 };
        (string label, int value, string glyph, string tint)[] items =
        [
            ("Host", M.Hosts.Length, G.Server, "#3B82F6"), ("SSH key", M.Keys.Length, G.Key, "#F59E0B"),
            ("Snippet", M.Snippets.Length, G.Code, "#8B5CF6"), ("Database", M.Databases.Length, G.Database, "#F97316"),
        ];
        for (int i = 0; i < items.Length; i++)
        {
            stats.ColumnDefinitions.Add(new ColumnDefinition());
            var it = items[i];
            var c = Ui.Card(Ui.Col(6, Ui.TintIcon(it.glyph, it.tint, 26, 12), Ui.Text(it.value.ToString(), 20, FontWeights.Bold), Ui.Secondary(it.label, 12)), 14, 12);
            Grid.SetColumn(c, i);
            stats.Children.Add(c);
        }
        _body.Children.Add(stats);

        // Sync
        var syncCol = Ui.Col(10, Ui.Text("Sync Google Drive", 15, FontWeights.SemiBold));
        if (M.AccountEmail == null)
        {
            syncCol.Children.Add(Ui.Secondary("Vault terenkripsi disimpan di folder tersembunyi Google Drive milikmu (appDataFolder). Google tidak bisa membacanya.", 12.5, true));
            syncCol.Children.Add(Ui.Primary("Hubungkan Google Drive", G.Cloud, () => _ = Connect()).With(b => b.HorizontalAlignment = HorizontalAlignment.Left));
        }
        else
        {
            var st = Ui.Row(8, Ui.Icon(M.Sync is SyncKind.Failed or SyncKind.NeedsLogin ? G.Warning : G.Cloud, 14,
                M.Sync is SyncKind.Failed or SyncKind.NeedsLogin ? Theme.Brush(Theme.Orange) : Theme.AccentBrush), Ui.Text(M.SyncStatusText, 13));
            syncCol.Children.Add(st);
            if (M.SyncError is { } err) syncCol.Children.Add(Ui.Text(err, 12, fg: Theme.Brush(Theme.Orange), wrap: true));
            var row = Ui.Row(8);
            if (M.Sync == SyncKind.NeedsLogin) row.Children.Add(Ui.Primary("Masuk ulang Google", G.Globe, () => _ = Connect()));
            else row.Children.Add(Ui.Secondary("Sinkronkan sekarang", G.Sync, M.SyncNow));
            row.Children.Add(Ui.Secondary("Putuskan akun Google", null, M.DisconnectGoogle, Theme.Brush("#E5484D")));
            syncCol.Children.Add(row);
        }
        _body.Children.Add(Ui.Card(syncCol, 18, 14));

        // Keamanan
        var hello = new ToggleSwitch { IsOn = HelloUnlock.HasStoredKey, OnContent = "", OffContent = "", MinWidth = 0, IsEnabled = false };
        _ = EnableHelloToggle(hello);
        hello.Toggled += (_, _) => { if (hello.IsOn != HelloUnlock.HasStoredKey) M.EnableHello(hello.IsOn); };
        var helloRow = Ui.Columns("Auto,*,Auto", 12, Ui.Icon(G.Hello, 18, Theme.AccentBrush),
            Ui.Col(1, Ui.Text("Buka dengan Windows Hello", 13, FontWeights.Medium), Ui.Secondary("Kunci vault disimpan di Credential Manager PC ini", 11.5)), hello);
        var lockBtn = Ui.Secondary("Kunci vault sekarang  (Ctrl+Shift+L)", G.Lock, M.Lock).With(b => b.HorizontalAlignment = HorizontalAlignment.Left);
        _body.Children.Add(Ui.Card(Ui.Col(12, Ui.Text("Keamanan", 15, FontWeights.SemiBold), helloRow, lockBtn), 18, 14));

        // Keluar
        var outCol = Ui.Col(10, Ui.Text("Keluar", 15, FontWeights.SemiBold),
            Ui.Secondary("Keluar memutus login Google dan mengunci vault. Pilih hapus jika PC ini bukan milikmu.", 12.5, true),
            Ui.Row(8,
                Ui.Secondary("Keluar", G.SignOut, async () => { if (await Ui.Confirm("Keluar dari akun?", "Vault dikunci dan login Google diputus. Data tetap terenkripsi di PC ini.", "Keluar", false)) M.SignOut(false); }),
                Ui.Secondary("Keluar & hapus data dari PC ini", G.Delete, async () =>
                {
                    if (await Ui.Confirm("Hapus semua data dari PC ini?", "Vault lokal dan kunci Windows Hello dihapus. Salinan di Google Drive tidak dihapus, jadi bisa dipulihkan dengan login lagi.", "Hapus & keluar"))
                        M.SignOut(true);
                }, Theme.Brush("#E5484D"))));
        _body.Children.Add(Ui.Card(outCol, 18, 14));
        Ui.StaggerIn(_body, 0);
    }

    private static async Task EnableHelloToggle(ToggleSwitch t) => t.IsEnabled = await HelloUnlock.IsAvailable() || HelloUnlock.HasStoredKey;

    private async Task Connect()
    {
        try { await M.SignInGoogle(); }
        catch (AuthCancelledException) { }
        catch (Exception e) { M.Flash(Errors.Text(e)); }
    }
}

/// <summary>Tentang Djie Shell.</summary>
internal sealed class AboutPage : PageBase
{
    public AboutPage() : base("update")
    {
        Render();
    }

    protected override void Render()
    {
        Children.Clear();
        var logo = new Image { Source = new BitmapImage(new Uri("ms-appx:///Assets/logo.png")), Width = 96, Height = 96 };
        var title = Ui.Text("Djie Shell", 34, FontWeights.ExtraBold).With(t => t.HorizontalAlignment = HorizontalAlignment.Center);
        var tagline = Ui.Text("Semua servermu, satu terminal.", 14, fg: Theme.Text2, mono: true).With(t => t.HorizontalAlignment = HorizontalAlignment.Center);
        var badges = Ui.Row(8, Ui.Badge($"VERSI {Config.Version}"), Ui.Badge($"CORE {uniffi.djie_core.DjieCoreMethods.CoreVersion()}", Theme.Accent2), Ui.Badge("MIT", Theme.Accent3));
        badges.HorizontalAlignment = HorizontalAlignment.Center;
        var desc = Ui.Secondary("SSH client native untuk Windows & macOS — gratis, tanpa iklan, tanpa server. Host, SSH key, dan snippet dienkripsi di perangkatmu dan tersinkron lewat Google Drive milikmu sendiri.", 13.5, true)
            .With(t => { t.TextAlignment = TextAlignment.Center; t.MaxWidth = 540; t.HorizontalAlignment = HorizontalAlignment.Center; });
        var links = Ui.Row(10,
            Ui.Secondary("Website", G.Globe, () => Ui.Open(Config.Website)),
            Ui.Secondary("GitHub", G.Code, () => Ui.Open(Config.GitHub)),
            Ui.Secondary("Catatan rilis", G.Sparkle, () => Ui.Open(Config.Releases)),
            Ui.Secondary("Laporkan bug", G.Bug, () => Ui.Open(Config.Issues)));
        links.HorizontalAlignment = HorizontalAlignment.Center;

        UIElement update = M.Update is { } u
            ? Ui.Row(10, Ui.Icon(G.Sparkle, 14, Theme.BrandGradient), Ui.Text($"Versi {u.Version} tersedia", 13, FontWeights.SemiBold), Ui.Primary("Download", G.Download, () => Ui.Open(u.Download ?? u.Page)))
            : Ui.Row(10, Ui.Icon(G.Check, 14, Theme.AccentBrush), Ui.Text("Kamu memakai versi terbaru yang diketahui", 13), Ui.Secondary("Periksa", null, () => _ = M.CheckForUpdates(true)));
        if (update is FrameworkElement fu) fu.HorizontalAlignment = HorizontalAlignment.Center;

        var info = Ui.Col(0,
            InfoRow("Dibuat oleh", "Adjie Kurniawan"), InfoRow("Antarmuka", "WinUI 3 (native Windows)"),
            InfoRow("Inti", "djie-core · Rust (vault, sync, keychain)"), InfoRow("Enkripsi", "Argon2id + XChaCha20-Poly1305"),
            InfoRow("Terminal", "xterm.js · ConPTY · OpenSSH"), InfoRow("Sync", "Google Drive (appDataFolder), zero-knowledge", true));
        var infoCard = Ui.Card(info, 4).With(c => { c.MaxWidth = 560; c.HorizontalAlignment = HorizontalAlignment.Center; });
        var legal = Ui.Row(14,
            Ui.Plain(Ui.Text("Kebijakan Privasi", 12, fg: Theme.AccentBrush), () => Ui.Open(Config.Privacy)),
            Ui.Plain(Ui.Text("Syarat Layanan", 12, fg: Theme.AccentBrush), () => Ui.Open(Config.Terms)));
        legal.HorizontalAlignment = HorizontalAlignment.Center;
        var copy = Ui.Text("© 2026 Adjie Kurniawan · Lisensi MIT", 11, fg: Theme.Text3).With(t => t.HorizontalAlignment = HorizontalAlignment.Center);

        var col = Ui.Col(18, logo, title, tagline, badges, desc, links, update, infoCard, legal, copy);
        col.Padding = new Thickness(0, 24, 0, 24);
        for (int i = 0; i < col.Children.Count; i++) Ui.StaggerIn(col.Children[i], i);
        Children.Add(Ui.Scroll(col));
    }

    private static UIElement InfoRow(string label, string value, bool last = false) => new Border
    {
        Padding = new Thickness(14, 11, 14, 11), BorderBrush = Theme.Ink(0.06), BorderThickness = new Thickness(0, 0, 0, last ? 0 : 1),
        Child = Ui.Columns("140,*", 10, Ui.Text(label, 13, fg: Theme.Text2), Ui.Text(value, 13, FontWeights.Medium))
    };
}

/// <summary>Donasi lewat QRIS.</summary>
internal sealed class DonatePage : PageBase
{
    public DonatePage() : base()
    {
        Render();
    }

    protected override void Render()
    {
        Children.Clear();
        var qr = new Border
        {
            Background = Theme.Brush("#FFFFFF"), CornerRadius = new CornerRadius(18), Padding = new Thickness(12), Width = 294,
            Child = new Image { Source = new BitmapImage(new Uri("ms-appx:///Assets/qris.png")), Stretch = Stretch.Uniform }
        };
        Ui.Float(qr);
        var qrCol = Ui.Col(10, qr, Ui.Columns("*,Auto", 8, Ui.Text("Ruang Kiitaa", 10, fg: Theme.Text2, mono: true), Ui.Text("NMID ID1026525837765", 10, fg: Theme.Text2, mono: true)).With(g => g.Width = 294));

        var heading = new TextBlock { Text = "Traktir kopi\npembuatnya.", FontSize = 40, FontWeight = FontWeights.ExtraBold, LineHeight = 44, Foreground = Theme.Text };
        var para = new TextBlock { TextWrapping = TextWrapping.WrapWholeWords, Foreground = Theme.Text2, FontSize = 13.5 };
        para.Inlines.Add(new Microsoft.UI.Xaml.Documents.Run { Text = "Djie Shell dibuat oleh " });
        para.Inlines.Add(new Microsoft.UI.Xaml.Documents.Bold { Inlines = { new Microsoft.UI.Xaml.Documents.Run { Text = "Adjie Kurniawan" } } });
        para.Inlines.Add(new Microsoft.UI.Xaml.Documents.Run { Text = " dan dibagikan gratis. Donasi membantu fitur berikutnya lahir lebih cepat." });
        UIElement Step(int n, string t) => Ui.Columns("Auto,*", 10, Ui.Text($"{n}.", 12, fg: Theme.AccentBrush, mono: true), Ui.Secondary(t, 13, true));
        var steps = Ui.Col(10,
            Step(1, "Buka aplikasi bank atau e-wallet berlogo QRIS: GoPay, OVO, DANA, ShopeePay, atau m-banking."),
            Step(2, "Scan kode QRIS dan isi nominal seikhlasnya."),
            Step(3, "Kirim bukti transfer ke nomor di bawah."));
        Button copyBtn = null!;
        copyBtn = Ui.Secondary("Salin nomor", G.Copy, () =>
        {
            Ui.CopyText(Config.DonateNumberDisplay.Replace("-", ""));
            copyBtn.Content = Ui.Row(7, Ui.Icon(G.Check, 13), Ui.Text("Tersalin!", 13, FontWeights.SemiBold));
            _ = Task.Delay(1600).ContinueWith(_ => DispatcherQueue.TryEnqueue(() => copyBtn.Content = Ui.Row(7, Ui.Icon(G.Copy, 13), Ui.Text("Salin nomor", 13, FontWeights.SemiBold))));
        });
        var confirm = Ui.Card(Ui.Col(10,
            Ui.Text("KONFIRMASI DONASI", 10, FontWeights.SemiBold, Theme.Text2, mono: true).With(t => t.CharacterSpacing = 150),
            Ui.Text(Config.DonateNumberDisplay, 30, FontWeights.ExtraBold).With(t => t.IsTextSelectionEnabled = true),
            Ui.Row(8, Ui.Primary("Chat WhatsApp", G.Chat, () => Ui.Open($"https://wa.me/{Config.DonateWhatsApp}")), copyBtn)), 16);
        var right = Ui.Col(16,
            Ui.Text("DONASI", 11, FontWeights.SemiBold, Theme.AccentBrush, mono: true).With(t => t.CharacterSpacing = 200),
            heading, para, steps, confirm);
        right.MaxWidth = 440;
        var row = Ui.Row(44, qrCol, right);
        row.HorizontalAlignment = HorizontalAlignment.Center;
        row.VerticalAlignment = VerticalAlignment.Center;
        row.Padding = new Thickness(40);
        Ui.StaggerIn(qrCol, 0);
        Ui.StaggerIn(right, 2);
        Children.Add(new ScrollViewer { Content = row, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
    }
}
