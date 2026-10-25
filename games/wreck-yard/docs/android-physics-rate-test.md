# Physical Android physics test

Use a real phone to compare device performance. A desktop viewport, a mobile user agent, an Android emulator, and desktop CPU throttling do not establish Galaxy S23 performance.

## Connect the phone

1. Connect the phone to the Mac with USB.
2. Enable Android developer options and USB debugging.
3. Accept the computer authorization on the phone.
4. Keep the phone unlocked. Keep Chrome installed.
5. Run `~/Library/Android/sdk/platform-tools/adb devices -l`. The phone must have status `device`.

Do not use an emulator for this test. The runner rejects the emulator serial prefix and the Android QEMU properties. It records the model, product, SoC, Android version, browser version, and available battery and thermal data. It does not record the device serial in the report.

## Run the shared physics cases

Start the local server from `games/wreck-yard`:

```sh
node scripts/serve-physics-rate-bench.mjs --port 4680
```

Use `--sdk /absolute/path/to/package` to select an extracted official SDK. This does not change the game's installed dependency. The server serves only SDK modules, JSON, WASM, and the two browser test modules. It binds to `127.0.0.1`.

In a second terminal, run one setting:

```sh
node scripts/run-physics-rate-browser.mjs --android --arm 30x5 --serialized-replay --output test-results/rate-search/android-30x5-a.json
```

Use `--serial DEVICE_SERIAL` if more than one authorized phone is connected. Use `--adb /absolute/path/to/adb` if needed. Keep output paths unique. The runner refuses to overwrite a report before it starts device operations.

The default configured velocity iteration count is six. Use `--iterations 16` to test another count. The accepted range is 1 to 32. The browser runner checks that the saved report uses the requested count. Native contact paths can use a higher minimum count than the configured value.

The runner creates a temporary ADB reverse connection for the local test page. It attaches to Chrome through CDP and creates one test page. It does not stop Chrome or change Chrome flags. Cleanup closes the owned page and CDP connection. It removes only port mappings it created. It saves a failure report if a browser or device operation fails.

The browser loads the real public physics API and production WASM. It verifies the WASM hash. It runs the same fixture as `sweep-physics-step-rates.mjs`. It checks stack rest, wake, shove response, a small collider edit, drop contact, checkpoint replay, and native resource release. Motion hashes cover every outer tick. Native and browser results can be compared by fixture hash, artifact hash, motion trace, and final digest.

The output reports API elapsed time per simulated second, per-tick costs, 30 Hz interval costs, one-second cost groups, quality gates, and replay results. This is an unpaced physics throughput test. It does not measure rendered game frame rate or input latency.

## Compare candidates

Run timing tests in sequence. Do not run a native timing test or another browser workload at the same time. Start with these orders:

1. Reference, candidate, candidate, reference.
2. Candidate, reference, reference, candidate.

Use the same device, browser, SDK, and fixture. Keep the phone's charging condition and display settings the same. Read battery temperature and available thermal status before and after each run. Repeat a pair if its thermal conditions differ. Missing thermal data must stay marked as unavailable.

Reject a setting if any physical, replay, or resource gate fails. Compare speed only after those checks pass. Keep a change only if its gain repeats beyond the variation between runs.

## Full game acceptance

A passing physics fixture selects a candidate. It does not establish full game acceptance.

Run each candidate from a separate game source copy. Set explicit substeps in `makeWorld()`. Keep 30 Hz game and room timing for a substep-only change. Generate a new runtime identity. Use matching source and identity on both peers. Record `world.info()` and artifact hashes. Stop the server before changing a candidate.

On the phone, run at least ten minutes of the same game route. Include walking, repeated stack torch cuts, light and heavy grabs, release and punt, portal crossings, buggy ramp and brake, and pause/resume. Include a second peer for join, leave, rejoin, and input-release checks. After the last cut, record at least 60 seconds of recovery.

Record actual display frame intervals, simulation tick costs, input latency, confirmed-frame delay, active bodies, cut backlog, native and JavaScript memory, and thermal state. Check that input and frame rate recover after work stops. Keep the game quality level and camera route the same between runs.

Set device acceptance limits before the route starts. Use these initial limits unless the product target requires stricter limits:

- No page error, engine error, replay mismatch, stuck input, or native resource imbalance.
- The 30 Hz simulation must keep pace with real time. Its step and output-read p95 must stay below 25 ms. Record the fraction of ticks above 33.33 ms.
- Target 60 display frames/s. Record the fractions of display intervals above 16.67, 33.33, and 50 ms. Do not infer display performance from physics throughput.
- During the final 30 seconds of recovery, display-interval p95 and physics-cost p95 must return within 10% of the initial idle values. The cut backlog must return to zero.
- Repeat the same route in both candidate orders. A gain must repeat with comparable device temperature and thermal status. Missing thermal data limits the result.

These limits are test criteria. No physical phone has passed them in this search.

Chrome testing does not establish behavior inside the RUN Android app. Check that host separately when it is available. Keep source files unchanged during all browser measurements.
