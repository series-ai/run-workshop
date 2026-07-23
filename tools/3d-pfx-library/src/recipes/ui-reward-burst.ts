import { authoredRecipe } from '../constants/01'

// Celebration cascade (spec: flash -> hero gem -> confetti, staggered —
// never simultaneous): gold flash pop, gem bloom, then confetti rain.
export default authoredRecipe('ui-reward-burst', 'Screen reward burst', 'UI celebration cascade: gold flash, gem bloom, staggered confetti.', [
  { kind: 'core-sphere', role: 'screen', opacity: 0.95, scale: 0.72, phase: 'ui-reward-cascade-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffcf4d' } },
  { kind: 'reward-gem', role: 'screen', opacity: 0.96, scale: 1.38, phase: 'reward-hero-gem', tuning: { meshMotion: 'bloom', colorOverride: '#ffcf4d' } },
  { kind: 'particles', role: 'screen', opacity: 0.94, scale: 1.2, phase: 'confetti-sparkle', tuning: { motion: 'radial-burst', sprite: 'sparkle', blend: 'alpha', colorOverride: '#ffd05a', delay: 0, window: 0.04, countScale: 0.82, speedScale: 8.5, spawnScale: 0.05, drag: 0.4, gravity: -1.8, spinScale: 1.25, turbulenceScale: 0.3, size: [0.3, 0.46, 0.18], ramp: 'pigment', lifeScale: 0.58, death: 'erode', ease: 'snap' } },
], 2, 1.2)
