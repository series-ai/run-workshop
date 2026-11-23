# Cubix level kit files

Each pack folder has a complete scene in `demo.glb`. It also has the occupied voxel cells and scene placements in `demo.voxels.json`. Both files use the same prefabs and transforms. The `props/` folder contains the separate prop meshes. The `vehicles/` folder contains the articulated GLB rigs. The voxel scene contains the parked shapes used in the demo. See `License.txt` in each pack folder.

In the ZIP, read each pack's `props.json` to find the relative GLB paths,
model names, local bounds, motion clips, and lamp names. Use a prop's `id`
to find its cells in `demo.voxels.json`.

## Read a voxel scene

Read UTF-8 JSON. Check that `format` is `cubix-level-voxels` and `version` is `1`.

1. Find each `scene.placements` entry's `propId` in `prefabs`. The same prefab can have more than one placement.
2. Read a prefab's `size` as the number of cells along X, Y, and Z. Read `origin` as the minimum corner of cell `[0, 0, 0]`, in meters relative to the prop pivot.
3. Expand each run `[x, y, z, length, code]` into `length` cells along positive X. All indices start at zero. A cell outside the runs is air. Cells inside solid objects are included.
4. Set the minimum corner of cell `[x, y, z]` to `origin + voxelSize * [x, y, z]` in prop-local space. Each cell is a cube. Apply the placement's rotation to the entire cube about local `[0, 0, 0]`, then add `position` in meters. Use a right-handed coordinate system with Y up. Each `turn` is a positive quarter-turn about Y. One turn maps local +X to -Z.
5. Keep each placed prefab on its own lattice if the engine supports separate voxel objects. Some placements are offset by part of a cell. Snapping them to a shared global grid can change the scene.

## Read a cell code

Subtract `1` from each `code` to get `value`. Code `0` is reserved for air and never occurs in a run.

| Field | Read from `value` |
| --- | --- |
| Palette index | `value >> 8`. Use this index in `regions`. Look for that region in the prefab's optional `palette` overrides first. Use the same region in the scene file's top-level `palette` when the prefab has no override. The color is in sRGB hex. |
| Shade | `(value >> 1) & 127`. Steps `0` through `24` give a shade from `-1` to `1` using `step / 12 - 1`. Step `31` is emissive. |
| Grain flag | `value & 1`. A value of `1` permits per-cell color variation. |

The cell codes keep the authored colors. The GLBs include baked surface
shading, a small grain texture, and a glTF metallic-roughness texture.
The voxel file includes the same finish data in `finishes`.
Use the prefab's optional `surface` field to select the `water` or
`glass` finish. Use the palette region's finish for other surfaces.
Each finish gives `[roughness, metalness]` from 0 to 1.

Use `finishes.glassOpacity` for transparent panes. Cells with emissive shade
use the accent color and `finishes.emissiveStrength` for emission. Use
`finishes.grain` as a repeating 16 by 16 table of sRGB gray values. Sample
one texel per cell on faces with the grain flag. A voxel renderer can
compute its own occlusion and reflections. Older voxel files can omit
`finishes`.

## Set scene lights and cameras

`scene.view` gives the overview frame, approach camera, and named camera
stops. `scene.fixtures` gives the point-light positions, colors, intensity,
and range in meters. `scene.environment` gives the sky gradient, exponential
fog density, sky and ground fill, and sun. The sun vector points from the
scene toward the sun. It can have any nonzero length.

The same scene data also appears in the top-level `level-scenes.json` in
the ZIP. The demo GLB has the same cameras and sun and point lights.
The GLB uses `KHR_lights_punctual` for the lights. Read
`scenes[scene].extras.cubixEnvironment` to set the sky, fog, and fill in
the receiving engine.
