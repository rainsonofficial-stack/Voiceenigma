const CACHE_NAME = 'aod-magic-cache-v3'; // Bumped cache version to force update of large_dictionary.js
// IMPORTANT: Changed paths to be relative to the GitHub Pages repository root for safety.
const urlsToCache = [
    '/', // Root of the app, which serves index.html
    './index.html',
    './manifest.json',
    './large_dictionary.js', // Local dictionary file
    // Also include the icons that the manifest references
    './icon-192A.png',
    './icon-512A.png' 
];

// Install event: Caches the necessary assets
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Added to ensure service worker activates immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache and caching resources.');
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
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // No cache hit - fetch from network
                return fetch(event.request);
            }
        )
    );
});

// Activate event: Clears old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); // Added to immediately control clients
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

