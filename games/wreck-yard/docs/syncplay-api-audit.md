# Syncplay API audit

## Production release 1.6.0: 2026-10-16

The user explicitly authorized deployment after rc.54 verification. Private
production now reports version `1.6.0`. It uses `6.0.0-rc.54` and the explicit
copy input contract. The fresh bundle exactly matches the tested artifact.
Predeploy passed with zero critical findings and six existing warnings.
No server configuration changed. The release includes the checkpoint,
beam, portal, output-read, and start/capture repairs. Release notes and
records were updated. Evidence is in `test-results/release-rc54/`.
The private short link falls back to the public catalog in the headless
web check. Its public-tag request returns 404. Game metadata returns 200,
but no private release or game bundle is requested. Live private gameplay
and cloud bundle SHA remain unverified. The share route is unchanged from
1.5.0. The audit sections below record the state before this deployment.

## rc.54 follow-up: 2026-10-16

The current local pin is `6.0.0-rc.54`. The registry RC tag points to that
version. Its git head is `85634a6a35ab976aaec073832881e1465592b9eb`.
The platform SDK stays at `5.28.0`. Production remains version `1.5.0`.
The rc.53 sections below describe the earlier audit.

rc.54 changes the runner and runtime-session default input mode from copy
to adopt. The adopt ownership audit is now always active. The old audit
flag cannot disable it. The game explicitly selects the supported copy
contract through `YARD_INPUT_OWNERSHIP` in `src/sim/session.ts`. Both the
runner and shared room options use that value. Direct test and probe
boundaries also select copy. Create and quick-match use those room options.

The game's 18-field input records are flat scalar records. The render input
producer creates a fresh record. The controller replaces its reference.
The codec emits plain records. Decoded and neutral inputs are frozen. No
mutation of a sent record was found. This alone does not prove that adopt
has lower cost. Adopt retains descriptor/path baselines and checks retained
input history. The platform room authentication path still cannot send the
required adoption capability. A partial adopt migration would change the
room contract without verified hosted admission. Keep copy explicitly.

Only 13 package files differ from rc.53. The physics facade, public physics
types, contact/material output path, portal code, checkpoint code, and core
runtime source are unchanged. Generated artifact metadata has a new package
version. The source hashes and decoded production, profile, and 2D WASM
bytes match. The 160 MiB native retained-memory limit remains. Keep the
local checkpoint repair. No new physics API requires game adoption here.

Four isolated common-API fixture runs used rc.53, rc.54, rc.54, rc.53 order.
All 12 sampled motion and common-contact states per run matched. All eight
world disposals returned to zero. Rest public step medians were 2.481–2.559
ms on rc.53 and 2.561–2.565 ms on rc.54. Rest latest medians were
0.729–0.751 ms and 0.747–0.768 ms. Shove public step medians were
13.180–13.545 ms and 13.638–13.714 ms. Shove latest medians were
0.474–0.492 ms and 0.467–0.471 ms. These observations show no clear physics
cost improvement. They measure public API paths on a shared host, not the
pure solver or hosted game performance.

The rc.54 checkpoint stress test reached frame 600. It restored an older
byte save and matched exact replay checksums and late-join bytes. It kept
256 logical saves, with at most 32 retained native saves. Native retained
bytes peaked at 28.6 MB. Raw JavaScript checkpoint buffers peaked at
227.0 MB. All native resources released. This does not establish a phone
memory or frame-time budget. Further verification results follow in the
completed plan and test records.

The first full suite passed 451 of 452 tests. The failed presentation parity
check exposed a dependency test-helper fault. `assertPresentationParity`
forwards the runner ownership setting to its offline runner. It omits that
setting from the network client options it builds. On rc.54 those clients
select adopt and reject the explicitly copy-mode room. The helper has no
public client-options override. The local test now uses a direct public
runner and simulated authority/client parity drive with explicit copy at
both boundaries. It retains the same 20-frame scripted input schedule,
confirmed canonical frame comparison, and minimum five matched frames for
each of two clients. Its three focused determinism tests passed. No SDK patch,
mode change, or skipped assertion is permitted. The failed report remains
in `test-results/rc54/full-tests-failed-attempt1.json`.

