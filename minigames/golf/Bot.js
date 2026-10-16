// ============================================================
// GOLF BOT — picks a shot by playing candidates out in the physics.
//
// A sweep (toward each waypoint ahead and the cup, at several strengths, plus
// a ring all the way round for banks), a refine round the best few, a look at
// waiting (on a hole that moves: a raft, a drawbridge, a door), then the miss:
// the worse the bot, the wider.
//
// plan()       does it all at once (tests, the solver, a timed-out putt).
// planSteps()  is the same as a generator, so the game can spread the work
//              over a few frames and never stall a phone.
// ============================================================
import { simulate, pathLeft, floorAt, tileOffset, SURFACE } from './Physics.js';

/** Score a result: lower is better. `when` is the course time the shot was struck. */
function _score(c, r, from, when = 0) {
    if (r.result === 'cup') return -1000 + r.t;
    if (r.result === 'water' || r.result === 'out' || r.result === 'norest') return pathLeft(c, from.x, from.z) + 10;
    let s = pathLeft(c, r.x, r.z);
    // Resting on something that moves (a raft): it's worth the best place it rides to.
    const f = floorAt(c, r.x, r.z, r.y + 0.05, 0.1, when + r.t);
    if (f?.tile?.move) {
        for (const w of [1.5, 3, 4.5, 6, 7.5]) {
            const q = simulate(c, { x: r.x, y: r.y, z: r.z }, 0, 0, 0, when + r.t, { maxT: w, minT: w, dt: 1 / 30 });
            if (q.result === 'water' || q.result === 'out') break;
            s = Math.min(s, pathLeft(c, q.x, q.z) + w * 0.2);
        }
    }
    return s;
}

