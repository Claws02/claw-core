// ============================================================
// GOLF TOYS — the obstacles, drawn chunky: rounded clay boxes, posts with
// caps, bolts and lamps, glossy paint. Build.js places them; every size comes
// from the same numbers the physics uses, so nothing here changes how a ball
// rolls — only what it looks like.
//
//   rbox(w, h, d, r, mat)               a rounded, bevelled box, centred
//   rail(w, theme, mats)                a rail along a wall segment
//   railPost(x, y, z, h, theme, mats)   the post where rails meet
//   block(b, base, theme, kind)         hedge, crate, stone, bulkhead, mill, cabin
//   bumper(p, theme)                    pinball mushroom, gumdrop, asteroid, barrel
//   windmill(m, base, theme, blocks)    the mill (or a cabin) and its sails
//   airlock(m, base, theme)             a sliding blast door with a lamp
//   pipeEnd(p, end, y, theme)           a hose mouth, a landing target, a teleport pad
//   loop(l, y, theme)                   hoops of rail, or a donut
//   sweeper(m, base, theme) / slider(m, base, theme)
// ============================================================
import { R } from './Physics.js';

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const glossy = (color, o = {}) => mat(color, { roughness: 0.28, ...o });
const glow = (color, k = 0.9) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3 });
const shadowed = o => { o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); return o; };

/** A rounded, bevelled box (the clay look), centred on the origin. */
export function rbox(w, h, d, r, material) {
    const bev = Math.max(0.004, Math.min(r * 0.6, h * 0.25, w * 0.2, d * 0.2, 0.07));
    const W = Math.max(0.01, w - bev * 2), D = Math.max(0.01, d - bev * 2), H = Math.max(0.005, h - bev * 2);
    const rr = Math.max(0.002, Math.min(r - bev * 0.5, W / 2 - 0.001, D / 2 - 0.001));
    const s = new THREE.Shape(), x = -W / 2, y = -D / 2;
    s.moveTo(x + rr, y); s.lineTo(x + W - rr, y); s.quadraticCurveTo(x + W, y, x + W, y + rr);
    s.lineTo(x + W, y + D - rr); s.quadraticCurveTo(x + W, y + D, x + W - rr, y + D);
    s.lineTo(x + rr, y + D); s.quadraticCurveTo(x, y + D, x, y + D - rr);
    s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -H / 2, 0);
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
}

let _tex = {};
function _stripes(key, a, b, diag = true) {
    if (_tex[key]) return _tex[key];
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, 64, 64); x.fillStyle = b;
    if (diag) for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 + 64, 64); x.lineTo(i + 64, 64); x.fill(); }
    else for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 8, 64);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (_tex[key] = t);
}
export const caneTex = () => _stripes('cane', '#ffffff', '#e8243c');
export const hazardTex = () => _stripes('hazard', '#facc15', '#1f2937');
/** Forget the cached textures (a stage disposes its materials and their maps). */
export function resetTextures() { _tex = {}; }

// ── Rails ────────────────────────────────────────────────────────────────────
/** One rail along wall `w`, rounded, in the theme's finish. */
export function rail(w, theme, mats) {
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1), th = 0.13;
    const g = new THREE.Group();
    if (w.mat === 'hedge') {
        // A clipped hedge: a rounded green block with leafy lumps along the top.
        const hedge = rbox(len + 0.1, w.h + 0.1, 0.34, 0.14, mat(0x2f8f3a, { roughness: 0.95 }));
        g.add(hedge);
        const leaf = mat(0x3fa548, { roughness: 1 });
        const n = Math.max(2, Math.round(len / 0.45));
        for (let i = 0; i < n; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), leaf); b.position.set(-len / 2 + len * (i + 0.5) / n, w.h / 2 + 0.02, (i % 2 ? 0.05 : -0.05)); b.scale.y = 0.7; g.add(b); }
        g.position.set((w.x1 + w.x2) / 2, (w.b1 + w.b2) / 2 + w.h / 2, (w.z1 + w.z2) / 2);
        g.rotation.y = -Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
        return shadowed(g);
    }
    if (w.mat === 'inflatable') {
        // A bouncy castle's wall: a fat, soft tube, in stripes of bright vinyl.
        const cols = theme.inflatable || [0xff6b6b, 0xffd166, 0x4dabf7];
        const n = Math.max(1, Math.round(len / 0.9));
        for (let i = 0; i < n; i++) {
            const seg = rbox(len / n + 0.02, w.h + 0.06, 0.3, 0.14, glossy(cols[i % cols.length], { roughness: 0.35 }));
            seg.position.x = -len / 2 + len * (i + 0.5) / n; g.add(seg);
        }
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, len + 0.1, 12), glossy(cols[(n + 1) % cols.length], { roughness: 0.3 }));
        top.rotation.z = Math.PI / 2; top.position.y = w.h / 2 + 0.06; g.add(top);
        g.position.set((w.x1 + w.x2) / 2, (w.b1 + w.b2) / 2 + w.h / 2, (w.z1 + w.z2) / 2);
        g.rotation.y = -Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
        g.userData.soft = true;
        return shadowed(g);
    }
    let m = mats.rail;
    if (theme.railTex === 'cane' || w.mat === 'candy') {
        const t = caneTex().clone(); t.needsUpdate = true; t.repeat.set(2, 2);
        m = glossy(0xffffff, { map: t });
    }
    const body = rbox(len + th * 0.6, w.h, th, th * 0.5, m);
    g.add(body);
    if (theme.railGlow) {
        // A lit strip along the top of a dark rail.
        body.material = mats.railDark;
        const strip = rbox(len, 0.05, th * 0.7, 0.025, glow(theme.rail, 1.1)); strip.position.y = w.h / 2 + 0.01; g.add(strip);
    } else if (theme.scenery === 'pirate') {
        // Rope along the top of the planks.
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 6), mat(0xd8b67a, { roughness: 0.9 }));
        rope.rotation.z = Math.PI / 2; rope.position.y = w.h / 2 + 0.03; g.add(rope);
    } else if (theme.railTex !== 'cane') {
        const cap = rbox(len + th * 0.6, 0.05, th + 0.04, 0.04, mats.cap); cap.position.y = w.h / 2; g.add(cap);
    }
    g.position.set((w.x1 + w.x2) / 2, (w.b1 + w.b2) / 2 + w.h / 2, (w.z1 + w.z2) / 2);
    g.rotation.order = 'YZX';
    g.rotation.y = -Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
    g.rotation.z = Math.atan2(w.b2 - w.b1, len);
    return shadowed(g);
}

