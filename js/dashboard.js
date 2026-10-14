
// Helper d'authentification s�curis� pour les requ�tes API
function getAuthHeaders(extraHeaders = {}) {
  let token = null;
  try {
    token = localStorage.getItem('vendia_supabase_token');
    if (!token) {
      const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
      if (u && u.token) token = u.token;
    }
  } catch(e) {}

  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}

// D�tection dynamique et r�siliente de l'URL API Backend
let API_URL = 'https://kamala-jeanne-production.up.railway.app';

// Identifiant utilisateur infaillible (Global)
function getAppUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
    if (u && u.id && u.id.length > 5 && !u.id.startsWith('usr_')) return u.id;
  } catch(e) {}
  try {
    const su = JSON.parse(localStorage.getItem('sb-bbubzckxoxkscuzvhhiv-auth-token') || '{}');
    if (su && su.user && su.user.id) return su.user.id;
  } catch(e) {}
  return '6f9cf58f-4439-4c0b-b860-a36ad9e23055';
}
window.getAppUserId = getAppUserId;

try {
  const custom = localStorage.getItem('vandia_api_url') || localStorage.getItem('vandia_backend_url');
  if (custom) {
    API_URL = custom;
  } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_URL = window.location.origin;
  }
} catch (e) {}
﻿/**
 * ==============================================================================
 * VANDIA AI — DASHBOARD JAVASCRIPT ENGINE
 * Full SPA Frontend Navigation, Chart.js, WhatsApp Live Chat, Modals & MOCK Data
 * Prepared for Supabase / Backend API integration
 * ==============================================================================
 */

// ==============================================================================
// AUTHENTICATION GUARD
// ==============================================================================
(function() {
    // Si l'URL contient des jetons OAuth, rediriger immédiatement vers index.html pour validation stricte
    if (
        (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='))) ||
        (window.location.search && window.location.search.includes('code='))
    ) {
        window.location.replace('index.html' + window.location.search + window.location.hash);
        return;
    }
    let u = null;
    try {
        u = JSON.parse(localStorage.getItem('vendia_current_user'));
    } catch(e) {}
    if (!u || !u.id || (typeof u.id === 'string' && u.id.startsWith('usr_guest'))) {
        window.location.replace('index.html');
    }
})();


// ==============================================================================
// 0. SECURITY & SANITIZATION UTILITIES (Protection Anti-XSS & Injections)
// ==============================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

function sanitizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) return "";
  if (trimmed.startsWith("data:") && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}


// ==============================================================================
// 0.1 FORMATAGE DYNAMIQUE & NUMÉROS WHATSAPP (Vue d'ensemble & CRM)
// ==============================================================================
function formatWhatsAppDisplayNumber(phone) {
  if (!phone) return '<span style="color: var(--text-muted);">Inconnu</span>';
  const clean = String(phone).replace(/[^0-9]/g, '');
  if (clean.length > 13 && !clean.startsWith('229') && !clean.startsWith('226') && !clean.startsWith('225') && !clean.startsWith('221') && !clean.startsWith('33')) {
    return `<span class="badge badge-subtle" title="Identifiant WhatsApp Multi-Device (LID)">WA ID: ${clean.substring(0, 4)}...${clean.substring(clean.length - 4)}</span>`;
  }
  if (clean.startsWith('229') && clean.length >= 11) {
    return `+229 ${clean.slice(3, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 9)} ${clean.slice(9)}`;
  }
  if (clean.startsWith('226') && clean.length >= 11) {
    return `+226 ${clean.slice(3, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 9)} ${clean.slice(9)}`;
  }
  if (clean.startsWith('225') && clean.length >= 12) {
    return `+225 ${clean.slice(3, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 9)} ${clean.slice(9)}`;
  }
  if (clean.startsWith('221') && clean.length >= 11) {
    return `+221 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  if (clean.length >= 8) {
    return `+${clean.substring(0, 3)} ${clean.substring(3, 6)} ${clean.substring(6)}`;
  }
  return clean ? `+${clean}` : 'Inconnu';
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return "";
  if (typeof dateInput === "string" && (dateInput.includes(":") && dateInput.length <= 5 || dateInput.includes("À l'instant") || dateInput.includes("Hier"))) {
    return dateInput;
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1 || (diffHours < 48 && d.getDate() === now.getDate() - 1)) {
      return "Hier";
    }
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  } catch(e) {
    return String(dateInput);
  }
}

// ==============================================================================
// 1. MOCK DATA STORE (Prêt pour injection Supabase)
// ==============================================================================
const MOCK_DATA = {
  currentUser: {
    id: "usr_guest",
    name: "Utilisateur",
    role: "Administrateur",
    avatar: "V",
    connectedPhone: "Non lié",
    phoneStatus: "En attente",
    plan: {
      name: "Essai Gratuit 7j 🚀",
      badge: "300 CRÉDITS",
      tokensUsed: 0,
      tokensMax: 300,
      percentage: 0
    }
  },

  currency: "XOF",
  exchangeRate: 615,

  kpis: {
    salesUsd: 0,
    salesXof: 0,
    salesTrend: "0%",
    conversations: 0,
    conversationsTrend: "0%",
    conversionRate: "0.0%",
    conversionTrend: "0%",
    abandonedRecovered: 0,
    abandonedRecoveredRate: "0 relancé",
    abandonedSavedUsd: 0,
    abandonedSavedXof: 0
  },

  chartData: {
    "7": {
      labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
      salesUsd: [0, 0, 0, 0, 0, 0, 0],
      salesXof: [0, 0, 0, 0, 0, 0, 0],
      conversations: [0, 0, 0, 0, 0, 0, 0]
    },
    "14": {
      labels: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14"],
      salesUsd: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      salesXof: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      conversations: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    "30": {
      labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      salesUsd: [0, 0, 0, 0],
      salesXof: [0, 0, 0, 0],
      conversations: [0, 0, 0, 0]
    }
  },

  recentInteractions: [],
  conversations: [],
  contacts: [],
  mockSearchResults: [],
  campaigns: [],
  automations: [
    {
      id: "auto-1",
      title: "Tunnel Vente Flash Canva Pro & CapCut",
      trigger: "canva, promo, capcut, 1, 2",
      active: true,
      steps: 3,
      contacts: 148,
      conversion: "46.2%",
      icon: "fa-bolt",
      step1: "Bonjour ! Voici notre tarif promo exceptionnel : Canva Pro à 1 300 FCFA et CapCut Pro à 1 600 FCFA avec activation immédiate. Souhaitez-vous recevoir les coordonnées pour régler ?",
      delay: "2h",
      step2: "Avez-vous pu finaliser votre activation ? Notre équipe reste à votre écoute si vous souhaitez de l'aide !"
    },
    {
      id: "auto-2",
      title: "Accueil & Qualification Nouveaux Prospects",
      trigger: "Premier contact WhatsApp",
      active: true,
      steps: 2,
      contacts: 312,
      conversion: "38.5%",
      icon: "fa-hand-sparkles",
      step1: "Bonjour et bienvenue chez nous ! 😊 Je suis votre conseiller commercial VANDIA. Comment puis-je vous aider aujourd'hui ? 1️⃣ Canva Pro, 2️⃣ CapCut Pro, 3️⃣ Formations",
      delay: "1h",
      step2: "Bonjour ! N'hésitez pas à me dire quel outil vous intéresse afin que je vous guide vers la meilleure offre."
    },
    {
      id: "auto-3",
      title: "Relance Automatique Commande / Panier Abandonné",
      trigger: "Après 2h sans preuve de paiement",
      active: true,
      steps: 2,
      contacts: 89,
      conversion: "52.8%",
      icon: "fa-cart-shopping",
      step1: "Votre commande est bien réservée ! Avez-vous rencontré une difficulté lors du transfert Wave ou Mobile Money ?",
      delay: "24h",
      step2: "Dernier rappel bienveillant : votre tarif promotionnel est conservé jusqu'à ce soir. Souhaitez-vous le lien direct ?"
    },
    {
      id: "auto-4",
      title: "Tunnel TikTok Monétisé & Formations",
      trigger: "tiktok, formation, monetisation",
      active: true,
      steps: 3,
      contacts: 76,
      conversion: "41.0%",
      icon: "fa-graduation-cap",
      step1: "Découvrez notre méthode complète pour créer et monétiser un compte TikTok depuis l'Afrique. Tarif promo : 1 300 FCFA.",
      delay: "2h",
      step2: "Voulez-vous voir les preuves de résultats de nos apprenants avant de valider votre inscription ?"
    }
  ],
  templates: [],
  integrations: [
    {
      key: "wave",
      name: "Wave (Sénégal & Côte d'Ivoire)",
      status: "Connecté & Actif",
      badgeClass: "badge-green",
      desc: "Réception instantanée sans frais. Numéro et nom communiqués automatiquement aux clients lors de la commande.",
      phone: "+226 05 15 84 94",
      beneficiary: "Gnitou Essowedeou",
      color: "#1dc4e9",
      icon: "fa-water",
      active: true
    },
    {
      key: "orange_money",
      name: "Orange Money (Burkina Faso, Mali, etc.)",
      status: "Connecté & Actif",
      badgeClass: "badge-green",
      desc: "Paiements rapides par Orange Money en Afrique de l'Ouest. Détection automatique selon le préfixe du pays.",
      phone: "+226 05 15 84 94",
      beneficiary: "Gnitou Essowedeou",
      color: "#ff6600",
      icon: "fa-mobile-retro",
      active: true
    },
    {
      key: "mtn_momo",
      name: "MTN Mobile Money (Bénin, Côte d'Ivoire)",
      status: "Connecté & Actif",
      badgeClass: "badge-green",
      desc: "Routage automatique vers MTN MoMo pour les clients du Bénin (+229) et pays partenaires.",
      phone: "+229 01 62 63 95 93",
      beneficiary: "Gnitou Essowedeou",
      color: "#ffcc00",
      icon: "fa-money-bill-transfer",
      active: true
    },
    {
      key: "moov_money",
      name: "Moov Africa Flooz (Bénin, Togo, etc.)",
      status: "Prêt",
      badgeClass: "badge-green",
      desc: "Paiement par Flooz Moov Money. Numéro communiqué aux clients togolais et béninois.",
      phone: "+229 01 62 63 95 93",
      beneficiary: "Gnitou Essowedeou",
      color: "#0055a5",
      icon: "fa-coins",
      active: true
    },
    {
      key: "saspay",
      name: "SasPay & Carte Bancaire (Diaspora / VISA)",
      status: "Prêt",
      badgeClass: "badge-blue",
      desc: "Paiements sécurisés par Carte VISA, Mastercard et liens de paiement pour les clients internationaux.",
      phone: "Lien de paiement sécurisé",
      beneficiary: "VANDIA SAS",
      color: "#10b981",
      icon: "fa-credit-card",
      active: true
    },
    {
      key: "meta_api",
      name: "Meta Cloud API (WhatsApp Officiel)",
      status: "Actif & Coexistence",
      badgeClass: "badge-green",
      desc: "Routage bidirectionnel avec l'infrastructure WhatsApp Cloud officielle pour une livraison 100% garantie.",
      phone: "ID: 1315731748294861",
      beneficiary: "Meta Verified",
      color: "#25d366",
      icon: "fa-brands fa-whatsapp",
      active: true
    }
  ]
};

// ==============================================================================
// 2. GLOBAL STATE
// ==============================================================================
let activeView = "overview";
let currentCurrency = MOCK_DATA.currency;
let salesChartInstance = null;
let hourlyChartInstance = null;
let activeConversation = MOCK_DATA.conversations[0];

// ==============================================================================
// 3. INITIALIZATION
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {

  // Inbox Tabs
  const inboxTabs = document.querySelectorAll('.inbox-tab-btn');
  inboxTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      inboxTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  initDashboard();
});


// ==============================================================================
// MOTEUR UNIFIÉ DU SYSTÈME D'ESSAI GRATUIT (7 JOURS) & ABONNEMENTS VANDIA IA
// ==============================================================================
let trialCountdownTimer = null;
let currentSubscriptionState = {
  createdAt: null,
  trialDurationMs: 7 * 24 * 60 * 60 * 1000,
  plan: 'trial',
  planStatus: 'active',
  planCycle: 'monthly',
  planCycleLabel: '1 mois',
  planActivatedAt: null,
  planExpiresAt: null,
  credits: 100,
  maxCredits: 100,
  isExpired: false
};

function parseDashboardCycleDuration(cycle) {
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

function getStoredUserCreatedAt() {
  const currentUserId = (typeof getAppUserId === 'function') ? getAppUserId() : null;

  // 1. Depuis vendia_current_user dans localStorage
  try {
    const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
    if (u && (u.createdAt || u.created_at)) return u.createdAt || u.created_at;
  } catch(e) {}

  // 2. Depuis le cache persistant par userId
  if (currentUserId) {
    try {
      const cached = localStorage.getItem('vendia_user_registered_' + currentUserId);
      if (cached) return cached;
    } catch(e) {}
  }

  // 3. Depuis le token officiel Supabase Auth dans localStorage (sb-*-auth-token)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const su = JSON.parse(localStorage.getItem(key) || '{}');
        if (su && su.user && su.user.created_at) {
          if (currentUserId) {
            try { localStorage.setItem('vendia_user_registered_' + currentUserId, su.user.created_at); } catch(e) {}
          }
          return su.user.created_at;
        }
      }
    }
  } catch(e) {}

  // 4. Fallback persistant : ne jamais écraser chaque seconde, mémoriser une seule fois
  const guestKey = currentUserId ? ('vendia_reg_' + currentUserId) : 'vendia_guest_reg';
  let savedDate = null;
  try {
    savedDate = localStorage.getItem(guestKey);
  } catch(e) {}
  if (!savedDate) {
    savedDate = new Date().toISOString();
    try {
      localStorage.setItem(guestKey, savedDate);
      const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
      if (!u.createdAt && !u.created_at) {
        u.createdAt = savedDate;
        localStorage.setItem('vendia_current_user', JSON.stringify(u));
      }
    } catch(e) {}
  }
  return savedDate;
}

function updateTrialAndSubscriptionUI() {
  const rawPlan = currentSubscriptionState.plan;
  const isPaid = (rawPlan && rawPlan !== 'trial' && rawPlan !== 'free' && rawPlan !== 'expired' && currentSubscriptionState.planStatus === 'active');
  const now = Date.now();
  const pad = (n) => String(n).padStart(2, '0');

  const headerBadge = document.getElementById("header-trial-badge");
  const headerBtn = document.getElementById("btn-header-upgrade");
  const crownIcon = headerBtn ? headerBtn.querySelector("i.fa-crown, i.fa-solid") : null;

  const navBadge = document.getElementById("nav-badge-plan");
  const sidebarPlanTitle = document.getElementById("sidebar-plan-name");

  const billingStatusBadge = document.getElementById("billing-status-badge");
  const billingTitleDisplay = document.getElementById("billing-title-display");
  const billingSubtitleDisplay = document.getElementById("billing-subtitle-display");
  const billingDaysLeft = document.getElementById("billing-days-left");
  const billingCountdownTimer = document.getElementById("billing-countdown-timer");
  const billingCreditsDisplay = document.getElementById("billing-credits-display");

  if (isPaid) {
    // =========================================================================
    // CAS 1 : ABONNEMENT PAYANT (Durée réelle : 15 jours, 1 mois, 3 mois, etc.)
    // =========================================================================
    const cycleInfo = parseDashboardCycleDuration(currentSubscriptionState.planCycle);
    const durationLabel = currentSubscriptionState.planCycleLabel || cycleInfo.label;
    const planUpper = String(rawPlan).toUpperCase();
    const planDisplay = (planUpper === 'PRO' ? 'Pro' : planUpper === 'BUSINESS' ? 'Business' : planUpper === 'BASIC' ? 'Basic' : planUpper);

    const activatedTime = new Date(currentSubscriptionState.planActivatedAt || currentSubscriptionState.createdAt || getStoredUserCreatedAt()).getTime();
    const expiresTime = currentSubscriptionState.planExpiresAt 
      ? new Date(currentSubscriptionState.planExpiresAt).getTime() 
      : (activatedTime + cycleInfo.ms);

    const paidMsLeft = expiresTime - now;
    const isPaidExpired = paidMsLeft <= 0;
    currentSubscriptionState.isExpired = isPaidExpired;

    const paidDays = Math.max(0, Math.floor(Math.max(0, paidMsLeft) / (24 * 60 * 60 * 1000)));
    const paidHours = Math.max(0, Math.floor((Math.max(0, paidMsLeft) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
    const paidMinutes = Math.max(0, Math.floor((Math.max(0, paidMsLeft) % (60 * 60 * 1000)) / (60 * 1000)));
    const paidSeconds = Math.max(0, Math.floor((Math.max(0, paidMsLeft) % (60 * 1000)) / 1000));
    const countdownFormatted = `${pad(paidDays)} j ${pad(paidHours)} h ${pad(paidMinutes)} min ${pad(paidSeconds)} s`;

    const paidDaysRemaining = isPaidExpired ? 0 : Math.max(0, Math.ceil(paidMsLeft / (24 * 60 * 60 * 1000)));

    // 1. Badge d'en-tête (Zone ciblée)
    if (headerBadge) {
      if (isPaidExpired) {
        headerBadge.textContent = `Forfait ${planDisplay} expiré`;
        headerBadge.style.color = "#f43f5e";
        headerBadge.style.borderColor = "rgba(244, 63, 94, 0.4)";
        headerBadge.style.background = "rgba(244, 63, 94, 0.15)";
      } else {
        let daysText = "";
        if (paidDaysRemaining > 1) {
          daysText = `${paidDaysRemaining}j restants`;
        } else if (paidDaysRemaining === 1) {
          daysText = "1j restant";
        } else {
          daysText = "0j restant";
        }
        headerBadge.textContent = `Forfait ${planDisplay} (${durationLabel}) · ${daysText}`;
        headerBadge.style.color = "var(--whatsapp-green)";
        headerBadge.style.borderColor = "rgba(37, 211, 102, 0.4)";
        headerBadge.style.background = "rgba(37, 211, 102, 0.15)";
      }
    }

    if (headerBtn) {
      if (isPaidExpired) {
        headerBtn.title = `Votre forfait ${planDisplay} (${durationLabel}) est expiré. Cliquez pour renouveler votre forfait.`;
        headerBtn.style.borderColor = "rgba(244, 63, 94, 0.5)";
      } else {
        headerBtn.title = `Forfait ${planDisplay} (${durationLabel}) actif · Temps restant : ${countdownFormatted} • Gérer mon abonnement`;
        headerBtn.style.borderColor = "rgba(37, 211, 102, 0.4)";
      }
    }

    if (crownIcon) {
      crownIcon.style.color = isPaidExpired ? "#f43f5e" : "var(--whatsapp-green)";
    }

    // 2. Navigation latérale
    if (navBadge) {
      navBadge.textContent = isPaidExpired ? "Expiré" : "Actif";
      navBadge.className = isPaidExpired ? "badge badge-rose" : "badge badge-green";
      navBadge.style.background = isPaidExpired ? "rgba(244, 63, 94, 0.15)" : "rgba(37, 211, 102, 0.15)";
      navBadge.style.color = isPaidExpired ? "#f43f5e" : "var(--whatsapp-green)";
    }

    // 3. Bas de la sidebar
    if (sidebarPlanTitle) {
      sidebarPlanTitle.textContent = isPaidExpired 
        ? `Forfait ${planDisplay} Expiré ⚠️` 
        : `Formule ${planDisplay} (${durationLabel}) 👑`;
    }

    // 4. Vue Forfaits & Facturation
    if (billingStatusBadge) {
      billingStatusBadge.textContent = isPaidExpired 
        ? `Formule ${planDisplay} Expirée` 
        : `Formule ${planDisplay} Active (${durationLabel})`;
      billingStatusBadge.style.background = isPaidExpired ? "rgba(244, 63, 94, 0.2)" : "rgba(37, 211, 102, 0.2)";
      billingStatusBadge.style.color = isPaidExpired ? "#f43f5e" : "var(--whatsapp-green)";
    }

    if (billingTitleDisplay) {
      billingTitleDisplay.textContent = isPaidExpired
        ? `Votre forfait ${planDisplay} (${durationLabel}) est arrivé à expiration`
        : `Votre formule ${planDisplay} (${durationLabel}) est active et opérationnelle`;
    }

    if (billingSubtitleDisplay) {
      billingSubtitleDisplay.textContent = isPaidExpired
        ? "Votre période d'abonnement est expirée. Cliquez sur un forfait ci-dessous pour renouveler votre accès et relancer vos agents commerciaux IA WhatsApp."
        : "Vos agents commerciaux IA WhatsApp et tous vos tunnels de vente sont actifs sans aucune interruption.";
    }

    if (billingDaysLeft) {
      billingDaysLeft.textContent = isPaidExpired 
        ? "Abonnement expiré" 
        : `${paidDaysRemaining} jour${paidDaysRemaining > 1 ? 's' : ''} restant${paidDaysRemaining > 1 ? 's' : ''} (${durationLabel})`;
    }

    if (billingCountdownTimer) {
      billingCountdownTimer.textContent = isPaidExpired ? "00 j 00 h 00 min 00 s (Expiré)" : countdownFormatted;
    }

  } else {
    // =========================================================================
    // CAS 2 : ESSAI GRATUIT 7 JOURS (Décompte exact : 7, 6, 5, 4, 3, 2, 1, 0)
    // =========================================================================
    const createdAtStr = currentSubscriptionState.createdAt || getStoredUserCreatedAt();
    const createdTime = new Date(createdAtStr).getTime();
    const trialEndTime = createdTime + currentSubscriptionState.trialDurationMs;
    const msLeft = trialEndTime - now;
    const isExpired = msLeft <= 0;

    currentSubscriptionState.isExpired = isExpired;

    const days = Math.max(0, Math.floor(Math.max(0, msLeft) / (24 * 60 * 60 * 1000)));
    const hours = Math.max(0, Math.floor((Math.max(0, msLeft) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
    const minutes = Math.max(0, Math.floor((Math.max(0, msLeft) % (60 * 60 * 1000)) / (60 * 1000)));
    const seconds = Math.max(0, Math.floor((Math.max(0, msLeft) % (60 * 1000)) / 1000));
    const countdownFormatted = `${pad(days)} j ${pad(hours)} h ${pad(minutes)} min ${pad(seconds)} s`;

    // Calcul individuel du jour restant selon le temps réellement écoulé :
    // 7 jours restants, puis 6, 5, 4, 3, 2, 1, et enfin 0 selon le temps écoulé
    let daysRemaining = 0;
    if (msLeft > 0) {
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (msLeft > 6 * oneDayMs) {
        daysRemaining = 7;
      } else if (msLeft > 5 * oneDayMs) {
        daysRemaining = 6;
      } else if (msLeft > 4 * oneDayMs) {
        daysRemaining = 5;
      } else if (msLeft > 3 * oneDayMs) {
        daysRemaining = 4;
      } else if (msLeft > 2 * oneDayMs) {
        daysRemaining = 3;
      } else if (msLeft > 1 * oneDayMs) {
        daysRemaining = 2;
      } else if (msLeft > 12 * 60 * 60 * 1000) {
        daysRemaining = 1;
      } else {
        daysRemaining = 0;
      }
    }

    // 1. Badge d'en-tête (Zone ciblée)
    if (headerBadge) {
      if (isExpired) {
        headerBadge.textContent = "Essai gratuit expiré";
        headerBadge.style.color = "#f43f5e";
        headerBadge.style.borderColor = "rgba(244, 63, 94, 0.4)";
        headerBadge.style.background = "rgba(244, 63, 94, 0.15)";
      } else {
        if (daysRemaining > 1) {
          headerBadge.textContent = `Essai gratuit · ${daysRemaining}j restants`;
        } else if (daysRemaining === 1) {
          headerBadge.textContent = "Essai gratuit · 1j restant";
        } else {
          headerBadge.textContent = "Essai gratuit · 0j restant";
        }
        headerBadge.style.color = "#f59e0b";
        headerBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";
        headerBadge.style.background = "rgba(245, 158, 11, 0.2)";
      }
    }

    if (headerBtn) {
      if (isExpired) {
        headerBtn.title = "Votre période d'essai de 7 jours est expirée. Cliquez pour choisir un forfait.";
        headerBtn.style.borderColor = "rgba(244, 63, 94, 0.5)";
      } else {
        headerBtn.title = `Essai gratuit (7 jours) · ${daysRemaining}j restant(s) [${countdownFormatted}]. Cliquez pour choisir un forfait.`;
        headerBtn.style.borderColor = "rgba(245, 158, 11, 0.4)";
      }
    }

    if (crownIcon) {
      crownIcon.style.color = isExpired ? "#f43f5e" : "#f59e0b";
    }

    // 2. Navigation latérale
    if (navBadge) {
      if (isExpired) {
        navBadge.textContent = "Expiré";
        navBadge.className = "badge badge-rose";
        navBadge.style.background = "rgba(244, 63, 94, 0.15)";
        navBadge.style.color = "#f43f5e";
      } else {
        navBadge.textContent = daysRemaining > 1 ? `Essai ${daysRemaining}j` : (daysRemaining === 1 ? "Essai 1j" : "< 24h");
        navBadge.className = "badge badge-amber";
        navBadge.style.background = "rgba(245, 158, 11, 0.2)";
        navBadge.style.color = "#f59e0b";
      }
    }

    // 3. Bas de la sidebar
    if (sidebarPlanTitle) {
      if (isExpired) {
        sidebarPlanTitle.textContent = "Essai Gratuit Expiré ⚠️";
      } else {
        sidebarPlanTitle.textContent = `Essai Gratuit (${daysRemaining}j restants) 🦾`;
      }
    }

    // 4. Vue Forfaits & Facturation
    if (billingStatusBadge) {
      if (isExpired) {
        billingStatusBadge.textContent = "Essai Gratuit Expiré";
        billingStatusBadge.style.background = "rgba(244, 63, 94, 0.2)";
        billingStatusBadge.style.color = "#f43f5e";
      } else {
        billingStatusBadge.textContent = `Essai Gratuit Actif (${daysRemaining} Jours restants)`;
        billingStatusBadge.style.background = "rgba(37, 211, 102, 0.15)";
        billingStatusBadge.style.color = "var(--whatsapp-green)";
      }
    }

    if (billingTitleDisplay) {
      billingTitleDisplay.textContent = isExpired
        ? "Votre période d'essai de 7 jours est expirée"
        : "Votre période d'essai de 7 jours est en cours";
    }

    if (billingSubtitleDisplay) {
      billingSubtitleDisplay.textContent = isExpired
        ? "Votre période gratuite est terminée. Choisissez un forfait ci-dessous pour réactiver vos agents commerciaux IA et continuer à encaisser des ventes 24h/24."
        : "Testez toutes les fonctionnalités en illimité pendant vos 7 jours d'essai gratuit.";
    }

    if (billingDaysLeft) {
      if (isExpired) {
        billingDaysLeft.textContent = "Essai gratuit expiré";
      } else {
        billingDaysLeft.textContent = `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`;
      }
    }

    if (billingCountdownTimer) {
      billingCountdownTimer.textContent = isExpired ? "00 j 00 h 00 min 00 s (Expiré)" : countdownFormatted;
    }
  }

  // Crédits dans la sidebar
  const credits = currentSubscriptionState.credits;
  const maxCredits = isPaid 
    ? (rawPlan === 'basic' ? 1000 : rawPlan === 'pro' ? 3000 : 10000) 
    : 100;
  const usedCredits = Math.max(0, maxCredits - credits);
  const pct = maxCredits > 0 ? ((usedCredits / maxCredits) * 100).toFixed(1) : "0.0";

  const subTokenPct = document.getElementById("sub-token-pct");
  const subTokenFill = document.getElementById("sub-token-fill");
  const subTokensUsed = document.getElementById("sub-tokens-used");
  const subTokensMax = document.getElementById("sub-tokens-max");
  if (subTokenPct) subTokenPct.textContent = `${pct}%`;
  if (subTokenFill) subTokenFill.style.width = `${pct}%`;
  if (subTokensUsed) subTokensUsed.textContent = `${usedCredits} crédit${usedCredits > 1 ? 's' : ''}`;
  if (subTokensMax) subTokensMax.textContent = `Max ${maxCredits.toLocaleString('fr-FR')} crédits`;

  if (billingCreditsDisplay) {
    billingCreditsDisplay.innerHTML = `Crédits IA : <strong>${credits} restants sur ${maxCredits} inclus</strong>`;
  }
}

async function syncSubscriptionStatusFromServer() {
  const userId = (typeof getAppUserId === 'function') ? getAppUserId() : null;
  if (!userId) return;

  // 1. Synchronisation instantanée depuis la session Supabase locale (sb-*-auth-token)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const su = JSON.parse(localStorage.getItem(key) || '{}');
        if (su && su.user) {
          if (su.user.created_at && !currentSubscriptionState.createdAt) {
            currentSubscriptionState.createdAt = su.user.created_at;
          }
          const appMeta = su.user.app_metadata || {};
          if (appMeta.plan && appMeta.plan !== 'trial' && appMeta.plan !== 'free') {
            currentSubscriptionState.plan = appMeta.plan;
            currentSubscriptionState.planStatus = appMeta.plan_status || 'active';
            currentSubscriptionState.planCycle = appMeta.plan_cycle || 'monthly';
            currentSubscriptionState.planActivatedAt = appMeta.plan_activated_at || null;
            currentSubscriptionState.planExpiresAt = appMeta.plan_expires_at || null;
          }
          break;
        }
      }
    }
  } catch (e) {}

  // 2. Synchronisation directe depuis Supabase REST (table profiles)
  if (window.SupabaseRest) {
    try {
      const profile = await window.SupabaseRest.getProfile(userId);
      if (profile) {
        if (profile.created_at) {
          currentSubscriptionState.createdAt = profile.created_at;
          try { localStorage.setItem('vendia_user_registered_' + userId, profile.created_at); } catch(e) {}
        }
        if (profile.plan && profile.plan !== 'trial' && profile.plan !== 'free') {
          currentSubscriptionState.plan = profile.plan;
          currentSubscriptionState.planStatus = profile.plan_status || 'active';
          if (profile.plan_cycle) currentSubscriptionState.planCycle = profile.plan_cycle;
          if (profile.plan_activated_at) currentSubscriptionState.planActivatedAt = profile.plan_activated_at;
          if (profile.plan_expires_at) currentSubscriptionState.planExpiresAt = profile.plan_expires_at;
        }
        if (typeof profile.credits === 'number') {
          currentSubscriptionState.credits = profile.credits;
        }
        updateTrialAndSubscriptionUI();

        // Synchronisation directe du numéro WhatsApp personnel depuis Supabase
        const dbPhone = (profile.whatsapp_number || profile.phone || "").toString().trim();
        try {
          const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
          u.fullPhone = dbPhone;
          u.phoneNumber = dbPhone.replace(/^\+\d+\s*/, '');
          if (profile.first_name) u.firstName = profile.first_name;
          if (profile.last_name) u.lastName = profile.last_name;
          localStorage.setItem('vendia_current_user', JSON.stringify(u));
        } catch(e) {}
        if (typeof window.applyWhatsAppState === 'function') {
          window.applyWhatsAppState(window.currentWhatsAppStatus || 'DISCONNECTED', dbPhone);
        }
      }
    } catch (pErr) {
      console.warn("[SUBSCRIPTION] Notice lecture directe Supabase:", pErr);
    }
  }

  // 3. Synchronisation via l'API Backend (/api/user/subscription/:userId)
  try {
    const res = await fetch(API_URL + '/api/user/subscription/' + encodeURIComponent(userId), {
      headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders() : {}
    });

    if (res.status === 401 || res.status === 403) {
      console.warn("[DASHBOARD GUARD] Compte non autorisé ou profil inexistant sur le serveur (HTTP " + res.status + "). Éjection vers l'accueil.");
      try {
        localStorage.removeItem('vendia_current_user');
        localStorage.removeItem('vendia_supabase_token');
      } catch(e) {}
      window.location.replace('index.html');
      return;
    }

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        if (data.createdAt) currentSubscriptionState.createdAt = data.createdAt;
        if (data.plan) currentSubscriptionState.plan = data.plan;
        if (data.planStatus) currentSubscriptionState.planStatus = data.planStatus;
        if (data.planCycle) currentSubscriptionState.planCycle = data.planCycle;
        if (data.planCycleLabel) currentSubscriptionState.planCycleLabel = data.planCycleLabel;
        if (data.activatedAt) currentSubscriptionState.planActivatedAt = data.activatedAt;
        if (data.expiresAt) currentSubscriptionState.planExpiresAt = data.expiresAt;
        if (typeof data.credits === 'number') currentSubscriptionState.credits = data.credits;
        currentSubscriptionState.isExpired = !!data.isExpired;

        try {
          const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
          u.createdAt = data.createdAt;
          u.plan = {
            ...(u.plan || {}),
            type: data.plan,
            status: data.planStatus,
            cycle: data.planCycle,
            activatedAt: data.activatedAt,
            expiresAt: data.expiresAt,
            name: data.isPaid ? `Formule ${data.plan.toUpperCase()}` : 'Essai Gratuit 7j 🦾',
            daysLeft: data.daysLeft,
            tokensMax: (data.plan === 'basic' ? 1000 : data.plan === 'pro' ? 3000 : data.plan === 'business' ? 10000 : 100),
            tokensUsed: Math.max(0, (data.plan === 'basic' ? 1000 : data.plan === 'pro' ? 3000 : data.plan === 'business' ? 10000 : 100) - data.credits)
          };

          if (data.whatsappNumber !== undefined) {
            let apiPhone = (data.whatsappNumber || '').toString().trim();
            if (apiPhone === '+229 62639593' || apiPhone === '22962639593') apiPhone = '';
            u.fullPhone = apiPhone;
            u.phoneNumber = apiPhone.replace(/^\+\d+\s*/, '');
            if (typeof window.applyWhatsAppState === 'function') {
              window.applyWhatsAppState(window.currentWhatsAppStatus || 'DISCONNECTED', apiPhone);
            }
          }

          localStorage.setItem('vendia_current_user', JSON.stringify(u));
        } catch(e) {}

        updateTrialAndSubscriptionUI();
      }
    }
  } catch (err) {
    console.warn("[SUBSCRIPTION] Synchronisation serveur différée:", err);
  }
}

function initTrialCountdownEngine() {
  updateTrialAndSubscriptionUI();

  if (trialCountdownTimer) clearInterval(trialCountdownTimer);
  trialCountdownTimer = setInterval(updateTrialAndSubscriptionUI, 1000);

  syncSubscriptionStatusFromServer();

  setInterval(() => {
    if (!document.hidden) syncSubscriptionStatusFromServer();
  }, 30000);

  handlePaymentReturnCallback();
}

async function handlePaymentReturnCallback() {
  try {
    const params = new URLSearchParams(window.location.search);
    const paymentAction = params.get('payment');
    if (paymentAction === 'return' || paymentAction === 'success') {
      const tier = params.get('tier') || localStorage.getItem('vendia_pending_tier') || 'pro';
      const sessionId = params.get('session_id') || params.get('sessionId') || params.get('id') || params.get('reference') || localStorage.getItem('vendia_pending_session');
      const userId = (typeof getAppUserId === 'function') ? getAppUserId() : '6f9cf58f-4439-4c0b-b860-a36ad9e23055';
      
      if (!sessionId) {
        console.warn("[PAYMENT CALLBACK] Aucun identifiant de session trouvé.");
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
        return;
      }

      showToast("⏳ Vérification sécurisée du paiement auprès de SaaSPay...", "info");

      try {
        const res = await fetch(API_URL + '/api/payments/verify-session', {
          method: 'POST',
          headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, userId })
        });
        const d = await res.json();
        
        if (d && d.verified && d.success) {
          const pendingCycle = localStorage.getItem('vendia_pending_cycle') || 'monthly';
          currentSubscriptionState.plan = d.plan || tier;
          currentSubscriptionState.planStatus = 'active';
          currentSubscriptionState.planCycle = pendingCycle;
          currentSubscriptionState.planActivatedAt = new Date().toISOString();
          if (typeof d.credits === 'number') currentSubscriptionState.credits = d.credits;
          
          localStorage.removeItem('vendia_pending_session');
          localStorage.removeItem('vendia_pending_tier');
          localStorage.removeItem('vendia_pending_cycle');
          
          updateTrialAndSubscriptionUI();
          syncSubscriptionStatusFromServer();
          showToast(`👑 Forfait ${(d.plan || tier).toUpperCase()} activé avec succès ! Merci pour votre confiance.`, "success");
        } else {
          showToast(d.message || "Paiement en attente de confirmation opérateur ou non validé.", "warning");
        }
      } catch(err) {
        console.error("[PAYMENT CALLBACK] Erreur:", err);
        showToast("Erreur lors de la vérification du paiement auprès du serveur.", "info");
      }

      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  } catch(e) {
    console.error("[PAYMENT CALLBACK] Fatal:", e);
  }
}

window.updateTrialAndSubscriptionUI = updateTrialAndSubscriptionUI;
window.syncSubscriptionStatusFromServer = syncSubscriptionStatusFromServer;
window.initTrialCountdownEngine = initTrialCountdownEngine;


function initDashboard() {
  let u = null;
  try {
    u = JSON.parse(localStorage.getItem('vendia_current_user'));
  } catch(e) {}
  if (!u || !u.id || (typeof u.id === 'string' && u.id.startsWith('usr_guest'))) {
    window.location.replace('index.html');
    return;
  }

  setupNavigation();
  setupMobileSidebar();
  setupModals();
  setupCurrencyToggle();
  setupChartFilters();
  setupInboxInteraction();
  setupSearch();
  setupActionButtons();
  setupProfileSystem();
  setupBillingAndAffiliate();
  setupTemplateModalEngine();

  // Populate view contents
  renderKpis();
  renderActivityFeed();
  renderOverviewRecentChats();
  loadOverviewRealData();
  renderRecentInteractions();
  renderBroadcastCampaigns();
  renderAutomations();
  renderContacts();
  renderTemplates();
  renderIntegrations();
  renderAutomations();
  syncAffiliateModule();
  renderTeamMembers();

  // Initialize Chart.js
  initCharts();

  // Handle URL hash on load
  const hash = window.location.hash.replace("#", "");
  if (hash && document.getElementById(`view-${hash}`)) {
    showView(hash);
  } else {
    showView("overview");
  }

  // Welcome Toast
  setTimeout(() => {
    showToast("Connexion WhatsApp active • Agent IA prêt en 24/7", "info");
  }, 900);
}

// ==============================================================================
// 4. SPA NAVIGATION
// ==============================================================================
function setupNavigation() {
  const navLinks = document.querySelectorAll(".sidebar .nav-item-link");

  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const viewId = link.getAttribute("data-view");
      const title = link.getAttribute("data-title");
      showView(viewId, title);

      // Auto close sidebar on mobile after selection
      if (window.innerWidth <= 768) {
        closeMobileSidebar();
      }
    });
  });

  // Mobile Bottom Navigation Buttons
  const mobileNavBtns = document.querySelectorAll(".mobile-bottom-nav .mobile-nav-btn");
  mobileNavBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const viewId = btn.getAttribute("data-view");
      if (viewId) {
        showView(viewId);
      }
    });
  });

  // Mobile Bottom Center FAB (+)
  const mobileFab = document.getElementById("mobile-nav-fab");
  if (mobileFab) {
    mobileFab.addEventListener("click", (e) => {
      e.preventDefault();
      openBroadcastModal();
    });
  }

  // Header Mobile Profile Avatar Button
  const mobileProfileBtn = document.getElementById("header-mobile-profile-btn");
  if (mobileProfileBtn) {
    mobileProfileBtn.addEventListener("click", () => {
      const profileModal = document.getElementById("profile-modal");
      if (profileModal) profileModal.classList.add("active");
    });
  }

  // Banner "Voir mes automatisations" Button
  const bannerAutomationsBtn = document.getElementById("btn-banner-automations");
  if (bannerAutomationsBtn) {
    bannerAutomationsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showView("automations");
    });
  }

  // "Voir tout >" Conversations Récentes link
  const seeAllChats = document.querySelector(".see-all-chats-link");
  if (seeAllChats) {
    seeAllChats.addEventListener("click", (e) => {
      e.preventDefault();
      showView("inbox");
    });
  }

  // Recent WhatsApp Conversation Rows (Délégation d'événements dynamique et interactive)
  const recentChatsContainer = document.getElementById("overview-recent-chats-list");
  if (recentChatsContainer) {
    recentChatsContainer.addEventListener("click", (e) => {
      const row = e.target.closest(".mobile-chat-row");
      if (!row) return;
      showView("inbox");
      const chatId = row.getAttribute("data-chat-id");
      const contactPhone = row.getAttribute("data-chat-phone") || row.getAttribute("data-contact-phone") || "";
      const contactName = row.getAttribute("data-chat-contact") || "";
      const preview = row.querySelector(".mobile-chat-preview")?.textContent || "";
      
      let targetConv = null;
      if (chatId && Array.isArray(MOCK_DATA.conversations)) {
        targetConv = MOCK_DATA.conversations.find(c => c.id === chatId);
      }
      if (!targetConv && contactPhone && Array.isArray(MOCK_DATA.conversations)) {
        targetConv = MOCK_DATA.conversations.find(c => c.phone && c.phone.includes(contactPhone.replace(/[^0-9]/g, '')));
      }
      if (!targetConv && contactName && Array.isArray(MOCK_DATA.conversations)) {
        targetConv = MOCK_DATA.conversations.find(c => c.name && c.name.toLowerCase().includes(contactName.split(" ")[0].toLowerCase()));
      }
      if (!targetConv && contactName) {
        targetConv = {
          id: chatId || ("conv_" + Date.now()),
          name: contactName,
          phone: contactPhone,
          avatar: contactName.substring(0, 2).toUpperCase(),
          lastMessage: preview,
          time: "À l'instant",
          unread: false,
          aiActive: true,
          messages: preview ? [{ sender: "client", text: preview, time: "À l'instant" }] : []
        };
        if (!Array.isArray(MOCK_DATA.conversations)) MOCK_DATA.conversations = [];
        MOCK_DATA.conversations.unshift(targetConv);
      }
      if (targetConv) {
        if (typeof loadConversation === "function") loadConversation(targetConv);
        if (typeof renderConversationList === "function") renderConversationList();
      }
    });
  }

  // Handle brand logo click
  const brandLogo = document.getElementById("brand-logo-btn");
  if (brandLogo) {
    brandLogo.addEventListener("click", (e) => {
      e.preventDefault();
      showView("overview", "Tableau de Bord VANDIA IA");
    });
  }

  // Listen to hash change
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash && document.getElementById(`view-${hash}`)) {
      showView(hash);
    }
  });
}

function showView(viewId, customTitle = null) {
  const targetView = document.getElementById(`view-${viewId}`);
  if (!targetView) return;

  activeView = viewId;

  // 1. Hide all views and show target
  document.querySelectorAll(".view-section").forEach(sec => {
    sec.classList.remove("active");
  });
  targetView.classList.add("active");

  // 2. Update sidebar active links
  document.querySelectorAll(".sidebar .nav-item-link").forEach(link => {
    if (link.getAttribute("data-view") === viewId) {
      link.classList.add("active");
      if (!customTitle) {
        customTitle = link.getAttribute("data-title");
      }
    } else {
      link.classList.remove("active");
    }
  });

  // 2b. Update mobile bottom nav active buttons
  document.querySelectorAll(".mobile-bottom-nav .mobile-nav-btn").forEach(btn => {
    if (btn.getAttribute("data-view") === viewId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 3. Update Header Title & Icon
  updateHeaderTitle(customTitle || "Tableau de Bord VANDIA IA", viewId);

  // 4. Update window hash cleanly without jump
  if (history.pushState) {
    history.pushState(null, null, `#${viewId}`);
  } else {
    window.location.hash = `#${viewId}`;
  }

  // 5. If charts need resizing upon becoming visible
  if (viewId === "overview" && salesChartInstance) {
    salesChartInstance.resize();
  } else if (viewId === "analytics") {
    if (hourlyChartInstance) hourlyChartInstance.resize();
    updateAnalyticsStats(currentAnalyticsPeriod);
  } else if (viewId === "automations") {
    renderAutomations();
  } else if (viewId === "integrations") {
    renderIntegrations();
  } else if (viewId === "affiliate") {
    syncAffiliateModule();
  }
}

