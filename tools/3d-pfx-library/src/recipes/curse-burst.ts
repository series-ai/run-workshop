import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-burst', 'Curse burst', 'Particle-first malediction rupture: a dark contact knot breaks into toxic rune vectors while a bruise cloud lingers below the curse fan.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.94, scale: 0.84, phase: 'curse-burst-particle-void-knot',
    tuning: {
      motion: 'impact-burst', sprite: 'twirl', blend: 'alpha', colorOverride: '#2e0249', ramp: 'dark',
      lifecycle: 'curse-burst-particle-malediction', delay: 0, window: 0.14, lifeScale: 0.42,
      countScale: 0.38, speedScale: 2.4, speedJitter: 0.46, drag: 2.2, gravity: -0.2,
      spawnScale: 0.08, depthScale: 2.8, size: [0.16, 0.36, 0.12], spinScale: 1,
      stretch: 0.4, death: 'erode', ease: 'snap', turbulenceScale: 0.03, positionOffset: [0, -0.08, 0],
      referenceSource: 'curse-burst-malediction-effigy-and-CC0-twirl-sprite-language',
      referenceAdaptation: 'the suspended eye becomes a dark contact knot that collapses before the escaping runes take over',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.88, scale: 1.02, phase: 'curse-burst-particle-toxic-runes',
    tuning: {
      motion: 'radial-burst', sprite: 'rune', blend: 'additive', colorOverride: '#a855f7', ramp: 'held',
      lifecycle: 'curse-burst-particle-malediction', delay: 0.035, window: 0.34, lifeScale: 0.72,
      countScale: 0.68, speedScale: 2.7, speedJitter: 0.5, drag: 0.82, gravity: -0.72,
      spawnScale: 0.14, depthScale: 3.2, size: [0.14, 0.38, 0.1], spinScale: 0.3,
      death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, -0.04, 0],
      referenceSource: 'curse-burst-binding-chains-and-CC0-rune-sprite-language',
      referenceAdaptation: 'snapped axes become uneven rune vectors with independent depth and fall instead of a second binding mesh',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.56, scale: 1.1, phase: 'curse-burst-particle-bruise-cloud',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#481c5c', ramp: 'dark',
      lifecycle: 'curse-burst-particle-malediction', delay: 0.14, window: 0.46, lifeScale: 1.02,
      countScale: 0.42, speedScale: 0.22, speedJitter: 0.44, drag: 1.5, gravity: 0.03,
      spawnScale: 0.72, spawnLift: -0.02, depthScale: 3.2, size: [0.28, 0.7, 0.52],
      spinScale: 0.26, death: 'erode', turbulenceScale: 0.2, positionOffset: [0, -0.18, 0],
      referenceSource: 'curse-burst-obsidian-residue-and-CC0-smoke-variants',
      referenceAdaptation: 'the curse residue becomes a low bruised haze so the effect resolves into matter instead of a floating purple idol',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 0.84)
