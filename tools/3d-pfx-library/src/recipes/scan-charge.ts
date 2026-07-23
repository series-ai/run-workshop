import { authoredRecipe } from '../constants/01'

export default authoredRecipe('scan-charge', 'Scan charge', 'Scan windup with data prime and sample ring.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'scan-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#b4fff0' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'scan-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#1fd0b8', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 0.8 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'scan-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#b4fff0', turbulenceScale: 0, gravity: 0 } },
], 2, 2.0)
