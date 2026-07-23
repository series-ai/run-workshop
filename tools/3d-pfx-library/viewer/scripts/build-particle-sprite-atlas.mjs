// Builds a 4x5 512x640px sprite atlas from curated Kenney Particle Pack sprites (CC0)
// plus procedural effect-specific cells (the Kenney pack has no clean soft glow —
// light_02/circle_01 have ring edges that read as donuts at particle scale).
import fs from 'node:fs'
import path from 'node:path'
// Usage:
//   Full rebuild:
//     1. Download https://kenney.nl/assets/particle-pack (CC0) and unzip.
//     2. node scripts/build-particle-sprite-atlas.mjs <path-to-"PNG (Transparent)">
//   Patch mode (no download needed — regenerates only the procedural cells
//   on top of the atlas already baked into particleSprites.ts):
//     node scripts/build-particle-sprite-atlas.mjs
// Writes tools/3d-pfx-library/src/particleSprites.ts
import { PNG } from 'pngjs'

const MODULE_TS_URL = new URL('../../src/particleSprites.ts', import.meta.url)
const SRC = process.argv[2]
if (SRC && !fs.existsSync(SRC)) {
  console.error('Source directory not found. Pass the Kenney "PNG (Transparent)" directory, or no argument for patch mode.')
  process.exit(1)
}
const CELL = 128
const COLS = 4
const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
// r = normalized distance from cell center (1 at the cell edge).
const PROCEDURAL = {
  'procedural:radial-gaussian': (r) => Math.exp(-((r / 0.42) ** 2)),
  'procedural:soft-disc': (r) => 1 - smoothstep(0.45, 0.95, r),
  // Single tapered line along the cell's vertical axis (the stretch axis).
  // Kenney trace_06 was a BUNDLE of rays — one stretched quad painted a whole
  // fan, which read as a one-sided spark carpet on burst effects.
  'procedural:streak-line': (r, nx, ny) =>
    Math.exp(-((nx / 0.13) ** 2)) * Math.max(0, 1 - Math.abs(ny)) ** 0.6 * (0.55 + 0.45 * (1 - Math.abs(ny))),
  // One irregular hard-edged chunk. Kenney dirt_02 was a SHEET of clumps —
  // each debris quad painted a whole speckle carpet (round-7 wedge trail).
  // Lobed billow: union of offset gaussians — a single radial blob rendered
  // every smoke effect as a circular wool ball (rounds 8-10).
  'procedural:billow': (r, nx, ny) => {
    // Asymmetric, elongated lobes — a near-3-fold layout stamped the same
    // trefoil silhouette on every puff regardless of rotation (rounds 12-13).
    const lobes = [
      [0, 0.02, 0.46, 1.35, 0.2], [0.34, 0.2, 0.3, 1.0, 0], [-0.3, 0.1, 0.36, 1.5, -0.5],
      [0.14, -0.3, 0.27, 1.1, 0.9], [-0.12, 0.34, 0.22, 1.0, 0], [0.42, -0.12, 0.18, 1.3, 0.4],
    ]
    let a = 0
    for (const [cx, cy, sr, ex, rot] of lobes) {
      const c = Math.cos(rot), sn = Math.sin(rot)
      const lx = (nx - cx) * c + (ny - cy) * sn
      const ly = -(nx - cx) * sn + (ny - cy) * c
      const d2 = ((lx * ex) / sr) ** 2 + (ly / sr) ** 2
      a = Math.max(a, Math.exp(-d2))
    }
    // Interior churn: textureless gaussians read as countable circles.
    const h = (x, y) => {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      return v - Math.floor(v)
    }
    const vn = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
      const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf)
      return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy) + (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy
    }
    a *= 0.68 + 0.32 * (vn(nx * 5 + 9, ny * 5 + 4) * 0.6 + vn(nx * 11 + 3, ny * 11 + 7) * 0.4)
    // Floor-subtract the tails (organic lobed edge). A radial skirt zeroed
    // the cell border but re-rounded the silhouette into a wool ball.
    return Math.max(0, Math.min(1, a * 1.15) - 0.09) / 0.91
  },
  // Hard-edged tapered sliver with a facet gradient — energy-glass shards.
  'procedural:shard': (r, nx, ny) => {
    if (Math.abs(ny) > 0.88) return 0
    const halfWidth = 0.2 * (1 - Math.abs(ny) * 0.75) + 0.03
    if (Math.abs(nx) > halfWidth) return 0
    return 0.65 + 0.3 * (nx / halfWidth)
  },
  // Compact asymmetric molten chip, authored with a vertical travel axis.
  // Unlike a gaussian pip it keeps a readable travel direction; unlike the
  // Kenney spark it remains a chip rather than becoming a parallel light bar.
  'procedural:ember-chip': (r, nx, ny) => {
    const vy = (ny + 0.02) / 0.54
    if (Math.abs(vy) >= 1) return 0
    const centerX = 0.055 * Math.sin((vy + 0.7) * 2.8) - vy * 0.03
    const taper = Math.pow(1 - Math.abs(vy), 0.58)
    const halfWidth = (0.07 + 0.23 * taper) * (1 + 0.08 * Math.sin(vy * 8.5 + 1.1))
    const dx = Math.abs(nx - centerX)
    if (dx >= halfWidth) return 0
    const sideFade = 1 - smoothstep(halfWidth * 0.24, halfWidth, dx)
    const endFade = smoothstep(-1, -0.7, vy) * (1 - smoothstep(0.68, 1, vy))
    const facet = nx < centerX ? 0.82 : 1
    const hotCore = Math.exp(-Math.pow((nx - centerX) / Math.max(halfWidth * 0.5, 0.01), 2))
    return Math.min(1, sideFade * endFade * facet * (0.62 + hotCore * 0.38))
  },
  // A single tapered life leaf for healing/restoration traffic. The curved
  // spine and asymmetric shoulder keep spinning instances organic instead
  // of reading as the crystal shard cell recolored green.
  'procedural:life-leaf': (r, nx, ny) => {
    const t = (ny + 0.86) / 1.72
    if (t <= 0 || t >= 1) return 0
    const spine = 0.1 * Math.sin(t * Math.PI) - 0.035 * t
    const width = 0.31 * Math.pow(Math.sin(t * Math.PI), 0.78) * (1 - t * 0.18)
    const distance = Math.abs(nx - spine)
    if (distance >= width) return 0
    const edge = 1 - smoothstep(width * 0.68, width, distance)
    const vein = Math.exp(-Math.pow((nx - spine) / 0.035, 2)) * 0.22
    const tip = smoothstep(0, 0.08, t) * (1 - smoothstep(0.9, 1, t))
    return Math.min(1, (0.7 + vein) * edge * tip)
  },
  // Six-arm ice crystal with short forked branches. The single compact
  // glyph survives mobile minification while rotation and velocity stretch
  // turn repeated instances into a varied snow squall, not a magic star wall.
  'procedural:snowflake': (r, nx, ny) => {
    let alpha = Math.exp(-Math.pow(r / 0.11, 2))
    for (let arm = 0; arm < 6; arm++) {
      const angle = arm * Math.PI / 3
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      const along = nx * dx + ny * dy
      const across = Math.abs(-nx * dy + ny * dx)
      if (along > 0.06 && along < 0.82) {
        const shaft = Math.exp(-Math.pow(across / 0.027, 2))
          * smoothstep(0.06, 0.14, along)
          * (1 - smoothstep(0.7, 0.82, along))
        alpha = Math.max(alpha, shaft)
      }
      for (const branchSign of [-1, 1]) {
        const branchAngle = angle + branchSign * 0.58
        const bx = 0.42 * dx
        const by = 0.42 * dy
        const localX = nx - bx
        const localY = ny - by
        const branchAlong = localX * Math.cos(branchAngle) + localY * Math.sin(branchAngle)
        const branchAcross = Math.abs(-localX * Math.sin(branchAngle) + localY * Math.cos(branchAngle))
        if (branchAlong > 0 && branchAlong < 0.23) {
          alpha = Math.max(alpha, Math.exp(-Math.pow(branchAcross / 0.022, 2)) * (1 - smoothstep(0.17, 0.23, branchAlong)))
        }
      }
    }
    return Math.min(1, alpha)
  },
  // Horizontal 4-ray flash star + hot core — replaces the Kenney muzzle card
  // whose long axis stayed vertical no matter the quad roll (round-15).
  'procedural:flash-star': (r, nx, ny) => {
    const core = Math.exp(-((r / 0.16) ** 2)) * 1.2
    const rayX = Math.exp(-((ny / 0.055) ** 2)) * Math.max(0, 1 - Math.abs(nx) / 0.95) ** 0.7
    const rayY = Math.exp(-((nx / 0.05) ** 2)) * Math.max(0, 1 - Math.abs(ny) / 0.5) ** 0.9 * 0.35
    const diag = Math.exp(-(((nx - ny) * 0.7071 / 0.04) ** 2)) * Math.max(0, 1 - r / 0.6) * 0.3
      + Math.exp(-(((nx + ny) * 0.7071 / 0.04) ** 2)) * Math.max(0, 1 - r / 0.6) * 0.3
    return Math.min(1, core + rayX + rayY + diag)
  },
  'procedural:chunk': (r, nx, ny) => {
    // Low-amplitude asymmetric harmonics: strong sin(5t) drew a literal
    // 5-petal star (round-7: debris read as reward pickups).
    const t = Math.atan2(ny, nx)
    const wobble = 0.58 + 0.07 * Math.sin(3 * t + 1.3) + 0.05 * Math.sin(7 * t + 0.6) + 0.04 * Math.sin(2 * t + 4.1)
    return r < wobble ? 0.92 - (r / wobble) * 0.35 : 0
  },
  // Calligraphic fire tongue: bulbous base sweeping into an S-curved,
  // sharp-tipped lick with a forked side tongue — the hero-fireball trail
  // flame from the review reference. +ny = tip; tint comes from the ramp.
  'procedural:bubble': (r, nx, ny) => {
    // Bubble: thin bright rim, near-empty interior, one specular highlight —
    // a soft dot can never read as a bubble (underwater-bubbles review).
    const rim = Math.abs(r - 0.72)
    let v = Math.exp(-Math.pow(rim / 0.055, 2)) * 0.95
    if (r < 0.7) v += 0.06 * (1 - r)
    const hx = nx + 0.3
    const hy = ny + 0.34
    const hd = Math.sqrt(hx * hx + hy * hy)
    v += Math.exp(-Math.pow(hd / 0.13, 2)) * 0.85
    const hd2 = Math.sqrt(Math.pow(nx - 0.22, 2) + Math.pow(ny - 0.3, 2))
    v += Math.exp(-Math.pow(hd2 / 0.07, 2)) * 0.4
    return r > 0.86 ? 0 : Math.min(1, v)
  },
  'procedural:flame-lick': (r, nx, ny) => {
    const t = (-ny + 0.78) / 1.6
    if (t < 0 || t > 1) return 0
    const spine = 0.16 * Math.sin(t * Math.PI * 1.7) * (0.35 + 0.65 * t)
    const width = 0.3 * Math.pow(1 - t, 1.35) + 0.012
    const d = Math.abs(nx - spine)
    if (d > width * 2.4) return 0
    const body = Math.exp(-((d / width) ** 2))
    const spine2 = spine - 0.22 * Math.max(0, t - 0.28)
    const width2 = 0.13 * Math.pow(Math.max(0, 1 - (t - 0.2) / 0.8), 1.4) + 0.008
    const fork = t > 0.2 ? Math.exp(-(((nx - spine2) / width2) ** 2)) * 0.8 : 0
    const base = t < 0.22 ? smoothstep(0, 0.22, t) : 1
    const a = Math.max(body, fork) * base * (t > 0.9 ? (1 - t) / 0.1 : 1)
    return Math.min(1, a * 1.25)
  },
  // Liquid splatter (review reference): an irregular holed central mass with
  // ragged lobed edges, radial splash arms of varying length, and satellite
  // droplets. Grayscale alpha — tint per liquid (acid, slime, blood, mud).
  'procedural:splat': (r, nx, ny) => {
    const t = Math.atan2(ny, nx)
    const h = (a) => { const v = Math.sin(a * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
    let a = 0
    // Main mass DOMINATES (reference): big asymmetric lobed blob with a
    // ragged off-center hole punched through it.
    const outer = 0.5 + 0.14 * Math.sin(2 * t + 0.9) + 0.09 * Math.sin(3 * t + 1.7) + 0.06 * Math.sin(7 * t + 0.4) + 0.04 * Math.sin(11 * t + 3.1)
    const hx = nx - 0.05, hy = ny - 0.04
    const hr = Math.hypot(hx, hy)
    const ht = Math.atan2(hy, hx)
    const hole = 0.17 + 0.06 * Math.sin(3 * ht + 2.2) + 0.045 * Math.sin(5 * ht + 0.8)
    if (r < outer && hr > hole) a = 1
    if (a > 0) a *= smoothstep(hole, hole + 0.03, hr) * (1 - smoothstep(outer - 0.03, outer, r))
    // Stubby organic splash arms growing OUT of the mass.
    for (let i = 0; i < 5; i++) {
      const ang = i * 1.256 + 0.5 + h(i) * 0.7
      const len = 0.62 + h(i + 9) * 0.32
      let dt = Math.abs(((t - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      const width = 0.17 * (1 - Math.min(1, r / len)) ** 1.3 + 0.014
      if (r < len && r > 0.2) {
        // HARD-EDGED liquid arm: threshold the falloff — a gaussian ray
        // reads as light, a stepped one reads as matter.
        const arm = smoothstep(0.3, 0.5, Math.exp(-((dt * r / width) ** 2)))
        a = Math.max(a, arm * (r > len - 0.06 ? (len - r) / 0.06 : 1))
      }
    }
    // Satellite droplets.
    for (let i = 0; i < 9; i++) {
      const ang = h(i + 21) * Math.PI * 2
      const dist = 0.5 + h(i + 33) * 0.42
      const dx = nx - Math.cos(ang) * dist
      const dy = ny - Math.sin(ang) * dist
      const rad = 0.018 + h(i + 47) * 0.03
      a = Math.max(a, 1 - smoothstep(rad * 0.6, rad, Math.hypot(dx, dy)))
    }
    return Math.min(1, a)
  },
  // Lightning bolt: jagged zigzag spine with a thin white-hot core, soft
  // charge glow, and a forked branch. Vertical (stretch axis); grayscale.
  'procedural:lightning-arc': (r, nx, ny) => {
    const h = (a) => { const v = Math.sin(a * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
    const t = (ny + 1) / 2
    if (t < 0.02 || t > 0.98) return 0
    const segs = 7
    const f = t * segs
    const i = Math.floor(f)
    const frac = f - i
    const amp = (k) => (k <= 0 || k >= segs ? 0.06 : 0.5) * (h(k * 3.7) - 0.5)
    const spine = amp(i) + (amp(i + 1) - amp(i)) * frac
    const d = Math.abs(nx - spine)
    const taper = Math.min(1, (1 - t) * 6) * Math.min(1, t * 6)
    let a = (Math.exp(-((d / 0.03) ** 2)) + Math.exp(-((d / 0.16) ** 2)) * 0.45) * taper
    // Forked branch peeling off mid-bolt.
    if (t > 0.35 && t < 0.8) {
      const bt = (t - 0.35) / 0.45
      const bs = spine + bt * 0.5
      const bd = Math.abs(nx - bs)
      a = Math.max(a, (Math.exp(-((bd / 0.02) ** 2)) + Math.exp(-((bd / 0.09) ** 2)) * 0.35) * (1 - bt) * 0.85)
    }
    return Math.min(1, a)
  },
}
// Three compact crystal silhouettes share the same six-arm construction but
// vary branch reach and arm weight. The semantic atlas key selects these
// stably per particle, buying visible variety without another texture bind.
const baseSnowflake = PROCEDURAL['procedural:snowflake']
PROCEDURAL['procedural:snowflake-a'] = baseSnowflake
PROCEDURAL['procedural:snowflake-b'] = (r, nx, ny) => {
  const angle = Math.atan2(ny, nx)
  const warp = 1 + 0.13 * Math.sin(angle * 6 + 0.8)
  return Math.pow(baseSnowflake(r * warp, nx * warp, ny * warp), 0.84)
}
PROCEDURAL['procedural:snowflake-c'] = (r, nx, ny) => {
  const angle = Math.atan2(ny, nx)
  const warp = 1 + 0.16 * Math.cos(angle * 3 - 0.45)
  return Math.pow(baseSnowflake(r * warp, nx * warp, ny * warp), 1.15)
}
const SPRITES = [
  ['glow', 'procedural:radial-gaussian'],
  ['soft', 'procedural:soft-disc'],
  ['flame', 'flame_05.png'],
  ['fire', 'fire_01.png'],
  ['smoke', 'smoke_07.png'],
  ['puff', 'procedural:billow'],
  ['spark', 'spark_06.png'],
  ['streak', 'procedural:streak-line'],
  ['sparkle', 'star_07.png'],
  ['twinkle', 'star_04.png'],
  ['magic', 'magic_04.png'],
  ['twirl', 'procedural:shard'],
  ['debris', 'procedural:chunk'],
  ['ember', 'procedural:ember-chip'],
  ['slash', 'slash_02.png'],
  ['rune', 'symbol_02.png'],
  ['lick', 'procedural:flame-lick'],
  ['bubble', 'procedural:bubble'],
  ['splat', 'procedural:splat'],
  ['arc', 'procedural:lightning-arc'],
  ['leaf', 'procedural:life-leaf'],
  // Eight distinct CC0 Kenney smoke silhouettes occupy one contiguous 4x2
  // atlas region. The runtime chooses a stable cell per particle, avoiding
  // the repeated-stamp look without adding textures or draw calls.
  ...Array.from({ length: 8 }, (_, index) => [
    `smoke-variant-${String(index + 1).padStart(2, '0')}`,
    `smoke_${String(index + 1).padStart(2, '0')}.png`,
  ]),
  // Fill the three existing blank atlas cells: no UV movement for prior art.
  ['snowflake-01', 'procedural:snowflake-a'],
  ['snowflake-02', 'procedural:snowflake-b'],
  ['snowflake-03', 'procedural:snowflake-c'],
]

function proceduralCell(kind) {
  const out = new PNG({ width: CELL, height: CELL })
  const falloff = PROCEDURAL[kind]
  const center = (CELL - 1) / 2
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const r = Math.sqrt((x - center) ** 2 + (y - center) ** 2) / center
      const nx = (x - center) / center
      const ny = (y - center) / center
      const alpha = falloff.length > 1
        ? Math.max(0, Math.min(1, falloff(r, nx, ny)))
        : r >= 1 ? 0 : Math.max(0, Math.min(1, falloff(r)))
      const o = (y * CELL + x) * 4
      out.data[o] = 255
      out.data[o + 1] = 255
      out.data[o + 2] = 255
      out.data[o + 3] = Math.round(alpha * 255)
    }
  }
  return out
}

function readExistingAtlas() {
  const ts = fs.readFileSync(MODULE_TS_URL.pathname, 'utf8')
  const match = ts.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)
  if (!match) throw new Error('No atlas data URI found in particleSprites.ts — run a full rebuild instead.')
  return PNG.sync.read(Buffer.from(match[1], 'base64'))
}

function downscale(src, size) {
  const out = new PNG({ width: size, height: size })
  const ratio = src.width / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      const x0 = Math.floor(x * ratio), x1 = Math.floor((x + 1) * ratio)
      const y0 = Math.floor(y * ratio), y1 = Math.floor((y + 1) * ratio)
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) * 4
          const alpha = src.data[i + 3]
          r += src.data[i] * alpha; g += src.data[i + 1] * alpha; b += src.data[i + 2] * alpha
          a += alpha; n++
        }
      }
      const o = (y * size + x) * 4
      out.data[o] = a > 0 ? Math.round(r / a) : 255
      out.data[o + 1] = a > 0 ? Math.round(g / a) : 255
      out.data[o + 2] = a > 0 ? Math.round(b / a) : 255
      out.data[o + 3] = Math.round(a / n)
    }
  }
  return out
}

