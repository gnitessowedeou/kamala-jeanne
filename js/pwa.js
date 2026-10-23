/**
 * VANDIAS AI — Progressive Web App (PWA) Handler
 * Enregistrement du Service Worker & Déclenchement de l'installation mobile
 */

(function () {
  'use strict';

  let deferredPrompt = null;
  const DISMISS_KEY = 'vandias_pwa_dismissed_v2';
  const SNOOZE_DELAY_MS = 2 * 60 * 1000; // Réapparition après 2 minutes si fermée

  // Nettoyage immédiat des anciens verrous
  try {
    localStorage.removeItem('vandias_pwa_prompt_dismissed_until');
  } catch (e) {}

  // 1. Enregistrement du Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('/sw.js')
        .then(function (reg) {
          console.log('[PWA] Service Worker enregistré avec succès (scope:', reg.scope, ')');

          // Détecter les mises à jour en arrière-plan
          reg.addEventListener('updatefound', function () {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', function () {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nouvelle version prête. Mise à jour disponible.');
                }
              });
            }
          });
        })
        .catch(function (err) {
          console.warn('[PWA] Échec enregistrement Service Worker :', err.message);
        });
    });
  }

  // 2. Détection du mode standalone (déjà installé sur l'écran d'accueil)
  function isRunningStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  // 3. Détection iOS Safari
  function isIOSSafari() {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isWebkit = /webkit/.test(ua);
    const isChromeOrFirefox = /crios|fxios/.test(ua);
    return isIOS && isWebkit && !isChromeOrFirefox && !isRunningStandalone();
  }

  // 4. Vérification si l'utilisateur a fermé la bannière récemment (snooze 2 minutes)
  function isPromptDismissed() {
    try {
      const until = sessionStorage.getItem(DISMISS_KEY);
      if (until && Date.now() < parseInt(until, 10)) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function dismissPrompt() {
    try {
      // Masquer pendant 2 minutes seulement
      sessionStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_DELAY_MS));
    } catch (e) {}
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.classList.remove('pwa-banner-visible');
      setTimeout(() => banner.remove(), 400);
    }

    // Réapparaître automatiquement après 2 minutes
    setTimeout(() => {
      if (!isRunningStandalone()) {
        try { sessionStorage.removeItem(DISMISS_KEY); } catch (e) {}
        showInstallBanner();
      }
    }, SNOOZE_DELAY_MS);
  }

  // 5. Création et affichage de la bannière d'installation PWA Mobile
  function showInstallBanner() {
    if (isRunningStandalone() || isPromptDismissed()) {
      return;
    }
    if (document.getElementById('pwa-install-banner')) {
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-inner">
        <div class="pwa-banner-left">
          <img src="/images/icon-192.png" alt="VANDIAS" class="pwa-banner-icon" />
          <div class="pwa-banner-text">
            <div class="pwa-banner-title">Installer VANDIAS AI</div>
            <div class="pwa-banner-sub">Accédez à votre CRM WhatsApp en 1 clic</div>
          </div>
        </div>
        <div class="pwa-banner-actions">
          <button type="button" class="pwa-btn-install" id="pwa-btn-install">
            <i class="fa-solid fa-download"></i>
            <span>Installer</span>
          </button>
          <button type="button" class="pwa-btn-close" id="pwa-btn-close" aria-label="Fermer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Animation d'entrée douce
    requestAnimationFrame(() => {
      setTimeout(() => {
        banner.classList.add('pwa-banner-visible');
      }, 50);
    });

    document.getElementById('pwa-btn-install').addEventListener('click', () => {
      window.vandiasInstallApp();
    });

    document.getElementById('pwa-btn-close').addEventListener('click', () => {
      dismissPrompt();
    });
  }

  // 6. Modal explicatif pour iOS Safari
  function showIOSInstructions() {
    const existing = document.getElementById('pwa-ios-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'pwa-ios-modal';
    modal.className = 'pwa-ios-modal-overlay';
    modal.innerHTML = `
      <div class="pwa-ios-modal-card">
        <div class="pwa-ios-modal-header">
          <div class="pwa-ios-title">
            <img src="/images/icon-192.png" alt="VANDIAS" class="pwa-modal-logo" />
            <span>Installer sur iPhone / iPad</span>
          </div>
          <button type="button" class="pwa-ios-close" id="pwa-ios-close-btn">&times;</button>
        </div>
        <div class="pwa-ios-body">
          <p>Pour installer <strong>VANDIAS AI</strong> sur votre écran d'accueil sans passer par l'App Store :</p>
          <ol class="pwa-ios-steps">
            <li>
              <span class="pwa-step-num">1</span>
              <span>Touchez le bouton de partage <strong style="color: #25D366;"><i class="fa-solid fa-arrow-up-from-bracket"></i> Partager</strong> en bas de Safari.</span>
            </li>
            <li>
              <span class="pwa-step-num">2</span>
              <span>Faites défiler puis touchez <strong style="color: #fff;"><i class="fa-solid fa-square-plus"></i> Sur l'écran d'accueil</strong>.</span>
            </li>
            <li>
              <span class="pwa-step-num">3</span>
              <span>Touchez <strong>Ajouter</strong> en haut à droite.</span>
            </li>
          </ol>
        </div>
        <button type="button" class="pwa-ios-done-btn" id="pwa-ios-done-btn">J'ai compris</button>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('pwa-ios-close-btn').addEventListener('click', close);
    document.getElementById('pwa-ios-done-btn').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  // 7. Déclenchement universel de l'installation
  window.vandiasInstallApp = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] Utilisateur a accepté l\'installation de VANDIAS AI');
          dismissPrompt();
        } else {
          console.log('[PWA] Installation refusée par l\'utilisateur');
        }
        deferredPrompt = null;
      });
    } else if (isIOSSafari()) {
      showIOSInstructions();
    } else {
      // Déjà installé ou navigateur desktop incompatible
      if (isRunningStandalone()) {
        alert("VANDIAS AI est déjà installé sur votre appareil !");
      } else {
        alert("Pour installer VANDIAS AI : ouvrez le menu de votre navigateur (les 3 points verticaux en haut à droite) et appuyez sur 'Installer l'application' ou 'Ajouter à l'écran d'accueil'.");
      }
    }
  };

  // 8. Capture de l'événement natif Android / Desktop Chrome
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Événement beforeinstallprompt capturé.');

    // Rendre visible le bouton de la sidebar si présent
    const sidebarItem = document.getElementById('sidebar-pwa-install-item');
    if (sidebarItem) {
      sidebarItem.style.display = 'block';
    }

    // Afficher la bannière mobile après 3 secondes de visite
    setTimeout(showInstallBanner, 3000);
  });

  // 9. Événement post-installation
  window.addEventListener('appinstalled', function () {
    console.log('[PWA] VANDIAS AI a été installé avec succès !');
    deferredPrompt = null;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
    const sidebarItem = document.getElementById('sidebar-pwa-install-item');
    if (sidebarItem) sidebarItem.style.display = 'none';
  });

  // 10. Activation systématique pour mobile (Android, iOS Safari, etc.)
  function isMobileDevice() {
    const ua = (window.navigator.userAgent || '').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/i.test(ua);
  }

  if (isMobileDevice() && !isRunningStandalone()) {
    const sidebarItem = document.getElementById('sidebar-pwa-install-item');
    if (sidebarItem) {
      sidebarItem.style.display = 'block';
    }
    // Affichage systématique de la bannière sur téléphone après 2.5 secondes
    setTimeout(showInstallBanner, 2500);

    // Rappel récurrent toutes les 2 minutes tant que l'app n'est pas installée
    setInterval(() => {
      if (!isRunningStandalone() && !document.getElementById('pwa-install-banner') && !isPromptDismissed()) {
        showInstallBanner();
      }
    }, SNOOZE_DELAY_MS);
  }
})();
