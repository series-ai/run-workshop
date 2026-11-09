// The shared palette definitions (DESIGN.md section 4, "Settings and colour schemes", Phase 2): the colour modes, how
// each mode splits into ramps and shades, the themes, and the colour roles of the cat and food sprites' role maps
// (`<name>.roles.png`). Owned by the game; scripts/cat-model.ts re-exports these under the same names, so the sprite
// pipeline and tools/cat-editor.ts paint with exactly the colours the game shows. Pure: no DOM.

/** Colours on screen. The game has 2 / 4 / 8 / 16 / 32 (GAME_MODES; players get 16 and 32), as does the cat editor. */
export type ColorMode = 2 | 4 | 8 | 16 | 32

/** A part of a cat, each painted with one ramp of the palette. */
export type Role = 'fur' | 'mark' | 'accent' | 'gear' | 'gearLight' | 'clothes'

// accent is last so the colour codes of the older roles (2 + role * 8 + shade) don't move
export const ROLES: Role[] = ['fur', 'mark', 'gear', 'gearLight', 'clothes', 'accent']
export const ROLE_NAMES: Record<Role, string> = { fur: 'FUR', mark: 'MARKINGS', accent: 'ACCENT MARKINGS', gear: 'DARK ACCESSORIES', gearLight: 'LIGHT ACCESSORIES', clothes: 'CLOTHES' }

/**
 * The food sprites' roles, in code order (2 + role * 8 + shade), a role space of their own beside the cats' ROLES:
 * - rice: rice, onigiri, scallop, tofu
 * - red: tuna, octopus, crab stick, volcano sauce
 * - wrap: nori, the miso bowl
 * - green: cucumber, avocado, scallion, edamame
 * - pink: salmon, shrimp, rainbow fish
 * - orange: roe, tobiko, shrimp tails
 * - yellow: tamago, gyoza, tempura legs
 * - brown: eel, miso soup
 * Cut rolls' fillings take their roll's role.
 */
export const FOOD_ROLES = ['rice', 'red', 'wrap', 'green', 'pink', 'orange', 'yellow', 'brown'] as const
export type FoodRole = typeof FOOD_ROLES[number]
export const FOOD_ROLE_NAMES: Record<FoodRole, string> = { rice: 'RICE', red: 'RED', wrap: 'NORI / WRAP', green: 'GREEN', pink: 'PINK', orange: 'ORANGE', yellow: 'YELLOW', brown: 'BROWN' }

/** Role-map codes: 0 outline, 1 eye, else 2 + roleIndex * 8 + shade, exported at ROLE_SHADES shades (0 = lightest). */
export const ROLE_SHADES = 5
/** A role-map shade (0..ROLE_SHADES-1) cut down to a mode's shades per ramp. */
export const modeShade = (shade: number, modeShades: number): number => Math.min(modeShades - 1, Math.floor((shade * modeShades) / ROLE_SHADES))

/**
 * How each colour count splits up: number of ramps, shades per ramp, and whether eyes get their own colour. One table
 * for the game and the cat editor (scripts/cat-model.ts re-exports it), so cats look the same in both: 32 is 6 ramps of
 * 5 shades (every role-map shade its own colour) plus the outline and the eye.
 */
export const SPLITS: Record<Exclude<ColorMode, 2>, { ramps: number; shades: number; eye: boolean }> = {
  4: { ramps: 3, shades: 1, eye: false },
  8: { ramps: 3, shades: 2, eye: true },
  16: { ramps: 5, shades: 3, eye: false },
  32: { ramps: 6, shades: 5, eye: true },
}

/**
 * The game's own splits: SPLITS, except that the game's 32 colours go wide rather than deep: 12 ramps (31 colours,
 * plus the outline; the eye is the outline, as in 16) instead of the editor's 6 of 5. Its first six ramps are the
 * theme's own, at 3 shades (cats keep their assignments); the other six are the theme's `wide` ramps (WIDE), some at
 * 2 shades (SHADES_32), so the foods that share a ramp in 16 each get their own colour and the cats' paints (blue,
 * purple, teal, brown, orange...) have real ramps. Change SHADES_32 and the theme's `wide` list to retune it.
 */
export const GAME_SPLITS: typeof SPLITS = { ...SPLITS, 32: { ramps: 12, shades: 3, eye: false } }
/** Shades per ramp in the game's 32 colours: the theme's six at 3; nori 2, roe 2, wood (the eel) 3, leaf 2, sky 2,
 *  lilac 2. Sums to 31. */
export const SHADES_32: readonly number[] = [3, 3, 3, 3, 3, 3, 2, 2, 3, 2, 2, 2]

/** The game's 32 colours' extra ramps (ramps 6-11, a theme's `wide`), and the food roles that move onto them there.
 *  sky: a pale aqua into blue (blue and teal coats, a cool floor); lilac: a pale lilac into purple. */
