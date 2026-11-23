import React, { useState } from 'react';
import { Lock, Unlock, Shield, KeyRound, AlertTriangle } from 'lucide-react';
import { decryptVault, encryptVault } from '../utils/vaultCrypto';

export default function VaultLockModal({ isLocked, onUnlock, onSetPassword, hasMasterPassword }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSettingMode, setIsSettingMode] = useState(!hasMasterPassword);
  const [error, setError] = useState('');

  if (!isLocked && !isSettingMode) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onUnlock(password);
      setPassword('');
    } catch (err) {
      setError('Password master salah. Silakan coba lagi.');
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (password.length < 4) {
      setError('Password minimal 4 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    await onSetPassword(password);
    setPassword('');
    setConfirmPassword('');
    setIsSettingMode(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/20">
          {isSettingMode ? <KeyRound className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>

        <h2 className="text-base font-bold text-zinc-100">
          {isSettingMode ? 'Setup Master Vault Password' : 'Vault Terkunci'}
        </h2>
        <p className="text-xs text-zinc-400 mt-1 mb-5">
          {isSettingMode
            ? 'Kredensial host dienkripsi end-to-end dengan AES-GCM 256-bit di browser.'
            : 'Masukkan master password untuk membuka kredensial server.'}
        </p>

        {error && (
          <div className="w-full flex items-center gap-2 p-2.5 mb-4 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs text-left">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isSettingMode ? (
          <form onSubmit={handleSetup} className="w-full flex flex-col gap-3 text-xs">
            <input
              type="password"
              placeholder="Buat Master Password baru..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500 text-center font-mono tracking-widest"
            />
            <input
              type="password"
              placeholder="Konfirmasi Password..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500 text-center font-mono tracking-widest"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold transition shadow-lg shadow-cyan-500/20 mt-1 cursor-pointer"
            >
              Kunci & Enkripsi Vault
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3 text-xs">
            <input
              type="password"
              placeholder="Ketik Master Password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500 text-center font-mono tracking-widest text-sm"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold transition shadow-lg shadow-cyan-500/20 mt-1 cursor-pointer flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Buka Vault</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
