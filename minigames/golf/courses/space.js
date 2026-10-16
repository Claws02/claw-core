// The Space course — its nine holes as data (see ../Courses.js for the format).
import { kick } from './kit.js';

// ── SPACE STATION — panels in orbit: fall off the edge and you're gone ──────
export const COURSE = {
    key: 'space', name: 'SPACE STATION', blurb: 'Ride the anti-grav lift, pick a portal, slingshot round black holes, jump moon crevasses, time the lasers and fly the solar wind.',
    theme: {
        sky: 0x05060f, ground: null, turf: [0x2c3170, 0x262b64], edge: 0x9aa3b5, rail: 0x22d3ee, railGlow: true,
        sand: 0x9a9aa8, water: 0x22d3ee, boost: 0xfacc15, wood: 0x6b7280, block: 0x4b5563, accent: 0xf472b6, fog: 0x05060f,
        bumper: 0x8b5cf6, sweeper: 0xf43f5e, slider: 0xef4444, flag: 0x22d3ee, pipe: 0xa855f7, sail: 0xc7d2fe, tee: 0x111827, loop: 0x22d3ee,
        felt: 0x343a86, conveyor: 0x374151, moon: 0x9ca3af, metal: 0x4a5370, kick: 0xfacc15, mine: 'spike',
        windmill: 'airlock', scenery: 'space', void: 0x2a0a4a,
    },
    holes: [
        {   key: 'liftoff', name: 'THE ANTI-GRAV LIFT', sig: 'lift or the launch ramp', par: 3, tee: [0, 0], cup: [25, 3.8], rail: 'neon', gravity: 0.5,
            // Two ways up to the flight deck. The lift: boost into it while its
            // door is open, ride it up and putt off the top. Or the launch ramp:
            // fly the void straight onto the deck — short and you're in the gap,
            // long and you're over the back.
            tiles: [{ r: [-1.5, -1.5, 7, 5.5] },
                    { r: [7, -1.5, 8, 1.5] }, { r: [8, -1.5, 11, 1.5], kind: 'boost', boost: [6, 0] }, { r: [11, -1.5, 14, 1.5] },
                    { r: [14, -1.5, 17, 1.5], kind: 'boost', boost: [2.5, 0], elev: { amp: 1.8, period: 6 } },
                    { r: [7, 2.5, 9, 5.5], kind: 'metal' }, { r: [9, 2.5, 11.5, 5.5], kind: 'boost', boost: [7, 0] },
                    kick(11.5, 2.5, 13, 5.5, 'e', 0, 0.6),
                    { r: [17, -3, 28, 7.5], y: 1.8, kind: 'felt', hills: [[25, 3.8, 1.4, -0.08], [21.8, 1.6, 1.9, 0.3], [25.5, 0, 1.3, 0.25]] }],
            movers: [{ type: 'liftgate', x: 14, z: 0, axis: 'z', w: 1.5, tile: 4, at: 'bottom' },
                     { type: 'liftgate', x: 17, z: 0, axis: 'z', w: 1.5, tile: 4, at: 'top' }],
            // A low force-field round the deck: it turns a rolling ball, not a flying one.
            walls: [[28, -3, 28, 7.5, 0.45], [17, -3, 28, -3, 0.45], [17, 7.5, 28, 7.5, 0.45]],
            links: [[14, 0, 17.8, 0], [13.5, 4, 18, 4]],
            path: [[12.5, 0]],
            props: [{ type: 'beacon', at: [7.8, -2.3] }, { type: 'beacon', at: [13.5, 6.6] }, { type: 'satellite', at: [14, -9] }] },

        {   key: 'hub', name: 'THE TELEPORTER HUB', sig: 'pick a portal', par: 4, tee: [0, 2.5], cup: [31, 1], rail: 'neon',
            // The tee deck is an island: the only way off is a portal — and the hub reroutes
            // them every round. One drops you on the back platform (the long way round), one on
            // the mid deck (a narrow bridge from the green), one beside the cup: read the exit
            // pads' colours on the map. RED, dead ahead, is easy; YELLOW is past the sliding
            // emitter; GREEN hides behind the bulkhead (bank it in off the far rail).
            tiles: [{ r: [-1.5, -4.5, 10, 4.5] },
                    { r: [13, -3, 21, 3] },                                   // mid deck
                    { r: [21, -0.9, 24.5, 0.9], kind: 'metal', open: 'ns' },    // the bridge, no rails
                    { r: [24.5, -4, 35, 4], kind: 'felt', hills: [[31, 1, 1.5, -0.08], [29, -2, 1.2, 0.2]] },   // the green
                    { r: [1, 7, 9, 11] },                                     // the back platform
                    { r: [9, 8, 31, 10.5], kind: 'metal' },                   // the long catwalk
                    { r: [29, 4, 32.5, 8] }],
            walls: [[6.6, -2.6, 8.3, -2.6], [6.6, -4.5, 6.6, -2.6], [7.6, 2.4, 10, 2.4]],
            movers: [{ type: 'slider', x: 7.3, z: 3.4, bar: 'z', axis: 'z', len: 0.9, amp: 0.45, speed: 1.5 }],
            pipes: [{ a: [6.5, -1.4], b: [3, 9], dir: [1, 0], r: 0.45, out: 3, style: 'teleport', color: 0xef4444, shuffle: true },
                    { a: [9.1, 3.5], b: [14.5, 0], dir: [1, 0], r: 0.4, out: 3, style: 'teleport', color: 0xfacc15, shuffle: true },
                    { a: [8.6, -3.7], b: [27.5, -1], dir: [1, 0.4], r: 0.4, out: 2.2, style: 'teleport', color: 0x22c55e, shuffle: true }],
            props: [{ type: 'crystal', at: [11.5, 0] }, { type: 'satellite', at: [18, -8] }, { type: 'beacon', at: [-0.5, 6.2] }] },

        {   key: 'belt', name: 'THE MINEFIELD', sig: 'minefield or the bank', par: 3, tee: [0, 0], cup: [24.5, -5], rail: 'neon', blockMat: 'metal',
            // A bulkhead stands between you and the cup. Left: the minefield,
            // short and straight but with no rail on the void side — a mine
            // throws you back, and maybe off. Right: the railed asteroid lane,
            // safe, and its angled hull plate banks a good one round to the cup.
            tiles: [{ r: [-1.5, -2.5, 10, 2.5] },
                    { r: [10, -8, 27, 6.5], open: 'n' }],
            blocks: [[14, -3, 22, 1.2, 0.8]],
            walls: [[23, 6.5, 27, 2.5, 0.5]],
            bumpers: [[13, 4, 0.45], [17.5, 3.6, 0.5], [21, 5, 0.4]],
            mines: [[12.5, -5.2], [15, -6.6], [16, -4.2], [18.5, -5.6], [20.8, -7], [21.2, -4.1], [11.6, -7.2], [25.6, -1.6]],
            path: [[12, -4.5]],
            props: [{ type: 'planet', at: [10, -18] }, { type: 'satellite', at: [30, 9] }] },

        {   key: 'moon', name: 'MOON CRATERS', sig: 'crevasse jump or the gantry', par: 3, tee: [0, 0], cup: [25, 1.5], gravity: 0.45, rail: 'neon',
            // Low gravity and a crevasse: launch off the ramp and fly it (the
            // moon lets you — too much and you're over the far side), or creep
            // round on the narrow gantry. The craters on the far side catch a
            // ball that lands short.
            tiles: [{ r: [-1.5, -4, 12, 4],
                      hills: [[5, -1.5, 2, 0.35], [5, -1.5, 1.3, -0.45], [8.5, 2.2, 1.5, 0.3], [8.5, 2.2, 0.9, -0.35]] },
                    kick(10.4, -1.5, 12, 0.5, 'e', 0, 0.5),
                    { r: [9, 4, 10.5, 7], kind: 'metal' }, { r: [10.5, 5.8, 19.5, 7], kind: 'metal' }, { r: [18, 4, 19.5, 5.8], kind: 'metal' },
                    { r: [18, -4, 32, 4], kind: 'rough', open: 'e', hills: [[21, -1.2, 2.2, -0.45], [21, -1.2, 3, 0.2], [27.5, -2, 1.6, 0.3], [25, 1.5, 1.0, -0.06]],
                      ridges: [[30, -4, 30, 4, 1.2, 0.35]] }],
            // Struts at the gantry's two bends: bank round them.
            walls: [[9, 6, 10, 7, 0.5], [18.5, 7, 19.5, 6, 0.5]],
            links: [[12, -0.5, 18, -0.5]],
            props: [{ type: 'flagpole', at: [3, -4.8], moon: true }, { type: 'satellite', at: [14, 10] }, { type: 'crystal', at: [15, -2] }] },

        {   key: 'lasers', name: 'THE LASER GRID', sig: 'lasers or the duct', par: 3, tee: [0, 0], cup: [30, -0.5], rail: 'neon',
            // Straight down the grid: four laser fences blinking at four
            // different rates — read them and go, or be thrown back. Or the
            // service duct: no lasers, but two blind bends to bank round and
            // the vents blowing across it.
            tiles: [{ r: [-1.5, -2.2, 33, 2.2] },
                    { r: [2, 2.2, 4, 7] }, { r: [2, 7, 28, 9], kind: 'metal' }, { r: [26, 2.2, 28, 7] }],
            walls: [[2, 7, 4, 9, 0.5], [26, 9, 28, 7, 0.5]],
            bumpers: [[12, 8.4, 0.18, 0, 0.6], [19, 7.6, 0.18, 0, 0.6]],
            fans: [{ r: [8, 7, 11, 9], f: [0, -3] }, { r: [15, 7, 18, 9], f: [0, 3] }, { r: [22, 7, 25, 9], f: [0, -3] }],
            movers: [{ type: 'gate', x: 9, z: 0, axis: 'z', w: 2.2, speed: 1.4, phase: 0, laser: true },
                     { type: 'slider', x: 13, z: 0, bar: 'z', axis: 'z', len: 1.4, amp: 1.2, speed: 1.6 },
                     { type: 'gate', x: 17, z: 0, axis: 'z', w: 2.2, speed: 0.9, phase: 2.0, laser: true },
                     { type: 'gate', x: 21, z: 0, axis: 'z', w: 2.2, speed: 2.1, phase: 1.0, laser: true },
                     { type: 'gate', x: 25, z: 0, axis: 'z', w: 2.2, speed: 1.15, phase: 4.0, laser: true }],
            props: [{ type: 'satellite', at: [14, -8] }] },

        {   key: 'magnets', name: 'BLACK HOLES', sig: 'slingshot round the black holes', par: 3, tee: [0, 0], cup: [25, 0], rail: 'neon', blockMat: 'metal',
            // An asteroid sits dead in line with the cup. Curve round it on the
            // pull of a black hole: the near one pulls hard (a tight, quick
            // line — and if it catches you, you're gone), the far one gently
            // (a wide, safe arc). Or bank it round off the hull.
            tiles: [{ r: [-1.5, -9, 32, 9] },
                    { r: [13.9, -4.8, 15.1, -3.6], y: 0.03, kind: 'void' },
                    { r: [13.9, 3.6, 15.1, 4.8], y: 0.03, kind: 'void' },
                    { r: [28.6, -0.5, 29.6, 0.5], y: 0.03, kind: 'void' }],
            blocks: [[13.4, -1.4, 15.6, 1.4, 0.8]],
            magnets: [{ x: 14.5, z: -4.2, r: 4.6, k: 8, hole: true }, { x: 14.5, z: 4.2, r: 4.6, k: 8, hole: true }, { x: 29.1, z: 0, r: 2.6, k: 5, hole: true }],
            props: [{ type: 'planet', at: [-10, 16] }] },

        {   key: 'airlock', name: 'THE AIRLOCKS', sig: 'airlocks or the spacewalk', par: 5, tee: [0, 0], cup: [4, 13], rail: 'neon', blockMat: 'metal',
            // A U round the module. Inside: two airlock doors to time, and a
            // hull plate at the far bend to bank off into the last leg, where
            // the solar array turns. Outside: the spacewalk, a narrow ledge with
            // no rails that cuts the first corner — bank off the strut at its
            // bend, and keep it on the ledge.
            tiles: [{ r: [-1.5, -2, 18, 2] }, { r: [14, 2, 18, 15] }, { r: [1, 11, 14, 15], kind: 'felt' },
                    { r: [3, 2, 4.4, 6.4], kind: 'metal', open: 'we' }, { r: [4.4, 5, 14, 6.4], kind: 'metal', open: 'ns' }],
            blocks: [[8, -2, 9, -0.5, 1.2], [8, 0.5, 9, 2, 1.2], [14, 7.5, 15.5, 8.5, 1.2], [16.5, 7.5, 18, 8.5, 1.2]],
            walls: [[3, 5.4, 4, 6.4, 0.5], [16, 15, 18, 13, 0.5], [16, -2, 18, 0, 0.5]],
            movers: [{ type: 'windmill', x: 8.5, z: 0, axis: 'z', w: 0.5, speed: 1.2 }, { type: 'windmill', x: 16, z: 8, axis: 'x', w: 0.5, speed: 2.0 },
                     { type: 'sweeper', x: 9, z: 13, len: 1.7, speed: 1.1 }],
            path: [[16, 0], [16, 13]],
            props: [{ type: 'beacon', at: [8.5, -2.7] }, { type: 'beacon', at: [18.7, 8] }, { type: 'satellite', at: [11, -6] }] },

        {   key: 'cargo', name: 'THE CARGO BAY', sig: 'belts, catwalk or the mass driver', par: 4, tee: [0, 0], cup: [30.5, -3], rail: 'neon', blockMat: 'metal',
            // Four belts, each running its own way: fight across them, or climb
            // to the catwalk (no rail on the belt side) and walk it to the far
            // stairs. Or the mass driver, boxed in behind the crates: bank it
            // in off the back wall and it fires you clean across the bay.
            tiles: [{ r: [-1.5, -6, 6, 6] },
                    { r: [6, -6, 9, 6], kind: 'conveyor', flow: [0, 1.6] },
                    { r: [9, -6, 12, 6] },
                    { r: [12, -6, 15, 6], kind: 'conveyor', flow: [0, -2] },
                    { r: [15, -6, 18, 6] },
                    { r: [18, -6, 21, 6], kind: 'conveyor', flow: [0, 1.4] },
                    { r: [21, -6, 24, 6] },
                    { r: [24, -6, 27, 6], kind: 'conveyor', flow: [0, -1.8] },
                    { r: [27, -6, 33, 6] },
                    { r: [2, -5.8, 6, -4.6], y: 0.8, slope: [0.4, 0], kind: 'metal' },
                    { r: [6, -5.8, 27, -4.6], y: 1.6, kind: 'metal', open: 's' },
                    { r: [27, -5.8, 30, -4.6], y: 0.8, slope: [-0.5333, 0], kind: 'metal' }],
            blocks: [[10, 3, 11, 4, 0.6], [16, -3.6, 17, -2.6, 0.6], [22, 2, 23, 3, 0.6], [29.6, 0.2, 32, 1.2, 0.6],
                     [3.4, 3.7, 5.7, 4.0, 0.6], [3.4, 4.0, 3.7, 5.2, 0.6], [5.7, 3.7, 6, 6, 0.6], [2.6, 1.2, 3.6, 2.2, 0.6]],
            pipes: [{ a: [4.9, 5.0], b: [28.5, 4.6], dir: [1, 0], r: 0.36, out: 3.5, style: 'cannon', color: 0xf97316 }],
            props: [{ type: 'crate', at: [3, 6.8] }, { type: 'crate', at: [31, 6.8] }, { type: 'crate', at: [16, 6.9] },
                    { type: 'container', at: [9, -7.9], color: 0x2563eb, len: 3.2 }, { type: 'container', at: [21, -7.9], color: 0xdc2626, len: 3.2, stack: true },
                    { type: 'container', at: [24, 8], color: 0x16a34a }, { type: 'container', at: [9.5, 8], color: 0xf97316, len: 3.4 }] },

        {   key: 'wind', name: 'THE SOLAR WIND', sig: 'the windy bridge or the long way', par: 3, tee: [0, 0], cup: [24, 1.2], rail: 'neon', start: 'none',
            // The bridge is straight at the cup, no rails, and the solar wind
            // gusts across it one way then the other. Or the long way: down the
            // railed solar array and back, two shots and a bank.
            tiles: [{ r: [-1.5, -3, 6, 3] }, { r: [6, -1.25, 18, 1.25], open: 'ns', kind: 'felt' }, { r: [18, -4, 29, 4], open: 'e', ridges: [[27.4, -4, 27.4, 4, 1.3, 0.4]] },
                    { r: [2, 3, 5, 9] }, { r: [5, 6.5, 24, 9], kind: 'metal' }, { r: [22, 4, 25, 6.5] }],
            walls: [[24, 8, 23, 9, 0.5]],
            fans: [{ r: [8, -2.5, 11, 2.5], f: [0, 4.5] }, { r: [13.5, -2.5, 16.5, 2.5], f: [0, -4.5] }],
            props: [ { type: 'planet', at: [16, -18] }] },
    ],
};

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'moon-jump',  course: 'space',    key: 'moon',       name: 'Moon Jump',             from: [7, 1],        zone: [18, -4, 30, 4] },
    { id: 'sling',      course: 'space',    key: 'magnets',    name: 'Black Hole Slingshot',  from: [6, 3],        zone: [20, -4, 29, 4] },
    { id: 'mines',      course: 'space',    key: 'belt',       name: 'Minefield Run',         from: [11, -4],      zone: [21, -8, 27, -3] },
    { id: 'launch',     course: 'space',    key: 'liftoff',    name: 'Launch Ramp',           from: [3, 4],        zone: [17, -3, 28, 7.5] },
    { id: 'green-port', course: 'space',    key: 'hub',        name: 'The Green Portal',      from: [4, 1],        zone: [26, -4, 35, 4] },
    { id: 'solar-wind', course: 'space',    key: 'wind',       name: 'Ride the Solar Wind',   from: [8, -0.5],     zone: [18, -4, 28.5, 4] },
];
