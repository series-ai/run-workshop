# Wreck Yard

A multiplayer voxel destruction yard on RUN syncplay. Grab and throw voxel
bodies with the hand, carve them with the torch until pieces fall off, and
watch them float or sink in the tank. Only the torch and fuel drum blasts
change a voxel shape: a hit moves a body but does not chip it. A torch cut or
a blast break glows red with heat, then turns brown, then burnt black. Every client runs the same deterministic
simulation; only inputs cross the wire, and rollback plus late join keep
everyone in sync.

> New to run-workshop? Start with [Getting Started](../../GETTING_STARTED.md).

## Yard departments

The yard is an industrial test site. Each department has a short task and a
questionable safety claim. Use the directory and floor numbers to find storage,
balance tests, cutting, floating, impact tests, driving, and delivery.

The southwest **Lost Property** belt moves loose parts through native contact
surface motion. Put a part on the belt and collect it at the other end.
Collection is not guaranteed. The belt uses the normal grab and throw controls.

See [the department guide](docs/departments.txt) for the activities and their
Syncplay features.

## Local setup

```bash
npm install
cp .env.example .env   # optional for local play
npm run dev
```

Open the printed URL. The app creates a multiplayer room on launch.
Open **Pause** to see **Your room code**. Use **Copy code** to share it.
Paste another code into **Join another room**, then select **Join** to move
to that room. The game does not offer offline play. A room server must be
available. Server failures offer **Retry** and **New room**.

`rundot/realtime.config.json` declares the four-seat deterministic room type.
The multiplayer build plugin copies it to `dist/rooms.config.json`. RUN needs
that build artifact to start hosted rooms. Keep it in each deployment.
The normal playground can upload server configuration when it starts. The
local test server below uses the SDK WebSocket authority without that upload.

To run that local server:

```bash
node scripts/serve-local-multiplayer.mjs
```

Open `http://127.0.0.1:4398` in two tabs. Each tab gets a local player identity.
Copy one room code, then join it from the other tab. The local room server uses
port 4399. Stop both servers with Ctrl+C. The room and capture checks also
start this local server when it is not already running:

```bash
npx playwright test e2e/controller.spec.ts e2e/smoke.spec.ts e2e/play-gate.spec.ts --workers=1
```

## Rundot initialization and deployment

The release thumbnail is `public/thumbnail.jpg`. It is a custom 512 × 512 JPEG.
Vite copies it to `dist/thumbnail.jpg`. Rundot uploads it with the build and
sets the thumbnail URL. Keep the source images in `art/thumbnail/` so they do
not increase the game download.

Production deployments use `game.config.prod.json`. The playground config
has a separate game ID. If this folder has no production config, initialize
a new production game:

```bash
rundot init --name "Wreck Yard" --build-path ./dist --orientation Landscape \
  --description "Torch, throw, and sink voxel bodies with friends in one multiplayer yard." \
  --keywords "multiplayer,physics,sandbox,voxel,destruction,driving"
```

After initialization, build and deploy with:

```bash
npm run deploy
```

The deploy script includes `--orientation Landscape`. It does not request
public visibility. To check the built files without an upload, run
`rundot game preflight --phase dist --dist-dir ./dist`.

To check the deployed multiplayer flow, use two dedicated Chrome test profiles
that are signed in to different RUN accounts. Close those profiles first.
Set `AUDIT_URL` to the private web player URL. It must keep `tag=private` and
the share key. The short link can redirect to the public catalog on desktop.

```bash
AUDIT_PROFILE_A=/path/to/test-player-a AUDIT_PROFILE_B=/path/to/test-player-b \
  AUDIT_URL="$AUDIT_URL" AUDIT_CHANNEL=chrome \
  node scripts/verify-hosted-multiplayer.mjs
```

The check covers room creation, copy and join, remote movement, leaving,
rejoining, invalid-code recovery, and room switching. It records access blocks
separately from game failures. Local artifact checks do not prove hosted play.

