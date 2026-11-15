# Visual Direction & Performance Law — RUN Poly Packs (Synty-Inspired)

Every asset in `run-poly-*` shares one unmistakable visual language inspired by **Synty POLYGON** packs and one hard runtime envelope designed for **120 Hz (<= 8.33 ms) on Samsung Galaxy S23 Ultra (Adreno 740)** and better mobile devices.

Every rule has a stable ID (`F1..F6`, `S1..S4`, `C1..C3`, `P1..P6`, `M1..M4`). Future agents authoring new outfits, heads, props, or genre packs MUST obey these rules and pass `npm run validate`.

---

## 1. Form & Proportions (`F`)

- **F1 — Faceted Heroic Silhouettes (Never Blobby, Never Voxel)**:
  - Build volumes from **8-to-10-sided tapered octagonal/hexagonal prisms, chamfered boxes, and clean wedge bevels**.
  - **Forbidden**: UV spheres, smooth organic subdivision, or 90-degree Minecraft boxes without bevels/tapers.
  - Jawlines, cheekbones, shoulders, forearms, calves, boots, helmets, and pouches must read as crisp planar facets.
- **F2 — Heroic Stylized Proportions**:
  - Standing height in bind T-pose: **~1.95 m** (feet flat on `y = 0` in glTF, head crown `y ≈ 1.96`).
  - Heroic shoulder-to-waist taper, sturdy boots and cuffs (`15–20%` chunkier than realistic human anatomy so silhouettes pop at mobile viewing distances), and slightly oversized hands/weapons (`1.15×` grip read).
- **F3 — Chunky Secondary Details**:
  - Straps, belts, pouches, lapels, boot cuffs, armor trims, helmet rims, and pocket flaps are **modeled as real extruded facets (`6–14 mm` thick)** rather than painted flat textures, catching directional key light cleanly.
  - Avoid sub-5 mm micro-chamfers or thin floating straps that alias at 720p–1080p mobile scales.
- **F4 — Modular Layer Clearance (Zero Z-Fighting)**:
  - Outfits sit at explicit outward normal offsets over the base body (`+8 mm` inner cloth, `+14 mm` jackets/armor plates, `+22 mm` belts/pauldrons/helmets).
  - Never share coplanar faces between base skin, torso, legs, boots, or headwear.
- **F5 — Prop & Weapon Readability**:
  - Weapons, tools, and scene props exaggerate working silhouettes: broad sword blades & crossguards, thick rifle receivers & barrels, chunky handles on coffee mugs/briefcases, stout barrel staves & hoops.
  - Every prop stands cleanly on `y = 0` (centered in X/Z) with its forward axis along `+Z` (glTF).
- **F6 — Readable at 128 px**:
  - A character or prop must be immediately identifiable by silhouette and 2–3 color blocks at a 128×128 thumbnail size.

---

## 2. Surface & Shading (`S`)

- **S1 — Crisp Split-Normal Faceting**:
  - All `run-poly` meshes use **hard/flat face normals** (`sharp_edges` / per-face split normals) so every polygon catches light with Synty's signature faceted shading.
  - Smooth shading is forbidden on exterior armor, cloth, hair, or props (it blurs low-poly planes into mush).
- **S2 — Single Material Per Asset (`Poly_Atlas_Mat`)**:
  - Every character part and prop uses **1 shared material** (`Poly_Atlas_Mat`, `metallic = 0.0` base, `roughness = 0.82` matte stylized finish, `metal` region modulated cleanly in shader).
  - Zero per-part textures, zero normal maps, zero roughness maps on mobile tier.
- **S3 — 6-Region Palette UV Encoding**:
  - Instead of UV-unwrapping photographic textures, every face's UVs map directly into **6 horizontal region bands (`u`) × vertical Synty gradient/AO ramp (`v`)**:
    - Band `0` (`u ∈ [0.02, 0.14]`): **Skin** (`skinColor`)
    - Band `1` (`u ∈ [0.18, 0.30]`): **Hair** (`hairColor`)
    - Band `2` (`u ∈ [0.35, 0.47]`): **Primary** (`primaryColor` — tunic, uniform, hoodie, main wood/hull)
    - Band `3` (`u ∈ [0.52, 0.64]`): **Secondary** (`secondaryColor` — trousers, leather, webbing, trim)
    - Band `4` (`u ∈ [0.68, 0.80]`): **Accent** (`accentColor` — faction banner, stripe, insignia, glow/scarf)
    - Band `5` (`u ∈ [0.85, 0.97]`): **Metal / Hardware** (`metalColor` — steel plate, buckles, helmet rim, barrel)
  - `v ∈ [0.15, 0.85]` encodes subtle **baked vertex/part shading gradient** (brighter top/facing surfaces `v ≈ 0.80`, darker undersides/creases/belts `v ≈ 0.25`) so assets have rich depth even under unshadowed mobile lighting!
- **S4 — Clean Facial Planes Without Texture Bloat**:
  - Faces use faceted geometry for nose bridge, brow ridge, eye sockets, and chin, plus crisp low-poly eye/brow wedges mapped to `Hair`/`Secondary` bands (`4–12` tris) — readable from 3rd-person distance without fragile alpha decals.

---

## 3. Color & Context Cohesion (`C`)

