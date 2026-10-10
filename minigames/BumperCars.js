// ============================================================
// BUMPER CARS — the fair in the Ring Road park.
// (Scaffolded from _template3d.js; see docs/MINIGAME_3D_PLAYBOOK.md.)
//
// Face-off hold, seen from above. Each player's character drives a bumper car
// round a rink on the park lawn, under the party lanterns.
//
//   DRAG on your half to drive (they slide, as bumper cars do).
//   TAP for a boost: a shove forward, then three seconds to recharge.
//
// The rail round the rink is live. Hit it hard and it zaps you: sparks, a
// moment stunned, and a point to your rival. So the game is shoving them into
// it without going in yourself. A gentle brush only bounces.
// First to 3, or the most at the bell.
//
// LIVE (MG_PROFILE.live): two, three or four cars in one rink. At three or
// four, a zap scores for whoever last bumped you (within BLAME s); drive into
// the rail on your own and nobody scores. At two it is always your rival.
// ============================================================

import { state } from '../../AppHost.js';
import { sfx, haptic } from '../engine/AudioManager.js';
import { registerMinigameCleanup, isBotSlot, slotCount } from './MinigameManager.js';
import { seatRing } from '../config/MinigameLayout.js';
import { createStage } from '../engine/Stage.js';
import { STAGE_SETS } from '../engine/StageSets.js';
import { createDirector } from '../engine/StageDirector.js';
import { seat, seatEdge, faceoffHud, touch, effects, overheadCam } from '../engine/StageKit.js';

// ── Tuning ───────────────────────────────────────────────────────────────────
const W = 9, D = 14;               // the rink
const MATCH_TIME = 45, TARGET = 3;
const READY_TIME = 1.2;
const R = 0.85;                    // car radius
const MAXV = 5.2;                  // top speed from the stick, units/s
const GRIP = 1.9;                  // how fast velocity follows the stick (low = slidey)
const DRAG_COAST = 0.55;           // per-second velocity kept when coasting
const BOOST = 6.5, BOOST_CD = 3;
const BOUNCE = 0.92;               // car-on-car restitution
const ZAP_V = 2.2;                 // speed into the rail that zaps
const STUN = 0.9, IMMUNE = 1.3;
const BLAME = 3;                   // s a bump still counts as the shove that zapped you
const FIG_SCALE = 0.72;

// ── Module state ─────────────────────────────────────────────────────────────
let _done = false, _onWin = null, _botSkill = 0.55;
let _overlay = null, _stage = null, _set = null, _dir = null, _hud = null, _in = null, _fx = null;
let _n = 2, _cars = [], _score = [0, 0], _bot = [], _posts = [];
let _phase = 'intro', _phaseT = 0, _t = 0, _clock = 0;

export function start(isBot, onWin, botSkill = 0.55) {
    if (!state.mgActive) return;
    _done = false; _onWin = onWin; _botSkill = botSkill;
    _n = Math.max(2, Math.min(4, slotCount()));
    _phase = 'intro'; _phaseT = 0; _t = 0; _clock = 0; _score = new Array(_n).fill(0);
    _bot = Array.from({ length: _n }, () => ({ think: 0, tx: 0, tz: 0, boostWant: false }));
    registerMinigameCleanup(_destroy);           // R3

    const mg = document.getElementById('minigame-layer');
    _overlay = document.createElement('div');    // R2
    _overlay.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#a9d4f2;z-index:5;';
    mg.appendChild(_overlay);
    _stage = createStage(_overlay, { hold: 'faceoff', fov: 38, background: 0xa9d4f2 });
    _hud = faceoffHud(_stage);
    _in = touch(_stage, { split: 'y', onTap: slot => _boost(slot) });
    _fx = effects(_stage);
    _dir = createDirector(_stage);
    if (_stage.gl) {
        _stage.camera.up.set(0, 0, -1);
        _set = STAGE_SETS.ring(_stage, { w: W + 1.5, d: D + 1.5 });
        _buildRink();
    }
    // Two rubber posts: something to bounce off and to use as cover.
    _posts = [{ x: -W / 4, z: 0, r: 0.55 }, { x: W / 4, z: 0, r: 0.55 }];
    _posts.forEach(_buildPost);
    _cars = Array.from({ length: _n }, (_, slot) => _buildCar(slot));
    for (let slot = 0; slot < _n; slot++) _hud.hint(slot, seat(slot).bot ? '' : 'DRAG TO DRIVE · TAP TO BOOST');

    _dir.open({
        place: 'CITY RING ROAD · THE FAIR IN THE PARK', title: 'BUMPER CARS',
        sub: _n > 2 ? `${_n} CARS · SHOVE THEM INTO THE RAIL` : 'SHOVE THEM INTO THE RAIL',
        from: { pos: [7, 6, 13], look: [0, 0, 0] },
        to: overheadCam(_stage, W, D, 7),
        onDone: () => { if (!_done) _enter('ready'); },
    });
    _stage.start(_frame);
}

