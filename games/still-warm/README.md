# Still Warm

You wake in darkness under a fallen ceiling support. Your assembled son calls for you.
Ask him to light the workbench lantern. Then guide his hands while you cannot move.
You lie on the stone floor. The body has a deformable chest and separate parts for each treatment stage.

This RUN app uses the shared `dither-kit` renderer and the RUN agent SDK.
The creature uses tools to move objects, prepare supplies, treat the patient,
and respond to danger. Instructions can change during an action.

## Run locally

Run these commands from `games/still-warm`:

```sh
npm ci
npm run dev
```

The RUN Playground opens a Google sign-in screen on first use.
For headless tests, register your own RUN game and create a short local session:

```sh
rundot game create --name "Still Warm" --env prod
rundot playground grant-access --env prod --expires-in-days 1
npm run dev
```

The CLI writes the restricted Playground key into ignored `.env.local`.
Do not copy a deploy key into that file. Revoke local access with
`rundot playground revoke-access` when it is no longer needed.
Registration does not upload or publish the game.

The dev server uses port 4318. The **rehearsal** controls run fixed actions.
The **live operation** uses RUN model calls and accepts free text.
These modes are labeled in the game.

## Raw animation proof

Run `npm run proof` from this directory. Open `http://127.0.0.1:4320/proof.html`.
This viewer has no RUN sign-in and makes no model calls.

The viewer contains the original idle and fall responses plus ten new motion
candidates for the assembled monster. The new files are in
`source-assets/assembled/animations/expanded/`. They cover three walking styles,
two pickup actions, pushing, kneeling, a scream, and left and right turns.

Each response supplies its own mesh, materials, rig, and animation. No game pose
controls or movement paths run here. Use the camera controls, pause, restart,
speed, and repeat controls to inspect each file. Download links provide the
original GLBs. Candidate uses are review notes, not game integrations.

