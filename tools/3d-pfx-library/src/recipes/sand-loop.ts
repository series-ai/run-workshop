import { authoredRecipe } from '../constants/01'

export default authoredRecipe('sand-loop', 'Sand loop', 'Dry ground ambience with granular particles and low sand haze.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'sand-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#c2913f' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'sand-loop-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#c2913f', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', gravity: 0.1, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'sand-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#c2913f' } },
], 2, 0.95)
