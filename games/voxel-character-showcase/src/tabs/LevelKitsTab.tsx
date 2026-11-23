import { Html, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import type { MeshStandardMaterial } from 'three'
import { ZodError } from 'zod'
import type { LevelPropEntry } from '@voxchar/contracts/catalog'
import { BUDGETS } from '@voxchar/contracts/budgets'
import { levelKitsSchema, resolveLevelKits, type ResolvedLevelKit } from '@voxchar/contracts/levelKits'
import { VOXCHAR_PACK_KEYS, type VoxCharPackKey } from '@voxchar/contracts/packs'
import { PolyProp } from '../avatar/PolyAvatar'
import type { PolyPartIndex } from '../avatar/composePolyAvatar'
import { clearFailedGltfLoads } from '../avatar/polyRig'
import { createPolyMaterial } from '../avatar/polyMaterial'
import type { PolyCatalogBundle } from '../catalog'
import PALETTES from '@voxchar/contracts/data/level-palettes.json'
import { LevelLightingEffects } from '../scenes/LevelLightingEffects'
import { LevelWorkstations } from '../scenes/LevelWorkstations'
import { LevelInstances, LevelVoxelInstances, type LevelPlacement } from '../scenes/LevelInstances'
import { createLevelSky } from '../scenes/levelSky'
import { STUDIO_GL, StudioLights } from '../scenes/studio'
import { useLevelVoxels } from '../scenes/useLevelVoxels'
import { useLevelWater } from '../scenes/useLevelWater'
import { KitVehicle } from './KitVehicle'

const PACK_LABELS = {
  core: 'Core',
  heist: 'Heist',
  industrial: 'Industrial',
  security: 'Security',
  creatures: 'Creatures',
  fantasy: 'Fantasy',
} satisfies Record<VoxCharPackKey, string>

type Viewpoint = Pick<ResolvedLevelKit['view'], 'eye' | 'target'>

type LevelLight = {
  zenith: string
  horizon: string
  sun: [number, number, number, string]
  fixtures: [position: [number, number, number], color: string][]
}

const LEVEL_LIGHTS: Record<VoxCharPackKey, LevelLight> = {
  core: {
    zenith: '#6f8eaa', horizon: '#d5d4c2', sun: [-2.1, 2.2, 1.8, '#ffe6bc'],
    fixtures: [[[-6, 2.35, -3.55], '#ffce8a'], [[3.6, 2.7, -5.8], '#b7d6ff']],
  },
  heist: {
    zenith: '#6e7f9a', horizon: '#d8bb9e', sun: [-2.5, 1.5, 1.3, '#ffcd9c'],
    fixtures: [[[-3.8, 2.1, -5.1], '#ffd798'], [[6.25, 2.2, -2.1], '#ffbe77']],
  },
  industrial: {
    zenith: '#77919f', horizon: '#c4cdd0', sun: [2.15, 1.85, 1.15, '#fff0d2'],
    fixtures: [[[-2.2, 3.18, -3.3], '#ffd48d'], [[2.1, 2.55, -3.0], '#8cc8ff']],
  },
  security: {
    zenith: '#334758', horizon: '#859db1', sun: [-2, 2.4, 1.3, '#dbeaff'],
    fixtures: [[[-0.55, 2.7, 2.26], '#97c8e5'], [[-0.6, 2.5, -1.1], '#7fd9ff'], [[1.65, 2.05, -2.2], '#ffcf8a'], [[0, 2.2, -5.0], '#a2e5ff']],
  },
  creatures: {
    zenith: '#5e8fa0', horizon: '#cccfac', sun: [-2.4, 2.0, 1.05, '#ffe4ab'],
    fixtures: [[[-1.75, 3.35, -4.45], '#ffd08b'], [[-5.85, 1.85, -3.35], '#ffd18a']],
  },
  fantasy: {
    zenith: '#6f758d', horizon: '#d6ad88', sun: [-2.3, 1.6, 1.65, '#ffd4a5'],
    fixtures: [[[0.32, 2.25, -4.95], '#ffc075'], [[4.2, 2.0, -3.32], '#dcafff'], [[-2.7, 1.8, 1.65], '#ffd28f']],
  },
}

function LevelEnvironment({ pack, reach, eyeLevel, fixtures, environment }: {
  pack: VoxCharPackKey
  reach: number
  eyeLevel: boolean
  fixtures: ResolvedLevelKit['fixtures']
  environment: ResolvedLevelKit['environment']
}) {
  const legacy = LEVEL_LIGHTS[pack]
  const { zenith, horizon } = environment ?? legacy
  const defaultFixtures = legacy.fixtures
  const lights = fixtures ?? defaultFixtures.map(([position, color]) => ({ position, color, intensity: 8, distance: 4.5 }))
  const shadowSize = useThree((state) => state.size.width < 640 ? 1024 : 2048)
  const [x, y, z] = environment?.sunDirection ?? legacy.sun
  const sky = useMemo(
    () => eyeLevel ? createLevelSky(zenith, horizon, [x, y, z]) : undefined,
    [eyeLevel, zenith, horizon, x, y, z],
  )
  useEffect(() => () => sky?.dispose(), [sky])

  const color = environment?.sunColor ?? legacy.sun[3]
  const sunIntensity = environment?.sunIntensity ?? (pack === 'security' ? 1.55 : 2.75)
  const hemisphere: [string, string, number] = environment
    ? [environment.skyFill, environment.groundFill, environment.fillIntensity]
    : ['#b5cfed', '#746447', pack === 'security' ? 0.64 : 1.04]
  const shadowRadius = 1.12 * reach
  return (
    <>
      {sky ? <primitive attach="background" object={sky} /> : <color attach="background" args={['#101925']} />}
      {eyeLevel && (environment
        ? <fogExp2 attach="fog" args={[horizon, environment.fogDensity]} />
        : <fog attach="fog" args={[horizon, 9, 31]} />)}
      <hemisphereLight args={hemisphere} />
      <directionalLight
        position={[x * reach, y * reach, z * reach]}
        color={color}
        intensity={sunIntensity}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-shadowRadius}
        shadow-camera-right={shadowRadius}
        shadow-camera-top={shadowRadius}
        shadow-camera-bottom={-shadowRadius}
        shadow-camera-far={7 * reach}
        shadow-normalBias={0.02}
        shadow-bias={-0.0002}
      />
      {lights.map(({ position, color, intensity, distance }) => (
        <pointLight key={position.join(',')} position={position} color={color} intensity={intensity} distance={distance} />
      ))}
    </>
  )
}

