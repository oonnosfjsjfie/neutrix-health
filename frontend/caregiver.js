// Looking after: what family members shared with me (codes kept on this device)
(function () {
    const F = window.NxFamily;
    const ml = () => window.neutrixLang === 'Malayalam';
    const L = (en, m) => (ml() && m ? m : en);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = id => document.getElementById(id);
    const SLOT_END = { morning: 12, afternoon: 16, evening: 21, night: 24, unclear: 24 };
    const SLOT_NAME = { morning: ['Morning', 'രാവിലെ'], afternoon: ['Afternoon', 'ഉച്ച'], evening: ['Evening', 'വൈകുന്നേരം'], night: ['Night', 'രാത്രി'], unclear: ['Time to check', 'സമയം ഉറപ്പില്ല'] };
    let data = {}, msg = '', live = false;
    const subs = {};                 // code -> stop listening
    const seen = {};                 // code -> Set of things already shown (no popup twice for the same thing)

    // ---------- what is new and needs a popup ----------
    function overdueOf(d) {
        if (!d || d.day !== dayKey(new Date())) return [];
        const h = new Date().getHours();
        return (d.pending || []).filter(p => h >= SLOT_END[p.s]);
    }
    function events(code, d) {
        if (!d || d.error) return [];
        const who = d.name || L('Your family member', 'കുടുംബാംഗം');
        const out = [];
        overdueOf(d).forEach(p => out.push({ id: `o|${d.day}|${p.m}|${p.s}`, level: 'amber',
            text: L(`${who} hasn't ticked ${p.m} (${L(...(SLOT_NAME[p.s] || SLOT_NAME.unclear)).toLowerCase()}) and the time has passed.`, `${who} ${p.m} ടിക്ക് ചെയ്തിട്ടില്ല, സമയം കഴിഞ്ഞു.`) }));
        (d.alerts || []).forEach(a => out.push({ id: `a|${a}`, level: 'red', text: `${who}: ${a}` }));
        return out;
    }
    let audio = null;
    function unlockSound() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) {} }
    addEventListener('pointerdown', unlockSound, { once: true });
    function beep(urgent) {
        try {
            if (!audio) return;
            const t = audio.currentTime;
            [0, urgent ? 0.22 : null].filter(x => x != null).forEach(off => {
                const o = audio.createOscillator(), g = audio.createGain();
                o.frequency.value = urgent ? 880 : 660; o.connect(g); g.connect(audio.destination);
                g.gain.setValueAtTime(0.0001, t + off); g.gain.exponentialRampToValueAtTime(0.25, t + off + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.18);
                o.start(t + off); o.stop(t + off + 0.2);
            });
        } catch (e) {}
    }
    function popup(code, ev) {
        let stack = document.getElementById('cgPops');
        if (!stack) { stack = document.createElement('div'); stack.id = 'cgPops'; stack.className = 'cg-pops'; stack.setAttribute('aria-live', 'assertive'); document.body.appendChild(stack); }
        const el = document.createElement('div');
        el.className = 'cg-pop ' + ev.level;
        el.setAttribute('role', 'alert');
        el.innerHTML = `<div class="cg-pop-ic" aria-hidden="true">${ev.level === 'red' ? '⚠️' : '⏰'}</div><div class="cg-pop-txt"><b>${esc(ev.level === 'red' ? L('Needs attention', 'ശ്രദ്ധിക്കേണ്ടത്') : L('Dose missed', 'ഡോസ് വിട്ടുപോയി'))}</b><p></p>
            <div class="cg-pop-btns"><button type="button" class="btn-primary cg-pop-view">${esc(L('View', 'കാണുക'))}</button><button type="button" class="btn-secondary cg-pop-x">${esc(L('Dismiss', 'അടയ്ക്കുക'))}</button></div></div>`;
        el.querySelector('p').textContent = ev.text;
        el.querySelector('.cg-pop-x').onclick = () => el.remove();
        el.querySelector('.cg-pop-view').onclick = () => { el.remove(); const c = document.getElementById('cg-' + code); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1800); } };
        stack.prepend(el);
        while (stack.children.length > 4) stack.lastChild.remove();
        if (window.NxNotify) NxNotify.add({ id: `family|${code}|${ev.id}`, icon: '👨‍👩‍👧', level: ev.level, title: ev.level === 'red' ? L('Family: needs attention', 'കുടുംബം: ശ്രദ്ധിക്കുക') : L('Family: dose missed', 'കുടുംബം: ഡോസ് വിട്ടുപോയി'), text: ev.text, href: 'caregiver.html', issue: '', silent: true });
        beep(ev.level === 'red');
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try { const n = new Notification(ev.level === 'red' ? L('Neutrix: needs attention', 'Neutrix: ശ്രദ്ധിക്കുക') : L('Neutrix: dose missed', 'Neutrix: ഡോസ് വിട്ടുപോയി'), { body: ev.text, tag: code + ev.id, icon: 'assets/neutrix-icon.png' }); n.onclick = () => { window.focus(); n.close(); }; } catch (e) {}
        }
        if (navigator.vibrate) try { navigator.vibrate(ev.level === 'red' ? [200, 100, 200] : 150); } catch (e) {}
    }
    // first look at someone: no popups for what was already there; after that, popup for anything new
    function check(code, quiet) {
        const s = seen[code] || (seen[code] = new Set());
        events(code, data[code]).forEach(ev => { if (!s.has(ev.id)) { s.add(ev.id); if (!quiet) popup(code, ev); } });
    }
    function how() {
        $('famHowTitle').textContent = L('Looking after someone', 'ഒരാളെ നോക്കുന്നു');
        $('famHow').innerHTML = [
            L('Type the code they gave you. You only see what they chose to share.', 'അവർ നൽകിയ കോഡ് ടൈപ്പ് ചെയ്യുക. അവർ പങ്കിട്ടത് മാത്രം കാണാം.'),
            L('Red means a dose is past its time and not ticked yet. A gentle phone call can help.', 'ചുവപ്പ്: സമയം കഴിഞ്ഞിട്ടും ടിക്ക് ചെയ്യാത്ത ഡോസ്. ഒരു ഫോൺ വിളി സഹായിക്കും.'),
            L('It updates live, within seconds of them ticking a dose or logging a reading. If a dose is missed or something needs attention, a popup appears here.', 'അവർ ഡോസ് ടിക്ക് ചെയ്യുമ്പോഴോ റീഡിംഗ് രേഖപ്പെടുത്തുമ്പോഴോ നിമിഷങ്ങൾക്കുള്ളിൽ ലൈവായി പുതുക്കും. ഡോസ് വിട്ടുപോയാലോ ശ്രദ്ധിക്കേണ്ടത് ഉണ്ടായാലോ ഇവിടെ പോപ്പപ്പ് വരും.'),
            L('Popups only reach you while this page is open (a background tab is fine). Turn on browser alerts to be told even when you are on another tab.', 'ഈ പേജ് തുറന്നിരിക്കുമ്പോൾ മാത്രമേ പോപ്പപ്പ് വരൂ (പിന്നിലുള്ള ടാബ് മതി). മറ്റൊരു ടാബിലായിരിക്കുമ്പോഴും അറിയാൻ ബ്രൗസർ അലേർട്ടുകൾ ഓണാക്കുക.')
        ].map(x => `<li>${esc(x)}</li>`).join('');
    }
    function card(code, d) {
        if (d === undefined) return `<div class="fam-card"><p class="loading-line">${esc(L('Loading…', 'ലോഡ് ചെയ്യുന്നു…'))}</p></div>`;
        const rm = `<button type="button" class="btn-text fam-rm" data-code="${esc(code)}">${esc(L('Remove', 'നീക്കുക'))}</button>`;
        if (d === null) return `<div class="fam-card"><b>${esc(F.fmtCode(code))}</b><p class="nxh-muted">${esc(L('Not shared any more, or the code is wrong.', 'ഇനി പങ്കിടുന്നില്ല, അല്ലെങ്കിൽ കോഡ് തെറ്റാണ്.'))}</p>${rm}</div>`;
        if (d.error) return `<div class="fam-card"><b>${esc(F.fmtCode(code))}</b><p class="nxh-muted">${esc(d.error)}</p>${rm}</div>`;
        const updated = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate() : null;
        const today = dayKey(new Date()), isToday = d.day === today, h = new Date().getHours();
        const overdue = isToday ? (d.pending || []).filter(p => h >= SLOT_END[p.s]) : [];
        const later = isToday ? (d.pending || []).filter(p => h < SLOT_END[p.s]) : [];
        const stale = !updated || Date.now() - updated.getTime() > 24 * 3600000;
        const max = Math.max(1, ...(d.week || []).map(x => x.due));
        return `<div class="fam-card${overdue.length || (d.alerts || []).length ? ' warn' : ''}" data-code="${esc(code)}">
            <div class="fam-card-head"><div><b>${esc(d.name || L('Family member', 'കുടുംബാംഗം'))}</b> <span class="nxh-muted">${esc(d.issue || '')}</span></div>
                <span class="nxh-muted">${esc(updated ? L('Updated ', 'പുതുക്കിയത് ') + updated.toLocaleString(localeFor(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')}</span></div>
            ${stale ? `<p class="nxc-issue">${esc(L('Not updated for over a day. They may not have opened the app, or their phone is offline.', 'ഒരു ദിവസത്തിലേറെയായി പുതുക്കിയിട്ടില്ല.'))}</p>` : ''}
            ${(d.alerts || []).length ? `<div class="nxc-urgent"><b>⚠️ ${esc(L('Needs attention', 'ശ്രദ്ധിക്കേണ്ടത്'))}</b>${d.alerts.map(a => `<p>${esc(a)}</p>`).join('')}</div>` : ''}
            ${isToday ? `<p class="fam-today"><b>${esc(L(`Today: ${d.taken} of ${d.due} doses taken`, `ഇന്ന്: ${d.due}-ൽ ${d.taken} ഡോസ്`))}</b></p>
                ${overdue.length ? `<div class="nxc-issue high"><b>${esc(L('Not ticked yet (time has passed)', 'ടിക്ക് ചെയ്തിട്ടില്ല (സമയം കഴിഞ്ഞു)'))}</b><ul>${overdue.map(p => `<li>${esc(p.m)} · ${esc(L(...SLOT_NAME[p.s] || SLOT_NAME.unclear))}</li>`).join('')}</ul></div>` : ''}
                ${later.length ? `<p class="nxh-muted">${esc(L('Later today', 'ഇന്ന് പിന്നീട്'))}: ${esc(later.map(p => p.m).join(', '))}</p>` : ''}
                ${!overdue.length && d.due && d.taken === d.due ? `<div class="nxc-ok">✅ ${esc(L('All of today’s doses are ticked.', 'ഇന്നത്തെ എല്ലാ ഡോസുകളും ടിക്ക് ചെയ്തു.'))}</div>` : ''}`
                : `<p class="nxh-muted">${esc(L('No update today yet.', 'ഇന്ന് ഇതുവരെ അപ്ഡേറ്റ് ഇല്ല.'))}</p>`}
            ${(d.week || []).length ? `<div class="nxc-week">${d.week.map(x => `<div class="nxc-day"><div class="nxc-bar"><span style="height:${Math.round(x.due / max * 100)}%"><i style="height:${x.due ? Math.round(x.taken / x.due * 100) : 0}%"></i></span></div><div class="nxc-dl">${esc(new Date(x.d + 'T00:00:00').toLocaleDateString(localeFor(), { weekday: 'short' }))}</div><div class="nxc-dn">${x.taken}/${x.due}</div></div>`).join('')}</div>` : ''}
            ${d.pct >= 0 ? `<p>${esc(L(`Last days: ${d.pct}% of doses taken.`, `കഴിഞ്ഞ ദിവസങ്ങൾ: ${d.pct}% ഡോസ്.`))}</p>` : ''}
            ${(d.low || []).length ? `<p class="nxc-issue">🔁 ${esc(L('Running low', 'തീരാറായി'))}: ${esc(d.low.join(', '))}</p>` : ''}
            ${rm}</div>`;
    }
    function render() {
        const old = $('cgView').querySelector('.fam-add input');
        const typed = old && old.value ? { v: old.value, focus: document.activeElement === old } : null;
        how();
        const codes = F.watching();
        $('cgView').innerHTML = `<div class="card-header"><div><h2>🤝 ${esc(L('People I look after', 'ഞാൻ നോക്കുന്നവർ'))}</h2>
            <p class="subtitle">${esc(L('Type the code a family member shared with you.', 'കുടുംബാംഗം പങ്കിട്ട കോഡ് ടൈപ്പ് ചെയ്യുക.'))}</p></div>
            <div class="cg-tools"><span class="cg-live${live ? ' on' : ''}" title="${esc(L('Updates by itself', 'സ്വയം പുതുക്കുന്നു'))}">${esc(live ? L('Live', 'ലൈവ്') : L('Connecting…', 'ബന്ധിപ്പിക്കുന്നു…'))}</span>
            ${'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied' ? `<button type="button" class="btn-secondary cg-notify" style="width:auto;margin:0">🔔 ${esc(L('Turn on browser alerts', 'ബ്രൗസർ അലേർട്ടുകൾ ഓണാക്കുക'))}</button>` : ''}
            <button type="button" class="btn-secondary fam-refresh" style="width:auto;margin:0">${esc(L('Refresh', 'പുതുക്കുക'))}</button></div></div>
            <form class="fam-add"><input class="modern-input" name="code" maxlength="12" autocomplete="off" placeholder="ABCDE-23456" aria-label="${esc(L('Share code', 'പങ്കിടൽ കോഡ്'))}"><button class="btn-primary" type="submit" style="width:auto;margin:0">${esc(L('Add', 'ചേർക്കുക'))}</button></form>
            ${msg ? `<p class="nxc-issue">${esc(msg)}</p>` : ''}
            <div class="fam-cards">${codes.length ? codes.map(c => card(c, data[c])).join('') : `<p class="hint">${esc(L('Nobody yet.', 'ഇതുവരെ ആരുമില്ല.'))}</p>`}</div>`;
        $('cgView').querySelector('.fam-add').addEventListener('submit', e => {
            e.preventDefault();
            const code = F.cleanCode(e.target.code.value);
            if (code.length !== 10) { msg = L('A code has 10 letters and numbers.', 'കോഡിൽ 10 അക്ഷരങ്ങളും അക്കങ്ങളുമുണ്ട്.'); render(); return; }
            msg = '';
            F.setWatching([code, ...F.watching().filter(c => c !== code)]);
            load();
        });
        $('cgView').querySelector('.fam-refresh').addEventListener('click', () => { Object.keys(subs).forEach(c => { subs[c](); delete subs[c]; }); load(); });
        if (typed) { const inp = $('cgView').querySelector('.fam-add input'); inp.value = typed.v; if (typed.focus) { inp.focus(); inp.setSelectionRange(typed.v.length, typed.v.length); } }
        const nb = $('cgView').querySelector('.cg-notify');
        if (nb) nb.addEventListener('click', async () => { try { await Notification.requestPermission(); } catch (e) {} unlockSound(); render(); });
        $('cgView').querySelectorAll('.fam-rm').forEach(b => b.addEventListener('click', () => { F.setWatching(F.watching().filter(c => c !== b.dataset.code)); delete data[b.dataset.code]; if (subs[b.dataset.code]) { subs[b.dataset.code](); delete subs[b.dataset.code]; } render(); }));
        $('cgView').querySelectorAll('.fam-card[data-code]').forEach(c => { c.id = 'cg-' + c.dataset.code; });
    }
    const errText = e => /permission|insufficient/i.test(String(e && (e.code || e.message))) ? L('Not shared any more, or sharing is not switched on yet.', 'ഇനി പങ്കിടുന്നില്ല.') : L('Could not load. Check the internet.', 'ലോഡ് ചെയ്യാനായില്ല. ഇന്റർനെറ്റ് നോക്കുക.');
    async function load() {
        const codes = F.watching();
        Object.keys(subs).forEach(c => { if (!codes.includes(c)) { subs[c](); delete subs[c]; } });
        codes.forEach(c => { if (!(c in data)) data[c] = undefined; });
        render();
        await Promise.all(codes.map(async c => {
            if (subs[c]) return;
            try {
                let first = true;
                subs[c] = await F.watch(c, d => {
                    data[c] = d; live = true;
                    check(c, first && !seen[c]); first = false;
                    render();
                }, e => { console.warn('[caregiver] live', e); data[c] = { error: errText(e) }; delete subs[c]; render(); });
            } catch (e) {
                console.warn('[caregiver]', e);
                try { data[c] = await F.read(c); check(c, !seen[c]); } catch (e2) { data[c] = { error: errText(e2) }; }
                render();
            }
        }));
    }
    // doses turn overdue as the clock moves, even when nothing new arrives
    setInterval(() => { Object.keys(data).forEach(c => check(c, false)); render(); }, 60000);
    addEventListener('online', load);
    const fromUrl = F.cleanCode(new URLSearchParams(location.search).get('code') || '');
    if (fromUrl.length === 10) F.setWatching([fromUrl, ...F.watching().filter(c => c !== fromUrl)]);
    render();
    load();
    document.addEventListener('neutrix:langchange', render);
})();