const ROWS = Math.ceil(SPRITES.length / COLS)
const atlasSize = CELL * COLS
const atlasHeight = CELL * ROWS
let atlas
if (SRC) {
  atlas = new PNG({ width: atlasSize, height: atlasHeight })
} else {
  // Patch mode with grid growth: copy the baked atlas into the top rows of
  // a taller canvas; new procedural rows render below.
  const baked = readExistingAtlas()
  atlas = new PNG({ width: atlasSize, height: atlasHeight })
  baked.data.copy(atlas.data, 0, 0, Math.min(baked.data.length, atlas.data.length))
}
const slices = {}
SPRITES.forEach(([name, file], index) => {
  const procedural = file.startsWith('procedural:')
  const col = index % COLS
  const row = Math.floor(index / COLS)
  let small = null
  if (procedural) {
    small = proceduralCell(file)
  } else if (SRC) {
    small = downscale(PNG.sync.read(fs.readFileSync(path.join(SRC, file))), CELL)
  }
  if (small) {
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const si = (y * CELL + x) * 4
        const di = ((row * CELL + y) * atlasSize + col * CELL + x) * 4
        atlas.data[di] = small.data[si]
        atlas.data[di + 1] = small.data[si + 1]
        atlas.data[di + 2] = small.data[si + 2]
        atlas.data[di + 3] = small.data[si + 3]
      }
    }
  }
  // UV origin bottom-left in GL; PNG rows are top-down.
  slices[name] = {
    u: col / COLS,
    v: 1 - (row + 1) / ROWS,
    w: 1 / COLS,
    h: 1 / ROWS,
    source: procedural ? file : `kenney-particle-pack/${file}`,
  }
})

