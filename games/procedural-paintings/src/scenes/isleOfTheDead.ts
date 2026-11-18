// Isle of the Dead — Arnold Böcklin, 1883.
//
// The island is sculpted as a signed distance field: a horseshoe of fractured
// crags with carved tomb portals, a pale quay wall, and a water gate. It is
// meshed once with surface nets. Ambient occlusion and the low evening sun
// are baked per vertex from the same field. The still water mirrors the scene
// through one planar reflection pass. A Kuwahara filter, canvas, craquelure,
// and varnish finish the image as an academic oil painting.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { bakeOcclusion, bakeSun, meshSdf, type Field } from '../sdf';
import { fbm3, mulberry32, noise2, noise3, smoothstep } from '../util';

const SUN = new THREE.Vector3(-0.74, 0.4, 0.54).normalize();
const BOAT = new THREE.Vector3(-2.4, 0, 42);

// Material ids written by the fields.
const MAT_ROCK = 0, MAT_STONE = 1, MAT_EARTH = 2, MAT_SHROUD = 3, MAT_WOOD = 4, MAT_CLOTH = 5;

function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// Island field
// ---------------------------------------------------------------------------

/** Design height of the horseshoe by bearing. 0 = back of the island, ±pi = toward the viewer. */
function ringHeight(ang: number): number {
  const a = Math.abs(ang);
  const flank = ang < 0 ? 8.5 * Math.exp(-Math.pow((a - 1.6) / 0.62, 2)) : 13.5 * Math.exp(-Math.pow((a - 1.86) / 0.5, 2));
  return (11.5 + flank) * (1 - smoothstep(2.05, 2.85, a));
}

/** Smooth design height of the island at a plan position, before fracturing. */
function plateau(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const ang = Math.atan2(x, -z);
  const ringR = 15.2 + 1.0 * Math.cos(2 * ang);
  const within = smoothstep(6.4, 3.0, Math.abs(r - ringR));
  // The mouth of the cove stays open toward the viewer.
  const mouth = smoothstep(10, 7.5, Math.abs(x)) * smoothstep(6, 9.5, z);
  return ringHeight(ang) * within * (1 - mouth);
}

function cellHash(ix: number, iz: number, k: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(k, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// Result of the last worley() call: the feature point of the nearest cell.
let wX = 0, wZ = 0, wHash = 0;

function worley(x: number, z: number, size: number, seed: number): void {
  const gx = Math.floor(x / size), gz = Math.floor(z / size);
  let best = 1e9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cz = gz + j;
      const fx = (cx + 0.5 + (cellHash(cx, cz, seed) - 0.5) * 0.8) * size;
      const fz = (cz + 0.5 + (cellHash(cx, cz, seed + 1) - 0.5) * 0.8) * size;
      const d = (x - fx) * (x - fx) + (z - fz) * (z - fz);
      if (d < best) { best = d; wX = fx; wZ = fz; wHash = cellHash(cx, cz, seed + 2); }
    }
  }
}

interface Portal { x: number; y: number; hw: number; hh: number }
const PORTALS: Portal[] = [
  { x: -17.6, y: 4.2, hw: 0.9, hh: 1.5 }, { x: -14.4, y: 4.0, hw: 0.95, hh: 1.55 }, { x: -11.4, y: 3.8, hw: 0.9, hh: 1.45 },
  { x: -16.0, y: 9.6, hw: 0.85, hh: 1.4 }, { x: -12.8, y: 9.0, hw: 0.85, hh: 1.35 },
  { x: 11.6, y: 4.0, hw: 0.95, hh: 1.55 }, { x: 14.6, y: 4.3, hw: 0.95, hh: 1.55 }, { x: 17.6, y: 4.0, hw: 0.9, hh: 1.45 },
  { x: 13.2, y: 10.2, hw: 0.9, hh: 1.45 }, { x: 16.4, y: 10.8, hw: 0.85, hh: 1.35 }, { x: 14.8, y: 16.4, hw: 0.8, hh: 1.3 },
];

let lastMat = MAT_ROCK;

/**
 * Rock: fractured columns. Each Voronoi cell in plan takes one height from
 * the design surface, so the crags break into flat-topped blocks and steps.
 * detail = false leaves out the erosion noise (used by the light bakes).
 */
