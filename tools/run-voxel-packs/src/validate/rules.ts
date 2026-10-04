/**
 * Contract rules for one GLB. Pure: summary + context in, violations out.
 *
 * Two profiles. `rvx` is the full contract for new RUN voxel assets.
 * `pn-compat` checks only what interchange needs from Pirate Nation
 * reference assets (rig by joint name, finite bounds); PN materials vary,
 * e.g. the knight skin samples its palette linear/repeat.
 */
import { PIRATE_JOINT_NAMES, PIRATE_RIG } from '../../contracts/avatarRig.generated'
import { CATEGORY_SPECS, largestBudgetUnits, UNITS_PER_VOXEL, type Category } from '../../contracts/categories'
import { avatarClipOwner, isPropClip, ONE_SHOT_CLIPS, PIRATE_AVATAR_CLIPS } from '../../contracts/clips'
import type { RvxPackKey } from '../../contracts/packs'
import { PALETTE_SIZE } from '../../contracts/palette'
import { checkScaleClass, scaleClassesFor } from '../../contracts/scale'
import { STYLE } from '../../contracts/style'
import type { GlbSummary, SkinSummary } from './inspect'

export const GL_NEAREST = 9728
export const GL_CLAMP_TO_EDGE = 33071
/** Inverse-bind-matrix tolerance for rig compatibility. */
export const RIG_EPSILON = 1e-4
/** Held items: how far (voxels) the bounds may sit from the Hand.R joint origin. */
export const GRIP_REACH_VOXELS = 6
/** Visible z-fighting a file may keep (voxel²): slivers where a diagonal edge crosses a face. */
export const ZFIGHT_TOLERANCE = 1

export type RuleId =
  | 'material.palette'
  | 'material.sampler'
  | 'material.pbr'
  | 'mesh.present'
  | 'scale.budget'
  | 'scale.origin'
  | 'rig.order'
  | 'rig.names'
  | 'rig.bind'
  | 'rig.absent'
  | 'clips.required'
  | 'clips.names'
  | 'clips.no-pirate'
  | 'sockets.required'
  | 'sockets.names'
  | 'size.file'
  | 'material.primitive'
  | 'rig.rest'
  | 'clips.targets'
  | 'scale.class'
  | 'texture.density'
  | 'style.budget'
  | 'style.diagonal'
  | 'style.dark'
  | 'style.saturation'
  | 'geometry.zfight'
  | 'avatar.layers'
  | 'avatar.composite'
  | 'clips.loop'

export interface Violation {
  rule: RuleId
  message: string
}

export type AssetContext =
  | { profile: 'pn-compat'; kind: 'avatar-rig' | 'skin' | 'model' }
  | { profile: 'rvx'; pack: RvxPackKey; category: Category }

const RIG_BY_NAME = new Map(PIRATE_RIG.map((joint) => [joint.name, joint]))

/** Largest element difference of two 4×4 matrices; Infinity unless both are 16 finite values. */
function maxDiff(a: readonly number[] | undefined, b: readonly number[] | undefined): number {
  if (!a || !b || a.length !== 16 || b.length !== 16) return Infinity
  let max = 0
  for (let i = 0; i < 16; i += 1) {
    const d = Math.abs(a[i]! - b[i]!)
    if (!Number.isFinite(d)) return Infinity
    max = Math.max(max, d)
  }
  return max
}

/** Joint order and IBMs equal PN's: required to rebind parts to the PN skeleton. */
export function checkRigExact(skin: SkinSummary): Violation[] {
  if (skin.joints.join('|') !== PIRATE_JOINT_NAMES.join('|')) {
    return [{ rule: 'rig.order', message: `joint order [${skin.joints.join(', ')}] differs from PN [${PIRATE_JOINT_NAMES.join(', ')}]` }]
  }
  return checkRigByName(skin)
}