function _destroy() {
    _done = true;
    if (_stage) { _stage.dispose(); _stage = null; }
    if (_overlay) { _overlay.remove(); _overlay = null; }
    _cars = []; _posts = []; _set = null; _dir = null; _hud = null; _in = null; _fx = null;
}
function _finish(w, rank) { if (_done) return; _destroy(); _onWin?.(w, null, rank); }

// ── The rink ─────────────────────────────────────────────────────────────────
let _railMats = [];
function _buildRink() {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.12, D + 0.6),
        new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.35, metalness: 0.4 }));
    floor.position.y = 0.06; floor.receiveShadow = true; _stage.add(floor);
    // Floor stripes: a checker of darker panels, so movement reads.
    const panel = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.4, metalness: 0.4 });
    for (let x = 0; x < 3; x++) for (let z = 0; z < 5; z++) {
        if ((x + z) % 2) continue;
        const p = new THREE.Mesh(new THREE.BoxGeometry(W / 3 - 0.05, 0.01, D / 5 - 0.05), panel);
        p.position.set(-W / 2 + (x + 0.5) * W / 3, 0.125, -D / 2 + (z + 0.5) * D / 5); p.receiveShadow = true; _stage.add(p);
    }
    // The live rail: yellow-and-black, glowing. It flashes on a zap.
    _railMats = [];
    const rail = (x, z, lw, ld) => {
        const m = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.25, roughness: 0.4 });
        const r = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.45, ld), m);
        r.position.set(x, 0.35, z); r.castShadow = true; _stage.add(r);
        _railMats.push(m);
    };
    rail(0, -D / 2 - 0.15, W + 0.6, 0.3); rail(0, D / 2 + 0.15, W + 0.6, 0.3);
    rail(-W / 2 - 0.15, 0, 0.3, D); rail(W / 2 + 0.15, 0, 0.3, D);
}
function _buildPost(p) {
    if (!_stage.gl) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.7, 20),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 }));
    m.position.set(p.x, 0.47, p.z); m.castShadow = true; _stage.add(m);
    const band = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.08, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    band.rotation.x = Math.PI / 2; band.position.set(p.x, 0.6, p.z); _stage.add(band);
}

// ── Cars ─────────────────────────────────────────────────────────────────────
function _buildCar(slot) {
    // Each car starts at its own driver's end of the rink, under their zone:
    // at two, the middle of each end, as it shipped; at four, the corners.
    const near = seatEdge(slot) === 'bottom';
    const span = _n > 2 ? seatRing(_n)[slot].span : [0, 1];
    const c = { slot, x: ((span[0] + span[1]) / 2 - 0.5) * W, z: (near ? 1 : -1) * (D / 2 - 2), vx: 0, vz: 0, head: near ? Math.PI : 0,
                cd: 0, stun: 0, immune: 0, spin: 0, by: -1, byAt: -99 };
    if (!_stage.gl) return c;
    const col = seat(slot).color;
    const g = new THREE.Group();
    const bumper = new THREE.Mesh(new THREE.TorusGeometry(R - 0.12, 0.14, 10, 28), new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.8 }));
    bumper.rotation.x = Math.PI / 2; bumper.position.y = 0.3; g.add(bumper);
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.18, R - 0.1, 0.45, 24),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.3 }));
    tub.position.y = 0.45; g.add(tub);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.3 }));
    nose.position.set(0, 0.6, R - 0.35); g.add(nose);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    lamp.position.set(0, 0.75, R - 0.12); g.add(lamp);
    // The pole to the ceiling grid, with its spark at the top.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7 }));
    pole.position.set(0, 1.55, -R + 0.3); g.add(pole);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
    spark.position.set(0, 2.7, -R + 0.3); g.add(spark);
    g.traverse(o => { if (o.isMesh && o !== spark && o !== lamp) o.castShadow = true; });
    _stage.add(g);
    const ch = _stage.character(slot);
    ch.rig.root.scale.setScalar(FIG_SCALE);
    ch.rig.root.position.set(0, 0.35, -0.05);
    g.add(ch.rig.root);
    ch.anim.play('ready');
    Object.assign(c, { g, tub, spark, rig: ch.rig, anim: ch.anim });
    return c;
}

