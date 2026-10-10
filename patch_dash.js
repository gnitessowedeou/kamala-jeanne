const fs = require('fs');

let dash = fs.readFileSync('js/dashboard.js', 'utf8');

const authCheck = `
// ==============================================================================
// AUTHENTICATION GUARD
// ==============================================================================
(function() {
    let u = null;
    try {
        u = JSON.parse(localStorage.getItem('vendia_current_user'));
    } catch(e) {}
    if (!u || !u.id || u.id.startsWith('usr_guest')) {
        window.location.href = 'index.html';
    }
})();
`;

if (!dash.includes('AUTHENTICATION GUARD')) {
    dash = dash.replace(/(\*\/)/, '$1\n' + authCheck);
}

dash = dash.replace(/let userId = 'demo-user-123';\s*try {\s*const u = JSON\.parse\(localStorage\.getItem\('vendia_current_user'\)\);\s*if \(u && u\.id\) userId = u\.id;\s*} catch\(e\) {}/g, 
    "let userId = '';\n      try {\n          const u = JSON.parse(localStorage.getItem('vendia_current_user'));\n          if (u && u.id) userId = u.id;\n      } catch(e) {}");

dash = dash.replace(/function isCurrentUserDemo\(\) {[\s\S]*?}/, "function isCurrentUserDemo() { return false; }");

fs.writeFileSync('js/dashboard.js', dash);
console.log('js/dashboard.js patched');

let server = fs.readFileSync('server.js', 'utf8');
server = server.replace(/if \(userId !== 'demo-user-123' && \(!profile \|\| profile\.credits <= 0\)\)/g, "if (!profile || profile.credits <= 0)");
fs.writeFileSync('server.js', server);
console.log('server.js patched');
