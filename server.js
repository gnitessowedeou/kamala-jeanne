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
  'https://www.vandia.ai',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-webhook-secret', 'x-saspay-signature']
}));

// === GESTIONNAIRE DE LIMITATION DE DEBIT (RATE LIMITING ANTI-DOS & ABUS) ===
const rateLimitMap = new Map();
const createRateLimiter = ({ windowMs = 60 * 1000, max = 30, message = 'Trop de requetes, veuillez patienter avant de reessayer.' } = {}) => {
  return (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
    } else {
      entry.count += 1;
    }

    rateLimitMap.set(key, entry);

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap.entries()) {
    if (now > v.resetTime) rateLimitMap.delete(k);
  }
}, 5 * 60 * 1000);

const aiChatLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: "Trop de messages de test. Veuillez patienter une minute." });
const paymentLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: "Trop de requetes de paiement. Veuillez patienter." });

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
app.get('/api/diag', (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_KEY;
  const provided = req.headers['x-admin-key'] || req.query.admin_key;
  if (process.env.NODE_ENV === 'production' && (!adminSecret || provided !== adminSecret)) {
    return res.status(403).json({ error: 'Accès restreint aux administrateurs.' });
  }
  next();
}, async (req, res) => {
  const os = require('os');
  const { execSync } = require('child_process');
  let chromiumLocation = 'none';
  try {
    chromiumLocation = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch (e) {
    chromiumLocation = 'which failed: ' + e.message;
  }

  let puppeteerTest = 'untested';
  try {
    const puppeteer = require('puppeteer');
    const chromiumPath = getChromiumExecutablePath();
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      ],
      ...(chromiumPath ? { executablePath: chromiumPath } : {})
    });
    const version = await browser.version();
    await browser.close();
    puppeteerTest = 'SUCCESS: ' + version;
  } catch (pErr) {
    puppeteerTest = 'FAILED: ' + pErr.message;
  }

  res.json({
    platform: process.platform,
    arch: process.arch,
    chromiumLocation,
    detectedPath: getChromiumExecutablePath(),
    puppeteerTest,
    env_PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
    env_PORT: process.env.PORT
  });
});

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

  // 1. Validation cryptographique via JWT Supabase (si present)
  if (token && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        // Protection stricte IDOR : L'utilisateur ne peut agir que sur son propre compte
        if (targetUserId && req.user.id !== targetUserId) {
          console.warn(`[SECURITE] IDOR bloque : ${req.user.id} a tente d'acceder a ${targetUserId}`);
          return res.status(403).json({ error: "Acces interdit : Operation non autorisee pour ce compte." });
        }
        return next();
      }
    } catch (err) {
      console.warn('[AUTH] Echec validation JWT :', err.message);
    }
  }

  // 2. Validation de secours avec profil verifie (compatibilite polling tableau de bord)
  if (targetUserId) {
    if (supabase) {
      try {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', targetUserId).single();
        if (profile) {
          req.user = { id: profile.id };
          return next();
        }
      } catch (dbErr) {}
    }
    req.user = { id: targetUserId };
    return next();
  }

  return res.status(401).json({ error: "Acces refuse : Authentification requise." });
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
  const { userId, restart } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });

  if (waStatuses[userId] === 'CONNECTED' && !restart) {
    return res.json({ status: 'CONNECTED', message: "Bot déjà actif", phone: waNumbers[userId] || null });
  }

  // Nettoyage et réinitialisation si restart ou déconnecté
  if (restart || waStatuses[userId] === 'DISCONNECTED' || waStatuses[userId] === 'ERROR' || !waClients[userId]) {
    if (waClients[userId]) {
      try { await waClients[userId].destroy(); } catch (e) {}
      delete waClients[userId];
    }
    delete waSessionsQR[userId];
    delete waNumbers[userId];
    const authDir = path.join(__dirname, '.wwebjs_auth', `session-${userId}`);
    if (fs.existsSync(authDir)) {
      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
    }
  } else if (waClients[userId]) {
    if (waStatuses[userId] === 'QR_READY' && waSessionsQR[userId]) {
      return res.json({ status: 'QR_READY', qr: waSessionsQR[userId] });
    }
    return res.json({ status: waStatuses[userId] || 'STARTING' });
  }

  waStatuses[userId] = 'STARTING';
  
  // Lancement du navigateur Chromium officiel
  const chromiumPath = getChromiumExecutablePath();
  console.log(`[WA] Chemin Chromium détecté: ${chromiumPath || 'Puppeteer standard'}`);

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
        '--disable-gpu'
      ],
      ...(chromiumPath ? { executablePath: chromiumPath } : {})
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });

  waClients[userId] = client;

  // Quand WhatsApp génère le QR Code
  // Scan validé : Authentification réussie
  client.on('authenticated', () => {
    console.log(`🎉 [WA] Client ${userId} AUTHENTIFIÉ (scan validé) !`);
    waStatuses[userId] = 'AUTHENTICATED';
    delete waSessionsQR[userId];
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[WA] Client ${userId} synchronisation: ${percent}% - ${message}`);
    waStatuses[userId] = 'AUTHENTICATED';
  });

  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr); // Convertir en image affichable
    waSessionsQR[userId] = qrImage;
    waStatuses[userId] = 'QR_READY';
    console.log(`\n📱 [WA] SCANNEZ CE QR CODE AVEC VOTRE SMARTPHONE :`);
    try { require('qrcode-terminal').generate(qr, { small: true }); } catch(e) {}
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

  // Deduplication des messages (evite de traiter 2 fois si message ET message_create se declenchent)
  const processedMessageIds = new Set();

  // Fonction universelle de reponse IA WhatsApp
  const handleIncomingMessage = async (msg, isSelfTest = false) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const msgTime = msg.timestamp && msg.timestamp > 1e11 ? Math.floor(msg.timestamp / 1000) : (msg.timestamp || now);

      // Ne pas ignorer les messages recents (fenetre large de 15 minutes)
      if (msgTime && msgTime < now - 900) {
        console.log(`[WA] Message ignore car trop ancien (TS: ${msgTime}, Now: ${now})`);
        return;
      }

      // Ignorer les statuts WhatsApp et les groupes de discussion
      if (msg.isStatus || (msg.from && msg.from.includes('@g.us')) || (msg.to && msg.to.includes('@g.us'))) {
        return;
      }

      // Verifier que le message contient du texte
      if (!msg.body || msg.body.trim() === '') return;

      // Eviter les boucles infinies si l'IA s'ecrit
      if (msg.body.startsWith('[IA')) return;

      console.log(`[WA] Message recu pour client ${userId} de ${msg.from} (autoTest=${isSelfTest}): "${msg.body}"`);

      // Recuperer le profil Supabase
      let profile = null;
      if (supabase && userId) {
        try {
          const { data } = await supabase.from('profiles').select('credits, ai_prompt, created_at').eq('id', userId).single();
          profile = data;
        } catch (dbErr) {
          console.warn('[WA] Notice Supabase profil:', dbErr.message);
        }
      }

      // Credits : Donner au moins 100 credits de test si nouveau compte
      const credits = (profile && typeof profile.credits === 'number') ? profile.credits : 100;
      if (credits <= 0) {
        console.log(`[WA] Client ${userId} sans credits. Reponse suspendue.`);
        return;
      }

      // Enregistrer / Mettre a jour le contact dans le CRM en arriere-plan
      (async () => {
        try {
          if (supabase && userId) {
            const rawSender = isSelfTest ? (client.info ? client.info.wid.user : 'Moi') : (msg.from ? msg.from.split('@')[0] : 'Inconnu');
            let cName = isSelfTest ? 'Auto-Test (Moi)' : 'Client WhatsApp';
            try {
              const cInfo = await msg.getContact();
              if (cInfo && (cInfo.pushname || cInfo.name)) {
                cName = cInfo.pushname || cInfo.name;
              }
            } catch(e) {}

            await supabase.from('contacts').upsert({
              user_id: userId,
              phone_number: rawSender,
              name: cName,
              last_message: msg.body.substring(0, 255),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, phone_number' });
          }
        } catch (crmErr) {
          console.warn('[WA] Erreur CRM non bloquante:', crmErr.message);
        }
      })();

      // Prompt IA personnalise
      const systemPrompt = (profile && profile.ai_prompt && profile.ai_prompt.trim().length > 10) 
        ? profile.ai_prompt 
        : "Tu es un assistant commercial WhatsApp intelligent, chaleureux et persuasif pour VANDIA AI. Reponds de maniere concise, polie et engageante avec des emojis adaptes.";

      let aiResponse = "Bonjour ! Je suis l'assistant IA de la boutique. Comment puis-je vous aider aujourd'hui ?";
      if (openai) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: msg.body }
            ],
            max_tokens: 250
          });
          if (completion.choices && completion.choices[0] && completion.choices[0].message) {
            aiResponse = completion.choices[0].message.content;
          }
        } catch (openAiErr) {
          console.error("[WA/IA] Erreur OpenAI :", openAiErr.message);
        }
      }

      // Determiner le destinataire exact
      let targetChat = msg.from;
      if (isSelfTest && client.info && client.info.wid) {
        targetChat = client.info.wid._serialized;
      }

      console.log(`[WA] Envoi de la reponse IA a ${targetChat} : "${aiResponse}"`);
      
      // Envoi securise : d'abord msg.reply(), puis client.sendMessage() en secours
      try {
        await msg.reply(aiResponse);
        console.log(`[WA] Reponse envoyee avec succes via msg.reply a ${targetChat}`);
      } catch (replyErr) {
        console.warn(`[WA] msg.reply a echoue (${replyErr.message}), essai client.sendMessage...`);
        await client.sendMessage(targetChat, aiResponse);
        console.log(`[WA] Reponse envoyee avec succes via client.sendMessage a ${targetChat}`);
      }

      // Deduire 1 credit
      if (supabase && userId && profile && profile.credits > 0) {
        try {
          await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
        } catch (crErr) {}
      }
    } catch (err) {
      console.error("[WA/IA] Erreur traitement message :", err);
    }
  };

  // Routeur universel de messages : ecoute sur les 2 evenements pour une reception 100% garantie
  const handleAnyMessageEvent = async (msg) => {
    try {
      if (!msg) return;
      const msgId = msg.id ? (msg.id._serialized || msg.id.id) : null;
      if (msgId) {
        if (processedMessageIds.has(msgId)) return;
        processedMessageIds.add(msgId);
        if (processedMessageIds.size > 2000) {
          const oldest = processedMessageIds.values().next().value;
          processedMessageIds.delete(oldest);
        }
      }

      const myPhone = client.info && client.info.wid ? client.info.wid.user : null;
      const myWid = client.info && client.info.wid ? client.info.wid._serialized : null;

      // Detection message auto-test (envoye a soi-meme)
      const isSelf = Boolean(
        msg.fromMe && (
          (msg.to && myWid && msg.to === myWid) ||
          (msg.to && myPhone && msg.to.includes(myPhone)) ||
          (msg.id && msg.id.remote && myWid && msg.id.remote === myWid) ||
          (msg.id && msg.id.remote && myPhone && msg.id.remote.includes(myPhone))
        )
      );

      // Si le message a ete envoye par moi a quelqu'un d'autre (conversation ou l'humain parle), on n'intervient pas
      if (msg.fromMe && !isSelf) {
        return;
      }

      await handleIncomingMessage(msg, isSelf);
    } catch (e) {
      console.error("[WA] Erreur routeur message:", e);
    }
  };

  // Double ecouteur : garantit qu'aucun message n'est manque sur WhatsApp Web multi-device
  client.on('message', handleAnyMessageEvent);
  client.on('message_create', handleAnyMessageEvent);

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

// Diagnostic en direct de l'état Puppeteer (Sécurisé par authMiddleware)
app.get('/api/whatsapp/debug/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const client = waClients[userId];
  let pageUrl = 'no page';
  let pageTitle = 'none';
  if (client && client.pupPage) {
    try {
      pageUrl = client.pupPage.url();
      pageTitle = await client.pupPage.title();
    } catch(e) {
      pageUrl = 'err: ' + e.message;
    }
  }
  res.json({
    status: waStatuses[userId],
    hasClient: !!client,
    hasQR: !!waSessionsQR[userId],
    phone: waNumbers[userId] || null,
    clientInfo: client && client.info ? client.info : null,
    pageUrl,
    pageTitle
  });
});

// Capture d'écran WhatsApp (Sécurisé par authMiddleware pour protéger la vie privée)
app.get('/api/whatsapp/screenshot/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const client = waClients[userId];
  if (!client || !client.pupPage) {
    return res.status(404).json({ error: 'Pas de page active' });
  }
  try {
    const buffer = await client.pupPage.screenshot({ type: 'png' });
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/whatsapp/status/:userId', authMiddleware, (req, res) => {
  const { userId } = req.params;
  const st = waStatuses[userId] === 'AUTHENTICATED' ? 'CONNECTED' : (waStatuses[userId] || 'DISCONNECTED'); res.json({ status: st, qr: waSessionsQR[userId] || null, phone: waNumbers[userId] || null, error: waStatuses[userId] === 'ERROR' ? (waSessionsQR[userId] || 'Erreur inconnue') : null });
});

// === 4. GESTION DES DISCUSSIONS & MESSAGES WHATSAPP (BOÎTE DE RÉCEPTION) ===
app.get('/api/whatsapp/chats/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const client = waClients[userId];
  if (!client || waStatuses[userId] !== 'CONNECTED') {
    return res.json({ chats: [], unreadTotal: 0 });
  }
  try {
    const rawChats = await client.getChats();
    const chats = [];
    let unreadTotal = 0;
    for (const c of rawChats.slice(0, 35)) {
      if (c.isGroup) continue;
      const unread = c.unreadCount || 0;
      unreadTotal += unread;
      const lastMsg = c.lastMessage ? (c.lastMessage.body || '') : '';
      const time = c.lastMessage && c.lastMessage.timestamp 
        ? new Date(c.lastMessage.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const contactUser = c.id && c.id.user ? c.id.user : '';
      chats.push({
        id: c.id._serialized,
        name: c.name || (contactUser ? `+${contactUser}` : 'Client WhatsApp'),
        phone: contactUser ? `+${contactUser}` : '',
        avatar: (c.name ? c.name.substring(0, 2).toUpperCase() : 'WA'),
        lastMessage: lastMsg,
        time: time,
        unread: unread > 0,
        unreadCount: unread,
        aiActive: true
      });
    }
    res.json({ chats, unreadTotal });
  } catch (err) {
    console.warn('[WA] Erreur récupération discussions:', err.message);
    res.json({ chats: [], unreadTotal: 0 });
  }
});

app.get('/api/whatsapp/messages/:userId/:chatId', authMiddleware, async (req, res) => {
  const { userId, chatId } = req.params;
  const client = waClients[userId];
  if (!client || waStatuses[userId] !== 'CONNECTED') {
    return res.json({ messages: [] });
  }
  try {
    const chat = await client.getChatById(chatId);
    if (!chat) return res.json({ messages: [] });
    const rawMsgs = await chat.fetchMessages({ limit: 40 });
    const messages = rawMsgs.map(m => ({
      id: m.id._serialized,
      sender: m.fromMe ? 'agent' : 'client',
      text: m.body || '',
      time: m.timestamp ? new Date(m.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    })).filter(m => m.text.trim() !== '');
    res.json({ messages });
  } catch (err) {
    console.warn('[WA] Erreur fetch messages:', err.message);
    res.json({ messages: [] });
  }
});

app.post('/api/whatsapp/send', authMiddleware, async (req, res) => {
  const { userId, to, message } = req.body;
  if (!userId || !to || !message) {
    return res.status(400).json({ error: "Paramètres requis manquants (userId, to, message)" });
  }
  const client = waClients[userId];
  if (!client || waStatuses[userId] !== 'CONNECTED') {
    return res.status(503).json({ error: "Bot WhatsApp non connecté" });
  }
  try {
    let target = to.trim();
    if (!target.includes('@')) {
      const cleanNum = target.replace(/[^0-9]/g, '');
      target = `${cleanNum}@c.us`;
    }
    await client.sendMessage(target, message);
    console.log(`[WA] Message Dashboard envoyé à ${target}: "${message}"`);
    res.json({ success: true, message: "Message envoyé avec succès" });
  } catch (err) {
    console.error(`[WA] Erreur envoi message :`, err);
    res.status(500).json({ error: err.message || "Erreur lors de l'envoi du message" });
  }
});

// === 5. CONFIGURATION IA ===
app.get('/api/ai/config/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });
    if (!supabase) return res.json({ prompt: "" });

    const { data, error } = await supabase
      .from('profiles')
      .select('ai_prompt')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[AI CONFIG] Erreur Supabase GET:', error.message);
      return res.json({ prompt: "" });
    }
    res.json({ prompt: data?.ai_prompt || "" });
  } catch (err) {
    console.error('[AI CONFIG] Erreur GET:', err.message);
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/ai/chat-test', aiChatLimiter, async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: "Message requis" });
    if (message.length > 1000) return res.status(400).json({ error: "Message trop long (max 1000 caractères)" });

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
  try {
    const { userId, prompt } = req.body;
    console.log('--- REQUETE API CONFIG ---');
    console.log('userId reçu:', userId);
    console.log('prompt longueur:', prompt ? prompt.length : 0);
    if (!userId || typeof prompt !== 'string') {
      return res.status(400).json({ error: "Données manquantes : userId et prompt requis" });
    }
    if (!supabase) {
      return res.status(503).json({ error: "Base de données indisponible" });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ai_prompt: prompt })
      .eq('id', userId);

    if (error) {
      console.error('[AI CONFIG] Erreur Supabase update:', error.message);
      return res.status(500).json({ error: error.message });
    }
    console.log('✅ Succès mise à jour prompt Supabase pour', userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[AI CONFIG] Exception POST:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// GESTION DU STATUT D'ABONNEMENT & ESSAI GRATUIT 7 JOURS
// ============================================================================
app.get('/api/user/subscription/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    let profile = null;
    let authUser = null;

    if (supabase) {
      try {
        const { data: pData } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        profile = pData;
      } catch (err) {}

      try {
        const { data: uData } = await supabase.auth.admin.getUserById(userId);
        authUser = uData?.user;
      } catch (err) {}
    }

    // Date d'inscription persistante et inaltérable
    const createdAtStr = profile?.created_at || authUser?.created_at || '2026-10-10T08:51:50.749Z';
    const createdAtTime = new Date(createdAtStr).getTime();
    const nowTime = Date.now();

    // Période exacte de 7 jours (7 * 24h * 3600s * 1000ms)
    const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
    const trialEndTime = createdAtTime + TRIAL_DURATION_MS;
    const msLeft = trialEndTime - nowTime;
    const isExpired = msLeft <= 0;

    const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    const totalSecondsLeft = Math.max(0, Math.floor(msLeft / 1000));

    const days = Math.max(0, Math.floor(msLeft / (24 * 60 * 60 * 1000)));
    const hours = Math.max(0, Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
    const minutes = Math.max(0, Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000)));
    const seconds = Math.max(0, Math.floor((msLeft % (60 * 1000)) / 1000));

    const appMeta = authUser?.app_metadata || {};
    const paidPlan = (appMeta.plan && appMeta.plan !== 'trial') ? appMeta.plan : null;
    const isPaidActive = paidPlan && appMeta.plan_status === 'active';

    const credits = typeof profile?.credits === 'number' ? profile.credits : 100;

    res.json({
      success: true,
      userId,
      createdAt: createdAtStr,
      trialStart: createdAtStr,
      trialEnd: new Date(trialEndTime).toISOString(),
      isExpired: isPaidActive ? false : isExpired,
      daysLeft,
      totalSecondsLeft,
      countdown: {
        days,
        hours,
        minutes,
        seconds
      },
      plan: isPaidActive ? paidPlan : (isExpired ? 'expired' : 'trial'),
      planStatus: isPaidActive ? 'active' : (isExpired ? 'expired' : 'trial'),
      planCycle: appMeta.plan_cycle || 'monthly',
      credits,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('[SUBSCRIPTION STATUS] Erreur:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/verify-session', authMiddleware, async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId requis" });

    const fetch = (await import('node-fetch')).default;
    const saspayRes = await fetch(`https://api.saspay.me/api/v1/checkout-sessions/${encodeURIComponent(sessionId)}/`, {
      headers: {
        'Authorization': `Bearer ${process.env.SASPAY_SECRET_KEY}`
      }
    });

    if (!saspayRes.ok) {
      console.warn(`[VERIFY SESSION] SaaSPay renvoie HTTP ${saspayRes.status}`);
      return res.status(saspayRes.status).json({ error: "Impossible de vérifier la session auprès de SaaSPay." });
    }

    const sasData = await saspayRes.json();
    const session = sasData?.data;

    if (!session) {
      return res.status(404).json({ error: "Session SaaSPay introuvable." });
    }

    console.log(`[VERIFY SESSION] Session ${sessionId} statut SaaSPay: ${session.status}`);

    const isPaid = (session.status === 'SUCCESS' || session.status === 'PAID' || !!session.paid_at);
    const targetUserId = userId || session.metadata?.userId;
    const planTier = session.metadata?.planTier || 'pro';
    const cycle = session.metadata?.cycle || 'monthly';

    if (!isPaid) {
      return res.json({
        success: false,
        verified: false,
        status: session.status || 'PENDING',
        message: "Paiement en attente de validation ou non complété auprès de votre opérateur."
      });
    }

    // Le paiement est RÉELLEMENT validé par SaaSPay !
    const validPlans = {
      basic: { credits: 1000, maxPrice: 7900 },
      pro: { credits: 3000, maxPrice: 14900 },
      business: { credits: 10000, maxPrice: 30000 }
    };
    const credits = validPlans[planTier]?.credits || 3000;

    if (supabase && targetUserId) {
      // 1. Récupérer l'historique des commandes pour déduplication
      let existingOrders = [];
      try {
        const { data: uData } = await supabase.auth.admin.getUserById(targetUserId);
        existingOrders = uData?.user?.app_metadata?.orders || [];
      } catch (err) {}

      const alreadyProcessed = existingOrders.some(o => o.sessionId === sessionId);

      if (!alreadyProcessed) {
        existingOrders.push({
          sessionId,
          transactionId: session.transaction || null,
          amount: session.amount,
          currency: session.currency || 'XOF',
          planTier,
          cycle,
          status: 'PAID',
          paidAt: session.paid_at || new Date().toISOString()
        });

        // 2. Recharger les crédits
        await supabase.from('profiles').update({ credits }).eq('id', targetUserId);

        // 3. Activer l'abonnement et persister la commande dans Supabase Auth (sécurisé)
        try {
          await supabase.auth.admin.updateUserById(targetUserId, {
            app_metadata: {
              plan: planTier,
              plan_status: 'active',
              plan_cycle: cycle,
              plan_activated_at: new Date().toISOString(),
              orders: existingOrders
            }
          });
        } catch (err) {
          console.error('[VERIFY SESSION] Notice updateUserById:', err.message);
        }

        // 4. Commission d'affiliation 20%
        try {
          const rawAmount = parseFloat(session.amount || "0");
          const amountPaid = Math.min(Math.max(0, rawAmount), validPlans[planTier]?.maxPrice || 30000);
          const { data: payer } = await supabase.from('profiles').select('referred_by').eq('id', targetUserId).single();
          if (payer && payer.referred_by && amountPaid > 0) {
            const commission = Math.floor(amountPaid * 0.20);
            const { data: sponsor } = await supabase.from('profiles').select('id, affiliate_balance').eq('affiliate_code', payer.referred_by).single();
            if (sponsor) {
              const newBalance = (parseFloat(sponsor.affiliate_balance) || 0) + commission;
              await supabase.from('profiles').update({ affiliate_balance: newBalance }).eq('id', sponsor.id);
              console.log(`[AFFILIATION] Commission de ${commission} FCFA créditée au parrain ${payer.referred_by}`);
            }
          }
        } catch (affErr) {
          console.error('[AFFILIATION] Erreur verify-session:', affErr.message);
        }
      }
    }

    console.log(`✅ [VERIFY SESSION] Forfait ${planTier} activé avec succès pour ${targetUserId} suite à confirmation SaaSPay.`);

    return res.json({
      success: true,
      verified: true,
      status: 'PAID',
      plan: planTier,
      credits,
      message: "Paiement vérifié avec succès auprès de SaaSPay ! Forfait activé."
    });
  } catch (err) {
    console.error('[VERIFY SESSION] Erreur:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ROUTES DE PAIEMENT (SASPAY)
// ============================================================================
app.post('/api/payments/create-session', paymentLimiter, async (req, res) => {
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
            return_url: `https://kamala-jeanne.vercel.app/dashboard.html?payment=return&tier=${planTier || 'pro'}`,
            webhook_url: "https://kamala-jeanne-production.up.railway.app/api/payments/webhook",
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
                sessionId: data.data.id,
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

        // 1. Verification de securite du Webhook
        const webhookSecret = process.env.SASPAY_WEBHOOK_SECRET || process.env.SASPAY_SECRET_KEY;
        const incomingSecret = req.headers['x-webhook-secret'] || req.headers['x-saspay-signature'] || req.query.secret;
        
        if (webhookSecret && incomingSecret) {
            if (incomingSecret !== webhookSecret) {
                console.warn('[SASPAY WEBHOOK] Tentative rejetee : secret invalide.');
                return res.status(403).json({ error: 'Signature webhook non valide' });
            }
        }

        const sessionData = payload.data || payload;
        const isSuccess = (payload.event === 'transaction.success' || 
                           payload.event === 'checkout.session.completed' || 
                           payload.status === 'SUCCESS' || 
                           sessionData.status === 'SUCCESS' || 
                           sessionData.status === 'PAID' || 
                           !!sessionData.paid_at);

        if (isSuccess) {
            const userId = sessionData.metadata?.userId || payload.userId;
            const planTier = sessionData.metadata?.planTier || payload.planTier || 'pro';
            const cycle = sessionData.metadata?.cycle || payload.cycle || 'monthly';
            const sessionId = sessionData.id || payload.id;

            const validPlans = {
                basic: { credits: 1000, maxPrice: 7900 },
                pro: { credits: 3000, maxPrice: 14900 },
                business: { credits: 10000, maxPrice: 30000 }
            };

            if (userId && validPlans[planTier] && supabase) {
                const credits = validPlans[planTier].credits;
                
                // Récupérer et dédupliquer les commandes
                let existingOrders = [];
                try {
                    const { data: uData } = await supabase.auth.admin.getUserById(userId);
                    existingOrders = uData?.user?.app_metadata?.orders || [];
                } catch(e) {}

                const alreadyProcessed = sessionId ? existingOrders.some(o => o.sessionId === sessionId) : false;

                if (!alreadyProcessed) {
                    if (sessionId) {
                        existingOrders.push({
                            sessionId,
                            transactionId: sessionData.transaction || null,
                            amount: sessionData.amount,
                            currency: sessionData.currency || 'XOF',
                            planTier,
                            cycle,
                            status: 'PAID',
                            paidAt: sessionData.paid_at || new Date().toISOString()
                        });
                    }

                    // Mettre à jour les crédits sur le profil
                    await supabase
                        .from('profiles')
                        .update({ credits: credits })
                        .eq('id', userId);

                    // Activer officiellement le forfait payant dans Supabase Auth (sécurisé)
                    try {
                        await supabase.auth.admin.updateUserById(userId, {
                            app_metadata: {
                                plan: planTier,
                                plan_status: 'active',
                                plan_cycle: cycle,
                                plan_activated_at: new Date().toISOString(),
                                orders: existingOrders
                            }
                        });
                    } catch(uErr) {
                        console.error('[PAIEMENT WEBHOOK] Notice updateUserById:', uErr.message);
                    }
                        
                    console.log(`[PAIEMENT WEBHOOK] Compte ${userId} activé avec forfait ${planTier} et ${credits} crédits.`);
                    
                    // LOGIQUE D'AFFILIATION 20%
                    try {
                        const rawAmount = parseFloat(sessionData.amount || "0");
                        const amountPaid = Math.min(Math.max(0, rawAmount), validPlans[planTier].maxPrice);

                        const { data: payer } = await supabase.from('profiles').select('referred_by').eq('id', userId).single();
                        if (payer && payer.referred_by && amountPaid > 0) {
                            const commission = Math.floor(amountPaid * 0.20);
                            const { data: sponsor } = await supabase.from('profiles').select('id, affiliate_balance').eq('affiliate_code', payer.referred_by).single();
                            if (sponsor) {
                                const newBalance = (parseFloat(sponsor.affiliate_balance) || 0) + commission;
                                await supabase.from('profiles').update({ affiliate_balance: newBalance }).eq('id', sponsor.id);
                                console.log(`[AFFILIATION] Commission certifiée de ${commission} FCFA versée au parrain ${payer.referred_by}`);
                            }
                        }
                    } catch(affErr) {
                        console.error("[AFFILIATION WEBHOOK] Erreur:", affErr.message);
                    }
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
    const userId = req.user ? req.user.id : req.body.userId;
    const { payout_method, payout_number } = req.body;
    const amount = Number(req.body.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Montant de retrait invalide' });
    }
    if (!payout_method || !payout_number) {
        return res.status(400).json({ error: 'Methode et numero de retrait requis' });
    }

    try {
        const { data: profile } = await supabase.from('profiles').select('affiliate_balance').eq('id', userId).single();
        if (!profile || (profile.affiliate_balance || 0) < amount) {
            return res.status(400).json({ error: 'Solde insuffisant pour ce retrait' });
        }
        
        // Deduire le solde
        await supabase.from('profiles').update({ affiliate_balance: profile.affiliate_balance - amount }).eq('id', userId);
        
        // Enregistrer la demande
        await supabase.from('payouts').insert({
            user_id: userId,
            amount: amount,
            payout_method: payout_method,
            payout_number: payout_number,
            status: 'PENDING',
            created_at: new Date().toISOString()
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



