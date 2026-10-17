// ============================================================
// MINI GOLF — a real round of crazy golf: themed courses, par, a scorecard.
//
// The phone lies sideways between you (the side hold). Two ways to play:
//
//   TURNS (the default) — proper golf. One ball at a time and the camera
//     follows it: a flyover of each hole first, then the camera sits behind
//     your ball. Honours on the tee, then whoever is furthest from the cup
//     ("away") goes next. The other balls stay where they stopped, so you can
//     knock them about.
//   CHAOS — everyone at once on the one overhead view, a strip of the screen
//     each, putting again as soon as your ball stops.
//
//   PRESS THE BALL, PULL BACK and LET GO: a slingshot. The ball goes the opposite
//   way to your pull, the further the harder (soft at first, for putts). A short
//   arrow shows the way, a band stretches back from the ball with the power, a tick under
//   your thumb every tenth — no predicted path, you read the green. Taking turns,
//   a swipe anywhere off the ball orbits the camera round it and tilts it.
//
// The courses are data (golf/Courses.js), the ball is golf/Physics.js — slopes,
// hills, ramps and jumps, rails, bumpers, windmills, sweepers, sliders, pipes,
// water, sand — and golf/Build.js draws it all from the same numbers.
//
// A party plays a three-hole sampler. The Mini Golf mode (configure()) plays a
// whole course, 9 holes or 18, in either mode.
//
// Fewest strokes wins. Level: countback from the last hole (turns), or the
// quicker total time (chaos). A hole is picked up at par + 3.
// ============================================================

import { state } from '../../AppHost.js';
import { sfx, haptic } from '../engine/AudioManager.js';
import { registerMinigameCleanup, isBotSlot as _botSlot, slotCount, extendWatchdog } from './MinigameManager.js';
import * as Solo from './SoloArena.js';
import * as GolfFx from './golf/Fx.js';
import { createStage } from '../engine/Stage.js';
import { createDirector } from '../engine/StageDirector.js';
import { seat, uprightHud, effects } from '../engine/StageKit.js';
import { MG_ORIENTATION_OVERRIDE } from '../config/MinigameRegistry.js';
import * as P from './golf/Physics.js';
import { plan, planSteps } from './golf/Bot.js';
import { COURSES, courseByKey, coursePar, CHALLENGES } from './golf/Courses.js';
/** Trick shots the Mini Golf mode offers: configure({ challenge }) plays one. */
export { CHALLENGES };
import { buildHole, animateProps } from './golf/Build.js';

// ── Tuning ───────────────────────────────────────────────────────────────────
const SAMPLER = 3;                     // holes in a party's round
const PULL = 0.4;                      // a full pull, as a fraction of the screen's short side
const MIN_PULL = 0.05;
const BALL_HIT = 56;                   // px: a press this close to your ball takes it (else it's a look)
const LOOK_YAW = 0.0065, LOOK_TILT = 0.004;   // swipe to orbit / tilt, per px
const TILT_MIN = 0.55, TILT_MAX = 2.3;                 // less than this and the drag is cancelled
// No shot clock on a person: take as long as you like. A bot takes BOT_DELAY
// seconds over every shot, so a table can watch it line up.
const BOT_DELAY = 5;
const ROLL_MAX = 14;                   // s a ball may roll before it's called stopped
const FLY_DUR = 3.2;
const CARD_DUR = 4.6, CARD_MIN = 1.0;
const HOLE_WATCHDOG = 6 * 60 * 1000;   // the manager's backstop, pushed on at every hole
const CAM_BACK = 6.4, CAM_UP = 4.1, CAM_AHEAD = 3.6;   // behind the ball, portrait
const TEE_SPREAD = 0.42;

// ── Configuration (the Mini Golf mode sets it; a party uses the defaults) ─────
// `round`: the next game is the Mini Golf mode's own round, played in its saved
// mode. Anything else — a party, Quick Play, HundredBlockDash — is CHAOS, so
// golf takes about as long as the games around it.
const DEFAULTS = { course: null, holes: 'sampler', mode: 'turns', round: false };
let _cfg = { ...DEFAULTS };
/**
 * { course: key | null (random), holes: 'sampler' | 9 | 18, mode: 'turns' | 'chaos', round }.
 * The mode sticks until changed (it's a setting) but only applies with `round`
 * (the Mini Golf mode's own round). The course, the number of holes and `round`
 * are for the NEXT game only: a party after a full course is a chaos sampler again.
 */
export function configure(o = {}) {
    _cfg = { ..._cfg, ...o };
    // Turns is passed round; chaos is everyone at once round the one phone. Both upright.
    if (_cfg.round && _cfg.mode !== 'chaos') MG_ORIENTATION_OVERRIDE.minigolf = 'putt'; else delete MG_ORIENTATION_OVERRIDE.minigolf;   // 'puttall' otherwise
    return { ..._cfg };
}
export function configured() { return { ..._cfg }; }
export function resetConfig() { _cfg = { ...DEFAULTS }; }
export const COURSE_LIST = COURSES.map(c => ({ key: c.key, name: c.name, blurb: c.blurb, holes: c.holes.length, par: coursePar(c) }));

// ── Module state ─────────────────────────────────────────────────────────────
let _done = false, _onWin = null, _botSkill = 0.55;
let _gfx = null;   // the hole's atmosphere and sparks (golf/Fx.js)
// Which round this is. Anything that fires later (a timer, the outro's onDone)
// checks it: a round that's been force-ended must not reach into the next one.
let _gen = 0;
// A trick-shot challenge (configure({ challenge })): one hole, one ball, from a
// set spot; sink it in one, with `tries` goes at it. { id, key, from, tries, name }.
let _chal = null;
// The physics clock (it runs slow near the cup), a camera shake, and the hole-in-one show.
let _pt = 0, _slow = 1, _shake = 0, _ace = null;
let _overlay = null, _stage = null, _dir = null, _hud = null, _fx = null, _lights = null;
let _n = 2, _mode = 'turns', _list = [], _hole = -1, _c = null, _built = null, _theme = null, _courseName = '';
let _balls = [], _figs = [], _kits = [], _strokes = [], _times = [], _honors = [];
let _phase = 'intro', _sub = '', _subT = 0, _t = 0, _holeT = 0;
let _active = -1, _turnT = 0, _turnState = 'aim', _botThink = null, _shooter = -1, _nextWait = 0.7, _holder = -1, _pass = null;
let _cam = null, _yaw = 0, _tilt = 1, _look = null, _view = 'follow', _drag = new Map(), _ui = null, _card = null, _say2 = null;

const _seats = () => Array.from({ length: _n }, (_, i) => i);
// Across phones (SoloArena) the one ball is always the person holding it.
const _isBot = slot => !Solo.isSolo() && _botSlot(slot);
/** Stableford: 2 for a par, one more for each under, one less over, never below 0. */
const _stableford = slot => _list.reduce((a, x, i) => a + (_strokes[slot]?.[i] ? Math.max(0, 2 + x.hole.par - _strokes[slot][i]) : 0), 0);
/** SoloArena: the points banked so far (a round cut off still counts what's done). */
export function soloScore() { return _strokes.length ? _stableford(0) : 0; }
const _limit = h => h.par + 3;

export function start(isBot, onWin, botSkill = 0.55) {
    if (!state.mgActive) return;
    _done = false; _onWin = onWin; _botSkill = botSkill;
    _gen++;
    // Solo (the Mini Golf mode only): one ball against par, played like turns.
    _n = Solo.isSolo() ? 1 : Math.max(1, Math.min(4, slotCount()));
    _mode = _n === 1 ? 'turns' : _cfg.round ? (_cfg.mode === 'chaos' ? 'chaos' : 'turns') : 'chaos';
    _chal = !Solo.isSolo() && _cfg.challenge ? { tries: 3, ..._cfg.challenge } : null;
    if (_chal) { _n = 1; _mode = 'turns'; }
    _list = _pickHoles();
    _cfg = { ..._cfg, course: null, holes: 'sampler', round: false, challenge: null };
    _last = null;
    _phase = 'intro'; _sub = ''; _subT = 0; _t = 0; _hole = -1; _active = -1;
    _pt = 0; _slow = 1; _shake = 0; _ace = null;
    _strokes = _seats().map(() => []); _times = _seats().map(() => []);
    _honors = _seats();
    _view = 'follow'; _drag = new Map(); _look = null; _tilt = 1;
    registerMinigameCleanup(_destroy);

    const course = courseByKey(_list[0].course);
    _theme = course.theme; _courseName = course.name;
    const mg = document.getElementById('minigame-layer');
    _overlay = document.createElement('div');
    _overlay.style.cssText = `position:absolute;inset:0;overflow:hidden;background:#${_theme.sky.toString(16).padStart(6, '0')};z-index:5;`;
    mg.appendChild(_overlay);
    // Upright either way. Turns: passed round. Chaos: one picture of the hole,
    // the screen split across the middle into a band each to drag in.
    _stage = createStage(_overlay, { hold: 'upright', fov: 56, background: _theme.sky });
    _hud = _mode === 'turns' ? _turnsHud(_stage) : _chaosHud(_stage);
    _holder = -1; _pass = null;
    _fx = effects(_stage);
    _dir = createDirector(_stage);
    if (_stage.gl) {
        _lights = _stage.light({ span: 16, dir: [-9, 16, 11], sunI: 1.1, sky: 0xdfefff, ground: 0x5a7a3a, hemiI: 0.5, rimI: 0.3 });
        if (_lights) _stage.scene.add(_lights.key.target);
        _stage.scene.fog = new THREE.Fog(_theme.fog ?? _theme.sky, 38, 90);
        _cam = { pos: new THREE.Vector3(0, 10, 10), look: new THREE.Vector3() };
    }
    _balls = _seats().map(_buildBall);
    _figs = _seats().map(_buildFig);
    _kits = _seats().map(_buildKit);
    _buildUi();
    _input();

    // The first hole is built under the opening shot.
    _loadHole(0);
    const B = _c.bounds;
    const g0 = _gen;
    _dir.open({
        place: `${_courseName} · MINI GOLF`, title: 'MINI GOLF',
        sub: `${_list.length} HOLE${_list.length > 1 ? 'S' : ''} · ${_n === 1 ? 'SOLO' : _mode === 'turns' ? 'TAKE TURNS' : 'CHAOS — ALL AT ONCE'} · PAR ${_list.reduce((a, h) => a + h.hole.par, 0)}`,
        from: { pos: [(B.x0 + B.x1) / 2 - 14, 16, (B.z0 + B.z1) / 2 + 18], look: [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2] },
        to: _fitCam(),
        onDone: () => { if (_done || g0 !== _gen) return; _phase = 'play'; _beginHole(); },
    });
    _stage.start(_frame);
}

function _pickHoles() {
    if (_chal) {
        const all = COURSES.flatMap(c => c.holes.map(h => ({ course: c.key, hole: h })));
        const got = all.find(x => x.hole.key === _chal.key);
        if (got) return [got];
        _chal = null;
    }
    if (_forceHoles) {
        const all = COURSES.flatMap(c => c.holes.map(h => ({ course: c.key, hole: h })));
        const got = _forceHoles.map(k => all.find(x => x.hole.key === k)).filter(Boolean);
        if (got.length) return got;
    }
    // Across phones every device has to get the same holes: the round's shared draw, not Math.random.
    const rnd = Solo.isSolo() ? (() => { let i = 0; return () => Solo.draw(100 + i++); })() : Math.random;
    const course = _cfg.course && !Solo.isSolo() ? courseByKey(_cfg.course) : COURSES[Math.floor(rnd() * COURSES.length)];
    const nine = c => c.holes.map(h => ({ course: c.key, hole: h }));
    if (+_cfg.holes === 9 && !Solo.isSolo()) return nine(course);
    if (+_cfg.holes === 18 && !Solo.isSolo()) {
        const i = COURSES.indexOf(course);
        return [...nine(course), ...nine(COURSES[(i + 1) % COURSES.length])];
    }
    // A sampler: three of the course's short holes (par 3 or less — a party
    // game, not a round), played in the course's order.
    const short = course.holes.map((h, i) => (h.par <= 3 ? i : -1)).filter(i => i >= 0);
    const idx = short.map(i => [rnd(), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]).slice(0, SAMPLER).sort((a, b) => a - b);
    return idx.map(i => ({ course: course.key, hole: course.holes[i] }));
}

function _destroy() {
    _done = true;
    delete MG_ORIENTATION_OVERRIDE.minigolf;   // the next golf is a party's (chaos) unless the mode says otherwise

    _faded.clear();
    _built?.dispose?.(); _built = null; _pass = null;
    _gfx?.dispose?.(); _gfx = null;
    if (_stage) { _stage.dispose(); _stage = null; }
    if (_overlay) { _overlay.remove(); _overlay = null; }
    _balls = []; _figs = []; _kits = []; _dir = null; _hud = null; _fx = null; _ui = null; _card = null; _say2 = null; _c = null; _lights = null;
}
function _finish(w, rank) {
    if (_done) return;
    _destroy();
    if (Solo.isSolo()) { Solo.soloFinish(_stableford(0)); return; }
    _onWin?.(w, null, rank);
}

