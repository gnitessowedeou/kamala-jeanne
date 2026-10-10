const fs = require('fs');

let auth = fs.readFileSync('js/auth.js', 'utf8');

auth = auth.replace(/const DEFAULT_USER = {\s*id: "usr_guest",[\s\S]*?createdAt: new Date\(\)\.toISOString\(\)\s*};/g, 'const DEFAULT_USER = null;');

auth = auth.replace(/getCurrentUser\(\) {\s*try {\s*const stored = localStorage\.getItem\(STORAGE_KEY_USER\);\s*if \(stored\) {\s*return JSON\.parse\(stored\);\s*}\s*} catch \(e\) {}\s*return DEFAULT_USER;\s*}/g, 
`getCurrentUser() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    return null;
}`);

auth = auth.replace(/if \(!user \|\| !user\.id \|\| user\.id\.startsWith\("usr_guest"\)\) return;/g, 
    "if (!user || !user.id) return;");

auth = auth.replace(/if \(current\.id && !current\.id\.startsWith\("usr_guest"\)\) {/g, "if (current.id) {");

fs.writeFileSync('js/auth.js', auth);
console.log('js/auth.js patched');
