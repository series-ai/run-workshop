# Mechanics audit

Run these commands from `games/wreck-yard`.

1. Start the local audit server with `node scripts/start-mechanics-audit.mjs`.
2. Run state checks with `node scripts/check-mechanics-audit.mjs`.
3. Record the six scenes with `node scripts/record-mechanics-audit.mjs`.
4. Open `http://127.0.0.1:4402/showcase/audit.html`.
5. Stop the audit server with Ctrl-C.

Both check and record commands accept scenario IDs:
`torch gravity jetpack water buggy impact`.

The harness uses `createInitialState` and `stepYard`. It renders the game
components with `projectYard`. Each output frame advances exactly one simulation
tick. The output is a 30 FPS offline replay. It does not measure real-time
performance or verify browser controls or networking.

Each scene has a disclosed initial setup. Tool rays start at the simulated
player's eye. No body or player pose changes occur after setup except through
the game simulation. The ray line and text are audit overlays.

The JSON files include every sampled state and each result check. A failed check
causes a nonzero command exit code. Video encoding starts in a temporary file.
The script replaces the final clip only when encoding completes. Inspect the
images and video as well as the JSON. A state check alone does not prove visual
quality.

The local server does not load the SDK playground wrapper. It disables hot
reload to prevent concurrent source edits from changing a recording. Reload the
page to test changed source files.

Set `AUDIT_URL` to use a different local harness URL. The default is `http://127.0.0.1:4402/scripts/mechanics-audit.html`.
