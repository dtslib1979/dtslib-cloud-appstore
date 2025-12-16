/**
 * 10sec 적분 쇼츠 - Service Worker v1.0
 */

const CACHE_NAME = '10sec-shorts-v1.0.0';

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
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm'
];

self.addEventListener('install', event => {
    console.log('[SW] Installing');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] Activating');
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k.startsWith('10sec-shorts-') && k !== CACHE_NAME)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request)
                    .then(res => {
                        if (res.ok && res.type === 'basic') {
                            const clone = res.clone();
                            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                        }
                        return res;
                    })
                    .catch(() => caches.match('./index.html'));
            })
    );
});
