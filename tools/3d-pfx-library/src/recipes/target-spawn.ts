import { authoredRecipe } from '../constants/01'

export default authoredRecipe('target-spawn', 'Target spawn', 'Crossed world marker: segmented ground acquisition gates resolve into a lifted confirmation pin.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.94, scale: 0.94, phase: 'target-spawn-acquisition-reticle', tuning: { meshGeometry: 'target-spawn-acquisition-quad', meshShader: 'target-spawn-reticle', lifecycle: 'target-spawn-acquire-confirm-release', blend: 'alpha', colorOverride: '#72d7ff', positionOffset: [0, 0.03, 0], turbulenceScale: 0 } },
  { kind: 'screen-plane', role: 'aura', opacity: 0.96, scale: 0.72, phase: 'target-spawn-confirmation-pin', tuning: { meshGeometry: 'target-spawn-confirmation-pin-quad', meshShader: 'target-spawn-pin', lifecycle: 'target-spawn-acquire-confirm-release', blend: 'alpha', colorOverride: '#e8f8ff', positionOffset: [0, 0.82, 0], turbulenceScale: 0 } },
], 2, 1.45)
