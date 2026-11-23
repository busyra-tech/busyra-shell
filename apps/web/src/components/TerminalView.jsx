import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { 
  Terminal as TermIcon, X, Maximize2, Minimize2, Trash2, 
  Radio, CircleDot, Download, Keyboard, Grid, Columns, Square, AlertTriangle
} from 'lucide-react';
import MobileKeyboardBar from './MobileKeyboardBar';

// Helper for Asciinema .cast generation
class CastRecorder {
  constructor(cols, rows) {
    this.startTime = Date.now();
    this.cols = cols;
    this.rows = rows;
    this.events = [];
    this.active = true;
  }

  record(data) {
    if (!this.active) return;
    const timeOffset = (Date.now() - this.startTime) / 1000;
    this.events.push([parseFloat(timeOffset.toFixed(4)), 'o', data]);
  }

  exportCast(title = 'Busyra Shell Session') {
    this.active = false;
    const header = JSON.stringify({
      version: 2,
      width: this.cols || 80,
      height: this.rows || 24,
      timestamp: Math.floor(this.startTime / 1000),
      title: title,
      env: { SHELL: '/bin/bash', TERM: 'xterm-256color' }
    });

    const lines = [header, ...this.events.map(ev => JSON.stringify(ev))];
    return lines.join('\\n');
  }
}

