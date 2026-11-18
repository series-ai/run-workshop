// Birch Forest — Gustav Klimt, 1903.
//
// A real stand of birches on a floor of fallen leaves. The floor has two
// layers. The far layer is a mosaic of flat dabs laid in a chart projected
// from the painting's viewpoint, with octave selection, so the dabs keep one
// size on the canvas to the horizon. The near layer is a carpet of instanced
// leaf dabs that wraps around the point the eye looks at. Both layers take
// their pigment from one colour field. The trunks are instanced tubes with a
// procedural bark: lenticels, branch scars, a rough dark foot, and moss.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, hex, mix3, mulberry32, noise3, smoothstep, type RGB } from '../util';

const DEG = Math.PI / 180;
const HERO = new THREE.Vector3(0, 1.65, 10);
const SUN = new THREE.Vector3(0.42, 0.6, -0.68).normalize();
const LEAF_TILE = 26;
const LEAF_COUNT = 160000;
const FALLING = 420;
const FALL_HEIGHT = 13;

function groundH(x: number, z: number): number {
  return 0.24 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.4) + 0.14 * Math.sin(x * 0.23 + z * 0.17 + 2.1) + 0.07 * Math.sin(z * 0.43 - x * 0.31);
}

// ---------------------------------------------------------------------------
// Shared GLSL: ground height, air, sun flecks, and the leaf pigment field.
// ---------------------------------------------------------------------------

const FOREST = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uSun;
uniform float uTime;
float groundH(vec2 p) {
  return 0.24 * sin(p.x * 0.11 + 1.3) * cos(p.y * 0.09 + 0.4) + 0.14 * sin(p.x * 0.23 + p.y * 0.17 + 2.1) + 0.07 * sin(p.y * 0.43 - p.x * 0.31);
}
vec3 haze(vec3 col, vec3 wp) {
  float f = 1.0 - exp(-length(wp - uCam) * 0.012);
  return mix(col, vec3(0.37, 0.25, 0.20), f * 0.9);
}
// Sun flecks that come through the canopy and move slowly.
float dapple(vec3 wp) {
  vec2 q = wp.xz - uSun.xz * (wp.y / uSun.y);
  float n = vnoise(q * 0.21 + vec2(uTime * 0.012, 0.0)) * 0.62 + vnoise(q * 0.63 + vec2(3.7, uTime * 0.02)) * 0.38;
  return smoothstep(0.40, 0.62, n);
}
// One flat pigment for a leaf dab at ground point p. h holds three random numbers of the dab.
vec3 leafPigment(vec2 p, vec3 h) {
  float big = vnoise(p * 0.13 + 3.1) * 0.6 + vnoise(p * 0.37 + 7.7) * 0.4;
  float mid = vnoise(p * 1.1 + 11.0);
  float t = clamp(big * 0.9 + mid * 0.3 + (h.x - 0.5) * 0.8 - 0.1, 0.0, 1.0);
  vec3 c = mix(vec3(0.47, 0.15, 0.07), vec3(0.69, 0.27, 0.09), smoothstep(0.0, 0.35, t));
  c = mix(c, vec3(0.87, 0.44, 0.12), smoothstep(0.3, 0.6, t));
  c = mix(c, vec3(0.94, 0.66, 0.21), smoothstep(0.62, 0.95, t));
  float moss = smoothstep(0.52, 0.74, vnoise(p * 0.22 + 40.0));
  if (h.y < 0.03 + 0.17 * moss) c = mix(vec3(0.34, 0.36, 0.14), vec3(0.58, 0.52, 0.18), h.z);
  else if (h.y > 0.945) c = mix(vec3(0.26, 0.11, 0.08), vec3(0.27, 0.15, 0.20), h.z);
  else if (h.y > 0.88) c = vec3(0.97, 0.80, 0.40);
  return c * (0.9 + 0.2 * h.z);
}
vec3 sunTint(vec3 c, float d) {
  return c * mix(vec3(0.60, 0.56, 0.66), vec3(1.10, 1.04, 0.92), d);
}
`;

/**
 * A layer of flat mosaic dabs. One jittered dab lives in each chart cell and
 * the top dab that covers the fragment wins. colorExpr gives the pigment from
 * the dab centre bc (chart cells) and its random numbers bh.
 */
function dabFn(name: string, colorExpr: string): string {
  return /* glsl */ `
