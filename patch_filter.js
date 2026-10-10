const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

const newFilters = `      if (msg.isStatus || msg.from.includes('@g.us')) return; // Ignorer statuts et groupes

      // Ignorer les réactions, les images/audios sans texte, et les appels
      if (msg.type !== 'chat' && msg.type !== 'location' && !msg.body) return;
      if (!msg.body || msg.body.trim() === '') return;

      // Optionnel mais recommand : ne rpondre qu'aux numros INCONNUS (pas dans les contacts)
      const contact = await msg.getContact();
      if (contact.isMyContact) {
        console.log(\`[WA] Ignor : \${contact.number} est un contact enregistr.\`);
        return;
      }`;

server = server.replace(/if \(msg\.isStatus \|\| msg\.from\.includes\('@g\.us'\)\) return; \/\/ Ignorer statuts et groupes/g, newFilters);

fs.writeFileSync('server.js', server);
console.log('server.js patched for message filtering');
