import { authoredRecipe } from '../constants/01'

export default authoredRecipe('slime-loop', 'Slime loop', 'Sticky hazard loop with a readable pooled body and slow bubbling motes.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.45, scale: 0.55, phase: 'slime-loop-body-cling', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#00d926' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'slime-loop-element-traffic', tuning: { sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#00d926', ramp: 'pigment', countScale: 0.45, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'slime-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00d926' } },
], 2, 1.35)
