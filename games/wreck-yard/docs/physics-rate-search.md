# Wreck Yard physics rate search

Date: 24 October 2026, Pacific time.

## Current result

The best tested rc.66 desktop candidate is **30 Hz, five substeps, and six configured velocity iterations**. Keep display interpolation independent of the simulation tick rate. Rc.70 does not pass sustained-touch acceptance at either five or six substeps. Hold the SDK upgrade while the cost increase and catch-up behaviour are investigated.

This is a desktop result, not a validated S23 setting. The user asked to continue without a physical phone. The game dependency, production physics settings, and deployment remain unchanged by this search.

The requested 30-minute wait began at `2026-10-25T00:44:15Z`. Rc.70 metadata and its direct archive still returned 404 after the window and in checks at `01:15:19Z` and `01:21:07Z`. The rc.66 control returned 200. Official rc.70 availability was first confirmed at `01:28:26Z`. The results below use that official artifact. Both rc.70 game settings pass all 540 cases and production builds. The conveyor test correction below explains the initial five-substep failure.

## Rc.66 screen

The first screen tested nine tick-rate and substep combinations. Each used six configured velocity iterations. All cases ran against the real public physics API and production WASM. No solver mock or source override was used.

| Setting | Result | Failed cases |
| --- | --- | --- |
| 30 Hz × 1 | Fail | Wake, shove, small edit |
| 30 Hz × 2 | Fail | Wake, shove, small edit |
| 30 Hz × 3 | Fail | Shove |
| 30 Hz × 4 | Fail | Shove |
| 30 Hz × 5 | Pass | None |
| 30 Hz × 6 | Pass | None |
| 60 Hz × 1 | Fail | Wake, shove, small edit, drop |
| 60 Hz × 2 | Fail | Shove |
| 60 Hz × 3 | Pass | None |

Six additional combinations tested more velocity iterations with fewer substeps. None passed all quality gates:

| Hz | Substeps | Configured iterations |
| ---: | ---: | ---: |
| 30 | 2 | 16 |
| 30 | 3 | 16 |
| 30 | 3 | 24 |
| 30 | 4 | 16 |
| 60 | 1 | 16 |
| 60 | 2 | 16 |

These results do not cover every supported setting. The SDK accepts up to 64 substeps and 32 configured velocity iterations. Its native contact paths can apply higher minimum iteration counts than the configured value. In rc.66, supported contacts can reach 16 iterations and cylinder contacts can reach 24. Therefore, the configured value alone does not state the total solver work.

## Rc.66 repeated cost comparison

The final version 3 comparison used separate processes in the order 6, 5, 5, 6 substeps. All runs used official rc.66, 30 Hz, and six configured velocity iterations. Each case measured 16 simulated seconds after a four-second warmup. The table shows elapsed public `step()` plus `latest()` time per simulated second. It does not show rendered frame time.

| Case | Five substeps: ms/s | Six substeps: ms/s | Reduction in mean cost |
| --- | ---: | ---: | ---: |
| Asleep stack | 28.51–28.86 | 30.58–31.26 | 7.21% |
| Wake once | 45.66–45.78 | 49.74–52.81 | 10.83% |
| Shove bottom layer | 189.21–192.70 | 203.48–209.60 | 7.55% |
| Small collider edit | 46.95–47.82 | 51.59–54.24 | 10.45% |
| Single-box drop | 0.17–0.18 | 0.18–0.20 | 7.87% |

The reduction is `100 × (1 − mean(five) / mean(six))`. The four stack cases show a 7.21–10.83% reduction in this final comparison. Each setting has two process runs. These samples do not establish a confidence interval.

All five cases in all four runs passed their physical gates, exact native checkpoint replay, and disposal checks. Within each setting, all five per-tick motion trace hashes and terminal digests repeated exactly. They also match the archived version 1 traces and digests for that setting. Different settings can produce different trajectories and workloads.

The reports are `final-paired-1-30x6.json`, `final-paired-2-30x5.json`, `final-paired-3-30x5.json`, and `final-paired-4-30x6.json` under `test-results/rate-search/rc66/`. All four report the same hashes:

- Fixture: `c60ead1c161d6f2384ddd9ba65ed02ba846a7dd824f3534e5449aff9a0177205`.
- Node runner: `d620f96cd1650abe4431e23a414bc6ec3c57f07328498884745dfb348691a006`.
- Production WASM: `3de0319cd6f7b69eaa1b12fb7989f3c79b8b4ca9e49da74e4b93b5d3b6aff064`.

