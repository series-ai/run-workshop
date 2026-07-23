import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shard-loop', 'Shard loop', 'Looping crystal/glass fragments for hazards and charged objects.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'shard-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#29a8f0' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'shard-loop-element-traffic', tuning: { sprite: 'twirl', size: [0.5, 0.6, 0.35], colorOverride: '#29a8f0', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', gravity: 0.1, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'shard-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#29a8f0' } },
], 2, 0.95)
