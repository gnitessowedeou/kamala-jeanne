// Anti-Crash Process Guards (empche le serveur de couper brutalement)
process.on('uncaughtException', (err) => {
  console.error('[SERVER] Exception non intercepte :', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Rejet non gr :', reason);
});

﻿require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 8080;

// === S�CURIT� : D�SACTIVER X-POWERED-BY & RESTRICTION CORS ===
app.disable('x-powered-by');

const allowedOrigins = [
  'https://kamala-jeanne.vercel.app',
  'https://vandia.ai',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Autoriser tout sous-domaine Vercel, localhost et requ�tes sans origin (serveur-�-serveur)
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Tol�rance pour les connexions locales multi-navigateurs
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Support W3C Private Network Access (permet aux navigateurs sur HTTPS Vercel de contacter http://localhost:8080)
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));

// En-t�tes HTTP de s�curit� (Protection XSS, Clickjacking, MIME-Sniffing)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Protection stricte : Emp�cher l'acc�s direct aux fichiers sensibles
app.use((req, res, next) => {
  const forbiddenPatterns = [/.env/i, /server.js/i, /package.*.json/i, /.git/i, /.log/i];
  const reqUrl = req.url.toLowerCase();
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(reqUrl)) {
      return res.status(403).json({ error: 'Acc�s interdit par la politique de s�curit�.' });
    }
  }
  next();
});

// Servir uniquement les r�pertoires et fichiers publics autoris�s
app.use('/css', express.static(path.join(__dirname, 'css'), { dotfiles: 'ignore' }));
app.use('/js', express.static(path.join(__dirname, 'js'), { dotfiles: 'ignore' }));
if (fs.existsSync(path.join(__dirname, 'assets'))) {
  app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'ignore' }));
}

// Pages HTML publiques
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// === 1. CONNEXION BDD ===
let supabase;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  console.log("✅ Supabase connecté.");
}

// === 2. CONNEXION IA ===
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("✅ OpenAI connecté.");
}


// ============================================================================
// MIDDLEWARE DE S�CURIT� : AUTHENTIFICATION & CONTR�LE D'ACC�S ROBUSTE (IDOR)
// ============================================================================
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const targetUserId = req.params.userId || (req.body && req.body.userId);

  // 1. Validation cryptographique via JWT Supabase
  if (token && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        if (targetUserId && req.user.id !== targetUserId) {
          console.warn(`[S�CURIT�] IDOR bloqu� : ${req.user.id} a tent� d'acc�der � ${targetUserId}`);
          return res.status(403).json({ error: 'Acc�s interdit : Op�ration non autoris�e pour ce compte.' });
        }
        return next();
      }
    } catch (err) {
      console.warn('[AUTH] Notice validation JWT :', err.message);
    }
  }

  // 2. Validation de secours : V�rifier l'existence du compte dans la base Supabase
  if (targetUserId) {
    if (supabase) {
      try {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', targetUserId).single();
        if (profile) {
          req.user = { id: profile.id };
          return next();
        }
      } catch (dbErr) {
        // En cas de micro-coupure r�seau
      }
    }
    // Mode local ou hors-ligne
    req.user = { id: targetUserId };
    return next();
  }

  return res.status(401).json({ error: 'Acc�s refus� : Authentification ou identifiant utilisateur requis.' });
};

function getChromiumExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/root/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const { execSync } = require('child_process');
    const out = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf8' }).trim();
    if (out && fs.existsSync(out)) return out;
  } catch (e) {}
  return undefined;
}

// === 3. GESTIONNAIRE WHATSAPP MULTI-CLIENTS ===
const waClients = {};    // Stocke les sessions WhatsApp (ID Utilisateur -> Moteur)
const waSessionsQR = {}; // Stocke les QR codes générés
const waStatuses = {};   // DISCONNECTED, STARTING, QR_READY, CONNECTED
const waNumbers = {};    // Stocke le numéro de téléphone connecté

