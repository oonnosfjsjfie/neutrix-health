// teachback.js: "Check you understood" quiz (teach-back) on the Reports page.
// 2-3 questions built only from the patient's own saved data (medicine times, warning signs, next check-up),
// never from AI. A wrong answer explains it again in simpler words and asks once more.
// Result kept per issue in neutrixTeachBack {version, at, right, total}.
(function () {
    const slot = document.getElementById('teachBack');
    if (!slot || !window.NxCare || !window.loadReport) return;
    const C = window.NxCare, esc = C.esc, L = C.L;
    const record = loadReport();
    if (!record) return;
    const version = window.reportVersion ? reportVersion(record) : record.createdAt;
    const SLOT = { morning: ['Morning', 'രാവിലെ'], afternoon: ['Afternoon', 'ഉച്ചയ്ക്ക്'], evening: ['Evening', 'വൈകുന്നേരം'], night: ['Night', 'രാത്രി'] };
    const ORDER = ['morning', 'afternoon', 'evening', 'night'];
    const slotWords = keys => {
        const w = keys.map((k, n) => { const x = L(SLOT[k][0], SLOT[k][1]); return n ? x.toLowerCase() : x; });
        return w.length > 1 ? w.slice(0, -1).join(', ') + L(' and ', ' ഒപ്പം ') + w[w.length - 1] : w[0];
    };
    const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

    // ---------- questions from the patient's own data ----------
    function medQuestion() {
        const sch = storeGet('neutrixSchedule');
        const doses = sch && window.dosesForDay ? dosesForDay(sch, dayKey(new Date())) : [];
        const by = new Map();
        doses.forEach(d => {
            if (!SLOT[d.slot]) return;
            const k = `${d.medicine} ${d.strength || ''}`.trim();
            const e = by.get(k) || { name: k, slots: new Set(), dose: d.dose };
            e.slots.add(d.slot); by.set(k, e);
        });
        const meds = [...by.values()];
        if (!meds.length) return null;
        const m = meds[Math.floor(Math.random() * meds.length)];
        const right = ORDER.filter(s => m.slots.has(s));
        const combos = [['morning'], ['afternoon'], ['evening'], ['night'], ['morning', 'night'], ['morning', 'evening'], ['morning', 'afternoon', 'night']];
        const key = right.join('+');
        const wrong = shuffle(combos.filter(c => c.join('+') !== key)).slice(0, 3);
        const opts = shuffle([right, ...wrong]).map(c => ({ text: slotWords(c), ok: c.join('+') === key }));
        const times = slotWords(right).toLowerCase();
        return { id: 'med', q: L(`When do you take ${m.name}?`, `${m.name} എപ്പോഴാണ് കഴിക്കേണ്ടത്?`), opts,
            simple: L(`${m.name}: ${m.dose ? m.dose + ', ' : ''}${times}. Every day at the same time. Tip: keep the strip where you will see it at that time, like next to your toothbrush or your plate.`,
                `${m.name}: ${m.dose ? m.dose + ', ' : ''}${times}. എല്ലാ ദിവസവും ഒരേ സമയത്ത്. ടിപ്പ്: ആ സമയത്ത് കാണുന്നിടത്ത് സ്ട്രിപ്പ് വയ്ക്കുക, ഉദാ. ടൂത്ത്ബ്രഷിന് അടുത്ത്.`),
            good: L(`Right. ${m.name} is taken ${times}.`, `ശരി. ${m.name} ${times} കഴിക്കണം.`) };
    }
    function signQuestion() {
        const w = C.warnings().filter(x => x.signs && x.signs.length);
        if (!w.length) return null;
        const c = w[Math.floor(Math.random() * w.length)];
        const sign = c.signs[Math.floor(Math.random() * c.signs.length)];
        const calm = shuffle([
            L('Feeling a bit sleepy after lunch', 'ഉച്ചഭക്ഷണത്തിന് ശേഷം അൽപം ഉറക്കം വരുന്നത്'),
            L('Feeling hungry before dinner', 'അത്താഴത്തിന് മുമ്പ് വിശക്കുന്നത്'),
            L('Wanting to sit down after a long walk', 'നീണ്ട നടത്തത്തിന് ശേഷം ഇരിക്കാൻ തോന്നുന്നത്'),
            L('A slightly dry mouth on a hot day', 'ചൂടുള്ള ദിവസം വായ അൽപം വരളുന്നത്')
        ]).slice(0, 3);
        const opts = shuffle([{ text: sign, ok: true }, ...calm.map(t => ({ text: t, ok: false }))]);
        return { id: 'sign', q: L('Which of these means you should get help at once (call 108)?', 'ഇവയിൽ ഏതാണ് ഉടൻ സഹായം തേടേണ്ട (108 വിളിക്കേണ്ട) ലക്ഷണം?'), opts,
            simple: L(`Because of your ${c.name.toLowerCase()}, these signs are an emergency: ${c.signs.join('; ')}. If any of them happens, call 108 straight away. Don't wait to see if it passes.`,
                `നിങ്ങളുടെ ${c.name} കാരണം ഈ ലക്ഷണങ്ങൾ അടിയന്തരമാണ്: ${c.signs.join('; ')}. ഇവയിൽ ഏതെങ്കിലും ഉണ്ടായാൽ ഉടൻ 108 വിളിക്കുക. മാറുമോ എന്ന് കാത്തിരിക്കരുത്.`),
            good: L(`Right. "${sign}" means call 108 at once.`, `ശരി. "${sign}" ഉണ്ടായാൽ ഉടൻ 108 വിളിക്കുക.`) };
    }
    function checkupQuestion() {
        const ck = storeGet('neutrixCheckups');
        const md = ck && ck.content && (ck.content.English || Object.values(ck.content)[0] || '');
        if (!md) return null;
        const today = dayKey(new Date());
        const items = md.split('\n').filter(l => /^###\s/.test(l)).map(l => {
            const h = l.replace(/^###\s*(📅\s*)?/, '').replace(/\*\*/g, '').trim();
            const m = h.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
            return m ? { iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, what: h.replace(m[0], '').replace(/^[\s—–:-]+|[\s—–:-]+$/g, '') || L('your check-up', 'പരിശോധന') } : null;
        }).filter(x => x && x.iso >= today).sort((a, b) => a.iso.localeCompare(b.iso));
        const next = items[0];
        if (!next) return null;
        const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString(localeFor(), { weekday: 'short', day: 'numeric', month: 'short' });
        const shift = n => { const d = new Date(next.iso + 'T00:00:00'); d.setDate(d.getDate() + n); return dayKey(d); };
        const opts = shuffle([{ text: fmt(next.iso), ok: true }, { text: fmt(shift(7)), ok: false }, { text: fmt(shift(-5)), ok: false },
            { text: L('Only if I feel unwell', 'സുഖമില്ലെങ്കിൽ മാത്രം'), ok: false }]);
        return { id: 'checkup', q: L(`When is your next check-up (${next.what})?`, `അടുത്ത പരിശോധന (${next.what}) എപ്പോഴാണ്?`), opts,
            simple: L(`Your next check-up is on ${fmt(next.iso)}. Go even if you feel well: the doctor checks things you cannot feel. Add it to your phone calendar from the Check-ups page.`,
                `അടുത്ത പരിശോധന ${fmt(next.iso)} ആണ്. സുഖമാണെങ്കിലും പോകുക: നിങ്ങൾക്ക് അറിയാത്ത കാര്യങ്ങൾ ഡോക്ടർ പരിശോധിക്കും. Check-ups പേജിൽ നിന്ന് ഫോൺ കലണ്ടറിൽ ചേർക്കുക.`),
            good: L(`Right. ${fmt(next.iso)}.`, `ശരി. ${fmt(next.iso)}.`) };
    }
    function missedQuestion() {
        const opts = shuffle([
            { text: L('Take it when I remember, unless the next dose is nearly due. Never two together.', 'ഓർക്കുമ്പോൾ കഴിക്കുക, അടുത്ത ഡോസ് അടുത്താണെങ്കിൽ വേണ്ട. ഒരിക്കലും രണ്ടെണ്ണം ഒരുമിച്ച് അല്ല.'), ok: true },
            { text: L('Take two at the next time to catch up', 'അടുത്ത സമയത്ത് രണ്ടെണ്ണം കഴിക്കുക'), ok: false },
            { text: L('Stop the medicine for the day', 'അന്നത്തേക്ക് മരുന്ന് നിർത്തുക'), ok: false }]);
        return { id: 'missed', q: L('You forgot a dose. What should you usually do?', 'ഒരു ഡോസ് മറന്നു. സാധാരണ എന്ത് ചെയ്യണം?'), opts,
            simple: L('Never take two doses together to catch up. For most medicines: take it when you remember, but skip it if the next dose is nearly due. Some medicines differ, so check the leaflet or ask your pharmacist.',
                'പിടിച്ചെത്താൻ ഒരിക്കലും രണ്ട് ഡോസ് ഒരുമിച്ച് കഴിക്കരുത്. മിക്ക മരുന്നുകൾക്കും: ഓർക്കുമ്പോൾ കഴിക്കുക, അടുത്ത ഡോസ് അടുത്താണെങ്കിൽ ഒഴിവാക്കുക. ചില മരുന്നുകൾ വ്യത്യസ്തമാണ്, ലഘുലേഖ നോക്കുക അല്ലെങ്കിൽ ഫാർമസിസ്റ്റിനോട് ചോദിക്കുക.'),
            good: L('Right. Never double up.', 'ശരി. ഒരിക്കലും ഇരട്ടിയാക്കരുത്.') };
    }
    function build() {
        const qs = [medQuestion(), signQuestion(), checkupQuestion()].filter(Boolean);
        if (qs.length < 3) qs.push(missedQuestion());
        return qs.slice(0, 3);
    }

    // ---------- the card ----------
    let qs = [], i = 0, right = 0, triedAgain = false;
    const saved = () => { const s = storeGet('neutrixTeachBack'); return s && s.version === version ? s : null; };
    function intro() {
        const s = saved();
        slot.innerHTML = `<div class="tb-card"><div class="tb-head"><span class="tb-ic" aria-hidden="true">🎓</span><div>
                <b>${esc(L('Check you understood', 'മനസ്സിലായോ എന്ന് നോക്കാം'))}</b>
                <p>${esc(s ? L(`Last time you got ${s.right} of ${s.total} right first time. Try again any time.`, `കഴിഞ്ഞ തവണ ${s.total}-ൽ ${s.right} ആദ്യ ശ്രമത്തിൽ ശരിയായി. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ശ്രമിക്കാം.`)
                    : L('3 quick questions about your own medicines and care. If something is unclear, it explains it again more simply.', 'നിങ്ങളുടെ മരുന്നുകളെയും പരിചരണത്തെയും കുറിച്ച് 3 ചെറിയ ചോദ്യങ്ങൾ. വ്യക്തമല്ലെങ്കിൽ ലളിതമായി വീണ്ടും വിശദീകരിക്കും.'))}</p></div></div>
            <button type="button" class="btn-primary tb-start">${esc(s ? L('Try again', 'വീണ്ടും ശ്രമിക്കുക') : L('Start', 'തുടങ്ങുക'))}</button></div>`;
        slot.querySelector('.tb-start').onclick = () => { qs = build(); i = 0; right = 0; ask(); };
    }
    function ask(again) {
        triedAgain = !!again;
        const q = qs[i];
        if (again) q.opts = shuffle(q.opts);
        slot.innerHTML = `<div class="tb-card"><div class="tb-progress">${esc(L(`Question ${i + 1} of ${qs.length}`, `ചോദ്യം ${i + 1} / ${qs.length}`))}${again ? ' · ' + esc(L('one more try', 'ഒരിക്കൽ കൂടി')) : ''}</div>
            <div class="tb-q">${esc(q.q)}</div>
            <div class="tb-opts" role="group">${q.opts.map((o, n) => `<button type="button" class="tb-opt" data-n="${n}">${esc(o.text)}</button>`).join('')}</div>
            <div class="tb-feedback" aria-live="polite"></div></div>`;
        slot.querySelectorAll('.tb-opt').forEach(b => b.onclick = () => answer(+b.dataset.n));
    }
    function answer(n) {
        const q = qs[i], o = q.opts[n];
        slot.querySelectorAll('.tb-opt').forEach((b, k) => { b.disabled = true; if (q.opts[k].ok) b.classList.add('right'); else if (k === n) b.classList.add('wrong'); });
        const fb = slot.querySelector('.tb-feedback');
        if (o.ok) {
            if (!triedAgain) right++;
            fb.innerHTML = `<div class="tb-good">✅ ${esc(q.good)}</div><button type="button" class="btn-primary tb-next">${esc(i + 1 < qs.length ? L('Next question', 'അടുത്ത ചോദ്യം') : L('See result', 'ഫലം കാണുക'))}</button>`;
            fb.querySelector('.tb-next').onclick = next;
        } else {
            fb.innerHTML = `<div class="tb-explain"><b>💡 ${esc(L('Let me explain it more simply', 'ലളിതമായി വിശദീകരിക്കാം'))}</b><p>${esc(q.simple)}</p></div>
                ${triedAgain ? `<button type="button" class="btn-primary tb-next">${esc(i + 1 < qs.length ? L('Next question', 'അടുത്ത ചോദ്യം') : L('See result', 'ഫലം കാണുക'))}</button>`
                    : `<button type="button" class="btn-primary tb-retry">${esc(L('Try this question again', 'ഈ ചോദ്യം വീണ്ടും'))}</button>`}`;
            const r = fb.querySelector('.tb-retry'); if (r) r.onclick = () => ask(true);
            const nx = fb.querySelector('.tb-next'); if (nx) nx.onclick = next;
        }
        if (window.NxVoice && window.nxTeachVoice) NxVoice.speak(o.ok ? q.good : q.simple);
    }
    function next() {
        i++;
        if (i < qs.length) return ask();
        storeSet('neutrixTeachBack', { version, at: new Date().toISOString(), right, total: qs.length });
        const all = right === qs.length;
        slot.innerHTML = `<div class="tb-card"><div class="tb-done">${all ? '🎉' : '👍'}</div>
            <b class="tb-q">${esc(all ? L(`${right} of ${qs.length}: you’ve got it.`, `${qs.length}-ൽ ${right}: നിങ്ങൾക്ക് മനസ്സിലായി.`)
                : L(`${right} of ${qs.length} right first time. That’s fine: you went over the rest, and that’s how it sticks.`, `${qs.length}-ൽ ${right} ആദ്യ ശ്രമത്തിൽ ശരി. കുഴപ്പമില്ല: ബാക്കിയുള്ളവ വീണ്ടും പഠിച്ചു.`))}</b>
            <p class="hint">${esc(L('Unsure about anything? Ask your doctor or pharmacist, or ask Emma.', 'എന്തെങ്കിലും സംശയമുണ്ടോ? ഡോക്ടറോടോ ഫാർമസിസ്റ്റിനോടോ എമ്മയോടോ ചോദിക്കുക.'))}</p>
            <button type="button" class="btn-secondary tb-start">${esc(L('Try new questions', 'പുതിയ ചോദ്യങ്ങൾ'))}</button></div>`;
        slot.querySelector('.tb-start').onclick = () => { qs = build(); i = 0; right = 0; ask(); };
    }
    intro();
    document.addEventListener('neutrix:langchange', intro);
    window.NxTeachBack = { build };
})();
