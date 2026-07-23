import { authoredRecipe } from '../constants/01'

export default authoredRecipe('acid-idle', 'Acid idle pool', 'Looping hazard volume with drifting vapor and surface boundary.', [
  { kind: 'acid-pool', role: 'volume', opacity: 0.92, scale: 1.18, phase: 'acid-idle-corrosive-pool', tuning: { meshShader: 'acid-pool', meshMotion: 'pulse', blend: 'alpha', lifecycle: 'acid-idle-boil', colorOverride: '#83e600' } },
  { kind: 'particles', role: 'volume', opacity: 0.46, scale: 0.96, phase: 'acid-idle-low-vapor', tuning: { sprite: 'smoke', blend: 'alpha', motion: 'drift-cloud', countScale: 0.4, speedScale: 0.18, speedJitter: 0.38, spawnScale: 1.2, depthScale: 2.5, size: [0.34, 0.64, 0.46], ramp: 'pigment', colorOverride: '#8da83a', death: 'erode', turbulenceScale: 0.34, gravity: 0.06, spinScale: 0.18, positionOffset: [0, -0.7, 0] } },
], 2, 1)
