export type BurgerShopTextureId =
  | 'poof-01'
  | 'poof-02'
  | 'smoke'
  | 'ring'
  | 'mask-01'
  | 'flies'
  | 'food-scraps'
  | 'sparkle'
  | 'star-01'
  | 'star-02'
  | 'sign'
  | 'arrow'
  | 'glow'
  | 'sunshine'
  | 'confetti'

export type BurgerShopBillboard = 'camera' | 'horizontal' | 'vertical' | 'mesh'
export type BurgerShopBlend = 'cutout' | 'additive' | 'alpha'
export type BurgerShopShape =
  /** `shell`: spawn on the surface only (a dome or bubble), not through the volume. */
  | { kind: 'sphere'; radius: number; shell?: boolean }
  | { kind: 'hemisphere'; radius: number; shell?: boolean }
  | { kind: 'cone'; angle: number; radius: number; length?: number }
  | { kind: 'cone-volume'; angle: number; radius: number; length: number }
  | { kind: 'box'; size: [number, number, number] }
  | { kind: 'rectangle'; size: [number, number] }
  | { kind: 'point' }
  /** The edge of a circle in the local XY plane; particles move outward. */
  | { kind: 'circle'; radius: number }

export interface BurgerShopRange {
  min: number
  max: number
}

export interface BurgerShopEmitter {
  name: string
  texture: string
  sheet: { columns: number; rows: number }
  billboard: BurgerShopBillboard
  blend: BurgerShopBlend
  duration: number
  looping: boolean
  delay?: number
  life: BurgerShopRange
  speed: BurgerShopRange
  size: BurgerShopRange
  gravity: number
  rate: number
  rateOverDistance?: number
  burst?: BurgerShopRange
  shape: BurgerShopShape
  sizeOverLife?: [number, number]
  sizeCurve?: { t: number; v: number }[]
  /** Keep a random sheet cell instead of playing the grid as a flipbook. */
  sheetVariant?: boolean
  rotateOverLife?: boolean
  startRotation?: BurgerShopRange
  noise?: BurgerShopRange
  trailLife?: number
  lumaAlpha?: boolean
  color: number[][]
  localEuler?: [number, number, number]
  localPosition?: [number, number, number]
  localScale?: [number, number, number]
  minHeight?: number
  /** World-space velocity over life. */
  worldVelocity?: [number, number, number]
  /** Particle geometry. `cube` draws voxel debris (RUN voxel packs); default `plane`. */
  geometry?: 'plane' | 'cube'
  /** Colour over life: keys multiply the spawn colour (rgba), linear between keys. */
  colorOverLife?: { t: number; c: [number, number, number, number] }[]
  /** Velocity loss per second (0 = none; 4 = a spark stops in about half a second). */
  drag?: number
  /**
   * Stretch along the velocity: the particle is `size` wide and
   * `size + speed * stretch` long, turned to face the camera around its
   * velocity axis. For sparks and bolts only.
   */
  stretch?: number
  /**
   * Simulate in world space: particles keep the place and direction where
   * they were born, so a moving socket leaves a trail (slash arcs, exhaust)
   * and gravity pulls along world down. Default: the effect's own space.
   */
  worldSpace?: boolean
  /**
   * A ribbon instead of particles: every frame, the line from (0, from, 0) to
   * (0, to, 0) of the effect (its +Y, the aim) is sampled in world space, and a
   * strip joins the samples for `life` seconds, so a moving socket sweeps a
   * trail along its real path (a blade swing). When the effect does not move,
   * the line turns `sweep` degrees about the effect's Z in the first 30% of
   * the emitter's duration instead, so a still preview still shows a swipe. Uses `texture`
   * (u = age, v = from → to), `color[0]` and `colorOverLife` (by age), `blend`.
   */
  ribbon?: {
    from: number
    to: number
    life: number
    sweep?: number
    /**
     * Only draw where the tip moves at least this fast (effect units per
     * second): a looping trail then shows during swings only, whatever the
     * clip timing. When the effect stands still, the `sweep` repeats once per
     * emitter duration.
     */
    minSpeed?: number
    /**
     * 0–1: how far each sample's base slides toward its tip as it ages, so the
     * trail thins from the full blade at the head to a point at the tail (a
     * crescent, not a band). Default 0.
     */
    taper?: number
  }
  /** Turn rate (radians per second) of each particle around the effect's vertical axis (x = z = 0): vortices, orbits. */
  swirl?: number
}

export interface BurgerShopRecipe {
  id: string
  label: string
  sourcePrefab: string
  duration: number
  looping: boolean
  emitters: BurgerShopEmitter[]
}

export interface BurgerShopParticle {
  emitter: number
  age: number
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  roll: number
  spin: number
  color: [number, number, number, number]
  sheetIndex: number
  /** World-space particles: world units per effect unit at birth (scales size, gravity and noise). */
  unit?: number
}

export const BURGER_SHOP_WORLD_SCALE = 0.24
export const BURGER_SHOP_GRAVITY = 9.81
