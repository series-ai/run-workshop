# run-chisel-packs

Codified stylized faceted low-poly modular avatar, creature, handheld, and world-prop authoring pipeline built on the **Quaternius UAL1 53-joint CC0 rig** (`89` CC0 clips: UAL1 + UAL2 + KayKit 2H Rifle) plus **7 Mesh2Motion CC0 creature archetypes** (`Quadruped`, `Arachnid`, `Avian`, `Dragon`, `Kaiju`, `Serpent`, `Aquatic`) tuned for **120 Hz on Samsung Galaxy S23 Ultra**.

## Commands

```bash
npm install
npm run scaffold -- --list                                     # Print pack/budget/rig specs or scaffold a new asset
npm run build                                                  # Headless Blender 5.1 -> out/jam-stage/ + out/meta/manifest.json
npm run validate                                               # Verifies rig parity, 89+ creature clips, S23 Ultra budgets, weights, UVs, bounds
npm run catalog                                                # Exports catalog JSONs to ../../games/run-chisel-showcase/public/catalog/
npm run snapshot -- --out out/review/knight.png --views knight # Multi-angle / multi-phase Three.js contact sheet
npm run lineup -- --out out/review/scale.png monster_warhorse  # Side-by-side scale check next to 1.80m human gauge
npm run stage -- --target ~/dev/jam-ready-assets               # Stage packs, License.txt, scripts/preview-inputs grids, preview-sources.json
npm run sync-pins -- --target ~/dev/jam-ready-assets           # Sync published leaf pins into games/run-chisel-showcase/src/pins.ts
npm test
npm run typecheck
```

## Expanding Packs (`jam-ready-assets`)

Whenever you add new assets or expand any `run-chisel-*` pack, **we recommend publishing those new/updated assets into the `jam-ready-assets` repo** (not leaving them local-only):

1. `npm run build && npm run validate && npm run catalog`
2. In `../../games/run-chisel-showcase`: `npm run thumbnails -- --all --force` (or `--pack <pack> --force`)
3. `npm run stage -- --target ~/dev/jam-ready-assets`
4. Inside `~/dev/jam-ready-assets`: `npm run previews:generate && node scripts/build-manifest.mjs && npm test`
5. Back in `tools/run-chisel-packs`: `npm run sync-pins -- --target ~/dev/jam-ready-assets`, then verify `npm run build` in `games/run-chisel-showcase`

## Documentation & Skills

- [Workshop Agent Skill](SKILL.md) (also mirrored in `.agents/skills/run-chisel-assets/SKILL.md`)
- [Architecture & Pipeline Specification](docs/architecture.md)
- [Visual Direction & S23 Ultra Performance Law](docs/visual-direction.md)
- [Authoring & Hardening Guide](docs/PACK_AUTHOR_GUIDE.md)
- [Creature Rigging, Skinning & Retargeting Guide](docs/CREATURE_RIGGING_AND_RETARGETING.md)