export const WIDE = { nori: 6, roe: 7, wood: 8, leaf: 9, sky: 10, lilac: 11 } as const
const WIDE_FOOD: Partial<Record<FoodRole, number>> = { wrap: WIDE.nori, orange: WIDE.roe, brown: WIDE.wood, green: WIDE.leaf }

/** n shades from light to dark between two hex colours. */
export function ramp(hi: string, lo: string, n: number): string[] {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = c(hi), b = c(lo)
  return Array.from({ length: n }, (_, k) => {
    const t = n === 1 ? 0.25 : k / (n - 1)
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
  })
}

/** A starting palette: outline, eye, and up to six ramps (light, dark ends), plus default role assignments. */
/** `accent` (second marking colour) defaults to the dark accessories' ramp when a theme doesn't set it. */
/** `food`: which ramp each food role uses, where the theme picks its own (FOOD_GENERIC otherwise). */
/** `few`: where the 3-ramp modes (4 and 8 colours) should differ from catAssign's fallbacks. */
/** `wide`: six more ramps for the game's 32 colours only (GAME_SPLITS, WIDE): nori, roe orange, wood (the eel's
 *  glazed brown), leaf green, sky (pale aqua into blue), lilac (pale lilac into purple);
 *  `wideFood`: any other food role that moves in 32 (the pastels' tuna, onto its rose ramp). `gameCat`: the game's
 *  own cat role ramps where the theme's would be its red (the game keeps red for its special customers): per role, the
 *  ramps to try in order, the first one the mode has. */
/** `mono`: every ramp is one hue family (greys, or tints of one colour): the food can't keep its own colours there, so
 *  the food hue check (tests/food-hues.test.ts) lets it off. `pastel`: a soft scheme whose food may drift a little
 *  (the check gives it looser bands). */
