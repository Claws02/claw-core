// usage: node chal.mjs <course>  — for each trick-shot challenge on the course: the share of a
// grid of shots from `from` (72 directions × 20 powers) that succeed (holed, or stopped in `zone`).
// Aim for roughly 1–8%: possible but hard.
import * as P from '../Physics.js';
import { COURSES, CHALLENGES } from '../Courses.js';
const course = process.argv[2];
for (const ch of CHALLENGES.filter(c => !course || c.course === course)) {
  const h = COURSES.flatMap(c => c.holes).find(h => h.key === ch.key); const c = P.compile(h);
  const f = P.floorAt(c, ch.from[0], ch.from[1], 99); if (!f) { console.log(ch.id, 'FROM IS OVER NOTHING'); continue; }
  let ok = 0, n = 0;
  for (let a = 0; a < 72; a++) for (let k = 1; k <= 20; k++) {
    const ang = a / 72 * Math.PI * 2, r = P.simulate(c, { x: ch.from[0], y: f.h, z: ch.from[1] }, Math.cos(ang), Math.sin(ang), k / 20, 0, { maxT: 12, dt: 1 / 45 });
    n++; const [x0, z0, x1, z1] = ch.zone;
    if (r.result === 'cup' || (r.result === 'rest' && r.x >= x0 && r.x <= x1 && r.z >= z0 && r.z <= z1)) ok++;
  }
  console.log(ch.id.padEnd(12), ch.key.padEnd(12), (ok / n * 100).toFixed(1) + '%');
}
