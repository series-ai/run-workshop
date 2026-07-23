export function createPfxBlastBurstStyleTreatment(styleEdgeHardness: number): {
  cageTopology: 'six-broad-pressure-plates' | 'six-narrow-containment-ribs'
  materialResponse: 'matte-compression-strata' | 'edge-hot-pressure-facets'
  launchCadence: 'staggered-tumble' | 'synchronized-bolt-out'
  wakeStructure: 'broken-cross-spears' | 'split-octant-spears'
} {
  return styleEdgeHardness >= 0.5
    ? { cageTopology: 'six-narrow-containment-ribs', materialResponse: 'edge-hot-pressure-facets', launchCadence: 'synchronized-bolt-out', wakeStructure: 'split-octant-spears' }
    : { cageTopology: 'six-broad-pressure-plates', materialResponse: 'matte-compression-strata', launchCadence: 'staggered-tumble', wakeStructure: 'broken-cross-spears' }
}
