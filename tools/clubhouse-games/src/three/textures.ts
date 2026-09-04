import * as THREE from 'three'
import { paintBack } from '../backs/paintBack'
import { BackTheme } from '../backs/backThemes'
import { cardId } from '../deck'
import { paintFace, PaintFaceOptions } from '../faces/paintFace'
import { Card } from '../types'

// Spike-verified recipe: without SRGBColorSpace colors wash out under R3F's
// sRGB output pipeline; anisotropy keeps back patterns from shimmering at
// oblique flip angles.
export function toTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(8, maxAnisotropy)
  tex.needsUpdate = true
  return tex
}

// Family painters call this with a fully-specified cache key so textures are
// painted once and shared across every mesh showing the same face/back.
// Keys are family-prefixed (`card-face:`, `die-face:`, …) so card-specific
// disposal can stay card-specific.
const caches = new Map<string, THREE.CanvasTexture>()

export function getCachedTexture(
  key: string,
  paint: () => HTMLCanvasElement,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  let tex = caches.get(key)
  if (!tex) {
    tex = toTexture(paint(), maxAnisotropy)
    caches.set(key, tex)
  }
  return tex
}

export function getFaceTexture(
  card: Card,
  maxAnisotropy: number,
  opts: PaintFaceOptions = {},
): THREE.CanvasTexture {
  const key = `card-face:${cardId(card)}:${opts.scale ?? 1}:${opts.background ?? ''}:${opts.borderColor ?? ''}`
  return getCachedTexture(key, () => paintFace(card, opts), maxAnisotropy)
}

export function getBackTexture(
  theme: BackTheme,
  maxAnisotropy: number,
  scale = 1,
): THREE.CanvasTexture {
  // Key on every theme field, not just id — a custom theme that reuses a
  // preset's id must not collide with the cached preset texture.
  const key = `card-back:${theme.id}:${theme.base}:${theme.pattern}:${theme.patternColor}:${theme.borderColor}:${scale}`
  return getCachedTexture(key, () => paintBack(theme, { scale }), maxAnisotropy)
}

// Loads a user/AI-authored PNG back. TextureLoader results also need the
// sRGB + anisotropy recipe applied manually.
export async function loadBackTexture(
  url: string,
  maxAnisotropy: number,
): Promise<THREE.Texture> {
  const tex = await new THREE.TextureLoader().loadAsync(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(8, maxAnisotropy)
  tex.needsUpdate = true
  return tex
}

// Disposes every cached texture (e.g. when tearing down a card-heavy scene
// for good). Meshes still showing those cards must be unmounted first.
export function disposeCardTextureCaches(): void {
  for (const [key, tex] of caches) {
    if (!key.startsWith('card-')) continue
    tex.dispose()
    caches.delete(key)
  }
}
