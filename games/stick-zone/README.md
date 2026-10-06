# Stick Zone: Exfil

High-energy stickman extraction shooter built on `@series-inc/rundot-syncplay`'s SyncHub
airlock architecture. Fight automated facility defenses, scavenge crates, hold
extraction zones, and settle to the custody ledger.

## Setup

1. `npm install`
2. **Assets** (`public/run-inkline`): the absolute-path symlink to the local
   run-inkline stick-figure pack is NOT tracked. Create it:

   ```sh
   ln -s "$RUN_INKLINE_DIR" public/run-inkline
   # e.g. RUN_INKLINE_DIR=/Users/pany/dev/jam-ready-assets/run-inkline
   ```

## Development

```sh
npm run dev      # builds the server bundle, then vite dev on :5196
npm run preview  # same via vite preview on :4196
```

The authority server (`scripts/server.mjs`) requires `STICK_ZONE_SERVER_SECRET`:

```sh
STICK_ZONE_SERVER_SECRET=<uuid> npm run preview
```

## Tests

```sh
npm test         # runs pretest (esbuild server bundle) + vitest (117 cases)
npm run typecheck
```

## Recording gameplay proofs

Proofs record to `proofs/` (gitignored) via Playwright + ffmpeg. Requires chromium
(`npx playwright install chromium`), `ffmpeg` on PATH, and the same
`STICK_ZONE_SERVER_SECRET` the preview server uses. `window.debugSim` is compiled in
only when `VITE_EXPOSE_DEBUG_SIM` is set **at build time** (vite preview serves dist):

```sh
VITE_EXPOSE_DEBUG_SIM=1 npm run build                 # bake the debug hook in
STICK_ZONE_SERVER_SECRET=<uuid> npm run preview       # terminal 1
STICK_ZONE_SERVER_SECRET=<uuid> npm run record:proofs  # terminal 2
```

Set `PROOF_OUT_DIR` to archive proofs elsewhere. Each run wipes `proofs/raw_*`.

## Architecture

- `src/sim/*` — deterministic 60Hz sim, relay authority client (`multiplayer.ts`),
  SyncHub ExfilController adapter + settlement (`airlock.ts`), custody ledger
  (`server-settlement.ts`)
- `scripts/server.mjs` — settlement/relay HTTP+WS authority (machine attacks,
  holds, commits — runs under vite via `vite.config.ts`)
- `src/components/*` — R3F scene, stick operatives, machines, HUD/overlays

See `tests/stick-zone-sim.test.ts` for contract coverage of the authority pipeline.
