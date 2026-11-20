import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, Group, Matrix4, Mesh, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three'
import type { AvatarPartEntry, CharacterPreset, HeldItemEntry, WorldPropEntry } from '@chisel/contracts/catalog'
import { CONTEXT_DEFAULT_PALETTES, type PaletteColors } from '@chisel/contracts/palette'
import type { ContextPackKey, PolyPackKey } from '@chisel/contracts/packs'
import { assetRefFor, type PolyPartIndex } from './composePolyAvatar'
import { PROP_PALETTES } from '../scenes/contextPalettes'
import { createPolyMaterial, getSharedBlobShadowResources, updatePolyMaterialPalette } from './polyMaterial'
import { findSkinnedPart, readGltf } from './polyRig'
import { PolyAvatar, PolyProp } from './PolyAvatar'
import { useAssetUrls } from '../useAssetUrl'

export type GalleryItem =
  | { kind: 'part'; entry: AvatarPartEntry }
  | { kind: 'held'; entry: HeldItemEntry }
  | { kind: 'prop'; entry: WorldPropEntry }
  | { kind: 'preset'; entry: CharacterPreset }

export function paletteForPack(pack: PolyPackKey): PaletteColors {
  const key: ContextPackKey = pack === 'core' ? 'medieval' : pack
  return CONTEXT_DEFAULT_PALETTES[key]
}

export function paletteForProp(pack: PolyPackKey): PaletteColors {
  const key: ContextPackKey = pack === 'core' ? 'medieval' : pack
  return PROP_PALETTES[key]
}

const _tmpV = new Vector3()
const _tmpBox = new Box3()
const _tmpM = new Matrix4()

function hasRenderableMesh(root: Group): boolean {
  let count = 0
  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      const pos = obj.geometry?.getAttribute('position')
      // Ignore empty geometry or tiny 16-vertex blob shadow circles until real mesh mounts.
      if (pos && pos.count > 0 && !obj.userData?.isBlobShadow) {
        count++
      }
    }
  })
  return count > 0
}

function computeAccurateBounds(root: Group): Box3 {
  root.updateMatrixWorld(true)
  const box = new Box3()
  root.traverse((obj) => {
    if (!(obj instanceof Mesh) || obj.userData?.isBlobShadow) return
    const geom = obj.geometry
    const pos = geom?.getAttribute('position')
    if (!pos || pos.count === 0) return
    if (obj instanceof SkinnedMesh && obj.skeleton) {
      obj.skeleton.bones.forEach((b) => b.updateMatrixWorld(true))
      obj.skeleton.update()
      _tmpBox.makeEmpty()
      for (let i = 0; i < pos.count; i++) {
        _tmpV.fromBufferAttribute(pos, i)
        if (typeof obj.applyBoneTransform === 'function') {
          obj.applyBoneTransform(i, _tmpV)
        }
        _tmpV.applyMatrix4(obj.matrixWorld)
        _tmpBox.expandByPoint(_tmpV)
      }
      box.union(_tmpBox)
      return
    }
    geom.computeBoundingBox()
    if (geom.boundingBox) {
      _tmpBox.copy(geom.boundingBox).applyMatrix4(obj.matrixWorld)
      box.union(_tmpBox)
    }
  })
  if (box.isEmpty()) {
    box.setFromCenterAndSize(new Vector3(0, 0.9, 0), new Vector3(1, 1.8, 1))
  }
  return box
}

