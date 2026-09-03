import { parseDieStyle, type DieStyle } from './kinds'

export const DIE_COLORWAYS = ['ivory', 'obsidian', 'ruby', 'emerald', 'sapphire', 'gold'] as const
export type DieColorway = (typeof DIE_COLORWAYS)[number]

export interface DiePalette {
  face: string
  pip: string
  accent: string
  edge: string
}

export const DIE_PALETTES: Record<DieColorway, DiePalette> = {
  ivory: { face: '#f0ead8', pip: '#1c1c22', accent: '#c4a35a', edge: '#e8e0cc' },
  obsidian: { face: '#1a1a22', pip: '#e8d48b', accent: '#c4a35a', edge: '#0e0e14' },
  ruby: { face: '#6b1020', pip: '#f5e6c8', accent: '#e8c36a', edge: '#4a0c16' },
  emerald: { face: '#0e3d2c', pip: '#e8f0e4', accent: '#d4b46a', edge: '#0a2a1e' },
  sapphire: { face: '#102a5c', pip: '#e8eef8', accent: '#d4b46a', edge: '#0a1c40' },
  gold: { face: '#c4a35a', pip: '#1c1408', accent: '#f0d060', edge: '#8a7038' },
}

export function parseDieColorway(s: string): DieColorway {
  if (!(DIE_COLORWAYS as readonly string[]).includes(s)) {
    throw new Error(`Unknown die colorway: ${JSON.stringify(s)}`)
  }
  return s as DieColorway
}

export function paletteFor(colorway: DieColorway, style: DieStyle = 'pip'): DiePalette {
  parseDieStyle(style)
  return DIE_PALETTES[colorway]
}
