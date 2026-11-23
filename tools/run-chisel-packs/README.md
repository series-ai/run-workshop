# run-chisel-packs

Codified stylized faceted low-poly modular avatar, creature, handheld, and world-prop authoring pipeline built on the **Quaternius UAL1 53-joint CC0 rig** (`89` CC0 clips: UAL1 + UAL2 + KayKit 2H Rifle) plus **7 Mesh2Motion CC0 creature archetypes** (`Quadruped`, `Arachnid`, `Avian`, `Dragon`, `Kaiju`, `Serpent`, `Aquatic`) tuned for **120 Hz on Samsung Galaxy S23 Ultra**.

## Commands

```bash
npm install
npm run scaffold -- --list                                     # Print pack/budget/rig specs or scaffold a new asset
npm run build                                                  # Headless Blender 5.1 -> out/jam-stage/ + out/meta/manifest.json
npm run validate                                               # Verifies rig parity, 89+ creature clips, S23 Ultra budgets, weights, UVs, bounds
npm run catalog                                                # Exports catalog JSONs to ../../games/run-chisel-showcase/public/catalog/
npm run snapshot -- --out out/review/knight.png --views medieval_knight # Multi-angle Three.js contact sheet
npm run lineup -- --out out/review/scale.png monster_warhorse  # Side-by-side scale check next to 1.80m human gauge
npm run verify:visual -- --only '^(09|10)'                     # Capture the scenes and crowd bench after build:local
npm run stage -- --target ~/dev/jam-ready-assets               # Stage packs, License.txt, scripts/preview-inputs grids, preview-sources.json
npm run sync-pins -- --target ~/dev/jam-ready-assets           # Sync published leaf pins into games/run-chisel-showcase/src/pins.ts
npm test
npm run typecheck
```

## Compare shader lighting

Use `?lighting=fast` in the showcase URL to try the lightweight shader. To capture the same scene views in both modes, run `npm run verify:visual -- --only '^09' --lighting standard --out out/review/standard` and repeat with `--lighting fast --out out/review/fast`. Compare at the same resolution and measure frame times on the target device before changing the default.

## Expanding Packs (`jam-ready-assets`)

Add new and updated assets to `jam-ready-assets`.

1. `npm run build && npm run validate && npm run catalog`
2. In `../../games/run-chisel-showcase`, run `npm run thumbnails -- --all --force` (or `--pack <pack> --force`). Run `npm run build:local`.
3. In `tools/run-chisel-packs`, run `npm run verify:visual -- --only '^(09|10)'`. Inspect the captures in `out/visual-check`. The command checks browser errors and compact controls. Use the [visual guide](docs/visual-direction.md#6-world-prop-and-scene-review) to review shapes and fit.
4. Run `npm run stage -- --target ~/dev/jam-ready-assets`.
5. In `~/dev/jam-ready-assets`, run `npm run previews:generate && node scripts/build-manifest.mjs && npm run previews:check && npm test`.
6. In `tools/run-chisel-packs`, run `npm run sync-pins -- --target ~/dev/jam-ready-assets`. Verify `npm run build` in `games/run-chisel-showcase`.

## Add a theme

Use this sequence when the theme needs a new pack ID and its own catalog.

1. Add the ID, license, and asset paths to [the pack registry](contracts/data/packs.json) and [its schema](contracts/packs.ts). Add a brief and palettes to [the color contract](contracts/data/color-direction.json).
2. Wire the pack builders into [`build_packs.py`](blender/build_packs.py) and [`build_props.py`](blender/build_props.py). Reuse the Core rig for ordinary adults. Register each asset under a stable ID.
3. Add a review scene to the [showcase layouts](../../games/run-chisel-showcase/src/scenes/sceneLayouts.ts). Define its [terrain](../../games/run-chisel-showcase/src/scenes/sceneTerrain.tsx) and [cameras](../../games/run-chisel-showcase/src/scenes/stageLook.ts). Check the scene and follow the staging sequence above to generate the leaf pins.

## Documentation & Skills

- [Workshop Agent Skill](../../.agents/skills/run-chisel-assets/SKILL.md)
- [Architecture & Pipeline Specification](docs/architecture.md)
- [Visual Direction & S23 Ultra Performance Law](docs/visual-direction.md)
- [Authoring & Hardening Guide](docs/PACK_AUTHOR_GUIDE.md)
- [Creature Rigging, Skinning & Retargeting Guide](docs/CREATURE_RIGGING_AND_RETARGETING.md)

## Construction kits

A construction kit gives a creator two layouts that reuse parts from the same pack. Author the GLBs in the pack's Blender module. Put the layout recipes in `contracts/data/kits/<pack>.json`.

- List each prop by catalog ID. Give its position in metres and its optional yaw in radians.
- Use the layout's `route` to mark the floor height at each turn, step, or landing. Use `view` for the direction from the scene to the orthographic camera.
- Set `hideWithRoof` to `true` for a removable roof and any props that rest on it. Leave walkable decks in both views.
- Check the same structural pieces in two different assemblies. Join the room, doorway, and floor to the outside route.

Run `npm run build`, `npm run validate`, `npm run verify:kits`, and `npm run catalog` in this directory. Pass a pack after `--` to check its routes only. The route check samples the exported meshes for floor support, steps, obstructions, headroom, and width for the adult reference.

In the showcase, open **Context Stage**, select the pack, and choose a **Layout**. The **Roofs** control shows removable roof pieces where the recipe has them. Build the showcase with `npm run build:local`, then run `npm run verify:visual -- --only '^09-kit-'` in this directory to capture the desktop and 390 px views.
