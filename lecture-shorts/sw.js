/**
 * Lecture Shorts Factory - Service Worker v4.1 Pro
 * Enhanced caching with update notifications
 */

const CACHE_NAME = 'lecture-shorts-v4.1.0';
const CACHE_VERSION = '4.1.0';

// App files to cache
const APP_FILES = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json'
];

// CDN files for offline support
const CDN_FILES = [
    'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js',
    'https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.0/build/mp4-muxer.min.js'
];

// Install event - cache app files
self.addEventListener('install', event => {
    console.log('[SW] Installing v' + CACHE_VERSION);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Cache app files (required)
                const appPromise = cache.addAll(APP_FILES);

                // Cache CDN files (best effort)
                CDN_FILES.forEach(url => {
                    fetch(url, { mode: 'cors' })
                        .then(res => {
                            if (res.ok) {
                                cache.put(url, res);
                                console.log('[SW] Cached:', url);
                            }
                        })
                        .catch(() => console.log('[SW] Failed to cache:', url));
                });

                return appPromise;
            })
            .then(() => console.log('[SW] App files cached'))
    );

    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activating v' + CACHE_VERSION);

    event.waitUntil(
        caches.keys()
            .then(keys => {
                return Promise.all(
                    keys
                        .filter(key => key.startsWith('lecture-shorts-') && key !== CACHE_NAME)
                        .map(key => {
                            console.log('[SW] Deleting old cache:', key);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Old caches cleared');
                // Take control of all clients
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) requests
    if (!url.startsWith('http')) return;

    // CDN requests: Cache-first strategy
    if (url.includes('unpkg.com') || url.includes('jsdelivr.net') || url.includes('cdnjs.')) {
        event.respondWith(
            caches.match(event.request)
                .then(cached => {
                    if (cached) {
                        // Update cache in background
                        fetch(event.request)
                            .then(res => {
                                if (res.ok) {
                                    caches.open(CACHE_NAME).then(cache => {
                                        cache.put(event.request, res);
                                    });
                                }
                            })
                            .catch(() => {});

                        return cached;
                    }

                    // Not cached, fetch from network
                    return fetch(event.request)
                        .then(res => {
                            if (res.ok) {
                                const clone = res.clone();
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, clone);
                                });
                            }
                            return res;
                        });
                })
        );
        return;
    }

    // App requests: Network-first strategy with cache fallback
    event.respondWith(
        fetch(event.request)
            .then(res => {
                // Cache successful responses
                if (res.ok && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return res;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request)
                    .then(cached => {
                        if (cached) return cached;

                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }

                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Message handler for manual updates
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Background sync for deferred operations (if supported)
self.addEventListener('sync', event => {
    console.log('[SW] Background sync:', event.tag);
});

// Push notifications (placeholder for future use)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        self.registration.showNotification(data.title || 'Lecture Shorts', {
            body: data.body || 'New update available',
            icon: './icons/icon-192x192.png'
        });
    }
});
