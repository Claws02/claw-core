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
//   DRAG BACK and LET GO: a slingshot. The ball goes the opposite way to your
//   pull, the further the harder. The dotted line is where it goes — round the
//   slope, off the first rail, and a little past; the bar is how hard.
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
import { registerMinigameCleanup, isBotSlot, slotCount, extendWatchdog } from './MinigameManager.js';
import { createStage } from '../engine/Stage.js';
import { createDirector } from '../engine/StageDirector.js';
import { seat, sideHud, effects } from '../engine/StageKit.js';
import * as P from './golf/Physics.js';
import { plan } from './golf/Bot.js';
import { COURSES, courseByKey, coursePar } from './golf/Courses.js';
import { buildHole, animateProps } from './golf/Build.js';

// ── Tuning ───────────────────────────────────────────────────────────────────
const SAMPLER = 3;                     // holes in a party's round
const PULL = 0.4;                      // a full pull, as a fraction of the screen's short side
const MIN_PULL = 0.05;                 // less than this and the drag is cancelled
const CLOCK_TURNS = 30, CLOCK_CHAOS = 12;
const ROLL_MAX = 14;                   // s a ball may roll before it's called stopped
const FLY_DUR = 3.2;
const CARD_DUR = 4.6, CARD_MIN = 1.0;
const HOLE_WATCHDOG = 6 * 60 * 1000;   // the manager's backstop, pushed on at every hole
const CAM_BACK = 5.6, CAM_UP = 3.3, CAM_AHEAD = 2.6;
const TEE_SPREAD = 0.42;

// ── Configuration (the Mini Golf mode sets it; a party uses the defaults) ─────
const DEFAULTS = { course: null, holes: 'sampler', mode: 'turns' };
let _cfg = { ...DEFAULTS };
/** { course: key | null (random), holes: 'sampler' | 9 | 18, mode: 'turns' | 'chaos' } — sticks until changed. */
export function configure(o = {}) { _cfg = { ..._cfg, ...o }; return { ..._cfg }; }
export function configured() { return { ..._cfg }; }
export function resetConfig() { _cfg = { ...DEFAULTS }; }
export const COURSE_LIST = COURSES.map(c => ({ key: c.key, name: c.name, blurb: c.blurb, holes: c.holes.length, par: coursePar(c) }));

// ── Module state ─────────────────────────────────────────────────────────────
let _done = false, _onWin = null, _botSkill = 0.55;
let _overlay = null, _stage = null, _dir = null, _hud = null, _fx = null, _lights = null;
let _n = 2, _mode = 'turns', _list = [], _hole = -1, _c = null, _built = null, _theme = null, _courseName = '';
let _balls = [], _figs = [], _kits = [], _strokes = [], _times = [], _honors = [];
let _phase = 'intro', _sub = '', _subT = 0, _t = 0, _holeT = 0;
let _active = -1, _turnT = 0, _turnState = 'aim', _botThink = null, _shooter = -1, _nextWait = 0.7;
let _cam = null, _yaw = 0, _view = 'follow', _drag = new Map(), _ui = null, _card = null, _say2 = null;

const _seats = () => Array.from({ length: _n }, (_, i) => i);
const _limit = h => h.par + 3;

