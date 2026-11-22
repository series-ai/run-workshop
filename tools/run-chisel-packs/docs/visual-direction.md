# Visual Direction & Performance Law — RUN Chisel Packs (Faceted Low-Poly)

Every asset in `run-chisel-*` shares one cohesive stylized faceted low-poly visual language and one hard runtime envelope designed for **120 Hz (<= 8.33 ms) on Samsung Galaxy S23 Ultra (Adreno 740)** and better mobile devices.

Every rule has a stable ID (`F1..F6`, `S1..S6`, `C1..C5`, `P1..P6`, `M1..M4`). Future agents authoring new outfits, heads, props, or genre packs MUST obey these rules and pass `npm run validate`.

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
  - All `run-chisel` meshes use **hard/flat face normals** (`sharp_edges` / per-face split normals) so every polygon catches light with crisp planar faceted shading.
  - Smooth shading is forbidden on exterior armor, cloth, hair, or props (it blurs low-poly planes into mush).
- **S2 — Single Material Per Asset (`Poly_Atlas_Mat`)**:
  - Every character part and prop uses **1 shared material** (`Poly_Atlas_Mat`, `metallic = 0.0` base, `roughness = 0.82` matte stylized finish, `metal` region modulated cleanly in shader).
  - Zero per-part textures, zero normal maps, zero roughness maps on mobile tier.
- **S3 — 7-Region Palette UV Encoding**:
  - Instead of UV-unwrapping photographic textures, every face's UVs map directly into **7 horizontal region bands (`u`) × vertical baked gradient/AO ramp (`v`)**:
    - Band `0`: **Skin** (`skinColor`)
    - Band `1`: **Hair** (`hairColor`)
    - Band `2`: **Primary** (`primaryColor` — tunic, uniform, hoodie, main wood/hull)
    - Band `3`: **Secondary** (`secondaryColor` — trousers, leather, webbing, trim)
    - Band `4`: **Accent** (`accentColor` — faction banner, stripe, insignia, glow/scarf)
    - Band `5`: **Metal / Hardware** (`metalColor` — steel plate, buckles, helmet rim, barrel)
    - Band `6`: **Eye** (`eyeColor` — sclera/iris planes with crisp specular response)
  - `v ∈ [0.15, 0.85]` encodes subtle **baked vertex/part shading gradient** (brighter top/facing surfaces `v ≈ 0.80`, darker undersides/creases/belts `v ≈ 0.25`) so assets have rich depth even under unshadowed mobile lighting!
- **S4 — Clean Facial Planes Without Texture Bloat**:
  - Faces use faceted geometry for nose bridge, brow ridge, eye sockets, and chin, plus crisp low-poly eye/brow wedges mapped to `Hair`/`Secondary` bands (`4–12` tris) — readable from 3rd-person distance without fragile alpha decals.
- **S5 — Dark Values Keep Their Facets**:
  - Dark leather, iron, fur and chitin must show each plane against a dark background. The shared shader lifts very dark palette colors, adds a view-space rim and gives the `metal` region a studio reflection (`polyMaterial.ts`).
  - Check dark values in the scene and in grayscale (rule C2). Do not use baked AO below `-0.2` on a large dark surface such as a boot.
- **S6 — Material Detail at Scene Scale**:
  - Give each main prop one feature that shows how it works. Model the opening, joint, fold, or edge that casts the most useful shade.
  - Use a few large material marks. Use offset courses for stone, seams along planks for wood, or a folded lip and a rubbed edge for painted metal. Put wear where people touch the prop or where the material meets the ground.
  - Bake surface shade into the UV ramp and vertex colors. Keep joints darker and the exposed edges lighter. Check the finish close up and at 128 px. Leave broad surfaces quiet around the material cues.

---

## 3. Color and context cohesion (C)

**C1 — Field, support, and focus.** Choose the ground color before you color the objects on it. Keep broad paving, dirt, stone, and water subdued. Use a small value step between those surfaces and their seams, wear, or ripples. Add broader changes where the surface or route changes. Use a related or opposing hue on secondary surfaces to separate materials and layers. Put the strongest useful contrast at the action. Start at roughly 70% field, 25% support, and 5% focus by visible area in the main view. Adjust for the location and lighting.

**C2 — Value before hue.** Group dark recesses, middle-value surfaces, and light edges. Keep people, doors, paths, and working parts distinct in grayscale. Check the value directly behind each important outline. Lighten or darken that background before you increase saturation on a character. Bring distant colors closer to the fog color. Leave enough value contrast to see their outlines and any route that continues behind the action. Use high saturation on small areas or one painted block when the pack calls for it. Use tinted off-white and near-black swatches.

**C3 — Assign colors to materials.** Use `primary` for the main surface, `secondary` for support and trim, and `accent` for a small mark or painted edge. Use `metal` for hardware. On props, `skin` can carry masonry or fabric, `hair` can carry foliage or recesses, and `eye` can carry glazing or signals. Give each region a stable role within a prop family. Use the baked shade ramp for facets and recesses. The same UV regions let a character take a different pack palette at runtime. Keep character skin, hair, and eye choices available on the shared Core rig.

**C4 — Color brief for each pack.** The color contract gives each theme its hue relationship, field, support, focal color, character treatment, and review target. The scaffold command prints the brief for the selected pack. The contract holds avatar defaults, prop defaults and overrides, stage material groups, lighting colors, and the shade ramp. Character presets and scene palettes can use local variations that follow the brief. Prop overrides take priority over stage material groups. [Color contract](../contracts/data/color-direction.json)

