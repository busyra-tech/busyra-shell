import React, { useState } from 'react';
import { Database, Play, Download, RefreshCw, Table, Terminal, AlertCircle, CheckCircle2, Shield, Archive } from 'lucide-react';

export default function DbExplorer({ host }) {
  const [activeTab, setActiveTab] = useState('query'); // 'query' | 'backup'
  const [dbType, setDbType] = useState('postgres');
  const [dbName, setDbName] = useState('journal');
  const [dbUser, setDbUser] = useState('aji');
  const [query, setQuery] = useState('SELECT * FROM activity_log ORDER BY id DESC LIMIT 20;');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [error, setError] = useState(null);

  // Backup state
  const [backingUp, setBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(null);

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

  // 1-Click Database Dump & Download
  const handleBackupDb = async () => {
    setBackingUp(true);
    setBackupSuccess(null);
    try {
      const res = await fetch('/api/db/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...host,
          dbType,
          dbName
        })
      });

      const data = await res.json();
      if (data.sql) {
        // Trigger download
        const blob = new Blob([data.sql], { type: 'application/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || `${dbName}_dump.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setBackupSuccess(`Dump database ${dbName} selesai! File ${a.download} berhasil diunduh.`);
      } else {
        setError(data.error || 'Gagal membuat backup');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0c12] text-[#e9eef6] p-7 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#e9eef6] tracking-tight">Database & Backup</h2>
          <p className="text-xs text-[#8a91a0] mt-1">
            Query SQL multi-database & 1-klik dump backup langsung di {host?.name || 'SBT'}.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-[#181d28] p-1 rounded-xl border border-[#232a37]">
          <button
            onClick={() => setActiveTab('query')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'query' ? 'bg-[#232a37] text-[#3FD0B4] shadow-sm' : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>SQL Query</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'backup' ? 'bg-[#232a37] text-[#9D7CF2] shadow-sm' : 'text-[#8a91a0] hover:text-[#e9eef6]'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Backup & Dump</span>
          </button>
        </div>
      </div>

      {/* Database Select Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-[#12161f] border border-[#232a37] rounded-xl text-xs">
        <span className="text-[#8a91a0] font-semibold">Pilih DB:</span>
        {PRESET_DBS.map(preset => (
          <button
            key={preset.name}
            onClick={() => handleSelectPreset(preset)}
            className={`px-2.5 py-1 rounded-lg border font-mono transition ${
              dbName === preset.name
                ? 'bg-[#3FD0B4]/15 border-[#3FD0B4]/40 text-[#3FD0B4] font-bold'
                : 'bg-[#181d28] border-[#232a37] text-[#8a91a0] hover:text-white'
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {activeTab === 'query' && (
        <>
          {/* Query Editor */}
          <div className="flex flex-col bg-[#12161f] border border-[#232a37] rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between p-3 border-b border-[#232a37] bg-[#181d28]/60">
              <span className="text-xs text-[#8a91a0] font-mono">SQL Editor ({dbType}://{dbName})</span>
              <button
                onClick={handleRunQuery}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#2fc4a8] to-[#4d8ff0] text-[#071214] font-bold rounded-xl text-xs shadow hover:opacity-95 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{loading ? 'Menjalankan...' : 'Jalankan (Run)'}</span>
              </button>
            </div>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              rows={4}
              className="w-full p-4 bg-[#0a0c12] font-mono text-xs text-[#3FD0B4] focus:outline-none resize-none leading-relaxed"
              placeholder="SELECT * FROM table LIMIT 10;"
            />
          </div>

          {/* Results Table */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#12161f] border border-[#232a37] rounded-2xl overflow-hidden shadow-lg">
            <div className="p-3 border-b border-[#232a37] bg-[#181d28]/60 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#8a91a0]">
                Hasil: {results?.rows?.length || 0} baris {execTime && `(${execTime} ms)`}
              </span>
              {error && <span className="text-rose-400 font-mono text-[11px] truncate max-w-md">{error}</span>}
            </div>

            <div className="flex-1 overflow-auto">
              {results && results.rows && results.rows.length > 0 ? (
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead className="bg-[#181d28] text-[#8a91a0] sticky top-0 border-b border-[#232a37]">
                    <tr>
                      {results.fields.map(f => (
                        <th key={f} className="py-2.5 px-4 font-semibold">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232a37]">
                    {results.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.03]">
                        {results.fields.map(f => (
                          <td key={f} className="py-2 px-4 text-[#e9eef6] whitespace-nowrap">
                            {typeof row[f] === 'object' ? JSON.stringify(row[f]) : String(row[f] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-[#8a91a0] text-xs">
                  {loading ? 'Menjalankan query...' : 'Klik "Jalankan" untuk melihat hasil tabel data.'}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'backup' && (
        <div className="p-6 bg-[#12161f] border border-[#232a37] rounded-2xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#e9eef6]">1-Click Backup Database</h3>
            <p className="text-xs text-[#8a91a0] mt-1">
              Dump seluruh skema dan tabel database <span className="text-[#3FD0B4] font-mono font-bold">{dbName}</span> via pg_dump langsung ke file .sql di komputer Anda.
            </p>
          </div>

          <div className="p-4 bg-[#181d28] border border-[#232a37] rounded-xl flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-[#e9eef6]">Database Target: {dbName}</div>
              <div className="text-[11px] text-[#8a91a0]">PostgreSQL container psql @ SBT Production</div>
            </div>

            <button
              onClick={handleBackupDb}
              disabled={backingUp}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2fc4a8] to-[#4d8ff0] text-[#071214] font-bold rounded-xl text-xs shadow hover:opacity-95 transition"
            >
              <Download className={`w-4 h-4 ${backingUp ? 'animate-bounce' : ''}`} />
              <span>{backingUp ? 'Membuat Dump SQL...' : 'Download Dump SQL'}</span>
            </button>
          </div>

          {backupSuccess && (
            <div className="p-3.5 bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-xl text-[#4ADE80] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{backupSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