The result record stores each report hash, exact costs, reduction values, host load samples, and trace checks. These runs used Node `v26.5.0` on an Apple M5 Max. The one-minute host load samples ranged from 4.90 to 5.60.

The archived version 1 comparison used the same process order and durations. Its results remain valid for that session:

| Case | Five substeps: ms/s | Six substeps: ms/s | Reduction in mean cost |
| --- | ---: | ---: | ---: |
| Asleep stack | 26.48–26.85 | 28.43–28.73 | 6.69% |
| Wake once | 42.79–42.79 | 46.63–46.85 | 8.46% |
| Shove bottom layer | 177.15–179.32 | 189.21–189.85 | 5.96% |
| Small collider edit | 43.90–44.06 | 48.02–48.34 | 8.71% |

The final session had higher absolute costs for both settings. These reports do not establish the cause. Do not infer a fixture regression or a host-load cause from the difference between sessions. Neither comparison establishes the same percentage gain in game frame rate, phone battery life, or thermal performance.

The 60 Hz × 3 candidate passed the screen and long recovery checks. Its single-screen costs were higher than both 30 Hz candidates: 45.87 ms/s asleep, 68.59 ms/s after wake, and 269.43 ms/s for the shove. This candidate does not justify a full game migration to 60 Hz on the current evidence.

## Rc.70 screen

The rc.70 screen used the same fixture, physical gates, durations, and Node runner as the final rc.66 comparison. All nine default configurations used six configured velocity iterations. Their pass and failed-case results match the rc.66 screen table. Only 30 Hz × 5, 30 Hz × 6, and 60 Hz × 3 passed all five cases.

Four additional screens tested fewer configured iterations:

| Hz | Substeps | Configured iterations | Result | Failed cases |
| ---: | ---: | ---: | --- | --- |
| 30 | 5 | 1 | Fail | Shove bottom layer, Small collider edit |
| 30 | 5 | 4 | Pass | None |
| 30 | 6 | 1 | Fail | Shove bottom layer |
| 30 | 6 | 4 | Pass | None |

The one-iteration settings fail physical gates. Their low times do not qualify them as candidates. Four iterations pass the short gates, but the saved screens show no clear cost advantage over six. The four-iteration five-substep shove costs 566.88 ms/s and has its last active tick at 9.37 simulated seconds. The six-substep case costs 322.19 ms/s and has its last active tick at 3.40 seconds. These are single screens, not paired timing results. The four-iteration candidates have no long-run or full-game acceptance result.

The 60 Hz × 3 screen passes. Its shove costs 399.45 ms/s. Its 1/30-second cost-group p95 is 45.12 ms and p99 is 49.45 ms. It does not establish a reason to migrate the full game to 60 Hz.

## Rc.70 paired cost and recovery comparison

Six separate processes ran in this order: rc.70 six substeps, rc.70 five, rc.66 five, rc.66 five, rc.70 five, rc.70 six. Each used 30 Hz and six configured velocity iterations. Each case measured 16 simulated seconds after four seconds of warmup. This gives an outer 6, 5, 5, 6 comparison within rc.70 and an inner rc.70, rc.66, rc.66, rc.70 comparison at five substeps.

All five cases in all six processes passed the physical gates, exact native checkpoint replay, and disposal checks. Within each SDK and setting, all per-tick motion traces and terminal digests repeated exactly.

| Case | Rc.66 five: mean ms/s | Rc.70 five: mean ms/s | Rc.70 six: mean ms/s | Rc.70 five vs six |
| --- | ---: | ---: | ---: | ---: |
| Asleep stack | 26.90 | 34.37 | 36.24 | -5.15% |
| Wake once | 42.89 | 52.05 | 56.64 | -8.10% |
| Shove bottom layer | 177.99 | 359.10 | 306.72 | +17.08% |
| Small collider edit | 44.86 | 53.02 | 57.68 | -8.07% |
| Single-box drop | 0.16 | 0.18 | 0.18 | -2.17% |

A negative percentage means that five substeps use less total API time. In the shove case, six substeps use less total API time. The peak and recovery results point in different directions:

| Shove measure | Rc.66 five | Rc.70 five | Rc.70 six |
| --- | ---: | ---: | ---: |
| Per-run p95: ms | 23.04–23.08 | 33.12–33.39 | 43.97–44.34 |
| Per-run p99: ms | 23.46–23.66 | 36.86–37.99 | 46.71–47.09 |
| Ticks above 33.33 ms: % | 0.21 | 3.12–5.42 | 21.46 |
| Last active tick: simulated seconds | 3.67 | 5.47 | 3.40 |

