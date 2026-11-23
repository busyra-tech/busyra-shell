import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import HostsView from './components/HostsView';
import DockerView from './components/DockerView';
import TerminalView from './components/TerminalView';
import SftpExplorer from './components/SftpExplorer';
import DbExplorer from './components/DbExplorer';
import SnippetsView from './components/SnippetsView';
import TunnelsView from './components/TunnelsView';
import ServerAdminView from './components/ServerAdminView';
import KeychainView from './components/KeychainView';

import HostModal from './components/HostModal';
import VaultLockModal from './components/VaultLockModal';
import { encryptVault, decryptVault } from './utils/vaultCrypto';

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
    color: '#3FD0B4'
  },
  {
    id: 'siu_primary',
    name: 'SIU Production (IBS)',
    host: '178.128.22.84',
    port: 2233,
    username: 'ajidwi',
    authType: 'key',
    password: '',
    privateKey: '',
    tag: 'Production IBS',
    color: '#5B9CF5'
  }
];

export default function App() {
  const [hosts, setHosts] = useState(() => {
    const saved = localStorage.getItem('busyra_shell_hosts');
    if (!saved) return DEFAULT_HOSTS;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.ciphertext && parsed.salt) return [];
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_HOSTS;

      let list = [...parsed];
      if (!list.some(h => h.host === '178.128.22.84' || (h.name && h.name.toLowerCase().includes('siu')))) {
        list.push(DEFAULT_HOSTS[1]);
      }
      if (!list.some(h => h.host === '95.135.92.167' || (h.name && h.name.toLowerCase().includes('sbt')))) {
        list.unshift(DEFAULT_HOSTS[0]);
      }
      return list;
    } catch (_) {
      return DEFAULT_HOSTS;
    }
  });

  const [currentSection, setCurrentSection] = useState('dashboard'); // 'dashboard', 'hosts', 'docker', 'terminals', 'sftp', 'db', 'snippets', 'tunnels'
  const [selectedHost, setSelectedHost] = useState(DEFAULT_HOSTS[0]);
  const [activeSessions, setActiveSessions] = useState([]);

  // Telemetry state
  const [telemetry, setTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  // Modal & Edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState(null);

  // Security Vault Lock
  const [isVaultLocked, setIsVaultLocked] = useState(() => {
    const saved = localStorage.getItem('busyra_shell_hosts');
    if (!saved) return false;
    try {
      const parsed = JSON.parse(saved);
      return Boolean(parsed.ciphertext && parsed.salt);
    } catch (_) {
      return false;
    }
  });
  const [masterPassword, setMasterPassword] = useState('');
  const [hasMasterPassword, setHasMasterPassword] = useState(() => {
    return Boolean(localStorage.getItem('busyra_shell_vault_enabled'));
  });

  // Keep selectedHost in sync
  useEffect(() => {
    if (hosts.length > 0 && (!selectedHost || !hosts.find(h => h.id === selectedHost.id))) {
      setSelectedHost(hosts[0]);
    }
  }, [hosts]);

  // Telemetry auto-loader
  const fetchTelemetry = async (host) => {
    const target = host || selectedHost;
    if (!target) return;
    setLoadingTelemetry(true);
    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target)
      });
      const data = await res.json();
      if (!data.error) {
        setTelemetry(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    if (selectedHost) {
      fetchTelemetry(selectedHost);
    }
  }, [selectedHost?.id]);

  // Vault save effect
  useEffect(() => {
    if (!isVaultLocked && hosts.length > 0) {
      if (masterPassword) {
        encryptVault(hosts, masterPassword).then(encrypted => {
          localStorage.setItem('busyra_shell_hosts', JSON.stringify(encrypted));
        });
      } else {
        localStorage.setItem('busyra_shell_hosts', JSON.stringify(hosts));
      }
    }
  }, [hosts, isVaultLocked, masterPassword]);

  const handleUnlockVault = async (pwd) => {
    const rawVault = localStorage.getItem('busyra_shell_hosts');
    if (!rawVault) {
      setIsVaultLocked(false);
      return;
    }
    const parsed = JSON.parse(rawVault);
    const decrypted = await decryptVault(parsed, pwd);
    setHosts(decrypted);
    setMasterPassword(pwd);
    setIsVaultLocked(false);
  };

  const handleSetVaultPassword = async (pwd) => {
    setMasterPassword(pwd);
    setHasMasterPassword(true);
    localStorage.setItem('busyra_shell_vault_enabled', 'true');
    const encrypted = await encryptVault(hosts, pwd);
    localStorage.setItem('busyra_shell_hosts', JSON.stringify(encrypted));
    setIsVaultLocked(false);
  };

  const handleLockVault = () => {
    setIsVaultLocked(true);
    setMasterPassword('');
    setHosts([]);
    setActiveSessions([]);
  };

  const handleSaveHost = (hostData) => {
    if (editingHost) {
      setHosts(hosts.map(h => h.id === hostData.id ? hostData : h));
    } else {
      setHosts([...hosts, hostData]);
    }
    setEditingHost(null);
  };

  const handleConnectTerminal = (host) => {
    const target = host || selectedHost;
    const newSession = {
      id: 'term_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      host: target
    };
    setActiveSessions(prev => [...prev, newSession]);
    setSelectedHost(target);
    setCurrentSection('terminals');
  };

  const handleCloseSession = (sessionId) => {
    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  return (
    <div className="flex h-screen w-screen bg-[#0B0E13] text-zinc-100 font-sans overflow-hidden antialiased select-none">
      {/* Mac Left Navigation Sidebar */}
      <Sidebar
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
        hosts={hosts}
        activeSessionsCount={activeSessions.length}
        isVaultLocked={isVaultLocked}
        hasMasterPassword={hasMasterPassword}
        onLockVault={handleLockVault}
        onOpenNewHost={() => { setEditingHost(null); setIsModalOpen(true); }}
        onOpenVaultSettings={() => setIsVaultLocked(true)}
        selectedHost={selectedHost}
      />

      {/* Main Detail Canvas */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0B0E13]">
        {currentSection === 'dashboard' && (
          <DashboardView
            selectedHost={selectedHost}
            telemetry={telemetry}
            loadingTelemetry={loadingTelemetry}
            onRefreshTelemetry={fetchTelemetry}
            onNavigate={setCurrentSection}
          />
        )}

        {currentSection === 'hosts' && (
          <HostsView
            hosts={hosts}
            onSaveHosts={setHosts}
            onConnectTerminal={handleConnectTerminal}
            onOpenSftp={(h) => { setSelectedHost(h); setCurrentSection('sftp'); }}
            onOpenDb={(h) => { setSelectedHost(h); setCurrentSection('db'); }}
            onOpenDocker={(h) => { setSelectedHost(h); setCurrentSection('docker'); }}
            onEditHost={(h) => { setEditingHost(h); setIsModalOpen(true); }}
            onOpenNewHost={() => { setEditingHost(null); setIsModalOpen(true); }}
          />
        )}

                {currentSection === 'admin' && (
          <ServerAdminView selectedHost={selectedHost} />
        )}

        {currentSection === 'keychain' && (
          <KeychainView />
        )}

        {currentSection === 'docker' && (
          <DockerView selectedHost={selectedHost} />
        )}

        {currentSection === 'terminals' && (
          <div className="h-full w-full">
            <TerminalView
              sessions={activeSessions}
              onCloseSession={handleCloseSession}
              onNewSession={() => handleConnectTerminal(selectedHost)}
            />
          </div>
        )}

        {currentSection === 'sftp' && (
          <div className="h-full w-full p-4 max-w-6xl mx-auto">
            <SftpExplorer host={selectedHost} />
          </div>
        )}

        {currentSection === 'db' && (
          <div className="h-full w-full p-4 max-w-6xl mx-auto">
            <DbExplorer host={selectedHost} />
          </div>
        )}

        {currentSection === 'snippets' && (
          <SnippetsView selectedHost={selectedHost} />
        )}

        {currentSection === 'tunnels' && (
          <TunnelsView selectedHost={selectedHost} />
        )}
      </main>

      {/* Modals */}
      {isModalOpen && (
        <HostModal
          isOpen={isModalOpen}
          initialData={editingHost}
          onSave={handleSaveHost}
          onClose={() => { setIsModalOpen(false); setEditingHost(null); }}
        />
      )}

      {isVaultLocked && (
        <VaultLockModal
          hasMasterPassword={hasMasterPassword}
          onUnlock={handleUnlockVault}
          onSetPassword={handleSetVaultPassword}
          onCancel={() => {
            if (!hasMasterPassword) setIsVaultLocked(false);
          }}
        />
      )}
    </div>
  );
}
