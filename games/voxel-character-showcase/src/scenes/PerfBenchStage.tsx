import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, PCFSoftShadowMap, type InstancedMesh, type Material, type Mesh } from 'three'
import type { PackCatalog } from '@voxchar/contracts/catalog'
import type { RigId } from '@voxchar/contracts/rig'
import { PolyAvatar, type PolyAvatarLod, type PolyPerfSink } from '../avatar/PolyAvatar'
import { selectionFromPreset, type PolyPartIndex } from '../avatar/composePolyAvatar'
import { createPolyMaterial, getSharedBlobShadowResources } from '../avatar/polyMaterial'

export interface PerfTelemetry {
  fps: number
  /** Mean frame time of the last window, in milliseconds. */
  frameMs: number
  p95FrameMs: number
  /** Mean time of all animation mixer steps in one frame, in milliseconds. */
  mixerCpuMs: number
  drawCalls: number
  triangles: number
  avatarCount: number
}

export interface PerfBenchStageProps {
  catalogs: PackCatalog[]
  index: PolyPartIndex
  avatarCount: number
  /** S23 Ultra policy: blob shadows in one instanced draw and no shadow maps. Off uses a shadow map. */
  mobileMode: boolean
  /** Step the mixers of far avatars at 30 Hz and 15 Hz. */
  lodThrottle: boolean
  onTelemetry: (telemetry: PerfTelemetry) => void
}

/** Grid pitch in metres. A 1.34x troll and a wide spider must not reach into the next cell. */
const SPACING = 1.85
const FRAME_WINDOW = 240
const REPORT_SECONDS = 0.5
const FULL_RATE_DISTANCE = 16
const HALF_RATE_DISTANCE = 24

function gridPositions(count: number): [number, number, number][] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)))
  const rows = Math.ceil(count / columns)
  return Array.from({ length: count }, (_, i) => {
    const column = i % columns
    const row = Math.floor(i / columns)
    return [(column - (columns - 1) / 2) * SPACING, 0, ((rows - 1) / 2 - row) * SPACING * 1.15]
  })
}

const ANIMAL_FOOTPRINTS: Partial<Record<RigId, number>> = {
  horse: 2.3,
  wolf: 1.65,
  fox: 1.35,
  gsd: 1.3,
  pug: 0.75,
  corgi: 0.75,
  cat: 0.65,
}

/** 1 to 64 animated avatars with live frame-time, mixer, draw-call and triangle telemetry. */
export function PerfBenchStage({ catalogs, index, avatarCount, mobileMode, lodThrottle, onTelemetry }: PerfBenchStageProps) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const presets = useMemo(() => {
    const contextPresets = catalogs.filter((catalog) => catalog.pack !== 'core').flatMap((catalog) => catalog.presets)
    return contextPresets.length > 0 ? contextPresets : catalogs.flatMap((catalog) => catalog.presets)
  }, [catalogs])
  if (presets.length === 0) throw new Error('The catalogs have no character presets for the bench.')

  // Avatars of one preset share one selection, one merged geometry and one material.
  const looks = useMemo(
    () => presets.map((preset) => ({ selection: selectionFromPreset(preset), material: createPolyMaterial(preset.palette) })),
    [presets],
  )
  useEffect(() => () => looks.forEach((look) => look.material.dispose()), [looks])

  const positions = useMemo(() => gridPositions(avatarCount), [avatarCount])
  const lods = useMemo<PolyAvatarLod[]>(() => positions.map(() => ({ mixerHz: 0 })), [positions])
  const perfSink = useMemo<PolyPerfSink>(() => ({ mixerMs: 0 }), [])

  // One instanced quad draws all blob shadows.
  const blob = getSharedBlobShadowResources()
  const blobs = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = blobs.current
    if (!mesh) return
    const dummy = new Object3D()
    positions.forEach(([x, , z], i) => {
      const look = looks[i % looks.length]!
      const { height, shoulderWidth, torsoBulk } = look.selection.proportions
      const footprint =
        look.selection.rigId === 'arachnid'
          ? 1.75 * height * (0.5 + 0.5 * torsoBulk)
          : look.selection.rigId === 'quadruped'
            ? 1.45 * height * (0.5 + 0.5 * torsoBulk)
            : look.selection.rigId === 'ual1'
              ? 1.25 * height * (0.5 + 0.5 * shoulderWidth)
              : (ANIMAL_FOOTPRINTS[look.selection.rigId] ?? 1.2) * height
      dummy.position.set(x, 0.012, z)
      dummy.scale.set(footprint, 1, footprint)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.count = positions.length
    mesh.instanceMatrix.needsUpdate = true
  }, [positions, looks, mobileMode])

  useLayoutEffect(() => {
    const setShadowMaps = (enabled: boolean) => {
      gl.shadowMap.enabled = enabled
      gl.shadowMap.type = PCFSoftShadowMap
      // The shadow-map switch is a part of each shader program. Compile the programs again.
      scene.traverse((object) => {
        const material = (object as Mesh).material as Material | Material[] | undefined
        for (const item of Array.isArray(material) ? material : material ? [material] : []) item.needsUpdate = true
      })
    }
    setShadowMaps(!mobileMode)
    return () => setShadowMaps(false)
  }, [gl, scene, mobileMode])

  const frames = useMemo(() => new Float32Array(FRAME_WINDOW), [])
  const sorted = useMemo(() => new Float32Array(FRAME_WINDOW), [])
  const window_ = useRef({ cursor: 0, filled: 0, seconds: 0, frames: 0 })

  useFrame(({ camera }, delta) => {
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]!
      const distance = Math.hypot(camera.position.x - position[0], camera.position.y - 1, camera.position.z - position[2])
      lods[i]!.mixerHz = !lodThrottle || distance < FULL_RATE_DISTANCE ? 0 : distance < HALF_RATE_DISTANCE ? 30 : 15
    }

    const state = window_.current
    frames[state.cursor] = delta * 1000
    state.cursor = (state.cursor + 1) % FRAME_WINDOW
    state.filled = Math.min(state.filled + 1, FRAME_WINDOW)
    state.seconds += delta
    state.frames++
    if (state.seconds < REPORT_SECONDS) return

    sorted.set(frames)
    const samples = sorted.subarray(0, state.filled).sort()
    let total = 0
    for (let i = 0; i < samples.length; i++) total += samples[i]!
    const frameMs = total / samples.length
    onTelemetry({
      fps: Math.round(state.frames / state.seconds),
      frameMs,
      p95FrameMs: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]!,
      mixerCpuMs: perfSink.mixerMs / state.frames,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      avatarCount: positions.length,
    })
    perfSink.mixerMs = 0
    state.seconds = 0
    state.frames = 0
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[74, 74]} />
        <meshStandardMaterial color="#2b2f37" roughness={1} />
      </mesh>
      <gridHelper args={[74, 40, '#4a5261', '#383e49']} position={[0, 0.004, 0]} />
      {mobileMode ? (
        <instancedMesh ref={blobs} args={[blob.geometry, blob.material, 64]} frustumCulled={false} />
      ) : (
        <directionalLight
          castShadow
          position={[9, 16, 7]}
          intensity={0.7}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
          shadow-camera-far={50}
          shadow-bias={-0.0005}
        />
      )}
      {positions.map((position, i) => {
        const look = looks[i % looks.length]!
        return (
          <PolyAvatar
            key={i}
            selection={look.selection}
            index={index}
            material={look.material}
            position={position}
            castShadow={!mobileMode}
            lod={lods[i]}
            perfSink={perfSink}
            timeOffset={(i * 0.37) % 3}
          />
        )
      })}
    </group>
  )
}
