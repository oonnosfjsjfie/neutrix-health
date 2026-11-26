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
            this.buildFloor(); this.buildShell(); this.buildNerves(); this.buildVessels(); this.buildOrgans(); this.buildScan();
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
            const spine = curve([[0, 1.57, -0.02], [0, 1.45, -0.055], [0, 1.25, -0.07], [0, 1.05, -0.065], [0, 0.9, -0.05]], 60);
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
        // ----- blood vessels: aorta and main arteries -----
        buildVessels() {
            const v = [];
            v.push(curve([[0.02, 1.3, 0.03], [0.04, 1.36, 0.02], [0.02, 1.38, -0.02], [-0.01, 1.3, -0.04], [-0.01, 1.1, -0.04], [0, 0.92, -0.02]], 40));
            for (const s of [-1, 1]) {
                v.push(curve([[0.01, 1.37, 0], [s * 0.05, 1.45, 0.01], [s * 0.04, 1.58, 0.03], [s * 0.04, 1.68, 0.02]], 25));
                v.push(jitter(curve([[0.02, 1.37, 0], [s * 0.15, 1.39, 0.02], [s * 0.21, 1.25, 0.02], [s * 0.245, 1.0, 0.025], [s * 0.26, 0.86, 0.03]], 45), 0.006, 11 + s));
                v.push(jitter(curve([[0, 0.92, -0.02], [s * 0.07, 0.84, 0.02], [s * 0.08, 0.62, 0.025], [s * 0.088, 0.45, 0.02], [s * 0.088, 0.25, 0.012], [s * 0.09, 0.06, 0.04]], 50), 0.006, 13 + s));
            }
            this.vesselMat = new THREE.LineBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            this.vessels = new THREE.Group();
            v.forEach(p => this.vessels.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), this.vesselMat)));
            this.root.add(this.vessels);
        }
        // ----- organs -----
        buildOrgans() {
            const O = {};
            const mk = (geo, color, x, y, z, sx, sy, sz, rz, rx) => {
                const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0, shininess: 60, depthWrite: false });
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); m.rotation.set(rx || 0, 0, rz || 0);
                m.userData.baseScale = m.scale.clone(); m.userData.color = new THREE.Color(color);
                return m;
            };
            const sph = (r, w, h) => new THREE.SphereGeometry(r, w || 24, h || 18);
            O.brain = [mk(sph(0.08), 0xf4a7b9, 0, 1.68, 0.005, 1.0, 0.84, 1.12),                     // cerebrum
                       mk(sph(0.035), 0xe58aa2, 0, 1.6, -0.06, 1.3, 0.8, 1.0),                         // cerebellum (back, below)
                       mk(new THREE.CapsuleGeometry(0.014, 0.05, 4, 10), 0xe58aa2, 0, 1.57, -0.035)];  // brainstem
            O.eyes = [-1, 1].map(s => mk(sph(0.011, 14, 10), 0xdff6ff, s * 0.034, 1.64, 0.088));
            O.thyroid = [-1, 1].map(s => mk(sph(0.016, 14, 10), 0xc58cff, s * 0.016, 1.5, 0.035, 1, 1.4, 0.8));
            // right lung (patient's right = -x) is bigger (3 lobes); the left one leaves room for the heart
            O.lungs = [mk(sph(0.07), 0xff9fb3, -0.078, 1.3, -0.01, 1.02, 1.78, 0.98), mk(sph(0.07), 0xff9fb3, 0.08, 1.31, -0.015, 0.86, 1.7, 0.95),
                       mk(new THREE.CapsuleGeometry(0.011, 0.14, 4, 10), 0xd8e9f2, 0, 1.47, 0.02),                      // windpipe
                       mk(new THREE.CapsuleGeometry(0.008, 0.06, 4, 8), 0xd8e9f2, -0.03, 1.375, 0.01, 1, 1, 1, 0.75),   // bronchi
                       mk(new THREE.CapsuleGeometry(0.008, 0.06, 4, 8), 0xd8e9f2, 0.03, 1.375, 0.01, 1, 1, 1, -0.75)];
            O.heart = [mk(sph(0.05), 0xff4d5e, 0.025, 1.27, 0.045, 1.0, 1.2, 0.95, -0.45)];
            O.liver = [mk(sph(0.09), 0xb8455a, -0.06, 1.165, 0.025, 1.3, 0.55, 0.85, 0.22),          // under the right ribs
                       mk(sph(0.016), 0x6fbf5a, -0.05, 1.12, 0.07, 1, 1.4, 1)];                        // gallbladder
            O.stomach = [mk(sph(0.05), 0xffa86b, 0.065, 1.14, 0.04, 1.15, 0.85, 0.75, -0.5),
                         mk(sph(0.028), 0x9a5cc6, 0.115, 1.15, -0.04, 0.8, 1.3, 0.8, -0.3)];             // spleen (left, behind)
            O.pancreas = [mk(new THREE.CapsuleGeometry(0.013, 0.1, 4, 10), 0xffd36b, 0.015, 1.08, 0.005, 1, 1, 1, Math.PI / 2 - 0.25)];
            // the left kidney sits a little higher than the right (the liver pushes the right one down)
            O.kidneys = [-1, 1].map(s => mk(sph(0.03), 0xc23b52, s * 0.065, s > 0 ? 1.075 : 1.055, -0.045, 0.85, 1.5, 0.8, s * 0.2));
            const colon = new THREE.CatmullRomCurve3(pts([[-0.075, 0.9, 0.04], [-0.085, 0.98, 0.04], [-0.08, 1.05, 0.045], [-0.04, 1.07, 0.06], [0.04, 1.065, 0.06],
                [0.085, 1.05, 0.045], [0.09, 0.98, 0.04], [0.08, 0.91, 0.04], [0.03, 0.88, 0.05], [0.0, 0.86, 0.03]]));
            O.intestines = [mk(new THREE.TorusKnotGeometry(0.042, 0.011, 140, 10, 3, 7), 0xffb3a0, 0, 0.965, 0.045, 1.25, 0.85, 0.8),   // small intestine
                            mk(new THREE.TubeGeometry(colon, 90, 0.014, 10, false), 0xe9967a, 0, 0, 0)];                                    // large intestine frame
            O.bladder = [mk(sph(0.032), 0xffe37a, 0, 0.875, 0.045)];
            O.reproductive = [mk(sph(0.024), 0xff8fd1, 0, 0.845, 0.02, 1.3, 0.8, 1)];
            const vert = []; for (let i = 0; i < 24; i++) { const y = 0.92 + i * 0.027; vert.push(mk(new THREE.BoxGeometry(0.028, 0.013, 0.022), 0x9fd8ff, 0, y, -0.072 - Math.sin(i / 23 * Math.PI) * 0.012)); }
            O.spine = vert;
            const joints = [];
            for (const s of [-1, 1]) for (const [x, y, r] of [[0.175, 1.425, 0.03], [0.235, 1.135, 0.025], [0.262, 0.875, 0.02], [0.08, 0.86, 0.035], [0.09, 0.47, 0.035], [0.09, 0.08, 0.025]]) joints.push(mk(sph(r * 0.6, 14, 10), 0x9fd8ff, s * x, y, 0.0));
            // ribcage: 10 pairs of ribs curving from the spine round to the front
            for (let i = 0; i < 10; i++) {
                const y = 1.43 - i * 0.033, w = 0.115 + Math.sin(Math.min(i, 7) / 7 * Math.PI * 0.6) * 0.04, drop = 0.03 + i * 0.004;
                for (const s of [-1, 1]) {
                    const rib = new THREE.CatmullRomCurve3(pts([[0, y, -0.07], [s * w * 0.75, y - 0.005, -0.06], [s * w, y - drop * 0.6, 0.0], [s * w * 0.75, y - drop, 0.065], [s * 0.025, y - drop * 1.25, 0.085]]));
                    joints.push(mk(new THREE.TubeGeometry(rib, 24, 0.004, 5, false), 0x9fd8ff, 0, 0, 0));
                }
            }
            joints.push(mk(new THREE.BoxGeometry(0.022, 0.15, 0.01), 0x9fd8ff, 0, 1.33, 0.085));          // breastbone
            joints.push(mk(new THREE.TorusGeometry(0.085, 0.018, 8, 30, Math.PI), 0x9fd8ff, 0, 0.9, 0, 1.25, 0.7, 1, Math.PI, 0));   // pelvis
            O.bones_joints = joints;
            O.skin = [];
            O.blood_vessels = [];
            this.organs = O;
            this.organGroup = new THREE.Group();
            this.order = ['brain', 'eyes', 'thyroid', 'lungs', 'heart', 'liver', 'stomach', 'pancreas', 'kidneys', 'intestines', 'bladder', 'reproductive', 'spine', 'bones_joints'];
            this.order.forEach(k => O[k].forEach(m => { m.userData.area = k; this.organGroup.add(m); }));
            this.root.add(this.organGroup);
            // red glow shells for problem areas (filled in setAreas)
            this.glowGroup = new THREE.Group(); this.root.add(this.glowGroup);
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
            this.areas = (areas || []).filter(a => this.organs[a.key] || a.key === 'skin' || a.key === 'blood_vessels');
            this.glowGroup.clear();
            this.labels.forEach(l => l.el.remove()); this.labels = [];
            this.areaKeys = new Set(this.areas.map(a => a.key));
            for (const a of this.areas) {
                const meshes = this.organs[a.key] || [];
                const center = new THREE.Vector3();
                if (meshes.length) { meshes.forEach(m => center.add(m.position)); center.divideScalar(meshes.length); }
                else if (a.key === 'blood_vessels') center.set(0.22, 1.23, 0.045);   // upper-arm artery (where blood pressure is measured)
                else center.set(-0.12, 1.02, 0.1);                                     // skin of the belly
                const glows = meshes.slice(0, 8).map(m => {
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
            this.vesselMat.color.set(vesselRed && pRed > 0 ? RED : 0xff6677);
            // organs pop in one by one
            this.organGroup.visible = this.layers.organs;
            this.order.forEach((k, i) => {
                const p = span(t, 2.3 + i * 0.1, 2.3 + i * 0.1 + 0.45);
                const bad = this.areaKeys && this.areaKeys.has(k) && pRed > 0;
                this.organs[k].forEach(m => {
                    m.scale.copy(m.userData.baseScale).multiplyScalar(Math.max(0.001, back(p)));
                    const quiet = (k === 'spine' || k === 'bones_joints' || k === 'eyes') && !(this.areaKeys && this.areaKeys.has(k));
                    m.material.opacity = (quiet ? 0.35 : 0.72) * ease(p);
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
        try { body = new Body3D(box, { mode: 'mini', onClick: go }); } catch (e) { box.classList.add('nxb-nogl'); box.addEventListener('click', go); return; }
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
        let body;
        try { await loadThree(); body = new Body3D(view, { mode: 'full', onPick: key => showInfo(key) }); }
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