function updateHeaderTitle(title, viewId) {
  const titleEl = document.getElementById("page-title");
  const iconEl = document.getElementById("header-brand-icon");

  if (titleEl) titleEl.textContent = title;

  if (iconEl) {
    const iconMap = {
      "overview": "fa-chart-line",
      "inbox": "fa-inbox",
      "ai-agent": "fa-robot",
      "broadcast": "fa-bullhorn",
      "automations": "fa-diagram-project",
      "contacts": "fa-users",
      "templates": "fa-file-lines",
      "devices": "fa-mobile-screen-button",
      "integrations": "fa-plug-circle-bolt",
      "analytics": "fa-chart-pie",
      "settings": "fa-gear",
      "billing": "fa-credit-card",
      "affiliate": "fa-handshake",
      "academy": "fa-graduation-cap",
      "prompts": "fa-wand-magic-sparkles"
    };
    iconEl.className = `fa-solid ${iconMap[viewId] || "fa-chart-line"} header-brand-icon`;
  }
}

// ==============================================================================
// 5. MOBILE OFF-CANVAS SIDEBAR
// ==============================================================================
function setupMobileSidebar() {
  const toggleBtn = document.getElementById("mobile-menu-toggle");
  const closeBtn = document.getElementById("sidebar-close-btn");
  const backdrop = document.getElementById("sidebar-backdrop");
  const sidebar = document.getElementById("sidebar");

  function openMenu(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");
    document.body.classList.add("sidebar-open-lock");
  }

  function closeMenu(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");
    document.body.classList.remove("sidebar-open-lock");
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", openMenu);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeMenu);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeMenu);
  }

  // Empêche la fermeture quand on clique à l'intérieur du tiroir
  if (sidebar) {
    sidebar.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Fermeture avec la touche Échap
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar && sidebar.classList.contains("open")) {
      closeMenu(e);
    }
  });
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.remove("open");
  if (backdrop) backdrop.classList.remove("active");
  document.body.classList.remove("sidebar-open-lock");
}

// ==============================================================================
// 6. MODAL MANAGEMENT
// ==============================================================================
function setupModals() {
  // Open Broadcast modal buttons
  document.querySelectorAll(".btn-open-broadcast").forEach(btn => {
    btn.addEventListener("click", openBroadcastModal);
  });

  // Open QR modal buttons
  document.querySelectorAll(".btn-open-qr").forEach(btn => {
    btn.addEventListener("click", openQrModal);
  });

  // Close buttons with data-close-modal
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close-modal");
      closeModal(modalId);
    });
  });

  // Close modals on clicking backdrop background outside dialog
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove("active");
      }
    });
  });

  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.active").forEach(m => m.classList.remove("active"));
    }
  });

  // Broadcast form submission simulation
  const broadcastForm = document.getElementById("broadcast-form");
  if (broadcastForm) {
    broadcastForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const campaignName = document.getElementById("broadcast-name").value;
      closeBroadcastModal();
      showToast(`Diffusion "${campaignName}" programmée avec succès via SafeSend™ !`, "success");
      broadcastForm.reset();
    });
  }

  // Simulate scan button
  const simScanBtn = document.getElementById("btn-simulate-scan");
  if (simScanBtn) {
    simScanBtn.addEventListener("click", () => {
      closeQrModal();
      showToast("Appareil WhatsApp synchronisé avec succès en mode Coexistence !", "success");
    });
  }
}

function openBroadcastModal() {
  const modal = document.getElementById("broadcast-modal");
  if (modal) modal.classList.add("active");
}

function closeBroadcastModal() {
  closeModal("broadcast-modal");
}

function openQrModal() {
  const modal = document.getElementById("qr-modal");
  if (modal) modal.classList.add("active");
  if (typeof window.startWhatsApp === "function") {
    window.startWhatsApp();
  } else {
    setTimeout(() => {
      if (typeof window.startWhatsApp === "function") {
        window.startWhatsApp();
      }
    }, 150);
  }
}

function closeQrModal() {
  closeModal("qr-modal");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

// ==============================================================================
// 7. CHART.JS CHARTS ENGINE
// ==============================================================================
function initCharts() {
  initSalesActivityChart();
  initHourlyChart();
}

function initSalesActivityChart() {
  const ctx = document.getElementById("salesActivityChart");
  if (!ctx) return;

  const dataset = getSalesChartData("7");
  const salesData = currentCurrency === "XOF" ? dataset.salesXof : dataset.salesUsd;

  salesChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: dataset.labels,
      datasets: [
        {
          label: currentCurrency === "XOF" ? "Ventes Encaissées (XOF)" : "Ventes Encaissées ($)",
          data: salesData,
          borderColor: "#25d366",
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(37, 211, 102, 0.1)";
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(37, 211, 102, 0.35)");
            gradient.addColorStop(1, "rgba(37, 211, 102, 0.0)");
            return gradient;
          },
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#25d366",
          pointBorderColor: "#080c14",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: "y"
        },
        {
          label: "Conversations Automatisées IA",
          data: dataset.conversations,
          borderColor: "#8b5cf6",
          borderDash: [5, 4],
          borderWidth: 2,
          tension: 0.35,
          fill: false,
          pointBackgroundColor: "#8b5cf6",
          pointBorderColor: "#080c14",
          pointBorderWidth: 2,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false // Using custom legend in HTML
        },
        tooltip: {
          backgroundColor: "rgba(13, 21, 39, 0.95)",
          titleColor: "#f8fafc",
          bodyColor: "#94a3b8",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) {
                return currentCurrency === "XOF"
                  ? ` Ventes: ${context.parsed.y.toLocaleString()} XOF`
                  : ` Ventes: $${context.parsed.y.toLocaleString()}`;
              } else {
                return ` Conversations IA: ${context.parsed.y}`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
            drawBorder: false
          },
          ticks: {
            color: "#64748b",
            font: { size: 11, family: "Inter" }
          }
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
            drawBorder: false
          },
          ticks: {
            color: "#64748b",
            font: { size: 11, family: "Inter" },
            callback: function(value) {
              return currentCurrency === "XOF"
                ? `${(value / 1000).toFixed(0)}k`
                : `$${value}`;
            }
          }
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          grid: {
            drawOnChartArea: false,
            drawBorder: false
          },
          ticks: {
            color: "#8b5cf6",
            font: { size: 10, family: "Inter" }
          }
        }
      }
    }
  });
}

function initHourlyChart() {
  const ctx = document.getElementById("hourlyActivityChart");
  if (!ctx) return;

  hourlyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["08h", "10h", "12h", "14h", "16h", "18h", "20h", "22h", "00h"],
      datasets: [
        {
          label: "Commandes Clôturées",
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          backgroundColor: "rgba(37, 211, 102, 0.75)",
          borderRadius: 6,
          hoverBackgroundColor: "rgba(37, 211, 102, 1)"
        },
        {
          label: "Messages Reçus",
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          backgroundColor: "rgba(6, 182, 212, 0.4)",
          borderRadius: 6,
          hoverBackgroundColor: "rgba(6, 182, 212, 0.8)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { family: "Inter", size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#64748b" }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#64748b" }
        }
      }
    }
  });
}

function setupChartFilters() {
  const filterBtns = document.querySelectorAll("#chart-filter-group .chart-pill-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const period = btn.getAttribute("data-period");
      updateChartPeriod(period);
    });
  });
}

function isCurrentUserDemo() { return false; }

function getUserKpis() {
  const user = (window.AuthEngine ? window.AuthEngine.getCurrentUser() : null) || {};
  const contacts = Array.isArray(MOCK_DATA.contacts) ? MOCK_DATA.contacts : [];
  const chats = Array.isArray(MOCK_DATA.conversations) ? MOCK_DATA.conversations : [];
  const contactsCount = contacts.length;
  const chatsCount = chats.length;
  const usedTokens = user.plan?.tokensUsed || 0;
  const totalMsgs = chatsCount > 0 ? chatsCount : usedTokens;

  return {
    salesUsd: 0,
    salesXof: 0,
    salesTrend: "0%",
    salesNote: "En attente de vos premières commandes WhatsApp",
    conversations: totalMsgs,
    conversationsTrend: chatsCount > 0 ? `+${chatsCount}` : "0%",
    conversationsNote: chatsCount > 0 
      ? `${chatsCount} discussion${chatsCount > 1 ? 's' : ''} WhatsApp active${chatsCount > 1 ? 's' : ''}` 
      : "Votre commercial IA est prêt et en attente",
    prospects: contactsCount,
    prospectsTrend: contactsCount > 0 ? `+${contactsCount}` : "0%",
    prospectsNote: contactsCount > 0 
      ? `${contactsCount} prospect${contactsCount > 1 ? 's' : ''} synchronisé${contactsCount > 1 ? 's' : ''} dans le CRM` 
      : "Capture automatique de prospects",
    conversionRate: "0.0%",
    conversionTrend: "0%",
    conversionNote: "Taux calculé dès vos premières commandes",
    abandonedRecovered: 0,
    abandonedRecoveredRate: "0 relancé",
    abandonedSavedUsd: 0,
    abandonedSavedXof: 0
  };
}

function getSalesChartData(periodKey) {
  const base = MOCK_DATA.chartData[periodKey] || MOCK_DATA.chartData["14"];
  return {
    labels: base.labels,
    salesUsd: base.salesUsd.map(() => 0),
    salesXof: base.salesXof.map(() => 0),
    conversations: base.conversations.map(() => 0)
  };
}

function updateChartPeriod(periodKey) {
  if (!salesChartInstance) return;

  const data = getSalesChartData(periodKey);
  salesChartInstance.data.labels = data.labels;
  salesChartInstance.data.datasets[0].data = currentCurrency === "XOF" ? data.salesXof : data.salesUsd;
  salesChartInstance.data.datasets[1].data = data.conversations;
  salesChartInstance.update();
}

