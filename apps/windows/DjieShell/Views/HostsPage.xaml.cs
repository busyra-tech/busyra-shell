using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Numerics;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Hosting;
using Microsoft.UI.Xaml.Media;
using uniffi.djie_core;
using Windows.UI;

namespace DjieShell.Views;

public sealed partial class HostsPage : Page
{
    public HostsPage()
    {
        InitializeComponent();
        Loaded += (_, _) => { App.State.Changed += Reload; Reload(); };
        Unloaded += (_, _) => App.State.Changed -= Reload;
    }

    private void Reload()
    {
        if (App.State.Vault == null) return;
        var q = Search.Text.Trim().ToLowerInvariant();
        var hosts = App.State.Hosts
            .Where(h => q.Length == 0 || h.label.ToLowerInvariant().Contains(q) || h.hostname.ToLowerInvariant().Contains(q))
            .OrderBy(h => Title(h), StringComparer.OrdinalIgnoreCase)
            .ToList();
        Subtitle.Text = $"{App.State.Hosts.Count} server · terenkripsi di vault";
        Cards.ItemsSource = hosts.Select((h, i) => Card(h, i)).ToList();
        Empty.Visibility = App.State.Hosts.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private void Search_TextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args) => Reload();

    private static string Title(Host h) => string.IsNullOrWhiteSpace(h.label) ? h.hostname : h.label;

    /// Alamat disamarkan seperti di Mac: 10.0.***.***
    private static string Mask(string host)
    {
        var parts = host.Split('.');
        if (parts.Length >= 3) return string.Join('.', parts.Take(parts.Length - 2)) + ".***.***";
        return host.Length <= 3 ? "***" : host[..3] + new string('*', Math.Min(8, host.Length - 3));
    }

    private static Color ParseHex(string hex)
    {
        try
        {
            var s = hex.TrimStart('#');
            return ColorHelper.FromArgb(255, Convert.ToByte(s[..2], 16), Convert.ToByte(s[2..4], 16), Convert.ToByte(s[4..6], 16));
        }
        catch { return ColorHelper.FromArgb(255, 0x3F, 0xD0, 0xB4); }
    }

    private FrameworkElement Card(Host h, int index)
    {
        var color = ParseHex(h.color);
        var badge = new Border
        {
            Width = 42, Height = 42, CornerRadius = new CornerRadius(12),
            Background = new LinearGradientBrush(new GradientStopCollection
            {
                new GradientStop { Color = color, Offset = 0 },
                new GradientStop { Color = ColorHelper.FromArgb(255, (byte)(color.R * 0.6), (byte)(color.G * 0.6), (byte)(color.B * 0.6)), Offset = 1 },
            }, 45),
            Child = new FontIcon { Glyph = "", FontSize = 18, Foreground = new SolidColorBrush(Colors.White) },
        };
        var text = new StackPanel { Spacing = 2, VerticalAlignment = VerticalAlignment.Center };
        text.Children.Add(new TextBlock { Text = Title(h), FontSize = 15, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis });
        text.Children.Add(new TextBlock { Text = $"{h.username}@{Mask(h.hostname)}:{h.port}", Opacity = 0.6, FontSize = 12, FontFamily = new FontFamily("Cascadia Mono, Consolas") });

        var head = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
        head.Children.Add(badge);
        head.Children.Add(text);

        var connect = new Button { Content = "Connect", Style = (Style)Application.Current.Resources["PrimaryButton"] };
        connect.Click += (_, _) => Connect(h);
        var edit = new Button { Content = new FontIcon { Glyph = "", FontSize = 14 } };
        ToolTipService.SetToolTip(edit, "Edit");
        edit.Click += async (_, _) => await Edit(h);
        var del = new Button { Content = new FontIcon { Glyph = "", FontSize = 14 } };
        ToolTipService.SetToolTip(del, "Hapus");
        del.Click += async (_, _) => await ConfirmDelete(h);

        var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, HorizontalAlignment = HorizontalAlignment.Right };
        actions.Children.Add(edit);
        actions.Children.Add(del);
        actions.Children.Add(connect);

        var body = new Grid { RowSpacing = 14 };
        body.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        body.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        body.Children.Add(head);
        Grid.SetRow(actions, 1);
        actions.VerticalAlignment = VerticalAlignment.Bottom;
        body.Children.Add(actions);

