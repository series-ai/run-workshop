// All-over ground texture printed under the central ornament.
export const BACK_PATTERNS = [
  'waves',
  'lattice',
  'rules',
  'scales',
  'weave',
  'chevron',
  'argyle',
  'honeycomb',
  'starburst',
  'spiral',
  'ogee',
  'moire',
] as const
export type BackPattern = (typeof BACK_PATTERNS)[number]

// The motif over the middle of the panel.
export const BACK_ORNAMENTS = ['band', 'rosette', 'star', 'none'] as const
export type BackOrnament = (typeof BACK_ORNAMENTS)[number]

export interface BackTheme {
  id: string
  // Colored panel fill, inset inside the ivory card margin.
  base: string
  pattern: BackPattern
  // Fine engraving line color.
  patternColor: string
  // Keyline color.
  borderColor: string
  // Ornament, medallion ring, and fleuron color.
  accent: string
  // Central motif. Defaults to 'band'.
  ornament?: BackOrnament
  // Central seal. Defaults to true.
  medallion?: boolean
}

export const BACK_PRESETS: readonly BackTheme[] = [
  {
    id: 'classic-crimson',
    base: '#9a1b2b',
    pattern: 'waves',
    patternColor: '#5d0a15',
    borderColor: '#f2e4c4',
    accent: '#d8b271',
  },
  {
    id: 'midnight-navy',
    base: '#152a55',
    pattern: 'rules',
    patternColor: '#0a1631',
    borderColor: '#e2ecfb',
    accent: '#9fb9e6',
    ornament: 'rosette',
  },
  {
    id: 'emerald-lattice',
    base: '#0f5b3c',
    pattern: 'lattice',
    patternColor: '#073825',
    borderColor: '#eef5df',
    accent: '#cbb87a',
  },
  {
    id: 'obsidian-gold',
    base: '#1b1b1f',
    pattern: 'ogee',
    patternColor: '#000000',
    borderColor: '#e6c877',
    accent: '#c9a34e',
    ornament: 'rosette',
  },
  {
    id: 'burgundy-ivory',
    base: '#5d1230',
    pattern: 'waves',
    patternColor: '#33051a',
    borderColor: '#f6efe0',
    accent: '#e0c9a6',
  },
  {
    id: 'royal-plum',
    base: '#3d1a56',
    pattern: 'scales',
    patternColor: '#230d33',
    borderColor: '#efe3f7',
    accent: '#c9a9e0',
  },
  {
    id: 'oxblood-scales',
    base: '#6b1616',
    pattern: 'scales',
    patternColor: '#3d0808',
    borderColor: '#f4e2cf',
    accent: '#d99a5c',
    ornament: 'rosette',
  },
  {
    id: 'teal-weave',
    base: '#0d4f52',
    pattern: 'weave',
    patternColor: '#052e30',
    borderColor: '#ddf1ef',
    accent: '#8fd0c9',
    ornament: 'none',
  },
  {
    id: 'slate-chevron',
    base: '#2b3440',
    pattern: 'chevron',
    patternColor: '#161d26',
    borderColor: '#e3e9f0',
    accent: '#a8b8cc',
    ornament: 'star',
    medallion: false,
  },
  {
    id: 'copper-argyle',
    base: '#7a3a18',
    pattern: 'argyle',
    patternColor: '#4a1f08',
    borderColor: '#f7e8d2',
    accent: '#e5a55f',
    ornament: 'rosette',
  },
  {
    id: 'ivory-gold',
    base: '#eee5cd',
    pattern: 'honeycomb',
    patternColor: '#8f7538',
    borderColor: '#6b5324',
    accent: '#9c7c33',
  },
  {
    id: 'forest-honeycomb',
    base: '#14402a',
    pattern: 'honeycomb',
    patternColor: '#082418',
    borderColor: '#e6f0dc',
    accent: '#a8c98a',
    medallion: false,
  },
  {
    id: 'sapphire-starburst',
    base: '#14306e',
    pattern: 'starburst',
    patternColor: '#081a44',
    borderColor: '#e6eeff',
    accent: '#e0c46a',
    ornament: 'star',
  },
  {
    id: 'rose-spiral',
    base: '#8d2f4a',
    pattern: 'spiral',
    patternColor: '#54142a',
    borderColor: '#fbe9ee',
    accent: '#f0bfa8',
  },
  {
    id: 'graphite-moire',
    base: '#26262c',
    pattern: 'moire',
    patternColor: '#101014',
    borderColor: '#dcdce4',
    accent: '#8f96a8',
    ornament: 'rosette',
  },
  {
    id: 'wine-ogee',
    base: '#4a1026',
    pattern: 'ogee',
    patternColor: '#2a0614',
    borderColor: '#f4e0e8',
    accent: '#d4a05c',
  },
]

export function getBackPreset(id: string): BackTheme | undefined {
  return BACK_PRESETS.find((p) => p.id === id)
}
