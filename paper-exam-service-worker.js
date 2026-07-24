/*
  Minimal service worker — only caches this app's shell (this file,
  its index.html, manifest, icons) so it can be installed and reopened
  without a network connection. No exam data ever passes through here
  (this app has no online/link features), so there's no cache-staleness
  risk to worry about beyond the normal app-shell update below.
*/
const CACHE_NAME = 'azmoon-saz-kaghazi-shell-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './paper-icon-192.png', './paper-icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(()=>{ /* fine if some assets 404 — caching is best-effort */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.search) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
