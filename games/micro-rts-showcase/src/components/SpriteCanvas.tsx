import { useEffect, useRef } from 'react'
import { useSpriteImage } from '../spriteCache'

export interface SpriteCellProps {
  leafId: string
  path: string
  cellW: number
  cellH: number
  col?: number
  row?: number
  scale?: number
  bg?: string
  className?: string
  overlayPath?: string
  overlayCol?: number
  overlayRow?: number
  turretPath?: string
  turretCol?: number
  turretRow?: number
  shadowPath?: string
  shadowRow?: number
  muzzlePoint?: readonly [number, number] | null
}

export function SpriteCellCanvas({
  leafId,
  path,
  cellW,
  cellH,
  col = 0,
  row = 0,
  scale = 3,
  bg,
  className,
  overlayPath,
  overlayCol = 0,
  overlayRow = 0,
  turretPath,
  turretCol = 0,
  turretRow = 0,
  shadowPath,
  shadowRow = 0,
  muzzlePoint,
}: SpriteCellProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const baseImg = useSpriteImage({ leafId, path })
  const shadowImg = useSpriteImage(shadowPath ? { leafId, path: shadowPath } : null)
  const turretImg = useSpriteImage(turretPath ? { leafId, path: turretPath } : null)
  const overlayImg = useSpriteImage(overlayPath ? { leafId, path: overlayPath } : null)

  const outW = Math.max(1, Math.round(cellW * scale))
  const outH = Math.max(1, Math.round(cellH * scale))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, outW, outH)
    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, outW, outH)
    }

    if (shadowImg) {
      ctx.drawImage(shadowImg, 0, shadowRow * cellH, cellW, cellH, 0, 0, outW, outH)
    }
    if (baseImg) {
      const maxCols = Math.max(1, Math.floor(baseImg.width / cellW))
      const safeCol = ((col % maxCols) + maxCols) % maxCols
      ctx.drawImage(baseImg, safeCol * cellW, row * cellH, cellW, cellH, 0, 0, outW, outH)
    }
    if (turretImg) {
      const maxTCols = Math.max(1, Math.floor(turretImg.width / cellW))
      const safeTCol = ((turretCol % maxTCols) + maxTCols) % maxTCols
      ctx.drawImage(turretImg, safeTCol * cellW, turretRow * cellH, cellW, cellH, 0, 0, outW, outH)
    }
    if (overlayImg) {
      const ovW = overlayImg.width >= cellW * 4 ? cellW : overlayImg.width
      const ovH = overlayImg.height >= cellH ? cellH : overlayImg.height
      const dx = Math.floor(((cellW - ovW) / 2) * scale)
      const dy = Math.floor(((cellH - ovH) / 2) * scale)
      ctx.drawImage(overlayImg, overlayCol * ovW, overlayRow * ovH, ovW, ovH, dx, dy, ovW * scale, ovH * scale)
    }
    if (muzzlePoint) {
      const [mx, my] = muzzlePoint
      const px = Math.round((mx + 0.5) * scale)
      const py = Math.round((my + 0.5) * scale)
      ctx.strokeStyle = 'rgba(255, 90, 90, 0.92)'
      ctx.lineWidth = Math.max(1, Math.floor(scale / 3))
      ctx.beginPath()
      ctx.moveTo(px - scale * 1.4, py)
      ctx.lineTo(px + scale * 1.4, py)
      ctx.moveTo(px, py - scale * 1.4)
      ctx.lineTo(px, py + scale * 1.4)
      ctx.stroke()
      ctx.fillStyle = '#fff5b0'
      ctx.fillRect(mx * scale, my * scale, scale, scale)
    }
  }, [baseImg, shadowImg, turretImg, overlayImg, cellW, cellH, col, row, scale, outW, outH, bg, overlayCol, overlayRow, turretCol, turretRow, shadowRow, muzzlePoint])

  return (
    <canvas
      ref={canvasRef}
      width={outW}
      height={outH}
      className={className}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  )
}
