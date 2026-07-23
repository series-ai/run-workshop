import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-idle', 'Poison idle', 'Toxic idle cloud with spores and hazard pulse.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'poison-idle-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#3fe800', ramp: 'held', countScale: 0.3, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'poison-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#3fe800', flicker: 1.4 } },
], 2, 1.15)