/** Auto-frames any gallery item or thumbnail target once its geometry finishes loading and posing. */
export function FitItemCamera({
  targetRef,
  fitKey,
  onReady,
  controlsRef,
  margin = 1.38,
  yawDeg = 36,
  pitchDeg = 18,
}: {
  targetRef: React.RefObject<Group | null>
  fitKey: string
  onReady?: () => void
  controlsRef?: React.RefObject<{ target: Vector3; update: () => void } | null>
  margin?: number
  yawDeg?: number
  pitchDeg?: number
}) {
  const { camera } = useThree()
  const fittedKey = useRef<string | null>(null)
  const readyKey = useRef<string | null>(null)
  const warmupFrames = useRef(0)
  const postFitFrames = useRef(0)

  useEffect(() => {
    fittedKey.current = null
    readyKey.current = null
    warmupFrames.current = 0
    postFitFrames.current = 0
  }, [fitKey])

  useFrame(() => {
    const root = targetRef.current
    if (!root) return

    if (fittedKey.current !== fitKey) {
      if (!hasRenderableMesh(root)) return
      // Give PolyAvatar 2 frames so AnimationMixer applies holdPhase/clip pose before measuring bounds.
      if (warmupFrames.current < 2) {
        warmupFrames.current++
        return
      }
      const box = computeAccurateBounds(root)
      const center = box.getCenter(new Vector3())
      const size = box.getSize(new Vector3())
      const radius = Math.max(0.16, size.length() * 0.5)
      const fovRad = ((camera instanceof PerspectiveCamera ? camera.fov : 38) * Math.PI) / 180
      const dist = (radius * margin) / Math.sin(fovRad / 2)
      const yaw = (yawDeg * Math.PI) / 180
      const pitch = (pitchDeg * Math.PI) / 180
      const cp = Math.cos(pitch)
      const dir = new Vector3(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).normalize()
      camera.position.copy(center).addScaledVector(dir, dist)
      camera.near = Math.max(0.02, dist * 0.01)
      camera.far = Math.max(50, dist * 12)
      camera.updateProjectionMatrix()
      camera.lookAt(center)
      if (controlsRef?.current) {
        controlsRef.current.target.copy(center)
        controlsRef.current.update()
      }
      fittedKey.current = fitKey
      postFitFrames.current = 0
      return
    }

    if (readyKey.current !== fitKey) {
      postFitFrames.current++
      if (postFitFrames.current >= 2) {
        readyKey.current = fitKey
        onReady?.()
      }
    }
  })

  return null
}

function IsolatedSkinnedPart({ entry, palette }: { entry: AvatarPartEntry; palette: PaletteColors }) {
  const ref = useMemo(() => [assetRefFor(entry.pack, entry.leaf, entry.relativePath)], [entry.pack, entry.leaf, entry.relativePath])
  const urls = useAssetUrls(ref)
  const url = urls?.[0]
  if (!url) return null
  return <LoadedIsolatedPart entry={entry} url={url} palette={palette} />
}

function LoadedIsolatedPart({ entry, url, palette }: { entry: AvatarPartEntry; url: string; palette: PaletteColors }) {
  const gltf = readGltf(url)
  const geometry = useMemo(() => {
    const src = findSkinnedPart(gltf, entry.nodeName, entry.rigId)
    const cloned = src.geometry.clone()
    cloned.morphAttributes = {}
    cloned.morphTargetsRelative = false
    cloned.deleteAttribute('skinIndex')
    cloned.deleteAttribute('skinWeight')
    src.updateWorldMatrix(true, false)
    if (!src.matrixWorld.equals(_tmpM.identity())) {
      cloned.applyMatrix4(src.matrixWorld)
    }
    cloned.computeBoundingBox()
    cloned.computeBoundingSphere()
    return cloned
  }, [gltf, entry.nodeName, entry.rigId])

  const mat = useMemo(() => createPolyMaterial(palette), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    updatePolyMaterialPalette(mat, palette)
  }, [mat, palette])
  useEffect(
    () => () => {
      geometry.dispose()
      mat.dispose()
    },
    [geometry, mat],
  )

  const blob = getSharedBlobShadowResources()
  const box = useMemo(() => {
    geometry.computeBoundingBox()
    return geometry.boundingBox ?? new Box3(new Vector3(-0.3, 0, -0.3), new Vector3(0.3, 1.8, 0.3))
  }, [geometry])
  const footprint = Math.max(0.35, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.45)

  return (
    <group>
      <mesh geometry={geometry} material={mat} />
      <mesh
        geometry={blob.geometry}
        material={blob.material}
        userData={{ isBlobShadow: true }}
        position={[0, Math.min(0.012, box.min.y + 0.012), 0]}
        scale={[footprint, 1, footprint]}
      />
    </group>
  )
}

