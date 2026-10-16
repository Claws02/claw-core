// ============================================================
// GOLF COURSES (v3) — the holes, as data. Physics.compile() reads them;
// Build.js draws them in the course's theme. Nothing here knows THREE.
//
// A hole (see Physics.compile for every field):
//   name, par, tee [x, z], cup [x, z], sig: the hole's own centrepiece
//   tiles   floor: { r: [x0, z0, x1, z1], y, slope, hills, ridges, trough, kind, open,
//                    flow, spin, move, lift, tilt, elev, railMat, kick }
//   path    waypoints from the tee to the cup, round the corners (bots, cameras)
//   walls, blocks, bumpers, movers, fans, magnets, pipes, loops, mines   (all optional)
//   links   extra jumps the route field may take (over a wall on a jelly pad, …)
//   props   scenery only, drawn by the theme: { type, at: [x, z], ... }
//
// The v3 standard, every hole:
//   · one centrepiece (sig) no other hole is built round;
//   · something to read in three dimensions — a raised green, a drop, a lift,
//     a slide — or a line that has to be banked;
//   · where it fits, a TRICK SHOT: a kicker ramp, a plank, a drop off a ledge,
//     a rabbit hole — quicker than the long way round, and a stroke (a hazard)
//     if it's missed;
//   · clean: Lint.js finds no clash (a prop on the green, a sweeper through a
//     rail, a cup the route can't reach).
// ============================================================

import * as BY from './courses/backyard.js';
import * as PI from './courses/pirate.js';
import * as CA from './courses/candy.js';
import * as SP from './courses/space.js';
export { kick } from './courses/kit.js';

// ── Openings: every hole starts up high and comes down onto the course ───────
// Each course has its own way down — so a course feels like one place:
//   backyard  off the patio: a step down (a ledge) or the garden ramp
//   pirate    off the ship: jump the gap to the dock, or walk the gangplank (no rails, sea both sides)
//   candy     off the top of a cake: a tier drop, or the frosting slide
//   space     off a launch deck: jump the void (low gravity carries you), or a ledge
const OPENINGS = {
    backyard: { kind: 'wood', prop: 'gnome', styles: [['ledge', 1.1], ['ramp', 1.4], ['ledge', 0.9], ['ramp', 1.6]] },
    pirate:   { kind: 'wood', prop: 'mast', styles: [['jump', 1.4], ['plank', 1.8], ['jump', 1.2], ['plank', 1.5]] },
    candy:    { kind: undefined, prop: 'cane', styles: [['ledge', 2.0], ['slide', 2.4], ['ledge', 1.6], ['slide', 2.0]] },
    space:    { kind: 'metal', prop: 'beacon', styles: [['jump', 1.0], ['ledge', 1.4], ['jump', 0.8], ['jump', 1.2]] },
};
// Only some holes start high — where the way down is part of the hole's idea.
const OPENING_ON = {
    gardenpath: 'ledge', pool: 'ramp', castle: 'ledge',
    plank: 'jump', skull: 'jump', kraken: 'plank',
    rink: 'ledge', mountain: 'slide', tower: 'ledge',
    belt: 'jump', moon: 'jump', wind: 'jump',
};
function _opening(h, course) {
    const O = OPENINGS[course], X = -1.5;
    const t0 = h.tiles.find(t => t.r[0] === X && t.r[1] <= h.tee[1] && t.r[3] >= h.tee[1] && !t.y && !t.slope && !t.move && !t.tilt && !t.elev);
    // A hole can pick its own (start: 'ledge' | 'ramp' | 'slide' | 'jump' | 'plank' | 'none').
    const style = h.start === 'none' ? null : (h.start || OPENING_ON[h.key]);
    if (!O || !t0 || !style || h.tee[0] !== 0) return h;
    const H = (O.styles.find(([st]) => st === style) || O.styles[0])[1];
    const za = Math.max(t0.r[1], -2.5), zb = Math.min(t0.r[3], 2.5);
    const kind = O.kind, tiles = h.tiles.map(t => t === t0 && style !== 'ramp' && style !== 'slide' && style !== 'plank' ? { ...t, open: (t.open || '') + 'w' } : t);
    const links = [...(h.links || [])];
    const add = [], L = 6;
    let teeX;
    if (style === 'ledge') {
        // Straight off the edge and down onto the course.
        add.push({ r: [X - L, za, X, zb], y: H, kind, open: 'e' });
        teeX = X - L + 1.6;
    } else if (style === 'ramp' || style === 'slide') {
        const R = style === 'slide' ? 5.5 : 4, w = style === 'slide' ? 1.0 : 1.3;
        add.push({ r: [X - R - L, -2, X - R, 2], y: H, kind },
                 { r: [X - R, -w, X, w], y: H / 2, slope: [-H / R, 0], kind: style === 'slide' ? 'felt' : 'wood' });
        teeX = X - R - L + 1.6;
    } else if (style === 'plank') {
        // The gangplank: a narrow board with no rails, the sea underneath.
        const R = 5.5;
        add.push({ r: [X - R - L, -2, X - R, 2], y: H, kind },
                 { r: [X - R, -0.6, X, 0.6], y: H / 2, slope: [-H / R, 0], kind: 'wood', open: 'nswe' },
                 { r: [X - R, -3, X, 3], y: -0.4, kind: 'water', rail: false });
        teeX = X - R - L + 1.6;
    } else {
        // The jump: off the end of the deck and over the gap. Too soft and you're in it.
        const G = course === 'space' ? 3.0 : 2.2;
        add.push({ r: [X - G - L, -2, X - G, 2], y: H, kind, open: 'e' });
        if (course === 'pirate') add.push({ r: [X - G, -3, X, 3], y: -0.4, kind: 'water', rail: false });
        links.push([X - G - 0.4, 0, X + 0.4, 0]);
        teeX = X - G - L + 1.6;
    }
    // Something of the course's own by the top of the way down.
    const props = [...(h.props || []), { type: O.prop, at: [teeX + 0.6, (style === 'ledge' ? Math.min(-2.5, za) : -2) - 1.1] }];
    // Movers that name a tile by its place in the list (a lift's doors) move along with it.
    const movers = h.movers && h.movers.map(m => m.tile != null ? { ...m, tile: m.tile + add.length } : m);
    return { ...h, tee: [teeX, 0], tiles: [...add, ...tiles], links, props, ...(movers ? { movers } : {}), opening: style };
}

export const COURSES = [BY.COURSE, PI.COURSE, CA.COURSE, SP.COURSE].map(c => ({ ...c, holes: c.holes.map(h => _opening(h, c.key)) }));

/**
 * Trick shots: one ball from a set spot, three goes. In if it stops in the box
 * (`zone`, [x0, z0, x1, z1]) or drops. Each was searched in the physics for a
 * window that exists but is narrow (Lint keeps the holes clean; a script played
 * every angle and power from the spot): roughly 1–6% of all directions and
 * strengths land it, far more if you aim the right way.
 */
export const CHALLENGES = [BY.CHALLENGES, PI.CHALLENGES, CA.CHALLENGES, SP.CHALLENGES].flat();
export const COURSE_KEYS = COURSES.map(c => c.key);
export const courseByKey = k => COURSES.find(c => c.key === k) || COURSES[0];
/** Every hole of every course, as [courseKey, hole]. */
export const ALL_HOLES = () => COURSES.flatMap(c => c.holes.map(h => [c.key, h]));
export const coursePar = c => c.holes.reduce((a, h) => a + h.par, 0);
