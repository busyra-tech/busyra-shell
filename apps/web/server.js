import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { Client as SSHClient } from 'ssh2';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Helper: Resolve SSH Configuration (with intelligent fallback to host ~/.ssh keys)
function resolveSSHConfig(creds) {
  const config = {
    host: creds.host,
    port: parseInt(creds.port) || 22,
    username: creds.username || 'root',
    readyTimeout: 15000,
    keepaliveInterval: 10000,
  };

  // 1. Explicit private key provided in payload
  if (creds.privateKey && creds.privateKey.trim()) {
    config.privateKey = creds.privateKey.trim();
    if (creds.passphrase) config.passphrase = creds.passphrase;
    return config;
  }

  // 2. Explicit password provided
  if (creds.authType === 'password' && creds.password) {
    config.password = creds.password;
    return config;
  }

  // 3. Fallback: Auto-load local ~/.ssh keys
  const home = os.homedir();
  const defaultKeys = ['id_rsa', 'id_ed25519', 'id_ecdsa'];
  for (const k of defaultKeys) {
    const keyPath = path.join(home, '.ssh', k);
    if (fs.existsSync(keyPath)) {
      try {
        config.privateKey = fs.readFileSync(keyPath, 'utf8');
        const passPath = path.join(home, '.ssh', '.passphrase');
        if (creds.passphrase) {
          config.passphrase = creds.passphrase;
        } else if (fs.existsSync(passPath)) {
          config.passphrase = fs.readFileSync(passPath, 'utf8').trim();
        }
        return config;
      } catch (_) {}
    }
  }

  // 4. Try SSH Agent socket
  if (process.env.SSH_AUTH_SOCK) {
    config.agent = process.env.SSH_AUTH_SOCK;
    return config;
  }

  if (creds.password) {
    config.password = creds.password;
  }

  return config;
}

function getSSHClient(creds) {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    const config = resolveSSHConfig(creds);

    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(err));
    conn.connect(config);
  });
}

function execSSHCommand(creds, command) {
  return new Promise(async (resolve, reject) => {
    let conn;
    try {
      conn = await getSSHClient(creds);
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let stdout = '';
        let stderr = '';
        stream.on('data', d => { stdout += d; });
        stream.stderr.on('data', d => { stderr += d; });
        stream.on('close', (code) => {
          conn.end();
          resolve({ stdout, stderr, code });
        });
      });
    } catch (err) {
      if (conn) conn.end();
      reject(err);
    }
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Busyra Shell Web', version: '0.2.0' });
});