function islandRock(x: number, y: number, z: number, detail: boolean): number {
  worley(x, z, 3.5, 11);
  const base = plateau(wX, wZ);
  let top: number;
  if (base > 0.6) {
    top = 1.6 + base * (0.7 + 0.55 * wHash);
    worley(x, z, 1.35, 37);
    top += (wHash - 0.5) * 1.5;
  } else {
    // Shore shelf, then the sea bed.
    top = Math.hypot(x, z) < 20.6 + 1.6 * noise2(Math.atan2(x, -z) * 3, 1) ? 1.2 + 0.5 * noise2(x * 0.25, z * 0.25) : -3;
  }
  let rock = y - top;
  // Tomb portals: doorways cut toward the viewer, only where the crag stands tall.
  if (z > 2 && top > 6) {
    for (const p of PORTALS) {
      const dx = Math.abs(x - p.x) - p.hw;
      if (dx > 0.6) continue;
      const box = Math.max(dx, Math.abs(y - p.y) - p.hh, p.y + p.hh + 1.2 - top);
      rock = Math.max(rock, -box);
    }
  }
  if (detail) rock += 0.5 * (fbm3(x * 0.24, y * 0.55, z * 0.24, 3) - 0.5) + 0.11 * Math.sin(y * 2.6 + 2.5 * noise3(x * 0.15, 0.5, z * 0.15));
  return rock;
}

/** Quay wall across the mouth of the cove: coping, gate posts with pyramid caps, steps to the water. */
function quayStone(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  const dz = Math.abs(z - 17.7);
  const wall = Math.max(dz - 0.48, y - 2.9, ax - 8.9, 1.3 - ax);
  const coping = Math.max(dz - 0.64, Math.abs(y - 3.02) - 0.14, ax - 9.0, 1.25 - ax);
  const post = (px: number, top: number): number => {
    const dx = Math.abs(ax - px);
    const shaft = Math.max(dx - 0.58, dz - 0.58, y - top);
    const slab = Math.max(dx - 0.76, dz - 0.76, Math.abs(y - top - 0.13) - 0.14);
    const rise = (y - top - 0.27) * 0.95;
    const pyramid = Math.max(dx + rise - 0.62, dz + rise - 0.62, top + 0.27 - y);
    return Math.min(shaft, slab, pyramid);
  };
  const stepIndex = Math.min(Math.max(Math.floor((z - 18.3) / 0.8), 0), 3);
  const steps = Math.max(ax - 1.55, 18.3 - z, z - 21.5, y - (1.3 - stepIndex * 0.36));
  lastMat = MAT_STONE;
  return Math.min(wall, coping, post(1.85, 4.7), post(8.7, 3.7), steps);
}

function islandFieldWith(x: number, y: number, z: number, detail: boolean): number {
  const d = islandRock(x, y, z, detail);
  lastMat = y > 0.8 && y < 2.4 && z < 17.3 && Math.hypot(x, z) < 19 && plateau(x, z) < 0.6 ? MAT_EARTH : MAT_ROCK;
  return d;
}

const islandField: Field = (x, y, z) => islandFieldWith(x, y, z, true);
const islandCoarse: Field = (x, y, z) => islandFieldWith(x, y, z, false);
/** Light bakes for the masonry also see the crags, so the wall sits in their shadow. */
const quayWithRock: Field = (x, y, z) => {
  const rock = islandRock(x, y, z, false);
  return Math.min(quayStone(x, y, z), rock);
};

function islandBound(x: number, y: number, z: number): number {
  const r = Math.hypot(x, z);
  const tall = r > 6 ? ringHeight(Math.atan2(x, -z)) * 1.3 + 5 : 4;
  return Math.max(r - 23.5, y - Math.max(tall, 6));
}

// ---------------------------------------------------------------------------
// Boat field: hull, coffin, the shrouded figure, the oarsman
// ---------------------------------------------------------------------------

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function capsule(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, ra: number, rb: number): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz), 0), 1);
  return Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) - (ra + (rb - ra) * t);
}

