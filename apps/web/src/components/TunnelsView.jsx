import React, { useState } from 'react';
import { 
  Network, Plus, Play, Square, Trash2, ArrowRight, ShieldCheck, 
  CheckCircle2, Radio 
} from 'lucide-react';

const DEFAULT_TUNNELS = [
  {
    id: 'tun_postgres',
    label: 'PostgreSQL Direct Tunnel',
    type: 'Local (L)',
    localPort: 5433,
    destHost: '127.0.0.1',
    destPort: 5432,
    status: 'inactive'
  },
  {
    id: 'tun_redis',
    label: 'Redis Cache Direct Tunnel',
    type: 'Local (L)',
    localPort: 6380,
    destHost: '127.0.0.1',
    destPort: 6379,
    status: 'inactive'
  },
  {
    id: 'tun_9router',
    label: '9Router AI Gateway',
    type: 'Local (L)',
    localPort: 20128,
    destHost: '127.0.0.1',
    destPort: 20128,
    status: 'inactive'
  }
];

export default function TunnelsView({ selectedHost }) {
  const [tunnels, setTunnels] = useState(() => {
    const saved = localStorage.getItem('busyra_shell_tunnels');
    if (!saved) return DEFAULT_TUNNELS;
    try {
      return JSON.parse(saved);
    } catch (_) {
      return DEFAULT_TUNNELS;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [localPort, setLocalPort] = useState('');
  const [destHost, setDestHost] = useState('127.0.0.1');
  const [destPort, setDestPort] = useState('');

  const saveTunnels = (list) => {
    setTunnels(list);
    localStorage.setItem('busyra_shell_tunnels', JSON.stringify(list));
  };

  const handleToggleTunnel = (id) => {
    const updated = tunnels.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'active' ? 'inactive' : 'active';
        return { ...t, status: nextStatus };
      }
      return t;
    });
    saveTunnels(updated);
  };

  const handleDeleteTunnel = (id) => {
    saveTunnels(tunnels.filter(t => t.id !== id));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!label || !localPort || !destPort) return;
    const newTunnel = {
      id: 'tun_' + Date.now(),
      label,
      type: 'Local (L)',
      localPort: parseInt(localPort),
      destHost: destHost || '127.0.0.1',
      destPort: parseInt(destPort),
      status: 'inactive'
    };
    saveTunnels([...tunnels, newTunnel]);
    setIsModalOpen(false);
    setLabel('');
    setLocalPort('');
    setDestPort('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Port Forwarding & Tunnels</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#5B9CF5]/10 text-[#5B9CF5] border border-[#5B9CF5]/20 rounded-full">
              SSH TUNNEL (L/R)
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Forward port internal server {selectedHost?.name || 'SBT'} ke localhost Mac kantor dengan aman.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-[#3FD0B4]/20 hover:opacity-95 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Tunnel Baru</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {tunnels.map(t => {
          const isActive = t.status === 'active';
          return (
            <div
              key={t.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/[0.035] hover:bg-white/[0.06] border border-white/[0.08] rounded-2xl transition gap-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-[#3FD0B4]/20 text-[#3FD0B4]' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-white">{t.label}</h3>
                    <span className={`px-2 py-0.2 text-[9px] font-mono rounded-full ${
                      isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {isActive ? 'TUNNEL ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-1">
                    <span className="text-[#3FD0B4]">localhost:{t.localPort}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-zinc-300">{selectedHost?.name}:{t.destPort}</span>
                    <span className="text-zinc-600 text-[10px]">({t.type})</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => handleToggleTunnel(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    isActive 
                      ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25' 
                      : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  }`}
                >
                  {isActive ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{isActive ? 'Stop' : 'Start'}</span>
                </button>
                <button
                  onClick={() => handleDeleteTunnel(t.id)}
                  className="p-1.5 text-zinc-400 hover:text-rose-400 transition"
                  title="Hapus Tunnel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-[#0F131A] border border-white/[0.1] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Tambah Port Forwarding</h3>
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Nama / Label</label>
              <input
                type="text"
                required
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="misal: Local Web Port 8080"
                className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-[#3FD0B4]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Port Lokal (Mac)</label>
                <input
                  type="number"
                  required
                  value={localPort}
                  onChange={e => setLocalPort(e.target.value)}
                  placeholder="8080"
                  className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#3FD0B4]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Port Remote (Server)</label>
                <input
                  type="number"
                  required
                  value={destPort}
                  onChange={e => setDestPort(e.target.value)}
                  placeholder="80"
                  className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#3FD0B4]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-zinc-950 font-bold rounded-xl text-xs shadow-md shadow-[#3FD0B4]/20"
              >
                Simpan Tunnel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
