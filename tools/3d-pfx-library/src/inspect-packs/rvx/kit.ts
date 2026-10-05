/**
 * RUN voxel effect archetypes. Each pack file (fantasy.ts, space.ts, …) calls
 * these with its theme colours, so the same kind of effect has the same
 * timing, layer stack and size in every pack, and only the colours and small
 * details change. Units and axes: see common.ts (nominal size 1, +Y = aim).
 *
 * Timing follows the craft guide (docs/pfx-craft-guide.md): one-shots are
 * anticipation → peak (a flash in the first 0.1 s) → dissipation, and are
 * over in about a second; loops keep 10–40 live particles.
 */
import {
  around,
  crescent,
  constant,
  coneUp,
  cubes,
  EXPAND,
  FADE_IN_OUT,
  fadeOut,
  FIRE,
  flames,
  flat,
  FLASH,
  glints,
  glow,
  HALO,
  loop,
  oneShot,
  puffs,
  range,
  ribbon,
  ring,
  SHRINK,
  sparks,
  TWINKLE,
  UP,
  WHITE,
  type Rgba,
  type RvxEmitter,
  type RvxMeta,
  type RvxRecipe,
} from './common'

type Colors = Rgba[]

/** A dim copy of a colour, for halos. */
export const dim = (c: Rgba, alpha: number): Rgba => [c[0], c[1], c[2], alpha]

// ------------------------------------------------------------------ loops

/** Chimney or exhaust smoke: puffs rise, drift with the wind (world space) and shrink away. */
export function smokeColumn(
  meta: RvxMeta,
  o: { colors: Colors; rate?: number; rise?: number; drift?: number; embers?: Colors },
): RvxRecipe {
  const layers: RvxEmitter[] = [
    puffs({
      name: 'Smoke',
      worldSpace: true,
      rate: o.rate ?? 4,
      life: range(1.8, 2.4),
      speed: range((o.rise ?? 1) * 0.45, (o.rise ?? 1) * 0.65),
      size: range(0.45, 0.6),
      shape: coneUp(14, 0.12),
      localEuler: UP,
      drag: 0.2,
      gravity: -0.012,
      worldVelocity: [o.drift ?? 0.18, 0, 0.05],
      noise: range(0.08, 0.14),
      color: o.colors,
      colorOverLife: [
        { t: 0, c: [1, 1, 1, 1] },
        { t: 1, c: [0.82, 0.82, 0.82, 1] },
      ],
    }),
  ]
  if (o.embers)
    layers.push(
      cubes({
        name: 'Embers',
        worldSpace: true,
        rate: 3,
        life: range(0.7, 1.1),
        speed: range(0.5, 0.9),
        size: range(0.035, 0.05),
        shape: coneUp(20, 0.1),
        localEuler: UP,
        gravity: -0.03,
        noise: range(0.3, 0.5),
        color: o.embers,
      }),
    )
  return loop(meta, 2, layers)
}

/**
 * Fire. 'torch': one tongue of flame about 1 unit tall. 'hearth': a wide
 * bed of flame (brazier, campfire, barrel). `tint` recolours the flame for
 * magic fire (white spawn × tint keys).
 */
export function fire(
  meta: RvxMeta,
  o: { kind: 'torch' | 'hearth'; smoke?: Colors; embers?: Colors; halo?: Rgba; tint?: NonNullable<RvxEmitter['colorOverLife']>; follow?: boolean },
): RvxRecipe {
  const hearth = o.kind === 'hearth'
  const layers: RvxEmitter[] = [
    glow({
      name: 'Halo',
      burst: undefined,
      rate: 2.5,
      life: constant(0.8),
      size: range(hearth ? 1.7 : 1.3, hearth ? 1.9 : 1.5),
      sizeCurve: HALO,
      localPosition: [0, 0.35, 0],
      colorOverLife: FADE_IN_OUT,
      color: [o.halo ?? dim(FIRE.orange, 0.22)],
    }),
    flames({
      name: 'Flames',
      worldSpace: true,
      rate: hearth ? 20 : 14,
      life: range(0.4, 0.62),
      // Flames rise along world up whatever the socket's angle (a tilted torch still burns up).
      speed: range(0.15, 0.3),
      worldVelocity: [0, 1, 0],
      size: range(hearth ? 0.4 : 0.42, hearth ? 0.56 : 0.58),
      ...(hearth ? flat(0.55, 0.45) : { shape: coneUp(8, 0.07), localEuler: UP }),
      drag: 1.2,
      gravity: -0.02,
      noise: range(0.15, 0.25),
      startRotation: range(-0.18, 0.18),
      ...(o.tint ? { colorOverLife: o.tint } : {}),
    }),
    flames({
      name: 'Core',
      worldSpace: true,
      rate: hearth ? 10 : 7,
      life: range(0.25, 0.38),
      speed: range(0.1, 0.2),
      worldVelocity: [0, 0.7, 0],
      size: range(0.26, 0.36),
      ...(hearth ? flat(0.35, 0.3) : { shape: coneUp(5, 0.04), localEuler: UP }),
      startRotation: range(-0.1, 0.1),
      colorOverLife: o.tint ? o.tint.slice(0, 2) : [
        { t: 0, c: FIRE.white },
        { t: 1, c: FIRE.yellow },
      ],
    }),
    cubes({
      name: 'Embers',
      worldSpace: true,
      rate: hearth ? 5 : 3,
      life: range(0.6, 1.1),
      speed: range(0.2, 0.5),
      worldVelocity: [0, 1, 0],
      size: range(0.035, 0.05),
      shape: coneUp(25, hearth ? 0.25 : 0.08),
      localEuler: UP,
      gravity: -0.04,
      drag: 0.8,
      noise: range(0.4, 0.7),
      color: o.embers ?? [FIRE.yellow, FIRE.orange],
      colorOverLife: [
        { t: 0, c: [1, 1, 1, 1] },
        { t: 1, c: [0.8, 0.45, 0.3, 1] },
      ],
    }),
  ]
  if (o.smoke)
    layers.push(
      puffs({
        name: 'Smoke',
        worldSpace: true,
        rate: 2,
        delay: 0,
        life: range(1, 1.4),
        speed: range(0.5, 0.7),
        size: range(0.22, 0.32),
        shape: coneUp(10, 0.06),
        localEuler: UP,
        localPosition: [0, 0.75, 0],
        gravity: -0.01,
        worldVelocity: [0.12, 0, 0],
        color: o.smoke,
      }),
    )
  // `follow`: every layer moves with the socket. A small flame in a moving hand (a wick, a
  // lantern candle) would leave its world-space flames and embers behind in the air.
  return loop(meta, 2, o.follow ? layers.map((l) => ({ ...l, worldSpace: false })) : layers)
}

