// ============================================================
// GOLF COURSES — the holes, as data. Physics.compile() reads them; Build.js
// draws them in the course's theme. Nothing here knows THREE.
//
// A hole (see Physics.compile for every field):
//   name, par, tee [x, z], cup [x, z]
//   tiles   floor: { r: [x0, z0, x1, z1], y, slope: [gx, gz], hills, kind, open }
//   path    waypoints from the tee to the cup, round the corners (bots, cameras)
//   walls, blocks, bumpers, movers, pipes, loops   (all optional)
//   props   scenery only, drawn by the theme: { type, at: [x, z], ... }
//
// Holes run roughly along +x, so the whole of one fits a landscape screen.
// ============================================================

// ── BACKYARD — someone's garden on a summer afternoon ───────────────────────
const BACKYARD = {
    key: 'backyard', name: 'BACKYARD', blurb: 'A summer garden: hedges, a sandpit, the paddling pool and the sprinkler.',
    theme: {
        sky: 0x8ccbf0, ground: 0x45903a, turf: [0x3aa346, 0x31933d], edge: 0x8a5a2b, rail: 0xf3e9d2,
        sand: 0xead39b, water: 0x4fb4ec, wood: 0xb7814a, block: 0x2f7d3a, accent: 0xff7a59, fog: 0x8ccbf0,
        scenery: 'backyard',
    },
    holes: [
        {   key: 'firstswing', name: 'FIRST SWING', par: 2, tee: [0, 0], cup: [12.5, 0.3],
            tiles: [{ r: [-1.2, -1.5, 14, 1.5], hills: [[6.5, -0.4, 1.6, 0.22]] }],
            props: [{ type: 'gnome', at: [6.5, -2.4] }, { type: 'flowers', at: [3, 2.3] }, { type: 'flowers', at: [10, -2.3] }] },

        {   key: 'dogleg', name: 'HEDGE DOGLEG', par: 3, tee: [0, 0], cup: [10.5, 9],
            tiles: [{ r: [-1.2, -1.5, 12, 1.5] }, { r: [9, 1.5, 12, 10.5] }],
            path: [[10.4, 0]],
            // A bank in the far corner, to play it off the boards.
            walls: [[10.8, -1.5, 12, -0.3]],
            props: [{ type: 'hedge', from: [-1.2, 2.05], to: [9, 2.05] }, { type: 'tree', at: [5, 6] }, { type: 'flowers', at: [13, 6] }] },

        {   key: 'sandpit', name: 'THE SANDPIT', par: 2, tee: [0, 0], cup: [15, -0.6],
            tiles: [{ r: [-1.2, -2, 16.5, 2] },
                    { r: [4.5, -2, 7.5, 0.4], y: 0.002, kind: 'sand' },
                    { r: [9, -0.5, 12, 2], y: 0.002, kind: 'sand' }],
            props: [{ type: 'bucket', at: [6, -2.6] }, { type: 'spade', at: [10.5, 2.6] }] },

        {   key: 'pool', name: 'THE PADDLING POOL', par: 3, tee: [0, 0], cup: [16.5, 0.8],
            tiles: [{ r: [-1.2, -2.5, 6, 2.5] },
                    { r: [6, -0.45, 11, 0.45], kind: 'wood', open: 'ns' },
                    { r: [6, -2.5, 11, 2.5], y: -0.28, kind: 'water', rail: false },
                    { r: [11, -2.5, 18, 2.5], hills: [[14, -1.2, 1.4, 0.18]] }],
            props: [{ type: 'duck', at: [8, 1.5] }, { type: 'duck', at: [9.5, -1.6] }, { type: 'pool', r: [6, -2.5, 11, 2.5] }] },

        {   key: 'windmill', name: 'GARDEN WINDMILL', par: 3, tee: [0, 0], cup: [15.5, 0.7],
            tiles: [{ r: [-1.2, -2, 17, 2] }],
            blocks: [[8.4, -2, 9.6, -0.5, 1.2], [8.4, 0.5, 9.6, 2, 1.2]],
            movers: [{ type: 'windmill', x: 8.4, z: 0, axis: 'z', w: 0.5, speed: 1.5 }],
            props: [{ type: 'windmill', at: [9, 0], face: 8.4 }] },

        {   key: 'skate', name: 'SKATE RAMP', par: 2, tee: [0, 0], cup: [17.5, 0],
            tiles: [{ r: [-1.2, -2, 7, 2] },
                    { r: [7, -2, 9, 2], y: 0.3, slope: [0.3, 0], kind: 'wood', open: 'e' },
                    { r: [9, -2.6, 11.4, 2.6], y: -0.45, kind: 'flowers', rail: false },
                    { r: [11.4, -2.4, 19.5, 2.4], y: -0.15, open: 'w' }],
            props: [{ type: 'bed', r: [9, -2.6, 11.4, 2.6] }, { type: 'flag', at: [11.6, 2.6] }] },

        {   key: 'hose', name: 'THE HOSEPIPE', par: 3, tee: [0, 0], cup: [1.5, 5.5],
            tiles: [{ r: [-1.2, -1.4, 14, 1.4] },
                    { r: [-0.5, 4, 14, 7], slope: [0.02, 0], hills: [[6, 6.3, 1.5, 0.2]] }],
            pipes: [{ a: [13.2, 0], b: [13, 5.5], dir: [-1, 0], delay: 0.8, keep: 0.8 }],
            path: [[13.2, 0], [13, 5.5]],
            props: [{ type: 'hose', from: [13.2, 0], to: [13, 5.5] }, { type: 'tree', at: [6, 2.7] }, { type: 'flowers', at: [3, 2.7] }] },

        {   key: 'sprinkler', name: 'SPRINKLER SPIN', par: 3, tee: [0, 0], cup: [13, 0],
            tiles: [{ r: [-1.2, -4, 14.5, 4], slope: [0, 0.025] }],
            bumpers: [[4, -2.6, 0.38], [4, 2.6, 0.38], [10, -2.6, 0.38], [10, 2.6, 0.38]],
            movers: [{ type: 'sweeper', x: 7, z: 0, len: 2.6, speed: 1.1 }],
            props: [{ type: 'sprinkler', at: [7, 0] }] },

        {   key: 'finish', name: 'THE BIG FINISH', par: 4, tee: [0, 0], cup: [12, 11.5],
            tiles: [{ r: [-1.2, -2, 8, 2] },
                    { r: [8, -2, 12, 2], y: 0.4, slope: [0.2, 0], kind: 'wood' },
                    { r: [12, -2, 18.5, 2], y: 0.8 },
                    { r: [15, 2, 18.5, 9], y: 0.52, slope: [0, -0.08] },
                    { r: [9.5, 9, 18.5, 14], y: 0.24, hills: [[12, 11.5, 1.8, -0.22]] }],
            movers: [{ type: 'slider', x: 14.2, z: 0, bar: 'z', axis: 'z', len: 1.5, amp: 1.25, speed: 1.3 }],
            path: [[16.8, 0], [16.8, 11.5]],
            props: [{ type: 'shed', at: [11, 5.5] }, { type: 'tree', at: [20.5, 6] }, { type: 'flowers', at: [7, 12] }] },
    ],
};