vec4 ${name}(vec2 q, float D, float px, float seed, vec4 under) {
  // A dab reaches at most 0.57 cells from its centre and the centre lies in the
  // middle half of its cell, so only the four nearest cells can cover q.
  vec2 ig = floor(q - 0.5);
  float best = -1.0; vec2 bc = vec2(0.0); vec3 bh = vec3(0.0); float bm = 0.0;
  for (int j = 0; j <= 1; j++) {
    for (int i = 0; i <= 1; i++) {
      vec2 c = ig + vec2(float(i), float(j));
      vec3 h = hash23(c + seed);
      vec2 ctr = c + 0.5 + (h.yz - 0.5) * 0.5;
      float ang = h.x * 6.2832;
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 d = q - ctr;
      float ea = dot(d, dir) / (0.42 + 0.1 * h.y);
      float eb = dot(d, vec2(-dir.y, dir.x)) / (0.30 + 0.1 * h.z);
      float m = 1.0 - (ea * ea * ea * ea + eb * eb * eb * eb);
      float pri = fract(h.x * 7.31 + h.z * 3.17 + h.y);
      if (m > 0.0 && pri > best) { best = pri; bc = ctr; bh = h; bm = m; }
    }
  }
  if (best < 0.0) return under;
  vec3 col = ${colorExpr};
  col *= 0.84 + 0.16 * smoothstep(0.0, 0.35, bm);
  float alpha = clamp(bm * 0.4 / (px * 1.6 + 1e-5), 0.0, 1.0);
  return vec4(mix(under.rgb, col, alpha), mix(under.a, pow(bm, 0.4), alpha));
}
`;
}

// ---------------------------------------------------------------------------
// Sky dome: the far wall of the forest and the amber light behind it.
// ---------------------------------------------------------------------------

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
${GLSL_NOISE}
${FOREST}
uniform float uPixAngle;
varying vec3 vDir;
// Foliage of the far canopy at chart point p (azimuth, elevation in radians).
vec3 canopyPigment(vec2 p, vec3 h) {
  float e = degrees(p.y);
  float n = vnoise(vec2(p.x * 5.0, p.y * 7.0) + 2.0);
  float l = clamp(smoothstep(1.5, 20.0, e) * 0.72 + (n - 0.5) * 0.75 + (h.x - 0.5) * 0.5 + 0.06, 0.0, 1.0);
  vec3 c = mix(vec3(0.15, 0.12, 0.12), vec3(0.42, 0.19, 0.10), smoothstep(0.0, 0.3, l));
  c = mix(c, vec3(0.80, 0.45, 0.14), smoothstep(0.25, 0.55, l));
  c = mix(c, vec3(0.94, 0.70, 0.25), smoothstep(0.5, 0.8, l));
  c = mix(c, vec3(1.0, 0.90, 0.58), smoothstep(0.8, 1.0, l));
  if (h.y < 0.09) c = mix(c, vec3(0.17, 0.36, 0.31), 0.8);
  else if (h.y > 0.93) c = mix(c, vec3(0.84, 0.88, 0.80), 0.7 * smoothstep(8.0, 30.0, e));
  return c * (0.92 + 0.16 * h.z);
}
${dabFn('canopyDabs', 'canopyPigment(bc / D, bh)')}
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float e = degrees(el);
  vec2 ch = vec2(az, el);
  // Open sky: amber near the tree tops, pale at the zenith, warm around the sun.
  vec3 sky = mix(vec3(0.95, 0.80, 0.50), vec3(0.82, 0.85, 0.78), smoothstep(12.0, 75.0, e));
  sky = mix(sky, vec3(1.0, 0.94, 0.72), pow(max(dot(d, uSun), 0.0), 5.0) * 0.85);
  vec4 acc = vec4(canopyPigment(ch, vec3(0.5)) * 0.8, 0.1);
  float D = 36.0;
  acc = canopyDabs(ch * D, D, uPixAngle * D, 5.0, acc);
  acc = canopyDabs(ch * D * 2.1 + 0.4, D * 2.1, uPixAngle * D * 2.1, 61.0, acc);
  // The canopy opens with height: more sky shows between the dabs.
  float open = smoothstep(24.0, 80.0, e) * 0.85 * smoothstep(0.35, 0.65, vnoise(ch * 9.0 + 5.0));
  vec3 col = mix(acc.rgb, sky, open);
  // Far trunks: pale lines against the dark wall of the forest.
  float cw = 0.0085;
  float id = floor(az / cw);
  float f = fract(az / cw) - 0.5;
  float hh = hash11(id + 17.0);
  float w = 0.06 + 0.16 * hash11(id * 1.7 + 3.0);
  float trunk = step(hh, 0.5) * smoothstep(w, w * 0.4, abs(f + (hash11(id * 2.3) - 0.5) * 0.4));
  trunk *= 1.0 - smoothstep(5.0 + 9.0 * hash11(id * 3.1), 9.0 + 12.0 * hash11(id * 3.1), e);
  vec3 pale = vec3(0.66, 0.62, 0.56) * (0.75 + 0.3 * hash11(id * 5.3));
  pale *= 1.0 - 0.5 * step(0.72, hash21(vec2(id, floor(el * 520.0))));
  col = mix(col, pale, trunk * 0.8);
  // Below the horizon the dome takes the colour of the haze.
  col = mix(col, vec3(0.37, 0.25, 0.20), 1.0 - smoothstep(-1.5, 2.5, e));
  gl_FragColor = vec4(col, acc.a);
}
`;

// ---------------------------------------------------------------------------
// Forest floor
// ---------------------------------------------------------------------------

const GROUND_VERT = /* glsl */ `
${GLSL_NOISE}
${FOREST}
varying vec3 vWp;
void main() {
  vec3 p = vec3(position.x, groundH(position.xz), position.z);
  vWp = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const GROUND_FRAG = /* glsl */ `