The final full suite passed all 452 tests after the parity helper was
replaced. The build, identity check, and TypeScript passed. The production
browser drive passed all four startup, pause/resume, error, and warm-start
tests. All 50 portal checks passed with no recorded error. All 71 gravity checks passed with no recorded error. The targeted desktop
and mobile-layout interaction drives each passed eight actions, with no
recorded session, page, shader, invalid-pose, or stopped-frame fault. These
checks do not prove hosted multiplayer or physical phone performance.

Evidence: `test-results/rc54/audit.json`, `contacts-comparison.json`, and
`checkpoint-storage.json`. Plan: `.plans/done/wreck-yard-syncplay-rc54.html`.
The update includes no commit, deployment, SDK patch, or audit override.

## rc.53 follow-up: 2026-10-16

The game now pins `6.0.0-rc.53`. npm exposed the release at 16:30 UTC,
after the requested 20-minute wait and registry replication.
The published `gitHead` is `18098b1a9306c9fffaeaff151d1f8a68ea106a18`.

The public export map has no added or removed subpath. Direct comparisons found
identical physics facade files, physics declarations, voxel body code, core
product code, and owned runtime code. Decoded production, profile, and 2D WASM
bytes match rc.51. The production WASM SHA-256 is
`cee9ef345a6f8d42e35b21553fd414f38e17ac9ad3753a1bf9fc3d4c8c61f7c7`.
The generated metadata carries the new package version. The game runtime
identity was regenerated for that exact version.

### New input ownership option

rc.53 adds `inputOwnership: 'adopt'` and `inputOwnershipAudit`. Adopt mode lets
the engine retain a submitted input record. The caller must never change it.
The default remains copy mode. The game's flat input records meet the value
contract. Both the runner and room must select the same mode.

Keep the current copy mode. Adopt also needs the `syncplayInputOwnership`
authentication capability. The installed platform SDK 5.28.0 cannot send it.
The current stable platform SDK 5.29.1 also constructs room authentication
from a fixed field list without that capability. The Syncplay room helper only
sets room metadata and criteria. It cannot add the authentication field.
Join by code also has no public override. Do not add a partial adopt setting.
No platform SDK change is needed for the default copy path.

### Remaining limits

The real rc.53 voxel probe still changes named steel to inline material.
Keep the lower-level carve path. The runner still lacks `snapshotBufferSize`.
Focused native shape replacements passed in four scenes. They do not prove
that the earlier busy-scene shape edit fault is fixed. The relevant code and
WASM are unchanged. Keep the workaround until that case can be verified.

The real room create/join check stopped during room creation. The service
reported `No server bundle found for game`. Hosted room verification is blocked.
No server bundle was deployed as part of this task. Local tests of real
in-process authority and clients remain separate evidence.

### rc.53 verification

Results:

- Production build and identity check: passed.
- Full suite: 66 files and 441 tests passed. No test was changed for this update.
- General browser suite: all seven scripts passed.
- Idle and active retention: each reached frame 600, retained 256 saves, peaked at 257, and released all saves on disposal.
- Independent review: passed. Four default-copy wire probes matched rc.51 bytes and decode results.
- Long destruction run: failed with the same native checkpoint allocation error observed on rc.51. No new memory-safety claim is made.
- Hosted room create/join: blocked by the missing server bundle.

The profile produced the same cut sequence, body counts, and final state size
as rc.51. Timings were slower than the first baseline. An isolated rc.51
control also slowed under the current machine load. These runs do not support
a clean performance comparison. They do not establish a new SDK timing fault.
The game remains on rc.53. The control used the saved rc.51 package in a
separate temporary directory.
Evidence is saved in `test-results/sdk-rc53/`. The plan is
`.plans/wreck-yard-syncplay-rc53.html` at the repository root.

## Production release 1.4.0: 2026-10-16

The user requested a regression check, build, and deployment. The production
build passed. Predeploy passed with zero critical findings and six warnings.
The same runtime passed 441 tests and seven general browser scripts. The final
production startup, controls, pause, and error recovery checks passed 3/3 with
one worker. An initial parallel startup failed; its serial repeat passed.

The vista check now requires its development camera hook and selects Orbit
before capture. It checks the actual camera position. No game lighting or
threshold changed. The dark fraction is 0.155 against a 0.12 limit. Historical
evidence reports 0.150–0.159. This remains a known failed style check.
The long destruction checkpoint allocation failure also remains.