/** The post where rails meet (and at their ends): a round post with a cap. */
export function railPost(x, y, z, h, theme, mats) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, h + 0.06, 12), theme.railGlow ? mats.railDark : theme.railTex === 'cane' ? glossy(0xffffff) : mats.rail);
    post.position.y = (h + 0.06) / 2; g.add(post);
    let cap;
    if (theme.railGlow) cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), glow(theme.rail, 1.2));
    else if (theme.railTex === 'cane') cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 16), new THREE.MeshStandardMaterial({ map: caneTex(), roughness: 0.3 }));
    else if (theme.scenery === 'pirate') cap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 14), mat(0xd8b67a));
    else cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), glossy(theme.accent));
    if (theme.scenery === 'pirate') cap.rotation.x = Math.PI / 2;
    cap.position.y = h + 0.08; g.add(cap);
    g.position.set(x, y, z);
    return shadowed(g);
}

// ── Blocks ───────────────────────────────────────────────────────────────────
/** Which way a block is drawn, from its course and its size. */
export function blockKind(theme, h, mill) {
    if (mill) return theme.windmill === 'airlock' ? 'bulkhead' : theme.scenery === 'pirate' ? 'cabin' : 'mill';
    if (theme.scenery === 'pirate') return h <= 0.7 ? 'crate' : 'stone';
    if (theme.scenery === 'space') return 'bulkhead';
    if (theme.scenery === 'backyard') return 'hedge';
    return 'plain';
}

export function block([x0, z0, x1, z1, h], base, theme, kind) {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), hh = h ?? 0.5;
    const g = new THREE.Group();
    const add = (o, y = hh / 2) => { o.position.y = y; g.add(o); return o; };
    if (kind === 'hedge') {
        add(rbox(w, hh, d, 0.25, mat(0x2f8f3a, { roughness: 0.95 })));
        const leaf = mat(0x3fa548, { roughness: 1 });
        const n = Math.max(2, Math.round(Math.max(w, d) / 0.5));
        for (let i = 0; i < n; i++) {
            const u = (i + 0.5) / n, b = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.42, 10, 8), leaf);
            b.position.set(w > d ? -w / 2 + w * u : 0, hh - 0.05, d >= w ? -d / 2 + d * u : 0); b.scale.y = 0.7; g.add(b);
        }
    } else if (kind === 'crate') {
        add(rbox(w, hh, d, 0.06, mat(0xb07a42)));
        const trim = mat(0x6b4423);
        // Dark planks round each face and a diagonal brace.
        [[w, 0.08, d + 0.02, hh - 0.04], [w, 0.08, d + 0.02, 0.04]].forEach(([a, b2, c2, y]) => add(rbox(a + 0.02, b2, c2, 0.03, trim), y));
        const brace = rbox(Math.hypot(w, hh) * 0.9, 0.07, d + 0.03, 0.03, trim); brace.rotation.z = Math.atan2(hh, w); add(brace);
    } else if (kind === 'stone') {
        add(rbox(w, hh, d, 0.18, mat(0x8f8b80, { roughness: 1, flatShading: true })));
        const rock = mat(0x7a776d, { roughness: 1, flatShading: true });
        for (let i = 0; i < 3; i++) {
            const r = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.min(w, d) * 0.33, 0), rock);
            r.position.set((i - 1) * w * 0.28, hh - 0.04, (i % 2 ? 1 : -1) * d * 0.15); r.rotation.set(i, i * 2, 0); g.add(r);
        }
    } else if (kind === 'bulkhead') {
        add(rbox(w, hh, d, 0.12, mat(0x55606e, { metalness: 0.5, roughness: 0.35 })));
        const hz = new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.5 });
        add(rbox(w + 0.03, 0.16, d + 0.03, 0.1, hz), hh - 0.16);
        add(rbox(w + 0.02, 0.04, d + 0.02, 0.05, glow(theme.rail, 0.9)), hh * 0.4);
        // Rivets along the top.
        const riv = mat(0xc0c7d1, { metalness: 0.7, roughness: 0.3 });
        const n = Math.max(2, Math.round(Math.max(w, d) / 0.35));
        for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, r = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), riv); r.position.set(w > d ? -w / 2 + w * u : w / 2 + 0.01, hh - 0.32, d >= w ? -d / 2 + d * u : d / 2 + 0.01); g.add(r); }
    } else if (kind === 'mill') {
        add(rbox(w, hh, d, 0.1, mat(0xc4553a, { roughness: 0.9 })));
        // Brick courses and stone corners.
        const mortar = mat(0xe9d6c0, { roughness: 1 });
        for (let y = 0.25; y < hh - 0.1; y += 0.25) add(rbox(w + 0.015, 0.025, d + 0.015, 0.02, mortar), y);
        const quoin = mat(0xf2e6d4, { roughness: 0.9 });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const q = rbox(0.18, hh, 0.18, 0.05, quoin); q.position.set(sx * (w / 2 - 0.07), hh / 2, sz * (d / 2 - 0.07)); g.add(q);
        }
    } else if (kind === 'cabin') {
        add(rbox(w, hh, d, 0.06, mat(0x8b5a2b, { roughness: 0.8 })));
        const seam = mat(0x5a3a1e);
        for (let y = 0.2; y < hh - 0.05; y += 0.2) add(rbox(w + 0.015, 0.02, d + 0.015, 0.01, seam), y);
    } else add(rbox(w, hh, d, 0.15, glossy(theme.block)));
    g.position.set((x0 + x1) / 2, base, (z0 + z1) / 2);
    return shadowed(g);
}

