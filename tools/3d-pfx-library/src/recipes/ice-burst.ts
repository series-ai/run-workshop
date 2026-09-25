import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ice-burst', "Ice burst", "Particle-first cold impact: pure procedural GLSL faceted crystal chips, sparkling glint motes, and soft smoke haze provide zero-texture mobile rendering without a ring or cloud mesh stack.", [
  {
    kind: 'particles', role: 'impact', opacity: 0.9, scale: 0.9, phase: 'ice-burst-particle-rime-contact',
    tuning: {
      motion: 'impact-burst', sprite: 'twirl', proceduralShape: 'chip', blend: 'alpha', colorOverride: '#bfe8ff', ramp: 'held',
      lifecycle: 'ice-burst-particle-impact', delay: 0, window: 0.16, lifeScale: 0.46,
      countScale: 0.46, speedScale: 2.8, speedJitter: 0.48, drag: 2.1, gravity: -1.8,
      spawnScale: 0.1, depthScale: 2.8, size: [0.12, 0.38, 0.1], spinScale: 0.8,
      stretch: 0.38, death: 'erode', ease: 'snap', turbulenceScale: 0.03, positionOffset: [0, -0.26, 0],
      referenceSource: 'chiro-procedural-chip-sdf-language',
      referenceAdaptation: 'procedural chip SDF generates crisp faceted ice splinters directly in fragment shader without texture atlas sampling',
      referenceLicense: 'repo-original-and-MIT',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.82, scale: 0.96, phase: 'ice-burst-particle-crystal-fan',
    tuning: {
      motion: 'cone-fountain', sprite: 'sparkle', proceduralShape: 'glint', blend: 'additive', colorOverride: '#edfaff', ramp: 'pinned-hot',
      lifecycle: 'ice-burst-particle-impact', delay: 0.06, window: 0.32, lifeScale: 0.7,
      countScale: 0.58, speedScale: 2.7, speedJitter: 0.52, drag: 0.92, gravity: -2.4,
      spawnScale: 0.14, depthScale: 3.2, size: [0.1, 0.32, 0.08], spinScale: 0.9,
      stretch: 0.18, death: 'erode', ease: 'snap', turbulenceScale: 0.06, positionOffset: [0, -0.1, 0],
      referenceSource: 'chiro-procedural-glint-sdf-language',
      referenceAdaptation: 'procedural glint SDF generates 4-point twinkling ice glints with analytical specular core',
      referenceLicense: 'repo-original-and-MIT',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.46, scale: 1.12, phase: 'ice-burst-particle-frost-haze',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke', proceduralShape: 'smoke', blend: 'alpha', colorOverride: '#8fc9df', ramp: 'pigment',
      lifecycle: 'ice-burst-particle-impact', delay: 0.14, window: 0.42, lifeScale: 1.02,
      countScale: 0.4, speedScale: 0.24, speedJitter: 0.4, drag: 1.45, gravity: 0.02,
      spawnScale: 0.76, spawnLift: 0.02, depthScale: 3.2, size: [0.3, 0.7, 0.54],
      spinScale: 0.28, death: 'erode', turbulenceScale: 0.2, positionOffset: [0, -0.12, 0],
      referenceSource: 'chiro-procedural-smoke-fbm-sdf-language',
      referenceAdaptation: 'procedural 2-octave FBM noise mask creates organic swirling frost haze with zero texture memory',
      referenceLicense: 'repo-original-and-MIT',
    },
  },
], 2, 1.3)
