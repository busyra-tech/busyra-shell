using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.UI;
using Microsoft.UI.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;

namespace DjieShell.Views;

/// <summary>Dasar halaman: render ulang saat kategori perubahan tertentu terjadi.</summary>
internal abstract class PageBase : Grid
{
    protected readonly AppModel M = App.Model;
    private readonly HashSet<string> _watch;
    private bool _subscribed;

    protected PageBase(params string[] watch)
    {
        _watch = [.. watch];
        Subscribe();
        Loaded += (_, _) => Subscribe();
        Unloaded += (_, _) => { if (_subscribed) { M.Changed -= OnChange; _subscribed = false; } };
    }

    private void Subscribe()
    {
        if (_subscribed) return;
        M.Changed += OnChange;
        _subscribed = true;
    }

    private void OnChange(string what) { if (_watch.Contains(what)) OnModelChanged(what); }

    protected virtual void OnModelChanged(string what) => Render();

    protected abstract void Render();
}

/// <summary>Jendela utama setelah vault terbuka: sidebar, strip tab, konten, inspector host.</summary>
internal sealed class ShellPage : Grid
{
    private readonly AppModel M = App.Model;
    private readonly Border _sidebar = new();
    private readonly Border _tabStrip = new() { Height = 44 };
    private readonly Grid _content = new();
    private readonly Grid _terminals = new();
    private readonly Border _inspector = new() { Width = 392 };
    private readonly Border _toast = new()
    {
        HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Bottom,
        Margin = new Thickness(0, 0, 0, 26), Padding = new Thickness(16, 9, 16, 10), CornerRadius = new CornerRadius(20),
        Visibility = Visibility.Collapsed, IsHitTestVisible = false
    };
    private readonly Action<string> _onChange;
    private Section? _shownSection;
    private bool _shownHome = true;