- **C1 — Cohesive Saturation & Value Envelope**:
  - Keep base primary/secondary colors in **medium-value, controlled saturation** (`S ∈ [0.18, 0.62]`, `V ∈ [0.22, 0.78]`), reserving high saturation (`S > 0.70`) strictly for small **Accent** details (`<= 15%` surface area).
  - Never use pure `#000000` (shadows crush to muddy flat blobs) or pure `#FFFFFF` (blows out under key light).
- **C2 — Genre Palettes on One Rig**:
  - **Medieval**: Warm iron/steel (`#8c96a3`), heraldic crimson/cobalt/forest primary, rich saddle leather secondary (`#5c3c24`), brass/gold accent (`#d9a441`).
  - **WW2**: Olive drab (`#545e43`), field grey (`#5c635f`), khaki webbing (`#8c7d5b`), gunmetal (`#3a4046`), subdued unit insignia accent (`#b84a39` / `#d4a24c`).
  - **Sim / Modern**: Crisp denim/slate/coral/sage/mustard streetwear, warm neutral chinos (`#9e8c72`), clean sneakers & espresso/teal accents.
- **C3 — Instant Cross-Context Compatibility**:
  - Because `u` selects semantic role rather than fixed RGB, any Medieval helmet or WW2 trenchcoat automatically adopts a Sim or Faction color palette if desired, or uses its authored default palette from the pack catalog.

---

## 4. Performance & Parametric Budgets (`P` — S23 Ultra 120 Hz Law)

| Asset Class | Max Triangles | Max Draw Calls / Materials | Max Bones | Target File Size |
|---|---|---|---|---|
| **Base Body Archetype** | `<= 950` tris | `1` material (`Poly_Atlas_Mat`) | `53` (UAL1) | — (inside `core-rig.glb`) |
| **Head + Hair** | `<= 320` tris combined | `1` material | `1` (`Head`) | — |
| **Torso Outfit** | `<= 650` tris | `1` material | `<= 28` active | `<= 80 KB` |
| **Legs + Boots** | `<= 480` tris | `1` material | `<= 10` active | `<= 60 KB` |
| **Headwear / Back** | `<= 320` tris | `1` material | `<= 4` active | `<= 40 KB` |
| **Full Composed Avatar** | **`<= 2,200` tris** | **`1–3` draw calls** (1 base+outfit, 1 head/wear, 1 held) | `53` (finger bones optional in LOD) | — |
| **Held Prop / Weapon** | `<= 350` tris | `1` material | `0` (bone-parented) | `<= 40 KB` |
| **World Scene Prop** | `<= 600` tris | `1` material | `0` (or prop joints) | `<= 60 KB` |

- **P1 — Hard Triangle & Draw Call Gates**: `npm run validate` rejects any GLB exceeding these limits.
- **P2 — Zero Shadow Maps on Mobile Tier**: Use a single shared radial-gradient **blob shadow** (`PlaneGeometry` + shared `CanvasTexture`) beneath each character.
- **P3 — Zero Per-Frame Allocations**: `AnimationMixer.update`, bone proportion scaling, and LOD throttling allocate zero `Vector3`/`Quaternion`/`Matrix4` objects inside `useFrame`.
- **P4 — Shared Clip & Geometry Memory**: Geometries, textures, and `AnimationClip`s are loaded once per pack; instances clone skeletons via `SkeletonUtils.clone()` and share GPU vertex/index buffers.
- **P5 — DPR & Post-Processing Discipline**: Cap `dpr={[1, 1.5]}` on mobile/S23 Ultra; disable expensive full-screen bloom/SSAO passes on mobile tier.
- **P6 — Parametric Bone Proportions**: Runtime proportions (`height`, `shoulderWidth`, `torsoBulk`, `waistScale`, `headScale`, `limbThickness`) scale local bone axes (`pelvis`, `spine_01..03`, `clavicle/upperarm`, `Head`, `thigh/calf`) cleanly without altering animation clips, with automatic root Y grounding compensation so feet remain planted.

---

## 5. Motion & Attachment Sockets (`M`)

- **M1 — Exact UAL1 Skeleton Parity**: Every `SkinnedMesh` in every pack MUST reference the exact 53 joint names and bind-pose inverse bind matrices from `contracts/data/ual1-rig.json`.
- **M2 — Identity Mesh Bind Frame**: Every `SkinnedMesh` node MUST have an identity local transform (`translation=[0,0,0]`, `rotation=[0,0,0,1]`, `scale=[1,1,1]`) and normalized positive 4-bone skin weights (`sum == 1.0 ± 1e-4`).
- **M3 — Canonical Held-Item Grip Frame (`hand_r` / `hand_l`)**:
  - Held props are rigid meshes with origin `(0, 0, 0)` at the **palm grip center**, forward/blade/barrel pointing along **`+Z`** (or **`+Y`** upright along weapon shaft — specifically: in T-pose `hand_r` points along `-X` with palm facing `-Y` and thumb `+Z`; our Blender builder and validator standardize held items in **canonical grip local space**: origin at palm center, handle axis along **`Y`**, forward/aim/blade edge along **`+Z`**, mounted to `hand_r` with a single deterministic grip quaternion in `contracts/data/ual1-rig.json`).
- **M4 — Grounded World Props**: Every world prop sits with `min.y == 0` (±1 mm) and `X/Z` centered within ±2 cm so scene placement and `pack3d` layout helpers work identically across all genres.
