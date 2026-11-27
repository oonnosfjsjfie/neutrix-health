// =====================================================
// family.js: family / caregiver sharing.
// The patient turns sharing on for one medical issue and gets a code. Their device keeps a small summary
// in Firestore at shares/{code}: today's doses (taken / still to take), the last 7 days, medicines running
// low, and serious symptoms or readings from the last 3 days. Nothing else (no reports, no documents).
// A family member signed in to Neutrix opens caregiver.html, types the code, and sees that summary.
// The patient can stop sharing at any time (the shared copy is deleted).
// Data on this device: 'neutrixShare' (per issue) { code, since }; 'neutrixWatching' (who I look after).
// =====================================================
(function () {
    const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // no 0/O, 1/I
    const newCode = () => { const a = new Uint32Array(10); crypto.getRandomValues(a); return [...a].map(n => ALPHA[n % ALPHA.length]).join(''); };
    const fmtCode = c => String(c || '').replace(/(.{5})(.{5})/, '$1-$2');
    const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const todayK = () => dayKey(new Date());

    async function db() {
        if (!window.NeutrixCloud || !NeutrixCloud.configured) throw new Error('not-configured');
        const { db } = await NeutrixCloud.init();
        const user = await NeutrixCloud.currentUser();
        if (!user) throw new Error('not-signed-in');
        return { db, user };
    }
    function firstName() {
        try { return (JSON.parse(localStorage.getItem('neutrix_hospital_profile') || '{}').patientName || '').trim().split(/\s+/)[0] || ''; } catch (e) { return ''; }
    }

    // What family can see (built on the patient's device)
    function summary() {
        const sch = storeGet('neutrixSchedule');
        const out = { name: firstName().slice(0, 40), issue: String((window.neutrixActiveIssue || {}).title || '').slice(0, 80), day: todayK(),
            due: 0, taken: 0, pending: [], week: [], pct: -1, low: [], alerts: [] };
        if (sch && window.dosesForDay) {
            const doses = dosesForDay(sch, todayK());
            const ticks = (sch.ticks && sch.ticks[todayK()]) || {};
            out.due = doses.length;
            out.taken = doses.filter(d => ticks[d.id]).length;
            out.pending = doses.filter(d => !ticks[d.id]).slice(0, 20).map(d => ({ m: `${d.medicine} ${d.strength || ''}`.trim().slice(0, 60), s: d.slot || 'unclear' }));
        }
        if (window.NxCare) {
            const a = NxCare.adherence(7);
            if (a) { out.week = a.days.map(d => ({ d: d.day, due: d.due, taken: d.taken })); out.pct = a.pct == null ? -1 : a.pct; }
            out.low = NxCare.refills().filter(r => r.low).map(r => `${r.name} (${r.daysLeft}d)`.slice(0, 60)).slice(0, 10);
            out.alerts = NxCare.urgentReadings().map(x => x.split('.')[0].slice(0, 140)).slice(0, 3);
        }
        const since = Date.now() - 3 * 86400000;
        (storeGet('neutrixSymptoms') || []).filter(s => new Date(s.at).getTime() >= since && (s.severity === 'severe' || /chest pain|breathless|faint|bleeding|weakness/i.test(s.symptoms.join(' '))))
            .slice(-3).forEach(s => out.alerts.push(`${s.symptoms.join(', ')} (${s.severity}, ${new Date(s.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`.slice(0, 140)));
        out.alerts = out.alerts.slice(0, 5);
        return out;
    }

    let timer = null;
    function update() {
        const share = storeGet('neutrixShare');
        if (!share || !share.code) return Promise.resolve(false);
        clearTimeout(timer);
        return new Promise(resolve => {
            timer = setTimeout(async () => {
                try {
                    const { db: d, user } = await db();
                    await d.collection('shares').doc(share.code).set({ ...summary(), owner: user.uid, v: 1, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    resolve(true);
                } catch (e) { console.warn('[family] update', e); resolve(false); }
            }, 800);
        });
    }
    async function start() {
        const { db: d, user } = await db();
        const code = newCode();
        await d.collection('shares').doc(code).set({ ...summary(), owner: user.uid, v: 1, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        storeSet('neutrixShare', { code, since: new Date().toISOString() });
        return code;
    }
    async function stop() {
        const share = storeGet('neutrixShare');
        if (share && share.code) {
            try { const { db: d } = await db(); await d.collection('shares').doc(share.code).delete(); } catch (e) { console.warn('[family] stop', e); }
        }
        try { localStorage.removeItem('neutrixShare'); } catch (e) {}
    }
    async function read(code) {
        const { db: d } = await db();
        const snap = await d.collection('shares').doc(cleanCode(code)).get();
        return snap.exists ? snap.data() : null;
    }
    // People I look after (on this device, for this account)
    const watching = () => { try { return JSON.parse(localStorage.getItem('neutrixWatching') || '[]'); } catch (e) { return []; } };
    const setWatching = list => { try { localStorage.setItem('neutrixWatching', JSON.stringify(list.slice(0, 10))); } catch (e) {} };

    window.NxFamily = { update, start, stop, read, summary, watching, setWatching, fmtCode, cleanCode };
    // keep the shared copy fresh whenever a page with it opens
    if (storeGet('neutrixShare')) setTimeout(update, 1500);
})();