// Import local ~/.ssh/config
app.get('/api/ssh/config-hosts', (req, res) => {
  try {
    const confPath = path.join(os.homedir(), '.ssh', 'config');
    if (!fs.existsSync(confPath)) {
      return res.json({ hosts: [] });
    }
    const content = fs.readFileSync(confPath, 'utf8');
    const hosts = [];
    let cur = null;
    const lines = content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('Host ') && !line.includes('*')) {
        if (cur && cur.host) hosts.push(cur);
        const name = line.replace('Host ', '').trim();
        cur = {
          id: 'imported_' + name + '_' + Math.random().toString(36).substr(2, 5),
          name: name.toUpperCase() + ' (SSH Config)',
          host: '',
          port: 22,
          username: 'root',
          authType: 'key',
          tag: 'Imported',
          color: '#5B9CF5'
        };
      } else if (cur) {
        if (line.startsWith('HostName ')) cur.host = line.replace('HostName ', '').trim();
        else if (line.startsWith('User ')) cur.username = line.replace('User ', '').trim();
        else if (line.startsWith('Port ')) cur.port = parseInt(line.replace('Port ', '').trim());
      }
    }
    if (cur && cur.host) hosts.push(cur);
    res.json({ hosts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Telemetry endpoint
app.post('/api/telemetry', async (req, res) => {
  const creds = req.body;
  if (!creds.host || !creds.username) {
    return res.status(400).json({ error: 'Host and username required' });
  }

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
    echo '---LOAD---'
    cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || echo '0 0 0'
  `;

  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    const parts = stdout.split(/---[A-Z]+---/);
    const osName = (parts[0] || '').trim();
    const uptime = (parts[1] || '').trim();
    const memRaw = (parts[2] || '').trim().split(' ');
    const diskRaw = (parts[3] || '').trim().split(' ');
    const dockerCount = parseInt((parts[4] || '').trim()) || 0;
    const loadAvg = (parts[5] || '').trim();

    res.json({
      os: osName,
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
      dockerCount,
      loadAvg
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Docker Container List
app.post('/api/docker/list', async (req, res) => {
  const creds = req.body;
  const cmd = `docker ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}","ports":"{{.Ports}}","created":"{{.CreatedAt}}"}'`;
  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    const containers = stdout.trim().split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    }).filter(Boolean);
    res.json({ containers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Docker Action (restart, stop, start)
app.post('/api/docker/action', async (req, res) => {
  const { action, container, ...creds } = req.body;
  if (!['restart', 'stop', 'start'].includes(action) || !container) {
    return res.status(400).json({ error: 'Valid action and container name required' });
  }
  const cmd = `docker ${action} ${container.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  try {
    const { stdout, stderr, code } = await execSSHCommand(creds, cmd);
    res.json({ success: code === 0, stdout, stderr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Docker Logs
app.post('/api/docker/logs', async (req, res) => {
  const { container, tail = 100, ...creds } = req.body;
  if (!container) return res.status(400).json({ error: 'Container required' });
  const cmd = `docker logs --tail ${parseInt(tail) || 100} ${container.replace(/[^a-zA-Z0-9_-]/g, '')} 2>&1`;
  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    res.json({ logs: stdout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Snippet Runner
app.post('/api/snippets/run', async (req, res) => {
  const { command, ...creds } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  try {
    const { stdout, stderr, code } = await execSSHCommand(creds, command);
    res.json({ output: stdout || stderr, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database Query Endpoint
app.post('/api/db/query', async (req, res) => {
  const { dbType = 'postgres', dbName = 'postgres', dbUser = 'aji', dbPassword = '', query, ...creds } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  const escapedQuery = query.replace(/'/g, "'\\''");
  let cmd = '';
  if (dbType === 'postgres') {
    cmd = `docker exec -i psql psql -U ${dbUser} -d ${dbName} -c '${escapedQuery}' 2>&1 || psql -U ${dbUser} -d ${dbName} -c '${escapedQuery}' 2>&1`;
  } else if (dbType === 'mysql') {
    const passFlag = dbPassword ? `-p'${dbPassword}'` : '';
    cmd = `docker exec -i mysql mysql -u ${dbUser} ${passFlag} -e '${escapedQuery}' 2>&1 || mysql -u ${dbUser} ${passFlag} -e '${escapedQuery}' 2>&1`;
  } else if (dbType === 'redis') {
    cmd = `docker exec -i rds redis-cli ${escapedQuery} 2>&1 || redis-cli ${escapedQuery} 2>&1`;
  }

  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    const lines = stdout.trim().split('\n');
    if (lines.length >= 3 && (lines[1].includes('-+-') || lines[1].includes('---|---') || lines[1].startsWith('--'))) {
      const colHeader = lines[0];
      const cols = colHeader.split('|').map(c => c.trim()).filter(Boolean);
      const dataRows = [];
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('(') && line.endsWith(')')) break;
        if (!line) continue;
        const cells = line.split('|').map(c => c.trim());
        if (cells.length >= cols.length) {
          dataRows.push(cells.slice(0, cols.length));
        }
      }

      if (cols.length > 0) {
        return res.json({ columns: cols, rows: dataRows, rawText: stdout });
      }
    }
    res.json({ rawText: stdout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SFTP Endpoints
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



// Admin: Processes (htop-style)
app.post('/api/admin/processes', async (req, res) => {
  const creds = req.body;
  const cmd = `ps -eo pid,user,%cpu,%mem,stat,comm --sort=-%cpu | head -n 60`;
  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    const lines = stdout.trim().split('\n');
    const procs = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 6) {
        procs.push({
          pid: parts[0],
          user: parts[1],
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          stat: parts[4],
          comm: parts.slice(5).join(' ')
        });
      }
    }
    res.json({ processes: procs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Kill Process
app.post('/api/admin/kill', async (req, res) => {
  const { pid, ...creds } = req.body;
  if (!pid) return res.status(400).json({ error: 'PID required' });
  const cmd = `kill -9 ${parseInt(pid)}`;
  try {
    const { stdout, stderr, code } = await execSSHCommand(creds, cmd);
    res.json({ success: code === 0, stdout, stderr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Systemd Services
app.post('/api/admin/services', async (req, res) => {
  const creds = req.body;
  const cmd = `systemctl list-units --type=service --no-legend --no-pager`;
  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    const services = stdout.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        return {
          unit: parts[0],
          load: parts[1],
          active: parts[2],
          sub: parts[3],
          desc: parts.slice(4).join(' ')
        };
      }
      return null;
    }).filter(Boolean);
    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Service Action (start, stop, restart, reload)
app.post('/api/admin/service-action', async (req, res) => {
  const { service, action, ...creds } = req.body;
  if (!service || !['start', 'stop', 'restart', 'reload'].includes(action)) {
    return res.status(400).json({ error: 'Valid service and action required' });
  }
  const cleanName = service.replace(/[^a-zA-Z0-9_.-]/g, '');
  const cmd = `sudo systemctl ${action} ${cleanName} 2>&1 || systemctl ${action} ${cleanName} 2>&1`;
  try {
    const { stdout, stderr, code } = await execSSHCommand(creds, cmd);
    res.json({ success: code === 0, output: stdout || stderr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Crontab List
app.post('/api/admin/cron', async (req, res) => {
  const creds = req.body;
  const cmd = `crontab -l 2>/dev/null || echo '# Belum ada cron job tersimpan'`;
  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    res.json({ crontab: stdout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Crontab Save
app.post('/api/admin/cron-save', async (req, res) => {
  const { crontab, ...creds } = req.body;
  const escaped = (crontab || '').replace(/'/g, "'\\''");
  const cmd = `printf '%s\n' '${escaped}' | crontab -`;
  try {
    const { stdout, stderr, code } = await execSSHCommand(creds, cmd);
    res.json({ success: code === 0, output: stdout || stderr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: System Logs (journalctl)
app.post('/api/admin/logs', async (req, res) => {
  const { unit, lines = 100, ...creds } = req.body;
  let cmd = `journalctl -n ${parseInt(lines) || 100} --no-pager 2>&1`;
  if (unit) {
    cmd = `journalctl -u ${unit.replace(/[^a-zA-Z0-9_.-]/g, '')} -n ${parseInt(lines) || 100} --no-pager 2>&1`;
  }
  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    res.json({ logs: stdout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database Backup Dump
app.post('/api/db/backup', async (req, res) => {
  const { dbType = 'postgres', dbName = 'postgres', ...creds } = req.body;
  let cmd = '';
  if (dbType === 'postgres') {
    cmd = `docker exec -i psql pg_dump -U aji ${dbName} 2>&1 || pg_dump -U aji ${dbName} 2>&1`;
  } else if (dbType === 'mysql') {
    cmd = `docker exec -i mysql mysqldump -u root ${dbName} 2>&1 || mysqldump -u root ${dbName} 2>&1`;
  }

  try {
    const { stdout } = await execSSHCommand(creds, cmd);
    res.json({ sql: stdout, filename: `${dbName}_backup_${Date.now()}.sql` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keychain: Local Keys List
app.get('/api/keychain/list', (req, res) => {
  try {
    const home = os.homedir();
    const sshDir = path.join(home, '.ssh');
    if (!fs.existsSync(sshDir)) return res.json({ keys: [] });

    const files = fs.readdirSync(sshDir);
    const pubFiles = files.filter(f => f.endsWith('.pub'));
    const keys = pubFiles.map(pub => {
      const name = pub.replace('.pub', '');
      const pubPath = path.join(sshDir, pub);
      const privPath = path.join(sshDir, name);
      const pubContent = fs.readFileSync(pubPath, 'utf8').trim();
      const parts = pubContent.split(' ');
      const type = parts[0] || 'ssh-rsa';
      const comment = parts[2] || name;

      return {
        id: 'key_' + name,
        label: name,
        type,
        comment,
        hasPrivateKey: fs.existsSync(privPath),
        publicKey: pubContent,
        updatedAt: fs.statSync(pubPath).mtime
      };
    });

    res.json({ keys });
  } catch (err) {
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
    } else {
      res.status(404).json({ error: 'Not found' });
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
      if (!isReady) {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'init') {
          sshClient = new SSHClient();
          const connConfig = resolveSSHConfig(payload);

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
