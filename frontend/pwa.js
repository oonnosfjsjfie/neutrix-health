// Lets phones install Neutrix as an app (and powers the Android app). See sw.js.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[pwa]', e)));
}