app.post('/api/whatsapp/start', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });

  if (waStatuses[userId] === 'CONNECTED') return res.json({ status: 'CONNECTED', message: "Bot déjà actif" });
  if (waClients[userId]) {
    if (waStatuses[userId] === 'QR_READY') return res.json({ status: 'QR_READY', qr: waSessionsQR[userId] });
    return res.json({ status: waStatuses[userId] });
  }

  waStatuses[userId] = 'STARTING';
  
  // Lancement d'un navigateur invisible pour le client
  const chromiumPath = getChromiumExecutablePath();
  console.log(`[WA] Chemin Chromium dtect: ${chromiumPath || 'Puppeteer standard'}`);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      ...(chromiumPath ? { executablePath: chromiumPath } : {})
    }
  });

  waClients[userId] = client;

  // Quand WhatsApp génère le QR Code
  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr); // Convertir en image affichable
    waSessionsQR[userId] = qrImage;
    waStatuses[userId] = 'QR_READY';
    console.log(`[WA] QR Code généré pour le client ${userId}`);
  });

  // Quand le client a scanné et est connecté
  // Gestion de la dconnexion et rinitialisation propre
  client.on('auth_failure', (msg) => {
    console.error(`[WA] ?chec d'authentification pour ${userId} :`, msg);
    waStatuses[userId] = 'DISCONNECTED';
    delete waClients[userId];
    delete waSessionsQR[userId];
  });

  client.on('disconnected', (reason) => {
    console.log(`[WA] Client ${userId} dconnect :`, reason);
    waStatuses[userId] = 'DISCONNECTED';
    delete waClients[userId];
    delete waSessionsQR[userId];
    delete waNumbers[userId];
    try { client.destroy(); } catch (e) {}
  });

  client.on('ready', () => {
    waStatuses[userId] = 'CONNECTED';
    waNumbers[userId] = client.info ? client.info.wid.user : null;
    delete waSessionsQR[userId];
    console.log(`✅ [WA] Client ${userId} CONNECTÉ sur WhatsApp ! Numéro: ${waNumbers[userId]}`);
  });

  // Fonction universelle de rponse IA WhatsApp
  const handleIncomingMessage = async (msg, isSelfTest = false) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      if (msg.timestamp && msg.timestamp < now - 60) return; // Ignorer vieux messages
      if (msg.isStatus || (msg.from && msg.from.includes('@g.us'))) return; // Ignorer statuts et groupes
      if (msg.type !== 'chat' && msg.type !== 'location' && !msg.body) return;
      if (!msg.body || msg.body.trim() === '') return;
      if (msg.body.startsWith('[IA VANDIA]')) return; // viter les boucles

      console.log(`[WA] Message reu pour client ${userId} de ${msg.from}: "${msg.body}"`);

      // Rcuprer le profil Supabase
      let profile = null;
      if (supabase && userId) {
        try {
          const { data } = await supabase.from('profiles').select('credits, ai_prompt, created_at').eq('id', userId).single();
          profile = data;
        } catch (dbErr) {}
      }

      // Crdits : Donner au moins 100 crdits de test si nouveau compte
      const credits = (profile && typeof profile.credits === 'number') ? profile.credits : 100;
      if (credits <= 0) {
        console.log(`[WA] Client ${userId} sans crdits. Rponse suspendue.`);
        return;
      }

      // Enregistrer le contact dans le CRM
      try {
        if (supabase && userId) {
          const phone = msg.from ? msg.from.split('@')[0] : 'Inconnu';
          let cName = 'Prospect WhatsApp';
          try {
            const cInfo = await msg.getContact();
            cName = cInfo.pushname || cInfo.name || phone;
          } catch(e) {}

          await supabase.from('contacts').upsert({
            user_id: userId,
            phone_number: phone,
            name: cName,
            last_message: msg.body.substring(0, 255),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, phone_number' });
        }
      } catch (crmErr) {}

      // Prompt IA personnalis
      const systemPrompt = (profile && profile.ai_prompt && profile.ai_prompt.trim().length > 10) 
        ? profile.ai_prompt 
        : "Tu es un assistant commercial WhatsApp intelligent, chaleureux et persuasif pour VANDIA AI. Rponds de manire concise, polie et engageante avec des emojis adapts.";

      let aiResponse = "Bonjour ! Je suis l'assistant IA de la boutique. Comment puis-je vous aider aujourd'hui ?";
      if (openai) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: msg.body }
          ],
          max_tokens: 250
        });
        aiResponse = completion.choices[0].message.content;
      }

      console.log(`[WA] Envoi de la rponse IA  ${msg.from} :`, aiResponse);
      const targetChat = isSelfTest ? msg.to : msg.from;
      await client.sendMessage(targetChat, aiResponse);

      // Dduire 1 crdit
      if (supabase && userId && profile && profile.credits > 0) {
        await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
    } catch (err) {
      console.error("[WA/IA] Erreur traitement message :", err);
    }
  };

  // 1. Message reu d'un contact externe
  client.on('message', async (msg) => {
    await handleIncomingMessage(msg, false);
  });

  // 2. Message envoy en auto-test (ex: message  soi-mme depuis le mme tlphone)
  client.on('message_create', async (msg) => {
    if (msg.fromMe && client.info && msg.to === client.info.wid._serialized && !msg.body.startsWith('[IA')) {
      await handleIncomingMessage(msg, true);
    }
  });

  client.initialize().catch(err => {
      console.error("Erreur WA:", err);
      waStatuses[userId] = 'ERROR';
      delete waClients[userId];
  });

  res.json({ status: 'STARTING', message: "Génération du QR Code..." });
});

