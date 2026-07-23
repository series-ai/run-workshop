import { authoredRecipe } from '../constants/01'

export default authoredRecipe('embers-charge', 'Embers charge', 'Ember charge with cinders gathering into a hot center.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'embers-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#ff8a2f', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.4 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'embers-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#ff6a2f', flicker: 1.4 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'embers-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#ff8a2f' } },
], 2, 1.1)
