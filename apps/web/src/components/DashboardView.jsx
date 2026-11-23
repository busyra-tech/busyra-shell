import React, { useEffect } from 'react';
import { 
  Server, Cpu, HardDrive, Container, RefreshCw, Terminal, 
  Activity, ArrowUpRight, AlertTriangle, Radio, CheckCircle2, 
  Database, FileCode, Zap
} from 'lucide-react';

export default function DashboardView({ 
  selectedHost, 
  telemetry, 
  loadingTelemetry, 
  onRefreshTelemetry,
  onNavigate 
}) {
  const data = telemetry || {};
  const ram = data.ram || { used: '1.8', total: '9.7', pct: 18 };
  const disk = data.disk || { used: '34G', total: '76G', pct: 45 };
  const dockerCount = data.dockerCount || 18;

  useEffect(() => {
    if (!telemetry && selectedHost) {
      onRefreshTelemetry(selectedHost);
    }
  }, [selectedHost]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-7 max-w-6xl mx-auto space-y-6">
      {/* Exact PageHeader from macOS DjieShell */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#e9eef6] tracking-tight">Dashboard</h2>
          <p className="text-xs text-[#8a91a0] mt-1">
            Semua server dalam satu layar — CPU, RAM, disk & uptime, diperbarui tiap 5 detik
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => onRefreshTelemetry(selectedHost)}
            disabled={loadingTelemetry}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] text-xs text-[#a3acbd] hover:text-white rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTelemetry ? 'animate-spin text-[#3FD0B4]' : ''}`} />
            <span>Perbarui</span>
          </button>

          <button
            onClick={() => onNavigate('terminals')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#2fc4a8] via-[#4d8ff0] to-[#8f6ef0] text-[#071214] font-bold rounded-lg text-xs shadow-md shadow-[#2fc4a8]/20 hover:opacity-95 transition"
          >
            <Terminal className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Buka Terminal SSH</span>
          </button>
        </div>
      </div>

      {/* Exact SummaryRow (4 stat cards matching macOS DashboardView.swift) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Stat 1: Online */}
        <div className="flex items-center gap-3 p-3.5 bg-[#12161f] border border-[#232a37] rounded-2xl shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#4ADE80]/15 flex items-center justify-center text-[#4ADE80] shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-[#8a91a0]">Online</div>
            <div className="text-base font-bold font-display text-[#e9eef6]">1/1</div>
          </div>
        </div>

        {/* Stat 2: Perlu Perhatian */}
        <div className="flex items-center gap-3 p-3.5 bg-[#12161f] border border-[#232a37] rounded-2xl shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#697286]/15 flex items-center justify-center text-[#8a91a0] shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-[#8a91a0]">Perlu perhatian</div>
            <div className="text-base font-bold font-display text-[#e9eef6]">0</div>
          </div>
        </div>

        {/* Stat 3: CPU Rata-Rata */}
        <div className="flex items-center gap-3 p-3.5 bg-[#12161f] border border-[#232a37] rounded-2xl shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#3FD0B4]/15 flex items-center justify-center text-[#3FD0B4] shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-[#8a91a0]">CPU rata-rata</div>
            <div className="text-base font-bold font-display text-[#e9eef6]">
              {data.loadAvg ? `${Math.round(parseFloat(data.loadAvg.split(' ')[0]) * 100 / 2)}%` : '15%'}
            </div>
          </div>
        </div>

        {/* Stat 4: RAM Terpakai */}
        <div className="flex items-center gap-3 p-3.5 bg-[#12161f] border border-[#232a37] rounded-2xl shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#9D7CF2]/15 flex items-center justify-center text-[#9D7CF2] shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-[#8a91a0]">RAM terpakai</div>
            <div className="text-base font-bold font-display text-[#e9eef6]">
              {ram.used || '1.8'}G / {ram.total || '9.7'}G
            </div>
          </div>
        </div>
      </div>

      {/* Main Server Card (GlassCard matching ServerCard in macOS) */}
      <div className="p-5 bg-[#12161f] border border-[#232a37] rounded-2xl shadow-lg relative overflow-hidden group">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#232a37]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3FD0B4] to-[#5B9CF5] flex items-center justify-center text-[#071214] font-black text-base shadow-md">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#e9eef6]">{selectedHost?.name || 'SBT Production'}</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                  Online
                </span>
              </div>
              <div className="text-xs font-mono text-[#8a91a0] mt-0.5">
                {selectedHost?.username || 'ajidwi'}@{selectedHost?.host || '95.135.92.167'}:{selectedHost?.port || 2233}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-md bg-[#181d28] border border-[#232a37] text-[#a3acbd]">
              OS: <span className="text-[#e9eef6] font-medium">{data.os || 'Linux 6.8.0-151-generic'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#181d28] border border-[#232a37] text-[#a3acbd]">
              Uptime: <span className="text-[#3FD0B4] font-medium">{data.uptime || 'Up 2 hours'}</span>
            </span>
          </div>
        </div>

        {/* Real-time Metric Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          {/* CPU Gauge with Mini Sparkline */}
          <div className="p-3.5 rounded-xl bg-[#181d28] border border-[#232a37]">
            <div className="flex items-center justify-between text-[#8a91a0] text-xs mb-1.5">
              <span>CPU</span>
              <Cpu className="w-3.5 h-3.5 text-[#3FD0B4]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-display text-[#e9eef6]">
                {data.loadAvg ? `${Math.round(parseFloat(data.loadAvg.split(' ')[0]) * 50)}%` : '15%'}
              </span>
              <span className="text-[11px] font-mono text-[#697286]">load {data.loadAvg?.split(' ')[0] || '0.15'}</span>
            </div>
            {/* Sparkline curve simulation */}
            <div className="mt-2.5 h-8 flex items-end gap-1">
              {[20, 15, 25, 18, 30, 22, 19, 14, 28, 16, 21, 15, 24, 18].map((val, idx) => (
                <div 
                  key={idx} 
                  className="flex-1 bg-[#3FD0B4]/30 hover:bg-[#3FD0B4] rounded-t transition-all"
                  style={{ height: `${val}%` }}
                />
              ))}
            </div>
          </div>

          {/* RAM Gauge */}
          <div className="p-3.5 rounded-xl bg-[#181d28] border border-[#232a37]">
            <div className="flex items-center justify-between text-[#8a91a0] text-xs mb-1.5">
              <span>RAM</span>
              <Activity className="w-3.5 h-3.5 text-[#5B9CF5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-display text-[#e9eef6]">{ram.pct || 18}%</span>
              <span className="text-[11px] font-mono text-[#697286]">{ram.used || '1.8'}G / {ram.total || '9.7'}G</span>
            </div>
            <div className="mt-4 w-full bg-[#232a37] rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#5B9CF5] to-[#9D7CF2] h-full rounded-full transition-all duration-500"
                style={{ width: `${ram.pct || 18}%` }}
              />
            </div>
          </div>

          {/* Disk Gauge */}
          <div className="p-3.5 rounded-xl bg-[#181d28] border border-[#232a37]">
            <div className="flex items-center justify-between text-[#8a91a0] text-xs mb-1.5">
              <span>Disk</span>
              <HardDrive className="w-3.5 h-3.5 text-[#9D7CF2]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-display text-[#e9eef6]">{disk.pct || 45}%</span>
              <span className="text-[11px] font-mono text-[#697286]">{disk.used || '34G'} / {disk.total || '76G'}</span>
            </div>
            <div className="mt-4 w-full bg-[#232a37] rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#9D7CF2] to-pink-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${disk.pct || 45}%` }}
              />
            </div>
          </div>

          {/* Docker Fleet Gauge */}
          <div 
            onClick={() => onNavigate('docker')}
            className="p-3.5 rounded-xl bg-[#181d28] border border-[#232a37] hover:border-[#4ADE80]/50 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-[#8a91a0] text-xs mb-1.5">
              <span>Docker Services</span>
              <Container className="w-3.5 h-3.5 text-[#4ADE80]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-display text-[#e9eef6]">{dockerCount}</span>
              <span className="text-[11px] font-mono text-[#4ADE80]">Active</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#8a91a0]">
              <span>Kelola 18 kontainer</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#697286]" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#697286] font-mono mb-3 px-1">
          Alat Server
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('docker')}
            className="flex items-center gap-3 p-3 bg-[#12161f] hover:bg-[#181d28] border border-[#232a37] rounded-xl transition text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#4ADE80]/15 flex items-center justify-center text-[#4ADE80]">
              <Container className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#e9eef6] group-hover:text-[#4ADE80] transition">Docker Fleet</div>
              <div className="text-[10px] text-[#8a91a0]">18 containers active</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('sftp')}
            className="flex items-center gap-3 p-3 bg-[#12161f] hover:bg-[#181d28] border border-[#232a37] rounded-xl transition text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#5B9CF5]/15 flex items-center justify-center text-[#5B9CF5]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#e9eef6] group-hover:text-[#5B9CF5] transition">SFTP Explorer</div>
              <div className="text-[10px] text-[#8a91a0]">Browse & edit files</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('db')}
            className="flex items-center gap-3 p-3 bg-[#12161f] hover:bg-[#181d28] border border-[#232a37] rounded-xl transition text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#e9eef6] group-hover:text-amber-400 transition">Database</div>
              <div className="text-[10px] text-[#8a91a0]">Postgres & Redis SQL</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('snippets')}
            className="flex items-center gap-3 p-3 bg-[#12161f] hover:bg-[#181d28] border border-[#232a37] rounded-xl transition text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#9D7CF2]/15 flex items-center justify-center text-[#9D7CF2]">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#e9eef6] group-hover:text-[#9D7CF2] transition">Snippets</div>
              <div className="text-[10px] text-[#8a91a0]">1-click DevOps scripts</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
