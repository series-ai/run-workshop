import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { auditCreatureGlb } from '../src/creatureAudit'

/**
 * Check voxel creature GLBs that `blender/creature_kit.py` -> `CreatureSculptor` wrote on an external rig.
 *
 *   npm run validate:creature -- <creature.glb> [<creature.glb> ...]
 *
 * The checks read the built file: one skin, one mesh, one primitive, rigid weights, the world lattice and the
 * axis-aligned normals in the skinned rest pose, the body triangle budget, the dark-albedo floor of the mottled
 * palette regions, and for each clip the scale and the shear of the bones and the gap between each segment
 * and the segment that holds it.
 */
async function main(): Promise<void> {
  const files = process.argv.slice(2)
  if (files.length === 0) throw new Error('Usage: npm run validate:creature -- <creature.glb> [<creature.glb> ...]')
  let failed = 0
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`Missing file: ${file}`)
    const report = await auditCreatureGlb(file)
    const stretch = Math.max(0, ...report.clips.map((c) => c.stretch))
    const gap = Math.max(0, ...report.clips.map((c) => c.gap))
    const status = report.problems.length === 0 ? 'OK  ' : 'FAIL'
    console.log(
      `${status} ${basename(file)}: ${report.triangles} tris, ${report.segments} segments, voxel ${report.voxelSize}, ` +
        `${report.clips.length} clips, max stretch ${(stretch * 100).toFixed(1)}%, max segment gap ${gap.toFixed(2)} voxels`,
    )
    report.problems.forEach((problem, index) => console.log(`     ${index + 1}. ${problem}`))
    if (report.problems.length > 0) failed++
  }
  if (failed > 0) throw new Error(`${failed} of ${files.length} creature file(s) failed.`)
  console.log(`Creature validation passed: ${files.length} file(s), 0 errors.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
