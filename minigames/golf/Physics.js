// ============================================================
// GOLF PHYSICS (v2) — a ball on a mini golf course, no THREE, no cannon.js.
//
// Deterministic and cheap, so the very same code draws the aim preview and
// lets a bot try shots ahead. The course is a 2.5D world the ball moves
// through in full 3D:
//
//   tiles   rectangles of floor: a plane (height y at the centre, slope
//           [gx, gz]) with shapes on top — hills and bowls, ridges and
//           whoops, troughs (half-pipes) — and a surface kind. A tile can
//           move (a raft), lift (a drawbridge), spin (a turntable) or flow
//           (a conveyor, a creek). The ball stands on the highest tile under
//           it that it can reach.
//   walls   vertical segments standing on the floor, with a material (wood,
//           rubber, metal, stone, hedge, candy) that sets the bounce and the
//           scrub along it: the rail round every exposed tile edge, plus the
//           hole's own. A ball in the air above one goes over it.
//   bumpers posts that kick (or pegs that just deflect).
//   movers  walls and heads that move with time: windmill sails, sweepers and
//           turnstiles, sliders, gates, hammers.
//   fields  fans (a push across a box) and magnets (a pull toward a point).
//   mines   a charge on the floor that blows the ball up and away.
//   pipes   a mouth that swallows the ball and puts it out somewhere else
//           (a hose, a cannon, a teleporter, a drain).
//   cup     a real hole: the ball drops through the floor, the rim catches,
//           rattles and spits it, and it's in once it's below the rim.
//
// The ball spins. A putt leaves the face skidding with a little forward roll;
// the floor's friction brings the spin up to the speed and from then on it
// rolls (and a rolling ball feels only 5/7 of a slope). A rail bounce turns
// the ball but not its spin, so it skids again and grabs — on ice for a long
// way. That's the whole of "realistic putting": the rest is the floor.
//
// Coordinates: x, z across the floor, y up, in course units (a ball is 0.14).
// A ball's y is the height of its BOTTOM; its centre is y + R.
// ============================================================

export const R = 0.14;                 // ball radius
export const CUP_R = 0.34;              // cup radius (a real hole: the ball drops through it)
export const MAXV = 16;                // a full pull (a skid gives some back, see PUTT_ROLL)
const PUTT_ROLL = 0.55;                // how much forward roll a putter's loft gives at impact (× speed)
const G = 16;                          // gravity
const ROLL = 5 / 7;                    // a rolling ball feels 5/7 of the slope
const C0 = 1.1, C1 = 0.22;             // rolling resistance: constant + per unit speed (turf)

/**
 * Surfaces: rolling resistance (× turf), bounce off it, how a moving floor
 * drags the ball, and mu — the sliding friction that turns a skid into a roll
 * (high: it grabs at once; ice: it skids on and on).
 */
export const SURFACE = {
    turf:      { roll: 1,    bounce: 0.3,  mu: 0.45 },
    felt:      { roll: 0.72, bounce: 0.3,  mu: 0.35 },                  // a fast green
    rough:     { roll: 2.3,  bounce: 0.18, mu: 0.8 },
    sand:      { roll: 4.6,  bounce: 0.04, mu: 1.2, grab: true },
    ice:       { roll: 0.26, bounce: 0.45, mu: 0.04 },
    wood:      { roll: 0.9,  bounce: 0.4,  mu: 0.3 },
    metal:     { roll: 0.85, bounce: 0.45, mu: 0.18 },
    carpet:    { roll: 1.4,  bounce: 0.25, mu: 0.6 },
    puddle:    { roll: 3.4,  bounce: 0.0,  mu: 0.5, splash: true },
    boost:     { roll: 0.9,  bounce: 0.3,  mu: 0.45 },
    conveyor:  { roll: 1,    bounce: 0.3,  mu: 0.5, drag: 5 },
    creek:     { roll: 1.3,  bounce: 0.1,  mu: 0.3, drag: 3, splash: true },
    turntable: { roll: 1,    bounce: 0.3,  mu: 0.45, drag: 7 },
    raft:      { roll: 1.1,  bounce: 0.35, mu: 0.45, drag: 12 },
    jelly:     { roll: 1.6,  bounce: 0.88, mu: 0.6 },
    bouncy:    { roll: 1.5,  bounce: 0.75, mu: 0.6 },                   // a bouncy-castle floor
};
/** Floors that cost a stroke and send the ball back: water, lava, the flower bed, chocolate. */
export const HAZARD = { water: 1, lava: 1, flowers: 1, void: 1, goo: 1 };
/** Rails and blocks: bounce (restitution) and scrub (tangential loss) by material. */
export const MATERIAL = {
    wood:   { e: 0.66, scrub: 0.05 },
    rubber: { e: 0.84, scrub: 0.12 },
    metal:  { e: 0.72, scrub: 0.02 },
    stone:  { e: 0.55, scrub: 0.08 },
    hedge:  { e: 0.3,  scrub: 0.25 },
    candy:  { e: 0.74, scrub: 0.04 },
    neon:   { e: 0.78, scrub: 0.02 },
    inflatable: { e: 0.94, scrub: 0.1 },   // bouncy castle walls: they give
};
const STEP_UP = 0.1;                   // the most the floor can rise under a rolling ball
const RAIL_H = 0.3;
const BUMP_E = 1.25, BUMP_KICK = 2.5;
const STOP_V = 0.06;
const FLOOR_OUT = -6;                  // below this, the ball is lost
const CUP_DEPTH = 0.55;
const JELLY_V = 4.8;                   // how hard a jelly pad throws a ball up
const MINE_V = 7;                      // a mine's blast (power 1)

// ── The course ───────────────────────────────────────────────────────────────

/**
 * Compile a hole's data into what the physics reads. Pure: the same hole
 * always compiles the same.
 *   hole.tiles  [{ r: [x0, z0, x1, z1], y, slope: [gx, gz], kind, open, rail,
 *                  hills: [[x, z, r, h]], ridges: [[x1, z1, x2, z2, w, h]],
 *                  trough: { axis: 'x'|'z', h }, boost: [ax, az], flow: [vx, vz],
 *                  spin: w (turntable, round the tile's centre, out to discR),
 *                  move: { axis, amp, speed, phase } (a raft),
 *                  lift: { period, down, phase } (a drawbridge: there for `down` of each period) }]
 *                  tilt: { axis, amp, speed, phase } (a see-saw: its slope rocks along axis),
 *                  elev: { amp, period, phase } (a lift: rises amp and back) }
 *               open: the edges with no rail — any of 'n' (−z), 's' (+z), 'w' (−x), 'e' (+x)
 *   hole.rail   the rails' material (default wood); hole.blockMat (default stone)
 *   hole.walls  [[x1, z1, x2, z2, h?, mat?]]
 *   hole.blocks [[x0, z0, x1, z1, h?]]
 *   hole.bumpers [[x, z, r, kick?, e?]]   (a peg: kick 0, e ~0.6)
 *   hole.movers [{ type: 'windmill'|'sweeper'|'slider'|'gate'|'hammer', ... }]
 *   hole.fans   [{ r: [x0, z0, x1, z1], f: [ax, az] }]
 *   hole.magnets [{ x, z, r, k }]
 *   hole.pipes  [{ a, b, dir, r?, delay?, keep?, out?, style? }]
 *   hole.loops  [{ a, dir, len, minV?, b?, style? }]  (style 'corkscrew' with b: a spiral down to b)
 *   hole.mines  [[x, z, r?, power?]]
 *   hole.gravity  a multiplier; hole.links: extra [x1, z1, x2, z2] the path field may jump
 *   hole.cup [x, z], hole.tee [x, z]
 */