// ── Bumpers ──────────────────────────────────────────────────────────────────
/** A bumper in the course's style. Returns { g, flash: a material to light up on a hit, squash }. */
export function bumper(p, theme) {
    const g = new THREE.Group();
    if (p.kick === 0 && p.r < 0.25) {
        // A peg: a gumball on a stick (candy), a lit post (space), a little post.
        const cols = [0xff5fa2, 0xffd23f, 0x5fb8ff, 0x7ed957, 0xb57bff, 0xff8a3d];
        const k = ((Math.round(p.x * 5 + p.z * 3) % cols.length) + cols.length) % cols.length;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), mat(0xffffff)); stick.position.y = 0.15; g.add(stick);
        const head = new THREE.Mesh(new THREE.SphereGeometry(p.r + 0.02, 14, 10), theme.railGlow ? glow(theme.rail, 0.8) : glossy(cols[k], { roughness: 0.15, emissive: cols[k], emissiveIntensity: 0.05 }));
        head.position.y = 0.3; g.add(head);
        g.position.set(p.x, p.y, p.z);
        return { g: shadowed(g), flash: head.material, squash: false };
    }
    if ((p.e ?? 0) >= 0.9) {
        // An inflatable: a striped balloon turret on a fat base. It squashes when hit.
        const cols = theme.inflatable || [0xff6b6b, 0xffd166, 0x4dabf7];
        const k = ((Math.round(p.x * 3 + p.z * 5) % cols.length) + cols.length) % cols.length;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.05, p.r * 1.12, 0.32, 20), glossy(cols[k], { roughness: 0.32 }));
        base.position.y = 0.16; g.add(base);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(p.r * 0.95, 20, 14), glossy(cols[(k + 1) % cols.length], { roughness: 0.25, emissive: cols[(k + 1) % cols.length], emissiveIntensity: 0.05 }));
        ball.position.y = 0.32 + p.r * 0.8; ball.scale.y = 1.15; g.add(ball);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(p.r * 0.45, p.r * 0.8, 12), glossy(cols[(k + 2) % cols.length], { roughness: 0.3 }));
        cone.position.y = 0.32 + p.r * 1.85 + p.r * 0.3; g.add(cone);
        g.position.set(p.x, p.y, p.z);
        return { g: shadowed(g), flash: ball.material, squash: true };
    }
    const style = p.style || theme.bumperStyle || (theme.scenery === 'candy' ? 'gumdrop' : theme.scenery === 'space' ? 'rock' : theme.scenery === 'pirate' ? 'barrel' : 'post');
    let flash;
    if (style === 'gumdrop') {
        const cols = [0xff5fa2, 0x7ed957, 0xffd23f, 0x5fb8ff, 0xb57bff];
        const k = ((Math.round(p.x * 3 + p.z * 7) % 5) + 5) % 5;
        const drop = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.05, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), glossy(cols[k], { roughness: 0.18, emissive: cols[k], emissiveIntensity: 0.05 }));
        drop.scale.y = 1.35; g.add(drop); flash = drop.material;
        // Sugar.
        const sug = mat(0xffffff, { roughness: 0.4 });
        for (let i = 0; i < 14; i++) {
            const a = i * 2.4, el = 0.25 + (i % 5) * 0.22;
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), sug);
            s.position.set(Math.cos(a) * Math.cos(el) * p.r * 1.06, Math.sin(el) * p.r * 1.4, Math.sin(a) * Math.cos(el) * p.r * 1.06); s.rotation.set(i, i * 2, 0); g.add(s);
        }
    } else if (style === 'rock') {
        const geo = new THREE.IcosahedronGeometry(p.r * 1.08, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pos, i), k = 1 + 0.12 * Math.sin(v.x * 9 + p.x) * Math.cos(v.z * 7 + p.z);
            pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
        }
        geo.computeVertexNormals();
        const rock = new THREE.Mesh(geo, mat(theme.bumper, { roughness: 0.95, flatShading: true, emissive: theme.bumper, emissiveIntensity: 0.08 }));
        rock.position.y = p.r * 0.75; g.add(rock); flash = rock.material;
        const crater = mat(0x3b2a5c, { roughness: 1 });
        for (let i = 0; i < 4; i++) {
            const a = i * 1.7 + p.x, el = 0.2 + (i % 2) * 0.5;
            const cr = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.22, 10), crater);
            const n = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
            cr.position.copy(n.clone().multiplyScalar(p.r * 1.1)).add(new THREE.Vector3(0, p.r * 0.75, 0));
            cr.lookAt(cr.position.clone().add(n)); g.add(cr);
        }
        g.userData.spin = 0.4;
    } else if (style === 'barrel') {
        // A bulging barrel of staves, two iron hoops and a lid.
        const pts = [];
        for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new THREE.Vector2(p.r * (0.86 + 0.14 * Math.sin(u * Math.PI)), u * 0.56)); }
        const geo = new THREE.LatheGeometry(pts, 16);
        const cols = [], pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)), k = Math.floor((a + Math.PI) / (Math.PI / 8)) % 2 ? 1 : 0.85; cols.push(0.6 * k, 0.36 * k, 0.17 * k); }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        const b = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.8, emissive: 0xffa040, emissiveIntensity: 0 }));
        g.add(b); flash = b.material;
        const iron = mat(0x2b2b30, { metalness: 0.6, roughness: 0.4 });
        [0.1, 0.46].forEach(y => { const h = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.95, 0.025, 6, 22), iron); h.rotation.x = Math.PI / 2; h.position.y = y; g.add(h); });
        const lid = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.86, 18), mat(0x7a4a1e)); lid.rotation.x = -Math.PI / 2; lid.position.y = 0.561; g.add(lid);
    } else {
        // A pinball mushroom: white skirt, a rubber ring, a lit dome.
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.9, p.r * 1.0, 0.2, 22), glossy(0xf8f5ee)); skirt.position.y = 0.1; g.add(skirt);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.96, 0.08, 10, 26), glossy(theme.bumper ?? 0xff4f8b, { roughness: 0.4 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(p.r * 0.85, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffc93c, emissiveIntensity: 0.35, roughness: 0.2 }));
        dome.scale.y = 0.55; dome.position.y = 0.28; g.add(dome); flash = dome.material;
        const star = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.25, 5), new THREE.MeshBasicMaterial({ color: 0xff4f8b }));
        star.rotation.x = -Math.PI / 2; star.position.y = 0.28 + p.r * 0.47; g.add(star);
    }
    g.position.set(p.x, p.y, p.z);
    return { g: shadowed(g), flash, squash: style === 'gumdrop' };
}

