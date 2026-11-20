import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'
import { CREATURE_MOTION } from '../contracts/catalog'
import {
  auditCreatureGlb,
  firstNonRigidVertex,
  maxLatticeOffset,
  maxNormalAxisError,
  mottledRegions,
  quadrupedSilhouetteProblems,
  regionsBelowDarkFloor,
  stretchOf,
  type Extent,
} from './creatureAudit'
import { STAGE_DIR } from './paths'

const VOXEL = 0.04
const cells = (x: [number, number], y: [number, number], z: [number, number]): Extent => ({
  min: [x[0] * VOXEL, y[0] * VOXEL, z[0] * VOXEL],
  max: [x[1] * VOXEL, y[1] * VOXEL, z[1] * VOXEL],
})

/** Joint bounds of the Guard Hound in voxel faces (blender/build_creatures.py -> build_guard_hound). */
function houndExtents(): Map<string, Extent> {
  const extents = new Map<string, Extent>([
    ['pelvis', cells([-3.5, 3.5], [13, 20], [-12, -2])],
    ['spine_01', cells([-2.5, 2.5], [14, 19], [-5, 4])],
    ['spine_02', cells([-3.5, 3.5], [13, 21], [2, 10])],
    ['chest', cells([-4.5, 4.5], [12, 22], [8, 14])],
    ['head', cells([-2.5, 2.5], [21, 28], [15, 25])],
  ])
  for (const [leg, side] of [['fl', 1], ['fr', -1], ['bl', 1], ['br', -1]] as const) {
    const x: [number, number] = side > 0 ? [2.5, 4.5] : [-4.5, -2.5]
    const plate: [number, number] = side > 0 ? [2.5, 5.5] : [-5.5, -2.5]
    const front = leg.startsWith('f')
    extents.set(`leg_${leg}_upper`, cells(plate, [7, 17], front ? [5, 10] : [-12, -5]))
    extents.set(`leg_${leg}_lower`, cells(x, [1, 9], front ? [7, 9] : [-10, -8]))
    extents.set(`leg_${leg}_paw`, cells(x, [0, 2], front ? [7, 11] : [-10, -6]))
  }
  return extents
}

describe('creature audit measures', () => {
  it('finds a vertex that is off the world lattice', () => {
    expect(maxLatticeOffset([0.02, 0.16, -0.48, 0.14, 0, 0.04], VOXEL).offset).toBeCloseTo(0, 9)
    // A limb that is anchored on the raw joint position (x = 0.135 m) and not on the lattice.
    const off = maxLatticeOffset([0.02, 0.16, -0.48, 0.135 - 0.04, 0.16, 0.32], VOXEL)
    expect(off.offset).toBeCloseTo(0.005, 9)
    expect(off.vertex).toBe(1)
  })

  it('accepts axis-aligned normals and rigid weights only', () => {
    expect(maxNormalAxisError([1, 0, 0, 0, -1, 0])).toBe(0)
    expect(maxNormalAxisError([Math.SQRT1_2, Math.SQRT1_2, 0])).toBeGreaterThan(0.2)
    expect(firstNonRigidVertex([[1, 0, 0, 0], [1, 0, 0, 0]])).toBe(-1)
    expect(firstNonRigidVertex([[1, 0, 0, 0], [0.7, 0.3, 0, 0]])).toBe(1)
  })

  it('applies the dark-albedo floor to the mottled regions only', () => {
    // u selects the region (hair = 0.15, visor = 0.85). A TEXCOORD_1 of -999 marks a face with mottle off.
    const uvs = [[0.15, 0.5], [0.85, 0.5], [0.45, 0.96]]
    const uv1s = [[3, 4], [-999, -999], [-999, -999]]
    expect(mottledRegions(uvs, uv1s)).toEqual(['hair'])
    const base = { skin: '#efe4cf', primary: '#cb5a26', secondary: '#93401a', accent: '#ffb02e', metal: '#c2cad4', visor: '#1e1612' }
    // The first fox palette: a charcoal of 0.023 on the stockings. Its facets were not visible.
    expect(regionsBelowDarkFloor({ ...base, hair: '#2d292d' }, ['hair'])).toEqual(['hair'])
    expect(regionsBelowDarkFloor({ ...base, hair: '#3d3538' }, ['hair'])).toEqual([])
    // A glossy nose is a sharp feature with mottle off: it is not in the mottled regions, thus it can be darker.
    expect(regionsBelowDarkFloor({ ...base, hair: '#3d3538' }, mottledRegions(uvs, uv1s))).toEqual([])
  })

  it('measures the scale and the shear of a bone', () => {
    expect(stretchOf(new Matrix4().makeRotationY(1.1))).toBeCloseTo(0, 9)
    // The cat rig scales a thigh to 12% in its lie-down clips.
    expect(stretchOf(new Matrix4().makeScale(1, 0.12, 1))).toBeCloseTo(0.88, 9)
    expect(stretchOf(new Matrix4().makeShear(0, 0.3, 0, 0, 0, 0))).toBeGreaterThan(CREATURE_MOTION.maxBoneStretch)
  })
})

