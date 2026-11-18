# run-poly-packs

Codified stylized faceted low-poly modular avatar and context-pack authoring pipeline built on the **Quaternius UAL1 53-joint CC0 rig** (`89` CC0 clips: UAL1 + UAL2 + KayKit 2H Rifle) and tuned for **120 Hz on Samsung Galaxy S23 Ultra**.

## Commands

```bash
npm install
npm run build       # Runs headless Blender 5.1 (build_core.py + build_packs.py) -> out/jam-stage/
npm run validate    # Verifies 53-joint parity, 89 clips, S23 Ultra triangle/draw budgets, weights, UVs, bounds
npm run catalog     # Exports catalog JSONs to ../../games/run-poly-showcase/public/catalog/
npm run stage -- --target ~/dev/jam-ready-assets [--packs core,medieval,ww2,sim]
npm test
npm run typecheck
```

## Documentation

- [Architecture & Pipeline Specification](docs/architecture.md)
- [Visual Direction & S23 Ultra Performance Law](docs/visual-direction.md)