// ── The windmill ─────────────────────────────────────────────────────────────
function _sails(L, theme) {
    const sails = new THREE.Group();
    const wood = mat(0x7a4a24, { roughness: 0.7 });
    const cloth = mat(theme.sail ?? 0xfffaf0, { side: THREE.DoubleSide, roughness: 0.75 });
    const stripe = mat(theme.accent, { side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) {
        const arm = new THREE.Group();
        const spar = rbox(0.11, L, 0.09, 0.04, wood); spar.position.y = L / 2; arm.add(spar);
        // A lattice frame with the cloth stretched in it.
        const fw = 0.46, fy0 = L * 0.22, fh = L * 0.74;
        const rail2 = rbox(0.05, fh, 0.05, 0.02, wood); rail2.position.set(fw, fy0 + fh / 2, 0.02); arm.add(rail2);
        for (let i = 0; i <= 4; i++) { const slat = rbox(fw + 0.04, 0.04, 0.04, 0.015, wood); slat.position.set(fw / 2, fy0 + fh * i / 4, 0.02); arm.add(slat); }
        const c1 = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.04, fh - 0.04), cloth); c1.position.set(fw / 2, fy0 + fh / 2, 0.04); arm.add(c1);
        const st = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.04, fh * 0.12), stripe); st.position.set(fw / 2, fy0 + fh * 0.82, 0.045); arm.add(st);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glossy(theme.accent)); tip.position.y = L; arm.add(tip);
        arm.rotation.z = k * Math.PI / 2; sails.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 14), wood); hub.rotation.x = Math.PI / 2; sails.add(hub);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), glossy(theme.accent)); cap.position.z = 0.12; sails.add(cap);
    return sails;
}

/**
 * The windmill round its door: the walls (the hole's blocks, drawn by block()),
 * an arch and lintel over the door, a tower and roof on top (a cabin roof on a
 * ship), and the sails turning in front of the door.
 */
export function windmill(m, base, theme, blocks) {
    const g = new THREE.Group();
    const w = m.w || 0.55;
    // The building: the union of the mill's blocks.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, H = 0.8;
    blocks.forEach(([a, b, c, d, h]) => { x0 = Math.min(x0, a, c); x1 = Math.max(x1, a, c); z0 = Math.min(z0, b, d); z1 = Math.max(z1, b, d); H = Math.max(H, h ?? 0.5); });
    if (!blocks.length) { x0 = m.x - 0.6; x1 = m.x + 0.6; z0 = m.z - 2; z1 = m.z + 2; H = 1.2; }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongZ = m.axis === 'z';
    const thick = alongZ ? x1 - x0 : z1 - z0;
    const cabin = theme.scenery === 'pirate';
    // Over the door: an arch and the wall above it.
    const doorTop = 0.55 + w;
    const lintelH = Math.max(0.12, H - doorTop + 0.02);
    const lintel = rbox(alongZ ? thick : w * 2 + 0.1, lintelH, alongZ ? w * 2 + 0.1 : thick, 0.05, cabin ? mat(0x8b5a2b) : mat(0xc4553a, { roughness: 0.9 }));
    lintel.position.set(alongZ ? cx : m.x, base + H - lintelH / 2, alongZ ? m.z : cz); g.add(lintel);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(w, 0.09, 8, 18, Math.PI), glossy(cabin ? 0xd9a514 : 0xf2e6d4));
    arch.position.set(alongZ ? m.x - 0.02 : m.x, base + 0.55, alongZ ? m.z : m.z - 0.02);
    if (alongZ) arch.rotation.y = Math.PI / 2;
    g.add(arch);
    let hubY;
    if (cabin) {
        const roof = rbox((x1 - x0) + 0.3, 0.16, (z1 - z0) + 0.3, 0.08, mat(0x5a3a1e)); roof.position.set(cx, base + H + 0.08, cz); g.add(roof);
        hubY = base + H + 0.75;
        const mast = rbox(0.14, 1.0, 0.14, 0.05, mat(0x5a3a1e)); mast.position.set(m.x, base + H + 0.5, alongZ ? m.z : m.z + 0.05); g.add(mast);
    } else {
        // A white tower, tapering, with brick bands, a window and a cap.
        const R0 = Math.min(1.0, Math.max(thick, 1.2) * 0.75), towerH = 1.9;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(R0 * 0.78, R0, towerH, 8), mat(0xf3ead8, { roughness: 0.85 }));
        tower.position.set(cx, base + H + towerH / 2, cz); g.add(tower);
        [0.35, 0.72].forEach(k => {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(R0 * (1 - k * 0.22) + 0.02, R0 * (1 - k * 0.22) + 0.03, 0.09, 8), mat(0xc4553a));
            band.position.set(cx, base + H + towerH * k, cz); g.add(band);
        });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(R0 * 0.95, 1.1, 8), glossy(0x8a2e1d));
        roof.position.set(cx, base + H + towerH + 0.55, cz); g.add(roof);
        const fin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), glossy(0xffd23f)); fin.position.set(cx, base + H + towerH + 1.15, cz); g.add(fin);
        const win = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), new THREE.MeshStandardMaterial({ color: 0x9fd0f0, emissive: 0x3b6e99, emissiveIntensity: 0.4 }));
        const fr = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 16), mat(0x7a4a24));
        const wx = alongZ ? cx - R0 * 0.83 : cx, wz = alongZ ? cz : cz - R0 * 0.83, wy = base + H + towerH * 0.55;
        [win, fr].forEach(o => { o.position.set(wx - (alongZ ? 0.01 : 0), wy, wz - (alongZ ? 0 : 0.01)); o.rotation.y = alongZ ? -Math.PI / 2 : Math.PI; g.add(o); });
        hubY = base + H + 0.95;
    }
    // The sails, on the side the ball comes from, sweeping down past the door.
    const L = hubY - base - 0.3;
    const sails = _sails(L, theme);
    const holder = new THREE.Group(); holder.add(sails);
    const front = (alongZ ? x0 : z0) - 0.2;
    if (alongZ) { holder.position.set(Math.min(front, m.x - 0.2), hubY, m.z); holder.rotation.y = -Math.PI / 2; }
    else { holder.position.set(m.x, hubY, Math.min(front, m.z - 0.2)); holder.rotation.y = Math.PI; }
    g.add(holder);
    // A lamp strip across the door floor: lit while a sail is down.
    const gate = rbox(alongZ ? 0.12 : w * 2, 0.03, alongZ ? w * 2 : 0.12, 0.03, glow(0xffd23f, 1));
    gate.position.set(m.x, base + 0.02, m.z); g.add(gate);
    return { g: shadowed(g), sails, gate };
}

