// =====================================================
// app-shell.js — the phone-app layout.
// On in the Android app (and in the installed phone app / ?appui=1 for a preview). The website is unchanged.
//
// Instead of the website's top menu, buttons and footer, the app gets:
// - an app bar on top: back arrow, page name, the medical issue, and your picture
// - a tab bar at the bottom: Home, Medicines, Ask AI, Tracker, More
// - a "More" sheet with every other tool and the settings (language, dark mode, report a problem, sign out)
// - phone-sized screens: compact headings, full-width cards and big buttons, full-screen chat
// =====================================================
(function () {
    const qs = new URLSearchParams(location.search);
    try {
        if (qs.get('appui') === '1') sessionStorage.setItem('nxAppUI', '1');
        if (qs.get('appui') === '0') sessionStorage.setItem('nxAppUI', '0');
    } catch (e) {}
    const pref = (() => { try { return sessionStorage.getItem('nxAppUI'); } catch (e) { return null; } })();
    const preview = pref === '1';
    const installed = window.matchMedia && matchMedia('(display-mode: standalone)').matches && window.innerWidth < 900;
    const native = !!(window.NxNative && NxNative.isApp);
    // The website on a phone gets the same layout: app bar on top, tab bar at the bottom
    // (screen size, because the page width isn't settled yet this early)
    const phoneWeb = pref !== '0' && !!window.matchMedia && Math.min(screen.width, screen.height) <= 600
        && (matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent));
    const page0 = location.pathname.split('/').pop() || '';
    const marketing = /^(home\.html)?$/.test(page0);
    const on = native || preview || installed || (phoneWeb && !marketing);
    window.NxAppUI = { on, web: !(native || installed) };
    if (!on) return;

    // The marketing website isn't part of the app
    if (marketing) { location.replace('issues.html'); return; }

    document.documentElement.classList.add('nx-app-ui');

    // ---------- Words ----------
    const T = {
        English: {
            home: 'Home', medicines: 'Medicines', ai: 'Ask AI', emma: 'Emma', chat: 'AI chat', tracker: 'Tracker', more: 'More',
            tools: 'Recovery tools', account: 'Account & settings',
            upload: 'AI Summary', report: 'Reports', medplan: 'Medicine plan', schedule: 'Daily medicines', checkups: 'Check-ups',
            improvements: 'Improvements', exercise: 'Exercise coach', tracking: 'Recovery tracker', briefing: 'Ask Doctor',
            progress: 'Progress report', body3d: '3D View', care: 'My Care', doctorcard: 'Doctor card', emergencycard: 'Emergency card', family: 'Family sharing', privacy: 'Privacy & data', issues: 'My issues', profile: 'My profile', admin: 'Admin',
            dashboard: 'Home', language: 'മലയാളം', dark: 'Dark mode', light: 'Light mode', problem: 'Report a problem',
            signout: 'Sign out', signingOut: 'Signing out…', back: 'Back', close: 'Close', pickIssue: 'Pick a medical issue first.'
        },
        Malayalam: {
            home: 'ഹോം', medicines: 'മരുന്നുകൾ', ai: 'AI-യോട്', emma: 'എമ്മ', chat: 'AI ചാറ്റ്', tracker: 'ട്രാക്കർ', more: 'കൂടുതൽ',
            tools: 'റിക്കവറി ടൂളുകൾ', account: 'അക്കൗണ്ട് & ക്രമീകരണങ്ങൾ',
            upload: 'AI സംഗ്രഹം', report: 'റിപ്പോർട്ടുകൾ', medplan: 'മരുന്ന് പ്ലാൻ', schedule: 'ദിവസേനയുള്ള മരുന്നുകൾ', checkups: 'പരിശോധനകൾ',
            improvements: 'പുരോഗതി', exercise: 'വ്യായാമ സഹായി', tracking: 'റിക്കവറി ട്രാക്കർ', briefing: 'ഡോക്ടറോട് ചോദിക്കുക',
            progress: 'പുരോഗതി റിപ്പോർട്ട്', body3d: '3D വ്യൂ', care: 'എന്റെ പരിചരണം', doctorcard: 'ഡോക്ടർ കാർഡ്', emergencycard: 'എമർജൻസി കാർഡ്', family: 'കുടുംബം', privacy: 'സ്വകാര്യത', issues: 'എന്റെ പ്രശ്നങ്ങൾ', profile: 'എന്റെ പ്രൊഫൈൽ', admin: 'അഡ്മിൻ',
            dashboard: 'ഹോം', language: 'English', dark: 'ഡാർക്ക് മോഡ്', light: 'ലൈറ്റ് മോഡ്', problem: 'പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക',
            signout: 'സൈൻ ഔട്ട്', signingOut: 'സൈൻ ഔട്ട് ചെയ്യുന്നു…', back: 'പിന്നോട്ട്', close: 'അടയ്ക്കുക', pickIssue: 'ആദ്യം ഒരു പ്രശ്നം തിരഞ്ഞെടുക്കുക.'
        }
    };
    const lang = () => { try { return localStorage.getItem('neutrixLang') === 'Malayalam' ? 'Malayalam' : 'English'; } catch (e) { return 'English'; } };
    const t = k => (T[lang()] || T.English)[k] || T.English[k] || k;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ---------- Where we are ----------
    const PAGE_BY_FILE = {
        'index.html': 'dashboard', 'summary.html': 'upload', 'report.html': 'report', 'medplan.html': 'medplan',
        'schedule.html': 'schedule', 'checkups.html': 'checkups', 'improvements.html': 'improvements', 'exercise.html': 'exercise',
        'tracking.html': 'tracking', 'briefing.html': 'briefing', 'progress.html': 'progress', 'issues.html': 'issues', 'body3d.html': 'body3d', 'care.html': 'care', 'doctor-card.html': 'doctorcard', 'emergency-card.html': 'emergencycard', 'family.html': 'family', 'privacy.html': 'privacy',
        'profile.html': 'profile', 'admin.html': 'admin', 'signin.html': 'signin'
    };
    const page = PAGE_BY_FILE[page0] || 'other';
    const ROOTS = ['dashboard', 'issues', 'signin'];
    function activeIssue() {
        try {
            const id = localStorage.getItem('neutrixActiveIssue');
            const list = JSON.parse(localStorage.getItem('neutrixIssues') || '[]');
            return list.find(i => i.id === id) || null;
        } catch (e) { return null; }
    }
    const issue = activeIssue();
    const hasReport = () => { try { return !!(window.storeGet && storeGet('neutrixReport')); } catch (e) { return false; } };
    const hasExercise = () => { try { const ex = window.exerciseInfo && exerciseInfo(); return !!(ex && ex.exercises && ex.exercises.length); } catch (e) { return false; } };

    const ICON = {
        home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
        medicines: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/>',
        ai: '<path d="M4 5h16v11H8l-4 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
        tracker: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
        emma: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
        more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
        back: '<path d="M15 5l-7 7 7 7"/>'
    };
    const svg = (name, fill) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

    // ---------- Build ----------
    function build() {
        if (document.querySelector('.nx-appbar')) return;

        // App bar
        const bar = document.createElement('header');
        bar.className = 'nx-appbar';
        bar.innerHTML = `
            <button type="button" class="nx-ab-back" aria-label="${esc(t('back'))}">${svg('back')}</button>
            <div class="nx-ab-titles"><div class="nx-ab-title"></div><div class="nx-ab-sub"></div></div>
            <button type="button" class="nx-ab-me" aria-label="${esc(t('more'))}"></button>`;
        document.body.prepend(bar);
        // Emergency Card: red button at the top of Home and My Issues
        if (['dashboard', 'issues'].includes(page)) {
            const sos = document.createElement('a');
            sos.className = 'nx-ab-sos';
            sos.href = 'emergency-card.html';
            sos.setAttribute('aria-label', t('emergencycard'));
            sos.innerHTML = `<span aria-hidden="true">🆘</span><span>${esc(t('emergencycard'))}</span>`;
            bar.insertBefore(sos, bar.querySelector('.nx-ab-me'));
        }
        bar.querySelector('.nx-ab-back').addEventListener('click', goBack);
        bar.querySelector('.nx-ab-me').addEventListener('click', openMore);

        // Tab bar (not on the sign-in page)
        if (page !== 'signin') {
            const tabs = document.createElement('nav');
            tabs.className = 'nx-tabbar';
            tabs.innerHTML = [
                ['home', 'home'], ['medicines', 'medicines'], ['emma', 'emma'], ['tracker', 'tracker'], ['more', 'more']
            ].map(([key, icon]) => `<button type="button" class="nx-tab" data-tab="${key}">${key === 'emma' ? `<i class="nx-tab-emma">${svg(icon, true)}</i>` : svg(icon, false)}<span></span></button>`).join('');
            document.body.appendChild(tabs);
            tabs.addEventListener('click', e => {
                const b = e.target.closest('.nx-tab');
                if (b) tab(b.dataset.tab);
            });
        }
        paint();
        // Opened from the Ask AI tab on a page without the chat
        if (qs.get('chat') === '1') setTimeout(() => openChat(true), 400);
        document.body.classList.add('nx-app-ready');
    }

    function paint() {
        const bar = document.querySelector('.nx-appbar');
        if (!bar) return;
        const titleKey = page === 'dashboard' ? 'dashboard' : page;
        let title = page === 'dashboard' && issue ? `${issue.icon || ''} ${issue.title}`.trim() : t(titleKey);
        if (page === 'other' || page === 'signin') title = 'Neutrix Health';
        bar.querySelector('.nx-ab-title').textContent = title;
        bar.querySelector('.nx-ab-sub').textContent = (issue && !['dashboard', 'issues', 'profile', 'signin', 'admin'].includes(page)) ? issue.title : '';
        bar.querySelector('.nx-ab-back').hidden = ROOTS.includes(page);
        // Picture or first letter
        const me = bar.querySelector('.nx-ab-me');
        let prof = null;
        try { prof = (window.NeutrixCloud && NeutrixCloud.cachedProfile && NeutrixCloud.cachedProfile()) || null; } catch (e) {}
        let photo = '';
        try { photo = (JSON.parse(localStorage.getItem('neutrix_hospital_profile') || '{}') || {}).profileImage || ''; } catch (e) {}
        photo = photo || (prof && prof.photo) || '';
        const name = (prof && (prof.name || prof.email)) || localStorage.getItem('neutrix_patient_name') || 'N';
        me.innerHTML = photo ? `<img src="${esc(photo)}" alt="">` : `<span>${esc(String(name).trim().charAt(0).toUpperCase() || 'N')}</span>`;
        me.hidden = page === 'signin';

        document.querySelectorAll('.nx-tab').forEach(b => {
            b.querySelector('span').textContent = t(b.dataset.tab);
            const current = { home: ['dashboard', 'issues'], medicines: ['schedule', 'medplan'], tracker: ['tracking'], emma: [], more: [] }[b.dataset.tab] || [];
            b.classList.toggle('active', current.includes(page));
        });
    }

    // ---------- Actions ----------
    function needIssue(href) {
        if (issue) { location.href = href; return; }
        if (window.NeutrixCloud && NeutrixCloud.notice) NeutrixCloud.notice(t('pickIssue'), null, null, 2500);
        if (page !== 'issues') location.href = 'issues.html';
    }
    function tab(key) {
        if (key === 'home') location.href = issue ? 'index.html' : 'issues.html';
        else if (key === 'medicines') needIssue('schedule.html');
        else if (key === 'tracker') needIssue('tracking.html');
        else if (key === 'emma') { if (window.NxAssistant) NxAssistant.open(); else openChat(false); }
        else if (key === 'ai') openChat(false);
        else if (key === 'more') openMore();
    }
    function openChat(fromLink) {
        const fab = document.querySelector('.chat-fab');
        const panel = document.querySelector('.chat-panel');
        if (fab && panel) {
            if (panel.classList.contains('hidden')) fab.click();
            return;
        }
        if (!fromLink) needIssue('index.html?chat=1');
    }
    function goBack() {
        if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) history.back();
        else location.href = issue ? 'index.html' : 'issues.html';
    }
    function clickFirst(...sels) {
        for (const s of sels) { const el = document.querySelector(s); if (el) { el.click(); return true; } }
        return false;
    }

    // ---------- More sheet ----------
    function openMore() {
        if (document.querySelector('.nx-sheet-wrap')) return;
        const tools = issue ? [
            ['📄', 'upload', 'summary.html'],
            hasReport() && ['📋', 'report', 'report.html'],
            hasReport() && ['🫀', 'body3d', 'body3d.html'],
            hasReport() && ['💊', 'medplan', 'medplan.html'],
            ['✅', 'schedule', 'schedule.html'],
            hasReport() && ['📅', 'checkups', 'checkups.html'],
            hasReport() && ['📈', 'improvements', 'improvements.html'],
            hasExercise() && ['🏃', 'exercise', 'exercise.html'],
            ['🩺', 'tracking', 'tracking.html'],
            ['✉️', 'briefing', 'briefing.html'],            ['📊', 'progress', 'progress.html'],
            hasReport() && ['🛡️', 'care', 'care.html'],
            ['🆘', 'emergencycard', 'emergency-card.html'],
            hasReport() && ['🪪', 'doctorcard', 'doctor-card.html'],
            ['👨‍👩‍👧', 'family', 'family.html'],
            ['💬', 'chat', '#chat']
        ].filter(Boolean) : [];
        let isAdmin = false;
        try { const p = NeutrixCloud.cachedProfile(); isAdmin = !!(p && NeutrixCloud.isAdminEmail(p.email)); } catch (e) {}
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const rows = [
            ['🗂', t('issues'), 'issues.html'],            ['👤', t('profile'), 'profile.html'],
            ['🔒', t('privacy'), 'privacy.html'],
            isAdmin && ['🛡', t('admin'), 'admin.html'],
            ['🌐', t('language'), '#lang'],
            [dark ? '☀️' : '🌙', dark ? t('light') : t('dark'), '#theme'],
            ['🚩', t('problem'), '#problem'],
            ['🚪', t('signout'), '#signout']
        ].filter(Boolean);
        const wrap = document.createElement('div');
        wrap.className = 'nx-sheet-wrap';
        wrap.innerHTML = `
            <div class="nx-sheet" role="dialog" aria-modal="true">
                <div class="nx-sheet-grip"></div>
                ${tools.length ? `<div class="nx-sheet-title">${esc(t('tools'))}</div>
                <div class="nx-sheet-grid">${tools.map(([ic, k, href]) => `<a class="nx-tool${PAGE_BY_FILE[href] === page ? ' here' : ''}" href="${href}"><span class="nx-tool-ic">${ic}</span><span>${esc(t(k))}</span></a>`).join('')}</div>` : ''}
                <div class="nx-sheet-title">${esc(t('account'))}</div>
                <div class="nx-sheet-list">${rows.map(([ic, label, href]) => `<a class="nx-row" href="${href}"><span class="nx-row-ic">${ic}</span><span>${esc(label)}</span><span class="nx-row-go">›</span></a>`).join('')}</div>
            </div>`;
        document.body.appendChild(wrap);
        requestAnimationFrame(() => wrap.classList.add('open'));
        const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 220); document.removeEventListener('keydown', onKey); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        wrap.addEventListener('click', async e => {
            if (e.target === wrap) { close(); return; }
            const a = e.target.closest('a');
            if (!a) return;
            const href = a.getAttribute('href');
            if (!href.startsWith('#')) return;                 // normal pages: just go
            e.preventDefault();
            if (href === '#chat') { close(); openChat(false); }
            else if (href === '#lang') { close(); clickFirst('#langToggle', '#langToggleBtn'); setTimeout(paint, 50); }
            else if (href === '#theme') { close(); clickFirst('#themeToggle', '#themeToggleBtn'); }
            else if (href === '#problem') { close(); clickFirst('#nxReportBtn'); }
            else if (href === '#signout') {
                a.querySelector('span:nth-child(2)').textContent = t('signingOut');
                try { if (window.NeutrixCloud) await NeutrixCloud.signOut(); } catch (err) {}
                location.href = 'signin.html';
            }
        });
    }
    window.NxAppUI.openMore = openMore;
    window.NxAppUI.closeSheet = () => { const w = document.querySelector('.nx-sheet-wrap'); if (w) { w.remove(); return true; } return false; };

    // ---------- Look ----------
    const css = `
    html.nx-app-ui { --nx-top: env(safe-area-inset-top, 0px); --nx-bottom: env(safe-area-inset-bottom, 0px); }
    html.nx-app-ui body { padding-top: calc(60px + var(--nx-top)) !important; padding-bottom: calc(76px + var(--nx-bottom)) !important;
        -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; background: var(--bg-workspace, #f8fafc); }
    html.nx-app-ui body.nx-app-ready { animation: nxIn .22s ease-out; }
    @keyframes nxIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    /* website pieces the app replaces */
    html.nx-app-ui .ehr-navbar, html.nx-app-ui .nx-footer, html.nx-app-ui .px-footer, html.nx-app-ui .nx-scroll-progress,
    html.nx-app-ui .nx-top-btn, html.nx-app-ui #nxIssueBar, html.nx-app-ui #nxReportBtn, html.nx-app-ui .chat-fab,
    html.nx-app-ui .nx-eyebrow, html.nx-app-ui .nx-hero-sub, html.nx-app-ui .nx-get-app { display: none !important; }

    /* app bar */
    .nx-appbar { position: fixed; top: 0; left: 0; right: 0; z-index: 4000; height: calc(60px + var(--nx-top)); padding: var(--nx-top) 10px 0;
        display: flex; align-items: center; gap: 6px; box-sizing: border-box; background: var(--card-bg, #fff); border-bottom: 1px solid var(--border-light, #e2e8f0); }
    .nx-appbar button { border: none; background: none; color: var(--text-primary); cursor: pointer; }
    .nx-ab-back { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; }
    .nx-ab-back svg { width: 24px; height: 24px; }
    .nx-ab-back[hidden] { display: grid !important; visibility: hidden; width: 8px; }
    .nx-ab-titles { flex: 1; min-width: 0; }
    .nx-ab-title { font: 700 18px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nx-ab-sub { font: 500 12.5px/1.3 system-ui, sans-serif; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nx-ab-sub:empty { display: none; }
    .nx-ab-me { width: 38px; height: 38px; border-radius: 50%; padding: 0 !important; overflow: hidden; display: grid; place-items: center;
        background: linear-gradient(135deg, #a855f7, #3b82f6) !important; color: #fff !important; font: 700 16px system-ui, sans-serif; flex-shrink: 0; }
    .nx-ab-me img { width: 100%; height: 100%; object-fit: cover; }
    .nx-ab-me[hidden] { display: none; }
    .nx-ab-sos { display: flex; align-items: center; gap: 5px; height: 36px; padding: 0 12px; border-radius: 999px; background: #dc2626; color: #fff !important;
        text-decoration: none; font: 700 13px system-ui, sans-serif; white-space: nowrap; flex: none; margin-right: 8px; box-shadow: 0 4px 12px rgba(220, 38, 38, .3); }
    @media (max-width: 360px) { .nx-ab-sos span:last-child { display: none; } .nx-ab-sos { padding: 0 10px; } }

    /* tab bar */
    .nx-tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 4000; height: calc(68px + var(--nx-bottom)); padding: 0 4px var(--nx-bottom);
        display: grid; grid-template-columns: repeat(5, 1fr); box-sizing: border-box; background: var(--card-bg, #fff); border-top: 1px solid var(--border-light, #e2e8f0); }
    .nx-tab { border: none; background: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
        color: var(--text-muted); font: 600 11.5px system-ui, sans-serif; cursor: pointer; min-width: 0; }
    .nx-tab svg { width: 24px; height: 24px; }
    .nx-tab span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .nx-tab.active { color: var(--text-primary); }
    .nx-tab.active svg { background: var(--pill-bg, #f1f5f9); border-radius: 14px; padding: 3px 16px; box-sizing: content-box; }
    .nx-tab[data-tab="ai"] svg { color: #a855f7; }
    /* Emma: raised round button in the middle */
    .nx-tab[data-tab="emma"] { justify-content: flex-end; padding-bottom: 9px; color: var(--text-primary); }
    .nx-tab-emma { display: grid; place-items: center; width: 52px; height: 52px; margin-top: -26px; border-radius: 50%; color: #fff;
        background: linear-gradient(135deg, #6d28d9, #2563eb); border: 4px solid var(--card-bg, #fff); box-shadow: 0 6px 18px rgba(79, 70, 229, .35); }
    .nx-tab-emma svg { width: 24px !important; height: 24px !important; background: none !important; padding: 0 !important; }
    html.nx-app-ui #nxaButton.nxa-ab { display: none !important; }

    /* phone-sized content */
    html.nx-app-ui .nx-hero { padding: 14px 16px 2px !important; margin: 0 !important; text-align: left !important; min-height: 0 !important; }
    html.nx-app-ui .nx-hero-title { font-size: 24px !important; line-height: 1.2 !important; margin: 0 !important; }
    html.nx-app-ui .dash-hero { padding: 8px 0 0 !important; text-align: left !important; }
    html.nx-app-ui .dash-hero h1, html.nx-app-ui .dash-title { font-size: 26px !important; line-height: 1.2 !important; }
    html.nx-app-ui .ehr-workspace, html.nx-app-ui .nx-site .ehr-workspace { margin: 10px 12px 20px !important; padding: 0 !important; gap: 14px !important; max-width: none !important; }
    html.nx-app-ui .ehr-card { border-radius: 20px !important; padding: 18px 16px !important; box-shadow: none !important; border: 1px solid var(--border-light, #e2e8f0) !important; }
    html.nx-app-ui .btn-primary, html.nx-app-ui .btn-secondary, html.nx-app-ui .btn-outline { min-height: 48px; border-radius: 14px !important; font-size: 15.5px !important; }
    html.nx-app-ui .card-header { flex-wrap: wrap; gap: 8px; }
    html.nx-app-ui input:not([type=checkbox]):not([type=radio]), html.nx-app-ui select, html.nx-app-ui textarea { font-size: 16px !important; min-height: 44px; border-radius: 12px !important; }

    /* the app bar names the page, so no website slogan above each screen */
    html.nx-app-ui .nx-hero:not(:has(.dash-hero)) { display: none !important; }
    html.nx-app-ui .dash-eyebrow, html.nx-app-ui .dash-sub { display: none !important; }
    html.nx-app-ui .dash-title { font-size: 22px !important; margin: 4px 4px 0 !important; }
    /* dashboard: a grid of app icons instead of big website tiles */
    html.nx-app-ui .dash-grid { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 10px !important; }
    html.nx-app-ui .dash-tile { padding: 14px 6px 12px !important; border-radius: 18px !important; min-height: 0 !important; height: auto !important;
        display: flex !important; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
    html.nx-app-ui .tile-num, html.nx-app-ui .tile-owner, html.nx-app-ui .tile-arrow, html.nx-app-ui .tile-desc { display: none !important; }
    html.nx-app-ui .tile-visual { justify-content: center !important; margin: 0 !important; }
    html.nx-app-ui .tile-title { font-size: 12.5px !important; line-height: 1.25 !important; margin: 0 !important; }

    /* chat fills the screen between the bars */
    html.nx-app-ui .chat-panel { position: fixed !important; top: calc(60px + var(--nx-top)) !important; bottom: calc(68px + var(--nx-bottom)) !important;
        left: 0 !important; right: 0 !important; width: auto !important; max-width: none !important; height: auto !important; max-height: none !important;
        border-radius: 0 !important; z-index: 3900 !important; }
    html.nx-app-ui .nx-net-bar { bottom: calc(80px + var(--nx-bottom)) !important; }

    /* More sheet */
    .nx-sheet-wrap { position: fixed; inset: 0; z-index: 5000; background: rgba(0,0,0,0); transition: background .2s; display: flex; align-items: flex-end; }
    .nx-sheet-wrap.open { background: rgba(0,0,0,.45); }
    .nx-sheet { width: 100%; max-height: 86vh; overflow-y: auto; background: var(--card-bg, #fff); color: var(--text-primary); border-radius: 24px 24px 0 0;
        padding: 8px 16px calc(20px + var(--nx-bottom)); transform: translateY(100%); transition: transform .22s ease-out; box-sizing: border-box; }
    .nx-sheet-wrap.open .nx-sheet { transform: none; }
    .nx-sheet-grip { width: 40px; height: 5px; border-radius: 3px; background: var(--border-color, #cbd5e1); margin: 4px auto 10px; }
    .nx-sheet-title { font: 800 11.5px system-ui, sans-serif; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-muted); margin: 12px 4px 10px; }
    .nx-sheet-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .nx-tool { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px; border-radius: 16px; background: var(--pill-bg, #f1f5f9);
        color: var(--text-primary); text-decoration: none; font: 600 12.5px/1.25 system-ui, sans-serif; text-align: center; }
    .nx-tool.here { outline: 2px solid #a855f7; }
    .nx-tool-ic { font-size: 24px; line-height: 1; }
    .nx-sheet-list { border-radius: 16px; overflow: hidden; background: var(--pill-bg, #f1f5f9); }
    .nx-row { display: flex; align-items: center; gap: 12px; padding: 14px 14px; color: var(--text-primary); text-decoration: none; font: 600 15px system-ui, sans-serif;
        border-bottom: 1px solid var(--border-light, #e2e8f0); }
    .nx-row:last-child { border-bottom: none; }
    .nx-row-ic { width: 24px; text-align: center; font-size: 18px; }
    .nx-row-go { margin-left: auto; color: var(--text-muted); font-size: 20px; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
    document.addEventListener('neutrix:langchange', () => setTimeout(paint, 0));
})();
