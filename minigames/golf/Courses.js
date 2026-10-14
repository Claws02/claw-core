// ============================================================
// GOLF COURSES — the holes, as data. Physics.compile() reads them; Build.js
// draws them in the course's theme. Nothing here knows THREE.
//
// A hole (see Physics.compile for every field):
//   name, par, tee [x, z], cup [x, z], sig: the hole's own centrepiece
//   tiles   floor: { r: [x0, z0, x1, z1], y, slope, hills, ridges, trough, kind, open, flow, spin, move, lift }
//   path    waypoints from the tee to the cup, round the corners (bots, cameras)
//   walls, blocks, bumpers, movers, fans, magnets, pipes, loops   (all optional)
//   props   scenery only, drawn by the theme: { type, at: [x, z], ... }
//
// Every hole is built round a centrepiece ("sig") that no other hole in the
// game is built round: rails, slopes and the odd bumper recur, the idea of
// the hole doesn't. Holes are 25–40 long, in two to four parts, so most take
// more than one full putt.
// ============================================================

// ── BACKYARD — someone's garden on a summer afternoon ───────────────────────
const BACKYARD = {
    key: 'backyard', name: 'BACKYARD', blurb: 'A summer garden: the hedge maze, the bunker, the paddling pool, the skate park and the rockery.',
    theme: {
        sky: 0x8ccbf0, ground: 0x45903a, turf: [0x3aa346, 0x31933d], edge: 0x8a5a2b, rail: 0xf3e9d2,
        sand: 0xead39b, water: 0x4fb4ec, wood: 0xb7814a, block: 0x2f7d3a, accent: 0xff7a59, fog: 0x8ccbf0,
        felt: 0x2f9a45, puddle: 0x7cc4ea, pipe: 0x2e9e57,
        scenery: 'backyard',
    },
    holes: [
        {   key: 'gardenpath', name: 'THE GARDEN PATH', sig: 'whoops', par: 3, tee: [0, 0], cup: [15, 10.5],
            tiles: [{ r: [-1.5, -2, 17, 2], ridges: [[5, -2, 5, 2, 1.1, 0.15], [8, -2, 8, 2, 1.1, 0.15], [11, -2, 11, 2, 1.1, 0.15]] },
                    { r: [13, 2, 17, 13], slope: [0, -0.015] }],
            path: [[15, 0]],
            props: [{ type: 'gnome', at: [8, -2.8] }, { type: 'flowers', at: [3, 2.8] }, { type: 'flowers', at: [11, 2.8] }, { type: 'tree', at: [9, 8] }] },

        {   key: 'maze', name: 'THE HEDGE MAZE', sig: 'maze', par: 5, tee: [0, 0], cup: [20.5, 3.5], rail: 'hedge', blockMat: 'hedge',
            tiles: [{ r: [-1.5, -6, 23, 6] }],
            walls: [[4, -6, 4, 2.5, 0.6, 'hedge'], [8, -2.5, 8, 6, 0.6, 'hedge'], [12, -6, 12, 0.8, 0.6, 'hedge'], [12, 3.2, 12, 6, 0.6, 'hedge'], [16, -3.6, 16, 6, 0.6, 'hedge']],
            blocks: [[5.5, -4, 6.5, -3, 0.6], [13.5, 3.8, 14.5, 4.8, 0.6], [18.5, -1, 19.5, 0, 0.6]],
            path: [[4, 4.3], [8, -4.3], [12, 2], [16, -4.8]],
            props: [{ type: 'gnome', at: [10, 4.5] }, { type: 'flowers', at: [14, -5] }] },

        {   key: 'bunker', name: 'THE BIG BUNKER', sig: 'bunker', par: 3, tee: [0, 0], cup: [21, 0.6],
            tiles: [{ r: [-1.5, -3, 8, 3] },
                    { r: [8, -3, 16, 3], kind: 'sand', hills: [[12, 0, 3.6, -0.5]] },
                    { r: [16, -3, 24, 3], kind: 'felt', hills: [[21, 0.6, 2.2, 0.12]] }],
            props: [{ type: 'bucket', at: [12, -3.6] }, { type: 'spade', at: [13, 3.6] }, { type: 'flowers', at: [20, 3.5] }] },

        {   key: 'pool', name: 'THE PADDLING POOL', sig: 'island bridges', par: 5, tee: [0, 0], cup: [24, -1.5],
            tiles: [{ r: [-1.5, -2, 8, 2] },
                    { r: [8, -5, 18, 5], y: -0.3, kind: 'water', rail: false },
                    { r: [8, -0.7, 12, 0.7], kind: 'wood', open: 'ns' },
                    { r: [12, -2.5, 15, 2.5] },
                    { r: [15, 1.1, 18, 2.5], kind: 'wood', open: 'ns' },
                    { r: [18, -3, 26, 3] }],
            path: [[13.5, 0], [13.5, 1.75], [18.5, 1.75]],
            props: [{ type: 'duck', at: [10, 2.5] }, { type: 'duck', at: [16.5, -2.5] }, { type: 'pool', r: [8, -5, 18, 5] }] },

        {   key: 'windmill', name: 'THE GARDEN WINDMILL', sig: 'windmill', par: 3, tee: [0, 0], cup: [24, 1],
            tiles: [{ r: [-1.5, -2.5, 13, 2.5], slope: [0.015, 0] }, { r: [13, -2.5, 26, 2.5], y: 0.109, hills: [[19.5, -0.8, 1.6, 0.25]] }],
            blocks: [[13, -2.5, 14.2, -0.55, 1.2], [13, 0.55, 14.2, 2.5, 1.2]],
            movers: [{ type: 'windmill', x: 13, z: 0, axis: 'z', w: 0.55, speed: 1.4 }],
            props: [{ type: 'flowers', at: [6, 3.2] }, { type: 'flowers', at: [22, -3.2] }] },

        {   key: 'skate', name: 'THE SKATE PARK', sig: 'half-pipe', par: 4, tee: [0, 0], cup: [16, 22.5],
            tiles: [{ r: [-1.5, -2, 14, 2], trough: { axis: 'x', h: 0.9, flat: 0.25 } },
                    { r: [14, -2, 18, 6] },
                    { r: [14, 6, 18, 20], trough: { axis: 'z', h: 0.9, flat: 0.25 } },
                    { r: [12, 20, 20, 25], kind: 'felt' }],
            path: [[16, 0], [16, 6]],
            props: [{ type: 'flag', at: [10, 2.6] }, { type: 'tree', at: [9, 12] }] },

        {   key: 'hose', name: 'THE HOSEPIPE SHORTCUT', sig: 'pipe shortcut', par: 3, tee: [0, 0], cup: [1, 10.5],
            tiles: [{ r: [-1.5, -1.5, 13, 1.5] }, { r: [10, 1.5, 13, 12] }, { r: [-1.5, 9, 10, 12], slope: [0.01, 0] }],
            pipes: [{ a: [11.6, -0.6], b: [7, 10.5], dir: [-1, 0], r: 0.38, delay: 1.2, out: 4, style: 'hose' }],
            path: [[11.5, 0], [11.5, 10.5]],
            props: [{ type: 'hose', from: [11.6, -0.6], to: [7, 10.5] }, { type: 'tree', at: [5, 5] }, { type: 'flowers', at: [2, 5.5] }] },

        {   key: 'sprinkler', name: 'SPRINKLER SPIN', sig: 'sweeper', par: 3, tee: [0, 0], cup: [20, -2.5],
            tiles: [{ r: [-1.5, -5, 22.5, 5] },
                    { r: [5, 2, 8, 5], y: 0.002, kind: 'puddle' }, { r: [14, -5, 17, -2], y: 0.002, kind: 'puddle' }],
            movers: [{ type: 'sweeper', x: 11, z: 0, len: 3.2, speed: 0.9 }],
            props: [{ type: 'sprinkler', at: [11, 0] }] },

        {   key: 'rockery', name: 'THE ROCKERY', sig: 'cascade', par: 4, tee: [0, 0], cup: [17, 11.5],
            tiles: [{ r: [-1.5, -2.5, 8, 2.5], y: 2.4, open: 'e' },
                    { r: [8, -3, 14, 3], y: 1.6, open: 'e', hills: [[11, 1.5, 1.2, 0.2]] },
                    { r: [14, -3, 20, 3], y: 0.8, open: 's' },
                    { r: [12, 3, 22, 13] }],
            movers: [{ type: 'slider', x: 17, z: 8, bar: 'x', axis: 'x', len: 2.2, amp: 2.6, speed: 1.0 }],
            path: [[17, 0], [17, 4]],
            props: [{ type: 'rocks', at: [7, 3.4] }, { type: 'rocks', at: [13, -3.6] }, { type: 'tree', at: [6, 9] }, { type: 'shed', at: [25.5, 4] }] },
    ],
};

