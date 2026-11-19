import { AnimationMixer, Matrix4, Vector3, type AnimationClip, type Bone, type Object3D, type SkinnedMesh } from 'three'
import { z } from 'zod'
import { BUDGETS } from '../contracts/budgets'
import { CREATURE_MOTION, QUADRUPED_SILHOUETTE } from '../contracts/catalog'
import {
  MIN_GARMENT_LUMINANCE,
  PALETTE_REGIONS,
  paletteColorsSchema,
  relativeLuminance,
  resolvePaletteColors,
  type PaletteColors,
  type PaletteRegion,
} from '../contracts/palette'
import { loadGlbHeadless } from './animationAudit'
import { nodeTriangleCount, parseGlb, readAccessor } from './glbInspect'

/**
 * Checks of a built voxel creature. They read the GLB only: they do not use the sculpt that made it.
 * `scripts/validate.ts` runs them on the creature packs. `scripts/validate-creature.ts` runs them on a
 * creature that `blender/creature_kit.py` -> `CreatureSculptor` wrote on an external rig.
 */

export const creatureExtrasSchema = z.object({
  polyLattice: z.object({ voxelSize: z.number().positive(), maxPad: z.number().nonnegative() }),
  polyCreature: z
    .object({
      forward: z.enum(['+Z', '+X']),
      quadruped: z.boolean(),
      palette: paletteColorsSchema,
      rigScale: z.number().positive().optional(),
    })
    .optional(),
})
export type CreatureExtras = z.infer<typeof creatureExtrasSchema>

export interface Extent {
  min: [number, number, number]
  max: [number, number, number]
}

/** Largest distance of a coordinate from the half lattice of `voxelSize`, and the vertex that has it. */
export function maxLatticeOffset(positions: ArrayLike<number>, voxelSize: number): { offset: number; vertex: number } {
  const step = voxelSize / 2
  let offset = 0
  let vertex = -1
  for (let i = 0; i < positions.length; i++) {
    const value = positions[i]!
    const distance = Math.abs(value - Math.round(value / step) * step)
    if (distance > offset) {
      offset = distance
      vertex = Math.floor(i / 3)
    }
  }
  return { offset, vertex }
}

/** Largest deviation of a unit normal from a lattice axis. 0 is an axis-aligned normal. */
export function maxNormalAxisError(normals: ArrayLike<number>): number {
  let worst = 0
  for (let i = 0; i < normals.length; i += 3) {
    const x = Math.abs(normals[i]!)
    const y = Math.abs(normals[i + 1]!)
    const z = Math.abs(normals[i + 2]!)
    worst = Math.max(worst, Math.abs(Math.max(x, y, z) - 1), Math.abs(x + y + z - 1))
  }
  return worst
}

/** Index of the first vertex that is not rigid: a vertex has weight 1 on joint slot 0 and no other weight. */
export function firstNonRigidVertex(weights: readonly (readonly number[])[]): number {
  return weights.findIndex((row) => Math.abs((row[0] ?? 0) - 1) > 1e-4 || row.slice(1).some((w) => Math.abs(w) > 1e-4))
}

/** Palette regions that the mesh shows as a mottled surface (`TEXCOORD_1` is a voxel cell and the face is not emissive). */
export function mottledRegions(uvs: readonly (readonly number[])[], uv1s: readonly (readonly number[])[]): PaletteRegion[] {
  const found = new Set<PaletteRegion>()
  for (let i = 0; i < uvs.length; i++) {
    const [u = 0, v = 0] = uvs[i]!
    if ((uv1s[i]?.[0] ?? -999) < -100 || v >= 0.92) continue
    found.add(PALETTE_REGIONS[Math.min(PALETTE_REGIONS.length - 1, Math.max(0, Math.floor(u * PALETTE_REGIONS.length)))]!)
  }
  return PALETTE_REGIONS.filter((region) => found.has(region))
}

