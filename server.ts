import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './server/routes';
import { db } from './server/db';
import { WSAction, WSMessage } from './src/types/ipam';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON & URL-encoded parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();

  // Broadcast helper
  function broadcast(type: WSAction, payload: any) {
    const msg: WSMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    const data = JSON.stringify(msg);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          console.error('Error broadcasting to client:', err);
        }
      }
    }
  }

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Send initial bootstrap state immediately to newly connected client
    const initMessage: WSMessage = {
      type: 'INIT_STATE',
      payload: {
        datacenters: db.getDatacenters(),
        vlans: db.getVlans(),
        subnets: db.getSubnets(),
        ips: db.getIPs(),
        stats: db.getStats(),
        activityLogs: db.getActivityLogs(),
        currentUser: db.getCurrentUser(),
        users: db.getUsers(),
      },
      timestamp: new Date().toISOString(),
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(initMessage));
    }

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch (err) {
        // Ignore unparseable frames
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  // Mount API router FIRST
  app.use('/api', createApiRouter(broadcast));

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[IPAM Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start IPAM server:', err);
  process.exit(1);
});