These p95 and p99 ranges contain one percentile from each process. They are not pooled percentiles. The over-budget count uses public `step()` plus `latest()` time per outer tick. It does not include rendering or other game work. Each process measures 480 ticks in each case. Rc.70 five substeps exceed the 33.33 ms API budget on 15 and 26 shove ticks. Six substeps exceed it on 103 ticks in each run. All other cases in this paired set have no over-budget ticks.

The last active tick measures simulated recovery. It is not wall-clock recovery. Five substeps have lower measured long-tick costs. Six have lower total shove cost and an earlier final active tick. Both pass the fixed quality gates. These data do not identify one setting as best for every workload. Five substeps qualify as a lower-peak native-fixture candidate only. The later sustained-touch failure rejects rc.70 adoption. No physical phone result is claimed here.

## Rc.70 comparison with rc.66

At five substeps, rc.70 matches rc.66 exactly for all per-tick motion hashes and terminal digests in rest, wake, small edit, and drop. The shove trajectory and digest differ. At six substeps, only rest and drop match the saved rc.66 reference. Wake, small edit, and shove differ. Exact replay within a version does not establish identical motion across versions.

| Five-substep case | Rc.70 mean API cost change from rc.66 | Exact motion trace and digest |
| --- | ---: | --- |
| Asleep stack | +27.79% | Yes |
| Wake once | +21.36% | Yes |
| Shove bottom layer | +101.75% | No |
| Small collider edit | +18.19% | Yes |
| Single-box drop | +8.18% | Yes |

The matched-motion cases show higher public API cost on rc.70 in this host session. The shove also has a different contact and recovery workload. Its cost increase does not measure pure solver slowdown. Public API timings include facade work and output conversion. A source audit found byte-identical public `dist` JavaScript and declarations from rc.66 to rc.70. That static result does not establish native behavior parity.

The rc.70 production WASM SHA-256 is `b75fd9da365636da6850b8bd7ebd38e4b93bbb33ae15be9b03853c9f80229543`. All 13 screen reports and all six paired reports use fixture `c60ead1c161d6f2384ddd9ba65ed02ba846a7dd824f3534e5449aff9a0177205` and Node runner `d620f96cd1650abe4431e23a414bc6ec3c57f07328498884745dfb348691a006`. The result record stores report hashes, exact costs, per-run percentiles, over-budget fractions, recovery values, host load samples, and cross-version trace checks. Each paired group has two process runs. These samples do not establish a confidence interval.

Both rc.70 candidates also pass all five cases over 80 measured simulated seconds. Every case passes exact native checkpoint replay and serialized checkpoint restore replay. All owned native storage returns to zero. The full recovery tail after 12 seconds stays asleep. These checks do not replace full-game or physical-phone acceptance. The separate full-game results follow below.

## Conveyor test correction

The original rc.70 full game suite passed 539 of 540 cases at five substeps. Six substeps passed all 540. The failed five-substep case checked the conveyor probe's centre height after release. It expected a centre below −0.52 m. The actual centre was −0.507932 m.

Four separate game traces compared rc.66 and rc.70 at five and six substeps. All four probes had left the belt and had a current floor contact at the deadline. The rc.70 five-substep cube was tilted. Its rotated lower bound was −0.860395 m, within 0.4 mm of the floor at −0.86 m. The high centre did not show a failed release. All four lower bounds were within 7.74 mm of the floor.

The test now checks the rotated lower bound within 2 cm of the floor. It also requires a current floor contact and no current belt contact. The carry distance, floor control, exit event, X position, native replay, and serialized replay checks remain. The corrected four-test file passes on both SDK versions at both substep counts. An independent review checked the geometry against the traces. The original failed report remains preserved. The complete corrected five-substep rc.70 suite passes all 540 cases.

## Rc.70 game checks

Separate game copies use the official rc.70 package at five and six substeps. All 597 installed SDK files match the verified archive in each copy. The copies use Game SDK 5.28.0, separate runtime identities, and 30 Hz game and room timing. No source override is active.

Both settings pass all 540 game cases. Five substeps pass the complete suite with the corrected conveyor check. Six substeps pass the original complete suite and the corrected four-test conveyor file. Both settings also pass identity verification, TypeScript, and a Vite production build. Their `world.info()` records show 697 bodies, one fluid, the requested substep count, six configured iterations, and the official rc.70 production artifact hash.

