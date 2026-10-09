/**
 * ==============================================================================
 * VANDIA AI — DASHBOARD JAVASCRIPT ENGINE
 * Full SPA Frontend Navigation, Chart.js, WhatsApp Live Chat, Modals & MOCK Data
 * Prepared for Supabase / Backend API integration
 * ==============================================================================
 */

// ==============================================================================
// 1. MOCK DATA STORE (Prêt pour injection Supabase)
// ==============================================================================
const MOCK_DATA = {
  currentUser: {
    id: "usr_01h8923a",
    name: "gnitou",
    role: "Admin Entreprise",
    avatar: "G",
    connectedPhone: "+226 05158494",
    phoneStatus: "Coexistence Active",
    plan: {
      name: "Formule Basic 🦾",
      badge: "-50% À VIE",
      tokensUsed: 14200,
      tokensMax: 100000,
      percentage: 14.2
    }
  },

  currency: "XOF", // 'XOF' or 'USD'
  exchangeRate: 615, // 1 USD ~ 615 XOF

  kpis: {
    salesUsd: 8420,
    salesXof: 5180000,
    salesTrend: "+34.5%",
    conversations: 1248,
    conversationsTrend: "+18.2%",
    conversionRate: "28.4%",
    conversionTrend: "+340%",
    abandonedRecovered: 142,
    abandonedRecoveredRate: "74% relancés",
    abandonedSavedUsd: 2180,
    abandonedSavedXof: 1340000
  },

  chartData: {
    "14": {
      labels: ["01 Oct", "02 Oct", "03 Oct", "04 Oct", "05 Oct", "06 Oct", "07 Oct", "08 Oct", "09 Oct", "10 Oct", "11 Oct", "12 Oct", "13 Oct", "Aujourd'hui"],
      salesUsd: [350, 480, 520, 420, 710, 640, 890, 780, 1100, 1350, 1500, 1320, 1680, 1920],
      salesXof: [215000, 295000, 320000, 258000, 436000, 393000, 547000, 479000, 676000, 830000, 922000, 811000, 1033000, 1180000],
      conversations: [45, 62, 58, 40, 85, 98, 120, 105, 142, 160, 175, 152, 190, 215]
    },
    "30": {
      labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      salesUsd: [1650, 2100, 2450, 2220],
      salesXof: [1014000, 1291000, 1506000, 1365000],
      conversations: [280, 340, 390, 238]
    },
    "90": {
      labels: ["Août", "Septembre", "Octobre (en cours)"],
      salesUsd: [6200, 7850, 8420],
      salesXof: [3813000, 4827000, 5180000],
      conversations: [890, 1120, 1248]
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
      contacts: "482 contacts",
      conversion: "34.2%",
      active: true,
      icon: "fa-bolt"
    },
    {
      title: "Relance Panier Abandonné",
      trigger: "Abandon Shopify/WooCommerce > 30 min",
      steps: 3,
      contacts: "142 relancés",
      conversion: "74.0%",
      active: true,
      icon: "fa-cart-arrow-down"
    },
    {
      title: "Qualification & Prise de Devis",
      trigger: "Widget WhatsApp Site Web",
      steps: 4,
      contacts: "980 prospects",
      conversion: "42.8%",
      active: true,
      icon: "fa-clipboard-question"
    },
    {
      title: "Réactivation Clients Inactifs (30 jours)",
      trigger: "Aucune commande depuis 30 jours",
      steps: 2,
      contacts: "620 cibles",
      conversion: "19.5%",
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
      "settings": "fa-gear"
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

  const dataset = MOCK_DATA.chartData["14"];
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
          data: [12, 28, 45, 62, 85, 110, 95, 60, 25],
          backgroundColor: "rgba(37, 211, 102, 0.75)",
          borderRadius: 6,
          hoverBackgroundColor: "rgba(37, 211, 102, 1)"
        },
        {
          label: "Messages Reçus",
          data: [40, 75, 120, 160, 210, 280, 240, 150, 60],
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

function updateChartPeriod(periodKey) {
  if (!salesChartInstance || !MOCK_DATA.chartData[periodKey]) return;

  const data = MOCK_DATA.chartData[periodKey];
  salesChartInstance.data.labels = data.labels;
  salesChartInstance.data.datasets[0].data = currentCurrency === "XOF" ? data.salesXof : data.salesUsd;
  salesChartInstance.data.datasets[1].data = data.conversations;
  salesChartInstance.update();
}

// ==============================================================================
// 8. KPI & LIVE ACTIVITY FEED RENDERING
// ==============================================================================
function renderKpis() {
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
      ? `$${MOCK_DATA.kpis.salesUsd.toLocaleString()}` 
      : `${MOCK_DATA.kpis.salesXof.toLocaleString()} XOF`;
  }
  if (kpiSalesTrend) {
    kpiSalesTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${MOCK_DATA.kpis.salesTrend}`;
    kpiSalesTrend.className = "kpi-badge-trend";
  }
  if (kpiSalesNote) {
    kpiSalesNote.textContent = "dont 68% collectés via Wave & Orange Money";
  }

  if (kpiConvsVal) kpiConvsVal.textContent = MOCK_DATA.kpis.conversations.toLocaleString();
  if (kpiConvsTrend) {
    kpiConvsTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${MOCK_DATA.kpis.conversationsTrend}`;
    kpiConvsTrend.className = "kpi-badge-trend";
  }
  if (kpiConvsNote) {
    kpiConvsNote.textContent = "98.4% prises en charge à 100% par l'IA";
  }

  if (kpiRateVal) kpiRateVal.textContent = MOCK_DATA.kpis.conversionRate;
  if (kpiRateTrend) {
    kpiRateTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${MOCK_DATA.kpis.conversionTrend}`;
    kpiRateTrend.className = "kpi-badge-trend";
  }
  if (kpiRateNote) {
    kpiRateNote.textContent = "vs moyenne marché e-commerce (2.5%)";
  }

  if (kpiCartsVal) kpiCartsVal.textContent = MOCK_DATA.kpis.abandonedRecovered.toLocaleString();
  if (kpiCartsTrend) {
    kpiCartsTrend.innerHTML = `<i class="fa-solid fa-check"></i> ${MOCK_DATA.kpis.abandonedRecoveredRate}`;
    kpiCartsTrend.className = "kpi-badge-trend";
  }
  if (kpiCartsNote) {
    const savedFormatted = currentCurrency === "USD" 
      ? `$${MOCK_DATA.kpis.abandonedSavedUsd.toLocaleString()}` 
      : `${MOCK_DATA.kpis.abandonedSavedXof.toLocaleString()} XOF`;
    kpiCartsNote.innerHTML = `Revenus sauvés : <strong class="kpi-val-currency">${savedFormatted}</strong>`;
  }
}

function renderActivityFeed() {
  const container = document.getElementById("activity-live-list");
  if (!container) return;

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

  // Toggle Human Agent button
  const toggleHumanBtn = document.getElementById("btn-toggle-human");
  const aiBadge = document.getElementById("chat-ai-status-badge");
  if (toggleHumanBtn && aiBadge) {
    toggleHumanBtn.addEventListener("click", () => {
      activeConversation.aiActive = !activeConversation.aiActive;
      if (activeConversation.aiActive) {
        aiBadge.innerHTML = `<i class="fa-solid fa-robot"></i><span>IA Active (Vente Automatisée)</span>`;
        aiBadge.style.color = "var(--whatsapp-green)";
        aiBadge.style.borderColor = "rgba(37, 211, 102, 0.3)";
        showToast("Agent IA réactivé sur cette conversation", "info");
      } else {
        aiBadge.innerHTML = `<i class="fa-solid fa-user-check"></i><span>Relais Humain Actif (Manuel)</span>`;
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
          <span class="badge badge-subtle" style="font-size: 11px; padding: 4px 10px;">${msg.text}</span>
        </div>
      `;
    }

    const isOutgoing = msg.sender === "agent";
    return `
      <div class="message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
        <p>${msg.text}</p>
        <div class="message-meta">
          <span>${msg.time}</span>
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
    resultsContainer.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">Aucun résultat trouvé pour "${query}".</div>`;
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

  // Save AI Agent settings
  const saveAgentBtn = document.getElementById("btn-save-agent");
  if (saveAgentBtn) {
    saveAgentBtn.addEventListener("click", () => {
      showToast("Configuration de l'Agent IA synchronisée avec succès !", "success");
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
    <span style="flex: 1;">${message}</span>
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
      if (user.avatarUrl) {
        avatarBox.innerHTML = `<img src="${user.avatarUrl}" class="avatar-preview-img" alt="${fullName}">`;
      } else {
        avatarBox.innerHTML = `<span class="avatar-preview-initials">${initials}</span>`;
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
      if (user.avatarUrl) {
        avatarPreview.innerHTML = `<img src="${user.avatarUrl}" class="avatar-preview-img" alt="Photo de profil">`;
      } else {
        avatarPreview.innerHTML = `<span class="avatar-preview-initials">${initials}</span>`;
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

      if (!file.type.startsWith("image/")) {
        alert("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("La taille de l'image ne doit pas dépasser 5 Mo.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        tempAvatarBase64 = loadEvent.target.result;
        if (avatarPreview) {
          avatarPreview.innerHTML = `<img src="${tempAvatarBase64}" class="avatar-preview-img" alt="Aperçu photo">`;
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