// ── Building ─────────────────────────────────────────────────────────────────
function _ballTex(color) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 32);
    x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fillRect(0, 12, 64, 8);
    x.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 40; i++) { x.beginPath(); x.arc((i * 13) % 64, (i * 7) % 32, 1.2, 0, 7); x.fill(); }
    return new THREE.CanvasTexture(cv);
}
function _buildBall(slot) {
    const b = { slot, p: P.newBall(0, 0, 0), on: false, done: false, picked: false, from: null, rollT: 0, sinkT: -1, clackT: 0, state: 'wait', clock: 0 };
    if (_stage.gl) {
        const col = seat(slot).color;
        // A holder that squashes on a hit, and the ball inside it that rolls.
        const mesh = new THREE.Group();
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(P.R, 20, 14), new THREE.MeshStandardMaterial({ map: _ballTex(col), roughness: 0.25 }));
        sphere.castShadow = true; mesh.add(sphere); mesh.visible = false; _stage.add(mesh);
        // Seen through whatever's in the way: the ball's colour, drawn only where something is in front of it.
        const ghost = new THREE.Mesh(new THREE.SphereGeometry(P.R * 1.08, 16, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, depthFunc: THREE.GreaterDepth }));
        ghost.renderOrder = 20; mesh.add(ghost);
        const ring = new THREE.Mesh(new THREE.RingGeometry(P.R * 1.5, P.R * 2.1, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.visible = false; _stage.add(ring);
        const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), new THREE.MeshBasicMaterial({ color: col }));
        marker.rotation.x = Math.PI; marker.visible = false; _stage.add(marker);
        const N = 36, pos = new Float32Array(N * 3);
        const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setDrawRange(0, 0);
        const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
        trail.frustumCulled = false; _stage.add(trail);
        Object.assign(b, { mesh, sphere, ghost, ring, marker, trail, trailPts: [], sq: 0 });
    }
    return b;
}
function _buildFig(slot) {
    const f = { slot, x: 0, z: 0, tx: 0, tz: 0, swing: 0, aimYaw: null };
    if (_stage.gl) {
        const c = _stage.character(slot);
        c.rig.root.scale.setScalar(0.5);
        c.anim.play('idle');
        // A putter in the hand.
        const club = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.6, roughness: 0.3 }));
        shaft.position.y = -0.5; club.add(shaft);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: seat(slot).color, metalness: 0.4, roughness: 0.3 }));
        head.position.set(0.08, -1.0, 0); club.add(head);
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        grip.position.y = -0.08; club.add(grip);
        club.position.set(0.0, 1.05, 0.42); club.rotation.x = 0.25;
        c.rig.root.add(club);
        Object.assign(f, { rig: c.rig, anim: c.anim, club });
    }
    return f;
}
/**
 * The aim: a short arrow from the ball the way it'll go, and the power band — a tapered
 * slingshot strip stretching back from the ball along your pull, longer and hotter (green to
 * red) the harder, over a faint track the length of a full hit, with a bright cap at its end.
 * (`dots` stays, empty: the full predicted path is gone on purpose. `ring` is the band.)
 */
const BAND_MAX = 2.6;                  // the band's length at full power
function _bandGeo() {
    // A unit strip along +y, narrow at the ball (y 0), wider at the end (y 1); alpha ramps in.
    const g = new THREE.BufferGeometry(), N = 12, pos = [], col = [], idx = [];
    for (let i = 0; i <= N; i++) {
        const v = i / N, w = 0.07 + v * 0.11;
        pos.push(-w, v, 0, w, v, 0);
        const c = 0.55 + v * 0.45; col.push(c, c, c, c, c, c);
    }
    for (let i = 0; i < N; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    return g;
}
function _buildKit(slot) {
    const k = { slot, dots: [], band: null, ring: null, ringBg: null, cap: null, on: false, tick: -1 };
    if (!_stage.gl) return k;
    const top = { transparent: true, depthTest: false, depthWrite: false };
    // The arrow: a shaft and a head, flat on the floor.
    const band = new THREE.Group();
    const shaftM = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.9, ...top });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.7), shaftM); shaft.position.y = 0.55; band.add(shaft);
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.17, 3), shaftM); head.position.y = 0.95; head.rotation.z = Math.PI / 2; band.add(head);
    band.children.forEach(m => { m.renderOrder = 6; });
    band.visible = false; _stage.add(band); k.band = band;
    // The power band, its track and its cap.
    const geo = _bandGeo();
    const ringBg = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.16, side: THREE.DoubleSide, ...top }));
    ringBg.renderOrder = 6; ringBg.visible = false; _stage.add(ringBg); k.ringBg = ringBg;
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x5ee07a, vertexColors: true, opacity: 0.95, side: THREE.DoubleSide, ...top }));
    ring.renderOrder = 7; ring.visible = false; _stage.add(ring); k.ring = ring;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 1, side: THREE.DoubleSide, ...top }));
    cap.renderOrder = 8; cap.visible = false; _stage.add(cap); k.cap = cap;
    return k;
}

/**
 * The HUD for turns (upright, passed round): the bar and the big message, and
 * a row of chips under the bar, one per player — their colour, name and how
 * they stand — the one whose shot it is lit. Same calls as uprightHud, plus hint and lit.
 */
function _turnsHud(stage) {
    const base = uprightHud(stage);
    const row = document.createElement('div');
    row.style.cssText = 'position:absolute;top:calc(86px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;' +
        'justify-content:center;gap:5px;width:calc(100% - 16px);pointer-events:none;';
    stage.hud.appendChild(row);
    const chips = _seats().map(slot => {
        const st = seat(slot);
        const c = document.createElement('div');
        c.style.cssText = `display:flex;align-items:center;gap:5px;padding:2px 9px 2px 4px;border-radius:12px;background:rgba(20,12,24,.55);border:2px solid ${st.css};` +
            'color:#fff8ee;font-size:12px;letter-spacing:1px;white-space:nowrap;transition:transform .15s,background .15s;text-shadow:0 1px 0 rgba(0,0,0,.6);';
        c.innerHTML = `<span style="width:12px;height:12px;border-radius:6px;background:${st.css};"></span><b style="font-weight:400"></b><span style="opacity:.85"></span>`;
        c.children[1].textContent = st.name + (st.bot ? ' 🤖' : '');
        row.appendChild(c);
        return c;
    });
    return {
        ...base,
        hint(slot, text) { const c = chips[slot]; if (c && c.children[2].textContent !== text) c.children[2].textContent = text ? '· ' + text : ''; },
        lit(slot, on, color) { const c = chips[slot]; if (!c) return; c.style.background = on ? (color || 'rgba(250,204,21,.45)') : 'rgba(20,12,24,.55)'; c.style.transform = on ? 'scale(1.08)' : ''; },
    };
}

/** Which band of the screen (chaos) a point is in: P1 the bottom, then up. */
const _bandOf = y => Math.max(0, Math.min(_n - 1, _n - 1 - Math.floor(y / (_stage.height / _n))));
/**
 * Chaos: the chips of turns, plus the bands — a line across between each, and
 * at the inside edge of each a tag in that player's colour: whose band it is.
 */
function _chaosHud(stage) {
    const base = _turnsHud(stage);
    const marks = _seats().map(slot => {
        const st = seat(slot);
        const tag = document.createElement('div');
        tag.style.cssText = `position:absolute;left:8px;padding:2px 10px;border-radius:10px;background:${st.css}cc;color:#fff;font-size:13px;letter-spacing:1px;` +
            'pointer-events:none;white-space:nowrap;text-shadow:0 1px 0 rgba(0,0,0,.5);transition:opacity .2s;';
        tag.textContent = `${st.name}${st.bot ? ' 🤖' : ' · DRAG HERE'}`;
        stage.hud.appendChild(tag);
        const edge = document.createElement('div');
        edge.style.cssText = `position:absolute;left:0;width:5px;background:${st.css};opacity:.75;pointer-events:none;`;
        stage.hud.appendChild(edge);
        return { tag, edge };
    });
    const lines = _seats().slice(1).map(() => {
        const l = document.createElement('div');
        l.style.cssText = 'position:absolute;left:0;right:0;height:0;border-top:2px dashed rgba(255,255,255,.45);pointer-events:none;';
        stage.hud.appendChild(l);
        return l;
    });
    stage.onResize((w, h) => {
        const bh = h / _n;
        marks.forEach((m, slot) => {
            const top = (_n - 1 - slot) * bh;
            m.edge.style.top = top + 'px'; m.edge.style.height = bh + 'px';
            // Under the line above (the top band: under the score bar and chips).
            m.tag.style.top = (slot === _n - 1 ? Math.max(top + 8, _n > 2 ? 146 : 122) : top + 8) + 'px';
        });
        lines.forEach((l, i) => { l.style.top = ((i + 1) * bh) + 'px'; });
    });
    return base;
}

/** "PASS TO …": the card between two people's shots, until the next one taps. */
function _showPass(slot) {
    if (!_stage) return;
    const st = seat(slot), b = _balls[slot];
    const left = b?.on ? P.pathLeft(_c, b.p.x, b.p.z) : P.pathLeft(_c, _c.tee.x, _c.tee.z);
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;pointer-events:auto;` +
        `background:radial-gradient(circle at 50% 40%, ${st.css}ee 0%, ${st.css}aa 45%, rgba(10,6,20,.92) 100%);color:#fff8ee;text-align:center;` +
        'text-shadow:0 3px 0 rgba(0,0,0,.45);letter-spacing:2px;animation:countPop .35s ease;z-index:6;';
    el.innerHTML = `<div style="font-size:22px;opacity:.9">${_holder < 0 ? 'FIRST UP' : 'PASS THE PHONE TO'}</div>` +
        `<div class="pp-name" style="font-size:64px;line-height:1;padding:0 12px;word-break:break-word;"></div>` +
        `<div style="font-size:17px;opacity:.95">HOLE ${_hole + 1} · STROKE ${_strokes[slot][_hole] + 1} · ${b?.on ? `${Math.round(left)} TO GO` : 'ON THE TEE'}</div>` +
        `<div style="margin-top:26px;font-size:20px;padding:8px 22px;border-radius:999px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.7);">TAP WHEN YOU'VE GOT IT</div>`;
    el.querySelector('.pp-name').textContent = st.name;
    const go = e => { e.preventDefault(); e.stopPropagation(); _takePass(); };
    el.addEventListener('pointerdown', go);
    _hud.say('');
    _stage.hud.appendChild(el);
    _pass = { el, slot };
    sfx('whistle');
}
function _takePass() {
    if (!_pass) return;
    _pass.el.remove();
    _holder = _pass.slot; _pass = null;
    _turnState = 'aim'; _turnT = 0;
    sfx('go');
}

function _buildUi() {
    const root = _stage.hud;
    const el = (css, parent = root) => { const e = document.createElement('div'); e.style.cssText = css; parent.appendChild(e); return e; };
    const TXT = 'color:#fff8ee;text-shadow:0 2px 0 rgba(0,0,0,.6),0 0 10px rgba(0,0,0,.5);letter-spacing:2px;';
    _ui = {};
    // The power bar, for the player whose turn it is.
    const up = _mode === 'turns';
    _ui.power = el(`position:absolute;left:50%;${up ? 'bottom:calc(46px + env(safe-area-inset-bottom, 0px))' : 'top:62px'};transform:translateX(-50%);width:240px;height:16px;border-radius:9px;` +
        'background:rgba(20,12,24,.6);border:2px solid rgba(255,255,255,.7);overflow:hidden;display:none;');
    _ui.powerFill = el('height:100%;width:0;background:linear-gradient(90deg,#5ee07a,#ffd23f 60%,#ff4d4d);', _ui.power);
    _ui.powerTxt = el(`position:absolute;left:50%;${up ? 'bottom:calc(66px + env(safe-area-inset-bottom, 0px))' : 'top:81px'};transform:translateX(-50%);font-size:13px;display:none;` + TXT);
    // Camera buttons (turns): turn left, the whole hole, turn right.
    const btn = (label, css, fn) => {
        const b = el('position:absolute;width:48px;height:48px;border-radius:24px;background:rgba(20,12,24,.55);border:2px solid rgba(255,255,255,.75);' +
            'display:none;align-items:center;justify-content:center;font-size:22px;pointer-events:auto;cursor:pointer;user-select:none;' + TXT + css);
        b.textContent = label;
        b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
        return b;
    };
    _ui.left = btn('⟲', 'left:12px;top:46%;', () => { _yaw -= Math.PI / 8; sfx('hat'); });
    _ui.right = btn('⟳', 'right:12px;top:46%;', () => { _yaw += Math.PI / 8; sfx('hat'); });
    _ui.map = btn('🗺', 'right:12px;top:calc(46% - 60px);', () => { _view = _view === 'map' ? 'follow' : 'map'; sfx('hat'); });
    // A second line of commentary under the big message (lip-outs, knocks, splashes).
    _say2 = el('position:absolute;left:50%;top:46%;transform:translateX(-50%);font-size:20px;opacity:0;transition:opacity .2s;white-space:nowrap;' + TXT);
    _say2.dataset.t = '0';
    // The scorecard.
    _card = el('position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);background:rgba(250,246,234,.97);color:#1d2a1f;' +
        'border-radius:14px;padding:10px 14px 12px;box-shadow:0 10px 40px rgba(0,0,0,.45);display:none;opacity:0;transition:opacity .2s,transform .2s;' +
        'max-width:calc(100% - 24px);box-sizing:border-box;overflow:hidden;');
}
const _showBtns = on => { if (!_ui) return; [_ui.left, _ui.right, _ui.map].forEach(b => { b.style.display = on && _mode === 'turns' ? 'flex' : 'none'; }); };
const _hidePower = () => { if (_ui) { _ui.power.style.display = 'none'; _ui.powerTxt.style.display = 'none'; } };
function _say2Show(text, color = '#fff8ee', ms = 1100) {
    if (!_say2) return;
    _say2.textContent = text; _say2.style.color = color; _say2.style.opacity = '1';
    _say2.dataset.t = String(_t + ms / 1000);
}

