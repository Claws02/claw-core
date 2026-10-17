// ============================================================
// GOLF BUILD — draws a compiled hole (Physics.compile) in its course's theme.
//
//   const h = buildHole(stage, c, theme, holeNo);
//   h.update(dt, t)     sails turn, the sweeper spins, the flag waves, water moves
//   h.pulse(bumper)     a bumper flashes when it's hit
//   h.dispose()
//
// Everything is built from the same numbers the physics reads, so what you see
// is what the ball hits. Scenery (props, the garden round the course) is drawn
// from the hole's `props` and the theme's `scenery`, and never touches the ball.
// ============================================================
import { bake } from './Bake.js';
import { tileHeight, moverWalls, windmillAngle, HAZARD, CUP_R, R } from './Physics.js';
import * as Toy from './Toys.js';
import * as Moving from './Moving.js';

let _caneTex = null;
/** Red and white candy stripes, for Candy Land's rails and canes. */
function _cane() {
    if (_caneTex) return _caneTex;
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#e8243c';
    for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 + 64, 64); x.lineTo(i + 64, 64); x.fill(); }
    _caneTex = new THREE.CanvasTexture(cv); _caneTex.wrapS = _caneTex.wrapT = THREE.RepeatWrapping;
    return _caneTex;
}

const SKIRT_TO = -0.7;
const SPIN = 0.6;              // how much of a scatter cannon's delay it spends spinning        // the course stands on a plinth down to here

function _mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }); }
const _shade = (hex, k) => {
    const c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
    return c;
};

/** A tile's floor as a mesh: a grid whose heights are the tile's own. */
function _floor(t, theme) {
    const w = t.x1 - t.x0, d = t.z1 - t.z0;
    const hilly = t.hills.length > 0 || t.ridges.length > 0 || !!t.trough || !!t.kick;
    const sx = Math.max(1, Math.ceil(w / (hilly ? 0.25 : 1))), sz = Math.max(1, Math.ceil(d / (hilly ? 0.25 : 1)));
    const geo = new THREE.PlaneGeometry(w, d, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = [];
    const turfA = new THREE.Color(theme.turf[0]), turfB = new THREE.Color(theme.turf[1]);
    const base = new THREE.Color(t.kind === 'sand' ? theme.sand : t.kind === 'wood' ? theme.wood : t.kind === 'ice' ? (theme.ice ?? 0xdff4ff)
        : t.kind === 'boost' ? (theme.boost ?? 0xffd23f) : t.kind === 'carpet' ? (theme.carpet ?? 0xc0392b) : t.kind === 'rough' ? (theme.rough ?? 0x2e7d32)
        : t.kind === 'felt' ? (theme.felt ?? 0x2f9a45) : t.kind === 'puddle' ? (theme.puddle ?? 0x7cc4ea) : t.kind === 'metal' ? (theme.metal ?? 0x9aa3b5)
        : t.kind === 'conveyor' ? (theme.conveyor ?? 0x374151) : t.kind === 'creek' ? (theme.creek ?? 0x7a4a26) : t.kind === 'jelly' ? (theme.turf[0])
        : t.kind === 'bouncy' ? (theme.bouncy ?? 0xffd166) : t.kind === 'concrete' ? 0xb4b9c2
        : HAZARD[t.kind] ? (theme[t.kind] ?? theme.water) : theme.turf[0]);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + t.cx, z = pos.getZ(i) + t.cz;
        pos.setY(i, tileHeight(t, x, z));
        let c = base;
        if (t.kind === 'turf') c = (Math.floor(x / 1.2) % 2 === 0) ? turfA : turfB;   // mown stripes
        if (t.kind === 'wood') c = _shade(theme.wood, Math.floor(x / 0.4) % 2 ? 1 : 0.88);
        // Skatepark concrete: deeper is darker (bowls and ramps read as shapes), with expansion joints.
        if (t.kind === 'concrete') { const dh = tileHeight(t, x, z) - (t.y || 0); c = _shade(0xb4b9c2, Math.max(0.6, Math.min(1.15, 0.88 + dh * 0.22)) * ((Math.abs(x % 2.5) < 0.06 || Math.abs(z % 2.5) < 0.06) ? 0.82 : 1)); }
        if (t.kind === 'sand') c = _shade(theme.sand, 0.95 + 0.1 * Math.abs(Math.sin(x * 7.1 + z * 3.3)));
        if (t.kind === 'ice') c = _shade(theme.ice ?? 0x8fd0f2, Math.floor((x + z) / 0.7) % 2 ? 1.12 : 0.96);
        if (t.kind === 'felt') c = _shade(theme.felt ?? 0x2f9a45, Math.floor(Math.hypot(x - t.cx, z - t.cz) / 0.8) % 2 ? 1.06 : 0.97);
        if (t.kind === 'rough') c = _shade(theme.rough ?? theme.turf[1], 0.85 + 0.12 * Math.abs(Math.sin(x * 5.3 + z * 4.1)));
        if (t.kind === 'bouncy') c = _shade(theme.bouncy ?? 0xffd166, Math.floor(x / 0.8) % 2 === Math.floor(z / 0.8) % 2 ? 1.08 : 0.9);
        if (t.kind === 'lava') c = _shade(theme.lava ?? 0xff5a1f, 0.85 + 0.3 * Math.abs(Math.sin(x * 2.3 + z * 1.7)));
        if (t.kind === 'flowers') c = _shade(0x3a2a1a, 1);
        if (t.kick) {
            // A kicker ramp: bright bands across the slope, so you know it'll throw you.
            const along = Math.abs(t.gx) > Math.abs(t.gz) ? x : z;
            c = Math.floor(along / 0.3) % 2 === 0 ? new THREE.Color(theme.kick ?? theme.accent ?? 0xff7a59) : new THREE.Color(0xfff6e6);
        }
        if (t.kind === 'turf' && (t.ridges.length || t.trough)) {
            // Shade the slopes so a bump or a bank reads.
            const k = 1 + (tileHeight(t, x, z) - t.y) * 0.35;
            c = _shade(c.getHex(), k);
        }
        cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const water = t.kind === 'water' || t.kind === 'goo' || t.kind === 'puddle' || t.kind === 'void';
    const lava = t.kind === 'lava';
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: water ? 0.15 : t.kind === 'ice' ? 0.2 : t.kind === 'bouncy' ? 0.4 : 0.9,
        metalness: water ? 0.1 : 0, transparent: water && t.kind !== 'goo', opacity: water && t.kind !== 'goo' ? 0.85 : 1,
        emissive: lava ? new THREE.Color(theme.lava ?? 0xff5a1f).multiplyScalar(0.7) : water ? new THREE.Color(theme[t.kind] ?? theme.water).multiplyScalar(0.25) : 0x000000 });
    // Floors laid over floors (a puddle, a belt) win the depth test.
    mat.polygonOffset = true; mat.polygonOffsetFactor = -t.i * 0.25; mat.polygonOffsetUnits = -t.i;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(t.cx, 0, t.cz);
    m.receiveShadow = true;
    if (water) m.userData.water = { geo, base: Array.from(pos.array) };
    if (lava) m.userData.lava = mat;
    return m;
}

/** The sides of a tile, from its edge down to the plinth. */
function _skirts(t, mat) {
    const g = new THREE.Group();
    const edge = (ax, az, bx, bz) => {
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
        const verts = [], idx = [];
        for (let k = 0; k <= n; k++) {
            const u = k / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
            verts.push(x, tileHeight(t, x, z) - 0.002, z, x, SKIRT_TO, z);
            if (k < n) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(idx); geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat); g.add(m);
    };
    edge(t.x0, t.z0, t.x1, t.z0); edge(t.x1, t.z1, t.x0, t.z1); edge(t.x0, t.z1, t.x0, t.z0); edge(t.x1, t.z0, t.x1, t.z1);
    return g;
}

function _wallMesh(w, mat, cap) {
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
    const g = new THREE.Group();
    const th = w.block ? 0.06 : 0.12;
    const body = new THREE.Mesh(new THREE.BoxGeometry(len + (w.block ? 0 : th), w.h, th), mat);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    if (cap && !w.block) {
        const top = new THREE.Mesh(new THREE.BoxGeometry(len + th, 0.04, th + 0.04), cap);
        top.position.y = w.h / 2; g.add(top);
    }
    g.position.set((w.x1 + w.x2) / 2, (w.b1 + w.b2) / 2 + w.h / 2, (w.z1 + w.z2) / 2);
    g.rotation.order = 'YZX';
    g.rotation.y = -Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
    g.rotation.z = Math.atan2(w.b2 - w.b1, len);
    return g;
}

