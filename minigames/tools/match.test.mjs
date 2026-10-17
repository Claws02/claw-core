// node minigames/tools/match.test.mjs — the match rules every round game shares (Match.js).
import { createMatch, bestOf } from '../Match.js';
let pass = 0, fail = 0;
const eq = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    ok ? pass++ : fail++;
    if (!ok) console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const play = (m, ws) => { let s; const labels = []; for (const w of ws) { labels.push(m.begin().label); s = m.end(w); } return { s, labels }; };

eq('bestOf 3', bestOf(3), 2); eq('bestOf 5', bestOf(5), 3); eq('bestOf 7', bestOf(7), 4);

// Best of 3, straight sweep.
{ const { s, labels } = play(createMatch({ seats: 2, firstTo: 2 }), [0, 0]);
  eq('sweep over', [s.over, s.winner, s.wins], [true, 0, [2, 0]]);
  eq('sweep labels', labels, ['ROUND 1', 'MATCH POINT']); }

// Best of 3 to a decider.
{ const { s, labels } = play(createMatch({ seats: 2, firstTo: 2 }), [0, 1, 1]);
  eq('decider', [s.over, s.winner, s.wins], [true, 1, [1, 2]]);
  eq('decider labels', labels, ['ROUND 1', 'MATCH POINT', 'FINAL ROUND']); }

// A void doesn't use up a round: 0, void, 1, 0 → 2-1 to seat 0 (old code: over after 3 at 1-1).
{ const m = createMatch({ seats: 2, firstTo: 2 });
  const { s } = play(m, [0, -1, 1]);
  eq('void not counted', [s.over, s.decided, s.round], [false, 2, 3]);
  eq('void then decider', m.begin().label, 'FINAL ROUND');
  const e = m.end(0); eq('void match', [e.over, e.winner, e.wins], [true, 0, [2, 1]]); }

// Voids forever stop at the hard cap, as a draw when level.
{ const m = createMatch({ seats: 2, firstTo: 2 });
  const { s } = play(m, [-1, -1, -1, -1, -1, -1, -1]);
  eq('hard cap draw', [s.over, s.winner, s.round], [true, -1, 7]); }

// Best of 5 at 3 seats.
{ const m = createMatch({ seats: 3, firstTo: 3 });
  const { s } = play(m, [0, 1, 2, 0, 1, 2]);
  eq('3 seats level', [s.over, s.wins], [false, [2, 2, 2]]);
  eq('3 seats all on match point', m.state().matchPoint, [0, 1, 2]);
  const e = (m.begin(), m.end(2)); eq('3 seats winner', [e.over, e.winner], [true, 2]); }

// Fixed rounds with no outright target (firstTo above maxRounds): settle on most wins.
{ const m = createMatch({ seats: 2, firstTo: 99, maxRounds: 3, suddenDeath: true });
  const { s } = play(m, [0, 1, 0]);
  eq('fixed rounds', [s.over, s.winner], [true, 0]); }

// Level after the fixed rounds → sudden death, one round at a time.
{ const m = createMatch({ seats: 2, firstTo: 99, maxRounds: 4 });
  const { s } = play(m, [0, 1, 0, 1]);
  eq('sudden death pending', [s.over, s.sudden], [false, true]);
  eq('sudden label', m.begin().label, 'SUDDEN DEATH');
  const e = m.end(1); eq('sudden death', [e.over, e.winner], [true, 1]); }

// suddenDeath: false → level is a draw.
{ const { s } = play(createMatch({ seats: 2, firstTo: 99, maxRounds: 2, suddenDeath: false }), [0, 1]);
  eq('no sudden death', [s.over, s.winner], [true, -1]); }

// A clock ends the match early.
{ const m = createMatch({ seats: 2, firstTo: 3 }); play(m, [1]);
  eq('settleNow', [m.settleNow().winner], [1]); }

// Nothing counts after the end, and the log has every round.
{ const m = createMatch({ seats: 2, firstTo: 1 }); play(m, [1]);
  eq('end after over', m.end(0).wins, [0, 1]); eq('log', m.log.rounds.length, 1); }

console.log(fail ? `MATCH TESTS FAIL — ${fail} failed, ${pass} passed` : `MATCH TESTS PASS — ${pass}`);
process.exit(fail ? 1 : 0);