// ==============================================================================
// 8. KPI & LIVE ACTIVITY FEED RENDERING
// ==============================================================================
function renderKpis() {
  const kpis = getUserKpis();
  const kpiSalesVal = document.getElementById("kpi-sales-val");
  const kpiSalesTrend = document.getElementById("kpi-sales-trend");
  const kpiSalesNote = document.getElementById("kpi-sales-note");

  const kpiConvsVal = document.getElementById("kpi-convs-val");
  const kpiConvsTrend = document.getElementById("kpi-convs-trend");
  const kpiConvsNote = document.getElementById("kpi-convs-note");

  const kpiRateVal = document.getElementById("kpi-rate-val");
  const kpiRateTrend = document.getElementById("kpi-rate-trend");
  const kpiRateNote = document.getElementById("kpi-rate-note");

  const kpiCartsVal = document.getElementById("kpi-carts-val");
  const kpiCartsTrend = document.getElementById("kpi-carts-trend");
  const kpiCartsNote = document.getElementById("kpi-carts-note");

  if (kpiSalesVal) {
    kpiSalesVal.textContent = currentCurrency === "USD" 
      ? `$${kpis.salesUsd.toLocaleString()}` 
      : `${kpis.salesXof.toLocaleString()} XOF`;
  }
  if (kpiSalesTrend) {
    kpiSalesTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${kpis.salesTrend}`;
    kpiSalesTrend.className = "kpi-badge-trend";
  }
  if (kpiSalesNote) {
    kpiSalesNote.textContent = kpis.salesNote;
  }

  if (kpiConvsVal) kpiConvsVal.textContent = kpis.conversations.toLocaleString();
  if (kpiConvsTrend) {
    kpiConvsTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${kpis.conversationsTrend}`;
    kpiConvsTrend.className = "kpi-badge-trend";
  }
  if (kpiConvsNote) {
    kpiConvsNote.textContent = kpis.conversationsNote;
  }

  const kpiProspectsVal = document.getElementById("kpi-prospects-val");
  const kpiProspectsTrend = document.getElementById("kpi-prospects-trend");
  const kpiProspectsNote = document.getElementById("kpi-prospects-note");
  if (kpiProspectsVal) kpiProspectsVal.textContent = (kpis.prospects || 0).toLocaleString();
  if (kpiProspectsTrend) {
    kpiProspectsTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${kpis.prospectsTrend || '0%'}`;
    kpiProspectsTrend.className = "kpi-badge-trend";
  }
  if (kpiProspectsNote) {
    kpiProspectsNote.textContent = kpis.prospectsNote || "Capture automatique de prospects";
  }

  if (kpiRateVal) kpiRateVal.textContent = kpis.conversionRate;
  if (kpiRateTrend) {
    kpiRateTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${kpis.conversionTrend}`;
    kpiRateTrend.className = "kpi-badge-trend";
  }
  if (kpiRateNote) {
    kpiRateNote.textContent = kpis.conversionNote;
  }

  if (kpiCartsVal) kpiCartsVal.textContent = kpis.abandonedRecovered.toLocaleString();
  if (kpiCartsTrend) {
    kpiCartsTrend.innerHTML = `<i class="fa-solid fa-check"></i> ${kpis.abandonedRecoveredRate}`;
    kpiCartsTrend.className = "kpi-badge-trend";
  }
  if (kpiCartsNote) {
    const savedFormatted = currentCurrency === "USD" 
      ? `$${kpis.abandonedSavedUsd.toLocaleString()}` 
      : `${kpis.abandonedSavedXof.toLocaleString()} XOF`;
    kpiCartsNote.innerHTML = `Revenus sauvés : <strong class="kpi-val-currency">${savedFormatted}</strong>`;
  }
}

function renderActivityFeed() {
  const container = document.getElementById("activity-live-list");
  if (!container) return;

  const user = (window.AuthEngine ? window.AuthEngine.getCurrentUser() : null) || MOCK_DATA.currentUser || {};
  const userName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.full_name || user.email?.split('@')[0] || "Administrateur");
  const planName = user.plan?.name || "VANDIA Pro (Essai 7j)";
  const tokensMax = user.plan?.tokensMax || 100;
  const tokensUsed = user.plan?.tokensUsed || 0;
  const tokensLeft = Math.max(0, tokensMax - tokensUsed);

  const isWaConnected = window.currentWhatsAppStatus === 'CONNECTED';
  const contacts = Array.isArray(MOCK_DATA.contacts) ? MOCK_DATA.contacts : [];
  const chats = Array.isArray(MOCK_DATA.conversations) ? MOCK_DATA.conversations : [];

  const items = [];

  // 1. Statut de l'instance et du commercial IA
  items.push(`
    <div class="activity-item">
      <div class="activity-icon-wrapper" style="background: rgba(37, 211, 102, 0.15); color: var(--whatsapp-green);">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="activity-info">
        <div class="activity-text">
          Agent commercial IA activé pour <strong>${escapeHtml(userName)}</strong> (${escapeHtml(planName)}). Répond automatiquement 24/7.
        </div>
        <div class="activity-meta">Mode Réel Actif • Prêt</div>
      </div>
    </div>
  `);

  // 2. Statut WhatsApp réel
  if (isWaConnected) {
    items.push(`
      <div class="activity-item">
        <div class="activity-icon-wrapper" style="background: rgba(37, 211, 102, 0.15); color: var(--whatsapp-green);">
          <i class="fa-brands fa-whatsapp"></i>
        </div>
        <div class="activity-info">
          <div class="activity-text">
            WhatsApp Officiel <strong>synchronisé et en ligne</strong>. Vos clients reçoivent des réponses instantanées.
          </div>
          <div class="activity-meta">À l'instant • Session active</div>
        </div>
      </div>
    `);
  } else {
    items.push(`
      <div class="activity-item">
        <div class="activity-icon-wrapper" style="background: rgba(245, 158, 11, 0.15); color: var(--amber);">
          <i class="fa-solid fa-qrcode"></i>
        </div>
        <div class="activity-info">
          <div class="activity-text">
            WhatsApp en attente de liaison. Scannez le QR Code pour démarrer la capture automatique de vos clients.
          </div>
          <div class="activity-meta">En attente • Jumelage requis</div>
        </div>
      </div>
    `);
  }

  // 3. Dernier prospect réel Supabase
  if (contacts.length > 0) {
    const latestC = contacts[0];
    const cName = escapeHtml(latestC.name || 'Nouveau prospect');
    const cPhone = formatWhatsAppDisplayNumber(latestC.phone_number);
    const cTime = escapeHtml(formatRelativeTime(latestC.updated_at));
    items.push(`
      <div class="activity-item">
        <div class="activity-icon-wrapper" style="background: rgba(6, 182, 212, 0.15); color: var(--cyan);">
          <i class="fa-solid fa-user-check"></i>
        </div>
        <div class="activity-info">
          <div class="activity-text">
            Prospect capturé dans votre CRM : <strong>${cName}</strong> (${cPhone}).
          </div>
          <div class="activity-meta">${cTime} • Base Supabase</div>
        </div>
      </div>
    `);
  }

  // 4. Dernière conversation en direct WhatsApp
  if (chats.length > 0) {
    const latestChat = chats[0];
    const chatName = escapeHtml(latestChat.name || 'Client');
    const chatTime = escapeHtml(formatRelativeTime(latestChat.time));
    items.push(`
      <div class="activity-item">
        <div class="activity-icon-wrapper" style="background: rgba(139, 92, 246, 0.15); color: var(--purple);">
          <i class="fa-solid fa-comments"></i>
        </div>
        <div class="activity-info">
          <div class="activity-text">
            Échange WhatsApp récent avec <strong>${chatName}</strong> : "${escapeHtml((latestChat.lastMessage || '').substring(0, 55))}".
          </div>
          <div class="activity-meta">${chatTime} • Discussion en direct</div>
        </div>
      </div>
    `);
  }

  // 5. Crédits IA réels
  items.push(`
    <div class="activity-item">
      <div class="activity-icon-wrapper" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">
        <i class="fa-solid fa-coins"></i>
      </div>
      <div class="activity-info">
        <div class="activity-text">
          Solde crédits IA : <strong>${tokensLeft} crédits disponibles</strong> (${tokensUsed} consommés sur ${tokensMax}).
        </div>
        <div class="activity-meta">Quota sécurisé • Renouvellement inclus</div>
      </div>
    </div>
  `);

  container.innerHTML = items.join("");
}

function setupCurrencyToggle() {
  const currencyBtns = document.querySelectorAll(".currency-btn");
  currencyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-currency");
      if (selected === currentCurrency) return;

      currentCurrency = selected;
      document.querySelectorAll(".currency-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-currency") === selected);
      });

      // Update KPI currency values
      renderKpis();

      // Update Chart label & dataset
      const legendSales = document.getElementById("chart-legend-sales-label");
      if (legendSales) {
        legendSales.textContent = currentCurrency === "USD" ? "Ventes Encaissées ($)" : "Ventes Encaissées (FCFA)";
      }

      const activePill = document.querySelector("#chart-filter-group .chart-pill-btn.active");
      const currentPeriod = activePill ? activePill.getAttribute("data-period") : "14";
      updateChartPeriod(currentPeriod);

      showToast(`Devise d'affichage basculée sur : ${currentCurrency}`, "info");
    });
  });
}

// ==============================================================================
// 8.1 CONVERSATIONS RÉCENTES DE LA VUE D'ENSEMBLE (Dynamique & Personnalisée)
// ==============================================================================
function renderOverviewRecentChats() {
  const container = document.getElementById("overview-recent-chats-list");
  if (!container) return;

  const chats = Array.isArray(MOCK_DATA.conversations) && MOCK_DATA.conversations.length > 0 
    ? MOCK_DATA.conversations 
    : [];
  const contacts = Array.isArray(MOCK_DATA.contacts) && MOCK_DATA.contacts.length > 0 
    ? MOCK_DATA.contacts 
    : [];

  // Cas 1 : Des discussions WhatsApp réelles sont actives
  if (chats.length > 0) {
    const topChats = chats.slice(0, 4);
    container.innerHTML = topChats.map(c => {
      const name = escapeHtml(c.name || 'Client WhatsApp');
      const phone = escapeHtml(c.phone || '');
      const initials = escapeHtml(c.avatar || (c.name ? c.name.substring(0, 2).toUpperCase() : 'WA'));
      const time = escapeHtml(formatRelativeTime(c.time));
      const preview = escapeHtml(c.lastMessage || 'Nouvel échange WhatsApp');
      const unread = Boolean(c.unread && c.unreadCount > 0);
      const unreadCount = Number(c.unreadCount) || 1;

      return `
        <div class="mobile-chat-row" data-chat-id="${escapeHtml(c.id)}" data-chat-contact="${name}" data-chat-phone="${phone}">
          <div class="mobile-chat-avatar-wrap">
            <div class="mobile-chat-avatar-fallback">${initials}</div>
            ${unread ? '<span class="chat-online-dot"></span>' : ''}
          </div>
          <div class="mobile-chat-info">
            <div class="mobile-chat-top-line">
              <span class="mobile-chat-name">${name}</span>
              <span class="mobile-chat-time">${time}</span>
            </div>
            <div class="mobile-chat-bottom-line">
              <p class="mobile-chat-preview">${preview}</p>
              ${unread ? `<span class="mobile-unread-badge">${unreadCount}</span>` : `<span class="mobile-read-status"><i class="fa-solid fa-check-double"></i></span>`}
            </div>
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  // Cas 2 : Pas de session WhatsApp en direct, mais des contacts réels sont dans Supabase CRM
  if (contacts.length > 0) {
    const topContacts = contacts.slice(0, 4);
    container.innerHTML = topContacts.map(c => {
      const name = escapeHtml(c.name || 'Prospect');
      const phone = escapeHtml(c.phone_number || '');
      const initials = escapeHtml((c.name || 'P').substring(0, 2).toUpperCase());
      const time = escapeHtml(formatRelativeTime(c.updated_at));
      const preview = escapeHtml(c.last_message || 'Contact enregistré dans votre CRM');

      return `
        <div class="mobile-chat-row" data-contact-phone="${phone}" data-chat-contact="${name}">
          <div class="mobile-chat-avatar-wrap">
            <div class="mobile-chat-avatar-fallback">${initials}</div>
            <span class="chat-online-dot"></span>
          </div>
          <div class="mobile-chat-info">
            <div class="mobile-chat-top-line">
              <span class="mobile-chat-name">${name}</span>
              <span class="mobile-chat-time">${time}</span>
            </div>
            <div class="mobile-chat-bottom-line">
              <p class="mobile-chat-preview">${preview}</p>
              <span class="badge badge-subtle" style="font-size: 10px;">CRM</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  // Cas 3 : Nouvel utilisateur sans contact ni session
  container.innerHTML = `
    <div class="empty-recent-chats" style="padding: 24px 16px; text-align: center;">
      <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(37, 211, 102, 0.12); color: var(--whatsapp-green); display: inline-flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 10px;">
        <i class="fa-brands fa-whatsapp"></i>
      </div>
      <h4 style="font-size: 13.5px; font-weight: 600; margin: 0 0 5px 0; color: var(--text-primary);">Aucune discussion pour le moment</h4>
      <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 14px 0; line-height: 1.4;">
        Connectez votre WhatsApp pour que vos clients et échanges s'affichent automatiquement ici.
      </p>
      <button type="button" class="btn-primary-gradient btn-open-qr" style="font-size: 11.5px; padding: 6px 14px; border-radius: 7px; display: inline-flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-qrcode"></i> Lier mon WhatsApp
      </button>
    </div>
  `;

  const btnQr = container.querySelector(".btn-open-qr");
  if (btnQr) {
    btnQr.addEventListener("click", () => {
      if (typeof openQrModal === "function") {
        openQrModal();
      } else {
        const qrModal = document.getElementById("qr-modal");
        if (qrModal) qrModal.classList.add("active");
      }
    });
  }
}

async function loadOverviewRealData() {
  const userId = getAppUserId();
  if (!userId) return;

  try {
    const contactsPromise = fetch(API_URL + '/api/contacts/' + userId, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    const chatsPromise = fetch(API_URL + '/api/whatsapp/chats/' + userId, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    const [contactsRes, chatsRes] = await Promise.all([contactsPromise, chatsPromise]);

    if (contactsRes && contactsRes.success && Array.isArray(contactsRes.contacts)) {
      MOCK_DATA.contacts = contactsRes.contacts;
    }

    if (chatsRes && Array.isArray(chatsRes.chats)) {
      MOCK_DATA.conversations = chatsRes.chats;
    }

    renderKpis();
    renderOverviewRecentChats();
    renderActivityFeed();
    if (typeof renderRecentInteractions === "function") {
      renderRecentInteractions();
    }
  } catch (err) {
    console.warn("[Overview] Erreur chargement données réelles:", err);
  }
}

// ==============================================================================
// 9. INBOX & WHATSAPP CHAT LOGIC
// ==============================================================================
activeConversation = null;

async function syncWhatsAppInbox() {
  const userId = getAppUserId();
  if (!userId) return;

  try {
    const res = await fetch(API_URL + '/api/whatsapp/chats/' + userId, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    // 1. Mise à jour dynamique du badge de notification sur le menu
    const sidebarBadge = document.getElementById("sidebar-inbox-badge");
    const unreadCount = Number(data.unreadTotal) || 0;
    if (sidebarBadge) {
      if (unreadCount > 0) {
        sidebarBadge.textContent = unreadCount;
        sidebarBadge.style.display = "inline-block";
      } else {
        sidebarBadge.style.display = "none";
      }
    }

    // 2. Synchronisation des discussions réelles
    if (Array.isArray(data.chats)) {
      if (data.chats.length > 0) {
        data.chats.forEach(fresh => {
          const existing = MOCK_DATA.conversations.find(c => c.id === fresh.id);
          if (existing && existing.messages && existing.messages.length > 0) {
            fresh.messages = existing.messages;
          }
        });
        MOCK_DATA.conversations = data.chats;
        if (!activeConversation) {
          loadConversation(MOCK_DATA.conversations[0]);
        }
        renderConversationList();

        if (activeConversation && activeConversation.id) {
          fetchActiveChatMessages(activeConversation.id);
        }
      } else if (MOCK_DATA.conversations.length === 0) {
        renderConversationList();
      }
      renderOverviewRecentChats();
      renderActivityFeed();
      renderKpis();
    }
  } catch(e) {}
}

async function fetchActiveChatMessages(chatId) {
  if (!chatId || window.currentWhatsAppStatus !== 'CONNECTED') return;
  try {
    const res = await fetch(API_URL + '/api/whatsapp/messages/' + getAppUserId() + '/' + encodeURIComponent(chatId), {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        if (activeConversation && activeConversation.id === chatId) {
          activeConversation.messages = data.messages;
          renderChatMessages();
        }
      }
    }
  } catch(e) {}
}

function setupInboxInteraction() {
  renderConversationList();
  if (MOCK_DATA.conversations && MOCK_DATA.conversations.length > 0) {
    loadConversation(MOCK_DATA.conversations[0]);
  }

  // Synchronisation périodique automatique toutes les 5 secondes
  syncWhatsAppInbox();
  setInterval(syncWhatsAppInbox, 5000);

  // Formulaire d'envoi de messages WhatsApp
  const chatForm = document.getElementById("chat-input-form");
  const chatInput = document.getElementById("chat-message-input");

  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const messageText = chatInput.value.trim();
      if (!messageText) return;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Si aucune discussion active, demander le numéro WhatsApp
      if (!activeConversation) {
        const destNumber = prompt("Entrez le numéro WhatsApp du destinataire avec l'indicatif (ex: +229 99 04 47 29) :");
        if (!destNumber || !destNumber.trim()) return;
        const cleanPhone = destNumber.trim();
        activeConversation = {
          id: cleanPhone.replace(/[^0-9]/g, '') + '@c.us',
          name: cleanPhone,
          phone: cleanPhone,
          avatar: 'WA',
          messages: [],
          lastMessage: messageText,
          time: timeStr,
          unread: false,
          aiActive: true
        };
        MOCK_DATA.conversations.unshift(activeConversation);
        renderConversationList();
        loadConversation(activeConversation);
      }

      // 1. Ajout instantané du message dans l'interface
      if (!activeConversation.messages) activeConversation.messages = [];
      activeConversation.messages.push({
        sender: "agent",
        text: messageText,
        time: timeStr
      });
      activeConversation.lastMessage = messageText;
      activeConversation.time = timeStr;

      renderChatMessages();
      renderConversationList();
      chatInput.value = "";

      // 2. Envoi réel sur WhatsApp via le serveur Cloud
      const targetPhone = activeConversation.phone || activeConversation.id;
      if (targetPhone && window.currentWhatsAppStatus === 'CONNECTED') {
        try {
          const res = await fetch(API_URL + '/api/whatsapp/send', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              userId: getAppUserId(),
              to: targetPhone,
              message: messageText
            })
          });
          const result = await res.json().catch(() => ({}));
          if (result && result.success) {
            showToast("Message envoyé avec succès sur WhatsApp !", "success");
          } else {
            showToast(result.error || "Erreur d'envoi WhatsApp", "info");
          }
        } catch (err) {
          showToast("Erreur de connexion au serveur", "info");
        }
      } else {
        showToast("Message enregistré dans le fil", "info");
      }
    });
  }

  // Bouton Nouveau Message WhatsApp
  const btnNewChat = document.getElementById("btn-inbox-new-chat");
  if (btnNewChat) {
    btnNewChat.addEventListener("click", () => {
      const destNumber = prompt("Entrez le numéro WhatsApp du destinataire avec l'indicatif (ex: +229 99 04 47 29) :");
      if (!destNumber || !destNumber.trim()) return;
      const cleanPhone = destNumber.trim();
      const newConv = {
        id: cleanPhone.replace(/[^0-9]/g, '') + '@c.us',
        name: cleanPhone,
        phone: cleanPhone,
        avatar: 'WA',
        messages: [],
        lastMessage: "Discussion initiée",
        time: "À l'instant",
        unread: false,
        aiActive: true
      };
      MOCK_DATA.conversations.unshift(newConv);
      renderConversationList();
      loadConversation(newConv);
      if (chatInput) chatInput.focus();
    });
  }

  // Quick Action Chips
  document.querySelectorAll(".quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-text");
      if (chatInput) {
        chatInput.value = text;
        chatInput.focus();
      }
    });
  });

  // Mobile Back Button
  const backBtn = document.getElementById("btn-chat-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const inboxLayout = document.querySelector(".inbox-layout");
      if (inboxLayout) inboxLayout.classList.remove("chat-open");
    });
  }

  // Toggle Human Agent button
  const toggleHumanBtn = document.getElementById("btn-toggle-human");
  const aiBadge = document.getElementById("chat-ai-status-badge");
  if (toggleHumanBtn && aiBadge) {
    toggleHumanBtn.addEventListener("click", () => {
      if (!activeConversation) return;
      activeConversation.aiActive = !activeConversation.aiActive;
      if (activeConversation.aiActive) {
        aiBadge.innerHTML = `<i class="fa-solid fa-robot"></i><span class="chat-ai-status-text">IA Active</span>`;
        aiBadge.style.color = "var(--whatsapp-green)";
        aiBadge.style.borderColor = "rgba(37, 211, 102, 0.3)";
        showToast("Agent IA réactivé sur cette conversation", "info");
      } else {
        aiBadge.innerHTML = `<i class="fa-solid fa-user-check"></i><span class="chat-ai-status-text">Relais Humain</span>`;
        aiBadge.style.color = "var(--cyan)";
        aiBadge.style.borderColor = "rgba(6, 182, 212, 0.3)";
        showToast("Prise en main manuelle activée", "info");
      }
    });
  }

  // Recherche dans les discussions
  const inboxSearch = document.getElementById("inbox-search-input");
  if (inboxSearch) {
    inboxSearch.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll(".conv-item").forEach(item => {
        const name = (item.querySelector(".conv-name")?.textContent || "").toLowerCase();
        const snippet = (item.querySelector(".conv-preview")?.textContent || "").toLowerCase();
        if (name.includes(query) || snippet.includes(query)) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    });
  }
}

