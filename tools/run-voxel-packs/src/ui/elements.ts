/**
 * Themed UI tiles for each RUN voxel pack, in the Pirate Nation UI layout
 * (textless, nine-slice friendly tiles with states). Drawn at voxel scale by
 * `Raster`; names follow `ui-<pack>-<group>-<name>[-<state>].png`.
 */
import { paletteRgb } from '../../contracts/palette'
import { PALETTE_RAMPS } from '../../contracts/palette'
import type { RvxPackKey } from '../../contracts/packs'
import { gray, mix, Raster, shade, type Rgba } from './raster'

export const UI_SCALE = 4

function pal(ramp: string, s: number, a = 255): Rgba {
  const r = PALETTE_RAMPS[ramp]
  if (r === undefined) throw new Error(`unknown ramp ${ramp}`)
  const [R, G, B] = paletteRgb(r * 8 + s)
  return [R, G, B, a]
}

type Motif = 'bricks' | 'rivets' | 'cobweb' | 'hazard'

export interface UiTheme {
  primary: Rgba
  secondary: Rgba
  danger: Rgba
  panel: Rgba
  inset: Rgba
  trim: Rgba
  ink: Rgba
  glyph: Rgba
  bars: { health: Rgba; energy: Rgba; xp: Rgba }
  motif: Motif
}

export const UI_THEMES: Record<RvxPackKey, UiTheme> = {
  fantasy: {
    primary: pal('blue', 4), secondary: pal('sand', 5), danger: pal('red', 3),
    panel: pal('stone', 3), inset: pal('sand', 6), trim: pal('gold', 5), ink: pal('navy', 0), glyph: pal('bone', 7),
    bars: { health: pal('red', 4), energy: pal('arcane', 5), xp: pal('gold', 6) }, motif: 'bricks',
  },
  space: {
    primary: pal('cyan', 4), secondary: pal('steel', 5), danger: pal('red', 4),
    panel: pal('navy', 2), inset: pal('navy', 1), trim: pal('plasma', 5), ink: pal('iron', 0), glyph: pal('sky', 7),
    bars: { health: pal('lime', 5), energy: pal('plasma', 5), xp: pal('magenta', 5) }, motif: 'rivets',
  },
  monster: {
    primary: pal('purple', 3), secondary: pal('bone', 5), danger: pal('blood', 4),
    panel: pal('purple', 1), inset: pal('gray', 1), trim: pal('bone', 5), ink: pal('gray', 1), glyph: pal('bone', 7),
    bars: { health: pal('blood', 5), energy: pal('arcane', 4), xp: pal('toxic', 5) }, motif: 'cobweb',
  },
  apocalypse: {
    primary: pal('khaki', 4), secondary: pal('rust', 4), danger: pal('orange', 4),
    panel: pal('rust', 2), inset: pal('sand', 3), trim: pal('gold', 4), ink: pal('iron', 0), glyph: pal('sand', 7),
    bars: { health: pal('red', 4), energy: pal('toxic', 5), xp: pal('orange', 5) }, motif: 'hazard',
  },
}

const STATES = ['default', 'hover', 'pressed', 'disabled'] as const
type State = (typeof STATES)[number]

function bevelTile(w: number, h: number, body: Rgba, ink: Rgba, depth: number, seed: number, notch = 2): Raster {
  const r = new Raster(w, h)
  const top = 0
  r.rect(0, top, w, h, body)
  r.rect(0, h - depth, w, depth, shade(body, -0.35))
  r.rect(1, top + 1, w - 2, 1, shade(body, 0.28))
  r.rect(1, top + 1, 1, h - depth - 2, shade(body, 0.14))
  r.speckle(seed, 0.22, 0.07, (_x, y) => y < h - depth)
  r.notch(notch).outline(ink)
  return r
}

function button(theme: UiTheme, color: Rgba, state: State, w: number, h: number, seed: number): Raster {
  const body = state === 'hover' ? shade(color, 0.12) : state === 'disabled' ? mix(gray(color), [60, 60, 60, 255], 0.2) : color
  if (state !== 'pressed') return bevelTile(w, h, body, theme.ink, 3, seed)
  const r = new Raster(w, h)
  const inner = bevelTile(w, h - 2, shade(body, -0.06), theme.ink, 1, seed)
  inner.px.forEach((c, i) => r.set(i % w, Math.floor(i / w) + 2, c))
  return r
}

