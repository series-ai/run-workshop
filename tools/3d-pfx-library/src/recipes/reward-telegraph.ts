import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reward-telegraph', 'Reward telegraph', 'UI-safe anticipation marker before a reward burst.', [
  { kind: 'ring-field', role: 'screen', opacity: 0.98, scale: 1.45, phase: 'reward-telegraph-warning-ring', tuning: { meshMotion: 'countdown', lifecycle: 'reward-telegraph-beacon', ringPurpose: 'boundary', colorOverride: '#ffbd24' } },
  { kind: 'reward-gem', role: 'screen', opacity: 0.98, scale: 1.05, phase: 'reward-telegraph-prize-beacon', tuning: { meshMotion: 'countdown', lifecycle: 'reward-telegraph-beacon', colorOverride: '#ffd34f', positionOffset: [0, 0, 0] } },
  { kind: 'particles', role: 'screen', opacity: 0.94, scale: 1.3, phase: 'reward-telegraph-perimeter-motes', tuning: { motion: 'orbit-ring', sprite: 'sparkle', blend: 'additive', colorOverride: '#ffe079', ramp: 'pigment', delay: 0.02, window: 0.78, lifeScale: 0.92, countScale: 1.1, speedScale: 0.68, speedJitter: 0.12, spawnScale: 1.8, depthScale: 0.18, turbulenceScale: 0.08, gravity: 0, spinScale: 0, size: [0.28, 0.44, 0.2] } },
], 2, 1.2)