${GLSL_NOISE}
${FOREST}
uniform vec3 uHero;
uniform float uPixRef;
uniform float uHeroShare;
varying vec3 vWp;
vec2 heroChart(vec3 wp) {
  vec3 p = wp - uHero;
  return vec2(atan(p.x, -p.z), atan(p.y, length(p.xz)));
}
// The ground point that a chart point looks at. The floor is taken as flat.
vec2 chartToGround(vec2 ch) {
  float d = uHero.y / max(tan(-ch.y), 2e-3);
  return uHero.xz + d * vec2(sin(ch.x), -cos(ch.x));
}
${dabFn('leafDabs', 'leafPigment(chartToGround(bc / D), bh)')}
${dabFn('groundDabs', 'leafPigment(bc / D, bh)')}
void main() {
  vec4 under = vec4(leafPigment(vWp.xz, vec3(0.3, 0.5, 0.4)) * 0.6, 0.1);
  vec4 acc = under;
  // Near the viewpoint of the painting the dabs lie in the chart of that view,
  // so they keep one size on the canvas to the horizon.
  if (uHeroShare > 0.001) {
    vec2 ch = heroChart(vWp);
    float pxr = clamp(length(fwidth(ch)) * 0.7, 1e-6, 0.05);
    // Octave selection keeps the dabs near one size on screen at any distance.
    float lod = log2(uPixRef / pxr);
    float k = floor(lod);
    float D = 76.0 * exp2(k);
    acc = leafDabs(ch * D, D, pxr * D, 13.0, acc);
    acc = leafDabs(ch * D * 2.0, D * 2.0, pxr * D * 2.0, 13.0, acc);
    vec4 fine = leafDabs(ch * D * 4.0, D * 4.0, pxr * D * 4.0, 13.0, acc);
    acc = mix(acc, fine, smoothstep(0.0, 1.0, lod - k));
  }
  // Away from it the dabs lie flat on the ground, so they are true from any side.
  if (uHeroShare < 0.999) {
    vec2 gx = dFdx(vWp.xz), gy = dFdy(vWp.xz);
    // Geometric mean of the two axes of the pixel footprint, in metres.
    float pxr = clamp(sqrt(abs(gx.x * gy.y - gx.y * gy.x)), 1e-5, 2.0);
    float lod = log2(1.0 / (13.0 * pxr));
    float k = floor(lod);
    float D = exp2(k);
    vec4 lay = groundDabs(vWp.xz * D, D, pxr * D, 13.0, under);
    lay = groundDabs(vWp.xz * D * 2.0, D * 2.0, pxr * D * 2.0, 13.0, lay);
    vec4 fine = groundDabs(vWp.xz * D * 4.0, D * 4.0, pxr * D * 4.0, 13.0, lay);
    lay = mix(lay, fine, smoothstep(0.0, 1.0, lod - k));
    acc = mix(lay, acc, uHeroShare);
  }
  vec3 col = sunTint(acc.rgb, dapple(vWp));
  gl_FragColor = vec4(haze(col, vWp), acc.a);
}
`;

// ---------------------------------------------------------------------------
// Leaf carpet: instanced dabs that wrap around the focus point. The pigment
// of each leaf is mixed once at load time; the tile repeats every 26 m.
//   aA: tile x, tile z, size, height above the ground
//   aB: cos yaw, sin yaw, tilt along x, tilt along z
//   aC: pigment.rgb, cup
// ---------------------------------------------------------------------------

const LEAF_VERT = /* glsl */ `
${GLSL_NOISE}
${FOREST}
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aC;
uniform vec2 uFocus;
varying vec3 vCol;
varying vec3 vWp;
varying vec2 vQ;
void main() {
  const float T = ${LEAF_TILE.toFixed(1)};
  vec2 rel = mod(aA.xy - uFocus + T * 0.5, T) - T * 0.5;
  vec2 xz = uFocus + rel;
  // Leaves shrink to nothing at the rim of the tile, so none appears at once.
  float size = aA.z * (1.0 - smoothstep(T * 0.36, T * 0.5, length(rel)));
  vec2 l = position.xz * vec2(1.0, 0.7) * size;
  vec2 r = vec2(aB.x * l.x - aB.y * l.y, aB.y * l.x + aB.x * l.y);
  // Each leaf lies at its own small height and tilt, with a slight cup.
  float y = groundH(xz) + aA.w + dot(r, aB.zw) + aC.w * dot(l, l) / max(size, 1e-4);
  vec3 wp = vec3(xz.x + r.x, y, xz.y + r.y);
  vWp = wp;
  vQ = position.xz;
  vCol = sunTint(aC.rgb, dapple(vec3(xz.x, y, xz.y)));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const LEAF_FRAG = /* glsl */ `
${GLSL_NOISE}
${FOREST}
varying vec3 vCol;
varying vec3 vWp;
varying vec2 vQ;
void main() {
  // A loaded dab: bristle streaks, a darker rim, a midrib, and veins that show only from close.
  float bristle = vnoise(vec2(vQ.x * 2.2 + vCol.g * 60.0, vQ.y * 7.0 + vCol.r * 40.0));
  float rim = smoothstep(0.5, 1.0, max(abs(vQ.x), abs(vQ.y) * 1.1));
  vec3 col = vCol * (0.93 + 0.14 * bristle) * (1.0 - 0.24 * rim);
  float fine = 1.0 - smoothstep(0.02, 0.07, fwidth(vQ.y));
  float vein = 1.0 - smoothstep(0.06, 0.16, abs(fract((abs(vQ.y) * 1.3 - vQ.x) * 3.0) - 0.5));
  col *= 1.0 - 0.1 * vein * fine;
  col *= 1.0 - 0.14 * (1.0 - smoothstep(0.0, 0.07, abs(vQ.y))) * (0.4 + 0.6 * fine);
  gl_FragColor = vec4(haze(col, vWp), 0.55 + 0.4 * bristle);
}
`;

/** Noise that repeats with the leaf tile, so the carpet has no seam where it wraps. */
function tileNoise(x: number, z: number, cells: number, seed: number): number {
  const fx = (x / LEAF_TILE) * cells, fz = (z / LEAF_TILE) * cells;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const ux = fx - ix, uz = fz - iz;
  const sx = ux * ux * (3 - 2 * ux), sz = uz * uz * (3 - 2 * uz);
  // Whole-number points give the raw lattice values, which fill the range 0 to 1.
  const at = (i: number, j: number): number => noise3(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, Math.floor(seed));
  const p = at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * sx;
  const q = at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * sx;
  return p + (q - p) * sz;
}

const mixRgb = (a: RGB, b: RGB, t: number): RGB => mix3(a, b, clamp(t, 0, 1));

/** The pigment of one leaf of the carpet. It follows the palette of leafPigment in the shader. */
function leafPigment(x: number, z: number, h: RGB): RGB {
  const big = tileNoise(x, z, 4, 3.1) * 0.6 + tileNoise(x, z, 9, 7.7) * 0.4;
  const mid = tileNoise(x, z, 28, 11.0);
  const t = clamp(big * 0.9 + mid * 0.3 + (h[0] - 0.5) * 0.8 - 0.1, 0, 1);
  let c = mixRgb([0.47, 0.15, 0.07], [0.69, 0.27, 0.09], smoothstep(0, 0.35, t));
  c = mixRgb(c, [0.87, 0.44, 0.12], smoothstep(0.3, 0.6, t));
  c = mixRgb(c, [0.94, 0.66, 0.21], smoothstep(0.62, 0.95, t));
  const moss = smoothstep(0.52, 0.74, tileNoise(x, z, 6, 40.0));
  if (h[1] < 0.03 + 0.17 * moss) c = mixRgb([0.34, 0.36, 0.14], [0.58, 0.52, 0.18], h[2]);
  else if (h[1] > 0.945) c = mixRgb([0.26, 0.11, 0.08], [0.27, 0.15, 0.2], h[2]);
  else if (h[1] > 0.88) c = [0.97, 0.8, 0.4];
  const k = 0.9 + 0.2 * h[2];
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** One leaf dab in the xz plane: broad near the stalk, with a pointed tip. */
const LEAF_OUTLINE = [-1, 0, 0, -0.72, 0, 0.56, -0.12, 0, 0.84, 0.52, 0, 0.58, 1, 0, 0, 0.52, 0, -0.58, -0.12, 0, -0.84, -0.72, 0, -0.56];
const LEAF_INDEX = [0, 1, 7, 1, 2, 7, 2, 6, 7, 2, 3, 6, 3, 5, 6, 3, 4, 5];

function buildLeafGeometry(count: number, rand: () => number): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const pos = LEAF_OUTLINE;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(LEAF_INDEX);
  const a = new Float32Array(count * 4);
  const b = new Float32Array(count * 4);
  const c = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const x = rand() * LEAF_TILE, z = rand() * LEAF_TILE;
    const yaw = rand() * Math.PI * 2;
    const tilt = (rand() - 0.5) * 0.3, tiltDir = rand() * Math.PI * 2;
    const h: RGB = [rand(), rand(), rand()];
    a.set([x, z, 0.044 + 0.036 * rand(), 0.012 + h[0] * 0.05], i * 4);
    b.set([Math.cos(yaw), Math.sin(yaw), Math.cos(tiltDir) * tilt, Math.sin(tiltDir) * tilt], i * 4);
    const col = leafPigment(x, z, h);
    c.set([col[0], col[1], col[2], (rand() - 0.3) * 0.3], i * 4);
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 4));
  g.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 4));
  g.instanceCount = count;
  return g;
}

