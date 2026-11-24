// Shared material data maps and frame-atlas textures. The maps are small,
// original, deterministic, and tileable. They hold data, not colour, so they
// use NoColorSpace. Every material instance shares one texture per map ID or
// atlas; materials never dispose them. The runtime loads no remote URL.

import * as THREE from 'three'
import { getPfxSharedFireballFlipbookTexture, getPfxSharedFlameFlipbookTexture } from '../constants/04'
import { PFX_FIREBALL_FLIPBOOK_ATLAS } from '../fireballFlipbook'
import { PFX_FLAME_FLIPBOOK_ATLAS } from '../flameFlipbook'
import type { PfxAtlasDescriptor } from './atlas'
import type { PfxMaterialMapId } from './types'

export const PFX_MATERIAL_MAP_SIZE = 64

/** Integer lattice hash in 0..1. Deterministic across platforms. */
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

/** Periodic bilinear value noise. `period` lattice cells span the map. */
function periodicNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period
  const y = v * period
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const wrap = (value: number) => ((value % period) + period) % period
  const a = hash2(wrap(x0), wrap(y0), seed)
  const b = hash2(wrap(x0 + 1), wrap(y0), seed)
  const c = hash2(wrap(x0), wrap(y0 + 1), seed)
  const d = hash2(wrap(x0 + 1), wrap(y0 + 1), seed)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}

function fbm(u: number, v: number, seed: number): number {
  return periodicNoise(u, v, 4, seed) * 0.55 + periodicNoise(u, v, 8, seed + 1) * 0.3 + periodicNoise(u, v, 16, seed + 2) * 0.15
}

const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255)))

type MapWriter = (u: number, v: number) => [number, number, number, number]

const MAP_WRITERS: Record<PfxMaterialMapId, MapWriter> = {
  // R: tileable fractal value noise (distortion and dissolve). G: a second
  // independent octave set. B, A: unused, opaque.
  'noise-a': (u, v) => [fbm(u, v, 11), fbm(u, v, 29), 0, 1],
  // RG: divergence-free curl of a periodic potential, encoded so 0.5 = 0.
  'flow-a': (u, v) => {
    const e = 1 / PFX_MATERIAL_MAP_SIZE
    const dx = (fbm(u + e, v, 47) - fbm(u - e, v, 47)) / (2 * e)
    const dy = (fbm(u, v + e, 47) - fbm(u, v - e, 47)) / (2 * e)
    const length = Math.hypot(dx, dy) || 1
    const magnitude = Math.min(1, length / 6)
    return [0.5 + 0.5 * (dy / length) * magnitude, 0.5 - 0.5 * (dx / length) * magnitude, 0, 1]
  },
  // R: soft disc. G: bottom-to-top ramp. B: four soft vertical bands.
  // A: soft 4x4 checker. Each channel is a distinct, readable mask shape.
  'mask-a': (u, v) => {
    const radius = Math.hypot(u - 0.5, v - 0.5) * 2
    const disc = 1 - Math.min(1, Math.max(0, (radius - 0.55) / 0.4))
    const bands = 0.5 + 0.5 * Math.cos(u * Math.PI * 8)
    const checker = 0.5 + 0.5 * Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI * 8)
    return [disc, v, bands, checker]
  },
}

function createMapTexture(id: PfxMaterialMapId): THREE.DataTexture {
  const size = PFX_MATERIAL_MAP_SIZE
  const data = new Uint8Array(size * size * 4)
  const write = MAP_WRITERS[id]
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = write((x + 0.5) / size, (y + 0.5) / size)
      const offset = (y * size + x) * 4
      data[offset] = byte(r)
      data[offset + 1] = byte(g)
      data[offset + 2] = byte(b)
      data[offset + 3] = byte(a)
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.userData = { pfxMaterialMap: id }
  texture.needsUpdate = true
  return texture
}

const mapCache = new Map<PfxMaterialMapId, THREE.DataTexture>()

/** One shared texture per map ID. Callers must not dispose it. */
export function getPfxMaterialMap(id: PfxMaterialMapId): THREE.DataTexture {
  const cached = mapCache.get(id)
  if (cached) return cached
  const texture = createMapTexture(id)
  mapCache.set(id, texture)
  return texture
}

/**
 * `texture.userData` key of a host atlas texture's load state. A loader
 * texture has no image until its image decodes, so a pending load and a
 * failed load look the same without this record. Status reporters read it.
 */
export const PFX_TEXTURE_LOAD_USERDATA_KEY = 'pfxLoad'

export type PfxTextureLoadState =
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string }

const hostAtlasTextureCache = new WeakMap<PfxAtlasDescriptor, THREE.Texture>()
let hostAtlasTextureCount = 0

/**
 * Texture for a validated registry atlas. The built-in sheets reuse the
 * existing shared textures. A host or fixture sheet gets one cached texture
 * per descriptor, with the same filtering as the built-in sheets. A failed
 * image leaves the cache, so a new material for that atlas loads it again.
 */
export function getPfxMaterialAtlasTexture(atlas: PfxAtlasDescriptor): THREE.Texture {
  if (atlas.id === PFX_FLAME_FLIPBOOK_ATLAS.id && atlas.builtin) return getPfxSharedFlameFlipbookTexture()
  if (atlas.id === PFX_FIREBALL_FLIPBOOK_ATLAS.id && atlas.builtin) return getPfxSharedFireballFlipbookTexture()
  const cached = hostAtlasTextureCache.get(atlas)
  if (cached) return cached
  const setLoadState = (state: PfxTextureLoadState) => {
    texture.userData[PFX_TEXTURE_LOAD_USERDATA_KEY] = state
  }
  const texture = new THREE.TextureLoader().load(
    atlas.imageSource,
    () => setLoadState({ state: 'ready' }),
    undefined,
    () => {
      setLoadState({ state: 'error', message: `The image of atlas '${atlas.id}' could not be decoded` })
      if (hostAtlasTextureCache.get(atlas) === texture) hostAtlasTextureCache.delete(atlas)
    },
  )
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.userData = {
    pfxFlipbookAtlas: atlas.id,
    pfxFlipbookFrames: atlas.frameCount,
    [PFX_TEXTURE_LOAD_USERDATA_KEY]: { state: 'loading' } satisfies PfxTextureLoadState,
  }
  hostAtlasTextureCache.set(atlas, texture)
  hostAtlasTextureCount += 1
  return texture
}

export interface PfxMaterialMapStats {
  /** Shared data maps created so far (at most one per map ID). */
  maps: number
  /** Host or fixture atlas textures created so far. */
  hostAtlasTextures: number
}

export function getPfxMaterialMapStats(): PfxMaterialMapStats {
  return { maps: mapCache.size, hostAtlasTextures: hostAtlasTextureCount }
}
