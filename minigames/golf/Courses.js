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

/**
 * A kicker ramp: a short steep slope that throws the ball, open at both ends
 * of its run so it launches off the top. `dir` is the way it throws (e/w/s/n).
 */
const kick = (x0, z0, x1, z1, dir, y0 = 0, g = 0.45) => {
    const alongX = dir === 'e' || dir === 'w', s = dir === 'e' || dir === 's' ? 1 : -1, len = alongX ? x1 - x0 : z1 - z0;
    return { r: [x0, z0, x1, z1], y: y0 + g * len / 2, slope: alongX ? [g * s, 0] : [0, g * s], kind: 'wood', open: alongX ? 'we' : 'ns', kick: true };
};

// ── BACKYARD — someone's garden on a summer afternoon ───────────────────────
const BACKYARD = {
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

        {   key: 'maze', name: 'THE HEDGE MAZE', sig: 'maze', par: 6, tee: [0, 0], cup: [20.5, 3.5], rail: 'hedge', blockMat: 'hedge',
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

        {   key: 'skate', name: 'THE SKATE PARK', sig: 'half-pipe', par: 4, tee: [0, 0], cup: [16, 22.5],
            // Two half-pipes round the corner, into the bowl.
            tiles: [{ r: [-1.5, -2, 14, 2], trough: { axis: 'x', h: 0.9, flat: 0.25 } },
                    { r: [14, -2, 18, 6] },
                    { r: [14, 6, 18, 20], trough: { axis: 'z', h: 0.9, flat: 0.25 } },
                    { r: [12, 20, 20, 25], kind: 'felt', hills: [[16, 22.5, 3.4, -0.3]] }],
            path: [[16, 0], [16, 6]],
            props: [{ type: 'flag', at: [10, 2.6] }, { type: 'tree', at: [9, 12] }, { type: 'flowers', at: [21, 10] }] },

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

// ── PIRATE COVE — a smugglers' island ───────────────────────────────────────
const PIRATE = {
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

        {   key: 'wheel', name: 'THE SHIP\'S WHEEL', sig: 'turntable', par: 4, tee: [0, 0], cup: [23.5, 1.2],
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

        {   key: 'shark', name: 'SHARK BAY', sig: 'drawbridge', par: 4, tee: [0, 0], cup: [22, 1.5],
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

// ── CANDY LAND — mint frosting, chocolate rivers, gumdrops and a donut loop ──
const CANDY = {
    key: 'candy', name: 'CANDY LAND', blurb: 'The sugar rink, gumball plinko, the chocolate river, the candy-cane slide and the lollipop spinner.',
    theme: {
        sky: 0xffc9e6, ground: 0xe56aa4, turf: [0x55c995, 0x4bbb88], edge: 0x6b3b1f, rail: 0xffffff, railTex: 'cane',
        sand: 0xd08a2e, goo: 0x5a3218, water: 0x5a3218, ice: 0x8fd0f2, wood: 0xe9b866, block: 0xff6fae, accent: 0xff3b6b, fog: 0xffc9e6,
        bumper: 0xff5fa2, sweeper: 0xff3b6b, slider: 0x8a5cf6, flag: 0xff3b6b, pipe: 0xb8f2e6, sail: 0xfff3fa, tee: 0xffffff, loop: 0xf9a8d4,
        felt: 0x4fbf8a, creek: 0x7a4a26, jelly: 0xff4fa0, kick: 0xff3b6b,
        scenery: 'candy',
    },
    holes: [
        {   key: 'rink', name: 'THE SUGAR RINK', sig: 'ice rink', par: 3, tee: [0, 0], cup: [26, 0], rail: 'candy',
            // Ice: the ball skids a long way before it grabs. Gumdrops to bank off.
            tiles: [{ r: [-1.5, -2, 6, 2] }, { r: [6, -5, 22, 5], kind: 'ice' }, { r: [22, -2, 28, 2], kind: 'felt' }],
            bumpers: [[14, -3.6, 0.5], [14, 3.6, 0.5], [18.5, 0, 0.45, 1.2]],
            props: [{ type: 'cupcake', at: [14, 6.4] }, { type: 'lollipop', at: [4, -3] }] },

        {   key: 'plinko', name: 'GUMBALL PLINKO', sig: 'plinko drop', par: 3, tee: [0, 0], cup: [33.4, 0], rail: 'candy',
            // Tip it off the top shelf and down the long board through a forest of
            // gumdrop pegs. Every peg knocks it a little off true: where it lands
            // is anyone's guess. Five slots at the bottom — the middle one has the
            // cup, the two beside it send you back up to the top to drop again (once a shot),
            // and the rest run on into the tray behind, leaving a putt to the cup.
            tiles: [{ r: [-1.5, -2.5, 4, 2.5], y: 12.39 },
                    { r: [4, -5, 30, 5], y: 6.54, slope: [-0.45, 0], kind: 'ice' },
                    { r: [30, -5, 34.5, 5], y: 0.625, slope: [-0.06, 0], kind: 'felt' }],
            bumpers: (() => {
                const out = [];
                for (let row = 0; row < 11; row++) {
                    // Staggered rows; the outside pegs hug the rails so nothing slides down the edge.
                    const x = 6.6 + row * 2.05, n = row % 2 ? 9 : 10, z0 = row % 2 ? -4.2 : -4.725;
                    for (let k = 0; k < n; k++) out.push([x, +(z0 + k * 1.05).toFixed(3), 0.17, 0, 0.82, 0.38]);
                }
                return out;
            })(),
            // The slots: short dividers, then a common tray behind them that runs down to the cup.
            walls: [[30.3, -2.6, 32.4, -2.6, 0.5], [30.3, -1, 32.4, -1, 0.5], [30.3, 1, 32.4, 1, 0.5], [30.3, 2.6, 32.4, 2.6, 0.5],
                    [31.6, -2.6, 31.6, -1, 0.5], [31.6, 1, 31.6, 2.6, 0.5]],
            rollMax: 45,
            pipes: [{ a: [31.0, -1.8], b: [5.3, -1.7], dir: [1, 0], r: 0.7, delay: 0.7, out: 1.2, style: 'teleport', max: 1 },
                    { a: [31.0, 1.8], b: [5.3, 1.7], dir: [1, 0], r: 0.7, delay: 0.7, out: 1.2, style: 'teleport', max: 1 }],
            path: [[5, 0], [30, 0], [31, 0]],
            props: [{ type: 'gumballs', at: [1.5, -3.6] }, { type: 'lollipop', at: [33, 6.4] }, { type: 'lollipop', at: [33, -6.4] }] },

        {   key: 'river', name: 'THE CHOCOLATE RIVER', sig: 'current', par: 3, tee: [0, 0], cup: [22, -1.5], rail: 'candy',
            // The current carries you toward the goo. Ride it across — or jump it
            // from the wafer ramp.
            tiles: [{ r: [-1.5, -2, 8, 2] },
                    kick(6.4, -2, 8, -1, 'e'),
                    { r: [8, -6, 13, 6], y: -0.05, kind: 'creek', flow: [0, 2.4], open: 's' },
                    { r: [8, 6, 13, 9], y: -0.6, kind: 'goo', rail: false },
                    { r: [13, -3, 24, 3] }],
            props: [{ type: 'cookie', at: [10.5, -7] }, { type: 'cookie', at: [15, 4] }, { type: 'cupcake', at: [24.8, 4] }] },

        {   key: 'donut', name: 'THE DONUT LOOP', sig: 'loop or the glass lane', par: 3, tee: [0, 0], cup: [24, -0.8], rail: 'candy',
            // Loop the donut at speed, or take the sugar-glass lane beside it (slick: easy to overcook).
            tiles: [{ r: [-1.5, -1.5, 9, 1.5], y: 0.16, slope: [-0.03, 0] }, { r: [9, -1.5, 26, 1.5], hills: [[19.5, -0.5, 1.3, 0.24]] },
                    { r: [9, 1.5, 20, 2.7], kind: 'ice' }, { r: [20, 1.5, 26, 2.7] }],
            walls: [[10.2, 1.5, 19.8, 1.5]],
            bumpers: [[22, 0.4, 0.14, 0, 0.6], [22.5, -0.3, 0.14, 0, 0.6]],
            loops: [{ a: [9.5, 0], dir: [1, 0], len: 3.5, minV: 6, w: 0.9 }],
            props: [{ type: 'cupcake', at: [3, 2.4] }, { type: 'lollipop', at: [16, -2.4] }] },

        {   key: 'jelly', name: 'JELLY JUMP', sig: 'jelly pads', par: 3, tee: [0, 0], cup: [22, 0], rail: 'candy',
            // Bounce over the walls on the jelly pads.
            tiles: [{ r: [-1.5, -2, 5.5, 2] }, { r: [5.5, -2, 7, 2], kind: 'jelly' }, { r: [7, -2, 12.5, 2] },
                    { r: [12.5, -2, 14, 2], kind: 'jelly' }, { r: [14, -2, 24, 2], hills: [[22, 0, 1.4, -0.08]] }],
            walls: [[9, -2, 9, 2, 0.5, 'candy'], [16, -2, 16, 2, 0.5, 'candy']],
            links: [[6.25, 0, 10, 0], [13.25, 0, 17, 0]],
            props: [{ type: 'gumdrop', at: [9, -2.8] }, { type: 'gumdrop', at: [16, 2.8] }] },

        {   key: 'slide', name: 'THE CANDY-CANE SLIDE', sig: 'corkscrew', par: 3, tee: [0, 0], cup: [23, 1], rail: 'candy',
            // Tee off from the top of the cake. Down the candy-cane slide — or
            // straight off the edge, over the chocolate, onto the green below.
            tiles: [{ r: [-1.5, -2, 6, 2], y: 3, open: 'e' },
                    { r: [6, -3, 11, 3], y: -0.6, kind: 'goo', rail: false },
                    { r: [11, -3, 25, 3], hills: [[23, 1, 1.4, -0.08]] }],
            loops: [{ a: [5.2, 0], dir: [1, 0], len: 1, w: 0.7, minV: 1.2, style: 'corkscrew', b: [12, -1.8], out: [1, 0.15], outV: 3.0, dur: 1.8 }],
            bumpers: [[16.5, -1.2, 0.4, 0.8], [16.5, 1.4, 0.4, 0.8], [19.6, -0.4, 0.35, 0.8]],
            links: [[5.2, 0, 12, -1.8]],
            props: [{ type: 'cupcake', at: [2, 3.2] }, { type: 'cane', at: [14, -3.6] }, { type: 'lollipop', at: [25.8, -3.2] }] },

        {   key: 'spinner', name: 'THE LOLLIPOP SPINNER', sig: 'spinner', par: 3, tee: [0, 0], cup: [16, 0], rail: 'candy',
            // The cup sits in the middle of a turning ring of candy baffles. Time
            // the gap, or bank in off the walls.
            tiles: [{ r: [-1.5, -2, 10, 2] }, { r: [10, -5, 22, 5], hills: [[16, 0, 1.0, -0.06]] }],
            movers: [{ type: 'sweeper', x: 16, z: 0, r0: 1.2, len: 2.6, arms: 6, speed: 0.9, mat: 'candy' }],
            bumpers: [[11.5, -3.6, 0.4], [11.5, 3.6, 0.4], [20.6, -3.6, 0.4], [20.6, 3.6, 0.4]],
            props: [{ type: 'lollipop', at: [5, 3] }, { type: 'gumdrop', at: [23, -5.8] }, { type: 'cupcake', at: [23.3, 5.6] }] },

        {   key: 'mountain', name: 'CUPCAKE MOUNTAIN', sig: 'volcano', par: 3, tee: [0, 0], cup: [16, 0], rail: 'candy',
            tiles: [{ r: [-1.5, -3, 10, 3] }, { r: [10, -6, 22, 6], hills: [[16, 0, 5.6, 1.4], [16, 0, 1.2, -0.35]] }],
            props: [{ type: 'cherry', at: [23.2, 7] }, { type: 'lollipop', at: [22.8, -6.4] }] },

        {   key: 'tower', name: 'THE CAKE TOWER', sig: 'spiral climb', par: 5, tee: [0, 0], cup: [19, 11.5], rail: 'candy',
            tiles: [{ r: [-1.5, -2, 12, 2] },
                    { r: [12, -2, 16, 2], y: 0.4, slope: [0.2, 0], kind: 'wood' },
                    { r: [16, -2, 20, 8], y: 0.8 },
                    { r: [8, 4, 16, 8], y: 1.2, slope: [-0.1, 0], kind: 'wood' },
                    { r: [4, 4, 8, 12], y: 1.6 },
                    { r: [8, 8, 16, 12], y: 2.0, slope: [0.1, 0], kind: 'wood' },
                    { r: [16, 8, 22, 14], y: 2.4, kind: 'felt' }],
            bumpers: [[18, 3, 0.45], [6, 8, 0.45]],
            path: [[18, 0], [18, 6], [6, 6], [6, 10]],
            props: [{ type: 'cherry', at: [23.5, 14.5] }, { type: 'cupcake', at: [2, -3.2] }] },
    ],
};

// ── SPACE STATION — panels in orbit: fall off the edge and you're gone ──────
const SPACE = {
    key: 'space', name: 'SPACE STATION', blurb: 'The anti-grav lift, teleporters, a minefield, moon jumps, lasers, magnets, airlocks, cargo belts and the solar wind.',
    theme: {
        sky: 0x05060f, ground: null, turf: [0x2c3170, 0x262b64], edge: 0x9aa3b5, rail: 0x22d3ee, railGlow: true,
        sand: 0x9a9aa8, water: 0x22d3ee, boost: 0xfacc15, wood: 0x6b7280, block: 0x4b5563, accent: 0xf472b6, fog: 0x05060f,
        bumper: 0x8b5cf6, sweeper: 0xf43f5e, slider: 0xef4444, flag: 0x22d3ee, pipe: 0xa855f7, sail: 0xc7d2fe, tee: 0x111827, loop: 0x22d3ee,
        felt: 0x343a86, conveyor: 0x374151, moon: 0x9ca3af, kick: 0xfacc15, mine: 'spike',
        windmill: 'airlock', scenery: 'space',
    },
    holes: [
        {   key: 'liftoff', name: 'THE ANTI-GRAV LIFT', sig: 'anti-grav lift', par: 4, tee: [0, 0], cup: [22, 0], rail: 'neon',
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

        {   key: 'cargo', name: 'THE CARGO BAY', sig: 'conveyor belts', par: 5, tee: [0, 0], cup: [24.5, -3], rail: 'neon', blockMat: 'metal',
            tiles: [{ r: [-1.5, -6, 6, 6] },
                    { r: [6, -6, 9, 6], kind: 'conveyor', flow: [0, 3] },
                    { r: [9, -6, 12, 6] },
                    { r: [12, -6, 15, 6], kind: 'conveyor', flow: [0, -3.5] },
                    { r: [15, -6, 18, 6] },
                    { r: [18, -6, 21, 6], kind: 'conveyor', flow: [0, 2.5] },
                    { r: [21, -6, 27, 6] }],
            blocks: [[10, 3, 11, 4, 0.6], [16, -4, 17, -3, 0.6], [22.5, 1, 23.5, 2, 0.6]],
            props: [{ type: 'crate', at: [3, 6.8] }, { type: 'crate', at: [25, 6.8] }] },

        {   key: 'wind', name: 'THE SOLAR WIND', sig: 'fans', par: 4, tee: [0, 0], cup: [28, 2], rail: 'neon',
            tiles: [{ r: [-1.5, -3, 6, 3] }, { r: [6, -0.9, 22, 0.9], open: 'ns', kind: 'felt' }, { r: [22, -4, 30, 4] }],
            fans: [{ r: [8, -3.5, 12, 3.5], f: [0, 4.5] }, { r: [15, -3.5, 19, 3.5], f: [0, -4.5] }],
            props: [{ type: 'fan', at: [10, -3.6], dir: 1 }, { type: 'fan', at: [17, 3.6], dir: -1 }, { type: 'planet', at: [16, 18] }] },
    ],
};

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
const NO_OPENING = new Set(['plinko', 'rockery']);   // these start high already
function _opening(h, course, i) {
    const O = OPENINGS[course], X = -1.5;
    const t0 = h.tiles.find(t => t.r[0] === X && t.r[1] <= h.tee[1] && t.r[3] >= h.tee[1] && !t.y && !t.slope && !t.move && !t.tilt && !t.elev);
    if (!O || !t0 || NO_OPENING.has(h.key) || h.tee[0] !== 0) return h;
    const [style, H] = O.styles[i % O.styles.length];
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

export const COURSES = [BACKYARD, PIRATE, CANDY, SPACE].map(c => ({ ...c, holes: c.holes.map((h, i) => _opening(h, c.key, i)) }));

/**
 * Trick shots: one ball from a set spot, three goes. In if it stops in the box
 * (`zone`, [x0, z0, x1, z1]) or drops. Each was searched in the physics for a
 * window that exists but is narrow (Lint keeps the holes clean; a script played
 * every angle and power from the spot): roughly 1–6% of all directions and
 * strengths land it, far more if you aim the right way.
 */
export const CHALLENGES = [
    { id: 'jump-bed',   course: 'backyard', key: 'gardenpath', name: 'Jump the Flower Bed',   from: [14.25, -1.2], zone: [12, 8, 21, 14] },
    { id: 'pool-leap',  course: 'backyard', key: 'pool',       name: 'Over the Paddling Pool', from: [7, -1.45],    zone: [18, -3, 26, 3] },
    { id: 'rock-drop',  course: 'backyard', key: 'rockery',    name: 'Off the Top Rock',      from: [6, 0],        zone: [12, 5.5, 22, 13] },
    { id: 'shark-jump', course: 'pirate',   key: 'shark',      name: 'Jump the Sharks',       from: [6, 1.45],     zone: [14, -2.5, 26, 4] },
    { id: 'kegs',       course: 'pirate',   key: 'powder',     name: 'Thread the Kegs',       from: [0, 0],        zone: [20, -2.5, 26, 2.5] },
    { id: 'tentacles',  course: 'pirate',   key: 'kraken',     name: 'Past the Kraken',       from: [4, 0],        zone: [24, -2.5, 30, 2.5] },
    { id: 'cake-drop',  course: 'candy',    key: 'slide',      name: 'Off the Cake',          from: [3, 1],        zone: [19, -3, 25, 3] },
    { id: 'choc-jump',  course: 'candy',    key: 'river',      name: 'Jump the Chocolate',    from: [5.5, -1.5],   zone: [13, -3, 24, 3] },
    { id: 'spin-gap',   course: 'candy',    key: 'spinner',    name: 'Through the Spinner',   from: [6, 0],        zone: [14.6, -1.2, 17.4, 1.2] },
    { id: 'moon-jump',  course: 'space',    key: 'moon',       name: 'Moon Jump',             from: [8, -0.3],     zone: [15, -4, 26, 4] },
    { id: 'sling',      course: 'space',    key: 'magnets',    name: 'Planet Slingshot',      from: [0, 0],        zone: [23, -1, 28, 4] },
    { id: 'mines',      course: 'space',    key: 'belt',       name: 'Minefield Run',         from: [0, 0],        zone: [21, -3, 26, 3] },
];
export const COURSE_KEYS = COURSES.map(c => c.key);
export const courseByKey = k => COURSES.find(c => c.key === k) || COURSES[0];
/** Every hole of every course, as [courseKey, hole]. */
export const ALL_HOLES = () => COURSES.flatMap(c => c.holes.map(h => [c.key, h]));
export const coursePar = c => c.holes.reduce((a, h) => a + h.par, 0);
