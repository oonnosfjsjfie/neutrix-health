// nx-notify.js: notification centre on every app page (not the website).
// A bell in the top bar opens a panel on the right with every notification so far, newest first,
// even after its popup has gone. Kept on this device in 'neutrixNotifications' (all issues together).
//   NxNotify.add({ id, level: 'red'|'amber'|'info'|'good', title, text, href, silent })
//     id: the same id is only ever added once (so a missed dose is not repeated on every page)
//     silent: no popup (the caller already showed its own)
(function () {
    if (window.NxNotify) return;
    const KEY = 'neutrixNotifications', MAX = 150;
    const page = (location.pathname.split('/').pop() || 'index.html');
    if (/^(home|signin|emergency|get-app|offline)\.html$/.test(page) || page === '') return;
    const ml = () => (window.neutrixLang || localStorage.getItem('neutrixLang')) === 'Malayalam';
    const L = (en, m) => (ml() && m ? m : en);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const raw = Storage.prototype.getItem, rawSet = Storage.prototype.setItem;   // global list, not per issue
    const load = () => { try { return JSON.parse(raw.call(localStorage, KEY) || '[]'); } catch (e) { return []; } };
    const save = list => { try { rawSet.call(localStorage, KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {} };
    const ICON = { red: '⚠️', amber: '⏰', info: 'ℹ️', good: '✅' };
    const issueTitle = () => { try { return (window.neutrixActiveIssue && window.neutrixActiveIssue.title) || ''; } catch (e) { return ''; } };

    function add(n) {
        if (!n || !n.title) return false;
        const list = load();
        const id = String(n.id || (n.title + '|' + (n.text || '')));
        if (list.some(x => x.id === id)) return false;
        const item = { id, icon: n.icon || '', level: n.level || 'info', title: String(n.title).slice(0, 140), text: String(n.text || '').slice(0, 400), href: n.href || '', issue: n.issue ?? issueTitle(), at: new Date().toISOString(), read: false };
        list.unshift(item);
        save(list);
        paint();
        if (!n.silent) toast(item);
        return true;
    }

    // ---------- bell + panel ----------
    let bell = null, panel = null;
    function unread() { return load().filter(x => !x.read).length; }
    function paint() {
        if (!bell) return;
        const n = unread();
        bell.querySelector('.nxn-count').textContent = n > 99 ? '99+' : String(n);
        bell.classList.toggle('has', n > 0);
        bell.setAttribute('aria-label', L(`Notifications${n ? `, ${n} unread` : ''}`, `അറിയിപ്പുകൾ${n ? `, ${n} വായിക്കാത്തത്` : ''}`));
        if (panel && !panel.hidden) drawList();
    }
    function when(iso) {
        const d = new Date(iso), now = new Date();
        const mins = Math.round((now - d) / 60000);
        if (mins < 1) return L('just now', 'ഇപ്പോൾ');
        if (mins < 60) return L(`${mins} min ago`, `${mins} മിനിറ്റ് മുമ്പ്`);
        const sameDay = d.toDateString() === now.toDateString();
        return d.toLocaleString(ml() ? 'ml-IN' : 'en-IN', sameDay ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    }
    function drawList() {
        const list = load();
        const box = panel.querySelector('.nxn-list');
        if (!list.length) { box.innerHTML = `<div class="nxn-empty">🔔<p>${esc(L('No notifications yet. Missed doses, warnings, family alerts and weather alerts will show here.', 'ഇതുവരെ അറിയിപ്പുകളില്ല. വിട്ടുപോയ ഡോസുകൾ, മുന്നറിയിപ്പുകൾ, കുടുംബ അലേർട്ടുകൾ, കാലാവസ്ഥ അലേർട്ടുകൾ ഇവിടെ കാണാം.'))}</p></div>`; return; }
        const today = new Date().toDateString();
        let lastGroup = '';
        box.innerHTML = list.map(x => {
            const g = new Date(x.at).toDateString() === today ? L('Today', 'ഇന്ന്') : L('Earlier', 'മുമ്പ്');
            const head = g !== lastGroup ? `<div class="nxn-group">${esc(g)}</div>` : '';
            lastGroup = g;
            return `${head}<div class="nxn-item ${esc(x.level)}${x.read ? '' : ' unread'}" data-id="${esc(x.id)}">
                <span class="nxn-ic" aria-hidden="true">${x.icon || ICON[x.level] || ICON.info}</span>
                <div class="nxn-body"><b>${esc(x.title)}</b>${x.text ? `<p>${esc(x.text)}</p>` : ''}
                <div class="nxn-meta">${esc(when(x.at))}${x.issue ? ' · ' + esc(x.issue) : ''}${x.href ? ` · <a href="${esc(x.href)}">${esc(L('Open', 'തുറക്കുക'))}</a>` : ''}</div></div>
                <button type="button" class="nxn-del" aria-label="${esc(L('Delete', 'ഇല്ലാതാക്കുക'))}">×</button></div>`;
        }).join('');
        box.querySelectorAll('.nxn-del').forEach(b => b.onclick = e => {
            e.stopPropagation();
            const id = b.closest('.nxn-item').dataset.id;
            forget([id]); save(load().filter(x => x.id !== id)); paint();
        });
    }
    function open(on) {
        if (!panel) return;
        if (on) {
            panel.hidden = false; drawList();
            requestAnimationFrame(() => panel.classList.add('open'));
            bell.setAttribute('aria-expanded', 'true');
            setTimeout(() => { save(load().map(x => ({ ...x, read: true }))); paint(); }, 1500);   // seen once the panel has been open a moment
            panel.querySelector('.nxn-x').focus();
        } else {
            panel.classList.remove('open'); bell.setAttribute('aria-expanded', 'false');
            setTimeout(() => { panel.hidden = true; }, 200);
        }
    }
    function build() {
        if (bell) return;
        bell = document.createElement('button');
        bell.type = 'button';
        bell.className = 'nxn-bell';
        bell.setAttribute('aria-haspopup', 'dialog');
        bell.setAttribute('aria-expanded', 'false');
        bell.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg><span class="nxn-count"></span>`;
        bell.addEventListener('click', e => { e.stopPropagation(); open(panel.hidden); });
        const appbar = document.querySelector('.nx-appbar .nx-ab-me');
        const controls = document.querySelector('.ehr-navbar .system-controls');
        if (appbar) { bell.classList.add('in-appbar'); appbar.parentNode.insertBefore(bell, appbar); }
        else if (controls) { const acct = document.getElementById('accountSlot'); controls.insertBefore(bell, acct && acct.parentNode === controls ? acct : null); }
        else { bell.classList.add('floating'); document.body.appendChild(bell); }

        panel = document.createElement('aside');
        panel.className = 'nxn-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', L('Notifications', 'അറിയിപ്പുകൾ'));
        panel.innerHTML = `<div class="nxn-head"><b>🔔 ${esc(L('Notifications', 'അറിയിപ്പുകൾ'))}</b><button type="button" class="nxn-x" aria-label="${esc(L('Close', 'അടയ്ക്കുക'))}">✕</button></div>
            <div class="nxn-tools"><button type="button" class="nxn-read">${esc(L('Mark all read', 'എല്ലാം വായിച്ചു'))}</button><button type="button" class="nxn-clear">${esc(L('Clear all', 'എല്ലാം മായ്ക്കുക'))}</button></div>
            <div class="nxn-list"></div>`;
        document.body.appendChild(panel);
        panel.querySelector('.nxn-x').onclick = () => open(false);
        panel.querySelector('.nxn-read').onclick = () => { save(load().map(x => ({ ...x, read: true }))); paint(); };
        const clr = panel.querySelector('.nxn-clear');
        clr.onclick = () => {
            if (clr.dataset.sure) { forget(load().map(x => x.id)); save([]); paint(); delete clr.dataset.sure; clr.textContent = L('Clear all', 'എല്ലാം മായ്ക്കുക'); return; }
            clr.dataset.sure = '1'; clr.textContent = L('Tap again to clear', 'മായ്ക്കാൻ വീണ്ടും അമർത്തുക');
            setTimeout(() => { delete clr.dataset.sure; clr.textContent = L('Clear all', 'എല്ലാം മായ്ക്കുക'); }, 3000);
        };
        document.addEventListener('click', e => { if (!panel.hidden && !panel.contains(e.target) && e.target !== bell) open(false); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { open(false); bell.focus(); } });
        paint();
    }
    // deleted or cleared notifications never come back for the same thing (same id)
    const GONE = 'neutrixNotificationsGone';
    let gone = new Set();
    try { gone = new Set(JSON.parse(raw.call(localStorage, GONE) || '[]')); } catch (e) {}
    function forget(ids) { ids.forEach(i => gone.add(i)); try { rawSet.call(localStorage, GONE, JSON.stringify([...gone].slice(-500))); } catch (e) {} }
    function addOnce(n) {
        if (!n) return false;
        const id = String(n.id || (n.title + '|' + (n.text || '')));
        if (gone.has(id)) return false;
        return add({ ...n, id });
    }

    // ---------- popup ----------
    function toast(item) {
        let stack = document.getElementById('nxnToasts');
        if (!stack) { stack = document.createElement('div'); stack.id = 'nxnToasts'; stack.className = 'nxn-toasts'; stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
        const el = document.createElement('div');
        el.className = 'nxn-toast ' + item.level;
        el.innerHTML = `<span aria-hidden="true">${item.icon || ICON[item.level] || ICON.info}</span><div><b></b><p></p></div><button type="button" aria-label="${esc(L('Close', 'അടയ്ക്കുക'))}">✕</button>`;
        el.querySelector('b').textContent = item.title;
        el.querySelector('p').textContent = item.text;
        el.querySelector('button').onclick = e => { e.stopPropagation(); el.remove(); };
        el.addEventListener('click', () => { el.remove(); open(true); });
        stack.prepend(el);
        while (stack.children.length > 3) stack.lastChild.remove();
        setTimeout(() => el.remove(), 9000);
    }

    // ---------- what this app notices by itself ----------
    const SLOT_END = { morning: 12, afternoon: 16, evening: 21, night: 24 };
    const SLOT_NAME = { morning: ['morning', 'രാവിലെ'], afternoon: ['afternoon', 'ഉച്ച'], evening: ['evening', 'വൈകുന്നേരം'], night: ['night', 'രാത്രി'] };
    function scan() {
        if (!window.neutrixActiveIssue || !window.storeGet || !window.dosesForDay || !window.dayKey) return;
        const issue = issueTitle(), today = dayKey(new Date()), h = new Date().getHours();
        // missed doses (time has passed, not ticked)
        const sch = storeGet('neutrixSchedule');
        if (sch) {
            const ticks = (sch.ticks && sch.ticks[today]) || {};
            dosesForDay(sch, today).filter(d => SLOT_END[d.slot] && h >= SLOT_END[d.slot] && !ticks[d.id]).forEach(d => {
                const name = `${d.medicine} ${d.strength || ''}`.trim();
                addOnce({ id: `miss|${issue}|${today}|${d.id}`, level: 'amber', title: L(`Missed dose: ${name}`, `വിട്ടുപോയ ഡോസ്: ${name}`),
                    text: L(`Your ${L(...SLOT_NAME[d.slot])} dose isn't ticked yet. If you took it, tick it on the schedule. Never take two doses together to catch up.`, `${L(...SLOT_NAME[d.slot])} ഡോസ് ഇതുവരെ ടിക്ക് ചെയ്തിട്ടില്ല. കഴിച്ചെങ്കിൽ ഷെഡ്യൂളിൽ ടിക്ക് ചെയ്യുക. പിടിച്ചെത്താൻ രണ്ട് ഡോസ് ഒരുമിച്ച് കഴിക്കരുത്.`),
                    href: 'schedule.html' });
            });
        }
        if (window.NxCare) {
            try {
                NxCare.urgentReadings().forEach(u => addOnce({ id: `urgent|${issue}|${u}`, icon: '🩺', level: 'red', title: L('Reading needs attention', 'റീഡിംഗ് ശ്രദ്ധിക്കേണ്ടതാണ്'), text: u, href: 'care.html' }));
                NxCare.refills().filter(r => r.low).forEach(r => addOnce({ id: `low|${issue}|${r.name}|${today}`, icon: '🔁', level: 'amber', title: L(`Running low: ${r.name}`, `തീരാറായി: ${r.name}`),
                    text: L(`About ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left. Get a refill soon.`, `ഏകദേശം ${r.daysLeft} ദിവസം ബാക്കി. ഉടൻ വാങ്ങുക.`), href: 'care.html#careRefill' }));
                const doses = sch ? dosesForDay(sch, today) : [];
                (doses.length ? NxCare.safety(doses) : []).forEach(x => addOnce({ id: `safety|${issue}|${x.title}`, icon: '💊', level: x.level === 'high' ? 'red' : 'amber', title: L('Medicine safety check', 'മരുന്ന് സുരക്ഷാ പരിശോധന') + ': ' + x.title, text: x.text, href: 'care.html' }));
            } catch (e) { console.warn('[notify] scan', e); }
        }
    }

    window.NxNotify = { add: addOnce, list: load, open: () => open(true), scan };
    function boot() {
        build();
        setTimeout(scan, 1200);
        setInterval(scan, 5 * 60000);                     // doses become missed as time passes
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0));
    else setTimeout(boot, 0);
    document.addEventListener('neutrix:langchange', () => { if (panel) { panel.remove(); bell.remove(); panel = bell = null; build(); } });
    addEventListener('storage', e => { if (e.key === KEY) paint(); });   // other tabs
})();