export function GalleryStageContent({
  item,
  index,
  presets = [],
  clipOverride,
  holdPhase = null,
  controlsRef,
  resetSeq = 0,
  yawDeg = 36,
  pitchDeg = 18,
  onReady,
}: {
  item: GalleryItem
  index: PolyPartIndex
  presets?: readonly CharacterPreset[]
  clipOverride?: string | null
  holdPhase?: number | null
  controlsRef?: React.RefObject<{ target: Vector3; update: () => void } | null>
  resetSeq?: number
  yawDeg?: number
  pitchDeg?: number
  onReady?: () => void
}) {
  const groupRef = useRef<Group>(null)

  const fitKey =
    item.kind === 'preset'
      ? `preset:${item.entry.id}:${clipOverride ?? item.entry.clip}:${yawDeg}:${pitchDeg}:${resetSeq}`
      : `${item.kind}:${item.entry.id}:${clipOverride ?? 'default'}:${yawDeg}:${pitchDeg}:${resetSeq}`

  let content: React.ReactNode
  if (item.kind === 'preset') {
    const p = item.entry
    content = (
      <PolyAvatar
        index={index}
        holdPhase={holdPhase}
        selection={{
          rigId: p.rigId,
          clip: clipOverride ?? p.clip,
          body: p.body,
          head: p.head,
          hair: p.hair,
          torso: p.torso,
          legs: p.legs,
          headwear: p.headwear,
          back: p.back,
          heldRight: p.heldRight,
          heldLeft: p.heldLeft,
          palette: p.palette,
          proportions: p.proportions,
        }}
      />
    )
  } else if (item.kind === 'part' && item.entry.slot === 'body') {
    const e = item.entry
    const palette = paletteForPack(e.pack)
    const matchingPreset = presets.find((p) => p.body === e.id)
    const fallbackHead =
      e.rigId === 'ual1' ? (index.partsBySlot.get('head')?.find((h) => h.rigId === 'ual1')?.id ?? null) : null
    content = (
      <PolyAvatar
        index={index}
        holdPhase={holdPhase}
        selection={{
          rigId: e.rigId,
          clip: clipOverride ?? matchingPreset?.clip ?? (e.rigId === 'ual1' ? 'Idle_Loop' : 'Idle'),
          body: e.id,
          head: matchingPreset?.head ?? fallbackHead,
          hair: null,
          torso: null,
          legs: null,
          headwear: null,
          back: null,
          heldRight: null,
          heldLeft: null,
          palette: matchingPreset?.palette ?? palette,
          proportions: matchingPreset?.proportions ?? {
            height: 1,
            shoulderWidth: 1,
            torsoBulk: 1,
            waistScale: 1,
            headScale: 1,
            limbThickness: 1,
          },
        }}
      />
    )
  } else if (item.kind === 'part') {
    content = <IsolatedSkinnedPart entry={item.entry} palette={paletteForPack(item.entry.pack)} />
  } else if (item.kind === 'prop') {
    content = (
      <PolyProp
        item={item.entry}
        palette={paletteForProp(item.entry.pack)}
        clip={clipOverride ?? undefined}
        holdPhase={holdPhase}
        blobShadow
      />
    )
  } else {
    content = <PolyProp item={item.entry} palette={paletteForPack(item.entry.pack)} blobShadow />
  }

  return (
    <>
      <group ref={groupRef}>{content}</group>
      <FitItemCamera targetRef={groupRef} fitKey={fitKey} controlsRef={controlsRef} yawDeg={yawDeg} pitchDeg={pitchDeg} onReady={onReady} />
    </>
  )
}

function estimateSlotWidth(item: GalleryItem): number {
  if (item.kind === 'prop') return Math.max(0.9, item.entry.bounds.size[0] + 0.4)
  if (item.kind === 'held') return 0.9
  if (item.kind === 'preset') {
    const rig = item.entry.rigId
    if (rig === 'dragon') return 3.8
    if (rig === 'avian') return 2.8
    if (rig === 'arachnid') return 2.4
    if (rig === 'quadruped' || rig === 'kaiju') return 1.8
    return 1.2
  }
  const rig = item.entry.rigId
  if (rig === 'dragon') return 3.8
  if (rig === 'avian') return 2.8
  if (rig === 'arachnid') return 2.4
  if (rig === 'quadruped' || rig === 'kaiju') return 1.8
  return 1.2
}

