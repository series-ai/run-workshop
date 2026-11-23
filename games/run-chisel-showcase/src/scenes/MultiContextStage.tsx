import { LanternExchangeSet } from './LanternExchangeSet'
import { Html, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { Color, MathUtils, OrthographicCamera, PerspectiveCamera as ThreePerspectiveCamera, Vector3 } from 'three'
import type { ConstructionLayout } from '@chisel/contracts/constructionKit'
import type { PackCatalog, WorldPropEntry } from '@chisel/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@chisel/contracts/packs'
import { PALETTE_REGIONS } from '@chisel/contracts/palette'
import { PolyAvatar, PolyProp } from '../avatar/PolyAvatar'
import { selectionFromPreset, type PolyPartIndex } from '../avatar/composePolyAvatar'
import { createPolyMaterial, type PolyOptics } from '../avatar/polyMaterial'
import { DIORAMA_SPACING, isFloorTileId, SCENE_BACKDROPS, SCENE_DEPTH, SCENE_LAYOUTS, SCENE_WIDTH, type ContextSceneLayout, type PropPlacement } from './sceneLayouts'
import { SCENE_CAMERAS, stagePropKind, stagePropPalette, STAGE_LOOK, type StageContext } from './stageLook'
import { ContextTerrain } from './sceneTerrain'
import { CornerCafeSkyline } from './CornerCafeSkyline'
import { StageTileBatch } from './StageTileBatch'
import { StagePropShadows } from './StagePropShadows'
import { COLOR_DIRECTION, propPaletteFor } from '@chisel/contracts/colorDirection'

export interface MultiContextStageProps {
  catalogs: PackCatalog[]
  index: PolyPartIndex
  activeContext: StageContext
  shadowMode: 'blob' | 'none'
  closeView: boolean
  kitLayout?: ConstructionLayout
  showRoofs?: boolean
}

const AMBIENT_CLIP_ORDER = ['Idle', 'Hover', 'Spin', 'Sweep', 'Swing', 'Loop', 'Pulse', 'Active', 'Open', 'Closed', 'Down', 'Armed']
// Bound each batch so the camera can cull tiles beyond its view.
const TILE_BATCH_SPAN = 6
const STAGE_OPTICS: Readonly<Partial<Record<string, PolyOptics>>> = {
  prop_city_bus: { glass: 0.75 },
  prop_corner_bistro: { glass: 0.42 },
  prop_market_bakery: { glass: 0.40 },
  prop_lantern_span: { glow: { region: 'accent', strength: 0.36 } },
  prop_arcade_cabinet: { glow: { region: 'eye', strength: 0.19 } },
}

function pickAmbientClip(prop: WorldPropEntry): string | undefined {
  const clips = prop.clips
  if (!clips || clips.length === 0) return undefined
  for (const candidate of AMBIENT_CLIP_ORDER) {
    if (clips.includes(candidate)) return candidate
  }
  return clips[0]
}

function Diorama({
  catalog,
  index,
  blobShadow,
  label,
  showBackdrop,
  kitLayout,
  showRoofs,
}: {
  catalog: PackCatalog
  index: PolyPartIndex
  blobShadow: boolean
  label: boolean
  showBackdrop: boolean
  kitLayout?: ConstructionLayout
  showRoofs?: boolean
}) {
  const context = catalog.pack as ContextPackKey
  const layout = useMemo<ContextSceneLayout>(
    () => kitLayout
      ? { ...kitLayout, props: showRoofs ? kitLayout.props : kitLayout.props.filter(({ hideWithRoof }) => !hideWithRoof), avatars: [] }
      : SCENE_LAYOUTS[context],
    [context, kitLayout, showRoofs],
  )
  const placements = useMemo(
    () => showBackdrop ? [...layout.props, ...SCENE_BACKDROPS[context]] : layout.props,
    [context, layout.props, showBackdrop],
  )
  const avatarPlans = useMemo(() => {
    const byId = new Map(catalog.presets.map((p) => [p.id, p]))
    return layout.avatars.map((slot, i) => {
      const preset = slot.presetId !== undefined ? byId.get(slot.presetId) : catalog.presets[i]
      if (!preset) throw new Error(`Missing avatar preset "${slot.presetId ?? i}" in "${context}" catalog.`)
      const base = selectionFromPreset(preset)
      return {
        key: `${preset.id}-${i}`,
        slot,
        selection: {
          ...base,
          clip: slot.clip ?? base.clip,
          palette: slot.palette ? { ...base.palette, ...slot.palette } : base.palette,
          heldRight: slot.unarmed ? null : base.heldRight,
          heldLeft: slot.heldLeft ?? (slot.unarmed ? null : base.heldLeft),
        },
      }
    })
  }, [catalog, context, layout.avatars])
  const propById = useMemo(() => new Map(catalog.props.map((p) => [p.id, p])), [catalog.props])
  const materials = useMemo(() => {
    const result: Record<string, ReturnType<typeof createPolyMaterial>> = {
      base: createPolyMaterial(kitLayout ? COLOR_DIRECTION.packs[context].props.default : stagePropPalette(context, 'base')),
      floor: createPolyMaterial(stagePropPalette(context, 'floor')),
      structure: createPolyMaterial(stagePropPalette(context, 'structure')),
      life: createPolyMaterial(stagePropPalette(context, 'life')),
    }
    const overrides = COLOR_DIRECTION.packs[context].props.overrides
    for (const { id } of placements) {
      const palette = overrides[id]
      const optics = STAGE_OPTICS[id]
      if ((palette || optics) && !result[id]) {
        const colors = palette || kitLayout ? propPaletteFor(context, id) : stagePropPalette(context, stagePropKind(id, isFloorTileId(id)))
        result[id] = createPolyMaterial(colors, optics)
      }
    }
    const tint = new Color(STAGE_LOOK[context].glow)
    const { backdropTint } = COLOR_DIRECTION.packs[context].stage.environment
    for (const { id } of placements.slice(layout.props.length)) {
      const key = `backdrop:${id}`
      if (result[key]) continue
      const kind = stagePropKind(id, isFloorTileId(id))
      const source = overrides[id] ? propPaletteFor(context, id) : stagePropPalette(context, kind)
      const palette = { ...source }
      for (const role of PALETTE_REGIONS) {
        palette[role] = `#${new Color(source[role]).lerp(tint, backdropTint).getHexString()}`
      }
      result[key] = createPolyMaterial(palette)
    }
    return result
  }, [context, layout.props.length, kitLayout, placements])
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials])

  const propGroups = useMemo(() => {
    const groups = new Map<string, {
      item: WorldPropEntry
      material: ReturnType<typeof createPolyMaterial>
      firstIndex: number
      placements: PropPlacement[]
    }>()
    placements.forEach((placement, i) => {
      const item = propById.get(placement.id)
      if (!item) throw new Error(`Missing prop "${placement.id}" in "${context}" catalog.`)
      const floor = isFloorTileId(item.id)
      const materialKey = i >= layout.props.length ? `backdrop:${item.id}`
        : materials[item.id] ? item.id : kitLayout ? 'base' : stagePropKind(item.id, floor)
      const [x, , z] = placement.position
      const column = Math.floor(x / TILE_BATCH_SPAN)
      const row = Math.floor(z / TILE_BATCH_SPAN)
      const key = (floor || kitLayout) && !item.clips?.length && !placement.clip ? `${materialKey}/${item.id}/${column}/${row}` : String(i)
      const group = groups.get(key)
      if (group) group.placements.push(placement)
      else groups.set(key, { item, material: materials[materialKey]!, firstIndex: i, placements: [placement] })
    })
    return groups
  }, [context, kitLayout, layout.props.length, materials, placements, propById])

  return (
    <group>
      {!kitLayout && <ContextTerrain context={context} width={layout.width} depth={layout.depth} />}
      {showBackdrop && (
        <mesh position={[0, -0.025, -50]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial color={STAGE_LOOK[context].ground[0]} roughness={1} />
        </mesh>
      )}
      {context === 'cyberpunk' && showBackdrop && <LanternExchangeSet />}
      {context === 'sim' && showBackdrop && <CornerCafeSkyline />}
      {blobShadow && <StagePropShadows placements={layout.props} props={propById} />}
      {avatarPlans.map(({ key, slot, selection }, i) => (
        <PolyAvatar
          key={key}
          selection={selection}
          index={index}
          blobShadow={blobShadow && !slot.insideProp && slot.position[1] < 0.6}
          position={[slot.position[0], slot.position[1], slot.position[2]]}
          rotation={[0, slot.rotationY, 0]}
          timeOffset={slot.timeOffset ?? i * 0.7}
          holdPhase={slot.holdPhase}
        />
      ))}
      {Array.from(propGroups, ([key, { item, material, firstIndex, placements: tiles }]) => {
        if (tiles.length > 1) return <StageTileBatch key={key} item={item} material={material} tiles={tiles} />
        const placement = tiles[0]!
        return (
          <PolyProp
            key={key}
            item={item}
            material={material}
            position={[placement.position[0], placement.position[1], placement.position[2]]}
            rotation={[0, placement.rotationY ?? 0, 0]}
            scale={placement.scale && [...placement.scale]}
            clip={placement.clip ?? pickAmbientClip(item)}
            timeOffset={placement.timeOffset ?? firstIndex * 0.45}
          />
        )
      })}
      {label && (
        <Html position={[0, -0.45, layout.depth / 2 + 0.45]} center className="stage-scene-label" style={{ pointerEvents: 'none' }}>
          {catalog.label}
        </Html>
      )}
    </group>
  )
}

