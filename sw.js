// ===== Service Worker للتخزين المؤقت =====

const CACHE_NAME = 'accounting-v39';
const ASSETS = [
  './',
  './index.html',
  './app.html',
  './license.html',
  './setup.html',
  './change-credentials.html',
  './add-transaction.html',
  './add-tx.html',
  './purchases.html',
  './close-day.html',
  './inventory.html',
  './reports.html',
  './backup.html',
  './settings.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './js/db.js',
  './js/auth.js',
  './js/license.js',
  './js/license-page.js',
  './js/setup.js',
  './js/app.js',
  './js/add-transaction.js',
  './js/close-day.js',
  './js/inventory.js',
  './js/reports.js',
  './js/backup.js',
  './js/settings.js',
  './js/change-credentials.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('فشل تخزين بعض الملفات:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((fetchRes) => {
        if (!fetchRes || fetchRes.status !== 200 || fetchRes.type !== 'basic') {
          return fetchRes;
        }
        const toCache = fetchRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return fetchRes;
      }).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});