// ── Holes ────────────────────────────────────────────────────────────────────
function _loadHole(i) {
    const entry = _list[i];
    // The round's draw (the same on every phone in a shared round) shuffles teleporters that swap exits.
    const seed = 1 + Math.floor((Solo.isSolo() ? Solo.draw(300 + i) : Math.random()) * 1e6);
    _c = P.compile(entry.hole, { seed });
    const course = courseByKey(entry.course);
    if (course.theme !== _theme) {
        _theme = course.theme; _courseName = course.name;
        if (_stage?.gl) { _stage.scene.background = new THREE.Color(_theme.sky); _stage.scene.fog = new THREE.Fog(_theme.fog ?? _theme.sky, 38, 90); }
    }
    if (_stage?.gl) {
        _faded.clear(); _seeT = 0;
        _built?.dispose(); _built = buildHole(_stage, _c, _theme, i + 1);
        // Compile every shader the hole needs now, during the fly-down, not on its first frame of play.
        try { _stage.renderer?.compile(_stage.scene, _stage.camera); } catch (e) {}
        _gfx?.dispose(); _gfx = null;
        const B = _c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        if (_lights) {
            const span = Math.max(B.x1 - B.x0, B.z1 - B.z0) / 2 + 4;
            const sc = _lights.key.shadow.camera;
            sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix();
            _lights.key.position.set(cx - 9, 16, cz + 11); _lights.key.target.position.set(cx, 0, cz);
            // Each hole starts from the course's own light; the last third of a round is golden hour.
            if (!_lights.base) _lights.base = { key: _lights.key.color.getHex(), ki: _lights.key.intensity, hemi: _lights.hemi.color.getHex() };
            _lights.key.color.setHex(_lights.base.key); _lights.key.intensity = _lights.base.ki; _lights.hemi.color.setHex(_lights.base.hemi);
        }
        _gfx = GolfFx.make(_stage, _c, _theme, { lights: _lights, golden: _list.length >= 3 && i >= Math.ceil(_list.length * 0.67) });
        // A trick shot's target: a glowing frame on the floor, and the start spot.
        if (_chal?.zone && _built) {
            const [x0, z0, x1, z1] = _chal.zone, pts = [];
            const N = 40, edge = (ax, az, bx, bz) => { for (let k = 0; k < N; k++) { const u = k / N, x = ax + (bx - ax) * u, z = az + (bz - az) * u; pts.push(new THREE.Vector3(x, _floorY(x, z) + 0.04, z)); } };
            edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
            const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfde047 }));
            const fill = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.16, depthWrite: false }));
            fill.rotation.x = -Math.PI / 2; fill.position.set((x0 + x1) / 2, _floorY((x0 + x1) / 2, (z0 + z1) / 2) + 0.03, (z0 + z1) / 2);
            _built.root.add(line); _built.root.add(fill);
        }
    }
    _balls.forEach(b => {
        Object.assign(b, { on: false, done: false, picked: false, from: null, rollT: 0, sinkT: -1, state: 'wait', clock: 0 });
        b.p = P.newBall(_c.tee.x, _c.tee.z, _c.tee.y);
        if (b.mesh) { b.mesh.visible = false; b.mesh.scale.setScalar(1); b.ring.visible = false; b.marker.visible = false; b.trailPts = []; b.trail.geometry.setDrawRange(0, 0); }
    });
    // Where the players stand: behind the tee to begin with.
    const fw = _forward(_c.tee.x, _c.tee.z);
    _seats().forEach(s => {
        const f = _figs[s];
        // Off to the sides of the tee, out of the camera's way behind the ball.
        const sgn = s % 2 ? 1 : -1, side = sgn * (2.4 + Math.floor(s / 2) * 0.8);
        f.x = f.tx = _c.tee.x - fw[0] * (0.4 + Math.floor(s / 2) * 0.7) - fw[1] * side; f.z = f.tz = _c.tee.z - fw[1] * (0.4 + Math.floor(s / 2) * 0.7) + fw[0] * side;
        f.aimYaw = null;
        if (f.rig) { f.rig.root.position.set(f.x, _figY(f.x, f.z), f.z); f.anim.face(Math.atan2(fw[0], fw[1]), true); f.anim.play('idle'); }
    });
    if (_mode === 'chaos') _chaosLineUp();
}

function _beginHole() {
    _hole++;
    if (_hole >= _list.length) { _end(); return; }
    if (_hole > 0) _loadHole(_hole);
    extendWatchdog(HOLE_WATCHDOG);
    _strokes.forEach(s => s.push(0)); _times.forEach(s => s.push(0));
    _holeT = 0; _active = -1; _shooter = -1; _view = 'follow';
    const h = _list[_hole].hole;
    _hud.say(_chal ? 'TRICK SHOT' : `HOLE ${_hole + 1}`, _chal ? `${_chal.name || h.name} · ${_chal.zone ? 'STOP IT IN THE BOX' : 'SINK IT IN ONE'}` : `${h.name} · PAR ${h.par}`, FLY_DUR * 1000, _t, '#fde047');
    _sub = 'fly'; _subT = 0;
    if (_chal) _subT = FLY_DUR * 0.55;   // a shorter look at the hole: the shot's the thing
    sfx('whistle');
}

// The direction the hole goes from (x, z): toward the next waypoint ahead.
function _forward(x, z) {
    const c = _c, left = P.pathLeft(c, x, z);
    let target = c.path[c.path.length - 1];
    for (let i = 1; i < c.path.length; i++) {
        const p = c.path[i];
        if (P.pathLeft(c, p[0], p[1]) < left - 0.5) { target = p; break; }
    }
    const dx = target[0] - x, dz = target[1] - z, n = Math.hypot(dx, dz) || 1;
    return [dx / n, dz / n];
}
const _floorY = (x, z) => P.floorAt(_c, x, z, 50, 0)?.h ?? 0;
const _figY = (x, z) => P.floorAt(_c, x, z, 50, 0)?.h ?? -0.7;

function _chaosLineUp() {
    // Everyone on the tee at once, in a line across it; the players stand off
    // the far side of the course, spread along it, slot 0 on the right.
    const fw = _forward(_c.tee.x, _c.tee.z);
    _balls.forEach(b => {
        const off = ((_n - 1) / 2 - b.slot) * TEE_SPREAD;
        const x = _c.tee.x - fw[1] * off, z = _c.tee.z + fw[0] * off;
        b.p = P.newBall(x, z, _floorY(x, z));
        b.on = true; b.from = { x, y: b.p.y, z };
    });
    const B = _c.bounds;
    _seats().forEach(s => {
        const f = _figs[s];
        f.x = f.tx = B.x1 - 1.5 - (B.x1 - B.x0 - 3) * (_n > 1 ? s / (_n - 1) : 0.5); f.z = f.tz = B.z0 - 1.2;
        if (f.rig) { f.rig.root.position.set(f.x, -0.7, f.z); f.anim.face(0, true); f.anim.play('ready'); }
    });
}

function _startPlay() {
    _sub = 'play'; _subT = 0;
    if (_mode === 'chaos') _balls.forEach(b => { b.state = 'aim'; b.clock = 0; b.bot = { wait: BOT_DELAY }; });
    else _nextTurn();
}

// ── Turns ────────────────────────────────────────────────────────────────────
function _nextTurn() {
    const live = _seats().filter(s => !_balls[s].done);
    if (!live.length) { _holeOver(); return; }
    // Honours on the tee; after that, whoever is away.
    let next = _honors.find(s => live.includes(s) && !_balls[s].on);
    if (next == null) {
        let far = -1;
        for (const s of _honors) {
            if (!live.includes(s)) continue;
            const d = P.pathLeft(_c, _balls[s].p.x, _balls[s].p.z);
            if (d > far + 1e-6) { far = d; next = s; }
        }
    }
    _active = next; _turnT = 0; _turnState = 'aim'; _botThink = null;
    const b = _balls[next];
    if (_chal) {
        // A trick shot: every go is from the spot. Out of goes, it's over.
        const used = _strokes[next][_hole];
        // Stopped in the target zone: done.
        const z = _chal.zone;
        if (z && used > 0 && b.on && b.p.x >= z[0] && b.p.x <= z[2] && b.p.z >= z[1] && b.p.z <= z[3]) { _chalEnd(true); return; }
        if (used >= _chal.tries) { _chalEnd(false); return; }
        const [fx, fz] = _chal.from;
        b.p = P.newBall(fx, fz, _floorY(fx, fz)); b.on = true; b.from = { x: fx, y: b.p.y, z: fz };
        if (used > 0) _hud.say(`TRY ${used + 1} OF ${_chal.tries}`, '', 1100, _t, '#fde68a');
    }
    if (!b.on) {
        // On to the tee; if a ball is sitting there, a little to one side.
        let x = _c.tee.x, z = _c.tee.z;
        const fw = _forward(x, z);
        for (let k = 1; k < 5 && _balls.some(o => o !== b && o.on && !o.done && Math.hypot(o.p.x - x, o.p.z - z) < P.R * 3); k++) {
            const sgn = k % 2 ? 1 : -1, off = TEE_SPREAD * Math.ceil(k / 2) * sgn;
            x = _c.tee.x - fw[1] * off; z = _c.tee.z + fw[0] * off;
        }
        b.p = P.newBall(x, z, _floorY(x, z)); b.on = true; b.from = { x, y: b.p.y, z };
    }
    b.state = 'aim'; b.clock = 0;
    const fw = _forward(b.p.x, b.p.z);
    _yaw = Math.atan2(fw[1], fw[0]);
    _view = 'follow';
    const s = seat(next);
    // Hand the phone over when a different person has to play.
    const humans = _seats().filter(k => !_isBot(k)).length;
    if (!_isBot(next) && next !== _holder && humans > 1) { _turnState = 'pass'; _showPass(next); }
    else _hud.say(s.name, _isBot(next) ? 'IS UP' : `YOUR SHOT · STROKE ${_strokes[next][_hole] + 1}`, 1000, _t, s.css);
    if (!_isBot(next) && humans <= 1) _holder = next;
    _seats().forEach(k => _hud.lit(k, k === next, k === next ? s.css + '66' : undefined));
    _walkTo(next, b.p.x, b.p.z, _yaw);
}
function _walkTo(slot, x, z, yaw) {
    const f = _figs[slot];
    // Side-on to the line, just off the ball, on its left.
    const dx = Math.cos(yaw), dz = Math.sin(yaw);
    f.tx = x + dz * 0.72 - dx * 0.05; f.tz = z - dx * 0.72 - dz * 0.05;
    f.aimYaw = yaw;
    f.anim?.play('walk');
}
function _holeOver() {
    if (_chal) { _chalEnd(true); return; }
    _sub = 'card'; _subT = 0; _active = -1;
    _showBtns(false); _hidePower();
    _seats().forEach(k => _hud.lit(k, false));
    // Honours for the next tee: the best score on this hole first; ties keep the order.
    _honors = _honors.slice().sort((a, b) => _strokes[a][_hole] - _strokes[b][_hole]);
    _showCard(true);
}

// ── Input ────────────────────────────────────────────────────────────────────
function _input() {
    _stage.listen('pointerdown', e => {
        e.preventDefault();
        if (_sub === 'card' && _subT > CARD_MIN) { _subT = CARD_DUR; return; }
        if (_sub === 'fly' && _subT > 0.6) { _subT = FLY_DUR; return; }
        if (_phase !== 'play' || _sub !== 'play') return;
        const p = _stage.toLocal(e.clientX, e.clientY);
        let slot;
        if (_mode === 'turns') { slot = _active; if (_turnState !== 'aim') return; }
        else slot = _bandOf(p.y);
        if (slot < 0 || _isBot(slot) || _balls[slot].state !== 'aim' || [..._drag.values()].some(d => d.slot === slot)) return;
        if (_view === 'map') _view = 'follow';
        // Taking turns: press on your ball to putt; anywhere else, swipe to look round.
        // (Sharing a phone in chaos, the camera's shared — press anywhere in your band.)
        let ax = p.x, ay = p.y;
        if (_mode === 'turns') {
            const at = _ballOnScreen(slot);
            if (!at || Math.hypot(p.x - at.x, p.y - at.y) > at.r) { if (!_look) _look = { id: e.pointerId, x: p.x, y: p.y }; return; }
            ax = at.x; ay = at.y;
        }
        _drag.set(e.pointerId, { slot, ax, ay, x: p.x, y: p.y, armed: false, ring: _cancelRing(slot, ax, ay) });
    });
    _stage.listen('pointermove', e => {
        if (_look && _look.id === e.pointerId) {
            // Orbit round the ball (drag the world) and tilt up to read the green.
            const p = _stage.toLocal(e.clientX, e.clientY);
            _yaw -= (p.x - _look.x) * LOOK_YAW; _tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, _tilt - (p.y - _look.y) * LOOK_TILT));
            _look.x = p.x; _look.y = p.y;
            return;
        }
        const d = _drag.get(e.pointerId); if (!d) return;
        const p = _stage.toLocal(e.clientX, e.clientY); d.x = p.x; d.y = p.y;
        const u = _aimOf(d).pull;
        if (u >= MIN_PULL * 2) d.armed = true;
        _cancelShow(d, d.armed && u < MIN_PULL * 2);
    });
    const lookEnd = e => { if (_look && _look.id === e.pointerId) _look = null; };
    _stage.listen('pointerup', e => {
        lookEnd(e);
        const d = _drag.get(e.pointerId); if (!d) return;
        _drag.delete(e.pointerId);
        const a = _aimOf(d);
        d.ring?.remove();
        _hideKit(d.slot); _hidePower();
        // Back where it started: no shot, no stroke.
        if (!a || a.pull < MIN_PULL * 2) {
            if (d.armed) { _hud.hint(d.slot, 'NO SHOT'); _say2Show('NO SHOT', '#e5e7eb', 600); sfx('tick'); }
            return;
        }
        _shoot(d.slot, a.dx, a.dz, a.power);
    });
    _stage.listen('pointercancel', e => { lookEnd(e); const d = _drag.get(e.pointerId); if (d) { _drag.delete(e.pointerId); d.ring?.remove(); _hideKit(d.slot); _hidePower(); } });
}
/**
 * Where a drag started: a faint ring, the way out of a shot. Pull back into it
 * once you've wound up and it turns into a red ✕ — let go there and nothing is
 * played. (The shot itself is drawn by the kit; this only marks the start.)
 */
