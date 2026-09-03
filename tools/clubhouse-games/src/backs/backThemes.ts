export type BackPattern = 'lattice' | 'stripes' | 'dots'

export interface BackTheme {
  id: string
  // Card body fill.
  base: string
  pattern: BackPattern
  // Pattern stroke/fill color.
  patternColor: string
  // Double border inset color.
  borderColor: string
}

export const BACK_PRESETS: readonly BackTheme[] = [
  { id: 'classic-crimson', base: '#9d1220', pattern: 'lattice', patternColor: '#6d0a15', borderColor: '#f0e6d2' },
  { id: 'midnight-navy', base: '#14264d', pattern: 'dots', patternColor: '#0b1730', borderColor: '#d7e3f4' },
  { id: 'emerald-stripes', base: '#0e5b3a', pattern: 'stripes', patternColor: '#093d27', borderColor: '#e8f2d8' },
]

export function getBackPreset(id: string): BackTheme | undefined {
  return BACK_PRESETS.find((p) => p.id === id)
}
