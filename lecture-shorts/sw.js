/**
 * Lecture Shorts Factory - Service Worker v2.1.0
 */

const CACHE_NAME = 'lecture-shorts-v2.1.0';

const APP_FILES = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json'
];

const CDN_FILES = [
    'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js',
    'https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.0/build/mp4-muxer.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            cache.addAll(APP_FILES);
            
            CDN_FILES.forEach(url => {
                fetch(url).then(res => {
                    if (res.ok) cache.put(url, res);
                }).catch(() => {});
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // CDN: 캐시 우선
    if (url.includes('unpkg.com') || url.includes('jsdelivr.net')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const fetchPromise = fetch(event.request).then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return res;
                }).catch(() => cached);
                
                return cached || fetchPromise;
            })
        );
        return;
    }
    
    // 앱: 네트워크 우선
    event.respondWith(
        fetch(event.request).then(res => {
            if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
            }
            return res;
        }).catch(() => caches.match(event.request))
    );
});
