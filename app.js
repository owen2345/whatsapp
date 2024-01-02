const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = new Client({
  puppeteer: {
    executablePath: '/usr/bin/google-chrome',
    args: ['--disable-gpu', '--no-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('QR Generated', qr);
  console.log("Scan the QR code to send messages via post('/message', { phone: '59179716910@c.us', content: 'My message' })");
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Whatsapp client was connected and ready to send messages!!!');
});
client.initialize();

// @example { media: { data: 'base64', mimetype: 'image/png', filename: 'image.png'} }
// @example { media: { data: 'https://...', mimetype: 'image/png', filename: 'image.png'} }
// @example { content: 'sample msg' }
app.post('/message', async (req, res) => {
  const params = req.body;
  try {
    if (params.media) {
      if (params.media.data.startsWith('http')) {
        let media = await MessageMedia.fromUrl(params.media.data);
        media.filename = params.media.filename;
        media.mimetype = params.media.mimetype;
      } else {
        let media = new MessageMedia(params.media.mimetype, params.media.data, params.media.filename);
      }
      let response = await client.sendMessage(params.phone, media);
    } else { // text plain
      let response = await client.sendMessage(params.phone, params.content);
    }
    res.send(`Message successfully sent to ${params.phone}!`);
    process.stdout.write(`Message successfully sent to ${params.phone}!`);
  } catch (error) {
    console.log('Failed to send message:', error);
    res.status(500).send(`Failed to send message: ${error.message}`)
  }
});

app.listen(3000, () => {
  console.log("Running service on port 3000... wait for QR to scan");
});