export function start(isBot, onWin, botSkill = 0.55) {
    if (!state.mgActive) return;
    _done = false; _onWin = onWin; _botSkill = botSkill;
    _n = Math.max(2, Math.min(4, slotCount()));
    _mode = _cfg.mode === 'chaos' ? 'chaos' : 'turns';
    _list = _pickHoles();
    _phase = 'intro'; _sub = ''; _subT = 0; _t = 0; _hole = -1; _active = -1;
    _strokes = _seats().map(() => []); _times = _seats().map(() => []);
    _honors = _seats();
    _view = 'follow'; _drag = new Map();
    registerMinigameCleanup(_destroy);

    const course = courseByKey(_list[0].course);
    _theme = course.theme; _courseName = course.name;
    const mg = document.getElementById('minigame-layer');
    _overlay = document.createElement('div');
    _overlay.style.cssText = `position:absolute;inset:0;overflow:hidden;background:#${_theme.sky.toString(16).padStart(6, '0')};z-index:5;`;
    mg.appendChild(_overlay);
    _stage = createStage(_overlay, { hold: 'side', fov: 50, background: _theme.sky });
    _hud = sideHud(_stage, { padWidth: 230 });
    _fx = effects(_stage);
    _dir = createDirector(_stage);
    if (_stage.gl) {
        _lights = _stage.light({ span: 16, dir: [-9, 16, 11], sunI: 1.2, sky: 0xdfefff, ground: 0x5a7a3a, hemiI: 0.55, rimI: 0.3 });
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
    _dir.open({
        place: `${_courseName} · MINI GOLF`, title: 'MINI GOLF',
        sub: `${_list.length} HOLE${_list.length > 1 ? 'S' : ''} · ${_mode === 'turns' ? 'TAKE TURNS' : 'CHAOS — ALL AT ONCE'} · PAR ${_list.reduce((a, h) => a + h.hole.par, 0)}`,
        from: { pos: [(B.x0 + B.x1) / 2 - 14, 16, (B.z0 + B.z1) / 2 + 18], look: [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2] },
        to: _fitCam(),
        onDone: () => { if (_done) return; _phase = 'play'; _beginHole(); },
    });
    _stage.start(_frame);
}

function _pickHoles() {
    if (_forceHoles) {
        const all = COURSES.flatMap(c => c.holes.map(h => ({ course: c.key, hole: h })));
        const got = _forceHoles.map(k => all.find(x => x.hole.key === k)).filter(Boolean);
        if (got.length) return got;
    }
    const course = _cfg.course ? courseByKey(_cfg.course) : COURSES[Math.floor(Math.random() * COURSES.length)];
    const nine = c => c.holes.map(h => ({ course: c.key, hole: h }));
    if (+_cfg.holes === 9) return nine(course);
    if (+_cfg.holes === 18) {
        const i = COURSES.indexOf(course);
        return [...nine(course), ...nine(COURSES[(i + 1) % COURSES.length])];
    }
    // A sampler: three holes from one course, played in the course's order.
    const idx = course.holes.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, SAMPLER).sort((a, b) => a - b);
    return idx.map(i => ({ course: course.key, hole: course.holes[i] }));
}

function _destroy() {
    _done = true;
    _built?.dispose?.(); _built = null;
    if (_stage) { _stage.dispose(); _stage = null; }
    if (_overlay) { _overlay.remove(); _overlay = null; }
    _balls = []; _figs = []; _kits = []; _dir = null; _hud = null; _fx = null; _ui = null; _card = null; _say2 = null; _c = null; _lights = null;
}
function _finish(w, rank) { if (_done) return; _destroy(); _onWin?.(w, null, rank); }

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
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(P.R, 20, 14), new THREE.MeshStandardMaterial({ map: _ballTex(col), roughness: 0.25 }));
        mesh.castShadow = true; mesh.visible = false; _stage.add(mesh);
        const ring = new THREE.Mesh(new THREE.RingGeometry(P.R * 1.5, P.R * 2.1, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.visible = false; _stage.add(ring);
        const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), new THREE.MeshBasicMaterial({ color: col }));
        marker.rotation.x = Math.PI; marker.visible = false; _stage.add(marker);
        const N = 36, pos = new Float32Array(N * 3);
        const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setDrawRange(0, 0);
        const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
        trail.frustumCulled = false; _stage.add(trail);
        Object.assign(b, { mesh, ring, marker, trail, trailPts: [] });
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
/** The aim: a band back from the ball along your pull, and the dotted line of where it goes. */
function _buildKit(slot) {
    const k = { slot, dots: [], band: null, on: false };
    if (!_stage.gl) return k;
    for (let i = 0; i < 40; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
        d.visible = false; d.renderOrder = 5; _stage.add(d); k.dots.push(d);
    }
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
    band.renderOrder = 6; band.visible = false; _stage.add(band); k.band = band;
    return k;
}

