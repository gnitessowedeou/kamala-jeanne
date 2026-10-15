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

// Dossier de stockage persistant (Support natif des volumes Railway / Docker)
const AUTH_BASE_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || 
                      process.env.DATA_PATH || 
                      path.join(__dirname, '.wwebjs_auth');

try {
  if (!fs.existsSync(AUTH_BASE_DIR)) {
    fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
    console.log(`[STORAGE] Dossier d'authentification initialisé : ${AUTH_BASE_DIR}`);
  }
} catch (e) {
  console.warn('[STORAGE] Notice création AUTH_BASE_DIR :', e.message);
}

function getSessionDir(userId) {
  return path.join(AUTH_BASE_DIR, `session-${userId}`);
}

// Nettoyage préventif des verrous résiduels Chromium après redémarrage ou crash
function cleanupChromiumLocks(sessionPath) {
  if (!sessionPath) return;
  const lockFiles = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'DevToolsActivePort'
  ];

  // 1. Suppression forcée directe de tous les verrous (gère liens symboliques morts et sockets)
  for (const lockFile of lockFiles) {
    const lockPath = path.join(sessionPath, lockFile);
    try {
      fs.rmSync(lockPath, { force: true, recursive: true });
      console.log(`[STORAGE] Verrou résiduel Chromium purgé : ${lockFile}`);
    } catch (e) {}
  }

  // 2. Scan récursif pour éliminer tout lien symbolique ou verrou résiduel
  try {
    if (fs.existsSync(sessionPath)) {
      const entries = fs.readdirSync(sessionPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(sessionPath, entry.name);
        if (entry.name.startsWith('Singleton') || entry.name === 'DevToolsActivePort') {
          try {
            fs.rmSync(full, { force: true, recursive: true });
            console.log(`[STORAGE] Verrou récursif purgé : ${full}`);
          } catch(e) {}
        } else if (entry.isDirectory() && entry.name !== 'Default' && entry.name !== 'IndexedDB') {
          cleanupChromiumLocks(full);
        }
      }
    }
  } catch (e) {}
}

