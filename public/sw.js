/**
 * ============================================================
 * Service Worker — SubFlow PWA
 * ============================================================
 * 
 * FONCTIONNALITÉS :
 * 1. Cache Strategy : Cache-first pour assets, Network-first pour API
 * 2. Push Notifications : Affiche les notifications système
 * 3. Offline Support : QR Code et données essentielles accessibles hors-ligne
 * 4. Background Sync : File d'attente les requêtes échouées
 * 
 * INSTALLATION sur le téléphone :
 * - Chrome : Menu ⋮ → "Ajouter à l'écran d'accueil"
 * - Safari : Bouton partage → "Sur l'écran d'accueil"
 */

const CACHE_NAME = 'subflow-v1';
const API_CACHE = 'subflow-api-v1';

// Assets statiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html'
];

// Routes API à mettre en cache (Network-first)
const CACHEABLE_API_ROUTES = [
  '/api/client/profile',
  '/api/client/consumption',
  '/api/subscriptions/status'
];

// ============================================================
// INSTALLATION — Mise en cache des assets statiques
// ============================================================

self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 SW: Mise en cache des assets statiques');
        // On utilise addAll avec un fallback si certains fichiers n'existent pas encore
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('⚠️ SW: Certains assets manquants, installation continue:', err.message);
        });
      })
      .then(() => self.skipWaiting()) // Activer immédiatement
  );
});

// ============================================================
// ACTIVATION — Nettoyage des anciens caches
// ============================================================

self.addEventListener('activate', (event) => {
  console.log('✅ SW: Activation...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== API_CACHE)
            .map(name => {
              console.log(`🗑️ SW: Suppression ancien cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim()) // Prendre le contrôle immédiatement
  );
});

// ============================================================
// FETCH — Stratégies de cache intelligentes
// ============================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── API calls : Network-first (avec cache fallback) ──
  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API_ROUTES.some(route => url.pathname.includes(route))) {
      event.respondWith(networkFirstStrategy(event.request));
    }
    // Les autres API calls ne sont pas mises en cache
    return;
  }

  // ── Assets statiques : Cache-first ──
  event.respondWith(cacheFirstStrategy(event.request));
});

/**
 * Network-first : Essaye le réseau, fallback sur le cache.
 * Idéal pour les données API qui changent souvent.
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('📴 SW: Données servies depuis le cache (hors-ligne)');
      return cached;
    }
    return new Response(JSON.stringify({
      error: 'Vous êtes hors-ligne et ces données ne sont pas en cache.',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Cache-first : Utilise le cache, fallback sur le réseau.
 * Idéal pour les assets statiques (JS, CSS, images).
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Page hors-ligne de fallback
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('Hors-ligne', { status: 503 });
    }
    return new Response('', { status: 503 });
  }
}

// ============================================================
// PUSH NOTIFICATIONS — Réception et affichage
// ============================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'Notification',
      body: event.data.text(),
      icon: '/icons/icon-192.png'
    };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    tag: payload.tag || `notif-${Date.now()}`,
    data: { url: payload.url || '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ],
    // Montrer même si l'app est au premier plan
    requireInteraction: payload.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'SubFlow', options)
  );
});

// ============================================================
// NOTIFICATION CLICK — Ouvrir l'URL associée
// ============================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Si l'app est déjà ouverte, la ramener au premier plan
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon, ouvrir un nouvel onglet
        return clients.openWindow(targetUrl);
      })
  );
});

// ============================================================
// BACKGROUND SYNC — File d'attente hors-ligne
// ============================================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tickets') {
    event.waitUntil(syncPendingTickets());
  }
});

/**
 * Envoie les tickets créés hors-ligne quand la connexion revient.
 */
async function syncPendingTickets() {
  try {
    // Récupérer les requêtes en attente depuis IndexedDB
    // (implémentation côté client nécessaire)
    console.log('🔄 SW: Sync des tickets en attente...');
  } catch (err) {
    console.error('❌ SW: Erreur sync:', err);
  }
}

console.log('🚀 SW: Service Worker SubFlow chargé.');