function _cancelRing(slot, x, y) {
    if (!_stage?.hud) return null;
    const el = document.createElement('div');
    const r = Math.max(26, MIN_PULL * 2 * PULL * Math.min(_stage.width, _stage.height));
    el.style.cssText = `position:absolute;left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;box-sizing:border-box;` +
        `border:3px dashed ${seat(slot).css};opacity:0;display:flex;align-items:center;justify-content:center;flex-direction:column;` +
        'color:#fff;font-size:22px;line-height:1;pointer-events:none;transition:opacity .12s,background .12s,transform .12s;text-shadow:0 1px 0 rgba(0,0,0,.6);';
    el.innerHTML = '<span>✕</span><span style="font-size:10px;letter-spacing:1px;margin-top:2px;white-space:nowrap;">NO SHOT</span>';
    el.children[0].style.visibility = el.children[1].style.visibility = 'hidden';
    _stage.hud.appendChild(el);
    return el;
}
function _cancelShow(d, on) {
    const el = d.ring; if (!el) return;
    el.style.opacity = d.armed ? (on ? '1' : '.55') : '0';
    el.style.background = on ? 'rgba(220,38,38,.75)' : 'transparent';
    el.style.borderStyle = on ? 'solid' : 'dashed';
    el.style.transform = on ? 'scale(1.12)' : '';
    el.children[0].style.visibility = el.children[1].style.visibility = on ? 'visible' : 'hidden';
    if (on) { _hideKit(d.slot); _hidePower(); }
}

// A drag on the screen, as a shot: the ball goes away from the pull, along the
// floor as the camera sees it; the length of the pull is the power.
let _ray = null;
function _ground(x, y, h) {
    if (!_stage?.gl) return null;
    _ray = _ray || new THREE.Raycaster();
    _ray.setFromCamera(new THREE.Vector2(x / _stage.width * 2 - 1, -(y / _stage.height * 2 - 1)), _stage.camera);
    const o = _ray.ray.origin, dir = _ray.ray.direction;
    if (Math.abs(dir.y) < 1e-4) return null;
    const k = (h - o.y) / dir.y;
    if (k < 0) return null;
    return [o.x + dir.x * k, o.z + dir.z * k];
}
/** Where a ball is on the screen, and how close a press has to be to take it. */
function _ballOnScreen(slot) {
    const b = _balls[slot]?.p, cam = _stage?.camera;
    if (!b || !cam || !_stage.gl) return null;
    const v = new THREE.Vector3(b.x, b.y + P.R, b.z).project(cam);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2 * _stage.width, y = (1 - v.y) / 2 * _stage.height;
    // The ball's own size on screen, made generous for a thumb.
    const e = new THREE.Vector3(b.x, b.y + P.R * 2, b.z).project(cam), rpx = Math.abs((1 - e.y) / 2 * _stage.height - y);
    return { x, y, r: Math.max(BALL_HIT, rpx * 4) };
}
// The pull to power: soft at first (fine control for putts), steeper toward a full hit.
const _curve = u => 0.35 * u + 0.65 * u * u;
function _aimOf(d) {
    const px = d.x - d.ax, py = d.y - d.ay, len = Math.hypot(px, py);
    const pull = Math.min(1, len / (PULL * Math.min(_stage.width, _stage.height))), power = _curve(pull);
    if (len < 6) return { dx: 0, dz: 0, power: 0, pull: 0 };
    const b = _balls[d.slot].p;
    const g0 = _ground(d.ax, d.ay, b.y), g1 = _ground(d.x, d.y, b.y);
    let dx, dz;
    if (g0 && g1 && Math.hypot(g1[0] - g0[0], g1[1] - g0[1]) > 1e-4) { dx = g0[0] - g1[0]; dz = g0[1] - g1[1]; }
    else { dx = -px; dz = -py; }
    const n = Math.hypot(dx, dz) || 1;
    return { dx: dx / n, dz: dz / n, power, pull };
}

function _shoot(slot, dx, dz, power) {
    const b = _balls[slot];
    if (!b || b.state !== 'aim' || b.done) return;
    if (_mode === 'turns' && slot !== _active) return;
    // Play is going on: the manager's backstop only fires after a long quiet.
    extendWatchdog(HOLE_WATCHDOG);
    b.from = { x: b.p.x, y: b.p.y, z: b.p.z };
    // Fired from an aim cannon: boom.
    if (b.p.loaded && _built) {
        _built.aimCannon?.(b.p.loaded, dx, dz);
        const mz = _built.fire?.(b.p.loaded);
        sfx('boom'); _shake = Math.max(_shake, 0.5);
        if (_stage?.gl && mz) { _fx.puff(mz, 0xd1d5db, 12, 0.7, 1.2); _fx.burst(mz, 0xffa53f, 0.4, 0.2); }
    }
    P.strike(b.p, dx, dz, power, _c);
    b.state = 'roll'; b.rollT = 0; if (b.trailPts) b.trailPts = [];
    _strokes[slot][_hole]++;
    _shooter = slot;
    if (!_isBot(slot)) _holder = slot;
    if (_mode === 'turns') { _turnState = 'roll'; _showBtns(false); _view = 'follow'; _tilt = 1; _look = null; }
    sfx('putt'); if (!_isBot(slot)) haptic([14]);
    const f = _figs[slot];
    if (f) { f.swing = 1; f.swingFrom = f.club ? f.club.rotation.x : 0.25; f.aimP = null; f.shotFrom = { x: b.p.x, z: b.p.z }; f.anim?.play('shove', { restart: true }); }
    b.sq = 0.6;
    _hideKit(slot); if (_mode === 'turns') _hidePower();
}

// ── The aim kit ──────────────────────────────────────────────────────────────
function _hideKit(slot) {
    if (_figs[slot]) _figs[slot].aimP = null;
    const k = _kits[slot]; if (!k || !k.band) return;
    k.band.visible = false; k.ring.visible = false; k.ringBg.visible = false; k.cap.visible = false; k.on = false; k.tick = -1;
}
const _UP = typeof THREE !== 'undefined' ? new THREE.Vector3(0, 1, 0) : null;
function _drawKit(slot, a) {
    const k = _kits[slot], b = _balls[slot].p;
    if (!k?.band || !_c) return;
    k.on = true;
    const y = b.y + 0.03, ang = Math.atan2(a.dz, a.dx);
    // The arrow: short, the way the ball will go.
    k.band.visible = true;
    k.band.position.set(b.x, y, b.z);
    k.band.rotation.set(0, -ang - Math.PI / 2, 0); k.band.rotateX(-Math.PI / 2);
    // The power band: back from the ball along the pull, growing with the power.
    const col = new THREE.Color().setHSL(0.33 - a.power * 0.33, 0.95, 0.55);
    const L = 0.25 + a.power * (BAND_MAX - 0.25), back = -ang + Math.PI / 2;
    const lay = (m, len) => { m.position.set(b.x, y, b.z); m.rotation.set(0, back, 0); m.rotateX(-Math.PI / 2); m.scale.set(1, len, 1); };
    lay(k.ringBg, BAND_MAX); lay(k.ring, L);
    k.ring.material.color.copy(col);
    k.cap.position.set(b.x - a.dx * L, y + 0.002, b.z - a.dz * L); k.cap.rotation.set(-Math.PI / 2, 0, 0);
    k.cap.material.color.copy(col).lerp(new THREE.Color(0xffffff), 0.35);
    k.cap.scale.setScalar(0.8 + a.power * 0.6);
    k.ring.visible = k.ringBg.visible = k.cap.visible = true;
    if (b.loaded) _built?.aimCannon?.(b.loaded, a.dx, a.dz);
    if (_figs[slot]) _figs[slot].aimP = a.power;
    // A tick under your thumb every tenth of the way: feel it, don't read it.
    const tick = Math.floor(a.power * 10);
    if (k.tick >= 0 && tick !== k.tick && !_isBot(slot)) { haptic([tick >= 9 ? 12 : 5]); if (tick > k.tick) sfx('tick'); }
    k.tick = tick;
}

// ── Scoring moments ──────────────────────────────────────────────────────────
function _label(n, par) {
    if (n === 1) return ['HOLE IN ONE!', '#fde047'];
    const d = n - par;
    if (d <= -3) return ['ALBATROSS!', '#fde047'];
    if (d === -2) return ['EAGLE!', '#fbbf24'];
    if (d === -1) return ['BIRDIE!', '#86efac'];
    if (d === 0) return ['PAR', '#ffffff'];
    if (d === 1) return ['BOGEY', '#fca5a5'];
    if (d === 2) return ['DOUBLE BOGEY', '#f87171'];
    return [`+${d}`, '#f87171'];
}
function _sunk(b, knocked) {
    if (_c) _gfx?.sparks(new THREE.Vector3(_c.cup.x, _c.cup.y + 0.25, _c.cup.z), 0xffe066, 22, 2.2, 2.6, 6);
    b.done = true; b.state = 'done'; b.sinkT = 0;
    _times[b.slot][_hole] = _holeT;
    const h = _list[_hole].hole, n = _strokes[b.slot][_hole];
    const [txt, col] = _label(n, h.par);
    sfx('cup');
    const s = seat(b.slot);
    if (!_isBot(b.slot)) haptic([40]);
    _nextWait = 1.8;
    if (_stage?.gl) {
        const at = new THREE.Vector3(_c.cup.x, _c.cup.y + 0.4, _c.cup.z);
        _fx.confetti(at, [s.color, 0xffffff, 0xfde047], n === 1 ? 60 : 24, n === 1 ? 4.5 : 2.6);
        if (n === 1) for (let k = 0; k < 6; k++) setTimeout(() => {
            if (!_done && _fx) _fx.burst(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3)), [0xfde047, s.color, 0xff5d8f, 0x7dd3fc][k % 4], 0.35, 0.5);
        }, k * 160);
    }
    _built?.flagPop?.();
    b.sinkFrom = { x: b.p.x, z: b.p.z };
    if (n === 1) {
        sfx('ace'); _nextWait = 3.2;
        _ace = { t: 0 }; _shake = 0.5;
        _figs.forEach(f => f.anim?.play(f.slot === b.slot ? 'victory' : 'clap'));
        if (_stage?.gl) for (let k = 6; k < 16; k++) setTimeout(() => {
            if (_done || !_fx || !_c) return;
            const at2 = new THREE.Vector3(_c.cup.x + (Math.random() - 0.5) * 6, _c.cup.y + 2.5 + Math.random() * 2.5, _c.cup.z + (Math.random() - 0.5) * 6);
            _fx.burst(at2, [0xfde047, s.color, 0xff5d8f, 0x7dd3fc, 0x86efac][k % 5], 0.45, 0.6);
            _fx.confetti(at2, [s.color, 0xfde047, 0xffffff], 10, 2);
            sfx('boost');
        }, 300 + (k - 6) * 220);
    } else {
        _figs[b.slot]?.anim?.play(n - h.par >= 2 ? 'defeat' : n <= h.par ? 'victory' : 'clap');
        _figs.forEach(f => { if (f.slot !== b.slot && !_balls[f.slot]?.done) f.anim?.play('clap'); });
    }
    _hud.say(txt, `${s.name} · ${n} STROKE${n > 1 ? 'S' : ''}${knocked ? ' · KNOCKED IN!' : ''}`, 1600, _t, col);
}
function _pickUp(b) {
    b.done = true; b.picked = true; b.state = 'done';
    const h = _list[_hole].hole;
    _strokes[b.slot][_hole] = _limit(h) + 1;
    _times[b.slot][_hole] = _holeT;
    if (b.mesh) { b.mesh.visible = false; b.ring.visible = false; b.marker.visible = false; }
    b.p.sunk = true;
    sfx('land_bad');
    _hud.say('PICKED UP', `${seat(b.slot).name} · ${_limit(h) + 1}`, 1100, _t, '#fca5a5');
}
/** A ball that's stopped where it can't be played from (on a current, a belt): back to where it was played from, no stroke. */
function _noRestBack(b) {
    if (!P.noRest(_c, b.p.x, b.p.z, b.p.y)) return;
    const f = b.from || { x: _c.tee.x, y: _c.tee.y, z: _c.tee.z };
    b.p = P.newBall(f.x, f.z, f.y);
    if (b.trailPts) b.trailPts = [];
    sfx('land_bad');
    _say2Show("CAN'T STOP THERE · BACK YOU GO", '#fde68a', 1300);
}

