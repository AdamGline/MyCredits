const CACHE_NAME = 'credit-tracker-v1';
const urlsToCache = [
  '.',
  'index.html',
  'manifest.json',
  'logo.png',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js'
];

// Установка: кешируем статические ресурсы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Активация: удаляем старые кеши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Стратегия: для Firebase API — сеть, для остального — кеш, если есть
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Пропускаем запросы к Firebase Firestore / Auth (не кешируем, нужна сеть)
  if (url.includes('firestore.googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com')) {
    return; // браузер обработает сам
  }

  // Для навигации (HTML) и статики — кеш сначала, потом сеть
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Возвращаем из кеша, но в фоне обновляем кеш
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
            }
            return networkResponse;
          }).catch(() => {});
          return cachedResponse;
        }
        // Если в кеше нет — идём в сеть
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return networkResponse;
        });
      })
  );
});