const CACHE = 'ourspace-v1';
const SHELL = [
  '/',
  '/js/api.js',
  '/js/shared.js',
  '/manifest.json',
  '/img/icon.svg',
  '/img/bear-pixel.svg'
];

// Installation : on met le shell en cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// Activation : on supprime les vieux caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : network-first (les appels API passent toujours en réseau)
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // API : pas de cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Met à jour le cache avec la réponse fraîche
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
