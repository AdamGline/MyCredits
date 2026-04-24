// Service Worker v2 — кеш полностью отключён, принудительная активация
const SW_VERSION = 'v2';

self.addEventListener('install', () => {
    self.skipWaiting(); // активируемся немедленно, не ждём закрытия вкладок
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => caches.delete(key)))
        ).then(() => self.clients.claim()) // захватываем все открытые вкладки
    );
});

// fetch не перехватываем — всё всегда из сети напрямую
