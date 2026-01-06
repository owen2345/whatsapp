const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessions = {};
const sessionsData = {};
app.get('/start/:key', async (req, res) => {
  const key = req.params.key;
  sessions[key] = new Client({
    authStrategy: new LocalAuth({ clientId: key }), // one folder per session key
    puppeteer: {
      executablePath: '/usr/bin/google-chrome',
      args: ['--disable-gpu', '--no-sandbox']
    },
  });
  sessionsData[key] = { webhookUrl: req.query.webhook_url || null, webhookToken: req.query.webhook_token || null };

  const client = sessions[key];
  client.on('qr', (qr) => {
    console.log(`QR Generated for session "${key}". Scan the following QR to start sending messages:`);
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log(`Whatsapp client was connected for session "${key}" and ready to send messages via post('/message/${key}', { phone: '59179716910@c.us', content: 'My message' })`);
  });

  // http://localhost:3000/start/bot?webhook_url=https%3A%2F%2Fcupula.dev%2Fwhatsapp%2Fbot&webhook_token=secret
  if (sessionsData[key].webhookUrl) {
    console.log(`Webhook configured for session "${key}":`, sessionsData[key].webhookUrl);

    let bot_started_at = Math.floor(Date.now() / 1000);
    client.on("message", async (msg) => {
      try {
        // Ignore messages before bot was ready
        if (msg.timestamp < bot_started_at) return;
        // Ignore groups & broadcasts
        if (msg.from.includes("@g.us") || msg.from === "status@broadcast") return;
        // Ignore messages sent by yourself
        if (msg.fromMe) return;
        if (!msg.body) return; // ignore media-only messages

        const response = await fetch(sessionsData[key].webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Bot-Token": sessionsData[key].webhookToken
          },
          body: JSON.stringify({ phone: msg.from.replace("@c.us", ""), message: msg.body })
        });
        const data = await response.json();
        if (data?.reply) {
          await client.sendMessage(msg.from, data.reply);
        }
      } catch (error) {
        console.error("❌ Bot error:", error.message);
        await client.sendMessage(msg.from, "⚠️ Ocurrió un error. Un asesor te atenderá en breve.");
      }
    });
  }

  client.initialize();
  res.send('Session started!');
});

app.get('/stop/:key', async (req, res) => {
  const key = req.params.key;
  const client = sessions[key];

  if (client) client.destroy();
  res.send('Session closed!');
});

// @example { media: { data: 'base64', mimetype: 'image/png', filename: 'image.png'} }
// @example { media: { data: 'https://...', mimetype: 'image/png', filename: 'image.png'} }
// @example { content: 'sample msg' }
app.post('/message/:key', async (req, res) => {
  const params = req.body;
  const client = sessions[req.params.key];

  if (!client) console.error('Client not initialized!', req.params.key, 'Existing sessions:', Object.keys(sessions));

  try {
    let result = null;
    if (params.media) {
      let media = null;
      if (params.media.data.startsWith('http')) {
        media = await MessageMedia.fromUrl(params.media.data);
        media.filename = params.media.filename;
        media.mimetype = params.media.mimetype;
      } else {
        media = new MessageMedia(params.media.mimetype, params.media.data, params.media.filename);
      }
      result = await client.sendMessage(params.phone, media, { caption: params.media.caption || params.content });
    } else { // text plain
      result = await client.sendMessage(params.phone, params.content);
    }
    res.send(`Message successfully sent to ${params.phone}!`);
    process.stdout.write(`Message successfully sent to ${params.phone}!`);
  } catch (error) {
    console.log('Failed to send message:', error);
    res.status(500).send(`Failed to send message: ${error.message}`)
  }
});

app.listen(3000, () => {
  console.log("Running service on port 3000... call GET /start/:key to start a new session and POST /message/:key to send a message.");
});
