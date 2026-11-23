import type { ContextPackKey } from '@voxchar/contracts/packs'
import type { PaletteColors } from '@voxchar/contracts/palette'

/**
 * Palettes for world props. Props use the same six UV regions as characters, with these roles:
 *   primary = main body (wood, painted hull, steel), secondary = trim and dark parts, accent = hazard stripes / LEDs,
 *   metal = hardware & frames, hair = dark rubber / charcoal, skin = concrete, sand & light neutral surfaces.
 */
export const PROP_PALETTES: Readonly<Record<ContextPackKey, Required<PaletteColors>>> = {
  heist: {
    skin: '#9e978b',
    hair: '#2e2b29',
    primary: '#c87028',
    secondary: '#5e554c',
    accent: '#d9a426',
    metal: '#848d96',
    trim: '#b88f5a',
    leather: '#6e4930',
    visor: '#42b8ea',
    detail: '#a83428',
  },
  industrial: {
    skin: '#9d9586',
    hair: '#2c2c2e',
    primary: '#8f6339',
    secondary: '#455059',
    accent: '#c94332',
    metal: '#929aa3',
    trim: '#bfa67a',
    leather: '#5c3f2b',
    visor: '#4ebae0',
    detail: '#a8362a',
  },
  security: {
    skin: '#8e969e',
    hair: '#232830',
    primary: '#394957',
    secondary: '#242b33',
    accent: '#2cb5e8',
    metal: '#a4aeb8',
    trim: '#d2dae2',
    leather: '#302824',
    visor: '#2cb5e8',
    detail: '#b83830',
  },
  creatures: {
    skin: '#7a7267',
    hair: '#272422',
    primary: '#6b4d34',
    secondary: '#3b3733',
    accent: '#e85826',
    metal: '#76808a',
    trim: '#8d7b64',
    leather: '#483426',
    visor: '#ff5238',
    detail: '#6d3e2c',
  },
  fantasy: {
    skin: '#948b7e',
    hair: '#2d2825',
    primary: '#355487',
    secondary: '#4b5059',
    accent: '#f08c2b',
    metal: '#8c949e',
    trim: '#d6c6a5',
    leather: '#5c3c28',
    visor: '#34414e',
    detail: '#9c362c',
  },
}

export const GROUND_COLORS: Readonly<Record<ContextPackKey, { top: string; side: string }>> = {
  heist: { top: '#4a4742', side: '#2b2926' },
  industrial: { top: '#4f4a40', side: '#2e2b25' },
  security: { top: '#3c4552', side: '#232830' },
  creatures: { top: '#3b3634', side: '#221f1e' },
  fantasy: { top: '#43484f', side: '#26292e' },
}
