/**
 * Procedural fragment SDF particle silhouettes for 3D PFX library.
 *
 * Adapted from Chiro Visuals (Linear & HandCast abilities) for zero-texture rendering.
 * All math is GLSL ES 1.00 compatible, optimized for Android WebViews (TBDR Mali/Adreno GPUs)
 * using mediump precision guards and bounded instruction complexity.
 */

export const PFX_SDF_SHAPE_SOFT = 0
export const PFX_SDF_SHAPE_SMOKE = 1
export const PFX_SDF_SHAPE_STREAK = 2
export const PFX_SDF_SHAPE_LEAF = 3
export const PFX_SDF_SHAPE_CHIP = 4
export const PFX_SDF_SHAPE_RING = 5
export const PFX_SDF_SHAPE_BUBBLE = 6
export const PFX_SDF_SHAPE_DROPLET = 7
export const PFX_SDF_SHAPE_GLINT = 8

export type PfxSdfShapeKind =
  | 'soft'
  | 'smoke'
  | 'streak'
  | 'leaf'
  | 'chip'
  | 'ring'
  | 'bubble'
  | 'droplet'
  | 'glint'

export const PFX_SDF_SHAPE_INDEX_MAP: Record<PfxSdfShapeKind, number> = {
  soft: PFX_SDF_SHAPE_SOFT,
  smoke: PFX_SDF_SHAPE_SMOKE,
  streak: PFX_SDF_SHAPE_STREAK,
  leaf: PFX_SDF_SHAPE_LEAF,
  chip: PFX_SDF_SHAPE_CHIP,
  ring: PFX_SDF_SHAPE_RING,
  bubble: PFX_SDF_SHAPE_BUBBLE,
  droplet: PFX_SDF_SHAPE_DROPLET,
  glint: PFX_SDF_SHAPE_GLINT,
}

