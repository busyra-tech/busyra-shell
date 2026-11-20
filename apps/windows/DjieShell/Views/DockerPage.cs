using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.UI.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using uniffi.djie_core;

namespace DjieShell.Views;

/// <summary>Docker: container, image, Compose — padanan DockerView.swift.</summary>
internal sealed class DockerPage : PageBase
{
    private const string Blue = "#2496ED";
    private readonly StackPanel _body = Ui.Col(18);
    private readonly StackPanel _actions;
    private DockerModel D => M.Docker;

    public DockerPage() : base("docker", "data")
    {
        var header = Ui.Header("Docker", "Container, image & Compose — di PC ini atau di server lewat SSH");
        _actions = (StackPanel)header.Children[1];
        Children.Add(Ui.Scroll(Ui.Col(20, header, _body)));
        Loaded += async (s, e) =>
        {
            D.StartPolling();
            if (!D.Connected && !D.Loading) await D.Select(D.TargetId);
        };
        Unloaded += (s, e) => D.StopPolling();
        Render();
    }

    protected override void Render()
    {
        // Target: PC ini atau host tersimpan
        _actions.Children.Clear();
        var current = D.TargetId == null ? null : M.HostById(D.TargetId);
        var menu = new MenuFlyout();
        var local = new MenuFlyoutItem { Text = "PC ini", Icon = new FontIcon { Glyph = G.Terminal } };
        local.Click += (s, e) => _ = D.Select(null);
        menu.Items.Add(local);
        if (M.Hosts.Length > 0) menu.Items.Add(new MenuFlyoutSeparator());
        foreach (var h in M.Hosts)
        {
            var i = new MenuFlyoutItem { Text = h.Title(), Icon = new FontIcon { Glyph = G.Server } };
            i.Click += (s, e) => _ = D.Select(h.Id);
            menu.Items.Add(i);
        }
        var target = Ui.Secondary(current?.Title() ?? "PC ini", current == null ? G.Terminal : G.Server, () => { });
        target.Flyout = menu;
        _actions.Children.Add(target);
        var refresh = Ui.IconBtn(G.Refresh, "Muat ulang", () => _ = D.Refresh());
        refresh.IsEnabled = D.Connected && !D.Loading;
        _actions.Children.Add(refresh);

        _body.Children.Clear();
        if (D.Error is { } err)
        {
            var retry = Ui.Secondary("Coba lagi", null, () => _ = D.Select(D.TargetId));
            _body.Children.Add(new Border
            {
                Background = Theme.Brush(Theme.Orange, 0.12), CornerRadius = new CornerRadius(12), Padding = new Thickness(14),
                Child = Ui.Columns("Auto,*,Auto", 10, Ui.Icon(G.Warning, 15, Theme.Brush(Theme.Orange)), Ui.Text(err, 13, wrap: true), retry)
            });
        }
        if (D.Info is not { } info)
        {
            if (D.Loading)
                _body.Children.Add(Ui.Row(10, new ProgressRing { IsActive = true, Width = 18, Height = 18 }, Ui.Secondary("Menghubungkan ke Docker…")).With(r => { r.HorizontalAlignment = HorizontalAlignment.Center; r.Margin = new Thickness(0, 50, 0, 0); }));
            return;
        }

        _body.Children.Add(Ui.Columns("*,*,*,*", 12,
            Tile(G.Apps, $"Docker {info.Version}", info.Os + (info.UsesSudo ? " · sudo" : "")),
            Tile(G.Play, $"{info.Running} / {info.Containers}", "container berjalan"),
            Tile(G.Database, $"{D.Images.Length}", "image"),
            Tile(G.Bolt, $"{info.Cpus} CPU", Ui.Bytes(info.Memory) + " RAM")));

        var tabs = Ui.Segmented([$"Container · {D.Containers.Length}", $"Image · {D.Images.Length}", $"Compose · {D.Projects.Length}"], (int)D.Current,
            i => { D.Current = (DockerModel.Tab)i; Render(); });
        tabs.Width = 420; tabs.HorizontalAlignment = HorizontalAlignment.Left;
        UIElement? search = D.Current == DockerModel.Tab.Containers ? Ui.Search("Cari container, image, port…", D.Query, q => { D.Query = q; Render(); }, 260) : null;
        _body.Children.Add(Ui.Columns("*,Auto", 12, tabs, search));

        switch (D.Current)
        {
            case DockerModel.Tab.Containers: RenderContainers(); break;
            case DockerModel.Tab.Images: RenderImages(); break;
            default: RenderCompose(); break;
        }
    }

