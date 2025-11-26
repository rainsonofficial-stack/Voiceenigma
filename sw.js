const CACHE_NAME = 'aod-magic-cache-v5'; // Bumped cache version again to force update
// IMPORTANT: Paths must match the files in the repository root.
const urlsToCache = [
    '/Voiceenigma/', // Use the folder root
    '/Voiceenigma/index.html', // Use the explicit index path
    './manifest.json',
    './large_dictionary.js', 
    './icon-192.png',        
    './icon-512.png'         
];

// Install event: Caches the necessary assets
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache and caching resources.');
                // Note: cache.addAll will fail if even one path is wrong/unreachable.
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to cache resources:', error);
            })
    );
});

// Fetch event: Serves cached content if available, otherwise fetches from network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});

// Activate event: Clears old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); 
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache: ' + cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

