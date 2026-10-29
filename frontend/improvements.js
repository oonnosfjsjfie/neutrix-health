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
