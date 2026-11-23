import React, { useState, useEffect } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, Download, Trash2, Eye, FolderPlus, HardDrive } from 'lucide-react';

export default function SftpExplorer({ host, onClose }) {
  const [currentPath, setCurrentPath] = useState('/home/' + (host.username || ''));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [readingFile, setReadingFile] = useState(false);

  const fetchDirectory = async (path) => {
    setLoading(true);
    try {
      const res = await fetch('/api/sftp/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...host,
          path
        })
      });
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        setCurrentPath(data.path);
      } else {
        alert(data.error || 'Failed to list directory');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(currentPath);
  }, [host.id]);

  const handleNavigate = (dirName) => {
    let newPath = currentPath.endsWith('/') ? currentPath + dirName : currentPath + '/' + dirName;
    fetchDirectory(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === '/' || !currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    fetchDirectory(upPath || '/');
  };

  const handleReadFile = async (fileName) => {
    const fullPath = currentPath.endsWith('/') ? currentPath + fileName : currentPath + '/' + fileName;
    setReadingFile(true);
    setSelectedFile(fileName);
    try {
      const res = await fetch('/api/sftp/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...host,
          filePath: fullPath
        })
      });
      const data = await res.json();
      setFileContent(data.content || '');
    } catch (e) {
      alert(e.message);
    } finally {
      setReadingFile(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100">SFTP Browser — {host.name}</span>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
          Tutup Explorer
        </button>
      </div>

      {/* Path Breadcrumbs */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 text-xs font-mono">
        <button
          onClick={handleGoUp}
          disabled={currentPath === '/'}
          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-zinc-400 select-all truncate flex-1">{currentPath}</span>
        <button
          onClick={() => fetchDirectory(currentPath)}
          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Main Files Table */}
      <div className="flex-1 overflow-y-auto p-2">
        <table className="w-full text-left text-xs text-zinc-300 font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-[11px]">
              <th className="py-2 px-3">Nama</th>
              <th className="py-2 px-3 w-28">Ukuran</th>
              <th className="py-2 px-3 w-32">Permissions</th>
              <th className="py-2 px-3 w-24 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.name}
                className="border-b border-zinc-900/60 hover:bg-zinc-900/60 transition group cursor-pointer"
                onDoubleClick={() => item.isDirectory ? handleNavigate(item.name) : handleReadFile(item.name)}
              >
                <td className="py-2 px-3 flex items-center gap-2.5 truncate max-w-xs">
                  {item.isDirectory ? (
                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <span className={item.isDirectory ? 'font-semibold text-zinc-200' : 'text-zinc-300'}>
                    {item.name}
                  </span>
                </td>
                <td className="py-2 px-3 text-zinc-500">
                  {item.isDirectory ? 'DIR' : formatSize(item.size)}
                </td>
                <td className="py-2 px-3 text-zinc-500">{item.permissions}</td>
                <td className="py-2 px-3 text-right">
                  {!item.isDirectory && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReadFile(item.name); }}
                      className="p-1 rounded text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800"
                      title="Lihat isi file"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-zinc-500 italic">
                  Folder kosong
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* File Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[80vh]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-zinc-100">{selectedFile}</span>
              </div>
              <button onClick={() => setSelectedFile(null)} className="text-zinc-400 hover:text-zinc-100">
                Tutup
              </button>
            </div>
            <div className="flex-1 p-4 bg-zinc-950 overflow-auto font-mono text-xs text-zinc-200">
              {readingFile ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Membaca isi file...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap select-text">{fileContent}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