/** A lamp or lantern: a warm halo that breathes and a few motes. */
export function lampGlow(meta: RvxMeta, o: { halo: Rgba; motes: Colors; glints?: boolean }): RvxRecipe {
  const layers: RvxEmitter[] = [
    glow({
      name: 'Halo',
      burst: undefined,
      rate: 2,
      life: constant(1),
      size: range(1.1, 1.3),
      sizeCurve: HALO,
      colorOverLife: FADE_IN_OUT,
      color: [o.halo],
    }),
    cubes({
      name: 'Motes',
      rate: 3,
      life: range(1, 1.6),
      speed: range(0.08, 0.16),
      size: range(0.045, 0.06),
      shape: { kind: 'sphere', radius: 0.35 },
      gravity: -0.008,
      noise: range(0.1, 0.2),
      color: o.motes,
      sizeCurve: TWINKLE,
    }),
  ]
  if (o.glints)
    layers.push(glints({ name: 'Glint', rate: 1.2, life: range(0.35, 0.5), size: range(0.16, 0.22), shape: { kind: 'sphere', radius: 0.3 }, color: o.motes }))
  return loop(meta, 2, layers)
}

/** Motes that drift up and twinkle: fairies, wisps, spores, holy light. */
export function motes(
  meta: RvxMeta,
  o: { colors: Colors; halo?: Rgba; glints?: Colors; rate?: number; spread?: number; rise?: number },
): RvxRecipe {
  const spread = o.spread ?? 0.5
  const layers: RvxEmitter[] = [
    cubes({
      name: 'Motes',
      rate: o.rate ?? 8,
      life: range(1.2, 1.9),
      speed: range(0.05, 0.12),
      size: range(0.055, 0.08),
      ...flat(spread * 2, spread * 2, 0.3),
      gravity: -0.02 * (o.rise ?? 1),
      noise: range(0.2, 0.35),
      sizeCurve: TWINKLE,
      color: o.colors,
    }),
  ]
  if (o.glints)
    layers.push(
      glints({ name: 'Glints', rate: 3, life: range(0.4, 0.6), size: range(0.2, 0.28), ...flat(spread * 2, spread * 2, 0.8), localPosition: [0, 0.3, 0], color: o.glints }),
    )
  if (o.halo)
    layers.unshift(
      glow({ name: 'Halo', burst: undefined, rate: 1.5, life: constant(1.2), size: constant(spread * 2.4), sizeCurve: HALO, colorOverLife: FADE_IN_OUT, color: [o.halo] }),
    )
  return loop(meta, 2, layers)
}

/** A treasure glint: now and then a star flashes on the pile. */
export function glint(meta: RvxMeta, o: { colors: Colors; spread?: number }): RvxRecipe {
  const s = o.spread ?? 0.5
  return loop(meta, 2, [
    glints({ name: 'Glints', rate: 3, life: range(0.4, 0.55), size: range(0.3, 0.42), ...flat(s * 2, s * 2, s), color: o.colors }),
    cubes({ name: 'Sparkle', rate: 5, life: range(0.5, 0.8), speed: range(0.1, 0.2), size: range(0.04, 0.055), ...flat(s * 2, s * 2, s), gravity: -0.01, sizeCurve: TWINKLE, color: o.colors }),
  ])
}