// ---------------------------------------------------------------------------
// Falling leaves
//   aA: x, start height, z, size
//   aB: fall speed, phase, spin rate, colour index
// ---------------------------------------------------------------------------

const FALL_VERT = /* glsl */ `
${GLSL_NOISE}
${FOREST}
attribute vec4 aA;
attribute vec4 aB;
varying vec3 vCol;
varying vec3 vWp;
varying vec2 vQ;
void main() {
  const float H = ${FALL_HEIGHT.toFixed(1)};
  float fall = mod(aA.y - uTime * aB.x, H);
  vec2 drift = vec2(sin(uTime * 0.7 + aB.y) * 0.6 + 0.25 * sin(uTime * 1.9 + aB.y * 3.0), cos(uTime * 0.5 + aB.y * 1.3) * 0.6);
  vec3 c = vec3(aA.x + drift.x, groundH(aA.xz) + fall, aA.z + drift.y);
  float a1 = uTime * aB.z + aB.y * 5.0;
  float a2 = uTime * aB.z * 0.63 + aB.y * 9.0;
  vec3 e1 = normalize(vec3(cos(a1), 0.6 * sin(a2), sin(a1)));
  vec3 e2 = normalize(cross(e1, vec3(sin(a2 * 1.3), cos(a2 * 1.3), 0.35)));
  // A leaf appears at the top of its fall and settles into the carpet at the end.
  float size = aA.w * smoothstep(0.0, 0.5, fall) * (1.0 - smoothstep(H - 1.5, H, fall));
  // No leaf falls across the lens.
  size *= smoothstep(0.7, 2.0, distance(c, uCam));
  vec3 wp = c + (e1 * position.x + e2 * position.z * 0.7) * size;
  vWp = wp;
  vQ = position.xz;
  vec3 pig = aB.w < 0.4 ? vec3(0.95, 0.70, 0.22) : aB.w < 0.75 ? vec3(0.88, 0.47, 0.13) : aB.w < 0.92 ? vec3(0.70, 0.28, 0.10) : vec3(0.62, 0.60, 0.22);
  float face = abs(dot(cross(e1, e2), uSun));
  vCol = pig * (0.72 + 0.5 * face) * mix(0.8, 1.1, dapple(wp));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

function buildFallingGeometry(count: number, rand: () => number): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const pos = LEAF_OUTLINE;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(LEAF_INDEX);
  const a = new Float32Array(count * 4);
  const b = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    a[i * 4] = (rand() - 0.5) * 30;
    a[i * 4 + 1] = rand() * FALL_HEIGHT;
    a[i * 4 + 2] = -18 + rand() * 34;
    a[i * 4 + 3] = 0.06 + 0.04 * rand();
    b[i * 4] = 0.45 + 0.5 * rand();
    b[i * 4 + 1] = rand() * 6.28;
    b[i * 4 + 2] = 1.2 + 2.2 * rand();
    b[i * 4 + 3] = rand();
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 4));
  g.instanceCount = count;
  return g;
}

// ---------------------------------------------------------------------------
// Trunks. One record is one instance, stored as the instance matrix.
//   column 0: foot.xyz, radius
//   column 1: lean x, lean z (offset of the top), height, seed
//   column 2: bend x, bend z, moss amount, height of the rough dark foot
// ---------------------------------------------------------------------------

interface Trunk {
  x: number;
  z: number;
  r: number;
  height: number;
  leanX: number;
  leanZ: number;
}

/** Trunks placed by hand for the view of the painting: x, z, radius. */
const HERO_TRUNKS: Array<[number, number, number]> = [
  [-1.78, 6.55, 0.25],
  [-0.92, 3.5, 0.2],
  [2.25, 5.3, 0.17],
  [0.95, 0.1, 0.13],
  [-3.9, 1.9, 0.16],
  [4.4, 0.9, 0.15],
  [-2.5, -1.8, 0.12],
  [2.9, -3.4, 0.14],
  [-0.5, -4.8, 0.105],
  [-5.6, 5.2, 0.14],
  [5.9, 4.4, 0.12],
  [0.2, -9.5, 0.12],
];

function layTrunks(rand: () => number): Trunk[] {
  const trunks: Trunk[] = [];
  const add = (x: number, z: number, r: number): void => {
    trunks.push({ x, z, r, height: 12.5 + 5 * rand() + r * 8, leanX: (rand() - 0.5) * 1.5, leanZ: (rand() - 0.5) * 1.5 });
  };
  for (const [x, z, r] of HERO_TRUNKS) add(x, z, r);
  let tries = 0;
  while (trunks.length < 270 && tries < 60000) {
    tries++;
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 88;
    const x = Math.cos(a) * d;
    const z = -8 + Math.sin(a) * d;
    // Keep the sight line of the painting open.
    if (Math.abs(x - HERO.x) < 1.25 && z > 1.5 && z < 14) continue;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 2.2) continue;
    if (trunks.some((t) => Math.hypot(t.x - x, t.z - z) < 2.3)) continue;
    const u = rand();
    add(x, z, 0.06 + 0.13 * u * u);
  }
  return trunks;
}

const TRUNK_VERT = /* glsl */ `
${GLSL_NOISE}
${FOREST}
varying vec3 vWp;
varying vec3 vN;
varying vec4 vBark;
varying vec3 vInfo;
void main() {
  // The instance matrix holds the trunk record, not a transform.
  vec4 c0 = instanceMatrix[0];
  vec4 c1 = instanceMatrix[1];
  vec4 c2 = instanceMatrix[2];
  float a = position.x * K_TAU;
  // More rings near the foot, where the trunk flares.
  float tt = pow(position.y, 1.7);
  float y = tt * c1.z;
  float r = c0.w * (1.0 - 0.52 * tt) + c0.w * 0.6 * exp(-y / 0.3);
  vec3 ctr = c0.xyz + vec3(c1.x * tt + c2.x * sin(tt * 3.1), y, c1.y * tt + c2.y * sin(tt * 3.1 + 1.0));
  vec3 rad = vec3(cos(a), 0.0, sin(a));
  vec3 p = ctr + rad * r;
  vWp = p;
  vN = normalize(rad + vec3(0.0, 0.1, 0.0));
  vBark = vec4(position.x, y, c0.w, c1.w);
  vInfo = vec3(c2.z, c2.w, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const TRUNK_FRAG = /* glsl */ `
${GLSL_NOISE}
${FOREST}
varying vec3 vWp;
varying vec3 vN;
varying vec4 vBark;
varying vec3 vInfo;
void main() {
  float u = vBark.x, y = vBark.y, R = vBark.z, seed = vBark.w;
  float circ = K_TAU * R;
  // Noise coordinates on the tube, in metres, with no seam.
  vec3 sp = vec3(cos(u * K_TAU) * R, y, sin(u * K_TAU) * R);
  float tone = vnoise3(vec3(sp.x * 5.0, y * 1.3 + seed * 13.0, sp.z * 5.0));
  float smudge = vnoise3(vec3(sp.x * 21.0 + seed, y * 0.8, sp.z * 21.0));
  // The peel pattern is broad, so it can use the plain 2D noise. It is mirrored, so it has no seam.
  float peel = vnoise(vec2(abs(u - 0.5) * 6.0, y * 0.55 + seed * 7.0));

  // Paper bark: silver white with grey smudges and warm places where it peels.
  vec3 bark = mix(vec3(0.80, 0.81, 0.78), vec3(0.96, 0.94, 0.88), tone);
  bark = mix(bark, vec3(0.66, 0.68, 0.70), smoothstep(0.55, 0.9, smudge) * 0.4);
  bark = mix(bark, vec3(0.90, 0.79, 0.64), smoothstep(0.62, 0.95, peel) * 0.5);
  bark *= 0.965 + 0.035 * sin(y * 150.0 + tone * 9.0);

  // Lenticels: short dark dashes that run across the trunk.
  float A = max(floor(circ / 0.10), 4.0);
  vec2 q = vec2(u * A, y / 0.042);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec3 h = hash23(vec2(mod(id.x, A), id.y) + seed * 91.0);
  float dx = (f.x - (h.z - 0.5) * 0.3) / (0.16 + 0.32 * h.y);
  float dy = f.y / (0.10 + 0.2 * fract(h.x * 7.7));
  float lenticel = step(h.x, 0.36) * smoothstep(1.0, 0.45, dx * dx + dy * dy);

  // Branch scars: a dark eye with two brows that hang down.
  float A2 = max(floor(circ / 0.36), 2.0);
  vec2 q2 = vec2(u * A2 + 0.37, y / 0.6 + seed * 3.0);
  vec2 id2 = floor(q2);
  vec2 f2 = fract(q2) - 0.5;
  vec3 h2 = hash23(vec2(mod(id2.x, A2), id2.y) + seed * 17.0);
  vec2 e = (f2 - (h2.yz - 0.5) * 0.4) * vec2(circ / A2, 0.6);
  float sx = e.x / (0.045 + 0.085 * h2.z);
  float sy = (e.y + 0.42 * abs(e.x)) / (0.011 + 0.02 * h2.y);
  float scar = step(h2.x, 0.34) * smoothstep(1.0, 0.4, sx * sx + sy * sy);
  float eye = step(h2.x, 0.34) * smoothstep(1.0, 0.3, dot(e, e) / (0.0011 + 0.002 * h2.y));
  bark = mix(bark, vec3(0.12, 0.11, 0.10), max(max(lenticel * 0.86, scar * 0.95), eye));

  // The foot: rough black bark in blocks, with fissures.
  float foot = 1.0 - smoothstep(vInfo.y * 0.25, vInfo.y, y + (tone - 0.5) * vInfo.y * 0.9);
  if (foot > 0.0) {
    float fissure = vnoise3(vec3(sp.x * 27.0, y * 3.6, sp.z * 27.0));
    vec3 rough = mix(vec3(0.11, 0.10, 0.09), vec3(0.40, 0.37, 0.33), smoothstep(0.32, 0.78, fissure));
    bark = mix(bark, rough, foot);
  }

  // Moss and lichen on the lower trunk.
  float mossArea = (1.0 - smoothstep(0.8, 4.2, y)) * step(0.05, vInfo.x);
  if (mossArea > 0.0) {
    float mossN = vnoise3(vec3(sp.x * 17.0, y * 5.5 + seed * 5.0, sp.z * 17.0)) * 0.65 + smudge * 0.35;
    float moss = smoothstep(0.66 - 0.2 * vInfo.x, 0.78 - 0.2 * vInfo.x, mossN) * mossArea;
    bark = mix(bark, mix(vec3(0.40, 0.43, 0.24), vec3(0.66, 0.61, 0.34), tone), moss * 0.6);
  }

  // Light: a cool shade side, a warm side toward the sun, flecks from the canopy.
  vec3 n = normalize(vN);
  float lit = smoothstep(-0.3, 0.75, dot(n, uSun)) * (0.3 + 0.7 * dapple(vWp));
  vec3 col = mix(bark * vec3(0.76, 0.79, 0.88), bark * vec3(1.06, 1.01, 0.90), lit);
  // The leaf floor throws orange light on the foot of the trunk.
  col = mix(col, col * vec3(1.14, 0.86, 0.60), (1.0 - smoothstep(0.0, 2.4, y)) * 0.42);
  // The round of the trunk: a soft dark edge.
  vec3 v = normalize(uCam - vWp);
  col *= 0.74 + 0.26 * smoothstep(0.0, 0.55, abs(dot(n, v)));
  gl_FragColor = vec4(haze(col, vWp), 0.3 + 0.4 * tone + 0.3 * lenticel);
}
`;

function buildTrunkGeometry(): THREE.BufferGeometry {
  const RAD = 14, SEG = 16;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= SEG; j++) {
    for (let i = 0; i <= RAD; i++) pos.push(i / RAD, j / SEG, 0);
  }
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < RAD; i++) {
      const a = j * (RAD + 1) + i, b = a + 1, c = a + RAD + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// Canopy: instanced dabs of autumn foliage. One record is one instance.
//   column 0: root.xyz, half width
//   column 1: axis.xyz (direction * length), sway
//   column 3: colour.rgb, sway phase
// ---------------------------------------------------------------------------

const CANOPY: RGB[] = [hex(0x74401a), hex(0xb3621c), hex(0xd98a24), hex(0xecb23a), hex(0xf6d05e), hex(0xfdea9a)];
const CANOPY_GREEN: RGB[] = [hex(0x6c7826), hex(0x9a9a32), hex(0xc4b84a)];

function ramp(stops: RGB[], t: number): RGB {
  const x = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  return mix3(stops[i], stops[i + 1], x - i);
}

function buildCanopy(trunks: Trunk[], rand: () => number): Float32Array {
  const data: number[] = [];
  for (const t of trunks) {
    const dist = Math.hypot(t.x - HERO.x, t.z - HERO.z);
    if (dist > 78) continue;
    const count = dist < 34 ? 420 : 150;
    const top = groundH(t.x, t.z) + t.height;
    const cx = t.x + t.leanX * 0.8, cz = t.z + t.leanZ * 0.8;
    const cy = top - 2.4;
    const rx = 2.6 + 1.4 * rand(), ry = 3.2 + 1.3 * rand();
    const dabScale = dist < 34 ? 1 : 1.5;
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const yy = rand() * 2 - 1;
      const s = Math.sqrt(1 - yy * yy);
      const shell = 0.45 + 0.6 * Math.cbrt(rand());
      const px = cx + Math.cos(a) * s * rx * shell;
      const py = cy + yy * ry * shell;
      const pz = cz + Math.sin(a) * s * rx * shell;
      // Birch twigs hang: the dab points down and a little outward.
      let dx = Math.cos(a) * s * 0.5 + (rand() - 0.5) * 0.5;
      let dy = -0.9 + (rand() - 0.5) * 0.4;
      let dz = Math.sin(a) * s * 0.5 + (rand() - 0.5) * 0.5;
      const dl = Math.hypot(dx, dy, dz);
      const len = (0.3 + 0.28 * rand()) * dabScale;
      dx = (dx / dl) * len; dy = (dy / dl) * len; dz = (dz / dl) * len;
      // Palette position: sun side and crown top are light, the inside is dark.
      const nx = Math.cos(a) * s, nz = Math.sin(a) * s;
      let l = 0.5 + 0.2 * (nx * SUN.x + yy * SUN.y + nz * SUN.z) + 0.08 * yy;
      l += (noise3(px * 0.4, py * 0.4, pz * 0.4) - 0.5) * 0.5 + (rand() - 0.5) * 0.36 - (1 - shell) * 0.22;
      let col = ramp(CANOPY, l);
      if (rand() < 0.13) col = ramp(CANOPY_GREEN, l + 0.2);
      const k = 0.92 + 0.16 * rand();
      data.push(px, py, pz, len * (0.26 + 0.1 * rand()), dx, dy, dz, 0.02 + 0.05 * rand(), 0, 0, 0, 0, col[0] * k, col[1] * k, col[2] * k, rand() * 6.28);
    }
  }
  return new Float32Array(data);
}

const CANOPY_VERT = /* glsl */ `
${GLSL_NOISE}
${FOREST}
varying vec3 vColor;
varying vec3 vWp;
varying vec2 vQ;
void main() {
  vec4 c0 = instanceMatrix[0];
  vec4 c1 = instanceMatrix[1];
  vec4 c3 = instanceMatrix[3];
  float t = position.y;
  vec3 p = c0.xyz + c1.xyz * t;
  float ph = c3.w;
  vec2 wind = vec2(sin(uTime * 0.8 + ph + c0.z * 0.2) + 0.4 * sin(uTime * 1.9 + ph * 2.3), cos(uTime * 0.6 + ph * 1.7 + c0.x * 0.17));
  p.xz += wind * c1.w * (0.4 + t);
  // The card turns about its own axis to face the eye.
  vec3 side = cross(c1.xyz, p - uCam);
  side /= max(length(side), 1e-5);
  p += side * (position.x * c0.w);
  vWp = p;
  vQ = vec2(position.x, t);
  // Leaves against the sun glow.
  vec3 v = normalize(p - uCam);
  float back = pow(max(dot(v, uSun), 0.0), 3.0);
  vColor = c3.rgb * (0.92 + 0.16 * t) * (1.0 + 0.34 * back);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const CANOPY_FRAG = /* glsl */ `
${GLSL_NOISE}
${FOREST}
varying vec3 vColor;
varying vec3 vWp;
varying vec2 vQ;
void main() {
  float bristle = vnoise(vec2(vQ.x * 4.0 + vColor.g * 60.0, vQ.y * 1.3 + vColor.r * 40.0));
  vec3 col = vColor * (0.92 + 0.16 * bristle) * (0.95 + 0.08 * vQ.x);
  gl_FragColor = vec4(haze(col, vWp), 0.5 + 0.4 * bristle);
}
`;

function buildStrokeGeometry(): THREE.BufferGeometry {
  const profile = [0.46, 0.9, 1.0, 0.97, 0.84, 0.38];
  const pos: number[] = [];
  const idx: number[] = [];
  profile.forEach((w, i) => {
    const t = i / (profile.length - 1);
    pos.push(-w, t, 0, w, t, 0);
  });
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// Post: paint relief from the height in alpha, canvas, a warm grade.
// ---------------------------------------------------------------------------

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec4 c = texture2D(tScene, vUv);
  vec2 cv = gl_FragCoord.xy / s;
  // Paint height in alpha: light it from the upper left.
  float hL = texture2D(tScene, vUv - vec2(px.x, 0.0)).a;
  float hR = texture2D(tScene, vUv + vec2(px.x, 0.0)).a;
  float hD = texture2D(tScene, vUv - vec2(0.0, px.y)).a;
  float hU = texture2D(tScene, vUv + vec2(0.0, px.y)).a;
  vec3 n = normalize(vec3((hL - hR) * 1.5, (hD - hU) * 1.5, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  vec3 col = c.rgb * (1.0 + (dot(n, L) - L.z) * 0.8);
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 40.0);
  col += spec * 0.1 * c.a * vec3(1.0, 0.96, 0.86);

  // A fine dark line where one trunk stands in front of another thing.
  float edge = smoothstep(0.02, 0.07, depthEdge(vUv, px * 1.2));
  col = mix(col, col * vec3(0.42, 0.36, 0.38), edge * 0.5);

  col *= 0.93 + 0.11 * canvasWeave(cv);
  // Grade: rich warm lights, violet darks.
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col = mix(vec3(lum), col, 1.1);
  col = mix(col, col * vec3(0.94, 0.94, 1.06) + vec3(0.012, 0.0, 0.02), 1.0 - smoothstep(0.0, 0.3, lum));
  col *= vignette(vUv, 0.4);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 71.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createBirchForest(): PaintingScene {
  const scene = new THREE.Scene();
  const near = 0.1, far = 700;
  const rand = mulberry32(1903);
  const air = { uCam: { value: new THREE.Vector3() }, uSun: { value: SUN }, uTime: { value: 0 } };

  const skyUniforms = { ...air, uPixAngle: { value: 0.001 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  // Draw order: near things first, so the floor and the dome shade only what stays open.
  sky.renderOrder = 5;
  scene.add(sky);

  const groundUniforms = { ...air, uHero: { value: HERO }, uPixRef: { value: 0.001 }, uHeroShare: { value: 1 } };
  const groundGeo = new THREE.PlaneGeometry(260, 260, 150, 150);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: groundUniforms }));
  ground.frustumCulled = false;
  ground.renderOrder = 4;
  scene.add(ground);

  const trunks = layTrunks(rand);
  const trunkMesh = new THREE.InstancedMesh(
    buildTrunkGeometry(),
    new THREE.ShaderMaterial({ vertexShader: TRUNK_VERT, fragmentShader: TRUNK_FRAG, uniforms: air }),
    trunks.length,
  );
  const trunkData = trunkMesh.instanceMatrix.array as Float32Array;
  trunks.forEach((t, i) => {
    const big = clamp((t.r - 0.1) / 0.15, 0, 1);
    trunkData.set([
      t.x, groundH(t.x, t.z) - 0.12, t.z, t.r,
      t.leanX, t.leanZ, t.height, rand(),
      (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5, rand() < 0.3 + 0.6 * big ? 0.35 + 0.65 * rand() : 0, 0.25 + 1.5 * big * (0.5 + 0.5 * rand()) + 0.4 * rand(),
      0, 0, 0, 1,
    ], i * 16);
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.frustumCulled = false;
  scene.add(trunkMesh);

  const leafUniforms = { ...air, uFocus: { value: new THREE.Vector2() } };
  const leaves = new THREE.Mesh(
    buildLeafGeometry(LEAF_COUNT, rand),
    new THREE.ShaderMaterial({ vertexShader: LEAF_VERT, fragmentShader: LEAF_FRAG, uniforms: leafUniforms, side: THREE.DoubleSide }),
  );
  leaves.frustumCulled = false;
  leaves.renderOrder = 1;
  scene.add(leaves);

  const falling = new THREE.Mesh(
    buildFallingGeometry(FALLING, rand),
    new THREE.ShaderMaterial({ vertexShader: FALL_VERT, fragmentShader: LEAF_FRAG, uniforms: air, side: THREE.DoubleSide }),
  );
  falling.frustumCulled = false;
  falling.renderOrder = 3;
  scene.add(falling);

  const canopyData = buildCanopy(trunks, rand);
  const canopyCount = canopyData.length / 16;
  const canopy = new THREE.InstancedMesh(
    buildStrokeGeometry(),
    new THREE.ShaderMaterial({ vertexShader: CANOPY_VERT, fragmentShader: CANOPY_FRAG, uniforms: air, side: THREE.DoubleSide }),
    canopyCount,
  );
  (canopy.instanceMatrix.array as Float32Array).set(canopyData);
  canopy.instanceMatrix.needsUpdate = true;
  canopy.frustumCulled = false;
  canopy.renderOrder = 2;
  scene.add(canopy);

  const forward = new THREE.Vector3();

  return {
    scene,
    meta: {
      title: 'Birch Forest',
      artist: 'Gustav Klimt · 1903',
      technique: `${trunks.length} instanced birch trunks with procedural lenticel bark, a leaf floor of ${Math.round(LEAF_COUNT / 1000)}k instanced dabs over a chart-projected mosaic with octave selection, ${Math.round(canopyCount / 1000)}k canopy dabs, falling leaves, paint relief.`,
    },
    presets: [
      { name: 'The Painting', position: [HERO.x, HERO.y, HERO.z], target: [0.3, 0, 2.2], fov: 46 },
      { name: 'Silver Bark', position: [-0.72, 1.5, 7.35], target: [-1.78, 1.72, 6.55], fov: 44 },
      { name: 'Leaf Carpet', position: [1.5, 0.42, 7.6], target: [0.1, 0.35, 2.0], fov: 58 },
      { name: 'Into the Canopy', position: [0.7, 0.9, 3.4], target: [0.1, 9.5, 0.6], fov: 68 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near,
    far,
    flySpeed: 4,
    maxDistance: 60,
    floorAt: (x, z) => groundH(x, z) + 0.22,
    update(ctx: FrameContext): void {
      const cam = ctx.camera;
      air.uTime.value = ctx.time;
      air.uCam.value.copy(cam.position);
      sky.position.copy(cam.position);
      skyUniforms.uPixAngle.value = (2 * Math.tan((cam.fov * DEG) / 2)) / ctx.height;
      groundUniforms.uPixRef.value = 0.78 / ctx.height;
      groundUniforms.uHeroShare.value = 1 - smoothstep(3.5, 11, cam.position.distanceTo(HERO));
      // The leaf carpet lies around the point of the ground that the eye looks at.
      // A low eye that looks to the horizon keeps the carpet near its feet.
      cam.getWorldDirection(forward);
      const flat = Math.hypot(forward.x, forward.z);
      const limit = 8.5 + Math.max(cam.position.y - 2.5, 0) * 2.5;
      const reach = forward.y < -1e-3 ? Math.min((cam.position.y / -forward.y) * flat, limit) : Math.min(limit, 6) * flat;
      const dirX = flat > 1e-4 ? forward.x / flat : 0, dirZ = flat > 1e-4 ? forward.z / flat : 0;
      leafUniforms.uFocus.value.set(cam.position.x + dirX * reach, cam.position.z + dirZ * reach);
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
  };
}