function _boost(slot) {
    const c = _cars[slot];
    if (!c || _phase !== 'play' || c.cd > 0 || c.stun > 0) return;
    c.vx += Math.sin(c.head) * BOOST; c.vz += Math.cos(c.head) * BOOST;
    c.cd = BOOST_CD;
    sfx('boost'); haptic([20]);
    if (_stage?.gl) _fx.puff(new THREE.Vector3(c.x - Math.sin(c.head) * R, 0.4, c.z - Math.cos(c.head) * R), 0xcfd6dd, 5, 0.3, 0.6);
}

// ── Bot (§5) ─────────────────────────────────────────────────────────────────
// Get round behind the rival, on the far side from their nearest rail, and
// drive through them toward it. Keep off its own rail. Boost when lined up.
function _botDrive(slot, dt) {
    const me = _cars[slot], b = _bot[slot];
    // The rival to go after: the nearest car that isn't spinning out.
    let them = null, bd = Infinity;
    _cars.forEach(o => { if (o === me) return; const d = Math.hypot(o.x - me.x, o.z - me.z) + (o.stun > 0 ? 6 : 0); if (d < bd) { bd = d; them = o; } });
    b.think -= dt;
    if (b.think <= 0) {
        b.think = 0.45 - _botSkill * 0.3 + Math.random() * 0.2;
        // The rival's nearest rail, as an outward normal.
        const dists = [[W / 2 - them.x, 1, 0], [them.x + W / 2, -1, 0], [D / 2 - them.z, 0, 1], [them.z + D / 2, 0, -1]];
        dists.sort((a, c) => a[0] - c[0]);
        const [, nx, nz] = dists[0];
        const behind = 1.6 + (1 - _botSkill) * 1.5;
        const noise = (1 - _botSkill) * 1.6;
        b.tx = them.x - nx * behind + (Math.random() - 0.5) * noise;
        b.tz = them.z - nz * behind + (Math.random() - 0.5) * noise;
        const dMe = Math.hypot(them.x - me.x, them.z - me.z);
        // Close enough and on the right side: drive straight through them.
        const side = (me.x - them.x) * nx + (me.z - them.z) * nz;
        if (dMe < 3.2 && side < 0) { b.tx = them.x + nx * 2; b.tz = them.z + nz * 2; }
        b.boostWant = dMe < 3.4 && side < 0 && Math.random() < 0.35 + _botSkill * 0.5;
    }
    let dx = b.tx - me.x, dz = b.tz - me.z;
    // Stay off its own rail.
    const m = 1.4;
    if (me.x > W / 2 - m) dx -= 3; if (me.x < -W / 2 + m) dx += 3;
    if (me.z > D / 2 - m) dz -= 3; if (me.z < -D / 2 + m) dz += 3;
    const d = Math.hypot(dx, dz) || 1;
    if (b.boostWant) {
        const toThem = Math.atan2(them.x - me.x, them.z - me.z);
        let off = toThem - me.head; off = Math.atan2(Math.sin(off), Math.cos(off));
        if (Math.abs(off) < 0.35) { _boost(slot); b.boostWant = false; }
    }
    const k = 0.75 + 0.25 * _botSkill;
    return { dx: dx / d * k, dz: dz / d * k };
}

// ── The loop ─────────────────────────────────────────────────────────────────
function _enter(phase) {
    _phase = phase; _phaseT = 0;
    if (phase === 'ready') _hud.say('GO!', 'SHOVE THEM INTO THE RAIL', READY_TIME * 1000, _t);
    else if (phase === 'play') sfx('go');
}

// Who a zap scores for: at two, always the rival; at three or four, whoever
// bumped this car last, if it was recent enough to be the shove that did it.
function _blame(c) {
    if (_n === 2) return 1 - c.slot;
    return c.by >= 0 && _t - c.byAt <= BLAME ? c.by : -1;
}

function _zap(c) {
    c.stun = STUN; c.immune = IMMUNE; c.spin = 1;
    const by = _blame(c);
    if (by >= 0) _score[by]++;
    sfx('boom'); haptic([80]);
    _railMats.forEach(m => { m.emissiveIntensity = 1.4; });
    if (_stage?.gl) {
        const at = new THREE.Vector3(c.x, 0.8, c.z);
        _fx.burst(at, 0x7dd3fc, 0.7, 0.25);
        _fx.confetti(at, [0xfacc15, 0x7dd3fc, 0xffffff], 14, 3);
        c.anim.flinch?.();
    }
    if (by >= 0) _hud.say('ZAP!', `${seat(by).name} +1`, 900, _t, seat(by).css);
    else _hud.say('ZAP!', `${seat(c.slot).name} DROVE IN`, 900, _t, seat(c.slot).css);
    if (by >= 0 && _score[by] >= TARGET) _end();
}