/** Every PN joint exists by name with a matching IBM; extra joints are allowed anywhere. */
export function checkRigByName(skin: SkinSummary): Violation[] {
  const out: Violation[] = []
  for (const name of PIRATE_JOINT_NAMES) {
    const index = skin.joints.indexOf(name)
    if (index === -1) {
      out.push({ rule: 'rig.names', message: `PN joint "${name}" is missing` })
      continue
    }
    const joint = RIG_BY_NAME.get(name)!
    const diff = maxDiff(skin.inverseBindMatrices[index], joint.inverseBindMatrix)
    if (diff > RIG_EPSILON) {
      out.push({ rule: 'rig.bind', message: `joint "${name}" inverse bind matrix differs from PN by ${diff === Infinity ? 'a missing or non-finite matrix' : diff.toExponential(2)} (max ${RIG_EPSILON})` })
    }
    // Clips drive the rest hierarchy, so the rest pose and PN parent must match too.
    const rest = maxDiff(skin.worldMatrices[index], joint.worldMatrix)
    if (rest > RIG_EPSILON) out.push({ rule: 'rig.rest', message: `joint "${name}" rest world transform differs from PN by ${rest === Infinity ? 'a non-finite matrix' : rest.toExponential(2)}` })
    if ((skin.jointParents[index] ?? null) !== joint.parent) {
      out.push({ rule: 'rig.rest', message: `joint "${name}" hangs under "${skin.jointParents[index]}", PN has "${joint.parent}"` })
    }
  }
  return out
}

/** World assets use a painted atlas (any size); avatar-space assets the shared 256×1 palette. */
function checkMaterials(summary: GlbSummary, category: Category): Violation[] {
  const atlas = CATEGORY_SPECS[category].space === 'world'
  const out: Violation[] = []
  for (const p of summary.primitives) {
    if (p.material < 0) out.push({ rule: 'material.primitive', message: `a primitive of mesh "${p.mesh}" has no material` })
    if (!atlas && !p.paletteUvs) out.push({ rule: 'material.primitive', message: `a primitive of mesh "${p.mesh}" lacks palette texel-centre UVs` })
  }
  for (const material of summary.materials) {
    const label = `material "${material.name}"`
    if (!material.baseColorSize || material.baseColorMime !== 'image/png') {
      out.push({ rule: 'material.palette', message: `${label} has no PNG ${atlas ? 'atlas' : 'palette'} texture` })
    } else if (!atlas && (material.baseColorSize[0] !== PALETTE_SIZE || material.baseColorSize[1] !== 1)) {
      out.push({ rule: 'material.palette', message: `${label} palette is ${material.baseColorSize.join('×')}, expected ${PALETTE_SIZE}×1` })
    }
    const s = material.sampler
    if (!s || s.magFilter !== GL_NEAREST || (s.minFilter !== null && s.minFilter !== GL_NEAREST) || s.wrapS !== GL_CLAMP_TO_EDGE || s.wrapT !== GL_CLAMP_TO_EDGE) {
      out.push({ rule: 'material.sampler', message: `${label} sampler must be nearest + clamp, got ${JSON.stringify(s)}` })
    }
    if (Math.abs(material.metallic) > 1e-6 || Math.abs(material.roughness - 1) > 1e-6) {
      out.push({ rule: 'material.pbr', message: `${label} must be metallic 0 / roughness 1, got ${material.metallic} / ${material.roughness}` })
    }
  }
  return out
}

function checkScale(summary: GlbSummary, category: Category): Violation[] {
  const spec = CATEGORY_SPECS[category]
  if (spec.origin === 'rig') return []
  if (!summary.bounds) return [{ rule: 'mesh.present', message: 'model has no mesh' }]
  const { min, max } = summary.bounds
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const largest = Math.max(...size)
  const [lo, hi] = largestBudgetUnits(category)
  const out: Violation[] = []
  if (!Number.isFinite(largest) || largest < lo - 1e-6 || largest > hi + 1e-6) {
    out.push({ rule: 'scale.budget', message: `largest dimension ${largest.toFixed(3)} is outside ${category} budget ${lo}–${hi}` })
  }
  const voxel = UNITS_PER_VOXEL[spec.space]
  if (spec.origin === 'base' || spec.origin === 'feet') {
    if (Math.abs(min[1]) > voxel * 0.5 + 1e-6) {
      out.push({ rule: 'scale.origin', message: `base must sit on y=0, min y is ${min[1].toFixed(3)}` })
    }
  }
  if (spec.origin === 'base') {
    const cx = (min[0] + max[0]) / 2
    const cz = (min[2] + max[2]) / 2
    // The export centres world assets on their full bounds (export.center_on_base).
    if (Math.abs(cx) > voxel + 1e-6 || Math.abs(cz) > voxel + 1e-6) {
      out.push({ rule: 'scale.origin', message: `model must be centred on x/z, centre is (${cx.toFixed(2)}, ${cz.toFixed(2)})` })
    }
  }
  if (spec.origin === 'grip') {
    // The origin is the Hand.R joint (the wrist); the palm sits ~3 voxels out.
    const reach = GRIP_REACH_VOXELS * voxel
    const near = [0, 1, 2].every((axis) => (min[axis] ?? 0) - reach <= 0 && 0 <= (max[axis] ?? 0) + reach)
    if (!near) out.push({ rule: 'scale.origin', message: `held item must lie within ${GRIP_REACH_VOXELS} voxels of its origin (the Hand.R joint)` })
  }
  return out
}

