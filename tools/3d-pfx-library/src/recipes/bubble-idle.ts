import { authoredRecipe } from '../constants/01'

export default authoredRecipe('bubble-idle', 'Bubble idle', 'Bubble idle with buoyant orbs and soft pop ticks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'bubble-idle-element-traffic', tuning: { sprite: 'bubble', size: [0.35, 0.55, 0.75], colorOverride: '#00a8f0', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'bubble-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00a8f0' } },
], 2, 0.81)
