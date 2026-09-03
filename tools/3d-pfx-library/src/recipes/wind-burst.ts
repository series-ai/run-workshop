import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-burst', 'Wind burst', 'Particle-first directional pressure release: compact source flash, irregular shear streaks, and a thin retiring wake.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 1.12, phase: 'wind-burst-particle-source-flash',
    tuning: {
      motion: 'radial-burst', sprite: 'glow', blend: 'additive', colorOverride: '#f4ffff', ramp: 'pinned-hot',
      lifecycle: 'wind-burst-particle-release', delay: 0, window: 0.08, lifeScale: 0.22,
      countScale: 0.34, speedScale: 1.15, speedJitter: 0.2, drag: 2.6, gravity: 0,
      spawnScale: 0.08, depthScale: 2.2, size: [0.28, 0.62, 0.22], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0, positionOffset: [0, 0, 0],
      referenceSource: 'wind-impact-pressure-core-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the helical mesh knot becomes a compact additive pressure flash at the release origin',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.94, scale: 1.28, phase: 'wind-burst-particle-shear-streaks',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#9fe4f4', ramp: 'held',
      lifecycle: 'wind-burst-particle-release', delay: 0.03, window: 0.2, lifeScale: 0.42,
      countScale: 0.86, speedScale: 4.2, speedJitter: 0.52, drag: 0.78, gravity: 0,
      spawnScale: 0.18, depthScale: 3.3, size: [0.16, 0.58, 0.1], spinScale: 0.2,
      stretch: 0.72, randomizeAzimuth: true, impactVector: [1, 0.12, 0.08], spreadAngle: 0.46,
      death: 'erode', ease: 'snap', turbulenceScale: 0.06, positionOffset: [0.18, 0.04, 0],
      referenceSource: 'wind-impact-shear-streams-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the closed airfoil ribbons become a narrow directional fan of independent air streaks',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.48, scale: 1.22, phase: 'wind-burst-particle-wake-mist',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke', blend: 'alpha', colorOverride: '#7aa8b4', ramp: 'dark',
      lifecycle: 'wind-burst-particle-release', delay: 0.1, window: 0.26, lifeScale: 0.7,
      countScale: 0.48, speedScale: 0.55, speedJitter: 0.34, drag: 1.5, gravity: 0,
      spawnScale: 0.7, depthScale: 2.8, size: [0.36, 0.82, 0.58], spinScale: 0.18,
      stretch: 0, death: 'erode', turbulenceScale: 0.18, positionOffset: [-0.12, -0.08, 0],
      referenceSource: 'kenney-particle-pack-smoke-as-broken-air-wake',
      referenceAdaptation: 'thin CC0 smoke cells tinted as a broken pale wake that grows while it fades',
      referenceLicense: 'CC0-1.0',
    },
  },
], 2, 1.28)