The deploy command returned success for production game
`zKinTNVlj4miAVGr47Ir`. The release remains private. A second game-info
request confirmed version 1.4.0. The private share link redirects to the public
catalog without its private key. The catalog shows “Game Not Found”. Hosted
gameplay could not be verified. No visibility or server configuration changed.

Release evidence is in `test-results/release-1.4.0/`. No commit was made.

## Historical rc.51 audit

Date: 2026-10-15. Package: `@series-inc/rundot-syncplay@6.0.0-rc.51`.

The npm `rc` tag points to rc.51. rc.50 was not published.
`MIGRATING-RC49-TO-RC51.md` reports no public API change from rc.49.
This audit also checks older SDK functions that the game did not use.

## Changes in this update

| Game function | SDK function | Result |
|---|---|---|
| Catapult launch | `setBodyTransform`, `setLinearVelocity`, `setAngularVelocity`, `setBodyLinearDamping`, `wakeBody` | Changes motion without a topology edit. Keeps the named material and body ID. |
| Partial pose change | `readMotion`, `setBodyTransform`, `setLinearVelocity`, `wakeBody` | Keeps unspecified motion, rotation, shape, mass, and inertia. |
| Damping change | `setBodyLinearDamping` | Keeps motion and sleep. |
| Player gravity input | `gravityPerFrame: frameGravity(0)` | Removes the processor that added 1 to cancel SDK gravity. The game applies gravity and jetpack acceleration before the KCC. |
| Gravity gun hold | `createGrabServoState3D`, `stepGrabServo3D`, revision 2 | Uses native force, gravity compensation, and inertia-based angular damping. Reconstructs the helper from saved hold data each tick. |
| Capsule and point cuts | `carveVoxelChunk` | Uses cell coordinates. Keeps source bytes immutable and preserves uncut material IDs. Keeps the previous short-segment cutoff. |

The grab limits scale with body mass. The force limit includes gravity
compensation. The game still owns hold-point speed, acceleration, floor
clearance, break distance, throw boost, punt, and drop rules.
The helper has no hidden integration history. The saved target, target
velocity, body mapping, and native checkpoint supply its state after rollback.

Native force acts during physics substeps. The old velocity servo changed speed
before those substeps. A first hold tick can now lift a body less. Release checks
therefore cover both actual ground contact and free flight. The free-flight
check verifies the throw boost. Both checks require drop to match free motion.

## Existing SDK use

| Area | Current SDK use |
|---|---|
| Runtime | Owned runtime adapter, canonical session config, runtime identity, native checkpoints, native checkpoint digests, serialized hydration |
| Networking | Session runner, room helpers, paced prediction, input delay, confirmed state checksums |
| Input | `defineSyncplayInputCodec`, bounded integer fields, canonical neutral input |
| Materials | Named world materials, explicit combine rules, contact material results for effects and audio |
| Motion output | `writeBodyMotionInto`, logical body IDs, teleport counters |
| Queries | Native raycast, shape cast, overlap, collision layers |
| Character | KCC revision 3, static ground, dynamic supports, moving lift platform |
| Vehicle | Stateful vehicle revision 2, native wheel queries and tire forces |
| Portals | Native portal pair, body crossings, straddler output, portal rendering |
| Water | Native fluid volume, buoyancy, drag, and interaction output |
| Destruction | Native voxel cooking, capsule carving, component splitting, anchor masks, compound colliders |
| Presentation | Runner projection and interpolation, teleport-aware pose changes, persistent voxel state |
| Deterministic math | SDK deterministic Math installation before simulation imports |

## Local rules that remain

| Local code | Reason |
|---|---|
| `movement.ts` step and ceiling checks | They enforce tested clearance and slope rules. KCC use alone has not proved those same rules. |
| `returns.ts` player crossing | KCC revision 3 does not apply portal crossings. The game also checks full capsule fit and occupied exits. |
| `fracture.ts` fragment policy | The game owns anchor retention, fragment limits, IDs, heat, and crate fields. The high-level voxel API does not return these split results. |
| Through-cut parallelogram | SDK swept quads use a different cell selection rule. A comparison removed 72 cells with the SDK and 92 with the current cut. |
| Heat and fuel drum damage | These operations combine color, damage limits, fuse state, and removal policy. A second generic carve pass would not remove that game logic. |
| Tuple vector adapters | They connect game coordinates to SDK SI types. They do not contain a second solver. |
| Teleport-aware pose interpolation | The current interpolation is correct. The SDK helper would require extra tuple/object conversion without removing game policy. |
| Single aim-ray queries | The SDK batch API exists. The game has no matching independent ray batch to replace. |

