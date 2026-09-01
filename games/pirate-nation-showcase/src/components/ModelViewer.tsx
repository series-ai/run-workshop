/**
 * Renders one pack model with orbit, turntable, wireframe, and animation
 * playback; models that ship a `…-collision` GLB also get a Collision toggle
 * that swaps the rendered geometry.
 *
 * Animation availability is not in the pack catalog, so clips are read from
 * the loaded GLB and reported up through `onAnimations` for the picker UI.
 */
import { OrbitControls, useAnimations, useGLTF, useProgress } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Vector3, type Group } from 'three'
import { modelAssetReference, type PirateNationModelEntry } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import {
  FitCamera,
  getModelPreviewYaw,
  PackCanvas,
  PackModel,
  STAGE_COLORS,
} from '../pack3d'

export const MODEL_VIEWER_ROOT_NAME = 'showcase-model-root'

interface ModelSceneProps {
  entry: PirateNationModelEntry
  clip: string | null
  turntable: boolean
  wireframe: boolean
  onAnimations: (names: string[]) => void
}

function ModelScene(props: ModelSceneProps) {
  const url = useAssetUrl(modelAssetReference(props.entry))
  if (!url) return null
  return <AnimatedModelScene {...props} url={url} />
}

function AnimatedModelScene({
  entry,
  clip,
  turntable,
  wireframe,
  onAnimations,
  url,
}: ModelSceneProps & { url: string }) {
  const group = useRef<Group>(null)
  const { animations } = useGLTF(url)

  useEffect(() => {
    onAnimations(animations.map((animation) => animation.name))
  }, [animations, onAnimations])

  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    if (!clip) return
    const action = actions[clip]
    if (!action) return
    action.reset().fadeIn(0.2).play()
    return () => {
      action.fadeOut(0.2)
    }
  }, [actions, clip])

  useFrame((_, delta) => {
    if (turntable && group.current) group.current.rotation.y += delta * 0.6
  })

  return (
    <PackModel
      entry={entry}
      name={MODEL_VIEWER_ROOT_NAME}
      wireframe={wireframe}
      rotationY={getModelPreviewYaw(entry.category)}
      anchor="native"
      groupRef={group}
    />
  )
}

export interface ModelViewerProps {
  entry: PirateNationModelEntry
  /** Collision counterpart (`…-collision` GLB) when the pack ships one. */
  collisionEntry?: PirateNationModelEntry | null
}

export function ModelViewer({ entry, collisionEntry = null }: ModelViewerProps) {
  const [clips, setClips] = useState<string[]>([])
  const [clip, setClip] = useState<string | null>(null)
  const [turntable, setTurntable] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [showCollision, setShowCollision] = useState(false)
  const [showPivot, setShowPivot] = useState(false)
  // The entry the canvas actually renders: the collision GLB when toggled.
  // Turntable/wireframe intentionally persist across the swap.
  const activeEntry = showCollision && collisionEntry ? collisionEntry : entry
  // drei tracks the shared three.js loading manager — true while the GLB
  // fetch/parse is in flight. Shown as an overlay so the canvas never sits
  // as a silent black box mid-load.
  const loading = useProgress((state) => state.active)
  // Translucent and dark art (e.g. the ghost species) disappears on the dark
  // stage — the light backdrop makes it inspectable.
  const [backdrop, setBackdrop] = useState<'dark' | 'light'>('dark')
  const stageColors = STAGE_COLORS[backdrop]

  // Pack models span a buoy to a 256-unit kraken, so the shadow rig scales
  // with the subject: a fixed ±5-unit frustum would clip big models to a
  // slice, and an unscaled normalBias shows up as diagonal shadow acne on
  // their flat voxel faces.
  const maxDim = Math.max(...activeEntry.bounds.size)
  const lightDir = new Vector3(5, 8, 6).normalize().multiplyScalar(maxDim * 1.6)

  // Reset per-model viewer state; the animation list arrives after load.
  useEffect(() => {
    setClips([])
    setClip(null)
    setTurntable(false)
    setWireframe(false)
    setShowCollision(false)
    setShowPivot(false)
  }, [entry.id])

  return (
    <div className="model-viewer">
      {loading && <div className="viewer-loading">Loading model…</div>}
      <PackCanvas
        backdrop={backdrop}
        lights={
          <>
            <ambientLight intensity={1.1} />
            <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
            <directionalLight
              castShadow
              intensity={2.0}
              position={[lightDir.x, lightDir.y, lightDir.z]}
              shadow-mapSize={[2048, 2048]}
              shadow-normalBias={maxDim * 0.004}
              shadow-camera-left={-maxDim}
              shadow-camera-right={maxDim}
              shadow-camera-top={maxDim}
              shadow-camera-bottom={-maxDim}
              shadow-camera-far={maxDim * 8}
            />
          </>
        }
      >
        <Suspense fallback={null}>
          <ModelScene
            entry={activeEntry}
            clip={clip}
            turntable={turntable}
            wireframe={wireframe}
            onAnimations={setClips}
          />
        </Suspense>
        <gridHelper
          args={[40, 40, stageColors.gridMain, stageColors.gridMinor]}
          position={[0, -0.001, 0]}
        />
        {showPivot && <axesHelper args={[Math.max(maxDim * 0.25, 2)]} position={[0, 0, 0]} />}
        <FitCamera rootName={MODEL_VIEWER_ROOT_NAME} fitKey={activeEntry.id} targetMode="pivot" />
        <OrbitControls makeDefault />
      </PackCanvas>

      <div className="viewer-controls">
        {clips.length > 0 && (
          <label className="viewer-control">
            <span>Animation ({clips.length})</span>
            <select value={clip ?? ''} onChange={(event) => setClip(event.target.value || null)}>
              <option value="">— none —</option>
              {clips.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className={turntable ? 'toggle active' : 'toggle'}
          onClick={() => setTurntable((value) => !value)}
        >
          Turntable
        </button>
        <button
          type="button"
          className={wireframe ? 'toggle active' : 'toggle'}
          onClick={() => setWireframe((value) => !value)}
        >
          Wireframe
        </button>
        <button
          type="button"
          className={showPivot ? 'toggle active' : 'toggle'}
          onClick={() => setShowPivot((value) => !value)}
        >
          Pivot
        </button>
        {collisionEntry && (
          <button
            type="button"
            className={showCollision ? 'toggle active' : 'toggle'}
            onClick={() => setShowCollision((value) => !value)}
          >
            Collision
          </button>
        )}
        <button
          type="button"
          className="toggle"
          onClick={() => setBackdrop((value) => (value === 'dark' ? 'light' : 'dark'))}
        >
          {backdrop === 'dark' ? 'Light stage' : 'Dark stage'}
        </button>
      </div>
    </div>
  )
}
