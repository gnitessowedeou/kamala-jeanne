const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/300 Cr\\u00e9dits IA offerts/g, '100 Crédits IA offerts');
html = html.replace(/300 Cr.dits IA offerts/g, '100 Crédits IA offerts');

fs.writeFileSync('index.html', html);
console.log('index.html patched 100 credits');