export function compile(hole) {
    const tiles = hole.tiles.map((t, i) => {
        const [x0, z0, x1, z1] = t.r;
        const T = {
            i, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1),
            y: t.y || 0, gx: t.slope?.[0] || 0, gz: t.slope?.[1] || 0,
            hills: t.hills || [], ridges: t.ridges || [], trough: t.trough || null,
            kind: t.kind || 'turf', open: t.open || '', boost: t.boost || null, flow: t.flow || null,
            spin: t.spin || 0, discR: t.discR || 0, move: t.move || null, lift: t.lift || null,
            tilt: t.tilt || null, elev: t.elev || null, railMat: t.railMat || null,
            rail: t.rail ?? !(t.move || t.lift),
        };
        T.cx = (T.x0 + T.x1) / 2; T.cz = (T.z0 + T.z1) / 2;
        if (T.spin && !T.discR) T.discR = Math.min(T.x1 - T.x0, T.z1 - T.z0) / 2;
        if (T.spin) T.kind = 'turntable';
        return T;
    });
    const g = hole.gravity || 1;
    const c = {
        hole, tiles, walls: [], bumpers: [], pipes: [], loops: [], movers: hole.movers || [],
        fans: hole.fans || [], magnets: hole.magnets || [],
        mines: (hole.mines || []).map(([x, z, r, p]) => ({ x, z, r: r || 0.32, p: p ?? 1 })),
        G: G * g, RG: G * g * ROLL, _t: 0,
        dynamic: tiles.some(t => t.move || t.lift || t.flow || t.spin || t.tilt || t.elev) || (hole.movers || []).length > 0,
    };
    const railMat = hole.rail || 'wood';
    // Rails round every tile edge where the floor beyond is missing or out of
    // a rolling ball's reach (and the edge isn't marked open). Moving floors
    // are ignored here: an edge meeting a raft's dock is opened by the hole.
    const still = tiles.filter(t => !t.move);
    still.forEach(t => {
        if (!t.rail) return;
        const edges = [
            ['n', t.x0, t.z0, t.x1, t.z0, 0, -1],
            ['s', t.x0, t.z1, t.x1, t.z1, 0, 1],
            ['w', t.x0, t.z0, t.x0, t.z1, -1, 0],
            ['e', t.x1, t.z0, t.x1, t.z1, 1, 0],
        ];
        for (const [side, ax, az, bx, bz, nx, nz] of edges) {
            if (t.open.includes(side)) continue;
            const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 0.2));
            let run = null;
            const flush = (u1) => {
                if (run === null) return;
                const p = [ax + (bx - ax) * run, az + (bz - az) * run], q = [ax + (bx - ax) * u1, az + (bz - az) * u1];
                const wl = _wall(c, p[0], p[1], q[0], q[1], t.railMat ? 0.45 : RAIL_H, t, t.railMat || railMat);
                // A see-saw's or a lift's rail has to cover the whole swing.
                const sw = _swing(t);
                if (sw) { wl.b1 -= sw.down; wl.b2 -= sw.down; wl.h += sw.down + sw.up; wl.moving = true; wl.tile = t.i; }
                c.walls.push(wl);
                run = null;
            };
            for (let k = 0; k < n; k++) {
                const u = (k + 0.5) / n;
                const px = ax + (bx - ax) * u, pz = az + (bz - az) * u;
                const here = _tileH(t, px, pz);
                const ox = px + nx * 0.05, oz = pz + nz * 0.05;
                // A lift meets a floor at the top of its ride as well as the bottom.
                const meets = (o) => {
                    const hs = [_tileH(o, ox, oz) - here];
                    if (o.elev) hs.push(_tileH(o, ox, oz) + (o.elev.amp || 1) - here);
                    if (t.elev) hs.push(_tileH(o, ox, oz) - here - (t.elev.amp || 1));
                    return hs.some(dh => Math.abs(dh) <= STEP_UP);
                };
                const next = still.find(o => o !== t && _inTile(o, ox, oz) && meets(o));
                const needs = !next;
                if (needs && run === null) run = k / n;
                if (!needs && run !== null) flush(k / n);
            }
            flush(1);
        }
    });
    (hole.walls || []).forEach(([x1, z1, x2, z2, h, mat]) => c.walls.push(_wall(c, x1, z1, x2, z2, h ?? RAIL_H, null, mat || railMat)));
    const bm = hole.blockMat || 'stone';
    (hole.blocks || []).forEach(([x0, z0, x1, z1, h]) => {
        const hh = h ?? 0.5;
        [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]].forEach(([a, b, p, q]) => c.walls.push({ ..._wall(c, a, b, p, q, hh, null, bm), block: true }));
    });
    (hole.bumpers || []).forEach(([x, z, r, kick, e]) => c.bumpers.push({ x, z, r, kick: kick ?? BUMP_KICK, e: e ?? BUMP_E, y: floorAt(c, x, z, 9)?.h ?? 0 }));
    (hole.pipes || []).forEach(p => c.pipes.push({ ...p, r: p.r || 0.32 }));
    (hole.loops || []).forEach(l => c.loops.push({ ...l, minV: l.minV || 6.5 }));
    const cupF = floorAt(c, hole.cup[0], hole.cup[1], 9);
    c.cup = { x: hole.cup[0], z: hole.cup[1], y: cupF ? cupF.h : 0 };
    const teeF = floorAt(c, hole.tee[0], hole.tee[1], 9);
    c.tee = { x: hole.tee[0], z: hole.tee[1], y: teeF ? teeF.h : 0 };
    c.bounds = tiles.reduce((b, t) => {
        const a = t.move ? t.move.amp : 0, ax = t.move?.axis === 'x' ? a : 0, az = t.move?.axis === 'z' ? a : 0;
        return { x0: Math.min(b.x0, t.x0 - ax), z0: Math.min(b.z0, t.z0 - az), x1: Math.max(b.x1, t.x1 + ax), z1: Math.max(b.z1, t.z1 + az) };
    }, { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
    c.path = [[hole.tee[0], hole.tee[1]], ...(hole.path || []), [hole.cup[0], hole.cup[1]]];
    return c;
}

/** How far a rocking or lifting tile's floor goes below / above its rest. */
function _swing(t) {
    if (t.tilt) { const half = (t.tilt.axis === 'z' ? t.z1 - t.z0 : t.x1 - t.x0) / 2, d = Math.abs(t.tilt.amp || 0.2) * half; return { down: d, up: d }; }
    if (t.elev) return { down: 0, up: Math.abs(t.elev.amp || 1) };
    return null;
}

function _wall(c, x1, z1, x2, z2, h, tile, mat) {
    const b1 = tile ? _tileH(tile, x1, z1) : (floorAt(c, x1, z1, 9)?.h ?? 0);
    const b2 = tile ? _tileH(tile, x2, z2) : (floorAt(c, x2, z2, 9)?.h ?? 0);
    return { x1, z1, x2, z2, b1, b2, h, rail: !!tile, mat: MATERIAL[mat] ? mat : 'wood' };
}

// ── Tiles over time ──────────────────────────────────────────────────────────

/** Where a moving tile is at time t, and how fast it's going: { dx, dz, vx, vz }. */
export function tileOffset(t, time) {
    if (!t.move) return { dx: 0, dz: 0, vx: 0, vz: 0 };
    const m = t.move, s = m.speed || 0.6, a = m.amp || 2, ph = m.phase || 0;
    const o = a * Math.sin(time * s + ph), v = a * s * Math.cos(time * s + ph);
    return m.axis === 'z' ? { dx: 0, dz: o, vx: 0, vz: v } : { dx: o, dz: 0, vx: v, vz: 0 };
}
/** Is a lifting tile (a drawbridge) down, at time t? And how far down, 0..1, for drawing. */
export function liftState(t, time) {
    if (!t.lift) return { down: true, k: 1 };
    const L = t.lift, P = L.period || 6, D = L.down ?? 0.55;
    const u = (((time + (L.phase || 0)) % P) + P) % P / P;
    // Down for the first D of the cycle; a quarter of the rest swinging each way.
    const swing = (1 - D) * 0.25;
    let k;
    if (u < D) k = 1;
    else if (u < D + swing) k = 1 - (u - D) / swing;
    else if (u < 1 - swing) k = 0;
    else k = (u - (1 - swing)) / swing;
    return { down: k > 0.98, k };
}

const _inTile = (t, x, z) => x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1;
function _inTileAt(t, x, z, time) {
    if (t.lift && !liftState(t, time).down) return false;
    if (!t.move) return _inTile(t, x, z);
    const o = tileOffset(t, time);
    return x >= t.x0 + o.dx && x <= t.x1 + o.dx && z >= t.z0 + o.dz && z <= t.z1 + o.dz;
}

/** The height of a tile's floor at (x, z), shapes and all (in the tile's own frame). */
export const tileHeight = (t, x, z, time = 0) => _tileH(t, x, z, time);
/** A see-saw's extra slope, and a lift's rise, at time `time`. */
export function tiltAt(t, time) { if (!t.tilt) return 0; const m = t.tilt; return (m.amp || 0.2) * Math.sin(time * (m.speed || 0.9) + (m.phase || 0)); }
/** A lift dwells at the bottom, rises, dwells at the top and comes down — 30/20/30/20 of its period. */
export function elevAt(t, time) {
    if (!t.elev) return 0;
    const m = t.elev, P = m.period || 7, u = ((((time + (m.phase || 0)) / P) % 1) + 1) % 1;
    const ss = x => x * x * (3 - 2 * x);
    const k = u < 0.3 ? 0 : u < 0.5 ? ss((u - 0.3) / 0.2) : u < 0.8 ? 1 : 1 - ss((u - 0.8) / 0.2);
    return (m.amp || 1) * k;
}
function _tileH(t, x, z, time = 0) {
    let h = t.y + t.gx * (x - t.cx) + t.gz * (z - t.cz);
    if (t.tilt) h += tiltAt(t, time) * (t.tilt.axis === 'z' ? z - t.cz : x - t.cx);
    if (t.elev) h += elevAt(t, time);
    for (const [hx, hz, r, hh] of t.hills) {
        const d = Math.hypot(x - hx, z - hz);
        if (d < r) { const k = Math.cos(d / r * Math.PI / 2); h += hh * k * k; }
    }
    for (const [ax, az, bx, bz, w, hh] of t.ridges) {
        const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
        const u = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
        const d = Math.hypot(x - (ax + ex * u), z - (az + ez * u));
        if (d < w) { const k = Math.cos(d / w * Math.PI / 2); h += hh * k * k; }
    }
    if (t.trough) {
        // A half-pipe: flat-bottomed, curving up to h at both sides.
        const across = t.trough.axis === 'x' ? (z - t.z0) / (t.z1 - t.z0) : (x - t.x0) / (t.x1 - t.x0);
        const s = Math.max(0, Math.abs(across - 0.5) * 2 - (t.trough.flat ?? 0.3)) / (1 - (t.trough.flat ?? 0.3));
        h += t.trough.h * s * s;
    }
    return h;
}
const _E = 0.01;
function _tileGrad(t, x, z, time = 0) {
    // Numerically: every shape gets a slope without its own derivative.
    return [(_tileH(t, x + _E, z, time) - _tileH(t, x - _E, z, time)) / (2 * _E), (_tileH(t, x, z + _E, time) - _tileH(t, x, z - _E, time)) / (2 * _E)];
}

/**
 * The floor under (x, z) that a ball at height y stands on, at the course's
 * current time: the highest tile whose floor there is no higher than
 * y + reach. Null over a gap. Over the cup, there is no floor.
 */
export function floorAt(c, x, z, y, reach = STEP_UP, time = c._t) {
    let best = null, bh = -Infinity, off = null;
    for (const t of c.tiles) {
        if (!_inTileAt(t, x, z, time)) continue;
        const o = t.move ? tileOffset(t, time) : null;
        const lx = o ? x - o.dx : x, lz = o ? z - o.dz : z;
        const h = _tileH(t, lx, lz, time);
        if (h <= y + reach && h > bh) { bh = h; best = t; off = o; }
    }
    if (!best) return null;
    const lx = off ? x - off.dx : x, lz = off ? z - off.dz : z;
    const [gx, gz] = _tileGrad(best, lx, lz, time);
    // How the floor itself moves under the ball.
    let sv = null;
    if (best.flow) sv = [best.flow[0], best.flow[1]];
    else if (best.spin && Math.hypot(x - best.cx, z - best.cz) <= best.discR) sv = [-best.spin * (z - best.cz), best.spin * (x - best.cx)];
    else if (off) sv = [off.vx, off.vz];
    const kind = best.spin && !sv ? 'turf' : best.kind;
    // A see-saw or a lift moves under a ball at rest without dragging it: keep it awake.
    return { h: bh, gx, gz, kind, tile: best, sv, awake: !!(best.tilt || best.elev) };
}

// ── Moving things ────────────────────────────────────────────────────────────

/**
 * The movers' walls at time t, each with the velocity of its middle (or a
 * spin) so a hit can pass speed on. Pure in t: the bot and the preview see
 * where they'll be.
 *   windmill { x, z, axis: 'x'|'z', w, speed }  the door is shut while a sail is down
 *   sweeper  { x, z, len, speed, arms?, r0?, phase?, mat? } bars spinning flat round (x, z); arms 3+ is
 *                                                a turnstile; r0 leaves the middle open (a spinner maze)
 *   slider   { x, z, len, bar, axis, amp, speed, phase }
 *   gate     { x, z, axis, w, speed, phase }     a portcullis: shut half the time
 *   liftgate { x, z, axis, w, tile, at: 'bottom'|'top' } a lift's door: open only while the
 *                                                lift (tiles[tile]) is level with this floor
 *   hammer   { x, z, axis, amp, r, speed, phase } a head swinging across, as a moving post
 */
export function moverWalls(c, t) {
    const out = [];
    for (const m of c.movers) {
        let base = m._base ?? (m._base = floorAt(c, m.x, m.z, 9, STEP_UP, 0)?.h ?? 0);
        if (m.type === 'windmill' || m.type === 'gate' || m.type === 'liftgate') {
            const shut = m.type === 'windmill' ? windmillShut(m, t) : m.type === 'gate' ? gateShut(m, t) : liftGateShut(c, m, t);
            if (shut) {
                const w = m.w || 0.55;
                // A lift's door stands the whole height of the shaft: nothing gets
                // in or out between floors, at the bottom or the top.
                let h = 0.5;
                if (m.type === 'liftgate') { const T = c.tiles[m.tile]; base = T ? T.y : base; h = (T?.elev?.amp || 1) + 0.6; }
                if (m.axis === 'z') out.push({ x1: m.x, z1: m.z - w, x2: m.x, z2: m.z + w, b1: base, b2: base, h, vx: 0, vz: 0, mover: m, mat: 'wood' });
                else out.push({ x1: m.x - w, z1: m.z, x2: m.x + w, z2: m.z, b1: base, b2: base, h, vx: 0, vz: 0, mover: m, mat: 'wood' });
            }
        } else if (m.type === 'sweeper') {
            const a = t * (m.speed || 1.2) + (m.phase || 0), L = m.len || 2, n = m.arms || 2, r0 = m.r0 || 0;
            for (let k = 0; k < n; k++) {
                const s = k / n * Math.PI * 2;
                const ex = m.x + Math.cos(a + s) * L, ez = m.z + Math.sin(a + s) * L;
                const sx = m.x + Math.cos(a + s) * r0, sz = m.z + Math.sin(a + s) * r0;
                out.push({ x1: sx, z1: sz, x2: ex, z2: ez, b1: base, b2: base, h: 0.4, spin: m.speed || 1.2, cx: m.x, cz: m.z, mover: m, mat: m.mat || 'rubber', thick: 0.06 });
            }
        } else if (m.type === 'slider') {
            const L = m.len || 1.6, sp = m.speed || 1.4, A = m.amp || 1.5, ph = m.phase || 0;
            const o = A * Math.sin(t * sp + ph), v = A * sp * Math.cos(t * sp + ph);
            const bx = (m.bar || 'z') === 'x' ? 1 : 0, bz = 1 - bx;
            const mx = (m.axis || 'z') === 'x' ? 1 : 0, mz = 1 - mx;
            const cx = m.x + mx * o, cz = m.z + mz * o;
            out.push({ x1: cx - bx * L / 2, z1: cz - bz * L / 2, x2: cx + bx * L / 2, z2: cz + bz * L / 2, b1: base, b2: base, h: 0.4,
                       vx: mx * v, vz: mz * v, mover: m, thick: 0.15, mat: 'rubber' });
        }
    }
    return out;
}
/** The hammers' heads at time t: moving posts { x, z, r, vx, vz, y }. */
export function hammerHeads(c, t) {
    const out = [];
    for (const m of c.movers) {
        if (m.type !== 'hammer') continue;
        const A = m.amp || 1.5, s = m.speed || 1.6, ph = m.phase || 0;
        const o = A * Math.sin(t * s + ph), v = A * s * Math.cos(t * s + ph);
        const ax = (m.axis || 'z') === 'x' ? 1 : 0, az = 1 - ax;
        out.push({ x: m.x + ax * o, z: m.z + az * o, r: m.r || 0.35, vx: ax * v, vz: az * v, y: m._base ?? (m._base = floorAt(c, m.x, m.z, 9, STEP_UP, 0)?.h ?? 0), m });
    }
    return out;
}
export const windmillAngle = (m, t) => t * (m.speed || 1.6);
export function windmillShut(m, t) {
    const a = windmillAngle(m, t);
    for (let k = 0; k < 4; k++) {
        const d = ((a + k * Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (Math.abs(d - Math.PI) < 0.32) return true;
    }
    return false;
}
/** A gate's height 0 (open, up) .. 1 (shut, down), smoothed; shut for the physics past 0.6. */
export function gateDown(m, t) {
    const s = Math.sin(t * (m.speed || 1.1) + (m.phase || 0));
    return Math.max(0, Math.min(1, 0.5 + s * 1.6));
}
export const gateShut = (m, t) => gateDown(m, t) > 0.6;
/** A lift's door is shut unless the lift is at this door's floor (within a hair). */
export function liftGateShut(c, m, t) {
    const T = c.tiles[m.tile];
    if (!T || !T.elev) return false;
    const e = elevAt(T, t), amp = T.elev.amp || 1;
    return m.at === 'top' ? e < amp - 0.04 : e > 0.04;
}

// ── The ball ─────────────────────────────────────────────────────────────────

export function newBall(x, z, y = 0) {
    // wx, wz: the spin, as the speed the ball's surface turns at (rolling: wx = vx).
    return { x, y, z, vx: 0, vy: 0, vz: 0, wx: 0, wz: 0, air: false, rest: true, kind: 'turf', pipe: null, loop: null, sunk: false, inCup: false, jelly: false };
}

/** Hit it: a direction on the floor and a power 0..1. */
export function strike(b, dx, dz, power) {
    const n = Math.hypot(dx, dz) || 1, v = Math.max(0, Math.min(1, power)) * MAXV;
    b.vx = dx / n * v; b.vz = dz / n * v; b.vy = 0; b.rest = false;
    b.wx = b.vx * PUTT_ROLL; b.wz = b.vz * PUTT_ROLL;   // off the face skidding, with a little roll
}
/** Is the ball skidding (its spin not caught up with its speed)? */
export const skidding = b => Math.hypot((b.vx - (b.wx ?? b.vx)), (b.vz - (b.wz ?? b.vz))) > 0.25;

/**
 * Advance one ball by dt at course time t. Returns the events of the step, an
 * array (often empty) of { type, ... }:
 *   wall {v, mat}  bumper {at}  hammer  ball {other, v}  cup  rim {v}  lip
 *   water {kind}  out  land {v, kind}  launch {v}  jelly  pipe  pipeout  loop  loopfail
 *   splash (a puddle or creek)  spray (sand)
 * `others` are the other balls on the course, as obstacles (and they move).
 */
export function step(c, b, dt, t, others = null, ev = []) {
    if (b.sunk) return ev;
    c._t = t;
    if (b.pipe) {
        b.pipe.t -= dt;
        if (b.pipe.t <= 0) {
            const p = b.pipe.p, sp = b.pipe.v;
            const n = Math.hypot(p.dir[0], p.dir[1]) || 1;
            const f = floorAt(c, p.b[0], p.b[1], 9);
            Object.assign(b, { x: p.b[0], z: p.b[1], y: f ? f.h : 0, vx: p.dir[0] / n * sp, vz: p.dir[1] / n * sp, vy: 0, air: false, pipe: null, rest: false });
            b.wx = b.vx; b.wz = b.vz;
            ev.push({ type: 'pipeout', p });
        }
        return ev;
    }
    if (b.loop) {
        b.loop.t += dt;
        if (b.loop.t >= b.loop.dur) {
            const l = b.loop.l, n = Math.hypot(l.dir[0], l.dir[1]) || 1;
            // Out the far side (a loop) or at the bottom of the spiral (a corkscrew).
            const ox = l.b ? l.b[0] : l.a[0] + l.dir[0] / n * l.len, oz = l.b ? l.b[1] : l.a[1] + l.dir[1] / n * l.len;
            const od = l.out || l.dir, on = Math.hypot(od[0], od[1]) || 1;
            const f = floorAt(c, ox, oz, 99);
            Object.assign(b, { x: ox, z: oz, y: f ? f.h : 0, vx: od[0] / on * b.loop.v, vz: od[1] / on * b.loop.v, vy: 0, air: false, loop: null, rest: false });
            b.wx = b.vx; b.wz = b.vz;
        }
        return ev;
    }
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    if (b.rest && !c.dynamic && !others && !c.fans.length && !c.magnets.length && !c.mines.length) return ev;
    // Small enough steps that a ball can't pass through a rail, nor the rim.
    const n = Math.max(1, Math.ceil(sp * dt / (R * 0.4)), Math.ceil(dt / (1 / 120)));
    const d = dt / n;
    for (let i = 0; i < n; i++) {
        const tt = t + i * d;
        c._t = tt;
        _sub(c, b, d, tt, c.movers.length ? moverWalls(c, tt) : null, others, ev);
        if (b.sunk || b.pipe || b.loop || ev.some(e => e.type === 'water' || e.type === 'out')) break;
    }
    c._t = t;
    return ev;
}

function _fields(c, b, d) {
    for (const f of c.fans) {
        const [x0, z0, x1, z1] = f.r;
        if (b.x >= Math.min(x0, x1) && b.x <= Math.max(x0, x1) && b.z >= Math.min(z0, z1) && b.z <= Math.max(z0, z1)) {
            b.vx += f.f[0] * d; b.vz += f.f[1] * d; b.rest = false;
        }
    }
    for (const m of c.magnets) {
        const dx = m.x - b.x, dz = m.z - b.z, dd = Math.hypot(dx, dz);
        if (dd < m.r && dd > 0.05) {
            const k = m.k * (1 - dd / m.r) + m.k * 0.15;
            b.vx += dx / dd * k * d; b.vz += dz / dd * k * d; b.rest = false;
        }
    }
}

function _sub(c, b, d, t, movers, others, ev) {
    b._d = d;
    const cupD = Math.hypot(b.x - c.cup.x, b.z - c.cup.z);
    if (c.fans.length || c.magnets.length) _fields(c, b, d);
    if (b.air) {
        const y0 = b.y;
        b.vy -= c.G * d;
        b.x += b.vx * d; b.y += b.vy * d; b.z += b.vz * d;
        const over = Math.hypot(b.x - c.cup.x, b.z - c.cup.z) < CUP_R;
        if (over && b.y < c.cup.y + 0.02) {
            // In the cup: the bottom, the wall and the rim.
            b.inCup = true;
            if (b.y <= c.cup.y - CUP_DEPTH) { b.y = c.cup.y - CUP_DEPTH; b.vy = Math.abs(b.vy) * 0.2; b.vx *= 0.5; b.vz *= 0.5; }
        } else {
            // A floor just above a falling ball (it slipped under an edge by a hair) still catches it.
            let f = floorAt(c, b.x, b.z, y0, 0.02);
            if (!f && b.vy < 0) { const g = floorAt(c, b.x, b.z, y0, 0.15); if (g && g.h - b.y < 0.15) f = g; }
            if (f && b.y <= f.h) {
                if (HAZARD[f.kind]) { ev.push({ type: 'water', kind: f.kind }); return; }
                _land(c, b, f, ev);
            }
        }
        if (b.y < FLOOR_OUT) { ev.push({ type: 'out' }); return; }
    } else if (!b.rest || c.dynamic) {
        if (cupD < CUP_R) {
            // Off the edge of the cup: the floor isn't there.
            b.air = true; b.inCup = true;
        } else {
            const f = floorAt(c, b.x, b.z, b.y + 0.001);
            if (!f) { b.air = true; b.rest = false; return; }
            if (HAZARD[f.kind]) { ev.push({ type: 'water', kind: f.kind }); return; }
            const S = SURFACE[f.kind] || SURFACE.turf;
            if (f.kind !== b.kind) {
                if (S.splash && !b.rest) ev.push({ type: 'splash', kind: f.kind });
                if (S.grab && !b.rest && Math.hypot(b.vx, b.vz) > 1) ev.push({ type: 'spray' });
                b.kind = f.kind;
            }
            // Jelly: the pad throws the ball up.
            if (f.kind === 'jelly' && !b.jelly && Math.hypot(b.vx, b.vz) > 0.8) {
                b.jelly = true; b.air = true; b.rest = false; b.vy = JELLY_V + Math.hypot(b.vx, b.vz) * 0.15;
                ev.push({ type: 'jelly' });
                return;
            }
            if (f.kind !== 'jelly') b.jelly = false;
            if (b.rest && !f.sv && !f.awake) { _collide(c, b, movers, others, ev); return; }
            const svx = f.sv ? f.sv[0] : 0, svz = f.sv ? f.sv[1] : 0;
            if (b.wx == null) { b.wx = b.vx; b.wz = b.vz; }
            // The skid: friction at the contact pulls the speed down and the spin
            // up until the surface stops sliding (5:2, a solid ball), then it rolls.
            const slx = (b.vx - svx) - (b.wx - svx), slz = (b.vz - svz) - (b.wz - svz), sl = Math.hypot(slx, slz);
            const skid = sl > 0.05;
            if (skid) {
                const mu = (S.mu ?? 0.45) * c.G, dv = mu * d;
                if (dv * 3.5 >= sl) {
                    // Caught up this step: both meet at the rolling speed.
                    const rx = ((b.vx - svx) * 5 + (b.wx - svx) * 2) / 7, rz = ((b.vz - svz) * 5 + (b.wz - svz) * 2) / 7;
                    b.vx = svx + rx; b.vz = svz + rz; b.wx = b.vx; b.wz = b.vz;
                } else {
                    const ux = slx / sl, uz = slz / sl;
                    b.vx -= ux * dv; b.vz -= uz * dv;
                    b.wx += ux * dv * 2.5; b.wz += uz * dv * 2.5;
                }
            }
            // Down the slope: exact for a ball held to a height field. A skidding
            // ball feels all of it; a rolling one 5/7 (the rest spins it).
            const g2 = f.gx * f.gx + f.gz * f.gz;
            const gk = skid ? c.G : c.RG;
            let ax = -gk * f.gx / (1 + g2), az = -gk * f.gz / (1 + g2);
            if (f.kind === 'boost' && f.tile.boost) { ax += f.tile.boost[0]; az += f.tile.boost[1]; }
            b.vx += ax * d; b.vz += az * d;
            if (!skid) { b.wx += ax * d; b.wz += az * d; }
            // A moving floor drags the ball toward its own speed.
            if (f.sv) {
                const k = Math.min(1, (S.drag || 5) * d);
                b.vx += (svx - b.vx) * k; b.vz += (svz - b.vz) * k;
                b.wx += (svx - b.wx) * k; b.wz += (svz - b.wz) * k;
                b.rest = false;
            }
            // Rolling resistance, against the roll over the floor.
            const rx = b.vx - svx, rz = b.vz - svz, hs = Math.hypot(rx, rz);
            if (hs > 0) {
                const dec = (C0 + C1 * hs) * S.roll * d;
                const k = Math.max(0, hs - dec) / hs; b.vx = svx + rx * k; b.vz = svz + rz * k;
                if (!skid) { b.wx = b.vx; b.wz = b.vz; }
            }
            const vyOld = b.vx * f.gx + b.vz * f.gz;
            const nx = b.x + b.vx * d, nz = b.z + b.vz * d;
            const yPred = b.y + vyOld * d;
            const nd = Math.hypot(nx - c.cup.x, nz - c.cup.z);
            const g3 = nd < CUP_R ? null : floorAt(c, nx, nz, b.y + 0.001 + Math.max(0, vyOld * d));
            if (nd < CUP_R) {
                b.x = nx; b.z = nz; b.vy = vyOld; b.air = true; b.inCup = true;
            } else if (!g3 || g3.h < yPred - 0.03) {
                // Off an edge, or off the end of a ramp: into the air.
                b.x = nx; b.z = nz; b.y = yPred; b.vy = vyOld; b.air = true;
                ev.push({ type: 'launch', v: Math.hypot(b.vx, b.vz) });
            } else {
                const vyNew = b.vx * g3.gx + b.vz * g3.gz;
                const hs2 = Math.hypot(b.vx, b.vz);
                // Over a crest faster than gravity can hold it down: airborne.
                if ((vyNew - vyOld) / d < -c.G * 1.15 && hs2 > 2) {
                    b.x = nx; b.z = nz; b.y = Math.max(g3.h, yPred); b.vy = vyOld; b.air = true;
                } else {
                    // A floor that rises faster than a slope can (a step, a lip): it stops the roll.
                    if (g3.h - b.y > 0.06 + Math.abs(vyOld * d) * 2 && g3.tile !== f.tile) {
                        b.vx *= -0.3; b.vz *= -0.3;
                    } else { b.x = nx; b.z = nz; b.y = g3.h; b.vy = vyNew; }
                }
            }
        }
    }
    _collide(c, b, movers, others, ev);
    if (b.inCup) _cup(c, b, ev);
    if (b.sunk) return;
    // Mines: on the floor, armed always; a ball over one goes up and away.
    if (!b.air && c.mines.length) for (const m of c.mines) {
        const dx = b.x - m.x, dz = b.z - m.z, dd = Math.hypot(dx, dz);
        if (dd >= m.r) continue;
        const sp = Math.hypot(b.vx, b.vz);
        const ux = dd > 0.02 ? dx / dd : (sp > 0.01 ? b.vx / sp : 1), uz = dd > 0.02 ? dz / dd : (sp > 0.01 ? b.vz / sp : 0);
        const P = MINE_V * m.p;
        b.vx = b.vx * 0.3 + ux * P * 0.55; b.vz = b.vz * 0.3 + uz * P * 0.55; b.vy = P * 0.8;
        b.wx = b.vx * 0.2; b.wz = b.vz * 0.2;
        b.air = true; b.rest = false;
        ev.push({ type: 'boom', at: [m.x, m.z] });
        return;
    }
    if (b.rest) return;
    // Pipes and loops: a mouth on the floor.
    if (!b.air) {
        for (const p of c.pipes) {
            if (Math.hypot(b.x - p.a[0], b.z - p.a[1]) < p.r) {
                b.pipe = { p, t: p.delay ?? 0.6, dur: p.delay ?? 0.6, v: p.out ?? Math.max(3, Math.hypot(b.vx, b.vz) * (p.keep ?? 0.9)), from: [b.x, b.y, b.z] };
                ev.push({ type: 'pipe', p }); return;
            }
        }
        for (const l of c.loops) {
            const n = Math.hypot(l.dir[0], l.dir[1]) || 1, ux = l.dir[0] / n, uz = l.dir[1] / n;
            const rx = b.x - l.a[0], rz = b.z - l.a[1];
            const along = rx * ux + rz * uz, across = -rx * uz + rz * ux;
            if (along > 0 && along < 0.3 && Math.abs(across) < (l.w || 0.6)) {
                const vin = b.vx * ux + b.vz * uz;
                if (vin <= 0) continue;
                if (Math.hypot(b.vx, b.vz) >= l.minV) {
                    b.loop = { l, t: 0, dur: l.dur || (l.style === 'corkscrew' ? 1.6 : 1.1), v: l.outV ?? Math.hypot(b.vx, b.vz) * 0.8 };
                    ev.push({ type: 'loop' }); return;
                }
                b.vx -= vin * ux * 1.6; b.vz -= vin * uz * 1.6;
                b.x -= ux * (along + 0.05); b.z -= uz * (along + 0.05);
                ev.push({ type: 'loopfail' });
            }
        }
    }
    // At rest?
    if (!b.air) {
        const f = floorAt(c, b.x, b.z, b.y + 0.001);
        const svx = f?.sv ? f.sv[0] : 0, svz = f?.sv ? f.sv[1] : 0;
        const v = Math.hypot(b.vx - svx, b.vz - svz);
        const S = SURFACE[f?.kind] || SURFACE.turf;
        const pull = f ? c.RG * Math.hypot(f.gx, f.gz) : 0;
        const hold = C0 * S.roll;
        // Pinned against a rail by a moving floor counts as stopped too.
        const pinned = b.touch && Math.hypot(b.vx, b.vz) < 0.25 && f?.sv;
        if ((v < STOP_V && (pull < hold || b.touch) && f?.kind !== 'boost') || pinned) {
            if (pinned) { b.vx = 0; b.vz = 0; } else { b.vx = svx; b.vz = svz; }
            b.wx = b.vx; b.wz = b.vz;
            b.vy = 0;
            b.rest = true;
        }
    }
}

/** Landing: a bounce off the floor's own slope, by what it's made of. */
function _land(c, b, f, ev) {
    const S = SURFACE[f.kind] || SURFACE.turf;
    let nx = -f.gx, ny = 1, nz = -f.gz;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const vn = b.vx * nx + b.vy * ny + b.vz * nz;
    b.y = f.h;
    const e = f.kind === 'jelly' ? 0.88 : S.bounce;
    if (-vn > 2.2 && e > 0.05) {
        b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
        b.vx *= 0.92; b.vz *= 0.92;
        ev.push({ type: 'land', v: -vn, kind: f.kind });
        if (f.kind === 'jelly') ev.push({ type: 'jelly' });
    } else {
        // Settle: lose the speed into the floor, keep the speed along it.
        b.vx -= vn * nx; b.vz -= vn * nz;
        if (S.grab) { b.vx *= 0.45; b.vz *= 0.45; ev.push({ type: 'spray' }); }
        if (S.splash) { b.vx *= 0.6; b.vz *= 0.6; ev.push({ type: 'splash', kind: f.kind }); }
        b.air = false; b.vy = 0; b.kind = f.kind;
        if (-vn > 1) ev.push({ type: 'land', v: -vn, kind: f.kind });
    }
}

/** The cup: a hole with a rim, a wall and a bottom. In once it's below the rim. */
function _cup(c, b, ev) {
    const dx = b.x - c.cup.x, dz = b.z - c.cup.z, dc = Math.hypot(dx, dz);
    const cy = b.y + R;                                   // the ball's centre
    if (dc >= CUP_R + R) { b.inCup = false; return; }
    const ux = dc > 1e-6 ? dx / dc : 1, uz = dc > 1e-6 ? dz / dc : 0;
    if (dc < CUP_R) {
        // The rim: the circle at floor height round the hole. Contact from inside.
        const qx = c.cup.x + ux * CUP_R, qz = c.cup.z + uz * CUP_R, qy = c.cup.y;
        let nx = b.x - qx, ny = cy - qy, nz = b.z - qz;
        const nd = Math.hypot(nx, ny, nz);
        if (nd < R && nd > 1e-6) {
            nx /= nd; ny /= nd; nz /= nd;
            b.x = qx + nx * R; b.z = qz + nz * R; b.y = qy + ny * R - R;
            const vn = b.vx * nx + b.vy * ny + b.vz * nz;
            if (vn < 0) {
                b.vx -= 1.25 * vn * nx; b.vy -= 1.25 * vn * ny; b.vz -= 1.25 * vn * nz;
                if (-vn > 0.8) ev.push({ type: 'rim', v: -vn });
            }
            // Rolling round the lip scrubs speed off: it circles, and drops (or spins out).
            const k = Math.max(0, 1 - 4.5 * (b._d || 1 / 120));
            b.vx *= k; b.vz *= k;
        }
        // The wall inside the cup.
        if (cy < c.cup.y && dc > CUP_R - R) {
            b.x = c.cup.x + ux * (CUP_R - R); b.z = c.cup.z + uz * (CUP_R - R);
            const vr = b.vx * ux + b.vz * uz;
            if (vr > 0) { b.vx -= 1.3 * vr * ux; b.vz -= 1.3 * vr * uz; if (vr > 0.6) ev.push({ type: 'rim', v: vr }); }
        }
        b.air = true; b.rest = false;
        if (cy < c.cup.y - R * 0.9) { _sink(c, b); ev.push({ type: 'cup' }); }
    } else {
        // Outside the hole but overhanging it: back on the floor, and a lip-out if it flew out fast.
        if (b.air && b.y <= c.cup.y + 0.02) {
            b.y = c.cup.y; b.air = false; b.inCup = false;
            if (Math.hypot(b.vx, b.vz) > 1.2) ev.push({ type: 'lip', v: Math.hypot(b.vx, b.vz) });
            b.vy = 0;
        }
    }
}

function _sink(c, b) {
    b.sunk = true; b.rest = true; b.air = false; b.inCup = false;
    b.vx = b.vy = b.vz = 0; b.x = c.cup.x; b.z = c.cup.z; b.y = c.cup.y;
}

function _collide(c, b, movers, others, ev) {
    b.touch = false;
    const walls = movers ? c.walls.concat(movers) : c.walls;
    const cy = b.y + R;
    for (let k = 0; k < walls.length; k++) {
        const w = walls[k];
        const ex = w.x2 - w.x1, ez = w.z2 - w.z1, L2 = ex * ex + ez * ez;
        if (L2 < 1e-9) continue;
        const u = Math.max(0, Math.min(1, ((b.x - w.x1) * ex + (b.z - w.z1) * ez) / L2));
        const px = w.x1 + ex * u, pz = w.z1 + ez * u;
        let nx = b.x - px, nz = b.z - pz;
        const dist = Math.hypot(nx, nz), rr = R + (w.thick || 0);
        if (dist >= rr) continue;
        const base = w.b1 + (w.b2 - w.b1) * u;
        if (cy > base + w.h + R * 0.4 || cy < base - 0.6) continue;
        if (dist < 1e-6) { nx = -ez; nz = ex; const l = Math.hypot(nx, nz); nx /= l; nz /= l; } else { nx /= dist; nz /= dist; }
        b.x = px + nx * rr; b.z = pz + nz * rr;
        b.touch = true;
        let wvx = w.vx || 0, wvz = w.vz || 0;
        if (w.spin) { wvx = -w.spin * (pz - w.cz); wvz = w.spin * (px - w.cx); }
        const M = MATERIAL[w.mat] || MATERIAL.wood;
        const rvx = b.vx - wvx, rvz = b.vz - wvz;
        const vn = rvx * nx + rvz * nz;
        if (vn < 0) {
            const e = w.mover ? Math.max(M.e, 0.85) : M.e;
            // A glancing hit scrubs a little speed along the rail; a square hit bounces.
            const tx = -nz, tz = nx, vt = rvx * tx + rvz * tz;
            const scrub = M.scrub * Math.min(1, -vn / (Math.abs(vt) + 1e-3));
            b.vx = wvx + (vt * (1 - scrub)) * tx - e * vn * nx;
            b.vz = wvz + (vt * (1 - scrub)) * tz - e * vn * nz;
            b.rest = false;
            if (-vn > 0.6) ev.push({ type: 'wall', v: -vn, mat: w.mat, mover: !!w.mover, at: [px, base + w.h * 0.5, pz] });
        } else if (w.mover && (wvx || wvz)) {
            // A mover leaning on a ball at rest shoves it along.
            const push = wvx * nx + wvz * nz;
            if (push > 0) { b.vx += push * nx; b.vz += push * nz; b.rest = false; }
        }
    }
    for (const p of c.bumpers) {
        let nx = b.x - p.x, nz = b.z - p.z; const dist = Math.hypot(nx, nz);
        if (dist >= p.r + R || dist < 1e-6 || cy > p.y + 0.75) continue;
        nx /= dist; nz /= dist;
        b.x = p.x + nx * (p.r + R); b.z = p.z + nz * (p.r + R);
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) {
            b.vx -= (1 + p.e) * vn * nx; b.vz -= (1 + p.e) * vn * nz;
            b.vx += nx * p.kick; b.vz += nz * p.kick;
            b.rest = false;
            ev.push({ type: 'bumper', at: p, v: -vn });
        }
    }
    if (c.movers.length) for (const h of hammerHeads(c, c._t)) {
        let nx = b.x - h.x, nz = b.z - h.z; const dist = Math.hypot(nx, nz);
        if (dist >= h.r + R || dist < 1e-6 || cy > h.y + 0.9) continue;
        nx /= dist; nz /= dist;
        b.x = h.x + nx * (h.r + R); b.z = h.z + nz * (h.r + R);
        const vn = (b.vx - h.vx) * nx + (b.vz - h.vz) * nz;
        if (vn < 0) {
            b.vx -= 1.8 * vn * nx; b.vz -= 1.8 * vn * nz;
            b.rest = false;
            ev.push({ type: 'hammer', at: h, v: -vn });
        }
    }
    if (others) for (const o of others) {
        if (o === b || o.sunk || o.pipe || o.loop || o.gone) continue;
        const dx = o.x - b.x, dz = o.z - b.z, dd = Math.hypot(dx, dz);
        if (dd >= 2 * R || dd < 1e-6 || Math.abs(o.y - b.y) > R * 1.5) continue;
        const nx = dx / dd, nz = dz / dd, over = 2 * R - dd;
        b.x -= nx * over / 2; b.z -= nz * over / 2; o.x += nx * over / 2; o.z += nz * over / 2;
        const rel = (b.vx - o.vx) * nx + (b.vz - o.vz) * nz;
        if (rel > 0) {
            const j = rel * 0.95;
            b.vx -= j * nx; b.vz -= j * nz; o.vx += j * nx; o.vz += j * nz;
            o.rest = false; b.rest = false;
            ev.push({ type: 'ball', other: o, v: rel });
        }
    }
}

// ── Looking ahead ────────────────────────────────────────────────────────────

/**
 * Play a shot out without touching the real ball. Returns where it stopped
 * and what happened: { x, y, z, result: 'rest'|'cup'|'water'|'out'|'time'|'cut'|'pipe',
 * pts (every `every` s), bounces, t }.
 */
export function simulate(c, from, dx, dz, power, t0 = 0, opts = {}) {
    const b = { ...newBall(from.x, from.z, from.y), sunk: false };
    if (power > 0) strike(b, dx, dz, power);
    const dt = opts.dt || 1 / 60, maxT = opts.maxT ?? 8, every = opts.every ?? 0;
    const pts = every ? [[b.x, b.y, b.z]] : null;
    let t = 0, travelled = 0, bounces = 0, result = 'time', since = 0, px = b.x, pz = b.z;
    const ev = [];
    while (t < maxT) {
        ev.length = 0;
        step(c, b, dt, t0 + t, null, ev);
        t += dt; since += dt;
        travelled += Math.hypot(b.x - px, b.z - pz); px = b.x; pz = b.z;
        for (const e of ev) {
            if (e.type === 'wall' || e.type === 'bumper' || e.type === 'hammer') bounces++;
            if (e.type === 'cup') result = 'cup';
            if (e.type === 'water') result = 'water';
            if (e.type === 'out') result = 'out';
        }
        if (pts && since >= every) { since = 0; pts.push([b.x, b.y, b.z]); }
        if (result !== 'time') break;
        if (b.pipe || b.loop) { if (pts) pts.push([b.x, b.y, b.z]); if (opts.stopAtPipe) { result = 'pipe'; break; } }
        if (b.rest && !b.pipe && !b.loop && t >= (opts.minT || 0)) {
            // Resting on a moving floor still moves: call it rest anyway, it's the player's turn.
            result = 'rest'; break;
        }
        if (opts.stopAfter && travelled >= opts.stopAfter) { result = 'cut'; break; }
        if (opts.bounces != null && bounces > opts.bounces) { result = 'cut'; break; }
    }
    if (pts) pts.push([b.x, b.y, b.z]);
    c._t = t0;
    return { x: b.x, y: b.y, z: b.z, result, pts, bounces, t, travelled };
}

/**
 * How far is (x, z) from the cup, the way a ball would have to go: a flood
 * fill out from the cup over a grid on the floor, round the rails, through the
 * pipes, and across a hazard only at a price. Built once per hole, on first use.
 * Bots score shots with it and turns use it to find who's away.
 */
export function pathLeft(c, x, z) {
    const F = c._field || (c._field = _buildField(c));
    const gi = Math.round((x - F.x0) / F.s), gj = Math.round((z - F.z0) / F.s);
    let best = Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = gi + di, j = gj + dj;
        if (i < 0 || j < 0 || i >= F.w || j >= F.h) continue;
        const d = F.d[j * F.w + i];
        if (d === Infinity) continue;
        const cx = F.x0 + i * F.s, cz = F.z0 + j * F.s;
        const v = d + Math.hypot(x - cx, z - cz);
        // Not a cell on the far side of a wall.
        if (v < best && !c.walls.some(wl => _segX(x, z, cx, cz, wl.x1, wl.z1, wl.x2, wl.z2))) best = v;
    }
    return best === Infinity ? Math.hypot(x - c.cup.x, z - c.cup.z) + 30 : best;
}

const _segX = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
    const d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
};

