import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reward-idle', 'Reward idle', 'Prize idle with glow pulse and celebratory flecks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'reward-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#ffb300', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'reward-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffb300' } },
], 2, 0.68)
