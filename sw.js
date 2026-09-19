/* ═══════════════════════════════════════════════════════════
   DigitalPay Haiti — Service Worker v8.0 r1
   Cache intelligent · Offline-first pour assets statiques
   Network-first pour HTML · Versioning propre
   ═══════════════════════════════════════════════════════════ */

const SW_VERSION = 'digitalpay-v8-2026-09-r1';
const STATIC_CACHE = SW_VERSION + '-static';
const RUNTIME_CACHE = SW_VERSION + '-runtime';
const IMAGE_CACHE = SW_VERSION + '-images';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/cart.html',
  '/commande.html',
  '/wallet.html',
  '/help.html',
  '/legal.html',
  '/404.html',
  '/assets/logo.png',
  '/assets/logo-dark.png',
  '/assets/favicon.ico',
  '/assets/favicon.svg',
  '/assets/favicon-96x96.png',
  '/assets/apple-touch-icon.png',
  '/assets/web-app-manifest-192x192.png',
  '/assets/web-app-manifest-512x512.png',
  '/assets/site.webmanifest',
  '/assets/css/design-system.css',
  '/assets/css/ux-enhancements.css',
  '/assets/css/features.css',
  '/assets/js/notifications.js',
  '/assets/js/chat.js',
  '/assets/js/design-system.js',
  '/assets/js/ux-enhancements.js',
  '/assets/js/wishlist.js',
  '/assets/js/features.js'
];

/* ═══ INSTALLATION ═══ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        return Promise.all(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(() => {
              /* Ignore les erreurs sur assets manquants */
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ═══ ACTIVATION ═══ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !k.startsWith(SW_VERSION))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ═══ MESSAGES CLIENTS ═══ */
self.addEventListener('message', event => {
  if (!event.data || !event.data.type) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (event.source && event.source.postMessage) {
            event.source.postMessage({ type: 'CACHE_CLEARED' });
          }
        })
    );
  }

  if (event.data.type === 'GET_VERSION') {
    if (event.source && event.source.postMessage) {
      event.source.postMessage({ type: 'VERSION', version: SW_VERSION });
    }
  }
});

/* ═══ STRATÉGIE FETCH ═══ */
self.addEventListener('fetch', event => {
  const { request } = event;

  /* Uniquement les GET */
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Ignore les protocoles non-http */
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* Firebase, API Vercel, Google APIs, WhatsApp = network only */
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('whatsapp') ||
    url.hostname.includes('wa.me') ||
    url.pathname.startsWith('/api/') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  /* HTML — Network First */
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(request, copy))
            .catch(() => {});
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  /* Images — Cache First */
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(response => {
            const copy = response.clone();
            caches.open(IMAGE_CACHE)
              .then(cache => cache.put(request, copy))
              .catch(() => {});
            return response;
          })
          .catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  /* JS / CSS / Fonts — Stale While Revalidate */
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request)
          .then(response => {
            const copy = response.clone();
            caches.open(STATIC_CACHE)
              .then(cache => cache.put(request, copy))
              .catch(() => {});
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  /* Fallback général — Network First */
  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE)
          .then(cache => cache.put(request, copy))
          .catch(() => {});
        return response;
      })
      .catch(() => caches.match(request))
  );
});