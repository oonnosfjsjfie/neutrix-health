// =====================================================
// calendar-reminders.js — "📅 Add to my calendar" on the medicine schedule page
//
// One daily, repeating reminder per time of day (morning / afternoon / evening / night),
// listing the medicines for that time. Every reminder has a link back to this issue's
// tick-off page (schedule.html?issue=...).
// - Google Calendar: one prefilled event per time of day (Google can only add one at a time).
// - iPhone / other calendars: one .ics file with all of them ("Add All").
// The phone's own calendar app shows the alerts, even when Neutrix is closed.
// =====================================================
(function () {
    const SLOTS = ['morning', 'afternoon', 'evening', 'night'];
    const DEFAULT_TIMES = { morning: '08:00', afternoon: '13:30', evening: '18:00', night: '21:30' };
    const TIMES_KEY = 'neutrixReminderTimes';

    const T = {
        English: {
            btn: '📅 Add to my calendar', hint: 'Get a reminder at each medicine time in Google Calendar or your iPhone calendar, with a link back to this page to tick the dose.',
            title: 'Medicine reminders in your calendar', sub: 'Set the time for each part of the day, then add the reminders. They repeat every day and include a link to tick your doses here.',
            slot: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' },
            noMeds: 'No medicines at this time', until: 'until {d}', daily: 'every day',
            google: 'Google Calendar', googleHint: 'Opens Google Calendar with the reminder filled in. Press Save there, then come back for the next one.',
            addGoogle: 'Add {slot} reminder', added: '✓ Opened',
            apple: 'iPhone, iPad & other calendars', appleHint: 'Downloads one calendar file with all the reminders. On iPhone tap “Add All”. Also works with Outlook and Samsung Calendar.',
            addApple: '⬇ Add all reminders (.ics)', close: 'Close', unclear: '{n} medicine(s) have an unclear time and are not included. Check them with your doctor or pharmacist.',
            eventTitle: '💊 {slot} medicines', eventDesc: 'Time for your {slot} medicines:', tickHere: 'Tick them off in Neutrix:', changed: 'If your medicines change, add the reminders again and delete the old ones.',
            empty: 'There are no medicines in your schedule to remind you about.'
        },
        Malayalam: {
            btn: '📅 എന്റെ കലണ്ടറിൽ ചേർക്കുക', hint: 'ഓരോ മരുന്ന് സമയത്തും Google Calendar-ലോ iPhone കലണ്ടറിലോ ഓർമ്മപ്പെടുത്തൽ, ഡോസ് ടിക്ക് ചെയ്യാൻ ഈ പേജിലേക്കുള്ള ലിങ്കോടെ.',
            title: 'കലണ്ടറിൽ മരുന്ന് ഓർമ്മപ്പെടുത്തലുകൾ', sub: 'ഓരോ സമയത്തിനും നേരം സെറ്റ് ചെയ്ത് ഓർമ്മപ്പെടുത്തലുകൾ ചേർക്കുക. അവ ദിവസവും ആവർത്തിക്കും, ഇവിടെ ടിക്ക് ചെയ്യാനുള്ള ലിങ്കും ഉണ്ടാകും.',
            slot: { morning: 'രാവിലെ', afternoon: 'ഉച്ചയ്ക്ക്', evening: 'വൈകുന്നേരം', night: 'രാത്രി' },
            noMeds: 'ഈ സമയത്ത് മരുന്നില്ല', until: '{d} വരെ', daily: 'ദിവസവും',
            google: 'Google Calendar', googleHint: 'ഓർമ്മപ്പെടുത്തൽ നിറച്ച് Google Calendar തുറക്കും. അവിടെ Save അമർത്തി അടുത്തതിനായി തിരികെ വരുക.',
            addGoogle: '{slot} ഓർമ്മപ്പെടുത്തൽ ചേർക്കുക', added: '✓ തുറന്നു',
            apple: 'iPhone, iPad & മറ്റ് കലണ്ടറുകൾ', appleHint: 'എല്ലാ ഓർമ്മപ്പെടുത്തലുകളുമുള്ള ഒരു കലണ്ടർ ഫയൽ ഡൗൺലോഡ് ചെയ്യും. iPhone-ൽ “Add All” തൊടുക.',
            addApple: '⬇ എല്ലാം ചേർക്കുക (.ics)', close: 'അടയ്ക്കുക', unclear: '{n} മരുന്നിന്റെ സമയം വ്യക്തമല്ലാത്തതിനാൽ ഉൾപ്പെടുത്തിയിട്ടില്ല. ഡോക്ടറോടോ ഫാർമസിസ്റ്റിനോടോ ചോദിക്കുക.',
            eventTitle: '💊 {slot} മരുന്നുകൾ', eventDesc: '{slot} മരുന്നുകൾ കഴിക്കാനുള്ള സമയം:', tickHere: 'ന്യൂട്രിക്സിൽ ടിക്ക് ചെയ്യുക:', changed: 'മരുന്നുകൾ മാറിയാൽ, ഓർമ്മപ്പെടുത്തലുകൾ വീണ്ടും ചേർത്ത് പഴയവ ഡിലീറ്റ് ചെയ്യുക.',
            empty: 'ഓർമ്മപ്പെടുത്താൻ ഷെഡ്യൂളിൽ മരുന്നുകളൊന്നുമില്ല.'
        }
    };
    const L = () => T[window.neutrixLang] || T.English;
    const fill = (s, v) => Object.keys(v || {}).reduce((a, k) => a.replaceAll(`{${k}}`, v[k]), s);
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ---------- Data ----------
    function times() {
        const saved = storeGet(TIMES_KEY) || {};
        const out = {};
        SLOTS.forEach(s => { out[s] = /^\d{2}:\d{2}$/.test(saved[s] || '') ? saved[s] : DEFAULT_TIMES[s]; });
        return out;
    }
    function tickLink() {
        const issue = window.neutrixActiveIssue;
        return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}schedule.html${issue ? '?issue=' + encodeURIComponent(issue.id) : ''}`;
    }
    // Medicines for each time of day (today's version of the schedule), and when the last one ends
    function plan() {
        const schedule = storeGet('neutrixSchedule');
        if (!schedule) return null;
        const today = dayKey(new Date());
        const versions = scheduleVersions(schedule);
        let version = versions[0];
        versions.forEach(v => { if (v.from <= today) version = v; });
        const doses = dosesForDay(schedule, today);
        const bySlot = {};
        SLOTS.forEach(s => { bySlot[s] = { doses: [], end: null, continues: false }; });
        let unclear = 0;
        doses.forEach(d => {
            if (!bySlot[d.slot]) { unclear++; return; }
            const b = bySlot[d.slot];
            b.doses.push(d);
            const end = version ? doseEndDay(d, version.from) : null;
            if (!end) b.continues = true;
            else if (!b.end || end > b.end) b.end = end;
        });
        SLOTS.forEach(s => { if (bySlot[s].continues) bySlot[s].end = null; });
        return { bySlot, unclear, today };
    }
    const localized = (d, f) => (window.neutrixLang === 'Malayalam' ? (d[f + '_ml'] || d[f + '_en']) : (d[f + '_en'] || d[f + '_ml'])) || '';
    const doseLine = d => [`${d.medicine} ${d.strength || ''}`.trim(), d.dose, localized(d, 'instruction')].filter(Boolean).join(' · ');

    function eventText(slot, b) {
        const l = L();
        const name = l.slot[slot];
        const lines = [fill(l.eventDesc, { slot: name.toLowerCase() })];
        b.doses.forEach(d => lines.push('• ' + doseLine(d)));
        lines.push('', l.tickHere, tickLink(), '', l.changed);
        return { title: fill(l.eventTitle, { slot: name }), body: lines.join('\n') };
    }

    // ---------- Google Calendar (one event per link) ----------
    const compact = (dayKeyStr, hhmm) => dayKeyStr.replace(/-/g, '') + 'T' + hhmm.replace(':', '') + '00';
    function plusMinutes(hhmm, mins) {
        const [h, m] = hhmm.split(':').map(Number);
        const t = (h * 60 + m + mins) % (24 * 60);
        return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    }
    function googleUrl(slot, b, time, today) {
        const { title, body } = eventText(slot, b);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const rrule = 'RRULE:FREQ=DAILY' + (b.end ? `;UNTIL=${b.end.replace(/-/g, '')}T235959Z` : '');
        const q = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${compact(today, time)}/${compact(today, plusMinutes(time, 10))}`,
            ctz: tz,
            details: body,
            recur: rrule
        });
        return 'https://calendar.google.com/calendar/render?' + q.toString();
    }

    // ---------- .ics file (all events at once) ----------
    function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function fold(line) {
        // lines longer than 75 bytes are folded (continuation lines start with a space)
        const out = [];
        let cur = '';
        let bytes = 0;
        for (const ch of line) {
            const n = new TextEncoder().encode(ch).length;
            if (bytes + n > 73) { out.push(cur); cur = ' '; bytes = 1; }
            cur += ch;
            bytes += n;
        }
        out.push(cur);
        return out.join('\r\n');
    }
    function buildIcs(p, t) {
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
        const issue = window.neutrixActiveIssue;
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Neutrix Health//Medicine reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
                       'X-WR-CALNAME:Neutrix medicines'];
        SLOTS.forEach(slot => {
            const b = p.bySlot[slot];
            if (!b.doses.length) return;
            const { title, body } = eventText(slot, b);
            lines.push('BEGIN:VEVENT',
                `UID:neutrix-${(issue && issue.id) || 'meds'}-${slot}-${stamp}@neutrix-health`,
                `DTSTAMP:${stamp}`,
                `DTSTART:${compact(p.today, t[slot])}`,               // local time on the phone
                `DTEND:${compact(p.today, plusMinutes(t[slot], 10))}`,
                'RRULE:FREQ=DAILY' + (b.end ? `;UNTIL=${b.end.replace(/-/g, '')}T235959` : ''),
                `SUMMARY:${icsEscape(title)}`,
                `DESCRIPTION:${icsEscape(body)}`,
                `URL:${tickLink()}`,
                'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, 'TRIGGER:-PT0M', 'END:VALARM',
                'END:VEVENT');
        });
        lines.push('END:VCALENDAR');
        return lines.map(fold).join('\r\n') + '\r\n';
    }
    const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    function openIcs(text) {
        if (isIOS()) {
            // iPhone opens calendar files best from a real web address: send it to the server, which hands it straight back
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `${API_BASE}/api/calendar-file`;
            form.style.display = 'none';
            const field = document.createElement('input');
            field.type = 'hidden';
            field.name = 'ics';
            field.value = text;
            form.appendChild(field);
            document.body.appendChild(form);
            form.submit();
            setTimeout(() => form.remove(), 1000);
            return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
        a.download = 'Neutrix_medicine_reminders.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }

    // ---------- Window ----------
    function fmtEnd(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function openWindow() {
        const p = plan();
        const l = L();
        const t = times();
        const wrap = document.createElement('div');
        wrap.className = 'cal-modal';
        const used = p ? SLOTS.filter(s => p.bySlot[s].doses.length) : [];
        wrap.innerHTML = `
            <div class="cal-box" role="dialog" aria-modal="true">
                <button class="cal-x" type="button" aria-label="${esc(l.close)}">×</button>
                <h3>${esc(l.title)}</h3>
                <p class="cal-sub">${esc(l.sub)}</p>
                ${!used.length ? `<p class="cal-empty">${esc(l.empty)}</p>` : `
                <div class="cal-slots">${used.map(s => {
                    const b = p.bySlot[s];
                    return `<div class="cal-slot">
                        <div class="cal-slot-head"><strong>${esc(l.slot[s])}</strong>
                            <input type="time" class="cal-time" data-slot="${s}" value="${t[s]}" aria-label="${esc(l.slot[s])}"></div>
                        <ul>${b.doses.map(d => `<li>${esc(doseLine(d))}</li>`).join('')}</ul>
                        <div class="cal-until">${esc(b.end ? fill(l.until, { d: fmtEnd(b.end) }) : l.daily)}</div>
                    </div>`;
                }).join('')}</div>
                ${p.unclear ? `<p class="cal-warn">⚠️ ${esc(fill(l.unclear, { n: p.unclear }))}</p>` : ''}
                <div class="cal-choice">
                    <div class="cal-col">
                        <h4><span class="cal-g">G</span> ${esc(l.google)}</h4>
                        <p>${esc(l.googleHint)}</p>
                        ${used.map(s => `<button type="button" class="cal-btn" data-google="${s}">${esc(fill(l.addGoogle, { slot: l.slot[s] }))}</button>`).join('')}
                    </div>
                    <div class="cal-col">
                        <h4> ${esc(l.apple)}</h4>
                        <p>${esc(l.appleHint)}</p>
                        <button type="button" class="cal-btn main" data-ics="1">${esc(l.addApple)}</button>
                    </div>
                </div>`}
                <div class="cal-foot"><button type="button" class="cal-btn" data-close="1">${esc(l.close)}</button></div>
            </div>`;
        document.body.appendChild(wrap);
        const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        wrap.querySelector('.cal-x').addEventListener('click', close);
        wrap.querySelector('[data-close]').addEventListener('click', close);

        const current = () => {
            const out = times();
            wrap.querySelectorAll('.cal-time').forEach(inp => { if (/^\d{2}:\d{2}$/.test(inp.value)) out[inp.dataset.slot] = inp.value; });
            return out;
        };
        wrap.querySelectorAll('.cal-time').forEach(inp => inp.addEventListener('change', () => storeSet(TIMES_KEY, current())));
        wrap.querySelectorAll('[data-google]').forEach(btn => btn.addEventListener('click', () => {
            const slot = btn.dataset.google;
            window.open(googleUrl(slot, p.bySlot[slot], current()[slot], p.today), '_blank', 'noopener');
            btn.classList.add('done');
            btn.textContent = `${fill(l.addGoogle, { slot: l.slot[slot] })}  ${l.added}`;
        }));
        const icsBtn = wrap.querySelector('[data-ics]');
        if (icsBtn) icsBtn.addEventListener('click', () => openIcs(buildIcs(p, current())));
    }

    // ---------- Button on the page ----------
    const style = document.createElement('style');
    style.textContent = `
        .cal-cta { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin: 16px 0;
            padding: 14px 16px; border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.35); background: rgba(59, 130, 246, 0.06); }
        .cal-cta p { margin: 0; font-size: 13px; color: var(--text-secondary); flex: 1; min-width: 220px; }
        .cal-open { white-space: nowrap; }
        .cal-modal { position: fixed; inset: 0; z-index: 5000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.55); }
        .cal-box { position: relative; width: min(720px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 20px; padding: 22px;
            background: var(--card-bg); color: var(--text-primary); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35); }
        .cal-box h3 { margin: 0 0 6px; font-size: 20px; }
        .cal-sub { margin: 0 0 14px; font-size: 13.5px; color: var(--text-secondary); }
        .cal-x { position: absolute; top: 12px; right: 14px; border: none; background: none; font-size: 22px; cursor: pointer; color: var(--text-muted); }
        .cal-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .cal-slot { border: 1px solid var(--border-color); border-radius: 14px; padding: 12px; }
        .cal-slot-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
        .cal-time { padding: 6px 8px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--input-bg, transparent); color: inherit; font: inherit; font-size: 14px; }
        .cal-slot ul { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--text-secondary); }
        .cal-until { margin-top: 6px; font-size: 11.5px; font-weight: 700; color: var(--text-muted); }
        .cal-warn { font-size: 12.5px; color: #b45309; margin: 10px 0 0; }
        .cal-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
        @media (max-width: 600px) { .cal-choice { grid-template-columns: 1fr; } }
        .cal-col { border: 1px solid var(--border-color); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .cal-col h4 { margin: 0; font-size: 15px; display: flex; align-items: center; gap: 8px; }
        .cal-col p { margin: 0 0 4px; font-size: 12.5px; color: var(--text-muted); }
        .cal-g { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px;
            background: conic-gradient(#4285f4 0 25%, #34a853 0 50%, #fbbc05 0 75%, #ea4335 0); }
        .cal-btn { padding: 10px 14px; border-radius: 30px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary);
            font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; text-align: center; }
        .cal-btn:hover { border-color: #3b82f6; }
        .cal-btn.main { background: var(--text-primary); color: var(--card-bg); border-color: var(--text-primary); }
        .cal-btn.done { border-color: #16a34a; color: #16a34a; }
        .cal-foot { display: flex; justify-content: flex-end; margin-top: 14px; }
        .cal-empty { color: var(--text-muted); }
    `;
    document.head.appendChild(style);

    function addButton() {
        const list = document.getElementById('slotList');
        if (!list || document.querySelector('.cal-cta')) return;
        const box = document.createElement('div');
        box.className = 'cal-cta';
        box.innerHTML = `<p></p><button type="button" class="btn-primary cal-open"></button>`;
        list.parentNode.insertBefore(box, list);
        const paint = () => { box.querySelector('p').textContent = L().hint; box.querySelector('button').textContent = L().btn; };
        paint();
        document.addEventListener('neutrix:langchange', paint);
        box.querySelector('button').addEventListener('click', openWindow);
    }
    addButton();
    window.NxCalendar = { openWindow, buildIcs, googleUrl, plan };
})();
