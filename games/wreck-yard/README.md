# Wreck Yard

Wreck Yard is a multiplayer physics game on RUN. Grab and throw objects, cut
voxel shapes with the torch, drive the buggy, and move through the portals.
Each yard department has an activity and a safety claim of doubtful value.

## Local play

```sh
npm install
npm run dev
```

Open the printed URL. Each tab creates a multiplayer room. Open **Pause** to
copy its room code. Enter that code in another tab to join the same room.
You can also open the game with `?room=CODE`. Rooms support four players.

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

Pause contains the room controls, graphics settings, sound settings, and
fullscreen controls. Multiplayer rooms continue while a player pauses.

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

## Project files

- `src/sim`: deterministic game state, physics, carving, and checkpoints.
- `src/game`: multiplayer sessions, input, and capture rules.
- `src/render`: scene, shaders, portals, interpolation, and player robots.
- `src/ui`: HUD, menus, and touch controls.
- `src/audio`: sound playback and settings.
- `public`: shipped sounds and thumbnail.
- `art`: source assets and generation records.

Syncplay runs at 30 Hz. Rendering follows the display animation loop and
interpolates poses between simulation ticks. The game uses the official
`6.0.0-rc.66` package.

To rebuild the sound bank, run `node scripts/prepare-audio.mjs`. This command
needs FFmpeg with libmp3lame. Set `FFMPEG_BIN` to select its path. Source
recordings and receipts stay in `art/audio/raw`; processed MP3 files go in
`public/audio`. The asset manifest records the source and output files.
