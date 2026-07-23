import { authoredRecipe } from '../constants/01'

export default authoredRecipe('charge-telegraph', 'Charge warning ring', 'Timing-readable loop that builds threat without heavy overdraw.', [
  { kind: 'ring-field', role: 'aura', opacity: 1, scale: 1.1, phase: 'charge-telegraph-warning-ring', tuning: { ringPurpose: 'reticle', colorOverride: '#ff6a1f' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.52, scale: 1, phase: 'charge-telegraph-warning-fill', tuning: { meshMotion: 'countdown', colorOverride: '#ff3d1f' } },
  { kind: 'particles', role: 'aura', opacity: 0.95, scale: 0.88, phase: 'charge-telegraph-ground-urgency', tuning: { motion: 'converge-center', sprite: 'glow', blend: 'additive', colorOverride: '#ffb62f', ramp: 'pinned-hot', delay: 0, window: 0.82, lifeScale: 0.8, countScale: 1.5, speedScale: 2.2, speedJitter: 0.25, spawnScale: 2, turbulenceScale: 0.1, gravity: 0, size: [0.45, 0.7, 0.3], stretch: 1.2, spinScale: 0 } },
], 2, 1.6)
