// The Candy course — its nine holes as data (see ../Courses.js for the format).
import { kick } from './kit.js';

// ── CANDY LAND — mint frosting, chocolate rivers, gumdrops and a donut loop ──
export const COURSE = {
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
            // cup, the two beside it put you back up on the top shelf to play it again,
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
            rollMax: 25,
            pipes: [{ a: [31.0, -1.8], b: [1.2, -1.4], dir: [1, 0], r: 0.7, delay: 0.7, out: 0, style: 'teleport', stop: true },
                    { a: [31.0, 1.8], b: [1.2, 1.4], dir: [1, 0], r: 0.7, delay: 0.7, out: 0, style: 'teleport', stop: true }],
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

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'cake-drop',  course: 'candy',    key: 'slide',      name: 'Off the Cake',          from: [3, 1],        zone: [19, -3, 25, 3] },
    { id: 'choc-jump',  course: 'candy',    key: 'river',      name: 'Jump the Chocolate',    from: [5.5, -1.5],   zone: [13, -3, 24, 3] },
    { id: 'spin-gap',   course: 'candy',    key: 'spinner',    name: 'Through the Spinner',   from: [6, 0],        zone: [14.6, -1.2, 17.4, 1.2] },
];
