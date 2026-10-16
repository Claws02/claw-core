// The Candy course — its nine holes as data (see ../Courses.js for the format).
import { kick } from './kit.js';

// Plinko's pegs: staggered rows of gumdrops, the outside pegs hugging the rails.
const _pegs = () => {
    const out = [];
    for (let row = 0; row < 11; row++) {
        const x = 6.6 + row * 2.05, n = row % 2 ? 9 : 10, z0 = row % 2 ? -4.2 : -4.725;
        for (let k = 0; k < n; k++) out.push([x, +(z0 + k * 1.05).toFixed(3), 0.17, 0, 0.82, 0.38]);
    }
    return out;
};

// Licorice: the colours the tubes are told apart by.
const RED = 0xe0263f, YEL = 0xffc93b, GRN = 0x46c46e;

// ── CANDY LAND — mint frosting, chocolate rivers, gumdrops and a donut loop ──
export const COURSE = {
    key: 'candy', name: 'CANDY LAND', blurb: 'The sugar rink, the chocolate river, the donut loop, jelly jumps, gumball plinko, three ways off the cake and the licorice tower.',
    theme: {
        sky: 0xffc9e6, ground: 0xe56aa4, turf: [0x55c995, 0x4bbb88], edge: 0x6b3b1f, rail: 0xffffff, railTex: 'cane',
        sand: 0xd08a2e, goo: 0x5a3218, water: 0x5a3218, ice: 0x8fd0f2, wood: 0xe9b866, block: 0xff6fae, accent: 0xff3b6b, fog: 0xffc9e6,
        bumper: 0xff5fa2, sweeper: 0xff3b6b, slider: 0x8a5cf6, flag: 0xff3b6b, pipe: 0x2a1a22, sail: 0xfff3fa, tee: 0xffffff, loop: 0xf9a8d4,
        felt: 0x4fbf8a, creek: 0x7a4a26, jelly: 0xff4fa0, kick: 0xff3b6b,
        scenery: 'candy', creekStyle: 'choc',
    },
    holes: [
        // ── 1 ── Ice billiards. A gumdrop wall stands between the tee and the cup:
        // bank it off a side rail, kick it off a corner deflector, or creep up a
        // side and chip in. On ice the weight is everything.
        {   key: 'rink', name: 'THE SUGAR ICE RINK', sig: 'ice billiards', par: 3, tee: [0, 0], cup: [23, 0], rail: 'candy', blockMat: 'candy',
            tiles: [{ r: [-1.5, -2, 7, 2] },
                    { r: [7, -7, 20.5, 7], kind: 'ice' },
                    { r: [20.5, -7, 25, -2.5], kind: 'ice' }, { r: [20.5, 2.5, 25, 7], kind: 'ice' },
                    { r: [20.5, -2.5, 25, 2.5], kind: 'felt' }],
            blocks: [[15, -2.2, 18.5, 2.2, 0.6]],
            walls: [[21, -7, 25, -3, 0.4], [21, 7, 25, 3, 0.4]],
            path: [[9, 0], [14, -4.6], [20, -4.6]],
            props: [{ type: 'cupcake', at: [16.5, 8.4] }, { type: 'lollipop', at: [4, -3] }, { type: 'gumdrop', at: [26.4, 0] }] },

        {   key: 'river', name: 'THE CHOCOLATE RIVER', sig: 'shoot the rapids', par: 3, tee: [0, 0], cup: [27.5, 4.6], rail: 'candy',
            // High on the cake, the chocolate river runs to the flag — through gumdrop rapids to a
            // fork. The south channel slows and lets you off on the green; the north one runs
            // straight over the falls. Pick your line through the rocks. Or the wafer bank: dry,
            // safe, and a stroke longer.
            tiles: [{ r: [-1.5, -3, 4, 3], y: 1.5, open: 'e' },
                    { r: [-1.5, 3, 4, 8], y: 1.5 },
                    { r: [4, -3, 17, 3], y: 1.5, kind: 'creek', flow: [2.6, -0.1], open: 'we' },
                    { r: [17, -3, 24, 1], y: 1.5, kind: 'creek', flow: [3.2, 0], open: 'we' },
                    { r: [24, -3, 26, 1], y: -0.6, kind: 'goo', rail: false },
                    { r: [17, 1, 21, 3], y: 1.5, kind: 'creek', flow: [2.2, 0], open: 'we' },
                    { r: [4, 3, 21, 8], y: 1.5, kind: 'wood' },
                    { r: [21, 1, 31, 8], y: 1.5, hills: [[27.5, 4.6, 1.5, -0.09], [24, 6.6, 1.1, 0.12]] }],
            walls: [[4, 3, 17, 3, 0.35], [17, 1, 26, 1, 0.5], [11, 3, 11, 6.6, 0.6], [16, 4.4, 16, 8, 0.6]],
            bumpers: [[8, -1.3, 0.45, 0.6], [10.6, 1.3, 0.45, 0.6], [13, -0.4, 0.45, 0.6], [15.4, 1.9, 0.4, 0.6], [15.6, -2.1, 0.4, 0.6]],
            path: [[10, 5.5], [21, 4]],
            props: [{ type: 'chocfall', at: [23.95, -1], dir: [1, 0], w: 4, drop: 2.1 },
                    { type: 'cupcake', at: [33, 3] }, { type: 'lollipop', at: [2, -4.6] }, { type: 'cookie', at: [12, 9.6] }, { type: 'gumdrop', at: [29, -1.6] }] },

        // ── 3 ── A real loop-the-loop on a pair of iced donuts: it wants pace (too soft and
        // it rolls back down to you), and the green it shoots you onto ends in chocolate —
        // or take the sugar-glass lane, cambered toward the goo.
        {   key: 'donut', name: 'THE DONUT LOOP', sig: 'loop or the glass lane', par: 3, tee: [0, 0], cup: [22.5, 2.4], rail: 'candy',
            tiles: [{ r: [-1.5, -1.5, 6, 4.5] },
                    { r: [6, -1.5, 17, 1.5] },
                    { r: [6, 2.5, 17, 4.5], kind: 'ice', slope: [0, 0.025], open: 's' },
                    { r: [6, 4.5, 17, 6.5], y: -0.6, kind: 'goo', rail: false },
                    { r: [17, -3, 26.5, 4.5], y: 0.2375, slope: [0.05, 0], hills: [[22.5, 2.4, 1.6, -0.1]], open: 'e' },
                    { r: [26.5, -3, 29, 4.5], y: -0.6, kind: 'goo', rail: false }],
            walls: [[6, 2, 17, 2, 0.4]],
            loops: [{ a: [7.5, 0], dir: [1, 0], len: 6.5, minV: 6, w: 0.9, rad: 1.45, track: true, dur: 1.7 }],
            bumpers: [[20.2, 0.9, 0.4, 0.8], [24.6, 0.4, 0.4, 0.8]],
            path: [[7.5, 0], [17, 0]],
            props: [{ type: 'cupcake', at: [3, -2.6] }, { type: 'lollipop', at: [15.5, -2.6] }, { type: 'cherry', at: [22, -4] }] },

        // ── 4 ── Three tiers of cake over a chocolate moat. Jelly pads throw you up
        // and over — chain both and you can fly all the way up (or into the brown
        // sugar behind the flag); the wafer bridge and the ramp go the long way round.
        {   key: 'jelly', name: 'JELLY JUMP', sig: 'jelly pads', par: 3, tee: [0, 0], cup: [22.5, -1], rail: 'candy',
            tiles: [{ r: [-1.5, -5, 7, 2.5] },
                    { r: [7, -2, 8.5, 2.5], kind: 'jelly' },
                    { r: [7, -5, 8.5, -2] },
                    { r: [8.5, -3.4, 11, 7], y: -0.6, kind: 'goo', rail: false },
                    { r: [8.5, -5, 11, -3.4], y: 0.25, slope: [0.2, 0], kind: 'wood' },
                    { r: [11, -5, 16.5, 3], y: 0.5 },
                    { r: [16.5, -5, 18, -3], y: 0.5 },
                    { r: [16.5, -3, 18, 3], y: 0.5, kind: 'jelly' },
                    { r: [11, 3, 18, 5], y: 0.8, slope: [0.6 / 7, 0], kind: 'wood' },
                    { r: [18, -5, 25.5, 5], y: 1.1 },
                    { r: [25.5, -5, 28, 5], y: 1.1, kind: 'sand' }],
            walls: [[11, 3, 11, 5, 0.7], [11, 5, 18, 5, 1.4], [16.5, 3, 18, 3, 0.35]],
            bumpers: [[20.5, 1.6, 0.4, 0.8], [20.5, -3.4, 0.4, 0.8]],
            links: [[7.75, 0, 12, 0], [17.25, 0, 19, 0]],
            path: [[7.75, 0], [14, 0], [19, -1]],
            props: [{ type: 'gummy', at: [12.5, 6.4], color: 0x46c46e, rot: -0.4 }, { type: 'gummy', at: [14, -6.4], color: 0xffc93b, rot: 0.3, s: 1.2 }, { type: 'cupcake', at: [21.5, 6.6] },
                    { type: 'gummy', at: [4, -6.4], color: 0xe0263f, rot: 0.2 }, { type: 'gummy', at: [27, -6.4], color: 0x8a5cf6, rot: -0.2, s: 0.9 }] },

        {   key: 'plinko', name: 'GUMBALL PLINKO', sig: 'plinko drop', par: 3, tee: [0, 0], cup: [33.4, 0], rail: 'candy',
            // Tip it off the top shelf and down the long board through a forest of
            // gumdrop pegs. Every peg knocks it a little off true: where it lands
            // is anyone's guess. Five slots at the bottom — the middle one has the
            // cup, the two beside it put you back up on the top shelf to play it again,
            // and the rest run on into the tray behind, leaving a putt to the cup.
            tiles: [{ r: [-1.5, -5, 4, 5], y: 12.39 },
                    { r: [4, -5, 30, 5], y: 6.54, slope: [-0.45, 0], kind: 'ice' },
                    { r: [30, -5, 34.5, 5], y: 0.555, slope: [-0.06, 0], kind: 'felt' }],
            bumpers: _pegs(),
            // Tall sugar-glass sides down the board: nothing jumps out over the rail.
            walls: [[4, -5, 30, -5, 1.1], [4, 5, 30, 5, 1.1],
                    [30.3, -2.6, 32.4, -2.6, 0.5], [30.3, -1, 32.4, -1, 0.5], [30.3, 1, 32.4, 1, 0.5], [30.3, 2.6, 32.4, 2.6, 0.5],
                    [31.6, -2.6, 31.6, -1, 0.5], [31.6, 1, 31.6, 2.6, 0.5]],
            rollMax: 25,
            pipes: [{ a: [31.0, -1.8], b: [1.2, -1.4], dir: [1, 0], r: 0.7, delay: 0.7, out: 0, style: 'teleport', stop: true },
                    { a: [31.0, 1.8], b: [1.2, 1.4], dir: [1, 0], r: 0.7, delay: 0.7, out: 0, style: 'teleport', stop: true }],
            path: [[5, 0], [30, 0], [31, 0]],
            props: [{ type: 'gumballs', at: [1.5, -6.2] }, { type: 'lollipop', at: [33, 6.4] }, { type: 'lollipop', at: [33, -6.4] }] },

        // ── 6 ── Three ways off the top of the cake: the candy-cane corkscrew at the far end
        // (a long, weighted putt to reach it — it puts you down a way short of the cup), the
        // licorice tube tucked behind the wafer wall (bank it in and it drops you by the cup),
        // or the long way down: the icing ramps round the back of the cake.
        {   key: 'slide', name: 'THE CANDY-CANE SLIDE', sig: 'three ways down', par: 3, tee: [0, 0], cup: [21.5, 1.2], rail: 'candy',
            tiles: [{ r: [-1.5, -4, 10, 4], y: 3 },
                    { r: [10, -4, 12, 4], y: -0.6, kind: 'goo', rail: false },
                    { r: [12, -4, 13.5, 4], y: -0.52, slope: [0.08, 0], kind: 'rough' },
                    { r: [13.5, -4, 24, 4], slope: [0.08, 0], hills: [[21.5, 1.2, 1.5, -0.1]] },
                    { r: [24, -4, 26.5, 4], y: 0.52, slope: [0.08, 0], kind: 'sand' },
                    // The long way: down the icing ramps round the back of the cake.
                    { r: [-1.5, 4, 1.5, 14], y: 2.25, slope: [0, -0.15], kind: 'wood' },
                    { r: [-1.5, 14, 4, 17], y: 1.5 },
                    { r: [4, 14, 17, 17], y: 0.68, slope: [-0.126, 0], kind: 'wood' },
                    { r: [17, 4, 24, 17], y: 0.14, slope: [0.08, 0] }],
            walls: [[6.2, 2.6, 10, 2.6, 0.4], [6.2, 2.6, 6.2, 3.3, 0.4],
                    [12, -4, 26.5, -4, 0.9], [24, 4, 26.5, 4, 0.9], [26.5, -4, 26.5, 4, 0.9], [12, 4, 13.5, 4, 0.9],
                    [13.5, 4, 17, 4, 0.9]],
            loops: [{ a: [9.2, -1], dir: [1, 0], len: 1, w: 0.7, minV: 1.6, style: 'corkscrew', b: [12.8, -2.8], out: [1, 0.15], outV: 3.0, dur: 1.8 }],
            pipes: [{ a: [9.3, 3.3], b: [17.4, 3], dir: [1, -0.3], r: 0.36, out: 1.4, style: 'hose', color: RED }],
            bumpers: [[16.5, -1.2, 0.4, 0.8], [16.5, 1.6, 0.4, 0.8], [19.6, -0.2, 0.35, 0.8]],
            links: [[9.2, -1, 12.8, -2.8]],
            path: [[9.2, -1], [14, 0]],
            props: [{ type: 'cupcake', at: [1, -5.4] }, { type: 'cane', at: [14, -4.8] }, { type: 'lollipop', at: [28, -3.2] }, { type: 'gummy', at: [8, 18.4], color: 0x46c46e }] },

        // ── 7 ── The cup sits in the middle of a turning ring of candy baffles, round
        // the corner from the tee behind a peppermint screen. Bank in off the far rail
        // and time the gap, or play out to the open side and come in straight.
        {   key: 'spinner', name: 'THE LOLLIPOP SPINNER', sig: 'spinner', par: 3, tee: [0, 0], cup: [16, 6], rail: 'candy',
            tiles: [{ r: [-1.5, -2, 8, 2] }, { r: [8, -2, 23, 12], hills: [[16, 6, 1.0, -0.06]] }],
            movers: [{ type: 'sweeper', x: 16, z: 6, r0: 1.2, len: 2.6, arms: 4, speed: 0.8, mat: 'candy' }],
            walls: [[9.5, 2.5, 12.5, 5.5, 0.45], [23, 9, 20, 12, 0.4], [20.5, -2, 23, 0.5, 0.4]],
            bumpers: [[10.2, 10.6, 0.4], [21.4, 3.2, 0.4]],
            path: [[11, 0], [16, 1.5]],
            props: [{ type: 'lollipop', at: [5, 3] }, { type: 'gumdrop', at: [24.2, 6] }, { type: 'cupcake', at: [6.4, 9] }] },

        // ── 8 ── Down the frosting slide to the foot of a cupcake mountain, the cup in
        // its crater. Straight up the face wants perfect weight: short rolls back,
        // long runs down the back into the brown sugar. Or thread the wafer plank over
        // the goo to the licorice tube, which pops you up on the crater's rim.
        {   key: 'mountain', name: 'CUPCAKE MOUNTAIN', sig: 'volcano', par: 3, tee: [0, 0], cup: [17.5, 0], rail: 'candy',
            tiles: [{ r: [-1.5, -3, 9, 3] }, { r: [3, -8, 9, -3] },
                    { r: [9, -4.6, 15, 4.5], hills: [[17.5, 0, 5.8, 1.5], [17.5, 0, 1.6, -0.5]] },
                    { r: [13, 4.5, 15, 8], hills: [[17.5, 0, 5.8, 1.5]] },
                    { r: [15, -8, 24, 8], hills: [[17.5, 0, 5.8, 1.5], [17.5, 0, 1.6, -0.5]] },
                    { r: [24, -8, 26.5, 8], kind: 'sand' },
                    { r: [9, -6.4, 15, -5.0], kind: 'wood', open: 'ns' },
                    { r: [9, -8, 15, -6.4], y: -0.6, kind: 'goo', rail: false },
                    { r: [9, -5.0, 15, -4.6], y: -0.6, kind: 'goo', rail: false },
                    { r: [9, 4.5, 13, 8], kind: 'sand' }],
            pipes: [{ a: [14.2, -5.6], b: [17.5, -1.35], dir: [0.3, 1], r: 0.36, out: 0.6, style: 'hose', color: YEL }],
            path: [[9, 0], [12, 0]],
            props: [{ type: 'cherry', at: [26, 9.4] }, { type: 'lollipop', at: [21, -9.4] }, { type: 'gumdrop', at: [6, 4.4] }] },

        // ── 9 ── The cake tower: three licorice tubes in the hall at its foot. Red runs
        // all the way to the top tier by the flag (if you can bank it into its nook),
        // yellow to the landing half-way up, and green — sitting right in the way —
        // back down to the tee. Or climb it: the wafer ramp, the middle tier, the
        // stair, the landing, and the last ramp to the top.
        {   key: 'tower', name: 'THE LICORICE TOWER', sig: 'pick a tube', par: 4, tee: [0, 0], cup: [13, -8.5], rail: 'candy',
            tiles: [{ r: [-1.5, -2, 8, 2] },
                    { r: [8, -5, 14, 5] },
                    { r: [14, 1.5, 20, 5], y: 0.4, slope: [0.8 / 6, 0], kind: 'wood' },
                    { r: [20, -5, 26, 5], y: 0.8 },
                    { r: [26, -1.5, 30, 1.5], y: 1.2, slope: [0.2, 0], kind: 'wood' },
                    { r: [30, -11, 34, 1.5], y: 1.6 },
                    { r: [20, -11, 30, -7], y: 2.0, slope: [-0.08, 0], kind: 'wood' },
                    { r: [10, -11, 20, -6], y: 2.4, kind: 'felt' }],
            walls: [[11.8, -2.6, 14, -2.6, 0.45]],
            bumpers: [[23, 1, 0.4, 0.8], [32, -6, 0.4, 0.8], [17, -9.6, 0.35, 0.8]],
            pipes: [{ a: [13.1, -4.1], b: [16, -7], dir: [-1, -0.5], r: 0.36, out: 0.9, style: 'hose', color: RED },
                    { a: [13.1, 3.8], b: [32, -1], dir: [0, -1], r: 0.36, out: 1.0, style: 'hose', color: YEL },
                    { a: [10.6, 0], b: [1, 0], dir: [1, 0], r: 0.36, out: 1.2, style: 'hose', color: GRN }],
            path: [[12, 3], [17, 3.2], [23, 0], [28, 0], [32, -2], [32, -9], [25, -9], [18, -8.5]],
            props: [{ type: 'cherry', at: [8.6, -12.4] }, { type: 'cupcake', at: [17, -1.4] }, { type: 'lollipop', at: [10.5, 6.4] }, { type: 'cane', at: [35.4, -4] }, { type: 'gumdrop', at: [28, 3.4] }] },
    ],
};