/** Bubbles rise out of a liquid and pop into chips; a low fume hangs over it. */
export function bubbles(meta: RvxMeta, o: { bubble: Colors; fume?: Colors; chips?: Colors; width?: number }): RvxRecipe {
  const w = o.width ?? 0.7
  const layers: RvxEmitter[] = [
    {
      ...puffs({ name: 'Bubbles', color: o.bubble }),
      texture: 'rvx-bubble',
      sheet: { columns: 1, rows: 1 },
      sheetVariant: false,
      rotateOverLife: false,
      rate: 6,
      life: range(0.6, 1),
      speed: range(0.25, 0.45),
      size: range(0.1, 0.2),
      ...flat(w),
      noise: range(0.1, 0.2),
      sizeCurve: [
        { t: 0, v: 0.2 },
        { t: 0.8, v: 1 },
        { t: 0.9, v: 1.25 },
        { t: 1, v: 0 },
      ],
    },
    cubes({
      name: 'Pops',
      rate: 4,
      delay: 0.4,
      life: range(0.25, 0.4),
      speed: range(0.4, 0.8),
      size: range(0.03, 0.045),
      shape: { kind: 'hemisphere', radius: w * 0.4 },
      localEuler: UP,
      localPosition: [0, 0.3, 0],
      gravity: 0.35,
      color: o.chips ?? o.bubble,
    }),
  ]
  if (o.fume)
    layers.push(
      puffs({
        name: 'Fume',
        rate: 2,
        life: range(1.4, 1.9),
        speed: range(0.12, 0.2),
        size: range(0.25, 0.35),
        ...flat(w * 0.6, w * 0.6, 0.1),
        localPosition: [0, 0.15, 0],
        colorOverLife: HAZE,
        color: o.fume,
      }),
    )
  return loop(meta, 2, layers)
}

/** Pieces orbit a core: arcane spires, portals, auras. `runes` adds pixel glyphs to the orbit. */
export function orbit(
  meta: RvxMeta,
  o: { colors: Colors; core?: Rgba; runes?: Colors; radius?: number; spin?: number; ring?: Rgba; dome?: Rgba; rise?: number; lift?: number },
): RvxRecipe {
  const r = o.radius ?? 0.5
  const spin = o.spin ?? 2.4
  const layers: RvxEmitter[] = [
    cubes({
      name: 'Orbit',
      rate: 12,
      life: range(1.1, 1.6),
      speed: constant(0),
      size: range(0.07, 0.1),
      ...around(r),
      swirl: spin,
      worldVelocity: [0, 0.08 * (o.rise ?? 1), 0],
      noise: range(0.04, 0.08),
      sizeCurve: TWINKLE,
      color: o.colors,
    }),
  ]
  if (o.runes)
    layers.push({
      ...glints({ name: 'Runes', color: o.runes }),
      texture: 'rvx-runes',
      sheet: { columns: 2, rows: 2 },
      sheetVariant: true,
      startRotation: constant(0),
      rate: 2,
      life: range(0.9, 1.3),
      size: range(0.2, 0.24),
      ...around(r * 1.05),
      swirl: spin,
      sizeCurve: [
        { t: 0, v: 0 },
        { t: 0.2, v: 1 },
        { t: 0.8, v: 1 },
        { t: 1, v: 0 },
      ],
    })
  if (o.core)
    layers.unshift(
      glow({ name: 'Core', burst: undefined, rate: 2, life: constant(1), size: range(r * 1.6, r * 1.9), sizeCurve: HALO, colorOverLife: FADE_IN_OUT, color: [o.core] }),
    )
  if (o.ring)
    layers.push(
      ring({ name: 'Ring', billboard: 'horizontal', burst: undefined, rate: 1, life: constant(1), size: constant(r * 2.3), sizeCurve: [{ t: 0, v: 0.85 }, { t: 1, v: 1.05 }], colorOverLife: FADE_IN_OUT, color: [o.ring] }),
    )
  // `dome`: hex cells that twinkle on a hemisphere shell give the field its curve, and a
  // bubble rim that faces the camera gives it an outline from every side. Two rims overlap
  // at any time (rate 2, life 1), so the fade in and out keeps it steady.
  if (o.dome)
    layers.push(
      cubes({
        name: 'DomeCells',
        rate: 34,
        life: range(0.5, 0.9),
        speed: constant(0),
        size: range(0.05, 0.07),
        shape: { kind: 'hemisphere', radius: r * 1.02, shell: true },
        localEuler: UP,
        sizeCurve: TWINKLE,
        color: [o.dome, o.colors[0]!],
      }),
      ring({ name: 'Dome', billboard: 'camera', burst: undefined, rate: 2, life: constant(1), size: constant(r * 2.05), sizeCurve: [{ t: 0, v: 0.98 }, { t: 1, v: 1.02 }], colorOverLife: FADE_IN_OUT, color: [o.dome] }),
    )
  // `lift` moves the whole orbit along +Y, e.g. in front of a solid portal face.
  const lifted = o.lift ? layers.map((l) => ({ ...l, localPosition: [0, o.lift!, 0] as [number, number, number] })) : layers
  return loop(meta, 2, lifted)
}

/** Things fall and flutter from a canopy: leaves, petals, ash, snow. */
export function fall(meta: RvxMeta, o: { colors: Colors; texture?: 'rvx-leaf' | 'voxel'; width?: number; rate?: number }): RvxRecipe {
  const w = o.width ?? 1
  const leaf = (o.texture ?? 'rvx-leaf') === 'rvx-leaf'
  const piece = leaf
    ? { ...glints({ name: 'Leaves', color: o.colors }), texture: 'rvx-leaf', rotateOverLife: true, startRotation: undefined }
    : cubes({ name: 'Leaves', color: o.colors })
  return loop(meta, 3, [
    {
      ...piece,
      rate: o.rate ?? 7,
      life: range(2, 2.8),
      speed: constant(0),
      size: leaf ? range(0.14, 0.2) : range(0.05, 0.08),
      shape: { kind: 'box', size: [w, 0.3, w] },
      gravity: 0.012,
      drag: 1.5,
      noise: range(0.35, 0.55),
      worldVelocity: [0.08, -0.1, 0.03],
      sizeCurve: [
        { t: 0, v: 0 },
        { t: 0.1, v: 1 },
        { t: 0.85, v: 1 },
        { t: 1, v: 0 },
      ],
    },
  ])
}

