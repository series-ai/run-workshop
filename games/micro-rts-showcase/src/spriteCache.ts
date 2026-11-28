import { useEffect, useState } from 'react'
import { resolveAssetUrl, type AssetRef } from './assetSource'

const imagePromises = new Map<string, Promise<HTMLImageElement>>()
const loadedImages = new Map<string, HTMLImageElement>()

function keyOf(ref: AssetRef): string {
  return `${ref.leafId}::${ref.path}`
}

export function getCachedImage(ref: AssetRef): HTMLImageElement | null {
  return loadedImages.get(keyOf(ref)) ?? null
}

export function loadSpriteImage(ref: AssetRef): Promise<HTMLImageElement> {
  const key = keyOf(ref)
  const existing = imagePromises.get(key)
  if (existing) return existing

  const promise = resolveAssetUrl(ref).then(
    (url) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          loadedImages.set(key, img)
          resolve(img)
        }
        img.onerror = () => {
          imagePromises.delete(key)
          reject(new Error(`Failed to decode sprite image ${ref.leafId}/${ref.path}`))
        }
        img.src = url
      }),
  )
  imagePromises.set(key, promise)
  return promise
}

export function useSpriteImage(ref: AssetRef | null): HTMLImageElement | null {
  const key = ref ? keyOf(ref) : ''
  const [img, setImg] = useState<HTMLImageElement | null>(() => (ref ? getCachedImage(ref) : null))

  useEffect(() => {
    if (!ref) {
      setImg(null)
      return
    }
    const cached = getCachedImage(ref)
    if (cached) {
      setImg(cached)
      return
    }
    let alive = true
    loadSpriteImage(ref)
      .then((loaded) => {
        if (alive) setImg(loaded)
      })
      .catch(() => {
        if (alive) setImg(null)
      })
    return () => {
      alive = false
    }
  }, [key])

  return img
}

export function useSpriteBatch(refs: readonly AssetRef[]): ReadonlyMap<string, HTMLImageElement> {
  const sig = refs.map((r) => keyOf(r)).join('|')
  const [map, setMap] = useState<ReadonlyMap<string, HTMLImageElement>>(() => {
    const init = new Map<string, HTMLImageElement>()
    for (const r of refs) {
      const hit = getCachedImage(r)
      if (hit) init.set(r.path, hit)
    }
    return init
  })

  useEffect(() => {
    let alive = true
    Promise.allSettled(refs.map(async (r) => [r.path, await loadSpriteImage(r)] as const)).then((results) => {
      if (!alive) return
      const next = new Map<string, HTMLImageElement>()
      for (const r of results) {
        if (r.status === 'fulfilled') next.set(r.value[0], r.value[1])
      }
      setMap(next)
    })
    return () => {
      alive = false
    }
  }, [sig])

  return map
}

/** Discrete integer-pixel Bresenham line renderer for authentic crisp micro-RTS beams/tracers. */
export function drawDiscreteLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness = 1,
): void {
  let ix0 = Math.round(x0)
  let iy0 = Math.round(y0)
  const ix1 = Math.round(x1)
  const iy1 = Math.round(y1)
  const dx = Math.abs(ix1 - ix0)
  const dy = Math.abs(iy1 - iy0)
  const sx = ix0 < ix1 ? 1 : -1
  const sy = iy0 < iy1 ? 1 : -1
  let err = dx - dy
  const half = Math.floor(thickness / 2)
  ctx.fillStyle = color
  while (true) {
    ctx.fillRect(ix0 - half, iy0 - half, thickness, thickness)
    if (ix0 === ix1 && iy0 === iy1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      ix0 += sx
    }
    if (e2 < dx) {
      err += dx
      iy0 += sy
    }
  }
}

/** 3-tier ramping energy beam (T1 -> T2 -> T3) in discrete integer pixels. */
export function drawDiscreteRampBeam(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tier: 1 | 2 | 3,
  outerColor: string,
  coreColor: string,
): void {
  const outerW = tier === 3 ? 3 : tier === 2 ? 2 : 1
  drawDiscreteLine(ctx, x0, y0, x1, y1, outerColor, outerW)
  if (tier >= 2) {
    drawDiscreteLine(ctx, x0, y0, x1, y1, coreColor, 1)
  }
}

/** Jagged discrete-pixel chain lightning arc between two points. */
export function drawDiscreteChainArc(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  outerColor: string,
  coreColor: string,
): void {
  const segs = 5
  const pts: Array<[number, number]> = [[x0, y0]]
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const h = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
    const jitter = ((h - Math.floor(h)) * 2 - 1) * 4
    pts.push([x0 + dx * t + nx * jitter, y0 + dy * t + ny * jitter])
  }
  pts.push([x1, y1])
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    drawDiscreteLine(ctx, a[0], a[1], b[0], b[1], outerColor, 2)
    drawDiscreteLine(ctx, a[0], a[1], b[0], b[1], coreColor, 1)
  }
}
