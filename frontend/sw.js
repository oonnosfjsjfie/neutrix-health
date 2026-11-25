// =====================================================
// Neutrix service worker — offline mode for the website and the Android app.
//
// - Online: every page, script and style comes fresh from the server (so updates show at once),
//   and a copy is kept on the device.
// - Offline: the saved copy is used, so the whole app still opens and works.
//   Saved data (ticks, readings, profile...) lives on the device and is synced by neutrix-cloud.js
//   when the internet comes back.
// - Never cached: the AI (/api/...), sign-in and the database (Firebase) — they need the internet.
// =====================================================
const VERSION = 'neutrix-v6';
const CACHE = VERSION;

// Saved on the first visit, so every page works offline even if it was never opened before
const PAGES = [
    '/', 'home.html', 'signin.html', 'issues.html', 'index.html', 'summary.html', 'report.html', 'medplan.html',
    'schedule.html', 'checkups.html', 'improvements.html', 'exercise.html', 'tracking.html', 'briefing.html',
    'progress.html', 'profile.html', 'offline.html'
];
const FILES = [
    'common.js', 'issue-scope.js', 'neutrix-cloud.js', 'firebase-config.js', 'account-menu.js', 'feedback.js', 'chat.js',
    'nx-charts.js', 'visuals.js', 'camera-capture.js', 'calendar-reminders.js', 'checkup-calendar.js', 'ai-sections.js',
    'summary.js', 'report.js', 'schedule.js', 'checkups.js', 'improvements.js', 'exercise.js', 'exercise-pose.js',
    'issues.js', 'profile.js', 'signin.js', 'home.js', 'tracker&briefing.js', 'pwa.js', 'native-app.js', 'app-shell.js', 'assistant.js',
    'style.css', 'skin.css', 'pages.css', 'theme.css', 'home.css', 'bobby-pages.css', 'tracker&briefing.css',
    'manifest.webmanifest', 'assets/favicon.png', 'assets/neutrix-icon.png', 'assets/neutrix-logo.png',
    'assets/app/icon-192.png', 'assets/app/icon-512.png'
];
// Libraries from other sites that pages need (saved too)
const LIBS = [
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'storage.googleapis.com'];
const isLib = url => LIB_HOSTS.includes(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));

async function saveAll() {
    const cache = await caches.open(CACHE);
    await Promise.all([...PAGES, ...FILES].map(p => cache.add(new Request(p, { cache: 'reload' })).catch(() => {})));
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'no-cors' }).then(r => cache.put(u, r)).catch(() => {})));
}

self.addEventListener('install', e => {
    e.waitUntil(saveAll().then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});
// The page can ask for everything to be saved again (after an update)
self.addEventListener('message', e => {
    if (e.data === 'neutrix:save-all') e.waitUntil(saveAll());
});

// Fresh from the network, saved copy if offline (or if the network takes too long)
async function networkFirst(request, isPage) {
    const cache = await caches.open(CACHE);
    try {
        const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), isPage ? 8000 : 10000))
        ]);
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
    } catch (err) {
        const saved = await cache.match(request) || await cache.match(request, { ignoreSearch: true });
        if (saved) return saved;
        if (isPage) return (await cache.match('offline.html')) || Response.error();
        throw err;
    }
}

// Libraries rarely change: use the saved copy at once, refresh it in the background
async function savedFirst(request) {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(request);
    const fresh = fetch(request).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(request, r.clone()).catch(() => {}); return r; }).catch(() => null);
    return saved || (await fresh) || Response.error();
}

self.addEventListener('fetch', e => {
    const request = e.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.well-known/')) return;   // AI: always live
        e.respondWith(networkFirst(request, request.mode === 'navigate'));
    } else if (isLib(url)) {
        e.respondWith(savedFirst(request));
    }
    // Everything else (Firebase sign-in and database, Google...) goes straight to the network
});
