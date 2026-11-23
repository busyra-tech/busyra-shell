import React, { useState, useEffect } from 'react';
import { 
  Server, Terminal as TermIcon, HardDrive, Plus, Shield, 
  Settings, Key, Trash2, Edit2, Play, ExternalLink, RefreshCw 
} from 'lucide-react';
import HostModal from './components/HostModal';
import TerminalView from './components/TerminalView';
import SftpExplorer from './components/SftpExplorer';
import TelemetryBar from './components/TelemetryBar';

// Default SBT server config template
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
    return saved ? JSON.parse(saved) : DEFAULT_HOSTS;
  });

  const [activeSessions, setActiveSessions] = useState([]);
  const [currentTab, setCurrentTab] = useState('hosts'); // 'hosts' or session.id or 'sftp_' + id
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [telemetry, setTelemetry] = useState({});
  const [loadingTelemetry, setLoadingTelemetry] = useState({});

  useEffect(() => {
    localStorage.setItem('busyra_shell_hosts', JSON.stringify(hosts));
  }, [hosts]);

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
      id: 'term_' + Date.now(),
      type: 'terminal',
      host: host
    };
    setActiveSessions([...activeSessions, newSession]);
    setCurrentTab(newSession.id);
  };

  const handleOpenSftp = (host) => {
    const sftpSessionId = 'sftp_' + host.id;
    const existing = activeSessions.find(s => s.id === sftpSessionId);
    if (!existing) {
      setActiveSessions([...activeSessions, { id: sftpSessionId, type: 'sftp', host }]);
    }
    setCurrentTab(sftpSessionId);
  };

  const handleCloseSession = (sessionId) => {
    const remaining = activeSessions.filter(s => s.id !== sessionId);
    setActiveSessions(remaining);
    if (currentTab === sessionId) {
      setCurrentTab(remaining.length > 0 ? remaining[remaining.length - 1].id : 'hosts');
    }
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
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <TermIcon className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-wide text-zinc-100">BUSYRA SHELL</h1>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-full">
                WEB
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Semua servermu, satu terminal web native.</p>
          </div>
        </div>

        {/* Global tab navigation */}
        <div className="flex items-center gap-1.5 bg-zinc-950/80 p-1 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setCurrentTab('hosts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              currentTab === 'hosts' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Server Hosts ({hosts.length})</span>
          </button>

          {activeSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setCurrentTab(session.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentTab === session.id ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60 shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {session.type === 'terminal' ? (
                <TermIcon className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span className="truncate max-w-[120px]">{session.host.name}</span>
            </button>
          ))}
        </div>

        <div>
          <button
            onClick={() => { setEditingHost(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Server</span>
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 overflow-hidden p-4">
        {currentTab === 'hosts' ? (
          <div className="flex flex-col h-full max-w-6xl mx-auto overflow-y-auto pr-2">
            {/* Subheader */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Daftar Server Terdaftar</h2>
                <p className="text-xs text-zinc-400">Koneksi instan ke terminal SSH dan SFTP lewat browser.</p>
              </div>
            </div>

            {/* Host Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hosts.map((host) => (
                <div
                  key={host.id}
                  className="flex flex-col justify-between p-5 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl hover:border-zinc-700 transition shadow-lg group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
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

                    {/* Telemetry Display if available */}
                    {telemetry[host.id] && (
                      <div className="mb-3">
                        <TelemetryBar telemetry={telemetry[host.id]} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
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

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenSftp(host)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
                      >
                        <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                        <span>SFTP</span>
                      </button>
                      <button
                        onClick={() => handleConnectTerminal(host)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-semibold shadow-md shadow-cyan-500/10 transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Connect</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Active Session View (Terminal or SFTP) */
          <div className="h-full w-full">
            {activeSessions.map((session) => {
              if (session.id !== currentTab) return null;
              if (session.type === 'terminal') {
                return (
                  <TerminalView
                    key={session.id}
                    session={session}
                    onClose={handleCloseSession}
                  />
                );
              }
              if (session.type === 'sftp') {
                return (
                  <SftpExplorer
                    key={session.id}
                    host={session.host}
                    onClose={() => handleCloseSession(session.id)}
                  />
                );
              }
              return null;
            })}
          </div>
        )}
      </main>

      {/* Modal */}
      <HostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveHost}
        initialData={editingHost}
      />
    </div>
  );
}
