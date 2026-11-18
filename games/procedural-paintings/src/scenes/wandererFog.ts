// Wanderer above the Sea of Fog — Caspar David Friedrich, 1818.
//
// The sandstone pinnacle and the wanderer are signed distance fields, meshed
// once with surface nets. Ambient occlusion and the morning sun are baked per
// vertex. The ridges and far mountains are one polar height-field mesh. The
// fog is a height-bounded volume: every surface and the sky dome march a short
// ray through two drifting noise layers, so the banks have depth and parallax.
// A Kuwahara filter, canvas, craquelure, and varnish finish the image.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { bakeOcclusion, bakeSun, meshSdf, type Field } from '../sdf';
import { clamp, fbm2, fbm3, mix, mulberry32, noise2, noise3, smoothstep } from '../util';

const DEG = Math.PI / 180;
const SUN = new THREE.Vector3(-0.5, 0.42, -0.74).normalize();
/** Lowest and highest level of the top of the fog banks, metres. The wanderer's feet are at 0. */
const FOG_LO = -66;
const FOG_HI = -22;
/** Top of the thin veil of wisps that drifts above the banks. */
const WISP_HI = -4;
const VALLEY = -100;

const MAT_ROCK = 0, MAT_COAT = 1, MAT_BOOT = 2, MAT_HAIR = 3, MAT_SKIN = 4, MAT_CANE = 5;
let lastMat = MAT_ROCK;

// ---------------------------------------------------------------------------
// Distance-field helpers
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

