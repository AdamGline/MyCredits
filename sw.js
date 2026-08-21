const CACHE_NAME = 'credits-cache-1.3.00';
const ASSETS_TO_CACHE = ['./', './index.html', './app.js', './manifest.json', './icon.png', './logo.png', 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js', 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('Cache miss:', url, err))))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname === 'www.gstatic.com') { event.respondWith(caches.match(event.request).then(c => c || fetch(event.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, cl)); } return r; }))); return; }
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis') || url.hostname.includes('firebaseio')) return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).then(r => { if (r && r.status === 200 && r.type === 'basic') { const cl = r.clone(); caches.open(CACHE_NAME).then(c => c.put('./index.html', cl)); } return r; }).catch(() => caches.match('./index.html').then(c => c || caches.match('./')))); return; }
  event.respondWith(fetch(event.request).then(r => { if (r && r.status === 200 && r.type === 'basic') { const cl = r.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, cl)); } return r; }).catch(() => caches.match(event.request, { ignoreSearch: true })));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => { for (const c of clients) if ('focus' in c) return c.focus(); if (self.clients.openWindow) return self.clients.openWindow('./'); }));
});