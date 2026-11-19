import { useFrame, type GroupProps } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AnimationMixer,
  Box3,
  BufferGeometry,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  SkinnedMesh,
  Sphere,
  Vector3,
  type AnimationAction,
  type MeshStandardMaterial,
} from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { AvatarPartEntry, HeldItemEntry, WorldPropEntry } from '@poly/contracts/catalog'
import type { PaletteColors } from '@poly/contracts/palette'
import { armThicknessFactorFor, isArmShieldHeldItem } from '@poly/contracts/proportions'
import { UAL1_RIG } from '@poly/contracts/rig'
import type { AssetRef } from '../assetSource'
import { useAssetUrls } from '../useAssetUrl'
import { assetRefFor, resolveVisibleParts, type PolyAvatarSelection, type PolyPartIndex } from './composePolyAvatar'
import { createPolyMaterial, getSharedBlobShadowResources, updatePolyMaterialPalette } from './polyMaterial'
import {
  acquireMergedGeometry,
  createRigInstance,
  findSkinnedPart,
  findStaticMesh,
  getCoreRig,
  mergeParts,
  readGltf,
  releaseMergedGeometry,
} from './polyRig'
import { applyProportionsToSkeleton, computeHeldSocketPosition, scaleAnimatedPelvis, unscaleAnimatedPelvis } from './proportionRig'

export interface PolyAvatarStats {
  /** Triangles that the avatar draws (covered body regions are not drawn). */
  triangles: number
  /** One skinned draw plus one draw for each held item. */
  drawCalls: number
  activeBones: number
}

/** Mutable level of detail. A scene can change it each frame without a React render. */
export interface PolyAvatarLod {
  /** Mixer steps for each second. 0 steps the mixer on every frame. */
  mixerHz: number
}

/** Mutable counter. The avatar adds the time of each mixer step. */
export interface PolyPerfSink {
  mixerMs: number
}

type Placement = Pick<GroupProps, 'position' | 'rotation' | 'scale'>

export interface PolyAvatarProps extends Placement {
  selection: PolyAvatarSelection
  index: PolyPartIndex
  blobShadow?: boolean
  castShadow?: boolean
  onStats?: (stats: PolyAvatarStats) => void
  /** Shared material for crowds. The avatar then ignores `selection.palette`. */
  material?: MeshStandardMaterial
  lod?: PolyAvatarLod
  perfSink?: PolyPerfSink
  /** Start time in the clip, in seconds. It stops a crowd from moving in step. */
  timeOffset?: number
  /** Hold the clip at this part of its duration (0 to 1). `null` or no value plays the clip. */
  holdPhase?: number | null
}

const IDENTITY = new Matrix4()
const EMPTY_GEOMETRY = new BufferGeometry()
const CROSS_FADE_SECONDS = 0.2
const BLOB_Y = 0.012

const fileKey = (ref: AssetRef) => `${ref.leafId}/${ref.path}`

interface AvatarPlan {
  rigId: PolyAvatarSelection['rigId']
  rigRef: AssetRef
  parts: AvatarPartEntry[]
  extraCovered: string[]
  held: { entry: HeldItemEntry; hand: 'hand_r' | 'hand_l' }[]
  /** Unique GLB files. The selected rig is first. */
  files: AssetRef[]
  geometryKey: string
  heldKey: string
}