function ellipsoid(x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number {
  return (Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1) * Math.min(rx, ry, rz);
}

function roundBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, r: number): number {
  const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r, qz = Math.abs(z) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
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

// ---------------------------------------------------------------------------
// The pinnacle: a sandstone needle with a short summit ridge behind the wanderer
// ---------------------------------------------------------------------------

const SPINE_A = { x: 0, z: -0.4 };
const SPINE_B = { x: 0.9, z: 13.5 };
const CLIFF_SLOPE = 5;

/** Smooth design height of the pinnacle, before it breaks into blocks. */
function cragDesign(x: number, z: number): number {
  // The ground falls away sooner in front of the summit.
  const zz = z < SPINE_A.z ? SPINE_A.z + (z - SPINE_A.z) * 2 : z;
  const dx = SPINE_B.x - SPINE_A.x, dz = SPINE_B.z - SPINE_A.z;
  const t = clamp(((x - SPINE_A.x) * dx + (zz - SPINE_A.z) * dz) / (dx * dx + dz * dz), 0, 1);
  const d = Math.hypot(x - SPINE_A.x - dx * t, zz - SPINE_A.z - dz * t);
  const crest = -0.5 * t - 1.6 * t * t;
  const bearing = Math.atan2(x, z - 5);
  const wide = 4.3 + 0.9 * t + 0.9 * (noise2(x * 0.3 + 4, z * 0.3) - 0.5) + 1.6 * (noise2(bearing * 1.4, 7) - 0.5);
  const shoulder = -0.3 * Math.pow(d, 1.05);
  // Below the shoulder the needle drops in buttresses of unequal steepness.
  const cliff = d > wide ? -(d - wide) * (CLIFF_SLOPE + 2.4 * (noise2(bearing * 2.2, 3) - 0.5)) : 0;
  return crest + shoulder + cliff;
}

/** Top of the rock at a plan position: each Voronoi cell takes one height, so the crag breaks into blocks and pillars. */
function cragTop(x: number, z: number): number {
  worley(x, z, 1.15, 5);
  const fromSummit = Math.hypot(wX, wZ);
  const rough = smoothstep(0.8, 3, fromSummit);
  let top = cragDesign(wX, wZ) + (wHash - 0.5) * (0.4 + 0.55 * rough);
  // Each block is a tilted slab of the bedding, so the crag has sharp facets and not flat steps.
  const tilt = 0.75 * rough;
  top += tilt * ((cellHash(Math.round(wX * 64), Math.round(wZ * 64), 61) - 0.5) * (x - wX) + (cellHash(Math.round(wX * 64), Math.round(wZ * 64), 62) - 0.5) * (z - wZ));
  worley(x, z, 0.5, 23);
  top += (wHash - 0.5) * 0.2;
  if (top < -4) {
    worley(x, z, 3.8, 41);
    top += (wHash - 0.5) * 9 * smoothstep(-4, -9, top);
  }
  // The summit stays clear, so the two standing blocks define it.
  return Math.min(top, -0.08 + 1.2 * Math.max(Math.hypot(x, z + 0.1) - 0.55, 0));
}

/** The block under the right foot (top at 0) and the higher block under the left foot (top at 0.22). */
function standingBlocks(x: number, y: number, z: number): number {
  return Math.min(roundBox(x - 0.12, y + 0.3, z - 0.03, 0.36, 0.3, 0.3, 0.06), roundBox(x + 0.2, y + 0.1, z + 0.34, 0.24, 0.32, 0.22, 0.06));
}

/**
 * Lazy table of cragTop on the sample grid of one mesh. cragTop is the costly
 * part of the rock field and depends on x and z only, so each grid column
 * computes it once.
 */
class TopTable {
  private readonly data: Float32Array;
  private readonly nx: number;
  private readonly nz: number;
  private readonly x0: number;
  private readonly z0: number;
  private readonly cell: number;

  constructor(min: [number, number, number], max: [number, number, number], cell: number) {
    this.x0 = min[0];
    this.z0 = min[2];
    this.cell = cell;
    this.nx = Math.ceil((max[0] - min[0]) / cell) + 2;
    this.nz = Math.ceil((max[2] - min[2]) / cell) + 2;
    this.data = new Float32Array(this.nx * this.nz).fill(NaN);
  }

  covers(x: number, z: number): boolean {
    const i = Math.round((x - this.x0) / this.cell), k = Math.round((z - this.z0) / this.cell);
    return i >= 0 && k >= 0 && i < this.nx && k < this.nz;
  }

  /** Top of the rock at the grid point nearest to (x, z). */
  at(x: number, z: number): number {
    const i = Math.round((x - this.x0) / this.cell), k = Math.round((z - this.z0) / this.cell);
    const at = i + this.nx * k;
    let top = this.data[at];
    if (Number.isNaN(top)) {
      top = cragTop(this.x0 + i * this.cell, this.z0 + k * this.cell);
      this.data[at] = top;
    }
    return top;
  }
}

function cragField(top: number, x: number, y: number, z: number, detail: boolean): number {
  let d = y - top;
  lastMat = MAT_ROCK;
  // Far from the surface only the sign matters.
  if (d > 1.2 || d < -1.2) return d;
  // Weathering, and the horizontal bedding of the sandstone.
  if (detail) d += 0.2 * (fbm3(x * 0.8, y * 1.6, z * 0.8, 3) - 0.5) + 0.05 * Math.sin(y * 7.5 + 4 * noise3(x * 0.4, 0.3, z * 0.4));
  return y > -1 && Math.abs(x) < 1.2 && Math.abs(z) < 1.2 ? smin(d, standingBlocks(x, y, z), 0.1) : d;
}

// The summit is meshed finely; the tower below it is meshed coarsely.
const FINE_MIN: [number, number, number] = [-7.6, -5.2, -4.4];
const FINE_MAX: [number, number, number] = [7.6, 0.8, 9.8];
const FINE_CELL = 0.1;
const TOWER_MIN: [number, number, number] = [-22, -76, -11.5];
const TOWER_MAX: [number, number, number] = [23, 0.5, 33.5];
const TOWER_CELL = 0.55;

function cragBound(x: number, y: number, z: number): number {
  return (y - cragDesign(x, z) - 9) / (CLIFF_SLOPE + 1.8);
}

// ---------------------------------------------------------------------------
// The wanderer: seen from behind, left foot raised, cane in the right hand
// ---------------------------------------------------------------------------

/** A distance that is never greater than the distance to the wanderer: legs, body, head. */
function figureBound(x: number, y: number, z: number): number {
  return Math.min(
    capsule(x, y, z, -0.05, 0.05, -0.2, 0, 0.5, -0.1, 0.48, 0.48),
    capsule(x, y, z, 0, 0.5, 0, 0, 1.5, 0, 0.42, 0.42),
    Math.hypot(x, y - 1.72, z) - 0.2,
  );
}

function figureField(x: number, y: number, z: number): number {
  const bound = figureBound(x, y, z);
  if (bound > 0.12) return bound;
  // Each part is left out where it is more than 0.25 away, so the field stays a usable distance.
  const FAR = 1e9;

  let cloth = FAR;
  if (y < 1.3) {
    // Trousers: the right leg stands, the left leg steps up and out.
    cloth = capsule(x, y, z, 0.105, 0.1, 0.03, 0.1, 0.52, 0.02, 0.058, 0.072);
    cloth = smin(cloth, capsule(x, y, z, 0.1, 0.52, 0.02, 0.085, 0.96, 0.01, 0.076, 0.098), 0.04);
    cloth = smin(cloth, capsule(x, y, z, -0.2, 0.32, -0.31, -0.155, 0.6, -0.2, 0.058, 0.072), 0.04);
    cloth = smin(cloth, capsule(x, y, z, -0.155, 0.6, -0.2, -0.09, 0.96, -0.01, 0.076, 0.098), 0.04);
  }
  if (y > 0.6) {
    // Torso and shoulders of the frock coat.
    cloth = smin(cloth, capsule(x / 1.22, y, z / 0.94, 0, 0.98, 0, 0, 1.4, 0.005, 0.135, 0.152) * 0.94, 0.05);
    cloth = smin(cloth, capsule(x, y, z, -0.185, 1.445, 0.005, 0.185, 1.445, 0.005, 0.072, 0.072), 0.06);
    // Right arm down to the cane, left arm bent to the front.
    cloth = smin(cloth, capsule(x, y, z, 0.215, 1.43, 0.005, 0.265, 1.15, 0.03, 0.062, 0.055), 0.04);
    cloth = smin(cloth, capsule(x, y, z, 0.265, 1.15, 0.03, 0.315, 0.94, -0.07, 0.052, 0.042), 0.03);
    cloth = smin(cloth, capsule(x, y, z, -0.215, 1.43, 0.005, -0.29, 1.16, 0.02, 0.062, 0.055), 0.04);
    cloth = smin(cloth, capsule(x, y, z, -0.29, 1.16, 0.02, -0.19, 1.04, -0.15, 0.052, 0.045), 0.03);
    cloth = smin(cloth, ellipsoid(x, y, z, 0, 1.515, 0.012, 0.088, 0.046, 0.082), 0.03);
  }
  if (y > 0.2 && y < 1.35) {
    // The skirt of the coat: it flares, the wind pulls it to the right, and the back vent opens.
    const k = clamp((0.98 - y) / 0.48, 0, 1);
    const xs = x - 0.05 * k * k;
    const folds = 0.012 * Math.sin(Math.atan2(xs, z) * 7 + y * 4) * k;
    const vent = z > 0 ? 0.03 * Math.exp(-(xs * xs) / 0.0004) * k : 0;
    const skirt = Math.max(capsule(xs / 1.15, y, (z - 0.02) / 0.96, 0, 1.03, 0, 0, 0.5, 0.03, 0.15, 0.24) * 0.95 + folds + vent, 0.47 - y);
    cloth = smin(cloth, skirt, 0.03);
  }

  let boots = FAR;
  if (y < 0.75) {
    boots = Math.min(
      smin(ellipsoid(x, y, z, 0.108, 0.058, -0.025, 0.052, 0.06, 0.135), capsule(x, y, z, 0.105, 0.06, 0.03, 0.105, 0.2, 0.03, 0.06, 0.06), 0.03),
      smin(ellipsoid(x, y, z, -0.2, 0.278, -0.365, 0.052, 0.06, 0.135), capsule(x, y, z, -0.2, 0.28, -0.32, -0.2, 0.4, -0.31, 0.06, 0.06), 0.03),
    );
  }

  let skin = FAR;
  let hair = FAR;
  if (y > 1.2) {
    skin = capsule(x, y, z, 0, 1.5, 0, 0, 1.6, -0.005, 0.048, 0.048);
    skin = smin(skin, ellipsoid(x, y, z, 0, 1.685, -0.012, 0.078, 0.1, 0.092), 0.02);
    skin = Math.min(skin, Math.hypot(Math.abs(x) - 0.08, y - 1.675, z + 0.005) - 0.022);
    // Hair: a tousled cap with tufts that the wind lifts to the right.
    hair = ellipsoid(x, y, z, 0, 1.715, 0.02, 0.088, 0.09, 0.095);
    hair = smin(hair, Math.hypot(x - 0.07, y - 1.765, z) - 0.036, 0.03);
    hair = smin(hair, Math.hypot(x - 0.1, y - 1.73, z - 0.03) - 0.028, 0.03);
    hair = smin(hair, Math.hypot(x + 0.03, y - 1.79, z) - 0.03, 0.03);
    hair = smin(hair, Math.hypot(x - 0.04, y - 1.795, z + 0.03) - 0.03, 0.03);
    hair = smin(hair, Math.hypot(x - 0.02, y - 1.66, z - 0.085) - 0.035, 0.03);
    // Locks that the wind pulls out to the right.
    hair = smin(hair, capsule(x, y, z, 0.03, 1.785, 0, 0.16, 1.81, 0.02, 0.032, 0.014), 0.025);
    hair = smin(hair, capsule(x, y, z, 0.05, 1.74, 0.05, 0.165, 1.745, 0.065, 0.03, 0.014), 0.025);
    hair = smin(hair, capsule(x, y, z, 0.02, 1.7, 0.09, 0.13, 1.69, 0.11, 0.03, 0.014), 0.025);
    if (hair < 0.1) hair += 0.02 * (noise3(x * 34, y * 34, z * 34) - 0.5) + 0.012 * (noise3(x * 80 + 3, y * 80, z * 80) - 0.5);
  } else if (y > 0.6) {
    skin = Math.hypot(x - 0.325, y - 0.885, z + 0.085) - 0.042;
  }

  let d = cloth;
  lastMat = MAT_COAT;
  if (boots < d) { d = boots; lastMat = MAT_BOOT; }
  if (skin < d) { d = skin; lastMat = MAT_SKIN; }
  if (hair < d) { d = hair; lastMat = MAT_HAIR; }
  return d;
}

interface Sculpt { geometry: THREE.BufferGeometry; triangles: number }

/**
 * Meshes a field and bakes material, occlusion, and sun per vertex.
 * bakeScale > 1 runs the sun bake on a magnified copy, so the fixed start
 * offsets of bakeSun fit a small sculpt.
 */
function sculpt(field: Field, bakeField: Field, bound: Field, min: [number, number, number], max: [number, number, number], cell: number, sunReach: number, bakeScale: number): Sculpt {
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
  const scaled = new Float32Array(mesh.positions.length);
  for (let i = 0; i < scaled.length; i++) scaled[i] = mesh.positions[i] * bakeScale;
  const scaledField: Field = (x, y, z) => bakeField(x / bakeScale, y / bakeScale, z / bakeScale) * bakeScale;
  g.setAttribute('aSun', new THREE.BufferAttribute(bakeSun(scaledField, scaled, nor, SUN, sunReach * bakeScale), 1));
  return { geometry: g, triangles: mesh.indices.length / 3 };
}

const SOLID_ATTRIBUTES = ['position', 'normal', 'aMat', 'aAO', 'aSun'];

/** Joins geometries that carry the solid attributes into one, so they share one draw call. */
function joinGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const name of SOLID_ATTRIBUTES) {
    const size = parts[0].getAttribute(name).itemSize;
    let total = 0;
    for (const p of parts) total += p.getAttribute(name).array.length;
    const merged = new Float32Array(total);
    let at = 0;
    for (const p of parts) {
      merged.set(p.getAttribute(name).array as Float32Array, at);
      at += p.getAttribute(name).array.length;
    }
    g.setAttribute(name, new THREE.BufferAttribute(merged, size));
  }
  let indexCount = 0;
  for (const p of parts) {
    const index = p.getIndex();
    if (!index) throw new Error('joinGeometries needs indexed geometries');
    indexCount += index.count;
  }
  const index = new Uint32Array(indexCount);
  let at = 0, base = 0;
  for (const p of parts) {
    const pi = p.getIndex() as THREE.BufferAttribute;
    for (let i = 0; i < pi.count; i++) index[at++] = pi.getX(i) + base;
    base += p.getAttribute('position').count;
    p.dispose();
  }
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