function boatField(x: number, y: number, z: number): number {
  // Hull: a hollowed spindle, bow toward -z.
  const outer = (Math.hypot(x / 0.95, (y - 0.02) / 0.62, z / 3.5) - 1) * 0.6;
  const inner = (Math.hypot(x / 0.74, (y - 0.17) / 0.5, z / 3.2) - 1) * 0.5;
  const sheer = 0.3 + 0.02 * z * z;
  const hull = Math.max(outer, -inner, y - sheer);
  // Coffin under a white pall, set across the bow.
  const cx = Math.abs(x) - 0.4, cy = Math.abs(y - 0.5) - 0.2, cz = Math.abs(z + 1.45) - 0.95;
  const coffin = Math.hypot(Math.max(cx, 0), Math.max(cy, 0), Math.max(cz, 0)) + Math.min(Math.max(cx, cy, cz), 0) - 0.1 + 0.015 * Math.sin(z * 9) * Math.sin(x * 7 + 1);
  // The standing figure in its shroud: narrow, hooded, head bowed toward the island.
  const fold = 0.02 * Math.sin(Math.atan2(x, z + 0.05) * 9 + y * 1.2) * smoothstep(2.0, 0.6, y);
  let shroud = capsule(x * 1.12, y, z, 0, 0.3, -0.1, 0, 1.75, -0.14, 0.33, 0.22) + fold;
  shroud = smin(shroud, (Math.hypot(x / 0.31, (y - 1.88) / 0.24, (z + 0.15) / 0.23) - 1) * 0.22, 0.2);
  shroud = smin(shroud, Math.hypot(x, y - 2.33, z + 0.24) - 0.165, 0.1);
  shroud = smin(shroud, capsule(x, y, z, 0, 2.2, -0.05, 0, 1.7, 0.1, 0.15, 0.2), 0.12);
  // The oarsman, seated at the stern.
  let rower = capsule(x, y, z, 0, 0.45, 2.0, 0, 1.2, 1.82, 0.27, 0.22);
  rower = smin(rower, Math.hypot(x, y - 1.47, z - 1.74) - 0.15, 0.1);
  rower = smin(rower, capsule(x, y, z, 0.26, 1.1, 1.8, 0.5, 0.62, 1.45, 0.085, 0.07), 0.08);
  rower = smin(rower, capsule(x, y, z, -0.26, 1.1, 1.8, -0.5, 0.62, 1.45, 0.085, 0.07), 0.08);
  const white = Math.min(coffin, shroud);
  let d = hull;
  lastMat = MAT_WOOD;
  if (white < d) { d = white; lastMat = MAT_SHROUD; }
  if (rower < d) { d = rower; lastMat = MAT_CLOTH; }
  return d;
}

interface Sculpt { geometry: THREE.BufferGeometry; triangles: number }

/** Joins two sculpts into one geometry, so they share one draw call. */
function joinSculpts(a: Sculpt, b: Sculpt): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const na = a.geometry.getAttribute('position').count;
  for (const name of ['position', 'normal', 'aMat', 'aAO', 'aSun']) {
    const pa = a.geometry.getAttribute(name), pb = b.geometry.getAttribute(name);
    const merged = new Float32Array(pa.array.length + pb.array.length);
    merged.set(pa.array as Float32Array, 0);
    merged.set(pb.array as Float32Array, pa.array.length);
    g.setAttribute(name, new THREE.BufferAttribute(merged, pa.itemSize));
  }
  const ia = a.geometry.getIndex(), ib = b.geometry.getIndex();
  if (!ia || !ib) throw new Error('joinSculpts needs indexed geometries');
  const index = new Uint32Array(ia.count + ib.count);
  index.set(ia.array as Uint32Array, 0);
  for (let i = 0; i < ib.count; i++) index[ia.count + i] = ib.getX(i) + na;
  g.setIndex(new THREE.BufferAttribute(index, 1));
  a.geometry.dispose();
  b.geometry.dispose();
  return g;
}

