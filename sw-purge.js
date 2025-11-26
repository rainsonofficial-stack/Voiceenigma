// sw-purge.js: This worker is designed ONLY to destroy all caches and workers.
// We only use this when the PWA is stuck in a bad state.

self.addEventListener('install', function(event) {
  console.log('[SW Purge] Installing, skipping waiting...');
  // Force the new service worker to become active immediately
  self.skipWaiting(); 
});

self.addEventListener('activate', function(event) {
  console.log('[SW Purge] Activating and clearing ALL caches...');
  
  // 1. Delete all old Caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log(`[SW Purge] Found caches: ${cacheNames.join(', ')}`);
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log(`[SW Purge] Deleting cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    })
    // 2. Unregister ALL Service Workers globally 
    .then(() => {
        console.log('[SW Purge] All caches cleared. Unregistering self.');
        // This is a browser API call executed on the page side, not inside the worker. 
        // We will prompt the user to refresh to complete the unregistration.
        return self.registration.unregister(); 
    })
    .then(() => {
        console.log('[SW Purge] Service worker unregistered. Relaunch the app now.');
    })
  );
});

