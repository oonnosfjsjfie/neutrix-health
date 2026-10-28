// =====================================================
// AI Discharge Summary tab
// - No summary yet: first upload (reports + bills) -> back to dashboard
// - Summary exists: show saved reports + "Add New Report" to compare
// =====================================================

const savedRecord = loadReport();

function fileInfo(files) {
    return files.map(f => ({ name: f.name, size: f.size }));
}

function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return iso || '';
    }
}

// Older records only stored names as text, so rebuild a list from them
function savedFiles(record, listKey, namesKey) {
    if (Array.isArray(record[listKey])) return record[listKey];
    return (record[namesKey] || '').split(',').map(n => n.trim()).filter(Boolean).map(name => ({ name }));
}

function backToDashboard() {
    showStatus('success', 'backToDashboard');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
}

// ---------- Saved reports list ----------
function renderSaved() {
    const list = document.getElementById('savedList');
    list.innerHTML = '';
    if (!savedRecord) return;

    const items = [];
    savedFiles(savedRecord, 'files', 'dischargeName').forEach(f =>
        items.push({ ...f, date: savedRecord.createdAt, badge: t('savedFirst'), cls: '' }));
    savedFiles(savedRecord, 'bills', 'billName').forEach(f =>
        items.push({ ...f, date: savedRecord.createdAt, badge: t('savedBill'), cls: 'bill' }));
    loadFollowups().forEach(fu => (fu.files || []).forEach(f =>
        items.push({ ...f, date: fu.createdAt, badge: t('savedLater'), cls: 'later' })));

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'saved-item ' + item.cls;

        const icon = document.createElement('div');
        icon.className = 'file-chip-icon';
        icon.textContent = /\.(jpe?g|png|webp|heic|heif)$/i.test(item.name || '') ? 'IMG' : 'PDF';

        const info = document.createElement('div');
        info.className = 'file-chip-info';
        const name = document.createElement('div');
        name.className = 'file-chip-name';
        name.textContent = item.name;
        const meta = document.createElement('div');
        meta.className = 'file-chip-size';
        meta.textContent = [formatDate(item.date), formatBytes(item.size)].filter(Boolean).join(' · ');
        info.append(name, meta);

        const badge = document.createElement('span');
        badge.className = 'saved-badge';
        badge.textContent = item.badge;

        row.append(icon, info, badge);
        list.appendChild(row);
    });
}

// ---------- First upload ----------
document.getElementById('processBtn').addEventListener('click', async () => {
    const processBtn = document.getElementById('processBtn');
    const reports = window.neutrixUploads.pdf;
    const bills = window.neutrixUploads.bill;
    const language = window.neutrixLang;
    const resultOutput = document.getElementById('resultOutput');
    const aiTextResponse = document.getElementById('aiTextResponse');

    if (reports.length === 0) {
        showStatus('warning', 'noFile');
        return;
    }

    const formData = new FormData();
    reports.forEach(file => formData.append("files", file));
    bills.forEach(file => formData.append("bills", file));
    formData.append("language", language);

    showStatus('info', 'loading');
    resultOutput.classList.add('hidden');
    processBtn.disabled = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);

    try {
        const response = await fetch(`${API_BASE}/api/summarize`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timer);

        if (!response.ok) {
            throw new Error(`Server returned error code: ${response.status}`);
        }

        const data = await response.json();

        if (data.ok === false) {
            showStatus('error', 'rawMsg', { msg: data.summary });
            return;
        }

        const record = {
            summaries: { [language]: data.summary },
            reportText: data.transcription || "",
            billText: data.bill_text || "",
            language: language,
            files: fileInfo(reports),
            bills: fileInfo(bills),
            dischargeName: reports.map(f => f.name).join(', '),
            billName: bills.map(f => f.name).join(', '),
            createdAt: new Date().toISOString(),
            // Kept for the history on My Improvements
            firstSummary: { [language]: data.summary },
            firstFiles: fileInfo(reports),
            firstBills: fileInfo(bills),
            updates: [],
            summaryHistory: [{
                kind: 'first',
                createdAt: new Date().toISOString(),
                files: reports.concat(bills).map(f => f.name).join(', '),
                summary: { [language]: data.summary }
            }]
        };

        if (storeSet('neutrixReport', record)) {
            try {
                localStorage.removeItem('neutrixPlan');
                localStorage.removeItem('neutrixCheckups');
                localStorage.removeItem('neutrixFollowups');
            } catch (e) {}
            backToDashboard();
        } else {
            showStatus('warning', 'storageFail');
            aiTextResponse.innerHTML = renderMarkdown(data.summary);
            resultOutput.classList.remove('hidden');
        }

    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            showStatus('error', 'timeout');
        } else {
            showStatus('error', 'serverError', { msg: err.message });
        }
    } finally {
        processBtn.disabled = false;
    }
});

// ---------- Add more files to the saved set and update the summary ----------
const addMorePanel = document.getElementById('addMorePanel');

