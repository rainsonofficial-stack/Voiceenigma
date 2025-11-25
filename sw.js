const CACHE_NAME = 'aod-magic-cache-v1';
const urlsToCache = [
    './index.html',
    './manifest.json',
    // The external dictionary file, essential for core functionality
    'https://raw.githubusercontent.com/rainsonofficial-stack/Enigma/cc82d64bbabae322cc5119fbe85dd16727c39fd6/large_dictionary.js'
    // Note: We are mocking the icons and assuming they exist in a real deployed environment
];

// Install event: Caches the necessary assets
self.addEventListener('install', (event) => {
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
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