function _buildUi() {
    const root = _stage.hud;
    const el = (css, parent = root) => { const e = document.createElement('div'); e.style.cssText = css; parent.appendChild(e); return e; };
    const TXT = 'color:#fff8ee;text-shadow:0 2px 0 rgba(0,0,0,.6),0 0 10px rgba(0,0,0,.5);letter-spacing:2px;';
    _ui = {};
    // The power bar, for the player whose turn it is.
    _ui.power = el('position:absolute;left:50%;top:52px;transform:translateX(-50%);width:240px;height:16px;border-radius:9px;' +
        'background:rgba(20,12,24,.6);border:2px solid rgba(255,255,255,.7);overflow:hidden;display:none;');
    _ui.powerFill = el('height:100%;width:0;background:linear-gradient(90deg,#5ee07a,#ffd23f 60%,#ff4d4d);', _ui.power);
    _ui.powerTxt = el('position:absolute;left:50%;top:70px;transform:translateX(-50%);font-size:13px;display:none;' + TXT);
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
    _c = P.compile(entry.hole);
    const course = courseByKey(entry.course);
    if (course.theme !== _theme) {
        _theme = course.theme; _courseName = course.name;
        if (_stage?.gl) { _stage.scene.background = new THREE.Color(_theme.sky); _stage.scene.fog = new THREE.Fog(_theme.fog ?? _theme.sky, 38, 90); }
    }
    if (_stage?.gl) {
        _built?.dispose(); _built = buildHole(_stage, _c, _theme, i + 1);
        const B = _c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        if (_lights) {
            const span = Math.max(B.x1 - B.x0, B.z1 - B.z0) / 2 + 4;
            const sc = _lights.key.shadow.camera;
            sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix();
            _lights.key.position.set(cx - 9, 16, cz + 11); _lights.key.target.position.set(cx, 0, cz);
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
        const side = (s - (_n - 1) / 2) * 0.85;
        f.x = f.tx = _c.tee.x - fw[0] * 1.6 - fw[1] * side; f.z = f.tz = _c.tee.z - fw[1] * 1.6 + fw[0] * side;
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
    _hud.say(`HOLE ${_hole + 1}`, `${h.name} · PAR ${h.par}`, FLY_DUR * 1000, _t, '#fde047');
    _sub = 'fly'; _subT = 0;
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
    if (_mode === 'chaos') _balls.forEach(b => { b.state = 'aim'; b.clock = 0; b.bot = { wait: 1.2 + Math.random() * 0.8 }; });
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
    _hud.say(s.name, isBotSlot(next) ? 'IS UP' : `YOUR SHOT · STROKE ${_strokes[next][_hole] + 1}`, 1000, _t, s.css);
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
        else slot = Math.max(0, Math.min(_n - 1, _n - 1 - Math.floor(p.x / (_stage.width / _n))));
        if (slot < 0 || isBotSlot(slot) || _balls[slot].state !== 'aim' || [..._drag.values()].some(d => d.slot === slot)) return;
        if (_view === 'map') _view = 'follow';
        _drag.set(e.pointerId, { slot, ax: p.x, ay: p.y, x: p.x, y: p.y });
    });
    _stage.listen('pointermove', e => {
        const d = _drag.get(e.pointerId); if (!d) return;
        const p = _stage.toLocal(e.clientX, e.clientY); d.x = p.x; d.y = p.y;
    });
    _stage.listen('pointerup', e => {
        const d = _drag.get(e.pointerId); if (!d) return;
        _drag.delete(e.pointerId);
        const a = _aimOf(d);
        _hideKit(d.slot); _hidePower();
        if (!a || a.power < MIN_PULL) return;
        _shoot(d.slot, a.dx, a.dz, a.power);
    });
    _stage.listen('pointercancel', e => { const d = _drag.get(e.pointerId); if (d) { _drag.delete(e.pointerId); _hideKit(d.slot); _hidePower(); } });
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
function _aimOf(d) {
    const px = d.x - d.ax, py = d.y - d.ay, len = Math.hypot(px, py);
    const power = Math.min(1, len / (PULL * Math.min(_stage.width, _stage.height)));
    if (len < 6) return { dx: 0, dz: 0, power: 0 };
    const b = _balls[d.slot].p;
    const g0 = _ground(d.ax, d.ay, b.y), g1 = _ground(d.x, d.y, b.y);
    let dx, dz;
    if (g0 && g1 && Math.hypot(g1[0] - g0[0], g1[1] - g0[1]) > 1e-4) { dx = g0[0] - g1[0]; dz = g0[1] - g1[1]; }
    else { dx = -px; dz = -py; }
    const n = Math.hypot(dx, dz) || 1;
    return { dx: dx / n, dz: dz / n, power };
}

function _shoot(slot, dx, dz, power) {
    const b = _balls[slot];
    if (!b || b.state !== 'aim' || b.done) return;
    if (_mode === 'turns' && slot !== _active) return;
    b.from = { x: b.p.x, y: b.p.y, z: b.p.z };
    P.strike(b.p, dx, dz, power);
    b.state = 'roll'; b.rollT = 0; if (b.trailPts) b.trailPts = [];
    _strokes[slot][_hole]++;
    _shooter = slot;
    if (_mode === 'turns') { _turnState = 'roll'; _showBtns(false); _view = 'follow'; }
    sfx('putt'); if (!isBotSlot(slot)) haptic([14]);
    const f = _figs[slot];
    if (f) { f.swing = 1; f.anim?.play('shove', { restart: true }); }
    _hideKit(slot); if (_mode === 'turns') _hidePower();
}

// ── The aim kit ──────────────────────────────────────────────────────────────
function _hideKit(slot) {
    const k = _kits[slot]; if (!k || !k.band) return;
    k.dots.forEach(d => { d.visible = false; }); k.band.visible = false; k.on = false;
}
const _UP = typeof THREE !== 'undefined' ? new THREE.Vector3(0, 1, 0) : null;
function _drawKit(slot, a) {
    const k = _kits[slot], b = _balls[slot].p;
    if (!k?.band || !_c) return;
    k.on = true;
    const col = new THREE.Color().setHSL(0.33 - a.power * 0.33, 0.9, 0.55);
    // The band: from the ball back along the pull.
    const L = 0.3 + a.power * 1.6;
    k.band.visible = true;
    k.band.scale.set(1, L, 1);
    k.band.position.set(b.x - a.dx * L / 2, b.y + P.R, b.z - a.dz * L / 2);
    k.band.quaternion.setFromUnitVectors(_UP, new THREE.Vector3(a.dx, 0, a.dz));
    k.band.material.color.copy(col);
    // The line: the shot played out, cut off a little past the first rail.
    const sim = P.simulate(_c, b, a.dx, a.dz, a.power, _t, { every: 1 / 120, dt: 1 / 120, maxT: 2.5, stopAfter: 1.6 + a.power * 6.5, bounces: 1, stopAtPipe: true });
    const pts = sim.pts, tint = sim.result === 'cup' ? 0xfde047 : sim.result === 'water' || sim.result === 'out' ? 0x7dd3fc : 0xffffff;
    let acc = 0, di = 0, last = pts[0];
    for (let i = 1; i < pts.length && di < k.dots.length; i++) {
        const p = pts[i];
        acc += Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]); last = p;
        if (acc >= 0.32) {
            acc = 0;
            const d = k.dots[di++];
            d.visible = true; d.position.set(p[0], p[1] + P.R, p[2]);
            d.material.opacity = 0.95 * (1 - di / k.dots.length * 0.7);
            d.material.color.setHex(tint);
        }
    }
    for (; di < k.dots.length; di++) k.dots[di].visible = false;
    if (_mode === 'turns' && _ui && !isBotSlot(slot)) {
        _ui.power.style.display = 'block'; _ui.powerTxt.style.display = 'block';
        _ui.powerFill.style.width = Math.round(a.power * 100) + '%';
        _ui.powerTxt.textContent = `POWER ${Math.round(a.power * 100)}%`;
    } else if (_mode === 'chaos') _hud.hint(slot, `POWER ${Math.round(a.power * 100)}%`);
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
    b.done = true; b.state = 'done'; b.sinkT = 0;
    _times[b.slot][_hole] = _holeT;
    const h = _list[_hole].hole, n = _strokes[b.slot][_hole];
    const [txt, col] = _label(n, h.par);
    sfx('cup');
    const s = seat(b.slot);
    if (!isBotSlot(b.slot)) haptic([40]);
    _nextWait = 1.8;
    if (_stage?.gl) {
        const at = new THREE.Vector3(_c.cup.x, _c.cup.y + 0.4, _c.cup.z);
        _fx.confetti(at, [s.color, 0xffffff, 0xfde047], n === 1 ? 60 : 24, n === 1 ? 4.5 : 2.6);
        if (n === 1) for (let k = 0; k < 6; k++) setTimeout(() => {
            if (!_done && _fx) _fx.burst(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3)), [0xfde047, s.color, 0xff5d8f, 0x7dd3fc][k % 4], 0.35, 0.5);
        }, k * 160);
    }
    if (n === 1) {
        sfx('ace'); _nextWait = 2.6;
        _figs.forEach(f => f.anim?.play(f.slot === b.slot ? 'victory' : 'clap'));
    } else _figs[b.slot]?.anim?.play(n - h.par >= 2 ? 'defeat' : n <= h.par ? 'victory' : 'clap');
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
function _penalty(b, kind) {
    const mine = b.slot === _shooter || _mode === 'chaos';
    if (mine) _strokes[b.slot][_hole]++;
    if (kind === 'out') { sfx('land_bad'); _say2Show(`${_theme?.scenery === 'space' ? 'LOST IN SPACE' : 'OUT OF BOUNDS'}${mine ? ' · +1' : ''}`, '#fca5a5'); }
    else {
        sfx('splash');
        if (_stage?.gl) _fx.puff(new THREE.Vector3(b.p.x, b.p.y + 0.2, b.p.z), kind === 'lava' ? 0xff7a1a : kind === 'flowers' ? 0xff8fb1 : kind === 'goo' ? 0x7a4a2a : 0xbfe8ff, 10, 0.5, 1.2);
        _say2Show(`${kind === 'flowers' ? 'IN THE FLOWERS' : kind === 'lava' ? 'LAVA!' : kind === 'goo' ? 'IN THE CHOCOLATE' : _theme?.scenery === 'pirate' ? 'SPLASH! FEED THE SHARKS' : 'SPLASH'}${mine ? ' · +1' : ''}`, '#7dd3fc');
    }
    // Back to where it was played from (a knocked ball, to where it sat).
    const f = b.from || { x: _c.tee.x, y: _c.tee.y, z: _c.tee.z };
    b.p = P.newBall(f.x, f.z, f.y);
    if (b.trailPts) b.trailPts = [];
    b.state = _mode === 'chaos' ? 'aim' : 'wait'; b.clock = 0;
    if (_strokes[b.slot][_hole] >= _limit(_list[_hole].hole)) _pickUp(b);
}

