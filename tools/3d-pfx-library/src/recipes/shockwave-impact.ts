import { authoredRecipe } from '../constants/01'

// Force wave on hit: the front IS the feedback; a faint echo ring reads
// as the reverberation, dust barely lifts.
export default authoredRecipe('shockwave-impact', 'Shockwave impact', 'On-hit force wave with a faint reverberation echo.', [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.95, scale: 1, phase: 'shockwave-impact-radius-front', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.6,
    scale: 0.45,
    phase: 'shockwave-impact-dust-points',
    tuning: { sprite: 'puff', blend: 'alpha', window: 0.06, delay: 0.12, countScale: 0.16, speedScale: 1.2, drag: 2.2, size: [0.4, 0.6, 0.7], lifeScale: 0.6, ramp: 'dark', death: 'erode', ease: 'snap', turbulenceScale: 0.4 },
  },
  // Air reverberation is a SPHERICAL pressure shell — readable from every
  // angle by geometry (a flat ring vanished edge-on).
  { kind: 'shield-shell', role: 'impact', opacity: 0.14, scale: 0.6, phase: 'shockwave-impact-echo-shell', tuning: { meshShader: 'fresnel-shell', meshMotion: 'bloom' } },
], 2, 1.8)
