import React from 'react';
import { 
  LayoutDashboard, Server, Container, Terminal, HardDrive, 
  Database, Code2, Network, Shield, Lock, Unlock, Moon, Sun, 
  Plus, Laptop, CheckCircle2, ChevronRight, Activity
} from 'lucide-react';

export default function Sidebar({ 
  currentSection, 
  setCurrentSection, 
  hosts, 
  activeSessionsCount, 
  isVaultLocked, 
  hasMasterPassword, 
  onLockVault, 
  onOpenNewHost,
  onOpenVaultSettings,
  selectedHost
}) {
  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'hosts', label: 'Hosts', icon: Server, badge: hosts.length },
    { id: 'docker', label: 'Docker', icon: Container, badge: '18' },
    { id: 'terminals', label: 'Terminal', icon: Terminal, badge: activeSessionsCount > 0 ? activeSessionsCount : null, highlight: activeSessionsCount > 0 },
    { id: 'sftp', label: 'SFTP', icon: HardDrive, badge: null },
    { id: 'db', label: 'Database', icon: Database, badge: null },
    { id: 'snippets', label: 'Snippets', icon: Code2, badge: '8' },
    { id: 'tunnels', label: 'Tunnels', icon: Network, badge: null },
  ];

  return (
    <aside className="w-60 bg-[#0F131A] border-r border-white/[0.07] flex flex-col justify-between select-none h-screen text-zinc-300">
      {/* Mac Window Header / Brand */}
      <div>
        {/* macOS Traffic Lights Simulation */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20" />
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">MACOS WEB</span>
        </div>

        {/* Brand Identity */}
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3FD0B4] via-[#5B9CF5] to-[#9D7CF2] flex items-center justify-center shadow-lg shadow-[#3FD0B4]/20 text-zinc-950 font-black text-base">
            B
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-[13px] text-zinc-100 tracking-tight truncate">Busyra Shell</h1>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-[#3FD0B4]/15 text-[#3FD0B4] rounded-full border border-[#3FD0B4]/30">
                v0.2.0
              </span>
            </div>
            <p className="text-[10.5px] text-zinc-400">DevOps & SSH Client</p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-2 mt-3 space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Workspace
          </div>

          {sections.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                  isActive 
                    ? 'bg-gradient-to-r from-white/[0.09] to-white/[0.04] text-[#3FD0B4] shadow-sm border border-white/[0.08]' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#3FD0B4]' : 'text-zinc-400 group-hover:text-zinc-300'
                  }`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded-md ${
                    item.highlight 
                      ? 'bg-[#3FD0B4] text-zinc-950 font-bold animate-pulse'
                      : isActive 
                        ? 'bg-[#3FD0B4]/20 text-[#3FD0B4]' 
                        : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Vault & Host Selector Status */}
      <div className="p-3 border-t border-white/[0.07] bg-black/20 space-y-2">
        {/* Active Target Banner */}
        <div className="p-2 bg-white/[0.03] border border-white/[0.05] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <div className="truncate">
              <div className="text-[11px] font-semibold text-zinc-200 truncate">{selectedHost?.name || 'SBT Production'}</div>
              <div className="text-[9.5px] font-mono text-zinc-500">{selectedHost?.host || '95.135.92.167'}</div>
            </div>
          </div>
          <Activity className="w-3.5 h-3.5 text-[#3FD0B4]" />
        </div>

        {/* Vault Status Button */}
        <div className="flex items-center justify-between pt-1">
          {hasMasterPassword ? (
            <button
              onClick={onLockVault}
              className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-amber-400 transition"
              title="Kunci Vault Sekarang"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vault Unlocked</span>
            </button>
          ) : (
            <button
              onClick={onOpenVaultSettings}
              className="flex items-center gap-1.5 text-[11px] text-[#3FD0B4] hover:underline transition"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Setup Vault</span>
            </button>
          )}

          <button
            onClick={onOpenNewHost}
            className="p-1.5 bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-zinc-950 rounded-lg font-bold shadow-md shadow-[#3FD0B4]/20 hover:opacity-90 transition"
            title="Tambah Host Baru"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