function StageLights({ context }: { context: StageContext }) {
  const look = STAGE_LOOK[context]
  const night = context === 'cyberpunk' || context === 'monsters'
  const practicals = context === 'all' ? [] : COLOR_DIRECTION.packs[context].stage.practicals
  return (
    <>
      <hemisphereLight args={[look.fill, COLOR_DIRECTION.ambientGround, night ? 0.82 : 1.15]} />
      <directionalLight position={[-5, 9, 4]} intensity={night ? 1.65 : 2.9} color={look.key} />
      {practicals.map((light) => <pointLight key={light.position.join(',')} {...light} />)}
      {context === 'monsters' && <directionalLight position={[4, 6, -6]} intensity={1.35} color={look.rim} />}
      {!night && (
        <>
          <directionalLight position={[4, 3, 3]} intensity={0.56} color={look.fill} />
          <directionalLight position={[4, 6, -6]} intensity={1.4} color={look.rim} />
        </>
      )}
    </>
  )
}

const ROW_GAP = SCENE_DEPTH + 5
const STAGE_BOTTOM = -0.8

function stageFrame(context: StageContext, columns: number, catalog?: PackCatalog, kitLayout?: ConstructionLayout) {
  const direction = new Vector3(...(kitLayout?.view ?? STAGE_LOOK[context].view)).normalize()
  const right = new Vector3(0, 1, 0).cross(direction).normalize()
  const up = new Vector3().crossVectors(direction, right)
  const point = new Vector3()
  let left = Infinity
  let low = Infinity
  let rightmost = -Infinity
  let high = -Infinity

  const include = (
    min: readonly [number, number, number],
    max: readonly [number, number, number],
    position: readonly [number, number, number] = [0, 0, 0],
    rotation = 0,
    scale: readonly [number, 1, number] = [1, 1, 1],
  ) => {
    const sin = Math.sin(rotation)
    const cos = Math.cos(rotation)
    for (const x of [min[0], max[0]]) {
      for (const y of [min[1], max[1]]) {
        for (const z of [min[2], max[2]]) {
          point.set(
            position[0] + cos * x * scale[0] + sin * z * scale[2],
            position[1] + y,
            position[2] - sin * x * scale[0] + cos * z * scale[2],
          )
          const horizontal = right.dot(point)
          const vertical = up.dot(point)
          left = Math.min(left, horizontal)
          rightmost = Math.max(rightmost, horizontal)
          low = Math.min(low, vertical)
          high = Math.max(high, vertical)
        }
      }
    }
  }

  if (context === 'all') {
    const rows = Math.ceil(CONTEXT_PACK_KEYS.length / columns)
    const width = (columns - 1) * DIORAMA_SPACING + SCENE_WIDTH
    const depth = (rows - 1) * ROW_GAP + SCENE_DEPTH + 1
    include([-width / 2, STAGE_BOTTOM, -depth / 2], [width / 2, 5, depth / 2])
  } else {
    const layout = kitLayout ?? SCENE_LAYOUTS[context]
    if (!kitLayout || !catalog) {
      const x = layout.width / 2 + 0.15
      const z = layout.depth / 2 + 0.15
      include([-x, STAGE_BOTTOM, -z], [x, 0, z])
    }
    const props = new Map(catalog?.props.map((prop) => [prop.id, prop.bounds]))
    const placements: readonly PropPlacement[] = layout.props
    for (const placement of placements) {
      const bounds = props.get(placement.id)
      if (bounds) include(bounds.min, bounds.max, placement.position, placement.rotationY, placement.scale)
    }
    if ('avatars' in layout) {
      for (const avatar of layout.avatars) include([-0.8, 0, -0.8], [0.8, 2.55, 0.8], avatar.position)
    }
  }

  const center = right.multiplyScalar((left + rightmost) / 2).addScaledVector(up, (low + high) / 2)
  return { center, direction, width: rightmost - left, height: high - low }
}