/** The mottled regions of a creature that are below the dark-albedo floor: their voxel facets are not visible. */
export function regionsBelowDarkFloor(palette: PaletteColors, regions: readonly PaletteRegion[]): PaletteRegion[] {
  const resolved = resolvePaletteColors(palette)
  return regions.filter((region) => relativeLuminance(resolved[region]) < MIN_GARMENT_LUMINANCE)
}

/** Scale and shear of the upper 3 x 3 of a transform: 0 for a rotation, 0.1 for a 10% stretch. */
export function stretchOf(matrix: Matrix4): number {
  const e = matrix.elements
  const columns = [0, 4, 8].map((o) => [e[o]!, e[o + 1]!, e[o + 2]!] as const)
  const lengths = columns.map((c) => Math.hypot(c[0], c[1], c[2]))
  let worst = 0
  for (let i = 0; i < 3; i++) {
    worst = Math.max(worst, Math.abs(lengths[i]! - 1))
    const a = columns[i]!
    const b = columns[(i + 1) % 3]!
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    worst = Math.max(worst, Math.abs(dot) / Math.max(lengths[i]! * lengths[(i + 1) % 3]!, 1e-12))
  }
  return worst
}

const width = (extent: Extent, axis: 0 | 1 | 2, voxel: number): number => Math.round((extent.max[axis] - extent.min[axis]) / voxel)

/**
 * Teardown silhouette of a quadruped on the 23-joint contract rig, measured on the bounds of the vertices of
 * each joint (rest pose, +Z forward). The rules are `QUADRUPED_SILHOUETTE`.
 */
export function quadrupedSilhouetteProblems(extents: ReadonlyMap<string, Extent>, voxel: number): string[] {
  const rules = QUADRUPED_SILHOUETTE
  const problems: string[] = []
  const get = (joint: string): Extent => {
    const extent = extents.get(joint)
    if (!extent) throw new Error(`The quadruped has no voxel segment on joint "${joint}".`)
    return extent
  }
  const chest = width(get('chest'), 0, voxel)
  const waist = Math.min(...['pelvis', 'spine_01', 'spine_02'].map((joint) => width(get(joint), 0, voxel)))
  if (waist > rules.maxWaistToChestWidth * chest + 1e-9) {
    problems.push(`The trunk is ${waist} to ${chest} voxels wide (waist / chest > ${rules.maxWaistToChestWidth}). It reads as a box: step the waist in.`)
  }
  const head = width(get('head'), 0, voxel)
  if (head < rules.faceToChestWidth[0] * chest - 1e-9 || head > rules.maxHeadToChestWidth * chest + 1e-9) {
    problems.push(`The head is ${head} voxels wide and the chest is ${chest} voxels wide. The range is ${rules.faceToChestWidth[0]} to ${rules.maxHeadToChestWidth} of the chest.`)
  }
  const chestSide = Math.max(Math.abs(get('chest').min[0]), Math.abs(get('chest').max[0]))
  for (const leg of ['fl', 'fr', 'bl', 'br']) {
    const upper = get(`leg_${leg}_upper`)
    const lower = get(`leg_${leg}_lower`)
    const paw = get(`leg_${leg}_paw`)
    const section = [width(lower, 0, voxel), width(lower, 2, voxel)]
    if (section[0] !== rules.lowerLegSectionVoxels || section[1] !== rules.lowerLegSectionVoxels) {
      problems.push(`Lower leg ${leg} is ${section[0]} x ${section[1]} voxels. A lower leg is ${rules.lowerLegSectionVoxels} x ${rules.lowerLegSectionVoxels}.`)
    }
    const toe = Math.round((paw.max[2] - lower.max[2]) / voxel)
    if (toe < rules.pawToeStepVoxels[0] || toe > rules.pawToeStepVoxels[1]) {
      problems.push(`Paw ${leg} ends ${toe} voxels in front of the lower leg. The toe step is ${rules.pawToeStepVoxels[0]} to ${rules.pawToeStepVoxels[1]} voxels.`)
    }
    if (Math.round(paw.min[1] / voxel) !== 0 || width(paw, 1, voxel) !== 2) {
      problems.push(`Paw ${leg} is on y = ${paw.min[1].toFixed(3)} .. ${paw.max[1].toFixed(3)}. A paw is two rows on y = 0.`)
    }
    const side = Math.max(...[upper, lower, paw].flatMap((extent) => [Math.abs(extent.min[0]), Math.abs(extent.max[0])]))
    const proud = Math.round((side - chestSide) / voxel)
    if (proud > rules.maxLimbProudVoxels) {
      problems.push(`Leg ${leg} goes ${proud} voxels out of the chest side. The limit is ${rules.maxLimbProudVoxels}.`)
    }
  }
  return problems
}

