// =====================================================
// checkup-calendar.js — "📅 Add check-ups to my calendar" on the Upcoming Check-ups page
// One all-day event per upcoming check-up (with a reminder the day before at 9 am on iPhone),
// each with a link back to this issue's Check-ups page.
// - Google Calendar: one prefilled event per check-up.
// - iPhone / other calendars: one .ics file with all of them ("Add All").
// Uses the helpers in calendar-reminders.js (NxCalendar).
// =====================================================
(function () {
    const T = {
        English: {
            btn: '📅 Add check-ups to my calendar', hint: 'Put your upcoming check-ups and tests in Google Calendar or your iPhone calendar, with a reminder and a link back to this page.',
            title: 'Check-ups in your calendar', sub: 'Each check-up is added as an all-day event on its date. The calendar reminds you, even when Neutrix is closed.',
            google: 'Google Calendar', googleHint: 'Opens Google Calendar with the check-up filled in. Press Save there, then come back for the next one.',
            addGoogle: 'Add: {t}', added: '✓ Opened',
            apple: 'iPhone, iPad & other calendars', appleHint: 'Downloads one calendar file with all the check-ups and a reminder the day before at 9 am. On iPhone tap “Add All”.',
            addApple: '⬇ Add all check-ups (.ics)', close: 'Close',
            none: 'There are no upcoming check-ups with a date to add. Past check-ups are not added.',
            eventTitle: '🩺 {t}', eventDesc: 'Check-up from your discharge papers ({w}).', openHere: 'See it in Neutrix:',
            approx: 'If the date says "approx.", confirm the exact date with the hospital.'
        },
        Malayalam: {
            btn: '📅 ചെക്കപ്പുകൾ കലണ്ടറിൽ ചേർക്കുക', hint: 'വരാനിരിക്കുന്ന ചെക്കപ്പുകളും ടെസ്റ്റുകളും Google Calendar-ലോ iPhone കലണ്ടറിലോ ഓർമ്മപ്പെടുത്തലോടെ ചേർക്കുക, ഈ പേജിലേക്കുള്ള ലിങ്കോടെ.',
            title: 'കലണ്ടറിൽ ചെക്കപ്പുകൾ', sub: 'ഓരോ ചെക്കപ്പും അതിന്റെ തീയതിയിൽ മുഴുവൻ ദിവസ ഇവന്റായി ചേർക്കും. ന്യൂട്രിക്സ് അടച്ചിരുന്നാലും കലണ്ടർ ഓർമ്മിപ്പിക്കും.',
            google: 'Google Calendar', googleHint: 'ചെക്കപ്പ് നിറച്ച് Google Calendar തുറക്കും. അവിടെ Save അമർത്തി അടുത്തതിനായി തിരികെ വരുക.',
            addGoogle: 'ചേർക്കുക: {t}', added: '✓ തുറന്നു',
            apple: 'iPhone, iPad & മറ്റ് കലണ്ടറുകൾ', appleHint: 'എല്ലാ ചെക്കപ്പുകളും തലേദിവസം രാവിലെ 9-ന് ഓർമ്മപ്പെടുത്തലുമുള്ള ഒരു ഫയൽ ഡൗൺലോഡ് ചെയ്യും. iPhone-ൽ “Add All” തൊടുക.',
            addApple: '⬇ എല്ലാ ചെക്കപ്പുകളും ചേർക്കുക (.ics)', close: 'അടയ്ക്കുക',
            none: 'ചേർക്കാൻ തീയതിയുള്ള വരാനിരിക്കുന്ന ചെക്കപ്പുകളൊന്നുമില്ല. കഴിഞ്ഞവ ചേർക്കില്ല.',
            eventTitle: '🩺 {t}', eventDesc: 'ഡിസ്ചാർജ് പേപ്പറിലെ ചെക്കപ്പ് ({w}).', openHere: 'ന്യൂട്രിക്സിൽ കാണുക:',
            approx: 'തീയതി "ഏകദേശം" ആണെങ്കിൽ, കൃത്യമായ തീയതി ആശുപത്രിയിൽ ഉറപ്പാക്കുക.'
        }
    };
    const L = () => T[window.neutrixLang] || T.English;
    const fill = (s, v) => Object.keys(v || {}).reduce((a, k) => a.replaceAll(`{${k}}`, v[k]), s);
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function upcoming() {
        const today = dayKey(new Date());
        return (window.neutrixCheckupItems || []).filter(c => c.date >= today && !c.passed);
    }
    function pageLink() {
        const issue = window.neutrixActiveIssue;
        return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}checkups.html${issue ? '?issue=' + encodeURIComponent(issue.id) : ''}`;
    }
    const nextDay = k => dayKeyShift(k, 1);
    const flat = k => k.replace(/-/g, '');
    function eventText(c) {
        const l = L();
        const lines = [fill(l.eventDesc, { w: c.when })];
        if (c.details) lines.push('', c.details);
        if (/approx|ഏകദേശം/i.test(c.when)) lines.push('', l.approx);
        lines.push('', l.openHere, pageLink());
        return { title: fill(l.eventTitle, { t: c.title }), body: lines.join('\n') };
    }
    function googleUrl(c) {
        const { title, body } = eventText(c);
        const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${flat(c.date)}/${flat(nextDay(c.date))}`, details: body });
        return 'https://calendar.google.com/calendar/render?' + q.toString();
    }
    function buildIcs(list) {
        const C = window.NxCalendar;
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
        const issue = window.neutrixActiveIssue;
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Neutrix Health//Check-ups//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Neutrix check-ups'];
        list.forEach((c, i) => {
            const { title, body } = eventText(c);
            lines.push('BEGIN:VEVENT',
                `UID:neutrix-checkup-${(issue && issue.id) || 'x'}-${flat(c.date)}-${i}-${stamp}@neutrix-health`,
                `DTSTAMP:${stamp}`,
                `DTSTART;VALUE=DATE:${flat(c.date)}`,
                `DTEND;VALUE=DATE:${flat(nextDay(c.date))}`,
                `SUMMARY:${C.icsEscape(title)}`,
                `DESCRIPTION:${C.icsEscape(body)}`,
                `URL:${pageLink()}`,
                'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${C.icsEscape(title)}`, 'TRIGGER:-PT15H', 'END:VALARM',   // 9 am the day before
                'END:VEVENT');
        });
        lines.push('END:VCALENDAR');
        return lines.map(C.fold).join('\r\n') + '\r\n';
    }
    const fmt = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(localeFor(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };

    function openWindow() {
        const l = L();
        const list = upcoming();
        const wrap = document.createElement('div');
        wrap.className = 'cal-modal';
        wrap.innerHTML = `
            <div class="cal-box" role="dialog" aria-modal="true">
                <button class="cal-x" type="button" aria-label="${esc(l.close)}">×</button>
                <h3>${esc(l.title)}</h3>
                <p class="cal-sub">${esc(l.sub)}</p>
                ${!list.length ? `<p class="cal-empty">${esc(l.none)}</p>` : `
                <div class="cal-slots">${list.map(c => `<div class="cal-slot">
                    <div class="cal-slot-head"><strong>${esc(c.title)}</strong></div>
                    <div class="cal-until">📅 ${esc(fmt(c.date))}${/approx|ഏകദേശം/i.test(c.when) ? ' (approx.)' : ''}</div></div>`).join('')}</div>
                <div class="cal-choice">
                    <div class="cal-col">
                        <h4><span class="cal-g">G</span> ${esc(l.google)}</h4>
                        <p>${esc(l.googleHint)}</p>
                        ${list.map((c, i) => `<button type="button" class="cal-btn" data-google="${i}">${esc(fill(l.addGoogle, { t: c.title }))}</button>`).join('')}
                    </div>
                    <div class="cal-col">
                        <h4>📱 ${esc(l.apple)}</h4>
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
        wrap.querySelectorAll('[data-google]').forEach(btn => btn.addEventListener('click', () => {
            const c = list[Number(btn.dataset.google)];
            window.open(googleUrl(c), '_blank', 'noopener');
            btn.classList.add('done');
            btn.textContent = `${fill(l.addGoogle, { t: c.title })}  ${l.added}`;
        }));
        const icsBtn = wrap.querySelector('[data-ics]');
        if (icsBtn) icsBtn.addEventListener('click', () => window.NxCalendar.openIcs(buildIcs(list), 'Neutrix_checkups.ics'));
    }

    // Button above the check-up list; shown only when there is an upcoming check-up with a date
    let box = null;
    function paint() {
        const content = document.getElementById('checkupContent');
        if (!content) return;
        if (!box) {
            box = document.createElement('div');
            box.className = 'cal-cta';
            box.innerHTML = `<p></p><button type="button" class="btn-primary cal-open"></button>`;
            content.parentNode.parentNode.insertBefore(box, content.parentNode);
            box.querySelector('button').addEventListener('click', openWindow);
        }
        box.querySelector('p').textContent = L().hint;
        box.querySelector('button').textContent = L().btn;
        box.style.display = upcoming().length ? '' : 'none';
    }
    document.addEventListener('neutrix:checkups', paint);
    document.addEventListener('neutrix:langchange', () => setTimeout(paint, 0));
    window.NxCheckupCalendar = { openWindow, buildIcs, googleUrl, upcoming };
})();
