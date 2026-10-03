/**
 * Declared here rather than imported from `../catalog`, so this module can be
 * copied into another app whole. The shape is identical to the catalogue's, so
 * a `PirateNationModelEntry['bounds']` is assignable without a cast.
 */
export interface Vec3Tuple extends Array<number> {
  0: number
  1: number
  2: number
}

export interface ModelBounds {
  min: Vec3Tuple
  max: Vec3Tuple
  size: Vec3Tuple
}

/**
 * Where the transformed model sits relative to `at`.
 *
 * - `base`   — the scaled bounding box rests on `at.y`, centred on x/z. Use
 *              this to put several models on one ground plane.
 * - `center` — the bounding-box centre lands on `at`. Use this to frame one
 *              model.
 * - `native` — upstream coordinates, translated by `at` only.
 */
export type ModelAnchor = 'base' | 'center' | 'native'

export interface ModelPlacement {
  scale: number
  position: [number, number, number]
}

export interface ModelTransformOptions {
  /** Target size of the largest dimension, in world units. Omit to keep native scale. */
  fit?: number
  anchor?: ModelAnchor
  at?: [number, number, number]
}

/**
 * Turns a catalogue entry's bounds into a uniform scale and a position.
 *
 * Pack models span roughly 94x in largest dimension (p5 ≈ 2 units, p95 ≈ 185)
 * and only 147 of 355 sit on y=0 — 209 extend below it, one as far as −120.
 * So placing two models in one scene needs both a normalising scale and an
 * explicit anchor; native transforms alone put one model out of frame or
 * underground.
 */
export function modelTransform(
  bounds: ModelBounds,
  options: ModelTransformOptions = {},
): ModelPlacement {
  const { fit, anchor = 'center', at = [0, 0, 0] } = options
  const largest = Math.max(bounds.size[0], bounds.size[1], bounds.size[2])

  let scale = 1
  if (fit !== undefined) {
    // `characters-skins-animation-template` carries synthetic unit-cube bounds
    // because it has no meshes; a genuinely zero-size box would divide to
    // Infinity and silently blank the scene, so refuse it here instead.
    if (largest <= 0) {
      throw new Error('modelTransform: cannot fit zero-size bounds')
    }
    scale = fit / largest
  }

  if (anchor === 'native') {
    return { scale, position: [at[0], at[1], at[2]] }
  }

  const centreX = (bounds.min[0] + bounds.max[0]) / 2
  const centreZ = (bounds.min[2] + bounds.max[2]) / 2
  const centreY = (bounds.min[1] + bounds.max[1]) / 2
  const offsetY = anchor === 'base' ? bounds.min[1] : centreY

  return {
    scale,
    position: [at[0] - centreX * scale, at[1] - offsetY * scale, at[2] - centreZ * scale],
  }
}
