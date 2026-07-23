import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-loop', 'Curse loop', 'Sustained curse field with vertical hex read and falling dark motes.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.45, scale: 0.55, phase: 'curse-loop-body-cling', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#9d2bff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'curse-loop-element-traffic', tuning: { sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#9d2bff', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'curse-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#9d2bff', flicker: 1.4 } },
], 2, 1.35)
