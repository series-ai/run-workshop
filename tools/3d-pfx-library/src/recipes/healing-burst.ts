import { authoredRecipe } from '../constants/01'

// Tempo preserves the earlier 0.9921885329265192 second period.
export default authoredRecipe('healing-burst', 'Healing burst', 'Three mint strands weave upward through a spatial healing cross and release small renewal motes.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.96, scale: 1.18, phase: 'healing-burst-body', tuning: { meshShader: 'healing-burst-restoration-weave', referenceSource: 'repo-original/healingBurstRestoration', referenceAdaptation: 'Original open strands rise through a spatial healing cross.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.88, scale: 1.18, phase: 'healing-burst-accents', tuning: { meshShader: 'healing-burst-renewal-motes', referenceSource: 'repo-original/healingBurstRestoration', referenceAdaptation: 'Original renewal motes rise and retire after the healing beat.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.0401618029471251)
