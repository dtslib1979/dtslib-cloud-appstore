const CACHE = 'auto-shorts-v2';
const FILES = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

const CDN = [
    'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm',
    'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(async c => {
            await c.addAll(FILES);
            // CDN precache (fail silently)
            for (const url of CDN) {
                try { await c.add(url); } catch(e) {}
            }
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request)
            .then(r => r || fetch(e.request).then(res => {
                // Cache CDN responses
                if (e.request.url.includes('unpkg.com')) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            }))
            .catch(() => new Response('Offline', { status: 503 }))
    );
});