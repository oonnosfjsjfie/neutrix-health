// =====================================================
// exercise-pose.js — the maths behind the camera exercise coach
//
// Works on the 33 body points from MediaPipe Pose (x, y between 0 and 1, plus "visibility").
// For each movement it measures one main joint angle, counts repetitions,
// and checks the form (for example "keep your elbow straight").
// No camera or drawing here, so it can be tested on its own.
// =====================================================
(function (root) {
    // MediaPipe Pose point numbers ("left" = the person's own left side)
    const P = {
        nose: 0,
        lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
        lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28
    };

    // Lines drawn between points (the "stick figure")
    const BONES = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
        [11, 23], [12, 24], [23, 24],
        [23, 25], [25, 27], [24, 26], [26, 28]
    ];
    const BODY_POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

    // Angle at point b (degrees, 0–180) between a-b and c-b
    function angle(a, b, c) {
        if (!a || !b || !c) return null;
        const v1x = a.x - b.x, v1y = a.y - b.y;
        const v2x = c.x - b.x, v2y = c.y - b.y;
        const len = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
        if (!len) return null;
        const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / len));
        return Math.acos(cos) * 180 / Math.PI;
    }

    // How far the line a→b leans away from straight up/down (degrees)
    function leanFromVertical(top, bottom) {
        if (!top || !bottom) return null;
        return Math.atan2(Math.abs(top.x - bottom.x), Math.abs(top.y - bottom.y)) * 180 / Math.PI;
    }

    function side(s) {
        return s === 'left'
            ? { shoulder: P.lShoulder, elbow: P.lElbow, wrist: P.lWrist, hip: P.lHip, knee: P.lKnee, ankle: P.lAnkle }
            : { shoulder: P.rShoulder, elbow: P.rElbow, wrist: P.rWrist, hip: P.rHip, knee: P.rKnee, ankle: P.rAnkle };
    }

    // ---------- The movements ----------
    // start / target: main angle at rest and at the goal position.
    // joints: points that must be visible.  form(): extra checks, each { ok, key, joints }.
    const MOVES = {
        // Lift the arm forward or sideways to shoulder height (angle at the shoulder: hip–shoulder–elbow)
        arm_raise: {
            vertex: s => s.shoulder,          // the joint whose angle is measured
            part: 'arm',
            start: 35, target: 80,
            joints: s => [s.hip, s.shoulder, s.elbow, s.wrist],
            main: (lm, s) => angle(lm[s.hip], lm[s.shoulder], lm[s.elbow]),
            form: (lm, s, progress) => {
                const elbow = angle(lm[s.shoulder], lm[s.elbow], lm[s.wrist]);
                return progress > 0.3 && elbow !== null && elbow < 140
                    ? [{ ok: false, key: 'fbElbowStraight', joints: [s.elbow] }] : [];
            },
            tooLow: 'fbRaiseHigher', good: 'fbArmUp', back: 'fbLowerSlowly'
        },
        // Bend the elbow and straighten it again (angle at the elbow: shoulder–elbow–wrist)
        elbow_bend: {
            vertex: s => s.elbow,          // the joint whose angle is measured
            part: 'arm',
            start: 145, target: 65,
            joints: s => [s.shoulder, s.elbow, s.wrist, s.hip],
            main: (lm, s) => angle(lm[s.shoulder], lm[s.elbow], lm[s.wrist]),
            form: (lm, s) => {
                const upperArm = angle(lm[s.hip], lm[s.shoulder], lm[s.elbow]);
                return upperArm !== null && upperArm > 40
                    ? [{ ok: false, key: 'fbElbowClose', joints: [s.shoulder, s.elbow] }] : [];
            },
            tooLow: 'fbBendMore', good: 'fbBentWell', back: 'fbStraightenArm'
        },
        // Stand up from a chair and sit back down (angle at the knee: hip–knee–ankle)
        sit_to_stand: {
            vertex: s => s.knee,          // the joint whose angle is measured
            part: 'legs',
            start: 115, target: 160,
            joints: s => [s.shoulder, s.hip, s.knee, s.ankle],
            main: (lm, s) => angle(lm[s.hip], lm[s.knee], lm[s.ankle]),
            form: (lm, s, progress) => {
                const lean = leanFromVertical(lm[s.shoulder], lm[s.hip]);
                return progress > 0.9 && lean !== null && lean > 30
                    ? [{ ok: false, key: 'fbStandTall', joints: [s.shoulder, s.hip] }] : [];
            },
            tooLow: 'fbStandFully', good: 'fbStanding', back: 'fbSitSlowly'
        },
        // Sitting, straighten the knee (angle at the knee: hip–knee–ankle)
        knee_extension: {
            vertex: s => s.knee,          // the joint whose angle is measured
            part: 'legs',
            start: 120, target: 155,
            joints: s => [s.hip, s.knee, s.ankle],
            main: (lm, s) => angle(lm[s.hip], lm[s.knee], lm[s.ankle]),
            form: () => [],
            tooLow: 'fbStraightenKnee', good: 'fbKneeStraight', back: 'fbLowerLeg'
        },
        // Lift one knee at a time (angle at the hip: shoulder–hip–knee)
        marching: {
            vertex: s => s.hip,          // the joint whose angle is measured
            part: 'legs',
            start: 160, target: 130,
            joints: s => [s.shoulder, s.hip, s.knee],
            main: (lm, s) => angle(lm[s.shoulder], lm[s.hip], lm[s.knee]),
            form: (lm, s) => {
                const lean = leanFromVertical(lm[s.shoulder], lm[s.hip]);
                return lean !== null && lean > 25
                    ? [{ ok: false, key: 'fbStandTall', joints: [s.shoulder, s.hip] }] : [];
            },
            tooLow: 'fbKneeHigher', good: 'fbKneeUp', back: 'fbFootDown'
        }
    };

    const MIN_VISIBILITY = 0.5;

    function visible(lm, ids) {
        return ids.every(i => lm[i] && (lm[i].visibility === undefined || lm[i].visibility >= MIN_VISIBILITY));
    }

    // 0 at the start position, 1 at the target (can go a little past either end)
    function progressOf(move, value) {
        return (value - move.start) / (move.target - move.start);
    }

    // ---------- Rep counter for one exercise ----------
    // options: { move, side: 'left'|'right'|'both', holdSeconds }
    function createCounter(options) {
        const move = MOVES[options.move];
        if (!move) throw new Error('Unknown movement: ' + options.move);
        const sides = options.side === 'left' ? ['left'] : options.side === 'right' ? ['right'] : ['left', 'right'];
        const holdMs = (options.holdSeconds || 0) * 1000;

        const state = {
            reps: 0,
            phase: 'start',        // 'start' → moving towards the goal, 'target' → reached it, coming back
            peak: 0,               // best progress in this attempt
            smooth: {},            // smoothed angle per side
            activeSide: sides[0],
            reachedAt: 0,
            held: false,
            lastFeedback: 'fbGetReady',
            stickyUntil: 0
        };

        // One camera frame. Returns what the page needs to show.
        function update(landmarks, now) {
            now = now || Date.now();
            if (!landmarks || !landmarks.length) {
                return { status: 'nobody', feedback: 'fbNobody', reps: state.reps, progress: 0, joints: [], warn: [] };
            }

            // Measure each allowed side that the camera can see
            const measured = [];
            for (const name of sides) {
                const s = side(name);
                if (!visible(landmarks, move.joints(s))) continue;
                const raw = move.main(landmarks, s);
                if (raw === null) continue;
                const prev = state.smooth[name];
                const value = prev === undefined ? raw : prev * 0.4 + raw * 0.6;   // calm the jitter
                state.smooth[name] = value;
                measured.push({ name, s, value, progress: progressOf(move, value) });
            }
            if (!measured.length) {
                return { status: 'hidden', feedback: move.part === 'arm' ? 'fbShowArm' : 'fbShowLegs',
                         reps: state.reps, progress: 0, joints: [], warn: [] };
            }

            // Keep following the same side during an attempt; otherwise use the side that moves most
            let pick = measured.find(m => m.name === state.activeSide);
            if (state.phase === 'start') {
                const most = measured.reduce((a, b) => (b.progress > a.progress ? b : a));
                if (!pick || most.progress > pick.progress + 0.15) pick = most;
            }
            if (!pick) pick = measured[0];
            state.activeSide = pick.name;

            const progress = pick.progress;
            const checks = move.form(landmarks, pick.s, progress) || [];
            const warn = checks.filter(c => !c.ok);
            let feedback = state.lastFeedback;
            let counted = false;

            const sticky = msg => { feedback = msg; state.stickyUntil = now + 1500; };   // keep this message on screen a moment
            const calm = now >= (state.stickyUntil || 0);

            if (state.phase === 'start') {
                state.peak = Math.max(state.peak, progress);
                if (progress >= 1) {
                    state.phase = 'target';
                    state.reachedAt = now;
                    state.held = holdMs === 0;
                    feedback = move.good;
                    state.stickyUntil = 0;
                } else if (progress <= 0.15) {
                    if (state.peak >= 0.35) sticky(move.tooLow);     // went back without reaching the goal
                    else if (calm) feedback = state.reps === 0 ? 'fbStartMoving' : 'fbNextRep';
                    state.peak = progress <= 0.15 ? 0 : state.peak;
                } else {
                    feedback = move.tooLow;                          // on the way: keep going
                }
            } else {
                if (!state.held && progress >= 0.85 && now - state.reachedAt >= holdMs) state.held = true;
                if (progress < 0.85 && !state.held) {
                    state.phase = 'start';                           // came back too early during a hold
                    state.peak = 0;
                    sticky('fbHoldLonger');
                } else if (progress <= 0.15) {
                    state.phase = 'start';
                    state.peak = 0;
                    state.reps++;
                    counted = true;
                    sticky('fbGoodRep');
                } else if (!state.held) {
                    feedback = 'fbHold';
                } else {
                    feedback = move.back;
                }
            }
            if (warn.length && !counted) feedback = warn[0].key;
            state.lastFeedback = feedback;

            const holdLeft = state.phase === 'target' && !state.held
                ? Math.max(0, Math.ceil((holdMs - (now - state.reachedAt)) / 1000)) : 0;

            return {
                status: 'tracking',
                side: pick.name,
                angle: Math.round(pick.value),
                progress: Math.max(0, Math.min(1, progress)),
                phase: state.phase,
                reps: state.reps,
                counted,
                feedback,
                holdLeft,
                joints: move.joints(pick.s),
                vertex: move.vertex(pick.s),
                warn
            };
        }

        function reset() {
            state.reps = 0;
            state.phase = 'start';
            state.peak = 0;
            state.smooth = {};
            state.lastFeedback = 'fbGetReady';
            state.stickyUntil = 0;
        }

        return { update, reset, get reps() { return state.reps; } };
    }

    const api = { P, BONES, BODY_POINTS, MOVES, angle, leanFromVertical, createCounter, trackable: m => !!MOVES[m] };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NxPose = api;
})(typeof window !== 'undefined' ? window : globalThis);
