import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ice-loop', 'Ice loop', 'Cold sustained shard field with crisp glints and frost mist.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'ice-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#009dff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'ice-loop-element-traffic', tuning: { sprite: 'twirl', size: [0.5, 0.6, 0.35], colorOverride: '#009dff', ramp: 'held', countScale: 0.45, speedScale: 0.15, speedJitter: 0.15, turbulenceScale: 0, motion: 'drift-cloud', gravity: 0.1, blend: 'alpha', spinScale: 0.85, flicker: 0.3 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'ice-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#009dff' } },
], 2, 0.45)