/** A blast door that drops shut in time with the physics' door, with a lamp. */
export function airlock(m, base, theme) {
    const g = new THREE.Group();
    const w = (m.w || 0.55) * 2, alongZ = m.axis === 'z';
    const hz = new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.45, emissive: 0x332200, emissiveIntensity: 0.3 });
    const door = new THREE.Group();
    const slab = rbox(alongZ ? 0.22 : w - 0.04, 1.05, alongZ ? w - 0.04 : 0.22, 0.06, mat(0xd1d5db, { metalness: 0.55, roughness: 0.3 }));
    door.add(slab);
    const band = rbox(alongZ ? 0.24 : w - 0.02, 0.22, alongZ ? w - 0.02 : 0.24, 0.05, hz); band.position.y = -0.36; door.add(band);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), glow(theme.rail, 0.8));
    win.position.set(alongZ ? -0.12 : 0, 0.22, alongZ ? 0 : -0.12); win.rotation.y = alongZ ? -Math.PI / 2 : Math.PI; door.add(win);
    door.position.set(m.x, base + 0.55, m.z); g.add(door);
    // The frame round the opening, lit.
    const fm = glow(theme.rail, 0.7);
    const top = rbox(alongZ ? 0.3 : w + 0.2, 0.1, alongZ ? w + 0.2 : 0.3, 0.04, fm); top.position.set(m.x, base + 1.15, m.z); g.add(top);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    lamp.position.set(m.x, base + 1.32, m.z); g.add(lamp);
    return { g: shadowed(g), door, lamp };
}

// ── Pipes, cannons, teleporters ──────────────────────────────────────────────
/** One end of a pipe: `end` 'a' (it swallows the ball) or 'b' (it comes out). */
export function pipeEnd(p, end, y, theme) {
    const g = new THREE.Group();
    const q = end === 'a' ? p.a : p.b, r = p.r;
    if (p.style === 'burrow') {
        // A rabbit hole: a ring of earth round a dark throat, a tuft of grass.
        const mound = new THREE.Mesh(new THREE.TorusGeometry(r + 0.08, 0.12, 8, 22), mat(0x7a5232, { roughness: 1 }));
        mound.rotation.x = Math.PI / 2; mound.position.y = 0.03; mound.scale.z = 0.6; g.add(mound);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 22), new THREE.MeshBasicMaterial({ color: 0x0b0704 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.012; g.add(hole);
        const grass = mat(0x3fa548, { roughness: 1 });
        for (let i = 0; i < 5; i++) { const bl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 4), grass); const a = i * 1.3 + 0.4; bl.position.set(Math.cos(a) * (r + 0.2), 0.1, Math.sin(a) * (r + 0.2)); bl.rotation.z = Math.sin(a) * 0.3; g.add(bl); }
        g.position.set(q[0], y, q[1]);
        return shadowed(g);
    }
    if (theme.scenery === 'space' || p.style === 'teleport') {
        // A teleport pad: a hex plate, a lit ring and a beam of light.
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.25, r + 0.3, 0.08, 6), mat(0x4b5563, { metalness: 0.6, roughness: 0.3 }));
        plate.position.y = 0.04; g.add(plate);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.05, 8, 28), glow((p.color ?? theme.pipe) ?? 0xa855f7, 1.2)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; g.add(ring);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: (p.color ?? theme.pipe) ?? 0xa855f7, transparent: true, opacity: 0.55 }));
        disc.rotation.x = -Math.PI / 2; disc.position.y = 0.085; g.add(disc);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r, 1.6, 20, 1, true),
            new THREE.MeshBasicMaterial({ color: (p.color ?? theme.pipe) ?? 0xa855f7, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
        beam.position.y = 0.9; g.add(beam);
        g.userData.pulse = { disc, beam, ring };
    } else if (theme.scenery === 'pirate' && end === 'b') {
        // Where the cannon drops you: a bullseye.
        [[r + 0.3, 0xffffff], [r + 0.15, 0xd62828], [r, 0xffffff], [r * 0.55, 0xd62828]].forEach(([rad, col], i) => {
            const d = new THREE.Mesh(new THREE.CircleGeometry(rad, 28), mat(col, { roughness: 0.6 }));
            d.rotation.x = -Math.PI / 2; d.position.y = 0.006 + i * 0.002; g.add(d);
        });
    } else if (theme.scenery === 'pirate') {
        // The cannon itself is a prop; the mouth on the deck is a dark hole in a brass ring.
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.07, 8, 24), glossy(p.color ?? 0xd9a514, { metalness: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; g.add(ring);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 22), new THREE.MeshBasicMaterial({ color: 0x050505 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.01; g.add(hole);
    } else {
        // A garden hose: a fat rubber ring, a dark throat, a brass coupling.
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.07, 0.11, 10, 26), glossy((p.color ?? theme.pipe) ?? 0x2e9e57)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring);
        const brass = new THREE.Mesh(new THREE.TorusGeometry(r + 0.07, 0.04, 6, 26), glossy(0xd9a514, { metalness: 0.7 })); brass.rotation.x = Math.PI / 2; brass.position.y = 0.17; g.add(brass);
        const throat = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 22, 1, true), new THREE.MeshBasicMaterial({ color: 0x07110a, side: THREE.BackSide }));
        throat.position.y = -0.1; g.add(throat);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 22), new THREE.MeshBasicMaterial({ color: 0x050a06 })); hole.rotation.x = -Math.PI / 2; hole.position.y = -0.2; g.add(hole);
        if (end === 'b') { const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), glow(0xffd23f, 0.6)); arrow.rotation.z = -Math.PI / 2; arrow.rotation.y = -Math.atan2(p.dir[1], p.dir[0]); arrow.position.set(p.dir[0] * (r + 0.35), 0.03, p.dir[1] * (r + 0.35)); arrow.rotation.order = 'YZX'; g.add(arrow); }
    }
    g.position.set(q[0], y, q[1]);
    return shadowed(g);
}

