// =====================================================
// feedback.js — "⚑ Report" button on every page (not the Admin page)
// and a one-time, skippable rating pop-up on the website.
// Saved to Firestore "feedback" (anyone can send; only admins can read: see firestore.rules).
// Needs firebase-config.js + neutrix-cloud.js on the page.
// =====================================================
(function () {
    if (/admin\.html$/.test(location.pathname)) return;
    const cloud = window.NeutrixCloud;
    const page = (location.pathname.split('/').pop() || 'home.html');
    const isWebsite = /^(home\.html)?$/.test(page);

    const TEXT = {
        English: {
            report: '⚑ Report', reportTitle: 'Report a problem', reportSub: 'Something wrong or confusing on this page? Tell us. Your message goes to the Neutrix team.',
            issuesLabel: 'Any issues', issuesPh: 'Describe the problem (what you clicked, what you expected)…',
            send: 'Send', cancel: 'Cancel', sending: 'Sending…', thanks: '✓ Thank you! The Neutrix team will look at it.',
            empty: 'Please write a short message first.', failed: 'Could not send. Check your internet and try again.',
            rateTitle: 'How is Neutrix so far?', rateSub: 'Rate your experience. This is optional and takes 5 seconds.',
            skip: 'Skip', submit: 'Submit', pickStars: 'Tap a star to rate, or skip.', stars: ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'],
            optional: '(optional)'
        },
        Malayalam: {
            report: '⚑ റിപ്പോർട്ട്', reportTitle: 'ഒരു പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക', reportSub: 'ഈ പേജിൽ എന്തെങ്കിലും പ്രശ്നമുണ്ടോ? ഞങ്ങളോട് പറയൂ. നിങ്ങളുടെ സന്ദേശം ന്യൂട്രിക്സ് ടീമിന് ലഭിക്കും.',
            issuesLabel: 'എന്തെങ്കിലും പ്രശ്നങ്ങൾ', issuesPh: 'പ്രശ്നം വിവരിക്കുക (എന്ത് ക്ലിക്ക് ചെയ്തു, എന്ത് പ്രതീക്ഷിച്ചു)…',
            send: 'അയക്കുക', cancel: 'റദ്ദാക്കുക', sending: 'അയക്കുന്നു…', thanks: '✓ നന്ദി! ന്യൂട്രിക്സ് ടീം ഇത് പരിശോധിക്കും.',
            empty: 'ദയവായി ആദ്യം ഒരു ചെറിയ സന്ദേശം എഴുതുക.', failed: 'അയക്കാൻ കഴിഞ്ഞില്ല. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
            rateTitle: 'ന്യൂട്രിക്സ് എങ്ങനെയുണ്ട്?', rateSub: 'നിങ്ങളുടെ അനുഭവം റേറ്റ് ചെയ്യുക. ഇത് ഓപ്ഷണൽ ആണ്.',
            skip: 'ഒഴിവാക്കുക', submit: 'സമർപ്പിക്കുക', pickStars: 'റേറ്റ് ചെയ്യാൻ ഒരു നക്ഷത്രം തൊടുക, അല്ലെങ്കിൽ ഒഴിവാക്കുക.',
            stars: ['വളരെ മോശം', 'മോശം', 'കുഴപ്പമില്ല', 'നല്ലത്', 'മികച്ചത്'], optional: '(ഓപ്ഷണൽ)'
        }
    };
    const lang = () => window.neutrixLang || (function () { try { return localStorage.getItem('neutrixLang'); } catch (e) { return null; } })() || 'English';
    const tx = k => (TEXT[lang()] || TEXT.English)[k] ?? TEXT.English[k];
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };

    // ---------- Styles ----------
    const css = document.createElement('style');
    css.textContent = `
        .nx-fb-btn { display: inline-flex; align-items: center; gap: 4px; padding: 8px 14px; border-radius: 30px; cursor: pointer; white-space: nowrap;
            border: 1px solid var(--border-color, #e5e3df); background: transparent; color: var(--text-primary, #191919);
            font: inherit; font-size: 13px; font-weight: 600; transition: all 0.2s ease; }
        .nx-fb-btn { border-color: rgba(245, 158, 11, 0.6); color: #b45309; background: rgba(245, 158, 11, 0.08); }
        [data-theme="dark"] .nx-fb-btn { color: #fbbf24; background: rgba(245, 158, 11, 0.12); }
        .nx-fb-btn:hover { border-color: #f59e0b; background: rgba(245, 158, 11, 0.18); transform: translateY(-1px); }
        .nx-fb-btn .ic { font-size: 14px; }
        @media (max-width: 900px) {
            .nx-fb-btn { padding: 7px 10px; }
            .nx-fb-btn .lbl { display: none; }
        }
        .nx-fb-btn.floating { position: fixed; left: 16px; bottom: 18px; z-index: 2500; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); background: var(--card-bg, #fff); }
        .nx-fb-btn.floating .lbl { display: inline; }
        .nx-fb-modal { position: fixed; inset: 0; z-index: 6000; display: flex; align-items: center; justify-content: center; padding: 16px;
            background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(3px); animation: nxFbIn 0.2s ease both; }
        @keyframes nxFbIn { from { opacity: 0; } to { opacity: 1; } }
        .nx-fb-box { width: min(460px, 100%); border-radius: 20px; padding: 22px; background: var(--card-bg, var(--bg-card, #fff));
            color: var(--text-primary, #191919); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35); font-family: inherit; position: relative; }
        .nx-fb-box h3 { margin: 0 0 6px; font-size: 19px; }
        .nx-fb-box p { margin: 0 0 14px; font-size: 13.5px; color: var(--text-secondary, #666); line-height: 1.5; }
        .nx-fb-box label { display: block; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-muted, #999); margin: 10px 0 6px; }
        .nx-fb-box textarea { width: 100%; box-sizing: border-box; min-height: 96px; resize: vertical; padding: 12px 14px; border-radius: 12px;
            border: 1px solid var(--border-color, #e5e3df); background: var(--input-bg, transparent); color: inherit; font: inherit; font-size: 14px; }
        .nx-fb-box textarea:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15); }
        .nx-fb-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
        .nx-fb-btns button { padding: 10px 20px; border-radius: 30px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
            border: 1px solid var(--border-color, #e5e3df); background: transparent; color: inherit; }
        .nx-fb-btns button.main { background: var(--text-primary, #191919); color: var(--card-bg, #fff); border-color: var(--text-primary, #191919); }
        .nx-fb-btns button:disabled { opacity: 0.5; cursor: wait; }
        .nx-fb-msg { font-size: 13px; font-weight: 600; min-height: 18px; margin-top: 8px; }
        .nx-fb-msg.ok { color: #16a34a; } .nx-fb-msg.err { color: #dc2626; }
        .nx-fb-stars { display: flex; gap: 6px; justify-content: center; margin: 4px 0 2px; }
        .nx-fb-star { font-size: 36px; line-height: 1; background: none; border: none; cursor: pointer; padding: 2px; color: #d1d5db; transition: transform 0.15s ease, color 0.15s ease; }
        .nx-fb-star:hover { transform: scale(1.15); }
        .nx-fb-star.on { color: #f59e0b; }
        .nx-fb-star-label { text-align: center; font-size: 13px; font-weight: 700; color: var(--text-secondary, #666); min-height: 18px; }
        .nx-fb-x { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted, #999); }
    `;
    document.head.appendChild(css);

    // ---------- Who is sending (only if signed in) ----------
    async function sender() {
        if (!cloud || !cloud.configured) throw new Error('not configured');
        const { db } = await cloud.init();
        let user = null;
        try { user = await cloud.currentUser(); } catch (e) {}
        return { db, user };
    }

    async function send(kind, rating, message) {
        const { db, user } = await sender();
        await db.collection('feedback').add({
            kind,                                    // 'rating' or 'report'
            rating: rating || 0,
            message: String(message || '').slice(0, 2000),
            page,
            uid: user ? user.uid : '',
            email: user ? (user.email || '') : '',
            name: user ? (user.displayName || '').slice(0, 100) : '',
            lang: lang() === 'Malayalam' ? 'Malayalam' : 'English',
            device: (navigator.userAgent || '').slice(0, 300),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    function modal(html) {
        const wrap = document.createElement('div');
        wrap.className = 'nx-fb-modal';
        wrap.innerHTML = `<div class="nx-fb-box" role="dialog" aria-modal="true">${html}</div>`;
        document.body.appendChild(wrap);
        const close = () => { wrap.remove(); document.removeEventListener('keydown', esc); };
        const esc = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', esc);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        return { wrap, close, $: s => wrap.querySelector(s) };
    }

    // ---------- Report button ----------
    function openReport() {
        const m = modal(`
            <button class="nx-fb-x" type="button" aria-label="${tx('cancel')}">×</button>
            <h3>${tx('reportTitle')}</h3>
            <p>${tx('reportSub')}</p>
            <label for="nxFbText">${tx('issuesLabel')}</label>
            <textarea id="nxFbText" maxlength="2000" placeholder="${tx('issuesPh')}"></textarea>
            <div class="nx-fb-msg"></div>
            <div class="nx-fb-btns">
                <button type="button" data-a="cancel">${tx('cancel')}</button>
                <button type="button" class="main" data-a="send">${tx('send')}</button>
            </div>`);
        const text = m.$('#nxFbText');
        const msg = m.$('.nx-fb-msg');
        const sendBtn = m.$('[data-a="send"]');
        m.$('[data-a="cancel"]').addEventListener('click', m.close);
        m.$('.nx-fb-x').addEventListener('click', m.close);
        text.focus();
        sendBtn.addEventListener('click', async () => {
            const value = text.value.trim();
            if (!value) { msg.className = 'nx-fb-msg err'; msg.textContent = tx('empty'); text.focus(); return; }
            sendBtn.disabled = true;
            sendBtn.textContent = tx('sending');
            try {
                await send('report', 0, value);
                msg.className = 'nx-fb-msg ok';
                msg.textContent = tx('thanks');
                setTimeout(m.close, 1400);
            } catch (e) {
                console.warn('[feedback]', e);
                msg.className = 'nx-fb-msg err';
                msg.textContent = tx('failed');
                sendBtn.disabled = false;
                sendBtn.textContent = tx('send');
            }
        });
    }

    function addReportButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nx-fb-btn';
        btn.id = 'nxReportBtn';
        const paint = () => {
            btn.innerHTML = `<span class="ic">⚑</span><span class="lbl">${tx('report').replace(/^⚑\s*/, '')}</span>`;
            btn.title = tx('reportTitle');
            btn.setAttribute('aria-label', tx('reportTitle'));
        };
        paint();
        btn.addEventListener('click', openReport);
        document.addEventListener('neutrix:langchange', paint);
        const slot = document.getElementById('accountSlot');
        const controls = document.querySelector('.ehr-navbar .system-controls') || document.querySelector('.px-nav .nav-right');
        if (slot && slot.parentNode) slot.parentNode.insertBefore(btn, slot);
        else if (controls) controls.appendChild(btn);
        else { btn.classList.add('floating'); document.body.appendChild(btn); }   // pages without a top bar

        // If the top bar has no room (small screens), keep the button on screen at the bottom left
        const home = btn.parentNode;          // where it sits in the top bar
        const anchor = btn.nextSibling;
        const fit = () => {
            if (!(slot || controls)) return;
            // put it back in the top bar and measure
            btn.classList.remove('floating');
            if (btn.parentNode !== home) home.insertBefore(btn, anchor && anchor.parentNode === home ? anchor : null);
            const r = btn.getBoundingClientRect();
            if (r.width === 0 || r.right > innerWidth + 1 || r.left < 0) {
                btn.classList.add('floating');
                document.body.appendChild(btn);   // out of the top bar, so it really sits at the screen corner
            }
        };
        fit();
        window.addEventListener('resize', fit);
        setTimeout(fit, 1500);   // after the account button has loaded
    }

    // ---------- Rating pop-up (website only, skippable; comes back every 8 days) ----------
    const ASKED = 'nxFeedbackAsked';
    const EVERY_DAYS = 8;
    function dueForRating() {
        const last = Date.parse(store.get(ASKED) || '');
        return !last || Date.now() - last >= EVERY_DAYS * 86400000;
    }
    function openRating() {
        if (document.querySelector('.nx-fb-modal')) return;   // something else is open
        store.set(ASKED, new Date().toISOString());
        let rating = 0;
        const m = modal(`
            <button class="nx-fb-x" type="button" aria-label="${tx('skip')}">×</button>
            <h3>${tx('rateTitle')}</h3>
            <p>${tx('rateSub')}</p>
            <div class="nx-fb-stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="nx-fb-star" data-n="${n}" aria-label="${n}">★</button>`).join('')}</div>
            <div class="nx-fb-star-label">${tx('pickStars')}</div>
            <label for="nxFbText">${tx('issuesLabel')} <span style="text-transform:none;letter-spacing:0">${tx('optional')}</span></label>
            <textarea id="nxFbText" maxlength="2000" placeholder="${tx('issuesPh')}"></textarea>
            <div class="nx-fb-msg"></div>
            <div class="nx-fb-btns">
                <button type="button" data-a="skip">${tx('skip')}</button>
                <button type="button" class="main" data-a="send" disabled>${tx('submit')}</button>
            </div>`);
        const stars = [...m.wrap.querySelectorAll('.nx-fb-star')];
        const label = m.$('.nx-fb-star-label');
        const sendBtn = m.$('[data-a="send"]');
        const text = m.$('#nxFbText');
        const msg = m.$('.nx-fb-msg');
        const paint = n => stars.forEach(s => s.classList.toggle('on', Number(s.dataset.n) <= n));
        stars.forEach(s => {
            s.addEventListener('mouseenter', () => paint(Number(s.dataset.n)));
            s.addEventListener('mouseleave', () => paint(rating));
            s.addEventListener('click', () => {
                rating = Number(s.dataset.n);
                paint(rating);
                label.textContent = tx('stars')[rating - 1];
                sendBtn.disabled = false;
            });
        });
        text.addEventListener('input', () => { sendBtn.disabled = !rating && !text.value.trim(); });
        m.$('[data-a="skip"]').addEventListener('click', m.close);
        m.$('.nx-fb-x').addEventListener('click', m.close);
        sendBtn.addEventListener('click', async () => {
            sendBtn.disabled = true;
            sendBtn.textContent = tx('sending');
            try {
                await send('rating', rating, text.value.trim());
                store.set('nxFeedbackRated', String(rating));
                msg.className = 'nx-fb-msg ok';
                msg.textContent = tx('thanks');
                setTimeout(m.close, 1400);
            } catch (e) {
                console.warn('[feedback]', e);
                msg.className = 'nx-fb-msg err';
                msg.textContent = tx('failed');
                sendBtn.disabled = false;
                sendBtn.textContent = tx('submit');
            }
        });
    }

    function scheduleRating() {
        if (!isWebsite || !dueForRating()) return;
        let shown = false;
        const show = () => {
            if (shown) return;
            shown = true;
            window.removeEventListener('scroll', onScroll);
            openRating();
        };
        // After 25 seconds on the website, or once they have scrolled through most of it
        const timer = setTimeout(show, 25000);
        const onScroll = () => {
            const max = document.documentElement.scrollHeight - innerHeight;
            if (max > 0 && scrollY / max > 0.7) { clearTimeout(timer); setTimeout(show, 800); }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    function start() {
        addReportButton();
        scheduleRating();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    window.NxFeedback = { openReport, openRating, send };
})();