// ── The frame ────────────────────────────────────────────────────────────────
function _frame(dt) {
    if (_done) return;
    _t += dt; _subT += dt;
    _hud.tick(_t);
    if (_say2 && +_say2.dataset.t && _t > +_say2.dataset.t) { _say2.style.opacity = '0'; _say2.dataset.t = '0'; }

    if (_phase === 'play') {
        if (_sub === 'fly' && _subT >= FLY_DUR) _startPlay();
        else if (_sub === 'play') { _holeT += dt; _play(dt); }
        else if (_sub === 'card' && _subT >= CARD_DUR) { _showCard(false); _beginHole(); }
    }

    _built?.update(dt, _t);
    if (_built) animateProps(_built.root, _t);
    _drawBalls(dt);
    _drawFigs(dt);
    _fx?.update(dt);
    const dirOwns = !!_dir && _dir.update(dt);
    if (_done) return;
    if (!dirOwns && _stage?.gl && _phase === 'play') _camera(dt);
    _renderHud();
}

function _play(dt) {
    const h = _list[_hole].hole;
    // Aim, the clock, and the bots.
    if (_mode === 'turns') {
        const b = _balls[_active];
        if (b && _turnState === 'aim') {
            _turnT += dt;
            if (isBotSlot(_active)) _botTurn(dt, b);
            else {
                const d = [..._drag.values()].find(x => x.slot === _active);
                _showBtns(!d);
                if (d) { const a = _aimOf(d); if (a.power >= MIN_PULL) _drawKit(_active, a); else { _hideKit(_active); _hidePower(); } }
                if (_turnT >= CLOCK_TURNS) {
                    const pl = plan(_c, b.p, _t, 0.15);
                    _say2Show('TIME! A PUTT FOR YOU', '#fca5a5');
                    _drag.clear(); _hideKit(_active);
                    _shoot(_active, pl.dx, pl.dz, pl.power * 0.6);
                }
            }
        }
    } else {
        _balls.forEach(b => {
            if (b.state !== 'aim' || b.done) return;
            b.clock += dt;
            if (isBotSlot(b.slot)) {
                b.bot.wait -= dt;
                if (b.bot.wait <= 0) { const pl = plan(_c, b.p, _t, _botSkill); _shoot(b.slot, pl.dx, pl.dz, pl.power); b.bot.wait = 0.9 + Math.random() * 0.8 + (1 - _botSkill); }
                return;
            }
            const d = [..._drag.values()].find(x => x.slot === b.slot);
            if (d) { const a = _aimOf(d); if (a.power >= MIN_PULL) _drawKit(b.slot, a); else _hideKit(b.slot); }
            if (b.clock >= CLOCK_CHAOS) {
                const pl = plan(_c, b.p, _t, 0.15);
                [..._drag.entries()].forEach(([id, x]) => { if (x.slot === b.slot) _drag.delete(id); });
                _shoot(b.slot, pl.dx, pl.dz, pl.power * 0.5);
                _say2Show(`TIME! · ${seat(b.slot).name}`, '#fca5a5');
            }
        });
    }

    // Physics: every ball on the course, each an obstacle to the others.
    const live = _balls.filter(b => b.on && !b.done && !b.p.sunk);
    const others = live.length > 1 ? live.map(b => b.p) : null;
    for (const b of live) {
        if (b.done) continue;
        const was = b.p.rest;
        const ev = P.step(_c, b.p, dt, _t, others);
        if (!b.p.rest) {
            b.rollT += dt;
            if (b.state !== 'roll') { b.state = 'roll'; b.rollT = 0; }
        }
        if (b.rollT > ROLL_MAX && !b.p.rest && !b.p.pipe && !b.p.loop) { b.p.vx = b.p.vz = b.p.vy = 0; b.p.rest = true; b.p.air = false; b.p.y = _floorY(b.p.x, b.p.z); }
        b.clackT -= dt;
        for (const e of ev) {
            if (e.type === 'wall') { if (e.v > 1.0 && b.clackT <= 0) { sfx('clack'); b.clackT = 0.07; } }
            else if (e.type === 'bumper') { sfx('boost'); _built?.pulse(e.at); if (_stage?.gl) _fx.burst(new THREE.Vector3(b.p.x, b.p.y + 0.3, b.p.z), 0xffe08a, 0.18, 0.2); }
            else if (e.type === 'ball') { sfx('clack'); if (_mode === 'turns') _say2Show('KNOCK!', '#fde047', 700); }
            else if (e.type === 'lip') { sfx('lip'); _say2Show(e.hop ? 'TOO HOT — OVER THE CUP!' : 'ON THE LIP…', '#fde68a', 900); }
            else if (e.type === 'launch' && e.v > 4) sfx('boost');
            else if (e.type === 'land' && e.v > 2.5) { sfx('land_good'); if (_stage?.gl) _fx.puff(new THREE.Vector3(b.p.x, b.p.y + 0.05, b.p.z), 0xffffff, 4, 0.3, 0.4); }
            else if (e.type === 'pipe') sfx('swap');
            else if (e.type === 'pipeout') { sfx('boost'); if (_stage?.gl) _fx.puff(new THREE.Vector3(b.p.x, b.p.y + 0.15, b.p.z), 0xd9f99d, 5, 0.3, 0.5); }
            else if (e.type === 'loop') sfx('boost');
            else if (e.type === 'cup') _sunk(b, _mode === 'turns' && b.slot !== _shooter);
            else if (e.type === 'water' || e.type === 'out') _penalty(b, e.kind || e.type);
        }
        // Stopped.
        if (!b.done && b.p.rest && !was && b.state === 'roll') {
            b.state = _mode === 'chaos' ? 'aim' : 'wait'; b.clock = 0;
            b.from = { x: b.p.x, y: b.p.y, z: b.p.z };
            if (_strokes[b.slot][_hole] >= _limit(h)) _pickUp(b);
        }
    }
    // Turns: the next shot once everything has stopped.
    if (_mode === 'turns' && _turnState === 'roll') {
        const moving = _balls.some(b => b.on && !b.done && (!b.p.rest || b.p.pipe || b.p.loop));
        if (!moving) {
            _balls.forEach(b => { if (b.on && !b.done) { b.from = { x: b.p.x, y: b.p.y, z: b.p.z }; if (b.state === 'roll') b.state = 'wait'; } });
            _turnState = 'next'; _turnT = 0;
        }
    }
    if (_mode === 'turns' && _turnState === 'next') { _turnT += dt; if (_turnT > _nextWait) { _nextWait = 0.7; _nextTurn(); } }
    if (_mode === 'chaos' && _balls.every(b => b.done) && _sub === 'play') _holeOver();
}

