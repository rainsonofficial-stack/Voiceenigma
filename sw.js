// sw.js - Service Worker for AOD Setting (Magic AOD PWA)
//
// Strategy summary:
// - Precache core app shell on install (CORE_ASSETS).
// - Use cache-first for dictionary CDN URL(s).
// - Use network-first for navigation (index.html) so users get updates.
// - Use cache-first for other static assets.
// - Expose a message interface to PRECACHE_DICT (postMessage from page).
// - On activate: remove old caches and claim clients.

const CACHE_VERSION = 'v1';
const APP_CACHE = `aod-app-${CACHE_VERSION}`;
const DICT_CACHE = `aod-dict-${CACHE_VERSION}`;
const RUNTIME_CACHE = `aod-runtime-${CACHE_VERSION}`;

// IMPORTANT: Keep these in sync with your app. Add any top-level assets you want pre-cached.
const CORE_ASSETS = [
  '/',                // ensure your hosting serves index.html at root
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/sw.js'
  // add other static assets (css/js) as needed, e.g. '/main.js', '/styles.css'
];

// (Optional) Default dictionary CDN used by index.html.
// If you rely on a different commit/version you can pass a message to pre-cache that specific URL.
const DEFAULT_DICT_CDN = 'https://cdn.jsdelivr.net/gh/rainsonofficial-stack/Enigma@cc82d64bbabae322cc5119fbe85dd16727c39fd6/large_dictionary.js';

// Utility helpers
async function addToCache(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  try {
    await cache.put(request, response.clone());
  } catch (e) {
    // Some responses are opaque or have no-cors; still attempt to store best-effort
    console.warn('Cache put failed for', request.url, e);
  }
}

// Install - pre-cache the app shell
self.addEventListener('install', (evt) => {
  self.skipWaiting();
  evt.waitUntil(
    caches.open(APP_CACHE).then(async (cache) => {
      try {
        await cache.addAll(CORE_ASSETS);
      } catch (err) {
        // If addAll fails (due to 404s), attempt to add individually so others still cache
        console.warn('Core precache.addAll failed, trying individually', err);
        for (const url of CORE_ASSETS) {
          try { await cache.add(url); } catch (e) { console.warn('Failed to cache', url, e); }
        }
      }
    })
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => {
        if (![APP_CACHE, DICT_CACHE, RUNTIME_CACHE].includes(key)) {
          return caches.delete(key);
        }
        return Promise.resolve();
      }));
      await self.clients.claim();
    })()
  );
});

// Fetch handler
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  // Always ignore non-GET requests in cache logic
  if (req.method !== 'GET') {
    return;
  }

  // 1) If request is for the dictionary CDN (exact match or same origin to CDN host),
  //    use cache-first strategy (fast offline).
  if (url.origin === new URL(DEFAULT_DICT_CDN).origin && url.href.includes('/Enigma')) {
    evt.respondWith(cacheFirstDict(req));
    return;
  }

  // 2) Navigation requests (HTML) -> network-first (so users get latest index when online)
  if (req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    evt.respondWith(networkFirst(req));
    return;
  }

  // 3) For other same-origin static assets -> cache-first (fast)
  if (url.origin === self.location.origin) {
    evt.respondWith(cacheFirstStatic(req));
    return;
  }

  // 4) Fallback: try network, fallback to cache runtime
  evt.respondWith(networkFallback(req));
});

// Cache-first for dictionary CDN
async function cacheFirstDict(req) {
  try {
    const cache = await caches.open(DICT_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    // not cached -> fetch and cache
    const fetched = await fetch(req);
    // Some CDNs return CORS/opaque responses; still try to cache if possible
    await addToCache(DICT_CACHE, req, fetched);
    return fetched;
  } catch (err) {
    console.warn('cacheFirstDict error', err);
    // Try to return from any cache as last resort
    const any = await caches.match(req);
    return any || new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first for navigation (index.html)
async function networkFirst(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const fresh = await fetch(req);
    // Update cache for future navigations
    try { await cache.put('/', fresh.clone()); } catch(e){/* best-effort */ }
    return fresh;
  } catch (err) {
    // offline -> serve cached index.html or root
    const cached = await cache.match('/') || await cache.match('/index.html');
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Cache-first for same-origin static assets
async function cacheFirstStatic(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fetched = await fetch(req);
    await addToCache(RUNTIME_CACHE, req, fetched);
    return fetched;
  } catch (err) {
    // fallback to cache if available
    const any = await cache.match(req);
    if (any) return any;
    return new Response('', { status: 404, statusText: 'Not Found' });
  }
}

async function networkFallback(req) {
  try {
    const fetched = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    await addToCache(RUNTIME_CACHE, req, fetched);
    return fetched;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Message interface - allows page to request dictionary pre-cache
self.addEventListener('message', (evt) => {
  const msg = evt.data;
  if (!msg || !msg.type) return;
  if (msg.type === 'PRECACHE_DICT' && msg.url) {
    precacheDictionary(msg.url).catch(e => console.warn('PRECACHE_DICT failed', e));
  } else if (msg.type === 'PRECACHE_DEFAULT_DICT') {
    precacheDictionary(DEFAULT_DICT_CDN).catch(e => console.warn('PRECACHE default dict failed', e));
  }
});

async function precacheDictionary(url) {
  try {
    const cache = await caches.open(DICT_CACHE);
    const cached = await cache.match(url);
    if (cached) return true; // already cached
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch dictionary: ' + resp.status);
    await addToCache(DICT_CACHE, url, resp);
    console.info('Dictionary precached by SW:', url);
    return true;
  } catch (e) {
    console.warn('precacheDictionary error', e);
    return false;
  }
}
