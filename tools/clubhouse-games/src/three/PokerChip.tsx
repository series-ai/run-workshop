import { ComponentProps, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { ChipDenomination, chipDenomination } from '../chips/denominations'
import { paintChipEdge, paintChipFace } from '../chips/paintChip'
import { DiscPiece } from './DiscPiece'
import { getCachedTexture } from './textures'

export interface PokerChipProps extends Omit<ComponentProps<'group'>, 'ref'> {
  // Face value; must be one of CHIP_DENOMINATIONS.
  value?: number
  radius?: number
  height?: number
  inserts?: number
  lit?: boolean
}

export function PokerChip({
  value = 5,
  radius = 0.42,
  height = 0.09,
  inserts = 6,
  lit = true,
  ...groupProps
}: PokerChipProps) {
  const denom: ChipDenomination = chipDenomination(value)
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const face = getCachedTexture(
    `chip-face:${denom.value}:${inserts}`,
    () => paintChipFace(denom, { inserts }),
    maxAniso,
  )
  const edge = getCachedTexture(
    `chip-edge:${denom.value}:${inserts}`,
    () => paintChipEdge(denom, { inserts }),
    maxAniso,
  )
  const faces = useMemo(
    () => ({ top: face, bottom: face, side: edge }),
    [face, edge],
  )

  return (
    <group {...groupProps}>
      <DiscPiece
        radius={radius}
        height={height}
        faces={faces}
        lit={lit}
        roughness={0.62}
        castShadow
        receiveShadow
        rotation={[0, Math.PI / 2, 0]}
      />
    </group>
  )
}

export interface ChipStackProps extends Omit<ComponentProps<'group'>, 'ref'> {
  value?: number
  count?: number
  radius?: number
  height?: number
  lit?: boolean
}

// A stack of one denomination. Each chip is nudged off centre and turned a
// little, because a hand-stacked pile is never perfectly square.
export function ChipStack({
  value = 5,
  count = 5,
  radius = 0.42,
  height = 0.09,
  lit = true,
  ...groupProps
}: ChipStackProps) {
  if (count < 0) throw new Error(`ChipStack count cannot be negative, got ${count}`)
  return (
    <group {...groupProps}>
      {Array.from({ length: count }, (_, i) => (
        <PokerChip
          key={i}
          value={value}
          radius={radius}
          height={height}
          lit={lit}
          position={[jitter(i) * radius * 0.05, i * height * 1.02, jitter(i + 7) * radius * 0.05]}
          rotation={[0, jitter(i + 3) * 0.16, 0]}
        />
      ))}
    </group>
  )
}

// Deterministic offset in [-1, 1], so a stack looks hand-made but does not
// reshuffle itself every render.
function jitter(i: number): number {
  const s = Math.sin(i * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}
