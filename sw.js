const CACHE_NAME = 'my-credits-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './logo.png',
  './icon.png',
  './manifest.json'
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
      .then(response => {
        // Возвращаем из кэша или делаем запрос к сети
        return response || fetch(event.request);
      })
  );
});