function motif(r: Raster, theme: UiTheme, x0: number, y0: number, w: number, h: number): void {
  const dark = shade(theme.panel, -0.18)
  if (theme.motif === 'bricks') {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        const row = Math.floor((y - y0) / 3)
        if ((y - y0) % 3 === 0 || (x - x0 + (row % 2) * 3) % 6 === 0) r.set(x, y, dark)
      }
    }
  } else if (theme.motif === 'rivets') {
    for (const [x, y] of [[x0 + 1, y0 + 1], [x0 + w - 2, y0 + 1], [x0 + 1, y0 + h - 2], [x0 + w - 2, y0 + h - 2]] as const) r.set(x, y, shade(theme.trim, -0.1))
    r.rect(x0 + 3, y0 + Math.floor(h / 2), w - 6, 1, shade(theme.panel, 0.08))
  } else if (theme.motif === 'cobweb') {
    const web = mix(theme.glyph, theme.panel, 0.55)
    for (let k = 0; k < 6; k += 1) {
      r.set(x0 + k, y0 + k, web)
      r.set(x0 + k, y0 + 2, web)
      r.set(x0 + 2, y0 + k, web)
    }
  } else {
    const a = theme.danger
    const b = theme.ink
    for (let x = x0; x < x0 + w; x += 1) for (let y = y0; y < y0 + 2; y += 1) r.set(x, y, Math.floor((x + y) / 2) % 2 ? a : b)
  }
}

function panel(theme: UiTheme, w: number, h: number, seed: number, inset = false): Raster {
  const base = inset ? theme.inset : theme.panel
  const r = new Raster(w, h).rect(0, 0, w, h, base)
  if (!inset) {
    motif(r, theme, 2, 2, w - 4, h - 4)
    r.rect(1, 1, w - 2, 1, theme.trim).rect(1, h - 2, w - 2, 1, shade(theme.trim, -0.25))
    r.rect(1, 1, 1, h - 2, theme.trim).rect(w - 2, 1, 1, h - 2, shade(theme.trim, -0.25))
  } else {
    r.rect(1, 1, w - 2, 1, shade(base, -0.3)).rect(1, 1, 1, h - 2, shade(base, -0.2))
  }
  return r.speckle(seed, 0.2, 0.06).notch(2).outline(theme.ink)
}

const GLYPHS: Record<string, string[]> = {
  close: ['#....#', '.#..#.', '..##..', '..##..', '.#..#.', '#....#'],
  plus: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
  arrow: ['..#...', '..##..', '######', '######', '..##..', '..#...'],
  check: ['.....#', '....##', '#..##.', '####..', '.##...', '......'],
  lock: ['.##.', '#..#', '####', '#..#', '####'],
}

function glyphTile(theme: UiTheme, name: string): Raster {
  const rows = GLYPHS[name]
  if (!rows) throw new Error(`no glyph ${name}`)
  // Doubled glyph on a 16-voxel tile: 64 px, the PN button size.
  const big = rows.flatMap((row) => {
    const wide = [...row].map((ch) => ch + ch).join('')
    return [wide, wide]
  })
  const r = new Raster(16, 16).glyph(big, 2, 2, theme.glyph)
  return r.outline(theme.ink)
}

function slot(theme: UiTheme, state: 'empty' | 'filled' | 'selected' | 'locked', seed: number): Raster {
  const r = panel(theme, 16, 16, seed, true)
  if (state === 'filled') r.rect(3, 3, 10, 10, shade(theme.inset, 0.1))
  if (state === 'selected') {
    r.rect(1, 1, 14, 1, theme.trim).rect(1, 14, 14, 1, theme.trim).rect(1, 1, 1, 14, theme.trim).rect(14, 1, 1, 14, theme.trim)
  }
  if (state === 'locked') r.map((c) => (c[3] ? shade(c, -0.35) : c)).glyph(GLYPHS.lock!, 6, 5, theme.glyph)
  return r
}

function bar(fill: Rgba, w: number): Raster {
  const r = new Raster(w, 4).rect(0, 0, w, 4, fill)
  r.rect(0, 0, w, 1, shade(fill, 0.3)).rect(0, 3, w, 1, shade(fill, -0.25))
  return r
}

function rarity(theme: UiTheme, color: Rgba, seed: number): Raster {
  const r = new Raster(16, 16).rect(0, 0, 16, 16, mix(color, theme.ink, 0.65))
  r.rect(1, 1, 14, 14, mix(color, theme.ink, 0.45)).rect(3, 3, 10, 10, mix(color, theme.ink, 0.25))
  r.rect(0, 0, 16, 1, color).rect(0, 15, 16, 1, shade(color, -0.3)).rect(0, 0, 1, 16, color).rect(15, 0, 1, 16, shade(color, -0.3))
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]] as const) r.set(x, y, shade(color, 0.45))
  return r.speckle(seed, 0.15, 0.05).notch(1).outline(theme.ink)
}

function toggle(theme: UiTheme, on: boolean): Raster {
  const track = on ? theme.primary : shade(theme.inset, -0.2)
  const r = new Raster(22, 12).rect(0, 2, 22, 8, track).notch(2)
  const kx = on ? 11 : 1
  r.rect(kx, 0, 10, 12, theme.secondary).rect(kx + 1, 1, 8, 1, shade(theme.secondary, 0.3)).rect(kx, 10, 10, 2, shade(theme.secondary, -0.3))
  return r.outline(theme.ink)
}

function checkbox(theme: UiTheme, on: boolean): Raster {
  const r = panel(theme, 12, 12, 3, true)
  if (on) r.glyph(GLYPHS.check!, 3, 3, theme.primary)
  return r
}