/** Low mist that rolls out and sinks: fog pits, coffins, waterfalls, graves. */
/** Haze: fades in, holds at a little over half opacity, fades out. Mist and fumes drawn
 * opaque read as a pile of faceted rocks, not as vapour. */
const HAZE: NonNullable<RvxEmitter['colorOverLife']> = [
  { t: 0, c: [1, 1, 1, 0] },
  { t: 0.25, c: [1, 1, 1, 0.55] },
  { t: 0.7, c: [1, 1, 1, 0.55] },
  { t: 1, c: [1, 1, 1, 0] },
]

/** A puff layer redrawn as a soft blob: the soft-circle texture, one sheet cell, no spin. */
function softMist(layer: RvxEmitter): RvxEmitter {
  return { ...layer, texture: 'soft-circle', lumaAlpha: true, sheet: { columns: 1, rows: 1 }, sheetVariant: false, rotateOverLife: false }
}

export function mist(meta: RvxMeta, o: { colors: Colors; width?: number; motes?: Colors; rate?: number }): RvxRecipe {
  const w = o.width ?? 1
  const layers: RvxEmitter[] = [
    // Mist is drawn with the soft circle, not the faceted puff: even half-transparent, puff
    // facets read as flat sheets or rocks. A soft blob shows a little smaller, so it is larger.
    softMist(
      puffs({
        name: 'Mist',
        rate: o.rate ?? 5,
        life: range(1.6, 2.4),
        speed: range(0.08, 0.16),
        size: range(0.5, 0.7),
        ...flat(w, w, 0.08),
        drag: 0.4,
        noise: range(0.06, 0.12),
        colorOverLife: HAZE,
        color: o.colors,
      }),
    ),
  ]
  if (o.motes)
    layers.push(
      cubes({ name: 'Motes', rate: 3, life: range(1, 1.5), speed: range(0.1, 0.2), size: range(0.03, 0.045), ...flat(w, w, 0.2), gravity: -0.015, noise: range(0.15, 0.3), sizeCurve: TWINKLE, color: o.motes }),
    )
  return loop(meta, 2, layers)
}

// ------------------------------------------------------------------ one-shots

export interface BurstSpec {
  /** The first-frame flash: an additive halo. */
  flash?: Rgba
  /** A hard star at the hit point. */
  star?: Rgba
  /** Stretched sparks flying out. */
  sparks?: Colors
  sparkCount?: number
  /** Voxel debris thrown out and falling. */
  cubes?: Colors
  cubeCount?: number
  /** Puffs pushed out in a ring (dust, smoke, mist). */
  puffs?: Colors
  /** A shockwave ring; 'flat' lies on the ground, 'face' faces the view. */
  ring?: { color: Rgba; kind: 'flat' | 'face' }
  /** Custom texture pieces thrown out (drops, shards, leaves, skulls, bats). */
  pieces?: {
    texture: string
    colors: Colors
    count: number
    sheet?: { columns: number; rows: number }
    /** Play the sheet as a flipbook (flapping bats) instead of one random cell each. */
    flipbook?: boolean
    size?: number
    gravity?: number
  }
  /** Hemisphere (ground hits) or sphere (air hits). */
  ground?: boolean
  /** Spread multiplier: 1 = the burst fills about 1 unit. */
  reach?: number
}

/** An impact or pop: flash → star → sparks, debris and puffs → gone in about a second. */
export function burst(meta: RvxMeta, s: BurstSpec): RvxRecipe {
  const reach = s.reach ?? 1
  const shape = s.ground ? { kind: 'hemisphere' as const, radius: 0.08 } : { kind: 'sphere' as const, radius: 0.08 }
  const euler = s.ground ? UP : undefined
  const layers: RvxEmitter[] = []
  if (s.flash) layers.push(glow({ name: 'Flash', life: constant(0.16), size: constant(1.1 * reach), color: [s.flash] }))
  if (s.ring)
    layers.push(
      ring({
        name: 'Shock',
        billboard: s.ring.kind === 'flat' ? 'horizontal' : 'camera',
        life: constant(0.32),
        size: constant(1.25 * reach),
        localPosition: s.ring.kind === 'flat' ? [0, 0.02, 0] : [0, 0, 0],
        color: [s.ring.color],
      }),
    )
  if (s.puffs)
    layers.push(
      puffs({
        name: 'Puffs',
        burst: range(6, 8),
        life: range(0.5, 0.8),
        speed: range(2.2 * reach, 3 * reach),
        drag: 5,
        size: range(0.26 * reach, 0.36 * reach),
        shape: s.ground ? { kind: 'cone', angle: 80, radius: 0.1 } : shape,
        localEuler: euler,
        localScale: s.ground ? [1, 1, 0.3] : undefined,
        gravity: -0.03,
        color: s.puffs,
      }),
    )
  if (s.cubes)
    layers.push(
      cubes({
        name: 'Debris',
        burst: constant(s.cubeCount ?? 8),
        life: range(0.5, 0.8),
        speed: range(2 * reach, 3.4 * reach),
        drag: 1.2,
        gravity: 0.9,
        size: range(0.06 * reach, 0.1 * reach),
        shape,
        localEuler: euler,
        minHeight: s.ground ? 0 : undefined,
        color: s.cubes,
      }),
    )
  if (s.pieces)
    layers.push({
      ...glints({ name: 'Pieces', color: s.pieces.colors }),
      texture: s.pieces.texture,
      sheet: s.pieces.sheet ?? { columns: 1, rows: 1 },
      sheetVariant: Boolean(s.pieces.sheet) && !s.pieces.flipbook,
      rotateOverLife: true,
      startRotation: undefined,
      burst: constant(s.pieces.count),
      life: range(0.5, 0.8),
      speed: range(1.8 * reach, 3 * reach),
      drag: 1.5,
      gravity: s.pieces.gravity ?? 0.6,
      size: range((s.pieces.size ?? 0.14) * reach * 0.8, (s.pieces.size ?? 0.14) * reach * 1.2),
      shape,
      localEuler: euler,
      minHeight: s.ground ? 0 : undefined,
      sizeCurve: [
        { t: 0, v: 0.5 },
        { t: 0.1, v: 1 },
        { t: 0.7, v: 1 },
        { t: 1, v: 0 },
      ],
    })
  if (s.sparks)
    layers.push(
      sparks({
        name: 'Sparks',
        burst: constant(s.sparkCount ?? 10),
        speed: range(4 * reach, 6 * reach),
        shape,
        localEuler: euler,
        color: s.sparks,
      }),
    )
  if (s.star) layers.push(glints({ name: 'Star', burst: constant(1), life: constant(0.24), size: constant(0.95 * reach), sizeCurve: FLASH, color: [s.star] }))
  return oneShot(meta, 1.2, layers)
}

