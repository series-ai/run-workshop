/**
 * The RUN voxel pack effect kit: units, colours and PN-style layer builders.
 *
 * Units. RVX recipes are drawn at nominal size 1: the main body of the effect
 * (a flame's height, a smoke plume's width, a burst's diameter) is about one
 * unit. `PfxById` plays them at 1 world unit, and a model's PFX binding
 * scales them to `binding.size` model units. +Y is the effect's aim (up for
 * smoke and flames, down the barrel for muzzles); a binding's `aim` turns +Y.
 *
 * Style (see docs/rvx-pfx-style.md). Pirate Nation effects are toon, not
 * photo: hard-edged faceted shapes in flat theme colours with one shadow
 * facet, voxel cubes for debris, star glints, and soft glow only as a
 * halo under the shapes. Shapes die by shrinking, not by fading.
 *
 * Colours. `theme(pack)` reads the pack's world theme (run-voxel-packs
 * contracts/data/themes.json, same OKLab ramps as the models), so an effect
 * uses the same greens, golds and purples as the asset it sits on. `FIRE`
 * and `SMOKE` are shared so fire looks the same in every pack.
 */
import palette from '../../../../run-voxel-packs/contracts/data/palette.json'
import themes from '../../../../run-voxel-packs/contracts/data/themes.json'
import type { BurgerShopEmitter, BurgerShopShape } from '../../burger-shop/types'
import type { PirateRecipe } from '../pirateRecipes'

export type RvxRecipe = PirateRecipe
export type RvxEmitter = BurgerShopEmitter
export type Rgba = [number, number, number, number]
type Curve = { t: number; v: number }[]
type ColorKeys = NonNullable<RvxEmitter['colorOverLife']>

export const range = (min: number, max: number) => ({ min, max })
export const constant = (value: number) => ({ min: value, max: value })

// ------------------------------------------------------------------ colour

function srgbToOklab(hex: string): [number, number, number] {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2])
  const m = Math.cbrt(0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2])
  const s = Math.cbrt(0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2])
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb([L, A, B]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((c) => {
    const v = Math.min(1, Math.max(0, c))
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
    return Math.round(g * 255) / 255
  }) as [number, number, number]
}

/** The 8 shades of a themed ramp: the port of voxgrid.theme_ramp (shade 4 = mid). */
function themeRamp(anchor: { mid: string; dark?: string; light?: string }): [number, number, number][] {
  const mid = srgbToOklab(anchor.mid)
  const dark: [number, number, number] = anchor.dark
    ? srgbToOklab(anchor.dark)
    : [mid[0] * 0.45, mid[1] * 0.8, mid[2] * 0.8 - 0.012]
  const light: [number, number, number] = anchor.light
    ? srgbToOklab(anchor.light)
    : [Math.min(0.97, mid[0] + (1 - mid[0]) * 0.62), mid[1] * 0.6, mid[2] * 0.6 + 0.012]
  return Array.from({ length: 8 }, (_, k) => {
    const [a, b, t] = k <= 4 ? [dark, mid, k / 4] : [mid, light, (k - 4) / 3]
    return oklabToRgb([0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as [number, number, number])
  })
}

export function hex(value: string, alpha = 1): Rgba {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`bad colour ${value}`)
  return [
    ...[1, 3, 5].map((i) => Math.round((parseInt(value.slice(i, i + 2), 16) / 255) * 1000) / 1000),
    alpha,
  ] as Rgba
}

export type RvxPack = keyof typeof themes.packs

/** `theme('monster')('purple', 6)` → the monster world theme's purple, shade 6 (0 dark … 7 light). */
export function theme(pack: RvxPack): (ramp: string, shade: number, alpha?: number) => Rgba {
  const ramps = (themes.packs[pack] as { ramps: Record<string, { mid: string; dark?: string; light?: string }> }).ramps
  const cache = new Map<string, [number, number, number][]>()
  return (ramp, shade, alpha = 1) => {
    if (!Number.isInteger(shade) || shade < 0 || shade > 7) throw new Error(`shade ${shade} is outside 0..7`)
    let shades = cache.get(ramp)
    if (!shades) {
      const anchor = ramps[ramp]
      if (anchor) shades = themeRamp(anchor)
      else {
        const index = (palette.ramps as Record<string, number>)[ramp]
        if (index === undefined) throw new Error(`${pack}: unknown palette ramp ${ramp}`)
        shades = palette.colors.slice(index * 8, index * 8 + 8).map((h) => hex(h).slice(0, 3) as [number, number, number])
      }
      cache.set(ramp, shades)
    }
    const [r, g, b] = shades[shade]!
    return [r, g, b, alpha]
  }
}

