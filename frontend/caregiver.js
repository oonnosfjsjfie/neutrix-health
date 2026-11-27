// Looking after: what family members shared with me (codes kept on this device)
(function () {
    const F = window.NxFamily;
    const ml = () => window.neutrixLang === 'Malayalam';
    const L = (en, m) => (ml() && m ? m : en);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = id => document.getElementById(id);
    const SLOT_END = { morning: 12, afternoon: 16, evening: 21, night: 24, unclear: 24 };
    const SLOT_NAME = { morning: ['Morning', 'രാവിലെ'], afternoon: ['Afternoon', 'ഉച്ച'], evening: ['Evening', 'വൈകുന്നേരം'], night: ['Night', 'രാത്രി'], unclear: ['Time to check', 'സമയം ഉറപ്പില്ല'] };
    let data = {}, msg = '';
    function how() {
        $('famHowTitle').textContent = L('Looking after someone', 'ഒരാളെ നോക്കുന്നു');
        $('famHow').innerHTML = [
            L('Type the code they gave you. You only see what they chose to share.', 'അവർ നൽകിയ കോഡ് ടൈപ്പ് ചെയ്യുക. അവർ പങ്കിട്ടത് മാത്രം കാണാം.'),
            L('Red means a dose is past its time and not ticked yet. A gentle phone call can help.', 'ചുവപ്പ്: സമയം കഴിഞ്ഞിട്ടും ടിക്ക് ചെയ്യാത്ത ഡോസ്. ഒരു ഫോൺ വിളി സഹായിക്കും.'),
            L('It updates when they tick doses on their phone. This page does not send notifications: open it to check.', 'അവർ ഫോണിൽ ടിക്ക് ചെയ്യുമ്പോൾ അപ്ഡേറ്റ് ആകും. ഈ പേജ് അറിയിപ്പുകൾ അയയ്ക്കില്ല: പരിശോധിക്കാൻ തുറക്കുക.')
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
        return `<div class="fam-card${overdue.length || (d.alerts || []).length ? ' warn' : ''}">
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
        how();
        const codes = F.watching();
        $('cgView').innerHTML = `<div class="card-header"><div><h2>🤝 ${esc(L('People I look after', 'ഞാൻ നോക്കുന്നവർ'))}</h2>
            <p class="subtitle">${esc(L('Type the code a family member shared with you.', 'കുടുംബാംഗം പങ്കിട്ട കോഡ് ടൈപ്പ് ചെയ്യുക.'))}</p></div>
            <button type="button" class="btn-secondary fam-refresh" style="width:auto;margin:0">${esc(L('Refresh', 'പുതുക്കുക'))}</button></div>
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
        $('cgView').querySelector('.fam-refresh').addEventListener('click', load);
        $('cgView').querySelectorAll('.fam-rm').forEach(b => b.addEventListener('click', () => { F.setWatching(F.watching().filter(c => c !== b.dataset.code)); delete data[b.dataset.code]; render(); }));
    }
    async function load() {
        const codes = F.watching();
        codes.forEach(c => { data[c] = undefined; });
        render();
        await Promise.all(codes.map(async c => {
            try { data[c] = await F.read(c); }
            catch (e) { console.warn('[caregiver]', e); data[c] = { error: /permission|insufficient/i.test(String(e && (e.code || e.message))) ? L('Not shared any more, or sharing is not switched on yet.', 'ഇനി പങ്കിടുന്നില്ല.') : L('Could not load. Check the internet.', 'ലോഡ് ചെയ്യാനായില്ല. ഇന്റർനെറ്റ് നോക്കുക.') }; }
        }));
        render();
    }
    const fromUrl = F.cleanCode(new URLSearchParams(location.search).get('code') || '');
    if (fromUrl.length === 10) F.setWatching([fromUrl, ...F.watching().filter(c => c !== fromUrl)]);
    render();
    load();
    document.addEventListener('neutrix:langchange', render);
})();