function _buildField(c) {
    // The grid sits off the round numbers walls are drawn on, so no cell lies on a wall.
    const s = 0.3, B = c.bounds;
    const x0 = B.x0 + 0.137, z0 = B.z0 + 0.113, w = Math.ceil((B.x1 - B.x0) / s) + 1, h = Math.ceil((B.z1 - B.z0) / s) + 1;
    const N = w * h, floor = new Array(N), d = new Float64Array(N).fill(Infinity);
    // Floors at their resting places: rafts where they start, drawbridges down.
    const saved = c._t; c._t = 0;
    const liftDown = c.tiles.filter(t => t.lift).map(t => { const l = t.lift; t.lift = null; return [t, l]; });
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) floor[j * w + i] = floorAt(c, x0 + i * s, z0 + j * s, 99, 0, 0);
    liftDown.forEach(([t, l]) => { t.lift = l; });
    c._t = saved;
    const blocked = (ax, az, bx, bz) => {
        for (const wl of c.walls) {
            // Walls a touch longer than they are, so a wall that ends on a rail seals.
            const ex = wl.x2 - wl.x1, ez = wl.z2 - wl.z1, L = Math.hypot(ex, ez) || 1, k = 0.12 / L;
            if (_segX(ax, az, bx, bz, wl.x1 - ex * k, wl.z1 - ez * k, wl.x2 + ex * k, wl.z2 + ez * k)) return true;
        }
        for (const p of c.bumpers) if (p.r > 0.25 && Math.hypot((ax + bx) / 2 - p.x, (az + bz) / 2 - p.z) < p.r) return true;
        return false;
    };
    const links = [];
    const cellOf = (x, z) => Math.max(0, Math.min(h - 1, Math.round((z - z0) / s))) * w + Math.max(0, Math.min(w - 1, Math.round((x - x0) / s)));
    c.pipes.forEach(p => links.push([cellOf(p.b[0], p.b[1]), cellOf(p.a[0], p.a[1]), 0.5]));
    c.loops.forEach(l => { const n = Math.hypot(l.dir[0], l.dir[1]) || 1; links.push([cellOf(l.a[0] + l.dir[0] / n * l.len, l.a[1] + l.dir[1] / n * l.len), cellOf(l.a[0], l.a[1]), l.len]); });
    (c.hole.links || []).forEach(([ax, az, bx, bz]) => links.push([cellOf(bx, bz), cellOf(ax, az), Math.hypot(bx - ax, bz - az)]));
    const heap = [];
    const push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const start = cellOf(c.cup.x, c.cup.z);
    d[start] = 0; push(start, 0);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (heap.length) {
        const [dv, k] = pop();
        if (dv > d[k]) continue;
        const i = k % w, j = (k - i) / w, f = floor[k];
        const ax = x0 + i * s, az = z0 + j * s;
        for (const [di, dj] of nb) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
            const nk = nj * w + ni, g = floor[nk];
            if (!g || !f) continue;
            // Searching backwards (from the cup): the ball goes g → f. It can drop
            // any distance but climb only a little — unless one is a hazard, or a jelly pad.
            const haz = HAZARD[g.kind] || HAZARD[f.kind] || g.kind === 'jelly';
            if (!haz && f.h - g.h > STEP_UP + Math.hypot(f.gx, f.gz) * s * 1.5) continue;
            const bx = x0 + ni * s, bz = z0 + nj * s;
            if (blocked(ax, az, bx, bz)) continue;
            const cost = Math.hypot(di, dj) * s * (HAZARD[g.kind] ? 6 : g.kind === 'sand' ? 1.6 : g.kind === 'puddle' ? 1.4 : 1);
            if (dv + cost < d[nk]) { d[nk] = dv + cost; push(nk, d[nk]); }
        }
        for (const [to, from, cost] of links) if (to === k && dv + cost < d[from]) { d[from] = dv + cost; push(from, d[from]); }
    }
    return { x0, z0, s, w, h, d };
}