function sculpt(field: Field, bakeField: Field, bound: Field, min: [number, number, number], max: [number, number, number], cell: number, sunReach: number): Sculpt {
  const mesh = meshSdf(field, { min, max, cell, bound });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeVertexNormals();
  const nor = g.getAttribute('normal').array;
  const count = mesh.positions.length / 3;
  const mat = new Float32Array(count);
  for (let v = 0; v < count; v++) {
    field(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
    mat[v] = lastMat;
  }
  g.setAttribute('aMat', new THREE.BufferAttribute(mat, 1));
  g.setAttribute('aAO', new THREE.BufferAttribute(bakeOcclusion(bakeField, mesh.positions, nor, cell * 1.6), 1));
  g.setAttribute('aSun', new THREE.BufferAttribute(bakeSun(bakeField, mesh.positions, nor, SUN, sunReach), 1));
  return { geometry: g, triangles: mesh.indices.length / 3 };
}

// ---------------------------------------------------------------------------
// Shaders. Scene colour is stored square-root encoded for 8-bit precision.
// ---------------------------------------------------------------------------

const ATMOSPHERE = /* glsl */ `
uniform vec3 uCam;
uniform float uClip;
vec3 haze(vec3 col, vec3 wp) {
  float dist = length(wp - uCam);
  float f = 1.0 - exp(-dist * 0.0032);
  f *= 1.0 - 0.45 * smoothstep(0.0, 26.0, wp.y);
  return mix(col, vec3(0.20, 0.215, 0.26), clamp(f, 0.0, 1.0));
}
`;

const SOLID_VERT = /* glsl */ `
attribute float aMat;
attribute float aAO;
attribute float aSun;
varying vec3 vWp;
varying vec3 vN;
varying float vMat;
varying float vAO;
varying float vSun;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vMat = aMat; vAO = aAO; vSun = aSun;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SOLID_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vWp;
varying vec3 vN;
varying float vMat;
varying float vAO;
varying float vSun;
${GLSL_NOISE}
${ATMOSPHERE}
void main() {
  if (uClip > 0.5 && vWp.y < 0.0) discard;
  vec3 n = normalize(vN);
  vec3 p = vWp;
  // Rock: bedded limestone with rain-dark fissures.
  vec3 bedScale = vec3(0.32, 2.4, 0.32);
  float beds = fbm3(p * bedScale);
  float grain = fbm3(p * 1.4 + 7.0);
  float fissure = vnoise(vec2(atan(p.x, p.z) * 44.0 + 3.0 * vnoise(vec2(p.y * 0.4, 1.0)), p.y * 0.13));
  vec3 albedo = mix(vec3(0.36, 0.28, 0.21), vec3(0.70, 0.60, 0.46), smoothstep(0.2, 0.8, beds));
  albedo = mix(albedo, vec3(0.85, 0.80, 0.69), smoothstep(0.52, 0.8, grain) * 0.5);
  albedo = mix(albedo, vec3(0.30, 0.20, 0.13), smoothstep(0.6, 0.8, fissure) * 0.55 * (1.0 - abs(n.y)));
  // Lichen-dark tops.
  albedo = mix(albedo, vec3(0.20, 0.19, 0.12), smoothstep(0.75, 0.95, n.y) * 0.6);
  vec2 e = vec2(0.14, 0.0);
  vec3 g = vec3(fbm3((p + e.xyy) * bedScale), fbm3((p + e.yxy) * bedScale), fbm3((p + e.yyx) * bedScale)) - beds;
  vec3 nb = normalize(n - 1.6 * (g - n * dot(g, n)));

  float gloss = 0.0;
  if (vMat > 0.5 && vMat < 1.5) {
    // Pale dressed stone with courses.
    float course = step(0.93, fract(p.y * 1.45)) + step(0.96, fract((p.x + p.z) * 0.6 + floor(p.y * 1.45) * 0.37));
    albedo = vec3(0.80, 0.77, 0.69) * (0.86 + 0.2 * grain) * (1.0 - 0.3 * min(course, 1.0));
    nb = n;
  } else if (vMat > 1.5 && vMat < 2.5) {
    albedo = mix(vec3(0.035, 0.045, 0.025), vec3(0.09, 0.085, 0.05), grain);
  } else if (vMat > 2.5 && vMat < 3.5) {
    albedo = vec3(0.90, 0.88, 0.82);
    nb = n; gloss = 0.1;
  } else if (vMat > 3.5 && vMat < 4.5) {
    albedo = vec3(0.10, 0.075, 0.05) * (0.8 + 0.5 * vnoise(p.xz * 9.0));
    nb = n;
  } else if (vMat > 4.5) {
    albedo = vec3(0.075, 0.07, 0.075);
    nb = n;
  }

  float ndl = max(dot(nb, uSun), 0.0);
  float sun = ndl * vSun;
  vec3 sunCol = vec3(1.0, 0.80, 0.55) * 1.55;
  vec3 sky = vec3(0.15, 0.19, 0.30) * (0.4 + 0.6 * nb.y) + vec3(0.03, 0.028, 0.03);
  // Warm light thrown back from the lit rock and the water.
  vec3 bounce = vec3(0.11, 0.075, 0.05) * (0.5 - 0.5 * nb.y + 0.4 * max(dot(nb, -uSun * vec3(1.0, 0.0, 1.0)), 0.0));
  vec3 col = albedo * (sunCol * sun + (sky + bounce) * vAO);
  col += gloss * pow(max(dot(reflect(-uSun, nb), normalize(uCam - p)), 0.0), 12.0) * vSun;
  // The tide line.
  col *= mix(0.42, 1.0, smoothstep(0.05, 1.0, p.y + 0.3 * grain));
  col = haze(col, p);
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const CYPRESS_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
varying vec3 vWp;
varying vec3 vN;
varying float vH;
varying float vSeed;
${GLSL_NOISE}
void main() {
  vH = position.y;
  vSeed = aSeed.x;
  vec3 p = position;
  // Ragged foliage silhouette.
  float tuft = vnoise3(vec3(p.x * 9.0, p.y * 14.0, p.z * 9.0) + aSeed.x * 31.0);
  float clump = vnoise3(vec3(p.x * 3.0, p.y * 5.0, p.z * 3.0) + aSeed.x * 17.0);
  p.xz *= 1.0 + (0.55 * (clump - 0.5) + 0.3 * (tuft - 0.5)) * smoothstep(0.0, 0.1, p.y);
  p.y += 0.035 * (clump - 0.5);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  // The crowns move a little in the evening air.
  float sway = sin(uTime * 0.5 + aSeed.x * 20.0) * 0.06 * vH * vH;
  wp.x += sway;
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CYPRESS_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vWp;
varying vec3 vN;
varying float vH;
varying float vSeed;
${GLSL_NOISE}
${ATMOSPHERE}
void main() {
  if (uClip > 0.5 && vWp.y < 0.0) discard;
  vec3 n = normalize(vN);
  vec3 p = vWp;
  float clump = fbm3(p * vec3(1.1, 0.55, 1.1) + vSeed * 9.0);
  float fine = vnoise3(p * vec3(4.2, 2.0, 4.2));
  vec3 albedo = mix(vec3(0.006, 0.014, 0.011), vec3(0.028, 0.05, 0.028), smoothstep(0.3, 0.75, clump));
  albedo = mix(albedo, vec3(0.085, 0.09, 0.035), smoothstep(0.62, 0.9, clump * 0.6 + fine * 0.5) * 0.55);
  vec3 nb = normalize(n + 0.7 * (vec3(clump, fine, clump * fine) - 0.5));
  float wrap = max(dot(nb, uSun) * 0.6 + 0.4, 0.0);
  float self = smoothstep(0.0, 0.5, vH) * 0.6 + 0.4;
  vec3 col = albedo * (vec3(1.0, 0.82, 0.58) * 1.3 * wrap * wrap * self + vec3(0.16, 0.2, 0.28) * (0.5 + 0.5 * nb.y));
  col = haze(col, p);
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
varying vec3 vDir;
${GLSL_NOISE}
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  // Dusk: pale warm light low on the horizon, slate above.
  float h = clamp(el / 1.2, 0.0, 1.0);
  vec3 hor = mix(vec3(0.60, 0.56, 0.53), vec3(0.86, 0.64, 0.44), pow(toSun, 3.0) * 0.8);
  vec3 col = mix(hor, vec3(0.33, 0.36, 0.43), smoothstep(0.0, 0.2, h));
  col = mix(col, vec3(0.10, 0.12, 0.19), smoothstep(0.15, 0.8, h));
  // Storm banks: heavy masses with torn, lit edges, drifting very slowly.
  vec2 cp = d.xz / (d.y + 0.34) + vec2(uTime * 0.003, 0.0);
  float mass = fbm(cp * vec2(0.55, 1.0) + 2.0);
  float torn = fbm(cp * vec2(1.7, 3.0) + 9.0);
  float density = mass * 0.78 + torn * 0.3;
  float cover = smoothstep(0.44, 0.60, density);
  float edge = smoothstep(0.44, 0.52, density) * (1.0 - smoothstep(0.52, 0.66, density));
  vec3 cloudDark = mix(vec3(0.05, 0.056, 0.08), vec3(0.12, 0.125, 0.155), smoothstep(0.5, 0.0, h));
  vec3 cloudLit = mix(vec3(0.42, 0.41, 0.44), vec3(0.80, 0.60, 0.44), pow(toSun, 2.0) * 0.75);
  vec3 cloud = mix(cloudDark, cloudLit, edge * 0.8);
  col = mix(col, cloud, cover * smoothstep(0.01, 0.07, h));
  // A pale rift low in the sky, behind the island.
  float rift = exp(-pow(az / 0.8, 2.0) - pow((el - 0.09) / 0.12, 2.0));
  col = mix(col, vec3(0.70, 0.64, 0.57), rift * 0.5);
  // Below the horizon the dome is dark water haze.
  col = mix(vec3(0.20, 0.215, 0.26), col, smoothstep(-0.02, 0.012, el));
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const WATER_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */ `
uniform sampler2D tReflect;
uniform mat4 uTexMatrix;
uniform float uTime;
uniform vec3 uBoat;
varying vec3 vWp;
${GLSL_NOISE}
${ATMOSPHERE}
float surface(vec2 p) {
  float t = uTime * 0.12;
  float h = fbm(p * vec2(0.16, 0.42) + vec2(t, t * 0.6)) + 0.5 * fbm(p * vec2(0.7, 1.9) - vec2(t * 1.3, 0.0));
  // Wake rings behind the ferry.
  float bd = length(p - uBoat.xz);
  h += 0.35 * sin(bd * 2.4 - uTime * 1.1) * exp(-bd * 0.16) * smoothstep(1.0, 3.0, bd);
  return h;
}
void main() {
  vec3 toCam = uCam - vWp;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 p = vWp.xz;
  float e = 0.12 + dist * 0.004;
  float h0 = surface(p);
  vec2 grad = vec2(surface(p + vec2(e, 0.0)) - h0, surface(p + vec2(0.0, e)) - h0) / e;
  float calm = 1.0 / (1.0 + dist * 0.012);
  vec3 n = normalize(vec3(-grad.x * 0.16 * calm, 1.0, -grad.y * 0.16 * calm));
  vec4 clip = uTexMatrix * vec4(vWp, 1.0);
  vec2 uv = clip.xy / clip.w + n.xz * vec2(0.5, 1.9) * calm;
  vec3 refl = texture2D(tReflect, clamp(uv, 0.002, 0.998)).rgb;
  refl *= refl;
  float fres = 0.05 + 0.95 * pow(1.0 - max(dot(V, n), 0.0), 4.0);
  vec3 deep = vec3(0.010, 0.020, 0.022);
  vec3 col = mix(deep, refl * 0.86, clamp(fres + 0.3, 0.0, 1.0));
  // Long horizontal glints where the ripples tilt toward the sky.
  float glint = smoothstep(0.55, 0.9, vnoise(p * vec2(0.09, 1.7) + vec2(uTime * 0.03, 0.0)) * (0.6 + 0.4 * h0));
  col += vec3(0.05, 0.055, 0.065) * glint * calm * 2.0 * pow(1.0 - V.y, 3.0);
  col = haze(col, vWp);
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const POST_FRAG = /* glsl */ `
vec3 scene(vec2 uv) { return texture2D(tScene, uv).rgb; }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  // Kuwahara: keep the calmest of four neighbourhoods, so detail gathers into brush marks.
  vec3 best = vec3(0.0);
  float bestVar = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 sgn = vec2(q == 0 || q == 2 ? 1.0 : -1.0, q < 2 ? 1.0 : -1.0);
    vec3 m = vec3(0.0); vec3 m2 = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 3; i++) {
        vec3 c = scene(vUv + sgn * vec2(float(i), float(j)) * px * 1.25);
        m += c; m2 += c * c;
      }
    }
    m /= 9.0; m2 = m2 / 9.0 - m * m;
    float v = m2.r + m2.g + m2.b;
    if (v < bestVar) { bestVar = v; best = m; }
  }
  vec3 col = mix(scene(vUv), best, 0.85);

  // Thin oil relief from the luminance, plus canvas weave.
  float l0 = dot(best, vec3(0.3, 0.6, 0.1));
  float lx = dot(scene(vUv + vec2(px.x * 1.5, 0.0)), vec3(0.3, 0.6, 0.1)) - l0;
  float ly = dot(scene(vUv + vec2(0.0, px.y * 1.5)), vec3(0.3, 0.6, 0.1)) - l0;
  float weave = canvasWeave(cv);
  col *= 1.0 + (lx - ly) * 0.9;
  col *= 0.94 + 0.09 * weave;

  // Craquelure: a fine net of age cracks, most visible in the darks.
  vec2 cq = cv * 0.055 + 2.5 * vec2(vnoise(cv * 0.012), vnoise(cv * 0.012 + 9.0));
  vec2 ci = floor(cq); vec2 cf = fract(cq);
  float d1 = 9.0; float d2 = 9.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash23(ci + g).xy;
      float dd = length(g + o - cf);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
    }
  }
  float crackle = 1.0 - smoothstep(0.0, 0.035, d2 - d1);
  col *= 1.0 - crackle * 0.10 * (1.0 - smoothstep(0.1, 0.6, l0));

  // Grade: decode, lift the darks toward green-umber, warm the lights, varnish.
  col = pow(max(col, 0.0), vec3(0.92));
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col = mix(col, col * vec3(1.06, 1.0, 0.86), smoothstep(0.25, 0.8, lum));
  col = mix(col, col * vec3(0.9, 1.0, 0.96) + vec3(0.012, 0.016, 0.012), 1.0 - smoothstep(0.0, 0.3, lum));
  col = mix(vec3(lum), col, 1.08);
  col *= vignette(vUv, 0.62);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

function buildCypressGeometry(): THREE.BufferGeometry {
  const RAD = 16, SEG = 38;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    // Narrow foot, fullest a third of the way up, long taper to the tip.
    const r = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.85) * (1 - 0.25 * t) + 0.01;
    for (let j = 0; j < RAD; j++) {
      const a = (j / RAD) * Math.PI * 2;
      pos.push(Math.cos(a) * r, t, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = i * RAD + j, b = i * RAD + ((j + 1) % RAD), c = a + RAD, d = b + RAD;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createIsleOfTheDead(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 3000;
  const time = { value: 0 };
  const atmosphere = { uCam: { value: new THREE.Vector3() }, uClip: { value: 0 }, uSun: { value: SUN }, uTime: time };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: atmosphere, side: THREE.BackSide }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const solidMat = new THREE.ShaderMaterial({ vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG, uniforms: atmosphere });
  const island = sculpt(islandField, islandCoarse, islandBound, [-25, -1.4, -25], [25, 34, 25], 0.45, 60);
  const quayBound: Field = (x, y, z) => Math.max(Math.abs(x) - 9.9, Math.abs(y - 2.4) - 3.4, Math.abs(z - 19.3) - 2.7);
  const quay = sculpt(quayStone, quayWithRock, quayBound, [-9.8, -0.7, 16.7], [9.8, 5.8, 21.9], 0.13, 40);
  const islandMesh = new THREE.Mesh(joinSculpts(island, quay), solidMat);
  islandMesh.frustumCulled = false;
  scene.add(islandMesh);

  const boatBound: Field = (x, y, z) => Math.max(Math.abs(x) - 1.25, Math.abs(y - 1.2) - 1.8, Math.abs(z) - 3.7);
  const boat = sculpt(boatField, boatField, boatBound, [-1.3, -0.7, -3.8], [1.3, 2.8, 3.8], 0.05, 6);
  const boatMesh = new THREE.Mesh(boat.geometry, solidMat);
  boatMesh.position.copy(BOAT);
  boatMesh.scale.setScalar(1.4);
  boatMesh.frustumCulled = false;
  scene.add(boatMesh);

  // The grove: tall cypresses packed into the cove.
  const rand = mulberry32(1880);
  const trees: Array<{ x: number; z: number; h: number; r: number }> = [];
  let tries = 0;
  while (trees.length < 38 && tries < 4000) {
    tries++;
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 9.2;
    const x = Math.cos(a) * rr, z = 0.5 + Math.sin(a) * rr * 1.35;
    if (Math.abs(x) < 1.7 && z > 6) continue;
    if (plateau(x, z) > 0.5 || z > 14.5) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.1)) continue;
    const centre = 1 - Math.min(Math.hypot(x, z + 1.5) / 11, 1);
    trees.push({ x, z, h: 20 + centre * 9 + rand() * 4.5, r: 1.4 + rand() * 0.7 });
  }
  const cypress = new THREE.InstancedMesh(
    buildCypressGeometry(),
    new THREE.ShaderMaterial({ vertexShader: CYPRESS_VERT, fragmentShader: CYPRESS_FRAG, uniforms: atmosphere }),
    trees.length,
  );
  const seeds = new Float32Array(trees.length * 4);
  const q = new THREE.Quaternion();
  trees.forEach((t, i) => {
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.05, rand() * 6.28, (rand() - 0.5) * 0.05));
    cypress.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(t.x, 0.9, t.z), q, new THREE.Vector3(t.r, t.h, t.r)));
    seeds[i * 4] = rand();
  });
  cypress.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  cypress.frustumCulled = false;
  scene.add(cypress);

  const reflectTarget = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  const texMatrix = new THREE.Matrix4();
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: { ...atmosphere, tReflect: { value: reflectTarget.texture }, uTexMatrix: { value: texMatrix }, uBoat: { value: BOAT } },
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(far * 0.85, 64), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.frustumCulled = false;
  scene.add(water);

  const mirrorCam = new THREE.PerspectiveCamera();
  const MIRROR = new THREE.Matrix4().makeScale(1, -1, 1);
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const scratch = new THREE.Matrix4();
  const unit = new THREE.Vector3();

  return {
    scene,
    meta: {
      title: 'Isle of the Dead',
      artist: 'Arnold Böcklin · 1883',
      technique: 'SDF-sculpted crags meshed by surface nets, baked AO + sun shadow, planar water reflection, Kuwahara oil filter, craquelure and varnish.',
    },
    presets: [
      { name: 'The Painting', position: [0, 4.2, 86], target: [0, 11.0, 0], fov: 28 },
      { name: "Ferryman's Approach", position: [1.6, 4.2, 58], target: [-2.6, 7.0, 8], fov: 40 },
      { name: 'The Water Gate', position: [7.5, 2.2, 31], target: [-1.5, 7, 6], fov: 56 },
      { name: 'Above the Grove', position: [38, 40, 44], target: [0, 9, 0], fov: 40 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.3,
    far,
    flySpeed: 12,
    maxDistance: 260,
    floorAt: () => 0.6,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      atmosphere.uCam.value.copy(ctx.camera.position);
      // The ferry rides the water and creeps toward the gate.
      boatMesh.position.set(BOAT.x, -0.06 + 0.035 * Math.sin(ctx.time * 0.8), BOAT.z);
      boatMesh.rotation.set(0.012 * Math.sin(ctx.time * 0.6), 0.06 + 0.02 * Math.sin(ctx.time * 0.21), 0.02 * Math.sin(ctx.time * 0.47));
    },
    prePass(ctx: FrameContext): void {
      const w = Math.max(Math.floor(ctx.width / 2), 2), h = Math.max(Math.floor(ctx.height / 2), 2);
      if (reflectTarget.width !== w || reflectTarget.height !== h) reflectTarget.setSize(w, h);
      ctx.camera.updateMatrixWorld();
      // Mirror the camera in the water plane. The extra local flip keeps it right-handed.
      scratch.copy(MIRROR).multiply(ctx.camera.matrixWorld).multiply(MIRROR);
      scratch.decompose(mirrorCam.position, mirrorCam.quaternion, unit);
      mirrorCam.projectionMatrix.copy(ctx.camera.projectionMatrix);
      mirrorCam.projectionMatrixInverse.copy(ctx.camera.projectionMatrixInverse);
      mirrorCam.updateMatrixWorld();
      texMatrix.copy(BIAS).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
      water.visible = false;
      atmosphere.uClip.value = 1;
      sky.position.copy(mirrorCam.position);
      atmosphere.uCam.value.copy(mirrorCam.position);
      ctx.renderer.setRenderTarget(reflectTarget);
      ctx.renderer.clear();
      ctx.renderer.render(scene, mirrorCam);
      water.visible = true;
      atmosphere.uClip.value = 0;
      sky.position.copy(ctx.camera.position);
      atmosphere.uCam.value.copy(ctx.camera.position);
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      reflectTarget.dispose();
    },
  };
}
