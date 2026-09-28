# Visual and mechanics audit

The old recordings did not prove successful mechanics or a live frame rate. The recorder changed the output rate to 60 FPS. It did not check the simulation result. The old showcase also printed fixed test and performance claims. Those pages are now marked as unverified captures.

## Confirmed faults

| Fault | Cause | Correction |
| --- | --- | --- |
| Buggy cabin blocked | A solid box outline enclosed the hollow voxel cabin. A second camera-mounted cockpit hid the real view. | Remove both false surfaces. Put the camera in the empty cabin. |
| Sliding wheels | Tires were fixed voxels. Drive code replaced chassis velocities, even in the air. | Use the SDK vehicle model and render wheel compression, steering, and rotation. |
| Missing player collision | Ground motion did not query scene shapes. | Use the SDK character controller for walls, platforms, and ceilings. |
| Moving-platform jumps | The character used platform velocity in meters per second as displacement per tick. | Convert velocity units at the character-query boundary. |
| False impact damage | Some SDK contact points were far outside the affected body. The counter also accepted cuts that removed no voxels. | Recover a surface point with a ray query. Count only actual voxel loss. |
| Objects fell through the floor | The visual floor, old heightfield, and rigid support did not agree. | Use a flat solid yard floor at the rendered height. Keep the separate water tank and ramp. |
| Scenery hid the buggy | Decorative props occupied the driving lane without matching collision shapes. | Move these props to the perimeter. |
| Driver passed through the roof | The avatar added standing height to the mounted player position. | Use the chassis pose and a seated visual pose inside the cabin. |
| Factory silhouettes appeared to float | Distant profiles ended above the yard floor, with no ground behind them. | Extend their lower edges below the horizon. Keep the roof profiles unchanged. |
| Diagonal contact-shadow stripes | Hard PCF comparisons produced visible bands at surface contacts. | Use PCF soft filtering. Keep the same map size, bias, and render passes. |
| Missing cut marks | React updates only compared body IDs and count. Surface cuts can keep both unchanged. | Compare voxel data and dimensions. Update occlusion after voxel edits. |
| Incorrect voxel edges | Macro occupancy lookup used volume dimensions. Empty-block traversal left the old face normal. | Use integer macro-cell lookup and update the crossed face normal. Compare GPU images against full traversal. |
| Dark voxel surfaces | The raw shader wrote linear colors to the screen without output conversion. | Convert to the renderer output color space. |
| Hidden water | The basin rim was one full opaque box. | Use four rim sections and open wall panels. |
| Extra render cost | Water glass transmission requested another opaque scene render. | Use transparent basin walls without transmission. |
| Wrong player aim | Yaw grew outside the input codec range. Observer cameras supplied tool rays. | Wrap yaw. Derive normal game rays from the simulation player. |
| Unwanted tool input | Mouse events were attached to the whole window. Held input survived focus loss. | Start tool input on the canvas. Clear held inputs on blur. |
| Camera lag | The camera used the previous render state before the runner update. | Refresh the camera after the runner update. |
| Wrong timing | The controller discarded elapsed time above 35 ms. | Pass elapsed time to the runner. Keep the runner's bounded update policy. |
| Replay mismatch risk | A simulation step read and removed a browser teleport request. | Remove browser state from the deterministic simulation. Proofs disclose their initial state instead. |
| False success reports | Showcase verification logged success even when players were absent. | Assert media load, playback time, viewport fit, and mechanic state results. |

## SDK issue

[Syncplay issue #4821](https://github.com/series-ai/venus/issues/4821) contains an independently run reproduction for `@series-inc/rundot-syncplay@6.0.0-rc.5`.

A capsule overlap query fails when a world contains a cooked voxel compound. Sphere and box queries succeed at the same empty location. This also prevents the normal SDK character-controller query path from working in the yard.

The application uses an enclosing box for character queries until the SDK defect is fixed. This is conservative near corners. It does not turn collision checks off.

[Syncplay issue #4822](https://github.com/series-ai/venus/issues/4822) reproduces the invalid contact point with only two primitive boxes. At yaw zero, the point is near the falling box at `(-6, 3)`. At yaw `-0.14`, it is near `(10.2, 14.8)`. The application recovers a surface point only when the reported point is outside the body.

[Syncplay issue #4823](https://github.com/series-ai/venus/issues/4823) reproduces the moving-platform unit mismatch without game code. A platform at 3 m/s carries the character 3 m in one call. The application converts this velocity to 0.1 m per tick at 30 Hz.

## Evidence

The current evidence is in `public/showcase/audit.html` and `public/showcase/audit/`.

- `manifest.json` stores each staged setup, state samples, and mechanic checks.
- `live-results.json` stores live browser input checks and frame timing.
- `gpu-results.json` compares accelerated and full voxel traversal.
- `playback-results.json` stores real video playback checks.

Offline clips show the real simulation and renderer. They do not establish live performance. A desktop browser with a narrow viewport does not establish phone performance. The capture script exits with an error if a mechanic check fails.

## Verification

The final simulation and rendering source passed all 110 tests in 25 files. These include a 120-tick vehicle checkpoint replay, idle stability, ramp takeoff and landing, braking, airborne motion, moving-platform carry, wall and ceiling collision, actual impact damage, and the existing network determinism checks. The identity check, TypeScript check, and production build passed. Vite still reports a large JavaScript bundle warning.

See `scripts/MECHANICS_AUDIT.md` for repeatable capture commands. Use `node scripts/verify-live-gameplay.mjs` with the development server on port 4400 for live input and GPU traversal checks. Use `node scripts/verify-showcase-pages.mjs` for media playback checks.

The new vehicle model is a Syncplay raycast vehicle. This report does not claim an exact match to Teardown's implementation. The impact clip proves local impact damage. The torch clip separately proves cutting and separation. The networking checks are automated; this audit does not claim a manual multiplayer playtest.

The final six clips passed their state checks with no browser errors. Decoded video samples and the before/action/after images were inspected. All six videos played at 390 px and 1440 px. Local-file playback also passed. The three GPU traversal comparisons had zero differing pixels and nonzero scene coverage.

On this Apple M5 Max, the final 120-frame desktop sample at 1440×900 and DPR 1 averaged 16.67 ms. The 95th percentile was 16.70 ms and the maximum was 16.80 ms. The simulation advanced 60 ticks in 2.01 seconds. The 390×844 mobile render path had similar timing on the same desktop GPU, with shadows disabled. Both input checks measured zero drift after movement stopped. These are short development-browser samples after movement, not phone, thermal, or heavy-destruction benchmarks.

The user approved external review on 2026-09-25. A dual `smart-route` review ran against an isolated source snapshot. The architecture review timed out after 180 seconds. Its Astra fallback also timed out after it could not read the local proof files. The controller exited with code 1 and produced no usable final review result.

Automatic approval review rejected a smaller, self-contained retry. It stated that sending private source to external model services was prohibited even with user approval. No further external attempt was made. The external review remains incomplete. The in-session Astra review and local checks above are separate completed checks.
