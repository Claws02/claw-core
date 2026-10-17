# Mini Golf — how we work, where it stands, where it's going

The living plan for the Mini Golf game (claw-core `minigames/MiniGolf.js` + `minigames/golf/`).
Read this first in a new chat. Update it when a phase finishes.

---

## 1. How we work together

**Roles.** Caleb is the owner and play-tester: he plays on a phone and gives feedback, usually
per hole, and makes the calls on direction. Claude is the senior pair programmer: it scopes the
work, builds it, verifies it, ships it, and reports in plain language.

**The loop (every change):**
1. **Feedback in.** Caleb plays and sends notes ("hole X: …").
2. **Scope.** If there's a real fork (feel, scale, rollout), Claude asks 2–4 tappable questions,
   each with a recommended option. Otherwise it just builds.
3. **Build** on a fresh branch from `main` in claw-core.
4. **Verify** (the gates below). Fix anything red before pushing.
5. **Ship:** one PR per repo, merged in this order:
   - claw-core first;
   - then HBD (`src/claw-core` submodule bump, plus probe updates);
   - then CLAWGames (submodule bump).
6. **Caleb merges and rebuilds CLAWGames:**
   `git pull && git submodule update --init && npm run build:web`. Then he play-tests, and back to 1.
7. **Rollout:** big changes go one course first ("engine + Backyard"), play-test, then the rest.

