import { authoredRecipe } from '../constants/01'

export default authoredRecipe('despawn-idle', 'Despawn idle', 'Despawn idle with fade dust and exit ring.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'despawn-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#5fb0e8', ramp: 'held', countScale: 0.3, speedScale: 0.8, speedJitter: 0.15, turbulenceScale: 0, motion: 'screen-fall', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'despawn-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#5fb0e8' } },
], 2, 0.68)
