// usage: node lint.mjs [course]   — the clash checker over a course (or all)
import { COURSES } from '../Courses.js';
import { lintAll } from '../Lint.js';
const only = process.argv[2];
const r = lintAll(COURSES.filter(c => !only || c.key === only));
let e = 0, w = 0;
for (const [k, ps] of Object.entries(r)) { console.log(k); for (const p of ps) { console.log(`  ${p.level === 'error' ? '✗' : '·'} ${p.what} ${p.at || ''}`); p.level === 'error' ? e++ : w++; } }
console.log(`\n${e} errors, ${w} warnings`);