function _penalty(b, kind) {
    const mine = b.slot === _shooter || _mode === 'chaos';
    if (mine && !_chal) _strokes[b.slot][_hole]++;   // a trick shot's miss is just a miss
    if (kind === 'out') { sfx('land_bad'); _say2Show(`${_theme?.scenery === 'space' ? 'LOST IN SPACE' : 'OUT OF BOUNDS'}${mine ? ' · +1' : ''}`, '#fca5a5'); }
    else {
        sfx('splash');
        _gfx?.sparks(new THREE.Vector3(b.p.x, b.p.y + 0.15, b.p.z), kind === 'lava' ? 0xffa53f : kind === 'flowers' ? 0xff8fb1 : kind === 'goo' ? 0xb07a4a : 0xd6f1ff, 22, 2.2, 3);
        if (_stage?.gl) _fx.puff(new THREE.Vector3(b.p.x, b.p.y + 0.2, b.p.z), kind === 'lava' ? 0xff7a1a : kind === 'flowers' ? 0xff8fb1 : kind === 'goo' ? 0x7a4a2a : 0xbfe8ff, 10, 0.5, 1.2);
        _say2Show(`${kind === 'flowers' ? 'IN THE FLOWERS' : kind === 'lava' ? 'LAVA!' : kind === 'goo' ? 'IN THE CHOCOLATE' : _theme?.scenery === 'pirate' ? 'SPLASH! FEED THE SHARKS' : 'SPLASH'}${mine ? ' · +1' : ''}`, '#7dd3fc');
    }
    if (mine) _figs[b.slot]?.anim?.play('defeat');
    _shake = Math.max(_shake, 0.2);
    // Back to where it was played from (a knocked ball, to where it sat).
    const f = b.from || { x: _c.tee.x, y: _c.tee.y, z: _c.tee.z };
    b.p = P.newBall(f.x, f.z, f.y);
    if (b.trailPts) b.trailPts = [];
    b.state = _mode === 'chaos' ? 'aim' : 'wait'; b.clock = 0;
    if (_strokes[b.slot][_hole] >= _limit(_list[_hole].hole)) _pickUp(b);
}

/** What a ball's step did, made seen and heard. */
function _event(b, e) {
    const gl = _stage?.gl, at = (y = 0.1) => new THREE.Vector3(b.p.x, b.p.y + y, b.p.z);
    switch (e.type) {
        case 'wall':
            if (e.v > 1.0 && b.clackT <= 0) { sfx('clack'); b.clackT = 0.07; }
            b.sq = Math.max(b.sq, Math.min(1, e.v / 8));
            if (gl && e.v > 2.5 && (e.mat === 'metal' || e.mat === 'neon')) _fx.burst(new THREE.Vector3(...e.at), 0xfff1a8, 0.08, 0.15);
            if (e.v > 2.2) _gfx?.sparks(new THREE.Vector3(...e.at), e.mat === 'neon' ? (_theme?.rail ?? 0x22d3ee) : e.mat === 'metal' || e.mat === 'stone' ? 0xffe08a : e.mat === 'hedge' ? 0x6fd36f : e.mat === 'inflatable' ? 0xffd166 : 0xfff3d6, Math.min(16, 3 + e.v * 1.5), 1.2 + e.v * 0.25, 1.2);
            if (gl && e.v > 3 && e.mat === 'hedge') _fx.puff(at(0.2), 0x3fa548, 3, 0.3, 0.3);
            if (e.mover && e.v > 3) _shake = Math.max(_shake, 0.12);
            if (e.mat === 'inflatable') { _built?.wobble?.(e.at[0], e.at[2]); if (e.v > 1.5) sfx('boost'); }
            break;
        case 'boom': {
            // A mine (a powder keg, a space mine) under the ball.
            sfx('boom'); _shake = Math.max(_shake, 0.55); b.sq = 1;
            _built?.boom?.(e.at[0], e.at[1]);
            if (gl) {
                const p0 = new THREE.Vector3(e.at[0], _floorY(e.at[0], e.at[1]) + 0.2, e.at[1]);
                _fx.burst(p0, 0xffa53f, 0.7, 0.35); _fx.burst(p0, 0xfff1a8, 0.35, 0.2);
                _fx.puff(p0, 0x6b7280, 10, 0.7, 1.1);
            }
            _gfx?.sparks(new THREE.Vector3(e.at[0], _floorY(e.at[0], e.at[1]) + 0.3, e.at[1]), 0xffa53f, 40, 5, 4, 7);
            _say2Show(_theme?.scenery === 'pirate' ? 'KA-BOOM!' : 'BOOM!', '#fca5a5', 800);
            break;
        }
        case 'bumper':
            sfx('boost'); _built?.pulse(e.at); b.sq = 0.8;
            if (gl) _fx.burst(at(0.3), 0xffe08a, 0.18, 0.2);
            _gfx?.sparks(at(0.3), _theme?.bumper ?? 0xffe08a, 12, 3, 1.5);
            break;
        case 'hammer':
            sfx('slam'); b.sq = 1; _shake = Math.max(_shake, 0.3);
            if (gl) _fx.puff(at(0.3), 0xffffff, 5, 0.4, 0.5);
            _say2Show(_theme?.scenery === 'pirate' ? 'WHACKED BY THE KRAKEN!' : 'WHACK!', '#fde047', 800);
            break;
        case 'ball': sfx('clack'); b.sq = 0.6; if (_mode === 'turns') _say2Show('KNOCK!', '#fde047', 700); break;
        case 'rim': if (e.v > 1.2) sfx('clack'); break;
        case 'lip': sfx('lip'); _say2Show('LIPPED OUT!', '#fde68a', 900); _figs[b.slot]?.anim?.play('defeat'); break;
        case 'launch': if (e.v > 4) sfx('boost'); break;
        case 'land':
            b.sq = Math.max(b.sq, Math.min(1, e.v / 6));
            if (e.v > 2.5) sfx('land_good');
            if (gl && e.v > 2) _fx.puff(at(0.05), e.kind === 'sand' ? 0xe9cf98 : e.kind === 'jelly' ? 0xff8ac4 : _theme?.scenery === 'space' ? 0x9ca3af : 0xffffff, 5, 0.35, 0.45);
            break;
        case 'jelly': sfx('boost'); _built?.jelly?.(b.p.x, b.p.z); b.sq = 1; break;
        case 'spray': if (gl) _fx.puff(at(0.1), 0xe9cf98, 6, 0.5, 0.6); break;
        case 'splash': if (gl) _fx.puff(at(0.1), e.kind === 'creek' ? 0x9a6a46 : 0xbfe8ff, 5, 0.35, 0.5); _gfx?.sparks(at(0.1), e.kind === 'creek' ? 0xb07a4a : 0xd6f1ff, 10, 1.6, 2.2); break;
        case 'load': sfx('swap'); _say2Show('IN THE CANNON · AIM AND FIRE', '#fde68a', 1400); break;
        case 'pipe': {
            const st = e.p.style || (_theme?.scenery === 'space' ? 'teleport' : 'hose');
            if (st === 'cannon') {
                const mz = _built?.fire?.(e.p, e.dest);
                sfx('boom'); _shake = 0.6;
                if (gl && mz) { _fx.puff(mz, 0xd1d5db, 12, 0.7, 1.2); _fx.burst(mz, 0xffa53f, 0.4, 0.2); }
                _say2Show(e.dest ? 'WHERE WILL IT GO?!' : 'FIRE!', '#fca5a5', e.dest ? 1300 : 800);
            } else if (st === 'teleport') {
                sfx('swap');
                if (e.p.stop) _say2Show('BACK TO THE TOP · SHOOT AGAIN', '#c4b5fd', 1500);
                if (gl) { _fx.burst(at(0.3), e.p.color ?? _theme?.pipe ?? 0xa855f7, 0.5, 0.35); _fx.burst(new THREE.Vector3(e.p.b[0], _floorY(e.p.b[0], e.p.b[1]) + 0.3, e.p.b[1]), e.p.color ?? _theme?.pipe ?? 0xa855f7, 0.5, 0.5); }
            } else sfx('swap');
            break;
        }
        case 'pipeout':
            sfx('boost');
            // Back to the top of a drop (plinko): a fresh roll, not a timed-out one.
            if (e.p?.style === 'teleport') b.rollT = Math.min(b.rollT, ROLL_MAX * 0.4);
            if (gl) _fx.puff(at(0.15), (e.p?.style === 'cannon') ? 0xe9cf98 : 0xd9f99d, 6, 0.4, 0.5);
            if (e.p?.style === 'cannon') { b.sq = 1; _shake = Math.max(_shake, 0.25); }
            break;
        case 'loop': sfx('boost'); _say2Show(e.l?.style === 'corkscrew' || b.p.loop?.l?.style === 'corkscrew' ? 'WHEEE!' : 'LOOP!', '#fde047', 700); break;
        case 'loopfail': sfx('land_bad'); _say2Show('NOT ENOUGH SPEED', '#fca5a5', 800); break;
        case 'cup': _sunk(b, _mode === 'turns' && b.slot !== _shooter); break;
        case 'water': case 'out': _penalty(b, e.kind || e.type); break;
    }
}

// ── The frame ────────────────────────────────────────────────────────────────
function _frame(dt) {
    if (_done) return;
    _t += dt; _subT += dt;
    _hud.tick(_t);
    if (_say2 && +_say2.dataset.t && _t > +_say2.dataset.t) { _say2.style.opacity = '0'; _say2.dataset.t = '0'; }

    // Slow motion as a ball creeps up on the cup, and through a hole-in-one.
    _slow += ((_slowTarget()) - _slow) * Math.min(1, dt * 6);
    const pdt = dt * _slow;
    _pt += pdt;
    if (_ace) { _ace.t += dt; if (_ace.t > 2.8) _ace = null; }
    _shake = Math.max(0, _shake - dt * 1.8);

    if (_phase === 'play') {
        if (_sub === 'fly' && _subT >= FLY_DUR) _startPlay();
        else if (_sub === 'play') { _holeT += dt; _play(dt, pdt); }
        else if (_sub === 'card' && _subT >= CARD_DUR) { _showCard(false); _beginHole(); }
    }

    _built?.update(pdt, _pt);
    if (_gfx) {
        // Read the green round the ball being aimed (a human's, in turns; the one being dragged, in chaos).
        let rb = null;
        if (_sub === 'play' && _phase === 'play') {
            if (_mode === 'turns') { if (_turnState === 'aim' && !_isBot(_active) && _balls[_active]?.on) rb = _balls[_active].p; }
            else { const d = [..._drag.values()][0]; if (d) rb = _balls[d.slot]?.p; }
        }
        _gfx.reading(rb && !rb.air ? rb : null);
        _gfx.update(dt, _pt);
    }
    if (_built) animateProps(_built.root, _pt);
    _drawBalls(dt);
    _drawFigs(dt);
    _fx?.update(dt);
    const dirOwns = !!_dir && _dir.update(dt);
    if (_done) return;
    if (!dirOwns && _stage?.gl && _phase === 'play') _camera(dt);
    if (_stage?.gl && _built && _phase === 'play') _seeThrough(dt);
    _renderHud();
}

/** How fast the physics runs: slower while the putted ball creeps up on the cup. */
function _slowTarget() {
    if (_ace) return _ace.t < 0.8 ? 0.45 : 1;
    if (_mode !== 'turns' || _turnState !== 'roll' || _sub !== 'play' || !_c) return 1;
    const b = _balls[_shooter]?.p;
    if (!b || b.air || b.pipe || b.loop || b.sunk) return 1;
    const dx = _c.cup.x - b.x, dz = _c.cup.z - b.z, d = Math.hypot(dx, dz), v = Math.hypot(b.vx, b.vz);
    const closing = (b.vx * dx + b.vz * dz) / (d || 1);
    return d < 1.7 && v > 0.35 && v < 4.5 && closing > 0.2 ? 0.42 : 1;
}

