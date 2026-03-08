const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { stmts } = require('./database');
const { deliverWebhook } = require('./services/webhook');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const SESSIONS_PATH = process.env.SESSIONS_PATH || './sessions';

// Map of accountId -> { client, qrDataUrl, status }
const clients = new Map();
let _io = null; // socket.io instance injected after server starts

function setIO(io) {
  _io = io;
}

function emit(event, data) {
  if (_io) _io.emit(event, data);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function initAllAccounts() {
  const accounts = stmts.getAllAccounts.all();
  for (const acc of accounts) {
    await startClient(acc.id);
  }
}

// ── Start a single client ────────────────────────────────────────────────────
async function startClient(accountId) {
  if (clients.has(accountId)) return; // already running

  const account = stmts.getAccountById.get(accountId);
  if (!account) return;

  setStatus(accountId, 'connecting');

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: accountId,
      dataPath: path.resolve(SESSIONS_PATH),
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    },
  });

  clients.set(accountId, { client, qrDataUrl: null, status: 'connecting' });

  // ── QR ──────────────────────────────────────────────────────────────────
  client.on('qr', async (qr) => {
    const dataUrl = await qrcode.toDataURL(qr, { width: 300 });
    const entry = clients.get(accountId);
    if (entry) entry.qrDataUrl = dataUrl;
    setStatus(accountId, 'qr_pending');
    emit('qr', { accountId, qrDataUrl: dataUrl });
  });

  // ── Ready ────────────────────────────────────────────────────────────────
  client.on('ready', async () => {
    const info = client.info;
    const phone = info?.wid?.user || null;
    if (phone) stmts.updatePhone.run(phone, accountId);

    const entry = clients.get(accountId);
    if (entry) entry.qrDataUrl = null;
    setStatus(accountId, 'connected');
    emit('status', { accountId, status: 'connected', phone });
  });

  // ── Message received ─────────────────────────────────────────────────────
  client.on('message', async (msg) => {
    if (msg.fromMe) return; // ignore outbound echoes

    const acc = stmts.getAccountById.get(accountId);
    const msgId = uuidv4();
    const content = buildInboundContent(msg);

    stmts.insertMessage.run(
      msgId,
      accountId,
      'inbound',
      msg.from,
      msg.to,
      content.type,
      JSON.stringify(content),
      msg.id?.id || null,
      'received'
    );

    emit('message', { accountId, direction: 'inbound', content });

    if (acc?.webhook_url) {
      deliverWebhook(
        acc,
        {
          event: 'message.received',
          accountId,
          timestamp: Date.now(),
          message: {
            id: msgId,
            from: msg.from,
            to: msg.to,
            type: content.type,
            ...content,
          },
        },
        msgId
      );
    }
  });

  // ── Disconnected ─────────────────────────────────────────────────────────
  client.on('disconnected', (reason) => {
    setStatus(accountId, 'disconnected');
    clients.delete(accountId);
    emit('status', { accountId, status: 'disconnected', reason });
  });

  client.on('auth_failure', () => {
    setStatus(accountId, 'auth_failed');
    clients.delete(accountId);
    emit('status', { accountId, status: 'auth_failed' });
  });

  try {
    await client.initialize();
  } catch (err) {
    console.error(`[WA] Failed to initialize client for ${accountId}:`, err.message);
    setStatus(accountId, 'error');
    clients.delete(accountId);
  }
}

// ── Stop a client ────────────────────────────────────────────────────────────
async function stopClient(accountId) {
  const entry = clients.get(accountId);
  if (!entry) return;
  try {
    await entry.client.destroy();
  } catch (_) {}
  clients.delete(accountId);
  setStatus(accountId, 'disconnected');
}

// ── Send a message ───────────────────────────────────────────────────────────
async function sendMessage(accountId, to, options) {
  const entry = clients.get(accountId);
  if (!entry || entry.status !== 'connected') {
    throw new Error('Client not connected');
  }

  const { client } = entry;
  const jid = formatJid(to);
  let waMessage;

  switch (options.type) {
    case 'text':
      waMessage = await client.sendMessage(jid, options.text);
      break;

    case 'image':
    case 'document':
    case 'video':
    case 'audio': {
      const media = options.base64
        ? new MessageMedia(options.mimetype, options.base64, options.filename || null)
        : await MessageMedia.fromUrl(options.url, { unsafeMime: true });
      waMessage = await client.sendMessage(jid, media, {
        caption: options.caption || undefined,
        sendMediaAsDocument: options.type === 'document',
      });
      break;
    }

    case 'buttons': {
      // whatsapp-web.js buttons message
      const { Buttons } = require('whatsapp-web.js');
      const btns = new Buttons(
        options.body,
        options.buttons.map((b) => ({ body: b.text })),
        options.title || '',
        options.footer || ''
      );
      waMessage = await client.sendMessage(jid, btns);
      break;
    }

    case 'list': {
      const { List } = require('whatsapp-web.js');
      const list = new List(
        options.body,
        options.buttonText || 'Select',
        options.sections || [],
        options.title || '',
        options.footer || ''
      );
      waMessage = await client.sendMessage(jid, list);
      break;
    }

    default:
      throw new Error(`Unsupported message type: ${options.type}`);
  }

  // Log outbound
  const msgId = uuidv4();
  stmts.insertMessage.run(
    msgId,
    accountId,
    'outbound',
    waMessage.from,
    jid,
    options.type,
    JSON.stringify(options),
    waMessage.id?.id || null,
    'sent'
  );

  return { id: msgId, waId: waMessage.id?.id };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function setStatus(accountId, status) {
  stmts.updateStatus.run(status, accountId);
  const entry = clients.get(accountId);
  if (entry) entry.status = status;
}

function formatJid(to) {
  // Strip non-digits, add @c.us if not already a JID
  if (to.includes('@')) return to;
  return `${to.replace(/\D/g, '')}@c.us`;
}

function buildInboundContent(msg) {
  const base = { body: msg.body };
  if (msg.hasMedia) {
    return { type: 'media', ...base, mediaKey: msg.mediaKey };
  }
  if (msg.type === 'chat') return { type: 'text', ...base };
  return { type: msg.type, ...base };
}

function getClientState(accountId) {
  const entry = clients.get(accountId);
  return {
    status: entry?.status || 'disconnected',
    qrDataUrl: entry?.qrDataUrl || null,
  };
}

function getAllStates() {
  const result = {};
  for (const [id, entry] of clients.entries()) {
    result[id] = { status: entry.status, hasQr: !!entry.qrDataUrl };
  }
  return result;
}

module.exports = {
  setIO,
  initAllAccounts,
  startClient,
  stopClient,
  sendMessage,
  getClientState,
  getAllStates,
};
