/**
 * Procedural two-colour pothos variegation. A leaf is two halves split at the midrib, and each half gets its own
 * style (real variegation follows the halves: one side cream, the other green, etc.). Blotch edges come from a
 * thresholded noise field, so they're organic but still crisp (one cream colour on the leaf's green).
 *
 * Canvas layout matches leaf space: x = W/2 is the midrib, x = 0 / W the edges; y = 0 is the tip, H the base.
 */

export type HalfStyle = 'green' | 'speckle' | 'edge' | 'midrib' | 'full' | 'marble' | 'streak' | 'splash'

export interface VariegationSpec {
  left: HalfStyle
  right: HalfStyle
  seed: number
  /** 0..1: how much cream overall. */
  amount: number
  /** 0..1: fine cream speckle over everything (Marble Queen / Pearls and Jade freckling). */
  freckle: number
  /** 'both': freckles flip whichever colour they land on. 'cream': green flecks only inside the cream sections. */
  freckleMode?: 'both' | 'cream'
  /** Assembled leaves: the right half's own seed/amount (defaults: seed + 500, same amount). */
  rightSeed?: number
  rightAmount?: number
  /** Freckle size multiplier (1 = pothos). */
  freckleCell?: number
  /** Splash daub size multiplier (1 = default). */
  splashScale?: number
  /** Base share of grid cells that hold a daub (default 0.35; amount adds up to 0.45 more). */
  splashDensity?: number
  /** Size multiplier for the fine noise dots in 'green'/'speckle' halves (small leaves get bigger dots). */
  dotScale?: number
}

// --- value noise ------------------------------------------------------------------------------------------------
function hash(x: number, y: number, seed: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return h - Math.floor(h)
}
function smooth(t: number) {
  return t * t * (3 - 2 * t)
}
function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}
function fbm(x: number, y: number, seed: number, oct = 4) {
  let v = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x * f, y * f, seed + i * 13)
    amp *= 0.5
    f *= 2.03
  }
  return v // ~0..1
}

/** Round daubs of mixed sizes on a jittered grid in leaf space (a 0..1 across the half, s 0..1 along). */
function splashAt(a: number, s: number, seed: number, amount: number, scale = 1, density = 0.35): boolean {
  const cell = 0.11 * scale
  const cx = Math.floor(a / cell)
  const cy = Math.floor(s / (cell * 0.55))
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox
      const gy = cy + oy
      if (hash(gx, gy, seed + 1) > density + 0.45 * amount) continue
      const px = (gx + hash(gx, gy, seed + 2)) * cell
      const py = (gy + hash(gx, gy, seed + 3)) * cell * 0.55
      const r = cell * (0.18 + 0.55 * Math.pow(hash(gx, gy, seed + 4), 2))
      if ((a - px) ** 2 + ((s - py) * 1.8) ** 2 < r * r) return true
    }
  return false
}

/** Is the point at (a = 0 midrib .. 1 edge, s = 0 base .. 1 tip) cream, for a half with this style? */
let splashScale = 1
let dotScale = 1
let splashDensity = 0.35
function cream(style: HalfStyle, a: number, s: number, seed: number, amount: number): boolean {
  // vein-aligned coordinates: veins run out from the midrib and rise toward the tip
  const vx = s - 0.35 * a
  // noise is only evaluated for the styles that use it (this runs per pixel)
  const n = () => fbm(a * 2.6, s * 2.6, seed, 3) // broad, smooth blotch edges
  const fine = () => fbm((a * 9) / dotScale, (s * 9) / dotScale, seed + 99, 2) // dots: 2 octaves = round flecks, not grit
  switch (style) {
    case 'green':
      return fine() > 0.8 - 0.05 * amount // a few flecks
    case 'speckle':
      return fine() > 0.7 - 0.08 * amount
    case 'edge': {
      // cream creeping in from the margin, lumpy inner edge, a little speckle on the green
      const depth = 0.35 + 0.4 * amount
      return a + (n() - 0.5) * 0.7 > 1 - depth || fine() > 0.84
    }
    case 'midrib': {
      // cream along the midrib, spilling outward in lobes
      const reach = 0.3 + 0.45 * amount
      return a + (n() - 0.5) * 0.8 < reach || fine() > 0.84
    }
    case 'full':
      // nearly the whole half cream, with a few green islands
      return n() > 0.36 - 0.15 * amount
    case 'marble': {
      // streaky noise stretched along the veins
      const m = fbm(vx * 7, a * 1.8, seed + 7, 3)
      return m > 0.56 - 0.12 * amount
    }
    case 'splash':
      return splashAt(a, s, seed, amount, splashScale, splashDensity)
    case 'streak': {
      // a few broad streaks running out along the veins
      const m = fbm(vx * 5.5, a * 1.2, seed + 3, 3)
      return m > 0.6 - 0.12 * amount
    }
  }
}

