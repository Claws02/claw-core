// ============================================================
// BAKE — a built hole's still parts merged into a few meshes, so a phone draws
// it in a fraction of the calls.
//
// A hole is hundreds of little meshes (a rail is three, a tree is eight), and
// with shadows on each one is drawn twice a frame: about 400-600 draw calls,
// where a mid-range phone wants under ~200. Nearly all of it never moves, so
// once the hole is built, everything still is merged, one mesh per material:
//   - floors and their skirts across the whole hole, a level at a time;
//   - low things (rails, posts, under ~0.7 tall) across the whole hole, and
//     never faded (nothing that short hides a ball);
//   - everything else within its own prop (the same group the see-through fade
//     picks: the highest one with 40 meshes or fewer), so a tree in the way
//     still fades as one tree.
// Left alone: anything the hole's update reaches (`keep`), anything flagged to
// animate, anything see-through, hidden, a line or points, or under a parent
// that moves. Merging changes no shape, colour or shadow, only how it's drawn.
// ============================================================

// userData flags that mean "this moves or changes" (Build's animateProps and friends).
const ANIM = ['spray', 'bob', 'circle', 'sway', 'spin', 'hover', 'blink', 'drift', 'tick', 'pulse', 'soft', 'lava', 'water', 'recoil', 'barrel', 'muzzle', 'chev', 'ph', 'anim', 'live'];
const LOW = 0.7;           // a prop this short merges hole-wide
const FADE_MAX = 40;       // the see-through fade's own limit (MiniGolf._fadeRoot)

const _box = new THREE.Box3();

function _matKey(m) {
    const c = v => (v && v.getHex ? v.getHex() : v ?? '');
    return [m.type, c(m.color), c(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.map?.uuid, m.side,
            m.flatShading, m.vertexColors, m.transparent, m.opacity, m.depthWrite, m.alphaTest, m.polygonOffset,
            m.polygonOffsetFactor, m.polygonOffsetUnits, m.wireframe, m.clearcoat, m.toneMapped, m.fog].join('|');
}

/** Merge `items` ([{ mesh, geo }], world-space geometry) into one geometry. */
function _merge(items, withUv, withColor) {
    let n = 0;
    for (const it of items) n += it.geo.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    const uv = withUv ? new Float32Array(n * 2) : null, col = withColor ? new Float32Array(n * 3) : null;
    let o = 0;
    for (const { geo } of items) {
        const k = geo.attributes.position.count;
        pos.set(geo.attributes.position.array, o * 3);
        nor.set(geo.attributes.normal.array, o * 3);
        if (uv) { if (geo.attributes.uv) uv.set(geo.attributes.uv.array, o * 2); }
        if (col) { if (geo.attributes.color && geo.attributes.color.itemSize === 3) col.set(geo.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + k) * 3); }
        o += k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
}

/** A mesh's geometry, non-indexed, in root space (root sits at the origin, unrotated). */
function _worldGeo(mesh, inv) {
    let g = mesh.geometry;
    if (!g?.attributes?.position) return null;
    g = g.index ? g.toNonIndexed() : g.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    // Interleaved or odd attributes: give up on this one rather than guess.
    for (const a of ['position', 'normal', 'uv', 'color']) if (g.attributes[a]?.isInterleavedBufferAttribute) return null;
    g.applyMatrix4(mesh.matrixWorld.clone().premultiply(inv));
    // A mirrored mesh (negative scale) turns its triangles inside out once baked.
    if (mesh.matrixWorld.determinant() < 0) {
        const p = g.attributes.position.array, nn = g.attributes.normal.array, u = g.attributes.uv?.array;
        for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t; const s = nn[i + 3 + j]; nn[i + 3 + j] = nn[i + 6 + j]; nn[i + 6 + j] = s; }
        if (u) for (let i = 0; i < u.length; i += 6) for (let j = 0; j < 2; j++) { const t = u[i + 2 + j]; u[i + 2 + j] = u[i + 4 + j]; u[i + 4 + j] = t; }
    }
    return g;
}

const _inside = (o, set) => { for (let a = o.parent; a; a = a.parent) if (set.has(a) && a.name === 'moving') return true; return false; };

/**
 * Merge the still parts of `root`. `keep` holds objects the hole updates (their
 * whole subtree is left as it is). Returns { before, after } mesh counts.
 */
