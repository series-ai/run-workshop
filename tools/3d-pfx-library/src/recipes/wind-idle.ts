import { authoredRecipe } from '../constants/01'

// Craft guide §7: tune drift as velocity with real drag so motes stall
// instead of compounding off-screen; §10: one soft haze volume fuses the
// silhouette cheaper than stacked additive quads.
export default authoredRecipe('wind-idle', 'Wind idle', 'Air current idle with ribbon-like streak flow and a soft drifting haze.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.38, scale: 0.62, phase: 'wind-idle-current-haze', tuning: { meshMotion: 'drift', blend: 'alpha', colorOverride: '#00d9a8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.65, phase: 'wind-idle-ribbon-flow', tuning: { sprite: 'streak', blend: 'additive', size: [0.9, 0.6, 0.18], colorOverride: '#00d9a8', ramp: 'held', countScale: 0.42, speedScale: 0.85, speedJitter: 0.35, turbulenceScale: 0.3, motion: 'drift-cloud', stretch: 3, gravity: 0, drag: 2, spinScale: 0 } },
], 2, 0.81)
