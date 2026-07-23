import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-trail', 'Wind trail', 'Airflow trail with lateral streak and sparse dust points.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'wind-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#00d9a8', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, stretch: 1.8, spinScale: 0 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'wind-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#00d9a8' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'wind-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#eafff8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.6)
