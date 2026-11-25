// =====================================================
// Sign In / Sign Up with Firebase (email + password, or Google).
// After signing in, the user's saved data is downloaded to this device
// (neutrix-cloud.js), so it works the same on any phone or computer.
// =====================================================
const $ = id => document.getElementById(id);
const feedback = $('loginFeedback');
let mode = 'signin';

function show(kind, text) {
    feedback.innerHTML = '';
    if (!text) return;
    const div = document.createElement('div');
    div.className = kind === 'ok' ? 'alert-success' : kind === 'info' ? 'alert-info' : 'alert-danger';
    div.textContent = text;
    feedback.appendChild(div);
}

function busy(on) {
    ['signInBtn', 'signUpBtn', 'googleBtn'].forEach(id => { $(id).disabled = on; });
}

function setMode(next) {
    mode = next;
    const up = mode === 'signup';
    $('tabSignIn').classList.toggle('active', !up);
    $('tabSignUp').classList.toggle('active', up);
    $('signInForm').classList.toggle('hidden', up);
    $('signUpForm').classList.toggle('hidden', !up);
    $('authTitle').textContent = up ? 'Create your account' : 'Welcome back';
    $('authSub').textContent = up
        ? 'Sign up once and use Neutrix on any phone or computer.'
        : 'Sign in to see your recovery dashboard on any device.';
    $('googleText').textContent = up ? 'Sign up with Google' : 'Continue with Google';
    show();
}
$('tabSignIn').addEventListener('click', () => setMode('signin'));
$('tabSignUp').addEventListener('click', () => setMode('signup'));

const OFFLINE_SIGNIN = 'You\'re offline. Connect to the internet to sign in. After that, Neutrix also works without internet.';

// Firebase error codes → plain words
function friendly(err) {
    const code = (err && err.code) || '';
    const map = {
        'auth/email-already-in-use': 'An account with this email already exists. Use Sign In instead.',
        'auth/invalid-email': 'That email address does not look right.',
        'auth/weak-password': 'Please use a password with at least 6 characters.',
        'auth/invalid-credential': 'Wrong email or password. Try again, or use "Forgot password?".',
        'auth/wrong-password': 'Wrong email or password. Try again, or use "Forgot password?".',
        'auth/user-not-found': 'No account with this email. Use Sign Up to create one.',
        'auth/too-many-requests': 'Too many tries. Please wait a few minutes and try again.',
        'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
        'auth/cancelled-popup-request': 'The Google window was closed before finishing.',
        'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
        'auth/unauthorized-domain': 'This website address is not allowed in Firebase yet (Authentication → Settings → Authorized domains).',
        'auth/operation-not-allowed': 'This sign-in method is not turned on in Firebase yet.',
        'auth/network-request-failed': 'No internet connection. Check your connection and try again.',
        'neutrix/google-not-ready': 'Google sign-in in the app is still being set up. For now, use email and password (on the website you can set one with "Forgot password?").',
        'neutrix/cancelled': 'Google sign-in was cancelled.',
        'auth/account-exists-with-different-credential': 'This email is already registered with another sign-in method. Try email and password.'
    };
    return map[code] || (err && err.message) || 'Something went wrong. Please try again.';
}

// After signing in, go back to the page that sent them here (default: the website)
function goNext() {
    const next = new URLSearchParams(location.search).get('next') || '';
    // Only pages of this site, e.g. "issues.html" or "index.html?issue=..."
    const safe = /^[a-z0-9_-]+\.html(\?[^#]*)?$/i.test(next) && !/^signin\.html/i.test(next);
    window.location.replace(safe ? next : 'home.html');
}

async function finish(user, name, isNew) {
    show('info', 'Signed in. Loading your saved data…');
    await NeutrixCloud.afterSignIn(user, name);
    show('ok', '✓ Welcome! Opening your workspace…');
    // New account (or no patient profile yet): fill in the patient profile first, then the dashboard
    const needsProfile = isNew || !localStorage.getItem('neutrix_hospital_profile');
    setTimeout(() => {
        if (needsProfile) window.location.replace('profile.html?back=issues.html');
        else goNext();
    }, 400);
}

// ---------- Not set up yet ----------
if (!NeutrixCloud.configured) {
    busy(true);
    show('error', 'Accounts are not set up yet: add the Firebase settings to frontend/firebase-config.js.');
} else {
    // Already signed in on this device? Skip the form.
    NeutrixCloud.currentUser().then(user => {
        if (user && localStorage.getItem('neutrix_authenticated') === 'true') {
            if (!localStorage.getItem('neutrix_hospital_profile')) window.location.replace('profile.html?back=issues.html');
            else goNext();
        }
    }).catch(err => show('error', 'Could not reach the sign-in service: ' + err.message));
}

// ---------- Email + password ----------
$('signInForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (navigator.onLine === false) { show('error', OFFLINE_SIGNIN); return; }
    busy(true);
    show();
    try {
        const { auth } = await NeutrixCloud.init();
        const cred = await auth.signInWithEmailAndPassword($('siEmail').value.trim(), $('siPassword').value);
        await finish(cred.user);
    } catch (err) {
        show('error', friendly(err));
        busy(false);
    }
});

$('signUpForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('suName').value.trim();
    const password = $('suPassword').value;
    if (password !== $('suConfirm').value) {
        show('error', 'The two passwords do not match.');
        return;
    }
    if (navigator.onLine === false) { show('error', OFFLINE_SIGNIN); return; }
    busy(true);
    show();
    try {
        const { auth } = await NeutrixCloud.init();
        const cred = await auth.createUserWithEmailAndPassword($('suEmail').value.trim(), password);
        if (name) await cred.user.updateProfile({ displayName: name });
        await finish(cred.user, name, true);
    } catch (err) {
        show('error', friendly(err));
        busy(false);
    }
});

$('forgotBtn').addEventListener('click', async () => {
    const email = $('siEmail').value.trim();
    if (!email) {
        show('error', 'Type your email address above first, then click "Forgot password?".');
        $('siEmail').focus();
        return;
    }
    try {
        const { auth } = await NeutrixCloud.init();
        await auth.sendPasswordResetEmail(email);
        show('ok', `If an account exists for ${email}, a password reset link has been sent. Check your inbox and spam folder.`);
    } catch (err) {
        show('error', friendly(err));
    }
});

// ---------- Google ----------
$('googleBtn').addEventListener('click', async () => {
    busy(true);
    show();
    try {
        if (navigator.onLine === false) { show('error', OFFLINE_SIGNIN); busy(false); return; }
        const { auth } = await NeutrixCloud.init();
        let cred;
        if (window.NxNative && NxNative.isApp) {
            // Inside the Android app Google blocks its web sign-in window, so the phone's own Google sign-in is used
            const idToken = await NxNative.googleIdToken();
            cred = await auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken));
        } else {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            cred = await auth.signInWithPopup(provider);
        }
        const isNew = !!(cred.additionalUserInfo && cred.additionalUserInfo.isNewUser);
        await finish(cred.user, cred.user.displayName, isNew);
    } catch (err) {
        show('error', friendly(err));
        busy(false);
    }
});
