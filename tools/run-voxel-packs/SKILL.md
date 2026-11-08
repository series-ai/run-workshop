---
name: run-voxel-packs
description: Create or repair RUN voxel pack assets with the measured Pirate Nation style, build checks, motion review, and pack art gate. Use for work under tools/run-voxel-packs/assets. Do not use for unrelated 3D assets.
---

# RUN voxel assets

Read [the authoring workflow](docs/authoring-workflow.md) before you create or
repair an asset. Read [the art rules](docs/art-direction.md) and the scale class
for the asset. Use the commands in [README.md](README.md).

## Make or repair an asset

1. Check the pack inventory and exact category count. For an existing ID,
   repair its source. A new ID needs an inventory decision. Change the count
   contract only if the approved inventory grows.
   Record the asset's function, main shape, colour roles, scale class, and one
   character detail. Record a Pirate Nation reference and two RUN siblings.
   For a repair, record the defect and keep the asset ID.
2. Edit the asset's Python source. Use one world unit per voxel and one atlas
   texel per world unit. Use shared shape and paint tools for small parts.
   Give assets with different functions different main shapes.
3. Build the asset. Run asset validation. Fix every reported rule failure.
4. Review four views, a 128 px view, and a native-scale lineup with a
   36-voxel person. Compare it with its references and siblings. Review the
   whole category for repeated shapes, colour use, and size drift.
5. Scrub each changed clip through its full action in the RUN viewer. Review
   frames on both sides of every loop join. Check grip, contact, effect timing,
   and effect direction.
6. Get an independent art review of the final output. Bind its record to the
   final GLB hash. A P0 or P1 finding blocks release. Rework and review again
   after each output change. Run `npm run review:check -- --record <review.json>`.

For a new pack or a large batch, use a pilot across its categories before bulk
work. Stop when the pilot shows a repeated defect. After asset reviews pass,
review category sheets and true-scale pack lineups. Then run the full release
flow in README.md.

The validator proves measured limits. It does not prove a clear silhouette,
purposeful humour, a distinct shape, or good motion. Use the visual gate for
those decisions.

For a new effect recipe, read [the PFX skill](../3d-pfx-library/SKILL.md).
