import { authoredRecipe } from '../constants/01'

export default authoredRecipe('meteor-charge', 'Meteor charge', 'Meteor charge with molten gather and pressure tremor.', [
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'meteor-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'fire', colorOverride: '#ff5a1f', ramp: 'held', spawnScale: 2.6, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.5 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'meteor-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#ff4800', flicker: 1.5 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.7, scale: 0.6, phase: 'meteor-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#e0481f' } },
], 2, 0.65)
