// TiraBien service worker: works with no signal in the street.
// - The page: network first, falling back to the cached copy, so a new deploy is picked up on the next visit.
// - Hashed build assets and the app's data (rules, embeddings, containers): served from cache, refreshed in the background.
// - The ONNX runtime from the CDN: cached once. The AI model files themselves are already kept by transformers.js
//   (Cache Storage "transformers-cache"), so they are not stored twice.
// - Map tiles: always from the network; the app shows a notice instead of the map when offline.
const CACHE = 'tirabien-v1';
const SHELL = ['./', './index.html', './data/containers.json', './data/embeddings.json', './manifest.webmanifest',
  './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tirabien-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const putCopy = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((r) => putCopy(req, r)).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    // Cache first, refresh in the background (stale-while-revalidate).
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((r) => putCopy(req, r)).catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => putCopy(req, r))));
  }
  // Everything else (map tiles, model files handled by transformers.js) goes straight to the network.
});
