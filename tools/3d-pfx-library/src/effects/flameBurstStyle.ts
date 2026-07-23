export function createPfxFlameBurstStyleTreatment(styleEdgeHardness: number): {
  tongueTopology: 'three-broad' | 'five-narrow'
  materialResponse: 'matte-banded' | 'edge-veined'
  peelCadence: 'sequential' | 'synchronized'
  residue: 'char-front' | 'cell-erode'
} {
  return styleEdgeHardness >= 0.5
    ? { tongueTopology: 'five-narrow', materialResponse: 'edge-veined', peelCadence: 'synchronized', residue: 'cell-erode' }
    : { tongueTopology: 'three-broad', materialResponse: 'matte-banded', peelCadence: 'sequential', residue: 'char-front' }
}
