// Минимальный Service Worker — только для установки PWA
// Кэш и офлайн-режим отключены, всё всегда из сети

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
    // Удаляем все старые кэши
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});
// fetch не перехватываем — браузер работает напрямую с сетью
