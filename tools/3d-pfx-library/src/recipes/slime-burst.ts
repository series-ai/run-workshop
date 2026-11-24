import { authoredRecipe } from '../constants/01'

// Tempo compensates for removal of the particle cycleScale, 1.204766.
// The real getPfxBurstCycleSeconds remains exactly 1.1412507162360848 seconds.
export default authoredRecipe('slime-burst', 'Slime burst', 'A thick closed gel body pulls its bulk into a curved neck, pinches once and recoils. The broken lobe continues as a rounded drop.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.98, scale: 1.18, phase: 'slime-burst-elastic-splat', tuning: { meshShader: 'slime-burst-elastic-splat', referenceSource: 'repo-original/slimeBurstElasticSplat', referenceAdaptation: 'Original closed gel volume transfers bulk through a short curved neck and retains curved wet shading during retreat.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'impact', opacity: 0.96, scale: 1.18, phase: 'slime-burst-sticky-drops', tuning: { meshShader: 'slime-burst-sticky-drops', referenceSource: 'repo-original/slimeBurstElasticSplat', referenceAdaptation: 'Original shaded heavy drops include the exact upper cap transferred at the broken neck.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
], 2, 0.9545422098565197)
