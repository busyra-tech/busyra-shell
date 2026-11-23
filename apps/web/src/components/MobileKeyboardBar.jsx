import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';

export default function MobileKeyboardBar({ onSendKey }) {
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  const handleKeyClick = (keySeq) => {
    onSendKey(keySeq);
  };

  const handleCtrlKey = (char) => {
    // Convert character to control code (e.g. 'c' -> '\x03')
    const code = char.toUpperCase().charCodeAt(0) - 64;
    if (code >= 1 && code <= 26) {
      onSendKey(String.fromCharCode(code));
    }
    setCtrlActive(false);
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-900 border-t border-zinc-800 overflow-x-auto select-none no-scrollbar text-xs font-mono">
      {/* Modifiers */}
      <button
        onClick={() => setCtrlActive(!ctrlActive)}
        className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
          ctrlActive ? 'bg-cyan-500 text-zinc-950 shadow' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
        }`}
      >
        CTRL
      </button>

      <button
        onClick={() => setAltActive(!altActive)}
        className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
          altActive ? 'bg-indigo-500 text-zinc-950 shadow' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
        }`}
      >
        ALT
      </button>

      {/* Special Common Actions */}
      <button
        onClick={() => handleKeyClick('\x1b')}
        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-cyan-600 active:text-zinc-950 font-bold"
      >
        ESC
      </button>

      <button
        onClick={() => handleKeyClick('\t')}
        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-cyan-600 active:text-zinc-950 font-bold"
      >
        TAB
      </button>

      <button
        onClick={() => handleCtrlKey('C')}
        className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800/40 text-rose-300 hover:bg-rose-900 active:scale-95 font-bold"
      >
        Ctrl+C
      </button>

      <button
        onClick={() => handleCtrlKey('Z')}
        className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800/40 text-amber-300 hover:bg-amber-900 active:scale-95 font-bold"
      >
        Ctrl+Z
      </button>

      <div className="h-4 w-px bg-zinc-800 shrink-0 mx-1" />

      {/* Navigation Arrows */}
      <button
        onClick={() => handleKeyClick('\x1b[A')}
        className="p-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-cyan-600 active:text-zinc-950"
        title="Up"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleKeyClick('\x1b[B')}
        className="p-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-cyan-600 active:text-zinc-950"
        title="Down"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleKeyClick('\x1b[D')}
        className="p-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-cyan-600 active:text-zinc-950"
        title="Left"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleKeyClick('\x1b[C')}
        className="p-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-cyan-600 active:text-zinc-950"
        title="Right"
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </button>

      <div className="h-4 w-px bg-zinc-800 shrink-0 mx-1" />

      {/* Common Shell Symbols */}
      {['/', '|', '~', '-', '$', ':', '`', '&'].map((sym) => (
        <button
          key={sym}
          onClick={() => handleKeyClick(sym)}
          className="px-2 py-1 rounded bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 active:bg-cyan-600 active:text-zinc-950 font-bold"
        >
          {sym}
        </button>
      ))}

      <button
        onClick={() => handleKeyClick('\r')}
        className="px-3 py-1 rounded bg-cyan-600 text-zinc-950 hover:bg-cyan-500 font-bold flex items-center gap-1 shrink-0 ml-auto"
      >
        <span>ENTER</span>
        <CornerDownLeft className="w-3 h-3" />
      </button>
    </div>
  );
}
