// The Backyard course — its nine holes as data (see ../Courses.js for the format).
import { kick } from './kit.js';

// ── BACKYARD — someone's garden on a summer afternoon ───────────────────────
export const COURSE = {
    key: 'backyard', name: 'BACKYARD', blurb: 'A summer garden: the flower-bed jump, the hedge maze, the paddling pool, the bouncy castle and the playground.',
    theme: {
        sky: 0x8ccbf0, ground: 0x45903a, turf: [0x3aa346, 0x31933d], edge: 0x8a5a2b, rail: 0xf3e9d2,
        sand: 0xead39b, water: 0x4fb4ec, wood: 0xb7814a, block: 0x2f7d3a, accent: 0xff7a59, fog: 0x8ccbf0,
        felt: 0x2f9a45, puddle: 0x7cc4ea, pipe: 0x2e9e57, flowers: 0xc0457a, lava: 0xff5a1f, bouncy: 0xffd166,
        inflatable: [0xff6b6b, 0xffd166, 0x4dabf7], kick: 0xff7a59,
        scenery: 'backyard',
    },
    holes: [
        {   key: 'gardenpath', name: 'THE GARDEN PATH', sig: 'flower-bed jump', par: 4, tee: [0, 0], cup: [10.5, 14.5],
            // Off the patio and down the path over the whoops, round the corner and
            // up the lawn — or hit the kicker at the bed's edge and fly the flowers
            // onto the lawn by the cup. Short, and you're in the roses.
            tiles: [{ r: [-1.5, -5.5, 8, 5], ridges: [[4.5, -5.5, 4.5, 5, 1.1, 0.16], [7, -5.5, 7, 5, 0.9, 0.12]] },
                    { r: [8, -3.5, 26, 2.5], ridges: [[18, -3.5, 18, 2.5, 1.1, 0.16], [20.5, -3.5, 20.5, 2.5, 1.1, 0.16]] },
                    kick(12, 0.5, 14.5, 2.5, 's', 0, 0.6),
                    { r: [8, 2.5, 21, 9], y: -0.25, kind: 'flowers', rail: false },
                    { r: [21, 2.5, 26, 9], y: 0.21, slope: [0, 0.065], ridges: [[21, 5.75, 26, 5.75, 1.0, 0.14]] },
                    { r: [6, 9, 26, 19], y: 0.42, open: 'n', hills: [[16.5, 14.5, 2.4, 0.2], [10.5, 14.5, 1.8, -0.06]] }],
            walls: [[6, 19, 26, 19, 0.8, 'hedge'], [6, 9, 6, 19, 0.8, 'hedge']],
            path: [[23.5, 0], [23.5, 10], [16, 17]],
            props: [{ type: 'gnome', at: [10, -4.4] }, { type: 'bed', r: [8, 2.5, 21, 9], y: -0.25 }, { type: 'tree', at: [29, 6] }, { type: 'flowers', at: [16, 20.3] }, { type: 'flowers', at: [3, 6] }, { type: 'tree', at: [3, -7.5] }] },

        {   key: 'maze', name: 'THE HEDGE MAZE', sig: 'pick a hose', par: 5, tee: [0, 0], cup: [24.5, 4.6], rail: 'hedge', blockMat: 'hedge',
            // Four hedges, four turns — or a hose under them. Three hose mouths in
            // the first room, each comes out where its colour does: red back by the
            // tee, yellow halfway, green in the last room by the cup (tucked behind
            // the box hedge: bank it in off the wall).
            tiles: [{ r: [-1.5, -7, 27, 7] }, { r: [3.4, -7, 6, -5.2], y: 0.18, slope: [0.14, 0], kind: 'wood' }],
            walls: [[6, -7, 6, 3.4, 0.6, 'hedge'], [11, -3.4, 11, 7, 0.6, 'hedge'], [16, -7, 16, 3.4, 0.6, 'hedge'], [21, -3.4, 21, 7, 0.6, 'hedge']],
            blocks: [[2.4, -5.2, 6, -4.2, 0.6], [12.8, 0.2, 14.2, 1.6, 0.6], [17.8, -2.2, 19.2, -0.8, 0.6], [23.4, 0.2, 27, 1.2, 0.6]],
            pipes: [{ a: [5.2, -6.2], b: [22.6, -5.6], dir: [1, 0], r: 0.3, delay: 1.2, out: 2.4, style: 'hose', color: 0x3fbf4f },
                    { a: [5.0, 1.2], b: [12, 5.6], dir: [1, 0], r: 0.3, delay: 1.0, out: 2.4, style: 'hose', color: 0xffd23f },
                    { a: [2.6, -6.25], b: [-0.6, 5.8], dir: [1, 0], r: 0.3, delay: 0.8, out: 1.6, style: 'hose', color: 0xe8443c }],
            path: [[4, 5.2], [8.5, 4], [8.5, -5.2], [13.5, -5.2], [13.5, 5.2], [18.5, 5.2], [18.5, -5.2], [23.5, -5.2]],
            props: [{ type: 'gnome', at: [10, 7.8] }, { type: 'flowers', at: [14, -7.8] }, { type: 'tree', at: [-4, 4] }, { type: 'flowers', at: [28, 2] }] },

        {   key: 'bunker', name: 'THE BIG BUNKER', sig: 'the plank', par: 3, tee: [0, 0], cup: [23.5, 1.9],
            // The sandpit is deep. Walk the plank straight across it at the flag —
            // a hair off line and you're in the sand — or go round by the lawn on the
            // left, off the angled board and onto the green from the side.
            tiles: [{ r: [-1.5, -9, 7, 3] },
                    { r: [7, -6, 18, 6], kind: 'sand', hills: [[10.5, 2.2, 2.6, -0.45], [14.5, -2.2, 2.6, -0.45]] },
                    { r: [7, -0.3, 18, 0.3], y: 0.04, kind: 'wood', open: 'ns' },
                    { r: [7, -9, 18, -6], ridges: [[12, -9, 12, -6, 0.9, 0.12]] },
                    { r: [18, -9, 27, 6], kind: 'felt', hills: [[20.5, 3.6, 1.6, 0.18], [24.5, -5, 2.2, 0.2]] }],
            walls: [[18, -6, 20.5, -3.6, 0.3, 'wood']],
            path: [[12, -7.5], [21, -6.5]],
            props: [{ type: 'bucket', at: [12, 6.7] }, { type: 'spade', at: [9, 6.6] }, { type: 'flowers', at: [24, 6.8] }, { type: 'tree', at: [3, -11] }, { type: 'flowers', at: [29, -3] }] },

        {   key: 'pool', name: 'THE PADDLING POOL', sig: 'pick a hose', par: 4, tee: [0, 0], cup: [14, 0.6], start: 'none',
            // The cup's on the island in the middle of the pool. Three hoses run
            // under the water from the deck: blue comes up on the island, yellow on
            // the far deck by the plank, red back on the patio. Or walk it round the
            // pool's edge and putt along the plank — a putt too firm rolls off the
            // island into the water.
            tiles: [{ r: [-1.5, -4, 7, 4], kind: 'wood', open: 'e' },
                    { r: [7, -8, 21, 8], y: -0.3, kind: 'water', rail: false },
                    { r: [11.5, -2, 16.5, 2.5], open: 'nswe', hills: [[14, 0.6, 1.4, -0.06]] },
                    { r: [16.5, 0.1, 21, 1.1], kind: 'wood', open: 'ns' },
                    { r: [-1.5, -10, 27, -8] },
                    { r: [-1.5, -8, 1, -4] },
                    { r: [21, -8, 27, 8], kind: 'wood' }],
            pipes: [{ a: [6.0, 2.5], b: [12.4, 0.6], dir: [1, 0], r: 0.3, delay: 1.1, out: 1.4, style: 'hose', color: 0x3f8fe8 },
                    { a: [3.2, -3.1], b: [23.6, 0.6], dir: [-1, 0], r: 0.3, delay: 1.1, out: 1.2, style: 'hose', color: 0xffd23f },
                    { a: [3.5, 1.45], b: [-0.4, -9], dir: [1, 0], r: 0.3, delay: 0.8, out: 1.0, style: 'hose', color: 0xe8443c }],
            path: [[0, -9], [24, -7], [23, 0.6]],
            props: [{ type: 'duck', at: [9.5, 4.5] }, { type: 'duck', at: [18.5, -4.5] }, { type: 'duck', at: [17.5, 5] }, { type: 'pool', r: [7, -8, 21, 8] }, { type: 'flowers', at: [24, 9] }, { type: 'tree', at: [-4.5, 6] }] },

        {   key: 'windmill', name: 'THE GARDEN WINDMILL', sig: 'windmill or the bank', par: 3, tee: [0, 0], cup: [23.5, 1.5],
            // Up the mound and through the mill door between the sails: the chute
            // drops you on the top tier by the cup. Mistime it and the sail sends
            // you back down. Or play the lawn on the left: off the angled board and
            // up the slope onto the top tier — a bank that has to be read.
            tiles: [{ r: [-1.5, -7, 8, 3] },
                    { r: [8, -1.5, 13, 1.5], y: 0.3, slope: [0.12, 0] },
                    { r: [13, -1.5, 15, 1.5], y: 0.6 },
                    { r: [15, -1.5, 19, 1.5], y: 0.75, slope: [0.075, 0], kind: 'wood' },
                    { r: [8, -7, 19, -1.5], kind: 'rough', ridges: [[13, -7, 13, -1.5, 1.2, 0.12]] },
                    { r: [8, 1.5, 19, 4], y: -0.25, kind: 'flowers', rail: false },
                    { r: [19, -7, 27, -2.5] },
                    { r: [19, -2.5, 27, -0.5], y: 0.45, slope: [0, 0.45] },
                    { r: [19, -0.5, 27, 4], y: 0.9, open: 's', hills: [[23.5, 1.5, 1.5, -0.06]] },
                    { r: [19, 4, 27, 5.5], y: 0.65, kind: 'flowers', rail: false }],
            walls: [[19, -7, 23, -5.6, 0.4, 'wood'], [27, -7, 27, -2.5, 0.4, 'wood']],
            blocks: [[13, -1.5, 14.2, -0.55, 1.4], [13, 0.55, 14.2, 1.5, 1.4]],
            movers: [{ type: 'windmill', x: 13, z: 0, axis: 'z', w: 0.55, speed: 1.4 }],
            path: [[17, -4], [23, -4.5]],
            props: [{ type: 'flowers', at: [5, 4.3] }, { type: 'bed', r: [8, 1.5, 19, 4], y: -0.25 }, { type: 'bed', r: [19, 4, 27, 5.5], y: 0.65 }, { type: 'tree', at: [12, -9.5] }, { type: 'flowers', at: [29, 0] }, { type: 'gnome', at: [-3, -8] }] },

        {   key: 'skate', name: 'THE SKATE PARK', sig: 'drop in: gap, bowl or half-pipe', par: 4, tee: [0, 0], cup: [22.5, 4.4], start: 'none',
            // Drop in off the deck onto the street. The cup deck stands above the
            // trench beyond it — and only the ramps get you up there:
            //   · the kicker at the street's edge: gap the trench onto the deck;
            //   · the bowl (left): carve across it and up its quarter-pipe over the coping;
            //   · the half-pipe (right): carve up its wall and transfer onto the deck.
            tiles: [{ r: [-1.5, -2, 3, 2], y: 2.0, kind: 'metal' },
                    { r: [3, -2, 4.5, 2], y: 1.85, slope: [-0.2, 0], kind: 'wood' },
                    { r: [4.5, -2, 7.5, 2], y: 1.15, slope: [-0.3667, 0], kind: 'wood' },
                    { r: [7.5, -10, 14, 12], y: 0.6, kind: 'metal', open: 'e' },
                    kick(12, 0, 14, 4, 'e', 0.6, 0.6),
                    { r: [14, -10, 17, 12], y: 0.1, kind: 'metal' },
                    { r: [17, -10, 34, -4], y: 0.1, kind: 'metal', hills: [[23, -7, 2.8, -0.45], [30.5, -7, 2.2, -0.3]] },
                    { r: [17, -4, 26, -2], y: 0.85, slope: [0, 0.75], kind: 'metal' },
                    { r: [17, -2, 26, 6], y: 1.6, kind: 'wood', open: 'we', hills: [[21.5, 1, 2.4, 0.3]] },
                    { r: [17, 6, 26, 12], y: 0.1, kind: 'metal', trough: { axis: 'x', h: 1.5, flat: 0.3 } },
                    { r: [26, -4, 34, 0], y: 0.1, kind: 'metal' },
                    { r: [26, 0, 30, 4], y: 0.85, slope: [-0.375, 0], kind: 'wood' },
                    { r: [30, 0, 34, 4], y: 0.1, kind: 'metal' },
                    { r: [26, 4, 34, 12], y: 0.1, kind: 'metal' }],
            walls: [[14, 12, 34, 12, 1.6, 'metal'], [14, -10, 34, -10, 1.6, 'metal'], [34, -10, 34, 12, 1.0, 'metal']],
            path: [[15.5, -6], [32, -2], [28, 2]],
            links: [[14, 2, 18, 2]],
            props: [{ type: 'tree', at: [10, 14] }, { type: 'flowers', at: [20, -11.3] }, { type: 'gnome', at: [2, -3] }] },

        {   key: 'castle', name: 'THE BOUNCY CASTLE', sig: 'the keep: gate or bank', par: 3, tee: [0, 0], cup: [18.4, -1.3],
            // The cup's inside the keep. Its front gate opens and shuts — time it and
            // putt straight in. Or go past the keep and bank off the castle's back
            // wall (it gives: it throws you back hard) through the back door. Or the
            // slow way round, and a putt in the back.
            tiles: [{ r: [-1.5, -4.5, 8, 4.5] },
                    { r: [8, -6.5, 25, 6.5], kind: 'bouncy', railMat: 'inflatable', hills: [[18.4, -1.3, 1.0, -0.06]] }],
            walls: [[14.6, -2.6, 14.6, -0.65, 0.5, 'inflatable'], [14.6, 0.65, 14.6, 2.6, 0.5, 'inflatable'],
                    [14.6, -2.6, 19.8, -2.6, 0.5, 'inflatable'], [14.6, 2.6, 19.8, 2.6, 0.5, 'inflatable'],
                    [19.8, -2.6, 19.8, -0.9, 0.5, 'inflatable'], [19.8, 0.9, 19.8, 2.6, 0.5, 'inflatable']],
            movers: [{ type: 'gate', x: 14.6, z: 0, axis: 'z', w: 0.65, speed: 1.1 }],
            bumpers: [[9.2, -5.3, 0.55, 0.3, 0.95], [9.2, 5.3, 0.55, 0.3, 0.95], [23.8, -5.3, 0.55, 0.3, 0.95], [23.8, 5.3, 0.55, 0.3, 0.95], [22.4, 0, 0.35, 0.3, 0.95], [16.6, -0.9, 0.38, 0.3, 0.95]],
            path: [[12, 4.5], [21.5, 4.5], [21.5, 1.5]],
            props: [{ type: 'flowers', at: [4, 5.4] }, { type: 'tree', at: [4, -6.2] }, { type: 'shed', at: [28, -3] }, { type: 'flowers', at: [16, 7.6] }] },

        {   key: 'playground', name: 'THE SEE-SAW', sig: 'see-saw', par: 3, tee: [0, 0], cup: [25.5, 1.2],
            // The floor is lava. Ride the see-saw straight across — it rocks under
            // you, so the same putt runs long or dies on it — and past the swing.
            // Or the climbing frame round the edge: narrow, long, and safe.
            tiles: [{ r: [-1.5, -3, 6, 3], open: 'e' },
                    { r: [6, -8.5, 20, 5], y: -0.5, kind: 'lava', rail: false },
                    { r: [6, -1.5, 20, 1.5], y: 0.3, rail: false, kind: 'wood', tilt: { axis: 'x', amp: 0.05, speed: 0.75 } },
                    { r: [-1.5, -8.5, 6, -3] },
                    { r: [6, -8.5, 20, -6.3], kind: 'wood' },
                    { r: [20, -8.5, 29, 5], open: 'w', hills: [[23, -4.5, 2.2, 0.25]] }],
            movers: [{ type: 'slider', x: 22.3, z: 0, bar: 'z', axis: 'z', len: 2.2, amp: 2.4, speed: 1.1 }],
            path: [[3, -7.5], [19, -7.5], [23, -1]],
            props: [{ type: 'tree', at: [3, 5] }, { type: 'flowers', at: [26, 6.3] }, { type: 'flowers', at: [13, 6.3] }, { type: 'gnome', at: [-3, -9.6] }] },

        {   key: 'rockery', name: 'THE ROCKERY', sig: 'cascade and the grotto', par: 4, tee: [0, 0], cup: [12.6, 10.6],
            // Down the rock terraces, over the footbridge, and the cup's in the
            // grotto: walled on two sides, open to the bottom of the garden. Bank it
            // in off the back wall — or fly the stream off the last ledge (too long
            // and you're in the creek).
            tiles: [{ r: [-1.5, -2.5, 8, 2.5], y: 2.4, open: 'e' },
                    { r: [8, -3.5, 14, 3.5], y: 1.6, open: 'we', hills: [[11, 1.5, 1.2, 0.2]] },
                    { r: [14, -3.5, 17, 3], y: 0.8, open: 'ws' },
                    { r: [17, -3.5, 24, 3], y: 0.8, kind: 'rough' },
                    { r: [8, 3, 24, 5.5], y: -0.3, kind: 'water', rail: false },
                    { r: [17, 3, 19, 5.5], y: 0.4, slope: [0, -0.32], kind: 'wood' },
                    { r: [8, 5.5, 24, 14.5] }],
            walls: [[10.4, 8.6, 15.6, 8.6, 0.6, 'stone'], [15.6, 8.6, 15.6, 11.4, 0.6, 'stone']],
            bumpers: [[10.5, -1.6, 0.45, 0.2, 0.55], [16.2, -1.2, 0.45, 0.2, 0.55], [21, 0.6, 0.4, 0.2, 0.55], [19.5, 10, 0.5, 0.2, 0.55]],
            path: [[18, 0], [18, 4.5], [18, 13], [13, 13]],
            props: [{ type: 'rocks', at: [7, 3.8] }, { type: 'rocks', at: [13, -4.6] }, { type: 'tree', at: [5, 9] }, { type: 'shed', at: [27.5, 10] }, { type: 'flowers', at: [16, 15.6] }] },
    ],
};

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'jump-bed',   course: 'backyard', key: 'gardenpath', name: 'Jump the Flower Bed',   from: [13.25, -3],  zone: [6, 9, 15, 19] },
    { id: 'blue-hose',  course: 'backyard', key: 'pool',       name: 'Find the Blue Hose',    from: [0, 0],       zone: [11.5, -2, 16.5, 2.5] },
    { id: 'rock-drop',  course: 'backyard', key: 'rockery',    name: 'Off the Top Rock',      from: [6, 0],       zone: [8, 5.5, 24, 14.5] },
    { id: 'hp-transfer', course: 'backyard', key: 'skate',     name: 'Half-Pipe Transfer',    from: [21, 9],      zone: [20, 2.5, 25, 6] },
    { id: 'bowl-carve', course: 'backyard', key: 'skate',      name: 'Carve Out of the Bowl', from: [22, -7],     zone: [17, -2, 26, 6] },
    { id: 'keep-bank',  course: 'backyard', key: 'castle',     name: 'In the Back Door',      from: [22, 4.5],    zone: [14.6, -2.6, 19.8, 2.6] },
];
