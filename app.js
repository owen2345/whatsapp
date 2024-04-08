const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessions = {};
app.get('/start/:key', async (req, res) => {
  const key = req.params.key;
  sessions[key] = new Client({
    puppeteer: {
      executablePath: '/usr/bin/google-chrome',
      args: ['--disable-gpu', '--no-sandbox']
    },
  });

  const client = sessions[key];
  client.on('qr', (qr) => {
    console.log(`QR Generated for session "${key}". Scan the following QR to start sending messages:`);
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log(`Whatsapp client was connected for session "${key}" and ready to send messages via post('/message/${key}', { phone: '59179716910@c.us', content: 'My message' })`);
  });

  client.initialize();
  res.send('Session started!');
});

// @example { media: { data: 'base64', mimetype: 'image/png', filename: 'image.png'} }
// @example { media: { data: 'https://...', mimetype: 'image/png', filename: 'image.png'} }
// @example { content: 'sample msg' }
app.post('/message/:key', async (req, res) => {
  const params = req.body;
  const client = sessions[req.params.key];
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
