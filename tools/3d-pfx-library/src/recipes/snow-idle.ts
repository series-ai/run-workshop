import { authoredRecipe } from '../constants/01'

export default authoredRecipe('snow-idle', 'Snow idle', 'Two-draw ambient weather volume: twelve fully branched closed snow crystals in three curated dendrite variants tumble through a broad near field while forty-eight tiny closed faceted granules supply subordinate far-depth density, with no billboard cards, ground blob, or particle overdraw.', [
  { kind: 'impact-shards', role: 'aura', opacity: 1, scale: 0.98, phase: 'snow-idle-volumetric-flurry', tuning: { meshGeometry: 'snow-idle-flurry-field', meshMotion: 'drift', lifecycle: 'snow-idle-weather-loop', blend: 'alpha', colorOverride: '#edfaff', positionOffset: [0, 0.08, 0] } },
  { kind: 'impact-shards', role: 'volume', opacity: 0.78, scale: 1, phase: 'snow-idle-faceted-depth-field', tuning: { meshGeometry: 'snow-idle-depth-granules', meshMotion: 'drift', lifecycle: 'snow-idle-weather-loop', blend: 'alpha', colorOverride: '#bfeeff', positionOffset: [0, 0.08, 0] } },
], 2, 0.72)