// ── PIRATE COVE — a smugglers' island ───────────────────────────────────────
const PIRATE = {
    key: 'pirate', name: 'PIRATE COVE', blurb: 'Walk the plank, ride the raft, fire the cannon, dodge the Kraken. Mind the water.',
    theme: {
        sky: 0x79cdf2, ground: 0xe6cf93, turf: [0x22a37a, 0x1d966f], edge: 0x5a3a1e, rail: 0x8b5a2b,
        sand: 0xf2dca4, water: 0x1a86cf, wood: 0xa0673a, block: 0x8a877d, accent: 0xd9a514, fog: 0x79cdf2,
        bumper: 0x8a4f22, sweeper: 0x6b3f1d, slider: 0x8e44ad, flag: 0x16161a, pipe: 0x2b2b30, sail: 0xf2e8d0, tee: 0x5a3a1e,
        felt: 0x1f8f6b, raft: 0x9a6a3a,
        scenery: 'pirate',
    },
    holes: [
        {   key: 'plank', name: 'WALK THE PLANK', sig: 'balance beams', par: 4, tee: [0, 0], cup: [22, 6.6],
            tiles: [{ r: [-1.5, -2, 5, 2] },
                    { r: [5, -4, 18, 10], y: -0.4, kind: 'water', rail: false },
                    { r: [5, -0.6, 11.2, 0.6], kind: 'wood', open: 'ns' },
                    { r: [10, 0.6, 11.2, 7.2], kind: 'wood', open: 'we' },
                    { r: [11.2, 6, 18, 7.2], kind: 'wood', open: 'ns' },
                    { r: [18, 4, 24, 9] }],
            path: [[10.6, 0], [10.6, 6.6]],
            props: [{ type: 'barrel', at: [2, -2.6] }, { type: 'palm', at: [23, 10] }, { type: 'palm', at: [20, 3] }] },

        {   key: 'raft', name: 'THE TREASURE RAFT', sig: 'moving raft', par: 5, tee: [0, 0], cup: [27, -1],
            tiles: [{ r: [-1.5, -2, 8, 2], open: 'e' },
                    { r: [8, -4, 20, 4], y: -0.35, kind: 'water', rail: false },
                    { r: [12.5, -1.1, 15.5, 1.1], kind: 'raft', move: { axis: 'x', amp: 4.5, speed: 0.55, phase: -1.5708 } },
                    { r: [20, -3, 30, 3], open: 'w' }],
            links: [[8, 0, 20, 0]],
            props: [{ type: 'chest', at: [29, 2.2] }, { type: 'palm', at: [25, -3.6] }, { type: 'barrel', at: [6, 2.6] }] },

        {   key: 'cannon', name: 'THE CANNON', sig: 'cannon', par: 3, tee: [0, 0], cup: [22, 8.5],
            tiles: [{ r: [-1.5, -2, 10, 2] },
                    { r: [-1.5, 2, 26, 4], y: -0.4, kind: 'water', rail: false },
                    { r: [14, 4, 24, 12], y: 1.5, hills: [[19, 6, 1.4, 0.2]] }],
            pipes: [{ a: [9, 0], b: [15.5, 8], dir: [1, 0], r: 0.42, delay: 1.1, out: 3.2, style: 'cannon' }],
            path: [[9, 0], [15.5, 8]],
            props: [{ type: 'cannon', at: [9, 0], to: [15.5, 8] }, { type: 'flagpole', at: [23.5, 11.5] }, { type: 'fort', at: [19, 12.6] }] },

        {   key: 'wheel', name: 'THE SHIP\'S WHEEL', sig: 'turntable', par: 3, tee: [0, 0], cup: [24, 1.2],
            tiles: [{ r: [-1.5, -3, 8, 3], kind: 'wood' },
                    { r: [8, -4, 16, 4], kind: 'wood', spin: 0.75 },
                    { r: [16, -3, 26, 3], kind: 'wood' }],
            props: [{ type: 'mast', at: [12, -5.2] }, { type: 'barrel', at: [20, 3.6] }] },

        {   key: 'skull', name: 'SKULL CAVE', sig: 'cave', par: 3, tee: [0, 0], cup: [28, 0.5],
            tiles: [{ r: [-1.5, -3, 10, 3] }, { r: [10, -3, 22, 3], y: -0.12, slope: [-0.02, 0], kind: 'rough' }, { r: [22, -3, 30, 3], y: -0.24 }],
            blocks: [[10, -3, 12, -2, 1.6], [10, -1, 12, 1, 1.6], [10, 2, 12, 3, 1.6], [16, -0.7, 17.2, 0.7, 1.2]],
            path: [[11, -1.5], [16.6, -1.8]],
            props: [{ type: 'skull', at: [11, 0] }, { type: 'cave', r: [12, -3, 22, 3] }, { type: 'chest', at: [29, 2.4] }] },

        {   key: 'shark', name: 'SHARK BAY', sig: 'drawbridge', par: 3, tee: [0, 0], cup: [22, 1.5],
            tiles: [{ r: [-1.5, -2, 8, 2], open: 'e' },
                    { r: [8, -4, 14, 4], y: -0.4, kind: 'water', rail: false },
                    { r: [8, -0.7, 14, 0.7], kind: 'wood', lift: { period: 7, down: 0.55, phase: 0 } },
                    { r: [14, -2.5, 26, 4], open: 'w' }],
            path: [[11, 0]],
            props: [{ type: 'fin', at: [11, 2.4] }, { type: 'fin', at: [10.5, -2.6] }, { type: 'barrel', at: [24, -3] }] },

        {   key: 'overboard', name: 'MAN OVERBOARD', sig: 'ski jump', par: 2, tee: [0, 0], cup: [23, 1],
            tiles: [{ r: [-1.5, -2, 9, 2], y: 0.15, slope: [-0.03, 0] },
                    { r: [9, -2, 11.5, 2], y: 0.35, slope: [0.28, 0], kind: 'wood', open: 'e' },
                    { r: [11.5, -3, 15.5, 3], y: -0.5, kind: 'water', rail: false },
                    { r: [15.5, -3, 26, 3], y: -0.2, open: 'w' }],
            links: [[11.5, 0, 15.5, 0]],
            props: [{ type: 'fin', at: [13.5, 0] }, { type: 'palm', at: [25, 4] }] },

        {   key: 'kraken', name: 'THE KRAKEN', sig: 'hammers', par: 3, tee: [0, 0], cup: [28, -1],
            tiles: [{ r: [-1.5, -2.5, 30, 2.5], hills: [[24, 1.2, 1.6, 0.2]] }],
            movers: [{ type: 'hammer', x: 8, z: 0, axis: 'z', amp: 2.0, r: 0.5, speed: 1.4 },
                     { type: 'hammer', x: 14, z: 0, axis: 'z', amp: 2.0, r: 0.5, speed: 1.9, phase: 2 },
                     { type: 'hammer', x: 20, z: 0, axis: 'z', amp: 2.0, r: 0.5, speed: 1.2, phase: 4 }],
            props: [{ type: 'kraken', at: [14, -4.2] }] },

        {   key: 'bounty', name: 'CAPTAIN\'S BOUNTY', sig: 'double gates', par: 5, tee: [0, 0], cup: [26, 1.5],
            tiles: [{ r: [-1.5, -3, 12, 3], kind: 'wood' },
                    { r: [12, -1, 15, 1], y: 0.4, slope: [0.267, 0], kind: 'wood' },
                    { r: [15, -3, 20, 6], y: 0.8, kind: 'wood' },
                    { r: [20, -3, 28, 6], y: 0.8 }],
            blocks: [[19, -3, 20, -1.6, 1.0], [19, -0.4, 20, 2.4, 1.0], [19, 3.6, 20, 6, 1.0]],
            movers: [{ type: 'gate', x: 19.5, z: -1, axis: 'z', w: 0.6, speed: 1.2, phase: 0 },
                     { type: 'gate', x: 19.5, z: 3, axis: 'z', w: 0.6, speed: 1.2, phase: 3.1416 }],
            path: [[13.5, 0], [17, 1], [19.5, 1]],
            props: [{ type: 'chest', at: [27, 5] }, { type: 'mast', at: [6, -4] }, { type: 'cannon', at: [16, 6.6], deco: true }] },
    ],
};