/** Shared fire ramp (hot → cool) and neutral smoke, the same in every pack. */
export const FIRE = {
  white: hex('#fff8d6'),
  yellow: hex('#ffd84a'),
  orange: hex('#ff8f1f'),
  red: hex('#e2461b'),
  ember: hex('#8c2a14'),
}
export const SMOKE = { light: hex('#b9b3ab'), mid: hex('#8a847d'), dark: hex('#57524e') }
export const WHITE = hex('#ffffff')

// ------------------------------------------------------------------ curves

/** Pop in, hold, shrink away: the toon death for shapes. */
export const POP: Curve = [
  { t: 0, v: 0.35 },
  { t: 0.12, v: 1.08 },
  { t: 0.25, v: 1 },
  { t: 0.7, v: 0.85 },
  { t: 1, v: 0 },
]
/** Smoke: start small, swell, then shrink away. */
export const SWELL: Curve = [
  { t: 0, v: 0.45 },
  { t: 0.35, v: 1 },
  { t: 0.75, v: 0.95 },
  { t: 1, v: 0 },
]
/** A flash: full size at once, then shrink fast. */
export const FLASH: Curve = [
  { t: 0, v: 1 },
  { t: 0.4, v: 0.7 },
  { t: 1, v: 0 },
]
/** Rings and waves: grow from small to full. */
export const EXPAND: Curve = [
  { t: 0, v: 0.2 },
  { t: 1, v: 1 },
]
export const SHRINK: Curve = [
  { t: 0, v: 1 },
  { t: 1, v: 0 },
]
/** Twinkle for glints: pop, dip, pop, gone. */
export const TWINKLE: Curve = [
  { t: 0, v: 0 },
  { t: 0.15, v: 1 },
  { t: 0.35, v: 0.45 },
  { t: 0.55, v: 0.9 },
  { t: 1, v: 0 },
]
/** A steady glow that eases in and out, for halos that overlap into a flicker. */
export const HALO: Curve = [
  { t: 0, v: 0.7 },
  { t: 0.5, v: 1 },
  { t: 1, v: 0.7 },
]

/** Alpha keys: hold, then fade (for halos and rings, never for solid shapes). */
export function fadeOut(from = 0.5): ColorKeys {
  return [
    { t: 0, c: [1, 1, 1, 1] },
    { t: from, c: [1, 1, 1, 1] },
    { t: 1, c: [1, 1, 1, 0] },
  ]
}
/** Alpha keys: fade in, hold, fade out (loop halos). */
export const FADE_IN_OUT: ColorKeys = [
  { t: 0, c: [1, 1, 1, 0] },
  { t: 0.3, c: [1, 1, 1, 1] },
  { t: 0.7, c: [1, 1, 1, 1] },
  { t: 1, c: [1, 1, 1, 0] },
]
/** Fire cools as it rises: white-yellow → orange → red, as multipliers on a white spawn colour. */
export const FIRE_OVER_LIFE: ColorKeys = [
  { t: 0, c: FIRE.white },
  { t: 0.25, c: FIRE.yellow },
  { t: 0.6, c: FIRE.orange },
  { t: 1, c: FIRE.red },
]

// ------------------------------------------------------------------ shapes

export const UP: [number, number, number] = [-90, 0, 0]
/**
 * A box lying flat (x = `w`, z = `d`, y = `h`) whose particles move up +Y.
 * Box emitters always move along local +Z, so the box is authored upright
 * and turned by UP.
 */
export function flat(w: number, d = w, h = 0.04): Pick<RvxEmitter, 'shape' | 'localEuler'> {
  return { shape: { kind: 'box', size: [w, d, h] }, localEuler: UP }
}
/** A flat ring of radius `r` around +Y; particles move outward. */
export function around(r: number): Pick<RvxEmitter, 'shape' | 'localEuler'> {
  return { shape: { kind: 'circle', radius: r }, localEuler: UP }
}
/** A cone that opens along +Y (the aim). */
export function coneUp(angle: number, radius = 0.05): BurgerShopShape {
  return { kind: 'cone', angle, radius }
}

// ------------------------------------------------------------------ layers

type Layer = Partial<RvxEmitter> & Pick<RvxEmitter, 'name' | 'color'>

function base(texture: string, over: Layer): RvxEmitter {
  return {
    texture,
    sheet: { columns: 1, rows: 1 },
    billboard: 'camera',
    blend: 'alpha',
    duration: 1,
    looping: false,
    life: range(0.4, 0.6),
    speed: constant(0),
    size: range(0.2, 0.3),
    gravity: 0,
    rate: 0,
    shape: { kind: 'point' },
    sizeCurve: POP,
    lumaAlpha: false,
    ...over,
  }
}

/** A hard crescent sprite facing the camera: claw marks, quick cuts. */
export const crescent = (over: Layer) => base('rvx-slash', { burst: constant(1), sizeCurve: undefined, ...over })