export interface ClipMotion {
  clip: string
  /** Largest scale or shear of a bone that owns voxels, and the bone. */
  stretch: number
  stretchBone: string
  /** Largest gap (voxels) between a segment and the segment that holds it, and the two joints. */
  gap: number
  gapPair: string
}

export interface CreatureAuditReport {
  name: string
  triangles: number
  voxelSize: number
  segments: number
  clips: ClipMotion[]
  problems: string[]
}

/** A segment that does not touch the segment that holds it in the rest pose. `gap` is in voxels. */
export interface RestGap {
  bone: string
  holder: string
  gap: number
}

function samplesFor(clip: AnimationClip, hz: number): number {
  return Math.min(48, Math.max(4, Math.ceil(clip.duration * hz)))
}

interface Segment {
  bone: Bone
  restInverse: Matrix4
  /** Rest-pose world positions of the vertices of the segment. */
  points: Vector3[]
  box: Extent
  /** Motion of the segment from the rest pose in the current frame. */
  delta: Matrix4
  deltaInverse: Matrix4
}

function distanceToBox(point: Vector3, box: Extent): number {
  const dx = Math.max(box.min[0] - point.x, 0, point.x - box.max[0])
  const dy = Math.max(box.min[1] - point.y, 0, point.y - box.max[1])
  const dz = Math.max(box.min[2] - point.z, 0, point.z - box.max[2])
  return Math.hypot(dx, dy, dz)
}

/** Smallest distance from a vertex of `from` (moved by `transform`) to the rest bounds of `to`. */
function gapTo(from: Segment, to: Segment, transform: Matrix4 | null, scratch: Vector3): number {
  let best = Infinity
  for (const point of from.points) {
    scratch.copy(point)
    if (transform) scratch.applyMatrix4(transform)
    best = Math.min(best, distanceToBox(scratch, to.box))
    if (best === 0) break
  }
  return best
}

/**
 * Scale and shear of the bones that own voxels, and the gap between each segment and the segment that holds it,
 * for each clip. The gap is measured between the vertices of one segment and the bounds of the other segment.
 */