/** A straight round stick between two points, with the solid attributes. */
function buildStick(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: number): THREE.BufferGeometry {
  const RAD = 8;
  const axis = new THREE.Vector3().subVectors(b, a).normalize();
  const u = new THREE.Vector3(1, 0, 0).addScaledVector(axis, -axis.x).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u);
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (const end of [a, b]) {
    for (let j = 0; j < RAD; j++) {
      const ang = (j / RAD) * Math.PI * 2;
      const n = new THREE.Vector3().addScaledVector(u, Math.cos(ang)).addScaledVector(v, Math.sin(ang));
      pos.push(end.x + n.x * radius, end.y + n.y * radius, end.z + n.z * radius);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < RAD; j++) {
    const j1 = (j + 1) % RAD;
    idx.push(j, j1, RAD + j, j1, RAD + j1, RAD + j);
  }
  const count = RAD * 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(count).fill(mat), 1));
  g.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
  g.setAttribute('aSun', new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// Ridges and far mountains: one height field
// ---------------------------------------------------------------------------

interface Ridge { ax: number; az: number; bx: number; bz: number; ha: number; hb: number; width: number }

/** A ridge between two points given as bearing (degrees, 0 = straight ahead) and range. */
function ridge(azA: number, rA: number, ha: number, azB: number, rB: number, hb: number, width: number): Ridge {
  return {
    ax: Math.sin(azA * DEG) * rA, az: -Math.cos(azA * DEG) * rA,
    bx: Math.sin(azB * DEG) * rB, bz: -Math.cos(azB * DEG) * rB,
    ha, hb, width,
  };
}

// The composition of the painting: two ridges that fall toward the centre,
// a second tier of crags, and a third tier in the haze.
const RIDGES: Ridge[] = [
  ridge(-35, 400, -8, -5, 470, -40, 120),
  ridge(37, 360, -4, 6, 430, -42, 110),
  ridge(-18, 760, -6, -2, 860, -32, 150),
  ridge(8, 700, -14, 25, 800, 0, 150),
  ridge(-32, 1300, 26, -10, 1450, -4, 240),
  ridge(8, 1500, -6, 32, 1400, 34, 250),
];
const ROSENBERG = { x: Math.sin(-13 * DEG) * 2500, z: -Math.cos(-13 * DEG) * 2500 };
const ZIRKELSTEIN = { x: Math.sin(17.5 * DEG) * 2050, z: -Math.cos(17.5 * DEG) * 2050 };

function ridged(x: number, z: number): number {
  return 1 - Math.abs(2 * fbm2(x, z, 4) - 1);
}

/**
 * Profile of a sandstone ridge: a wooded slope, then a rock cap with steep
 * walls. p = 0 at the foot and 1 on the crest. crag is about 1 and breaks the
 * cap into teeth.
 */
function capProfile(p: number, crag: number): number {
  return 0.6 * Math.pow(p, 0.8) + 0.4 * smoothstep(0.5, 0.76, p) * crag;
}

function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const az = Math.atan2(x, -z);
  let h = VALLEY + 14 * fbm2(x * 0.004 + 3, z * 0.004, 3);
  // The cap breaks into pillars of unequal height.
  worley(x, z, 17, 71);
  const crag = 0.62 + 0.42 * ridged(x * 0.013 + 2, z * 0.013) + 0.42 * (wHash - 0.5) + 0.14 * (fbm2(x * 0.05, z * 0.05 + 5, 3) - 0.5);

  // Crags in every direction, held down inside the view of the painting.
  const outside = smoothstep(30 * DEG, 52 * DEG, Math.abs(az));
  const amb = smoothstep(0.55, 1, ridged(x * 0.0019 + 7.3, z * 0.0019 + 1.1));
  const ambGain = smoothstep(90, 260, r) * (1 - smoothstep(1700, 2600, r)) * mix(0.25, 1, outside);
  h = Math.max(h, VALLEY + 108 * ambGain * capProfile(amb, crag));

  for (const rd of RIDGES) {
    const dx = rd.bx - rd.ax, dz = rd.bz - rd.az;
    const t = clamp(((x - rd.ax) * dx + (z - rd.az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - rd.ax - dx * t, z - rd.az - dz * t);
    if (d >= rd.width) continue;
    const crest = mix(rd.ha, rd.hb, t) - VALLEY;
    h = Math.max(h, VALLEY + crest * capProfile(1 - d / rd.width, crag));
  }

  // The Rosenberg: a broad cone with long concave slopes.
  const dr = Math.hypot(x - ROSENBERG.x, z - ROSENBERG.z);
  if (dr < 1050) h = Math.max(h, VALLEY + 228 * Math.pow(1 - dr / 1050, 1.4) * (0.94 + 0.12 * fbm2(x * 0.004, z * 0.004 + 9, 3)));
  // The Zirkelstein: a small table rock on a wooded rise.
  const dzk = Math.hypot(x - ZIRKELSTEIN.x, z - ZIRKELSTEIN.z);
  if (dzk < 420) {
    h = Math.max(h, VALLEY + 92 * Math.pow(1 - dzk / 420, 1.2));
    h = Math.max(h, mix(VALLEY, 38 + 5 * noise2(x * 0.03, z * 0.03), smoothstep(64, 50, dzk)));
  }
  // The last range, almost lost in the haze.
  const rim = Math.exp(-Math.pow((r - 3100) / 330, 2));
  h = Math.max(h, VALLEY + (115 + 75 * noise2(az * 3.1, 2)) * rim * (0.55 + 0.9 * fbm2(az * 9, 5, 3)));

  // The valley is empty around the pinnacle.
  return mix(VALLEY, h, smoothstep(30, 110, r));
}

function buildTerrain(): THREE.BufferGeometry {
  const NR = 300, NT = 800, R0 = 24, R1 = 3700;
  const pos = new Float32Array((NR + 1) * NT * 3);
  for (let i = 0; i <= NR; i++) {
    const r = R0 * Math.pow(R1 / R0, i / NR);
    for (let j = 0; j < NT; j++) {
      const a = (j / NT) * Math.PI * 2;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r;
      const k = (i * NT + j) * 3;
      pos[k] = x;
      pos[k + 1] = terrainHeight(x, z);
      pos[k + 2] = z;
    }
  }
  const idx = new Uint32Array(NR * NT * 6);
  let t = 0;
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NT; j++) {
      const a = i * NT + j, b = i * NT + ((j + 1) % NT), c = a + NT, d = b + NT;
      idx[t++] = a; idx[t++] = b; idx[t++] = c;
      idx[t++] = b; idx[t++] = d; idx[t++] = c;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** A spruce: a cone with three drooping tiers. */
function buildSpruceGeometry(): THREE.BufferGeometry {
  const RAD = 7, SEG = 9;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const tier = (t * 3) % 1;
    const r = i === SEG ? 0 : (1 - t) * (0.55 + 0.45 * (1 - tier)) * (t < 0.08 ? 0.3 : 1);
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

// ---------------------------------------------------------------------------
// Fog noise: two tiling fbm layers in one texture
// ---------------------------------------------------------------------------

function periodicNoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period, x1 = (x0 + 1) % period;
  const y0 = ((iy % period) + period) % period, y1 = (y0 + 1) % period;
  const a = cellHash(x0, y0, seed), b = cellHash(x1, y0, seed);
  const c = cellHash(x0, y1, seed), d = cellHash(x1, y1, seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

function bakeFogNoise(): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const layer = (u: number, v: number, base: number, octaves: number, seed: number): number => {
    let sum = 0, amp = 0.5, f = base, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * periodicNoise(u * f, v * f, f, seed + o * 7);
      norm += amp;
      f *= 2;
      amp *= 0.5;
    }
    return clamp((sum / norm - 0.5) * 2.2 + 0.5, 0, 1);
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      data[i] = layer(x / N, y / N, 3, 5, 11) * 255;
      data[i + 1] = layer(x / N, y / N, 5, 4, 67) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Shaders. Light is summed in linear values; the scene colour is stored
// square-root encoded for 8-bit precision.
// ---------------------------------------------------------------------------

const ATMOSPHERE = /* glsl */ `
uniform sampler2D tFog;
uniform vec3 uCam;
uniform vec3 uSun;
uniform float uTime;
const float FOG_LO = ${FOG_LO.toFixed(1)};
const float FOG_HI = ${FOG_HI.toFixed(1)};
const float WISP_HI = ${WISP_HI.toFixed(1)};
vec3 lin(float r, float g, float b) { return vec3(r * r, g * g, b * b); }
vec3 hazeColor() { return lin(0.79, 0.82, 0.87); }
/** Level of the top of the fog: slow banks plus small wisps that drift across them. */
float fogTop(vec2 xz) {
  float a = textureLod(tFog, xz / 1100.0 + uTime * vec2(0.0009, 0.0003), 0.0).r;
  float b = textureLod(tFog, xz / 430.0 - uTime * vec2(0.0024, -0.0013), 0.0).g;
  float c = textureLod(tFog, xz / 140.0 + uTime * vec2(-0.004, 0.0052), 0.0).r;
  return FOG_LO + 22.0 * a + 16.0 * b + 6.0 * c;
}
/** Marches the fog along a view ray. rgb = light scattered toward the eye, a = transmittance. */
vec4 fogMarch(vec3 rd, float dist) {
  float t0 = 0.0;
  float t1 = dist;
  float above = uCam.y - WISP_HI;
  if (above > 0.0) {
    if (rd.y > -1e-4) return vec4(0.0, 0.0, 0.0, 1.0);
    t0 = above / -rd.y;
  } else if (rd.y > 1e-4) {
    t1 = min(t1, -above / rd.y);
  }
  if (t0 >= t1) return vec4(0.0, 0.0, 0.0, 1.0);
  float span = min(t1 - t0, min(2600.0, 126.0 / max(abs(rd.y), 1e-3)));
  float dt = span / 16.0;
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float t = t0 + dt * jitter;
  vec2 sunStep = normalize(uSun.xz) * 45.0;
  float sunRise = 45.0 * uSun.y / length(uSun.xz);
  vec3 lit = lin(0.99, 0.975, 0.95);
  vec3 shade = lin(0.57, 0.64, 0.76);
  vec3 haze = hazeColor();
  vec3 acc = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < 16; i++) {
    vec3 p = uCam + rd * t;
    float top = fogTop(p.xz);
    float dens = smoothstep(0.0, 14.0, top - p.y);
    // The veil: torn wisps in a thin layer above the banks.
    float torn = textureLod(tFog, p.xz / 520.0 + uTime * vec2(0.0042, -0.0011), 0.0).g + 0.5 * textureLod(tFog, p.xz / 170.0 - uTime * vec2(0.002, 0.006), 0.0).r;
    float veil = smoothstep(0.78, 1.15, torn) * smoothstep(WISP_HI, WISP_HI - 7.0, p.y) * smoothstep(top - 4.0, top + 6.0, p.y);
    dens += 0.16 * veil;
    if (dens > 0.002) {
      // A bank is in shadow where the fog toward the sun stands higher than the sun ray.
      float shadow = smoothstep(-10.0, 10.0, fogTop(p.xz + sunStep) - (p.y + sunRise));
      float deep = exp(-max(top - p.y, 0.0) / 20.0);
      // Crests of the banks are bright, the troughs between them are blue.
      float crest = smoothstep(FOG_LO + 6.0, FOG_LO + 38.0, top);
      vec3 c = mix(shade, lit, (1.0 - 0.75 * shadow) * mix(0.45, 1.0, deep) * mix(0.42, 1.0, max(crest, veil)));
      c = mix(c, haze, 1.0 - exp(-t * 0.00042));
      float a = 1.0 - exp(-dens * 0.035 * dt);
      acc += T * a * c;
      T *= 1.0 - a;
    }
    t += dt;
  }
  return vec4(acc, T);
}
/** Aerial haze, then the fog between the eye and the surface. */
vec3 atmosphere(vec3 col, vec3 wp) {
  vec3 rd = wp - uCam;
  float dist = length(rd);
  rd /= dist;
  col = mix(col, hazeColor(), 1.0 - exp(-dist * 0.00042));
  vec4 f = fogMarch(rd, dist);
  return col * f.a + f.rgb;
}
const vec3 SUN_COLOR = vec3(1.5, 1.32, 1.05);
vec3 skyLight(vec3 n) {
  return lin(0.62, 0.68, 0.78) * (0.42 + 0.58 * n.y) + lin(0.58, 0.6, 0.64) * (0.5 - 0.5 * n.y) * 0.6;
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
varying vec3 vWp;
varying vec3 vN;
varying float vMat;
varying float vAO;
varying float vSun;
${GLSL_NOISE}
${ATMOSPHERE}
void main() {
  vec3 n = normalize(vN);
  vec3 p = vWp;
  vec3 V = normalize(uCam - p);
  vec3 albedo;
  vec3 nb = n;
  float sheen = 0.0;
  if (vMat < 0.5) {
    // Elbe sandstone: dark, bedded, with lichen and heather on the flat tops.
    vec3 bedScale = vec3(0.9, 5.5, 0.9);
    float beds = fbm3(p * bedScale);
    float grain = fbm3(p * 4.0 + 7.0);
    albedo = mix(lin(0.25, 0.19, 0.15), lin(0.5, 0.4, 0.29), smoothstep(0.25, 0.8, beds));
    albedo = mix(albedo, lin(0.68, 0.6, 0.47), smoothstep(0.55, 0.85, grain) * 0.4);
    float joint = vnoise(vec2(atan(p.x, p.z) * 60.0 + 3.0 * vnoise(vec2(p.y * 0.8, 1.0)), p.y * 0.3));
    albedo = mix(albedo, lin(0.14, 0.1, 0.08), smoothstep(0.62, 0.82, joint) * 0.6 * (1.0 - abs(n.y)));
    float growth = smoothstep(0.72, 0.95, n.y) * smoothstep(0.38, 0.62, fbm3(p * 1.3 + 3.0));
    albedo = mix(albedo, mix(lin(0.17, 0.2, 0.1), lin(0.33, 0.3, 0.13), grain), growth * 0.8);
    vec2 e = vec2(0.05, 0.0);
    vec3 g = vec3(fbm3((p + e.xyy) * bedScale), fbm3((p + e.yxy) * bedScale), fbm3((p + e.yyx) * bedScale)) - beds;
    nb = normalize(n - 1.3 * (g - n * dot(g, n)));
  } else if (vMat < 1.5) {
    // Dark green frock coat and trousers.
    float nap = fbm3(p * vec3(26.0, 9.0, 26.0));
    albedo = mix(lin(0.1, 0.15, 0.115), lin(0.16, 0.215, 0.16), nap);
    sheen = 0.5;
  } else if (vMat < 2.5) {
    albedo = lin(0.13, 0.1, 0.075);
    sheen = 0.3;
  } else if (vMat < 3.5) {
    // Red-blond hair, in strands.
    float strand = vnoise(vec2(p.x * 190.0 + p.z * 120.0, p.y * 30.0));
    albedo = mix(lin(0.44, 0.26, 0.12), lin(0.76, 0.54, 0.29), strand);
    sheen = 0.6;
  } else if (vMat < 4.5) {
    albedo = lin(0.82, 0.62, 0.5);
  } else {
    albedo = lin(0.36, 0.25, 0.14);
  }
  float ndl = max(dot(nb, uSun), 0.0);
  vec3 col = albedo * (SUN_COLOR * ndl * vSun + skyLight(nb) * vAO);
  // The bright fog throws a cool rim onto every edge that faces it.
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += sheen * rim * lin(0.5, 0.55, 0.6) * (0.4 + 0.6 * vAO) * 0.35;
  col = atmosphere(col, p);
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const TERRAIN_VERT = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normal;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const TERRAIN_FRAG = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
${GLSL_NOISE}
${ATMOSPHERE}
void main() {
  vec3 n = normalize(vN);
  vec3 p = vWp;
  float dist = length(p - uCam);
  float near = 1.0 - smoothstep(500.0, 1500.0, dist);
  float grain = mix(0.5, fbm(p.xz * 0.09), near);
  float fine = mix(0.5, fbm(p.xz * 0.5 + 5.0), near);
  // Bare rock where the ground is steep, dark spruce wood where it is not.
  float steep = 1.0 - n.y + 0.3 * (grain - 0.5);
  vec3 rock = mix(lin(0.27, 0.22, 0.19), lin(0.55, 0.47, 0.38), grain);
  rock *= 0.8 + 0.4 * vnoise(vec2(p.y * 0.45, atan(p.x, p.z) * 400.0));
  vec3 wood = mix(lin(0.1, 0.13, 0.1), lin(0.19, 0.22, 0.14), fine);
  vec3 albedo = mix(wood, rock, smoothstep(0.16, 0.4, steep));
  float ndl = max(dot(n, uSun), 0.0);
  vec3 col = albedo * (SUN_COLOR * ndl + skyLight(n));
  col = atmosphere(col, p);
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const SPRUCE_VERT = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
varying float vH;
void main() {
  vH = position.y;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SPRUCE_FRAG = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
varying float vH;
${GLSL_NOISE}
${ATMOSPHERE}
void main() {
  vec3 n = normalize(vN);
  vec3 albedo = mix(lin(0.07, 0.1, 0.075), lin(0.15, 0.19, 0.12), vnoise(vWp.xz * 0.7 + vWp.y * 0.9));
  float wrap = max(dot(n, uSun) * 0.6 + 0.4, 0.0);
  vec3 col = albedo * (SUN_COLOR * wrap * wrap * (0.5 + 0.5 * vH) + skyLight(n) * (0.4 + 0.6 * vH));
  col = atmosphere(col, vWp);
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
varying vec3 vDir;
${GLSL_NOISE}
${ATMOSPHERE}
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float h = clamp(el / 1.25, 0.0, 1.0);
  float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  // Morning: cream light low in the sky, pale blue above it, slate blue overhead.
  vec3 hor = mix(lin(0.86, 0.86, 0.87), lin(0.98, 0.93, 0.8), pow(toSun, 2.0) * 0.8);
  vec3 col = mix(hor, lin(0.75, 0.81, 0.87), smoothstep(0.0, 0.16, h));
  col = mix(col, lin(0.5, 0.61, 0.76), smoothstep(0.12, 0.75, h));
  // Long bars of stratus that drift very slowly.
  vec2 cp = d.xz / (d.y + 0.16);
  float band = fbm(vec2(cp.x * 0.16 + uTime * 0.002, cp.y * 0.9) + 3.0);
  float wisp = fbm(vec2(cp.x * 0.6 - uTime * 0.004, cp.y * 3.2) + 11.0);
  float dens = band * 0.75 + wisp * 0.35;
  float cover = smoothstep(0.46, 0.68, dens) * smoothstep(0.0, 0.07, h);
  vec3 cloudLit = mix(lin(0.94, 0.91, 0.89), lin(1.0, 0.94, 0.82), pow(toSun, 2.0));
  float edge = smoothstep(0.46, 0.58, dens) - 0.6 * smoothstep(0.6, 0.8, dens);
  vec3 cloud = mix(lin(0.66, 0.69, 0.77), cloudLit, edge);
  col = mix(col, cloud, cover * 0.8);
  col = mix(hazeColor(), col, smoothstep(-0.03, 0.03, el));
  vec4 f = fogMarch(d, 1.0e6);
  col = col * f.a + f.rgb;
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const POST_FRAG = /* glsl */ `
vec3 scene(vec2 uv) { return texture2D(tScene, uv).rgb; }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  // Kuwahara: keep the calmest of four neighbourhoods. Friedrich's surface is smooth, so the radius is small.
  vec3 best = vec3(0.0);
  float bestVar = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 sgn = vec2(q == 0 || q == 2 ? 1.0 : -1.0, q < 2 ? 1.0 : -1.0);
    vec3 m = vec3(0.0); vec3 m2 = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 3; i++) {
        vec3 c = scene(vUv + sgn * vec2(float(i), float(j)) * px * 1.1);
        m += c; m2 += c * c;
      }
    }
    m /= 9.0; m2 = m2 / 9.0 - m * m;
    float v = m2.r + m2.g + m2.b;
    if (v < bestVar) { bestVar = v; best = m; }
  }
  vec3 col = mix(scene(vUv), best, 0.88);

  // Thin glazes: a little relief from the luminance, and the canvas weave.
  float l0 = dot(best, vec3(0.3, 0.6, 0.1));
  float lx = dot(scene(vUv + vec2(px.x * 1.5, 0.0)), vec3(0.3, 0.6, 0.1)) - l0;
  float ly = dot(scene(vUv + vec2(0.0, px.y * 1.5)), vec3(0.3, 0.6, 0.1)) - l0;
  col *= 1.0 + (lx - ly) * 0.6;
  col *= 0.95 + 0.075 * canvasWeave(cv);

  // Craquelure: a fine net of age cracks, strongest in the darks.
  vec2 cq = cv * 0.05 + 2.5 * vec2(vnoise(cv * 0.011), vnoise(cv * 0.011 + 9.0));
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
  float crackle = 1.0 - smoothstep(0.0, 0.03, d2 - d1);
  col *= 1.0 - crackle * (0.035 + 0.075 * (1.0 - smoothstep(0.1, 0.6, l0)));

  // Grade: warm the lights like old varnish, keep the darks cool.
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col = mix(col, col * vec3(1.05, 1.0, 0.9), smoothstep(0.3, 0.9, lum));
  col = mix(col, col * vec3(0.94, 1.0, 1.0) + vec3(0.008, 0.012, 0.014), 1.0 - smoothstep(0.0, 0.3, lum));
  col = mix(vec3(lum), col, 1.06);
  col *= vignette(vUv, 0.5);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

/** Lowest camera height: above the rock, above the ridges, and above the mean level of the fog. */
function floorAt(x: number, z: number): number {
  const inTower = x > TOWER_MIN[0] && x < TOWER_MAX[0] && z > TOWER_MIN[2] && z < TOWER_MAX[2];
  const rock = inTower ? cragTop(x, z) + 0.6 : VALLEY;
  return Math.max(rock, terrainHeight(x, z) + 1.5, FOG_HI - 8);
}

export function createWandererFog(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 6000;
  const fogNoise = bakeFogNoise();
  const uniforms = {
    tFog: { value: fogNoise },
    uCam: { value: new THREE.Vector3() },
    uSun: { value: SUN },
    uTime: { value: 0 },
  };

  const solidMat = new THREE.ShaderMaterial({ vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG, uniforms });

  const fineTops = new TopTable(FINE_MIN, FINE_MAX, FINE_CELL);
  const towerTops = new TopTable(TOWER_MIN, TOWER_MAX, TOWER_CELL);
  const summitField: Field = (x, y, z) => cragField(fineTops.at(x, z), x, y, z, true);
  const towerField: Field = (x, y, z) => {
    const d = cragField(towerTops.at(x, z), x, y, z, true);
    // Leave out the volume that the fine summit mesh covers.
    const inner = Math.max(Math.abs(x) - 7.25, Math.abs(z - 2.7) - 6.75, -4.85 - y);
    return Math.max(d, -inner);
  };
  // Light bakes for the rock also see the wanderer, so his shadow lies on the summit.
  const cragBake: Field = (x, y, z) => {
    const top = fineTops.covers(x, z) ? fineTops.at(x, z) : towerTops.covers(x, z) ? towerTops.at(x, z) : cragTop(x, z);
    return Math.min(cragField(top, x, y, z, false) * 0.45, figureField(x, y, z));
  };
  const summit = sculpt(summitField, cragBake, cragBound, FINE_MIN, FINE_MAX, FINE_CELL, 14, 1);
  const tower = sculpt(towerField, cragBake, cragBound, TOWER_MIN, TOWER_MAX, TOWER_CELL, 40, 1);
  const pinnacle = new THREE.Mesh(joinGeometries([summit.geometry, tower.geometry]), solidMat);
  pinnacle.frustumCulled = false;
  scene.add(pinnacle);

  const figure = sculpt(figureField, figureField, figureBound, [-0.46, -0.03, -0.58], [0.46, 1.87, 0.34], 0.016, 2.5, 6);
  const cane = buildStick(new THREE.Vector3(0.321, 0.935, -0.082), new THREE.Vector3(0.372, -0.02, -0.132), 0.0115, MAT_CANE);
  const wanderer = new THREE.Mesh(joinGeometries([figure.geometry, cane]), solidMat);
  wanderer.frustumCulled = false;
  scene.add(wanderer);

  const terrain = new THREE.Mesh(buildTerrain(), new THREE.ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms }));
  terrain.frustumCulled = false;
  scene.add(terrain);

  // Spruces on the ground that stands clear of the fog.
  const rand = mulberry32(1818);
  const trees: Array<{ x: number; y: number; z: number; h: number; w: number }> = [];
  for (let tries = 0; tries < 40000 && trees.length < 1100; tries++) {
    const a = rand() * Math.PI * 2, r = 130 + Math.pow(rand(), 1.6) * 1500;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    const y = terrainHeight(x, z);
    if (y < FOG_LO + 20 || y > 60) continue;
    const slope = Math.hypot(terrainHeight(x + 3, z) - y, terrainHeight(x, z + 3) - y) / 3;
    if (slope > 1.1 || fbm2(x * 0.02 + 40, z * 0.02, 3) < 0.42) continue;
    const h = 9 + rand() * 9;
    trees.push({ x, y: y - 1, z, h, w: h * (0.2 + rand() * 0.08) });
  }
  const spruces = new THREE.InstancedMesh(
    buildSpruceGeometry(),
    new THREE.ShaderMaterial({ vertexShader: SPRUCE_VERT, fragmentShader: SPRUCE_FRAG, uniforms }),
    trees.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  trees.forEach((t, i) => {
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.08, rand() * 6.28, (rand() - 0.5) * 0.08));
    spruces.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.w, t.h, t.w)));
  });
  spruces.frustumCulled = false;
  scene.add(spruces);

  // The dome draws last, so the surfaces in front of it save its fog march.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms, side: THREE.BackSide }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = 10;
  scene.add(sky);

  return {
    scene,
    meta: {
      title: 'Wanderer above the Sea of Fog',
      artist: 'Caspar David Friedrich · 1818',
      technique: 'SDF-sculpted pinnacle and figure with baked AO + sun, polar height-field ridges, ray-marched drifting fog banks, Kuwahara oil filter, craquelure and varnish.',
    },
    presets: [
      { name: 'The Painting', position: [0, 1.55, 7.6], target: [0, 1.02, 0], fov: 30 },
      { name: 'Over His Shoulder', position: [1.1, 2.05, 1.9], target: [-7, -3, -60], fov: 56 },
      { name: 'The Precipice', position: [-17, -5, -30], target: [0, -2.5, 0], fov: 42 },
      { name: 'Above the Fog', position: [70, 62, 150], target: [-10, -18, -160], fov: 44 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.2,
    far,
    flySpeed: 14,
    maxDistance: 900,
    floorAt,
    update(ctx: FrameContext): void {
      uniforms.uTime.value = ctx.time;
      uniforms.uCam.value.copy(ctx.camera.position);
      sky.position.copy(ctx.camera.position);
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      fogNoise.dispose();
    },
  };
}
