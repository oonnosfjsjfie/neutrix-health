// Emergency Card: the emergency QR code as its own feature.
// Covers ALL the patient's medical issues. Shows what a stranger sees when they scan it, what is missing,
// and gives a lock-screen picture, a wallet card to print, and a link to share.
(function () {
    const C = window.NxCare, esc = C.esc, L = C.L;
    const E = window.NxEmergency;
    const $ = id => document.getElementById(id);
    const SAVED = 'neutrixEmergencySaved';      // the link last saved as a picture / printed (to spot changes)
    let cur = null;                              // { data, link, issues }

    const savedLink = () => { try { return localStorage.getItem(SAVED) || ''; } catch (e) { return ''; } };
    const markSaved = () => { try { localStorage.setItem(SAVED, cur.link); } catch (e) {} cur.lastSavedData = cur.data; paintStale(); };

    function paintStale() {
        const s = savedLink(), box = $('ecStale');
        if (!cur || !s) { box.hidden = true; return; }
        // Same details apart from the "updated" date? Then the saved copy is fine.
        const same = !!cur.lastSavedData && JSON.stringify({ ...cur.lastSavedData, u: 0 }) === JSON.stringify({ ...cur.data, u: 0 });
        box.hidden = same;
        box.innerHTML = `⚠️ ${esc(L('Your details or medicines have changed since you last saved your lock-screen picture or wallet card. Save them again so they match.', 'ലോക്ക് സ്ക്രീൻ ചിത്രമോ വാലറ്റ് കാർഡോ സേവ് ചെയ്തതിന് ശേഷം വിവരങ്ങൾ മാറി. വീണ്ടും സേവ് ചെയ്യുക.'))}`;
    }

    async function decodeSaved() {
        const s = savedLink();
        const m = /#(z|j)\.(.+)$/.exec(s);
        if (!m) return null;
        try {
            let b = m[2].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
            let bytes = Uint8Array.from(atob(b), c => c.charCodeAt(0));
            if (m[1] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) { return null; }
    }

    function checklist(d, issues) {
        const p = E.profile();
        const has = v => v && !/^(not recorded|not provided|none recorded)$/i.test(String(v).trim());
        const issuesWithMeds = issues.filter(i => i.meds.length).length;
        const rows = [
            [has(d.n), L('Your name', 'നിങ്ങളുടെ പേര്'), 'profile.html?back=emergency-card.html'],
            [has(d.bg), L('Blood group', 'രക്തഗ്രൂപ്പ്'), 'profile.html?back=emergency-card.html'],
            [has(p.allergies), L('Allergies (write "None" if you have none)', 'അലർജി (ഇല്ലെങ്കിൽ "None" എന്ന് എഴുതുക)'), 'profile.html?back=emergency-card.html'],
            [has(d.a) || has(d.b), L('Age or date of birth', 'പ്രായം അല്ലെങ്കിൽ ജനനത്തീയതി'), 'profile.html?back=emergency-card.html'],
            [!!(d.cg && d.cg.p), L('Caregiver’s phone number', 'പരിചാരകന്റെ ഫോൺ നമ്പർ'), 'profile.html?back=emergency-card.html'],
            [issues.length > 0, issues.length ? L(`Medical issues: ${issues.length} (all included)`, `ആരോഗ്യ പ്രശ്നങ്ങൾ: ${issues.length} (എല്ലാം ഉൾപ്പെടുത്തി)`) : L('Medical issues', 'ആരോഗ്യ പ്രശ്നങ്ങൾ'), 'issues.html'],
            [!!(d.m && d.m.length), d.m && d.m.length ? L(`Daily medicines: ${d.m.length}, from ${issuesWithMeds} issue${issuesWithMeds === 1 ? '' : 's'}`, `ദിവസേനയുള്ള മരുന്നുകൾ: ${d.m.length}`) : L('Daily medicines (upload a report with medicines)', 'ദിവസേനയുള്ള മരുന്നുകൾ (മരുന്നുകളുള്ള റിപ്പോർട്ട് അപ്‌ലോഡ് ചെയ്യുക)'), 'issues.html']
        ];
        const missing = rows.filter(r => !r[0]).length;
        $('ecCheckTitle').textContent = missing ? L(`What’s on your card (${missing} missing)`, `കാർഡിലുള്ളത് (${missing} ഇല്ല)`) : L('What’s on your card ✓ complete', 'കാർഡിലുള്ളത് ✓ പൂർണ്ണം');
        $('ecCheck').innerHTML = rows.map(([ok, label, href]) => `<li class="${ok ? 'ok' : 'miss'}"><span class="ec-tick" aria-hidden="true">${ok ? '✓' : '!'}</span><span>${esc(label)}</span>${ok ? '' : `<a href="${href}">${esc(L('Add', 'ചേർക്കുക'))}</a>`}</li>`).join('');
    }

    function alerts(d) {
        const W = { bleed: ['🩸', L('Takes blood thinners', 'രക്തം നേർപ്പിക്കുന്ന മരുന്ന്')], sugar: ['🍬', L('Medicine that can cause low sugar', 'ഷുഗർ കുറയ്ക്കാവുന്ന മരുന്ന്')], device: ['🫀', L('Implant', 'ശരീരത്തിലെ ഉപകരണം')] };
        $('ecAlertTitle').textContent = L('Warnings shown to the person who scans', 'സ്കാൻ ചെയ്യുന്നയാൾക്ക് കാണിക്കുന്ന മുന്നറിയിപ്പുകൾ');
        const list = (d.w || []).filter(x => W[x[0]]);
        $('ecAlerts').innerHTML = list.length
            ? list.map(([k, v]) => `<div class="ec-alert"><span aria-hidden="true">${W[k][0]}</span><div><b>${esc(W[k][1])}</b><small>${esc(v)}</small></div></div>`).join('')
            : `<p class="hint">${esc(L('None found in your medicines and reports.', 'നിങ്ങളുടെ മരുന്നുകളിലും റിപ്പോർട്ടുകളിലും ഒന്നും കണ്ടില്ല.'))}</p>`;
    }

    // ---------- Lock-screen picture (PNG) ----------
    function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function fitText(ctx, text, max, size, weight, family) {
        let s = size;
        do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > max && s > 20);
        return text;
    }
    function drawQr(ctx, link, x, y, size) {
        const q = E.qr(link), n = q.getModuleCount(), quiet = 4, cell = size / (n + quiet * 2);
        ctx.fillStyle = '#fff'; roundRect(ctx, x - 24, y - 24, size + 48, size + 48, 36); ctx.fill();
        ctx.fillStyle = '#000';
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c))
            ctx.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
    }
    function wallpaper() {
        const d = cur.data, W = 1080, H = 2340, F = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#000'); g.addColorStop(1, '#120406');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        // the top ~third stays empty for the phone's clock
        let y = 780;
        ctx.fillStyle = '#ff4d5e'; ctx.font = `800 40px ${F}`; ctx.fillText('EMERGENCY MEDICAL INFO', W / 2, y);
        y += 90; ctx.fillStyle = '#fff'; fitText(ctx, d.n || 'Patient', 900, 76, 700, 'Georgia, "Source Serif 4", serif'); ctx.fillText(d.n || 'Patient', W / 2, y);
        y += 70; ctx.font = `600 40px ${F}`; ctx.fillStyle = '#d4d4d4';
        const line = [d.bg ? 'Blood ' + d.bg : '', d.a ? d.a + ' yrs' : ''].filter(Boolean).join('  ·  ');
        if (line) { ctx.fillText(line, W / 2, y); y += 60; }
        const al = String(d.al || '').trim();
        if (al && !/^(none|nil|not recorded|no known)/i.test(al)) {
            ctx.fillStyle = '#ff8a95'; const t = 'Allergic: ' + al; fitText(ctx, t, 940, 40, 700, F); ctx.fillText(t, W / 2, y); y += 60;
        }
        if ((d.w || []).some(x => x[0] === 'bleed')) { ctx.fillStyle = '#fbbf24'; ctx.font = `700 36px ${F}`; ctx.fillText('Takes blood thinners', W / 2, y); y += 56; }
        const size = 600;
        y += 50; drawQr(ctx, cur.link, (W - size) / 2, y, size);
        y += size + 24 + 80;
        ctx.fillStyle = '#fff'; ctx.font = `700 42px ${F}`; ctx.fillText('Scan with any phone camera', W / 2, y);
        y += 56; ctx.fillStyle = '#a3a3a3'; ctx.font = `500 34px ${F}`; ctx.fillText('Medicines, conditions and who to call', W / 2, y);
        y += 80; ctx.fillStyle = '#ff4d5e'; ctx.font = `800 44px ${F}`;
        const call = 'Ambulance 108' + (d.cg && d.cg.p ? `  ·  ${d.cg.n ? d.cg.n.split(' ')[0] + ' ' : ''}${d.cg.p}` : '');
        fitText(ctx, call, 960, 44, 800, F); ctx.fillText(call, W / 2, y);
        return cv;
    }
    function savePng() {
        const cv = wallpaper();
        const name = (cur.data.n || 'patient').replace(/[^a-z0-9]+/gi, '-');
        cv.toBlob(async blob => {
            const file = new File([blob], `Neutrix-emergency-${name}.png`, { type: 'image/png' });
            // On phones, the share sheet has "Save image"; elsewhere, download it
            if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
                try { await navigator.share({ files: [file], title: 'Emergency medical info' }); markSaved(); return; } catch (e) { if (e && e.name === 'AbortError') return; }
            }
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            markSaved();
        }, 'image/png');
    }

    // ---------- Wallet card (credit-card size, front and back) ----------
    function printWallet() {
        const d = cur.data;
        const al = String(d.al || '').trim();
        const bleed = (d.w || []).find(x => x[0] === 'bleed');
        const dev = (d.w || []).find(x => x[0] === 'device');
        $('ecWalletPrint').innerHTML = `
            <div class="ecw-card ecw-front">
                <div class="ecw-pill">EMERGENCY MEDICAL INFO</div>
                <div class="ecw-name">${esc(d.n || '')}</div>
                <div class="ecw-row"><b>Blood:</b> ${esc(d.bg || '—')}${d.a ? ` &nbsp; <b>Age:</b> ${esc(d.a)}` : ''}</div>
                <div class="ecw-row ecw-red"><b>Allergies:</b> ${esc(al || 'Not recorded')}</div>
                ${bleed ? `<div class="ecw-row"><b>Blood thinners:</b> ${esc(bleed[1])}</div>` : ''}
                ${dev ? `<div class="ecw-row"><b>Implant:</b> ${esc(dev[1])}</div>` : ''}
                ${d.cg && d.cg.p ? `<div class="ecw-row"><b>Call:</b> ${esc(d.cg.n || '')} ${esc(d.cg.p)}</div>` : ''}
                <div class="ecw-108">Emergency: 108 / 112</div>
            </div>
            <div class="ecw-card ecw-back">${E.qrSvg(cur.link)}<div>Scan for conditions, all medicines and contacts</div></div>`;
        document.body.classList.add('ec-printing');
        const done = () => { document.body.classList.remove('ec-printing'); removeEventListener('afterprint', done); };
        addEventListener('afterprint', done);
        window.print();
        setTimeout(done, 1500);
        markSaved();
    }

    async function share() {
        const url = cur.link;
        if (navigator.share) { try { await navigator.share({ title: 'Emergency medical info', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
        try { await navigator.clipboard.writeText(url); $('ecShare').textContent = '✓ ' + L('Link copied', 'ലിങ്ക് പകർത്തി'); setTimeout(paintButtons, 2000); } catch (e) {}
    }

    function paintButtons() {
        $('ecQrTitle').textContent = L('Your emergency QR code', 'നിങ്ങളുടെ എമർജൻസി QR കോഡ്');
        $('ecWall').textContent = '📱 ' + L('Save lock-screen picture', 'ലോക്ക് സ്ക്രീൻ ചിത്രം സേവ് ചെയ്യുക');
        $('ecWallet').textContent = '🪪 ' + L('Print wallet card', 'വാലറ്റ് കാർഡ് പ്രിന്റ് ചെയ്യുക');
        $('ecShare').textContent = '🔗 ' + L('Share link', 'ലിങ്ക് പങ്കിടുക');
        $('ecOpen').textContent = '👁 ' + L('Open the card', 'കാർഡ് തുറക്കുക');
        $('ecPrevTitle').textContent = L('What someone sees when they scan it', 'സ്കാൻ ചെയ്യുമ്പോൾ കാണുന്നത്');
        $('ecPrivacy').textContent = L('Everything is inside the QR code itself, not stored online. Anyone who scans it can read it, so it only has what helps in an emergency, not your reports.', 'എല്ലാം QR കോഡിനുള്ളിൽ തന്നെയാണ്, ഓൺലൈനിൽ സൂക്ഷിക്കുന്നില്ല. സ്കാൻ ചെയ്യുന്ന ആർക്കും വായിക്കാം, അതിനാൽ അടിയന്തര ഘട്ടത്തിൽ സഹായിക്കുന്നവ മാത്രമേ ഉള്ളൂ, റിപ്പോർട്ടുകളില്ല.');
        $('ecHowT').textContent = L('How to put it on your lock screen', 'ലോക്ക് സ്ക്രീനിൽ എങ്ങനെ വെക്കാം');
        $('ecHow').innerHTML = `<p><b>Android:</b> ${esc(L('Save the picture → open it in Gallery / Photos → ⋮ → Set as wallpaper → Lock screen.', 'ചിത്രം സേവ് ചെയ്യുക → ഗാലറിയിൽ തുറക്കുക → ⋮ → Set as wallpaper → Lock screen.'))}</p>
            <p><b>iPhone:</b> ${esc(L('Save the picture → Photos → Share → Use as Wallpaper. Also fill in Health app → Medical ID and turn on "Show When Locked".', 'ചിത്രം സേവ് ചെയ്യുക → Photos → Share → Use as Wallpaper. Health ആപ്പിലെ Medical ID-യും പൂരിപ്പിക്കുക.'))}</p>
            <p>${esc(L('Ambulance staff can then scan it without unlocking your phone.', 'ഫോൺ അൺലോക്ക് ചെയ്യാതെ തന്നെ ആംബുലൻസ് ജീവനക്കാർക്ക് സ്കാൻ ചെയ്യാം.'))}</p>`;
        $('ecNote').textContent = L('Save it again whenever your medicines change. This page will remind you.', 'മരുന്നുകൾ മാറുമ്പോൾ വീണ്ടും സേവ് ചെയ്യുക. ഈ പേജ് ഓർമ്മിപ്പിക്കും.');
    }

    async function render() {
        paintButtons();
        $('ecQr').innerHTML = `<p class="hint">${esc(L('Making the QR code…', 'QR കോഡ് ഉണ്ടാക്കുന്നു…'))}</p>`;
        cur = await E.build();
        cur.lastSavedData = await decodeSaved();
        window.__nxEmergencyLink = cur.link;
        let svg = '';
        try { svg = E.qrSvg(cur.link); } catch (e) { console.warn('[emergency card] QR', e); }
        $('ecQr').innerHTML = svg || `<p class="hint">${esc(L('Could not make the QR code.', 'QR കോഡ് ഉണ്ടാക്കാനായില്ല.'))}</p>`;
        $('ecOpen').href = cur.link;
        const fr = $('ecPreview');
        if (fr.getAttribute('src') !== cur.link) fr.src = cur.link;
        checklist(cur.data, cur.issues);
        alerts(cur.data);
        paintStale();
    }

    // Preview: a real 390px-wide phone screen, scaled to the frame
    const fitPreview = () => {
        const fr = $('ecPreview'), box = fr.parentElement;
        const k = box.clientWidth / 390;
        fr.style.transform = `scale(${k})`;
        fr.style.height = (box.clientHeight / k) + 'px';
    };
    if (window.ResizeObserver) new ResizeObserver(fitPreview).observe($('ecPreview').parentElement);
    addEventListener('resize', fitPreview, { passive: true });
    fitPreview();

    $('ecWall').addEventListener('click', () => cur && savePng());
    $('ecWallet').addEventListener('click', () => cur && printWallet());
    $('ecShare').addEventListener('click', () => cur && share());
    render();
    document.addEventListener('neutrix:langchange', render);
})();
