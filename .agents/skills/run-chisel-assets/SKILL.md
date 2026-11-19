---
name: run-chisel-assets
description: Author, validate, visually verify, thumbnail, and stage stylized faceted low-poly modular avatars, held items, props, and rigged creatures in tools/run-chisel-packs for games/run-chisel-showcase and jam-ready-assets.
---

# RUN Chisel Assets Workshop Skill

Use this skill whenever creating, modifying, validating, visually reviewing, or publishing `run-chisel-*` assets across `tools/run-chisel-packs`, `games/run-chisel-showcase`, and `~/dev/jam-ready-assets`.

## 1. Canonical Architecture & Asset Map

- **Pipeline root**: `tools/run-chisel-packs/`
- **Showcase app**: `games/run-chisel-showcase/` (Tabs: `Spec`, `Asset Gallery`, `Avatar Lab`, `Context Stage`, `S23 Ultra Perf Bench`)
- **Staged packs (`contracts/data/packs.json`)**:
  - `run-chisel-core/3D/characters` (`CC0-1.0`) — 53-joint Quaternius UAL1 rig, 89 CC0 clips, `body_athletic`, `body_heavy`, `body_slim`, heads, hair
  - `run-chisel-medieval/3D/characters` & `3D/medieval`
  - `run-chisel-ww2/3D/characters` & `3D/ww2`
  - `run-chisel-sim/3D/characters` & `3D/sim`
  - `run-chisel-cyberpunk/3D/characters` & `3D/cyberpunk`
  - `run-chisel-monsters/3D/characters` & `3D/monsters` (Orc, Troll + 8 creatures across 7 Mesh2Motion CC0 rigs: `quadruped`, `arachnid`, `avian`, `dragon`, `kaiju`, `serpent`, `aquatic`)

## 2. Hard Visual & Performance Rules (S23 Ultra 120 Hz Law)

Check exact numbers in `contracts/data/budgets.json`:
- **Composed avatar**: `<= 2,200` tris total (worst cross-pack mix + 2 held items), `<= 3` draw calls (`1` merged skinned mesh + up to `2` held props), zero shadow maps (shared blob shadow).
- **Slot triangle caps**: `body <= 1,100`, `head <= 280`, `hair <= 220`, `torso <= 700`, `legs <= 520`, `headwear <= 360`, `back <= 320`, `held <= 400`, `prop <= 650`.
- **Single material (`Poly_Atlas_Mat`)**: `FrontSide` only (`doubleSided: False`). Open cloth flaps/cloaks/skirts/trenchcoats MUST use `two_sided=True` (`thickness=0.004..0.006`, `inner_ao=-0.2`) so no backfaces disappear.
- **7 Semantic UV Regions**: `u` selects `skin`, `hair`, `primary`, `secondary`, `accent`, `metal`, `eye`; `v ∈ [0.15, 0.85]` encodes subtle AO shading. Never set `ao < -0.12` on dark boots.
- **Grounded props & bipeds**: Bind feet / lowest prop vertex cleanly at `y = 0.0` (glTF Y-up; Blender `Z = 0.0`).
- **Held items (`hand_r` / `hand_l`)**: Local grip center `(0, 0, 0)`, handle along `+Y`, aim/blade forward along `+Z`.

## 3. Authoring a New Asset Step-by-Step

1. **Inspect budgets, packs & generate boilerplate**:
   ```bash
   cd tools/run-chisel-packs
   npm run scaffold -- --list
   npm run scaffold -- --kind prop --pack medieval --id prop_anvil --label "Blacksmith Anvil"
   # Supported kinds: part (--slot ...), held (--hand hand_r|hand_l), prop, creature (--rig ...)
   ```
   Copy the generated stub from `out/scaffolds/<id>.py` into `blender/build_packs.py` (or `blender/build_monsters.py` / `creatures_*.py`) and register its catalog entry.

2. **Build GLBs, validate contracts, and export showcase catalogs**:
   ```bash
   cd tools/run-chisel-packs
   npm run build       # Headless Blender -> out/jam-stage/ + out/meta/manifest.json
   npm run validate    # Rig parity, weight normalization, unit normals, budgets, held grips
   npm run catalog     # Updates games/run-chisel-showcase/public/catalog/
   npm run typecheck && npm test
   ```

3. **Visually inspect in the real Three.js shader** (never trust headless geometry alone):
   ```bash
   cd tools/run-chisel-packs
   # 4-angle contact sheet (front 3/4, side, rear, high):
   npm run snapshot -- --out out/review/prop_anvil_views.png --views prop_anvil
   # Animation phase contact sheet:
   npm run snapshot -- --out out/review/wyvern_walk.png --clip Walk --phases 0,0.25,0.5,0.75 monster_ember_drake
   # Native 1.0x scale check next to the 1.80m human gauge:
   npm run lineup -- --out out/review/scale_check.png monster_warhorse monster_tyrant_rex prop_anvil
   ```

4. **Render 512x512 Gallery thumbnails & run full showcase check**:
   ```bash
   cd games/run-chisel-showcase
   npm run thumbnails -- --all --force    # Writes <leaf>/<relDir>/Previews/<id>.jpg
   npm run typecheck && npm test && npm run build:local
   cd ../../tools/run-chisel-packs
   node scripts/verify-visual.mjs --out /tmp/chisel-visual-check
   ```

## 4. Publishing to `jam-ready-assets` & Pinning Production Builds

**Recommendation when expanding packs:** Whenever you add new assets or expand an existing `run-chisel-*` pack, always stage and publish those new assets into the `jam-ready-assets` repository (with updated `Previews/*.jpg`, `License.txt`, `scripts/preview-inputs`, `preview.webp`, and rebuilt v2 manifest) and sync the new leaf pins back into `games/run-chisel-showcase/src/pins.ts` so pinned production builds and RUN games can resolve them.

```bash
# 1. Ensure GLBs + Previews/*.jpg are built:
cd tools/run-chisel-packs && npm run build && npm run validate && npm run catalog
cd ../../games/run-chisel-showcase && npm run thumbnails -- --all --force

# 2. Stage packs, write verified License.txt, compose scripts/preview-inputs grids, upsert preview-sources.json:
cd ../../tools/run-chisel-packs
npm run stage -- --target ~/dev/jam-ready-assets

# 3. In jam-ready-assets: generate preview.webp, rebuild manifest, verify checks & tests:
cd ~/dev/jam-ready-assets
npm run previews:generate
node scripts/build-manifest.mjs
npm run previews:check
npm test

# 4. Sync published leaf versions back into games/run-chisel-showcase/src/pins.ts and verify pinned prod build:
cd /path/to/run-workshop/tools/run-chisel-packs
npm run sync-pins -- --target ~/dev/jam-ready-assets
cd ../../games/run-chisel-showcase
npm run build   # Pinned production build — fails if any catalog leaf lacks a pin
```

## 5. Additional Reference Docs

- `tools/run-chisel-packs/docs/architecture.md` — Pipeline, rig contracts, runtime merging & shader
- `tools/run-chisel-packs/docs/visual-direction.md` — F/S/C/P/M aesthetic and mobile budget rules
- `tools/run-chisel-packs/docs/PACK_AUTHOR_GUIDE.md` — Blender primitives, `covers` tags, and hardening lessons
- `tools/run-chisel-packs/docs/CREATURE_RIGGING_AND_RETARGETING.md` — 7 creature rigs, `SegmentWeightSolver`, and Mesh2Motion CC0 retargeting
