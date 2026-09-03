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
  'herringbone',
  'pinhead',
  'crosshatch',
  'vine',
  'brick',
] as const
export type BackPattern = (typeof BACK_PATTERNS)[number]

// How much ivory shows around the printed panel.
export const BACK_LAYOUTS = ['centered', 'fullbleed', 'bordered', 'cartouche'] as const
export type BackLayout = (typeof BACK_LAYOUTS)[number]

// Border treatment just inside the panel edge.
export const BACK_FRAMES = ['keyline', 'rope', 'meander', 'notched'] as const
export type BackFrame = (typeof BACK_FRAMES)[number]

// Ornament in each of the four panel corners.
export const BACK_CORNERS = ['rosette', 'fleur', 'bracket', 'none'] as const
export type BackCorner = (typeof BACK_CORNERS)[number]

// Outline of the central seal.
export const BACK_SEALS = ['circle', 'oval', 'lozenge'] as const
export type BackSeal = (typeof BACK_SEALS)[number]

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
  // Shape of that seal. Defaults to 'circle'.
  seal?: BackSeal
  // Ivory margin. Defaults to 'centered'.
  layout?: BackLayout
  // Border treatment. Defaults to 'keyline'.
  frame?: BackFrame
  // Corner ornament. Defaults to 'rosette'.
  corner?: BackCorner
}