function planAvatar(selection: PolyAvatarSelection, index: PolyPartIndex): AvatarPlan {
  const rigId = selection.rigId ?? 'ual1'
  const rigRef = index.rigRefFor(rigId)
  const { parts, extraCovered } = resolveVisibleParts(selection, index)
  const held: AvatarPlan['held'] = []
  if (rigId === 'ual1') {
    if (selection.heldRight) held.push({ entry: index.getHeld(selection.heldRight), hand: 'hand_r' })
    if (selection.heldLeft) held.push({ entry: index.getHeld(selection.heldLeft), hand: 'hand_l' })
  }
  const files = new Map<string, AssetRef>([[fileKey(rigRef), rigRef]])
  for (const item of [...parts, ...held.map((slot) => slot.entry)]) {
    const ref = assetRefFor(item.pack, item.leaf, item.relativePath)
    files.set(fileKey(ref), ref)
  }
  const buildQuant = Math.round((selection.proportions.build ?? 0) * 20) / 20
  const jawQuant = Math.round((selection.proportions.faceJaw ?? 0) * 20) / 20
  const noseQuant = Math.round((selection.proportions.faceNose ?? 0) * 20) / 20
  const browQuant = Math.round((selection.proportions.faceBrow ?? 0) * 20) / 20
  const smileQuant = Math.round((selection.proportions.faceSmile ?? 0) * 20) / 20
  const blinkQuant = Math.round((selection.proportions.faceBlink ?? 0) * 20) / 20
  const faceTag =
    jawQuant || noseQuant || browQuant || smileQuant || blinkQuant
      ? `|f:${jawQuant.toFixed(2)},${noseQuant.toFixed(2)},${browQuant.toFixed(2)},${smileQuant.toFixed(2)},${blinkQuant.toFixed(2)}`
      : ''
  const coverTag = extraCovered.length > 0 ? `|${extraCovered.join(',')}` : ''
  return {
    rigId,
    rigRef,
    parts,
    extraCovered,
    held,
    files: [...files.values()],
    geometryKey: `${rigId}:${selection.body}:${selection.head ?? 'none'}@${buildQuant.toFixed(2)}>${parts.map((part) => part.id).join('+')}${coverTag}${faceTag}`,
    heldKey: held.map((slot) => `${slot.hand}:${slot.entry.id}`).join('+'),
  }
}

/** Every GLB of the catalogs. The list is stable, so a slot change never resets the URLs. */
function catalogFiles(index: PolyPartIndex): AssetRef[] {
  const files = new Map<string, AssetRef>()
  for (const ref of index.rigRefs.values()) {
    files.set(fileKey(ref), ref)
  }
  for (const item of [...index.partsById.values(), ...index.heldById.values()]) {
    const ref = assetRefFor(item.pack, item.leaf, item.relativePath)
    files.set(fileKey(ref), ref)
  }
  return [...files.values()]
}

function loadFiles(files: readonly AssetRef[], urlOf: ReadonlyMap<string, string>): ReadonlyMap<string, GLTF> {
  const pending: unknown[] = []
  const loaded = new Map<string, GLTF>()
  for (const ref of files) {
    const url = urlOf.get(fileKey(ref))
    if (!url) throw new Error(`No URL for "${fileKey(ref)}".`)
    try {
      loaded.set(fileKey(ref), readGltf(url))
    } catch (thrown) {
      // Start all downloads before the component suspends.
      if (!(thrown instanceof Promise)) throw thrown
      pending.push(thrown)
    }
  }
  if (pending.length > 0) throw Promise.all(pending)
  return loaded
}

function gltfFor(loaded: ReadonlyMap<string, GLTF>, item: { pack: AvatarPartEntry['pack']; leaf: AvatarPartEntry['leaf']; relativePath: string }): GLTF {
  const key = fileKey(assetRefFor(item.pack, item.leaf, item.relativePath))
  const gltf = loaded.get(key)
  if (!gltf) throw new Error(`The file "${key}" is not loaded.`)
  return gltf
}

/**
 * One composed avatar: a clone of its skeleton (UAL1 / quadruped / arachnid), one merged skinned mesh,
 * held items on the hand sockets (for UAL1) and one clip. Parts, clips and merged geometry are shared.
 */
export function PolyAvatar(props: PolyAvatarProps) {
  const { selection, index } = props
  const buildQuant = Math.round((selection.proportions.build ?? 0) * 20) / 20
  const jawQuant = Math.round((selection.proportions.faceJaw ?? 0) * 20) / 20
  const noseQuant = Math.round((selection.proportions.faceNose ?? 0) * 20) / 20
  const browQuant = Math.round((selection.proportions.faceBrow ?? 0) * 20) / 20
  const smileQuant = Math.round((selection.proportions.faceSmile ?? 0) * 20) / 20
  const blinkQuant = Math.round((selection.proportions.faceBlink ?? 0) * 20) / 20
  const plan = useMemo(
    () => planAvatar(selection, index),
    // The plan depends on rig, slot ids, continuous body build morph, and face morphs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      index,
      selection.rigId,
      selection.body,
      buildQuant,
      jawQuant,
      noseQuant,
      browQuant,
      smileQuant,
      blinkQuant,
      selection.head,
      selection.hair,
      selection.torso,
      selection.legs,
      selection.headwear,
      selection.back,
      selection.heldRight,
      selection.heldLeft,
    ],
  )
  const files = useMemo(() => catalogFiles(index), [index])
  const urls = useAssetUrls(files)
  const urlOf = useMemo(() => (urls ? new Map(files.map((ref, i) => [fileKey(ref), urls[i]!])) : null), [files, urls])
  if (!urlOf || urlOf.size !== files.length) return null
  return <LoadedAvatar {...props} plan={plan} urlOf={urlOf} />
}

