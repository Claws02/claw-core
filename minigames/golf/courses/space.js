// The Space course — its nine holes as data (see ../Courses.js for the format).
import { kick } from './kit.js';

// ── SPACE STATION — panels in orbit: fall off the edge and you're gone ──────
export const COURSE = {
    key: 'space', name: 'SPACE STATION', blurb: 'The anti-grav lift, teleporters, a minefield, moon jumps, lasers, magnets, airlocks, cargo belts and the solar wind.',
    theme: {
        sky: 0x05060f, ground: null, turf: [0x2c3170, 0x262b64], edge: 0x9aa3b5, rail: 0x22d3ee, railGlow: true,
        sand: 0x9a9aa8, water: 0x22d3ee, boost: 0xfacc15, wood: 0x6b7280, block: 0x4b5563, accent: 0xf472b6, fog: 0x05060f,
        bumper: 0x8b5cf6, sweeper: 0xf43f5e, slider: 0xef4444, flag: 0x22d3ee, pipe: 0xa855f7, sail: 0xc7d2fe, tee: 0x111827, loop: 0x22d3ee,
        felt: 0x343a86, conveyor: 0x374151, moon: 0x9ca3af, kick: 0xfacc15, mine: 'spike',
        windmill: 'airlock', scenery: 'space',
    },
    holes: [
        {   key: 'liftoff', name: 'THE ANTI-GRAV LIFT', sig: 'anti-grav lift', par: 3, tee: [0, 0], cup: [22, 0], rail: 'neon',
            // Boost down the strip into the lift; its doors open when it's level.
            tiles: [{ r: [-1.5, -1.5, 8, 1.5] }, { r: [8, -1.5, 11, 1.5], kind: 'boost', boost: [6, 0] }, { r: [11, -1.5, 14, 1.5] },
                    { r: [14, -1.5, 17, 1.5], kind: 'metal', elev: { amp: 2.5, period: 7 } },
                    { r: [17, -3, 26, 3], y: 2.5, kind: 'felt', hills: [[22, 0, 1.4, -0.08]] }],
            movers: [{ type: 'liftgate', x: 14, z: 0, axis: 'z', w: 1.5, tile: 3, at: 'bottom' },
                     { type: 'liftgate', x: 17, z: 0, axis: 'z', w: 1.5, tile: 3, at: 'top' }],
            // A force-field round the top deck: a ball flung off the rising lift stays aboard.
            walls: [[26, -3, 26, 3, 1.6], [17, -3, 26, -3, 1.0], [17, 3, 26, 3, 1.0]],
            links: [[14, 0, 17.8, 0]],
            props: [{ type: 'beacon', at: [7.8, 2.1] }, { type: 'beacon', at: [7.8, -2.1] }, { type: 'satellite', at: [14, -9] }] },

        {   key: 'hub', name: 'THE TELEPORTER HUB', sig: 'teleport choice', par: 4, tee: [0, 0], cup: [28, 0], rail: 'neon',
            tiles: [{ r: [-1.5, -3, 8, 3] }, { r: [12, -8, 22, -4] }, { r: [12, 4, 22, 8] },
                    { r: [22, -5, 24, -1] }, { r: [22, 1, 24, 5] }, { r: [24, -3, 31, 3], kind: 'felt' }],
            pipes: [{ a: [6.5, -1.8], b: [13.5, -6], dir: [1, 0], r: 0.4, delay: 0.6, out: 5, style: 'teleport' },
                    { a: [6.5, 1.8], b: [13.5, 6], dir: [1, 0], r: 0.4, delay: 0.6, out: 5, style: 'teleport' }],
            bumpers: [[17, -6.6, 0.13, 0, 0.6], [18, -5.2, 0.13, 0, 0.6], [19, -6.4, 0.13, 0, 0.6]],
            fans: [{ r: [15, 4, 19, 8], f: [0, 4] }],
            path: [[6.5, -1.8], [13.5, -6], [23, -3]],
            props: [{ type: 'crystal', at: [10, 0] }] },

        {   key: 'belt', name: 'THE MINEFIELD', sig: 'space mines', par: 3, tee: [0, 0], cup: [24, 0], rail: 'neon',
            // Asteroids to bank off, mines in the gaps between them.
            tiles: [{ r: [-1.5, -5, 26, 5], open: 'n' }],
            bumpers: [[5, 1.6, 0.55], [7.5, -1.8, 0.5], [9.5, 2.6, 0.6], [11, -0.2, 0.55], [13.5, -3, 0.5], [14.5, 2, 0.5], [17, -1, 0.6], [19, 3, 0.45], [20.5, -2.6, 0.5]],
            mines: [[12.6, 1.4], [16, -2.6], [21.2, 0.8]],
            props: [{ type: 'planet', at: [10, -18] }] },

        {   key: 'moon', name: 'MOON CRATERS', sig: 'low-gravity craters', par: 3, tee: [0, 0], cup: [24, 1], gravity: 0.45, rail: 'neon',
            // Low gravity and a crevasse: jump it off the ramp (the moon lets you
            // fly), or creep round on the gantry at the side.
            tiles: [{ r: [-1.5, -4, 12, 4], kind: 'rough',
                      hills: [[5, -1, 2, 0.35], [5, -1, 1.3, -0.45], [9, 2.2, 1.5, 0.3], [9, 2.2, 0.9, -0.35]] },
                    kick(10.5, -1.2, 12, 0.6, 'e'),
                    { r: [12, 2.8, 15, 4], kind: 'metal' },
                    { r: [15, -4, 26, 4], kind: 'rough', hills: [[19, -1.8, 1.8, 0.3], [19, -1.8, 1.1, -0.4]] }],
            links: [[12, 0, 15, 0]],
            props: [{ type: 'flagpole', at: [3, -4.8], moon: true }, { type: 'satellite', at: [12, 9] }] },

        {   key: 'lasers', name: 'THE LASER GRID', sig: 'lasers or the duct', par: 3, tee: [0, 0], cup: [28, -1], rail: 'neon',
            tiles: [{ r: [-1.5, -2.5, 30, 2.5] },
                    { r: [4, 2.5, 24, 3.7], kind: 'metal' }],
            // Or the service duct alongside: no lasers, but a long way and two vents to dodge.
            walls: [[5.2, 2.5, 22.8, 2.5]],
            bumpers: [[10, 3.3, 0.16, 0, 0.6], [16, 2.9, 0.16, 0, 0.6]],
            // Sliding emitters, and two laser fences across the whole corridor that
            // blink on and off: time it.
            movers: [{ type: 'slider', x: 6, z: 0, bar: 'z', axis: 'z', len: 1.6, amp: 1.4, speed: 1.3 },
                     { type: 'gate', x: 11, z: 0, axis: 'z', w: 2.5, speed: 1.3, phase: 0, laser: true },
                     { type: 'slider', x: 16, z: 0, bar: 'z', axis: 'z', len: 1.6, amp: 1.4, speed: 2.3, phase: 3 },
                     { type: 'gate', x: 21, z: 0, axis: 'z', w: 2.5, speed: 0.95, phase: 2.2, laser: true }],
            props: [{ type: 'satellite', at: [14, -8] }] },

        {   key: 'magnets', name: 'PLANET MAGNETS', sig: 'magnets', par: 3, tee: [0, 0], cup: [26, 2], rail: 'neon',
            tiles: [{ r: [-1.5, -6, 28, 6], open: 'n' }],
            magnets: [{ x: 8, z: -3, r: 4, k: 7 }, { x: 15, z: 3, r: 4, k: 7 }, { x: 21, z: -2.5, r: 3.5, k: 8 }],
            props: [{ type: 'planet', at: [-10, 16] }] },

        {   key: 'airlock', name: 'THE AIRLOCKS', sig: 'airlocks', par: 4, tee: [0, 0], cup: [16, 12.5], rail: 'neon', blockMat: 'metal',
            tiles: [{ r: [-1.5, -2, 18, 2] }, { r: [14, 2, 18, 15] }],
            blocks: [[6, -2, 7, -0.5, 1.2], [6, 0.5, 7, 2, 1.2], [14, 7, 15.5, 8, 1.2], [16.5, 7, 18, 8, 1.2]],
            movers: [{ type: 'windmill', x: 6, z: 0, axis: 'z', w: 0.5, speed: 1.4 }, { type: 'windmill', x: 16, z: 7, axis: 'x', w: 0.5, speed: 2.0 }],
            path: [[16, 0]],
            props: [{ type: 'beacon', at: [6.5, 2.7] }, { type: 'beacon', at: [18.7, 7.5] }] },

        {   key: 'cargo', name: 'THE CARGO BAY', sig: 'belts or the catwalk', par: 5, tee: [0, 0], cup: [24.5, -3], rail: 'neon', blockMat: 'metal',
            tiles: [{ r: [-1.5, -6, 6, 6] },
                    { r: [6, -6, 9, 6], kind: 'conveyor', flow: [0, 3] },
                    { r: [9, -6, 12, 6] },
                    { r: [12, -6, 15, 6], kind: 'conveyor', flow: [0, -3.5] },
                    { r: [15, -6, 18, 6] },
                    { r: [18, -6, 21, 6], kind: 'conveyor', flow: [0, 2.5] },
                    { r: [21, -6, 27, 6] },
            // Upstairs: a catwalk over the belts — up the ramp, along, down the far stairs by the cup.
            // No rail on the belt side: fall off and you're back down among the crates.
                    { r: [2, -5.8, 6, -4.6], y: 0.8, slope: [0.4, 0], kind: 'metal' },
                    { r: [6, -5.8, 21, -4.6], y: 1.6, kind: 'metal', open: 's' },
                    { r: [21, -5.8, 24, -4.6], y: 0.8, slope: [-0.5333, 0], kind: 'metal' }],
            blocks: [[10, 3, 11, 4, 0.6], [16, -3.6, 17, -2.6, 0.6], [22.5, 1, 23.5, 2, 0.6]],
            props: [{ type: 'crate', at: [3, 6.8] }, { type: 'crate', at: [25, 6.8] }] },

        {   key: 'wind', name: 'THE SOLAR WIND', sig: 'fans', par: 4, tee: [0, 0], cup: [28, 2], rail: 'neon',
            tiles: [{ r: [-1.5, -3, 6, 3] }, { r: [6, -0.9, 22, 0.9], open: 'ns', kind: 'felt' }, { r: [22, -4, 30, 4] }],
            fans: [{ r: [8, -3.5, 12, 3.5], f: [0, 4.5] }, { r: [15, -3.5, 19, 3.5], f: [0, -4.5] }],
            props: [{ type: 'fan', at: [10, -3.6], dir: 1 }, { type: 'fan', at: [17, 3.6], dir: -1 }, { type: 'planet', at: [16, 18] }] },
    ],
};

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'moon-jump',  course: 'space',    key: 'moon',       name: 'Moon Jump',             from: [8, -0.3],     zone: [15, -4, 26, 4] },
    { id: 'sling',      course: 'space',    key: 'magnets',    name: 'Planet Slingshot',      from: [0, 0],        zone: [23, -1, 28, 4] },
    { id: 'mines',      course: 'space',    key: 'belt',       name: 'Minefield Run',         from: [0, 0],        zone: [21, -3, 26, 3] },
];
