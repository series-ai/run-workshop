import { authoredRecipe } from '../constants/01'

// Grounded movement reward: a shaded spring cradle compresses, a real
// depth-spread stream launches upward, and the reward apex lifts to collect.
export default authoredRecipe('jump-pickup', 'Jump pickup', 'Movement pickup: grounded launch cradle, rising collection stream, and reward apex.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.98, scale: 0.98, phase: 'jump-pickup-launch-cradle', tuning: { meshGeometry: 'jump-pickup-launch-cradle', meshMotion: 'pickup', lifecycle: 'jump-pickup-launch', ringPurpose: 'glyph', colorOverride: '#ffb515' } },
  { kind: 'particles', role: 'volume', opacity: 1, scale: 1.08, phase: 'jump-pickup-rising-collection-stream', tuning: { motion: 'jump-launch', sprite: 'sparkle', blend: 'additive', lifecycle: 'jump-pickup-launch', colorOverride: '#fff0a6', ramp: 'pinned-hot', death: 'erode', delay: 0.02, window: 0.54, lifeScale: 0.72, countScale: 1.55, speedScale: 1.68, speedJitter: 0.2, spawnScale: 1.2, spawnLift: 0.06, depthScale: 2.5, spinScale: 0.16, turbulenceScale: 0.07, gravity: 0.42, size: [0.36, 0.62, 0.2], positionOffset: [0, 0.08, 0] } },
  { kind: 'ring-field', role: 'impact', opacity: 1, scale: 0.48, phase: 'jump-pickup-reward-apex', tuning: { meshGeometry: 'jump-pickup-reward-gem', meshMotion: 'pickup', lifecycle: 'jump-pickup-launch', ringPurpose: 'glyph', blend: 'additive', colorOverride: '#ffd43b', positionOffset: [0, 0.18, 0] } },
], 2, 1.35)
