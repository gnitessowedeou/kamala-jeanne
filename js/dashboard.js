/**
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
    let u = null;
    try {
        u = JSON.parse(localStorage.getItem('vendia_current_user'));
    } catch(e) {}
    if (!u || !u.id || u.id.startsWith('usr_guest')) {
        window.location.href = 'index.html';
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
      name: "Essai Gratuit 7j 🦾",
      badge: "300 CRÉDITS",
      tokensUsed: 0,
      tokensMax: 300,
      percentage: 0
    }
  },

  currency: "XOF", // 'XOF' or 'USD'
  exchangeRate: 615, // 1 USD ~ 615 XOF

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
      labels: ["01 Oct", "02 Oct", "03 Oct", "04 Oct", "05 Oct", "06 Oct", "07 Oct", "08 Oct", "09 Oct", "10 Oct", "11 Oct", "12 Oct", "13 Oct", "Aujourd'hui"],
      salesUsd: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      salesXof: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      conversations: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    "30": {
      labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      salesUsd: [0, 0, 0, 0],
      salesXof: [0, 0, 0, 0],
      conversations: [0, 0, 0, 0]
    },
    "90": {
      labels: ["Mois 1", "Mois 2", "Mois en cours"],
      salesUsd: [0, 0, 0],
      salesXof: [0, 0, 0],
      conversations: [0, 0, 0]
    }
  },

  recentInteractions: [
    {
      client: "Amina Traoré",
      phone: "+225 07 48 99 12",
      date: "Aujourd'hui, 15:42",
      action: "Paiement Wave (25 000 XOF) reçu",
      status: "Clôturé (Payé)",
      statusType: "green"
    },
    {
      client: "Marc Koffi",
      phone: "+225 05 99 22 11",
      date: "Aujourd'hui, 14:30",
      action: "Relance Panier Abandonné envoyée",
      status: "En attente",
      statusType: "amber"
    },
    {
      client: "Fatou Diallo",
      phone: "+221 77 123 45 67",
      date: "Aujourd'hui, 12:15",
      action: "Conseil catalogue & Taille recommandé",
      status: "En cours (IA)",
      statusType: "cyan"
    },
    {
      client: "Moussa Koné",
      phone: "+223 66 78 90 12",
      date: "Hier, 19:10",
      action: "Paiement Orange Money (40 000 XOF)",
      status: "Clôturé (Payé)",
      statusType: "green"
    },
    {
      client: "Sophie Badolo",
      phone: "+226 70 88 11 22",
      date: "Hier, 16:05",
      action: "Devis Pack Grossiste généré",
      status: "En attente",
      statusType: "amber"
    }
  ],

  conversations: [
    {
      id: "conv_1",
      name: "Amina Traoré",
      phone: "+225 07 48 99 12 • Abidjan, CI",
      avatar: "AT",
      lastMessage: "J'ai validé le paiement Wave ! Merci pour le code promo.",
      time: "15:42",
      unread: false,
      aiActive: true,
      tag: "VIP",
      messages: [
        { sender: "client", text: "Bonjour ! Est-ce que le Pack Vente Pro est encore disponible avec la promo ?", time: "15:38" },
        { sender: "agent", text: "Bonjour Amina ! Absolument, il reste 3 licences au tarif promotionnel aujourd'hui. Souhaitez-vous que je vous réserve une clé avec le lien direct Wave ?", time: "15:39" },
        { sender: "client", text: "Oui super, envoyez-moi le lien svp !", time: "15:40" },
        { sender: "agent", text: "Voici votre lien sécurisé : https://pay.wave.com/m/vendia-pack (Montant : 25 000 XOF). Dès validation, votre accès est activé automatiquement.", time: "15:41" },
        { sender: "client", text: "J'ai validé le paiement Wave ! Merci pour le code promo.", time: "15:42" }
      ]
    },
    {
      id: "conv_2",
      name: "Marc Koffi",
      phone: "+225 05 99 22 11 • Abidjan, CI",
      avatar: "MK",
      lastMessage: "Est-ce qu'on peut payer par tranche de 2 fois ?",
      time: "14:30",
      unread: true,
      aiActive: true,
      tag: "Panier Abandonné",
      messages: [
        { sender: "system", text: "Panier abandonné détecté (Montant : 45 000 XOF)", time: "14:15" },
        { sender: "agent", text: "Bonjour Marc 👋 Nous avons remarqué que votre commande est en attente. Une hésitation particulière ?", time: "14:28" },
        { sender: "client", text: "Est-ce qu'on peut payer par tranche de 2 fois ?", time: "14:30" }
      ]
    },
    {
      id: "conv_3",
      name: "Fatou Diallo",
      phone: "+221 77 123 45 67 • Dakar, SN",
      avatar: "FD",
      lastMessage: "Parfait, je finalise la commande ce soir.",
      time: "12:15",
      unread: false,
      aiActive: true,
      tag: "Prospect Chaud",
      messages: [
        { sender: "client", text: "Bonjour, vos livraisons sur Dakar se font en combien de temps ?", time: "12:10" },
        { sender: "agent", text: "Bonjour Fatou ! Livraison express en 24h ouvrées partout à Dakar par nos livreurs partenaires.", time: "12:12" },
        { sender: "client", text: "Parfait, je finalise la commande ce soir.", time: "12:15" }
      ]
    },
    {
      id: "conv_4",
      name: "Moussa Koné",
      phone: "+223 66 78 90 12 • Bamako, ML",
      avatar: "MK",
      lastMessage: "Colis bien reçu par mon frère, merci !",
      time: "Hier",
      unread: false,
      aiActive: false,
      tag: "Client Fidèle",
      messages: [
        { sender: "client", text: "Colis bien reçu par mon frère, merci !", time: "Hier 19:10" },
        { sender: "agent", text: "Un plaisir de vous servir Moussa ! N'hésitez pas si vous avez besoin d'aide pour l'installation.", time: "Hier 19:12" }
      ]
    }
  ],

  campaigns: [
    {
      name: "Promo Flash VIP Weekend",
      audience: "Clients VIP & Récents",
      recipients: "1 500",
      openRate: "94.2%",
      date: "08 Oct 2026",
      status: "Terminé",
      statusType: "green"
    },
    {
      name: "Relance Paniers Abandonnés 48h",
      audience: "Paniers non payés",
      recipients: "142",
      openRate: "88.5%",
      date: "07 Oct 2026",
      status: "Actif (Automatique)",
      statusType: "cyan"
    },
    {
      name: "Lancement Nouvelle Collection Automne",
      audience: "Tous les contacts (5k)",
      recipients: "5 280",
      openRate: "97.1%",
      date: "01 Oct 2026",
      status: "Terminé",
      statusType: "green"
    }
  ],

  automations: [
    {
      title: "Tunnel Vente Flash WhatsApp",
      trigger: "Mot-clé 'PROMO' ou Scan QR Code",
      steps: 5,
      contacts: "0 contact",
      conversion: "0.0%",
      active: true,
      icon: "fa-bolt"
    },
    {
      title: "Relance Panier Abandonné",
      trigger: "Abandon Shopify/WooCommerce > 30 min",
      steps: 3,
      contacts: "0 relancé",
      conversion: "0.0%",
      active: true,
      icon: "fa-cart-arrow-down"
    },
    {
      title: "Qualification & Prise de Devis",
      trigger: "Widget WhatsApp Site Web",
      steps: 4,
      contacts: "0 prospect",
      conversion: "0.0%",
      active: true,
      icon: "fa-clipboard-question"
    },
    {
      title: "Réactivation Clients Inactifs (30 jours)",
      trigger: "Aucune commande depuis 30 jours",
      steps: 2,
      contacts: "0 cible",
      conversion: "0.0%",
      active: false,
      icon: "fa-clock-rotate-left"
    }
  ],

  contacts: [
    { name: "Amina Traoré", phone: "+225 07 48 99 12", date: "Il y a 3 min", tag: "VIP", tagClass: "badge-purple", total: "145 000 XOF", avatar: "AT" },
    { name: "Marc Koffi", phone: "+225 05 99 22 11", date: "Il y a 1h", tag: "Panier", tagClass: "badge-amber", total: "45 000 XOF", avatar: "MK" },
    { name: "Fatou Diallo", phone: "+221 77 123 45 67", date: "Il y a 3h", tag: "Chaud", tagClass: "badge-cyan", total: "25 000 XOF", avatar: "FD" },
    { name: "Moussa Koné", phone: "+223 66 78 90 12", date: "Hier", tag: "VIP", tagClass: "badge-purple", total: "220 000 XOF", avatar: "MK" },
    { name: "Sophie Badolo", phone: "+226 70 88 11 22", date: "Hier", tag: "Chaud", tagClass: "badge-cyan", total: "85 000 XOF", avatar: "SB" },
    { name: "Jean-Eudes Kouassi", phone: "+225 01 22 33 44", date: "Il y a 2j", tag: "Tous", tagClass: "badge-subtle", total: "15 000 XOF", avatar: "JK" }
  ],

  templates: [
    {
      name: "Confirmation Commande & Wave",
      category: "Utilitaire",
      status: "Approuvé Meta",
      statusType: "green",
      content: "Bonjour {{1}}, votre commande #{{2}} a bien été enregistrée. Cliquez ci-dessous pour régler directement via Wave en un clic.",
      cta: "Payer via Wave"
    },
    {
      name: "Promo Flash VIP Exclusive",
      category: "Marketing",
      status: "Approuvé Meta",
      statusType: "green",
      content: "Salut {{1}} ! 🔥 Accès exclusif à notre vente flash 48h. Profitez de -20% sur l'ensemble de vos articles favoris dès maintenant.",
      cta: "Voir les Offres"
    },
    {
      name: "Relance Douce Panier 30min",
      category: "Marketing",
      status: "Approuvé Meta",
      statusType: "green",
      content: "Bonjour {{1}} 👋 Votre panier vous attend ! Avez-vous besoin d'un conseil ou d'une précision sur un produit avant de valider ?",
      cta: "Finaliser la commande"
    },
    {
      name: "Notification Expédition Colis",
      category: "Utilitaire",
      status: "En attente Meta",
      statusType: "amber",
      content: "Excellente nouvelle {{1}} ! Votre colis vient d'être remis au transporteur. Suivez l'acheminement en direct avec le code {{2}}.",
      cta: "Suivre mon colis"
    }
  ],

  integrations: [
    { name: "Wave Mobile Money", desc: "Paiements instantanés sans frais cachés en Côte d'Ivoire & Sénégal.", icon: "fa-water", color: "var(--cyan)", status: "Connecté", active: true },
    { name: "Orange Money", desc: "Passerelle Web Payment & QR Code pour toute la zone UEMOA.", icon: "fa-circle", color: "#f97316", status: "Connecté", active: true },
    { name: "MTN MoMo", desc: "Paiements mobiles MTN pour Côte d'Ivoire, Bénin, Ghana.", icon: "fa-bolt", color: "var(--amber)", status: "Connecté", active: true },
    { name: "Stripe", desc: "Encaissement international par Carte Bancaire Visa & Mastercard.", icon: "fa-credit-card", color: "var(--purple)", status: "Connecté", active: true },
    { name: "Shopify", desc: "Synchronisation des commandes, stocks et paniers abandonnés.", icon: "fa-bag-shopping", color: "#95bf47", status: "Connecté", active: true },
    { name: "Webhooks Meta API", desc: "Flux direct d'événements et double routage vers vos serveurs.", icon: "fa-network-wired", color: "var(--whatsapp-green)", status: "Actif (200 OK)", active: true }
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
  initDashboard();
});

function initDashboard() {
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

  // Populate view contents
  renderKpis();
  renderActivityFeed();
  renderRecentInteractions();
  renderBroadcastCampaigns();
  renderAutomations();
  renderContacts();
  renderTemplates();
  renderIntegrations();

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

  // Recent WhatsApp Conversation Rows (Fatou Diallo, Ibrahim Koné, Mariam Traoré)
  document.querySelectorAll(".mobile-chat-row").forEach(row => {
    row.addEventListener("click", () => {
      showView("inbox");
      const contactName = row.getAttribute("data-chat-contact") || "";
      const contactPhone = row.getAttribute("data-chat-phone") || "";
      const preview = row.querySelector(".mobile-chat-preview")?.textContent || "";
      
      let targetConv = MOCK_DATA.conversations.find(c => c.name.toLowerCase().includes(contactName.split(" ")[0].toLowerCase()));
      if (!targetConv && contactName) {
        targetConv = {
          id: "conv_sim_" + Date.now(),
          name: contactName,
          phone: contactPhone + " • Abidjan, CI",
          avatar: contactName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
          lastMessage: preview,
          time: "À l'instant",
          unread: false,
          aiActive: true,
          tag: "Prospect Chaud",
          messages: [
            { sender: "client", text: preview, time: "À l'instant" }
          ]
        };
      }
      if (targetConv && typeof openConversation === "function") {
        openConversation(targetConv);
      }
    });
  });

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
  } else if (viewId === "analytics" && hourlyChartInstance) {
    hourlyChartInstance.resize();
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
      "affiliate": "fa-handshake"
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
  return {
    salesUsd: 0,
    salesXof: 0,
    salesTrend: "0%",
    salesNote: "En attente de vos premières commandes WhatsApp",
    conversations: 0,
    conversationsTrend: "0%",
    conversationsNote: "Votre commercial IA est prêt et en attente",
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

  if (!isCurrentUserDemo()) {
    container.innerHTML = `
      <div class="activity-item">
        <div class="activity-icon-wrapper" style="background: rgba(37, 211, 102, 0.15); color: var(--whatsapp-green);">
          <i class="fa-solid fa-check"></i>
        </div>
        <div class="activity-info">
          <div class="activity-text">
            <strong>Votre instance VANDIA IA est active et prête !</strong> Les commandes WhatsApp et paiements Wave/OM apparaîtront ici en direct.
          </div>
          <div class="activity-meta">À l'instant • Mode Réel Actif</div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="activity-item">
      <div class="activity-icon-wrapper" style="background: rgba(37, 211, 102, 0.15); color: var(--whatsapp-green);">
        <i class="fa-solid fa-check"></i>
      </div>
      <div class="activity-info">
        <div class="activity-text">
          Paiement reçu de <strong>Amina Traoré</strong> via Wave (<strong>25 000 XOF</strong>) après recommandation de l'Agent IA.
        </div>
        <div class="activity-meta">Il y a 3 minutes • Tunnel Vente Flash WhatsApp</div>
      </div>
    </div>
    <div class="activity-item">
      <div class="activity-icon-wrapper" style="background: rgba(245, 158, 11, 0.15); color: var(--amber);">
        <i class="fa-solid fa-cart-arrow-down"></i>
      </div>
      <div class="activity-info">
        <div class="activity-text">
          Relance automatique panier abandonné envoyée à <strong>Marc Koffi</strong> (Panier: 45 000 XOF).
        </div>
        <div class="activity-meta">Il y a 14 minutes • Relance Panier 48h</div>
      </div>
    </div>
    <div class="activity-item">
      <div class="activity-icon-wrapper" style="background: rgba(6, 182, 212, 0.15); color: var(--cyan);">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="activity-info">
        <div class="activity-text">
          L'Agent IA a répondu à <strong>Fatou Diallo</strong> concernant les délais de livraison à Dakar.
        </div>
        <div class="activity-meta">Il y a 32 minutes • FAQ &amp; Service Client Auto</div>
      </div>
    </div>
    <div class="activity-item">
      <div class="activity-icon-wrapper" style="background: rgba(139, 92, 246, 0.15); color: var(--purple);">
        <i class="fa-solid fa-paper-plane"></i>
      </div>
      <div class="activity-info">
        <div class="activity-text">
          Campagne <em>Promo Flash VIP Weekend</em> terminée : <strong>1 500 contacts</strong> touchés, 94.2% taux d'ouverture.
        </div>
        <div class="activity-meta">Il y a 1 heure • Diffusion SafeSend™</div>
      </div>
    </div>
  `;
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
// 9. INBOX & WHATSAPP CHAT LOGIC
// ==============================================================================
function setupInboxInteraction() {
  renderConversationList();
  loadConversation(MOCK_DATA.conversations[0]);

  // Chat message send form
  const chatForm = document.getElementById("chat-input-form");
  const chatInput = document.getElementById("chat-message-input");

  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const messageText = chatInput.value.trim();
      if (!messageText) return;

      // Add user message to conversation
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      activeConversation.messages.push({
        sender: "agent",
        text: messageText,
        time: timeStr
      });

      renderChatMessages();
      chatInput.value = "";

      // Simulate client response after 1.5s
      setTimeout(() => {
        simulateClientResponse();
      }, 1400);
    });
  }

  // Quick Action Chips
  document.querySelectorAll(".quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-text");
      const chatInput = document.getElementById("chat-message-input");
      if (chatInput) {
        chatInput.value = text;
        chatInput.focus();
      }
    });
  });

  // Mobile Back Button to return to conversations list
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

  // Search filter inside inbox
  const inboxSearch = document.getElementById("inbox-search-input");
  if (inboxSearch) {
    inboxSearch.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll(".conv-item").forEach(item => {
        const name = item.querySelector(".conv-name").textContent.toLowerCase();
        const snippet = item.querySelector(".conv-preview").textContent.toLowerCase();
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

  listContainer.innerHTML = MOCK_DATA.conversations.map((conv, idx) => `
    <div class="conv-item ${idx === 0 ? 'active' : ''}" data-conv-id="${conv.id}">
      <div class="conv-avatar">
        ${conv.avatar}
        <span class="conv-online-dot"></span>
      </div>
      <div class="conv-details">
        <div class="conv-top-row">
          <span class="conv-name">${conv.name}</span>
          <span class="conv-time">${conv.time}</span>
        </div>
        <div class="conv-bottom-row">
          <span class="conv-preview">${conv.lastMessage}</span>
          ${conv.unread ? `<span class="badge badge-green" style="font-size: 10px;">1</span>` : ''}
        </div>
      </div>
    </div>
  `).join("");

  // Attach click listener
  listContainer.querySelectorAll(".conv-item").forEach(item => {
    item.addEventListener("click", () => {
      const convId = item.getAttribute("data-conv-id");
      const found = MOCK_DATA.conversations.find(c => c.id === convId);
      if (found) {
        listContainer.querySelectorAll(".conv-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        found.unread = false;
        loadConversation(found);

        // Sur mobile, bascule vers la fenêtre de discussion active
        const inboxLayout = document.querySelector(".inbox-layout");
        if (inboxLayout) inboxLayout.classList.add("chat-open");
      }
    });
  });

  if (MOCK_DATA.conversations.length > 0) {
    loadConversation(MOCK_DATA.conversations[0]);
  }
}

function loadConversation(conv) {
  activeConversation = conv;

  const nameEl = document.getElementById("active-chat-name");
  const phoneEl = document.getElementById("active-chat-phone");
  const avatarEl = document.getElementById("active-chat-avatar");

  if (nameEl) nameEl.textContent = conv.name;
  if (phoneEl) phoneEl.textContent = conv.phone;
  if (avatarEl) avatarEl.textContent = conv.avatar;

  renderChatMessages();
}

function renderChatMessages() {
  const stream = document.getElementById("chat-messages-stream");
  if (!stream) return;

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
          <span>${escapeHtml(msg.time)}</span>
          ${isOutgoing ? `<i class="fa-solid fa-check-double double-tick"></i>` : ''}
        </div>
      </div>
    `;
  }).join("");

  // Scroll to bottom
  stream.scrollTop = stream.scrollHeight;
}

function simulateClientResponse() {
  const responses = [
    "D'accord, je regarde ça de suite !",
    "C'est noté, je valide le paiement Wave dès que possible.",
    "Merci beaucoup pour la rapidité de réponse !",
    "Pouvez-vous me confirmer le numéro pour la livraison ?"
  ];
  const randomResp = responses[Math.floor(Math.random() * responses.length)];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  activeConversation.messages.push({
    sender: "client",
    text: randomResp,
    time: timeStr
  });

  renderChatMessages();
  showToast(`Nouveau message WhatsApp de ${activeConversation.name}`, "info");
}

// ==============================================================================
// 10. DYNAMIC CONTENT RENDERING (Tables & Cards)
// ==============================================================================
function renderRecentInteractions() {
  const tbody = document.getElementById("table-interactions-body");
  if (!tbody) return;

  if (!isCurrentUserDemo()) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 24px; color: var(--text-muted);">
          Aucune conversation client pour l'instant. Votre agent commercial attend vos premiers prospects.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = MOCK_DATA.recentInteractions.map(item => `
    <tr>
      <td>
        <div style="display: flex; flex-direction: column;">
          <span>${item.client}</span>
          <span style="font-size: 11.5px; color: var(--text-muted); font-weight: normal;">${item.phone}</span>
        </div>
      </td>
      <td>${item.date}</td>
      <td>${item.action}</td>
      <td>
        <span class="badge badge-${item.statusType}">${item.status}</span>
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

function renderAutomations() {
  const container = document.getElementById("automations-grid-container");
  if (!container) return;

  container.innerHTML = MOCK_DATA.automations.map(auto => `
    <div class="glass-panel auto-card">
      <div class="auto-card-top">
        <div class="auto-title-wrap">
          <div class="auto-icon-box">
            <i class="fa-solid ${auto.icon}"></i>
          </div>
          <div>
            <h3 style="font-size: 15px; font-weight: 700;">${auto.title}</h3>
            <span style="font-size: 11.5px; color: var(--text-muted);">Déclencheur : ${auto.trigger}</span>
          </div>
        </div>
        <label class="switch-control">
          <input type="checkbox" ${auto.active ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>

      <div class="auto-stats-row">
        <div class="auto-stat-item">
          <span class="auto-stat-val">${auto.steps} étapes</span>
          <span class="auto-stat-lbl">Structure Funnel</span>
        </div>
        <div class="auto-stat-item">
          <span class="auto-stat-val">${auto.contacts}</span>
          <span class="auto-stat-lbl">Passages Enregistrés</span>
        </div>
        <div class="auto-stat-item">
          <span class="auto-stat-val" style="color: var(--whatsapp-green);">${auto.conversion}</span>
          <span class="auto-stat-lbl">Taux Conversion</span>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn-secondary-glass" style="padding: 6px 14px; font-size: 12px;">Éditer le flux</button>
        <button class="btn-primary-glow" style="padding: 6px 14px; font-size: 12px;">Tester</button>
      </div>
    </div>
  `).join("");
}

function renderContacts() {
  const tbody = document.getElementById("contacts-table-body");
  if (!tbody) return;

  if (!isCurrentUserDemo()) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
          Votre base CRM est prête. Vos prospects WhatsApp seront enregistrés automatiquement dès leur premier message.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = MOCK_DATA.contacts.map(c => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="conv-avatar" style="width: 32px; height: 32px; font-size: 11px;">${c.avatar}</div>
          <span>${c.name}</span>
        </div>
      </td>
      <td>${c.phone}</td>
      <td>${c.date}</td>
      <td><span class="badge ${c.tagClass}">${c.tag}</span></td>
      <td><strong>${c.total}</strong></td>
      <td>
        <button class="header-icon-btn btn-open-chat-contact" title="Ouvrir Live Chat" data-phone="${c.phone}">
          <i class="fa-brands fa-whatsapp"></i>
        </button>
      </td>
    </tr>
  `).join("");

  // Attach direct chat trigger
  tbody.querySelectorAll(".btn-open-chat-contact").forEach(btn => {
    btn.addEventListener("click", () => {
      showView("inbox", "Boîte de Réception WhatsApp");
    });
  });
}

function renderTemplates() {
  const container = document.getElementById("templates-grid-container");
  if (!container) return;

  container.innerHTML = MOCK_DATA.templates.map(tpl => `
    <div class="glass-panel template-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 style="font-size: 14.5px; font-weight: 700;">${tpl.name}</h3>
          <span style="font-size: 11px; color: var(--text-muted);">Catégorie : ${tpl.category}</span>
        </div>
        <span class="badge badge-${tpl.statusType}">${tpl.status}</span>
      </div>

      <div class="template-bubble-preview">
        <p>${tpl.content}</p>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; font-weight: 600; color: var(--cyan); font-size: 12px;">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> ${tpl.cta}
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn-secondary-glass" style="padding: 5px 12px; font-size: 12px;">Dupliquer</button>
        <button class="btn-primary-glow" style="padding: 5px 12px; font-size: 12px;">Utiliser</button>
      </div>
    </div>
  `).join("");
}

function renderIntegrations() {
  const container = document.getElementById("integrations-grid-container");
  if (!container) return;

  container.innerHTML = MOCK_DATA.integrations.map(integ => `
    <div class="glass-panel integ-card">
      <div>
        <div class="integ-top">
          <div class="integ-logo" style="color: ${integ.color};">
            <i class="fa-solid ${integ.icon}"></i>
          </div>
          <div>
            <h3 style="font-size: 15px; font-weight: 700;">${integ.name}</h3>
            <span class="badge badge-green">${integ.status}</span>
          </div>
        </div>
        <p class="integ-desc">${integ.desc}</p>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
        <span style="font-size: 12px; color: var(--text-muted);">Actif sur WhatsApp</span>
        <label class="switch-control">
          <input type="checkbox" ${integ.active ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
    </div>
  `).join("");
}

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
// 12. ACTION BUTTONS & TOAST SYSTEM
// ==============================================================================
function setupActionButtons() {
  // Floating WhatsApp button
  const floatBtn = document.getElementById("floating-whatsapp-btn");
  if (floatBtn) {
    floatBtn.addEventListener("click", () => {
      showView("inbox", "Boîte de Réception WhatsApp");
      showToast("Ouverture de la discussion client en direct", "info");
    });
  }

      // Load AI Agent settings
    const agentPromptInput = document.getElementById("agent-prompt-input");
    let userId = '';
      try {
          const u = JSON.parse(localStorage.getItem('vendia_current_user'));
          if (u && u.id) userId = u.id;
      } catch(e) {}
    
    if (agentPromptInput) {
        fetch('http://localhost:8080/api/ai/config/' + userId)
            .then(res => res.json())
            .then(data => {
                if (data.prompt) {
                    agentPromptInput.value = data.prompt;
                }
            })
            .catch(err => console.error("Erreur chargement prompt", err));
    }

    // Save AI Agent settings
    const saveAgentBtn = document.getElementById("btn-save-agent");
    if (saveAgentBtn && agentPromptInput) {
      saveAgentBtn.addEventListener("click", () => {
        saveAgentBtn.disabled = true;
        saveAgentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sauvegarde...';
        
        fetch('http://localhost:8080/api/ai/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, prompt: agentPromptInput.value })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Configuration de l'Agent IA synchronisée avec succès !", "success");
            } else {
                showToast("Erreur lors de la sauvegarde.", "error");
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Erreur de connexion au serveur.", "error");
        })
        .finally(() => {
            saveAgentBtn.disabled = false;
            saveAgentBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
        });
      });
    }

  // Tone selector buttons
  const toneBtns = document.querySelectorAll("#tone-selector .tag-select-btn");
  toneBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      toneBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

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

  // Export CSV CRM
  const exportCrmBtn = document.getElementById("btn-export-crm");
  if (exportCrmBtn) {
    exportCrmBtn.addEventListener("click", () => {
      showToast("Génération de l'export contacts_crm_vandia.csv...", "info");
      setTimeout(() => {
        showToast("Téléchargement du fichier CSV terminé !", "success");
      }, 1000);
    });
  }

  // Logout button
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
    if (phoneEl) phoneEl.textContent = user.fullPhone || user.phoneNumber || "";

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
    if (inputPhone) inputPhone.value = user.phoneNumber || "";

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
        alert("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP). Les formats vectoriels SVG ne sont pas autorisés pour des raisons de sécurité.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("La taille de l'image ne doit pas dépasser 5 Mo.");
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
        alert("Veuillez renseigner votre prénom.");
        return;
      }
      if (!lastName) {
        alert("Veuillez renseigner votre nom.");
        return;
      }
      if (window.AuthEngine && !window.AuthEngine.isValidPhone(phoneNumber)) {
        alert("Veuillez renseigner un numéro WhatsApp valide.");
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
        window.AuthEngine.showToast("Profil mis à jour avec succès.", "success");
      } else {
        alert(res.error || "Une erreur est survenue lors de la mise à jour.");
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

  // 1. Upgrade Trigger Buttons
  const headerUpgradeBtn = document.getElementById("btn-header-upgrade");
  if (headerUpgradeBtn) {
    headerUpgradeBtn.addEventListener("click", () => openPlanModal("pro"));
  }

  const sidebarUpgradeBtn = document.getElementById("btn-sidebar-upgrade");
  if (sidebarUpgradeBtn) {
    sidebarUpgradeBtn.addEventListener("click", () => openPlanModal("pro"));
  }

  document.querySelectorAll(".btn-trigger-plan-modal").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const planTier = btn.getAttribute("data-plan") || "pro";
      openPlanModal(planTier);
    });
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

  // 3. Plan Selection & Price Calculation in Modal
  function updatePlanModalSummary() {
    const selectedPlanRadio = document.querySelector('input[name="modal_plan_tier"]:checked');
    const selectedCycleRadio = document.querySelector('input[name="modal_cycle"]:checked');
    const selectedTier = selectedPlanRadio ? selectedPlanRadio.value : "pro";
    const selectedCycle = selectedCycleRadio ? selectedCycleRadio.value : "monthly";

    const titleEl = document.getElementById("summary-plan-title");
    const cycleEl = document.getElementById("summary-plan-cycle");
    const amountEl = document.getElementById("summary-total-amount");

    const isAnnual = selectedCycle === "annual";

    let planName = "Formule Pro 🚀";
    let basePriceMonthly = 14900;

    if (selectedTier === "basic") {
      planName = "Formule Basic 🦾";
      basePriceMonthly = 7900;
    } else if (selectedTier === "business" || selectedTier === "enterprise") {
      planName = "Formule Business 💎";
      basePriceMonthly = 30000;
    }

    if (titleEl) titleEl.textContent = planName;
    if (cycleEl) {
      cycleEl.textContent = isAnnual ? "Annuel (-20% déduit)" : "Mensuel (Sans engagement)";
    }

    if (amountEl) {
      const finalPrice = isAnnual ? Math.round(basePriceMonthly * 12 * 0.8) : basePriceMonthly;
      const formattedPrice = finalPrice.toLocaleString("fr-FR") + " FCFA" + (isAnnual ? "/an" : "/mois");
      amountEl.textContent = formattedPrice;
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

  // Cycle selector pills click
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

      const phoneGroup = document.getElementById("pay-phone-group");
      if (phoneGroup) {
        if (radio && radio.value === "card") {
          phoneGroup.style.display = "none";
        } else {
          phoneGroup.style.display = "block";
        }
      }
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
    if (dashFreqMonthly) dashFreqMonthly.classList.toggle("active", !isAnnual);
    if (dashFreqAnnual) dashFreqAnnual.classList.toggle("active", isAnnual);

    if (dashPriceBasic) {
      dashPriceBasic.textContent = isAnnual ? "6 320" : "7 900";
    }
    if (dashPricePro) {
      dashPricePro.textContent = isAnnual ? "11 920" : "14 900";
    }
    if (dashPriceBusiness) {
      dashPriceBusiness.textContent = isAnnual ? "24 000" : "30 000";
    }
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

  // 5. Subscription Form Submission
  const subscribeForm = document.getElementById("form-subscribe-plan");
  if (subscribeForm) {
    subscribeForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("btn-submit-plan-order");
      const submitText = document.getElementById("btn-submit-plan-text");
      const originalText = submitText ? submitText.textContent : "Confirmer & Activer mon Forfait";

      const selectedPlanRadio = document.querySelector('input[name="modal_plan_tier"]:checked');
      const selectedTier = selectedPlanRadio ? selectedPlanRadio.value : "pro";
      const selectedPayMethod = document.querySelector('input[name="modal_pay_method"]:checked')?.value || "wave";

      if (submitBtn) {
        submitBtn.disabled = true;
        if (submitText) submitText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Traitement sécurisé...';
      }

      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          if (submitText) submitText.textContent = originalText;
        }

        // Update User Plan Mock
        let planTitle = "Formule Pro 🚀";
        let planTokens = 6000;
        let planPriceStr = "14 900 FCFA";

        if (selectedTier === "basic") {
          planTitle = "Formule Basic 🦾";
          planTokens = 2500;
          planPriceStr = "7 900 FCFA";
        } else if (selectedTier === "business" || selectedTier === "enterprise") {
          planTitle = "Formule Business 💎";
          planTokens = 15000;
          planPriceStr = "30 000 FCFA";
        }

        MOCK_DATA.currentUser.plan.name = planTitle;
        MOCK_DATA.currentUser.plan.tokensMax = planTokens;

        // Update UI
        const sidebarPlanName = document.getElementById("sidebar-plan-name");
        if (sidebarPlanName) sidebarPlanName.textContent = planTitle;

        const subTokensMax = document.getElementById("sub-tokens-max");
        if (subTokensMax) subTokensMax.textContent = `Max ${planTokens.toLocaleString("fr-FR")} crédits`;

        const subTokensUsed = document.getElementById("sub-tokens-used");
        if (subTokensUsed) subTokensUsed.textContent = "0 crédit";

        const navBadgePlan = document.getElementById("nav-badge-plan");
        if (navBadgePlan) {
          navBadgePlan.textContent = "Actif";
          navBadgePlan.className = "badge badge-green";
        }

        const billingStatusBadge = document.getElementById("billing-status-badge");
        if (billingStatusBadge) {
          billingStatusBadge.textContent = "Abonnement Actif (" + planTitle.split(" ")[1] + ")";
        }

        const billingTitleDisplay = document.getElementById("billing-title-display");
        if (billingTitleDisplay) {
          billingTitleDisplay.textContent = "Votre abonnement est actif et opérationnel !";
        }

        const billingSubtitleDisplay = document.getElementById("billing-subtitle-display");
        if (billingSubtitleDisplay) {
          billingSubtitleDisplay.textContent = "Vos réponses IA 24h/24, automatisations WhatsApp et intégrations de paiement sont pleinement actives sans coupure.";
        }

        const billingDaysLeft = document.getElementById("billing-days-left");
        if (billingDaysLeft) {
          billingDaysLeft.textContent = "Renouvellement automatique le 08 Nov 2026";
        }

        // Add invoice entry
        const historyTbody = document.getElementById("billing-history-tbody");
        if (historyTbody) {
          const payLabel = selectedPayMethod === "wave" ? "Wave CI/SN" : selectedPayMethod === "orange" ? "Orange Money" : selectedPayMethod === "mtn" ? "MTN MoMo" : "Carte Bancaire";
          const newRow = document.createElement("tr");
          newRow.innerHTML = `
            <td>À l'instant</td>
            <td><strong>${planTitle}</strong></td>
            <td>${payLabel}</td>
            <td>${planPriceStr}</td>
            <td><span class="badge badge-green">Payé</span></td>
            <td><button class="btn-secondary-glass btn-receipt-view" style="padding: 4px 10px; font-size: 11.5px;">Télécharger</button></td>
          `;
          historyTbody.insertBefore(newRow, historyTbody.firstChild);
        }

        closePlanModal();

        showToast(`🎉 Félicitations ! Votre ${planTitle} a été activée avec succès.`, "success");
      }, 1200);
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
    payoutForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const amountInput = document.getElementById("payout-amount");
      const amount = parseInt(amountInput?.value || "0", 10);

      if (amount < 10000) {
        alert("Le montant minimum de retrait de commissions est de 10 000 FCFA.");
        return;
      }

      closePayoutModal();
      showToast(`Demande de retrait de ${amount.toLocaleString('fr-FR')} FCFA envoyée avec succès ! Traitement sous 2h à 24h ouvrées via Wave/MoMo.`, "success");
      payoutForm.reset();
    });
  }
}


// --- LOGIQUE DE CONNEXION WHATSAPP V2 (SAAS) ---
(function() {
    function initWhatsAppSaaS() {
        const qrModal = document.getElementById('qr-modal');
        if(!qrModal) return;
        const qrBox = qrModal.querySelector('.qr-code-box');
        if(!qrBox) return;
        
        const originalQrContent = qrBox.innerHTML;
        let userId = '';
      try {
          const u = JSON.parse(localStorage.getItem('vendia_current_user'));
          if (u && u.id) userId = u.id;
      } catch(e) {}
        let statusInterval;

        document.body.addEventListener('click', (e) => {
            if(e.target.closest('.btn-open-qr')) {
                startWhatsApp();
            }
            if(e.target.closest('[data-close-modal="qr-modal"]')) {
                clearInterval(statusInterval);
                qrBox.innerHTML = originalQrContent;
            }
        });

        async function startWhatsApp() {
            qrBox.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:180px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 40px; color: #25D366; margin-bottom:15px;"></i><p style="color:#fbbf24; font-weight:bold;">⏳ Démarrage du moteur WhatsApp...</p></div>';

            try {
                await fetch('http://localhost:8080/api/whatsapp/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                });
                statusInterval = setInterval(checkStatus, 2000);
            } catch (error) {
                qrBox.innerHTML = '<p style="color:red; font-weight:bold;">❌ Erreur serveur (Vérifiez le terminal).</p>';
            }
        }

        async function checkStatus() {
            try {
                const res = await fetch('http://localhost:8080/api/whatsapp/status/' + userId);
                const data = await res.json();

                if (data.status === 'QR_READY' && data.qr) {
                    qrBox.innerHTML = '<img src="' + data.qr + '" alt="Vrai QR Code" style="width: 100%; height: 100%; border-radius: 8px;">';
                } 
                else if (data.status === 'CONNECTED') {
                    clearInterval(statusInterval);
                    
                    const wasActive = qrModal.classList.contains('active');
                    qrModal.classList.remove('active');
                    
                    const badge = document.getElementById('sidebar-status-badge');
                    if(badge) {
                        badge.textContent = "Connecté";
                        badge.className = "status-badge-mini badge-green";
                    }
                    
                    if (data.phone) {
                        const formattedPhone = '+' + data.phone;
                        const headerNum = document.getElementById('header-connected-num');
                        const cardNum = document.getElementById('main-card-num');
                        
                        if (headerNum) headerNum.textContent = formattedPhone;
                        if (cardNum) cardNum.textContent = formattedPhone;
                    }

                    const num = document.getElementById('sidebar-connected-num');
                    if(num) num.textContent = "IA Active";
                    
                    if (wasActive) {
                        alert("🎉 Succès ! WhatsApp est connecté avec le numéro " + (data.phone ? '+' + data.phone : ''));
                    }
                }
            } catch (error) {}
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhatsAppSaaS);
    } else {
        initWhatsAppSaaS();
    }
})();