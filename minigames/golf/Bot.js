// ============================================================
// GOLF BOT — picks a shot by playing candidates out in the physics.
//
// A coarse sweep (toward the next waypoint, then all the way round for banks),
// a refine round the best few, then the miss: the worse the bot, the wider.
// Cheap enough to run in a frame or two: each candidate is ~1 ms.
// ============================================================
import { simulate, pathLeft } from './Physics.js';

/** Score a result: lower is better. */
function _score(c, r, from) {
    if (r.result === 'cup') return -1000 + r.t;
    if (r.result === 'water' || r.result === 'out') return pathLeft(c, from.x, from.z) + 10;
    return pathLeft(c, r.x, r.z);
}

/**
 * The bot's shot from ball `b` at course time t: { dx, dz, power }.
 * skill 0..1. `rand` is a 0..1 generator (Math.random by default).
 */
export function plan(c, b, t, skill = 0.55, rand = Math.random) {
    const from = { x: b.x, y: b.y, z: b.z };
    // Aim first at the first waypoint we can't already see past.
    const left = pathLeft(c, from.x, from.z);
    let target = c.path[c.path.length - 1];
    for (let i = 1; i < c.path.length; i++) {
        const p = c.path[i];
        if (pathLeft(c, p[0], p[1]) < left - 0.5) { target = p; break; }
    }
    const direct = Math.atan2(target[1] - from.z, target[0] - from.x);
    const dist = Math.hypot(target[0] - from.x, target[1] - from.z);
    const cands = [];
    const tries = 26 + Math.round(skill * 26);
    for (let k = 0; k < tries; k++) {
        const wide = k >= tries * 0.6;
        const a = direct + (wide ? (rand() - 0.5) * Math.PI * 2 : (rand() - 0.5) * 0.7);
        const p = wide ? 0.25 + rand() * 0.75 : Math.min(1, Math.max(0.08, Math.sqrt(dist / 30) * (0.7 + rand() * 0.7)));
        cands.push([a, p]);
    }
    const run = ([a, p]) => {
        const r = simulate(c, from, Math.cos(a), Math.sin(a), p, t + 0.4, { maxT: 7, dt: 1 / 60 });
        return { a, p, s: _score(c, r, from), r: r.result };
    };
    let res = cands.map(run).sort((x, y) => x.s - y.s);
    // Refine round the best three.
    const refine = 6 + Math.round(skill * 14);
    const top = res.slice(0, 3);
    for (const best of top) for (let k = 0; k < refine / 3; k++) {
        res.push(run([best.a + (rand() - 0.5) * 0.12, Math.max(0.05, Math.min(1, best.p * (0.9 + rand() * 0.2)))]));
    }
    res.sort((x, y) => x.s - y.s);
    const best = res[0];
    // The miss.
    // A human-sized miss: a few degrees and a few percent at middling skill.
    const err = 1 - skill;
    const g = () => (rand() + rand() + rand() - 1.5) / 1.5;      // roughly normal, −1..1
    const a = best.a + g() * err * 0.32;
    const p = Math.max(0.05, Math.min(1, best.p * (1 + g() * err * 0.34)));
    return { dx: Math.cos(a), dz: Math.sin(a), power: p, expect: best.r };
}