export interface PaletteTheme { outline: string; eye: string; ramps: [string, string][]; assign: Record<Exclude<Role, 'accent'>, number> & { accent?: number }; few?: Partial<Record<Role, number>>; food?: Record<string, number>; mono?: boolean; pastel?: boolean; wide?: [string, string][]; wideFood?: Partial<Record<FoodRole, number>>; gameCat?: Partial<Record<Role, readonly number[]>> }
export const THEMES: Record<string, PaletteTheme> = {
  TOKYO: { outline: '#22181c', eye: '#22181c', ramps: [['#fff4e2', '#d0a882'], ['#f2a23c', '#8a3d1a'], ['#4a5ea8', '#151a3a'], ['#e8435a', '#6a0f1e'], ['#f7c6d4', '#c46a88'], ['#a8e0c8', '#2f7a64']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 0, clothes: 3 } },
  INK: { outline: '#1a1917', eye: '#1a1917', ramps: [['#eceae2', '#a9a59a'], ['#6a665e', '#2a2926'], ['#4a4843', '#1a1917'], ['#c9c5b8', '#7d796f'], ['#f6f4ee', '#c2beb2'], ['#8f8a7e', '#45423c']], wide: [['#3a3936', '#121110'], ['#d6d2c6', '#8a867c'], ['#b8b4a8', '#4e4b44'], ['#e2dfd6', '#9a968a'], ['#dcdad2', '#6a675f'], ['#c4c1b8', '#3e3c38']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 }, mono: true },
  NEON: { outline: '#120a1f', eye: '#120a1f', ramps: [['#f7f3ff', '#b9a8e0'], ['#ff3fa4', '#8a0f55'], ['#1fe0d0', '#0b5a6e'], ['#fff36b', '#c99a00'], ['#6c3cff', '#2a0f7a'], ['#7dff6a', '#1f8a2a']], assign: { fur: 0, mark: 1, gear: 4, gearLight: 0, clothes: 2 } },
  MATCHA: { outline: '#1c2018', eye: '#1c2018', ramps: [['#f5f1e3', '#c8c0a0'], ['#8fb04a', '#2f4416'], ['#4a3a2c', '#16110c'], ['#c0582c', '#5e2410'], ['#e9e4d0', '#a39b7c'], ['#d9a441', '#7a5212']], assign: { fur: 0, mark: 3, gear: 2, gearLight: 4, clothes: 1 }, few: { mark: 2 } },
  // made for the food: rice cream, a green that darkens to nori, salmon pink, tuna red, egg yellow
  // into roe orange, eel brown
  SUSHI: { gameCat: { clothes: [10, 1] }, outline: '#1b201c', eye: '#1b201c', ramps: [['#fffaf0', '#dccfb6'], ['#8fbf5a', '#121c16'], ['#ffb8a8', '#e0604e'], ['#f0525e', '#6e1222'], ['#ffdf6a', '#e0761a'], ['#c08a58', '#4a2a16']], wide: [['#8a8e88', '#0e1410'], ['#ffaa62', '#e0521e'], ['#e8a456', '#6a2a12'], ['#c4e27a', '#5a8c30'], ['#8eb4e6', '#2c4a92'], ['#bca2e2', '#56388a']],
    assign: { fur: 0, mark: 4, gear: 1, gearLight: 0, clothes: 3 }, few: { mark: 2, clothes: 2 },
    food: { rice: 0, wrap: 1, green: 1, pink: 2, red: 3, yellow: 4, orange: 4, brown: 5 } },
  // warm primaries
  PRIMARY: { outline: '#1f2440', eye: '#1f2440', ramps: [['#fff6e0', '#e8c99a'], ['#e63c2e', '#8c1a12'], ['#2a5cc9', '#13275e'], ['#f7c22b', '#b3730c'], ['#ffe9a8', '#e0a63c'], ['#3aa05a', '#1a5530']], assign: { fur: 0, mark: 4, gear: 2, gearLight: 0, clothes: 1 } },
  CRAYON: { outline: '#3b2216', eye: '#3b2216', ramps: [['#fdf0d8', '#e2b98a'], ['#f05a28', '#9a2a0e'], ['#2f78c4', '#183e70'], ['#ffd23f', '#c48a12'], ['#ff9fb2', '#c8546e'], ['#5bb85a', '#2a6a2c']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 0, clothes: 4 } },
  RISO: { outline: '#2d5bd1', eye: '#16306e', ramps: [['#fff8ec', '#f5c9c0'], ['#ff4f79', '#b3264a'], ['#2d5bd1', '#16306e'], ['#ffd200', '#e08b00'], ['#ffb3c6', '#ff6f91'], ['#00a95c', '#005c32']], assign: { fur: 0, mark: 3, gear: 2, gearLight: 0, clothes: 1 } },
  // soft and earthy: no black lines
  CLAY: { outline: '#5a3a2a', eye: '#3a2418', ramps: [['#f3e6d3', '#cfae8c'], ['#c4704a', '#7a3a22'], ['#6b7f5a', '#36442b'], ['#d9a65a', '#8f6328'], ['#e8d2b0', '#b8946a'], ['#a4786a', '#5e3e36']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 } },
  MOSS: { outline: '#3d4a32', eye: '#262e1f', ramps: [['#eef0dc', '#c3c7a0'], ['#7d9a5a', '#3f5530'], ['#5a4636', '#2c2119'], ['#b88c5a', '#6e4e2c'], ['#d8e2b8', '#9fb07a'], ['#9a6f8a', '#553a4c']], assign: { fur: 0, mark: 3, gear: 2, gearLight: 4, clothes: 1 }, few: { mark: 2 } },
  LINEN: { outline: '#5e4e42', eye: '#3a3029', ramps: [['#faf3ea', '#dcc8b0'], ['#c9a07a', '#8a6444'], ['#9aa58c', '#66705a'], ['#c99c8a', '#8e6455'], ['#efe1cc', '#cdb79a'], ['#b4a8c4', '#7a6e8c']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 } },
  DESERT: { outline: '#6b3a28', eye: '#3b1e14', ramps: [['#fbe8cc', '#e6b98a'], ['#d9773c', '#8a3d18'], ['#4a6a7a', '#223a46'], ['#e0b04a', '#9a6c1a'], ['#f2c4a8', '#c4805e'], ['#8a9a5a', '#4a5530']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 } },
  // just for fun
  SHERBET: { outline: '#6a4ca8', eye: '#3a2466', ramps: [['#fff7f0', '#ffd6c4'], ['#ff9ec4', '#d45a8e'], ['#7ec8ff', '#3a7ad1'], ['#ffe47a', '#f0a83c'], ['#c8f5c0', '#6ac87a'], ['#d4b8ff', '#8a64d8']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 } },
  SUNSET: { outline: '#3a1240', eye: '#2a0a30', ramps: [['#ffeedd', '#ffb89a'], ['#ff6a5a', '#a8243a'], ['#5a2a7a', '#2a0f40'], ['#ffb43c', '#c4601a'], ['#ffd0e0', '#e07aa8'], ['#3ab0b0', '#1a5a6a']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 0, clothes: 3 } },
  GAMEBOY: { outline: '#0f380f', eye: '#0f380f', ramps: [['#e0f8d0', '#9bbc0f'], ['#8bac0f', '#306230'], ['#306230', '#0f380f'], ['#9bbc0f', '#4f7a28'], ['#c4e8a0', '#8bac0f'], ['#6a9a3a', '#2a4a1a']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 }, mono: true },
  BLUEPRINT: { outline: '#e8f0ff', eye: '#ffffff', ramps: [['#3a5ab8', '#1a2a66'], ['#e8f0ff', '#9ab0e0'], ['#0f1a40', '#050a1f'], ['#ffcc33', '#c48a10'], ['#9ad4ff', '#4a8ad1'], ['#ff6a6a', '#a82a3a']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 } },
}

