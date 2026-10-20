/**
 * StashMind Service Worker — Offline support for PWA.
 *
 * Caches the app shell and serves cached content when offline.
 * Audio lessons and cards are cached for offline playback.
 */

const CACHE_NAME = 'stashmind-v1';
const SHELL_URLs = [
  '/',
  '/create',
  '/review',
  '/api',
  '/settings',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLs))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Serve static assets from cache
  if (request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        }).catch(() => {
          // Offline fallback for pages
          if (request.destination === 'document') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
  }
});

// Background sync for saved cards (when back online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-saved-cards') {
    event.waitUntil(
      // Sync saved cards to server when connection is restored
      fetch('/api/v1/library/sync', { method: 'POST' })
    );
  }
});
