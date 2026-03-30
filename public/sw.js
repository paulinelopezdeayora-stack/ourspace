const CACHE = 'ourspace-v4';

// Installation minimale
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Activation : on vide TOUT l'ancien cache
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : toujours réseau en priorité, pas de mise en cache des HTML/JS
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // API et HTML/JS → toujours depuis le réseau
  if (url.includes('/api/') || url.includes('.html') || url.endsWith('.js')) return;
  // Images → cache
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
