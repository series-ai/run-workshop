# Trainspotter: source

The procedural source for **Trainspotter**, a voxel railway kit for the RUN asset library
(`run-trainspotter/3D/vehicles-racing` in jam-ready-assets): locomotives, carriages and
wagons, modular track that snaps together, stations, platforms and signals, plus a three.js
helper that lays track and runs trains over it. It is built in Blender on the voxel-pack
pipeline (`tools/run-voxel-packs/blender`), in the same chunky style as the other RUN voxel
packs, without weathering.

Trains follow well-known real types, but every name is a generic description of the type:
no operator, line or maker names, no logos or lettering.

The kit has 148 models: 19 track pieces, 6 bridges and tunnel pieces, 61 locomotives,
carriages, wagons, trams and metro cars, 5 loads, 21 stations, platforms and lineside
structures, 33 props and scenery pieces (signals, trees, town buildings, road vehicles,
people), and 3 board-game tokens.

| Path | What |
|---|---|
| `kit/railkit.py` | the contract (scale, track section, couplers, wheel radii) and the palette |
| `kit/track.py`, `kit/layout.py` | track pieces as exact paths (lines and arcs), the geometry swept along them, and connector maths |
| `kit/running.py`, `kit/stock.py`, `kit/furniture.py` | wheelsets, bogies, steam rods; vehicle assembly and clips; buffers, couplers, underframes |
| `kit/steam.py`, `diesel.py`, `electric.py`, `highspeed.py`, `urban.py`, `commuter.py`, `coaches.py`, `wagons.py`, `loads.py` | the rolling stock, one family per module (`locokit.py`: shared locomotive details) |
| `kit/civil.py` | bridges, piers, and single- and double-track tunnel portals |
| `kit/structures.py`, `stations.py`, `props.py`, `tokens.py` | platforms, stations, signals and lineside props, board-game tokens |
| `kit/scenery.py`, `kit/city.py` | trees, bushes, rocks, a tunnel mountain, peaks, retaining walls; town buildings, roads, cars, a bus, people, street lamps |
| `kit/moving.py` | pantographs and sliding doors with `open` / `close` clips |
| `kit/shapes.py` | body and paint helpers (some adapted from `tools/run-monster-trucks/kit`) |
| `kit/catalog.py` | collects every family's `CATALOG`, and writes the `kit.json` catalogue |
| `kit/build.py` | Blender entry: every model to GLB, plus `kit.json` |
| `kit/render.py` | review renders and contact sheets |
| `lint/lint.py` | contract lint without Blender: track closure, loading gauge, couplers, wheels, colour roles |
| `lint/glb.mjs` | finalizes built GLBs with the pipeline's finalize step, then checks budgets and sockets against `kit.json` |
| `viewer/` | the three.js helper (`train-kit.js`, `trackpath.js`, `train-fx.js`, `driver.js`, `train-audio.js`) and a viewer (`viewer.js` with `viewer.css`, run by `index.html` here and by `games/trainspotter` on RUN; `pretty.js`, `demo.js`, `layouts.js`, `terrain.js`, `grass.js`) that runs trains round demo railways |
| `sounds/` | the sound effects: the recipe (`sounds.json`), generation through asset-bot (`generate.mjs`) and processing to Ogg (`process.py`); `viewer/train-audio.js` plays them for running trains |
| `trailer/` | a 30-second portrait trailer cut to a song: lyric and beat timing (`analyse.py`), the trailer page (`trailer.html`, `trailer.js`) and frame-by-frame capture to MP4 (`capture.mjs`) |
| `pack/pack.mjs` | packages a build into the library leaf, with the helper and the catalogue built in |
| `pack/shots.mjs`, `shots.html` | cover and gallery screenshots (and the audio folder's cover), made with the packaged helper |
| `pack/hero.mjs` | the hero render for the app icon and loading screen: the viewer's full look at golden hour |
| `tests/` | `node --test` for the track and train-following maths, the helper, the effects and the demo layouts |

## The contract

All numbers are voxels; 1 voxel is 1 unit and a person is 36 tall. +Y is up and vehicles
face -Z.

- **Track.** A piece's origin is its connector `a`, on the centre line at ground level; the
  track leaves `a` toward -Z. Connectors carry a heading (degrees about +Y, 0 = -Z) and sit on
  a 32 grid at multiples of 45 degrees, so pieces snap end to end. Rails are 30 apart, the
  rail top is 8 above the ground, one track spacing is 64. Curves turn right; run them from
  `b` to turn left. Switches have two routes, `close` (straight) and `open` (diverging).
- **Vehicles.** The origin is on the centre line in the rail-head plane, midway between the
  two guide points (bogie pivots or outer axles). Couplers are 10 above the rail at the two
  coupler faces, so coupled vehicles meet face to face. Floors are 16 above the rail, level
  with a platform top. Wheel radii are 6, 9, 12 or 18 only, so every wheel turns a whole
  number of times in one 3-second `move` loop.
- **Trackside.** Platforms and stations use the frame of the straight they stand beside and
  build out toward +X; place them with the same transform as that piece.
- **Colours.** Every vehicle has `paint`, `trim` and `accent` ramps that can be swapped at
  runtime; lamps, glass, rails, ironwork and brass use fixed ramps a swap never touches.
  Some vehicles list named presets in `liveries` (for example the commuter cars' line colours).
- **Moving parts.** Doors and pantographs use the `open` / `close` clips; the helper can drive
  them separately (`car.setDoors`, `car.setPantograph`). Switch blades and levers use
  `open` (diverging) / `close` (straight); the turntable bridge turns with its state.
- **Effects.** `TrainFx` (in `train-fx.js`) adds voxel-style particles in the style of the RUN
  voxel packs: steam chuffs timed to the driving wheels, cylinder steam on starting, diesel
  exhaust, pantograph arcs, and wheel sparks when braking or on tight curves.

`kit.json` records all of it: every piece's connectors and routes, every vehicle's couplers,
guides, wheels and colour roles.

## Build and check

Run from this folder. Blender 5.x runs headless; Python 3 with numpy runs the lint.

```sh
npm ci                                   # three.js, playwright-core, tsx
(cd ../run-voxel-packs && npm ci)        # the pipeline's finalize and inspect steps
python lint/lint.py --mesh               # contract lint, no Blender
blender -b -t 1 --factory-startup --python kit/build.py -- --out out/glb [--tier slice] [--only NAME]
npm run check-glb                        # finalize + budgets + sockets vs kit.json
npm test                                 # track and train-following maths
```

On Windows use the full path to `blender.exe`. Review renders:
`blender -b -t 1 --factory-startup --python kit/render.py -- --out out/review --sheet out/review/sheet.png out/glb/*/*.glb`

## Viewer

`npm run serve`, then open `http://127.0.0.1:8840/run-trainspotter/viewer/`. It works on
phones too (the panel becomes a bottom sheet). Pick a railway (`viewer/layouts.js`: a country
junction, a figure of eight, a mountain line with a viaduct, a truss bridge, a level crossing
and a tunnel, a big double-track train set with a yard and a turntable depot, or a grand
model-railway baseboard with mountain tunnels, a town, a yard and an upper line), then one of
about thirty trains. Set the points, brake and go, pick a livery or change the paint (the
train keeps running where it is). Overhead wires go up when an electric runs
(`kit.catenary(layout)` in the helper places the catenary masts), and the layout's other
trains stop at stations and run their own routes (`driver.js`).

The look (`pretty.js`) adds shadows, ambient occlusion, bloom on lamps and lit windows,
tilt-shift with an adjustable focus band (click or tap the scene to focus there), drifting
dust, a time of day from morning to night, and ground that fades into the sky at the
horizon. `grass.js` scatters swaying pixel-art grass and wild flowers over green ground.

## Package for the library

```sh
node pack/pack.mjs out/glb <jam-ready-assets>/run-trainspotter/3D/vehicles-racing
node pack/shots.mjs <that leaf> out/shots   # cover.png and six gallery sheets (.webp), via an installed Edge or Chrome
```

The cover fonts are the SIL OFL fonts in `tools/run-monster-trucks/pack/fonts`. Build
output, concept art and references stay local (see `.gitignore`).

## Trailer

`trailer/` renders a 30-second, 1080×1920 trailer cut to a song (the song itself is not in the repo).

1. Put the song at `out/trailer/song.m4a`, then time its lyrics and beats with a Python that has
   `stable-ts` (Whisper large-v3) and `librosa`: `python trailer/analyse.py out/trailer/song.m4a out/trailer/timing.json`.
   The lyrics to align are in `analyse.py`. The script force-aligns them word by word and also transcribes the
   song freely, so you can see what was really sung.
2. Preview: `npm run serve`, then open `/run-trainspotter/trailer/trailer.html` (Space plays with the song,
   `?t=12.5` jumps). Every frame is a function of song time, so scrubbing and capture agree.
3. Render: `node trailer/capture.mjs` (or `--stills 1.3,8.9` to check frames first). It writes
   `out/trailer/trainspotter-trailer.mp4`.

## Sounds

36 sounds for the pack's audio folder (Trainspotter Audio): 32 generated, two takes of each, 3 cut as
single hits from them, and a short showcase mixed from them:

- Steam: chuffs (single, slow and fast loops), whistles, cylinder hiss, safety valve, bell.
- Diesel and electric: idle loop, throttle-up, horns, traction whine, pantograph arcs, high-speed pass-bys.
- Track: rail clatter loop, freight pass-by, wheel and brake squeals, couplings, points.
- Station, signals and ambience: chime, doors, guard's whistle, crossing bell and gate, signal clunk,
  tram bell, a station platform loop and a countryside loop.
- A showcase (`"mix"` in `sounds.json`): `approaching-steam-train`, slow chuffing that swells in with a
  long whistle. It sorts first in the folder, so the catalogue plays it as the pack's preview.
- Cut hits (`"cut"` in `sounds.json`): four single chuffs, four wheel-over-rail-joint clacks and six bird
  calls, so rhythm and birdsong can be played from motion and at random rather than from a loop.

They are generated with ElevenLabs sound effects through asset-bot. Every take's prompt, provider and run id
are kept in `out/sounds/provenance.json`.

1. Create an asset-bot project (`asset-bot init` in an empty folder, for example `out/sfx-project`).
2. Run `node sounds/generate.mjs <that folder>/.asset-bot` (`--only id,id` redoes some). This talks to
   `asset-bot mcp` directly, so the editor connection doesn't have to be up.
3. Run `python sounds/process.py`. It trims and fades the one-shots, keeps each loop's steady body and
   makes it seamless, cuts the single hits, normalises loudness (one-shots -16 LUFS, loops -20) and writes
   `out/sounds/ogg/`. Open `out/sounds/listen.html` to review the takes.

In the viewer, sound is on from the first click or tap. Chuffs fall on the driving wheels' exhaust beats;
each axle of the car nearest the camera clacks over every rail joint, so a steady train keeps a steady
clickety-clack; a low rumble and the engine follow speed. Stations play brakes, chimes, doors and whistles,
trains sound their horns now and then as they run, and Horn sounds the right whistle or horn for the train.
Birds and a breeze play over the countryside by day.
