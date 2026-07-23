import { authoredRecipe } from '../constants/01'

export default authoredRecipe('blood-loop', 'Blood loop', 'Persistent danger loop with controlled droplets and a grounded mark.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.45, scale: 0.55, phase: 'blood-loop-body-cling', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#a80d18' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'blood-loop-element-traffic', tuning: { sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#a80d18', ramp: 'pigment', countScale: 0.45, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'blood-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#a80d18' } },
], 2, 1.35)
