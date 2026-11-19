using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using uniffi.djie_core;

namespace DjieShell;

/// <summary>State app: vault terenkripsi dari djie-core (Rust), sama persis dengan versi macOS.</summary>
internal class AppState
{
    public static string DataDir
    {
        get
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Djie Shell");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public static string VaultPath => Path.Combine(DataDir, "vault.djie");

    public Vault? Vault { get; private set; }
    public bool HasVault => DjieCoreMethods.VaultExists(VaultPath);

    public event Action? Changed;

    public void Create(string password) { Vault = Vault.Create(VaultPath, password); Changed?.Invoke(); }
    public void Unlock(string password) { Vault = Vault.Unlock(VaultPath, password); Changed?.Invoke(); }
    public void Lock() { Vault = null; Changed?.Invoke(); }

    public Host[] Hosts => Vault?.Hosts() ?? [];
    public SshKey[] Keys => Vault?.Keys() ?? [];

    public Host Save(Host h) { var r = Vault!.UpsertHost(h); Changed?.Invoke(); return r; }
    public void Delete(Host h) { Vault!.DeleteHost(h.Id); Changed?.Invoke(); }

    public static Host BlankHost() => new Host(
        Id: "", Hostname: "", Label: "", Group: null, Tags: [], Color: "#3FD0B4",
        Port: 22, Username: "root", Auth: AuthMethod.Password, Password: null, KeyId: null,
        AgentForwarding: false, StartupSnippet: null, JumpHostId: null, Env: [],
        Charset: "UTF-8", TerminalTheme: null, UpdatedAt: 0, Deleted: false);
}
