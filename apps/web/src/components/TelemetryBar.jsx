import React from 'react';
import { Server, Cpu, HardDrive, Clock, Box } from 'lucide-react';

export default function TelemetryBar({ telemetry, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs text-zinc-400 animate-pulse">
        <Server className="w-4 h-4 text-cyan-400 animate-spin" />
        <span>Fetching live server telemetry...</span>
      </div>
    );
  }

  if (!telemetry) return null;

  const ramPct = telemetry.ram?.pct || 0;
  const diskPct = telemetry.disk?.pct || 0;

  const getBarColor = (pct) => {
    if (pct > 85) return 'bg-rose-500';
    if (pct > 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-300">
      <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
        <Server className="w-3.5 h-3.5 text-cyan-400" />
        <span className="truncate max-w-[200px]">{telemetry.os || 'Linux'}</span>
      </div>

      <div className="h-3 w-px bg-zinc-800 hidden sm:block" />

      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-zinc-400" />
        <span>{telemetry.uptime || 'N/A'}</span>
      </div>

      <div className="h-3 w-px bg-zinc-800 hidden sm:block" />

      {/* RAM */}
      <div className="flex items-center gap-2 min-w-[130px]">
        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>RAM</span>
            <span>{telemetry.ram?.used}G / {telemetry.ram?.total}G ({ramPct}%)</span>
          </div>
          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${getBarColor(ramPct)}`} style={{ width: `${Math.min(ramPct, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="h-3 w-px bg-zinc-800 hidden sm:block" />

      {/* Disk */}
      <div className="flex items-center gap-2 min-w-[130px]">
        <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>Disk (/)</span>
            <span>{telemetry.disk?.used} / {telemetry.disk?.total} ({diskPct}%)</span>
          </div>
          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${getBarColor(diskPct)}`} style={{ width: `${Math.min(diskPct, 100)}%` }} />
          </div>
        </div>
      </div>

      {telemetry.dockerCount !== undefined && (
        <>
          <div className="h-3 w-px bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Box className="w-3.5 h-3.5" />
            <span>{telemetry.dockerCount} containers active</span>
          </div>
        </>
      )}

      {onRefresh && (
        <button
          onClick={onRefresh}
          className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 underline font-mono cursor-pointer"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
