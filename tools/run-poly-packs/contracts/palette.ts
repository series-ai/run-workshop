import { z } from 'zod'

/**
 * 6-region UV palette encoding used by both Blender (`polykit.py`) and
 * Three.js (`polyMaterial.ts`):
 *   u in [0..1] selects the semantic material region (6 horizontal bands)
 *   v in [0..1] supplies a baked shading/AO ramp (0.15 dark underside -> 0.85 bright highlight)
 */
export const PALETTE_REGIONS = ['skin', 'hair', 'primary', 'secondary', 'accent', 'metal'] as const
export type PaletteRegion = (typeof PALETTE_REGIONS)[number]

export const PALETTE_REGION_U: Readonly<Record<PaletteRegion, number>> = {
  skin: 0.08,
  hair: 0.24,
  primary: 0.41,
  secondary: 0.58,
  accent: 0.74,
  metal: 0.91,
}

export const paletteColorsSchema = z.object({
  skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hair: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  metal: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})
export type PaletteColors = z.infer<typeof paletteColorsSchema>

export const SKIN_PRESETS = [
  { name: 'Porcelain', hex: '#ecc8aa' },
  { name: 'Warm Sand', hex: '#d8a67e' },
  { name: 'Olive Tan', hex: '#bc8358' },
  { name: 'Amber', hex: '#945d3b' },
  { name: 'Deep Espresso', hex: '#5c3825' },
  { name: 'Sage Goblin', hex: '#7c9665' },
] as const

export const HAIR_PRESETS = [
  { name: 'Chestnut', hex: '#4a2e1f' },
  { name: 'Raven', hex: '#25262b' },
  { name: 'Wheat Blonde', hex: '#cfa563' },
  { name: 'Copper', hex: '#a84f2b' },
  { name: 'Silver', hex: '#b8bec7' },
  { name: 'Indigo', hex: '#384b7a' },
] as const

export const CONTEXT_DEFAULT_PALETTES = {
  medieval: {
    skin: '#d8a67e',
    hair: '#4a2e1f',
    primary: '#9e332d',
    secondary: '#593e29',
    accent: '#d49d3b',
    metal: '#8a94a0',
  },
  ww2: {
    skin: '#d8a67e',
    hair: '#25262b',
    primary: '#566045',
    secondary: '#8a7c5a',
    accent: '#b8503c',
    metal: '#454c52',
  },
  sim: {
    skin: '#bc8358',
    hair: '#25262b',
    primary: '#35668c',
    secondary: '#9c8b70',
    accent: '#db6e48',
    metal: '#a2aab4',
  },
} as const satisfies Record<'medieval' | 'ww2' | 'sim', PaletteColors>
