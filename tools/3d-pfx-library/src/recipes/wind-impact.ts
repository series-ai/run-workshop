import { authoredRecipe } from '../constants/01'

// Air pressure is directional flow, not an empty ring. Four tapered
// streamlines compress through the impact point, shear streaks carry the
// vector forward, and a restrained ground-dust handoff resolves along the
// same direction without becoming a larger smoke event.
export default authoredRecipe('wind-impact', 'Wind impact', 'Particle-first pressure release: an irregular compression fan, directional shear streaks, and a quiet ground-dust recovery.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.94, scale: 1.18, phase: 'wind-impact-particle-pressure-fan',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'alpha', colorOverride: '#b7c9ca', ramp: 'held',
      lifecycle: 'wind-impact-shear', delay: 0, window: 0.2, lifeScale: 0.46,
      countScale: 0.72, speedScale: 3.2, speedJitter: 0.42, drag: 1.2, gravity: 0,
      spawnScale: 0.18, depthScale: 3.2, size: [0.22, 0.58, 0.1], spinScale: 0.5,
      stretch: 0.42, randomizeAzimuth: true, turbulenceScale: 0.04, impactVector: [1, 0.08, 0.04], spreadAngle: 0.62,
      death: 'erode', ease: 'snap', positionOffset: [0, -0.16, 0],
      referenceSource: 'wind-impact-pressure-wedge-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the closed pressure wedge becomes an uneven depth-bearing fan of velocity-stretched air streaks',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.8, scale: 1.16, phase: 'wind-impact-particle-release-streaks',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#d5dfde', ramp: 'held',
      lifecycle: 'wind-impact-shear', delay: 0.06, window: 0.24, lifeScale: 0.52,
      countScale: 0.62, speedScale: 4.4, speedJitter: 0.5, drag: 0.72, gravity: 0,
      spawnScale: 0.2, depthScale: 3.4, size: [0.18, 0.52, 0.08], spinScale: 0,
      stretch: 0.78, randomizeAzimuth: true, turbulenceScale: 0.06, impactVector: [1, 0.16, 0.18], spreadAngle: 0.42,
      death: 'erode', ease: 'snap', positionOffset: [0.34, 0, 0],
      referenceSource: 'wind-impact-shear-streams-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the swept ribbons become a sparse forward shear stream with independent azimuth and depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.58, scale: 1.16, phase: 'wind-impact-particle-ground-dust',
    tuning: {
      motion: 'ground-scuff', sprite: 'debris', blend: 'alpha', colorOverride: '#8d9288', ramp: 'dark',
      lifecycle: 'wind-impact-shear', delay: 0.14, window: 0.3, lifeScale: 0.8,
      countScale: 0.68, speedScale: 1.85, speedJitter: 0.42, drag: 1.35, spawnScale: 0.52,
      depthScale: 2.8, gravity: -0.55, stretch: 0.85, spinScale: 0.55, turbulenceScale: 0.14,
      impactVector: [1, 0.16, 0.18], spreadAngle: 0.42, size: [0.16, 0.3, 0.08], death: 'erode',
      positionOffset: [0.55, -0.02, 0], referenceSource: 'wind-impact-ground-scuff-and-CC0-debris-sprite-language',
      referenceAdaptation: 'the quiet dust handoff stays low and directional so the pressure read resolves into ground matter',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.35)
