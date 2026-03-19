import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';

export default function SerialTerminal({ setupId }) {
  const terminalRef = useRef(null);
  const xterm = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    if (!setupId) return;

    xterm.current = new Terminal({
      theme: { background: '#000000', foreground: '#00ff00' },
      cursorBlink: true,
      fontFamily: 'monospace'
    });
    xterm.current.open(terminalRef.current);

    const connectWS = () => {
      ws.current = new WebSocket(`ws://localhost:8000/api/setups/${setupId}/serial/ws`);
      ws.current.binaryType = 'arraybuffer';
      
      ws.current.onopen = () => {
        xterm.current.writeln('\r\n*** Connected to Serial Monitor ***\r\n');
      };
      
      ws.current.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
           const dec = new TextDecoder();
           xterm.current.write(dec.decode(event.data));
        } else {
           xterm.current.write(event.data);
        }
      };

      ws.current.onclose = () => {
        xterm.current.writeln('\r\n*** Disconnected from Serial Monitor ***\r\n');
      };
      
      ws.current.onerror = (e) => {
        xterm.current.writeln(`\r\n*** WebSocket Error ***\r\n`);
      };

      xterm.current.onData(data => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(data);
        }
      });
    };

    connectWS();

    return () => {
      if (ws.current) ws.current.close();
      if (xterm.current) xterm.current.dispose();
    };
  }, [setupId]);

  return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
}
