// The Pirate course — its nine holes as data (see ../Courses.js for the format).
import { kick } from './kit.js';

// ── PIRATE COVE — a smugglers' island ───────────────────────────────────────
export const COURSE = {
    key: 'pirate', name: 'PIRATE COVE', blurb: 'Walk the plank, ride the raft, fire the cannon, mind the powder kegs and climb to the crow\'s nest.',
    theme: {
        sky: 0x79cdf2, ground: 0xe6cf93, turf: [0x22a37a, 0x1d966f], edge: 0x5a3a1e, rail: 0x8b5a2b,
        sand: 0xf2dca4, water: 0x1a86cf, wood: 0xa0673a, block: 0x8a877d, accent: 0xd9a514, fog: 0x79cdf2,
        bumper: 0x8a4f22, sweeper: 0x6b3f1d, slider: 0x8e44ad, flag: 0x16161a, pipe: 0x2b2b30, sail: 0xf2e8d0, tee: 0x5a3a1e,
        felt: 0x1f8f6b, raft: 0x9a6a3a, kick: 0xd9a514, mine: 'keg',
        scenery: 'pirate',
    },
    holes: [
        {   key: 'plank', name: 'WALK THE PLANK', sig: 'balance beams', par: 5, tee: [0, 0], cup: [22, 6.6],
            tiles: [{ r: [-1.5, -2, 5, 2] },
                    { r: [5, -4, 18, 10], y: -0.4, kind: 'water', rail: false },
                    { r: [5, -0.6, 11.2, 0.6], kind: 'wood', open: 'ns' },
                    { r: [10, 0.6, 11.2, 7.2], kind: 'wood', open: 'we' },
                    { r: [11.2, 6, 18, 7.2], kind: 'wood', open: 'ns' },
                    { r: [18, 4, 24, 9] }],
            path: [[10.6, 0], [10.6, 6.6]],
            props: [{ type: 'barrel', at: [2, -2.6] }, { type: 'palm', at: [23, 10.4] }, { type: 'palm', at: [20, 2.9] }] },

        {   key: 'raft', name: 'THE TREASURE RAFT', sig: 'moving raft', par: 5, tee: [0, 0], cup: [27, -1],
            tiles: [{ r: [-1.5, -2, 8, 2], open: 'e' },
                    { r: [8, -4, 20, 4], y: -0.35, kind: 'water', rail: false },
                    { r: [12, -1.3, 16, 1.3], kind: 'raft', move: { axis: 'x', amp: 4, speed: 0.55, phase: -1.5708 } },
                    { r: [20, -3, 30, 3], open: 'w' }],
            links: [[8, 0, 20, 0]],
            props: [{ type: 'chest', at: [31.2, 2] }, { type: 'palm', at: [25, -4.4] }, { type: 'barrel', at: [6, 2.7] }] },

        {   key: 'cannon', name: 'THE CANNON', sig: 'cannon or the gangway', par: 3, tee: [0, 0], cup: [21.5, 1.4],
            // Two ways over: the cannon (in it, and it throws you straight on at the cup),
            // or round the long way, down the plank and up the gangway.
            tiles: [{ r: [-1.5, -2, 10, 2] },
                    { r: [2.6, -6.2, 4, -2], kind: 'wood', open: 's' },
                    { r: [4, -6.2, 13, -4.8], y: 0.75, slope: [0.1667, 0], kind: 'wood', open: 'we' },
                    { r: [-1.5, -9, 13, -6.2], y: -0.4, kind: 'water', rail: false },
                    { r: [4, -4.8, 13, -2], y: -0.4, kind: 'water', rail: false },
                    { r: [10, -2, 13, 5], y: -0.4, kind: 'water', rail: false },
                    { r: [13, -6.2, 25, 4], y: 1.5, hills: [[18.5, -3.5, 1.6, 0.18]] }],
            pipes: [{ a: [9, 0], b: [15, 0], dir: [1, 0], r: 0.42, delay: 1.1, out: 3.6, style: 'cannon' }],
            path: [[3.3, -1], [3.3, -5.5], [13.5, -5.5]],
            props: [{ type: 'cannon', at: [9, 0], to: [15, 0] }, { type: 'flagpole', at: [26.4, 5.5] }, { type: 'fort', at: [21, 6.6] }] },

        {   key: 'wheel', name: 'THE SHIP\'S WHEEL', sig: 'turntable', par: 3, tee: [0, 0], cup: [23.5, 1.2],
            // Across the spinning wheel to the quarterdeck: it carries the ball round as it crosses.
            tiles: [{ r: [-1.5, -3, 8, 3], kind: 'wood' },
                    { r: [8, -4, 16, 4], kind: 'wood', spin: 0.75 },
                    { r: [16, -3, 20, 3], kind: 'wood' },
                    { r: [20, -3, 26, 3], hills: [[23.5, 1.2, 1.4, -0.08]] }],
            props: [{ type: 'mast', at: [12, -5.2] }, { type: 'barrel', at: [20, 3.7] }] },

        {   key: 'skull', name: 'SKULL CAVE', sig: 'cave', par: 4, tee: [0, 0], cup: [28, 0.5],
            tiles: [{ r: [-1.5, -3, 10, 3] }, { r: [10, -3, 22, 3], y: -0.12, slope: [-0.02, 0], kind: 'rough' }, { r: [22, -3, 30, 3], y: -0.24 }],
            blocks: [[10, -3, 12, -2, 1.6], [10, -1, 12, 1, 1.6], [10, 2, 12, 3, 1.6], [16, -0.7, 17.2, 0.7, 1.2]],
            path: [[11, -1.5], [16.6, -1.8]],
            props: [{ type: 'skull', at: [11, 0] }, { type: 'cave', r: [12, -3, 22, 3] }, { type: 'chest', at: [31.2, 2] }] },

        {   key: 'shark', name: 'SHARK BAY', sig: 'drawbridge', par: 3, tee: [0, 0], cup: [22, 1.5],
            // Wait for the drawbridge — or don't: the ramp at the dock's corner
            // jumps the sharks when the bridge is up.
            tiles: [{ r: [-1.5, -2, 8, 2], open: 'e' },
                    kick(6.4, 0.9, 8, 2, 'e'),
                    { r: [8, -4, 14, 4], y: -0.4, kind: 'water', rail: false },
                    { r: [8, -0.7, 14, 0.7], kind: 'wood', lift: { period: 7, down: 0.55, phase: 0 } },
                    { r: [14, -2.5, 26, 4], open: 'w' }],
            path: [[11, 0]],
            props: [{ type: 'fin', at: [11, 2.4] }, { type: 'fin', at: [10.5, -2.6] }, { type: 'barrel', at: [24, -3.3] }] },

        {   key: 'powder', name: 'THE POWDER KEGS', sig: 'powder kegs', par: 3, tee: [0, 0], cup: [24, 0],
            // A gun deck strewn with powder kegs. Roll over one and it goes up —
            // and so do you. Thread them, or bank round them.
            tiles: [{ r: [-1.5, -2.5, 26, 2.5], kind: 'wood', hills: [[24, 0, 1.6, -0.08]] }],
            mines: [[7, -1.2], [7, 1.2], [11, 0], [14.5, -1.6], [14.5, 1.6], [18, -0.5]],
            blocks: [[20.5, 1.4, 21.5, 2.5, 0.6]],
            props: [{ type: 'cannon', at: [12, -3.4], deco: true }, { type: 'cannon', at: [12, 3.4], deco: true }, { type: 'barrel', at: [27.5, 2] }] },

        {   key: 'kraken', name: 'THE KRAKEN', sig: 'hammers or the plank', par: 3, tee: [0, 0], cup: [28, -1],
            // Through the tentacles' sweep, or along the plank outside the rail,
            // with nothing but the sea on its far side.
            tiles: [{ r: [-1.5, -2.5, 30, 2.5], hills: [[24, 1.2, 1.6, 0.2]] },
                    { r: [5, 2.5, 23, 3.6], kind: 'wood', open: 's' },
                    { r: [5, 3.6, 23, 5], y: -0.4, kind: 'water', rail: false }],
            walls: [[6.2, 2.5, 21.8, 2.5]],
            movers: [{ type: 'hammer', x: 8, z: 0, axis: 'z', amp: 1.8, r: 0.5, speed: 1.4 },
                     { type: 'hammer', x: 14, z: 0, axis: 'z', amp: 1.8, r: 0.5, speed: 1.9, phase: 2 },
                     { type: 'hammer', x: 20, z: 0, axis: 'z', amp: 1.8, r: 0.5, speed: 1.2, phase: 4 }],
            props: [{ type: 'kraken', at: [14, -4.2] }] },

        {   key: 'crowsnest', name: 'THE CROW\'S NEST', sig: 'lift', par: 4, tee: [0, 0], cup: [22, 0],
            // Up the mast in the cargo lift. Its doors open only when it's level:
            // in at the bottom, ride it up, out at the top onto the nest.
            tiles: [{ r: [-1.5, -3, 14, 3], kind: 'wood' },
                    { r: [14, -1.4, 17.4, 1.4], kind: 'wood', elev: { amp: 2, period: 9 } },
                    { r: [17.4, -3, 25, 3], y: 2, hills: [[22, 0, 1.4, -0.08]] }],
            movers: [{ type: 'liftgate', x: 14, z: 0, axis: 'z', w: 1.4, tile: 1, at: 'bottom' },
                     { type: 'liftgate', x: 17.4, z: 0, axis: 'z', w: 1.4, tile: 1, at: 'top' }],
            bumpers: [[9, -1.5, 0.35, 0.6], [9, 1.5, 0.35, 0.6]],
            // The nest's back is a tall bulwark: a ball flung off the rising lift stays aboard.
            walls: [[25, -3, 25, 3, 1.6], [17.4, -3, 25, -3, 1.0], [17.4, 3, 25, 3, 1.0]],
            links: [[14, 0, 18.2, 0]],
            path: [[15.7, 0]],
            props: [{ type: 'mast', at: [6, -4.2] }, { type: 'barrel', at: [2, 3.6] }, { type: 'chest', at: [26.5, 2] }] },
    ],
};

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'shark-jump', course: 'pirate',   key: 'shark',      name: 'Jump the Sharks',       from: [6, 1.45],     zone: [14, -2.5, 26, 4] },
    { id: 'kegs',       course: 'pirate',   key: 'powder',     name: 'Thread the Kegs',       from: [0, 0],        zone: [20, -2.5, 26, 2.5] },
    { id: 'tentacles',  course: 'pirate',   key: 'kraken',     name: 'Past the Kraken',       from: [4, 0],        zone: [24, -2.5, 30, 2.5] },
];
