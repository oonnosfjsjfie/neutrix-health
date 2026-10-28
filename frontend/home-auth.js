// =====================================================
// Website header account button (home.html)
// Signed out: "Sign In" (comes back here afterwards).
// Signed in: small oval profile picture (Google photo, or the first letter of the name)
//            with a menu: name, email, My Dashboard, Sign Out.
// =====================================================
(function () {
    const signInBtn = document.getElementById('navSignIn');
    const profile = document.getElementById('navProfile');
    const avatarBtn = document.getElementById('navAvatar');
    const img = document.getElementById('navAvatarImg');
    const initial = document.getElementById('navAvatarInitial');
    const menu = document.getElementById('navMenu');
    if (!signInBtn || !profile) return;

    function showSignedOut() {
        profile.hidden = true;
        menu.hidden = true;
        signInBtn.hidden = false;
    }

    function showSignedIn(p) {
        const name = (p && (p.name || p.email)) || 'You';
        document.getElementById('navMenuName').textContent = (p && p.name) || 'Signed in';
        document.getElementById('navMenuEmail').textContent = (p && p.email) || '';
        avatarBtn.title = name;
        initial.textContent = name.trim().charAt(0) || '🙂';
        if (p && p.photo) {
            img.src = p.photo;
            img.hidden = false;
            initial.hidden = true;
        } else {
            img.hidden = true;
            initial.hidden = false;
        }
        signInBtn.hidden = true;
        profile.hidden = false;
    }

    // If the photo cannot load, show the first letter instead
    img.addEventListener('error', () => { img.hidden = true; initial.hidden = false; });

    // 1. Quick guess from this device (no flicker)
    const cloud = window.NeutrixCloud;
    const signedInHere = localStorage.getItem('neutrix_authenticated') === 'true';
    if (signedInHere && cloud && cloud.cachedProfile()) showSignedIn(cloud.cachedProfile());
    else showSignedOut();

    // 2. Confirm with Firebase
    if (cloud && cloud.configured) {
        cloud.currentUser().then(user => {
            if (user && localStorage.getItem('neutrix_authenticated') === 'true') {
                cloud.saveProfile(user);
                showSignedIn(cloud.cachedProfile());
            } else {
                localStorage.removeItem('neutrix_authenticated');
                showSignedOut();
            }
        }).catch(() => {});
    }

    // Menu open / close
    avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        avatarBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', (e) => {
        if (!menu.hidden && !profile.contains(e.target)) {
            menu.hidden = true;
            avatarBtn.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });

    // Sign out and stay on the website
    document.getElementById('navSignOut').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'Signing out…';
        if (cloud && cloud.configured) await cloud.signOut();
        else localStorage.removeItem('neutrix_authenticated');
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = '🚪 Sign Out';
        showSignedOut();
    });
})();