/** A proper cannon: a turned iron barrel with rings, on a wheeled carriage. */
export function cannon() {
    const g = new THREE.Group();
    const iron = mat(0x2b2b30, { metalness: 0.65, roughness: 0.35 });
    const prof = [[0, 0], [0.2, 0], [0.24, 0.05], [0.22, 0.12], [0.2, 0.7], [0.17, 1.15], [0.2, 1.2], [0.21, 1.32], [0.16, 1.34], [0.13, 1.34]].map(([r, y]) => new THREE.Vector2(r, y));
    const barrel = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), iron);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), iron); ball.position.y = -0.06;
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ color: 0x050505 })); mouth.rotation.x = -Math.PI / 2; mouth.position.y = 1.33;
    const b = new THREE.Group(); b.add(barrel, ball, mouth);
    const tip = new THREE.Object3D(); tip.position.y = 1.36; b.add(tip);
    b.rotation.z = -Math.PI / 2 + 0.4; b.position.set(0.25, 0.55, 0);
    g.add(b);
    // For the firing: the barrel kicks back, the ball leaves from the tip.
    g.userData.barrel = b; g.userData.barrelX = b.position.x; g.userData.recoil = 0;
    g.userData.muzzle = () => { g.updateMatrixWorld(true); return tip.getWorldPosition(new THREE.Vector3()); };
    const cart = rbox(1.0, 0.32, 0.62, 0.06, mat(0x7a4a1e)); cart.position.set(0.55, 0.3, 0); g.add(cart);
    [-0.36, 0.36].forEach(z => [0.2, 0.9].forEach(x => {
        const wheel = new THREE.Group();
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16), mat(0x3b2412)); wheel.add(rim);
        for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.03), mat(0x5a3a1e)); sp.rotation.z = k * Math.PI / 3; wheel.add(sp); }
        wheel.position.set(x, 0.2, z); g.add(wheel);
    }));
    return shadowed(g);
}

// ── Loops ────────────────────────────────────────────────────────────────────
export function loop(l, y, theme) {
    const g = new THREE.Group();
    const n = Math.hypot(l.dir[0], l.dir[1]) || 1, ux = l.dir[0] / n, uz = l.dir[1] / n;
    const rad = l.rad ?? 0.9 + R;
    if (theme.scenery === 'candy' && l.track) {
        // A real loop-the-loop: a wafer deck with candy-cane rails, in flat along the floor, up round
        // the hoop (offset sideways a little, so it clears itself — the path the ball's drawn on) and
        // out the far side, standing on a pair of iced donuts.
        const N = 120, deck = [], rails = [[], []], W = 0.34, L = l.len;
        const at = (u, off, lift) => {
            // u 0..1 along the track; off = sideways; lift = out from the ball's centre line.
            let along, h, side = 0, nx = 0, ny = 1;
            if (u < 0.2) { along = -L / 2 + L / 2 * (u / 0.2); h = 0; }
            else if (u > 0.8) { along = L / 2 * ((u - 0.8) / 0.2); h = 0; }
            else { const th = (u - 0.2) / 0.6 * Math.PI * 2; along = Math.sin(th) * rad; h = rad * (1 - Math.cos(th)); side = (th / (Math.PI * 2) - 0.5) * 0.36; nx = -Math.sin(th); ny = Math.cos(th); }
            // The track surface sits a ball's radius below the ball's centre, along the normal.
            return new THREE.Vector3(along - nx * (R + lift), h - ny * (R + lift) + R - rad, side + off);
        };
        for (let i = 0; i <= N; i++) { const u = i / N; deck.push(at(u, -W, -0.03), at(u, W, -0.03)); rails[0].push(at(u, -W, -0.12)); rails[1].push(at(u, W, -0.12)); }
        const pos = [], idx = [];
        deck.forEach(v => pos.push(v.x, v.y, v.z));
        for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setIndex(idx); dg.computeVertexNormals();
        const wafer = glossy(0xf2c27a, { roughness: 0.55, side: THREE.DoubleSide });
        g.add(new THREE.Mesh(dg, wafer));
        const t = caneTex().clone(); t.needsUpdate = true; t.repeat.set(60, 1);
        const cane = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 });
        rails.forEach(pts => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.07, 8, false), cane)));
        // Ties under the deck every so often, in icing pink.
        const tie = glossy(0xff8ac4, { roughness: 0.3 });
        for (let i = 2; i < N; i += 4) { const a = at(i / N, -W - 0.04, 0.07), b2 = at(i / N, W + 0.04, 0.07), m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, a.distanceTo(b2)), tie); m.position.copy(a).lerp(b2, 0.5); m.lookAt(b2); g.add(m); }
        // Two big iced donuts the hoop stands on, with sprinkles.
        const cols = [0xffffff, 0xffd23f, 0x5fb8ff, 0x7ed957, 0xe8243c];
        [-1, 1].forEach(sd => {
            const d = new THREE.Group(), dr = rad * 0.42;
            d.add(new THREE.Mesh(new THREE.TorusGeometry(dr, dr * 0.45, 14, 32), glossy(0xc98b4a, { roughness: 0.6 })));
            const ic = new THREE.Mesh(new THREE.TorusGeometry(dr, dr * 0.47, 14, 32, Math.PI), glossy(sd < 0 ? 0xff8ac4 : 0x8a5cf6, { roughness: 0.25 })); d.add(ic);
            for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI, sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.13), mat(cols[i % 5])); sp.position.set(Math.cos(a) * dr, Math.sin(a) * dr + dr * 0.47, (i % 3 - 1) * dr * 0.25); sp.rotation.set(i, i * 1.3, 0); d.add(sp); }
            d.position.set(0, -rad + R + dr + dr * 0.45 - 0.05, sd * (W + dr * 0.5 + 0.25)); g.add(d);
        });
        g.position.set(l.a[0] + ux * l.len / 2, y + rad, l.a[1] + uz * l.len / 2);
        g.rotation.y = -Math.atan2(uz, ux);
        return shadowed(g);
    }
    if (theme.scenery === 'candy') {
        // A donut, iced, with sprinkles.
        const dough = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.3, 14, 40), glossy(0xc98b4a, { roughness: 0.6 })); g.add(dough);
        const icing = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.31, 14, 40, Math.PI * 1.2), glossy(0xff8ac4, { roughness: 0.25 }));
        icing.rotation.z = -0.1 * Math.PI; icing.scale.z = 1.04; g.add(icing);
        const cols = [0xffffff, 0xffd23f, 0x5fb8ff, 0x7ed957, 0xe8243c];
        for (let i = 0; i < 46; i++) {
            const a = -0.1 * Math.PI + (i / 46) * Math.PI * 1.2, b = (i * 2.4) % (Math.PI * 2);
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.12), mat(cols[i % 5]));
            s.position.set(Math.cos(a) * (rad + Math.cos(b) * 0.32), Math.sin(a) * (rad + Math.cos(b) * 0.32), Math.sin(b) * 0.32); s.rotation.set(i, i * 1.3, 0); g.add(s);
        }
    } else {
        // Two rails round a hoop, with ties across them and legs to stand on.
        const rm = theme.railGlow ? glow(theme.loop ?? theme.rail, 0.9) : glossy(theme.loop ?? theme.accent, { metalness: 0.3 });
        [-0.24, 0.24].forEach(o => { const hoop = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.06, 8, 48), rm); hoop.position.z = o; g.add(hoop); });
        const tie = theme.railGlow ? mat(0x4b5563, { metalness: 0.6 }) : mat(0xf8f5ee);
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.52), tie); t.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0); g.add(t); }
        [-1, 1].forEach(sd => { const leg = rbox(0.1, rad + 0.1, 0.1, 0.04, tie); leg.position.set(sd * (rad + 0.05), -(rad - 0.05) / 2 + 0.1, 0); g.add(leg); });
    }
    g.position.set(l.a[0] + ux * l.len / 2, y + rad, l.a[1] + uz * l.len / 2);
    g.rotation.y = -Math.atan2(uz, ux);
    return shadowed(g);
}

