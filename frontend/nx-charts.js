// =====================================================
// nx-charts.js — small SVG charts for the chat ("show me a chart of my BP")
// The AI answers with a ```chart {json}``` block; NxCharts.render(spec) turns it into an SVG.
// spec: { type: 'line'|'bar'|'pie', title, unit, labels: [...], series: [{ name, values: [...] }] }
// =====================================================
(function () {
    const COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#16a34a', '#e11d48', '#64748b'];
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);

    function niceMax(v) {
        if (v <= 0) return 1;
        const p = Math.pow(10, Math.floor(Math.log10(v)));
        const n = v / p;
        return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
    }
    function fmt(v) { return Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1); }

    function legend(series) {
        if (series.length < 2) return '';
        return `<div class="nxc-legend">${series.map((s, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(s.name)}</span>`).join('')}</div>`;
    }

    function axisChart(spec, kind) {
        const labels = (spec.labels || []).map(String);
        const series = (spec.series || []).map(s => ({ name: s.name || '', values: (s.values || []).map(num) })).filter(s => s.values.some(v => v !== null));
        if (!labels.length || !series.length) return null;
        const W = 340, H = 200, L = 40, R = 10, T = 12, B = 34;
        const all = series.flatMap(s => s.values).filter(v => v !== null);
        let lo = Math.min(...all), hi = Math.max(...all);
        if (kind === 'bar') lo = Math.min(0, lo);
        else { const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1; lo = lo - pad; hi = hi + pad; if (Math.min(...all) >= 0) lo = Math.max(0, lo); }
        const top = kind === 'bar' ? niceMax(hi) : hi;
        const y = v => T + (H - T - B) * (1 - (v - lo) / ((top - lo) || 1));
        const n = labels.length;
        const step = (W - L - R) / n;
        const xMid = i => L + step * (i + 0.5);
        let g = '';
        // grid + y labels
        for (let k = 0; k <= 4; k++) {
            const v = lo + (top - lo) * k / 4;
            const yy = y(v);
            g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="nxc-grid"/><text x="${L - 6}" y="${yy + 3}" text-anchor="end" class="nxc-axis">${fmt(v)}</text>`;
        }
        // x labels (skip some when crowded)
        const every = Math.ceil(n / 7);
        labels.forEach((lab, i) => {
            if (i % every && i !== n - 1) return;
            g += `<text x="${xMid(i)}" y="${H - B + 16}" text-anchor="middle" class="nxc-axis">${esc(lab.length > 9 ? lab.slice(0, 8) + '…' : lab)}</text>`;
        });
        if (kind === 'bar') {
            const bw = Math.max(4, (step * 0.7) / series.length);
            series.forEach((s, si) => s.values.forEach((v, i) => {
                if (v === null) return;
                const x = xMid(i) - (bw * series.length) / 2 + si * bw;
                const y0 = y(Math.max(0, lo)), y1 = y(v);
                g += `<rect x="${x}" y="${Math.min(y0, y1)}" width="${bw - 1}" height="${Math.max(1, Math.abs(y0 - y1))}" rx="2" fill="${COLORS[si % COLORS.length]}"><title>${esc(s.name)} ${esc(labels[i])}: ${fmt(v)}${esc(spec.unit ? ' ' + spec.unit : '')}</title></rect>`;
            }));
        } else {
            series.forEach((s, si) => {
                const c = COLORS[si % COLORS.length];
                let d = '', pen = false;
                s.values.forEach((v, i) => {
                    if (v === null) { pen = false; return; }
                    d += `${pen ? 'L' : 'M'}${xMid(i).toFixed(1)},${y(v).toFixed(1)} `;
                    pen = true;
                });
                g += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
                s.values.forEach((v, i) => {
                    if (v === null) return;
                    g += `<circle cx="${xMid(i)}" cy="${y(v)}" r="3.5" fill="${c}"><title>${esc(s.name)} ${esc(labels[i])}: ${fmt(v)}${esc(spec.unit ? ' ' + spec.unit : '')}</title></circle>`;
                });
            });
        }
        return `<svg viewBox="0 0 ${W} ${H}" class="nxc-svg" role="img" aria-label="${esc(spec.title || 'Chart')}">${g}</svg>${legend(series)}`;
    }

    function pieChart(spec) {
        const labels = (spec.labels || []).map(String);
        const values = ((spec.series || [])[0] || {}).values || [];
        const items = labels.map((l, i) => ({ l, v: num(values[i]) })).filter(x => x.v && x.v > 0);
        const total = items.reduce((a, x) => a + x.v, 0);
        if (!items.length || !total) return null;
        const R = 70, C = 80;
        let a0 = -Math.PI / 2, g = '';
        items.forEach((it, i) => {
            const a1 = a0 + (it.v / total) * Math.PI * 2;
            const large = a1 - a0 > Math.PI ? 1 : 0;
            const p = (a) => `${(C + R * Math.cos(a)).toFixed(1)},${(C + R * Math.sin(a)).toFixed(1)}`;
            g += items.length === 1
                ? `<circle cx="${C}" cy="${C}" r="${R}" fill="${COLORS[i % COLORS.length]}"/>`
                : `<path d="M${C},${C} L${p(a0)} A${R},${R} 0 ${large} 1 ${p(a1)} Z" fill="${COLORS[i % COLORS.length]}"><title>${esc(it.l)}: ${fmt(it.v)}</title></path>`;
            a0 = a1;
        });
        const leg = items.map((it, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(it.l)}: ${fmt(it.v)} (${Math.round(it.v / total * 100)}%)</span>`).join('');
        return `<div class="nxc-pie"><svg viewBox="0 0 160 160" class="nxc-svg pie" role="img" aria-label="${esc(spec.title || 'Chart')}">${g}</svg><div class="nxc-legend col">${leg}</div></div>`;
    }

    function render(spec) {
        if (!spec || typeof spec !== 'object') return null;
        const type = String(spec.type || 'line').toLowerCase();
        const body = type === 'pie' ? pieChart(spec) : axisChart(spec, type === 'bar' ? 'bar' : 'line');
        if (!body) return null;
        return `<figure class="nxc"><figcaption>${esc(spec.title || '')}${spec.unit && type !== 'pie' ? ` <small>(${esc(spec.unit)})</small>` : ''}</figcaption>${body}</figure>`;
    }

    // Replace ```chart {...}``` blocks in an AI answer: returns { text (with placeholders), charts: [html] }
    function extract(text) {
        const charts = [];
        const out = String(text || '').replace(/```chart\s*([\s\S]*?)```/g, (m, json) => {
            let html = null;
            try { html = render(JSON.parse(json.trim())); } catch (e) { html = null; }
            if (!html) return '';
            charts.push(html);
            return `\n\nNXCHART${charts.length - 1}\n\n`;
        });
        return { text: out, charts };
    }

    const style = document.createElement('style');
    style.textContent = `
        .nxc { margin: 8px 0; padding: 10px; border: 1px solid var(--border-color, #e5e3df); border-radius: 12px; background: var(--card-bg, #fff); }
        .nxc figcaption { font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text-primary, #191919); }
        .nxc figcaption small { font-weight: 500; color: var(--text-muted, #999); }
        .nxc-svg { width: 100%; height: auto; display: block; }
        .nxc-svg.pie { width: 140px; flex-shrink: 0; }
        .nxc-grid { stroke: var(--border-color, #e5e3df); stroke-width: 1; }
        .nxc-axis { font-size: 9.5px; fill: var(--text-muted, #888); font-family: inherit; }
        .nxc-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--text-secondary, #666); margin-top: 4px; }
        .nxc-legend.col { flex-direction: column; }
        .nxc-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
        .nxc-pie { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    `;
    document.head.appendChild(style);

    window.NxCharts = { render, extract };
})();
