# RUN Chisel Packs — Architecture & Pipeline Specification

**RUN Chisel Packs** (`run-chisel-*`) is a modular, parametric, stylized faceted low-poly 3D avatar, creature, and prop asset system built on the CC0 **Quaternius Universal Animation Library (`UAL1`) 53-joint skeleton with 89 CC0 animation clips** (43 UAL1 + 42 unique UAL2 + 4 KayKit CombatRanged 2H rifle clips) plus **7 CC0 Mesh2Motion creature rigs**. It matches the `jam-ready-assets` + `@series-inc/rundot-game-sdk` distribution model proven by `games/pirate-nation-showcase` and `tools/run-voxel-packs`.

---

## 1. Design Goals

1. **One Canonical Rig Across Human Genres + 7 Creature Rigs**: Medieval battles, WW2 squads, Sim worlds, and Cyberpunk streets all bind to the exact same 53-joint UAL1 skeleton (`root`, `pelvis`, `spine_01..03`, `neck_01`, `Head`, `clavicle/upperarm/lowerarm/hand + fingers`, `thigh/calf/foot/ball`) and share all 89 CC0 clips. Non-humanoid Monsters share 7 standardized Mesh2Motion CC0 creature rigs.
2. **Cohesive Stylized Faceted Quality**: Every body archetype, creature, outfit, headgear, handheld, and prop is authored via codified Blender Python primitives (`blender/polykit.py`) with crisp faceted shading, beveled heroic proportions, and a unified 7-region palette-gradient encoding.
3. **Ultra-High Frame Rate on S23 Ultra (120 Hz = 8.33 ms budget)**:
   - Composed character budget: **<= 2,200 triangles** and **1–3 draw calls** (1 shared shader program).
   - **Zero shadow maps** on mobile tier (shared radial blob-shadow plane, matching `run-chonky-hounds` and `run-terra-tots`).
   - **Shared GPU resources**: `core-rig.glb` and pack GLBs load once; instances clone skeletons via `SkeletonUtils.clone()` and share geometries, textures, and `AnimationClip`s.
   - **DPR capped at 1.5**, optional **distance animation throttling** (`30 Hz` / `15 Hz` mixer stepping for background crowd avatars).
4. **Parametric at Build Time AND Runtime**:
   - **Build-time parametricity**: Blender Python generators accept silhouette parameters and transfer normalized 4-bone skin weights via `KDTree` from `tools/run-chisel-packs/assets/source/ual1-base.glb`, or bind directly via `SegmentWeightSolver` for creatures.
   - **Runtime parametricity**:
     - **7-Region UV Palette Shader (`polyMaterial.ts`)**: `u` encodes material region (`skin`, `hair`, `primary`, `secondary`, `accent`, `metal`, `eye`), `v` encodes vertical AO/shading ramp (`0.15..0.85`).
     - **Skeletal Proportion Rig (`proportionRig.ts`)**: Non-destructive local bone scaling with automatic root Y grounding compensation applied cleanly over clip playback.

---

## 2. Comparison with Proof of Play (`pirate-nation-showcase`) & `run-voxel-packs`

| Concern | Pirate Nation (`pirate-nation-showcase`) | RUN Voxel Packs (`run-voxel-packs`) | RUN Chisel Packs (`run-chisel-packs`) |
|---|---|---|---|
| **Skeleton** | 16-bone PN voxel rig | 16-bone PN voxel rig | **53-joint UAL1 CC0 rig + 7 Mesh2Motion creature rigs** |
| **Clips** | 32 PN clips | 32 PN + 32 custom clips (`NN_Name`) | **89 UAL1 CC0 clips + 65 creature clips** |
| **Style** | Voxel blocks + flat atlas | Voxel-as-code (`voxgrid.py`) + atlas | **Stylized faceted low-poly** (`polykit.py`) + 7-region ramp |
| **Composition** | Single monolith GLB, node culling | Multi-pack `parts.glb` + `SkeletonUtils` | **Core rig GLB + per-context pack GLBs** (`parts` + `held` + `props`) |
| **Coloring** | Clone materials for Skin/Hair tinting | Fixed 256×1 palette PNG | **7-region UV shader (`Skin/Hair/Primary/Secondary/Accent/Metal/Eye`)** |
| **Proportions** | Fixed | Fixed | **Parametric runtime bone scales + morph archetypes** |
| **Mobile Target** | Desktop/web showcase | Desktop/web showcase | **S23 Ultra 120 Hz (<= 2,200 tris/avatar, 1–3 draws, blob shadow)** |