// ── Sweepers and sliders ─────────────────────────────────────────────────────
export function sweeper(m, theme) {
    const g = new THREE.Group(), L = (m.len || 2);
    if (m.r0) {
        // A spinner: a ring of baffles round an open middle (the cup sits there).
        const n = m.arms || 6, cols = [0xff5fa2, 0xffffff, 0x7ed957, 0xffd23f, 0x5fb8ff, 0xb57bff];
        for (let k = 0; k < n; k++) {
            const s = k / n * Math.PI * 2, arm = new THREE.Group();
            const len = L - m.r0;
            const t = caneTex().clone(); t.needsUpdate = true; t.repeat.set(3, 1);
            const bar = rbox(len, 0.34, 0.14, 0.07, theme.scenery === 'candy' ? glossy(0xffffff, { map: t }) : (theme.railGlow ? glow(theme.sweeper ?? 0xf43f5e, 0.8) : glossy(theme.sweeper ?? 0xffd23f)));
            bar.position.set(m.r0 + len / 2, 0.17, 0); arm.add(bar);
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), glossy(cols[k % cols.length])); knob.position.set(L, 0.3, 0); arm.add(knob);
            arm.rotation.y = -s; g.add(arm);
        }
        const ring = new THREE.Mesh(new THREE.TorusGeometry(m.r0 - 0.08, 0.04, 6, 40), glossy(theme.accent ?? 0xff3b6b));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
        return { g: shadowed(g), bar: null };
    }
    const col = theme.sweeper ?? 0xffd23f, n = m.arms || 2;
    // One arm per spoke the physics has (not just a single bar).
    let bar = null;
    for (let k = 0; k < n; k++) {
        const arm = new THREE.Group(), b = rbox(L, 0.22, 0.2, 0.1, theme.railGlow ? glow(col, 0.8) : glossy(col));
        b.position.set(L / 2, 0.16, 0); arm.add(b); bar = bar || b;
        const end = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), glossy(theme.accent)); end.position.set(L, 0.16, 0); arm.add(end);
        arm.rotation.y = -k / n * Math.PI * 2; g.add(arm);
    }
    if (m.rim) {
        // The rim's arcs, matching the physics.
        const half = Math.PI / n * (1 - (m.rimGap ?? 0.45));
        for (let k = 0; k < n; k++) {
            const arc = new THREE.Mesh(new THREE.TorusGeometry(m.rim, 0.14, 8, 20, 2 * half), glossy(theme.rim ?? 0x4a2410));
            arc.rotation.x = -Math.PI / 2; arc.rotation.z = -(k / n * Math.PI * 2 + half); arc.position.y = 0.22; g.add(arc);
            // A brass knob where each spoke meets the rim, like a ship's wheel.
            const a = k / n * Math.PI * 2, hd = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 10), glossy(0xd4a017));
            hd.position.set(Math.cos(a) * m.rim, 0.42, -Math.sin(a) * m.rim); g.add(hd);
        }
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.4, 18), glossy(theme.accent)); hub.position.y = 0.2; g.add(hub);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy(0xffffff)); dome.position.y = 0.4; g.add(dome);
    return { g: shadowed(g), bar };
}
export function slider(m, theme) {
    const L = m.len || 1.6, alongX = (m.bar || 'z') === 'x';
    const g = new THREE.Group();
    const col = theme.slider ?? 0x7c4dff;
    if (theme.scenery === 'pirate') {
        // A tentacle across the lane, with suckers.
        const t = rbox(alongX ? L : 0.3, 0.36, alongX ? 0.3 : L, 0.15, glossy(col)); t.position.y = 0.18; g.add(t);
        const suck = mat(0xf0c6f5);
        for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), suck); const u = (i + 0.5) / 6 - 0.5; s.position.set(alongX ? u * L : -0.16, 0.2, alongX ? -0.16 : u * L); g.add(s); }
    } else if (theme.railGlow) {
        // A laser fence: two emitters and a beam between them.
        const beam = new THREE.Mesh(new THREE.BoxGeometry(alongX ? L : 0.08, 0.08, alongX ? 0.08 : L), glow(col, 1.4)); beam.position.y = 0.2; g.add(beam);
        const haze = new THREE.Mesh(new THREE.BoxGeometry(alongX ? L : 0.3, 0.3, alongX ? 0.3 : L), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false })); haze.position.y = 0.2; g.add(haze);
        [-1, 1].forEach(sd => { const em = rbox(0.24, 0.42, 0.24, 0.08, mat(0x4b5563, { metalness: 0.6 })); em.position.set(alongX ? sd * L / 2 : 0, 0.21, alongX ? 0 : sd * L / 2); g.add(em); });
    } else {
        const b = rbox(alongX ? L : 0.3, 0.4, alongX ? 0.3 : L, 0.12, glossy(col)); b.position.y = 0.2; g.add(b);
        const stripe = rbox(alongX ? L + 0.01 : 0.31, 0.08, alongX ? 0.31 : L + 0.01, 0.04, glossy(0xffffff)); stripe.position.y = 0.26; g.add(stripe);
    }
    return shadowed(g);
}

/**
 * The edges a ball can fall off into nothing (no rail, no floor below): a
 * warning strip along each, so a drop is seen before it's putted at.
 */
