/* Версия берётся из version.js — единственного места, где она меняется */
try { importScripts('./version.js?' + Date.now()); } catch (e) { }
const V = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : 'dev';
const CACHE_NAME = 'credits-cache-' + V;
const ASSETS_TO_CACHE = ['./', './index.html', './app.js', './manifest.json', './version.js', './icon.png', './logo.png', 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js', 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url.indexOf('http') === 0 ? url : new Request(url, { cache: 'reload' })).catch(err => console.warn('Cache miss:', url, err))))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== 'crt-notif-data').map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname === 'www.gstatic.com') { event.respondWith(caches.match(event.request).then(c => c || fetch(event.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, cl)); } return r; }))); return; }
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis') || url.hostname.includes('firebaseio')) return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request.url, { cache: 'no-store' }).then(r => { if (r && r.status === 200 && r.type === 'basic') { const cl = r.clone(); caches.open(CACHE_NAME).then(c => c.put('./index.html', cl)); } return r; }).catch(() => caches.match('./index.html').then(c => c || caches.match('./')))); return; }
  event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })).then(r => { if (r && r.status === 200 && r.type === 'basic') { const cl = r.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, cl)); } return r; }).catch(() => caches.match(event.request, { ignoreSearch: true })));
});
async function swCheckNotifications() {
  try {
    if (Notification.permission !== 'granted') return;
    const cache = await caches.open('crt-notif-data');
    const key = new URL('__notif.json', self.registration.scope).href;
    const lastKey = new URL('__notif-last.txt', self.registration.scope).href;
    const r = await cache.match(key); if (!r) return;
    const d = await r.json(); if (!d.on) return;
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ymd = x => x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate();
    const lr = await cache.match(lastKey);
    if (lr && (await lr.text()) === ymd(today)) return;
    const parse = s => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
    const up = [], over = [];
    for (const it of d.items || []) {
      let due = parse(it.due);
      if (today >= parse(it.reset)) {
        if (it.card) continue;
        const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        due = new Date(today.getFullYear(), today.getMonth(), Math.min(it.day, dim));
      }
      const diff = Math.round((due - today) / 86400000);
      if (diff >= 0 && diff <= d.days) up.push(it.n + ' (' + (diff === 0 ? 'сегодня' : 'через ' + diff + ' дн.') + ')');
      else if (diff < 0 && d.overdue) over.push(it.n + ': ' + (-diff) + ' дн.');
    }
    let shown = false;
    if (up.length) { await self.registration.showNotification('💰 Напоминание о платежах', { body: up.slice(0, 3).join(', ') + (up.length > 3 ? ' и ещё ' + (up.length - 3) : ''), icon: './icon.png', badge: './icon.png', tag: 'daily-reminder' }); shown = true; }
    if (over.length) { await self.registration.showNotification('⚠️ Просрочка', { body: over.slice(0, 3).join(', ') + (over.length > 3 ? ' и ещё ' + (over.length - 3) : ''), icon: './icon.png', badge: './icon.png', tag: 'overdue' }); shown = true; }
    if (shown) await cache.put(lastKey, new Response(ymd(today)));
  } catch (e) { }
}
self.addEventListener('periodicsync', event => { if (event.tag === 'crt-check') event.waitUntil(swCheckNotifications()); });
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => { for (const c of clients) if ('focus' in c) return c.focus(); if (self.clients.openWindow) return self.clients.openWindow('./'); }));
});