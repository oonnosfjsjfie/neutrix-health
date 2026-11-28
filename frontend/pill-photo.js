// Medicine photo check (Schedule page): photograph a strip / box / bottle; the AI reads the printed label and
// compares it with today's medicines. It never identifies loose pills and never says "safe to take".
(function () {
    const view = document.getElementById('schedView');
    if (!view || !window.NxCare) return;
    const C = window.NxCare, esc = C.esc, L = C.L;
    const wrap = document.createElement('div');
    wrap.className = 'pc-box';
    wrap.innerHTML = `<button type="button" class="btn-secondary pc-btn"></button><input type="file" accept="image/*" capture="environment" class="pc-input" hidden><div class="pc-result" aria-live="polite"></div>`;
    const header = view.querySelector('.card-header');
    header.insertAdjacentElement('afterend', wrap);
    const btn = wrap.querySelector('.pc-btn'), input = wrap.querySelector('.pc-input'), out = wrap.querySelector('.pc-result');
    const paint = () => { btn.textContent = '📷 ' + L('Check a medicine with a photo', 'ഫോട്ടോ എടുത്ത് മരുന്ന് പരിശോധിക്കുക'); };
    paint();
    document.addEventListener('neutrix:langchange', paint);
    btn.addEventListener('click', () => { if (window.NxCamera) NxCamera.open(input); else input.click(); });

    function meds() {
        const sch = storeGet('neutrixSchedule');
        const doses = sch && window.dosesForDay ? dosesForDay(sch, dayKey(new Date())) : [];
        return [...new Set(doses.map(d => `${d.medicine} ${d.strength || ''}`.trim()))];
    }
    // The photographed medicine run through the same safety check as My Care, against today's medicines:
    // the same medicine twice (two brands of paracetamol), risky combinations, unusual dose. Warns only.
    function scanSafety(d) {
        const sch = storeGet('neutrixSchedule');
        const doses = sch && window.dosesForDay ? dosesForDay(sch, dayKey(new Date())) : [];
        const parts = String(d.generic || '').split(/\s*(?:\+|,|\/|\band\b)\s*/i).map(x => x.trim()).filter(Boolean);
        const label = String(d.label_text || '').split(/[,;]/)[0].trim().slice(0, 40);
        const names = parts.length ? parts : (label ? [label] : []);
        if (!names.length) return { list: [], names: [] };
        const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
        const scanned = names.map((n, i) => ({ id: 'scan' + i, medicine: cap(n) + ' (photo)', strength: names.length === 1 ? (d.strength || '') : '', dose: '1 tab', slot: 'scan' }));
        const scanNames = new Set(scanned.map(x => x.medicine));
        // only what involves the photographed medicine (My Care already shows the schedule's own issues)
        const list = C.safety(doses.concat(scanned)).filter(x => (x.meds || []).some(m => scanNames.has(m)
            || ((x.meds || []).length > 1 && scanned.some(sc => C.generic(sc.medicine) === C.generic(m)))));
        return { list, names: scanned.map(x => x.medicine.replace(' (photo)', '')) };
    }
    function safetyHtml(d) {
        let r = { list: [], names: [] };
        try { r = scanSafety(d); } catch (e) { console.warn('[pill check safety]', e); }
        if (r.list.length) {
            return `<div class="pc-safety">${r.list.map(x => `<div class="nxc-issue ${x.level === 'high' ? 'high' : ''}"><b>${x.level === 'high' ? '🛑' : '⚠️'} ${esc(x.title.replace(/ \(photo\)/g, ''))}</b><p>${esc(x.text)}</p></div>`).join('')}
                <p class="nxh-muted">${esc(L('Checked against the medicines in your schedule. Ask your pharmacist or doctor before taking it.', 'നിങ്ങളുടെ ഷെഡ്യൂളിലെ മരുന്നുകളുമായി പരിശോധിച്ചു. കഴിക്കുന്നതിന് മുമ്പ് ഫാർമസിസ്റ്റിനോടോ ഡോക്ടറോടോ ചോദിക്കുക.'))}</p></div>`;
        }
        if (!r.names.length) return '';
        return `<p class="nxh-muted">🛡️ ${esc(L(`No double dose or known risky mix found between ${r.names.join(' + ')} and your medicines. Neutrix's list doesn't cover every medicine, so still ask your pharmacist.`,
            `${r.names.join(' + ')} നിങ്ങളുടെ മരുന്നുകളുമായി ഇരട്ടി ഡോസോ അറിയപ്പെടുന്ന അപകട ചേർച്ചയോ കണ്ടില്ല. എല്ലാ മരുന്നുകളും പട്ടികയിലില്ല, അതിനാൽ ഫാർമസിസ്റ്റിനോട് ചോദിക്കുക.`))}</p>`;
    }
    function toDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
    input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        input.value = '';
        if (!navigator.onLine) { out.innerHTML = `<div class="nxc-issue">${esc(L('The photo check needs the internet.', 'ഫോട്ടോ പരിശോധനയ്ക്ക് ഇന്റർനെറ്റ് വേണം.'))}</div>`; return; }
        out.innerHTML = `<p class="loading-line">${esc(L('Reading the label…', 'ലേബൽ വായിക്കുന്നു…'))}</p>`;
        try {
            const small = window.NxCamera ? await NxCamera.shrink(file, 1400) : file;
            const res = await fetch(`${API_BASE}/api/pill-check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: await toDataUrl(small), medicines: meds() }) });
            if (!res.ok) throw new Error('pill check ' + res.status);
            const d = await res.json();
            const read = d.label_text ? `<p class="nxh-muted">${esc(L('Label says', 'ലേബലിൽ'))}: “${esc(d.label_text)}”${d.expiry ? ` · ${esc(L('Expiry', 'കാലാവധി'))}: ${esc(d.expiry)}` : ''}</p>` : '';
            if (!d.readable) {
                out.innerHTML = `<div class="nxc-issue"><b>📷 ${esc(L("I couldn't read a printed label", 'അച്ചടിച്ച ലേബൽ വായിക്കാനായില്ല'))}</b><p>${esc(L('Take the photo again, close up, with the name and strength printed on the strip or box in good light. Loose pills cannot be checked from a photo: ask your pharmacist.', 'പേരും സ്ട്രെങ്ത്തും അച്ചടിച്ച ഭാഗം അടുത്ത്, നല്ല വെളിച്ചത്തിൽ വീണ്ടും എടുക്കുക. ഒറ്റ ഗുളികകൾ ഫോട്ടോയിൽ നിന്ന് പരിശോധിക്കാനാവില്ല: ഫാർമസിസ്റ്റിനോട് ചോദിക്കുക.'))}</p></div>`;
            } else if (d.match && d.same_strength !== false) {
                out.innerHTML = `<div class="nxc-ok"><b>✅ ${esc(L(`This looks like ${d.match}, which is in your schedule.`, `ഇത് ${d.match} ആണെന്ന് തോന്നുന്നു, നിങ്ങളുടെ ഷെഡ്യൂളിൽ ഉണ്ട്.`))}</b>${read}<p class="nxh-muted">${esc(L('This only compares the printed label with your list. Take it as your doctor prescribed.', 'ഇത് അച്ചടിച്ച ലേബൽ നിങ്ങളുടെ പട്ടികയുമായി താരതമ്യം ചെയ്യുക മാത്രം. ഡോക്ടർ നിർദ്ദേശിച്ചതുപോലെ കഴിക്കുക.'))}</p></div>`;
            } else if (d.match) {
                out.innerHTML = `<div class="nxc-issue high"><b>⚠️ ${esc(L(`Different strength from your schedule (${d.match})`, `ഷെഡ്യൂളിലുള്ളതിൽ (${d.match}) നിന്ന് വ്യത്യസ്ത സ്ട്രെങ്ത്`))}</b>${read}<p>${esc(L('Check with your pharmacist before taking it.', 'കഴിക്കുന്നതിന് മുമ്പ് ഫാർമസിസ്റ്റിനോട് ഉറപ്പിക്കുക.'))}</p></div>` + safetyHtml(d);
            } else {
                out.innerHTML = `<div class="nxc-issue high"><b>⚠️ ${esc(L('This is not one of your medicines', 'ഇത് നിങ്ങളുടെ മരുന്നുകളിൽ ഒന്നല്ല'))}</b>${read}<p>${esc(L('It does not match anything in your schedule. Do not take it until your doctor or pharmacist says it is right for you.', 'ഇത് ഷെഡ്യൂളിലെ ഒന്നുമായും ചേരുന്നില്ല. ഡോക്ടറോ ഫാർമസിസ്റ്റോ പറയുന്നതുവരെ കഴിക്കരുത്.'))}</p></div>` + safetyHtml(d);
            }
        } catch (e) {
            console.warn('[pill check]', e);
            out.innerHTML = `<div class="nxc-issue">${esc(L("Sorry, I couldn't check the photo right now. Please try again.", 'ക്ഷമിക്കണം, ഇപ്പോൾ ഫോട്ടോ പരിശോധിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.'))}</div>`;
        }
    });
})();
