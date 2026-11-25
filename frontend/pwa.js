// Offline mode + "install as an app" for the website and the Android app. See sw.js.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[pwa]', e)));
}
