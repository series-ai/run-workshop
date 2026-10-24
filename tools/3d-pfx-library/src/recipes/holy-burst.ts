import { authoredRecipe } from '../constants/01'

// Tempo preserves the earlier 1.318816933638444 second period.
export default authoredRecipe('holy-burst', 'Holy burst', 'Separated gold rays deliver one blessing beat, then pale feather particles lift and retire.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.96, scale: 1.0, phase: 'holy-burst-body', tuning: { meshShader: 'holy-burst-consecration-rays', referenceSource: 'repo-original/holyBurstConsecration', referenceAdaptation: 'Original separated ray particles deliver one warm blessing beat.', referenceLicense: 'repo-original', colorIndex: 1, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.88, scale: 1.0, phase: 'holy-burst-accents', tuning: { meshShader: 'holy-burst-sanctity-feathers', referenceSource: 'repo-original/holyBurstConsecration', referenceAdaptation: 'Original feather shaped particles lift and retire.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
], 2, 0.7825472868512969)
