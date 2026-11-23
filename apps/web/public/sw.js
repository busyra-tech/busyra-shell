// Busyra Shell Service Worker (PWA Shell Cache)
const CACHE_NAME = 'busyra-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let WebSocket and API requests go directly to network
  if (event.request.url.includes('/ws') || event.request.url.includes('/api')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
