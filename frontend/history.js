// =====================================================
// history.js: medical history, the way real medical records keep it.
// - Nothing is overwritten: when a new report changes a page, the old
//   version is kept with its date (NxHist.archive / NxHist.list).
// - A shared "history" list in the same style as the Reports page (NxHist.bar).
// - Medicine changes between reports (NxHist.medTimeline / pastMeds),
//   worked out from the medicine schedule's dated versions.
// Data: 'neutrixHistory' (one per medical issue, synced to the account).
// =====================================================
(function () {
    const KEY = 'neutrixHistory';
    const MAX = 25;

    const TX = {
        English: {
            current: 'Current', older: 'Older version', replaced: 'Replaced on {when}', made: 'Made {when}',
            viewingOld: 'You are looking at an older version from {when}. It was replaced when a newer report came in.',
            backToCurrent: 'Back to the current version', fromReport: 'From your report of {when}',
            firstReport: 'First report', addedReport: 'Report added', laterReport: 'Later report',
            historyHint: 'Every earlier version is kept. Tap one to see it.',
            none: 'No earlier versions yet. When a new report changes this page, the old version is kept here.'
        },
        Malayalam: {
            current: 'ഇപ്പോഴത്തേത്', older: 'പഴയ പതിപ്പ്', replaced: '{when}-ന് മാറ്റി', made: '{when}-ന് ഉണ്ടാക്കിയത്',
            viewingOld: '{when}-ലെ പഴയ പതിപ്പാണ് നിങ്ങൾ കാണുന്നത്. പുതിയ റിപ്പോർട്ട് വന്നപ്പോൾ ഇത് മാറ്റി.',
            backToCurrent: 'ഇപ്പോഴത്തെ പതിപ്പിലേക്ക്', fromReport: '{when}-ലെ റിപ്പോർട്ടിൽ നിന്ന്',
            firstReport: 'ആദ്യ റിപ്പോർട്ട്', addedReport: 'ചേർത്ത റിപ്പോർട്ട്', laterReport: 'പിന്നീടുള്ള റിപ്പോർട്ട്',
            historyHint: 'പഴയ എല്ലാ പതിപ്പുകളും സൂക്ഷിച്ചിട്ടുണ്ട്. കാണാൻ ഒന്നിൽ തൊടുക.',
            none: 'ഇതുവരെ പഴയ പതിപ്പുകളില്ല. പുതിയ റിപ്പോർട്ട് ഈ പേജ് മാറ്റുമ്പോൾ പഴയത് ഇവിടെ സൂക്ഷിക്കും.'
        }
    };
    const ml = () => window.neutrixLang === 'Malayalam';
    function tx(key, vars) {
        let s = (TX[ml() ? 'Malayalam' : 'English'][key]) ?? TX.English[key] ?? key;
        for (const k in (vars || {})) s = s.replace('{' + k + '}', vars[k]);
        return s;
    }
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
    const loc = () => (window.localeFor ? localeFor() : 'en-IN');
    function day(iso) { try { return new Date(iso).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso || ''; } }
    function when(iso) { try { return new Date(iso).toLocaleString(loc(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso || ''; } }
    function dayOf(iso) { const d = new Date(iso); return isNaN(d) ? '' : (window.dayKey ? dayKey(d) : d.toISOString().slice(0, 10)); }

    // ---------- Archive of older versions ----------
    function all() { return (window.storeGet && storeGet(KEY)) || {}; }
    function list(kind) { return (all()[kind] || []).slice(); }
    // Keep `data` as an older version of `kind` (skipped if it is the same as the last one kept)
    function archive(kind, data, meta) {
        if (!data) return null;
        meta = meta || {};
        const text = JSON.stringify(data);
        const sig = text.length + ':' + hash(text);
        const h = all();
        const arr = h[kind] = h[kind] || [];
        if (arr.some(e => e.sig === sig)) return null;
        const entry = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), madeAt: meta.madeAt || '', replacedAt: new Date().toISOString(), version: meta.version || '', sig, data };
        arr.push(entry);
        h[kind] = arr.slice(-MAX);
        storeSet(KEY, h);
        return entry;
    }

    // ---------- The reports of this issue, oldest first ----------
    function reportEvents() {
        const r = window.loadReport ? loadReport() : null;
        if (!r) return [];
        const ev = summaryHistory(r).filter(e => e.kind !== 'refresh')
            .map(e => ({ at: e.createdAt, kind: e.kind === 'first' ? 'first' : 'added', files: e.files || '' }));
        (window.loadFollowups ? loadFollowups() : []).forEach(f => ev.push({ at: f.createdAt, kind: 'later', files: (f.files || []).map(x => x.name).join(', '), id: f.id }));
        return ev.filter(e => e.at).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    }
    // Day of the newest report (YYYY-MM-DD)
    function latestReportDay() {
        const ev = reportEvents();
        return ev.length ? dayOf(ev[ev.length - 1].at) : (window.dayKey ? dayKey(new Date()) : '');
    }

    // ---------- History list (same look as the Reports page) ----------
    // items: [{ id, icon, title, date, sub, current, cls }]
    function bar(host, opts) {
        if (!host) return;
        const items = opts.items || [];
        host.innerHTML = `<div class="chart-header"><h3>${esc(opts.title)}</h3><span class="mrn-badge">${items.length}</span></div>
            <p class="hint">${esc(items.length > 1 ? (opts.hint || tx('historyHint')) : tx('none'))}</p>
            <div class="history-list"></div>`;
        const listEl = host.querySelector('.history-list');
        items.forEach(it => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'history-item ' + (it.cls || (it.current ? '' : 'update')) + (opts.selected === it.id ? ' selected' : '');
            b.innerHTML = `<div class="hist-icon">${esc(it.icon || (it.current ? '📄' : '🕘'))}</div>
                <div class="hist-body"><div class="hist-title">${esc(it.title)}${it.current ? `<span class="hist-latest">${esc(tx('current'))}</span>` : ''}</div>
                <div class="hist-date">${esc(it.date || '')}</div>${it.sub ? `<div class="hist-files" title="${esc(it.sub)}">${esc(it.sub)}</div>` : ''}</div>`;
            b.addEventListener('click', () => opts.onPick && opts.onPick(it.id));
            listEl.appendChild(b);
        });
    }
    // Banner shown above an older version
    function oldBanner(whenIso, onBack) {
        const box = document.createElement('div');
        box.className = 'nxh-old';
        box.innerHTML = `<span>🕘 ${esc(tx('viewingOld', { when: when(whenIso) }))}</span>`;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-secondary'; b.textContent = tx('backToCurrent');
        b.addEventListener('click', onBack);
        box.appendChild(b);
        return box;
    }

    // ---------- Medicine schedule: built and kept up to date from the reports ----------
    function doseKey(d) { return `${d.medicine}|${d.strength}|${d.dose}|${d.slot}|${d.duration}`.toLowerCase(); }
    async function fetchDoses(record) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120000);
        try {
            const res = await fetch(`${API_BASE}/api/schedule`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report_text: fullReportText(record), bill_text: record.billText || '', language: window.neutrixLang || 'English' }),
                signal: controller.signal
            });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();
            if (data.ok === false) throw new Error(data.message);
            return data.doses || [];
        } catch (err) {
            throw err.name === 'AbortError' ? new Error(window.t ? t('askTimeout') : 'Timed out') : err;
        } finally { clearTimeout(timer); }
    }
    let syncing = null;
    // Makes the schedule the first time, and adds a dated new version when a new report changes the medicines.
    // Old versions are never changed, so the medicine history stays complete.
    function syncSchedule(record, opts) {
        opts = opts || {};
        if (!record) return Promise.resolve(null);
        if (syncing) return syncing;
        const saved = storeGet('neutrixSchedule');
        const sameIssue = saved && saved.reportId === record.createdAt && scheduleVersions(saved).some(v => v.doses.length);
        const upToDate = sameIssue && (saved.version || reportVersion(record, true)) === reportVersion(record);
        if (upToDate) return Promise.resolve(saved);
        if (!sameIssue && opts.create === false) return Promise.resolve(null);
        syncing = (async () => {
            const doses = await fetchDoses(record);
            const today = dayKey(new Date());
            if (!sameIssue) {
                const s = {
                    reportId: record.createdAt, version: reportVersion(record), createdAt: new Date().toISOString(), startDate: today,
                    versions: [{ from: today, at: new Date().toISOString(), doses: doses.map((d, i) => ({ ...d, id: 'v0d' + i })) }], ticks: {}
                };
                storeSet('neutrixSchedule', s);
                return s;
            }
            const versions = scheduleVersions(saved);
            const current = dosesForDay(saved, today);
            const same = doses.length === current.length && doses.map(doseKey).sort().join() === current.map(doseKey).sort().join();
            if (!same) {
                const n = versions.length;
                const newDoses = doses.map((d, i) => ({ ...d, id: `v${n}d${i}` }));
                const last = versions[versions.length - 1];
                // The change starts on the day the new report came in (never before the last change)
                let from = latestReportDay() || today;
                if (from > today) from = today;
                if (from < last.from) from = last.from;
                // Keep ticks for medicines that are still in the plan, from that day on
                if (!saved.ticks) saved.ticks = {};
                Object.keys(saved.ticks).filter(k => k >= from).forEach(k => {
                    const dayTicks = saved.ticks[k] || {}, carried = {};
                    newDoses.forEach(nd => {
                        const old = current.find(od => od.medicine === nd.medicine && od.slot === nd.slot && dayTicks[od.id]);
                        if (old) carried[nd.id] = dayTicks[old.id];
                    });
                    saved.ticks[k] = carried;
                });
                versions.push({ from, at: new Date().toISOString(), doses: newDoses });
            }
            saved.version = reportVersion(record);
            storeSet('neutrixSchedule', saved);
            return saved;
        })().finally(() => { syncing = null; });
        return syncing;
    }

    // ---------- Medicine changes between versions ----------
    const norm = n => String(n || '').toLowerCase().replace(/^(tab|tablet|cap|capsule|inj|injection|syp|syr|syrup|oint|drops?)\.?\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const SLOT_ORDER = ['morning', 'afternoon', 'evening', 'night', 'unclear'];
    function group(doses) {
        const m = new Map();
        (doses || []).forEach(d => {
            const k = norm(d.medicine);
            if (!k) return;
            const g = m.get(k) || { key: k, name: d.medicine, strength: d.strength || '', dose: d.dose || '', duration: d.duration || '', purpose_en: d.purpose_en || '', purpose_ml: d.purpose_ml || '', slots: new Set() };
            g.slots.add(d.slot || 'unclear');
            m.set(k, g);
        });
        return m;
    }
    function slotsText(g) {
        const names = window.t ? { morning: t('slotMorning'), afternoon: t('slotAfternoon'), evening: t('slotEvening'), night: t('slotNight'), unclear: t('slotUnclear') } : {};
        return SLOT_ORDER.filter(s => g.slots.has(s)).map(s => (names[s] || s).replace(/^[^\p{L}]+/u, '')).join(', ');
    }
    function describe(g) { return [g.strength, g.dose, slotsText(g)].filter(Boolean).join(' · '); }    // Last day of a medicine's course in a version (null = no end written)
    function courseEnd(v, k) {
        const ends = v.doses.filter(d => norm(d.medicine) === k).map(d => doseEndDay(d, v.from));
        return ends.length && ends.every(Boolean) ? ends.sort().pop() : null;
    }
    // Newest first: [{ from, at, first, added:[g], stopped:[g], changed:[{before, after}], meds: Map }]
    function medTimeline(schedule) {
        const vs = schedule ? scheduleVersions(schedule) : [];
        const out = [];
        vs.forEach((v, i) => {
            const now = group(v.doses), prev = i ? group(vs[i - 1].doses) : new Map();
            const e = { from: v.from, at: v.at || '', first: i === 0, added: [], stopped: [], changed: [], meds: now };
            now.forEach((g, k) => {
                const p = prev.get(k);
                if (!p) e.added.push(g);
                else if (describe(p) !== describe(g) || p.duration !== g.duration) e.changed.push({ before: p, after: g });
            });            // stopped by this report (not ones whose course had already finished before it)
            prev.forEach((g, k) => { if (!now.has(k)) { const end = courseEnd(vs[i - 1], k); if (!(end && end < v.from)) e.stopped.push(g); } });
            out.push(e);
        });
        return out.reverse();
    }
    // Medicines no longer taken: stopped by a newer report, or their course finished
    function pastMeds(schedule, todayKey) {
        if (!schedule) return [];
        const vs = scheduleVersions(schedule);
        const nowKeys = new Set([...group(dosesForDay(schedule, todayKey)).keys()]);
        const seen = new Map();
        vs.forEach((v, i) => {
            const next = vs[i + 1];
            group(v.doses).forEach((g, k) => {
                const s = seen.get(k) || { g, from: v.from, to: null, why: '' };
                s.g = g;                const end = courseEnd(v, k);
                const until = next ? next.from : todayKey;
                if (end && end < until && end < todayKey) { s.to = end; s.why = 'finished'; }          // the course ran out first
                else if (next && !group(next.doses).has(k)) { s.to = dayKeyShift(next.from, -1); s.why = 'stopped'; }
                else { s.to = null; s.why = ''; }
                seen.set(k, s);
            });
        });
        return [...seen.entries()].filter(([k, s]) => !nowKeys.has(k) && s.to).map(([, s]) => s).sort((a, b) => b.to.localeCompare(a.to));
    }

    window.NxHist = { tx, esc, day, when, dayOf, list, archive, reportEvents, latestReportDay, bar, oldBanner, syncSchedule, medTimeline, pastMeds, describe, group };
})();
