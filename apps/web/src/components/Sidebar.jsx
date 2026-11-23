import React from 'react';
import { 
  Gauge, Server, Container, Terminal, Folder, 
  Database, Code2, ArrowRightLeft, Shield, Lock, 
  Plus, Sun, Moon, Laptop, Activity, Cpu, Key
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
    { id: 'dashboard', label: 'Dashboard', icon: Gauge, badge: null },
    { id: 'hosts', label: 'Hosts', icon: Server, badge: hosts.length },
    { id: 'admin', label: 'Kelola Server', icon: Cpu, badge: null },
    { id: 'docker', label: 'Docker', icon: Container, badge: '18' },
    { id: 'terminals', label: 'Terminal', icon: Terminal, badge: activeSessionsCount > 0 ? activeSessionsCount : null, highlight: activeSessionsCount > 0 },
    { id: 'sftp', label: 'SFTP', icon: Folder, badge: null },
    { id: 'db', label: 'Database', icon: Database, badge: null },
    { id: 'keychain', label: 'Keychain SSH', icon: Key, badge: null },
    { id: 'snippets', label: 'Snippets', icon: Code2, badge: '8' },
    { id: 'tunnels', label: 'Port Forwarding', icon: ArrowRightLeft, badge: null },
  ];

  return (
    <aside className="w-[230px] bg-[#12161f] border-r border-[#232a37] flex flex-col justify-between select-none h-screen text-[#a3acbd]">
      <div>
        {/* macOS Traffic Lights Header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20" />
          </div>
          <span className="text-[10px] font-mono text-[#697286] tracking-wider">MACOS 15+</span>
        </div>

        {/* Brand Header */}
        <div className="px-3.5 py-2 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-tr from-[#3FD0B4] via-[#5B9CF5] to-[#9D7CF2] flex items-center justify-center shadow-lg shadow-[#3FD0B4]/20 text-[#071214] font-black text-sm">
            B
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm text-[#e9eef6] tracking-tight leading-tight">Busyra Shell</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10.5px] text-[#8a91a0]">SSH Client</span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold bg-[#3FD0B4]/15 text-[#3FD0B4] rounded border border-[#3FD0B4]/30">
                v0.5.0
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-2 mt-4 space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-[#697286] tracking-widest uppercase font-mono">
            Workspace
          </div>

          {sections.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentSection(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive 
                    ? 'bg-white/[0.08] text-[#3FD0B4] shadow-sm font-semibold' 
                    : 'text-[#a3acbd] hover:text-[#e9eef6] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#3FD0B4]' : 'text-[#697286] group-hover:text-[#a3acbd]'
                  }`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.2 text-[9.5px] font-mono rounded ${
                    item.highlight 
                      ? 'bg-[#3FD0B4] text-[#071214] font-bold animate-pulse'
                      : isActive 
                        ? 'bg-[#3FD0B4]/20 text-[#3FD0B4]' 
                        : 'bg-[#181d28] text-[#697286]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Vault & Quick Target */}
      <div className="p-2.5 border-t border-[#232a37] bg-black/15 space-y-2">
        <div className="p-2 bg-[#181d28] border border-[#232a37] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse shrink-0" />
            <div className="truncate">
              <div className="text-[11px] font-semibold text-[#e9eef6] truncate">{selectedHost?.name || 'SBT Production'}</div>
              <div className="text-[9.5px] font-mono text-[#697286] truncate">{selectedHost?.host || '95.135.92.167'}</div>
            </div>
          </div>
          <Activity className="w-3.5 h-3.5 text-[#3FD0B4] shrink-0" />
        </div>

        <div className="flex items-center justify-between pt-1 px-1">
          {hasMasterPassword ? (
            <button
              onClick={onLockVault}
              className="flex items-center gap-1.5 text-[11px] text-[#a3acbd] hover:text-[#e9eef6] transition"
              title="Kunci Vault"
            >
              <Lock className="w-3.5 h-3.5 text-[#4ADE80]" />
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
            className="p-1.5 bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-[#071214] rounded-lg font-bold shadow hover:opacity-90 transition"
            title="Tambah Host Baru"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