/** Round freckles on a jittered grid: each cell may hold one dot of random size (crisp, round, not grid-like).
 *  Rasterised once into a mask (same dots as testing every pixel against its 9 neighbouring cells, much cheaper). */
function freckleMask(W: number, H: number, spec: VariegationSpec): Uint8Array {
  const mask = new Uint8Array(W * H)
  const cell = (W / 16) * (spec.freckleCell ?? 1)
  for (let gy = -1; gy <= Math.ceil(H / cell); gy++)
    for (let gx = -1; gx <= Math.ceil(W / cell); gx++) {
      if (hash(gx, gy, spec.seed + 900) > 0.25 + 0.45 * spec.freckle) continue
      const px = (gx + hash(gx, gy, spec.seed + 901)) * cell
      const py = (gy + hash(gx, gy, spec.seed + 902)) * cell
      const r = cell * (0.12 + 0.28 * hash(gx, gy, spec.seed + 903))
      for (let y = Math.max(0, Math.floor(py - r)); y <= Math.min(H - 1, Math.ceil(py + r)); y++)
        for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(W - 1, Math.ceil(px + r)); x++)
          if ((x - px) ** 2 + (y - py) ** 2 < r * r) mask[y * W + x] = 1
    }
  return mask
}

export function paintVariegation(ctx: CanvasRenderingContext2D, W: number, H: number, spec: VariegationSpec, rgb: [number, number, number]) {
  splashScale = spec.splashScale ?? 1
  dotScale = spec.dotScale ?? 1
  splashDensity = spec.splashDensity ?? 0.35
  const freckles = spec.freckle > 0 ? freckleMask(W, H, spec) : null
  const img = ctx.createImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    const s = 1 - y / H
    // the split between halves wanders slightly off the midrib, like real leaves
    const wobble = (fbm(s * 4, 3.3, spec.seed + 71, 3) - 0.5) * 0.18
    for (let x = 0; x < W; x++) {
      const signed = (x - W / 2) / (W / 2) - wobble
      const a = Math.min(1, Math.abs(signed))
      const style = signed < 0 ? spec.left : spec.right
      const seed = signed < 0 ? spec.seed : spec.rightSeed ?? spec.seed + 500
      const amount = signed < 0 ? spec.amount : spec.rightAmount ?? spec.amount
      const speck = freckles !== null && freckles[y * W + x] === 1
      const isCream = cream(style, a, s, seed, amount)
      const show = spec.freckleMode === 'cream' ? isCream && !speck : speck !== isCream // 'cream': green flecks only in the cream
      if (show) {
        const i = (y * W + x) * 4
        d[i] = rgb[0]
        d[i + 1] = rgb[1]
        d[i + 2] = rgb[2]
        d[i + 3] = 255
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

/** Weighted random spec: halves usually differ (one heavy, one light), like real pothos. */
/** Seeds >= 100000 are the "freckles only in the cream" combo of seed - 100000 (heavier cream, forced freckling). */
export function randomSpec(seed: number): VariegationSpec {
  if (seed >= 100000) {
    const b = baseSpec(seed - 100000)
    let x = seed
    const r = () => ((x = (x * 16807 + 11) % 2147483647) / 2147483647)
    return { ...b, amount: Math.max(b.amount, 0.6), freckle: 0.55 + 0.4 * r(), freckleMode: 'cream' }
  }
  return baseSpec(seed)
}

function baseSpec(seed: number): VariegationSpec {
  let x = seed * 9301 + 49297
  const r = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  const heavy: HalfStyle[] = ['edge', 'edge', 'midrib', 'marble', 'streak', 'full']
  const light: HalfStyle[] = ['green', 'speckle', 'streak', 'edge', 'marble', 'green']
  const h = heavy[Math.floor(r() * heavy.length)]
  const l = light[Math.floor(r() * light.length)]
  const swap = r() < 0.5
  return { left: swap ? h : l, right: swap ? l : h, seed: Math.floor(r() * 1000), amount: 0.3 + r() * 0.6, freckle: r() < 0.5 ? r() : 0 }
}

/**
 * Hand-picked variants (art review 2026-10-11, blue circles on lowpoly-test/pothos-variegation-picks.png).
 * Seeds for randomSpec(): grid seed 1 -> 100 + index, grid seed 4 -> 400 + index.
 */
export const CURATED_POTHOS = [100, 101, 103, 104, 107, 111, 112, 113, 114, 115, 401, 402, 404, 405, 406, 414, 415]

// =================================================================================================================
// Half library + per-plant profiles.
//
// A leaf is assembled from two halves. Each half = { style, seed, amount }. The pothos library is made of the halves of
// the leaves picked in art review; other plants draw halves from a weighted style list researched per cultivar.
// Halves are side-agnostic (the field only uses distance from the midrib), so any half can go on either side.

export interface HalfSpec {
  style: HalfStyle
  seed: number
  amount: number
}

/** Cream-freckle picks from art review 2 (lowpoly-test/pothos-cream-freckle-candidates.png). */
export const CURATED_POTHOS_CREAM_FRECKLE = [100100, 100101, 100112, 100113, 100114, 100115, 100401, 100402, 100403, 100406, 100414, 100415]

/** Every half from every picked pothos leaf (deduplicated), minus the rejected edge/midrib-band styles. */
export const PICKED_HALVES: HalfSpec[] = (() => {
  const out: HalfSpec[] = []
  const seen = new Set<string>()
  for (const id of [...CURATED_POTHOS, ...CURATED_POTHOS_CREAM_FRECKLE]) {
    const s = randomSpec(id)
    for (const [style, seed] of [[s.left, s.seed], [s.right, s.seed + 500]] as const) {
      if (style === 'edge' || style === 'midrib') continue
      const key = `${style}:${seed}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ style, seed, amount: s.amount })
    }
  }
  return out
})()

export interface VariegationProfile {
  /** Fixed half pool (pothos) or weighted styles to draw halves from. */
  halves?: HalfSpec[]
  styles?: [HalfStyle, number][]
  amount?: [number, number]
  /** Chance a leaf gets freckles, and which kind. */
  freckleChance: number
  creamFreckleChance: number
  /** Freckle density/size multipliers (1 = pothos). */
  freckleCell?: number
  color: [number, number, number]
  /** Chance one half stays plain green (the hemispheric look). */
  plainHalfChance?: number
  /** Both halves get the same style at a similar amount (patterns that cover the whole leaf, not hemispheric). */
  matchHalves?: boolean
  splashScale?: number
  splashDensity?: number
}

export const PROFILES = {
  // Golden/marble pothos family (N'Joy, Pearls and Jade, Marble Queen): only the picked halves.
  pothos: { halves: PICKED_HALVES, freckleChance: 0.35, creamFreckleChance: 0.35, freckleCell: 1.5, color: [243, 239, 214] },
  // Monstera 'Albo Borsigiana': big white half-moons and sectors, often one whole half white.
  monsteraAlbo: { styles: [['full', 4], ['marble', 3], ['streak', 2], ['green', 1]], amount: [0.55, 0.9], freckleChance: 0.08, creamFreckleChance: 0.25, freckleCell: 1.6, plainHalfChance: 0.4, color: [255, 255, 250] },
  // Monstera 'Thai Constellation': cream daubs scattered over the leaf, no big sectors. Kept light (art review: the
  // realistic dense version read too busy for the style): fewer, bigger daubs, a calm half now and then.
  monsteraThai: { styles: [['splash', 1]], amount: [0.05, 0.3], freckleChance: 0, creamFreckleChance: 0, freckleCell: 2.4, plainHalfChance: 0.2, splashScale: 2, splashDensity: 0.1, color: [245, 240, 214] },
  // Peace lily 'Domino': thin white streaks along the veins plus freckles.
  peaceLilyDomino: { styles: [['streak', 3], ['marble', 2], ['speckle', 3]], amount: [0.4, 0.65], matchHalves: true, freckleChance: 0.8, creamFreckleChance: 0, freckleCell: 1.5, color: [255, 255, 248] },
  // ZZ 'Variegata' (rare sport): pale yellow-cream sectors and marbling, some leaflets nearly all cream, others green.
  zzVariegata: { styles: [['full', 4], ['marble', 2], ['green', 2]], amount: [0.5, 0.85], freckleChance: 0.1, creamFreckleChance: 0.3, freckleCell: 2.2, plainHalfChance: 0.45, color: [240, 234, 180] },
  // Whale fin (Dracaena masoniana): pale green mottling, round daubs over both halves.
  whaleFin: { styles: [['splash', 1]], amount: [0.1, 0.35], matchHalves: true, freckleChance: 0, creamFreckleChance: 0, splashScale: 2.2, splashDensity: 0.15, color: [122, 168, 120] },
  // Alocasia 'Frydek Variegata': bold white sectors, hemispheric.
  alocasiaFrydekVar: { styles: [['full', 4], ['marble', 2], ['green', 2]], amount: [0.55, 0.9], freckleChance: 0.08, creamFreckleChance: 0.25, freckleCell: 1.6, plainHalfChance: 0.45, color: [255, 255, 250] },
  // Calathea 'White Fusion': white streaks and marbling, lilac-white.
  calatheaWhiteFusion: { styles: [['marble', 3], ['streak', 3]], amount: [0.45, 0.75], matchHalves: true, freckleChance: 0.2, creamFreckleChance: 0.2, freckleCell: 1.5, color: [250, 248, 255] },
} satisfies Record<string, VariegationProfile>

export type ProfileName = keyof typeof PROFILES

function rnd(seed: number) {
  let x = (seed * 9301 + 49297) % 2147483647
  return () => ((x = (x * 16807) % 2147483647) / 2147483647)
}

function pickWeighted<T>(list: [T, number][], r: () => number): T {
  const total = list.reduce((a, [, w]) => a + w, 0)
  let t = r() * total
  for (const [v, w] of list) if ((t -= w) <= 0) return v
  return list[list.length - 1][0]
}

/** Assemble leaf `n` for a profile: two halves, optional freckles. Deterministic per (profile, n). */
/** `scale` > 1 for small leaves: freckles and daubs grow so they don't shrink to grit (they're drawn in leaf space). */
export function assembleSpec(profile: ProfileName, n: number, scale = 1): VariegationSpec {
  const p: VariegationProfile = PROFILES[profile]
  const r = rnd(n * 7919 + profile.length * 104729)
  const half = (): HalfSpec => {
    if (p.halves) return p.halves[Math.floor(r() * p.halves.length)]
    const [a0, a1] = p.amount ?? [0.4, 0.8]
    return { style: pickWeighted(p.styles!, r), seed: Math.floor(r() * 100000), amount: a0 + r() * (a1 - a0) }
  }
  let L = half()
  let R = half()
  if (p.matchHalves) R = { style: L.style, seed: R.seed, amount: Math.min(1, Math.max(0, L.amount + (r() - 0.5) * 0.16)) }
  if (p.plainHalfChance && r() < p.plainHalfChance) {
    if (r() < 0.5) L = { ...L, style: 'green' }
    else R = { ...R, style: 'green' }
  }
  const fr = r()
  const freckleMode: 'both' | 'cream' | undefined = fr < p.creamFreckleChance ? 'cream' : fr < p.creamFreckleChance + p.freckleChance ? 'both' : undefined
  return {
    left: L.style,
    right: R.style,
    seed: L.seed,
    rightSeed: R.seed,
    amount: L.amount,
    rightAmount: R.amount,
    freckle: freckleMode ? 0.5 + 0.45 * r() : 0,
    freckleMode,
    freckleCell: (p.freckleCell ?? 1) * scale,
    splashScale: (p.splashScale ?? 1) * Math.sqrt(scale),
    dotScale: Math.sqrt(scale),
    splashDensity: p.splashDensity,
  }
}

export function profileColor(profile: ProfileName): [number, number, number] {
  return PROFILES[profile].color as [number, number, number]
}
