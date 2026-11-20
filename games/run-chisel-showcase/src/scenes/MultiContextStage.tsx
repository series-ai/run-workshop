import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { CharacterPreset, PackCatalog, WorldPropEntry } from '@chisel/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@chisel/contracts/packs'
import { PolyAvatar, PolyProp } from '../avatar/PolyAvatar'
import { selectionFromPreset, type PolyPartIndex } from '../avatar/composePolyAvatar'
import { createPolyMaterial } from '../avatar/polyMaterial'
import { GROUND_COLORS, PROP_PALETTES } from './contextPalettes'

type StageContext = 'all' | ContextPackKey

export interface MultiContextStageProps {
  catalogs: PackCatalog[]
  index: PolyPartIndex
  activeContext: StageContext
  shadowMode: 'blob' | 'none'
}

const DIORAMA_SPACING = 4.9
const PAD_RADIUS = 2.25
/** Viewport aspect at which four or five dioramas fill the width of the stage camera. */
const FULL_WIDTH_ASPECT_4 = 2.4
const FULL_WIDTH_ASPECT_5 = 3.05

/** Character places on a pad: x, z and the turn about Y. The characters face the camera (+Z). */
const AVATAR_SLOTS_3: readonly (readonly [number, number, number])[] = [
  [-1.38, 0.45, 0.34],
  [0.0, -0.1, -0.05],
  [1.38, 0.45, -0.36],
]

const AVATAR_SLOTS_4: readonly (readonly [number, number, number])[] = [
  [-1.42, 0.35, 0.36],
  [-0.46, 0.08, 0.12],
  [1.38, 0.42, -0.36],
  [0.42, 1.12, -0.12],
]

/** A wolf or a spider shows its side line in a 3/4 view. It gets this turn on top of the slot turn. */
const CREATURE_TURN = 0.8

/**
 * Prop places on a pad, from the largest prop to the smallest prop. The largest props go to the back,
 * so a tall banner or landmark does not hide a character. Smaller props go to the sides and front corners.
 */
const PROP_SLOTS: readonly (readonly [number, number, number])[] = [
  [1.12, -1.44, -0.22],
  [0.0, -1.72, 0.0],
  [-1.12, -1.44, 0.28],
  [-1.80, -0.52, 0.62],
  [1.80, -0.52, -0.62],
  [-1.56, 1.26, 0.56],
  [1.56, 1.26, -0.52],
]

const AMBIENT_CLIP_ORDER = ['Idle', 'Hover', 'Spin', 'Sweep', 'Swing', 'Loop', 'Pulse', 'Active', 'Open', 'Closed', 'Down', 'Armed']
const FLOOR_TILE_RE = /(?:floor_tile|sidewalk_tile|road_crosswalk|grate_tile|duckboard)/

/** The largest extent of a prop in metres (width, height or depth). */
function reach(prop: WorldPropEntry): number {
  return Math.max(...prop.bounds.size)
}

function pickAmbientClip(prop: WorldPropEntry): string | undefined {
  const clips = prop.clips
  if (!clips || clips.length === 0) return undefined
  for (const candidate of AMBIENT_CLIP_ORDER) {
    if (clips.includes(candidate)) return candidate
  }
  return clips[0]
}

function pickStageProps(allProps: readonly WorldPropEntry[]): WorldPropEntry[] {
  const animated = allProps.filter((p) => p.clips && p.clips.length > 0)
  const nonFloorStatic = allProps.filter((p) => !p.clips?.length && !FLOOR_TILE_RE.test(p.id))
  const chosen = [...animated, ...nonFloorStatic].slice(0, PROP_SLOTS.length)
  return chosen.sort((a, b) => reach(b) - reach(a))
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
  const selections = useMemo(
    () => catalog.presets.slice(0, AVATAR_SLOTS_4.length).map((preset: CharacterPreset) => selectionFromPreset(preset)),
    [catalog],
  )
  const avatarSlots = selections.length > 3 ? AVATAR_SLOTS_4 : AVATAR_SLOTS_3
  const props = useMemo(() => pickStageProps(catalog.props), [catalog.props])
  // One material for all props of the context: one program, one palette.
  const propMaterial = useMemo(() => createPolyMaterial(PROP_PALETTES[context]), [context])
  useEffect(() => () => propMaterial.dispose(), [propMaterial])
  const ground = GROUND_COLORS[context]

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[PAD_RADIUS, PAD_RADIUS + 0.16, 0.14, 10]} />
        <meshStandardMaterial attach="material-0" color={ground.side} roughness={1} flatShading />
        <meshStandardMaterial attach="material-1" color={ground.top} roughness={1} flatShading />
        <meshStandardMaterial attach="material-2" color={ground.side} roughness={1} flatShading />
      </mesh>
      {selections.map((selection, i) => {
        const [sx, sz, turn] = avatarSlots[i]!
        return (
          <PolyAvatar
            key={catalog.presets[i]!.id}
            selection={selection}
            index={index}
            blobShadow={blobShadow}
            position={[sx, 0, sz]}
            rotation={[0, turn + (selection.rigId === 'ual1' ? 0 : CREATURE_TURN), 0]}
            timeOffset={i * 0.7}
          />
        )
      })}
      {props.map((prop, i) => {
        const [px, pz, turn] = PROP_SLOTS[i]!
        return (
          <PolyProp
            key={prop.id}
            item={prop}
            material={propMaterial}
            blobShadow={blobShadow}
            position={[px, 0, pz]}
            rotation={[0, turn, 0]}
            clip={pickAmbientClip(prop)}
            timeOffset={i * 0.65}
          />
        )
      })}
      <Html position={[0, 0.04, PAD_RADIUS + 0.42]} center style={{ pointerEvents: 'none' }}>
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
  // Desktop lays out 1xN across width; portrait lays out 2 columns so all contexts stay legible.
  const fit =
    shown.length === 1
      ? Math.min(1.25, Math.max(0.75, aspect * 1.15))
      : isPortraitGrid
        ? Math.max(0.34, Math.min(0.85, aspect / (portraitRows > 2 ? 1.32 : 1.12)))
        : Math.max(0.4, Math.min(1, aspect / fullWidthAspect))
  return (
    <group scale={fit}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <circleGeometry args={[28, 48]} />
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
            : ((i % 2) - 0.5) * (DIORAMA_SPACING + 0.35)
          : (i - (shown.length - 1) / 2) * DIORAMA_SPACING
        const z = isPortraitGrid ? (row - (portraitRows - 1) / 2) * 6.4 : 0
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