/** World assets: the declared scale class exists for the category and the bounds fit it. */
function checkScaleClassRule(summary: GlbSummary, category: Category): Violation[] {
  const allowed = scaleClassesFor(category)
  if (allowed.length === 0 || !summary.bounds) return []
  const name = summary.scaleClass
  if (!name) return [{ rule: 'scale.class', message: 'scene has no extras.rvx.scale class' }]
  if (!allowed.includes(name)) return [{ rule: 'scale.class', message: `scale class "${name}" is not allowed for ${category} (${allowed.join(', ')})` }]
  const unit = UNITS_PER_VOXEL[CATEGORY_SPECS[category].space]
  const { min, max } = summary.bounds
  const size = [0, 1, 2].map((a) => (max[a]! - min[a]!) / unit) as [number, number, number]
  return checkScaleClass(name, size).map((message) => ({ rule: 'scale.class', message }))
}

/**
 * World assets: the painted-atlas rules of the art direction. The texture is
 * 1 texel per unit (S1); the triangle budget and diagonal share fit the scale
 * class (F1, F2); dark area and saturation fit the pack theme (C2).
 */
function checkStyle(summary: GlbSummary, pack: RvxPackKey, category: Category): Violation[] {
  if (CATEGORY_SPECS[category].space !== 'world') return []
  const stats = summary.surface
  if (!stats) return [{ rule: 'texture.density', message: 'world asset has no painted PNG texture' }]
  const out: Violation[] = []
  const [lo, hi] = STYLE.unitsPerTexel
  if (stats.unitsPerTexel < lo || stats.unitsPerTexel > hi) out.push({ rule: 'texture.density', message: `texture is ${stats.unitsPerTexel.toFixed(2)} units per texel, expected ${lo}–${hi}` })
  const budget = summary.scaleClass ? STYLE.budgets[summary.scaleClass] : undefined
  if (budget) {
    const [tmin, tmax] = budget.triangles
    if (stats.triangles < tmin || stats.triangles > tmax) out.push({ rule: 'style.budget', message: `${stats.triangles} triangles, ${summary.scaleClass} budget is ${tmin}–${tmax}; paint detail instead of modelling it` })
    if (stats.diagonalShare + 1e-9 < budget.diagonalMin) out.push({ rule: 'style.diagonal', message: `${(stats.diagonalShare * 100).toFixed(0)}% of the surface is diagonal, ${summary.scaleClass} needs ≥${(budget.diagonalMin * 100).toFixed(0)}% (use true slopes)` })
  }
  if (stats.darkShare > STYLE.darkShareMax) out.push({ rule: 'style.dark', message: `${(stats.darkShare * 100).toFixed(0)}% of the painted area is darker than value 0.25 (max ${(STYLE.darkShareMax * 100).toFixed(0)}%)` })
  const floor = STYLE.saturationFloor[pack] ?? 0
  if (stats.meanSaturation < floor) out.push({ rule: 'style.saturation', message: `mean saturation ${stats.meanSaturation.toFixed(2)} is under the ${pack} floor ${floor}` })
  return out
}

