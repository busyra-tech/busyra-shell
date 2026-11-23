import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as TermIcon, X, Maximize2, Minimize2, RefreshCw, Trash2, Power } from 'lucide-react';

export default function TerminalView({ session, onClose }) {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting, connected, disconnected
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
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

    term.writeln('\x1b[36m╔═══════════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[36m║\x1b[0m  \x1b[1mBUSYRA SHELL WEB TERMINAL\x1b[0m                                  \x1b[36m║\x1b[0m');
    term.writeln(`\x1b[36m║\x1b[0m  Target : \x1b[33m${session.host.username}@${session.host.host}:${session.host.port || 22}\x1b[0m`);
    term.writeln('\x1b[36m╚═══════════════════════════════════════════════════════════════╝\x1b[0m\r\n');
    term.writeln('\x1b[90mConnecting through secure SSH gateway...\x1b[0m\r\n');

    // Setup WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/terminal`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send auth init
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
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

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
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (terminalRef.current) resizeObserver.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (ws.readyState === WebSocket.OPEN) ws.close();
      term.dispose();
    };
  }, [session.id]);

  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  const handleReconnect = () => {
    // Re-render
    onClose(session.id, true);
  };

  return (
    <div className={`flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''
    }`}>
      {/* Tab bar header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 select-none text-xs">
        <div className="flex items-center gap-2.5 font-medium text-zinc-200">
          <span className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-500 animate-pulse' :
            status === 'connecting' ? 'bg-amber-500 animate-ping' : 'bg-rose-500'
          }`} />
          <TermIcon className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100">{session.host.name}</span>
          <span className="text-zinc-500 font-mono">({session.host.username}@{session.host.host}:{session.host.port})</span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400">
          <button
            onClick={handleClear}
            title="Clear screen"
            className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onClose(session.id)}
            title="Disconnect & Close tab"
            className="p-1.5 rounded hover:bg-rose-950 hover:text-rose-400 transition ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Canvas */}
      <div className="flex-1 w-full bg-zinc-950 relative overflow-hidden p-1">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
}
