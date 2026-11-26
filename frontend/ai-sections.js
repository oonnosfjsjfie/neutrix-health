// =====================================================
// Shows an AI-made section (medicine plan, check-ups).
// - Uses the saved copy if it was made from the current reports
// - Otherwise asks the backend to make it automatically
// - Translates it when the language changes, and saves that too
// - Shows a "Try again" button if the AI fails
// =====================================================

window.loadAiSection = function ({ storeKey, url, field, el, loadingKey, record, refreshBtn, render, historyHost, historyTitle, onChange }) {
    // Older versions are never thrown away: they are kept in NxHist (history.js) and listed in historyHost
    let viewing = null;     // id of an older version being looked at (null = current)
    const H = window.NxHist;
    function keepOld(item) {
        if (H && item && item.content) H.archive(storeKey, item, { madeAt: item.madeAt || '', version: item.version || '' });
    }
    function renderHistory() {
        if (!H || !historyHost) return;
        const old = H.list(storeKey).reverse();
        const items = [];
        if (current) items.push({ id: 'current', current: true, title: H.tx('current'), date: current.madeAt ? H.tx('made', { when: H.when(current.madeAt) }) : '' });
        old.forEach(e => items.push({ id: e.id, title: H.tx('older'), date: H.tx('replaced', { when: H.when(e.replacedAt) }), sub: e.madeAt ? H.tx('made', { when: H.when(e.madeAt) }) : '' }));
        H.bar(historyHost, { title: historyTitle || '', items, selected: viewing || 'current', onPick: id => {
            viewing = id === 'current' ? null : id;
            show(); renderHistory();
            if (window.innerWidth <= 1024) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } });
    }
    // render(el, markdown) lets a page draw the text its own way
    function paint(markdown) {
        if (render) render(el, markdown);
        else el.innerHTML = renderMarkdown(markdown);
    }

    let current = null;     // { createdAt, content: { English: '...', Malayalam: '...' } }
    let busy = false;

    function loadingLine(text) {
        const p = document.createElement('p');
        p.className = 'loading-line';
        p.textContent = text;
        return p;
    }

    function showError(message) {
        el.innerHTML = '';
        el.appendChild(loadingLine(message));
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn-primary';
        retry.textContent = t('retryBtn');
        retry.addEventListener('click', generate);
        el.appendChild(retry);
    }

    async function show() {
        if (viewing && H) {
            const e = H.list(storeKey).find(x => x.id === viewing);
            if (e) {
                const map = (e.data && e.data.content) || {};
                el.innerHTML = renderMarkdown(map[neutrixLang] || map.English || map.Malayalam || '');
                el.prepend(H.oldBanner(e.replacedAt, () => { viewing = null; show(); renderHistory(); }));
                return;
            }
            viewing = null;
        }
        if (!current) return;
        const lang = neutrixLang;
        const map = current.content;
        if (map[lang]) {
            paint(map[lang]);
            return;
        }
        el.innerHTML = '';
        el.appendChild(loadingLine(t('translating')));
        try {
            await getLocalized(map, lang);
            storeSet(storeKey, current);
        } catch (e) {
            if (neutrixLang !== lang) return;
            el.innerHTML = '';
            el.appendChild(loadingLine(t('translateFail')));
            const original = document.createElement('div');
            original.innerHTML = renderMarkdown(map.English || map.Malayalam || '');
            el.appendChild(original);
            return;
        }
        if (neutrixLang === lang) paint(map[lang]);
    }

    async function generate() {
        if (busy) return;
        busy = true;
        if (refreshBtn) refreshBtn.disabled = true;
        const lang = neutrixLang;
        el.innerHTML = '';
        el.appendChild(loadingLine(t(loadingKey)));

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120000);

        try {
            const res = await fetch(`${API_BASE}${url}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_text: fullReportText(record),
                    bill_text: record.billText || '',
                    language: lang
                }),
                signal: controller.signal
            });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();

            if (data.ok === false) {
                showError(data[field]);
                return;
            }

            current = { createdAt: record.createdAt, version: reportVersion(record), madeAt: new Date().toISOString(), content: { [lang]: data[field] } };
            storeSet(storeKey, current);
            viewing = null;
            show(); renderHistory();
            if (onChange) onChange(current);
        } catch (err) {
            showError(err.name === 'AbortError' ? t('askTimeout') : t('actionError', { msg: err.message }));
        } finally {
            clearTimeout(timer);
            busy = false;
            if (refreshBtn) refreshBtn.disabled = false;
        }
    }

    // Saved copy made from these reports?
    const saved = storeGet(storeKey);
    // Made from the same reports? (adding files or new reports changes the version)
    if (saved && saved.createdAt === record.createdAt && (saved.version || reportVersion(record, true)) === reportVersion(record)) {
        if (typeof saved.content === 'string') {
            saved.content = { [record.language || 'English']: saved.content };
        }
        current = saved;
        show();
        renderHistory();
    } else {
        // Made from older reports: keep it in the history, then make the new one
        if (saved && saved.createdAt === record.createdAt) keepOld(saved);
        renderHistory();
        generate();
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            keepOld(current);
            try { localStorage.removeItem(storeKey); } catch (e) {}
            current = null; viewing = null;
            generate();
        });
    }

    document.addEventListener('neutrix:langchange', () => { if (!busy) show(); renderHistory(); });
};