## Published SDK faults and limits

### High-level voxel carve loses named materials

Run from this project:

```sh
node scripts/repro-syncplay-rc51-voxel-material.mjs
```

The real WASM probe creates a named steel body. After `carveVoxelBody3D`,
`readBody().materialSource` changes from named steel to inline.
`dist/physics/voxel-body-state.js` spreads resolved coefficients into
`replaceBody`. The game requires named sources for contact effects.
Keep the lower-level carve, split, and cook path until this fault is fixed.

### Shape replacement still needs the existing workaround

The published native code still copies the contact cache when the body ID list
does not change. Its edit peak bound does not count that allocation.
PR [5447](https://github.com/series-ai/venus/pull/5447) was open during this audit.
Keep remove-and-add in `replacePhysicsBody` for a real shape change.
Use native setters for shape-preserving changes.

### Runner snapshot retention is not configurable

`dist/runner.d.ts` exposes `maxCatchUpFrames`. It does not expose
`snapshotBufferSize`. The lower-level session and network client expose that
field. The current runner uses the default 256-save history.

To repeat the long-window check:

```sh
./node_modules/.bin/esbuild scripts/profile-checkpoint-retention.ts --bundle --platform=node --format=esm '--external:@series-inc/*' --log-level=warning --outfile=test-results/profile-checkpoint-retention.mjs
node test-results/profile-checkpoint-retention.mjs
node test-results/profile-checkpoint-retention.mjs --busy
```

Before the storage repair, both checks reached frame 600. Each retained
256 saves and reached a peak of
257 saves. Disposal released all saves. This proves bounded retention in these
two traces. It does not prove that a large falling stack fits the 160 MiB native
memory limit. The declared capacity still allows 256 retained saves plus a
240-frame catch-up batch and 2 scratch saves. A smaller safe history needs an
SDK runner API change. The later storage repair below keeps the same full
history and changes where older saves reside.

### Busy-scene checkpoint allocation failed before the storage repair

The full `verify-yard-breakables.mjs` browser run breaks the lamps and waits
for relighting. During the later crate destruction, rc.51 stops the session:

```text
physics.checkpoint-invalid: KINETIX_NATIVE_WORLD_ALLOCATION_FAILED:
capture checkpoint: native operation failed
```

The script now checks controller errors on each state read. It reports this
allocation failure directly. The earlier script continued to read a stopped
frame and reported a failed tire grab instead.

At this audit stage, the failure blocked the long breakables check. The 600-frame
probes above do not produce the same destruction load. Bounded checkpoint count
alone does not prove safe memory use. No local buffer setting was added because
the published runner has no such API. No SDK memory fix is claimed.

## Verification record

The plan and full run record are in `.plans/wreck-yard-syncplay-rc51.html` at
the repository root. Targeted real physics checks cover body mutation,
materials, catapult motion, player movement, held-body motion, cuts, and heat.
The production build includes the exact SDK version in the runtime identity.
Final results:

- Production build and identity check: passed.
- Full suite: 66 files and 441 tests passed.
- General live browser suite: all seven scripts passed. Desktop and 390 px input checks reported no page errors.
- Body mutation and capsule checks: six real WASM tests passed.
- Idle and active 600-frame runner checks: passed with 257 peak saves, 256 retained saves, and zero saves after disposal.
- Two independent Sol 6.1 High reviews: no new P0 or P1 code issue.
- Long breakables browser check: failed with the native checkpoint allocation error above.

Logs are in `test-results/sdk-rc51/`. The plan remains in progress because
that last acceptance check fails. No complete memory-safety claim is made.

## Checkpoint storage repair: 2026-10-16

The reported capture failure comes from the native retained-memory limit.
That limit is 160 MiB for the full physics WASM instance. It includes
checkpoint contact data and other native retained resources. More checkpoint
slots do not increase the byte limit. rc.53 remained the latest published
release when this repair started. Upstream PR 5447 remained open. Its proposed
contact-data reduction also reported a later busy-scene memory failure.

The game now keeps 32 recent native saves. Before the next capture, it
serializes the oldest native save with `serializeCheckpoint`, releases that
native handle, and stores the raw bytes in the same save object. Its game
state, frame, and live revision stay unchanged. Capture order determines the
oldest save, including after rollback. Existing byte restore, checksum, and
late-join paths handle older saves. The app uses public SDK APIs only.

The runner still keeps 256 logical saves. The logical budget remains
256 + 240 + 2. A checksum of an older save can use one temporary native
import. It is separate from the 32 retained native saves.

This moves older physics data to JavaScript memory. It does not reduce the
full memory cost to the native retained-byte total. The four-player falling-stack
trace used 210 MB of raw JavaScript physics buffers at frame 600 and reached
a peak of 227 MB. A retained catch-up batch can use more JavaScript storage
than the steady 256-save history.
Compression was not added to the capture path: a separate probe required
7–10 ms per snapshot. Device memory and frame-time limits still need device
measurements. The repair does not remove the native ceiling for every scene.

The independent real-WASM oracle is `src/sim/checkpointStorage.test.ts`.
`scripts/profile-checkpoint-storage.ts` drives the same 600-frame falling-stack
trace with the actual save policy. Native diagnostics stay in tests and
scripts. See `test-results/checkpoint-repair/` for measured results and the
execution plan at `.plans/done/wreck-yard-checkpoint-memory.html`.

The repaired trace reached frame 600 with 256 logical saves and 32 retained
native saves. Native retained memory peaked at 28,631,400 bytes. The oldest
save restored and replayed to identical checksum and late-join bytes. Disposal
left zero native slots, worlds, and retained bytes. Before repair, the same
falling-stack drive failed at frame 199 with 167,264,232 native retained bytes.

Capture time includes any conversion to byte storage. Its median was 3.24 ms
and its p90 was 3.92 ms on the loaded host. Full tick time was 61.70 ms median
and 72.38 ms p90. Node RSS at frame 600 was 890,535,936 bytes; this includes
game state, WASM capacity, transient allocations, and uncollected garbage.
These values do not establish a device frame-time or total-memory budget.

Final repair checks: 67 files and 444 tests passed. The full breakables
browser drive passed beyond frame 3394. Both 600-frame runner retention
checks kept 256 logical saves and 32 native saves, then released every save.
The build, identity check, and all three production browser tests passed.
An independent architecture review found no P0/P1 blocker. Its two smaller
findings were resolved. `smart-route review` exited 1 because its protected-path
guard rejects the existing authorized dependency edits. The guard was not
bypassed. The independent review is the recorded fallback. This repair is
local. Production remains at version 1.5.0.

## Interaction performance follow-up: 2026-10-16

The npm rc tag still points to `6.0.0-rc.53`. A controlled fixture now
separates the public `world.step()` call from `latest()`. It creates the same
400 boxes and floor through public APIs. It uses inline materials supported
by both rc.48 and rc.53. It retains no checkpoints. Each package runs in a
separate process. Run order is rc.48, rc.53, rc.53, rc.48.

The script is `scripts/profile-syncplay-contacts.mjs`. `--sdk` accepts an
absolute extracted package path. `--output` or `SYNCPLAY_CONTACTS_OUTPUT`
selects a new report file. It refuses to overwrite a report. Example:

```sh
SYNCPLAY_CONTACTS_OUTPUT=test-results/monkey-perf/my-rc48.json node --expose-gc scripts/profile-syncplay-contacts.mjs --sdk /private/tmp/rc48/package
SYNCPLAY_CONTACTS_OUTPUT=test-results/monkey-perf/my-rc53.json node --expose-gc scripts/profile-syncplay-contacts.mjs
```

All 12 sampled scene/frame checkpoints match across the four successful
runs. Motion hashes, common contact hashes, counts, and body status match.
Every world disposes to zero native retained bytes, slots, and worlds.
The initial metadata-parser failure remains in the evidence. It ran no
simulation. The parser was repaired before all four successful runs.

| Path, p50 ms | rc.48 runs | rc.53 runs |
|---|---:|---:|
| Rest public step | 2.44 / 2.37 | 3.43 / 2.80 |
| Rest latest | 0.336 / 0.325 | 1.027 / 0.831 |
| Shove public step | 12.92 / 12.64 | 15.22 / 14.74 |
| Shove latest | 0.224 / 0.219 | 0.650 / 0.625 |

This supports a repeatable cost increase in the SDK public paths for this
common fixture. It does not isolate the compiled solver. The contact transfer
record grew from 112 to 288 bytes before JavaScript objects. The added
material data is a specific cost candidate. The measurements do not assign
every time difference to that data. Host load varied from about 14 to 18.

Full current-game parity with rc.48 is not possible without changing its
contract. rc.48 lacks named material inputs and material contact results.
The game uses those fields for contact effects. The dependency stays on rc.53.
The game now avoids its duplicate `latest()` call by reusing the step output.
Independent real-WASM tests cover removed/replaced bodies, current motion,
live pair-edit reads, native restore, and serialized replay. No SDK patch
or contact-data omission is included.

The full browser stack-control case exposed the slow path: before repair,
frame-interval p95 reached 89.25 ms and simulation throughput was 27.69 ticks
per wall second. The step/output phase p95 was 44.47 ms. About 400 active
boxes are a different workload from the stable sleeping stack. The phase
includes public step and the first latest read. It is not pure solver time.
The local checkpoint spill adds about 1.8–1.94 ms median in the native trace.
The whole retained-versus-immediate difference also includes GC and order.

Evidence is in `test-results/monkey-perf/contacts-comparison.json`,
`native-after-comparison.json`, and the browser action records. The plan is
`.plans/done/wreck-yard-monkey-perf.html`. These are local checks. Production
timing and physical phone performance were not measured in this follow-up.

The vehicle diagnostic separates two browser startup costs from physics.
One input handler waited 438 ms in audio unlock. A separate portal scene
render waited in Three shader diagnostic calls. The same-page warm route
had no interval above 100 ms. CPU profiles and Chrome traces are under
`test-results/monkey-perf/vehicle-diagnostic-1`. These delays do not support
an SDK physics fault. The earlier unprofiled 239 ms render remains a separate
observation. See `docs/performance-telemetry.txt` for the exact scope.

### Mobile recovery isolation, 2026-10-16

The game remains on rc.54. No installed SDK file changed during this repair.
The game now separates public `world.step()` and `world.latest()` costs.
Contact-row counts do not mean active solver constraint counts.

A public API fixture reproduces stack motion without the game loop. It uses
400 touching boxes, one zero-shove wake, and the same physics settings. All
400 remain active after 359 neutral ticks. A shallow shape edit also wakes
this assembly. Removing only the game's repeated wake loop does not restore
sleep. These results isolate the activity from continued torch input.
They do not identify one faulty native function.

The smaller reproducible command is:

```sh
node scripts/repro-syncplay-stack-recovery.mjs --out test-results/mobile-repair/stack-repro.json --require-stable
```

It uses the installed public API. It checks two-box and ten-box columns,
created awake and woken once. It checks every frame, exact checkpoint replay,
and native disposal. The fixed stability gate is 0.01 m for two boxes and
0.05 m for ten boxes, with all ten asleep by frame 480. The published baseline
fails the ten-box gate. A failed stability command is expected evidence here.

An isolated source checkout uses exact rc.54 commit
`85634a6a35ab976aaec073832881e1465592b9eb`. Its location is
`.worktrees/syncplay-mobile-recovery/packages/syncplay` at repository root.
The separate unpatched build used the same compiler and flags. Its original
fixed snapshots matched the published package exactly.

Two local solver experiments were tested. Removing the closing-speed cap
on cached contact impulses did not stop the ten-box collapse. Seeding that
validated cache on every velocity substep prevented collapse, but every-frame
peak displacement was 0.140 m. It failed the unchanged 0.05 m gate.
Both experiments are rejected for adoption. Eight complete replay traces
and disposal checks passed. No new SDK version was published or installed.
Evidence is in `test-results/mobile-repair/native-small-stacks-comparison.json`.
