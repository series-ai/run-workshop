import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-burst', "Exhaust burst", "Short exhaust puff for vehicles and machinery with restrained smoke overdraw.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.58, phase: 'exhaust-burst-smoke-puff', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'particles', role: 'volume', opacity: 0.42, scale: 0.48, phase: 'exhaust-burst-soot-points', tuning: { delay: 0, window: 0.45, lifeScale: 0.6, blend: 'alpha', ramp: 'dark', death: 'erode', countScale: 0.3, speedScale: 0.5, turbulenceScale: 0.4, sprite: 'debris', gravity: 0.5 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.5, phase: 'exhaust-burst-heat-wake', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
], 2, 1.15)
