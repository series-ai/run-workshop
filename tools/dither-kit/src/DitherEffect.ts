// ── Dither Effect (GPU) ───────────────────────────────────────────────
// Pure TypeScript: config, uniform generation, GLSL shader strings.
// No Three.js imports — testable in jsdom.

export type GpuDitherAlgorithm =
  | 'bayer'
  | 'blue-noise'
  | 'halftone-dot'
  | 'halftone-line'
  | 'halftone-diamond'
  | 'crosshatch'
  | 'stipple';

export const GPU_DITHER_ALGORITHMS: GpuDitherAlgorithm[] = [
  'bayer', 'blue-noise', 'halftone-dot', 'halftone-line',
  'halftone-diamond', 'crosshatch', 'stipple',
];

export type CompareCellAlgorithm = GpuDitherAlgorithm | 'original';

/** Compare grid: split the screen into cells, each with its own algorithm. */
export interface CompareGridConfig {
  cols: number;                            // 1-4
  rows: number;                            // 1-2
  algorithms: CompareCellAlgorithm[];      // row-major, bottom row first (uv space), length cols*rows, max 8
  noiseModes?: number[];                   // optional per-cell noiseMode override, same layout
  animated?: boolean[];                    // optional per-cell animated override, same layout
}

/** Radial mask that fades dithering to the undithered source around a point. */
export interface ResolveMaskConfig {
  center: [number, number];                // uv space, 0-1
  radius: number;                          // uv units; 0 disables
}

export interface DitherEffectConfig {
  algorithm: GpuDitherAlgorithm;
  strength: number;           // 0-1
  paletteColors?: number[][]; // [[r,g,b], ...] 0-255
  paletteSize?: number;       // actual palette size (auto-detected from paletteColors if omitted)
  scale?: number;             // pixel scaling factor (default: 1)
  animated?: boolean;
  animationSpeed?: number;    // cycles per second (default: 1)
  halftoneAngle?: number;     // degrees (default: 0)
  bayerSize?: number;         // 2, 4, or 8 (default: 8)
  brightness?: number;        // pre-dither brightness offset (-1 to 1, default: 0)
  contrast?: number;          // pre-dither contrast multiplier (0-3, default: 1)
  gamma?: number;             // pre-dither gamma correction (0.2-5, default: 1)
  threshold?: number;         // luminance threshold bias (0-1, default: 0.5)
  noiseMode?: number;         // temporal noise (0=none, 1=time-shift, 2=perlin, 3=scanline)
  chromatic?: number;         // post-dither chromatic aberration offset (0-0.02, default: 0)
  glow?: number;              // post-dither glow/bloom amount (0-1, default: 0)
  depthAware?: boolean;       // depth-based scale for surface-stable-ish dithering
  depthScale?: number;        // depth influence multiplier (0-10, default: 3)
  compare?: CompareGridConfig | null;   // split-screen algorithm comparison (default: off)
  resolve?: ResolveMaskConfig | null;   // cursor-following resolve mask (default: off)
}

const MAX_PALETTE_SIZE = 32;

// --- Algorithm ID mapping for GLSL ---
const ALGORITHM_IDS: Record<GpuDitherAlgorithm, number> = {
  'bayer': 0,
  'blue-noise': 1,
  'halftone-dot': 2,
  'halftone-line': 3,
  'halftone-diamond': 4,
  'crosshatch': 5,
  'stipple': 6,
};

export const MAX_COMPARE_CELLS = 8;

const COMPARE_ALGORITHM_IDS: Record<CompareCellAlgorithm, number> = {
  ...ALGORITHM_IDS,
  'original': 7, // passthrough: undithered source
};

// --- Uniform generation ---

