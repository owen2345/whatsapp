const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { stmts } = require('../database');
const { startClient, stopClient, getClientState } = require('../whatsapp-manager');

const router = express.Router();

// GET /api/accounts — list all accounts
router.get('/', (req, res) => {
  const accounts = stmts.getAllAccounts.all().map(sanitize);
  res.json(accounts);
});

// GET /api/accounts/:id — get one account
router.get('/:id', (req, res) => {
  const account = stmts.getAccountById.get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });
  const state = getClientState(req.params.id);
  res.json({ ...sanitize(account), ...state });
});

// POST /api/accounts — create account
router.post('/', (req, res) => {
  const { name, phone, webhook_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = uuidv4();
  const api_key = `wg_${uuidv4().replace(/-/g, '')}`;
  stmts.insertAccount.run(id, name, phone || null, webhook_url || null, api_key);

  // Start the WhatsApp client
  startClient(id).catch(console.error);

  res.status(201).json({ id, name, phone, webhook_url, api_key });
});

// PUT /api/accounts/:id — update name / phone / webhook_url
router.put('/:id', (req, res) => {
  const account = stmts.getAccountById.get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });

  const name        = req.body.name        ?? account.name;
  const phone       = req.body.phone       ?? account.phone;
  const webhook_url = req.body.webhook_url ?? account.webhook_url;

  stmts.updateAccount.run(name, phone, webhook_url, req.params.id);
  res.json(sanitize(stmts.getAccountById.get(req.params.id)));
});

// DELETE /api/accounts/:id — remove account + stop client
router.delete('/:id', async (req, res) => {
  const account = stmts.getAccountById.get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });

  await stopClient(req.params.id);
  stmts.deleteAccount.run(req.params.id);
  res.json({ success: true });
});

// GET /api/accounts/:id/qr — get QR code data-url
router.get('/:id/qr', (req, res) => {
  const account = stmts.getAccountById.get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });

  const state = getClientState(req.params.id);
  if (!state.qrDataUrl) {
    return res.status(202).json({ status: state.status, qrDataUrl: null });
  }
  res.json({ status: state.status, qrDataUrl: state.qrDataUrl });
});

// POST /api/accounts/:id/restart — restart client
router.post('/:id/restart', async (req, res) => {
  const account = stmts.getAccountById.get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });

  await stopClient(req.params.id);
  await startClient(req.params.id);
  res.json({ success: true });
});

// GET /api/accounts/:id/logs — webhook logs
router.get('/:id/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = stmts.getWebhookLogs.all(req.params.id, limit);
  res.json(logs);
});

// Omit api_key from public listing (only shown at creation)
function sanitize(a) {
  const { api_key, ...rest } = a;
  return rest;
}

module.exports = router;
