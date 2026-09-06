const CACHE_NAME = 'nexa-cbt-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/stitch_assets/screen_3_logo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa service worker baru untuk segera aktif
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache).catch(err => console.log('SW cache error', err));
      })
  );
});

self.addEventListener('fetch', event => {
  // Menggunakan strategi Network First untuk mencegah layar putih (layar blank)
  // Aplikasi akan selalu mencoba mengambil versi terbaru dari server terlebih dahulu
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jika berhasil mengambil dari jaringan, perbarui cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Jika gagal (misalnya offline), ambil dari cache
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Hapus cache versi lama
          }
        })
      );
    }).then(() => self.clients.claim()) // Memastikan service worker langsung mengontrol halaman
  );
});
