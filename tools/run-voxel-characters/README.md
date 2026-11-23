# RUN Cubix (`tools/run-voxel-characters`)

Canonical **5 cm orthogonal voxel character, outfit, weapon/tool, beast/monster, and world prop generator** built on the shared **53-joint Quaternius UAL1 CC0 skeleton (43 clips)** plus **23-joint Quadruped**, **28-joint Arachnid**, and **7 external animal rigs**, packaged for `jam-ready-assets` and **120 Hz on Samsung Galaxy S23 Ultra**.

---

## Quick Start

```bash
cd tools/run-voxel-characters
npm install
npm run build        # Build all 6 packs (29 presets) via Blender 5.1 -> out/jam-stage/ + out/meta/
npm run validate     # Verify orthogonal normals, budgets, sculpt lattice, silhouette, UV0/UV1, AO, morphs, ragdolls & clip audits
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
# If port 5199 is already occupied:
VERIFY_PORT=5211 node tools/run-voxel-characters/scripts/verify-visual.mjs
```

---

## Expanding Packs & Publishing to `jam-ready-assets`

Whenever you add new characters, outfits, gear, creatures, props, or packs—or revise existing assets—**publish the updated assets to `series-ai/jam-ready-assets`** so RUN apps (including `games/voxel-character-showcase`) load them through the RUN SDK asset library rather than keeping local copies:

1. **Rebuild, validate, visually verify, and export catalogs** in `tools/run-voxel-characters`:
   ```bash
   npm run build && npm run validate && npm run catalog && npm test
   VERIFY_PORT=5211 node scripts/verify-visual.mjs
   ```
2. **Stage directly into a `jam-ready-assets` branch/worktree**:
   ```bash
   npm run stage -- --target <jam-ready-assets checkout>
   ```
   Each pack sits at the JRA repo root as `run-cubix-<slug>/3D/<theme>/` (never inside a wrapper folder), with its `.glb` files and `License.txt`.
3. **Update square thumbnails (`preview.webp` + `preview-sources.json`) and run JRA CI checks** inside `<jam-ready-assets checkout>`:
   - Ensure every new or modified leaf has an entry in `preview-sources.json`, a generated square `512×512` `preview.webp`, and updated `README.md` credits/counts if adding a new pack.
   - Run:
     ```bash
     npm run previews:generate && npm run previews:check
     npm test
     SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs
     node scripts/check-visual-assets.mjs
     node scripts/check-keywords.mjs origin/main
     ```
4. **Open a PR on `series-ai/jam-ready-assets` and wait for merge + GCS mirror**.
5. **Pin the published 12-character leaf hashes** from JRA's published `manifest/v2/index.json` into [`games/voxel-character-showcase/src/pins.ts`](../../games/voxel-character-showcase/src/pins.ts), then run `npm run build` in `games/voxel-character-showcase` (`requirePins()` verifies every leaf pin before production builds succeed).

---

## Packs Generated (`out/jam-stage/`)

6 packs · **29 presets** · 62 modular avatar parts · 14 held items · 13 grounded world props:

| Pack Directory | Context | Key Contents |
|---|---|---|
| `run-cubix-core` | Core UAL1 Rig & Bodies (CC0-1.0) | 53-joint UAL1 skeleton + 43 clips, `body_slim`/`body_athletic`/`body_heavy`, 6 sculpted `3×5×4` heads, 6 layered voxel hairstyles (`5×7` head envelope), 3 starter presets |
| `run-cubix-heist` | Heist & Demolition | Sledgehammer hero tee & jeans, belted tunic & scout hat, open jacket & scarf, tattoo scout vest & shorts, backpack, detonators, crowbar, rubble/vault props (4 presets) |
| `run-cubix-industrial` | Workshop & Industrial | Weathered handyman shirt w/ work gloves & waist pack, mechanic apron, cargo pants, knit beanie, welding cap, hard hat, pipe wrench, blowtorch, chest & drum props (3 presets) |
| `run-cubix-security` | Security & Cyber-Tech | Collared guard uniform w/ utility belt & peaked cap, tactical knee-pad trousers, cyber-enforcer harness w/ glowing emissive visor, forearm riot shield, helmet, pistol, terminal props (3 presets) |
| `run-cubix-creatures` | Voxel Beasts & Bots | Guard Hound (`quadruped` 23-joint rig), Scrap Spider (`arachnid` 28-joint rig), Demolition Scrap-Bot (`ual1`), 7 external animal rigs (Fox, Horse, Wolf, Corgi, Pug, German Shepherd, Cat), kennel & beacon props (10 presets) |
| `run-cubix-fantasy` | Fantasy & Medieval | Royal Vanguard & Iron Templar knights (plate harness, surcoat, greaves, sallet, greathelm, cape, broadsword, war hammer, forearm heater shield) + Orc Raider, Orc Warboss, Moss Troll, Cave Troll (cleaver, crag club, tower shield) + medieval props (6 presets) |

---

## Documentation

- [`docs/art-direction.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/art-direction.md) — Canonical scale (`CHAR_VOX = 0.05 m`), all voxel density tiers (`0.025 m` headwear, `0.026–0.028 m` held gear, `0.02–0.05 m` creature `rig_scale` tiers), the sculpt lattice, segment dimensions, face maps, C-claw hand geometry, 1-voxel garment relief, 10-region zero-texture PBR shader & baked AO, creature/monster/prop rules, and the **Squint Test** visual standard.
- [`docs/architecture.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/architecture.md) — End-to-end Blender-to-WebGL pipeline, rigid-segment greedy mesher, `TEXCOORD_0`/`TEXCOORD_1` shader encoding, orthogonal morphs, `SculptPose`, ragdoll fitter, `jam-ready-assets` staging/pinning, and S23 Ultra performance & validation contracts.
- [`blender/creature_kit.py`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/blender/creature_kit.py) — Creature kit: one world lattice, one authoring space (`+Z` forward, also for `+X` rigs), the `inverse(W_j @ IBM_j)` bind for external glTF rigs, and build-time quadruped checks.
- [`docs/AUTHORING_GUIDE.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/AUTHORING_GUIDE.md) — Step-by-step Python recipes using `voxchar.py`, `build_core.py`, and `creature_kit.py` plus the `jam-ready-assets` release flow so any LLM or artist can author and ship matching humans, headwear, outfits, forearm shields, bipedal monsters, creatures, and props.
