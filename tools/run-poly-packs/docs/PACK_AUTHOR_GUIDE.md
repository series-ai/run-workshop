# RUN Poly Packs — Authoring & Hardening Guide

Reference guide for authoring modular low-poly characters, outfits, handheld items, world props, and multi-rig creatures in `tools/run-poly-packs` for `games/run-poly-showcase` and `jam-ready-assets`.

---

## 1. Visual & Material Contract (`FrontSide`, Faceted 6-Region Atlas)

- **Hard `FrontSide` rendering**: Both Blender exports (`polykit.py`: `'doubleSided': False`) and runtime materials (`polyMaterial.ts`: `THREE.FrontSide`) render front faces only.
- **No zero-thickness sheets**: Every open cloth flap, cloak, skirt, kilt, trenchcoat lower hem, loincloth, or banner flag MUST be built with `two_sided=True` (e.g., `part.loft(..., two_sided=True, thickness=0.004..0.006, inner_ao=-0.2)`), generating an inward-offset solid lining with reversed winding and darker cavity AO so neither orbit camera angles nor animations reveal invisible backfaces.
- **One shared palette shader**: Every mesh uses 1 primitive with `Poly_Atlas_Mat` (`maxMaterials: 1`). Palette assignment uses quantized `TEXCOORD_0` bands into the 6 color regions:
  - `skin`
  - `hair`
  - `primary`
  - `secondary`
  - `accent`
  - `metal`
- **Faceted normal shading & AO**: Split vertices per polygon group so face normals stay flat-faceted; encode subtle darkened cavity AO in `TEXCOORD_0.y` (`0..1`) rather than extra textures.
- **Dark surfaces must keep their facets** (`polyMaterial.ts`, `LOOK`): the shader adds a small floor to very dark palette colors, a view-space rim on facets that turn away from the camera, and a vertical studio reflection on the `metal` region. All values are GLSL literals, so all materials share one program (`run-poly-atlas-v2`).
- **Studio lights** (`scenes/studio.tsx`): the lab, the stage and the bench use one warm key, one cool fill and one cool rim light with neutral tone mapping. No light casts a shadow.
- **Boots and soles**: `build_foot` gives the boot a value step from heel to toe. Keep the boot `ao` at `-0.12` or above. A lower value makes a dark boot a flat block.
- **A part never hides its own geometry**: `Part.to_mesh` does not export a region tag that the part covers itself. Before this rule, a legs outfit removed its own boots and the knight torso removed its own gauntlets. `npm run validate` rejects a part that covers its own region.
- **Loft winding**: `Part.loft` sets the outward side one time for the full loft, from the stored vertices. This is correct inside `Part.placed()` and on a flat step of a lathe profile.
- **Cheap spikes**: `spike()` in `build_monsters.py` makes a cone from one ring and one apex (`n` triangles). Use it for fur tufts, claws, teeth and iron spikes. Put the open base inside the parent volume.

---

## 2. Triangle & Mobile S23 Ultra Budgets (`contracts/data/budgets.json`)

Target: **Samsung Galaxy S23 Ultra @ 120 Hz (8.33 ms frame budget)**:

| Rule | Cap | Enforced By |
| :--- | :--- | :--- |
| Max composed avatar (incl. held) | `<= 2,200` tris | `build_packs.py`, `build_monsters.py`, `validate.ts` |
| `worst slot mix` (UAL1 cross-pack max) | `<= 2,200` tris | `build_packs.py` (`check_compositions`) |
| `body` slot | `<= 1,100` tris | `validate.ts` |
| `head` slot | `<= 280` tris | `validate.ts` |
| `hair` slot | `<= 220` tris | `validate.ts` |
| `torso` slot | `<= 700` tris | `validate.ts` |
| `legs` slot | `<= 520` tris | `validate.ts` |
| `headwear` slot | `<= 360` tris | `validate.ts` |
| `back` slot | `<= 320` tris | `validate.ts` |
| `held` item | `<= 400` tris, `<= 64 KB` | `validate.ts` |
| `prop` item | `<= 650` tris, `<= 80 KB` | `validate.ts` |
| Draw calls per avatar | `<= 3` (`1` merged body + up to `2` held) | Runtime `PolyAvatar.tsx` |
| Shadow strategy | Shadow maps OFF, shared blob shadow (`1` instanced draw) | `PerfBenchStage.tsx` |

