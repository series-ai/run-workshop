import { authoredRecipe } from '../constants/01'

export default authoredRecipe('electric-idle', 'Electric idle', 'Electric idle with arc ticks and voltage halo.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'electric-idle-element-traffic', tuning: { sprite: 'arc', size: [0.6, 0.5, 0.2], colorOverride: '#009dff', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'electric-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#009dff', flicker: 1.4 } },
], 2, 0.81)
