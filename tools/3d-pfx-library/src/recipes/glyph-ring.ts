import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-ring', 'Glyph ring', 'Disciplined inscribed magic circle with a central seal and lifted rune witnesses.', [
  { kind: 'magic-circle', role: 'aura', opacity: 0.98, scale: 1.28, phase: 'glyph-ring-inscribed-seal', tuning: { meshMotion: 'charge', lifecycle: 'glyph-ring-inscription', blend: 'additive', colorOverride: '#74d7ff', positionOffset: [0, -0.86, 0] } },
  { kind: 'particles', role: 'volume', opacity: 0.78, scale: 0.9, phase: 'glyph-ring-rising-script-dust', tuning: { motion: 'column-rise', sprite: 'glow', blend: 'additive', lifecycle: 'glyph-ring-inscription', colorOverride: '#d9f7ff', ramp: 'pinned-hot', death: 'erode', delay: 0.04, window: 0.62, lifeScale: 0.78, countScale: 0.55, speedScale: 0.62, speedJitter: 0.18, drag: 1.55, gravity: 0.1, spawnScale: 0.86, spawnLift: 0.12, depthScale: 1.35, turbulenceScale: 0.06, spinScale: 0, size: [0.1, 0.2, 0.06], positionOffset: [0, -0.66, 0] } },
], 2, 0.82)
