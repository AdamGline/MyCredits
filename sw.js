const CACHE_NAME = 'mycredits-v4';
const urlsToCache = [
  './',
  './index.html',
  './icon.png',
  './logo.png',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Если запрашивается index.html или корень сайта
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Клонируем ответ, чтобы сохранить в кэш
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Если сеть недоступна, берём из кэша
          return caches.match(event.request);
        })
    );
  } else {
    // Для всех остальных ресурсов (icon.png, logo.png, manifest.json и др.) – сначала кэш, потом сеть
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});