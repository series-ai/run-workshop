import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-burst', 'Spawn burst', 'Soft curved ground marks register an open space. Short light wisps and motes build upward.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.94, scale: 1.18, phase: 'spawn-burst-materialize-weave', tuning: { meshShader: 'spawn-burst-materialize-weave', referenceSource: 'repo-original/spawnBurstMaterialize', referenceAdaptation: 'Original short curved ground marks precede soft tapered wisps at separate depths. Lower sections retire as the light crest rises.', referenceLicense: 'repo-original', colorIndex: 1 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.9, scale: 1.18, phase: 'spawn-burst-rising-motes', tuning: { meshShader: 'spawn-burst-rising-motes', referenceSource: 'repo-original/spawnBurstMaterialize', referenceAdaptation: 'Original small stroke particles rise from separate ground anchors while the light wisps build upward.', referenceLicense: 'repo-original', colorIndex: 0 } },
], 2, 1.15)
