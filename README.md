# claw-core

The shared minigame engine behind **HundredBlockDash** and **CLAWGames**: 43
live minigames, the manager that runs them, the 3D stage kit, the character
models and rig, and the phone-to-phone network transport.

It is not an app. It is mounted into one as a git submodule and talks to that
app through a single file.

## Layout

```
config/     MinigameRegistry (catalogue, profiles, surfaces), MinigameLayout (seat geometry)
engine/     Stage, StageKit, StageDirector, StageSets, CharacterModels, CharacterRig, AudioManager
minigames/  MinigameManager, SoloArena, and one file per game
net/        NetTransport (Trystero WebRTC), LoopbackStrategy (same-browser rooms, for QA)
```

## Mounting it in an app

```
<app>/
  src/AppHost.js        ← the app's side of the contract (below)
  src/claw-core/        ← this repo, as a submodule
  vendor/three.min.js   ← three.js r128, loaded as the global THREE
  vendor/cannon.min.js  ← cannon.js 0.6.2, loaded as the global CANNON
  vendor/trystero-nostr.min.js, vendor/trystero-torrent.min.js   ← only if the app opens online rooms
```

```sh
git submodule add https://github.com/Claws02/claw-core src/claw-core
git submodule update --init          # after a fresh clone
git submodule update --remote        # take the latest core
```

Everything is plain ES modules served as static files: no bundler, no build
step. CI that checks the app out needs `submodules: true` on
`actions/checkout`.

## The contract: `src/AppHost.js`

Core files import each other and `../../AppHost.js` (that is, the app's
`src/AppHost.js`). Nothing else. Each app provides these names:

| Name | What the core uses it for |
|---|---|
| `state` | the live game state: `players`, `mgActive`, and friends |
| `playerCount`, `setPlayerCount` | how many seats are in the room |
| `Bot` | bot opponents; the core asks `Bot.skill()` |
| `DualRead` | tabletop mirror mode (cards readable from both ends of the phone); a stub that says "off" is fine |
| `loadUIManager()` | lazy import of the app's UI; the core calls `updateUI` and `animateCoinDisplay` after a payout |
| `PROP_KIT` | roadside scenery for stage sets; a factory returning empty groups is fine |
| `setBoardPaused(on)` | pause the app's own renderer while a 3D stage owns the GPU |
| `DISTRICT_BIOMES`, `HBD_BIOMES` | colours and names the stage sets are dressed from |
| `MINIGAME_REWARD`, `MINIGAME_PLACE_COINS` | payouts, read only on HundredBlockDash's board path |
| `NET_APP_ID` | the signaling namespace online rooms live in; one per app, never changed after release |
| `RELEASE` | `{ version, turnServers }` |

HundredBlockDash re-exports its real modules; CLAWGames supplies small
stand-ins. Both files are short and are the best reference.

Shrinking this table is the long-term direction: every row is a piece of the
board game the minigames still reach into.

## Running a game from an app

```js
import * as MinigameManager from './claw-core/minigames/MinigameManager.js';
MinigameManager.triggerStandalone(type, isBot, seats, {
    bots,                                   // per-seat bot flags
    onComplete(winnerId, standings) {},     // winnerId -1 = draw
});
```

`MG_PROFILE` / `surfacesOf` / `blockedReason` in `config/MinigameRegistry.js`
say which games can run at which seat count. `MG_NET[type] === 'parallel'`
games can be played one phone each through `SoloArena.play(type, seed, onScore)`.

## Rules for changes here

- A change lands here once and reaches both apps. Run both apps' QA before
  moving either app's submodule pointer.
- No imports outside this repo except `../../AppHost.js` and the vendor
  scripts listed above.
- Speeds are units per second, `dt` capped at 0.1 s. Every game cleans up after
  itself through `registerMinigameCleanup`.

The CSS for the minigame overlays still lives in the apps (HundredBlockDash's
`css/styles.css`, copied into CLAWGames as `css/core-minigame.css`); moving it
here is the next step.