function _play(dt, pdt = dt) {
    const h = _list[_hole].hole;
    // Aim, the clock, and the bots.
    if (_mode === 'turns') {
        const b = _balls[_active];
        if (b && _turnState === 'aim') {
            _turnT += dt;
            if (_isBot(_active)) _botTurn(dt, b);
            else {
                const d = [..._drag.values()].find(x => x.slot === _active);
                _showBtns(!d);
                if (d) { const a = _aimOf(d); if (a.pull >= MIN_PULL * 2) _drawKit(_active, a); else { _hideKit(_active); _hidePower(); } }
            }
        }
    } else {
        _balls.forEach(b => {
            if (b.state !== 'aim' || b.done) return;
            b.clock += dt;
            if (_isBot(b.slot)) {
                // Think while it waits, a few milliseconds a frame (a whole plan at once is a
                // visible hitch on a phone), for the moment it will strike.
                const B = b.bot;
                B.wait -= dt;
                if (!B.it && B.wait < BOT_DELAY - 0.6) { B.it = planSteps(_c, b.p, _pt + Math.max(0, B.wait - 0.4), _botSkill); B.pl = null; B.at = { x: b.p.x, z: b.p.z }; }
                if (B.it && !B.pl) { const st = B.it.next(); if (st.done) B.pl = st.value; }
                if (B.wait <= 0) {
                    // Knocked since it planned, or not done thinking: plan now.
                    let pl = B.pl;
                    if (!pl || !B.at || Math.hypot(b.p.x - B.at.x, b.p.z - B.at.z) > 0.05) pl = plan(_c, b.p, _pt, _botSkill);
                    _shoot(b.slot, pl.dx, pl.dz, pl.power);
                    b.bot = { wait: BOT_DELAY };
                }
                return;
            }
            const d = [..._drag.values()].find(x => x.slot === b.slot);
            if (d) { const a = _aimOf(d); if (a.pull >= MIN_PULL * 2) _drawKit(b.slot, a); else _hideKit(b.slot); }
        });
    }

    // Physics: every ball on the course, each an obstacle to the others.
    const live = _balls.filter(b => b.on && !b.done && !b.p.sunk);
    const others = live.length > 1 ? live.map(b => b.p) : null;
    for (const b of live) {
        if (b.done) continue;
        const was = b.p.rest;
        const ev = P.step(_c, b.p, pdt, _pt - pdt, others);
        if (!b.p.rest) {
            b.rollT += dt;
            if (b.state !== 'roll') { b.state = 'roll'; b.rollT = 0; }
        }
        if (b.rollT > (_c.hole.rollMax || ROLL_MAX) * (_c.Q || 1) && !b.p.rest && !b.p.pipe && !b.p.loop) { b.p.vx = b.p.vz = b.p.vy = 0; b.p.rest = true; b.p.air = false; b.p.y = _floorY(b.p.x, b.p.z); }
        b.clackT -= dt;
        for (const e of ev) _event(b, e);
        // Stopped.
        if (!b.done && b.p.rest && !was && b.state === 'roll') {
            // (A ball knocked while its player is lining up — a sweeper, a hammer — is still theirs to play.)
            b.state = _mode === 'chaos' || (b.slot === _active && _turnState === 'aim') ? 'aim' : 'wait'; b.clock = 0;
            _noRestBack(b);
            b.from = { x: b.p.x, y: b.p.y, z: b.p.z };
            if (_strokes[b.slot][_hole] >= _limit(h)) _pickUp(b);
        }
    }
    // Turns: the next shot once everything has stopped.
    if (_mode === 'turns' && _turnState === 'roll') {
        const moving = _balls.some(b => b.on && !b.done && (!b.p.rest || b.p.pipe || b.p.loop));
        if (!moving) {
            _balls.forEach(b => { if (b.on && !b.done) { _noRestBack(b); b.from = { x: b.p.x, y: b.p.y, z: b.p.z }; if (b.state === 'roll') b.state = 'wait'; } });
            _turnState = 'next'; _turnT = 0;
        }
    }
    if (_mode === 'turns' && _turnState === 'next') { _turnT += dt; if (_turnT > _nextWait) { _nextWait = 0.7; _nextTurn(); } }
    if (_mode === 'chaos' && _balls.every(b => b.done) && _sub === 'play') _holeOver();
}

function _botTurn(dt, b) {
    // Think (spread over a few frames), line it up where you can see it, then
    // putt — at the moment it planned for, on a hole that moves.
    if (!_botThink && _turnT > 0.6) {
        // It plans for the moment it will strike, BOT_DELAY into its turn (on a hole that moves, that matters).
        const at = _pt + Math.max(0.5, BOT_DELAY - _turnT);
        _botThink = { it: planSteps(_c, b.p, at - 0.4, _botSkill), pl: null, t: 0, at };
    }
    if (!_botThink) return;
    if (!_botThink.pl) {
        const st = _botThink.it.next();
        if (!st.done) return;
        _botThink.pl = st.value;
        _botThink.at += st.value.wait || 0;
        // If thinking ran past the moment it planned for, go now.
        if (_botThink.at < _pt + 0.5) _botThink.at = _pt + 0.5;
    }
    const pl = _botThink.pl, left = _botThink.at - _pt;
    // The camera swings round behind the line it's chosen; the pull grows over the last second.
    let d = Math.atan2(pl.dz, pl.dx) - _yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    _yaw += d * Math.min(1, dt * 3);
    if (left < 1.0) _drawKit(_active, { dx: pl.dx, dz: pl.dz, power: pl.power * Math.min(1, (1.0 - left) / 0.7) });
    if (left <= 0) { _botThink = null; _shoot(_active, pl.dx, pl.dz, pl.power); }
}

// ── Cameras ──────────────────────────────────────────────────────────────────
/** The whole hole, from above and a little in front, fitted to the screen. */
function _fitCam() { return _fitCamUpright(); }
/** Up the portrait screen: the way the hole mostly goes, snapped square to the course. */
function _upAxis() {
    let ax = _c.cup.x - _c.tee.x, az = _c.cup.z - _c.tee.z;
    if (Math.abs(ax) >= Math.abs(az)) { ax = Math.sign(ax) || 1; az = 0; } else { az = Math.sign(az); ax = 0; }
    return [ax, az];
}
/** A camera on (cx, cz) that fits hf along the up axis and hr across it, in portrait. */
function _uprightPose(cx, cz, hf, hr) {
    const [ax, az] = _upAxis();
    const fov = (_stage?.camera?.fov ?? 56) * Math.PI / 180, A = (_stage?.width || 412) / Math.max(1, _stage?.height || 892);
    const t = Math.tan(fov / 2);
    const h = Math.max((hf + 0.8) / t * 1.12, (hr + 0.8) / (t * A) * 1.05) + 1;
    const tilt = 0.38;
    return { h, pos: [cx - ax * h * Math.sin(tilt), h * Math.cos(tilt), cz - az * h * Math.sin(tilt)], look: [cx + ax * 0.6, 0, cz + az * 0.6] };
}
/** Half-extents of some points about their middle, along and across the up axis. */
function _extent(pts) {
    const [ax, az] = _upAxis(), rx = -az, rz = ax;
    let f0 = 1e9, f1 = -1e9, r0 = 1e9, r1 = -1e9;
    for (const [x, z] of pts) {
        const f = x * ax + z * az, r = x * rx + z * rz;
        f0 = Math.min(f0, f); f1 = Math.max(f1, f); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    }
    const fm = (f0 + f1) / 2, rm = (r0 + r1) / 2;
    return { cx: fm * ax + rm * rx, cz: fm * az + rm * rz, hf: (f1 - f0) / 2, hr: (r1 - r0) / 2 };
}
/** The whole hole standing up the portrait screen: tee at the bottom, cup toward the top. */
function _fitCamUpright() {
    const B = _c.bounds;
    const e = _extent([[B.x0, B.z0], [B.x1, B.z0], [B.x0, B.z1], [B.x1, B.z1]]);
    return _uprightPose(e.cx, e.cz, e.hf, e.hr);
}
/**
 * Chaos: one camera for everybody. It frames the balls still in play and the
 * cup — in close while they're together, pulling out as they spread — but never
 * tighter than about half the hole, and never wider than all of it.
 */
function _chaosCam() {
    const live = _balls.filter(b => b.on && !b.done).map(b => {
        const m = b.mesh?.visible ? b.mesh.position : b.p;
        return [m.x, m.z];
    });
    const whole = _fitCamUpright();
    if (!live.length) return whole;
    const e = _extent([...live, [_c.cup.x, _c.cup.z]]);
    const pose = _uprightPose(e.cx, e.cz, Math.max(3.5, e.hf + 2.2), Math.max(2.5, e.hr + 1.6));
    const B = _extent([[_c.bounds.x0, _c.bounds.z0], [_c.bounds.x1, _c.bounds.z1]]);
    // Show as much of the course as the balls allow: at least ~55% of the whole view.
    const h = Math.min(whole.h, Math.max(pose.h, whole.h * 0.55));
    if (h >= whole.h - 0.01) return whole;
    // Keep the centre on the course so the extra room shows course, not sky.
    const k = (h - pose.h) / Math.max(0.01, whole.h - pose.h);
    const cx = e.cx + (B.cx - e.cx) * k, cz = e.cz + (B.cz - e.cz) * k;
    const [ax, az] = _upAxis(), tilt = 0.38;
    return { h, pos: [cx - ax * h * Math.sin(tilt), h * Math.cos(tilt), cz - az * h * Math.sin(tilt)], look: [cx + ax * 0.6, 0, cz + az * 0.6] };
}
function _aimPose(x, y, z, yaw, back = 1, tilt = 1) {
    // tilt > 1: higher and a little closer in, looking down on the green; < 1: lower, along it.
    const dx = Math.cos(yaw), dz = Math.sin(yaw), bk = CAM_BACK * back * (1.12 - 0.12 * tilt);
    return {
        pos: new THREE.Vector3(x - dx * bk, y + CAM_UP * back * tilt, z - dz * bk),
        look: new THREE.Vector3(x + dx * CAM_AHEAD, y, z + dz * CAM_AHEAD),
    };
}
function _flyAt(s) {
    // A point s (0..1) of the way down the hole from the flag to the tee.
    const P2 = _c.path.slice().reverse();
    const seg = []; let tot = 0;
    for (let i = 0; i < P2.length - 1; i++) { const L = Math.hypot(P2[i + 1][0] - P2[i][0], P2[i + 1][1] - P2[i][1]); seg.push(L); tot += L; }
    let r = Math.max(0, Math.min(1, s)) * tot;
    for (let i = 0; i < seg.length; i++) {
        if (r <= seg[i] || i === seg.length - 1) { const q = seg[i] ? Math.min(1, r / seg[i]) : 0; return [P2[i][0] + (P2[i + 1][0] - P2[i][0]) * q, P2[i][1] + (P2[i + 1][1] - P2[i][1]) * q]; }
        r -= seg[i];
    }
    return P2[P2.length - 1];
}
function _camera(dt) {
    const cam = _stage.camera;
    const k = 1 - Math.exp(-dt * 3.2);
    if (_sub === 'fly') {
        const u = Math.min(1, _subT / (FLY_DUR * 0.8)), e = u * u * (3 - 2 * u);
        let pos, look;
        if (u < 1) {
            const p = _flyAt(e), q = _flyAt(Math.min(1, e + 0.12));
            // Over the flag first, high, then down the line behind the camera's own path.
            const up = 5.2 - e * 1.6;
            pos = new THREE.Vector3(p[0] + (p[0] - q[0]) * 0.8, _floorY(p[0], p[1]) + up, p[1] + (p[1] - q[1]) * 0.8);
            look = new THREE.Vector3(q[0], _floorY(q[0], q[1]), q[1]);
            // The view here is down the hole toward the tee; turn it round at the end.
        } else {
            const fw = _forward(_c.tee.x, _c.tee.z);
            const a = _aimPose(_c.tee.x, _c.tee.y, _c.tee.z, Math.atan2(fw[1], fw[0]));
            pos = a.pos; look = a.look;
        }
        if (_subT < dt * 1.5) { _cam.pos.copy(pos); _cam.look.copy(look); }
        _cam.pos.lerp(pos, Math.min(1, dt * 4)); _cam.look.lerp(look, Math.min(1, dt * 4));
    } else if (_mode === 'chaos' && _sub !== 'card') {
        const f = _chaosCam();
        _cam.pos.lerp(new THREE.Vector3(...f.pos), k * 0.7); _cam.look.lerp(new THREE.Vector3(...f.look), k * 0.7);
    } else if (_sub === 'card' || _view === 'map' || _active < 0) {
        const f = _fitCam();
        _cam.pos.lerp(new THREE.Vector3(...f.pos), k); _cam.look.lerp(new THREE.Vector3(...f.look), k);
    } else if (_turnState === 'aim' || _turnState === 'pass') {
        const b = _balls[_active].p;
        const a = _aimPose(b.x, b.y, b.z, _yaw, 1, _tilt);
        // Swiping to look: follow the finger closely.
        const kk = _look ? Math.min(1, k * 3) : k;
        if (!_drag.size) { _cam.pos.lerp(a.pos, kk); _cam.look.lerp(a.look, kk); }
    } else if (_inCannon()) {
        // In a cannon: it spins and fires you somewhere — pull back over the whole hole so
        // you see it turn, the arc and where it comes down (up close, the barrel fills the view).
        const f = _fitCam();
        _cam.pos.lerp(new THREE.Vector3(...f.pos), k * 0.6); _cam.look.lerp(new THREE.Vector3(...f.look), k * 0.6);
    } else {
        // Chase the ball that was putted (the knocks it makes are in front of it):
        // where it's drawn — on its arc out of a cannon, round a loop.
        const sb = _balls[_shooter] || _balls[_active], m = sb.p;
        const at = sb.mesh?.visible ? sb.mesh.position : new THREE.Vector3(m.x, m.y + P.R, m.z);
        const sp = Math.hypot(m.vx, m.vz);
        if (sp > 0.8 && !m.pipe) { let d = Math.atan2(m.vz, m.vx) - _yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); _yaw += d * Math.min(1, dt * 1.6); }
        if (m.pipe) { let d = Math.atan2(m.pipe.p.b[1] - m.pipe.p.a[1], m.pipe.p.b[0] - m.pipe.p.a[0]) - _yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); _yaw += d * Math.min(1, dt * 1.2); }
        // In close when it's creeping up on the cup.
        const back = _slow < 0.8 ? 0.75 : m.pipe ? 1.5 : 1.15;
        const a = _aimPose(at.x, at.y - P.R, at.z, _yaw, back);
        _cam.pos.lerp(a.pos, k * 0.8); _cam.look.lerp(a.look, Math.min(1, k * 1.4));
    }
    // A hole-in-one: the camera circles the cup.
    if (_ace && _c) {
        const ang = _ace.t * 1.1 + 0.6, r = 3.6 - Math.min(1, _ace.t) * 0.8;
        const pos = new THREE.Vector3(_c.cup.x + Math.cos(ang) * r, _c.cup.y + 2.2, _c.cup.z + Math.sin(ang) * r);
        _cam.pos.lerp(pos, Math.min(1, dt * 3)); _cam.look.lerp(new THREE.Vector3(_c.cup.x, _c.cup.y + 0.4, _c.cup.z), Math.min(1, dt * 3));
    }
    cam.position.copy(_cam.pos);
    if (_shake > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * _shake * 0.4, (Math.random() - 0.5) * _shake * 0.3, (Math.random() - 0.5) * _shake * 0.4));
    cam.lookAt(_cam.look);
    cam.userData.look = _cam.look.toArray();
    // The haze starts past what you're looking at: pulled out over a big hole it mustn't swallow it.
    const fog = _stage.scene.fog;
    if (fog) { const d = cam.position.distanceTo(_cam.look); fog.near = Math.max(38, d * 0.9 + 12); fog.far = Math.max(90, d * 1.7 + 40); }
}

