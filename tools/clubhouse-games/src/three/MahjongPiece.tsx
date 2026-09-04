import { ComponentProps, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { paintMahjongBack } from '../mahjong/paintMahjongBack'
import { paintMahjongFace } from '../mahjong/paintMahjongFace'
import { mahjongFaceId, MahjongTile } from '../mahjong/types'
import { BoxPiece, useFlipY } from './BoxPiece'
import { getCachedTexture } from './textures'

export interface MahjongPieceProps extends Omit<ComponentProps<'group'>, 'ref'> {
  tile: MahjongTile
  faceUp?: boolean
  lit?: boolean
}

// Chunky standing tile; flip animates rotation.y like the playing cards.
export function MahjongPiece({ tile, faceUp = true, lit = true, ...groupProps }: MahjongPieceProps) {
  const group = useRef<THREE.Group>(null)
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  useFlipY(group, faceUp)

  const face = getCachedTexture(
    `mahjong-face:${mahjongFaceId(tile)}`,
    () => paintMahjongFace(tile),
    maxAniso,
  )
  const back = getCachedTexture('mahjong-back', () => paintMahjongBack(), maxAniso)
  const faces = useMemo(() => ({ pz: face, nz: back }), [face, back])

  return (
    <group ref={group} {...groupProps}>
      <BoxPiece size={[0.5, 0.7, 0.24]} faces={faces} edgeColor="#d8d0bc" lit={lit} />
    </group>
  )
}
