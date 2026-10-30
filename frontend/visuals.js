// =====================================================
// visuals.js — "🖼 Show visual representation"
// Pictures found inside the reports (X-ray, scans, ECG strips, charts), with the AI's explanation and labels.
// - PDFs: the server cuts the pictures out (/api/visuals)
// - Photos: the photo check already found them (boxes) -> cut out here with a canvas
// Saved per issue as neutrixVisuals = { items: [{ id, group, file, page, image, kind, title_en, title_ml,
//   explanation_en, explanation_ml, labels: [{ text_en, text_ml, box }] }] }
// group: 'first' / 'u0', 'u1'... (files added to the summary) / followup id (reports compared on My Improvements)
// =====================================================
(function () {
    const KEY = 'neutrixVisuals';
    const MAX_ITEMS = 10;

    const T = {
        English: { button: '🖼 Show visual representation', title: 'Pictures from your report', of: '{n} of {total}',
                   from: 'From {file}{page}', page: ', page {p}', labels: 'Labels', prev: '← Previous', next: 'Next →', close: 'Close',
                   note: 'Explained by AI from your report. Ask your doctor what these pictures mean for you.',
                   saving: 'Saving pictures from your report…' },
        Malayalam: { button: '🖼 ദൃശ്യങ്ങൾ കാണിക്കുക', title: 'നിങ്ങളുടെ റിപ്പോർട്ടിലെ ചിത്രങ്ങൾ', of: '{total}-ൽ {n}',
                     from: '{file}{page} നിന്ന്', page: ', പേജ് {p}', labels: 'ലേബലുകൾ', prev: '← മുമ്പത്തേത്', next: 'അടുത്തത് →', close: 'അടയ്ക്കുക',
                     note: 'നിങ്ങളുടെ റിപ്പോർട്ടിൽ നിന്ന് AI വിശദീകരിച്ചത്. ഈ ചിത്രങ്ങൾ നിങ്ങൾക്ക് എന്താണ് അർത്ഥമാക്കുന്നതെന്ന് ഡോക്ടറോട് ചോദിക്കുക.',
                     saving: 'റിപ്പോർട്ടിലെ ചിത്രങ്ങൾ സേവ് ചെയ്യുന്നു…' }
    };
    const L = () => T[window.neutrixLang] || T.English;
    const fill = (s, v) => Object.keys(v || {}).reduce((a, k) => a.replaceAll(`{${k}}`, v[k]), s);
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const pick = (o, f) => (window.neutrixLang === 'Malayalam' ? (o[f + '_ml'] || o[f + '_en']) : (o[f + '_en'] || o[f + '_ml'])) || '';
    const isImage = f => /^image\//i.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

    // ---------- Storage ----------
    function all() { return ((storeGet(KEY) || {}).items) || []; }
    function save(items) {
        let list = items.slice(-MAX_ITEMS);
        while (list.length && !storeSet(KEY, { items: list })) list = list.slice(1);   // too big: drop the oldest
    }
    function add(group, newItems) {
        if (!newItems || !newItems.length) return;
        const items = all().filter(v => v.group !== group);
        newItems.forEach((v, i) => items.push({ ...v, group, id: `${group}-${Date.now().toString(36)}-${i}` }));
        save(items);
    }
    function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
    function forGroups(groups) { return all().filter(v => groups.includes(v.group)); }

    // ---------- Collecting ----------
    // A photo: cut the picture areas the photo check found
    function cropPhoto(file, visuals) {
        return new Promise(resolve => {
            if (!visuals || !visuals.length) return resolve([]);
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const out = [];
                visuals.forEach(v => {
                    const [y0, x0, y1, x1] = v.box || [0, 0, 1000, 1000];
                    const sx = img.width * x0 / 1000, sy = img.height * y0 / 1000;
                    const sw = img.width * (x1 - x0) / 1000, sh = img.height * (y1 - y0) / 1000;
                    if (sw < 30 || sh < 30) return;
                    const scale = Math.min(1, 900 / Math.max(sw, sh));
                    const c = document.createElement('canvas');
                    c.width = Math.round(sw * scale);
                    c.height = Math.round(sh * scale);
                    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
                    // label boxes: whole photo -> this cut-out
                    const labels = (v.labels || []).map(l => {
                        if (!l.box) return { ...l, box: null };
                        const h = (y1 - y0) || 1, w = (x1 - x0) || 1;
                        const b = [(l.box[0] - y0) * 1000 / h, (l.box[1] - x0) * 1000 / w, (l.box[2] - y0) * 1000 / h, (l.box[3] - x0) * 1000 / w]
                            .map(n => Math.max(0, Math.min(1000, Math.round(n))));
                        return { ...l, box: (b[2] - b[0] > 4 && b[3] - b[1] > 4) ? b : null };
                    });
                    out.push({ ...v, labels, box: undefined, file: file.name, page: 0, image: c.toDataURL('image/jpeg', 0.8) });
                });
                URL.revokeObjectURL(url);
                resolve(out);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
            img.src = url;
        });
    }

    // Everything for one upload: PDFs via the server, photos from their photo check. Never throws.
    async function collect(files, reportHint) {
        const results = [];
        const pdfs = files.filter(f => !isImage(f));
        const photos = files.filter(isImage);
        const jobs = [];
        if (pdfs.length) {
            const fd = new FormData();
            pdfs.forEach(f => fd.append('files', f));
            fd.append('report_text', (reportHint || '').slice(0, 6000));
            jobs.push(fetch(`${API_BASE}/api/visuals`, { method: 'POST', body: fd })
                .then(r => r.json()).then(d => { if (d && d.visuals) results.push(...d.visuals); })
                .catch(e => console.warn('[visuals]', e)));
        }
        photos.forEach(f => {
            const check = window.neutrixPhotoInfo ? neutrixPhotoInfo(f) : null;
            if (check && check.visuals && check.visuals.length) jobs.push(cropPhoto(f, check.visuals).then(v => results.push(...v)));
        });
        await Promise.all(jobs);
        return results.slice(0, MAX_ITEMS);
    }

    // ---------- Viewer ----------
    function open(items, startAt) {
        if (!items || !items.length) return;
        let i = Math.max(0, Math.min(items.length - 1, startAt || 0));
        const wrap = document.createElement('div');
        wrap.className = 'vis-modal';
        document.body.appendChild(wrap);
        const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = e => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight' && i < items.length - 1) { i++; paint(); }
            if (e.key === 'ArrowLeft' && i > 0) { i--; paint(); }
        };
        document.addEventListener('keydown', onKey);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });

        function paint() {
            const l = L();
            const v = items[i];
            const labels = (v.labels || []).filter(x => x.text_en || x.text_ml);
            const where = fill(l.from, { file: v.file || '', page: v.page ? fill(l.page, { p: v.page }) : '' });
            wrap.innerHTML = `
                <div class="vis-box" role="dialog" aria-modal="true">
                    <button class="vis-x" type="button" aria-label="${esc(l.close)}">×</button>
                    <div class="vis-head">
                        <span class="vis-eyebrow">${esc(l.title)} · ${esc(fill(l.of, { n: i + 1, total: items.length }))}</span>
                        <h3>${esc(pick(v, 'title') || v.kind)}</h3>
                        <div class="vis-from">${esc(where)}${v.kind ? ' · ' + esc(v.kind) : ''}</div>
                    </div>
                    <div class="vis-body">
                        <div class="vis-stage">
                            <img src="${esc(v.image)}" alt="${esc(pick(v, 'title'))}">
                            ${labels.map((lab, n) => lab.box ? `<div class="vis-mark" style="top:${lab.box[0] / 10}%;left:${lab.box[1] / 10}%;height:${(lab.box[2] - lab.box[0]) / 10}%;width:${(lab.box[3] - lab.box[1]) / 10}%"><span>${n + 1}</span></div>` : '').join('')}
                        </div>
                        <div class="vis-side">
                            <p class="vis-explain">${esc(pick(v, 'explanation'))}</p>
                            ${labels.length ? `<div class="vis-labels-title">${esc(l.labels)}</div><ol class="vis-labels">${labels.map(lab => `<li>${esc(pick(lab, 'text'))}</li>`).join('')}</ol>` : ''}
                            <p class="vis-note">${esc(l.note)}</p>
                        </div>
                    </div>
                    <div class="vis-foot">
                        <button type="button" class="vis-btn" data-a="prev" ${i === 0 ? 'disabled' : ''}>${esc(l.prev)}</button>
                        <button type="button" class="vis-btn" data-a="close">${esc(l.close)}</button>
                        <button type="button" class="vis-btn main" data-a="next" ${i === items.length - 1 ? 'disabled' : ''}>${esc(l.next)}</button>
                    </div>
                </div>`;
            wrap.querySelector('.vis-x').addEventListener('click', close);
            wrap.querySelector('[data-a="close"]').addEventListener('click', close);
            wrap.querySelector('[data-a="prev"]').addEventListener('click', () => { if (i > 0) { i--; paint(); } });
            wrap.querySelector('[data-a="next"]').addEventListener('click', () => { if (i < items.length - 1) { i++; paint(); } });
        }
        paint();
    }

    // A button that only shows when there are pictures. getItems() is called each time.
    function attachButton(container, getItems, position) {
        if (!container) return null;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vis-open-btn';
        const refresh = () => {
            const items = getItems() || [];
            btn.hidden = !items.length;
            btn.textContent = L().button + (items.length > 1 ? ` (${items.length})` : '');
        };
        btn.addEventListener('click', () => open(getItems() || []));
        if (position === 'start') container.prepend(btn); else container.appendChild(btn);
        refresh();
        document.addEventListener('neutrix:langchange', refresh);
        return { button: btn, refresh };
    }

    const style = document.createElement('style');
    style.textContent = `
        .vis-open-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 30px; cursor: pointer;
            border: 2px solid transparent; font: inherit; font-size: 14px; font-weight: 700; color: var(--text-primary);
            background: linear-gradient(var(--card-bg), var(--card-bg)) padding-box, linear-gradient(135deg, #ff007a, #a855f7, #3b82f6, #00f2fe) border-box;
            transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .vis-open-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(168, 85, 247, 0.2); }
        .vis-open-btn[hidden] { display: none; }
        .vis-modal { position: fixed; inset: 0; z-index: 5500; display: flex; align-items: center; justify-content: center; padding: 14px; background: rgba(0,0,0,0.7); }
        .vis-box { position: relative; width: min(1000px, 100%); max-height: calc(100vh - 28px); overflow: auto; border-radius: 20px; padding: 20px;
            background: var(--card-bg); color: var(--text-primary); box-shadow: 0 30px 80px rgba(0,0,0,0.4); }
        .vis-x { position: absolute; top: 10px; right: 14px; border: none; background: none; font-size: 24px; cursor: pointer; color: var(--text-muted); }
        .vis-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 1.3px; text-transform: uppercase; color: var(--text-muted); }
        .vis-head h3 { margin: 4px 0 2px; font-size: 21px; }
        .vis-from { font-size: 12.5px; color: var(--text-muted); margin-bottom: 12px; }
        .vis-body { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(240px, 1fr); gap: 18px; align-items: start; }
        @media (max-width: 760px) { .vis-body { grid-template-columns: 1fr; } }
        .vis-stage { position: relative; border-radius: 14px; overflow: hidden; background: #0b0f17; line-height: 0; user-select: none; -webkit-user-select: none; }
        .vis-stage img { width: 100%; height: auto; display: block; }
        .vis-mark { position: absolute; border: 2px solid #f59e0b; border-radius: 6px; box-shadow: 0 0 0 1px rgba(0,0,0,0.5); }
        .vis-mark span { position: absolute; top: -12px; left: -12px; width: 22px; height: 22px; border-radius: 50%; background: #f59e0b; color: #111;
            font: 800 12px/22px system-ui, sans-serif; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
        .vis-explain { margin: 0 0 12px; font-size: 14.5px; line-height: 1.6; }
        .vis-labels-title { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
        .vis-labels { margin: 0 0 12px; padding-left: 22px; font-size: 14px; }
        .vis-labels li::marker { font-weight: 800; color: #d97706; }
        .vis-note { font-size: 12px; color: var(--text-muted); margin: 0; }
        .vis-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 16px; }
        .vis-btn { padding: 10px 18px; border-radius: 30px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary);
            font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; }
        .vis-btn.main { background: var(--text-primary); color: var(--card-bg); border-color: var(--text-primary); }
        .vis-btn:disabled { opacity: 0.4; cursor: default; }
        .chat-pic { display: block; width: 100%; max-width: 260px; margin: 8px 0; padding: 0; border: 1px solid var(--border-color); border-radius: 12px;
            overflow: hidden; background: var(--card-bg); cursor: zoom-in; text-align: left; font: inherit; color: var(--text-primary); }
        .chat-pic img { display: block; width: 100%; max-height: 180px; object-fit: contain; background: #0b0f17; }
        .chat-pic span { display: block; padding: 7px 10px; font-size: 12.5px; font-weight: 700; }
    `;
    document.head.appendChild(style);

    window.NxVisuals = { collect, add, clear, all, forGroups, open, attachButton, savingText: () => L().saving };
})();
