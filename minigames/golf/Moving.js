// ============================================================
// GOLF MOVING — the parts of a hole that move or flow, drawn to match the
// physics frame by frame (Physics.tileOffset / liftState / gateDown /
// hammerHeads give the same positions the ball feels):
//
//   belts     conveyors and creeks: a surface that scrolls the way it pushes
//   turntable a spinning disc (the ship's wheel)
//   raft      a log raft riding to and fro
//   bridge    a drawbridge that swings up on its chains and comes down again
//   jelly     wobbling jelly pads that squash when a ball bounces off them
//   hammer    a swinging head: a Kraken's tentacle, or a mallet
//   gate      a portcullis dropping and lifting in a doorway
//   fan       a turbine with spinning blades and streaks of wind
//   magnet    a little planet over its pull, with rings sinking into it
//   seesaw    a board rocking on its fulcrum (Physics.tiltAt)
//   lift      a platform riding up and down on its pistons, rails and all (Physics.elevAt)
//   liftgate  a lift's door: bars that drop whenever the lift isn't level with it
//
// make(c, theme) → { group, update(dt, t), jelly(x, z) }
// ============================================================
import { tileHeight, tileOffset, liftState, gateDown, hammerHeads, floorAt, tiltAt, elevAt, liftGateShut } from './Physics.js';
import * as Toy from './Toys.js';

const glow = (color, k = 0.9) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3 });

function _stripeTex(a, b, n = 4) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, 64, 64); x.fillStyle = b;
    for (let i = 0; i < n; i++) { x.beginPath(); x.moveTo(0, i * 64 / n); x.lineTo(32, i * 64 / n + 64 / n / 2); x.lineTo(64, i * 64 / n); x.lineTo(64, i * 64 / n + 64 / n / 3); x.lineTo(32, i * 64 / n + 64 / n * 0.83); x.lineTo(0, i * 64 / n + 64 / n / 3); x.fill(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}
function _waterTex(a, b) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, 64, 64); x.strokeStyle = b; x.lineWidth = 3;
    for (let i = 0; i < 6; i++) { x.beginPath(); for (let k = 0; k <= 64; k += 4) x.lineTo(k, i * 11 + 4 + Math.sin(k / 8 + i) * 3); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}
// Molten chocolate: dark swirls with milk-chocolate ribbons and a glint of cream.
function _chocTex() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = '#4a2614'; x.fillRect(0, 0, 128, 128);
    const band = (col, w, n, amp, ph) => { x.strokeStyle = col; x.lineWidth = w; for (let i = 0; i < n; i++) { x.beginPath(); for (let k = -4; k <= 132; k += 4) x.lineTo(k, (i + 0.5) * 128 / n + Math.sin(k / 128 * Math.PI * 2 * 2 + i * 1.7 + ph) * amp); x.stroke(); } };
    band('#5e3219', 9, 4, 6, 0); band('#74401f', 4, 4, 7, 1.1); band('rgba(214,160,104,0.55)', 1.5, 6, 5, 2.3);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}
const hex = c => '#' + new THREE.Color(c).getHexString();

