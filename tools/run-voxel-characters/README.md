# RUN Voxel Characters (`tools/run-voxel-characters`)

Teardown-style **5 cm orthogonal voxel character, outfit, weapon/tool, beast, and world prop generator** built on the shared **53-joint Quaternius UAL1 CC0 rig (43 clips)** plus **23-joint Quadruped** and **28-joint Arachnid** creature rigs, packaged for `jam-ready-assets` and **120 Hz on Samsung Galaxy S23 Ultra**.

---

## Quick Start

```bash
cd tools/run-voxel-characters
npm install
npm run build        # Build all 5 packs via Blender 5.1 -> out/jam-stage/ + out/meta/
npm run validate     # Verify orthogonal normals, budgets, sculpt lattice, silhouette, UV0/UV1, morphs, ragdolls & clip audits
npm run validate:creature -- <creature.glb>   # Check a creature that blender/creature_kit.py wrote on an external rig
npm run catalog      # Export catalogs to games/voxel-character-showcase/public/catalog/
npm run typecheck && npm test
```

Launch the interactive 3D showcase (`http://localhost:5195`):

```bash
cd ../../games/voxel-character-showcase
npm install && npm run dev
```

Or run automated headless Playwright + WebGL visual verification (saves PNGs to `out/previews/`):

```bash
node tools/run-voxel-characters/scripts/verify-visual.mjs
```

---

## Packs Generated (`out/jam-stage/`)

| Pack Directory | Context | Key Contents |
|---|---|---|
| `run-voxchar-core` | Core UAL1 Rig & Bodies (CC0-1.0) | 53-joint UAL1 skeleton + 43 clips, `body_slim`/`body_athletic`/`body_heavy`, 6 sculpted `3×5×4` heads, 6 layered voxel hairstyles (the `5×7` head envelope) |
| `run-voxchar-heist` | Heist & Demolition | Sledgehammer hero tee & jeans, belted tunic & red bob hat, open jacket & scarf, tattoo scout vest & shorts, detonators, crowbar, backpack, rubble/vault props |
| `run-voxchar-industrial` | Workshop & Industrial | Weathered handyman shirt w/ blue work gloves & waist pack, mechanic apron, cargo pants, knit beanie, hard hat, pipe wrench, blowtorch, tool chest & drum props |
| `run-voxchar-security` | Security & Cyber-Tech | Collared guard uniform w/ utility belt & peaked cap, tactical knee-pad trousers, cyber-enforcer harness w/ glowing emissive visor/eye, riot shield/helmet, pistol, terminal props |
| `run-voxchar-creatures` | Voxel Beasts & Bots | Guard Hound (`quadruped` 23-joint rig), Scrapyard Spider (`arachnid` 28-joint rig), Heavy Scrap-Bot (`ual1`), crate/barrel/generator props |

---

## Documentation

- [`docs/art-direction.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/art-direction.md) — Measured Teardown values, canonical scale (`CHAR_VOX = 0.05 m`), the sculpt lattice, segment dimensions, face maps, C-claw hand geometry, 1-voxel garment relief, baked crevice AO, and `TEXCOORD_1` mottling rules.
- [`docs/architecture.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/architecture.md) — End-to-end Blender-to-WebGL pipeline, rigid-segment greedy mesher, orthogonal morphs, ragdoll fitter, and S23 Ultra performance contracts.
- `blender/creature_kit.py` — Creature kit: one world lattice, one authoring space (`+Z` forward, also for a `+X` rig), the `inverse(W_j @ IBM_j)` bind for external glTF rigs, and the quadruped build checks. The Guard Hound is its reference (`docs/art-direction.md` section 10).
- [`docs/AUTHORING_GUIDE.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/AUTHORING_GUIDE.md) — Step-by-step Python recipes using `voxchar.py` so any model or artist can create matching Teardown-style characters, outfits, tools, creatures, and props.