/**
 * The game's own themes for the schemes that don't come from THEMES (kept out of it so the cat editor's theme list
 * doesn't change). CLASSIC: the game's ink on cream, with a sushi bar's colours like SUSHI's (salmon pink, a green
 * that darkens to nori, tuna red, egg yellow into amber, indigo). NIGHT (NEON NIGHT): a night market under neon, a
 * deep violet night for ink, cream paper and walls going lavender, and every food in its own colour pushed bright: a
 * glowing coral salmon, a lime green that darkens to a violet-black nori, a hot tuna red, a lemon tamago into orange;
 * the same ramp order and food map as CLASSIC. RAMUNE and SAKURA (SAKURA MOCHI): the pastels, periwinkle and pink.
 * AMBER: a monochrome amber terminal, every ramp a shade of amber.
 */
export const GAME_THEMES: Record<'CLASSIC' | 'NIGHT' | 'RAMUNE' | 'SAKURA' | 'KAWA' | 'ASAICHI' | 'AMBER', PaletteTheme> = {
  CLASSIC: { gameCat: { clothes: [5, 2] }, outline: '#1a1917', eye: '#1a1917', ramps: [['#eceae2', '#cdc6b6'], ['#ffb8a2', '#e0715b'], ['#84a672', '#1d2620'], ['#ff6f62', '#a82e2e'], ['#ffda70', '#c98428'], ['#5c6ca2', '#283050']], wide: [['#8c8c86', '#151a16'], ['#ffb47a', '#e0662e'], ['#e4a458', '#6c2c14'], ['#b4d27a', '#5a8a3a'], ['#90b0dc', '#2e4a86'], ['#b8a2d8', '#54408a']],
    assign: { fur: 0, mark: 4, gear: 2, gearLight: 1, clothes: 3 },
    food: { rice: 0, pink: 1, orange: 1, wrap: 2, green: 2, red: 3, yellow: 4, brown: 4 } },
  NIGHT: { gameCat: { clothes: [5, 2] }, outline: '#1a0b2e', eye: '#1a0b2e', ramps: [['#fff6ea', '#c9b4f2'], ['#ffb39c', '#ff6a3c'], ['#9cff3c', '#120a22'], ['#ff4a6a', '#a3002e'], ['#ffec4a', '#ff8a00'], ['#3ae0ff', '#2a3ab0']], wide: [['#3a2a5a', '#0c0618'], ['#ffb04a', '#ff5a1a'], ['#f0a850', '#702a18'], ['#b8ff6a', '#2a9a4a'], ['#7ad8ff', '#2a4ad0'], ['#c08aff', '#6a2ad0']],
    assign: { fur: 0, mark: 4, gear: 2, gearLight: 1, clothes: 3 },
    food: { rice: 0, pink: 1, orange: 1, wrap: 2, green: 2, red: 3, yellow: 4, brown: 4 } },
  // the pastels: soft and airy, a deep periwinkle navy for ink, low-contrast walls, a periwinkle belt (the dark tone,
  // set by the scheme's picks), pink accents; the food drifts soft but keeps its family (salmon pink or peach, avocado
  // mint, nori dark, rice light). Ramps: paper into the walls' tint, pink salmon (and tuna), mint darkening to the
  // nori, periwinkle into indigo, butter into peach (tamago, roe, eel), and (32 only) a rose
  RAMUNE: { outline: '#2b2f6b', eye: '#2b2f6b', ramps: [['#fbf8ff', '#b4bdf2'], ['#ffc9d8', '#ec7697'], ['#b4f2d2', '#262c58'], ['#a7b0f7', '#4a50b0'], ['#ffeaa6', '#ffa77c'], ['#ff9fb4', '#cc4a6c']], wide: [['#4a4f8a', '#1e2250'], ['#ffcfa8', '#ff9a6a'], ['#f4c890', '#a4603a'], ['#c8f8dc', '#5ac89a'], ['#a8d8f4', '#4a78c0'], ['#cab4f2', '#7a5ac0']],
    assign: { fur: 0, mark: 1, gear: 3, gearLight: 0, clothes: 3 }, pastel: true, wideFood: { red: 5 },
    food: { rice: 0, pink: 1, red: 1, orange: 4, wrap: 2, green: 2, yellow: 4, brown: 4 } },
  SAKURA: { outline: '#3b2c5e', eye: '#3b2c5e', ramps: [['#fff7f9', '#f3c6d6'], ['#ffcfc2', '#f0828a'], ['#c6f0c4', '#2e2a4c'], ['#c5c9ff', '#6c72cc'], ['#fff1b4', '#f6ac72'], ['#ffa3b8', '#c94870']], wide: [['#4e3e6e', '#221a3a'], ['#ffd6b4', '#f7a070'], ['#f6cc94', '#a8623e'], ['#d0f2c8', '#6ac07a'], ['#acd4f0', '#4e7ab8'], ['#d2b4ee', '#8058b4']],
    assign: { fur: 0, mark: 1, gear: 3, gearLight: 0, clothes: 1 }, pastel: true, wideFood: { red: 5 },
    food: { rice: 0, pink: 1, red: 1, orange: 4, wrap: 2, green: 2, yellow: 4, brown: 4 } },
  // the worlds' own: KAWA (Kawabata's river: airy, pale aqua walls, a teal-green belt, deep teal ink) and ASAICHI
  // (Mugen's dawn market: pale peach walls, an olive belt, gold, a warm brown-black ink); CLASSIC's ramp order and food
  KAWA: { outline: '#163038', eye: '#163038', ramps: [['#f6fbf8', '#b4dad6'], ['#ffbca8', '#e8705a'], ['#86c8a4', '#0e201e'], ['#f2585e', '#8a1a2a'], ['#ffe07a', '#e09030'], ['#78c8e0', '#1e5a7a']], wide: [['#8a948e', '#0e1816'], ['#ffaa62', '#e0521e'], ['#e8a456', '#6a2a12'], ['#b8e07a', '#4a8a3a'], ['#88c4e4', '#24508a'], ['#b8a6e0', '#54409a']],
    assign: { fur: 0, mark: 4, gear: 2, gearLight: 1, clothes: 3 }, gameCat: { clothes: [5, 2] },
    food: { rice: 0, pink: 1, orange: 1, wrap: 2, green: 2, red: 3, yellow: 4, brown: 4 } },
  ASAICHI: { outline: '#3a1e1a', eye: '#3a1e1a', ramps: [['#fff6ec', '#f4cfb4'], ['#ffb4a0', '#ec6a52'], ['#aac070', '#1c2016'], ['#f25a50', '#8a1e1e'], ['#ffd860', '#d8801c'], ['#d6b2e0', '#7a4a8a']], wide: [['#8e8a84', '#141210'], ['#ffaa62', '#e0521e'], ['#e8a456', '#6a2a12'], ['#c0dc78', '#4e8a34'], ['#90b8e4', '#2e4e8e'], ['#c8a6e2', '#5c3a90']],
    assign: { fur: 0, mark: 4, gear: 2, gearLight: 1, clothes: 3 }, gameCat: { clothes: [5, 2] },
    food: { rice: 0, pink: 1, orange: 1, wrap: 2, green: 2, red: 3, yellow: 4, brown: 4 } },
  AMBER: { outline: '#24140a', eye: '#24140a', ramps: [['#ffb000', '#d08400'], ['#ffd27a', '#e8a020'], ['#8a5210', '#4a2a08'], ['#ffe6b0', '#ffc24a'], ['#c47810', '#7a440a'], ['#e89a18', '#9a5a0c']], assign: { fur: 0, mark: 1, gear: 2, gearLight: 4, clothes: 3 }, mono: true },
}

