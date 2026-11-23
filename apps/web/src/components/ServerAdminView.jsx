import React, { useState, useEffect } from 'react';
import { 
  Wrench, Cpu, Settings2, Calendar, FileText, Search, 
  RefreshCw, Play, Square, RotateCw, Trash2, X, Terminal, 
  Check, Copy, AlertTriangle, ShieldAlert
} from 'lucide-react';

export default function ServerAdminView({ selectedHost }) {
  const [activeTab, setActiveTab] = useState('processes'); // 'processes', 'services', 'cron', 'logs'
  const [loading, setLoading] = useState(false);

  // Processes state
  const [processes, setProcesses] = useState([]);
  const [procQuery, setProcQuery] = useState('');
  const [procSort, setProcSort] = useState('cpu'); // 'cpu' | 'mem'

  // Services state
  const [services, setServices] = useState([]);
  const [svcQuery, setSvcQuery] = useState('');
  const [svcFilter, setSvcFilter] = useState('all'); // 'all' | 'running' | 'failed'

  // Cron state
  const [crontab, setCrontab] = useState('');
  const [savingCron, setSavingCron] = useState(false);

  // Logs state
  const [logs, setLogs] = useState('');
  const [logLines, setLogLines] = useState(100);
  const [logUnit, setLogUnit] = useState('');

  // Fetch Processes
  const fetchProcesses = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedHost)
      });
      const data = await res.json();
      if (data.processes) setProcesses(data.processes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Kill Process
  const handleKillProcess = async (pid, comm) => {
    if (!confirm(`Hentikan paksa proses ${comm} (PID: ${pid})?`)) return;
    try {
      const res = await fetch('/api/admin/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, pid })
      });
      const data = await res.json();
      if (data.success) {
        fetchProcesses();
      } else {
        alert('Gagal kill proses: ' + (data.stderr || data.stdout));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Fetch Services
  const fetchServices = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedHost)
      });
      const data = await res.json();
      if (data.services) setServices(data.services);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Service Action
  const handleServiceAction = async (service, action) => {
    try {
      const res = await fetch('/api/admin/service-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, service, action })
      });
      const data = await res.json();
      if (data.success) {
        fetchServices();
      } else {
        alert('Action result: ' + (data.output || 'Done'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Fetch Cron
  const fetchCron = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedHost)
      });
      const data = await res.json();
      setCrontab(data.crontab || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Save Cron
  const handleSaveCron = async () => {
    setSavingCron(true);
    try {
      const res = await fetch('/api/admin/cron-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, crontab })
      });
      const data = await res.json();
      if (data.success) {
        alert('Crontab berhasil disimpan di server!');
      } else {
        alert('Gagal: ' + data.output);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSavingCron(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, unit: logUnit, lines: logLines })
      });
      const data = await res.json();
      setLogs(data.logs || 'No logs available');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'processes') fetchProcesses();
    if (activeTab === 'services') fetchServices();
    if (activeTab === 'cron') fetchCron();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, selectedHost]);

  // Filtered & sorted processes
  const filteredProcesses = processes.filter(p => 
    p.comm.toLowerCase().includes(procQuery.toLowerCase()) || 
    p.user.toLowerCase().includes(procQuery.toLowerCase()) ||
    p.pid.includes(procQuery)
  ).sort((a, b) => b[procSort] - a[procSort]);

  // Filtered services
  const filteredServices = services.filter(s => {
    const match = s.unit.toLowerCase().includes(svcQuery.toLowerCase()) || 
                  s.desc.toLowerCase().includes(svcQuery.toLowerCase());
    if (!match) return false;
    if (svcFilter === 'running') return s.sub === 'running';
    if (svcFilter === 'failed') return s.active === 'failed' || s.sub === 'failed';
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-7 max-w-6xl mx-auto space-y-6">
      {/* Page Header (Matching PageHeader.swift in macOS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#e9eef6] tracking-tight">Kelola Server</h2>
          <p className="text-xs text-[#8a91a0] mt-1">
            Proses ala htop, service systemd, crontab, dan log tanpa hafal perintah — di {selectedHost?.name || 'SBT'}.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-[#181d28] p-1 rounded-xl border border-[#232a37]">
          <button
            onClick={() => setActiveTab('processes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'processes' ? 'bg-[#232a37] text-[#3FD0B4] shadow-sm' : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Proses</span>
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'services' ? 'bg-[#232a37] text-[#5B9CF5] shadow-sm' : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Service</span>
          </button>
          <button
            onClick={() => setActiveTab('cron')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'cron' ? 'bg-[#232a37] text-[#9D7CF2] shadow-sm' : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Cron</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'logs' ? 'bg-[#232a37] text-amber-400 shadow-sm' : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Log</span>
          </button>
        </div>
      </div>

      {/* Tab 1: PROSES (htop-style) */}
      {activeTab === 'processes' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#12161f] border border-[#232a37] rounded-2xl overflow-hidden shadow-lg">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-3.5 border-b border-[#232a37] bg-[#181d28]/60 gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#697286]" />
              <input
                type="text"
                placeholder="Cari proses, user, atau PID..."
                value={procQuery}
                onChange={e => setProcQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0a0c12] border border-[#232a37] rounded-lg text-xs text-[#e9eef6] placeholder-[#697286] focus:outline-none focus:border-[#3FD0B4]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8a91a0]">Urutkan:</span>
              <div className="flex items-center bg-[#0a0c12] p-0.5 rounded-lg border border-[#232a37] text-xs">
                <button
                  onClick={() => setProcSort('cpu')}
                  className={`px-2.5 py-1 rounded-md font-mono ${procSort === 'cpu' ? 'bg-[#232a37] text-[#3FD0B4] font-bold' : 'text-[#8a91a0]'}`}
                >
                  %CPU
                </button>
                <button
                  onClick={() => setProcSort('mem')}
                  className={`px-2.5 py-1 rounded-md font-mono ${procSort === 'mem' ? 'bg-[#232a37] text-[#5B9CF5] font-bold' : 'text-[#8a91a0]'}`}
                >
                  %MEM
                </button>
              </div>

              <button
                onClick={fetchProcesses}
                disabled={loading}
                className="p-1.5 bg-[#0a0c12] hover:bg-[#232a37] border border-[#232a37] rounded-lg text-[#a3acbd]"
                title="Refresh Proses"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#3FD0B4]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Processes Table */}
          <div className="flex-1 overflow-y-auto font-mono text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#181d28] text-[#8a91a0] text-[11px] border-b border-[#232a37]">
                <tr>
                  <th className="py-2.5 px-4 w-20">PID</th>
                  <th className="py-2.5 px-3 w-24">USER</th>
                  <th className="py-2.5 px-3 w-20 text-right">%CPU</th>
                  <th className="py-2.5 px-3 w-20 text-right">%MEM</th>
                  <th className="py-2.5 px-3 w-16 text-center">STAT</th>
                  <th className="py-2.5 px-4">COMMAND</th>
                  <th className="py-2.5 px-4 w-16 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232a37]">
                {filteredProcesses.map(p => (
                  <tr key={p.pid} className="hover:bg-white/[0.03] transition">
                    <td className="py-2 px-4 text-[#697286] font-semibold">{p.pid}</td>
                    <td className="py-2 px-3 text-[#a3acbd]">{p.user}</td>
                    <td className="py-2 px-3 text-right text-[#3FD0B4] font-bold">{p.cpu}%</td>
                    <td className="py-2 px-3 text-right text-[#5B9CF5]">{p.mem}%</td>
                    <td className="py-2 px-3 text-center text-[#697286]">{p.stat}</td>
                    <td className="py-2 px-4 text-[#e9eef6] truncate max-w-md">{p.comm}</td>
                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => handleKillProcess(p.pid, p.comm)}
                        className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold transition"
                        title="Kill Process (SIGKILL -9)"
                      >
                        Kill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: SERVICES (systemd) */}
      {activeTab === 'services' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#12161f] border border-[#232a37] rounded-2xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between p-3.5 border-b border-[#232a37] bg-[#181d28]/60 gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#697286]" />
              <input
                type="text"
                placeholder="Cari systemd service..."
                value={svcQuery}
                onChange={e => setSvcQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0a0c12] border border-[#232a37] rounded-lg text-xs text-[#e9eef6] placeholder-[#697286] focus:outline-none focus:border-[#3FD0B4]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setSvcFilter('all')}
                className={`px-3 py-1 rounded-lg transition ${svcFilter === 'all' ? 'bg-[#232a37] text-white font-semibold' : 'text-[#8a91a0]'}`}
              >
                Semua ({services.length})
              </button>
              <button
                onClick={() => setSvcFilter('running')}
                className={`px-3 py-1 rounded-lg transition ${svcFilter === 'running' ? 'bg-[#4ADE80]/15 text-[#4ADE80] font-semibold' : 'text-[#8a91a0]'}`}
              >
                Berjalan
              </button>
              <button
                onClick={fetchServices}
                className="p-1.5 bg-[#0a0c12] hover:bg-[#232a37] border border-[#232a37] rounded-lg text-[#a3acbd]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#3FD0B4]' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#232a37] p-2 space-y-1">
            {filteredServices.map(svc => {
              const isRunning = svc.sub === 'running';
              return (
                <div key={svc.unit} className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl transition gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#4ADE80]' : 'bg-[#697286]'}`} />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-[#e9eef6] font-mono truncate">{svc.unit}</div>
                      <div className="text-[11px] text-[#8a91a0] truncate">{svc.desc || 'No description'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleServiceAction(svc.unit, 'restart')}
                      className="p-1.5 bg-[#181d28] hover:bg-[#232a37] text-[#a3acbd] rounded-lg transition"
                      title="Restart Service"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-[#3FD0B4]" />
                    </button>
                    {isRunning ? (
                      <button
                        onClick={() => handleServiceAction(svc.unit, 'stop')}
                        className="p-1.5 bg-[#181d28] hover:bg-[#232a37] text-[#a3acbd] rounded-lg transition"
                        title="Stop Service"
                      >
                        <Square className="w-3.5 h-3.5 text-rose-400 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleServiceAction(svc.unit, 'start')}
                        className="p-1.5 bg-[#181d28] hover:bg-[#232a37] text-[#a3acbd] rounded-lg transition"
                        title="Start Service"
                      >
                        <Play className="w-3.5 h-3.5 text-[#4ADE80] fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: CRON (crontab visual editor) */}
      {activeTab === 'cron' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#12161f] border border-[#232a37] rounded-2xl overflow-hidden shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#e9eef6]">Crontab Editor</h3>
              <p className="text-xs text-[#8a91a0]">Jadwal background task yang terpasang di user {selectedHost?.username || 'ajidwi'}.</p>
            </div>
            <button
              onClick={handleSaveCron}
              disabled={savingCron}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-[#2fc4a8] to-[#4d8ff0] text-[#071214] font-bold rounded-xl text-xs shadow hover:opacity-95 transition"
            >
              <span>{savingCron ? 'Menyimpan...' : 'Simpan Crontab'}</span>
            </button>
          </div>

          <textarea
            value={crontab}
            onChange={e => setCrontab(e.target.value)}
            rows={14}
            className="w-full flex-1 p-3.5 bg-[#0a0c12] border border-[#232a37] rounded-xl font-mono text-xs text-[#3FD0B4] focus:outline-none focus:border-[#3FD0B4] leading-relaxed select-text"
            placeholder="# Contoh: 0 2 * * * /home/ajidwi/backup.sh"
          />
        </div>
      )}

      {/* Tab 4: LOGS (journalctl) */}
      {activeTab === 'logs' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#12161f] border border-[#232a37] rounded-2xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between p-3.5 border-b border-[#232a37] bg-[#181d28]/60 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Unit (opsional, misal: ssh, docker)..."
                value={logUnit}
                onChange={e => setLogUnit(e.target.value)}
                className="px-3 py-1.5 bg-[#0a0c12] border border-[#232a37] rounded-lg text-xs text-[#e9eef6] placeholder-[#697286] focus:outline-none focus:border-[#3FD0B4] w-56 font-mono"
              />
              <button
                onClick={fetchLogs}
                className="px-3 py-1.5 bg-[#232a37] hover:bg-[#2e3748] text-xs font-semibold text-white rounded-lg transition"
              >
                Muat Log
              </button>
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(logs)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] rounded-lg text-xs text-[#a3acbd] transition"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Log</span>
            </button>
          </div>

          <div className="flex-1 p-4 bg-[#0a0c12] overflow-y-auto font-mono text-[11px] text-[#e9eef6] whitespace-pre-wrap select-text leading-relaxed">
            {loading ? 'Memuat log sistem...' : logs}
          </div>
        </div>
      )}
    </div>
  );
}
