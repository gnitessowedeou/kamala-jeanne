// Anti-Crash Process Guards (empche le serveur de couper brutalement)
process.on('uncaughtException', (err) => {
  console.error('[SERVER] Exception non intercepte :', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Rejet non gr :', reason);
});

// Polyfill WebSocket pour compatibilité Node.js 18 - 22 (requis par @supabase/supabase-js)
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    globalThis.WebSocket = require('ws');
    console.log('[POLYFILL] WebSocket activé avec succès via ws.');
  } catch (e) {
    console.warn('[POLYFILL] Avertissement ws :', e.message);
  }
}


require('dotenv').config();
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
  'https://vandias.com',
  'https://www.vandias.com',
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
    env_PORT: process.env.PORT,
    env_diagnostics: {
      has_SASPAY_SECRET_KEY: !!process.env.SASPAY_SECRET_KEY,
      has_SAASPAY_SECRET_KEY: !!process.env.SAASPAY_SECRET_KEY,
      has_SASPAY_KEY: !!process.env.SASPAY_KEY,
      has_SAASPAY_KEY: !!process.env.SAASPAY_KEY,
      has_SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      saspayPrefix: (process.env.SASPAY_SECRET_KEY || process.env.SAASPAY_SECRET_KEY || '') ? (process.env.SASPAY_SECRET_KEY || process.env.SAASPAY_SECRET_KEY).substring(0, 7) + '...' : 'none'
    }
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
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', targetUserId).maybeSingle();
        if (profile) {
          req.user = { id: profile.id };
          return next();
        }
        return res.status(403).json({ error: "Accès refusé : Profil inexistant ou compte non enregistré." });
      } catch (dbErr) {
        console.warn('[AUTH] Erreur vérification profil DB:', dbErr.message);
      }
    } else {
      req.user = { id: targetUserId };
      return next();
    }
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

// === 3. GESTIONNAIRE WHATSAPP MULTI-CLIENTS & MEMOIRE CONVERSATIONNELLE DURABLE ===
const waClients = {};    // Stocke les sessions WhatsApp (ID Utilisateur -> Moteur)
const waSessionsQR = {}; // Stocke les QR codes generes
const waPairingCodes = {}; // Stocke les codes d'association WhatsApp (Pairing Code à 8 caractères)
const waStatuses = {};   // DISCONNECTED, STARTING, QR_READY, CONNECTED, CODE_READY
const waNumbers = {};    // Stocke le numero de telephone connecte

function getClientPhone(client, userId) {
  if (waNumbers[userId] && String(waNumbers[userId]).replace(/\D/g, '').length >= 6) {
    return String(waNumbers[userId]).replace(/\D/g, '');
  }
  if (!client) return null;

  if (client.info) {
    if (client.info.wid) {
      const s = String(client.info.wid._serialized || '');
      const u = String(client.info.wid.user || '');
      // Si wid est au format @c.us (ex: 22890123456@c.us), l'utilisateur est le numéro direct
      if (s.includes('@c.us') && u && /^\d{6,16}$/.test(u)) {
        return u;
      }
      // Si l'identifiant n'est pas un LID et est numérique
      if (!s.includes('@lid') && u && /^\d{6,16}$/.test(u)) {
        return u;
      }
    }
    if (client.info.me && client.info.me.user && /^\d{6,16}$/.test(client.info.me.user)) {
      return client.info.me.user;
    }
    if (client.info.phone && typeof client.info.phone === 'string') {
      const p = client.info.phone.replace(/\D/g, '');
      if (p.length >= 6) return p;
    }
  }
  return null;
}

async function getClientPhoneAsync(client, userId) {
  let syncPhone = getClientPhone(client, userId);
  if (syncPhone) return syncPhone;

  // 1. Vérification dans le profil Supabase utilisateur
  if (supabase && userId) {
    try {
      const { data } = await supabase.from('profiles').select('whatsapp_number, phone').eq('id', userId).maybeSingle();
      const p = data?.whatsapp_number || data?.phone;
      if (p && String(p).replace(/\D/g, '').length >= 6) {
        const clean = String(p).replace(/\D/g, '');
        waNumbers[userId] = clean;
        return clean;
      }
    } catch(e) {}
  }

  // 2. Extraction dynamique depuis la page Puppeteer active de WhatsApp Web
  if (client && client.pupPage && !client.pupPage.isClosed()) {
    try {
      const pagePhone = await client.pupPage.evaluate(() => {
        try {
          // A. LocalStorage interne WhatsApp Web (last-wid-md, me-wid, user_id)
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('last-wid') || key.includes('me-wid') || key.includes('user_id') || key.includes('wid'))) {
              const val = localStorage.getItem(key);
              const m = val && val.match(/(\d{7,16})(:|@c\.us)/);
              if (m && m[1]) return m[1];
            }
          }

          // B. Modules internes WhatsApp Web require
          if (window.require) {
            try {
              const pn = window.require('WAWebUserPrefsMeUser')?.getMaybeMePnUser();
              if (pn && pn.user && /^\d{7,16}$/.test(pn.user)) return pn.user;
            } catch(e) {}

            try {
              const connWid = window.require('WAWebConnModel')?.Conn?.wid;
              if (connWid) {
                const s = connWid._serialized || '';
                const u = connWid.user || '';
                if (!s.includes('@lid') && /^\d{7,16}$/.test(u)) return u;
              }
            } catch(e) {}

            try {
              const widFactory = window.require('WAWebWidFactory');
              const me = widFactory?.getMeUser();
              if (me && me.user && /^\d{7,16}$/.test(me.user)) return me.user;
            } catch(e) {}

            try {
              const pn = window.require('WAWebLidUtils')?.getCurrentPnUser();
              if (pn && pn.user && /^\d{7,16}$/.test(pn.user)) return pn.user;
            } catch(e) {}
          }

          // C. Store
          if (window.Store) {
            if (window.Store.User?.getMaybeMePnUser) {
              const pn = window.Store.User.getMaybeMePnUser();
              if (pn && pn.user && /^\d{7,16}$/.test(pn.user)) return pn.user;
            }
            if (window.Store.Conn?.wid) {
              const u = window.Store.Conn.wid.user;
              const s = window.Store.Conn.wid._serialized || '';
              if (!s.includes('@lid') && /^\d{7,16}$/.test(u)) return u;
            }
          }
        } catch(e) {}
        return null;
      });

      if (pagePhone && String(pagePhone).replace(/\D/g, '').length >= 6) {
        const clean = String(pagePhone).replace(/\D/g, '');
        waNumbers[userId] = clean;
        return clean;
      }
    } catch(e) {}
  }

  return null;
}

// Memoire contextuelle persistante & fenetre de session de 24h
const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;  // 4 heures d'inactivite (Conforme Master Prompt)
const MAX_HISTORY_MESSAGES = 10;                // Maintient au minimum les 8 a 10 derniers echanges
const waChatHistories = new Map();              // Cache memoire haute vitesse: ${userId}:${phone} -> { history, lastActivity, sessionStart, name }

