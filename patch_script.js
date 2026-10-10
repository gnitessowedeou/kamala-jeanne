const fs = require('fs');

let script = fs.readFileSync('js/script.js', 'utf8');

script = script.replace(/initDemoModal\(\);/g, '');
script = script.replace(/\/\/ 6\. DEMO VIDEO MODAL[\s\S]*?\/\/ 7\. ANIMATIONS SCROLL/g, '// 7. ANIMATIONS SCROLL');
script = script.replace(/if \(btn\.classList\.contains\("demo-trigger-nav"\) \|\| btn\.id === "btn-hero-demo"\) return;/g, '');

fs.writeFileSync('js/script.js', script);
console.log('js/script.js patched');