        var card = new Border
        {
            Padding = new Thickness(16), CornerRadius = new CornerRadius(14),
            Background = (Brush)Application.Current.Resources["CardBrush"],
            BorderBrush = new SolidColorBrush(ColorHelper.FromArgb(70, color.R, color.G, color.B)),
            BorderThickness = new Thickness(1),
            Child = body,
        };
        card.DoubleTapped += (_, _) => Connect(h);
        Animate(card, index);
        return card;
    }

    /// Animasi masuk berurutan + angkat saat hover (Composition).
    private static void Animate(UIElement el, int index)
    {
        ElementCompositionPreview.SetIsTranslationEnabled(el, true);
        var visual = ElementCompositionPreview.GetElementVisual(el);
        var comp = visual.Compositor;
        el.Opacity = 0;
        var delay = TimeSpan.FromMilliseconds(40 * Math.Min(index, 12));

        var fade = comp.CreateScalarKeyFrameAnimation();
        fade.InsertKeyFrame(1f, 1f);
        fade.Duration = TimeSpan.FromMilliseconds(380);
        fade.DelayTime = delay;
        fade.DelayBehavior = Microsoft.UI.Composition.AnimationDelayBehavior.SetInitialValueBeforeDelay;

        var slide = comp.CreateVector3KeyFrameAnimation();
        slide.InsertKeyFrame(0f, new Vector3(0, 18, 0));
        slide.InsertKeyFrame(1f, Vector3.Zero, comp.CreateCubicBezierEasingFunction(new Vector2(0.2f, 0.9f), new Vector2(0.3f, 1f)));
        slide.Duration = TimeSpan.FromMilliseconds(420);
        slide.DelayTime = delay;
        slide.DelayBehavior = Microsoft.UI.Composition.AnimationDelayBehavior.SetInitialValueBeforeDelay;

        el.Loaded += (_, _) =>
        {
            el.Opacity = 1;
            visual.Opacity = 0;
            visual.StartAnimation("Opacity", fade);
            visual.StartAnimation("Translation", slide);
        };

        el.PointerEntered += (_, _) => Lift(visual, -4);
        el.PointerExited += (_, _) => Lift(visual, 0);
    }

    private static void Lift(Microsoft.UI.Composition.Visual v, float y)
    {
        var a = v.Compositor.CreateVector3KeyFrameAnimation();
        a.InsertKeyFrame(1f, new Vector3(0, y, 0));
        a.Duration = TimeSpan.FromMilliseconds(180);
        v.StartAnimation("Translation", a);
    }

    // MARK: Aksi

    /// Buka sesi SSH di Windows Terminal (fallback ke konsol ssh.exe).
    private void Connect(Host h)
    {
        var args = $"-p {h.port} {h.username}@{h.hostname}";
        try
        {
            Process.Start(new ProcessStartInfo("wt.exe", $"new-tab --title \"{Title(h)}\" ssh {args}") { UseShellExecute = true });
        }
        catch
        {
            Process.Start(new ProcessStartInfo("ssh.exe", args) { UseShellExecute = true });
        }
    }

    private async void Add_Click(object sender, RoutedEventArgs e) => await Edit(AppState.BlankHost());

    private async System.Threading.Tasks.Task Edit(Host h)
    {
        var label = new TextBox { Header = "Label", Text = h.label, PlaceholderText = "Server produksi" };
        var host = new TextBox { Header = "Alamat (IP / domain)", Text = h.hostname, PlaceholderText = "192.168.1.10" };
        var port = new NumberBox { Header = "Port", Value = h.port, Minimum = 1, Maximum = 65535, SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Compact };
        var user = new TextBox { Header = "Username", Text = h.username };
        var pass = new PasswordBox { Header = "Password (opsional)", Password = h.password ?? "" };
        var colors = new[] { "#3FD0B4", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#EF4444", "#10B981", "#64748B" };
        var colorPick = new ComboBox { Header = "Warna kartu", ItemsSource = colors, SelectedItem = colors.Contains(h.color) ? h.color : colors[0], HorizontalAlignment = HorizontalAlignment.Stretch };

        var row = new Grid { ColumnSpacing = 10 };
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(120) });
        row.Children.Add(host);
        Grid.SetColumn(port, 1);
        row.Children.Add(port);

        var form = new StackPanel { Spacing = 12, MinWidth = 420 };
        foreach (var c in new UIElement[] { label, row, user, pass, colorPick }) form.Children.Add(c);

        var dlg = new ContentDialog
        {
            XamlRoot = XamlRoot,
            Title = string.IsNullOrEmpty(h.id) ? "Host baru" : "Edit host",
            Content = form,
            PrimaryButtonText = "Simpan",
            CloseButtonText = "Batal",
            DefaultButton = ContentDialogButton.Primary,
        };
        if (await dlg.ShowAsync() != ContentDialogResult.Primary || string.IsNullOrWhiteSpace(host.Text)) return;

        App.State.Save(h with
        {
            label = label.Text.Trim(),
            hostname = host.Text.Trim(),
            port = (ushort)Math.Clamp(double.IsNaN(port.Value) ? 22 : port.Value, 1, 65535),
            username = string.IsNullOrWhiteSpace(user.Text) ? "root" : user.Text.Trim(),
            password = string.IsNullOrEmpty(pass.Password) ? null : pass.Password,
            auth = AuthMethod.Password,
            color = colorPick.SelectedItem as string ?? "#3FD0B4",
        });
    }

    private async System.Threading.Tasks.Task ConfirmDelete(Host h)
    {
        var dlg = new ContentDialog
        {
            XamlRoot = XamlRoot,
            Title = $"Hapus {Title(h)}?",
            Content = "Host akan dihapus dari vault (dan dari perangkat lain saat sync).",
            PrimaryButtonText = "Hapus",
            CloseButtonText = "Batal",
        };
        if (await dlg.ShowAsync() == ContentDialogResult.Primary) App.State.Delete(h);
    }
}
