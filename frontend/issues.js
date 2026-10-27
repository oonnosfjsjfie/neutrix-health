// =====================================================
// My Medical Issues: list, add, edit, delete and open issues.
// Each issue's data is stored as "key::issueId" (see issue-scope.js).
// =====================================================

const ISSUES_KEY = 'neutrixIssues';
const ACTIVE_KEY = 'neutrixActiveIssue';

const CATEGORIES = [
    { id: 'surgery',     icon: '🏥', en: 'Surgery / Operation',  ml: 'ശസ്ത്രക്രിയ' },
    { id: 'heart',       icon: '❤️', en: 'Heart',                ml: 'ഹൃദയം' },
    { id: 'diabetes',    icon: '🩸', en: 'Diabetes / Sugar',     ml: 'പ്രമേഹം' },
    { id: 'infection',   icon: '🦠', en: 'Infection / Fever',    ml: 'അണുബാധ / പനി' },
    { id: 'injury',      icon: '🦴', en: 'Injury / Fracture',    ml: 'പരിക്ക് / ഒടിവ്' },
    { id: 'respiratory', icon: '🫁', en: 'Breathing / Lungs',    ml: 'ശ്വാസകോശം' },
    { id: 'pregnancy',   icon: '🤰', en: 'Pregnancy',            ml: 'ഗർഭധാരണം' },
    { id: 'other',       icon: '🩺', en: 'Other',                ml: 'മറ്റുള്ളവ' }
];