/**
 * Which ramp each cat role uses with `n` ramps. A role whose ramp the mode hasn't got (4 and 8 colours have only
 * three: paper, a colour, a dark) falls back by what it is rather than wrapping round (which put shirts in the fur's
 * colour): light accessories go pale (the fur's ramp), markings and clothes take the colour ramp, accents the dark.
 * A theme's `few` overrides these for its 3-ramp modes.
 */
export function catAssign(t: PaletteTheme, n: number): Record<Role, number> {
  const FALL: Record<Role, number> = { fur: 0, mark: 1, gear: 2, gearLight: 0, clothes: 1, accent: 2 }
  const out = {} as Record<Role, number>
  for (const r of ROLES) {
    const want = r === 'accent' ? t.assign.accent ?? t.assign.gear : t.assign[r]
    const few = n <= 3 ? t.few?.[r] : undefined
    out[r] = few !== undefined && few < n ? few : want < n ? want : Math.min(FALL[r], n - 1)
  }
  return out
}

// ---------------------------------------------------------------- the game's palette per mode

/** The colour modes the game has. Players are offered PLAYER_MODES; 2, 4 and 8 stay for testing (?modes=all). */
export const GAME_MODES = [2, 4, 8, 16, 32] as const
export type GameMode = typeof GAME_MODES[number]
/** The modes the settings sign offers players, and what a saved 2, 4 or 8 comes back as. */
export const PLAYER_MODES = [16, 32] as const

/** A colour picked from a theme for the game's own (non-sprite) roles: [ramp index in the theme, shade in the mode]. */
export type Pick = readonly [ramp: number, shade: number]

/**
 * Which ramp colours the game's flat roles use, per mode. `light` / `mid` / `dark` are the dither tones (sparse,
 * checker, dense) as solid colours; `accent` is gold (the koban, crowns, gold plates, sparkles); `red` is the shopfront's
 * vermilion (the title's lit OPEN sign), found in the theme's ramps by hue (redPick) unless a scheme sets it. A pick's
 * ramp must be one the mode has (SPLITS); its shade is clamped to the mode's shades.
 */