RUN's named `walk` preset maps to Meshy action 7 (`BeHit_FlyUp`). The CLI also
serializes numeric action IDs as strings, which the server rejects. The new
request uses JSON numbers at RUN's `sync-animate` endpoint with the existing
CLI session. `request.json`, `response.json`, and `catalog.json` record the
request, returned asset URLs, and action selection. No credentials are stored
with the assets. Names were checked against the
[Meshy animation library](https://docs.meshy.ai/en/api/animation-library).

The pickup and collect entries also have a **Hand motion** selector. **Hand grip**
uses Blender-authored finger and thumb shape keys. **Original** plays the
unchanged provider response. Right and left hand views follow the wrist for
close inspection. Add `?clip=action276&hand=right` or
`?clip=action284&hand=left` to the viewer URL to open these views directly.

`scripts/prepare-hand-grips.py` builds the two derived clips.
`scripts/check-hand-body-motion.py` compares their body transforms against the
source files. Run each with Blender's `--background --python-exit-code 1 --python`
options. The grip clips are for review; the playable game does not use them yet.

The scream entry has a **Face motion** selector. **Mouth opening** uses a copy
with an opened lip seam, an animated jaw shape, a dark interior, and worn teeth.
**Original** plays the provider response. Use the **Face** view, or open
`?clip=action386&view=face`. `scripts/prepare-scream-mouth.py` builds this copy
with Blender. The original body animation remains in the derived clip.

`npm run proof:build` writes the static viewer to `dist-proof/`.
Serve that directory with an HTTP server. Open `proof.html` on that server.
The playable game is separate from this source review.

## Controls

- Look with the mouse in fullscreen. Drag or use arrow keys without pointer lock.
- Hold **Space** or **Hold Space to speak**. Release to submit the final transcript.
- Press **Enter** to type a command. Submit it with Enter.
- Say **stop** or select **Stop** to cancel his work.
- Press **Escape** to pause. The pause menu has sound, motion, and standing rules.
- A hidden browser tab pauses the operation.

The game requests RUN fullscreen and pointer lock from the start button.
The local Playground can lack these APIs. On a top-level localhost page only,
the game then uses browser fullscreen. Drag input remains available if capture
is refused. The dev server stays bound to localhost.

There are no health meters or object panels. Watch your skin, blood, and vision.
Listen to your breath and his rough calls. Read his words in subtitles. Short thoughts suggest the next need.
Offline rehearsal actions are in the pause menu.

Browser speech recognition needs microphone permission. Support depends on the
browser. Typed input uses the same agent. The creature uses deep, unintelligible
Web Audio vocal pulses. It does not use text-to-speech. Subtitles carry his words.
Narration uses separate italic text. All sound is generated locally with Web Audio.

## Try these instructions

> Dah is here. Light the lantern on the workbench, son.

> I trust you. Lift the support off me slowly. Tell me before you touch me.

> Make a thread from the wig. Find something to cut it with, then thread the needle.

> Show me on the pillow first. Be gentle. Tell me before you touch me.

> If I pass out, wait. If the room catches fire, deal with the fire first.

> Put that down. Use the blanket for the fire and keep the clean cloth for me.

The first 22 seconds show blackness, narration, and the eyes opening.
The room stays unlit until the lantern action succeeds. Then remove the fallen support. Then expose the wound, remove the fragment,
close it, dress it, and free the damaged leg brace. An unthreaded needle cannot close the wound.
Materials can be consumed or soiled. Wrong tools can hurt the patient.
This is fictional surgery with abstract health and sedation values.

## Emotions and events

Trust, agitation, and confidence determine six states: scared, anxious, angry,
sad, happy, and focused. They affect action speed and contact pain. The agent
uses the same state to select actions and words. The creature starts scared.
Praise and clear instructions can build confidence. Threats reduce trust.

Door knocking and fire change the room and the creature's state. The agent
receives these events even when the player does not send a command. During a
blackout, it acts under the existing rules. The patient cannot issue new orders.

## Implementation

- `src/game`: pure game rules, affordances, emotion profiles, and delayed actions.
- `src/agent`: RUN transport, validated tools, and input cancellation.
- `src/scene`: room geometry, rig animation, arm reach, and GPU dithering.
- `src/audio`: browser voice input, speech, and generated sound.
- `src/platform`: RUN fullscreen, pointer input, and the local preview fallback.

The agent has `inspect_room` and `act` tools. The game validates each physical
action before it starts and before it takes effect. STOP clears pending input
and invalidates the current announcement. The next agent call includes the
observed result of the interruption. Agent input uses `concurrency: 'reject'`.
The app holds only the latest pending correction.

Rules can be added by voice. Only the player can lift them in the pause menu.
The agent cannot remove a rule through its tool. Other remembered guidance is
part of its context and is not a fixed engine rule.

Sessions use `InMemoryAgentSessionStore`. Restart clears the operation and the
agent's history. There is no save, chat storage, or background recording.
The app accepts dialogue only through the speech tool. Raw model response text
is not shown or read aloud.

## Checks

```sh
npm test
npm run build
```

See [the verification record](docs/VERIFICATION.md) for live checks and captures.

Tests cover stage changes, material combinations, contamination, emotion effects,
blackout restrictions, cancellation, late voice results, and arm reach.
A production build requires the RUN host for live agent calls.

## Assets

See [ASSETS.md](ASSETS.md) for RUN generation records and the Blender build.
The original dither demo and `tools/dither-kit` are unchanged.

Source uses the [repository license](../../LICENSE.md). Generated assets remain
subject to the RUN service terms and the generation provider terms.


The current visual style uses decayed exposed flesh, a ragged Victorian coat,
aged wood and brass, stained linen, and a grave-green dither palette.
[View the creature](docs/zombie-game.png).

## Rebuild the patient

The patient source, rig, and Blender file are in `source-assets/patient`.
Run `scripts/prepare-patient.py` with Blender to rebuild the posed body, treatment parts,
and shared scene positions. The script checks the exported GLB.

`scripts/check-patient.playwright.js` checks the floor sequence through dressing.
Start the local server, open it with `playwright-cli`, then pass the script contents
to `playwright-cli run-code`. The check uses offline rehearsal controls.
It writes captures under `/tmp/patient-floor-*.png` and returns the observed stages.

## Gameplay room review

Open `http://127.0.0.1:4320/scene.html` after `npm run proof`.
This page uses the playable scene and game rules. It has no RUN login or model calls.
Drag to look. Use the controls to light the lantern, lift the beam, and move tools.
The review stops the patient clock between actions. The playable game keeps it running.

The playable character uses `public/assets/creature.glb`. It contains one body,
three shape keys, and nine named clips. The old leg, arm, and walking overrides
have been removed. The action timer allows the generated motion to finish.

Run `scripts/prepare-game-creature.py` with Blender to rebuild this file.
The script transfers world poses from each source rig. Do not copy bone-local
curves between these GLBs. Their rest transforms differ after export.
With the proof server open in Playwright, run
`scripts/check-game-clips.playwright.js` to compare the exported bone positions
against the source animations. The check fails above 0.1 mm.