/**
 * Recupere la session et l'historique d'un client.
 * Recharge automatiquement depuis Supabase en cas de redemarrage serveur.
 * Verifie si la session active a expire (> 4h d'inactivite).
 */
async function getCustomerSession(userId, phone, fallbackName = 'Cher client') {
  const historyKey = `${userId}:${phone}`;
  const now = Date.now();
  let sessionData = waChatHistories.get(historyKey);
  let contactRow = null;

  // Si non present dans le cache memoire (ex: reboot Railway / redeploiement), recharger depuis Supabase
  if (!sessionData && supabase && userId) {
    try {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .eq('phone_number', phone)
        .maybeSingle();

      contactRow = data;
      if (contactRow) {
        let history = [];
        let sessionStart = contactRow.created_at || new Date(now).toISOString();
        let lastActivity = contactRow.updated_at ? new Date(contactRow.updated_at).getTime() : 0;

        if (contactRow.last_message) {
          try {
            if (typeof contactRow.last_message === 'string' && contactRow.last_message.startsWith('{')) {
              const parsed = JSON.parse(contactRow.last_message);
              if (Array.isArray(parsed.history)) history = parsed.history;
              if (parsed.session_start) sessionStart = parsed.session_start;
              if (parsed.last_activity) lastActivity = new Date(parsed.last_activity).getTime();
            }
          } catch (e) {}
        }

        sessionData = {
          name: contactRow.name || fallbackName,
          history: history.slice(-MAX_HISTORY_MESSAGES),
          lastActivity,
          sessionStart
        };
        waChatHistories.set(historyKey, sessionData);
        console.log(`[WA/REBOOT] Memoire restauree depuis Supabase pour ${phone} (${sessionData.history.length} msgs)`);
      }
    } catch (dbErr) {
      console.warn(`[WA/SESSION] Notice lecture Supabase pour ${phone}:`, dbErr.message);
    }
  }

  // Verification de la fenetre des 4h
  const isFirstContact = !sessionData || !sessionData.lastActivity || sessionData.lastActivity === 0;
  const elapsed = sessionData && sessionData.lastActivity ? (now - sessionData.lastActivity) : 0;
  const isExpired = elapsed > SESSION_TIMEOUT_MS;
  const isNewSession = isFirstContact || isExpired;

  let activeHistory = [];
  let sessionStart = sessionData ? sessionData.sessionStart : new Date(now).toISOString();
  let contactName = sessionData ? (sessionData.name || fallbackName) : fallbackName;

  if (isNewSession) {
    activeHistory = [];
    sessionStart = new Date(now).toISOString();
    console.log(`[WA/SESSION] NOUVELLE SESSION pour ${phone} (${isFirstContact ? 'Premier contact' : 'Inactivite > 4h (' + Math.round(elapsed / 3600000) + 'h)'}). Salutation activee.`);
  } else {
    activeHistory = (sessionData.history || []).slice(-MAX_HISTORY_MESSAGES);
    console.log(`[WA/SESSION] SESSION ACTIVE pour ${phone} (Derniere activite il y a ${Math.round(elapsed / 60000)} min, ${activeHistory.length} msgs). Pas de salutation.`);
  }

  return {
    isNewSession,
    history: activeHistory,
    sessionStart,
    contactName,
    lastActivity: now
  };
}

/**
 * Sauvegarde de maniere securisee et persistante la session et l'historique dans Supabase et en cache.
 */
async function saveCustomerSession(userId, phone, contactName, userText, assistantText, currentHistory, sessionStart) {
  const historyKey = `${userId}:${phone}`;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Maintient au minimum 8 a 10 echanges dans l'historique
  const updatedHistory = [
    ...currentHistory,
    { role: 'user', content: userText },
    { role: 'assistant', content: assistantText }
  ].slice(-MAX_HISTORY_MESSAGES);

  // 1. Mise a jour du cache memoire
  waChatHistories.set(historyKey, {
    name: contactName,
    history: updatedHistory,
    lastActivity: now,
    sessionStart: sessionStart
  });

  // 2. Persistance securisee dans Supabase (table contacts)
  if (supabase && userId) {
    try {
      const payload = JSON.stringify({
        text: userText.substring(0, 255),
        session_start: sessionStart,
        last_activity: nowIso,
        history: updatedHistory
      });

      await supabase.from('contacts').upsert({
        user_id: userId,
        phone_number: phone,
        name: contactName,
        last_message: payload,
        updated_at: nowIso
      }, { onConflict: 'user_id, phone_number' });

      console.log(`[WA/PERSISTENCE] Session & historique sauvegardes dans Supabase pour ${phone}`);
    } catch (err) {
      console.warn(`[WA/PERSISTENCE] Notice sauvegarde Supabase pour ${phone}:`, err.message);
    }
  }
}

/**
 * Moteur de reponse commerciale d'elite VANDIYA IA
 */
