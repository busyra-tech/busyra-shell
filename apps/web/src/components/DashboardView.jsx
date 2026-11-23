import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Server, Cpu, HardDrive, Terminal, Folder, 
  AlertTriangle, Radio, RefreshCw, Bell, BellOff, 
  Play, Search, Check, Layers
} from 'lucide-react';

function Sparkline({ data = [], color = '#3FD0B4', height = 36 }) {
  if (!data || data.length === 0) {
    data = [0, 0];
  }
  const maxPoints = Math.max(20, data.length);
  const width = 110;
  const h = height;

  const points = data.slice(-maxPoints);
  const step = width / (maxPoints - 1);
  const pad = maxPoints - points.length;

  const coords = points.map((val, i) => {
    const x = (i + pad) * step;
    const clamped = Math.max(0, Math.min(100, val));
    const y = h - (clamped / 100) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathLine = coords.length > 0 ? `M ${coords.join(' L ')}` : '';
  const firstX = pad * step;
  const lastX = width;
  const pathArea = coords.length > 0 ? `${pathLine} L ${lastX},${h} L ${firstX},${h} Z` : '';

  const gradId = `sparkline-grad-${Math.random().toString(36).substr(2, 6)}`;

  return (
    <svg width={width} height={h} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {pathArea && <path d={pathArea} fill={`url(#${gradId})`} />}
      {pathLine && (
        <path 
          d={pathLine} 
          fill="none" 
          stroke={color} 
          strokeWidth="1.75" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      )}
    </svg>
  );
}

function formatRate(bps) {
  if (!bps || bps < 1000) return `${Math.round(bps || 0)} B/s`;
  if (bps < 1000000) return `${(bps / 1000).toFixed(0)} KB/s`;
  return `${(bps / 1000000).toFixed(1)} MB/s`;
}

export default function DashboardView({ 
  hosts = [], 
  selectedHost,
  onSelectHost,
  onConnectTerminal,
  onNavigate 
}) {
  const [telemetryMap, setTelemetryMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [filter, setFilter] = useState('all'); // 'all' | 'attention' | 'offline'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hoveredHostId, setHoveredHostId] = useState(null);
  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    return localStorage.getItem('dashboard_alerts') === 'true';
  });

  const prevNetRef = useRef({});

  const toggleAlerts = () => {
    setAlertsEnabled(prev => {
      const next = !prev;
      localStorage.setItem('dashboard_alerts', String(next));
      return next;
    });
  };

  const fetchHostTelemetry = async (host) => {
    if (!host) return;
    setLoadingMap(prev => ({ ...prev, [host.id]: true }));
    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(host)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Net rate calculation
      const now = Date.now();
      const prev = prevNetRef.current[host.id];
      let rxRate = 0;
      let txRate = 0;
      if (prev && data.net && prev.rx && prev.tx) {
        const dt = Math.max(0.5, (now - prev.time) / 1000);
        if (data.net.rx >= prev.rx) rxRate = (data.net.rx - prev.rx) / dt;
        if (data.net.tx >= prev.tx) txRate = (data.net.tx - prev.tx) / dt;
      }
      if (data.net) {
        prevNetRef.current[host.id] = { rx: data.net.rx, tx: data.net.tx, time: now };
      }

      setTelemetryMap(prev => {
        const existing = prev[host.id];
        const oldHistory = existing?.cpuHistory || [data.cpu || 0];
        const newHistory = [...oldHistory, data.cpu || 0].slice(-30);

        return {
          ...prev,
          [host.id]: {
            status: 'online',
            os: data.os || 'Linux',
            uptime: data.uptime || '—',
            loadAvg: data.loadAvg || '0.00',
            cpu: typeof data.cpu === 'number' ? data.cpu : 0,
            cpuHistory: newHistory,
            ramUsed: data.ram?.used || '0',
            ramTotal: data.ram?.total || '0',
            ramPct: data.ram?.pct || 0,
            diskUsed: data.disk?.used || '0',
            diskTotal: data.disk?.total || '0',
            diskPct: data.disk?.pct || 0,
            dockerCount: data.dockerCount || 0,
            rxRate,
            txRate,
            updatedAt: new Date()
          }
        };
      });
    } catch (err) {
      setTelemetryMap(prev => ({
        ...prev,
        [host.id]: {
          status: 'offline',
          error: err.message,
          cpuHistory: prev[host.id]?.cpuHistory || [0],
          updatedAt: new Date()
        }
      }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [host.id]: false }));
    }
  };

  // Poll all hosts every 5 seconds
  useEffect(() => {
    if (hosts.length === 0) return;
    hosts.forEach(h => fetchHostTelemetry(h));

    const timer = setInterval(() => {
      hosts.forEach(h => fetchHostTelemetry(h));
    }, 5000);

    return () => clearInterval(timer);
  }, [hosts]);

  const handleRefreshAll = () => {
    hosts.forEach(h => fetchHostTelemetry(h));
  };

  const handleToggleSelect = (hostId, e) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(hostId)) next.delete(hostId);
      else next.add(hostId);
      return next;
    });
  };

  // Fleet stats
  const onlineHosts = hosts.filter(h => telemetryMap[h.id]?.status !== 'offline');
  const onlineCount = onlineHosts.length;
  const offlineCount = hosts.length - onlineCount;

  const attentionHosts = hosts.filter(h => {
    const t = telemetryMap[h.id];
    if (!t) return false;
    if (t.status === 'offline') return true;
    return (t.cpu >= 90 || t.ramPct >= 90 || t.diskPct >= 90);
  });

  const avgCpu = useMemo(() => {
    const list = onlineHosts.map(h => telemetryMap[h.id]?.cpu).filter(v => typeof v === 'number');
    if (list.length === 0) return 0;
    return Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  }, [onlineHosts, telemetryMap]);

  const { totalRamUsed, totalRamCap } = useMemo(() => {
    let used = 0;
    let cap = 0;
    onlineHosts.forEach(h => {
      const t = telemetryMap[h.id];
      if (t) {
        used += parseFloat(t.ramUsed) || 0;
        cap += parseFloat(t.ramTotal) || 0;
      }
    });
    return {
      totalRamUsed: used.toFixed(2),
      totalRamCap: cap.toFixed(2)
    };
  }, [onlineHosts, telemetryMap]);

  // Filtered hosts
  const filteredHosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hosts.filter(h => {
      const t = telemetryMap[h.id];
      if (filter === 'attention') {
        const isAttn = t?.status === 'offline' || t?.cpu >= 90 || t?.ramPct >= 90 || t?.diskPct >= 90;
        if (!isAttn) return false;
      } else if (filter === 'offline') {
        if (t?.status !== 'offline') return false;
      }
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.host.toLowerCase().includes(q) ||
        (h.tag && h.tag.toLowerCase().includes(q)) ||
        (t?.os && t.os.toLowerCase().includes(q))
      );
    });
  }, [hosts, telemetryMap, filter, searchQuery]);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-7 py-6 max-w-[1400px] mx-auto space-y-5 select-none text-[#e9eef6]">
      {/* Page Header (matching DjieShell) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-[#e9eef6]">Dashboard</h2>
          <p className="text-xs text-[#8a91a0] mt-0.5">
            All servers on one screen - CPU, RAM, disk &amp; uptime, refreshed every 5 seconds
          </p>
        </div>

        <div className="flex items-center gap-2">
          {offlineCount > 0 && (
            <button
              onClick={handleRefreshAll}
              className="p-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] text-[#F0616D] rounded-lg transition"
              title="Coba lagi semua server offline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={toggleAlerts}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition ${
              alertsEnabled 
                ? 'bg-[#3FD0B4]/15 border-[#3FD0B4]/40 text-[#3FD0B4]' 
                : 'bg-[#181d28] hover:bg-[#232a37] border-[#232a37] text-[#a3acbd]'
            }`}
          >
            {alertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            <span>{alertsEnabled ? 'Notifications' : 'Notifications'}</span>
          </button>

          <button
            onClick={() => onNavigate('terminals')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#2fc4a8] via-[#4d8ff0] to-[#8f6ef0] text-[#071214] font-bold rounded-lg text-xs shadow-md shadow-[#2fc4a8]/20 hover:opacity-95 transition"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Run command</span>
          </button>
        </div>
      </div>

      {/* SummaryRow (4 Stat Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Online */}
        <div className="flex items-center gap-3 p-3 bg-[#12161f] border border-[#232a37] rounded-xl shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#4ADE80]/15 flex items-center justify-center text-[#4ADE80] shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-[#8a91a0] font-medium">Online</div>
            <div className="text-base font-bold font-display text-[#e9eef6]">
              {onlineCount} <span className="text-xs text-[#697286] font-normal">/ {hosts.length}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Needs attention */}
        <div className="flex items-center gap-3 p-3 bg-[#12161f] border border-[#232a37] rounded-xl shadow-sm">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            attentionHosts.length > 0 ? 'bg-[#F0616D]/15 text-[#F0616D]' : 'bg-[#232a37] text-[#8a91a0]'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-[#8a91a0] font-medium">Needs attention</div>
            <div className={`text-base font-bold font-display ${attentionHosts.length > 0 ? 'text-[#F0616D]' : 'text-[#e9eef6]'}`}>
              {attentionHosts.length}
            </div>
          </div>
        </div>

        {/* Card 3: Average CPU */}
        <div className="flex items-center gap-3 p-3 bg-[#12161f] border border-[#232a37] rounded-xl shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#3FD0B4]/15 flex items-center justify-center text-[#3FD0B4] shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-[#8a91a0] font-medium">Average CPU</div>
            <div className="text-base font-bold font-display text-[#3FD0B4]">
              {avgCpu}%
            </div>
          </div>
        </div>

        {/* Card 4: RAM used */}
        <div className="flex items-center gap-3 p-3 bg-[#12161f] border border-[#232a37] rounded-xl shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#5B9CF5]/15 flex items-center justify-center text-[#5B9CF5] shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="min-w-0 truncate">
            <div className="text-[11px] text-[#8a91a0] font-medium">RAM used</div>
            <div className="text-base font-bold font-display text-[#e9eef6] truncate">
              {totalRamUsed} GB <span className="text-xs text-[#697286] font-normal">/ {totalRamCap} GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Segmented Filter Control */}
        <div className="inline-flex p-0.5 bg-[#0a0c12] border border-[#232a37] rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filter === 'all' 
                ? 'bg-[#181d28] text-white shadow-sm font-semibold' 
                : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('attention')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filter === 'attention' 
                ? 'bg-[#181d28] text-white shadow-sm font-semibold' 
                : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            Needs attention
          </button>
          <button
            onClick={() => setFilter('offline')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filter === 'offline' 
                ? 'bg-[#181d28] text-white shadow-sm font-semibold' 
                : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            Offline
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#697286] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search servers, OS, groups..."
            className="w-full pl-8 pr-3 py-1 bg-[#0a0c12] border border-[#232a37] focus:border-[#3FD0B4] rounded-lg text-xs text-[#e9eef6] placeholder-[#697286] outline-none transition"
          />
        </div>
      </div>

      {/* Fleet Server Grid (4 columns on desktop, exactly like DjieShell) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
        {filteredHosts.map(host => {
          const t = telemetryMap[host.id];
          const isSelected = selectedIds.has(host.id);
          const isHovered = hoveredHostId === host.id;
          const isOffline = t?.status === 'offline';
          const cpu = t?.cpu || 0;
          const cpuHistory = t?.cpuHistory || [cpu];
          const ramPct = t?.ramPct || 0;
          const ramUsed = t?.ramUsed || '0';
          const ramTotal = t?.ramTotal || '0';
          const diskPct = t?.diskPct || 0;
          const diskUsed = t?.diskUsed || '0';
          const diskTotal = t?.diskTotal || '0';
          const osText = t?.os || host.tag || host.host;
          const uptimeText = t?.uptime || '—';
          const loadText = t?.loadAvg || '0.00';
          const rxRate = formatRate(t?.rxRate || 0);
          const txRate = formatRate(t?.txRate || 0);

          return (
            <div
              key={host.id}
              onMouseEnter={() => setHoveredHostId(host.id)}
              onMouseLeave={() => setHoveredHostId(null)}
              onClick={() => onConnectTerminal(host)}
              className={`p-3.5 bg-[#12161f] hover:bg-[#151a24] border rounded-2xl transition duration-200 cursor-pointer flex flex-col justify-between space-y-3 shadow-md ${
                isSelected 
                  ? 'border-[#3FD0B4] ring-1 ring-[#3FD0B4]/40' 
                  : isOffline 
                    ? 'border-[#F0616D]/40' 
                    : 'border-[#232a37] hover:border-[#384357]'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Letter Avatar / Selection Checkbox */}
                  <div
                    onClick={(e) => handleToggleSelect(host.id, e)}
                    className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 font-bold text-xs select-none shadow transition"
                    style={{
                      background: host.color 
                        ? `linear-gradient(135deg, ${host.color}dd, ${host.color}66)` 
                        : 'linear-gradient(135deg, #3FD0B4dd, #5B9CF566)',
                      color: '#071214'
                    }}
                    title={isSelected ? 'Batal pilih' : 'Pilih server'}
                  >
                    {isSelected || isHovered ? (
                      <Check className={`w-4 h-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
                    ) : (
                      host.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Title & Subtitle */}
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold font-display text-[#e9eef6] leading-tight truncate">
                      {host.name}
                    </div>
                    <div className="text-[11px] text-[#8a91a0] truncate mt-0.5" title={osText}>
                      {osText}
                    </div>
                  </div>
                </div>

                {/* Right Status / Quick Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {isHovered ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onConnectTerminal(host)}
                        className="p-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] rounded-md text-[#a3acbd] hover:text-white transition"
                        title="Buka terminal"
                      >
                        <Terminal className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          onSelectHost(host);
                          onNavigate('sftp');
                        }}
                        className="p-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] rounded-md text-[#a3acbd] hover:text-white transition"
                        title="Buka SFTP"
                      >
                        <Folder className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      {isOffline ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F0616D]/15 text-[#F0616D] border border-[#F0616D]/30">
                          Offline
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8a91a0]">
                          <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                          <span>Online</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              {isOffline ? (
                <div className="py-5 text-center text-xs text-[#F0616D] bg-[#0a0c12] rounded-xl border border-[#232a37]/60">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-1 opacity-80" />
                  <div>Tidak bisa dihubungi</div>
                  <div className="text-[10px] text-[#8a91a0] mt-0.5 truncate px-2">{t?.error || 'Connection failed'}</div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* CPU Row + Sparkline */}
                  <div className="flex items-end justify-between gap-2 pt-0.5">
                    <div>
                      <div className="text-[10.5px] font-medium text-[#8a91a0]">CPU</div>
                      <div className="text-2xl font-bold font-display text-[#e9eef6] tracking-tight leading-none mt-0.5">
                        {cpu}%
                      </div>
                    </div>
                    <Sparkline data={cpuHistory} color="#3FD0B4" height={34} />
                  </div>

                  {/* RAM Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-medium text-[#e9eef6]">RAM {ramPct}%</span>
                      <span className="font-mono text-[10.5px] text-[#8a91a0]">
                        {ramUsed} GB / {ramTotal} GB
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#0a0c12] rounded-full overflow-hidden border border-[#232a37]">
                      <div 
                        className="h-full bg-gradient-to-r from-[#5B9CF5] to-[#3FD0B4] rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, ramPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Disk Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-medium text-[#e9eef6]">Disk {diskPct}%</span>
                      <span className="font-mono text-[10.5px] text-[#8a91a0]">
                        {diskUsed} GB / {diskTotal} GB
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#0a0c12] rounded-full overflow-hidden border border-[#232a37]">
                      <div 
                        className="h-full bg-gradient-to-r from-[#F59E0B] to-[#F0616D] rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, diskPct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[#232a37]/80 text-[10.5px] font-mono text-[#8a91a0]">
                <div className="flex items-center gap-2">
                  <span>• {uptimeText}</span>
                  <span>• {loadText}</span>
                </div>
                <div>
                  ↓ {rxRate} ↑ {txRate}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Selection Bar (when servers are checked) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-[#12161f]/95 backdrop-blur-md border border-[#384357] rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-[#3FD0B4] text-[#071214] font-bold text-xs flex items-center justify-center">
            {selectedIds.size}
          </div>
          <span className="text-xs text-[#e9eef6] font-medium">server dipilih</span>
          <div className="w-px h-4 bg-[#232a37]" />
          
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[#8a91a0] hover:text-[#e9eef6] transition px-1"
          >
            Batal
          </button>

          <button
            onClick={() => {
              const targets = hosts.filter(h => selectedIds.has(h.id));
              if (targets.length > 0) onConnectTerminal(targets[0]);
              setSelectedIds(new Set());
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] rounded-lg text-xs font-semibold text-[#e9eef6] transition"
          >
            <Terminal className="w-3 h-3" />
            <span>Buka tab</span>
          </button>

          <button
            onClick={() => {
              onNavigate('terminals');
              setSelectedIds(new Set());
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#2fc4a8] to-[#4d8ff0] text-[#071214] font-bold rounded-lg text-xs shadow hover:opacity-95 transition"
          >
            <Layers className="w-3 h-3" />
            <span>Split &amp; broadcast</span>
          </button>
        </div>
      )}
    </div>
  );
}