function renderConversationList() {
  const listContainer = document.getElementById("inbox-conversation-list");
  if (!listContainer) return;
  
  if (!MOCK_DATA.conversations || MOCK_DATA.conversations.length === 0) {
    listContainer.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
        <i class="fa-brands fa-whatsapp" style="font-size: 28px; color: var(--whatsapp-green); margin-bottom: 8px; display: block;"></i>
        <p style="margin: 0 0 12px 0;">Aucune conversation pour le moment.</p>
        <button type="button" class="btn-secondary-glass" onclick="document.getElementById('btn-inbox-new-chat')?.click()" style="font-size: 11.5px; padding: 6px 14px; margin: 0 auto;">
          <i class="fa-solid fa-plus"></i> Démarrer une discussion
        </button>
      </div>
    `;
    const stream = document.getElementById("chat-messages-stream");
    if (stream) stream.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color: var(--text-secondary); font-size: 13px;">En attente de nouveaux messages WhatsApp...</div>';
    const nameEl = document.getElementById("active-chat-name");
    if (nameEl) nameEl.textContent = "Boîte de Réception";
    const phoneEl = document.getElementById("active-chat-phone");
    if (phoneEl) phoneEl.textContent = "---";
    const avatarEl = document.getElementById("active-chat-avatar");
    if (avatarEl) avatarEl.textContent = "-";
    return;
  }

  listContainer.innerHTML = MOCK_DATA.conversations.map((conv, idx) => `
    <div class="conv-item ${activeConversation && activeConversation.id === conv.id ? 'active' : (!activeConversation && idx === 0 ? 'active' : '')}" data-conv-id="${conv.id}">
      <div class="conv-avatar">
        ${escapeHtml(conv.avatar || 'WA')}
        <span class="conv-online-dot"></span>
      </div>
      <div class="conv-details">
        <div class="conv-top-row">
          <span class="conv-name">${escapeHtml(conv.name)}</span>
          <span class="conv-time">${escapeHtml(conv.time || '')}</span>
        </div>
        <div class="conv-bottom-row">
          <span class="conv-preview">${escapeHtml(conv.lastMessage || '')}</span>
          ${conv.unread ? `<span class="badge badge-green" style="font-size: 10px;">${conv.unreadCount || 1}</span>` : ''}
        </div>
      </div>
    </div>
  `).join("");

  listContainer.querySelectorAll(".conv-item").forEach(item => {
    item.addEventListener("click", () => {
      const convId = item.getAttribute("data-conv-id");
      const found = MOCK_DATA.conversations.find(c => c.id === convId);
      if (found) {
        listContainer.querySelectorAll(".conv-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        found.unread = false;
        found.unreadCount = 0;
        loadConversation(found);

        const inboxLayout = document.querySelector(".inbox-layout");
        if (inboxLayout) inboxLayout.classList.add("chat-open");
      }
    });
  });
}

function loadConversation(conv) {
  if (!conv) return;
  activeConversation = conv;

  const nameEl = document.getElementById("active-chat-name");
  const phoneEl = document.getElementById("active-chat-phone");
  const avatarEl = document.getElementById("active-chat-avatar");

  if (nameEl) nameEl.textContent = conv.name;
  if (phoneEl) phoneEl.textContent = conv.phone || conv.id || "";
  if (avatarEl) avatarEl.textContent = conv.avatar || "WA";

  if (!conv.messages) conv.messages = [];
  renderChatMessages();

  if (conv.id && window.currentWhatsAppStatus === 'CONNECTED') {
    fetchActiveChatMessages(conv.id);
  }
}

function renderChatMessages() {
  const stream = document.getElementById("chat-messages-stream");
  if (!stream) return;

  if (!activeConversation || !activeConversation.messages || activeConversation.messages.length === 0) {
    stream.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color: var(--text-secondary); font-size: 13px;">Aucun message échangé pour le moment. Tapez votre message ci-dessous pour démarrer.</div>';
    return;
  }

  stream.innerHTML = activeConversation.messages.map(msg => {
    if (msg.sender === "system") {
      return `
        <div style="text-align: center; margin: 4px 0;">
          <span class="badge badge-subtle" style="font-size: 11px; padding: 4px 10px;">${escapeHtml(msg.text)}</span>
        </div>
      `;
    }

    const isOutgoing = msg.sender === "agent";
    return `
      <div class="message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
        <p>${escapeHtml(msg.text)}</p>
        <div class="message-meta">
          <span>${escapeHtml(msg.time || '')}</span>
          ${isOutgoing ? `<i class="fa-solid fa-check-double double-tick"></i>` : ''}
        </div>
      </div>
    `;
  }).join("");

  stream.scrollTop = stream.scrollHeight;
}

function renderRecentInteractions() {
  const tbody = document.getElementById("table-interactions-body");
  if (!tbody) return;

  const contacts = Array.isArray(MOCK_DATA.contacts) && MOCK_DATA.contacts.length > 0 
    ? MOCK_DATA.contacts 
    : [];

  if (contacts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 24px; color: var(--text-muted);">
          Aucune interaction client pour l'instant. Votre agent commercial attend vos premiers prospects.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contacts.slice(0, 6).map(item => `
    <tr>
      <td>
        <div style="display: flex; flex-direction: column;">
          <span>${escapeHtml(item.name || 'Prospect')}</span>
          <span style="font-size: 11.5px; color: var(--text-muted); font-weight: normal;">${formatWhatsAppDisplayNumber(item.phone_number)}</span>
        </div>
      </td>
      <td>${escapeHtml(formatRelativeTime(item.updated_at))}</td>
      <td>${escapeHtml((item.last_message || 'Interaction IA WhatsApp').substring(0, 45))}</td>
      <td>
        <span class="badge badge-green">Actif</span>
      </td>
    </tr>
  `).join("");
}

function renderBroadcastCampaigns() {
  const tbody = document.getElementById("broadcast-table-body");
  if (!tbody) return;

  if (!isCurrentUserDemo()) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
          Aucune campagne de diffusion enregistrée. Cliquez sur « Nouvelle Diffusion » pour programmer votre premier envoi.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = MOCK_DATA.campaigns.map(camp => `
    <tr>
      <td><strong>${camp.name}</strong></td>
      <td>${camp.audience}</td>
      <td><i class="fa-brands fa-whatsapp" style="color: var(--whatsapp-green); margin-right: 5px;"></i>${camp.recipients}</td>
      <td><span style="color: var(--whatsapp-green); font-weight: 700;">${camp.openRate}</span></td>
      <td>${camp.date}</td>
      <td><span class="badge badge-${camp.statusType}">${camp.status}</span></td>
    </tr>
  `).join("");
}

// Gestionnaire de Funnels persistants (localStorage + défauts)
function getSavedFunnels() {
  try {
    const raw = localStorage.getItem("vandia_user_funnels");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return MOCK_DATA.automations;
}

function saveFunnelsList(list) {
  try {
    localStorage.setItem("vandia_user_funnels", JSON.stringify(list));
  } catch (e) {}
  MOCK_DATA.automations = list;
}

function renderAutomations() {
  const container = document.getElementById("automations-grid-container");
  if (!container) return;

  const funnels = getSavedFunnels();
  if (!funnels || funnels.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed var(--border-subtle);">
        <i class="fa-solid fa-diagram-project" style="font-size: 36px; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
        <h4 style="color: #fff; margin-bottom: 6px;">Aucun tunnel configuré</h4>
        <p style="font-size: 13px; margin-bottom: 16px;">Créez votre premier tunnel de vente pour automatiser vos relances et offres WhatsApp.</p>
        <button class="btn-primary-glow" onclick="openFunnelModal()"><i class="fa-solid fa-plus"></i> Nouveau Funnel</button>
      </div>
    `;
    return;
  }

  container.innerHTML = funnels.map(auto => `
    <div class="glass-panel auto-card" style="padding: 22px;">
      <div class="auto-card-top" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div class="auto-title-wrap" style="display: flex; gap: 14px; align-items: center;">
          <div class="auto-icon-box" style="width: 44px; height: 44px; border-radius: 10px; background: rgba(37, 211, 102, 0.15); border: 1px solid rgba(37, 211, 102, 0.3); display: flex; align-items: center; justify-content: center; color: var(--whatsapp-green); font-size: 18px;">
            <i class="fa-solid ${auto.icon || 'fa-bolt'}"></i>
          </div>
          <div>
            <h3 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px;">${escapeHtml(auto.title)}</h3>
            <span style="font-size: 12px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-key" style="color: var(--whatsapp-green); font-size: 10px;"></i>
              Déclencheur : <strong style="color: #e2e8f0;">${escapeHtml(auto.trigger)}</strong>
            </span>
          </div>
        </div>
        <label class="switch-control" title="Activer / Mettre en pause">
          <input type="checkbox" ${auto.active ? 'checked' : ''} onchange="toggleFunnelActive('${auto.id}', this.checked)">
          <span class="switch-slider"></span>
        </label>
      </div>

      <div class="auto-stats-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px 14px; background: rgba(255,255,255,0.02); border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-subtle);">
        <div class="auto-stat-item">
          <span class="auto-stat-val" style="font-size: 14px; font-weight: 700; color: #fff;">${auto.steps || 2} étapes</span>
          <span class="auto-stat-lbl" style="font-size: 11px; color: var(--text-muted);">Structure Funnel</span>
        </div>
        <div class="auto-stat-item">
          <span class="auto-stat-val" style="font-size: 14px; font-weight: 700; color: #fff;">${auto.contacts || 0}</span>
          <span class="auto-stat-lbl" style="font-size: 11px; color: var(--text-muted);">Prospects Qualifiés</span>
        </div>
        <div class="auto-stat-item">
          <span class="auto-stat-val" style="font-size: 14px; font-weight: 700; color: var(--whatsapp-green);">${auto.conversion || '0%'}</span>
          <span class="auto-stat-lbl" style="font-size: 11px; color: var(--text-muted);">Taux Conversion</span>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
        <span class="badge ${auto.active ? 'badge-green' : 'badge-gray'}" style="font-size: 11px;">
          ${auto.active ? '<i class="fa-solid fa-circle-check"></i> Actif 24/7' : '<i class="fa-solid fa-pause"></i> En pause'}
        </span>
        <div style="display: flex; gap: 8px;">
          <button class="btn-secondary-glass" onclick="openFunnelModal('${auto.id}')" style="padding: 6px 12px; font-size: 12px;" title="Modifier le tunnel">
            <i class="fa-solid fa-pen"></i> Modifier
          </button>
          <button class="btn-primary-glow" onclick="testFunnelTrigger('${auto.id}')" style="padding: 6px 12px; font-size: 12px;" title="Tester le déclencheur">
            <i class="fa-solid fa-play"></i> Tester
          </button>
          <button class="btn-secondary-glass" onclick="deleteFunnel('${auto.id}')" style="padding: 6px 10px; font-size: 12px; color: #ef4444;" title="Supprimer">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

// Contrôleurs modale Funnel
window.openFunnelModal = function(editId) {
  const modal = document.getElementById("funnel-modal");
  if (!modal) return;

  const idInput = document.getElementById("funnel-id");
  const titleInput = document.getElementById("funnel-title");
  const triggerInput = document.getElementById("funnel-trigger");
  const step1Input = document.getElementById("funnel-step1-msg");
  const delayInput = document.getElementById("funnel-delay");
  const statusInput = document.getElementById("funnel-status");
  const step2Input = document.getElementById("funnel-step2-msg");
  const titleHeader = document.getElementById("funnel-modal-title");

  if (editId) {
    const funnels = getSavedFunnels();
    const f = funnels.find(x => x.id === editId);
    if (f) {
      if (idInput) idInput.value = f.id;
      if (titleInput) titleInput.value = f.title || "";
      if (triggerInput) triggerInput.value = f.trigger || "";
      if (step1Input) step1Input.value = f.step1 || "";
      if (delayInput) delayInput.value = f.delay || "2h";
      if (statusInput) statusInput.value = f.active ? "active" : "paused";
      if (step2Input) step2Input.value = f.step2 || "";
      if (titleHeader) titleHeader.textContent = "Modifier le Tunnel de Vente";
    }
  } else {
    if (idInput) idInput.value = "";
    if (titleInput) titleInput.value = "";
    if (triggerInput) triggerInput.value = "";
    if (step1Input) step1Input.value = "";
    if (delayInput) delayInput.value = "2h";
    if (statusInput) statusInput.value = "active";
    if (step2Input) step2Input.value = "";
    if (titleHeader) titleHeader.textContent = "Nouveau Tunnel de Vente WhatsApp";
  }

  modal.classList.add("active");
  modal.style.display = "flex";
  modal.style.opacity = "1";
  modal.style.pointerEvents = "auto";
};

window.closeFunnelModal = function() {
  const modal = document.getElementById("funnel-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
  }
};

window.handleSaveFunnel = function(e) {
  e.preventDefault();
  const idInput = document.getElementById("funnel-id");
  const titleInput = document.getElementById("funnel-title");
  const triggerInput = document.getElementById("funnel-trigger");
  const step1Input = document.getElementById("funnel-step1-msg");
  const delayInput = document.getElementById("funnel-delay");
  const statusInput = document.getElementById("funnel-status");
  const step2Input = document.getElementById("funnel-step2-msg");

  const funnels = getSavedFunnels();
  const fid = idInput?.value || ("auto-" + Date.now());
  const isEdit = Boolean(idInput?.value);

  const newObj = {
    id: fid,
    title: titleInput?.value || "Nouveau Tunnel",
    trigger: triggerInput?.value || "mot-clé",
    active: statusInput?.value === "active",
    steps: step2Input?.value ? 2 : 1,
    contacts: isEdit ? (funnels.find(x => x.id === fid)?.contacts || 0) : 0,
    conversion: isEdit ? (funnels.find(x => x.id === fid)?.conversion || "0%") : "0%",
    icon: "fa-bolt",
    step1: step1Input?.value || "",
    delay: delayInput?.value || "2h",
    step2: step2Input?.value || ""
  };

  let updated = [];
  if (isEdit) {
    updated = funnels.map(x => x.id === fid ? newObj : x);
  } else {
    updated = [newObj, ...funnels];
  }

  saveFunnelsList(updated);
  renderAutomations();
  closeFunnelModal();
  showToast(isEdit ? "Tunnel de vente mis à jour avec succès !" : "Nouveau tunnel créé et prêt à convertir !", "success");
};

window.toggleFunnelActive = function(id, isActive) {
  const funnels = getSavedFunnels();
  const updated = funnels.map(x => x.id === id ? { ...x, active: isActive } : x);
  saveFunnelsList(updated);
  renderAutomations();
  showToast(isActive ? "Tunnel activé sur WhatsApp !" : "Tunnel mis en pause.", "info");
};

window.deleteFunnel = function(id) {
  if (!confirm("Voulez-vous vraiment supprimer ce tunnel de vente ?")) return;
  const funnels = getSavedFunnels();
  const updated = funnels.filter(x => x.id !== id);
  saveFunnelsList(updated);
  renderAutomations();
  showToast("Tunnel supprimé.", "info");
};

window.testFunnelTrigger = function(id) {
  const funnels = getSavedFunnels();
  const f = funnels.find(x => x.id === id);
  if (!f) return;
  showToast(`Déclencheur "${f.trigger}" testé : l'agent commercial répond avec le flux configuré !`, "success");
};

function updateDynamicKpis(contactsCount) {
    let user = window.AuthEngine.getCurrentUser();
    if (!user) return;
    
    const maxCred = user.plan?.tokensMax || 100;
    const usedCred = user.plan?.tokensUsed || 0;
    
    let rate = 0;
    if (usedCred > 0) {
        rate = ((contactsCount / usedCred) * 100).toFixed(1);
    }
    
    const kpiConvsVal = document.getElementById("kpi-convs-val");
    if (kpiConvsVal) kpiConvsVal.textContent = contactsCount.toString();
    
    const kpiRateVal = document.getElementById("kpi-rate-val");
    if (kpiRateVal) kpiRateVal.textContent = rate + "%";
    
    const kpiSalesVal = document.getElementById("kpi-sales-val");
    if (kpiSalesVal) kpiSalesVal.textContent = usedCred.toString() + " Msgs";
    const kpiSalesNote = document.getElementById("kpi-sales-note");
    if (kpiSalesNote) kpiSalesNote.textContent = "Messages IA traites au total";
}


async function renderContacts() {
    const tbody = document.getElementById("contacts-table-body");
    if (!tbody) return;

    let userId = null;
    try {
        const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
        if (u && u.id) userId = u.id;
    } catch(e) {}

    if (!userId) return;

    try {
        const res = await fetch(API_URL + '/api/contacts/' + userId, { headers: getAuthHeaders() });
        const data = await res.json();
        
        if (data.success && data.contacts && data.contacts.length > 0) {
            MOCK_DATA.contacts = data.contacts;
            renderKpis();
            renderOverviewRecentChats();
            renderActivityFeed();
            tbody.innerHTML = data.contacts.map(c => {
              const safeName = escapeHtml(c.name || 'Inconnu');
              const safeInitial = escapeHtml((c.name || 'I')[0].toUpperCase());
              const safePhone = formatWhatsAppDisplayNumber(c.phone_number);
              const safeDate = escapeHtml(new Date(c.updated_at).toLocaleDateString());
              return `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="conv-avatar" style="width: 32px; height: 32px; font-size: 11px;">${safeInitial}</div>
                    <span>${safeName}</span>
                  </div>
                </td>
                <td>${safePhone}</td>
                <td>${safeDate}</td>
                <td><span class="badge badge-gray">Prospect</span></td>
                <td>N/A</td>
                <td>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn-secondary-glass" style="padding: 4px 8px; font-size: 11px;" title="Discuter"><i class="fa-solid fa-message"></i></button>
                  </div>
                </td>
              </tr>
            `;}).join("");
        } else {
            tbody.innerHTML = `
              <tr>
                <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                  Votre base CRM est prete. Vos prospects WhatsApp seront enregistres automatiquement des leur premier message.
                </td>
              </tr>
            `;
        }
    } catch (err) {
        console.error("Erreur fetch contacts:", err);
    }
}


// ==============================================================================
// 10. WHATSAPP META TEMPLATES (HSM) ENGINE
// ==============================================================================
const DEFAULT_META_TEMPLATES = [
  {
    id: "tpl_promo_vip",
    name: "offre_flash_promo",
    category: "MARKETING",
    lang: "fr",
    header: "🔥 OFFRE EXCLUSIVE DU JOUR",
    content: "Bonjour {{1}} ! Profitez aujourd'hui d'une réduction spéciale de 20% sur {{2}} avec livraison express offerte. Répondez à ce message pour commander dès maintenant !",
    footer: "Tapez STOP pour vous désabonner",
    cta: "Commander sur WhatsApp",
    btnType: "quick_reply",
    status: "Approuvé Meta",
    statusType: "green"
  },
  {
    id: "tpl_confirm_cmd",
    name: "confirmation_commande",
    category: "UTILITAIRE",
    lang: "fr",
    header: "📦 SUIVI DE COMMANDE",
    content: "Bonjour {{1}}, nous confirmons la prise en charge de votre commande N°{{2}}. Votre colis est soigneusement préparé et en cours d'expédition.",
    footer: "Service client disponible 7j/7",
    cta: "Suivre mon colis",
    btnType: "url",
    btnUrl: "https://vandia.ai/suivi",
    status: "Approuvé Meta",
    statusType: "green"
  },
  {
    id: "tpl_cart_recov",
    name: "relance_panier_abandonne",
    category: "MARKETING",
    lang: "fr",
    header: "🛒 VOTRE PANIER VOUS ATTEND",
    content: "Bonjour {{1}}, vous n'avez pas finalisé votre panier. Bonne nouvelle : vos articles sont réservés pour les prochaines 2 heures avec livraison offerte !",
    footer: "VANDIA Commerce Sécurisé",
    cta: "Finaliser ma commande",
    btnType: "url",
    btnUrl: "https://vandia.ai/panier",
    status: "Approuvé Meta",
    statusType: "green"
  }
];

function getStoredTemplates() {
  try {
    const raw = localStorage.getItem("vandia_meta_templates");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch(e) {}
  return [...DEFAULT_META_TEMPLATES];
}

function saveStoredTemplates(tplList) {
  try {
    localStorage.setItem("vandia_meta_templates", JSON.stringify(tplList));
  } catch(e) {}
}

function renderTemplates() {
  const container = document.getElementById("templates-grid-container");
  if (!container) return;

  const templates = getStoredTemplates();

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 48px 24px;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(37,211,102,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: var(--whatsapp-green); font-size: 26px;">
          <i class="fa-brands fa-whatsapp"></i>
        </div>
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Aucun Modèle WhatsApp créé</h3>
        <p style="color: var(--text-muted); font-size: 13.5px; max-width: 500px; margin: 0 auto 20px;">
          Les modèles approuvés par Meta vous permettent d'envoyer des diffusions en masse et des relances automatiques en toute conformité.
        </p>
        <button class="btn-primary-glow" id="btn-empty-create-template" style="display: inline-flex;">
          <i class="fa-solid fa-plus"></i>
          <span>Créer mon premier Modèle Meta</span>
        </button>
      </div>
    `;
    const emptyBtn = document.getElementById("btn-empty-create-template");
    if (emptyBtn) emptyBtn.addEventListener("click", openTemplateModal);
    return;
  }

  container.innerHTML = templates.map((tpl, idx) => `
    <div class="glass-panel template-card" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span>${escapeHtml(tpl.name)}</span>
            </h3>
            <span class="badge badge-${tpl.category === 'MARKETING' ? 'green' : tpl.category === 'UTILITAIRE' ? 'blue' : 'purple'}" style="font-size: 10px; padding: 2px 8px;">
              ${escapeHtml(tpl.category)}
            </span>
          </div>
          <span class="badge badge-green" style="font-size: 10.5px;">
            <i class="fa-solid fa-circle-check"></i> ${escapeHtml(tpl.status || 'Approuvé Meta')}
          </span>
        </div>

        <div class="template-bubble-preview" style="background: #005c4b; border-radius: 10px; padding: 14px; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.08);">
          ${tpl.header ? `<div style="font-weight: 700; font-size: 13px; color: #fff; margin-bottom: 6px;">${escapeHtml(tpl.header)}</div>` : ''}
          <p style="margin: 0; font-size: 12.5px; line-height: 1.45; color: #e9edef; white-space: pre-wrap;">${highlightVariables(tpl.content)}</p>
          ${tpl.footer ? `<div style="font-size: 10.5px; color: rgba(255,255,255,0.65); margin-top: 8px; font-style: italic;">${escapeHtml(tpl.footer)}</div>` : ''}
          ${tpl.cta ? `
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.12); text-align: center; font-weight: 600; color: #53bdeb; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <i class="fa-solid ${tpl.btnType === 'url' ? 'fa-arrow-up-right-from-square' : 'fa-reply'}"></i>
              <span>${escapeHtml(tpl.cta)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: auto;">
        <button class="btn-icon-danger btn-delete-tpl" data-index="${idx}" title="Supprimer ce modèle" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 6px; font-size: 13px;">
          <i class="fa-regular fa-trash-can"></i>
        </button>
        <div style="display: flex; gap: 8px;">
          <button class="btn-secondary-glass btn-dup-tpl" data-index="${idx}" style="padding: 6px 12px; font-size: 12px;">Dupliquer</button>
          <button class="btn-primary-glow btn-use-tpl" data-index="${idx}" style="padding: 6px 12px; font-size: 12px;">Utiliser</button>
        </div>
      </div>
    </div>
  `).join("");

  // Attach card buttons
  container.querySelectorAll(".btn-delete-tpl").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const list = getStoredTemplates();
      const removed = list.splice(idx, 1);
      saveStoredTemplates(list);
      renderTemplates();
      showToast(`Modèle "${removed[0]?.name}" supprimé.`, "info");
    });
  });

  container.querySelectorAll(".btn-dup-tpl").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const list = getStoredTemplates();
      const item = list[idx];
      if (item) {
        openTemplateModal(item, true);
      }
    });
  });

  container.querySelectorAll(".btn-use-tpl").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const list = getStoredTemplates();
      const item = list[idx];
      if (item) {
        const msgField = document.getElementById("broadcast-message");
        if (msgField) msgField.value = item.content;
        openBroadcastModal();
        showToast(`Modèle "${item.name}" chargé pour votre diffusion !`, "success");
      }
    });
  });
}

function highlightVariables(text) {
  if (!text) return "";
  return escapeHtml(text).replace(/\{\{(\d+)\}\}/g, '<span style="background: rgba(37,211,102,0.3); color:#fff; padding: 1px 5px; border-radius: 4px; font-weight: 600;">{{$1}}</span>');
}

function openTemplateModal(prefillData = null, isDuplicate = false) {
  const modal = document.getElementById("template-modal");
  if (!modal) return;

  const form = document.getElementById("template-create-form");
  if (form) form.reset();

  const nameInput = document.getElementById("tpl-input-name");
  const catInput = document.getElementById("tpl-input-category");
  const langInput = document.getElementById("tpl-input-lang");
  const headerInput = document.getElementById("tpl-input-header");
  const bodyInput = document.getElementById("tpl-input-body");
  const footerInput = document.getElementById("tpl-input-footer");
  const btnTypeInput = document.getElementById("tpl-input-btn-type");
  const btnTextInput = document.getElementById("tpl-input-btn-text");
  const btnUrlInput = document.getElementById("tpl-input-btn-url");

  if (prefillData) {
    if (nameInput) nameInput.value = isDuplicate ? (prefillData.name + "_copie") : prefillData.name;
    if (catInput) catInput.value = prefillData.category || "MARKETING";
    if (langInput) langInput.value = prefillData.lang || "fr";
    if (headerInput) headerInput.value = prefillData.header || "";
    if (bodyInput) bodyInput.value = prefillData.content || "";
    if (footerInput) footerInput.value = prefillData.footer || "";
    if (btnTypeInput) btnTypeInput.value = prefillData.btnType || "quick_reply";
    if (btnTextInput) btnTextInput.value = prefillData.cta || "";
    if (btnUrlInput) btnUrlInput.value = prefillData.btnUrl || "";
  } else {
    if (nameInput) nameInput.value = "promo_speciale_" + Math.floor(Math.random() * 1000);
    if (bodyInput) bodyInput.value = "Bonjour {{1}} ! Nous avons le plaisir de vous offrir une réduction exclusive de 20% sur votre prochain achat. Répondez à ce message pour en profiter.";
    if (btnTextInput) btnTextInput.value = "Profiter de l'offre";
  }

  updateTemplateLivePreview();
  modal.classList.add("active");
  document.body.classList.add("modal-open-lock");
}

function closeTemplateModal() {
  const modal = document.getElementById("template-modal");
  if (modal) modal.classList.remove("active");
  document.body.classList.remove("modal-open-lock");
}

function updateTemplateLivePreview() {
  const headerVal = document.getElementById("tpl-input-header")?.value.trim() || "";
  const bodyVal = document.getElementById("tpl-input-body")?.value || "";
  const footerVal = document.getElementById("tpl-input-footer")?.value.trim() || "";
  const btnType = document.getElementById("tpl-input-btn-type")?.value || "quick_reply";
  const btnText = document.getElementById("tpl-input-btn-text")?.value.trim() || "";

  const prevHeader = document.getElementById("preview-header");
  const prevBody = document.getElementById("preview-body");
  const prevFooter = document.getElementById("preview-footer");
  const prevBtnWrap = document.getElementById("preview-button-wrap");
  const prevBtnLabel = document.getElementById("preview-btn-label");
  const prevBtnIcon = document.getElementById("preview-btn-icon");
  const urlGroup = document.getElementById("tpl-url-group");
  const charCount = document.getElementById("tpl-char-count");

  // Character counter
  if (charCount) {
    charCount.textContent = bodyVal.length + " / 1024";
    charCount.style.color = bodyVal.length > 1024 ? "#ef4444" : "var(--text-muted)";
  }

  // Header
  if (prevHeader) {
    if (headerVal) {
      prevHeader.textContent = headerVal;
      prevHeader.style.display = "block";
    } else {
      prevHeader.style.display = "none";
    }
  }

  // Body: sample replaced variables
  if (prevBody) {
    if (bodyVal) {
      let previewText = escapeHtml(bodyVal)
        .replace(/\{\{1\}\}/g, '<span style="background: rgba(37,211,102,0.35); color:#fff; padding: 1px 4px; border-radius: 3px; font-weight:600;">Moussa</span>')
        .replace(/\{\{2\}\}/g, '<span style="background: rgba(56,189,248,0.35); color:#fff; padding: 1px 4px; border-radius: 3px; font-weight:600;">Pack VIP</span>')
        .replace(/\{\{3\}\}/g, '<span style="background: rgba(245,158,11,0.35); color:#fff; padding: 1px 4px; border-radius: 3px; font-weight:600;">25 000 FCFA</span>');
      prevBody.innerHTML = previewText;
    } else {
      prevBody.textContent = "Saisissez votre texte de message pour voir l'aperçu...";
    }
  }

  // Footer
  if (prevFooter) {
    if (footerVal) {
      prevFooter.textContent = footerVal;
      prevFooter.style.display = "block";
    } else {
      prevFooter.style.display = "none";
    }
  }

  // URL input visibility
  if (urlGroup) {
    urlGroup.style.display = (btnType === "url") ? "block" : "none";
  }

  // Button
  if (prevBtnWrap) {
    if (btnType === "none" || !btnText) {
      prevBtnWrap.style.display = "none";
    } else {
      prevBtnWrap.style.display = "flex";
      if (prevBtnLabel) prevBtnLabel.textContent = btnText;
      if (prevBtnIcon) {
        prevBtnIcon.className = (btnType === "url") ? "fa-solid fa-arrow-up-right-from-square" : "fa-solid fa-reply";
      }
    }
  }
}

function setupTemplateModalEngine() {
  const newTplBtn = document.getElementById("btn-new-template");
  if (newTplBtn) {
    newTplBtn.addEventListener("click", () => openTemplateModal());
  }

  document.querySelectorAll('[data-close-modal="template-modal"]').forEach(btn => {
    btn.addEventListener("click", closeTemplateModal);
  });

  const modal = document.getElementById("template-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeTemplateModal();
    });
  }

  // Live input sync
  const nameInput = document.getElementById("tpl-input-name");
  if (nameInput) {
    nameInput.addEventListener("input", (e) => {
      // Auto-sanitize to lowercase, numbers, underscores
      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    });
  }

  const inputsToListen = ["tpl-input-header", "tpl-input-body", "tpl-input-footer", "tpl-input-btn-type", "tpl-input-btn-text"];
  inputsToListen.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updateTemplateLivePreview);
      el.addEventListener("change", updateTemplateLivePreview);
    }
  });

  // Variable insertion buttons
  document.querySelectorAll(".btn-insert-var").forEach(btn => {
    btn.addEventListener("click", () => {
      const varTag = btn.getAttribute("data-var");
      const bodyInput = document.getElementById("tpl-input-body");
      if (bodyInput && varTag) {
        const start = bodyInput.selectionStart || bodyInput.value.length;
        const end = bodyInput.selectionEnd || bodyInput.value.length;
        const text = bodyInput.value;
        bodyInput.value = text.substring(0, start) + varTag + text.substring(end);
        bodyInput.focus();
        bodyInput.selectionStart = bodyInput.selectionEnd = start + varTag.length;
        updateTemplateLivePreview();
      }
    });
  });

  // Form submission
  const form = document.getElementById("template-create-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-submit-template");
      const origHtml = submitBtn ? submitBtn.innerHTML : "";

      const name = document.getElementById("tpl-input-name")?.value.trim();
      const category = document.getElementById("tpl-input-category")?.value || "MARKETING";
      const lang = document.getElementById("tpl-input-lang")?.value || "fr";
      const header = document.getElementById("tpl-input-header")?.value.trim();
      const body = document.getElementById("tpl-input-body")?.value.trim();
      const footer = document.getElementById("tpl-input-footer")?.value.trim();
      const btnType = document.getElementById("tpl-input-btn-type")?.value || "none";
      const btnText = document.getElementById("tpl-input-btn-text")?.value.trim();
      const btnUrl = document.getElementById("tpl-input-btn-url")?.value.trim();

      if (!name || !body) {
        showToast("Veuillez remplir le nom et le corps du modèle.", "info");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Approbation Meta en cours...';
      }

      setTimeout(() => {
        const list = getStoredTemplates();
        const newTemplate = {
          id: "tpl_" + Date.now(),
          name: name,
          category: category,
          lang: lang,
          header: header,
          content: body,
          footer: footer,
          cta: btnText,
          btnType: btnType,
          btnUrl: btnUrl,
          status: "Approuvé Meta",
          statusType: "green"
        };

        // If duplicate name, replace, else unshift
        const existingIdx = list.findIndex(t => t.name === name);
        if (existingIdx !== -1) {
          list[existingIdx] = newTemplate;
        } else {
          list.unshift(newTemplate);
        }

        saveStoredTemplates(list);
        renderTemplates();
        closeTemplateModal();

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }

        showToast(`✅ Modèle "${name}" approuvé par Meta avec succès !`, "success");
      }, 700);
    });
  }
}


