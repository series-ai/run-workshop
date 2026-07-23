import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shard-telegraph', 'Shard telegraph', 'Shard warning telegraph with fragment warning and crack ring.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'shard-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#009dff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'shard-telegraph-warning-fill', tuning: { colorOverride: '#29a8f0' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'shard-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'twirl', colorOverride: '#29a8f0', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -1.2, spinScale: 1.0, blend: 'alpha' } },
], 2, 1.0)
