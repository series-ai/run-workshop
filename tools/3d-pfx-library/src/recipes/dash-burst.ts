import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dash-burst', 'Dash burst', 'A curved pressure front pulls a full soft wake forward. Fine speed particles follow behind the head.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.88, scale: 1.15, phase: 'dash-burst-shear-ribbons', tuning: { referenceSource: 'repo-original/dashBurstSlipstream', referenceAdaptation: 'Original moving pressure crescent with a full tapered soft wake.', referenceLicense: 'repo-original', meshShader: 'dash-burst-shear-ribbons', colorIndex: 1, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.86, scale: 1.15, phase: 'dash-burst-speed-traces', tuning: { referenceSource: 'repo-original/dashBurstSlipstream', referenceAdaptation: 'Original fine speed particles behind the leading front.', referenceLicense: 'repo-original', meshShader: 'dash-burst-speed-traces', colorIndex: 1, turbulenceScale: 0 } },
], 2, 1.45)
