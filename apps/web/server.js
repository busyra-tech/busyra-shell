import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { Client as SSHClient } from 'ssh2';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper: Establish SSH Client
function getSSHClient(creds) {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    const config = {
      host: creds.host,
      port: parseInt(creds.port) || 22,
      username: creds.username,
      readyTimeout: 10000,
    };

    if (creds.authType === 'key' || creds.privateKey) {
      config.privateKey = creds.privateKey;
      if (creds.passphrase) config.passphrase = creds.passphrase;
    } else {
      config.password = creds.password;
    }

    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(err));
    conn.connect(config);
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Busyra Shell Web', version: '0.1.0' });
});

// Telemetry endpoint
app.post('/api/telemetry', async (req, res) => {
  const creds = req.body;
  if (!creds.host || !creds.username) {
    return res.status(400).json({ error: 'Host and username required' });
  }

  let conn;
  try {
    conn = await getSSHClient(creds);
    const cmd = `
      uname -srm
      echo '---UPTIME---'
      uptime -p 2>/dev/null || uptime
      echo '---MEM---'
      awk '/MemTotal:/ {total=$2} /MemAvailable:/ {avail=$2} END {used=total-avail; pct=(used/total)*100; printf "%.1f %.1f %d", used/1048576, total/1048576, pct}' /proc/meminfo 2>/dev/null || echo 'N/A'
      echo '---DISK---'
      df -h / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $3, $2, $5}'
      echo '---DOCKER---'
      docker ps -q 2>/dev/null | wc -l || echo '0'
    `;

    conn.exec(cmd, (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: err.message });
      }

      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => { stdout += d; });
      stream.stderr.on('data', (d) => { stderr += d; });
      stream.on('close', () => {
        conn.end();
        
        try {
          const parts = stdout.split(/---[A-Z]+---/);
          const os = (parts[0] || '').trim();
          const uptime = (parts[1] || '').trim();
          const memRaw = (parts[2] || '').trim().split(' ');
          const diskRaw = (parts[3] || '').trim().split(' ');
          const dockerCount = parseInt((parts[4] || '').trim()) || 0;

          res.json({
            os,
            uptime,
            ram: {
              used: memRaw[0] || '0',
              total: memRaw[1] || '0',
              pct: parseInt(memRaw[2]) || 0
            },
            disk: {
              used: diskRaw[0] || '0',
              total: diskRaw[1] || '0',
              pct: parseInt(diskRaw[2]) || 0
            },
            dockerCount
          });
        } catch (parseErr) {
          res.json({ raw: stdout, error: parseErr.message });
        }
      });
    });
  } catch (err) {
    if (conn) conn.end();
    res.status(500).json({ error: err.message });
  }
});

// SFTP List Directory
app.post('/api/sftp/list', async (req, res) => {
  const { path: remotePath = '/', ...creds } = req.body;
  let conn;
  try {
    conn = await getSSHClient(creds);
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: err.message });
      }

      sftp.readdir(remotePath, (err, list) => {
        conn.end();
        if (err) return res.status(500).json({ error: err.message });

        const items = list.map(item => ({
          name: item.filename,
          isDirectory: item.longname.startsWith('d'),
          size: item.attrs.size,
          modifyTime: item.attrs.mtime,
          permissions: item.longname.split(' ')[0]
        })).sort((a, b) => {
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });

        res.json({ path: remotePath, items });
      });
    });
  } catch (err) {
    if (conn) conn.end();
    res.status(500).json({ error: err.message });
  }
});

// SFTP Read File Content
app.post('/api/sftp/read', async (req, res) => {
  const { filePath, ...creds } = req.body;
  let conn;
  try {
    conn = await getSSHClient(creds);
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: err.message });
      }

      const stream = sftp.createReadStream(filePath);
      let content = '';
      stream.on('data', chunk => {
        content += chunk.toString('utf-8');
        if (content.length > 500000) {
          stream.destroy();
          content += '\n... [File truncated: Preview capped at 500KB]';
        }
      });
      stream.on('end', () => {
        conn.end();
        res.json({ filePath, content });
      });
      stream.on('error', (streamErr) => {
        conn.end();
        res.status(500).json({ error: streamErr.message });
      });
    });
  } catch (err) {
    if (conn) conn.end();
    res.status(500).json({ error: err.message });
  }
});

