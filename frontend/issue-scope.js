// =====================================================
// issue-scope.js
// Load this FIRST in the <head> of every page that belongs
// to one medical issue (dashboard + all feature pages).
//
// It does three things:
// 1. Sends logged-out users to signin.html, and users with
//    no open issue to issues.html.
// 2. Keeps each issue's data separate: the keys listed in
//    PER_ISSUE_KEYS are saved as "key::issueId" automatically,
//    so page code can keep using plain localStorage.
// 3. Shows a small bar with the current issue and links back
//    to the dashboard and the issues list.
// =====================================================
(function () {
    // Data that belongs to one medical issue.
    // Add a key here if a new feature should be kept per issue.
    const PER_ISSUE_KEYS = [
        'neutrixReport',
        'neutrixPlan',
        'neutrixCheckups',
        'neutrixSchedule',
        'neutrixChat',
        'neutrixFollowups',
        'neutrix_meds'
    ];
    const ACTIVE_KEY = 'neutrixActiveIssue';

    const proto = Storage.prototype;
    const rawGet = proto.getItem;
    const rawSet = proto.setItem;
    const rawRemove = proto.removeItem;

    // ---------- 1. Login + issue checks ----------
    if (rawGet.call(localStorage, 'neutrix_authenticated') !== 'true') {
        location.replace('signin.html');
        return;
    }

    let issues = [];
    try { issues = JSON.parse(rawGet.call(localStorage, 'neutrixIssues') || '[]'); } catch (e) {}

    const fromUrl = new URLSearchParams(location.search).get('issue');
    if (fromUrl && issues.some(i => i.id === fromUrl)) {
        rawSet.call(localStorage, ACTIVE_KEY, fromUrl);
    }

    const activeId = rawGet.call(localStorage, ACTIVE_KEY);
    const issue = issues.find(i => i.id === activeId);
    if (!issue) {
        location.replace('issues.html');
        return;
    }

    // ---------- 2. Per-issue storage ----------
    function scoped(store, key) {
        return store === localStorage && PER_ISSUE_KEYS.includes(key) ? `${key}::${activeId}` : key;
    }
    proto.getItem = function (key) { return rawGet.call(this, scoped(this, key)); };
    proto.setItem = function (key, value) { return rawSet.call(this, scoped(this, key), value); };
    proto.removeItem = function (key) { return rawRemove.call(this, scoped(this, key)); };

    window.neutrixActiveIssue = issue;

    // ---------- 3. Issue bar ----------
    const LABELS = {
        English: { current: 'Medical issue', dash: '⚡ Dashboard', list: '🗂 My Issues' },
        Malayalam: { current: 'ആരോഗ്യ പ്രശ്നം', dash: '⚡ ഡാഷ്ബോർഡ്', list: '🗂 എന്റെ പ്രശ്നങ്ങൾ' }
    };
    const isDashboard = /(^|\/)(index\.html)?$/.test(location.pathname);

    function lang() {
        return rawGet.call(localStorage, 'neutrixLang') === 'Malayalam' ? 'Malayalam' : 'English';
    }

    function updateBarText() {
        const bar = document.getElementById('nxIssueBar');
        if (!bar) return;
        const L = LABELS[lang()];
        bar.querySelector('.nx-ib-label').textContent = L.current;
        const dash = bar.querySelector('.nx-ib-dash');
        if (dash) dash.textContent = L.dash;
        bar.querySelector('.nx-ib-list').textContent = L.list;
    }

    function buildBar() {
        if (document.getElementById('nxIssueBar')) return;

        const style = document.createElement('style');
        style.textContent = `
            #nxIssueBar { background: #ffffff; color: #191919; border-bottom: 1px solid #e5e3df;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; }
            [data-theme="dark"] #nxIssueBar { background: #111111; color: #ffffff; border-bottom-color: #262626; }
            #nxIssueBar .nx-ib-inner { max-width: 1300px; margin: 0 auto; padding: 8px 32px;
                display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
            #nxIssueBar .nx-ib-issue { display: flex; align-items: center; gap: 8px; min-width: 0; }
            #nxIssueBar .nx-ib-label { color: #999690; text-transform: uppercase; letter-spacing: 2px; font-size: 10.5px; font-weight: 800; }
            #nxIssueBar .nx-ib-title { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50vw; }
            #nxIssueBar .nx-ib-links { display: flex; gap: 8px; }
            #nxIssueBar a { color: inherit; text-decoration: none; font-weight: 600; padding: 5px 14px;
                border: 1px solid #e5e3df; border-radius: 20px; font-size: 12.5px; transition: all 0.2s ease; }
            [data-theme="dark"] #nxIssueBar a { border-color: #333333; }
            #nxIssueBar a:hover { background: #191919; color: #ffffff; border-color: #191919; }
            [data-theme="dark"] #nxIssueBar a:hover { background: #ffffff; color: #0c0c0c; border-color: #ffffff; }
            @media (max-width: 640px) { #nxIssueBar .nx-ib-inner { padding: 8px 16px; } }
        `;
        document.head.appendChild(style);

        const bar = document.createElement('div');
        bar.id = 'nxIssueBar';
        bar.innerHTML = `
            <div class="nx-ib-inner">
                <div class="nx-ib-issue">
                    <span class="nx-ib-label"></span>
                    <span class="nx-ib-icon"></span>
                    <span class="nx-ib-title"></span>
                </div>
                <div class="nx-ib-links">
                    ${isDashboard ? '' : '<a class="nx-ib-dash" href="index.html"></a>'}
                    <a class="nx-ib-list" href="issues.html"></a>
                </div>
            </div>`;
        bar.querySelector('.nx-ib-icon').textContent = issue.icon || '🩺';
        bar.querySelector('.nx-ib-title').textContent = issue.title;

        const navbar = document.querySelector('.ehr-navbar, .site-header');
        if (navbar) navbar.insertAdjacentElement('afterend', bar);
        else document.body.insertAdjacentElement('afterbegin', bar);

        updateBarText();
    }

    document.addEventListener('DOMContentLoaded', buildBar);
    document.addEventListener('neutrix:langchange', updateBarText);
})();
