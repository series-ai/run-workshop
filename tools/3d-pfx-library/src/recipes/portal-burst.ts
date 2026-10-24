import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-burst', 'Portal opening', 'A violet vortex opens with a thick rim and a recessed center. Small motes enter as the rim fades.', [
  {
    kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.64, phase: 'portal-burst-vortex-rim',
    tuning: {
      meshShader: 'portal-aperture', meshMotion: 'flash', window: 0.45, startScale: 0.2,
      colorOverride: '#8850ef',
      material: {
        uv: { scale: [1.12, 1.12], offset: [0, 0], rotation: 0, scroll: [0, 0], wrap: 'clamp' },
        distortion: { kind: 'flow', map: 'flow-a', strength: 0.04, scroll: [0.12, -0.08] },
      },
    },
  },
  {
    kind: 'portal-throat', role: 'volume', opacity: 0.86, scale: 0.64, phase: 'portal-burst-inner-window',
    tuning: {
      meshShader: 'portal-throat', meshMotion: 'flash', window: 0.45, startScale: 0.2,
      colorOverride: '#6736ba', material: { rim: { power: 2.8, strength: 0.9 } },
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.86, scale: 0.56, phase: 'portal-burst-inward-motes',
    tuning: {
      motion: 'portal-flow', sprite: 'magic', blend: 'additive', colorOverride: '#d2a2ff', ramp: 'held',
      delay: 0.04, window: 0.22, lifeScale: 0.5, countScale: 0.28, spawnScale: 0.75,
      speedScale: 1.2, depthScale: 2, size: [0.03, 0.08, 0.01],
      ease: 'snap', turbulenceScale: 0.05, spinScale: 1.2, gravity: 0, death: 'erode',
    },
  },
], 2, 1.1)
