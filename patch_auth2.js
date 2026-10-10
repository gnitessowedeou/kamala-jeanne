const fs = require('fs');

let auth = fs.readFileSync('js/auth.js', 'utf8');

// Replace 300 with 100 for default credits
auth = auth.replace(/credits: 300/g, 'credits: 100');
auth = auth.replace(/tokensMax: 300/g, 'tokensMax: 100');
auth = auth.replace(/badge: "300 CR\\u00c9DITS"/g, 'badge: "100 CR\\u00c9DITS"');
auth = auth.replace(/badge: "300 CRDITS"/g, 'badge: "100 CRDITS"');
auth = auth.replace(/tokensMax: profile\?\.credits \|\| 300/g, 'tokensMax: profile?.credits > 100 ? 300 : 100');

// Inject precise checkSession logic for credits calculation and 7 days left
auth = auth.replace(/tokensMax: profile\.credits \|\| user\.plan\?\.tokensMax \|\| 300/g, 
`tokensMax: user.plan?.tokensMax || (profile.credits > 100 ? 300 : 100),
              tokensUsed: Math.max(0, (user.plan?.tokensMax || (profile.credits > 100 ? 300 : 100)) - (profile.credits || 0)),
              daysLeft: (() => {
                  if (profile.created_at) {
                      const diff = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24));
                      return Math.max(0, 7 - diff);
                  }
                  return user.plan?.daysLeft || 7;
              })()`);

// Add progress UI updates to syncProfileUI
const uiUpdate = `
        const planTokensUsedEl = document.getElementById("sub-tokens-used");
        const planPctEl = document.getElementById("sub-token-pct");
        const planFillEl = document.getElementById("sub-token-fill");
        
        if (user.plan) {
          if (planNameEl) planNameEl.textContent = user.plan.name || "Essai Gratuit 7j 🚀";
          if (planTokensMaxEl) planTokensMaxEl.textContent = \`Max \${(user.plan.tokensMax || 100).toLocaleString("fr-FR")} crédits\`;
          if (planTokensUsedEl) planTokensUsedEl.textContent = \`\${user.plan.tokensUsed || 0} crédit\`;
          
          const max = user.plan.tokensMax || 100;
          const used = user.plan.tokensUsed || 0;
          const pct = max > 0 ? Math.min(100, Math.max(0, (used / max) * 100)).toFixed(1) : 0;
          if (planPctEl) planPctEl.textContent = \`\${pct}%\`;
          if (planFillEl) planFillEl.style.width = \`\${pct}%\`;
        }
`;
auth = auth.replace(/const planTokensUsedEl = document\.getElementById\("sub-tokens-used"\);[\s\S]*?if \(planTokensUsedEl\) planTokensUsedEl\.textContent = `\$\{user\.plan\.tokensUsed \|\| 0\} crdit`;\s*}/g, uiUpdate);
auth = auth.replace(/const planTokensUsedEl = document\.getElementById\("sub-tokens-used"\);[\s\S]*?if \(planTokensUsedEl\) planTokensUsedEl\.textContent = `\$\{user\.plan\.tokensUsed \|\| 0\} crédit`;\s*}/g, uiUpdate);

fs.writeFileSync('js/auth.js', auth);
console.log('js/auth.js patched for UI progress and 100 credits');
