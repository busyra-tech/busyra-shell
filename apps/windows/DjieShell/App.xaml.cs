using Microsoft.UI.Xaml;

namespace DjieShell;

public partial class App : Application
{
    public static MainWindow? Window { get; private set; }
    internal static AppState State { get; } = new();

    public App()
    {
        InitializeComponent();
        RequestedTheme = ApplicationTheme.Dark; // default gelap, sama seperti versi Mac
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        Window = new MainWindow();
        Window.Activate();
    }
}