const TEXT = {
    English: {
        pageTitle: 'Neutrix | My Medical Issues',
        title: '🗂 My Medical Issues',
        welcome: 'Welcome back, <span class="welcome-name">{name}</span>! 👋 Pick an issue to continue, or add a new one.',
        hint: 'Each issue keeps its own reports, summary, medicine schedule and chat.',
        addBtn: '＋ Add Medical Issue',
        addCard: 'Add a medical issue',
        signOut: '🚪 Sign Out',
        open: 'Open →',
        edit: '✏️ Edit',
        del: '🗑',
        delConfirm: 'Delete?',
        delTitle: 'Delete this issue and all its data',
        since: 'Since {date}',
        tagSummary: '📋 Summary ready',
        tagNoSummary: '📄 No reports yet',
        tagDoses: '💊 {done}/{total} doses today',
        tagMeds: '🧪 {n} manual medicines',
        tagLast: '⭐ Last opened',
        emptyTitle: 'No medical issues yet',
        emptyText: 'Add your first issue, for example "Heart surgery – Oct 2026", to start uploading reports.',
        howTitle: 'HOW IT WORKS',
        step1: 'Press ＋ to add a medical issue, like a surgery or an illness.',
        step2: 'Open the issue to reach its dashboard.',
        step3: 'Upload reports, get the AI summary, and track medicines for that issue.',
        step4: 'Add more issues anytime. Each one keeps its own data.',
        modalAdd: 'Add Medical Issue',
        modalEdit: 'Edit Medical Issue',
        modalSub: 'Give it a name you will recognise later.',
        fTitle: 'Issue name',
        fTitlePh: 'e.g. Heart surgery – Oct 2026',
        fTitleError: 'Please enter a name for this issue.',
        fCategory: 'Type',
        fDate: 'Start / admission date',
        fHospital: 'Hospital or doctor (optional)',
        fHospitalPh: 'e.g. Green Valley Hospital, Dr. Kumar',
        fNotes: 'Notes (optional)',
        fNotesPh: 'Anything you want to remember about this issue',
        cancel: 'Cancel',
        save: 'Add Issue',
        saveEdit: 'Save Changes',
        countOne: '1 issue',
        countMany: '{n} issues'
    },
    Malayalam: {
        pageTitle: 'ന്യൂട്രിക്സ് | എന്റെ ആരോഗ്യ പ്രശ്നങ്ങൾ',
        title: '🗂 എന്റെ ആരോഗ്യ പ്രശ്നങ്ങൾ',
        welcome: 'വീണ്ടും സ്വാഗതം, <span class="welcome-name">{name}</span>! 👋 തുടരാൻ ഒരു പ്രശ്നം തിരഞ്ഞെടുക്കുക, അല്ലെങ്കിൽ പുതിയത് ചേർക്കുക.',
        hint: 'ഓരോ പ്രശ്നത്തിനും അതിന്റേതായ റിപ്പോർട്ടുകൾ, സംഗ്രഹം, മരുന്ന് ഷെഡ്യൂൾ, ചാറ്റ് എന്നിവ ഉണ്ടാകും.',
        addBtn: '＋ ആരോഗ്യ പ്രശ്നം ചേർക്കുക',
        addCard: 'ഒരു ആരോഗ്യ പ്രശ്നം ചേർക്കുക',
        signOut: '🚪 സൈൻ ഔട്ട്',
        open: 'തുറക്കുക →',
        edit: '✏️ തിരുത്തുക',
        del: '🗑',
        delConfirm: 'ഇല്ലാതാക്കണോ?',
        delTitle: 'ഈ പ്രശ്നവും അതിലെ എല്ലാ വിവരങ്ങളും ഇല്ലാതാക്കുക',
        since: '{date} മുതൽ',
        tagSummary: '📋 സംഗ്രഹം തയ്യാർ',
        tagNoSummary: '📄 റിപ്പോർട്ടുകൾ ഇല്ല',
        tagDoses: '💊 ഇന്ന് {done}/{total} ഡോസുകൾ',
        tagMeds: '🧪 {n} മരുന്നുകൾ',
        tagLast: '⭐ അവസാനം തുറന്നത്',
        emptyTitle: 'ഇതുവരെ ആരോഗ്യ പ്രശ്നങ്ങൾ ഇല്ല',
        emptyText: 'റിപ്പോർട്ടുകൾ അപ്‌ലോഡ് ചെയ്യാൻ തുടങ്ങാൻ നിങ്ങളുടെ ആദ്യ പ്രശ്നം ചേർക്കുക, ഉദാ: "ഹൃദയ ശസ്ത്രക്രിയ – ഒക്ടോ 2026".',
        howTitle: 'ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു',
        step1: 'ശസ്ത്രക്രിയ അല്ലെങ്കിൽ രോഗം പോലുള്ള ഒരു ആരോഗ്യ പ്രശ്നം ചേർക്കാൻ ＋ അമർത്തുക.',
        step2: 'അതിന്റെ ഡാഷ്ബോർഡിലേക്ക് പോകാൻ പ്രശ്നം തുറക്കുക.',
        step3: 'ആ പ്രശ്നത്തിനായി റിപ്പോർട്ടുകൾ അപ്‌ലോഡ് ചെയ്യുക, AI സംഗ്രഹം നേടുക, മരുന്നുകൾ ട്രാക്ക് ചെയ്യുക.',
        step4: 'എപ്പോൾ വേണമെങ്കിലും കൂടുതൽ പ്രശ്നങ്ങൾ ചേർക്കാം. ഓരോന്നിനും അതിന്റേതായ വിവരങ്ങൾ ഉണ്ടാകും.',
        modalAdd: 'ആരോഗ്യ പ്രശ്നം ചേർക്കുക',
        modalEdit: 'ആരോഗ്യ പ്രശ്നം തിരുത്തുക',
        modalSub: 'പിന്നീട് തിരിച്ചറിയാൻ കഴിയുന്ന ഒരു പേര് നൽകുക.',
        fTitle: 'പ്രശ്നത്തിന്റെ പേര്',
        fTitlePh: 'ഉദാ: ഹൃദയ ശസ്ത്രക്രിയ – ഒക്ടോ 2026',
        fTitleError: 'ഈ പ്രശ്നത്തിന് ഒരു പേര് നൽകുക.',
        fCategory: 'തരം',
        fDate: 'ആരംഭ / അഡ്മിഷൻ തീയതി',
        fHospital: 'ആശുപത്രി അല്ലെങ്കിൽ ഡോക്ടർ (ഓപ്ഷണൽ)',
        fHospitalPh: 'ഉദാ: ഗ്രീൻ വാലി ആശുപത്രി, ഡോ. കുമാർ',
        fNotes: 'കുറിപ്പുകൾ (ഓപ്ഷണൽ)',
        fNotesPh: 'ഈ പ്രശ്നത്തെക്കുറിച്ച് ഓർക്കേണ്ട എന്തും',
        cancel: 'റദ്ദാക്കുക',
        save: 'പ്രശ്നം ചേർക്കുക',
        saveEdit: 'മാറ്റങ്ങൾ സേവ് ചെയ്യുക',
        countOne: '1 പ്രശ്നം',
        countMany: '{n} പ്രശ്നങ്ങൾ'
    }
};