export function make(c, theme) {
    const group = new THREE.Group();
    const live = [];
    const jellies = [];

    c.tiles.forEach(t => {
        const w = t.x1 - t.x0, d = t.z1 - t.z0;
        // Conveyors and creeks: a scrolling surface laid just above the floor.
        if (t.flow && (t.kind === 'conveyor' || t.kind === 'creek')) {
            const belt = t.kind === 'conveyor';
            const choc = !belt && theme.creekStyle === 'choc';
            const tex = belt ? _stripeTex(hex(theme.conveyor ?? 0x374151), '#facc15') : choc ? _chocTex() : _waterTex(hex(theme.creek ?? 0x7a4a26), hex(new THREE.Color(theme.creek ?? 0x7a4a26).offsetHSL(0, 0, 0.12)));
            const along = Math.abs(t.flow[0]) > Math.abs(t.flow[1]) ? 'x' : 'z';
            tex.repeat.set(along === 'x' ? w / 1.5 : Math.max(1, Math.round(w)), along === 'x' ? Math.max(1, Math.round(d)) : d / 1.5);
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial(choc ? { map: tex, roughness: 0.12, metalness: 0.18 } : { map: tex, roughness: belt ? 0.5 : 0.25, metalness: belt ? 0.3 : 0.05, transparent: !belt, opacity: belt ? 1 : 0.92 }));
            m.rotation.x = -Math.PI / 2;
            if (along === 'x') m.rotation.z = 0; else tex.rotation = 0;
            m.position.set(t.cx, tileHeight(t, t.cx, t.cz) + 0.012, t.cz);
            m.receiveShadow = true; group.add(m);
            const sp = Math.hypot(t.flow[0], t.flow[1]) * (belt ? 1 : 0.8);
            const sgn = along === 'x' ? Math.sign(t.flow[0]) : Math.sign(t.flow[1]);
            live.push(dt => { if (along === 'x') tex.offset.x -= sgn * sp * dt / 1.5; else tex.offset.y += sgn * sp * dt / 1.5; });
            if (belt) {
                // Rollers at each end, turning.
                const rm = Toy.mat(0x9ca3af, { metalness: 0.7, roughness: 0.3 });
                const ends = along === 'x' ? [[t.x0, t.cz], [t.x1, t.cz]] : [[t.cx, t.z0], [t.cx, t.z1]];
                ends.forEach(([ex, ez]) => {
                    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, along === 'x' ? d : w, 12), rm);
                    if (along === 'x') r.rotation.x = Math.PI / 2; else r.rotation.z = Math.PI / 2;
                    r.position.set(ex, t.y - 0.02, ez); group.add(r);
                    live.push(dt => { if (along === 'x') r.rotation.y += sgn * sp * dt / 0.12; else r.rotation.x += sgn * sp * dt / 0.12; });
                });
                // Arrows painted on, pulsing the way it runs.
                for (let i = 0; i < 3; i++) {
                    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 3), glow(0xfacc15, 0.6));
                    arrow.rotation.x = -Math.PI / 2; arrow.rotation.z = Math.atan2(-t.flow[0], t.flow[1]) + Math.PI;
                    arrow.rotation.order = 'XZY';
                    arrow.position.set(along === 'x' ? t.x0 + w * (i + 0.5) / 3 : t.cx, t.y + 0.05, along === 'x' ? t.cz : t.z0 + d * (i + 0.5) / 3);
                    arrow.scale.set(1, 0.15, 1); group.add(arrow);
                    live.push((dt, tt) => { arrow.material.emissiveIntensity = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(tt * 6 - i * 1.4)); });
                }
            } else {
                // Foam flecks riding the current.
                for (let i = 0; i < 10; i++) {
                    const f = new THREE.Mesh(new THREE.CircleGeometry(0.08 + (i % 3) * 0.03, 8), new THREE.MeshBasicMaterial({ color: 0xf5e6d3, transparent: true, opacity: 0.7 }));
                    f.rotation.x = -Math.PI / 2; group.add(f);
                    const ph = i / 10, lane = (i * 0.37) % 1;
                    live.push((dt, tt) => {
                        const u = ((tt * sp / (along === 'x' ? w : d)) + ph) % 1;
                        f.position.set(along === 'x' ? t.x0 + w * (sgn > 0 ? u : 1 - u) : t.x0 + w * lane, t.y + 0.03, along === 'x' ? t.z0 + d * lane : t.z0 + d * (sgn > 0 ? u : 1 - u));
                    });
                }
            }
        }
        // A turntable: a disc that turns with the physics' spin.
        if (t.spin) {
            const disc = new THREE.Group();
            const top = new THREE.Mesh(new THREE.CylinderGeometry(t.discR, t.discR, 0.08, 48), Toy.mat(theme.wood ?? 0xa0673a, { roughness: 0.7 }));
            disc.add(top);
            const plankM = Toy.mat(new THREE.Color(theme.wood ?? 0xa0673a).multiplyScalar(0.8).getHex());
            for (let k = 0; k < 8; k++) {
                const sp = new THREE.Mesh(new THREE.BoxGeometry(t.discR * 2 - 0.2, 0.012, 0.06), plankM);
                sp.rotation.y = k / 8 * Math.PI; sp.position.y = 0.045; disc.add(sp);
            }
            const rim = new THREE.Mesh(new THREE.TorusGeometry(t.discR, 0.06, 8, 48), Toy.mat(theme.accent, { roughness: 0.35 }));
            rim.rotation.x = Math.PI / 2; rim.position.y = 0.03; disc.add(rim);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 20), Toy.mat(theme.accent, { roughness: 0.3, metalness: 0.4 }));
            hub.position.y = 0.06; disc.add(hub);
            // Handles round the rim: it's a ship's wheel laid flat.
            for (let k = 0; k < 8; k++) {
                const a = k / 8 * Math.PI * 2, hd = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.26, 8), Toy.mat(0xd9a514, { roughness: 0.3 }));
                hd.position.set(Math.cos(a) * (t.discR + 0.12), 0.1, Math.sin(a) * (t.discR + 0.12)); disc.add(hd);
            }
            disc.position.set(t.cx, t.y - 0.03, t.cz); group.add(disc);
            disc.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
            live.push((dt, tt) => { disc.rotation.y = -t.spin * tt; });
        }
        // A raft of logs, riding.
        if (t.move) {
            const raft = new THREE.Group();
            const n = Math.max(3, Math.round(d / 0.36));
            const logM = Toy.mat(theme.raft ?? 0x9a6a3a, { roughness: 0.85 });
            for (let i = 0; i < n; i++) {
                const log = new THREE.Mesh(new THREE.CylinderGeometry(d / n / 2, d / n / 2, w, 10), logM);
                log.rotation.z = Math.PI / 2; log.position.set(0, -d / n / 2 + 0.01, -d / 2 + d * (i + 0.5) / n); raft.add(log);
            }
            const deck = new THREE.Mesh(new THREE.PlaneGeometry(w, d), Toy.mat(theme.wood ?? 0xa0673a)); deck.rotation.x = -Math.PI / 2; raft.add(deck);
            const rope = Toy.mat(0xd8b67a);
            [-w / 2 + 0.25, w / 2 - 0.25].forEach(x => { const r = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.035, 6, 20, Math.PI), rope); r.rotation.y = Math.PI / 2; r.rotation.x = Math.PI; r.position.set(x, -0.05, 0); raft.add(r); });
            const flag = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), Toy.mat(0x5a3a1e)); pole.position.y = 0.6; flag.add(pole);
            const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), Toy.mat(0x16161a, { side: THREE.DoubleSide })); cloth.position.set(0.25, 1.05, 0); flag.add(cloth);
            flag.position.set(w / 2 - 0.2, 0, d / 2 - 0.2); raft.add(flag);
            raft.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            raft.position.set(t.cx, t.y, t.cz); group.add(raft);
            live.push((dt, tt) => {
                const o = tileOffset(t, tt);
                raft.position.set(t.cx + o.dx, t.y + Math.sin(tt * 2.1) * 0.015, t.cz + o.dz);
                raft.rotation.z = Math.sin(tt * 1.7) * 0.02; raft.rotation.x = Math.sin(tt * 1.3) * 0.02;
            });
        }
        // A drawbridge: hinged at its far end, swinging up on chains.
        if (t.lift) {
            const along = w >= d ? 'x' : 'z';
            const len = along === 'x' ? w : d, wid = along === 'x' ? d : w;
            const yaw = new THREE.Group(), tilt = new THREE.Group();
            yaw.add(tilt);
            const n = Math.max(4, Math.round(len / 0.35));
            const pm = [Toy.mat(theme.wood ?? 0xa0673a), Toy.mat(new THREE.Color(theme.wood ?? 0xa0673a).multiplyScalar(0.85).getHex())];
            for (let i = 0; i < n; i++) {
                const p = Toy.rbox(len / n - 0.02, 0.1, wid, 0.03, pm[i % 2]);
                p.position.set(-len + len * (i + 0.5) / n, -0.05, 0); p.castShadow = true; tilt.add(p);
            }
            [-wid / 2, wid / 2].forEach(z => { const b = Toy.rbox(len, 0.06, 0.08, 0.02, Toy.mat(0x3b2412)); b.position.set(-len / 2, 0.02, z); tilt.add(b); });
            // The hinge is at the far (+) end of the span; the deck reaches back toward the ball.
            yaw.position.set(along === 'x' ? t.x1 : t.cx, t.y, along === 'x' ? t.cz : t.z1);
            if (along === 'z') yaw.rotation.y = -Math.PI / 2;
            group.add(yaw);
            const chains = [-wid / 2 - 0.15, wid / 2 + 0.15].map(z => {
                const post = Toy.rbox(0.22, 1.6, 0.22, 0.06, Toy.mat(0x5a3a1e)); post.position.set(0.12, 0.8, z); post.castShadow = true; yaw.add(post);
                const top = new THREE.Object3D(); top.position.set(0.12, 1.55, z); yaw.add(top);
                const free = new THREE.Object3D(); free.position.set(-len + 0.1, 0.05, z * 0.85); tilt.add(free);
                const link = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), Toy.mat(0x2b2b30, { metalness: 0.7 }));
                group.add(link);
                return { top, free, link };
            });
            const A = new THREE.Vector3(), B = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
            live.push((dt, tt) => {
                const { k } = liftState(t, tt);
                tilt.rotation.z = -(1 - k) * 1.25;
                yaw.updateMatrixWorld(true);
                chains.forEach(ch => {
                    ch.top.getWorldPosition(A); ch.free.getWorldPosition(B);
                    if (group.parent) { group.parent.worldToLocal(A); group.parent.worldToLocal(B); }
                    ch.link.position.copy(A).add(B).multiplyScalar(0.5); ch.link.scale.y = A.distanceTo(B);
                    ch.link.quaternion.setFromUnitVectors(UP, A.clone().sub(B).normalize());
                });
            });
        }
        // A see-saw: a board on a fulcrum, rocking with the physics' tilt.
        if (t.tilt) {
            const pivot = new THREE.Group();
            const alongX = t.tilt.axis !== 'z';
            const board = Toy.rbox(w, 0.12, d, 0.05, Toy.mat(theme.wood ?? 0xb7814a, { roughness: 0.7 }));
            board.position.y = -0.06; pivot.add(board);
            // Painted ends and handles.
            [-1, 1].forEach(sd => {
                const end = Toy.rbox(alongX ? 0.6 : w, 0.125, alongX ? d : 0.6, 0.04, Toy.mat(theme.accent ?? 0xff7a59));
                end.position.set(alongX ? sd * (w / 2 - 0.3) : 0, -0.055, alongX ? 0 : sd * (d / 2 - 0.3)); pivot.add(end);
                const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14, Math.PI), Toy.mat(0xffd23f, { roughness: 0.3 }));
                handle.position.set(alongX ? sd * (w / 2 - 0.9) : 0, 0, alongX ? 0 : sd * (d / 2 - 0.9)); if (!alongX) handle.rotation.y = Math.PI / 2; pivot.add(handle);
            });
            pivot.position.set(t.cx, t.y, t.cz); group.add(pivot);
            // The fulcrum: a red triangle standing in the lava.
            const tri = new THREE.Shape(); tri.moveTo(-0.6, 0); tri.lineTo(0.6, 0); tri.lineTo(0, 1); tri.lineTo(-0.6, 0);
            const ful = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: d * 0.6, bevelEnabled: false }), Toy.mat(0xd62828, { roughness: 0.4 }));
            ful.position.set(t.cx, t.y - 1.1, t.cz - d * 0.3); if (!alongX) { ful.rotation.y = Math.PI / 2; ful.position.set(t.cx - d * 0.3, t.y - 1.1, t.cz); }
            group.add(ful);
            pivot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            live.push((dt, tt) => { const a = Math.atan(tiltAt(t, tt)); if (alongX) pivot.rotation.z = a; else pivot.rotation.x = -a; });
        }
        // A lift: a platform on pistons, its rails riding with it.
        if (t.elev) {
            const plat = new THREE.Group();
            const deck = Toy.rbox(w, 0.18, d, 0.05, Toy.mat(t.kind === 'metal' ? 0x9aa3b5 : (theme.wood ?? 0xa0673a), { roughness: 0.5, metalness: t.kind === 'metal' ? 0.5 : 0 }));
            deck.position.y = -0.09; plat.add(deck);
            const edgeGlow = theme.railGlow ? new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.04, d + 0.04), glow(theme.rail, 0.9)) : null;
            if (edgeGlow) { edgeGlow.position.y = -0.18; plat.add(edgeGlow); }
            // Hazard stripes round the edge of the deck.
            const stripe = Toy.mat(0xfacc15, { roughness: 0.5 });
            [[0, -d / 2 + 0.06, w, 0.1], [0, d / 2 - 0.06, w, 0.1]].forEach(([x, z, sx, sz]) => { const s2 = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.012, sz), stripe); s2.position.set(x, 0.006, z); plat.add(s2); });
            // Its rails: the walls compiled for this tile (n/s sides), at their rest heights.
            c.walls.filter(wl => wl.moving && wl.tile === t.i).forEach(wl => {
                const len = Math.hypot(wl.x2 - wl.x1, wl.z2 - wl.z1);
                const r = Toy.rbox(len + 0.1, 0.32, 0.13, 0.06, theme.railGlow ? glow(theme.rail, 0.8) : Toy.mat(theme.rail ?? 0xf3e9d2));
                r.position.set((wl.x1 + wl.x2) / 2 - t.cx, 0.16, (wl.z1 + wl.z2) / 2 - t.cz); r.rotation.y = -Math.atan2(wl.z2 - wl.z1, wl.x2 - wl.x1);
                plat.add(r);
            });
            plat.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            plat.position.set(t.cx, t.y, t.cz); group.add(plat);
            // Pistons: a fixed sleeve and a rod that slides out of it.
            const sleeveM = Toy.mat(0x4b5563, { metalness: 0.6, roughness: 0.35 }), rodM = Toy.mat(0xd1d5db, { metalness: 0.8, roughness: 0.2 });
            const rods = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
                const x = t.cx + sx * (w / 2 - 0.25), z = t.cz + sz * (d / 2 - 0.25);
                const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 10), sleeveM); sleeve.position.set(x, t.y - 0.5, z); group.add(sleeve);
                const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), rodM); group.add(rod);
                return { rod, x, z };
            });
            live.push((dt, tt) => {
                const e = elevAt(t, tt);
                plat.position.y = t.y + e;
                rods.forEach(r => { const h = Math.max(0.05, e + 0.2); r.rod.scale.y = h; r.rod.position.set(r.x, t.y - 0.2 + h / 2, r.z); });
            });
        }
        // Jelly pads: wobbling blocks of jelly — a clear glossy gel with a deeper core, bubbles
        // caught inside and a sugar-dusted top, that squashes and flashes when a ball bounces.
        if (t.kind === 'jelly') {
            const col = new THREE.Color(theme.jelly ?? 0xff4fa0);
            const pad = new THREE.Group(); pad.position.set(t.cx, t.y + 0.04, t.cz); group.add(pad);
            const gel = new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.22, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.84, depthWrite: false });
            const shell = Toy.rbox(w - 0.06, 0.26, d - 0.06, 0.12, gel); shell.position.y = -0.05; shell.renderOrder = 2; pad.add(shell);
            const core = Toy.rbox(w - 0.5, 0.14, d - 0.5, 0.06, new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.62), emissive: col, emissiveIntensity: 0.12, roughness: 0.3 }));
            core.position.y = -0.12; pad.add(core);
            // Bubbles held in the gel.
            const bub = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
            const nb = Math.min(24, Math.round(w * d * 1.4));
            for (let i = 0; i < nb; i++) {
                const r = 0.03 + ((i * 7) % 5) * 0.012, s2 = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), bub);
                s2.position.set(((i * 0.618) % 1 - 0.5) * (w - 0.4), -0.05 + ((i * 0.37) % 1) * 0.08, ((i * 0.414) % 1 - 0.5) * (d - 0.4)); pad.add(s2);
            }
            // Sugar crystals glinting on top, and a long highlight.
            const sugar = new THREE.MeshBasicMaterial({ color: 0xffffff });
            for (let i = 0; i < Math.round(w * d * 3); i++) {
                const q = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.035), sugar);
                q.position.set(((i * 0.7548) % 1 - 0.5) * (w - 0.2), 0.085, ((i * 0.5698) % 1 - 0.5) * (d - 0.2)); q.rotation.y = i; pad.add(q);
            }
            const shine = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
            shine.rotation.x = -Math.PI / 2; shine.position.set(-w * 0.12, 0.088, -d * 0.28); pad.add(shine);
            const J = { pad, t, k: 0 };
            jellies.push(J);
            live.push((dt, tt) => {
                J.k = Math.max(0, J.k - dt * 1.6);
                const wob = Math.sin(tt * 18) * J.k * 0.25 + Math.sin(tt * 3 + t.cx) * 0.02;
                pad.scale.set(1 + wob * 0.5, 1 - wob * 1.5, 1 + wob * 0.5);
                gel.emissiveIntensity = 0.22 + J.k * 0.6;
            });
        }
    });

    // Hammers: a Kraken's tentacle (pirate) or a big mallet head.
    c.movers.filter(m => m.type === 'hammer').forEach(m => {
        const g = new THREE.Group();
        if (theme.scenery === 'pirate') {
            const tm = Toy.mat(theme.slider ?? 0x8e44ad, { roughness: 0.4 });
            const pts = [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(-0.1, 1.2, 0), new THREE.Vector3(0.25, 1.8, 0)];
            const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, m.r || 0.45, 12, false), tm);
            tube.scale.set(0.9, 1, 0.9); g.add(tube);
            const tip = new THREE.Mesh(new THREE.SphereGeometry((m.r || 0.45) * 0.9, 12, 10), tm); tip.position.set(0.25, 1.8, 0); g.add(tip);
            for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), Toy.mat(0xf0c6f5)); s.position.set(-(m.r || 0.45) * 0.85, 0.1 + i * 0.32, 0.12); g.add(s); }
        } else {
            const head = new THREE.Mesh(new THREE.CylinderGeometry(m.r || 0.45, m.r || 0.45, 0.7, 20), Toy.mat(theme.accent, { roughness: 0.3 }));
            head.rotation.x = Math.PI / 2; head.position.y = 0.4; g.add(head);
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), Toy.mat(0x7a4a24)); handle.position.y = 1.2; g.add(handle);
        }
        g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        group.add(g);
        live.push((dt, tt) => {
            const h = hammerHeads({ ...c, movers: [m] }, tt)[0];
            g.position.set(h.x, h.y, h.z);
            g.rotation.x = (m.axis || 'z') === 'z' ? -h.vz * 0.08 : 0;
            g.rotation.z = (m.axis || 'z') === 'x' ? h.vx * 0.08 : 0;
        });
    });

    // Gates: a portcullis in each doorway.
    c.movers.filter(m => m.type === 'gate' && m.laser).forEach(m => {
        // A laser fence: an emitter at each side and beams across, flickering on and off.
        const w = (m.w || 0.55) * 2, base = m._base ?? (floorAt(c, m.x, m.z, 99, 0.1, 0)?.h ?? 0);
        const g = new THREE.Group();
        const beamM = new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.85, depthWrite: false });
        const beams = [0.12, 0.26, 0.4].map(y => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, w, 6), beamM); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); return b; });
        [-w / 2, w / 2].forEach(z => { const em = Toy.rbox(0.22, 0.6, 0.22, 0.05, Toy.mat(0x374151, { metalness: 0.6 })); em.position.set(0, 0.3, z); g.add(em); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow(0xff2d55, 1.6)); eye.position.set(0, 0.42, z * 0.92); g.add(eye); });
        if (m.axis !== 'z') g.rotation.y = Math.PI / 2;
        g.position.set(m.x, base, m.z); group.add(g);
        live.push((dt, tt) => { const k = gateDown(m, tt); beamM.opacity = k > 0.6 ? 0.85 + Math.sin(tt * 40) * 0.1 : k * 0.25; beams.forEach(b => { b.visible = k > 0.05; }); });
    });
    c.movers.filter(m => m.type === 'gate' && m.tentacle).forEach(m => {
        // A kraken's arm: rises out of the sea to swat the gap, sinks back to let you through.
        const base = m._base ?? (floorAt(c, m.x, m.z, 99, 0.1, 0)?.h ?? 0), H = (m.h ?? 1.6) + 0.4;
        const g = new THREE.Group(), skin = Toy.mat(0x7b2d8e, { roughness: 0.45 }), suck = Toy.mat(0xf0c6f5);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, H, 12), skin); arm.position.y = H / 2; g.add(arm);
        const tip = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.1, 8, 14, Math.PI * 1.3), skin); tip.position.y = H; tip.rotation.z = Math.PI / 2; g.add(tip);
        for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), suck); s.position.set(0.25 - i * 0.03, 0.3 + i * H / 6, 0); g.add(s); }
        g.position.set(m.x, base, m.z); group.add(g);
        live.push((dt, tt) => { const k = gateDown(m, tt); g.position.y = base - (1 - k) * H; g.rotation.y = Math.sin(tt * 2 + m.x) * 0.4; g.visible = k > 0.02; });
    });
    c.movers.filter(m => m.type === 'gate' && !m.laser && !m.tentacle).forEach(m => {
        const g = new THREE.Group();
        const w = (m.w || 0.55) * 2, H = 0.95;
        const bars = Toy.mat(0x2b2b30, { metalness: 0.7, roughness: 0.35 });
        for (let i = 0; i <= 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, H, 6), bars); b.position.set(0, H / 2, -w / 2 + w * i / 5); g.add(b); const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), bars); sp.rotation.x = Math.PI; sp.position.set(0, -0.05, -w / 2 + w * i / 5); g.add(sp); }
        [0.2, 0.6].forEach(y => { const cb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, w), bars); cb.position.y = y; g.add(cb); });
        if (m.axis !== 'z') g.rotation.y = Math.PI / 2;
        const base = m._base ?? (floorAt(c, m.x, m.z, 99, 0.1, 0)?.h ?? 0);
        g.position.set(m.x, base, m.z); group.add(g);
        live.push((dt, tt) => { g.position.y = base + (1 - gateDown(m, tt)) * 0.95; });
    });

    // A lift's doors: bars that come down whenever the lift isn't level with them.
    c.movers.filter(m => m.type === 'liftgate').forEach(m => {
        const g = new THREE.Group();
        const T = c.tiles[m.tile], amp = T?.elev?.amp || 1;
        const w = (m.w || 0.55) * 2, H = amp + 0.6;
        const barM = theme.railGlow ? glow(0xf43f5e, 1.1) : Toy.mat(0xd62828, { roughness: 0.35 });
        for (let i = 0; i <= 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H, 6), barM); b.position.set(0, H / 2, -w / 2 + w * i / 6); g.add(b); }
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, w), Toy.mat(0xfacc15)); top.position.y = H; g.add(top);
        if (m.axis !== 'z') g.rotation.y = Math.PI / 2;
        const base = T ? T.y : (floorAt(c, m.x, m.z, 99, 0.1, 0)?.h ?? 0);
        const frame = new THREE.Group();
        [-w / 2 - 0.08, w / 2 + 0.08].forEach(z => { const post = Toy.rbox(0.16, H + 0.4, 0.16, 0.05, Toy.mat(0x4b5563, { metalness: 0.5 })); post.position.set(0, (H + 0.4) / 2, z); frame.add(post); });
        if (m.axis !== 'z') frame.rotation.y = Math.PI / 2;
        frame.position.set(m.x, base, m.z); group.add(frame);
        g.position.set(m.x, base, m.z); group.add(g);
        let k = 1;
        live.push((dt, tt) => {
            const want = liftGateShut(c, m, tt) ? 1 : 0;
            k += (want - k) * Math.min(1, dt * 14);
            // Open: the bars slide down out of the way at this door's floor level.
            g.position.y = base - (1 - k) * (H + 0.1) + (m.at === 'top' ? 0 : 0);
            g.visible = k > 0.02;
        });
    });

    // Fans: a turbine at the side of each wind box, blades spinning, streaks blowing across.
    (c.hole.fans || []).forEach(f => {
        const [x0, z0, x1, z1] = f.r;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const ux = Math.sign(f.f[0]), uz = Math.sign(f.f[1]);
        const at = [ux ? (ux > 0 ? Math.min(x0, x1) - 0.6 : Math.max(x0, x1) + 0.6) : cx, uz ? (uz > 0 ? Math.min(z0, z1) - 0.6 : Math.max(z0, z1) + 0.6) : cz];
        const fan = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.5, 24, 1, true), Toy.mat(0x6b7280, { metalness: 0.6, side: THREE.DoubleSide }));
        body.rotation.x = Math.PI / 2; fan.add(body);
        const blades = new THREE.Group();
        for (let k = 0; k < 5; k++) { const bl = Toy.rbox(0.18, 0.62, 0.04, 0.04, glow(theme.accent, 0.4)); bl.position.y = 0.32; const arm = new THREE.Group(); arm.add(bl); arm.rotation.z = k / 5 * Math.PI * 2; blades.add(arm); }
        fan.add(blades);
        const stand = Toy.rbox(0.25, 0.8, 0.25, 0.06, Toy.mat(0x4b5563)); stand.position.y = -0.7; fan.add(stand);
        // On the floor the wind blows across (a raised deck, a bridge), not the first tile's.
        const fy = floorAt(c, cx, cz, 99, 0, 0)?.h ?? (c.tiles[0]?.y || 0);
        fan.position.set(at[0], fy + 0.85, at[1]);
        fan.rotation.y = Math.atan2(ux, uz);
        fan.traverse(o => { if (o.isMesh) o.castShadow = true; });
        group.add(fan);
        live.push(dt => { blades.rotation.z += dt * 18; });
        // Streaks.
        for (let i = 0; i < 12; i++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(uz ? 0.03 : 0.6, 0.03, uz ? 0.6 : 0.03), new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.5 }));
            group.add(s);
            const ph = i / 12, lane = (i * 0.618) % 1;
            live.push((dt, tt) => {
                const u = (tt * 0.9 + ph) % 1;
                const ax = ux ? (ux > 0 ? Math.min(x0, x1) + Math.abs(x1 - x0) * u : Math.max(x0, x1) - Math.abs(x1 - x0) * u) : Math.min(x0, x1) + Math.abs(x1 - x0) * lane;
                const az = uz ? (uz > 0 ? Math.min(z0, z1) + Math.abs(z1 - z0) * u : Math.max(z0, z1) - Math.abs(z1 - z0) * u) : Math.min(z0, z1) + Math.abs(z1 - z0) * lane;
                s.position.set(ax, fy + 0.25 + (i % 3) * 0.12, az);
                s.material.opacity = 0.55 * Math.sin(u * Math.PI);
            });
        }
    });

    // Magnets: a little planet hovering over each pull, rings sinking into it.
    (c.hole.magnets || []).forEach((m, i) => {
        const cols = [0xf59e0b, 0x22d3ee, 0xa855f7, 0x84cc16];
        const col = cols[i % cols.length];
        const planet = new THREE.Group();
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.6 }));
        planet.add(ball);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 40), glow(0xffffff, 0.5)); ring.rotation.x = 1.2; planet.add(ring);
        const my = floorAt(c, m.x, m.z, 99, 0, 0)?.h ?? 0;
        planet.position.set(m.x, my + 1.6, m.z); group.add(planet);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.4, 1.5, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, depthWrite: false }));
        beam.position.set(m.x, my + 0.8, m.z); group.add(beam);
        const rings = [];
        for (let k = 0; k < 3; k++) {
            const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false }));
            r.rotation.x = -Math.PI / 2; r.position.set(m.x, my + 0.02, m.z); group.add(r); rings.push(r);
        }
        live.push((dt, tt) => {
            planet.rotation.y += dt * 0.6; planet.position.y = 1.6 + Math.sin(tt * 1.4 + i) * 0.12;
            rings.forEach((r, k) => { const u = 1 - ((tt * 0.45 + k / 3) % 1); r.scale.setScalar(Math.max(0.05, u * m.r)); r.material.opacity = 0.55 * (1 - u); });
        });
    });

    return {
        group,
        update(dt, t) { live.forEach(f => f(dt, t)); },
        /** A ball bounced off a jelly pad near (x, z): wobble it. */
        jelly(x, z) { jellies.forEach(J => { if (x >= J.t.x0 - 0.5 && x <= J.t.x1 + 0.5 && z >= J.t.z0 - 0.5 && z <= J.t.z1 + 0.5) J.k = 1; }); },
    };
}
