import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shadow-loop', 'Shadow loop', 'Dark sustained aura with umbra haze and low contrast motes.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.45, scale: 0.55, phase: 'shadow-loop-body-cling', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#6a26e8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'shadow-loop-element-traffic', tuning: { sprite: 'twirl', size: [0.5, 0.6, 0.35], colorOverride: '#6a26e8', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'shadow-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#6a26e8', flicker: 1.4 } },
], 2, 1.35)
