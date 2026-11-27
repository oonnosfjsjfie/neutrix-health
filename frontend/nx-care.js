// =====================================================
// nx-care.js: safety and daily-care helpers shared by several pages.
//
//  NxCare.source(terms)        "Show me where it says this": finds the line in the patient's own report
//  NxCare.safety(doses)        dose checks: unusual doses, the same medicine twice, known risky combinations
//  NxCare.warnings()           "When to get help now": warning signs for the conditions in the report
//  NxCare.diet()               diet tips, only for conditions the report mentions
//  NxCare.adherence(days)      how many doses were ticked in the last N days
//  NxCare.refills()            how long each medicine will last
//  NxCare.missedHelp(dose)     what to do about a missed dose
//
// Everything here is fixed, checked medical information (no AI), so it works offline and never invents
// anything. It never tells anyone to change a medicine: every warning says to confirm with the doctor or
// pharmacist. The medical facts are common, well-established guidance (patient leaflets, WHO, AHA/ADA).
// =====================================================
(function () {
    const ml = () => window.neutrixLang === 'Malayalam';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const today = () => (window.dayKey ? dayKey(new Date()) : new Date().toISOString().slice(0, 10));
    const L = (en, mal) => (ml() && mal ? mal : en);

    // ---------- the report's own words ----------
    function reportSources() {
        const r = window.loadReport ? loadReport() : null;
        if (!r) return [];
        const out = [];
        const firstDay = (r.createdAt || '').slice(0, 10);
        if (r.reportText) out.push({ label: L('Your reports', 'നിങ്ങളുടെ റിപ്പോർട്ടുകൾ'), when: firstDay, text: r.reportText });
        if (r.billText) out.push({ label: L('Your pharmacy bill', 'ഫാർമസി ബിൽ'), when: firstDay, text: r.billText });
        (window.loadFollowups ? loadFollowups() : []).forEach(f => {
            if (f.text) out.push({ label: L('Later report', 'പിന്നീടുള്ള റിപ്പോർട്ട്'), when: String(f.createdAt || '').slice(0, 10), text: f.text });
        });
        return out;
    }
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9ഀ-ൿ.]+/g, ' ').trim();
    // Words of a medicine name that matter ("Tab. Atorvastatin 40 mg" -> ["atorvastatin"])
    function keyWords(name) {
        return norm(name).replace(/\b(tab|tablet|tabs|cap|capsule|caps|inj|injection|syp|syr|syrup|oint|ointment|drops?|sr|xl|er|cr|od|mg|mcg|ml|g|iu|units?)\b/g, ' ')
            .split(/\s+/).filter(w => w.length >= 3 && !/^\d/.test(w));
    }
    // Lines in the reports that mention all the given words (best first)
    function source(terms) {
        terms = (Array.isArray(terms) ? terms : [terms]).map(norm).filter(Boolean);
        if (!terms.length) return [];
        const hits = [];
        reportSources().forEach(src => {
            const lines = String(src.text).split(/\n+/).map(l => l.trim()).filter(Boolean);
            lines.forEach((line, i) => {
                const n = norm(line);
                const found = terms.filter(t => n.includes(t));
                if (!found.length || found.length < Math.min(terms.length, 2) && terms.length > 1 && !n.includes(terms[0])) return;
                const score = found.length * 10 + (n.includes(terms[0]) ? 5 : 0) - Math.min(line.length, 300) / 100;
                const context = [lines[i - 1], line, lines[i + 1]].filter(Boolean);
                hits.push({ score, line, context, label: src.label, when: src.when, terms });
            });
        });
        hits.sort((a, b) => b.score - a.score);
        const seen = new Set();
        return hits.filter(h => !seen.has(h.line) && seen.add(h.line)).slice(0, 3);
    }
    function highlight(text, terms) {
        let h = esc(text);
        terms.forEach(t => { if (t.length < 2) return; h = h.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
        return h;
    }
    // Popup: the report lines for `what` (e.g. a medicine), searched by `terms`
    function showSource(what, terms) {
        const hits = source(terms);
        const old = document.getElementById('nxSourceModal');
        if (old) old.remove();
        const box = document.createElement('div');
        box.id = 'nxSourceModal';
        box.className = 'nxc-modal';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        const words = terms.map(norm);
        box.innerHTML = `<div class="nxc-modal-card">
            <div class="nxc-modal-head"><b>🔎 ${esc(L('Where your report says this', 'റിപ്പോർട്ടിൽ ഇത് എവിടെ'))}</b><button type="button" class="nxc-x" aria-label="${esc(L('Close', 'അടയ്ക്കുക'))}">✕</button></div>
            <p class="nxc-what">${esc(what)}</p>
            ${hits.length ? hits.map(h => `<div class="nxc-quote"><div class="nxc-quote-src">${esc(h.label)}${h.when ? ' · ' + esc(h.when) : ''}</div>${h.context.map(c => `<div class="${c === h.line ? 'nxc-hit' : 'nxc-ctx'}">${highlight(c, words)}</div>`).join('')}</div>`).join('')
                : `<div class="nxc-notfound">⚠️ ${esc(L("I couldn't find these exact words in your report. The report may say it differently, or the AI may have made a mistake. Check the paper report, or ask your doctor or pharmacist.", 'റിപ്പോർട്ടിൽ ഈ വാക്കുകൾ കണ്ടെത്തിയില്ല. റിപ്പോർട്ട് മറ്റൊരു രീതിയിൽ പറയുന്നുണ്ടാകാം, അല്ലെങ്കിൽ AI-ക്ക് തെറ്റിയിരിക്കാം. പേപ്പർ റിപ്പോർട്ട് നോക്കുക, അല്ലെങ്കിൽ ഡോക്ടറോടോ ഫാർമസിസ്റ്റിനോടോ ചോദിക്കുക.'))}</div>`}
            <p class="nxc-small">${esc(L('This is the text read from your uploaded report. If anything looks different from your paper report, trust the paper report and your doctor.', 'അപ്‌ലോഡ് ചെയ്ത റിപ്പോർട്ടിൽ നിന്ന് വായിച്ചതാണിത്. പേപ്പർ റിപ്പോർട്ടിൽ നിന്ന് വ്യത്യാസമുണ്ടെങ്കിൽ, പേപ്പർ റിപ്പോർട്ടും ഡോക്ടറെയും വിശ്വസിക്കുക.'))}</p>
        </div>`;
        const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        box.addEventListener('click', e => { if (e.target === box || e.target.closest('.nxc-x')) close(); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(box);
        box.querySelector('.nxc-x').focus();
        return hits.length;
    }
    // A small "🔎" button that opens the source popup
    function sourceButton(what, terms) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nxc-src-btn';
        b.textContent = '🔎 ' + L('Where it says this', 'റിപ്പോർട്ടിൽ എവിടെ');
        b.title = L('Show the line in your report', 'റിപ്പോർട്ടിലെ വരി കാണിക്കുക');
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showSource(what, terms); });
        return b;
    }

    // ---------- medicines: names, usual maximum single doses, risky combinations ----------
    // Common Indian brand names -> generic name
    const BRANDS = {
        ecosprin: 'aspirin', disprin: 'aspirin', loprin: 'aspirin', aspirin: 'aspirin',
        clopilet: 'clopidogrel', clopitab: 'clopidogrel', deplatt: 'clopidogrel', plavix: 'clopidogrel', clopidogrel: 'clopidogrel',
        brilinta: 'ticagrelor', axcer: 'ticagrelor', ticagrelor: 'ticagrelor', prasita: 'prasugrel', prasugrel: 'prasugrel',
        atorva: 'atorvastatin', atorlip: 'atorvastatin', storvas: 'atorvastatin', tonact: 'atorvastatin', aztor: 'atorvastatin', lipitor: 'atorvastatin', atorvastatin: 'atorvastatin',
        rosuvas: 'rosuvastatin', rozavel: 'rosuvastatin', rozucor: 'rosuvastatin', crestor: 'rosuvastatin', rosuvastatin: 'rosuvastatin',
        simvastatin: 'simvastatin', simvotin: 'simvastatin',
        glycomet: 'metformin', gluconorm: 'metformin', obimet: 'metformin', glucophage: 'metformin', metformin: 'metformin',
        amaryl: 'glimepiride', glimy: 'glimepiride', glimestar: 'glimepiride', glimepiride: 'glimepiride', gliclazide: 'gliclazide', diamicron: 'gliclazide', reclide: 'gliclazide',
        januvia: 'sitagliptin', istavel: 'sitagliptin', sitagliptin: 'sitagliptin', galvus: 'vildagliptin', jalra: 'vildagliptin', vildagliptin: 'vildagliptin',
        jardiance: 'empagliflozin', empagliflozin: 'empagliflozin', forxiga: 'dapagliflozin', oxra: 'dapagliflozin', dapagliflozin: 'dapagliflozin',
        pantocid: 'pantoprazole', pantop: 'pantoprazole', pan: 'pantoprazole', pantoprazole: 'pantoprazole',
        omez: 'omeprazole', omeprazole: 'omeprazole', nexpro: 'esomeprazole', esomeprazole: 'esomeprazole', razo: 'rabeprazole', rablet: 'rabeprazole', rabeprazole: 'rabeprazole',
        telma: 'telmisartan', telmikind: 'telmisartan', telsar: 'telmisartan', telmisartan: 'telmisartan',
        losar: 'losartan', losacar: 'losartan', cozaar: 'losartan', losartan: 'losartan', olmesartan: 'olmesartan', olmezest: 'olmesartan',
        amlong: 'amlodipine', amlodac: 'amlodipine', stamlo: 'amlodipine', amlopres: 'amlodipine', amlodipine: 'amlodipine',
        metolar: 'metoprolol', betaloc: 'metoprolol', seloken: 'metoprolol', metoprolol: 'metoprolol', concor: 'bisoprolol', bisoprolol: 'bisoprolol',
        cardivas: 'carvedilol', carca: 'carvedilol', carvedilol: 'carvedilol',
        cardace: 'ramipril', ramistar: 'ramipril', ramipril: 'ramipril', envas: 'enalapril', enalapril: 'enalapril', lisinopril: 'lisinopril', listril: 'lisinopril',
        lasix: 'furosemide', frusenex: 'furosemide', furosemide: 'furosemide', frusemide: 'furosemide', dytor: 'torsemide', tide: 'torsemide', torsemide: 'torsemide',
        aldactone: 'spironolactone', spironolactone: 'spironolactone', eplerenone: 'eplerenone',
        dolo: 'paracetamol', crocin: 'paracetamol', calpol: 'paracetamol', pacimol: 'paracetamol', paracetamol: 'paracetamol', acetaminophen: 'paracetamol',
        brufen: 'ibuprofen', ibugesic: 'ibuprofen', ibuprofen: 'ibuprofen', voveran: 'diclofenac', diclofenac: 'diclofenac', naprosyn: 'naproxen', naproxen: 'naproxen',
        aceclofenac: 'aceclofenac', zerodol: 'aceclofenac', hifenac: 'aceclofenac',
        warf: 'warfarin', warfarin: 'warfarin', coumadin: 'warfarin', acitrom: 'acenocoumarol', acenocoumarol: 'acenocoumarol',
        eliquis: 'apixaban', apixaban: 'apixaban', xarelto: 'rivaroxaban', rivaroxaban: 'rivaroxaban', pradaxa: 'dabigatran', dabigatran: 'dabigatran',
        thyronorm: 'levothyroxine', eltroxin: 'levothyroxine', thyrox: 'levothyroxine', levothyroxine: 'levothyroxine',
        sorbitrate: 'isosorbide dinitrate', isordil: 'isosorbide dinitrate', monotrate: 'isosorbide mononitrate', ismo: 'isosorbide mononitrate',
        nitrocontin: 'nitroglycerin', nitroglycerin: 'nitroglycerin', glyceryl: 'nitroglycerin',
        viagra: 'sildenafil', penegra: 'sildenafil', sildenafil: 'sildenafil', tadacip: 'tadalafil', cialis: 'tadalafil', tadalafil: 'tadalafil',
        clarithromycin: 'clarithromycin', claribid: 'clarithromycin', lanoxin: 'digoxin', digoxin: 'digoxin'
    };
    function generic(name) {
        const words = keyWords(name);
        for (const w of words) if (BRANDS[w]) return BRANDS[w];
        if (/isosorbide/.test(norm(name))) return /mono/.test(norm(name)) ? 'isosorbide mononitrate' : 'isosorbide dinitrate';
        return words[0] || norm(name);
    }
    // Usual maximum SINGLE dose for adults (mg). Above it -> "please confirm" (never "wrong")
    const MAX_DOSE = {
        paracetamol: 1000, aspirin: 325, clopidogrel: 75, ticagrelor: 90, prasugrel: 10, atorvastatin: 80, rosuvastatin: 40, simvastatin: 40,
        metformin: 1000, glimepiride: 8, gliclazide: 160, sitagliptin: 100, vildagliptin: 50, empagliflozin: 25, dapagliflozin: 10,
        pantoprazole: 40, omeprazole: 40, esomeprazole: 40, rabeprazole: 20, telmisartan: 80, losartan: 100, olmesartan: 40, amlodipine: 10,
        metoprolol: 200, bisoprolol: 10, carvedilol: 25, ramipril: 10, enalapril: 20, lisinopril: 40, furosemide: 160, torsemide: 100,
        spironolactone: 100, ibuprofen: 800, diclofenac: 100, naproxen: 500, aceclofenac: 100, warfarin: 10, apixaban: 10, rivaroxaban: 20,
        dabigatran: 150, levothyroxine: 0.3, digoxin: 0.25
    };
    function strengthMg(s) {
        const m = String(s || '').toLowerCase().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g)\b/);
        if (!m) return null;
        const n = parseFloat(m[1]);
        return m[2] === 'g' ? n * 1000 : (m[2] === 'mcg' || m[2] === 'µg') ? n / 1000 : n;
    }
    function unitsPerDose(d) {
        const s = String(d.dose || '').toLowerCase();
        if (/half|½|0\.5/.test(s)) return 0.5;
        const m = s.match(/(\d+(?:\.\d+)?)/);
        return m ? parseFloat(m[1]) : 1;
    }
    const GROUPS = {
        anticoag: ['warfarin', 'acenocoumarol', 'apixaban', 'rivaroxaban', 'dabigatran'],
        antiplatelet: ['aspirin', 'clopidogrel', 'ticagrelor', 'prasugrel'],
        nsaid: ['ibuprofen', 'diclofenac', 'naproxen', 'aceclofenac'],
        nitrate: ['isosorbide dinitrate', 'isosorbide mononitrate', 'nitroglycerin'],
        pde5: ['sildenafil', 'tadalafil'],
        acei: ['ramipril', 'enalapril', 'lisinopril'],
        arb: ['telmisartan', 'losartan', 'olmesartan'],
        ksparing: ['spironolactone', 'eplerenone'],
        ppiWeak: ['omeprazole', 'esomeprazole'],
        statinCyp: ['simvastatin', 'atorvastatin']
    };
    const has = (set, g) => [...set].filter(x => GROUPS[g].includes(x));
    // Checks today's (or any) doses. Returns [{ level: 'high'|'check', title, text, meds:[] }]
    function safety(doses) {
        const out = [];
        const byGeneric = new Map();
        (doses || []).forEach(d => {
            const g = generic(d.medicine);
            if (!g) return;
            const e = byGeneric.get(g) || { names: new Set(), doses: [] };
            e.names.add(String(d.medicine).trim());
            e.doses.push(d);
            byGeneric.set(g, e);
        });
        const gs = new Set(byGeneric.keys());
        // 1. unusual doses
        byGeneric.forEach((e, g) => {
            const max = MAX_DOSE[g];
            if (!max) return;
            e.doses.forEach(d => {
                const mg = strengthMg(d.strength);
                if (mg == null) return;
                const total = mg * unitsPerDose(d);
                if (total > max * 1.001) {
                    out.push({ level: 'check', meds: [d.medicine], title: L(`Unusual dose: ${d.medicine} ${d.strength}`, `അസാധാരണ ഡോസ്: ${d.medicine} ${d.strength}`),
                        text: L(`This is more than the usual maximum single dose for adults (${max >= 1 ? max + ' mg' : max * 1000 + ' mcg'}). It may be right for you, but please confirm it with your doctor or pharmacist before you take it.`,
                            `മുതിർന്നവർക്കുള്ള സാധാരണ പരമാവധി ഡോസിനേക്കാൾ (${max >= 1 ? max + ' mg' : max * 1000 + ' mcg'}) കൂടുതലാണിത്. കഴിക്കുന്നതിന് മുമ്പ് ഡോക്ടറോടോ ഫാർമസിസ്റ്റിനോടോ ഉറപ്പിക്കുക.`) });
                }
            });
        });
        // 2. the same medicine under two names, or twice at the same time
        byGeneric.forEach((e, g) => {
            if (e.names.size > 1) {
                out.push({ level: 'high', meds: [...e.names], title: L(`Same medicine twice? ${[...e.names].join(' + ')}`, `ഒരേ മരുന്ന് രണ്ടുതവണ? ${[...e.names].join(' + ')}`),
                    text: L(`These look like the same medicine (${g}) under different names. Taking both could mean a double dose. Ask your pharmacist before taking both.`,
                        `ഇവ വ്യത്യസ്ത പേരുകളിൽ ഒരേ മരുന്നാണെന്ന് (${g}) തോന്നുന്നു. രണ്ടും കഴിച്ചാൽ ഇരട്ടി ഡോസ് ആകാം. രണ്ടും കഴിക്കുന്നതിന് മുമ്പ് ഫാർമസിസ്റ്റിനോട് ചോദിക്കുക.`) });
            }
            const slots = {};
            e.doses.forEach(d => { slots[d.slot] = (slots[d.slot] || 0) + 1; });
            if (e.names.size === 1 && Object.values(slots).some(n => n > 1)) {
                out.push({ level: 'check', meds: [...e.names], title: L(`${[...e.names][0]} is listed twice at the same time`, `${[...e.names][0]} ഒരേ സമയത്ത് രണ്ടുതവണ`),
                    text: L('Check with your pharmacist whether this should be one dose or two.', 'ഇത് ഒരു ഡോസാണോ രണ്ടാണോ എന്ന് ഫാർമസിസ്റ്റിനോട് ഉറപ്പിക്കുക.') });
            }
        });
        // 3. well-known risky combinations (often prescribed on purpose: always "confirm", never "stop")
        const pair = (a, b, level, en, mal) => {
            const A = has(gs, a), B = has(gs, b);
            if (A.length && B.length && (a !== b || A.length > 1)) out.push({ level, meds: a === b ? A : [...A, ...B], title: L(en[0], mal[0]), text: L(en[1], mal[1]) });
        };
        const why = L(' Doctors sometimes prescribe this on purpose. Do not stop anything yourself: ask your doctor or pharmacist to confirm.', ' ഡോക്ടർമാർ ചിലപ്പോൾ ഇത് മനഃപൂർവം നൽകാറുണ്ട്. സ്വയം ഒന്നും നിർത്തരുത്: ഡോക്ടറോടോ ഫാർമസിസ്റ്റിനോടോ ഉറപ്പിക്കുക.');
        pair('nitrate', 'pde5', 'high', ['Dangerous combination: a nitrate with sildenafil / tadalafil', 'Together these can make blood pressure fall dangerously low. Do not take them together unless your doctor has said so.'],
            ['അപകടകരമായ ചേർച്ച: നൈട്രേറ്റും സിൽഡെനാഫിൽ / ടഡലാഫിലും', 'ഇവ ഒരുമിച്ച് രക്തസമ്മർദ്ദം അപകടകരമായി കുറയ്ക്കാം. ഡോക്ടർ പറഞ്ഞിട്ടില്ലെങ്കിൽ ഒരുമിച്ച് കഴിക്കരുത്.']);
        pair('anticoag', 'anticoag', 'high', ['Two blood thinners of the same kind', 'Two anticoagulants together greatly raise the risk of bleeding.' + why], ['ഒരേ തരത്തിലുള്ള രണ്ട് രക്തം നേർപ്പിക്കുന്ന മരുന്നുകൾ', 'രക്തസ്രാവ സാധ്യത വളരെ കൂടുന്നു.' + why]);
        pair('anticoag', 'antiplatelet', 'check', ['Blood thinner + antiplatelet: higher bleeding risk', 'This combination raises the risk of bleeding. Watch for bleeding signs (see "When to get help now").' + why], ['രക്തം നേർപ്പിക്കുന്ന മരുന്ന് + ആന്റിപ്ലേറ്റ്‌ലെറ്റ്: രക്തസ്രാവ സാധ്യത കൂടുതൽ', 'രക്തസ്രാവ ലക്ഷണങ്ങൾ ശ്രദ്ധിക്കുക.' + why]);
        pair('nsaid', 'anticoag', 'high', ['Painkiller (NSAID) with a blood thinner', 'Painkillers like ibuprofen or diclofenac with a blood thinner raise the risk of stomach bleeding. Paracetamol is usually the safer painkiller, but ask first.'], ['വേദനസംഹാരി (NSAID) + രക്തം നേർപ്പിക്കുന്ന മരുന്ന്', 'വയറ്റിൽ രക്തസ്രാവ സാധ്യത കൂടുന്നു. ആദ്യം ചോദിക്കുക.']);
        pair('nsaid', 'antiplatelet', 'check', ['Painkiller (NSAID) with aspirin / clopidogrel', 'This raises the risk of stomach bleeding.' + why], ['വേദനസംഹാരി (NSAID) + ആസ്പിരിൻ / ക്ലോപിഡോഗ്രൽ', 'വയറ്റിൽ രക്തസ്രാവ സാധ്യത കൂടുന്നു.' + why]);
        pair('nsaid', 'nsaid', 'high', ['Two NSAID painkillers together', 'Two painkillers of this kind together raise the risk of stomach bleeding and kidney problems.' + why], ['രണ്ട് NSAID വേദനസംഹാരികൾ ഒരുമിച്ച്', 'വയറ്റിലെ രക്തസ്രാവ, വൃക്ക പ്രശ്ന സാധ്യത കൂടുന്നു.' + why]);
        pair('acei', 'arb', 'check', ['ACE inhibitor + ARB together', 'Taking both can affect the kidneys and potassium level.' + why], ['ACE ഇൻഹിബിറ്റർ + ARB ഒരുമിച്ച്', 'വൃക്കകളെയും പൊട്ടാസ്യത്തെയും ബാധിക്കാം.' + why]);
        if ((has(gs, 'acei').length || has(gs, 'arb').length) && has(gs, 'ksparing').length) {
            out.push({ level: 'check', meds: [...has(gs, 'acei'), ...has(gs, 'arb'), ...has(gs, 'ksparing')], title: L('Can raise potassium', 'പൊട്ടാസ്യം കൂട്ടാം'),
                text: L('This combination is common (for example in heart failure) but can raise the potassium level. Your doctor will usually check it with blood tests. Avoid salt substitutes that contain potassium unless your doctor agrees.',
                    'ഈ ചേർച്ച സാധാരണമാണ് (ഉദാ. ഹാർട്ട് ഫെയിലർ) പക്ഷേ പൊട്ടാസ്യം കൂട്ടാം. ഡോക്ടർ സാധാരണ രക്തപരിശോധന നടത്തും. ഡോക്ടർ പറയാതെ പൊട്ടാസ്യം അടങ്ങിയ ഉപ്പ് പകരക്കാർ ഒഴിവാക്കുക.') });
        }
        if (gs.has('clopidogrel') && has(gs, 'ppiWeak').length) {
            out.push({ level: 'check', meds: ['clopidogrel', ...has(gs, 'ppiWeak')], title: L('Clopidogrel with omeprazole / esomeprazole', 'ക്ലോപിഡോഗ്രലും ഒമിപ്രസോളും'),
                text: L('Omeprazole and esomeprazole may make clopidogrel work less well. Doctors often use pantoprazole instead. Ask your doctor whether this is right for you.',
                    'ഒമിപ്രസോൾ ക്ലോപിഡോഗ്രലിന്റെ ഫലം കുറച്ചേക്കാം. ഡോക്ടർമാർ പലപ്പോഴും പാന്റോപ്രസോൾ ഉപയോഗിക്കുന്നു. ഡോക്ടറോട് ചോദിക്കുക.') });
        }
        if (has(gs, 'statinCyp').length && gs.has('clarithromycin')) {
            out.push({ level: 'check', meds: [...has(gs, 'statinCyp'), 'clarithromycin'], title: L('Statin with clarithromycin', 'സ്റ്റാറ്റിനും ക്ലാരിത്രോമൈസിനും'),
                text: L('Clarithromycin can raise the level of some statins and cause muscle problems. Tell your doctor about unexplained muscle pain or weakness.' + why,
                    'ക്ലാരിത്രോമൈസിൻ ചില സ്റ്റാറ്റിനുകളുടെ അളവ് കൂട്ടി പേശി പ്രശ്നങ്ങൾ ഉണ്ടാക്കാം.' + why) });
        }
        const rank = { high: 0, check: 1 };
        return out.sort((a, b) => rank[a.level] - rank[b.level]);
    }

    // ---------- warning signs and diet, only for what the report talks about ----------
    function reportTextAll() {
        const r = window.loadReport ? loadReport() : null;
        if (!r) return '';
        const sums = r.summaries ? Object.values(r.summaries).join(' ') : '';
        const fol = (window.loadFollowups ? loadFollowups() : []).map(f => f.text || '').join(' ');
        return (sums + ' ' + (r.reportText || '') + ' ' + fol).toLowerCase();
    }
    function medsNow() {
        const sch = window.storeGet && storeGet('neutrixSchedule');
        return sch && window.dosesForDay ? dosesForDay(sch, today()) : [];
    }
    const CONDITIONS = [
        { key: 'heart', re: /myocardial|infarction|\bnstemi\b|\bstemi\b|\bacs\b|angina|coronary|\bcad\b|\bihd\b|stent|angioplasty|ptca|\bcabg\b|bypass graft|heart attack/,
          name: ['Heart attack / heart arteries', 'ഹൃദയാഘാതം / ഹൃദയ ധമനികൾ'],
          signs: [['Chest pain, pressure or tightness lasting more than 5 minutes, or coming back', 'നെഞ്ചുവേദന, ഭാരം, മുറുക്കം 5 മിനിറ്റിൽ കൂടുതൽ, അല്ലെങ്കിൽ വീണ്ടും വരുന്നത്'],
                  ['Pain spreading to the arm, jaw, neck or back', 'വേദന കൈ, താടിയെല്ല്, കഴുത്ത്, പുറം എന്നിവിടങ്ങളിലേക്ക് പടരുന്നത്'],
                  ['Sudden breathlessness, cold sweat, feeling sick or fainting', 'പെട്ടെന്നുള്ള ശ്വാസംമുട്ടൽ, തണുത്ത വിയർപ്പ്, ഓക്കാനം, ബോധക്ഷയം']] },
        { key: 'hf', re: /heart failure|\bccf\b|\bhfref\b|\bhfpef\b|cardiomyopathy|lvef|ejection fraction/,
          name: ['Heart failure', 'ഹാർട്ട് ഫെയിലർ'],
          signs: [['Weight going up more than 2 kg in 3 days', '3 ദിവസത്തിനുള്ളിൽ ഭാരം 2 കിലോയിൽ കൂടുതൽ കൂടുന്നത്'],
                  ['Breathless when lying flat, or waking up breathless at night', 'മലർന്നു കിടക്കുമ്പോൾ ശ്വാസംമുട്ടൽ, രാത്രി ശ്വാസംമുട്ടി ഉണരുന്നത്'],
                  ['Swelling of the legs or belly getting worse', 'കാലിലോ വയറിലോ നീര് കൂടുന്നത്']] },
        { key: 'stroke', re: /\bstroke\b|\bcva\b|\btia\b|transient ischaemic|transient ischemic|cerebral infarct/,
          name: ['Stroke', 'സ്ട്രോക്ക്'],
          signs: [['BE FAST: face drooping, arm or leg weakness, slurred speech, sudden loss of sight or balance', 'മുഖം കോടുന്നത്, കൈയ്ക്കോ കാലിനോ ബലക്കുറവ്, സംസാരം കുഴയുന്നത്, പെട്ടെന്ന് കാഴ്ച / ബാലൻസ് നഷ്ടപ്പെടുന്നത്'],
                  ['Sudden, very bad headache', 'പെട്ടെന്നുള്ള കഠിനമായ തലവേദന'],
                  ['Note the time the signs started: treatment works best early', 'ലക്ഷണങ്ങൾ തുടങ്ങിയ സമയം ഓർക്കുക: നേരത്തെ ചികിത്സിച്ചാൽ കൂടുതൽ ഫലം']] },
        { key: 'diabetes', re: /diabet|\bt2dm\b|\bt1dm\b|\bdm\b|hba1c|insulin|metformin|hyperglyc/,
          name: ['Diabetes', 'പ്രമേഹം'],
          signs: [['Low sugar: shaking, sweating, confusion, or sugar below 70 mg/dL. Take sugar or glucose now and recheck; get help if it does not improve', 'ഷുഗർ കുറവ്: വിറയൽ, വിയർപ്പ്, ആശയക്കുഴപ്പം, അല്ലെങ്കിൽ 70 mg/dL-ൽ താഴെ. ഉടൻ പഞ്ചസാര / ഗ്ലൂക്കോസ് കഴിച്ച് വീണ്ടും നോക്കുക; മെച്ചമില്ലെങ്കിൽ സഹായം തേടുക'],
                  ['Very high sugar (over 300 mg/dL) with vomiting, drowsiness or deep fast breathing', 'വളരെ കൂടിയ ഷുഗർ (300-ൽ കൂടുതൽ) ഛർദ്ദി, മയക്കം, ആഴത്തിലുള്ള വേഗത്തിലുള്ള ശ്വാസം എന്നിവയോടൊപ്പം']] },
        { key: 'bp', re: /hypertension|\bhtn\b|high blood pressure/,
          name: ['High blood pressure', 'ഉയർന്ന രക്തസമ്മർദ്ദം'],
          signs: [['Blood pressure 180/120 or higher with headache, chest pain, breathlessness, confusion or blurred vision', 'BP 180/120 അല്ലെങ്കിൽ കൂടുതൽ, തലവേദന, നെഞ്ചുവേദന, ശ്വാസംമുട്ടൽ, ആശയക്കുഴപ്പം, മങ്ങിയ കാഴ്ച എന്നിവയോടൊപ്പം']] },
        { key: 'kidney', re: /kidney|renal|\bckd\b|\baki\b|nephro|dialysis/,
          name: ['Kidneys', 'വൃക്കകൾ'],
          signs: [['Passing much less urine than usual', 'സാധാരണയേക്കാൾ വളരെ കുറച്ച് മൂത്രം'],
                  ['New swelling, breathlessness or confusion', 'പുതിയ നീര്, ശ്വാസംമുട്ടൽ, ആശയക്കുഴപ്പം']] },
        { key: 'lungs', re: /asthma|\bcopd\b|pneumonia|bronchi|respiratory failure|\bild\b/,
          name: ['Lungs and breathing', 'ശ്വാസകോശം'],
          signs: [['Breathless at rest, or too breathless to speak in full sentences', 'വിശ്രമിക്കുമ്പോഴും ശ്വാസംമുട്ടൽ, മുഴുവൻ വാക്യം പറയാൻ കഴിയാത്തത്'],
                  ['Blue or grey lips, or the inhaler not helping', 'ചുണ്ടുകൾ നീല / ചാരനിറം, ഇൻഹേലർ ഫലിക്കാത്തത്']] },
        { key: 'surgery', re: /surgery|operation|post[- ]?op|incision|wound|suture|laparo|excision|replacement|fixation/,
          name: ['After an operation', 'ഓപ്പറേഷന് ശേഷം'],
          signs: [['Fever above 38 °C (100.4 °F)', '38 °C (100.4 °F)-ൽ കൂടുതൽ പനി'],
                  ['Wound red, hot, swollen, leaking pus, or opening', 'മുറിവ് ചുവന്ന്, ചൂടായി, വീർത്ത്, പഴുപ്പ്, അല്ലെങ്കിൽ തുറക്കുന്നത്'],
                  ['Pain, swelling or warmth in one calf, or sudden breathlessness (possible blood clot)', 'ഒരു കാൽവണ്ണയിൽ വേദന, നീര്, ചൂട്, അല്ലെങ്കിൽ പെട്ടെന്നുള്ള ശ്വാസംമുട്ടൽ (രക്തം കട്ടപിടിക്കൽ)']] }
    ];
    const BLEED = { key: 'thinners', name: ['Blood thinners', 'രക്തം നേർപ്പിക്കുന്ന മരുന്നുകൾ'],
        signs: [['Bleeding that will not stop, or blood in urine, vomit or cough', 'നിൽക്കാത്ത രക്തസ്രാവം, മൂത്രത്തിലോ ഛർദ്ദിയിലോ ചുമയിലോ രക്തം'],
                ['Black, tarry stools', 'കറുത്ത, ടാർ പോലുള്ള മലം'],
                ['A bad headache or confusion after a fall or a blow to the head', 'വീഴ്ചയ്ക്കോ തലയ്ക്കടിക്കോ ശേഷം കഠിനമായ തലവേദന / ആശയക്കുഴപ്പം']] };
    function conditions() {
        const t = reportTextAll();
        const list = CONDITIONS.filter(c => c.re.test(t));
        const meds = new Set(medsNow().map(d => generic(d.medicine)));
        if ([...meds].some(g => GROUPS.anticoag.includes(g) || GROUPS.antiplatelet.includes(g)) || /warfarin|apixaban|rivaroxaban|dabigatran|clopidogrel|ticagrelor|acitrom|heparin|enoxaparin/.test(t)) list.push(BLEED);
        return list;
    }
    function warnings() {
        return conditions().map(c => ({ key: c.key, name: L(c.name[0], c.name[1]), signs: c.signs.map(s => L(s[0], s[1])) }));
    }
    // Readings saved in the tracker that need help now
    function urgentReadings() {
        const list = (window.storeGet && storeGet('neutrixTracker')) || [];
        const last = list[list.length - 1];
        if (!last || Date.now() - new Date(last.at).getTime() > 2 * 86400000) return [];
        const out = [];
        const bp = String(last.bp || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
        if (bp && (+bp[1] >= 180 || +bp[2] >= 120)) out.push(L(`Your last blood pressure was ${bp[1]}/${bp[2]}. If you also have headache, chest pain, breathlessness, confusion or blurred vision, get help now. Otherwise rest and measure again in 5 minutes; if it is still this high, call your doctor today.`,
            `അവസാന BP ${bp[1]}/${bp[2]}. തലവേദന, നെഞ്ചുവേദന, ശ്വാസംമുട്ടൽ, ആശയക്കുഴപ്പം, മങ്ങിയ കാഴ്ച ഉണ്ടെങ്കിൽ ഉടൻ സഹായം തേടുക. ഇല്ലെങ്കിൽ 5 മിനിറ്റ് വിശ്രമിച്ച് വീണ്ടും നോക്കുക; ഇപ്പോഴും ഇത്ര കൂടുതലാണെങ്കിൽ ഇന്ന് ഡോക്ടറെ വിളിക്കുക.`));
        const sugar = parseFloat(last.sugar);
        if (sugar && sugar < 70) out.push(L(`Your last sugar was ${sugar} mg/dL (low). Take sugar or glucose now and check again in 15 minutes. Get help if it stays low or you feel confused.`, `അവസാന ഷുഗർ ${sugar} mg/dL (കുറവ്). ഉടൻ പഞ്ചസാര / ഗ്ലൂക്കോസ് കഴിച്ച് 15 മിനിറ്റിൽ വീണ്ടും നോക്കുക.`));
        if (sugar && sugar > 300) out.push(L(`Your last sugar was ${sugar} mg/dL (very high). Call your doctor today, and get help now if you are vomiting, very drowsy or breathing fast.`, `അവസാന ഷുഗർ ${sugar} mg/dL (വളരെ കൂടുതൽ). ഇന്ന് ഡോക്ടറെ വിളിക്കുക; ഛർദ്ദി, മയക്കം, വേഗത്തിലുള്ള ശ്വാസം ഉണ്ടെങ്കിൽ ഉടൻ സഹായം തേടുക.`));
        const temp = parseFloat(last.temp);
        if (temp && ((temp > 45 && temp >= 103) || (temp <= 45 && temp >= 39.4))) out.push(L(`Your last temperature was ${temp}. A high fever after a hospital stay needs a call to your doctor today.`, `അവസാന താപനില ${temp}. ആശുപത്രിവാസത്തിന് ശേഷമുള്ള കടുത്ത പനിക്ക് ഇന്ന് ഡോക്ടറെ വിളിക്കുക.`));
        return out;
    }
    // Emergency numbers (India): 108 ambulance, 112 all emergencies
    function callButtons() {
        return `<div class="nxc-calls"><a class="nxc-call" href="tel:108">📞 ${esc(L('Call 108 (ambulance)', '108 വിളിക്കുക (ആംബുലൻസ്)'))}</a><a class="nxc-call alt" href="tel:112">🆘 ${esc(L('Call 112 (emergency)', '112 വിളിക്കുക'))}</a></div>`;
    }

    const DIET = [
        { re: CONDITIONS[0].re, tips: [['Less salt, fried food and bakery snacks', 'ഉപ്പ്, പൊരിച്ചതും ബേക്കറി പലഹാരങ്ങളും കുറയ്ക്കുക'], ['More vegetables, fruit, whole grains, pulses and fish', 'കൂടുതൽ പച്ചക്കറികൾ, പഴങ്ങൾ, ധാന്യങ്ങൾ, പയർവർഗങ്ങൾ, മീൻ'], ['No smoking, and avoid alcohol', 'പുകവലി പാടില്ല, മദ്യം ഒഴിവാക്കുക']] },
        { re: CONDITIONS[1].re, tips: [['Keep salt low: it makes the body hold water', 'ഉപ്പ് കുറയ്ക്കുക: ശരീരത്തിൽ വെള്ളം നിൽക്കാൻ ഇടയാക്കും'], ['Drink only as much fluid as your doctor said, if they gave a limit', 'ഡോക്ടർ പരിധി പറഞ്ഞിട്ടുണ്ടെങ്കിൽ അത്ര വെള്ളം മാത്രം'], ['Weigh yourself every morning and write it in the Tracker', 'എല്ലാ ദിവസവും രാവിലെ ഭാരം നോക്കി ട്രാക്കറിൽ എഴുതുക']] },
        { re: CONDITIONS[4].re, tips: [['Under 5 g of salt a day (about one teaspoon), including salt already in food', 'ദിവസം 5 ഗ്രാമിൽ താഴെ ഉപ്പ് (ഏകദേശം ഒരു ടീസ്പൂൺ), ഭക്ഷണത്തിലുള്ളത് ഉൾപ്പെടെ'], ['Go easy on pickles, papad, salted fish and salty snacks', 'അച്ചാർ, പപ്പടം, ഉണക്കമീൻ, ഉപ്പുള്ള പലഹാരങ്ങൾ കുറയ്ക്കുക']] },
        { re: CONDITIONS[3].re, tips: [['Eat at regular times, and do not skip meals if you take sugar-lowering medicine', 'കൃത്യസമയത്ത് കഴിക്കുക; ഷുഗർ മരുന്ന് കഴിക്കുന്നെങ്കിൽ ഭക്ഷണം ഒഴിവാക്കരുത്'], ['Smaller portions of rice and other starches; more vegetables and protein', 'ചോറ് കുറച്ച്, കൂടുതൽ പച്ചക്കറികളും പ്രോട്ടീനും'], ['Avoid sugary drinks, sweets and fruit juices', 'മധുര പാനീയങ്ങൾ, മധുരപലഹാരങ്ങൾ, ജ്യൂസുകൾ ഒഴിവാക്കുക']] },
        { re: /cholesterol|\bldl\b|dyslipid|hyperlipid|statin/, tips: [['Less fried, bakery and fatty meat foods', 'പൊരിച്ചതും ബേക്കറിയും കൊഴുപ്പുള്ള ഇറച്ചിയും കുറയ്ക്കുക'], ['More fibre: oats, pulses, vegetables, fruit', 'കൂടുതൽ നാരുകൾ: ഓട്സ്, പയർ, പച്ചക്കറികൾ, പഴങ്ങൾ']] },
        { re: CONDITIONS[5].re, tips: [['Ask your doctor before changing protein, potassium (e.g. bananas, coconut water) or salt: kidney diets are very individual', 'പ്രോട്ടീൻ, പൊട്ടാസ്യം (ഉദാ. പഴം, ഇളനീർ), ഉപ്പ് എന്നിവ മാറ്റുന്നതിന് മുമ്പ് ഡോക്ടറോട് ചോദിക്കുക']] },
        { re: /warfarin|acitrom|acenocoumarol/, tips: [['Keep the amount of green leafy vegetables about the same every week (vitamin K changes how warfarin works)', 'ഇലക്കറികളുടെ അളവ് എല്ലാ ആഴ്ചയും ഏകദേശം ഒരുപോലെ നിലനിർത്തുക (വൈറ്റമിൻ K വാർഫറിനെ ബാധിക്കും)']] }
    ];
    function diet() {
        const t = reportTextAll() + ' ' + medsNow().map(d => d.medicine).join(' ').toLowerCase();
        const tips = [];
        DIET.forEach(d => { if (d.re.test(t)) d.tips.forEach(x => tips.push(L(x[0], x[1]))); });
        // what the report itself says about food, salt or fluids
        const said = source(['diet']).concat(source(['salt'])).concat(source(['fluid'])).map(h => h.line).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
        return { tips: [...new Set(tips)], said };
    }

    // ---------- taking medicines: this week, refills, missed doses ----------
    function adherence(days) {
        const sch = window.storeGet && storeGet('neutrixSchedule');
        if (!sch || !window.dosesForDay) return null;
        const out = [];
        const start = sch.startDate || today();
        for (let i = days - 1; i >= 0; i--) {
            const k = window.dayKeyShift ? dayKeyShift(today(), -i) : today();
            if (k < start) continue;
            const doses = dosesForDay(sch, k);
            const ticks = (sch.ticks && sch.ticks[k]) || {};
            const taken = doses.filter(d => ticks[d.id]).length;
            out.push({ day: k, due: doses.length, taken, missed: doses.filter(d => !ticks[d.id]).map(d => d.medicine) });
        }
        const past = out.filter(d => d.day < today());
        const due = past.reduce((a, d) => a + d.due, 0), taken = past.reduce((a, d) => a + d.taken, 0);
        return { days: out, due, taken, pct: due ? Math.round(taken / due * 100) : null };
    }
    const REFILL_KEY = 'neutrixRefills';
    function refills() {
        const saved = (window.storeGet && storeGet(REFILL_KEY)) || {};
        const by = new Map();
        medsNow().forEach(d => {
            const k = generic(d.medicine);
            const e = by.get(k) || { key: k, name: d.medicine, strength: d.strength || '', perDay: 0 };
            e.perDay += unitsPerDose(d);
            by.set(k, e);
        });
        return [...by.values()].map(e => {
            const s = saved[e.key];
            if (!s || !s.count || !e.perDay) return { ...e, count: null };
            const daysSince = Math.max(0, Math.floor((new Date(today()) - new Date(s.setOn)) / 86400000));
            const left = Math.max(0, s.count - e.perDay * daysSince);
            const daysLeft = Math.floor(left / e.perDay);
            const runsOut = window.dayKeyShift ? dayKeyShift(today(), daysLeft) : '';
            return { ...e, count: s.count, setOn: s.setOn, left: Math.round(left * 10) / 10, daysLeft, runsOut, low: daysLeft <= 5 };
        });
    }
    function setRefill(key, count) {
        const saved = (window.storeGet && storeGet(REFILL_KEY)) || {};
        if (!count) delete saved[key]; else saved[key] = { count: Number(count), setOn: today() };
        storeSet(REFILL_KEY, saved);
    }
    // Missed dose: the report's own words first, then safe general advice
    function missedHelp(dose) {
        const g = generic(dose.medicine);
        const said = source([...keyWords(dose.medicine).slice(0, 1), 'miss']).concat(source(['missed', 'dose'])).map(h => h.line).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);
        const tips = [
            L('Do not take two doses at once to make up for the one you missed.', 'വിട്ടുപോയതിന് പകരം ഒരേസമയം രണ്ട് ഡോസ് കഴിക്കരുത്.'),
            L('For many medicines, the leaflet says: take it when you remember, unless it is nearly time for the next dose, then skip the missed one. This depends on the medicine, so check its leaflet or ask your pharmacist.', 'പല മരുന്നുകളുടെയും ലഘുലേഖ പറയുന്നത്: ഓർക്കുമ്പോൾ കഴിക്കുക, അടുത്ത ഡോസിന്റെ സമയം അടുത്താണെങ്കിൽ വിട്ടുപോയത് ഒഴിവാക്കുക. ഇത് മരുന്നിനനുസരിച്ച് മാറും, ലഘുലേഖ നോക്കുക അല്ലെങ്കിൽ ഫാർമസിസ്റ്റിനോട് ചോദിക്കുക.')
        ];
        if (['metformin', 'glimepiride', 'gliclazide', 'sitagliptin', 'vildagliptin', 'empagliflozin', 'dapagliflozin'].includes(g) || /insulin/.test(norm(dose.medicine)))
            tips.push(L('Sugar medicines and insulin: never take extra to catch up, and do not take them without food. Ask your doctor what to do.', 'ഷുഗർ മരുന്നുകളും ഇൻസുലിനും: പിടിച്ചെത്താൻ കൂടുതൽ കഴിക്കരുത്, ഭക്ഷണമില്ലാതെ കഴിക്കരുത്. ഡോക്ടറോട് ചോദിക്കുക.'));
        if (GROUPS.anticoag.includes(g) || GROUPS.antiplatelet.includes(g))
            tips.push(L('Blood thinners: these are especially important. If you miss more than one dose, call your doctor.', 'രക്തം നേർപ്പിക്കുന്ന മരുന്നുകൾ: ഇവ വളരെ പ്രധാനമാണ്. ഒന്നിലധികം ഡോസ് വിട്ടുപോയാൽ ഡോക്ടറെ വിളിക്കുക.'));
        return { said, tips };
    }    function modal(title, inner) {
        const old = document.getElementById('nxSourceModal');
        if (old) old.remove();
        const box = document.createElement('div');
        box.id = 'nxSourceModal';
        box.className = 'nxc-modal';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.innerHTML = `<div class="nxc-modal-card"><div class="nxc-modal-head"><b>${esc(title)}</b><button type="button" class="nxc-x" aria-label="${esc(L('Close', 'അടയ്ക്കുക'))}">✕</button></div>${inner}</div>`;
        const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        box.addEventListener('click', e => { if (e.target === box || e.target.closest('.nxc-x')) close(); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(box);
        box.querySelector('.nxc-x').focus();
        return box;
    }
    function showMissed(dose) {
        const h = missedHelp(dose);
        modal('💊 ' + L('Missed a dose?', 'ഡോസ് വിട്ടുപോയോ?'), `<p class="nxc-what">${esc(dose.medicine)} ${esc(dose.strength || '')}</p>
            ${h.said.length ? `<div class="nxc-quote"><div class="nxc-quote-src">${esc(L('What your report says', 'റിപ്പോർട്ടിൽ പറയുന്നത്'))}</div>${h.said.map(x => `<div class="nxc-hit">${esc(x)}</div>`).join('')}</div>` : ''}
            <ul class="nxc-tips">${h.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
            <p class="nxc-small">${esc(L('If you are unsure, call your pharmacist: they can tell you exactly what to do for this medicine.', 'സംശയമുണ്ടെങ്കിൽ ഫാർമസിസ്റ്റിനെ വിളിക്കുക.'))}</p>`);
    }

    window.NxCare = { modal, showMissed, esc, L, source, showSource, sourceButton, keyWords, generic, safety, warnings, conditions, urgentReadings, callButtons, diet, adherence, refills, setRefill, missedHelp, unitsPerDose, strengthMg };
})();