---

## 3. Repository & `jam-ready-assets` Layout

### Inside `run-workshop`
```
tools/run-chisel-packs/
  SKILL.md                   # Link to the canonical workshop skill in .agents/skills/run-chisel-assets/
  docs/
    architecture.md          # This file
    visual-direction.md      # Codified faceted style + S23 Ultra constraints (F/S/C/P/M rules)
    PACK_AUTHOR_GUIDE.md     # Builder primitives & hardening lessons
    CREATURE_RIGGING_AND_RETARGETING.md
  contracts/
    data/ual1-rig.json       # Exact 53 joint names, hierarchy, rest world positions, 89 clips
    data/*-rig.json          # 7 creature rig contracts (quadruped..aquatic)
    data/budgets.json        # Per-class triangle, draw-call, byte, and weight limits
    data/packs.json          # Pack ids, themes, leaves, licenses
    packs.ts | rig.ts | budgets.ts | palette.ts | catalog.ts
  assets/source/
    ual1-base.glb            # CC0 canonical UAL1 armature + bind reference + 43 clips
    ual2-standard.glb        # CC0 Quaternius UAL2 clips retargeted onto UAL1 at build time
    kaykit-combat-ranged.glb # CC0 KayKit CombatRanged 2H rifle clips retargeted onto UAL1
    LICENSE-SOURCE.txt       # Provenance & CC0 record
  blender/
    polykit.py               # Faceted geometry primitives, UV region encoder, weight solvers
    retarget.py              # Rest-compensated UAL2, KayKit, and Mesh2Motion creature retargeter
    build_core.py            # Builds run-chisel-core (rig + 89 clips + faceted bodies/heads/hair)
    build_packs.py           # Parametric builders for medieval, ww2, sim, cyberpunk
    build_monsters.py        # Orc, Troll + monsters orchestrator
    creatures_land.py        # Warhorse, Tyrant Rex, Horned Basilisk
    creatures_sky_sea.py     # Frost Eagle, Ember Drake, Abyssal Shark
  scripts/
    scaffold.ts              # Scaffold Python boilerplate & print budgets/rigs for new assets
    build.ts                 # Orchestrates Blender builds into out/jam-stage/
    validate.ts              # Automated GLB contract gate
    export-catalog.ts        # Emits games/run-chisel-showcase/public/catalog/<pack>/catalog.json
    snapshot.ts              # Multi-angle / multi-phase Three.js contact sheets
    lineup.ts                # Side-by-side scale lineup next to 1.80m human gauge
    stage-jam.ts             # Exports packs + License.txt + scripts/preview-inputs into jam-ready-assets
    sync-pins.ts             # Syncs published manifest hashes into games/run-chisel-showcase/src/pins.ts

games/run-chisel-showcase/
  src/
    assetSource.ts           # local (/jam/...) vs pinned (@series-inc/rundot-game-sdk)
    pins.ts                  # Published jam-ready-assets versions per leaf
    thumb.tsx                # 512x512 JPEG thumbnail & snapshot/lineup renderer
    avatar/
      polyMaterial.ts        # 7-region UV palette + AO ramp MeshStandardMaterial shader
      proportionRig.ts       # Parametric skeletal proportions + foot grounding
      composePolyAvatar.ts   # Cross-pack slot resolution + compatibility rules
      polyRig.ts             # GLB cache, clip optimizer, rig clone, one-draw geometry merge
      PolyAvatar.tsx         # R3F runtime component (SkeletonUtils, blob shadow, LOD mixer)
      SinglePartPreview.tsx  # Gallery & thumbnail 3D framing + lineup stage
    tabs/
      OverviewTab.tsx | GalleryTab.tsx | AvatarLabTab.tsx | ContextStageTab.tsx | PerfBenchTab.tsx
```