function StageCamera({
  context, columns, reset, catalog, closeView, kitLayout,
}: { context: StageContext; columns: number; reset: number; catalog?: PackCatalog; closeView: boolean; kitLayout?: ConstructionLayout }) {
  const set = useThree((state) => state.set)
  const size = useThree((state) => state.size)
  const frame = useMemo(() => stageFrame(context, columns, catalog, kitLayout), [catalog, columns, context, kitLayout])
  const sceneCamera = context !== 'all' && closeView ? SCENE_CAMERAS[context] : null
  const portrait = size.width < size.height ? sceneCamera?.portrait : undefined
  const close = portrait ?? sceneCamera
  const target = useMemo(() => close ? new Vector3(...close.target) : frame.center, [close, frame])
  const isClose = close !== null
  const camera = useMemo(
    () => isClose ? new ThreePerspectiveCamera(50, 1, 0.06, 140) : new OrthographicCamera(-1, 1, 1, -1, 0.1, 220),
    [isClose],
  )

  useLayoutEffect(() => {
    if (close && camera instanceof ThreePerspectiveCamera) {
      camera.position.set(...close.position)
      camera.lookAt(target)
      camera.aspect = size.width / Math.max(size.height, 1)
      const aspect = MathUtils.clamp(size.width / Math.max(size.height, 1), 0.4, 1)
      const halfAngle = Math.atan(Math.tan(MathUtils.degToRad(portrait?.halfAngle ?? 22)) / aspect)
      camera.fov = Math.min(73, 2 * MathUtils.radToDeg(halfAngle))
    } else if (camera instanceof OrthographicCamera) {
      camera.position.copy(frame.center).addScaledVector(frame.direction, 100)
      camera.lookAt(frame.center)
      camera.left = -size.width / 2
      camera.right = size.width / 2
      camera.top = size.height / 2
      camera.bottom = -size.height / 2
      const margin = context === 'all' ? 1.13 : 1.15
      camera.zoom = Math.min(size.width / frame.width, size.height / frame.height) / margin
    }
    camera.updateProjectionMatrix()
    set({ camera })
  }, [camera, close, context, frame, portrait, reset, set, size.width, size.height, target])

  return (
    <OrbitControls
      key={`${context}-${kitLayout?.id ?? ''}-${reset}-${closeView}-${size.width}-${size.height}`}
      camera={camera}
      target={target}
      enablePan={false}
      minZoom={4}
      maxZoom={160}
      minDistance={3}
      maxDistance={close ? 35 : Infinity}
      maxPolarAngle={Math.PI / 2.1}
    />
  )
}