export function auditClipMotion(
  root: Object3D,
  mesh: SkinnedMesh,
  clips: readonly AnimationClip[],
  voxel: number,
  hz = 12,
): { clips: ClipMotion[]; restGaps: RestGap[] } {
  root.updateMatrixWorld(true)
  mesh.skeleton.update()
  const bones = mesh.skeleton.bones
  const position = mesh.geometry.getAttribute('position')
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const byBone = new Map<Bone, Segment>()
  for (let i = 0; i < position.count; i++) {
    const bone = bones[skinIndex.getX(i)]!
    let segment = byBone.get(bone)
    if (!segment) {
      segment = {
        bone,
        restInverse: bone.matrixWorld.clone().invert(),
        points: [],
        box: { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
        delta: new Matrix4(),
        deltaInverse: new Matrix4(),
      }
      byBone.set(bone, segment)
    }
    const point = mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(position, i)).applyMatrix4(mesh.matrixWorld)
    segment.points.push(point)
    for (const axis of [0, 1, 2] as const) {
      const value = point.getComponent(axis)
      if (value < segment.box.min[axis]) segment.box.min[axis] = value
      if (value > segment.box.max[axis]) segment.box.max[axis] = value
    }
  }
  const segments = [...byBone.values()]
  const scratch = new Vector3()
  // A segment must stay on the segment that holds it: the segment of its nearest parent joint that owns voxels.
  // A segment with no such parent (the trunk root, an IK foot) must stay on each segment that it touches at rest
  // and that is not below it in the skeleton.
  const held: [Segment, Segment][] = []
  const paired = new Set<string>()
  const pair = (a: Segment, b: Segment): void => {
    const key = [segments.indexOf(a), segments.indexOf(b)].sort((x, y) => x - y).join(':')
    if (a === b || paired.has(key)) return
    paired.add(key)
    held.push([a, b])
  }
  const isBelow = (bone: Bone, ancestor: Bone): boolean => {
    for (let parent = bone.parent; parent; parent = parent.parent) if (parent === ancestor) return true
    return false
  }
  const restGaps: RestGap[] = []
  for (const segment of segments) {
    let parent = segment.bone.parent
    while (parent && !byBone.has(parent as Bone)) parent = parent.parent
    if (parent) {
      const holder = byBone.get(parent as Bone)!
      pair(segment, holder)
      const gap = Math.min(gapTo(segment, holder, null, scratch), gapTo(holder, segment, null, scratch)) / voxel
      if (gap > 0.05) restGaps.push({ bone: segment.bone.name, holder: holder.bone.name, gap })
      continue
    }
    for (const other of segments) {
      if (other === segment || isBelow(other.bone, segment.bone)) continue
      if (Math.min(gapTo(segment, other, null, scratch), gapTo(other, segment, null, scratch)) <= 0.05 * voxel) pair(segment, other)
    }
  }
  const mixer = new AnimationMixer(root)
  const relative = new Matrix4()
  const reports: ClipMotion[] = []
  for (const clip of clips) {
    const report: ClipMotion = { clip: clip.name, stretch: 0, stretchBone: '', gap: 0, gapPair: '' }
    const action = mixer.clipAction(clip)
    action.play()
    const steps = samplesFor(clip, hz)
    for (let step = 0; step < steps; step++) {
      mixer.setTime((clip.duration * step) / steps)
      root.updateMatrixWorld(true)
      for (const segment of segments) {
        segment.delta.multiplyMatrices(segment.bone.matrixWorld, segment.restInverse)
        segment.deltaInverse.copy(segment.delta).invert()
        const stretch = stretchOf(segment.delta)
        if (stretch > report.stretch) {
          report.stretch = stretch
          report.stretchBone = segment.bone.name
        }
      }
      for (const [a, b] of held) {
        // Move the vertices of one segment into the rest frame of the other segment.
        const aToB = gapTo(a, b, relative.multiplyMatrices(b.deltaInverse, a.delta), scratch)
        const bToA = aToB === 0 ? 0 : gapTo(b, a, relative.multiplyMatrices(a.deltaInverse, b.delta), scratch)
        const gap = Math.min(aToB, bToA) / voxel
        if (gap > report.gap) {
          report.gap = gap
          report.gapPair = `${a.bone.name} / ${b.bone.name}`
        }
      }
    }
    action.stop()
    mixer.uncacheAction(clip)
    reports.push(report)
  }
  root.updateMatrixWorld(true)
  return { clips: reports, restGaps }
}