/** A gun or launcher firing along +Y: flash, forward star, puffs and sparks. */
export function muzzle(meta: RvxMeta, o: { flash: Rgba; core?: Rgba; smoke?: Colors; sparks?: Colors; big?: boolean }): RvxRecipe {
  const k = o.big ? 1.35 : 1
  const layers: RvxEmitter[] = [
    glow({ name: 'Flash', life: constant(0.1), size: constant(0.9 * k), localPosition: [0, 0.25, 0], color: [o.flash] }),
    {
      ...sparks({ name: 'Blast', color: [o.core ?? WHITE] }),
      texture: 'rvx-star',
      blend: 'alpha',
      burst: constant(1),
      life: constant(0.09),
      speed: constant(0.02),
      size: constant(0.22 * k),
      stretch: 32 * k,
      drag: 0,
      gravity: 0,
      shape: coneUp(0, 0),
      localEuler: UP,
      localPosition: [0, 0.3 * k, 0],
      sizeCurve: FLASH,
    },
    glints({ name: 'Star', burst: constant(1), life: constant(0.12), size: constant(0.7 * k), sizeCurve: FLASH, localPosition: [0, 0.1, 0], color: [o.flash] }),
  ]
  // Gun smoke is soft (softMist): small faceted puffs read as flat grey shards beside a muzzle.
  if (o.smoke)
    layers.push(
      softMist(puffs({
        name: 'Smoke',
        burst: range(4, 5),
        delay: 0.03,
        life: range(0.5, 0.8),
        speed: range(1.2 * k, 2 * k),
        drag: 4,
        size: range(0.2 * k, 0.3 * k),
        shape: coneUp(22, 0.04),
        localEuler: UP,
        gravity: -0.03,
        color: o.smoke,
      })),
    )
  if (o.sparks)
    layers.push(sparks({ name: 'Sparks', burst: constant(6), speed: range(3.5, 5.5), shape: coneUp(28, 0.03), localEuler: UP, color: o.sparks }))
  return oneShot(meta, 1, layers)
}

/** An energy bolt leaving along +Y: a long streak that flies out, a muzzle ring and sparkle. */
export function bolt(meta: RvxMeta, o: { core: Rgba; edge: Rgba; sparks?: Colors }): RvxRecipe {
  // A bolt flies 3 effect sizes in 0.5 s: fast enough to read as a shot, slow enough that it is
  // seen leaving the muzzle, not only far ahead of it.
  return oneShot(meta, 0.8, [
    glow({ name: 'Flash', life: constant(0.12), size: constant(0.8), color: [dim(o.edge, 0.7)] }),
    ring({ name: 'MuzzleRing', billboard: 'mesh', localEuler: UP, life: constant(0.2), size: constant(0.5), color: [o.edge] }),
    {
      ...sparks({ name: 'Bolt', color: [o.edge] }),
      blend: 'alpha',
      burst: constant(1),
      life: constant(0.5),
      speed: constant(6),
      size: constant(0.18),
      stretch: 0.14,
      drag: 0,
      gravity: 0,
      shape: coneUp(0, 0),
      localEuler: UP,
      sizeCurve: [
        { t: 0, v: 1 },
        { t: 0.85, v: 1 },
        { t: 1, v: 0 },
      ],
    },
    {
      ...sparks({ name: 'BoltCore', color: [o.core] }),
      blend: 'alpha',
      burst: constant(1),
      life: constant(0.5),
      speed: constant(6),
      size: constant(0.09),
      stretch: 0.12,
      drag: 0,
      gravity: 0,
      shape: coneUp(0, 0),
      localEuler: UP,
      sizeCurve: [
        { t: 0, v: 1 },
        { t: 0.85, v: 1 },
        { t: 1, v: 0 },
      ],
    },
    sparks({ name: 'Sparks', burst: constant(6), speed: range(2, 3.5), shape: coneUp(40, 0.03), localEuler: UP, color: o.sparks ?? [o.edge] }),
  ])
}

