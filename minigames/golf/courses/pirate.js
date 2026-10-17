// The Pirate course — its nine holes as data (see ../Courses.js for the format).
import { kick } from './kit.js';

// ── PIRATE COVE — a smugglers' island ───────────────────────────────────────
export const COURSE = {
    key: 'pirate', name: 'PIRATE COVE', blurb: 'Walk the plank, ride the raft, pick your cannon, mind the powder kegs and climb to the crow\'s nest.',
    theme: {
        sky: 0x79cdf2, ground: 0xe6cf93, turf: [0x22a37a, 0x1d966f], edge: 0x5a3a1e, rail: 0x8b5a2b,
        sand: 0xf2dca4, water: 0x1a86cf, wood: 0xa0673a, block: 0x8a877d, accent: 0xd9a514, fog: 0x79cdf2,
        bumper: 0x8a4f22, sweeper: 0x6b3f1d, slider: 0x8e44ad, flag: 0x16161a, pipe: 0x2b2b30, sail: 0xf2e8d0, tee: 0x5a3a1e,
        felt: 0x1f8f6b, raft: 0x9a6a3a, kick: 0xd9a514, mine: 'keg',
        scenery: 'pirate',
    },
    holes: [
        {   key: 'plank', name: 'WALK THE PLANK', sig: 'the plank or the pier', par: 4, tee: [0, 0], cup: [24.5, -2],
            // Off the ship onto the dock. Then the plank — off your line from the tee and
            // laid at an angle across the lagoon, the sea on both sides — or bank off the
            // dock's corner post and run the long railed pier round the lagoon.
            tiles: [{ r: [-1.5, -2.5, 7, 2.5], kind: 'wood' },
                    { r: [3, -7, 7, -2.5], kind: 'wood' },
                    { r: [7, -5, 19, 5], y: -0.4, kind: 'water', rail: false },
                    { r: [-3.7, 2.5, 7, 5], y: -0.45, kind: 'water', rail: false },
                    { r: [-3.7, -7, 3, -2.5], y: -0.45, kind: 'water', rail: false },
                    { r: [7, 1.3, 9, 2.3], kind: 'wood', open: 'nswe' },
                    { r: [9, 1.1, 11, 2.1], kind: 'wood', open: 'nswe' },
                    { r: [11, 0.9, 13, 1.9], kind: 'wood', open: 'nswe' },
                    { r: [13, 0.7, 15, 1.7], kind: 'wood', open: 'nswe' },
                    { r: [15, 0.5, 17, 1.5], kind: 'wood', open: 'nswe' },
                    { r: [17, 0.3, 19, 1.3], kind: 'wood', open: 'nswe' },
                    { r: [7, -7, 19, -5], kind: 'wood' },
                    { r: [19, -7, 27, 3], hills: [[21.5, -5.2, 1.5, 0.16], [24.5, -2, 1.3, -0.06], [21, 1.3, 1.4, 0.14]] }],
            // A rail across the end of the dock, open only where the plank
            // starts: the jump off the ship comes to rest on the dock, and the
            // choice (plank or pier) is the second shot.
            walls: [[3, -5.4, 4.6, -7, 0.4], [7, -2.5, 7, 1.3, 0.35, 'wood']],
            path: [[5, 1.8], [19.5, 0.7]],
            props: [{ type: 'barrel', at: [1, -8.3] }, { type: 'palm', at: [29, -4] }, { type: 'palm', at: [22, 5] }, { type: 'fin', at: [13, 2.8] }, { type: 'fin', at: [12, -2.6] }] },

        {   key: 'raft', name: 'THE TREASURE RAFT', sig: 'raft or the reef', par: 4, tee: [0, 0], cup: [27, -1],
            // Stop the ball on the raft and let it carry you over — or take the reef the long way,
            // through the rough and round the lagoon.
            tiles: [{ r: [-1.5, -2, 8, 2], open: 'e' },
                    { r: [8, -4, 20, 4], y: -0.35, kind: 'water', rail: false },
                    { r: [11.5, -1.6, 16.5, 1.6], kind: 'raft', move: { axis: 'x', amp: 3.5, speed: 0.45, phase: -1.5708 } },
                    { r: [20, -3, 30, 6.5], open: 'w', hills: [[27, -1, 1.4, -0.07], [24, 1.6, 1.6, 0.18]] },
                    { r: [3, 2, 8, 6.5] },
                    { r: [8, 4, 20, 6.5], kind: 'rough', ridges: [[12, 4, 12, 6.5, 0.7, 0.12], [16, 4, 16, 6.5, 0.7, 0.12]] }],
            links: [[8, 0, 20, 0], [12, 0, 20, 0], [16, 0, 20, 0]],
            props: [{ type: 'chest', at: [31.2, 2] }, { type: 'palm', at: [25, -4.4] }, { type: 'barrel', at: [6, -2.7] }, { type: 'palm', at: [14, 8] }, { type: 'palm', at: [31.5, -3] }, { type: 'barrel', at: [2, 3.2] }, { type: 'fin', at: [10, -3] }, { type: 'fin', at: [17.5, 3] }] },

        {   key: 'cannon', name: 'LOOSE CANNONS', sig: 'three loose cannons', par: 3, tee: [0, 0], cup: [23, -1.6],
            // Three loose cannons on the gun deck: roll into one and it spins round and fires
            // you wherever it ends up — by the cup, mid-fort, in the sand, back on the deck…
            // or, now and then, straight in the hole. Each has its own favourites. Or walk:
            // the gangway.
            tiles: [{ r: [-1.5, -3.5, 10, 3.5], kind: 'wood' },
                    { r: [2.6, -7.7, 4, -3.5], kind: 'wood' },
                    { r: [4, -7.7, 13, -6.3], y: 0.75, slope: [0.1667, 0], kind: 'wood', open: 'we' },
                    { r: [-1.5, -10, 13, -7.7], y: -0.4, kind: 'water', rail: false },
                    { r: [4, -6.3, 13, -3.5], y: -0.4, kind: 'water', rail: false },
                    { r: [10, -3.5, 13, 5], y: -0.4, kind: 'water', rail: false },
                    { r: [13, -7.7, 26, 1.5], y: 1.5, hills: [[18, -5, 1.6, 0.18], [21, 0.2, 1.3, 0.12]] },
                    { r: [13, 1.5, 15, 5], y: 1.5 },
                    { r: [15, 1.5, 20, 5], y: 1.5, kind: 'sand' },
                    { r: [20, 1.5, 26, 5], y: 1.5 }],
            blocks: [[5, -3.5, 6.5, -2.0, 0.7], [5, -1.3, 6.5, -0.5, 0.7]],
            pipes: [{ a: [9, 0], b: [14.5, 0], dir: [1, 0], r: 0.42, delay: 1.9, out: 1.2, style: 'cannon', color: 0xd62828,
                      scatter: [[14.5, 0], [19.5, -2.9], [16.5, 3.2], [2, 0], [23, -1.6], [18, -5]] },
                    { a: [9, -2.6], b: [19.5, -2.9], dir: [1, 0], r: 0.42, delay: 1.9, out: 1.2, style: 'cannon', color: 0xffd23f,
                      scatter: [[19.5, -2.9], [21, -5.5], [23, -1.6], [14.5, 0], [2, -2], [24.5, 2.6]] },
                    { a: [9, 2.6], b: [16.5, 3.2], dir: [1, 0], r: 0.42, delay: 1.9, out: 1.2, style: 'cannon', color: 0x3a86ff,
                      scatter: [[16.5, 3.2], [14.5, 0], [2, 2], [19.5, -2.9], [23, -1.6], [17, 4]] }],
            path: [[8.2, 0]],
            props: [{ type: 'cannon', at: [9, 0], to: [14.5, 0] }, { type: 'cannon', at: [9, -2.6], to: [19.5, -2.9] }, { type: 'cannon', at: [9, 2.6], to: [16.5, 3.2] },
                    { type: 'flagpole', at: [27.4, 6.4] }, { type: 'fort', at: [21, 7.2] }] },

        {   key: 'wheel', name: 'THE SHIP\'S WHEEL', sig: 'the wheel or the gunwale', par: 3, tee: [0, 0], cup: [24, 0],
            // The helm: a great ship's wheel turning flat across the deck — a solid rim with a gap
            // between each pair of spokes. Time it in through a gap, past the spokes and out the
            // far side, and you're on the quarterdeck. Mistime it and you're batted away. Or the
            // gunwale: the railed lane round the outside, and a bank off the stern post.
            tiles: [{ r: [-1.5, -2.5, 8, 2.5], kind: 'wood' },
                    { r: [8, -4, 18, 4], kind: 'wood' },
                    { r: [18, -2.5, 28, 2.5], hills: [[24, 0, 1.3, -0.07], [21, -1.3, 1.1, 0.12], [21, 1.3, 1.1, 0.12]] },
                    { r: [3, 2.5, 8, 7], kind: 'wood' },
                    { r: [8, 5, 28, 7], kind: 'wood' },
                    { r: [26, 2.5, 28, 5], kind: 'wood' }],
            movers: [{ type: 'sweeper', x: 13, z: 0, len: 3.6, arms: 4, speed: 1.1, mat: 'wood', rim: 3.6, rimGap: 0.6 }],
            walls: [[28, 6, 27, 7, 0.4]],
            props: [{ type: 'mast', at: [13, -5.6] }, { type: 'barrel', at: [22.5, 3.6] }, { type: 'barrel', at: [-0.5, 3.4] }] },

        {   key: 'skull', name: 'SKULL CAVE', sig: 'three tunnels', par: 3, tee: [0, 0], cup: [25.4, 0],
            // Into the skull by an eye or by the mouth. The left eye: slow, safe rough. The
            // mouth: a narrow tongue over the underground pool, dead straight. The right eye:
            // wet rock, slick as ice — fast, and it runs on at the cup.
            tiles: [{ r: [-1.5, -3, 4, 3] },
                    { r: [4, -4, 12, 4] },
                    { r: [-3.7, 3, 4, 5.5], y: -0.45, kind: 'water', rail: false },
                    { r: [-3.7, -5.5, 4, -3], y: -0.45, kind: 'water', rail: false },
                    { r: [12, -4, 24, -1.6], kind: 'rough' },
                    { r: [12, -1.6, 24, 1.6], y: -0.4, kind: 'water', rail: false },
                    { r: [12, -0.35, 24, 0.35], kind: 'wood', open: 'ns' },
                    { r: [12, 1.6, 24, 4], kind: 'ice' },
                    { r: [24, -4, 30.5, 4], open: 'e', hills: [[25.4, 0, 1.0, -0.06]] },
                    { r: [30.5, -4, 32, 1.2] },
                    { r: [30.5, 1.2, 32.5, 4], y: -0.4, kind: 'water', rail: false }],
            blocks: [[10, -1.6, 12, -0.35, 1.6], [10, 0.35, 12, 1.6, 1.6]],
            path: [[11, -2.8], [24, -2.8]],
            props: [{ type: 'skull', at: [11, 0] }, { type: 'cave', r: [14, -4, 24, 4] }, { type: 'chest', at: [33.2, 2] }] },

        {   key: 'shark', name: 'SHARK BAY', sig: 'drawbridge, jump or jetty', par: 3, tee: [0, 0], cup: [21.5, 0],
            // Wait for the drawbridge and putt straight up the hill at the cup; or hit the ramp at the dock's
            // corner and jump the sharks, over the rocks; or the long way, down the jetty.
            tiles: [{ r: [-1.5, -2, 8, 2], open: 'e' },
                    kick(6.4, 0.9, 8, 2, 'e'),
                    { r: [8, -4, 14, 5], y: -0.4, kind: 'water', rail: false },
                    { r: [8, -0.7, 14, 0.7], kind: 'wood', lift: { period: 7, down: 0.65, phase: 0 } },
                    { r: [14, -2.5, 26, 7], open: 'w', hills: [[21.5, 0, 2.6, 0.32], [21.5, 0, 0.8, -0.05]] },
                    { r: [3, 2, 8, 7] },
                    { r: [8, 5, 14, 7], kind: 'wood' }],
            walls: [[26, -2.5, 26, 7, 1.2, 'stone'], [14, 7, 26, 7, 1.2, 'stone']],
            path: [[11, 0]],
            props: [{ type: 'fin', at: [11, 2.6] }, { type: 'fin', at: [10.5, -2.6] }, { type: 'barrel', at: [24, -3.3] }, { type: 'palm', at: [20, 8.5] }] },

        {   key: 'powder', name: 'THE POWDER KEGS', sig: 'the deck cannon', par: 3, tee: [0, 0], cup: [23.5, -2.2],
            // The cup is tucked in the magazine behind the bulkhead. Roll into the deck cannon,
            // aim it, and lob yourself over the kegs at the magazine — land by a keg and it
            // goes up, and so do you. Or thread the kegs and bank off the angled timber in the
            // stern corner; or creep up the clear gunwale and come round.
            tiles: [{ r: [-1.5, -4, 26, 4], kind: 'wood', hills: [[23.5, -2.2, 1.3, -0.06]] },
                    { r: [-1.5, -7, 28, -4], y: -0.4, kind: 'water', rail: false },
                    { r: [-1.5, 4, 28, 7], y: -0.4, kind: 'water', rail: false },
                    { r: [26, -4, 28, 4], y: -0.4, kind: 'water', rail: false }],
            mines: [[7, -1.2], [7, 1.4], [10.5, 0.1], [10.5, 2.8], [14, -1.3], [14, 1.6], [17.5, 0.2], [17.5, 3]],
            blocks: [[19, -4, 20, 0.6, 0.7]],
            walls: [[23, 4, 26, 1, 0.4]],
            pipes: [{ a: [4, -2.6], b: [4, -2.6], dir: [1, 0], r: 0.42, style: 'cannon', aim: true, aimV: 1.0, color: 0xd9a514 }],
            path: [[17, -3], [21.5, 2]],
            props: [{ type: 'cannon', at: [4, -2.6], to: [12, -2.6] }, { type: 'barrel', at: [29, 2] }] },

        {   key: 'kraken', name: 'THE KRAKEN', sig: 'jump through the arms', par: 3, tee: [0, 0], cup: [25, 0.6],
            // The kraken's in the bay between the decks. Hit the ramp and jump the water —
            // its arms rise out of the sea and swat the gap, so time it for when they're down.
            // Or the long plank round the edge, leaning to the sea.
            tiles: [{ r: [-1.5, -3, 8, 3], kind: 'wood', open: 'e' },
                    kick(6, -1.2, 8, 1.2, 'e', 0, 0.6),
                    { r: [8, -5, 16, 5], y: -0.4, kind: 'water', rail: false },
                    { r: [16, -3, 29, 3], kind: 'wood', open: 'w', hills: [[25, 0.6, 1.2, -0.06], [22, -1.6, 1.2, 0.14]] },
                    { r: [3, 3, 8, 6.5], kind: 'wood' },
                    { r: [8, 5, 16, 6.5], kind: 'wood', open: 'n', slope: [0, 0.03] },
                    { r: [16, 3, 22, 6.5], kind: 'wood' }],
            movers: [{ type: 'gate', x: 10.3, z: 0, axis: 'z', w: 1.4, speed: 1.3, phase: 0, h: 1.8, tentacle: true },
                     { type: 'gate', x: 13.4, z: 0, axis: 'z', w: 1.4, speed: 0.9, phase: 2.1, h: 1.8, tentacle: true }],
            links: [[8, 0, 16, 0]],
            path: [[5.5, 4.5], [20, 5]],
            props: [{ type: 'kraken', at: [12, -6.4] }, { type: 'barrel', at: [27, -3.8] }] },

        {   key: 'crowsnest', name: 'THE CROW\'S NEST', sig: 'lift or the rigging', par: 4, tee: [0, 0], cup: [22.8, 0],
            // Up the mast in the cargo lift — its doors open only when it's level — or charge
            // the rigging: a bare board up the ship's side, the sea beneath it.
            tiles: [{ r: [-1.5, -3, 14, 3], kind: 'wood' },
                    { r: [14, -1.4, 18.4, 1.4], kind: 'carpet', elev: { amp: 2, period: 9 } },
                    { r: [18.4, -3, 27, 4.6], y: 2, hills: [[22.8, 0, 1.5, -0.08]] },
                    { r: [4, 3, 8, 4.6], kind: 'wood' },
                    { r: [8, 3, 18.4, 4.6], y: 1, slope: [0.1923, 0], kind: 'wood', open: 'ns' },
                    { r: [4, 4.6, 27, 8], y: -0.4, kind: 'water', rail: false },
                    { r: [14, 1.5, 18.4, 3], kind: 'wood' }],
            movers: [{ type: 'liftgate', x: 14, z: 0, axis: 'z', w: 1.4, tile: 1, at: 'bottom' },
                     { type: 'liftgate', x: 18.4, z: 0, axis: 'z', w: 1.4, tile: 1, at: 'top' }],
            bumpers: [[9, -1.5, 0.35, 0.6], [9, 1, 0.35, 0.6]],
            walls: [[27, -3, 27, 4.6, 1.6], [18.4, -3, 27, -3, 1.0], [18.4, 4.6, 27, 4.6, 1.0]],
            links: [[14, 0, 19.2, 0]],
            path: [[16.2, 0]],
            props: [{ type: 'mast', at: [6, -4.6] }, { type: 'barrel', at: [2, -3.6] }, { type: 'chest', at: [28.4, 2] }, { type: 'mast', at: [28.4, -2] }, { type: 'barrel', at: [12, -3.8] }, { type: 'flagpole', at: [29, 5.5] }] },
    ],
};

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'pier-bank',  course: 'pirate',   key: 'plank',      name: 'Round the Pier',        from: [4, -3],       zone: [19, -7, 27, 3] },
    { id: 'gold-gun',   course: 'pirate',   key: 'cannon',     name: 'The Golden Gun',        from: [7, -2.6],     zone: [20.5, -4.5, 25.5, 1] },
    { id: 'helm-gap',   course: 'pirate',   key: 'wheel',      name: 'Between the Spokes',    from: [6, 0],        zone: [17, -4, 28, 2.5] },
    { id: 'skull-run',  course: 'pirate',   key: 'skull',      name: 'Through the Skull',     from: [8, 0],        zone: [24, -4, 30.5, 4] },
    { id: 'shark-jump', course: 'pirate',   key: 'shark',      name: 'Jump the Sharks',       from: [6, 1.45],     zone: [18.7, -2.5, 26, 7] },
    { id: 'kegs',       course: 'pirate',   key: 'powder',     name: 'Thread the Kegs',       from: [4, 2],        zone: [20, -4, 26, 0.6] },
    { id: 'tentacles',  course: 'pirate',   key: 'kraken',     name: 'Past the Kraken',       from: [3, 0],        zone: [21, -3, 29, 3] },
    { id: 'rigging',    course: 'pirate',   key: 'crowsnest',  name: 'Up the Rigging',        from: [5, 3.8],      zone: [18.4, -3, 27, 4.6] },
];
