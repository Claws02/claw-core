// ============================================================
// GOLF FX — the atmosphere round a hole, and the cheap particles that make a
// hit feel like one. One per hole: make() it when the hole is built, update()
// it every frame, dispose() it with the hole.
//
//   sparks(at, color, n, speed, up)   a spray of particles (a rail hit, a blast,
//                                     a splash), from one pooled Points cloud
//   reading(ball | null)              while a putt is being aimed: dots on the
//                                     floor round the ball, drifting downhill —
//                                     how the green breaks, at a glance
//   update(dt, t)                     embers off lava, glints on water, the
//                                     ambient life (butterflies, gulls, floating
//                                     sprinkles, shooting stars), the reading dots
//
// Quality: the stage already steps its resolution down when frames run long
// (stage.quality.drops). After two drops the ambient life goes and the spray
// halves; after three the shadows go too. It never comes back up mid-round.
// ============================================================
import { floorAt, HAZARD } from './Physics.js';

const POOL = 360;

export function make(stage, c, theme, opts = {}) {
    if (!stage?.gl) return null;
    const group = new THREE.Group();
    stage.add(group);
    const scenery = theme.scenery;

    // ── the spark pool ──
    const pos = new Float32Array(POOL * 3), col = new Float32Array(POOL * 3);
    const vel = new Float32Array(POOL * 3), life = new Float32Array(POOL), age = new Float32Array(POOL);
    const grav = new Float32Array(POOL);
    for (let i = 0; i < POOL; i++) { pos[i * 3 + 1] = -99; life[i] = 0; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.95,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    pts.frustumCulled = false;
    group.add(pts);
    let next = 0, scale = 1;
    const tmp = new THREE.Color();
    const emit = (x, y, z, vx, vy, vz, color, l, g = 9) => {
        const i = next; next = (next + 1) % POOL;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
        tmp.set(color); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
        life[i] = l; age[i] = 0; grav[i] = g;
    };

    // ── lava embers and water glints: where they come from ──
    const lava = c.tiles.filter(t => t.kind === 'lava');
    const water = c.tiles.filter(t => (HAZARD[t.kind] && t.kind !== 'lava' && t.kind !== 'flowers') || t.kind === 'creek');
    let emberT = 0, glintT = 0;

    // ── ambient life ──
    const B = c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, span = Math.max(B.x1 - B.x0, B.z1 - B.z0) / 2 + 3;
    const critters = [];
    const flap = (color, size) => {
        // Two wings on a hinge: a butterfly, or (bigger, white) a gull.
        const g = new THREE.Group();
        const wm = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        const wl = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.6), wm); wl.position.x = -size / 2;
        const wr = wl.clone(); wr.position.x = size / 2;
        const L = new THREE.Group(); L.add(wl); const Rg = new THREE.Group(); Rg.add(wr);
        g.add(L); g.add(Rg);
        g.userData = { L, Rg };
        return g;
    };
    if (scenery === 'backyard') {
        const cols = [0xffd23f, 0xff7ab8, 0x8be0ff, 0xffffff];
        for (let i = 0; i < 5; i++) { const b = flap(cols[i % 4], 0.22); group.add(b); critters.push({ o: b, kind: 'fly', ph: i * 1.7, r: 2 + i * 0.9, h: 0.8 + (i % 3) * 0.35, cx: cx + Math.sin(i * 2.3) * span * 0.5, cz: cz + Math.cos(i * 1.9) * span * 0.5, sp: 0.5 + i * 0.07 }); }
    } else if (scenery === 'pirate') {
        for (let i = 0; i < 3; i++) { const b = flap(0xffffff, 0.55); group.add(b); critters.push({ o: b, kind: 'gull', ph: i * 2.1, r: span * (0.6 + i * 0.2), h: 6 + i * 1.5, cx, cz, sp: 0.25 + i * 0.05 }); }
    } else if (scenery === 'candy') {
        const cols = [0xff5fa2, 0xffd23f, 0x5fb8ff, 0x7ed957, 0xffffff];
        for (let i = 0; i < 14; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), new THREE.MeshBasicMaterial({ color: cols[i % 5] }));
            group.add(m); critters.push({ o: m, kind: 'sprinkle', ph: i * 0.77, x: cx + (Math.sin(i * 12.9) * 0.5) * span * 1.6, z: cz + (Math.cos(i * 7.3) * 0.5) * span * 1.6, h: (i % 7) * 0.6 });
        }
    } else if (scenery === 'space') {
        for (let i = 0; i < 2; i++) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 4, 6), new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0 }));
            group.add(m); critters.push({ o: m, kind: 'star', ph: i * 3.7, next: 2 + i * 4 });
        }
    }

    // ── reading dots ──
    const RN = 70;
    const rpos = new Float32Array(RN * 3), rseed = new Float32Array(RN * 2);
    for (let i = 0; i < RN; i++) { rseed[i * 2] = Math.random() * Math.PI * 2; rseed[i * 2 + 1] = Math.sqrt(Math.random()); rpos[i * 3 + 1] = -99; }
    const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    const rdots = new THREE.Points(rgeo, new THREE.PointsMaterial({ size: 0.075, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    rdots.frustumCulled = false; group.add(rdots);
    let readBall = null, readK = 0;
    const rage = new Float32Array(RN);
    for (let i = 0; i < RN; i++) rage[i] = Math.random();

    // ── quality ──
    let tier = 2;
    const checkQuality = () => {
        const d = stage.quality?.drops || 0;
        const want = d >= 3 ? 0 : d >= 2 ? 1 : 2;
        if (want >= tier) return;
        tier = want;
        if (tier <= 1) { critters.forEach(k => { k.o.visible = false; }); scale = 0.5; }
        if (tier === 0 && stage.renderer) { stage.renderer.shadowMap.enabled = false; stage.scene.traverse(o => { if (o.isLight) o.castShadow = false; }); }
    };

    const api = {
        get tier() { return tier; },
        sparks(at, color = 0xfff1a8, n = 10, speed = 3, up = 1.5, g = 9) {
            const k = Math.max(1, Math.round(n * scale));
            for (let i = 0; i < k; i++) {
                const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
                emit(at.x, at.y, at.z, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, color, 0.35 + Math.random() * 0.4, g);
            }
        },
        reading(b) { readBall = b; },
        update(dt, t) {
            checkQuality();
            // Particles.
            for (let i = 0; i < POOL; i++) {
                if (life[i] <= 0) continue;
                age[i] += dt;
                if (age[i] >= life[i]) { life[i] = 0; pos[i * 3 + 1] = -99; continue; }
                vel[i * 3 + 1] -= grav[i] * dt;
                pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
                const fade = 1 - age[i] / life[i];
                col[i * 3] *= 0.985 + 0.015 * fade; col[i * 3 + 1] *= 0.97 + 0.03 * fade; col[i * 3 + 2] *= 0.96 + 0.04 * fade;
            }
            geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
            // Embers off the lava, glints on the water.
            if (tier > 0) {
                emberT -= dt;
                if (lava.length && emberT <= 0) {
                    emberT = 0.07 / scale;
                    const L = lava[Math.floor(Math.random() * lava.length)];
                    emit(L.x0 + Math.random() * (L.x1 - L.x0), L.y + 0.05, L.z0 + Math.random() * (L.z1 - L.z0), (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * 0.3, Math.random() < 0.5 ? 0xffb347 : 0xff5a1f, 1.2 + Math.random(), -0.2);
                }
                glintT -= dt;
                if (water.length && glintT <= 0) {
                    glintT = 0.12 / scale;
                    const W = water[Math.floor(Math.random() * water.length)];
                    emit(W.x0 + Math.random() * (W.x1 - W.x0), W.y + 0.06, W.z0 + Math.random() * (W.z1 - W.z0), 0, 0.05, 0, scenery === 'candy' ? 0xd9a56b : 0xffffff, 0.5, 0);
                }
            }
            // Ambient life.
            if (tier >= 2) critters.forEach(k => {
                const o = k.o;
                if (k.kind === 'fly' || k.kind === 'gull') {
                    const a = t * k.sp + k.ph;
                    o.position.set(k.cx + Math.cos(a) * k.r, k.h + Math.sin(a * 2.3) * (k.kind === 'fly' ? 0.25 : 0.6), k.cz + Math.sin(a) * k.r);
                    o.rotation.y = -a - Math.PI / 2;
                    const f = Math.sin(t * (k.kind === 'fly' ? 18 : 5) + k.ph) * (k.kind === 'fly' ? 0.9 : 0.5);
                    o.userData.L.rotation.z = f; o.userData.Rg.rotation.z = -f;
                } else if (k.kind === 'sprinkle') {
                    const u = ((t * 0.15 + k.ph) % 1);
                    o.position.set(k.x + Math.sin(t * 0.7 + k.ph) * 0.6, 0.5 + u * 5, k.z + Math.cos(t * 0.5 + k.ph) * 0.6);
                    o.rotation.set(t * 1.3 + k.ph, t + k.ph, 0);
                } else if (k.kind === 'star') {
                    k.next -= dt;
                    if (k.next <= 0 && !k.run) { k.run = { u: 0, x: cx + (Math.random() - 0.5) * span * 3, z: cz - span * 2, h: 12 + Math.random() * 6 }; }
                    if (k.run) {
                        k.run.u += dt * 0.9;
                        const u = k.run.u;
                        o.position.set(k.run.x + u * 18, k.run.h - u * 6, k.run.z + u * 4);
                        o.rotation.z = 1.2;
                        o.material.opacity = Math.sin(Math.min(1, u) * Math.PI) * 0.9;
                        if (u >= 1) { k.run = null; k.next = 5 + Math.random() * 7; o.material.opacity = 0; }
                    }
                }
            });
            // Reading the green.
            readK += ((readBall ? 1 : 0) - readK) * Math.min(1, dt * 5);
            rdots.material.opacity = 0.75 * readK;
            if (readK > 0.02 && (readBall || rdots.userData.last)) {
                const b = readBall || rdots.userData.last; rdots.userData.last = b;
                for (let i = 0; i < RN; i++) {
                    rage[i] += dt * 0.35;
                    if (rage[i] > 1) rage[i] -= 1;
                    // Each dot starts at its spot round the ball and drifts downhill for a while.
                    const a = rseed[i * 2], r = 0.4 + rseed[i * 2 + 1] * 3.2;
                    let x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
                    let f = floorAt(c, x, z, b.y + 1.5, 1.5);
                    if (!f || HAZARD[f.kind]) { rpos[i * 3 + 1] = -99; continue; }
                    const g = Math.hypot(f.gx, f.gz);
                    if (g < 0.008) { rpos[i * 3] = x; rpos[i * 3 + 1] = f.h + 0.03; rpos[i * 3 + 2] = z; continue; }
                    const run = rage[i] * Math.min(0.9, g * 12);
                    x -= f.gx / g * run; z -= f.gz / g * run;
                    f = floorAt(c, x, z, b.y + 1.5, 1.5) || f;
                    rpos[i * 3] = x; rpos[i * 3 + 1] = f.h + 0.03; rpos[i * 3 + 2] = z;
                }
                rgeo.attributes.position.needsUpdate = true;
            }
        },
        dispose() {
            stage.scene.remove(group);
            group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        },
    };
    // Golden hour: the last holes of a round are lit low and warm.
    if (opts.golden && opts.lights && scenery !== 'space') {
        opts.lights.key.color.set(0xffc690); opts.lights.key.intensity *= 0.92;
        opts.lights.hemi.color.set(0xffe2c4);
    }
    return api;
}
