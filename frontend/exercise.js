// =====================================================
// Exercise page
// 1. Lists the exercises written in this issue's reports (found by the AI, /api/exercises).
// 2. "Start with camera": MediaPipe Pose finds 33 body points in the camera picture,
//    we draw the dots and lines, and exercise-pose.js counts reps and checks the form.
//    Everything runs in the browser: the video never leaves the device.
// 3. Exercises the camera can't check (walking, breathing...) get steps and a timer.
// =====================================================
(function () {
    const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
    const REST_SECONDS = 20;
    const DEFAULT_REPS = 10;

    const X = {
        English: {
            pageTitle: 'Neutrix | Exercise',
            emptyTitle: 'No reports yet',
            emptyText: 'Upload your discharge summary first. If it mentions exercises, they will show up here.',
            emptyBtn: 'Go to AI Discharge Summary',
            listTitle: 'Your exercises',
            listSub: 'Only the exercises written in your reports. Tap one to begin.',
            aiBadge: 'AI • FROM YOUR REPORTS',
            loading: 'Reading your reports for exercises…',
            restrictTitle: '⚠️ Limits written in your reports',
            noneTitle: 'No exercises found in your reports',
            noneText: 'Your reports do not mention any exercises. Please ask your doctor or physiotherapist before starting any exercise.',
            listHint: 'Found something wrong? Your doctor’s advice always comes first.',
            recheck: '🔄 Check my reports again',
            camTag: '📷 CAMERA COACH',
            guideTag: '📝 GUIDED',
            startCamBtn: 'Start with camera →',
            startGuideBtn: 'Open steps →',
            fromReport: 'From your report: “{q}”',
            todayDone: '✓ Today: {n} session(s), {r} reps',
            todayDoneGuided: '✓ Done today ({n}×)',
            repsSets: '{reps} reps × {sets} sets',
            repsOnly: '{reps} reps',
            hold: 'hold {s} s',
            minutes: '{m} minutes',
            goalDefault: 'Goal: {reps} reps (not written in your report)',
            sideLeft: 'Left side', sideRight: 'Right side', sideBoth: 'Both sides',
            back: '← All exercises',
            live: 'LIVE • tracking',
            flip: '🔄 Camera',
            voiceOn: '🔊 Voice on', voiceOff: '🔇 Voice off',
            camIntro: 'Place your phone or laptop 2–3 steps away so your whole body is in the picture. Good light helps.',
            startCam: '📷 Start camera',
            loadingModel: 'Loading the body tracker… (the first time can take a few seconds)',
            camStarting: 'Starting the camera…',
            camDenied: 'Camera permission was blocked. Allow the camera for this site in your browser settings, then try again.',
            camMissing: 'No camera was found on this device.',
            camFailed: 'The camera could not be started: {msg}',
            modelFailed: 'The body tracker could not be loaded. Check your internet connection and try again.',
            tryAgain: 'Try again',
            privacy: 'Your camera video stays on this device. Nothing is recorded or uploaded.',
            movement: 'MOVEMENT', goal: 'GOAL ✓',
            setOf: 'Set {n} of {total}',
            activeSide: 'Tracking: {side}',
            left: 'left', right: 'right',
            angle: 'Joint angle: {a}°',
            pause: '⏸ Pause', resume: '▶ Resume', finish: '✓ Finish',
            howTo: 'How to do it',
            restTitle: 'Set {n} done!',
            restText: 'Rest for {s} seconds. Breathe slowly.',
            skipRest: 'Skip rest',
            paused: 'Paused',
            doneTitle: 'Well done!',
            doneText: 'You did {r} reps of {name}. Saved to today’s progress.',
            doneTextGuided: '{name} marked as done for today.',
            doneBack: 'Back to my exercises',
            timer: 'TIMER', timerStart: '▶ Start timer', timerPause: '⏸ Pause timer',
            markDone: '✓ Mark as done today',
            guidedNote: 'The camera can’t check this one, so follow the steps at your own pace.',
            savedGuided: '✓ Saved for today.',
            safeTitle: 'EXERCISE SAFELY',
            safe1: 'Stop at once if you feel chest pain, dizziness, severe breathlessness or sharp pain.',
            safe2: 'Go slowly. Smooth, controlled movements matter more than speed.',
            safe3: 'Keep a chair or wall nearby for support, and have someone with you if you feel weak.',
            safe4: 'The camera coach only checks your movement. It is not a doctor or physiotherapist.',
            // live feedback
            fbGetReady: 'Get ready…',
            fbNobody: 'Step into the picture',
            fbShowArm: 'Move so your whole arm is in the picture',
            fbShowLegs: 'Step back so your hips, knees and feet are in the picture',
            fbStartMoving: 'Start when you are ready',
            fbNextRep: 'Good. Next one',
            fbGoodRep: '✓ Good rep!',
            fbHold: 'Hold it…',
            fbHoldLonger: 'Hold a little longer at the top',
            fbRaiseHigher: 'Raise your arm to shoulder height',
            fbArmUp: '✓ Arm up. Now lower slowly',
            fbLowerSlowly: 'Lower your arm slowly',
            fbElbowStraight: 'Keep your elbow straight',
            fbBendMore: 'Bend your elbow more',
            fbBentWell: '✓ Good bend. Now straighten',
            fbStraightenArm: 'Straighten your arm slowly',
            fbElbowClose: 'Keep your elbow close to your body',
            fbStandFully: 'Stand up fully',
            fbStanding: '✓ Standing tall. Now sit slowly',
            fbSitSlowly: 'Sit down slowly',
            fbStandTall: 'Keep your back straight',
            fbStraightenKnee: 'Straighten your knee fully',
            fbKneeStraight: '✓ Knee straight. Now lower slowly',
            fbLowerLeg: 'Lower your leg slowly',
            fbKneeHigher: 'Lift your knee higher',
            fbKneeUp: '✓ Knee up. Now put it down',
            fbFootDown: 'Put your foot down gently'
        },
        Malayalam: {
            pageTitle: 'ന്യൂട്രിക്സ് | വ്യായാമം',
            emptyTitle: 'ഇതുവരെ റിപ്പോർട്ടുകളില്ല',
            emptyText: 'ആദ്യം ഡിസ്ചാർജ് സമ്മറി അപ്‌ലോഡ് ചെയ്യുക. അതിൽ വ്യായാമങ്ങൾ ഉണ്ടെങ്കിൽ അവ ഇവിടെ കാണിക്കും.',
            emptyBtn: 'AI ഡിസ്ചാർജ് സംഗ്രഹത്തിലേക്ക് പോകുക',
            listTitle: 'നിങ്ങളുടെ വ്യായാമങ്ങൾ',
            listSub: 'നിങ്ങളുടെ റിപ്പോർട്ടുകളിൽ എഴുതിയ വ്യായാമങ്ങൾ മാത്രം. തുടങ്ങാൻ ഒന്നിൽ ടാപ്പ് ചെയ്യുക.',
            aiBadge: 'AI • നിങ്ങളുടെ റിപ്പോർട്ടുകളിൽ നിന്ന്',
            loading: 'വ്യായാമങ്ങൾക്കായി റിപ്പോർട്ടുകൾ വായിക്കുന്നു…',
            restrictTitle: '⚠️ റിപ്പോർട്ടുകളിൽ എഴുതിയ നിയന്ത്രണങ്ങൾ',
            noneTitle: 'റിപ്പോർട്ടുകളിൽ വ്യായാമങ്ങളൊന്നും കണ്ടെത്തിയില്ല',
            noneText: 'നിങ്ങളുടെ റിപ്പോർട്ടുകളിൽ വ്യായാമങ്ങളെക്കുറിച്ച് പറയുന്നില്ല. ഏതെങ്കിലും വ്യായാമം തുടങ്ങുന്നതിന് മുമ്പ് ഡോക്ടറോടോ ഫിസിയോതെറാപ്പിസ്റ്റിനോടോ ചോദിക്കുക.',
            listHint: 'എന്തെങ്കിലും തെറ്റ് കണ്ടോ? ഡോക്ടറുടെ ഉപദേശമാണ് എപ്പോഴും ആദ്യം.',
            recheck: '🔄 റിപ്പോർട്ടുകൾ വീണ്ടും പരിശോധിക്കുക',
            camTag: '📷 ക്യാമറ സഹായി',
            guideTag: '📝 നിർദ്ദേശങ്ങൾ',
            startCamBtn: 'ക്യാമറയോടെ തുടങ്ങുക →',
            startGuideBtn: 'ഘട്ടങ്ങൾ തുറക്കുക →',
            fromReport: 'റിപ്പോർട്ടിൽ നിന്ന്: “{q}”',
            todayDone: '✓ ഇന്ന്: {n} തവണ, {r} ആവർത്തനങ്ങൾ',
            todayDoneGuided: '✓ ഇന്ന് ചെയ്തു ({n}×)',
            repsSets: '{reps} ആവർത്തനം × {sets} സെറ്റ്',
            repsOnly: '{reps} ആവർത്തനം',
            hold: '{s} സെക്കൻഡ് പിടിക്കുക',
            minutes: '{m} മിനിറ്റ്',
            goalDefault: 'ലക്ഷ്യം: {reps} ആവർത്തനം (റിപ്പോർട്ടിൽ എഴുതിയിട്ടില്ല)',
            sideLeft: 'ഇടത് വശം', sideRight: 'വലത് വശം', sideBoth: 'രണ്ട് വശവും',
            back: '← എല്ലാ വ്യായാമങ്ങളും',
            live: 'ലൈവ് • ട്രാക്കിംഗ്',
            flip: '🔄 ക്യാമറ',
            voiceOn: '🔊 ശബ്ദം ഓൺ', voiceOff: '🔇 ശബ്ദം ഓഫ്',
            camIntro: 'ഫോണോ ലാപ്‌ടോപ്പോ 2–3 അടി അകലെ വയ്ക്കുക, നിങ്ങളുടെ ശരീരം മുഴുവൻ ചിത്രത്തിൽ വരണം. നല്ല വെളിച്ചം സഹായിക്കും.',
            startCam: '📷 ക്യാമറ തുടങ്ങുക',
            loadingModel: 'ബോഡി ട്രാക്കർ ലോഡ് ചെയ്യുന്നു… (ആദ്യ തവണ കുറച്ച് സെക്കൻഡ് എടുത്തേക്കാം)',
            camStarting: 'ക്യാമറ തുടങ്ങുന്നു…',
            camDenied: 'ക്യാമറ അനുമതി തടഞ്ഞിരിക്കുന്നു. ബ്രൗസർ സെറ്റിംഗ്സിൽ ഈ സൈറ്റിന് ക്യാമറ അനുവദിച്ച് വീണ്ടും ശ്രമിക്കുക.',
            camMissing: 'ഈ ഉപകരണത്തിൽ ക്യാമറ കണ്ടെത്തിയില്ല.',
            camFailed: 'ക്യാമറ തുടങ്ങാൻ കഴിഞ്ഞില്ല: {msg}',
            modelFailed: 'ബോഡി ട്രാക്കർ ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
            tryAgain: 'വീണ്ടും ശ്രമിക്കുക',
            privacy: 'നിങ്ങളുടെ ക്യാമറ വീഡിയോ ഈ ഉപകരണത്തിൽ തന്നെ നിൽക്കും. ഒന്നും റെക്കോർഡ് ചെയ്യുകയോ അപ്‌ലോഡ് ചെയ്യുകയോ ഇല്ല.',
            movement: 'ചലനം', goal: 'ലക്ഷ്യം ✓',
            setOf: 'സെറ്റ് {n} / {total}',
            activeSide: 'ട്രാക്കിംഗ്: {side}',
            left: 'ഇടത്', right: 'വലത്',
            angle: 'സന്ധി കോൺ: {a}°',
            pause: '⏸ നിർത്തുക', resume: '▶ തുടരുക', finish: '✓ പൂർത്തിയാക്കുക',
            howTo: 'എങ്ങനെ ചെയ്യാം',
            restTitle: 'സെറ്റ് {n} കഴിഞ്ഞു!',
            restText: '{s} സെക്കൻഡ് വിശ്രമിക്കുക. സാവധാനം ശ്വസിക്കുക.',
            skipRest: 'വിശ്രമം ഒഴിവാക്കുക',
            paused: 'നിർത്തിയിരിക്കുന്നു',
            doneTitle: 'നന്നായി!',
            doneText: '{name} {r} തവണ ചെയ്തു. ഇന്നത്തെ പുരോഗതിയിൽ സേവ് ചെയ്തു.',
            doneTextGuided: '{name} ഇന്ന് ചെയ്തതായി രേഖപ്പെടുത്തി.',
            doneBack: 'എന്റെ വ്യായാമങ്ങളിലേക്ക്',
            timer: 'ടൈമർ', timerStart: '▶ ടൈമർ തുടങ്ങുക', timerPause: '⏸ ടൈമർ നിർത്തുക',
            markDone: '✓ ഇന്ന് ചെയ്തതായി രേഖപ്പെടുത്തുക',
            guidedNote: 'ഇത് ക്യാമറയ്ക്ക് പരിശോധിക്കാൻ കഴിയില്ല, അതിനാൽ നിങ്ങളുടെ വേഗതയിൽ ഘട്ടങ്ങൾ പിന്തുടരുക.',
            savedGuided: '✓ ഇന്നത്തേക്ക് സേവ് ചെയ്തു.',
            safeTitle: 'സുരക്ഷിതമായി വ്യായാമം ചെയ്യുക',
            safe1: 'നെഞ്ചുവേദന, തലകറക്കം, കടുത്ത ശ്വാസതടസ്സം അല്ലെങ്കിൽ കഠിനമായ വേദന തോന്നിയാൽ ഉടൻ നിർത്തുക.',
            safe2: 'സാവധാനം ചെയ്യുക. വേഗതയേക്കാൾ പ്രധാനം നിയന്ത്രിതമായ ചലനങ്ങളാണ്.',
            safe3: 'പിന്തുണയ്ക്കായി ഒരു കസേരയോ ചുമരോ അടുത്ത് വയ്ക്കുക, ക്ഷീണം തോന്നിയാൽ ആരെങ്കിലും കൂടെ ഉണ്ടാകണം.',
            safe4: 'ക്യാമറ സഹായി നിങ്ങളുടെ ചലനം മാത്രമേ പരിശോധിക്കൂ. ഇത് ഡോക്ടറോ ഫിസിയോതെറാപ്പിസ്റ്റോ അല്ല.',
            fbGetReady: 'തയ്യാറാകൂ…',
            fbNobody: 'ചിത്രത്തിനുള്ളിലേക്ക് വരൂ',
            fbShowArm: 'കൈ മുഴുവൻ ചിത്രത്തിൽ വരുന്ന രീതിയിൽ നീങ്ങുക',
            fbShowLegs: 'ഇടുപ്പും മുട്ടും പാദവും ചിത്രത്തിൽ വരാൻ പിന്നോട്ട് മാറുക',
            fbStartMoving: 'തയ്യാറാകുമ്പോൾ തുടങ്ങുക',
            fbNextRep: 'നല്ലത്. അടുത്തത്',
            fbGoodRep: '✓ നന്നായി!',
            fbHold: 'പിടിച്ചു നിൽക്കൂ…',
            fbHoldLonger: 'മുകളിൽ കുറച്ചുകൂടി പിടിച്ചു നിൽക്കൂ',
            fbRaiseHigher: 'കൈ തോളിന്റെ ഉയരം വരെ ഉയർത്തുക',
            fbArmUp: '✓ കൈ ഉയർന്നു. ഇനി സാവധാനം താഴ്ത്തുക',
            fbLowerSlowly: 'കൈ സാവധാനം താഴ്ത്തുക',
            fbElbowStraight: 'കൈമുട്ട് നേരെ വയ്ക്കുക',
            fbBendMore: 'കൈമുട്ട് കൂടുതൽ മടക്കുക',
            fbBentWell: '✓ നന്നായി മടക്കി. ഇനി നിവർത്തുക',
            fbStraightenArm: 'കൈ സാവധാനം നിവർത്തുക',
            fbElbowClose: 'കൈമുട്ട് ശരീരത്തോട് ചേർത്ത് വയ്ക്കുക',
            fbStandFully: 'പൂർണ്ണമായി എഴുന്നേറ്റ് നിൽക്കുക',
            fbStanding: '✓ നേരെ നിൽക്കുന്നു. ഇനി സാവധാനം ഇരിക്കുക',
            fbSitSlowly: 'സാവധാനം ഇരിക്കുക',
            fbStandTall: 'പുറം നേരെ വയ്ക്കുക',
            fbStraightenKnee: 'മുട്ട് പൂർണ്ണമായി നിവർത്തുക',
            fbKneeStraight: '✓ മുട്ട് നിവർന്നു. ഇനി സാവധാനം താഴ്ത്തുക',
            fbLowerLeg: 'കാൽ സാവധാനം താഴ്ത്തുക',
            fbKneeHigher: 'മുട്ട് കൂടുതൽ ഉയർത്തുക',
            fbKneeUp: '✓ മുട്ട് ഉയർന്നു. ഇനി താഴ്ത്തുക',
            fbFootDown: 'പാദം സാവധാനം താഴെ വയ്ക്കുക'
        }
    };
    const MOVE_ICON = { arm_raise: '🙆', elbow_bend: '💪', sit_to_stand: '🪑', knee_extension: '🦵', marching: '🚶', guided: '🧘' };
    const GOOD_FB = new Set(['fbGoodRep', 'fbArmUp', 'fbBentWell', 'fbStanding', 'fbKneeStraight', 'fbKneeUp', 'fbNextRep']);
    const WARN_FB = new Set(['fbElbowStraight', 'fbElbowClose', 'fbStandTall', 'fbHoldLonger', 'fbShowArm', 'fbShowLegs', 'fbNobody']);

    const $ = id => document.getElementById(id);
    const ml = () => window.neutrixLang === 'Malayalam';
    function x(key, vars = {}) {
        let text = (X[window.neutrixLang] || X.English)[key] ?? X.English[key] ?? key;
        for (const k in vars) text = text.replaceAll(`{${k}}`, vars[k]);
        return text;
    }
    const pick = (item, field) => (ml() ? (item[field + '_ml'] || item[field + '_en']) : (item[field + '_en'] || item[field + '_ml'])) || '';
    const show = (id, on) => $(id).classList.toggle('hidden', !on);
    function esc(s) {
        return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    // ---------- Today's progress ----------
    function today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function exId(ex) { return (ex.name_en || ex.name_ml || 'exercise').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40); }
    function todayLog(ex) {
        const log = storeGet('neutrixExerciseLog') || {};
        return (log[today()] || {})[exId(ex)] || null;
    }
    function saveSession(ex, reps) {
        const log = storeGet('neutrixExerciseLog') || {};
        const day = log[today()] = log[today()] || {};
        const entry = day[exId(ex)] = day[exId(ex)] || { sessions: 0, reps: 0 };
        entry.sessions += 1;
        entry.reps += reps || 0;
        // keep about two months
        Object.keys(log).sort().slice(0, -60).forEach(k => delete log[k]);
        storeSet('neutrixExerciseLog', log);
    }

    // ---------- Static texts ----------
    function applyX() {
        document.querySelectorAll('[data-x]').forEach(el => { el.textContent = x(el.dataset.x); });
        document.title = x('pageTitle');
        $('voiceBtn').textContent = voiceOn ? x('voiceOn') : x('voiceOff');
    }

    // =====================================================
    // 1. The list
    // =====================================================
    let info = null;

    function doseText(ex) {
        const parts = [];
        if (ex.reps && ex.sets) parts.push(x('repsSets', { reps: ex.reps, sets: ex.sets }));
        else if (ex.reps) parts.push(x('repsOnly', { reps: ex.reps }));
        if (ex.hold_seconds) parts.push(x('hold', { s: ex.hold_seconds }));
        if (ex.minutes) parts.push(x('minutes', { m: ex.minutes }));
        return parts.join(' · ');
    }
    function sideText(ex) {
        return ex.side === 'left' ? x('sideLeft') : ex.side === 'right' ? x('sideRight') : x('sideBoth');
    }

    function renderList() {
        show('listView', true);
        const grid = $('exGrid');
        grid.innerHTML = '';
        const exercises = (info && info.exercises) || [];

        // Restrictions
        const restrictions = info ? (ml() ? (info.restrictions_ml.length ? info.restrictions_ml : info.restrictions_en) : info.restrictions_en) : [];
        const rbox = $('exRestrict');
        rbox.classList.toggle('hidden', !restrictions.length);
        rbox.innerHTML = restrictions.length
            ? `<strong>${esc(x('restrictTitle'))}</strong><ul>${restrictions.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';

        show('exNone', !!info && !exercises.length);

        exercises.forEach((ex, i) => {
            const camera = NxPose.trackable(ex.move);
            const card = document.createElement('div');
            card.className = 'ex-card';
            card.style.animationDelay = `${i * 0.05}s`;
            const done = todayLog(ex);
            const dose = doseText(ex);
            card.innerHTML = `
                <div class="ex-card-top">
                    <span class="ex-icon">${MOVE_ICON[ex.move] || '🏃'}</span>
                    <span class="ex-tag ${camera ? 'cam' : 'guide'}">${esc(x(camera ? 'camTag' : 'guideTag'))}</span>
                </div>
                <div class="ex-name">${esc(pick(ex, 'name'))}</div>
                ${dose ? `<div class="ex-dose">${esc(dose)}</div>` : ''}
                <div class="ex-freq">${esc([pick(ex, 'frequency'), camera ? sideText(ex) : ''].filter(Boolean).join(' · '))}</div>
                ${ex.source ? `<div class="ex-quote">${esc(x('fromReport', { q: ex.source }))}</div>` : ''}
                ${done ? `<div class="ex-today">${esc(camera ? x('todayDone', { n: done.sessions, r: done.reps }) : x('todayDoneGuided', { n: done.sessions }))}</div>` : ''}
                <button class="btn-primary" type="button">${esc(x(camera ? 'startCamBtn' : 'startGuideBtn'))}</button>`;
            card.querySelector('button').addEventListener('click', () => (camera ? openCoach(ex) : openGuided(ex)));
            grid.appendChild(card);
        });
    }

    function loadList(force) {
        $('exError').classList.add('hidden');
        info = force ? null : exerciseInfo();
        if (info) { renderList(); return; }
        show('listView', true);
        show('exLoading', true);
        show('exNone', false);
        $('exGrid').innerHTML = '';
        $('recheckBtn').disabled = true;
        fetchExercises()
            .then(data => {
                info = data;
                document.dispatchEvent(new CustomEvent('neutrix:exercises'));
                renderList();
            })
            .catch(err => {
                const box = $('exError');
                box.textContent = '⚠️ ' + (err && err.message ? err.message : String(err));
                box.classList.remove('hidden');
                info = storeGet('neutrixExercises');   // show the older list if there is one
                if (info) renderList();
            })
            .finally(() => { show('exLoading', false); $('recheckBtn').disabled = false; });
    }
    $('recheckBtn').addEventListener('click', () => loadList(true));

    function showOnly(view) {
        ['listView', 'coachView', 'guidedView', 'doneView', 'emptyView'].forEach(v => show(v, v === view));
        window.scrollTo({ top: Math.max(0, $(view).getBoundingClientRect().top + window.scrollY - 90), behavior: 'smooth' });
    }
    function backToList() {
        stopCamera();
        stopTimer();
        showOnly('listView');
        renderList();
    }
    ['coachBack', 'guidedBack', 'doneBack'].forEach(id => $(id).addEventListener('click', backToList));

    // =====================================================
    // 2. Camera coach
    // =====================================================
    let current = null;          // exercise being done
    let counter = null;
    let landmarker = null;
    let stream = null;
    let facing = 'user';
    let running = false;
    let paused = false;
    let resting = false;
    let restTimer = null;
    let lastVideoTime = -1;
    let lastOut = null;
    let goalReps = DEFAULT_REPS;
    let totalSets = 1;
    let voiceOn = (() => { try { return localStorage.getItem('nxExerciseVoice') !== 'off'; } catch (e) { return true; } })();

    const video = $('video');
    const canvas = $('overlay');
    const ctx = canvas.getContext('2d');

    function openCoach(ex) {
        current = ex;
        counter = NxPose.createCounter({ move: ex.move, side: ex.side, holdSeconds: ex.hold_seconds || 0 });
        goalReps = ex.reps || DEFAULT_REPS;
        totalSets = ex.sets || 1;
        paused = false;
        resting = false;
        lastOut = null;
        renderCoachTexts();
        updateHud({ reps: 0, progress: 0 });
        stageMessage('📷', x('camIntro'), x('startCam'));
        $('feedback').classList.add('hidden');
        showOnly('coachView');
    }

    function renderCoachTexts() {
        if (!current) return;
        const ex = current;
        $('coachName').textContent = pick(ex, 'name');
        const target = [doseText(ex) || x('goalDefault', { reps: goalReps }), pick(ex, 'frequency'), sideText(ex)].filter(Boolean);
        $('coachTarget').textContent = target.join(' · ');
        const steps = ml() && ex.steps_ml && ex.steps_ml.length ? ex.steps_ml : ex.steps_en || [];
        $('coachSteps').innerHTML = steps.map(s => `<li>${esc(s)}</li>`).join('');
        $('coachCaution').textContent = pick(ex, 'caution') ? '⚠️ ' + pick(ex, 'caution') : '';
        $('pauseBtn').textContent = paused ? x('resume') : x('pause');
    }

    function stageMessage(icon, text, buttonText, onClick) {
        const box = $('stageMsg');
        box.hidden = false;
        box.querySelector('.big').textContent = icon || '';
        $('stageMsgText').textContent = text;
        const btn = $('startBtn');
        btn.classList.toggle('hidden', !buttonText);
        btn.textContent = buttonText || '';
        btn.onclick = onClick || startCamera;
    }
    function hideStageMessage() { $('stageMsg').hidden = true; }

    async function loadTracker() {
        if (landmarker) return landmarker;
        const vision = await import(`${VISION}/vision_bundle.mjs`);
        const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
        const make = delegate => vision.PoseLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: MODEL, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        try { landmarker = await make('GPU'); } catch (e) { landmarker = await make('CPU'); }
        return landmarker;
    }

    async function startCamera() {
        $('startBtn').disabled = true;
        try {
            stageMessage('⏳', x('loadingModel'));
            try {
                await loadTracker();
            } catch (e) {
                console.error('[exercise] tracker', e);
                stageMessage('⚠️', x('modelFailed'), x('tryAgain'));
                return;
            }
            stageMessage('⏳', x('camStarting'));
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                stageMessage('⚠️', x('camMissing'), x('tryAgain'));
                return;
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 720 } }, audio: false
                });
            } catch (e) {
                const name = e && e.name;
                const msg = name === 'NotAllowedError' || name === 'SecurityError' ? x('camDenied')
                    : name === 'NotFoundError' || name === 'OverconstrainedError' ? x('camMissing')
                    : x('camFailed', { msg: (e && e.message) || name || e });
                stageMessage('⚠️', msg, x('tryAgain'));
                return;
            }
            video.srcObject = stream;
            video.classList.toggle('mirror', facing === 'user');
            await video.play();
            await new Promise(r => (video.videoWidth ? r() : video.addEventListener('loadedmetadata', r, { once: true })));
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            $('stage').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
            hideStageMessage();
            show('liveBadge', true);
            show('stageTools', true);
            $('feedback').classList.remove('hidden');
            $('pauseBtn').disabled = false;
            running = true;
            lastVideoTime = -1;
            requestAnimationFrame(loop);
        } finally {
            $('startBtn').disabled = false;
        }
    }

    function stopCamera() {
        running = false;
        clearInterval(restTimer);
        resting = false;
        if (stream) stream.getTracks().forEach(tr => tr.stop());
        stream = null;
        video.srcObject = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        show('liveBadge', false);
        show('stageTools', false);
        $('pauseBtn').disabled = true;
        if (window.speechSynthesis) speechSynthesis.cancel();
    }

    function loop() {
        if (!running) return;
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            let lm = null;
            try {
                const result = landmarker.detectForVideo(video, performance.now());
                lm = result && result.landmarks && result.landmarks[0];
            } catch (e) {
                console.warn('[exercise] detect failed', e);
            }
            if (!paused && !resting) {
                const out = counter.update(lm || [], Date.now());
                handle(out);
                lastOut = out;
            }
            draw(lm, lastOut);
        }
        requestAnimationFrame(loop);
    }

    // ---------- Drawing the dots and lines ----------
    function draw(lm, out) {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (!lm || !lm.length) return;
        const mirror = facing === 'user';
        const px = p => ({ x: (mirror ? 1 - p.x : p.x) * w, y: p.y * h });
        const ok = p => p && (p.visibility === undefined || p.visibility > 0.4);
        const scale = Math.max(1, w / 640);
        const active = new Set((out && out.joints) || []);
        const warnJoints = new Set(((out && out.warn) || []).flatMap(wn => wn.joints));
        const good = !!out && (out.phase === 'target' || out.counted);
        const activeColor = warnJoints.size ? '#f59e0b' : good ? '#22c55e' : '#a855f7';

        // Lines
        ctx.lineCap = 'round';
        NxPose.BONES.forEach(([a, b]) => {
            if (!ok(lm[a]) || !ok(lm[b])) return;
            const A = px(lm[a]), B = px(lm[b]);
            const on = active.has(a) && active.has(b);
            ctx.strokeStyle = on ? activeColor : 'rgba(255, 255, 255, 0.75)';
            ctx.lineWidth = (on ? 7 : 4) * scale;
            ctx.shadowColor = on ? activeColor : 'transparent';
            ctx.shadowBlur = on ? 12 * scale : 0;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(B.x, B.y);
            ctx.stroke();
        });
        ctx.shadowBlur = 0;

        // Dots
        NxPose.BODY_POINTS.forEach(i => {
            if (!ok(lm[i])) return;
            const p = px(lm[i]);
            const on = active.has(i);
            const color = warnJoints.has(i) ? '#ef4444' : on ? activeColor : '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, (on ? 9 : 6) * scale, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2.5 * scale;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.stroke();
        });

        // Angle label next to the joint being measured (the middle one)
        if (out && out.status === 'tracking' && out.vertex !== undefined) {
            const j = out.vertex;
            if (ok(lm[j])) {
                const p = px(lm[j]);
                const label = `${out.angle}°`;
                ctx.font = `700 ${16 * scale}px system-ui, sans-serif`;
                const tw = ctx.measureText(label).width;
                const bx = p.x + 14 * scale, by = p.y - 30 * scale;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(bx, by, tw + 16 * scale, 26 * scale, 13 * scale) : ctx.rect(bx, by, tw + 16 * scale, 26 * scale);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillText(label, bx + 8 * scale, by + 18 * scale);
            }
        }
    }

    // ---------- Reps, sets and messages ----------
    let lastSpoken = '';
    let lastSpokenAt = 0;
    function say(text, force) {
        if (!voiceOn || !window.speechSynthesis || !text) return;
        const now = Date.now();
        if (!force && (text === lastSpoken && now - lastSpokenAt < 6000 || now - lastSpokenAt < 2500)) return;
        lastSpoken = text;
        lastSpokenAt = now;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[✓⚠️]/g, '').trim());
        u.lang = ml() ? 'ml-IN' : 'en-IN';
        u.rate = 1;
        speechSynthesis.speak(u);
    }

    function updateHud(out) {
        const reps = out.reps || 0;
        const setIndex = Math.min(totalSets, Math.floor(reps / goalReps) + 1);
        const inSet = reps >= goalReps * totalSets ? goalReps : reps - (setIndex - 1) * goalReps;
        $('repCount').textContent = inSet;
        $('repGoal').textContent = `/ ${goalReps}`;
        const circ = 326.7;
        $('ringFill').setAttribute('stroke-dashoffset', String(circ * (1 - Math.min(1, inSet / goalReps))));
        $('setLabel').textContent = x('setOf', { n: setIndex, total: totalSets });
        $('sideLabel').textContent = out.side ? x('activeSide', { side: x(out.side) }) : '';
        $('angleLabel').textContent = out.angle !== undefined ? x('angle', { a: out.angle }) : '';
        $('meterBar').style.width = `${Math.round((out.progress || 0) * 100)}%`;
    }

    function setFeedback(key) {
        const box = $('feedback');
        box.textContent = x(key);
        box.classList.toggle('good', GOOD_FB.has(key));
        box.classList.toggle('warn', WARN_FB.has(key));
    }

    let lastFeedbackKey = '';
    function handle(out) {
        updateHud(out);
        setFeedback(out.feedback);
        if (out.counted) {
            const num = $('repNum');
            num.classList.remove('pop');
            void num.offsetWidth;
            num.classList.add('pop');
            const reps = out.reps;
            const inSet = ((reps - 1) % goalReps) + 1;
            say(String(inSet), true);
            if (reps >= goalReps * totalSets) {
                setTimeout(finishSession, 600);
            } else if (reps % goalReps === 0) {
                startRest(reps / goalReps);
            }
        } else if (out.feedback !== lastFeedbackKey && WARN_FB.has(out.feedback)) {
            say(x(out.feedback));
        }
        lastFeedbackKey = out.feedback;
    }

    function startRest(setDone) {
        resting = true;
        let left = REST_SECONDS;
        const tick = () => {
            stageMessage('😮‍💨', `${x('restTitle', { n: setDone })} ${x('restText', { s: left })}`, x('skipRest'), endRest);
            $('stageMsg').style.background = 'rgba(11, 15, 23, 0.55)';
        };
        tick();
        say(x('restTitle', { n: setDone }), true);
        clearInterval(restTimer);
        restTimer = setInterval(() => {
            left--;
            if (left <= 0) endRest(); else tick();
        }, 1000);
    }
    function endRest() {
        clearInterval(restTimer);
        resting = false;
        $('stageMsg').style.background = '';
        hideStageMessage();
    }

    function finishSession() {
        const reps = counter ? counter.reps : 0;
        const ex = current;
        stopCamera();
        if (reps === 0) { backToList(); return; }     // nothing done: just go back
        saveSession(ex, reps);
        $('doneText').textContent = x('doneText', { r: reps, name: pick(ex, 'name') });
        say(x('doneTitle'), true);
        showOnly('doneView');
    }

    $('pauseBtn').addEventListener('click', () => {
        paused = !paused;
        $('pauseBtn').textContent = paused ? x('resume') : x('pause');
        if (paused) stageMessage('⏸', x('paused'), x('resume'), () => $('pauseBtn').click());
        else hideStageMessage();
    });
    $('finishBtn').addEventListener('click', finishSession);
    $('voiceBtn').addEventListener('click', () => {
        voiceOn = !voiceOn;
        try { localStorage.setItem('nxExerciseVoice', voiceOn ? 'on' : 'off'); } catch (e) {}
        $('voiceBtn').textContent = voiceOn ? x('voiceOn') : x('voiceOff');
        if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel();
    });
    $('flipBtn').addEventListener('click', async () => {
        facing = facing === 'user' ? 'environment' : 'user';
        stopCamera();
        await startCamera();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && running && !paused) $('pauseBtn').click();
    });
    window.addEventListener('pagehide', stopCamera);

    // =====================================================
    // 3. Guided exercises (no camera)
    // =====================================================
    let timerStart = 0;
    let timerUsed = 0;
    let timerHandle = null;

    function openGuided(ex) {
        current = ex;
        stopTimer();
        timerUsed = 0;
        renderGuidedTexts();
        $('guidedTimer').textContent = '00:00';
        show('guidedSaved', false);
        showOnly('guidedView');
    }
    function renderGuidedTexts() {
        if (!current) return;
        const ex = current;
        $('guidedName').textContent = pick(ex, 'name');
        $('guidedTarget').textContent = [doseText(ex), pick(ex, 'frequency')].filter(Boolean).join(' · ');
        const steps = ml() && ex.steps_ml && ex.steps_ml.length ? ex.steps_ml : ex.steps_en || [];
        $('guidedSteps').innerHTML = steps.map(s => `<li>${esc(s)}</li>`).join('');
        $('guidedCaution').textContent = pick(ex, 'caution') ? '⚠️ ' + pick(ex, 'caution') : '';
        $('guidedGoal').textContent = ex.minutes ? x('minutes', { m: ex.minutes }) : '';
        $('timerBtn').textContent = timerHandle ? x('timerPause') : x('timerStart');
    }
    function elapsed() { return timerUsed + (timerHandle ? Date.now() - timerStart : 0); }
    function paintTimer() {
        const s = Math.floor(elapsed() / 1000);
        $('guidedTimer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        if (current && current.minutes && s === current.minutes * 60) say(x('doneTitle'), true);
    }
    function stopTimer() {
        if (timerHandle) { timerUsed = elapsed(); clearInterval(timerHandle); timerHandle = null; }
    }
    $('timerBtn').addEventListener('click', () => {
        if (timerHandle) stopTimer();
        else { timerStart = Date.now(); timerHandle = setInterval(paintTimer, 250); }
        $('timerBtn').textContent = timerHandle ? x('timerPause') : x('timerStart');
    });
    $('guidedDone').addEventListener('click', () => {
        stopTimer();
        $('timerBtn').textContent = x('timerStart');
        saveSession(current, 0);
        const box = $('guidedSaved');
        box.textContent = x('savedGuided');
        box.classList.remove('hidden');
    });

    // =====================================================
    // Start
    // =====================================================
    document.addEventListener('neutrix:langchange', () => {
        applyX();
        if (!$('listView').classList.contains('hidden')) renderList();
        renderCoachTexts();
        renderGuidedTexts();
        if (lastOut) { updateHud(lastOut); setFeedback(lastOut.feedback); }
    });
    applyX();
    if (!loadReport()) {
        show('emptyView', true);
    } else {
        loadList(false);
    }

    // For testing in the browser console
    window.NxExercise = { openCoach, openGuided, get info() { return info; } };
})();
