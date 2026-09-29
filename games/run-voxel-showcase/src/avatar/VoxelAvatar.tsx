/**
 * Renders one avatar from parts of any pack, or a full-body skin from any
 * pack, and plays any pack's clip on it.
 *
 * The PN avatar GLB owns the skeleton. RUN part meshes are cloned from their
 * pack's avatar GLB and rebound to the PN skeleton after the rig guard; this
 * works because RUN parts carry PN's exact joint order and bind pose. Clips
 * play by bone name, so a clip from any pack drives any avatar. A held item
 * rides the `Hand.R` bone with an identity local transform.
 */
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { AnimationMixer, Color, PropertyBinding, SkinnedMesh, type AnimationClip, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { PackCatalog, VoxelModelEntry } from '@rvx/contracts/catalog'
import type { PackKey } from '@rvx/contracts/packs'
import type { AssetRef } from '../assetSource'
import { modelRef } from '../catalog'
import { assertClipTargets, assertModelContract } from '../guards/contract'
import { assertPartsRigCompatible, assertSkinRigCompatible } from '../guards/rig'
import { leafId } from '../leaves'
import { useAssetUrls } from '../useAssetUrl'
import { SocketPfx, type ClipClock } from '../pfx/SocketPfx'
import { PartIndex, resolveVisibleParts, type AvatarSelection } from './compose'

/** The PN rig faces +X; three.js turns it to the camera with -90° yaw. */
export const AVATAR_FORWARD_YAW = -Math.PI / 2
export const AVATAR_ROOT_NAME = 'voxel-avatar'
export const HAND_R = PropertyBinding.sanitizeNodeName('Hand.R')

const SLOT_LAYERS: Record<string, [order: number, offset: number]> = {
  species: [0, 10], ears: [1, 8], bottoms: [2, 6], shoes: [3, 4], tops: [4, 2], back: [5, 0],
  face: [6, -4], eyebrow: [7, -8], hair: [8, -12], facialhair: [9, -16], eyewear: [10, -20], headwear: [11, -24],
}
/** The two fields composition reads; drei and three type GLTF differently. */
interface LoadedGltf {
  scene: Group
  animations: AnimationClip[]
}

const TINTS: Record<string, 'skinColor' | 'hairColor'> = { 'Skin-Material': 'skinColor', 'Hair-Material': 'hairColor' }

interface AvatarPlan {
  /** Packs whose parts file is loaded (PN always, for its skeleton). */
  packs: PackKey[]
  refs: AssetRef[]
  /** Index into refs of the file holding the selected clip. */
  clipRef: number
  /** Catalog entries of the RUN parts files, for the load-time contract. */
  partsEntries: Map<PackKey, VoxelModelEntry>
  skin: VoxelModelEntry | null
  held: VoxelModelEntry | null
}

function findModel(catalogs: readonly PackCatalog[], id: string, category: string): VoxelModelEntry {
  const entry = catalogs.flatMap((c) => c.models).find((m) => m.id === id)
  if (!entry || entry.category !== category) throw new Error(`no ${category} model "${id}"`)
  return entry
}

function planAvatar(selection: AvatarSelection, catalogs: readonly PackCatalog[]): AvatarPlan {
  const byPack = new Map(catalogs.map((c) => [c.pack, c]))
  const clipOwner = catalogs.find((c) => c.avatar.clips.includes(selection.clip))?.pack
  if (!clipOwner) throw new Error(`no loaded pack has avatar clip "${selection.clip}"`)
  const packs = new Set<PackKey>(['pirate', clipOwner])
  if (selection.base.kind === 'modular') {
    packs.add(selection.base.species.pack)
    for (const ref of Object.values(selection.base.parts)) if (ref) packs.add(ref.pack)
  }
  const ordered = [...packs]
  const catalogOf = (pack: PackKey) => {
    const catalog = byPack.get(pack)
    if (!catalog) throw new Error(`pack "${pack}" is not loaded`)
    return catalog
  }
  const refs: AssetRef[] = ordered.map((pack) => ({ leafId: leafId(pack, catalogOf(pack).avatar.leaf), path: catalogOf(pack).avatar.partsModelPath }))
  // The clip may live in its own file (clipsModelPath); reuse the parts request when they match.
  const owner = catalogOf(clipOwner).avatar
  let clipRef = ordered.indexOf(clipOwner)
  if (owner.clipsModelPath !== owner.partsModelPath) {
    refs.push({ leafId: leafId(clipOwner, owner.leaf), path: owner.clipsModelPath })
    clipRef = refs.length - 1
  }
  const partsEntries = new Map<PackKey, VoxelModelEntry>()
  for (const pack of ordered) {
    if (pack === 'pirate') continue
    const { avatar } = catalogOf(pack)
    const entry = catalogOf(pack).models.find((m) => m.leaf === avatar.leaf && m.relativePath === avatar.partsModelPath)
    if (!entry) throw new Error(`${pack}: the catalog has no model entry for its parts file ${avatar.partsModelPath}`)
    partsEntries.set(pack, entry)
  }
  const skin = selection.base.kind === 'skin' ? findModel(catalogs, selection.base.skin, 'characters-skins') : null
  const held = selection.held ? findModel(catalogs, selection.held, 'held-items') : null
  if (skin) refs.push(modelRef(skin))
  if (held) refs.push(modelRef(held))
  return { packs: ordered, refs, clipRef, partsEntries, skin, held }
}

function firstSkinned(root: Object3D): SkinnedMesh {
  let found: SkinnedMesh | undefined
  root.traverse((o) => {
    if (!found && (o as SkinnedMesh).isSkinnedMesh) found = o as SkinnedMesh
  })
  if (!found) throw new Error('avatar file has no skinned mesh')
  return found
}

function slotOf(object: Object3D, root: Object3D): string {
  for (let o: Object3D | null = object; o && o !== root; o = o.parent) {
    const prefix = o.name.split(/[_\s]/)[0]?.toLowerCase()
    if (prefix && prefix in SLOT_LAYERS) return prefix
  }
  return 'tops'
}

function dressMaterials(root: Object3D, selection: AvatarSelection): void {
  const colors = { skinColor: new Color(selection.skinColor), hairColor: new Color(selection.hairColor) }
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const [order, offset] = SLOT_LAYERS[slotOf(mesh, root)] ?? [4, 0]
    mesh.renderOrder = order
    mesh.castShadow = false
    mesh.receiveShadow = true
    const dress = (material: MeshStandardMaterial) => {
      const copy = material.clone()
      const tint = TINTS[material.name]
      if (tint) copy.color = colors[tint].clone()
      copy.polygonOffset = true
      copy.polygonOffsetFactor = offset
      copy.polygonOffsetUnits = offset
      return copy
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => dress(m as MeshStandardMaterial)) : dress(mesh.material as MeshStandardMaterial)
  })
}