/**
 * A torch or flashlight cone along +Y: soft glows that grow and fade along the aim, and a thin
 * bright core. A single column reads as a flat bar seen side-on; a cone of soft light does not.
 */
export function lightCone(meta: RvxMeta, o: { color: Rgba; length?: number }): RvxRecipe {
  const len = o.length ?? 2.4
  // glows overlap by about two thirds, so they merge into one cone
  const steps = 12
  const cone: RvxEmitter[] = Array.from({ length: steps }, (_, i) => {
    const u = (i + 0.5) / steps
    return glow({
      name: `Cone${i + 1}`,
      burst: undefined,
      rate: 2,
      life: constant(1),
      size: constant(0.5 + u * 1.2),
      sizeCurve: HALO,
      localPosition: [0, u * len, 0],
      colorOverLife: FADE_IN_OUT,
      color: [dim(o.color, 0.28 * (1 - u * 0.75))],
    })
  })
  return loop(meta, 2, [...cone, glow({ name: 'Lens', burst: undefined, rate: 2, life: constant(1), size: constant(0.45), sizeCurve: HALO, colorOverLife: FADE_IN_OUT, color: [dim(o.color, 0.8)] })])
}

/** A beam up +Y (teleporter, tractor beam, flashlight): a tall column that breathes, with rising motes. */
export function beam(
  meta: RvxMeta,
  o: { color: Rgba; motes?: Colors; length?: number; width?: number; oneShotDuration?: number },
): RvxRecipe {
  const length = o.length ?? 2
  const width = o.width ?? 0.6
  // A near-still particle stretched along its tiny +Y speed draws a column
  // `width` wide and `length` long, facing the camera around the beam axis.
  const column = (name: string, w: number, alpha: number, delay = 0): RvxEmitter => ({
    ...sparks({ name, color: [dim(o.color, alpha)] }),
    texture: 'rvx-beam',
    blend: 'additive',
    burst: o.oneShotDuration ? constant(1) : undefined,
    rate: o.oneShotDuration ? 0 : 2,
    delay,
    life: constant(o.oneShotDuration ? o.oneShotDuration - delay : 1),
    speed: constant(0.01),
    size: constant(w),
    stretch: (length - w) / 0.01,
    drag: 0,
    gravity: 0,
    shape: coneUp(0, 0),
    localEuler: UP,
    localPosition: [0, length / 2, 0],
    sizeCurve: o.oneShotDuration
      ? [
          { t: 0, v: 0.1 },
          { t: 0.12, v: 1 },
          { t: 0.8, v: 1 },
          { t: 1, v: 0 },
        ]
      : HALO,
    // A one-shot fades out before it narrows: narrowing keeps the length, so a beam that
    // is still visible then shrinks to a thin rod.
    colorOverLife: o.oneShotDuration
      ? [
          { t: 0, c: [1, 1, 1, 0] },
          { t: 0.12, c: [1, 1, 1, 1] },
          { t: 0.55, c: [1, 1, 1, 1] },
          { t: 0.8, c: [1, 1, 1, 0] },
        ]
      : FADE_IN_OUT,
  })
  const layers: RvxEmitter[] = [column('Beam', width, 0.55), column('BeamCore', width * 0.45, 0.8)]
  if (o.motes)
    layers.push(
      cubes({
        name: 'Motes',
        rate: o.oneShotDuration ? 16 : 8,
        duration: o.oneShotDuration ? o.oneShotDuration * 0.5 : 1,
        life: o.oneShotDuration ? range(o.oneShotDuration * 0.3, o.oneShotDuration * 0.45) : range(0.5, 0.8),
        speed: range(length * 0.8, length * 1.2),
        size: range(0.04, 0.06),
        shape: { kind: 'cone', angle: 0, radius: width * 0.45 },
        localEuler: UP,
        sizeCurve: TWINKLE,
        color: o.motes,
      }),
    )
  return o.oneShotDuration ? oneShot(meta, o.oneShotDuration, layers) : loop(meta, 2, layers)
}

/**
 * A weapon swipe: a blade trail that follows the real swing. Effect origin =
 * the blade base (guard, wrist), +Y = along the blade, size = blade length.
 * It loops: the ribbon records all the time and draws only where the tip
 * moves fast, so it shows during every swing whatever the clip's timing. A
 * still preview sweeps it once every period.
 */
export function slash(meta: RvxMeta, o: { edge: Rgba; body: Rgba; minSpeed?: number; band?: number }): RvxRecipe {
  const minSpeed = o.minSpeed ?? 14
  // `band`: how much of the line, from the tip, the body covers (claws: the outer part only)
  const from = 1 - (o.band ?? 0.78)
  return loop(meta, 2, [
    // A crescent that thins and fades behind the blade: a solid body that reads on light and
    // dark scenes, and a glowing edge. It draws only while the blade moves fast (minSpeed):
    // strikes peak at 17-50 effect sizes a second, held recoveries at 8-12 (a slow,
    // glowing swing can lower it). The trail texture already fades with age, so the body
    // stays opaque for its first third.
    ribbon({ name: 'Swipe', color: [[o.body[0], o.body[1], o.body[2], 1]], colorOverLife: fadeOut(0.35), ribbon: { from, to: 1, life: 0.28, sweep: 110, minSpeed, taper: 0.85 } }),
    ribbon({ name: 'Edge', color: [o.edge], blend: 'additive', colorOverLife: fadeOut(0.2), ribbon: { from: 0.84, to: 1.04, life: 0.18, sweep: 110, minSpeed, taper: 0.5 } }),
  ])
}