function _textTex(text, bg, fg, w = 128, h = 80) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.font = `bold ${Math.round(h * 0.7)}px Bebas Neue, Impact, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
    const t = new THREE.CanvasTexture(cv); return t;
}

export function buildHole(stage, c, theme, holeNo = 1) {
    const root = new THREE.Group();
    const live = { windmills: [], sweepers: [], sliders: [], water: [], bumpers: [], chevrons: [], doors: [], pads: [], ripples: [], lava: [], mines: [], soft: [] };
    const edgeMat = _mat(theme.edge, { roughness: 0.8 });
    const railMat = _mat(theme.rail, { roughness: 0.5 });
    const capMat = _mat(theme.accent, { roughness: 0.5 });
    const blockMat = _mat(theme.block, { roughness: 0.9 });

    // Contour rings on every hill and bowl, so a slope can be read before it's putted across.
    c.tiles.forEach(t => t.hills.forEach(([hx, hz, r, hh]) => {
        const col = theme.railGlow ? theme.rail : _shade(theme.turf[0], hh < 0 ? 0.72 : 1.25);
        for (const k of [0.3, 0.55, 0.8]) {
            const pts = [];
            for (let i = 0; i <= 48; i++) {
                const a = i / 48 * Math.PI * 2, x = hx + Math.cos(a) * r * k, z = hz + Math.sin(a) * r * k;
                if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) { pts.push(null); continue; }
                pts.push(new THREE.Vector3(x, tileHeight(t, x, z) + 0.015, z));
            }
            let run = [];
            const flush = () => { if (run.length > 1) root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(run), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 }))); run = []; };
            pts.forEach(q => { if (q) run.push(q); else flush(); }); flush();
        }
    }));
    c.tiles.forEach(t => {
        if (t.move || t.lift || t.tilt || t.elev) return;   // drawn by Moving: a raft, a drawbridge, a see-saw, a lift
        const f = _floor(t, theme); f.userData.floor = true; root.add(f);   // (floor: never faded out of the camera's way)
        if (f.userData.lava) live.lava.push(f.userData.lava);
        if (t.kick) { const k = Toy.kickerLip(t, theme); k.g.position.y = tileHeight(t, ...k.at); root.add(k.g); }
        if (f.userData.water && t.kind !== 'puddle') {
            live.water.push(f);
            // Foam round the edge and rings spreading on the surface.
            const inner = new THREE.EdgesGeometry(new THREE.PlaneGeometry(t.x1 - t.x0 - 0.12, t.z1 - t.z0 - 0.12).rotateX(-Math.PI / 2));
            const line = new THREE.LineSegments(inner, new THREE.LineBasicMaterial({ color: t.kind === 'goo' ? 0x8a5a36 : 0xe8f7ff, transparent: true, opacity: 0.7 }));
            line.position.set(t.cx, t.y + 0.02, t.cz); root.add(line);
            for (let i = 0; i < 3; i++) {
                const rp = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 24), new THREE.MeshBasicMaterial({ color: t.kind === 'goo' ? 0x9a6a46 : 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
                rp.rotation.x = -Math.PI / 2;
                rp.position.set(t.x0 + (t.x1 - t.x0) * (0.25 + 0.25 * i), t.y + 0.03, t.z0 + (t.z1 - t.z0) * (i % 2 ? 0.3 : 0.7));
                rp.userData.ph = i / 3; root.add(rp); live.ripples.push(rp);
            }
        }
        const sk = _skirts(t, edgeMat); sk.userData.floor = true; root.add(sk);
    });
    // Rails, rounded, and a post wherever rails meet or end.
    const mats = { rail: Toy.mat(theme.rail, { roughness: 0.5 }), cap: Toy.mat(theme.accent, { roughness: 0.35 }), railDark: Toy.mat(0x1f2937, { metalness: 0.5, roughness: 0.35 }) };
    const posts = new Map();
    c.walls.forEach(w => {
        if (w.block || w.moving) return;         // a see-saw's or a lift's rails ride with it (Moving)
        const r = Toy.rail(w, theme, mats);
        root.add(r);
        if (r.userData.soft) live.soft.push({ g: r, t: 0, w });
        [[w.x1, w.z1, w.b1], [w.x2, w.z2, w.b2]].forEach(([x, z, b]) => {
            const k = `${Math.round(x * 20)},${Math.round(z * 20)}`;
            if (!posts.has(k)) posts.set(k, [x, b, z, w.h]);
        });
    });
    posts.forEach(([x, y, z, h]) => root.add(Toy.railPost(x, y, z, h, theme, mats)));
    root.add(Toy.dropEdges(c, theme));
    // Boost pads: chevrons pointing the way they push, pulsing.
    c.tiles.filter(t => t.kind === 'boost' && t.boost).forEach(t => {
        const a = Math.atan2(t.boost[1], t.boost[0]);
        const n = Math.max(2, Math.floor(Math.max(t.x1 - t.x0, t.z1 - t.z0) / 0.9));
        for (let i = 0; i < n; i++) {
            const sh = new THREE.Shape(); sh.moveTo(-0.2, -0.45); sh.lineTo(0.15, 0); sh.lineTo(-0.2, 0.45); sh.lineTo(-0.02, 0); sh.lineTo(-0.2, -0.45);
            const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
            m.rotation.x = -Math.PI / 2; m.rotation.z = a;
            const u = (i + 0.5) / n, x = t.x0 + (t.x1 - t.x0) * (Math.abs(Math.cos(a)) > 0.5 ? u : 0.5), z = t.z0 + (t.z1 - t.z0) * (Math.abs(Math.cos(a)) > 0.5 ? 0.5 : u);
            m.position.set(x, tileHeight(t, x, z) + 0.02, z);
            m.userData.chev = i / n; root.add(m); live.chevrons.push(m);
        }
    });
    // Loop-the-loops, and corkscrew slides down from one level to the next.
    const screws = new Map();
    c.loops.forEach(l => {
        if (l.style === 'corkscrew' && l.b) {
            const curve = Toy.corkscrewCurve(l, _y0(c, ...l.a), _y0(c, ...l.b));
            screws.set(l, curve);
            root.add(Toy.corkscrew(curve, theme));
            return;
        }
        const n = Math.hypot(l.dir[0], l.dir[1]) || 1, mx = l.a[0] + l.dir[0] / n * l.len / 2, mz = l.a[1] + l.dir[1] / n * l.len / 2;
        root.add(Toy.loop(l, _y0(c, mx, mz), theme));
    });
    // Mines: kegs, spiked mines — each goes off, and is back a moment later.
    c.mines.forEach(mn => {
        const o = Toy.mine(theme.mine || 'garden', theme);
        o.g.position.set(mn.x, _y0(c, mn.x, mn.z), mn.z);
        root.add(o.g);
        live.mines.push({ mn, g: o.g, light: o.light, gone: 0 });
    });
    // Blocks: hedges, crates, rock, bulkheads — and a windmill's walls.
    const mills = c.movers.filter(m => m.type === 'windmill');
    const inMill = ([x0, z0, x1, z1]) => mills.find(m => m.axis === 'z'
        ? (Math.abs(Math.min(x0, x1) - m.x) < 0.35 || Math.abs(Math.max(x0, x1) - m.x) < 0.35) && Math.abs((z0 + z1) / 2 - m.z) < 3
        : (Math.abs(Math.min(z0, z1) - m.z) < 0.35 || Math.abs(Math.max(z0, z1) - m.z) < 0.35) && Math.abs((x0 + x1) / 2 - m.x) < 3);
    const millBlocks = new Map();
    (c.hole.blocks || []).forEach(b => {
        const [x0, z0, x1, z1, h] = b;
        const base = Math.min(...c.tiles.filter(t => t.x0 <= Math.max(x0, x1) && t.x1 >= Math.min(x0, x1) && t.z0 <= Math.max(z0, z1) && t.z1 >= Math.min(z0, z1)).map(t => t.y), 0);
        const m = inMill(b);
        if (m) { if (!millBlocks.has(m)) millBlocks.set(m, []); millBlocks.get(m).push(b); }
        root.add(Toy.block(b, base, theme, Toy.blockKind(theme, h ?? 0.5, !!m)));
    });
    // Bumpers.
    c.bumpers.forEach(p => {
        const b = Toy.bumper(c.hole.bumperStyle ? { ...p, style: c.hole.bumperStyle } : p, theme);
        root.add(b.g);
        live.bumpers.push({ p, g: b.g, flash: b.flash, squash: b.squash, base: b.flash?.emissiveIntensity ?? 0, t: 0 });
    });
    // The cup: a hole in the green, and a flagstick standing in it. Nothing about it
    // moves. It's drawn over the floor whatever the angle: floors pull themselves
    // toward the camera by their tile index (polygonOffset) and a cup in a dip has
    // the floor curving up round it, so the cup pulls harder than any floor can.
    {
        const cupG = new THREE.Group();
        const onTop = (color) => new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -200 });
        const flat = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 1; cupG.add(m); return m; };
        // The white lip, a dark band of inside wall, then the black bottom: it
        // reads as a hole with some depth from any side.
        flat(new THREE.RingGeometry(CUP_R, CUP_R + 0.05, 32), onTop(0xf7f7f2), 0.014);
        flat(new THREE.RingGeometry(CUP_R * 0.72, CUP_R, 32), onTop(0x2a2e27), 0.013);
        flat(new THREE.CircleGeometry(CUP_R * 0.72, 32), onTop(0x050806), 0.012);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), _mat(0xf2f2f2, { roughness: 0.3, metalness: 0.4 }));
        pole.position.y = 1.05; cupG.add(pole);
        const fg = new THREE.PlaneGeometry(0.9, 0.56);
        fg.translate(0.45, 0, 0);
        const flagTex = _textTex(String(holeNo), '#' + new THREE.Color(theme.flag ?? 0xff3b3b).getHexString(), '#ffffff');
        const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 }));
        flag.position.set(0.03, 1.8, 0); cupG.add(flag);
        cupG.position.set(c.cup.x, c.cup.y, c.cup.z);
        root.add(cupG);
    }
    // The tee mat.
    {
        const mat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 1.0), _mat(theme.tee ?? 0x1f5130, { roughness: 1 }));
        mat.position.set(c.tee.x, c.tee.y + 0.015, c.tee.z); mat.receiveShadow = true; root.add(mat);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.rotation.x = -Math.PI / 2; dot.position.set(c.tee.x, c.tee.y + 0.035, c.tee.z); root.add(dot);
    }
    // Pipes: a mouth and an exit (a hose, a cannon and its target, teleport pads).
    c.pipes.forEach(p => ['a', 'b'].forEach(end => {
        const q = end === 'a' ? p.a : p.b;
        const o = Toy.pipeEnd(p, end, _y0(c, q[0], q[1]), theme);
        root.add(o);
        if (o.userData.pulse) live.pads.push(o.userData.pulse);
    }));
    // Movers.
    c.movers.forEach(m => {
        const base = c.tiles.reduce((h, t) => (m.x >= t.x0 && m.x <= t.x1 && m.z >= t.z0 && m.z <= t.z1 ? Math.max(h, tileHeight(t, m.x, m.z)) : h), 0);
        if (m.type === 'windmill' && theme.windmill === 'airlock') {
            const a = Toy.airlock(m, base, theme);
            root.add(a.g);
            live.doors.push({ m, door: a.door, lamp: a.lamp, base });
        } else if (m.type === 'windmill') {
            const w = Toy.windmill(m, base, theme, millBlocks.get(m) || []);
            root.add(w.g);
            live.windmills.push({ m, sails: w.sails, gate: w.gate });
        } else if (m.type === 'sweeper') {
            const s2 = Toy.sweeper(m, theme);
            if (theme.scenery === 'pirate' && !m.r0 && !m.rim) {
                // A ship's wheel: a rim and handles on the spokes.
                const rim = new THREE.Mesh(new THREE.TorusGeometry((m.len || 2) * 0.55, 0.07, 8, 28), Toy.mat(0x8b5a2b));
                rim.rotation.x = Math.PI / 2; rim.position.y = 0.2; s2.g.add(rim);
                for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, hd = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), Toy.mat(0xd9a514, { roughness: 0.3 })); hd.position.set(Math.cos(a) * (m.len || 2) * 0.55, 0.32, Math.sin(a) * (m.len || 2) * 0.55); s2.g.add(hd); }
            } else if (theme.scenery === 'candy' && !m.r0) {
                [-1, 1].forEach(sd => { const pop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 22), Toy.mat(sd > 0 ? 0xffd23f : 0x7ed957, { roughness: 0.25 })); pop.rotation.z = Math.PI / 2; pop.position.set(sd * (m.len || 2), 0.5, 0); s2.g.add(pop); });
            }
            s2.g.position.set(m.x, base, m.z); root.add(s2.g);
            live.sweepers.push({ m, g: s2.g });
        } else if (m.type === 'slider') {
            const box = Toy.slider(m, theme);
            box.position.y = base; root.add(box);
            live.sliders.push({ m, box });
        }
    });
    // Things that move or flow (belts, turntables, rafts, drawbridges, jelly, hammers, gates, fans, magnets).
    const moving = Moving.make(c, theme);
    root.add(moving.group);
    // Props and the world round the course.
    const cannons = [], hoses = [], ticks = [];
    (c.hole.props || []).forEach(p => {
        const o = PROPS[p.type]?.(p, c, theme);
        if (!o) return;
        root.add(o);
        if (o.userData.tick) ticks.push(o.userData.tick);
        if (p.type === 'cannon' && !p.deco) cannons.push({ p, o });
        if (p.type === 'hose') {
            // A bulge that runs down the hose with the ball inside.
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), _mat(0x34b866, { roughness: 0.35 }));
            ball.visible = false; root.add(ball);
            hoses.push({ p, curve: o.userData.curve, mesh: o, ball });
        }
    });
    const world = SCENERY[theme.scenery]?.(c, theme);
    if (world) {
        // Keep the camera's spot behind the tee clear of trees and palms.
        const f = c.path[1] || [c.cup.x, c.cup.z], dx = f[0] - c.tee.x, dz = f[1] - c.tee.z, n = Math.hypot(dx, dz) || 1;
        const sx = c.tee.x - dx / n * 6.4, sz = c.tee.z - dz / n * 6.4;
        world.children.slice().forEach(o => { if (!o.isPoints && o.position.y > -5 && Math.hypot(o.position.x - sx, o.position.z - sz) < 3.2 && !o.geometry?.parameters?.width && !o.geometry?.parameters?.radius && !o.geometry?.parameters?.innerRadius) world.remove(o); });
        root.add(world);
    }

    // Everything the hole updates stays as it is; the rest is merged (golf/Bake.js).
    moving.group.name = 'moving';
    const keep = new Set([moving.group]);
    const reach = (v, d) => {
        if (!v || d > 3) return;
        if (v.isObject3D) { keep.add(v); return; }
        if (Array.isArray(v)) v.forEach(x => reach(x, d + 1));
        else if (typeof v === 'object' && !v.isMaterial) Object.values(v).forEach(x => reach(x, d + 1));
    };
    reach(live, 0);
    cannons.forEach(k => keep.add(k.o));
    hoses.forEach(h => { keep.add(h.mesh); if (h.ball) keep.add(h.ball); });
    const baked = bake(root, keep);
    root.userData.baked = baked;

    stage.add(root);

    return {
        root,
        /**
         * Where a ball in a pipe is, u 0..1 of the way through, for drawing:
         * along the hose, on its arc out of the cannon, or null (a teleporter: it's nowhere).
         */
        pipeAt(pipe, u, dest) {
            const style = pipe.style || (theme.scenery === 'space' ? 'teleport' : 'hose');
            if (style === 'teleport') return null;
            if (style === 'cannon') {
                const cn = cannons.find(k => Math.hypot(k.p.at[0] - pipe.a[0], k.p.at[1] - pipe.a[1]) < 1);
                const from = cn ? cn.o.userData.muzzle() : new THREE.Vector3(pipe.a[0], 1, pipe.a[1]);
                // A scatter cannon spins first (the ball's in the barrel), then fires.
                if (dest) { if (u < SPIN) return from; u = (u - SPIN) / (1 - SPIN); }
                const tb = dest || pipe.b;
                const to = new THREE.Vector3(tb[0], _y0(c, tb[0], tb[1]) + R, tb[1]);
                const p = from.clone().lerp(to, u);
                p.y += Math.sin(u * Math.PI) * (2.4 + from.distanceTo(to) * 0.12);
                return p;
            }
            const h = hoses.find(k => k.curve && Math.hypot(k.p.from[0] - pipe.a[0], k.p.from[1] - pipe.a[1]) < 1);
            if (!h) return null;
            const p = h.curve.getPointAt(Math.min(1, u));
            h.bulge = u;
            return p;
        },
        /** The cannon fires: recoil and smoke. Returns the muzzle, for the puff. */
        fire(pipe, dest) {
            const cn = cannons.find(k => Math.hypot(k.p.at[0] - pipe.a[0], k.p.at[1] - pipe.a[1]) < 1);
            if (!cn) return null;
            if (dest) {
                // Spin round for a moment, swing onto where it's decided, then fire.
                cn.o.userData.spin = { t: 0, dur: (pipe.delay ?? 1.6) * SPIN, to: -Math.atan2(dest[1] - pipe.a[1], dest[0] - pipe.a[0]) };
                return null;
            }
            cn.o.userData.recoil = 1;
            return cn.o.userData.muzzle();
        },
        /** An aim cannon follows the shot being lined up. */
        aimCannon(pipe, dx, dz) {
            const cn = cannons.find(k => Math.hypot(k.p.at[0] - pipe.a[0], k.p.at[1] - pipe.a[1]) < 1);
            if (cn && (dx || dz)) cn.o.rotation.y = -Math.atan2(dz, dx);
        },
        /** A ball bounced on a jelly pad. */
        jelly(x, z) { moving.jelly(x, z); },
        update(dt, t) {
            moving.update(dt, t);
            ticks.forEach(f => f(dt, t));
            cannons.forEach(k => {
                const u = k.o.userData;
                if (u.spin) {
                    u.spin.t += dt;
                    if (u.spin.t < u.spin.dur) k.o.rotation.y += dt * 13;
                    else { k.o.rotation.y = u.spin.to; u.spin = null; u.recoil = 1; }
                }
                if (u.recoil > 0) { u.recoil = Math.max(0, u.recoil - dt * 2.2); }
                // (recoil starts unset: NaN here would hide the barrel till the first shot)
                u.barrel.position.x = u.barrelX - Math.sin(Math.min(1, u.recoil || 0) * Math.PI) * 0.35;
            });
            hoses.forEach(h => {
                if (!h.mesh) return;
                const k = h.bulge;
                if (k != null && h.ball) { h.ball.visible = k > 0 && k < 1; if (h.ball.visible) h.ball.position.copy(h.curve.getPointAt(Math.min(1, k))); }
                h.bulge = null;
            });
            live.windmills.forEach(w => { w.sails.rotation.z = windmillAngle(w.m, t); w.gate.visible = moverWalls({ movers: [w.m], tiles: c.tiles }, t).length > 0; });
            live.sweepers.forEach(s => { s.g.rotation.y = -(t * (s.m.speed || 1.2) + (s.m.phase || 0)); });
            live.lava.forEach((m, i) => { m.emissiveIntensity = 0.85 + 0.25 * Math.sin(t * 2.4 + i); });
            live.mines.forEach(M => {
                if (M.gone > 0) { M.gone = Math.max(0, M.gone - dt); M.g.visible = M.gone < 0.01 || M.gone > 1.5; const k = M.gone < 0.4 ? 1 - M.gone / 0.4 : 0; M.g.scale.setScalar(M.gone > 0 ? Math.max(0.01, k) : 1); }
                if (M.light) M.light.material.emissiveIntensity = 1 + Math.sin(t * 6 + M.mn.x) * 0.8;
            });
            live.soft.forEach(S => { if (S.t > 0) { S.t = Math.max(0, S.t - dt); const k = Math.sin(S.t * 30) * S.t * 0.35; S.g.scale.set(1, 1 - k, 1 + k); } });
            live.doors.forEach(d => {
                const a = windmillAngle(d.m, t);
                let near = 9;
                for (let k = 0; k < 4; k++) { const q = ((a + k * Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); near = Math.min(near, Math.abs(q - Math.PI)); }
                const shut = Math.max(0, Math.min(1, (0.62 - near) / 0.3));
                d.door.position.y = d.base + 0.55 + (1 - shut) * 1.15;
                d.lamp.material.color.setHex(near < 0.32 ? 0xef4444 : shut > 0 ? 0xfacc15 : 0x22c55e);
            });
            live.chevrons.forEach(m => { m.material.opacity = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 6 - m.userData.chev * 6)); });
            live.sliders.forEach(s => {
                const wl = moverWalls({ movers: [s.m], tiles: c.tiles }, t)[0];
                s.box.position.x = (wl.x1 + wl.x2) / 2; s.box.position.z = (wl.z1 + wl.z2) / 2;
            });
            live.water.forEach(m => {
                const { geo, base } = m.userData.water, pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 2.2 + base[i * 3] * 1.7 + base[i * 3 + 2] * 1.3) * 0.025;
                pos.needsUpdate = true;
            });
            live.bumpers.forEach(b => {
                if (b.t > 0) b.t = Math.max(0, b.t - dt);
                const k = b.t / 0.25;
                if (b.squash) b.g.scale.set(1 + k * 0.15, 1 - k * 0.25, 1 + k * 0.15);
                else b.g.scale.set(1 + k * 0.16, 1 + k * 0.06, 1 + k * 0.16);
                if (b.flash) b.flash.emissiveIntensity = b.base + k * 1.6;
                if (b.g.userData.spin) b.g.rotation.y += dt * b.g.userData.spin;
            });
            live.pads.forEach((p, i) => {
                const k = 0.5 + 0.5 * Math.sin(t * 4 + i);
                p.disc.material.opacity = 0.35 + 0.35 * k; p.beam.material.opacity = 0.1 + 0.14 * k; p.ring.rotation.z = t * 1.5;
            });
            live.ripples.forEach(r => {
                const k = ((t * 0.5 + r.userData.ph) % 1);
                r.scale.setScalar(0.3 + k * 1.6); r.material.opacity = 0.5 * (1 - k);
            });
        },
        pulse(p) { const b = live.bumpers.find(x => x.p === p); if (b) b.t = 0.25; },
        /** A mine went off at (x, z): it vanishes and pops back up. */
        boom(x, z) { const M = live.mines.find(m => Math.hypot(m.mn.x - x, m.mn.z - z) < 0.05); if (M) { M.gone = 1.9; M.g.visible = false; } },
        /** A soft (inflatable) wall was hit near (x, z): it wobbles. */
        wobble(x, z) { let best = null, bd = 0.6; live.soft.forEach(S => { const w = S.w, ex = w.x2 - w.x1, ez = w.z2 - w.z1, L2 = ex * ex + ez * ez || 1, u = Math.max(0, Math.min(1, ((x - w.x1) * ex + (z - w.z1) * ez) / L2)); const d = Math.hypot(x - w.x1 - ex * u, z - w.z1 - ez * u); if (d < bd) { bd = d; best = S; } }); if (best) best.t = 0.45; },
        /** Where a ball is, u (0..1) of the way down a corkscrew. */
        loopAt(l, u) { const cv = screws.get(l); return cv ? cv.getPointAt(Math.max(0, Math.min(1, u))) : null; },
        /** Lift the flag out while a ball is on the green close by. */
        dispose() {
            stage.scene.remove(root);
            root.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
        },
    };
}

// ── Props ────────────────────────────────────────────────────────────────────
const _y0 = (c, x, z) => c.tiles.reduce((h, t) => (x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1 ? Math.max(h, tileHeight(t, x, z)) : h), SKIRT_TO);

function _tree(scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.22 * scale, 1.6 * scale, 8), _mat(0x7a4a24));
    trunk.position.y = 0.8 * scale; trunk.castShadow = true; g.add(trunk);
    const leafM = _mat(0x2f8f3a, { roughness: 0.95 }), leafM2 = _mat(0x3fa548, { roughness: 0.95 });
    [[0, 2.0, 0, 1.0], [0.5, 1.7, 0.3, 0.7], [-0.45, 1.75, -0.25, 0.75], [0.1, 2.6, -0.1, 0.65]].forEach(([x, y, z, r], i) => {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 1), i % 2 ? leafM2 : leafM);
        b.position.set(x * scale, y * scale, z * scale); b.castShadow = true; g.add(b);
    });
    return g;
}
function _flowers(n = 7, spread = 0.9) {
    const g = new THREE.Group();
    const cols = [0xff5d8f, 0xffd23f, 0xffffff, 0xa06cff, 0xff8a3d];
    for (let i = 0; i < n; i++) {
        const a = i * 2.4, r = spread * Math.sqrt((i + 0.5) / n);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), _mat(0x2f8f3a));
        stem.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r); g.add(stem);
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), _mat(cols[i % cols.length], { roughness: 0.6 }));
        head.position.set(Math.cos(a) * r, 0.38, Math.sin(a) * r); g.add(head);
    }
    return g;
}
const PROPS = {
    tree: (p, c) => { const t = _tree(p.scale || 1); t.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return t; },
    flowers: (p, c) => { const f = _flowers(); f.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return f; },
    gnome: (p, c) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 10), _mat(0x2f6fd8)); body.position.y = 0.3; g.add(body);
        const face = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), _mat(0xffd2b0)); face.position.y = 0.66; g.add(face);
        const beard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 10), _mat(0xffffff)); beard.position.set(0, 0.52, 0.07); beard.rotation.x = Math.PI; g.add(beard);
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 10), _mat(0xe0302f)); hat.position.y = 0.95; hat.rotation.z = 0.15; g.add(hat);
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); g.rotation.y = 0.6; return g;
    },
    hedge: (p) => {
        const L = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
        const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 1.0), _mat(0x2c7a35, { roughness: 1 }));
        m.position.set((p.from[0] + p.to[0]) / 2, -0.25, (p.from[1] + p.to[1]) / 2); m.rotation.y = -Math.atan2(p.to[1] - p.from[1], p.to[0] - p.from[0]);
        m.castShadow = true; return m;
    },
    bucket: (p) => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 14, 1, true), _mat(0xff6b3d, { side: THREE.DoubleSide }));
        b.position.y = -0.35; g.add(b);
        g.position.set(p.at[0], 0, p.at[1]); return g;
    },
    spade: (p) => {
        const g = new THREE.Group();
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), _mat(0xffd23f)); h.rotation.z = 1.2; h.position.y = -0.4; g.add(h);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.25), _mat(0x2f6fd8)); s.position.set(0.4, -0.55, 0); g.add(s);
        g.position.set(p.at[0], 0, p.at[1]); return g;
    },
    duck: (p, c) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), _mat(0xffd23f, { roughness: 0.4 })); body.scale.set(1.2, 0.85, 1); g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), _mat(0xffd23f, { roughness: 0.4 })); head.position.set(0.18, 0.2, 0); g.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), _mat(0xff7a1a)); beak.rotation.z = -Math.PI / 2; beak.position.set(0.33, 0.18, 0); g.add(beak);
        g.position.set(p.at[0], _y0(c, ...p.at) + 0.08, p.at[1]); g.userData.bob = true; return g;
    },
    pool: (p) => {
        const [x0, z0, x1, z1] = p.r;
        const ring = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.1, 0.08, z1 - z0 + 0.1), _mat(0x3fa7e6, { roughness: 0.5 }));
        ring.position.set((x0 + x1) / 2, -0.66, (z0 + z1) / 2); return ring;
    },
    bed: (p) => {
        const [x0, z0, x1, z1] = p.r;
        const g = new THREE.Group();
        const n = Math.max(14, Math.round((x1 - x0) * (z1 - z0) * 0.9));
        for (let i = 0; i < n; i++) {
            const f = _flowers(3, 0.25);
            f.position.set(x0 + 0.3 + ((i * 0.37) % 1) * (x1 - x0 - 0.6), p.y ?? -0.45, z0 + 0.3 + (i / n) * (z1 - z0 - 0.6));
            g.add(f);
        }
        return g;
    },
    flag: (p, c) => {
        // Bunting strung over the landing.
        const g = new THREE.Group();
        const cols = [0xff5d8f, 0xffd23f, 0x3fa7e6, 0x7ed957];
        for (let i = 0; i < 9; i++) {
            const tri = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 3), _mat(cols[i % 4], { side: THREE.DoubleSide }));
            tri.rotation.x = Math.PI; tri.position.set(0, 1.7 - Math.sin(i / 8 * Math.PI) * 0.3, -2.4 + i * 0.6); g.add(tri);
        }
        [-2.6, 2.6].forEach(z => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), _mat(0xffffff)); pole.position.set(0, 0.9, z); g.add(pole); });
        g.position.set(p.at[0], _y0(c, ...p.at), 0); return g;
    },
    hose: (p, c) => {
        // A garden hose snaking round outside the course, from its mouth to where it comes out.
        const a = p.from, b = p.to, B = c.bounds;
        const side = B.x1 - a[0] < a[0] - B.x0 ? 1 : -1;
        const ox = (side > 0 ? B.x1 : B.x0) + side * 1.0;
        const ya = _y0(c, a[0], a[1]), yb = _y0(c, b[0], b[1]);
        const pts = [new THREE.Vector3(a[0], ya - 0.1, a[1]), new THREE.Vector3((a[0] + ox) / 2, -0.45, a[1] + 0.3), new THREE.Vector3(ox, -0.55, a[1] + (b[1] - a[1]) * 0.25),
                     new THREE.Vector3(ox + side * 0.6, -0.55, (a[1] + b[1]) / 2), new THREE.Vector3(ox, -0.55, a[1] + (b[1] - a[1]) * 0.75),
                     new THREE.Vector3((b[0] + ox) / 2, -0.45, b[1] - 0.3), new THREE.Vector3(b[0] + side * 0.4, yb - 0.1, b[1])];
        const curve = new THREE.CatmullRomCurve3(pts);
        const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.26, 12, false), _mat(0x2e9e57, { roughness: 0.35 }));
        m.castShadow = true;
        // A tap at the outside bend.
        const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10), _mat(0xd9a514, { metalness: 0.7, roughness: 0.3 }));
        tap.position.copy(pts[3]).add(new THREE.Vector3(side * 0.4, 0.3, 0)); tap.rotation.z = Math.PI / 2; m.add(tap.clone()); 
        m.userData.curve = curve;
        return m;
    },
    shed: (p) => {
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.4), _mat(0xb7814a)); box.position.y = 0.4; g.add(box);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.1, 4), _mat(0x8a3b2b)); roof.position.y = 2.05; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.85; g.add(roof);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), _mat(0x6b3f1d)); door.position.set(1.51, 0.0, 0); door.rotation.y = Math.PI / 2; g.add(door);
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], -0.7, p.at[1]); return g;
    },
    sprinkler: (p, c) => {
        const g = new THREE.Group();
        const n = 26, drops = [];
        for (let i = 0; i < n; i++) {
            const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.8 }));
            g.add(d); drops.push(d);
        }
        g.position.set(p.at[0], _y0(c, ...p.at) + 0.35, p.at[1]);
        g.userData.spray = drops;
        return g;
    },
    windmill: () => null,
    _oldWindmill: (p, c) => {
        // The roof and the brickwork over the door; the walls are the blocks.
        const g = new THREE.Group();
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), _mat(0xc2410c, { roughness: 0.8 }));
        lintel.position.set(p.at[0], 1.5, p.at[1]); lintel.castShadow = true; g.add(lintel);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 4), _mat(0xc2410c, { roughness: 0.8 }));
        top.position.set(p.at[0], 2.25, p.at[1]); top.castShadow = true; g.add(top);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.6, 4), _mat(0x7c2d12));
        roof.position.set(p.at[0], 3.5, p.at[1]); roof.rotation.y = Math.PI / 4; roof.scale.z = 1.8; roof.castShadow = true; g.add(roof);
        return g;
    },
};

// ── The world round the course ──────────────────────────────────────────────
const SCENERY = {
    backyard(c, theme) {
        const g = new THREE.Group();
        const B = c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        const W = B.x1 - B.x0 + 30, D = B.z1 - B.z0 + 30;
        // The lawn runs on well past the fence: a camera pulled out over a big hole sees grass, not sky.
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(W + 160, D + 160), _mat(theme.ground, { roughness: 1 }));
        lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, SKIRT_TO, cz); lawn.receiveShadow = true; g.add(lawn);
        // A picket fence round the garden.
        const pick = _mat(0xfdfbf5, { roughness: 0.7 });
        const fx0 = cx - W / 2 + 2, fx1 = cx + W / 2 - 2, fz0 = cz - D / 2 + 2, fz1 = cz + D / 2 - 2;
        const run = (ax, az, bx, bz) => {
            const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.5);
            const geo = new THREE.BoxGeometry(0.16, 1.1, 0.06);
            const inst = new THREE.InstancedMesh(geo, pick, n);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.atan2(bz - az, bx - ax), 0));
            for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; m4.compose(new THREE.Vector3(ax + (bx - ax) * u, SKIRT_TO + 0.55, az + (bz - az) * u), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4); }
            g.add(inst);
            const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.05), pick);
            rail.position.set((ax + bx) / 2, SKIRT_TO + 0.75, (az + bz) / 2); rail.rotation.y = -Math.atan2(bz - az, bx - ax); g.add(rail);
        };
        run(fx0, fz0, fx1, fz0); run(fx1, fz0, fx1, fz1); run(fx0, fz1, fx1, fz1); run(fx0, fz0, fx0, fz1);
        // The house at the back, so a far shot has something to look at.
        const house = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 4), _mat(0xf2d6b3)); wall.position.y = 3; house.add(wall);
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.4, 14.6, 4, 1), _mat(0xa8442f));
        roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 4; roof.position.y = 7.1; roof.scale.set(1, 1, 0.7); house.add(roof);
        for (let i = 0; i < 4; i++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x9fd0f0, emissive: 0x2a4a60, emissiveIntensity: 0.4 }));
            win.position.set(-4.5 + i * 3, 3.6, 2.01); house.add(win);
        }
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), _mat(0x3a6ea5)); door.position.set(0, 1.2, 2.01); house.add(door);
        // Beyond the cup, facing back down the hole (never behind the tee, where the cameras sit).
        const hx = c.cup.x - c.tee.x, hz = c.cup.z - c.tee.z;
        if (Math.abs(hx) > Math.abs(hz)) { house.position.set(hx > 0 ? fx1 + 4 : fx0 - 4, SKIRT_TO, cz); house.rotation.y = hx > 0 ? -Math.PI / 2 : Math.PI / 2; }
        else { house.position.set(cx, SKIRT_TO, hz > 0 ? fz1 + 4 : fz0 - 4); house.rotation.y = hz > 0 ? Math.PI : 0; }
        g.add(house);
        // Trees round the edge.
        [[fx0 + 1.5, fz0 + 1.5, 1.4], [fx1 - 1.5, fz0 + 2, 1.2], [fx0 + 1.2, fz1 - 1.5, 1.1], [fx1 - 2, fz1 - 1.2, 1.5], [cx + 4, fz1 - 1, 1.0]]
            .forEach(([x, z, s]) => { const t = _tree(s); t.position.set(x, SKIRT_TO, z); g.add(t); });
        // A parasol and a paddling-pool lilo, because it's summer.
        const para = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), _mat(0xffffff)); pole.position.y = 1.3; para.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), _mat(0xff5d5d)); top.position.y = 2.6; para.add(top);
        para.position.set(fx1 - 3.5, SKIRT_TO, fz0 + 3.5); g.add(para);   // in a corner: out of the overview camera's way
        return g;
    },
};

// ── Pirate Cove, Candy Land and the Space Station ──────────────────────────
function _palm(scale = 1) {
    const g = new THREE.Group();
    const trunkM = _mat(0x9b6b3d, { roughness: 0.9 });
    // A leaning, curved trunk.
    const pts = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(new THREE.Vector3(u * u * 0.9 * scale, u * 3.1 * scale, 0)); }
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.15 * scale, 7, false), trunkM);
    trunk.castShadow = true; g.add(trunk);
    const x = 0.9 * scale, y = 3.1 * scale;
    const leafM = _mat(0x2f9e44, { roughness: 0.8, side: THREE.DoubleSide });
    for (let k = 0; k < 7; k++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.5 * scale, 0.36 * scale), leafM);
        leaf.geometry.translate(0.75 * scale, 0, 0);
        leaf.position.set(x, y, 0); leaf.rotation.set(Math.PI / 2, 0.45, k / 7 * Math.PI * 2, 'YXZ');
        leaf.rotation.y = k / 7 * Math.PI * 2; leaf.rotation.z = -0.45; leaf.castShadow = true; g.add(leaf);
    }
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 8, 6), _mat(0x5a3a1e)); nut.position.set(x + 0.1, y - 0.15, 0.08); g.add(nut);
    return g;
}
function _lolly(scale = 1, col = 0xff5fa2) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 2.2 * scale, 6), _mat(0xffffff)); stick.position.y = 1.1 * scale; g.add(stick);
    const cols = [col, 0xffffff, 0xffd23f, 0xffffff];
    for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry((0.15 + i * 0.13) * scale, 0.07 * scale, 6, 24), _mat(cols[i], { roughness: 0.3 }));
        ring.position.y = 2.4 * scale; g.add(ring);
    }
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.12 * scale, 12), _mat(col)); core.position.y = 2.4 * scale; g.add(core);
    g.children.forEach(o => { o.castShadow = true; });
    return g;
}
function _caneMesh(scale = 1) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ map: _cane(), roughness: 0.35 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 2 * scale, 10), m); shaft.position.y = 1 * scale; g.add(shaft);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.3 * scale, 0.1 * scale, 8, 16, Math.PI), m); hook.position.set(0.3 * scale, 2 * scale, 0); g.add(hook);
    g.children.forEach(o => { o.castShadow = true; });
    return g;
}
function _cupcake(scale = 1) {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.36 * scale, 0.5 * scale, 14), _mat(0x5fb8ff)); cup.position.y = 0.25 * scale; g.add(cup);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.55 * scale, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), _mat(0xfff0f6, { roughness: 0.5 })); top.position.y = 0.5 * scale; top.scale.y = 1.2; g.add(top);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 10, 8), _mat(0xe8243c, { roughness: 0.2 })); ch.position.y = 1.2 * scale; g.add(ch);
    g.children.forEach(o => { o.castShadow = true; });
    return g;
}
Object.assign(PROPS, {
    rocks: (p, c) => {
        const g = new THREE.Group();
        const m = _mat(0x9a948a, { roughness: 1, flatShading: true });
        [[0, 0, 0.7], [0.8, 0.3, 0.5], [-0.6, 0.4, 0.45], [0.3, -0.6, 0.4]].forEach(([x, z, r], i) => {
            const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), m); rk.position.set(x, r * 0.5, z); rk.rotation.set(i, i * 2, 0); rk.castShadow = true; g.add(rk);
        });
        const f = _flowers(5, 0.6); f.position.set(0.2, 0.5, 0.2); g.add(f);
        g.position.set(p.at[0], _y0(c, ...p.at) - 0.3, p.at[1]); return g;
    },
    fort: (p) => {
        const g = new THREE.Group();
        const stone = _mat(0xb9a98a, { roughness: 0.95 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 1.6, 0.8), stone); wall.position.y = 1.2; g.add(wall);
        for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), stone); m.position.set(-4.6 + i * 1.15, 2.25, 0); g.add(m); }
        [-5, 5].forEach(x => { const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 3.4, 10), stone); t.position.set(x, 1.3, 0); g.add(t);
            const r = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.2, 10), _mat(0x8a2e1d)); r.position.set(x, 3.6, 0); g.add(r); });
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], 0, p.at[1]); return g;
    },
    cave: (p) => {
        // A rough rock roof arching over the passage (open at the sides so the camera sees in).
        const [x0, z0, x1, z1] = p.r;
        const g = new THREE.Group();
        const rock = _mat(0x6f6a62, { roughness: 1, flatShading: true });
        const n = Math.round((x1 - x0) / 1.6);
        for (let i = 0; i <= n; i++) {
            const arch = new THREE.Mesh(new THREE.TorusGeometry((z1 - z0) / 2 + 0.4, 0.45, 5, 10, Math.PI), rock);
            arch.position.set(x0 + (x1 - x0) * i / n, 0.1, (z0 + z1) / 2); arch.rotation.y = Math.PI / 2; arch.castShadow = true; g.add(arch);
        }
        // Glowing crystals in the dark.
        for (let i = 0; i < 6; i++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 1 })); cr.position.set(x0 + 1 + i * (x1 - x0 - 2) / 5, 0.25, i % 2 ? z0 + 0.25 : z1 - 0.25); g.add(cr); }
        return g;
    },
    chocfall: (p, c) => {
        // A chocolate waterfall: the river pours off the lip at `at` (heading `dir`), `w` wide,
        // down into a churning pool, with a curl of steam off the splash.
        const g = new THREE.Group(), w = p.w || 3, drop = p.drop || 2.4, d = p.dir || [1, 0];
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
        const x = cv.getContext('2d'); x.fillStyle = '#4a2614'; x.fillRect(0, 0, 64, 128);
        for (let i = 0; i < 14; i++) { x.fillStyle = i % 3 ? '#5e3219' : 'rgba(214,160,104,0.5)'; x.fillRect((i * 37) % 64, 0, i % 3 ? 5 : 1.5, 128); }
        const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(w / 1.2, 1);
        const sheetM = _mat(0xffffff, { map: tex, roughness: 0.12, metalness: 0.18, side: THREE.DoubleSide });
        // The sheet curls over the lip and falls: a bent plane.
        const geo = new THREE.PlaneGeometry(w, 1, 1, 10), pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) { const v = 0.5 - pos.getY(i); pos.setXYZ(i, pos.getX(i), -v * drop, Math.sqrt(v) * 0.9); }
        geo.computeVertexNormals();
        const sheet = new THREE.Mesh(geo, sheetM); sheet.rotation.y = Math.PI / 2; g.add(sheet);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 28), _mat(0x3d1f10, { roughness: 0.1, metalness: 0.2 }));
        pool.scale.set(1.1, w * 0.62, 1); pool.rotation.set(-Math.PI / 2, 0, 0); pool.position.set(1.1, -drop + 0.02, 0); g.add(pool);
        const foam = [];
        for (let i = 0; i < 3; i++) {
            const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), _mat(0xc8925a, { transparent: true, opacity: 0.5, roughness: 0.4, depthWrite: false }));
            r.rotation.x = -Math.PI / 2; r.position.set(0.9, -drop + 0.04, 0); r.userData.ph = i / 3; g.add(r); foam.push(r);
        }
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); g.rotation.y = -Math.atan2(d[1], d[0]);
        g.userData.tick = (dt, t) => {
            tex.offset.y += dt * 1.4;
            foam.forEach(r => { const k = (t * 0.6 + r.userData.ph) % 1; r.scale.set(0.6 + k * 1.4, (0.6 + k * 1.4) * Math.min(1.6, w / 2.4), 1); r.material.opacity = 0.55 * (1 - k); });
        };
        return g;
    },
    container: (p, c) => {
        // A ribbed shipping container, doors at one end, a stencilled stripe.
        const g = new THREE.Group(), col = p.color ?? 0x2563eb, L = p.len || 3, W = 1.2, H = 1.25;
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8;
        const x = cv.getContext('2d'), base = '#' + new THREE.Color(col).getHexString(), dark = '#' + new THREE.Color(col).multiplyScalar(0.7).getHexString();
        x.fillStyle = base; x.fillRect(0, 0, 64, 8); x.fillStyle = dark; for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 5, 0, 3, 8);
        const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(L * 2, 1);
        const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), _mat(0xffffff, { map: tex, roughness: 0.6, metalness: 0.35 }));
        body.position.y = H / 2; g.add(body);
        const frame = _mat(0x1f2937, { metalness: 0.6, roughness: 0.4 });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, H + 0.02, 0.1), frame); post.position.set(sx * (L / 2 - 0.04), H / 2, sz * (W / 2 - 0.04)); g.add(post); });
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.12, W + 0.01), _mat(0xf8fafc, { roughness: 0.5 })); stripe.position.set(0, H * 0.72, 0); g.add(stripe);
        const doors = new THREE.Mesh(new THREE.BoxGeometry(0.03, H - 0.1, W - 0.12), _mat(new THREE.Color(col).multiplyScalar(0.8).getHex(), { metalness: 0.4, roughness: 0.5 }));
        doors.position.set(L / 2 + 0.01, H / 2, 0); g.add(doors);
        if (p.stack) { const top = g.clone(); top.position.y = H; top.rotation.y = 0.08; g.add(top); }
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); g.rotation.y = p.rot ?? 0;
        g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        return g;
    },
    gummy: (p, c) => {
        // A big gummy bear, glossy and see-through, sitting up.
        const g = new THREE.Group(), col = p.color ?? 0xff4f6a, s = p.s || 1;
        const m = new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.15, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.85 });
        const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
        ball(0.42, 0, 0.5, 0, 1, 1.15, 0.9);                     // body
        ball(0.32, 0, 1.08, 0, 1.05, 0.95, 0.95);                 // head
        ball(0.11, -0.22, 1.33, 0); ball(0.11, 0.22, 1.33, 0);    // ears
        ball(0.12, 0, 1.0, 0.28, 1.2, 0.8, 0.8);                  // snout
        ball(0.13, -0.4, 0.68, 0.12, 1, 1.4, 1); ball(0.13, 0.4, 0.68, 0.12, 1, 1.4, 1);   // arms
        ball(0.16, -0.24, 0.14, 0.22, 1, 0.8, 1.4); ball(0.16, 0.24, 0.14, 0.22, 1, 0.8, 1.4); // feet
        const eye = _mat(0x2a0a12, { roughness: 0.2 });
        [-0.11, 0.11].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eye); e.position.set(x, 1.14, 0.29); g.add(e); });
        g.scale.setScalar(s); g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); g.rotation.y = p.rot ?? 0;
        return g;
    },
    cookie: (p, c) => {
        const g = new THREE.Group();
        const ck = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 20), _mat(0xd49a5a, { roughness: 0.9 })); g.add(ck);
        for (let i = 0; i < 6; i++) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), _mat(0x3b2412)); ch.position.set(Math.cos(i * 2.1) * 0.4, 0.07, Math.sin(i * 2.1) * 0.4); g.add(ch); }
        g.position.set(p.at[0], _y0(c, ...p.at) + 0.04, p.at[1]); g.userData.bob = true; return g;
    },
    ginger: (p, c) => {
        // A gingerbread arch over a turnstile's doorway, iced.
        const g = new THREE.Group();
        const gb = _mat(0xb0703a, { roughness: 0.8 });
        const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.22, 8, 20, Math.PI), gb); arch.rotation.y = Math.PI / 2; arch.position.y = 0.8; g.add(arch);
        const icing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 6, 30, Math.PI), _mat(0xffffff, { roughness: 0.3 })); icing.rotation.y = Math.PI / 2; icing.position.set(-0.2, 0.8, 0); g.add(icing);
        [0xff5fa2, 0x7ed957, 0xffd23f].forEach((col, i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), _mat(col, { roughness: 0.2 })); d.position.set(-0.2, 0.8 + Math.sin((i + 1) / 4 * Math.PI) * 1.15, Math.cos((i + 1) / 4 * Math.PI) * 1.15); g.add(d); });
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    gumballs: (p, c) => {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.7, 14), _mat(0xe8243c, { roughness: 0.3 })); base.position.y = 0.35; g.add(base);
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.05 })); globe.position.y = 1.2; g.add(globe);
        const cols = [0xff5fa2, 0xffd23f, 0x5fb8ff, 0x7ed957, 0xb57bff];
        for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), _mat(cols[i % 5], { roughness: 0.2 })); const a = i * 2.4, r = 0.35 * Math.sqrt(i / 18); b.position.set(Math.cos(a) * r, 0.85 + (i % 4) * 0.1, Math.sin(a) * r); g.add(b); }
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.15, 12), _mat(0xe8243c)); cap.position.y = 1.85; g.add(cap);
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    crate: (p, c) => {
        const g = Toy.block([-0.5, -0.5, 0.5, 0.5, 0.9], 0, { scenery: 'pirate' }, 'crate');
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    fan: () => null,

    palm: (p, c) => { const t = _palm(p.scale || 1); t.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); t.rotation.y = p.at[0] * 1.7; return t; },
    barrel: (p, c) => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 14), _mat(0x8a4f22)); b.position.y = 0.35; g.add(b);
        [0.12, 0.58].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 20), _mat(0x333333)); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); });
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    chest: (p, c) => {
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), _mat(0x7a4a1e)); box.position.y = 0.22; g.add(box);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 12, 1, false, 0, Math.PI), _mat(0x8b5a2b)); lid.rotation.z = Math.PI / 2; lid.position.y = 0.45; g.add(lid);
        const gold = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xb8860b, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.3 }));
        gold.position.set(0, 0.5, 0.18); gold.scale.set(1.4, 0.5, 0.6); g.add(gold);
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); g.rotation.y = 0.4; return g;
    },
    cannon: (p, c) => {
        const g = Toy.cannon();
        // Just past its mouth on the deck, aimed at where it fires you.
        const dx = p.to ? p.to[0] - p.at[0] : 1, dz = p.to ? p.to[1] - p.at[1] : 0, n = Math.hypot(dx, dz) || 1;
        const off = p.deco ? 0 : 0.55;
        g.position.set(p.at[0] + dx / n * off, _y0(c, ...p.at), p.at[1] + dz / n * off);
        // Aimed at where it fires you (the pipe's far end), or standing guard.
        g.rotation.y = p.deco ? Math.PI / 2 : p.to ? -Math.atan2(p.to[1] - p.at[1], p.to[0] - p.at[0]) : 0;
        return g;
    },
    flagpole: (p, c) => {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), _mat(0x5a3a1e)); pole.position.y = 1.5; g.add(pole);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), _mat(0x111111, { side: THREE.DoubleSide })); fl.position.set(0.55, 2.6, 0); g.add(fl);
        const sk = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), _mat(0xffffff, { side: THREE.DoubleSide })); sk.position.set(0.55, 2.62, 0.01); g.add(sk);
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    wheel: () => null,
    mast: (p, c) => {
        const g = new THREE.Group();
        const wood = _mat(0x5a3a1e);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 8), wood); pole.position.y = 3; g.add(pole);
        const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), wood); yard.rotation.z = Math.PI / 2; yard.position.y = 4.6; g.add(yard);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2, 6, 4), _mat(0xf2e8d0, { side: THREE.DoubleSide })); sail.position.set(0, 3.5, 0.1); g.add(sail);
        const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.4, 10), wood); nest.position.y = 5.6; g.add(nest);
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    skull: (p, c) => {
        const g = new THREE.Group();
        const bone = _mat(0xe8e2d0, { roughness: 0.8 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 14), bone); head.scale.set(0.75, 0.95, 1.25); head.position.set(0.5, 2.4, 0); g.add(head);
        [-0.45, 0.45].forEach(z => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), _mat(0x111111)); eye.position.set(-0.2, 2.55, z); g.add(eye); });
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), _mat(0x111111)); nose.position.set(-0.25, 2.15, 0); nose.rotation.z = Math.PI; g.add(nose);
        g.children.forEach(o => { o.castShadow = true; });
        g.position.set(p.at[0], 0, p.at[1]); return g;
    },
    fin: (p, c) => {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 3), _mat(0x6b7b8c, { flatShading: true }));
        fin.scale.set(0.4, 1, 1.4);
        fin.position.set(p.at[0], -0.15, p.at[1]);
        fin.userData.circle = { cx: p.at[0], cz: p.at[1], r: 1.0, speed: 0.9, y: -0.15 };
        return fin;
    },
    kraken: (p) => {
        const g = new THREE.Group();
        const m = _mat(0x8e44ad, { roughness: 0.5 });
        for (let k = 0; k < 4; k++) {
            const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new THREE.Vector3((k - 1.5) * 1.6 + Math.sin(u * 3 + k) * 0.5, -0.7 + u * 2.6, Math.cos(u * 4 + k) * 0.4)); }
            const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.2, 8, false), m); t.castShadow = true; g.add(t);
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), m); head.position.set(0, -0.4, -1.2); g.add(head);
        [-0.4, 0.4].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), _mat(0xfde047, { emissive: 0xfde047, emissiveIntensity: 0.6 })); e.position.set(x, 0.2, -0.3); g.add(e); });
        g.position.set(p.at[0], 0, p.at[1]); g.userData.sway = true; return g;
    },
    lollipop: (p, c) => { const l = _lolly(p.scale || 1, [0xff5fa2, 0x7ed957, 0x5fb8ff, 0xffa53f][Math.abs(Math.round(p.at[0] + p.at[1])) % 4]); l.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return l; },
    cane: (p, c) => { const l = _caneMesh(p.scale || 1); l.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); l.rotation.y = p.at[0]; return l; },
    cupcake: (p, c) => { const l = _cupcake(p.scale || 1); l.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return l; },
    gumdrop: (p, c) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), _mat(0x7ed957, { roughness: 0.3 }));
        m.scale.y = 1.4; m.castShadow = true; m.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return m;
    },
    cherry: (p, c) => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), _mat(0xe8243c, { roughness: 0.15 })); b.position.y = 0.35; g.add(b);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), _mat(0x2f8f3a)); st.position.set(0.1, 0.9, 0); st.rotation.z = -0.3; g.add(st);
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    beacon: (p, c) => {
        const g = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), _mat(0x9aa3b5, { metalness: 0.6 })); post.position.y = 0.45; g.add(post);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf472b6 })); lamp.position.y = 0.95; g.add(lamp);
        lamp.userData.blink = p.at[0] + p.at[1];
        g.position.set(p.at[0], _y0(c, ...p.at), p.at[1]); return g;
    },
    satellite: (p) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.2), _mat(0xd4d4d8, { metalness: 0.6, roughness: 0.3 })); g.add(body);
        [-1, 1].forEach(sd => { const pan = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.9), _mat(0x1e3a8a, { metalness: 0.4, emissive: 0x1e3a8a, emissiveIntensity: 0.3 })); pan.position.x = sd * 1.6; g.add(pan); });
        const dish = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 14, 1, true), _mat(0xffffff, { side: THREE.DoubleSide })); dish.position.z = 0.8; dish.rotation.x = Math.PI / 2; g.add(dish);
        g.position.set(p.at[0], 3.5, p.at[1]); g.userData.spin = 0.3; return g;
    },
    planet: (p) => {
        const g = new THREE.Group();
        const pl = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 24), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.8, fog: false, emissive: 0x7c2d12, emissiveIntensity: 0.25 }));
        g.add(pl);
        const ring = new THREE.Mesh(new THREE.RingGeometry(9, 12.5, 48), new THREE.MeshBasicMaterial({ color: 0xfde68a, side: THREE.DoubleSide, transparent: true, opacity: 0.55, fog: false }));
        ring.rotation.x = Math.PI / 2.4; g.add(ring);
        g.position.set(p.at[0] * 2.2, -4, p.at[1] * 2.2); g.userData.spin = 0.05; return g;
    },
    crystal: (p, c) => {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.9, roughness: 0.2 }));
        m.position.set(p.at[0], (p.sink ? _y0(c, ...p.at) - 0.0 : 0) + 1.6, p.at[1]); m.userData.spin = 1.2; m.userData.hover = m.position.y; return m;
    },
});

function _stars(n = 700, r = 85) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u);
        pos.set([Math.cos(a) * q * r, Math.abs(u) * r * 0.9 - 8, Math.sin(a) * q * r], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false }));
}
Object.assign(SCENERY, {
    pirate(c, theme) {
        const g = new THREE.Group();
        const B = c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        const R0 = Math.max(B.x1 - B.x0, B.z1 - B.z0) / 2 + 6;
        const sand = new THREE.Mesh(new THREE.CircleGeometry(R0, 40), _mat(theme.ground, { roughness: 1 }));
        sand.rotation.x = -Math.PI / 2; sand.position.set(cx, SKIRT_TO, cz); sand.receiveShadow = true; g.add(sand);
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1a86cf, roughness: 0.2, metalness: 0.1, emissive: 0x0a3d66, emissiveIntensity: 0.35 }));
        sea.rotation.x = -Math.PI / 2; sea.position.set(cx, SKIRT_TO - 0.12, cz); g.add(sea);
        const surf = new THREE.Mesh(new THREE.RingGeometry(R0, R0 + 0.6, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
        surf.rotation.x = -Math.PI / 2; surf.position.set(cx, SKIRT_TO - 0.08, cz); g.add(surf);
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.4, t = _palm(1.2 + (i % 3) * 0.2); t.position.set(cx + Math.cos(a) * (R0 - 1.5), SKIRT_TO, cz + Math.sin(a) * (R0 - 1.5)); t.rotation.y = a; g.add(t); }
        // A ship anchored offshore.
        const ship = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 3.4), _mat(0x5a3a1e)); hull.position.y = 0.6; ship.add(hull);
        const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3, 4), _mat(0x5a3a1e)); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.position.set(6.4, 0.6, 0); ship.add(bow);
        [-2.5, 1.5].forEach(x => {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8, 8), _mat(0x3b2412)); m.position.set(x, 5, 0); ship.add(m);
            const s1 = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), _mat(0xf2e8d0, { side: THREE.DoubleSide })); s1.position.set(x, 5.5, 0.2); s1.rotation.y = Math.PI / 2; ship.add(s1);
        });
        const jr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), _mat(0x111111, { side: THREE.DoubleSide })); jr.position.set(-2.5, 9.3, 0); jr.rotation.y = Math.PI / 2; ship.add(jr);
        ship.position.set(cx + 6, SKIRT_TO - 0.3, cz - R0 - 9); ship.rotation.y = 0.3; ship.userData.sway = true; g.add(ship);
        // Rocks round the shore.
        for (let i = 0; i < 6; i++) { const a = i * 1.1 + 2.2, r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + (i % 3) * 0.4, 0), _mat(0x8a877d, { flatShading: true })); r.position.set(cx + Math.cos(a) * (R0 + 1.5), SKIRT_TO, cz + Math.sin(a) * (R0 + 1.5)); g.add(r); }
        return g;
    },
    candy(c, theme) {
        const g = new THREE.Group();
        const B = c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        const W = B.x1 - B.x0 + 34, D = B.z1 - B.z0 + 34;
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), _mat(theme.ground, { roughness: 0.9 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(cx, SKIRT_TO, cz); floor.receiveShadow = true; g.add(floor);
        // Sprinkles on the ground.
        const cols = [0xff3b6b, 0xffd23f, 0x5fb8ff, 0x7ed957, 0xffffff];
        const sp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.03, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff }), 260);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
        for (let i = 0; i < 260; i++) {
            q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
            m4.compose(new THREE.Vector3(cx + (Math.random() - 0.5) * W, SKIRT_TO + 0.02, cz + (Math.random() - 0.5) * D), q, new THREE.Vector3(1, 1, 1));
            sp.setMatrixAt(i, m4); sp.setColorAt(i, col.setHex(cols[i % cols.length]));
        }
        g.add(sp);
        const ring = (n, r, f) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r * 0.1, o = f(i); o.position.set(cx + Math.cos(a) * (W / 2 - 3), SKIRT_TO, cz + Math.sin(a) * (D / 2 - 3)); g.add(o); } };
        ring(6, 1, i => _lolly(2 + (i % 2), [0xff5fa2, 0x7ed957, 0x5fb8ff, 0xffa53f][i % 4]));
        ring(5, 7, i => { const o = _caneMesh(2.2); o.rotation.y = i; return o; });
        ring(5, 13, () => _cupcake(2.4));
        // Cotton-candy clouds.
        for (let i = 0; i < 6; i++) {
            const cl = new THREE.Group();
            for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.2 + k * 0.2, 12, 10), _mat(i % 2 ? 0xffc2e2 : 0xd6ecff, { roughness: 1 })); b.position.set(k * 1.3 - 2, Math.sin(k) * 0.4, 0); cl.add(b); }
            cl.position.set(cx + (i - 2.5) * 9, 11 + (i % 3) * 2, cz - D / 2 - 4 + (i % 2) * 6); cl.userData.drift = i; g.add(cl);
        }
        return g;
    },
    space(c, theme) {
        const g = new THREE.Group();
        const B = c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        const st = _stars(); st.position.set(cx, 0, cz); g.add(st);
        // Girders under the panels: the station's frame.
        const beam = _mat(0x6b7280, { metalness: 0.7, roughness: 0.4 });
        c.tiles.forEach(t => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), beam);
            leg.position.set(t.cx, SKIRT_TO - 1.5, t.cz); g.add(leg);
            const glow = new THREE.Mesh(new THREE.BoxGeometry(t.x1 - t.x0, 0.05, t.z1 - t.z0), new THREE.MeshBasicMaterial({ color: theme.rail, transparent: true, opacity: 0.18 }));
            glow.position.set(t.cx, SKIRT_TO - 0.05, t.cz); g.add(glow);
        });
        const truss = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0 + 6, 0.3, 0.3), beam); truss.position.set(cx, SKIRT_TO - 3, cz); g.add(truss);
        const earth = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 24), new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1e3a8a, emissiveIntensity: 0.4, roughness: 0.6, fog: false }));
        earth.position.set(cx - 20, -30, cz - 40); g.add(earth);
        const land = new THREE.Mesh(new THREE.SphereGeometry(16.1, 16, 12), new THREE.MeshStandardMaterial({ color: 0x16a34a, transparent: true, opacity: 0.55, fog: false, flatShading: true }));
        land.position.copy(earth.position); land.scale.set(1, 0.9, 1); land.userData.spin = 0.02; g.add(land);
        return g;
    },
});

/** Per-frame touches for props that move (the sprinkler's spray, ducks bobbing). */
export function animateProps(root, t) {
    root.traverse(o => {
        const u = o.userData;
        if (u.spray) {
            u.spray.forEach((d, i) => {
                const k = ((t * 0.9 + i / u.spray.length) % 1), a = t * 1.1 + i * 0.5;
                d.position.set(Math.cos(a) * k * 3.2, Math.sin(k * Math.PI) * 1.2, Math.sin(a) * k * 3.2);
                d.material.opacity = 0.8 * (1 - k);
            });
        }
        if (u.bob) { if (u.y0 == null) u.y0 = o.position.y; o.position.y = u.y0 + Math.sin(t * 2 + o.position.x) * 0.03; o.rotation.y = Math.sin(t * 0.7 + o.position.z) * 0.6; }
        if (u.circle) { const q = u.circle, a = t * q.speed; o.position.set(q.cx + Math.cos(a) * q.r, q.y, q.cz + Math.sin(a) * q.r); o.rotation.y = -a; }
        if (u.sway) o.rotation.z = Math.sin(t * 0.8) * 0.04;
        if (u.spin) o.rotation.y += u.spin * 0.016;
        if (u.hover != null) o.position.y = u.hover + Math.sin(t * 2) * 0.15;
        if (u.blink != null) o.visible = Math.sin(t * 4 + u.blink) > -0.3;
        if (u.drift != null) o.position.x += Math.sin(t * 0.2 + u.drift) * 0.004;
    });
}
export { R as BALL_R };
