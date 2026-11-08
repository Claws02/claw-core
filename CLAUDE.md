# claw-core — context for Claude

The shared minigame engine behind **HundredBlockDash** and **CLAWGames**: 43
live minigames, `MinigameManager`, the 3D stage kit, character models/rig,
and phone-to-phone net transport. Not an app: mounted as a submodule at
`<app>/src/claw-core`. three.js **r128** and cannon.js 0.6.2 as globals
(`THREE`, `CANNON`), plain ES modules, no build.

## The contract (read README.md "The contract" before touching imports)

Core files import each other and `../../AppHost.js` (the app's file). Nothing
else. Every new AppHost name is debt: the direction is to shrink that table.

## Verify

There is no runner here: claw-core is tested **through both apps**.
1. Commit here on a branch.
2. In HundredBlockDash and CLAWGames, point the submodule at it and run their gates
   (`bash qa/parsecheck.sh src` + the probes for the games you touched in HBD;
   `npm run smoke` + `node qa/<game>.js` in CLAWGames).
3. Golf: `node minigames/golf/tools/lint.mjs` and `solve.mjs` for course changes.
4. Merge here, then bump both apps' pointers.

## Map

| Path | What |
|---|---|
| `config/MinigameRegistry.js` | catalogue: `MG_INFO`, profiles, surfaces, `MG_NET` (parallel games), `blockedReason` |
| `config/MinigameLayout.js` | seat geometry |
| `minigames/MinigameManager.js` | runs a game; `triggerStandalone(type, isBot, seats, opts)` |
| `minigames/SoloArena.js` | parallel online play: `Solo.isSolo/draw/rand/soloFinish/ghostSend` |
| `minigames/_template.js`, `_template3d.js` | start every new game from these |
| `minigames/<Game>.js` | one file per game |
| `minigames/golf/` | Mini Golf's own engine, courses, bot, and tools |
| `engine/` | Stage, StageKit (`touch`, HUDs), StageDirector, StageSets, CharacterModels/Rig, AudioManager (all tuned sfx), Ghosts |
| `net/` | NetTransport (Trystero), LoopbackStrategy (same-browser rooms for QA) |

## Rules

- Rules a game must meet: HBD `docs/MINIGAME_STANDARD.md` §2 and §8. Build style: HBD `docs/MINIGAME_3D_PLAYBOOK.md`. Read those, not each other's games.
- Anything a score depends on uses `Solo.draw(i)` (same on every phone); `Math.random` only for cosmetics.
- Converting a game to parallel: follow README "Converting a game" exactly (Balloon Pump is the reference).
- `_`-prefixed file-private helpers (both apps' parsecheck relies on it).
- r128 globals stay until a planned migration (lights/colour semantics change at r152/r155; every game needs a visual pass). Don't mix in ES-module three.

## Token rules

- To learn the game shape, read `_template3d.js` + one reference game, not several.
- `minigames/PLAN.md` and `golf/PLAN.md` are plans. Read them only for that work.