export const BACK_PRESETS: readonly BackTheme[] = [
  {
    id: 'classic-crimson',
    base: '#9a1b2b', pattern: 'waves', patternColor: '#5d0a15',
    borderColor: '#f2e4c4', accent: '#d8b271',
  },
  {
    id: 'midnight-navy',
    base: '#152a55', pattern: 'rules', patternColor: '#0a1631',
    borderColor: '#e2ecfb', accent: '#9fb9e6',
    ornament: 'rosette', frame: 'rope',
  },
  {
    id: 'emerald-lattice',
    base: '#0f5b3c', pattern: 'lattice', patternColor: '#073825',
    borderColor: '#eef5df', accent: '#cbb87a',
    corner: 'fleur',
  },
  {
    id: 'obsidian-gold',
    base: '#1b1b1f', pattern: 'ogee', patternColor: '#000000',
    borderColor: '#e6c877', accent: '#c9a34e',
    ornament: 'rosette', frame: 'meander', corner: 'fleur',
  },
  {
    id: 'burgundy-ivory',
    base: '#5d1230', pattern: 'waves', patternColor: '#33051a',
    borderColor: '#f6efe0', accent: '#e0c9a6',
    layout: 'cartouche', seal: 'oval',
  },
  {
    id: 'royal-plum',
    base: '#3d1a56', pattern: 'scales', patternColor: '#230d33',
    borderColor: '#efe3f7', accent: '#c9a9e0',
    seal: 'lozenge', corner: 'bracket',
  },
  {
    id: 'oxblood-scales',
    base: '#6b1616', pattern: 'scales', patternColor: '#3d0808',
    borderColor: '#f4e2cf', accent: '#d99a5c',
    ornament: 'rosette', layout: 'bordered',
  },
  {
    id: 'teal-weave',
    base: '#0d4f52', pattern: 'weave', patternColor: '#052e30',
    borderColor: '#ddf1ef', accent: '#8fd0c9',
    ornament: 'none', frame: 'notched', corner: 'bracket',
  },
  {
    id: 'slate-chevron',
    base: '#2b3440', pattern: 'chevron', patternColor: '#161d26',
    borderColor: '#e3e9f0', accent: '#a8b8cc',
    ornament: 'star', medallion: false, frame: 'notched',
  },
  {
    id: 'copper-argyle',
    base: '#7a3a18', pattern: 'argyle', patternColor: '#4a1f08',
    borderColor: '#f7e8d2', accent: '#e5a55f',
    ornament: 'rosette', corner: 'none',
  },
  {
    id: 'ivory-gold',
    base: '#eee5cd', pattern: 'honeycomb', patternColor: '#8f7538',
    borderColor: '#6b5324', accent: '#9c7c33',
    frame: 'meander',
  },
  {
    id: 'forest-honeycomb',
    base: '#14402a', pattern: 'honeycomb', patternColor: '#082418',
    borderColor: '#e6f0dc', accent: '#a8c98a',
    medallion: false, corner: 'fleur',
  },
  {
    id: 'sapphire-starburst',
    base: '#14306e', pattern: 'starburst', patternColor: '#081a44',
    borderColor: '#e6eeff', accent: '#e0c46a',
    ornament: 'star', frame: 'rope',
  },
  {
    id: 'rose-spiral',
    base: '#8d2f4a', pattern: 'spiral', patternColor: '#54142a',
    borderColor: '#fbe9ee', accent: '#f0bfa8',
    layout: 'bordered', corner: 'none',
  },
  {
    id: 'graphite-moire',
    base: '#26262c', pattern: 'moire', patternColor: '#101014',
    borderColor: '#dcdce4', accent: '#8f96a8',
    ornament: 'rosette', seal: 'oval',
  },
  {
    id: 'wine-ogee',
    base: '#4a1026', pattern: 'ogee', patternColor: '#2a0614',
    borderColor: '#f4e0e8', accent: '#d4a05c',
    layout: 'cartouche',
  },
  {
    id: 'ink-herringbone',
    base: '#1c2740', pattern: 'herringbone', patternColor: '#0c1424',
    borderColor: '#dde5f2', accent: '#8ba2c9',
    frame: 'notched', corner: 'bracket',
  },
  {
    id: 'sand-pinhead',
    base: '#d9c9a3', pattern: 'pinhead', patternColor: '#7a6434',
    borderColor: '#5b4820', accent: '#8a6d2c',
    ornament: 'rosette', layout: 'bordered',
  },
  {
    id: 'jet-crosshatch',
    base: '#141418', pattern: 'crosshatch', patternColor: '#050507',
    borderColor: '#cfd2da', accent: '#7e838f',
    seal: 'lozenge', frame: 'rope',
  },
  {
    id: 'moss-vine',
    base: '#2f4a22', pattern: 'vine', patternColor: '#182a10',
    borderColor: '#eaf2df', accent: '#bcd68f',
    corner: 'fleur', layout: 'cartouche',
  },
  {
    id: 'brick-red',
    base: '#8a2f22', pattern: 'brick', patternColor: '#521508',
    borderColor: '#f6e3d5', accent: '#e0a878',
    ornament: 'none', frame: 'notched',
  },
  {
    id: 'porcelain-blue',
    base: '#e8ecf4', pattern: 'vine', patternColor: '#3a5f9e',
    borderColor: '#274579', accent: '#3a5f9e',
    frame: 'rope', seal: 'oval',
  },
  {
    id: 'noir-fullbleed',
    base: '#101014', pattern: 'starburst', patternColor: '#000000',
    borderColor: '#c9a34e', accent: '#c9a34e',
    layout: 'fullbleed', ornament: 'star', corner: 'none',
  },
  {
    id: 'imperial-jade',
    base: '#0b6156', pattern: 'ogee', patternColor: '#04352e',
    borderColor: '#e2f5ef', accent: '#e6c877',
    layout: 'fullbleed', frame: 'meander', corner: 'fleur',
  },
  {
    id: 'amethyst-moire',
    base: '#3a2a63', pattern: 'moire', patternColor: '#1d1436',
    borderColor: '#ece4fb', accent: '#b9a3e8',
    medallion: false, ornament: 'rosette',
  },
  {
    id: 'ochre-lattice',
    base: '#a06a12', pattern: 'lattice', patternColor: '#5e3c06',
    borderColor: '#fbeeca', accent: '#f2cf7a',
    seal: 'lozenge', corner: 'bracket',
  },
  {
    id: 'steel-weave',
    base: '#3c4550', pattern: 'weave', patternColor: '#222932',
    borderColor: '#e8edf3', accent: '#b6c3d1',
    layout: 'cartouche', ornament: 'none',
  },
  {
    id: 'claret-pinhead',
    base: '#6d1030', pattern: 'pinhead', patternColor: '#3d0518',
    borderColor: '#f8e4ec', accent: '#dba7b8',
    frame: 'meander', seal: 'oval',
  },
]

export function getBackPreset(id: string): BackTheme | undefined {
  return BACK_PRESETS.find((p) => p.id === id)
}
