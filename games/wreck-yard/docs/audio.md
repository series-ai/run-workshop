# Sound and mobile lighting

The game has a local sound bank. It starts after a click, tap, or key press.
It plays only during a live game. The pause menu has mute, ambience, and effects controls.
Ambience starts at 12%. Effects start at 70%.
The background has no score or beat. Drill and steam sounds have gaps of 23 to 43 seconds.
These sounds come from fixed positions beyond the yard. Pause and mute clear their schedule.
The Ambience control also changes their level. Saved Music levels move to Ambience.

RUN device cache saves the settings when the host supports it.
A host without device cache keeps settings for the current session.

## Mobile lighting fix

Three point lights were attached to the first-person tool.
They lit the floor from the camera position. They made an amber band move with the player.
Mobile shadow maps were off. The band was a light change, not a cast shadow.
The tool lights are removed. The emissive tool meshes and world lights remain.
The corrected mobile frame matches the old frame with the three tool lights hidden.
No extra render pass was added.

## Sound coverage

| Event | Sound |
| --- | --- |
| Yard background | Quiet city hum; distant drill and steam sounds |
| Torch active, cutting, or hitting steel | Pressurized torch loop; cutting changes its level and pitch |
| Torch enters water | Steam quench |
| Gravity grab and hold | Grab sound, then a quiet gravity hold loop |
| Punt and throw | Different rates and levels of the gravity pulse |
| Release without a throw | Quiet latch |
| Jetpack active | Turbine loop |
| Buggy mounted and driving | Motor loop; speed changes its level and pitch |
| Mount and exit | Mechanical latch |
| Robot walking and landing | Short steps and a ground impact |
| Prop collisions and breaking | Metal, wood, or concrete impact |
| Prop enters water | Splash; water bobbing does not repeat it |
| Fuel drum explodes | Blast and debris |
| Conveyor nearby | Quiet slow motor loop |
| Dropper, launcher, and button press | Mechanism latch |
| Basketball dunk | Short metal ring |
| Tool swap or failed gravity action | Latch click |

Paint codes do not select the impact material.
Concrete and wood prop labels select their material first.
Other bodies use the main voxel material. The buggy uses metal.
Tool feedback has no material ID. Cutting uses its own loop and a material break sound.

## Runtime limits

`src/audio/cues.ts` reads presentation state. It does not edit simulation state.
Motion samples stay at the simulation tick. Visual interpolation cannot add footsteps.
The tracker keeps action IDs through rollback. A new match clears them.
Pause, late join, and load completion seed the tracker before playback.
Old shots do not play on resume. Current loops can resume.
Held bodies do not produce velocity-based collision sounds on release.
A water-entry cooldown prevents repeated splash sounds during bobbing.

The mixer uses one Web Audio context. It resumes from the input event before it fetches files.
Ambience and effects have separate gains. A limiter controls the mixed output.
World sounds have distance gain and stereo position from the actual camera.
The limit is eight effect loops, one ambience loop, and 24 voices in total.
Shots stop after their short samples. Removed loops fade out and disconnect.
Pause, window blur, hidden pages, and RUN sleep or pause stop all voices.
The context suspends when the game is inactive.
Cleanup aborts pending asset loads and closes the context.
RUN clip capture receives the master output when the host supports it.

Only local processed MP3 files load at runtime. No sound-generation call runs in the game.
The asset report gives the current bank size. Source prompts and generation receipts stay under `art/audio/`.
[Asset processing and measurements](audio-assets.md) describes the loop and peak checks.

## Check locally

Run the game with `npm run dev -- --host 127.0.0.1 --port 4481 --strictPort`.
Open `/` to play. Open `/audio/index.html` to hear each processed file.
The sound check page starts at 10% volume.

Run `node scripts/verify-audio.mjs` with the server on port 4481.
Use `AUDIT_URL` to select another server.
The check uses real Chrome audio, local MP3 responses, and game input.
It saves evidence in `test-results/audio/`.
Run `npx vitest run src/audio/cues.test.ts` for native simulation cue checks.
Run `node scripts/prepare-audio.mjs` to rebuild the bank from the saved sources.

The automated checks measure output, peaks, loop edges, and gameplay triggers.
They do not replace a listening check on a physical phone.

## Verification result

TypeScript and the production build pass. All 317 tests pass in 51 files.
The 13 audio cue tests use the real WASM simulation.
Desktop and mobile Chrome checks load all 17 MP3 files and measure real output.
Both checks play one scheduled steam sound. The city hum replaces the old musical loop.
Pause and mute produce zero measured output. Delayed loading stays silent while paused.
Leaving the match removes all voices. Resume does not play old actions.
The pause controls fit desktop, portrait, and landscape screens.
The mute label and sliders have 44-pixel heights.
Two independent in-session reviews completed with no open P1 findings.

Headless tab activation did not change page visibility. That case was not exercised.
RUN host lifecycle hooks are connected. Physical phone playback remains untested.
The RUN Playground toolbar can cover part of a slider in the dev preview.
It is separate from the game menu.

The new ambience ships in production 1.2.2. Hosted file hashes match the local build.
