import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('hologram-break', 'Hologram break', 'A sliced holographic figure destabilizes and collapses into its broken projector footprint.', [
  { kind: 'screen-plane', role: 'body', opacity: 0.95, scale: 0.78, phase: 'hologram-break-sliced-figure', tuning: { meshGeometry: 'hologram-break-figure-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'hologram-break-figure', lifecycle: 'hologram-break-stabilize-fracture-collapse' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#8cf5ff', positionOffset: [0, 0.9, 0], turbulenceScale: 0 } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.82, scale: 0.82, phase: 'hologram-break-projector-residue', tuning: { meshGeometry: 'hologram-break-projector-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'hologram-break-projector', lifecycle: 'hologram-break-stabilize-fracture-collapse' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#63d8ee', positionOffset: [0, 0.03, 0], turbulenceScale: 0 } },
], 2, 1.45)
