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
import { tileHeight, moverWalls, windmillAngle, HAZARD, CUP_R, R } from './Physics.js';

const SKIRT_TO = -0.7;        // the course stands on a plinth down to here

function _mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }); }
const _shade = (hex, k) => {
    const c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
    return c;
};

/** A tile's floor as a mesh: a grid whose heights are the tile's own. */
function _floor(t, theme) {
    const w = t.x1 - t.x0, d = t.z1 - t.z0;
    const hilly = t.hills.length > 0;
    const sx = Math.max(1, Math.ceil(w / (hilly ? 0.25 : 1))), sz = Math.max(1, Math.ceil(d / (hilly ? 0.25 : 1)));
    const geo = new THREE.PlaneGeometry(w, d, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = [];
    const turfA = new THREE.Color(theme.turf[0]), turfB = new THREE.Color(theme.turf[1]);
    const base = new THREE.Color(t.kind === 'sand' ? theme.sand : t.kind === 'wood' ? theme.wood : t.kind === 'ice' ? (theme.ice ?? 0xdff4ff)
        : t.kind === 'boost' ? (theme.boost ?? 0xffd23f) : t.kind === 'carpet' ? (theme.carpet ?? 0xc0392b) : t.kind === 'rough' ? (theme.rough ?? 0x2e7d32)
        : HAZARD[t.kind] ? (theme[t.kind] ?? theme.water) : theme.turf[0]);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + t.cx, z = pos.getZ(i) + t.cz;
        pos.setY(i, tileHeight(t, x, z));
        let c = base;
        if (t.kind === 'turf') c = (Math.floor(x / 1.2) % 2 === 0) ? turfA : turfB;   // mown stripes
        if (t.kind === 'wood') c = _shade(theme.wood, Math.floor(x / 0.4) % 2 ? 1 : 0.88);
        if (t.kind === 'sand') c = _shade(theme.sand, 0.95 + 0.1 * Math.abs(Math.sin(x * 7.1 + z * 3.3)));
        cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const water = !!HAZARD[t.kind];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: water ? 0.15 : t.kind === 'ice' ? 0.2 : 0.9,
        metalness: water ? 0.1 : 0, transparent: water, opacity: water ? 0.85 : 1,
        emissive: water ? new THREE.Color(theme[t.kind] ?? theme.water).multiplyScalar(0.25) : 0x000000 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(t.cx, 0, t.cz);
    m.receiveShadow = true;
    if (water) m.userData.water = { geo, base: Array.from(pos.array) };
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
    const live = { windmills: [], sweepers: [], sliders: [], water: [], bumpers: [], flag: null, sprays: [] };
    const edgeMat = _mat(theme.edge, { roughness: 0.8 });
    const railMat = _mat(theme.rail, { roughness: 0.5 });
    const capMat = _mat(theme.accent, { roughness: 0.5 });
    const blockMat = _mat(theme.block, { roughness: 0.9 });

    c.tiles.forEach(t => {
        const f = _floor(t, theme); root.add(f);
        if (f.userData.water) live.water.push(f);
        root.add(_skirts(t, edgeMat));
    });
    c.walls.forEach(w => root.add(_wallMesh(w, w.block ? blockMat : railMat, capMat)));
    // Solid blocks get a lid.
    (c.hole.blocks || []).forEach(([x0, z0, x1, z1, h]) => {
        const hh = h ?? 0.5, base = Math.min(...c.tiles.filter(t => t.x0 <= x1 && t.x1 >= x0 && t.z0 <= z1 && t.z1 >= z0).map(t => t.y), 0);
        const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), hh, Math.abs(z1 - z0)), blockMat);
        m.position.set((x0 + x1) / 2, base + hh / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; root.add(m);
    });
    // Bumpers: a post with a glowing band.
    c.bumpers.forEach(p => {
        const g = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.05, 0.42, 22), _mat(theme.bumper ?? 0xff4f8b, { roughness: 0.35 }));
        post.position.y = 0.21; post.castShadow = true; g.add(post);
        const band = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.02, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe08a, emissiveIntensity: 0.6 }));
        band.rotation.x = Math.PI / 2; band.position.y = 0.3; g.add(band);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.55, p.r * 0.55, 0.06, 16), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
        top.position.y = 0.44; g.add(top);
        g.position.set(p.x, p.y, p.z); root.add(g);
        live.bumpers.push({ p, g, band, t: 0 });
    });
    // The cup, its rim and the flag.
    {
        const cupG = new THREE.Group();
        const hole = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 28), new THREE.MeshBasicMaterial({ color: 0x050806 }));
        hole.rotation.x = -Math.PI / 2; hole.position.y = 0.012; cupG.add(hole);
        const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + 0.05, 28), new THREE.MeshBasicMaterial({ color: 0xf7f7f2 }));
        rim.rotation.x = -Math.PI / 2; rim.position.y = 0.014; cupG.add(rim);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), _mat(0xf2f2f2, { roughness: 0.3, metalness: 0.4 }));
        pole.position.y = 1.05; cupG.add(pole);
        const fg = new THREE.PlaneGeometry(0.9, 0.56, 8, 2);
        fg.translate(0.45, 0, 0);
        const flagTex = _textTex(String(holeNo), '#' + new THREE.Color(theme.flag ?? 0xff3b3b).getHexString(), '#ffffff');
        const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 }));
        flag.position.set(0.03, 1.8, 0); cupG.add(flag);
        cupG.position.set(c.cup.x, c.cup.y, c.cup.z);
        root.add(cupG);
        live.flag = { flag, base: Array.from(fg.attributes.position.array), cupG, pole };
    }
    // The tee mat.
    {
        const mat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 1.0), _mat(theme.tee ?? 0x1f5130, { roughness: 1 }));
        mat.position.set(c.tee.x, c.tee.y + 0.015, c.tee.z); mat.receiveShadow = true; root.add(mat);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.rotation.x = -Math.PI / 2; dot.position.set(c.tee.x, c.tee.y + 0.035, c.tee.z); root.add(dot);
    }
    // Pipes: a mouth and an exit.
    c.pipes.forEach(p => {
        [p.a, p.b].forEach((q, k) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.04, 0.07, 8, 24), _mat(theme.pipe ?? 0x2e9e57, { roughness: 0.4 }));
            ring.rotation.x = Math.PI / 2;
            const y = c.tiles.reduce((h, t) => (q[0] >= t.x0 && q[0] <= t.x1 && q[1] >= t.z0 && q[1] <= t.z1 ? Math.max(h, tileHeight(t, q[0], q[1])) : h), -9);
            ring.position.set(q[0], y + 0.04, q[1]); root.add(ring);
            if (!k) {
                const mouth = new THREE.Mesh(new THREE.CircleGeometry(p.r, 20), new THREE.MeshBasicMaterial({ color: 0x08130c }));
                mouth.rotation.x = -Math.PI / 2; mouth.position.set(q[0], y + 0.01, q[1]); root.add(mouth);
            }
        });
    });
    // Movers.
    c.movers.forEach(m => {
        const base = c.tiles.reduce((h, t) => (m.x >= t.x0 && m.x <= t.x1 && m.z >= t.z0 && m.z <= t.z1 ? Math.max(h, tileHeight(t, m.x, m.z)) : h), 0);
        if (m.type === 'windmill') {
            const holder = new THREE.Group();
            const sails = new THREE.Group();
            const sailM = _mat(theme.sail ?? 0xfffaf0, { side: THREE.DoubleSide, roughness: 0.6 });
            const sparM = _mat(0x6b3f1d);
            for (let k = 0; k < 4; k++) {
                const arm = new THREE.Group();
                const spar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.06), sparM); spar.position.y = 0.95; arm.add(spar);
                const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.4), sailM); cloth.position.set(0.24, 1.1, 0.03); arm.add(cloth);
                arm.rotation.z = k * Math.PI / 2; sails.add(arm);
            }
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 12), sparM); hub.rotation.x = Math.PI / 2; sails.add(hub);
            holder.add(sails);
            // The sails face the way the ball comes: across the door axis.
            const hubY = base + 2.05;
            if (m.axis === 'z') { holder.position.set(m.x - 0.12, hubY, m.z); holder.rotation.y = -Math.PI / 2; }
            else { holder.position.set(m.x, hubY, m.z - 0.12); }
            root.add(holder);
            const gate = new THREE.Mesh(new THREE.BoxGeometry(m.axis === 'z' ? 0.14 : (m.w || 0.55) * 2, 0.06, m.axis === 'z' ? (m.w || 0.55) * 2 : 0.14),
                new THREE.MeshBasicMaterial({ color: 0xffd23f }));
            gate.position.set(m.x, base + 0.01, m.z); root.add(gate);
            live.windmills.push({ m, sails, gate });
        } else if (m.type === 'sweeper') {
            const g = new THREE.Group();
            const bar = new THREE.Mesh(new THREE.BoxGeometry((m.len || 2) * 2, 0.22, 0.18), _mat(theme.sweeper ?? 0xffd23f, { roughness: 0.4 }));
            bar.position.y = 0.16; bar.castShadow = true; g.add(bar);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.4, 16), _mat(theme.accent));
            hub.position.y = 0.2; g.add(hub);
            g.position.set(m.x, base, m.z); root.add(g);
            live.sweepers.push({ m, g });
        } else if (m.type === 'slider') {
            const L = m.len || 1.6;
            const box = new THREE.Mesh(new THREE.BoxGeometry((m.bar || 'z') === 'x' ? L : 0.3, 0.4, (m.bar || 'z') === 'x' ? 0.3 : L), _mat(theme.slider ?? 0x7c4dff, { roughness: 0.4 }));
            box.castShadow = true; box.position.y = base + 0.2; root.add(box);
            live.sliders.push({ m, box });
        }
    });
    // Props and the world round the course.
    (c.hole.props || []).forEach(p => { const o = PROPS[p.type]?.(p, c, theme); if (o) root.add(o); });
    const world = SCENERY[theme.scenery]?.(c, theme);
    if (world) root.add(world);

    stage.add(root);

    return {
        root,
        update(dt, t) {
            live.windmills.forEach(w => { w.sails.rotation.z = windmillAngle(w.m, t); w.gate.visible = moverWalls({ movers: [w.m], tiles: c.tiles }, t).length > 0; });
            live.sweepers.forEach(s => { s.g.rotation.y = -t * (s.m.speed || 1.2); });
            live.sliders.forEach(s => {
                const wl = moverWalls({ movers: [s.m], tiles: c.tiles }, t)[0];
                s.box.position.x = (wl.x1 + wl.x2) / 2; s.box.position.z = (wl.z1 + wl.z2) / 2;
            });
            live.water.forEach(m => {
                const { geo, base } = m.userData.water, pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 2.2 + base[i * 3] * 1.7 + base[i * 3 + 2] * 1.3) * 0.025;
                pos.needsUpdate = true;
            });
            if (live.flag) {
                const { flag, base } = live.flag, pos = flag.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) { const x = base[i * 3]; pos.array[i * 3 + 2] = Math.sin(t * 5 - x * 4) * 0.08 * x; }
                pos.needsUpdate = true;
            }
            live.bumpers.forEach(b => {
                if (b.t > 0) { b.t = Math.max(0, b.t - dt); }
                const k = b.t / 0.25;
                b.g.scale.set(1 + k * 0.18, 1, 1 + k * 0.18);
                b.band.material.emissiveIntensity = 0.6 + k * 2.5;
            });
        },
        pulse(p) { const b = live.bumpers.find(x => x.p === p); if (b) b.t = 0.25; },
        /** Lift the flag out while a ball is on the green close by. */
        flagOut(on) { if (live.flag) live.flag.cupG.children.slice(2).forEach(o => { o.visible = !on; }); },
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
        for (let i = 0; i < 14; i++) {
            const f = _flowers(3, 0.25);
            f.position.set(x0 + 0.3 + ((i * 0.37) % 1) * (x1 - x0 - 0.6), -0.45, z0 + 0.3 + (i / 14) * (z1 - z0 - 0.6));
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
        const a = p.from, b = p.to;
        const pts = [new THREE.Vector3(a[0], -0.05, a[1]), new THREE.Vector3(a[0] + 0.9, -0.3, a[1]), new THREE.Vector3((a[0] + b[0]) / 2 + 1.4, -0.35, (a[1] + b[1]) / 2),
                     new THREE.Vector3(b[0] + 0.9, -0.3, b[1]), new THREE.Vector3(b[0], -0.05, b[1])];
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.3, 10, false), _mat(0x2e9e57, { roughness: 0.4 }));
        m.castShadow = true; return m;
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
    windmill: (p, c) => {
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
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(W, D), _mat(theme.ground, { roughness: 1 }));
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
        house.position.set(cx, SKIRT_TO, fz0 - 4); g.add(house);
        // Trees round the edge.
        [[fx0 + 1.5, fz0 + 1.5, 1.4], [fx1 - 1.5, fz0 + 2, 1.2], [fx0 + 1.2, fz1 - 1.5, 1.1], [fx1 - 2, fz1 - 1.2, 1.5], [cx + 4, fz1 - 1, 1.0]]
            .forEach(([x, z, s]) => { const t = _tree(s); t.position.set(x, SKIRT_TO, z); g.add(t); });
        // A parasol and a paddling-pool lilo, because it's summer.
        const para = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), _mat(0xffffff)); pole.position.y = 1.3; para.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), _mat(0xff5d5d)); top.position.y = 2.6; para.add(top);
        para.position.set(fx1 - 3.5, SKIRT_TO, cz); g.add(para);
        return g;
    },
};

/** Per-frame touches for props that move (the sprinkler's spray, ducks bobbing). */
export function animateProps(root, t) {
    root.traverse(o => {
        if (o.userData.spray) {
            o.userData.spray.forEach((d, i) => {
                const k = ((t * 0.9 + i / o.userData.spray.length) % 1), a = t * 1.1 + i * 0.5;
                d.position.set(Math.cos(a) * k * 3.2, Math.sin(k * Math.PI) * 1.2, Math.sin(a) * k * 3.2);
                d.material.opacity = 0.8 * (1 - k);
            });
        }
        if (o.userData.bob) { o.position.y += Math.sin(t * 2 + o.position.x) * 0.002; o.rotation.y = Math.sin(t * 0.7 + o.position.z) * 0.6; }
    });
}
export { R as BALL_R };