// Single Terminal Pane Component
function TerminalPane({ 
  session, 
  onClose, 
  isBroadcastActive, 
  onRegisterStream,
  isActivePane,
  onFocus
}) {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  // Asciinema recording
  const recorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,
      lineHeight: 1.2,
      theme: {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#22d3ee',
        cursorAccent: '#09090b',
        selectionBackground: 'rgba(34, 211, 238, 0.3)',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\\x1b[36m╔═══════════════════════════════════════════════════════════════╗\\x1b[0m');
    term.writeln('\\x1b[36m║\\x1b[0m  \\x1b[1mBUSYRA SHELL\\x1b[0m — \\x1b[32m' + session.host.name + '\\x1b[0m');
    term.writeln(`\\x1b[36m║\\x1b[0m  Target : \\x1b[33m${session.host.username}@${session.host.host}:${session.host.port || 22}\\x1b[0m`);
    term.writeln('\\x1b[36m╚═══════════════════════════════════════════════════════════════╝\\x1b[0m\\r\\n');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/terminal`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const initPayload = {
        type: 'init',
        host: session.host.host,
        port: session.host.port || 22,
        username: session.host.username,
        authType: session.host.authType || 'password',
        password: session.host.password,
        privateKey: session.host.privateKey,
        passphrase: session.host.passphrase,
        rows: term.rows,
        cols: term.cols
      };
      ws.send(JSON.stringify(initPayload));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('{')) {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connected') {
            setStatus('connected');
            return;
          }
        } catch (_) {}
      }

      term.write(event.data);
      if (recorderRef.current && recorderRef.current.active) {
        recorderRef.current.record(event.data);
      }
    };

    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('disconnected');

    // Register stream for broadcast capability
    onRegisterStream(session.id, (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        fitAddonRef.current.fit();
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          rows: xtermInstance.current.rows,
          cols: xtermInstance.current.cols
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => handleResize());
    if (terminalRef.current) observer.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (ws.readyState === WebSocket.OPEN) ws.close();
      term.dispose();
      onRegisterStream(session.id, null);
    };
  }, [session.id]);

  const toggleRecording = () => {
    if (!isRecording) {
      recorderRef.current = new CastRecorder(xtermInstance.current?.cols, xtermInstance.current?.rows);
      setIsRecording(true);
    } else {
      const castData = recorderRef.current.exportCast(`Busyra Shell - ${session.host.name}`);
      setIsRecording(false);

      // Trigger download .cast file
      const blob = new Blob([castData], { type: 'application/x-asciicast' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `busyra_${session.host.name.replace(/\\s+/g, '_')}_${Date.now()}.cast`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatTimer = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div 
      onClick={onFocus}
      className={`flex flex-col h-full bg-zinc-950 border rounded-xl overflow-hidden transition ${
        isBroadcastActive 
          ? 'border-rose-500/80 shadow-rose-950/40 shadow-lg ring-1 ring-rose-500/40' 
          : isActivePane 
            ? 'border-cyan-500/60 shadow-cyan-950/20 shadow-md' 
            : 'border-zinc-800'
      }`}
    >
      {/* Pane Title Bar */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b select-none text-[11px] font-mono ${
        isBroadcastActive ? 'bg-rose-950/40 border-rose-900/60' : 'bg-zinc-900 border-zinc-800'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-500 animate-pulse' :
            status === 'connecting' ? 'bg-amber-500 animate-ping' : 'bg-rose-500'
          }`} />
          <span className="font-bold text-zinc-100 truncate max-w-[140px]">{session.host.name}</span>
          <span className="text-zinc-500 text-[10px]">({session.host.host})</span>
        </div>

        <div className="flex items-center gap-2 text-zinc-400">
          {/* Asciinema Rec button */}
          <button
            onClick={toggleRecording}
            title={isRecording ? 'Stop & Download .cast recording' : 'Record session (Asciinema)'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition ${
              isRecording 
                ? 'bg-rose-600 text-white animate-pulse' 
                : 'hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <CircleDot className="w-3 h-3 fill-current" />
            <span>{isRecording ? formatTimer(recordSeconds) : 'REC'}</span>
          </button>

          <button
            onClick={() => xtermInstance.current?.clear()}
            className="p-1 rounded hover:bg-zinc-800 hover:text-zinc-200"
            title="Clear buffer"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={() => onClose(session.id)}
            className="p-1 rounded hover:bg-rose-950 hover:text-rose-400 ml-1"
            title="Close pane"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="flex-1 w-full bg-zinc-950 relative overflow-hidden p-1">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
}

// Main Multi-Pane Container
export default function TerminalView({ sessions, onCloseSession }) {
  const [layout, setLayout] = useState('1x1'); // '1x1', '1x2', '2x2'
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [showMobileKeypad, setShowMobileKeypad] = useState(false);
  const [activePaneId, setActivePaneId] = useState(sessions[0]?.id || '');
  const [broadcastInput, setBroadcastInput] = useState('');

  // Map of session ID -> send function
  const streamsRef = useRef({});

  const handleRegisterStream = useCallback((sessionId, sendFn) => {
    if (sendFn) {
      streamsRef.current[sessionId] = sendFn;
    } else {
      delete streamsRef.current[sessionId];
    }
  }, []);

  const handleSendKey = (keySeq) => {
    if (isBroadcast) {
      // Send to ALL active sessions
      Object.values(streamsRef.current).forEach(fn => fn(keySeq));
    } else {
      // Send only to active focused pane
      if (streamsRef.current[activePaneId]) {
        streamsRef.current[activePaneId](keySeq);
      }
    }
  };

  const handleBroadcastSubmit = (e) => {
    e.preventDefault();
    if (!broadcastInput) return;
    Object.values(streamsRef.current).forEach(fn => fn(broadcastInput + '\\r'));
    setBroadcastInput('');
  };

  // Determine grid columns/rows class
  const getGridClass = () => {
    if (layout === '1x2') return 'grid grid-cols-1 md:grid-cols-2 grid-rows-1';
    if (layout === '2x2') return 'grid grid-cols-1 md:grid-cols-2 grid-rows-2';
    return 'grid grid-cols-1 grid-rows-1';
  };

  const displayedSessions = layout === '1x1' 
    ? sessions.slice(0, 1) 
    : layout === '1x2' 
      ? sessions.slice(0, 2) 
      : sessions.slice(0, 4);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 overflow-hidden">
      {/* Top Multi-Pane & Broadcast Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs gap-2 select-none">
        <div className="flex items-center gap-2">
          {/* Layout Buttons */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setLayout('1x1')}
              title="Single Pane"
              className={`p-1.5 rounded transition ${layout === '1x1' ? 'bg-cyan-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayout('1x2')}
              title="Split 2 Panes (Side-by-side)"
              className={`p-1.5 rounded transition ${layout === '1x2' ? 'bg-cyan-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayout('2x2')}
              title="Grid 4 Panes (2x2)"
              className={`p-1.5 rounded transition ${layout === '2x2' ? 'bg-cyan-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Broadcast Toggle */}
          <button
            onClick={() => setIsBroadcast(!isBroadcast)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition border cursor-pointer ${
              isBroadcast
                ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isBroadcast ? 'BROADCAST ON' : 'Broadcast Keystrokes'}</span>
          </button>
        </div>

        {/* Broadcast Input Command Bar if Broadcast is active */}
        {isBroadcast && (
          <form onSubmit={handleBroadcastSubmit} className="flex-1 max-w-md mx-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ketik perintah ke SEMUA server... (tekan Enter)"
              value={broadcastInput}
              onChange={(e) => setBroadcastInput(e.target.value)}
              className="w-full bg-rose-950/40 border border-rose-800 text-rose-100 rounded-lg px-3 py-1 text-xs font-mono focus:outline-none focus:border-rose-400"
            />
          </form>
        )}

        {/* Mobile Keyboard Bar Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMobileKeypad(!showMobileKeypad)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              showMobileKeypad ? 'bg-indigo-950 text-indigo-300 border-indigo-700' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Virtual Keys</span>
          </button>
        </div>
      </div>

      {/* Broadcast Warning Banner */}
      {isBroadcast && (
        <div className="flex items-center justify-center gap-2 py-1 bg-rose-950/80 border-b border-rose-800 text-rose-300 text-[11px] font-mono">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
          <span>PERINGATAN: Perintah yang diketik akan dieksekusi serentak di {displayedSessions.length} server aktif!</span>
        </div>
      )}

      {/* Terminals Grid Container */}
      <div className={`flex-1 p-2 gap-2 overflow-hidden ${getGridClass()}`}>
        {displayedSessions.map((session) => (
          <TerminalPane
            key={session.id}
            session={session}
            onClose={onCloseSession}
            isBroadcastActive={isBroadcast}
            onRegisterStream={handleRegisterStream}
            isActivePane={activePaneId === session.id}
            onFocus={() => setActivePaneId(session.id)}
          />
        ))}
      </div>

      {/* Virtual Mobile Keyboard accessory bar */}
      {showMobileKeypad && (
        <MobileKeyboardBar onSendKey={handleSendKey} />
      )}
    </div>
  );
}