export function bake(root, keep = new Set()) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    // Pinned: kept, flagged to animate, or not a plain mesh. Moving: pinned or under a pinned parent.
    const pinned = o => keep.has(o) || ANIM.some(k => o.userData[k] != null && o.userData[k] !== false) || o.isPoints || o.isLine || o.isSprite || o.isSkinnedMesh || o.isInstancedMesh || o.isLight || o.isCamera;
    const moving = new Set();
    (function walk(o, under) {
        const m = under || pinned(o);
        if (m) moving.add(o);
        o.children.forEach(c => walk(c, m));
    })(root, false);

    const meshCount = new Map();
    const count = o => { if (meshCount.has(o)) return meshCount.get(o); let n = 0; o.traverse(q => { if (q.isMesh) n++; }); meshCount.set(o, n); return n; };
    const ownerOf = o => { let pick = o; for (let a = o.parent; a && a !== root; a = a.parent) { if (count(a) > FADE_MAX) break; pick = a; } return pick; };
    const isFloor = o => { for (let a = o; a && a !== root; a = a.parent) if (a.userData.floor) return true; return false; };

    const buckets = new Map();
    let before = 0;
    root.traverse(o => { if (o.isMesh) before++; });
    root.traverse(o => {
        if (!o.isMesh || moving.has(o) || !o.visible || Array.isArray(o.material)) return;
        const m = o.material;
        if (!m || m.transparent || m.opacity < 1 || m.morphTargets || o.morphTargetInfluences) return;
        for (let a = o.parent; a && a !== root; a = a.parent) if (!a.visible) return;
        const owner = ownerOf(o);
        _box.setFromObject(owner);
        const low = _box.max.y - _box.min.y < LOW;
        const floor = isFloor(o);
        // Floors merge a level at a time, so a deck overhead still fades on its own.
        const where = floor ? 'floor' + Math.round(new THREE.Box3().setFromObject(o).max.y * 2) : low ? 'low' : owner.uuid;
        const key = `${where}#${_matKey(m)}#${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
        if (!buckets.has(key)) buckets.set(key, { where, owner, floor, mat: m, cast: o.castShadow, recv: o.receiveShadow, list: [] });
        buckets.get(key).list.push(o);
    });

    const groups = new Map();   // owner → the group its merged meshes go in
    for (const b of buckets.values()) {
        if (b.list.length < 2) continue;
        const items = [];
        for (const mesh of b.list) { const geo = _worldGeo(mesh, inv); if (geo) items.push({ mesh, geo }); }
        if (items.length < 2) continue;
        const merged = new THREE.Mesh(_merge(items, !!b.mat.map || items.some(i => i.geo.attributes.uv) && !!b.mat.map, !!b.mat.vertexColors), b.mat);
        merged.castShadow = b.cast; merged.receiveShadow = b.recv;
        merged.matrixAutoUpdate = false;
        if (b.floor) merged.userData.floor = true;
        // Rails and posts hole-wide: nothing that short hides a ball, and fading one would fade them all.
        if (b.where === 'low') merged.userData.noFade = true;
        merged.userData.baked = items.length;
        items.forEach(i => { i.mesh.parent.remove(i.mesh); i.geo.dispose(); });
        if (b.floor || b.where === 'low') root.add(merged);
        else {
            // The prop's merged meshes stay together in one group where the prop was,
            // so the see-through fade still fades the whole prop.
            let g = groups.get(b.owner);
            // fadeRoot: the see-through fade fades this group whole, and no further up
            // (with fewer meshes after baking, it would otherwise climb to the whole scenery).
            if (!g) { g = new THREE.Group(); g.matrixAutoUpdate = false; g.userData.fadeRoot = true; (b.owner.parent || root).add(g); groups.set(b.owner, g); }
            if (b.owner.parent && b.owner.parent !== root) { b.owner.parent.updateMatrixWorld(true); merged.applyMatrix4(b.owner.parent.matrixWorld.clone().invert().multiply(root.matrixWorld)); merged.updateMatrix(); }
            g.add(merged);
        }
    }
    // Inside a kept thing that moves as one piece (a soft rail that wobbles, a
    // bumper that squashes, a door), the parts that don't move on their own are
    // merged too, in its own space. Not the movers' group: Moving.js animates its
    // children from closures this can't see.
    const own = keep.has(root) ? [] : [...keep].filter(k => k.isObject3D && !k.isMesh && k.name !== 'moving' && !_inside(k, keep));
    for (const K of own) {
        K.updateMatrixWorld(true);
        const kinv = K.matrixWorld.clone().invert();
        const inner = new Map();
        K.traverse(o => {
            if (o === K || !o.isMesh || !o.visible || Array.isArray(o.material)) return;
            for (let a = o; a && a !== K; a = a.parent) if (pinned(a) || !a.visible) return;
            const m = o.material;
            if (!m || m.transparent || m.opacity < 1 || o.morphTargetInfluences) return;
            const key = `${_matKey(m)}#${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
            if (!inner.has(key)) inner.set(key, { mat: m, cast: o.castShadow, recv: o.receiveShadow, list: [] });
            inner.get(key).list.push(o);
        });
        for (const b of inner.values()) {
            if (b.list.length < 2) continue;
            const items = [];
            for (const mesh of b.list) { const geo = _worldGeo(mesh, kinv); if (geo) items.push({ mesh, geo }); }
            if (items.length < 2) continue;
            const merged = new THREE.Mesh(_merge(items, !!b.mat.map, !!b.mat.vertexColors), b.mat);
            merged.castShadow = b.cast; merged.receiveShadow = b.recv; merged.userData.baked = items.length;
            items.forEach(i => { i.mesh.parent.remove(i.mesh); i.geo.dispose(); });
            K.add(merged);
        }
    }
    // Whatever is left fixed in place doesn't need its matrix worked out every frame.
    root.traverse(o => { if (!moving.has(o) && o !== root && !o.isLight) { o.updateMatrix(); o.matrixAutoUpdate = false; } });
    let after = 0;
    root.traverse(o => { if (o.isMesh) after++; });
    return { before, after };
}