function buildModular(selection: AvatarSelection & { base: { kind: 'modular' } }, catalogs: readonly PackCatalog[], gltfs: Map<PackKey, LoadedGltf>): Group {
  const pirate = gltfs.get('pirate')!
  const root = cloneSkeleton(pirate.scene) as Group
  const skeleton = firstSkinned(root).skeleton
  const visible = resolveVisibleParts(selection.base, new PartIndex(catalogs))
  const keepPirate = new Set(visible.filter((p) => p.ref.pack === 'pirate').map((p) => PropertyBinding.sanitizeNodeName(p.nodeName)))

  const discard: Object3D[] = []
  root.traverse((object) => {
    if (!(object as Mesh).isMesh) return
    for (let o: Object3D | null = object; o && o !== root; o = o.parent) if (keepPirate.has(o.name)) return
    discard.push(object)
  })
  for (const object of discard) object.removeFromParent()

  for (const part of visible.filter((p) => p.ref.pack !== 'pirate')) {
    const gltf = gltfs.get(part.ref.pack)
    if (!gltf) throw new Error(`pack "${part.ref.pack}" avatar file is not loaded`)
    const source = gltf.scene.getObjectByName(PropertyBinding.sanitizeNodeName(part.nodeName)) as SkinnedMesh | undefined
    if (!source?.isSkinnedMesh) throw new Error(`${part.ref.pack} avatar file has no skinned part "${part.nodeName}"`)
    assertPartsRigCompatible(part.ref.pack, source.skeleton, skeleton)
    const mesh = source.clone() as SkinnedMesh
    mesh.bind(skeleton, source.bindMatrix.clone())
    root.add(mesh)
  }
  dressMaterials(root, selection)
  return root
}

