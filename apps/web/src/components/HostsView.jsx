import React, { useState } from 'react';
import { 
  Server, Zap, Eye, EyeOff, LayoutGrid, List, Plus, 
  Search, Edit2, Copy, Download, Trash2, CheckCircle2 
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
  const [layout, setLayout] = useState('grid'); // 'grid' | 'list'
  const [hideAddresses, setHideAddresses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredHostId, setHoveredHostId] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleImportSshConfig = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/ssh/config-hosts');
      const data = await res.json();
      if (data.hosts && data.hosts.length > 0) {
        const existingIps = new Set(hosts.map(h => h.host));
        const newOnes = data.hosts.filter(h => !existingIps.has(h.host));
        if (newOnes.length > 0) {
          onSaveHosts([...hosts, ...newOnes]);
          alert(`Berhasil mengimpor ${newOnes.length} host baru dari ~/.ssh/config!`);
        } else {
          alert('Semua host dari ~/.ssh/config sudah ada.');
        }
      }
    } catch (err) {
      alert('Gagal impor: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDuplicateHost = (host) => {
    const copy = {
      ...host,
      id: 'host_' + Date.now(),
      name: host.name + ' (Copy)'
    };
    onSaveHosts([...hosts, copy]);
  };

  const handleDeleteHost = (id) => {
    if (confirm('Hapus host ini dari daftar tersimpan?')) {
      onSaveHosts(hosts.filter(h => h.id !== id));
    }
  };

  const filtered = hosts.filter(h => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return h.name.toLowerCase().includes(q) || 
           (h.host || '').toLowerCase().includes(q) ||
           (h.tag || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-7 max-w-6xl mx-auto space-y-6">
      {/* Exact Header from HostsView.swift */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#e9eef6] tracking-tight">Hosts</h2>
          <div className="flex items-center gap-2 text-xs text-[#8a91a0] mt-1">
            <span>{hosts.length} server</span>
            <span>·</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            <span className="text-[#4ADE80] font-medium">1 terhubung</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Layout Switcher */}
          <div className="flex items-center bg-[#181d28] p-0.5 rounded-lg border border-[#232a37]">
            <button
              onClick={() => setLayout('grid')}
              className={`p-1.5 rounded-md transition ${layout === 'grid' ? 'bg-[#232a37] text-white shadow-sm' : 'text-[#697286] hover:text-[#a3acbd]'}`}
              title="Grid Layout"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayout('list')}
              className={`p-1.5 rounded-md transition ${layout === 'list' ? 'bg-[#232a37] text-white shadow-sm' : 'text-[#697286] hover:text-[#a3acbd]'}`}
              title="List Layout"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Privacy Eye Toggle */}
          <button
            onClick={() => setHideAddresses(!hideAddresses)}
            className="p-2 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] rounded-lg text-[#a3acbd] transition"
            title={hideAddresses ? "Tampilkan alamat host" : "Sembunyikan alamat host"}
          >
            {hideAddresses ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Search Field */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#697286]" />
            <input
              type="text"
              placeholder="Cari host, IP, tag…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#181d28] border border-[#232a37] rounded-lg text-xs text-[#e9eef6] placeholder-[#697286] focus:outline-none focus:border-[#3FD0B4] w-48 sm:w-56"
            />
          </div>

          {/* Import ~/.ssh/config */}
          <button
            onClick={handleImportSshConfig}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] text-xs text-[#a3acbd] hover:text-white rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5 text-[#5B9CF5]" />
            <span className="hidden md:inline">{importing ? '...' : 'Import'}</span>
          </button>

          {/* + Host Baru Primary Button */}
          <button
            onClick={onOpenNewHost}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#2fc4a8] via-[#4d8ff0] to-[#8f6ef0] text-[#071214] font-bold rounded-lg text-xs shadow-md shadow-[#2fc4a8]/20 hover:opacity-95 transition"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Host Baru</span>
          </button>
        </div>
      </div>

      {/* Group Divider Header */}
      <div className="flex items-center gap-2.5 text-[#697286]">
        <span className="text-[11px] font-semibold tracking-wider font-mono uppercase">HOSTS</span>
        <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-[#181d28] text-[#a3acbd] rounded-full border border-[#232a37]">
          {filtered.length}
        </span>
        <div className="flex-1 h-px bg-[#232a37]" />
      </div>

      {/* Host Tiles (Grid or List) */}
      <div className="flex-1 overflow-y-auto pr-1">
        {layout === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filtered.map(host => {
              const isHover = hoveredHostId === host.id;
              const hostColor = host.color || '#3FD0B4';

              return (
                <div
                  key={host.id}
                  onMouseEnter={() => setHoveredHostId(host.id)}
                  onMouseLeave={() => setHoveredHostId(null)}
                  onDoubleClick={() => onConnectTerminal(host)}
                  className="group relative flex flex-col justify-between p-4 bg-[#12161f] hover:bg-[#181d28] border border-[#232a37] hover:border-[#3FD0B4]/40 rounded-2xl transition-all duration-200 shadow-md hover:-translate-y-0.5 cursor-pointer overflow-hidden"
                  style={{
                    boxShadow: isHover ? `0 12px 28px -10px ${hostColor}25` : undefined
                  }}
                >
                  {/* Subtle Top Glow Gradient */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1 transition-opacity opacity-40 group-hover:opacity-100"
                    style={{ background: `linear-gradient(90deg, ${hostColor}, transparent)` }}
                  />

                  <div>
                    {/* Top Row: 46x46 Squircle Icon + Status Chip */}
                    <div className="flex items-start justify-between mb-3.5">
                      <div className="relative">
                        <div 
                          className="w-11 h-11 rounded-[14px] flex items-center justify-center font-bold shadow-md transition-transform group-hover:scale-105"
                          style={{
                            background: `linear-gradient(135deg, ${hostColor}, ${hostColor}99)`,
                            color: '#06110f',
                            boxShadow: `0 4px 14px -3px ${hostColor}60`
                          }}
                        >
                          <Server className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        {/* Live Green Pulsing Indicator Dot */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#4ADE80] border-2 border-[#12161f] shadow-sm animate-pulse" />
                      </div>

                      {/* Status Chip / Actions on Hover */}
                      <div className="flex items-center gap-1">
                        {isHover ? (
                          <div className="flex items-center gap-1 bg-[#181d28] p-1 rounded-lg border border-[#232a37]">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditHost(host); }}
                              className="p-1 text-[#a3acbd] hover:text-white transition"
                              title="Edit Host"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDuplicateHost(host); }}
                              className="p-1 text-[#a3acbd] hover:text-white transition"
                              title="Duplikat Host"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteHost(host.id); }}
                              className="p-1 text-[#a3acbd] hover:text-rose-400 transition"
                              title="Hapus Host"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4ADE80]/10 border border-[#4ADE80]/20 text-[#4ADE80] text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                            <span>Terhubung</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Title & Address */}
                    <div className="space-y-0.5 mb-4">
                      <h3 className="font-semibold text-sm text-[#e9eef6] tracking-tight group-hover:text-white transition line-clamp-1">
                        {host.name}
                      </h3>
                      <div className="text-xs font-mono text-[#8a91a0] truncate">
                        {hideAddresses ? '••••••••••••••••••••' : `${host.username}@${host.host}:${host.port || 22}`}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Tag Pills & Lightning Bolt Connect Button */}
                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                        style={{
                          background: `${hostColor}18`,
                          color: hostColor,
                          border: `1px solid ${hostColor}30`
                        }}
                      >
                        {host.tag || 'Production'}
                      </span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); onConnectTerminal(host); }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                        isHover 
                          ? 'bg-gradient-to-r from-[#2fc4a8] via-[#4d8ff0] to-[#8f6ef0] text-[#071214] shadow-md shadow-[#2fc4a8]/30 px-3' 
                          : 'bg-[#3FD0B4]/15 text-[#3FD0B4] border border-[#3FD0B4]/30'
                      }`}
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>{isHover ? 'Connect' : ''}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Layout */
          <div className="space-y-2">
            {filtered.map(host => {
              const hostColor = host.color || '#3FD0B4';
              return (
                <div
                  key={host.id}
                  onDoubleClick={() => onConnectTerminal(host)}
                  className="flex items-center justify-between p-3 bg-[#12161f] hover:bg-[#181d28] border border-[#232a37] rounded-xl transition cursor-pointer gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                      style={{ background: `${hostColor}25`, color: hostColor }}
                    >
                      <Server className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-[#e9eef6] truncate">{host.name}</div>
                      <div className="text-[11px] font-mono text-[#8a91a0] truncate">
                        {hideAddresses ? '••••••••' : `${host.username}@${host.host}:${host.port || 22}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span 
                      className="px-2 py-0.5 text-[9.5px] font-medium rounded-full"
                      style={{ background: `${hostColor}18`, color: hostColor }}
                    >
                      {host.tag || 'Server'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onConnectTerminal(host); }}
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#2fc4a8] to-[#4d8ff0] text-[#071214] text-xs font-bold"
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>Connect</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
