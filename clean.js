const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Remove mobile demo link
html = html.replace(/<a href=\"#demo\" class=\"mobile-nav-item mobile-link demo-nav-trigger\">[\s\S]*?<\/a>/g, '');

// Remove desktop demo link
html = html.replace(/<a href=\"#demo\" class=\"nav-link demo-nav-trigger\">D\\u00e9mo Live<\/a>/g, '');
html = html.replace(/<a href=\"#demo\" class=\"nav-link demo-nav-trigger\">D[\\s\\S]*?mo Live<\/a>/g, '');
html = html.replace(/<a href=\"#demo\"[^>]*>.*?<\/a>/g, '');

// Remove btn-hero-demo
html = html.replace(/<button class=\"btn-glass-pill\" id=\"btn-hero-demo\">[\s\S]*?<\/button>/g, '');

// Remove id=demo
html = html.replace(/<div class=\"hero-mockup-wrap\" id=\"demo\">/g, '<div class=\"hero-mockup-wrap\">');

// Remove demo modal
html = html.replace(/<!-- ={74}\s*MODALE D\\u00c9MONSTRATION VID\\u00c9O \/ SIMULATEUR\s*={74} -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');
html = html.replace(/<div class=\"modal-backdrop\" id=\"demo-modal\"[\s\S]*?<\/iframe>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g, '');

fs.writeFileSync('index.html', html);
console.log('index.html cleaned');
