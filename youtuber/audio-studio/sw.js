const CACHE_NAME = 'audio-studio-v2';
const urlsToCache = [
  '/youtuber/audio-studio/',
  '/youtuber/audio-studio/index.html',
  '/youtuber/audio-studio/app.js',
  '/youtuber/audio-studio/style.css',
  '/shared/css/design-system.css',
  'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});
