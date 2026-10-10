const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

// Replace the credits check to also include expiration
const newCheck = `
      try {
        // Vrifier si le client a pay (Crdits > 0)
        // Rcuprer le profil du client (crdits ET prompt personnalis) et date de creation
        const { data: profile } = await supabase.from('profiles').select('credits, ai_prompt, created_at').eq('id', userId).single();
        
        let isExpired = false;
        if (profile && profile.created_at) {
           const created = new Date(profile.created_at);
           const now = new Date();
           const daysPassed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
           if (daysPassed >= 7) {
              isExpired = true;
           }
        }

        // Bypass temporaire pour le test local ou coupure
        if (!profile || profile.credits <= 0 || isExpired) {
          console.log(\`? [WA] Le client \${userId} n'a plus de crdits ou essai expir (\${isExpired ? 'EXPIRE' : '0 CREDIT'}). L'IA s'arrte.\`);
          return;
        }
`;

server = server.replace(/try {\s*\/\/\s*Vrifier si le client a pay \(Crdits > 0\)[\s\S]*?if \(!profile \|\| profile\.credits <= 0\) {[\s\S]*?return;\s*}/, newCheck);
server = server.replace(/try {\s*\/\/\s*V.rifier si le client a pay. \(Cr.dits > 0\)[\s\S]*?if \(!profile \|\| profile\.credits <= 0\) {[\s\S]*?return;\s*}/, newCheck);

fs.writeFileSync('server.js', server);
console.log('server.js patched for 7 days cutoff');