export const pfxSdfShapesGLSL = /* glsl */ `
#ifndef PFX_SDF_SHAPES_INCLUDED
#define PFX_SDF_SHAPES_INCLUDED

#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif

#ifndef PFX_MATH_HELPERS_DEFINED
#define PFX_MATH_HELPERS_DEFINED

float pfxHash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec2 pfxHash21(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

mat2 pfxRot2(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// 2D simplex-style procedural noise for mobile TBDR efficiency
float pfxSimplex2D(vec2 p) {
  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
  const float K2 = 0.211324865; // (3-sqrt(3))/6;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(
    dot(a, pfxHash21(dot(i, vec2(12.9898, 78.233))) * 2.0 - 1.0),
    dot(b, pfxHash21(dot(i + o, vec2(12.9898, 78.233))) * 2.0 - 1.0),
    dot(c, pfxHash21(dot(i + 1.0, vec2(12.9898, 78.233))) * 2.0 - 1.0)
  );
  return dot(n, vec3(70.0));
}

float pfxFbm2(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 2; i++) {
    v += a * pfxSimplex2D(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

#endif // PFX_MATH_HELPERS_DEFINED

/**
 * Evaluates the procedural shape mask for normalized UVs [0..1].
 * Returns coverage [0..1] and optional white hilite [0..1].
 */
float pfxSampleShapeMask(int shapeIndex, vec2 uv, float seed, float time, float lifeProgress, out float hilite) {
  vec2 c = (uv - 0.5) * 2.0;
  float d = length(c);
  hilite = 0.0;

  // SHAPE 0: SOFT
  if (shapeIndex == 0) {
    return smoothstep(1.0, 0.0, d);
  }

  // SHAPE 1: SMOKE (fractal noise displacement)
  if (shapeIndex == 1) {
    float n = pfxFbm2(c * 1.6 + vec2(seed * 7.1, time * 0.15));
    return smoothstep(1.0, 0.05, d + n * 0.42) * 0.9;
  }

  // SHAPE 2: STREAK (elongated core)
  if (shapeIndex == 2) {
    float core = smoothstep(1.0, 0.0, abs(c.x) * 3.4);
    float len = smoothstep(1.0, 0.0, abs(c.y));
    return core * len;
  }

  // SHAPE 3: LEAF (tapered vane with central spine)
  if (shapeIndex == 3) {
    float w = max(0.0, 1.0 - c.y * c.y);
    float body = smoothstep(w * 0.62, w * 0.30, abs(c.x));
    float vein = smoothstep(0.06, 0.0, abs(c.x)) * 0.35;
    return clamp(body - vein * 0.4, 0.0, 1.0);
  }

  // SHAPE 4: CHIP (angular faceted rock/crystal splinter)
  if (shapeIndex == 4) {
    float ang = atan(c.y, c.x);
    float r = 0.62 + 0.24 * sin(ang * 5.0 + seed * 30.0) + 0.1 * sin(ang * 9.0 - seed * 11.0);
    return smoothstep(r, r - 0.14, d);
  }

  // SHAPE 5: RING (hollow annulus)
  if (shapeIndex == 5) {
    return smoothstep(0.14, 0.0, abs(d - 0.82));
  }

  // SHAPE 6: BUBBLE (thin rim, catchlight, pop expansion)
  if (shapeIndex == 6) {
    float pop = smoothstep(0.88, 1.0, lifeProgress);
    float r = mix(0.92, 1.30, pop);
    float outer = smoothstep(r, r - mix(0.07, 0.03, pop), d);
    float inner = smoothstep(r - mix(0.10, 0.05, pop), r - mix(0.21, 0.13, pop), d);
    float rim = clamp(outer - inner, 0.0, 1.0);
    float belly = inner * mix(0.12, 0.0, pop);
    vec2 lp = vec2(-0.34, 0.36) + (pfxHash21(seed * 91.0) - 0.5) * 0.2;
    float bounce = smoothstep(0.52, 0.12, length(c - vec2(0.22, -0.40))) * 0.26 * outer;
    hilite = smoothstep(0.17, 0.02, length(c - lp)) * (1.0 - pop) * 0.9 * outer;
    return clamp(rim + belly + bounce + hilite, 0.0, 1.0);
  }

  // SHAPE 7: DROPLET (internal refraction, limb darkening, specular catchlight)
  if (shapeIndex == 7) {
    float body = smoothstep(1.0, 0.9, d);
    vec2 lp = vec2(-0.34, 0.36) + (pfxHash21(seed * 71.0) - 0.5) * 0.16;
    hilite = smoothstep(0.26, 0.03, length(c - lp)) * body;
    float limb = smoothstep(0.45, 0.95, d) * 0.5;
    vec2 normC = c / max(d, 1e-4);
    float back = smoothstep(0.62, 1.0, d) * smoothstep(-0.2, 0.9, dot(normC, -normalize(lp)));
    return clamp(body * (1.0 - limb) + hilite * 0.9 + back * body * 0.55, 0.0, 1.0);
  }

  // SHAPE 8: GLINT (4-point sparkle with twinkling clock)
  if (shapeIndex == 8) {
    float core = pow(1.0 - smoothstep(0.0, 0.34, d), 3.0);
    vec2 a = abs(c);
    float spike = (1.0 - smoothstep(0.0, 0.055, a.y)) * (1.0 - smoothstep(0.12, 1.0, a.x))
                + (1.0 - smoothstep(0.0, 0.055, a.x)) * (1.0 - smoothstep(0.12, 1.0, a.y));
    vec2 dg = abs(pfxRot2(0.78539816) * c);
    float diag = (1.0 - smoothstep(0.0, 0.05, dg.y)) * (1.0 - smoothstep(0.10, 0.70, dg.x))
               + (1.0 - smoothstep(0.0, 0.05, dg.x)) * (1.0 - smoothstep(0.10, 0.70, dg.y));
    float rate = 6.0 + pfxHash11(seed * 13.0) * 14.0;
    float twinkle = 0.42 + 0.58 * pow(abs(sin(time * rate + seed * 41.0)), 2.0);
    hilite = core * 0.95;
    return clamp(core + (spike * 0.8 + diag * 0.4) * twinkle, 0.0, 1.0);
  }

  return smoothstep(1.0, 0.0, d);
}

#endif // PFX_SDF_SHAPES_INCLUDED
`