function LoadedAvatar({
  selection,
  plan,
  urlOf,
  blobShadow = false,
  castShadow = false,
  onStats,
  material: sharedMaterial,
  lod,
  perfSink,
  timeOffset = 0,
  holdPhase = null,
  position,
  rotation,
  scale,
}: PolyAvatarProps & { plan: AvatarPlan; urlOf: ReadonlyMap<string, string> }) {
  const loaded = loadFiles(plan.files, urlOf)
  const core = getCoreRig(loaded.get(fileKey(plan.rigRef))!, plan.rigId)
  const rig = useMemo(() => createRigInstance(core, plan.rigId), [core, plan.rigId])

  // Material: own palette material, or the shared one of a crowd.
  const ownMaterial = useMemo(() => (sharedMaterial ? null : createPolyMaterial(selection.palette)), [sharedMaterial]) // eslint-disable-line react-hooks/exhaustive-deps
  const material = sharedMaterial ?? ownMaterial!
  const { skin, hair, primary, secondary, accent, metal, eye } = selection.palette
  useEffect(() => {
    if (ownMaterial) updatePolyMaterialPalette(ownMaterial, { skin, hair, primary, secondary, accent, metal, eye })
  }, [ownMaterial, skin, hair, primary, secondary, accent, metal, eye])
  useEffect(() => () => ownMaterial?.dispose(), [ownMaterial])

  // One skinned mesh for all parts. It is a child of the rig root, so the proportion rig finds it.
  const skin_ = useMemo(() => {
    const mesh = new SkinnedMesh(EMPTY_GEOMETRY, material)
    mesh.name = 'PolyAvatarSkin'
    mesh.bind(rig.skeleton, IDENTITY)
    // Frustum culling reads SkinnedMesh.boundingSphere directly; keep an explicit generous sphere rather than caching frame-1 rest bounds.
    mesh.boundingSphere = new Sphere(new Vector3(0, 1.2, 0), 3.2)
    rig.root.add(mesh)
    return mesh
  }, [rig]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    skin_.material = material
    skin_.castShadow = castShadow
  }, [skin_, material, castShadow])
  useEffect(() => () => rig.skeleton.dispose(), [rig])

  const {
    height,
    legRatio = 1,
    build = 0,
    shoulderWidth,
    torsoBulk,
    waistScale,
    headScale,
    limbThickness,
    armLength = 1,
    bodyLength = 1,
    neckScale = 1,
    handScale = 1,
    footScale = 1,
    faceJaw = 0,
    faceNose = 0,
    faceBrow = 0,
    faceSmile = 0,
    faceBlink = 0,
  } = selection.proportions
  const buildQuant = Math.round(build * 20) / 20
  const jawQuant = Math.round(faceJaw * 20) / 20
  const noseQuant = Math.round(faceNose * 20) / 20
  const browQuant = Math.round(faceBrow * 20) / 20
  const smileQuant = Math.round(faceSmile * 20) / 20
  const blinkQuant = Math.round(faceBlink * 20) / 20

  useLayoutEffect(() => {
    const geometry = acquireMergedGeometry(plan.geometryKey, () =>
      mergeParts(
        plan.parts.map((part) => findSkinnedPart(gltfFor(loaded, part), part.nodeName, plan.rigId)),
        selection.body,
        buildQuant,
        selection.head,
        plan.extraCovered,
        {
          faceJaw: jawQuant,
          faceNose: noseQuant,
          faceBrow: browQuant,
          faceSmile: smileQuant,
          faceBlink: blinkQuant,
        },
      ),
    )
    skin_.geometry = geometry
    return () => {
      skin_.geometry = EMPTY_GEOMETRY
      releaseMergedGeometry(plan.geometryKey)
    }
  }, [skin_, plan.geometryKey, plan.rigId]) // eslint-disable-line react-hooks/exhaustive-deps

  const proportionsRef = useRef(selection.proportions)
  proportionsRef.current = {
    height,
    legRatio,
    build: buildQuant,
    shoulderWidth,
    torsoBulk,
    waistScale,
    headScale,
    limbThickness,
    armLength,
    bodyLength,
    neckScale,
    handScale,
    footScale,
  }
  const pelvisScaleRef = useRef(new Vector3(1, 1, 1))
  useLayoutEffect(() => {
    pelvisScaleRef.current.set(1, 1, 1)
  }, [rig])

  useLayoutEffect(() => {
    unscaleAnimatedPelvis(rig.pelvis, rig.restPelvis, pelvisScaleRef.current)
    applyProportionsToSkeleton(rig.root, proportionsRef.current, plan.rigId)
    scaleAnimatedPelvis(rig.pelvis, rig.restPelvis, proportionsRef.current, plan.rigId, pelvisScaleRef.current)
    const reach = Math.max(1, height, armLength, bodyLength)
    skin_.boundingSphere ??= new Sphere()
    skin_.boundingSphere.center.set(0, 1.2 * Math.max(1, height), 0)
    skin_.boundingSphere.radius = 2.8 * reach
  }, [rig, skin_, plan.rigId, height, legRatio, buildQuant, shoulderWidth, torsoBulk, waistScale, headScale, limbThickness, armLength, bodyLength, neckScale, handScale, footScale])

  // Held items: rigid meshes on the hand sockets of the rig contract (rule M3).
  useLayoutEffect(() => {
    const armFactor = armThicknessFactorFor(selection.body, buildQuant)
    const lowerMass = armFactor * (1 + 0.8 * (limbThickness - 1))
    const added: Mesh[] = []
    for (const { entry, hand } of plan.held) {
      const bone = hand === 'hand_r' ? rig.handR : rig.handL
      if (!bone) continue
      const socket = UAL1_RIG.heldSockets[hand]
      const mesh = new Mesh(findStaticMesh(gltfFor(loaded, entry), entry.nodeName).geometry, material)
      mesh.name = entry.id
      computeHeldSocketPosition(socket.palmOffset, armFactor, limbThickness, mesh.position, handScale)
      mesh.rotation.set(socket.rotationEuler[0], socket.rotationEuler[1], socket.rotationEuler[2], 'XYZ')
      if (isArmShieldHeldItem(entry.id)) {
        mesh.translateX(Math.max(0, lowerMass - 1) * 0.085)
      }
      mesh.castShadow = castShadow
      bone.add(mesh)
      added.push(mesh)
    }
    return () => added.forEach((mesh) => mesh.removeFromParent())
  }, [rig, material, castShadow, plan.heldKey, selection.body, buildQuant, limbThickness, handScale]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animation: shared clips, one mixer for each avatar.
  const mixer = useMemo(() => new AnimationMixer(rig.root), [rig])
  const action = useRef<AnimationAction | null>(null)
  useEffect(() => {
    const clip = core.clips.get(selection.clip) ?? core.clips.values().next().value
    if (!clip) throw new Error(`The ${plan.rigId} rig has no clip "${selection.clip}".`)
    const next = mixer.clipAction(clip)
    const previous = action.current
    if (previous === next) return
    next.reset()
    if (clip.name === 'Death' || clip.name.startsWith('Death')) {
      next.setLoop(LoopOnce, 1)
      next.clampWhenFinished = true
      if (clip.duration > 0) next.time = Math.min(clip.duration, timeOffset % clip.duration)
    } else {
      next.setLoop(LoopRepeat, Infinity)
      next.clampWhenFinished = false
      if (clip.duration > 0) next.time = timeOffset % clip.duration
    }
    next.play()
    if (previous) next.crossFadeFrom(previous, CROSS_FADE_SECONDS, false)
    action.current = next
  }, [mixer, core, plan.rigId, selection.clip, timeOffset])
  useEffect(
    () => () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(rig.root)
      action.current = null
    },
    [mixer, rig],
  )

  const pending = useRef(0)
  useFrame((_, delta) => {
    const current = action.current
    if (holdPhase !== null) {
      // A paused action keeps its time. The mixer still advances, so a cross-fade to this clip completes.
      if (current) {
        current.paused = true
        current.time = holdPhase * current.getClip().duration
      }
      unscaleAnimatedPelvis(rig.pelvis, rig.restPelvis, pelvisScaleRef.current)
      mixer.update(delta)
      scaleAnimatedPelvis(rig.pelvis, rig.restPelvis, proportionsRef.current, plan.rigId, pelvisScaleRef.current)
      pending.current = 0
      return
    }
    if (current?.paused) current.paused = false
    pending.current += delta
    const hz = lod ? lod.mixerHz : 0
    if (hz > 0 && pending.current < 1 / hz) return
    unscaleAnimatedPelvis(rig.pelvis, rig.restPelvis, pelvisScaleRef.current)
    if (perfSink) {
      const start = performance.now()
      mixer.update(pending.current)
      scaleAnimatedPelvis(rig.pelvis, rig.restPelvis, proportionsRef.current, plan.rigId, pelvisScaleRef.current)
      perfSink.mixerMs += performance.now() - start
    } else {
      mixer.update(pending.current)
      scaleAnimatedPelvis(rig.pelvis, rig.restPelvis, proportionsRef.current, plan.rigId, pelvisScaleRef.current)
    }
    pending.current = 0
  })

  useEffect(() => {
    if (!onStats) return
    const skinned = (skin_.geometry.getIndex()?.count ?? 0) / 3
    const heldTriangles = plan.held.reduce((sum, slot) => sum + slot.entry.triangles, 0)
    onStats({ triangles: skinned + heldTriangles, drawCalls: 1 + plan.held.length, activeBones: rig.bones.length })
  }, [onStats, skin_, rig, plan])

  const blob = blobShadow ? getSharedBlobShadowResources() : null
  const footprint =
    plan.rigId === 'arachnid'
      ? 1.75 * height * (0.4 + 0.6 * legRatio)
      : plan.rigId === 'quadruped'
        ? 1.45 * height * (0.45 + 0.3 * torsoBulk + 0.25 * bodyLength)
        : 1.25 * (0.5 + 0.5 * shoulderWidth) * (1 + 0.1 * buildQuant)
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={rig.root} />
      {blob && (
        <mesh geometry={blob.geometry} material={blob.material} position={[0, BLOB_Y, 0]} scale={[footprint, 1, footprint]} />
      )}
    </group>
  )
}

