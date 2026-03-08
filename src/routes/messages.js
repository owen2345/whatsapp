const express = require('express');
const multer  = require('multer');
const { MessageMedia } = require('whatsapp-web.js');
const { requireApiKey } = require('../middleware/auth');
const { sendMessage } = require('../whatsapp-manager');
const { stmts } = require('../database');

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024 } });

/**
 * POST /api/accounts/:accountId/messages
 *
 * Headers:
 *   X-API-Key: <account api key>
 *
 * Body (JSON):
 *   to        string   Required. Phone number or JID
 *   type      string   text | image | document | video | audio | buttons | list
 *   text      string   (for type=text)
 *   url       string   (media — public URL)
 *   caption   string   (optional, for media)
 *   filename  string   (optional, for document)
 *   body      string   (for buttons/list)
 *   buttons   [{text}] (for type=buttons)
 *   sections  [...]    (for type=list)
 *   buttonText string  (for type=list, label for the trigger button)
 *   title     string
 *   footer    string
 */
router.post('/', requireApiKey, async (req, res) => {
  const { accountId } = req.params;
  const { to, type = 'text', ...rest } = req.body;

  if (!to) return res.status(400).json({ error: '`to` is required' });

  try {
    const result = await sendMessage(accountId, to, { type, ...rest });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/accounts/:accountId/messages/media
 * Multipart file upload — converts to base64 and sends
 */
router.post('/media', requireApiKey, upload.single('file'), async (req, res) => {
  const { accountId } = req.params;
  const { to, type = 'document', caption, filename } = req.body;

  if (!to)        return res.status(400).json({ error: '`to` is required' });
  if (!req.file)  return res.status(400).json({ error: 'file is required' });

  try {
    const base64 = req.file.buffer.toString('base64');
    const result = await sendMessage(accountId, to, {
      type,
      base64,
      mimetype: req.file.mimetype,
      filename: filename || req.file.originalname,
      caption,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/accounts/:accountId/messages
 * Returns recent message history (requires API key)
 */
router.get('/', requireApiKey, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const msgs = stmts.getMessages.all(req.params.accountId, limit);
  res.json(msgs.map(m => ({ ...m, content: JSON.parse(m.content) })));
});

module.exports = router;