/** Rest-pose world positions and normals of a skinned mesh, and the bounds of the vertices of each joint. */
export function restPose(root: Object3D, mesh: SkinnedMesh): { positions: Float64Array; normals: Float64Array; extents: Map<string, Extent> } {
  root.updateMatrixWorld(true)
  mesh.skeleton.update()
  const position = mesh.geometry.getAttribute('position')
  const normal = mesh.geometry.getAttribute('normal')
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const positions = new Float64Array(position.count * 3)
  const normals = new Float64Array(position.count * 3)
  const extents = new Map<string, Extent>()
  const p = new Vector3()
  const tip = new Vector3()
  for (let i = 0; i < position.count; i++) {
    // A normal is a direction: skin the vertex and a point one unit along the normal, then take the difference.
    tip.fromBufferAttribute(position, i).add(p.fromBufferAttribute(normal, i))
    mesh.applyBoneTransform(i, tip).applyMatrix4(mesh.matrixWorld)
    mesh.applyBoneTransform(i, p.fromBufferAttribute(position, i)).applyMatrix4(mesh.matrixWorld)
    tip.sub(p).normalize()
    positions.set([p.x, p.y, p.z], i * 3)
    normals.set([tip.x, tip.y, tip.z], i * 3)
    const joint = mesh.skeleton.bones[skinIndex.getX(i)]!.name
    let extent = extents.get(joint)
    if (!extent) {
      extent = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
      extents.set(joint, extent)
    }
    for (const axis of [0, 1, 2] as const) {
      const value = positions[i * 3 + axis]!
      if (value < extent.min[axis]) extent.min[axis] = value
      if (value > extent.max[axis]) extent.max[axis] = value
    }
  }
  return { positions, normals, extents }
}

export interface CreatureAuditOptions {
  /** Node name of the skinned voxel mesh. The default is the one skinned mesh of the file. */
  nodeName?: string
  /** Palette for the dark-albedo floor. The default is `polyCreature.palette` of the mesh node. */
  palette?: PaletteColors
  /** True for a quadruped on the 23-joint contract rig: the joint names give the silhouette checks. */
  contractQuadruped?: boolean
}