// ── CANDY LAND — mint frosting, chocolate rivers, gumdrops and a donut loop ──
const CANDY = {
    key: 'candy', name: 'CANDY LAND', blurb: 'The sugar rink, the gumball plinko, the chocolate river, jelly jumps and the cake tower.',
    theme: {
        sky: 0xffc9e6, ground: 0xe56aa4, turf: [0x55c995, 0x4bbb88], edge: 0x6b3b1f, rail: 0xffffff, railTex: 'cane',
        sand: 0xd08a2e, goo: 0x5a3218, water: 0x5a3218, ice: 0x8fd0f2, wood: 0xe9b866, block: 0xff6fae, accent: 0xff3b6b, fog: 0xffc9e6,
        bumper: 0xff5fa2, sweeper: 0xff3b6b, slider: 0x8a5cf6, flag: 0xff3b6b, pipe: 0xb8f2e6, sail: 0xfff3fa, tee: 0xffffff, loop: 0xf9a8d4,
        felt: 0x4fbf8a, creek: 0x7a4a26, jelly: 0xff4fa0,
        scenery: 'candy',
    },
    holes: [
        {   key: 'rink', name: 'THE SUGAR RINK', sig: 'ice rink', par: 3, tee: [0, 0], cup: [26, 0], rail: 'candy',
            tiles: [{ r: [-1.5, -2, 6, 2] }, { r: [6, -5, 22, 5], kind: 'ice' }, { r: [22, -2, 28, 2], kind: 'felt' }],
            bumpers: [[14, -5, 0.5], [14, 5, 0.5]],
            props: [{ type: 'cupcake', at: [14, 6.4] }, { type: 'lollipop', at: [4, -3] }] },

        {   key: 'plinko', name: 'GUMBALL PLINKO', sig: 'peg board', par: 3, tee: [0, 0], cup: [24, 0.5], rail: 'candy',
            tiles: [{ r: [-1.5, -2, 4, 2], y: 2.0 }, { r: [4, -4, 20, 4], y: 1.0, slope: [-0.125, 0] }, { r: [20, -4, 27, 4], kind: 'felt' }],
            bumpers: (() => { const out = []; for (let row = 0; row < 6; row++) for (let k = 0; k < 5; k++) out.push([7 + row * 2, -3 + k * 1.5 + (row % 2) * 0.75, 0.14, 0, 0.55]); return out; })(),
            props: [{ type: 'gumballs', at: [2, -2.8] }, { type: 'lollipop', at: [24, 4.6] }] },

        {   key: 'river', name: 'THE CHOCOLATE RIVER', sig: 'current', par: 3, tee: [0, 0], cup: [22, -1.5], rail: 'candy',
            tiles: [{ r: [-1.5, -2, 8, 2] },
                    { r: [8, -6, 13, 6], y: -0.05, kind: 'creek', flow: [0, 2.4], open: 's' },
                    { r: [8, 6, 13, 9], y: -0.6, kind: 'goo', rail: false },
                    { r: [13, -3, 24, 3] }],
            props: [{ type: 'cookie', at: [10.5, -4.5] }, { type: 'cookie', at: [10.5, 3.5] }, { type: 'cupcake', at: [24.5, 4] }] },

        {   key: 'donut', name: 'THE DONUT LOOP', sig: 'loop', par: 3, tee: [0, 0], cup: [24, -0.8], rail: 'candy',
            tiles: [{ r: [-1.5, -1.5, 9, 1.5], y: 0.16, slope: [-0.03, 0] }, { r: [9, -1.5, 26, 1.5], hills: [[19.5, -0.5, 1.3, 0.24]] }],
            bumpers: [[22, 0.4, 0.14, 0, 0.6], [22.5, -0.3, 0.14, 0, 0.6]],
            loops: [{ a: [9.5, 0], dir: [1, 0], len: 3.5, minV: 6, w: 0.9 }],
            props: [{ type: 'cupcake', at: [3, 2.4] }, { type: 'lollipop', at: [16, -2.4] }] },

        {   key: 'jelly', name: 'JELLY JUMP', sig: 'jelly pads', par: 3, tee: [0, 0], cup: [22, 0], rail: 'candy',
            tiles: [{ r: [-1.5, -2, 24, 2] }, { r: [5.5, -2, 7, 2], y: 0.002, kind: 'jelly' }, { r: [12.5, -2, 14, 2], y: 0.002, kind: 'jelly' }],
            walls: [[9, -2, 9, 2, 0.5, 'candy'], [16, -2, 16, 2, 0.5, 'candy']],
            props: [{ type: 'gumdrop', at: [9, -2.8] }, { type: 'gumdrop', at: [16, 2.8] }] },

        {   key: 'switchback', name: 'SWITCHBACK HILL', sig: 'switchbacks', par: 5, tee: [0, 0], cup: [22, 6], rail: 'candy',
            tiles: [{ r: [-1.5, -1.5, 18, 1.5], y: 1.7, slope: [-0.03, 0] },
                    { r: [18, -1.5, 21, 4.5], y: 1.4 },
                    { r: [-1.5, 1.5, 18, 4.5], y: 1.1, slope: [0.03, 0] },
                    { r: [-4.5, 1.5, -1.5, 7.5], y: 0.8 },
                    { r: [-1.5, 4.5, 18, 7.5], y: 0.5, slope: [-0.03, 0] },
                    { r: [18, 4.5, 24, 7.5], y: 0.2 }],
            path: [[19.5, 0], [19.5, 3], [-3, 3], [-3, 6]],
            props: [{ type: 'cane', at: [21.5, -1.8] }, { type: 'cane', at: [-5, 8] }, { type: 'cupcake', at: [25, 3] }] },

        {   key: 'turnstiles', name: 'TURNSTILE TOWN', sig: 'turnstiles', par: 4, tee: [0, 0], cup: [22, 1], rail: 'candy', blockMat: 'candy',
            tiles: [{ r: [-1.5, -3, 24, 3] }],
            blocks: [[8, -3, 9, -1, 0.8], [8, 1, 9, 3, 0.8], [15, -3, 16, -2.4, 0.8], [15, -0.4, 16, 3, 0.8]],
            movers: [{ type: 'sweeper', x: 8.5, z: 0, len: 0.95, speed: 1.4, arms: 3 }, { type: 'sweeper', x: 15.5, z: -1.4, len: 0.95, speed: -1.7, arms: 3 }],
            path: [[8.5, 0], [15.5, -1.4]],
            props: [{ type: 'ginger', at: [8.5, 0] }, { type: 'ginger', at: [15.5, -1.4] }] },

        {   key: 'mountain', name: 'CUPCAKE MOUNTAIN', sig: 'volcano', par: 3, tee: [0, 0], cup: [16, 0], rail: 'candy',
            tiles: [{ r: [-1.5, -3, 10, 3] }, { r: [10, -6, 22, 6], hills: [[16, 0, 5.6, 1.4], [16, 0, 1.2, -0.35]] }],
            props: [{ type: 'cherry', at: [16, 2.8] }, { type: 'lollipop', at: [22.6, -5] }] },

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
            props: [{ type: 'cherry', at: [21, 13] }, { type: 'cupcake', at: [2, 0] }] },
    ],
};