function buildSkin(selection: AvatarSelection, skin: VoxelModelEntry, gltf: LoadedGltf): Group {
  assertModelContract(gltf.scene, gltf.animations, skin)
  assertSkinRigCompatible(skin.pack, firstSkinned(gltf.scene).skeleton)
  const root = cloneSkeleton(gltf.scene) as Group
  dressMaterials(root, selection)
  return root
}

export interface VoxelAvatarProps {
  selection: AvatarSelection
  catalogs: readonly PackCatalog[]
  /** Play the held item's PFX bindings at its sockets. */
  heldPfx?: boolean
}

export function VoxelAvatar({ selection, catalogs, heldPfx = false }: VoxelAvatarProps) {
  const plan = useMemo(() => planAvatar(selection, catalogs), [selection, catalogs])
  const urls = useAssetUrls(plan.refs)
  if (!urls) return null
  return <LoadedAvatar selection={selection} catalogs={catalogs} plan={plan} urls={urls} heldPfx={heldPfx} />
}

function LoadedAvatar({ selection, catalogs, plan, urls, heldPfx }: VoxelAvatarProps & { plan: AvatarPlan; urls: string[] }) {
  const loaded: LoadedGltf[] = useGLTF(urls)
  const avatar = useMemo(() => {
    const byPack = new Map(plan.packs.map((pack, i) => [pack, loaded[i]!]))
    for (const [pack, entry] of plan.partsEntries) {
      const gltf = byPack.get(pack)!
      assertModelContract(gltf.scene, gltf.animations, entry)
    }
    const tail = loaded.length - (plan.skin ? 1 : 0) - (plan.held ? 1 : 0)
    const skinGltf = plan.skin ? loaded[tail] : undefined
    const heldGltf = plan.held ? loaded[tail + (plan.skin ? 1 : 0)] : undefined
    const root =
      selection.base.kind === 'modular'
        ? buildModular(selection as AvatarSelection & { base: { kind: 'modular' } }, catalogs, byPack)
        : buildSkin(selection, plan.skin!, skinGltf!)
    let item: Object3D | null = null
    if (plan.held && heldGltf) {
      assertModelContract(heldGltf.scene, heldGltf.animations, plan.held)
      const hand = root.getObjectByName(HAND_R)
      if (!hand) throw new Error(`avatar has no ${HAND_R} bone for the held item`)
      item = heldGltf.scene.clone(true)
      item.name = 'held-item'
      hand.add(item)
    }
    const clip = loaded[plan.clipRef]!.animations.find((c) => c.name === selection.clip)
    if (!clip) throw new Error(`clip "${selection.clip}" is not in its pack's clip file`)
    assertClipTargets(root, clip, selection.base.kind === 'skin' ? plan.skin!.id : 'avatar')
    return { root, clip, item }
  }, [loaded, plan, selection, catalogs])

  const mixer = useMemo(() => new AnimationMixer(avatar.root), [avatar])
  // Action clips (swings, shots) time a held item's manual one-shots to the swing; other clips leave them on a timer.
  const clipClock = useRef<ClipClock | null>(null)
  useEffect(() => {
    const action = mixer.clipAction(avatar.clip)
    action.reset().fadeIn(0.15).play()
    clipClock.current = avatar.clip.name.includes('_Action_') ? { elapsed: 0, duration: avatar.clip.duration } : null
    ;(window as unknown as { __rvxAvatar?: unknown }).__rvxAvatar = { root: avatar.root, mixer, clip: avatar.clip.name, key: JSON.stringify(selection) }
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(avatar.root)
    }
  }, [mixer, avatar, selection])
  useFrame((_, delta) => {
    mixer.update(delta)
    if (clipClock.current) clipClock.current.elapsed += delta
  })

  return (
    <group name={AVATAR_ROOT_NAME} rotation={[0, AVATAR_FORWARD_YAW, 0]}>
      <primitive object={avatar.root} />
      {heldPfx && avatar.item && plan.held && plan.held.pfx.length > 0 && <SocketPfx model={avatar.item} entry={plan.held} clipClock={clipClock} />}
    </group>
  )
}