function checkClips(summary: GlbSummary, pack: RvxPackKey, category: Category): Violation[] {
  const out: Violation[] = []
  const names = summary.animations.map((animation) => animation.name)
  const avatarRig = category === 'avatar' || category === 'characters-skins'
  for (const name of names) {
    if (PIRATE_AVATAR_CLIPS.includes(name)) {
      out.push({ rule: 'clips.no-pirate', message: `clip "${name}" is a PN clip; PN clip data must not ship in RUN voxel packs` })
      continue
    }
    if (avatarRig) {
      const targets = summary.animations.find((a) => a.name === name)?.targets ?? []
      const stray = targets.filter((t) => !PIRATE_JOINT_NAMES.includes(t))
      if (stray.length > 0) out.push({ rule: 'clips.targets', message: `avatar clip "${name}" drives non-PN nodes: ${stray.join(', ')}` })
      let owner: string
      try {
        owner = avatarClipOwner(name)
      } catch (error) {
        out.push({ rule: 'clips.names', message: (error as Error).message })
        continue
      }
      if (owner !== pack) out.push({ rule: 'clips.names', message: `clip "${name}" is in the ${owner} clip range, not ${pack}` })
    } else if (!isPropClip(name)) {
      out.push({ rule: 'clips.names', message: `clip "${name}" is not in the prop clip vocabulary` })
    }
  }
  // A looping clip must end where it starts, or it snaps back every cycle.
  for (const animation of summary.animations) {
    if (avatarRig || ONE_SHOT_CLIPS.includes(animation.name) || !animation.seam) continue
    const unit = animation.seam.path === 'translation' ? UNITS_PER_VOXEL[CATEGORY_SPECS[category].space] : 1
    if (animation.seam.path === 'translation' && animation.seam.gap < 0.02 * unit) continue
    const amount = animation.seam.path === 'rotation' ? `${animation.seam.gap.toFixed(1)}°` : animation.seam.path === 'translation' ? `${(animation.seam.gap / unit).toFixed(2)} voxel` : animation.seam.gap.toFixed(3)
    out.push({ rule: 'clips.loop', message: `looping clip "${animation.name}" does not end where it starts: ${animation.seam.channel} is ${amount} off, so it snaps back each cycle` })
  }
  if (category === 'animated-props' && names.length === 0) {
    out.push({ rule: 'clips.required', message: 'animated prop has no clips' })
  }
  return out
}

function checkSockets(summary: GlbSummary, category: Category): Violation[] {
  const out: Violation[] = []
  const sockets = summary.nodeNames.filter((name) => name.startsWith('socket'))
  for (const name of sockets) {
    if (!/^socket-[a-z0-9-]+$/.test(name)) out.push({ rule: 'sockets.names', message: `socket node "${name}" must match socket-<name>` })
  }
  if (category === 'held-items' && sockets.length === 0) {
    out.push({ rule: 'sockets.required', message: 'held item has no socket-* node' })
  }
  return out
}

export function validateAsset(summary: GlbSummary, context: AssetContext): Violation[] {
  if (context.profile === 'pn-compat') {
    const skin = summary.skins[0]
    if (context.kind === 'model') {
      return summary.bounds && summary.bounds.min.every(Number.isFinite) ? [] : [{ rule: 'mesh.present', message: 'model has no finite bounds' }]
    }
    if (!skin) return [{ rule: 'rig.names', message: 'no skin' }]
    return context.kind === 'avatar-rig' ? checkRigExact(skin) : checkRigByName(skin)
  }

  const { category, pack } = context
  const out = [...checkMaterials(summary, category), ...checkScale(summary, category), ...checkScaleClassRule(summary, category), ...checkStyle(summary, pack, category), ...checkClips(summary, pack, category), ...checkSockets(summary, category)]
  if (summary.meshCount === 0) out.push({ rule: 'mesh.present', message: 'file has no mesh' })
  if (!summary.zfight) throw new Error('rvx validation needs the z-fighting check: inspectGlb(bytes, { zfight: true })')
  if (summary.zfight.area > ZFIGHT_TOLERANCE) {
    out.push({ rule: 'geometry.zfight', message: `${summary.zfight.area.toFixed(1)} voxel² of coplanar faces overlap and z-fight (worst: ${summary.zfight.worst})` })
  }

  const skin = summary.skins[0]
  if (category === 'avatar') {
    if (!skin) out.push({ rule: 'rig.names', message: 'avatar parts file has no skin' })
    else out.push(...checkRigExact(skin))
    // Parts that cover one another must not share a plane, or they z-fight on the avatar.
    if (!summary.layers) out.push({ rule: 'avatar.layers', message: 'avatar parts file has mesh nodes outside the `<slot> <pack>-<n>` convention' })
    else if (summary.layers.misfit > 0.01) out.push({ rule: 'avatar.layers', message: `${summary.layers.misfit.toFixed(1)} voxel² of part faces are off their slot's layer (worst: ${summary.layers.worst}); rebuild so finalize layers the parts` })
  } else if (category === 'characters-skins') {
    if (!skin) out.push({ rule: 'rig.names', message: 'skin has no skin' })
    else out.push(...checkRigByName(skin))
  } else if (summary.skins.length > 0) {
    out.push({ rule: 'rig.absent', message: `${category} must not carry an armature (PN rig data belongs in the characters leaf only)` })
  }
  return out
}