function _botTurn(dt, b) {
    // Think, line it up where you can see it, then putt.
    if (!_botThink && _turnT > 0.9) _botThink = { pl: plan(_c, b.p, _t + 1.2, _botSkill), t: 0 };
    if (!_botThink) return;
    _botThink.t += dt;
    const pl = _botThink.pl;
    // The camera swings round behind the line it's chosen.
    let d = Math.atan2(pl.dz, pl.dx) - _yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    _yaw += d * Math.min(1, dt * 3);
    if (_botThink.t > 0.2) _drawKit(_active, { dx: pl.dx, dz: pl.dz, power: pl.power * Math.min(1, (_botThink.t - 0.2) / 0.7) });
    if (_botThink.t > 1.2) { _botThink = null; _shoot(_active, pl.dx, pl.dz, pl.power); }
}

// ── Cameras ──────────────────────────────────────────────────────────────────
/** The whole hole, from above and a little in front, fitted to the screen. */
function _fitCam() {
    const B = _c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    const w = B.x1 - B.x0 + 1.5, d = B.z1 - B.z0 + 1.5;
    const fov = (_stage?.camera?.fov ?? 50) * Math.PI / 180, A = (_stage?.width || 892) / Math.max(1, _stage?.height || 412);
    const t = Math.tan(fov / 2);
    const h = Math.max(d / 2 / t * 1.25, w / 2 / (t * A) * 1.08) + 1.5;
    const tilt = 0.42;
    return { pos: [cx, h * Math.cos(tilt), cz + h * Math.sin(tilt)], look: [cx, 0, cz + 0.4] };
}
function _aimPose(x, y, z, yaw, back = 1) {
    const dx = Math.cos(yaw), dz = Math.sin(yaw);
    return {
        pos: new THREE.Vector3(x - dx * CAM_BACK * back, y + CAM_UP * back, z - dz * CAM_BACK * back),
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
    } else if (_mode === 'chaos' || _sub === 'card' || _view === 'map' || _active < 0) {
        const f = _fitCam();
        _cam.pos.lerp(new THREE.Vector3(...f.pos), k); _cam.look.lerp(new THREE.Vector3(...f.look), k);
    } else if (_turnState === 'aim') {
        const b = _balls[_active].p;
        const a = _aimPose(b.x, b.y, b.z, _yaw);
        if (!_drag.size) { _cam.pos.lerp(a.pos, k); _cam.look.lerp(a.look, k); }
    } else {
        // Chase the ball that was putted (the knocks it makes are in front of it).
        const m = (_balls[_shooter] || _balls[_active]).p;
        const sp = Math.hypot(m.vx, m.vz);
        if (sp > 0.8) { let d = Math.atan2(m.vz, m.vx) - _yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); _yaw += d * Math.min(1, dt * 1.6); }
        const a = _aimPose(m.x, m.y, m.z, _yaw, 1.15);
        _cam.pos.lerp(a.pos, k * 0.8); _cam.look.lerp(a.look, Math.min(1, k * 1.4));
    }
    cam.position.copy(_cam.pos);
    cam.lookAt(_cam.look);
    cam.userData.look = _cam.look.toArray();
}

