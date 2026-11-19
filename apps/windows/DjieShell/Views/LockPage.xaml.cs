using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media.Animation;

namespace DjieShell.Views;

public sealed partial class LockPage : Page
{
    private readonly bool _creating;

    public LockPage()
    {
        InitializeComponent();
        _creating = !App.State.HasVault;
        if (_creating)
        {
            Title.Text = "Selamat datang di Djie Shell";
            Submit.Content = "Buat vault & mulai";
            Password.PlaceholderText = "Buat master password (min. 8 karakter)";
            Confirm.Visibility = Visibility.Visible;
        }
        else
        {
            Title.Text = "Vault terkunci";
            Subtitle.Text = "Masukkan master password untuk melanjutkan.";
        }
        Loaded += (_, _) => { Appear(); Password.Focus(FocusState.Programmatic); };
    }

    /// Animasi masuk: fade + naik.
    private void Appear()
    {
        var sb = new Storyboard();
        var fade = new DoubleAnimation { From = 0, To = 1, Duration = TimeSpan.FromMilliseconds(500) };
        Storyboard.SetTarget(fade, Card); Storyboard.SetTargetProperty(fade, "Opacity");
        sb.Children.Add(fade);
        Card.RenderTransform = new Microsoft.UI.Xaml.Media.TranslateTransform { Y = 16 };
        var rise = new DoubleAnimation { From = 16, To = 0, Duration = TimeSpan.FromMilliseconds(600), EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
        Storyboard.SetTarget(rise, Card); Storyboard.SetTargetProperty(rise, "(UIElement.RenderTransform).(TranslateTransform.Y)");
        sb.Children.Add(rise);
        sb.Begin();
    }

    private void Password_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter) Submit_Click(sender, e);
    }

    private async void Submit_Click(object sender, RoutedEventArgs e)
    {
        Error.IsOpen = false;
        var pw = Password.Password;
        if (_creating && pw != Confirm.Password) { Show("Password tidak sama"); return; }
        Submit.IsEnabled = false;
        try
        {
            // Argon2id butuh ±0,3 detik — jalankan di luar UI thread
            await System.Threading.Tasks.Task.Run(() => { if (_creating) App.State.Create(pw); else App.State.Unlock(pw); });
        }
        catch (Exception ex)
        {
            Show(ex.Message.Contains("WrongPassword") ? "Master password salah" : ex.Message);
            Password.Password = "";
        }
        finally { Submit.IsEnabled = true; }
    }

    private void Show(string msg) { Error.Message = msg; Error.IsOpen = true; }
}