// ── PIRATE COVE — a smugglers' island: planks over the sea, a ship, a cannon ─
const PIRATE = {
    key: 'pirate', name: 'PIRATE COVE', blurb: 'Planks over the sea, a cannon, the ship\'s wheel and the Kraken. Mind the water.',
    theme: {
        sky: 0x79cdf2, ground: 0xe6cf93, turf: [0x22a37a, 0x1d966f], edge: 0x5a3a1e, rail: 0x8b5a2b,
        sand: 0xf2dca4, water: 0x1a86cf, wood: 0xa0673a, block: 0x8a877d, accent: 0xd9a514, fog: 0x79cdf2,
        bumper: 0x8a4f22, sweeper: 0x6b3f1d, slider: 0x8e44ad, flag: 0x16161a, pipe: 0x2b2b30, sail: 0xf2e8d0, tee: 0x5a3a1e,
        scenery: 'pirate',
    },
    holes: [
        {   key: 'plank', name: 'WALK THE PLANK', par: 2, tee: [0, 0], cup: [13.2, 0.3],
            tiles: [{ r: [-1.2, -1.5, 4, 1.5] },
                    { r: [4, -0.55, 10, 0.55], kind: 'wood', open: 'ns' },
                    { r: [4, -3, 10, 3], y: -0.3, kind: 'water', rail: false },
                    { r: [10, -2, 15, 2] }],
            props: [{ type: 'barrel', at: [2, -2.2] }, { type: 'palm', at: [14, 3] }, { type: 'palm', at: [11, -3.2] }] },

        {   key: 'treasure', name: 'TREASURE ISLAND', par: 4, tee: [0, 0], cup: [14.5, 6.6],
            tiles: [{ r: [-1.2, -1.4, 8, 1.4] },
                    { r: [5, 1.4, 8, 7] },
                    { r: [8, 4.5, 12, 5.9], kind: 'wood', open: 'ns' },
                    { r: [8, 1, 17, 10], y: -0.3, kind: 'water', rail: false },
                    { r: [12, 3, 16.5, 8.5], hills: [[13.6, 4.6, 1.2, 0.2]] }],
            path: [[6.5, 0], [6.5, 5.2], [12, 5.2]],
            props: [{ type: 'chest', at: [16.0, 8.0] }, { type: 'palm', at: [16.9, 3.4] }, { type: 'barrel', at: [4, 2.2] }] },

        {   key: 'cannon', name: 'THE CANNON', par: 3, tee: [0, 0], cup: [12.4, 5.5],
            tiles: [{ r: [-1.2, -1.5, 9.2, 1.5] },
                    { r: [-1.2, 1.5, 15, 4], y: -0.3, kind: 'water', rail: false },
                    { r: [4, 4, 14, 7], y: 0.8, hills: [[9.5, 4.9, 1.2, 0.2]] }],
            pipes: [{ a: [8.3, 0], b: [5, 5.5], dir: [1, 0], r: 0.38, delay: 0.7, out: 6.8 }],
            path: [[8.3, 0], [5, 5.5]],
            props: [{ type: 'cannon', at: [8.3, 0], to: [5, 5.5] }, { type: 'barrel', at: [10.2, -1.9] }, { type: 'flagpole', at: [14.6, 7.2] }] },

        {   key: 'wheel', name: 'THE SHIP\'S WHEEL', par: 3, tee: [0, 0], cup: [13.5, -1.2],
            tiles: [{ r: [-1.2, -3, 15, 3], kind: 'wood' }],
            blocks: [[3, -3, 4, -1.6, 0.6], [3, 1.6, 4, 3, 0.6], [10, -0.7, 11, 0.7, 0.6]],
            movers: [{ type: 'sweeper', x: 7, z: 0, len: 2.8, speed: 0.9 }],
            props: [{ type: 'wheel', at: [7, 0] }, { type: 'mast', at: [15.8, 3.6] }] },

        {   key: 'skull', name: 'SKULL ROCK', par: 3, tee: [0, 0], cup: [15, 0],
            tiles: [{ r: [-1.2, -2.5, 17, 2.5] }],
            blocks: [[8, -2.5, 9.5, -1.4, 1.4], [8, -0.6, 9.5, 0.6, 1.4], [8, 1.4, 9.5, 2.5, 1.4]],
            props: [{ type: 'skull', at: [8.75, 0] }, { type: 'palm', at: [3, -3.4] }, { type: 'chest', at: [16.4, 2.0] }] },

        {   key: 'shark', name: 'SHARK BAY', par: 4, tee: [0, 0], cup: [13.5, 8.5],
            tiles: [{ r: [-1.2, -1.5, 5, 1.5] },
                    { r: [5, -0.7, 8, 0.7], kind: 'wood', open: 'ns' },
                    { r: [8, -1.5, 11, 4] },
                    { r: [8.8, 4, 10.2, 7], kind: 'wood', open: 'we' },
                    { r: [7, 7, 15, 10] },
                    { r: [5, -3, 16, 11], y: -0.3, kind: 'water', rail: false }],
            path: [[9.5, 0], [9.5, 8.5]],
            props: [{ type: 'fin', at: [6.5, 3] }, { type: 'fin', at: [12.5, 4.5] }, { type: 'barrel', at: [7.6, 9.6] }] },

        {   key: 'ramp', name: 'MAN OVERBOARD', par: 2, tee: [0, 0], cup: [17, 0],
            tiles: [{ r: [-1.2, -2, 7, 2] },
                    { r: [7, -2, 9, 2], y: 0.3, slope: [0.3, 0], kind: 'wood', open: 'e' },
                    { r: [9, -3, 12, 3], y: -0.45, kind: 'water', rail: false },
                    { r: [12, -2.5, 13.5, 2.5], y: -0.148, kind: 'sand', open: 'w' },
                    { r: [12, -2.5, 19, 2.5], y: -0.15, open: 'w' }],
            props: [{ type: 'fin', at: [10.5, 0] }, { type: 'palm', at: [18, 3.4] }] },

        {   key: 'kraken', name: 'THE KRAKEN', par: 4, tee: [0, 0], cup: [20.5, 0.8],
            tiles: [{ r: [-1.2, -2.2, 22, 2.2] }],
            movers: [{ type: 'slider', x: 6, z: 0, bar: 'z', axis: 'z', len: 1.6, amp: 1.3, speed: 1.1 },
                     { type: 'slider', x: 11, z: 0, bar: 'z', axis: 'z', len: 1.6, amp: 1.3, speed: 1.5, phase: 2 },
                     { type: 'slider', x: 16, z: 0, bar: 'z', axis: 'z', len: 1.6, amp: 1.3, speed: 1.9, phase: 4 }],
            props: [{ type: 'kraken', at: [11, -3.8] }] },

        {   key: 'bounty', name: 'CAPTAIN\'S BOUNTY', par: 4, tee: [0, 0], cup: [16.5, 7],
            tiles: [{ r: [-1.2, -2, 8, 2] },
                    { r: [8, -0.8, 12, 0.8], y: 0.5, slope: [0.25, 0], kind: 'wood' },
                    { r: [12, -2.5, 18, 2.5], y: 1.0, kind: 'wood' },
                    { r: [15, 2.5, 18, 8], y: 1.0 }],
            blocks: [[15, 5, 16.1, 5.3, 0.8], [16.9, 5, 18, 5.3, 0.8]],
            movers: [{ type: 'windmill', x: 16.5, z: 5.15, axis: 'x', w: 0.4, speed: 1.7 }],
            path: [[10, 0], [16.5, 0], [16.5, 7]],
            props: [{ type: 'chest', at: [17.4, 7.6] }, { type: 'mast', at: [13, -3.4] }, { type: 'cannon', at: [12.6, 2.9], deco: true }] },
    ],
};

