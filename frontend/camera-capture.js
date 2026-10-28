// =====================================================
// camera-capture.js — "📷 Take photo" for any file input
//
// NxCamera.attach(input, { facing, multiple, label })
//   adds a "Take photo" button that puts camera photos into that <input type="file">
//   (the page's normal "change" handling then takes over).
// - Phones/tablets: opens the phone's own camera app (best quality).
// - Computers: opens a small camera window inside the page (webcam).
// Photos are made smaller (max 2000 px, JPEG) so they upload quickly.
// =====================================================
(function () {
    const TEXT = {
        English: { take: '📷 Take photo', title: 'Take a photo', snap: '📸 Capture', retake: '↺ Retake', use: '✓ Use this photo',
                   another: '✓ Add & take another', done: 'Done', flip: '🔄 Switch camera', cancel: 'Cancel',
                   added: '{n} photo(s) added', tip: 'Hold the page flat, fill the frame and avoid shadows so every word is sharp.',
                   noCam: 'The camera could not be opened. Allow camera access for this site, or use “browse” to choose a photo.' },
        Malayalam: { take: '📷 ഫോട്ടോ എടുക്കുക', title: 'ഫോട്ടോ എടുക്കുക', snap: '📸 എടുക്കുക', retake: '↺ വീണ്ടും', use: '✓ ഈ ഫോട്ടോ ഉപയോഗിക്കുക',
                     another: '✓ ചേർത്ത് അടുത്തത് എടുക്കുക', done: 'പൂർത്തിയായി', flip: '🔄 ക്യാമറ മാറ്റുക', cancel: 'റദ്ദാക്കുക',
                     added: '{n} ഫോട്ടോ ചേർത്തു', tip: 'പേജ് നേരെ പിടിക്കുക, ഫ്രെയിം നിറയ്ക്കുക, നിഴൽ ഒഴിവാക്കുക. എല്ലാ വാക്കുകളും വ്യക്തമാകണം.',
                     noCam: 'ക്യാമറ തുറക്കാൻ കഴിഞ്ഞില്ല. ഈ സൈറ്റിന് ക്യാമറ അനുവദിക്കുക, അല്ലെങ്കിൽ ഫോട്ടോ തിരഞ്ഞെടുക്കുക.' }
    };
    const tx = (k, n) => ((TEXT[window.neutrixLang] || TEXT.English)[k] || TEXT.English[k]).replace('{n}', n);
    const isPhone = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

    // ---------- Styles ----------
    const style = document.createElement('style');
    style.textContent = `
        .nx-cam-btn { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 9px 18px; border-radius: 30px;
            border: 1px solid var(--border-color, #e5e3df); background: var(--card-bg, #fff); color: var(--text-primary, #191919);
            font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
        .nx-cam-btn:hover { border-color: #a855f7; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(168, 85, 247, 0.18); }
        .nx-cam-modal { position: fixed; inset: 0; z-index: 5000; display: flex; align-items: center; justify-content: center; padding: 16px;
            background: rgba(0, 0, 0, 0.72); backdrop-filter: blur(4px); }
        .nx-cam-box { width: min(760px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 20px; padding: 18px;
            background: var(--card-bg, #fff); color: var(--text-primary, #191919); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4); }
        .nx-cam-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
        .nx-cam-head h3 { margin: 0; font-size: 18px; }
        .nx-cam-count { font-size: 12.5px; font-weight: 700; color: #16a34a; }
        .nx-cam-stage { position: relative; border-radius: 14px; overflow: hidden; background: #0b0f17; aspect-ratio: 4 / 3; }
        .nx-cam-stage video, .nx-cam-stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
        .nx-cam-stage video.mirror { transform: scaleX(-1); }
        .nx-cam-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px;
            text-align: center; color: #e5e7eb; font-size: 14px; }
        .nx-cam-tip { font-size: 12.5px; color: var(--text-muted, #888); margin: 10px 0; }
        .nx-cam-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
        .nx-cam-actions button { padding: 10px 18px; border-radius: 30px; font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer;
            border: 1px solid var(--border-color, #e5e3df); background: var(--card-bg, #fff); color: var(--text-primary, #191919); }
        .nx-cam-actions button.main { background: var(--text-primary, #191919); color: var(--card-bg, #fff); border-color: var(--text-primary, #191919); }
        .nx-cam-actions button[hidden] { display: none; }
        .nx-cam-actions .left { margin-right: auto; }
    `;
    document.head.appendChild(style);

    // ---------- Make a photo smaller (keeps text sharp) ----------
    function shrink(file, maxSide = 2000) {
        return new Promise(resolve => {
            if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return resolve(file);   // e.g. HEIC: send as it is
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                if (scale === 1 && file.size < 1.5 * 1024 * 1024) return resolve(file);
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * scale);
                c.height = Math.round(img.height * scale);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                c.toBlob(b => resolve(b ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.88);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }

    // Put files into an <input type="file"> and let the page handle them as usual
    function deliver(input, files) {
        if (!files.length) return;
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    let photoNo = 0;
    function photoName() {
        photoNo++;
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
        return `Photo_${stamp}_${photoNo}.jpg`;
    }

    // ---------- Phone: the phone's own camera ----------
    function phoneCapture(input, opts) {
        const tmp = document.createElement('input');
        tmp.type = 'file';
        tmp.accept = 'image/*';
        tmp.setAttribute('capture', opts.facing === 'user' ? 'user' : 'environment');
        tmp.style.display = 'none';
        document.body.appendChild(tmp);
        tmp.addEventListener('change', async () => {
            const files = [];
            for (const f of tmp.files) {
                const small = await shrink(f);
                files.push(new File([small], photoName(), { type: small.type }));
            }
            tmp.remove();
            deliver(input, files);
        }, { once: true });
        tmp.click();
    }

    // ---------- Computer: camera window ----------
    function webcamCapture(input, opts) {
        let facing = opts.facing || 'environment';
        let stream = null;
        let shot = null;      // File waiting for "Use"
        let added = 0;

        const modal = document.createElement('div');
        modal.className = 'nx-cam-modal';
        modal.innerHTML = `
            <div class="nx-cam-box" role="dialog" aria-modal="true">
                <div class="nx-cam-head"><h3></h3><span class="nx-cam-count"></span></div>
                <div class="nx-cam-stage"><video playsinline muted></video><img alt="" hidden><div class="nx-cam-msg"></div></div>
                <p class="nx-cam-tip"></p>
                <div class="nx-cam-actions">
                    <button type="button" class="left" data-a="flip"></button>
                    <button type="button" data-a="cancel"></button>
                    <button type="button" data-a="retake" hidden></button>
                    <button type="button" data-a="another" hidden></button>
                    <button type="button" class="main" data-a="use" hidden></button>
                    <button type="button" class="main" data-a="snap"></button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        const $ = s => modal.querySelector(s);
        const btn = a => modal.querySelector(`[data-a="${a}"]`);
        const video = $('video');
        const img = $('img');
        const msg = $('.nx-cam-msg');

        $('h3').textContent = opts.title || tx('title');
        $('.nx-cam-tip').textContent = opts.tip === false ? '' : (opts.tip || tx('tip'));
        ['flip', 'cancel', 'retake', 'another', 'use', 'snap'].forEach(a => { btn(a).textContent = tx(a === 'cancel' && added ? 'done' : a); });
        btn('another').hidden = true;

        function setMode(review) {
            img.hidden = !review;
            video.hidden = review;
            btn('snap').hidden = review;
            btn('flip').hidden = review;
            btn('retake').hidden = !review;
            btn('use').hidden = !review;
            btn('another').hidden = !review || !opts.multiple;
        }

        async function start() {
            stop();
            msg.textContent = '…';
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
                video.srcObject = stream;
                video.classList.toggle('mirror', facing === 'user');
                await video.play();
                msg.textContent = '';
            } catch (e) {
                msg.textContent = tx('noCam');
                btn('snap').disabled = true;
            }
        }
        function stop() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
        function close() {
            stop();
            if (img.src) URL.revokeObjectURL(img.src);
            modal.remove();
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);

        btn('snap').addEventListener('click', () => {
            if (!video.videoWidth) return;
            const c = document.createElement('canvas');
            c.width = video.videoWidth;
            c.height = video.videoHeight;
            const ctx = c.getContext('2d');
            if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }   // save it the way it looked
            ctx.drawImage(video, 0, 0);
            c.toBlob(async b => {
                shot = await shrink(new File([b], photoName(), { type: 'image/jpeg' }));
                if (img.src) URL.revokeObjectURL(img.src);
                img.src = URL.createObjectURL(shot);
                setMode(true);
            }, 'image/jpeg', 0.92);
        });
        btn('retake').addEventListener('click', () => { shot = null; setMode(false); });
        function take(keepGoing) {
            if (!shot) return;
            deliver(input, [shot]);
            added++;
            shot = null;
            $('.nx-cam-count').textContent = tx('added', added);
            btn('cancel').textContent = tx('done');
            if (keepGoing) setMode(false); else close();
        }
        btn('use').addEventListener('click', () => take(false));
        btn('another').addEventListener('click', () => take(true));
        btn('cancel').addEventListener('click', close);
        btn('flip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; start(); });
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        setMode(false);
        start();
    }

    function open(input, opts = {}) {
        if (isPhone()) phoneCapture(input, opts);
        else webcamCapture(input, opts);
    }

    // Adds the "Take photo" button after `after` (default: right after the input)
    function attach(input, opts = {}) {
        if (!input || input.dataset.nxCam) return null;
        input.dataset.nxCam = '1';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nx-cam-btn' + (opts.className ? ' ' + opts.className : '');
        const paint = () => { b.textContent = opts.label ? opts.label() : tx('take'); };
        paint();
        document.addEventListener('neutrix:langchange', paint);
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); open(input, opts); });
        (opts.after || input).insertAdjacentElement('afterend', b);
        return b;
    }

    window.NxCamera = { attach, open, shrink };
})();