    private static UIElement Tile(string glyph, string title, string sub) => Ui.Card(Ui.Columns("Auto,*", 10,
        Ui.TintIcon(glyph, Blue, 34, 15, 9),
        Ui.Col(1, Ui.Text(title, 14, FontWeights.Bold), Ui.Text(sub, 11, fg: Theme.Text2).With(t => t.TextTrimming = TextTrimming.CharacterEllipsis))), 12, 13);

    // MARK: Container

    private void RenderContainers()
    {
        if (D.Containers.Length == 0)
        {
            _body.Children.Add(Ui.EmptyState(G.Apps, "Belum ada container", "Container yang dibuat dengan docker run atau docker compose akan muncul di sini."));
            return;
        }
        foreach (var g in D.Groups)
        {
            var list = g.ToList();
            var head = Ui.Row(8, Ui.Caps(g.Key.Length == 0 ? "Container lepas" : g.Key),
                Ui.Badge($"{list.Count(x => x.State == "running")}/{list.Count}", Theme.Accent2));
            UIElement? buttons = g.Key.Length > 0 && D.Projects.Any(p => p.Name == g.Key) ? ComposeButtons(g.Key, true) : null;
            _body.Children.Add(Ui.Columns("*,Auto", 8, head, buttons));
            var col = Ui.Col(6);
            foreach (var c in list) col.Children.Add(Row(c));
            _body.Children.Add(col);
        }
    }

    private UIElement Row(DockerContainer c)
    {
        var running = c.State == "running";
        var color = c.State switch { "running" => Theme.Green, "paused" => Theme.Orange, "restarting" => "#EAB308", _ => "#6B7280" };
        var dot = new Border { Width = 9, Height = 9, CornerRadius = new CornerRadius(5), Background = Theme.Brush(color), VerticalAlignment = VerticalAlignment.Center };
        var name = Ui.Col(2, Ui.Text(c.Service.Length > 0 ? c.Service : c.Name, 13, FontWeights.SemiBold), Ui.Text(c.Image, 11, fg: Theme.Text2, mono: true));
        name.MinWidth = 200;
        var status = Ui.Text(c.Status, 11, fg: Theme.Text2).With(t => { t.Width = 160; t.TextTrimming = TextTrimming.CharacterEllipsis; t.VerticalAlignment = VerticalAlignment.Center; });

        var ports = Ui.Row(4);
        var published = c.Ports.Split(", ").Select(p =>
        {
            var i = p.IndexOf("->", StringComparison.Ordinal);
            if (i < 0) return null;
            var host = p[..i].Split(':').Last();
            var inner = p[(i + 2)..].Split('/')[0];
            return $"{host}→{inner}";
        }).OfType<string>().Distinct().ToList();
        foreach (var p in published.Take(2))
            ports.Children.Add(new Border { CornerRadius = new CornerRadius(9), Padding = new Thickness(6, 1, 6, 2), Background = Theme.Brush(Blue, 0.13), Child = Ui.Text(p, 10.5, FontWeights.Medium, Theme.Brush(Blue), mono: true), VerticalAlignment = VerticalAlignment.Center });
        if (published.Count > 2) ports.Children.Add(Ui.Text($"+{published.Count - 2}", 10.5, fg: Theme.Text2));

        UIElement? meters = null;
        if (running && D.Stats.TryGetValue(c.Id, out var s))
            meters = Ui.Row(14, Meter("CPU", s.CpuPercent, $"{s.CpuPercent:0.0}%"), Meter("RAM", s.MemPercent, s.MemUsage.Split(" / ")[0]));

        var busy = D.Busy.Contains(c.Id);
        var acts = Ui.Row(2);
        if (busy) acts.Children.Add(new ProgressRing { IsActive = true, Width = 16, Height = 16, Margin = new Thickness(6, 0, 6, 0) });
        else if (running) acts.Children.Add(Ui.IconBtn(G.Stop, "Stop", () => _ = D.Action(c, "stop")));
        else acts.Children.Add(Ui.IconBtn(G.Play, "Start", () => _ = D.Action(c, "start"), Theme.Brush(Theme.Green)));
        acts.Children.Add(Ui.IconBtn(G.Refresh, "Restart", () => _ = D.Action(c, "restart")));
        acts.Children.Add(Ui.IconBtn(G.Document, "Log", () => _ = ShowLogs(c)));
        var shell = Ui.IconBtn(G.Terminal, "Buka shell di container", () => D.OpenShell(c));
        shell.IsEnabled = running;
        acts.Children.Add(shell);
        var more = new MenuFlyout();
        void Item(string t, Action a, bool danger = false)
        {
            var i = new MenuFlyoutItem { Text = t };
            if (danger) i.Foreground = Theme.Brush("#E5484D");
            i.Click += (s2, e2) => a();
            more.Items.Add(i);
        }
        if (c.State == "paused") Item("Lanjutkan (unpause)", () => _ = D.Action(c, "unpause"));
        else if (running) Item("Jeda (pause)", () => _ = D.Action(c, "pause"));
        Item("Salin ID", () => { Ui.CopyText(c.Id); M.Flash("Disalin"); });
        more.Items.Add(new MenuFlyoutSeparator());
        Item("Hapus container…", async () =>
        {
            if (await Ui.Confirm($"Hapus container {c.Name}?", "Container dihentikan dan dihapus. Volume dan image tidak ikut terhapus."))
                await D.Action(c, "rm");
        }, true);
        var moreBtn = Ui.IconBtn(G.More, "Lainnya", () => { });
        moreBtn.Flyout = more;
        acts.Children.Add(moreBtn);

        return Ui.HoverCard(Ui.Columns("Auto,Auto,Auto,Auto,*,Auto,Auto", 12, dot, name, status, ports, null, meters, acts), 11);
    }

