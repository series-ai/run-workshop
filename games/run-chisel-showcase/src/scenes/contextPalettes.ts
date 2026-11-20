import type { ContextPackKey } from '@chisel/contracts/packs'
import type { PaletteColors } from '@chisel/contracts/palette'

/**
 * Palettes for world props. Props use the same six UV regions as characters, with these roles:
 *   primary = main body (wood, painted hull), secondary = trim and dark parts, accent = cloth and paint marks,
 *   metal = hardware, hair = foliage, skin = stone, sand and other light neutral surfaces.
 */
export const PROP_PALETTES: Readonly<Record<ContextPackKey, PaletteColors>> = {
  medieval: { skin: '#a39c8c', hair: '#5b7a3a', primary: '#80562f', secondary: '#4e3524', accent: '#9e332d', metal: '#8a94a0', eye: '#1f2634' },
  ww2: { skin: '#b3a47c', hair: '#55683c', primary: '#566045', secondary: '#6b573a', accent: '#d4a24c', metal: '#454c52', eye: '#1f2634' },
  sim: { skin: '#c9c4b8', hair: '#4ca168', primary: '#c49164', secondary: '#56473c', accent: '#3348a1', metal: '#8da6b2', eye: '#426757' },
  cyberpunk: { skin: '#747e96', hair: '#3b6f84', primary: '#495272', secondary: '#30344e', accent: '#329b8e', metal: '#889dca', eye: '#40f5ce' },
  monsters: { skin: '#6e6a60', hair: '#4a5a3a', primary: '#5c402c', secondary: '#2f2925', accent: '#dcd0b2', metal: '#5a636c', eye: '#f2642a' },
}

export const GROUND_COLORS: Readonly<Record<ContextPackKey, { top: string; side: string }>> = {
  medieval: { top: '#47553a', side: '#2c3526' },
  ww2: { top: '#57503f', side: '#353127' },
  sim: { top: '#6d8a8e', side: '#465b62' },
  cyberpunk: { top: '#4d4c68', side: '#313044' },
  monsters: { top: '#3c343d', side: '#231e26' },
}
