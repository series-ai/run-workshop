export function createPfxMeteorBurstStyleTreatment(styleEdgeHardness: number): {
  chunkTopology: 'five-broad-ejecta' | 'eight-narrow-ejecta'
  materialResponse: 'matte-lava-strata' | 'edge-hot-fissures'
  impactCadence: 'staggered-ballistic' | 'synchronized-rail'
  groundFront: 'broken-wedge-fan' | 'split-chevron-front'
} {
  return styleEdgeHardness >= 0.5
    ? { chunkTopology: 'eight-narrow-ejecta', materialResponse: 'edge-hot-fissures', impactCadence: 'synchronized-rail', groundFront: 'split-chevron-front' }
    : { chunkTopology: 'five-broad-ejecta', materialResponse: 'matte-lava-strata', impactCadence: 'staggered-ballistic', groundFront: 'broken-wedge-fan' }
}
