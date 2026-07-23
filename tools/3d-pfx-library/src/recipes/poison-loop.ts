import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-loop', 'Poison loop', 'Persistent toxic loop with vapor volume and hazard boundary readability.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.45, scale: 0.55, phase: 'poison-loop-body-cling', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#3fe800' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'poison-loop-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#3fe800', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'poison-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#3fe800', flicker: 1.4 } },
], 2, 1.35)
