import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-burst', 'Teleport burst', 'A compact ion body compresses into one bright arrival beat. Unequal plumes separate into rising motes.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.94, scale: 1.18, phase: 'teleport-burst-spatial-slices', tuning: { meshShader: 'teleport-burst-spatial-slices', referenceSource: 'repo-original/teleportBurstSpatial', referenceAdaptation: 'Three unequal soft plumes occupy separate depths. A narrow focal core marks arrival.', referenceLicense: 'repo-original', colorIndex: 1 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.9, scale: 1.18, phase: 'teleport-burst-arrival-traces', tuning: { meshShader: 'teleport-burst-arrival-traces', referenceSource: 'repo-original/teleportBurstSpatial', referenceAdaptation: 'Soft motes and short streaks peel upward and outward after arrival.', referenceLicense: 'repo-original', colorIndex: 0 } },
], 2, 1.35)