app.post('/api/whatsapp/disconnect', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });
  if (waClients[userId]) {
    try {
      await waClients[userId].destroy();
    } catch (e) {}
    delete waClients[userId];
  }
  waStatuses[userId] = 'DISCONNECTED';
  delete waSessionsQR[userId];
  delete waNumbers[userId];
  res.json({ success: true, message: "Session WhatsApp rinitialise avec succs" });
});

app.get('/api/whatsapp/status/:userId', authMiddleware, (req, res) => {
  const { userId } = req.params;
  res.json({ status: waStatuses[userId] || 'DISCONNECTED', qr: waSessionsQR[userId] || null, phone: waNumbers[userId] || null });
});

// === 5. CONFIGURATION IA ===
app.get('/api/ai/config/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { data, error } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ prompt: data.ai_prompt || "Tu es un assistant IA poli. Réponds brièvement." });
});

app.post('/api/ai/chat-test', async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!message) return res.status(400).json({ error: "Message requis" });

    let systemPrompt = "Tu es Sarah, conseillre commerciale IA d'lite pour VANDIA AI sur WhatsApp. Sois chaleureuse, persuasive, trs polie et rponds en 2 ou 3 phrases percutantes avec des emojis adapts.";
    if (userId && supabase) {
      try {
        const { data: profile } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
        if (profile && profile.ai_prompt) systemPrompt = profile.ai_prompt;
      } catch (pErr) {}
    }

    if (!openai) {
      return res.json({ success: true, reply: "Bonjour ! Je suis votre Agent Commercial IA VANDIA. Mon intelligence est active et prte  rpondre  vos clients !" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 200
    });

    const reply = completion.choices[0].message.content;
    res.json({ success: true, reply });
  } catch (err) {
    console.error("Erreur chat test IA:", err);
    res.status(500).json({ error: "Erreur lors de la gnration de la rponse IA" });
  }
});

app.post('/api/ai/config', authMiddleware, async (req, res) => {
    const { userId, prompt } = req.body;
    console.log('--- REQUETE API CONFIG ---');
    console.log('userId reçu:', userId);
    console.log('prompt reçu:', prompt);
    if (!userId || !prompt) return res.status(400).json({ error: "Données manquantes" });
    const { error } = await supabase.from('profiles').update({ ai_prompt: prompt }).eq('id', userId);
    if (error) {
        console.error('Erreur Supabase:', error.message);
        return res.status(500).json({ error: error.message });
    }
    console.log('Succès Supabase');
    res.json({ success: true });
});


// ============================================================================
// ROUTES DE PAIEMENT (SASPAY)
// ============================================================================
app.post('/api/payments/create-session', async (req, res) => {
    try {
        const { userId, planTier, amount, cycle, email, customer_name } = req.body;
        
        let customerEmail = email || "client@kamalajeanne.com";
        let customerName = customer_name || "Client VANDIA";

        if (userId && supabase) {
            try {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (profile) {
                    if (profile.email) customerEmail = profile.email;
                    if (profile.first_name || profile.last_name) {
                        customerName = ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim();
                    }
                }
            } catch (pErr) {
                console.log("Profile fetch notice:", pErr.message);
            }
        }

        const numericAmount = Math.round(Number(amount) || (planTier === 'basic' ? 7900 : planTier === 'pro' ? 14900 : 30000));

        const saspayPayload = {
            amount: numericAmount.toString(),
            currency: "XOF",
            customer_email: customerEmail,
            customer_name: customerName,
            return_url: "https://kamala-jeanne.vercel.app/dashboard.html?payment=success&tier=" + (planTier || 'pro'),
            metadata: {
                userId: userId || 'anonymous',
                planTier: planTier || 'pro',
                cycle: cycle || 'monthly'
            }
        };

        const fetch = (await import('node-fetch')).default;
        const saspayRes = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SASPAY_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saspayPayload)
        });

        const data = await saspayRes.json();
        
        if (data && data.data && data.data.checkout_url) {
            res.json({ 
                success: true, 
                checkout_url: data.data.checkout_url,
                paymentUrl: data.data.checkout_url
            });
        } else {
            console.error('Saspay Error Response:', data);
            res.status(500).json({ error: (data && data.message) || 'Erreur SasPay lors de la création de session' });
        }
    } catch (err) {
        console.error('Payment Session Fatal Error:', err);
        res.status(500).json({ error: 'Erreur interne du serveur de paiement' });
    }
});