Both real Chrome touch routes failed the sustained-input check. The torch stopped while the test still held its touch. Both routes made real cuts, released input safely, and completed the six ten-second recovery segments. No page or engine error was recorded. All 210 source hashes and timestamps stayed unchanged during each run.

The controller changed from `live` to `connecting` under torch load. The UI then removed the touch controls and cleared capture. The capture-loss event still had `buttons=1`. Neither run recorded blur, visibility change, resize, pointer cancellation, or touch cancellation during the held stroke.

Both traces reached 402 active bodies. Native step-and-read p95 reached 63.58 ms at five substeps and 73.60 ms at six. Pump p95 reached 123.49 and 135.05 ms. The game work before physics stayed below 0.6 ms at p95. The first runs did not record the raw runner state.

An instrumented five-substep repeat used the same harness on rc.66 and rc.70. Rc.66 passed all six checks and ten segments. Rc.70 repeated the held-input failure. Its runner changed to `syncing` at 19,614 ms with `connection: connected`, `ready: true`, `recoveryPhase: catching-up`, and a seven-tick backlog. It had applied tick 553 while the authority frontier was 560. It returned to `live` at 21,572.5 ms. The rc.66 held stroke had no runner-state transition.

This repeat confirms catch-up while the transport stays connected. The app maps SDK `syncing` to its generic `connecting` state. That mapping is a separate application integration issue. It removes controls during catch-up as well as during a connection loss. A better mapping must distinguish those conditions. It will not remove the measured physics CPU overrun. This search leaves production input behaviour unchanged.

The recovery segments follow an interrupted stroke. They do not prove recovery after ten seconds of continuous torch input. No rendered frame-rate gain is claimed from these two runs.

The five-substep copy passed the basic two-peer URL join, leave, rejoin, invalid-room recovery, movement, and interpolation test. Both substep counts passed the browser physics fixture. All five browser motion traces and final digests match Node for the same SDK and setting. These passes do not override the sustained-input failure.

The current main project also passes `npm run build` with the installed rc.66 dependency and source overrides disabled. All owned test browsers and local servers were closed after the checks.

## Rc.66 stability and game checks

Each of the three passing screen candidates also passed five cases over 80 measured simulated seconds. Each case included exact native checkpoint replay and serialized checkpoint restore replay. All owned native storage returned to zero after disposal. The recovery gate checks the complete tail after 12 seconds, not only the final sample.

Separate game source copies tested five and six substeps. Both copies passed:

- All 540 existing game tests against the real native physics runtime.
- Runtime identity verification, TypeScript, and a Vite production build.
- A read of `world.info()` showing the requested substep count, 30 Hz, six configured velocity iterations, and the official production artifact hash.
- The real Chrome touch route to the storage stack, torch use, and all 60 seconds of recovery. Each browser run passed six checks and ten segments. Neither recorded a browser page or engine error.

The five-substep copy also passed the two-peer browser test for URL joining, leaving, rejoining, invalid-room recovery, movement, and display interpolation. That test deliberately produces invalid-room errors. It had no browser page errors.

Node and desktop Chrome produced identical per-tick motion traces and terminal digests for all five cases at both five and six substeps. The explicit browser iteration path also matched Node at 30 Hz × 3 substeps × 16 iterations, including its expected quality failures.

All 210 source file hashes and timestamps in each game copy stayed unchanged during the browser checks. The copies used separate runtime identities. No shared simulation source was edited during a browser run.

## Rc.66 live torch observations

These are observations from the live touch route. They are not a controlled frame-rate gain claim. The five-substep run made 16 cuts. The six-substep run made 14 cuts. Both ended with no fractures and the same rendered body count.

| Phase | Five substeps: native step and read p95 | Six substeps: native step and read p95 |
| --- | ---: | ---: |
| Idle | 2.90 ms | 3.00 ms |
| Torch held | 31.75 ms | 33.86 ms |
| Last recovery interval | 3.00 ms | 3.50 ms |

Both runs returned to about 60 display frames/s in the final recovery interval. Both had a median of two active bodies there. During held torch use, mean display rates were about 51.86 and 51.07 frames/s. The cut counts differ, so these values do not prove that the physics change caused a frame-rate gain.

The final rc.66 paired comparison supports a 7.21–10.83% reduction in API cost for the four stack cases. It does not establish the same percentage gain in game frame rate, phone battery life, or thermal performance.

