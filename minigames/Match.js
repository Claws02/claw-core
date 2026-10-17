// ============================================================
// MATCH — the rounds a minigame is played in, in one place.
//
// A game that is played in rounds asks this for the rules of the match and
// keeps only its own round: "a round starts" and "this seat won it" (or
// nobody did). Match counts the wins, says when the match is over and who won
// it, and names the round that is coming: ROUND 2, MATCH POINT, FINAL ROUND,
// SUDDEN DEATH. No DOM, no timers: the game draws it however it likes.
//
//   const m = createMatch({ seats: 2, firstTo: 2 });       // best of 3
//   m.begin();            // → { round: 1, label: 'ROUND 1', ... }
//   m.end(winnerSeat);    // → { over: false, ... }  (-1 = nobody took it)
//   ...                   // → { over: true, winner: 0, wins: [2, 1] }
//
// The rules, so every game agrees on them:
// - firstTo N wins the match outright.
// - A round nobody wins (a void: both crashed, both flinched) does not count
//   toward maxRounds, so a best of 3 is three DECIDED rounds. hardCap is the
//   ceiling on all rounds, voids included, so a match can't run forever.
// - After maxRounds decided rounds the most rounds won takes it. Level at the
//   top: SUDDEN DEATH rounds, one at a time, until somebody wins one (or the
//   hard cap, which is a draw). suddenDeath: false makes level a draw instead.
// - At 3-4 seats the same holds: firstTo, then most wins, ties share.
//
// window.__mgMatch keeps the last match's log ({ type, rounds: [...], winner })
// for qa/matchlab.js in CLAWGames: lead changes and deciders come from it.
// ============================================================

/** Best of N as firstTo: best of 3 → 2, best of 5 → 3. */
export const bestOf = n => Math.floor(n / 2) + 1;

/**
 * @param {object} o
 * @param {number} o.seats        2-4
 * @param {number} o.firstTo      wins needed to take the match
 * @param {number} [o.maxRounds]  decided rounds before it settles on most wins (default 2·firstTo−1)
 * @param {number} [o.hardCap]    all rounds, voids included (default maxRounds + 4)
 * @param {boolean} [o.suddenDeath=true]  level after maxRounds → one more round at a time
 * @param {string} [o.type]       the game, for the QA log
 */
export function createMatch(o) {
    const seats = Math.max(1, o.seats | 0);
    const firstTo = Math.max(1, o.firstTo | 0);
    const maxRounds = o.maxRounds ?? (2 * firstTo - 1) * (seats > 2 ? seats - 1 : 1);
    const hardCap = o.hardCap ?? maxRounds + 4;
    const suddenDeath = o.suddenDeath !== false;
    const wins = new Array(seats).fill(0);
    const log = { type: o.type || '', seats, firstTo, rounds: [], winner: undefined };
    let round = 0, decided = 0, over = false, winner = undefined;

    const top = () => {
        const best = Math.max(...wins);
        return wins.reduce((a, w, i) => (w === best ? a.concat(i) : a), []);
    };
    const leader = () => { const t = top(); return t.length === 1 ? t[0] : -1; };
    const sudden = () => decided >= maxRounds && top().length > 1;
    /** Seats that take the match if they win the next round. */
    const onMatchPoint = () => {
        if (over) return [];
        if (sudden()) return top();
        const pts = [];
        for (let i = 0; i < seats; i++) {
            if (wins[i] + 1 >= firstTo) { pts.push(i); continue; }
            // Last decided round: winning it leaves you alone on top.
            if (decided + 1 >= maxRounds) {
                const after = wins.map((w, j) => (j === i ? w + 1 : w));
                const best = Math.max(...after);
                if (after[i] === best && after.filter(w => w === best).length === 1) pts.push(i);
            }
        }
        return pts;
    };

    function label() {
        if (sudden()) return 'SUDDEN DEATH';
        const mp = onMatchPoint();
        if (decided + 1 >= maxRounds && mp.length === top().length && mp.length > 1) return 'FINAL ROUND';
        if (mp.length) return 'MATCH POINT';
        return `ROUND ${round + 1}`;
    }

    function settle(w) {
        over = true; winner = w; log.winner = w;
        return state();
    }

    function state() {
        return {
            round, decided, wins: wins.slice(), over, winner,
            leader: leader(), matchPoint: onMatchPoint(), sudden: !over && sudden(),
            label: over ? (winner < 0 ? 'DRAW' : 'MATCH') : label(),
        };
    }

    const m = {
        firstTo, maxRounds, hardCap, seats,
        get round() { return round; },
        get wins() { return wins.slice(); },
        get over() { return over; },
        get winner() { return winner; },
        leader, onMatchPoint, state,
        /** The label for the round about to start, then counts it as started. */
        begin() {
            const s = { ...state(), label: label(), round: round + 1 };
            round++;
            return s;
        },
        /** The round just played went to `w` (a seat), or -1 for nobody. */
        end(w) {
            if (over) return state();
            const valid = Number.isInteger(w) && w >= 0 && w < seats;
            if (valid) { wins[w]++; decided++; }
            log.rounds.push({ round, winner: valid ? w : -1, wins: wins.slice() });
            if (valid && wins[w] >= firstTo) return settle(w);
            if (round >= hardCap) return settle(leader());
            if (decided >= maxRounds) {
                const l = leader();
                if (l >= 0) return settle(l);
                if (!suddenDeath) return settle(-1);
            }
            return state();
        },
        /** End the match now (a clock ran out): most rounds won, level = draw. */
        settleNow() { return over ? state() : settle(leader()); },
        log,
    };
    try { if (typeof window !== 'undefined') window.__mgMatch = log; } catch (e) {}
    return m;
}
