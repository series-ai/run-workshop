import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('leaf-burst', 'Leaf burst', 'Two-draw botanical release: thirty-six crowned ovate, oak, and ginkgo leaves open around a closed botanical seed pod through four sequential radial depth shells while tapered pentagonal veins, nine helical seed curls, and twelve glowing seed motes preserve readable plant structure through the fluttering fall.', [
  { kind: 'impact-shards', role: 'body', opacity: 1, scale: 0.58, phase: 'leaf-burst-three-species-canopy', tuning: { meshGeometry: 'leaf-burst-sculpted-canopy' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'leaf-burst-botanical-release' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#69a83e', positionOffset: [0, -0.34, 0] } },
  { kind: 'impact-shards', role: 'trail', opacity: 0.92, scale: 0.58, phase: 'leaf-burst-vein-and-seed-curls', tuning: { meshGeometry: 'leaf-burst-vein-seed-curls' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'leaf-burst-botanical-release' as PfxSurfaceTuning['lifecycle'], blend: 'additive', colorOverride: '#d8f29a', delay: 0.18, positionOffset: [0, -0.34, 0] } },
], 2, 1.05)