/**
 * Claw marks: three crescents that snap open side by side at the strike and fade. A trail
 * follows a long swing; a claw strike is short and close to the body, so a trail there
 * draws a hoop or a flat slab, and marks read better.
 */
export function rake(meta: RvxMeta, o: { body: Rgba; edge: Rgba }): RvxRecipe {
  const marks: RvxEmitter[] = [-1, 0, 1].map((i) =>
    crescent({
      name: `Mark${i + 2}`,
      delay: (i + 1) * 0.03,
      life: constant(0.3),
      size: constant(0.9 - Math.abs(i) * 0.1),
      startRotation: constant(-0.6),
      localPosition: [i * 0.16, -i * 0.06, 0],
      sizeCurve: [
        { t: 0, v: 0.5 },
        { t: 0.18, v: 1 },
        { t: 1, v: 1.06 },
      ],
      colorOverLife: fadeOut(0.45),
      color: [o.body],
    }),
  )
  return oneShot(meta, 0.5, [glow({ name: 'Flash', life: constant(0.14), size: constant(1), color: [dim(o.edge, 0.5)] }), ...marks])
}

/** A heavy landing: a flat shock ring on the ground, dust rolling out, rubble thrown up. */
export function slam(meta: RvxMeta, o: { dust: Colors; rubble: Colors; ring?: Rgba }): RvxRecipe {
  return burst(meta, { ground: true, puffs: o.dust, cubes: o.rubble, cubeCount: 10, ring: { color: o.ring ?? dim(o.dust[0]!, 0.8), kind: 'flat' }, reach: 1 })
}

/** Rings that spread out from a point: sound (bells, howls), shields, pulses. `count` waves. */
export function waves(meta: RvxMeta, o: { color: Rgba; count?: number; face?: boolean; motes?: Colors; size?: number }): RvxRecipe {
  const n = o.count ?? 3
  const layers: RvxEmitter[] = Array.from({ length: n }, (_, i) =>
    ring({
      name: `Wave${i + 1}`,
      billboard: o.face ? 'camera' : 'horizontal',
      delay: i * 0.18,
      life: constant(0.55),
      size: constant((o.size ?? 1.3) * (1 - i * 0.08)),
      sizeCurve: EXPAND,
      colorOverLife: fadeOut(0.3),
      color: [o.color],
    }),
  )
  if (o.motes)
    layers.push(cubes({ name: 'Motes', burst: constant(8), life: range(0.5, 0.8), speed: range(1.2, 2), drag: 2.5, gravity: -0.02, size: range(0.035, 0.05), shape: { kind: 'sphere', radius: 0.1 }, sizeCurve: TWINKLE, color: o.motes }))
  return oneShot(meta, Math.max(0.9, 0.18 * (n - 1) + 0.6), layers)
}

/** A breath or spray along +Y: a cone of flames/puffs/pieces that travels out and spreads. */
export function spray(
  meta: RvxMeta,
  o: { kind: 'fire' | 'puff'; colors?: Colors; tint?: NonNullable<RvxEmitter['colorOverLife']>; embers?: Colors; length?: number; duration?: number; loop?: boolean; thick?: number; sparks?: number },
): RvxRecipe {
  const len = o.length ?? 2
  // `thick` scales the stream's pieces and spread: a dragon's breath is a wall of fire, a
  // welder's flame a thin jet
  const k = o.thick ?? 1
  const dur = o.duration ?? 0.8
  const body =
    o.kind === 'fire'
      ? flames({ name: 'Stream', ...(o.tint ? { colorOverLife: o.tint } : {}) })
      : puffs({ name: 'Stream', color: o.colors ?? [SMOKE_DEFAULT] })
  const layers: RvxEmitter[] = [
    glow({ name: 'Flash', life: constant(0.2), size: constant(0.9), color: [dim(o.colors?.[0] ?? FIRE.orange, 0.5)] }),
    {
      ...body,
      rate: 40,
      duration: dur,
      life: range(0.4, 0.6),
      speed: range(len * 1.6, len * 2),
      drag: 1.6,
      size: range(0.26 * k, 0.4 * k),
      shape: coneUp(14 * Math.sqrt(k), 0.06 * k),
      localEuler: UP,
      sizeCurve: [
        { t: 0, v: 0.35 },
        { t: 0.3, v: 1 },
        { t: 0.8, v: 1.1 },
        { t: 1, v: 0 },
      ],
      gravity: -0.03,
    },
    // Weld sparks (`sparks`, a size scale) are bright streaks that spit out fast and fall; plain
    // embers are cubes that drift with the stream.
    o.sparks
      ? sparks({
          name: 'Embers',
          rate: 30,
          duration: dur,
          life: range(0.25, 0.45),
          speed: range(2.5, 4),
          drag: 1.2,
          gravity: 1.5,
          size: range(0.012 * o.sparks, 0.018 * o.sparks),
          shape: coneUp(60, 0.05),
          localEuler: UP,
          color: o.embers ?? [FIRE.yellow, FIRE.white],
        })
      : cubes({
          name: 'Embers',
          rate: 14,
          duration: dur,
          life: range(0.4, 0.65),
          speed: range(len * 1.6, len * 2.4),
          drag: 1.2,
          gravity: 0.2,
          size: range(0.035 * k, 0.05 * k),
          shape: coneUp(22, 0.05),
          localEuler: UP,
          color: o.embers ?? [FIRE.yellow, FIRE.orange],
        }),
  ]
  // `loop`: a steady stream (a welding torch) with no flash; every layer runs all the time.
  if (o.loop) return loop(meta, dur, layers.slice(1).map((l) => ({ ...l, duration: undefined })))
  return oneShot(meta, dur + 0.7, layers)
}

