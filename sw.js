/**
 * VANDIAS AI — Service Worker (PWA)
 * Version: 1.0.0
 * Stratégie de mise en cache ultra-rapide avec priorité réseau pour les données dynamiques
 */

const CACHE_NAME = 'vandias-pwa-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/manifest.json',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/auth.css',
  '/images/logo.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Installation du Service Worker et mise en cache des ressources statiques essentielles
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll en tolérant les échecs mineurs
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Pré-mise en cache ignorée pour :', url, err.message);
          })
        )
      );
    })
  );
});

// Activation et purge immédiate des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Ne JAMAIS intercepter les requêtes non-GET
  if (req.method !== 'GET') {
    return;
  }

  // 2. Ne JAMAIS mettre en cache les API (Supabase, Railway, Webhooks, SSE, OpenAI, etc.)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/health' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('railway.app') ||
    url.hostname.includes('api.openai.com') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // 3. Navigation HTML (Page d'accueil, dashboard) -> Network-First avec fallback cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            if (url.pathname.includes('dashboard')) {
              return caches.match('/dashboard.html');
            }
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 4. Scripts JS et styles CSS de l'application -> Network-First (priorité réseau immédiate)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.search.includes('v=')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 5. Autres fichiers statiques (Images, Polices) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Hors ligne et non présent dans le cache
          return null;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
