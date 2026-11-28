# RUN Micro-RTS Showcase

Interactive showcase & playable pixel-art RTS sandbox for **`run-micro-rts`** (`tools/micro-rts`), loading every sprite sheet, tileset, VFX strip, and UI asset from `jam-ready-assets` via `@series-inc/rundot-game-sdk` (pinned in `src/pins.ts` for production builds, or served directly from `~/dev/jam-ready-assets` in local dev).

## Run it

```bash
# 1. Build & stage the pack into jam-ready-assets (if you edited tools/micro-rts)
cd ../../tools/micro-rts
npm run build:all
npm run stage -- --target ~/dev/jam-ready-assets

# 2. Launch the showcase
cd ../../games/micro-rts-showcase
npm install
npm run dev        # http://localhost:5198
```

Other scripts: `npm run build:local`, `npm run preview` (port `4198`), `npm run typecheck`, `npm test`, `npm run build` (pinned production build), `npm run deploy`.

## Tabs

- **Live Skirmish** — Interactive 3-faction micro-RTS battle sandbox across all 4 planet biomes with drag-box selection, real perspective selection rings, Move/Attack ground pings, turret build-grid placement, 2-layer independent-turret tracking, discrete pixel beams/arcs, and tactical HUD bar.
- **84-Unit Roster & 2-Layer** — Searchable browser for all 72 faction units (`Vanguard`, `Kraxen`, `Solaris`) + 12 neutral units with live 8-way turntable, animation clip switcher (`idle`, `move`, `attack`, `death`), independent hull vs turret aiming for all 14 two-layer units, `muzzleCell8` overlay, and `1×` native scale readout.
- **Buildings (7 States)** — All 21 grounded faction buildings + props with interactive 7-state lifecycle scrubber (`build_1` → `rubble`), active loop toggle, and footprint/anchor metadata.
- **Biomes & Objects** — All 4 planet biome `8×8` Wang-16 tilesets, 3-frame animated hazards, H/V bridges, 4-way ramps, and 31 terrain objects.
- **Combat VFX Lab** — Live barrel-locked firing range for all 12 RTS attack archetypes + animated gallery of all 19 combat VFX sprite strips.
- **UI Chrome & Spec** — Full `run-micro-rts/ui` gallery (4×4 selection rings, 8 cursors, 5 world markers, 12 HUD icons), pack metrics, pinned leaf hashes, and RUN SDK loader snippet.