/** All artifact checks of one voxel creature GLB. The report lists each problem: it does not stop on the first. */
export async function auditCreatureGlb(path: string, options: CreatureAuditOptions = {}): Promise<CreatureAuditReport> {
  const glb = parseGlb(path)
  const problems: string[] = []
  const skinned = (glb.doc.nodes ?? []).filter((n) => n.mesh !== undefined && n.skin !== undefined)
  const node = options.nodeName ? skinned.find((n) => n.name === options.nodeName) : skinned[0]
  if (!node || node.mesh === undefined) throw new Error(`${path}: no skinned mesh node${options.nodeName ? ` "${options.nodeName}"` : ''}.`)
  if (!options.nodeName && skinned.length !== 1) problems.push(`The file has ${skinned.length} skinned meshes. A creature is one mesh.`)
  if ((glb.doc.skins ?? []).length !== 1) problems.push(`The file has ${(glb.doc.skins ?? []).length} skins. A creature has one skin.`)
  if ((glb.doc.materials ?? []).length > 1) problems.push(`The file has ${glb.doc.materials!.length} materials. A creature has one material.`)
  const primitives = glb.doc.meshes?.[node.mesh]?.primitives ?? []
  if (primitives.length !== 1) throw new Error(`${path}: mesh "${node.name}" has ${primitives.length} primitives. A creature is one draw call.`)
  const attributes = primitives[0]!.attributes
  for (const name of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1', 'JOINTS_0', 'WEIGHTS_0']) {
    if (attributes[name] === undefined) throw new Error(`${path}: mesh "${node.name}" has no ${name}.`)
  }
  const extras = creatureExtrasSchema.safeParse(node.extras ?? {})
  if (!extras.success) {
    throw new Error(`${path}: mesh "${node.name}" has no polyLattice extras. Build the creature with blender/creature_kit.py.`)
  }
  const { voxelSize, maxPad } = extras.data.polyLattice
  const triangles = nodeTriangleCount(glb, node)
  if (triangles > BUDGETS.classes.body.maxTriangles) {
    problems.push(`${triangles} triangles exceed the body budget (${BUDGETS.classes.body.maxTriangles}).`)
  }
  const nonRigid = firstNonRigidVertex(readAccessor(glb, attributes.WEIGHTS_0!))
  if (nonRigid >= 0) problems.push(`Vertex ${nonRigid} has a blended weight. Each voxel segment has weight 1 on one joint.`)

  const palette = options.palette ?? extras.data.polyCreature?.palette
  if (palette) {
    const mottled = mottledRegions(readAccessor(glb, attributes.TEXCOORD_0!), readAccessor(glb, attributes.TEXCOORD_1!))
    const crushed = regionsBelowDarkFloor(palette, mottled)
    if (crushed.length > 0) {
      problems.push(`Mottled palette regions ${crushed.join(', ')} are below the dark-albedo floor (relative luminance ${MIN_GARMENT_LUMINANCE}). Their voxel facets are not visible.`)
    }
  } else if (extras.data.polyCreature) {
    problems.push('The mesh has no palette in polyCreature. The dark-albedo floor is not checked.')
  }

  const gltf = await loadGlbHeadless(path)
  const mesh = gltf.scene.getObjectByName(node.name ?? '') as SkinnedMesh | undefined
  if (!mesh?.isSkinnedMesh) throw new Error(`${path}: node "${node.name}" is not a SkinnedMesh.`)
  const rest = restPose(gltf.scene, mesh)
  const tolerance = maxPad + 0.004 * voxelSize
  const lattice = maxLatticeOffset(rest.positions, voxelSize)
  if (lattice.offset > tolerance) {
    const at = [0, 1, 2].map((axis) => (rest.positions[lattice.vertex * 3 + axis]! / voxelSize).toFixed(2)).join(', ')
    problems.push(`Vertex ${lattice.vertex} (cell position ${at}) is ${(lattice.offset / voxelSize).toFixed(3)} voxels off the lattice. All segments use one world lattice (creature_kit.lattice_anchor).`)
  }
  const normalError = maxNormalAxisError(rest.normals)
  if (normalError > 0.02) problems.push(`A rest-pose normal is ${normalError.toFixed(3)} off a lattice axis. Voxel faces are axis-aligned.`)
  let minY = Infinity
  for (let i = 1; i < rest.positions.length; i += 3) minY = Math.min(minY, rest.positions[i]!)
  if (Math.abs(minY) > tolerance) problems.push(`The lowest vertex is on y = ${(minY / voxelSize).toFixed(2)} voxels. The paws stand on y = 0.`)
  if (options.contractQuadruped) problems.push(...quadrupedSilhouetteProblems(rest.extents, voxelSize))

  const { clips, restGaps } = auditClipMotion(gltf.scene, mesh, gltf.animations, voxelSize)
  for (const rest of restGaps) {
    problems.push(`Segment "${rest.bone}" is ${rest.gap.toFixed(2)} voxels from the segment of its parent "${rest.holder}" in the rest pose. A segment touches the segment that holds it.`)
  }
  const worst = (key: 'stretch' | 'gap'): ClipMotion | undefined => [...clips].sort((a, b) => b[key] - a[key])[0]
  const stretched = clips.filter((c) => c.stretch > CREATURE_MOTION.maxBoneStretch)
  if (stretched.length > 0) {
    const top = worst('stretch')!
    problems.push(`${stretched.length} clip(s) scale or shear a bone that owns voxels (worst: "${top.clip}" changes "${top.stretchBone}" by ${(top.stretch * 100).toFixed(0)}%). The voxels are then not cubes. Remove the scale channels (CreatureSculptor does this) or move the voxels to another bone.`)
  }
  const torn = clips.filter((c) => c.gap > CREATURE_MOTION.maxSegmentGapVoxels)
  if (torn.length > 0) {
    const top = worst('gap')!
    const names = torn.sort((a, b) => b.gap - a.gap).slice(0, 6).map((c) => `${c.clip} ${c.gap.toFixed(1)} (${c.gapPair})`).join(', ')
    problems.push(`${torn.length} clip(s) open a gap between a segment and the segment that holds it (limit ${CREATURE_MOTION.maxSegmentGapVoxels} voxels; worst: "${top.clip}" opens ${top.gap.toFixed(2)} voxels between ${top.gapPair}). Largest: ${names}. Give each animated joint between the two segments a segment that reaches the joint of its child.`)
  }
  return { name: node.name ?? path, triangles, voxelSize, segments: rest.extents.size, clips, problems }
}