type PolyPropLook =
  | { palette: PaletteColors; material?: undefined }
  | { material: MeshStandardMaterial; palette?: undefined }

export type PolyPropProps = Placement &
  PolyPropLook & {
    item: WorldPropEntry | HeldItemEntry
    blobShadow?: boolean
    castShadow?: boolean
  }

/** A static pack model (world prop or held item) with the palette shader. */
export function PolyProp(props: PolyPropProps) {
  const ref = useMemo(
    () => [assetRefFor(props.item.pack, props.item.leaf, props.item.relativePath)],
    [props.item.pack, props.item.leaf, props.item.relativePath],
  )
  const urls = useAssetUrls(ref)
  if (!urls?.[0]) return null
  return <LoadedProp {...props} url={urls[0]} />
}

function LoadedProp({ item, url, palette, material: sharedMaterial, blobShadow = false, castShadow = false, position, rotation, scale }: PolyPropProps & { url: string }) {
  const gltf = readGltf(url)
  const geometry = findStaticMesh(gltf, item.nodeName).geometry
  const ownMaterial = useMemo(() => (sharedMaterial ? null : createPolyMaterial(palette)), [sharedMaterial]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ownMaterial && palette) updatePolyMaterialPalette(ownMaterial, palette)
  }, [ownMaterial, palette])
  useEffect(() => () => ownMaterial?.dispose(), [ownMaterial])
  const footprint = useMemo(() => {
    const size = new Box3().setFromBufferAttribute(geometry.getAttribute('position') as Parameters<Box3['setFromBufferAttribute']>[0]).getSize(new Vector3())
    return [size.x * 1.5 + 0.2, 1, size.z * 1.5 + 0.2] as const
  }, [geometry])
  const blob = blobShadow ? getSharedBlobShadowResources() : null
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geometry} material={sharedMaterial ?? ownMaterial!} castShadow={castShadow} />
      {blob && <mesh geometry={blob.geometry} material={blob.material} position={[0, BLOB_Y, 0]} scale={footprint} />}
    </group>
  )
}
