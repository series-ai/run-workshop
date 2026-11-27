---
name: run-micro-sprites
description: Author, validate, visually verify, and expand mixed-scale micro-pixel-art RTS units (8x8 8-way infantry, 14x12..18x16 8-way titans/flyers, 22x20 split-hull vehicles, 4x4 mega-swarm sprites), grounded buildings, and 8x8 Wang-16 dual-grid 2-layer terrain tilesets in tools/run-micro-sprites.
---

# RUN Micro-Sprites Workshop Skill

Use this skill whenever adding, redrawing, validating, or extending micro-RTS pixel-art sprites, buildings, terrain biomes, or the interactive battle showcase in `tools/run-micro-sprites/`.

## 1. Architecture & File Map

Zero-dependency TypeScript executed directly by Node 24 (`npm run build` / `node src/cli.ts`).

| File | Responsibility |
|---|---|
| `src/pixel.ts` | Software `PixelSurface` (`RGBA32`), `compilePattern`, `addPixelOutline`, `mirrorHorizontal`, `encodePNG`, `surfaceToDataURL` |
| `src/palette.ts` | Curated faction ramps (`vanguard`, `kraxen`, `solaris`), team-color overrides, `INK_OUTLINE` (`#130f1e`), `MINERAL_PALETTE`, `PROP_PALETTE` |
| `src/units.ts` | 6 `8×8` (outlined `10×10`) 8-way Infantry units (`N, NE, E, SE, S` authored + `SW, W, NW` mirrored) |
| `src/titans.ts` | 5 `14×12..18×16` 8-way Titans/Flyers + `COLOSSUS_EMITTER_8` + tank death wreckage frames |
| `src/tankIso.ts` | Production `22×20` (`24×22` outlined) 8-way split-hull + independent-turret Siege Tank, `TANK_HULL_PIVOT`, `TANK_MUZZLE_REL_8`, relighting & track-hugging contact shadows |
| `src/micro4.ts` | Ultra-micro `4×4` (`6×6` outlined) infantry for 1,000-unit mega-swarms |
| `src/buildings.ts` | Grounded micro-buildings (`16×14` to `32×25`) and props proportioned `2.5×–3.5×` above `8×8` infantry |
| `src/tileset.ts` | `8×8` Wang-16 dual-grid tileset (`128×64` atlas, 8 rows), 2-layer alpha cliff/ramp compositing, `buildDefaultBattleTilemap`, `renderTilesetProof` |
| `src/terrain.ts` | World & viewport dimension constants (`WORLD_W=512`, `WORLD_H=288`, `VIEW_W=480`, `VIEW_H=256`) |
| `src/cli.ts` | Exports PNG sprite sheets, `manifest.json`, uniform-background contact proofs, battle proofs, and `output/micro-rts-showcase.html` |

## 2. Hard Visual & Technical Laws

1. **Single-pass `1px` exterior outline weight**: Always wrap raw sprites once with `addPixelOutline(raw, INK_OUTLINE)` (`#130f1e`). **Never** place near-black interior keys (`k` `#202636` or `K`) along outer edges of tracks, barrels, wings, or helmets—that doubles the perceived outline weight to `2px`! Use mid-dark slate (`q`/`d`), plum (`u`/`r`), or bronze (`b`) on outer edges instead.
2. **True 3D 8-way silhouettes (no recycled diagonals)**: Every 8-way unit authors 5 base headings (`N`, `NE`, `E`, `SE`, `S`) and mirrors `SW`/`W`/`NW` horizontally (`DIRS_8 = ['N','NE','E','SE','S','SW','W','NW']`). `NE`, `E`, and `SE` MUST have unmistakably different idle silhouettes and clear front/rear landmarks **without** weapon flashes. Never reuse `SE` for `E` or `NE` for `N`.
3. **Value hierarchy (calm ground, vivid units)**: Terrain tiles stay mid-dark and low-saturation (`#253d2b..#7c6148` dirt/grass, `#2e1336..#592857` creep) so `8×8` units and glowing faction accents pop instantly at `1×` native scale.
4. **Grounded feet & bases**: Ground units anchor feet consistently on their bottom-most ground row (e.g., `y=14` on `16px`-tall Titans, `y=7` on `8×8` Infantry) across idle, move, attack, and death frames; buildings use flush bottom skirts so zero floating shadow gap appears.
5. **Exact weapon-origin & emitter pixel lock**: Muzzle flashes, beams, and orbs must originate on actual painted ports/barrels with clean separation (never plastered over the torso/helmet). Programmatically assert coordinates for emitters (`COLOSSUS_EMITTER_8`) and split-hull muzzles (`TANK_MUZZLE_REL_8`).
6. **Edge-exact Wang-16 terrain**: Transition tiles MUST evaluate `wangCoverage(x, y, mask)` with vertex-aligned `u = x / 7, v = y / 7` and border-zero organic modulation (`onBorder ? 0 : ...`). Elevated cliffs & ramps live on **Layer-1 with alpha transparency** composited over a continuous **Layer-0 ground biome**, never baked with a hardcoded ground color.
7. **Smooth 8-way demo steering**: Any live simulation must use angular hysteresis (`stepDir8Smooth`, `28°–32°` deadband, 1-octant step per cooldown), sticky targeting, and low-pass velocity filtering `(svx, svy)` so units never flicker across `22.5°` octant seams.