describe('quadruped silhouette contract', () => {
  it('accepts the Guard Hound', () => {
    expect(quadrupedSilhouetteProblems(houndExtents(), VOXEL)).toEqual([])
  })

  it('rejects a box trunk, a wide head, a thick leg, a flat paw and a side brick', () => {
    const problemsWith = (edit: (extents: Map<string, Extent>) => void): string[] => {
      const extents = houndExtents()
      edit(extents)
      return quadrupedSilhouetteProblems(extents, VOXEL)
    }
    const box = problemsWith((e) => {
      for (const joint of ['pelvis', 'spine_01', 'spine_02']) e.set(joint, cells([-4.5, 4.5], [13, 20], [-12, 10]))
    })
    expect(box).toHaveLength(1)
    expect(box[0]).toContain('box')
    expect(problemsWith((e) => e.set('head', cells([-5.5, 5.5], [21, 28], [15, 25])))[0]).toContain('head')
    expect(problemsWith((e) => e.set('leg_fl_lower', cells([2.5, 4.5], [1, 9], [6, 9])))[0]).toContain('2 x 3')
    expect(problemsWith((e) => e.set('leg_bl_paw', cells([2.5, 4.5], [0, 2], [-10, -8])))[0]).toContain('0 voxels in front')
    expect(problemsWith((e) => e.set('leg_fr_upper', cells([-6.5, -2.5], [7, 17], [5, 10])))[0]).toContain('2 voxels out')
  })
})

const HOUND_GLB = join(STAGE_DIR, 'run-cubix-creatures/3D/characters/quadruped-rig.glb')

describe.skipIf(!existsSync(HOUND_GLB))('creature audit of the built Guard Hound', () => {
  it('passes each check and no clip opens a gap', async () => {
    const report = await auditCreatureGlb(HOUND_GLB, { nodeName: 'body_dire_wolf', contractQuadruped: true })
    expect(report.problems).toEqual([])
    expect(report.segments).toBe(22)
    expect(report.clips).toHaveLength(6)
    expect(Math.max(...report.clips.map((clip) => clip.gap))).toBeLessThan(0.05)
    expect(Math.max(...report.clips.map((clip) => clip.stretch))).toBeLessThan(1e-6)
  })

  it('fails the same file when its lattice does not match its voxel size', async () => {
    const raw = readFileSync(HOUND_GLB)
    const jsonLength = raw.readUInt32LE(12)
    const json = raw.subarray(20, 20 + jsonLength).toString('utf8')
    // Same byte length: the chunk layout stays valid.
    const edited = json.replace('"voxelSize":0.04', '"voxelSize":0.03')
    expect(edited).not.toBe(json)
    const dir = mkdtempSync(join(tmpdir(), 'voxchar-creature-'))
    try {
      const path = join(dir, 'off-lattice.glb')
      writeFileSync(path, Buffer.concat([raw.subarray(0, 20), Buffer.from(edited, 'utf8'), raw.subarray(20 + jsonLength)]))
      const report = await auditCreatureGlb(path, { nodeName: 'body_dire_wolf' })
      expect(report.problems.some((problem) => problem.includes('off the lattice'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