## Method and limits

The shared fixture is [physics-rate-fixture.mjs](../scripts/physics-rate-fixture.mjs). The Node runner is [sweep-physics-step-rates.mjs](../scripts/sweep-physics-step-rates.mjs).

- The stack has 400 boxes in eight columns, five rows, and ten tiers. Box edge length is 0.96 m. Mass is 1 kg. Friction is 0.85. Gravity is −13.5 m/s².
- Inputs use SI units. The shove gives the bottom 40 boxes 6 m/s along positive Z once.
- Each physics tick reads `latest()`. Equal 1/30-second cost groups contain one 30 Hz tick or two 60 Hz ticks.
- Damping applies once per outer tick. At 60 Hz, the fixture uses the square roots of the 30 Hz retention values, 0.98 and 0.945. This matches nominal retention per second. Native rounding prevents exact equivalence.
- Finite motion and replay hashes cover every outer tick. The replay trace hashes the ordered per-tick motion hashes. The terminal native world digest must also match.
- Wake and small-edit displacement must stay below 5 cm. Floor penetration uses the full rotated box extent and must stay within 5 cm.
- At six seconds, more than 20 bottom bodies must move horizontally over 6 cm. More than 20 top bodies must move over 1 cm. Each response must exceed both the initial position and the matched wake-only control.
- The small edit occurs four seconds after wake. It reduces box 399 half-X from 0.48 to 0.47 m and preserves pose, velocity, mass, and inertia. The 12-second recovery deadline gives this edit eight seconds to recover.
- The drop uses a single box, a two-metre drop, and damping 1. It checks contact time, floor penetration, rebound height, and rest. It does not verify impact impulse strength.
- Checkpoint capture, restore, replay, hashes, checks, and memory reads are outside the timed API calls. These operations can still affect caches and garbage collection. One checkpoint stays retained during forward timing.
- Timing processes run in sequence. The host is an Apple M5 Max with Node `v26.5.0`. Chrome is `155.0.8059.86`.

The rc.66 production WASM SHA-256 is `3de0319cd6f7b69eaa1b12fb7989f3c79b8b4ca9e49da74e4b93b5d3b6aff064`.

A 60 Hz full-game change requires more work than changing the physics definition. Fuel use, torch cadence, cooldowns, damping, grab response, runner pacing, room timing, and runtime identity must remain consistent in real seconds. The current room and game run at 30 Hz. Physics settings must also match across peers. Do not choose a different physics setting independently on each device.

## Device limits

No S23 or other physical Android device was available. The user asked to continue without a physical phone. The physical-device runner correctly rejected the empty ADB inventory and saved its failure report. Desktop touch emulation is not a physical phone test.

The browser runner passed a normal Chrome run, failure-report preservation, and SIGTERM cleanup. The first cancellation probe reached an HTTP navigation error before cancellation. A second probe used a valid non-test page and verified cancellation plus cleanup. Both records remain preserved.

Use [the Android test instructions](android-physics-rate-test.md) for the connected-phone test. The runner records the actual device and available thermal data. A separate ten-minute full-game route is still required for sustained phone acceptance.

Rc.70 has passed the short screen, long replay checks, game tests, and production builds at five and six substeps. It fails sustained touch input in the live game. Investigate that failure and the measured API cost increase before an SDK upgrade.

## Evidence and repeat commands

The compact result record is [physics-rate-search-results.json](physics-rate-search-results.json). Full local reports are under `test-results/rate-search/`. Native reports are under `rc66/` and `rc70/`. The `rc66/` directory also contains game test JSON, build logs, runtime info, repeated timings, browser traces, and screenshots.

The exact original fixture and Node runner are preserved in `test-results/rate-search/frozen-v1/scripts/`. Version 2 changes only the progress label to `preliminaryPass`. Version 3 adds the explicit iteration parameter. The physical gates stay unchanged. Final saved report gates decide the result; progress messages do not.

Run one setting in each process. Use fresh output names. Do not run timing processes in parallel.

```sh
node --expose-gc scripts/sweep-physics-step-rates.mjs --arm 30x5 --output test-results/rate-search/repeat-30x5.json
node --expose-gc scripts/sweep-physics-step-rates.mjs --arm 30x6 --output test-results/rate-search/repeat-30x6.json
node --expose-gc scripts/sweep-physics-step-rates.mjs --arm 30x5 --seconds 80 --serialized-replay --output test-results/rate-search/long-30x5.json
node --expose-gc scripts/sweep-physics-step-rates.mjs --arm 30x3 --iterations 16 --output test-results/rate-search/reject-30x3-v16.json
```

