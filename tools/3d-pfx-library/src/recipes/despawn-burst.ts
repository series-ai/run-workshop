import { authoredRecipe } from '../constants/01'

export default authoredRecipe('despawn-burst', 'Despawn burst', 'A luminous vapor body breaks apart. Small fragments fall inward to one low exit point, then leave a dim closing mark.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.94, scale: 1.18, phase: 'despawn-burst-unmake-slices', tuning: { meshShader: 'despawn-burst-unmake-slices', referenceSource: 'repo-original/despawnBurstDisperse', referenceAdaptation: 'Separated density clumps break outward before they shrink toward one low exit point.', referenceLicense: 'repo-original', colorIndex: 1 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.9, scale: 1.18, phase: 'despawn-burst-exit-fragments', tuning: { meshShader: 'despawn-burst-exit-fragments', referenceSource: 'repo-original/despawnBurstDisperse', referenceAdaptation: 'Small irregular fragments separate first, then fall inward and shrink to zero.', referenceLicense: 'repo-original', colorIndex: 0 } },
], 2, 1.1)