// ── Drawing ──────────────────────────────────────────────────────────────────
let _axis = null;
function _drawBalls(dt) {
    if (!_c) return;
    _axis = _axis || new THREE.Vector3();
    _balls.forEach(b => {
        if (!b.mesh) return;
        const p = b.p;
        const show = b.on && !b.picked && !p.pipe;
        if (b.sinkT >= 0 && b.sinkT < 1) {
            b.mesh.visible = true;
            b.sinkT = Math.min(1, b.sinkT + dt * 2.5);
            b.mesh.position.set(_c.cup.x, _c.cup.y + P.R - b.sinkT * 0.35, _c.cup.z);
            b.mesh.scale.setScalar(1 - b.sinkT * 0.3);
        } else if (b.done) b.mesh.visible = false;
        else if (p.loop) {
            b.mesh.visible = true;
            const l = p.loop.l, u = p.loop.t / p.loop.dur, n = Math.hypot(l.dir[0], l.dir[1]) || 1;
            const ang = u * Math.PI * 2, rad = 0.9, along = l.len * u + Math.sin(ang) * rad * 0.9;
            b.mesh.position.set(l.a[0] + l.dir[0] / n * along, _floorY(l.a[0], l.a[1]) + P.R + rad * (1 - Math.cos(ang)), l.a[1] + l.dir[1] / n * along);
        } else {
            b.mesh.visible = show;
            const ox = b.mesh.position.x, oz = b.mesh.position.z;
            b.mesh.position.set(p.x, p.y + P.R, p.z);
            const mx = p.x - ox, mz = p.z - oz, dist = Math.hypot(mx, mz);
            if (dist > 1e-4 && dist < 2) { _axis.set(mz, 0, -mx).normalize(); b.mesh.rotateOnWorldAxis(_axis, dist / P.R); }
        }
        // The ring on the floor under a ball at rest; the marker over the one to play.
        const rest = show && p.rest && !b.done;
        b.ring.visible = rest;
        if (rest) { b.ring.position.set(p.x, p.y + 0.012, p.z); b.ring.material.opacity = 0.55 + Math.sin(_t * 5) * 0.25; }
        const mine = _mode === 'turns' ? b.slot === _active && _turnState === 'aim' : b.state === 'aim';
        b.marker.visible = show && mine && !b.done && _sub === 'play';
        if (b.marker.visible) { b.marker.position.set(p.x, p.y + 0.75 + Math.sin(_t * 4) * 0.08, p.z); b.marker.rotation.y += dt * 2; }
        // The trail.
        if (show && !p.rest && !b.done) { b.trailPts.push([p.x, p.y + P.R * 0.6, p.z]); if (b.trailPts.length > 36) b.trailPts.shift(); }
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
        // The putt: a swing of the club.
        if (f.club) {
            if (f.swing > 0) f.swing = Math.max(0, f.swing - dt * 3);
            const k = f.swing;
            f.club.rotation.x = 0.25 + (k > 0.6 ? -(1 - k) * 2.2 : k * 1.4);
        }
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
                ? (_hole === 0 && now === 0 ? 'DRAG BACK · LET GO' : `YOUR SHOT · ${Math.max(0, Math.ceil(CLOCK_TURNS - _turnT))}s`)
                : `${now} SO FAR · ${_fmt(_toPar(s))}`);
        } else if (![..._drag.values()].some(d => d.slot === s)) {
            _hud.hint(s, b.state === 'aim' ? (_hole === 0 && now === 0 ? 'DRAG BACK ON YOUR STRIP' : `STROKE ${now + 1} · ${Math.max(0, Math.ceil(CLOCK_CHAOS - b.clock))}s`) : `ROLLING · ${now}`);
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
    const cell = 'padding:3px 5px;text-align:center;min-width:22px;font-size:15px;';
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
        `<div style="font-size:13px;opacity:.7;letter-spacing:1px;">${_courseName} · ${_mode === 'turns' ? 'TURNS' : 'CHAOS'}</div></div>`;
    html += '<div style="overflow-x:auto;"><table style="border-collapse:collapse;">';
    html += `<tr style="background:#1f5130;color:#fff;"><td style="${cell}text-align:left;">HOLE</td>` +
        _list.map((_, i) => `<td style="${cell}${i === _hole && !final ? 'background:#3f9d4f;' : ''}">${i + 1}</td>`).join('') + `<td style="${cell}">TOT</td><td style="${cell}">±</td></tr>`;
    html += `<tr style="background:#e7efe2;"><td style="${cell}text-align:left;opacity:.8;">PAR</td>` +
        _list.map(x => `<td style="${cell}opacity:.8;">${x.hole.par}</td>`).join('') + `<td style="${cell}opacity:.8;">${parT}</td><td></td></tr>`;
    const order = _seats().slice().sort((a, b) => _toPar(a) - _toPar(b) || _total(a) - _total(b));
    order.forEach((s, r) => {
        const st = seat(s), tp = _toPar(s);
        html += `<tr style="border-top:1px solid rgba(0,0,0,.1);"><td style="${cell}text-align:left;white-space:nowrap;">` +
            `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${st.css};margin-right:6px;"></span>${r === 0 ? '👑 ' : ''}${st.name}</td>` +
            _list.map((x, i) => `<td style="${cell}">${i <= _hole ? mark(_strokes[s][i], x.hole.par) : ''}</td>`).join('') +
            `<td style="${cell}font-size:17px;">${_total(s)}</td><td style="${cell}font-size:17px;color:${tp < 0 ? '#15803d' : tp > 0 ? '#b91c1c' : '#1d2a1f'};">${_fmt(tp)}</td></tr>`;
    });
    html += '</table></div>';
    if (!final) html += '<div style="margin-top:6px;font-size:12px;opacity:.6;text-align:center;letter-spacing:1px;">TAP TO CARRY ON</div>';
    _card.innerHTML = html;
    _card.style.display = 'block';
    requestAnimationFrame(() => { if (_card) { _card.style.opacity = '1'; _card.style.transform = 'translate(-50%,-50%) scale(1)'; } });
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
    const sub = w < 0 ? `LEVEL ON ${tot[order[0]]}`
        : tot[w] !== tot[runner] ? `${tot[w]} STROKES (${_fmt(tot[w] - par)}) · ${tot[runner]} NEXT`
        : `LEVEL ON ${tot[w]} · ${_mode === 'turns' ? 'ON COUNTBACK' : `QUICKER BY ${Math.abs(tt[w] - tt[runner]).toFixed(1)}s`}`;
    _kits.forEach((_, s) => _hideKit(s));
    _showCard(true, true);
    setTimeout(() => {
        if (_done || !_dir) return;
        _showCard(false);
        _dir.close({ winner: w, figs: _figs.filter(f => f.rig).map(f => ({ slot: f.slot, rig: f.rig, anim: f.anim })), sub, onDone: () => _finish(w, rank) });
    }, _forceHoles ? 400 : 3200);
    const el = document.getElementById('mg-neutral');
    if (el) el.textContent = w < 0 ? 'DRAW!' : `${seat(w).name} WINS!`;
}

// ── Probe hooks ──────────────────────────────────────────────────────────────
let _forceHoles = null;
export function _debugState() {
    return {
        phase: _phase, n: _n, sub: _sub, hole: _hole, mode: _mode, active: _active, turn: _turnState, view: _view,
        course: _list[0]?.course, holes: _list.map(x => x.hole.key), par: _list.map(x => x.hole.par),
        strokes: _strokes.map(s => [...s]), times: _times.map(s => s.map(t => +t.toFixed(2))),
        balls: _balls.map(b => ({ x: +b.p.x.toFixed(2), y: +b.p.y.toFixed(2), z: +b.p.z.toFixed(2), v: +Math.hypot(b.p.vx, b.p.vz).toFixed(2), state: b.state, holed: b.done && !b.picked, picked: b.picked, on: b.on, air: b.p.air })),
        cup: _c ? [_c.cup.x, _c.cup.z] : null, tee: _c ? [_c.tee.x, _c.tee.z] : null,
        views: 1, gl: !!_stage?.gl, turned: !!_stage?.turned, card: !!_card && _card.style.display === 'block',
        aiming: _kits.map(k => k.on), dots: _kits.map(k => k.dots.filter(d => d.visible).length),
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
export function _debugSim(slot, dx, dz, p) { const b = _balls[slot]; return b && _c ? P.simulate(_c, b.p, dx, dz, p, _t) : null; }