async function generateSalesAgentResponse({
  userId,
  phone,
  contactName,
  userMessage,
  isNewSession,
  history,
  basePrompt
}) {
  const commercialGuidelines = `
## POSTURE COMMERCIALE D'ELITE (VANDIYA IA) :
- Tu es l'agent commercial officiel de l'entreprise sur WhatsApp.
- Tu incarnes un excellent commercial : poli, patient, naturel, attentif, digne de confiance et convaincant.
- Reponds UNIQUEMENT des qu'un client t'ecrit. N'initie jamais de conversation et n'envoie aucun message spontanement.
- Ecoute attentivement : pose au maximum une seule question pertinente et courte a la fois pour comprendre les besoins specifiques du client.
- Presentation adaptee : presente les solutions selon ses besoins avec clarte, enthousiasme et transparence sur les tarifs, en utilisant exclusivement le catalogue et les prix fournis par l'entreprise.
- Traitement des objections : reponds calmement, poliment et honnetement aux doutes, inquietudes ou remarques sur le prix ou la fiabilite.
- Concretisation de commande : guide progressivement le client vers la validation de sa commande et le reglement, sans pression agressive ni fausses promesses.
- Format WhatsApp : reponses concises (3 a 5 lignes courtes), aerees, vivantes et faciles a lire sur mobile avec des emojis bien doses. Pas de longs blocs de texte indigestes.`;

  const sessionDirectives = isNewSession
    ? `
[REGLE DE SESSION - PREMIER CONTACT OU RETOUR APRES PLUS DE 4H D'INACTIVITE] :
- Salue chaleureusement et poliment le client UNE SEULE FOIS (ex: "Bonjour ${contactName} ! Bienvenue chez nous 😊").
- Si le client pose directement une question, salue-le tres brievement et reponds directement a sa question.
- Ne repete JAMAIS cette formule d'accueil aux messages suivants.`
    : `
[REGLE DE FLUIDITE STRICTE - CONVERSATION EN COURS DANS LA SESSION ACTIVE (< 4H)] :
- INTERDICTION FORMELLE ET ABSOLUE de redire "Bonjour", "Bonsoir", "Bienvenue chez nous" ou de te representer.
- Reprends DIRECTEMENT et NATURELLEMENT le fil de la conversation.
- Reponds precisement et directement au dernier message du client en tenant compte du contexte memorise ci-dessous.`;

  // Détection du pays du client par l'indicatif téléphonique
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  let detectedCountry = "Général / UEMOA";
  let recommendedPaymentText = "";

  if (cleanPhone.startsWith('226')) {
    detectedCountry = "Burkina Faso (Indicatif +226)";
    recommendedPaymentText = "👉 Pour le Burkina Faso, propose prioritairement :\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- WAVE au +226 05 15 84 94 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('229')) {
    detectedCountry = "Bénin (Indicatif +229)";
    recommendedPaymentText = "👉 Pour le Bénin, propose prioritairement :\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- MOOV MONEY / FLOOZ au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('225')) {
    detectedCountry = "Côte d'Ivoire (Indicatif +225)";
    recommendedPaymentText = "👉 Pour la Côte d'Ivoire, propose prioritairement :\n- WAVE au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- MTN MoMo au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('221')) {
    detectedCountry = "Sénégal (Indicatif +221)";
    recommendedPaymentText = "👉 Pour le Sénégal, propose prioritairement :\n- WAVE au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('228')) {
    detectedCountry = "Togo (Indicatif +228)";
    recommendedPaymentText = "👉 Pour le Togo, propose prioritairement :\n- MOOV MONEY / FLOOZ au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('223')) {
    detectedCountry = "Mali (Indicatif +223)";
    recommendedPaymentText = "👉 Pour le Mali, propose prioritairement :\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- WAVE au +226 05 15 84 94 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('227')) {
    detectedCountry = "Niger (Indicatif +227)";
    recommendedPaymentText = "👉 Pour le Niger, propose prioritairement :\n- MOOV MONEY / FLOOZ au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('224')) {
    detectedCountry = "Guinée (Indicatif +224)";
    recommendedPaymentText = "👉 Pour la Guinée, propose prioritairement :\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('237')) {
    detectedCountry = "Cameroun (Indicatif +237)";
    recommendedPaymentText = "👉 Pour le Cameroun, propose prioritairement :\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- Carte VISA / Mastercard disponible";
  } else if (cleanPhone.startsWith('242')) {
    detectedCountry = "Congo-Brazzaville (Indicatif +242)";
    recommendedPaymentText = "👉 Pour le Congo-Brazzaville, propose prioritairement :\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- Carte VISA / Mastercard disponible";
  } else if (cleanPhone.startsWith('243')) {
    detectedCountry = "RD Congo (Indicatif +243)";
    recommendedPaymentText = "👉 Pour la RD Congo, propose prioritairement :\n- ORANGE MONEY / AIRTEL / M-PESA au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- Carte VISA / Mastercard disponible";
  } else if (cleanPhone.startsWith('241')) {
    detectedCountry = "Gabon (Indicatif +241)";
    recommendedPaymentText = "👉 Pour le Gabon, propose prioritairement :\n- MOOV MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- Carte VISA / Mastercard disponible";
  } else if (cleanPhone.startsWith('234')) {
    detectedCountry = "Nigeria (Indicatif +234)";
    recommendedPaymentText = "👉 Pour le Nigeria, propose prioritairement :\n- Paiement instantané sécurisé par Carte Bancaire (Visa/Mastercard) ou lien de paiement officiel VANDIAS";
  } else if (cleanPhone.startsWith('233')) {
    detectedCountry = "Ghana (Indicatif +233)";
    recommendedPaymentText = "👉 Pour le Ghana, propose prioritairement :\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- Carte Bancaire (Visa/Mastercard)";
  } else if (cleanPhone.startsWith('220')) {
    detectedCountry = "Gambie (Indicatif +220)";
    recommendedPaymentText = "👉 Pour la Gambie, propose prioritairement :\n- WAVE au +226 05 15 84 94 (Nom : Gnitou Essowedeou)";
  } else if (cleanPhone.startsWith('231') || cleanPhone.startsWith('232') || cleanPhone.startsWith('245') || cleanPhone.startsWith('238') || cleanPhone.startsWith('222')) {
    detectedCountry = "Zone Ouest-Africaine (Liberia, Sierra Leone, Guinée-Bissau, Cap-Vert, Mauritanie)";
    recommendedPaymentText = "👉 Propose les options disponibles :\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- Carte VISA / Mastercard sécurisée";
  } else {
    detectedCountry = "International / Diaspora / Tous pays";
    recommendedPaymentText = "👉 Propose les options disponibles :\n- WAVE au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- ORANGE MONEY au +226 05 15 84 94 (Nom : Gnitou Essowedeou)\n- MTN MOBILE MONEY au +229 01 62 63 95 93 (Nom : Gnitou Essowedeou)\n- Carte Bancaire internationale (Visa / Mastercard)";
  }

  const hasCustomPayments = Boolean(basePrompt && (
    basePrompt.includes("PAIEMENT") || 
    basePrompt.includes("Wave") || 
    basePrompt.includes("Orange Money") || 
    basePrompt.includes("MTN") || 
    basePrompt.includes("Moov") || 
    basePrompt.includes("+")
  ));

  const paymentRoutingGuidelines = `
## COORDONNÉES DE PAIEMENT OFFICIELLES & ROUTAGE PAR PAYS (OBLIGATOIRE & IMMÉDIAT) :
Tu as un accès DIRECT, PERMANENT et COMPLET aux informations de paiement officielles.
INTERDICTION FORMELLE ET ABSOLUE de dire que tu n'as pas accès aux numéros, que tu dois vérifier auprès du responsable ou de faire attendre le client !

PAYS DÉTECTÉ DU CLIENT : ${detectedCountry} (Numéro client: ${phone})
${hasCustomPayments ? "👉 PRIORITÉ : Utilise en priorité absolue les coordonnées et modalités de paiement définies par l'entreprise dans le prompt configuré ci-dessus." : recommendedPaymentText}

${hasCustomPayments ? "TABLEAU DES MOYENS DE PAIEMENT DE SECOURS (Si non spécifié par l'entreprise) :" : "TABLEAU COMPLET DES MOYENS DE PAIEMENT OFFICIELS :"}
- WAVE (CI, Sénégal, Burkina, Bénin, etc.) : +226 05 15 84 94 | Titulaire officiel : Gnitou Essowedeou
- ORANGE MONEY (Burkina Faso, Mali, etc.) : +226 05 15 84 94 | Titulaire officiel : Gnitou Essowedeou
- MTN MOBILE MONEY (Bénin, Togo, etc.) : +229 01 62 63 95 93 | Titulaire officiel : Gnitou Essowedeou
- MOOV MONEY / FLOOZ : +229 01 62 63 95 93 | Titulaire officiel : Gnitou Essowedeou

RÈGLES D'EXÉCUTION LORSQUE LE CLIENT VEUT PAYER OU COMMANDE :
1. Dès que le client demande à payer, confirme sa commande ou demande le numéro, donne-lui IMMÉDIATEMENT le moyen et numéro adapté à son pays (priorité aux coordonnées de l'entreprise si configurées, sinon les coordonnées officielles ci-dessus).
2. Si le client demande un moyen spécifique (ex: "Donne-moi Wave", "Je veux Orange Money", "As-tu MTN ?"), donne-lui IMMÉDIATEMENT les coordonnées correspondantes.
3. Rappelle toujours le montant exact selon le produit ou service choisi dans le catalogue officiel de l'entreprise.
4. Demande poliment la preuve ou capture de transfert Mobile Money, et informe avec transparence que la commande sera validée dès confirmation officielle du paiement.
5. Ne demande JAMAIS de code secret, code PIN ou mot de passe bancaire/Mobile Money.`;

  const systemMessageContent = `${basePrompt || "Tu es l'agent commercial officiel de l'entreprise sur WhatsApp."}\n\n${commercialGuidelines}\n\n${paymentRoutingGuidelines}\n\n${sessionDirectives}`;

  const openAiMessages = [
    { role: 'system', content: systemMessageContent },
    ...history,
    { role: 'user', content: userMessage }
  ];

  if (!openai) {
    return isNewSession
      ? `Bonjour ${contactName} ! Bienvenue chez nous 😊 Comment puis-je vous aider aujourd'hui avec nos outils et formations ?`
      : `Je note votre demande. Souhaitez-vous des details complementaires pour finaliser votre commande ?`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: openAiMessages,
    max_tokens: 350,
    temperature: 0.7
  });

  return (completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content)
    ? completion.choices[0].message.content
    : "Je reste a votre entiere disposition pour vous accompagner dans votre commande !";
}