// ── CANDY LAND — mint frosting, chocolate rivers, gumdrops and a donut loop ──
const CANDY = {
    key: 'candy', name: 'CANDY LAND', blurb: 'Frosting slides, gumdrop bumpers, the chocolate river and the donut loop.',
    theme: {
        sky: 0xffc9e6, ground: 0xe56aa4, turf: [0x55c995, 0x4bbb88], edge: 0x6b3b1f, rail: 0xffffff, railTex: 'cane',
        sand: 0xd08a2e, goo: 0x5a3218, water: 0x5a3218, ice: 0x8fd0f2, wood: 0xe9b866, block: 0xff6fae, accent: 0xff3b6b, fog: 0xffc9e6,
        bumper: 0xff5fa2, sweeper: 0xff3b6b, slider: 0x8a5cf6, flag: 0xff3b6b, pipe: 0xb8f2e6, sail: 0xfff3fa, tee: 0xffffff, loop: 0xf9a8d4,
        scenery: 'candy',
    },
    holes: [
        {   key: 'sugarrush', name: 'SUGAR RUSH', par: 2, tee: [0, 0], cup: [16.5, -0.8],
            tiles: [{ r: [-1.2, -1.5, 6, 1.5] }, { r: [6, -1.5, 14, 1.5], kind: 'ice' }, { r: [14, -2, 18, 2] }],
            props: [{ type: 'lollipop', at: [4, 2.4] }, { type: 'lollipop', at: [11, -2.4] }, { type: 'cupcake', at: [18.8, 1.6] }] },

        {   key: 'gumdrops', name: 'GUMDROP GARDEN', par: 3, tee: [0, 0], cup: [14.5, 0],
            tiles: [{ r: [-1.2, -3.5, 16, 3.5] }],
            bumpers: [[4, -1.5, 0.42], [4, 1.5, 0.42], [7, 0, 0.42], [7, -2.8, 0.42], [7, 2.8, 0.42], [10, -1.5, 0.42], [10, 1.5, 0.42], [12.6, 0, 0.35]],
            props: [{ type: 'cane', at: [-0.8, 3.8] }, { type: 'cane', at: [15.6, -3.8] }] },

        {   key: 'chocolate', name: 'CHOCOLATE RIVER', par: 4, tee: [0, 0], cup: [15.5, -1],
            tiles: [{ r: [-1.2, -2.5, 6, 2.5] },
                    { r: [6, 0.9, 10, 2.3], kind: 'wood', open: 'ns' },
                    { r: [6, -4, 10, 4], y: -0.3, kind: 'goo', rail: false },
                    { r: [10, -2.5, 17, 2.5], hills: [[12.5, 0.8, 1.3, 0.22]] }],
            props: [{ type: 'cupcake', at: [3, -3.2] }, { type: 'lollipop', at: [16, 3.2] }] },

        {   key: 'donut', name: 'THE DONUT LOOP', par: 3, tee: [0, 0], cup: [16, 0],
            tiles: [{ r: [-1.2, -1.3, 18, 1.3] }],
            loops: [{ a: [7, 0], dir: [1, 0], len: 3.5, minV: 6, w: 0.9 }],
            bumpers: [[13.4, 0.1, 0.38]],
            props: [{ type: 'cupcake', at: [3, 2.2] }, { type: 'lollipop', at: [13, -2.2] }] },

        {   key: 'caramel', name: 'CARAMEL SWAMP', par: 3, tee: [0, 0], cup: [8.5, 8],
            tiles: [{ r: [-1.2, -1.6, 10, 1.6] }, { r: [7, 1.6, 10, 9.5] },
                    { r: [4, -1.6, 7, 0.2], y: 0.002, kind: 'sand' }, { r: [7, 3, 10, 5.5], y: 0.002, kind: 'sand' }],
            path: [[8.5, 0]],
            props: [{ type: 'gumdrop', at: [5, 3.5] }, { type: 'cane', at: [11, 6] }, { type: 'cupcake', at: [2, 3.0] }] },

        {   key: 'canelane', name: 'CANDY CANE LANE', par: 4, tee: [0, 0], cup: [14.5, -1.8],
            tiles: [{ r: [-1.2, -3, 16, 3] }],
            walls: [[4, -3, 4, 0.9], [8, -0.9, 8, 3], [12, -3, 12, 0.9]],
            path: [[4, 1.95], [8, -1.95], [12, 1.95]],
            props: [{ type: 'cane', at: [4, -3.5] }, { type: 'cane', at: [8, 3.5] }, { type: 'cane', at: [12, -3.5] }] },

        {   key: 'lollispin', name: 'LOLLIPOP SPIN', par: 3, tee: [0, 0], cup: [15.5, 0.5],
            tiles: [{ r: [-1.2, -3, 17, 3] }],
            movers: [{ type: 'sweeper', x: 5.5, z: 0, len: 2.4, speed: 1.0 }, { type: 'sweeper', x: 11, z: 0, len: 2.4, speed: -1.25 }],
            props: [{ type: 'gumdrop', at: [16, -3.6] }] },

        {   key: 'frosting', name: 'FROSTING SLIDE', par: 3, tee: [0, 0], cup: [16, 1.1],
            tiles: [{ r: [-1.2, -1.5, 4, 1.5], y: 1.2 },
                    { r: [4, -1.5, 12, 1.5], y: 0.6, slope: [-0.15, 0], kind: 'ice' },
                    { r: [12, -3, 18, 3], hills: [[14.8, -0.3, 2.0, -0.22]] }],
            props: [{ type: 'cupcake', at: [18.8, -2.4] }, { type: 'lollipop', at: [8, 2.4] }] },

        {   key: 'cake', name: 'CAKE WALK', par: 4, tee: [0, 0], cup: [13.25, 7.5],
            tiles: [{ r: [-1.2, -3, 8, 3] },
                    { r: [8, -0.8, 10.5, 0.8], y: 0.35, slope: [0.28, 0], kind: 'wood' },
                    { r: [10.5, -2.5, 16, 2.5], y: 0.7 },
                    { r: [12.5, 2.5, 14, 5], y: 1.05, slope: [0, 0.28], kind: 'wood' },
                    { r: [11, 5, 15.5, 9], y: 1.4 }],
            bumpers: [[13.25, 0, 0.4]],
            path: [[9.25, 0], [13.25, 1.6], [13.25, 7.5]],
            props: [{ type: 'cherry', at: [15.2, 8.7] }, { type: 'cupcake', at: [5, -3.8] }] },
    ],
};