export function* planSteps(c, b, t, skill = 0.55, rand = Math.random) {
    const from = { x: b.x, y: b.y, z: b.z };
    const left = pathLeft(c, from.x, from.z);
    // Where to aim: the waypoints still ahead (closer to the cup than we are), and the cup.
    const ahead = c.path.slice(1).filter(p => pathLeft(c, p[0], p[1]) < left - 0.5).slice(0, 2);
    const targets = ahead.length ? ahead : [c.path[c.path.length - 1]];
    if (!targets.some(p => p === c.path[c.path.length - 1])) targets.push(c.path[c.path.length - 1]);
    const tShot = t + 0.4;
    const res = [];
    const run = (a, p, at = from, when = tShot, extra = 0) => {
        const r = simulate(c, at, Math.cos(a), Math.sin(a), p, when, { maxT: 7, dt: 1 / 45 });
        const s = { a, p, s: _score(c, r, from, when) + extra, r: r.result, wait: when - tShot };
        res.push(s);
        return s;
    };
    const fine = skill > 0.6 ? 9 : 7;
    for (const tg of targets) {
        const dir = Math.atan2(tg[1] - from.z, tg[0] - from.x), dist = Math.hypot(tg[0] - from.x, tg[1] - from.z);
        const base = Math.min(1, Math.sqrt(dist / 34));
        for (let i = 0; i < fine; i++) {
            const a = dir + (i - (fine - 1) / 2) * 0.07;
            for (const k of [0.55, 0.8, 1.05, 1.35, 1.8]) run(a, Math.max(0.06, Math.min(1, base * k)));
        }
        yield;
    }
    // A ring all the way round, for banks off the rails.
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2 + rand() * 0.1; run(a, 0.4); run(a, 0.75); }
    yield;
    res.sort((x, y) => x.s - y.s);
    // Refine round the best three.
    for (const best of res.slice(0, 3)) for (let k = 0; k < 4 + Math.round(skill * 6); k++) run(best.a + (rand() - 0.5) * 0.06, Math.max(0.05, Math.min(1, best.p * (0.93 + rand() * 0.14))));
    yield;
    res.sort((x, y) => x.s - y.s);
    let best = res[0];
    // On a hole that moves it's worth waiting for the right moment: try the
    // best lines again a little later, from where the ball will be by then.
    if (c.dynamic && best.r !== 'cup') {
        const top = res.slice(0, 4);
        const rafts = c.tiles.filter(tl => tl.move && SURFACE[tl.kind]?.ride);
        for (const w of [0.8, 1.6, 2.4, 3.2, 4.4, 5.6, 6.8, 8, 9.5, 11]) {
            const at = simulate(c, from, 0, 0, 0, tShot, { maxT: w, minT: w, dt: 1 / 30 });
            if (at.result === 'water' || at.result === 'out') break;
            const pos = { x: at.x, y: at.y, z: at.z };
            for (const cand of top) run(cand.a, cand.p, pos, tShot + w, w * 0.3);
            for (const tg of targets) {
                const dir = Math.atan2(tg[1] - pos.z, tg[0] - pos.x), base = Math.min(1, Math.sqrt(Math.hypot(tg[0] - pos.x, tg[1] - pos.z) / 34));
                for (let i = -2; i <= 2; i++) for (const k of [0.8, 1.1, 1.5]) run(dir + i * 0.08, Math.min(1, base * k), pos, tShot + w, w * 0.3);
            }
            // A raft within reach: a soft putt to stop on its deck.
            for (const tl of rafts) {
                const o = tileOffset(tl, tShot + w), rx = tl.cx + o.dx, rz = tl.cz + o.dz, dd = Math.hypot(rx - pos.x, rz - pos.z);
                if (dd > 9) continue;
                const dir = Math.atan2(rz - pos.z, rx - pos.x);
                for (let i = -1; i <= 1; i++) for (const k of [0.75, 0.9, 1.05, 1.2]) run(dir + i * 0.05, Math.max(0.06, Math.min(1, Math.sqrt(dd / 34) * k)), pos, tShot + w, w * 0.3);
            }
            yield;
        }
        res.sort((x, y) => x.s - y.s);
        if (res[0].s < best.s - 0.5) best = res[0];
    }
    // The miss: a few degrees and a few percent at middling skill.
    const err = 1 - skill;
    // A shot that only works dead on (a long ace over a gap) isn't worth it if a
    // miss of the bot's own size ends in the water: take the best safe one instead.
    const risky = cand => {
        if (err < 0.1) return false;
        let bad = 0;
        for (const [da, dp] of [[-0.12, 0], [0.12, 0], [0, -0.12], [0, 0.12]]) {
            const r = simulate(c, cand.at || from, Math.cos(cand.a + da * err), Math.sin(cand.a + da * err), Math.max(0.05, Math.min(1, cand.p * (1 + dp * err * 2))), tShot + (cand.wait || 0), { maxT: 7, dt: 1 / 45 });
            if (r.result === 'water' || r.result === 'out') bad++;
        }
        return bad >= 2;
    };
    if (!best.wait && risky(best)) {
        const safe = res.filter(x => x.r !== 'water' && x.r !== 'out' && x !== best && !x.wait).sort((x, y) => x.s - y.s);
        for (const cand of safe.slice(0, 4)) if (!risky(cand)) { best = cand; break; }
    }
    const g = () => (rand() + rand() + rand() - 1.5) / 1.5;      // roughly normal, −1..1
    const a = best.a + g() * err * 0.3;
    const p = Math.max(0.05, Math.min(1, best.p * (1 + g() * err * 0.32)));
    return { dx: Math.cos(a), dz: Math.sin(a), power: p, expect: best.r, wait: best.wait || 0 };
}

/** The bot's shot from ball `b` at course time t: { dx, dz, power, wait }. skill 0..1. */
export function plan(c, b, t, skill = 0.55, rand = Math.random) {
    const it = planSteps(c, b, t, skill, rand);
    for (;;) { const s = it.next(); if (s.done) return s.value; }
}
