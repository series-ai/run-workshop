import { authoredRecipe } from '../constants/01'

export default authoredRecipe('acid-loop', 'Acid loop', 'Corrosive pool loop with bubbling surface and restrained vapor.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.45, scale: 0.55, phase: 'acid-loop-body-cling', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#00e800' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'acid-loop-element-traffic', tuning: { sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#00e800', ramp: 'pigment', countScale: 0.45, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'acid-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00e800', flicker: 1.4 } },
], 2, 1.35)
