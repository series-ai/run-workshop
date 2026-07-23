import { authoredRecipe } from '../constants/01'

// Released force wave: the big front with a trailing echo — the wave the
// charge promised.
export default authoredRecipe('shockwave-release', 'Shockwave release', 'Released force: dominant front with one trailing echo.', [
  { kind: 'shockwave-ring', role: 'impact', opacity: 1, scale: 1.3, phase: 'shockwave-release-radius-front', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.55,
    scale: 0.5,
    phase: 'shockwave-release-dust-points',
    tuning: { sprite: 'puff', blend: 'alpha', window: 0.07, delay: 0.12, countScale: 0.16, speedScale: 1.4, drag: 2, size: [0.45, 0.65, 0.75], lifeScale: 0.6, ramp: 'dark', death: 'erode', ease: 'snap', turbulenceScale: 0.4 },
  },
  { kind: 'shield-shell', role: 'impact', opacity: 0.16, scale: 0.68, phase: 'shockwave-release-echo-shell', tuning: { meshShader: 'fresnel-shell', meshMotion: 'bloom' } },
], 2, 1.7)
