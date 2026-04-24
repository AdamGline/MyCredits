// Service Worker v4 – железобетонный кеш и поддержка холодного старта
const CACHE_NAME = 'credits-cache-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './logo.png', // Добавили логотип, чтобы экран авторизации тоже работал без сети
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Игнорируем запросы, которые не относятся к получению данных (например, POST)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // ignoreSearch: true заставляет SW находить файл в кеше, даже если к ссылке приписаны параметры
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) {
        return cached;
      }
      
      return fetch(event.request).catch(() => {
        // Если сети нет вообще, и запрашивается страница, отдаем закэшированный index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html', { ignoreSearch: true });
        }
      });
    })
  );
});
