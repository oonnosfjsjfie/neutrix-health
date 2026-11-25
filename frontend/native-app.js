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
        if (window.NxCloseUpdate && NxCloseUpdate()) return true;
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

    // ---------- "Update available" message ----------
    // Each app build publishes "versionCode: N" in the GitHub release notes. When that number is higher than
    // this app's own build number, the user is asked to update: the button opens the download page
    // (get-app.html) in the phone's browser, which tells them to delete the old app and install the new one.
    const RELEASE_API = 'https://api.github.com/repos/oonnosfjsjfie/neutrix-health/releases/tags/android-latest';
    const GET_APP_URL = location.origin + '/get-app.html';
    const SNOOZE_KEY = 'nxUpdateSnooze';
    let checking = false, lastCheck = 0;
    async function checkForUpdate() {
        if (checking || !navigator.onLine || !P.App || !P.App.getInfo) return;
        if (Date.now() - lastCheck < 30 * 60 * 1000) return;          // at most every 30 minutes
        checking = true; lastCheck = Date.now();
        try {
            const info = await P.App.getInfo();
            const mine = parseInt(info && info.build, 10);
            const rel = await fetch(RELEASE_API, { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
            const m = rel && /versionCode:\s*(\d+)/.exec(rel.body || '');
            const latest = m ? parseInt(m[1], 10) : 0;
            const nameMatch = rel && /versionName:\s*([\w.]+)/.exec(rel.body || '');
            if (!mine || !latest || latest <= mine) return;
            let snooze = {};
            try { snooze = JSON.parse(sessionStorage.getItem(SNOOZE_KEY) || '{}'); } catch (e) {}
            if (snooze.v === latest) return;                           // "Later" pressed for this version
            showUpdate(latest, nameMatch ? nameMatch[1] : '');
        } catch (e) {
            console.warn('[app] update check', e);
        } finally {
            checking = false;
        }
    }
    function showUpdate(latest, name) {
        if (document.getElementById('nx-update')) return;
        const style = document.createElement('style');
        style.textContent = `
            #nx-update { position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,.6); display: flex; align-items: flex-end; justify-content: center; }
            #nx-update .box { background: #141414; color: #f5f5f5; width: 100%; max-width: 480px; border-radius: 22px 22px 0 0; padding: 22px 20px calc(20px + env(safe-area-inset-bottom));
                              font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; box-shadow: 0 -10px 40px rgba(0,0,0,.5); animation: nxUp .25s ease-out; }
            @keyframes nxUp { from { transform: translateY(100%); } to { transform: none; } }
            #nx-update h3 { margin: 0 0 6px; font-size: 19px; }
            #nx-update p { margin: 0 0 12px; color: #b5b5b5; font-size: 14.5px; line-height: 1.45; }
            #nx-update .warn { background: #2a1a06; border: 1px solid #b45309; color: #fcd34d; border-radius: 12px; padding: 10px 12px; font-size: 14px; line-height: 1.4; margin-bottom: 16px; }
            #nx-update .row { display: flex; gap: 10px; }
            #nx-update button { flex: 1; padding: 13px; border-radius: 26px; font-size: 15.5px; font-weight: 700; border: 1px solid #333; background: transparent; color: #ddd; }
            #nx-update button.go { background: #fff; color: #000; border-color: #fff; }`;
        const wrap = document.createElement('div');
        wrap.id = 'nx-update';
        wrap.innerHTML = `<div class="box" role="dialog" aria-labelledby="nx-up-t">
            <h3 id="nx-up-t">Update available${name ? ' · v' + name : ''}</h3>
            <p>A new version of the Neutrix app is ready with the latest changes.<br>പുതിയ അപ്ഡേറ്റ് ലഭ്യമാണ്.</p>
            <div class="warn">⚠️ <b>Delete the current (old) Neutrix app first</b>, then install the new one. Your data is safe in your account and comes back when you sign in.</div>
            <div class="row"><button type="button" data-later>Later</button><button type="button" class="go" data-go>Update app</button></div>
        </div>`;
        document.head.appendChild(style);
        document.body.appendChild(wrap);
        const close = () => { wrap.remove(); style.remove(); };
        wrap.querySelector('[data-later]').onclick = () => {
            try { sessionStorage.setItem(SNOOZE_KEY, JSON.stringify({ v: latest })); } catch (e) {}
            close();
        };
        wrap.querySelector('[data-go]').onclick = () => {
            if (P.Browser) P.Browser.open({ url: GET_APP_URL }); else location.href = GET_APP_URL;
        };
        window.NxCloseUpdate = () => { if (document.getElementById('nx-update')) { wrap.querySelector('[data-later]').click(); return true; } return false; };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(checkForUpdate, 1500));
    else setTimeout(checkForUpdate, 1500);
    window.addEventListener('online', () => setTimeout(checkForUpdate, 1500));
    if (P.App && P.App.addListener) P.App.addListener('resume', () => { lastCheck = 0; checkForUpdate(); });

    // Small message at the bottom (uses the sync bar when available)
    function alertBar(text) {
        if (window.NeutrixCloud && NeutrixCloud.notice) NeutrixCloud.notice(text, null, null, 4000);
    }
})();
