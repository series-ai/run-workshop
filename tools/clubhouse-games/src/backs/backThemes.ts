// Engraved-style back patterns. Each is a fine-line field drawn under the
// central medallion, in the manner of banknote guilloche work.
export type BackPattern = 'guilloche' | 'rosette' | 'lattice'

export interface BackTheme {
  id: string
  // Colored panel fill, inset inside the ivory card margin.
  base: string
  pattern: BackPattern
  // Fine engraving line color.
  patternColor: string
  // Keyline and medallion outline color.
  borderColor: string
  // Medallion fill and fleuron color.
  accent: string
}

export const BACK_PRESETS: readonly BackTheme[] = [
  {
    id: 'classic-crimson',
    base: '#9a1b2b',
    pattern: 'guilloche',
    patternColor: '#5d0a15',
    borderColor: '#f2e4c4',
    accent: '#d8b271',
  },
  {
    id: 'midnight-navy',
    base: '#152a55',
    pattern: 'rosette',
    patternColor: '#0a1631',
    borderColor: '#e2ecfb',
    accent: '#9fb9e6',
  },
  {
    id: 'emerald-stripes',
    base: '#0f5b3c',
    pattern: 'lattice',
    patternColor: '#073825',
    borderColor: '#eef5df',
    accent: '#cbb87a',
  },
  {
    id: 'obsidian-gold',
    base: '#1b1b1f',
    pattern: 'rosette',
    patternColor: '#000000',
    borderColor: '#e6c877',
    accent: '#c9a34e',
  },
  {
    id: 'burgundy-ivory',
    base: '#5d1230',
    pattern: 'guilloche',
    patternColor: '#33051a',
    borderColor: '#f6efe0',
    accent: '#e0c9a6',
  },
]

export function getBackPreset(id: string): BackTheme | undefined {
  return BACK_PRESETS.find((p) => p.id === id)
}
