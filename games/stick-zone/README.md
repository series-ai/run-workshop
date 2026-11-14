# Stick Zone: Exfil

Stick Zone is a co-op extraction game on RUN. The game uses the existing Venus services. It has no custom backend.

## Authority

Deploy prepares an airlock through `api.extraction.prepareRaidAsync`. The game enters the spoke and reads confirmed squad state. The server owns player positions, item custody, extraction and settlement.

The local 60 Hz simulation supplies combat presentation, enemies, movement prediction and effects. Its kills and loot do not grant platform rewards. The current shared rules do not support enemy damage, healing or revive actions.

After the extraction corridor, `RaidCompletionFlow` waits for the SyncHub debrief. It accepts a settled result or a void result for the current raid. A failure offers Retry Debrief and Return to Hideout. An explicit server refusal also permits Return to Raid. After an accepted extraction request, retry waits for the debrief without sending that request again. The stash refreshes from the platform after completion.

Without a spoke, the game runs as practice. Practice completion banks no cash, items, XP, contract progress or raid statistics. The client has no settlement ledger. It does not claim to verify debrief signatures. Contract reward claims need server support and are disabled.

## Source

- `src/platform/synchub.ts`: typed SDK boundary.
- `src/sim/coopAdapter.ts`: intent mapping and confirmed state views.
- `src/sim/multiplayer.ts`: spoke connection and debrief requests.
- `src/sim/airlock.ts`: ingress and local extraction presentation.
- `src/sim/raidCompletion.ts`: practice, settled and void completion.
- `src/progression/stashStore.ts`: loadout controls and platform stash hydration.

## Local use

Run these commands from `games/stick-zone`:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npx playwright test
```

The development server uses port 58392. The build preview uses port 48392.

For real models, place `jam-ready-assets` next to the main `run-workshop` clone. Use its `main` branch. The staging script also accepts `INKLINE_PACK_DIR` pointing to `run-inkline`.

`INKLINE_FORCE_OFFLINE=1 npm run build` creates a build with empty asset manifests. This verifies compilation only. It is not a visual proof.

## Platform proof and remaining limits

`scripts/coop-stack-proof.mjs` runs two SDK clients against local Venus services. `scripts/coop-host-proof.mjs` runs two hosted browser clients. Read each script header for setup. These checks do not deploy or change shared cloud data.

The installed SDK version is 5.38.0. Its hosted transport uses the extraction RPC API. No packed SDK override is required. The earlier proof used a packed build because SDK 5.36.0 used mock extraction. Do not treat local practice or a test debrief as live settlement evidence.

The current co-op config and HUD use 4 Hz and 1,200 ticks for a five-minute raid. The drop clock starts from the confirmed server tick, so hub time does not use raid time. The requested platform cap change and movement scaling remain separate SyncHub work. Keep these values until the platform contract is verified.
