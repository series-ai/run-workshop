import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { CharacterPreset, PackCatalog, WorldPropEntry } from '@poly/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@poly/contracts/packs'
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
/** Viewport aspect at which four dioramas fill the width of the stage camera. */
const FULL_WIDTH_ASPECT = 2.4

/** Character places on a pad: x, z and the turn about Y. The characters face the camera (+Z). */
const AVATAR_SLOTS: readonly (readonly [number, number, number])[] = [
  [-1.38, 0.45, 0.34],
  [0.0, -0.1, -0.05],
  [1.38, 0.45, -0.36],
  [0.05, 1.42, 0.1],
]

/** A wolf or a spider shows its side line in a 3/4 view. It gets this turn on top of the slot turn. */
const CREATURE_TURN = 0.8

/**
 * Prop places on a pad, from the largest prop to the smallest prop. The two largest props go to the back,
 * so a tall banner or a wide wall does not hide a character. The two smallest props go to the front corners.
 */
const PROP_SLOTS: readonly (readonly [number, number, number])[] = [
  [1.0, -1.38, -0.12],
  [-1.0, -1.42, 0.3],
  [-1.5, 1.28, 0.6],
  [1.52, 1.28, -0.5],
]

/** The largest extent of a prop in metres (width, height or depth). */
function reach(prop: WorldPropEntry): number {
  return Math.max(...prop.bounds.size)
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
    () => catalog.presets.slice(0, AVATAR_SLOTS.length).map((preset: CharacterPreset) => selectionFromPreset(preset)),
    [catalog],
  )
  const props = useMemo(() => [...catalog.props].sort((a, b) => reach(b) - reach(a)).slice(0, PROP_SLOTS.length), [catalog])
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
        const [sx, sz, turn] = AVATAR_SLOTS[i]!
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

/** Medieval, WW2, Sim, and Monsters dioramas side by side (or 2x2 on portrait) using shared 7-region shader and mobile budget. */
export function MultiContextStage({ catalogs, index, activeContext, shadowMode }: MultiContextStageProps) {
  const shown = CONTEXT_PACK_KEYS.filter((key) => activeContext === 'all' || activeContext === key)
  const aspect = useThree((state) => state.viewport.aspect)
  const isPortraitGrid = aspect < 0.9 && shown.length > 1
  // Desktop lays out 1x4 across width; portrait lays out 2x2 so all 4 contexts stay large and legible.
  const fit =
    shown.length === 1
      ? Math.min(1.25, Math.max(0.75, aspect * 1.15))
      : isPortraitGrid
        ? Math.max(0.38, Math.min(0.85, aspect / 1.12))
        : Math.max(0.4, Math.min(1, aspect / FULL_WIDTH_ASPECT))
  return (
    <group scale={fit}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <circleGeometry args={[24, 48]} />
        <meshStandardMaterial color="#14171d" roughness={1} />
      </mesh>
      {shown.map((key, i) => {
        const catalog = catalogs.find((item) => item.pack === key)
        if (!catalog) throw new Error(`The "${key}" pack catalog is missing.`)
        const x = isPortraitGrid ? ((i % 2) - 0.5) * (DIORAMA_SPACING + 0.35) : (i - (shown.length - 1) / 2) * DIORAMA_SPACING
        const z = isPortraitGrid ? (Math.floor(i / 2) - 0.5) * 6.8 : 0
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
