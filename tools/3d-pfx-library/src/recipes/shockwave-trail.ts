import { authoredRecipe } from '../constants/01'

// Force ripple wake: pressure echoes rippling out along a moving path —
// ribbon carries the ripple, one echo ring, sparse dust. Dieted hard.
// Redesigned (review): an air-compression wake — the crossed pressure
// ribbon carries the body and growing pressure pulses swell along it.
// The floor-dust layer was cut: the wake travels at body height and a
// grounded layer 0.9 below read as stranded (system-cohesion rule).
export default authoredRecipe('shockwave-trail', 'Shockwave trail', 'Traveling force wake: rippling pressure echoes along the path.', [
  { kind: 'tapered-trail', role: 'trail', opacity: 0.9, scale: 0.8, phase: 'shockwave-trail-pressure-body', tuning: { meshShader: 'trail-flow', colorOverride: '#dfe9f5' } },
  { kind: 'particles', role: 'trail', opacity: 0.85, scale: 0.62, phase: 'shockwave-trail-pressure-pulses', tuning: { motion: 'trail-stream', sprite: 'soft', blend: 'alpha', colorOverride: '#bccfdf', ramp: 'held', death: 'erode', countScale: 0.3, lifeScale: 0.7, speedScale: 6, speedJitter: 0.3, streamSpread: 0.05, spawnOffset: [-0.15, 0, 0], size: [0.35, 0.7, 0.85], spinScale: 0, turbulenceScale: 0, gravity: 0 } },
], 2, 1.4)
