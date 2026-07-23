import { authoredRecipe } from '../constants/01'

export default authoredRecipe('bubble-loop', 'Bubble loop', 'Lightweight bubble column for underwater ambience and vents.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'bubble-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#00a8f0' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'bubble-loop-element-traffic', tuning: { sprite: 'bubble', size: [0.35, 0.55, 0.75], colorOverride: '#00a8f0', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'bubble-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00a8f0' } },
], 2, 0.95)
