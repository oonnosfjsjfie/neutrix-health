// Doctor Card: one page for any doctor (always in English), from what is saved on this device.
// Print, PDF, or a QR code the doctor can scan to get the same facts as text.
(function () {
    const C = window.NxCare, esc = C.esc, L = C.L;
    const $ = id => document.getElementById(id);
    const record = loadReport();
    const todayK = dayKey(new Date());
    const fmt = iso => { try { return new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso || ''; } };
    const SLOTS = ['morning', 'afternoon', 'evening', 'night', 'unclear'];

    function profile() { try { return JSON.parse(localStorage.getItem('neutrix_hospital_profile') || '{}'); } catch (e) { return {}; } }
    function firstSentences(md, n) {
        const plain = String(md || '').split('\n').filter(l => !/^\s*#/.test(l)).join(' ').replace(/[*_>`|#]/g, ' ').replace(/\s+/g, ' ').trim();
        return (plain.match(/[^.!?]+[.!?]/g) || [plain]).slice(0, n).join(' ').trim();
    }

    // Everything on the card, as data
    function gather() {
        const p = profile();
        const issue = window.neutrixActiveIssue || {};
        const f = { name: p.patientName || '', age: p.age || '', sex: p.gender || '', blood: p.bloodGroup || '', allergies: p.allergies || 'Not recorded',
            phone: p.patientPhone || '', carer: [p.caregiverName, p.caregiverPhone && p.caregiverPhone !== 'Not provided' ? p.caregiverPhone : ''].filter(Boolean).join(', '),
            problem: issue.title || '', summary: '', meds: [], change: null, labs: [], readings: [], adherence: null, missedTop: [], symptoms: [], nextCheckup: '', missedCheckups: [], flags: [] };
        if (record) {
            const sum = (record.summaries && (record.summaries.English || record.summaries.Malayalam)) || '';
            f.summary = firstSentences(sum, 3);
        }
        const sch = storeGet('neutrixSchedule');
        if (sch && record && sch.reportId === record.createdAt) {
            const doses = dosesForDay(sch, todayK);
            const g = window.NxHist ? NxHist.group(doses) : new Map();
            f.meds = [...g.values()].map(x => ({ name: x.name, strength: x.strength, dose: x.dose, when: SLOTS.filter(s => x.slots.has(s)).map(s => s === 'unclear' ? 'time not stated' : s).join(', ') }));
            const tl = window.NxHist ? NxHist.medTimeline(sch) : [];
            if (tl[0] && !tl[0].first && (tl[0].added.length + tl[0].changed.length + tl[0].stopped.length)) f.change = tl[0];
            f.flags = C.safety(doses).map(x => x.title);
        }
        const lab = storeGet('neutrixLabTrends');
        ((lab && lab.data && lab.data.tests) || []).forEach(t => {
            const pts = t.points.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const last = pts[pts.length - 1], prev = pts[pts.length - 2];
            f.labs.push({ name: t.name, unit: t.unit, last: last.value, date: last.date, prev: prev ? prev.value : '', normal: t.normal });
        });
        f.labs = f.labs.slice(0, 10);
        const tr = (storeGet('neutrixTracker') || []).slice(-30);
        const lastOf = k => { for (let i = tr.length - 1; i >= 0; i--) if (String(tr[i][k] || '').trim()) return tr[i]; return null; };
        [['bp', 'Blood pressure', 'mmHg'], ['sugar', 'Blood sugar', 'mg/dL'], ['weight', 'Weight', 'kg'], ['temp', 'Temperature', '']].forEach(([k, n, u]) => {
            const r = lastOf(k);
            if (r) f.readings.push({ name: n, value: r[k], unit: u, date: r.at });
        });
        const a = C.adherence(14);
        if (a && a.pct != null) {
            f.adherence = a;
            const counts = {};
            a.days.filter(d => d.day < todayK).forEach(d => d.missed.forEach(m => { counts[m] = (counts[m] || 0) + 1; }));
            f.missedTop = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 4);
        }
        const since = Date.now() - 14 * 86400000;
        (storeGet('neutrixSymptoms') || []).filter(s => new Date(s.at).getTime() >= since).forEach(s => f.symptoms.push({ at: s.at, text: s.symptoms.join(', ') + (s.severity ? ` (${s.severity})` : '') + (s.note ? `: ${s.note}` : '') }));
        tr.filter(r => new Date(r.at).getTime() >= since && r.symptoms && !/^none$/i.test(r.symptoms.trim())).forEach(r => f.symptoms.push({ at: r.at, text: r.symptoms }));
        f.symptoms.sort((x, y) => String(y.at).localeCompare(String(x.at)));
        f.symptoms = f.symptoms.slice(0, 8);
        const ck = storeGet('neutrixCheckups');
        const md = ck && ck.content && (ck.content.English || '');
        if (md) {
            const items = md.split('\n').filter(l => /^###\s/.test(l)).map(l => {
                const h = l.replace(/^###\s*(📅\s*)?/, '').replace(/\*\*/g, '').trim();
                const m = h.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
                return m ? { iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, h } : null;
            }).filter(Boolean);
            const next = items.filter(x => x.iso >= todayK).sort((x, y) => x.iso.localeCompare(y.iso))[0];
            if (next) f.nextCheckup = next.h;
        }
        const st = storeGet('neutrixCheckupStatus') || {};
        f.missedCheckups = Object.entries(st).filter(([, v]) => v.status === 'missed').map(([k]) => k.split('|')[0]).filter(Boolean).map(fmt);
        return f;
    }

    // Plain text for the QR code (ASCII, short enough to scan easily)
    function asText(f) {
        const lines = [`NEUTRIX DOCTOR CARD ${fmt(new Date().toISOString())}`,
            `Patient: ${f.name}${f.age ? ', ' + f.age + 'y' : ''}${f.sex ? ', ' + f.sex : ''}${f.blood ? ', ' + f.blood : ''}`,
            `Allergies: ${f.allergies}`];
        if (f.problem) lines.push(`Problem: ${f.problem}`);
        if (f.meds.length) lines.push('Medicines: ' + f.meds.map(m => `${m.name} ${m.strength} (${m.when})`).join('; '));
        if (f.change) lines.push(`Changed ${fmt(f.change.from)}: ` + [...f.change.added.map(g => '+' + g.name), ...f.change.changed.map(c => `${c.after.name} ${c.before.strength}->${c.after.strength}`), ...f.change.stopped.map(g => '-' + g.name)].join(', '));
        if (f.labs.length) lines.push('Labs: ' + f.labs.slice(0, 6).map(l => `${l.name} ${l.last}${l.unit ? ' ' + l.unit : ''}${l.date ? ' (' + l.date + ')' : ''}`).join('; '));
        if (f.readings.length) lines.push('Home: ' + f.readings.map(r => `${r.name} ${r.value}`).join('; '));
        if (f.adherence) lines.push(`Doses taken (14d): ${f.adherence.pct}%`);
        if (f.symptoms.length) lines.push('Symptoms: ' + f.symptoms.slice(0, 4).map(s => s.text).join('; '));
        if (f.nextCheckup) lines.push(`Next check-up: ${f.nextCheckup}`);
        lines.push('From patient records in the Neutrix app. Verify with original documents.');
        return lines.join('\n').replace(/[^\x20-\x7E\n]/g, '').slice(0, 1100);
    }    // Emergency card (emergency.html): the details go inside the link after "#" (never sent to a server)
    function emergencyData(f) {
        const p = profile();
        const SLOT_WORD = { morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'night' };
        const meds = f.meds.slice(0, 14).map(m => [`${m.name.replace(/^(tab|cap|inj|syp|syr)\.?\s+/i, '')} ${m.strength}`.trim(),
            [m.dose, m.when.split(', ').map(w => SLOT_WORD[w] || '').filter(Boolean).join(' & ')].filter(Boolean).join(', ')]);
        // Short, clear condition: the profile's condition and the diagnoses the 3D body map found (not a summary sentence)
        const bm = storeGet('neutrixBodyMap');
        const found = ((bm && bm.data && bm.data.areas) || []).map(x => x.label).filter(Boolean);
        const cond = [...new Set([p.condition, f.problem, ...found].map(x => String(x || '').trim()).filter(x => x && !/^(none|other|select)/i.test(x)))].join(', ').slice(0, 220);
        const d = { n: f.name, g: f.sex, a: f.age || '', b: p.dob || '', bg: f.blood, al: f.allergies, c: cond, m: meds, u: new Date().toISOString().slice(0, 10) };
        // Short alerts for whoever helps in an emergency, only from the medicines and reports (never guessed)
        const gen = f.meds.map(m => { try { return window.NxCare ? NxCare.generic(m.name) : ''; } catch (e) { return ''; } });
        const thin = [...new Set(gen.filter(g => ['aspirin', 'clopidogrel', 'ticagrelor', 'prasugrel', 'warfarin', 'acenocoumarol', 'apixaban', 'rivaroxaban', 'dabigatran'].includes(g)))];
        const lowSugar = [...new Set(gen.filter(g => ['glimepiride', 'gliclazide', 'glibenclamide', 'glipizide'].includes(g)))]
            .concat(f.meds.some(m => /insulin|mixtard|lantus|huminsulin|novomix|actrapid/i.test(m.name)) ? ['insulin'] : []);
        let rtext = '';
        try { rtext = (window.fullReportText ? fullReportText(loadReport() || {}) : '') || ''; } catch (e) {}
        const devices = [['stent', /\bstent/i], ['pacemaker', /pacemaker/i], ['ICD (defibrillator)', /\bicd\b|defibrillator implant/i], ['artificial heart valve', /valve replacement|\b(avr|mvr)\b|prosthetic valve/i]]
            .filter(([, re]) => re.test(rtext)).map(([n]) => n);
        const w = [];
        if (thin.length) w.push(['bleed', thin.join(', ')]);
        if (lowSugar.length) w.push(['sugar', [...new Set(lowSugar)].join(', ')]);
        if (devices.length) w.push(['device', devices.join(', ')]);
        if (w.length) d.w = w;
        if (p.caregiverName || (p.caregiverPhone && p.caregiverPhone !== 'Not provided') || p.caregiverEmail)
            d.cg = { n: p.caregiverName || '', p: p.caregiverPhone && p.caregiverPhone !== 'Not provided' ? p.caregiverPhone : '', e: p.caregiverEmail || '' };
        Object.keys(d).forEach(k => { if (d[k] === '' || (Array.isArray(d[k]) && !d[k].length)) delete d[k]; });
        return d;
    }
    const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    async function emergencyLink(d) {
        const raw = new TextEncoder().encode(JSON.stringify(d));
        let tag = 'j', bytes = raw;
        try {
            const cs = new CompressionStream('deflate-raw');
            const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer());
            if (z.length < raw.length) { tag = 'z'; bytes = z; }
        } catch (e) {}
        return location.origin + location.pathname.replace(/[^/]*$/, '') + 'emergency.html#' + tag + '.' + b64url(bytes);
    }
    function qrSvg(text) {
        const qr = qrcode(0, 'M');
        qr.addData(text, 'Byte');
        qr.make();
        return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: 'QR code: emergency medical info' });
    }

    function render() {
        const f = gather();
        $('dcPdf').textContent = '⬇ ' + L('Download PDF', 'PDF ഡൗൺലോഡ്');
        $('dcPrint').textContent = '🖨 ' + L('Print', 'പ്രിന്റ്');
        $('dcNote').textContent = L('The card is in English so any doctor can read it.', 'ഏത് ഡോക്ടർക്കും വായിക്കാൻ കാർഡ് ഇംഗ്ലീഷിലാണ്.');
        $('dcQrTitle').textContent = L('Emergency QR code', 'എമർജൻസി QR കോഡ്');
        $('dcQrHint').textContent = L('Anyone who scans this with a phone camera (ambulance staff, a new doctor) opens your emergency card: blood group, allergies, condition, daily medicines and caregiver. The details are inside the code itself, not stored online. Print it or keep it on your phone.', 'ഫോൺ ക്യാമറ കൊണ്ട് സ്കാൻ ചെയ്യുന്ന ആർക്കും (ആംബുലൻസ് ജീവനക്കാർ, പുതിയ ഡോക്ടർ) നിങ്ങളുടെ എമർജൻസി കാർഡ് കാണാം: രക്തഗ്രൂപ്പ്, അലർജി, രോഗം, മരുന്നുകൾ, പരിചാരകൻ. വിവരങ്ങൾ കോഡിനുള്ളിൽ തന്നെയാണ്, ഓൺലൈനിൽ സൂക്ഷിക്കുന്നില്ല.');
        const sec = (title, body) => body ? `<div class="dc-sec"><h3>${esc(title)}</h3>${body}</div>` : '';
        const none = t => `<p class="dc-none">${esc(t)}</p>`;
        const changes = f.change ? '<ul>' + [
            ...f.change.added.map(g => `<li><b>New:</b> ${esc(g.name)} ${esc(NxHist.describe(g))}</li>`),
            ...f.change.changed.map(c => `<li><b>Changed:</b> ${esc(c.after.name)}: ${esc(NxHist.describe(c.before))} → ${esc(NxHist.describe(c.after))}</li>`),
            ...f.change.stopped.map(g => `<li><b>Stopped:</b> ${esc(g.name)}</li>`)].join('') + '</ul>' : '';
        $('dcPaper').innerHTML = `
            <div class="dc-head"><div><div class="dc-title">Patient summary for the doctor</div>
                <div class="dc-sub">Prepared ${esc(fmt(new Date().toISOString()))} by the Neutrix app from the patient's uploaded reports and home records. Please verify with the original documents.</div></div>
                <div class="dc-qr-print"></div></div>
            <table class="dc-id"><tr><th>Name</th><td>${esc(f.name || 'Not recorded')}</td><th>Age / sex</th><td>${esc([f.age && f.age + ' y', f.sex].filter(Boolean).join(', ') || 'Not recorded')}</td></tr>
                <tr><th>Blood group</th><td>${esc(f.blood || 'Not recorded')}</td><th>Phone</th><td>${esc(f.phone || 'Not recorded')}</td></tr>
                <tr><th>Allergies</th><td colspan="3"><b>${esc(f.allergies)}</b></td></tr>
                ${f.carer ? `<tr><th>Caregiver</th><td colspan="3">${esc(f.carer)}</td></tr>` : ''}</table>
            ${sec('Main problem', (f.problem ? `<p><b>${esc(f.problem)}</b></p>` : '') + (f.summary ? `<p>${esc(f.summary)}</p>` : '') || none('Not recorded'))}
            ${sec('Current medicines (today)', f.meds.length ? `<table class="dc-t"><tr><th>Medicine</th><th>Strength</th><th>Dose</th><th>When</th></tr>${f.meds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.strength)}</td><td>${esc(m.dose || '')}</td><td>${esc(m.when)}</td></tr>`).join('')}</table>` : none('No medicine schedule saved.'))}
            ${f.change ? sec(`Medicine changes (report of ${fmt(f.change.from)})`, changes) : ''}
            ${f.flags.length ? sec('Points to check', '<ul>' + f.flags.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>') : ''}
            ${sec('Latest test results', f.labs.length ? `<table class="dc-t"><tr><th>Test</th><th>Latest</th><th>Date</th><th>Before</th><th>Normal</th></tr>${f.labs.map(l => `<tr><td>${esc(l.name)}</td><td><b>${esc(l.last)}</b> ${esc(l.unit)}</td><td>${esc(l.date ? fmt(l.date) : '')}</td><td>${esc(l.prev)}</td><td>${esc(l.normal)}</td></tr>`).join('')}</table>` : none('Open My Improvements once to read the test results from the reports.'))}
            ${sec('Home readings (latest)', f.readings.length ? `<table class="dc-t"><tr><th>Reading</th><th>Value</th><th>Date</th></tr>${f.readings.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.value)} ${esc(r.unit)}</td><td>${esc(fmt(r.date))}</td></tr>`).join('')}</table>` : none('No readings recorded.'))}
            ${sec('Medicines taken (last 14 days)', f.adherence ? `<p><b>${f.adherence.pct}%</b> of doses ticked (${f.adherence.taken} of ${f.adherence.due}).${f.missedTop.length ? ' Most missed: ' + f.missedTop.map(([n, c]) => `${esc(n)} (${c})`).join(', ') + '.' : ''}</p>` : none('Not tracked.'))}
            ${sec('Symptoms (last 14 days)', f.symptoms.length ? '<ul>' + f.symptoms.map(s => `<li>${esc(fmt(s.at))}: ${esc(s.text)}</li>`).join('') + '</ul>' : none('None recorded.'))}
            ${sec('Check-ups', (f.nextCheckup ? `<p>Next: <b>${esc(f.nextCheckup)}</b></p>` : '') + (f.missedCheckups.length ? `<p>Missed: ${esc(f.missedCheckups.join(', '))}</p>` : '') || none('None saved.'))}
            <p class="dc-foot">Neutrix organises and explains the patient's own records. It does not diagnose or prescribe.</p>`;
        // QR code: opens the emergency medical card (screen + on the paper)
        const text = asText(f);
        const qrBox = $('dcQr');
        qrBox.innerHTML = `<p class="hint">${esc(L('Making the QR code…', 'QR കോഡ് ഉണ്ടാക്കുന്നു…'))}</p>`;
        emergencyLink(emergencyData(f)).then(link => {
            window.__nxEmergencyLink = link;
            let svg = '';
            try { svg = qrSvg(link); } catch (e) { console.warn('[doctor card] QR', e); }
            qrBox.innerHTML = svg ? svg + `<a class="btn-secondary dc-open" href="${esc(link)}" target="_blank" rel="noopener">${esc(L('Open the emergency card', 'എമർജൻസി കാർഡ് തുറക്കുക'))}</a>`
                : `<p class="hint">${esc(L('Could not make the QR code.', 'QR കോഡ് ഉണ്ടാക്കാനായില്ല.'))}</p>`;
            const pq = $('dcPaper').querySelector('.dc-qr-print');
            if (pq && svg) pq.innerHTML = svg + '<div class="dc-qr-cap">Scan for emergency info</div>';
        });
        window.__nxDoctorCardText = text;
    }

    $('dcPrint').addEventListener('click', () => window.print());
    $('dcPdf').addEventListener('click', () => {
        if (!window.html2pdf) { window.print(); return; }
        const el = $('dcPaper').cloneNode(true);
        el.classList.add('dc-pdf');
        const name = (profile().patientName || 'patient').replace(/[^a-z0-9]+/gi, '-');
        html2pdf().set({ margin: 10, filename: `Neutrix-doctor-card-${name}.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save();
    });
    render();
    document.addEventListener('neutrix:langchange', render);
})();
