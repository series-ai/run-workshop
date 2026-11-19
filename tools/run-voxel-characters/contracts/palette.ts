import { z } from 'zod'

/**
 * 10-region UV palette encoding used by both Blender (`voxchar.py`) and
 * Three.js (`polyMaterial.ts`):
 *   u in [0..1] selects the semantic material region (10 horizontal bands)
 *   v in [0..1] supplies a baked shading/overhang AO ramp (0.15 dark crevice -> 0.85 bright top;
 *              v >= 0.92 marks emissive accent voxels like cyborg eyes & LEDs)
 */
export const PALETTE_REGIONS = [
  'skin',
  'hair',
  'primary',
  'secondary',
  'accent',
  'metal',
  'trim',
  'leather',
  'visor',
  'detail',
] as const
export type PaletteRegion = (typeof PALETTE_REGIONS)[number]

export const PALETTE_REGION_U: Readonly<Record<PaletteRegion, number>> = {
  skin: 0.05,
  hair: 0.15,
  primary: 0.25,
  secondary: 0.35,
  accent: 0.45,
  metal: 0.55,
  trim: 0.65,
  leather: 0.75,
  visor: 0.85,
  detail: 0.95,
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const paletteColorsSchema = z.object({
  skin: hexColor,
  hair: hexColor,
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  metal: hexColor,
  trim: hexColor.optional(),
  leather: hexColor.optional(),
  visor: hexColor.optional(),
  detail: hexColor.optional(),
})
export type PaletteColors = z.infer<typeof paletteColorsSchema>
export type ResolvedPaletteColors = Readonly<Record<PaletteRegion, string>>

export function resolvePaletteColors(palette: PaletteColors): ResolvedPaletteColors {
  return {
    skin: palette.skin,
    hair: palette.hair,
    primary: palette.primary,
    secondary: palette.secondary,
    accent: palette.accent,
    metal: palette.metal,
    trim: palette.trim ?? palette.accent,
    leather: palette.leather ?? '#4f3626',
    visor: palette.visor ?? '#3fbbe8',
    detail: palette.detail ?? '#b93b2e',
  }
}

/** Garment regions. A color below the dark floor gives a silhouette with no visible voxel facets. */
export const GARMENT_REGIONS = ['primary', 'secondary', 'leather'] as const satisfies readonly PaletteRegion[]

/** Dark-albedo floor of the garment regions: WCAG relative luminance. `#333333` is 0.033. */
export const MIN_GARMENT_LUMINANCE = 0.03

/** WCAG relative luminance (0 black .. 1 white) of a `#rrggbb` color. */
export function relativeLuminance(hex: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** The garment regions of a palette that are below the dark-albedo floor. */
export function garmentRegionsBelowDarkFloor(palette: PaletteColors): PaletteRegion[] {
  const resolved = resolvePaletteColors(palette)
  return GARMENT_REGIONS.filter((region) => relativeLuminance(resolved[region]) < MIN_GARMENT_LUMINANCE)
}

export const SKIN_PRESETS = [
  { name: 'Warm Peach', hex: '#e8aa7e' },
  { name: 'Porcelain', hex: '#f0c7a5' },
  { name: 'Olive Tan', hex: '#c8875b' },
  { name: 'Amber Brown', hex: '#9e5d38' },
  { name: 'Deep Espresso', hex: '#633c28' },
  { name: 'Bot Steel', hex: '#88929b' },
] as const

export const HAIR_PRESETS = [
  { name: 'Dark Espresso', hex: '#382419' },
  { name: 'Raven Black', hex: '#232429' },
  { name: 'Wheat Blonde', hex: '#cfa052' },
  { name: 'Rust Copper', hex: '#8f3f24' },
  { name: 'Ash Silver', hex: '#b4bac2' },
  { name: 'Crimson Dyed', hex: '#8f2f34' },
] as const

export const CONTEXT_DEFAULT_PALETTES = {
  heist: {
    skin: '#e8aa7e',
    hair: '#382419',
    primary: '#443d3b',
    secondary: '#2f6da8',
    accent: '#e09d38',
    metal: '#8d96a0',
    trim: '#e4ddd2',
    leather: '#6d4429',
    visor: '#3ec2ec',
    detail: '#c83e32',
  },
  industrial: {
    skin: '#e4a278',
    hair: '#4d2c1e',
    primary: '#667844',
    secondary: '#627c92',
    accent: '#3e6bb2',
    metal: '#96a0aa',
    trim: '#c8b18a',
    leather: '#5c3c27',
    visor: '#52c4e2',
    detail: '#b83228',
  },
  security: {
    skin: '#de9a6d',
    hair: '#24252a',
    primary: '#2d728a',
    secondary: '#5c4730',
    accent: '#e4b33c',
    metal: '#86909a',
    trim: '#d6dce2',
    leather: '#43372f',
    visor: '#34cef0',
    detail: '#ba342d',
  },
  creatures: {
    skin: '#5c554c',
    hair: '#292623',
    primary: '#786e61',
    secondary: '#403b36',
    accent: '#e8432d',
    metal: '#8e969e',
    trim: '#9a8e7a',
    leather: '#43342a',
    visor: '#ff5238',
    detail: '#6b3e2e',
  },
} as const satisfies Record<'heist' | 'industrial' | 'security' | 'creatures', Required<PaletteColors>>