**Rules learned the hard way:**
- **Never push to a branch whose PR is already merged.** Open a new branch and PR. (CLAWGames #22
  merged early and missed three bumps; #24 fixed it.)
- **Bump the submodules in HBD *and* CLAWGames every time claw-core changes**, or the app won't
  show the change.
- **Token discipline:**
  - no parallel agents unless asked;
  - targeted checks, not full sweeps;
  - commit and push as you go;
  - short status updates;
  - start a new chat when the context gets long.
- **Report honestly:** say what was verified (and how) and what wasn't, e.g. feel on a real phone.

**Verification gates** (tools live in `minigames/golf/tools/`; run from the claw-core root):

| Gate | Command | Pass |
|---|---|---|
| Clash checker | `node minigames/golf/tools/lint.mjs <course>` | 0 errors, 0 warnings |
| Bot playtest | `node minigames/golf/tools/solve.mjs 0.55 6 <keys>` and `… 1.0 3 <keys>` | 0.55 ≈ par…par+1.5, no regular 10-caps; 1.0 ≤ par |
| One hole, shot by shot | `node minigames/golf/tools/trace.mjs <key> <skill>` | (debugging) |
| Trick-shot challenges | `node minigames/golf/tools/chal.mjs <course>` | each 1–8% |
| Screenshots | in HBD: `QA_BASE=http://127.0.0.1:<port>/index.html KEYS=<keys> node qa/golfshots.js <course> <outdir>` | builds, no console errors, looks right |
| HBD probes | `qa/minigolf.js`, `qa/golfmotion.js` (static server on the HBD root) | no FAIL |
| CLAWGames probe | `node qa/golf.js` (static server on :8140) | 27/27 |

`tools/DESIGN-BRIEF.md` is the bar every hole must meet:
- a real decision from the tee;
- skill, not luck;
- a trick shot;
- fair, with no softlocks;
- themed.

---

## 2. Where it stands (Oct 2026)

**Shipped** (claw-core main, HBD main):
- **Four courses, 36 holes:** Backyard, Pirate Cove, Candy Land, Space Station.
- **Game modes:** turns, chaos (shared phone, or one ball per phone), solo vs par, and a trick-shot
  challenge mode with stars.
- **v6 per-hole feedback on all 36 holes**, including:
  - shuffled teleporters and scatter cannons;
  - a ride-in cannon;
  - a real loop-de-loop;
  - the rebuilt chocolate river;
  - the anti-grav lift;
  - black holes;
  - new visuals.
- **Camera:** pulls back over the hole while you ride a cannon.
- **Controls:**
  - press the ball and pull back to shoot;
  - swipe anywhere else to orbit and tilt the camera;
  - a tapered power band stretching back from the ball, with haptic ticks and finer control at low
    power.
- **Bigger courses:** `course.scale` grows a course in 3D, with speeds and times scaled by √scale,
  so every line plays the same at the bigger size. **Backyard is at 1.5×.**
- **Physics fixes:** creeks carry the ball until it leaves them, and lifts carry it until their
  door opens.

**Waiting to merge:**
- claw-core #29: a ball pinned on a conveyor rail goes back to its shot spot.
- CLAWGames #25 and HBD #121: the matching submodule bumps.
- claw-core: this plan, and the test tools moved into the repo.

---

## 3. Open items

**Needs Caleb (play-test on a phone):**
- [ ] 1.5× Backyard: does the bigger size and longer hitting feel right? This decides scaling the
      other courses.
- [ ] The new controls: does press-the-ball vs swipe-to-look ever misfire? Is the power band
      readable? Do the haptics help?
- [ ] Low-power putting feel (the curve is `0.35u + 0.65u²`).
- [ ] The Cargo Bay belt fix, once #29 and #25 are merged.

**Known weak spots** (bot data, re-measured 2026-10-17 at 20 trials a hole; 6–10 trials is
too noisy to call a hole: Black Holes read 5.2 at 10 trials and 3.8 at 24):
- **Fixed 2026-10-17:** Bouncy Castle 5.5 → 3.25 (a rubber runway, lower turret, domed pad, back
  wall; Turret challenge 1.0%). Black Holes 5.25 → ~4.0 (smaller pull radius, rear hole by the
  hull; Slingshot 1.0%). Walk the Plank 5.6 → 4.6 (a dock-end rail so the tee shot can land on
  the dock, and a bot fix below).
- **Bot fix:** the bot's "is this shot too risky for me" check only looked 7 s ahead, so long
  hero lines that miss into water late looked safe. It looks 12 s now. Course totals at 0.55:
  Backyard 33.7 → 31.4, Pirate 38.9 → 33.8, Candy 32.7, Space ~37; 10-caps across 36 holes 10 → 3.
- **Still above par+1.5 or capping now and then:** Airlocks (5.5 on par 5, fine), Solar Wind
  (one cap in 20 with either bot), Rockery and Moon Craters (~par+1.6). Worth a pass, not urgent.
- **Chaos mode at 1.5×:** the balls get smaller on a shared screen. Check readability.

**Housekeeping:**
- [ ] Republish the course showcase artifact; the last one was v5.
- [ ] Task #36 (other games): solo roster phase 2 is still pending.

---

## 4. Next steps (in order)

1. **Merge** claw-core #29, then CLAWGames #25 and HBD #121, plus the plan/tools PR. Rebuild
   CLAWGames.
2. **Play-test Backyard at 1.5×** for about 20 minutes and send per-hole notes.
3. **On a go, scale the other three courses**, one course per PR, re-tuned to the gates:
   - Pirate Cove (`scale: 1.5`): check its sea/beach ground plane and scenery against the
     pulled-back camera, the same issue Backyard's lawn and house had.
   - Candy Land.
   - Space Station.
4. **Fix the weak spots** in §3 (Castle first).
5. **Use the new room:** one *showpiece* trick-shot hole per course (a long bank ace, a multi-jump
   line, a cannon-to-cup) plus 1–2 new challenges per course.

---

## 5. Making it the best mini golf game ever (roadmap)

**A. Feel: the shot is everything.**
- Tune the putt curve and the band with real-phone feedback.
- Make camera transitions buttery.
- Give a subtle "perfect line" cue only on a great shot (no guidance before it).
- Slow-motion and an orbiting camera on holes-in-one and lip-outs.
- Instant replay of the last great shot.

**B. Holes people talk about.** Every hole has:
- one clear decision;
- one trick shot;
- one moment that makes you laugh (the cannon lottery, the kraken swat, the black-hole slingshot).

Also:
- vary pars (2–6) and lengths;
- a showpiece per course;
- re-tune against the brief after every scale or physics change.

**C. Juice and atmosphere:**
- course music and ambient sound;
- impact sounds per surface;
- a crowd/announcer for birdies, eagles and aces;
- ball trails and celebration effects;
- weather or day-night variants per course.

**D. Reasons to come back:**
- stars per hole;
- a daily challenge hole with a seeded layout (teleporter shuffles and scatter cannons already
  use seeds);
- a trick-shot ladder;
- personal-best ghosts;
- cosmetic balls, hats and trails unlocked by play;
- local leaderboards per course.

**E. Play together:**
- polish party and chaos fairness at the bigger scale;
- quick rematch;
- a "best shot of the round" reel at the end;
- easy phone-to-phone joining.

**F. More world (later):**
- a 5th course (ideas: Haunted Mansion, Volcano, Arcade, Winter);
- seasonal hole swaps;
- possibly a simple hole editor, since holes are already data.

**G. Quality floor (always):**
- 60 fps on mid-range phones (auto quality);
- no softlocks: every resting place is playable or sends you back;
- readable at a glance;
- an onboarding hole that teaches press-pull-release and swipe-to-look in 20 seconds;
- accessibility: colour-blind-safe markers, left-handed friendly.

---

## 6. Kickoff prompt for a new chat

> Mini Golf in claw-core. Read `minigames/golf/PLAN.md` first (how we work, open items, next
> steps), then `minigames/golf/tools/DESIGN-BRIEF.md`. Repos: claws02/hundredblockdash (HBD,
> claw-core at `src/claw-core`), claws02/clawgames, Claws02/claw-core. Today: <what you want>.
