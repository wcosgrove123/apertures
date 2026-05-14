// Apertures service worker.
// Caches the app shell so the site works fully offline once visited.

const VERSION = 'apertures-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.json',
  './content/card.html',
  './content/letter-2026.html',
  './content/letter-1788.html',
  './assets/topo.svg',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-1024.png',
  './assets/apple-touch-icon.png',
  './assets/favicon-32.png'
];

// Install: precache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: remove old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - Same-origin: cache-first, fallback to network, then to cache update.
//   - Google Fonts (fonts.googleapis.com + fonts.gstatic.com): stale-while-revalidate.
//   - Anything else: network-first with cache fallback.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFontHost = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';

  if (sameOrigin) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (isFontHost) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Other cross-origin: try network, fall back to cache.
  event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    // If the request is for an HTML navigation, fall back to the app shell.
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || network || new Response('', { status: 504 });
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

// Allow the app to ask us to update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
