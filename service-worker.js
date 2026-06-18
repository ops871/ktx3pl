// ============================================================
//  KTX 3PL Warehouse Tracker - service worker
//  ------------------------------------------------------------
//  Caches the static app shell so the app loads offline and
//  installs as a PWA. Cross-origin requests (Supabase API,
//  the supabase-js CDN) are never cached - they always go to
//  the network so data stays live and auth keeps working.
// ============================================================
const CACHE = "ktx3pl-shell-v2";

// Files that make up the static app shell.
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/config.js",
  "./js/supabase.js",
  "./js/auth.js",
  "./js/app.js",
  "./icons/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// ---------------- Install: pre-cache the shell ----------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll fails if any file is missing, so add individually
      // and ignore the ones that aren't present yet (e.g. icons).
      Promise.all(
        SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* skip files that 404 so install still succeeds */
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// ---------------- Activate: drop old caches ----------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// ---------------- Fetch: shell strategy ----------------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never touch cross-origin traffic (Supabase API + CDN).
  // Let the browser handle those normally so data is always live.
  if (url.origin !== self.location.origin) return;

  // For page navigations: try the network, fall back to the
  // cached index.html so the app still opens offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // For other same-origin assets: cache-first, then network,
  // caching a copy of anything we successfully fetch.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
