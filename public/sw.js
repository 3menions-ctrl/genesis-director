// TEMPORARY service-worker kill switch — evicts a stale dev/prod cache.
//
// A Workbox service worker registered during a prior prod/preview visit to
// localhost:7777 keeps serving its precached (stale) bundle, so dev edits
// never reach the browser and Cmd+Shift+R can't bypass it. The dev server was
// returning the HTML SPA fallback for /sw.js, which is an invalid SW script —
// so the browser's update check failed and the old worker stayed alive.
//
// This file is valid JS, so on the next update check the browser installs it,
// and on activate it clears every cache, unregisters itself, and reloads open
// tabs with fresh code from the Vite dev server.
//
// REMOVE THIS FILE once stale workers are gone — a permanent public/sw.js
// would collide with the vite-plugin-pwa (Workbox) generated SW in production.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      /* best effort */
    }
    try {
      await self.registration.unregister();
    } catch {
      /* best effort */
    }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch {
      /* best effort */
    }
  })());
});
