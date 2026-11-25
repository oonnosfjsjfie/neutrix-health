// =====================================================
// neutrix-cloud.js — accounts + saving each user's data online (Firebase)
//
// Load it FIRST in <head> on every app page (after firebase-config.js, before issue-scope.js).
//
// How it works:
// - The app keeps using localStorage like before.
// - Every change to a "neutrix..." key is remembered as "dirty" and uploaded to
//   Firestore:  users/{uid}/store/{key}
// - When the user signs in on any device, their data is downloaded into localStorage.
// - Each page load also uploads anything not yet sent and downloads changes made on
//   other devices.
// - Keys that only make sense on one device (theme, language, open issue...) are not synced.
// =====================================================
(function () {
    const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const CHUNK = 250000;   // characters per Firestore document (Malayalam uses 3 bytes per character)

    const DEVICE_ONLY = new Set([
        'neutrix_authenticated', 'neutrixTheme', 'neutrixLang', 'neutrixChatOpen', 'neutrixActiveIssue',
        'neutrixCloudDirty', 'neutrixCloudPull', 'neutrixCloudUid', 'neutrixCloudProfile', 'neutrixCloudContact'
    ]);
    const isSynced = key => typeof key === 'string' && /^neutrix/i.test(key) && !DEVICE_ONLY.has(key);

    const config = window.NEUTRIX_FIREBASE_CONFIG || {};
    const configured = !!config.apiKey && !/PASTE_/.test(config.apiKey) && !/PASTE_/.test(config.projectId || '');

    // ---------- Remember which keys changed ----------
    const proto = Storage.prototype;
    const rawGet = proto.getItem;
    const rawSet = proto.setItem;
    const rawRemove = proto.removeItem;
    let applying = false;      // true while writing data that came FROM the cloud

    function readJson(key, fallback) {
        try { return JSON.parse(rawGet.call(localStorage, key) || '') || fallback; } catch (e) { return fallback; }
    }
    function getDirty() { return readJson('neutrixCloudDirty', {}); }
    function setDirty(d) { try { rawSet.call(localStorage, 'neutrixCloudDirty', JSON.stringify(d)); } catch (e) {} }

    function markDirty(key) {
        if (applying || !configured) return;
        const d = getDirty();
        d[key] = Date.now();
        setDirty(d);
        scheduleFlush();
    }

    proto.setItem = function (key, value) {
        const result = rawSet.call(this, key, value);
        if (this === localStorage && isSynced(key)) markDirty(key);
        return result;
    };
    proto.removeItem = function (key) {
        const result = rawRemove.call(this, key);
        if (this === localStorage && isSynced(key)) markDirty(key);
        return result;
    };

    function localSyncedKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (isSynced(k)) keys.push(k);
        }
        return keys;
    }

    function clearLocalData() {
        applying = true;
        try {
            localSyncedKeys().forEach(k => rawRemove.call(localStorage, k));
            ['neutrixCloudDirty', 'neutrixCloudPull', 'neutrixCloudUid', 'neutrixCloudProfile', 'neutrixCloudContact', 'neutrix_authenticated', 'neutrixActiveIssue']
                .forEach(k => rawRemove.call(localStorage, k));
        } finally {
            applying = false;
        }
    }

    // ---------- Load Firebase ----------
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Could not load ' + src));
            document.head.appendChild(s);
        });
    }

    let ready = null;
    function init() {
        if (!configured) return Promise.reject(new Error('Firebase is not set up yet (firebase-config.js).'));
        if (ready) return ready;
        ready = loadScript(SDK + 'firebase-app-compat.js')
            .then(() => loadScript(SDK + 'firebase-auth-compat.js'))
            .then(() => loadScript(SDK + 'firebase-firestore-compat.js'))
            .then(() => {
                const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
                const auth = app.auth();
                const db = app.firestore();
                return { auth, db };
            });
        return ready;
    }

    // Signed-in user (waits for Firebase to restore the session after a page load)
    let firstState = null;
    async function currentUser() {
        const { auth } = await init();
        if (!firstState) {
            firstState = new Promise(resolve => {
                const stop = auth.onAuthStateChanged(user => { stop(); resolve(user); });
            });
        }
        const restored = await firstState;
        return auth.currentUser || restored;   // currentUser is set right after signing in
    }

    // ---------- Firestore helpers ----------
    const docId = key => encodeURIComponent(key).replace(/\./g, '%2E');
    const storeCol = (db, uid) => db.collection('users').doc(uid).collection('store');
    const chunkCol = (db, uid) => db.collection('users').doc(uid).collection('chunks');

    async function uploadKey(db, uid, key) {
        const value = rawGet.call(localStorage, key);
        const id = docId(key);
        const ts = firebase.firestore.FieldValue.serverTimestamp();
        if (value === null) {
            await storeCol(db, uid).doc(id).set({ k: key, v: null, n: 0, t: ts });
            return;
        }
        if (value.length <= CHUNK) {
            await storeCol(db, uid).doc(id).set({ k: key, v: value, n: 0, t: ts });
            return;
        }
        const parts = Math.ceil(value.length / CHUNK);
        for (let i = 0; i < parts; i++) {
            await chunkCol(db, uid).doc(`${id}~${i}`).set({ v: value.slice(i * CHUNK, (i + 1) * CHUNK) });
        }
        await storeCol(db, uid).doc(id).set({ k: key, v: null, n: parts, t: ts });
    }

    async function readValue(db, uid, id, data) {
        if (!data.n) return data.v;
        let value = '';
        for (let i = 0; i < data.n; i++) {
            const part = await chunkCol(db, uid).doc(`${id}~${i}`).get();
            value += part.exists ? (part.data().v || '') : '';
        }
        return value;
    }

    // Upload everything that changed on this device
    let flushing = null;
    async function flush() {
        if (!configured) return 0;
        if (flushing) return flushing;
        flushing = (async () => {
            const user = await currentUser();
            if (!user) return 0;
            const { db } = await init();
            const dirty = getDirty();
            let sent = 0;
            for (const key of Object.keys(dirty)) {
                const markedAt = dirty[key];
                await uploadKey(db, user.uid, key);
                const now = getDirty();
                if (now[key] === markedAt) { delete now[key]; setDirty(now); }   // not changed again meanwhile
                sent++;
            }
            return sent;
        })().finally(() => { flushing = null; });
        return flushing;
    }

    let flushTimer = null;
    function scheduleFlush() {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => { flush().catch(e => console.warn('[cloud] upload failed', e)); }, 1500);
    }

    // Download changes (all of them, or only those newer than the last download)
    async function pull({ full = false } = {}) {
        if (!configured) return 0;
        const user = await currentUser();
        if (!user) return 0;
        const { db } = await init();
        const since = full ? 0 : Number(rawGet.call(localStorage, 'neutrixCloudPull') || 0);
        let query = storeCol(db, user.uid);
        if (since) query = query.where('t', '>', firebase.firestore.Timestamp.fromMillis(since));
        const snap = await query.get();

        const dirty = getDirty();
        let latest = since;
        let changed = 0;
        for (const doc of snap.docs) {
            const data = doc.data();
            const key = data.k;
            if (data.t && data.t.toMillis) latest = Math.max(latest, data.t.toMillis());
            if (!isSynced(key) || dirty[key]) continue;          // local change not uploaded yet wins
            const value = await readValue(db, user.uid, doc.id, data);
            const current = rawGet.call(localStorage, key);
            if (value === current) continue;
            applying = true;
            try {
                if (value === null) rawRemove.call(localStorage, key);
                else rawSet.call(localStorage, key, value);
            } finally {
                applying = false;
            }
            changed++;
        }
        if (latest) rawSet.call(localStorage, 'neutrixCloudPull', String(latest));
        return changed;
    }

    // ---------- Contact card for the Neutrix team: ONLY email, phone and gender ----------
    // contacts/{uid} is the only thing admins can read about a person (see firestore.rules).
    async function syncContact(user) {
        if (!user) return;
        let phone = '';
        let gender = '';
        try {
            const p = JSON.parse(rawGet.call(localStorage, 'neutrix_hospital_profile') || '{}') || {};
            phone = String(p.patientPhone || '').slice(0, 30);
            if (p.patientName) gender = String(p.gender || '').slice(0, 20);   // only once the profile was really filled in
        } catch (e) {}
        const card = { email: user.email || '', phone, gender };
        const sig = user.uid + '|' + card.email + '|' + card.phone + '|' + card.gender;
        if (rawGet.call(localStorage, 'neutrixCloudContact') === sig) return;
        const { db } = await init();
        await db.collection('contacts').doc(user.uid).set({ ...card, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        rawSet.call(localStorage, 'neutrixCloudContact', sig);
    }

    // Name + Google photo, kept on this device for the website's profile button
    function saveProfile(user, displayName) {
        if (!user) return;
        try {
            rawSet.call(localStorage, 'neutrixCloudProfile', JSON.stringify({
                name: displayName || user.displayName || '',
                email: user.email || '',
                photo: user.photoURL || ''
            }));
        } catch (e) {}
    }
    function cachedProfile() { return readJson('neutrixCloudProfile', null); }

    // Sign-in page address that comes back to this page afterwards
    function signInUrl(next) {
        const here = next || ((location.pathname.split('/').pop() || 'home.html') + location.search);
        return 'signin.html?next=' + encodeURIComponent(here);
    }

    // ---------- After signing in (used by signin.js) ----------
    async function afterSignIn(user, displayName) {
        const previousUid = rawGet.call(localStorage, 'neutrixCloudUid');
        if (previousUid && previousUid !== user.uid) {
            clearLocalData();                       // another person used this device before
        }
        const { db } = await init();
        await db.collection('users').doc(user.uid).set({
            name: displayName || user.displayName || '',
            email: user.email || '',
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await pull({ full: true });

        // First account on this device: upload what was already saved here
        if (!previousUid) {
            const d = getDirty();
            localSyncedKeys().forEach(k => { if (!(k in d)) d[k] = Date.now(); });
            setDirty(d);
        }
        rawSet.call(localStorage, 'neutrixCloudUid', user.uid);
        rawSet.call(localStorage, 'neutrix_authenticated', 'true');
        saveProfile(user, displayName);

        const name = displayName || user.displayName;
        if (name && !rawGet.call(localStorage, 'neutrix_patient_name')) {
            localStorage.setItem('neutrix_patient_name', name);
        }
        await flush();
        syncContact(user).catch(e => console.warn('[cloud] contact card', e));
    }

    async function signOut() {
        stopLive();
        try {
            await Promise.race([flush(), new Promise(r => setTimeout(r, 6000))]);
        } catch (e) { console.warn('[cloud] last upload failed', e); }
        try {
            const { auth } = await init();
            await auth.signOut();
        } catch (e) {}
        clearLocalData();
    }

    // ---------- Live sync: changes made on another device (website <-> app) arrive within seconds ----------
    let liveStop = null;
    async function startLive(user) {
        if (liveStop || !user) return;
        try {
            const { db } = await init();
            const since = Number(rawGet.call(localStorage, 'neutrixCloudPull') || 0) || Date.now();
            liveStop = storeCol(db, user.uid)
                .where('t', '>', firebase.firestore.Timestamp.fromMillis(since))
                .onSnapshot(async snap => {
                    if (snap.metadata.hasPendingWrites) return;          // our own upload echoing back
                    const dirty = getDirty();
                    let latest = Number(rawGet.call(localStorage, 'neutrixCloudPull') || 0);
                    let changed = 0;
                    for (const ch of snap.docChanges()) {
                        if (ch.type === 'removed') continue;
                        const data = ch.doc.data({ serverTimestamps: 'estimate' });
                        if (data.t && data.t.toMillis) latest = Math.max(latest, data.t.toMillis());
                        const key = data.k;
                        if (!isSynced(key) || dirty[key]) continue;
                        const value = await readValue(db, user.uid, ch.doc.id, data);
                        if (value === rawGet.call(localStorage, key)) continue;
                        applying = true;
                        try {
                            if (value === null) rawRemove.call(localStorage, key);
                            else rawSet.call(localStorage, key, value);
                        } finally { applying = false; }
                        changed++;
                    }
                    if (latest) rawSet.call(localStorage, 'neutrixCloudPull', String(latest));
                    if (changed) showUpdated();
                }, err => { console.warn('[cloud] live sync paused', err); liveStop = null; });
        } catch (e) { console.warn('[cloud] live sync', e); }
    }
    function stopLive() { if (liveStop) { try { liveStop(); } catch (e) {} liveStop = null; } }

    // Show the new data: refresh the page now, unless the person is in the middle of something
    function busy() {
        const el = document.activeElement;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'radio') return true;
        if (document.querySelector('.cal-modal, .vis-modal, .nx-cam-modal, .nx-fb-modal, dialog[open]')) return true;
        const chat = document.querySelector('.chat-panel');
        if (chat && !chat.classList.contains('hidden') && getComputedStyle(chat).display !== 'none') return true;
        if (window.neutrixBusy) return true;                     // a page can set this while it works (exercise camera, uploads)
        return false;
    }
    let updateTimer = null;
    function showUpdated() {
        clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            if (!busy()) { location.reload(); return; }
            notice(L('updated'), L('refresh'), () => location.reload(), 0);
        }, 600);
    }

    // ---------- Offline mode: banner, and a clear message instead of AI errors ----------
    const TXT = {
        English: {
            offline: 'You\'re offline. Everything you add is saved on this device and will sync when you\'re back online.',
            online: 'Back online. Syncing your changes…',
            updated: 'New changes from your other device.',
            refresh: 'Refresh',
            needsNet: 'You\'re offline. This needs the internet: the AI can\'t work without it. Your saved summary, medicines and readings still work.'
        },
        Malayalam: {
            offline: 'നിങ്ങൾ ഓഫ്‌ലൈനാണ്. നിങ്ങൾ ചേർക്കുന്നതെല്ലാം ഈ ഉപകരണത്തിൽ സേവ് ചെയ്യും, ഇന്റർനെറ്റ് തിരിച്ചുവരുമ്പോൾ സിങ്ക് ചെയ്യും.',
            online: 'ഓൺലൈനായി. മാറ്റങ്ങൾ സിങ്ക് ചെയ്യുന്നു…',
            updated: 'നിങ്ങളുടെ മറ്റൊരു ഉപകരണത്തിൽ നിന്നുള്ള പുതിയ മാറ്റങ്ങൾ.',
            refresh: 'പുതുക്കുക',
            needsNet: 'നിങ്ങൾ ഓഫ്‌ലൈനാണ്. ഇതിന് ഇന്റർനെറ്റ് വേണം: AI ഇന്റർനെറ്റ് ഇല്ലാതെ പ്രവർത്തിക്കില്ല. സേവ് ചെയ്ത സംഗ്രഹം, മരുന്നുകൾ, റീഡിംഗുകൾ എന്നിവ ഇപ്പോഴും പ്രവർത്തിക്കും.'
        }
    };
    const L = k => {
        let lang = 'English';
        try { lang = rawGet.call(localStorage, 'neutrixLang') || 'English'; } catch (e) {}
        return (TXT[lang] || TXT.English)[k];
    };

    let bar = null;
    function notice(text, action, onAction, hideAfter) {
        if (!document.body) { document.addEventListener('DOMContentLoaded', () => notice(text, action, onAction, hideAfter)); return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'nx-net-bar';
            bar.setAttribute('role', 'status');
            document.body.appendChild(bar);
            const st = document.createElement('style');
            st.textContent = `.nx-net-bar { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 6000; width: max-content; max-width: min(560px, calc(100vw - 24px)); box-sizing: border-box;
                display: flex; gap: 12px; align-items: center; padding: 10px 16px; border-radius: 14px; background: #111; color: #fff; font: 600 13.5px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
                .nx-net-bar[hidden] { display: none; }
                .nx-net-bar.off { background: #7c2d12; }
                .nx-net-bar button { flex-shrink: 0; border: none; border-radius: 20px; padding: 6px 14px; background: #fff; color: #111; font: inherit; cursor: pointer; }
                body.nx-offline .chat-fab { bottom: 84px; }`;
            document.head.appendChild(st);
        }
        bar.hidden = false;
        bar.classList.toggle('off', navigator.onLine === false);
        bar.innerHTML = '';
        const span = document.createElement('span');
        span.textContent = text;
        bar.appendChild(span);
        if (action) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = action;
            b.addEventListener('click', onAction);
            bar.appendChild(b);
        }
        clearTimeout(bar._t);
        if (hideAfter) bar._t = setTimeout(() => { bar.hidden = true; }, hideAfter);
    }
    function showNetState() {
        const off = navigator.onLine === false;
        document.documentElement.classList.toggle('nx-offline', off);
        if (document.body) document.body.classList.toggle('nx-offline', off);
        if (off) notice(L('offline'), null, null, 0);
        else if (bar && !bar.hidden && bar.classList.contains('off')) notice(L('online'), null, null, 3000);
    }
    window.addEventListener('offline', showNetState);
    window.addEventListener('online', showNetState);
    if (navigator.onLine === false) showNetState();

    // AI calls while offline: answer straight away with a clear message (pages show "message")
    const rawFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (navigator.onLine === false && /\/api\//.test(url)) {
                const body = JSON.stringify({ ok: false, offline: true, message: L('needsNet'), answer: L('needsNet') });
                return Promise.resolve(new Response(body, { status: 503, headers: { 'Content-Type': 'application/json' } }));
            }
        } catch (e) {}
        return rawFetch(input, init);
    };

    // ---------- On every app page ----------
    function startPageSync() {
        if (!configured) return;
        // The website and the sign-in page are public: never force a sign-in there
        const isPublic = /(^\/$|home\.html$|signin\.html$)/.test(location.pathname);
        if (isPublic) return;
        currentUser().then(async user => {
            if (!user) {
                // Signed out (or signed in on another device only): back to sign in
                rawRemove.call(localStorage, 'neutrix_authenticated');
                location.replace(signInUrl());
                return;
            }
            saveProfile(user);
            if (navigator.onLine !== false) {
                await flush();
                const changed = await pull();
                syncContact(user).catch(e => console.warn('[cloud] contact card', e));
                // Data arrived from another device: reload once so the page shows it
                if (changed > 0 && !sessionStorage.getItem('neutrixCloudReloaded')) {
                    sessionStorage.setItem('neutrixCloudReloaded', '1');
                    location.reload();
                    return;
                }
                sessionStorage.removeItem('neutrixCloudReloaded');
            }
            startLive(user);
        }).catch(e => console.warn('[cloud] sync failed', e));

        // Back online: send what was saved offline, then fetch what changed elsewhere
        window.addEventListener('online', async () => {
            try {
                const user = await currentUser();
                if (!user) return;
                await flush();
                const changed = await pull();
                if (changed > 0) showUpdated();
                startLive(user);
            } catch (e) { console.warn('[cloud] resync failed', e); }
        });

        window.addEventListener('pagehide', () => { flush().catch(() => {}); });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flush().catch(() => {});
        });
    }

    // ---------- Admins (the Admin page) ----------
    // Only shows the button. The real protection is in firestore.rules (same list there).
    const ADMIN_EMAILS = ['altlol2102@gmail.com', 'ajay21022010@gmail.com', 'lingesh.ganesh2@gmail.com', 'adamspencer.miranda2010@gmail.com', 'abcd6162@gmail.com'];
    function isAdminEmail(email) { return ADMIN_EMAILS.includes(String(email || '').toLowerCase()); }
    function isAdmin(user) { return !!user && user.emailVerified !== false && isAdminEmail(user.email); }

    window.NeutrixCloud = {
        configured,
        isAdmin,
        isAdminEmail,
        init,
        currentUser,
        flush,
        pull,
        afterSignIn,
        signOut,
        saveProfile,
        cachedProfile,
        signInUrl,
        syncContact,
        notice
    };

    startPageSync();
})();

// Age from date of birth, worked out today, so it goes up by itself every birthday.
// neutrixAge(profile): the live age from profile.dob, or the age typed in older profiles.
window.neutrixAgeFromDob = function (dob, today) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ''));
    if (!m) return null;
    const now = today || new Date();
    let age = now.getFullYear() - Number(m[1]);
    const beforeBirthday = (now.getMonth() + 1) < Number(m[2]) || ((now.getMonth() + 1) === Number(m[2]) && now.getDate() < Number(m[3]));
    if (beforeBirthday) age--;
    return age >= 0 && age <= 130 ? age : null;
};
window.neutrixAge = function (profile) {
    if (!profile) return '';
    const live = neutrixAgeFromDob(profile.dob);
    return live !== null ? String(live) : (profile.age ? String(profile.age) : '');
};