### In `~/dev/jam-ready-assets` (Staged Leaf Layout)
Every pack follows the `jam-ready-assets` `<pack>/<bucket>/<theme>` v2 layout (11 leaves total, each with `License.txt`, `preview.webp`, and `Previews/<id>.jpg`):
- `run-chisel-core/3D/characters` (`CC0-1.0`) — `core-rig.glb`
- `run-chisel-medieval/3D/characters` & `3D/medieval`
- `run-chisel-ww2/3D/characters` & `3D/ww2`
- `run-chisel-sim/3D/characters` & `3D/sim`
- `run-chisel-cyberpunk/3D/characters` & `3D/cyberpunk`
- `run-chisel-monsters/3D/characters` & `3D/monsters`

Any RUN game loads these packs via `@series-inc/rundot-game-sdk`:
```ts
const base = await RundotGameAPI.assetLibrary.getPackBaseUrl('run-chisel-medieval/3D/characters', PIN)
```
and binds any pack's `SkinnedMesh` parts onto `core-rig.glb`'s skeleton without retargeting.

---

## 4. Build and Runtime Conventions

These conventions connect `blender/*.py` to `games/run-chisel-showcase/src/avatar/*`. Obey them when you add parts.

- **Rig bytes stay exact.** `polykit.GlbBuilder.add_rig` copies the 53 joints, the inverse bind matrices and the clip
  samples from the source GLB. `build_core.py` compares the written bytes with the source and stops on a difference.
  Each `<pack>-parts.glb` contains the same skin and no clips.
- **One outfit fits all bodies.** An outfit builder is a function `(part, body)`. The kit runs it for each body
  archetype. The base mesh fits `body_athletic`. The other bodies become morph targets, and the body id is the
  target name (`mesh.extras.targetNames`). The runtime bakes the target into the merged geometry. No morph runs on the GPU.
- **Covered skin is not drawn.** A body mesh has `node.extras.polyRegions` (`pelvis`, `chest`, `neck`, `upperarm`,
  `forearm`, `hand`, `thigh`, `shin`, `foot`), each with an index range. An outfit has `node.extras.polyCovers`.
  The runtime leaves out the covered ranges, so the body cannot show through an outfit.
- **One skinned draw for each avatar.** `polyRig.mergeParts` puts all visible parts into one geometry. This is
  possible because every part uses the UAL1 joint order. Held items add one draw each.
- **Skin weights.** `polykit.WeightSolver` does a KDTree transfer from the UAL1 bind body. A `Skin` limits the
  result to the bones of a chunk (for example one arm), or sets fixed weights (head parts are rigid on `Head`).
- **Held items.** Author them in the canonical grip frame: origin at the palm centre, handle along `+Y`, aim or
  blade edge along `+Z`. For `hand_l`, `+X` is the back of the hand. For `hand_r`, `+X` is the palm side.
  `heldSockets` in `contracts/data/ual1-rig.json` puts this frame on the hand bones. `build_core.py` stops if the
  sockets leave the canonical frame.
- **Clips at runtime.** The UAL1 clips animate rotation and the pelvis translation only. `polyRig.optimizeClip`
  removes the constant scale and translation tracks. The proportion rig owns bone scale, joint offsets and the
  inverse bind matrices (`proportionRig.ts`).
- **Color contract.** [color-direction.json](../contracts/data/color-direction.json) defines the pack briefs,
  avatar defaults, prop colors, stage lighting, and shared UV shade ramp. Blender bakes prop colors into
  `COLOR_0`. The showcase uses the same palette and UV regions for runtime recoloring. Validation and staging
  check the baked bytes against the contract.