export interface GamePicks { paper: Pick; light: Pick; mid: Pick; dark: Pick; accent: Pick; red?: Pick }

/** The defaults: tones from the paper ramp's own shades where the mode has them, else the marking and dark ramps. */
export function defaultPicks(mode: Exclude<GameMode, 2>, paperRamp = 0, goldRamp = 3): GamePicks {
  const p = paperRamp
  // the markings' ramp, or the first ramp when the paper already took the markings' (NEON's pink)
  const m = p === 1 ? 0 : 1
  if (mode === 4) return { paper: [p, 0], light: [m, 0], mid: [m, 0], dark: [2, 0], accent: [m, 0] }
  if (mode === 8) return { paper: [p, 0], light: [p, 1], mid: [m, 0], dark: [2, 0], accent: [m, 0] }
  // 16 and 32 (both three shades a ramp in the game: 32 goes wide, not deep)
  return { paper: [p, 0], light: [p, 1], mid: [p, 2], dark: [2, 1], accent: [goldRamp, 0] }
}

/** Which ramp each food role uses when a theme doesn't say: rice on the palest ramp, nori on the dark one, the fish spread over the bright ones. */
export const FOOD_GENERIC: Record<FoodRole, number> = { rice: 0, red: 3, wrap: 2, green: 5, pink: 4, orange: 1, yellow: 1, brown: 3 }

/**
 * Which ramp each food role uses in a mode: the theme's own choice, else FOOD_GENERIC. A ramp the mode doesn't have
 * falls back: rice to 0, wrap to min(2, ramps - 1), green to the wrap ramp, brown to the yellow ramp (eel glaze reads
 * amber), and the rest to the "warm" ramp: the highest one that's neither rice (0) nor the wrap ramp.
 * The same rule as tools/cat-editor.ts, so food looks the same in the game as in the editor.
 */
export function foodAssign(t: PaletteTheme, mode: Exclude<ColorMode, 2>): Record<FoodRole, number> {
  const n = SPLITS[mode].ramps
  const want = { ...FOOD_GENERIC, ...(t.food ?? {}) } as Record<FoodRole, number>
  const out = {} as Record<FoodRole, number>
  const wrap = want.wrap < n ? want.wrap : Math.min(2, n - 1)
  let warm = 1
  for (let i = n - 1; i > 0; i--) if (i !== wrap) { warm = i; break }
  const yellow = want.yellow < n ? want.yellow : warm
  for (const role of FOOD_ROLES) {
    out[role] = want[role] < n ? want[role]
      : role === 'rice' ? 0
      : role === 'wrap' ? wrap
      : role === 'green' ? wrap
      : role === 'brown' ? yellow
      : warm
  }
  return out
}

// ---------------------------------------------------------------- per-look paints
/**
 * A look's own colours. Every cat paints its roles (fur, markings, clothes...) with the scheme's ramps (catAssign), so
 * by default every cat is the same cream with the same yellow markings. A look in the roster (scripts/cat-roster.ts,
 * src/cat-roster.ts `paint`) can instead name a paint for a role: a ginger cat is `{ fur: 'ginger' }`, red patches
 * `{ mark: 'red' }`. Paints are colour names, not ramps, so they work in every scheme and mode: each one resolves to
 * the nearest colours the mode already has (paintColours), never a new one, so a mode keeps its colour count.
 */
export const PAINTS = ['cream', 'ginger', 'dark', 'red', 'pink', 'yellow', 'green', 'blue', 'teal', 'purple', 'brown', 'grey', 'orange'] as const
export type Paint = typeof PAINTS[number]
/** What each paint wants, light (lit) to dark (shadow): the mode's nearest colours stand in for these. */
export const PAINT_TARGETS: Record<Paint, readonly [string, string, string]> = {
  cream: ['#efe2c6', '#dccaa6', '#c4ac86'],
  ginger: ['#f6a24a', '#e07628', '#b8501c'],
  dark: ['#3c3c40', '#28282c', '#18181a'],
  red: ['#f05a5a', '#c43440', '#7a1a24'],
  pink: ['#ffbcb0', '#f49488', '#d86a60'],
  yellow: ['#ffe070', '#f4b040', '#e07a1a'],
  green: ['#94c462', '#5c8a3c', '#2c4a24'],
  blue: ['#7a9ae0', '#4a64b0', '#283a78'],
  teal: ['#78c0c8', '#3a8496', '#1e4e64'],
  purple: ['#b08ad8', '#7a52a8', '#4a2a70'],
  brown: ['#ecb466', '#c47a2c', '#8a4a1a'],
  grey: ['#9a9c98', '#8a8c88', '#4a4c4a'],
  orange: ['#ffb060', '#f07a2a', '#c04e14'],
}
/** Paints dark enough that the eyes on them go light (the paper), or a black cat's face would be blank. */
export const DARK_PAINTS: readonly Paint[] = ['dark']

