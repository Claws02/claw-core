# The minigame roster — how we make all 43 games better

The living plan for every game in claw-core (Mini Golf keeps its own detailed plan in
`golf/PLAN.md`). Read this first in a new chat. Update it when a phase finishes.

Kickoff prompt:

> claw-core minigames. Read `minigames/PLAN.md` (and `minigames/golf/PLAN.md` for golf).
> Repos: claws02/hundredblockdash (HBD, claw-core at `src/claw-core`), claws02/clawgames,
> Claws02/claw-core. Today: <what you want>.

---

## 1. Decisions (Caleb, 2026-10-17)

| Fork | Call |
|---|---|
| "Best of 5 framework" means | **In-game rounds.** One shared match module in claw-core that every round-based game uses. |
| Order of work | **Measure, then worst-first.** A bot-vs-bot harness scores every game, and the worst get fixed first, in batches. |
| Architecture appetite | **Incremental.** Keep one file per game behind AppHost. Add shared helpers and adopt them game by game. |
| Golf | **First.** Finish its §4 next steps before the roster pass. |

---

## 2. Architecture review: is the setup right?

**Verdict: yes. Keep the shared-core submodule. Fix three costs inside it.** [rec]

What's right:
- **One core and two apps** (HBD board game, CLAWGames arcade) behind one `AppHost.js` contract.
  A game fix lands once and reaches both apps.
- **No build step.** Plain ES modules plus vendored three/cannon is cheap to run, and Playwright
  probes drive the real thing.
- **One file per game with a common lifecycle** (`start(isBot, onWin, botSkill)`, R1–R7 in HBD
  `docs/MINIGAME_STANDARD.md`). It's easy to reason about one game at a time.

What it costs, and the fix for each:

| Cost | Evidence | Fix |
|---|---|---|
| **Every game re-implements its match format** | 20+ hand-rolled `WIN_ROUNDS` / `MAX_ROUNDS` / `ROUNDS` / `SUDDEN_MAX` constants. Only HighNoon has a round-result banner. Pips, match point and tiebreaks are inconsistent or missing. | **`minigames/Match.js`**: best-of-N / first-to-N / fixed-N-rounds / timed, plus draws, voids, a round cap, sudden death and a shared round banner with pips. Each game supplies "play one round, tell me who won". |
| **Nothing measures whether a game is good** | Golf has a solver/lint/challenge loop. The other 42 only have "does a bot game finish" (HBD `botcheck.js`). | **Match lab** (`CLAWGames/qa/matchlab.js`): headless bot-vs-bot matches per game, logging length, rounds, final margin, lead changes, stalls and errors. It outputs a scorecard. |
| **Three PRs for every core change** (claw-core, then HBD, then CLAWGames) | The golf plan's "rules learned the hard way" | Batch the work: **one core PR per batch of games, then one bump each in HBD and CLAWGames.** |

Deferred (still right, not now): the `MinigameHost` contract migration (games stop reading
global `state`), per-seat bot skill (the core asks for one `Bot.skill()` per table), moving the
minigame CSS and markup out of the apps into the core.

---

## 3. The process (every game, every batch)

The golf loop, generalized:

1. **Measure.** Run the match lab on the batch to get the "before" numbers.
2. **Read and play.** Read the game's code. Check the format, the bot, the end conditions and the
   feel against the rubric (§4).
3. **Fix**, smallest first:
   correctness (softlocks, wrong winner, stuck states) →
   match format (move it onto `Match.js`) →
   bot (does it play, and does skill matter?) →
   engagement (comebacks, tension, juice).
4. **Re-measure.** The batch must pass the gates (§5), and the "after" numbers must beat "before".
5. **Ship.** One claw-core PR per batch of about 4 games, then the HBD and CLAWGames submodule
   bumps. Caleb merges, rebuilds and play-tests the batch, and his notes feed the next pass.

**Order:** worst-first by the scorecard. Correctness bugs jump the queue.

---

## 4. The rubric (what "engaging and correct" means)

| # | Check | Measured by |
|---|---|---|
| C1 | Always ends, with the right winner, and never softlocks | match lab: errors / stalls / watchdog |
| C2 | Draws and ties are handled on purpose (tiebreak or shared result) | code read + match lab |
| C3 | Cleans up (R3), no console errors | match lab |
| F1 | **Format fits the game.** Short reflex games are best of 5 (first to 3); longer bouts are best of 3; long single contests (golf, bowling, races) stay one match | `Match.js` config |
| F2 | **Match length is 45–120 s** for a duel | match lab |
| F3 | **Close and comeback-able.** The leader can be caught: a decent share of matches go the distance, and a match point is a real moment | lead changes, decider %, margin |
| F4 | **Skill decides.** A bot beats an idle player nearly always; Hard beats Easy most of the time | match lab (bot vs idle; per-seat skill later) |
| F5 | **Readable.** Round banner, score pips, who's winning, match point and the winner, all at a glance | `Match.js` banner + screenshots |
| F6 | **Juice.** Hit-stop, shake, particles and sound on the moments that matter | code read + screenshots |

---

## 5. Gates

| Gate | Command | Pass |
|---|---|---|
| Parse check | in HBD: `bash qa/parsecheck.sh` | clean |
| Match lab | in CLAWGames: `node qa/matchlab.js [games] [runs]` (static server on :8140) | no errors / stalls; F2/F3 in band, or noted |
| Game probes | HBD `qa/<game>.js` where one exists; CLAWGames `npm run smoke` | no FAIL |
| Golf | `golf/PLAN.md` gates | as listed there |

---

## 6. Phases

| # | Phase | Exit |
|---|---|---|
| 0 | **Golf weak spots** (Castle, Black Holes, then the 10-caps). Course scaling waits on Caleb's 1.5× Backyard play-test. | Castle/Black Holes at ≤ par+1.5 at skill 0.55; Turret challenge ≥ 1% |
| 1 | **Match lab v1**, then the **scorecard** for all 43 games | `docs`-style table below, filled in |
| 2 | **`Match.js` v1**, piloted on 2–3 round-based games | Same behaviour or better, gates green |
| 3 | **Batches, worst-first**: about 4 games per PR | Each batch passes the gates; Caleb play-tests |
| 4 | Juice kit, per-seat bot skill, onboarding hints | later |

---

## 7. Status

- [x] Plan written (this file)
- [x] Phase 0: golf weak spots: Castle, Black Holes, Walk the Plank fixed, plus a bot risk fix (`golf/PLAN.md` §3)
- [ ] Phase 1: match lab plus scorecard
- [ ] Phase 2: `Match.js` pilot: built and tested (22 checks); Express, Light Cycles, Lily Pad, Rooftop Run moved onto it, browser check pending
- [ ] Phase 3: batches

### Scorecard

(Filled in by phase 1.)