export function getDitherUniforms(config: DitherEffectConfig): Record<string, { value: number | Float32Array }> {
  const paletteColors = config.paletteColors ?? [[0, 0, 0], [255, 255, 255]];
  const paletteSize = config.paletteSize ?? paletteColors.length;

  // Flatten palette to Float32Array (vec3 per color, normalized to 0-1)
  const paletteData = new Float32Array(MAX_PALETTE_SIZE * 3);
  for (let i = 0; i < Math.min(paletteSize, MAX_PALETTE_SIZE); i++) {
    const c = paletteColors[i] ?? [0, 0, 0];
    paletteData[i * 3] = c[0]! / 255;
    paletteData[i * 3 + 1] = c[1]! / 255;
    paletteData[i * 3 + 2] = c[2]! / 255;
  }

  const compare = config.compare ?? null;
  const cellAlgorithms = new Float32Array(MAX_COMPARE_CELLS);
  const cellNoiseModes = new Float32Array(MAX_COMPARE_CELLS);
  const cellAnimated = new Float32Array(MAX_COMPARE_CELLS);
  if (compare) {
    const count = Math.min(compare.algorithms.length, MAX_COMPARE_CELLS);
    for (let i = 0; i < count; i++) {
      cellAlgorithms[i] = COMPARE_ALGORITHM_IDS[compare.algorithms[i]!];
      cellNoiseModes[i] = compare.noiseModes?.[i] ?? config.noiseMode ?? 0;
      cellAnimated[i] = (compare.animated?.[i] ?? config.animated) ? 1 : 0;
    }
  }

  return {
    uAlgorithm: { value: ALGORITHM_IDS[config.algorithm] },
    uStrength: { value: config.strength },
    uScale: { value: config.scale ?? 1 },
    uTime: { value: 0 },
    uAnimated: { value: config.animated ? 1 : 0 },
    uAnimationSpeed: { value: config.animationSpeed ?? 1 },
    uPalette: { value: paletteData },
    uPaletteSize: { value: Math.min(paletteSize, MAX_PALETTE_SIZE) },
    uHalftoneAngle: { value: (config.halftoneAngle ?? 0) * Math.PI / 180 },
    uBayerSize: { value: config.bayerSize ?? 8 },
    uBrightness: { value: config.brightness ?? 0 },
    uContrast: { value: config.contrast ?? 1 },
    uGamma: { value: config.gamma ?? 1 },
    uThreshold: { value: config.threshold ?? 0.5 },
    uNoiseMode: { value: config.noiseMode ?? 0 },
    uChromatic: { value: config.chromatic ?? 0 },
    uGlow: { value: config.glow ?? 0 },
    uDepthAware: { value: config.depthAware ? 1 : 0 },
    uDepthScale: { value: config.depthScale ?? 3 },
    uCompareEnabled: { value: compare ? 1 : 0 },
    uCompareCols: { value: compare?.cols ?? 1 },
    uCompareRows: { value: compare?.rows ?? 1 },
    uCellAlgorithms: { value: cellAlgorithms },
    uCellNoiseModes: { value: cellNoiseModes },
    uCellAnimated: { value: cellAnimated },
    uResolveCenter: { value: new Float32Array(config.resolve?.center ?? [0.5, 0.5]) },
    uResolveRadius: { value: config.resolve?.radius ?? 0 },
  };
}

export function updateDitherUniforms(
  uniforms: Record<string, { value: number | Float32Array }>,
  dt: number,
): void {
  const time = uniforms['uTime'];
  if (time && typeof time.value === 'number') {
    time.value += dt;
  }
}

// --- GLSL Fragment Shader ---