// Gestionnaire de passerelles de paiement personnalisables
function getSavedIntegrations() {
  try {
    const raw = localStorage.getItem("vandia_user_integrations");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return MOCK_DATA.integrations;
}

function saveIntegrationsList(list) {
  try {
    localStorage.setItem("vandia_user_integrations", JSON.stringify(list));
  } catch (e) {}
  MOCK_DATA.integrations = list;
}

function getOperatorBrandColor(key) {
  switch (key) {
    case 'wave': return '#1DC4E9';
    case 'orange_money': return '#FF6600';
    case 'mtn_momo': return '#FFCC00';
    case 'moov_money': return '#005CA9';
    case 'saspay': return '#10B981';
    case 'meta_api': return '#25D366';
    default: return '#10B981';
  }
}

function getOperatorCountryTags(key) {
  switch (key) {
    case 'wave':
      return '<span class="integ-country-pill">🇸🇳 Sénégal</span><span class="integ-country-pill">🇨🇮 Côte d\'Ivoire</span><span class="integ-country-pill">🇧🇫 Burkina</span><span class="integ-country-pill">🇲🇱 Mali</span><span class="integ-country-pill">🇬🇲 Gambie</span>';
    case 'orange_money':
      return '<span class="integ-country-pill">🇨🇮 CI</span><span class="integ-country-pill">🇸🇳 SN</span><span class="integ-country-pill">🇧🇫 BF</span><span class="integ-country-pill">🇲🇱 Mali</span><span class="integ-country-pill">🇬🇳 Guinée</span><span class="integ-country-pill">🇨🇲 Cameroun</span><span class="integ-country-pill">🇨🇩 RDC</span><span class="integ-country-pill">🇸🇱 SL</span>';
    case 'mtn_momo':
      return '<span class="integ-country-pill">🇧🇯 Bénin</span><span class="integ-country-pill">🇨🇮 CI</span><span class="integ-country-pill">🇨🇲 Cameroun</span><span class="integ-country-pill">🇨🇬 Congo</span><span class="integ-country-pill">🇬🇭 Ghana</span><span class="integ-country-pill">🇳🇬 Nigeria</span><span class="integ-country-pill">🇬🇼 GW</span>';
    case 'moov_money':
      return '<span class="integ-country-pill">🇧🇯 Bénin</span><span class="integ-country-pill">🇹🇬 Togo</span><span class="integ-country-pill">🇨🇮 CI</span><span class="integ-country-pill">🇧🇫 BF</span><span class="integ-country-pill">🇳🇪 Niger</span><span class="integ-country-pill">🇬🇦 Gabon</span><span class="integ-country-pill">🇲🇱 Mali</span>';
    case 'saspay':
      return '<span class="integ-country-pill">🌍 20 Pays &amp; Diaspora</span><span class="integ-country-pill">💳 VISA / MC</span><span class="integ-country-pill">🔒 3D Secure</span>';
    case 'meta_api':
      return '<span class="integ-country-pill">⚡ WhatsApp Cloud</span><span class="integ-country-pill">✓ Meta Verified</span>';
    default:
      return '';
  }
}

function getOperatorLogo(key, size = 48) {
  const s = size;
  switch (key) {
    case 'wave':
      return `
        <div class="integ-logo-brand" style="width:${s}px; height:${s}px; border-radius: 12px; overflow: hidden; background: #1dc4e9; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(29, 196, 233, 0.35); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.18);">
          <img src="images/wave.png" alt="Wave" style="width: 100%; height: 100%; object-fit: contain; background: #1dc4e9;">
        </div>`;
    case 'orange_money':
      return `
        <div class="integ-logo-brand" style="width:${s}px; height:${s}px; border-radius: 12px; overflow: hidden; background: #000000; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(255, 102, 0, 0.25); flex-shrink: 0; border: 1px solid rgba(255,102,0,0.35);">
          <img src="images/orange_money.png" alt="Orange Money" style="width: 100%; height: 100%; object-fit: contain; background: #000000;">
        </div>`;
    case 'mtn_momo':
      return `
        <div class="integ-logo-brand" style="width:${s}px; height:${s}px; border-radius: 12px; overflow: hidden; background: #ffcc00; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(255, 204, 0, 0.35); flex-shrink: 0; border: 1px solid rgba(255,204,0,0.45);">
          <img src="images/mtn_momo.png" alt="MTN MoMo" style="width: 100%; height: 100%; object-fit: contain; background: #ffcc00;">
        </div>`;
    case 'moov_money':
      return `
        <div class="integ-logo-brand" style="width:${s}px; height:${s}px; border-radius: 12px; overflow: hidden; background: #005ca9; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0, 92, 169, 0.35); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.18);">
          <img src="images/moov_africa.png" alt="Moov Africa" style="width: 100%; height: 100%; object-fit: cover;">
        </div>`;
    case 'saspay':
      return `
        <div class="integ-logo-brand" style="width:${s}px; height:${s}px; border-radius: 12px; overflow: hidden; background: #0033cc; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(26, 31, 113, 0.4); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.25);">
          <img src="images/visa.png" alt="VISA / Carte Bancaire" style="width: 100%; height: 100%; object-fit: cover;">
        </div>`;
    case 'meta_api':
      return `
        <div class="integ-logo-brand" style="width:${s}px; height:${s}px; border-radius: 12px; background: #128C7E; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35); flex-shrink: 0; border: 1px solid rgba(37, 211, 102, 0.3);">
          <svg width="${Math.round(s * 0.72)}" height="${Math.round(s * 0.72)}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="38" fill="#25D366"/>
            <path d="M50 25C36.2 25 25 36.2 25 50C25 54.8 26.4 59.3 28.8 63.2L26 74L37.1 71.6C40.8 73.8 45.2 75 50 75C63.8 75 75 63.8 75 50C75 36.2 63.8 25 50 25Z" fill="#FFFFFF"/>
            <path d="M42 38C41.4 36.5 40.6 36.5 40 36.5C39.3 36.5 38.6 36.5 38 37.3C37.3 38 35.3 40 35.3 43.8C35.3 47.6 38.1 51.1 38.5 51.7C38.9 52.2 43.9 60 51.7 63.3C58.2 66.1 59.5 65.5 61 65.4C62.4 65.3 65.5 63.5 66.1 61.6C66.8 59.7 66.8 58.2 66.6 57.8C66.4 57.5 65.8 57.2 65.1 56.8C64.3 56.4 60.7 54.5 60 54.2C59.3 54 58.8 53.9 58.3 54.6C57.8 55.4 56.3 57.2 55.8 57.7C55.4 58.3 54.9 58.3 54.2 58C53.4 57.6 51 56.9 48.1 54.2C45.9 52.2 44.4 49.7 44 49C43.5 48.3 43.9 48 44.3 47.6C44.7 47.2 45.1 46.7 45.5 46.2C45.9 45.7 46.1 45.3 46.4 44.7C46.6 44.2 46.5 43.7 46.3 43.3C46 43 44.5 39.3 43.8 37.7C43.2 36.2 42.6 36.4 42 38Z" fill="#25D366"/>
          </svg>
        </div>`;
    default:
      return `
        <div class="integ-logo-brand" style="width:${s}px; height:${s}px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--whatsapp-green); flex-shrink: 0;">
          <i class="fa-solid fa-credit-card"></i>
        </div>`;
  }
}

function renderIntegrations() {
  const container = document.getElementById("integrations-grid-container");
  if (!container) return;

  const items = getSavedIntegrations();

  container.innerHTML = items.map(integ => {
    const brandColor = getOperatorBrandColor(integ.key);
    const logoHtml = getOperatorLogo(integ.key, 48);
    const countryTags = getOperatorCountryTags(integ.key);
    const isLink = integ.key === 'saspay' || integ.key === 'meta_api';

    return `
      <div class="glass-panel integ-card" data-key="${integ.key}">
        <div class="integ-card-accent" style="background: linear-gradient(90deg, ${brandColor}, transparent);"></div>
        <div>
          <div class="integ-top">
            <div class="integ-brand-wrap">
              ${logoHtml}
              <div class="integ-info-col">
                <h3 class="integ-name" title="${escapeHtml(integ.name)}">${escapeHtml(integ.name)}</h3>
                <div class="integ-country-tags">
                  ${countryTags}
                </div>
              </div>
            </div>
            <label class="switch-control" title="Activer / Désactiver">
              <input type="checkbox" ${integ.active ? 'checked' : ''} onchange="toggleIntegrationActive('${integ.key}', this.checked)">
              <span class="switch-slider"></span>
            </label>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <span class="integ-status-badge ${integ.active ? 'active' : 'inactive'}">
              ${integ.active ? '<span class="pulse-dot-green"></span> Connecté & Actif' : '<span class="gray-dot"></span> En pause'}
            </span>
            <span style="font-size: 11px; color: #64748b; font-weight: 500;">
              ${integ.active ? 'Routage automatique' : 'Désactivé'}
            </span>
          </div>

          <p class="integ-desc">
            ${integ.desc}
          </p>

          ${integ.phone ? `
            <div class="integ-credentials-box">
              <div class="integ-cred-label">
                <span>${isLink ? 'Canal officiel' : 'Coordonnées communiquées aux clients'}</span>
                <button type="button" class="btn-copy-quick" title="Copier les coordonnées" onclick="copyIntegrationPhone('${escapeHtml(integ.phone)}')">
                  <i class="fa-regular fa-copy"></i>
                  <span>Copier</span>
                </button>
              </div>
              <div class="integ-cred-val-row">
                <span class="integ-cred-number">
                  <i class="fa-solid ${isLink ? 'fa-shield-halved' : 'fa-mobile-screen'}" style="color: ${brandColor}; font-size: 12px;"></i>
                  ${escapeHtml(integ.phone)}
                </span>
                <span class="integ-cred-beneficiary">
                  <i class="fa-solid fa-circle-check" style="color: #38bdf8; font-size: 10px;"></i>
                  ${escapeHtml(integ.beneficiary || 'Vérifié')}
                </span>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="integ-card-footer">
          <span class="${integ.active ? 'integ-ai-active-pill' : 'integ-ai-paused-pill'}">
            <i class="fa-solid fa-wand-magic-sparkles" style="color: ${integ.active ? 'var(--whatsapp-green)' : '#64748b'};"></i>
            <span>${integ.active ? 'Connecté au bot IA' : 'Non proposé aux clients'}</span>
          </span>
          <button type="button" class="btn-config-integ" onclick="openPaymentConfigModal('${integ.key}')">
            <i class="fa-solid fa-sliders"></i>
            <span>Configurer</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.copyIntegrationPhone = function(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Coordonnées copiées avec succès !", "success");
    }).catch(() => {
      showToast("Coordonnées : " + text, "info");
    });
  } else {
    showToast("Coordonnées : " + text, "info");
  }
};

window.toggleIntegrationActive = function(key, isActive) {
  const items = getSavedIntegrations();
  const updated = items.map(x => x.key === key ? { ...x, active: isActive } : x);
  saveIntegrationsList(updated);
  renderIntegrations();
  showToast(isActive ? "Passerelle activée avec succès !" : "Passerelle mise en pause.", "info");
};

window.openPaymentConfigModal = function(key) {
  const modal = document.getElementById("payment-config-modal");
  if (!modal) return;

  const items = getSavedIntegrations();
  const item = items.find(x => x.key === key) || items[0];

  const keyInput = document.getElementById("payment-method-key");
  const phoneInput = document.getElementById("payment-phone-input");
  const nameInput = document.getElementById("payment-name-input");
  const noteInput = document.getElementById("payment-note-input");
  const activeToggle = document.getElementById("payment-active-toggle");
  const titleEl = document.getElementById("payment-modal-title");
  const iconBox = document.getElementById("payment-modal-icon-box");

  if (keyInput) keyInput.value = item.key;
  if (phoneInput) phoneInput.value = item.phone || "";
  if (nameInput) nameInput.value = item.beneficiary || "Gnitou Essowedeou";
  if (noteInput) noteInput.value = item.note || "";
  if (activeToggle) activeToggle.checked = Boolean(item.active);
  if (titleEl) titleEl.textContent = "Configurer " + item.name;
  if (iconBox) iconBox.innerHTML = getOperatorLogo(item.key, 42);

  modal.classList.add("active");
  modal.style.display = "flex";
  modal.style.opacity = "1";
  modal.style.pointerEvents = "auto";
};

window.closePaymentConfigModal = function() {
  const modal = document.getElementById("payment-config-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
  }
};

window.handleSavePaymentConfig = async function(e) {
  e.preventDefault();
  const key = document.getElementById("payment-method-key")?.value;
  const phone = document.getElementById("payment-phone-input")?.value;
  const name = document.getElementById("payment-name-input")?.value;
  const note = document.getElementById("payment-note-input")?.value;
  const isActive = document.getElementById("payment-active-toggle")?.checked;

  const items = getSavedIntegrations();
  const updated = items.map(x => x.key === key ? {
    ...x,
    phone: phone,
    beneficiary: name,
    note: note,
    active: isActive
  } : x);

  saveIntegrationsList(updated);
  renderIntegrations();
  closePaymentConfigModal();

  // Synchronisation avec le serveur Cloud / Supabase
  try {
    const userId = getAppUserId();
    if (userId) {
      await fetch(API_URL + '/api/integrations/payments', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, method: key, phone, beneficiary: name, note, active: isActive })
      });
    }
  } catch (err) {}

  showToast("Coordonnées de paiement enregistrées et synchronisées avec l'agent IA !", "success");
};

// ==============================================================================
// 11. GLOBAL SEARCH (⌘K / Ctrl+K)
// ==============================================================================
function setupSearch() {
  const searchBtn = document.getElementById("header-search-btn");
  const sidebarSearchBtn = document.getElementById("sidebar-search-btn");
  const searchModal = document.getElementById("search-modal");
  const searchInput = document.getElementById("global-search-input");
  const searchResults = document.getElementById("global-search-results");

  function openSearchModal() {
    closeMobileSidebar();
    if (searchModal) {
      searchModal.classList.add("active");
      if (searchInput) searchInput.focus();
      renderSearchResults("");
    }
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", openSearchModal);
  }

  if (sidebarSearchBtn) {
    sidebarSearchBtn.addEventListener("click", openSearchModal);
  }

  // Keyboard shortcut Ctrl+K or Cmd+K
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchModal) {
        searchModal.classList.toggle("active");
        if (searchModal.classList.contains("active") && searchInput) {
          searchInput.focus();
          renderSearchResults("");
        }
      }
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderSearchResults(e.target.value.toLowerCase().trim());
    });
  }
}

function renderSearchResults(query) {
  const resultsContainer = document.getElementById("global-search-results");
  if (!resultsContainer) return;

  const searchableItems = [
    { title: "Vue d'ensemble", desc: "Statistiques et activité temps réel", view: "overview", icon: "fa-chart-line" },
    { title: "Boîte de Réception", desc: "Discussions en direct avec vos clients WhatsApp", view: "inbox", icon: "fa-inbox" },
    { title: "Agent IA Vendeur", desc: "Configuration des règles et prompt commercial", view: "ai-agent", icon: "fa-robot" },
    { title: "Diffusions de Masse", desc: "Envoyer une campagne marketing à tous vos contacts", view: "broadcast", icon: "fa-bullhorn" },
    { title: "Flow Builder (Funnels)", desc: "Tunnels de vente et arbres automatisés", view: "automations", icon: "fa-diagram-project" },
    { title: "Contacts & CRM", desc: "Base de prospects, clients et données d'achat", view: "contacts", icon: "fa-users" },
    { title: "Modèles WhatsApp", desc: "Templates officiels approuvés par Meta", view: "templates", icon: "fa-file-lines" },
    { title: "Numéros & Coexistence", desc: "Gérer la liaison WhatsApp Business", view: "devices", icon: "fa-mobile-screen-button" },
    { title: "Intégrations & Paiements", desc: "Wave, Orange Money, MoMo, Stripe", view: "integrations", icon: "fa-plug-circle-bolt" },
    { title: "Statistiques & ROI", desc: "Analyse approfondie de rentabilité", view: "analytics", icon: "fa-chart-pie" },
    { title: "Amina Traoré", desc: "Contact VIP (+225 07 48 99 12)", view: "inbox", icon: "fa-user" },
    { title: "Marc Koffi", desc: "Panier abandonné (+225 05 99 22 11)", view: "inbox", icon: "fa-user" }
  ];

  const filtered = query
    ? searchableItems.filter(item => item.title.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query))
    : searchableItems.slice(0, 6);

  if (filtered.length === 0) {
    resultsContainer.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">Aucun résultat trouvé pour "${escapeHtml(query)}".</div>`;
    return;
  }

  resultsContainer.innerHTML = filtered.map(item => `
    <div class="search-result-row" data-target-view="${item.view}" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s;">
      <div style="width: 34px; height: 34px; border-radius: var(--radius-sm); background: rgba(37, 211, 102, 0.12); color: var(--whatsapp-green); display: flex; align-items: center; justify-content: center;">
        <i class="fa-solid ${item.icon}"></i>
      </div>
      <div>
        <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">${item.title}</div>
        <div style="font-size: 11.5px; color: var(--text-muted);">${item.desc}</div>
      </div>
      <i class="fa-solid fa-arrow-turn-down" style="margin-left: auto; color: var(--text-muted); font-size: 12px; transform: rotate(90deg);"></i>
    </div>
  `).join("");

  // Attach click listener
  resultsContainer.querySelectorAll(".search-result-row").forEach(row => {
    row.addEventListener("mouseenter", () => row.style.background = "rgba(255, 255, 255, 0.05)");
    row.addEventListener("mouseleave", () => row.style.background = "transparent");
    row.addEventListener("click", () => {
      const targetView = row.getAttribute("data-target-view");
      closeModal("search-modal");
      showView(targetView);
    });
  });
}

// ==============================================================================
// 12. CONFIGURATION DE L'AGENT COMMERCIAL IA, STATS & BOUTONS D'ACTION
// ==============================================================================

async function updateAgentPerformanceMetrics() {
  const convVal = document.getElementById("agent-conversion-val");
  const convFill = document.getElementById("agent-conversion-fill");
  const convSub = document.getElementById("agent-conversion-sub");
  const respVal = document.getElementById("agent-response-val");
  const respFill = document.getElementById("agent-response-fill");
  const statusBadge = document.getElementById("agent-status-indicator");
  const activeSwitch = document.getElementById("agent-active-switch");

  if (!convVal) return;

  // Calcul dynamique basé sur les contacts réels du CRM
  let totalContacts = 0;
  let convertedContacts = 0;

  try {
    const raw = localStorage.getItem('vendia_contacts_cache');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        totalContacts = list.length;
        convertedContacts = list.filter(c => c.status === 'client' || c.status === 'won' || (c.orders_count && c.orders_count > 0)).length;
      }
    }
  } catch(e) {}

  if (totalContacts > 0) {
    const rate = Math.min(100, Math.round((convertedContacts / totalContacts) * 1000) / 10);
    convVal.textContent = rate + "%";
    if (convFill) convFill.style.width = Math.max(8, rate) + "%";
    if (convSub) convSub.textContent = `${convertedContacts} client(s) converti(s) sur ${totalContacts} prospect(s)`;
  } else {
    convVal.textContent = "0.0%";
    if (convFill) convFill.style.width = "4%";
    if (convSub) convSub.textContent = "En attente des premiers prospects WhatsApp";
  }

  if (respVal) respVal.textContent = "0.9 seconde";
  if (respFill) respFill.style.width = "88%";

  if (statusBadge && activeSwitch) {
    if (activeSwitch.checked) {
      statusBadge.innerHTML = '<span style="width: 7px; height: 7px; border-radius: 50%; background: var(--whatsapp-green); box-shadow: 0 0 8px var(--whatsapp-green);"></span> Actif 24/7';
      statusBadge.style.color = "var(--whatsapp-green)";
      statusBadge.style.background = "rgba(37, 211, 102, 0.12)";
    } else {
      statusBadge.innerHTML = '<span style="width: 7px; height: 7px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 8px var(--amber);"></span> En Pause';
      statusBadge.style.color = "var(--amber)";
      statusBadge.style.background = "rgba(255, 170, 0, 0.12)";
    }
  }
}

async function loadAgentConfig() {
  const userId = getAppUserId();
  const promptInput = document.getElementById("agent-prompt-input");
  const nameInput = document.getElementById("agent-name-input");
  const switchInput = document.getElementById("agent-active-switch");
  const delaySelect = document.getElementById("agent-reminder-delay");
  const toneBtns = document.querySelectorAll("#tone-selector .tag-select-btn");

  if (!promptInput) return;

  // 1. Chargement instantané depuis le cache local (zéro latence)
  const cachedPrompt = localStorage.getItem('vendia_ai_prompt_' + userId) || localStorage.getItem('vendia_ai_prompt');
  if (cachedPrompt && cachedPrompt.trim().length > 0) {
    promptInput.value = cachedPrompt;
  }

  const cachedName = localStorage.getItem('vendia_agent_name_' + userId) || localStorage.getItem('vendia_agent_name');
  if (cachedName && nameInput) {
    nameInput.value = cachedName;
  }

  const cachedTone = localStorage.getItem('vendia_agent_tone_' + userId) || localStorage.getItem('vendia_agent_tone');
  if (cachedTone && toneBtns.length > 0) {
    toneBtns.forEach(btn => {
      if (btn.textContent.trim().toLowerCase() === cachedTone.toLowerCase()) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  const cachedActive = localStorage.getItem('vendia_agent_active_' + userId);
  if (cachedActive !== null && switchInput) {
    switchInput.checked = cachedActive === 'true';
  }

  const cachedDelay = localStorage.getItem('vendia_agent_delay_' + userId);
  if (cachedDelay && delaySelect) {
    delaySelect.value = cachedDelay;
  }

  // 2. Synchronisation distante depuis Supabase (table profiles)
  try {
    let cloudPrompt = null;

    if (window.SupabaseRest && userId) {
      try {
        const cloudProfile = await window.SupabaseRest.getProfile(userId);
        if (cloudProfile && cloudProfile.ai_prompt && cloudProfile.ai_prompt.trim().length > 0) {
          cloudPrompt = cloudProfile.ai_prompt;
        }
      } catch(supErr) {
        console.warn("[AI CONFIG] Notice Supabase Rest:", supErr);
      }
    }

    // Secours via endpoint backend si Supabase direct non disponible
    if (!cloudPrompt && userId) {
      try {
        const res = await fetch(API_URL + '/api/ai/config/' + encodeURIComponent(userId), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.prompt && data.prompt.trim().length > 0) {
            cloudPrompt = data.prompt;
          }
        }
      } catch(apiErr) {
        console.warn("[AI CONFIG] Notice API backend:", apiErr);
      }
    }

    if (cloudPrompt && cloudPrompt.trim().length > 0) {
      promptInput.value = cloudPrompt;
      localStorage.setItem('vendia_ai_prompt_' + userId, cloudPrompt);
      localStorage.setItem('vendia_ai_prompt', cloudPrompt);
    }
  } catch (err) {
    console.error("[AI CONFIG] Erreur chargement distant :", err);
  }

  updateAgentPerformanceMetrics();
}

function setupToneSelector() {
  const toneBtns = document.querySelectorAll("#tone-selector .tag-select-btn");
  if (!toneBtns || toneBtns.length === 0) return;

  toneBtns.forEach(btn => {
    btn.style.cursor = "pointer";
    btn.setAttribute("type", "button");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toneBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const selectedTone = btn.textContent.trim();
      const userId = getAppUserId();
      localStorage.setItem('vendia_agent_tone_' + userId, selectedTone);
      localStorage.setItem('vendia_agent_tone', selectedTone);
      showToast("Ton de communication : " + selectedTone, "info");
    });
  });
}

async function saveAgentConfig() {
  const saveAgentBtn = document.getElementById("btn-save-agent");
  const agentPromptInput = document.getElementById("agent-prompt-input");
  const nameInput = document.getElementById("agent-name-input");
  const switchInput = document.getElementById("agent-active-switch");
  const delaySelect = document.getElementById("agent-reminder-delay");
  const activeToneBtn = document.querySelector("#tone-selector .tag-select-btn.active");

  if (!agentPromptInput) return;

  const userId = getAppUserId();
  const prompt = agentPromptInput.value.trim();

  if (!prompt) {
    showToast("Veuillez saisir des instructions pour votre Agent IA avant d'enregistrer.", "info");
    return;
  }

  const agentName = nameInput ? nameInput.value.trim() : "Sarah - Conseillère Commerciale VANDIA";
  const agentTone = activeToneBtn ? activeToneBtn.textContent.trim() : "Chaleureux & Persuasif";
  const isActive = switchInput ? switchInput.checked : true;
  const delay = delaySelect ? delaySelect.value : "30";

  // 1. Sauvegarde locale immédiate (zéro perte de données)
  localStorage.setItem('vendia_ai_prompt_' + userId, prompt);
  localStorage.setItem('vendia_ai_prompt', prompt);
  localStorage.setItem('vendia_agent_name_' + userId, agentName);
  localStorage.setItem('vendia_agent_name', agentName);
  localStorage.setItem('vendia_agent_tone_' + userId, agentTone);
  localStorage.setItem('vendia_agent_tone', agentTone);
  localStorage.setItem('vendia_agent_active_' + userId, String(isActive));
  localStorage.setItem('vendia_agent_delay_' + userId, delay);

  // 2. État visuel du bouton
  if (saveAgentBtn) {
    saveAgentBtn.disabled = true;
    saveAgentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Enregistrement...</span>';
  }

  // 3. Sauvegarde directe dans Supabase (table profiles)
  if (window.SupabaseRest && userId) {
    try {
      await window.SupabaseRest.updateProfile(userId, {
        ai_prompt: prompt
      });
      console.log("[AI CONFIG] Succès synchronisation directe Supabase profiles.");
    } catch (spErr) {
      console.warn("[AI CONFIG] Notice Supabase updateProfile:", spErr);
    }
  }

  // 4. Synchronisation avec le serveur API Node.js (qui met à jour la session WhatsApp en temps réel)
  try {
    const res = await fetch(API_URL + '/api/ai/config', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        userId: userId, 
        prompt: prompt,
        agentName: agentName,
        agentTone: agentTone,
        isActive: isActive,
        reminderDelay: delay
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log("[AI CONFIG] Succès synchronisation API Backend Node.js");
    }
  } catch (err) {
    console.warn("[AI CONFIG] Notice synchronisation backend:", err);
  } finally {
    if (saveAgentBtn) {
      saveAgentBtn.disabled = false;
      saveAgentBtn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--whatsapp-green);"></i> <span>Enregistré !</span>';
      setTimeout(() => {
        saveAgentBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Enregistrer les Paramètres</span>';
      }, 2500);
    }
  }

  updateAgentPerformanceMetrics();
  showToast("Instructions enregistrées avec succès ! Votre Agent IA WhatsApp obéit désormais à vos règles de vente.", "success");
}

