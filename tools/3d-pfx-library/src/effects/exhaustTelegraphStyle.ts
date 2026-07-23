export function createPfxExhaustTelegraphStyleTreatment(styleEdgeHardness: number): {
  chevronTopology: 'four-broad' | 'six-narrow'
  countdownLayout: 'center-bars' | 'edge-rails'
  fillTreatment: 'matte' | 'outline'
  shutterTopology: 'diamond' | 'cross'
} {
  return styleEdgeHardness >= 0.5
    ? { chevronTopology: 'six-narrow', countdownLayout: 'edge-rails', fillTreatment: 'outline', shutterTopology: 'cross' }
    : { chevronTopology: 'four-broad', countdownLayout: 'center-bars', fillTreatment: 'matte', shutterTopology: 'diamond' }
}
