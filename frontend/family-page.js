// Family Sharing page (the patient's side): turn sharing on/off, show the code, and how to look after someone
(function () {
    const F = window.NxFamily, C = window.NxCare, esc = C.esc, L = C.L;
    const $ = id => document.getElementById(id);
    let busy = false, error = '';
    function how() {
        $('famHowTitle').textContent = L('How it works', 'എങ്ങനെ പ്രവർത്തിക്കുന്നു');
        $('famHow').innerHTML = [
            L('Turn sharing on and give the code to a family member or carer.', 'പങ്കിടൽ ഓണാക്കി കോഡ് കുടുംബാംഗത്തിനോ പരിചാരകനോ നൽകുക.'),
            L('They sign in to Neutrix with their own account, open “Look after someone” and type the code.', 'അവർ സ്വന്തം അക്കൗണ്ടിൽ Neutrix-ൽ സൈൻ ഇൻ ചെയ്ത് “മറ്റൊരാളെ നോക്കുക” തുറന്ന് കോഡ് ടൈപ്പ് ചെയ്യുക.'),
            L('They see only: today’s doses (taken or not), the last 7 days, medicines running low, and serious symptoms or readings. Never your reports.', 'അവർ കാണുന്നത് മാത്രം: ഇന്നത്തെ ഡോസുകൾ, കഴിഞ്ഞ 7 ദിവസം, തീരാറായ മരുന്നുകൾ, ഗുരുതര ലക്ഷണങ്ങൾ. റിപ്പോർട്ടുകൾ ഒരിക്കലും കാണില്ല.'),
            L('It updates each time you tick a dose. Turn it off any time: the shared copy is deleted.', 'ഡോസ് ടിക്ക് ചെയ്യുമ്പോഴെല്ലാം അപ്ഡേറ്റ് ചെയ്യും. എപ്പോൾ വേണമെങ്കിലും ഓഫാക്കാം: പങ്കിട്ട പകർപ്പ് ഇല്ലാതാക്കും.')
        ].map(x => `<li>${esc(x)}</li>`).join('');
    }
    function render() {
        how();
        const share = storeGet('neutrixShare');
        const s = F.summary();
        const issue = (window.neutrixActiveIssue || {}).title || '';
        const errorBox = error ? `<div class="nxc-issue high">${esc(error)}</div>` : '';
        if (!share) {
            $('famOwner').innerHTML = `<div class="card-header"><div><h2>👨‍👩‍👧 ${esc(L('Share with family', 'കുടുംബവുമായി പങ്കിടുക'))}</h2>
                <p class="subtitle">${esc(L(`Let a son, daughter or carer see whether the medicines for “${issue}” are being taken.`, `“${issue}” മരുന്നുകൾ കഴിക്കുന്നുണ്ടോ എന്ന് മകനോ മകളോ പരിചാരകനോ കാണട്ടെ.`))}</p></div></div>
                <div class="fam-preview"><b>${esc(L('They will see', 'അവർ കാണുന്നത്'))}:</b><ul>
                    <li>${esc(L(`Today: ${s.taken} of ${s.due} doses taken, and which are still to take`, `ഇന്ന്: ${s.due}-ൽ ${s.taken} ഡോസ്, ബാക്കിയുള്ളവ`))}</li>
                    <li>${esc(L('The last 7 days', 'കഴിഞ്ഞ 7 ദിവസം'))}</li><li>${esc(L('Medicines running low', 'തീരാറായ മരുന്നുകൾ'))}</li>
                    <li>${esc(L('Serious symptoms or readings from the last 3 days', 'കഴിഞ്ഞ 3 ദിവസത്തെ ഗുരുതര ലക്ഷണങ്ങൾ / റീഡിംഗുകൾ'))}</li></ul>
                    <p class="nxh-muted">${esc(L('Your first name and the issue name are shown too. Your reports and documents are never shared.', 'നിങ്ങളുടെ പേരിന്റെ ആദ്യഭാഗവും പ്രശ്നത്തിന്റെ പേരും കാണിക്കും. റിപ്പോർട്ടുകൾ ഒരിക്കലും പങ്കിടില്ല.'))}</p></div>
                ${errorBox}
                <button type="button" class="btn-primary fam-on"${busy ? ' disabled' : ''}>${esc(busy ? L('Turning on…', 'ഓണാക്കുന്നു…') : L('Turn on sharing', 'പങ്കിടൽ ഓണാക്കുക'))}</button>`;
            $('famOwner').querySelector('.fam-on').addEventListener('click', async () => {
                busy = true; error = ''; render();
                try { await F.start(); }
                catch (e) {
                    console.warn('[family]', e);
                    error = /permission|insufficient/i.test(String(e && (e.code || e.message))) ? L('Sharing is not switched on for this app yet (the database rules need updating). Please ask the Neutrix team.', 'ഈ ആപ്പിൽ പങ്കിടൽ ഇതുവരെ ഓണാക്കിയിട്ടില്ല.')
                        : /not-signed-in/.test(String(e && e.message)) ? L('Please sign in again first.', 'ആദ്യം വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.') : L('Could not turn on sharing. Check the internet and try again.', 'പങ്കിടൽ ഓണാക്കാനായില്ല. ഇന്റർനെറ്റ് നോക്കി വീണ്ടും ശ്രമിക്കുക.');
                }
                busy = false; render();
            });
        } else {
            const link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'caregiver.html?code=' + share.code;
            const msg = L(`I'm sharing how my medicines are going on Neutrix Health. Open ${link} (sign in) and use code ${F.fmtCode(share.code)}.`, `Neutrix Health-ൽ എന്റെ മരുന്നുകൾ പങ്കിടുന്നു. ${link} തുറന്ന് (സൈൻ ഇൻ ചെയ്ത്) ${F.fmtCode(share.code)} കോഡ് ഉപയോഗിക്കുക.`);
            $('famOwner').innerHTML = `<div class="card-header"><div><h2>👨‍👩‍👧 ${esc(L('Sharing is on', 'പങ്കിടൽ ഓണാണ്'))}</h2>
                <p class="subtitle">${esc(L(`For “${issue}”, since ${new Date(share.since).toLocaleDateString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric' })}.`, `“${issue}”, ${new Date(share.since).toLocaleDateString(localeFor())} മുതൽ.`))}</p></div></div>
                <div class="fam-code" aria-label="${esc(L('Share code', 'പങ്കിടൽ കോഡ്'))}">${esc(F.fmtCode(share.code))}</div>
                <div class="fam-actions"><button type="button" class="btn-secondary fam-copy">${esc(L('Copy message', 'സന്ദേശം പകർത്തുക'))}</button>
                    <a class="btn-secondary" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${esc(L('Send on WhatsApp', 'WhatsApp-ൽ അയയ്ക്കുക'))}</a>
                    <button type="button" class="btn-secondary fam-off">${esc(L('Stop sharing', 'പങ്കിടൽ നിർത്തുക'))}</button></div>
                <p class="hint fam-status"></p>${errorBox}`;
            $('famOwner').querySelector('.fam-copy').addEventListener('click', async () => {
                try { await navigator.clipboard.writeText(msg); $('famOwner').querySelector('.fam-status').textContent = L('Copied.', 'പകർത്തി.'); } catch (e) { prompt('', msg); }
            });
            $('famOwner').querySelector('.fam-off').addEventListener('click', async () => { await F.stop(); render(); });
            F.update().then(ok => { const st = $('famOwner').querySelector('.fam-status'); if (st) st.textContent = ok ? L('Up to date.', 'പുതുക്കി.') : L('Could not update right now; it will try again when you tick a dose.', 'ഇപ്പോൾ പുതുക്കാനായില്ല; ഡോസ് ടിക്ക് ചെയ്യുമ്പോൾ വീണ്ടും ശ്രമിക്കും.'); });
        }
        $('famWatch').innerHTML = `<div class="card-header"><div><h2>🤝 ${esc(L('Look after someone', 'മറ്റൊരാളെ നോക്കുക'))}</h2>
            <p class="subtitle">${esc(L('If a family member shared a code with you, see how their medicines are going.', 'ഒരു കുടുംബാംഗം കോഡ് പങ്കിട്ടെങ്കിൽ, അവരുടെ മരുന്നുകൾ എങ്ങനെ പോകുന്നുവെന്ന് കാണുക.'))}</p></div></div>
            <a class="btn-primary" href="caregiver.html" style="display:inline-block;width:auto">${esc(L('Open “Looking after”', '“നോക്കുന്നവർ” തുറക്കുക'))}</a>`;
    }
    render();
    document.addEventListener('neutrix:langchange', render);
})();
