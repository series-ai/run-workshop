import { describe, expect, it } from 'vitest'
import { BUDGETS } from './budgets'
import { leavesFor, VOXCHAR_PACK_KEYS } from './packs'
import {
  BIPEDAL_MONSTER_CONTRACT,
  CREATURE_MOTION,
  HUMANOID_HEADWEAR_VOXEL_SIZE,
  HUMANOID_PROPORTION_DEFAULTS,
  HUMANOID_SILHOUETTE,
  HUMANOID_VOXEL_SIZE,
  PROP_CRAFT,
  QUADRUPED_SILHOUETTE,
  heldItemEntrySchema,
} from './catalog'
import { humanoidSculptPose } from './humanoidPose'
import {
  CONTEXT_DEFAULT_PALETTES,
  garmentRegionsBelowDarkFloor,
  MIN_GARMENT_LUMINANCE,
  PALETTE_REGIONS,
  relativeLuminance,
} from './palette'
import { ARACHNID_RIG, QUADRUPED_RIG, RIG_SPECS, UAL1_RIG } from './rig'

describe('run-voxel-characters contracts', () => {
  it('enforces 53-joint UAL1 + creature rig contracts', () => {
    expect(UAL1_RIG.joints).toHaveLength(53)
    expect(UAL1_RIG.clips.length).toBeGreaterThanOrEqual(43)
    expect(QUADRUPED_RIG.joints).toHaveLength(23)
    expect(ARACHNID_RIG.joints).toHaveLength(28)
    expect(RIG_SPECS.ual1.joints[0]).toBe('root')
  })

  it('defines valid palettes and S23 Ultra budgets', () => {
    expect(PALETTE_REGIONS).toHaveLength(10)
    expect(Object.keys(CONTEXT_DEFAULT_PALETTES)).toEqual(['heist', 'industrial', 'security', 'creatures', 'fantasy'])
    expect(BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar).toBe(2200)
  })

  it('keeps the garment colors of each context palette above the dark-albedo floor', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6)
    expect(relativeLuminance('#333333')).toBeGreaterThan(MIN_GARMENT_LUMINANCE)
    // The v4 heist tee: its facets were not visible.
    expect(garmentRegionsBelowDarkFloor({ ...CONTEXT_DEFAULT_PALETTES.heist, primary: '#24262b' })).toEqual(['primary'])
    for (const palette of Object.values(CONTEXT_DEFAULT_PALETTES)) {
      expect(garmentRegionsBelowDarkFloor(palette)).toEqual([])
    }
  })

  it('defines the canonical voxel size and silhouette ratios of the voxel humans', () => {
    // Measured on the canonical 5 cm voxel hero: 38 voxels tall. The v5 voxel (0.036 m) made a character 56 voxels tall.
    expect(HUMANOID_VOXEL_SIZE).toBe(0.05)
    expect(HUMANOID_HEADWEAR_VOXEL_SIZE).toBe(0.025)
    expect(1.9 / HUMANOID_VOXEL_SIZE).toBeCloseTo(38, 6)

    const {
      faceToChestWidth,
      headEnvelopeToChestWidth,
      headwearToChestWidth,
      maxHeadwearHeight,
      minFacePortraitRatio,
      minNeckToFaceWidth,
      minArmToChestWidth,
      minCalfToThighWidth,
      minShoeLength,
      maxHeelBackOffset,
      minToeStep,
    } = HUMANOID_SILHOUETTE
    const [minFace, maxFace] = faceToChestWidth
    const [minEnvelope, maxEnvelope] = headEnvelopeToChestWidth
    const [minHat, maxHat] = headwearToChestWidth
    expect(minFace).toBeLessThan(maxFace)
    expect(minEnvelope).toBeLessThan(maxEnvelope)
    expect(minHat).toBeLessThan(maxHat)

    // The v14 human: a 3 x 5 x 4 voxel skin face/skull (15 x 25 x 20 cm, 1 block forward on a flush-back 2 x 2 neck that drops 1 block into the shirt)
    // in a 5-wide hair envelope, a 7-wide chest, 2 x 2 arms, 3 x 3 thighs, 2 x 2 bare or 3 x 2 trouser calves,
    // and a flush-back 3 + 1 shoe (0.20 m long).
    const v = HUMANOID_VOXEL_SIZE
    const chestW = 7 * v + 0.008
    expect((3 * v) / (7 * v)).toBeGreaterThan(minFace)
    expect((3 * v) / (7 * v)).toBeLessThan(maxFace)
    expect((5 * v) / (3 * v)).toBeGreaterThanOrEqual(minFacePortraitRatio)
    expect((5 * v) / (7 * v)).toBeGreaterThan(minEnvelope)
    expect((5 * v) / (7 * v)).toBeLessThan(maxEnvelope)
    // Snug 0.025 m headwear: 20 cm shell (+ 8 mm pad) and 25 cm brim (+ 8 mm pad), never 35 cm mushroom lids.
    expect((8 * HUMANOID_HEADWEAR_VOXEL_SIZE + 0.008) / chestW).toBeGreaterThanOrEqual(minHat)
    expect((10 * HUMANOID_HEADWEAR_VOXEL_SIZE + 0.008) / chestW).toBeLessThanOrEqual(maxHat)
    expect((7 * v + 0.008) / chestW).toBeGreaterThan(maxHat)
    expect(maxHeadwearHeight).toBeLessThanOrEqual(0.36)
    expect((2 * v) / (3 * v)).toBeGreaterThanOrEqual(minNeckToFaceWidth)
    expect((2 * v) / (7 * v)).toBeGreaterThanOrEqual(minArmToChestWidth)
    expect((2 * v) / (3 * v)).toBeGreaterThanOrEqual(minCalfToThighWidth)
    expect((3 * v) / (3 * v)).toBeGreaterThanOrEqual(minCalfToThighWidth)
    expect(4 * v).toBeGreaterThanOrEqual(minShoeLength)
    expect(0).toBeLessThanOrEqual(maxHeelBackOffset)
    expect(1 * v).toBeGreaterThanOrEqual(minToeStep)

    // The v5 head: a 0.252 m wide, 0.288 m tall face on a 0.324 m chest. It read wide, square and squat.
    expect(0.252 / 0.324).toBeGreaterThan(maxFace)
    expect(0.288 / 0.252).toBeLessThan(minFacePortraitRatio)
    // The v4 pinhead: a 0.160 m head envelope on a 0.332 m chest, with 0.072 m arms.
    expect(0.16 / 0.332).toBeLessThan(minEnvelope)
    expect(0.072 / 0.332).toBeLessThan(minArmToChestWidth)
  })

  it('defines bipedal monster, prop craft, and forearm shield contracts', () => {
    expect(BIPEDAL_MONSTER_CONTRACT.requireBakedAo).toBe(true)
    expect(BIPEDAL_MONSTER_CONTRACT.silhouette.maxWaistToChestWidth).toBeLessThan(0.85)
    expect(BIPEDAL_MONSTER_CONTRACT.silhouette.minHeadDepthMeters).toBeGreaterThanOrEqual(0.24)
    expect(BIPEDAL_MONSTER_CONTRACT.silhouette.minHeadForwardOffset).toBeGreaterThan(0)
    expect(BIPEDAL_MONSTER_CONTRACT.silhouette.minFootLengthMeters).toBeGreaterThanOrEqual(0.2)

    expect(PROP_CRAFT.minHeightMeters).toBeGreaterThanOrEqual(0.2)
    expect(PROP_CRAFT.minUniqueShades).toBeGreaterThanOrEqual(3)

    const parsedDefault = heldItemEntrySchema.parse({
      id: 'held_broadsword',
      pack: 'fantasy',
      leaf: 'characters',
      relativePath: 'held_broadsword.glb',
      nodeName: 'held_broadsword',
      label: 'Broadsword',
      hand: 'hand_r',
      triangles: 120,
    })
    expect(parsedDefault.gripStyle).toBe('handle')

    const parsedShield = heldItemEntrySchema.parse({
      id: 'held_heater_shield',
      pack: 'fantasy',
      leaf: 'characters',
      relativePath: 'held_heater_shield.glb',
      nodeName: 'held_heater_shield',
      label: 'Heater Shield',
      hand: 'hand_l',
      gripStyle: 'forearm_shield',
      triangles: 200,
    })
    expect(parsedShield.gripStyle).toBe('forearm_shield')
  })

  it('defines the quadruped silhouette and the creature motion rules on the Guard Hound', () => {
    const {
      faceToChestWidth,
      maxHeadToChestWidth,
      maxWaistToChestWidth,
      lowerLegSectionVoxels,
      pawToeStepVoxels,
      maxLimbProudVoxels,
      maxBrowOverhangVoxels,
      maxPivotOutsideVoxels,
      maxLimbOffCentreVoxels,
    } = QUADRUPED_SILHOUETTE
    const [minFace, maxFace] = faceToChestWidth
    const [minToe, maxToe] = pawToeStepVoxels
    expect(minFace).toBeLessThan(maxFace)
    expect(maxFace).toBeLessThanOrEqual(maxHeadToChestWidth)

    // The Guard Hound: chest 9, waist 5, hips 7, skull 5, 2 x 2 lower legs, a toe step of 2, plates 1 cell out,
    // a brow bar 1 cell out, and a leg joint 0.125 voxels from the centre of its leg columns.
    expect(5 / 9).toBeGreaterThanOrEqual(minFace)
    expect(5 / 9).toBeLessThanOrEqual(maxFace)
    expect(5 / 9).toBeLessThanOrEqual(maxWaistToChestWidth)
    expect(lowerLegSectionVoxels).toBe(2)
    expect(2).toBeGreaterThanOrEqual(minToe)
    expect(2).toBeLessThanOrEqual(maxToe)
    expect(1).toBeLessThanOrEqual(maxLimbProudVoxels)
    expect(1).toBeLessThanOrEqual(maxBrowOverhangVoxels)
    expect(0.125).toBeLessThanOrEqual(maxLimbOffCentreVoxels)
    // The largest distance of a Guard Hound joint from its segment: the tail joints, 0.75 voxels.
    expect(0.75).toBeLessThanOrEqual(maxPivotOutsideVoxels)

    // Defects of the first animal pass: a 7-wide head on a 7-wide chest (cat), a 9-wide head (pug), a trunk of
    // one width (corgi 7 / 7), and a hind leg whose joint was 3.7 voxels in front of its cells (wolf).
    expect(7 / 7).toBeGreaterThan(maxFace)
    expect(9 / 9).toBeGreaterThan(maxFace)
    expect(7 / 7).toBeGreaterThan(maxWaistToChestWidth)
    expect(3.7).toBeGreaterThan(maxPivotOutsideVoxels)
    // The largest gap of the first pass was 5.8 voxels (horse). The Guard Hound has 0.
    expect(5.8).toBeGreaterThan(CREATURE_MOTION.maxSegmentGapVoxels)
    expect(CREATURE_MOTION.maxBoneStretch).toBeLessThan(0.05)
    expect(CREATURE_MOTION.minAnimatedDegrees).toBeLessThanOrEqual(5)
  })

  it('sculpts the voxel humans for proportions that keep the rig pivots on the lattice', () => {
    const pose = humanoidSculptPose()
    expect(pose.voxelSize).toBe(HUMANOID_VOXEL_SIZE)
    expect(pose.proportions).toEqual(HUMANOID_PROPORTION_DEFAULTS)
    expect(Object.keys(pose.boneScales)).toEqual([...UAL1_RIG.joints])
    // The legs are shorter and the spine is longer than the UAL1 bind pose: the belt is at 50% of the height.
    expect(pose.boneScales.thigh_l![1]).toBeLessThan(1)
    expect(pose.boneScales.spine_02![1]).toBeGreaterThan(1)
    // Head, hands and feet keep their size: their voxels are sculpted 1:1.
    for (const bone of ['Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r']) {
      expect(pose.boneScales[bone]).toEqual([1, 1, 1])
    }
  })

  it('generates jam-ready-assets v2 leaves for all packs', () => {
    expect(VOXCHAR_PACK_KEYS).toEqual(['core', 'heist', 'industrial', 'security', 'creatures', 'fantasy'])
    expect(leavesFor('core').map((l) => l.id)).toEqual(['run-cubix-core/3D/characters'])
    expect(leavesFor('heist').map((l) => l.id)).toEqual([
      'run-cubix-heist/3D/characters',
      'run-cubix-heist/3D/heist',
    ])
  })
})
