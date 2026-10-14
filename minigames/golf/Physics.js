// ============================================================
// GOLF PHYSICS — a ball on a mini golf course, no THREE, no cannon.
//
// Deterministic and cheap, so the very same code draws the bounce preview and
// lets a bot try shots ahead. The course is a 2.5D world:
//
//   tiles   axis-aligned rectangles of floor, each a plane (height y at its
//           centre, gradient slope [gx, gz]) with optional smooth hills
//           [[x, z, r, h]] on top. Kinds: turf, sand, ice, water, boost.
//           A ball rolls on the highest tile under it that it can reach.
//   walls   vertical segments with a base that follows the floor and a height:
//           the rail round every tile edge that isn't open, plus the hole's
//           own. A ball in the air above one goes over it.
//   bumpers posts that kick the ball away harder than it came.
//   movers  walls that move with time: windmill sails, sweeping bars, sliders.
//   pipes   a mouth that swallows the ball and spits it out somewhere else.
//   cup     a hole in the floor that takes a slow ball and lips out a fast one.
//
// Coordinates: x, z across the floor, y up, in course units (a ball is 0.14).
// ============================================================

export const R = 0.14;                 // ball radius
export const CUP_R = 0.3;              // cup radius
export const MAXV = 13;                // a full pull
const G = 16;                          // gravity
const ROLL_G = G * 5 / 7;              // a rolling ball feels 5/7 of the slope
const C0 = 1.15, C1 = 0.24;            // rolling resistance: constant + per unit speed
const KIND = {                         // multiplier on rolling resistance
    turf: 1, sand: 4.2, ice: 0.18, boost: 1, carpet: 1.4, wood: 0.9, rough: 2.2,
};
/** Floors that cost a stroke and send the ball back: water, lava, the flower bed, space. */
export const HAZARD = { water: 1, lava: 1, flowers: 1, void: 1, goo: 1 };
const STEP_UP = 0.1;                   // the most the floor can rise under a rolling ball
const RAIL_H = 0.3, RAIL_E = 0.68;     // rails: height, bounciness
const BUMP_E = 1.25, BUMP_KICK = 2.5;  // bumpers
const STOP_V = 0.06;
const SINK_V = 3.0;                    // over the cup slower than this, it drops
const LIP_V = 4.6;                     // up to this, a ball across the lip can still fall in
const FLOOR_OUT = -6;                  // below this, the ball is lost

// ── The course ───────────────────────────────────────────────────────────────

/**
 * Compile a hole's data into what the physics reads. Pure: the same hole
 * always compiles the same.
 *   hole.tiles  [{ r: [x0, z0, x1, z1], y, slope: [gx, gz], hills, kind, open, boost }]
 *               open: the edges with no rail — any of 'n' (−z), 's' (+z), 'w' (−x), 'e' (+x)
 *   hole.walls  [[x1, z1, x2, z2, h?]]  extra rails, standing on the floor
 *   hole.blocks [[x0, z0, x1, z1, h?]]  solid boxes
 *   hole.bumpers [[x, z, r]]
 *   hole.movers [{ type: 'windmill'|'sweeper'|'slider', ... }]
 *   hole.pipes  [{ a: [x, z], b: [x, z], dir: [dx, dz], r?, delay?, keep?, out? }]  out: a fixed exit speed (a cannon)
 *   hole.gravity  a multiplier (low gravity on the space station)
 *   hole.loops  [{ a: [x, z], dir: [dx, dz], len, minV }]  a loop-the-loop: in at a, out len further on
 *   hole.cup [x, z], hole.tee [x, z]
 */
