// Neutrix service worker: makes the website installable as an app (Android app + "Add to Home screen").
// Always uses the live website (nothing is cached except a small "you're offline" page),
// so every change to the website shows up in the app straight away.
const OFFLINE = 'offline.html';
const CACHE = 'neutrix-offline-v1';

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, 'assets/app/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    if (e.request.mode !== 'navigate') return;          // scripts, data and the AI: straight to the network
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