type KitState = { kind: 'loading' } | { kind: 'ready'; levels: ReturnType<typeof resolveLevelKits> } | { kind: 'error'; detail: string }

function describeIssue(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    if (issue) return `Invalid layout at ${issue.path.join('.') || 'the root'}. ${issue.message}`
  }
  return error instanceof Error ? error.message : 'Unknown error.'
}

class SceneBoundary extends Component<{ children: ReactNode; sceneKey: string }, { detail: string | null }> {
  state: { detail: string | null } = { detail: null }

  static getDerivedStateFromError(error: unknown) {
    return { detail: describeIssue(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Could not render the Cubix level kit:', this.props.sceneKey, error, info.componentStack)
  }

  componentDidUpdate(previous: Readonly<{ sceneKey: string }>) {
    if (this.state.detail !== null && previous.sceneKey !== this.props.sceneKey) {
      this.setState({ detail: null })
    }
  }

  render() {
    return this.state.detail !== null
      ? (
        <div className="level-kit-status" role="alert">
          <span>Could not load the level models. {this.state.detail}</span>
          <button className="pill-btn" onClick={() => {
            clearFailedGltfLoads()
            this.setState({ detail: null })
          }}>Retry models</button>
        </div>
      )
      : this.props.children
  }
}

function KitCamera({ subject, view, viewpoint }: {
  subject?: LevelPropEntry
  view?: ResolvedLevelKit['view']
  viewpoint?: Viewpoint
}) {
  const { width, height } = useThree((state) => state.size)
  const [x, z] = subject || !view ? [0, 0] : view.center
  const targetY = subject ? subject.bounds.size[1] / 2 : 0
  const extent = subject ? Math.max(...subject.bounds.size) : Math.max(...(view?.size ?? [12]))
  const zoom = Math.min(width / (extent * 1.39), height / (extent * 1.09))

  if (viewpoint && !subject) {
    return (
      <>
        <PerspectiveCamera makeDefault position={viewpoint.eye} fov={54} near={0.04} far={100} />
        <OrbitControls makeDefault target={viewpoint.target} minDistance={0.5} maxDistance={30} enableDamping />
      </>
    )
  }

  const distance = subject ? 1 : Math.max(1, extent / 16)
  return (
    <>
      <OrthographicCamera makeDefault position={[x + 7 * distance, (subject?.motion ? 4 : 7 * distance) + targetY, z + 12 * distance]} zoom={zoom} near={0.1} far={100} />
      <OrbitControls makeDefault target={[x, targetY, z]} minZoom={zoom * 0.65} maxZoom={zoom * 5} enableDamping />
    </>
  )
}

function LevelShadowCache({ revision }: { revision: string }) {
  const { gl, invalidate } = useThree()
  const mobileShadow = useThree(state => state.size.width < 640)
  useLayoutEffect(() => {
    const previous = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    invalidate()
    return () => {
      gl.shadowMap.autoUpdate = previous
      gl.shadowMap.needsUpdate = true
      invalidate()
    }
  }, [gl, invalidate, mobileShadow, revision])
  return null
}

function KitModels({ pack, layout, subject, motion, lightsOn, eyeLevel, renderer, optimized }: {
  pack: VoxCharPackKey
  layout?: ResolvedLevelKit
  subject?: LevelPropEntry
  motion: string
  lightsOn: boolean
  eyeLevel: boolean
  renderer: 'mesh' | 'voxel'
  optimized: boolean
}) {
  const raw = useLevelVoxels(renderer === 'voxel' && layout && !subject ? pack : undefined)
  const groups = useMemo(() => {
    const byId = new Map<string, { item: LevelPropEntry; placements: LevelPlacement[] }>()
    for (const placement of layout?.placements ?? []) {
      const group = byId.get(placement.item.id)
      if (group) group.placements.push(placement)
      else byId.set(placement.item.id, { item: placement.item, placements: [placement] })
    }
    return [...byId.values()]
  }, [layout])
  const reflection = useLevelWater(layout, eyeLevel && !subject)
  const materials = useMemo(() => {
    const base = createPolyMaterial(PALETTES[pack], 'level', optimized)
    const overrides = new Map<string, MeshStandardMaterial>()
    const models = subject ? [subject] : groups.map(({ item }) => item)
    const { zenith, horizon } = layout?.environment ?? LEVEL_LIGHTS[pack]
    for (const item of models) {
      if (item.palette || item.surface) {
        const surface = item.surface === 'water' ? { water: { zenith, horizon, reflection } } : item.surface ?? 'level'
        overrides.set(item.id, createPolyMaterial({ ...PALETTES[pack], ...item.palette }, surface, optimized))
      }
    }
    return { base, overrides }
  }, [groups, layout?.environment, optimized, pack, reflection, subject])
  useEffect(() => () => {
    materials.base.dispose()
    for (const material of materials.overrides.values()) material.dispose()
  }, [materials])

  if (subject?.motion) {
    return (
      <>
        <KitVehicle item={subject} path={subject.motion.relativePath} clipName={motion} lightsOn={lightsOn} />
        <mesh position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[24, 24]} />
          {lightsOn ? <meshStandardMaterial color="#222e3b" roughness={0.88} /> : <shadowMaterial opacity={0.38} />}
        </mesh>
      </>
    )
  }
  if (subject) return <PolyProp item={subject} material={materials.overrides.get(subject.id) ?? materials.base} blobShadow />

  if (renderer === 'voxel') {
    if (raw?.kind === 'error') throw new Error(raw.message)
    if (!raw) return <Html center><span className="level-kit-status level-kit-status-overlay" role="status">Loading voxel models…</span></Html>
  }

  return groups.map(({ item, placements }) => {
    const material = materials.overrides.get(item.id) ?? materials.base
    const mesh = raw?.kind === 'ready' ? raw.meshes[item.id] : undefined
    if (renderer === 'voxel') {
      if (!mesh) throw new Error(`Missing voxel prefab ${item.id}.`)
      return <LevelVoxelInstances key={item.id} item={item} placements={placements} material={material}
        mesh={mesh} />
    }
    return <LevelInstances key={item.id} item={item} placements={placements} material={material} />
  })
}

export function LevelKitsTab({ bundle, index }: { bundle: PolyCatalogBundle; index: PolyPartIndex }) {
  const [state, setState] = useState<KitState>({ kind: 'loading' })
  const [layoutAttempt, setLayoutAttempt] = useState(0)
  const [pack, setPack] = useState<VoxCharPackKey>('core')
  const [selected, setSelected] = useState('')
  const [motion, setMotion] = useState('')
  const [lightsOn, setLightsOn] = useState(false)
  const [viewIndex, setViewIndex] = useState(0)
  const [renderer, setRenderer] = useState<'mesh' | 'voxel'>('mesh')
  const [optimized, setOptimized] = useState(false)
  const items = useMemo(() => new Map(
    bundle.packs[pack].levelKitProps
      .map((prop) => [prop.id, prop]),
  ), [bundle, pack])
  const subject = items.get(selected)
  const sceneKey = `${pack}:${selected}`

  useEffect(() => {
    const controller = new AbortController()
    fetch('catalog/level-scenes.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Level layout request failed (${response.status})`)
        return response.json()
      })
      .then((json: unknown) => {
        const levels = resolveLevelKits(levelKitsSchema.parse(json), VOXCHAR_PACK_KEYS.map((key) => bundle.packs[key]))
        if (!controller.signal.aborted) setState({ kind: 'ready', levels })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('Could not load the Cubix level layouts:', error)
        setState({ kind: 'error', detail: describeIssue(error) })
      })
    return () => controller.abort()
  }, [bundle, layoutAttempt])