/** The ball being chased is riding a cannon (spinning in it, or flying out of it). */
function _inCannon() {
    const sb = _balls[_shooter] || _balls[_active];
    return !!(sb && sb.p.pipe && sb.p.pipe.p.style === 'cannon');
}

// ── Seeing through ──────────────────────────────────────────────────────────
// Anything between the camera and a ball in play (a windmill, a castle, a
// rock, a raised deck) goes see-through while it's in the way, so you can
// read the shot. Every few frames: a ray from the camera to each ball.
const _faded = new Map();           // the faded thing → { meshes: [[mesh, material]], t: last time in the way }
const _fadeMats = new WeakMap();    // a material → its see-through copy
let _seeT = 0, _seeRay = null;
function _fadeMat(m) {
    let f = _fadeMats.get(m);
    if (!f) { f = m.clone(); f.transparent = true; f.opacity = Math.min(m.opacity ?? 1, 0.26); f.depthWrite = false; _fadeMats.set(m, f); }
    return f;
}
/** The thing to fade for a mesh that's in the way: its biggest ancestor that's still one object (not the whole course). */
function _fadeRoot(o) {
    const root = _built.root;
    let pick = o;
    for (let a = o.parent; a && a !== root; a = a.parent) {
        if (a.userData.fadeRoot) return a;   // a baked prop (golf/Bake.js): fade it whole
        let n = 0; a.traverse(q => { if (q.isMesh) n++; });
        if (n > 40) break;
        pick = a;
    }
    return pick;
}
function _seeThrough(dt) {
    _seeT -= dt;
    if (_seeT <= 0) {
        _seeT = 0.08;
        _seeRay = _seeRay || new THREE.Raycaster();
        const cam = _stage.camera, from = cam.position, now = _t;
        for (const b of _balls) {
            if (!b.on || b.done || !b.mesh?.visible) continue;
            const to = b.mesh.position, d = from.distanceTo(to);
            if (d < 0.5) continue;
            _seeRay.set(from, to.clone().sub(from).normalize());
            _seeRay.far = d - P.R * 2.5;
            for (const h of _seeRay.intersectObject(_built.root, true)) {
                const o = h.object;
                if (!o.isMesh || !o.visible || o.userData.noFade || o.material?.transparent && o.material.opacity < 0.5) continue;
                // Not the floor (nor its skirts), unless it's a deck overhead.
                let fl = false; for (let a = o; a && a !== _built.root; a = a.parent) if (a.userData.floor) { fl = true; break; }
                if (fl && h.point.y < to.y + 0.3) continue;
                const r = _fadeRoot(o);
                let f = _faded.get(r);
                if (!f) {
                    f = { meshes: [], t: now };
                    r.traverse(q => { if (q.isMesh && q.material && !Array.isArray(q.material)) { f.meshes.push([q, q.material]); q.material = _fadeMat(q.material); } });
                    _faded.set(r, f);
                }
                f.t = now;
            }
        }
        // Back to solid once out of the way for a moment.
        for (const [r, f] of _faded) if (now - f.t > 0.35) { f.meshes.forEach(([q, m]) => { q.material = m; }); _faded.delete(r); }
    }
}

// ── Drawing ──────────────────────────────────────────────────────────────────
let _axis = null;
/** Where a ball is drawn (in a pipe, on a loop, sinking it isn't where its physics is). */
function _ballDrawPos(b) {
    const p = b.p;
    if (p.pipe && _built) {
        const u = 1 - p.pipe.t / (p.pipe.dur || 0.6);
        return _built.pipeAt(p.pipe.p, Math.max(0, Math.min(1, u)), p.pipe.dest);
    }
    if (p.loop && p.loop.l.style === 'corkscrew' && _built?.loopAt) {
        // Down the corkscrew slide.
        const q = _built.loopAt(p.loop.l, p.loop.t / p.loop.dur);
        if (q) return q.clone().setY(q.y - 0.16 + P.R);
    }
    if (p.loop) {
        // In along the floor, round the hoop (a corkscrew, so it clears itself), out along the floor.
        const l = p.loop.l, u = p.loop.t / p.loop.dur, n = Math.hypot(l.dir[0], l.dir[1]) || 1, ux = l.dir[0] / n, uz = l.dir[1] / n;
        const rad = l.rad ?? 0.9 + P.R, base = _floorY(l.a[0], l.a[1]);
        let along, h = 0, side = 0;
        if (u < 0.2) along = l.len / 2 * (u / 0.2);
        else if (u > 0.8) along = l.len / 2 + l.len / 2 * ((u - 0.8) / 0.2);
        else { const th = (u - 0.2) / 0.6 * Math.PI * 2; along = l.len / 2 + Math.sin(th) * rad; h = rad * (1 - Math.cos(th)); side = (th / (Math.PI * 2) - 0.5) * 0.36; }
        return new THREE.Vector3(l.a[0] + ux * along - uz * side, base + P.R + h, l.a[1] + uz * along + ux * side);
    }
    return new THREE.Vector3(p.x, p.y + P.R, p.z);
}
function _drawBalls(dt) {
    if (!_c) return;
    _axis = _axis || new THREE.Vector3();
    _balls.forEach(b => {
        if (!b.mesh) return;
        const p = b.p;
        const inPipe = !!p.pipe;
        const show = b.on && !b.picked;
        if (b.sinkT >= 0 && b.sinkT < 1) {
            // Round the cup and down: a little spiral, then gone.
            b.mesh.visible = true;
            if (b.ghost) b.ghost.visible = false;
            b.sinkT = Math.min(1, b.sinkT + dt * 1.8);
            const k = b.sinkT, sf = b.sinkFrom || { x: _c.cup.x + 0.2, z: _c.cup.z };
            const a0 = Math.atan2(sf.z - _c.cup.z, sf.x - _c.cup.x), a = a0 + k * Math.PI * 3, r = (1 - k) * Math.min(P.CUP_R * 0.7, Math.hypot(sf.x - _c.cup.x, sf.z - _c.cup.z));
            b.mesh.position.set(_c.cup.x + Math.cos(a) * r, _c.cup.y + P.R - k * k * 0.45, _c.cup.z + Math.sin(a) * r);
            b.mesh.scale.setScalar(1 - k * 0.25);
            b.sphere.rotateOnWorldAxis(_axis.set(0, 0, 1), dt * 12);
            if (b.sinkT >= 1) b.mesh.visible = false;
        } else if (b.done) b.mesh.visible = false;
        else {
            const at = _ballDrawPos(b);
            // A hose hides the ball (the bulge is seen); a teleporter has it nowhere.
            const style = inPipe ? (p.pipe.p.style || (_theme?.scenery === 'space' ? 'teleport' : 'hose')) : null;
            b.mesh.visible = show && (!inPipe || style === 'cannon') && !!at;
            if (b.ghost) b.ghost.visible = !p.inCup && !p.sunk;
            if (at) {
                const ox = b.mesh.position.x, oz = b.mesh.position.z;
                b.mesh.position.copy(at);
                const mx = at.x - ox, mz = at.z - oz, dist = Math.hypot(mx, mz);
                // The ball turns with its spin, not its travel: off the putter it
                // skids (barely turning), then grabs and rolls.
                const onFloor = !p.air && !p.pipe && !p.loop && p.wx != null;
                const sx = onFloor ? p.wx * dt : mx, sz = onFloor ? p.wz * dt : mz, sd = Math.hypot(sx, sz);
                if (sd > 1e-4 && sd < 2 && dist < 2) { _axis.set(sz, 0, -sx).normalize(); b.sphere.rotateOnWorldAxis(_axis, sd / P.R); }
            }
            // Squash on a hit, back with a wobble.
            b.sq = Math.max(0, (b.sq || 0) - dt * 4);
            const w = b.sq * Math.cos((1 - b.sq) * 14);
            b.mesh.scale.set(1 + w * 0.22, 1 - w * 0.3, 1 + w * 0.22);
        }
        // The ring on the floor under a ball at rest; the marker over the one to play.
        const rest = show && p.rest && !b.done && !inPipe;
        b.ring.visible = rest;
        if (rest) { b.ring.position.set(p.x, p.y + 0.012, p.z); b.ring.material.opacity = 0.55 + Math.sin(_t * 5) * 0.25; }
        const mine = _mode === 'turns' ? b.slot === _active && _turnState === 'aim' : b.state === 'aim';
        b.marker.visible = show && mine && !b.done && _sub === 'play';
        if (b.marker.visible) { b.marker.position.set(p.x, p.y + 0.75 + Math.sin(_t * 4) * 0.08, p.z); b.marker.rotation.y += dt * 2; }
        // The trail.
        if (show && !p.rest && !b.done && b.mesh.visible) { const q = b.mesh.position; b.trailPts.push([q.x, q.y - P.R * 0.4, q.z]); if (b.trailPts.length > 36) b.trailPts.shift(); }
        else if (b.trailPts.length) b.trailPts.shift();
        const pos = b.trail.geometry.attributes.position;
        b.trailPts.forEach((q, i) => pos.setXYZ(i, q[0], q[1], q[2]));
        pos.needsUpdate = true; b.trail.geometry.setDrawRange(0, b.trailPts.length);
    });
    // The flag comes out while a ball is close to the cup.
    _built?.flagOut(_balls.some(b => b.on && !b.done && Math.hypot(b.p.x - _c.cup.x, b.p.z - _c.cup.z) < 2.2));
}
function _drawFigs(dt) {
    if (!_c) return;
    _figs.forEach(f => {
        if (!f.rig) return;
        const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz);
        if (d > 0.02) {
            const s = Math.min(d, dt * 5);
            f.x += dx / d * s; f.z += dz / d * s;
            f.anim.face(Math.atan2(dx, dz));
            if (d - s <= 0.02) f.anim.play('ready');
        } else if (_mode === 'turns' && f.slot === _active && _balls[f.slot]) {
            // Side-on to the line, facing the ball.
            const b = _balls[f.slot].p;
            f.anim.face(Math.atan2(b.x - f.x, b.z - f.z));
        }
        f.rig.root.position.set(f.x, _mode === 'chaos' ? -0.7 : _figY(f.x, f.z), f.z);
        if (!f.club) return;
        // The putt: the backswing follows the pull; let go and it swings through and follows through.
        const rest = 0.25;
        if (f.swing > 0) {
            f.swing = Math.max(0, f.swing - dt * 2.4);
            const k = 1 - f.swing;                                 // 0 → 1
            const through = 1.25;
            const from = f.swingFrom ?? rest;
            f.club.rotation.x = k < 0.25 ? from + (through - from) * (k / 0.25) * (k / 0.25)
                : k < 0.6 ? through : through + (rest - through) * ((k - 0.6) / 0.4);
        } else if (f.aimP != null) {
            const want = rest - 0.25 - f.aimP * 1.35;
            f.club.rotation.x += (want - f.club.rotation.x) * Math.min(1, dt * 14);
        } else f.club.rotation.x += (rest - f.club.rotation.x) * Math.min(1, dt * 6);
    });
}

