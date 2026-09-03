import { ComponentProps, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { roundRectPath } from '../canvasUtils'
import { paintDomino, DOMINO_H, DOMINO_W } from '../dominoes/paintDomino'
import { dominoId, Domino } from '../dominoes/types'
import { BoxPiece, useFlipY } from './BoxPiece'
import { getCachedTexture } from './textures'

export interface DominoPieceProps extends Omit<ComponentProps<'group'>, 'ref'> {
  domino: Domino
  faceUp?: boolean
  lit?: boolean
}

function paintDominoBack(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = DOMINO_W
  canvas.height = DOMINO_H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, DOMINO_W, DOMINO_H)
  roundRectPath(ctx, 2, 2, DOMINO_W - 4, DOMINO_H - 4, 24)
  ctx.fillStyle = '#1c1c22'
  ctx.fill()
  // Center milled dot, like a real domino back.
  ctx.fillStyle = '#3a3a44'
  ctx.beginPath()
  ctx.arc(DOMINO_W / 2, DOMINO_H / 2, 18, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}

export function DominoPiece({ domino, faceUp = true, lit = true, ...groupProps }: DominoPieceProps) {
  const group = useRef<THREE.Group>(null)
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  useFlipY(group, faceUp)

  const face = getCachedTexture(
    `domino-face:${dominoId(domino)}`,
    () => paintDomino(domino),
    maxAniso,
  )
  const back = getCachedTexture('domino-back', paintDominoBack, maxAniso)
  const faces = useMemo(() => ({ pz: face, nz: back }), [face, back])

  return (
    <group ref={group} {...groupProps}>
      <BoxPiece size={[0.5, 1, 0.24]} faces={faces} edgeColor="#14141a" lit={lit} />
    </group>
  )
}
