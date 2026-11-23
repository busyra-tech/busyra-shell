import React, { useEffect } from 'react';
import { 
  Server, Cpu, HardDrive, Container, RefreshCw, Terminal, 
  ExternalLink, Activity, ArrowUpRight, ShieldCheck, Database, 
  FileCode, Play
} from 'lucide-react';

export default function DashboardView({ 
  selectedHost, 
  telemetry, 
  loadingTelemetry, 
  onRefreshTelemetry,
  onNavigate 
}) {
  const data = telemetry || {};
  const ram = data.ram || { used: '0', total: '0', pct: 0 };
  const disk = data.disk || { used: '0', total: '0', pct: 0 };
  const dockerCount = data.dockerCount || 18;

  useEffect(() => {
    if (!telemetry && selectedHost) {
      onRefreshTelemetry(selectedHost);
    }
  }, [selectedHost]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 max-w-6xl mx-auto space-y-6">
      {/* Page Header (Matching PageHeader.swift in macOS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Dashboard</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#3FD0B4]/10 text-[#3FD0B4] border border-[#3FD0B4]/20 rounded-full">
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Metrik kesehatan real-time, monitoring resource, dan kontrol instan server fleet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefreshTelemetry(selectedHost)}
            disabled={loadingTelemetry}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 rounded-xl text-xs font-medium transition cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTelemetry ? 'animate-spin text-[#3FD0B4]' : ''}`} />
            <span>Perbarui Metrik</span>
          </button>

          <button
            onClick={() => onNavigate('terminals')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#3FD0B4] via-[#5B9CF5] to-[#9D7CF2] text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-[#3FD0B4]/20 hover:opacity-95 transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Buka Terminal SSH</span>
          </button>
        </div>
      </div>

      {/* Primary Server Tile (GlassCard SwiftUI matching) */}
      <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#3FD0B4]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#3FD0B4]/15 border border-[#3FD0B4]/30 flex items-center justify-center text-[#3FD0B4] shadow-inner">
              <Server className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{selectedHost?.name || 'SBT Production'}</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-400 mt-0.5">
                {selectedHost?.username || 'ajidwi'}@{selectedHost?.host || '95.135.92.167'}:{selectedHost?.port || 2233}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-2.5 py-1 rounded-lg bg-black/30 border border-white/[0.05] text-zinc-300 font-mono text-[11px]">
              OS: <span className="text-white font-medium">{data.os || 'Linux 6.8.0-151-generic'}</span>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-black/30 border border-white/[0.05] text-zinc-300 font-mono text-[11px]">
              Uptime: <span className="text-[#3FD0B4] font-medium">{data.uptime || 'Up 2 hours'}</span>
            </div>
            {data.loadAvg && (
              <div className="px-2.5 py-1 rounded-lg bg-black/30 border border-white/[0.05] text-zinc-300 font-mono text-[11px]">
                Load: <span className="text-amber-400 font-medium">{data.loadAvg}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Metric Telemetry Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          {/* CPU Load */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#3FD0B4]/40 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">CPU Activity</span>
              <Cpu className="w-4 h-4 text-[#3FD0B4]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {data.loadAvg ? data.loadAvg.split(' ')[0] : '0.15'}
              </span>
              <span className="text-xs text-zinc-500 font-mono">load 1m</span>
            </div>
            <div className="mt-3 w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(10, parseFloat(data.loadAvg || 0.2) * 50))}%` }}
              />
            </div>
          </div>

          {/* RAM Usage */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#5B9CF5]/40 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Memory Usage</span>
              <Activity className="w-4 h-4 text-[#5B9CF5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">{ram.pct || 18}%</span>
              <span className="text-xs text-zinc-400 font-mono">{ram.used || '1.8'}G / {ram.total || '9.7'}G</span>
            </div>
            <div className="mt-3 w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#5B9CF5] to-[#9D7CF2] h-full rounded-full transition-all duration-500"
                style={{ width: `${ram.pct || 18}%` }}
              />
            </div>
          </div>

          {/* Disk Usage */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#9D7CF2]/40 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Root Storage</span>
              <HardDrive className="w-4 h-4 text-[#9D7CF2]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">{disk.pct || 45}%</span>
              <span className="text-xs text-zinc-400 font-mono">{disk.used || '34G'} / {disk.total || '76G'}</span>
            </div>
            <div className="mt-3 w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#9D7CF2] to-pink-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${disk.pct || 45}%` }}
              />
            </div>
          </div>

          {/* Docker Containers Count */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-emerald-400/40 transition cursor-pointer" onClick={() => onNavigate('docker')}>
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Docker Services</span>
              <Container className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">{dockerCount}</span>
              <span className="text-xs text-emerald-400 font-mono font-medium">Active Containers</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
              <span>OrbStack Compose Fleet</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Fast Shortcuts Bar */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 px-1">
          Quick Access & Tools
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('docker')}
            className="flex items-center gap-3 p-3.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl transition text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Container className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">Docker Fleet</div>
              <div className="text-[10px] text-zinc-400">Manage 18 containers</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('sftp')}
            className="flex items-center gap-3 p-3.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl transition text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-indigo-400 transition">SFTP Explorer</div>
              <div className="text-[10px] text-zinc-400">Browse & edit files</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('db')}
            className="flex items-center gap-3 p-3.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl transition text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-amber-400 transition">DB Runner</div>
              <div className="text-[10px] text-zinc-400">Postgres & Redis SQL</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('snippets')}
            className="flex items-center gap-3 p-3.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl transition text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-purple-400 transition">DevOps Scripts</div>
              <div className="text-[10px] text-zinc-400">8 1-click runbooks</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