function _frame(dt) {
    if (_done) return;
    _t += dt; _phaseT += dt;
    _hud.tick(_t);
    if (_phase === 'ready' && _phaseT > READY_TIME) _enter('play');

    if (_phase === 'play') {
        _clock += dt;
        _cars.forEach(c => {
            c.cd = Math.max(0, c.cd - dt); c.stun = Math.max(0, c.stun - dt); c.immune = Math.max(0, c.immune - dt);
            let mv = { dx: 0, dz: 0 };
            if (c.stun <= 0) mv = isBotSlot(c.slot) ? _botDrive(c.slot, dt) : (s => ({ dx: s.dx, dz: s.dy }))(_in.seat(c.slot));
            const m = Math.min(1, Math.hypot(mv.dx, mv.dz));
            if (m > 0.12) {
                const k = Math.min(1, GRIP * dt);
                c.vx += (mv.dx / Math.hypot(mv.dx, mv.dz) * m * MAXV - c.vx) * k;
                c.vz += (mv.dz / Math.hypot(mv.dx, mv.dz) * m * MAXV - c.vz) * k;
                let d = Math.atan2(mv.dx, mv.dz) - c.head; d = Math.atan2(Math.sin(d), Math.cos(d));
                c.head += Math.max(-6 * dt, Math.min(6 * dt, d));
            } else {
                const keep = Math.pow(DRAG_COAST, dt);
                c.vx *= keep; c.vz *= keep;
            }
            c.x += c.vx * dt; c.z += c.vz * dt;
            // The rail: a hard hit zaps, a brush bounces.
            const lim = [[c.x - (W / 2 - R), 1, 0], [-(W / 2 - R) - c.x, -1, 0], [c.z - (D / 2 - R), 0, 1], [-(D / 2 - R) - c.z, 0, -1]];
            lim.forEach(([over, nx, nz]) => {
                if (over <= 0) return;
                c.x -= nx * over; c.z -= nz * over;
                const vn = c.vx * nx + c.vz * nz;
                if (vn <= 0) return;
                const e = vn > ZAP_V ? 0.7 : 0.35;
                c.vx -= (1 + e) * vn * nx; c.vz -= (1 + e) * vn * nz;
                if (vn > ZAP_V && c.immune <= 0 && _phase === 'play') _zap(c);
                else if (vn > 0.8) sfx('slam');
            });
            // Posts bounce.
            _posts.forEach(p => {
                const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz), min = R + p.r;
                if (d >= min || d < 1e-4) return;
                const nx = dx / d, nz = dz / d;
                c.x = p.x + nx * min; c.z = p.z + nz * min;
                const vn = c.vx * nx + c.vz * nz;
                if (vn < 0) { c.vx -= 1.8 * vn * nx; c.vz -= 1.8 * vn * nz; if (vn < -1) sfx('slam'); }
            });
        });
        // Car on car, every pair: equal masses, bouncy.
        for (let i = 0; i < _cars.length; i++) for (let j = i + 1; j < _cars.length; j++) _bump(_cars[i], _cars[j]);
        if (MATCH_TIME - _clock < 5.05 && MATCH_TIME - _clock > 4.95) _hud.say('5 SECONDS!', '', 900, _t, '#facc15');
        if (_clock >= MATCH_TIME && _phase === 'play') _end();
    }
    _draw(dt);
}

function _bump(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < R * 2 && d > 1e-4) {
        const nx = dx / d, nz = dz / d, over = R * 2 - d;
        a.x -= nx * over / 2; a.z -= nz * over / 2; b.x += nx * over / 2; b.z += nz * over / 2;
        const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (rel > 0) {
            const j = (1 + BOUNCE) * rel / 2;
            a.vx -= j * nx; a.vz -= j * nz; b.vx += j * nx; b.vz += j * nz;
            // Each remembers who hit it, for the blame if it hits the rail.
            a.by = b.slot; a.byAt = _t; b.by = a.slot; b.byAt = _t;
            if (rel > 1.2) {
                sfx('slam'); haptic([rel > 4 ? 45 : 20]);
                if (_stage?.gl && rel > 3) _fx.burst(new THREE.Vector3((a.x + b.x) / 2, 0.6, (a.z + b.z) / 2), 0xffffff, 0.35, 0.18);
            }
        }
    }
}