Use `--sdk /absolute/path/to/package` for another extracted official SDK. A quality failure returns exit code 1 and saves the failed gates. Keep failed reports. Compare only matching fixture, SDK artifact, duration, and host conditions when ranking timing results.

## Upstream investigation prompt

```text
Investigate a production-WASM performance regression from Syncplay 6.0.0-rc.66 to rc.70 in Wreck Yard. Keep 30 Hz game/authority timing and independent display interpolation. Do not reduce physical quality to make the timing pass.

The best tested rc.66 desktop setting is 30 Hz, five substeps, six configured velocity iterations. At rc.70, five substeps have lower long-tick costs than six, but neither passes sustained touch input in the live game. One configured iteration fails physical gates. Four gives no clear gain. 60 Hz x1/x2 fail physical gates. 60 Hz x3 passes the fixture but has higher API cost. The search is bounded, not a global optimum.

Use the real public step() and latest() API and the official production artifacts. No mocks or source override were used. The host is Apple M5 Max, Node 26.5.0, Chrome 155. No physical Android result is claimed. The user chose desktop testing only.

WASM SHA256:
rc66: 3de0319cd6f7b69eaa1b12fb7989f3c79b8b4ca9e49da74e4b93b5d3b6aff064
rc70: b75fd9da365636da6850b8bd7ebd38e4b93bbb33ae15be9b03853c9f80229543

At 30x5-v6, an interleaved rc70,rc66,rc66,rc70 comparison shows mean public API cost increases of 27.79% asleep, 21.36% after wake, 18.19% after a small collider edit, and 8.18% for a single-box drop. Those cases have identical per-tick motion hashes and terminal digests across versions. The shove costs 177.99 ms/s on rc.66 and 359.10 ms/s on rc.70 (+101.75%), but its trajectory and active duration differ. Do not describe that percentage as pure solver slowdown.

On rc.70, the shove's per-run p95 is 33.12–33.39 ms at five substeps versus 43.97–44.34 ms at six. Six has lower total shove cost and settles sooner. Both pass all physical gates, 80-second recovery, exact native and serialized replay, and native resource release. Both game settings pass 540 cases and production builds. The one initial conveyor failure was a test-oracle error: a tilted cube had valid floor support. That test now checks rotated bounds and current contacts. Preserve the initial failed record.

Live Chrome touch tests reach 402 active bodies. Step+latest p95 reaches 63.58/73.60 ms at five/six substeps. Both held torch strokes lose controls during a controller live-to-connecting transition. An instrumented repeat shows the rc.70 runner enters syncing while connection stays connected and ready stays true; recoveryPhase is catching-up, backlog 7, applied 553, authority 560. It returns live after about 2 seconds. The same rc.66 control passes all six checks and ten segments with no held-stroke status transition. There are no page/engine errors. The 60-second recovery follows an interrupted stroke, so it is not acceptance of continuous torch load.

Profile the native and facade costs separately. Audit the new ordinary-body tick charts, conservative interval bounds, manifold preparation cache, topology edits, and checkpoint work. These are profiling candidates; no native function has been proved responsible. Keep exact replay and physical gates. Check portal crossings, compound fragments, and vehicle contacts before accepting a native fix.

Keep the app issue separate: it maps SDK syncing to connecting and removes touch controls even while the transport is connected and ready. Document the intended handling of temporary catch-up. A UI fix cannot remove the CPU overrun. Do not call this a confirmed transport reconnect.

Repeat the shared fixture in fresh serial processes from games/wreck-yard:
node --expose-gc scripts/sweep-physics-step-rates.mjs --sdk /path/to/official-sdk --arm 30x5 --output /new/report.json
node --expose-gc scripts/sweep-physics-step-rates.mjs --sdk /path/to/official-sdk --arm 30x5 --seconds 80 --serialized-replay --output /new/long-report.json

The fixture, gates, exact numbers, report hashes, live-game records, and Android runner instructions are in docs/physics-rate-search.md and docs/physics-rate-search-results.json. Raw local evidence is under test-results/rate-search/rc66 and rc70. Repeat a fixed torch route with runner state, authority frontier, applied/predicted ticks, backlog, frame intervals, native memory, and recovery telemetry. Accept a change only after the real game keeps its held input and recovers under load.
```