/** '#rrggbb' to OKLab [L, a, b]: distances in it follow what the eye sees, so the nearest colour is the closest look. */
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

/** Every way to walk `len` shades down a ramp of `n`: non-decreasing index lists (a paint may start further down its
 *  ramp, or hold a shade, but never gets lighter going into the shadow). */
function walks(n: number, len = n): number[][] {
  const out: number[][] = []
  const go = (acc: number[], from: number) => {
    if (acc.length === len) { out.push(acc); return }
    for (let i = from; i < n; i++) go([...acc, i], i)
  }
  go([], 0)
  return out
}

/**
 * A paint in a mode: `shades` colours (light to dark) from ONE of the mode's ramps, so a cat stays one hue from its lit
 * side into its shadow: the ramp, and the walk down it, nearest (OKLab) to the paint's targets. A walk may start lower
 * on the ramp (SUSHI's ginger is its yellow ramp's orange end) or hold a shade, at a small cost for each shade it
 * repeats. Mono schemes (INK) land on their greys by lightness; a scheme without the colour gets its nearest stand-in.
 */
export function paintColours(ramps: readonly (readonly string[])[], shades: number, paint: Paint, avoid = -1, avoidCream = -1): string[] {
  const want = PAINT_TARGETS[paint]
  // the target at each shade: the three spread over the mode's shades (one shade: the lit one; two: lit and shadow)
  const target = Array.from({ length: shades }, (_, k) => oklab(shades === 1 ? want[0] : want[Math.round((k * (want.length - 1)) / (shades - 1))]))
  let best: string[] = ramps[0].slice(0, shades) as string[]
  let bd = Infinity
  for (const [ri, rp] of ramps.entries()) {
    if (ri === avoid) continue
    // a cream or ginger cat is never the scheme's salmon (the pink paint's): it'd read pink in a world without a cream
    if ((paint === 'cream' || paint === 'ginger') && ri === avoidCream) continue
    const lab = rp.map(oklab)
    for (const w of walks(rp.length, shades)) {
      let d = 0
      w.forEach((i, k) => {
        const [L, A, B] = lab[i]
        const [tl, ta, tb] = target[k]
        // hue counts a little more than lightness: a brown cat goes orange where the scheme has no brown, not red
        d += (L - tl) ** 2 + 1.6 * ((A - ta) ** 2 + (B - tb) ** 2)
        if (k > 0 && w[k - 1] === i) d += 0.002
        // a colour of another family entirely (a brown cat in a mint) only where nothing nearer in hue exists
        if (Math.hypot(A, B) > 0.05 && Math.hypot(ta, tb) > 0.05) {
          const dh = Math.abs(Math.atan2(B, A) - Math.atan2(tb, ta))
          if (Math.min(dh, Math.PI * 2 - dh) > 1.4) d += 0.05
        }
      })
      if (d < bd) { bd = d; best = w.map((i) => rp[i]) }
    }
  }
  return best
}

/** A scheme's colours in one mode: what the renderer's lookup tables are built from. */
export interface ModePalette {
  mode: GameMode
  /** The one-bit pair (ink = the theme's outline), and the flat game roles. */
  ink: string
  paper: string
  light: string
  mid: string
  dark: string
  accent: string
  /** The shopfront's vermilion (GamePicks), and whether words on it go in ink (else paper). */
  red: string
  redInk: boolean
  /** Role maps: outline and eye, and the mode's ramps (light to dark), none in mode 2. */
  outline: string
  eye: string
  ramps: string[][]
  /** Ramp index per cat role and per food role. */
  cat: Record<Role, number>
  food: Record<FoodRole, number>
  /** Shades a food role is drawn darker by (the eel, where it shares the tamago's ramp: its glaze, not the egg). */
  foodShift: Partial<Record<FoodRole, number>>
  /** Each paint's colours in the mode, light to dark, one per shade (paintColours; none in mode 2). */
  paint: Record<Paint, string[]>
}

// ---------------------------------------------------------------- colour maths

