// ============================================================
// GOLF LINT — every hole checked for clashes before anybody sees it.
//
// Pure (no THREE): lint(hole) compiles it and returns a list of problems,
// { level: 'error'|'warn', what, at }. An error is something a player would
// see or feel — a sweeper arm cutting through a rail, a bush growing out of
// the green, a tee that can't be putted from, a cup that can't be reached. A
// warning is something to look at (a floor overlay that may flicker).
//
// Checks:
//   tee     on a playable floor, its mat clear of walls, blocks, posts and movers
//   cup     on a playable floor, clear of walls by more than the ball, clear of
//           every mover's sweep (the flag pole stands in it), reachable from the tee
//   walls   blocks and posts not cut by walls they weren't built against
//   movers  each mover's swept area clear of the rails, blocks, posts and the
//           other movers' (a windmill's door is meant to sit in its gap)
//   pipes   both mouths on a floor, the exit clear and pointing onto floor
//   props   scenery off the course (with room for the rail) and off each other
//   floors  two floors stacked within a hair of each other (z-fighting)
// ============================================================
import { compile, floorAt, pathLeft, HAZARD, R, CUP_R } from './Physics.js';

// Scenery and how much room each piece takes on the ground (its footprint
// radius). Props listed in ON_COURSE are part of an obstacle and are meant to
// stand on the course (the sprinkler over its sweeper, the pool under its water).
const FOOT = {
    tree: 1.1, flowers: 0.55, gnome: 0.35, hedge: 0.6, bucket: 0.35, spade: 0.3, duck: 0.3, bed: 0.8, flag: 0.3,
    shed: 1.4, rocks: 0.8, cookie: 0.6, ginger: 0.45, gumballs: 0.5, crate: 0.5, palm: 0.7, barrel: 0.4, chest: 0.45,
    flagpole: 0.3, mast: 0.5, fin: 0.35, lollipop: 0.45, cane: 0.3, cupcake: 0.7, gumdrop: 0.45, cherry: 0.35, gummy: 0.5, container: 1.7,
    beacon: 0.4, satellite: 0.8, planet: 1.0, crystal: 0.5,
};
const ON_COURSE = new Set(['pool', 'hose', 'sprinkler', 'windmill', 'fort', 'cave', 'fan', 'cannon', 'wheel', 'skull', 'kraken', 'duck', 'fin', 'chocfall']);
const TEE_HALF = 0.6;

const segDist = (px, pz, ax, az, bx, bz) => {
    const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1e-9;
    const u = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / L2));
    return Math.hypot(px - (ax + ex * u), pz - (az + ez * u));
};
const segSeg = (a, b) => {
    // Shortest distance between two segments [x1, z1, x2, z2].
    const cross = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const d1 = cross(...a, b[0], b[1]), d2 = cross(...a, b[2], b[3]), d3 = cross(...b, a[0], a[1]), d4 = cross(...b, a[2], a[3]);
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
    return Math.min(segDist(a[0], a[1], ...b), segDist(a[2], a[3], ...b), segDist(b[0], b[1], ...a), segDist(b[2], b[3], ...a));
};
const fmt = (x, z) => `(${+x.toFixed(2)}, ${+z.toFixed(2)})`;

/** The ground a mover sweeps, as a test: does a segment / circle come within `pad` of it? */
function sweepOf(m) {
    if (m.type === 'sweeper') {
        const L = m.len || 2, r0 = m.r0 || 0;
        return { circle: [m.x, m.z, L + 0.08], ring: r0, hits: (seg, pad = 0) => {
            const near = segDist(m.x, m.z, ...seg), far = Math.max(Math.hypot(seg[0] - m.x, seg[1] - m.z), Math.hypot(seg[2] - m.x, seg[3] - m.z));
            return near < L + 0.08 + pad && far > r0 - pad;
        } };
    }
    if (m.type === 'slider') {
        const L = m.len || 1.6, A = m.amp || 1.5, bx = (m.bar || 'z') === 'x' ? 1 : 0, bz = 1 - bx, mx = (m.axis || 'z') === 'x' ? 1 : 0, mz = 1 - mx;
        const hw = [bx * L / 2 + mx * A + 0.15, bz * L / 2 + mz * A + 0.15];
        return { box: [m.x - hw[0], m.z - hw[1], m.x + hw[0], m.z + hw[1]] };
    }
    if (m.type === 'hammer') {
        const A = m.amp || 1.5, r = (m.r || 0.35) + 0.05, ax = (m.axis || 'z') === 'x' ? 1 : 0, az = 1 - ax;
        return { capsule: [m.x - ax * A, m.z - az * A, m.x + ax * A, m.z + az * A, r] };
    }
    return null;   // windmills and gates stand in their own doorway
}
function sweepHitsSeg(sw, seg, pad = 0) {
    if (sw.hits) return sw.hits(seg, pad);
    if (sw.capsule) { const [a, b, c2, d, r] = sw.capsule; return segSeg([a, b, c2, d], seg) < r + pad; }
    if (sw.box) {
        const [x0, z0, x1, z1] = sw.box;
        const inside = (x, z) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
        if (inside(seg[0], seg[1]) || inside(seg[2], seg[3])) return true;
        const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
        return edges.some(e => segSeg(e, seg) < pad + 1e-6);
    }
    return false;
}
const sweepHitsPt = (sw, x, z, r) => sweepHitsSeg(sw, [x, z, x, z], r);