> **Tip**: Leaving bare limbs exposed via selective `part.covers` tags (e.g., `covers=['chest', 'forearm']` on `torso_orc_harness` so `body_orc`'s sculpted biceps stay visible) saves ~100 tris while strengthening silhouette variety.

---

## 3. Multi-Rig Architecture & Skeletal Proportions

Rig contracts live under `tools/run-poly-packs/contracts/data/`:

- **`ual1`** (`ual1-rig.json`, 53 joints, 89 clips): Canonical Quaternius UAL1 humanoid skeleton with `heldSockets` (`hand_r`, `hand_l`), extended with 42 unique UAL2 clips and 4 KayKit CombatRanged 2H rifle clips.
  - Supports **5 base/monster body archetypes** via baked morph targets (`body_athletic`, `body_heavy`, `body_slim`, `body_orc`, `body_troll`).
  - Non-uniform `make_monster_body` specs support hunched spine forward offsets (`slouch`) without mutating inverse-bind joint positions.
  - Supports parametric proportions at runtime (`height`, `shoulderWidth`, `torsoBulk`, `waistScale`, `headScale`, `limbThickness`, **`armLength`**) via `proportionRig.ts`.
- **`quadruped`** (`quadruped-rig.json`, 23 joints, 6 clips: `Idle`, `Walk`, `Run`, `Attack`, `Death`, `Howl`): Procedural Dire Wolf skeleton written cleanly with `SegmentWeightSolver` + `GlbBuilder.add_custom_rig(...)`. The contract owns the clip names, their order and their durations; `wolf_clips()` reads them from the contract.
- **`arachnid`** (`arachnid-rig.json`, 28 joints, 5 clips: `Idle`, `Walk`, `Run`, `Attack`, `Death`): Procedural Giant Spider skeleton with 8 three-segment articulated legs grounded at `y = 0`.
- **Creature legs use a loop over both sides, not `Part.mirrored()`**: the creature joint names have the side inside the name (`leg_fl_upper`, `leg_1_l_coxa`). `mirror_name()` renames only a `_l` / `_r` suffix, so a mirrored creature leg gets the weights of the left bones.
- **A creature is one `body` part**, so the `body` budget (`<= 1,100` tris) is its full budget. The Dire Wolf has 1,082 tris and the Giant Spider has 978 tris.
- **Creature clips**: an attack clip must return to the start pose with an ease (`keyed()`), with no held end pose. A gait uses `stride()`: a stance part with constant ground speed and a swing part with lift.

### Proportion & Grounding Rules (`proportionRig.ts`)
- Every bone scales around its bind joint in inverse-bind space (no child shear).
- Root-attached body/pelvis bones keep clip translation untouched (`height` on `root` scales clip offsets).
- `ual1` `armLength` scales `upperarm` / `lowerarm` along `X` (bind arm axis) while keeping shoulder joints fixed and handheld sockets aligned on `hand_r` / `hand_l`.
- `arachnid` leg segments (`coxa`, `femur`, `tibia`) keep `Y` scale `= 1.0` so all 8 leg tips stay pinned on `y = 0` regardless of `limbThickness`.

---

## 4. Verification Pipeline

Run from `tools/run-poly-packs`:
```bash
npm run build       # Blender builds core, medieval/ww2/sim, monsters + writes out/meta/manifest.json
npm run validate    # Verifies skeleton contracts, 1-material rule, unit normals, normalized weights, budgets (incl. held)
npm run catalog     # Exports Zod-validated per-pack JSON catalogs to games/run-poly-showcase/public/catalog
npm run typecheck
npm test
```

Run from `games/run-poly-showcase`:
```bash
npm run typecheck
npm test
npm run build:local
```

Visual WebGL capture check:
```bash
node tools/run-poly-packs/scripts/verify-visual.mjs --out /tmp/poly-renders
node tools/run-poly-packs/scripts/verify-visual.mjs --out /tmp/poly-renders --only "06|07"   # wolf and spider shots only
```
The lab shots use the `Hold pose` control, so each pose is the same on every run (wolf `Attack` at 0.50 and 0.82, `Howl` at 0.50, spider `Attack` at 0.42). Look at the PNG files: the script finds console errors, not bad art.
