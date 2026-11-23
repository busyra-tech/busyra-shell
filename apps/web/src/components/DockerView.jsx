import React, { useState, useEffect } from 'react';
import { 
  Container, Play, Square, RotateCw, FileText, Search, 
  RefreshCw, CheckCircle2, AlertCircle, X, Copy, Terminal 
} from 'lucide-react';

export default function DockerView({ selectedHost }) {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterState, setFilterState] = useState('all'); // all, running, stopped
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  
  // Logs modal
  const [logModalContainer, setLogModalContainer] = useState(null);
  const [containerLogs, setContainerLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchContainers = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const res = await fetch('/api/docker/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedHost)
      });
      const data = await res.json();
      if (data.containers) {
        setContainers(data.containers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, [selectedHost]);

  const handleDockerAction = async (containerName, action) => {
    setActionLoading(prev => ({ ...prev, [containerName]: true }));
    try {
      const res = await fetch('/api/docker/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, container: containerName, action })
      });
      const data = await res.json();
      if (data.success) {
        await fetchContainers();
      } else {
        alert('Gagal: ' + (data.stderr || data.stdout));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [containerName]: false }));
    }
  };

  const handleOpenLogs = async (containerName) => {
    setLogModalContainer(containerName);
    setLoadingLogs(true);
    setContainerLogs('');
    try {
      const res = await fetch('/api/docker/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, container: containerName, tail: 120 })
      });
      const data = await res.json();
      setContainerLogs(data.logs || 'No logs available');
    } catch (err) {
      setContainerLogs('Error fetching logs: ' + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const filtered = containers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.image.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterState === 'running') return c.state === 'running';
    if (filterState === 'stopped') return c.state !== 'running';
    return true;
  });

  const runningCount = containers.filter(c => c.state === 'running').length;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Docker Fleet</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              ORBSTACK STYLE
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Kelola kontainer Docker, lihat live logs, restart, dan pantau status port di {selectedHost?.name || 'SBT'}.
          </p>
        </div>

        <button
          onClick={fetchContainers}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 rounded-xl text-xs font-medium transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#3FD0B4]' : ''}`} />
          <span>Refresh Kontainer</span>
        </button>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] p-2 rounded-2xl border border-white/[0.05]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Cari kontainer atau image..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#3FD0B4]"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterState('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              filterState === 'all' ? 'bg-white/[0.1] text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Semua ({containers.length})
          </button>
          <button
            onClick={() => setFilterState('running')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              filterState === 'running' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Aktif ({runningCount})
          </button>
          <button
            onClick={() => setFilterState('stopped')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${
              filterState === 'stopped' ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Berhenti ({containers.length - runningCount})
          </button>
        </div>
      </div>

      {/* Containers List / Table */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {loading && containers.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">Memuat kontainer Docker...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">Tidak ada kontainer yang cocok.</div>
        ) : (
          filtered.map(container => {
            const isRunning = container.state === 'running';
            const isBusy = actionLoading[container.name];

            return (
              <div
                key={container.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] rounded-2xl transition gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isRunning ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    <Container className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white tracking-wide truncate">
                        {container.name}
                      </span>
                      <span className={`px-2 py-0.2 text-[9.5px] font-mono rounded-full ${
                        isRunning ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {container.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 mt-0.5 truncate">
                      <span className="truncate">{container.image}</span>
                      {container.ports && (
                        <span className="text-[#3FD0B4] shrink-0">{container.ports}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => handleOpenLogs(container.name)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 rounded-xl text-xs transition"
                    title="Lihat Logs"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Logs</span>
                  </button>

                  <button
                    onClick={() => handleDockerAction(container.name, 'restart')}
                    disabled={isBusy}
                    className="p-1.5 bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 rounded-xl transition"
                    title="Restart Container"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin text-[#3FD0B4]' : ''}`} />
                  </button>

                  {isRunning ? (
                    <button
                      onClick={() => handleDockerAction(container.name, 'stop')}
                      disabled={isBusy}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition"
                      title="Stop Container"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDockerAction(container.name, 'start')}
                      disabled={isBusy}
                      className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition"
                      title="Start Container"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Logs Modal */}
      {logModalContainer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F131A] border border-white/[0.1] rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3FD0B4]" />
                <h3 className="font-bold text-xs text-white font-mono">Logs: {logModalContainer}</h3>
                <span className="text-[10px] text-zinc-500 font-mono">(Tail 120 lines)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(containerLogs)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 transition"
                  title="Copy Logs"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setLogModalContainer(null)}
                  className="p-1.5 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 bg-black/90 overflow-y-auto font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
              {loadingLogs ? 'Memuat log kontainer...' : containerLogs}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
