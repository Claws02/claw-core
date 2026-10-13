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

export const COURSES = [BACKYARD];
export const COURSE_KEYS = COURSES.map(c => c.key);
export const courseByKey = k => COURSES.find(c => c.key === k) || COURSES[0];
/** Every hole of every course, as [courseKey, hole]. */
export const ALL_HOLES = () => COURSES.flatMap(c => c.holes.map(h => [c.key, h]));
export const coursePar = c => c.holes.reduce((a, h) => a + h.par, 0);
