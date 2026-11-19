import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { CharacterPreset, PackCatalog, WorldPropEntry } from '@voxchar/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@voxchar/contracts/packs'
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

const PAD_RADIUS = 2.25
const CREATURES_PAD_RADIUS = 3.85
const PAD_GAP = 0.45
/** Viewport aspect at which all four dioramas (including the wide 10-creature pad) fill the stage camera width. */
const FULL_WIDTH_ASPECT = 2.75

/** Character places on a standard humanoid pad: x, z and the turn about Y. The characters face the camera (+Z). */
const AVATAR_SLOTS: readonly (readonly [number, number, number])[] = [
  [-1.38, 0.45, 0.34],
  [0.0, -0.1, -0.05],
  [1.38, 0.45, -0.36],
  [0.05, 1.42, 0.1],
]

/**
 * Prop places on a standard pad, from the largest prop to the smallest prop. The two largest props go to the back,
 * so a tall banner or a wide wall does not hide a character. The two smallest props go to the front corners.
 */
const PROP_SLOTS: readonly (readonly [number, number, number])[] = [
  [1.0, -1.38, -0.12],
  [-1.0, -1.42, 0.3],
  [-1.5, 1.28, 0.6],
  [1.52, 1.28, -0.5],
]

/** Explicit 3-tier non-overlapping placement for all 10 creature presets (tall back -> mid -> low front). */
const CREATURE_AVATAR_SLOT_BY_ID: Readonly<Record<string, readonly [number, number, number]>> = {
  creature_chestnut_horse: [-0.55, -1.55, 1.05],
  creature_demolition_bot: [1.85, -1.45, -0.22],
  creature_timber_wolf: [-2.35, 0.45, 0.85],
  creature_guard_hound: [0.05, 0.35, 0.78],
  creature_k9_gsd: [2.15, 0.35, -0.8],
  creature_red_fox: [-2.05, 2.05, 0.9],
  creature_pembroke_corgi: [-0.55, 2.35, 0.55],
  creature_chonky_pug: [0.45, 2.4, -0.35],
  creature_ginger_cat: [1.35, 2.35, -0.6],
  creature_scrap_spider: [2.65, 1.85, -0.55],
}

const CREATURE_PROP_SLOT_BY_ID: Readonly<Record<string, readonly [number, number, number]>> = {
  prop_dog_kennel: [-2.95, -1.25, 0.4],
  prop_scrap_beacon: [3.05, -0.95, -0.35],
}

/** A wolf or a spider shows its side line in a 3/4 view. It gets this turn on top of the slot turn on fallback slots. */
const CREATURE_TURN = 0.8

/** The largest extent of a prop in metres (width, height or depth). */
function reach(prop: WorldPropEntry): number {
  return Math.max(...prop.bounds.size)
}

function padRadiusFor(context: ContextPackKey): number {
  return context === 'creatures' ? CREATURES_PAD_RADIUS : PAD_RADIUS
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
  const isCreatures = context === 'creatures'
  const padRadius = padRadiusFor(context)

  const avatarPlacements = useMemo(() => {
    const list = isCreatures ? catalog.presets : catalog.presets.slice(0, AVATAR_SLOTS.length)
    return list.map((preset: CharacterPreset, i: number) => {
      const selection = selectionFromPreset(preset)
      const explicit = isCreatures ? CREATURE_AVATAR_SLOT_BY_ID[preset.id] : undefined
      const fallback = AVATAR_SLOTS[i % AVATAR_SLOTS.length]!
      const [sx, sz, turn] = explicit ?? [
        fallback[0],
        fallback[1],
        fallback[2] + (selection.rigId === 'ual1' ? 0 : CREATURE_TURN),
      ]
      return { preset, selection, sx, sz, turn }
    })
  }, [catalog, isCreatures])

  const propPlacements = useMemo(() => {
    const sorted = [...catalog.props].sort((a, b) => reach(b) - reach(a))
    const list = isCreatures ? sorted : sorted.slice(0, PROP_SLOTS.length)
    return list.map((prop, i) => {
      const [px, pz, turn] = (isCreatures ? CREATURE_PROP_SLOT_BY_ID[prop.id] : undefined) ?? PROP_SLOTS[i % PROP_SLOTS.length]!
      return { prop, px, pz, turn }
    })
  }, [catalog, isCreatures])

  // One material for all props of the context: one program, one palette.
  const propMaterial = useMemo(() => createPolyMaterial(PROP_PALETTES[context]), [context])
  useEffect(() => () => propMaterial.dispose(), [propMaterial])
  const ground = GROUND_COLORS[context]

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[padRadius, padRadius + 0.16, 0.14, isCreatures ? 14 : 10]} />
        <meshStandardMaterial attach="material-0" color={ground.side} roughness={1} flatShading />
        <meshStandardMaterial attach="material-1" color={ground.top} roughness={1} flatShading />
        <meshStandardMaterial attach="material-2" color={ground.side} roughness={1} flatShading />
      </mesh>
      {avatarPlacements.map(({ preset, selection, sx, sz, turn }, i) => (
        <PolyAvatar
          key={preset.id}
          selection={selection}
          index={index}
          blobShadow={blobShadow}
          position={[sx, 0, sz]}
          rotation={[0, turn, 0]}
          timeOffset={i * 0.7}
        />
      ))}
      {propPlacements.map(({ prop, px, pz, turn }) => (
        <PolyProp
          key={prop.id}
          item={prop}
          material={propMaterial}
          blobShadow={blobShadow}
          position={[px, 0, pz]}
          rotation={[0, turn, 0]}
        />
      ))}
      <Html position={[0, 0.04, padRadius + 0.42]} center style={{ pointerEvents: 'none' }}>
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

/** Heist, Industrial, Security, and all 10 Beasts & Bots dioramas side by side under mobile shadow policy. */
export function MultiContextStage({ catalogs, index, activeContext, shadowMode }: MultiContextStageProps) {
  const shown = CONTEXT_PACK_KEYS.filter((key) => activeContext === 'all' || activeContext === key)
  const aspect = useThree((state) => state.viewport.aspect)
  // A narrow viewport (phone portrait) gets a smaller stage, so all dioramas stay in view.
  const fit =
    shown.length === 1
      ? shown[0] === 'creatures'
        ? Math.min(1.05, Math.max(0.55, aspect / 1.5))
        : 1.25
      : Math.max(0.38, Math.min(1, aspect / FULL_WIDTH_ASPECT))

  const placements = useMemo(() => {
    const radii = shown.map((key) => padRadiusFor(key))
    const totalWidth = radii.reduce((sum, r) => sum + 2 * r, 0) + Math.max(0, radii.length - 1) * PAD_GAP
    let cursor = -totalWidth / 2
    return shown.map((key, i) => {
      const r = radii[i]!
      const x = cursor + r
      cursor += 2 * r + PAD_GAP
      return { key, x }
    })
  }, [shown])

  return (
    <group scale={fit}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <circleGeometry args={[28, 48]} />
        <meshStandardMaterial color="#14171d" roughness={1} />
      </mesh>
      {placements.map(({ key, x }) => {
        const catalog = catalogs.find((item) => item.pack === key)
        if (!catalog) throw new Error(`The "${key}" pack catalog is missing.`)
        return (
          <Diorama
            key={key}
            catalog={catalog}
            index={index}
            blobShadow={shadowMode === 'blob'}
            x={x}
          />
        )
      })}
    </group>
  )
}
