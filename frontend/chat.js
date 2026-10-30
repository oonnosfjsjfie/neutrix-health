// =====================================================
// Floating "Ask Neutrix" chat, shown on every page.
// Messages are saved in localStorage per language.
// =====================================================
(function () {
    const CHAT_KEY = 'neutrixChat';
    const chat = storeGet(CHAT_KEY) || { messages: [] };
    const save = () => storeSet(CHAT_KEY, chat);

    // ---------- Build the widget ----------
    const fab = document.createElement('button');
    fab.className = 'chat-fab';
    fab.type = 'button';
    fab.dataset.i18nTitle = 'chatOpen';
    fab.textContent = '💬';

    const panel = document.createElement('div');
    panel.className = 'chat-panel hidden';
    panel.innerHTML = `
        <div class="chat-panel-header">
            <div>
                <div class="chat-panel-title" data-i18n="chatTitle"></div>
                <div class="chat-panel-sub" data-i18n="chatHint"></div>
            </div>
            <div class="chat-head-btns">
                <button class="chat-icon-btn" id="chatClearBtn" type="button" data-i18n-title="chatClear">🗑</button>
                <button class="chat-icon-btn" id="chatCloseBtn" type="button" data-i18n-title="chatClose">✕</button>
            </div>
        </div>
        <div id="chatBox" class="chat-box"></div>
        <div class="chat-panel-footer">
            <div class="chat-input-row">
                <textarea id="questionInput" class="modern-textarea" rows="2" data-i18n-placeholder="questionPlaceholder"></textarea>
                <button id="micBtn" class="btn-secondary" type="button" data-i18n-title="micTitle">🎤</button>
                <button id="askBtn" class="btn-primary" type="button" data-i18n="askBtn"></button>
            </div>
            <p id="micStatus" class="hint"></p>
        </div>`;

    document.body.appendChild(panel);
    document.body.appendChild(fab);
    applyTexts(panel);
    fab.title = t('chatOpen');

    const chatBox = panel.querySelector('#chatBox');
    const questionInput = panel.querySelector('#questionInput');
    const askBtn = panel.querySelector('#askBtn');
    const micBtn = panel.querySelector('#micBtn');
    const micStatus = panel.querySelector('#micStatus');

    // ---------- Open / close ----------
    function setOpen(open) {
        panel.classList.toggle('hidden', !open);
        fab.textContent = open ? '✕' : '💬';
        try { localStorage.setItem('neutrixChatOpen', open ? '1' : '0'); } catch (e) {}
        if (open) {
            chatBox.scrollTop = chatBox.scrollHeight;
            questionInput.focus();
        }
    }
    fab.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
    panel.querySelector('#chatCloseBtn').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.classList.contains('hidden')) setOpen(false);
    });
    panel.querySelector('#chatClearBtn').addEventListener('click', () => {
        chat.messages = [];
        save();
        renderAll();
    });

    // ---------- Rendering ----------
    function msgText(m) {
        return m.text[neutrixLang] || m.text.English || m.text.Malayalam || Object.values(m.text)[0] || '';
    }

    function makeBubble(role) {
        const div = document.createElement('div');
        div.className = `chat-msg ${role === 'user' ? 'user' : 'ai'}`;
        chatBox.appendChild(div);
        return div;
    }

    function fillBubble(div, m) {
        if (m.role === 'assistant') {
            div.classList.add('md-content');
            // Charts the AI drew (```chart {...}```) become pictures; the rest is Markdown
            const parts = window.NxCharts ? NxCharts.extract(msgText(m)) : { text: msgText(m), charts: [] };
            // Pictures from their reports (```picture 2```) become a small card that opens the viewer
            const pics = window.NxVisuals ? NxVisuals.all() : [];
            const shown = [];
            const text = parts.text.replace(/```picture\s*(\d+)\s*```/g, (all, n) => {
                const idx = Number(n) - 1;
                if (!pics[idx]) return '';
                shown.push(idx);
                return `\n\nNXPIC${shown.length - 1}\n\n`;
            });
            let html = renderMarkdown(text);
            parts.charts.forEach((svg, i) => { html = html.replace(new RegExp(`(<p>)?NXCHART${i}(</p>)?`), svg); });
            shown.forEach((idx, i) => {
                const v = pics[idx];
                const title = (neutrixLang === 'Malayalam' ? (v.title_ml || v.title_en) : (v.title_en || v.title_ml)) || v.kind || '';
                const safe = String(title).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                const card = `<button type="button" class="chat-pic" data-pic="${idx}"><img src="${v.image}" alt="${safe}"><span>🖼 ${safe}</span></button>`;
                html = html.replace(new RegExp(`(<p>)?NXPIC${i}(</p>)?`), card);
            });
            div.innerHTML = html;
            div.querySelectorAll('.chat-pic').forEach(b => b.addEventListener('click', () => NxVisuals.open(pics, Number(b.dataset.pic))));
            div.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
        } else {
            div.textContent = msgText(m);
        }
    }

    let translateRun = 0;

    function renderAll() {
        chatBox.innerHTML = '';
        const greet = makeBubble('assistant');
        greet.textContent = t('chatGreeting');

        chat.messages.forEach((m, i) => {
            const div = makeBubble(m.role);
            div.dataset.index = i;
            fillBubble(div, m);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        translateMissing();
    }

    // Translate old messages into the current language
    async function translateMissing() {
        const lang = neutrixLang;
        const run = ++translateRun;
        for (let i = 0; i < chat.messages.length; i++) {
            const m = chat.messages[i];
            if (m.text[lang]) continue;
            try {
                await getLocalized(m.text, lang);
                save();
            } catch (e) {
                return; // AI busy: keep showing the original
            }
            if (run !== translateRun || lang !== neutrixLang) return;
            const div = chatBox.querySelector(`[data-index="${i}"]`);
            if (div) fillBubble(div, m);
        }
    }

    // ---------- What the person has saved in Neutrix (sent with each question) ----------
    const cut = (v, n) => { const t = String(v || ''); return t.length > n ? t.slice(0, n) + ' …' : t; };
    const pickLang = c => (c && typeof c === 'object') ? (c.English || Object.values(c)[0] || '') : (c || '');
    function appContext() {
        const ctx = {};
        try {
            const profile = storeGet('neutrix_hospital_profile') || {};
            if (profile.patientName) {
                ctx.patient = { name: profile.patientName, age: window.neutrixAge ? neutrixAge(profile) : profile.age, date_of_birth: profile.dob || undefined, gender: profile.gender, blood_group: profile.bloodGroup,
                    condition: profile.condition, allergies: profile.allergies,
                    regular_medicines: (profile.medications || []).map(m => `${m.name} ${m.dose || ''} (${m.time || ''})`.trim()),
                    caregiver: profile.caregiverName || '' };
            }
            const issues = storeGet('neutrixIssues') || [];
            if (issues.length) ctx.all_medical_issues = issues.map(i => i.title);
            const issue = window.neutrixActiveIssue;
            if (issue) ctx.current_issue = { title: issue.title, since: issue.startDate || '', hospital_or_doctor: issue.hospital || '', notes: issue.notes || '' };
            const report = loadReport();
            ctx.has_uploaded_reports = !!report;
            if (report) {
                ctx.uploaded_files = (report.files || []).map(f => f.name).concat(loadFollowups().flatMap(f => (f.files || []).map(x => x.name)));
                ctx.ai_summary = cut(pickLang(report.summaries) || report.summary, 4000);
            }
            const plan = storeGet('neutrixPlan');
            if (plan) ctx.medicine_plan = cut(pickLang(plan.content || plan), 3000);
            const schedule = storeGet('neutrixSchedule');
            if (schedule && typeof dosesForDay === 'function') {
                const today = dayKey(new Date());
                const ticks = (schedule.ticks || {})[today] || {};
                ctx.todays_doses = dosesForDay(schedule, today).map(d => ({ medicine: `${d.medicine} ${d.strength || ''}`.trim(), time: d.slot,
                    how: d.instruction_en || '', taken: ticks[d.id] ? 'yes, at ' + new Date(ticks[d.id]).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'not yet' }));
                let scheduled = 0, taken = 0;
                for (let i = 1; i <= 7; i++) {
                    const k = dayKeyShift(today, -i);
                    if (k < schedule.startDate) break;
                    const t = (schedule.ticks || {})[k] || {};
                    dosesForDay(schedule, k).forEach(d => { scheduled++; if (t[d.id]) taken++; });
                }
                if (scheduled) ctx.last_7_days_doses = `${taken} of ${scheduled} taken`;
            }
            const checkups = storeGet('neutrixCheckups');
            if (checkups) ctx.checkups = cut(pickLang(checkups.content || checkups), 2500);
            const readings = storeGet('neutrixTracker') || [];
            if (readings.length) ctx.recent_readings = readings.slice(-10).map(r => ({ at: (r.at || '').slice(0, 16), temp_F: r.temp, bp: r.bp, sugar: r.sugar, weight: r.weight, symptoms: r.symptoms }));
            const ex = storeGet('neutrixExercises');
            if (ex) {
                ctx.exercises_in_reports = (ex.exercises || []).map(e => [e.name_en, e.reps && `${e.reps} reps`, e.sets && `${e.sets} sets`, e.minutes && `${e.minutes} min`, e.frequency_en].filter(Boolean).join(', '));
                if ((ex.restrictions_en || []).length) ctx.activity_limits = ex.restrictions_en;
            }
            const exLog = storeGet('neutrixExerciseLog') || {};
            const days = Object.keys(exLog).sort().slice(-7);
            if (days.length) ctx.exercise_done = days.map(d => d + ': ' + Object.values(exLog[d]).map(e => `${e.name_en || 'exercise'} ${e.sessions}x${e.reps ? ' (' + e.reps + ' reps)' : ''}`).join(', '));
            const comparisons = loadFollowups().filter(f => f.comparison);
            if (comparisons.length) ctx.report_changes = comparisons.slice(-2).map(f => cut(pickLang(f.comparison), 1500));
            const progress = storeGet('neutrixProgressReport');
            if (progress && progress.createdAt) ctx.progress_report_created = progress.createdAt.slice(0, 10);
            const briefs = storeGet('neutrixBriefLog') || [];
            if (briefs.length) ctx.messages_sent_to_doctor = briefs.length;
            const pics = window.NxVisuals ? NxVisuals.all() : [];
            if (pics.length) ctx.report_pictures = pics.map((v, i) => ({
                number: i + 1, title: v.title_en, kind: v.kind, file: v.file, page: v.page || undefined,
                explanation: cut(v.explanation_en || '', 500),
                labels: (v.labels || []).map(l => l.text_en).filter(Boolean)
            }));
        } catch (e) {
            console.warn('[chat] context', e);
        }
        return JSON.stringify(ctx).slice(0, 20000);
    }
    function pageName() {
        const file = location.pathname.split('/').pop() || 'home.html';
        const title = document.title || (document.querySelector('.nx-eyebrow-live') || {}).textContent || '';
        return `${file} (${String(title).trim().slice(0, 80)})`;
    }

    // ---------- Asking ----------
    async function askQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;

        const lang = neutrixLang;
        const report = loadReport();
        const history = chat.messages.slice(-6).map(m => ({ role: m.role, text: msgText(m) }));

        const userMsg = { role: 'user', text: { [lang]: question } };
        chat.messages.push(userMsg);
        save();
        const userDiv = makeBubble('user');
        userDiv.dataset.index = chat.messages.length - 1;
        fillBubble(userDiv, userMsg);

        questionInput.value = '';
        askBtn.disabled = true;
        const thinking = makeBubble('assistant');
        thinking.textContent = t('thinking');
        chatBox.scrollTop = chatBox.scrollHeight;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90000);

        try {
            const res = await fetch(`${API_BASE}/api/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    report_text: reportContext(report),
                    language: lang,
                    history: history,
                    app_context: appContext(),
                    page: pageName()
                }),
                signal: controller.signal
            });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();

            const aiMsg = { role: 'assistant', text: { [lang]: data.answer } };
            chat.messages.push(aiMsg);
            save();
            thinking.dataset.index = chat.messages.length - 1;
            fillBubble(thinking, aiMsg);
        } catch (err) {
            thinking.textContent = err.name === 'AbortError'
                ? t('askTimeout')
                : t('askError', { msg: err.message });
        } finally {
            clearTimeout(timer);
            askBtn.disabled = false;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    askBtn.addEventListener('click', askQuestion);
    questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            askQuestion();
        }
    });

    // ---------- Voice typing ----------
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let micKey = null;

    if (!SpeechRecognition) {
        micBtn.disabled = true;
        micKey = 'micUnsupported';
        micStatus.textContent = t(micKey);
    } else {
        const recognition = new SpeechRecognition();
        recognition.interimResults = true;
        recognition.continuous = false;
        let listening = false;
        let baseText = '';

        micBtn.addEventListener('click', () => {
            if (listening) {
                recognition.stop();
                return;
            }
            recognition.lang = neutrixLang === 'Malayalam' ? 'ml-IN' : 'en-IN';
            baseText = questionInput.value;
            recognition.start();
        });

        recognition.onstart = () => {
            listening = true;
            micBtn.classList.add('listening');
            micKey = 'micListening';
            micStatus.textContent = t(micKey);
        };
        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            questionInput.value = (baseText + ' ' + transcript).trim();
        };
        recognition.onerror = (event) => {
            micKey = null;
            micStatus.textContent = event.error === 'not-allowed'
                ? t('micBlocked')
                : t('micError', { err: event.error });
        };
        recognition.onend = () => {
            listening = false;
            micBtn.classList.remove('listening');
            if (micKey === 'micListening') {
                micKey = null;
                micStatus.textContent = '';
            }
        };
    }

    // ---------- Language change ----------
    document.addEventListener('neutrix:langchange', () => {
        applyTexts(panel);
        fab.title = t('chatOpen');
        if (micKey) micStatus.textContent = t(micKey);
        renderAll();
    });

    renderAll();
    let wasOpen = false;
    try { wasOpen = localStorage.getItem('neutrixChatOpen') === '1'; } catch (e) {}
    if (wasOpen) setOpen(true);
})();