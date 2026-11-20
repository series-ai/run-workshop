import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { CharacterPreset, PackCatalog, WorldPropEntry } from '@chisel/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@chisel/contracts/packs'
import { PolyAvatar, PolyProp } from '../avatar/PolyAvatar'
import { selectionFromPreset, type PolyPartIndex } from '../avatar/composePolyAvatar'
import { createPolyMaterial } from '../avatar/polyMaterial'
import { GROUND_COLORS, PROP_PALETTES } from './contextPalettes'
import { DIORAMA_SPACING, SCENE_LAYOUTS, SCENE_PAD_RADIUS } from './sceneLayouts'

type StageContext = 'all' | ContextPackKey

export interface MultiContextStageProps {
  catalogs: PackCatalog[]
  index: PolyPartIndex
  activeContext: StageContext
  shadowMode: 'blob' | 'none'
}

/** Viewport aspect at which four or five 8.4m dioramas fill the width of the stage camera. */
const FULL_WIDTH_ASPECT_4 = 4.2
const FULL_WIDTH_ASPECT_5 = 5.15

/** A creature shows its side line in a 3/4 view. It gets this turn on top of the authored slot turn. */
const CREATURE_TURN = 0.8

const AMBIENT_CLIP_ORDER = ['Idle', 'Hover', 'Spin', 'Sweep', 'Swing', 'Loop', 'Pulse', 'Active', 'Open', 'Closed', 'Down', 'Armed']
const FLOOR_TILE_RE = /(?:floor_tile|sidewalk_tile|road_crosswalk|grate_tile|duckboard)/

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
  x,
}: {
  catalog: PackCatalog
  index: PolyPartIndex
  blobShadow: boolean
  x: number
}) {
  const context = catalog.pack as ContextPackKey
  const layout = SCENE_LAYOUTS[context]
  const selections = useMemo(
    () => catalog.presets.slice(0, layout.avatars.length).map((preset: CharacterPreset) => selectionFromPreset(preset)),
    [catalog, layout.avatars.length],
  )
  const propById = useMemo(() => new Map(catalog.props.map((p) => [p.id, p])), [catalog.props])
  // One material for all props of the context: one program, one palette.
  const propMaterial = useMemo(() => createPolyMaterial(PROP_PALETTES[context]), [context])
  useEffect(() => () => propMaterial.dispose(), [propMaterial])
  const ground = GROUND_COLORS[context]

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[layout.padRadius, layout.padRadius + 0.22, 0.14, 10]} />
        <meshStandardMaterial attach="material-0" color={ground.side} roughness={1} flatShading />
        <meshStandardMaterial attach="material-1" color={ground.top} roughness={1} flatShading />
        <meshStandardMaterial attach="material-2" color={ground.side} roughness={1} flatShading />
      </mesh>
      {selections.map((selection, i) => {
        const slot = layout.avatars[i]!
        return (
          <PolyAvatar
            key={catalog.presets[i]!.id}
            selection={selection}
            index={index}
            blobShadow={blobShadow}
            position={[slot.position[0], slot.position[1], slot.position[2]]}
            rotation={[0, slot.rotationY + (selection.rigId === 'ual1' ? 0 : CREATURE_TURN), 0]}
            timeOffset={i * 0.7}
          />
        )
      })}
      {layout.props.map((placement, i) => {
        const prop = propById.get(placement.id)
        if (!prop) throw new Error(`Missing prop "${placement.id}" in "${context}" catalog.`)
        const isFloorTile = FLOOR_TILE_RE.test(prop.id)
        return (
          <PolyProp
            key={`${placement.id}-${i}`}
            item={prop}
            material={propMaterial}
            blobShadow={blobShadow && !isFloorTile}
            position={[placement.position[0], placement.position[1], placement.position[2]]}
            rotation={[0, placement.rotationY ?? 0, 0]}
            clip={placement.clip ?? pickAmbientClip(prop)}
            timeOffset={placement.timeOffset ?? i * 0.45}
          />
        )
      })}
      <Html position={[0, 0.04, layout.padRadius + 0.5]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(12, 18, 28, 0.82)',
            border: '1px solid rgba(138, 180, 248, 0.35)',
            color: '#e6eefc',
            font: '600 12px/1.3 system-ui, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {catalog.label}
        </div>
      </Html>
    </group>
  )
}

/** Medieval, WW2, Sim, Cyberpunk, and Monsters dioramas side by side (or 2-col grid on portrait) using shared 7-region shader and mobile budget. */
export function MultiContextStage({ catalogs, index, activeContext, shadowMode }: MultiContextStageProps) {
  const shown = CONTEXT_PACK_KEYS.filter((key) => activeContext === 'all' || activeContext === key)
  const aspect = useThree((state) => state.viewport.aspect)
  const isPortraitGrid = aspect < 0.9 && shown.length > 1
  const fullWidthAspect = shown.length > 4 ? FULL_WIDTH_ASPECT_5 : FULL_WIDTH_ASPECT_4
  const portraitRows = Math.ceil(shown.length / 2)
  const portraitRowSpacing = SCENE_PAD_RADIUS * 2 + 1.4
  // Desktop lays out 1xN across width; portrait lays out 2 columns so all contexts stay legible.
  const fit =
    shown.length === 1
      ? Math.min(0.76, Math.max(0.45, aspect * 0.65))
      : isPortraitGrid
        ? Math.max(0.2, Math.min(0.48, aspect / (portraitRows > 2 ? 2.2 : 1.9)))
        : Math.max(0.22, Math.min(0.62, aspect / fullWidthAspect))
  return (
    <group scale={fit}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <circleGeometry args={[52, 48]} />
        <meshStandardMaterial color="#14171d" roughness={1} />
      </mesh>
      {shown.map((key, i) => {
        const catalog = catalogs.find((item) => item.pack === key)
        if (!catalog) throw new Error(`The "${key}" pack catalog is missing.`)
        const row = Math.floor(i / 2)
        const isLastSingle = isPortraitGrid && shown.length % 2 === 1 && i === shown.length - 1
        const x = isPortraitGrid
          ? isLastSingle
            ? 0
            : ((i % 2) - 0.5) * (DIORAMA_SPACING + 0.5)
          : (i - (shown.length - 1) / 2) * DIORAMA_SPACING
        const z = isPortraitGrid ? (row - (portraitRows - 1) / 2) * portraitRowSpacing : 0
        return (
          <group key={key} position={[0, 0, z]}>
            <Diorama
              catalog={catalog}
              index={index}
              blobShadow={shadowMode === 'blob'}
              x={x}
            />
          </group>
        )
      })}
    </group>
  )
}