function tt(key, vars = {}) {
    let text = (TEXT[neutrixLang] || TEXT.English)[key] ?? TEXT.English[key] ?? key;
    for (const name in vars) text = text.replaceAll(`{${name}}`, vars[name]);
    return text;
}
function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function catById(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
function catName(c) {
    return neutrixLang === 'Malayalam' ? c.ml : c.en;
}
function loadIssues() {
    return storeGet(ISSUES_KEY) || [];
}
function saveIssues(list) {
    storeSet(ISSUES_KEY, list);
}
function newId() {
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function issueData(key, id) {
    return storeGet(`${key}::${id}`);
}

// ---------- Rendering ----------
function applyPageTexts() {
    document.querySelectorAll('[data-it]').forEach(el => { el.textContent = tt(el.dataset.it); });
    document.querySelectorAll('[data-itp]').forEach(el => { el.placeholder = tt(el.dataset.itp); });
    document.title = tt('pageTitle');

    const name = localStorage.getItem('neutrix_patient_name') || 'User';
    document.getElementById('welcomeLine').innerHTML = tt('welcome', { name: esc(name) });

    // Category options
    const select = document.getElementById('fCategory');
    const current = select.value;
    select.innerHTML = '';
    CATEGORIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.icon} ${catName(c)}`;
        select.appendChild(opt);
    });
    if (current) select.value = current;
}

function renderIssues() {
    const grid = document.getElementById('issueGrid');
    const issues = loadIssues().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const activeId = localStorage.getItem(ACTIVE_KEY);
    const today = dayKey(new Date());

    document.getElementById('issueCountBadge').textContent =
        issues.length === 1 ? tt('countOne') : tt('countMany', { n: issues.length });

    grid.innerHTML = '';

    if (issues.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.gridColumn = '1 / -1';
        empty.innerHTML = `
            <div class="empty-icon">🗂</div>
            <h2>${esc(tt('emptyTitle'))}</h2>
            <p>${esc(tt('emptyText'))}</p>`;
        const btn = document.createElement('button');
        btn.className = 'btn-success';
        btn.type = 'button';
        btn.textContent = tt('addBtn');
        btn.addEventListener('click', () => openModal());
        empty.appendChild(btn);
        grid.appendChild(empty);
        return;
    }

    issues.forEach(issue => {
        const cat = catById(issue.category);
        const report = issueData('neutrixReport', issue.id);
        const schedule = issueData('neutrixSchedule', issue.id);
        const meds = issueData('neutrix_meds', issue.id);

        const tags = [];
        if (issue.id === activeId) tags.push(`<span class="issue-tag last">${esc(tt('tagLast'))}</span>`);
        tags.push(report
            ? `<span class="issue-tag good">${esc(tt('tagSummary'))}</span>`
            : `<span class="issue-tag">${esc(tt('tagNoSummary'))}</span>`);
        const todayDoses = schedule ? dosesForDay(schedule, today) : [];
        if (todayDoses.length) {
            const ticks = (schedule.ticks && schedule.ticks[today]) || {};
            const done = todayDoses.filter(d => ticks[d.id]).length;
            tags.push(`<span class="issue-tag good">${esc(tt('tagDoses', { done, total: todayDoses.length }))}</span>`);
        }
        if (Array.isArray(meds) && meds.length) {
            tags.push(`<span class="issue-tag">${esc(tt('tagMeds', { n: meds.length }))}</span>`);
        }

        const metaParts = [catName(cat)];
        if (issue.startDate) {
            const [y, m, d] = issue.startDate.split('-').map(Number);
            const dateText = new Date(y, m - 1, d).toLocaleDateString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric' });
            metaParts.push(tt('since', { date: dateText }));
        }
        if (issue.hospital) metaParts.push(issue.hospital);

        const card = document.createElement('div');
        card.className = 'issue-card' + (issue.id === activeId ? ' active' : '');
        card.innerHTML = `
            <div class="issue-top">
                <div class="issue-icon">${cat.icon}</div>
                <div style="min-width: 0;">
                    <div class="issue-title">${esc(issue.title)}</div>
                    <div class="issue-meta">${esc(metaParts.join(' · '))}</div>
                </div>
            </div>
            ${issue.notes ? `<div class="issue-notes">${esc(issue.notes)}</div>` : ''}
            <div class="issue-tags">${tags.join('')}</div>
            <div class="issue-actions">
                <button class="btn-primary open-btn" type="button">${esc(tt('open'))}</button>
                <button class="btn-secondary edit-btn" type="button">${esc(tt('edit'))}</button>
                <button class="btn-remove del-btn" type="button" title="${esc(tt('delTitle'))}">${esc(tt('del'))}</button>
            </div>`;

        card.querySelector('.open-btn').addEventListener('click', () => openIssue(issue.id));
        card.querySelector('.edit-btn').addEventListener('click', () => openModal(issue));

        // Two-step delete: first click asks, second click deletes
        const delBtn = card.querySelector('.del-btn');
        let armed = false;
        let timer = null;
        delBtn.addEventListener('click', () => {
            if (!armed) {
                armed = true;
                delBtn.textContent = tt('delConfirm');
                timer = setTimeout(() => {
                    armed = false;
                    delBtn.textContent = tt('del');
                }, 4000);
                return;
            }
            clearTimeout(timer);
            deleteIssue(issue.id);
        });

        grid.appendChild(card);
    });

    // "Add" card at the end of the grid
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'add-card';
    add.innerHTML = `<span class="plus">+</span><span>${esc(tt('addCard'))}</span>`;
    add.addEventListener('click', () => openModal());
    grid.appendChild(add);
}

// ---------- Actions ----------
function openIssue(id) {
    localStorage.setItem(ACTIVE_KEY, id);
    window.location.href = `index.html?issue=${encodeURIComponent(id)}`;
}

function deleteIssue(id) {
    saveIssues(loadIssues().filter(i => i.id !== id));

    // Remove every saved item that belongs to this issue
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.endsWith(`::${id}`)) toRemove.push(key);
    }
    toRemove.forEach(key => localStorage.removeItem(key));

    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
    renderIssues();
}

// ---------- Add / edit modal ----------
const modal = document.getElementById('issueModal');
const form = document.getElementById('issueForm');
let editingId = null;

function openModal(issue = null) {
    editingId = issue ? issue.id : null;
    document.getElementById('modalTitle').textContent = tt(issue ? 'modalEdit' : 'modalAdd');
    document.getElementById('saveBtn').textContent = tt(issue ? 'saveEdit' : 'save');

    document.getElementById('fTitle').value = issue ? issue.title : '';
    document.getElementById('fCategory').value = issue ? issue.category : 'surgery';
    document.getElementById('fDate').value = issue ? (issue.startDate || '') : dayKey(new Date());
    document.getElementById('fHospital').value = issue ? (issue.hospital || '') : '';
    document.getElementById('fNotes').value = issue ? (issue.notes || '') : '';
    document.getElementById('fTitleError').classList.add('hidden');

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('fTitle').focus(), 50);
}

function closeModal() {
    modal.classList.add('hidden');
    editingId = null;
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('fTitle').value.trim();
    if (!title) {
        document.getElementById('fTitleError').classList.remove('hidden');
        document.getElementById('fTitle').focus();
        return;
    }

    const category = document.getElementById('fCategory').value;
    const fields = {
        title,
        category,
        icon: catById(category).icon,
        startDate: document.getElementById('fDate').value,
        hospital: document.getElementById('fHospital').value.trim(),
        notes: document.getElementById('fNotes').value.trim()
    };

    const issues = loadIssues();
    if (editingId) {
        const issue = issues.find(i => i.id === editingId);
        if (issue) Object.assign(issue, fields);
        saveIssues(issues);
        closeModal();
        renderIssues();
    } else {
        const issue = { id: newId(), createdAt: new Date().toISOString(), ...fields };
        issues.push(issue);
        saveIssues(issues);
        closeModal();
        openIssue(issue.id);   // go straight into the new issue's dashboard
    }
});

document.getElementById('cancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});
document.getElementById('addIssueBtn').addEventListener('click', () => openModal());

document.getElementById('signOutBtn').addEventListener('click', () => {
    localStorage.removeItem('neutrix_authenticated');
    localStorage.removeItem(ACTIVE_KEY);
    window.location.href = 'signin.html';
});

// ---------- Language ----------
document.addEventListener('neutrix:langchange', () => {
    applyPageTexts();
    renderIssues();
    if (!modal.classList.contains('hidden')) {
        document.getElementById('modalTitle').textContent = tt(editingId ? 'modalEdit' : 'modalAdd');
        document.getElementById('saveBtn').textContent = tt(editingId ? 'saveEdit' : 'save');
    }
});

applyPageTexts();
renderIssues();