export function compile(hole) {
    const tiles = hole.tiles.map((t, i) => {
        const [x0, z0, x1, z1] = t.r;
        return {
            i, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1),
            cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, y: t.y || 0,
            gx: t.slope?.[0] || 0, gz: t.slope?.[1] || 0,
            hills: t.hills || [], kind: t.kind || 'turf', open: t.open || '', boost: t.boost || null,
            rail: t.rail ?? true,
        };
    });
    const g = hole.gravity || 1;
    const c = { hole, tiles, walls: [], bumpers: [], pipes: [], loops: [], movers: hole.movers || [], G: G * g, RG: ROLL_G * g };
    // Rails round every tile edge where the floor beyond is missing or out of
    // a rolling ball's reach (and the edge isn't marked open).
    tiles.forEach(t => {
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
                c.walls.push(_wall(c, p[0], p[1], q[0], q[1], RAIL_H, t, true));
                run = null;
            };
            for (let k = 0; k < n; k++) {
                const u = (k + 0.5) / n;
                const px = ax + (bx - ax) * u, pz = az + (bz - az) * u;
                const here = _tileH(t, px, pz);
                // Is there floor just outside, at a height a ball could roll on to?
                const ox = px + nx * 0.05, oz = pz + nz * 0.05;
                const next = tiles.find(o => o !== t && _inTile(o, ox, oz) && Math.abs(_tileH(o, ox, oz) - here) <= STEP_UP);
                const needs = !next;
                if (needs && run === null) run = k / n;
                if (!needs && run !== null) flush(k / n);
            }
            flush(1);
        }
    });
    (hole.walls || []).forEach(([x1, z1, x2, z2, h]) => c.walls.push(_wall(c, x1, z1, x2, z2, h ?? RAIL_H, null, false)));
    (hole.blocks || []).forEach(([x0, z0, x1, z1, h]) => {
        const hh = h ?? 0.5;
        [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]].forEach(([a, b, p, q]) => c.walls.push(_wall(c, a, b, p, q, hh, null, false, true)));
    });
    (hole.bumpers || []).forEach(([x, z, r]) => c.bumpers.push({ x, z, r, y: floorAt(c, x, z, 9)?.h ?? 0 }));
    (hole.pipes || []).forEach(p => c.pipes.push({ ...p, r: p.r || 0.32 }));
    (hole.loops || []).forEach(l => c.loops.push({ ...l, minV: l.minV || 6.5 }));
    const cupF = floorAt(c, hole.cup[0], hole.cup[1], 9);
    c.cup = { x: hole.cup[0], z: hole.cup[1], y: cupF ? cupF.h : 0 };
    const teeF = floorAt(c, hole.tee[0], hole.tee[1], 9);
    c.tee = { x: hole.tee[0], z: hole.tee[1], y: teeF ? teeF.h : 0 };
    // Bounds, for cameras.
    c.bounds = tiles.reduce((b, t) => ({ x0: Math.min(b.x0, t.x0), z0: Math.min(b.z0, t.z0), x1: Math.max(b.x1, t.x1), z1: Math.max(b.z1, t.z1) }),
        { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
    // The way round, for bots and cameras: tee, the hole's waypoints, cup.
    c.path = [[hole.tee[0], hole.tee[1]], ...(hole.path || []), [hole.cup[0], hole.cup[1]]];
    return c;
}

function _wall(c, x1, z1, x2, z2, h, tile, rail, block = false) {
    const b1 = tile ? _tileH(tile, x1, z1) : (floorAt(c, x1, z1, 9)?.h ?? 0);
    const b2 = tile ? _tileH(tile, x2, z2) : (floorAt(c, x2, z2, 9)?.h ?? 0);
    return { x1, z1, x2, z2, b1, b2, h, rail, block };
}

const _inTile = (t, x, z) => x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1;

/** The height of a tile's floor at (x, z), hills and all. */
export const tileHeight = (t, x, z) => _tileH(t, x, z);
function _tileH(t, x, z) {
    let h = t.y + t.gx * (x - t.cx) + t.gz * (z - t.cz);
    for (const [hx, hz, r, hh] of t.hills) {
        const d = Math.hypot(x - hx, z - hz);
        if (d < r) { const k = Math.cos(d / r * Math.PI / 2); h += hh * k * k; }
    }
    return h;
}
function _tileGrad(t, x, z) {
    let gx = t.gx, gz = t.gz;
    for (const [hx, hz, r, hh] of t.hills) {
        const dx = x - hx, dz = z - hz, d = Math.hypot(dx, dz);
        if (d < r && d > 1e-6) {
            // d/dd of hh·cos²(πd/2r) = −hh·(π/2r)·sin(πd/r)
            const s = -hh * (Math.PI / (2 * r)) * Math.sin(Math.PI * d / r);
            gx += s * dx / d; gz += s * dz / d;
        }
    }
    return [gx, gz];
}

/**
 * The floor under (x, z) that a ball at height y stands on: the highest tile
 * whose floor there is no higher than y + reach. Null over a gap.
 */
export function floorAt(c, x, z, y, reach = STEP_UP) {
    let best = null, bh = -Infinity;
    for (const t of c.tiles) {
        if (!_inTile(t, x, z)) continue;
        const h = _tileH(t, x, z);
        if (h <= y + reach && h > bh) { bh = h; best = t; }
    }
    if (!best) return null;
    const [gx, gz] = _tileGrad(best, x, z);
    return { h: bh, gx, gz, kind: best.kind, tile: best };
}

// ── Moving things ────────────────────────────────────────────────────────────

/**
 * The movers' walls at time t, each with the velocity of its middle so a hit
 * can pass speed on. Pure in t: the bot and the preview see where they'll be.
 *   windmill { x, z, axis: 'x'|'z', w: half-width of the door, speed }
 *            the door is shut while a sail is down in front of it
 *   sweeper  { x, z, len, speed }  a bar spinning flat round (x, z)
 *   slider   { x, z, len, axis, amp, speed }  a bar sliding to and fro along axis
 */
export function moverWalls(c, t) {
    const out = [];
    for (const m of c.movers) {
        const base = floorAt(c, m.x, m.z, 9)?.h ?? 0;
        if (m.type === 'windmill') {
            if (windmillShut(m, t)) {
                const w = m.w || 0.55;
                if (m.axis === 'z') out.push({ x1: m.x, z1: m.z - w, x2: m.x, z2: m.z + w, b1: base, b2: base, h: 0.4, vx: 0, vz: 0, mover: m });
                else out.push({ x1: m.x - w, z1: m.z, x2: m.x + w, z2: m.z, b1: base, b2: base, h: 0.4, vx: 0, vz: 0, mover: m });
            }
        } else if (m.type === 'sweeper') {
            const a = t * (m.speed || 1.2), L = m.len || 2;
            for (const s of [0, Math.PI]) {
                const ex = m.x + Math.cos(a + s) * L, ez = m.z + Math.sin(a + s) * L;
                out.push({ x1: m.x, z1: m.z, x2: ex, z2: ez, b1: base, b2: base, h: 0.35, spin: m.speed || 1.2, cx: m.x, cz: m.z, mover: m });
            }
        } else if (m.type === 'slider') {
            // A bar lying along `bar` ('x' or 'z'), sliding to and fro along `axis`.
            const L = m.len || 1.6, sp = m.speed || 1.4, A = m.amp || 1.5, ph = m.phase || 0;
            const o = A * Math.sin(t * sp + ph), v = A * sp * Math.cos(t * sp + ph);
            const bx = (m.bar || 'z') === 'x' ? 1 : 0, bz = 1 - bx;
            const mx = (m.axis || 'z') === 'x' ? 1 : 0, mz = 1 - mx;
            const cx = m.x + mx * o, cz = m.z + mz * o;
            out.push({ x1: cx - bx * L / 2, z1: cz - bz * L / 2, x2: cx + bx * L / 2, z2: cz + bz * L / 2, b1: base, b2: base, h: 0.4,
                       vx: mx * v, vz: mz * v, mover: m, thick: 0.15 });
        }
    }
    return out;
}
export const windmillAngle = (m, t) => t * (m.speed || 1.6);
export function windmillShut(m, t) {
    const a = windmillAngle(m, t);
    for (let k = 0; k < 4; k++) {
        let d = ((a + k * Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (Math.abs(d - Math.PI) < 0.32) return true;
    }
    return false;
}

// ── The ball ─────────────────────────────────────────────────────────────────

export function newBall(x, z, y = 0) {
    return { x, y, z, vx: 0, vy: 0, vz: 0, air: false, rest: true, kind: 'turf', spin: 0, pipe: null, loop: null, sunk: false };
}

/** Hit it: a direction on the floor and a power 0..1. */
export function strike(b, dx, dz, power) {
    const n = Math.hypot(dx, dz) || 1, v = Math.max(0, Math.min(1, power)) * MAXV;
    b.vx = dx / n * v; b.vz = dz / n * v; b.vy = 0; b.rest = false;
}

/**
 * Advance one ball by dt at course time t. Returns the events of the step, an
 * array (often empty) of { type, ... }:
 *   wall {v, rail}  bumper  cup  lip  water  out  land {v}  pipe  loop  loopfail
 * `others` are the other balls on the course, as obstacles (and they move).
 * The ball is left in a consistent state whatever happens; on 'cup', 'water'
 * and 'out' the caller decides what next.
 */
export function step(c, b, dt, t, others = null, ev = []) {
    if (b.sunk) return ev;
    if (b.pipe) {
        b.pipe.t -= dt;
        if (b.pipe.t <= 0) {
            const p = b.pipe.p, sp = b.pipe.v;
            const n = Math.hypot(p.dir[0], p.dir[1]) || 1;
            const f = floorAt(c, p.b[0], p.b[1], 9);
            Object.assign(b, { x: p.b[0], z: p.b[1], y: f ? f.h : 0, vx: p.dir[0] / n * sp, vz: p.dir[1] / n * sp, vy: 0, air: false, pipe: null, rest: false });
            ev.push({ type: 'pipeout' });
        }
        return ev;
    }
    if (b.loop) {
        b.loop.t += dt;
        if (b.loop.t >= b.loop.dur) {
            const l = b.loop.l, n = Math.hypot(l.dir[0], l.dir[1]) || 1;
            const ox = l.a[0] + l.dir[0] / n * l.len, oz = l.a[1] + l.dir[1] / n * l.len;
            const f = floorAt(c, ox, oz, 9);
            Object.assign(b, { x: ox, z: oz, y: f ? f.h : 0, vx: l.dir[0] / n * b.loop.v, vz: l.dir[1] / n * b.loop.v, vy: 0, air: false, loop: null, rest: false });
        }
        return ev;
    }
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const movers = c.movers.length ? moverWalls(c, t) : null;
    if (b.rest && !movers && !others) return ev;
    // Small enough steps that a ball can't pass through a rail.
    const n = Math.max(1, Math.ceil(sp * dt / (R * 0.45)), Math.ceil(dt / (1 / 120)));
    const d = dt / n;
    for (let i = 0; i < n; i++) {
        _sub(c, b, d, t + i * d, movers && i ? moverWalls(c, t + i * d) : movers, others, ev);
        if (b.sunk || b.pipe || b.loop || ev.some(e => e.type === 'water' || e.type === 'out')) break;
    }
    return ev;
}

function _sub(c, b, d, t, movers, others, ev) {
    if (!b.rest) {
        if (b.air) {
            const y0 = b.y;
            b.vy -= c.G * d;
            b.x += b.vx * d; b.y += b.vy * d; b.z += b.vz * d;
            // The floor it fell through this step, if any: one no higher than where it was.
            const f = floorAt(c, b.x, b.z, y0, 0.02);
            if (f && b.y <= f.h) {
                if (HAZARD[f.kind]) { ev.push({ type: 'water', kind: f.kind }); return; }
                const impact = -b.vy + (b.vx * f.gx + b.vz * f.gz);
                b.y = f.h;
                if (impact > 3) {
                    b.vy = impact * 0.32; b.vx *= 0.86; b.vz *= 0.86;
                    ev.push({ type: 'land', v: impact });
                } else {
                    b.air = false; b.vy = 0;
                    if (impact > 1) ev.push({ type: 'land', v: impact });
                }
            }
            if (b.y < FLOOR_OUT) { ev.push({ type: 'out' }); return; }
        } else {
            const f = floorAt(c, b.x, b.z, b.y + 0.001);
            if (!f) { b.air = true; return; }
            b.kind = f.kind;
            if (HAZARD[f.kind]) { ev.push({ type: 'water', kind: f.kind }); return; }
            // Gravity down the slope, rolling resistance against the roll.
            let ax = -c.RG * f.gx, az = -c.RG * f.gz;
            if (f.kind === 'boost' && f.tile.boost) { ax += f.tile.boost[0]; az += f.tile.boost[1]; }
            b.vx += ax * d; b.vz += az * d;
            const hs = Math.hypot(b.vx, b.vz);
            if (hs > 0) {
                const dec = (C0 + C1 * hs) * (KIND[f.kind] ?? 1) * d;
                const k = Math.max(0, hs - dec) / hs; b.vx *= k; b.vz *= k;
            }
            const vyOld = b.vx * f.gx + b.vz * f.gz;
            const nx = b.x + b.vx * d, nz = b.z + b.vz * d;
            const yPred = b.y + vyOld * d;
            const g2 = floorAt(c, nx, nz, b.y + 0.001 + Math.max(0, vyOld * d));
            if (!g2 || g2.h < yPred - 0.03) {
                // Off an edge, or off the end of a ramp: into the air.
                b.x = nx; b.z = nz; b.y = yPred; b.vy = vyOld; b.air = true;
                ev.push({ type: 'launch', v: Math.hypot(b.vx, b.vz) });
            } else {
                const vyNew = b.vx * g2.gx + b.vz * g2.gz;
                // Over a crest faster than gravity can hold it down: airborne.
                if ((vyNew - vyOld) / d < -c.G * 1.15 && hs > 2) {
                    b.x = nx; b.z = nz; b.y = Math.max(g2.h, yPred); b.vy = vyOld; b.air = true;
                } else { b.x = nx; b.z = nz; b.y = g2.h; b.vy = vyNew; }
            }
        }
    }
    _collide(c, b, movers, others, ev);
    if (b.rest) return;
    // The cup.
    if (Math.abs(b.y - c.cup.y) < R) {
        const dx = b.x - c.cup.x, dz = b.z - c.cup.z, dc = Math.hypot(dx, dz);
        if (dc < CUP_R) {
            const v = Math.hypot(b.vx, b.vz);
            if (dc < CUP_R - R * 0.4 && v < SINK_V) { _sink(c, b); ev.push({ type: 'cup' }); return; }
            if (v < LIP_V) {
                // On the lip: it falls toward the middle, and drops if it slows enough.
                const pull = 34 * (1 - dc / CUP_R) + 6;
                b.vx -= dx / (dc || 1) * pull * d; b.vz -= dz / (dc || 1) * pull * d;
                if (Math.hypot(b.vx, b.vz) < 1.4 || (dc < CUP_R * 0.45 && v < SINK_V * 1.15)) { _sink(c, b); ev.push({ type: 'cup' }); return; }
                if (!b.lipT) { b.lipT = 1; ev.push({ type: 'lip', v }); }
            } else if (!b.lipT && dc < CUP_R - R) {
                // Too fast: it hops the far side of the cup.
                b.lipT = 1; b.air = true; b.vy = Math.min(2.4, v * 0.2); b.vx *= 0.9; b.vz *= 0.9;
                ev.push({ type: 'lip', v, hop: true });
            }
        } else if (dc > CUP_R + R) b.lipT = 0;
    }
    // Pipes and loops: a mouth on the floor.
    for (const p of c.pipes) {
        if (Math.hypot(b.x - p.a[0], b.z - p.a[1]) < p.r && !b.air) {
            b.pipe = { p, t: p.delay ?? 0.6, v: p.out ?? Math.max(3, Math.hypot(b.vx, b.vz) * (p.keep ?? 0.9)) };
            ev.push({ type: 'pipe' }); return;
        }
    }
    for (const l of c.loops) {
        const n = Math.hypot(l.dir[0], l.dir[1]) || 1, ux = l.dir[0] / n, uz = l.dir[1] / n;
        const rx = b.x - l.a[0], rz = b.z - l.a[1];
        const along = rx * ux + rz * uz, across = -rx * uz + rz * ux;
        if (along > 0 && along < 0.3 && Math.abs(across) < (l.w || 0.6) && !b.air) {
            const vin = b.vx * ux + b.vz * uz;
            if (vin <= 0) continue;
            if (Math.hypot(b.vx, b.vz) >= l.minV) {
                b.loop = { l, t: 0, dur: l.dur || 1.0, v: Math.hypot(b.vx, b.vz) * 0.78 };
                ev.push({ type: 'loop' }); return;
            }
            // Not enough: up the side and back down again.
            b.vx -= vin * ux * 1.6; b.vz -= vin * uz * 1.6;
            b.x -= ux * (along + 0.05); b.z -= uz * (along + 0.05);
            ev.push({ type: 'loopfail' });
        }
    }
    // At rest?
    if (!b.air) {
        const v = Math.hypot(b.vx, b.vz);
        const f = floorAt(c, b.x, b.z, b.y + 0.001);
        const pull = f ? c.RG * Math.hypot(f.gx, f.gz) : 0;
        const hold = C0 * (KIND[f?.kind] ?? 1);
        if (v < STOP_V && (pull < hold || b.touch) && !(f?.kind === 'boost')) { b.vx = b.vz = b.vy = 0; b.rest = true; }
    }
}

function _sink(c, b) {
    b.sunk = true; b.rest = true; b.air = false;
    b.vx = b.vy = b.vz = 0; b.x = c.cup.x; b.z = c.cup.z; b.y = c.cup.y;
}

function _collide(c, b, movers, others, ev) {
    b.touch = false;
    const walls = movers ? c.walls.concat(movers) : c.walls;
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
        if (b.y > base + w.h + R * 0.3 || b.y < base - 0.6) continue;
        if (dist < 1e-6) { nx = -ez; nz = ex; } else { nx /= dist; nz /= dist; }
        b.x = px + nx * rr; b.z = pz + nz * rr;
        b.touch = true;
        // The wall's own velocity where it was hit (a sweeper's spin, a slider's slide).
        let wvx = w.vx || 0, wvz = w.vz || 0;
        if (w.spin) { wvx = -w.spin * (pz - w.cz); wvz = w.spin * (px - w.cx); }
        const rvx = b.vx - wvx, rvz = b.vz - wvz;
        const vn = rvx * nx + rvz * nz;
        if (vn < 0) {
            const e = w.mover ? 0.9 : RAIL_E;
            b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz;
            // A little speed lost along the rail too.
            const tx = -nz, tz = nx, vt = b.vx * tx + b.vz * tz;
            b.vx -= vt * 0.04 * tx; b.vz -= vt * 0.04 * tz;
            b.rest = false;
            if (-vn > 0.6) ev.push({ type: 'wall', v: -vn, mover: !!w.mover });
        } else if (w.mover && (wvx || wvz)) b.rest = false;
    }
    for (const p of c.bumpers) {
        let nx = b.x - p.x, nz = b.z - p.z; const dist = Math.hypot(nx, nz);
        if (dist >= p.r + R || dist < 1e-6 || b.y > p.y + 0.6) continue;
        nx /= dist; nz /= dist;
        b.x = p.x + nx * (p.r + R); b.z = p.z + nz * (p.r + R);
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) {
            b.vx -= (1 + BUMP_E) * vn * nx; b.vz -= (1 + BUMP_E) * vn * nz;
            b.vx += nx * BUMP_KICK; b.vz += nz * BUMP_KICK;
            b.rest = false;
            ev.push({ type: 'bumper', at: p });
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
 * and what happened: { x, y, z, result: 'rest'|'cup'|'water'|'out'|'time',
 * pts (every `every` s), bounces, t }.
 * `opts.stopAfter`: stop once the ball has gone this far (for the preview),
 * `opts.bounces`: stop after this many wall hits.
 */
export function simulate(c, from, dx, dz, power, t0 = 0, opts = {}) {
    const b = { ...newBall(from.x, from.z, from.y), sunk: false };
    strike(b, dx, dz, power);
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
            if (e.type === 'wall' || e.type === 'bumper') bounces++;
            if (e.type === 'cup') result = 'cup';
            if (e.type === 'water') result = 'water';
            if (e.type === 'out') result = 'out';
        }
        if (pts && since >= every) { since = 0; pts.push([b.x, b.y, b.z]); }
        if (result !== 'time') break;
        if (b.pipe || b.loop) { if (pts) pts.push([b.x, b.y, b.z]); if (opts.stopAtPipe) { result = 'pipe'; break; } }
        if (b.rest && !b.pipe && !b.loop) { result = 'rest'; break; }
        if (opts.stopAfter && travelled >= opts.stopAfter) { result = 'cut'; break; }
        if (opts.bounces != null && bounces > opts.bounces) { result = 'cut'; break; }
    }
    if (pts) pts.push([b.x, b.y, b.z]);
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
        if (v < best) best = v;
    }
    return best === Infinity ? Math.hypot(x - c.cup.x, z - c.cup.z) + 30 : best;
}

const _segX = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
    const d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
};

