/**
 * Scene — several pack models in one shot.
 *
 * The point of this tab is the thing a single-model viewer cannot show: pack
 * models span roughly 94x in size and most do not sit on y=0, so putting them
 * together needs `layoutRow` to normalise and ground them. Change the category
 * and the row recomposes.
 */
import { OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { isCollisionModel, loadModels, type PirateNationModelEntry } from '../catalog'
import { FitCamera, layoutRow, PackCanvas, PackModel, STAGE_COLORS, ViewerErrorBoundary } from '../pack3d'

const SCENE_ROOT_NAME = 'showcase-scene-root'
/** Every model is normalised to this largest dimension, in world units. */
const FIT = 4
const GAP = 1.2
const COUNT = 5

export function SceneStage() {
  const [models, setModels] = useState<PirateNationModelEntry[]>([])
  const [category, setCategory] = useState('ships')
  const [seed, setSeed] = useState(0)
  const [backdrop, setBackdrop] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    loadModels().then((all) => setModels(all.filter((entry) => !isCollisionModel(entry))))
  }, [])

  const categories = useMemo(
    () => [...new Set(models.map((entry) => entry.category))].sort(),
    [models],
  )

  const cast = useMemo(() => {
    const pool = models.filter((entry) => entry.category === category)
    // Rotate a deterministic window through the pool: "Reshuffle" must be
    // repeatable so a broken row can be described and reproduced.
    return Array.from({ length: Math.min(COUNT, pool.length) }, (_, i) => pool[(seed * COUNT + i) % pool.length]!)
  }, [models, category, seed])

  const placements = useMemo(
    () => layoutRow(cast.map((entry) => ({ id: entry.id, bounds: entry.bounds })), { fit: FIT, gap: GAP }),
    [cast],
  )

  const sceneKey = placements.map((p) => p.id).join('|')

  return (
    <div className="scene-stage">
      <div className="scene-controls">
        <label className="viewer-control">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="toggle" onClick={() => setSeed((value) => value + 1)}>
          Reshuffle
        </button>
        <button
          type="button"
          className="toggle"
          onClick={() => setBackdrop((value) => (value === 'dark' ? 'light' : 'dark'))}
        >
          {backdrop === 'dark' ? 'Light stage' : 'Dark stage'}
        </button>
        <span className="scene-count">{placements.length} models, normalised to {FIT} units</span>
      </div>

      <ViewerErrorBoundary key={sceneKey}>
        <PackCanvas
          backdrop={backdrop}
          lights={
            <>
              <ambientLight intensity={1.1} />
              <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
              <directionalLight
                castShadow
                intensity={2.0}
                position={[8, 14, 10]}
                shadow-mapSize={[2048, 2048]}
                shadow-normalBias={0.02}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
                shadow-camera-far={60}
              />
            </>
          }
        >
          <group name={SCENE_ROOT_NAME}>
            <Suspense fallback={null}>
              {/* `layoutRow` already solved the x spacing; `PackModel` re-derives
                  the scale and the grounding offset from the same bounds, so only
                  the row position is passed through. */}
              {cast.map((entry, index) => (
                <PackModel
                  key={entry.id}
                  entry={entry}
                  fit={FIT}
                  anchor="base"
                  at={[placements[index]!.position[0], 0, 0]}
                />
              ))}
            </Suspense>
          </group>
          <mesh position={[0, -0.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color={STAGE_COLORS[backdrop].floor} />
          </mesh>
          <gridHelper
            args={[200, 100, STAGE_COLORS[backdrop].gridMain, STAGE_COLORS[backdrop].gridMinor]}
            position={[0, 0, 0]}
          />
          <FitCamera rootName={SCENE_ROOT_NAME} fitKey={sceneKey} margin={1.4} />
          <OrbitControls makeDefault />
        </PackCanvas>
      </ViewerErrorBoundary>
    </div>
  )
}
