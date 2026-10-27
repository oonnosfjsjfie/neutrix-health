// =====================================================
// Upcoming Check-ups: turns the AI text into date cards.
// Each "### 📅 date — title" heading becomes one card,
// and its bullet points are shown when "Know more" is clicked.
// =====================================================

function renderCheckups(el, markdown) {
    const lines = (markdown || '').split('\n');
    const intro = [];
    const items = [];
    const after = [];
    let current = null;
    let inAfter = false;

    lines.forEach(line => {
        if (/^###\s/.test(line)) {
            inAfter = false;
            current = { heading: line.replace(/^###\s*/, ''), body: [] };
            items.push(current);
        } else if (/^##\s/.test(line)) {
            current = null;
            if (items.length) inAfter = true;   // a section that comes after the dates
            if (inAfter) after.push(line);       // the timeline heading itself is dropped
        } else if (current) {
            current.body.push(line);
        } else if (inAfter) {
            after.push(line);
        } else {
            intro.push(line);
        }
    });

    // Nothing to turn into cards: show the text as it is
    if (items.length === 0) {
        el.innerHTML = renderMarkdown(markdown);
        return;
    }

    el.innerHTML = '';

    const introText = intro.join('\n').trim();
    if (introText) {
        const box = document.createElement('div');
        box.className = 'ck-intro md-content';
        box.innerHTML = renderMarkdown(introText);
        el.appendChild(box);
    }

    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = t('checkupDates');
    el.appendChild(title);

    const list = document.createElement('div');
    list.className = 'ck-list';

    items.forEach(item => {
        // e.g. "📅 Approx. 26-11-2026 (6 weeks after discharge on 15-10-2026) — Repeat Lipid Profile"
        const heading = item.heading.replace(/^📅\s*/, '').replace(/\*\*/g, '').trim();
        const parts = heading.split(/\s+[—–]\s+/);
        const datePart = parts.length > 1 ? parts.slice(0, -1).join(' — ') : heading;
        const titlePart = parts.length > 1 ? parts[parts.length - 1] : '';

        // Pull a DD-MM-YYYY date out for the calendar box
        const m = datePart.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
        let dayText = '📅';
        let monthText = '';
        if (m) {
            const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
            dayText = String(d.getDate());
            monthText = d.toLocaleDateString(localeFor(), { month: 'short', year: 'numeric' });
        }

        // The "Status" bullet (Upcoming / Date has passed) becomes a small tag
        const statusLine = item.body.find(l => /status|നില/i.test(l));
        const status = statusLine
            ? statusLine.replace(/^\s*[-*]\s*/, '').replace(/\*\*[^*]*\*\*\s*:?\s*/, '').replace(/\*\*/g, '').trim()
            : '';
        const passed = /pass|കഴിഞ്ഞ/i.test(status);

        const card = document.createElement('div');
        card.className = 'ck-item' + (passed ? ' passed' : '');

        const row = document.createElement('div');
        row.className = 'ck-row';

        const dateBox = document.createElement('div');
        dateBox.className = 'ck-date-box';
        const day = document.createElement('div');
        day.className = 'ck-day';
        day.textContent = dayText;
        const month = document.createElement('div');
        month.className = 'ck-month';
        month.textContent = monthText;
        dateBox.append(day, month);

        const main = document.createElement('div');
        main.className = 'ck-main';
        const titleEl = document.createElement('div');
        titleEl.className = 'ck-title';
        titleEl.textContent = titlePart || datePart;
        main.appendChild(titleEl);
        // Show the date line only if it adds something (like "Approx. ... after discharge")
        if (titlePart && !(m && datePart === m[0])) {
            const sub = document.createElement('div');
            sub.className = 'ck-sub';
            sub.textContent = datePart;
            main.appendChild(sub);
        }
        if (status) {
            const tag = document.createElement('span');
            tag.className = 'ck-status';
            tag.textContent = status;
            main.appendChild(tag);
        }

        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'btn-secondary ck-more';
        more.textContent = t('knowMore');

        const details = document.createElement('div');
        details.className = 'ck-details md-content hidden';
        details.innerHTML = renderMarkdown(item.body.join('\n').trim());

        more.addEventListener('click', () => {
            const isOpen = !details.classList.toggle('hidden');
            more.textContent = isOpen ? t('showLess') : t('knowMore');
        });

        row.append(dateBox, main, more);
        card.append(row, details);
        list.appendChild(card);
    });
    el.appendChild(list);

    // "Go to the hospital sooner if..." goes in the right-hand column when there is room for it
    const afterText = after.join('\n').trim();
    const side = document.getElementById('ckSideWarnings');
    if (side) {
        side.innerHTML = afterText ? renderMarkdown(afterText) : '';
        side.classList.toggle('hidden', !afterText);
    } else if (afterText) {
        const box = document.createElement('div');
        box.className = 'ck-after md-content';
        box.innerHTML = renderMarkdown(afterText);
        el.appendChild(box);
    }
}
