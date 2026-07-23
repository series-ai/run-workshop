import { authoredRecipe } from '../constants/01'

// A WARNING, not an explosion: the point is sustained readable danger —
// a pulsing boundary with slow rising motes and a held haze. Slow by
// design; a telegraph that pops is a failed telegraph.
export default authoredRecipe('blast-telegraph', 'Blast telegraph', 'Incoming-detonation warning: pulsing boundary, rising motes, held haze.', [
  { kind: 'shockwave-ring', role: 'aura', opacity: 0.8, scale: 1.1, phase: 'blast-telegraph-pressure-warning', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorIndex: 0 } },
  {
    kind: 'particles',
    role: 'aura',
    opacity: 0.7,
    scale: 0.8,
    phase: 'blast-telegraph-debris-wake',
    tuning: { motion: 'column-rise', sprite: 'glow', countScale: 0.2, speedScale: 0.5, size: [0.32, 0.45, 0.18], ramp: 'held', turbulenceScale: 0 },
  },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.7, phase: 'blast-telegraph-smoke-core', tuning: { meshMotion: 'pulse', blend: 'alpha' } },
], 2, 0.8)
