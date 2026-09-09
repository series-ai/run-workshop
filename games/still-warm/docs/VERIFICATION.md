# Earlier verification records

These records describe earlier revisions. Some scripts and pose controls below
were removed after the approved source animation rebuild. See the current
[thread handoff](thread-handoff.html) and [README checks](../README.md#checks).

# Current playable check — 2026-09-06

The current scene uses the approved source clips. The earlier procedural limb
and gait controls described in the older records below have been removed.

- Sound starts muted in the UI and audio engine. Voice also stays muted.
- 126 tests pass across eight files.
- The timed domain route reaches rescue after about 316 seconds.
- `scripts/check-playable.playwright.js` completed the full visible route at
  normal speed in Chromium. It reached the saved ending with no page errors.
- The route included the lantern, support lift, exposure, morphine, door bar,
  extraction, water on the fire, hair suture, dressing, and brace release.
- The roof damage, dim lighting, body, and tool silhouettes were inspected
  through the dither renderer.
- The full guided preview is `play.html`. It does not start the RUN SDK or
  use model calls. The live agent was not tested again in this pass.

The following records describe earlier versions.

# Current verification record

Verified on 2026-09-06 with Chromium, RUN SDK 5.28.1, and RUN agent 0.1.0-beta.2.

The approved Assembled model and the black opening replace the previous versions.
The records below the separator describe earlier versions only.

## Floor body update

The player body now uses a textured RUN mesh posed in Blender. The operating table is removed.
The chest, arms, hands, and legs remain separate. The chest has breathing and compression controls.
The actual skin surface defines the wound and arm targets.

- Final asset: 2,281,980 bytes. Blender imported the exported GLB and checked all treatment parts and shape keys.
- 121 tests pass. TypeScript and the production build pass.
- Browser rehearsal passed from trapped body through dressing on the final compressed asset.
- Cancelling a lift kept the player trapped. The beam and chest returned to the pinned pose on resume.
- The embedded fragment disappeared after extraction. Closure and dressing appeared at their correct stages.
- The boy crouched for floor treatment. His hand reached within 1.34 cm of the wound during an active contact.
- The browser reported zero page errors during the final check.

See [the body review](patient-review.html), [observed states](patient-browser-check.json),
and `scripts/check-patient.playwright.js`. The test browser and agent-owned server were stopped after verification.
The current voice is unchanged in this pass.
Its synthetic sound still needs refinement. A new live model operation was not required for these scene changes;
the body uses the same validated action controller as the earlier live tests.

## Checks

- All 121 tests pass across nine files. TypeScript and the production build pass.
- The opening starts black. Narration and creature subtitles use different type styles.
- Eyes open over five seconds. The room stays dark until the lantern action completes.
- A real RUN agent received a typed request to light only the lantern. The lantern lit.
  The browser reported no page errors in this run.
- The lantern action uses the existing delayed action and cancellation system.
- Rehearsal lifted the support and exposed the wound on the new rig.
- The rig root had zero vertical travel across 35 samples. The hand reached within
  1.6 cm of the wound during treatment.
- The exported asset has 24 bones and two clips: idle and walk. Its size is 1.55 MiB.
  The body has 80,000 triangles. Raised stitches add 1,032 triangles.
- Creature sound uses low, wordless synthesized syllables. It does not use text to speech.
  The saved sample uses the actual audio class. Its peak amplitude is 0.081 with no clipping.

Run `npm test` and `npm run build` from `games/still-warm` to repeat the automated checks.
Vite still reports chunk size and Zod annotation warnings.

## Evidence and limits

Open [the HTML review](opening-review.html) for captures and the voice sample.
The camera was aimed toward the creature for its face capture.

Human microphone input was not tested. Typed live input and automated voice lifecycle
checks passed. The sound cadence needs human listening review. Hosted RUN fullscreen
has adapter tests; local browser checks used the browser fallback.

The CLI ledger did not change after generation. Final provider billing remains
unconfirmed. See [asset records](../ASSETS.md) for generation and rig IDs.

The prototype has not been published. Keep the headless Playground server on localhost.
The test browser and agent-owned development server were stopped at handoff.

---

# Previous verification record

Verified on 2026-09-06 with Chromium and RUN agent 0.1.0-beta.2.
The app now uses RUN SDK 5.28.1. The existing local server still loaded the
5.27.0 Playground host during these checks. The user owns that process.

## Current checks

Run from `games/still-warm`:

```sh
npm test
npm run build
```

The suite has 118 tests across game rules, controller, voice, sound, arm reach,
look input, and fullscreen. TypeScript and the production build pass.
Vite reports a large main chunk and Zod annotation warnings. The main script
is about 248 KB gzip. The combined creature GLB is about 610 KiB.

## Revised live opening

This typed instruction used real RUN model calls:

> I trust you. You can do this. Lift that support off me slowly. Tell me first.

The agent announced the lift, removed the support, and reported the crush
injury. The player thought changed to the loss of leg movement. The support
was clear by the browser capture 12 seconds after submission.

A second instruction asked him to expose the injury with cloth and aim the
lamp. The agent did so. The visible wound contained the foreign fragment.
It did not complete surgery when the player asked only for an inspection.
These are observed runs. Model timing and choices can vary.

## Browser and asset checks

- Desktop 1440 × 960 and phone 390 × 844 inspected.
- The player starts looking down at the fallen support.
- Rehearsal cancellation during the lift left the support in place after the
  action delay. A later completed lift moved it aside.
- Mouse and arrow input change the view. The camera does not follow tools.
- Local fullscreen and pointer lock start from the title button.
- Typing releases pointer lock without pausing the operation.
- Escape pauses. Browser pointer release also pauses.
- The old Playground capability object lacks fullscreen fields. The local
  fallback handles this case. A supported RUN host has priority in tests.
- The new creature loads with the original 24-bone RUN rig and five clips.
  Blender verified all clips after the face and cloth changes.
- Blood, skin color, breathing, and view effects replace numeric health meters.
  Settings, standing rules, and rehearsal controls remain in the pause menu.

The small blue cross visible in local captures belongs to RUN Playground.
It is not part of the game HUD.

## Earlier operation checks

Before the accident revision, a full live operation reached victory in
2 minutes 22 seconds. The agent prepared thread from a wig and a dressing
from a blanket after cloth was used on fire. The revised opening was tested
through injury exposure; a complete live operation was not repeated for it.

The shared treatment rules retain tests for closure, dressing, release,
medication blackout, material use, emotions, and cancellation. Earlier browser
checks also verified blackout recovery and tool attachment to the animated hand.

## Limits

Human microphone input was not tested. Browser voice lifecycle and late-result
handling have automated tests. Typed input was tested with the live agent.
Hosted RUN fullscreen has adapter tests; browser checks used the local fallback.

The CLI credit ledger remained unchanged after the original generation. Final
provider billing is not confirmed. The creature revision used local Blender
geometry and no new paid generation. See [asset records](../ASSETS.md).

This local prototype has not been published to RUN. Keep the headless Playground
server on localhost. Its local access grant expires after one day. The README
explains how to create a new session. The user's server remains on port 4318.

## Current captures

- [Accident opening](accident.png)
- [Revised creature](creature.png)
- [Support removed](support-cleared.png)
- [Cancelled lift](cancelled-lift.png)
- [Live injury exposure](live-injury.png)
- [Phone view](phone.png)

The live injury capture precedes the final body shape refinement. Other current
captures use the revised body geometry. Older PNG files in this directory
record the previous interface.


## Victorian zombie revision

The final creature was inspected in front and three-quarter Blender renders,
then in the actual dithered game. The eyes and mouth use deformed source mesh.
Face plates, wraps, and detached scar geometry were removed. The room now has
wood cabinet panels, brass lamp details, stained linen, and an anatomical plate.

Motion checks sampled the actual animated skeleton in Chromium. During a
6.5-second treatment sequence, root vertical travel was zero. The hand reached
within 2.2 mm of the wound. Idle samples also had zero root vertical travel.
The instrument tray is now within bedside reach. The body does not return home
between tools. Floor routes go around the foot of the bed.

The voice uses a rate of 0.68 and pitch of 0.52. The local browser exposes the
Daniel en-GB voice. A separate quiet rasp follows speech start and end events.
Automated tests cover cancellation, stale speech events, mute, and disposal.
The final dialogue instructions require short broken phrases and clear tool
announcements. This speech limit applies to the character's words, not its plans.

- [Current game view](zombie-game.png)
- [Face structure](zombie-face.png)
- [Three-quarter view](zombie-three-quarter.png)

The earlier captures above show previous designs. The new mesh request was
rejected by the provider; the final visible redesign uses local Blender work.


A live command, "You can lift it. Are you afraid?", produced the speech-tool line
"Lift support... gently. Now." The agent then cleared the support. The line was
captured as a DOM speech event, before the transient subtitle faded.
The final source scan passed for 58 files.

## Motion and object proof — 2026-09-06

The current proof is `proof.html`, with a separate Vite configuration and no RUN
plugins. `npm run proof` starts port 4320. `npm run proof:build` creates a static
`dist-proof` directory. The proof uses local Draco files.

The renderer now holds stance feet in world space. It uses uneven foot swing
times, a stable root height, path-facing turns, and a lower treatment pose.
The same changes apply to the game. The room and instrument models are shared.

- Unit tests: 123 passed in 10 files.
- Game build and proof build: passed.
- `scripts/check-motion.playwright.js`: actual skeleton foot target error and
  stance drift below 0.01 mm in the sampled walk and turn. Pause held the pose.
- `scripts/check-patient.playwright.js`: full offline rehearsal passed through
  dressing. The cancelled lift restored the support and chest. Closest hand
  contact was 1.8 mm. No page errors occurred.

See [the HTML review](motion-review.html). The proof uses longer action times
for inspection. It does not validate remote room action timing or agent
choices. The mesh has no finger joints for a closed grip.

The built proof also passed `scripts/check-return.playwright.js`: the 57-second
sequence reached the door work position and returned home. Maximum foot target
error was below 0.01 mm. The built proof made no external resource requests.

## Limb control correction

The first proof missed reversed local X directions in the pose controls. The
rig uses positive X for anatomical left. Hand targets and elbow and knee bend
controls used the opposite sides. `GeneratedAssistant.tsx` now uses one
`SIDE_X` map. The bone weights in both source and processed meshes attach arms
to arms and legs to legs. No asset was regenerated.

The proof Source selector can play the original RUN mesh, rig, and clip with
no pose overrides. `scripts/check-limb-sides.playwright.js` checks the actual
intermediate joints, not only the end points. Standing and 20 walking samples
passed. All 123 unit tests and both builds passed.

## Standing clearance and pickup correction

Unused arms keep their provider joint pose with an outward shoulder rotation.
The shared instrument stand has a cantilevered tray within reach. The pickup
fixture commits before moving the tool into the hand. Pose goals return to
standing after the action. The tool attachment uses a palm offset derived
from hand skin weights. No mesh or provider animation was regenerated.

`scripts/check-standing-clearance.playwright.js` deforms the actual mesh and
checks forearm/hand vertices against leg surface cross-sections. It found no
penetration greater than 1 mm in all six standing emotions. The pickup contact
pose also returned zero intersecting vertices. Front and side views were
inspected. The current rig still has no finger joints for a closed grip.

125 tests passed in 11 files. Game and proof builds passed.
