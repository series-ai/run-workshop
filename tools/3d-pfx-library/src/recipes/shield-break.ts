import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shield-break', 'Shield shatter', 'Defense failure feedback with a broken shell and outward shards.', [
  // Death state: intact shell → cell-by-cell shatter dissolve → gone,
  // synced to the burst cycle so shards fly as the shell disappears.
  { kind: 'shield-shell', role: 'aura', opacity: 0.7, scale: 1.2, phase: 'broken-shell', tuning: { meshShader: 'hex-shell', meshMotion: 'break', positionOffset: [0, -0.2, 0] } },
  {
    kind: 'shield-fragments',
    role: 'impact',
    opacity: 0.94,
    scale: 1.05,
    phase: 'glass-shards',
    // One closed, faceted radial mesh: true depth and varied crystal
    // silhouettes in one draw call instead of camera-facing pill sprites.
    tuning: { meshMotion: 'flash', lifecycle: 'impact-shard-burst', delay: 0.02, window: 0.68, startScale: 0.22, colorOverride: '#bfefff' },
  },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.95, scale: 1.1, phase: 'failure-wave', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.3)