// Virtual semantic key over the eight physical smoke cells. smoke_01 starts
// at column one of its row, then the sequence wraps across two lower GL rows
// to smoke_08. Explicit start/direction metadata prevents later atlas cells
// (currently snowflakes) from being sampled as smoke variants.
slices['smoke-variants'] = {
  u: 0,
  v: 2 / ROWS,
  w: 1 / COLS,
  h: 1 / ROWS,
  source: 'kenney-particle-pack/smoke_01..08.png',
  variantCount: 8,
  variantColumns: 4,
  variantStartIndex: 1,
  variantRowDirection: -1,
}

slices.snowflakes = {
  ...slices['snowflake-01'],
  source: 'procedural:snowflake-variants',
  variantCount: 3,
  variantColumns: 3,
}
slices.snowflake = { ...slices['snowflake-01'], source: 'compat-alias:snowflakes' }

// Preserve the original public sprite key after its now-unused physical cell
// became the ember vocabulary. New recipes should use the semantic `ember`
// name; legacy callers keep resolving to the same atlas coordinates.
slices.muzzle = { ...slices.ember, source: 'compat-alias:ember' }

const buffer = PNG.sync.write(atlas)

const dataUri = `data:image/png;base64,${buffer.toString('base64')}`
const ts = `// Curated sprite atlas: Kenney Particle Pack sprites (CC0,
// https://kenney.nl/assets/particle-pack) plus procedural effect-specific cells.
// License: CC0 1.0 Universal — no attribution required; noted here for provenance.
// Generated by scripts/build-particle-sprite-atlas.mjs (4x${ROWS} grid, 128px cells).

export interface PfxSpriteSlice {
  u: number
  v: number
  w: number
  h: number
  source: string
  /** Optional contiguous variant grid selected deterministically per particle. */
  variantCount?: number
  variantColumns?: number
  /** Linear cell index inside the variant grid before particle selection. */
  variantStartIndex?: number
  /** UV row direction; PNG-authored rows descend in GL texture space. */
  variantRowDirection?: 1 | -1
}

export const PFX_SPRITE_ATLAS_DATA_URI =
  '${dataUri}'

export const PFX_SPRITE_SLICES = ${JSON.stringify(slices, null, 2)} as const

export type PfxSpriteName = keyof typeof PFX_SPRITE_SLICES
`
fs.writeFileSync(new URL('../../src/particleSprites.ts', import.meta.url).pathname, ts)
console.log('atlas bytes:', buffer.length, 'ts bytes:', ts.length)
