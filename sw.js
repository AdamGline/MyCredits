const CACHE_NAME = 'credits-cache-v7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './logo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Активируем сразу
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Добавляем файлы по одному. Если один не скачается, остальные сохранятся.
      ASSETS_TO_CACHE.forEach(url => {
        cache.add(url).catch(err => console.log('Не удалось закэшировать:', url, err));
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Игнорируем запросы к базе данных (чтобы они шли напрямую)
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis')) {
    return;
  }

  // Стратегия Stale-While-Revalidate: отдаем из кэша мгновенно, а в фоне обновляем
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      const networkFetch = fetch(event.request).then(response => {
        // Если ответ успешный, обновляем его в кэше
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => {
        // Если офлайн и запрашивают страницу, отдаем index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html', { ignoreSearch: true });
        }
      });

      // Отдаем кэш, если он есть. Если нет — ждем ответа от сети.
      return cachedResponse || networkFetch;
    })
  );
});
