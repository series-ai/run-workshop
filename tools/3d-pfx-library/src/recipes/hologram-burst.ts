import { authoredRecipe } from '../constants/01'

// A projector ignites and scans a volumetric bust in from its base. The bust
// holds with rolling scan bands and two short section glitches, then a
// top-down erase line tears it back into the narrowing beam.
export default authoredRecipe('hologram-burst', 'Hologram burst', 'A projector scans in a cyan bust. Sections glitch sideways, then an erase line retracts it into the beam.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.9, scale: 1, phase: 'hologram-burst-projector-beam', tuning: { meshShader: 'hologram-burst-emitter', colorOverride: '#2fc8f0', turbulenceScale: 0 } },
  { kind: 'shield-shell', role: 'body', opacity: 0.92, scale: 1, phase: 'hologram-burst-projection-flash', tuning: { meshShader: 'hologram-burst-projection', colorOverride: '#38d6ff', turbulenceScale: 0 } },
], 2, 1.2287)
