import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('scan-cone', 'Scan cone', 'Grounded sensor sector with a volumetric partial-cone shell and advancing scan front.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.9, scale: 0.95, phase: 'scan-cone-ground-sector', tuning: { meshGeometry: 'scan-cone-ground-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'scan-cone-footprint', lifecycle: 'scan-cone-acquire-sweep-resolve' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#7fe3d2', positionOffset: [0, 0.025, 0], turbulenceScale: 0 } },
  { kind: 'muzzle-cone', role: 'volume', opacity: 0.72, scale: 0.75, phase: 'scan-cone-volumetric-sweep', tuning: { meshGeometry: 'scan-cone-volume-sector' as PfxSurfaceTuning['meshGeometry'], meshShader: 'scan-cone-volume', lifecycle: 'scan-cone-acquire-sweep-resolve' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#d8fff8', positionOffset: [0.18, 0.16, 0], turbulenceScale: 0 } },
], 2, 1.35)
