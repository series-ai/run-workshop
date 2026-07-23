import { authoredRecipe } from '../constants/01'

export default authoredRecipe('engine-burst', "Engine burst", "Mechanical ignition pop with heat core, exhaust flecks, and a compact thrust read.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.62, scale: 0.28, phase: 'engine-burst-ignition-core', tuning: { meshMotion: 'flash' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.48, phase: 'engine-burst-heat-haze', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'particles', role: 'impact', opacity: 0.58, scale: 0.5, phase: 'engine-burst-carbon-flecks', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'debris', blend: 'alpha', gravity: -2.6, ramp: 'dark' } },
], 2, 1.3)