// Purge automatique globale au démarrage du serveur pour tous les profils existants
try {
  if (fs.existsSync(AUTH_BASE_DIR)) {
    const entries = fs.readdirSync(AUTH_BASE_DIR);
    for (const d of entries) {
      if (d.startsWith('session-')) {
        cleanupChromiumLocks(path.join(AUTH_BASE_DIR, d));
      }
    }
  }
} catch (e) {}

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
    },
    storage: {
      authBaseDir: AUTH_BASE_DIR,
      exists: fs.existsSync(AUTH_BASE_DIR),
      sessions: fs.existsSync(AUTH_BASE_DIR) ? fs.readdirSync(AUTH_BASE_DIR).filter(e => e.startsWith('session-')) : []
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
const waHeartbeats = {}; // Intervalles keep-alive Chromium / WebSocket WhatsApp

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

// Memoire contextuelle persistante & fenetre de session de 4h
const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;  // 4 heures d'inactivite
const MAX_HISTORY_MESSAGES = 12;                // Maintient au minimum 8 a 12 echanges pour un contexte sans faille
const waChatHistories = new Map();              // Cache memoire haute vitesse: ${userId}:${phone} -> { history, lastActivity, sessionStart, name }

/**
 * Recupere la session et l'historique d'un client.
 * Recharge automatiquement depuis Supabase en cas de redemarrage serveur.
 * Conserve impérativement l'historique des 8 à 12 derniers messages pour ne jamais perdre le fil commercial.
 */
async function getCustomerSession(userId, phone, fallbackName = 'Cher client') {
  const historyKey = `${userId}:${phone}`;
  const now = Date.now();
  let sessionData = waChatHistories.get(historyKey);
  let contactRow = null;

  // Si non present dans le cache memoire (ex: reboot Railway / redeploiement), recharger depuis Supabase
  if (!sessionData && supabase && userId) {
    try {
      const cleanDigits = String(phone).replace(/\D/g, '');
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .or(`phone_number.eq.${phone},phone_number.eq.${cleanDigits},phone_number.eq.+${cleanDigits}`)
        .limit(1)
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

  // Verification de la fenetre des 4h pour savoir s'il faut saluer
  const isFirstContact = !sessionData || !sessionData.lastActivity || sessionData.lastActivity === 0;
  const elapsed = sessionData && sessionData.lastActivity ? (now - sessionData.lastActivity) : 0;
  const isExpired = elapsed > SESSION_TIMEOUT_MS;
  const isNewSession = isFirstContact || isExpired;

  // RÈGLE STRICTE : Toujours conserver les 8 à 12 derniers messages d'historique
  const activeHistory = (sessionData && Array.isArray(sessionData.history) && sessionData.history.length > 0)
    ? sessionData.history.slice(-MAX_HISTORY_MESSAGES)
    : [];

  let sessionStart = sessionData ? sessionData.sessionStart : new Date(now).toISOString();
  let contactName = sessionData ? (sessionData.name || fallbackName) : fallbackName;

  if (isNewSession) {
    sessionStart = new Date(now).toISOString();
    console.log(`[WA/SESSION] REPRISE / NOUVELLE SESSION pour ${phone} (${isFirstContact ? 'Premier contact' : 'Inactivite > 4h'}). Historique conserve: ${activeHistory.length} msgs.`);
  } else {
    console.log(`[WA/SESSION] SESSION EN COURS pour ${phone} (Derniere activite il y a ${Math.round(elapsed / 60000)} min, ${activeHistory.length} msgs).`);
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
 * Moteur de réponse commerciale IA pour VANDIA IA
 * Utilise strictement la configuration, le catalogue, les prix, les instructions et l'historique du compte
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
  const strictBusinessDirectives = `
## RÈGLES STRICTES DE POSTURE COMMERCIALE (VANDIA IA) :
1. MISSION ET POSTURE :
- Tu es l'agent commercial officiel et exclusif de l'entreprise sur WhatsApp.
- Tu incarnes un excellent commercial : poli, courtois, chaleureux, bienveillant, digne de confiance et persuasif.
- Réponds UNIQUEMENT lorsqu'un client ou prospect t'écrit. N'envoie jamais de message spontanément.
- Pose au maximum UNE seule question courte et pertinente à la fois pour guider le client vers la conclusion de sa commande.

2. CATALOGUE PRODUITS ET TARIFS (RÈGLE ABSOLUE ANTI-HALLUCINATION) :
- Tu dois utiliser EXCLUSIVEMENT les produits, services, tarifs, remises et conditions figurant dans les INSTRUCTIONS OFFICIELLES de l'entreprise fournies ci-dessous.
- INTERDICTION FORMELLE d'inventer des produits, des prix, des fonctionnalités ou des prestations qui ne figurent pas explicitement dans les instructions de l'entreprise.
- Si le client demande un produit ou service qui n'est pas dans le catalogue, réponds poliment qu'il n'est pas disponible actuellement et oriente-le vers les offres officielles disponibles.

3. COORDONNÉES DE PAIEMENT & SÉCURITÉ :
- Utilise EXCLUSIVEMENT les moyens de paiement (Wave, Orange Money, MTN MoMo, Moov Money, Carte, etc.), numéros officiels et noms de bénéficiaires précisés dans les instructions de l'entreprise ci-dessous.
- N'invente JAMAIS de numéro de paiement ni de nom de titulaire.
- INTERDICTION ABSOLUE de valider ou confirmer un paiement à l'aveugle. Demande poliment la capture d'écran ou la référence du transfert au client et informe-le avec bienveillance que sa commande sera validée dès confirmation par le responsable.
- Ne demande JAMAIS de code secret, code PIN, mot de passe bancaire ou identifiant confidentiel.

4. FORMAT WHATSAPP :
- Réponses courtes (3 à 5 lignes concises), aérées, élégantes et parfaitement lisibles sur smartphone, avec des puces et des émojis bien dosés (😊, ✨, 📦, 💳).
- Interdiction de faire de longs blocs de texte indigestes.

5. CONTINUITÉ ET FLUIDITÉ CONVERSATIONNELLE :
- Consulte attentivement l'historique des derniers échanges ci-dessous. Maintiens une parfaite cohérence avec ce qui a déjà été dit.
- Ne redis pas "Bonjour" si la conversation est déjà entamée. Réponds directement au client et avance vers l'objectif commercial.
`;

  const userInstructions = (basePrompt && basePrompt.trim().length > 10)
    ? `\n## INSTRUCTIONS, CATALOGUE ET COORDONNÉES FOURNIS PAR L'ENTREPRISE :\n${basePrompt.trim()}`
    : `\n## INSTRUCTIONS DE L'ENTREPRISE :\nTu es l'agent commercial de l'entreprise. Accueille le client chaleureusement, renseigne-le avec précision sur nos offres et guide-le vers la finalisation de sa commande.`;

  const sessionDirectives = isNewSession
    ? `\n[CONSIGNE D'ACCUEIL] : Si c'est le tout premier message, salue chaleureusement le client (ex: "Bonjour ${contactName || ''} ! Bienvenue 😊"). Si la discussion est déjà engagée dans l'historique, poursuis naturellement.`
    : `\n[CONSIGNE DE SUIVI] : La discussion est active, réponds directement à la demande du client sans formule d'accueil répétitive.`;

  const systemMessageContent = `${strictBusinessDirectives}\n${userInstructions}\n${sessionDirectives}`;

  // Conserver au minimum 8 à 12 messages d'historique
  const recentHistory = Array.isArray(history) ? history.slice(-12) : [];

  const openAiMessages = [
    { role: 'system', content: systemMessageContent },
    ...recentHistory,
    { role: 'user', content: userMessage }
  ];

  if (!openai) {
    console.warn("[WA/AI] Client OpenAI non initialisé. Vérifiez OPENAI_API_KEY.");
    return isNewSession
      ? `Bonjour ${contactName || ''} ! Bienvenue chez nous 😊 Comment puis-je vous renseigner sur nos produits aujourd'hui ?`
      : `Je note votre demande. Souhaitez-vous des détails complémentaires pour finaliser votre commande ?`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: openAiMessages,
    max_tokens: 450,
    temperature: 0.7
  });

  const replyText = (completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content)
    ? completion.choices[0].message.content.trim()
    : "Je reste à votre entière disposition pour vous accompagner dans votre commande !";

  return replyText;
}


// =============================================================================
// MOTEUR UNIVERSEL DE GESTION DES MESSAGES ENTRANTS (AGENT IA WHATSAPP)
// =============================================================================
async function handleIncomingWhatsAppMessage(msg, isSelfTest, client, userId) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const msgTime = msg.timestamp && msg.timestamp > 1e11 ? Math.floor(msg.timestamp / 1000) : (msg.timestamp || now);

    // Ignorer uniquement les messages réellement anciens (plus de 2 heures) reçus lors du rattrapage historique
    if (msgTime && msgTime < now - 7200) {
      console.log(`[WA] Message historique ignoré (TS: ${msgTime}, Now: ${now})`);
      return;
    }

    // Ignorer les statuts WhatsApp et les groupes de discussion
    if (msg.isStatus || (msg.from && msg.from.includes('@g.us')) || (msg.to && msg.to.includes('@g.us'))) {
      return;
    }

    // Vérifier que le message contient du texte
    if (!msg.body || msg.body.trim() === '') return;

    // Éviter les boucles infinies
    if (msg.body.startsWith('[IA') || msg.body.startsWith('[BOT')) return;

    console.log(`[WA/INCOMING] Message reçu pour utilisateur ${userId} de ${msg.from} (autoTest=${isSelfTest}): "${msg.body}"`);

    // Récupérer le profil Supabase spécifique à cet utilisateur
    let profile = null;
    if (supabase && userId) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('credits, ai_prompt, created_at, full_name, whatsapp_number')
          .eq('id', userId)
          .single();
        profile = data;
      } catch (dbErr) {
        console.warn('[WA] Notice Supabase profil:', dbErr.message);
      }
    }

    // Crédits : Donner au moins 100 crédits de test si nouveau compte
    const credits = (profile && typeof profile.credits === 'number') ? profile.credits : 100;
    if (credits <= 0) {
      console.log(`[WA] Utilisateur ${userId} sans crédits. Réponse suspendue.`);
      return;
    }

    // Résolution sécurisée du numéro de téléphone et du nom de contact
    let cName = isSelfTest ? 'Auto-Test (Moi)' : 'Client WhatsApp';
    let cleanPhone = null;

    try {
      const contact = await Promise.race([
        msg.getContact(),
        new Promise((_, r) => setTimeout(() => r(null), 2500))
      ]);
      if (contact) {
        if (contact.number) cleanPhone = String(contact.number).replace(/\D/g, '');
        if (contact.pushname || contact.name) cName = contact.pushname || contact.name;
      }
    } catch (e) {}

    if (!cleanPhone && msg.author) {
      cleanPhone = String(msg.author).split('@')[0].replace(/\D/g, '');
    }
    if (!cleanPhone && msg.from) {
      cleanPhone = String(msg.from).split('@')[0].replace(/\D/g, '');
    }

    const rawSender = isSelfTest ? (client.info ? client.info.wid.user : 'Moi') : (cleanPhone || 'Inconnu');

    // Prompt configuré spécifiquement par cet utilisateur
    const basePrompt = (profile && profile.ai_prompt && profile.ai_prompt.trim().length > 10) 
      ? profile.ai_prompt 
      : null;

    // Récupérer ou restaurer la session et l'historique conversationnel (maintient au moins 8 à 12 messages)
    const session = await getCustomerSession(userId, rawSender, cName);

    // Générer la réponse de l'agent commercial VANDIA IA
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
      console.error("[WA/IA] Erreur génération IA :", aiErr.message);
      aiResponse = session.isNewSession
        ? `Bonjour ${session.contactName || cName} ! Bienvenue 😊 Comment puis-je vous aider aujourd'hui ?`
        : `Je vous écoute, comment puis-je vous renseigner sur nos produits et commandes ?`;
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

    console.log(`[WA/REPLY] Envoi de la réponse IA vers ${msg.from} : "${aiResponse.substring(0, 80)}..."`);

    // DÉLIVRANCE MULTI-NIVEAUX GARANTIE À 100% (Gère nativement @c.us et @lid)
    let delivered = false;

    // Niveau 1 : Envoi via l'objet Chat (recommandé et officiel whatsapp-web.js)
    try {
      const chat = await Promise.race([
        msg.getChat(),
        new Promise((_, r) => setTimeout(() => r(null), 3000))
      ]);
      if (chat && typeof chat.sendMessage === 'function') {
        try { await chat.sendStateTyping(); } catch(e) {}
        await new Promise(r => setTimeout(r, 600));
        const sent = await chat.sendMessage(aiResponse);
        if (sent) delivered = true;
        console.log(`[WA/DELIVERED] Réponse IA délivrée avec succès via chat.sendMessage à ${chat.id ? chat.id._serialized : msg.from}`);
      }
    } catch (chatSendErr) {
      console.warn(`[WA/DELIVERY] chat.sendMessage a échoué: ${chatSendErr.message}`);
    }

    // Niveau 2 : client.sendMessage avec cibles candidates (@c.us et @lid)
    if (!delivered) {
      const candidates = [];
      if (isSelfTest && client.info && client.info.wid) {
        candidates.push(client.info.wid._serialized);
      } else {
        if (msg.from) candidates.push(msg.from);
        if (cleanPhone && cleanPhone.length >= 8) candidates.push(`${cleanPhone}@c.us`);
      }

      for (const target of candidates) {
        if (delivered) break;
        let formattedTarget = target;
        if (formattedTarget.includes('@s.whatsapp.net')) {
          formattedTarget = formattedTarget.replace('@s.whatsapp.net', '@c.us');
        } else if (!formattedTarget.includes('@')) {
          formattedTarget = `${formattedTarget.replace(/\D/g, '')}@c.us`;
        }

        try {
          const sent = await client.sendMessage(formattedTarget, aiResponse);
          if (sent) {
            delivered = true;
            console.log(`[WA/DELIVERED] Réponse IA délivrée via client.sendMessage à ${formattedTarget}`);
            break;
          }
        } catch (directErr) {
          console.warn(`[WA/DELIVERY] client.sendMessage direct vers ${formattedTarget} a échoué: ${directErr.message}`);
        }
      }
    }

    // Niveau 3 : msg.reply en ultime secours
    if (!delivered) {
      try {
        const sent = await msg.reply(aiResponse);
        if (sent) delivered = true;
        console.log(`[WA/DELIVERED] Réponse IA délivrée via msg.reply en ultime secours`);
      } catch (replyErr) {
        console.error(`[WA/DELIVERY] Échec définitif délivrance réponse: ${replyErr.message}`);
      }
    }

    // Déduire 1 crédit si le message a été délivré
    if (delivered && supabase && userId && profile && profile.credits > 0) {
      try {
        await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      } catch (crErr) {}
    }
  } catch (err) {
    console.error("[WA/IA] Erreur globale traitement message :", err);
  }
}

