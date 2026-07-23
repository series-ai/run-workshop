import { authoredRecipe } from '../constants/01'

export default authoredRecipe('loot-beam', 'Reward locator beam', 'Vertical pickup locator with celebratory particles.', [
  // Batch-01 Octopo pass: the gem is the focal element — the column drops
  // to a supporting value instead of competing at full brightness.
  { kind: 'beam-column', role: 'body', opacity: 0.75, scale: 0.85, phase: 'locator-column', tuning: { widthScale: 3, meshShader: 'water-flow', colorOverride: '#ffcf4d', positionOffset: [0, 0.22, 0] } },
  { kind: 'reward-gem', role: 'body', opacity: 0.92, scale: 0.62, phase: 'ground-loot-anchor-gem', tuning: { meshMotion: 'pulse', colorOverride: '#ffcf4d', positionOffset: [0, 0.35, 0] } },
  { kind: 'ring-field', role: 'aura', opacity: 0.72, scale: 0.62, phase: 'ground-loot-locator-reticle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffcf4d' } },
], 2, 0.8)
