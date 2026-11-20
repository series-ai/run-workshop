// Shared GLSL chunks. All colours are display-referred sRGB: the painter's
// palette is mixed directly, so no tone mapping or colour-space pass runs.

export const GLSL_NOISE = /* glsl */ `
#define K_PI 3.14159265359
#define K_TAU 6.28318530718
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash23(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = r * p * 2.03 + vec2(17.1, 31.7); a *= 0.5; }
  return v;
}
float vnoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i), n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0)), n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0)), n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0)), n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm3(vec3 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise3(p); p = p.yzx * 2.07 + vec3(11.3, 5.7, 23.1); a *= 0.5; }
  return v;
}
`;

/**
 * Brush-dab layer. One jittered dab lives in each cell of a chart grid. The
 * dab is an oriented super-ellipse that slides along the flow direction,
 * grows, and shrinks over its life. The top dab that covers the fragment wins.
 *
 * mode 'tex': flow and colour come from baked field textures at the dab centre
 *             (tFlow, tColor), so each dab has one flat pigment colour.
 * mode 'var': flow and colour come from the globals gFlow and gColor that the
 *             caller sets from varyings.
 *
 * Returns rgb = paint colour, a = paint height for the impasto relief pass.
 */
export function strokeFn(name: string, mode: 'tex' | 'var'): string {
  const flow = mode === 'tex' ? 'textureLod(tFlow, cuv, 0.0)' : 'gFlow';
  const color = mode === 'tex' ? 'textureLod(tColor, cuv, 0.0).rgb' : 'gColor';
  return /* glsl */ `
vec4 ${name}(vec2 q, vec2 inv, float wrapN, float px, float seed, vec4 shape, vec4 jit, float t, vec4 under) {
  vec2 ig = floor(q);
  float best = -1.0; vec2 bc = vec2(0.0); vec3 bh = vec3(0.0);
  float bm = 0.0; vec2 be = vec2(0.0); float bw = 1.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = ig + vec2(float(i), float(j));
      vec2 hc = c;
      if (wrapN > 0.5) hc.x = mod(hc.x, wrapN);
      vec3 h = hash23(hc + seed);
      if (h.x > shape.z) continue;
      vec2 base = c + 0.5 + (h.yz - 0.5) * 0.5;
      vec2 cuv = base * inv;
      vec4 fl = ${flow};
      vec2 dir = fl.rg * 2.0 - 1.0;
      dir /= max(length(dir), 1e-3);
      float hh = fract(h.x * 91.7 + h.y * 37.3);
      float life = fract(t * shape.w * (0.6 + 0.8 * hh) * (0.35 + fl.a) + hh * 17.0);
      float grow = smoothstep(0.0, 0.2, life) * smoothstep(1.0, 0.8, life);
      vec2 ctr = base + dir * (life - 0.5) * 0.3;
      vec2 d = q - ctr;
      float a = dot(d, dir);
      float b = dot(d, vec2(-dir.y, dir.x));
      float sz = (0.45 + 1.1 * fl.b) * grow;
      float L = shape.x * (0.8 + 0.3 * h.y) * sz + 1e-4;
      float W = shape.y * (0.75 + 0.5 * h.z) * sz + 1e-4;
      float ea = a / L; float eb = b / W;
      float m = 1.0 - (ea * ea * ea * ea + eb * eb);
      float pri = fract(h.x * 7.31 + h.z * 3.17 + h.y);
      if (m > 0.0 && pri > best) { best = pri; bc = ctr; bh = h; bm = m; be = vec2(ea, eb); bw = W; }
    }
  }
  if (best < 0.0) return under;
  vec2 cuv = bc * inv;
  vec3 col = ${color};
  float r1 = fract(bh.x * 53.1 + bh.y * 11.7);
  float r2 = fract(bh.z * 29.3 + bh.x * 3.3);
  float r3 = fract(bh.y * 71.9 + bh.z * 13.1);
  col *= 1.0 + jit.x * (r1 - 0.5) * 2.0;
  col = mix(col, col.brg, jit.w * (r2 - 0.5));
  if (r3 < jit.y) col = mix(col, gAccent, 0.5);
  else if (r3 > 1.0 - jit.z) col *= 0.52;
  float bris = vnoise(vec2(be.y * bw * 26.0 + r1 * 40.0, be.x * 1.2 + r2 * 9.0));
  col *= 0.9 + 0.2 * bris;
  col *= 0.8 + 0.2 * smoothstep(0.0, 0.3, bm);
  float alpha = clamp(bm * bw / (px * 1.6 + 1e-5), 0.0, 1.0);
  float hgt = pow(bm, 0.4) * (0.5 + 0.5 * bris);
  return vec4(mix(under.rgb, col, alpha), mix(under.a, hgt, alpha));
}
`;
}

/** Fullscreen-triangle vertex shader for post passes. */
export const POST_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Helpers every post pass shares: linear depth, canvas weave, vignette. */
export const POST_COMMON = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uTime;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;
float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
// Second difference of depth: zero on a tilted plane, large on a silhouette.
float depthEdge(vec2 uv, vec2 o) {
  float d0 = linDepth(uv);
  float dx = abs(linDepth(uv + vec2(o.x, 0.0)) + linDepth(uv - vec2(o.x, 0.0)) - 2.0 * d0);
  float dy = abs(linDepth(uv + vec2(0.0, o.y)) + linDepth(uv - vec2(0.0, o.y)) - 2.0 * d0);
  return max(dx, dy) / d0;
}
float canvasWeave(vec2 p) {
  float warp = sin(p.x * 2.2) * 0.5 + 0.5;
  float weft = sin(p.y * 2.2) * 0.5 + 0.5;
  float over = step(0.5, fract((floor(p.x * 0.35014) + floor(p.y * 0.35014)) * 0.5));
  return mix(warp, weft, over) * 0.7 + 0.3 * vnoise(p * 0.9);
}
float vignette(vec2 uv, float k) {
  vec2 c = uv - 0.5;
  return 1.0 - k * dot(c, c) * 1.6;
}
`;
