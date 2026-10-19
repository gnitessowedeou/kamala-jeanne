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
  const lockNames = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'DevToolsActivePort',
    'lockfile',
    'Local State'
  ];

  function cleanDir(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir);
      for (const entryName of entries) {
        if (lockNames.some(l => entryName.toLowerCase().includes(l.toLowerCase()))) {
          const fullPath = path.join(dir, entryName);
          try { fs.unlinkSync(fullPath); } catch(e) {}
          try { fs.rmSync(fullPath, { force: true, recursive: true }); } catch(e) {}
        }
      }
    } catch(e) {}
  }

  cleanDir(sessionPath);
  cleanDir(path.join(sessionPath, 'Default'));
}

// Tampon de logs en mémoire pour le diagnostic temps réel
const serverLiveLogs = [];
const _origConsoleLog = console.log;
const _origConsoleWarn = console.warn;
const _origConsoleError = console.error;

console.log = (...args) => {
  _origConsoleLog(...args);
  try {
    serverLiveLogs.unshift({ type: 'log', time: new Date().toISOString(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    if (serverLiveLogs.length > 200) serverLiveLogs.pop();
  } catch(e) {}
};

console.warn = (...args) => {
  _origConsoleWarn(...args);
  try {
    serverLiveLogs.unshift({ type: 'warn', time: new Date().toISOString(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    if (serverLiveLogs.length > 200) serverLiveLogs.pop();
  } catch(e) {}
};

console.error = (...args) => {
  _origConsoleError(...args);
  try {
    serverLiveLogs.unshift({ type: 'error', time: new Date().toISOString(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    if (serverLiveLogs.length > 200) serverLiveLogs.pop();
  } catch(e) {}
};

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

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isExplicit = allowedOrigins.indexOf(origin) !== -1;
    const isVercelSubdomain = origin.endsWith('.vercel.app');
    const isVandiasSubdomain = origin.endsWith('.vandias.com') || origin.endsWith('.vandia.ai');
    if (isExplicit || isVercelSubdomain || isVandiasSubdomain) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origine bloquée : ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-user-id',
    'X-User-Id',
    'x-admin-key',
    'x-webhook-secret',
    'x-saspay-signature',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Authorization', 'x-user-id'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('{*path}', cors(corsOptions));

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

// Healthcheck officiel pour Railway, Vercel et monitoring uptime
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK', uptime: Math.floor(process.uptime()), memory: process.memoryUsage() }));

// Pages HTML publiques
app.get('/api/diag', (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_KEY;
  const provided = req.headers['x-admin-key'];
  if (!adminSecret || !provided || provided !== adminSecret) {
    return res.status(403).json({ error: 'Accès restreint aux administrateurs.' });
  }
  next();
}, (req, res) => {
  const chromiumPath = getChromiumExecutablePath();
  const sessionEntries = fs.existsSync(AUTH_BASE_DIR) ? fs.readdirSync(AUTH_BASE_DIR).filter(e => e.startsWith('session-')) : [];

  res.json({
    status: 'OK',
    platform: process.platform,
    arch: process.arch,
    detectedPath: chromiumPath,
    chromiumAvailable: !!(chromiumPath && fs.existsSync(chromiumPath)),
    env_diagnostics: {
      has_SASPAY_SECRET_KEY: !!(process.env.SASPAY_SECRET_KEY || process.env.SAASPAY_SECRET_KEY),
      has_SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      has_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY
    },
    storage: {
      authBaseDir: AUTH_BASE_DIR,
      exists: fs.existsSync(AUTH_BASE_DIR),
      sessionCount: sessionEntries.length
    }
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/data-deletion.html', (req, res) => res.sendFile(path.join(__dirname, 'data-deletion.html')));
app.get('/admin.html', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const targetUserId = req.params.userId || (req.body && req.body.userId) || req.headers['x-user-id'];

  // 1. Validation prioritaire par jeton JWT Supabase officiel (si présent)
  if (token && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        // Protection stricte IDOR / BOLA : L'utilisateur ne peut agir que sur son propre compte
        if (targetUserId && req.user.id !== targetUserId) {
          console.warn(`[SÉCURITÉ] IDOR bloqué : ${req.user.id} a tenté d'accéder aux données de ${targetUserId}`);
          return res.status(403).json({ error: "Accès interdit : Opération non autorisée pour ce compte." });
        }
        return next();
      }
      console.warn('[AUTH] Token JWT non validé par Supabase:', error ? error.message : 'invalide');
    } catch (err) {
      console.warn('[AUTH] Échec validation JWT :', err.message);
    }
  }

  // 2. Validation de secours : vérification que le compte utilisateur existe réellement dans profiles
  if (targetUserId && UUID_RE.test(String(targetUserId))) {
    if (supabase) {
      try {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', targetUserId).maybeSingle();
        if (profile && profile.id) {
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

  return res.status(401).json({ error: "Accès refusé : Authentification requise (veuillez vous connecter)." });
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
    '/nix/var/nix/profiles/default/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
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
const waErrors = {};     // Stocke les erreurs d'initialisation de chaque client
const waInFlightStarts = new Map(); // Protection absolue contre les lancements concurrents simultanés

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

    // Garde-fou Mode Rapide : Enregistrement de l'initiateur
    if (typeof whatsappManager !== 'undefined' && whatsappManager.quickLinkProvider) {
      whatsappManager.quickLinkProvider.recordInboundInitiator(userId, rawSender);
      if (cleanPhone) whatsappManager.quickLinkProvider.recordInboundInitiator(userId, cleanPhone);
      if (msg.from) whatsappManager.quickLinkProvider.recordInboundInitiator(userId, msg.from);
    }

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

    // Niveau 1 : msg.reply direct (Le plus fiable pour répondre instantanément à un message entrant)
    try {
      if (typeof msg.reply === 'function') {
        const sent = await msg.reply(aiResponse);
        if (sent) {
          delivered = true;
          console.log(`[WA/DELIVERED] Réponse IA délivrée instantanément via msg.reply vers ${msg.from}`);
        }
      }
    } catch (replyErr) {
      console.warn(`[WA/DELIVERY] msg.reply direct a échoué: ${replyErr.message}`);
    }

    // Niveau 2 : Envoi via l'objet Chat (recommandé et officiel whatsapp-web.js)
    if (!delivered) {
      try {
        const chat = await Promise.race([
          msg.getChat(),
          new Promise((_, r) => setTimeout(() => r(null), 10000))
        ]);
        if (chat && typeof chat.sendMessage === 'function') {
          try { await chat.sendStateTyping(); } catch(e) {}
          await new Promise(r => setTimeout(r, 500));
          const sent = await chat.sendMessage(aiResponse);
          if (sent) delivered = true;
          console.log(`[WA/DELIVERED] Réponse IA délivrée avec succès via chat.sendMessage à ${chat.id ? chat.id._serialized : msg.from}`);
        }
      } catch (chatSendErr) {
        console.warn(`[WA/DELIVERY] chat.sendMessage a échoué: ${chatSendErr.message}`);
      }
    }

    // Niveau 3 : client.sendMessage avec cibles candidates (@c.us et @lid)
    if (!delivered) {
      const candidates = [];
      if (isSelfTest) {
        if (client.info && client.info.wid) candidates.push(client.info.wid._serialized);
        const myP = (client.info && client.info.wid ? client.info.wid.user : null) || (waNumbers[userId] ? String(waNumbers[userId]).replace(/\D/g, '') : null);
        if (myP) candidates.push(`${myP}@c.us`);
        if (msg.from) candidates.push(msg.from);
      } else {
        if (cleanPhone && cleanPhone.length >= 8 && !cleanPhone.startsWith('3900')) {
          candidates.push(`${cleanPhone}@c.us`);
        }
        if (msg.from) candidates.push(msg.from);
        if (msg.author) candidates.push(msg.author);
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

    // Déduire 1 crédit de manière atomique et robuste si la réponse a été délivrée
    if (delivered && supabase && userId) {
      try {
        const { data: currentProf, error: fetchErr } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .maybeSingle();

        if (fetchErr) {
          console.error(`❌ [WA/CREDITS] Erreur lecture solde profil ${userId}:`, fetchErr.message);
        }

        const prevCredits = (currentProf && typeof currentProf.credits === 'number') 
          ? currentProf.credits 
          : ((profile && typeof profile.credits === 'number') ? profile.credits : 100);

        const newCredits = Math.max(0, prevCredits - 1);

        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ credits: newCredits })
          .eq('id', userId);

        if (updateErr) {
          console.error(`❌ [WA/CREDITS] Échec déduction crédit pour ${userId}:`, updateErr.message);
        } else {
          console.log(`💳 [WA/CREDITS] 1 crédit déduit pour ${userId} ! Ancien solde: ${prevCredits} -> Nouveau solde: ${newCredits} crédits.`);
        }
      } catch (crErr) {
        console.error(`❌ [WA/CREDITS] Exception déduction crédit:`, crErr.message);
      }
    }

    // Suivi des coûts et catégorisation des messages sortants
    if (delivered && typeof whatsappManager !== 'undefined') {
      whatsappManager.logMessageUsage(userId, {
        recipient: rawSender,
        category: 'free_form',
        mode: 'rapide',
        messageId: `msg_${Date.now()}`,
        creditsDeducted: 1
      }).catch(() => {});
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
  if (waInFlightStarts.has(userId)) {
    console.log(`[WA] Lancement déjà en cours pour ${userId}, mutualisation de la requête...`);
    return waInFlightStarts.get(userId);
  }

  const promise = (async () => {
    try {
      return await _executeCreateOrGetWhatsAppClient(userId, options);
    } finally {
      waInFlightStarts.delete(userId);
    }
  })();

  waInFlightStarts.set(userId, promise);
  return promise;
}

async function _executeCreateOrGetWhatsAppClient(userId, options = {}) {
  const { restart = false, phoneNumber = null, autoRestore = false } = options;
  const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;
  const authDir = getSessionDir(userId);
  let hasExistingSession = fs.existsSync(authDir);

  // 1. Si déjà actif et connecté
  if (waClients[userId] && !restart) {
    if (waStatuses[userId] === 'CONNECTED') {
      return waClients[userId];
    }
    if (waStatuses[userId] === 'QR_READY' && waSessionsQR[userId]) {
      return waClients[userId];
    }
    if (waStatuses[userId] === 'STARTING') {
      return waClients[userId];
    }
  }

  // 2. Nettoyage explicite si redémarrage forcé ou statut précédent en erreur
  if (restart || waStatuses[userId] === 'ERROR' || (!autoRestore && !waClients[userId])) {
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
    delete waErrors[userId];
    if (hasExistingSession && (restart || waStatuses[userId] === 'ERROR')) {
      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
      hasExistingSession = false;
    }
  }

  // Nettoyage des verrous Chromium résiduels pour assurer un démarrage sans heurt
  if (fs.existsSync(authDir)) {
    cleanupChromiumLocks(authDir);
  }

  // Empêcher l'erreur "Can't open display" en conteneur headless
  if (process.env.DISPLAY) {
    try { delete process.env.DISPLAY; } catch(e) {}
  }

  // 3. Statut initial (si session existante sur disque et autoRestore demandé)
  waStatuses[userId] = (hasExistingSession && autoRestore) ? 'RECONNECTING' : 'STARTING';
  if (cleanPhone) waNumbers[userId] = cleanPhone;

  const chromiumPath = getChromiumExecutablePath();
  console.log(`[WA] Lancement client haute résilience pour ${userId} (sessionExistante=${hasExistingSession}, autoRestore=${autoRestore}, pairPhone=${cleanPhone || 'non'}, storage=${AUTH_BASE_DIR})...`);

  // Stratégie d'authentification robuste avec dataPath pointant sur le volume persistant
  const authStrategy = new LocalAuth({ 
    clientId: userId,
    dataPath: AUTH_BASE_DIR 
  });

  // Flags Puppeteer fiables et stables pour conteneur Docker Linux (Railway)
  const clientOptions = {
    authStrategy,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 10000,
    authTimeoutMs: 120000, // 2 minutes : permet aux bundles WhatsApp Web de se charger sereinement
    bypassCSP: true,       // Contourne les restrictions CSP bloquant l'injection des modules
    puppeteer: {
      headless: true,
      protocolTimeout: 60000,
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--window-size=1280,800'
      ],
      ...(chromiumPath ? { executablePath: chromiumPath } : {})
    }
  };

  if (cleanPhone && cleanPhone.length >= 8) {
    if (fs.existsSync(authDir) && (!waClients[userId] || restart)) {
      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
      hasExistingSession = false;
    }
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
      const qrImage = await qrcode.toDataURL(qr, { margin: 2, width: 280 });
      waSessionsQR[userId] = qrImage;
      delete waErrors[userId];
      if (!waPairingCodes[userId]) waStatuses[userId] = 'QR_READY';
      console.log(`📱 [WA] QR Code prêt pour client ${userId}`);
    } catch (e) {
      console.error(`[WA] Erreur génération QR data URL pour ${userId}:`, e.message);
    }
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

    // Sécurité Puppeteer : allonger les timeouts de navigation pour éviter les déconnexions sous forte charge
    if (client && client.pupPage && !client.pupPage.isClosed()) {
      try {
        client.pupPage.setDefaultNavigationTimeout(120000);
        client.pupPage.setDefaultTimeout(120000);
      } catch (e) {}
    }

    // Heartbeat Keep-Alive ultra-stable toutes les 25 secondes :
    // Utilise client.getState() natif de whatsapp-web.js pour maintenir la WebSocket Meta active en continu
    if (waHeartbeats[userId]) clearInterval(waHeartbeats[userId]);
    waHeartbeats[userId] = setInterval(async () => {
      try {
        if (client && waStatuses[userId] === 'CONNECTED') {
          const st = await client.getState().catch(() => null);
          if (st && st !== 'CONNECTED') {
            console.warn(`[WA/HEARTBEAT] État client inattendu pour ${userId}: ${st}`);
          }
        }
      } catch (hbErr) {
        console.warn(`[WA/HEARTBEAT] Signal pour ${userId}:`, hbErr.message);
      }
    }, 25000);

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
  // Les clés Multi-Device de l'appareil compagnon restent valides sur les serveurs de Meta.
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

    const strReason = String(reason || '').toUpperCase();
    const isPermanentLogout = strReason.includes('LOGOUT') || strReason.includes('UNPAIRED') || strReason.includes('CONFLICT') || strReason.includes('BAN');

    delete waClients[userId];
    delete waSessionsQR[userId];
    delete waPairingCodes[userId];
    delete waNumbers[userId];

    try { await client.destroy(); } catch (e) {}

    // Si l'utilisateur s'est déconnecté depuis son smartphone (WhatsApp > Appareils connectés > Déconnexion) :
    // Purge immédiate de la session pour permettre une nouvelle connexion propre sans prétendre être connecté !
    if (isPermanentLogout) {
      console.log(`[WA/LOGOUT] Déconnexion définitive WhatsApp reçue pour ${userId} (${reason}). Nettoyage session locale et Supabase.`);
      waStatuses[userId] = 'DISCONNECTED';
      if (fs.existsSync(authDir)) {
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
      }
      if (supabase) {
        try {
          await supabase.from('profiles').update({ whatsapp_number: null }).eq('id', userId);
        } catch (dbErr) {
          console.warn('[WA/LOGOUT] Erreur reset whatsapp_number dans profiles:', dbErr.message);
        }
      }
      return;
    }

    // Déconnexion transitoire (ex: micro-coupure réseau temporaire)
    waStatuses[userId] = 'RECONNECTING';
    console.log(`[WA/RECONNECT] Coupure transitoire pour ${userId}. Reconnexion automatique dans 5 secondes...`);
    setTimeout(() => {
      createOrGetWhatsAppClient(userId, { autoRestore: true }).catch(err => {
        console.warn(`[WA/RECONNECT] Notice tentative reconnexion ${userId} :`, err.message);
      });
    }, 5000);
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

      const myPhone = (client.info && client.info.wid ? client.info.wid.user : null) || (waNumbers[userId] ? String(waNumbers[userId]).replace(/\D/g, '') : null);
      const myWid = client.info && client.info.wid ? client.info.wid._serialized : (myPhone ? `${myPhone}@c.us` : null);
      const toJid = msg.to ? String(msg.to) : '';
      const fromJid = msg.from ? String(msg.from) : '';
      const remoteJid = (msg.id && msg.id.remote) ? String(msg.id.remote) : '';
      const bodyLower = (msg.body || '').trim().toLowerCase();

      // Détection message auto-test : envoyé à soi-même ou commence par test / !test
      const isSelf = Boolean(
        msg.fromMe && (
          (toJid && fromJid && toJid === fromJid) ||
          (myWid && (toJid === myWid || remoteJid === myWid)) ||
          (myPhone && (toJid.includes(myPhone) || remoteJid.includes(myPhone))) ||
          bodyLower.startsWith('test') ||
          bodyLower.startsWith('!test') ||
          bodyLower.startsWith('/test')
        )
      );

      // Si le message a été envoyé par moi à un tiers (l'humain parle sans mot-clé test), l'IA n'intervient pas
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
    const errMsg = (err && typeof err === 'object') ? (err.message || String(err)) : String(err || 'Erreur inconnue');
    console.error(`[WA] Erreur initialize client ${userId}:`, errMsg);
    waStatuses[userId] = 'ERROR';
    waErrors[userId] = errMsg;
    delete waSessionsQR[userId];
    delete waClients[userId];

    if (errMsg && (errMsg.includes('Singleton') || errMsg.includes('locked the profile') || errMsg.includes('Code: 21') || errMsg.includes('auth timeout'))) {
      console.log(`[WA] Verrou ou incident d'initialisation détecté pour ${userId}. Purge complète du dossier de session...`);
      cleanupChromiumLocks(authDir);
      try {
        if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
      } catch (rmErr) {}
    }
  });

  return client;
}

// =============================================================================
// COUCHE D'ABSTRACTION MULTI-PILOTES WHATSAPP (VANDIAS AI)
// Supporte : Mode Rapide (WhatsApp Web émulé) & Mode Officiel (Meta Cloud API v21.0)
// =============================================================================
const { WhatsAppManager } = require('./services/whatsapp/WhatsAppManager');
const { WHATSAPP_STATUS, MESSAGE_CATEGORIES, PROVIDER_MODES } = require('./services/whatsapp/WhatsAppProvider');
const { AIPipeline } = require('./services/ai/AIPipeline');

const aiPipeline = new AIPipeline({
  openai,
  supabase,
  chatHistories: waChatHistories,
  maxHistory: 12
});

const whatsappManager = new WhatsAppManager({
  quickLinkDeps: {
    waClients,
    waStatuses,
    waSessionsQR,
    waPairingCodes,
    waNumbers,
    waErrors,
    createOrGetClient: createOrGetWhatsAppClient
  },
  metaConfig: {
    graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    systemUserToken: process.env.META_SYSTEM_USER_TOKEN,
    loginConfigId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'vandias_secure_webhook_token',
    // Le pilote officiel reste désactivé par défaut sans accord exprès de l'utilisateur
    isPilotAuthorized: process.env.ENABLE_OFFICIAL_WHATSAPP_PILOT === 'true'
  },
  supabase,
  aiPipeline
});

// Endpoint : Obtenir le mode actif et les détails des garde-fous
app.get('/api/whatsapp/mode/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  try {
    const status = await whatsappManager.getStatus(userId);
    const riskAccepted = await whatsappManager.quickLinkProvider.hasAcceptedRisk(userId);
    res.json({
      mode: status.currentMode,
      status: status.status,
      riskAccepted,
      modesInfo: status.modesInfo,
      guardrails: status.guardrails
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint : Changer de mode ('rapide' | 'officiel')
app.post('/api/whatsapp/mode', authMiddleware, async (req, res) => {
  const { userId, mode } = req.body;
  if (!userId || !mode) return res.status(400).json({ error: "userId et mode requis" });
  if (mode !== 'rapide' && mode !== 'officiel') {
    return res.status(400).json({ error: "Mode invalide. Choisissez 'rapide' ou 'officiel'." });
  }
  try {
    const result = await whatsappManager.setUserMode(userId, mode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint : Acceptation expresse du risque (obligatoire pour activer le Mode Rapide)
app.post('/api/whatsapp/accept-risk', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = String(rawIp).split(',')[0].trim();
    const record = await whatsappManager.recordRiskAcceptance(userId, clientIp);
    res.json({ success: true, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint : Suivi des coûts et ventilation d'utilisation
app.get('/api/whatsapp/usage/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  try {
    const usage = whatsappManager.getUsageBreakdown(userId);
    res.json({ usage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint : Webhooks Meta Cloud API (GET vérification + POST réception événements)
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'vandias_secure_webhook_token';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('✅ [WA/WEBHOOK] Handshake Meta Cloud API validé.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    await whatsappManager.officialMetaProvider.handleWebhookPayload(req.body);
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('[WA/WEBHOOK] Erreur traitement notification:', err);
    return res.sendStatus(500);
  }
});

// Endpoint : Démarrer la connexion WhatsApp (gère le mode rapide et le mode officiel)
app.post('/api/whatsapp/start', authMiddleware, async (req, res) => {
  const { userId, restart, phoneNumber, mode } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });
  const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;

  try {
    let targetMode = mode || await whatsappManager.getUserMode(userId);
    if (targetMode === 'officiel' && !whatsappManager.officialMetaProvider.isPilotAuthorized) {
      targetMode = 'rapide';
      await whatsappManager.setUserMode(userId, 'rapide');
    }

    // Mode Rapide : Enregistrer automatiquement le consentement et activer les garde-fous anti-ban
    if (targetMode === 'rapide') {
      const forwarded = req.headers['x-forwarded-for'];
      const clientIp = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'inconnu';
      await whatsappManager.quickLinkProvider.recordRiskAcceptance(userId, clientIp);
    }

    const connectRes = await whatsappManager.connect(userId, {
      mode: targetMode,
      phone: cleanPhone,
      restart: !!restart,
      options: { skipRiskCheck: true }
    });

    // Si mode rapide, attendre l'apparition du QR ou du code d'association
    if (targetMode === 'rapide') {
      for (let i = 0; i < 45; i++) {
        if (waStatuses[userId] === 'CONNECTED') {
          return res.json({ status: 'CONNECTED', message: "Bot déjà connecté", phone: waNumbers[userId] || null, mode: targetMode });
        }
        if (waStatuses[userId] === 'QR_READY' && waSessionsQR[userId] && typeof waSessionsQR[userId] === 'string' && waSessionsQR[userId].startsWith('data:image/')) {
          return res.json({ status: 'QR_READY', qr: waSessionsQR[userId], mode: targetMode });
        }
        if (waStatuses[userId] === 'CODE_READY' && waPairingCodes[userId]) {
          return res.json({ status: 'CODE_READY', code: waPairingCodes[userId], mode: targetMode });
        }
        if (waStatuses[userId] === 'ERROR') {
          return res.json({ status: 'ERROR', error: waErrors[userId] || 'Erreur d\'initialisation Chromium', mode: targetMode });
        }
        await new Promise(r => setTimeout(r, 600));
      }

      if (waStatuses[userId] === 'QR_READY' && waSessionsQR[userId] && typeof waSessionsQR[userId] === 'string' && waSessionsQR[userId].startsWith('data:image/')) {
        return res.json({ status: 'QR_READY', qr: waSessionsQR[userId], mode: targetMode });
      }
    }

    const statusObj = await whatsappManager.getStatus(userId);
    return res.json(statusObj);
  } catch (err) {
    console.error("[WA] Erreur start:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint de diagnostic temps réel des événements serveur
app.get('/api/whatsapp/live-logs', authMiddleware, (req, res) => {
  res.json({ logs: serverLiveLogs.slice(0, 80) });
});

// Endpoint : Déconnexion unifiée
app.post('/api/whatsapp/disconnect', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });

  try {
    const result = await whatsappManager.disconnect(userId);
    if (waHeartbeats[userId]) {
      clearInterval(waHeartbeats[userId]);
      delete waHeartbeats[userId];
    }
    const authDir = getSessionDir(userId);
    if (fs.existsSync(authDir)) {
      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
    }
    if (supabase) {
      try {
        await supabase.from('profiles').update({ whatsapp_number: null }).eq('id', userId);
      } catch (e) {}
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

  if (waStatuses[userId] === 'CONNECTED' && waClients[userId]) {
    return res.json({ status: 'CONNECTED', message: "Bot déjà connecté", phone: waNumbers[userId] || null });
  }

  // Si un code valide est déjà en mémoire pour ce numéro, le renvoyer instantanément
  if (waPairingCodes[userId] && waNumbers[userId] === cleanPhone && waStatuses[userId] === 'CODE_READY') {
    return res.json({ status: 'CODE_READY', code: waPairingCodes[userId] });
  }

  try {
    delete waErrors[userId];
    const existingClient = waClients[userId];
    const currentStatus = waStatuses[userId];

    // Cas 1 : Client déjà actif sur le QR Screen -> basculer immédiatement en Pairing Code
    if (existingClient && currentStatus === 'QR_READY' && typeof existingClient.requestPairingCode === 'function') {
      try {
        console.log(`[WA] Demande directe de Pairing Code pour ${userId} sur +${cleanPhone}...`);
        const code = await existingClient.requestPairingCode(cleanPhone);
        if (code) {
          waPairingCodes[userId] = code;
          waNumbers[userId] = cleanPhone;
          waStatuses[userId] = 'CODE_READY';
          return res.json({ status: 'CODE_READY', code });
        }
      } catch (err) {
        console.warn(`[WA] Notice requestPairingCode sur client actif: ${err.message}.`);
      }
    }

    // Cas 2 : Si aucun client n'existe ou si le client est déconnecté/en erreur, relancer avec le numéro
    if (!existingClient || currentStatus === 'DISCONNECTED' || currentStatus === 'ERROR') {
      console.log(`[WA] Lancement d'un nouveau client avec association par numéro pour ${userId}...`);
      await createOrGetWhatsAppClient(userId, { restart: true, phoneNumber: cleanPhone });
    }

    // Cas 3 : Attente active (jusqu'à 35 secondes pour laisser le temps à Chromium d'arriver au linking)
    let requestedDynamically = false;
    for (let i = 0; i < 70; i++) {
      await new Promise(r => setTimeout(r, 500));

      if (waPairingCodes[userId]) {
        return res.json({ status: 'CODE_READY', code: waPairingCodes[userId] });
      }

      if (waStatuses[userId] === 'CONNECTED') {
        return res.json({ status: 'CONNECTED', message: "Bot déjà connecté", phone: waNumbers[userId] || null });
      }

      if (waStatuses[userId] === 'ERROR') {
        return res.json({ status: 'ERROR', error: waErrors[userId] || "Erreur d'initialisation Chromium" });
      }

      // Si le client vient d'atteindre QR_READY pendant l'attente, déclencher requestPairingCode
      const clientNow = waClients[userId];
      if (clientNow && waStatuses[userId] === 'QR_READY' && !requestedDynamically && typeof clientNow.requestPairingCode === 'function') {
        requestedDynamically = true;
        clientNow.requestPairingCode(cleanPhone).then(code => {
          if (code) {
            waPairingCodes[userId] = code;
            waNumbers[userId] = cleanPhone;
            waStatuses[userId] = 'CODE_READY';
          }
        }).catch(err => {
          console.warn(`[WA/PAIR] Tentative requestPairingCode async: ${err.message}`);
        });
      }
    }

    // Si pas encore prêt après 35s, notifier que c'est en cours (le polling client prendra le relais)
    return res.json({ 
      status: waStatuses[userId] || 'STARTING', 
      message: "Génération du code WhatsApp en cours... Le code apparaîtra d'ici quelques secondes." 
    });
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

  // Si pas de client actif en mémoire mais session existante sur disque, auto-restaurer
  // UNIQUEMENT si le statut n'est pas déjà 'DISCONNECTED' ou 'ERROR'
  if (!client && hasExistingSession && waStatuses[userId] !== 'STARTING' && waStatuses[userId] !== 'DISCONNECTED' && waStatuses[userId] !== 'ERROR') {
    createOrGetWhatsAppClient(userId, { autoRestore: true }).catch(() => {});
    waStatuses[userId] = 'STARTING';
  }

  let st = waStatuses[userId] || 'DISCONNECTED';

  // Ne JAMAIS déguiser RECONNECTING ou DISCONNECTED en CONNECTED !
  // CONNECTED n'est vrai QUE si waStatuses[userId] === 'CONNECTED' ET que le client existe
  if (st === 'CONNECTED' && !client) {
    st = hasExistingSession ? 'RECONNECTING' : 'DISCONNECTED';
    waStatuses[userId] = st;
  }

  let detectedPhone = getClientPhone(client, userId);
  if (!detectedPhone && client && st === 'CONNECTED') {
    detectedPhone = await getClientPhoneAsync(client, userId);
  }
  if (!detectedPhone && waNumbers[userId]) {
    detectedPhone = waNumbers[userId];
  }
  if (detectedPhone && st === 'CONNECTED') {
    waNumbers[userId] = detectedPhone;
  }

  // Si connecté et qu'on a le numéro, synchroniser Supabase immédiatement
  if (st === 'CONNECTED' && waNumbers[userId] && supabase) {
    try {
      const fullWa = '+' + String(waNumbers[userId]).replace(/^\+/, '');
      supabase.from('profiles').update({ whatsapp_number: fullWa }).eq('id', userId).then(() => {}).catch(() => {});
    } catch(e) {}
  }

  const statusObj = await whatsappManager.getStatus(userId);

  const validQr = (statusObj.qrCode || (waSessionsQR[userId] && typeof waSessionsQR[userId] === 'string' && waSessionsQR[userId].startsWith('data:image/')))
    ? (statusObj.qrCode || waSessionsQR[userId])
    : null;

  res.json({
    mode: statusObj.currentMode,
    status: statusObj.status,
    rawStatus: st,
    qr: validQr,
    pairingCode: statusObj.pairingCode || waPairingCodes[userId] || null,
    phone: (statusObj.status === 'CONNECTED' && waNumbers[userId]) ? ('+' + String(waNumbers[userId]).replace(/^\+/, '')) : statusObj.phone,
    riskAccepted: statusObj.riskAccepted,
    guardrails: statusObj.guardrails,
    usage: statusObj.usage,
    error: (statusObj.status === 'ERROR' || waErrors[userId]) ? (waErrors[userId] || 'Erreur d\'initialisation WhatsApp') : null
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
  const { userId, to, message, category, isBroadcast } = req.body;
  if (!userId || !to || !message) {
    return res.status(400).json({ error: "Paramètres requis manquants (userId, to, message)" });
  }

  try {
    const result = await whatsappManager.sendMessage(userId, to, message, {
      category: category || (isBroadcast ? 'marketing' : 'free_form'),
      isBroadcast: Boolean(isBroadcast)
    });
    console.log(`[WA] Message Dashboard envoyé à ${to} via mode ${result.mode}: "${String(message).substring(0, 50)}..."`);
    res.json({ success: true, ...result });
  } catch (err) {
    console.warn(`[WA/SEND] Refus ou incident d'envoi pour ${userId}: ${err.message}`);
    const statusCode = err.message.includes('GARDE-FOU') ? 403 : (err.message.includes('Plafond') ? 429 : 500);
    res.status(statusCode).json({ error: err.message });
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
    const { accessToken, mode, referralCode } = req.body || {};
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
    if (!profile) {
      console.log(`[AUTH OAUTH] Nouvelle inscription Google pour ${cleanEmail} (${user.id})`);
      const newAffCode = `VD-${(user.id.replace(/\D/g, '').substring(0, 4) || Math.floor(1000 + Math.random()*9000))}99`;
      
      const newProfile = {
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email: cleanEmail,
        whatsapp_number: '',
        avatar_url: avatarUrl,
        credits: 100,
        affiliate_code: newAffCode,
        affiliate_balance: 0,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (referralCode) {
        newProfile.referred_by = String(referralCode).trim().toUpperCase();
      }

      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .upsert(newProfile)
        .select('*')
        .single();

      if (insertErr) {
        console.error('[AUTH OAUTH] Erreur création profil Supabase:', insertErr.message);
        return res.status(500).json({ success: false, error: "Impossible d'initialiser le profil utilisateur." });
      }

      // Si parrain fourni, enregistrer également dans auth.users user_metadata
      if (referralCode) {
        try {
          await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: { ...meta, referred_by: String(referralCode).trim().toUpperCase() }
          });
        } catch(e) {}
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

/**
 * MOTEUR D'AFFILIATION AUTOMATIQUE VANDIAS AI - COMMISSION 20%
 * Calcule et crédite automatiquement 20% sur chaque paiement d'abonnement confirmé.
 * Idempotent, sécurisé contre l'auto-parrainage et tracé dans Supabase.
 */
async function processAffiliateCommission({ payerId, paymentRef, rawAmount, planTier = 'pro' }) {
  if (!supabase || !payerId || !paymentRef) {
    return { processed: false, reason: 'missing_params' };
  }

  try {
    const validPlans = {
      basic: { maxPrice: 7900 },
      pro: { maxPrice: 14900 },
      business: { maxPrice: 30000 }
    };
    const maxAllowed = validPlans[planTier]?.maxPrice || 30000;
    const eligibleAmount = Math.min(Math.max(0, parseFloat(rawAmount || "0")), maxAllowed);

    if (eligibleAmount <= 0) {
      console.log(`[AFFILIATION] Montant éligible nul ou négatif (${rawAmount}), aucune commission générée.`);
      return { processed: false, reason: 'zero_amount' };
    }

    // 1. Détermination du parrain (profiles.referred_by ou auth.users.user_metadata.referred_by)
    let sponsorCode = null;
    try {
      const { data: payerProfile } = await supabase
        .from('profiles')
        .select('referred_by')
        .eq('id', payerId)
        .maybeSingle();
      if (payerProfile && payerProfile.referred_by) {
        sponsorCode = payerProfile.referred_by;
      }
    } catch (e) {}

    if (!sponsorCode) {
      try {
        const { data: uData } = await supabase.auth.admin.getUserById(payerId);
        sponsorCode = uData?.user?.user_metadata?.referred_by || null;
      } catch (e) {}
    }

    if (!sponsorCode) {
      console.log(`[AFFILIATION] Aucun parrain rattaché pour l'utilisateur ${payerId}.`);
      return { processed: false, reason: 'no_referrer' };
    }

    // 2. Recherche du profil parrain par son code d'affiliation
    const cleanSponsorCode = String(sponsorCode).trim().toUpperCase();
    let sponsor = null;
    try {
      const { data: spByCode } = await supabase
        .from('profiles')
        .select('id, affiliate_code, affiliate_balance, first_name, email')
        .ilike('affiliate_code', cleanSponsorCode)
        .maybeSingle();
      if (spByCode) sponsor = spByCode;
    } catch (e) {}

    // Si non trouvé par code, chercher par id au cas où referred_by contient le uuid
    if (!sponsor && cleanSponsorCode.includes('-')) {
      try {
        const { data: spById } = await supabase
          .from('profiles')
          .select('id, affiliate_code, affiliate_balance, first_name, email')
          .eq('id', cleanSponsorCode)
          .maybeSingle();
        if (spById) sponsor = spById;
      } catch (e) {}
    }

    if (!sponsor) {
      console.warn(`[AFFILIATION] Parrain introuvable avec le code ${cleanSponsorCode}`);
      return { processed: false, reason: 'sponsor_not_found' };
    }

    // 3. Sécurité : Empêcher formellement l'auto-parrainage
    if (sponsor.id === payerId) {
      console.warn(`[AFFILIATION/SÉCURITÉ] Auto-parrainage bloqué : L'utilisateur ${payerId} ne peut pas se parrainer lui-même.`);
      return { processed: false, reason: 'self_referral_blocked' };
    }

    // 4. Idempotence : vérifier si cette commission a déjà été créditée pour cette référence
    let alreadyCredited = false;
    try {
      const { data: existingComm } = await supabase
        .from('commissions')
        .select('id, status')
        .eq('payment_reference', paymentRef)
        .maybeSingle();
      if (existingComm && existingComm.status === 'CONFIRMED') {
        alreadyCredited = true;
      }
    } catch (e) {}

    // Vérification de sécurité dans les métadonnées parrain (double idempotence)
    if (!alreadyCredited) {
      try {
        const { data: spUser } = await supabase.auth.admin.getUserById(sponsor.id);
        const creditedRefs = spUser?.user?.app_metadata?.credited_commissions || [];
        if (creditedRefs.includes(paymentRef)) {
          alreadyCredited = true;
        }
      } catch (e) {}
    }

    if (alreadyCredited) {
      console.log(`[AFFILIATION] Commission déjà créditée pour la référence ${paymentRef} (Idempotence respectée).`);
      return { processed: false, reason: 'already_credited' };
    }

    // 5. Règle de calcul : 20% du montant net éligible payé
    const commissionRate = 0.20;
    const commissionAmount = Math.floor(eligibleAmount * commissionRate);

    if (commissionAmount <= 0) {
      return { processed: false, reason: 'commission_zero' };
    }

    // 6. Créditer le solde d'affiliation du parrain
    const currentBalance = parseFloat(sponsor.affiliate_balance) || 0;
    const newBalance = currentBalance + commissionAmount;
    await supabase.from('profiles').update({ affiliate_balance: newBalance }).eq('id', sponsor.id);

    // 7. Enregistrer la transaction dans la table commissions
    const commPayload = {
      referrer_id: sponsor.id,
      referred_user_id: payerId,
      payment_reference: paymentRef,
      payment_amount: eligibleAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: 'CONFIRMED',
      plan_tier: planTier,
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('commissions').insert(commPayload);
      console.log(`[AFFILIATION] Commission enregistrée dans table commissions pour parrain ${sponsor.id}`);
    } catch (dbCommErr) {
      console.warn(`[AFFILIATION] Notice insert table commissions:`, dbCommErr.message);
    }

    // 8. Enregistrer dans app_metadata du parrain pour persistance et redondance totale
    try {
      const { data: spUser } = await supabase.auth.admin.getUserById(sponsor.id);
      const appMeta = spUser?.user?.app_metadata || {};
      const existingComms = appMeta.commissions || [];
      const creditedRefs = appMeta.credited_commissions || [];
      await supabase.auth.admin.updateUserById(sponsor.id, {
        app_metadata: {
          ...appMeta,
          credited_commissions: [...creditedRefs, paymentRef],
          commissions: [commPayload, ...existingComms].slice(0, 50)
        }
      });
    } catch (metaErr) {}

    console.log(`🎉 [AFFILIATION SUCCÈS] 20% de commission (${commissionAmount} FCFA sur ${eligibleAmount} FCFA) versée au parrain ${sponsor.affiliate_code} (Nouveau solde: ${newBalance} FCFA)`);
    return {
      processed: true,
      sponsorId: sponsor.id,
      sponsorCode: sponsor.affiliate_code,
      eligibleAmount,
      commissionAmount,
      newBalance
    };
  } catch (err) {
    console.error(`[AFFILIATION] Erreur calcul commission:`, err.message);
    return { processed: false, error: err.message };
  }
}

/**
 * GESTION DES REMBOURSEMENTS & CHARGEBACKS
 * Annule ou ajuste la commission en cas de transaction remboursée ou contestée.
 */
async function reverseAffiliateCommission({ paymentRef, reason = 'refund' }) {
  if (!supabase || !paymentRef) return { reversed: false, reason: 'missing_params' };
  try {
    let comm = null;
    try {
      const { data } = await supabase.from('commissions').select('*').eq('payment_reference', paymentRef).maybeSingle();
      if (data) comm = data;
    } catch (e) {}

    let sponsorId = comm?.referrer_id;
    let commAmount = parseFloat(comm?.commission_amount || 0);

    // Fallback recherche dans app_metadata si la table commissions n'a pas la ligne
    if (!comm) {
      try {
        const { data: sponsors } = await supabase.from('profiles').select('id');
        if (Array.isArray(sponsors)) {
          for (const sp of sponsors) {
            const { data: spUser } = await supabase.auth.admin.getUserById(sp.id);
            const mComms = spUser?.user?.app_metadata?.commissions || [];
            const found = mComms.find(c => c.payment_reference === paymentRef);
            if (found) {
              comm = found;
              sponsorId = sp.id;
              commAmount = parseFloat(found.commission_amount || 0);
              break;
            }
          }
        }
      } catch (e) {}
    }

    if (!comm) {
      return { reversed: false, reason: 'commission_not_found' };
    }

    if (comm.status === 'REVERSED') {
      return { reversed: false, reason: 'already_reversed' };
    }

    // 1. Déduire la commission du solde du parrain (minimum 0)
    if (sponsorId && commAmount > 0) {
      try {
        const { data: spProfile } = await supabase.from('profiles').select('id, affiliate_balance').eq('id', sponsorId).maybeSingle();
        if (spProfile) {
          const curBal = parseFloat(spProfile.affiliate_balance) || 0;
          const newBal = Math.max(0, curBal - commAmount);
          await supabase.from('profiles').update({ affiliate_balance: newBal }).eq('id', sponsorId);
        }
      } catch (e) {}
    }

    // 2. Marquer comme REVERSED dans la table commissions
    try {
      await supabase.from('commissions').update({ status: 'REVERSED' }).eq('payment_reference', paymentRef);
    } catch (e) {}

    // 3. Mettre à jour app_metadata du parrain
    if (sponsorId) {
      try {
        const { data: spUser } = await supabase.auth.admin.getUserById(sponsorId);
        const appMeta = spUser?.user?.app_metadata || {};
        const comms = (appMeta.commissions || []).map(c => c.payment_reference === paymentRef ? { ...c, status: 'REVERSED' } : c);
        await supabase.auth.admin.updateUserById(sponsorId, {
          app_metadata: { ...appMeta, commissions: comms }
        });
      } catch (e) {}
    }

    console.log(`[AFFILIATION REVERSAL] Commission de ${commAmount} FCFA annulée pour réf ${paymentRef} (Motif: ${reason}).`);
    return { reversed: true, paymentRef, commAmount, sponsorId };
  } catch (err) {
    console.error('[AFFILIATION REVERSAL] Erreur:', err.message);
    return { reversed: false, error: err.message };
  }
}

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

        // 2. Recharger les crédits et persister l'abonnement dans profiles (colonnes existantes garanties)
        const profileUpdates = {
          credits: credits,
          plan: planTier,
          plan_status: 'active'
        };
        const { error: pUpdateErr } = await supabase.from('profiles').update(profileUpdates).eq('id', targetUserId);
        if (pUpdateErr) {
          console.warn('[VERIFY SESSION] Notice update profiles:', pUpdateErr.message);
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

        // 4. Attribution de la commission d'affiliation automatique 20%
        try {
          await processAffiliateCommission({
            payerId: targetUserId,
            paymentRef: sessionId,
            rawAmount: session.amount,
            planTier
          });
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

        const OFFICIAL_PRICES = {
            basic: { monthly: 7900, annual: 79000 },
            pro: { monthly: 14900, annual: 149000 },
            business: { monthly: 30000, annual: 300000 }
        };
        const safePlan = (planTier && OFFICIAL_PRICES[planTier]) ? planTier : 'pro';
        const safeCycle = cycle === 'annual' ? 'annual' : 'monthly';
        const numericAmount = OFFICIAL_PRICES[safePlan][safeCycle];

        const saspayPayload = {
            amount: numericAmount.toString(),
            currency: "XOF",
            customer_email: customerEmail,
            customer_name: customerName,
            return_url: `${(req.headers.origin && !req.headers.origin.includes('localhost')) ? req.headers.origin : 'https://vandias.com'}/dashboard.html?payment=return&tier=${safePlan}`,
            webhook_url: "https://kamala-jeanne-production.up.railway.app/api/payments/webhook",
            metadata: {
                userId: userId || 'anonymous',
                planTier: safePlan,
                cycle: safeCycle
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

        // 1. Verification de securite stricte du Webhook
        const webhookSecret = process.env.SASPAY_WEBHOOK_SECRET || process.env.SASPAY_SECRET_KEY;
        const incomingSecret = req.headers['x-webhook-secret'] || req.headers['x-saspay-signature'] || req.query.secret;
        
        if (webhookSecret) {
            if (!incomingSecret || incomingSecret !== webhookSecret) {
                console.warn('[SASPAY WEBHOOK] Tentative rejetee : secret webhook manquant ou invalide.');
                return res.status(401).json({ error: 'Signature webhook non valide ou absente' });
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
                basic: { credits: 1000, minPrice: 7000 },
                pro: { credits: 3000, minPrice: 14000 },
                business: { credits: 10000, minPrice: 28000 }
            };

            const paidAmount = Number(sessionData.amount || payload.amount || 0);
            if (paidAmount > 0 && validPlans[planTier] && paidAmount < validPlans[planTier].minPrice) {
                console.warn(`[SASPAY WEBHOOK] Alerte fraude tarifaire pour plan ${planTier}: payé ${paidAmount}, minimum attendu ${validPlans[planTier].minPrice}`);
                return res.status(400).json({ error: 'Montant insuffisant pour ce plan' });
            }

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

                    // Mettre à jour les crédits et l'abonnement sur le profil (colonnes existantes garanties)
                    const profileUpdates = {
                        credits: credits,
                        plan: planTier,
                        plan_status: 'active'
                    };
                    const { error: pErr } = await supabase
                        .from('profiles')
                        .update(profileUpdates)
                        .eq('id', userId);
                    if (pErr) {
                        console.warn('[WEBHOOK] Notice update profiles:', pErr.message);
                        await supabase.from('profiles').update({ credits: credits }).eq('id', userId);
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
                    
                    // LOGIQUE D'AFFILIATION 20% AUTOMATIQUE
                    try {
                        const hookRef = sessionData.id || sessionData.transactionId || sessionData.transaction || ('hook_' + Date.now());
                        await processAffiliateCommission({
                            payerId: userId,
                            paymentRef: hookRef,
                            rawAmount: sessionData.amount,
                            planTier
                        });
                    } catch(affErr) {
                        console.error("[AFFILIATION WEBHOOK] Erreur:", affErr.message);
                    }
                }
            }
        } else {
            // 2. Gestion automatique des Remboursements et Chargebacks (Règle 4)
            const isRefund = (payload.event === 'transaction.refunded' || 
                              payload.event === 'chargeback' || 
                              payload.status === 'REFUNDED' || 
                              sessionData.status === 'REFUNDED');
            if (isRefund) {
                const refundRef = sessionData.id || sessionData.transactionId || sessionData.transaction || payload.id;
                console.log(`[SASPAY WEBHOOK] Transaction remboursée ou contestée détectée (${refundRef}). Ajustement de commission...`);
                await reverseAffiliateCommission({ paymentRef: refundRef, reason: 'SaaSPay refund/chargeback' });
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

// 1. Validation d'un code de parrainage
app.get('/api/affiliate/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ valid: false, error: "Code manquant" });
    if (!supabase) return res.json({ valid: true, code: code.toUpperCase() });

    const cleanCode = String(code).trim().toUpperCase();
    const { data: sponsor, error } = await supabase
      .from('profiles')
      .select('id, affiliate_code, first_name')
      .ilike('affiliate_code', cleanCode)
      .maybeSingle();

    if (error || !sponsor) {
      return res.json({ valid: false, error: "Code de parrainage introuvable ou invalide" });
    }

    res.json({
      valid: true,
      code: sponsor.affiliate_code,
      sponsorName: sponsor.first_name || "Partenaire VANDIAS"
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// 2. Attribution permanente d'un parrain lors de l'inscription (Sécurisée et Validée)
app.post('/api/affiliate/attribute', async (req, res) => {
  try {
    const { userId, referralCode, sponsorCode, firstName, lastName, email, whatsappNumber } = req.body || {};
    const effectiveCode = referralCode || sponsorCode;
    if (!userId || !UUID_RE.test(String(userId))) {
      return res.status(400).json({ success: false, error: "userId invalide (UUID requis)." });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Base de données non disponible." });
    }

    // 1. S'assurer que le profil de l'utilisateur existe dans public.profiles (contourne le blocage RLS client)
    let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!userProfile) {
      const { data: authUserCheck } = await supabase.auth.admin.getUserById(userId);
      if (!authUserCheck || !authUserCheck.user) {
        return res.status(404).json({ success: false, error: "Compte utilisateur introuvable." });
      }
      const cleanNum = String(userId).replace(/\D/g, '').substring(0, 4) || String(Math.floor(1000 + Math.random() * 9000));
      const userAffCode = `VD-${cleanNum}99`;
      const newProfile = {
        id: userId,
        email: email || '',
        first_name: firstName || '',
        last_name: lastName || '',
        full_name: `${firstName || ''} ${lastName || ''}`.trim() || 'Utilisateur VANDIAS',
        whatsapp_number: whatsappNumber || '',
        credits: 100,
        affiliate_code: userAffCode,
        affiliate_balance: 0,
        created_at: new Date().toISOString()
      };
      const { data: created } = await supabase.from('profiles').upsert(newProfile).select().maybeSingle();
      userProfile = created || newProfile;
    }

    // S'assurer que chaque utilisateur a son propre code de parrainage persistant
    if (!userProfile.affiliate_code) {
      const cleanNum = String(userId).replace(/\D/g, '').substring(0, 4) || String(Math.floor(1000 + Math.random() * 9000));
      userProfile.affiliate_code = `VD-${cleanNum}99`;
      try {
        await supabase.from('profiles').update({ affiliate_code: userProfile.affiliate_code }).eq('id', userId);
      } catch (e) {}
    }

    // Si aucun code de parrainage fourni, retourner succès avec son propre code
    if (!effectiveCode || !String(effectiveCode).trim()) {
      return res.json({ success: true, message: "Profil synchronisé sans parrain.", affiliateCode: userProfile.affiliate_code });
    }

    const cleanCode = String(effectiveCode).trim().toUpperCase();

    // 2. Vérifier si l'utilisateur a DÉJÀ un parrain VALIDE et vérifié
    // Règle : La première attribution valide est permanente et intouchable
    let existingRef = userProfile && userProfile.referred_by ? String(userProfile.referred_by).trim().toUpperCase() : null;
    if (!existingRef) {
      try {
        const { data: uAuth } = await supabase.auth.admin.getUserById(userId);
        const metaRef = uAuth?.user?.user_metadata?.referred_by || uAuth?.user?.app_metadata?.referred_by;
        if (metaRef) existingRef = String(metaRef).trim().toUpperCase();
      } catch(e) {}
    }

    if (existingRef) {
      let validExistingSponsor = null;
      try {
        const { data: spByCode } = await supabase
          .from('profiles')
          .select('id, affiliate_code, first_name')
          .ilike('affiliate_code', existingRef)
          .maybeSingle();
        if (spByCode) validExistingSponsor = spByCode;
      } catch(e) {}

      if (!validExistingSponsor && existingRef.includes('-')) {
        try {
          const { data: spById } = await supabase
            .from('profiles')
            .select('id, affiliate_code, first_name')
            .eq('id', existingRef)
            .maybeSingle();
          if (spById) validExistingSponsor = spById;
        } catch(e) {}
      }

      if (validExistingSponsor) {
        console.log(`[AFFILIATION] L'utilisateur ${userId} a déjà un parrain valide (${validExistingSponsor.affiliate_code}). Première attribution préservée.`);
        return res.json({
          success: true,
          permanent: true,
          sponsorCode: validExistingSponsor.affiliate_code,
          sponsorName: validExistingSponsor.first_name || 'Partenaire VANDIAS',
          referrerId: validExistingSponsor.id
        });
      }
    }

    // 3. Trouver le parrain correspondant au code fourni
    let sponsor = null;
    const { data: spByCode } = await supabase
      .from('profiles')
      .select('id, affiliate_code, first_name, email')
      .ilike('affiliate_code', cleanCode)
      .maybeSingle();

    if (spByCode) sponsor = spByCode;

    // Si non trouvé par code et que la chaîne ressemble à un UUID, chercher par id
    if (!sponsor && cleanCode.includes('-')) {
      const { data: spById } = await supabase
        .from('profiles')
        .select('id, affiliate_code, first_name, email')
        .eq('id', cleanCode)
        .maybeSingle();
      if (spById) sponsor = spById;
    }

    if (!sponsor) {
      return res.status(404).json({ success: false, error: "Code de parrainage introuvable ou invalide." });
    }

    // 4. Sécurité anti-fraude : Bloquer formellement l'auto-parrainage
    if (sponsor.id === userId) {
      console.warn(`[AFFILIATION] Tentative d'auto-parrainage bloquée pour l'utilisateur ${userId}`);
      return res.status(400).json({ success: false, error: "Vous ne pouvez pas vous parrainer vous-même." });
    }

    // 5. Enregistrement permanent dans auth.users user_metadata (toujours garanti)
    try {
      const { data: u } = await supabase.auth.admin.getUserById(userId);
      const meta = u?.user?.user_metadata || {};
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...meta,
          referred_by: sponsor.affiliate_code,
          referrer_id: sponsor.id
        }
      });
    } catch(authErr) {
      console.warn('[AFFILIATION] Notice updateUserById:', authErr.message);
    }

    // 6. Enregistrement dans profiles (si la colonne existe)
    try {
      await supabase.from('profiles').update({ referred_by: sponsor.affiliate_code }).eq('id', userId);
    } catch(dbErr) {
      console.warn('[AFFILIATION] Notice update profiles.referred_by:', dbErr.message);
    }

    console.log(`🎉 [AFFILIATION] Attribution permanente réussie : ${userId} rattaché au parrain ${sponsor.affiliate_code} (${sponsor.first_name || sponsor.email})`);
    res.json({
      success: true,
      sponsorCode: sponsor.affiliate_code,
      sponsorName: sponsor.first_name || 'Partenaire VANDIAS',
      referrerId: sponsor.id
    });
  } catch (err) {
    console.error('[AFFILIATION ATTRIBUTE] Erreur:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Tableau de bord complet d'affiliation (Données réelles transparentes de Supabase)
app.get('/api/affiliate/dashboard/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });
    if (!supabase) return res.status(500).json({ error: "Base de données non disponible" });

    // 1. Récupérer le profil du parrain
    let { data: profile } = await supabase
      .from('profiles')
      .select('id, affiliate_code, affiliate_balance, first_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return res.status(404).json({ error: "Profil introuvable" });
    }

    // 2. Garantir un code de parrainage permanent unique
    let affCode = profile.affiliate_code;
    if (!affCode || affCode.trim() === '') {
      const cleanNum = String(userId).replace(/\D/g, '').substring(0, 4) || String(Math.floor(1000 + Math.random() * 9000));
      affCode = `VD-${cleanNum}99`;
      try {
        await supabase.from('profiles').update({ affiliate_code: affCode }).eq('id', userId);
        profile.affiliate_code = affCode;
      } catch (e) {}
    }

    const availableBalance = parseFloat(profile.affiliate_balance) || 0;

    // 3. Récupérer la liste des utilisateurs parrainés (filleuls réels inscrits)
    let referredUsers = [];
    try {
      const { data: directRef } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, created_at, plan, plan_status')
        .ilike('referred_by', affCode);
      if (Array.isArray(directRef)) referredUsers = directRef;
    } catch (e) {}

    // Recherche de secours par ID
    try {
      const { data: idRef } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, created_at, plan, plan_status')
        .eq('referred_by', userId);
      if (Array.isArray(idRef)) {
        for (const r of idRef) {
          if (!referredUsers.some(u => u.id === r.id)) referredUsers.push(r);
        }
      }
    } catch (e) {}

    // Recherche de secours infaillible dans auth.users (user_metadata)
    if (referredUsers.length === 0) {
      try {
        const { data: uList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (uList && Array.isArray(uList.users)) {
          for (const u of uList.users) {
            const metaRef = u.user_metadata?.referred_by || u.app_metadata?.referred_by;
            const metaSponsorId = u.user_metadata?.referrer_id || u.app_metadata?.referrer_id;
            if (
              (metaRef && String(metaRef).toUpperCase() === affCode.toUpperCase()) ||
              (metaSponsorId && metaSponsorId === userId)
            ) {
              if (!referredUsers.some(r => r.id === u.id) && u.id !== userId) {
                referredUsers.push({
                  id: u.id,
                  first_name: u.user_metadata?.first_name || u.user_metadata?.firstName || 'Filleul',
                  last_name: u.user_metadata?.last_name || u.user_metadata?.lastName || '',
                  email: u.email,
                  created_at: u.created_at,
                  plan: u.app_metadata?.plan || 'Gratuit',
                  plan_status: u.app_metadata?.plan_status || 'active'
                });
              }
            }
          }
        }
      } catch (authListErr) {
        console.warn('[AFFILIATE/STATS] Notice listUsers:', authListErr.message);
      }
    }

    // 4. Récupérer l'historique réel des commissions
    let commissions = [];
    try {
      const { data: comms } = await supabase
        .from('commissions')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });
      if (Array.isArray(comms)) commissions = comms;
    } catch (e) {}

    // Récupérer également les commissions stockées en métadonnées de secours
    try {
      const { data: uData } = await supabase.auth.admin.getUserById(userId);
      const metaComms = uData?.user?.app_metadata?.commissions || [];
      for (const mc of metaComms) {
        if (!commissions.some(c => c.payment_reference === mc.payment_reference)) {
          commissions.push(mc);
        }
      }
    } catch (e) {}

    // 5. Récupérer les retraits en attente
    let pendingPayoutsTotal = 0;
    try {
      const { data: payouts } = await supabase
        .from('payouts')
        .select('amount, status')
        .eq('user_id', userId)
        .eq('status', 'PENDING');
      if (Array.isArray(payouts)) {
        pendingPayoutsTotal = payouts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      }
    } catch (e) {}

    // 6. Calculs réels transparents
    const confirmedComms = commissions.filter(c => c.status === 'CONFIRMED');
    const totalEarnings = confirmedComms.reduce((sum, c) => sum + (parseFloat(c.commission_amount) || 0), 0);
    const eligiblePaymentsCount = confirmedComms.length;

    // 7. Mise en forme de la table des filleuls & transactions
    const referralsTableData = [];

    // Ajouter d'abord les commissions confirmées
    for (const comm of commissions) {
      const payer = referredUsers.find(u => u.id === comm.referred_user_id);
      let payerDisplayName = 'Client VANDIAS';
      if (payer) {
        const fName = payer.first_name || '';
        const lInitial = payer.last_name ? payer.last_name.charAt(0) + '.' : '';
        payerDisplayName = `${fName} ${lInitial}`.trim() || (payer.email ? payer.email.split('@')[0] : 'Client VANDIAS');
      }

      const planName = comm.plan_tier === 'pro' ? 'Formule Pro (14 900 FCFA)' :
                       comm.plan_tier === 'business' ? 'Formule Business (30 000 FCFA)' :
                       comm.plan_tier === 'basic' ? 'Formule Starter (7 900 FCFA)' : 'Abonnement Mensuel';

      referralsTableData.push({
        id: comm.id || comm.payment_reference,
        date: comm.created_at ? new Date(comm.created_at).toLocaleDateString('fr-FR') : 'Récemment',
        name: payerDisplayName,
        plan: planName,
        paymentAmount: `${Number(comm.payment_amount || 0).toLocaleString('fr-FR')} FCFA`,
        commissionAmount: `+${Number(comm.commission_amount || 0).toLocaleString('fr-FR')} FCFA`,
        status: comm.status === 'CONFIRMED' ? 'Actif & Payé' : (comm.status === 'REVERSED' ? 'Remboursé' : 'En attente'),
        isPaid: comm.status === 'CONFIRMED'
      });
    }

    // Ajouter les filleuls inscrits qui n'ont pas encore souscrit
    for (const refUser of referredUsers) {
      const alreadyListed = referralsTableData.some(r => r.name.toLowerCase().includes((refUser.first_name || '').toLowerCase()));
      if (!alreadyListed) {
        const fName = refUser.first_name || '';
        const lInitial = refUser.last_name ? refUser.last_name.charAt(0) + '.' : '';
        const dispName = `${fName} ${lInitial}`.trim() || (refUser.email ? refUser.email.split('@')[0] : 'Nouveau Filleul');

        referralsTableData.push({
          id: refUser.id,
          date: refUser.created_at ? new Date(refUser.created_at).toLocaleDateString('fr-FR') : 'Récemment',
          name: dispName,
          plan: 'Essai Gratuit 7j',
          paymentAmount: '0 FCFA',
          commissionAmount: '0 FCFA',
          status: 'Inscrit (Essai)',
          isPaid: false
        });
      }
    }

    let frontendOrigin = 'https://vandias.com';
    const referer = req.get('referer') || req.get('origin');
    if (referer) {
      try {
        const u = new URL(referer);
        if (u.host && !u.host.includes('railway.app')) {
          frontendOrigin = `${u.protocol}//${u.host}`;
        }
      } catch (e) {}
    }
    const referralLink = `${frontendOrigin}/?ref=${affCode}`;

    res.json({
      success: true,
      data: {
        referralCode: affCode,
        referralLink,
        referredUsersCount: referredUsers.length,
        eligiblePaymentsCount,
        pendingCommissions: pendingPayoutsTotal,
        confirmedCommissions: totalEarnings,
        totalEarnings,
        availableBalance,
        referrals: referralsTableData
      }
    });
  } catch (err) {
    console.error('[AFFILIATE DASHBOARD] Erreur:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. Inversion / Ajustement de commission (Remboursements & Litiges)
app.post('/api/affiliate/reverse', authMiddleware, async (req, res) => {
  try {
    const { paymentRef, reason } = req.body;
    if (!paymentRef) return res.status(400).json({ success: false, error: "paymentRef requis" });
    const result = await reverseAffiliateCommission({ paymentRef, reason: reason || 'Demande manuelle ou webhook' });
    res.json({ success: result.reversed, ...result });
  } catch (err) {
    console.error('[AFFILIATE REVERSE API] Erreur:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/integrations/payments/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId requis" });
    if (!supabase) return res.status(500).json({ error: "Base de données non disponible" });

    const { data: uData } = await supabase.auth.admin.getUserById(userId);
    const integrations = uData?.user?.user_metadata?.payment_integrations || null;
    res.json({ success: true, integrations });
  } catch (err) {
    console.error("[GET PAYMENTS] Erreur:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/integrations/payments', authMiddleware, async (req, res) => {
  try {
    const { userId, method, phone, beneficiary, note, active, integrations } = req.body;
    console.log(`[PAYMENTS] Mise a jour passerelle ${method} pour client ${userId}: ${phone} (${beneficiary})`);
    
    if (supabase && userId) {
      // 1. Sauvegarder dans user_metadata pour persistance cloud permanente par utilisateur
      try {
        const { data: uData } = await supabase.auth.admin.getUserById(userId);
        const existingMeta = uData?.user?.user_metadata || {};
        const currentInteg = existingMeta.payment_integrations || [];
        let updatedInteg = Array.isArray(integrations) ? integrations : currentInteg;
        if (!Array.isArray(integrations) && method) {
          const idx = updatedInteg.findIndex(x => x.key === method);
          if (idx >= 0) {
            updatedInteg[idx] = { ...updatedInteg[idx], phone, beneficiary, note, active };
          } else {
            updatedInteg.push({ key: method, phone, beneficiary, note, active });
          }
        }
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existingMeta,
            payment_integrations: updatedInteg
          }
        });
      } catch (metaErr) {
        console.warn("[PAYMENTS] Notice meta save:", metaErr.message);
      }

      // 2. Mettre a jour le prompt du profil pour que l'IA connaisse toujours le bon numero vendeur
      if (phone) {
        const { data: prof } = await supabase.from('profiles').select('ai_prompt').eq('id', userId).single();
        if (prof && prof.ai_prompt) {
          const marker = "\n\n[COORDONNEES DE PAIEMENT ACTUELLES DU VENDEUR] :";
          const cleanPrompt = prof.ai_prompt.split(marker)[0];
          const updatedPrompt = `${cleanPrompt}${marker}\nMoyen: ${String(method || 'PAIEMENT').toUpperCase()} | Numero: ${phone} | Beneficiaire: ${beneficiary} | Statut: ${active ? 'Actif' : 'Pause'}`;
          await supabase.from('profiles').update({ ai_prompt: updatedPrompt }).eq('id', userId);
        }
      }
    }

    res.json({ success: true, message: "Passerelle enregistree avec succes" });
  } catch (e) {
    console.error("Erreur save payment:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const { userId, firstName, lastName, whatsappNumber, phoneCountry, phoneNumber, company, role, avatarUrl } = req.body;
    if (!userId) return res.status(400).json({ error: "userId requis" });
    if (!supabase) return res.status(500).json({ error: "Base de données non disponible" });

    // 1. Mettre à jour la table profiles
    const profileUpdates = {
      first_name: firstName || "",
      last_name: lastName || "",
      whatsapp_number: whatsappNumber || "",
      avatar_url: avatarUrl || "",
      updated_at: new Date().toISOString()
    };
    if (company) profileUpdates.company = company;
    if (role) profileUpdates.role = role;

    await supabase.from('profiles').update(profileUpdates).eq('id', userId);

    // 2. Mettre à jour user_metadata dans auth.users pour persistance permanente
    try {
      const { data: uData } = await supabase.auth.admin.getUserById(userId);
      const existingMeta = uData?.user?.user_metadata || {};
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingMeta,
          first_name: firstName || "",
          last_name: lastName || "",
          whatsapp_number: whatsappNumber || "",
          phoneCountry: phoneCountry || "+225",
          phoneNumber: phoneNumber || ""
        }
      });
    } catch (metaErr) {
      console.warn("[USER PROFILE] Notice meta update:", metaErr.message);
    }

    console.log(`[PROFILE] Profil mis à jour et synchronisé pour ${userId}: ${firstName} ${lastName} (${whatsappNumber})`);
    res.json({ success: true, message: "Profil mis à jour avec succès." });
  } catch (err) {
    console.error("[PROFILE UPDATE] Erreur:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/change-password', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit comporter au moins 8 caractères." });
    }
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });

    if (!supabase) return res.status(500).json({ error: "Base de données non disponible" });

    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) {
      console.error("[CHANGE PASSWORD] Erreur Supabase:", error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`[CHANGE PASSWORD] Mot de passe mis à jour avec succès pour ${userId}`);
    res.json({ success: true, message: "Mot de passe modifié avec succès." });
  } catch (err) {
    console.error("[CHANGE PASSWORD] Erreur:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// === 7. DEMANDE DE RETRAIT (AFFILIATION) ===
app.post('/api/payouts/request', authMiddleware, async (req, res) => {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
        return res.status(401).json({ error: 'Authentification requise pour demander un retrait' });
    }
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


// ============================================================================
// === 8. TABLEAU DE BORD ADMINISTRATEUR (API réservée au(x) compte(s) ADMIN_EMAILS) ===
// ============================================================================
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'gnitessowedeou@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const adminLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 240, message: 'Trop de requetes admin. Patientez un instant.' });

const adminMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  if (!supabase) return res.status(500).json({ error: 'Service indisponible.' });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

    const email = String(user.email || '').toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(email) && !!user.email_confirmed_at;
    if (!isAdmin) {
      console.warn(`[ADMIN] Accès refusé pour ${email || user.id}`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Échec de validation du jeton.' });
  }
};

const adminGuard = [adminLimiter, adminMiddleware];

function adminRequireUuid(req, res, next) {
  if (!UUID_RE.test(String(req.params.userId || ''))) {
    return res.status(400).json({ error: 'Identifiant utilisateur invalide.' });
  }
  next();
}

async function adminLoadAuthUsers() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = (data && data.users) || [];
    all.push(...users);
    if (users.length < 1000) break;
  }
  return all;
}

function adminComputePlan(authUser, profile) {
  const appMeta = (authUser && authUser.app_metadata) || {};
  const rawPlan = appMeta.plan || (profile && profile.plan);
  const paidPlan = (rawPlan && !['trial', 'free', 'expired'].includes(rawPlan)) ? rawPlan : null;
  const rawStatus = appMeta.plan_status || (profile && profile.plan_status) || 'active';
  const createdAt = (authUser && authUser.created_at) || (profile && profile.created_at) || new Date().toISOString();
  const now = Date.now();

  if (paidPlan && rawStatus === 'active') {
    const activated = appMeta.plan_activated_at || (profile && profile.plan_activated_at) || createdAt;
    const cycle = parseCycleDuration(appMeta.plan_cycle || (profile && profile.plan_cycle) || 'monthly');
    const expiresAt = appMeta.plan_expires_at || (profile && profile.plan_expires_at) || new Date(new Date(activated).getTime() + cycle.ms).toISOString();
    const msLeft = new Date(expiresAt).getTime() - now;
    return {
      plan: msLeft <= 0 ? 'expired' : paidPlan,
      isPaid: true,
      isExpired: msLeft <= 0,
      expiresAt,
      daysLeft: Math.max(0, Math.ceil(msLeft / 86400000))
    };
  }

  const expiresAt = new Date(new Date(createdAt).getTime() + 7 * 86400000).toISOString();
  const msLeft = new Date(expiresAt).getTime() - now;
  return {
    plan: msLeft <= 0 ? 'expired' : 'trial',
    isPaid: false,
    isExpired: msLeft <= 0,
    expiresAt,
    daysLeft: Math.max(0, Math.ceil(msLeft / 86400000))
  };
}

function adminDiskSessionIds() {
  try {
    if (!fs.existsSync(AUTH_BASE_DIR)) return [];
    return fs.readdirSync(AUTH_BASE_DIR)
      .filter(e => e.startsWith('session-'))
      .map(e => e.replace('session-', ''))
      .filter(Boolean);
  } catch (e) { return []; }
}

function adminBuildSessionRow(userId, userInfo) {
  const client = waClients[userId];
  const dir = getSessionDir(userId);
  const hasDir = fs.existsSync(dir);
  let dirModified = null;
  if (hasDir) { try { dirModified = fs.statSync(dir).mtime.toISOString(); } catch (e) {} }

  let pageAlive = false;
  let browserPid = null;
  try { pageAlive = !!(client && client.pupPage && !client.pupPage.isClosed()); } catch (e) {}
  try { browserPid = client && client.pupBrowser && client.pupBrowser.process() ? client.pupBrowser.process().pid : null; } catch (e) {}

  const status = waStatuses[userId] || (hasDir ? 'ON_DISK' : 'DISCONNECTED');
  return {
    userId,
    email: (userInfo && userInfo.email) || null,
    name: (userInfo && userInfo.name) || null,
    profilePhone: (userInfo && userInfo.whatsapp_number) || null,
    status,
    phone: waNumbers[userId] ? ('+' + String(waNumbers[userId]).replace(/^\+/, '')) : null,
    hasClient: !!client,
    pageAlive,
    browserPid,
    hasQR: !!waSessionsQR[userId],
    hasPairingCode: !!waPairingCodes[userId],
    error: waErrors[userId] || null,
    hasSessionDir: hasDir,
    dirModified
  };
}

async function adminTeardownSession(userId, { wipe = false } = {}) {
  const client = waClients[userId];
  if (client) {
    try {
      await Promise.race([
        client.destroy(),
        new Promise(resolve => setTimeout(resolve, 8000))
      ]);
    } catch (e) {}
    delete waClients[userId];
  }
  if (waHeartbeats[userId]) {
    clearInterval(waHeartbeats[userId]);
    delete waHeartbeats[userId];
  }
  delete waSessionsQR[userId];
  delete waPairingCodes[userId];
  delete waErrors[userId];
  waStatuses[userId] = 'DISCONNECTED';

  if (wipe) {
    delete waNumbers[userId];
    const dir = getSessionDir(userId);
    try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    if (supabase) {
      try { await supabase.from('profiles').update({ whatsapp_number: null }).eq('id', userId); } catch (e) {}
    }
  }
}

app.get('/api/admin/me', adminGuard, (req, res) => {
  res.json({ success: true, email: req.user.email, id: req.user.id });
});

app.get('/api/admin/overview', adminGuard, async (req, res) => {
  try {
    const [authUsers, profilesRes] = await Promise.all([
      adminLoadAuthUsers(),
      supabase.from('profiles').select('*')
    ]);
    const profiles = new Map(((profilesRes && profilesRes.data) || []).map(p => [p.id, p]));

    let paid = 0, trial = 0, expired = 0, totalCredits = 0, banned = 0;
    const now = Date.now();
    let newLast7 = 0;
    for (const u of authUsers) {
      const p = profiles.get(u.id);
      const info = adminComputePlan(u, p);
      if (info.isPaid && !info.isExpired) paid++;
      else if (info.plan === 'trial') trial++;
      else expired++;
      totalCredits += (p && typeof p.credits === 'number') ? p.credits : 0;
      if (u.banned_until && new Date(u.banned_until).getTime() > now) banned++;
      if (u.created_at && now - new Date(u.created_at).getTime() < 7 * 86400000) newLast7++;
    }

    const ids = new Set([...Object.keys(waClients), ...Object.keys(waStatuses), ...adminDiskSessionIds()]);
    const counts = { connected: 0, qrReady: 0, starting: 0, error: 0, onDisk: 0, disconnected: 0, chromium: Object.keys(waClients).length };
    for (const id of ids) {
      const st = waStatuses[id] || (fs.existsSync(getSessionDir(id)) ? 'ON_DISK' : 'DISCONNECTED');
      if (st === 'CONNECTED') counts.connected++;
      else if (st === 'QR_READY' || st === 'CODE_READY') counts.qrReady++;
      else if (st === 'STARTING' || st === 'RECONNECTING' || st === 'AUTHENTICATED') counts.starting++;
      else if (st === 'ERROR') counts.error++;
      else if (st === 'ON_DISK') counts.onDisk++;
      else counts.disconnected++;
    }

    let pendingPayouts = 0, pendingPayoutsAmount = 0;
    try {
      const { data: po } = await supabase.from('payouts').select('amount, status').eq('status', 'PENDING');
      pendingPayouts = (po || []).length;
      pendingPayoutsAmount = (po || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    } catch (e) {}

    const mem = process.memoryUsage();
    res.json({
      success: true,
      users: { total: authUsers.length, paid, trial, expired, banned, newLast7 },
      credits: { total: totalCredits },
      sessions: counts,
      payouts: { pending: pendingPayouts, pendingAmount: pendingPayoutsAmount },
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        rssMb: Math.round(mem.rss / 1048576),
        heapUsedMb: Math.round(mem.heapUsed / 1048576),
        node: process.version
      },
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('[ADMIN] overview:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', adminGuard, async (req, res) => {
  try {
    const [authUsers, profilesRes] = await Promise.all([
      adminLoadAuthUsers(),
      supabase.from('profiles').select('*')
    ]);
    const profiles = new Map(((profilesRes && profilesRes.data) || []).map(p => [p.id, p]));
    const now = Date.now();

    const users = authUsers.map(u => {
      const p = profiles.get(u.id) || {};
      const meta = u.user_metadata || {};
      const planInfo = adminComputePlan(u, p);
      const name = `${p.first_name || meta.first_name || ''} ${p.last_name || meta.last_name || ''}`.trim() || meta.full_name || meta.name || null;
      return {
        id: u.id,
        email: u.email,
        name,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        emailConfirmed: !!u.email_confirmed_at,
        banned: !!(u.banned_until && new Date(u.banned_until).getTime() > now),
        provider: (u.app_metadata && u.app_metadata.provider) || null,
        plan: planInfo.plan,
        isPaid: planInfo.isPaid,
        expiresAt: planInfo.expiresAt,
        daysLeft: planInfo.daysLeft,
        credits: typeof p.credits === 'number' ? p.credits : null,
        whatsappNumber: p.whatsapp_number || null,
        company: p.company || null,
        affiliateCode: p.affiliate_code || null,
        affiliateBalance: Number(p.affiliate_balance) || 0,
        referredBy: p.referred_by || null,
        wa: adminBuildSessionRow(u.id, { email: u.email, name, whatsapp_number: p.whatsapp_number })
      };
    });

    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    console.error('[ADMIN] users:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/sessions', adminGuard, async (req, res) => {
  try {
    const [authUsers, profilesRes] = await Promise.all([
      adminLoadAuthUsers(),
      supabase.from('profiles').select('id, first_name, last_name, whatsapp_number')
    ]);
    const profiles = new Map(((profilesRes && profilesRes.data) || []).map(p => [p.id, p]));
    const infoById = new Map();
    for (const u of authUsers) {
      const p = profiles.get(u.id) || {};
      const meta = u.user_metadata || {};
      const name = `${p.first_name || meta.first_name || ''} ${p.last_name || meta.last_name || ''}`.trim() || meta.full_name || null;
      infoById.set(u.id, { email: u.email, name, whatsapp_number: p.whatsapp_number });
    }

    const ids = new Set([...Object.keys(waClients), ...Object.keys(waStatuses), ...adminDiskSessionIds()]);
    const sessions = [...ids].map(id => adminBuildSessionRow(id, infoById.get(id)));
    const rank = { CONNECTED: 0, QR_READY: 1, CODE_READY: 1, STARTING: 2, RECONNECTING: 2, AUTHENTICATED: 2, ERROR: 3, ON_DISK: 4, DISCONNECTED: 5 };
    sessions.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));

    res.json({ success: true, count: sessions.length, sessions });
  } catch (err) {
    console.error('[ADMIN] sessions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Arrêter Chromium (libère la RAM) sans supprimer la liaison WhatsApp du disque
app.post('/api/admin/sessions/:userId/stop', adminGuard, adminRequireUuid, async (req, res) => {
  try {
    await adminTeardownSession(req.params.userId, { wipe: false });
    console.log(`[ADMIN] ${req.user.email} a arrêté la session ${req.params.userId}`);
    res.json({ success: true, message: 'Session arrêtée (liaison conservée sur le disque).' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Redémarrer à partir de la liaison existante (reconnexion sans nouveau QR)
app.post('/api/admin/sessions/:userId/restart', adminGuard, adminRequireUuid, async (req, res) => {
  try {
    const userId = req.params.userId;
    await adminTeardownSession(userId, { wipe: false });
    await createOrGetWhatsAppClient(userId, { autoRestore: true });
    console.log(`[ADMIN] ${req.user.email} a redémarré la session ${userId}`);
    res.json({ success: true, message: 'Redémarrage lancé.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Réinitialisation totale : supprime la liaison, l'utilisateur devra rescanner un QR
app.post('/api/admin/sessions/:userId/reset', adminGuard, adminRequireUuid, async (req, res) => {
  try {
    await adminTeardownSession(req.params.userId, { wipe: true });
    console.log(`[ADMIN] ${req.user.email} a réinitialisé la session ${req.params.userId}`);
    res.json({ success: true, message: 'Session réinitialisée et supprimée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Purge des dossiers de session orphelins (utilisateur sans numéro lié et sans client actif)
app.post('/api/admin/sessions/purge-orphans', adminGuard, async (req, res) => {
  try {
    const { data: profs } = await supabase.from('profiles').select('id, whatsapp_number');
    const linked = new Set((profs || [])
      .filter(p => p.whatsapp_number && String(p.whatsapp_number).trim().length >= 8)
      .map(p => p.id));

    const purged = [];
    for (const id of adminDiskSessionIds()) {
      if (waClients[id] || linked.has(id)) continue;
      if (!UUID_RE.test(id)) continue;
      try {
        fs.rmSync(getSessionDir(id), { recursive: true, force: true });
        delete waStatuses[id];
        purged.push(id);
      } catch (e) {}
    }
    console.log(`[ADMIN] ${req.user.email} a purgé ${purged.length} session(s) orpheline(s)`);
    res.json({ success: true, purged: purged.length, ids: purged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:userId/credits', adminGuard, adminRequireUuid, async (req, res) => {
  try {
    const { mode, amount } = req.body || {};
    const value = Number(amount);
    if (!Number.isFinite(value) || !['add', 'set'].includes(mode)) {
      return res.status(400).json({ error: 'Paramètres invalides (mode: add|set, amount: nombre).' });
    }
    const { data: p, error: pErr } = await supabase.from('profiles').select('credits').eq('id', req.params.userId).maybeSingle();
    if (pErr || !p) return res.status(404).json({ error: 'Profil introuvable.' });

    const current = typeof p.credits === 'number' ? p.credits : 0;
    const next = Math.max(0, Math.round(mode === 'add' ? current + value : value));
    const { error } = await supabase.from('profiles').update({ credits: next }).eq('id', req.params.userId);
    if (error) return res.status(500).json({ error: error.message });

    console.log(`[ADMIN] ${req.user.email} crédits ${req.params.userId}: ${current} -> ${next}`);
    res.json({ success: true, credits: next });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:userId/plan', adminGuard, adminRequireUuid, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { plan, days } = req.body || {};
    const allowed = ['basic', 'pro', 'business', 'free'];
    if (!allowed.includes(plan)) return res.status(400).json({ error: 'Plan invalide (basic, pro, business, free).' });

    const { data: uData, error: uErr } = await supabase.auth.admin.getUserById(userId);
    if (uErr || !uData || !uData.user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    const existingMeta = uData.user.app_metadata || {};

    const planCreditsMap = { basic: 1000, pro: 3000, business: 10000 };
    let updates;
    let newCredits = null;

    if (plan === 'free') {
      updates = { 
        plan: 'free', 
        plan_status: 'expired', 
        plan_cycle: 'trial',
        plan_expires_at: new Date().toISOString() 
      };
    } else {
      newCredits = planCreditsMap[plan] || 1000;
      const nDays = Math.min(3650, Math.max(1, parseInt(days, 10) || 30));
      const activatedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + nDays * 86400000).toISOString();
      updates = {
        plan,
        plan_status: 'active',
        plan_cycle: 'monthly',
        plan_activated_at: activatedAt,
        plan_expires_at: expiresAt
      };
    }

    const { error: mErr } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { ...existingMeta, ...updates }
    });
    if (mErr) return res.status(500).json({ error: mErr.message });

    // Mise à jour ciblée sur profiles (uniquement les colonnes existantes dans profiles : plan, plan_status, et credits si plan payant)
    const profileUpdates = {
      plan: updates.plan,
      plan_status: updates.plan_status
    };
    if (newCredits !== null) {
      profileUpdates.credits = newCredits;
    }
    const { error: pErr } = await supabase.from('profiles').update(profileUpdates).eq('id', userId);
    if (pErr) console.warn('[ADMIN/PLAN] Notice update profiles:', pErr.message);

    console.log(`[ADMIN] ${req.user.email} plan ${userId} -> ${plan} (credits=${newCredits})`);
    res.json({ success: true, plan, credits: newCredits, expiresAt: updates.plan_expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:userId/ban', adminGuard, adminRequireUuid, async (req, res) => {
  try {
    const userId = req.params.userId;
    const banned = !!(req.body && req.body.banned);
    if (userId === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas suspendre votre propre compte.' });

    const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: banned ? '876000h' : 'none' });
    if (error) return res.status(500).json({ error: error.message });

    if (banned) await adminTeardownSession(userId, { wipe: false });
    console.log(`[ADMIN] ${req.user.email} ${banned ? 'suspend' : 'réactive'} ${userId}`);
    res.json({ success: true, banned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/payouts', adminGuard, async (req, res) => {
  try {
    const { data, error } = await supabase.from('payouts').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return res.json({ success: true, payouts: [], note: error.message });

    const authUsers = await adminLoadAuthUsers();
    const emailById = new Map(authUsers.map(u => [u.id, u.email]));
    res.json({
      success: true,
      payouts: (data || []).map(r => ({ ...r, email: emailById.get(r.user_id) || null }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/payouts/:id/status', adminGuard, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['PAID', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Statut invalide (PAID | REJECTED).' });

    const { data: row, error } = await supabase.from('payouts').select('*').eq('id', req.params.id).maybeSingle();
    if (error || !row) return res.status(404).json({ error: 'Demande introuvable.' });
    if (row.status !== 'PENDING') return res.status(409).json({ error: 'Cette demande a déjà été traitée.' });

    const { error: upErr } = await supabase.from('payouts').update({ status }).eq('id', row.id).eq('status', 'PENDING');
    if (upErr) return res.status(500).json({ error: upErr.message });

    // Remboursement du solde d'affiliation en cas de rejet
    if (status === 'REJECTED') {
      const { data: prof } = await supabase.from('profiles').select('affiliate_balance').eq('id', row.user_id).maybeSingle();
      const bal = Number(prof && prof.affiliate_balance) || 0;
      await supabase.from('profiles').update({ affiliate_balance: bal + (Number(row.amount) || 0) }).eq('id', row.user_id);
    }

    console.log(`[ADMIN] ${req.user.email} retrait ${row.id} -> ${status}`);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/commissions', adminGuard, async (req, res) => {
  try {
    const { data, error } = await supabase.from('commissions').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return res.json({ success: true, commissions: [], note: error.message });

    const authUsers = await adminLoadAuthUsers();
    const emailById = new Map(authUsers.map(u => [u.id, u.email]));
    res.json({
      success: true,
      commissions: (data || []).map(r => ({
        ...r,
        referrerEmail: emailById.get(r.referrer_id) || null,
        referredEmail: emailById.get(r.referred_user_id) || null
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return res.sendFile(path.join(__dirname, 'index.html'));
  res.status(404).json({ error: "Route API non trouvée" });
});

// Gestionnaire d'erreurs global (Garantit des réponses 100% JSON pour l'API)
app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || "Erreur interne du serveur" });
});


const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[KAMALA JEANNE] Moteur Backend démarré sur http://localhost:${PORT}`);
  console.log(`[STORAGE] Dossier persistant WhatsApp : ${AUTH_BASE_DIR}`);

  // Restauration séquentielle sécurisée en tâche de fond pour que l'IA réponde 24/7 même si le marchand est absent
  setTimeout(async () => {
    try {
      if (fs.existsSync(AUTH_BASE_DIR)) {
        const entries = fs.readdirSync(AUTH_BASE_DIR);
        const sessionDirs = entries.filter(e => e.startsWith('session-'));
        if (sessionDirs.length > 0) {
          console.log(`[WA/STARTUP] ${sessionDirs.length} session(s) WhatsApp détectée(s) sur le disque.`);
          for (let i = 0; i < sessionDirs.length; i++) {
            const entry = sessionDirs[i];
            const userId = entry.replace('session-', '');
            if (!userId || waClients[userId]) continue;

            // Restaurer UNIQUEMENT si l'utilisateur a un numéro WhatsApp actif enregistré
            let shouldRestore = false;
            if (supabase) {
              try {
                const { data: p } = await supabase.from('profiles').select('whatsapp_number, credits').eq('id', userId).maybeSingle();
                if (p && p.whatsapp_number && String(p.whatsapp_number).trim().length >= 8) {
                  shouldRestore = true;
                }
              } catch(e) {}
            }

            if (shouldRestore) {
              await new Promise(r => setTimeout(r, i === 0 ? 3000 : 7000));
              console.log(`🚀 [WA/STARTUP] Auto-restauration de la session pour ${userId} en tâche de fond...`);
              createOrGetWhatsAppClient(userId, { autoRestore: true }).catch(err => {
                console.warn(`[WA/STARTUP] Notice auto-restauration ${userId}:`, err.message);
              });
            } else {
              // Nettoyer immédiatement les sessions orphelines pour libérer la RAM et le disque
              const staleDir = path.join(AUTH_BASE_DIR, entry);
              try {
                fs.rmSync(staleDir, { recursive: true, force: true });
                console.log(`🧹 [WA/STARTUP] Dossier de session orphelin ou inactif purgé : ${entry}`);
              } catch (e) {}
            }
          }
        }
      }
    } catch(err) {
      console.warn('[WA/STARTUP] Erreur scan sessions:', err.message);
    }
  }, 4000);
});

// Arrêt gracieux lors des redéploiements Railway (évite l'erreur de crash code 143 / SIGTERM)
const gracefulShutdown = (signal) => {
  console.log(`[SERVER] Signal ${signal} reçu. Arrêt gracieux en cours...`);
  try {
    for (const [userId, client] of Object.entries(waClients)) {
      if (client) {
        client.destroy().catch(() => {});
      }
    }
  } catch (e) {}

  server.close(() => {
    console.log('[SERVER] Serveur HTTP fermé avec succès. Sortie propre code 0.');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('[SERVER] Délai d\'arrêt dépassé. Sortie forcée code 0.');
    process.exit(0);
  }, 4000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Maintien actif de l'event-loop
setInterval(() => {}, 1000 * 60 * 60);




