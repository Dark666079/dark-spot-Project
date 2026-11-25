using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Web.WebView2.WinForms;

namespace DarkSpotControl;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new ControlForm());
    }
}

internal sealed class ControlForm : Form
{
    private readonly WebView2 browser = new();
    private readonly Label message = new();
    private Process? launcher;
    private string? projectRoot;
    private bool ownsLauncher;

    public ControlForm()
    {
        Text = "Dark Spot | کنترل سرور";
        Width = 900;
        Height = 650;
        MinimumSize = new Size(620, 480);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(16, 19, 27);
        ForeColor = Color.White;

        message.Dock = DockStyle.Top;
        message.Height = 42;
        message.TextAlign = ContentAlignment.MiddleCenter;
        message.Text = "در حال آماده‌سازی کنترل سرور...";
        message.ForeColor = Color.White;
        message.BackColor = Color.FromArgb(27, 33, 48);

        browser.Dock = DockStyle.Fill;
        Controls.Add(browser);
        Controls.Add(message);
        Shown += OnShown;
        FormClosing += OnClosing;
    }

    private async void OnShown(object? sender, EventArgs e)
    {
        try
        {
            projectRoot = FindProjectRoot(AppContext.BaseDirectory);
            if (projectRoot is null)
                throw new InvalidOperationException("فایل‌های پروژه پیدا نشدند. برنامه باید کنار پوشه‌های launcher و server قرار داشته باشد.");

            EnsurePrivateEnv(projectRoot);
            CheckNodeVersion();
            StartLauncher(projectRoot);
            await browser.EnsureCoreWebView2Async();
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            await WaitForPanel();
            browser.Source = new Uri("http://127.0.0.1:4317/");
            message.Text = "کنترل سرور Dark Spot آماده است";
        }
        catch (Exception ex)
        {
            message.Text = "اجرای برنامه با خطا روبه‌رو شد";
            MessageBox.Show(this, ex.Message, "Dark Spot Control", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static string? FindProjectRoot(string start)
    {
        var dir = new DirectoryInfo(start);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "launcher", "launcher.js")) &&
                File.Exists(Path.Combine(dir.FullName, "server", "server.js")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return null;
    }

    private static void EnsurePrivateEnv(string root)
    {
        var envPath = Path.Combine(root, ".env");
        if (File.Exists(envPath)) return;
        var session = Convert.ToHexString(RandomNumberGenerator.GetBytes(48)).ToLowerInvariant();
        var owner = Convert.ToHexString(RandomNumberGenerator.GetBytes(48)).ToLowerInvariant();
        var content = $"SESSION_SECRET={session}{Environment.NewLine}OWNER_SETUP_TOKEN={owner}{Environment.NewLine}";
        using var stream = new FileStream(envPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        var bytes = new UTF8Encoding(false).GetBytes(content);
        stream.Write(bytes);
    }

    private static void CheckNodeVersion()
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo("node", "--version")
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        try
        {
            process.Start();
            var version = process.StandardOutput.ReadToEnd().Trim();
            process.WaitForExit(5000);
            var digits = version.TrimStart('v').Split('.');
            if (process.ExitCode != 0 || digits.Length < 1 || !int.TryParse(digits[0], out var major) || major < 22)
                throw new InvalidOperationException("برای اجرای Dark Spot به Node.js نسخه 22 یا جدیدتر نیاز است. نسخه فعلی: " + version);
        }
        catch (Win32Exception)
        {
            throw new InvalidOperationException("Node.js پیدا نشد. ابتدا Node.js نسخه 22 یا جدیدتر را نصب کنید و دوباره برنامه را باز کنید.");
        }
    }

    private void StartLauncher(string root)
    {
        var nodeModules = Path.Combine(root, "node_modules");
        if (!Directory.Exists(nodeModules))
            throw new InvalidOperationException("وابستگی‌های پروژه نصب نیستند. ابتدا در پوشه پروژه دستور npm install را اجرا کنید.");

        var start = new ProcessStartInfo("node")
        {
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        start.ArgumentList.Add("--env-file=.env");
        start.ArgumentList.Add(Path.Combine(root, "launcher", "launcher.js"));
        launcher = new Process { StartInfo = start, EnableRaisingEvents = true };
        launcher.Start();
        ownsLauncher = true;
    }

    private static async Task WaitForPanel()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        var until = DateTime.UtcNow.AddSeconds(15);
        Exception? last = null;
        while (DateTime.UtcNow < until)
        {
            try
            {
                using var response = await client.GetAsync("http://127.0.0.1:4317/");
                if (response.StatusCode == HttpStatusCode.OK) return;
            }
            catch (Exception ex) { last = ex; }
            await Task.Delay(350);
        }
        throw new InvalidOperationException("پنل کنترل در زمان مقرر اجرا نشد. پورت 4317 را بررسی کنید.", last);
    }

    private void OnClosing(object? sender, FormClosingEventArgs e)
    {
        if (ownsLauncher && launcher is { HasExited: false })
        {
            try { launcher.Kill(entireProcessTree: true); }
            catch { }
        }
        launcher?.Dispose();
    }
}
