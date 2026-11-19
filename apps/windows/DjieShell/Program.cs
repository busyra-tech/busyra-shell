using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

namespace DjieShell;

public static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        // 1. Mode askpass: ssh.exe memanggil DjieShell.exe untuk meminta password/passphrase host.
        if (Environment.GetEnvironmentVariable("DJIE_ASKPASS") == "1")
        {
            var prompt = string.Join(" ", args);
            if (!Regex.IsMatch(prompt, "assword|assphrase|PIN", RegexOptions.IgnoreCase)) return 1;
            using var o = Console.OpenStandardOutput();
            var b = Encoding.UTF8.GetBytes((Environment.GetEnvironmentVariable("DJIE_SECRET") ?? "") + "\n");
            o.Write(b, 0, b.Length);
            return 0;
        }

        // 2. Redirect login Google dari browser: teruskan ke instance yang sedang jalan.
        if (args.FirstOrDefault(a => a.StartsWith(GoogleAuth.Scheme + ":", StringComparison.OrdinalIgnoreCase)) is { } url)
        {
            GoogleAuth.ForwardToRunningInstance(url);
            return 0;
        }

        // Data WebView2 di %LOCALAPPDATA% (folder app bisa saja read-only)
        Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", Path.Combine(Config.LocalDir, "WebView2"));
        SshCommand.CleanupStaleKeys();

        WinRT.ComWrappersSupport.InitializeComWrappers();
        Application.Start(p =>
        {
            SynchronizationContext.SetSynchronizationContext(new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread()));
            _ = new App();
        });
        return 0;
    }
}