    private static UIElement Meter(string label, double value, string text)
    {
        var bar = new Grid { Height = 4, Width = 92, Background = Theme.Ink(0.08), CornerRadius = new CornerRadius(2) };
        bar.Children.Add(new Border
        {
            HorizontalAlignment = HorizontalAlignment.Left, CornerRadius = new CornerRadius(2), Width = Math.Max(2, 92 * Math.Min(1, value / 100)),
            Background = Theme.Brush(value > 80 ? Theme.Red : value > 50 ? Theme.Orange : Blue),
        });
        return Ui.Col(3, Ui.Row(4, Ui.Text(label, 9, FontWeights.Bold, Theme.Text2), Ui.Text(text, 10.5, FontWeights.SemiBold, mono: true)), bar);
    }

    private UIElement ComposeButtons(string name, bool compact)
    {
        var busy = D.Busy.Contains("compose:" + name);
        var row = Ui.Row(4);
        if (busy) row.Children.Add(new ProgressRing { IsActive = true, Width = 16, Height = 16 });
        Button B(string t, string glyph, Func<Task> a) { var b = Ui.Secondary(t, glyph, () => _ = a()); b.IsEnabled = !busy; return b; }
        row.Children.Add(B("Up", G.Play, () => D.Compose(name, "up")));
        row.Children.Add(B("Restart", G.Refresh, () => D.Compose(name, "restart")));
        row.Children.Add(B("Stop", G.Stop, () => D.Compose(name, "stop")));
        if (!compact)
            row.Children.Add(B("Down", G.Delete, async () =>
            {
                if (await Ui.Confirm($"Down proyek {name}?", "Semua container proyek ini dihentikan dan dihapus (docker compose down). Volume tetap aman.", "Down"))
                    await D.Compose(name, "down");
            }));
        return row;
    }

    // MARK: Image & Compose

