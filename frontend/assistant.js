// =====================================================
// Neutrix Assistant — a talking helper on every page (button at the top right).
//
// - Talk by voice (mic) or type. It answers out loud and on screen, in simple words;
//   ask "explain in detail" (or turn on "Detailed") for a full explanation.
// - It can use the website for you: a pointer moves on the screen and clicks, types,
//   scrolls and opens pages, step by step. Made for people who find the mouse,
//   keyboard or small text hard. Casual chat works too.
// - No pop-ups: it sits in a panel at the bottom (right side on computers) and the page
//   stays usable. It keeps going across pages until the task is done.
// - Anything that deletes, sends or signs out is asked first ("Should I ...?").
// Backend: POST /api/assistant (backend/services/assistant.py).
// =====================================================
(function () {
    if (window.NxAssistant) return;
    // Same place as the rest of the AI (common.js): the backend on this computer when testing locally
    const API = () => (window.API_BASE || ((location.protocol === 'file:' || ['5500', '5501'].includes(location.port)) ? 'http://127.0.0.1:8000' : '')) + '/api/assistant';
    const C = window.Capacitor;
    const isApp = !!(C && C.isNativePlatform && C.isNativePlatform());
    const P = (C && C.Plugins) || {};
    const MAX_STEPS = 8;
    const PAGES = ['issues.html', 'index.html', 'summary.html', 'report.html', 'medplan.html', 'schedule.html', 'checkups.html',
        'improvements.html', 'exercise.html', 'tracking.html', 'briefing.html', 'progress.html', 'profile.html', 'home.html',
        'signin.html', 'get-app.html'];
    const RISKY = /\b(delete|remove|erase|sign ?out|log ?out|send|submit|reset|clear all|deactivate|ഇല്ലാതാക്കുക|അയയ്ക്കുക)\b/i;

    // ---------- words on screen ----------
    const T = {
        English: {
            btn: 'Assistant', open: 'Open Neutrix Assistant', title: 'Neutrix Assistant', close: 'Close assistant',
            hello: "Hi! I'm your Neutrix Assistant. Talk to me or type. I can explain things simply, or do things on this website for you, like “open my medicine schedule”.",
            placeholder: 'Type or tap the mic…', send: 'Send', expand: 'Show the conversation', collapse: 'Hide the conversation', mic: 'Turn the mic on', stopMic: 'Mic is on: tap to mute', micOn: 'Mic on. I will keep listening until you tap the mic again.', micOff: 'Mic off.',
            listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', working: 'Working on the page…', ready: 'Ready',
            detail: 'Detailed', voice: 'Voice', yes: 'Yes, do it', no: 'No', stop: 'Stop',
            stopped: 'Okay, I stopped.', cancelled: "Okay, I won't do that.", noMic: "Your browser can't use the microphone here. Please type instead.",
            micDenied: 'Microphone permission is off. Allow it, or type instead.', offline: "You're offline. I need the internet to answer.",
            error: "Sorry, I couldn't reach the assistant. Please try again.", tooMany: 'I stopped after several steps. Tell me what to do next.',
            chips: ['What can you do?', 'Open my medicine schedule', 'Read this page to me', 'Make the text bigger']
        },
        Malayalam: {
            btn: 'അസിസ്റ്റന്റ്', open: 'Neutrix അസിസ്റ്റന്റ് തുറക്കുക', title: 'Neutrix അസിസ്റ്റന്റ്', close: 'അടയ്ക്കുക',
            hello: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ Neutrix അസിസ്റ്റന്റ് ആണ്. സംസാരിക്കുകയോ ടൈപ്പ് ചെയ്യുകയോ ചെയ്യാം. ലളിതമായി വിശദീകരിക്കാം, അല്ലെങ്കിൽ ഈ വെബ്സൈറ്റിൽ കാര്യങ്ങൾ ചെയ്തു തരാം.',
            placeholder: 'ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ മൈക്ക് അമർത്തുക…', send: 'അയയ്ക്കുക', expand: 'സംഭാഷണം കാണിക്കുക', collapse: 'സംഭാഷണം മറയ്ക്കുക', mic: 'മൈക്ക് ഓണാക്കുക', stopMic: 'മൈക്ക് ഓണാണ്: ഓഫാക്കാൻ അമർത്തുക', micOn: 'മൈക്ക് ഓൺ.', micOff: 'മൈക്ക് ഓഫ്.',
            listening: 'കേൾക്കുന്നു…', thinking: 'ആലോചിക്കുന്നു…', speaking: 'സംസാരിക്കുന്നു…', working: 'പേജിൽ ചെയ്യുന്നു…', ready: 'തയ്യാർ',
            detail: 'വിശദമായി', voice: 'ശബ്ദം', yes: 'അതെ, ചെയ്യൂ', no: 'വേണ്ട', stop: 'നിർത്തുക',
            stopped: 'ശരി, നിർത്തി.', cancelled: 'ശരി, അത് ചെയ്യുന്നില്ല.', noMic: 'ഇവിടെ മൈക്ക് ഉപയോഗിക്കാൻ കഴിയില്ല. ടൈപ്പ് ചെയ്യുക.',
            micDenied: 'മൈക്ക് അനുമതി ഓഫാണ്.', offline: 'ഇന്റർനെറ്റ് ഇല്ല.', error: 'ക്ഷമിക്കണം, വീണ്ടും ശ്രമിക്കുക.', tooMany: 'കുറച്ച് ഘട്ടങ്ങൾക്ക് ശേഷം നിർത്തി. അടുത്തത് പറയൂ.',
            chips: ['എന്തൊക്കെ ചെയ്യാം?', 'മരുന്ന് ഷെഡ്യൂൾ തുറക്കൂ', 'ഈ പേജ് വായിച്ചു തരൂ']
        }
    };
    const lang = () => (window.neutrixLang === 'Malayalam' || localStorage.getItem('neutrixLang') === 'Malayalam') ? 'Malayalam' : 'English';
    const t = k => (T[lang()][k] !== undefined ? T[lang()][k] : T.English[k]);
    const speechLang = () => lang() === 'Malayalam' ? 'ml-IN' : 'en-IN';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ---------- saved state (this tab: conversation + unfinished task; this device: settings) ----------
    const SKEY = 'nxAssistant', PKEY = 'nxAssistantPrefs';
    const load = (store, key, def) => { try { return Object.assign(def, JSON.parse(store.getItem(key) || '{}')); } catch (e) { return def; } };
    const state = load(sessionStorage, SKEY, { open: false, history: [], pending: null, cursor: null });
    const prefs = load(localStorage, PKEY, { voice: true, detail: false, big: false, mic: false });
    const save = () => { try { sessionStorage.setItem(SKEY, JSON.stringify(state)); } catch (e) {} };
    const savePrefs = () => { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) {} };

    // ---------- styles ----------
    const css = `
    .nxa-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 30px; cursor: pointer; white-space: nowrap;
        font: 700 14px/1 inherit; border: 1.5px solid transparent; color: #fff;
        background: linear-gradient(135deg, #6d28d9, #2563eb 55%, #0891b2); box-shadow: 0 4px 14px rgba(79, 70, 229, .35); transition: transform .15s, box-shadow .15s; }
    .nxa-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79, 70, 229, .5); }
    .nxa-btn:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
    .nxa-btn svg { width: 17px; height: 17px; }
    .nxa-btn.on { box-shadow: 0 0 0 3px rgba(99, 102, 241, .35), 0 4px 14px rgba(79, 70, 229, .45); }
    .nxa-btn.mic::after { content: ''; width: 9px; height: 9px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 2px #fff; margin-left: 2px; animation: nxaBlink 1.4s infinite; }
    .nxa-btn.nxa-ab.mic::after { position: absolute; top: 3px; right: 3px; margin: 0; }
    .nxa-btn.nxa-ab { position: relative; }
    @keyframes nxaBlink { 50% { opacity: .35; } }
    .nxa-btn.floating { position: fixed; top: calc(12px + env(safe-area-inset-top)); right: 14px; z-index: 5200; }
    @media (max-width: 720px) { .nxa-btn:not(.floating):not(.nxa-ab) .nxa-lbl { display: none; } .nxa-btn:not(.floating) { padding: 8px 10px; } }
    .nx-appbar button.nxa-btn { background: linear-gradient(135deg, #6d28d9, #2563eb 55%, #0891b2); color: #fff; }
    .nxa-btn.nxa-ab { padding: 0; width: 40px; height: 40px; justify-content: center; border-radius: 50%; margin-right: 4px; }
    .nxa-btn.nxa-ab .nxa-lbl { display: none; }

    #nxa-dock { position: fixed; z-index: 5100; right: 16px; bottom: 16px; width: min(350px, calc(100vw - 32px)); max-height: min(54vh, 460px);
        display: flex; flex-direction: column; border-radius: 18px; overflow: hidden; color: var(--text-primary, #111);
        background: var(--card-bg, #fff); border: 1px solid var(--border-color, rgba(0,0,0,.12));
        box-shadow: 0 18px 50px rgba(15, 23, 42, .28); font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        transform: translateY(16px); opacity: 0; pointer-events: none; transition: transform .22s ease, opacity .22s ease; }
    #nxa-dock.show { transform: none; opacity: 1; pointer-events: auto; }
    [data-theme="dark"] #nxa-dock { background: #121418; color: #f1f5f9; border-color: #2a2f38; }
    @media (max-width: 720px) {
        #nxa-dock { left: 0; right: 0; bottom: 0; width: 100%; max-height: 40vh; border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom); }
        html.nxa-open body { padding-bottom: 76px !important; }
        html.nxa-open.nxa-exp body { padding-bottom: 40vh !important; }
    }
    html.nx-app-ui #nxa-dock { bottom: calc(64px + env(safe-area-inset-bottom)); max-height: 38vh; padding-bottom: 0; }
    html.nx-app-ui.nxa-open body { padding-bottom: 76px !important; }
    html.nx-app-ui.nxa-open.nxa-exp body { padding-bottom: 40vh !important; }
    html.nxa-open .chat-fab, html.nxa-open .chat-panel { display: none !important; }

    /* Small by default: only the type / mic bar, with a handle on top to open the conversation */
    #nxa-dock { overflow: visible; }
    #nxa-dock.collapsed .nxa-head, #nxa-dock.collapsed .nxa-log, #nxa-dock.collapsed .nxa-chips, #nxa-dock.collapsed .nxa-opts { display: none; }
    #nxa-dock.collapsed .nxa-bar { border-top: none; }
    .nxa-handle { position: absolute; left: 50%; top: -15px; transform: translateX(-50%); z-index: 2; height: 22px; min-width: 64px; padding: 0 12px;
        display: flex; align-items: center; justify-content: center; gap: 5px; border-radius: 12px; cursor: pointer;
        border: 1px solid var(--border-color, rgba(0,0,0,.14)); background: var(--card-bg, #fff); color: inherit; box-shadow: 0 -3px 10px rgba(15,23,42,.12);
        font: 700 11px/1 system-ui, sans-serif; }
    [data-theme="dark"] .nxa-handle { background: #121418; border-color: #2a2f38; }
    .nxa-handle svg { width: 16px; height: 16px; transition: transform .2s; }
    #nxa-dock:not(.collapsed) .nxa-handle svg { transform: rotate(180deg); }
    .nxa-handle:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
    .nxa-handle .dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; display: none; }
    .nxa-handle.new .dot { display: inline-block; }
    .nxa-head > *, .nxa-log { border-radius: 0; }
    .nxa-head { border-radius: 18px 18px 0 0; }
    .nxa-head { display: flex; align-items: center; gap: 8px; padding: 7px 8px 6px 12px; border-bottom: 1px solid var(--border-color, rgba(0,0,0,.08)); }
    [data-theme="dark"] .nxa-head { border-color: #2a2f38; }
    .nxa-orb { width: 26px; height: 26px; border-radius: 50%; flex: none; position: relative;
        background: radial-gradient(circle at 35% 30%, #a5b4fc, #6d28d9 45%, #0e7490); box-shadow: 0 0 0 0 rgba(99,102,241,.5); }
    .nxa-orb::after { content: ''; position: absolute; inset: 7px; border-radius: 50%; background: rgba(255,255,255,.85); transition: transform .2s; }
    #nxa-dock[data-mode="listening"] .nxa-orb { background: radial-gradient(circle at 35% 30%, #fecaca, #dc2626 50%, #7f1d1d); animation: nxaPulse 1.1s infinite; }
    #nxa-dock[data-mode="thinking"] .nxa-orb, #nxa-dock[data-mode="working"] .nxa-orb { animation: nxaSpin 1s linear infinite; }
    #nxa-dock[data-mode="thinking"] .nxa-orb::after, #nxa-dock[data-mode="working"] .nxa-orb::after { transform: scale(.5) translateX(9px); }
    #nxa-dock[data-mode="speaking"] .nxa-orb::after { animation: nxaTalk .45s ease-in-out infinite alternate; }
    @keyframes nxaPulse { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,.55); } 100% { box-shadow: 0 0 0 14px rgba(220,38,38,0); } }
    @keyframes nxaSpin { to { transform: rotate(360deg); } }
    @keyframes nxaTalk { from { transform: scale(.55); } to { transform: scale(1); } }
    .nxa-titles { flex: 1; min-width: 0; }
    .nxa-title { font-weight: 800; font-size: 14.5px; line-height: 1.2; }
    .nxa-status { font-size: 12px; line-height: 1.2; color: var(--text-muted, #64748b); }
    .nxa-icon { width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; display: grid; place-items: center;
        background: transparent; color: inherit; flex: none; }
    .nxa-icon:hover { background: rgba(127,127,127,.12); }
    .nxa-icon:focus-visible, .nxa-chip:focus-visible, .nxa-tog:focus-visible, .nxa-go:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
    .nxa-icon svg { width: 18px; height: 18px; }

    .nxa-log { flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 7px; min-height: 60px; scroll-behavior: smooth; }
    .nxa-msg { max-width: 92%; padding: 7px 11px; border-radius: 14px; font-size: 14.5px; line-height: 1.45; overflow-wrap: anywhere; }
    .nxa-msg.ai { background: rgba(99, 102, 241, .09); border-bottom-left-radius: 5px; align-self: flex-start; }
    [data-theme="dark"] .nxa-msg.ai { background: rgba(129, 140, 248, .14); }
    .nxa-msg.me { background: #111827; color: #fff; border-bottom-right-radius: 5px; align-self: flex-end; }
    [data-theme="dark"] .nxa-msg.me { background: #e2e8f0; color: #0f172a; }
    .nxa-msg.note { align-self: center; font-size: 13px; color: var(--text-muted, #64748b); background: none; padding: 2px 6px; text-align: center; }
    .nxa-msg ul { margin: 6px 0 2px 18px; padding: 0; } .nxa-msg p { margin: 0 0 6px; } .nxa-msg p:last-child { margin: 0; }
    .nxa-msg .nxa-more { margin-top: 8px; border-top: 1px dashed rgba(127,127,127,.35); padding-top: 8px; }
    .nxa-ask { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .nxa-go { border: none; border-radius: 22px; padding: 9px 16px; font: 700 14.5px/1 inherit; cursor: pointer; background: #16a34a; color: #fff; }
    .nxa-go.no { background: rgba(127,127,127,.18); color: inherit; }
    .nxa-chips { display: flex; gap: 5px; flex-wrap: wrap; padding: 0 10px 6px; }
    .nxa-chip { border: 1px solid var(--border-color, rgba(0,0,0,.14)); background: transparent; color: inherit; border-radius: 18px;
        padding: 5px 10px; font: 600 12px/1.2 inherit; cursor: pointer; }
    .nxa-chip:hover { background: rgba(99,102,241,.08); }
    .nxa-bar { display: flex; align-items: center; gap: 6px; padding: 7px 8px; border-top: 1px solid var(--border-color, rgba(0,0,0,.08)); }
    [data-theme="dark"] .nxa-bar { border-color: #2a2f38; }
    .nxa-input { flex: 1; min-width: 0; border: 1.5px solid var(--border-color, rgba(0,0,0,.15)); background: transparent; color: inherit;
        border-radius: 22px; padding: 8px 12px; font: 14.5px/1.3 inherit; outline: none; }
    .nxa-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.2); }
    .nxa-mic { width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; display: grid; place-items: center; color: #fff;
        background: linear-gradient(135deg, #6d28d9, #2563eb); flex: none; }
    .nxa-mic.live { background: #dc2626; animation: nxaPulse 1.1s infinite; }
    .nxa-mic svg { width: 19px; height: 19px; }
    .nxa-opts { display: flex; gap: 5px; padding: 0 8px 6px; flex-wrap: wrap; }
    .nxa-tog { border: 1px solid var(--border-color, rgba(0,0,0,.14)); background: transparent; color: var(--text-muted, #64748b);
        border-radius: 14px; padding: 4px 9px; font: 600 11.5px/1.2 inherit; cursor: pointer; }
    .nxa-tog[aria-pressed="true"] { background: #4f46e5; color: #fff; border-color: #4f46e5; }
    .nxa-stop { margin-left: auto; }
    #nxa-dock.big .nxa-msg { font-size: 18px; } #nxa-dock.big .nxa-input { font-size: 17px; }
    .nxa-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    #nxa-cursor { position: fixed; left: 0; top: 0; z-index: 2147483600; width: 30px; height: 30px; pointer-events: none; opacity: 0;
        transform: translate(var(--x, 50vw), var(--y, 50vh)); transition: transform .65s cubic-bezier(.4,.1,.2,1), opacity .25s;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,.35)); }
    #nxa-cursor.show { opacity: 1; }
    #nxa-cursor .tag { position: absolute; left: 24px; top: 24px; background: #4f46e5; color: #fff; font: 700 11px/1 system-ui, sans-serif;
        padding: 4px 7px; border-radius: 9px; white-space: nowrap; }
    .nxa-ripple { position: fixed; z-index: 2147483599; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; pointer-events: none;
        border: 3px solid #6366f1; animation: nxaRip .5s ease-out forwards; }
    @keyframes nxaRip { to { transform: scale(3.4); opacity: 0; } }
    .nxa-target { outline: 3px solid #6366f1 !important; outline-offset: 3px !important; border-radius: 6px; transition: outline-color .2s; }
    @media (prefers-reduced-motion: reduce) { #nxa-cursor { transition-duration: .01s; } .nxa-orb, .nxa-mic.live { animation: none !important; } }
    `;

    const ICON = {
        spark: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/><path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z" opacity=".8"/></svg>',
        mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        cursor: '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M4 2l22 12-10 2.5L11 27z" fill="#fff" stroke="#4f46e5" stroke-width="2.4" stroke-linejoin="round"/></svg>'
    };

    // ---------- build the button + panel ----------
    let btn, dock, log, input, micBtn, statusEl, live, cursor, chipsEl, askBox = null;
    function build() {
        const st = document.createElement('style');
        st.id = 'nxa-style';
        st.textContent = css;
        document.head.appendChild(st);

        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nxa-btn';
        btn.id = 'nxaButton';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', 'nxa-dock');
        btn.innerHTML = ICON.spark + '<span class="nxa-lbl"></span>';
        btn.addEventListener('click', () => (state.open ? close() : open(true)));
        placeButton();

        dock = document.createElement('section');
        dock.id = 'nxa-dock';
        dock.setAttribute('role', 'region');
        dock.dataset.mode = 'ready';
        dock.innerHTML = `
            <button type="button" class="nxa-handle" aria-expanded="false"><span class="dot"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>
            <div class="nxa-head">
                <div class="nxa-orb" aria-hidden="true"></div>
                <div class="nxa-titles"><div class="nxa-title"></div><div class="nxa-status"></div></div>
                <button type="button" class="nxa-icon nxa-close">${ICON.close}</button>
            </div>
            <div class="nxa-log" aria-live="off"></div>
            <div class="nxa-chips"></div>
            <div class="nxa-opts">
                <button type="button" class="nxa-tog" data-pref="voice"></button>
                <button type="button" class="nxa-tog" data-pref="detail"></button>
                <button type="button" class="nxa-tog" data-pref="big">A+</button>
                <button type="button" class="nxa-tog nxa-stop" hidden></button>
            </div>
            <form class="nxa-bar">
                <input class="nxa-input" type="text" autocomplete="off" enterkeyhint="send">
                <button type="button" class="nxa-mic"></button>
            </form>
            <div class="nxa-sr" aria-live="polite"></div>`;
        document.body.appendChild(dock);
        log = dock.querySelector('.nxa-log');
        input = dock.querySelector('.nxa-input');
        micBtn = dock.querySelector('.nxa-mic');
        statusEl = dock.querySelector('.nxa-status');
        live = dock.querySelector('.nxa-sr');
        chipsEl = dock.querySelector('.nxa-chips');
        dock.querySelector('.nxa-close').addEventListener('click', close);
        dock.querySelector('.nxa-handle').addEventListener('click', () => setExpanded(dock.classList.contains('collapsed')));
        dock.classList.add('collapsed');
        dock.querySelector('form').addEventListener('submit', e => {
            e.preventDefault();
            const v = input.value.trim();
            if (!v) { toggleMic(); return; }
            input.value = '';
            userSays(v);
        });
        input.addEventListener('input', paintMic);
        micBtn.addEventListener('click', () => (input.value.trim() ? dock.querySelector('form').requestSubmit() : toggleMic()));
        dock.querySelectorAll('[data-pref]').forEach(b => b.addEventListener('click', () => {
            const k = b.dataset.pref;
            prefs[k] = !prefs[k];
            savePrefs();
            if (k === 'voice' && !prefs.voice) stopSpeaking();
            paint();
        }));
        dock.querySelector('.nxa-stop').addEventListener('click', stopAll);

        cursor = document.createElement('div');
        cursor.id = 'nxa-cursor';
        cursor.innerHTML = ICON.cursor + '<span class="tag">Neutrix</span>';
        document.body.appendChild(cursor);
        if (state.cursor) setCursor(state.cursor.x, state.cursor.y, true);

        document.addEventListener('keydown', e => {
            if (e.altKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); state.open ? close() : open(true); }
            if (e.key === 'Escape' && state.open && (busy || speaking)) stopAll();
        });
        document.addEventListener('neutrix:langchange', () => { paint(); renderLog(); });
        paint();
        renderLog();
    }

    // Top right: in the website's top bar (next to the account button), in the phone app's top bar, or in the corner
    function placeButton() {
        const ab = document.querySelector('.nx-appbar .nx-ab-me');
        if (ab) { btn.classList.add('nxa-ab'); btn.classList.remove('floating'); ab.parentNode.insertBefore(btn, ab); return; }
        const slot = document.getElementById('accountSlot');
        const controls = document.querySelector('.ehr-navbar .system-controls') || document.querySelector('.px-nav .nav-right') || document.querySelector('.nav-right');
        if (slot && slot.parentNode) slot.parentNode.insertBefore(btn, slot);
        else if (controls) controls.appendChild(btn);
        else { btn.classList.add('floating'); document.body.appendChild(btn); return; }
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.right > innerWidth + 1) { btn.classList.add('floating'); document.body.appendChild(btn); }
    }

    function paint() {
        btn.querySelector('.nxa-lbl').textContent = t('btn');
        btn.title = t('open') + ' (Alt+A)';
        btn.setAttribute('aria-label', t('open'));
        btn.classList.toggle('on', state.open);
        btn.setAttribute('aria-expanded', String(state.open));
        dock.setAttribute('aria-label', t('title'));
        dock.querySelector('.nxa-title').textContent = t('title');
        dock.querySelector('.nxa-close').setAttribute('aria-label', t('close'));
        paintPlaceholder();
        input.setAttribute('aria-label', t('placeholder'));
        const h = dock.querySelector('.nxa-handle');
        h.setAttribute('aria-label', dock.classList.contains('collapsed') ? t('expand') : t('collapse'));
        h.title = h.getAttribute('aria-label');
        dock.querySelector('[data-pref="voice"]').textContent = '🔊 ' + t('voice');
        dock.querySelector('[data-pref="detail"]').textContent = '📖 ' + t('detail');
        dock.querySelectorAll('[data-pref]').forEach(b => b.setAttribute('aria-pressed', String(!!prefs[b.dataset.pref])));
        dock.querySelector('[data-pref="big"]').setAttribute('aria-label', 'Bigger text');
        dock.querySelector('.nxa-stop').textContent = '■ ' + t('stop');
        dock.classList.toggle('big', !!prefs.big);
        statusEl.textContent = t(dock.dataset.mode) || '';
        paintMic();
        chipsEl.innerHTML = state.history.length > 1 ? '' :
            t('chips').map(c => `<button type="button" class="nxa-chip">${esc(c)}</button>`).join('');
        chipsEl.querySelectorAll('.nxa-chip').forEach(c => c.addEventListener('click', () => userSays(c.textContent)));
    }
    function paintMic() {
        const typing = input && input.value.trim();
        micBtn.innerHTML = typing ? ICON.send : ICON.mic;
        micBtn.classList.toggle('live', !!prefs.mic && !typing);
        micBtn.setAttribute('aria-pressed', String(!!prefs.mic));
        micBtn.setAttribute('aria-label', typing ? t('send') : (prefs.mic ? t('stopMic') : t('mic')));
        micBtn.title = micBtn.getAttribute('aria-label');
        if (btn) btn.classList.toggle('mic', !!prefs.mic);
    }
    // Open / close the conversation above the bar (also by voice: "extend yourself", "unextend")
    function setExpanded(on) {
        dock.classList.toggle('collapsed', !on);
        document.documentElement.classList.toggle('nxa-exp', !!on);
        const h = dock.querySelector('.nxa-handle');
        h.setAttribute('aria-expanded', String(!!on));
        h.setAttribute('aria-label', on ? t('collapse') : t('expand'));
        h.title = h.getAttribute('aria-label');
        if (on) { h.classList.remove('new'); log.scrollTop = log.scrollHeight; }
        paintPlaceholder();
    }
    function paintPlaceholder() {
        const m = dock.dataset.mode;
        input.placeholder = dock.classList.contains('collapsed') && m && m !== 'ready' ? (t(m) || t('placeholder')) : t('placeholder');
    }
    function setMode(mode) {
        dock.dataset.mode = mode;
        statusEl.textContent = t(mode) || '';
        if (input) paintPlaceholder();
        dock.querySelector('.nxa-stop').hidden = !(mode === 'working' || mode === 'thinking' || mode === 'speaking');
    }

    // ---------- conversation on screen ----------
    function md(s) {          // tiny, safe Markdown: paragraphs, bullets, **bold**
        const lines = esc(s).split(/\n/);
        let html = '', inList = false;
        for (const raw of lines) {
            const line = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
            const m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)/.exec(line);
            if (m) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${m[1]}</li>`; continue; }
            if (inList) { html += '</ul>'; inList = false; }
            if (line.trim()) html += `<p>${line.replace(/^#+\s*/, '')}</p>`;
        }
        return html + (inList ? '</ul>' : '');
    }
    function renderLog() {
        if (!log) return;
        const items = state.history.length ? state.history : [{ role: 'ai', text: t('hello') }];
        log.innerHTML = items.slice(-30).map(m => m.role === 'user'
            ? `<div class="nxa-msg me">${esc(m.text)}</div>`
            : m.role === 'note' ? `<div class="nxa-msg note">${esc(m.text)}</div>`
            : `<div class="nxa-msg ai">${md(m.text)}${m.show ? `<div class="nxa-more">${md(m.show)}</div>` : ''}</div>`).join('');
        if (askBox) log.appendChild(askBox);
        log.scrollTop = log.scrollHeight;
        paint();
    }
    function add(role, text, show) {
        state.history.push({ role, text, show: show || '' });
        if (state.history.length > 40) state.history = state.history.slice(-40);
        save();
        renderLog();
        if (role === 'ai') live.textContent = text;
        if (role !== 'user' && dock.classList.contains('collapsed')) dock.querySelector('.nxa-handle').classList.add('new');
    }

    // ---------- open / close ----------
    function open(fromClick) {
        state.open = true;
        save();
        dock.classList.add('show');
        document.documentElement.classList.add('nxa-open');
        setExpanded(false);
        paint();
        if (fromClick) setTimeout(() => input.focus(), 60);
        if (fromClick && !state.history.length && prefs.voice) speak(t('hello'));
    }
    function close() {
        stopAll(true);
        state.open = false;
        state.pending = null;
        save();
        dock.classList.remove('show');
        document.documentElement.classList.remove('nxa-open', 'nxa-exp');
        hideCursor();
        paint();
        btn.focus();
    }

    // ---------- speaking (text to speech) ----------
    // One voice for everything on the site (assistant, exercise coach...): picked once, remembered on this
    // device, and used every time. The phone app uses the phone's own text-to-speech voice.
    const VOICE_KEY = 'nxVoiceName';
    const PREFERRED = [/Google UK English Female/i, /Neerja|Heera|Swara/i, /Google US English/i, /Samantha|Karen|Moira/i, /Zira|Aria|Jenny/i, /Female/i];
    function pickVoice(code) {
        const all = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
        if (!all.length) return null;
        const two = code.slice(0, 2).toLowerCase();
        const fits = v => v.lang && v.lang.toLowerCase().startsWith(two);
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(VOICE_KEY) || '{}'); } catch (e) { saved = {}; }
        const keep = saved[two] && all.find(v => v.name === saved[two]);
        if (keep) return keep;
        const pool = all.filter(fits);
        if (!pool.length) return null;
        const exact = pool.filter(v => v.lang.toLowerCase() === code.toLowerCase());
        let v = null;
        for (const re of PREFERRED) { v = (exact.find(x => re.test(x.name)) || pool.find(x => re.test(x.name))); if (v) break; }
        v = v || exact[0] || pool[0];
        saved[two] = v.name;
        try { localStorage.setItem(VOICE_KEY, JSON.stringify(saved)); } catch (e) {}
        return v;
    }
    if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => {}); }
    function voiceSpeak(text, code) {
        code = code || speechLang();
        text = cleanForSpeech(text);
        if (!text) return Promise.resolve();
        if (isApp && P.TextToSpeech) {
            return P.TextToSpeech.speak({ text, lang: code, rate: 1.0, pitch: 1.0, category: 'playback' }).catch(() => {});
        }
        if (!('speechSynthesis' in window)) return Promise.resolve();
        return new Promise(resolve => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = code;
            const v = pickVoice(code);
            if (v) u.voice = v;
            u.rate = 1; u.pitch = 1;
            u.onend = u.onerror = resolve;
            speechSynthesis.speak(u);
            setTimeout(resolve, 60000);
        });
    }
    function voiceStop() {
        try { if (isApp && P.TextToSpeech) P.TextToSpeech.stop(); } catch (e) {}
        try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
    }
    // Other parts of the site speak through this too, so it is always the same voice
    window.NxVoice = { speak: voiceSpeak, stop: voiceStop, pick: pickVoice };

    let speaking = false;
    function cleanForSpeech(s) { return String(s || '').replace(/[*#_`>✓⚠️]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').trim().slice(0, 1500); }
    async function speak(text) {
        if (!prefs.voice || !text) return;
        stopSpeaking();
        pauseForSpeech();
        speaking = true;
        setMode('speaking');
        try { await voiceSpeak(text); } catch (e) { /* no voice on this device */ }
        speaking = false;
        if (dock.dataset.mode === 'speaking') setMode('ready');
        afterReply();
    }
    function stopSpeaking() {
        speaking = false;
        voiceStop();
    }

    // ---------- listening (speech to text) ----------
    // The mic is a switch: one tap turns it on and it stays on (also on other pages) until the user taps it
    // again. While on, it keeps listening; it only pauses while the assistant itself is talking.
    let listening = false, recog = null, discard = false, failCount = 0, restartTimer = null;
    function toggleMic() {
        prefs.mic = !prefs.mic;
        savePrefs();
        if (prefs.mic) { failCount = 0; listen(); }
        else { discard = true; stopListening(); input.value = ''; }
        paint();
        live.textContent = prefs.mic ? t('micOn') : t('micOff');
    }
    function maybeListen(delay) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { if (prefs.mic && !speaking && !listening && !leaving) listen(); }, delay || 300);
    }
    function micBlocked(msg) {
        prefs.mic = false; savePrefs();
        add('note', msg); paint();
    }
    async function listen() {
        if (listening || !prefs.mic || speaking) return;
        discard = false;
        const started = Date.now();
        const done = text => {
            listening = false; recog = null; paintMic();
            if (dock.dataset.mode === 'listening') setMode(busy ? 'working' : 'ready');
            if (discard) { discard = false; input.value = ''; maybeListen(400); return; }
            text = (text || '').trim();
            input.value = '';
            if (text) { failCount = 0; userSays(text); }
            else if (Date.now() - started < 1500) failCount++;     // ended at once: wait longer before trying again
            else failCount = 0;
            maybeListen(failCount ? Math.min(8000, 400 * 2 ** failCount) : 250);
        };
        if (isApp && P.SpeechRecognition) {
            try {
                const perm = await P.SpeechRecognition.requestPermissions();
                if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') { micBlocked(t('micDenied')); return; }
                if (!prefs.mic || speaking) return;
                listening = true; paintMic(); if (!busy) setMode('listening');
                const r = await P.SpeechRecognition.start({ language: speechLang(), maxResults: 1, partialResults: false, popup: false });
                done((r && r.matches && r.matches[0]) || '');
            } catch (e) {
                done('');
            }
            return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { micBlocked(t('noMic')); input.focus(); return; }
        recog = new SR();
        recog.lang = speechLang();
        recog.interimResults = true;
        recog.maxAlternatives = 1;
        let finalText = '';
        recog.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
                else interim += e.results[i][0].transcript;
            }
            if (!discard) input.value = (finalText + interim).trim();
        };
        recog.onerror = e => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { discard = true; micBlocked(t('micDenied')); }
        };
        recog.onend = () => done(finalText || input.value);
        try { recog.start(); listening = true; paintMic(); if (!busy) setMode('listening'); }
        catch (e) { listening = false; recog = null; paintMic(); maybeListen(1000); }
    }
    function stopListening() {
        clearTimeout(restartTimer);
        try { if (recog) recog.abort(); } catch (e) {}
        try { if (isApp && P.SpeechRecognition) P.SpeechRecognition.stop(); } catch (e) {}
        if (!recog) { listening = false; paintMic(); }
        if (dock.dataset.mode === 'listening') setMode('ready');
    }
    // Pause the mic while the assistant talks (so it doesn't hear itself), then carry on listening
    function pauseForSpeech() { if (listening) { discard = true; stopListening(); } }
    function afterReply() { if (prefs.mic && !speaking) maybeListen(300); }

    // ---------- what is on the page (sent to the AI) ----------
    let elMap = new Map();
    function visible(el) {
        if (el.closest('#nxa-dock, #nxa-cursor, .nxa-btn')) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    }
    function labelOf(el) {
        const pick = v => (v || '').replace(/\s+/g, ' ').trim();
        let l = pick(el.getAttribute('aria-label'));
        if (!l && el.id) { const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (lab) l = pick(lab.innerText); }
        if (!l && el.closest('label')) l = pick(el.closest('label').innerText);
        if (!l) l = pick(el.innerText);
        if (!l) l = pick(el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name') || (el.querySelector('img') && el.querySelector('img').alt) || el.value);
        return l.slice(0, 90);
    }
    function snapshot() {
        elMap = new Map();
        const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [role=menuitem], [onclick], summary, [contenteditable="true"]';
        const all = [...document.querySelectorAll(sel)].filter(visible);
        const vh = innerHeight;
        const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; };
        all.sort((a, b) => (inView(b) - inView(a)));
        const lines = [];
        let id = 0;
        for (const el of all.slice(0, 160)) {
            id++;
            elMap.set(id, el);
            const tag = el.tagName.toLowerCase();
            let kind = el.getAttribute('role') || tag;
            if (tag === 'input') kind = `input(${el.type || 'text'})`;
            if (tag === 'a') kind = 'link';
            let line = `[${id}] ${kind} "${labelOf(el)}"`;
            if ((tag === 'input' || tag === 'textarea') && !['password', 'checkbox', 'radio', 'file'].includes(el.type)) line += ` value="${String(el.value || '').slice(0, 60)}"`;
            if (el.type === 'password') line += ' (password: user must type it)';
            if (el.type === 'checkbox' || el.type === 'radio' || el.getAttribute('role') === 'checkbox') line += el.checked || el.getAttribute('aria-checked') === 'true' ? ' [checked]' : ' [not checked]';
            if (tag === 'select') line += ` selected="${(el.options[el.selectedIndex] || {}).text || ''}" options=${JSON.stringify([...el.options].slice(0, 12).map(o => o.text))}`;
            if (tag === 'a') { const h = el.getAttribute('href') || ''; if (h && !h.startsWith('#') && !h.startsWith('javascript')) line += ` -> ${h.slice(0, 60)}`; }
            if (el.disabled || el.getAttribute('aria-disabled') === 'true') line += ' (disabled)';
            if (el.getAttribute('aria-current') || el.classList.contains('active')) line += ' (current)';
            if (!inView(el)) line += ' (off screen)';
            lines.push(line);
        }
        const clone = (document.querySelector('main') || document.body);
        let text = '';
        try {
            text = [...clone.querySelectorAll('h1, h2, h3, h4, p, li, td, th, label, .card, [class*="title"], [class*="value"]')]
                .filter(el => !el.closest('#nxa-dock') && el.offsetParent !== null)
                .map(el => el.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
            text = [...new Set(text)].join('\n').slice(0, 3500);
        } catch (e) {}
        if (!text) text = (clone.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 3500);
        return { url: location.pathname.split('/').pop() || 'home.html', title: document.title, elements: lines, text,
            scroll: `${Math.round(scrollY)} of ${Math.max(0, document.documentElement.scrollHeight - innerHeight)}` };
    }

    // ---------- the moving pointer ----------
    function setCursor(x, y, instant) {
        if (instant) cursor.style.transition = 'none';
        cursor.style.setProperty('--x', x + 'px');
        cursor.style.setProperty('--y', y + 'px');
        if (instant) { void cursor.offsetWidth; cursor.style.transition = ''; }
        state.cursor = { x, y };
    }
    function hideCursor() { cursor && cursor.classList.remove('show'); }
    async function moveTo(el) {
        let r = el.getBoundingClientRect();
        if (r.top < 70 || r.bottom > innerHeight - (state.open && innerWidth <= 720 ? innerHeight * 0.42 : 20)) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
            r = el.getBoundingClientRect();
        }
        cursor.classList.add('show');
        setCursor(Math.round(r.left + Math.min(r.width / 2, 60)), Math.round(r.top + r.height / 2));
        el.classList.add('nxa-target');
        await sleep(700);
        return r;
    }
    function ripple() {
        const d = document.createElement('div');
        d.className = 'nxa-ripple';
        d.style.left = (state.cursor.x + 4) + 'px';
        d.style.top = (state.cursor.y + 4) + 'px';
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 600);
    }
    const unmark = el => setTimeout(() => el && el.classList.remove('nxa-target'), 900);

    function setValue(el, value) {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ---------- doing the steps ----------
    let busy = false, stopFlag = false, leaving = false;
    window.addEventListener('beforeunload', () => { leaving = true; });
    window.addEventListener('pagehide', () => { leaving = true; });
    async function run(actions) {
        const done = [];
        for (const a of actions) {
            if (stopFlag) { done.push('stopped by the user'); break; }
            const el = a.id != null ? elMap.get(Number(a.id)) : null;
            const name = el ? `[${a.id}] "${labelOf(el)}"` : '';
            try {
                if (['click', 'type', 'select', 'check', 'point'].includes(a.do) && (!el || !document.contains(el))) {
                    done.push(`${a.do} ${a.id}: element not found`); continue;
                }
                if (a.do === 'expand' || a.do === 'collapse') { setExpanded(a.do === 'expand'); done.push(a.do === 'expand' ? 'opened the conversation' : 'made the assistant small'); continue; }
                if (a.do === 'point') { await moveTo(el); unmark(el); done.push(`pointed at ${name}`); }
                else if (a.do === 'click') {
                    await moveTo(el); ripple(); await sleep(150);
                    unmark(el);
                    el.focus({ preventScroll: true });
                    el.click();
                    done.push(`clicked ${name}`);
                    await sleep(700);
                } else if (a.do === 'type') {
                    if (el.type === 'password') { done.push(`did not type into password box ${name} (user must type it)`); continue; }
                    await moveTo(el); ripple();
                    el.focus({ preventScroll: true });
                    const text = String(a.text || '');
                    if (el.isContentEditable) { el.textContent = text; el.dispatchEvent(new Event('input', { bubbles: true })); }
                    else {
                        setValue(el, '');
                        for (let i = 1; i <= text.length; i++) { setValue(el, text.slice(0, i)); await sleep(text.length > 40 ? 8 : 35); if (stopFlag) break; }
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    unmark(el);
                    done.push(`typed "${text.slice(0, 60)}" into ${name}`);
                } else if (a.do === 'select') {
                    await moveTo(el); ripple();
                    const want = String(a.text || '').toLowerCase();
                    const opt = [...(el.options || [])].find(o => o.text.toLowerCase() === want || o.value.toLowerCase() === want)
                        || [...(el.options || [])].find(o => o.text.toLowerCase().includes(want));
                    if (opt) { el.value = opt.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); done.push(`chose "${opt.text}" in ${name}`); }
                    else done.push(`option "${a.text}" not found in ${name}`);
                    unmark(el);
                } else if (a.do === 'check') {
                    await moveTo(el);
                    const isOn = el.checked || el.getAttribute('aria-checked') === 'true';
                    if (!!a.on !== isOn) { ripple(); el.click(); }
                    unmark(el);
                    done.push(`${a.on ? 'ticked' : 'unticked'} ${name}`);
                } else if (a.do === 'scroll') {
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); await moveTo(el); unmark(el); }
                    else if (a.dir === 'top') scrollTo({ top: 0, behavior: 'smooth' });
                    else if (a.dir === 'bottom') scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                    else scrollBy({ top: (a.dir === 'up' ? -1 : 1) * innerHeight * 0.7, behavior: 'smooth' });
                    await sleep(650);
                    done.push(`scrolled ${a.dir || 'to ' + name}`);
                } else if (a.do === 'go') {
                    const page = String(a.page || '').replace(/^\/+/, '').split(/[?#]/)[0];
                    if (!PAGES.includes(page)) { done.push(`unknown page ${a.page}`); continue; }
                    done.push(`opened ${page}`);
                    if (state.pending) state.pending.results = done.join('; ');
                    save();
                    location.href = page;
                    await sleep(4000);       // the page is changing
                } else if (a.do === 'back') {
                    done.push('went back');
                    if (state.pending) state.pending.results = done.join('; ');
                    save();
                    history.back();
                    await sleep(2500);
                }
            } catch (e) {
                done.push(`${a.do} failed: ${e.message || e}`);
            }
            if (state.pending) { state.pending.results = done.join('; '); save(); }
            if (leaving) { await sleep(5000); break; }      // a new page is opening: it carries on there
        }
        await sleep(300);
        return done.join('; ');
    }

    // ---------- one turn with the AI ----------
    async function ask(message, results, step) {
        if (!navigator.onLine) { add('note', t('offline')); return; }
        busy = true; stopFlag = false;
        setMode(results ? 'working' : 'thinking');
        let data;
        try {
            const res = await fetch(API(), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message || '', results: results || '',
                    history: state.history.filter(m => m.role !== 'note').slice(-14).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text + (m.show ? '\n' + m.show : '') })),
                    page: snapshot(), detail: !!prefs.detail, language: lang(),
                    signed_in: localStorage.getItem('neutrix_authenticated') === 'true', device: isApp ? 'Android app' : (innerWidth <= 720 ? 'phone browser' : 'computer browser')
                })
            });
            data = await res.json();
        } catch (e) {
            busy = false; setMode('ready');
            add('note', t('error'));
            return;
        }
        busy = false;
        if (stopFlag) { setMode('ready'); return; }
        if (data.say || data.show) add('ai', data.say || '', data.show || '');
        let actions = Array.isArray(data.actions) ? data.actions : [];
        // Ask first before anything risky, even if the AI did not
        const risky = actions.some(a => a.do === 'click' && elMap.get(Number(a.id)) && RISKY.test(labelOf(elMap.get(Number(a.id)))));
        const speech = speak(data.say);
        if (actions.length && (data.confirm || risky)) {
            await speech;
            confirmFirst(actions, !!data.continue, step);
            return;
        }
        if (actions.length) {
            await doSteps(actions, !!data.continue, step);
        } else {
            setMode(speaking ? 'speaking' : 'ready');
            await speech;
            afterReply();
        }
    }
    async function doSteps(actions, keepGoing, step) {
        busy = true; setMode('working');
        if (keepGoing) { state.pending = { step: step + 1, results: '' }; save(); }
        const results = await run(actions);
        busy = false;
        if (leaving) return;
        if (stopFlag) { state.pending = null; save(); setMode('ready'); hideCursor(); return; }
        if (keepGoing && step + 1 < MAX_STEPS) {
            state.pending = null; save();
            return ask('', results + `. Page now: ${location.pathname.split('/').pop()}`, step + 1);
        }
        state.pending = null; save();
        if (keepGoing) add('note', t('tooMany'));
        setMode('ready');
        setTimeout(hideCursor, 2500);
        afterReply();
    }
    function confirmFirst(actions, keepGoing, step) {
        setExpanded(true);
        askBox = document.createElement('div');
        askBox.className = 'nxa-ask';
        askBox.innerHTML = `<button type="button" class="nxa-go">${esc(t('yes'))}</button><button type="button" class="nxa-go no">${esc(t('no'))}</button>`;
        const finish = yes => {
            askBox = null; renderLog();
            if (yes) doSteps(actions, keepGoing, step);
            else { add('ai', t('cancelled')); speak(t('cancelled')); }
        };
        askBox.querySelector('.nxa-go').addEventListener('click', () => finish(true));
        askBox.querySelector('.no').addEventListener('click', () => finish(false));
        confirmFirst.answer = finish;
        renderLog();
        setMode('ready');
        askBox.querySelector('.nxa-go').focus();
    }
    function userSays(text) {
        if (!state.open) open(false);
        stopSpeaking();
        if (askBox && confirmFirst.answer) {          // answering "Should I ...?"
            const yes = /^(yes|yeah|yep|ok|okay|sure|do it|go ahead|confirm|അതെ|ശരി|ചെയ്യൂ)\b/i.test(text.trim());
            const no = /^(no|nope|don'?t|cancel|stop|വേണ്ട|ഇല്ല)\b/i.test(text.trim());
            if (yes || no) { add('user', text); confirmFirst.answer(yes); return; }
            askBox = null;
        }
        const cmd = text.trim().toLowerCase().replace(/[.!?,]+/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').replace(/^(please|hey neutrix|neutrix|ok|okay)\s+/, '').replace(/\s+please$/, '');
        const WHO = '(?:(?:the|my|this) )?(yourself|urself|you|neutrix assistant|neutrix|assistant|panel|chat|window|it)';
        if (new RegExp(`^(un ?extend|un ?expand|collapse|minimi[sz]e|shrink|hide|fold|close up|go small|get small|make ${WHO} small(er)?|smaller)( ${WHO})?( down)?$`).test(cmd) || /^(ചെറുതാക്കൂ|ചുരുക്കൂ)/.test(cmd)) {
            add('user', text); setExpanded(false); return;
        }
        if (new RegExp(`^(extend|expand|un ?collapse|unfold|open( up)?|show|maximi[sz]e|enlarge|make ${WHO} (big|bigger|large)|bigger)( ${WHO})?( up)?$`).test(cmd) || /^(വലുതാക്കൂ|തുറക്കൂ)/.test(cmd)) {
            add('user', text); setExpanded(true); return;
        }
        if (/^(stop|cancel|be quiet|shut up|നിർത്ത്|നിർത്തൂ)\.?$/i.test(text.trim())) { add('user', text); stopAll(); add('ai', t('stopped')); return; }
        if (busy) stopFlag = true;
        add('user', text);
        ask(text, '', 0);
    }
    function stopAll(silent) {
        stopFlag = true;
        stopSpeaking();
        if (listening) { discard = true; stopListening(); }
        state.pending = null;
        save();
        askBox = null;
        if (log) renderLog();
        setMode('ready');
        hideCursor();
        if (prefs.mic) maybeListen(600);
    }

    // ---------- start ----------
    function start() {
        build();
        if (state.open) {
            dock.classList.add('show');
            document.documentElement.classList.add('nxa-open');
            paint();
        }
        // The mic stays on across pages until the user turns it off
        if (prefs.mic) maybeListen(1200);
        // Continue a task that opened this page
        if (state.open && state.pending) {
            const p = state.pending;
            state.pending = null; save();
            if (state.cursor) cursor.classList.add('show');
            setTimeout(() => ask('', (p.results || 'The new page has opened') + `. Page now: ${location.pathname.split('/').pop()}`, p.step || 1), 1200);
        }
        // The phone app's top bar is made a moment later: move the button into it
        let tries = 0;
        const iv = setInterval(() => {
            tries++;
            if (document.querySelector('.nx-appbar .nx-ab-me') && !btn.classList.contains('nxa-ab')) placeButton();
            else if (!btn.isConnected || (btn.classList.contains('floating') && (document.getElementById('accountSlot') || document.querySelector('.nx-appbar')))) placeButton();
            if (tries > 10) clearInterval(iv);
        }, 300);
    }
    window.NxAssistant = { open: () => open(true), close, say: userSays, snapshot };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
