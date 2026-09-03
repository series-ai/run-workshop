import { ComponentProps, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { darken, lighten, roundRectPath } from '../canvasUtils'
import { paintDomino, DOMINO_H, DOMINO_W } from '../dominoes/paintDomino'
import { dominoId, Domino } from '../dominoes/types'
import { BoxPiece, useFlipY } from './BoxPiece'
import { getCachedTexture } from './textures'

const BACK_COLOR = '#22222c'

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
  const r = 24

  ctx.clearRect(0, 0, DOMINO_W, DOMINO_H)
  roundRectPath(ctx, 2, 2, DOMINO_W - 4, DOMINO_H - 4, r)
  const grad = ctx.createLinearGradient(0, 0, DOMINO_W * 0.7, DOMINO_H)
  grad.addColorStop(0, lighten(BACK_COLOR, 0.16))
  grad.addColorStop(0.55, BACK_COLOR)
  grad.addColorStop(1, darken(BACK_COLOR, 0.4))
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  roundRectPath(ctx, 2, 2, DOMINO_W - 4, DOMINO_H - 4, r)
  ctx.clip()
  // Milled cross-hatch, of the kind pressed into a plastic domino back.
  ctx.strokeStyle = lighten(BACK_COLOR, 0.09)
  ctx.lineWidth = 2
  for (let i = -DOMINO_H; i < DOMINO_W + DOMINO_H; i += 16) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + DOMINO_H, DOMINO_H)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(i + DOMINO_H, 0)
    ctx.lineTo(i, DOMINO_H)
    ctx.stroke()
  }
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath()
  ctx.moveTo(4, DOMINO_H - r)
  ctx.lineTo(4, r)
  ctx.quadraticCurveTo(4, 4, r, 4)
  ctx.lineTo(DOMINO_W - r, 4)
  ctx.stroke()
  ctx.restore()

  // Inset rule and the brass pivot the face carries too.
  roundRectPath(ctx, 14, 14, DOMINO_W - 28, DOMINO_H - 28, r - 9)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 2
  ctx.stroke()

  const cx = DOMINO_W / 2
  const cy = DOMINO_H / 2
  const pivot = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 13)
  pivot.addColorStop(0, '#f6e4b0')
  pivot.addColorStop(0.55, '#c9a24e')
  pivot.addColorStop(1, '#8a6a25')
  ctx.beginPath()
  ctx.arc(cx, cy, 13, 0, Math.PI * 2)
  ctx.fillStyle = pivot
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.stroke()
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