// ── SPACE STATION — panels in orbit: fall off the edge and you're gone ──────
const SPACE = {
    key: 'space', name: 'SPACE STATION', blurb: 'Boost pads, teleporters, lasers and low gravity, with nothing but space off the edge.',
    theme: {
        sky: 0x05060f, ground: null, turf: [0x2c3170, 0x262b64], edge: 0x9aa3b5, rail: 0x22d3ee, railGlow: true,
        sand: 0x9a9aa8, water: 0x22d3ee, boost: 0xfacc15, wood: 0x6b7280, block: 0x4b5563, accent: 0xf472b6, fog: 0x05060f,
        bumper: 0x8b5cf6, sweeper: 0xf43f5e, slider: 0xef4444, flag: 0x22d3ee, pipe: 0xa855f7, sail: 0xc7d2fe, tee: 0x111827, loop: 0x22d3ee,
        windmill: 'airlock', scenery: 'space',
    },
    holes: [
        {   key: 'dock', name: 'DOCKING BAY', par: 2, tee: [0, 0], cup: [18, 0.6],
            tiles: [{ r: [-1.2, -1.5, 6, 1.5] }, { r: [6, -1.5, 9, 1.5], kind: 'boost', boost: [7, 0] }, { r: [9, -2, 20, 2] }],
            props: [{ type: 'beacon', at: [5.8, 2] }, { type: 'beacon', at: [5.8, -2] }, { type: 'satellite', at: [12, -9] }] },

        {   key: 'teleport', name: 'THE TELEPORTER', par: 3, tee: [0, 0], cup: [12.5, 7.6],
            tiles: [{ r: [-1.2, -2, 9, 2] }, { r: [1.5, 5, 14, 9] }],
            pipes: [{ a: [8, 0], b: [3, 7], dir: [1, 0], r: 0.4, delay: 0.5, out: 6.5 }],
            path: [[8, 0], [3, 7]],
            props: [{ type: 'crystal', at: [10, 3.5] }] },

        {   key: 'asteroids', name: 'ASTEROID FIELD', par: 3, tee: [0, 0], cup: [15.5, 0],
            tiles: [{ r: [-1.2, -3.5, 17, 3.5] }],
            bumpers: [[3.5, 1.2, 0.5], [5.5, -1.6, 0.45], [7.5, 0.8, 0.55], [9, -2.4, 0.4], [10.5, 2.2, 0.45], [11.5, -0.6, 0.5], [13.5, 1.6, 0.4], [13.6, -2.2, 0.4]],
            props: [{ type: 'planet', at: [8, -16] }] },

        {   key: 'zerog', name: 'ZERO-G JUMP', par: 2, tee: [0, 0], cup: [18, 0], gravity: 0.45,
            tiles: [{ r: [-1.2, -2, 6, 2] },
                    { r: [6, -2, 8, 2], y: 0.25, slope: [0.25, 0], open: 'e' },
                    { r: [12, -2.5, 20, 2.5], open: 'w' }],
            links: [[8, 0, 12, 0]],
            props: [{ type: 'beacon', at: [8, 2.1] }, { type: 'beacon', at: [12, -2.6] }] },

        {   key: 'lasers', name: 'LASER GRID', par: 3, tee: [0, 0], cup: [18.5, -1],
            tiles: [{ r: [-1.2, -2.5, 20, 2.5] }],
            movers: [{ type: 'slider', x: 5, z: 0, bar: 'z', axis: 'z', len: 1.8, amp: 1.5, speed: 1.3 },
                     { type: 'slider', x: 9.5, z: 0, bar: 'z', axis: 'z', len: 1.8, amp: 1.5, speed: 1.8, phase: 1.5 },
                     { type: 'slider', x: 14, z: 0, bar: 'z', axis: 'z', len: 1.8, amp: 1.5, speed: 2.3, phase: 3 }],
            props: [{ type: 'satellite', at: [10, -6] }] },

        {   key: 'well', name: 'GRAVITY WELL', par: 3, tee: [0, 0], cup: [12.6, 2],
            tiles: [{ r: [-1.2, -4, 14.5, 4], hills: [[7, -0.2, 3, -0.55], [11, -2.4, 1.3, 0.3]] }],
            props: [{ type: 'crystal', at: [7, -0.2], sink: true }] },

        {   key: 'airlock', name: 'THE AIRLOCKS', par: 3, tee: [0, 0], cup: [14.5, 0],
            tiles: [{ r: [-1.2, -2, 16, 2] }],
            blocks: [[7, -2, 8, -0.5, 1.2], [7, 0.5, 8, 2, 1.2], [11, -2, 12, 0, 1.2], [11, 1, 12, 2, 1.2]],
            movers: [{ type: 'windmill', x: 7, z: 0, axis: 'z', w: 0.5, speed: 1.4 }, { type: 'windmill', x: 11, z: 0.5, axis: 'z', w: 0.5, speed: 2.1 }],
            props: [{ type: 'beacon', at: [7.5, 2.4] }, { type: 'beacon', at: [11.5, -2.4] }] },

        {   key: 'ringroad', name: 'RING ROAD', par: 2, tee: [0, 0], cup: [15, 0],
            tiles: [{ r: [-1.2, -1.3, 17, 1.3] }],
            loops: [{ a: [6, 0], dir: [1, 0], len: 3.5, minV: 6, w: 0.9 }],
            movers: [{ type: 'slider', x: 12.2, z: 0, bar: 'z', axis: 'z', len: 1.2, amp: 0.9, speed: 1.6 }],
            props: [{ type: 'planet', at: [10, 14] }] },

        {   key: 'mothership', name: 'THE MOTHERSHIP', par: 3, tee: [0, 0], cup: [10.5, 7.5],
            tiles: [{ r: [-1.2, -2, 7, 2] },
                    { r: [7, -1, 11, 1], y: 0.5, slope: [0.25, 0], kind: 'boost', boost: [5, 0] },
                    { r: [11, -3, 17, 3], y: 1.0 },
                    { r: [1, 5.5, 12, 9.5], y: 0.4, hills: [[6.5, 6.6, 1.3, 0.25]] }],
            movers: [{ type: 'sweeper', x: 14, z: 0, len: 2.4, speed: 1.0 }],
            pipes: [{ a: [16, 2.2], b: [2.5, 7.5], dir: [1, 0], r: 0.4, delay: 0.6, out: 5 }],
            path: [[9, 0], [16, 2.2], [2.5, 7.5]],
            props: [{ type: 'satellite', at: [6, 13] }, { type: 'planet', at: [-10, -14] }] },
    ],
};

export const COURSES = [BACKYARD, PIRATE, CANDY, SPACE];
export const COURSE_KEYS = COURSES.map(c => c.key);
export const courseByKey = k => COURSES.find(c => c.key === k) || COURSES[0];
/** Every hole of every course, as [courseKey, hole]. */
export const ALL_HOLES = () => COURSES.flatMap(c => c.holes.map(h => [c.key, h]));
export const coursePar = c => c.holes.reduce((a, h) => a + h.par, 0);
