import { authoredRecipe } from '../constants/01'

// Reward spec T1 relay: touch pop sparks -> coin flight arc -> deposit
// glint at the arc apex (the resolution beat — value ARRIVES somewhere).
// Most-fired effect in the library => cheapest (spec rule 3).
// Three-draw T1 budget: the closed faceted corona owns the contact pop,
// the metallic medallion carries the flight, and one late glint resolves
// the relay at the deposit apex.
export default authoredRecipe('coin-pickup-sparkle', 'Pickup sparkle', 'T1 reward: gold twinkle burst, coin flight arc, deposit glint.', [
  { kind: 'coin-reward-burst', role: 'impact', opacity: 0.98, scale: 0.34, phase: 'coin-pickup-radial-reward-burst', tuning: { meshMotion: 'flash', lifecycle: 'coin-pickup-reward-burst', colorOverride: '#fff0a8', positionOffset: [0, 0.52, 0], delay: 0.06, window: 0.36, startScale: 0.48 } },
  { kind: 'coin-medallion', role: 'body', opacity: 0.98, scale: 0.46, phase: 'coin-pickup-flight-arc', tuning: { meshMotion: 'pickup', colorOverride: '#ffc83d' } },
  { kind: 'particles', role: 'impact', opacity: 0.94, scale: 0.36, phase: 'coin-pickup-deposit-glint', tuning: { sprite: 'sparkle', colorOverride: '#fff0a8', delay: 0.55, window: 0.14, lifeScale: 0.34, countScale: 0.08, speedScale: 0.18, drag: 4.5, spawnOffset: [0, 0.82, 0.04], spawnScale: 0.1, spinScale: 0, turbulenceScale: 0, gravity: 0, size: [0.48, 0.68, 0.18], ramp: 'pinned-hot', ease: 'snap' } },
], 2, 2.0)
