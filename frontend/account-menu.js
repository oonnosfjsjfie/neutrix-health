// =====================================================
// account-menu.js — the account button in the top right of every page
//
// Signed out: "Sign In" button (comes back to this page afterwards).
// Signed in:  small oval profile picture (Google photo, or the first letter)
//             → menu: name + email, My Dashboard, My Patient Profile, Sign Out.
//
// Where it goes:
// - an element with id="accountSlot" if the page has one (the website), or
// - the end of the app top bar (.ehr-navbar .system-controls).
// Needs neutrix-cloud.js on the page.
// =====================================================
(function () {
    const cloud = window.NeutrixCloud;
    const isWebsite = /(^\/$|home\.html$)/.test(location.pathname);
    const herePage = (location.pathname.split('/').pop() || 'home.html') + location.search;

    const TEXT = {
        English: { signIn: 'Sign In', dashboard: '🗂 My Dashboard', profile: '🩺 My Patient Profile', admin: '🛡 Admin Access', signOut: '🚪 Sign Out', signingOut: 'Signing out…', account: 'Your account', signedIn: 'Signed in' },
        Malayalam: { signIn: 'സൈൻ ഇൻ', dashboard: '🗂 എന്റെ ഡാഷ്ബോർഡ്', profile: '🩺 എന്റെ രോഗി പ്രൊഫൈൽ', admin: '🛡 അഡ്മിൻ ആക്സസ്', signOut: '🚪 സൈൻ ഔട്ട്', signingOut: 'സൈൻ ഔട്ട് ചെയ്യുന്നു…', account: 'നിങ്ങളുടെ അക്കൗണ്ട്', signedIn: 'സൈൻ ഇൻ ചെയ്തു' }
    };
    function tx(key) {
        const lang = window.neutrixLang || (localStorage.getItem('neutrixLang') === 'Malayalam' ? 'Malayalam' : 'English');
        return (TEXT[lang] || TEXT.English)[key];
    }

    // ---------- Styles (work with both the website and app colours) ----------
    const style = document.createElement('style');
    style.textContent = `
        .nx-acct { position: relative; display: inline-flex; align-items: center; margin-left: 4px; }
        .nx-acct [hidden] { display: none !important; }
        .nx-acct-signin {
            display: inline-flex; align-items: center; padding: 9px 20px; border-radius: 30px; white-space: nowrap;
            border: 1px solid var(--border-color, #e5e3df); color: var(--text-primary, #191919); background: transparent;
            font-size: 13.5px; font-weight: 600; text-decoration: none; transition: all 0.2s ease;
        }
        .nx-acct-signin:hover { border-color: var(--text-primary, #191919); transform: translateY(-1px); }
        .nx-acct-avatar {
            width: 40px; height: 40px; padding: 0; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
            background:
                linear-gradient(var(--bg-card, var(--card-bg, #fff)), var(--bg-card, var(--card-bg, #fff))) padding-box,
                linear-gradient(135deg, #ff007a, #a855f7, #3b82f6, #00f2fe) border-box;
            display: flex; align-items: center; justify-content: center; overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease; flex-shrink: 0;
        }
        .nx-acct-avatar:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(168, 85, 247, 0.35); }
        .nx-acct-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
        .nx-acct-avatar span { font-weight: 800; font-size: 15px; color: var(--text-primary, #191919); text-transform: uppercase; }
        .nx-acct-menu {
            position: absolute; top: calc(100% + 10px); right: 0; min-width: 240px; z-index: 3000; padding: 8px;
            background: var(--bg-card, var(--card-bg, #fff)); border: 1px solid var(--border-color, #e5e3df);
            border-radius: 16px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18); text-align: left;
            animation: nxAcctIn 0.18s ease both;
        }
        @keyframes nxAcctIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .nx-acct-head { padding: 10px 12px 12px; border-bottom: 1px solid var(--border-color, #e5e3df); margin-bottom: 6px; }
        .nx-acct-name { font-weight: 700; font-size: 14px; color: var(--text-primary, #191919); }
        .nx-acct-email { font-size: 12px; color: var(--text-secondary, #666); word-break: break-all; margin-top: 2px; }
        .nx-acct-item {
            display: block; width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; border: none;
            background: none; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--text-primary, #191919);
            text-decoration: none; cursor: pointer; box-sizing: border-box;
        }
        .nx-acct-item:hover { background: rgba(127, 127, 127, 0.12); }
        .nx-acct-item.danger { color: #dc2626; }
        .nx-acct-item.admin { color: #7c3aed; }
        [data-theme="dark"] .nx-acct-item.admin { color: #c4b5fd; }
        [data-theme="dark"] .nx-acct-item.danger { color: #f87171; }
        .nx-acct-item:disabled { opacity: 0.7; cursor: wait; }
        @media (max-width: 640px) { .nx-acct-menu { right: -8px; } }
    `;
    document.head.appendChild(style);

    // ---------- Build ----------
    function build() {
        let slot = document.getElementById('accountSlot');
        if (!slot) {
            const controls = document.querySelector('.ehr-navbar .system-controls');
            if (!controls) return null;
            slot = document.createElement('div');
            slot.id = 'accountSlot';
            controls.appendChild(slot);
        }
        slot.classList.add('nx-acct');
        slot.innerHTML = `
            <a class="nx-acct-signin" data-a="signin"></a>
            <div data-a="profile" hidden style="position:relative">
                <button type="button" class="nx-acct-avatar" data-a="avatar" aria-haspopup="true" aria-expanded="false">
                    <img data-a="img" alt="" referrerpolicy="no-referrer" hidden>
                    <span data-a="initial"></span>
                </button>
                <div class="nx-acct-menu" data-a="menu" hidden>
                    <div class="nx-acct-head">
                        <div class="nx-acct-name" data-a="name"></div>
                        <div class="nx-acct-email" data-a="email"></div>
                    </div>
                    <a class="nx-acct-item" data-a="dash" href="issues.html"></a>
                    <a class="nx-acct-item" data-a="prof"></a>
                    <a class="nx-acct-item admin" data-a="admin" href="admin.html" hidden></a>
                    <button type="button" class="nx-acct-item danger" data-a="out"></button>
                </div>
            </div>`;
        const el = {};
        slot.querySelectorAll('[data-a]').forEach(n => { el[n.dataset.a] = n; });
        el.slot = slot;
        el.signin.href = 'signin.html?next=' + encodeURIComponent(herePage);
        el.prof.href = 'profile.html?back=' + encodeURIComponent(herePage);
        if (isWebsite) { el.dash.target = '_blank'; el.dash.rel = 'noopener'; }
        return el;
    }

    const el = build();
    if (!el) return;
    let profile = null;

    function texts() {
        el.signin.textContent = tx('signIn');
        el.dash.textContent = tx('dashboard');
        el.prof.textContent = tx('profile');
        el.admin.textContent = tx('admin');
        el.admin.hidden = !(profile && profile.admin);
        if (!el.out.disabled) el.out.textContent = tx('signOut');
        el.avatar.title = (profile && (profile.name || profile.email)) || tx('account');
        el.name.textContent = (profile && profile.name) || tx('signedIn');
    }

    function showSignedOut() {
        profile = null;
        el.profile.hidden = true;
        el.menu.hidden = true;
        el.signin.hidden = false;
        texts();
    }

    function showSignedIn(p, user) {
        profile = Object.assign({}, p || {});
        profile.admin = cloud && cloud.isAdmin
            ? (user ? cloud.isAdmin(user) : cloud.isAdminEmail(profile.email))
            : false;
        const label = profile.name || profile.email || '';
        el.email.textContent = profile.email || '';
        el.initial.textContent = label.trim().charAt(0) || '🙂';
        if (profile.photo) {
            el.img.src = profile.photo;
            el.img.hidden = false;
            el.initial.hidden = true;
        } else {
            el.img.hidden = true;
            el.initial.hidden = false;
        }
        el.signin.hidden = true;
        el.profile.hidden = false;
        texts();
    }

    el.img.addEventListener('error', () => { el.img.hidden = true; el.initial.hidden = false; });

    // 1. Quick guess from this device (no flicker)
    const signedInHere = localStorage.getItem('neutrix_authenticated') === 'true';
    const cached = cloud && cloud.cachedProfile ? cloud.cachedProfile() : null;
    if (signedInHere) showSignedIn(cached || { name: localStorage.getItem('neutrix_patient_name') || '' });
    else showSignedOut();

    // 2. Confirm with Firebase
    if (cloud && cloud.configured) {
        cloud.currentUser().then(user => {
            if (user && localStorage.getItem('neutrix_authenticated') === 'true') {
                cloud.saveProfile(user);
                showSignedIn(cloud.cachedProfile(), user);
                if (cloud.syncContact) cloud.syncContact(user).catch(() => {});
            } else if (isWebsite) {
                localStorage.removeItem('neutrix_authenticated');
                showSignedOut();
            }
        }).catch(() => {});
    }

    // ---------- Menu ----------
    function closeMenu() {
        el.menu.hidden = true;
        el.avatar.setAttribute('aria-expanded', 'false');
    }
    el.avatar.addEventListener('click', e => {
        e.stopPropagation();
        el.menu.hidden = !el.menu.hidden;
        el.avatar.setAttribute('aria-expanded', String(!el.menu.hidden));
    });
    document.addEventListener('click', e => { if (!el.menu.hidden && !el.profile.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

    // ---------- Sign out ----------
    const outBtn = el.out;   // keep a reference: e.currentTarget is empty after an "await"
    outBtn.addEventListener('click', async () => {
        outBtn.disabled = true;
        outBtn.textContent = tx('signingOut');
        try {
            if (cloud && cloud.configured) await cloud.signOut();
            else {
                localStorage.removeItem('neutrix_authenticated');
                localStorage.removeItem('neutrixActiveIssue');
            }
        } catch (err) {
            console.warn('[account] sign out problem', err);
            localStorage.removeItem('neutrix_authenticated');
        }
        outBtn.disabled = false;
        if (isWebsite) {
            showSignedOut();
        } else {
            window.location.href = 'home.html';   // back to the website, signed out
        }
    });

    document.addEventListener('neutrix:langchange', texts);
})();