document.getElementById('addMoreBtn').addEventListener('click', () => {
    addMorePanel.classList.toggle('hidden');
    if (!addMorePanel.classList.contains('hidden')) {
        addMorePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

document.getElementById('cancelMoreBtn').addEventListener('click', () => {
    window.neutrixUploads.more.length = 0;
    window.neutrixUploads.morebill.length = 0;
    document.getElementById('moreList').innerHTML = '';
    document.getElementById('morebillList').innerHTML = '';
    document.getElementById('moreDropZone').classList.remove('compact');
    document.getElementById('morebillDropZone').classList.remove('compact');
    addMorePanel.classList.add('hidden');
    showStatus(null);
});

document.getElementById('updateBtn').addEventListener('click', async () => {
    const updateBtn = document.getElementById('updateBtn');
    const moreReports = window.neutrixUploads.more;
    const moreBills = window.neutrixUploads.morebill;
    const language = window.neutrixLang;

    if (!savedRecord) return;
    if (moreReports.length === 0 && moreBills.length === 0) {
        showStatus('warning', 'noMoreFile');
        return;
    }

    const formData = new FormData();
    moreReports.forEach(file => formData.append("files", file));
    moreBills.forEach(file => formData.append("bills", file));
    formData.append("previous_text", savedRecord.reportText || "");
    formData.append("previous_bill_text", savedRecord.billText || "");
    formData.append("language", language);

    showStatus('info', 'updateLoading');
    updateBtn.disabled = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);

    try {
        const response = await fetch(`${API_BASE}/api/summarize`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`Server returned error code: ${response.status}`);

        const data = await response.json();
        if (data.ok === false) {
            showStatus('error', 'rawMsg', { msg: data.summary });
            return;
        }

        const files = savedFiles(savedRecord, 'files', 'dischargeName').concat(fileInfo(moreReports));
        const bills = savedFiles(savedRecord, 'bills', 'billName').concat(fileInfo(moreBills));
        const record = {
            ...savedRecord,
            summaries: { [language]: data.summary },   // old translations are out of date
            reportText: data.transcription || savedRecord.reportText || "",
            billText: data.bill_text || savedRecord.billText || "",
            language: language,
            files: files,
            bills: bills,
            dischargeName: files.map(f => f.name).join(', '),
            billName: bills.map(f => f.name).join(', '),
            updatedAt: new Date().toISOString()
        };
        // Keep the first summary and add this upload to the history
        if (!record.firstSummary) record.firstSummary = { ...(savedRecord.summaries || {}) };
        if (!record.firstFiles) record.firstFiles = savedFiles(savedRecord, 'files', 'dischargeName');
        if (!record.firstBills) record.firstBills = savedFiles(savedRecord, 'bills', 'billName');
        record.summaryHistory = summaryHistory({ ...savedRecord }).slice();
        addSummaryVersion(record, 'update', moreReports.concat(moreBills).map(f => f.name).join(', '), { [language]: data.summary });
        record.updates = (savedRecord.updates || []).concat({
            createdAt: record.updatedAt,
            files: fileInfo(moreReports),
            bills: fileInfo(moreBills),
            summary: { [language]: data.summary }
        });
        // This summary doesn't include reports added with "Compare", so the
        // Reports Portal remakes it with everything if there are any
        record.summaryVersion = loadFollowups().length ? 'partial' : reportVersion(record);

        if (!storeSet('neutrixReport', record)) {
            showStatus('warning', 'storageFail');
            return;
        }
        // The plan and check-ups were made from the old files, so make them again
        try {
            localStorage.removeItem('neutrixPlan');
            localStorage.removeItem('neutrixCheckups');
        } catch (e) {}
        backToDashboard();

    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            showStatus('error', 'timeout');
        } else {
            showStatus('error', 'serverError', { msg: err.message });
        }
    } finally {
        updateBtn.disabled = false;
    }
});

// ---------- Add a new report and compare ----------
document.getElementById('compareBtn').addEventListener('click', async () => {
    const compareBtn = document.getElementById('compareBtn');
    const newFiles = window.neutrixUploads.new;
    const language = window.neutrixLang;

    if (!savedRecord) return;
    if (newFiles.length === 0) {
        showStatus('warning', 'noNewFile');
        return;
    }

    const formData = new FormData();
    newFiles.forEach(file => formData.append("files", file));
    formData.append("previous_text", fullReportText(savedRecord));
    formData.append("language", language);

    showStatus('info', 'compareLoading');
    compareBtn.disabled = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);

    try {
        const response = await fetch(`${API_BASE}/api/compare`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`Server returned error code: ${response.status}`);

        const data = await response.json();
        if (data.ok === false) {
            showStatus('error', 'rawMsg', { msg: data.comparison });
            return;
        }

        const followups = loadFollowups();
        followups.push({
            id: 'f' + Date.now().toString(36),
            createdAt: new Date().toISOString(),
            files: fileInfo(newFiles),
            text: data.new_text || '',
            comparison: { [language]: data.comparison }
        });

        if (!storeSet('neutrixFollowups', followups)) {
            showStatus('warning', 'storageFail');
            return;
        }
        backToDashboard();

    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            showStatus('error', 'timeout');
        } else {
            showStatus('error', 'serverError', { msg: err.message });
        }
    } finally {
        compareBtn.disabled = false;
    }
});

document.getElementById('viewSummaryBtn').addEventListener('click', () => {
    window.location.href = 'report.html';
});

// ---------- Which view to show ----------
document.getElementById('firstUpload').classList.toggle('hidden', !!savedRecord);
document.getElementById('savedSection').classList.toggle('hidden', !savedRecord);
renderSaved();
document.addEventListener('neutrix:langchange', renderSaved);