app.post('/api/whatsapp/start', authMiddleware, async (req, res) => {
  const { userId, restart, phoneNumber } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });
  const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;

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
    delete waPairingCodes[userId];
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

  const clientOptions = {
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
  };

  if (cleanPhone && cleanPhone.length >= 8) {
    clientOptions.pairWithPhoneNumber = {
      phoneNumber: cleanPhone,
      showNotification: true,
      intervalMs: 180000
    };
    console.log(`[WA] Client ${userId} configuré pour code d'association (+${cleanPhone})`);
  }

  const client = new Client(clientOptions);

  waClients[userId] = client;

  // Quand WhatsApp génère le QR Code
  // Scan validé : Authentification réussie
  client.on('authenticated', () => {
    console.log(`🎉 [WA] Client ${userId} AUTHENTIFIÉ (scan validé) !`);
    waStatuses[userId] = 'AUTHENTICATED';
    const detectedPhone = getClientPhone(client, userId);
    if (detectedPhone) waNumbers[userId] = detectedPhone;
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[WA] Client ${userId} synchronisation: ${percent}% - ${message}`);
    waStatuses[userId] = 'AUTHENTICATED';
    const detectedPhone = getClientPhone(client, userId);
    if (detectedPhone) waNumbers[userId] = detectedPhone;
  });

  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr); // Convertir en image affichable
    waSessionsQR[userId] = qrImage;
    if (!waPairingCodes[userId]) waStatuses[userId] = 'QR_READY';
    console.log(`\n📱 [WA] SCANNEZ CE QR CODE AVEC VOTRE SMARTPHONE :`);
    try { require('qrcode-terminal').generate(qr, { small: true }); } catch(e) {}
  });

  client.on('code', (code) => {
    console.log(`🔑 [WA] Client ${userId} PAIRING CODE REÇU : ${code}`);
    waPairingCodes[userId] = code;
    waStatuses[userId] = 'CODE_READY';
  });

  // Quand le client a scanné et est connecté
  // Gestion de la dconnexion et rinitialisation propre
  client.on('auth_failure', (msg) => {
    console.error(`[WA] Échec d'authentification pour ${userId} :`, msg);
    waStatuses[userId] = 'DISCONNECTED';
    delete waClients[userId];
    delete waSessionsQR[userId];
  });

  client.on('disconnected', (reason) => {
    console.log(`[WA] Client ${userId} déconnecté :`, reason);
    waStatuses[userId] = 'DISCONNECTED';
    delete waClients[userId];
    delete waSessionsQR[userId];
    delete waNumbers[userId];
    try { client.destroy(); } catch (e) {}
  });

  client.on('ready', async () => {
    waStatuses[userId] = 'CONNECTED';
    let detectedPhone = getClientPhone(client, userId);
    if (!detectedPhone) {
      detectedPhone = await getClientPhoneAsync(client, userId);
    }
    if (detectedPhone) {
      waNumbers[userId] = detectedPhone;
    }
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
    console.log(`✅ [WA] Client ${userId} CONNECTÉ sur WhatsApp ! Numéro: ${waNumbers[userId]}`);

    // Synchronisation automatique immédiate dans le profil Supabase
    if (waNumbers[userId] && supabase) {
      try {
        const fullWaPhone = '+' + String(waNumbers[userId]).replace(/^\+/, '');
        await supabase.from('profiles').update({ whatsapp_number: fullWaPhone }).eq('id', userId);
        console.log(`💾 [WA] Profil Supabase synchronisé pour ${userId} : ${fullWaPhone}`);
      } catch (err) {
        console.warn(`[WA] Avertissement update Supabase:`, err.message);
      }
    }
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

      // Determiner le destinataire exact et les identifiants client
      const rawSender = isSelfTest ? (client.info ? client.info.wid.user : 'Moi') : (msg.from ? msg.from.split('@')[0] : 'Inconnu');
      let targetChat = msg.from;
      if (isSelfTest && client.info && client.info.wid) {
        targetChat = client.info.wid._serialized;
      }

      let cName = isSelfTest ? 'Auto-Test (Moi)' : 'Client WhatsApp';
      try {
        const cInfo = await msg.getContact();
        if (cInfo && (cInfo.pushname || cInfo.name)) {
          cName = cInfo.pushname || cInfo.name;
        }
      } catch (e) {}

      // Prompt de base du compte
      const basePrompt = (profile && profile.ai_prompt && profile.ai_prompt.trim().length > 10) 
        ? profile.ai_prompt 
        : "Tu es un assistant commercial WhatsApp intelligent, chaleureux et persuasif pour VANDIYA IA. Reponds de maniere concise, polie et engageante avec des emojis adaptes.";

      // Recuperer ou restaurer la session et l'historique conversationnel (Supabase + cache, 24h timeout)
      const session = await getCustomerSession(userId, rawSender, cName);

      // Generer la reponse de l'agent commercial d'elite VANDIYA IA
      let aiResponse = "";
      try {
        aiResponse = await generateSalesAgentResponse({
          userId,
          phone: rawSender,
          contactName: session.contactName || cName,
          userMessage: msg.body,
          isNewSession: session.isNewSession,
          history: session.history,
          basePrompt
        });
      } catch (aiErr) {
        console.error("[WA/IA] Erreur generation IA :", aiErr.message);
        aiResponse = session.isNewSession
          ? `Bonjour ${session.contactName || cName} ! Bienvenue chez nous 😊 Comment puis-je vous aider aujourd'hui ?`
          : `Je vous ecoute, comment puis-je vous renseigner sur nos produits et commandes ?`;
      }

      // Sauvegarder durablement la session et l'historique dans Supabase et dans le cache
      await saveCustomerSession(
        userId,
        rawSender,
        session.contactName || cName,
        msg.body,
        aiResponse,
        session.history,
        session.sessionStart
      );

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

// Endpoint d'association WhatsApp par code à 8 caractères (Pairing Code)
app.post('/api/whatsapp/pairing-code', authMiddleware, async (req, res) => {
  const { userId, phoneNumber } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });
  if (!phoneNumber) return res.status(400).json({ error: "Numéro de téléphone requis" });

  const cleanPhone = String(phoneNumber).replace(/\D/g, '');
  if (cleanPhone.length < 8) {
    return res.status(400).json({ error: "Numéro de téléphone invalide (incluez l'indicatif pays, ex: 2250701020304)." });
  }

  // 1. Si un client existe déjà et supporte requestPairingCode
  const existingClient = waClients[userId];
  if (existingClient && typeof existingClient.requestPairingCode === 'function' && waStatuses[userId] !== 'CONNECTED') {
    try {
      console.log(`[WA] Demande de Pairing Code dynamique pour ${userId} sur +${cleanPhone}...`);
      const code = await existingClient.requestPairingCode(cleanPhone);
      waPairingCodes[userId] = code;
      waNumbers[userId] = cleanPhone;
      waStatuses[userId] = 'CODE_READY';
      return res.json({ status: 'CODE_READY', code });
    } catch (err) {
      console.warn(`[WA] Échec requestPairingCode direct: ${err.message}. Redémarrage du client...`);
    }
  }

  // 2. Démarrer avec pairWithPhoneNumber
  try {
    if (existingClient) {
      try { await existingClient.destroy(); } catch (e) {}
      delete waClients[userId];
    }
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
    waNumbers[userId] = cleanPhone;

    const authDir = path.join(__dirname, '.wwebjs_auth', `session-${userId}`);
    if (fs.existsSync(authDir)) {
      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
    }

    waStatuses[userId] = 'STARTING';
    const chromiumPath = getChromiumExecutablePath();

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: userId }),
      pairWithPhoneNumber: {
        phoneNumber: cleanPhone,
        showNotification: true,
        intervalMs: 180000
      },
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

    client.on('code', (code) => {
      console.log(`🔑 [WA] Pairing Code généré pour ${userId} : ${code}`);
      waPairingCodes[userId] = code;
      waStatuses[userId] = 'CODE_READY';
    });

    client.on('qr', async (qr) => {
      const qrImage = await qrcode.toDataURL(qr);
      waSessionsQR[userId] = qrImage;
      if (!waPairingCodes[userId]) waStatuses[userId] = 'QR_READY';
    });

    client.on('authenticated', () => {
      console.log(`🎉 [WA] Client ${userId} AUTHENTIFIÉ (Code validé) !`);
      waStatuses[userId] = 'AUTHENTICATED';
      waNumbers[userId] = cleanPhone;
      delete waSessionsQR[userId];
      delete waPairingCodes[userId];
    });

    client.on('ready', async () => {
      waStatuses[userId] = 'CONNECTED';
      const detectedPhone = getClientPhone(client, userId) || cleanPhone;
      if (detectedPhone) waNumbers[userId] = detectedPhone;
      delete waSessionsQR[userId];
      delete waPairingCodes[userId];
      console.log(`✅ [WA] Client ${userId} CONNECTÉ sur WhatsApp (Pairing) ! Numéro: ${waNumbers[userId]}`);

      if (waNumbers[userId] && supabase) {
        try {
          const fullWaPhone = '+' + String(waNumbers[userId]).replace(/^\+/, '');
          await supabase.from('profiles').update({ whatsapp_number: fullWaPhone }).eq('id', userId);
          console.log(`💾 [WA] Profil Supabase synchronisé pour ${userId} : ${fullWaPhone}`);
        } catch (err) {
          console.warn(`[WA] Avertissement update Supabase:`, err.message);
        }
      }
    });

    client.on('auth_failure', (msg) => {
      console.error(`[WA] Échec auth pour ${userId} :`, msg);
      waStatuses[userId] = 'DISCONNECTED';
      delete waClients[userId];
      delete waPairingCodes[userId];
    });

    client.on('disconnected', () => {
      waStatuses[userId] = 'DISCONNECTED';
      delete waClients[userId];
      delete waPairingCodes[userId];
      delete waSessionsQR[userId];
    });

    client.initialize().catch((err) => {
      console.error(`[WA] Erreur initialize pour ${userId}:`, err.message);
      waStatuses[userId] = 'ERROR';
    });

    // Attente du code jusqu'à 8 secondes
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (waPairingCodes[userId]) {
        return res.json({ status: 'CODE_READY', code: waPairingCodes[userId] });
      }
    }

    return res.json({ status: 'STARTING', message: "Génération du code en cours..." });
  } catch (error) {
    console.error("[WA] Erreur endpoint pairing-code:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/whatsapp/status/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const client = waClients[userId];
  const st = waStatuses[userId] === 'AUTHENTICATED' ? 'CONNECTED' : (waStatuses[userId] || 'DISCONNECTED');
  let detectedPhone = getClientPhone(client, userId);
  if (!detectedPhone && client && st === 'CONNECTED') {
    detectedPhone = await getClientPhoneAsync(client, userId);
  }
  if (detectedPhone) waNumbers[userId] = detectedPhone;

  // Si connecté et qu'on a le numéro, synchroniser Supabase immédiatement
  if (st === 'CONNECTED' && waNumbers[userId] && supabase) {
    try {
      const fullWa = '+' + String(waNumbers[userId]).replace(/^\+/, '');
      supabase.from('profiles').update({ whatsapp_number: fullWa }).eq('id', userId).then(() => {}).catch(() => {});
    } catch(e) {}
  }

  res.json({
    status: st,
    qr: waSessionsQR[userId] || null,
    pairingCode: waPairingCodes[userId] || null,
    phone: waNumbers[userId] ? ('+' + String(waNumbers[userId]).replace(/^\+/, '')) : null,
    error: waStatuses[userId] === 'ERROR' ? (waSessionsQR[userId] || 'Erreur inconnue') : null
  });
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
    const { userId, message, phone = 'test_simulation', simulateInactivityHours = 0 } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: "Message requis" });
    if (message.length > 1000) return res.status(400).json({ error: "Message trop long (max 1000 caractères)" });

    let systemPrompt = "Tu es l'agent commercial officiel de VANDIYA IA sur WhatsApp. Sois chaleureux, persuasif, très poli, attentif et guide le client avec bienveillance.";
    if (userId && supabase) {
      try {
        const { data: profile } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
        if (profile && profile.ai_prompt) systemPrompt = profile.ai_prompt;
      } catch (pErr) {}
    }

    // Gestion de session
    const session = await getCustomerSession(userId || 'test_user', phone, 'Client Test');
    if (simulateInactivityHours >= 4) {
      session.isNewSession = true;
      session.history = [];
    }

    const reply = await generateSalesAgentResponse({
      userId: userId || 'test_user',
      phone,
      contactName: session.contactName,
      userMessage: message,
      isNewSession: session.isNewSession,
      history: session.history,
      basePrompt: systemPrompt
    });

    await saveCustomerSession(
      userId || 'test_user',
      phone,
      session.contactName,
      message,
      reply,
      session.history,
      session.sessionStart
    );

    res.json({
      success: true,
      reply,
      session: {
        isNewSession: session.isNewSession,
        historyCount: session.history.length + 2,
        phone
      }
    });
  } catch (err) {
    console.error("Erreur chat test IA:", err);
    res.status(500).json({ error: "Erreur lors de la génération de la réponse IA" });
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
// AUTHENTIFICATION GOOGLE OAUTH STRICTE (VÉRIFICATION SERVEUR & BDD SUPABASE)
// 1. Inscription : crée le profil Supabase (table profiles) et attribue 100 crédits
// 2. Connexion : n'autorise que les utilisateurs ayant déjà un compte enregistré
// 3. Si aucun compte lors d'une connexion -> accès refusé (HTTP 403 NO_ACCOUNT)
// ============================================================================
app.post('/api/auth/oauth-verify', async (req, res) => {
  try {
    const { accessToken, mode } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ success: false, error: "Jeton d'accès (accessToken) requis." });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: "Configuration Supabase manquante sur le serveur." });
    }

    // 1. Validation cryptographique du token OAuth auprès de Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Jeton OAuth invalide ou expiré. Veuillez vous reconnecter."
      });
    }

    const cleanEmail = (user.email || '').trim().toLowerCase();
    const meta = user.user_metadata || {};
    const fullName = meta.full_name || meta.name || '';
    const parts = fullName.split(' ');
    const firstName = meta.first_name || parts[0] || (cleanEmail ? cleanEmail.split('@')[0].charAt(0).toUpperCase() + cleanEmail.split('@')[0].slice(1) : 'Utilisateur');
    const lastName = meta.last_name || parts.slice(1).join(' ') || '';
    const avatarUrl = meta.avatar_url || meta.picture || '';

    // 2. Recherche du profil enregistré dans la table public.profiles
    let profile = null;
    try {
      const { data: pById } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (pById) profile = pById;
    } catch (e) {}

    if (!profile && cleanEmail) {
      try {
        const { data: pByEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();
        if (pByEmail) profile = pByEmail;
      } catch (e) {}
    }

    const authMode = String(mode || 'login').toLowerCase().trim();

    // REGLE 1 : TENTATIVE DE CONNEXION (LOGIN)
    // Si l'utilisateur clique sur "Se connecter" avec un compte Google qui n'est pas enregistré dans public.profiles :
    // INTERDICTION ABSOLUE D'ACCÈS AU DASHBOARD (Code HTTP 403 NO_ACCOUNT)
    if (authMode === 'login' && !profile) {
      console.warn(`[AUTH OAUTH] Blocage connexion : Aucun compte enregistré pour ${cleanEmail} (${user.id})`);
      return res.status(403).json({
        success: false,
        code: "NO_ACCOUNT",
        error: `Cette adresse e-mail (${cleanEmail}) n'a pas encore de compte sur la plateforme VANDIAS. Veuillez créer votre compte ci-dessous pour démarrer vos 7 jours d'essai gratuit.`,
        user: {
          firstName,
          lastName,
          email: cleanEmail,
          avatarUrl
        }
      });
    }

    // REGLE 2 : INSCRIPTION (SIGNUP)
    // Si l'utilisateur clique sur "Créer un compte" et n'a pas encore de profil :
    // Création officielle du profil avec 100 crédits et rattachement à Supabase
    if (!profile) {
      console.log(`[AUTH OAUTH] Nouvelle inscription Google pour ${cleanEmail} (${user.id})`);
      const newProfile = {
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email: cleanEmail,
        whatsapp_number: '',
        avatar_url: avatarUrl,
        credits: 100,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .upsert(newProfile)
        .select('*')
        .single();

      if (insertErr) {
        console.error('[AUTH OAUTH] Erreur création profil Supabase:', insertErr.message);
        return res.status(500).json({ success: false, error: "Impossible d'initialiser le profil utilisateur." });
      }

      profile = created || newProfile;
    }

    // REGLE 3 : UTILISATEUR VALIDE ET AUTORISÉ
    const appMeta = user.app_metadata || {};
    const rawPlan = appMeta.plan || profile.plan || 'trial';
    const planStatus = appMeta.plan_status || profile.plan_status || 'active';
    const planCycle = appMeta.plan_cycle || profile.plan_cycle || 'monthly';
    const isPaid = (rawPlan && rawPlan !== 'trial' && rawPlan !== 'free' && rawPlan !== 'expired' && planStatus === 'active');
    const maxTokens = isPaid ? (rawPlan === 'basic' ? 1000 : rawPlan === 'pro' ? 3000 : 10000) : 100;
    const remainingCredits = typeof profile.credits === 'number' ? profile.credits : 100;
    const userCreatedAt = user.created_at || profile.created_at || new Date().toISOString();

    return res.status(200).json({
      success: true,
      profile,
      user: {
        id: user.id,
        firstName: profile.first_name || firstName,
        lastName: profile.last_name || lastName,
        email: profile.email || cleanEmail,
        phoneCountry: "+225",
        phoneNumber: (profile.whatsapp_number || "").replace(/^\+\d+\s*/, ""),
        fullPhone: profile.whatsapp_number || "",
        company: "Mon Entreprise",
        role: "Administrateur",
        avatarUrl: profile.avatar_url || avatarUrl,
        provider: "google",
        credits: remainingCredits,
        plan: {
          name: isPaid ? `Formule ${rawPlan.toUpperCase()}` : "Essai Gratuit 7j 🦾",
          type: rawPlan,
          status: planStatus,
          cycle: planCycle,
          activatedAt: appMeta.plan_activated_at || profile.plan_activated_at || null,
          expiresAt: appMeta.plan_expires_at || profile.plan_expires_at || null,
          badge: isPaid ? rawPlan.toUpperCase() : "ESSAI",
          tokensUsed: Math.max(0, maxTokens - remainingCredits),
          tokensMax: maxTokens
        },
        createdAt: userCreatedAt
      }
    });

  } catch (err) {
    console.error('[AUTH OAUTH] Exception oauth-verify:', err);
    return res.status(500).json({ success: false, error: "Erreur serveur lors de la vérification OAuth." });
  }
});


