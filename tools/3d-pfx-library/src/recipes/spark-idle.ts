import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spark-idle', 'Spark idle', 'Crisp contact fizz with small spark ticks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'spark-idle-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#ffb300', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'spark-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffb300', flicker: 1.4 } },
], 2, 0.81)