    public ShellPage()
    {
        ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(236) });
        ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        SetColumn(_sidebar, 0);
        var main = Ui.Rows("Auto,*", 0, _tabStrip, new Grid { Children = { _content, _terminals } });
        SetColumn(main, 1);
        SetColumn(_inspector, 2);
        Children.Add(_sidebar);
        Children.Add(main);
        Children.Add(_inspector);
        var toastLayer = new Grid { IsHitTestVisible = false, Children = { _toast } };
        SetColumnSpan(toastLayer, 3);
        Children.Add(toastLayer);

        _onChange = OnChange;
        M.Changed += _onChange;
        Retheme();
        SyncTerminals();
    }

    public void Detach() => M.Changed -= _onChange;

    /// <summary>Gambar ulang semua bagian (mis. setelah ganti tema terang/gelap). View terminal tidak dibuat ulang.</summary>
    public void Retheme()
    {
        Background = Theme.Bg;
        _sidebar.Background = Theme.Panel;
        _sidebar.BorderBrush = Theme.Ink(0.06);
        _sidebar.BorderThickness = new Thickness(0, 0, 1, 0);
        _inspector.Background = Theme.Panel;
        _inspector.BorderBrush = Theme.Ink(0.07);
        _inspector.BorderThickness = new Thickness(1, 0, 0, 0);
        _toast.Background = Theme.Dark ? Theme.Brush("#1B222C", 0.97) : Theme.Brush("#FFFFFF", 0.98);
        _toast.BorderBrush = Theme.Ink(0.1);
        _toast.BorderThickness = new Thickness(1);
        _shownSection = null;
        RenderSidebar();
        RenderTabs();
        RenderContent();
        RenderInspector();
        foreach (var s in M.Sessions) if (s.ThemeId == null) s.PushTheme();
    }

    private void OnChange(string what)
    {
        switch (what)
        {
            case "theme": Retheme(); break;
            case "nav": RenderSidebar(); RenderTabs(); RenderContent(); break;
            case "data": case "sync": case "update": RenderSidebar(); RenderTabs(); break;
            case "sessions": SyncTerminals(); RenderTabs(); RenderContent(); break;
            case "session": RenderTabs(); break;
            case "editing": RenderInspector(); break;
            case "toast": RenderToast(); break;
            case "db": if (M.Section == Section.Database) { _shownSection = null; RenderContent(); } break;
        }
    }

    // MARK: Sidebar

    private void RenderSidebar()
    {
        var logo = new Image { Source = new Microsoft.UI.Xaml.Media.Imaging.BitmapImage(new Uri("ms-appx:///Assets/logo.png")), Width = 34, Height = 34 };
        var version = new Border
        {
            Background = Theme.Brush(Theme.Accent, 0.14), CornerRadius = new CornerRadius(8), Padding = new Thickness(5, 0, 5, 1),
            Child = new TextBlock { Text = Config.Version, FontSize = 9.5, FontFamily = Theme.MonoFont, FontWeight = FontWeights.SemiBold, Foreground = Theme.AccentBrush }
        };
        var name = Ui.Col(1, Ui.Text("Djie Shell", 15, FontWeights.Bold), Ui.Row(5, Ui.Text("SSH Client", 10.5, fg: Theme.Text2), version));
        var header = Ui.Columns("Auto,*,Auto", 10, logo, name, AppearanceButton());
        header.Margin = new Thickness(16, 2, 10, 16);

        var list = Ui.Col(3);
        list.Children.Add(Ui.Caps("Workspace").With(t => t.Margin = new Thickness(10, 0, 0, 4)));
        foreach (var s in SectionInfo.Main) list.Children.Add(SidebarRow(s));
        list.Children.Add(Ui.Caps("Komunitas").With(t => t.Margin = new Thickness(10, 14, 0, 4)));
        foreach (var s in SectionInfo.Community) list.Children.Add(SidebarRow(s));
        var scroll = new ScrollViewer { Content = list, Padding = new Thickness(10, 0, 10, 0), VerticalScrollBarVisibility = ScrollBarVisibility.Hidden };

        var bottom = Ui.Col(0);
        if (M.Update is { } u && !M.UpdateDismissed) bottom.Children.Add(UpdateCard(u));
        bottom.Children.Add(AccountFooter());

        _sidebar.Child = Ui.Rows("Auto,*,Auto", 0, header, scroll, bottom);
    }

    private int Badge(Section s) => s switch
    {
        Section.Hosts => M.Hosts.Length, Section.Keychain => M.Keys.Length, Section.Snippets => M.Snippets.Length,
        Section.Forwarding => M.Forwards.Length, Section.Database => M.Databases.Length, _ => 0,
    };

    private UIElement SidebarRow(Section s)
    {
        var selected = M.ActiveSessionId == null && M.Section == s;
        var icon = Ui.TintIcon(s.Glyph(), s.Tint());
        var title = Ui.Text(s.Title(), 13, selected ? FontWeights.SemiBold : FontWeights.Medium, selected ? Theme.Text : Theme.Text2);
        var n = Badge(s);
        UIElement? badge = n > 0 ? Ui.Pill(n.ToString()) : null;
        var row = Ui.Columns("Auto,*,Auto", 11, icon, title, badge);
        var bar = new Border { Width = 3, Height = 16, CornerRadius = new CornerRadius(2), Background = Theme.Brush(s.Tint()), HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(-8, 0, 0, 0), Visibility = selected ? Visibility.Visible : Visibility.Collapsed };
        var b = Ui.Plain(new Grid { Children = { row, bar } }, () => { M.Navigate(s); }, new Thickness(8, 6, 8, 6));
        b.Height = 38;
        b.HorizontalAlignment = HorizontalAlignment.Stretch;
        b.Background = selected ? Theme.Ink(0.09) : new SolidColorBrush(Colors.Transparent);
        b.CornerRadius = new CornerRadius(10);
        return b;
    }

    private Button AppearanceButton()
    {
        var glyph = M.Appearance switch { "light" => G.Sun, "system" => G.Contrast, _ => G.Moon };
        var b = Ui.IconBtn(glyph, "Tampilan", () => { });
        var f = new MenuFlyout();
        foreach (var (mode, title, g) in new[] { ("system", "Ikuti sistem", G.Contrast), ("light", "Terang", G.Sun), ("dark", "Gelap", G.Moon) })
        {
            var item = new ToggleMenuFlyoutItem { Text = title, IsChecked = M.Appearance == mode, Icon = new FontIcon { Glyph = g } };
            item.Click += (_, _) => M.SetAppearance(mode);
            f.Items.Add(item);
        }
        b.Flyout = f;
        return b;
    }

    private UIElement UpdateCard(AvailableUpdate u)
    {
        var close = Ui.IconBtn(G.Close, "Tutup", () => { M.UpdateDismissed = true; RenderSidebar(); }, size: 9);
        var top = Ui.Columns("Auto,*,Auto", 6, Ui.Icon(G.Sparkle, 13, Theme.BrandGradient), Ui.Text($"Versi {u.Version} tersedia", 12, FontWeights.SemiBold), close);
        var buttons = Ui.Row(6, Ui.Primary("Download", null, () => Ui.Open(u.Download ?? u.Page)), Ui.Secondary("Catatan", null, () => Ui.Open(u.Page)));
        return new Border
        {
            Margin = new Thickness(10, 8, 10, 0), Padding = new Thickness(12), CornerRadius = new CornerRadius(10),
            Background = Theme.Brush(Theme.Accent, 0.08), BorderBrush = Theme.Brush(Theme.Accent, 0.35), BorderThickness = new Thickness(1),
            Child = Ui.Col(8, top, Ui.Secondary($"Kamu memakai {Config.Version}.", 11), buttons)
        };
    }

    private UIElement AccountFooter()
    {
        var avatar = Ui.Avatar(M.ProfileName, M.AccountEmail, 30);
        var failed = M.Sync is SyncKind.Failed or SyncKind.NeedsLogin;
        var status = Ui.Text(M.SyncStatusText, 11, fg: failed ? Theme.Brush(Theme.Orange) : Theme.Text2);
        var text = Ui.Col(1, Ui.Text(M.ProfileName ?? M.AccountEmail ?? "Tanpa akun", 12, FontWeights.Medium), status);
        var menu = Ui.IconBtn(G.More, "Akun", () => { });
        var f = new MenuFlyout();
        void Item(string t, Action a) { var i = new MenuFlyoutItem { Text = t }; i.Click += (_, _) => a(); f.Items.Add(i); }
        if (M.AccountEmail == null) Item("Hubungkan Google Drive…", () => _ = ConnectGoogle());
        else if (M.Sync == SyncKind.NeedsLogin) Item("Masuk ulang Google…", () => _ = ConnectGoogle());
        else { Item("Sinkronkan sekarang", M.SyncNow); f.Items.Add(new MenuFlyoutSeparator()); Item("Putuskan akun Google", M.DisconnectGoogle); }
        f.Items.Add(new MenuFlyoutSeparator());
        Item("Lihat profil", () => M.Navigate(Section.Account));
        Item("Kunci vault", M.Lock);
        menu.Flyout = f;
        var row = Ui.Columns("Auto,*,Auto", 10, avatar, text, menu);
        var card = Ui.Plain(row, () => M.Navigate(Section.Account), new Thickness(12));
        card.Background = Theme.Ink(0.03);
        card.CornerRadius = new CornerRadius(10);
        card.Margin = new Thickness(10);
        card.HorizontalAlignment = HorizontalAlignment.Stretch;
        if (M.SyncError is { } err) ToolTipService.SetToolTip(card, err);
        return card;
    }

    private async System.Threading.Tasks.Task ConnectGoogle()
    {
        try { await M.SignInGoogle(); }
        catch (AuthCancelledException) { }
        catch (Exception e) { M.Flash(Errors.Text(e)); }
    }

    // MARK: Strip tab

    private void RenderTabs()
    {
        var home = TabChip(M.ActiveSessionId == null, Ui.Icon(G.Apps, 13), M.ShowHome, null);
        ToolTipService.SetToolTip(home, "Daftar host (Ctrl+Shift+0)");
        var tabs = Ui.Row(6);
        for (int i = 0; i < M.Sessions.Count; i++) tabs.Children.Add(SessionTab(M.Sessions[i], i));
        var tabScroll = new ScrollViewer
        {
            Content = tabs, HorizontalScrollBarVisibility = ScrollBarVisibility.Hidden, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled,
            HorizontalScrollMode = ScrollMode.Enabled, VerticalScrollMode = ScrollMode.Disabled
        };
        var right = Ui.Row(6);
        if (M.ActiveSessionId != null)
        {
            right.Children.Add(AutocompleteMenu());
            if (M.Snippets.Length > 0)
            {
                var sn = new DropDownButton { Content = Ui.Row(6, Ui.Icon(G.Code, 12), Ui.Text("Snippet", 12)), Background = new SolidColorBrush(Colors.Transparent), BorderThickness = new Thickness(0) };
                var f = new MenuFlyout();
                foreach (var s in M.Snippets)
                {
                    var item = new MenuFlyoutItem { Text = s.Label };
                    item.Click += (_, _) => M.RunInActiveSession(s);
                    f.Items.Add(item);
                }
                sn.Flyout = f;
                ToolTipService.SetToolTip(sn, "Jalankan snippet di tab ini");
                right.Children.Add(sn);
            }
        }
        // Terminal lokal: klik = shell bawaan, panah = pilih shell (pilihan diingat)
        var add = new SplitButton { Content = Ui.Icon(G.Add, 12), Padding = new Thickness(8, 4, 8, 4), Height = 30 };
        add.Click += (_, _) => M.OpenLocalTerminal();
        var addMenu = new MenuFlyout();
        foreach (var sh in LocalShell.Available)
        {
            var it = new MenuFlyoutItem { Text = sh.Name + (sh.Id == LocalShell.Default.Id ? "  (bawaan)" : "") };
            it.Click += (_, _) => { Settings.Set(Settings.LocalShell, sh.Id); M.OpenLocalTerminal(sh); };
            addMenu.Items.Add(it);
        }
        add.Flyout = addMenu;
        ToolTipService.SetToolTip(add, $"Terminal lokal — {LocalShell.Default.Name} (Ctrl+Shift+T)");
        var tabsAndAdd = Ui.Columns("Auto,Auto", 6, tabScroll, add);
        tabsAndAdd.HorizontalAlignment = HorizontalAlignment.Left;
        var strip = Ui.Columns("Auto,*,Auto", 6, home, tabsAndAdd, right);
        strip.Padding = new Thickness(10, 0, 10, 0);
        _tabStrip.Child = strip;
        _tabStrip.Background = Theme.Dark ? Theme.Brush("#0D1117") : Theme.Brush("#EEF1F5");
        _tabStrip.BorderBrush = Theme.Ink(0.07);
        _tabStrip.BorderThickness = new Thickness(0, 0, 0, 1);
    }

    private static Button TabChip(bool active, UIElement content, Action select, string? tip)
    {
        var b = Ui.Plain(content, select, new Thickness(10, 0, 10, 0));
        b.Height = 30;
        b.Background = active ? Theme.Ink(0.1) : new SolidColorBrush(Colors.Transparent);
        b.BorderBrush = active ? Theme.Ink(0.08) : new SolidColorBrush(Colors.Transparent);
        b.BorderThickness = new Thickness(1);
        if (tip != null) ToolTipService.SetToolTip(b, tip);
        return b;
    }

    private UIElement SessionTab(TerminalSession s, int index)
    {
        var active = M.ActiveSessionId == s.Id;
        var dot = new Border { Width = 7, Height = 7, CornerRadius = new CornerRadius(4) };
        dot.Background = s.State switch
        {
            TerminalSession.Status.Connected => Theme.Brush(Theme.Green),
            TerminalSession.Status.Connecting => Theme.Brush(s.Host.Color, 0.7),
            _ => Theme.Ink(0.3),
        };
        if (s.State == TerminalSession.Status.Connecting && !s.IsLocal) Ui.Pulse(dot);
        UIElement mark = s.IsLocal ? Ui.Icon(G.Terminal, 11, active ? Theme.Text : Theme.Text2) : dot;
        var title = Ui.Text(s.Title, 12, FontWeights.Medium, active ? Theme.Text : Theme.Text2).With(t => t.MaxWidth = 150);
        var close = Ui.IconBtn(G.Close, "Tutup tab (Ctrl+Shift+W)", () => M.Close(s), size: 8);
        close.Padding = new Thickness(4);
        close.Opacity = active ? 1 : 0.5;
        var tip = s.Host.DisplayAddress(M.HideAddresses) + (index < 9 ? $"  ·  Ctrl+Shift+{index + 1}" : "");
        if (s.IsLocal) tip = s.Local!.Name + (index < 9 ? $"  ·  Ctrl+Shift+{index + 1}" : "");
        var chip = TabChip(active, Ui.Row(7, mark, title, close), () => M.Activate(s), tip);
        var menu = new MenuFlyout();
        void Item(string t, Action a) { var i = new MenuFlyoutItem { Text = t }; i.Click += (_, _) => a(); menu.Items.Add(i); }
        Item(s.IsLocal ? "Buka ulang" : "Sambung ulang", s.Reconnect);
        Item("Duplikat tab", () => { if (s.Local is { } l) M.OpenLocalTerminal(l); else M.Connect([s.Host.Id]); });
        if (!s.IsLocal) Item("Buka SFTP", () => _ = M.OpenSftp(s.Host));
        menu.Items.Add(new MenuFlyoutSeparator());
        Item("Tutup", () => M.Close(s));
        chip.ContextFlyout = menu;
        return chip;
    }

    private UIElement AutocompleteMenu()
    {
        var on = Settings.Bool(Settings.Autocomplete, true);
        var b = new DropDownButton
        {
            Content = Ui.Row(6, Ui.Icon(on ? "" : "", 12, on ? Theme.AccentBrush : Theme.Text2), Ui.Text("Autocomplete", 12, fg: on ? Theme.AccentBrush : Theme.Text2)),
            Background = new SolidColorBrush(Colors.Transparent), BorderThickness = new Thickness(0)
        };
        var f = new MenuFlyout();
        var toggle = new ToggleMenuFlyoutItem { Text = "Saran perintah saat mengetik", IsChecked = on };
        toggle.Click += (_, _) => { Settings.Set(Settings.Autocomplete, toggle.IsChecked); M.PushAutocompleteConfig(); RenderTabs(); };
        var clear = new MenuFlyoutItem { Text = $"Hapus riwayat perintah ({CommandHistory.Count})", Icon = new FontIcon { Glyph = G.Delete } };
        clear.Click += async (_, _) =>
        {
            if (await Ui.Confirm("Hapus semua riwayat perintah?", "Riwayat hanya tersimpan di PC ini dan dipakai untuk saran autocomplete."))
            { CommandHistory.Clear(); M.PushAutocompleteConfig(); }
        };
        f.Items.Add(toggle); f.Items.Add(new MenuFlyoutSeparator()); f.Items.Add(clear);
        b.Flyout = f;
        ToolTipService.SetToolTip(b, "Saran perintah dari riwayat, snippet, dan perintah umum");
        return b;
    }

    // MARK: Konten

    private void SyncTerminals()
    {
        // Tambahkan view baru, buang view sesi yang sudah ditutup
        foreach (var s in M.Sessions)
            if (!_terminals.Children.Contains(s.View)) _terminals.Children.Add(s.View);
        foreach (var v in _terminals.Children.OfType<FrameworkElement>().ToList())
            if (!M.Sessions.Any(s => s.View == v)) _terminals.Children.Remove(v);
        foreach (var s in M.Sessions)
        {
            var active = s.Id == M.ActiveSessionId;
            s.View.Visibility = active ? Visibility.Visible : Visibility.Collapsed;
            if (active) s.Focus();
        }
        _terminals.Visibility = M.ActiveSessionId == null ? Visibility.Collapsed : Visibility.Visible;
    }

    private void RenderContent()
    {
        var home = M.ActiveSessionId == null;
        _terminals.Visibility = home ? Visibility.Collapsed : Visibility.Visible;
        foreach (var s in M.Sessions) s.View.Visibility = s.Id == M.ActiveSessionId ? Visibility.Visible : Visibility.Collapsed;
        _content.Visibility = home ? Visibility.Visible : Visibility.Collapsed;
        if (!home) { _shownHome = false; return; }
        if (_shownSection == M.Section && _shownHome && _content.Children.Count > 0) return;
        _shownSection = M.Section;
        _shownHome = true;
        FrameworkElement page = M.Section switch
        {
            Section.Hosts => new HostsPage(),
            Section.Keychain => new KeychainPage(),
            Section.Forwarding => new ForwardingPage(),
            Section.Sftp => new SftpPage(),
            Section.Database => new DatabasePage(),
            Section.Snippets => new SnippetsPage(),
            Section.KnownHosts => new KnownHostsPage(),
            Section.Logs => new LogsPage(),
            Section.Donate => new DonatePage(),
            Section.About => new AboutPage(),
            _ => new AccountPage(),
        };
        _content.Children.Clear();
        _content.Children.Add(page);
        var v = Microsoft.UI.Xaml.Hosting.ElementCompositionPreview.GetElementVisual(page);
        var a = v.Compositor.CreateScalarKeyFrameAnimation();
        a.InsertKeyFrame(0, 0); a.InsertKeyFrame(1, 1);
        a.Duration = TimeSpan.FromMilliseconds(220);
        v.StartAnimation("Opacity", a);
    }

    private void RenderInspector()
    {
        if (M.EditingHost is { } h)
        {
            var wasHidden = _inspector.Visibility == Visibility.Collapsed || _inspector.Child == null;
            _inspector.Child = new HostEditor(h);
            _inspector.Visibility = Visibility.Visible;
            if (wasHidden)
            {
                var v = Microsoft.UI.Xaml.Hosting.ElementCompositionPreview.GetElementVisual(_inspector);
                Microsoft.UI.Xaml.Hosting.ElementCompositionPreview.SetIsTranslationEnabled(_inspector, true);
                var a = v.Compositor.CreateVector3KeyFrameAnimation();
                a.InsertKeyFrame(0, new System.Numerics.Vector3(60, 0, 0)); a.InsertKeyFrame(1, System.Numerics.Vector3.Zero);
                a.Duration = TimeSpan.FromMilliseconds(260);
                v.StartAnimation("Translation", a);
            }
        }
        else
        {
            _inspector.Child = null;
            _inspector.Visibility = Visibility.Collapsed;
        }
    }

    private void RenderToast()
    {
        if (M.Toast is { } t)
        {
            _toast.Child = Ui.Row(8, Ui.Icon(G.Info, 13, Theme.AccentBrush), Ui.Text(t, 13, FontWeights.Medium).With(x => x.MaxWidth = 560));
            _toast.Visibility = Visibility.Visible;
            Ui.StaggerIn(_toast, 0);
        }
        else _toast.Visibility = Visibility.Collapsed;
    }
}
