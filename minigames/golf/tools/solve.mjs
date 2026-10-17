import * as P from '../Physics.js';
import { plan } from '../Bot.js';
import { COURSES } from '../Courses.js';
const skill = +(process.argv[2] ?? 0.8), trials = +(process.argv[3] ?? 6);
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
for (const course of COURSES) {
  let tot = 0, par = 0;
  for (const h of course.holes) {
    if (ONLY && !ONLY.includes(h.key)) continue;
    const c = P.compile(h);
    const strokesList = []; const notes = new Set();
    for (let tr = 0; tr < trials; tr++) {
      const b = P.newBall(c.tee.x, c.tee.z, c.tee.y); let t = 0, strokes = 0;
      while (!b.sunk && strokes < 10) {
        const pl = plan(c, b, t, skill); strokes++;
        for (let w = 0; w < 0.4 + (pl.wait || 0); w += 1/60) { P.step(c, b, 1/60, t); t += 1/60; }
        const from = { x: b.x, y: b.y, z: b.z };
        P.strike(b, pl.dx, pl.dz, pl.power, c);
        let tt = 0;
        while (tt < (h.rollMax || 12)) { const ev = P.step(c, b, 1/60, t); t += 1/60; tt += 1/60;
          for (const e of ev) { if (e.type==='water'||e.type==='out') { notes.add(e.type); strokes++; Object.assign(b, P.newBall(from.x, from.z, from.y)); tt=99; } if (['pipe','loop','lip','boom','jelly'].includes(e.type)) notes.add(e.type); }
          if (b.sunk || (b.rest && !b.pipe && !b.loop)) { if (!b.sunk && P.noRest(c, b.x, b.z, b.y)) { notes.add('norest'); Object.assign(b, P.newBall(from.x, from.z, from.y)); } break; } }
        if (tt >= 12 && tt < 99) notes.add('timeout');
      }
      strokesList.push(strokes);
    }
    const avg = strokesList.reduce((a,b)=>a+b,0)/trials; tot += avg; par += h.par;
    console.log(h.key.padEnd(12), "sig", (h.sig||"").padEnd(18), 'par', h.par, 'avg', avg.toFixed(2), JSON.stringify(strokesList), [...notes].join(','), 'walls', c.walls.length);
  }
  console.log(course.key, 'total avg', tot.toFixed(1), 'par', par);
}
