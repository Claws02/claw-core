# Mini Golf course rework — design brief (one course per designer)

You are redesigning ONE course (9 holes) of a 3D mobile mini golf game (Three.js, data-driven holes,
deterministic physics). The owner's verdict on the current courses: "too simple — none tell that this is
the best mini golf game." He wants every hole to feel like a real, premium mini golf hole with
**truly difficult choices**. His examples: choose to bounce/bank off things; choose between three pipes
where one leaves you much closer to the cup than the others; more trick-shot opportunities.

## What you may edit
- ONLY your course file: `/home/user/hbd-sub/src/claw-core/minigames/golf/courses/<course>.js`
  (it exports `COURSE` — the course and its 9 holes — and `CHALLENGES`, its trick-shot challenges).
- Do NOT edit Physics.js, Build.js, Toys.js, Moving.js, MiniGolf.js, Courses.js, Lint.js, the qa/ probes,
  or another course's file. Other designers are editing the other course files at the same time.
- Do NOT commit or push. The lead integrates.
- If you need an engine feature that doesn't exist, don't hack around it: list it in your report.

## Read first
- `golf/Courses.js` header (hole format), `golf/Physics.js` compile() doc comment (~line 95–120) and SURFACE /
  HAZARD / MATERIAL tables (~line 50–80), `moverWalls` doc (~line 335) for movers.
- `golf/Build.js` PROPS (`const PROPS = {`) for prop types, and `golf/Lint.js` (FOOT / ON_COURSE) for
  which props are allowed on the course and their footprints.
- Your current course file, and the other three course files for what already exists (don't duplicate a
  centrepiece another course uses the same way).

## The toolbox (all exists today)
Floors: tiles with height `y`, `slope:[gx,gz]`, `hills`, `ridges` (whoops), `trough` (half-pipe), kinds
turf/sand/ice/wood/metal/carpet/felt/rough/puddle/boost(+boost vector)/conveyor(+flow)/creek(+flow)/jelly
(throws the ball up)/bouncy; hazards water/lava/flowers/void/goo (stroke + back to the shot's spot).
Kicker ramps: `kick(x0,z0,x1,z1,dir,y0,g)` from `./kit.js`. Moving floors: raft (`move`), drawbridge
(`lift`), turntable (`spin`), see-saw (`tilt`), lift (`elev` + `liftgate` movers). Walls at ANY angle
(`walls: [[x1,z1,x2,z2,h,mat]]`) — use them for bank shots and deflectors. Blocks. Bumpers (pegs, kick
bumpers, `jit` for plinko scatter). Movers: windmill, sweeper (arms, r0 gap ring), slider, gate (laser),
hammer, liftgate. Fans (wind fields), magnets (pull), mines (blast), pipes (`a` mouth → `b` exit, `dir`,
`out` speed, `style` hose/cannon/teleport/burrow, `color` to tell several pipes apart, `stop: true` = shot
ends at the exit, `max`), loops / corkscrew slides, `gravity` multiplier, multi-level layouts (tiles stacked
at different heights; a ball bounces off the sides of higher tiles — every tile is solid down to the
ground), `start: 'ledge'|'ramp'|'slide'|'jump'|'plank'|'none'` = an elevated starting deck added in front of
the tee (only where it adds something). `norest: true` on a tile = a ball can't stop there (goes back to
its shot's spot). Note the ground plane sits at y = −0.7: keep floors above that.

## The bar for every hole
1. **A real decision from the tee**: at least two genuinely different lines with clear risk/reward —
   e.g. safe long way (+1 stroke) vs a risky shortcut (bank, jump, pipe, gap, timing). Both must be
   actually playable; the risky one must save a stroke when it works and cost one when it doesn't.
2. **Skill, not luck**: banks off angled walls, timing through movers, weight control on slopes/ice,
   reading breaks. Avoid holes where one straight full-power shot is the answer.
3. **At least 3 holes per course with a "pick a pipe/portal" choice or a bank-shot puzzle** (e.g. three
   colour-coded pipes: one drops you by the cup, one mid-way, one back near the tee — make it readable:
   colour + placement give a hint, not a coin flip).
4. **Trick-shot opportunity** on most holes: a long bank ace line, a kicker jump, a pipe ace.
5. **Variety**: each hole has its own centrepiece; no two feel the same; mix lengths (par 2–6), shapes
   (doglegs, splits, islands, multi-level), and pacing. Bigger is fine (holes up to ~40 × 30 units).
6. **Feel like the course's world** (theme props, surfaces that fit).
7. **Fair**: no softlocks (nowhere a ball can stop that it can't be played from — use `norest` or rails),
   no hidden instant losses, the cup reachable by a sane route.

## Must pass before you report
- Clash checker: `node minigames/golf/tools/lint.mjs <course>` → 0 errors, 0 warnings.
- Bot playtest: `node minigames/golf/tools/solve.mjs 0.55 6 <keys,comma,separated>` (skill, trials, holes). At skill 0.55
  each hole's average should land around par to par+1.5; no hole may hit the 10-stroke cap regularly.
  Also run skill 1.0 (`solve.mjs 1.0 3 <keys>`) — a near-perfect player should beat or make par.
  `node minigames/golf/tools/trace.mjs <key> <skill>` prints the bot's shots for one hole (debugging).
  (The bot plans with the real physics; if it can't find your clever line, that's fine as long as the hole
  is playable — but a route nobody can execute is a design bug.)
- Trick-shot challenges for your course: `node minigames/golf/tools/chal.mjs <course>` → each 1–8%. Keep/redo the
  course's CHALLENGES so each still exists (from/zone valid) — add a new one or two if you create great
  trick shots (ids unique, `course` and `key` set).
- Screenshots: start your own server once in the background
  `cd /home/user/hbd-sub && python3 -m http.server <PORT> --bind 127.0.0.1` (your port is in your prompt),
  then `cd /home/user/hbd-sub && QA_BASE=http://127.0.0.1:<PORT>/index.html KEYS=<keys> node qa/golfshots.js <course> <outdir>`
  (tee view + overhead map per hole; outdir in the scratchpad). LOOK at them (montage with
  `montage a.png b.png -tile 4x2 -geometry 240x+3+3 sheet.png` to save tokens). Fix anything that looks
  wrong (floating props, z-fighting, unreadable layout, things the camera can't show). Expect "36/36"
  style line to say all your holes built and "no console/page errors".

## Report (final message, concise)
Per hole: key, name, par, the decision(s) it offers, its trick shot, bot avg at 0.55 and 1.0. Then:
challenge % list, lint result, any engine features you wish existed, and any hole keys you renamed or
whose geometry changed in a way a probe might rely on (keys used by probes: windmill, pool, bunker, skate,
cannon, maze, slide, powder, donut, hub, river, plinko, skull, raft — prefer keeping these keys).
