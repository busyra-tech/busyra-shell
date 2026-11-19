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
        Route();
    }

    /// Terkunci → halaman kunci; terbuka → shell utama.
    private void Route()
    {
        var target = App.State.Vault == null ? typeof(LockPage) : typeof(ShellPage);
        if (RootFrame.CurrentSourcePageType != target)
            RootFrame.Navigate(target, null, new DrillInNavigationTransitionInfo());
    }
}