/** Trick shots on this course (see ../Courses.js). */
export const CHALLENGES = [
    { id: 'cake-drop',  course: 'candy',    key: 'slide',      name: 'Down the Cane',         from: [0, 0],        zone: [16, -4, 24, 4] },
    { id: 'choc-jump',  course: 'candy',    key: 'river',      name: 'Shoot the Rapids',      from: [0, 0],        zone: [21, 1, 31, 8] },
    { id: 'spin-gap',   course: 'candy',    key: 'spinner',    name: 'Through the Spinner',   from: [11, -1],      zone: [14.6, 4.6, 17.4, 7.4] },
    { id: 'ice-bank',   course: 'candy',    key: 'rink',       name: 'Round the Gumdrop',     from: [5, 0],        zone: [21.5, -1.5, 24.5, 1.5] },
    { id: 'jelly-pop',  course: 'candy',    key: 'jelly',      name: 'Pop Up the Jelly',      from: [12, -1],      zone: [20, -3.5, 25, 1.5] },
    { id: 'red-tube',   course: 'candy',    key: 'tower',      name: 'The Red Licorice',      from: [7, 0],        zone: [10, -11, 20, -6] },
    { id: 'wafer-walk', course: 'candy',    key: 'mountain',   name: 'Walk the Wafer',        from: [7, -5.6],     zone: [15.9, -1.6, 19.1, 1.6] },
    { id: 'donut-ace',  course: 'candy',    key: 'donut',      name: 'Loop to the Flag',      from: [3, 0],        zone: [20, -1, 24, 2] },
];