  const layout = state.kind === 'ready' ? state.levels.get(pack) : undefined
  const view = layout?.view
  const stops = view?.stops ?? []
  const viewStop = stops[viewIndex - 2]
  const viewpoint = viewIndex === 0 ? undefined : viewStop ?? view
  const sceneReach = view ? Math.hypot(
    Math.abs(view.center[0]) + view.size[0] / 2,
    Math.abs(view.center[1]) + view.size[1] / 2,
  ) : 6
  const lightReach = subject ? Math.max(1, ...subject.bounds.size) : sceneReach
  const size = subject?.bounds.size.map((metres) => metres.toFixed(1)).join(' × ')

  function selectProp(id: string) {
    setSelected(id)
    setMotion('')
    setLightsOn(false)
  }

  return (
    <section className="level-kit" aria-label="Cubix level kits">
      <div className="level-kit-controls">
        <div className="level-kit-packs" role="group" aria-label="Prop pack">
          {VOXCHAR_PACK_KEYS.map((key) => (
            <button
              key={key}
              className={`pill-btn ${key === pack ? 'active' : ''}`}
              aria-pressed={key === pack}
              onClick={() => { setPack(key); setViewIndex(0); selectProp('') }}
            >
              {PACK_LABELS[key]}
            </button>
          ))}
        </div>
        {layout && !subject && (
          <label className="level-kit-picker">
            Viewpoint
            <select value={viewIndex} onChange={(event) => setViewIndex(Number(event.target.value))}>
              <option value={0}>Overview</option>
              <option value={1}>Approach</option>
              {stops.map((stop, index) => <option key={index} value={index + 2}>{stop.label}</option>)}
            </select>
          </label>
        )}
        {layout && !subject && (
          <>
            <label className="level-kit-picker">
              Renderer
              <select value={renderer} onChange={(event) => setRenderer(event.target.value === 'voxel' ? 'voxel' : 'mesh')}>
                <option value="mesh">Mesh</option>
                <option value="voxel">Voxel</option>
              </select>
            </label>
            <label className="level-kit-picker">
              <input type="checkbox" checked={optimized} onChange={(event) => setOptimized(event.target.checked)} />
              Optimized rendering
            </label>
          </>
        )}
        <label className="level-kit-picker">
          Inspect prop
          <select value={selected} onChange={(event) => selectProp(event.target.value)}>
            <option value="">Full demo scene</option>
            {[...items.values()].map((prop) => <option key={prop.id} value={prop.id}>{prop.label}</option>)}
          </select>
        </label>
        {subject?.motion && (
          <label className="level-kit-picker">
            Vehicle motion
            <select value={motion} onChange={(event) => setMotion(event.target.value)}>
              <option value="">Parked</option>
              {subject.motion.clips.map((clip) => <option key={clip}>{clip}</option>)}
            </select>
          </label>
        )}
        {subject?.motion && subject.motion.lights.length > 0 && (
          <button className={lightsOn ? 'pill-btn active' : 'pill-btn'} aria-pressed={lightsOn}
            onClick={() => setLightsOn((enabled) => !enabled)}>Vehicle lights</button>
        )}
      </div>
      <div className="level-kit-caption">
        <h2>{subject?.label ?? layout?.title ?? 'Level kits'}</h2>
        {subject && <p>{size} m · {subject.triangles} triangles</p>}
        {!subject && layout && <p>{items.size} props · {layout.route}</p>}
      </div>
      {layout || subject ? (
        <SceneBoundary sceneKey={`${sceneKey}:${renderer}`}>
          <div className="level-kit-view">
            <Canvas dpr={[1, BUDGETS.mobilePolicy.maxDpr]} gl={STUDIO_GL} shadows frameloop="demand">
              {subject ? (
                <>
                  <color attach="background" args={['#101925']} />
                  <StudioLights reach={lightReach} heroShadows />
                </>
              ) : (
                <LevelEnvironment pack={pack} reach={lightReach} eyeLevel={viewpoint !== undefined}
                  fixtures={layout?.fixtures} environment={layout?.environment} />
              )}
              <KitCamera key={`${sceneKey}:${viewIndex}`} subject={subject} view={view} viewpoint={viewpoint} />
              {!subject && viewpoint && <LevelLightingEffects />}
              {!subject && optimized && <LevelShadowCache revision={`${pack}:${renderer}:${viewIndex}`} />}
              <Suspense fallback={<Html center><span className="level-kit-status level-kit-status-overlay" role="status">Loading models…</span></Html>}>
                <KitModels key={sceneKey} pack={pack} layout={layout} subject={subject} motion={motion}
                  lightsOn={lightsOn} eyeLevel={viewpoint !== undefined} renderer={renderer} optimized={!subject && optimized} />
              </Suspense>
              <Suspense fallback={null}>
                {!subject && <LevelWorkstations pack={pack} stop={viewStop?.label} bundle={bundle} index={index} />}
              </Suspense>
            </Canvas>
          </div>
        </SceneBoundary>
      ) : state.kind === 'error' ? (
        <div className="level-kit-status" role="alert">
          <span>Could not load level kit layouts. {state.detail}</span>
          <button className="pill-btn" onClick={() => {
            setState({ kind: 'loading' })
            setLayoutAttempt((attempt) => attempt + 1)
          }}>Retry layouts</button>
        </div>
      ) : (
        <p className="level-kit-status" role="status">Loading level kits…</p>
      )}
    </section>
  )
}