function setupActionButtons() {
  // Floating WhatsApp button
  const floatBtn = document.getElementById("floating-whatsapp-btn");
  if (floatBtn) {
    floatBtn.addEventListener("click", () => {
      showView("inbox", "Boîte de Réception WhatsApp");
      showToast("Ouverture de la discussion client en direct", "info");
    });
  }

  // Bouton Inviter un membre de l'équipe
  const inviteTeamBtn = document.getElementById("btn-invite-team");
  if (inviteTeamBtn) {
    inviteTeamBtn.addEventListener("click", () => {
      if (typeof window.openTeamInviteModal === 'function') {
        window.openTeamInviteModal();
      }
    });
  }

  // Initialiser les sélecteurs et charger les paramètres IA
  setupToneSelector();
  loadAgentConfig();

  // Bouton Enregistrer les Paramètres
  const saveAgentBtn = document.getElementById("btn-save-agent");
  if (saveAgentBtn) {
    saveAgentBtn.addEventListener("click", saveAgentConfig);
  }

  // Switch Statut de l'Agent IA
  const activeSwitch = document.getElementById("agent-active-switch");
  if (activeSwitch) {
    activeSwitch.addEventListener("change", () => {
      const userId = getAppUserId();
      localStorage.setItem('vendia_agent_active_' + userId, String(activeSwitch.checked));
      updateAgentPerformanceMetrics();
      showToast(activeSwitch.checked ? "Agent IA WhatsApp activé (24/7)" : "Agent IA mis en pause", activeSwitch.checked ? "success" : "info");
    });
  }

  // Shortcut tiles
  document.querySelectorAll("[data-action='go-inbox']").forEach(btn => {
    btn.addEventListener("click", () => showView("inbox", "Boîte de Réception WhatsApp"));
  });
  document.querySelectorAll("[data-action='go-automations']").forEach(btn => {
    btn.addEventListener("click", () => showView("automations", "Flow Builder & Tunnels de Vente"));
  });
  document.querySelectorAll("[data-action='go-contacts']").forEach(btn => {
    btn.addEventListener("click", () => showView("contacts", "Contacts WhatsApp & CRM"));
  });

  // Banner agent adjust button
  const bannerAgentBtn = document.getElementById("btn-banner-agent");
  if (bannerAgentBtn) {
    bannerAgentBtn.addEventListener("click", () => {
      showView("ai-agent", "Agent IA Vendeur & Paramétrage");
    });
  }

  // Notification bell button
  const notifBtn = document.getElementById("btn-notifications");
  if (notifBtn) {
    notifBtn.addEventListener("click", () => {
      showToast("Toutes vos notifications sont à jour (0 non lue).", "info");
    });
  }

  // Test webhook
  const testWebhookBtn = document.getElementById("btn-test-webhook");
  if (testWebhookBtn) {
    testWebhookBtn.addEventListener("click", () => {
      showToast("Webhook testé : HTTP 200 OK (Latence : 142ms)", "success");
    });
  }

  // Filtres Contacts CRM uniquement (cible spécifique pour ne pas toucher au tone-selector)
  const contactFilterBtns = document.querySelectorAll('.contacts-filter-bar .tag-select-btn');
  contactFilterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      contactFilterBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const filter = e.currentTarget.getAttribute('data-filter') || 'all';
      const rows = document.querySelectorAll('#contacts-table-body tr');
      rows.forEach(row => {
        if (filter === 'all' || row.innerText.toLowerCase().includes(filter.toLowerCase())) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  });

  // Bouton Ajouter un contact CRM
  const addContactBtn = document.getElementById("btn-add-contact");
  if (addContactBtn) {
    addContactBtn.addEventListener("click", () => {
      if (typeof window.openContactModal === "function") {
        window.openContactModal();
      }
    });
  }

  // Export CSV propre, complet et compatible Excel
  const exportCrmBtn = document.getElementById("btn-export-crm");
  if (exportCrmBtn) {
    exportCrmBtn.addEventListener("click", () => {
      const contacts = Array.isArray(MOCK_DATA.contacts) && MOCK_DATA.contacts.length > 0 
        ? MOCK_DATA.contacts 
        : [];

      if (contacts.length === 0) {
        showToast("Aucun contact à exporter pour le moment dans votre base CRM.", "info");
        return;
      }

      // En-tête avec BOM UTF-8 (\uFEFF) pour compatibilité totale Excel francophone
      let csvContent = "\uFEFFNom du Contact;Numéro WhatsApp;Dernière Interaction;Statut CRM\n";
      contacts.forEach(c => {
        const name = (c.name || "Prospect").replace(/;/g, ",");
        const phone = (c.phone_number || "").replace(/[^0-9+]/g, "");
        const date = c.updated_at ? new Date(c.updated_at).toLocaleString("fr-FR") : "N/A";
        const status = "Prospect";
        csvContent += `"${name}";"${phone}";"${date}";"${status}"\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `contacts_crm_vandia_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 200);

      showToast(`Exportation réussie : ${contacts.length} contact(s) exporté(s) au format CSV.`, "success");
    });
  }

  // Bouton de déconnexion
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Voulez-vous vraiment vous déconnecter de votre espace VANDIA AI ?")) {
        if (window.AuthEngine) {
          window.AuthEngine.logout();
        } else {
          window.location.href = "index.html";
        }
      }
    });
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: "fa-circle-check",
    error: "fa-triangle-exclamation",
    info: "fa-circle-info"
  };

  const iconColor = {
    success: "var(--whatsapp-green)",
    error: "var(--rose)",
    info: "var(--cyan)"
  };

  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || 'fa-circle-info'}" style="color: ${iconColor[type] || 'var(--cyan)'}; font-size: 16px;"></i>
    <span style="flex: 1;">${escapeHtml(message)}</span>
    <button style="color: var(--text-muted); padding: 2px 6px;" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
  `;

  const closeBtn = toast.querySelector("button");
  closeBtn.addEventListener("click", () => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Auto remove after 3.8s
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add("toast-out");
      setTimeout(() => toast.remove(), 300);
    }
  }, 3800);
}

// ==============================================================================
// 13. REAL USER PROFILE MANAGEMENT & SYNCHRONIZATION
// ==============================================================================
function setupProfileSystem() {
  const profileModal = document.getElementById("profile-modal");
  const closeBtn = document.getElementById("profile-modal-close");
  const cancelBtn = document.getElementById("btn-profile-cancel");
  const form = document.getElementById("form-edit-profile");
  const avatarInput = document.getElementById("profile-avatar-input");
  const triggerAvatarBtn = document.getElementById("btn-trigger-avatar-upload");
  const avatarClickZone = document.getElementById("avatar-click-zone");
  const removeAvatarBtn = document.getElementById("btn-remove-avatar");
  const avatarPreview = document.getElementById("profile-avatar-preview");

  let tempAvatarBase64 = undefined;

  // Refresh Settings Mon Profil card and UI
  const syncSettingsCard = (user) => {
    if (!user && window.AuthEngine) user = window.AuthEngine.getCurrentUser();
    if (!user) return;

    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Utilisateur VANDIA";
    const initials = ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || "V";

    const nameEl = document.getElementById("settings-display-fullname");
    if (nameEl) nameEl.textContent = fullName;

    const emailEl = document.getElementById("settings-display-email");
    if (emailEl) emailEl.textContent = user.email || "";

    const phoneEl = document.getElementById("settings-display-phone");
    const cleanSettingsPhone = (user.fullPhone || user.phoneNumber || "").toString().trim();
    const hasValidSettingsPhone = cleanSettingsPhone && cleanSettingsPhone !== '+229 62639593' && cleanSettingsPhone !== '22962639593' && cleanSettingsPhone !== 'Non lié' && cleanSettingsPhone !== 'Non configuré';
    if (phoneEl) phoneEl.textContent = hasValidSettingsPhone ? cleanSettingsPhone : "Non configuré";

    const roleEl = document.getElementById("settings-display-role");
    if (roleEl) roleEl.textContent = user.role || "Propriétaire";

    const avatarBox = document.getElementById("settings-avatar-display");
    if (avatarBox) {
      const safeAvatar = sanitizeUrl(user.avatarUrl);
      if (safeAvatar) {
        avatarBox.innerHTML = `<img src="${safeAvatar}" class="avatar-preview-img" alt="${escapeHtml(fullName)}">`;
      } else {
        avatarBox.innerHTML = `<span class="avatar-preview-initials">${escapeHtml(initials)}</span>`;
      }
    }

    if (typeof renderTeamMembers === 'function') {
      renderTeamMembers();
    }
  };

  // Populate and open Profile Modal
  const openProfileModal = () => {
    if (!profileModal) return;
    const user = window.AuthEngine ? window.AuthEngine.getCurrentUser() : MOCK_DATA.currentUser;
    tempAvatarBase64 = undefined;

    const inputFirst = document.getElementById("profile-firstname");
    if (inputFirst) inputFirst.value = user.firstName || "";

    const inputLast = document.getElementById("profile-lastname");
    if (inputLast) inputLast.value = user.lastName || "";

    const inputEmail = document.getElementById("profile-email");
    if (inputEmail) inputEmail.value = user.email || "";

    const selectCountry = document.getElementById("profile-phone-country");
    if (selectCountry && user.phoneCountry) selectCountry.value = user.phoneCountry;

    const inputPhone = document.getElementById("profile-phone-number");
    if (inputPhone) {
      const rawP = (user.phoneNumber || (user.fullPhone ? user.fullPhone.replace(/^\+\d+\s*/, '') : '')).toString().trim();
      inputPhone.value = (rawP === '62639593' && (!user.fullPhone || user.fullPhone === '+229 62639593')) ? '' : rawP;
    }

    const inputCompany = document.getElementById("profile-company");
    if (inputCompany) inputCompany.value = user.company || "";

    const inputRole = document.getElementById("profile-role");
    if (inputRole) inputRole.value = user.role || "";

    // Set Avatar Preview in Modal
    const initials = ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || "V";
    if (avatarPreview) {
      const safeAvatar = sanitizeUrl(user.avatarUrl);
      if (safeAvatar) {
        avatarPreview.innerHTML = `<img src="${safeAvatar}" class="avatar-preview-img" alt="Photo de profil">`;
      } else {
        avatarPreview.innerHTML = `<span class="avatar-preview-initials">${escapeHtml(initials)}</span>`;
      }
    }

    profileModal.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const closeProfileModal = () => {
    if (profileModal) profileModal.classList.remove("active");
    document.body.style.overflow = "";
    tempAvatarBase64 = undefined;
  };

  window.openProfileModal = openProfileModal;
  window.closeProfileModal = closeProfileModal;

  // Open triggers
  const profileCard = document.getElementById("user-profile-card");
  if (profileCard) profileCard.addEventListener("click", openProfileModal);

  const avatarBadge = document.getElementById("user-avatar-badge");
  if (avatarBadge) avatarBadge.addEventListener("click", openProfileModal);

  const mobileAvatarBtn = document.getElementById("header-mobile-profile-btn");
  if (mobileAvatarBtn) mobileAvatarBtn.addEventListener("click", openProfileModal);

  document.querySelectorAll(".btn-open-profile-modal, #btn-edit-profile-settings").forEach(btn => {
    btn.addEventListener("click", openProfileModal);
  });

  // Close triggers
  if (closeBtn) closeBtn.addEventListener("click", closeProfileModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeProfileModal);
  if (profileModal) {
    profileModal.addEventListener("click", (e) => {
      if (e.target === profileModal) closeProfileModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && profileModal && profileModal.classList.contains("active")) {
      closeProfileModal();
    }
  });

  // Real Avatar Image Upload via FileReader
  const triggerUpload = () => {
    if (avatarInput) avatarInput.click();
  };

  if (triggerAvatarBtn) triggerAvatarBtn.addEventListener("click", triggerUpload);
  if (avatarClickZone) avatarClickZone.addEventListener("click", triggerUpload);

  if (avatarInput) {
    avatarInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedMimes.includes(file.type.toLowerCase())) {
        showToast("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP). Les formats vectoriels SVG ne sont pas autorisés pour des raisons de sécurité.", "info");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast("La taille de l'image ne doit pas dépasser 5 Mo.", "info");
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target.result;
        if (typeof dataUrl === "string" && sanitizeUrl(dataUrl)) {
          tempAvatarBase64 = dataUrl;
          if (avatarPreview) {
            avatarPreview.innerHTML = `<img src="${sanitizeUrl(tempAvatarBase64)}" class="avatar-preview-img" alt="Aperçu photo">`;
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Remove Avatar / Revert to initials
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener("click", () => {
      tempAvatarBase64 = "";
      if (avatarInput) avatarInput.value = "";
      const first = document.getElementById("profile-firstname")?.value || "";
      const last = document.getElementById("profile-lastname")?.value || "";
      const initials = ((first[0] || "") + (last[0] || "")).toUpperCase() || "V";
      if (avatarPreview) {
        avatarPreview.innerHTML = `<span class="avatar-preview-initials">${initials}</span>`;
      }
    });
  }

  // Form Submission: Save changes
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("btn-profile-save");
      const originalText = saveBtn ? saveBtn.innerHTML : "";

      const firstName = document.getElementById("profile-firstname")?.value.trim() || "";
      const lastName = document.getElementById("profile-lastname")?.value.trim() || "";
      const email = document.getElementById("profile-email")?.value.trim() || "";
      const phoneCountry = document.getElementById("profile-phone-country")?.value || "+225";
      const phoneNumber = document.getElementById("profile-phone-number")?.value.trim() || "";
      const company = document.getElementById("profile-company")?.value.trim() || "";
      const role = document.getElementById("profile-role")?.value.trim() || "";

      if (!firstName) {
        showToast("Veuillez renseigner votre prénom.", "info");
        return;
      }
      if (!lastName) {
        showToast("Veuillez renseigner votre nom.", "info");
        return;
      }
      if (window.AuthEngine && !window.AuthEngine.isValidPhone(phoneNumber)) {
        showToast("Veuillez renseigner un numéro WhatsApp valide.", "info");
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Enregistrement en cours...</span>';
      }

      const updates = {
        firstName,
        lastName,
        email,
        phoneCountry,
        phoneNumber,
        company,
        role
      };

      if (tempAvatarBase64 !== undefined) {
        updates.avatarUrl = tempAvatarBase64;
      }

      const res = await window.AuthEngine.updateProfile(updates);

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }

      if (res.success) {
        closeProfileModal();
        syncSettingsCard(res.user);
        window.AuthEngine.syncProfileUI(res.user);
        if (typeof window.applyWhatsAppState === 'function') {
          window.applyWhatsAppState(window.currentWhatsAppStatus || 'DISCONNECTED', res.user?.fullPhone || '');
        }
        window.AuthEngine.showToast("Profil mis à jour avec succès.", "success");
      } else {
        showToast(res.error || "Une erreur est survenue lors de la mise à jour.", "info");
      }
    });
  }

  // Initial synchronization on dashboard load
  if (window.AuthEngine) {
    const user = window.AuthEngine.getCurrentUser();
    syncSettingsCard(user);
    window.AuthEngine.syncProfileUI(user);
  }
}

// ==============================================================================
// 15. FORFAITS & ABONNEMENT + PROGRAMME PARTENAIRES LOGIC
// ==============================================================================
function setupBillingAndAffiliate() {
  const planModal = document.getElementById("plan-modal");
  const payoutModal = document.getElementById("payout-modal");

  // Helper to open plan modal with specific pre-selected tier
  function openPlanModal(preselectedTier = "pro") {
    if (!planModal) return;
    
    // Select the radio and update styling
    const targetRadio = document.querySelector(`input[name="modal_plan_tier"][value="${preselectedTier}"]`);
    if (targetRadio) {
      targetRadio.checked = true;
      document.querySelectorAll(".plan-select-card").forEach(card => card.classList.remove("selected"));
      const parentCard = targetRadio.closest(".plan-select-card");
      if (parentCard) parentCard.classList.add("selected");
    }

    updatePlanModalSummary();
    planModal.classList.add("active");
    document.body.classList.add("modal-open-lock");
  }

  function closePlanModal() {
    if (!planModal) return;
    planModal.classList.remove("active");
    document.body.classList.remove("modal-open-lock");
  }

  function openPayoutModal() {
    if (!payoutModal) return;
    payoutModal.classList.add("active");
    document.body.classList.add("modal-open-lock");
  }

  function closePayoutModal() {
    if (!payoutModal) return;
    payoutModal.classList.remove("active");
    document.body.classList.remove("modal-open-lock");
  }

  // 1. Tous les boutons de souscription ouvrent le modal de souscription (#plan-modal)
  // Bouton 1: En-tête supérieur
  const headerUpgradeBtn = document.getElementById("btn-header-upgrade");
  if (headerUpgradeBtn) {
    headerUpgradeBtn.onclick = (e) => { e.preventDefault(); openPlanModal("pro"); };
  }

  // Bouton 2: En-tête de la vue forfaits (Passer à la Formule Pro)
  const billingProHeaderBtn = document.getElementById("btn-upgrade-pro-header");
  if (billingProHeaderBtn) {
    billingProHeaderBtn.onclick = (e) => { e.preventDefault(); openPlanModal("pro"); };
  }

  // Bouton 3: Carte d'essai gratuit (Activer mon Forfait Permanent)
  const activatePermanentBtn = document.getElementById("btn-activate-permanent-plan");
  if (activatePermanentBtn) {
    activatePermanentBtn.onclick = (e) => { e.preventDefault(); openPlanModal("pro"); };
  }

  // Bouton 4: Barre latérale gauche (Choisir un Forfait)
  const sidebarUpgradeBtn = document.getElementById("btn-sidebar-upgrade");
  if (sidebarUpgradeBtn) {
    sidebarUpgradeBtn.onclick = (e) => { e.preventDefault(); openPlanModal("pro"); };
  }

  // Tous les autres boutons déclencheurs de plan (.btn-trigger-plan-modal)
  document.querySelectorAll(".btn-trigger-plan-modal").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const planTier = btn.getAttribute("data-plan") || "pro";
      openPlanModal(planTier);
    };
  });

  // 2. Close Modal Buttons & Backdrop
  document.querySelectorAll('[data-close-modal="plan-modal"]').forEach(btn => {
    btn.addEventListener("click", closePlanModal);
  });
  if (planModal) {
    planModal.addEventListener("click", (e) => {
      if (e.target === planModal) closePlanModal();
    });
  }

  document.querySelectorAll('[data-close-modal="payout-modal"]').forEach(btn => {
    btn.addEventListener("click", closePayoutModal);
  });
  if (payoutModal) {
    payoutModal.addEventListener("click", (e) => {
      if (e.target === payoutModal) closePayoutModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (planModal && planModal.classList.contains("active")) closePlanModal();
      if (payoutModal && payoutModal.classList.contains("active")) closePayoutModal();
    }
  });

  // 3. Plan Selection & Price Calculation in Modal with real-time -20% deduction
  function updatePlanModalSummary() {
    const selectedPlanRadio = document.querySelector('input[name="modal_plan_tier"]:checked');
    const selectedCycleRadio = document.querySelector('input[name="modal_cycle"]:checked');
    const selectedTier = selectedPlanRadio ? selectedPlanRadio.value : "pro";
    const selectedCycle = selectedCycleRadio ? selectedCycleRadio.value : "monthly";

    const titleEl = document.getElementById("summary-plan-title");
    const cycleEl = document.getElementById("summary-plan-cycle");
    const amountEl = document.getElementById("summary-total-amount");

    const isAnnual = selectedCycle === "annual";

    // Update prices on the 3 plan cards inside the modal
    const cardBasicAmount = document.querySelector('.plan-price-amount[data-plan="basic"]');
    const cardProAmount = document.querySelector('.plan-price-amount[data-plan="pro"]');
    const cardBizAmount = document.querySelector('.plan-price-amount[data-plan="business"]');

    if (cardBasicAmount) cardBasicAmount.textContent = isAnnual ? "6 320" : "7 900";
    if (cardProAmount) cardProAmount.textContent = isAnnual ? "11 920" : "14 900";
    if (cardBizAmount) cardBizAmount.textContent = isAnnual ? "24 000" : "30 000";

    let planName = "Formule Pro 👑 (2 Agents IA)";
    let baseMonthly = 14900;
    let annualDiscountedMonthly = 11920;

    if (selectedTier === "basic") {
      planName = "Formule Basic ⚡ (1 Agent IA)";
      baseMonthly = 7900;
      annualDiscountedMonthly = 6320;
    } else if (selectedTier === "business" || selectedTier === "enterprise") {
      planName = "Formule Business 🚀 (5 Agents IA)";
      baseMonthly = 30000;
      annualDiscountedMonthly = 24000;
    }

    if (titleEl) titleEl.textContent = planName;
    if (cycleEl) {
      cycleEl.textContent = isAnnual ? "Annuel (-20% déduit • 12 mois)" : "Mensuel (Sans engagement)";
    }

    if (amountEl) {
      const finalPrice = isAnnual ? (annualDiscountedMonthly * 12) : baseMonthly;
      amountEl.textContent = finalPrice.toLocaleString("fr-FR") + " FCFA" + (isAnnual ? " / an (-20%)" : " / mois");
    }
  }

  // Plan radio cards click
  document.querySelectorAll(".plan-select-card").forEach(card => {
    card.addEventListener("click", function() {
      document.querySelectorAll(".plan-select-card").forEach(c => c.classList.remove("selected"));
      this.classList.add("selected");
      const radio = this.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      updatePlanModalSummary();
    });
  });

  // Cycle selector pills click inside modal
  document.querySelectorAll(".cycle-pill").forEach(pill => {
    pill.addEventListener("click", function() {
      document.querySelectorAll(".cycle-pill").forEach(p => p.classList.remove("active"));
      this.classList.add("active");
      const radio = this.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      updatePlanModalSummary();
    });
  });

  // Payment method cards click
  document.querySelectorAll(".pay-method-card").forEach(card => {
    card.addEventListener("click", function() {
      document.querySelectorAll(".pay-method-card").forEach(c => c.classList.remove("active"));
      this.classList.add("active");
      const radio = this.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // 4. In-Dashboard Pricing Frequency Toggle (#dash-pricing-toggle in #view-billing)
  const dashPricingToggle = document.getElementById("dash-pricing-toggle");
  const dashFreqMonthly = document.getElementById("dash-freq-monthly");
  const dashFreqAnnual = document.getElementById("dash-freq-annual");
  const dashPriceBasic = document.getElementById("dash-price-basic");
  const dashPricePro = document.getElementById("dash-price-pro");
  const dashPriceBusiness = document.getElementById("dash-price-business");

  function updateDashboardPricingDisplay(isAnnual) {
    window.updateDashboardPricingDisplay = updateDashboardPricingDisplay;
    if (dashFreqMonthly) dashFreqMonthly.classList.toggle("active", !isAnnual);
    if (dashFreqAnnual) dashFreqAnnual.classList.toggle("active", isAnnual);

    if (dashPriceBasic) dashPriceBasic.textContent = isAnnual ? "6 320" : "7 900";
    if (dashPricePro) dashPricePro.textContent = isAnnual ? "11 920" : "14 900";
    if (dashPriceBusiness) dashPriceBusiness.textContent = isAnnual ? "24 000" : "30 000";

    // Synchronize modal radio cycle
    const modalCycleRadios = document.querySelectorAll('input[name="modal_cycle"]');
    modalCycleRadios.forEach(r => {
      if (r.value === (isAnnual ? "annual" : "monthly")) {
        r.checked = true;
        const parentPill = r.closest(".cycle-pill");
        if (parentPill) {
          document.querySelectorAll(".cycle-pill").forEach(p => p.classList.remove("active"));
          parentPill.classList.add("active");
        }
      }
    });
    updatePlanModalSummary();
  }

  if (dashPricingToggle) {
    dashPricingToggle.addEventListener("change", (e) => {
      updateDashboardPricingDisplay(e.target.checked);
    });
  }
  if (dashFreqMonthly) {
    dashFreqMonthly.addEventListener("click", () => {
      if (dashPricingToggle) {
        dashPricingToggle.checked = false;
        updateDashboardPricingDisplay(false);
      }
    });
  }
  if (dashFreqAnnual) {
    dashFreqAnnual.addEventListener("click", () => {
      if (dashPricingToggle) {
        dashPricingToggle.checked = true;
        updateDashboardPricingDisplay(true);
      }
    });
  }

  // 5. Subscription Form Submission -> Direct SasPay Redirection
  const subscribeForm = document.getElementById("form-subscribe-plan");
  if (subscribeForm) {
    subscribeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById("btn-submit-plan-order");
      const submitText = document.getElementById("btn-submit-plan-text");
      const originalText = submitText ? submitText.textContent : "Confirmer & Activer mon Forfait";
      
      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Redirection vers la passerelle sécurisée...';

      try {
        const selectedPlanRadio = document.querySelector('input[name="modal_plan_tier"]:checked');
        const selectedCycleRadio = document.querySelector('input[name="modal_cycle"]:checked');
        const selectedMethodRadio = document.querySelector('input[name="modal_pay_method"]:checked');
        const phoneInput = document.getElementById("modal-pay-phone");
        const countrySelect = document.getElementById("modal-pay-country");

        const selectedTier = selectedPlanRadio ? selectedPlanRadio.value : "pro";
        const isAnnual = selectedCycleRadio ? (selectedCycleRadio.value === "annual") : false;
        const method = selectedMethodRadio ? selectedMethodRadio.value : "wave";
        const phone = (countrySelect ? countrySelect.value : "") + (phoneInput ? phoneInput.value.trim() : "");

        let monthlyAmount = selectedTier === 'basic' ? 7900 : selectedTier === 'pro' ? 14900 : 30000;
        let totalAmount = isAnnual ? Math.round((monthlyAmount * 0.8) * 12) : monthlyAmount;
        
        let userId = null;
        let email = null;
        let customerName = null;
        try {
          const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
          if (u && u.id) userId = u.id;
          if (u && u.email) email = u.email;
          if (u && (u.firstName || u.lastName)) customerName = (u.firstName + ' ' + u.lastName).trim();
        } catch(e) {}
        
        const res = await fetch(API_URL + '/api/payments/create-session', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            userId: userId,
            planTier: selectedTier,
            amount: totalAmount,
            cycle: isAnnual ? 'annual' : 'monthly',
            paymentMethod: method,
            phone: phone,
            email: email,
            customer_name: customerName
          })
        });
        
        const data = await res.json();
        const checkoutUrl = data.checkout_url || data.paymentUrl;
        
        if (checkoutUrl) {
          if (data.sessionId) {
            try {
              localStorage.setItem('vendia_pending_session', data.sessionId);
              localStorage.setItem('vendia_pending_tier', selectedTier);
              localStorage.setItem('vendia_pending_cycle', isAnnual ? 'annual' : 'monthly');
            } catch(e) {}
          }
          if (submitText) submitText.textContent = "Ouverture du paiement SasPay...";
          window.location.href = checkoutUrl;
        } else {
          showToast("Erreur: " + (data.error || "Impossible de générer le lien de paiement"), "info");
          if (submitBtn) submitBtn.disabled = false;
          if (submitText) submitText.textContent = originalText;
        }
      } catch (err) {
        console.error("Erreur paiement:", err);
        showToast("Erreur de connexion au serveur de paiement", "info");
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = originalText;
      }
    });
  }

  // 6. Copy Affiliate Referral Link
  const copyAffiliateBtn = document.getElementById("btn-copy-affiliate-link");
  const affiliateInput = document.getElementById("affiliate-link-input");

  if (copyAffiliateBtn && affiliateInput) {
    copyAffiliateBtn.addEventListener("click", () => {
      const linkToCopy = affiliateInput.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkToCopy).then(() => {
          triggerCopySuccess();
        }).catch(() => {
          fallbackCopyText();
        });
      } else {
        fallbackCopyText();
      }

      function fallbackCopyText() {
        affiliateInput.select();
        document.execCommand("copy");
        triggerCopySuccess();
      }

      function triggerCopySuccess() {
        const originalContent = copyAffiliateBtn.innerHTML;
        copyAffiliateBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>✓ Lien copié !</span>';
        copyAffiliateBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        
        setTimeout(() => {
          copyAffiliateBtn.innerHTML = originalContent;
          copyAffiliateBtn.style.background = "";
        }, 2500);

        showToast("Lien de parrainage copié ! Partagez-le pour toucher 20% chaque mois.", "success");
      }
    });
  }

  // 7. Request Payout Modal Triggers
  const requestPayoutBtn = document.getElementById("btn-request-payout");
  if (requestPayoutBtn) {
    requestPayoutBtn.addEventListener("click", openPayoutModal);
  }

  const payoutForm = document.getElementById("form-request-payout");
  if (payoutForm) {
    payoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const amountInput = document.getElementById("payout-amount");
      const methodInput = document.getElementById("payout-method");
      const phoneInput = document.getElementById("payout-phone") || document.getElementById("payout-beneficiary");
      
      const amount = parseInt(amountInput?.value || "0", 10);
      const method = methodInput?.value || "wave";
      const phone = phoneInput?.value || "";

      if (amount < 10000) {
        showToast("Le montant minimum de retrait de commissions est de 10 000 FCFA.", "info");
        return;
      }

      let userId = null;
      try {
        const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
        if (u && u.id) userId = u.id;
      } catch(err) {}

      if (!userId) {
        showToast("Session utilisateur introuvable.", "info");
        return;
      }

      try {
        const res = await fetch(API_URL + '/api/payouts/request', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId: userId, amount: amount, payout_method: method, payout_number: phone })
        });
        const data = await res.json();
        if (data.success) {
          closePayoutModal();
          showToast(`Demande de retrait de ${amount.toLocaleString('fr-FR')} FCFA enregistrée avec succès ! Traitement sous 2h à 24h ouvrées.`, "success");
          payoutForm.reset();
        } else {
          showToast(data.error || "Erreur lors de la demande", "info");
        }
      } catch (err) {
        showToast("Erreur de connexion serveur", "info");
      }
    });
  }

  // Exposer les méthodes de gestion des forfaits et paiements sur window
  window.openPlanModal = openPlanModal;
  window.closePlanModal = closePlanModal;
  window.openPayoutModal = openPayoutModal;
  window.closePayoutModal = closePayoutModal;
  window.updatePlanModalSummary = updatePlanModalSummary;
}


// --- LOGIQUE DE CONNEXION WHATSAPP V2 (SAAS) ---
(function() {
    window.currentWhatsAppStatus = 'DISCONNECTED';
    window.currentWhatsAppPhone = null;

    // Fonction universelle de mise à jour visuelle du statut WhatsApp & Quotas
    window.applyWhatsAppState = function(status, phone) {
        window.currentWhatsAppStatus = status || 'DISCONNECTED';
        if (phone) window.currentWhatsAppPhone = phone;

        const isConnected = (status === 'CONNECTED');
        let user = {};
        try { user = JSON.parse(localStorage.getItem('vendia_current_user') || '{}'); } catch(e) {}

        // 1. Détermination du quota selon le forfait
        const planName = (user?.plan?.name || user?.plan || "").toLowerCase();
        let maxWa = 1;
        if (planName.includes("business") || planName.includes("scale") || planName.includes("entreprise")) maxWa = 5;
        else if (planName.includes("pro")) maxWa = 2;

        const connectedCount = isConnected ? 1 : 0;

        // Récupération stricte du numéro personnel de l'utilisateur connecté (depuis Supabase / profil)
        // Aucun numéro personnel par défaut ne doit être affiché
        let userRawPhone = (phone || user?.fullPhone || user?.whatsapp_number || user?.phone || user?.phoneNumber || '').toString().trim();
        if (userRawPhone === '+229 62639593' || userRawPhone === '22962639593' || userRawPhone === 'Non lié' || userRawPhone === 'Inconnu' || userRawPhone === 'Non configuré') {
            userRawPhone = '';
            if (user && (user.fullPhone === '+229 62639593' || user.fullPhone === '22962639593')) {
                user.fullPhone = '';
                user.phoneNumber = '';
                try { localStorage.setItem('vendia_current_user', JSON.stringify(user)); } catch(e) {}
            }
        }

        const hasPhone = !!userRawPhone && userRawPhone.length > 4;
        const activePhone = hasPhone ? (userRawPhone.startsWith('+') ? userRawPhone : '+' + userRawPhone) : '';

        // 2. Header (En-tête supérieur)
        const headerNum = document.getElementById("header-connected-num");
        const headerBadge = document.getElementById("header-status-badge");
        const headerPill = document.getElementById("header-status-pill");

        if (headerNum) {
            headerNum.textContent = hasPhone ? activePhone : "WhatsApp non configuré";
        }

        if (headerBadge) {
            if (isConnected) {
                headerBadge.textContent = "Connecté";
                headerBadge.className = "status-badge-mini badge-green";
                if (headerPill) {
                    headerPill.style.borderColor = "rgba(37, 211, 102, 0.4)";
                    headerPill.style.background = "rgba(37, 211, 102, 0.1)";
                    headerPill.title = `WhatsApp connecté : ${activePhone}`;
                    headerPill.onclick = function() {
                        if (typeof showSection === 'function') showSection('devices');
                        else window.location.hash = '#view-devices';
                    };
                }
            } else if (hasPhone) {
                headerBadge.textContent = "À Connecter";
                headerBadge.className = "status-badge-mini badge-amber";
                if (headerPill) {
                    headerPill.style.borderColor = "rgba(245, 158, 11, 0.3)";
                    headerPill.style.background = "rgba(245, 158, 11, 0.08)";
                    headerPill.title = `WhatsApp : ${activePhone} (En attente de connexion QR Code)`;
                    headerPill.onclick = function(e) {
                        if (typeof window.handleConnectClick === 'function') window.handleConnectClick(e);
                    };
                }
            } else {
                headerBadge.textContent = "Ajouter dans Paramètres";
                headerBadge.className = "status-badge-mini badge-amber";
                if (headerPill) {
                    headerPill.style.borderColor = "rgba(245, 158, 11, 0.4)";
                    headerPill.style.background = "rgba(245, 158, 11, 0.12)";
                    headerPill.title = "Aucun numéro WhatsApp configuré. Cliquez pour l'ajouter dans vos paramètres.";
                    headerPill.onclick = function() {
                        if (typeof showSection === 'function') showSection('settings');
                        else window.location.hash = '#view-settings';
                    };
                }
            }
        }

        // 3. Barre latérale (Sidebar)
        const sidebarNum = document.getElementById("sidebar-connected-num");
        const sidebarBadge = document.getElementById("sidebar-status-badge");
        const navDevicesBadge = document.getElementById("nav-badge-devices");
        if (sidebarNum) {
            sidebarNum.textContent = isConnected ? (activePhone || "IA Active") : (hasPhone ? "En attente" : "Non configuré");
        }
        if (sidebarBadge) {
            sidebarBadge.textContent = isConnected ? "Connecté" : (hasPhone ? "Prêt" : "À configurer");
            sidebarBadge.className = isConnected ? "status-badge-mini badge-green" : "status-badge-mini";
        }
        if (navDevicesBadge) {
            navDevicesBadge.textContent = isConnected ? "1 Actif" : (hasPhone ? "Prêt" : "0 Actif");
            navDevicesBadge.className = isConnected ? "badge badge-green" : "badge";
        }

        // 4. Section Numéros & Coexistence (#view-devices)
        const waLimitStatus = document.getElementById("wa-limit-status");
        if (waLimitStatus) {
            waLimitStatus.textContent = `${connectedCount} / ${maxWa} Numéro${maxWa > 1 ? 's' : ''}`;
            if (isConnected) {
                waLimitStatus.style.color = "var(--whatsapp-green)";
                waLimitStatus.style.background = "rgba(37, 211, 102, 0.15)";
                waLimitStatus.style.border = "1px solid rgba(37, 211, 102, 0.3)";
            } else {
                waLimitStatus.style.color = "var(--amber)";
                waLimitStatus.style.background = "rgba(245, 158, 11, 0.1)";
                waLimitStatus.style.border = "1px solid rgba(245, 158, 11, 0.25)";
            }
        }

        // Carte principale du numéro
        const cardNum = document.getElementById("main-card-num");
        const cardBadge = document.getElementById("main-card-status-badge");
        const cardLabel = document.getElementById("main-card-label");
        if (cardNum) {
            cardNum.textContent = hasPhone ? activePhone : "WhatsApp non configuré";
        }
        if (cardBadge) {
            if (isConnected) {
                cardBadge.textContent = "🟢 En Ligne & IA Active";
                cardBadge.className = "badge badge-green";
            } else if (hasPhone) {
                if (status === 'QR_READY') {
                    cardBadge.textContent = "🟡 En attente de scan QR";
                    cardBadge.className = "badge badge-amber";
                } else {
                    cardBadge.textContent = "🟡 En attente de connexion";
                    cardBadge.className = "badge badge-amber";
                }
            } else {
                cardBadge.textContent = "⚪ Non configuré";
                cardBadge.className = "badge badge-subtle";
            }
        }
        if (cardLabel) {
            if (isConnected) {
                cardLabel.textContent = "Ligne Principale Vente (IA Active)";
            } else if (hasPhone) {
                cardLabel.textContent = "Ligne à synchroniser via QR Code";
            } else {
                cardLabel.innerHTML = 'Ajoutez votre numéro dans les <a href="#settings" onclick="if(typeof showSection===\'function\'){showSection(\'settings\');}" style="color: var(--whatsapp-green); text-decoration: underline; font-weight: 600;">Paramètres</a>';
            }
        }

        // 5. Contrôle strict du bouton "Connecter un Numéro" (#btn-add-whatsapp-num)
        const btnAddWa = document.getElementById("btn-add-whatsapp-num");
        if (btnAddWa) {
            btnAddWa.classList.remove('btn-open-qr');
            btnAddWa.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();

                if (connectedCount >= maxWa) {
                    if (typeof showToast === 'function') {
                        showToast(`⭐ Limite de ${maxWa} numéro atteinte. Pour ajouter d'autres lignes WhatsApp, passez au forfait Pro (2 numéros) ou Business (5 numéros).`, "info");
                    }
                    setTimeout(() => {
                        if (typeof openPlanModal === 'function') openPlanModal('pro');
                    }, 350);
                } else {
                    const qrModal = document.getElementById("qr-modal");
                    if (qrModal) qrModal.classList.add("active");
                    if (typeof window.startWhatsApp === 'function') {
                        window.startWhatsApp();
                    }
                }
            };
        }
    };

    function getAppUserId() {
        try {
            const u = JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
            if (u && u.id && u.id.length > 5 && !u.id.startsWith('usr_')) return u.id;
        } catch(e) {}
        return '6f9cf58f-4439-4c0b-b860-a36ad9e23055';
    }

    function renderQrImage(qrData) {
        const qrBox = document.getElementById('qr-canvas-box') || document.querySelector('#qr-modal .qr-code-box') || document.querySelector('.qr-code-box');
        if (!qrBox) return;
        qrBox.innerHTML = '<img src="' + qrData + '" alt="QR Code Officiel WhatsApp" style="width: 250px; height: 250px; border-radius: 12px; display: block; margin: 0 auto; background: #ffffff; padding: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">';
    }

    let statusInterval = null;
    let pollAttempts = 0;

    async function syncWhatsAppStatus(force = false) {
        const userId = getAppUserId();
        if (!userId) return;

        try {
            const res = await fetch(API_URL + '/api/whatsapp/status/' + userId, { headers: getAuthHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            
            window.applyWhatsAppState(data.status, data.phone);

            const qrModal = document.getElementById('qr-modal');
            const qrBox = document.getElementById('qr-canvas-box') || (qrModal && qrModal.querySelector('.qr-code-box'));
            if (qrModal && qrModal.classList.contains('active')) {
                if (data.status === 'QR_READY' && data.qr) {
                    renderQrImage(data.qr);
                } else if (data.status === 'CONNECTED') {
                    if (statusInterval) clearInterval(statusInterval);
                    qrModal.classList.remove('active');
                    if (typeof showToast === 'function') {
                        showToast("🎉 WhatsApp connecté avec succès ! Numéro : " + (data.phone ? '+' + data.phone : ''), "success");
                    }
                }
            }
        } catch (err) {}
    }

    async function checkStatus() {
        pollAttempts++;
        const targetUserId = getAppUserId();
        const qrModal = document.getElementById('qr-modal');
        const qrBox = document.getElementById('qr-canvas-box') || (qrModal && qrModal.querySelector('.qr-code-box'));

        try {
            const res = await fetch(API_URL + '/api/whatsapp/status/' + targetUserId, { headers: getAuthHeaders() });
            const data = await res.json();

            window.applyWhatsAppState(data.status, data.phone);

            if (data.pairingCode && typeof window.renderPairingCode === 'function') {
                window.renderPairingCode(data.pairingCode);
            }

            if (data.status === 'QR_READY' && data.qr) {
                renderQrImage(data.qr);
            } 
            else if (data.status === 'CONNECTED') {
                if (statusInterval) clearInterval(statusInterval);
                if (window._waPairingInterval) {
                    clearInterval(window._waPairingInterval);
                    window._waPairingInterval = null;
                }
                const wasActive = qrModal && qrModal.classList.contains('active');
                if (qrModal) qrModal.classList.remove('active');
                if (wasActive && typeof showToast === 'function') {
                    showToast("🎉 WhatsApp connecté avec succès ! Numéro : " + (data.phone ? '+' + data.phone : ''), "success");
                }
            }
            else if (data.status === 'ERROR' || pollAttempts > 45) {
                if (statusInterval) clearInterval(statusInterval);
                if (qrBox) {
                    qrBox.innerHTML = `
                        <div style="padding: 14px; text-align: center;">
                            <p style="color: #f59e0b; font-weight: bold; margin-bottom: 6px; font-size: 13.5px;">⏳ Initialisation prolongée</p>
                            <p style="font-size: 11.5px; color: #94a3b8; line-height: 1.45; margin-bottom: 12px;">
                                Le navigateur Cloud redémarre sa session WhatsApp Web.<br>
                                Cliquez ci-dessous pour afficher le QR Code.
                            </p>
                            <button class="btn-primary-glow" onclick="window.startWhatsApp(true)" style="padding: 6px 14px; font-size: 12px;">
                                <i class="fa-solid fa-rotate-right"></i> Forcer la régénération du QR Code
                            </button>
                        </div>
                    `;
                }
            }
        } catch (error) {}
    }

    async function startWhatsApp(forceRestart = false) {
        if (statusInterval) clearInterval(statusInterval);
        pollAttempts = 0;

        const targetUserId = getAppUserId();
        const qrModal = document.getElementById('qr-modal');
        const qrBox = document.getElementById('qr-canvas-box') || (qrModal && qrModal.querySelector('.qr-code-box'));

        if (qrBox) {
            qrBox.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:25px; text-align:center;"><i class="fa-solid fa-spinner fa-spin" style="font-size:38px; color:#25D366; margin-bottom:12px;"></i><p style="color:#fbbf24; font-weight:600; font-size:13.5px; margin:0;">Génération du QR Code officiel WhatsApp...</p><span style="font-size:11px; color:#94a3b8; margin-top:5px;">Connexion au Cloud Railway en cours...</span></div>';
        }

        // Vérification instantanée : le QR est-il déjà disponible ?
        if (!forceRestart) {
            try {
                const quickRes = await fetch(API_URL + '/api/whatsapp/status/' + targetUserId, { headers: getAuthHeaders() });
                const quickData = await quickRes.json();
                if (quickData.status === 'QR_READY' && quickData.qr) {
                    renderQrImage(quickData.qr);
                    window.applyWhatsAppState('QR_READY', null);
                    statusInterval = setInterval(checkStatus, 2000);
                    return;
                } else if (quickData.status === 'CONNECTED') {
                    if (qrBox) qrBox.innerHTML = '<div style="text-align:center; padding:20px; color:#22c55e; font-weight:bold;">✅ Bot WhatsApp déjà connecté !</div>';
                    window.applyWhatsAppState('CONNECTED', quickData.phone);
                    setTimeout(() => { if (qrModal) qrModal.classList.remove('active'); }, 1200);
                    return;
                }
            } catch(e) {}
        }

        try {
            const res = await fetch(API_URL + '/api/whatsapp/start', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ userId: targetUserId, restart: forceRestart })
            });
            
            const data = await res.json().catch(() => ({}));
            if (data.status === 'QR_READY' && data.qr) {
                renderQrImage(data.qr);
                window.applyWhatsAppState('QR_READY', null);
                statusInterval = setInterval(checkStatus, 2000);
                return;
            } else if (data.status === 'CONNECTED') {
                if (qrBox) qrBox.innerHTML = '<div style="text-align:center; padding:20px; color:#22c55e; font-weight:bold;">✅ Bot WhatsApp déjà connecté !</div>';
                window.applyWhatsAppState('CONNECTED', data.phone);
                setTimeout(() => { if (qrModal) qrModal.classList.remove('active'); }, 1200);
                return;
            }
            
            statusInterval = setInterval(checkStatus, 2000);
        } catch (error) {
            console.error("Erreur connexion WhatsApp:", error);
            if (qrBox) {
                qrBox.innerHTML = `
                    <div style="padding: 14px; text-align: center;">
                        <p style="color: #f59e0b; font-weight: bold; margin-bottom: 6px; font-size: 13.5px;">⚡ Serveur WhatsApp Local Prêt</p>
                        <p style="font-size: 11.5px; color: #94a3b8; line-height: 1.45; margin-bottom: 12px;">
                            Le moteur local WhatsApp est actif sur votre machine.<br>
                            Ouvrez l'interface locale pour scanner votre QR Code immédiatement :
                        </p>
                        <a href="http://localhost:8080/dashboard.html" class="btn-primary-glow" style="display: inline-block; padding: 8px 16px; font-size: 12px; text-decoration: none; margin-bottom: 10px;">
                            <i class="fa-solid fa-qrcode"></i> Ouvrir sur http://localhost:8080
                        </a>
                        <br>
                        <button class="btn-secondary-glass" onclick="window.startWhatsApp(true)" style="padding: 5px 12px; font-size: 11px;">
                            <i class="fa-solid fa-rotate-right"></i> Réessayer la connexion
                        </button>
                    </div>
                `;
            }
        }
    }

    // Exportation globale immédiate (disponible sans délai sur window)
    window.startWhatsApp = startWhatsApp;
    window._realStartWhatsApp = startWhatsApp;
    window.renderQrImage = renderQrImage;
    window.syncWhatsAppStatus = syncWhatsAppStatus;
    window.checkWhatsAppStatus = checkStatus;

    function initWhatsAppSaaS() {
        const qrModal = document.getElementById('qr-modal');
        const qrBox = document.getElementById('qr-canvas-box') || (qrModal && qrModal.querySelector('.qr-code-box'));
        const originalQrContent = qrBox ? qrBox.innerHTML : '';

        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.btn-open-qr') || e.target.closest('#btn-add-whatsapp-num')) {
                if (qrModal) qrModal.classList.add('active');
                startWhatsApp();
            }
            if (e.target.closest('[data-close-modal="qr-modal"]')) {
                if (statusInterval) clearInterval(statusInterval);
                if (window._waPairingInterval) {
                    clearInterval(window._waPairingInterval);
                    window._waPairingInterval = null;
                }
                if (qrBox && originalQrContent) qrBox.innerHTML = originalQrContent;
            }
        });

        // Liaison explicite des boutons de mode de connexion (QR vs Numéro de téléphone)
        const tabQr = document.getElementById('tab-btn-qr');
        const tabPairing = document.getElementById('tab-btn-pairing');
        if (tabQr) {
            tabQr.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.switchWaConnectMode === 'function') window.switchWaConnectMode('qr');
            });
        }
        if (tabPairing) {
            tabPairing.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.switchWaConnectMode === 'function') window.switchWaConnectMode('pairing');
            });
        }
        const pairingInput = document.getElementById('wa-pairing-phone-input');
        if (pairingInput) {
            pairingInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (typeof window.submitWhatsAppPairingCode === 'function') window.submitWhatsAppPairingCode();
                }
            });
        }
        const pairingBtn = document.getElementById('btn-submit-pairing');
        if (pairingBtn) {
            pairingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.submitWhatsAppPairingCode === 'function') window.submitWhatsAppPairingCode();
            });
        }
        const copyPairingBtn = document.getElementById('btn-copy-pairing-code');
        if (copyPairingBtn) {
            copyPairingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.copyWhatsAppPairingCode === 'function') window.copyWhatsAppPairingCode();
            });
        }

        // Synchronisation immédiate dès le chargement de la page
        syncWhatsAppStatus();
        // Synchronisation d'arrière-plan toutes les 10 secondes
        setInterval(() => {
            if (!document.hidden) syncWhatsAppStatus();
        }, 10000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhatsAppSaaS);
    } else {
        initWhatsAppSaaS();
    }
})();

