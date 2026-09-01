# Avatar z-fighting research

## Scope

This report investigates depth-fighting artifacts between avatar slot parts in `src/avatar/PirateAvatar.tsx` and `src/tabs/AvatarLab.tsx`. This is a diagnosis report and does not apply an unverified production workaround to the avatar GLB or runtime shaders.

## Current renderer

- **Canvas Depth:** `Canvas` runs with `logarithmicDepthBuffer: true` in both `AvatarLab.tsx` and `PackCanvas.tsx`.
- **Camera & Framing:** FOV 45°, framed with `FitCamera` maintaining near/far ratios computed from bounding boxes (`near = max(0.01, distance / 50)`, `far = distance * 50`).
- **Floor & Lighting:** Shadow plane positioned at `y = -0.01` to prevent ground z-fighting; 2048×2048 directional light shadow map with scaled normal bias.
- **Material Pipeline:** Opaque `PN-Material` using standard Three.js PBR shaders. Part selection toggles node visibility by filtering objects from the shared 344-node skeleton hierarchy.

## Reproduction matrix

| Part Combination | Animations Tested | Observed Behavior |
|---|---|---|
| `bottoms 12` + `shoes 2` | `00_TPose`, `01_Idle_1`, `04_Walk`, `06_Jump_Run`, `22_Drunk`, `31_Swimming` | Coplanar overlap along ankle cuff rim; severe flickering during bone shearing in motion. |
| `bottoms 12` + `shoes 3` | `00_TPose`, `01_Idle_1`, `04_Walk`, `06_Jump_Run`, `22_Drunk`, `31_Swimming` | Coplanar cuff vertices shear against `LowerLeg` bone; visible flickering across camera angles. |
| `bottoms 12` + `shoes 4` | `00_TPose`, `01_Idle_1`, `04_Walk`, `06_Jump_Run`, `22_Drunk`, `31_Swimming` | Intermittent depth fighting at bind pose, worsening as ankle rotates. |
| `bottoms 12` + `shoes 5` | `00_TPose`, `01_Idle_1`, `04_Walk`, `06_Jump_Run`, `22_Drunk`, `31_Swimming` | Identical rim seam conflict with pant cuffs. |
| `bottoms 12` + `shoes 15` | `00_TPose`, `01_Idle_1`, `04_Walk`, `06_Jump_Run`, `22_Drunk`, `31_Swimming` | High-frequency depth flicker at the upper shoe border. |
| `bottoms 1` + `shoes 1` | All clips | Clean render: `shoes 1` mesh was authored with a slight outward puff (~5e-5 units), preventing coplanar alignment. |
| `bottoms 23` + `shoes 6` | All clips | Clean render: geometry contours do not share identical vertex positions. |

## Asset evidence

- An asset-level skinning probe of `characters-skins-avatar-animation-all-023.glb` confirmed that `shoes 2, 3, 4, 5, 15` share 24 vertices with `bottoms 12` within a distance of `< 1e-6` (9 vertices are within `< 1e-8`).
- The conflicting vertices are weighted to different bones (`Foot.L/R` for shoes vs `LowerLeg.L/R` for bottoms), causing shearing across frames whenever joints bend.
- Logarithmic depth buffer handles sub-millimeter offsets, but cannot resolve exact bit-identical depths with opposing bone deformations.

## Mitigation results

| Candidate Mitigation | Visual Stability | Shadow Impact | Artifact Free | Pass / Fail |
|---|---|---|---|---|
| **1. Logarithmic Depth Only** | Unstable on coplanar verts | None | No | Fail |
| **2. `polygonOffset` on Opaque Materials** | Rasterizer offset bypassed by logarithmic depth buffer shader | None | No | Fail |
| **3. `depthWrite = false` on Opaque Parts** | Solves flicker but causes severe sorting errors across angles | None | No | Fail |
| **4. Vertex Shader Normal Offset (`onBeforeCompile`)** | Puffs shoe shell outward by `+0.0002` units; resolves z-fighting cleanly | None | Yes | Pass (Viable runtime option) |
| **5. Upstream Source GLB Geometry Repair** | Fixes vertices at authoring time; matches `shoes 1` pattern | None | Yes | Pass (Upstream fix) |
| **6. Camera Near/Far Tuning** | No effect on bit-identical depth values | None | No | Fail |

## Duplicate Shoes Bug (`model` Base Node)

In addition to cuff coplanarity, avatars previously exhibited severe full-foot z-fighting where shoes appeared to change or flicker across camera angles.

### Root Cause
- The avatar art file `characters-skins-avatar-animation-all-023.glb` contains 327 meshes under the `armature` node: 325 slot meshes (`species 1..19`, `tops 1..82`, `shoes 1..15`, etc.), the bone `Root`, and a single un-prefixed mesh node named `model` (`mesh 210`, `model.032`).
- Mesh `210` (`model`) is an unindexed shoe/foot mesh bound to `Foot.L` and `Foot.R` occupying the exact bounding box `[-0.05..0.08, 0..0.07, -0.1..0.1]`.
- Upstream client code had defined `AVATAR_BASE_NODE = "model"` under the assumption that `model` was the mandatory base torso/body. However, the base body is already contained within `species 1..19`.
- As a result, `resolvePartNodes()` unconditionally included `model`, causing the renderer to mount **two sets of shoes simultaneously** (`model` + whatever `shoes X` slot was selected). When the camera orbited or joints moved, depth precision caused polygons from `model` and `shoes X` to alternately render on top.

### Resolution
- Removed `AVATAR_BASE_NODE` from `resolvePartNodes()` in `src/avatar/composeAvatar.ts`.
- Every avatar now renders exactly one set of shoes (the chosen `shoes` slot), completely eliminating dual-shoe overlap and camera-angle popping.

## Recommendation

The dual-shoe issue is resolved by omitting the rogue `model` mesh from node resolution. For remaining minor vertex coplanarity at the ankle cuff rim between specific bottoms and shoes (`bottoms 12` + `shoes 2..5, 15`), upstream models can be normalized or a subtle vertex shader normal puff can be applied.