/** '#rrggbb' → [r, g, b] (0-255). */
export function hexRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG relative luminance of '#rrggbb'. */
export function luminance(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two '#rrggbb' colours (1-21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** A colour's hue (degrees) and saturation (HSV, 0-1). */
function hueSat(hex: string): { h: number; s: number } {
  const [r, g, b] = hexRgb(hex)
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  if (d === 0) return { h: 0, s: 0 }
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s: d / mx }
}

/** How far apart two colours are (RGB distance, 0-441): a dark red stays clear of a blue ink though both are dark. */
function apart(a: string, b: string): number {
  const x = hexRgb(a)
  const y = hexRgb(b)
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** How close a colour is to a hue (degrees, `width` either side), weighted by its saturation; 0 for greys and pastels. */
function hueScore(hex: string, want: number, width: number): number {
  const { h, s } = hueSat(hex)
  if (s < 0.3) return 0
  const dh = Math.min(Math.abs(h - want), 360 - Math.abs(h - want))
  return dh >= width ? 0 : s * (1 - dh / width)
}

/**
 * The shopfront's red for a mode's ramps (the paper's ramp `paperRamp` left out): the shade nearest a deep vermilion.
 * Darker shades score higher, but a shade too near the ink (it would read as more ink) scores less, and none at all
 * when right on it, and so does one that small words in ink or paper don't read on (contrast under 3.5). Null when the
 * scheme has no red at all (GAME BOY, NEON): the caller falls back to the dark tone.
 */
export function redPick(ramps: string[][], paperRamp: number, ink: string, paper: string): Pick | null {
  let out: Pick | null = null
  let top = 0
  ramps.forEach((rp, r) => {
    if (r === paperRamp) return
    rp.forEach((col, k) => {
      const gap = apart(col, ink)
      if (gap < 60) return
      const reads = Math.max(contrast(col, ink), contrast(col, paper)) >= 3.5
      const v = hueScore(col, 0, 40) * (1.2 - luminance(col)) * (gap >= 90 ? 1 : 0.75) * (reads ? 1 : 0.6)
      if (v > top) { top = v; out = [r, k] }
    })
  })
  return out
}

/** Build a mode's palette from a theme (mode 2 is just the pair: tones stay dithers there). */
export function modePalette(t: PaletteTheme, mode: GameMode, pair: { ink: string; paper: string }, picks?: GamePicks): ModePalette {
  if (mode === 2) {
    const r0 = { fur: 0, mark: 0, gear: 0, gearLight: 0, clothes: 0, accent: 0 }
    return { mode, ink: pair.ink, paper: pair.paper, light: pair.paper, mid: pair.paper, dark: pair.ink, accent: pair.paper, red: pair.ink, redInk: false, outline: pair.ink, eye: pair.ink, ramps: [], cat: r0, food: Object.fromEntries(FOOD_ROLES.map((r) => [r, 0])) as Record<FoodRole, number>, foodShift: {}, paint: Object.fromEntries(PAINTS.map((k) => [k, []])) as unknown as Record<Paint, string[]> }
  }
  const sp = GAME_SPLITS[mode]
  // 32: the theme's six ramps, then its six wide ones (a theme without them repeats its first six), at SHADES_32
  const src = mode === 32 ? [...t.ramps.slice(0, 6), ...(t.wide ?? t.ramps.slice(0, 6))] : t.ramps
  const ramps = src.slice(0, sp.ramps).map(([hi, lo], i) => ramp(hi, lo, mode === 32 ? SHADES_32[i] : sp.shades))
  const pk = picks ?? defaultPicks(mode)
  const at = ([r, s]: Pick) => { const rp = ramps[r < ramps.length ? r : 0]; return rp[Math.min(s, rp.length - 1)] }
  // the game keeps red for its special customers: a theme's `gameCat` moves its regular cats' roles off the red ramp
  const food = mode === 32 && t.wide !== undefined ? { ...foodAssign(t, mode), ...WIDE_FOOD, ...t.wideFood } : foodAssign(t, mode)
  const cat = catAssign(t, sp.ramps)
  for (const [role, list] of Object.entries(t.gameCat ?? {}) as [Role, readonly number[]][]) {
    const r = list.find((i) => i < sp.ramps)
    if (r !== undefined) cat[role] = r
  }
  const ink = t.outline
  const paper = at(pk.paper)
  const redAt = pk.red ?? redPick(ramps, pk.paper[0], ink, paper) ?? pk.dark
  const red = at(redAt)
  const redRamp = redAt[0]
  return {
    mode, ink, paper, light: at(pk.light), mid: at(pk.mid), dark: at(pk.dark), accent: at(pk.accent),
    red, redInk: contrast(ink, red) > contrast(paper, red),
    outline: t.outline, eye: sp.eye ? t.eye : t.outline, ramps, cat,
    food, foodShift: food.brown === food.yellow ? { brown: 2 } : {},
    // red is kept for the customers with special rules: no other paint may land on the red's ramp
    paint: Object.fromEntries(PAINTS.map((k) => [k, paintColours(ramps, sp.shades, k, k === 'red' || k === 'pink' ? -1 : redRamp, food.pink)])) as unknown as Record<Paint, string[]>,
  }
}

/** Every distinct colour a mode palette can put on screen. */
export function paletteColors(p: ModePalette): string[] {
  return [...new Set([p.ink, p.paper, p.light, p.mid, p.dark, p.accent, p.red, p.outline, p.eye, ...p.ramps.flat()])]
}