    private void RenderImages()
    {
        var col = Ui.Col(6);
        foreach (var i in D.Images)
        {
            UIElement del = D.Busy.Contains("img:" + i.Id)
                ? new ProgressRing { IsActive = true, Width = 16, Height = 16 }
                : Ui.IconBtn(G.Delete, "Hapus image", async () =>
                {
                    if (await Ui.Confirm($"Hapus image {i.Repository}:{i.Tag}?", "Image yang masih dipakai container tidak bisa dihapus."))
                        await D.RemoveImage(i);
                }, Theme.Brush("#E5484D"));
            col.Children.Add(Ui.HoverCard(Ui.Columns("Auto,*,Auto,Auto,Auto", 12,
                Ui.TintIcon(G.Database, Blue, 30, 13, 8),
                Ui.Col(2, Ui.Row(6, Ui.Text(i.Repository, 13, FontWeights.SemiBold), Ui.Badge(i.Tag, Theme.Accent2)), Ui.Text(i.Id, 10.5, fg: Theme.Text2, mono: true)),
                Ui.Text(i.Size, 12, FontWeights.SemiBold, mono: true).With(t => { t.Width = 80; t.TextAlignment = TextAlignment.Right; }),
                Ui.Text(i.Created, 11, fg: Theme.Text2).With(t => { t.Width = 120; t.TextAlignment = TextAlignment.Right; }),
                del), 11));
        }
        _body.Children.Add(col);
    }

    private void RenderCompose()
    {
        if (D.Projects.Length == 0)
        {
            _body.Children.Add(Ui.EmptyState(G.Apps, "Belum ada proyek Compose", "Proyek yang dijalankan dengan docker compose up akan muncul di sini."));
            return;
        }
        var grid = new VariableSizedWrapGrid { Orientation = Orientation.Horizontal, ItemWidth = 470, ItemHeight = 170 };
        foreach (var p in D.Projects)
        {
            var running = p.Status.Contains("running", StringComparison.OrdinalIgnoreCase);
            var card = Ui.Card(Ui.Col(10,
                Ui.Columns("Auto,*", 10, Ui.TintIcon(G.Apps, Blue, 34, 15, 9),
                    Ui.Col(2, Ui.Text(p.Name, 14, FontWeights.Bold), Ui.Text(p.Status, 11, FontWeights.Medium, running ? Theme.Brush(Theme.Green) : Theme.Text2))),
                Ui.Text(p.ConfigFiles, 10.5, fg: Theme.Text2, mono: true).With(t => t.TextTrimming = TextTrimming.CharacterEllipsis),
                ComposeButtons(p.Name, false)), 14, 14);
            card.Margin = new Thickness(0, 0, 12, 12);
            if (running) card.BorderBrush = Theme.Brush(Theme.Green, 0.4);
            grid.Children.Add(card);
        }
        _body.Children.Add(grid);
    }

    private async Task ShowLogs(DockerContainer c)
    {
        var text = new TextBlock { Text = "Memuat log…", FontFamily = Theme.MonoFont, FontSize = 11, IsTextSelectionEnabled = true, TextWrapping = TextWrapping.Wrap };
        var scroll = new ScrollViewer { Content = text, Height = 440, Width = 760 };
        var follow = new ToggleSwitch { Header = null, OnContent = "Ikuti", OffContent = "Ikuti", IsOn = true };
        var content = Ui.Col(10, follow, scroll);
        var d = Ui.Dialog($"Log {c.Name}", content, null, "Tutup");
        var open = true;
        d.Closed += (s, e) => open = false;
        // Berjalan di thread UI (await kembali ke UI), jadi aman membaca toggle & mengubah teks.
        async Task Loop()
        {
            while (open)
            {
                var t = await D.Logs(c.Id, 300);
                if (!open) break;
                text.Text = t.Length > 0 ? t : "Belum ada log.";
                if (follow.IsOn) scroll.ChangeView(null, double.MaxValue, null, true);
                for (int i = 0; i < 20 && open; i++) await Task.Delay(100);
                while (open && !follow.IsOn) await Task.Delay(300);
            }
        }
        _ = Loop();
        await d.ShowAsync();
    }
}