/** Faceted toon puffs (smoke, dust, mist, poofs). Solid colour; they shrink away. */
export const puffs = (over: Layer) =>
  base('rvx-puff', { sheet: { columns: 2, rows: 2 }, sheetVariant: true, rotateOverLife: true, sizeCurve: SWELL, ...over })

/** Flame tongues: white spawn colour cooled by FIRE_OVER_LIFE, or `color` for magic fire. */
export const flames = (over: Partial<RvxEmitter> & Pick<RvxEmitter, 'name'>) =>
  base('rvx-flame', {
    sheet: { columns: 2, rows: 2 },
    sheetVariant: true,
    color: [WHITE],
    colorOverLife: FIRE_OVER_LIFE,
    sizeCurve: POP,
    ...over,
  })

/** Voxel cubes: debris, embers, coins, chips. */
export const cubes = (over: Layer) =>
  base('voxel', {
    geometry: 'cube',
    billboard: 'mesh',
    rotateOverLife: true,
    life: range(0.5, 0.8),
    size: range(0.05, 0.09),
    sizeCurve: [
      { t: 0, v: 1 },
      { t: 0.7, v: 1 },
      { t: 1, v: 0 },
    ],
    ...over,
  })

/** Stretched sparks: fast, dragged, velocity-long. Additive over dark, still readable over bright. */
export const sparks = (over: Layer) =>
  base('rvx-streak', {
    blend: 'additive',
    life: range(0.22, 0.38),
    speed: range(3, 5),
    size: range(0.055, 0.075),
    drag: 5,
    gravity: 0.25,
    stretch: 0.08,
    sizeCurve: SHRINK,
    ...over,
  })

/** Four-point star glints. */
export const glints = (over: Layer) =>
  base('rvx-star', { sizeCurve: TWINKLE, startRotation: range(-0.3, 0.3), ...over })

/** A soft halo under the shapes (the only soft element in the style). */
export const glow = (over: Layer) =>
  base('soft-circle', {
    blend: 'additive',
    lumaAlpha: true,
    burst: constant(1),
    life: constant(0.25),
    size: constant(1.2),
    sizeCurve: FLASH,
    colorOverLife: fadeOut(0.2),
    ...over,
  })

/** A hard ring: shockwaves, sound waves, portals. `billboard` 'horizontal' lies flat; 'camera' faces the view. */
export const ring = (over: Layer) =>
  base('rvx-ring', {
    // Additive: a fading ring brightens and clears, and does not go muddy over dark ground.
    blend: 'additive',
    burst: constant(1),
    life: constant(0.35),
    size: constant(1.2),
    sizeCurve: EXPAND,
    colorOverLife: fadeOut(0.4),
    ...over,
  })

/**
 * A blade trail: a ribbon from (0, from, 0) to (0, to, 0), sampled in world
 * space every frame while the emitter runs, so it follows the real swing.
 */
export const ribbon = (over: Layer & Pick<RvxEmitter, 'ribbon'>) =>
  base('rvx-trail', { burst: undefined, rate: 0, sizeCurve: undefined, colorOverLife: fadeOut(0.3), ...over })

// ------------------------------------------------------------------ recipes

export type RvxMeta = Pick<RvxRecipe, 'id' | 'label' | 'effectType' | 'role'> & { source: string }

/**
 * A looping effect. Every emitter loops with the recipe's period, so a loop
 * never has one layer that stops. Rates are per second.
 */
export function loop(meta: RvxMeta, period: number, emitters: RvxEmitter[]): RvxRecipe {
  return {
    id: meta.id,
    label: meta.label,
    sourcePrefab: meta.source,
    effectType: meta.effectType,
    role: meta.role,
    duration: period,
    looping: true,
    emitters: emitters.map((e) => ({ ...e, duration: period, looping: true })),
  }
}

/** A one-shot: plays once from its trigger and is over after `duration` seconds. */
export function oneShot(meta: RvxMeta, duration: number, emitters: RvxEmitter[]): RvxRecipe {
  for (const e of emitters) {
    if (e.looping) throw new Error(`${meta.id}/${e.name}: a one-shot layer cannot loop`)
    const end = (e.delay ?? 0) + (e.ribbon ? e.duration + e.ribbon.life : (e.rate > 0 ? e.duration : 0) + e.life.max)
    if (end > duration + 1e-6) throw new Error(`${meta.id}/${e.name}: lives until ${end.toFixed(2)} s, after the ${duration} s effect`)
  }
  return {
    id: meta.id,
    label: meta.label,
    sourcePrefab: meta.source,
    effectType: meta.effectType,
    role: meta.role,
    duration,
    looping: false,
    emitters,
  }
}
