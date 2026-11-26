// =====================================================
// Neutrix 3D body: a holographic human body that shows which parts of the body the patient's report is about.
//
// - On opening: a "body scan" animation — the nervous system draws itself, the body forms, the organs appear
//   one by one, then the problem areas light up red with labels.
// - Reports page: a small one on the left; tap it to open the full 3D View (body3d.html).
// - 3D View: turn the body, zoom, tap a red area for a simple explanation (what happened, what may have caused
//   it, what the report says to do), and switch layers (nerves, organs, skin, blood vessels).
// - Which areas: the AI reads the report once (/api/body-map); the answer is saved with the issue and only asked
//   again when the report changes (or the language does). A simple word match is used if the AI isn't available.
// Built with three.js (loaded from a CDN, saved for offline use by sw.js).
// =====================================================
(function () {
    const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
    let THREE = null;
    const loadThree = async () => (THREE = THREE || await import(THREE_URL));
    const lang = () => (window.neutrixLang === 'Malayalam' ? 'Malayalam' : 'English');
    const ml = () => lang() === 'Malayalam';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------- words ----------
    const TXT = {
        English: {
            scan: 'NEUTRIX · BODY SCAN', s1: 'Mapping nervous system', s2: 'Building body', s3: 'Placing organs', s4: 'Reading your report',
            found: n => (n ? `${n} area${n > 1 ? 's' : ''} found` : 'No problem areas found'), tap: 'Tap to open 3D View',
            noReport: 'Upload a report to see your body map', what: 'What happened', cause: 'What may have caused it', fix: 'What your report says to do',
            high: 'Main problem', medium: 'Watch', low: 'Minor', listen: 'Listen', close: 'Close', overview: 'Your body map',
            layers: 'Layers', nerves: 'Nerves', organs: 'Organs', skin: 'Body', vessels: 'Blood vessels', replay: 'Replay scan', reset: 'Reset view',
            hint: 'Drag to turn · scroll or pinch to zoom · tap a red area to learn more', pick: 'Tap a red area (or one below) to learn more.',
            dismiss: 'Hide problem areas', showAreas: 'Show problem areas',
            loading: 'Reading your report…', aiOff: 'Simple match (AI not available right now)', disclaimer: 'A simple picture to help you understand your report — not a medical scan.'
        },
        Malayalam: {
            scan: 'NEUTRIX · ബോഡി സ്കാൻ', s1: 'നാഡീവ്യൂഹം', s2: 'ശരീരം', s3: 'അവയവങ്ങൾ', s4: 'റിപ്പോർട്ട് വായിക്കുന്നു',
            found: n => (n ? `${n} ഭാഗങ്ങൾ കണ്ടെത്തി` : 'പ്രശ്നമുള്ള ഭാഗങ്ങൾ ഇല്ല'), tap: '3D വ്യൂ തുറക്കാൻ ടാപ്പ് ചെയ്യുക',
            noReport: 'ബോഡി മാപ്പ് കാണാൻ ഒരു റിപ്പോർട്ട് അപ്‌ലോഡ് ചെയ്യുക', what: 'എന്താണ് സംഭവിച്ചത്', cause: 'കാരണം എന്തായിരിക്കാം', fix: 'റിപ്പോർട്ട് പറയുന്നത്',
            high: 'പ്രധാന പ്രശ്നം', medium: 'ശ്രദ്ധിക്കുക', low: 'ചെറുത്', listen: 'കേൾക്കുക', close: 'അടയ്ക്കുക', overview: 'നിങ്ങളുടെ ബോഡി മാപ്പ്',
            layers: 'ലെയറുകൾ', nerves: 'നാഡികൾ', organs: 'അവയവങ്ങൾ', skin: 'ശരീരം', vessels: 'രക്തക്കുഴലുകൾ', replay: 'വീണ്ടും സ്കാൻ', reset: 'റീസെറ്റ്',
            hint: 'തിരിക്കാൻ വലിക്കുക · സൂം ചെയ്യുക · ചുവന്ന ഭാഗം ടാപ്പ് ചെയ്യുക', pick: 'കൂടുതൽ അറിയാൻ ഒരു ചുവന്ന ഭാഗം ടാപ്പ് ചെയ്യുക.',
            dismiss: 'പ്രശ്ന ഭാഗങ്ങൾ മറയ്ക്കുക', showAreas: 'പ്രശ്ന ഭാഗങ്ങൾ കാണിക്കുക',
            loading: 'റിപ്പോർട്ട് വായിക്കുന്നു…', aiOff: 'ലളിതമായ പൊരുത്തം (AI ഇപ്പോൾ ലഭ്യമല്ല)', disclaimer: 'റിപ്പോർട്ട് മനസ്സിലാക്കാനുള്ള ലളിതമായ ചിത്രം — മെഡിക്കൽ സ്കാൻ അല്ല.'
        }
    };
    const tx = k => (TXT[lang()][k] !== undefined ? TXT[lang()][k] : TXT.English[k]);

    // ---------- body areas the model knows ----------
    const AREA_NAMES = {
        brain: ['Brain', 'തലച്ചോറ്'], eyes: ['Eyes', 'കണ്ണുകൾ'], thyroid: ['Thyroid', 'തൈറോയ്ഡ്'], heart: ['Heart', 'ഹൃദയം'],
        lungs: ['Lungs', 'ശ്വാസകോശം'], liver: ['Liver', 'കരൾ'], stomach: ['Stomach', 'ആമാശയം'], pancreas: ['Pancreas', 'പാൻക്രിയാസ്'],
        kidneys: ['Kidneys', 'വൃക്കകൾ'], intestines: ['Intestines', 'കുടൽ'], bladder: ['Bladder', 'മൂത്രസഞ്ചി'], reproductive: ['Reproductive organs', 'പ്രത്യുൽപാദന അവയവങ്ങൾ'],
        spine: ['Spine', 'നട്ടെല്ല്'], blood_vessels: ['Blood vessels', 'രക്തക്കുഴലുകൾ'], bones_joints: ['Bones & joints', 'എല്ലുകളും സന്ധികളും'], skin: ['Skin', 'ചർമ്മം']
    };
    const areaName = k => (AREA_NAMES[k] || [k, k])[ml() ? 1 : 0];

    // ---------- which areas: AI once per report (saved), simple word match as backup ----------
    function reportText() {
        try {
            const r = window.loadReport ? loadReport() : null;
            if (!r) return '';
            const sums = r.summaries || {};
            const summary = sums.English || sums.Malayalam || '';
            const full = window.fullReportText ? fullReportText(r) : '';
            return (summary + '\n\n' + full).trim().slice(0, 12000);
        } catch (e) { return ''; }
    }
    const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '-' + s.length; };
    const KEYWORDS = {
        heart: /\b(heart|cardiac|coronary|angina|myocard|infarct|nstemi|stemi|troponin|angiograph|angioplast|stent|ptca|cabg|bypass|arrhythm|atrial|ventric|valve|echocardio|ecg|ejection)/i,
        blood_vessels: /\b(hypertens|blood pressure|cholesterol|lipid|atherosc|arter|vascular|aneurysm|thrombo|dvt|varicose|circulation)/i,
        pancreas: /\b(diabet|hba1c|glucose|insulin|metformin|pancrea|sugar)/i,
        brain: /\b(stroke|brain|cerebr|seizure|epilep|migraine|dementia|parkinson|neuro)/i,
        lungs: /\b(lung|pulmon|asthma|copd|pneumon|bronch|respirat|tuberc|breath)/i,
        kidneys: /\b(kidney|renal|creatinine|nephr|dialysis|egfr|urea)/i,
        liver: /\b(liver|hepat|cirrho|fatty liver|bilirubin|gall ?bladder|gallstone)/i,
        stomach: /\b(stomach|gastr|ulcer|acidity|reflux|gerd|pantopra|omepra)/i,
        intestines: /\b(intestin|bowel|colon|appendi|crohn|colitis|ibs|hernia)/i,
        thyroid: /\b(thyroid|thyrox|tsh)/i,
        spine: /\b(spine|spinal|vertebr|disc|lumbar|cervical spondyl|sciatica|back pain)/i,
        bones_joints: /\b(fracture|bone|joint|knee|hip|arthrit|osteo|shoulder)/i,
        bladder: /\b(bladder|urinary|uti|prostat)/i,
        eyes: /\b(eye|retin|cataract|glaucoma|vision)/i,
        skin: /\b(skin|wound|dermat|rash|ulcer on)/i
    };
    function fallbackMap(text) {
        const areas = [];
        for (const [key, re] of Object.entries(KEYWORDS)) {
            if (re.test(text)) areas.push({ key, label: areaName(key), severity: areas.length ? 'medium' : 'high',
                what_happened: ml() ? 'നിങ്ങളുടെ റിപ്പോർട്ടിൽ ഈ ഭാഗത്തെക്കുറിച്ച് പറയുന്നുണ്ട്.' : 'Your report mentions this part of the body.',
                cause: ml() ? 'വിശദാംശങ്ങൾക്ക് റിപ്പോർട്ട് സംഗ്രഹം കാണുക.' : 'See your report summary for the details.',
                treatment: ml() ? 'ഡോക്ടറുടെ നിർദ്ദേശങ്ങൾ പാലിക്കുക.' : 'Follow the plan in your report and your doctor’s advice.' });
            if (areas.length >= 6) break;
        }
        return { overview: '', areas, simple: true };
    }
    async function getBodyMap() {
        const text = reportText();
        if (!text) return null;
        const key = hash(text + '|' + lang());
        let saved = null;
        try { saved = window.storeGet ? storeGet('neutrixBodyMap') : null; } catch (e) {}
        if (saved && saved.key === key && saved.data) return saved.data;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 45000);
            const res = await fetch((window.API_BASE || '') + '/api/body-map', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
                body: JSON.stringify({ report: text, language: lang() }) });
            clearTimeout(timer);
            if (!res.ok) throw new Error('body map ' + res.status);
            const data = await res.json();
            if (!data || !Array.isArray(data.areas)) throw new Error('bad body map');
            try { if (window.storeSet) storeSet('neutrixBodyMap', { key, data, at: Date.now() }); } catch (e) {}
            return data;
        } catch (e) {
            console.warn('[body3d] AI body map not available, using a simple word match', e);
            if (saved && saved.data && saved.key.endsWith('|' + lang())) return saved.data;    // an older map is better than none
            return fallbackMap(text);
        }
    }

    // ---------- the real anatomy (BodyParts3D, simplified for the web: assets/body/body.bin) ----------
    let modelPromise = null;
    function loadModel() {
        modelPromise = modelPromise || (async () => {
            try {
                const buf = await (await fetch('assets/body/body.bin')).arrayBuffer();
                const dv = new DataView(buf);
                if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'NXB2') return null;
                const mlen = dv.getUint32(4, true), plen = dv.getUint32(8, true), ilen = dv.getUint32(12, true);
                const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 16, mlen)));
                return { meta, pos: new Int16Array(buf, 16 + mlen, plen / 2), idx: new Uint16Array(buf, 16 + mlen + plen, ilen / 2) };
            } catch (e) { console.warn('[body3d] real anatomy model not available, using the drawn one', e); return null; }
        })();
        return modelPromise;
    }

    // =====================================================================
    // The 3D scene
    // =====================================================================
    const CYAN = 0x38d8ff, NERVE = 0xffe58a, RED = 0xff2a3d;
    const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
    const back = x => { if (x <= 0) return 0; if (x >= 1) return 1; const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    const span = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

    function holoMaterial(color, strength) {
        return new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uStrength: { value: strength || 1 } },
            vertexShader: `varying vec3 vN; varying vec3 vV;
                void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uStrength; varying vec3 vN; varying vec3 vV;
                void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
                gl_FragColor = vec4(uColor * (0.35 + f * 1.6) * uStrength, (0.05 + f * 0.8) * uOpacity); }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
    }
    const pts = arr => arr.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0));
    const curve = (arr, n) => new THREE.CatmullRomCurve3(pts(arr)).getPoints(n || 40);
    const jitter = (list, amt, seed) => {
        let s = seed || 1; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5);
        return list.map((p, i) => (i === 0 || i === list.length - 1) ? p : new THREE.Vector3(p.x + rnd() * amt, p.y + rnd() * amt * 0.6, p.z + rnd() * amt));
    };

    // The spine's natural S-curve: neck curves forward, upper back backward, lower back forward (z: + is the front)
    const spineZ = y => y > 1.47 ? -0.035 - (1.6 - y) * 0.15
        : y > 1.12 ? -0.055 - Math.sin((1.47 - y) / 0.35 * Math.PI) * 0.03
        : y > 0.93 ? -0.055 + Math.sin((1.12 - y) / 0.19 * Math.PI) * 0.015
        : -0.06 - (0.93 - y) * 0.4;
    // A tube along a path whose thickness changes (stomach, aorta, colon, bronchi...)
    function varTube(points, radii, segs, radial) {
        const c = new THREE.CatmullRomCurve3(pts(points));
        segs = segs || 48; radial = radial || 12;
        const frames = c.computeFrenetFrames(segs, false);
        const pos = [], idx = [];
        const rAt = t => { const k = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(k)); if (radii.length === 1) return radii[0]; const f = k - i; return radii[i] * (1 - f) + radii[i + 1] * f; };
        for (let i = 0; i <= segs; i++) {
            const t = i / segs, p = c.getPointAt(t), r = rAt(t), N = frames.normals[i], B = frames.binormals[i];
            for (let j = 0; j <= radial; j++) {
                const a = j / radial * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
                pos.push(p.x + r * (cs * N.x + sn * B.x), p.y + r * (cs * N.y + sn * B.y), p.z + r * (cs * N.z + sn * B.z));
            }
        }
        for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
            const a = i * (radial + 1) + j, b = a + radial + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        return g;
    }
    // Reshape a geometry point by point
    function deform(geo, fn) {
        const p = geo.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
        geo.computeVertexNormals();
        return geo;
    }

    class Body3D {
        constructor(box, opts) {
            this.box = box;
            this.opts = Object.assign({ mode: 'mini', onPick: null, onClick: null }, opts || {});
            this.areas = [];
            this.layers = { nerves: true, organs: true, skin: true, vessels: true };
            this.t = 0; this.introAt = 0; this.yaw = 0; this.pitch = 0.05; this.dist = this.opts.mode === 'mini' ? 3.45 : 3.3;
            this.target = new THREE.Vector3(0, this.opts.mode === 'mini' ? 0.86 : 0.9, 0);
            this.wantTarget = this.target.clone(); this.wantDist = this.dist;
            this.labels = [];
            this.areasOn = true;
            this.running = true;
            this.build();
        }
        build() {
            const W = this.box.clientWidth || 300, H = this.box.clientHeight || 400;
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
            this.renderer.setSize(W, H);
            this.renderer.domElement.className = 'nxb-canvas';
            this.box.appendChild(this.renderer.domElement);
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(this.opts.mode === 'mini' ? 34 : 38, W / H, 0.05, 50);
            this.scene.add(new THREE.AmbientLight(0x6688aa, 1.2));
            const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1, 2, 3); this.scene.add(key);
            const rim = new THREE.PointLight(0x38d8ff, 3, 6); rim.position.set(-1.5, 1.4, -1.5); this.scene.add(rim);
            this.root = new THREE.Group(); this.scene.add(this.root);
            this.buildFloor();
            if (this.opts.model) this.buildReal(this.opts.model);
            else { this.buildShell(); this.buildNerves(); this.buildVessels(); this.buildOrgans(); }
            this.buildScan();
            this.labelBox = document.createElement('div'); this.labelBox.className = 'nxb-labels'; this.box.appendChild(this.labelBox);
            this.bindInput();
            this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.box);
            this.io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }, { threshold: 0.01 }); this.io.observe(this.box);
            this.visible = true;
            this.clock = new THREE.Clock();
            const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); if (this.visible && !document.hidden) this.frame(); };
            loop();
        }
        resize() {
            const W = this.box.clientWidth, H = this.box.clientHeight;
            if (!W || !H) return;
            this.renderer.setSize(W, H); this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
        }
        // ----- floor: glowing rings like a hologram projector -----
        buildFloor() {
            const g = new THREE.Group();
            const ringMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
            const r1 = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.435, 96), ringMat(CYAN)); r1.rotation.x = -Math.PI / 2;
            const r2 = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.56, 96, 1, 0, Math.PI * 1.5), ringMat(CYAN)); r2.rotation.x = -Math.PI / 2;
            const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 64), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
            disc.rotation.x = -Math.PI / 2;
            const ticks = new THREE.Group();
            for (let i = 0; i < 48; i++) {
                const m = new THREE.Mesh(new THREE.PlaneGeometry(0.004, i % 4 ? 0.025 : 0.05), ringMat(CYAN));
                const a = i / 48 * Math.PI * 2; m.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62); m.rotation.x = -Math.PI / 2; m.rotation.z = -a + Math.PI / 2;
                ticks.add(m);
            }
            g.add(r1, r2, disc, ticks); g.position.y = 0.002;
            this.floor = g; this.floorSpin = r2; this.ticks = ticks; this.root.add(g);
        }
        // ----- body shell: glowing see-through skin + surface particles -----
        buildShell() {
            const parts = [];
            const add = (geo, x, y, z, rx, rz, sx, sy, sz) => {
                const m = new THREE.Mesh(geo, null);
                m.position.set(x, y, z || 0); m.rotation.set(rx || 0, 0, rz || 0); m.scale.set(sx || 1, sy || 1, sz || 1); parts.push(m);
            };
            const torso = [[0.001, 0.84], [0.11, 0.86], [0.155, 0.93], [0.15, 1.0], [0.125, 1.08], [0.13, 1.16], [0.15, 1.26], [0.165, 1.36], [0.17, 1.42], [0.14, 1.47], [0.07, 1.495], [0.001, 1.5]];
            add(new THREE.LatheGeometry(torso.map(p => new THREE.Vector2(p[0], p[1])), 40), 0, 0, 0, 0, 0, 1, 1, 0.62);
            add(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 20), 0, 1.53);
            add(new THREE.SphereGeometry(0.1, 32, 24), 0, 1.66, 0.005, 0, 0, 0.86, 1.08, 0.98);
            for (const s of [-1, 1]) {
                add(new THREE.SphereGeometry(0.055, 20, 14), s * 0.175, 1.425, 0);                       // shoulder
                add(new THREE.CapsuleGeometry(0.042, 0.25, 6, 16), s * 0.215, 1.27, 0, 0, s * 0.13);      // upper arm
                add(new THREE.CapsuleGeometry(0.034, 0.24, 6, 16), s * 0.25, 1.0, 0.01, 0, s * 0.07);     // forearm
                add(new THREE.SphereGeometry(0.045, 16, 12), s * 0.265, 0.82, 0.015, 0, 0, 0.62, 1.25, 0.4); // hand
                add(new THREE.CapsuleGeometry(0.068, 0.34, 6, 18), s * 0.085, 0.65, 0, 0, s * 0.03);      // thigh
                add(new THREE.CapsuleGeometry(0.048, 0.36, 6, 16), s * 0.09, 0.27, -0.005);              // shin
                add(new THREE.CapsuleGeometry(0.035, 0.1, 6, 12), s * 0.09, 0.035, 0.05, Math.PI / 2);    // foot
            }
            this.shellMat = holoMaterial(CYAN, 1);
            this.shell = new THREE.Group();
            const dotGeo = new THREE.BufferGeometry(); const dots = [];
            for (const m of parts) {
                m.material = this.shellMat; this.shell.add(m);
                m.updateMatrix();
                const pos = m.geometry.attributes.position;
                for (let i = 0; i < pos.count; i += 2) { const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrix); dots.push(v.x, v.y, v.z); }
            }
            dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
            this.dotsMat = new THREE.PointsMaterial({ color: CYAN, size: 0.006, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.shell.add(new THREE.Points(dotGeo, this.dotsMat));
            this.root.add(this.shell);
            this.shellParts = parts;
        }
        // ----- nervous system: brain + spinal cord + nerves to arms, legs and ribs -----
        buildNerves() {
            const paths = [];
            const spine = curve([1.58, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0, 0.92].map(y => [0, y, spineZ(y) + 0.002]), 70);   // spinal cord inside the spine
            paths.push(spine);
            for (const s of [-1, 1]) {
                const arm = jitter(curve([[0, 1.45, -0.05], [s * 0.1, 1.44, -0.02], [s * 0.18, 1.41, 0], [s * 0.23, 1.15, 0.005], [s * 0.25, 1.0, 0.01], [s * 0.265, 0.88, 0.015]], 50), 0.008, 3 + s);
                paths.push(arm);
                for (let f = 0; f < 4; f++) paths.push(curve([[s * 0.265, 0.88, 0.015], [s * (0.255 + f * 0.009), 0.82, 0.02], [s * (0.245 + f * 0.016), 0.76, 0.02]], 10));
                const leg = jitter(curve([[0, 0.92, -0.05], [s * 0.06, 0.86, -0.02], [s * 0.085, 0.65, 0], [s * 0.09, 0.47, 0.01], [s * 0.09, 0.25, -0.005], [s * 0.09, 0.07, 0.0]], 55), 0.008, 7 + s);
                paths.push(leg);
                for (let f = 0; f < 3; f++) paths.push(curve([[s * 0.09, 0.07, 0], [s * (0.08 + f * 0.012), 0.03, 0.06], [s * (0.075 + f * 0.016), 0.02, 0.1]], 8));
                for (let i = 0; i < 7; i++) {                                     // rib (intercostal) nerves
                    const y = 1.4 - i * 0.055, w = 0.13 + Math.sin(i / 6 * Math.PI) * 0.02;
                    paths.push(curve([[0, y, -0.065], [s * w * 0.7, y - 0.01, -0.05], [s * w, y - 0.03, 0.0], [s * w * 0.6, y - 0.05, 0.075]], 18));
                }
                paths.push(curve([[0, 1.55, -0.02], [s * 0.05, 1.6, 0.04], [s * 0.035, 1.63, 0.085]], 12));   // to the eyes
            }
            this.nerves = new THREE.Group();
            this.nerveLines = paths.map(p => {
                const geo = new THREE.BufferGeometry().setFromPoints(p);
                geo.setDrawRange(0, 0);
                const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: NERVE, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
                this.nerves.add(line);
                return { line, n: p.length, pts: p };
            });
            // brain: a cloud of glowing neurons
            const b = []; let s = 7;
            const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
            for (let i = 0; i < 900; i++) {
                const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1), r = Math.cbrt(rnd());
                b.push(Math.sin(v) * Math.cos(u) * 0.082 * r, 1.675 + Math.cos(v) * 0.072 * r, Math.sin(v) * Math.sin(u) * 0.09 * r);
            }
            const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(b, 3));
            this.brainDotsMat = new THREE.PointsMaterial({ color: NERVE, size: 0.007, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.nerves.add(new THREE.Points(bg, this.brainDotsMat));
            // signals travelling along the nerves
            this.impulses = [];
            const impMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
            for (let i = 0; i < 10; i++) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), impMat);
                const path = this.nerveLines[[0, 1, 6, 9, 10, 15, 1, 6, 9, 0][i] % this.nerveLines.length].pts;
                this.impulses.push({ m, path, off: i / 10 }); this.nerves.add(m);
            }
            this.root.add(this.nerves);
        }
        // ----- blood vessels: arteries (red) and the main veins (blue), along their real routes -----
        buildVessels() {
            const A = [], V = [];
            // aorta: out of the heart, arch up and to the left, then down in front of the spine, splitting at the navel
            A.push(curve([[0.012, 1.31, 0.035], [0.008, 1.385, 0.02], [0.025, 1.405, -0.015], [0.03, 1.37, -0.05], [0.022, 1.25, spineZ(1.25) + 0.035], [0.012, 1.1, spineZ(1.1) + 0.035], [0.005, 1.0, spineZ(1.0) + 0.035]], 60));
            for (const s of [-1, 1]) {
                // carotid arteries up the neck to the head
                A.push(curve([[s > 0 ? 0.02 : 0.005, 1.4, 0.0], [s * 0.022, 1.48, 0.02], [s * 0.028, 1.56, 0.025], [s * 0.03, 1.64, 0.02]], 30));
                // subclavian → brachial (upper arm, where blood pressure is taken) → radial (wrist pulse)
                A.push(jitter(curve([[s * 0.02, 1.4, 0.0], [s * 0.09, 1.43, 0.0], [s * 0.17, 1.4, 0.01], [s * 0.215, 1.25, 0.03], [s * 0.24, 1.12, 0.03], [s * 0.255, 0.99, 0.03], [s * 0.265, 0.88, 0.03]], 50), 0.003, 11 + s));
                // common iliac → femoral → popliteal (behind the knee) → tibial
                A.push(jitter(curve([[0.005, 1.0, spineZ(1.0) + 0.035], [s * 0.04, 0.95, 0.0], [s * 0.07, 0.86, 0.03], [s * 0.08, 0.68, 0.03], [s * 0.088, 0.5, -0.02], [s * 0.088, 0.3, 0.0], [s * 0.09, 0.08, 0.03]], 60), 0.003, 13 + s));
                // renal arteries to the kidneys
                A.push(curve([[0.008, 1.06, spineZ(1.06) + 0.035], [s * 0.04, 1.06, -0.04]], 6));
            }
            // veins: superior and inferior vena cava (right side of the spine), jugulars, femorals
            V.push(curve([[-0.022, 1.42, 0.02], [-0.022, 1.36, 0.025], [-0.018, 1.3, 0.03]], 16));
            V.push(curve([[-0.015, 1.25, 0.0], [-0.022, 1.15, spineZ(1.15) + 0.04], [-0.02, 1.0, spineZ(1.0) + 0.04]], 30));
            for (const s of [-1, 1]) {
                V.push(curve([[s * 0.03, 1.66, 0.0], [s * 0.035, 1.55, 0.03], [s * 0.03, 1.45, 0.03], [-0.02, 1.42, 0.02]], 26));
                V.push(jitter(curve([[-0.02, 1.0, spineZ(1.0) + 0.04], [s * 0.05, 0.94, 0.0], [s * 0.08, 0.86, 0.025], [s * 0.075, 0.68, 0.025], [s * 0.085, 0.5, -0.02], [s * 0.085, 0.3, -0.005], [s * 0.085, 0.08, 0.02]], 60), 0.003, 17 + s));
                V.push(jitter(curve([[s * 0.17, 1.4, 0.0], [s * 0.205, 1.25, 0.04], [s * 0.235, 1.12, 0.035], [s * 0.25, 0.99, 0.035], [s * 0.26, 0.88, 0.035]], 40), 0.003, 19 + s));
            }
            this.vesselMat = new THREE.LineBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.veinMat = new THREE.LineBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.vessels = new THREE.Group();
            A.forEach(p => this.vessels.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), this.vesselMat)));
            V.forEach(p => this.vessels.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), this.veinMat)));
            this.root.add(this.vessels);
        }
        // ----- organs, shaped and placed like the real ones (x: + is the patient's LEFT, z: + is the front) -----
        buildOrgans() {
            const O = {};
            const mk = (geo, color, x, y, z, sx, sy, sz, rz, rx, ry) => {
                const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0, shininess: 70, depthWrite: false, side: THREE.DoubleSide });
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx || 1, sy || 1, sz || 1); m.rotation.set(rx || 0, ry || 0, rz || 0);
                m.userData.baseScale = m.scale.clone(); m.userData.color = new THREE.Color(color);
                return m;
            };
            const sph = (r, w, h) => new THREE.SphereGeometry(r, w || 32, h || 24);

            // BRAIN: two wrinkled hemispheres with a gap between them, cerebellum at the back below, brainstem
            const hemi = s => deform(sph(0.08, 48, 36), v => {
                const n = 1 + 0.035 * Math.sin(v.x * 140) * Math.sin(v.y * 120) * Math.sin(v.z * 130);   // folds (gyri)
                v.multiplyScalar(n);
                if (s * v.x < 0) v.x *= 0.08;                                                        // flat inner side (the two halves meet in the middle)
                if (v.y < -0.02 && v.z > 0.02) v.y = -0.02 + (v.y + 0.02) * 0.6;                        // flatter base at the front
            });
            O.brain = [mk(hemi(-1), 0xf4a7b9, -0.006, 1.685, 0.008, 0.9, 0.82, 1.12), mk(hemi(1), 0xf4a7b9, 0.006, 1.685, 0.008, 0.9, 0.82, 1.12),
                       mk(deform(sph(0.035), v => { v.multiplyScalar(1 + 0.05 * Math.sin(v.y * 400)); }), 0xe58aa2, 0, 1.605, -0.058, 1.35, 0.72, 0.9),
                       mk(new THREE.CapsuleGeometry(0.013, 0.05, 4, 12), 0xe58aa2, 0, 1.57, -0.03, 1, 1, 1, 0, -0.25)];
            O.eyes = [-1, 1].map(s => mk(sph(0.012, 16, 12), 0xdff6ff, s * 0.033, 1.64, 0.087));
            // THYROID: butterfly — two lobes joined by an isthmus, in front of the windpipe
            O.thyroid = [mk(sph(0.012), 0xc58cff, -0.016, 1.5, 0.035, 0.8, 1.6, 0.8, 0.2), mk(sph(0.012), 0xc58cff, 0.016, 1.5, 0.035, 0.8, 1.6, 0.8, -0.2),
                         mk(new THREE.CapsuleGeometry(0.005, 0.02, 4, 8), 0xc58cff, 0, 1.49, 0.042, 1, 1, 1, Math.PI / 2)];
            // LUNGS: cone-shaped, flat on the inner side, the left one smaller with a notch for the heart; windpipe and bronchi; diaphragm below
            const lung = s => deform(sph(0.07, 40, 30), v => {
                if (s * v.x < 0) v.x *= 0.45;                                                       // flat inner (mediastinal) side
                if (v.y > 0) { const k = 1 - (v.y / 0.07) * 0.45; v.x *= k; v.z *= k; }               // narrow tip at the top
                if (v.y < -0.045) v.y = -0.045 + (v.y + 0.045) * 0.35;                                 // wide, flat base on the diaphragm
                if (s > 0 && v.x < 0.01 && v.y < 0.0 && v.z > 0.0) v.x = Math.max(v.x, 0.01) + (v.x - 0.01) * 0.15;   // cardiac notch (left lung)
            });
            O.lungs = [mk(lung(-1), 0xff9fb3, -0.075, 1.3, -0.01, 1.05, 1.75, 1.0), mk(lung(1), 0xff9fb3, 0.077, 1.305, -0.015, 0.9, 1.68, 0.95),
                       mk(varTube([[0, 1.55, 0.03], [0, 1.47, 0.028], [0, 1.39, 0.02]], [0.0095, 0.009]), 0xd8e9f2),                        // windpipe (trachea)
                       mk(varTube([[0, 1.39, 0.02], [-0.03, 1.36, 0.012], [-0.05, 1.33, 0.0]], [0.007, 0.005]), 0xd8e9f2),                  // right bronchus (wider, steeper)
                       mk(varTube([[0, 1.39, 0.02], [0.035, 1.37, 0.012], [0.055, 1.345, 0.0]], [0.0065, 0.0045]), 0xd8e9f2),             // left bronchus
                       mk(new THREE.SphereGeometry(0.16, 40, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), 0xff7a8a, 0, 1.075, -0.005, 1.0, 0.5, 0.68)];   // diaphragm dome
            O.lungs[O.lungs.length - 1].userData.quietPart = true;
            // HEART: cone-shaped, left of centre behind the breastbone, the tip (apex) pointing down, left and forward
            const heartGeo = deform(sph(0.052, 40, 30), v => {
                if (v.y < 0) { const k = 1 + (v.y / 0.052) * 0.6; v.x *= k; v.z *= k; v.x += -v.y * 0.35; v.z += -v.y * 0.25; }   // taper to the apex
                if (v.y > 0.03) v.y = 0.03 + (v.y - 0.03) * 0.5;                                                                  // flatter base on top
            });
            const heart = mk(heartGeo, 0xff4d5e, 0.018, 1.27, 0.045, 1.05, 1.15, 0.95, 0.35);
            // coronary arteries on the heart's surface (this is where a "blocked heart artery" is)
            const lad = mk(varTube([[0.01, 1.305, 0.09], [0.03, 1.27, 0.095], [0.05, 1.23, 0.085], [0.07, 1.2, 0.065]], [0.0045, 0.0025]), 0xff1f3a);
            const rca = mk(varTube([[-0.005, 1.305, 0.085], [-0.03, 1.285, 0.07], [-0.042, 1.25, 0.04], [-0.035, 1.22, 0.0]], [0.0045, 0.0025]), 0xff1f3a);
            const lcx = mk(varTube([[0.015, 1.305, 0.075], [0.05, 1.29, 0.05], [0.065, 1.26, 0.01]], [0.004, 0.0025]), 0xff1f3a);
            const aorta = mk(varTube([[0.012, 1.3, 0.04], [0.008, 1.38, 0.02], [0.025, 1.405, -0.015], [0.03, 1.37, -0.05], [0.025, 1.3, spineZ(1.3) + 0.035]], [0.012, 0.011, 0.01]), 0xff6b7a);
            const pulm = mk(varTube([[0.03, 1.31, 0.065], [0.04, 1.355, 0.04], [0.045, 1.37, 0.01]], [0.01, 0.008]), 0x8aa8ff);
            const svc = mk(varTube([[-0.024, 1.42, 0.02], [-0.022, 1.3, 0.03]], [0.008, 0.009]), 0x6f8fff);
            O.heart = [heart, lad, rca, lcx, aorta, pulm, svc];
            // LIVER: big wedge under the right ribs, thick on the right, thin to the left; gallbladder underneath
            const liverGeo = deform(sph(0.09, 40, 30), v => {
                const f = 0.45 + 0.55 * Math.min(1, Math.max(0, (0.09 - v.x) / 0.18));                // thicker on the right (-x)
                v.y *= f; v.z *= 0.6 + 0.4 * f;
                if (v.y < -0.01) v.y = -0.01 + (v.y + 0.01) * 0.4;                                     // flat underside
                if (v.y > 0.02) v.y = 0.02 + (v.y - 0.02) * 0.85;                                      // dome under the diaphragm
            });
            O.liver = [mk(liverGeo, 0xb8455a, -0.04, 1.16, 0.025, 1.35, 0.75, 0.9, 0.15), mk(sph(0.015), 0x6fbf5a, -0.045, 1.115, 0.07, 0.9, 1.5, 0.9, 0.4)];
            // FOOD PIPE + STOMACH: the oesophagus runs down behind the windpipe and joins a J-shaped stomach on the left; spleen behind it
            const esoph = mk(varTube([[0, 1.56, 0.01], [0.002, 1.4, spineZ(1.4) + 0.05], [0.008, 1.25, spineZ(1.25) + 0.055], [0.025, 1.17, 0.0]], [0.006, 0.006, 0.007]), 0xffc09a);
            const stomach = mk(varTube([[0.025, 1.17, 0.0], [0.065, 1.195, 0.015], [0.088, 1.16, 0.04], [0.08, 1.11, 0.06], [0.045, 1.085, 0.065], [0.012, 1.1, 0.055], [-0.008, 1.11, 0.04]],
                [0.016, 0.034, 0.038, 0.034, 0.024, 0.014, 0.009], 64, 18), 0xffa86b);
            O.stomach = [esoph, stomach, mk(deform(sph(0.03), v => { if (v.x < 0) v.x *= 0.5; }), 0x9a5cc6, 0.112, 1.16, -0.045, 0.8, 1.35, 0.85, -0.35)];
            // PANCREAS: head tucked in the C-loop of the duodenum, body behind the stomach, tail to the spleen
            O.pancreas = [mk(varTube([[-0.025, 1.05, 0.005], [0.0, 1.065, 0.0], [0.04, 1.075, -0.01], [0.08, 1.095, -0.025], [0.1, 1.11, -0.035]], [0.018, 0.014, 0.011, 0.009, 0.006]), 0xffd36b)];
            // KIDNEYS: bean-shaped (dent on the inner side), the left a little higher; adrenal glands on top; ureters down to the bladder
            const kidney = s => deform(sph(0.03, 36, 26), v => { if (s * v.x < 0 && Math.abs(v.y) < 0.014) v.x *= 0.45; });
            O.kidneys = [];
            for (const s of [-1, 1]) {
                const y = s > 0 ? 1.075 : 1.055;
                O.kidneys.push(mk(kidney(s), 0xc23b52, s * 0.064, y, -0.045, 0.82, 1.45, 0.7, s * 0.25));
                O.kidneys.push(mk(new THREE.ConeGeometry(0.012, 0.02, 12), 0xffcf6b, s * 0.06, y + 0.05, -0.045, 1, 1, 0.7));
                O.kidneys.push(mk(varTube([[s * 0.055, y - 0.03, -0.04], [s * 0.05, 0.98, -0.03], [s * 0.035, 0.9, 0.01], [s * 0.012, 0.88, 0.035]], [0.0025, 0.0025]), 0xffe9a8));
            }
            // INTESTINES: duodenum C-loop, coiled small intestine in the middle, the large intestine framing it, appendix low on the right
            const duo = mk(varTube([[-0.008, 1.11, 0.04], [-0.035, 1.1, 0.025], [-0.045, 1.065, 0.015], [-0.035, 1.03, 0.01], [-0.005, 1.025, 0.005], [0.025, 1.04, 0.0]], [0.01, 0.009]), 0xffb3a0);
            const small = mk(new THREE.TorusKnotGeometry(0.04, 0.0105, 220, 10, 4, 9), 0xffb3a0, 0, 0.965, 0.045, 1.2, 0.85, 0.75);
            const colonPath = [[-0.06, 0.92, 0.04], [-0.078, 0.97, 0.04], [-0.08, 1.03, 0.045], [-0.06, 1.065, 0.06], [-0.02, 1.07, 0.068], [0.03, 1.07, 0.068], [0.07, 1.075, 0.055],
                [0.085, 1.04, 0.045], [0.085, 0.97, 0.04], [0.07, 0.915, 0.04], [0.03, 0.895, 0.05], [0.005, 0.875, 0.03], [0.0, 0.85, 0.0]];
            const colon = mk(varTube(colonPath, [0.016, 0.016, 0.014, 0.013, 0.011, 0.01], 120, 12), 0xe9967a);
            const appendix = mk(varTube([[-0.062, 0.925, 0.04], [-0.06, 0.895, 0.045], [-0.05, 0.875, 0.05]], [0.004, 0.0025]), 0xe9967a);
            O.intestines = [duo, small, colon, appendix];
            O.bladder = [mk(deform(sph(0.032), v => { if (v.y > 0.01) v.y = 0.01 + (v.y - 0.01) * 0.6; }), 0xffe37a, 0, 0.875, 0.045)];
            O.reproductive = [mk(sph(0.022), 0xff8fd1, 0, 0.85, 0.015, 1.3, 0.8, 1)];
            // SPINE: 7 neck + 12 chest + 5 lower-back vertebrae and the sacrum, with the natural S-curve; discs between them
            const vert = [];
            const levels = [];
            for (let i = 0; i < 7; i++) levels.push([1.565 - i * 0.0155, 0.016, 0.011]);                  // cervical
            for (let i = 0; i < 12; i++) levels.push([1.452 - i * 0.026, 0.019 + i * 0.0006, 0.016]);    // thoracic
            for (let i = 0; i < 5; i++) levels.push([1.118 - i * 0.033, 0.026, 0.02]);                    // lumbar
            for (const [y, w, h] of levels) {
                vert.push(mk(new THREE.CylinderGeometry(w * 0.85, w * 0.9, h * 0.7, 16), 0xe8f1fa, 0, y, spineZ(y)));
                vert.push(mk(new THREE.BoxGeometry(0.006, h * 0.6, 0.02), 0xe8f1fa, 0, y, spineZ(y) - 0.022));       // spinous process (the bumps on your back)
            }
            vert.push(mk(new THREE.ConeGeometry(0.032, 0.09, 4), 0xe8f1fa, 0, 0.88, spineZ(0.88), 1.2, 1, 0.6, Math.PI));   // sacrum
            O.spine = vert;
            // BONES & JOINTS: ribcage (12 pairs; 11-12 "floating"), breastbone, collarbones, shoulder blades, pelvis, main joints
            const joints = [];
            for (let i = 0; i < 12; i++) {
                const y = 1.44 - i * 0.026, w = 0.1 + Math.sin(Math.min(i, 8) / 8 * Math.PI * 0.55) * 0.055, drop = 0.03 + i * 0.006;
                const front = i < 7 ? 0.085 : i < 10 ? 0.07 : 0.03;                                            // true, false and floating ribs
                for (const s of [-1, 1]) {
                    const pts_ = [[0, y, spineZ(y) - 0.005], [s * w * 0.7, y - 0.004, spineZ(y) + 0.005], [s * w, y - drop * 0.6, 0.0], [s * w * 0.8, y - drop, front * 0.75]];
                    if (i < 10) pts_.push([s * (i < 7 ? 0.02 : 0.05), y - drop * 1.3, front]);
                    joints.push(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts(pts_)), 24, 0.0038, 5, false), 0x9fd8ff));
                }
            }
            joints.push(mk(varTube([[0, 1.465, 0.07], [0, 1.4, 0.088], [0, 1.31, 0.09], [0, 1.26, 0.082]], [0.012, 0.009, 0.005]), 0x9fd8ff));     // breastbone
            for (const s of [-1, 1]) {
                joints.push(mk(varTube([[s * 0.015, 1.465, 0.06], [s * 0.08, 1.47, 0.045], [s * 0.15, 1.45, 0.0]], [0.005, 0.005]), 0x9fd8ff));     // collarbone
                joints.push(mk(new THREE.ConeGeometry(0.05, 0.11, 3), 0x9fd8ff, s * 0.1, 1.36, -0.08, 1, 1, 0.15, Math.PI));                    // shoulder blade
                for (const [x, y, z, r] of [[0.175, 1.425, 0, 0.022], [0.235, 1.135, 0.01, 0.016], [0.262, 0.875, 0.02, 0.012], [0.085, 0.86, 0, 0.024], [0.09, 0.47, 0.01, 0.024], [0.09, 0.08, 0, 0.016]])
                    joints.push(mk(sph(r, 14, 10), 0x9fd8ff, s * x, y, z));
                joints.push(mk(new THREE.TorusGeometry(0.06, 0.016, 8, 24, Math.PI * 1.2), 0x9fd8ff, s * 0.055, 0.92, -0.01, 1, 0.9, 0.7, s > 0 ? -0.6 : Math.PI + 0.6 - Math.PI * 1.2 + Math.PI, Math.PI / 2 - 0.4));   // hip bones
                joints.push(mk(varTube([[s * 0.085, 0.86, 0.0], [s * 0.088, 0.66, 0.0], [s * 0.09, 0.49, 0.005]], [0.012, 0.01]), 0x9fd8ff));       // thigh bone (femur)
                joints.push(mk(varTube([[s * 0.09, 0.455, 0.008], [s * 0.09, 0.27, 0.0], [s * 0.09, 0.09, -0.005]], [0.01, 0.008]), 0x9fd8ff));      // shin bone (tibia)
                joints.push(mk(varTube([[s * 0.18, 1.42, 0.0], [s * 0.215, 1.28, 0.005], [s * 0.235, 1.14, 0.01]], [0.009, 0.008]), 0x9fd8ff));       // upper-arm bone (humerus)
            }
            O.bones_joints = joints;
            O.skin = [];
            O.blood_vessels = [];
            this.organs = O;
            this.organGroup = new THREE.Group();
            this.order = ['brain', 'eyes', 'thyroid', 'lungs', 'heart', 'liver', 'stomach', 'pancreas', 'kidneys', 'intestines', 'bladder', 'reproductive', 'spine', 'bones_joints'];
            this.order.forEach(k => O[k].forEach(m => { m.userData.area = k; this.organGroup.add(m); }));
            this.root.add(this.organGroup);
            this.glowGroup = new THREE.Group(); this.root.add(this.glowGroup);
        }
        // ----- the real anatomy: skin, organs and bones from BodyParts3D; nerves and limb vessels along the real bones -----
        buildReal(M) {
            const meta = M.meta, sc = meta.posScale, L = meta.landmarks;
            const geoOf = p => {
                const raw = M.pos.subarray(p.v[0] * 3, (p.v[0] + p.v[1]) * 3), pos = new Float32Array(raw.length);
                for (let i = 0; i < raw.length; i++) pos[i] = raw[i] * sc;
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                g.setIndex(new THREE.BufferAttribute(M.idx.subarray(p.i[0], p.i[0] + p.i[1]), 1));
                g.computeVertexNormals(); g.computeBoundingBox();
                return g;
            };
            const V = a => new THREE.Vector3(a[0], a[1], a[2]);
            // skin → see-through glowing body + surface dots
            this.shellMat = holoMaterial(CYAN, 1);
            this.shell = new THREE.Group();
            this.dotsMat = new THREE.PointsMaterial({ color: CYAN, size: 0.005, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            const O = { brain: [], eyes: [], thyroid: [], heart: [], lungs: [], liver: [], stomach: [], pancreas: [], kidneys: [], intestines: [], bladder: [], reproductive: [], spine: [], bones_joints: [], blood_vessels: [], skin: [] };
            const box = {};
            for (const p of meta.parts) {
                const g = geoOf(p);
                if (p.area === 'skin') {
                    this.shell.add(new THREE.Mesh(g, this.shellMat));
                    const src = g.attributes.position.array, d = [];
                    for (let i = 0; i < src.length; i += 9) d.push(src[i], src[i + 1], src[i + 2]);
                    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(d, 3));
                    this.shell.add(new THREE.Points(dg, this.dotsMat));
                    continue;
                }
                const mat = new THREE.MeshPhongMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.25, transparent: true, opacity: 0, shininess: 70, depthWrite: false, side: THREE.DoubleSide });
                const m = new THREE.Mesh(g, mat);
                m.userData.baseScale = new THREE.Vector3(1, 1, 1); m.userData.color = new THREE.Color(p.color);
                if (p.name === 'diaphragm') m.userData.quietPart = true;
                // grow from the organ's own centre during the intro
                const c = g.boundingBox.getCenter(new THREE.Vector3());
                g.translate(-c.x, -c.y, -c.z); m.position.copy(c);
                (O[p.area] = O[p.area] || []).push(m);
                const b = (box[p.area] = box[p.area] || new THREE.Box3()); b.union(g.boundingBox.clone().translate(c));
                if (p.name === 'lungs') this.lungBox = g.boundingBox.clone().translate(c);
                if (p.name === 'brain') this.brainBox = g.boundingBox.clone().translate(c);
            }
            this.root.add(this.shell);
            this.organs = O;
            this.organGroup = new THREE.Group();
            this.order = ['brain', 'eyes', 'lungs', 'heart', 'blood_vessels', 'liver', 'stomach', 'pancreas', 'kidneys', 'intestines', 'bladder', 'reproductive', 'spine', 'bones_joints'];
            this.order.forEach(k => (O[k] || []).forEach(m => { m.userData.area = k; this.organGroup.add(m); }));
            this.root.add(this.organGroup);
            this.glowGroup = new THREE.Group(); this.root.add(this.glowGroup);
            // where each area's red marker goes
            this.centers = {};
            for (const [k, c] of Object.entries(meta.centers)) this.centers[k] = V(c);
            const lh = L.left_humerus;                                   // blood pressure: the brachial artery in the upper arm
            this.centers.blood_vessels = V(lh[0]).lerp(V(lh[1]), 0.55).add(new THREE.Vector3(0.01, 0, 0.05));
            this.centers.skin = new THREE.Vector3(-0.11, 1.05, 0.12);
            this.centers.bones_joints = V(L.left_femur[1]).add(new THREE.Vector3(0, 0, 0.05));     // the knee
            this.credit = meta.credit;

            // nerves: spinal cord inside the spine, nerves to arms, legs and ribs along the real bones
            const paths = [];
            const cord = L.spine.slice().sort((a, b) => b[1] - a[1]).map(p => [p[0], p[1], p[2]]);
            const bb = this.brainBox || new THREE.Box3(new THREE.Vector3(-0.07, 1.6, -0.08), new THREE.Vector3(0.07, 1.75, 0.08));
            const bc = bb.getCenter(new THREE.Vector3()), bs = bb.getSize(new THREE.Vector3());
            cord.unshift([0, bc.y - bs.y * 0.3, bc.z - bs.z * 0.15]);
            paths.push(curve(cord, 80));
            const cordAt = y => { let best = cord[0]; for (const p of cord) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; return best; };
            for (const side of ['left', 'right']) {
                const s = side === 'left' ? 1 : -1;
                const hum = L[side + '_humerus'], rad = L[side + '_radius'] || L[side + '_ulna'], fem = L[side + '_femur'], tib = L[side + '_tibia'];
                const wrist = V(rad[1]), dir = wrist.clone().sub(V(rad[0])).normalize();
                const arm = [cordAt(hum[0][1] + 0.03), [s * 0.08, hum[0][1] + 0.01, hum[0][2] + 0.01], hum[0], V(hum[0]).lerp(V(hum[1]), 0.5).toArray(), hum[1], V(rad[0]).lerp(V(rad[1]), 0.5).toArray(), rad[1]];
                paths.push(jitter(curve(arm, 60), 0.006, 3 + s));
                for (let f = -1.5; f <= 1.5; f++) {
                    const tip = wrist.clone().add(dir.clone().multiplyScalar(0.085)).add(new THREE.Vector3(s * f * 0.008, 0, f * 0.006));
                    paths.push(curve([rad[1], wrist.clone().add(dir.clone().multiplyScalar(0.04)).toArray(), tip.toArray()], 10));
                }
                const ankle = V(tib[1]);
                const leg = [cordAt(0.95), [s * 0.04, fem[0][1] - 0.01, fem[0][2] - 0.01], fem[0], V(fem[0]).lerp(V(fem[1]), 0.5).toArray(), fem[1], V(tib[0]).lerp(V(tib[1]), 0.5).toArray(), tib[1]];
                paths.push(jitter(curve(leg, 70), 0.006, 7 + s));
                for (let f = -1; f <= 1; f++) paths.push(curve([tib[1], [ankle.x + s * f * 0.01, 0.03, ankle.z + 0.06], [ankle.x + s * f * 0.018, 0.015, ankle.z + 0.15]], 10));
                // nerves between the ribs
                const lb = this.lungBox || new THREE.Box3(new THREE.Vector3(-0.13, 1.15, -0.06), new THREE.Vector3(0.13, 1.45, 0.08));
                for (let i = 0; i < 7; i++) {
                    const y = lb.max.y - 0.02 - i * (lb.max.y - lb.min.y) / 8, c0 = cordAt(y), w = Math.max(Math.abs(lb.min.x), lb.max.x) * (0.95 + 0.08 * Math.sin(i / 6 * Math.PI));
                    paths.push(curve([c0, [s * w * 0.7, y - 0.01, c0[2] + 0.01], [s * w, y - 0.03, (lb.min.z + lb.max.z) / 2], [s * w * 0.6, y - 0.05, lb.max.z + 0.01]], 18));
                }
            }
            this.nerves = new THREE.Group();
            this.nerveLines = paths.map(p => {
                const geo = new THREE.BufferGeometry().setFromPoints(p); geo.setDrawRange(0, 0);
                const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: NERVE, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
                this.nerves.add(line); return { line, n: p.length, pts: p };
            });
            const b = []; let sd = 7; const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
            for (let i = 0; i < 1100; i++) {
                const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1), r = Math.cbrt(rnd());
                b.push(bc.x + Math.sin(v) * Math.cos(u) * bs.x * 0.46 * r, bc.y + Math.cos(v) * bs.y * 0.42 * r, bc.z + Math.sin(v) * Math.sin(u) * bs.z * 0.46 * r);
            }
            const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(b, 3));
            this.brainDotsMat = new THREE.PointsMaterial({ color: NERVE, size: 0.006, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.nerves.add(new THREE.Points(bg, this.brainDotsMat));
            this.impulses = [];
            const impMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
            for (let i = 0; i < 10; i++) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), impMat);
                const path = this.nerveLines[[0, 1, 6, 9, 15, 0, 1, 6, 9, 15][i] % this.nerveLines.length].pts;
                this.impulses.push({ m, path, off: i / 10 }); this.nerves.add(m);
            }
            this.root.add(this.nerves);

            // arteries (red) and veins (blue) of the arms and legs, along the bones (the aorta and venae cavae are real meshes)
            const A = [], Vn = [];
            const off = (p, dx, dz) => [p[0] + dx, p[1], p[2] + dz];
            for (const side of ['left', 'right']) {
                const s = side === 'left' ? 1 : -1;
                const hum = L[side + '_humerus'], rad = L[side + '_radius'] || L[side + '_ulna'], fem = L[side + '_femur'], tib = L[side + '_tibia'];
                A.push(jitter(curve([[s * 0.03, 1.4, 0.01], [s * 0.1, hum[0][1] + 0.005, hum[0][2] + 0.02], off(hum[0], 0, 0.025), off(hum[1], s * 0.005, 0.03), off(rad[1], 0, 0.02)], 50), 0.003, 11 + s));
                Vn.push(jitter(curve([[s * 0.035, 1.41, 0.0], off(hum[0], -s * 0.01, 0.035), off(hum[1], -s * 0.012, 0.035), off(rad[1], -s * 0.01, 0.025)], 45), 0.003, 19 + s));
                A.push(jitter(curve([[s * 0.02, 0.98, 0.0], off(fem[0], -s * 0.01, 0.03), off(V(fem[0]).lerp(V(fem[1]), 0.5).toArray(), -s * 0.01, 0.025), off(fem[1], 0, -0.02), off(tib[1], 0, 0.0), [tib[1][0], 0.03, tib[1][2] + 0.08]], 60), 0.003, 13 + s));
                Vn.push(jitter(curve([[s * 0.02, 0.98, -0.01], off(fem[0], -s * 0.02, 0.035), off(fem[1], -s * 0.01, -0.025), off(tib[1], s * 0.005, 0.01)], 55), 0.003, 17 + s));
            }
            this.vesselMat = new THREE.LineBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.veinMat = new THREE.LineBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.vessels = new THREE.Group();
            A.forEach(p => this.vessels.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), this.vesselMat)));
            Vn.forEach(p => this.vessels.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), this.veinMat)));
            this.root.add(this.vessels);
        }
        buildScan() {
            const g = new THREE.Mesh(new THREE.RingGeometry(0.0, 0.34, 64), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
            g.rotation.x = -Math.PI / 2; this.scanDisc = g;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.003, 6, 80), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
            ring.rotation.x = Math.PI / 2; this.scanRing = ring;
            this.root.add(g, ring);
        }
        // ----- which areas are red -----
        setAreas(areas) {
            this.areas = (areas || []).filter(a => this.organs[a.key] || a.key === 'skin' || a.key === 'blood_vessels' || a.key === 'thyroid');
            this.glowGroup.clear();
            this.labels.forEach(l => l.el.remove()); this.labels = [];
            this.areaKeys = new Set(this.areas.map(a => a.key));
            for (const a of this.areas) {
                const meshes = this.organs[a.key] || [];
                const center = new THREE.Vector3();
                if (this.centers && this.centers[a.key]) center.copy(this.centers[a.key]);
                else if (meshes.length) { meshes.forEach(m => center.add(m.position)); center.divideScalar(meshes.length); }
                else if (a.key === 'blood_vessels') center.set(0.22, 1.23, 0.045);   // upper-arm artery (where blood pressure is measured)
                else if (a.key === 'thyroid') center.set(0, 1.5, 0.05);
                else center.set(-0.12, 1.02, 0.1);                                     // skin of the belly
                const glows = meshes.slice(0, 8).filter(m => !m.userData.quietPart).map(m => {
                    const g = new THREE.Mesh(m.geometry, holoMaterial(RED, 1.6));
                    g.position.copy(m.position); g.rotation.copy(m.rotation); g.scale.copy(m.userData.baseScale).multiplyScalar(1.45);
                    g.userData.area = a.key; this.glowGroup.add(g); return g;
                });
                // a pulsing ring marker in front of the area
                const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 40), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
                ring.position.copy(center); ring.userData.area = a.key; this.glowGroup.add(ring);
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'nxb-label sev-' + (a.severity || 'medium');
                el.innerHTML = `<span class="dot"></span><span class="txt">${esc(a.label || areaName(a.key))}</span>`;
                el.addEventListener('click', e => { e.stopPropagation(); if (this.opts.mode === 'mini') { if (this.opts.onClick) this.opts.onClick(); } else this.pick(a.key); });
                this.labelBox.appendChild(el);
                this.labels.push({ el, pos: center.clone().add(new THREE.Vector3(0, 0, 0.12)), key: a.key, glows, ring });
            }
        }
        setLayer(name, on) { this.layers[name] = on; }
        showAreas(on) { this.areasOn = on; if (!on) this.selected = null; }
        replay() { this.introAt = this.clock.getElapsedTime(); }
        resetView() { this.wantTarget.set(0, this.opts.mode === 'mini' ? 0.86 : 0.9, 0); this.wantDist = this.opts.mode === 'mini' ? 3.45 : 3.3; this.selected = null; this.yaw = 0; this.pitch = 0.05; }
        focus(key) {
            const l = this.labels.find(x => x.key === key);
            if (!l) return;
            this.selected = key;
            this.wantTarget.copy(l.pos).setZ(0);
            this.wantDist = 1.35;
            const x = l.pos.x;                       // turn the body so the area faces the camera
            this.yaw = Math.abs(x) > 0.2 ? -Math.sign(x) * 0.5 : 0;
        }
        pick(key) { this.focus(key); if (this.opts.onPick) this.opts.onPick(key); }
        // ----- input: drag to turn, wheel / pinch to zoom, tap to pick -----
        bindInput() {
            const el = this.renderer.domElement;
            let down = null, moved = 0, pinch = null;
            el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; moved = 0; el.setPointerCapture(e.pointerId); this.userTurned = performance.now(); });
            el.addEventListener('pointermove', e => {
                if (!down || pinch) return;
                const dx = e.clientX - down.x, dy = e.clientY - down.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
                if (this.opts.mode === 'mini') return;
                this.yaw = down.yaw + dx * 0.008; this.pitch = Math.max(-0.5, Math.min(0.7, down.pitch + dy * 0.004)); this.userTurned = performance.now();
            });
            el.addEventListener('pointerup', e => {
                if (!down) return;
                const wasTap = moved < 6; down = null;
                if (!wasTap) return;
                if (this.opts.mode === 'mini') { if (this.opts.onClick) this.opts.onClick(); return; }
                const hit = this.hit(e);
                if (hit) this.pick(hit);
            });
            if (this.opts.mode !== 'mini') {
                el.addEventListener('wheel', e => { e.preventDefault(); this.wantDist = Math.max(0.9, Math.min(4.2, this.wantDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
                el.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), dist: this.wantDist }; }, { passive: true });
                el.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); this.wantDist = Math.max(0.9, Math.min(4.2, pinch.dist * pinch.d / d)); } }, { passive: true });
                el.addEventListener('touchend', () => { pinch = null; });
                el.addEventListener('mousemove', e => { if (!down) el.style.cursor = this.hit(e) ? 'pointer' : 'grab'; });
            }
        }
        hit(e) {
            const r = this.renderer.domElement.getBoundingClientRect();
            const ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
            const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
            const objs = [...this.glowGroup.children, ...this.organGroup.children.filter(m => this.areaKeys && this.areaKeys.has(m.userData.area))];
            const hits = ray.intersectObjects(objs, false);
            if (!this.areasOn) return null;
            if (hits.length) return hits[0].object.userData.area;
            // near a label's point?
            let best = null, bd = 0.09;
            for (const l of this.labels) { const p = l.pos.clone().applyMatrix4(this.root.matrixWorld).project(this.camera); const d = Math.hypot(p.x - ndc.x, p.y - ndc.y); if (d < bd) { bd = d; best = l.key; } }
            return best;
        }
        // ----- every frame -----
        frame() {
            const now = this.clock.getElapsedTime();
            const t = now - this.introAt;
            const dt = Math.min(0.05, now - (this.last || now)); this.last = now;
            // intro timeline
            const pNerve = ease(span(t, 0.1, 1.9)), pShell = ease(span(t, 1.2, 2.7));
            const pVein = ease(span(t, 1.8, 3.0));
            if (!this.veinMat) this.veinMat = { opacity: 0 };
            this.redLevel = (this.redLevel || 0) + ((this.areasOn ? 1 : 0) - (this.redLevel || 0)) * 0.12;   // fades when dismissed
            const pRed = ease(span(t, 3.9, 4.7)) * this.redLevel;
            this.nerveLines.forEach(l => l.line.geometry.setDrawRange(0, Math.floor(l.n * pNerve)));
            const nerveFade = 1 - 0.55 * ease(span(t, 3.4, 4.4));
            this.nerveLines.forEach(l => { l.line.material.opacity = 0.9 * nerveFade; });
            this.nerves.visible = this.layers.nerves;
            this.brainDotsMat.opacity = 0.85 * ease(span(t, 0.2, 1.2)) * nerveFade;
            this.impulses.forEach(im => { const k = ((now * 0.35 + im.off) % 1); const p = im.path[Math.floor(k * (im.path.length - 1))]; im.m.position.copy(p); im.m.visible = pNerve > 0.95; });
            this.shellMat.uniforms.uOpacity.value = pShell * (this.layers.skin ? 1 : 0) * (this.areaKeys && this.areaKeys.has('skin') ? 1 : 1);
            this.shellMat.uniforms.uColor.value.set(this.areaKeys && this.areaKeys.has('skin') && pRed > 0 ? 0xff6b7a : CYAN);
            this.dotsMat.opacity = 0.55 * pShell * (this.layers.skin ? 1 : 0);
            this.shell.visible = this.layers.skin;
            this.vessels.visible = this.layers.vessels;
            const vesselRed = this.areaKeys && this.areaKeys.has('blood_vessels');
            this.vesselMat.opacity = (vesselRed ? 0.55 + 0.4 * Math.sin(now * 4) * pRed : 0.28) * ease(span(t, 1.8, 3.0));
            this.veinMat.opacity = 0.24 * pVein;
            this.vesselMat.color.set(vesselRed && pRed > 0 ? RED : 0xff6677);
            // organs pop in one by one
            this.organGroup.visible = this.layers.organs;
            this.order.forEach((k, i) => {
                const p = span(t, 2.3 + i * 0.1, 2.3 + i * 0.1 + 0.45);
                const bad = this.areaKeys && this.areaKeys.has(k) && pRed > 0;
                (this.organs[k] || []).forEach(m => {
                    m.scale.copy(m.userData.baseScale).multiplyScalar(Math.max(0.001, back(p)));
                    const quiet = (k === 'spine' || k === 'bones_joints' || k === 'eyes') && !(this.areaKeys && this.areaKeys.has(k));
                    m.material.opacity = (m.userData.quietPart ? 0.14 : quiet ? 0.32 : 0.74) * ease(p);
                    if (bad) { m.material.color.lerpColors(m.userData.color, new THREE.Color(RED), pRed); m.material.emissive.copy(m.material.color); m.material.emissiveIntensity = 0.25 + pRed * (0.25 + 0.45 * Math.sin(now * 5)); }
                    else { m.material.color.copy(m.userData.color); m.material.emissive.copy(m.userData.color); m.material.emissiveIntensity = this.selected ? 0.12 : 0.25; }
                });
            });
            // red glows, rings and labels
            for (const l of this.labels) {
                const sel = this.selected === l.key;
                const pulse = 0.75 + 0.25 * Math.sin(now * 5);
                l.glows.forEach(g => { g.material.uniforms.uOpacity.value = pRed * pulse * (sel ? 1.4 : 1); g.visible = this.layers.organs || this.organs[l.key].length === 0; });
                const rp = (now * 0.8 + l.pos.y) % 1;
                l.ring.material.opacity = pRed * (1 - rp) * 0.9; l.ring.scale.setScalar(1 + rp * 2.2);
                l.ring.lookAt(this.camera.position);
            }
            // scanning ring sweeping the body
            const sweep = span(t, 1.0, 3.6);
            const sy = sweep < 1 ? sweep * 1.85 : 0.1 + ((now * 0.25) % 1) * 1.75;
            this.scanRing.position.y = this.scanDisc.position.y = sy;
            this.scanRing.material.opacity = sweep < 1 ? 0.9 : 0.35;
            this.scanDisc.material.opacity = sweep < 1 ? 0.12 : 0.04;
            // floor rings spin
            this.floorSpin.rotation.z += dt * 0.6; this.ticks.rotation.y -= dt * 0.15;
            // camera: gentle turn, smooth zoom / focus
            const idle = !this.userTurned || performance.now() - this.userTurned > 4000;
            if (idle && !this.selected) this.yaw += dt * (this.opts.mode === 'mini' ? 0.35 : 0.15);
            this.root.rotation.y += (this.yaw - this.root.rotation.y) * 0.08;
            this.dist += (this.wantDist - this.dist) * 0.08;
            this.target.lerp(this.wantTarget, 0.08);
            const introZoom = 1 + 0.12 * (1 - ease(span(t, 0, 3.5)));
            const d = this.dist * introZoom;
            this.camera.position.set(this.target.x, this.target.y + Math.sin(this.pitch) * d, Math.cos(this.pitch) * d);
            this.camera.lookAt(this.target);
            this.renderer.render(this.scene, this.camera);
            // labels follow their organs
            const r = this.box.getBoundingClientRect();
            this.root.updateMatrixWorld();
            for (const l of this.labels) {
                const p = l.pos.clone().applyMatrix4(this.root.matrixWorld);
                const front = p.clone().sub(this.camera.position).normalize().dot(new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)) > 0;
                p.project(this.camera);
                const x = (p.x + 1) / 2 * r.width, y = (1 - p.y) / 2 * r.height;
                l.el.style.transform = `translate(${x}px, ${y}px)`;
                l.el.style.opacity = front ? String(pRed) : '0';
                l.el.style.pointerEvents = pRed > 0.5 ? '' : 'none';
                l.el.classList.toggle('sel', this.selected === l.key);
                l.el.classList.toggle('left', x > r.width * (r.width < 480 ? 0.5 : 0.62));
            }
            if (this.onTick) this.onTick(t);
        }
        destroy() { this.running = false; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.io.disconnect(); this.renderer.dispose(); this.box.innerHTML = ''; }
    }

    // ---------- the scan status lines (top left) ----------
    function hud(box, mode) {
        const h = document.createElement('div');
        h.className = 'nxb-hud ' + mode;
        h.innerHTML = `<div class="nxb-title">${esc(tx('scan'))}</div>
            ${['s1', 's2', 's3', 's4'].map((k, i) => `<div class="nxb-step" data-i="${i}"><span class="ok">◌</span> ${esc(tx(k))}</div>`).join('')}
            <div class="nxb-found"></div>`;
        box.appendChild(h);
        const times = [1.9, 2.8, 3.8];
        return {
            tick(t) { h.querySelectorAll('.nxb-step').forEach((el, i) => { if (i === 3 && h.dataset.done) return; const on = i < 3 ? t > times[i] : false; el.classList.toggle('done', on); el.classList.toggle('on', i < 3 ? t > (i ? times[i - 1] : 0) : t > 3.8); el.querySelector('.ok').textContent = on ? '✓' : '◌'; }); },
            done(n, simple) {
                h.dataset.done = '1';
                const last = h.querySelector('.nxb-step[data-i="3"]'); last.classList.add('done', 'on'); last.querySelector('.ok').textContent = '✓';
                const f = h.querySelector('.nxb-found'); f.textContent = tx('found')(n) + (simple ? ' · ' + tx('aiOff') : ''); f.classList.toggle('red', n > 0); f.classList.add('show');
            },
            el: h
        };
    }

    // =====================================================================
    // Reports page: small body on the left; tap to open the 3D View
    // =====================================================================
    async function mountMini(box) {
        if (!box) return;
        box.classList.add('nxb-box');
        const h = hud(box, 'mini');
        const tap = document.createElement('div'); tap.className = 'nxb-tap'; tap.textContent = '⤢ ' + tx('tap'); box.appendChild(tap);
        const go = () => { location.href = 'body3d.html'; };
        box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        box.tabIndex = 0; box.setAttribute('role', 'link'); box.setAttribute('aria-label', tx('tap'));
        try { await loadThree(); } catch (e) { box.classList.add('nxb-nogl'); h.el.innerHTML += `<div class="nxb-found show">3D not available offline yet</div>`; box.addEventListener('click', go); return; }
        let body;
        const model = await loadModel();
        try { body = new Body3D(box, { mode: 'mini', onClick: go, model }); } catch (e) { box.classList.add('nxb-nogl'); box.addEventListener('click', go); return; }
        box.appendChild(tap); box.appendChild(h.el);
        body.onTick = t => h.tick(t);
        const map = await getBodyMap();
        const apply = () => { body.setAreas(map ? map.areas : []); h.done(map ? map.areas.length : 0, map && map.simple); };
        const wait = Math.max(0, 3.8 - (body.clock.getElapsedTime() - body.introAt));
        setTimeout(apply, wait * 1000);
        window.NxBody3DMini = body;
    }

    // =====================================================================
    // 3D View page
    // =====================================================================
    async function mountFull(opts) {
        const view = document.getElementById(opts.view), side = document.getElementById(opts.side);
        view.classList.add('nxb-box', 'full');
        const h = hud(view, 'full');
        const hint = document.createElement('div'); hint.className = 'nxb-hint'; hint.textContent = tx('hint'); view.appendChild(hint);
        const tools = document.createElement('div'); tools.className = 'nxb-tools';
        tools.innerHTML = `<div class="nxb-tools-title">${esc(tx('layers'))}</div>
            ${['nerves', 'organs', 'skin', 'vessels'].map(k => `<button type="button" class="nxb-chip on" data-layer="${k}">${esc(tx(k))}</button>`).join('')}
            <span class="nxb-sep"></span>
            <button type="button" class="nxb-chip nxb-dismiss" data-act="dismiss">◎ ${esc(tx('dismiss'))}</button>
            <button type="button" class="nxb-chip" data-act="replay">↻ ${esc(tx('replay'))}</button>
            <button type="button" class="nxb-chip" data-act="reset">⌖ ${esc(tx('reset'))}</button>`;
        view.appendChild(tools);
        const page = view.closest('.nxb-page') || document.body;
        page.classList.add('no-side');                       // the explanations appear when a red area is tapped
        const closeSide = () => {
            page.classList.add('no-side');
            side.querySelector('.nxb-info') && side.querySelector('.nxb-info').classList.add('hidden');
            side.querySelectorAll('.nxb-item').forEach(x => x.classList.remove('sel'));
        };
        side.innerHTML = `<button type="button" class="nxb-x nxb-side-x" aria-label="${esc(tx('close'))}">×</button><div class="nxb-side-title">${esc(tx('overview'))}</div><p class="nxb-overview">${esc(tx('loading'))}</p>
            <div class="nxb-list"></div><div class="nxb-info hidden" aria-live="polite"></div><p class="nxb-disclaimer">${esc(tx('disclaimer'))}</p>`;
        loadModel().then(m => {
            if (!m) return;
            const ml = lang() === 'Malayalam';
            const A = ml ? {
                btn: 'ⓘ ഈ മോഡൽ ഏകദേശം 80% മെഡിക്കലായി കൃത്യം',
                rows: [['~90%', 'അവയവങ്ങൾ, അസ്ഥികൂടം, നട്ടെല്ല്, പ്രധാന രക്തക്കുഴലുകൾ — യഥാർത്ഥ മനുഷ്യ ശരീരത്തിന്റെ CT സ്കാനിൽ നിന്ന്'],
                       ['~50–60%', 'ഞരമ്പുകളും കൈകാലുകളിലെ രക്തക്കുഴലുകളും — യഥാർത്ഥ എല്ലുകൾക്കൊപ്പം വരച്ചത്, ലളിതമാക്കിയത്'],
                       ['—', 'തൈറോയ്ഡ്, പേശികൾ, ചെറിയ രക്തക്കുഴലുകൾ ഇല്ല. ഒരു മുതിർന്ന പുരുഷ ശരീരം മാത്രം. ചുവന്ന അടയാളം ഭാഗം കാണിക്കുന്നു, കൃത്യ സ്ഥലം അല്ല.']],
                foot: 'രോഗികൾക്ക് മനസ്സിലാക്കാൻ — ഡോക്ടർമാർക്കുള്ള ഉപകരണം അല്ല.'
            } : {
                btn: 'ⓘ This model is about 80% medically accurate',
                rows: [['~90%', 'Organs, skeleton, spine and main blood vessels — real anatomy from CT scans of a human body'],
                       ['~50–60%', 'Nerves and the arm and leg blood vessels — drawn along the real bones, simplified'],
                       ['—', 'Not shown: thyroid, muscles, small vessels. One adult male body for everyone. Red markers show the area, not the exact spot.']],
                foot: 'Made to help patients understand their report — not a tool for diagnosis.'
            };
            view.insertAdjacentHTML('beforeend', `<div class="nxb-credit"><button type="button" class="nxb-acc-btn" aria-expanded="false">${esc(A.btn)}</button>
                <div class="nxb-acc hidden">${A.rows.map(r => `<div class="nxb-acc-row"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('')}<p>${esc(A.foot)}</p></div>
                <small>3D anatomy: BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 JP)</small></div>`);
            const btn = view.querySelector('.nxb-acc-btn'), box = view.querySelector('.nxb-acc');
            btn.addEventListener('click', e => { e.stopPropagation(); const open = box.classList.toggle('hidden') === false; btn.setAttribute('aria-expanded', open); });
            ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(ev => view.querySelector('.nxb-credit').addEventListener(ev, e => e.stopPropagation(), { passive: true }));
        });
        let body;
        try { await loadThree(); body = new Body3D(view, { mode: 'full', onPick: key => showInfo(key), model: await loadModel() }); }
        catch (e) { view.classList.add('nxb-nogl'); view.insertAdjacentHTML('beforeend', '<div class="nxb-found show">3D view needs WebGL / internet the first time.</div>'); }
        if (body) { view.appendChild(h.el); view.appendChild(hint); view.appendChild(tools); body.onTick = t => h.tick(t); }
        tools.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b || !body) return;
            if (b.dataset.layer) { b.classList.toggle('on'); body.setLayer(b.dataset.layer, b.classList.contains('on')); }
            if (b.dataset.act === 'replay') { body.replay(); closeSide(); body.resetView(); }
            if (b.dataset.act === 'reset') { body.resetView(); closeSide(); }
            if (b.dataset.act === 'dismiss') {                 // plain 3D body: no red areas, labels or explanations
                const hide = !b.classList.contains('on');
                b.classList.toggle('on', hide);
                b.textContent = (hide ? '◉ ' + tx('showAreas') : '◎ ' + tx('dismiss'));
                body.showAreas(!hide);
                view.classList.toggle('dismissed', hide);
                h.el.querySelector('.nxb-found').style.visibility = hide ? 'hidden' : '';
                if (hide) { body.resetView(); closeSide(); }
            }
        });
        const map = await getBodyMap();
        let areas = map ? map.areas : [];
        if (!map) { side.querySelector('.nxb-overview').textContent = tx('noReport'); }
        else side.querySelector('.nxb-overview').textContent = map.overview || tx('pick');
        const list = side.querySelector('.nxb-list');
        list.innerHTML = areas.map(a => `<button type="button" class="nxb-item sev-${esc(a.severity || 'medium')}" data-key="${esc(a.key)}">
                <span class="nxb-dot"></span><span class="nxb-item-txt"><b>${esc(a.label || areaName(a.key))}</b><small>${esc(areaName(a.key))} · ${esc(tx(a.severity) || '')}</small></span><span class="nxb-go">›</span></button>`).join('');
        list.addEventListener('click', e => { const b = e.target.closest('.nxb-item'); if (b) { if (body) body.pick(b.dataset.key); else showInfo(b.dataset.key); } });
        side.querySelector('.nxb-side-x').addEventListener('click', () => { closeSide(); if (body) body.resetView(); });
        function showInfo(key) {
            const a = areas.find(x => x.key === key); if (!a) return;
            if (body && !body.areasOn) return;
            page.classList.remove('no-side');
            list.querySelectorAll('.nxb-item').forEach(x => x.classList.toggle('sel', x.dataset.key === key));
            const info = side.querySelector('.nxb-info');
            info.innerHTML = `<div class="nxb-info-head sev-${esc(a.severity || 'medium')}"><span class="nxb-dot"></span><div><div class="nxb-info-title">${esc(a.label || areaName(a.key))}</div>
                    <div class="nxb-info-sub">${esc(areaName(a.key))} · ${esc(tx(a.severity) || '')}</div></div>
                    <button type="button" class="nxb-x" aria-label="${esc(tx('close'))}">×</button></div>
                <div class="nxb-sec"><div class="nxb-sec-t">🩺 ${esc(tx('what'))}</div><p>${esc(a.what_happened)}</p></div>
                <div class="nxb-sec"><div class="nxb-sec-t">🔍 ${esc(tx('cause'))}</div><p>${esc(a.cause)}</p></div>
                <div class="nxb-sec"><div class="nxb-sec-t">💊 ${esc(tx('fix'))}</div><p>${esc(a.treatment)}</p></div>
                <button type="button" class="nxb-listen">🔊 ${esc(tx('listen'))}</button>`;
            info.classList.remove('hidden');
            info.querySelector('.nxb-x').onclick = () => { closeSide(); if (body) body.resetView(); };
            info.querySelector('.nxb-listen').onclick = () => {
                const say = `${a.label}. ${a.what_happened} ${a.cause} ${a.treatment}`;
                if (window.NxVoice) NxVoice.speak(say, ml() ? 'ml-IN' : 'en-GB');
                else if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(say));
            };
            if (innerWidth <= 900) setTimeout(() => side.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
        if (body) {
            const wait = Math.max(0, 3.8 - (body.clock.getElapsedTime() - body.introAt));
            setTimeout(() => { body.setAreas(areas); h.done(areas.length, map && map.simple); }, wait * 1000);
            const want = new URLSearchParams(location.search).get('area');
            if (want) setTimeout(() => body.pick(want), wait * 1000 + 900);
        } else h.done(areas.length, map && map.simple);
        window.NxBody3D = { body, showInfo, areas: () => areas };
    }

    window.NxBody = { mountMini, mountFull, getBodyMap };
})();
