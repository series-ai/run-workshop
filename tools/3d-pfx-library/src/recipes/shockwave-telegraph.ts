import { authoredRecipe } from '../constants/01'

// Wave warning: repeating expanding rings at a readable cadence — the
// rhythm says "this area, soon", never a single pop.
export default authoredRecipe('shockwave-telegraph', 'Shockwave telegraph', 'Incoming-wave warning: cadenced expanding rings.', [
  { kind: 'shockwave-ring', role: 'aura', opacity: 0.75, scale: 1, phase: 'shockwave-telegraph-radius-warning', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorIndex: 0 } },
  {
    kind: 'particles',
    role: 'aura',
    opacity: 0.5,
    scale: 0.5,
    phase: 'shockwave-telegraph-dust-points',
    tuning: { sprite: 'puff', blend: 'alpha', countScale: 0.14, speedScale: 0.4, size: [0.4, 0.55, 0.4], ramp: 'held', turbulenceScale: 0.2 },
  },
], 2, 0.8)
