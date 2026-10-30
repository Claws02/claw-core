// ============================================================
// GHOSTS — everyone else in a race that is played alone on every phone.
//
// SoloArena.ghosts() is what the host app's network last heard from each
// other racer: a small state ({ x, y, z, h } in the game's own world) with
// a name and a seat colour. This draws each as a see-through copy of a racer
// with a name tag over it, eased toward the latest report so nine updates a
// second still move smoothly, and drops anyone not heard from in a while.
// Ghosts never touch anything: the race on this phone is still yours alone.
//
//   const g = createGhosts(stage, { build: color => Object3D, y: 1.6 });
//   g.update(dt)        each frame
//   g.count()           how many are on screen (probes)
//   g.dispose()
// ============================================================
import * as Solo from '../minigames/SoloArena.js';

const STALE_MS = 2500;
const EASE = 10;                 // 1/s toward the latest report

export function createGhosts(stage, { build, y = 1.5, opacity = 0.42, label = true } = {}) {
    const live = new Map();      // id → { obj, tag, x, y, z, h, seen }

    const _fade = (obj) => obj.traverse(o => {
        if (!o.material) return;
        o.material = o.material.clone();
        o.material.transparent = true; o.material.opacity = opacity; o.material.depthWrite = false;
        o.castShadow = false;
    });

    function _tag(name, css) {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
        const g = cv.getContext('2d');
        g.font = 'bold 34px "Bebas Neue", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 8; g.strokeStyle = 'rgba(20,10,30,.85)'; g.strokeText(name, 128, 34);
        g.fillStyle = css; g.fillText(name, 128, 34);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
        sp.scale.set(3.2, 0.8, 1);
        return sp;
    }

    function _add(o) {
        const color = typeof o.color === 'number' ? o.color : parseInt(String(o.color || '#ffffff').replace('#', ''), 16);
        const css = '#' + color.toString(16).padStart(6, '0');
        const obj = build(color);
        _fade(obj);
        stage.add(obj);
        const tag = label ? _tag(String(o.name || '').toUpperCase().slice(0, 12), css) : null;
        if (tag) stage.add(tag);
        const s = o.state || {};
        return { obj, tag, x: s.x || 0, y: s.y || 0, z: s.z || 0, h: s.h || 0, seen: 0 };
    }

    function _drop(id) {
        const g = live.get(id);
        if (!g) return;
        stage.scene?.remove(g.obj); if (g.tag) stage.scene?.remove(g.tag);
        live.delete(id);
    }

    return {
        update(dt) {
            if (!stage.gl) return;
            const now = performance.now();
            const seen = new Set();
            for (const o of Solo.ghosts()) {
                if (!o || !o.state || now - (o.at || 0) > STALE_MS) continue;
                seen.add(o.id);
                let g = live.get(o.id);
                if (!g) { g = _add(o); live.set(o.id, g); }
                const s = o.state, k = Math.min(1, dt * EASE);
                g.x += ((s.x || 0) - g.x) * k; g.y += ((s.y || 0) - g.y) * k; g.z += ((s.z || 0) - g.z) * k;
                let dh = (s.h || 0) - g.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
                g.h += dh * k;
                g.obj.position.set(g.x, g.y, g.z);
                g.obj.rotation.y = g.h;
                if (g.tag) g.tag.position.set(g.x, g.y + y, g.z);
            }
            [...live.keys()].forEach(id => { if (!seen.has(id)) _drop(id); });
        },
        count() { return live.size; },
        dispose() { [...live.keys()].forEach(_drop); },
    };
}
