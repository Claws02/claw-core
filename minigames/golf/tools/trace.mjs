import * as P from '../Physics.js';
import { plan } from '../Bot.js';
import { COURSES } from '../Courses.js';
const key = process.argv[2], skill = +(process.argv[3] ?? 1);
const h = COURSES.flatMap(c => c.holes).find(h => h.key === key); const c = P.compile(h);
const b = P.newBall(c.tee.x, c.tee.z, c.tee.y); let t = 0, s = 0;
while (!b.sunk && s < 10) { const pl = plan(c, b, t, skill); s++;
  for (let w = 0; w < 0.4 + (pl.wait || 0); w += 1/60) { P.step(c, b, 1/60, t); t += 1/60; }
  const from = { x: b.x, y: b.y, z: b.z }; P.strike(b, pl.dx, pl.dz, pl.power, c); let tt = 0, note = '';
  while (tt < 12) { const ev = P.step(c, b, 1/60, t); t += 1/60; tt += 1/60; const hz = ev.find(e => e.type === "water" || e.type === "out"); if (hz) { note = hz.type.toUpperCase() + "@" + b.x.toFixed(1) + "," + b.z.toFixed(1); s++; Object.assign(b, P.newBall(from.x, from.z, from.y)); break; } if (b.sunk || (b.rest && !b.pipe && !b.loop)) { if (!b.sunk && P.noRest(c, b.x, b.z, b.y)) { note += 'NOREST@' + b.x.toFixed(1) + ',' + b.z.toFixed(1); Object.assign(b, P.newBall(from.x, from.z, from.y)); } break; } }
  console.log(`#${s} from (${from.x.toFixed(1)},${from.z.toFixed(1)}) wait ${(pl.wait||0).toFixed(1)} a ${(Math.atan2(pl.dz,pl.dx)*57).toFixed(0)} p ${pl.power.toFixed(2)} expect ${pl.expect} -> (${b.x.toFixed(1)},${b.z.toFixed(1)}) ${b.kind} ${note}${b.sunk?' SUNK':''}`);
}
