import React, { useState } from 'react';
import { Database, Play, Download, RefreshCw, Table, Terminal, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DbExplorer({ host }) {
  const [dbType, setDbType] = useState('postgres');
  const [dbName, setDbName] = useState('journal');
  const [dbUser, setDbUser] = useState('aji');
  const [query, setQuery] = useState('SELECT * FROM activity_log ORDER BY id DESC LIMIT 20;');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [error, setError] = useState(null);

  const PRESET_DBS = [
    { name: 'journal', type: 'postgres', query: 'SELECT * FROM activity_log ORDER BY id DESC LIMIT 20;' },
    { name: 'store_bot', type: 'postgres', query: 'SELECT id, user_id, status, total_amount, created_at FROM orders ORDER BY id DESC LIMIT 20;' },
    { name: 'wargaku', type: 'postgres', query: 'SELECT id, full_name, phone_number, block, number FROM residents LIMIT 20;' },
    { name: 'vpsku', type: 'postgres', query: 'SELECT * FROM users LIMIT 20;' },
    { name: 'uangku', type: 'postgres', query: 'SELECT id, email, full_name, role, created_at FROM users LIMIT 20;' },
  ];

  const handleSelectPreset = (preset) => {
    setDbType(preset.type);
    setDbName(preset.name);
    setQuery(preset.query);
  };

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...host,
          dbType,
          dbName,
          dbUser,
          query
        })
      });

      const data = await res.json();
      const end = performance.now();
      setExecTime((end - start).toFixed(1));

      if (data.error) {
        setError(data.error);
        setResults(null);
      } else {
        setResults(data);
      }
    } catch (e) {
      setError(e.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!results || !results.rows || !results.columns) return;
    const header = results.columns.join(',');
    const rows = results.rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + '\\n' + rows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `${dbName}_query_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2.5 font-semibold text-zinc-100">
          <Database className="w-4 h-4 text-cyan-400" />
          <span>Database Explorer — {host.name}</span>
          <span className="px-2 py-0.5 text-[10px] bg-zinc-800 text-cyan-400 rounded-full font-mono">
            {dbType.toUpperCase()}
          </span>
        </div>

        {/* Quick Database Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-zinc-500 text-[11px] mr-1">Presets:</span>
          {PRESET_DBS.map((p) => (
            <button
              key={p.name}
              onClick={() => handleSelectPreset(p)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition ${
                dbName === p.name
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Query Bar Controls */}
      <div className="p-4 bg-zinc-900/60 border-b border-zinc-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 font-medium">DB Engine:</label>
            <select
              value={dbType}
              onChange={(e) => setDbType(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL / MariaDB</option>
              <option value="redis">Redis CLI</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-zinc-400 font-medium">Database:</label>
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="postgres"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500 w-36"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-zinc-400 font-medium">User:</label>
            <input
              type="text"
              value={dbUser}
              onChange={(e) => setDbUser(e.target.value)}
              placeholder="aji"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500 w-24"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {results && results.rows && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}

            <button
              onClick={handleRunQuery}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Executing...' : 'Run Query'}</span>
            </button>
          </div>
        </div>

        {/* SQL Input Area */}
        <div className="relative">
          <textarea
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tulis query SQL... (contoh: SELECT * FROM users LIMIT 10;)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500 resize-none"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleRunQuery();
              }
            }}
          />
          <span className="absolute right-3 bottom-3 text-[10px] text-zinc-600 font-mono">
            Press Ctrl+Enter to execute
          </span>
        </div>
      </div>

      {/* Query Status Bar */}
      {(execTime || error || results) && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-800/80 text-xs font-mono">
          <div className="flex items-center gap-2">
            {error ? (
              <div className="flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-lg">{error}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Query OK. {results?.rows?.length || 0} baris ditemukan.</span>
              </div>
            )}
          </div>
          {execTime && (
            <span className="text-zinc-500 text-[11px]">{execTime} ms</span>
          )}
        </div>
      )}

      {/* Results View */}
      <div className="flex-1 overflow-auto p-4 bg-zinc-950">
        {results?.rawText ? (
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap select-text p-2">
            {results.rawText}
          </pre>
        ) : results?.columns && results?.rows ? (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono text-zinc-300">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
                <tr>
                  {results.columns.map((col, idx) => (
                    <th key={idx} className="py-2 px-3 border-r border-zinc-800/50 last:border-r-0 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-zinc-900/80 hover:bg-zinc-900/50 transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 border-r border-zinc-900 last:border-r-0 whitespace-nowrap select-text max-w-xs truncate">
                        {cell === null ? (
                          <span className="text-zinc-600 italic">NULL</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 text-xs">
            <Table className="w-8 h-8 text-zinc-700" />
            <span>Ketik query SQL di atas lalu tekan Run Query atau Ctrl+Enter</span>
          </div>
        )}
      </div>
    </div>
  );
}
