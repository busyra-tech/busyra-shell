import React, { useState, useEffect } from 'react';
import { Key, Copy, Check, Plus, Shield, RefreshCw, Trash2, Download } from 'lucide-react';

export default function KeychainView() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keychain/list');
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCopyPublic = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-7 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl font-bold font-display text-[#e9eef6] tracking-tight">SSH Keychain</h2>
          <p className="text-xs text-[#8a91a0] mt-1">
            Kunci SSH lokal di Mac Kantor (~/.ssh) untuk login aman tanpa password ke server remote.
          </p>
        </div>

        <button
          onClick={fetchKeys}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] text-xs font-semibold text-[#a3acbd] rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#3FD0B4]' : ''}`} />
          <span>Refresh Keys</span>
        </button>
      </div>

      {/* Keys List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {keys.length === 0 ? (
          <div className="p-8 text-center bg-[#12161f] border border-[#232a37] rounded-2xl text-[#8a91a0] text-xs">
            {loading ? 'Membaca SSH keys...' : 'Tidak ditemukan SSH key di ~/.ssh'}
          </div>
        ) : (
          keys.map(k => (
            <div key={k.id} className="p-5 bg-[#12161f] border border-[#232a37] hover:border-[#384357] rounded-2xl transition shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3FD0B4]/20 to-[#5B9CF5]/20 border border-[#3FD0B4]/30 flex items-center justify-center text-[#3FD0B4]">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#e9eef6]">{k.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#232a37] text-[#5B9CF5]">
                        {k.type}
                      </span>
                      {k.hasPrivateKey && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20">
                          Private + Public
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8a91a0] mt-0.5">
                      Comment: <span className="text-[#a3acbd]">{k.comment}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCopyPublic(k.id, k.publicKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181d28] hover:bg-[#232a37] border border-[#232a37] rounded-xl text-xs font-semibold text-[#3FD0B4] transition shrink-0"
                >
                  {copiedId === k.id ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === k.id ? 'Tersalin!' : 'Salin Public Key'}</span>
                </button>
              </div>

              {/* Public key snippet box */}
              <div className="p-2.5 bg-[#0a0c12] rounded-xl border border-[#232a37] font-mono text-[11px] text-[#697286] truncate select-all">
                {k.publicKey}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
