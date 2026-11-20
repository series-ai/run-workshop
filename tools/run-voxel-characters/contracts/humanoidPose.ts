import { HUMANOID_PROPORTION_DEFAULTS, HUMANOID_VOXEL_SIZE } from './catalog'
import { boneScaleFor } from './proportions'
import { UAL1_RIG } from './rig'

/**
 * Sculpt pose of the voxel humans: the scale of each UAL1 bone at the default humanoid proportions.
 *
 * The runtime scales each bone around its bind joint. The Blender builders sculpt in the scaled pose and
 * write the inverse into the bind-pose mesh. Thus the runtime shows cubes of `voxelSize` on one lattice.
 * `scripts/build.ts` writes this value to `<meta>/humanoid-pose.json` for `blender/voxchar.py`.
 */
export interface HumanoidSculptPose {
  voxelSize: number
  proportions: typeof HUMANOID_PROPORTION_DEFAULTS
  boneScales: Record<string, [number, number, number]>
}

export function humanoidSculptPose(): HumanoidSculptPose {
  const boneScales: Record<string, [number, number, number]> = {}
  const scratch = { x: 1, y: 1, z: 1 }
  for (const bone of UAL1_RIG.joints) {
    boneScaleFor(bone, HUMANOID_PROPORTION_DEFAULTS, scratch, 'ual1')
    boneScales[bone] = [scratch.x, scratch.y, scratch.z]
  }
  return { voxelSize: HUMANOID_VOXEL_SIZE, proportions: HUMANOID_PROPORTION_DEFAULTS, boneScales }
}
