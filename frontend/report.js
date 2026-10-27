// =====================================================
// AI Patient Reports Portal: shows the AI summary of this issue's reports.
// (The medicine plan and check-ups have their own pages on the dashboard.)
// =====================================================

const record = loadReport();

function loadingLine(text) {
    const p = document.createElement('p');
    p.className = 'loading-line';
    p.textContent = text;
    return p;
}

let selectedVersion = null;   // null = the current summary

function versionLabel(kind) {
    return kind === 'first' ? t('verFirst') : kind === 'update' ? t('verUpdate') : t('verRefresh');
}

function formatWhen(iso) {
    try {
        return new Date(iso).toLocaleString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return iso || '';
    }
}

// Right column: every version of the summary, newest first
function renderHistory() {
    const history = summaryHistory(record);
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    document.getElementById('versionCount').textContent = history.length;

    history.map((entry, index) => ({ entry, index })).reverse().forEach(({ entry, index }) => {
        const isCurrent = index === history.length - 1;
        const selected = isCurrent ? selectedVersion === null : selectedVersion === index;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'history-item ' + (entry.kind === 'first' ? '' : entry.kind === 'update' ? 'update' : 'compare') + (selected ? ' selected' : '');

        const icon = document.createElement('div');
        icon.className = 'hist-icon';
        icon.textContent = entry.kind === 'first' ? '📄' : entry.kind === 'update' ? '➕' : '🔄';

        const body = document.createElement('div');
        body.className = 'hist-body';
        const title = document.createElement('div');
        title.className = 'hist-title';
        title.appendChild(document.createTextNode(versionLabel(entry.kind)));
        if (isCurrent) {
            const tag = document.createElement('span');
            tag.className = 'hist-latest';
            tag.textContent = t('verCurrent');
            title.appendChild(tag);
        }
        const date = document.createElement('div');
        date.className = 'hist-date';
        date.textContent = formatWhen(entry.createdAt);
        const files = document.createElement('div');
        files.className = 'hist-files';
        files.textContent = entry.files || '';
        files.title = entry.files || '';
        body.append(title, date, files);

        btn.append(icon, body);
        btn.addEventListener('click', () => {
            selectedVersion = isCurrent ? null : index;
            renderHistory();
            showSummary();
            if (window.innerWidth <= 1024) {
                document.getElementById('reportView').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        list.appendChild(btn);
    });
}

// Show the selected summary in the current language, translating (and saving) if needed
async function showSummary() {
    const el = document.getElementById('reportSummary');
    const lang = neutrixLang;
    const history = summaryHistory(record);
    const old = selectedVersion !== null ? history[selectedVersion] : null;
    const map = old ? old.summary : record.summaries;
    const viewing = selectedVersion;

    document.getElementById('oldVersionBar').classList.toggle('hidden', !old);
    if (old) {
        document.getElementById('oldVersionText').textContent =
            `${t('verViewing')} (${versionLabel(old.kind)} · ${formatWhen(old.createdAt)})`;
    }
    el.scrollTop = 0;

    if (!map) {
        el.innerHTML = '';
        el.appendChild(loadingLine(t('histNoSnapshot')));
        return;
    }
    if (map[lang]) {
        el.innerHTML = renderMarkdown(map[lang]);
        return;
    }
    el.innerHTML = '';
    el.appendChild(loadingLine(t('translating')));
    try {
        await getLocalized(map, lang);
        storeSet('neutrixReport', record);
    } catch (e) {
        if (neutrixLang !== lang || selectedVersion !== viewing) return;
        el.innerHTML = '';
        el.appendChild(loadingLine(t('translateFail')));
        const original = document.createElement('div');
        original.innerHTML = renderMarkdown(map.English || map.Malayalam || '');
        el.appendChild(original);
        return;
    }
    if (neutrixLang === lang && selectedVersion === viewing) el.innerHTML = renderMarkdown(map[lang]);
}

function renderDetails() {
    let generated = record.updatedAt || record.createdAt;
    try {
        generated = new Date(generated).toLocaleString(localeFor(), { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {}
    document.getElementById('detailDischargeName').textContent = record.dischargeName || '-';
    document.getElementById('detailBillName').textContent = record.billName || t('detailNone');
    document.getElementById('detailGeneratedOn').textContent = generated;
    document.getElementById('detailLanguageValue').textContent =
        record.language === 'Malayalam' ? 'മലയാളം' : 'English';
}

// ---------- Keep the summary up to date ----------
// If files or new reports were added since this summary was made, remake it automatically.
function summaryIsCurrent() {
    return (record.summaryVersion || reportVersion(record, true)) === reportVersion(record);
}

async function refreshSummary() {
    const el = document.getElementById('reportSummary');
    const lang = neutrixLang;
    el.innerHTML = '';
    el.appendChild(loadingLine(t('summaryUpdating')));

    const formData = new FormData();
    formData.append('previous_text', fullReportText(record));
    formData.append('previous_bill_text', record.billText || '');
    formData.append('language', lang);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
        const res = await fetch(`${API_BASE}/api/summarize`, { method: 'POST', body: formData, signal: controller.signal });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        if (data.ok === false) throw new Error(data.summary);

        record.summaries = { [lang]: data.summary };     // old translations are out of date
        record.summaryVersion = reportVersion(record);
        const latestReport = loadFollowups().slice(-1)[0];
        addSummaryVersion(record, 'refresh', latestReport ? (latestReport.files || []).map(f => f.name).join(', ') : '', record.summaries);
        renderHistory();
        storeSet('neutrixReport', record);
        showSummary();
    } catch (e) {
        // Keep showing the last summary, with a note
        await showSummary();
        const note = loadingLine(t('summaryUpdateFail'));
        el.prepend(note);
    } finally {
        clearTimeout(timer);
    }
}

if (!record) {
    document.getElementById('emptyView').classList.remove('hidden');
} else {
    document.getElementById('reportView').classList.remove('hidden');
    document.getElementById('detailsBlock').classList.remove('hidden');
    document.getElementById('historyBlock').classList.remove('hidden');
    document.getElementById('backToCurrentBtn').addEventListener('click', () => {
        selectedVersion = null;
        renderHistory();
        showSummary();
    });
    renderDetails();
    renderHistory();
    if (summaryIsCurrent()) showSummary();
    else refreshSummary();

    document.addEventListener('neutrix:langchange', () => {
        renderDetails();
        renderHistory();
        showSummary();
    });
}
