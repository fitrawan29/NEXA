/**
 * NEXA CBT - Service Worker
 * Implements core precaching, offline navigation fallback,
 * and strict bypass for Supabase and dynamic API calls.
 */

const CACHE_NAME = 'nexa-cbt-v5';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/stitch_assets/screen_3_logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of PRECACHE_URLS) {
        try {
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (err) {
          console.warn('[SW] Precache item failed:', url, err);
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('[SW] Purging stale cache:', cacheName);
            return caches.delete(cacheName).catch(() => false);
          }
        })
      );
    }).then(() => self.clients.claim()).catch(() => {})
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strictly bypass non-GET requests, external Supabase calls, API endpoints, and SW scripts
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/service-worker.js' ||
    !url.protocol.startsWith('http')
  ) {
    return;
  }

  // Network-first strategy for navigation requests (HTML document)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Network-first with cache fallback for static shell assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
