# Wreck Yard

Wreck Yard is a multiplayer physics game on RUN. Grab and throw objects, cut
voxel shapes with the torch, drive the buggy, and move through the portals.
Each station shows a physics interaction.

## Local play

```sh
npm install
npm run dev
```

Open the printed URL. Each tab creates a multiplayer room. Open **Pause** to
copy its room code. Enter that code in another tab to join the same room.
You can also open the game with `?room=CODE`. Rooms support four players.
Each player gets a robot avatar when they join. The avatar leaves with them.

The local room authority uses port 4399. Set `WRECK_YARD_ROOM_PORT` to change
that port. Local play needs no RUN account or API key.

To use the RUN playground, copy `.env.example` to `.env`, set the local
credentials, and run `npm run dev -- --mode playground`. Playground mode can
upload its server configuration.

The optional separate local server starts with
`node scripts/serve-local-multiplayer.mjs`. It uses game port 4398 and room
port 4399. Stop the server with Ctrl+C.

## Controls

On desktop, use WASD to move and the mouse to look. The game shows the tool
and interaction controls in the HUD. Press O for orbit view. Escape opens
Pause and releases mouse capture. Resume captures the mouse again. Use
**Play in a window** if mouse capture is unavailable.

On touch screens, use the left stick to move and drag the right side to
look. Hold **Cut** to use the torch. Tap **Grab** to hold an object. Use
**Throw** or **Drop** to release it. **Jet** provides thrust. **Use** appears
near a machine or the buggy. The game targets landscape orientation.

Controllers use the RUN Gamepad API. LS moves and RS looks. RT uses the tool.
LT punts. A uses the jetpack. X interacts. B drops an object. LB selects
gravity and RB selects the torch. Select toggles orbit view. Start opens
Pause. Use the Dpad or LS in menus, A to select, and B to return.

Short E/F taps remain queued until the simulation reads them.

Pause contains the room controls, graphics settings, sound settings, and
fullscreen controls. Multiplayer rooms continue while a player pauses.
Use **Performance capture** to record up to 60 seconds and save a local report.
Recording is off until you start it. The game does not upload the report.

## Regression checks

```sh
npm test
npm run test:e2e
```

The regression tests use the native physics engine and the game functions.
The browser tests need Chrome. They start the local game and check
multiplayer and controls.
Generated test results stay out of Git.

## Build and deploy

```sh
npm run build
npm run deploy
```

The build checks the runtime identity, checks TypeScript, and creates `dist`.
The deploy command builds first and selects landscape orientation. It does
not request public visibility. Initialize a RUN game with `rundot init` if
its local production game binding is absent. Keep account bindings and
credentials out of Git.

`rundot/realtime.config.json` defines the room. The build copies it to
`dist/rooms.config.json`. Keep that file and `dist/thumbnail.jpg` in deployments.

After a change to simulation sources or `tools/voxel-kit/src`, run
`npm run identity:generate`. Commit the updated identity with the source
change. Clients and the room authority must use matching identities.

## Liquid Assets

The water tank and the lava basin share station 11. Water supports floating
props. Lava heats and removes exposed voxels from props in contact with it.
Lift a prop clear to stop erosion. Its remaining scorch then cools.

The steel hand in the lava is a movable voxel prop. It melts under the same
rules as other props. Fuel drums retain their existing heat, fuse, and blast
behavior.

Erosion uses saved simulation frames. Every 15 ticks, it edits at most one
source body and removes at most six selected surface cells. The existing
fragment rules can also discard small detached debris. Contact uses cell
centers, so an overlap below half a voxel may not erode yet. The performance
panel records `sim.lava`, `lava.edits`, and `lava.removedVoxels`.

## Road Test

Small stick movements register in both directions. Steering
uses more front tire grip for tighter turns at low speed. This aid decreases
as speed increases.

Four fuel barrels mark the road course. A car impact above 4 m/s lights a
short fuse. A close explosion breaks the buggy into movable voxel debris
and releases its driver.

One worker receives barrels from the short east conveyor. It carries each
replacement to an empty road position. You can take its load or move the
worker. It abandons a lost or lit load and returns for another delivery.
Its small loader body uses the same panel and material kit as the player
robots. Cut parts show their remaining steel voxels.
The worker uses the Syncplay deterministic state machine. Its motor,
carried barrels, and upright control act through native physics forces.
The road has at most eight barrels and one active delivery.

Use **RESET CAR** beside the start bay to call a fresh buggy. The magnetic
claw carries it to the bay, lowers it, releases it, and returns to its parked
position. Reset removes the previous buggy and its fragments. The parked
magnet attracts up to four nearby steel props. Gravity-gun grabs take priority.
The performance panel records `sim.roadCourse`.

Syncplay contact and hit events drive impact sound, drum damage, floodlight hits,
and crate breaks (`stepContacts` deduplicates per-shape events to one per body
pair). The physics adapter uses 64-bit collision categories (`WORLD_CATEGORY`
and `CAGE_CATEGORY`), per-second damping rates, and a 2.5 cm horizontal collider
inset on intact storage bay crates (`STORAGE_COLLIDER_SIDE_INSET`) so columns
can sleep independently after a torch cut. Performance captures include native
broadphase pairs, contact points, awake islands, and continuous sweeps.

Rollback uses the engine's native copy-on-write checkpoints. The 496-save
native window covers the 256-frame history and 240-frame catch-up batch.
Two additional slots remain available for imports. Older standalone saves
can spill to bytes after that window.

## Project files

- `src/sim`: deterministic game state, physics, carving, and checkpoints.
- `src/game`: multiplayer sessions, input, and capture rules.
- `src/render`: scene, shaders, portals, interpolation, and player robots.
- `src/ui`: HUD, menus, and touch controls.
- `src/audio`: sound playback and settings.
- `public`: shipped sounds and thumbnail.
- `art`: source assets and generation records.

Syncplay runs at 30 Hz with four Box3D substeps per tick. Rendering
follows the display animation loop and interpolates poses between simulation ticks. The game uses the official
`6.0.0-rc.80` package.

To rebuild the sound bank, run `node scripts/prepare-audio.mjs`. This command
needs FFmpeg with libmp3lame. Set `FFMPEG_BIN` to select its path. Source
recordings and receipts stay in `art/audio/raw`; processed MP3 files go in
`public/audio`. The asset manifest records the source and output files.
