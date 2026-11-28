// My Care: when to get help, medicine safety check, this week's medicines, refills, food tips (nx-care.js)
(function () {
    const C = window.NxCare, esc = C.esc, L = C.L;
    const $ = id => document.getElementById(id);
    const record = loadReport();

    function day(k) { try { return new Date(k + 'T00:00:00').toLocaleDateString(localeFor(), { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return k; } }

    function renderHow() {
        $('careHowTitle').textContent = L('How this page helps', 'ഈ പേജ് എങ്ങനെ സഹായിക്കുന്നു');
        $('careHow').innerHTML = [
            L('Warning signs come from the conditions in your report, so you know when to get help at once.', 'റിപ്പോർട്ടിലെ രോഗങ്ങളിൽ നിന്നുള്ള അപകട ലക്ഷണങ്ങൾ: എപ്പോൾ ഉടൻ സഹായം തേടണമെന്ന് അറിയാൻ.'),
            L('The safety check looks at today’s medicines for unusual doses, duplicates and known risky combinations. It never tells you to stop a medicine.', 'സുരക്ഷാ പരിശോധന ഇന്നത്തെ മരുന്നുകളിൽ അസാധാരണ ഡോസുകൾ, ഇരട്ടിപ്പ്, അപകടകരമായ ചേർച്ചകൾ എന്നിവ നോക്കുന്നു. ഒരു മരുന്നും നിർത്താൻ പറയില്ല.'),
            L('Tap “Where it says this” to see the exact line in your report.', '“റിപ്പോർട്ടിൽ എവിടെ” അമർത്തി റിപ്പോർട്ടിലെ വരി കാണുക.'),
            L('Everything here is fixed medical guidance checked against your saved data. It works offline.', 'ഇവിടെയുള്ളതെല്ലാം സ്ഥിരമായ മെഡിക്കൽ മാർഗ്ഗനിർദ്ദേശമാണ്. ഓഫ്‌ലൈനിലും പ്രവർത്തിക്കും.')
        ].map(x => `<li>${esc(x)}</li>`).join('');
    }

    function renderUrgent() {
        const u = C.urgentReadings();
        $('careUrgent').innerHTML = u.length ? `<div class="nxc-urgent" role="alert"><b>⚠️ ${esc(L('Check this now', 'ഇപ്പോൾ ശ്രദ്ധിക്കുക'))}</b>${u.map(x => `<p>${esc(x)}</p>`).join('')}${C.callButtons()}</div>` : '';
    }

    function renderWarn() {
        const list = C.warnings();
        const general = [L('Fainting, or suddenly very confused or drowsy', 'ബോധക്ഷയം, പെട്ടെന്നുള്ള ആശയക്കുഴപ്പം, മയക്കം'), L('Severe breathlessness or chest pain', 'കഠിനമായ ശ്വാസംമുട്ടൽ, നെഞ്ചുവേദന'), L('Anything that feels like an emergency', 'അടിയന്തരമെന്ന് തോന്നുന്ന എന്തും')];
        $('careWarn').innerHTML = `<div class="card-header"><div><h2>🚨 ${esc(L('When to get help now', 'എപ്പോൾ ഉടൻ സഹായം തേടണം'))}</h2>
            <p class="subtitle">${esc(L('If you notice any of these, call an ambulance or go to the nearest emergency department. Do not wait.', 'ഇവയിൽ ഏതെങ്കിലും ഉണ്ടെങ്കിൽ ആംബുലൻസ് വിളിക്കുക അല്ലെങ്കിൽ അടുത്തുള്ള അത്യാഹിത വിഭാഗത്തിലേക്ക് പോകുക. കാത്തിരിക്കരുത്.'))}</p></div></div>
            ${C.callButtons()}
            <div class="nxc-signs">${(list.length ? list : [{ name: L('Always', 'എപ്പോഴും'), signs: general }]).map(c => `<div class="nxc-sign-group"><h3>${esc(c.name)}</h3><ul>${c.signs.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('')}
            ${list.length ? `<div class="nxc-sign-group"><h3>${esc(L('Always', 'എപ്പോഴും'))}</h3><ul>${general.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}</div>
            <p class="hint">${esc(L('These are the common warning signs for the conditions in your report. Your doctor may have told you others: follow what they said.', 'റിപ്പോർട്ടിലെ രോഗങ്ങൾക്കുള്ള സാധാരണ അപകട ലക്ഷണങ്ങളാണിവ. ഡോക്ടർ മറ്റെന്തെങ്കിലും പറഞ്ഞിട്ടുണ്ടെങ്കിൽ അത് പിന്തുടരുക.'))}</p>`;
    }

    function renderSafety() {
        const sch = storeGet('neutrixSchedule');
        const doses = sch && sch.reportId === record.createdAt ? dosesForDay(sch, dayKey(new Date())) : [];
        const box = $('careSafety');
        let html = `<div class="card-header"><div><h2>💊 ${esc(L('Medicine safety check', 'മരുന്ന് സുരക്ഷാ പരിശോധന'))}</h2>
            <p class="subtitle">${esc(L('Today’s medicines, checked for unusual doses, the same medicine twice, and known risky combinations.', 'ഇന്നത്തെ മരുന്നുകൾ: അസാധാരണ ഡോസ്, ഒരേ മരുന്ന് രണ്ടുതവണ, അപകടകരമായ ചേർച്ചകൾ.'))}</p></div></div>`;
        if (!doses.length) {
            box.innerHTML = html + `<p class="hint">${esc(L('Open your medicine schedule once so your medicines are saved here.', 'മരുന്നുകൾ ഇവിടെ സേവ് ചെയ്യാൻ ഒരിക്കൽ ഷെഡ്യൂൾ തുറക്കുക.'))} <a href="schedule.html">${esc(L('Open schedule', 'ഷെഡ്യൂൾ തുറക്കുക'))}</a></p>`;
            return;
        }
        const issues = C.safety(doses);
        html += issues.length ? issues.map(i => `<div class="nxc-issue ${i.level}"><b>${i.level === 'high' ? '⛔' : '⚠️'} ${esc(i.title)}</b><p>${esc(i.text)}</p></div>`).join('')
            : `<div class="nxc-ok">✅ ${esc(L('No common problems found in today’s medicines.', 'ഇന്നത്തെ മരുന്നുകളിൽ സാധാരണ പ്രശ്നങ്ങളൊന്നും കണ്ടില്ല.'))}</div>`;
        html += `<p class="hint">${esc(L('This checks for common problems only. It is not a full review by a pharmacist, and never stop or change a medicine without asking your doctor.', 'ഇത് സാധാരണ പ്രശ്നങ്ങൾ മാത്രം പരിശോധിക്കുന്നു. ഫാർമസിസ്റ്റിന്റെ പൂർണ്ണ പരിശോധനയല്ല. ഡോക്ടറോട് ചോദിക്കാതെ ഒരു മരുന്നും നിർത്തുകയോ മാറ്റുകയോ ചെയ്യരുത്.'))}</p>`;
        html += `<h3 class="nxh-h3">${esc(L('Your medicines today', 'ഇന്നത്തെ മരുന്നുകൾ'))}</h3><ul class="nxc-medlist"></ul>`;
        box.innerHTML = html;
        const ul = box.querySelector('.nxc-medlist');
        const seen = new Set();
        doses.forEach(d => {
            const k = (d.medicine + d.strength).toLowerCase();
            if (seen.has(k)) return;
            seen.add(k);
            const li = document.createElement('li');
            const slots = doses.filter(x => (x.medicine + x.strength).toLowerCase() === k).map(x => x.slot).join(', ');
            li.innerHTML = `<span><b>${esc(d.medicine)}</b> ${esc(d.strength || '')} <span class="nxh-muted">${esc(slots)}</span></span>`;
            li.appendChild(C.sourceButton(`${d.medicine} ${d.strength || ''}`, [...C.keyWords(d.medicine).slice(0, 1), String(d.strength || '').replace(/\s+/g, ' ').trim()].filter(Boolean)));
            ul.appendChild(li);
        });
    }

    function renderWeek() {
        const a = C.adherence(7);
        const box = $('careWeek');
        if (!a || !a.days.length) { box.innerHTML = ''; return; }
        const max = Math.max(1, ...a.days.map(d => d.due));
        box.innerHTML = `<div class="card-header"><div><h2>📅 ${esc(L('This week', 'ഈ ആഴ്ച'))}</h2>
            <p class="subtitle">${a.pct == null ? esc(L('Tick your doses on the schedule to see how the week is going.', 'ആഴ്ച എങ്ങനെ പോകുന്നുവെന്ന് കാണാൻ ഷെഡ്യൂളിൽ ഡോസുകൾ ടിക്ക് ചെയ്യുക.'))
                : esc(L(`You took ${a.taken} of ${a.due} doses (${a.pct}%) in the last days.`, `കഴിഞ്ഞ ദിവസങ്ങളിൽ ${a.due}-ൽ ${a.taken} ഡോസ് കഴിച്ചു (${a.pct}%).`))}</p></div>
            ${a.pct == null ? '' : `<span class="nxc-pct ${a.pct >= 90 ? 'good' : a.pct >= 70 ? 'mid' : 'low'}">${a.pct}%</span>`}</div>
            <div class="nxc-week">${a.days.map(d => `<div class="nxc-day${d.day === dayKey(new Date()) ? ' today' : ''}" title="${esc(d.taken + '/' + d.due)}">
                <div class="nxc-bar"><span style="height:${Math.round(d.due / max * 100)}%"><i style="height:${d.due ? Math.round(d.taken / d.due * 100) : 0}%"></i></span></div>
                <div class="nxc-dl">${esc(day(d.day).split(',')[0])}</div><div class="nxc-dn">${d.taken}/${d.due}</div></div>`).join('')}</div>
            ${a.pct != null ? `<p class="hint">${esc(a.pct >= 90 ? L('Great work. Keep going!', 'വളരെ നല്ലത്. തുടരുക!') : a.pct >= 70 ? L('Good, but some doses were missed. A phone alarm can help.', 'നല്ലത്, പക്ഷേ ചില ഡോസുകൾ വിട്ടുപോയി. ഫോൺ അലാറം സഹായിക്കും.') : L('Many doses were missed. If something makes it hard to take them, tell your doctor.', 'പല ഡോസുകളും വിട്ടുപോയി. കഴിക്കാൻ ബുദ്ധിമുട്ടുണ്ടെങ്കിൽ ഡോക്ടറോട് പറയുക.'))}</p>` : ''}`;
    }

    function renderRefill() {
        const list = C.refills();
        const box = $('careRefill');
        if (!list.length) { box.innerHTML = ''; return; }
        box.innerHTML = `<div class="card-header"><div><h2>🔁 ${esc(L('Refills', 'മരുന്ന് തീരുന്നത്'))}</h2>
            <p class="subtitle">${esc(L('Count the tablets you have and type the number. We will warn you 5 days before they run out.', 'കൈയിലുള്ള ഗുളികകൾ എണ്ണി എഴുതുക. തീരുന്നതിന് 5 ദിവസം മുമ്പ് ഓർമ്മിപ്പിക്കാം.'))}</p></div></div>
            <div class="nxc-refills">${list.map(r => `<div class="nxc-refill${r.low ? ' low' : ''}">
                <div><b>${esc(r.name)}</b> <span class="nxh-muted">${esc(r.strength)} · ${esc(L(`${r.perDay} a day`, `ദിവസം ${r.perDay}`))}</span>
                <div class="nxc-refill-st">${r.count == null ? esc(L('Not counted yet', 'ഇതുവരെ എണ്ണിയിട്ടില്ല'))
                    : esc(L(`About ${r.left} left · lasts ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} (until ${day(r.runsOut)})`, `ഏകദേശം ${r.left} ബാക്കി · ${r.daysLeft} ദിവസം (${day(r.runsOut)} വരെ)`)) + (r.low ? ' ⚠️ ' + esc(L('Get more soon', 'ഉടൻ വാങ്ങുക')) : '')}</div></div>
                <label class="nxc-refill-in"><span>${esc(L('Tablets I have now', 'ഇപ്പോൾ കൈയിലുള്ളത്'))}</span><input type="number" min="0" step="1" inputmode="numeric" data-key="${esc(r.key)}" value="${r.count == null ? '' : esc(r.left)}"></label>
            </div>`).join('')}</div>`;
        box.querySelectorAll('input[data-key]').forEach(inp => inp.addEventListener('change', () => { C.setRefill(inp.dataset.key, inp.value); renderRefill(); }));
    }

    function renderDiet() {
        const d = C.diet();
        const box = $('careDiet');
        if (!d.tips.length && !d.said.length) { box.innerHTML = ''; return; }
        box.innerHTML = `<div class="card-header"><div><h2>🥗 ${esc(L('Food tips for your conditions', 'നിങ്ങൾക്കുള്ള ഭക്ഷണ നിർദ്ദേശങ്ങൾ'))}</h2>
            <p class="subtitle">${esc(L('Only for the conditions in your report. Your doctor’s or dietitian’s advice comes first.', 'റിപ്പോർട്ടിലെ രോഗങ്ങൾക്ക് മാത്രം. ഡോക്ടറുടെയോ ഡയറ്റീഷ്യന്റെയോ ഉപദേശം ആദ്യം.'))}</p></div></div>
            ${d.said.length ? `<div class="nxc-quote"><div class="nxc-quote-src">${esc(L('What your report says', 'റിപ്പോർട്ടിൽ പറയുന്നത്'))}</div>${d.said.map(s => `<div class="nxc-hit">${esc(s)}</div>`).join('')}</div>` : ''}
            ${d.tips.length ? `<ul class="nxc-tips">${d.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
    }

    function render() {
        renderHow();
        if (!record) {
            $('careEmpty').classList.remove('hidden');
            $('careEmptyText').innerHTML = esc(L('Upload your discharge summary first, then this page shows your warning signs, a medicine safety check and more.', 'ആദ്യം ഡിസ്ചാർജ് സമ്മറി അപ്‌ലോഡ് ചെയ്യുക.')) + ` <a href="summary.html">${esc(L('Upload', 'അപ്‌ലോഡ്'))}</a>`;
            renderUrgent(); renderWarn();
            return;
        }
        renderUrgent(); renderWarn(); renderSafety(); renderWeek(); renderRefill(); renderDiet();
        if (window.NxEnv) NxEnv.render($('careEnv'));
    }
    render();
    document.addEventListener('neutrix:langchange', render);
    // Medicines not saved yet: make the schedule in the background (once), then show the checks
    if (record && window.NxHist) NxHist.syncSchedule(record, { create: true }).then(s => { if (s) { renderSafety(); renderWeek(); renderRefill(); renderWarn(); } }).catch(() => {});
})();
