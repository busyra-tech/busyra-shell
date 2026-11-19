using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using uniffi.djie_core;

namespace DjieShell;

/// <summary>State app: vault terenkripsi dari djie-core (Rust), sama persis dengan versi macOS.</summary>
public class AppState
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

    public List<Host> Hosts => Vault?.Hosts() ?? new();
    public List<SshKey> Keys => Vault?.Keys() ?? new();

    public Host Save(Host h) { var r = Vault!.UpsertHost(h); Changed?.Invoke(); return r; }
    public void Delete(Host h) { Vault!.DeleteHost(h.id); Changed?.Invoke(); }

    public static Host BlankHost() => new Host(
        id: "", hostname: "", label: "", group: null, tags: new List<string>(), color: "#3FD0B4",
        port: 22, username: "root", auth: AuthMethod.Password, password: null, keyId: null,
        agentForwarding: false, startupSnippet: null, jumpHostId: null, env: new List<EnvVar>(),
        charset: "UTF-8", terminalTheme: null, updatedAt: 0, deleted: false);
}
