import { authoredRecipe } from '../constants/01'

export default authoredRecipe('landing-impact', "Landing impact", "Landing contact with compression dust and stable floor ring.", [
  { kind: 'core-sphere', role: 'impact', opacity: 0.5, scale: 1.1, phase: 'landing-impact-contrast-shadow', tuning: { meshMotion: 'flash', blend: 'alpha', colorOverride: '#0b0812' } },
  { kind: 'particles', role: 'volume', opacity: 0.6, scale: 0.62, phase: 'landing-impact-compression-dust', tuning: { sprite: 'puff', blend: 'alpha', colorOverride: '#c4a878', window: 0.18, countScale: 0.31, speedScale: 0.9, gravity: 0.25, drag: 1.8, size: [0.7, 1.15, 1.4], spinScale: 0.6, lifeScale: 0.8, ramp: 'held', death: 'erode', turbulenceScale: 0.5 } },
  { kind: 'particles', role: 'impact', opacity: 0.4, scale: 0.5, phase: 'landing-impact-ground-grit', tuning: { countScale: 0.26, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'debris', blend: 'alpha', colorOverride: '#a8895c', gravity: -3, motion: 'ground-scuff', spinScale: 1.0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'landing-impact-floor-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.4)
