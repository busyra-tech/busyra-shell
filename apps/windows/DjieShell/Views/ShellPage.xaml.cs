using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media.Animation;

namespace DjieShell.Views;

public sealed partial class ShellPage : Page
{
    public ShellPage()
    {
        InitializeComponent();
        ContentFrame.Navigate(typeof(HostsPage));
    }

    private void Nav_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        var tag = (args.SelectedItem as NavigationViewItem)?.Tag as string;
        if (tag == "lock") { App.State.Lock(); return; }
        var page = tag switch
        {
            "hosts" => typeof(HostsPage),
            _ => typeof(ComingSoonPage),
        };
        ContentFrame.Navigate(page, (args.SelectedItem as NavigationViewItem)?.Content, new EntranceNavigationTransitionInfo());
    }
}
