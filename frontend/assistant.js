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
        'improvements.html', 'exercise.html', 'tracking.html', 'briefing.html', 'progress.html', 'profile.html', 'home.html', 'body3d.html',
        'signin.html', 'get-app.html'];
    const RISKY = /\b(delete|remove|erase|sign ?out|log ?out|send|submit|reset|clear all|deactivate|ഇല്ലാതാക്കുക|അയയ്ക്കുക)\b/i;

    // ---------- words on screen ----------
    const T = {
        English: {
            btn: 'Emma', open: 'Open Emma, your Neutrix assistant', title: 'Emma · Neutrix Assistant', close: 'Close assistant',
            hello: "Hi, I'm Emma. Talk or type. I can open any page, fill things in, read the screen to you, or just chat.",
            placeholder: 'Type or tap the mic…', send: 'Send', expand: 'Show the conversation', collapse: 'Hide the conversation', mic: 'Turn the mic on', stopMic: 'Mic is on: tap to mute', micOn: 'Mic on. Say “Hey Emma” and then what you need.', wakeHint: 'Say “Hey Emma”…', tapToHear: 'Tap anywhere on the page so I can talk to you.', micOff: 'Mic off.',
            listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', working: 'Working on the page…', ready: 'Ready',
            detail: 'Detailed', voice: 'Voice', yes: 'Yes, do it', no: 'No', stop: 'Stop',
            stopped: 'Okay, I stopped.', cancelled: "Okay, I won't do that.", noMic: "Your browser can't use the microphone here. Please type instead.",
            micDenied: 'Microphone permission is off. Allow it, or type instead.', offline: "You're offline. I need the internet to answer.",
            offlineLimited: "I'm offline, so I can only do simple things right now: open pages, read the page, scroll, tell you today's medicines, your next check-up, your exercises or the time. Everything else needs the internet.",
            offlineNoMic: "Without internet I can't hear you on this browser. Type to me instead. I'll be able to hear you offline next time, after you turn the mic on once while online.",
            offlineNoMicApp: "Without internet I can't hear you yet. In your phone's Google voice settings, download offline speech recognition for English, then I can hear you offline. Until then, type to me.",
            error: "Sorry, I couldn't reach the assistant. Please try again.", waking: 'Waking up the AI server, one moment…', tooMany: 'I stopped after several steps. Tell me what to do next.',
            chips: ['What can you do?', 'Open my medicine schedule', 'Read this page to me', 'Make the text bigger']
        },
        Malayalam: {
            btn: 'എമ്മ', open: 'എമ്മയെ തുറക്കുക', title: 'എമ്മ · Neutrix അസിസ്റ്റന്റ്', close: 'അടയ്ക്കുക',
            hello: 'നമസ്കാരം! ഞാൻ എമ്മ, നിങ്ങളുടെ Neutrix അസിസ്റ്റന്റ്. സംസാരിക്കുകയോ ടൈപ്പ് ചെയ്യുകയോ ചെയ്യാം. ലളിതമായി വിശദീകരിക്കാം, അല്ലെങ്കിൽ ഈ വെബ്സൈറ്റിൽ കാര്യങ്ങൾ ചെയ്തു തരാം.',
            placeholder: 'ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ മൈക്ക് അമർത്തുക…', send: 'അയയ്ക്കുക', expand: 'സംഭാഷണം കാണിക്കുക', collapse: 'സംഭാഷണം മറയ്ക്കുക', mic: 'മൈക്ക് ഓണാക്കുക', stopMic: 'മൈക്ക് ഓണാണ്: ഓഫാക്കാൻ അമർത്തുക', micOn: 'മൈക്ക് ഓൺ. “Hey Emma” എന്ന് പറഞ്ഞ ശേഷം സംസാരിക്കുക.', wakeHint: '“Hey Emma” എന്ന് പറയൂ…', tapToHear: 'ഞാൻ സംസാരിക്കാൻ പേജിൽ എവിടെയെങ്കിലും ടാപ്പ് ചെയ്യുക.', micOff: 'മൈക്ക് ഓഫ്.',
            listening: 'കേൾക്കുന്നു…', thinking: 'ആലോചിക്കുന്നു…', speaking: 'സംസാരിക്കുന്നു…', working: 'പേജിൽ ചെയ്യുന്നു…', ready: 'തയ്യാർ',
            detail: 'വിശദമായി', voice: 'ശബ്ദം', yes: 'അതെ, ചെയ്യൂ', no: 'വേണ്ട', stop: 'നിർത്തുക',
            stopped: 'ശരി, നിർത്തി.', cancelled: 'ശരി, അത് ചെയ്യുന്നില്ല.', noMic: 'ഇവിടെ മൈക്ക് ഉപയോഗിക്കാൻ കഴിയില്ല. ടൈപ്പ് ചെയ്യുക.',
            micDenied: 'മൈക്ക് അനുമതി ഓഫാണ്.', offline: 'ഇന്റർനെറ്റ് ഇല്ല.',
            offlineLimited: 'ഇന്റർനെറ്റ് ഇല്ലാത്തതിനാൽ ലളിതമായ കാര്യങ്ങൾ മാത്രം: പേജുകൾ തുറക്കാം, പേജ് വായിക്കാം, ഇന്നത്തെ മരുന്നുകൾ, അടുത്ത പരിശോധന, വ്യായാമങ്ങൾ, സമയം.',
            offlineNoMic: 'ഇന്റർനെറ്റ് ഇല്ലാതെ ഈ ബ്രൗസറിൽ എനിക്ക് കേൾക്കാൻ കഴിയില്ല. ടൈപ്പ് ചെയ്യുക.',
            offlineNoMicApp: 'ഇന്റർനെറ്റ് ഇല്ലാതെ എനിക്ക് കേൾക്കാൻ കഴിയില്ല. ഫോണിലെ Google voice ക്രമീകരണങ്ങളിൽ ഓഫ്‌ലൈൻ സ്പീച്ച് ഡൗൺലോഡ് ചെയ്യുക. അതുവരെ ടൈപ്പ് ചെയ്യുക.', error: 'ക്ഷമിക്കണം, വീണ്ടും ശ്രമിക്കുക.', waking: 'AI സെർവർ ഉണരുന്നു, ഒരു നിമിഷം…', tooMany: 'കുറച്ച് ഘട്ടങ്ങൾക്ക് ശേഷം നിർത്തി. അടുത്തത് പറയൂ.',
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
    .nxa-btn.floating { position: fixed; top: calc(12px + env(safe-area-inset-top)); right: 14px; z-index: 2147483001; }
    @media (max-width: 720px) { .nxa-btn:not(.floating):not(.nxa-ab) .nxa-lbl { display: none; } .nxa-btn:not(.floating) { padding: 8px 10px; } }
    .nx-appbar button.nxa-btn { background: linear-gradient(135deg, #6d28d9, #2563eb 55%, #0891b2); color: #fff; }
    .nxa-btn.nxa-ab { padding: 0; width: 40px; height: 40px; justify-content: center; border-radius: 50%; margin-right: 4px; }
    .nxa-btn.nxa-ab .nxa-lbl { display: none; }

    #nxa-dock { position: fixed; z-index: 2147483000; right: 16px; bottom: 16px; width: min(350px, calc(100vw - 32px)); max-height: min(54vh, 460px);
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
    html.nx-app-ui #nxa-dock { bottom: calc(72px + env(safe-area-inset-bottom)); max-height: 38vh; padding-bottom: 0; }
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
    /* Arc-reactor glow while it talks or works */
    #nxa-dock[data-mode="speaking"], #nxa-dock[data-mode="working"] { box-shadow: 0 0 0 1.5px rgba(56,189,248,.65), 0 0 26px rgba(56,189,248,.45), 0 18px 50px rgba(15,23,42,.28); }
    #nxa-dock[data-mode="listening"] { box-shadow: 0 0 0 1.5px rgba(239,68,68,.55), 0 0 22px rgba(239,68,68,.3), 0 18px 50px rgba(15,23,42,.28); }
    .nxa-orb { background: radial-gradient(circle at 50% 50%, #e0f2fe 0 18%, #38bdf8 30%, #0369a1 62%, #0c4a6e 100%) !important; }
    #nxa-dock[data-mode="listening"] .nxa-orb { background: radial-gradient(circle at 50% 50%, #fee2e2 0 18%, #f87171 32%, #b91c1c 70%) !important; }
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
        transform: translate(var(--x, 50vw), var(--y, 50vh)); transition: transform .42s cubic-bezier(.4,.1,.2,1), opacity .2s;
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
        cursor.innerHTML = ICON.cursor + '<span class="tag">Emma</span>';
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
        const base = prefs.mic ? t('wakeHint') : t('placeholder');
        input.placeholder = dock.classList.contains('collapsed') && m && m !== 'ready' && m !== 'listening' ? (t(m) || base) : base;
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
        setTimeout(warmVoice, 6000);          // save her everyday phrases for offline (once per device)
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
    // Voice style: a calm Irish / British woman's voice, like an AI butler from the films (closest voice the device has)
    const VOICE_KEY = 'nxVoiceV3';
    const PREFERRED = [
        v => /Google UK English Female/i.test(v.name),                         // Chrome: young British woman
        v => /en[-_]GB/i.test(v.lang) && /libby|sonia|maisie|bella|hazel|susan|serena|kate|stephanie|female/i.test(v.name),   // Edge / Windows / Apple: England
        v => /en[-_]GB/i.test(v.lang) && !/male|daniel|george|ryan|thomas|arthur|oliver|alfie|elliot|noah|ethan/i.test(v.name),
        v => /moira|fiona/i.test(v.name),
        v => /en[-_]IE/i.test(v.lang),
        v => /karen|tessa|catherine|samantha|zira|aria|jenny|female/i.test(v.name)
    ];
    function pickVoice(code) {
        const all = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
        if (!all.length) return null;
        const two = code.slice(0, 2).toLowerCase();
        const fits = v => v.lang && v.lang.toLowerCase().startsWith(two);
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(VOICE_KEY) || '{}'); } catch (e) { saved = {}; }
        const off = !navigator.onLine;
        // Offline, voices that need the internet ("Google UK English Female", "… Online (Natural)") are silent or very slow
        const works = v => !off || (v.localService !== false && !/online|google/i.test(v.name));
        const keep = saved[two] && all.find(v => v.name === saved[two] && works(v));
        if (keep) return keep;
        const pool = all.filter(v => fits(v) && works(v));
        if (!pool.length) return null;
        const exact = pool.filter(v => v.lang.toLowerCase() === code.toLowerCase());
        let v = null;
        if (two === 'en') { for (const ok of PREFERRED) { v = pool.find(ok); if (v) break; } }        v = v || exact.filter(works)[0] || pool[0];
        if (!off) {                                       // remember the online choice only; offline picks are for now
            saved[two] = v.name;
            try { localStorage.setItem(VOICE_KEY, JSON.stringify(saved)); } catch (e) {}
        }
        return v;
    }
    if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => {}); }
    // Natural, human-sounding woman's voice (Gemini voice from our server). Saved on the device after the first
    // time, so repeated phrases play at once. If it isn't available, the device's own voice is used.
    const VOICE_CACHE = 'nx-voice-v4';      // v4: Emma's British voice (Leda) (old saved phrases are not used)
    try { caches.delete('nx-voice-v1'); caches.delete('nx-voice-v2'); caches.delete('nx-voice-v3'); } catch (e) {}       // free the space used by old voices
    let curAudio = null, speakId = 0, naturalDownUntil = 0, curAbort = null, curSources = [];
    const hashText = str => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    const voiceKey = text => new Request(location.origin + '/__nxvoice/' + hashText(text) + '-' + text.length);
    async function cacheGet(text) {
        try { const hit = await (await caches.open(VOICE_CACHE)).match(voiceKey(text)); return hit ? await hit.blob() : null; } catch (e) { return null; }
    }
    function cachePut(text, blob) {
        if (text.length > 220) return;
        caches.open(VOICE_CACHE).then(c => c.put(voiceKey(text), new Response(blob, { headers: { 'Content-Type': 'audio/wav' } }))).catch(() => {});
    }
    function splitForSpeech(text) {
        const m = /^(.{6,140}?[.!?…])\s+(\S[\s\S]*)$/.exec(text);
        return m ? [m[1], m[2]] : [text];
    }
    async function naturalBlob(text) {
        const saved = await cacheGet(text);
        if (saved) return saved;
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 12000);
        try {
            const res = await fetch(API().replace(/\/api\/assistant$/, '/api/assistant/voice'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: ctrl.signal });
            if (!res.ok) throw new Error('voice ' + res.status);
            const blob = await res.blob();
            if (blob.size < 2000) throw new Error('voice empty');
            cachePut(text, blob);
            return blob;
        } finally { clearTimeout(to); }
    }    function naturalDeviceVoice() {
        if (!navigator.onLine) return null;                // Edge's natural voices need the internet
        const all = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
        return all.find(v => /Online \(Natural\)/i.test(v.name) && /en[-_]GB/i.test(v.lang) && /libby|sonia|maisie|bella|hazel/i.test(v.name))
            || all.find(v => /Online \(Natural\)/i.test(v.name) && /en[-_]/i.test(v.lang) && /ava|emma|jenny|aria|michelle|neerja|natasha|clara/i.test(v.name)) || null;
    }
    // Phone app: the phone's British English woman's voice (Google's offline en-GB voices gba / gbc / gbg are women)
    let appVoiceP = null;
    function appVoice() {
        if (!appVoiceP) appVoiceP = (async () => {
            try {
                const r = await P.TextToSpeech.getSupportedVoices();
                const vs = (r && r.voices) || [];
                const name = v => ((v.voiceURI || '') + ' ' + (v.name || '')).toLowerCase();
                const gb = v => /en[-_]gb/i.test(v.lang || '') || /en-gb/.test(name(v));
                const order = [
                    v => gb(v) && /gb[acg]-local/.test(name(v)),
                    v => gb(v) && /gb[acg]/.test(name(v)),
                    v => gb(v) && /female|woman/.test(name(v)),
                    v => gb(v) && v.localService !== false && !/male|gbb|gbd|rjs/.test(name(v)),
                    v => gb(v) && !/male|gbb|gbd|rjs/.test(name(v))
                ];
                for (const ok of order) { const i = vs.findIndex(ok); if (i >= 0) return i; }
            } catch (e) {}
            return -1;
        })();
        return appVoiceP;
    }
    function playBlob(blob, my) {
        return new Promise(resolve => {
            if (my !== speakId) return resolve();
            const a = new Audio(URL.createObjectURL(blob));
            curAudio = a;
            const end = () => { try { URL.revokeObjectURL(a.src); } catch (e) {} if (curAudio === a) curAudio = null; resolve(); };
            a.onended = end; a.onerror = end;
            a.play().catch(end);
        });
    }
    async function voiceSpeak(text, code) {
        code = code || speechLang();
        text = cleanForSpeech(text);
        if (!text) return;
        const my = ++speakId;
        // Microsoft Edge has natural, human-sounding voices built in: instant, so use those when there
        const edgeNatural = !isApp && code.startsWith('en') ? naturalDeviceVoice() : null;
        if (!edgeNatural && navigator.onLine && Date.now() > naturalDownUntil) {
            try {
                // First sentence on its own (ready in ~2 s) while the rest is made at the same time
                const parts = splitForSpeech(text);
                const jobs = parts.map(part => naturalBlob(part));
                jobs.forEach(j => j.catch(() => {}));
                for (let i = 0; i < jobs.length; i++) {
                    const blob = await jobs[i];
                    if (my !== speakId) return;
                    await playBlob(blob, my);
                    if (my !== speakId) return;
                }
                return;
            } catch (e) {
                if (my !== speakId) return;
                naturalDownUntil = Date.now() + 60000;      // try the natural voice again in a minute
                console.warn('[assistant] natural voice not available, using the device voice', e);
            }
        }        // No internet (or the natural voice is down): Emma's own voice still plays for phrases saved on this device
        if (!edgeNatural) {
            const parts = splitForSpeech(text);
            const saved = await Promise.all(parts.map(cacheGet));
            if (my !== speakId) return;
            if (saved.every(Boolean)) {
                for (const blob of saved) { await playBlob(blob, my); if (my !== speakId) return; }
                return;
            }
        }
        if (isApp && P.TextToSpeech) {
            const opts = { text, lang: code.startsWith('en') ? 'en-GB' : code, rate: 1.15, pitch: 1.05, category: 'playback' };
            const vi = code.startsWith('en') ? await appVoice() : -1;
            if (vi >= 0) opts.voice = vi;
            return P.TextToSpeech.speak(opts).catch(() => P.TextToSpeech.speak({ text, lang: opts.lang, rate: 1.15, pitch: 1.05 }).catch(() => {}));
        }
        if (!('speechSynthesis' in window)) return Promise.resolve();
        return new Promise(resolve => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = code;
            const nat = code.startsWith('en') ? naturalDeviceVoice() : null;
            const v = nat || pickVoice(code);
            if (v) u.voice = v;            // device voices are slow at normal speed: a little quicker sounds natural; pitch stays near normal
            u.rate = nat ? 1.05 : 1.15; u.pitch = nat ? 1 : 1.05;
            u.onend = u.onerror = resolve;
            speechSynthesis.speak(u);
            setTimeout(resolve, 60000);
        });
    }
    function voiceStop() {
        speakId++;
        try { if (curAbort) curAbort.abort(); } catch (e) {}
        curSources.forEach(src => { try { src.stop(); } catch (e) {} });
        curSources = [];
        try { if (curAudio) { curAudio.pause(); curAudio = null; } } catch (e) {}
        try { if (isApp && P.TextToSpeech) P.TextToSpeech.stop(); } catch (e) {}
        try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
    }
    // Emma's everyday phrases, saved once per device in her natural voice so she sounds the same offline
    const WARM_KEY = 'nxVoiceWarm';
    let warming = false;
    function warmVoice() {
        if (warming || !navigator.onLine || !prefs.voice || lang() !== 'English') return;
        try { if (localStorage.getItem(WARM_KEY) === VOICE_CACHE + '.2') return; } catch (e) {}
        warming = true;
        const E = T.English;        const phrases = [E.stopped, E.cancelled, E.micOn, E.micOff, E.tapToHear, E.offline, E.offlineLimited, E.offlineNoMic, E.offlineNoMicApp, E.error, E.waking, E.tooMany,
            'Yes?', "I'm listening.", 'Go ahead.', 'Okay, cancelled.', 'Going back.', 'Refreshing.', 'Text is bigger.', 'Text is smaller.',
            'Back to normal size.', 'Mic off. Tap the mic when you need me.', 'Rating form is open.'];
        if (firstName()) phrases.push('Yes, ' + firstName() + '?');
        (async () => {
            let ok = true;
            for (const p of phrases) {
                for (const part of splitForSpeech(cleanForSpeech(p))) {
                    if (!navigator.onLine) { ok = false; break; }
                    if (await cacheGet(part)) continue;
                    try { await naturalBlob(part); } catch (e) { ok = false; break; }
                    await sleep(1500);                          // gently, one at a time
                }
                if (!ok) break;
            }
            if (ok) try { localStorage.setItem(WARM_KEY, VOICE_CACHE + '.2'); } catch (e) {}
            warming = false;
        })();
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

    // ---------- wake word: with the mic on, only speech that starts with "Hey Emma" / "Emma" is for me ----------
    // (After the name, or right after I answer, there are a few seconds to talk without saying it again.)
    const WAKE = /^(?:.{0,12}?\b)?(?:hey|hi|hello|ok|okay|yo|a)?[\s,]*(emma|emmah|ema|emmaa|എമ്മ|एम्मा)\b[\s,.!?:-]*/i;
    let wakeUntil = 0;
    const awake = () => Date.now() < wakeUntil || !!askBox;
    function wakeFilter(text) {
        const m = WAKE.exec(text);
        if (m) return text.slice(m.index + m[0].length).trim();     // '' = just the name
        return awake() ? text : null;
    }
    function heardName() {
        const r = lang() === 'Malayalam' ? 'പറയൂ?' : [firstName() ? 'Yes, ' + firstName() + '?' : 'Yes?', "I'm listening.", 'Go ahead.', 'Yes?'][Math.floor(Math.random() * 4)];
        if (!state.open) open(false);
        add('ai', r);
        speak(r);
    }

    // ---------- listening (speech to text) ----------
    // The mic is a switch: one tap turns it on and it stays on (also on other pages) until the user taps it
    // again. While on, it keeps listening; it only pauses while the assistant itself is talking.
    let listening = false, recog = null, discard = false, failCount = 0, restartTimer = null;
    function toggleMic() {
        prefs.mic = !prefs.mic;
        savePrefs();        if (prefs.mic) { failCount = 0; offlineMicSaid = false; prepareOfflineHearing(); liveStart().then(ok => { if (!ok) listen(); }); }
        else { liveStop(); discard = true; stopListening(); input.value = ''; }
        paint();
        live.textContent = prefs.mic ? t('micOn') : t('micOff');
        if (prefs.mic) add('note', t('micOn'));
    }    // ---------- hearing without internet ----------
    // Chrome / Edge normally send speech to an online service. Newer versions can recognise it on the device once the
    // language pack is installed (needs a tap while online). The phone app uses the phone's own offline speech.
    const SRC = () => window.SpeechRecognition || window.webkitSpeechRecognition;
    const srLangs = () => lang() === 'Malayalam' ? ['ml-IN'] : ['en-IN', 'en-GB', 'en-US'];
    let localLang = null, offlineMicSaid = false;
    async function localHearing() {
        const SR = SRC();
        if (!SR || !SR.available) return null;
        for (const l of srLangs()) {
            try { if (await SR.available({ langs: [l], processLocally: true }) === 'available') return (localLang = l); } catch (e) {}
        }
        return null;
    }
    // called from the mic button (a tap), while online: download the on-device language pack once
    function prepareOfflineHearing() {
        const SR = SRC();
        if (isApp || !SR || !SR.available || !SR.install || !navigator.onLine) return;
        (async () => {
            for (const l of srLangs()) {
                let st = 'unavailable';
                try { st = await SR.available({ langs: [l], processLocally: true }); } catch (e) {}
                if (st === 'available') return;
                if (st === 'downloadable' || st === 'downloading') {
                    try { await SR.install({ langs: [l], processLocally: true }); } catch (e) { console.warn('[assistant] offline hearing', e); }
                    return;
                }
            }
        })();
    }
    function offlineMic() {
        if (!offlineMicSaid) { offlineMicSaid = true; reply(t(isApp ? 'offlineNoMicApp' : 'offlineNoMic')); }
        paintMic();
    }
    addEventListener('online', () => { offlineMicSaid = false; if (prefs.mic) maybeListen(500); });
    addEventListener('offline', () => { if (prefs.mic && !isApp) { stopListening(); maybeListen(300); } });

    function maybeListen(delay) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { if (prefs.mic && !speaking && !listening && !leaving && !LV.on && !LV.connecting) listen(); }, delay || 300);
    }
    function micBlocked(msg) {
        prefs.mic = false; savePrefs();
        add('note', msg); paint();
    }
    async function listen() {
        if (listening || !prefs.mic || speaking || LV.on || LV.connecting) return;
        discard = false;
        const started = Date.now();
        const done = text => {
            listening = false; recog = null; paintMic();
            if (dock.dataset.mode === 'listening') setMode(busy ? 'working' : 'ready');
            if (discard) { discard = false; input.value = ''; maybeListen(400); return; }
            text = (text || '').trim();
            input.value = '';
            if (text) {
                failCount = 0;
                const cmd = wakeFilter(text);              // only "Hey Emma ..." / "Emma ..." is for me
                if (cmd === '') { wakeUntil = Date.now() + 9000; heardName(); }
                else if (cmd) { wakeUntil = Date.now() + 9000; userSays(cmd); }
            }
            else if (Date.now() - started < 1500) failCount++;     // ended at once: wait longer before trying again
            else failCount = 0;
            maybeListen(failCount ? Math.min(3000, 400 * 2 ** failCount) : 250);
        };
        if (isApp && P.SpeechRecognition) {
            try {
                const perm = await P.SpeechRecognition.requestPermissions();
                if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') { micBlocked(t('micDenied')); return; }
                if (!prefs.mic || speaking) return;
                listening = true; paintMic(); if (!busy) setMode('listening');                const r = await P.SpeechRecognition.start({ language: speechLang(), maxResults: 1, partialResults: false, popup: false });
                done((r && r.matches && r.matches[0]) || '');
            } catch (e) {
                if (!navigator.onLine && Date.now() - started < 4000) { listening = false; paintMic(); offlineMic(); maybeListen(8000); return; }
                done('');
            }
            return;
        }        const SR = SRC();
        if (!SR) { micBlocked(t('noMic')); input.focus(); return; }
        const offline = !navigator.onLine;
        if (offline && !(await localHearing())) { offlineMic(); return; }        // waits for the 'online' event
        if (listening || !prefs.mic || speaking) return;
        recog = new SR();
        recog.lang = offline ? localLang : speechLang();
        if (offline) { try { recog.processLocally = true; } catch (e) {} }
        recog.interimResults = true;
        recog.maxAlternatives = 1;
        let finalText = '';
        recog.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
                else interim += e.results[i][0].transcript;
            }
            const said = (finalText + interim).trim();
            if (!discard && (WAKE.test(said) || awake())) input.value = said;     // show only what is for me
        };        recog.onerror = e => {
            if (!navigator.onLine || e.error === 'network') { discard = true; recog = null; listening = false; offlineMic(); return; }
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { discard = true; micBlocked(t('micDenied')); }
        };        recog.onend = () => { if (!navigator.onLine && offlineMicSaid && !finalText) { listening = false; recog = null; paintMic(); return; } done(finalText || input.value); };
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
    function afterReply() {
        if (prefs.mic && !speaking) { if (wakeUntil > Date.now() - 60000) wakeUntil = Date.now() + 7000; maybeListen(300); }
    }

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
        const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [role=radio], [role=menuitem], [onclick], summary, [contenteditable="true"], label';
        // Styled tick boxes / choices hide the real box: use the visible label instead
        const all = [...document.querySelectorAll(sel)].filter(el => {
            if (el.tagName === 'LABEL') { const c = el.control; return !!c && ['radio', 'checkbox'].includes(c.type) && !visible(c) && visible(el); }
            return visible(el);
        });
        // Also things that are clickable only by script (cards, tiles, icons): shown with a hand pointer
        const picked = new Set(all);
        let extra = 0;
        for (const el of document.body.querySelectorAll('div, span, li, img, svg, td, tr, section, article, p, h2, h3, h4, figure')) {
            if (extra >= 60) break;
            if (picked.has(el) || el.closest(sel) || el.closest('#nxa-dock, #nxa-cursor, .nxa-btn')) continue;
            if (getComputedStyle(el).cursor !== 'pointer') continue;
            if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer') continue;
            if (!visible(el) || !labelOf(el)) continue;
            all.push(el); picked.add(el); extra++;
        }
        const vh = innerHeight;
        const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; };
        all.sort((a, b) => (inView(b) - inView(a)));
        const lines = [];
        let id = 0;
        for (const el of all.slice(0, 110)) {
            id++;
            elMap.set(id, el);
            const tag = el.tagName.toLowerCase();
            let kind = el.getAttribute('role') || tag;
            if (tag === 'input') kind = `input(${el.type || 'text'})`;
            if (tag === 'label') kind = el.control.type;
            if (tag === 'a') kind = 'link';
            let line = `[${id}] ${kind} "${labelOf(el)}"`;
            if ((tag === 'input' || tag === 'textarea') && !['password', 'checkbox', 'radio', 'file'].includes(el.type)) line += ` value="${String(el.value || '').slice(0, 60)}"`;
            if (el.type === 'password') line += ' (password: user must type it)';
            const box = tag === 'label' ? el.control : el;
            if (box.type === 'checkbox' || box.type === 'radio' || el.getAttribute('role') === 'checkbox') line += box.checked || el.getAttribute('aria-checked') === 'true' ? ' [checked]' : ' [not checked]';
            if (tag === 'select') line += ` selected="${(el.options[el.selectedIndex] || {}).text || ''}" options=${JSON.stringify([...el.options].slice(0, 12).map(o => o.text))}`;
            if (tag === 'a') { const h = el.getAttribute('href') || ''; if (h && !h.startsWith('#') && !h.startsWith('javascript')) line += ` -> ${h.slice(0, 60)}`; }
            if (el.disabled || el.getAttribute('aria-disabled') === 'true') line += ' (disabled)';
            if (el.getAttribute('aria-current') || el.classList.contains('active')) line += ' (current)';
            if (!inView(el)) line += ' (off screen)';
            lines.push(line);
        }
        const text = visibleText(3000);
        return { url: location.pathname.split('/').pop() || 'home.html', title: document.title, elements: lines, text,
            scroll: `${Math.round(scrollY)} of ${Math.max(0, document.documentElement.scrollHeight - innerHeight)}` };
    }

    // ---------- scrolling: whatever actually scrolls (a pop-up, the page, or a scrolling box inside it) ----------
    function scroller() {
        const canScroll = el => { const st = getComputedStyle(el); return /(auto|scroll|overlay)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 20 && visible(el); };
        const dialogs = [...document.querySelectorAll('.nx-fb-modal, .vis-modal, .cal-modal, .nx-cam-modal, [role=dialog], [aria-modal=true]')].filter(d => !d.closest('#nxa-dock') && visible(d));
        for (const d of dialogs.reverse()) {
            if (canScroll(d)) return d;
            const inner = [...d.querySelectorAll('*')].find(canScroll);
            if (inner) return inner;
        }
        const doc = document.scrollingElement || document.documentElement;
        if (doc.scrollHeight > innerHeight + 20 && getComputedStyle(document.body).overflowY !== 'hidden') return null;    // the page itself
        let best = null, area = 0;
        for (const el of document.querySelectorAll('main, section, div, ul, article')) {
            if (el.closest('#nxa-dock') || !canScroll(el)) continue;
            const r = el.getBoundingClientRect(), a = r.width * r.height;
            if (a > area) { area = a; best = el; }
        }
        return best;
    }
    // dir: up / down / top / bottom; screens: how far (0.35 = a bit, 0.8 = a screen, 2 = a lot). Returns where it ended up.
    async function scrollPage(dir, screens) {
        const el = scroller();
        const box = el || document.scrollingElement || document.documentElement;
        const height = el ? el.clientHeight : innerHeight;
        const before = box.scrollTop;
        const opts = top => ({ top, behavior: 'smooth' });
        if (dir === 'top') (el || window).scrollTo(opts(0));
        else if (dir === 'bottom') (el || window).scrollTo(opts(box.scrollHeight));
        else (el || window).scrollBy(opts((dir === 'up' ? -1 : 1) * height * (screens || 0.8)));
        await sleep(550);
        const max = Math.max(0, box.scrollHeight - box.clientHeight);
        const pos = box.scrollTop;
        return { moved: Math.abs(pos - before) > 4, atTop: pos <= 4, atBottom: pos >= max - 4,
            percent: max ? Math.round(pos / max * 100) : 100, where: el ? 'a scrolling box' : 'the page' };
    }
    function scrollWords(dir, r) {
        if (!r.moved && (dir === 'down' || dir === 'bottom') && r.atBottom) return "That's the bottom of the page.";
        if (!r.moved && (dir === 'up' || dir === 'top') && r.atTop) return "You're already at the top.";
        if (dir === 'top' || r.atTop) return 'Top of the page.';
        if (dir === 'bottom' || r.atBottom) return 'Bottom of the page.';
        return dir === 'up' ? 'Up we go.' : 'Scrolling down.';
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
        await sleep(450);
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
                    await sleep(450);
                } else if (a.do === 'type') {
                    if (el.type === 'password') { done.push(`did not type into password box ${name} (user must type it)`); continue; }
                    await moveTo(el); ripple();
                    el.focus({ preventScroll: true });
                    const text = String(a.text || '');
                    if (el.isContentEditable) { el.textContent = text; el.dispatchEvent(new Event('input', { bubbles: true })); }
                    else {
                        setValue(el, '');
                        for (let i = 1; i <= text.length; i++) { setValue(el, text.slice(0, i)); await sleep(text.length > 40 ? 5 : 16); if (stopFlag) break; }
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
                    const isOn = (el.tagName === 'LABEL' ? el.control.checked : el.checked) || el.getAttribute('aria-checked') === 'true';
                    if (!!a.on !== isOn) { ripple(); el.click(); }
                    unmark(el);
                    done.push(`${a.on ? 'ticked' : 'unticked'} ${name}`);
                } else if (a.do === 'scroll') {
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); await moveTo(el); unmark(el); }
                    else {
                        const r = await scrollPage(a.dir || 'down', a.screens);
                        done.push(`scrolled ${a.dir || 'down'} (${r.percent}% down the page${r.atBottom ? ', at the bottom' : ''}${r.atTop ? ', at the top' : ''})`);
                        continue;
                    }
                    await sleep(300);
                    done.push(`scrolled to ${name}`);
                } else if (a.do === 'go') {
                    const page = String(a.page || '').replace(/^\/+/, '').split(/[?#]/)[0];
                    if (!PAGES.includes(page)) { done.push(`unknown page ${a.page}`); continue; }
                    for (let i = 0; i < 40 && speaking; i++) await sleep(100);
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
    }    // ---------- offline answers from what is saved on this device ----------
    function offlineAnswer(q) {
        q = String(q || '').toLowerCase();
        const ml = lang() === 'Malayalam';
        const today = window.dayKey ? dayKey(new Date()) : '';
        if (/\b(time|date|day is it|today'?s date)\b|സമയം|തീയതി/.test(q)) {
            const d = new Date();
            return (ml ? 'ഇപ്പോൾ ' : "It's ") + d.toLocaleTimeString(ml ? 'ml-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' }) + ', ' + d.toLocaleDateString(ml ? 'ml-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) + '.';
        }
        if (/medicine|medication|tablet|pill|dose|drug|take today|മരുന്ന്|ഗുളിക/.test(q)) {
            const sch = window.storeGet && storeGet('neutrixSchedule');
            const doses = sch && window.dosesForDay ? dosesForDay(sch, today) : [];
            if (!doses.length) return ml ? 'ഈ ഉപകരണത്തിൽ ഇന്നത്തെ മരുന്നുകൾ സേവ് ചെയ്തിട്ടില്ല.' : "I don't have today's medicines saved on this device yet.";
            const slots = ['morning', 'afternoon', 'evening', 'night', 'unclear'], names = { morning: 'In the morning', afternoon: 'In the afternoon', evening: 'In the evening', night: 'At night', unclear: 'At a time to check' };
            const ticks = (sch.ticks && sch.ticks[today]) || {};
            const parts = slots.map(sl => {
                const ds = doses.filter(d => (d.slot || 'unclear') === sl);
                return ds.length ? `${names[sl]}: ${ds.map(d => `${d.medicine}${d.strength ? ' ' + d.strength : ''}${ticks[d.id] ? ' (taken)' : ''}`).join(', ')}.` : '';
            }).filter(Boolean);
            return `Today's medicines. ${parts.join(' ')}`;
        }
        if (/check[\s-]?ups?|appointment|follow[\s-]?up|next visit|review|പരിശോധന/.test(q)) {
            const ck = window.storeGet && storeGet('neutrixCheckups');
            const map = (ck && ck.content) || {};
            const md = map[lang()] || map.English || '';
            const next = md.split('\n').filter(l => /^###\s/.test(l)).map(l => {
                const h = l.replace(/^###\s*(📅\s*)?/, '').replace(/\*\*/g, '').trim();
                const m = h.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
                return m ? { iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, h } : null;
            }).filter(x => x && x.iso >= today).sort((a, b) => a.iso.localeCompare(b.iso))[0];
            if (!next) return ml ? 'ഈ ഉപകരണത്തിൽ വരാനിരിക്കുന്ന പരിശോധനകൾ സേവ് ചെയ്തിട്ടില്ല.' : "I don't have an upcoming check-up saved on this device.";
            return (ml ? 'അടുത്ത പരിശോധന: ' : 'Your next check-up: ') + next.h.replace(/\s+[—–]\s+/, ', ') + '.';
        }
        if (/exercise|workout|walk|വ്യായാമം/.test(q)) {
            const ex = window.storeGet && storeGet('neutrixExercises');
            const list = ((ex && ex.exercises) || []).map(e => e[ml ? 'name_ml' : 'name_en'] || e.name_en || e.name).filter(Boolean);
            if (!list.length) return ml ? 'ഈ ഉപകരണത്തിൽ വ്യായാമങ്ങൾ സേവ് ചെയ്തിട്ടില്ല.' : "I don't have your exercises saved on this device.";
            return (ml ? 'നിങ്ങളുടെ വ്യായാമങ്ങൾ: ' : 'Your exercises: ') + list.join(', ') + '.';
        }
        if (/what happened|my (condition|diagnosis|report|problem|illness)|summary|രോഗം|റിപ്പോർട്ട്/.test(q)) {
            const r = window.loadReport ? loadReport() : null;
            const sum = r && r.summaries && (r.summaries[lang()] || r.summaries.English);
            if (!sum) return null;
            const plain = sum.split('\n').filter(l => !/^\s*#/.test(l)).join(' ').replace(/[#*_>`|]/g, ' ').replace(/\s+/g, ' ').trim();
            const first = (plain.match(/[^.!?]+[.!?]/g) || [plain]).slice(0, 3).join(' ').trim();
            return (ml ? 'നിങ്ങളുടെ റിപ്പോർട്ടിൽ നിന്ന്: ' : 'From your report: ') + first.slice(0, 400);
        }
        return null;
    }

    // ---------- one turn with the AI ----------
    async function ask(message, results, step) {
        if (!navigator.onLine) {
            if (results) { add('note', t('offline')); return; }
            await reply(offlineAnswer(message) || t('offlineLimited'));
            return;
        }
        busy = true; stopFlag = false;
        setMode(results ? 'working' : 'thinking');
        let data;
        const slow = setTimeout(() => { if (busy) add('note', t('waking')); }, 6000);
        try {
            const res = await fetch(API(), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message || '', results: results || '',
                    history: state.history.filter(m => m.role !== 'note').slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text + (m.show ? '\n' + m.show : '') })),
                    page: snapshot(), detail: !!prefs.detail, language: lang(),
                    signed_in: localStorage.getItem('neutrix_authenticated') === 'true', name: firstName(), device: isApp ? 'Android app' : (innerWidth <= 720 ? 'phone browser' : 'computer browser')
                })
            });
            data = await res.json();
            clearTimeout(slow);
        } catch (e) {
            clearTimeout(slow);
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

    // ---------- Instant commands: done right here, no waiting for the AI ----------
    const NAV = [        ['care.html', /\b(my care|warning signs?|danger signs?|when to (go to|call|get) (hospital|help|emergency|ambulance)|emergency signs?|safety check|medicine safety|drug interactions?|interactions?|refills?|running (low|out)|diet( tips)?|food tips|what (should i|can i|to) eat)\b/],
        ['emergency-card.html', /\b(emergency (card|info|qr|id)|medical id|qr code|lock ?screen|wallet card|sos card)\b/],
        ['doctor-card.html', /\b(doctor card|doctor summary|one ?page summary|summary for (the |my |a )?(new )?doctor|medical card)\b/],
        ['caregiver.html', /\b(look(ing)? after|caregiver view|people i look after|family member'?s? (medicines|doses))\b/],
        ['family.html', /\b(family( sharing)?|share with (my )?(family|son|daughter|carer|caregiver)|sharing code|caregiver)\b/],
        ['privacy.html', /\b(privacy|consent|delete (all )?my data|my data)\b/],
        ['summary.html', /\b(ai summary|upload( my)?( \w+)? (reports?|discharge|bills?|documents?|files?|results?|papers?|prescriptions?)|scan( my)? (reports?|documents?)|discharge summary|summari[sz]e( my)? reports?)\b/],
        ['report.html', /\b(summary result|report result|my summary)\b/],
        ['schedule.html', /\b(medicine schedule|med schedule|schedule|medicine times?|pill times?|reminders?|time ?table)\b/],
        ['medplan.html', /\b(medicine plan|med ?plan|my medicines?|medicines?|medications?|tablets?|pills?)\b/],
        ['checkups.html', /\b(check ?ups?|appointments?|follow ?ups?|doctor visits?|next visit)\b/],
        ['tracking.html', /\b(recovery tracker|tracker|tracking|readings?|vitals?|log( my)? (bp|blood pressure|sugar|readings?))\b/],
        ['improvements.html', /\b(improvements?|compare( my)? (reports?|labs?)|lab comparison)\b/],
        ['exercise.html', /\b(exercises?|workouts?|physio(therapy)?|camera coach)\b/],
        ['briefing.html', /\b(ask (the )?doctor|doctor questions|questions for (the |my )?doctor|briefing)\b/],
        ['body3d.html', /\b(3 ?d( view| body| model)?|three ?d|body (view|map|scan|model)|human body|my body)\b/],
        ['progress.html', /\b(progress( report)?|overall progress)\b/],
        ['profile.html', /\b(profile|patient profile|my details|my info(rmation)?)\b/],
        ['issues.html', /\b(my issues|medical issues|issues|switch issue|change issue|my problems)\b/],
        ['index.html', /\b(dashboard|main menu|home screen|all tools|tools)\b/],
        ['home.html', /\b(website home|home ?page|about neutrix|main website)\b/],
        ['get-app.html', /\b(download( the)? app|get( the)? app|android app|install( the)? app)\b/]
    ];
    const PAGE_NAMES = { 'summary.html': 'AI Summary', 'report.html': 'your summary', 'schedule.html': 'your medicine schedule', 'medplan.html': 'your medicine plan',
        'checkups.html': 'your check-ups', 'tracking.html': 'the recovery tracker', 'improvements.html': 'your improvements', 'exercise.html': 'exercises',
        'briefing.html': 'Ask Doctor', 'progress.html': 'your progress report', 'body3d.html': 'the 3D body view', 'profile.html': 'your profile', 'issues.html': 'your medical issues',
        'index.html': 'the dashboard', 'home.html': 'the Neutrix home page', 'get-app.html': 'the app download page',
        'care.html': 'My Care', 'doctor-card.html': 'your Doctor Card', 'emergency-card.html': 'your Emergency Card', 'family.html': 'Family Sharing', 'caregiver.html': 'the people you look after', 'privacy.html': 'Privacy and consent' };
    const GO_WORDS = /^(open|go( to)?|take me( to)?|show( me)?|bring up|pull up|launch|start|navigate( to)?|switch to|jump to|let'?s go( to)?|i (want|need|wanna|would like)( to)?( go to| see| open| check| look at| use)?|can (you|u) (open|show)( me)?|where('?s| is)|check)\b/;
    const here = () => location.pathname.split('/').pop() || 'home.html';

    const replyOut = (text, opts) => reply(text, opts);
    async function reply(text, opts) {
        add('ai', text);
        const p = speak(text);
        if (opts && opts.wait) await Promise.race([p, sleep(opts.wait)]);
    }
    async function goPage(page) {
        const name = PAGE_NAMES[page] || page;
        if (here() === page) { await reply(`You're already on ${name}.`); return; }
        await reply(`Opening ${name}.`, { wait: 3800 });      // say it first: a new page can't start talking by itself
        location.href = page;
    }
    function findByLabel(words) {
        snapshot();
        const want = words.toLowerCase().replace(/\b(the|button|link|tab|option|box)\b/g, '').replace(/\s+/g, ' ').trim();
        if (!want) return null;
        let best = null, score = 0;
        elMap.forEach((el, id) => {
            const l = labelOf(el).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
            if (!l) return;
            const sc = l === want ? 3 : l.startsWith(want) ? 2 : l.includes(want) ? 1 : 0;
            if (sc > score) { score = sc; best = id; }
        });
        return best;
    }
    function pageText() { return visibleText(1400).replace(/\n/g, '. ').replace(/\.\s*\./g, '.'); }
    // Everything a person can read on the page (not the menus or this assistant), top to bottom
    function visibleText(max) {
        const root = document.querySelector('main') || document.body;
        let txt = root.innerText || '';
        root.querySelectorAll('#nxa-dock, .ehr-navbar, nav, header, footer, .nx-appbar, .nx-tabbar, .chat-panel').forEach(el => {
            const t = (el.innerText || '').trim();
            if (t && t.length > 3) txt = txt.split(t).join(' ');
        });
        return txt.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
            .filter((l, i, a) => a.indexOf(l) === i).join('\n').slice(0, max);
    }
    function setZoom(z) {
        prefs.zoom = Math.max(0.8, Math.min(1.6, Math.round(z * 10) / 10));
        savePrefs();
        document.body.style.zoom = prefs.zoom === 1 ? '' : String(prefs.zoom);
    }

    // Sending a problem report (same as the Report button): types it into the form so it can be seen, then sends
    let awaitingReport = false;
    async function sendReport(what, quiet) {
        awaitingReport = false;
        stopFlag = false;
        const reply = quiet ? (async () => {}) : replyOut;
        if (!(window.NxFeedback && NxFeedback.send)) { await reply("Sorry, reporting isn't available on this page."); return 'reporting is not available on this page'; }
        let box = document.querySelector('.nx-fb-modal #nxFbText');
        if (!box && NxFeedback.openReport) { NxFeedback.openReport(); await sleep(150); box = document.querySelector('.nx-fb-modal #nxFbText'); }
        const btn = box && box.closest('.nx-fb-modal').querySelector('[data-a="send"]');
        if (box && btn) {
            snapshot();
            const id = [...elMap.entries()].find(([, el]) => el === box);
            if (id) await run([{ do: 'type', id: id[0], text: what }]);
            if (box.value.trim() !== what.trim()) { box.value = what; box.dispatchEvent(new Event('input', { bubbles: true })); }
            const sid = [...elMap.entries()].find(([, el]) => el === btn);
            if (!quiet) add('ai', 'Sending your report…');
            if (sid) { await moveTo(btn); ripple(); unmark(btn); }
            btn.click();
            // wait for the form to say it was sent (or failed)
            for (let i = 0; i < 40; i++) {
                await sleep(250);
                const msg = document.querySelector('.nx-fb-modal .nx-fb-msg');
                if (!document.querySelector('.nx-fb-modal') || (msg && /ok/.test(msg.className))) { setTimeout(hideCursor, 800); await reply('Sent. Thanks' + (firstName() ? ', ' + firstName() : '') + ', the team will look at it.'); return 'sent'; }
                if (msg && /err/.test(msg.className) && msg.textContent) { hideCursor(); await reply("I couldn't send it: " + msg.textContent); return 'not sent: ' + msg.textContent; }
            }
            hideCursor();
            await reply("It's taking a while to send. Check the form, or try again in a moment.");
            return 'still sending';
        }
        try { await NxFeedback.send('report', 0, what); await reply('Sent. Thanks' + (firstName() ? ', ' + firstName() : '') + ', the team will look at it.'); return 'sent'; }
        catch (e) { await reply("I couldn't send the report. Please check you're signed in and online."); return 'not sent: not signed in or offline'; }
    }

    // Returns true when the command was handled here
    async function quick(cmd, raw) {
        if (awaitingReport) {
            if (!document.querySelector('.nx-fb-modal')) awaitingReport = false;            // form was closed
            else if (/^(cancel|never ?mind|forget it|no|stop|close( it)?)$/.test(cmd)) { awaitingReport = false; document.querySelectorAll('.nx-fb-modal').forEach(x => x.remove()); await reply('Okay, cancelled.'); return true; }
            else { await sendReport(raw || cmd); return true; }
        }
        const c = cmd.replace(/^(can|could|would) (you|u) (please )?/, '').replace(/^(hey|ok|okay|yo) /, '');
        // Report a problem with the app: "report that the mic doesn't work" sends it at once;
        // "I want to report" opens the form and the next thing the user says is typed in and sent
        if (/\b(report|complain|complaint|feedback|bug)\b/.test(c) && !/\b(upload|my reports?\b|medical|lab|summary|result|discharge|scan|progress)\b/.test(c)) {
            const src = (raw || cmd).replace(/^\s*(?:hey |ok |okay )?(?:emma|ema|neutrix)[\s,.!:-]*/i, '').replace(/[.!?]+$/, '');
            const m2 = /\b(?:report|complain(?: about)?|complaint|feedback|bug)\b(?:\s+(?:that|about|saying|this|:|-))?\s+(.{4,})$/i.exec(src);
            let what = m2 ? m2[1].trim() : '';
            if (/^(a |an |the |some )?(problem|issue|bug|error|something|complaint|feedback)s?( (with|on|in|about) (the |this )?(app|site|website|neutrix|page))?$/.test(what) || /^(a |an )?(problem|issue|bug)$/.test(what)) what = '';
            if (what) { await sendReport(what); return true; }
            if (window.NxFeedback && NxFeedback.openReport) {
                document.querySelectorAll('.nx-fb-modal').forEach(x => x.remove());
                NxFeedback.openReport();
                awaitingReport = true;
                wakeUntil = Date.now() + 20000;          // no need to say "Emma" again for the answer
                await reply('Sure. What went wrong? Just say it and I’ll send it.');
                return true;
            }
        }
        if (/\b(rate|rating|review)\b.*\b(app|neutrix|website|site|you)\b|^rate( us)?$/.test(c) && window.NxFeedback && NxFeedback.openRating) {
            NxFeedback.openRating(); await reply('Rating form is open.'); return true;
        }
        // Pages
        const target = NAV.find(([, re]) => re.test(c));
        if (target) {
            // Only a plain "open X". Anything more ("... and tell me / and add ...") goes to the AI, which opens the page and carries on
            const left = c.replace(GO_WORDS, ' ').replace(target[1], ' ').replace(/\b(my|the|a|page|screen|section|tab|please|now|for me|up|to|in|on)\b/g, ' ').trim();
            const words = left ? left.split(/\s+/).length : 0;
            if ((GO_WORDS.test(c) && words <= 1) || words === 0) { await goPage(target[0]); return true; }
        }
        // Scrolling, back, reload
        let m;
        const NUM = { one: 1, once: 1, two: 2, twice: 2, three: 3, four: 4, five: 5 };
        if ((m = /^(?:scroll|go|move|page|keep scrolling|swipe)?\s*(down|up)(?: the page| this page)?(?:\s+(a (?:little )?bit|a little|slightly|more|a lot|a page|one page|fully|(\w+) times|twice|once))?$/.exec(c))
            || (m = /^(page) (down|up)$/.exec(c) && [c, c.split(' ')[1]])
            || (m = /^(keep scrolling|scroll more|more|continue scrolling|next part)$/.exec(c) && [c, 'down'])) {
            const dir = m[1] === 'up' ? 'up' : 'down';
            const how = m[2] || '';
            const times = NUM[m[3]] || parseInt(m[3], 10) || (/twice/.test(how) ? 2 : 1);
            const screens = /bit|little|slight/.test(how) ? 0.35 : /lot|fully/.test(how) ? 2.5 : 0.8;
            let r;
            for (let i = 0; i < Math.min(times, 6); i++) r = await scrollPage(dir, screens);
            await reply(scrollWords(dir, r));
            return true;
        }
        if (/^(scroll |go |jump |take me )?(back )?(to (the )?)?(very )?(top|bottom|end|start|beginning)( of (the |this )?page)?$/.test(c)) {
            const dir = /top|start|beginning/.test(c) ? 'top' : 'bottom';
            await reply(scrollWords(dir, await scrollPage(dir))); return true;
        }
        if (/^(go )?back$|^(previous|last) page$|^go to (the )?previous page$/.test(c)) { await reply('Going back.', { wait: 900 }); history.back(); return true; }
        if (/^(refresh|reload)( the)?( page)?$/.test(c)) { await reply('Refreshing.', { wait: 800 }); location.reload(); return true; }
        // Look and language
        if ((m = /\b(dark|night|light|day) (mode|theme)\b|^(dark|light)$/.exec(c))) {
            const wantDark = /dark|night/.test(c), isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const tb = document.getElementById('themeToggle');
            if (wantDark !== isDark && tb) tb.click();
            await reply(wantDark ? 'Dark mode on.' : 'Light mode on.'); return true;
        }
        if (/\b(malayalam|മലയാളം)\b/.test(c) && /\b(switch|change|speak|talk|language|in|to)\b|^malayalam$/.test(c) || /\benglish\b/.test(c) && /\b(switch|change|speak|talk|language|to)\b|^english$/.test(c)) {
            const wantMl = /malayalam|മലയാളം/.test(c), lb = document.getElementById('langToggle');
            if (lb && wantMl !== (lang() === 'Malayalam')) lb.click();
            await reply(wantMl ? 'ശരി, ഇനി മലയാളത്തിൽ.' : 'Switched to English.'); return true;
        }
        if (/\b(bigger|larger|increase|zoom in)\b.*\b(text|font|page|screen|everything)?\b/.test(c) && /\b(text|font|zoom|page|screen|everything)\b/.test(c)) { setZoom((prefs.zoom || 1) + 0.15); await reply('Text is bigger.'); return true; }
        if (/\b(smaller|decrease|zoom out|reduce)\b/.test(c) && /\b(text|font|zoom|page|screen)\b/.test(c)) { setZoom((prefs.zoom || 1) - 0.15); await reply('Text is smaller.'); return true; }
        if (/\b(normal|reset|default)\b.*\b(text|size|zoom)\b/.test(c)) { setZoom(1); await reply('Back to normal size.'); return true; }
        // Reading
        if (/\b(read|tell me)\b.*\b(page|screen|this)\b|what('?s| is) on (the |this |my )?(page|screen)/.test(c)) {
            const txt = pageText();
            add('ai', txt ? 'Reading the page.' : "There's nothing to read here.");
            if (txt) { const was = prefs.voice; prefs.voice = true; await speak(txt); prefs.voice = was; }
            return true;
        }
        // Mic, time, help
        if (/^(mute|unmute)?( the)? ?(mic|microphone)( off)?$|^stop listening$|^mute( yourself)?$/.test(c) && prefs.mic) { await reply('Mic off. Tap the mic when you need me.'); toggleMic(); return true; }
        if (/\b(what('?s| is) the time|what time is it|time now)\b/.test(c)) { await reply(`It's ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`); return true; }
        if (/\b(what('?s| is) (the |today'?s )?date|what day is it|today'?s date)\b/.test(c)) { await reply(`It's ${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}.`); return true; }
        // "Click / press / tap ..." something on the screen
        if ((m = /^(click|press|tap|hit|select|choose|push)( on)? (.+)$/.exec(c))) {
            const id = findByLabel(m[3]);
            if (id) {
                const el = elMap.get(id);
                if (!RISKY.test(labelOf(el))) { add('ai', `Pressing ${labelOf(el)}.`); speak(`Pressing ${labelOf(el)}.`); await run([{ do: 'click', id }]); setTimeout(hideCursor, 1500); return true; }
            }
        }
        return false;
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
        const cmd = text.trim().toLowerCase().replace(/[.!?,]+/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').replace(/^(please|hey emma|emma|hey neutrix|neutrix|ok|okay)\s+/, '').replace(/\s+please$/, '');
        const WHO = '(?:(?:the|my|this) )?(yourself|urself|you|emma|neutrix assistant|neutrix|assistant|panel|chat|window|it)';
        if (new RegExp(`^(un ?extend|un ?expand|collapse|minimi[sz]e|shrink|hide|fold|close up|go small|get small|make ${WHO} small(er)?|smaller)( ${WHO})?( down)?$`).test(cmd) || /^(ചെറുതാക്കൂ|ചുരുക്കൂ)/.test(cmd)) {
            add('user', text); setExpanded(false); return;
        }
        if (new RegExp(`^(extend|expand|un ?collapse|unfold|open( up)?|show|maximi[sz]e|enlarge|make ${WHO} (big|bigger|large)|bigger)( ${WHO})?( up)?$`).test(cmd) || /^(വലുതാക്കൂ|തുറക്കൂ)/.test(cmd)) {
            add('user', text); setExpanded(true); return;
        }
        if (!awaitingReport && /^(stop|cancel|be quiet|shut up|നിർത്ത്|നിർത്തൂ)\.?$/i.test(text.trim())) { add('user', text); stopAll(); add('ai', t('stopped')); return; }
        if (busy) stopFlag = true;
        add('user', text);
        if (!busy) stopFlag = false;
        const toAI = () => (LV.ready ? liveSendText(text) : ask(text, '', 0));
        quick(cmd, text.trim()).then(done => { if (!done) toAI(); }).catch(e => { console.warn('[assistant]', e); toAI(); });
    }
    function stopAll(silent) {
        stopFlag = true;
        stopSpeaking();
        liveStopAudio();
        if (listening) { discard = true; stopListening(); }
        state.pending = null;
        save();
        askBox = null;
        if (log) renderLog();
        setMode('ready');
        hideCursor();
        if (prefs.mic) maybeListen(600);
    }


    // =====================================================================
    // Gemini Live: real-time voice conversation with Google's talking AI.
    // The browser streams the microphone to Google and plays the answer as it comes (about a second),
    // and the user can talk over it. The AI uses the website through "tools" (the functions below).
    // Our server only hands out a short-lived pass, so the API key never reaches the browser.
    // If Live isn't available, the older way (speech-to-text + /api/assistant + voice) is used.
    // =====================================================================
    const LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
    const LV = { ws: null, on: false, ready: false, connecting: false, ctxIn: null, ctxOut: null, stream: null, node: null, srcNode: null,
        playAt: 0, sources: [], speaking: false, userText: '', aiText: '', userMsg: null, aiMsg: null, failedUntil: 0, retries: 0, model: '' };
    const PAGE_LIST = PAGES;
    const obj = (props, req) => ({ type: 'OBJECT', properties: props || {}, required: req || [] });
    const LIVE_TOOLS = [{ functionDeclarations: [
        { name: 'get_page', description: 'See the screen now: page name, visible text (the user’s data is here) and a numbered list of things you can press or type into.', parameters: obj() },
        { name: 'click', description: 'Press a button, link, tab, card, menu or choice (number from get_page).', parameters: obj({ id: { type: 'INTEGER' }, confirmed: { type: 'BOOLEAN', description: 'true only after the user said yes to a risky action (delete, sign out, send...)' } }, ['id']) },
        { name: 'type_text', description: 'Type into a box (replaces what is there).', parameters: obj({ id: { type: 'INTEGER' }, text: { type: 'STRING' } }, ['id', 'text']) },
        { name: 'select_option', description: 'Choose an option in a dropdown.', parameters: obj({ id: { type: 'INTEGER' }, option: { type: 'STRING' } }, ['id', 'option']) },
        { name: 'set_checkbox', description: 'Tick or untick a checkbox / choice.', parameters: obj({ id: { type: 'INTEGER' }, on: { type: 'BOOLEAN' } }, ['id', 'on']) },
        { name: 'scroll_page', description: 'Scroll the page (or the open pop-up) up or down.', parameters: obj({ direction: { type: 'STRING', enum: ['up', 'down', 'top', 'bottom'] }, amount: { type: 'STRING', enum: ['a_bit', 'one_screen', 'a_lot'] } }, ['direction']) },
        { name: 'scroll_to', description: 'Scroll until a thing from get_page is on screen.', parameters: obj({ id: { type: 'INTEGER' } }, ['id']) },
        { name: 'open_page', description: 'Open a page of the Neutrix website. The conversation carries on there.', parameters: obj({ page: { type: 'STRING', enum: PAGE_LIST } }, ['page']) },
        { name: 'go_back', description: 'Go back to the previous page.', parameters: obj() },
        { name: 'send_report', description: 'Send a problem report about the app to the Neutrix team.', parameters: obj({ message: { type: 'STRING' } }, ['message']) },
        { name: 'set_theme', description: 'Dark or light look.', parameters: obj({ mode: { type: 'STRING', enum: ['dark', 'light'] } }, ['mode']) },
        { name: 'set_language', description: 'Website language.', parameters: obj({ language: { type: 'STRING', enum: ['English', 'Malayalam'] } }, ['language']) },
        { name: 'set_text_size', description: 'Make the website text bigger, smaller or normal.', parameters: obj({ size: { type: 'STRING', enum: ['bigger', 'smaller', 'normal'] } }, ['size']) },
        { name: 'show_conversation', description: 'Open (true) or hide (false) your own conversation panel ("extend / unextend yourself").', parameters: obj({ open: { type: 'BOOLEAN' } }, ['open']) },
        { name: 'stop_listening', description: 'Turn the microphone off (when the user says stop listening / mute / go to sleep).', parameters: obj() }
    ] }];

    const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    const unb64 = str => { const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
    const MIC_WORKLET = `class NxMic extends AudioWorkletProcessor {
        constructor() { super(); this.buf = []; this.step = sampleRate / 16000; this.acc = 0; }
        process(inputs) {
            const ch = inputs[0] && inputs[0][0];
            if (ch) for (let i = 0; i < ch.length; i++) { this.acc += 1; if (this.acc >= this.step) { this.acc -= this.step; this.buf.push(ch[i]); } }
            if (this.buf.length >= 1600) {
                const out = new Int16Array(this.buf.length); let sum = 0;
                for (let i = 0; i < this.buf.length; i++) { const v = Math.max(-1, Math.min(1, this.buf[i])); sum += v * v; out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
                this.port.postMessage({ pcm: out.buffer, rms: Math.sqrt(sum / this.buf.length) }, [out.buffer]);
                this.buf = [];
            }
            return true;
        }
    }
    registerProcessor('nx-mic', NxMic);`;

    // Turn the Live conversation on. Returns false if it can't (then the old way is used).
    // The user's first name (from their profile, or their account), so Emma can call them by it
    function firstName() {
        let n = '';
        try { n = (JSON.parse(localStorage.getItem('neutrix_hospital_profile') || '{}').patientName || '').trim(); } catch (e) {}
        n = n || (localStorage.getItem('neutrix_patient_name') || '').trim();
        try { n = n || ((window.firebase && firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.displayName) || '').trim(); } catch (e) {}
        n = n.replace(/^(mr|mrs|ms|miss|dr|shri|smt)\.?\s+/i, '').split(/\s+/)[0] || '';
        return /^[\p{L}][\p{L}'\-]{0,30}$/u.test(n) ? n.charAt(0).toUpperCase() + n.slice(1) : '';
    }

    async function liveStart() {
        if (LV.on || LV.connecting) return true;
        if (!navigator.onLine || Date.now() < LV.failedUntil || !window.WebSocket || !window.AudioWorkletNode || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return false;
        LV.connecting = true;
        setMode('thinking');
        try {
            const res = await fetch(API().replace(/\/api\/assistant$/, '/api/assistant/live'), { method: 'POST' });
            if (!res.ok) throw new Error('live pass ' + res.status);
            const pass = await res.json();
            if (!pass.token || !(pass.models || []).length) throw new Error('no live model');
            // Microphone (echo cancellation so it doesn't hear itself)
            LV.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
            if (!prefs.mic) { liveStop(); return true; }
            LV.ctxOut = LV.ctxOut || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            LV.ctxIn = new (window.AudioContext || window.webkitAudioContext)();
            const url = URL.createObjectURL(new Blob([MIC_WORKLET], { type: 'application/javascript' }));
            await LV.ctxIn.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);
            LV.srcNode = LV.ctxIn.createMediaStreamSource(LV.stream);
            LV.node = new AudioWorkletNode(LV.ctxIn, 'nx-mic');
            LV.node.port.onmessage = e => liveMicChunk(e.data);
            LV.srcNode.connect(LV.node);
            if (LV.ctxIn.state === 'suspended') LV.ctxIn.resume().catch(() => {});
            if (LV.ctxOut.state === 'suspended') LV.ctxOut.resume().catch(() => {});
            // Connect: try the models this key can use, best first
            for (const model of pass.models) {
                if (await liveConnect(pass, model)) { LV.connecting = false; return true; }
            }
            throw new Error('no live model accepted the connection');
        } catch (e) {
            console.warn('[assistant] Gemini Live not available, using the standard voice mode', e);
            const denied = e && /NotAllowed|Permission/i.test(e.name + ' ' + e.message);
            liveStop();
            LV.connecting = false;
            if (denied) { micBlocked(t('micDenied')); return true; }
            LV.failedUntil = Date.now() + 5 * 60 * 1000;
            setMode('ready');
            return false;
        }
    }
    function liveConnect(pass, model) {
        return new Promise(resolve => {
            let settled = false;
            const done = ok => { if (!settled) { settled = true; clearTimeout(timer); resolve(ok); } };
            const ws = new WebSocket(LIVE_URL + '?access_token=' + encodeURIComponent(pass.token));
            const timer = setTimeout(() => { try { ws.close(); } catch (e) {} done(false); }, 9000);
            LV.ws = ws;
            LV.model = model;
            ws.onopen = () => {
                const handle = sessionStorage.getItem('nxLiveHandle');
                const setup = {
                    model: 'models/' + model,
                    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: pass.voice || 'Leda' } } } },
                    systemInstruction: { parts: [{ text: pass.instructions + `\nNow: the user is on ${here()} ("${document.title}"). Website language: ${lang()}. Signed in: ${localStorage.getItem('neutrix_authenticated') === 'true'}. User's first name: ${firstName() || '(not known: use no name)'}. Device: ${isApp ? 'Android app' : (innerWidth <= 720 ? 'phone' : 'computer')}.` }] },
                    tools: LIVE_TOOLS,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    contextWindowCompression: { slidingWindow: {} },
                    sessionResumption: handle ? { handle } : {}
                };
                if (/native-audio/.test(model)) setup.proactivity = { proactiveAudio: true };      // lets it ignore talk that isn't for it
                ws.send(JSON.stringify({ setup }));
            };
            ws.onmessage = async ev => {
                let msg;
                try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : await ev.data.text()); } catch (e) { return; }
                if (msg.setupComplete) {
                    LV.on = true; LV.ready = true; LV.retries = 0;
                    done(true);
                    liveReady();
                    return;
                }
                liveMessage(msg);
            };
            ws.onerror = () => done(false);
            ws.onclose = ev => {
                const wasReady = LV.ready && LV.ws === ws;
                if (LV.ws === ws) { LV.ready = false; LV.ws = null; }
                if (!settled) { console.warn('[assistant] Live closed during setup', model, ev.code, ev.reason); done(false); return; }
                if (wasReady && prefs.mic && !leaving) {             // dropped (or Google asked to reconnect): carry on with the same conversation
                    LV.on = false;
                    if (LV.retries++ < 4) setTimeout(() => { liveStopAudio(); liveStart().then(ok => { if (!ok) maybeListen(300); }); }, 800);
                    else { liveStop(); maybeListen(300); }
                }
            };
        });
    }
    function liveReady() {
        setMode('listening');
        paint();
        live.textContent = t('micOn');
        if (LV.ctxOut && LV.ctxOut.state === 'suspended') {
            add('note', t('tapToHear'));
            const wake = () => { LV.ctxOut && LV.ctxOut.resume().catch(() => {}); LV.ctxIn && LV.ctxIn.resume().catch(() => {}); };
            document.addEventListener('pointerdown', wake, { once: true, capture: true });
            document.addEventListener('keydown', wake, { once: true, capture: true });
        }
        // A task that opened this page carries on here
        const cont = sessionStorage.getItem('nxLiveContinue');
        if (cont) {
            sessionStorage.removeItem('nxLiveContinue');
            liveSend({ clientContent: { turns: [{ role: 'user', parts: [{ text: `(System note, not the user: the page ${here()} has opened. If you were in the middle of doing something for the user, call get_page and carry on. Otherwise say nothing.)` }] }], turnComplete: true } });
        }
    }
    function liveSend(o) { try { if (LV.ws && LV.ws.readyState === 1) LV.ws.send(JSON.stringify(o)); } catch (e) {} }
    function liveSendText(text) {
        LV.userMsg = state.history[state.history.length - 1] || null;     // already shown by userSays
        liveSend({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'Emma, ' + text }] }], turnComplete: true } });
        setMode('thinking');
    }
    function liveMicChunk({ pcm, rms }) {
        if (!LV.ready || !prefs.mic) return;
        if ((LV.speaking || speaking) && rms < 0.06) return;      // while it talks, only clear (loud) speech can interrupt it
        liveSend({ realtimeInput: { audio: { data: b64(pcm), mimeType: 'audio/pcm;rate=16000' } } });
    }
    function livePlay(data) {
        const ctx = LV.ctxOut;
        if (!ctx) return;
        const u = unb64(data);
        const pcm = new Int16Array(u.buffer, u.byteOffset, Math.floor(u.byteLength / 2));
        const buf = ctx.createBuffer(1, pcm.length, 24000);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
        const src = ctx.createBufferSource();
        src.buffer = buf; src.connect(ctx.destination);
        LV.playAt = Math.max(LV.playAt, ctx.currentTime + 0.04);
        src.start(LV.playAt);
        LV.playAt += buf.duration;
        LV.sources.push(src);
        LV.speaking = true;
        setMode('speaking');
        src.onended = () => {
            LV.sources = LV.sources.filter(x => x !== src);
            if (!LV.sources.length) { LV.speaking = false; if (LV.ready) setMode('listening'); }
        };
    }
    function liveStopAudio() {
        LV.sources.forEach(x => { try { x.stop(); } catch (e) {} });
        LV.sources = []; LV.playAt = 0; LV.speaking = false;
    }
    // Words of the conversation, shown in the panel as they come
    function liveWords(role, piece) {
        if (!piece) return;
        if (role === 'user') {
            LV.userText += piece;
            return;                                         // shown only if the AI answers (room talk stays private)
        }
        if (!LV.aiMsg) {
            const said = LV.userText.trim();
            if (said && !(LV.userMsg && LV.userMsg.role === 'user')) { add('user', said); }
            LV.userMsg = null;
            LV.userText = '';
            state.history.push({ role: 'ai', text: '' });
            LV.aiMsg = state.history[state.history.length - 1];
        }
        LV.aiMsg.text += piece;
        LV.aiMsg.text = LV.aiMsg.text.replace(/\s+/g, ' ');
        save();
        renderLog();
        if (dock.classList.contains('collapsed')) dock.querySelector('.nxa-handle').classList.add('new');
    }
    async function liveMessage(msg) {
        const sc = msg.serverContent;
        if (sc) {
            if (sc.interrupted) liveStopAudio();
            if (sc.inputTranscription) liveWords('user', sc.inputTranscription.text);
            if (sc.outputTranscription) liveWords('ai', sc.outputTranscription.text);
            ((sc.modelTurn && sc.modelTurn.parts) || []).forEach(p => { if (p.inlineData && p.inlineData.data) livePlay(p.inlineData.data); });
            if (sc.turnComplete) {
                if (LV.aiMsg) live.textContent = LV.aiMsg.text;
                LV.aiMsg = null; LV.userText = ''; LV.userMsg = null;
                if (!LV.speaking && LV.ready) setMode('listening');
            }
        }
        if (msg.toolCall && msg.toolCall.functionCalls) {
            const said = LV.userText.trim();
            if (said) { add('user', said); LV.userText = ''; }
            setMode('working');
            const responses = [];
            for (const fc of msg.toolCall.functionCalls) {
                let result;
                try { result = await liveTool(fc.name, fc.args || {}); }
                catch (e) { result = { error: String(e && e.message || e) }; }
                responses.push({ id: fc.id, name: fc.name, response: typeof result === 'object' ? result : { result } });
            }
            liveSend({ toolResponse: { functionResponses: responses } });
            if (LV.navigateTo) {                             // open the page after the AI has had a moment to say so
                const go = LV.navigateTo; LV.navigateTo = null;
                for (let i = 0; i < 25 && !LV.speaking; i++) await sleep(100);
                for (let i = 0; i < 40 && LV.speaking; i++) await sleep(100);
                if (go === '__back') history.back(); else location.href = go;
            } else setTimeout(hideCursor, 1500);
        }
        if (msg.sessionResumptionUpdate && msg.sessionResumptionUpdate.newHandle) {
            try { sessionStorage.setItem('nxLiveHandle', msg.sessionResumptionUpdate.newHandle); } catch (e) {}
        }
        if (msg.goAway) console.log('[assistant] Live: reconnecting soon');
    }
    const idOf = el => { const e = [...elMap.entries()].find(([, x]) => x === el); return e ? e[0] : null; };
    async function liveTool(name, a) {
        stopFlag = false;
        const one = async action => (await run([action])) || 'done';
        const has = id => elMap.has(Number(id)) && document.contains(elMap.get(Number(id)));
        const stale = { error: 'That number is not on the screen any more. Call get_page again.' };
        switch (name) {
            case 'get_page': {
                const s = snapshot();
                return { page: s.url, title: s.title, scroll: s.scroll, visible_text: s.text, things_you_can_use: s.elements.join('\n') };
            }
            case 'click': {
                if (!has(a.id)) return stale;
                const el = elMap.get(Number(a.id));
                if (RISKY.test(labelOf(el)) && !a.confirmed) return { error: `"${labelOf(el)}" can't be undone: ask the user "Should I ...?" first, then call click again with confirmed=true if they say yes.` };
                const r = await one({ do: 'click', id: Number(a.id) });
                if (leaving) { sessionStorage.setItem('nxLiveContinue', '1'); return { result: r, note: 'A new page is opening; you will continue there.' }; }
                return { result: r };
            }
            case 'type_text': if (!has(a.id)) return stale; return { result: await one({ do: 'type', id: Number(a.id), text: String(a.text || '') }) };
            case 'select_option': if (!has(a.id)) return stale; return { result: await one({ do: 'select', id: Number(a.id), text: String(a.option || '') }) };
            case 'set_checkbox': if (!has(a.id)) return stale; return { result: await one({ do: 'check', id: Number(a.id), on: !!a.on }) };
            case 'scroll_to': if (!has(a.id)) return stale; return { result: await one({ do: 'scroll', id: Number(a.id) }) };
            case 'scroll_page': {
                const dir = ['up', 'down', 'top', 'bottom'].includes(a.direction) ? a.direction : 'down';
                const r = await scrollPage(dir, a.amount === 'a_bit' ? 0.35 : a.amount === 'a_lot' ? 2.5 : 0.8);
                return { result: scrollWords(dir, r), percent_down_the_page: r.percent, at_top: r.atTop, at_bottom: r.atBottom };
            }
            case 'open_page': {
                const page = String(a.page || '').replace(/^\/+/, '');
                if (!PAGES.includes(page)) return { error: 'Unknown page. Use one of: ' + PAGES.join(', ') };
                if (here() === page) return { result: 'Already on that page.' };
                sessionStorage.setItem('nxLiveContinue', '1');
                LV.navigateTo = page;
                return { result: `Opening ${page}. The conversation continues on the new page.` };
            }
            case 'go_back': sessionStorage.setItem('nxLiveContinue', '1'); LV.navigateTo = '__back'; return { result: 'Going back.' };
            case 'send_report': return { result: await sendReport(String(a.message || '').trim() || 'Problem reported by voice', true) };
            case 'set_theme': {
                const wantDark = a.mode === 'dark', isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const tb = document.getElementById('themeToggle');
                if (wantDark !== isDark && tb) tb.click();
                return { result: (wantDark ? 'Dark' : 'Light') + ' mode on.' };
            }
            case 'set_language': {
                const wantMl = a.language === 'Malayalam', lb = document.getElementById('langToggle');
                if (lb && wantMl !== (lang() === 'Malayalam')) lb.click();
                return { result: 'Website language: ' + (wantMl ? 'Malayalam' : 'English') };
            }
            case 'set_text_size': setZoom(a.size === 'normal' ? 1 : (prefs.zoom || 1) + (a.size === 'smaller' ? -0.15 : 0.15)); return { result: 'Text size changed.' };
            case 'show_conversation': setExpanded(!!a.open); return { result: a.open ? 'Panel open.' : 'Panel hidden.' };
            case 'stop_listening': setTimeout(() => { if (prefs.mic) toggleMic(); }, 2500); return { result: 'Microphone will turn off after you speak.' };
        }
        return { error: 'Unknown tool ' + name };
    }
    function liveStop() {
        LV.on = false; LV.ready = false; LV.connecting = false;
        try { if (LV.ws) LV.ws.close(); } catch (e) {}
        LV.ws = null;
        liveStopAudio();
        try { if (LV.node) LV.node.disconnect(); if (LV.srcNode) LV.srcNode.disconnect(); } catch (e) {}
        try { if (LV.stream) LV.stream.getTracks().forEach(tr => tr.stop()); } catch (e) {}
        try { if (LV.ctxIn) LV.ctxIn.close(); } catch (e) {}
        LV.node = LV.srcNode = LV.stream = LV.ctxIn = null;
        if (dock && dock.dataset.mode !== 'ready') setMode('ready');
    }
    window.addEventListener('pagehide', () => { try { if (LV.ws) LV.ws.close(); } catch (e) {} });

    // ---------- start ----------
    function start() {
        build();
        if (prefs.zoom && prefs.zoom !== 1) document.body.style.zoom = String(prefs.zoom);
        // Wake the AI server early (free servers sleep), so the first answer is quick
        try {
            const last = +sessionStorage.getItem('nxAsstWarm') || 0;
            if (navigator.onLine && Date.now() - last > 4 * 60 * 1000) {
                sessionStorage.setItem('nxAsstWarm', String(Date.now()));
                fetch(API().replace(/\/api\/assistant$/, '/api/assistant/ping'), { cache: 'no-store' }).catch(() => {});
            }
        } catch (e) {}
        if (state.open) {
            dock.classList.add('show');
            document.documentElement.classList.add('nxa-open');
            paint();
        }
        // The mic stays on across pages until the user turns it off (Gemini Live if possible, else the old way)
        if (prefs.mic) setTimeout(() => liveStart().then(ok => { if (!ok) maybeListen(200); }), 600);
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
