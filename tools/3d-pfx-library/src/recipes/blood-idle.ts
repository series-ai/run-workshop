import { authoredRecipe } from '../constants/01'

export default authoredRecipe('blood-idle', 'Blood idle', 'Organic idle with pulse mist and droplet beats.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'blood-idle-element-traffic', tuning: { sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#a80d18', ramp: 'pigment', countScale: 0.3, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'blood-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#a80d18' } },
], 2, 1.15)
