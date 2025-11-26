const CACHE_NAME = 'aod-magic-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './large_dictionary.js',
    './manifest.json'
    // Add paths for icon files if you deploy them
];

// Install event: cache all necessary assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Fetch event: serve assets from cache first, then fall back to network
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
            })
    );
});

