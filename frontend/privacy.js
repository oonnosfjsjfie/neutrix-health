// Privacy & consent page: what Neutrix keeps, where it goes, consent, and "delete my data"
(function () {
    const ml = () => window.neutrixLang === 'Malayalam';
    const L = (en, m) => (ml() && m ? m : en);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = id => document.getElementById(id);
    const signedIn = () => localStorage.getItem('neutrix_authenticated') === 'true';
    let status = '';

    const SECTIONS = () => [
        [L('What Neutrix is', 'Neutrix എന്താണ്'), [
            L('Neutrix helps you understand and follow the care your doctor gave you. It explains your own reports in simple words and helps you take medicines on time.', 'ഡോക്ടർ നൽകിയ ചികിത്സ മനസ്സിലാക്കാനും പിന്തുടരാനും Neutrix സഹായിക്കുന്നു.'),
            L('It is not a doctor and not a medical device. It does not diagnose or prescribe. Always follow your doctor, and check anything important with them.', 'ഇത് ഡോക്ടറോ മെഡിക്കൽ ഉപകരണമോ അല്ല. രോഗനിർണ്ണയം നടത്തുകയോ മരുന്ന് നിർദ്ദേശിക്കുകയോ ചെയ്യുന്നില്ല.'),
            L('The AI can make mistakes. Use “Where it says this” to check against your report, and trust the paper report and your doctor over the app.', 'AI-ക്ക് തെറ്റ് പറ്റാം. “റിപ്പോർട്ടിൽ എവിടെ” ഉപയോഗിച്ച് പരിശോധിക്കുക.')]],
        [L('What is kept, and where', 'എന്ത് സൂക്ഷിക്കുന്നു, എവിടെ'), [
            L('On your device: your reports’ text, summaries, plans, ticks, readings and symptoms, so the app works offline.', 'നിങ്ങളുടെ ഉപകരണത്തിൽ: റിപ്പോർട്ടുകളുടെ ടെക്സ്റ്റ്, സംഗ്രഹങ്ങൾ, പ്ലാനുകൾ, ടിക്കുകൾ, റീഡിംഗുകൾ.'),
            L('In your Neutrix account (Google Firebase), so it syncs between your phone and computer. Only you can read it.', 'നിങ്ങളുടെ Neutrix അക്കൗണ്ടിൽ (Google Firebase), ഫോണും കമ്പ്യൂട്ടറും തമ്മിൽ സിങ്ക് ചെയ്യാൻ. നിങ്ങൾക്ക് മാത്രമേ വായിക്കാനാകൂ.'),
            L('The Neutrix team can see only your email, phone number and gender (to contact you), plus any ratings or problem reports you send. Never your medical data.', 'Neutrix ടീമിന് ഇമെയിൽ, ഫോൺ, ലിംഗം എന്നിവ മാത്രം കാണാം. മെഡിക്കൽ ഡാറ്റ ഒരിക്കലും കാണില്ല.')]],
        [L('What goes to the AI', 'AI-ലേക്ക് എന്ത് പോകുന്നു'), [
            L('To make summaries, plans, schedules, check-ups, test trends and the 3D map, the text and photos of your reports are sent to Google’s Gemini AI.', 'സംഗ്രഹങ്ങളും പ്ലാനുകളും ഉണ്ടാക്കാൻ റിപ്പോർട്ടുകളുടെ ടെക്സ്റ്റും ഫോട്ടോകളും Google Gemini AI-ലേക്ക് അയയ്ക്കുന്നു.'),
            L('When you talk to Emma, your voice or message and what is on your screen are sent to Gemini to answer you. The medicine photo check sends that photo.', 'എമ്മയോട് സംസാരിക്കുമ്പോൾ നിങ്ങളുടെ ശബ്ദവും സ്ക്രീനിലുള്ളതും Gemini-ലേക്ക് അയയ്ക്കുന്നു.'),
            L('Neutrix does not keep these copies and never sells your data. Google processes them under its Gemini API terms.', 'Neutrix ഈ പകർപ്പുകൾ സൂക്ഷിക്കുന്നില്ല, നിങ്ങളുടെ ഡാറ്റ ഒരിക്കലും വിൽക്കുന്നില്ല.')]],
        [L('Sharing', 'പങ്കിടൽ'), [
            L('Nothing is shared unless you choose to: sending a message to your doctor, or turning on Family sharing (only doses, the last 7 days, refills and serious symptoms).', 'നിങ്ങൾ തിരഞ്ഞെടുത്താൽ മാത്രം പങ്കിടും: ഡോക്ടർക്ക് സന്ദേശം, അല്ലെങ്കിൽ കുടുംബ പങ്കിടൽ.')]],
        [L('Your rights', 'നിങ്ങളുടെ അവകാശങ്ങൾ'), [
            L('You can see, change or delete your data at any time. India’s Digital Personal Data Protection Act gives you these rights.', 'എപ്പോൾ വേണമെങ്കിലും ഡാറ്റ കാണാനും മാറ്റാനും ഇല്ലാതാക്കാനും കഴിയും (ഡിജിറ്റൽ പേഴ്സണൽ ഡാറ്റ സംരക്ഷണ നിയമം).'),
            L('Use “Delete all my data” below, or “Report a problem” to ask us anything.', 'താഴെയുള്ള “എല്ലാ ഡാറ്റയും ഇല്ലാതാക്കുക” ഉപയോഗിക്കുക.')]]
    ];

    function render() {
        $('pvSideTitle').textContent = L('In short', 'ചുരുക്കത്തിൽ');
        $('pvSide').innerHTML = [L('Only you can read your medical data.', 'നിങ്ങളുടെ മെഡിക്കൽ ഡാറ്റ നിങ്ങൾക്ക് മാത്രം.'), L('Reports are read by Google’s AI to explain them to you.', 'റിപ്പോർട്ടുകൾ വിശദീകരിക്കാൻ Google AI വായിക്കുന്നു.'), L('Nothing is sold.', 'ഒന്നും വിൽക്കുന്നില്ല.'), L('You can delete everything.', 'എല്ലാം ഇല്ലാതാക്കാം.')].map(x => `<li>${esc(x)}</li>`).join('');
        const consent = (() => { try { return JSON.parse(localStorage.getItem('neutrixConsent') || 'null'); } catch (e) { return null; } })();
        $('pvView').innerHTML = `<div class="card-header"><div><h2>🔒 ${esc(L('Privacy & consent', 'സ്വകാര്യതയും സമ്മതവും'))}</h2>
            <p class="subtitle">${esc(L('Plain words, no small print.', 'ലളിതമായ വാക്കുകളിൽ.'))}</p></div></div>
            ${SECTIONS().map(([h, items]) => `<div class="pv-sec"><h3>${esc(h)}</h3><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}
            <div class="pv-sec"><h3>${esc(L('Your consent', 'നിങ്ങളുടെ സമ്മതം'))}</h3>
                <p>${consent ? esc(L(`You agreed on ${new Date(consent.at).toLocaleString(localeFor())}.`, `${new Date(consent.at).toLocaleString(localeFor())}-ന് സമ്മതിച്ചു.`)) : esc(L('You have not agreed yet. You will be asked when you use the app.', 'ഇതുവരെ സമ്മതിച്ചിട്ടില്ല.'))}</p></div>
            ${signedIn() ? `<div class="pv-sec pv-danger"><h3>🗑 ${esc(L('Delete all my data', 'എന്റെ എല്ലാ ഡാറ്റയും ഇല്ലാതാക്കുക'))}</h3>
                <p>${esc(L('This deletes all your medical issues, reports, plans, ticks, readings and symptoms from this device and from your Neutrix account, stops family sharing, and signs you out. It cannot be undone.', 'ഇത് എല്ലാ മെഡിക്കൽ പ്രശ്നങ്ങളും റിപ്പോർട്ടുകളും പ്ലാനുകളും ടിക്കുകളും ഈ ഉപകരണത്തിൽ നിന്നും അക്കൗണ്ടിൽ നിന്നും ഇല്ലാതാക്കി സൈൻ ഔട്ട് ചെയ്യും. തിരിച്ചെടുക്കാനാവില്ല.'))}</p>
                <p class="nxh-muted">${esc(L('Your sign-in itself stays. To remove it too, send “Report a problem” asking to delete your account.', 'സൈൻ-ഇൻ അക്കൗണ്ട് നിലനിൽക്കും. അതും നീക്കാൻ “പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക” വഴി ആവശ്യപ്പെടുക.'))}</p>
                <label class="pv-confirm">${esc(L('Type DELETE to confirm', 'ഉറപ്പിക്കാൻ DELETE എന്ന് ടൈപ്പ് ചെയ്യുക'))} <input class="modern-input" id="pvType" autocomplete="off"></label>
                <button type="button" class="btn-primary pv-del" id="pvDel" disabled>${esc(L('Delete everything', 'എല്ലാം ഇല്ലാതാക്കുക'))}</button>
                <p class="hint" id="pvStatus">${esc(status)}</p></div>` : ''}`;
        const typed = $('pvType'), del = $('pvDel');
        if (typed) typed.addEventListener('input', () => { del.disabled = typed.value.trim() !== 'DELETE'; });
        if (del) del.addEventListener('click', deleteAll);
    }

    async function deleteAll() {
        const del = $('pvDel');
        del.disabled = true;
        const say = t => { status = t; const s = $('pvStatus'); if (s) s.textContent = t; };
        say(L('Deleting…', 'ഇല്ലാതാക്കുന്നു…'));
        // 1. nothing waits to be uploaded again
        const shareCodes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (/^neutrixShare(::|$)/.test(k)) { try { const v = JSON.parse(Storage.prototype.getItem.call(localStorage, k) || 'null'); if (v && v.code) shareCodes.push(v.code); } catch (e) {} }
        }
        try { localStorage.removeItem('neutrixCloudDirty'); } catch (e) {}
        // 2. the account's copy
        let cloudOk = true;
        try {
            if (window.NeutrixCloud && NeutrixCloud.configured) {
                const { db } = await NeutrixCloud.init();
                const user = await NeutrixCloud.currentUser();
                if (user) {
                    for (const col of ['store', 'chunks']) {
                        const snap = await db.collection('users').doc(user.uid).collection(col).get();
                        for (let i = 0; i < snap.docs.length; i += 400) {
                            const batch = db.batch();
                            snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
                            await batch.commit();
                        }
                    }
                    await db.collection('users').doc(user.uid).delete().catch(() => {});
                    await db.collection('contacts').doc(user.uid).delete().catch(() => {});
                    for (const c of shareCodes) await db.collection('shares').doc(c).delete().catch(() => {});
                }
            }
        } catch (e) { console.warn('[privacy] delete', e); cloudOk = false; }
        if (!cloudOk) { say(L('Could not delete the copy in your account (check the internet). Nothing was signed out; please try again.', 'അക്കൗണ്ടിലെ പകർപ്പ് ഇല്ലാതാക്കാനായില്ല (ഇന്റർനെറ്റ് നോക്കുക). വീണ്ടും ശ്രമിക്കുക.')); del.disabled = false; return; }        // 3. this device (without uploading anything again), then sign out
        say(L('All your data is deleted. Signing out…', 'എല്ലാ ഡാറ്റയും ഇല്ലാതാക്കി. സൈൻ ഔട്ട് ചെയ്യുന്നു…'));
        try { if (window.NeutrixCloud && NeutrixCloud.forgetDevice) await NeutrixCloud.forgetDevice(); } catch (e) {}
        try { Object.keys(localStorage).filter(k => /^nxAssistant|^nxVoice/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}   // Emma's settings (not synced)
        try { (await caches.keys()).filter(k => /^nx-voice/.test(k)).forEach(k => caches.delete(k)); } catch (e) {}
        setTimeout(() => location.replace('signin.html'), 1200);
    }

    render();
    document.addEventListener('neutrix:langchange', render);
})();
