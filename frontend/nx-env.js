// nx-env.js: weather and air-quality alerts tailored to the conditions in the patient's reports.
// Data: Open-Meteo (free, no key): https://open-meteo.com (weather + air quality, CC BY 4.0).
// The place comes from the device location (only when the person taps "Use my location") or a town they type.
// Advice only ("consider walking indoors today"), never medical orders. Fixed rules, no AI.
//   NxEnv.render(box, {compact})   draws the alerts (or the place setup) into box
(function () {
    if (window.NxEnv) return;
    const PLACE = 'neutrixEnvPlace', CACHE = 'nxEnvCache';
    const TTL = 60 * 60 * 1000;                                       // refresh at most once an hour
    const C = () => window.NxCare;
    const L = (en, ml) => (C() ? C().L(en, ml) : en);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

    async function fetchJson(url) {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
        try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
        finally { clearTimeout(t); }
    }
    async function load(force) {
        const p = get(PLACE);
        if (!p) return null;
        const c = get(CACHE);
        const fresh = c && c.lat === p.lat && c.lon === p.lon && Date.now() - c.at < TTL;
        if (fresh && !force) return c;
        if (!navigator.onLine) return c && c.lat === p.lat ? { ...c, stale: true } : null;
        try {
            const [w, a] = await Promise.all([
                fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature&daily=temperature_2m_max,apparent_temperature_max,temperature_2m_min&timezone=auto&forecast_days=1`),
                fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}&longitude=${p.lon}&current=us_aqi,pm2_5&timezone=auto`).catch(() => null)
            ]);
            const out = { lat: p.lat, lon: p.lon, at: Date.now(),
                temp: w.current && w.current.temperature_2m, feels: w.current && w.current.apparent_temperature, hum: w.current && w.current.relative_humidity_2m,
                max: w.daily && w.daily.temperature_2m_max && w.daily.temperature_2m_max[0], feelsMax: w.daily && w.daily.apparent_temperature_max && w.daily.apparent_temperature_max[0],
                min: w.daily && w.daily.temperature_2m_min && w.daily.temperature_2m_min[0],
                aqi: a && a.current ? a.current.us_aqi : null, pm25: a && a.current ? a.current.pm2_5 : null };
            set(CACHE, out);
            return out;
        } catch (e) {
            console.warn('[env]', e);
            return c && c.lat === p.lat ? { ...c, stale: true } : null;
        }
    }

    // ---------- rules ----------
    function conds() {
        const keys = new Set();
        try { (C() ? C().conditions() : []).forEach(c => keys.add(c.key)); } catch (e) {}
        return keys;
    }
    function aqiWord(v) {
        if (v == null) return '';
        if (v <= 50) return L('Good', 'നല്ലത്');
        if (v <= 100) return L('Moderate', 'മിതം');
        if (v <= 150) return L('Unhealthy for sensitive people', 'സെൻസിറ്റീവ് ആളുകൾക്ക് ദോഷകരം');
        if (v <= 200) return L('Unhealthy', 'ദോഷകരം');
        return L('Very unhealthy', 'വളരെ ദോഷകരം');
    }
    function alerts(d) {
        const k = conds(), out = [];
        if (!d) return out;
        const lungHeart = k.has('lungs') || k.has('heart') || k.has('hf') || k.has('stroke');
        const heatRisk = k.has('heart') || k.has('hf') || k.has('kidney') || k.has('diabetes') || k.has('stroke') || k.has('bp');
        const why = [];
        if (k.has('lungs')) why.push(L('your lungs', 'നിങ്ങളുടെ ശ്വാസകോശം'));
        if (k.has('heart') || k.has('hf')) why.push(L('your heart', 'നിങ്ങളുടെ ഹൃദയം'));
        if (k.has('stroke')) why.push(L('your stroke recovery', 'സ്ട്രോക്കിൽ നിന്നുള്ള വീണ്ടെടുപ്പ്'));
        if (k.has('kidney')) why.push(L('your kidneys', 'നിങ്ങളുടെ വൃക്കകൾ'));
        if (k.has('diabetes')) why.push(L('your diabetes', 'നിങ്ങളുടെ പ്രമേഹം'));
        const forYou = why.length ? L(` (because of ${why.join(', ')})`, ` (${why.join(', ')} കാരണം)`) : '';

        // air quality
        const aqi = d.aqi;
        if (aqi != null && (aqi > 150 || (aqi > 100 && lungHeart))) {
            out.push({ level: aqi > 150 ? 'red' : 'amber', icon: '😷',
                title: L(`Air quality is ${aqiWord(aqi).toLowerCase()} today (AQI ${Math.round(aqi)})`, `ഇന്ന് വായു ഗുണനിലവാരം ${aqiWord(aqi)} (AQI ${Math.round(aqi)})`),
                text: L(`Consider skipping the outdoor walk today and walking indoors instead${forYou}. Keep windows closed when the air is smoky.${k.has('lungs') ? ' Keep your inhaler with you.' : ''}`,
                    `ഇന്ന് പുറത്തെ നടത്തം ഒഴിവാക്കി വീട്ടിനുള്ളിൽ നടക്കുന്നത് പരിഗണിക്കുക${forYou}. പുക ഉള്ളപ്പോൾ ജനലുകൾ അടച്ചിടുക.${k.has('lungs') ? ' ഇൻഹേലർ കൂടെ കരുതുക.' : ''}`) });
        }
        // heat (feels-like matters more than the thermometer in humid Kerala)
        const feels = Math.max(d.feels ?? -99, d.feelsMax ?? -99);
        if (feels >= 41 || (feels >= 38 && heatRisk)) {
            const fluids = k.has('hf')
                ? L(' Drink water, but keep to the daily fluid limit your doctor gave you for heart failure.', ' വെള്ളം കുടിക്കുക, പക്ഷേ ഹാർട്ട് ഫെയിലറിന് ഡോക്ടർ പറഞ്ഞ ദിവസ പരിധി പാലിക്കുക.')
                : k.has('kidney') ? L(' Drink water as your doctor advised for your kidneys.', ' വൃക്കകൾക്ക് ഡോക്ടർ പറഞ്ഞ അളവിൽ വെള്ളം കുടിക്കുക.')
                : L(' Drink water through the day.', ' ദിവസം മുഴുവൻ വെള്ളം കുടിക്കുക.');
            out.push({ level: feels >= 41 ? 'red' : 'amber', icon: '🥵',
                title: L(`Very hot today: feels like ${Math.round(feels)}°C`, `ഇന്ന് വളരെ ചൂട്: ${Math.round(feels)}°C പോലെ`),
                text: L(`Walk early in the morning or after sunset, and rest in the shade${forYou}.`, `രാവിലെ നേരത്തെയോ സൂര്യാസ്തമയത്തിന് ശേഷമോ നടക്കുക, തണലിൽ വിശ്രമിക്കുക${forYou}.`) + fluids +
                    L(' Dizziness, confusion or chest pain in the heat needs help at once.', ' ചൂടിൽ തലകറക്കം, ആശയക്കുഴപ്പം, നെഞ്ചുവേദന ഉണ്ടെങ്കിൽ ഉടൻ സഹായം തേടുക.') });
        } else if ((d.hum ?? 0) >= 80 && (d.temp ?? 0) >= 31 && heatRisk) {
            out.push({ level: 'amber', icon: '💧',
                title: L(`Hot and humid today (${Math.round(d.temp)}°C, ${Math.round(d.hum)}% humidity)`, `ഇന്ന് ചൂടും ഈർപ്പവും (${Math.round(d.temp)}°C, ${Math.round(d.hum)}%)`),
                text: L(`Sweat cools you less in humid air. Keep walks short and slow, and rest if you feel tired or dizzy${forYou}.`, `ഈർപ്പമുള്ള വായുവിൽ ശരീരം തണുക്കുന്നത് കുറവാണ്. നടത്തം ചെറുതാക്കുക, ക്ഷീണം തോന്നിയാൽ വിശ്രമിക്കുക${forYou}.`) });
        }
        // cold mornings (hill areas): raises blood pressure and strain on the heart
        if ((d.min ?? 99) <= 10 && (k.has('heart') || k.has('hf') || k.has('bp') || k.has('stroke'))) {
            out.push({ level: 'amber', icon: '🧣', title: L(`Cold morning (${Math.round(d.min)}°C)`, `തണുത്ത രാവിലെ (${Math.round(d.min)}°C)`),
                text: L(`Cold can raise blood pressure and strain the heart. Dress warmly and walk later in the day${forYou}.`, `തണുപ്പ് രക്തസമ്മർദ്ദം കൂട്ടാം. ചൂടുള്ള വസ്ത്രം ധരിച്ച് പകൽ വൈകി നടക്കുക${forYou}.`) });
        }
        return out;
    }

    // ---------- place ----------
    async function useLocation() {
        return new Promise((res, rej) => {
            if (!navigator.geolocation) return rej(new Error('no geolocation'));
            navigator.geolocation.getCurrentPosition(async pos => {
                const lat = +pos.coords.latitude.toFixed(2), lon = +pos.coords.longitude.toFixed(2);  // town-level, not the exact house
                set(PLACE, { name: L('Your location', 'നിങ്ങളുടെ സ്ഥലം'), lat, lon });
                res();
            }, rej, { maximumAge: 3600000, timeout: 15000 });
        });
    }
    async function findTown(q) {
        const d = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
        const r = d && d.results && d.results[0];
        if (!r) return false;
        set(PLACE, { name: [r.name, r.admin1].filter(Boolean).join(', '), lat: +r.latitude.toFixed(2), lon: +r.longitude.toFixed(2) });
        return true;
    }

    // ---------- drawing ----------
    function setupHtml(compact) {
        return `<div class="nxe-setup${compact ? ' compact' : ''}"><div><b>🌤️ ${esc(L('Weather and air alerts for your health', 'നിങ്ങളുടെ ആരോഗ്യത്തിന് കാലാവസ്ഥ, വായു മുന്നറിയിപ്പുകൾ'))}</b>
            <p>${esc(L('Get a heads-up on bad air or heat that matters for your condition. Only your town is used, never your exact address.', 'നിങ്ങളുടെ രോഗത്തിന് പ്രധാനമായ മോശം വായു, ചൂട് എന്നിവയെക്കുറിച്ച് അറിയിപ്പ്. പട്ടണം മാത്രം ഉപയോഗിക്കുന്നു, കൃത്യമായ വിലാസം അല്ല.'))}</p></div>
            <div class="nxe-row"><button type="button" class="btn-secondary nxe-loc">📍 ${esc(L('Use my location', 'എന്റെ സ്ഥലം ഉപയോഗിക്കുക'))}</button>
            <form class="nxe-town"><input type="text" class="nxe-q" placeholder="${esc(L('or type your town, e.g. Kochi', 'അല്ലെങ്കിൽ പട്ടണം, ഉദാ. Kochi'))}" aria-label="${esc(L('Town', 'പട്ടണം'))}"><button type="submit" class="btn-secondary">${esc(L('Set', 'ശരി'))}</button></form></div>
            <p class="nxe-msg" aria-live="polite"></p></div>`;
    }
    function wire(box, opts) {
        const msg = box.querySelector('.nxe-msg');
        const loc = box.querySelector('.nxe-loc');
        if (loc) loc.addEventListener('click', async () => {
            msg.textContent = L('Finding your town…', 'പട്ടണം കണ്ടെത്തുന്നു…');
            try { await useLocation(); render(box, opts, true); }
            catch (e) { msg.textContent = L('Location is off or blocked. Type your town instead.', 'ലൊക്കേഷൻ ഓഫാണ്. പട്ടണത്തിന്റെ പേര് ടൈപ്പ് ചെയ്യുക.'); }
        });
        const f = box.querySelector('.nxe-town');
        if (f) f.addEventListener('submit', async e => {
            e.preventDefault();
            const q = f.querySelector('.nxe-q').value.trim();
            if (!q) return;
            msg.textContent = L('Looking it up…', 'തിരയുന്നു…');
            try { if (await findTown(q)) render(box, opts, true); else msg.textContent = L('Town not found. Try a nearby bigger town.', 'പട്ടണം കണ്ടില്ല. അടുത്തുള്ള വലിയ പട്ടണം നോക്കുക.'); }
            catch (err) { msg.textContent = L('Could not look it up. Check the internet and try again.', 'തിരയാനായില്ല. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.'); }
        });
        const ch = box.querySelector('.nxe-change');
        if (ch) ch.addEventListener('click', () => { try { localStorage.removeItem(PLACE); } catch (e) {} box.innerHTML = setupHtml(opts.compact); wire(box, opts); });
    }
    async function render(box, opts = {}, force) {
        if (!box) return;
        const p = get(PLACE);
        if (!p) {
            if (opts.compact) { box.innerHTML = ''; return; }         // dashboard: set up from My Care
            box.innerHTML = setupHtml(false); wire(box, opts); return;
        }
        const d = await load(force);
        const list = alerts(d);
        if (opts.compact) {
            box.innerHTML = list.map(a => `<div class="nxc-banner ${a.level}"><span>${a.icon} ${esc(a.title)}. ${esc(a.text)}</span><a class="btn-secondary" href="care.html#careEnv">${esc(L('More', 'കൂടുതൽ'))}</a></div>`).join('');
            return;
        }
        const when = d ? new Date(d.at).toLocaleTimeString(L('en-IN', 'ml-IN'), { hour: 'numeric', minute: '2-digit' }) : '';
        const now = d ? [d.temp != null ? `🌡️ ${Math.round(d.temp)}°C${d.feels != null ? ` (${L('feels', 'അനുഭവം')} ${Math.round(d.feels)}°C)` : ''}` : '', d.hum != null ? `💧 ${Math.round(d.hum)}%` : '',
            d.aqi != null ? `🌫️ AQI ${Math.round(d.aqi)} · ${aqiWord(d.aqi)}` : ''].filter(Boolean).join('   ') : '';
        box.innerHTML = `<div class="card-header"><div><h2>🌤️ ${esc(L('Weather and air today', 'ഇന്നത്തെ കാലാവസ്ഥയും വായുവും'))}</h2>
                <p class="subtitle">${esc(p.name)}${when ? ' · ' + esc(L('updated', 'പുതുക്കിയത്')) + ' ' + esc(when) : ''}${d && d.stale ? ' · ' + esc(L('offline, last saved', 'ഓഫ്‌ലൈൻ, അവസാനം സേവ് ചെയ്തത്')) : ''}</p></div>
                <button type="button" class="btn-secondary nxe-change">${esc(L('Change place', 'സ്ഥലം മാറ്റുക'))}</button></div>
            ${now ? `<div class="nxe-now">${esc(now)}</div>` : `<p class="hint">${esc(L('Could not get the weather right now.', 'ഇപ്പോൾ കാലാവസ്ഥ ലഭിച്ചില്ല.'))}</p>`}
            ${list.length ? list.map(a => `<div class="nxc-issue ${a.level === 'red' ? 'high' : ''}"><b>${a.icon} ${esc(a.title)}</b><p>${esc(a.text)}</p></div>`).join('')
                : d ? `<p class="nxc-ok-line">✅ ${esc(L('Nothing in today’s weather or air needs extra care for your conditions.', 'ഇന്നത്തെ കാലാവസ്ഥയിലും വായുവിലും നിങ്ങളുടെ രോഗങ്ങൾക്ക് പ്രത്യേക ശ്രദ്ധ വേണ്ട ഒന്നുമില്ല.'))}</p>` : ''}
            <p class="nxe-credit">${esc(L('Weather and air data: ', 'കാലാവസ്ഥ ഡാറ്റ: '))}<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>. ${esc(L('General advice only. Follow your doctor’s advice first.', 'പൊതുവായ ഉപദേശം മാത്രം. ഡോക്ടറുടെ ഉപദേശം ആദ്യം.'))}</p>`;
        wire(box, opts);
    }
    window.NxEnv = { render, alerts, load };
})();
