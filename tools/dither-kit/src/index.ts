// ── dither-kit public entry ───────────────────────────────────────────
// Engine-agnostic GPU dithering: config → uniforms → GLSL fragment shader.
// No runtime dependencies; consumed as TypeScript source.

export {
  GPU_DITHER_ALGORITHMS,
  MAX_COMPARE_CELLS,
  DITHER_FRAGMENT_SHADER,
  getDitherUniforms,
  updateDitherUniforms,
} from './DitherEffect';
export type {
  GpuDitherAlgorithm,
  CompareCellAlgorithm,
  CompareGridConfig,
  ResolveMaskConfig,
  DitherEffectConfig,
} from './DitherEffect';

export {
  PALETTE_1BIT_RAW,
  PALETTE_GAMEBOY_RAW,
  PALETTE_CGA_RAW,
  PALETTE_PICO8_RAW,
  PALETTE_GRAYSCALE_4_RAW,
  PALETTE_GRAYSCALE_8_RAW,
  PALETTE_NOKIA_RAW,
  PALETTE_AMBER_RAW,
  PALETTE_C64_RAW,
  PALETTE_SWEETIE_16_RAW,
  PALETTE_PRESETS,
  PRESET_GAMEBOY_CLASSIC,
  PRESET_PICO8_SCENE,
  PRESET_C64_NOSTALGIA,
  PRESET_NOKIA_SCREEN,
  PRESET_SWEETIE_BAYER,
  PRESET_NEWSPAPER,
  PRESET_MAGAZINE_CMYK,
  PRESET_CROSSHATCH_SKETCH,
  PRESET_HALFTONE_LINE,
  PRESET_FILM_GRAIN,
  PRESET_CRT_MONITOR,
  PRESET_AMBER_TERMINAL,
  PRESET_VHS_STATIC,
  PRESET_STIPPLE_DRAWING,
  PRESET_HIGH_CONTRAST,
  PRESET_SOFT_ATKINSON,
  PRESET_DEPTH_STABLE,
  PRESET_DIAMOND_PLATE,
  ALL_PRESETS,
  PRESET_CATEGORIES,
  DEFAULT_STRENGTH,
  DEFAULT_SCALE,
  DEFAULT_ANIMATION_SPEED,
  DEFAULT_HALFTONE_ANGLE,
  DEFAULT_BAYER_SIZE,
  DEFAULT_BRIGHTNESS,
  DEFAULT_CONTRAST,
  DEFAULT_GAMMA,
  DEFAULT_THRESHOLD,
} from './presets';
export type { PalettePreset, DitherPreset, PresetCategory } from './presets';