function _buildField(c) {
    const s = 0.3, B = c.bounds;
    const x0 = B.x0, z0 = B.z0, w = Math.ceil((B.x1 - B.x0) / s) + 1, h = Math.ceil((B.z1 - B.z0) / s) + 1;
    const N = w * h, floor = new Array(N), d = new Float64Array(N).fill(Infinity);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) floor[j * w + i] = floorAt(c, x0 + i * s, z0 + j * s, 99, 0);
    const blocked = (ax, az, bx, bz) => {
        for (const wl of c.walls) if (_segX(ax, az, bx, bz, wl.x1, wl.z1, wl.x2, wl.z2)) return true;
        for (const p of c.bumpers) if (Math.hypot((ax + bx) / 2 - p.x, (az + bz) / 2 - p.z) < p.r) return true;
        return false;
    };
    // Jumps and pipes: from a cell near `to` you can reach `from` for free.
    const links = [];
    const cellOf = (x, z) => Math.max(0, Math.min(h - 1, Math.round((z - z0) / s))) * w + Math.max(0, Math.min(w - 1, Math.round((x - x0) / s)));
    c.pipes.forEach(p => links.push([cellOf(p.b[0], p.b[1]), cellOf(p.a[0], p.a[1]), 0.5]));
    c.loops.forEach(l => { const n = Math.hypot(l.dir[0], l.dir[1]) || 1; links.push([cellOf(l.a[0] + l.dir[0] / n * l.len, l.a[1] + l.dir[1] / n * l.len), cellOf(l.a[0], l.a[1]), l.len]); });
    (c.hole.links || []).forEach(([ax, az, bx, bz]) => links.push([cellOf(bx, bz), cellOf(ax, az), Math.hypot(bx - ax, bz - az)]));
    // Dijkstra with a binary heap, out from the cup.
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
            // We search backwards (from the cup), so the ball goes g → f: it can
            // drop any distance but climb only a little — unless one is a hazard.
            const haz = HAZARD[g.kind] || HAZARD[f.kind];
            if (!haz && f.h - g.h > STEP_UP + Math.hypot(f.gx, f.gz) * s * 1.5) continue;
            const bx = x0 + ni * s, bz = z0 + nj * s;
            if (blocked(ax, az, bx, bz)) continue;
            const cost = Math.hypot(di, dj) * s * (HAZARD[g.kind] ? 6 : g.kind === 'sand' ? 1.6 : 1);
            if (dv + cost < d[nk]) { d[nk] = dv + cost; push(nk, d[nk]); }
        }
        for (const [to, from, cost] of links) if (to === k && dv + cost < d[from]) { d[from] = dv + cost; push(from, d[from]); }
    }
    return { x0, z0, s, w, h, d };
}