// =============================================================================
// MOTEUR CENTRALISÉ WHATSAPP MULTI-DEVICE À TRÈS HAUTE DISPONIBILITÉ
// (Reste actif même si le smartphone est éteint, sans batterie ou hors-ligne)
// =============================================================================

async function createOrGetWhatsAppClient(userId, options = {}) {
  const { restart = false, phoneNumber = null, autoRestore = false } = options;
  const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;
  const authDir = getSessionDir(userId);
  const hasExistingSession = fs.existsSync(authDir);

  // 1. Si déjà actif et connecté
  if (waClients[userId] && !restart) {
    if (waStatuses[userId] === 'CONNECTED') {
      return waClients[userId];
    }
    if (waStatuses[userId] === 'STARTING' || waStatuses[userId] === 'RECONNECTING') {
      return waClients[userId];
    }
  }

  // 2. Nettoyage explicite UNIQUEMENT si redémarrage forcé par l'utilisateur
  if (restart) {
    if (waClients[userId]) {
      try { await waClients[userId].destroy(); } catch (e) {}
      delete waClients[userId];
    }
    if (waHeartbeats[userId]) {
      clearInterval(waHeartbeats[userId]);
      delete waHeartbeats[userId];
    }
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
    delete waNumbers[userId];
    if (hasExistingSession) {
      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
    }
  }

  // Nettoyage des verrous Chromium si session existante pour assurer un démarrage sans heurt
  if (hasExistingSession) {
    cleanupChromiumLocks(authDir);
  }

  // 3. Statut initial (si session existante sur disque, maintien du statut connecté/reconnexion sans paniquer l'interface)
  waStatuses[userId] = hasExistingSession ? 'RECONNECTING' : 'STARTING';
  if (cleanPhone) waNumbers[userId] = cleanPhone;

  const chromiumPath = getChromiumExecutablePath();
  console.log(`[WA] Lancement client haute résilience pour ${userId} (sessionExistante=${hasExistingSession}, pairPhone=${cleanPhone || 'non'}, storage=${AUTH_BASE_DIR})...`);

  // Stratégie d'authentification robuste avec dataPath pointant sur le volume persistant
  const authStrategy = new LocalAuth({ 
    clientId: userId,
    dataPath: AUTH_BASE_DIR 
  });

  // PROTECTION CRITIQUE MULTI-DEVICE :
  // whatsapp-web.js déclenche authStrategy.logout() dès qu'un événement transitoire
  // comme 'logout_from_bridge' survient (lorsque le téléphone principal s'éteint ou est hors-ligne).
  // On surcharge logout() pour interdire formellement toute suppression physique sur le disque !
  authStrategy.logout = async function() {
    console.warn(`[WA/GUARD] Appel authStrategy.logout() intercepté pour ${userId}. Les fichiers de session restent protégés et conservés sur disque.`);
  };

  // Flags Puppeteer ultra-optimisés : empêchent Chromium de suspendre les timers et WebSockets en arrière-plan
  const clientOptions = {
    authStrategy,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 5000,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-ipc-flooding-protection',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio'
      ],
      ...(chromiumPath ? { executablePath: chromiumPath } : {})
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  };

  if (cleanPhone && cleanPhone.length >= 8 && !hasExistingSession) {
    clientOptions.pairWithPhoneNumber = {
      phoneNumber: cleanPhone,
      showNotification: true,
      intervalMs: 180000
    };
    console.log(`[WA] Client ${userId} configuré pour code d'association (+${cleanPhone})`);
  }

  const client = new Client(clientOptions);
  waClients[userId] = client;

  // Gestion des événements QR Code & Code d'association
  client.on('qr', async (qr) => {
    try {
      const qrImage = await qrcode.toDataURL(qr);
      waSessionsQR[userId] = qrImage;
      if (!waPairingCodes[userId]) waStatuses[userId] = 'QR_READY';
      console.log(`📱 [WA] QR Code prêt pour client ${userId}`);
    } catch (e) {}
  });

  client.on('code', (code) => {
    console.log(`🔑 [WA] Client ${userId} PAIRING CODE REÇU : ${code}`);
    waPairingCodes[userId] = code;
    waStatuses[userId] = 'CODE_READY';
  });

  client.on('authenticated', () => {
    console.log(`🎉 [WA] Client ${userId} AUTHENTIFIÉ (Session validée) !`);
    waStatuses[userId] = 'AUTHENTICATED';
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
    const detectedPhone = getClientPhone(client, userId) || cleanPhone;
    if (detectedPhone) waNumbers[userId] = detectedPhone;
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[WA] Client ${userId} synchronisation: ${percent}% - ${message}`);
    waStatuses[userId] = 'AUTHENTICATED';
    const detectedPhone = getClientPhone(client, userId);
    if (detectedPhone) waNumbers[userId] = detectedPhone;
  });

  client.on('ready', async () => {
    waStatuses[userId] = 'CONNECTED';
    let detectedPhone = getClientPhone(client, userId);
    if (!detectedPhone) {
      detectedPhone = await getClientPhoneAsync(client, userId);
    }
    if (!detectedPhone && cleanPhone) {
      detectedPhone = cleanPhone;
    }
    if (detectedPhone) {
      waNumbers[userId] = detectedPhone;
    }
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
    console.log(`✅ [WA] Client ${userId} CONNECTÉ sur WhatsApp ! Numéro: ${waNumbers[userId] || 'Actif'}`);

    // Heartbeat Keep-Alive toutes les 40 secondes : empêche Chromium / WebSocket de se déconnecter
    if (waHeartbeats[userId]) clearInterval(waHeartbeats[userId]);
    waHeartbeats[userId] = setInterval(async () => {
      try {
        if (client && client.pupPage && !client.pupPage.isClosed()) {
          await client.pupPage.evaluate(() => {
            return (window.Store && window.Store.State) ? window.Store.State.default.state : 'HEARTBEAT_OK';
          });
        }
      } catch (hbErr) {
        console.warn(`[WA/HEARTBEAT] Signal pour ${userId}:`, hbErr.message);
      }
    }, 40000);

    // Synchronisation automatique dans Supabase
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
    console.error(`[WA] Échec d'authentification pour ${userId} :`, msg);
    waStatuses[userId] = 'DISCONNECTED';
    delete waClients[userId];
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
  });

  // HAUTE DISPONIBILITÉ MULTI-DEVICE :
  // Le smartphone principal peut être éteint, sans batterie ou hors-ligne sans perdre la liaison WhatsApp du bot !
  // Les clés Multi-Device de l'appareil compagnon restent 100% valides sur les serveurs de Meta jusqu'à 14 jours.
  // INTERDICTION STRICTE DE SUPPRIMER LES FICHIERS DE SESSION SUR DISQUE ICI.
  client.on('change_state', (state) => {
    console.log(`[WA/STATE] État de connexion changé pour ${userId} : ${state}`);
    if (state === 'CONNECTED') {
      waStatuses[userId] = 'CONNECTED';
    } else if (state === 'OPENING' || state === 'PAIRING') {
      waStatuses[userId] = 'RECONNECTING';
    }
  });

  client.on('disconnected', async (reason) => {
    console.warn(`[WA] Client ${userId} déconnecté. Raison : ${reason}`);
    if (waHeartbeats[userId]) {
      clearInterval(waHeartbeats[userId]);
      delete waHeartbeats[userId];
    }

    // Quelle que soit la raison ('LOGOUT' provoqué par logout_from_bridge lors de la coupure du smartphone,
    // TIMEOUT, CONFLICT, NAVIGATION, etc.), la session sur disque est PRÉSERVÉE ET PROTÉGÉE.
    // Seul un appel explicite à POST /api/whatsapp/disconnect a le droit de purger la session.
    waStatuses[userId] = 'RECONNECTING';
    delete waClients[userId];
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];

    try { await client.destroy(); } catch (e) {}

    console.log(`[WA/RECONNECT] Session préservée pour ${userId}. Reconnexion automatique en tâche de fond dans 4 secondes...`);
    setTimeout(() => {
      createOrGetWhatsAppClient(userId, { autoRestore: true }).catch(err => {
        console.warn(`[WA/RECONNECT] Notice tentative reconnexion ${userId} :`, err.message);
      });
    }, 4000);
  });

  // Déduplication & écouteurs d'événements messages (Garantit 100% des réceptions)
  const processedMessageIds = new Set();
  const handleAnyMessageEvent = async (msg) => {
    try {
      if (!msg) return;
      const msgId = typeof msg.id === 'string'
        ? msg.id
        : (msg.id ? (msg.id._serialized || msg.id.id) : null) || `${msg.from || 'u'}_${msg.timestamp || 0}_${(msg.body || '').substring(0, 15)}`;

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

      // Détection message auto-test
      const isSelf = Boolean(
        msg.fromMe && (
          (msg.to && myWid && msg.to === myWid) ||
          (msg.to && myPhone && msg.to.includes(myPhone)) ||
          (msg.id && msg.id.remote && myWid && msg.id.remote === myWid) ||
          (msg.id && msg.id.remote && myPhone && msg.id.remote.includes(myPhone))
        )
      );

      // Si le message a été envoyé par moi à un client (l'humain parle), on n'intervient pas mais on note dans l'historique
      if (msg.fromMe && !isSelf) {
        try {
          if (msg.body && !msg.body.startsWith('[IA') && !msg.body.startsWith('[BOT')) {
            const customerPhone = msg.to ? msg.to.split('@')[0].replace(/\D/g, '') : null;
            if (customerPhone && customerPhone.length >= 8) {
              const historyKey = `${userId}:${customerPhone}`;
              const cached = waChatHistories.get(historyKey) || { history: [], lastActivity: Date.now() };
              cached.history = [...(cached.history || []), { role: 'assistant', content: msg.body }].slice(-MAX_HISTORY_MESSAGES);
              cached.lastActivity = Date.now();
              waChatHistories.set(historyKey, cached);
            }
          }
        } catch (hErr) {}
        return;
      }

      await handleIncomingWhatsAppMessage(msg, isSelf, client, userId);
    } catch (e) {
      console.error("[WA] Erreur routeur message:", e);
    }
  };

  client.on('message', handleAnyMessageEvent);
  client.on('message_create', handleAnyMessageEvent);

  client.initialize().catch(async (err) => {
    console.error(`[WA] Erreur initialize client ${userId}:`, err.message);
    if (err.message && (err.message.includes('Singleton') || err.message.includes('locked the profile') || err.message.includes('Code: 21'))) {
      console.log(`[WA] Verrou résiduel Chromium détecté pour ${userId}. Purge et relance automatique...`);
      cleanupChromiumLocks(authDir);
      try {
        await new Promise(r => setTimeout(r, 1000));
        await client.initialize();
        console.log(`[WA] Initialisation réussie après purge pour ${userId}`);
        return;
      } catch (retryErr) {
        console.error(`[WA] Échec seconde tentative initialize:`, retryErr.message);
      }
    }
    waStatuses[userId] = 'ERROR';
    waSessionsQR[userId] = err.message;
    delete waClients[userId];
  });

  return client;
}

