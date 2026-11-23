import React, { useState } from 'react';
import { 
  Server, Play, HardDrive, Database, Container, Edit2, Trash2, 
  Plus, Download, Search, CheckCircle2, Shield, Sparkles 
} from 'lucide-react';

export default function HostsView({ 
  hosts, 
  onSaveHosts, 
  onConnectTerminal, 
  onOpenSftp, 
  onOpenDb, 
  onOpenDocker, 
  onEditHost, 
  onOpenNewHost 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [importing, setImporting] = useState(false);

  const handleImportSshConfig = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/ssh/config-hosts');
      const data = await res.json();
      if (data.hosts && data.hosts.length > 0) {
        // Merge without duplicate host/ip
        const existingIps = new Set(hosts.map(h => h.host));
        const newOnes = data.hosts.filter(h => !existingIps.has(h.host));
        if (newOnes.length > 0) {
          onSaveHosts([...hosts, ...newOnes]);
          alert(`Berhasil mengimpor ${newOnes.length} host baru dari ~/.ssh/config!`);
        } else {
          alert('Semua host dari ~/.ssh/config sudah ada di daftar.');
        }
      } else {
        alert('Tidak ada entri host yang ditemukan di ~/.ssh/config');
      }
    } catch (err) {
      alert('Gagal impor: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteHost = (id) => {
    if (confirm('Hapus host ini dari daftar tersimpan?')) {
      onSaveHosts(hosts.filter(h => h.id !== id));
    }
  };

  const filtered = hosts.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (h.host || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Server Fleet</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#3FD0B4]/10 text-[#3FD0B4] border border-[#3FD0B4]/20 rounded-full">
              {hosts.length} HOSTS
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Koleksi server SSH terdaftar. Konek langsung atau import otomatis dari config lokal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImportSshConfig}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 rounded-xl text-xs font-medium transition cursor-pointer shadow-sm"
            title="Import entri Host dari file ~/.ssh/config di Mac"
          >
            <Download className="w-3.5 h-3.5 text-[#5B9CF5]" />
            <span>{importing ? 'Mengimpor...' : 'Import ~/.ssh/config'}</span>
          </button>

          <button
            onClick={onOpenNewHost}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-[#3FD0B4]/20 hover:opacity-95 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tambah Host</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Cari server berdasarkan nama atau IP..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#3FD0B4]"
        />
      </div>

      {/* Grid Cards (GlassCard style from macOS Theme.swift) */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map(host => (
            <div
              key={host.id}
              className="flex flex-col justify-between p-4 bg-white/[0.035] hover:bg-white/[0.06] border border-white/[0.08] rounded-2xl transition group relative shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs"
                      style={{ 
                        background: `${host.color || '#3FD0B4'}20`, 
                        color: host.color || '#3FD0B4',
                        border: `1px solid ${host.color || '#3FD0B4'}40` 
                      }}
                    >
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-white leading-tight">{host.name}</h3>
                      <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        {host.username}@{host.host}:{host.port || 22}
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 text-[9.5px] font-mono font-medium bg-white/[0.06] text-zinc-300 rounded-full">
                    {host.tag || 'Server'}
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditHost(host)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                    title="Edit Host"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteHost(host.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Hapus Host"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenDocker(host)}
                    className="p-1.5 px-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 font-medium transition flex items-center gap-1"
                    title="Docker Manager"
                  >
                    <Container className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px]">Docker</span>
                  </button>

                  <button
                    onClick={() => onOpenSftp(host)}
                    className="p-1.5 px-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 font-medium transition flex items-center gap-1"
                    title="SFTP Explorer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[11px]">SFTP</span>
                  </button>

                  <button
                    onClick={() => onConnectTerminal(host)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-zinc-950 font-bold shadow-md shadow-[#3FD0B4]/20 hover:opacity-95 transition cursor-pointer"
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
    </div>
  );
}
