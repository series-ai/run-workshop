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

If port 4318 is occupied, use the existing server or run
`npm run dev -- --port 4319`. The alternate port stays bound to localhost.

## Build review

Run `npm run proof`, then open `http://127.0.0.1:4320/review.html`.
The review links to the guided game, room, patient, object, sound, and source-motion pages.
All review pages work without RUN sign-in. Sound starts off.

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
options. The playable character includes these hand grips and the mouth opening.

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
Listen to your breath and his wordless calls. Only the father’s private thoughts appear as narrative text. Short thoughts suggest the next need.
The guided preview shows short spoken choices. The live game accepts your own words.
Sound starts off. Select **Sound off** to enable it. This also enables the creature voice.

Browser speech recognition needs microphone permission. Support depends on the
browser. Typed input uses the same agent. The creature uses deep, unintelligible
Web Audio growls and strained breaths. It does not use text-to-speech or show creature dialogue.
The father’s thoughts use italic text. All sound is generated locally with Web Audio.

## Try these instructions

> I am here. Light the lantern on the workbench, son.

> I trust you. Lift the support off me slowly. Show me before you touch me.

> Make a thread from the wig. Find something to cut it with, then thread the needle.

> Show me on the pillow first. Be gentle. Show me before you touch me.

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
uses the same state to select actions and sounds. The creature starts scared.
Praise and clear instructions can build confidence. Threats reduce trust.

Door knocking and fire change the room and the creature's state. The agent
receives these events even when the player does not send a command. During a
blackout, it acts under the existing rules. The patient cannot issue new orders.

## Implementation

- `src/game`: pure game rules, affordances, emotion profiles, and delayed actions.
- `src/agent`: RUN transport, validated tools, and input cancellation.
- `src/scene`: room geometry, source animation playback, hand attachment, and GPU dithering.
- `src/audio`: browser voice input and generated sound.
- `src/platform`: RUN fullscreen, pointer input, and the local preview fallback.

The agent has `inspect_room` and `act` tools. The game validates each physical
action before it starts and before it takes effect. STOP clears pending input
and invalidates the current contact signal. The next agent call includes the
observed result of the interruption. Agent input uses `concurrency: 'reject'`.
The app holds only the latest pending correction.

Rules can be added by voice. Only the player can lift them in the pause menu.
The agent cannot remove a rule through its tool. Other remembered guidance is
part of its context and is not a fixed engine rule.

Sessions use `InMemoryAgentSessionStore`. Restart clears the operation and the
agent's history. There is no save, chat storage, or background recording.
The `signal_intent` action declares the exact next patient contact. A signal for
one tool, target, or movement cannot authorize another. The father gets a short
private thought before contact. `vocalize` produces wordless audio and cannot
authorize contact. Raw model text is not shown or read aloud.

Failed actions produce short father thoughts from the game rules. Voice input
keeps the final recognized words visible for five seconds so the player can
correct an error.

## Checks

```sh
npm test
npm run build
```

See [the current live operation record](public/review/live-operation.html)
for the five-command rescue and server-error recovery.
The [earlier verification record](docs/VERIFICATION.md) is historical.

Tests cover stage changes, material combinations, contamination, emotion effects,
blackout restrictions, cancellation, late voice results, and timed rescue paths.
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

## Full guided preview

Open `http://127.0.0.1:4320/play.html` after `npm run proof`.
This page has the complete opening, patient clock, threats, and endings.
It uses fixed actions through the same game rules. It does not connect to RUN or use a model.
Sound starts off. Drag or use arrow keys to look. Select a short spoken choice to act.

The full route takes about five to eight minutes. Light the lantern and lift the beam.
Expose the wound, give some relief, and bar the door. Remove the metal.
Put out the fire. Cut hair from the wig and thread the needle. Close and dress
the wound. Release the brace. Other choices can cause pain or use supplies.

The opening protects the patient for 22 seconds. Door pressure starts after
rescue from the beam. The fire gives time to respond. There are three medicine
doses. Cloth used on fire becomes dirty. The suture is consumed and the dressing
stays on the patient. Blood loss, fire, and loss of the son have separate endings.

Run the visible control check with the proof server active:

```sh
playwright-cli -s=cellar open http://127.0.0.1:4320/play.html
playwright-cli -s=cellar run-code --filename=scripts/check-playable.playwright.js
playwright-cli -s=cellar close
```

The check runs at normal game speed. It keeps sound off. It saves captures to
`/tmp/still-warm-freed.png`, `/tmp/still-warm-operation.png`, and `/tmp/still-warm-saved.png`.

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

## Object review

Open `http://127.0.0.1:4320/objects.html` with the proof server running.
This page compares the actual room objects with raw shading and game dithering.
Select an item and a camera view. The bowl also has full and empty states.
The inspection light is fixed. It differs from the cellar light.

## Patient and sound reviews

Open `http://127.0.0.1:4320/patient.html` to inspect the actual body, crushed
chest, wound stages, blood loss, and dressing. Raw and dithered views use the
same state. The fixture has no patient clock or agent connection.

Open `http://127.0.0.1:4320/voice.html` to inspect the five wordless call patterns.
Enable sound, then select Listen. No sound plays on load. The game uses these
same calls. Small mouth movements use the same timing. The full scream still
uses its approved source clip and mouth shape.

The fixed examination lamp cannot be picked up. Use `adjust_lamp` to aim it.
The candle starts unlit. The son can light it from the workbench lantern or an
existing fire. Quenching the candle uses one water portion and dirties the bowl.
Door tools seat the existing bars and remain in the son's hand.