function tab(theme: UiTheme, state: 'active' | 'inactive' | 'hover', seed: number): Raster {
  const body = state === 'active' ? theme.primary : state === 'hover' ? shade(theme.primary, -0.1) : mix(theme.primary, theme.panel, 0.6)
  const r = new Raster(24, 14).rect(0, 0, 24, 14, body)
  r.rect(1, 1, 22, 1, shade(body, 0.25)).speckle(seed, 0.2, 0.06)
  for (let k = 0; k < 2; k += 1) for (let i = 0; i < 2 - k; i += 1) r.set(i, k, [0, 0, 0, 0]).set(23 - i, k, [0, 0, 0, 0])
  return r.outline(theme.ink)
}

function banner(theme: UiTheme, seed: number): Raster {
  const r = new Raster(80, 18).rect(4, 2, 72, 14, theme.primary)
  r.rect(0, 5, 6, 10, shade(theme.primary, -0.3)).rect(74, 5, 6, 10, shade(theme.primary, -0.3))
  r.set(0, 5, [0, 0, 0, 0]).set(0, 14, [0, 0, 0, 0]).set(79, 5, [0, 0, 0, 0]).set(79, 14, [0, 0, 0, 0])
  r.rect(4, 3, 72, 1, theme.trim).rect(4, 14, 72, 1, shade(theme.trim, -0.25))
  if (theme.motif === 'hazard') for (let x = 6; x < 74; x += 1) for (let y = 4; y < 6; y += 1) r.set(x, y, Math.floor((x + y) / 2) % 2 ? theme.danger : theme.ink)
  return r.speckle(seed, 0.2, 0.06).outline(theme.ink)
}

function tooltip(theme: UiTheme, seed: number): Raster {
  const r = panel(theme, 48, 20, seed, true)
  const out = new Raster(48, 24)
  r.px.forEach((c, i) => out.set(i % 48, Math.floor(i / 48), c))
  for (let k = 0; k < 4; k += 1) out.rect(21 + k, 20 + k, 6 - 2 * k, 1, theme.inset)
  return out.outline(theme.ink)
}

function dialog(theme: UiTheme, seed: number): Raster {
  const r = panel(theme, 64, 48, seed)
  r.rect(3, 3, 58, 7, theme.primary).rect(3, 3, 58, 1, shade(theme.primary, 0.25)).rect(3, 10, 58, 1, shade(theme.primary, -0.35))
  r.rect(4, 13, 56, 31, theme.inset).rect(4, 13, 56, 1, shade(theme.inset, -0.3))
  return r
}

/** Every UI tile for a pack: file name → raster. */
export function uiElements(pack: RvxPackKey): Map<string, Raster> {
  const t = UI_THEMES[pack]
  const out = new Map<string, Raster>()
  const add = (name: string, r: Raster) => {
    if (out.has(name)) throw new Error(`duplicate UI element ${name}`)
    out.set(`ui-${pack}-${name}.png`, r)
  }
  let seed = 1
  for (const [color, c] of [['primary', t.primary], ['secondary', t.secondary], ['danger', t.danger]] as const) {
    for (const state of STATES) {
      add(`buttons-${color}-square-${state}`, button(t, c, state, 16, 16, seed++))
      add(`buttons-${color}-wide-${state}`, button(t, c, state, 64, 20, seed++))
    }
  }
  for (const s of ['active', 'inactive', 'hover'] as const) add(`buttons-tab-${s}`, tab(t, s, seed++))
  for (const s of ['empty', 'filled', 'selected', 'locked'] as const) add(`general-slot-${s}`, slot(t, s, seed++))
  add('general-panel', panel(t, 32, 32, seed++))
  add('general-panel-inset', panel(t, 32, 32, seed++, true))
  add('general-dialog', dialog(t, seed++))
  add('general-tooltip', tooltip(t, seed++))
  add('general-header-banner', banner(t, seed++))
  add('general-progress-frame', panel(t, 66, 8, seed++, true))
  add('general-progress-fill-health', bar(t.bars.health, 62))
  add('general-progress-fill-energy', bar(t.bars.energy, 62))
  add('general-progress-fill-xp', bar(t.bars.xp, 62))
  const tiers: [string, Rgba][] = [['common', pal('gray', 5)], ['uncommon', pal('leaf', 5)], ['rare', pal('sky', 5)], ['epic', pal('arcane', 5)], ['legendary', pal('gold', 6)]]
  tiers.forEach(([name, c]) => add(`rarities-rarity-${name}`, rarity(t, c, seed++)))
  add('general-toggle-on', toggle(t, true))
  add('general-toggle-off', toggle(t, false))
  add('general-checkbox-on', checkbox(t, true))
  add('general-checkbox-off', checkbox(t, false))
  for (const g of ['close', 'plus', 'arrow', 'check']) add(`general-icon-${g}`, glyphTile(t, g))
  return out
}
