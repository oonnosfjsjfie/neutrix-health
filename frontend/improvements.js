// =====================================================
// My Improvements
// Right column: a history of every upload for this issue
//   - First upload           -> its AI summary
//   - Files added            -> the AI summary made after adding them
//   - New report compared    -> the comparison with earlier reports
// Click any entry to see it in the main area.
// =====================================================

const impRecord = loadReport();
const impFollowups = loadFollowups();
let selectedId = null;

function impDateTime(iso) {
    try {
        return new Date(iso).toLocaleString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return iso || '';
    }
}

function names(list) {
    return (list || []).map(f => f.name).filter(Boolean).join(', ');
}

// Older records only stored names as text
function listFrom(record, listKey, namesKey) {
    if (Array.isArray(record[listKey])) return record[listKey];
    return (record[namesKey] || '').split(',').map(n => n.trim()).filter(Boolean).map(name => ({ name }));
}

// Build the history, oldest first
function buildHistory() {
    const entries = [];
    if (!impRecord) return entries;

    const updates = impRecord.updates || [];
    const firstFiles = impRecord.firstFiles || listFrom(impRecord, 'files', 'dischargeName');
    const firstBills = impRecord.firstBills || listFrom(impRecord, 'bills', 'billName');
    // Before history existed, the current summary is the first one only if nothing was added since
    const firstSummary = impRecord.firstSummary || (!impRecord.updatedAt ? impRecord.summaries : null);

    entries.push({
        id: 'first',
        type: 'first',
        icon: '📄',
        date: impRecord.createdAt,
        files: names(firstFiles.concat(firstBills)),
        content: firstSummary,
        save: () => storeSet('neutrixReport', impRecord)
    });

    updates.forEach((u, i) => entries.push({
        id: 'u' + i,
        type: 'update',
        icon: '➕',
        date: u.createdAt,
        files: names((u.files || []).concat(u.bills || [])),
        content: u.summary,
        save: () => storeSet('neutrixReport', impRecord)
    }));

    impFollowups.forEach(f => entries.push({
        id: f.id,
        type: 'compare',
        icon: '📈',
        date: f.createdAt,
        files: names(f.files),
        content: f.comparison,
        save: () => storeSet('neutrixFollowups', impFollowups)
    }));

    return entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function kindLabel(type) {
    return type === 'first' ? t('histFirst') : type === 'update' ? t('histUpdate') : t('histCompare');
}

function loadingLine(text) {
    const p = document.createElement('p');
    p.className = 'loading-line';
    p.textContent = text;
    return p;
}

// Show AI text in the current language, translating (and saving) if needed
async function showContent(el, entry) {
    const map = entry.content;
    if (!map) {
        el.innerHTML = '';
        el.appendChild(loadingLine(t('histNoSnapshot')));
        return;
    }
    const lang = neutrixLang;
    if (map[lang]) {
        el.innerHTML = renderMarkdown(map[lang]);
        return;
    }
    el.innerHTML = '';
    el.appendChild(loadingLine(t('translating')));
    try {
        await getLocalized(map, lang);
        entry.save();
    } catch (e) {
        if (neutrixLang !== lang || selectedId !== entry.id) return;
        el.innerHTML = '';
        el.appendChild(loadingLine(t('translateFail')));
        const original = document.createElement('div');
        original.innerHTML = renderMarkdown(map.English || map.Malayalam || Object.values(map)[0] || '');
        el.appendChild(original);
        return;
    }
    if (neutrixLang === lang && selectedId === entry.id) el.innerHTML = renderMarkdown(map[lang]);
}

function renderViewer(history) {
    const entry = history.find(e => e.id === selectedId);
    if (!entry) return;

    document.getElementById('emptyView').classList.add('hidden');
    document.getElementById('improveView').classList.remove('hidden');

    document.getElementById('viewKind').textContent =
        `${entry.icon} ${kindLabel(entry.type)} · ${entry.type === 'compare' ? t('histComparisonOf') : t('histSummaryOf')}`;
    document.getElementById('viewMeta').textContent =
        `${impDateTime(entry.date)}${entry.files ? ' · ' + t('histFiles', { files: entry.files }) : ''}`;

    const content = document.getElementById('viewContent');
    content.scrollTop = 0;
    showContent(content, entry);
    if (visualsButton) visualsButton.refresh();
}

// 🖼 Show visual representation: pictures from the report that is open (hidden if it had none)
const visualsButton = window.NxVisuals
    ? NxVisuals.attachButton(document.getElementById('visualsSlot'), () => selectedId ? NxVisuals.forGroups([selectedId]) : [])
    : null;

function renderHistory(history) {
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    document.getElementById('reportCount').textContent = history.length;

    // Newest at the top
    [...history].reverse().forEach((entry, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `history-item ${entry.type}` + (entry.id === selectedId ? ' selected' : '');

        const icon = document.createElement('div');
        icon.className = 'hist-icon';
        icon.textContent = entry.icon;

        const body = document.createElement('div');
        body.className = 'hist-body';

        const title = document.createElement('div');
        title.className = 'hist-title';
        title.appendChild(document.createTextNode(kindLabel(entry.type)));
        if (index === 0) {
            const latest = document.createElement('span');
            latest.className = 'hist-latest';
            latest.textContent = t('histLatest');
            title.appendChild(latest);
        }

        const date = document.createElement('div');
        date.className = 'hist-date';
        date.textContent = impDateTime(entry.date);

        const files = document.createElement('div');
        files.className = 'hist-files';
        files.textContent = entry.files;
        files.title = entry.files;

        body.append(title, date, files);
        btn.append(icon, body);
        btn.addEventListener('click', () => {
            selectedId = entry.id;
            renderAll();
            if (window.innerWidth <= 1024) {
                document.getElementById('improveView').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        list.appendChild(btn);
    });
}

function renderAll() {
    const history = buildHistory();
    renderHistory(history);
    if (selectedId) renderViewer(history);
}

// ---------- Start ----------
const startHistory = buildHistory();
const lastCompare = [...startHistory].reverse().find(e => e.type === 'compare');

if (lastCompare) {
    selectedId = lastCompare.id;              // open on the latest comparison
} else {
    document.getElementById('emptyView').classList.remove('hidden');   // nothing compared yet
}

document.addEventListener('neutrix:langchange', renderAll);
renderAll();

// ---------- Test results over time (lab values from every report, copied exactly by the AI) ----------
(function labTrends() {
    const box = document.getElementById('labTrends');
    if (!box || !impRecord) return;
    const L = () => neutrixLang === 'Malayalam' ? {
        title: 'പരിശോധനാ ഫലങ്ങൾ കാലക്രമത്തിൽ', sub: 'നിങ്ങളുടെ റിപ്പോർട്ടുകളിലെ ഓരോ ടെസ്റ്റ് മൂല്യവും, തീയതി പ്രകാരം. എഴുതിയതുപോലെ തന്നെ പകർത്തിയത്.',
        loading: 'റിപ്പോർട്ടുകളിലെ പരിശോധനാ ഫലങ്ങൾ വായിക്കുന്നു…', failed: 'ഇപ്പോൾ പരിശോധനാ ഫലങ്ങൾ വായിക്കാനായില്ല.', retry: 'വീണ്ടും ശ്രമിക്കുക',
        none: 'റിപ്പോർട്ടുകളിൽ സംഖ്യയുള്ള പരിശോധനാ ഫലങ്ങൾ കണ്ടെത്തിയില്ല.', once: 'ഇതുവരെ ഒരു ഫലം മാത്രം', report: 'റിപ്പോർട്ട് {n}',
        normal: 'സാധാരണ: {r}', better: 'മെച്ചപ്പെട്ടു', worse: 'മോശമായി', same: 'മാറ്റമില്ല', changed: 'മാറി',
        note: 'ഇത് നിങ്ങളുടെ റിപ്പോർട്ടുകളിൽ നിന്ന് പകർത്തിയതാണ്. ഫലങ്ങളുടെ അർത്ഥം ഡോക്ടറോട് ചോദിക്കുക.'
    } : {
        title: 'Your test results over time', sub: 'Every test value in your reports, by date. Copied exactly as written.',
        loading: 'Reading the test results in your reports…', failed: 'Could not read your test results right now.', retry: 'Try again',
        none: 'No numeric test results were found in your reports.', once: 'Only one result so far', report: 'Report {n}',
        normal: 'Normal: {r}', better: 'Better', worse: 'Worse', same: 'No change', changed: 'Changed',
        note: 'Copied from your reports. Ask your doctor what your results mean for you.'
    };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const version = reportVersion(impRecord);
    let data = null, failed = false;
    const saved = storeGet('neutrixLabTrends');
    if (saved && saved.version === version) data = saved.data;

    function day(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } }
    function render() {
        const l = L();
        let html = `<div class="section-title">${esc(l.title)}</div><p class="hint">${esc(l.sub)}</p>`;
        if (!data) {
            html += failed ? `<p class="loading-line">${esc(l.failed)}</p><button type="button" class="btn-secondary lt-retry">${esc(l.retry)}</button>`
                : `<p class="loading-line">${esc(l.loading)}</p>`;
            box.innerHTML = html;
            const r = box.querySelector('.lt-retry'); if (r) r.onclick = load;
            return;
        }
        const tests = (data.tests || []).map(t => {
            const pts = t.points.slice().sort((a, b) => (a.date && b.date) ? a.date.localeCompare(b.date) : (a.doc || 0) - (b.doc || 0));
            return { ...t, pts };
        });
        if (!tests.length) { box.innerHTML = html + `<p class="hint">${esc(l.none)}</p>`; return; }
        const multi = tests.filter(t => t.pts.length >= 2), single = tests.filter(t => t.pts.length < 2);
        html += '<div class="lt-grid">';
        multi.forEach(t => {
            const labels = t.pts.map(p => p.date ? day(p.date) : l.report.replace('{n}', p.doc || '?'));
            const bp = t.pts.every(p => /\//.test(p.value));
            const series = bp
                ? [{ name: 'Systolic', values: t.pts.map(p => parseFloat(p.value.split('/')[0])) }, { name: 'Diastolic', values: t.pts.map(p => parseFloat(p.value.split('/')[1])) }]
                : [{ name: t.name, values: t.pts.map(p => parseFloat(p.value)) }];
            const first = series[0].values[0], last = series[0].values[series[0].values.length - 1];
            let trend = l.same, cls = 'same';
            if (last !== first && isFinite(first) && isFinite(last)) {
                if (t.better) { const good = t.better === 'lower' ? last < first : last > first; trend = good ? l.better : l.worse; cls = good ? 'good' : 'bad'; }
                else { trend = l.changed; cls = 'chg'; }
            }
            const chart = window.NxCharts ? NxCharts.render({ type: 'line', title: t.name, unit: t.unit, labels, series }) : '';
            html += `<div class="lt-card"><div class="lt-head"><b>${esc(t.name)}</b><span class="lt-trend ${cls}">${esc(trend)}</span></div>
                <div class="lt-vals">${t.pts.map((p, i) => `<span>${esc(labels[i])}: <b>${esc(p.value)}</b> ${esc(t.unit)}</span>`).join('<span class="lt-arrow">→</span>')}</div>
                ${t.normal ? `<div class="hint">${esc(l.normal.replace('{r}', t.normal))}</div>` : ''}${chart || ''}</div>`;
        });
        html += '</div>';
        if (single.length) {
            html += `<div class="lt-single"><div class="lt-single-t">${esc(l.once)}</div><ul>${single.map(t => `<li><b>${esc(t.name)}</b>: ${esc(t.pts[0].value)} ${esc(t.unit)}${t.pts[0].date ? ' · ' + esc(day(t.pts[0].date)) : ''}${t.normal ? ` <span class="hint">(${esc(l.normal.replace('{r}', t.normal))})</span>` : ''}</li>`).join('')}</ul></div>`;
        }        html += `<p class="hint" style="margin-top:10px">${esc(l.note)}</p>`;
        box.innerHTML = html;
        // "Where it says this": the report line with that test
        if (window.NxCare) box.querySelectorAll('.lt-card').forEach((card, i) => {
            const t = multi[i];
            if (!t) return;
            const last = t.pts[t.pts.length - 1];
            card.querySelector('.lt-head').appendChild(NxCare.sourceButton(`${t.name}: ${last.value} ${t.unit}`, [t.name.split(/[\s(]/)[0], String(last.value).split('/')[0]]));
        });
    }
    async function load() {
        failed = false; render();
        try {
            const res = await fetch(`${API_BASE}/api/lab-trends`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: fullReportText(impRecord) }) });
            if (!res.ok) throw new Error('lab trends ' + res.status);
            const d = await res.json();
            if (!d || !Array.isArray(d.tests)) throw new Error('bad answer');
            data = d;
            storeSet('neutrixLabTrends', { version, data: d, at: new Date().toISOString() });
        } catch (e) {
            console.warn('[improvements] lab trends', e);
            if (saved && saved.data) data = saved.data; else failed = true;     // older results are better than none
        }
        render();
    }
    box.classList.remove('hidden');
    if (data) render(); else load();
    document.addEventListener('neutrix:langchange', render);
})();


// ---------- Home readings from the Recovery Tracker, as charts ----------
(function homeReadings() {
    const box = document.getElementById('homeReadings');
    if (!box) return;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function render() {
        const ml = neutrixLang === 'Malayalam';
        const list = (storeGet('neutrixTracker') || []).slice(-30);
        const day = iso => { try { return new Date(iso).toLocaleDateString(localeFor(), { day: 'numeric', month: 'short' }); } catch (e) { return iso; } };
        const series = [];
        const bp = list.map(r => ({ at: r.at, m: String(r.bp || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/) })).filter(x => x.m);
        if (bp.length >= 2) series.push({ title: ml ? 'രക്തസമ്മർദ്ദം' : 'Blood pressure', unit: 'mmHg', labels: bp.map(x => day(x.at)),
            series: [{ name: ml ? 'സിസ്റ്റോളിക്' : 'Systolic', values: bp.map(x => +x.m[1]) }, { name: ml ? 'ഡയസ്റ്റോളിക്' : 'Diastolic', values: bp.map(x => +x.m[2]) }] });
        [['sugar', ml ? 'ഷുഗർ' : 'Blood sugar', 'mg/dL'], ['weight', ml ? 'ഭാരം' : 'Weight', 'kg'], ['temp', ml ? 'താപനില' : 'Temperature', '']].forEach(([k, n, u]) => {
            const pts = list.map(r => ({ at: r.at, v: parseFloat(r[k]) })).filter(x => isFinite(x.v));
            if (pts.length >= 2) series.push({ title: n, unit: u, labels: pts.map(x => day(x.at)), series: [{ name: n, values: pts.map(x => x.v) }] });
        });
        if (!series.length) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        box.innerHTML = `<div class="section-title">${esc(ml ? 'വീട്ടിലെ റീഡിംഗുകൾ' : 'Your home readings')}</div>
            <p class="hint">${esc(ml ? 'റിക്കവറി ട്രാക്കറിൽ നിങ്ങൾ എഴുതിയ അളവുകൾ (അവസാന 30).' : 'The readings you wrote in the Recovery Tracker (last 30).')}</p>
            <div class="lt-grid">${series.map(s => `<div class="lt-card"><div class="lt-head"><b>${esc(s.title)}</b><span class="nxh-muted">${esc(s.series.map(x => x.values[x.values.length - 1]).join('/'))} ${esc(s.unit)}</span></div>${window.NxCharts ? NxCharts.render({ type: 'line', title: s.title, unit: s.unit, labels: s.labels, series: s.series }) : ''}</div>`).join('')}</div>
            <p class="hint"><a href="tracking.html">${esc(ml ? 'പുതിയ റീഡിംഗ് ചേർക്കുക' : 'Add a reading')}</a></p>`;
    }
    render();
    document.addEventListener('neutrix:langchange', render);
})();