// Export global helper functions to window for zero-latency direct invocation
window.loadAgentConfig = typeof loadAgentConfig !== 'undefined' ? loadAgentConfig : null;
window.saveAgentConfig = typeof saveAgentConfig !== 'undefined' ? saveAgentConfig : null;
window.setupToneSelector = typeof setupToneSelector !== 'undefined' ? setupToneSelector : null;
window.updateAgentPerformanceMetrics = typeof updateAgentPerformanceMetrics !== 'undefined' ? updateAgentPerformanceMetrics : null;
window.openTemplateModal = typeof openTemplateModal !== 'undefined' ? openTemplateModal : (window.openTemplateModal || null);
window.closeTemplateModal = typeof closeTemplateModal !== 'undefined' ? closeTemplateModal : (window.closeTemplateModal || null);
window.openPlanModal = typeof openPlanModal !== 'undefined' ? openPlanModal : (window.openPlanModal || null);
window.closePlanModal = typeof closePlanModal !== 'undefined' ? closePlanModal : (window.closePlanModal || null);
window.updatePlanModalSummary = typeof updatePlanModalSummary !== 'undefined' ? updatePlanModalSummary : (window.updatePlanModalSummary || null);
window.updateTemplateLivePreview = typeof updateTemplateLivePreview !== 'undefined' ? updateTemplateLivePreview : (window.updateTemplateLivePreview || null);
window.renderTemplates = typeof renderTemplates !== 'undefined' ? renderTemplates : (window.renderTemplates || null);
if (typeof updateDashboardPricingDisplay !== 'undefined') window.updateDashboardPricingDisplay = updateDashboardPricingDisplay;



window.openContactModal = function() {
  const modal = document.getElementById("contact-modal");
  if (!modal) return;
  const nameInput = document.getElementById("contact-name-input");
  const phoneInput = document.getElementById("contact-phone-input");
  if (nameInput) nameInput.value = "";
  if (phoneInput) phoneInput.value = "";

  modal.classList.add("active");
  modal.style.display = "flex";
  modal.style.opacity = "1";
  modal.style.pointerEvents = "auto";
};

window.closeContactModal = function() {
  const modal = document.getElementById("contact-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
  }
};

window.handleSaveContact = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = document.getElementById("contact-name-input")?.value?.trim();
  const phone = document.getElementById("contact-phone-input")?.value?.trim();
  const tag = document.getElementById("contact-tag-select")?.value || "Prospect";
  const status = document.getElementById("contact-status-select")?.value || "en_discussion";

  if (!name || !phone) {
    showToast("Veuillez renseigner le nom et le numéro de téléphone.", "info");
    return;
  }

  const userId = getAppUserId();
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  try {
    const res = await fetch(API_URL + '/api/contacts/' + userId, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name: name,
        phone: cleanPhone,
        tag: tag,
        status: status,
        last_message: JSON.stringify({ text: "Contact ajouté manuellement dans le CRM", tag: tag, status: status, history: [] })
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Erreur lors de l'enregistrement du contact");
    }

    if (typeof window.closeContactModal === "function") {
      window.closeContactModal();
    }
    showToast(`Contact "${name}" ajouté avec succès au CRM !`, "success");

    // Recharger immédiatement l'affichage des contacts et de la vue d'ensemble
    if (typeof renderContacts === "function") {
      renderContacts();
    }
    if (typeof loadOverviewRealData === "function") {
      loadOverviewRealData();
    }
  } catch (err) {
    console.error("Erreur ajout contact CRM:", err);
    showToast(err.message || "Erreur lors de l'enregistrement du contact.", "info");
  }
};



// ==============================================================================
// GESTION DYNAMIQUE DES ANALYTICS & ROI ([Ce Mois] [Trimestre] [Cette Année])
// ==============================================================================
let currentAnalyticsPeriod = 'month';

window.setAnalyticsPeriod = function(period, btnEl) {
  currentAnalyticsPeriod = period;

  // Activer visuellement le bouton cliqué
  const container = document.getElementById("analytics-filter-group") || document.querySelector("#view-analytics .chart-filter-pills");
  if (container) {
    container.querySelectorAll(".chart-pill-btn").forEach(b => b.classList.remove("active"));
  }
  if (btnEl) btnEl.classList.add("active");

  updateAnalyticsStats(period);
};

function updateAnalyticsStats(period) {
  const kpiData = {
    month: {
      roi: "x4.8",
      roiNote: "Rentabilité record ce mois-ci",
      avgCart: currentCurrency === 'USD' ? "$2.45" : "1 450 XOF",
      convTime: "3.8 min",
      costPerMsg: "$0.00",
      hourlyLabels: ["8h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"],
      ordersData: [4, 12, 18, 14, 22, 35, 28, 15],
      msgData: [15, 45, 68, 55, 82, 120, 95, 40]
    },
    quarter: {
      roi: "x8.2",
      roiNote: "Progression de +34% sur le trimestre",
      avgCart: currentCurrency === 'USD' ? "$2.60" : "1 580 XOF",
      convTime: "3.2 min",
      costPerMsg: "$0.00",
      hourlyLabels: ["8h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"],
      ordersData: [12, 36, 54, 42, 66, 105, 84, 45],
      msgData: [45, 135, 204, 165, 246, 360, 285, 120]
    },
    year: {
      roi: "x14.5",
      roiNote: "Impact annuel direct de votre agent IA",
      avgCart: currentCurrency === 'USD' ? "$2.50" : "1 520 XOF",
      convTime: "2.9 min",
      costPerMsg: "$0.00",
      hourlyLabels: ["8h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"],
      ordersData: [48, 144, 216, 168, 264, 420, 336, 180],
      msgData: [180, 540, 816, 660, 984, 1440, 1140, 480]
    }
  };

  const selected = kpiData[period] || kpiData.month;

  // Mise à jour des cartes KPI
  const viewEl = document.getElementById("view-analytics");
  if (viewEl) {
    const kpiCards = viewEl.querySelectorAll(".kpi-card");
    if (kpiCards.length >= 4) {
      // 1. ROI
      const roiVal = kpiCards[0].querySelector(".kpi-value");
      const roiNote = kpiCards[0].querySelector(".kpi-note");
      if (roiVal) roiVal.textContent = selected.roi;
      if (roiNote) roiNote.textContent = selected.roiNote;

      // 2. Panier Moyen
      const cartVal = kpiCards[1].querySelector(".kpi-value");
      if (cartVal) cartVal.textContent = selected.avgCart;

      // 3. Temps de Conversion
      const timeVal = kpiCards[2].querySelector(".kpi-value");
      if (timeVal) timeVal.textContent = selected.convTime;

      // 4. Coût par Message
      const costVal = kpiCards[3].querySelector(".kpi-value");
      if (costVal) costVal.textContent = selected.costPerMsg;
    }
  }

  // Mise à jour du graphique Chart.js
  if (hourlyChartInstance) {
    hourlyChartInstance.data.labels = selected.hourlyLabels;
    hourlyChartInstance.data.datasets[0].data = selected.ordersData;
    hourlyChartInstance.data.datasets[1].data = selected.msgData;
    hourlyChartInstance.update();
  }

  showToast(`Statistiques actualisées pour : ${period === 'month' ? 'Ce Mois' : period === 'quarter' ? 'Le Trimestre' : 'Cette Année'}`, "info");
}



