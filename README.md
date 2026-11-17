# solmar-open-world
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Razerjrs/solmar-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Razerjrs/solmar-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR** is an original 2D top-down open-world crime game in the spirit of GTA 1/2: a sun-soaked coastal city to explore on foot and by car, with traffic, pedestrians, a wanted level and police who respond, six story missions for the fixer Mara Voss, combat, progression and a live minimap — all in plain canvas JavaScript with no libraries and no network requests.

## The city

Solmar is a grid of avenues and streets across five districts — Hillside, Old Port, Downtown, Marina and Beachfront — with parks, a plaza, palm-lined sand and open water along the south edge. Traffic follows the roads and stops at red lights; pedestrians walk the sidewalks and run from trouble.

## What you can do

- **On foot:** walk and run, punch rivals and cops, steal parked and driven cars.
- **By car:** six vehicle types (sedan, taxi, truck, sports, van, police interceptor), each with its own speed, acceleration and handling. Handbrake turns, skid marks, damage and smoke.
- **Wanted level 1–5 stars:** crimes raise it; patrol cars chase and ram, foot cops close in and arrest. Break line of sight and stay quiet to cool down.
- **Missions:** six jobs with dialogue, objectives, timers and cash rewards — a first car theft, a courier run, a getaway, a turf sweep, a hot-cargo delivery and the big score.
- **HUD:** live minimap with player, police and mission markers, wanted stars, cash, health, speed, mission tracker and district banners.
- **Sound:** synthesized WebAudio effects (engine, sirens, punches, pickups) and a procedural music loop, with a mute toggle.
- **Save:** progress autosaves after every mission (and with K); continue from the title screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| E | Enter / exit car |
| F or click | Punch (toward the mouse) |
| Space | Handbrake |
| Esc / P | Pause |
| M | Mute |
| K | Save |
| R | Restart after game over |
| C | Continue a saved game |

## Run it

Open `game/index.html` in a desktop browser, or serve the folder and open it:

```sh
node serve.ts
# then open http://localhost:8080
```

## Layout

- `game/src/config.js` — tuning, palette, vehicle types, districts
- `game/src/random.js` — seeded random numbers
- `game/src/world.js` — the city: streets, blocks, buildings, parks, beach
- `game/src/state.js` — the game state and its fixed-step update
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized sound and music
- `game/src/player.js` — walking, punching, getting in and out of cars
- `game/src/vehicles.js` — car physics, damage, collisions
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — the wanted level and the police force
- `game/src/combat.js` — punches, knockback, car-vs-pedestrian hits
- `game/src/missions.js` — the six-story mission chain
- `game/src/hud.js` — HUD, dialogue, menus
- `game/src/minimap.js` — the live minimap
- `game/src/render.js` — the camera and everything drawn
- `game/src/shots.js` — the deterministic screenshot scenes
- `game/src/main.js` — boot and the game loop
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

<sub>Entered on [make.fun](https://make.fun/?ref=1v039b2j&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
