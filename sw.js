// Service Worker v4 – улучшенный кэш для холодного старта
const CACHE_STATIC = 'credits-static-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // активируемся немедленно
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_STATIC)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Пропускаем не-HTTP запросы (например, chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    // ignoreSearch: true — игнорируем query-параметры (?v=...), чтобы находить ресурсы в кэше
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) {
        return cached; // Мгновенная отдача из кэша
      }
      
      // Если нет в кэше – идём в сеть
      return fetch(event.request).catch(() => {
        // Для navigations (переходов по страницам) отдаём index.html из кэша
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // Иначе просто логируем ошибку
        console.warn('Офлайн: ресурс недоступен', event.request.url);
      });
    })
  );
});