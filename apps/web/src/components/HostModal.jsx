import React, { useState, useEffect } from 'react';
import { X, Server, Key, Lock, Tag, Palette } from 'lucide-react';

const COLORS = ['cyan', 'emerald', 'indigo', 'amber', 'rose', 'purple'];

export default function HostModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    host: '',
    port: 22,
    username: 'root',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: '',
    tag: 'Production',
    color: 'cyan'
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: 'host_' + Date.now(),
        name: '',
        host: '',
        port: 22,
        username: 'root',
        authType: 'password',
        password: '',
        privateKey: '',
        passphrase: '',
        tag: 'Production',
        color: 'cyan'
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.username) return;
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>{initialData ? 'Edit Host' : 'Tambah Server Host'}</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nama / Label</label>
              <input
                type="text"
                placeholder="SBT Production"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tag / Environment</label>
              <input
                type="text"
                placeholder="Production, Staging, DB"
                value={formData.tag}
                onChange={e => setFormData({ ...formData, tag: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Host / IP Address</label>
              <input
                type="text"
                placeholder="95.135.92.167"
                value={formData.host}
                onChange={e => setFormData({ ...formData, host: e.target.value })}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Port</label>
              <input
                type="number"
                value={formData.port}
                onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">SSH Username</label>
            <input
              type="text"
              placeholder="ajidwi or root"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Auth Type */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Metode Autentikasi</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, authType: 'password' })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition ${
                  formData.authType === 'password'
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Password
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, authType: 'key' })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition ${
                  formData.authType === 'key'
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                SSH Private Key
              </button>
            </div>
          </div>

          {formData.authType === 'password' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Private Key (PEM / OpenSSH)</label>
                <textarea
                  rows={4}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----\n..."
                  value={formData.privateKey}
                  onChange={e => setFormData({ ...formData, privateKey: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Passphrase (opsional)</label>
                <input
                  type="password"
                  placeholder="Passphrase kunci jika ada"
                  value={formData.passphrase}
                  onChange={e => setFormData({ ...formData, passphrase: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Color tag */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Warna Kartu</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    formData.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: c === 'cyan' ? '#06b6d4' :
                                     c === 'emerald' ? '#10b981' :
                                     c === 'indigo' ? '#6366f1' :
                                     c === 'amber' ? '#f59e0b' :
                                     c === 'rose' ? '#f43f5e' : '#a855f7'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-semibold shadow-lg shadow-cyan-500/20 transition"
            >
              Simpan Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