export function dropEdges(c, theme) {
    const g = new THREE.Group();
    const m = theme.railGlow ? glow(0xff3b3b, 1.2) : new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.5 });
    c.tiles.forEach(t => {
        if (!t.open || t.kind === 'water' || t.kind === 'goo' || t.kind === 'flowers' || t.kind === 'lava') return;
        const edges = { n: [t.x0, t.z0, t.x1, t.z0, 0, -1], s: [t.x0, t.z1, t.x1, t.z1, 0, 1], w: [t.x0, t.z0, t.x0, t.z1, -1, 0], e: [t.x1, t.z0, t.x1, t.z1, 1, 0] };
        for (const side of t.open) {
            const [ax, az, bx, bz, nx, nz] = edges[side] || [];
            if (ax == null) continue;
            const mx = (ax + bx) / 2 + nx * 0.3, mz = (az + bz) / 2 + nz * 0.3;
            // Only where there's nothing under the edge at all.
            if (c.tiles.some(o => o !== t && mx >= o.x0 && mx <= o.x1 && mz >= o.z0 && mz <= o.z1)) continue;
            const len = Math.hypot(bx - ax, bz - az);
            const strip = rbox(nx ? 0.1 : len, 0.03, nx ? len : 0.1, 0.03, m);
            strip.position.set((ax + bx) / 2 - nx * 0.05, t.y + t.gx * ((ax + bx) / 2 - t.cx) + t.gz * ((az + bz) / 2 - t.cz) + 0.015, (az + bz) / 2 - nz * 0.05);
            g.add(strip);
        }
    });
    g.userData.blinkStrip = !!theme.railGlow;
    return g;
}

// ── v3 pieces ────────────────────────────────────────────────────────────────

/** A mine: a powder keg (pirate), a spiked space mine, or a red garden mine. */
export function mine(kind, theme) {
    const g = new THREE.Group();
    let light;
    if (kind === 'keg') {
        const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 14), mat(0x7a4a22, { roughness: 0.8 }));
        keg.position.y = 0.18; g.add(keg);
        [0.06, 0.3].forEach(y => { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.02, 6, 18), mat(0x2b2b30, { metalness: 0.6 })); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; g.add(hoop); });
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5), mat(0xf2e8d0)); fuse.position.set(0.06, 0.42, 0); fuse.rotation.z = -0.4; g.add(fuse);
        light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glow(0xffa53f, 1.6)); light.position.set(0.1, 0.5, 0); g.add(light);
        const xx = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
        xx.position.set(0, 0.2, 0.205); g.add(xx);
    } else {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), kind === 'spike' ? mat(0x374151, { metalness: 0.6, roughness: 0.35 }) : glossy(0xd62828));
        core.position.y = 0.2; g.add(core);
        const spikeM = kind === 'spike' ? mat(0x9aa3b5, { metalness: 0.7 }) : glossy(0x1f1f24);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), spikeM); sp.position.set(Math.cos(a) * 0.22, 0.2, Math.sin(a) * 0.22); sp.rotation.z = -Math.PI / 2; sp.rotation.y = -a; sp.rotation.order = 'YZX'; g.add(sp); }
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), spikeM); top.position.y = 0.43; g.add(top);
        light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow(kind === 'spike' ? 0xf43f5e : 0xffd23f, 1.6)); light.position.y = 0.36; g.add(light);
    }
    return { g: shadowed(g), light };
}

/** A corkscrew slide from (a, yTop) spiralling down to (b, yBot): its centre line, and the slide. */
export function corkscrewCurve(l, yTop, yBot) {
    const [ax, az] = l.a, [bx, bz] = l.b, turns = l.turns || 1.75, rad = l.rad || 1.1;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const pts = [];
    const N = 80;
    for (let i = 0; i <= N; i++) {
        const u = i / N;
        // Out from the mouth, round the post `turns` times, in to the exit.
        const a0 = Math.atan2(az - cz, ax - cx), a1 = Math.atan2(bz - cz, bx - cx) + Math.PI * 2 * Math.round(turns);
        const ang = a0 + (a1 - a0) * u;
        const r = rad * (0.75 + 0.25 * Math.sin(u * Math.PI));
        const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        const e = u < 0.08 ? u / 0.08 : u > 0.92 ? (1 - u) / 0.08 : 1;
        const bx2 = u < 0.08 ? ax + (x - ax) * e : u > 0.92 ? bx + (x - bx) * e : x;
        const bz2 = u < 0.08 ? az + (z - az) * e : u > 0.92 ? bz + (z - bz) * e : z;
        pts.push(new THREE.Vector3(bx2, yTop + (yBot - yTop) * u + 0.16, bz2));
    }
    return new THREE.CatmullRomCurve3(pts);
}
export function corkscrew(curve, theme) {
    const g = new THREE.Group();
    // The chute: a half-pipe of candy cane (a full tube, cut open on top, reads as a slide).
    const t = caneTex().clone(); t.needsUpdate = true; t.repeat.set(24, 1); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.3, 10, false), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    g.add(tube);
    // A centre post, and a lollipop on top.
    const pts = curve.getPoints(40);
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
    const top = Math.max(...pts.map(p => p.y)), bot = Math.min(...pts.map(p => p.y));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, top - bot + 1.2, 12), glossy(0xffffff, { map: (() => { const tt = caneTex().clone(); tt.needsUpdate = true; tt.repeat.set(1, 6); return tt; })() }));
    post.position.set(cx, (top + bot) / 2 + 0.3, cz); g.add(post);
    const pop = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 26), glossy(theme.accent ?? 0xff3b6b));
    pop.rotation.x = Math.PI / 2; pop.position.set(cx, top + 1.2, cz); g.add(pop);
    return shadowed(g);
}

/** A kicker ramp's face: hazard chevrons up the slope and a lip at the top. */
export function kickerLip(t, theme) {
    const g = new THREE.Group();
    const alongX = Math.abs(t.gx) > Math.abs(t.gz), s = alongX ? Math.sign(t.gx) : Math.sign(t.gz);
    const w = alongX ? t.z1 - t.z0 : t.x1 - t.x0;
    const lip = rbox(alongX ? 0.12 : w, 0.07, alongX ? w : 0.12, 0.03, glossy(theme.kick ?? theme.accent ?? 0xff7a59));
    const x = alongX ? (s > 0 ? t.x1 : t.x0) : t.cx, z = alongX ? t.cz : (s > 0 ? t.z1 : t.z0);
    lip.position.set(x - (alongX ? s * 0.06 : 0), 0, z - (alongX ? 0 : s * 0.06));
    g.add(lip);
    return { g: shadowed(g), at: [x, z] };
}
