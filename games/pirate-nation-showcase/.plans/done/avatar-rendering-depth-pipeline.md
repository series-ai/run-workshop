---
title: "Avatar Rendering & Depth Pipeline Architecture"
status: done
created: 2026-08-31
updated: 2026-08-31
tags: [avatar, 3d, rendering, depth, unity-parity]
---

# Avatar Rendering & Depth Pipeline Architecture

> **For agentic workers:** Use the `execute-spec` skill to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a robust avatar rendering and depth pipeline matching upstream Unity's render queue, sorting order, camera depth precision, and shadow configuration to permanently eliminate z-fighting and camera resets across all 326 avatar parts and 19 species.

**Architecture:** Replace brittle per-slot magic polygon offsets with an architectural pipeline matching Unity's `IPFSAvatarMaterialController` and `CrewCamera`: tight near/far camera depth bounds (20:1 ratio), base skin render ordering (`sortingOrder = -1`), consistent depth testing, and disabled internal part shadow self-interference.

**Tech Stack:** Three.js, React Three Fiber, GLTFLoader, SkeletonUtils, Vite, Vitest, Playwright.

---

## Overview

In Pirate Nation, avatars are composite characters constructed by selecting from 326 modular parts (19 species, 82 tops, 23 bottoms, 15 shoes, 20 faces, 17 eyebrows, 18 facial hairs, 29 hairs, 72 headwear, 23 eyewear, 5 ears, and 3 back items) all bound to a shared 16-bone rig (`characters-skins-avatar-animation-all-023.glb`).

Because voxel models share flat coplanar cube faces (e.g. bare skin under shirts, pant cuffs inside boot rims, face decals on head cubes), naive WebGL rendering causes z-fighting. Previous attempts used ad-hoc magic polygon offset numbers across arbitrary slot tiers. This plan implements the true upstream Unity pipeline architecture, ensuring clean, artifact-free rendering for all combinations.

## Background

Exploration of upstream Unity code in `/Users/pany/dev/piratenation-game` revealed the exact mechanisms Proof of Play used:

1. **Base Body Render Queue ([`RenderHelper.cs`](file:///Users/pany/dev/piratenation-game/Assets/_PirateNation_/Game/Core/Runtime/Utils/RenderHelper.cs#L36-L41)):**
   ```csharp
   private static int SkinRenderOrder = -1;
   public static void MakeSureSkinIsRenderedLast(SkinnedMeshRenderer r) {
       if (!r.gameObject.name.Contains("species")) return;
       r.sortingOrder = SkinRenderOrder;
   }
   ```
2. **Material Render Queue ([`IPFSAvatarMaterialController.cs`](file:///Users/pany/dev/piratenation-game/Assets/_PirateNation_/Game/Avatar/Runtime/IPFSAvatarMaterialController.cs#L50-L52)):**
   ```csharp
   meshFilter.shadowCastingMode = ShadowCastingMode.Off;
   meshFilter.sharedMaterial.renderQueue = (int) RenderQueue.AlphaTest;
   RenderHelper.MakeSureSkinIsRenderedLast(meshFilter);
   ```
3. **Camera Frustum Precision ([`CrewCamera.prefab`](file:///Users/pany/dev/piratenation-game/Assets/_PirateNation_/Game/Avatar/Assets/CrewCamera.prefab#L69-L70)):**
   - `near: 0.3`, `far: 6.0` (ratio of 20:1). By restricting depth range strictly to avatar bounds, 24-bit floating point depth buffer allocates maximum precision where parts overlap.

## Requirements

1. **Unity-Parity Camera Depth Frustum:** The avatar camera must use a tight depth range (`near: 0.3, far: 6.0`) with `fov: 34` centered at the body midpoint ($y = 0.85$), giving high depth buffer precision without precision loss.
2. **Skin Base-Layer Render Ordering:** All base body / species mesh renderers must be assigned `renderOrder = 0` (matching Unity's `SkinRenderOrder = -1`), while clothing and accessories use `renderOrder = 1` and decals use `renderOrder = 2`.
3. **Consistent Depth Write & Alpha Testing:** Materials must have `depthTest: true`, `depthWrite: true`, and standard `LessEqualDepth` without conflicting polygon offsets.
4. **Avatar Camera State Stability:** Camera framing and orientation must remain stable during slot/color trait changes; only an explicit reset action or initial load frames the camera.
5. **Full-Body Skin Compatibility:** Full-body species (`8, 9, 10, 11, 14, 15, 16, 17, 18, 19`) must render cleanly with single required slot `'species'`, while base bodies (`1..7, 12, 13`) require standard outfit slots.

## Non-goals

- Modifying upstream raw `.glb` geometry buffers or vertex coordinates.
- Re-authoring Blender source models.
- Changing catalog schema or JSON structures.

## Acceptance Criteria

- [ ] Selection `{ species: 7, face: 13, tops: 1, bottoms: 1, shoes: 1, back: 3 }` renders with zero visible z-fighting between shark skin, pants, boots, and shirt.
- [ ] Selection `{ species: 1, face: 4, tops: 6, bottoms: 5, shoes: 5 }` renders cleanly without z-fighting between human bare torso and vest.
- [ ] Changing any trait slot or color swatch in Avatar Lab does not reset the camera position, pitch, yaw, or zoom.
- [ ] Orbiting the camera revolves directly around the center of the pirate's torso ($y = 0.85$).
- [ ] All 64 unit tests and 12 Playwright e2e tests pass without errors.

## File Roster

| File | Action | Why |
|------|--------|-----|
| `src/avatar/PirateAvatar.tsx` | modify | Implement Unity-parity renderOrder and material pipeline |
| `src/tabs/AvatarLab.tsx` | modify | Configure camera frustum (near: 0.3, far: 6.0) and stable orbit controls |
| `src/avatar/PirateAvatar.test.ts` | modify | Add test cases verifying renderOrder and depth hierarchy across parts |

## Implementation Plan

### Task 1: Pipeline & Material Configuration in PirateAvatar

**Files:**
- Modify: `src/avatar/PirateAvatar.tsx`
- Test: `src/avatar/PirateAvatar.test.ts`

- [ ] **Step 1: Write the unit tests for renderOrder and material properties**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement clean renderOrder hierarchy in PirateAvatar.tsx**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Avatar Lab Camera Frustum & Orbit Precision

**Files:**
- Modify: `src/tabs/AvatarLab.tsx`

- [ ] **Step 1: Update Canvas camera configuration (near: 0.3, far: 6.0)**
- [ ] **Step 2: Run Playwright e2e test**

## Open Questions

(None - All technical requirements grounded in upstream Unity source code.)