function _draw(dt) {
    _railMats.forEach(m => { m.emissiveIntensity += (0.25 + Math.sin(_t * 6) * 0.08 - m.emissiveIntensity) * Math.min(1, dt * 4); });
    _cars.forEach(c => {
        if (!c.g) return;
        if (c.spin > 0) { c.spin = Math.max(0, c.spin - dt * 1.2); c.head += dt * 14 * c.spin; }
        c.g.position.set(c.x, 0, c.z);
        c.g.rotation.y = c.head;
        c.spark.material.color.setHex(Math.random() < 0.5 ? 0x7dd3fc : 0xffffff);
        c.spark.scale.setScalar(0.8 + Math.random() * 0.6);
        const speed = Math.hypot(c.vx, c.vz);
        c.anim.play(c.stun > 0 ? 'hit' : speed > 3 ? 'aim' : 'ready');
    });
    _set?.update?.(dt, _t);
    _fx?.update(dt);
    const dirOwns = !!_dir && _dir.update(dt);
    if (_done) return;
    if (!dirOwns && _stage?.gl && _phase !== 'over') {
        const c = overheadCam(_stage, W, D, 7);
        _stage.camera.position.fromArray(c.pos);
        _stage.camera.lookAt(0, 0, 0);
    }
    _renderHud();
}

function _renderHud() {
    if (!_hud) return;
    const left = Math.max(0, Math.ceil(MATCH_TIME - _clock));
    for (let slot = 0; slot < _n; slot++) {
        const c = _cars[slot];
        const boost = !c ? '' : c.cd > 0 ? `BOOST ${c.cd.toFixed(1)}s` : 'BOOST READY';
        _hud.line(slot, _n > 2 ? `⚡ ${_score[slot]} · ${left}s` : `⚡ YOU ${_score[slot]} · ${left}s · THEM ${_score[1 - slot]}`);
        if (_clock > 6 || seat(slot).bot) _hud.hint(slot, seat(slot).bot ? '' : boost);
    }
    const el = document.getElementById('mg-neutral');
    if (el && _phase === 'play') el.textContent = _n > 2 ? `${left}s · ${_leadLine()}`
        : `${left}s · ${seat(0).name} ${_score[0]} – ${_score[1]} ${seat(1).name}`;
}

// Four names don't fit the strip; the leader does (each seat's own count is in
// its own zone).
function _leadLine() {
    const top = Math.max(..._score), at = _score.filter(v => v === top).length;
    return at > 1 ? (top ? `${at} TIED ON ${top}` : 'ALL LEVEL') : `${seat(_score.indexOf(top)).name} LEADS · ${top}`;
}

function _end() {
    if (_phase === 'over') return;
    _phase = 'over';
    _hud.say('');
    // The most zaps wins; a share of the top is a draw.
    const top = Math.max(..._score);
    const leaders = _score.reduce((a, v, i) => (v === top ? a.concat(i) : a), []);
    const w = leaders.length === 1 ? leaders[0] : -1;
    const rest = w < 0 ? 0 : Math.max(..._score.filter((_, i) => i !== w));
    _dir.close({
        winner: w, figs: _cars.filter(c => c.rig).map(c => ({ slot: c.slot, rig: c.rig, anim: c.anim })),
        sub: w < 0 ? `${top} ZAPS APIECE` : `${_score[w]} ZAPS TO ${rest}`,
        closeUp: (f, p) => ({ pos: [p.x + 2, p.y + 7, p.z + (seatEdge(f.slot) === 'bottom' ? 1 : -1) * 6.5], look: [p.x, p.y + 0.6, p.z] }),
        onDone: () => _finish(w, [..._score]),
    });
    const el = document.getElementById('mg-neutral');
    if (el) el.textContent = w < 0 ? 'DRAW!' : `${seat(w).name} WINS!`;
}

// ── Probe hooks ──────────────────────────────────────────────────────────────
export function _debugState() {
    return { phase: _phase, n: _n, clock: +_clock.toFixed(2), score: [..._score],
             cars: _cars.map(c => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), v: +Math.hypot(c.vx, c.vz).toFixed(2), cd: +c.cd.toFixed(2), stun: +c.stun.toFixed(2), by: c.by })),
             gl: !!_stage?.gl, turned: !!_stage?.turned };
}
/** Probes: put a car somewhere, moving. */
export function _debugPlace(slot, x, z, vx = 0, vz = 0) { const c = _cars[slot]; if (c) Object.assign(c, { x, z, vx, vz, immune: 0, stun: 0, by: -1, byAt: -99 }); }