/** Side-by-side scale lineup next to a 1.80m human reference gauge. */
export function LineupStageContent({
  items,
  index,
  presets = [],
  clipOverride,
  holdPhase = 0.2,
  onReady,
}: {
  items: readonly GalleryItem[]
  index: PolyPartIndex
  presets?: readonly CharacterPreset[]
  clipOverride?: string | null
  holdPhase?: number | null
  onReady?: () => void
}) {
  const groupRef = useRef<Group>(null)

  const placements = useMemo(() => {
    let cursor = 1.4
    return items.map((item) => {
      const w = estimateSlotWidth(item)
      const x = cursor + w * 0.5
      cursor += w + 0.5
      return { item, x }
    })
  }, [items])

  const fitKey = `lineup:${items.map((it) => `${it.kind}:${it.entry.id}`).join(',')}:${clipOverride ?? 'def'}`

  return (
    <>
      <group ref={groupRef}>
        {/* 1.80m red height reference pillar */}
        <mesh position={[-0.7, 0.9, 0]}>
          <boxGeometry args={[0.16, 1.8, 0.16]} />
          <meshStandardMaterial color="#d94e41" roughness={0.65} />
        </mesh>
        {/* 1.80m UAL1 athletic reference avatar */}
        <PolyAvatar
          index={index}
          holdPhase={holdPhase}
          position={[0.15, 0, 0]}
          selection={{
            rigId: 'ual1',
            clip: 'Idle_Loop',
            body: 'body_athletic',
            head: index.partsBySlot.get('head')?.find((h) => h.rigId === 'ual1')?.id ?? null,
            hair: null,
            torso: null,
            legs: null,
            headwear: null,
            back: null,
            heldRight: null,
            heldLeft: null,
            palette: paletteForPack('core'),
            proportions: { height: 1, shoulderWidth: 1, torsoBulk: 1, waistScale: 1, headScale: 1, limbThickness: 1 },
          }}
        />
        {placements.map(({ item, x }, idx) => (
          <group key={`${item.kind}:${item.entry.id}:${idx}`} position={[x, 0, 0]}>
            {item.kind === 'preset' ? (
              <PolyAvatar
                index={index}
                holdPhase={holdPhase}
                selection={{
                  rigId: item.entry.rigId,
                  clip: clipOverride ?? item.entry.clip,
                  body: item.entry.body,
                  head: item.entry.head,
                  hair: item.entry.hair,
                  torso: item.entry.torso,
                  legs: item.entry.legs,
                  headwear: item.entry.headwear,
                  back: item.entry.back,
                  heldRight: item.entry.heldRight,
                  heldLeft: item.entry.heldLeft,
                  palette: item.entry.palette,
                  proportions: item.entry.proportions,
                }}
              />
            ) : item.kind === 'part' && item.entry.slot === 'body' ? (
              (() => {
                const e = item.entry
                const mp = presets.find((p) => p.body === e.id)
                const fallbackHead =
                  e.rigId === 'ual1' ? (index.partsBySlot.get('head')?.find((h) => h.rigId === 'ual1')?.id ?? null) : null
                return (
                  <PolyAvatar
                    index={index}
                    holdPhase={holdPhase}
                    selection={{
                      rigId: e.rigId,
                      clip: clipOverride ?? mp?.clip ?? (e.rigId === 'ual1' ? 'Idle_Loop' : 'Idle'),
                      body: e.id,
                      head: mp?.head ?? fallbackHead,
                      hair: null,
                      torso: null,
                      legs: null,
                      headwear: null,
                      back: null,
                      heldRight: null,
                      heldLeft: null,
                      palette: mp?.palette ?? paletteForPack(e.pack),
                      proportions: mp?.proportions ?? {
                        height: 1,
                        shoulderWidth: 1,
                        torsoBulk: 1,
                        waistScale: 1,
                        headScale: 1,
                        limbThickness: 1,
                      },
                    }}
                  />
                )
              })()
            ) : item.kind === 'part' ? (
              <IsolatedSkinnedPart entry={item.entry} palette={paletteForPack(item.entry.pack)} />
            ) : item.kind === 'prop' ? (
              <PolyProp
                item={item.entry}
                palette={paletteForProp(item.entry.pack)}
                clip={clipOverride ?? undefined}
                holdPhase={holdPhase}
                blobShadow
              />
            ) : (
              <PolyProp item={item.entry} palette={paletteForPack(item.entry.pack)} blobShadow />
            )}
          </group>
        ))}
      </group>
      <FitItemCamera targetRef={groupRef} fitKey={fitKey} margin={1.25} yawDeg={14} pitchDeg={14} onReady={onReady} />
    </>
  )
}

