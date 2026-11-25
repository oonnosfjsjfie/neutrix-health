// =====================================================
// native-app.js — makes the website behave like a real app inside the Neutrix Android app.
// Does nothing in a normal browser.
//
// Inside the app (Capacitor):
// - Downloads (PDF reports, calendar files) are saved on the phone and opened with the right app.
// - Links to other sites (Google Calendar, Gmail...) open in an in-app browser window.
// - The phone's Back button closes pop-ups, goes back a page, or leaves the app on the first page.
// - Google sign-in uses the phone's own Google account picker (Google blocks its web window in apps).
// =====================================================
(function () {
    const C = window.Capacitor;
    const isApp = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
    const P = (C && C.Plugins) || {};

    // ---------- Google sign-in (used by signin.js) ----------
    async function googleIdToken() {
        const FA = P.FirebaseAuthentication;
        if (!FA) throw { code: 'neutrix/google-not-ready' };
        let result;
        try {
            result = await FA.signInWithGoogle({ skipNativeAuth: true });
        } catch (e) {
            const msg = String((e && (e.message || e.code)) || e);
            if (/cancel/i.test(msg)) throw { code: 'neutrix/cancelled' };
            console.warn('[app] Google sign-in', msg);
            throw { code: 'neutrix/google-not-ready', message: msg };
        }
        const token = result && result.credential && result.credential.idToken;
        if (!token) throw { code: 'neutrix/google-not-ready' };
        return token;
    }

    window.NxNative = { isApp, googleIdToken };
    if (!isApp) return;

    document.documentElement.classList.add('nx-app');

    // ---------- Downloads: save the file on the phone, then open or share it ----------
    const TYPES = { pdf: 'application/pdf', ics: 'text/calendar', csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', txt: 'text/plain' };
    function toBase64(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1] || '');
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    }
    async function saveAndOpen(href, name) {
        try {
            const blob = await (await fetch(href)).blob();
            const fileName = (name || 'Neutrix_file').replace(/[\\/:*?"<>|]+/g, '_');
            const ext = (fileName.split('.').pop() || '').toLowerCase();
            const type = TYPES[ext] || blob.type || 'application/octet-stream';
            const saved = await P.Filesystem.writeFile({ path: fileName, data: await toBase64(blob), directory: 'CACHE' });
            try {
                if (!P.FileOpener) throw new Error('no opener');
                await P.FileOpener.open({ filePath: saved.uri, contentType: type, openWithDefault: true });
            } catch (e) {
                await P.Share.share({ title: fileName, url: saved.uri, dialogTitle: fileName });
            }
        } catch (e) {
            console.warn('[app] download', e);
            alertBar('Could not save the file. Please try again.');
        }
    }
    const isFileLink = a => a && a.download && /^(blob:|data:)/.test(a.href || '');
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (isFileLink(this)) { saveAndOpen(this.href, this.download); return; }
        return origClick.call(this);
    };
    const origDispatch = HTMLAnchorElement.prototype.dispatchEvent;
    HTMLAnchorElement.prototype.dispatchEvent = function (ev) {
        if (ev && ev.type === 'click' && isFileLink(this)) { saveAndOpen(this.href, this.download); return false; }
        return origDispatch.call(this, ev);
    };

    // ---------- Links to other sites open in an in-app browser window ----------
    const sameSite = url => { try { return new URL(url, location.href).origin === location.origin; } catch (e) { return true; } };
    function openOutside(url) {
        const u = new URL(url, location.href).href;
        if (/^https?:/i.test(u) && P.Browser) { P.Browser.open({ url: u }); return; }
        location.href = u;                                     // mailto:, tel: ... handled by the phone
    }
    const origOpen = window.open;
    window.open = function (url, target, features) {
        if (!url) return origOpen.call(window, url, target, features);
        if (sameSite(url)) { location.href = new URL(url, location.href).href; return null; }
        openOutside(url);
        return null;
    };
    document.addEventListener('click', e => {
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a || e.defaultPrevented) return;
        if (isFileLink(a)) { e.preventDefault(); saveAndOpen(a.href, a.download); return; }
        const href = a.getAttribute('href') || '';
        if (/^(#|javascript:)/i.test(href)) return;
        if (!sameSite(a.href) || /^(mailto:|tel:)/i.test(href)) { e.preventDefault(); openOutside(a.href); return; }
        if (a.target === '_blank') { e.preventDefault(); location.href = a.href; }   // same site: stay in the app
    }, true);

    // ---------- Back button ----------
    function closeTopPopup() {
        if (window.NxAppUI && NxAppUI.closeSheet && NxAppUI.closeSheet()) return true;
        const sel = '.vis-modal, .cal-modal, .nx-cam-modal, .nx-fb-modal';
        if (document.querySelector(sel)) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            const still = document.querySelector(sel);
            if (still) { const x = still.querySelector('.vis-x, .cal-x, [data-close], .nx-cam-close, button[aria-label="Close"]'); if (x) x.click(); else still.remove(); }
            return true;
        }
        const menu = document.querySelector('.nx-acct-menu:not([hidden])');
        if (menu) { menu.hidden = true; return true; }
        const chat = document.querySelector('.chat-panel:not(.hidden)');
        const fab = document.querySelector('.chat-fab');
        if (chat && fab && getComputedStyle(chat).display !== 'none') { fab.click(); return true; }
        return false;
    }
    if (P.App && P.App.addListener) {
        P.App.addListener('backButton', ({ canGoBack }) => {
            if (closeTopPopup()) return;
            const first = /(issues\.html|^\/$)/.test(location.pathname) || !canGoBack;
            if (first) P.App.exitApp(); else history.back();
        });
    }

    // Small message at the bottom (uses the sync bar when available)
    function alertBar(text) {
        if (window.NeutrixCloud && NeutrixCloud.notice) NeutrixCloud.notice(text, null, null, 4000);
    }
})();
