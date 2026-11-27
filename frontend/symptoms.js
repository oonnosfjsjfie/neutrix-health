// Symptom diary (Tracker page): quick symptom log with how bad it is. Danger symptoms show "get help now".
// Data: 'neutrixSymptoms' (per issue) [{ at, symptoms: [...], severity: 'mild'|'moderate'|'severe', note }]
(function () {
    const box = document.getElementById('symptomDiary');
    if (!box || !window.NxCare) return;
    const C = window.NxCare, esc = C.esc, L = C.L;
    const CHIPS = [
        ['Chest pain', 'നെഞ്ചുവേദന', true], ['Breathlessness', 'ശ്വാസംമുട്ടൽ', true], ['Fainting', 'ബോധക്ഷയം', true], ['Bleeding', 'രക്തസ്രാവം', true],
        ['Face / arm weakness', 'മുഖം / കൈ ബലക്കുറവ്', true], ['Dizziness', 'തലകറക്കം'], ['Palpitations', 'നെഞ്ചിടിപ്പ്'], ['Swelling', 'നീര്'],
        ['Fever', 'പനി'], ['Cough', 'ചുമ'], ['Tiredness', 'ക്ഷീണം'], ['Headache', 'തലവേദന'], ['Nausea / vomiting', 'ഓക്കാനം / ഛർദ്ദി'],
        ['Pain at wound', 'മുറിവിൽ വേദന'], ['Poor sleep', 'ഉറക്കക്കുറവ്'], ['Low mood', 'മനസ്സ് വിഷമം']
    ];
    const SEV = [['mild', 'Mild', 'നേരിയ'], ['moderate', 'Moderate', 'ഇടത്തരം'], ['severe', 'Severe', 'കഠിനം']];
    let picked = new Set(), sev = 'mild';
    const list = () => storeGet('neutrixSymptoms') || [];
    function when(iso) { try { return new Date(iso).toLocaleString(localeFor(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } }
    function render(alert) {
        const entries = list().slice().reverse().slice(0, 20);
        box.innerHTML = `<div class="section-title">${esc(L('Symptom diary', 'ലക്ഷണ ഡയറി'))}</div>
            <p class="hint">${esc(L('Tap what you feel, how bad it is, and save. Your doctor sees these in the Doctor Card and in messages.', 'അനുഭവപ്പെടുന്നത് തിരഞ്ഞെടുത്ത് എത്ര കഠിനമാണെന്ന് പറഞ്ഞ് സേവ് ചെയ്യുക. ഡോക്ടർ കാർഡിലും സന്ദേശങ്ങളിലും ഡോക്ടർക്ക് കാണാം.'))}</p>
            <div class="sd-chips">${CHIPS.map((c, i) => `<button type="button" class="sd-chip${picked.has(c[0]) ? ' on' : ''}${c[2] ? ' danger' : ''}" data-i="${i}" aria-pressed="${picked.has(c[0])}">${esc(L(c[0], c[1]))}</button>`).join('')}</div>
            <div class="sd-row"><span class="sd-lbl">${esc(L('How bad?', 'എത്ര കഠിനം?'))}</span>${SEV.map(s => `<button type="button" class="sd-sev${sev === s[0] ? ' on' : ''}" data-sev="${s[0]}" aria-pressed="${sev === s[0]}">${esc(L(s[1], s[2]))}</button>`).join('')}</div>
            <input type="text" class="modern-input sd-note" maxlength="200" placeholder="${esc(L('Anything else? (optional)', 'മറ്റെന്തെങ്കിലും? (ഐച്ഛികം)'))}">
            <button type="button" class="btn-primary sd-save"${picked.size ? '' : ' disabled'}>${esc(L('Save symptom', 'ലക്ഷണം സേവ് ചെയ്യുക'))}</button>
            ${alert ? `<div class="nxc-urgent" role="alert"><b>⚠️ ${esc(L('This can be serious', 'ഇത് ഗുരുതരമാകാം'))}</b><p>${esc(L('If it is happening now, is severe, or does not go away, get help now. Do not wait for the next check-up.', 'ഇപ്പോൾ സംഭവിക്കുന്നതോ കഠിനമോ മാറാത്തതോ ആണെങ്കിൽ ഉടൻ സഹായം തേടുക. അടുത്ത പരിശോധന വരെ കാത്തിരിക്കരുത്.'))} <a href="care.html">${esc(L('See warning signs', 'അപകട ലക്ഷണങ്ങൾ കാണുക'))}</a></p>${C.callButtons()}</div>` : ''}
            ${entries.length ? `<ul class="sd-list">${entries.map(e => `<li><span><b>${esc(e.symptoms.join(', '))}</b> <span class="sd-tag ${esc(e.severity)}">${esc(L(...(SEV.find(s => s[0] === e.severity) || SEV[0]).slice(1)))}</span>${e.note ? `<br><span class="nxh-muted">${esc(e.note)}</span>` : ''}</span><span class="nxh-muted">${esc(when(e.at))}</span><button type="button" class="sd-del" data-at="${esc(e.at)}" aria-label="${esc(L('Delete', 'ഇല്ലാതാക്കുക'))}">✕</button></li>`).join('')}</ul>` : ''}`;
        box.querySelectorAll('.sd-chip').forEach(b => b.addEventListener('click', () => { const c = CHIPS[+b.dataset.i][0]; picked.has(c) ? picked.delete(c) : picked.add(c); render(); }));
        box.querySelectorAll('.sd-sev').forEach(b => b.addEventListener('click', () => { sev = b.dataset.sev; render(); }));
        box.querySelector('.sd-save').addEventListener('click', () => {
            const note = box.querySelector('.sd-note').value.trim();
            const symptoms = [...picked];
            const all = list();
            all.push({ at: new Date().toISOString(), symptoms, severity: sev, note });
            storeSet('neutrixSymptoms', all.slice(-300));
            const danger = symptoms.some(s => (CHIPS.find(c => c[0] === s) || [])[2]) || sev === 'severe';
            picked = new Set(); sev = 'mild';
            render(danger);
        });
        box.querySelectorAll('.sd-del').forEach(b => b.addEventListener('click', () => { storeSet('neutrixSymptoms', list().filter(e => e.at !== b.dataset.at)); render(); }));
    }
    render();
    document.addEventListener('neutrix:langchange', () => render());
})();