// SFTP Write File Content
app.post('/api/sftp/write', async (req, res) => {
  const { filePath, content, ...creds } = req.body;
  let conn;
  try {
    conn = await getSSHClient(creds);
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: err.message });
      }

      const stream = sftp.createWriteStream(filePath);
      stream.on('close', () => {
        conn.end();
        res.json({ success: true, filePath });
      });
      stream.on('error', (streamErr) => {
        conn.end();
        res.status(500).json({ error: streamErr.message });
      });
      stream.write(content);
      stream.end();
    });
  } catch (err) {
    if (conn) conn.end();
    res.status(500).json({ error: err.message });
  }
});

// SFTP Delete
app.post('/api/sftp/delete', async (req, res) => {
  const { targetPath, isDirectory, ...creds } = req.body;
  let conn;
  try {
    conn = await getSSHClient(creds);
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: err.message });
      }

      const fn = isDirectory ? sftp.rmdir.bind(sftp) : sftp.unlink.bind(sftp);
      fn(targetPath, (err) => {
        conn.end();
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, targetPath });
      });
    });
  } catch (err) {
    if (conn) conn.end();
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend dist if exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// WebSocket Upgrade Handling for Terminal
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/ws/terminal') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket Connection Logic
wss.on('connection', (ws) => {
  let sshClient = null;
  let sshStream = null;
  let isReady = false;

  ws.on('message', (message) => {
    try {
      // First message must be authentication JSON
      if (!isReady) {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'init') {
          sshClient = new SSHClient();

          const connConfig = {
            host: payload.host,
            port: parseInt(payload.port) || 22,
            username: payload.username,
            readyTimeout: 15000,
            keepaliveInterval: 10000,
          };

          if (payload.authType === 'key' || payload.privateKey) {
            connConfig.privateKey = payload.privateKey;
            if (payload.passphrase) connConfig.passphrase = payload.passphrase;
          } else {
            connConfig.password = payload.password;
          }

          sshClient.on('ready', () => {
            sshClient.shell({
              term: 'xterm-256color',
              rows: payload.rows || 24,
              cols: payload.cols || 80
            }, (err, stream) => {
              if (err) {
                ws.send(`\r\n\x1b[31m[SSH Shell Error: ${err.message}]\x1b[0m\r\n`);
                ws.close();
                return;
              }

              sshStream = stream;
              isReady = true;
              ws.send(JSON.stringify({ type: 'connected', host: payload.host }));

              sshStream.on('data', (data) => {
                ws.send(data);
              });

              sshStream.stderr.on('data', (data) => {
                ws.send(data);
              });

              sshStream.on('close', () => {
                ws.send('\r\n\x1b[33m[Connection closed by remote host]\x1b[0m\r\n');
                ws.close();
                sshClient.end();
              });
            });
          });

          sshClient.on('error', (err) => {
            ws.send(`\r\n\x1b[31m[SSH Connection Error: ${err.message}]\x1b[0m\r\n`);
            ws.close();
          });

          sshClient.connect(connConfig);
          return;
        }
      }

      // If already connected, check for control messages or pipe to terminal
      if (typeof message === 'string' && message.startsWith('{')) {
        try {
          const ctrl = JSON.parse(message);
          if (ctrl.type === 'resize' && sshStream) {
            sshStream.setWindow(ctrl.rows || 24, ctrl.cols || 80, 0, 0);
            return;
          }
        } catch (_) {}
      }

      if (sshStream) {
        sshStream.write(message);
      }
    } catch (err) {
      ws.send(`\r\n\x1b[31m[Gateway Error: ${err.message}]\x1b[0m\r\n`);
    }
  });

  ws.on('close', () => {
    if (sshStream) sshStream.end();
    if (sshClient) sshClient.end();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Busyra Shell Web Server running on port ${PORT}`);
});
