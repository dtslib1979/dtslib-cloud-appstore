const CACHE_NAME = 'shorts-maker-v3-real';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// 설치
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// 활성화
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('shorts-maker')) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 페치 - CDN 리소스는 캐싱하지 않음
self.addEventListener('fetch', event => {
  // CDN 리소스는 항상 네트워크에서 가져오기
  if (event.request.url.includes('cdn.jsdelivr.net')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // 로컬 리소스는 캐싱
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            // 유효한 응답만 캐싱
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // 오프라인 폴백
            if (event.request.destination === 'document') {
              return caches.match('./');
            }
          });
      })
  );
});