export function lint(hole) {
    const out = [];
    const err = (what, x, z) => out.push({ level: 'error', what, at: x == null ? null : fmt(x, z) });
    const warn = (what, x, z) => out.push({ level: 'warn', what, at: x == null ? null : fmt(x, z) });
    let c;
    try { c = compile(hole); } catch (e) { err(`does not compile: ${e.message}`); return out; }
    const staticWalls = c.walls;   // rails, hole walls, block sides
    const blocks = hole.blocks || [];
    const posts = c.bumpers;
    const playable = (x, z) => { const f = floorAt(c, x, z, 99, 0, 0); return f && !HAZARD[f.kind] ? f : null; };

    // ── tee ──
    const [tx, tz] = hole.tee;
    if (!playable(tx, tz)) err('the tee is not on a playable floor', tx, tz);
    for (const w of staticWalls) if (segDist(tx, tz, w.x1, w.z1, w.x2, w.z2) < TEE_HALF * 0.75) { err('a wall or block runs through the tee mat', tx, tz); break; }
    for (const p of posts) if (Math.hypot(p.x - tx, p.z - tz) < p.r + TEE_HALF) err('a post stands on the tee mat', p.x, p.z);

    // ── cup ──
    const [cx, cz] = hole.cup;
    const cf = playable(cx, cz);
    if (!cf) err('the cup is not on a playable floor', cx, cz);
    else if (Math.hypot(cf.gx, cf.gz) > 0.12) warn(`the cup sits on a steep slope (${Math.hypot(cf.gx, cf.gz).toFixed(2)})`, cx, cz);
    for (const w of staticWalls) if (segDist(cx, cz, w.x1, w.z1, w.x2, w.z2) < CUP_R + R * 2) { err('the cup is hard against a wall', cx, cz); break; }
    for (const p of posts) if (Math.hypot(p.x - cx, p.z - cz) < p.r + CUP_R + R) err('a post crowds the cup', p.x, p.z);
    const left = pathLeft(c, tx, tz);
    if (left >= Math.hypot(tx - cx, tz - cz) + 30 * (c.S || 1) - 1e-6) err('the cup cannot be reached from the tee (path field)', tx, tz);

    // ── blocks and posts against walls ──
    blocks.forEach(([x0, z0, x1, z1], i) => {
        const own = new Set();
        // A block's own sides are walls too; anything else crossing its inside is a clash.
        const mx0 = Math.min(x0, x1) + 0.05, mx1 = Math.max(x0, x1) - 0.05, mz0 = Math.min(z0, z1) + 0.05, mz1 = Math.max(z0, z1) - 0.05;
        for (const w of staticWalls) {
            if (w.block) continue;
            const mid = [(w.x1 + w.x2) / 2, (w.z1 + w.z2) / 2];
            const inside = (x, z) => x > mx0 && x < mx1 && z > mz0 && z < mz1;
            if (inside(w.x1, w.z1) || inside(w.x2, w.z2) || inside(...mid)) { err(`a wall runs into block ${i}`, ...mid); break; }
        }
        if (!playable((x0 + x1) / 2, (z0 + z1) / 2) && !floorAt(c, (x0 + x1) / 2, (z0 + z1) / 2, 99, 0, 0)) err(`block ${i} stands over nothing`, (x0 + x1) / 2, (z0 + z1) / 2);
        void own;
    });
    posts.forEach((p, i) => {
        for (const w of staticWalls) if (segDist(p.x, p.z, w.x1, w.z1, w.x2, w.z2) < p.r - 0.02) { err(`post ${i} is cut by a wall`, p.x, p.z); break; }
        posts.forEach((q, j) => { if (j > i && Math.hypot(p.x - q.x, p.z - q.z) < p.r + q.r - 0.02) err(`posts ${i} and ${j} overlap`, p.x, p.z); });
        if (!floorAt(c, p.x, p.z, 99, 0, 0)) err(`post ${i} stands over nothing`, p.x, p.z);
    });

    // ── movers ──
    const movers = hole.movers || [];
    movers.forEach((m, i) => {
        const sw = sweepOf(m);
        if (!sw) return;
        const name = `${m.type} ${i}`;
        for (const w of staticWalls) {
            if (sweepHitsSeg(sw, [w.x1, w.z1, w.x2, w.z2], 0.02)) { err(`${name} sweeps through a ${w.block ? 'block' : w.rail ? 'rail' : 'wall'}`, (w.x1 + w.x2) / 2, (w.z1 + w.z2) / 2); break; }
        }
        for (const p of posts) if (sweepHitsPt(sw, p.x, p.z, p.r)) { err(`${name} sweeps through a post`, p.x, p.z); break; }
        if (sweepHitsPt(sw, cx, cz, CUP_R * 0.5)) err(`${name} sweeps over the cup (through the flag pole)`, cx, cz);
        if (sweepHitsPt(sw, tx, tz, TEE_HALF)) err(`${name} sweeps over the tee`, tx, tz);
        movers.forEach((o, j) => {
            if (j <= i) return;
            const so = sweepOf(o);
            if (!so) return;
            const probe = so.circle ? [so.circle[0], so.circle[1], so.circle[2]] : so.capsule ? [(so.capsule[0] + so.capsule[2]) / 2, (so.capsule[1] + so.capsule[3]) / 2, so.capsule[4]] : so.box ? [(so.box[0] + so.box[2]) / 2, (so.box[1] + so.box[3]) / 2, 0.3] : null;
            if (probe && sweepHitsPt(sw, probe[0], probe[1], probe[2] * 0.6)) err(`${name} and ${o.type} ${j} sweep the same ground`, probe[0], probe[1]);
        });
    });

    // ── pipes ──
    (hole.pipes || []).forEach((p, i) => {
        if (!playable(...p.a)) err(`pipe ${i}'s mouth is not on a floor`, ...p.a);
        if (!playable(...p.b)) err(`pipe ${i}'s exit is not on a floor`, ...p.b);
        for (const w of staticWalls) if (segDist(p.b[0], p.b[1], w.x1, w.z1, w.x2, w.z2) < R + 0.08) { err(`pipe ${i}'s exit is against a wall`, ...p.b); break; }
        const n = Math.hypot(...p.dir) || 1, ax = p.b[0] + p.dir[0] / n * 0.9, az = p.b[1] + p.dir[1] / n * 0.9;
        if (!playable(ax, az)) err(`pipe ${i} shoots off the course`, ax, az);
    });

    // ── props ──
    const scenery = (hole.props || []).filter(p => p.at && !ON_COURSE.has(p.type));
    scenery.forEach((p, i) => {
        const r = (FOOT[p.type] ?? 0.5) * (p.scale || 1);
        const [x, z] = p.at;
        // On the course, or close enough to the edge to lean over the rail.
        for (const t of c.tiles) {
            const dx = Math.max(t.x0 - x, 0, x - t.x1), dz = Math.max(t.z0 - z, 0, z - t.z1);
            if (Math.hypot(dx, dz) < r + 0.12) { err(`${p.type} stands on the course (tile ${t.i})`, x, z); break; }
        }
        scenery.forEach((q, j) => {
            if (j <= i) return;
            const rq = (FOOT[q.type] ?? 0.5) * (q.scale || 1);
            if (Math.hypot(x - q.at[0], z - q.at[1]) < (r + rq) * 0.8) err(`${p.type} and ${q.type} stand in each other`, x, z);
        });
    });

    // ── floors stacked within a hair (they flicker) ──
    for (let i = 0; i < c.tiles.length; i++) for (let j = i + 1; j < c.tiles.length; j++) {
        const a = c.tiles[i], b = c.tiles[j];
        if (a.move || b.move) continue;
        const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
        if (x1 - x0 < 0.05 || z1 - z0 < 0.05) continue;
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        const ha = floorAt({ ...c, tiles: [a] }, mx, mz, 99, 0, 0)?.h, hb = floorAt({ ...c, tiles: [b] }, mx, mz, 99, 0, 0)?.h;
        if (a.tilt || b.tilt || a.elev || b.elev) continue;
        if (ha != null && hb != null && Math.abs(ha - hb) < 0.02) warn(`tiles ${i} and ${j} overlap at the same height (may flicker)`, mx, mz);
    }
    return out;
}

/** Every hole of every course: { key: [problems] } for the holes with any. */
export function lintAll(courses) {
    const res = {};
    for (const co of courses) for (const h of co.holes) { const p = lint(h); if (p.length) res[`${co.key}/${h.key}`] = p; }
    return res;
}