// ── The HUD and the scorecard ────────────────────────────────────────────────
const _total = s => _strokes[s].reduce((a, b) => a + b, 0);
const _toPar = s => { let d = 0; _strokes[s].forEach((n, i) => { if (i < _hole || (i === _hole && _balls[s]?.done) || _phase === 'over') d += n - _list[i].hole.par; }); return d; };
const _fmt = d => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`);

function _renderHud() {
    if (!_hud || _hole < 0 || _hole >= _list.length) return;
    const h = _list[_hole].hole;
    _hud.bar(`<span style="font-size:15px;opacity:.9">⛳ ${_hole + 1}/${_list.length}</span><span>${h.name}</span><span style="font-size:15px;opacity:.9">PAR ${h.par}</span>`);
    _seats().forEach(s => {
        const b = _balls[s], now = _strokes[s][_hole] || 0;
        if (b.done) { _hud.hint(s, b.picked ? `PICKED UP · ${_fmt(_toPar(s))}` : `IN · ${now} · ${_fmt(_toPar(s))}`); return; }
        if (seat(s).bot) { _hud.hint(s, `${now} · ${_fmt(_toPar(s))}`); return; }
        if (_mode === 'turns') {
            _hud.hint(s, s === _active && _turnState === 'aim'
                ? (_hole === 0 && now === 0 ? 'PULL BACK FROM THE BALL · SWIPE TO LOOK' : 'YOUR SHOT')
                : `${now} · ${_fmt(_toPar(s))}`);
        } else if (![..._drag.values()].some(d => d.slot === s)) {
            _hud.hint(s, b.state === 'aim' ? (_hole === 0 && now === 0 ? 'DRAG BACK ON YOUR STRIP' : `STROKE ${now + 1}`) : `ROLLING · ${now}`);
        }
    });
    const el = document.getElementById('mg-neutral');
    if (el && _phase === 'play') {
        const tots = _seats().map(_toPar), lo = Math.min(...tots), lead = _seats().filter(s => tots[s] === lo);
        el.textContent = `HOLE ${_hole + 1} · ${lead.length === 1 ? `${seat(lead[0]).name} LEADS ${_fmt(lo)}` : `LEVEL ${_fmt(lo)}`}`;
    }
}

function _showCard(on, final = false) {
    if (!_card) return;
    if (!on) {
        _card.style.opacity = '0'; _card.style.transform = 'translate(-50%,-50%) scale(.96)';
        setTimeout(() => { if (_card && _card.style.opacity === '0') _card.style.display = 'none'; }, 220);
        return;
    }
    const narrow = (_stage?.width || 900) < 520;
    const cell = narrow ? 'padding:2px 3px;text-align:center;min-width:17px;font-size:13px;' : 'padding:3px 5px;text-align:center;min-width:22px;font-size:15px;';
    const mark = (n, par) => {
        if (!n) return '';
        const d = n - par;
        const bg = n === 1 ? '#fde047' : d <= -2 ? '#fbbf24' : d === -1 ? '#bbf7d0' : d === 0 ? 'transparent' : d === 1 ? '#fecaca' : '#fca5a5';
        const shape = d < 0 || n === 1 ? 'border-radius:50%;' : d > 0 ? 'border-radius:3px;' : '';
        return `<span style="display:inline-block;min-width:20px;padding:1px 2px;background:${bg};${shape}">${n}</span>`;
    };
    const parT = _list.reduce((a, x) => a + x.hole.par, 0);
    let html = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-bottom:6px;">' +
        `<div style="font-size:22px;letter-spacing:2px;">${final ? 'FINAL CARD' : `AFTER HOLE ${_hole + 1}`}</div>` +
        `<div style="font-size:13px;opacity:.7;letter-spacing:1px;">${_courseName} · ${_n === 1 ? 'SOLO' : _mode === 'turns' ? 'TURNS' : 'CHAOS'}</div></div>`;
    html += '<div style="overflow-x:auto;"><table style="border-collapse:collapse;">';
    html += `<tr style="background:#1f5130;color:#fff;"><td style="${cell}text-align:left;">HOLE</td>` +
        _list.map((_, i) => `<td style="${cell}${i === _hole && !final ? 'background:#3f9d4f;' : ''}">${i + 1}</td>`).join('') + `<td style="${cell}">TOT</td><td style="${cell}">±</td></tr>`;
    html += `<tr style="background:#e7efe2;"><td style="${cell}text-align:left;opacity:.8;">PAR</td>` +
        _list.map(x => `<td style="${cell}opacity:.8;">${x.hole.par}</td>`).join('') + `<td style="${cell}opacity:.8;">${parT}</td><td></td></tr>`;
    const order = _seats().slice().sort((a, b) => _toPar(a) - _toPar(b) || _total(a) - _total(b));
    order.forEach((s, r) => {
        const st = seat(s), tp = _toPar(s);
        html += `<tr style="border-top:1px solid rgba(0,0,0,.1);"><td style="${cell}text-align:left;white-space:nowrap;">` +
            `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${st.css};margin-right:6px;"></span>${r === 0 && _n > 1 ? '👑 ' : ''}${st.name}</td>` +
            _list.map((x, i) => `<td style="${cell}">${i <= _hole ? mark(_strokes[s][i], x.hole.par) : ''}</td>`).join('') +
            `<td style="${cell}font-size:17px;">${_total(s)}</td><td style="${cell}font-size:17px;color:${tp < 0 ? '#15803d' : tp > 0 ? '#b91c1c' : '#1d2a1f'};">${_fmt(tp)}</td></tr>`;
    });
    html += '</table></div>';
    if (!final) html += '<div style="margin-top:6px;font-size:12px;opacity:.6;text-align:center;letter-spacing:1px;">TAP TO CARRY ON</div>';
    _card.innerHTML = html;
    _card.style.display = 'block';
    requestAnimationFrame(() => { if (_card) { _card.style.opacity = '1'; _card.style.transform = 'translate(-50%,-50%) scale(1)'; } });
}

/** A trick shot is over: sunk (in how many goes) or not. */
function _chalEnd(ok) {
    if (_phase === 'over') return;
    _phase = 'over';
    _showBtns(false); _hidePower();
    _kits.forEach((_, s) => _hideKit(s));
    const tries = _strokes[0][_hole];
    _last = { challenge: _chal.id, course: _list[0]?.course, holes: [_list[0].hole.key], success: ok, tries, full: false,
              totals: [tries], toPar: [0], aces: [ok && tries === 1 ? 1 : 0], strokes: _strokes.map(x => [...x]), par: [1], winner: 0 };
    const stars = ok ? Math.max(1, 4 - tries) : 0;
    _last.stars = stars;
    const holed = _balls[0]?.done && !_balls[0]?.picked;
    _last.holed = !!holed;
    _hud.say(ok ? (holed ? 'HOLED IT!' : tries === 1 ? 'FIRST TIME!' : 'NAILED IT!') : 'NOT THIS TIME', ok ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : `${_chal.tries} GOES`, 0, _t, ok ? '#fde047' : '#fca5a5');
    if (ok) sfx('ace'); else sfx('land_bad');
    const g = _gen;
    setTimeout(() => {
        if (_done || !_dir || g !== _gen) return;
        _hud.say('');
        _dir.close({ winner: ok ? 0 : -1, figs: _figs.filter(f => f.rig).map(f => ({ slot: f.slot, rig: f.rig, anim: f.anim })), sub: ok ? `SUNK IN ${tries}` : 'TRY AGAIN?', onDone: () => { if (g === _gen) _finish(ok ? 0 : -1, [ok ? 1 : 0]); } });
    }, _forceHoles ? 300 : 2200);
}

// ── The end ──────────────────────────────────────────────────────────────────
function _end() {
    if (_phase === 'over') return;
    _phase = 'over';
    _hud.say('');
    _showBtns(false); _hidePower();
    const tot = _seats().map(_total), tt = _seats().map(s => _times[s].reduce((a, b) => a + b, 0));
    // Countback: the better score from the last hole backwards.
    const back = (a, b) => { for (let i = _list.length - 1; i >= 0; i--) { const d = (_strokes[a][i] || 0) - (_strokes[b][i] || 0); if (d) return d; } return 0; };
    const cmp = (a, b) => tot[a] - tot[b] || (_mode === 'turns' ? back(a, b) : (Math.abs(tt[a] - tt[b]) < 0.05 ? 0 : tt[a] - tt[b]));
    const order = _seats().slice().sort(cmp);
    const w = order.length > 1 && cmp(order[0], order[1]) === 0 ? -1 : order[0];
    // Rank, higher better.
    const rank = _seats().map(s => -(tot[s] * 1000 + order.indexOf(s)));
    const runner = order[1];
    const par = _list.reduce((a, x) => a + x.hole.par, 0);
    const sub = Solo.isSolo() ? `${_stableford(0)} POINTS · ${tot[w]} STROKES (${_fmt(tot[w] - par)})`
        : _n === 1 ? `${tot[w]} STROKES · ${_fmt(tot[w] - par)} ON PAR ${par}`
        : w < 0 ? `LEVEL ON ${tot[order[0]]}`
        : tot[w] !== tot[runner] ? `${tot[w]} STROKES (${_fmt(tot[w] - par)}) · ${tot[runner]} NEXT`
        : `LEVEL ON ${tot[w]} · ${_mode === 'turns' ? 'ON COUNTBACK' : `QUICKER BY ${Math.abs(tt[w] - tt[runner]).toFixed(1)}s`}`;
    _kits.forEach((_, s) => _hideKit(s));
    _last = {
        course: _list[0]?.course, courseName: _courseName, mode: _mode, full: _list.length >= 9,
        holes: _list.map(x => x.hole.key), par: _list.map(x => x.hole.par),
        strokes: _strokes.map(x => [...x]), totals: tot, toPar: tot.map(t => t - par), winner: w,
        aces: _seats().map(s => _strokes[s].filter(n => n === 1).length),
    };
    _showCard(true, true);
    const g = _gen;
    setTimeout(() => {
        if (_done || !_dir || g !== _gen) return;
        _showCard(false);
        _dir.close({ winner: w, figs: _figs.filter(f => f.rig).map(f => ({ slot: f.slot, rig: f.rig, anim: f.anim })), sub, onDone: () => { if (g === _gen) _finish(w, rank); } });
    }, _forceHoles ? 400 : 3200);
    const el = document.getElementById('mg-neutral');
    if (el) el.textContent = _n === 1 ? `${_fmt(tot[w] - par)} ON PAR` : w < 0 ? 'DRAW!' : `${seat(w).name} WINS!`;
}

// ── Probe hooks ──────────────────────────────────────────────────────────────
let _forceHoles = null;
let _last = null;
/** The round just finished: course, par and every player's card (for records and trophies). Null mid-round. */
export function lastRound() { return _last ? JSON.parse(JSON.stringify(_last)) : null; }
/** Probes: the hole's objects that can't be drawn (a NaN in the transform), and how many are see-through right now. */
export function _debugScene() {
    if (!_built) return null;
    const bad = [];
    _built.root.updateMatrixWorld(true);
    _built.root.traverse(o => { if (o.isMesh && o.visible && !o.matrixWorld.elements.every(Number.isFinite)) bad.push(o.parent?.type + '>' + (o.geometry?.type || '?')); });
    return { bad, faded: _faded.size };
}
/** What the bake left as separate meshes, by the top-level group they're under (perf QA). */
export function _debugBake() {
    if (!_built) return null;
    const by = {};
    _built.root.children.forEach(ch => { let n = 0, fl = new Set(); ch.traverse(q => { if (q.isMesh) n++; Object.keys(q.userData).forEach(k => fl.add(k)); }); if (n) { const k = (ch.type + (ch.name ? '(' + ch.name + ')' : '') + ':' + (ch.geometry?.type || ch.children.length) + ':' + [...fl].join('/')).slice(0, 60); by[k] = (by[k] || 0) + n; } });
    return { baked: _built.root.userData.baked, top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 15) };
}
export function _debugState() {
    return {
        phase: _phase, n: _n, sub: _sub, hole: _hole, mode: _mode, active: _active, turn: _turnState, view: _view, chal: _chal?.id || null, clock: +_t.toFixed(2), done: _done, nextWait: _nextWait, turnT: +_turnT.toFixed(2),
        course: _list[0]?.course, holes: _list.map(x => x.hole.key), par: _list.map(x => x.hole.par),
        strokes: _strokes.map(s => [...s]), times: _times.map(s => s.map(t => +t.toFixed(2))),
        balls: _balls.map(b => ({ x: +b.p.x.toFixed(2), y: +b.p.y.toFixed(2), z: +b.p.z.toFixed(2), v: +Math.hypot(b.p.vx, b.p.vz).toFixed(2), state: b.state, holed: b.done && !b.picked, picked: b.picked, on: b.on, air: b.p.air })),
        cup: _c ? [_c.cup.x, _c.cup.z] : null, tee: _c ? [_c.tee.x, _c.tee.z] : null,
        views: 1, gl: !!_stage?.gl, turned: !!_stage?.turned, card: !!_card && _card.style.display === 'block',
        aiming: _kits.map(k => k.on), pass: _pass ? _pass.slot : -1, dots: _kits.map(k => k.dots.filter(d => d.visible).length), ring: _kits.map(k => !!k.ring?.visible), tilt: _tilt, yaw: _yaw,
        onScreen: _balls.map((b, i) => { const a = _ballOnScreen(i); return a ? [Math.round(a.x), Math.round(a.y)] : null; }),
    };
}
/** Probes: put a ball at rest at (x, z), on the course. */
export function _debugBall(slot, x, z) {
    const b = _balls[slot]; if (!b || !_c) return;
    b.p = P.newBall(x, z, _floorY(x, z)); b.on = true; b.from = { x, y: b.p.y, z };
    if (_mode === 'chaos') { b.state = 'aim'; b.clock = 0; }
    else if (slot === _active) { b.state = 'aim'; _turnState = 'aim'; _turnT = 0; }
    else b.state = 'wait';
}
/** Probes: play a shot for a slot (in turns, it's made their turn first). */
export function _debugShoot(slot, dx, dz, p) {
    const b = _balls[slot]; if (!b || !_c) return;
    if (_mode === 'turns' && slot !== _active) { _active = slot; if (!b.on) { b.on = true; b.p = P.newBall(_c.tee.x, _c.tee.z, _c.tee.y); } }
    b.state = 'aim'; if (_mode === 'turns') _turnState = 'aim';
    _shoot(slot, dx, dz, p);
}
/** Probes: take the phone (dismiss the PASS TO card). */
export function _debugTakePass() { _takePass(); }
/** Probes: the camera — 'follow' or 'map' (the whole hole). */
export function _debugView(v) { _view = v; }
/** Probes: skip the flyover or the scorecard. */
export function _debugSkip() { if (_sub === 'fly') _subT = FLY_DUR; else if (_sub === 'card') _subT = CARD_DUR; }
/** Probes: the holes the NEXT start() plays (keys from any course), or null. */
export function _debugForceHoles(keys) { _forceHoles = keys; }
/** Probes: every hole on every course. */
export function _debugPool() { return COURSES.flatMap(c => c.holes.map(h => h.key)); }
/** Probes: set the card (strokes and seconds per hole, per player) and end the match. */
export function _debugScore(strokes, times) { _strokes = strokes.map(s => [...s]); _times = times.map(s => [...s]); _hole = _list.length - 1; _end(); }
/** Probes: what the physics makes of a shot from where a slot's ball is. */
export function _debugSim(slot, dx, dz, p) { const b = _balls[slot]; return b && _c ? P.simulate(_c, b.p, dx, dz, p, _pt) : null; }
