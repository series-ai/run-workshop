import { ComponentProps, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { paintCheckerEdge, paintCheckerFace } from '../checkers/paintChecker'
import { Checker, CHECKER_PALETTES } from '../checkers/pieces'
import { DiscPiece } from './DiscPiece'
import { getCachedTexture } from './textures'

export interface CheckerPieceProps extends Omit<ComponentProps<'group'>, 'ref'> {
  piece: Checker
  radius?: number
  height?: number
  lit?: boolean
}

// A crowned piece really is two draughts stacked, so it is drawn that way
// rather than as one taller disc.
export function CheckerPiece({
  piece,
  radius = 0.4,
  height = 0.12,
  lit = true,
  ...groupProps
}: CheckerPieceProps) {
  const pal = CHECKER_PALETTES[piece.color]
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const plain = getCachedTexture(
    `checker-face:${piece.color}`,
    () => paintCheckerFace(pal),
    maxAniso,
  )
  const crowned = getCachedTexture(
    `checker-face:${piece.color}:king`,
    () => paintCheckerFace(pal, { king: true }),
    maxAniso,
  )
  const edge = getCachedTexture(
    `checker-edge:${piece.color}`,
    () => paintCheckerEdge(pal),
    maxAniso,
  )

  const top = piece.king ? crowned : plain
  const upper = useMemo(() => ({ top, bottom: plain, side: edge }), [top, plain, edge])
  const lower = useMemo(() => ({ top: plain, bottom: plain, side: edge }), [plain, edge])

  return (
    <group {...groupProps}>
      {piece.king && (
        <DiscPiece
          radius={radius}
          height={height}
          faces={lower}
          lit={lit}
          roughness={0.55}
          castShadow
          receiveShadow
          rotation={[0, Math.PI / 2, 0]}
          position={[0, height / 2, 0]}
        />
      )}
      <DiscPiece
        radius={radius}
        height={height}
        faces={upper}
        lit={lit}
        roughness={0.55}
        castShadow
        receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[0, height / 2 + (piece.king ? height : 0), 0]}
      />
    </group>
  )
}