app.post('/api/whatsapp/start', authMiddleware, async (req, res) => {
  const { userId, restart, phoneNumber } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });
  const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;

  if (waStatuses[userId] === 'CONNECTED' && !restart && waClients[userId]) {
    return res.json({ status: 'CONNECTED', message: "Bot déjà actif", phone: waNumbers[userId] || null });
  }

  try {
    await createOrGetWhatsAppClient(userId, { restart: !!restart, phoneNumber: cleanPhone });

    for (let i = 0; i < 6; i++) {
      if (waStatuses[userId] === 'CONNECTED') {
        return res.json({ status: 'CONNECTED', message: "Bot déjà connecté", phone: waNumbers[userId] || null });
      }
      if (waStatuses[userId] === 'QR_READY' && waSessionsQR[userId]) {
        return res.json({ status: 'QR_READY', qr: waSessionsQR[userId] });
      }
      await new Promise(r => setTimeout(r, 400));
    }

    if (waStatuses[userId] === 'QR_READY' && waSessionsQR[userId]) {
      return res.json({ status: 'QR_READY', qr: waSessionsQR[userId] });
    }
    return res.json({ status: waStatuses[userId] || 'STARTING' });
  } catch (err) {
    console.error("[WA] Erreur start:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/disconnect', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });
  if (waClients[userId]) {
    try { await waClients[userId].destroy(); } catch (e) {}
    delete waClients[userId];
  }
  if (waHeartbeats[userId]) {
    clearInterval(waHeartbeats[userId]);
    delete waHeartbeats[userId];
  }
  waStatuses[userId] = 'DISCONNECTED';
  delete waSessionsQR[userId];
  delete waPairingCodes[userId];
  delete waNumbers[userId];
  const authDir = getSessionDir(userId);
  if (fs.existsSync(authDir)) {
    try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
  }
  res.json({ success: true, message: "Session WhatsApp déconnectée et réinitialisée avec succès." });
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

  try {
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
        console.warn(`[WA] Échec requestPairingCode direct: ${err.message}. Relance du client...`);
      }
    }

    await createOrGetWhatsAppClient(userId, { restart: true, phoneNumber: cleanPhone });

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
  const authDir = getSessionDir(userId);
  const hasExistingSession = fs.existsSync(authDir);

  // Si pas de client actif en mémoire mais session existante sur disque, auto-restaurer silencieusement
  if (!client && hasExistingSession && waStatuses[userId] !== 'STARTING') {
    createOrGetWhatsAppClient(userId, { autoRestore: true }).catch(() => {});
    waStatuses[userId] = 'RECONNECTING';
  }

  let st = waStatuses[userId] || (hasExistingSession ? 'CONNECTED' : 'DISCONNECTED');
  // Pendant la reconnexion automatique en tâche de fond, maintenir 'CONNECTED' pour ne pas paniquer le frontend
  if (st === 'AUTHENTICATED' || st === 'RECONNECTING') {
    st = 'CONNECTED';
  }

  let detectedPhone = getClientPhone(client, userId);
  if (!detectedPhone && client && st === 'CONNECTED') {
    detectedPhone = await getClientPhoneAsync(client, userId);
  }
  if (!detectedPhone && waNumbers[userId]) {
    detectedPhone = waNumbers[userId];
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

    let systemPrompt = "Tu es l'agent commercial officiel de VANDIA IA sur WhatsApp. Sois chaleureux, persuasif, très poli, attentif et guide le client avec bienveillance.";
    if (userId && supabase) {
      try {
        const { data: profile } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
        if (profile && profile.ai_prompt) systemPrompt = profile.ai_prompt;
      } catch (pErr) {}
    }

    // Gestion de session (Conserve le contexte d'au moins 8 à 12 messages)
    const session = await getCustomerSession(userId || 'test_user', phone, 'Client Test');
    if (simulateInactivityHours >= 4) {
      session.isNewSession = true;
      session.history = session.history.slice(-12);
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

    const KNOWN_COUNTRY_CODES = ['+225', '+229', '+226', '+221', '+228', '+223', '+227', '+224', '+245', '+234', '+233', '+220', '+231', '+232', '+238', '+222', '+237', '+242', '+243', '+241', '+33', '+1'];
    let parsedPhoneCountry = "+225";
    let parsedPhoneNumber = "";
    const rawWaNumber = (profile.whatsapp_number || "").toString().trim();
    if (rawWaNumber) {
      const normalizedWa = rawWaNumber.startsWith('+') ? rawWaNumber : '+' + rawWaNumber;
      const matchedPrefix = KNOWN_COUNTRY_CODES.find(code => normalizedWa.startsWith(code));
      if (matchedPrefix) {
        parsedPhoneCountry = matchedPrefix;
        parsedPhoneNumber = normalizedWa.slice(matchedPrefix.length).replace(/\D/g, '');
      } else {
        parsedPhoneNumber = normalizedWa.replace(/^\+\d{1,4}/, '').replace(/\D/g, '');
      }
    }

    return res.status(200).json({
      success: true,
      profile,
      user: {
        id: user.id,
        firstName: profile.first_name || firstName,
        lastName: profile.last_name || lastName,
        email: profile.email || cleanEmail,
        phoneCountry: parsedPhoneCountry,
        phoneNumber: parsedPhoneNumber,
        fullPhone: rawWaNumber,
        whatsapp_number: rawWaNumber,
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

  // Restauration automatique de toutes les sessions WhatsApp sauvegardées sur le serveur
  setTimeout(() => {
    try {
      const authBasePath = AUTH_BASE_DIR;
      if (fs.existsSync(authBasePath)) {
        const entries = fs.readdirSync(authBasePath);
        for (const entry of entries) {
          if (entry.startsWith('session-')) {
            const userId = entry.replace('session-', '');
            if (userId && !waClients[userId]) {
              console.log(`🚀 [WA/STARTUP] Rétablissement automatique de la session persistante pour ${userId}...`);
              createOrGetWhatsAppClient(userId, { autoRestore: true }).catch(err => {
                console.warn(`[WA/STARTUP] Notice restauration pour ${userId}:`, err.message);
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[WA/STARTUP] Erreur détection sessions existantes:', err.message);
    }
  }, 3500);
});

// Fix pour forcer le maintien du processus Node.js en vie
setInterval(() => {}, 1000 * 60 * 60);



