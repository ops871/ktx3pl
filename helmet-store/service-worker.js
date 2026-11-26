/* Caches the app shell so the store opens offline. Certificates and
   checkout always go to the network. Bump VERSION when files change. */
const VERSION = 'helmet-store-v1';
const SHELL = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/config.js', './js/catalog.js', './js/app.js', './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/') || url.pathname.includes('/.netlify/')) return;
  // Network first, cache as fallback, so edits to prices show up right away.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
