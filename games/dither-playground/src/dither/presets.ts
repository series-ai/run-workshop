// ── Dither Playground Presets ──────────────────────────────────────────

import type { DitherEffectConfig } from './DitherEffect';

// --- Palette presets (as raw arrays for GPU uniform encoding) ---

export const PALETTE_1BIT_RAW = [[0, 0, 0], [255, 255, 255]];
export const PALETTE_GAMEBOY_RAW = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
export const PALETTE_CGA_RAW = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170],
  [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
  [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];
export const PALETTE_PICO8_RAW = [
  [0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81],
  [171, 82, 54], [95, 87, 79], [194, 195, 199], [255, 241, 232],
  [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54],
  [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170],
];
export const PALETTE_GRAYSCALE_4_RAW = [[0, 0, 0], [85, 85, 85], [170, 170, 170], [255, 255, 255]];
export const PALETTE_GRAYSCALE_8_RAW = Array.from({ length: 8 }, (_, i) => {
  const v = Math.round((i / 7) * 255);
  return [v, v, v];
});
export const PALETTE_NOKIA_RAW = [[67, 82, 61], [199, 207, 161]];
export const PALETTE_AMBER_RAW = [[20, 12, 0], [255, 176, 0]];
export const PALETTE_C64_RAW = [
  [0, 0, 0], [255, 255, 255], [136, 57, 50], [103, 182, 189],
  [139, 63, 150], [85, 160, 73], [64, 49, 141], [191, 206, 114],
  [139, 84, 41], [87, 66, 0], [184, 105, 98], [80, 80, 80],
  [120, 120, 120], [148, 224, 137], [120, 105, 196], [159, 159, 159],
];
export const PALETTE_SWEETIE_16_RAW = [
  [26, 28, 44], [93, 39, 93], [177, 62, 83], [239, 125, 87],
  [255, 205, 117], [167, 240, 112], [56, 183, 100], [37, 113, 121],
  [41, 54, 111], [59, 93, 201], [65, 166, 246], [115, 239, 247],
  [244, 244, 244], [148, 176, 194], [86, 108, 134], [51, 60, 87],
];

export interface PalettePreset {
  label: string;
  colors: number[][];
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { label: '1-Bit', colors: PALETTE_1BIT_RAW },
  { label: 'Game Boy', colors: PALETTE_GAMEBOY_RAW },
  { label: 'CGA', colors: PALETTE_CGA_RAW },
  { label: 'PICO-8', colors: PALETTE_PICO8_RAW },
  { label: 'Grayscale 4', colors: PALETTE_GRAYSCALE_4_RAW },
  { label: 'Grayscale 8', colors: PALETTE_GRAYSCALE_8_RAW },
  { label: 'Nokia 3310', colors: PALETTE_NOKIA_RAW },
  { label: 'Amber Mono', colors: PALETTE_AMBER_RAW },
  { label: 'C64', colors: PALETTE_C64_RAW },
  { label: 'Sweetie 16', colors: PALETTE_SWEETIE_16_RAW },
];

// --- GPU dither presets ---

export type PresetCategory = 'retro' | 'print' | 'atmospheric' | 'artistic';

export interface DitherPreset {
  label: string;
  family: 'ordered' | 'halftone' | 'pattern' | 'blue-noise';
  category: PresetCategory;
  config: DitherEffectConfig;
}

// ── Retro Console ─────────────────────────────────────────────────────

export const PRESET_GAMEBOY_CLASSIC: DitherPreset = {
  label: 'Game Boy Classic',
  family: 'ordered',
  category: 'retro',
  config: { algorithm: 'bayer', strength: 1, bayerSize: 4, scale: 2, paletteColors: PALETTE_GAMEBOY_RAW },
};

export const PRESET_PICO8_SCENE: DitherPreset = {
  label: 'PICO-8 Scene',
  family: 'ordered',
  category: 'retro',
  config: { algorithm: 'bayer', strength: 1, bayerSize: 8, contrast: 1.2, paletteColors: PALETTE_PICO8_RAW },
};

export const PRESET_C64_NOSTALGIA: DitherPreset = {
  label: 'C64 Nostalgia',
  family: 'ordered',
  category: 'retro',
  config: { algorithm: 'bayer', strength: 1, bayerSize: 4, paletteColors: PALETTE_C64_RAW },
};

export const PRESET_NOKIA_SCREEN: DitherPreset = {
  label: 'Nokia Screen',
  family: 'ordered',
  category: 'retro',
  config: { algorithm: 'bayer', strength: 1, bayerSize: 2, scale: 3, glow: 0.1, paletteColors: PALETTE_NOKIA_RAW },
};

export const PRESET_SWEETIE_BAYER: DitherPreset = {
  label: 'Sweetie 16',
  family: 'ordered',
  category: 'retro',
  config: { algorithm: 'bayer', strength: 0.9, bayerSize: 4, paletteColors: PALETTE_SWEETIE_16_RAW },
};

// ── Print / Halftone ──────────────────────────────────────────────────

export const PRESET_NEWSPAPER: DitherPreset = {
  label: 'Newspaper',
  family: 'halftone',
  category: 'print',
  config: { algorithm: 'halftone-dot', strength: 1, bayerSize: 8, scale: 2, paletteColors: PALETTE_1BIT_RAW },
};

export const PRESET_MAGAZINE_CMYK: DitherPreset = {
  label: 'Magazine CMYK',
  family: 'halftone',
  category: 'print',
  config: { algorithm: 'halftone-dot', strength: 1, bayerSize: 6, halftoneAngle: 15, paletteColors: PALETTE_CGA_RAW },
};

export const PRESET_CROSSHATCH_SKETCH: DitherPreset = {
  label: 'Crosshatch Sketch',
  family: 'pattern',
  category: 'print',
  config: { algorithm: 'crosshatch', strength: 1, bayerSize: 8, contrast: 1.5, paletteColors: PALETTE_1BIT_RAW },
};

export const PRESET_HALFTONE_LINE: DitherPreset = {
  label: 'Line Screen',
  family: 'halftone',
  category: 'print',
  config: { algorithm: 'halftone-line', strength: 1, bayerSize: 6, halftoneAngle: 30, paletteColors: PALETTE_1BIT_RAW },
};

// ── Atmospheric ───────────────────────────────────────────────────────

export const PRESET_FILM_GRAIN: DitherPreset = {
  label: 'Film Grain',
  family: 'blue-noise',
  category: 'atmospheric',
  config: { algorithm: 'blue-noise', strength: 0.7, animated: true, animationSpeed: 2, paletteColors: PALETTE_GRAYSCALE_8_RAW },
};

export const PRESET_CRT_MONITOR: DitherPreset = {
  label: 'CRT Monitor',
  family: 'ordered',
  category: 'atmospheric',
  config: {
    algorithm: 'bayer', strength: 1, bayerSize: 2, animated: true, animationSpeed: 1,
    noiseMode: 3, glow: 0.15, chromatic: 0.005, paletteColors: PALETTE_CGA_RAW,
  },
};

export const PRESET_AMBER_TERMINAL: DitherPreset = {
  label: 'Amber Terminal',
  family: 'ordered',
  category: 'atmospheric',
  config: { algorithm: 'bayer', strength: 1, bayerSize: 4, glow: 0.2, paletteColors: PALETTE_AMBER_RAW },
};

export const PRESET_VHS_STATIC: DitherPreset = {
  label: 'VHS Static',
  family: 'blue-noise',
  category: 'atmospheric',
  config: {
    algorithm: 'blue-noise', strength: 0.8, animated: true, animationSpeed: 4,
    noiseMode: 1, chromatic: 0.008, paletteColors: PALETTE_GRAYSCALE_4_RAW,
  },
};

// ── Artistic ──────────────────────────────────────────────────────────

export const PRESET_STIPPLE_DRAWING: DitherPreset = {
  label: 'Stipple Drawing',
  family: 'pattern',
  category: 'artistic',
  config: { algorithm: 'stipple', strength: 1, gamma: 1.5, paletteColors: PALETTE_1BIT_RAW },
};

export const PRESET_HIGH_CONTRAST: DitherPreset = {
  label: 'High Contrast',
  family: 'ordered',
  category: 'artistic',
  config: { algorithm: 'bayer', strength: 1, bayerSize: 8, contrast: 2, paletteColors: PALETTE_1BIT_RAW },
};

export const PRESET_SOFT_ATKINSON: DitherPreset = {
  label: 'Soft Atkinson',
  family: 'blue-noise',
  category: 'artistic',
  config: { algorithm: 'blue-noise', strength: 0.6, brightness: 0.1, paletteColors: PALETTE_GRAYSCALE_4_RAW },
};

export const PRESET_DEPTH_STABLE: DitherPreset = {
  label: 'Depth-Stable Dots',
  family: 'pattern',
  category: 'artistic',
  config: { algorithm: 'stipple', strength: 0.9, depthAware: true, depthScale: 4, paletteColors: PALETTE_1BIT_RAW },
};

export const PRESET_DIAMOND_PLATE: DitherPreset = {
  label: 'Diamond Plate',
  family: 'halftone',
  category: 'artistic',
  config: { algorithm: 'halftone-diamond', strength: 1, bayerSize: 10, halftoneAngle: 45, paletteColors: PALETTE_1BIT_RAW },
};

// --- All presets ---

export const ALL_PRESETS: DitherPreset[] = [
  // Retro Console
  PRESET_GAMEBOY_CLASSIC,
  PRESET_PICO8_SCENE,
  PRESET_C64_NOSTALGIA,
  PRESET_NOKIA_SCREEN,
  PRESET_SWEETIE_BAYER,
  // Print / Halftone
  PRESET_NEWSPAPER,
  PRESET_MAGAZINE_CMYK,
  PRESET_CROSSHATCH_SKETCH,
  PRESET_HALFTONE_LINE,
  // Atmospheric
  PRESET_FILM_GRAIN,
  PRESET_CRT_MONITOR,
  PRESET_AMBER_TERMINAL,
  PRESET_VHS_STATIC,
  // Artistic
  PRESET_STIPPLE_DRAWING,
  PRESET_HIGH_CONTRAST,
  PRESET_SOFT_ATKINSON,
  PRESET_DEPTH_STABLE,
  PRESET_DIAMOND_PLATE,
];

export const PRESET_CATEGORIES: { label: string; category: PresetCategory }[] = [
  { label: 'Retro Console', category: 'retro' },
  { label: 'Print / Halftone', category: 'print' },
  { label: 'Atmospheric', category: 'atmospheric' },
  { label: 'Artistic', category: 'artistic' },
];

// --- Slider defaults ---

export const DEFAULT_STRENGTH = 1;
export const DEFAULT_SCALE = 1;
export const DEFAULT_ANIMATION_SPEED = 2;
export const DEFAULT_HALFTONE_ANGLE = 0;
export const DEFAULT_BAYER_SIZE = 8;
export const DEFAULT_BRIGHTNESS = 0;
export const DEFAULT_CONTRAST = 1;
export const DEFAULT_GAMMA = 1;
export const DEFAULT_THRESHOLD = 0.5;
