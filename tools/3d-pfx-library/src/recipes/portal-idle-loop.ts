import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-idle-loop', 'Portal idle vortex', 'Persistent portal read with spiral swirl and orbiting motes.', [
  // Polar-UV swirl: spiral arms with inner-faster differential rotation —
  // a static ring texture spinning never reads as a vortex.
  {
    kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.92, phase: 'vortex-rim',
    tuning: {
      meshShader: 'vortex-swirl',
      material: {
        uv: { scale: [1.025, 1.025], offset: [0, 0], rotation: 0.025, scroll: [0, 0], wrap: 'clamp' },
        distortion: { kind: 'flow', map: 'flow-a', strength: 0.018, scroll: [0.06, -0.04] },
      },
    },
  },
  {
    kind: 'portal-throat', role: 'volume', opacity: 0.58, scale: 0.92, phase: 'aperture-depth',
    tuning: { meshShader: 'portal-throat', colorIndex: 0, material: { rim: { power: 2.5, strength: 0.96 } } },
  },
  { kind: 'particles', role: 'aura', opacity: 0.72, scale: 0.88, phase: 'depth-flow', tuning: { motion: 'portal-flow', sprite: 'magic', depthScale: 6, countScale: 0.72, size: [0.4, 0.65, 0.22], ramp: 'held', turbulenceScale: 0.3, spinScale: 0 } },
], 2, 0.9)