## 3. Authoring Workflows

### Adding a New `8×8` Infantry Unit or `14×12..18×16` Titan
1. Add the unit ID and `UnitSpec` in `src/units.ts` (or `TitanSpec` in `src/titans.ts`) with all 5 base directions (`N`, `NE`, `E`, `SE`, `S`) across `idle` (2f), `move` (4f), `attack` (4f or 5f), and `death` (3f).
2. Follow the archetype directional cue checklist in [`tools/run-micro-sprites/docs/UNITS_AND_8WAY_CRAFT.md`](../../../tools/run-micro-sprites/docs/UNITS_AND_8WAY_CRAFT.md).
3. Register the unit in `UNIT_SPECS` / `TITAN_SPECS` (and battle spawn pools in `src/cli.ts` if featured in the live skirmish).
4. For multi-part vehicles with independent turrets, follow the split-hull pattern in `src/tankIso.ts` (`22×20` core, per-heading `HULL_PIVOT`, relit mirrors, single-pass post-composite outline, verified 64-combo muzzle map).

### Adding a New Terrain Biome or Cliff Set
1. Add the biome palette ramp (3–5 low-saturation values) to `PAL` and `TileBiome` in `src/tileset.ts`.
2. Paint 4 seamless base fill variants in the atlas, plus Wang-16 transition rows using `wangCoverage()` with zero border jitter.
3. For elevated terrain/cliffs, paint an alpha-transparent Layer-1 row (`cliffTop -> cliffLit -> cliffDark -> cliffInk -> cliffShadowDeep -> cliffShadowSoft -> transparent`) and align ramp mouths strictly to the cliff vertex row (`RAMP_CLIFF_GY`).
4. Follow [`tools/run-micro-sprites/docs/TERRAIN_AND_WANG16.md`](../../../tools/run-micro-sprites/docs/TERRAIN_AND_WANG16.md) for full details.

## 4. Mandatory Build, Audit & Visual Verification Gate

Never claim a sprite or terrain pass is done until every step below passes:

```bash
cd tools/run-micro-sprites
npm run build
```

1. **Programmatic silhouette & emitter audit**:
   - Confirm `compilePattern` compiles every frame with zero width/height/palette errors.
   - Verify non-zero idle mask Hamming distance between `N`, `NE`, `E`, `SE`, `S` (especially `NE` vs `E` vs `SE`) and balanced pixel mass across headings (no `E`/`W` profile shrinkage).
   - Verify all beam emitters (`COLOSSUS_EMITTER_8`, 8/8) and split-hull muzzles (`TANK_MUZZLE_REL_8`, 64/64) land on painted `A1` flash/emitter pixels.
2. **Uniform-background contact proof inspection** (read the PNGs directly):
   - `output/proof-titans-16x16.png` (2 uniform-background rows per Titan: `Idle` + `Strike A1` across `N..NW`)
   - `output/proof-8x8-sprites.png` (2 uniform-background rows per Infantry: `Idle` + `Strike A1` across `N..NW` + buildings + `1×`/`2×` scale check)
   - `output/proof-tileset-8x8.png` (all 8 atlas rows + alpha-cliff checker + multi-biome diorama)
   - `output/proof-combined-arms-battle.png` (`1×` gameplay readability on real terrain)
3. **Independent art review**: For new 8-way sets or major redraws, delegate a review pass (e.g., Codex `gpt-6.2-astra`) checking the uniform-background Idle + Strike proofs for directional readability and weapon origins.
4. **Live motion check**: When editing animation timing, terrain collision, or steering in `src/cli.ts`, preview `output/micro-rts-showcase.html` (zero console errors) and record a short clip to confirm smooth 8-way turns with zero octant jitter.

## 5. Deep Reference Docs

- [`tools/run-micro-sprites/README.md`](../../../tools/run-micro-sprites/README.md) — Commands, manifest schema, and generated output map
- [`tools/run-micro-sprites/docs/UNITS_AND_8WAY_CRAFT.md`](../../../tools/run-micro-sprites/docs/UNITS_AND_8WAY_CRAFT.md) — Pixel-art craft rules for 8-way infantry, titans, split-hull tanks, 4×4 swarms, buildings, and anti-jitter steering
- [`tools/run-micro-sprites/docs/TERRAIN_AND_WANG16.md`](../../../tools/run-micro-sprites/docs/TERRAIN_AND_WANG16.md) — Wang-16 edge math, 2-layer alpha cliffs, ramp alignment, and biome palette discipline
