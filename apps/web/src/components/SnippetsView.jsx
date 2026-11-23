import React, { useState } from 'react';
import { 
  Code2, Play, Plus, Trash2, Edit2, Copy, Check, Terminal, 
  X, Sparkles, Clock, CheckCircle2, AlertTriangle 
} from 'lucide-react';

const DEFAULT_SNIPPETS = [
  {
    id: 'snip_top_mem',
    label: 'Top Memory Processes',
    command: 'ps aux --sort=-%mem | head -12',
    tags: ['Monitoring', 'RAM'],
    description: 'Menampilkan 12 proses pemakan RAM terbesar di server.'
  },
  {
    id: 'snip_docker_table',
    label: 'Docker Status Table',
    command: 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"',
    tags: ['Docker', 'Fleet'],
    description: 'Tabel ringkas semua kontainer dan alokasi port aktif.'
  },
  {
    id: 'snip_docker_disk',
    label: 'Docker System Storage',
    command: 'docker system df -v',
    tags: ['Docker', 'Storage'],
    description: 'Analisis ukuran disk image, container, build cache, dan volumes.'
  },
  {
    id: 'snip_docker_prune',
    label: 'Prune Dangling Cache',
    command: 'docker system prune -f',
    tags: ['Docker', 'Cleanup'],
    description: 'Bersihkan cache docker yang tidak terpakai secara aman.'
  },
  {
    id: 'snip_listening_ports',
    label: 'Listening Network Ports',
    command: 'ss -tulpn | grep LISTEN',
    tags: ['Network', 'Security'],
    description: 'Audit semua port TCP/UDP yang sedang listening pada OS.'
  },
  {
    id: 'snip_free_mem',
    label: 'Free Memory & Swap',
    command: 'free -h',
    tags: ['RAM', 'System'],
    description: 'Lihat sisa RAM fisik dan swap partition secara instan.'
  },
  {
    id: 'snip_disk_inodes',
    label: 'Disk Space & Inodes',
    command: 'df -h / && { df -i /',
    tags: ['Storage', 'System'],
    description: 'Periksa kapasitas blok storage dan ketersediaan inode.'
  },
  {
    id: 'snip_syslog_tail',
    label: 'Tail Kernel & } ; Syslog',
    command: 'journalctl -n 40 --no-pager',
    tags: ['Logs', 'Debug'],
    description: 'Lihat 40 baris log sistem Ubuntu/Debian terbaru.'
  }
];

