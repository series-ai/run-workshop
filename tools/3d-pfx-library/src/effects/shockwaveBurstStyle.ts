export function createPfxShockwaveBurstStyleTreatment(styleEdgeHardness: number): {
  arcTopology: 'ten-broad-pressure-arcs' | 'fourteen-narrow-pressure-arcs'
  materialResponse: 'matte-air-strata' | 'edge-hot-refraction'
  propagationCadence: 'staggered-front' | 'synchronized-front'
  domeProfile: 'rounded-bow' | 'split-chevron-bow'
} {
  return styleEdgeHardness >= 0.5
    ? { arcTopology: 'fourteen-narrow-pressure-arcs', materialResponse: 'edge-hot-refraction', propagationCadence: 'synchronized-front', domeProfile: 'split-chevron-bow' }
    : { arcTopology: 'ten-broad-pressure-arcs', materialResponse: 'matte-air-strata', propagationCadence: 'staggered-front', domeProfile: 'rounded-bow' }
}
