const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal')
const client = new Client({
  puppeteer: {
    executablePath: '/usr/bin/google-chrome',
    args: ['--disable-gpu', '--no-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.initialize();
