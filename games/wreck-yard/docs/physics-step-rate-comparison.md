# Physics step rate comparison

Date: 2026-10-23. Syncplay: `6.0.0-rc.66`. Host: Apple M5 Max, Node `v26.5.0`.

The previous advice to keep 30 Hz did not have a measured comparison against 60 Hz with one substep. This test supplies that comparison for one dense stack. It does not establish the best setting for all Wreck Yard scenes.

## Result

The 30 Hz, six-substep setting passed the stack checks. The 60 Hz, one-substep setting failed the wake and shove checks. Both fresh processes for each setting produced the same sampled motion hashes and terminal digests. Checkpoint replay also matched within every process. All worlds released their native storage.

The wake test starts with 400 boxes at rest. It wakes all boxes once, with no applied shove. A stable stack must move less than 5 cm and return to sleep.

| Wake test | 30 Hz × 6 | 60 Hz × 1 |
| --- | ---: | ---: |
| Maximum displacement from initial position | 0.003025 m | 18.691685 m |
| Last active sample after wake | 0.500 s | 16.000 s |
| Active boxes at the end of 16 seconds | 0 | 373 |
| Public step and output time per simulated second | 63.52–70.49 ms | 290.87–371.62 ms |

The first zero-active sample for 30 Hz × 6 occurs at 0.533 seconds. The 60 Hz × 1 result stays active through the final sample.

| Scene | 30 Hz × 6: API ms/s | 60 Hz × 1: API ms/s |
| --- | ---: | ---: |
| Asleep stack | 30.63–36.39 | 61.91–62.62 |
| Wake once | 63.52–70.49 | 290.87–371.62 |
| Shove bottom 40 boxes | 295.72–329.83 | 354.16–448.51 |

The shove test also shows a benefit of 60 Hz × 1. Its p95 API time per 1/30-second interval was 17.53–19.91 ms. The 30 Hz × 6 value was 49.32–50.70 ms. Maximum interval times were 29.40–35.29 ms and 68.53–280.97 ms, respectively. However, 391 boxes remained active after 16 seconds at 60 Hz × 1. All boxes slept at 30 Hz × 6 after the last active sample at 3.167 seconds.

Thus, 60 Hz × 1 reduced the shove timing spikes in this fixture. It failed the stability requirements. Keep the production setting unchanged on this evidence. This test does not show that six substeps are the minimum required.

## Method

The script is [compare-physics-step-rates.mjs](../scripts/compare-physics-step-rates.mjs).

- Run order: 30×6, 60×1, 60×1, 30×6. Each run uses a fresh process. Runs execute in sequence.
- Use the installed production WASM. Check its SHA-256 against the generated artifact metadata. Hash: `3de0319cd6f7b69eaa1b12fb7989f3c79b8b4ca9e49da74e4b93b5d3b6aff064`.
- Use 400 boxes, eight columns, five rows, and ten tiers. Each box has a 0.96 m edge and 1 kg mass. Stack friction is 0.85, as in the game. The floor friction is 0.82. Gravity is −13.5 m/s².
- Use six configured velocity iterations in both settings. Native contact paths can use higher minimum iteration counts.
- Warm the asleep stack for four simulated seconds. Capture one checkpoint. Measure the next 16 simulated seconds. Restore and replay those 16 seconds.
- Wake all boxes at the start of the wake and shove tests. For the shove, set the bottom 40 boxes to 6 m/s along positive Z once.
- Apply nominal equivalent damping per second. Syncplay applies damping once per outer tick. Therefore, at 60 Hz use the square roots of the 30 Hz linear and angular retention values, 0.98 and 0.945. Native velocity rounding prevents exact continuous equivalence.
- Read full output with `latest()` after each physics tick, as the game does. Group costs into equal 1/30-second intervals. A 60 Hz interval contains two steps and two output reads.
- Measure public `step()` and `latest()` elapsed wall time. Exclude checkpoint capture, restore, replay, motion checks, hashes, and disposal from the timing samples. One checkpoint stays retained during forward timing.
- Check finite motion at 30 Hz. Compare those motion samples and the terminal world digest during replay. These checks do not compare every intermediate 60 Hz frame.

30 Hz × 6 schedules 180 integration substeps each second, at 1/180 second each. 60 Hz × 1 schedules 60 substeps each second, at 1/60 second each. This compares two complete settings. It does not isolate an outer tick rate change.

Once motion differs, timing measures different resulting workloads. The wake cost includes the failure to settle at 60 Hz × 1. It does not prove that each active solver step is more expensive. The floor gate checks center height. It does not measure full shape penetration.

The test excludes game logic, rendering, networking, vehicles, portals, cutting, and physical mobile devices. It does not establish full game acceptance. Production source, settings, and deployment remain unchanged by this test.

An internal review found no test-method blocker. Automatic approval review blocked the required external `smart-route` review. Its reason was the possible transfer of private source and benchmark data to an unapproved model service. That external review did not run.

## Evidence and repeat command

Raw reports are under `test-results/step-rate-comparison/`:

- `abba-1-30x6.json`
- `abba-2-60x1.json`
- `abba-3-60x1.json`
- `abba-4-30x6.json`

Run from `games/wreck-yard`. Use new output paths on each repetition. The script refuses to overwrite a report.

```sh
node --expose-gc scripts/compare-physics-step-rates.mjs --arm 30x6 --output test-results/step-rate-comparison/repeat-1-30x6.json
node --expose-gc scripts/compare-physics-step-rates.mjs --arm 60x1 --output test-results/step-rate-comparison/repeat-2-60x1.json
node --expose-gc scripts/compare-physics-step-rates.mjs --arm 60x1 --output test-results/step-rate-comparison/repeat-3-60x1.json
node --expose-gc scripts/compare-physics-step-rates.mjs --arm 30x6 --output test-results/step-rate-comparison/repeat-4-30x6.json
```

The 60×1 command returns exit code 1 because its physical checks fail. Read its report before the next command. Do not connect the four commands with `&&`.
