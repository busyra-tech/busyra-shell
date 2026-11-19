using System;
using System.Reflection;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media.Animation;
using DjieShell.Views;

namespace DjieShell;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(TitleBar);
        AppWindow.SetIcon("Assets/djie.ico");
        AppWindow.Resize(new Windows.Graphics.SizeInt32(1240, 800));
        if (AppWindow.Presenter is OverlappedPresenter p) { p.PreferredMinimumWidth = 940; p.PreferredMinimumHeight = 600; }
        VersionText.Text = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.1.0";

        // Perubahan state bisa datang dari thread lain → kembali ke UI thread
        App.State.Changed += () => DispatcherQueue.TryEnqueue(Route);
#if DEBUG
        if (Environment.GetEnvironmentVariable("DJIE_DEMO") == "1") LoadDemo();
#endif
        Route();
    }

#if DEBUG
    /// Vault contoh untuk tes tampilan (hanya build debug, folder DJIE_DATA_DIR).
    private static void LoadDemo()
    {
        if (App.State.HasVault) App.State.Unlock("demo-password-123");
        else App.State.Create("demo-password-123");
        if (App.State.Hosts.Length > 0) return;
        var samples = new[] {
            ("prod-api", "10.0.1.10", "ubuntu", "#3FD0B4"), ("prod-db", "10.0.1.20", "postgres", "#F0616D"),
            ("staging", "staging.djie.local", "deploy", "#5B9CF5"), ("homelab", "192.168.1.5", "pi", "#9D7CF2"),
            ("vpn-gateway", "vpn.djie.id", "root", "#F59E0B"),
        };
        foreach (var (label, host, user, color) in samples)
            App.State.Save(AppState.BlankHost() with { Label = label, Hostname = host, Username = user, Color = color });
    }
#endif

    /// Terkunci → halaman kunci; terbuka → shell utama.
    private void Route()
    {
        var target = App.State.Vault == null ? typeof(LockPage) : typeof(ShellPage);
        if (RootFrame.CurrentSourcePageType != target)
            RootFrame.Navigate(target, null, new DrillInNavigationTransitionInfo());
    }
}
