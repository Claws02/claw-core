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
        {   key: 'gardenpath', name: 'THE GARDEN PATH', sig: 'whoops', par: 4, tee: [0, 0], cup: [14, 11.5],
            // Down the path over the whoops, round and up onto the raised lawn —
            // or putt up the little ramp and jump the flower bed.
            tiles: [{ r: [-1.5, -2, 21, 2], ridges: [[4, -2, 4, 2, 1.1, 0.15], [6.5, -2, 6.5, 2, 1.1, 0.15], [9, -2, 9, 2, 1.1, 0.15]] },
                    kick(13, 0.4, 15.5, 2, 's'),
                    { r: [12, 2, 17, 8], y: -0.25, kind: 'flowers', rail: false },
                    { r: [17, 2, 21, 8], y: 0.21, slope: [0, 0.07] },
                    { r: [12, 8, 21, 14], y: 0.42, hills: [[13, 13, 1.4, 0.18]] }],
            path: [[19, 0], [19, 9]],
            props: [{ type: 'gnome', at: [7, -2.9] }, { type: 'flowers', at: [9, 2.9] }, { type: 'bed', r: [12, 2, 17, 8], y: -0.25 }, { type: 'tree', at: [24, 5] }, { type: 'flowers', at: [16, 15] }] },

        {   key: 'maze', name: 'THE HEDGE MAZE', sig: 'maze', par: 5, tee: [0, 0], cup: [20.5, 3.5], rail: 'hedge', blockMat: 'hedge',
            // Five corridors — or the rabbit hole in the first one's dead end.
            tiles: [{ r: [-1.5, -6, 23, 6] }],
            walls: [[4, -6, 4, 2.5, 0.6, 'hedge'], [8, -2.5, 8, 6, 0.6, 'hedge'], [12, -6, 12, 0.8, 0.6, 'hedge'], [12, 3.2, 12, 6, 0.6, 'hedge'], [16, -3.6, 16, 6, 0.6, 'hedge']],
            blocks: [[5.5, -4, 6.5, -3, 0.6], [13.5, 3.8, 14.5, 4.8, 0.6], [18.5, -1, 19.5, 0, 0.6]],
            pipes: [{ a: [1.6, -5.2], b: [10, -5], dir: [1, 0], r: 0.28, delay: 1.0, out: 2.2, style: 'burrow' }],
            path: [[4, 4.3], [8, -4.3], [12, 2], [16, -4.8]],
            props: [{ type: 'gnome', at: [10, 6.8] }, { type: 'flowers', at: [14, -6.8] }, { type: 'tree', at: [-4, 4] }] },

        {   key: 'bunker', name: 'THE BIG BUNKER', sig: 'bunker', par: 3, tee: [0, 0], cup: [21, 0.6],
            // Round the bunker's edge, or straight down the plank across it.
            tiles: [{ r: [-1.5, -3, 8, 3] },
                    { r: [8, -3, 16, 3], kind: 'sand', hills: [[12, 0.6, 3.4, -0.5]] },
                    { r: [8, -2.7, 16, -1.9], y: 0.05, kind: 'wood', open: 'ns' },
                    { r: [16, -3, 24, 3], kind: 'felt', hills: [[21, 0.6, 2.2, 0.12]] }],
            props: [{ type: 'bucket', at: [12, -3.7] }, { type: 'spade', at: [13, 3.6] }, { type: 'flowers', at: [20, 3.7] }] },

        {   key: 'pool', name: 'THE PADDLING POOL', sig: 'island bridges', par: 6, tee: [0, 0], cup: [24, -1.5],
            // Two narrow bridges by way of the island — or the ramp at the pool's
            // edge, all the way over the water.
            tiles: [{ r: [-1.5, -2, 8, 2] },
                    kick(6.3, -2, 8, -0.9, 'e'),
                    { r: [8, -5, 18, 5], y: -0.3, kind: 'water', rail: false },
                    { r: [8, -0.7, 12, 0.7], kind: 'wood', open: 'ns' },
                    { r: [12, -2.5, 15, 2.5] },
                    { r: [15, 1.1, 18, 2.5], kind: 'wood', open: 'ns' },
                    { r: [18, -3, 26, 3] }],
            bumpers: [[13.5, -1.4, 0.4, 0.4, 0.95]],
            path: [[13.5, 0], [13.5, 1.75], [18.5, 1.75]],
            props: [{ type: 'duck', at: [10, 2.5] }, { type: 'duck', at: [16.5, -2.5] }, { type: 'pool', r: [8, -5, 18, 5] }, { type: 'flowers', at: [22, 3.8] }] },

        {   key: 'windmill', name: 'THE GARDEN WINDMILL', sig: 'windmill or the hedge path', par: 3, tee: [0, 0], cup: [24, 1],
            // Up the mound to the mill, through the door between the sails, and
            // down the chute onto the sunken green — or skip the mill down the
            // rough path along the hedge, round the sprinkler post.
            tiles: [{ r: [-1.5, -3.8, 8, 2.5] },
                    { r: [8, -3.8, 19, -2.5], kind: 'rough' },
                    { r: [8, -2.5, 13, 2.5], y: 0.3, slope: [0.12, 0] },
                    { r: [13, -2.5, 16, 2.5], y: 0.6 },
                    { r: [16, -2.5, 19, 2.5], y: 0.3, slope: [-0.2, 0] },
                    { r: [19, -3.8, 27, 3.5], hills: [[22, -1.6, 1.4, 0.18]] }],
            blocks: [[13, -2.5, 14.2, -0.55, 1.2], [13, 0.55, 14.2, 2.5, 1.2]],
            movers: [{ type: 'windmill', x: 13, z: 0, axis: 'z', w: 0.55, speed: 1.4 }],
            props: [{ type: 'flowers', at: [6, 3.2] }, { type: 'flowers', at: [24, -5.2] }, { type: 'tree', at: [17, 6] }] },

        {   key: 'skate', name: 'THE SKATE PARK', sig: 'drop in, gap it, or go round', par: 4, tee: [0, 0], cup: [24.6, -2.7],
            // Three levels: the street, the bowl sunk below it, and the deck up top with the cup.
            //   · drop in to the bowl and hit the quarter-pipe hard enough to ride it up onto the deck;
            //   · or launch off the kicker at the street's edge and gap the whole bowl;
            //   · or the long way: down the side street and up the ramp to the deck's back corner.
            tiles: [{ r: [-1.5, -3, 9, 3], kind: 'metal', open: 'e' },
                    kick(9, -1, 11, 1, 'e', 0, 0.7),
                    { r: [9, -3, 17, 3], y: -0.6, kind: 'metal', trough: { axis: 'x', h: 0.4, flat: 0.45 }, open: 'w' },
                    { r: [17, -1.5, 21, 1.5], y: 0.4, slope: [0.5, 0], kind: 'wood' },
                    { r: [5, 3, 21, 5], kind: 'metal' },
                    { r: [21, 3, 26, 5], y: 0.7, slope: [0.28, 0], kind: 'wood' },
                    { r: [26, 3, 28, 5], y: 1.4, kind: 'felt' },
                    { r: [21, -4, 28, 3], y: 1.4, kind: 'felt', hills: [[24.6, -2.7, 1.2, -0.06]] }],
            path: [[19, 0], [21.5, 0]],
            links: [[11, 0, 21.4, 0]],
            props: [{ type: 'flag', at: [3, -3.8] }, { type: 'tree', at: [12, 8] }, { type: 'flowers', at: [24, -5] }] },

        {   key: 'castle', name: 'THE BOUNCY CASTLE', sig: 'bouncy castle', par: 3, tee: [0, 0], cup: [19.5, 0],
            // Everything gives: the castle's walls throw the ball back hard, the
            // turrets squash, and a slide wall guards the cup. Bank it in.
            tiles: [{ r: [-1.5, -2, 9, 2] },
                    { r: [9, -5, 22, 5], kind: 'bouncy', railMat: 'inflatable', hills: [[19.5, 0, 1.6, -0.1]] }],
            walls: [[16.4, -1.6, 16.4, 1.6, 0.5, 'inflatable']],
            bumpers: [[11.2, -3.4, 0.55, 0.3, 0.95], [11.2, 3.4, 0.55, 0.3, 0.95], [20.4, -3.6, 0.5, 0.3, 0.95], [20.4, 3.6, 0.5, 0.3, 0.95], [14, 0, 0.4, 0.3, 0.95]],
            props: [{ type: 'flowers', at: [4, 2.9] }, { type: 'tree', at: [6, -5] }, { type: 'shed', at: [26, -2] }] },

        {   key: 'playground', name: 'THE SEE-SAW', sig: 'see-saw', par: 3, tee: [0, 0], cup: [22.5, 0],
            // The floor is lava. Ride the see-saw across when its end comes down
            // to you — or take the long way round on the climbing frame.
            tiles: [{ r: [-1.5, -2, 7, 2], open: 'e' },
                    { r: [7, -4, 19, 3.2], y: -0.5, kind: 'lava', rail: false },
                    { r: [7, -1.1, 19, 1.1], y: 0.3, rail: false, kind: 'wood', tilt: { axis: 'x', amp: 0.045, speed: 0.8 } },
                    { r: [5, 2, 7, 4], kind: 'wood' },
                    { r: [7, 3.2, 19, 4], kind: 'wood' },
                    { r: [19, 3, 21, 4], kind: 'wood' },
                    { r: [19, -3, 26, 3], open: 'w' }],
            path: [[6, 3], [20, 3]],
            props: [{ type: 'tree', at: [3, -5] }, { type: 'flowers', at: [24, 4] }, { type: 'flowers', at: [12, -5] }] },

        {   key: 'rockery', name: 'THE ROCKERY', sig: 'cascade', par: 4, tee: [0, 0], cup: [17, 11.5],
            // Down the rock terraces to the stream: over the footbridge, or let it
            // fly off the last ledge and clear the water.
            tiles: [{ r: [-1.5, -2.5, 8, 2.5], y: 2.4, open: 'e' },
                    { r: [8, -3, 14, 3], y: 1.6, open: 'we', hills: [[11, 1.5, 1.2, 0.2]] },
                    { r: [14, -3, 20, 3], y: 0.8, open: 'ws' },
                    { r: [12, 3, 22, 5.5], y: -0.3, kind: 'water', rail: false },
                    { r: [16, 3, 18, 5.5], y: 0.4, slope: [0, -0.32], kind: 'wood' },
                    { r: [12, 5.5, 22, 13] }],
            bumpers: [[9.5, -1.6, 0.45, 0.2, 0.55], [16, -1.2, 0.45, 0.2, 0.55]],
            movers: [{ type: 'slider', x: 17, z: 8, bar: 'x', axis: 'x', len: 2.2, amp: 2.4, speed: 1.0 }],
            path: [[17, 0], [17, 4.5]],
            props: [{ type: 'rocks', at: [7, 3.6] }, { type: 'rocks', at: [13, -4.2] }, { type: 'tree', at: [6, 9] }, { type: 'shed', at: [25.5, 9] }] },
    ],
};

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'jump-bed',   course: 'backyard', key: 'gardenpath', name: 'Jump the Flower Bed',   from: [14.25, -1.2], zone: [12, 8, 21, 14] },
    { id: 'pool-leap',  course: 'backyard', key: 'pool',       name: 'Over the Paddling Pool', from: [7, -1.45],    zone: [18, -3, 26, 3] },
    { id: 'rock-drop',  course: 'backyard', key: 'rockery',    name: 'Off the Top Rock',      from: [6, 0],        zone: [12, 5.5, 22, 13] },
];