export function MultiContextStage({
  catalogs, index, activeContext, shadowMode, reset, closeView, kitLayout, showRoofs,
}: MultiContextStageProps & { reset: number }) {
  const shown = activeContext === 'all' ? CONTEXT_PACK_KEYS : [activeContext]
  const width = useThree((state) => state.size.width)
  const columns = width < 710 ? 2 : 3
  const rows = Math.ceil(shown.length / columns)
  const environment = activeContext === 'all' ? undefined : COLOR_DIRECTION.packs[activeContext].stage.environment

  return (
    <>
      {closeView && environment && (
        <fog attach="fog" args={[STAGE_LOOK[activeContext].glow, ...environment.fog]} />
      )}
      <StageLights context={activeContext} />
      <StageCamera context={activeContext} columns={columns} reset={reset} closeView={closeView} kitLayout={kitLayout} catalog={catalogs.find((item) => item.pack === activeContext)} />
      {shown.map((key, i) => {
        const catalog = catalogs.find((item) => item.pack === key)
        if (!catalog) throw new Error(`The "${key}" pack catalog is missing.`)
        const row = Math.floor(i / columns)
        const count = Math.min(columns, shown.length - row * columns)
        const x = (i % columns - (count - 1) / 2) * DIORAMA_SPACING
        const z = (row - (rows - 1) / 2) * ROW_GAP
        return (
          <group key={key} position={[x, 0, z]}>
            <Diorama catalog={catalog} index={index} blobShadow={shadowMode === 'blob'} label={shown.length > 1} showBackdrop={closeView && activeContext !== 'all'} kitLayout={kitLayout} showRoofs={showRoofs} />
          </group>
        )
      })}
    </>
  )
}