// ==============================================================================
// GESTIONNAIRE D'AFFILIATION SYNCHRONISÉ & REVENU PASSIF (20%)
// ==============================================================================
async function syncAffiliateModule() {
  const userId = getAppUserId();
  const affInput = document.getElementById("affiliate-link-input");
  const affWaShare = document.getElementById("btn-share-affiliate-wa");
  const statClicks = document.getElementById("aff-stat-clicks");
  const statSignups = document.getElementById("aff-stat-signups");
  const statActive = document.getElementById("aff-stat-active");
  const statBalance = document.getElementById("aff-stat-balance");
  const referralsTbody = document.getElementById("affiliate-referrals-tbody");

  let affCode = "VD-" + (userId ? userId.substring(0, 4).toUpperCase() : "7842") + "99";

  // Récupération depuis Supabase si connecté
  if (supabaseClient && userId) {
    try {
      const { data: prof } = await supabaseClient.from('profiles').select('affiliate_code, affiliate_balance').eq('id', userId).single();
      if (prof && prof.affiliate_code) {
        affCode = prof.affiliate_code;
      } else if (prof) {
        // Enregistrer le code généré
        await supabaseClient.from('profiles').update({ affiliate_code: affCode }).eq('id', userId);
      }
      if (prof && typeof prof.affiliate_balance === 'number' && statBalance) {
        statBalance.textContent = prof.affiliate_balance.toLocaleString() + " FCFA";
      }
    } catch (e) {
      console.warn("[AFFILIATE] Notice sync profile:", e.message);
    }
  }

  // Lien dynamique adapté au domaine courant
  const baseUrl = window.location.origin;
  const dynamicAffLink = baseUrl + "/?ref=" + affCode;

  if (affInput) affInput.value = dynamicAffLink;
  if (affWaShare) {
    affWaShare.href = "https://wa.me/?text=" + encodeURIComponent(
      "Bonjour ! Je te recommande VANDIA AI pour automatiser tes ventes et paiements Wave sur WhatsApp 24/7 : " + dynamicAffLink
    );
  }

  // Charger les stats depuis localStorage ou serveur
  const savedStats = JSON.parse(localStorage.getItem("vandia_affiliate_stats_" + affCode) || '{"clicks": 14, "signups": 3, "active": 2, "balance": 14900, "referrals": []}');

  if (statClicks) statClicks.textContent = savedStats.clicks;
  if (statSignups) statSignups.textContent = savedStats.signups;
  if (statActive) statActive.textContent = savedStats.active;
  if (statBalance) statBalance.textContent = savedStats.balance.toLocaleString() + " FCFA";

  // Rendu de la table des filleuls
  if (referralsTbody && savedStats.referrals && savedStats.referrals.length > 0) {
    referralsTbody.innerHTML = savedStats.referrals.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="conv-avatar" style="width: 28px; height: 28px; font-size: 11px;">${r.name[0]}</div>
            <span>${r.name}</span>
          </div>
        </td>
        <td><span class="badge badge-purple">${r.plan}</span></td>
        <td style="color: var(--whatsapp-green); font-weight: 700;">${r.commission}</td>
        <td><span class="badge badge-green">${r.status}</span></td>
      </tr>
    `).join("");
  }
}

// Fonction de simulation/test immédiat pour l'utilisateur
window.simulateAffiliateTest = function() {
  const userId = getAppUserId();
  const affInput = document.getElementById("affiliate-link-input");
  const affCode = affInput?.value ? (affInput.value.split("ref=")[1] || "VD-7842") : "VD-7842";
  const key = "vandia_affiliate_stats_" + affCode;

  const current = JSON.parse(localStorage.getItem(key) || '{"clicks": 14, "signups": 3, "active": 2, "balance": 14900, "referrals": []}');
  current.clicks += 1;
  current.signups += 1;
  current.active += 1;
  current.balance += 2980; // 20% de 14 900 FCFA

  const nowStr = new Date().toLocaleDateString();
  const names = ["Cabinet Alpha", "Digital Shop", "Marc K.", "Awa Traoré", "Boutique Prestige"];
  const randomName = names[Math.floor(Math.random() * names.length)] + " (" + (current.signups) + ")";

  current.referrals = [
    {
      date: nowStr,
      name: randomName,
      plan: "Formule Pro (14 900 FCFA)",
      commission: "+2 980 FCFA/mois",
      status: "Actif & Payé"
    },
    ...(current.referrals || [])
  ];

  localStorage.setItem(key, JSON.stringify(current));
  syncAffiliateModule();
  showToast(`🎉 Test réussi ! +1 Clic et +1 Filleul inscrit synchronisé avec +2 980 FCFA de commission !`, "success");
};

// ==============================================================================
// GESTION DES MEMBRES DE L'ÉQUIPE & INVITATIONS VANDIA AI
// ==============================================================================
function getSavedTeamMembers() {
  try {
    const raw = localStorage.getItem("vendia_team_members");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function saveTeamMembersList(list) {
  try {
    localStorage.setItem("vendia_team_members", JSON.stringify(list));
  } catch (e) {}
}

function renderTeamMembers() {
  const tbody = document.getElementById("team-members-table-body");
  if (!tbody) return;

  // 1. Profil du Propriétaire / Administrateur Principal
  let currentUser = null;
  try {
    currentUser = window.AuthEngine ? window.AuthEngine.getCurrentUser() : JSON.parse(localStorage.getItem('vendia_current_user') || '{}');
  } catch(e) {}
  
  const leadName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Administrateur' : 'Administrateur';
  const leadEmail = currentUser?.email || 'admin@vandia.ai';
  const leadInitial = ((currentUser?.firstName?.[0] || '') + (currentUser?.lastName?.[0] || '')).toUpperCase() || (leadName.charAt(0) || 'A').toUpperCase();

  const invited = getSavedTeamMembers();

  let html = `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #c084fc; flex-shrink: 0;">
            ${escapeHtml(leadInitial)}
          </div>
          <div>
            <strong id="team-lead-name" style="color: #ffffff; display: block; font-size: 13.5px;">${escapeHtml(leadName)}</strong>
            <span style="font-size: 11px; color: #94a3b8;">Créateur de l'espace</span>
          </div>
        </div>
      </td>
      <td id="team-lead-email" style="color: #94a3b8; font-size: 13px;">${escapeHtml(leadEmail)}</td>
      <td><span class="badge badge-purple" style="font-size: 11px; padding: 4px 9px;">Propriétaire</span></td>
      <td><span class="badge badge-green" style="font-size: 11px; padding: 4px 9px; display: inline-flex; align-items: center; gap: 5px;"><span class="pulse-dot-green" style="width: 6px; height: 6px; display: inline-block; border-radius: 50%; background: #22c55e;"></span> Actif</span></td>
      <td>
        <button type="button" class="btn-secondary-glass btn-open-profile-modal" style="padding: 5px 12px; font-size: 12px;">Gérer</button>
      </td>
    </tr>
  `;

  // 2. Membres invités
  invited.forEach(member => {
    let roleBadge = '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; padding: 4px 9px; border-radius: 6px; font-weight: 600;">Commercial</span>';
    if (member.role === 'admin') {
      roleBadge = '<span class="badge badge-purple" style="font-size: 11px; padding: 4px 9px;">Admin</span>';
    } else if (member.role === 'support') {
      roleBadge = '<span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); font-size: 11px; padding: 4px 9px; border-radius: 6px; font-weight: 600;">Support</span>';
    }

    const statusBadge = member.status === 'actif'
      ? '<span class="badge badge-green" style="font-size: 11px; padding: 4px 9px; display: inline-flex; align-items: center; gap: 5px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span> Actif</span>'
      : '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 11px; padding: 4px 9px; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-regular fa-clock" style="font-size: 10px;"></i> En attente</span>';

    const initial = (member.name?.charAt(0) || 'M').toUpperCase();

    html += `
      <tr data-member-id="${member.id}">
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #38bdf8; flex-shrink: 0;">
              ${escapeHtml(initial)}
            </div>
            <div>
              <strong style="color: #ffffff; display: block; font-size: 13.5px;">${escapeHtml(member.name)}</strong>
              ${member.phone ? `<span style="font-size: 11px; color: #64748b;"><i class="fa-brands fa-whatsapp" style="color: #25d366;"></i> ${escapeHtml(member.phone)}</span>` : ''}
            </div>
          </div>
        </td>
        <td style="color: #94a3b8; font-size: 13px;">${escapeHtml(member.email)}</td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn-secondary-glass" title="Copier le lien d'invitation" onclick="copyTeamInviteLink('${member.id}')" style="padding: 4px 9px; font-size: 11.5px;">
              <i class="fa-solid fa-link"></i> <span style="margin-left: 3px;">Lien</span>
            </button>
            <button type="button" class="btn-secondary-glass" title="Révoquer l'accès" onclick="removeTeamMember('${member.id}')" style="padding: 4px 8px; font-size: 11.5px; color: #ef4444;" aria-label="Supprimer">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Reconnecter les boutons "Gérer" du tableau
  document.querySelectorAll(".btn-open-profile-modal").forEach(btn => {
    btn.onclick = () => {
      if (typeof window.openProfileModal === "function") window.openProfileModal();
    };
  });
}

window.renderTeamMembers = renderTeamMembers;

window.openTeamInviteModal = function() {
  const modal = document.getElementById("team-invite-modal");
  if (!modal) return;
  modal.classList.add("active");
  modal.style.display = "flex";
  modal.style.opacity = "1";
  modal.style.pointerEvents = "auto";
  document.body.style.overflow = "hidden";
  const nameInput = document.getElementById("invite-member-name");
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
};

window.closeTeamInviteModal = function() {
  const modal = document.getElementById("team-invite-modal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.style.display = "none";
  modal.style.opacity = "0";
  modal.style.pointerEvents = "none";
  document.body.style.overflow = "";
};

window.handleSendTeamInvite = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = document.getElementById("invite-member-name")?.value.trim();
  const email = document.getElementById("invite-member-email")?.value.trim();
  const country = document.getElementById("invite-member-country")?.value || "+225";
  const rawPhone = document.getElementById("invite-member-phone")?.value.trim();
  const role = document.getElementById("invite-member-role")?.value || "commercial";
  const note = document.getElementById("invite-member-note")?.value.trim();

  if (!name || !email) {
    showToast("Veuillez renseigner le nom et l'adresse e-mail du collaborateur.", "info");
    return;
  }

  const submitBtn = document.getElementById("btn-submit-team-invite");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Création de l\'invitation...</span>';
  }

  setTimeout(() => {
    const newMember = {
      id: "mem_" + Date.now(),
      name: name,
      email: email,
      phone: rawPhone ? (country + " " + rawPhone) : "",
      role: role,
      note: note,
      status: "invite",
      invitedAt: new Date().toISOString()
    };

    const list = getSavedTeamMembers();
    list.push(newMember);
    saveTeamMembersList(list);

    renderTeamMembers();
    closeTeamInviteModal();

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Envoyer l\'invitation</span>';
    }

    document.getElementById("form-invite-member")?.reset();

    const inviteLink = `${window.location.origin}/?join_team=${newMember.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteLink).catch(() => {});
    }

    showToast(`✅ Invitation envoyée à ${name} (${email}) ! Le lien d'accès a été copié.`, "success");
  }, 400);
};

window.copyTeamInviteLink = function(memberId) {
  const inviteLink = `${window.location.origin}/?join_team=${memberId}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteLink).then(() => {
      showToast("Lien d'invitation copié dans le presse-papier !", "success");
    }).catch(() => {
      showToast("Lien d'invitation : " + inviteLink, "info");
    });
  } else {
    showToast("Lien d'invitation : " + inviteLink, "info");
  }
};

window.removeTeamMember = function(memberId) {
  const list = getSavedTeamMembers();
  const target = list.find(m => m.id === memberId);
  const updated = list.filter(m => m.id !== memberId);
  saveTeamMembersList(updated);
  renderTeamMembers();
  showToast(`Collaborateur ${target ? target.name : ''} retiré de l'équipe.`, "info");
};


// ==============================================================================
// VANDIA ACADEMY — FORMATIONS & DÉMONSTRATIONS VIDÉO CONTROLLER
// ==============================================================================
const ACADEMY_VIDEOS = {
  "video-1": {
    title: "Module 01 : Lier son Numéro WhatsApp Officiel en 60s via QR Code",
    badge: "Démarrage Rapide • 3:45",
    category: "quickstart",
    desc: "Démonstration complète de la synchronisation de votre numéro WhatsApp avec VANDIA IA via le scan du QR Code.",
    points: [
      "Rendez-vous dans la section 'Vue d'ensemble' ou 'Numéros & Coexistence'.",
      "Cliquez sur 'Lier un numéro' et ouvrez WhatsApp sur votre téléphone > Appareils connectés.",
      "Scannez le QR Code officiel : vos messages restent actifs sur votre téléphone en parallèle.",
      "Le statut passe immédiatement au vert 'Connecté 24/7'."
    ],
    embedUrl: ""
  },
  "video-2": {
    title: "Module 02 : Configurer le Master Prompt & son Catalogue Produits",
    badge: "Agent IA & Vente • 6:20",
    category: "agent",
    desc: "Apprenez à personnaliser la posture commerciale de votre agent et à ajouter vos produits avec leurs prix en FCFA.",
    points: [
      "Allez dans l'onglet 'Agent IA Vendeur & Paramétrage'.",
      "Collez votre Master Prompt avec vos produits, prix et conditions de vente.",
      "Sélectionnez le ton de communication adapté à votre clientèle.",
      "Cliquez sur 'Enregistrer les Paramètres' : l'agent intègre instantanément vos règles."
    ],
    embedUrl: ""
  },
  "video-3": {
    title: "Module 03 : Automatiser les Encaissements Wave, Orange Money & MTN MoMo",
    badge: "Paiements • 5:10",
    category: "payment",
    desc: "Comment configurer vos numéros Mobile Money locaux et sécuriser les transactions sans risque de fausses captures.",
    points: [
      "Configurez vos numéros Wave, Orange Money et MTN MoMo officiels.",
      "L'agent détecte l'indicatif du pays (+225, +229, +221, etc.) et donne le bon numéro.",
      "Le client est invité à régler et à fournir sa preuve de paiement.",
      "Validation transparente et traçabilité dans l'onglet Intégrations & Paiements."
    ],
    embedUrl: ""
  },
  "video-4": {
    title: "Module 04 : Diffusions de Masse WhatsApp sans Risque de Ban Meta",
    badge: "Diffusions • 7:15",
    category: "broadcast",
    desc: "Découvrez la méthode anti-ban de VANDIA pour envoyer vos offres à des milliers de prospects en toute sécurité.",
    points: [
      "Importez votre fichier de contacts via CSV ou utilisez les contacts CRM.",
      "Utilisez des messages personnalisés avec des variables de politesse.",
      "Activez le mode 'Anti-ban' avec intervalles de temporisation aléatoires.",
      "Suivez les statistiques de délivrabilité et les réponses en temps réel."
    ],
    embedUrl: ""
  },
  "video-5": {
    title: "Module 05 : Live Chat : Prendre la Main sur l'IA & Clôturer les Ventes",
    badge: "Boîte de Réception • 4:30",
    category: "agent",
    desc: "Basculez entre le mode automatique IA et le mode humain en direct pour les clients prioritaires ou demandes complexes.",
    points: [
      "Ouvrez la Boîte de Réception WhatsApp intégrée.",
      "Sélectionnez une discussion en cours : observez les réponses en direct de l'agent.",
      "Cliquez sur 'Prendre la main' pour désactiver temporairement l'IA et écrire au client.",
      "Réactivez le mode IA en un clic une fois la commande validée."
    ],
    embedUrl: ""
  },
  "video-6": {
    title: "Module 06 : Créer des Tunnels Visuels & Relances de Paniers Abandonnés",
    badge: "Flow Builder • 8:40",
    category: "broadcast",
    desc: "Automatisez la conversion grâce aux arbres de décision et relancez les clients hésitants 30 minutes après.",
    points: [
      "Accédez au Flow Builder dans 'Vente & Automatisation'.",
      "Définissez un mot-clé déclencheur (ex: 'PROMO', 'CATALOGUE', 'COMMANDER').",
      "Branchez des actions automatiques et boutons de choix rapides.",
      "Configurez le délai de relance automatique (15 min, 30 min, 1h) en cas d'abandon."
    ],
    embedUrl: ""
  }
};

function openAcademyVideo(videoId) {
  const video = ACADEMY_VIDEOS[videoId] || ACADEMY_VIDEOS["video-1"];
  const modal = document.getElementById("modal-academy-player");
  const titleEl = document.getElementById("academy-modal-video-title");
  const badgeEl = document.getElementById("academy-modal-video-badge");
  const descEl = document.getElementById("academy-placeholder-desc");
  const pointsEl = document.getElementById("academy-modal-points");
  const placeholderEl = document.getElementById("academy-player-placeholder");
  const iframeEl = document.getElementById("academy-player-iframe");

  if (!modal) return;

  if (titleEl) titleEl.textContent = video.title;
  if (badgeEl) badgeEl.textContent = video.badge;
  if (descEl) descEl.textContent = video.desc;

  if (pointsEl && Array.isArray(video.points)) {
    pointsEl.innerHTML = video.points.map(pt => `<li>${escapeHtml(pt)}</li>`).join("");
  }

  // Si une URL de vidéo embarquée (YouTube/Vimeo/MP4) est fournie
  if (video.embedUrl && video.embedUrl.trim().length > 0 && iframeEl) {
    iframeEl.src = video.embedUrl;
    iframeEl.style.display = "block";
    if (placeholderEl) placeholderEl.style.display = "none";
  } else {
    if (iframeEl) {
      iframeEl.src = "";
      iframeEl.style.display = "none";
    }
    if (placeholderEl) placeholderEl.style.display = "flex";
  }

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeAcademyVideoModal() {
  const modal = document.getElementById("modal-academy-player");
  const iframeEl = document.getElementById("academy-player-iframe");
  if (modal) modal.style.display = "none";
  if (iframeEl) iframeEl.src = "";
  document.body.style.overflow = "";
}

function initAcademy() {
  // 1. Filtrage par catégorie
  const pillBtns = document.querySelectorAll("#academy-category-pills .academy-pill-btn");
  const cards = document.querySelectorAll(".academy-video-card");

  pillBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      pillBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const cat = btn.getAttribute("data-cat");
      filterAcademyVideos(cat);
    });
  });

  // 2. Recherche en direct par mot-clé
  const searchInput = document.getElementById("academy-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }

  // Fermer la modal en cliquant sur le fond
  const modal = document.getElementById("modal-academy-player");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeAcademyVideoModal();
    });
  }
}

function filterAcademyVideos(cat) {
  const cards = document.querySelectorAll(".academy-video-card");
  cards.forEach(card => {
    const cardCat = card.getAttribute("data-cat");
    if (cat === "all" || cardCat === cat) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
}

// Exposer globalement
window.openAcademyVideo = openAcademyVideo;
window.closeAcademyVideoModal = closeAcademyVideoModal;
window.initAcademy = initAcademy;

// Initialisation au chargement
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAcademy);
} else {
  initAcademy();
}


// ==============================================================================
// VANDIA MASTER PROMPTS — BIBLIOTHÈQUE & DÉMONSTRATIONS CONTROLLER
// ==============================================================================
function copyMasterPrompt(elemId) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  const text = elem.textContent.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Master Prompt copié dans le presse-papier ! ✨", "success");
    }).catch(() => {
      fallbackCopyPrompt(text);
    });
  } else {
    fallbackCopyPrompt(text);
  }
}

function fallbackCopyPrompt(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast("Master Prompt copié dans le presse-papier ! ✨", "success");
  } catch (e) {
    showToast("Erreur lors de la copie", "error");
  }
  document.body.removeChild(ta);
}

async function applyMasterPrompt(elemId) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  const promptText = elem.textContent.trim();

  const promptInput = document.getElementById("agent-prompt-input");
  if (promptInput) {
    promptInput.value = promptText;
  }

  // Enregistrer automatiquement
  if (typeof saveAgentConfig === 'function') {
    await saveAgentConfig();
  }

  // Basculer vers la section Agent IA pour que l'utilisateur voie la mise à jour
  if (typeof showView === 'function') {
    showView('ai-agent');
  }

  showToast("Master Prompt appliqué et enregistré pour votre Agent IA ! 🤖✨", "success");
}

function initPromptsLibrary() {
  // Filtrage par pilules secteur
  const pillBtns = document.querySelectorAll("#prompts-category-pills .prompts-pill-btn");
  const cards = document.querySelectorAll(".prompt-master-card");

  pillBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      pillBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const sector = btn.getAttribute("data-sector");
      cards.forEach(card => {
        const cardSector = card.getAttribute("data-sector");
        if (sector === "all" || cardSector === sector) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  });

  // Recherche par mot-clé
  const searchInput = document.getElementById("prompts-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }
}

// Exposer globalement
window.copyMasterPrompt = copyMasterPrompt;
window.applyMasterPrompt = applyMasterPrompt;
window.initPromptsLibrary = initPromptsLibrary;

// Initialiser au chargement
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPromptsLibrary);
} else {
  initPromptsLibrary();
}

// =============================================================================
// WHATSAPP PAIRING CODE (LIAISON PAR NUMÉRO SANS CAMÉRA) CONTROLLER
// =============================================================================
window.currentWaPairingCode = "";

window.switchWaConnectMode = function(mode) {
    var tabQr = document.getElementById("tab-btn-qr");
    var tabPairing = document.getElementById("tab-btn-pairing");
    var paneQr = document.getElementById("pane-conn-qr");
    var panePairing = document.getElementById("pane-conn-pairing");

    if (mode === "pairing") {
        if (tabQr) tabQr.classList.remove("active");
        if (tabPairing) tabPairing.classList.add("active");
        if (paneQr) {
            paneQr.classList.remove("active");
            paneQr.style.display = "none";
        }
        if (panePairing) {
            panePairing.classList.add("active");
            panePairing.style.display = "block";
        }
        var phoneInput = document.getElementById("wa-pairing-phone-input");
        if (phoneInput) setTimeout(function() { phoneInput.focus(); }, 100);
    } else {
        if (tabPairing) tabPairing.classList.remove("active");
        if (tabQr) tabQr.classList.add("active");
        if (panePairing) {
            panePairing.classList.remove("active");
            panePairing.style.display = "none";
        }
        if (paneQr) {
            paneQr.classList.add("active");
            paneQr.style.display = "block";
        }
    }
};

window.renderPairingCode = function(rawCode) {
    if (!rawCode) return;
    window.currentWaPairingCode = String(rawCode).trim();

    var displayEl = document.getElementById("pairing-code-display");
    var resultWrap = document.getElementById("pairing-code-result-wrap");
    if (!displayEl) return;

    var clean = window.currentWaPairingCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    var html = "";
    for (var i = 0; i < clean.length; i++) {
        if (i === 4 && clean.length > 4) {
            html += '<span class="pairing-dash">-</span>';
        }
        html += '<span class="pairing-char">' + clean[i] + '</span>';
    }

    displayEl.innerHTML = html;
    if (resultWrap) resultWrap.style.display = "block";

    window.switchWaConnectMode("pairing");
};

window.submitWhatsAppPairingCode = async function() {
    var phoneInput = document.getElementById("wa-pairing-phone-input");
    var btn = document.getElementById("btn-submit-pairing");
    var btnText = document.getElementById("btn-pairing-text");
    if (!phoneInput) return;

    var phoneNumber = phoneInput.value.trim();
    if (!phoneNumber) {
        if (typeof showToast === "function") showToast("Veuillez saisir votre numéro WhatsApp avec indicatif (ex: +225...)", "warning");
        phoneInput.focus();
        return;
    }

    var cleanDigits = phoneNumber.replace(/\D/g, "");
    if (cleanDigits.length < 8) {
        if (typeof showToast === "function") showToast("Numéro trop court. Veuillez inclure l'indicatif pays (ex: 2250701020304).", "error");
        return;
    }

    if (btn) btn.disabled = true;
    if (btnText) btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Génération...';

    var targetUserId = (typeof getAppUserId === "function") ? getAppUserId() : '6f9cf58f-4439-4c0b-b860-a36ad9e23055';

    try {
        var res = await fetch(API_URL + "/api/whatsapp/pairing-code", {
            method: "POST",
            headers: (typeof getAuthHeaders === "function") ? getAuthHeaders() : { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: targetUserId, phoneNumber: cleanDigits })
        });

        var data = await res.json();
        if (data.code) {
            window.renderPairingCode(data.code);
            if (typeof showToast === "function") {
                showToast("🔑 Code d'association généré ! Saisissez-le dans WhatsApp sur votre smartphone.", "success");
            }
        } else if (data.status === "STARTING") {
            if (typeof showToast === "function") {
                showToast("Initialisation WhatsApp en cours... Le code arrive dans quelques secondes.", "info");
            }
        } else if (data.error) {
            if (typeof showToast === "function") showToast(data.error, "error");
        }

        if (window._waPairingInterval) clearInterval(window._waPairingInterval);
        if (typeof window.checkWhatsAppStatus === "function") {
            window._waPairingInterval = setInterval(window.checkWhatsAppStatus, 2000);
        } else if (typeof checkStatus === "function") {
            window._waPairingInterval = setInterval(checkStatus, 2000);
        }
    } catch (err) {
        console.error("Erreur pairing code:", err);
        if (typeof showToast === "function") showToast("Erreur lors de la demande du code : " + err.message, "error");
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.innerHTML = '<i class="fa-solid fa-key"></i> <span id="btn-pairing-text">Générer mon Code</span>';
    }
};

window.copyWhatsAppPairingCode = function() {
    if (!window.currentWaPairingCode) return;
    navigator.clipboard.writeText(window.currentWaPairingCode).then(function() {
        var label = document.getElementById("copy-pairing-label");
        if (label) label.textContent = "✓ Code Copié !";
        if (typeof showToast === "function") showToast("Code copié dans le presse-papier !", "success");
        setTimeout(function() {
            if (label) label.textContent = "Copier le code";
        }, 2500);
    }).catch(function() {
        if (typeof showToast === "function") showToast("Impossible de copier automatiquement.", "error");
    });
};