// ── SPACE STATION — panels in orbit: fall off the edge and you're gone ──────
const SPACE = {
    key: 'space', name: 'SPACE STATION', blurb: 'Launch strips, teleporters, asteroids, moon craters, lasers, magnets, airlocks, cargo belts and the solar wind.',
    theme: {
        sky: 0x05060f, ground: null, turf: [0x2c3170, 0x262b64], edge: 0x9aa3b5, rail: 0x22d3ee, railGlow: true,
        sand: 0x9a9aa8, water: 0x22d3ee, boost: 0xfacc15, wood: 0x6b7280, block: 0x4b5563, accent: 0xf472b6, fog: 0x05060f,
        bumper: 0x8b5cf6, sweeper: 0xf43f5e, slider: 0xef4444, flag: 0x22d3ee, pipe: 0xa855f7, sail: 0xc7d2fe, tee: 0x111827, loop: 0x22d3ee,
        felt: 0x343a86, conveyor: 0x374151, moon: 0x9ca3af,
        windmill: 'airlock', scenery: 'space',
    },
    holes: [
        {   key: 'launch', name: 'THE LAUNCH STRIP', sig: 'boost chain', par: 3, tee: [0, 0], cup: [24, 4.5], rail: 'neon',
            tiles: [{ r: [-1.5, -1.5, 8, 1.5] }, { r: [8, -1.5, 11, 1.5], kind: 'boost', boost: [7, 0] }, { r: [11, -1.5, 15, 1.5] },
                    { r: [15, -1.5, 18, 1.5], kind: 'boost', boost: [7, 0] }, { r: [18, -1.5, 27, 1.5] }, { r: [21, 1.5, 27, 7], kind: 'felt' }],
            path: [[24, 0]],
            props: [{ type: 'beacon', at: [7.8, 1.9] }, { type: 'beacon', at: [7.8, -1.9] }, { type: 'satellite', at: [14, -9] }] },

        {   key: 'hub', name: 'THE TELEPORTER HUB', sig: 'teleport choice', par: 4, tee: [0, 0], cup: [28, 0], rail: 'neon',
            tiles: [{ r: [-1.5, -3, 8, 3] }, { r: [12, -8, 22, -4] }, { r: [12, 4, 22, 8] },
                    { r: [22, -5, 24, -1] }, { r: [22, 1, 24, 5] }, { r: [24, -3, 31, 3], kind: 'felt' }],
            pipes: [{ a: [6.5, -1.8], b: [13.5, -6], dir: [1, 0], r: 0.4, delay: 0.6, out: 5, style: 'teleport' },
                    { a: [6.5, 1.8], b: [13.5, 6], dir: [1, 0], r: 0.4, delay: 0.6, out: 5, style: 'teleport' }],
            bumpers: [[17, -6.6, 0.13, 0, 0.6], [18, -5.2, 0.13, 0, 0.6], [19, -6.4, 0.13, 0, 0.6]],
            fans: [{ r: [15, 4, 19, 8], f: [0, 4] }],
            path: [[6.5, -1.8], [13.5, -6], [23, -3]],
            props: [{ type: 'crystal', at: [10, 0] }] },

        {   key: 'belt', name: 'THE ASTEROID BELT', sig: 'asteroid field', par: 3, tee: [0, 0], cup: [24, 0], rail: 'neon',
            tiles: [{ r: [-1.5, -5, 26, 5], open: 'n' }],
            bumpers: [[5, 1.6, 0.55], [7.5, -1.8, 0.5], [9.5, 2.6, 0.6], [11, -0.2, 0.55], [13.5, -3, 0.5], [14.5, 2, 0.5], [17, -1, 0.6], [19, 3, 0.45], [20.5, -2.6, 0.5]],
            props: [{ type: 'planet', at: [10, -18] }] },

        {   key: 'moon', name: 'MOON CRATERS', sig: 'low-gravity craters', par: 3, tee: [0, 0], cup: [24, 1], gravity: 0.45, rail: 'neon',
            tiles: [{ r: [-1.5, -4, 26, 4], kind: 'rough',
                      hills: [[7, -1, 2, 0.35], [7, -1, 1.3, -0.45], [13, 2, 2.2, 0.35], [13, 2, 1.4, -0.5], [18, -1.8, 1.8, 0.3], [18, -1.8, 1.1, -0.4]] }],
            props: [{ type: 'flagpole', at: [3, -3.4], moon: true }, { type: 'satellite', at: [12, 9] }] },

        {   key: 'lasers', name: 'THE LASER GRID', sig: 'lasers', par: 3, tee: [0, 0], cup: [28, -1], rail: 'neon',
            tiles: [{ r: [-1.5, -2.5, 30, 2.5] }],
            movers: [{ type: 'slider', x: 6, z: 0, bar: 'z', axis: 'z', len: 1.8, amp: 1.5, speed: 1.3 },
                     { type: 'slider', x: 11, z: 0, bar: 'z', axis: 'z', len: 1.8, amp: 1.5, speed: 1.8, phase: 1.5 },
                     { type: 'slider', x: 16, z: 0, bar: 'z', axis: 'z', len: 1.8, amp: 1.5, speed: 2.3, phase: 3 },
                     { type: 'slider', x: 21, z: 0, bar: 'z', axis: 'z', len: 1.8, amp: 1.5, speed: 1.1, phase: 4.5 }],
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
            props: [{ type: 'beacon', at: [6.5, 2.4] }, { type: 'beacon', at: [18.4, 7.5] }] },

        {   key: 'cargo', name: 'THE CARGO BAY', sig: 'conveyor belts', par: 5, tee: [0, 0], cup: [24.5, -3], rail: 'neon', blockMat: 'metal',
            tiles: [{ r: [-1.5, -6, 27, 6] },
                    { r: [6, -6, 9, 6], y: 0.002, kind: 'conveyor', flow: [0, 3] },
                    { r: [12, -6, 15, 6], y: 0.002, kind: 'conveyor', flow: [0, -3.5] },
                    { r: [18, -6, 21, 6], y: 0.002, kind: 'conveyor', flow: [0, 2.5] }],
            blocks: [[10, 3, 11, 4, 0.6], [16, -4, 17, -3, 0.6], [22.5, 1, 23.5, 2, 0.6]],
            props: [{ type: 'crate', at: [3, 4.5] }, { type: 'crate', at: [25, 4.5] }] },

        {   key: 'wind', name: 'THE SOLAR WIND', sig: 'fans', par: 4, tee: [0, 0], cup: [28, 2], rail: 'neon',
            tiles: [{ r: [-1.5, -3, 6, 3] }, { r: [6, -0.9, 22, 0.9], open: 'ns', kind: 'felt' }, { r: [22, -4, 30, 4] }],
            fans: [{ r: [8, -3.5, 12, 3.5], f: [0, 4.5] }, { r: [15, -3.5, 19, 3.5], f: [0, -4.5] }],
            props: [{ type: 'fan', at: [10, -3.6], dir: 1 }, { type: 'fan', at: [17, 3.6], dir: -1 }, { type: 'planet', at: [16, 18] }] },
    ],
};

export const COURSES = [BACKYARD, PIRATE, CANDY, SPACE];
export const COURSE_KEYS = COURSES.map(c => c.key);
export const courseByKey = k => COURSES.find(c => c.key === k) || COURSES[0];
/** Every hole of every course, as [courseKey, hole]. */
export const ALL_HOLES = () => COURSES.flatMap(c => c.holes.map(h => [c.key, h]));
export const coursePar = c => c.holes.reduce((a, h) => a + h.par, 0);