See the [Rundot init docs](https://github.com/series-ai/venus-sdk-docs/blob/main/rundot-developer-platform/initializing-your-game.md)
and [deploy docs](https://github.com/series-ai/venus-sdk-docs/blob/main/rundot-developer-platform/deploying-your-game.md).

## Controls and fullscreen

Controllers use the RUN SDK Gamepad API. Use LS to move, RS to look, RT for
the tool, LT to punt, A for the jetpack, X to use, and B to drop. LB selects
gravity. RB selects the torch. Select toggles Orbit. Start pauses or resumes.
In Orbit, RS rotates and LS changes distance.

Menus support Dpad or LS navigation, A to select, and B to return. Pause has
an **Enter code** keypad for joining with a controller. Left and right adjust
a selected sound slider. Controller play does not need pointer capture.
See [controller controls and verification](docs/controllers.txt).

On a surface that can capture the mouse (desktop web, Steam), the yard runs
behind a start plate. One click on **Click to play** enters fullscreen and
captures the mouse. When the cursor comes free (Escape, the RUN toolbar,
alt-tab), the pause menu opens. The room keeps running while your input stops.
The desktop **Pause** button and the mobile pause button open the same menu.
**Resume** captures the mouse again, and enters fullscreen again if
you left it. A second Escape, or **Exit fullscreen** in the pause menu, leaves
fullscreen. The orbit tool (`O`) frees the cursor without the menu; click the
yard to look again. If the browser keeps refusing the capture, **Play in a
window** switches to drag-to-look, and **Capture mouse** switches back. Phones
and other surfaces without pointer lock skip the gate and use drag-to-look.

On phones and tablets, the movement stick starts under the left thumb. In the
buggy, it controls steering, forward drive, and reverse. Drag the right side
to look. Hold the large **Cut** button to use the torch. Drag from **Cut** to
aim while cutting. Tap **Grab** to hold a body after the thumb lifts. The
large button then becomes **Throw**. Tap it to throw, or
press it, drag to aim, and release to throw. A canceled Throw keeps the body.
**Drop** replaces Push while holding a body and releases it without a throw
boost. Each gesture keeps the action it had when it started.

Tap the other tool's icon to equip it. Drag outside that icon before release
to cancel. Tool changes and input resets release a held body safely. Drag
from **Jet** to aim while using thrust. The look hint disappears after the
first aim drag.

In landscape, the small **Use** button appears low between the two control
groups near a machine or the buggy. It replaces the fuel widget until the
interaction is unavailable. The large action becomes **Exit** while driving.

The Jet fuel widget stays hidden at full fuel. It appears when fuel is used.
Each full recharge gives one pulse, then the widget fades out.

The **Ⅱ** button opens the pause menu. Graphics and fullscreen stay in that
menu. Solo play stops there. Room play continues. Orbit is available on desktop.

Touch controls use the dependency-free joystick logic from game-bot. They
appear for touch input and hide when a real mouse is used. To test the phone
layout on desktop, open `?controls=touch` with browser touch emulation.
Run `AUDIT_URL=http://127.0.0.1:4429 node scripts/verify-touch-controls.mjs`
for the real Chrome touch check. Browser emulation does not measure phone
hardware performance.

Wreck Yard targets landscape on RUN. The local playground config sets
`orientation` to `landscape`. The deploy script also passes
`--orientation Landscape` to Rundot. The host applies this setting on the
next deployment. The local Playground does not force screen rotation.

Inside RUN.world the game is a frame, so only the host may go fullscreen or
lock the pointer: `src/game/capturePort.ts` uses the RUN SDK System API there,
and the browser's own APIs at top level (local dev). `src/game/playGate.ts`
holds the rules. While a host error modal is open in fullscreen, one Escape
both closes the modal and leaves fullscreen (the SDK handles that key too).

For tests, `?capture=off` turns capture off (drag-to-look, no gate) and
`?capture=fake` uses a fake port on `window.__CAPTURE_FAKE__`. Both work in dev
and preview builds. The design is in
[.plans/wreck-yard-fullscreen-play-gate.html](../../.plans/wreck-yard-fullscreen-play-gate.html).

## Returns and storage

DELIVERY and RETURNS connect opposite sides of the yard. Look through either
door. Walk through it, throw a prop through it, or drive the buggy through it.
The receiving bay has shipping crates marked FRAGILE and THIS SIDE UP.

PERFECTLY SAFE STORAGE has 400 movable crates in ten levels. The sign says
STACK LIMIT: 4. Take the freight lift to ground, floor 1, floor 2, or floor 3.
Floor buttons appear near the car and each landing. Select a button on touch.
Use G, 1, 2, or 3 on desktop. The lift also carries loose objects.

Pull out a box or cut a support to collapse the stack. RESTACK appears near
the storage reset stand. Clear players and unrelated objects from the bay
before reset. The reset replaces only storage crates and their fragments.

To check both attractions, start the dev server and run:

```bash
AUDIT_URL=http://127.0.0.1:4481 node scripts/verify-attractions.mjs
npx vitest run src/sim/attractions.test.ts
npx esbuild scripts/profile-attractions.ts --bundle --platform=node --format=esm \
  --external:@series-inc/* --outfile=test-results/profile-attractions.mjs
node test-results/profile-attractions.mjs
```

Browser evidence is saved in `test-results/attractions/`. The profiler includes
step, checkpoint capture, and checksum cost with four players. Phone browser
emulation checks controls and layout. It does not measure phone hardware.

## Player robots

Player 1 uses Scrapper in orange. Player 2 uses Drum-Bot in teal.
Player 3 uses Tread-Bot in yellow. Player 4 uses Hover-Welder in red.
The player slot sets the design, paint, and number. Press `O` to see your
robot in orbit view. The chase camera also shows your robot while driving.

Run `node scripts/verify-player-robots.mjs` to check all four slots in a
browser. The script starts its own local server and closes it after the
check. It saves desktop and phone-width images in `test-results/player-robots/`.

## Commands

- `npm run dev` — dev server with the RUN sandbox
- `npm run build` — identity check, typecheck, production build
- `npm test` — unit, codec, and determinism tests
- `npm run test:e2e` — Playwright smoke test against the preview build
- `npm run verify:live` — browser checks against a running dev server
  (`npm run dev -- --host 127.0.0.1 --port 4400 --strictPort`, or set
  `AUDIT_URL`): collision coverage, controls, click feedback, contraptions,
  solid scenery, and live frame time. Results go to `test-results/`.
- `npm run profile:sim` — per-tick simulation and rollback cost, for SDK comparisons
- `npm run identity:generate` — regenerate `src/sim/identity.generated.json`
  after any change under `src/sim` or `tools/voxel-kit/src`
- `npm run deploy` — build and deploy with the `rundot` CLI

## Where things live

- `src/sim/` — the deterministic simulation: `state.ts`, `input.ts`, `step.ts`,
  `fracture.ts`, `physics.ts`, `presets.ts`, `codec.ts`, `session.ts`. Nothing
  here reads a clock. Trig runs through the Syncplay deterministic math shim
  (`src/deterministicMath.ts`), which loads before any sim module. The identity generator
  hashes every file in this folder plus the kit.
- `src/game/match.ts` — the Syncplay room controller. Offline mode remains for physics tools and tests.
- `src/net/rooms.ts` — room transports through the RUN SDK realtime API.
- `src/render/` — presentation: projection and interpolation, the raymarched
  voxel renderer, yard shell, water, occlusion, pointer input.
- `src/ui/Hud.tsx` — tools, stats, lobby, status.
- `src/game/playGate.ts`, `src/game/capturePort.ts`, `src/ui/usePlayGate.ts`,
  `src/ui/PlayGate.tsx` — fullscreen, mouse capture, the start plate, and the pause menu.
- Voxel operations come from [tools/voxel-kit](../../tools/voxel-kit/).

## Units

The syncplay solver integrates per tick. Positions are meters, velocities are
meters per tick, and gravity is meters per tick². `src/sim/constants.ts` holds
the conversions; the buoyancy boundary converts to and from per-second units.

## Rendering style

Wreck Yard uses a custom retro-futuristic cel-shaded graphic novel aesthetic targeting visual parity with the production concept art.

### Pipeline architecture

1. **Stepped shading:** World surfaces use `<Toon>` materials (`toonMaterial.tsx`) and the voxel volume shader (`toonGlsl.ts`). `ART_STYLE.ramp` sets the light bands. Department signs use unlit materials to keep text clear.
2. **Ink Edge Post-Process:** `InkComposer.tsx` runs a single composite pass executing a 4-sample screen-space depth + normal Sobel kernel (`inkShader.ts`), drawing dark ink line contours (`ART_STYLE.ink`) around voxel bodies, props, and architectural silhouettes while excluding uninked background elements (such as the stepped sky dome).
3. **Multi-layer Industrial Skyline:** Procedural silhouettes (`skylineShapes.ts`, `Skyline.tsx`) populate the distant yard horizon across quantized atmospheric depth steps.
4. **Department dressing:** `src/scene/departments.ts` supplies the signs, floor numbers, and directory. `YardDepartments.tsx` uses one atlas and three merged meshes. `LostPropertyBelt.tsx` adds three meshes. The belt drawing uses the same dimensions and speed as its native collider.

### Single tuning point

All aesthetic constants (palette colors, ramp thresholds, edge detection weights, sky gradients, fog colors) are centralized in:
`src/render/style/artStyle.ts` (`ART_STYLE`).

To tune or restyle the game, modify `ART_STYLE`. No shader code or component logic needs manual adjustments.

### Style metrics verification

To inspect and verify visual style parity metrics (luma, dark/bright fractions, ink line density, draw call budget):

```bash
# Run Playwright E2E vista capture and metric assertions
npx playwright test e2e/style-vista.spec.ts

# Run standalone metrics analysis on any captured screenshot
node scripts/style-metrics.mjs test-results/style-vista.png
```

### Sound

The game has quiet ambient music and sounds for tools, movement, the buggy,
water, props, and contraptions. Sound starts after player input.
The pause menu has mute, music, and effects controls.
The processed sound bank is 426 KB.
See [sound coverage and checks](docs/audio.md).
Use `/audio/index.html` on the dev server to hear the bank.