export const DITHER_FRAGMENT_SHADER = /* glsl */ `
  uniform float uAlgorithm;
  uniform float uStrength;
  uniform float uScale;
  uniform float uTime;
  uniform float uAnimated;
  uniform float uAnimationSpeed;
  uniform vec3 uPalette[${MAX_PALETTE_SIZE}];
  uniform int uPaletteSize;
  uniform float uHalftoneAngle;
  uniform float uBayerSize;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uGamma;
  uniform float uThreshold;
  uniform float uNoiseMode;
  uniform float uChromatic;
  uniform float uGlow;
  uniform float uDepthAware;
  uniform float uDepthScale;
  uniform float uCompareEnabled;
  uniform float uCompareCols;
  uniform float uCompareRows;
  uniform float uCellAlgorithms[8];
  uniform float uCellNoiseModes[8];
  uniform float uCellAnimated[8];
  uniform vec2 uResolveCenter;
  uniform float uResolveRadius;

  // --- Hash functions ---

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // --- Perlin-like noise ---

  float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // --- Bayer matrix (procedural) ---

  float bayerValue(vec2 pos, float size) {
    float result = 0.0;
    float s = size;
    vec2 p = mod(pos, size);
    while (s > 1.0) {
      s *= 0.5;
      float qx = step(s, mod(p.x, s * 2.0));
      float qy = step(s, mod(p.y, s * 2.0));
      // Bayer quadrant: [0,1; 3,2] encoding
      result = result * 4.0 + (qx + qy * 2.0 - qx * qy * 2.0 + qy);
    }
    return result / (size * size);
  }

  // --- Nearest palette color ---

  vec3 nearestPaletteColor(vec3 color) {
    float bestDist = 1e10;
    vec3 best = vec3(0.0);
    for (int i = 0; i < ${MAX_PALETTE_SIZE}; i++) {
      if (i >= uPaletteSize) break;
      vec3 diff = color - uPalette[i];
      float dist = dot(diff, diff);
      if (dist < bestDist) {
        bestDist = dist;
        best = uPalette[i];
      }
    }
    return best;
  }

  // --- Temporal noise offset based on noiseMode ---

  float getNoiseOffset(vec2 pixelCoord, int mode, float animated) {
    if (mode == 0) {
      // None — use basic animated time shift if animated
      return animated > 0.5 ? fract(uTime * uAnimationSpeed) : 0.0;
    }
    else if (mode == 1) {
      // Time-shift: simple frame-based offset
      return animated > 0.5 ? fract(uTime * uAnimationSpeed * 0.7 + hash21(pixelCoord * 0.01)) : 0.0;
    }
    else if (mode == 2) {
      // Perlin: smooth temporal noise
      return animated > 0.5 ? perlinNoise(pixelCoord * 0.05 + uTime * uAnimationSpeed) : 0.0;
    }
    else {
      // Scanline: horizontal scan offset
      return animated > 0.5 ? fract(pixelCoord.y * 0.01 + uTime * uAnimationSpeed) * 0.5 : 0.0;
    }
  }

  // --- Threshold computation per algorithm ---

  float getThreshold(vec2 pixelCoord, int algo, int noiseMode, float animated) {
    float timeOffset = getNoiseOffset(pixelCoord, noiseMode, animated);

    if (algo == 0) {
      // Bayer
      return fract(bayerValue(pixelCoord, uBayerSize) + timeOffset);
    }
    else if (algo == 1) {
      // Blue noise (interleaved gradient noise)
      vec2 p = pixelCoord + timeOffset * 17.0;
      return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
    }
    else if (algo == 2 || algo == 3 || algo == 4) {
      // Halftone (dot=2, line=3, diamond=4)
      float c = cos(uHalftoneAngle);
      float s = sin(uHalftoneAngle);
      vec2 rotated = vec2(
        pixelCoord.x * c - pixelCoord.y * s,
        pixelCoord.x * s + pixelCoord.y * c
      );
      float cellSize = uBayerSize; // reuse as dot size
      vec2 cell = mod(rotated, cellSize) / cellSize * 2.0 - 1.0;

      float dist;
      if (algo == 2) {
        dist = length(cell); // dot
      } else if (algo == 3) {
        dist = abs(cell.y);  // line
      } else {
        dist = abs(cell.x) + abs(cell.y); // diamond
      }
      return fract(min(dist / 1.414, 0.999) + timeOffset);
    }
    else if (algo == 5) {
      // Crosshatch
      float size = uBayerSize;
      float d1 = mod(pixelCoord.x + pixelCoord.y, size) / size;
      float d2 = mod(pixelCoord.x - pixelCoord.y + size, size) / size;
      return fract(min(d1, d2) + timeOffset);
    }
    else {
      // Stipple (algo == 6)
      return fract(hash21(pixelCoord) + timeOffset);
    }
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 resolution = vec2(textureSize(inputBuffer, 0));

    // Compare grid: override algorithm + noise mode per screen cell.
    int algo = int(uAlgorithm);
    int noiseMode = int(uNoiseMode);
    float animated = uAnimated;
    if (uCompareEnabled > 0.5) {
      ivec2 cell = ivec2(floor(uv.x * uCompareCols), floor(uv.y * uCompareRows));
      cell = clamp(cell, ivec2(0), ivec2(int(uCompareCols) - 1, int(uCompareRows) - 1));
      int cellIndex = min(cell.y * int(uCompareCols) + cell.x, 7);
      algo = int(uCellAlgorithms[cellIndex]);
      noiseMode = int(uCellNoiseModes[cellIndex]);
      animated = uCellAnimated[cellIndex];
    }

    // Depth-aware scale: read depth buffer and adjust dither scale by distance.
    // Approximates surface-stable dithering — nearby objects get finer patterns,
    // distant objects get coarser, so dot density tracks surface area.
    float effectiveScale = uScale;
    #ifdef DEPTH_TEXTURE
    if (uDepthAware > 0.5) {
      float depth = texture2D(depthTexture, uv).r;
      // Linearize depth (0=near, 1=far) and scale dither pattern
      float depthFactor = 1.0 + depth * uDepthScale;
      effectiveScale = uScale * depthFactor;
    }
    #endif

    // Apply pixel scaling
    vec2 pixelCoord = floor(uv * resolution / effectiveScale) * effectiveScale;

    // Sample input (use scaled coordinates for pixelated look)
    vec2 scaledUv = (floor(uv * resolution / effectiveScale) + 0.5) * effectiveScale / resolution;
    vec3 color = texture2D(inputBuffer, scaledUv).rgb;

    // Pre-processing: brightness, contrast, gamma
    color = clamp((color - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
    if (uGamma != 1.0) {
      color = pow(color, vec3(1.0 / uGamma));
    }

    // Luminance threshold: bias dither strength based on luminance
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    float thresholdBias = smoothstep(uThreshold - 0.3, uThreshold + 0.3, lum);
    float effectiveStrength = uStrength * mix(1.0, thresholdBias, step(0.01, abs(uThreshold - 0.5)));

    // Get threshold and compute bias
    float thresh = getThreshold(pixelCoord, algo, noiseMode, animated);
    float ditherStep = 1.0 / max(float(uPaletteSize) - 1.0, 1.0);
    float spread = effectiveStrength * ditherStep * 0.5;
    vec3 biased = color + vec3((thresh - 0.5) * spread);

    // algo == 7 is the passthrough "original" pseudo-algorithm (undithered
    // source). No early return: borders and the resolve mask must still apply.
    vec3 dithered = algo == 7 ? texture2D(inputBuffer, uv).rgb : nearestPaletteColor(biased);

    // Post-processing: chromatic aberration (offset R and B channels)
    if (uChromatic > 0.001 && algo != 7) {
      vec2 chrOffset = vec2(uChromatic, 0.0);
      vec3 colorR = texture2D(inputBuffer, scaledUv + chrOffset).rgb;
      colorR = clamp((colorR - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
      vec3 biasedR = colorR + vec3((thresh - 0.5) * spread);
      vec3 colorB = texture2D(inputBuffer, scaledUv - chrOffset).rgb;
      colorB = clamp((colorB - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
      vec3 biasedB = colorB + vec3((thresh - 0.5) * spread);
      dithered.r = nearestPaletteColor(biasedR).r;
      dithered.b = nearestPaletteColor(biasedB).b;
    }

    // Post-processing: glow (additive blend of original color)
    if (uGlow > 0.001 && algo != 7) {
      vec3 original = texture2D(inputBuffer, uv).rgb;
      dithered = mix(dithered, dithered + original * uGlow, uGlow);
      dithered = clamp(dithered, 0.0, 1.0);
    }

    // Compare grid cell borders.
    if (uCompareEnabled > 0.5) {
      vec2 cellUv = vec2(fract(uv.x * uCompareCols), fract(uv.y * uCompareRows));
      float border = step(cellUv.x, 0.003) + step(0.997, cellUv.x)
                   + step(cellUv.y, 0.006) + step(0.994, cellUv.y);
      dithered = mix(dithered, vec3(0.0), clamp(border, 0.0, 1.0));
    }

    // Cursor resolve mask: fade to the undithered source near the pointer.
    if (uResolveRadius > 0.001) {
      float dist = distance(uv, uResolveCenter);
      float mask = smoothstep(uResolveRadius, uResolveRadius * 0.75, dist);
      vec3 original = texture2D(inputBuffer, uv).rgb;
      dithered = mix(dithered, original, mask);
    }

    outputColor = vec4(dithered, inputColor.a);
  }
`;
