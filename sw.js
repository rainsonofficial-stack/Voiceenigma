// sw.js - Aggressive PWA Caching Worker (Version 1.2)
// Bump the version number to force a new service worker installation
const CACHE_NAME = 'aod-magic-cache-v1.2'; 
const urlsToCache = [
    './',
    './index.html',
    './manifest.json', // CRITICAL: Reverted to manifest.json
    './large_dictionary.js',
    // Assuming icons are in the root directory
    './icon-192x192.png',
    './icon-512x512.png',
    './icon-180x180.png'
];

self.addEventListener('install', (event) => {
    // Perform install steps and force the worker to take over immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] V1.2 Opened cache, caching all assets.');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Force the new worker to activate immediately
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] V1.2 Activated, clearing old caches...');
    const cacheWhitelist = [CACHE_NAME];
    
    // Deletes *all* caches not matching the current CACHE_NAME
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => self.clients.claim()) // Take control of all clients immediately
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // If not in cache, fetch and cache the new request
                return fetch(event.request).then(
                    (response) => {
                        // Check if we received a valid response
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // IMPORTANT: Clone the response. 
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Only cache GET requests
                                if (event.request.method === 'GET') {
                                    cache.put(event.request, responseToCache);
                                }
                            });

                        return response;
                    }
                );
            })
    );
});