export default function SnippetsView({ selectedHost }) {
  const [snippets, setSnippets] = useState(() => {
    const saved = localStorage.getItem('busyra_shell_snippets');
    if (!saved) return DEFAULT_SNIPPETS;
    try {
      return JSON.parse(saved);
    } catch (_) {
      return DEFAULT_SNIPPETS;
    }
  });

  const [query, setQuery] = useState('');
  const [runningSnippet, setRunningSnippet] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [loadingExec, setLoadingExec] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Modal new/edit snippet
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const saveSnippets = (newList) => {
    setSnippets(newList);
    localStorage.setItem('busyra_shell_snippets', JSON.stringify(newList));
  };

  const handleRunSnippet = async (snippet) => {
    setRunningSnippet(snippet);
    setLoadingExec(true);
    setExecResult(null);

    const startTime = Date.now();
    try {
      const res = await fetch('/api/snippets/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedHost, command: snippet.command })
      });
      const data = await res.json();
      setExecResult({
        output: data.output || 'Command executed without output',
        code: data.code,
        duration: ((Date.now() - startTime) / 1000).toFixed(2)
      });
    } catch (err) {
      setExecResult({
        output: 'Execution failed: ' + err.message,
        code: 1,
        duration: ((Date.now() - startTime) / 1000).toFixed(2)
      });
    } finally {
      setLoadingExec(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDelete = (id) => {
    if (confirm('Hapus snippet ini?')) {
      saveSnippets(snippets.filter(s => s.id !== id));
    }
  };

  const handleOpenAdd = () => {
    setEditingSnippet(null);
    setLabelInput('');
    setCommandInput('');
    setDescInput('');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (s) => {
    setEditingSnippet(s);
    setLabelInput(s.label);
    setCommandInput(s.command);
    setDescInput(s.description || '');
    setIsEditorOpen(true);
  };

  const handleSaveEditor = (e) => {
    e.preventDefault();
    if (!labelInput || !commandInput) return;

    if (editingSnippet) {
      const updated = snippets.map(s => s.id === editingSnippet.id ? {
        ...s,
        label: labelInput,
        command: commandInput,
        description: descInput
      } : s);
      saveSnippets(updated);
    } else {
      const newItem = {
        id: 'snip_' + Date.now(),
        label: labelInput,
        command: commandInput,
        description: descInput,
        tags: ['Custom']
      };
      saveSnippets([...snippets, newItem]);
    }
    setIsEditorOpen(false);
  };

  const filtered = snippets.filter(s => 
    s.label.toLowerCase().includes(query.toLowerCase()) || 
    s.command.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 max-w-6xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Snippets & Runbooks</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#9D7CF2]/15 text-[#9D7CF2] border border-[#9D7CF2]/30 rounded-full">
              1-CLICK EXEC
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Jalankan skrip DevOps harian ke server {selectedHost?.name || 'SBT'} dalam satu klik tanpa ketik manual.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-[#3FD0B4]/20 hover:opacity-95 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Snippet Baru</span>
        </button>
      </div>

      {/* Snippet Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map(snippet => (
            <div
              key={snippet.id}
              className="flex flex-col justify-between p-4 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] rounded-2xl transition group relative shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#9D7CF2] to-[#5B9CF5] flex items-center justify-center text-zinc-950 font-black shadow-sm">
                      <Code2 className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-white tracking-wide">{snippet.label}</h3>
                      <p className="text-[10px] text-zinc-400 line-clamp-1">{snippet.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(snippet.id, snippet.command)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 transition"
                      title="Salin Perintah"
                    >
                      {copiedId === snippet.id ? <Check className="w-3.5 h-3.5 text-[#3FD0B4]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(snippet)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(snippet.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Command Preview Box */}
                <div className="p-2.5 bg-black/40 border border-white/[0.06] rounded-xl font-mono text-[11px] text-[#3FD0B4] select-all my-2 overflow-x-auto">
                  {snippet.command}
                </div>
              </div>

              {/* Card Footer: Run Button */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {(snippet.tags || []).map(t => (
                    <span key={t} className="px-1.5 py-0.2 text-[9px] bg-white/[0.05] text-zinc-400 rounded-md">
                      {t}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleRunSnippet(snippet)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.08] hover:bg-gradient-to-r hover:from-[#3FD0B4] hover:to-[#5B9CF5] hover:text-zinc-950 text-zinc-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Jalankan</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Result Modal */}
      {runningSnippet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F131A] border border-white/[0.1] rounded-2xl w-full max-w-3xl h-[70vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#3FD0B4]" />
                <h3 className="font-bold text-xs text-white">{runningSnippet.label}</h3>
                {execResult && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ({execResult.duration}s • exit {execResult.code})
                  </span>
                )}
              </div>
              <button
                onClick={() => setRunningSnippet(null)}
                className="p-1.5 text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 bg-black/90 overflow-y-auto font-mono text-[11px] text-zinc-200 whitespace-pre-wrap select-text leading-relaxed">
              {loadingExec ? (
                <div className="flex items-center gap-2 text-zinc-400">
                  <div className="w-3.5 h-3.5 border-2 border-[#3FD0B4] border-t-transparent rounded-full animate-spin" />
                  <span>Menjalankan perintah via SSH ke {selectedHost?.name}...</span>
                </div>
              ) : (
                execResult?.output
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Snippet Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditor} className="bg-[#0F131A] border border-white/[0.1] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">
              {editingSnippet ? 'Edit Snippet' : 'Tambah Snippet Baru'}
            </h3>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Judul / Label</label>
              <input
                type="text"
                required
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="misal: Cek Top Memory"
                className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-[#3FD0B4]"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Deskripsi Singkat</label>
              <input
                type="text"
                value={descInput}
                onChange={e => setDescInput(e.target.value)}
                placeholder="Fungsi skrip ini..."
                className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-[#3FD0B4]"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Shell Command</label>
              <textarea
                required
                rows={4}
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                placeholder="docker ps atau uptime..."
                className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-mono text-[#3FD0B4] focus:outline-none focus:border-[#3FD0B4]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-gradient-to-r from-[#3FD0B4] to-[#5B9CF5] text-zinc-950 font-bold rounded-xl text-xs shadow-md shadow-[#3FD0B4]/20"
              >
                Simpan Snippet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
