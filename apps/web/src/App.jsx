import React, { useState, useEffect } from 'react';
import { 
  Server, Terminal as TermIcon, HardDrive, Database, Plus, Shield, 
  Lock, Unlock, Key, Trash2, Edit2, Play, RefreshCw, Radio, Settings 
} from 'lucide-react';
import HostModal from './components/HostModal';
import TerminalView from './components/TerminalView';
import SftpExplorer from './components/SftpExplorer';
import DbExplorer from './components/DbExplorer';
import TelemetryBar from './components/TelemetryBar';
import VaultLockModal from './components/VaultLockModal';
import { encryptVault, decryptVault } from './utils/vaultCrypto';

const DEFAULT_HOSTS = [
  {
    id: 'sbt_primary',
    name: 'SBT Production (Server Busyra Tech)',
    host: '95.135.92.167',
    port: 2233,
    username: 'ajidwi',
    authType: 'key',
    password: '',
    privateKey: '',
    tag: 'Production VPS',
    color: 'cyan'
  }
];

export default function App() {
  const [hosts, setHosts] = useState(() => {
    const saved = localStorage.getItem('busyra_shell_hosts');
    if (!saved) return DEFAULT_HOSTS;
    try {
      const parsed = JSON.parse(saved);
      // If encrypted vault object
      if (parsed.ciphertext && parsed.salt) {
        return [];
      }
      return parsed;
    } catch (_) {
      return DEFAULT_HOSTS;
    }
  });

  const [activeSessions, setActiveSessions] = useState([]);
  const [currentTab, setCurrentTab] = useState('hosts'); // 'hosts', 'terminals', 'sftp', 'db'
  const [selectedHostForTool, setSelectedHostForTool] = useState(DEFAULT_HOSTS[0]);

  // Modal & Edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [telemetry, setTelemetry] = useState({});
  const [loadingTelemetry, setLoadingTelemetry] = useState({});

  // Security Vault Lock
  const [isVaultLocked, setIsVaultLocked] = useState(() => {
    const saved = localStorage.getItem('busyra_shell_hosts');
    if (!saved) return false;
    try {
      const parsed = JSON.parse(saved);
      return Boolean(parsed.ciphertext && parsed.salt);
    } catch (_) {
      return false;
    }
  });
  const [masterPassword, setMasterPassword] = useState('');
  const [hasMasterPassword, setHasMasterPassword] = useState(() => {
    return Boolean(localStorage.getItem('busyra_shell_vault_enabled'));
  });

  useEffect(() => {
    if (!isVaultLocked && hosts.length > 0) {
      if (masterPassword) {
        // Save encrypted
        encryptVault(hosts, masterPassword).then(encrypted => {
          localStorage.setItem('busyra_shell_hosts', JSON.stringify(encrypted));
        });
      } else {
        localStorage.setItem('busyra_shell_hosts', JSON.stringify(hosts));
      }
    }
  }, [hosts, isVaultLocked, masterPassword]);

  const handleUnlockVault = async (pwd) => {
    const rawVault = localStorage.getItem('busyra_shell_hosts');
    if (!rawVault) {
      setIsVaultLocked(false);
      return;
    }
    const parsed = JSON.parse(rawVault);
    const decrypted = await decryptVault(parsed, pwd);
    setHosts(decrypted);
    setMasterPassword(pwd);
    setIsVaultLocked(false);
  };

  const handleSetVaultPassword = async (pwd) => {
    setMasterPassword(pwd);
    setHasMasterPassword(true);
    localStorage.setItem('busyra_shell_vault_enabled', 'true');
    const encrypted = await encryptVault(hosts, pwd);
    localStorage.setItem('busyra_shell_hosts', JSON.stringify(encrypted));
    setIsVaultLocked(false);
  };

  const handleLockVault = () => {
    setIsVaultLocked(true);
    setMasterPassword('');
    setHosts([]);
    setActiveSessions([]);
  };

  const handleSaveHost = (hostData) => {
    if (editingHost) {
      setHosts(hosts.map(h => h.id === hostData.id ? hostData : h));
    } else {
      setHosts([...hosts, hostData]);
    }
    setEditingHost(null);
  };

  const handleDeleteHost = (id) => {
    if (confirm('Hapus host ini dari daftar tersimpan?')) {
      setHosts(hosts.filter(h => h.id !== id));
    }
  };

  const handleConnectTerminal = (host) => {
    const newSession = {
      id: 'term_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      host: host
    };
    setActiveSessions(prev => [...prev, newSession]);
    setCurrentTab('terminals');
  };

  const handleCloseSession = (sessionId) => {
    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleOpenSftp = (host) => {
    setSelectedHostForTool(host);
    setCurrentTab('sftp');
  };

  const handleOpenDb = (host) => {
    setSelectedHostForTool(host);
    setCurrentTab('db');
  };

  const fetchHostTelemetry = async (host) => {
    setLoadingTelemetry(prev => ({ ...prev, [host.id]: true }));
    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(host)
      });
      const data = await res.json();
      if (!data.error) {
        setTelemetry(prev => ({ ...prev, [host.id]: data }));
      }
    } catch (_) {
    } finally {
      setLoadingTelemetry(prev => ({ ...prev, [host.id]: false }));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Top Main Navigation Bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <TermIcon className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-wide text-zinc-100">BUSYRA SHELL</h1>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-full">
                PRO WEB
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 hidden sm:block">Next-Gen Web Terminal & Multi-Server Manager</p>
          </div>
        </div>

        {/* Center Primary Tab Bar */}
        <div className="flex items-center gap-1 bg-zinc-950/80 p-1 border border-zinc-800 rounded-xl text-xs">
          <button
            onClick={() => setCurrentTab('hosts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              currentTab === 'hosts' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Hosts</span>
            <span className="text-[10px] font-mono text-zinc-500">({hosts.length})</span>
          </button>

          <button
            onClick={() => setCurrentTab('terminals')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              currentTab === 'terminals' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TermIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>Terminal</span>
            {activeSessions.length > 0 && (
              <span className="px-1.5 py-0.2 bg-cyan-500 text-zinc-950 text-[10px] font-bold rounded-full">
                {activeSessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('sftp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              currentTab === 'sftp' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>SFTP</span>
          </button>

          <button
            onClick={() => setCurrentTab('db')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              currentTab === 'db' ? 'bg-amber-950 text-amber-300 border border-amber-800/60 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Database</span>
          </button>
        </div>

        {/* Right Action Icons (Vault Lock & Add Server) */}
        <div className="flex items-center gap-2">
          {hasMasterPassword && !isVaultLocked && (
            <button
              onClick={handleLockVault}
              title="Kunci Vault Sekarang"
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-400 transition"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => { setEditingHost(null); setIsModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Tambah Host</span>
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <main className="flex-1 overflow-hidden p-3">
        {currentTab === 'hosts' && (
          <div className="flex flex-col h-full max-w-6xl mx-auto overflow-y-auto pr-1">
            <div className="flex items-center justify-between mb-4 mt-1">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Server Fleet Dashboard</h2>
                <p className="text-xs text-zinc-400">Koneksi instan ke terminal multi-pane, SFTP, dan query database.</p>
              </div>

              {!hasMasterPassword && (
                <button
                  onClick={() => setIsVaultLocked(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-cyan-400 rounded-lg transition"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Aktifkan Enkripsi Vault</span>
                </button>
              )}
            </div>

            {/* Host Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {hosts.map((host) => (
                <div
                  key={host.id}
                  className="flex flex-col justify-between p-4 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl hover:border-zinc-700 transition shadow-lg group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-zinc-100 leading-tight">{host.name}</h3>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {host.username}@{host.host}:{host.port || 22}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-zinc-800 text-zinc-300 rounded-full">
                        {host.tag || 'Default'}
                      </span>
                    </div>

                    {/* Telemetry Display */}
                    {telemetry[host.id] && (
                      <div className="mb-3">
                        <TelemetryBar telemetry={telemetry[host.id]} />
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingHost(host); setIsModalOpen(true); }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                        title="Edit Config"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHost(host.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                        title="Hapus Host"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => fetchHostTelemetry(host)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition"
                        title="Cek Telemetry"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingTelemetry[host.id] ? 'animate-spin text-cyan-400' : ''}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenDb(host)}
                        className="p-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition flex items-center gap-1"
                        title="Database Explorer"
                      >
                        <Database className="w-3.5 h-3.5 text-amber-400" />
                        <span>DB</span>
                      </button>

                      <button
                        onClick={() => handleOpenSftp(host)}
                        className="p-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition flex items-center gap-1"
                        title="SFTP Explorer"
                      >
                        <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                        <span>SFTP</span>
                      </button>

                      <button
                        onClick={() => handleConnectTerminal(host)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold shadow-md shadow-cyan-500/10 transition cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>SSH</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terminal Tab: Multi-Pane & Broadcast */}
        {currentTab === 'terminals' && (
          <div className="h-full w-full">
            {activeSessions.length > 0 ? (
              <TerminalView
                sessions={activeSessions}
                onCloseSession={handleCloseSession}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
                <TermIcon className="w-12 h-12 text-zinc-700" />
                <p className="text-sm">Belum ada sesi terminal yang aktif.</p>
                <button
                  onClick={() => setCurrentTab('hosts')}
                  className="px-4 py-2 bg-cyan-500 text-zinc-950 font-semibold rounded-xl text-xs"
                >
                  Pilih Server dari Hosts
                </button>
              </div>
            )}
          </div>
        )}

        {/* SFTP Explorer Tab */}
        {currentTab === 'sftp' && (
          <div className="h-full w-full">
            <SftpExplorer
              host={selectedHostForTool || hosts[0] || DEFAULT_HOSTS[0]}
              onClose={() => setCurrentTab('hosts')}
            />
          </div>
        )}

        {/* Database Explorer Tab */}
        {currentTab === 'db' && (
          <div className="h-full w-full">
            <DbExplorer
              host={selectedHostForTool || hosts[0] || DEFAULT_HOSTS[0]}
            />
          </div>
        )}
      </main>

      {/* Host Edit/Create Modal */}
      <HostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveHost}
        initialData={editingHost}
      />

      {/* Vault Master Lock Modal */}
      <VaultLockModal
        isLocked={isVaultLocked}
        hasMasterPassword={hasMasterPassword}
        onUnlock={handleUnlockVault}
        onSetPassword={handleSetVaultPassword}
      />
    </div>
  );
}
