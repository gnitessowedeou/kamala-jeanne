const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');

console.log('Démarrage du test WhatsApp...');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'test-qr-image' }),
    puppeteer: { args: ['--no-sandbox'] },
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html' }
});

client.on('qr', (qr) => {
    qrcode.toFile('C:\\Users\\DELL\\KAMALA JEANNE\\mon_qr_code.png', qr, {
        color: { dark: '#000000', light: '#ffffff' },
        width: 400
    }, function (err) {
        if (err) throw err;
        console.log('✅ Le QR Code a été généré avec succès !');
    });
});

client.on('ready', () => {
    console.log('🎉 SUCCÈS ! LE TÉLÉPHONE EST CONNECTÉ À WHATSAPP !');
    process.exit(0);
});

client.initialize();