| Pack | Field | Support | Focus |
| --- | --- | --- | --- |
| Medieval | Moss, stone, weathered oak | Cool steel, saddle leather | Brass and one heraldic color |
| WW2 | Dust, khaki, olive drab | Field grey, worn timber, dark rubber | Cream and muted red at the stop point |
| Sim | Warm concrete, cream walls | Denim, terracotta, garden green | One coral block with small mint details |
| Cyberpunk | Charcoal, blue-grey, dark teal | Cool slate, narrow rust-orange trim | Amber on the service counter and small mint signals |
| Monsters | Ash and dark mineral brown | Olive hide, weathered wood, dusty bone | Ember at the portal and pale fossil edges |

**C5 — Review the exported set.** Check a prop at 128 px. Look for its main mass, a clear secondary mass, and gaps that show function. Shorten or remove details that fill those gaps. Review the props and a character together from the normal scene camera. Check desktop, 390 px, and grayscale views in the actual shader. Follow the route and check the clearance around faces, hands, wheels, and openings. Check that the ground and secondary props leave the strongest contrast at the action. If the color changes, rebuild the GLB and render its thumbnails again.

The `stage.environment` entries set ground patch colors, fog distance, and the amount of fog color on distant props. Use the same ground family under the main scene and beyond its edges. Match the edge colors where straight, corner, and junction modules meet. Keep location-specific lights and accents in the stage palette. Keep colors used on exported modules in the prop palette so they also work in the gallery and in games.

`npm run build` checks the pack color data and prop override IDs. `npm run validate` and `npm run stage` compare each prop's normalized vertex colors with its palette and UV shade ramp. Stage checks run before files are copied. Visual review checks area, context, and hierarchy. Use the capture command in the Chisel asset skill.

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

## 6. World prop and scene review

Chisel assets use metres. Use the 1.80 m adult gauge in the native-scale lineup. Check the object beside an adult in the pose that uses it. Keep children, animals, and fantasy creatures at the scale that suits their role in the scene.

| Feature | Chisel reference |
| --- | --- |
| Standard walk-in door | About 0.80–1.0 m wide and 1.95–2.15 m high. Measure clear space from the walking surface to the lowest obstruction. |
| Chair or bench | Seat about 0.42–0.53 m above its floor or platform. Check the thigh and foot positions in a seated pose. |
| Dining surface | About 0.75–0.89 m above the floor. Check it with the paired chair or bench. |
| Service counter | About 0.85–1.10 m above the floor. Pair a high stool with the counter that it serves. |
| Vehicle | Confirm that an adult fits in the seat and that the hands, boots, and head clear the cab. Measure wheels and doors separately. |
| Road and terrain | Use the 2 m terrain module for joins. Give a vehicle lane room on both sides of the vehicle. |

Keep the scale in the exported mesh and its rig. Use the catalog bounds to place assets. Check animated openings in their open pose. Check the saddle or harness height before you pair an animal with a rider or cart. Record low hatches and crouch passages as intentional dimensions.

Run the native-scale lineup after a change to a vehicle, creature, entrance, or work surface. Validation and staging compare the catalog bounds with GLB vertex positions. The [vehicle envelopes](../contracts/worldScale.ts) catch vehicle meshes that fall outside their intended size range.

Use one or more complete locations to review each pack. These reference packs show the expected range of parts and the level of detail in a finished location.

| Chisel pack | Reference |
| --- | --- |
| Medieval | [Synty POLYGON Fantasy Kingdom](https://syntystore.com/products/polygon-fantasy-kingdom) |
| WW2 | [Synty POLYGON War Pack](https://syntystore.com/products/polygon-war-pack) |
| Sim | [Synty POLYGON City Pack](https://syntystore.com/products/polygon-city-pack) |
| Cyberpunk | [Synty POLYGON Sci-Fi Cyber City](https://syntystore.com/products/polygon-sci-fi-cyber-city) |
| Monsters | [Synty POLYGON Dungeon Realms](https://syntystore.com/products/polygon-dungeon-realms) |

- Make new shapes, layouts, and details for Chisel.
- Build sets with the parts needed to join walls and floors. Check corners, ends, changes in height, and door openings.
- Give each main prop a clear outline, a second layer of form, and a small area of color contrast. Check the front, rear, and side.
- Add small props where a person would use them. Keep paths and doorways clear.
- Review the location from character height and from above. Render it at desktop, 390 px, and 320 px with `npm run verify:visual -- --only '^09'`.
- At each width, check the outline of the main prop and the people or creatures that use it. Keep the parts that explain the action in frame. For example, show enough of a vehicle to identify it and keep the hands and working opening clear.
- Count geometry variants separately from recolors. Report the parts that can build a full location and the parts that are still missing.

Put each world prop override under `packs.<pack>.props.overrides` in the color contract. Change only the regions that need a different color. Blender stores the resulting colors in normalized glTF vertex colors. A standard glTF viewer displays the baked palette. The showcase uses the same UV regions for runtime recoloring.

### Lantern Exchange

The Cyberpunk demo shows a night transit market. The counter is the main point of interest. The lockers, workshop, and overhead sign show how people use the lane.

- Use dark blue-green metal for frames and warm brown-orange paint for hoods, covers, and brackets.
- Use pale cream for service signs. Repeat the lantern mark on the sign and the main props.
- Use mint for glass and guide lights. Keep it on smaller surfaces.
- Repeat recessed panels, thick seals, and angled edges across the counter, the workshop, and the apartment.
- Give each building a shape you can identify with its sign covered. Use stacked window bays on the apartment and an open service bay on the workshop.
- Use a thin fold for the noodle bar canopy and a metal lip above the cabinet seams. Leave space for the vendor's face beneath the canopy.
- Use warm light at the counter. Use cool light along the route. Keep the spaces behind these points darker.
- Check the action at 300 px and the route at 390 px. Show the hands and bowl between the two characters. Continue the paving and light one wall beyond the last gate.