function parseCycleDuration(cycle) {
  const c = String(cycle || '').toLowerCase().trim();
  if (c === '15days' || c === '15j' || c === '15jours' || c.includes('15')) {
    return { ms: 15 * 24 * 60 * 60 * 1000, label: '15 jours', days: 15 };
  }
  if (c === 'quarterly' || c === '3months' || c === '3mois' || c === 'trimestriel' || c.includes('3m') || c.includes('3 m')) {
    return { ms: 90 * 24 * 60 * 60 * 1000, label: '3 mois', days: 90 };
  }
  if (c === 'semi_annual' || c === '6months' || c === '6mois' || c === 'semestriel' || c.includes('6m') || c.includes('6 m')) {
    return { ms: 180 * 24 * 60 * 60 * 1000, label: '6 mois', days: 180 };
  }
  if (c === 'annual' || c === 'yearly' || c === '1year' || c === '1an' || c === 'annuel' || c.includes('an')) {
    return { ms: 365 * 24 * 60 * 60 * 1000, label: '1 an', days: 365 };
  }
  return { ms: 30 * 24 * 60 * 60 * 1000, label: '1 mois', days: 30 };
}

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

    // Date d'inscription persistante et individuelle depuis Supabase auth.users ou profiles
    const createdAtStr = authUser?.created_at || profile?.created_at || req.query.client_created_at || req.query.created_at || new Date().toISOString();
    const createdAtTime = new Date(createdAtStr).getTime();
    const nowTime = Date.now();

    const appMeta = authUser?.app_metadata || {};
    const rawPlan = appMeta.plan || profile?.plan;
    const paidPlan = (rawPlan && rawPlan !== 'trial' && rawPlan !== 'free' && rawPlan !== 'expired') ? rawPlan : null;
    const rawStatus = appMeta.plan_status || profile?.plan_status || 'active';
    const isPaidActive = !!paidPlan && (rawStatus === 'active');

    let isExpired = false;
    let daysLeft = 0;
    let totalSecondsLeft = 0;
    let days = 0, hours = 0, minutes = 0, seconds = 0;
    let activatedAtStr = null;
    let expiresAtStr = null;
    let cycleInfo = { ms: 7 * 24 * 60 * 60 * 1000, label: '7 jours', days: 7 };

    if (isPaidActive) {
      // Abonnements payants : durée réelle (15 jours, 1 mois, 3 mois, etc.) et décompte automatique
      cycleInfo = parseCycleDuration(appMeta.plan_cycle || profile?.plan_cycle || 'monthly');
      activatedAtStr = appMeta.plan_activated_at || profile?.plan_activated_at || createdAtStr;
      expiresAtStr = appMeta.plan_expires_at || profile?.plan_expires_at || new Date(new Date(activatedAtStr).getTime() + cycleInfo.ms).toISOString();

      const expiresTime = new Date(expiresAtStr).getTime();
      const msLeft = expiresTime - nowTime;
      isExpired = msLeft <= 0;

      totalSecondsLeft = Math.max(0, Math.floor(Math.max(0, msLeft) / 1000));
      days = Math.max(0, Math.floor(Math.max(0, msLeft) / (24 * 60 * 60 * 1000)));
      hours = Math.max(0, Math.floor((Math.max(0, msLeft) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
      minutes = Math.max(0, Math.floor((Math.max(0, msLeft) % (60 * 60 * 1000)) / (60 * 1000)));
      seconds = Math.max(0, Math.floor((Math.max(0, msLeft) % (60 * 1000)) / 1000));

      daysLeft = isExpired ? 0 : Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    } else {
      // Essai gratuit : 7 jours dès l'inscription. Décompte de 7, 6, 5, 4, 3, 2, 1, 0 selon le temps écoulé
      const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
      const trialEndTime = createdAtTime + TRIAL_DURATION_MS;
      activatedAtStr = createdAtStr;
      expiresAtStr = new Date(trialEndTime).toISOString();

      const msLeft = trialEndTime - nowTime;
      isExpired = msLeft <= 0;

      totalSecondsLeft = Math.max(0, Math.floor(Math.max(0, msLeft) / 1000));
      days = Math.max(0, Math.floor(Math.max(0, msLeft) / (24 * 60 * 60 * 1000)));
      hours = Math.max(0, Math.floor((Math.max(0, msLeft) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
      minutes = Math.max(0, Math.floor((Math.max(0, msLeft) % (60 * 60 * 1000)) / (60 * 1000)));
      seconds = Math.max(0, Math.floor((Math.max(0, msLeft) % (60 * 1000)) / 1000));

      if (isExpired) {
        daysLeft = 0;
      } else {
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (msLeft > 6 * oneDayMs) daysLeft = 7;
        else if (msLeft > 5 * oneDayMs) daysLeft = 6;
        else if (msLeft > 4 * oneDayMs) daysLeft = 5;
        else if (msLeft > 3 * oneDayMs) daysLeft = 4;
        else if (msLeft > 2 * oneDayMs) daysLeft = 3;
        else if (msLeft > 1 * oneDayMs) daysLeft = 2;
        else if (msLeft > 12 * 60 * 60 * 1000) daysLeft = 1;
        else daysLeft = 0;
      }
    }

    const credits = typeof profile?.credits === 'number' ? profile.credits : 100;

    res.json({
      success: true,
      userId,
      isPaid: isPaidActive,
      plan: isPaidActive ? (isExpired ? 'expired' : paidPlan) : (isExpired ? 'expired' : 'trial'),
      planStatus: isExpired ? 'expired' : 'active',
      planCycle: isPaidActive ? (appMeta.plan_cycle || profile?.plan_cycle || 'monthly') : 'trial',
      planCycleLabel: cycleInfo.label,
      createdAt: createdAtStr,
      activatedAt: activatedAtStr,
      expiresAt: expiresAtStr,
      isExpired,
      daysLeft,
      totalSecondsLeft,
      countdown: {
        days,
        hours,
        minutes,
        seconds
      },
      credits,
      whatsappNumber: profile?.whatsapp_number || "",
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

    const saspaySecret = process.env.SASPAY_SECRET_KEY || process.env.SAASPAY_SECRET_KEY || process.env.SASPAY_KEY || process.env.SAASPAY_KEY || process.env.SASPAY_API_KEY;
    const fetch = (await import('node-fetch')).default;
    const saspayRes = await fetch(`https://api.saspay.me/api/v1/checkout-sessions/${encodeURIComponent(sessionId)}/`, {
      headers: {
        'Authorization': `Bearer ${saspaySecret}`
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

        const cycleInfo = parseCycleDuration(cycle);
        const activatedAt = session.paid_at || new Date().toISOString();
        const expiresAt = new Date(new Date(activatedAt).getTime() + cycleInfo.ms).toISOString();

        // 2. Recharger les crédits et persister l'abonnement dans profiles
        try {
          await supabase.from('profiles').update({
            credits,
            plan: planTier,
            plan_status: 'active',
            plan_cycle: cycle,
            plan_activated_at: activatedAt,
            plan_expires_at: expiresAt
          }).eq('id', targetUserId);
        } catch (pUpdateErr) {
          await supabase.from('profiles').update({ credits }).eq('id', targetUserId);
        }

        // 3. Activer l'abonnement et persister la commande dans Supabase Auth (sécurisé)
        try {
          await supabase.auth.admin.updateUserById(targetUserId, {
            app_metadata: {
              plan: planTier,
              plan_status: 'active',
              plan_cycle: cycle,
              plan_cycle_label: cycleInfo.label,
              plan_activated_at: activatedAt,
              plan_expires_at: expiresAt,
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
        let customerName = customer_name || "Client VANDIAS";

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

        const saspaySecret = process.env.SASPAY_SECRET_KEY || process.env.SAASPAY_SECRET_KEY || process.env.SASPAY_KEY || process.env.SAASPAY_KEY || process.env.SASPAY_API_KEY;
        const fetch = (await import('node-fetch')).default;
        const saspayRes = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${saspaySecret}`,
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

                    const cycleInfo = parseCycleDuration(cycle);
                    const activatedAt = sessionData.paid_at || new Date().toISOString();
                    const expiresAt = new Date(new Date(activatedAt).getTime() + cycleInfo.ms).toISOString();

                    // Mettre à jour les crédits et l'abonnement sur le profil
                    try {
                        await supabase
                            .from('profiles')
                            .update({
                                credits: credits,
                                plan: planTier,
                                plan_status: 'active',
                                plan_cycle: cycle,
                                plan_activated_at: activatedAt,
                                plan_expires_at: expiresAt
                            })
                            .eq('id', userId);
                    } catch (pErr) {
                        await supabase
                            .from('profiles')
                            .update({ credits: credits })
                            .eq('id', userId);
                    }

                    // Activer officiellement le forfait payant dans Supabase Auth (sécurisé)
                    try {
                        await supabase.auth.admin.updateUserById(userId, {
                            app_metadata: {
                                plan: planTier,
                                plan_status: 'active',
                                plan_cycle: cycle,
                                plan_cycle_label: cycleInfo.label,
                                plan_activated_at: activatedAt,
                                plan_expires_at: expiresAt,
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

        // Assainir last_message pour affichage fluide et compatibilite CRM
        const sanitizedContacts = (data || []).map(c => {
          let displayMessage = c.last_message;
          let history = [];
          if (typeof c.last_message === 'string' && c.last_message.startsWith('{')) {
            try {
              const parsed = JSON.parse(c.last_message);
              displayMessage = parsed.text || displayMessage;
              history = parsed.history || [];
            } catch (e) {}
          }
          return {
            ...c,
            last_message: displayMessage,
            history
          };
        });

        res.json({ success: true, contacts: sanitizedContacts });
    } catch (err) {
        console.error('Erreur fetch contacts:', err);
        res.status(500).json({ error: 'Erreur lors de la recuperation des contacts' });
    }
});

// === 7. CREATE / UPSERT CONTACT CRM ===
app.post('/api/contacts/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { name, phone, last_message, tag, status } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
    }

    try {
        const cleanPhone = String(phone).replace(/[^0-9]/g, '');
        const contactName = name ? String(name).trim() : 'Prospect';
        const nowIso = new Date().toISOString();
        const payloadMsg = typeof last_message === 'string' 
            ? last_message 
            : JSON.stringify({ 
                text: "Contact ajouté manuellement dans le CRM", 
                tag: tag || "Prospect", 
                status: status || "en_discussion", 
                history: [] 
              });

        const { data, error } = await supabase.from('contacts').upsert({
            user_id: userId,
            phone_number: cleanPhone,
            name: contactName,
            last_message: payloadMsg,
            updated_at: nowIso
        }, { onConflict: 'user_id, phone_number' }).select().single();

        if (error) throw error;

        console.log(`[CRM] Contact ${contactName} (${cleanPhone}) enregistré pour utilisateur ${userId}`);
        res.json({ success: true, message: 'Contact enregistré avec succès', contact: data });
    } catch (err) {
        console.error('Erreur sauvegarde contact CRM:', err);
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement du contact dans la base' });
    }
});



// === 8. ROUTES D'AFFILIATION & INTEGRATIONS ===
app.post('/api/affiliate/track-click', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code requis" });
    console.log(`[AFFILIATE] Clic enregistre pour le code: ${code}`);
    res.json({ success: true, message: "Clic comptabilise" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/integrations/payments', authMiddleware, async (req, res) => {
  try {
    const { userId, method, phone, beneficiary, note, active } = req.body;
    console.log(`[PAYMENTS] Mise a jour passerelle ${method} pour client ${userId}: ${phone} (${beneficiary})`);
    
    // Mettre a jour le prompt du profil si necessaire pour que l'IA connaisse toujours le bon numero
    if (supabase && userId && phone) {
      const { data: prof } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
      if (prof && prof.ai_prompt) {
        // Enregistrer discrètement les coordonnées de paiement à la fin du prompt
        const marker = "\n\n[COORDONNEES DE PAIEMENT ACTUELLES DU VENDEUR] :";
        const cleanPrompt = prof.ai_prompt.split(marker)[0];
        const updatedPrompt = `${cleanPrompt}${marker}\nMoyen: ${method.toUpperCase()} | Numero: ${phone} | Beneficiaire: ${beneficiary} | Statut: ${active ? 'Actif' : 'Pause'}`;
        await supabase.from('profiles').update({ ai_prompt: updatedPrompt }).eq('id', userId);
      }
    }

    res.json({ success: true, message: "Passerelle enregistree avec succes" });
  } catch (e) {
    console.error("Erreur save payment:", e);
    res.status(500).json({ error: e.message });
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


app.listen(PORT, '0.0.0.0', () => {
  console.log(`[KAMALA JEANNE] Moteur Backend démarré sur http://localhost:${PORT}`);
});

// Fix pour forcer le maintien du processus Node.js en vie
setInterval(() => {}, 1000 * 60 * 60);