const SMOKE_DEFAULT: Rgba = [0.6, 0.58, 0.55, 1]

/** Exhaust or thrust along +Y while a vehicle moves: a flame jet with puffs trailing in world space. */
export function exhaust(
  meta: RvxMeta,
  o: { jet?: NonNullable<RvxEmitter['colorOverLife']>; smoke: Colors; halo?: Rgba; rate?: number; lift?: number; soft?: boolean },
): RvxRecipe {
  const layers: RvxEmitter[] = []
  if (o.jet)
    layers.push(
      glow({ name: 'Halo', burst: undefined, rate: 4, life: constant(0.4), size: range(0.6, 0.75), sizeCurve: HALO, colorOverLife: FADE_IN_OUT, color: [o.halo ?? dim(FIRE.orange, 0.5)] }),
      flames({ name: 'Jet', rate: 30, life: range(0.12, 0.2), speed: range(3, 4), size: range(0.2, 0.28), shape: coneUp(4, 0.04), localEuler: UP, colorOverLife: o.jet, sizeCurve: SHRINK }),
    )
  // `soft`: a ghostly wake of soft blobs (softMist), not faceted smoke puffs.
  const smoke = (layer: RvxEmitter) => (o.soft ? softMist(layer) : layer)
  layers.push(
    smoke(puffs({
      name: 'Smoke',
      worldSpace: true,
      rate: o.rate ?? 8,
      life: o.lift ? range(1.4, 1.9) : range(1, 1.4),
      speed: range(1.2, 1.8),
      drag: 2.5,
      size: range(0.38, 0.52),
      shape: coneUp(12, 0.05),
      localEuler: UP,
      localPosition: [0, o.jet ? 0.35 : 0, 0],
      // Exhaust leaves along the aim (drag stops it about 0.6 sizes out) and stays there, a trail
      // behind a craft. `lift` (world up, sizes/s²) floats it up instead: at 0.6, about one size,
      // so a car's smoke clears the body of a low vehicle and the rear corners of a tall one.
      gravity: -(o.lift ?? 0.08),
      color: o.smoke,
    })),
  )
  return loop(meta, 1, layers)
}

/** Pixel glyphs that rise and fade: curses, skulls, status. */
export function glyphs(meta: RvxMeta, o: { texture: 'rvx-skull' | 'rvx-runes'; colors: Colors; cloud: Colors; motes?: Colors }): RvxRecipe {
  const sheet = o.texture === 'rvx-runes' ? { columns: 2, rows: 2 } : { columns: 1, rows: 1 }
  return oneShot(meta, 1.4, [
    puffs({ name: 'Cloud', burst: constant(7), life: range(0.7, 1), speed: range(1, 1.6), drag: 3, size: range(0.3, 0.42), shape: { kind: 'sphere', radius: 0.1 }, gravity: -0.03, color: o.cloud }),
    {
      ...glints({ name: 'Glyphs', color: o.colors }),
      texture: o.texture,
      sheet,
      sheetVariant: o.texture === 'rvx-runes',
      startRotation: range(-0.2, 0.2),
      burst: constant(3),
      delay: 0.08,
      life: range(0.8, 1.1),
      speed: range(0.5, 0.8),
      drag: 1,
      gravity: -0.04,
      size: range(0.22, 0.3),
      shape: { kind: 'sphere', radius: 0.25 },
      sizeCurve: [
        { t: 0, v: 0 },
        { t: 0.15, v: 1.15 },
        { t: 0.3, v: 1 },
        { t: 0.8, v: 1 },
        { t: 1, v: 0 },
      ],
    },
    ...(o.motes
      ? [cubes({ name: 'Motes', burst: constant(8), life: range(0.6, 0.9), speed: range(1.2, 2), drag: 2, gravity: -0.03, size: range(0.035, 0.05), shape: { kind: 'sphere', radius: 0.1 }, sizeCurve: TWINKLE, color: o.motes })]
      : []),
  ])
}

/** Bats (pixel sprites that flap) circling a point. */
export function swarm(meta: RvxMeta, o: { colors: Colors; radius?: number; rate?: number }): RvxRecipe {
  const r = o.radius ?? 0.45
  return loop(meta, 3, [
    {
      ...glints({ name: 'Bats', color: o.colors }),
      texture: 'rvx-bat',
      sheet: { columns: 4, rows: 2 },
      sheetVariant: false,
      startRotation: range(-0.25, 0.25),
      rate: o.rate ?? 5,
      life: range(2, 2.8),
      speed: range(0.05, 0.15),
      size: range(0.17, 0.24),
      ...around(r),
      swirl: 1.5,
      noise: range(0.35, 0.5),
      worldVelocity: [0, 0.06, 0],
      sizeCurve: [
        { t: 0, v: 0 },
        { t: 0.1, v: 1 },
        { t: 0.85, v: 1 },
        { t: 1, v: 0 },
      ],
    },
  ])
}
