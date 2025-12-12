/**
 * Lecture Shorts Factory - Service Worker v1.4.0
 * 캐시 버전 업데이트로 구버전 무효화
 */

const CACHE_NAME = 'lecture-shorts-v1.4.0';

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
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js'
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
    
    if (url.includes('unpkg.com')) {
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
    
    // 앱 파일은 네트워크 우선 (캐시 문제 방지)
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
