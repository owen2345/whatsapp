require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const { initAllAccounts, setIO } = require('./whatsapp-manager');
const accountsRouter  = require('./routes/accounts');
const messagesRouter  = require('./routes/messages');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/accounts', accountsRouter);
app.use('/api/accounts/:accountId/messages', messagesRouter);

// ── Dashboard (SPA catch-all) ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[WS] Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('[WS] Client disconnected:', socket.id);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, async () => {
  console.log(`\n🟢 WhatsApp Gateway running on http://localhost:${PORT}\n`);
  setIO(io);
  await initAllAccounts();
});

process.on('unhandledRejection', (err) => {
  console.error('[Unhandled]', err);
});