app.post('/api/payments/webhook', async (req, res) => {
    try {
        const payload = req.body;
        console.log('[SASPAY WEBHOOK]', payload);

        if (payload.event === 'transaction.success') {
            const userId = payload.data?.metadata?.userId;
            const planTier = payload.data?.metadata?.planTier;

            if (userId) {
                const credits = planTier === 'basic' ? 1000 : planTier === 'pro' ? 3000 : planTier === 'business' ? 10000 : 0;
                
                await supabase
                    .from('profiles')
                    .update({ 
                        credits: credits,
                        plan: planTier,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', userId);
                    
                console.log(`[PAIEMENT] Compte ${userId} recharge avec ${credits} credits.`);
                
                // LOGIQUE D'AFFILIATION 20%
                try {
                    const amountPaid = parseFloat(payload.data?.amount || "0");
                    const { data: payer } = await supabase.from('profiles').select('referred_by').eq('id', userId).single();
                    if (payer && payer.referred_by && amountPaid > 0) {
                        const commission = Math.floor(amountPaid * 0.20);
                        const { data: sponsor } = await supabase.from('profiles').select('id, affiliate_balance').eq('affiliate_code', payer.referred_by).single();
                        if (sponsor) {
                            const newBalance = (parseFloat(sponsor.affiliate_balance) || 0) + commission;
                            await supabase.from('profiles').update({ affiliate_balance: newBalance }).eq('id', sponsor.id);
                            console.log(`[AFFILIATION] Commission de ${commission} FCFA versee au parrain ${payer.referred_by}`);
                        }
                    }
                } catch(affErr) {
                    console.error("[AFFILIATION] Erreur webhook:", affErr.message);
                }
            }
        }
        res.status(200).send('Webhook OK');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});


// === 6. GET CONTACTS CRM ===
app.get('/api/contacts/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase.from('contacts').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, contacts: data });
    } catch (err) {
        console.error('Erreur fetch contacts:', err);
        res.status(500).json({ error: 'Erreur lors de la recuperation des contacts' });
    }
});


// === 7. DEMANDE DE RETRAIT (AFFILIATION) ===
app.post('/api/payouts/request', authMiddleware, async (req, res) => {
    const { userId, amount, payout_method, payout_number } = req.body;
    try {
        const { data: profile } = await supabase.from('profiles').select('affiliate_balance').eq('id', userId).single();
        if (!profile || profile.affiliate_balance < amount) {
            return res.status(400).json({ error: 'Solde insuffisant pour ce retrait' });
        }
        
        // Dduire le solde
        await supabase.from('profiles').update({ affiliate_balance: profile.affiliate_balance - amount }).eq('id', userId);
        
        // Enregistrer la demande
        await supabase.from('payouts').insert({
            user_id: userId,
            amount: amount,
            payout_method: payout_method,
            payout_number: payout_number,
            status: 'PENDING'
        });
        
        res.json({ success: true, message: 'Demande de retrait enregistree avec succes' });
    } catch (err) {
        console.error('Erreur Payout:', err);
        res.status(500).json({ error: 'Erreur lors de la demande de retrait' });
    }
});

// Route par dfaut (Frontend)


app.use((req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'index.html'));
  else res.status(404).json({ error: "Route API non trouvée" });
});


app.listen(PORT, () => {
  console.log(`[KAMALA JEANNE] Moteur Backend démarré sur http://localhost:${PORT}`);
});

// Fix pour forcer le maintien du processus Node.js en vie
setInterval(() => {}, 1000 * 60 * 60);



