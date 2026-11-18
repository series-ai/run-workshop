// The Great Wave off Kanagawa — Katsushika Hokusai, c. 1831.
//
// The sea is one sculpted sheet. A hand-placed profile curve (back, crest,
// overhanging lip, hollow, trough) is swept back in depth as a tube whose
// amplitude falls off. The near end is open and closed by a rounded horn, so
// the print's viewpoint looks into the hollow. Foam is a fractal fringe of
// instanced hooked claws on the crest and the lip. Materials write flat
// woodblock colours plus a region id in alpha; the post pass inks a keyblock
// line wherever the id or the depth breaks, then prints on washi paper.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { hex, mix, mulberry32, smoothstep, type RGB } from '../util';

const INK = {
  prussian: hex(0x14305a),
  mid: hex(0x2a5c8c),
  light: hex(0x8eb2c2),
  foam: hex(0xf5efdc),
  foamShade: hex(0xb4cad0),
  paper: hex(0xdfd2b0),
  skyBand: hex(0x77735f),
  wood: hex(0xd6c389),
  woodDark: hex(0xa88f58),
  indigo: hex(0x2c4f76),
  skin: hex(0xe0c49a),
};

function v3(c: RGB): THREE.Vector3 {
  return new THREE.Vector3(c[0], c[1], c[2]);
}

// ---------------------------------------------------------------------------
// Sea sheet
// ---------------------------------------------------------------------------

/** Peak cross-section at full amplitude: back of the wave up to the lip tip. */
const UPPER: Array<[number, number]> = [
  [-42, 0.2], [-32, 1.4], [-24, 4.3], [-17.5, 8.4], [-13, 12.4], [-9, 15.4],
  [-5, 17.2], [-1.5, 17.5], [1.4, 16.3], [3.0, 13.9], [3.3, 11.5], [2.6, 9.4],
];
/** Lip tip, underside, hollow face, and trough. */
const LOWER: Array<[number, number]> = [
  [2.6, 9.4], [1.5, 11.5], [-0.2, 13.2], [-2.8, 14.1], [-5.4, 13.5], [-7.6, 11.6],
  [-9.0, 8.6], [-9.3, 5.4], [-8.2, 2.4], [-5.8, 0.55], [-2.5, 0.0], [3, 0], [9, 0], [18, 0],
];

function gauss(dx: number, dz: number, rx: number, rz: number): number {
  return Math.exp(-((dx * dx) / (rx * rx) + (dz * dz) / (rz * rz)));
}

/** Pointed swell with concave flanks: the small wave that echoes Fuji. */
function mound(dx: number, dz: number, rx: number, rz: number): number {
  const r = Math.hypot(dx / rx, dz / rz);
  return Math.exp(-Math.pow(r, 1.25) * 1.6);
}

const MOUND = { x: -3.2, z: 27, h: 3.0 };

function swell(x: number, z: number): number {
  let h = 0.32 * Math.sin(x * 0.11 + z * 0.07 + 0.5) + 0.22 * Math.sin(x * 0.05 - z * 0.13 + 2.0);
  h += MOUND.h * mound(x - MOUND.x, z - MOUND.z, 5.2, 6.5);
  h += 2.5 * gauss(x - 15, z - 20, 10, 11);
  h += 2.6 * gauss(x + 9, z - 13, 7, 6);
  h += 1.6 * gauss(x - 34, z + 30, 26, 16) + 1.3 * gauss(x + 50, z - 30, 22, 18) + 1.4 * gauss(x - 6, z + 70, 30, 14);
  h -= 0.9 * gauss(x - 4, z - 38, 14, 7);
  return h;
}

/** The wave lives behind z = 0. In front of it the sea is open. */
function amplitude(z: number): number {
  return 1 / (1 + Math.pow(-z / 27, 2.4));
}

/**
 * Crest line in plan view. The wall drifts toward +x with depth at the rate
 * that keeps its lip behind the great claw from the print's viewpoint, so the
 * hollow shows only the dark face of the wave.
 */
function peel(z: number): number {
  return 0.056 * -z;
}

interface Column {
  xFull: number;
  yFull: number;
  xFlat: number;
  /** 0..1 along the upper curve, 1..2 along the lower curve, outside for the open sea. */
  s: number;
  core: number;
}

interface Sheet {
  columns: Column[];
  zs: number[];
  positions: Float32Array;
  tipColumn: number;
  coreStart: number;
  /** Row of the wave's open end at z = 0. */
  endRow: number;
  crestS: number;
  geometry: THREE.BufferGeometry;
}

function buildSheet(): Sheet {
  const curve = (pts: Array<[number, number]>, n: number): THREE.Vector3[] =>
    new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], 0)), false, 'centripetal').getSpacedPoints(n);
  const upper = curve(UPPER, 110);
  const lower = curve(LOWER, 100).slice(1);
  const columns: Column[] = [];
  const EXT = 18;
  for (let k = EXT; k >= 1; k--) {
    const x = UPPER[0][0] - Math.pow(k / EXT, 1.7) * 300;
    columns.push({ xFull: x, yFull: 0.2 * (1 - k / EXT), xFlat: x, s: -k / EXT, core: 1 - smoothstep(0, 11, k) });
  }
  const coreStart = columns.length;
  upper.forEach((p, i) => columns.push({ xFull: p.x, yFull: p.y, xFlat: 0, s: i / (upper.length - 1), core: 1 }));
  const tipColumn = columns.length - 1;
  lower.forEach((p, i) => columns.push({ xFull: p.x, yFull: p.y, xFlat: 0, s: 1 + (i + 1) / lower.length, core: 1 }));
  const coreEnd = columns.length - 1;
  // Flat state: spread the core along a line in proportion to arc length.
  let total = 0;
  const arc = [0];
  for (let i = coreStart + 1; i <= coreEnd; i++) {
    total += Math.hypot(columns[i].xFull - columns[i - 1].xFull, columns[i].yFull - columns[i - 1].yFull);
    arc.push(total);
  }
  const xa = columns[coreStart].xFull, xb = columns[coreEnd].xFull;
  for (let i = coreStart; i <= coreEnd; i++) columns[i].xFlat = mix(xa, xb, arc[i - coreStart] / total);
  for (let k = 1; k <= EXT; k++) {
    const x = xb + Math.pow(k / EXT, 1.7) * 300;
    columns.push({ xFull: x, yFull: 0, xFlat: x, s: 2 + k / EXT, core: 1 - smoothstep(0, 11, k) });
  }
  let crestS = 0, crestY = -1;
  for (const c of columns) if (c.yFull > crestY) { crestY = c.yFull; crestS = c.s; }

  // Rows behind z = 0 carry the wave. Row endRow is its open end. The next row
  // starts the open sea at the same z, and no triangles join the two.
  const zs: number[] = [0];
  for (let z = 0; z > -330; ) { z -= 0.5 * (1 + Math.max(0, -z - 22) * 0.14); zs.unshift(z); }
  const endRow = zs.length - 1;
  zs.push(0);
  for (let z = 0; z < 130; ) { z += 0.42 * (1 + Math.max(0, z - 18) * 0.16); zs.push(z); }

  const C = columns.length, R = zs.length;
  const positions = new Float32Array(C * R * 3);
  const aS = new Float32Array(C * R);
  const aA = new Float32Array(C * R);
  for (let j = 0; j < R; j++) {
    const z = zs[j];
    const wave = j <= endRow;
    const a = wave ? amplitude(z) : 0;
    const sh = wave ? peel(z) : 0;
    const curl = Math.pow(a, 1.4);
    // The swell fades to nothing where the open sea meets the wave's end.
    const calm = wave ? a : 1 - smoothstep(0, 7, z);
    for (let i = 0; i < C; i++) {
      const c = columns[i];
      const x = mix(c.xFlat, c.xFull, curl) + sh * c.core;
      const k = (j * C + i) * 3;
      positions[k] = x;
      positions[k + 1] = c.yFull * a + swell(x, z) * (1 - calm * c.core);
      positions[k + 2] = z;
      aS[j * C + i] = c.s;
      aA[j * C + i] = a;
    }
  }
  const idx = new Uint32Array((C - 1) * (R - 1) * 6);
  let t = 0;
  for (let j = 0; j < R - 1; j++) {
    if (j === endRow) continue;
    for (let i = 0; i < C - 1; i++) {
      const a = j * C + i, b = a + 1, c = a + C, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  geometry.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
  geometry.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
  geometry.computeVertexNormals();
  return { columns, zs, positions, tipColumn, coreStart, endRow, crestS, geometry };
}

function rowNear(sheet: Sheet, z: number): number {
  const from = z > 0 ? sheet.endRow + 1 : 0;
  const to = z > 0 ? sheet.zs.length - 1 : sheet.endRow;
  let best = from;
  for (let j = from; j <= to; j++) if (Math.abs(sheet.zs[j] - z) < Math.abs(sheet.zs[best] - z)) best = j;
  return best;
}

function sheetPoint(sheet: Sheet, col: number, row: number): THREE.Vector3 {
  const k = (row * sheet.columns.length + col) * 3;
  return new THREE.Vector3(sheet.positions[k], sheet.positions[k + 1], sheet.positions[k + 2]);
}

/** Sea height in front of the wave face (trough and open sea), for boats. */
function seaHeightAt(sheet: Sheet, x: number, z: number): number {
  const row = rowNear(sheet, z);
  const C = sheet.columns.length;
  for (let i = C - 2; i > sheet.tipColumn; i--) {
    const a = sheetPoint(sheet, i, row), b = sheetPoint(sheet, i + 1, row);
    if (x >= a.x && x <= b.x) return mix(a.y, b.y, (x - a.x) / Math.max(b.x - a.x, 1e-6));
  }
  return swell(x, z);
}

const SEA_VERT = /* glsl */ `
attribute float aS;
attribute float aA;
varying float vS;
varying float vA;
varying vec3 vWp;
void main() {
  vS = aS; vA = aA;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SEA_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uPrussian;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uFoam;
uniform vec3 uMound;
varying float vS;
varying float vA;
varying vec3 vWp;
${GLSL_NOISE}
// Tapered brush stripe that runs along the profile: 1 inside the stripe.
float stripe(float coord, float along, float width) {
  float row = floor(coord);
  float f = abs(fract(coord) - 0.5) * 2.0;
  float taper = 0.55 + 0.45 * sin(along * 1.7 + hash11(row) * 6.28);
  float w = width * taper * (0.5 + hash11(row + 7.3));
  float aa = fwidth(coord) * 2.0 + 1e-4;
  return 1.0 - smoothstep(w - aa, w + aa, f);
}
void main() {
  float z = vWp.z;
  // Scalloped foam boundary on the lip.
  float lobes = abs(sin(z * 1.45 + 2.0 * vnoise(vec2(z * 0.4, 3.0)))) * 0.045 + 0.03 * vnoise(vec2(z * 2.3, vS * 30.0));
  float live = smoothstep(0.16, 0.3, vA);
  float foamTop = smoothstep(0.93 - lobes, 0.945 - lobes, vS) * (1.0 - step(1.0, vS));
  float foamUnder = step(1.0, vS) * (1.0 - smoothstep(1.05 + lobes, 1.065 + lobes, vS));
  float foam = (foamTop + foamUnder) * live;
  // The small wave in front carries its own foam cap.
  vec2 md = (vWp.xz - uMound.xy) / vec2(5.2, 6.5);
  float cap = smoothstep(0.60, 0.61, vWp.y / uMound.z + 0.045 * sin(vWp.x * 3.1 + vWp.z * 1.3) + 0.03 * sin(vWp.x * 7.3)) * (1.0 - step(0.75, length(md)));
  foam = max(foam, cap);

  float flow = z * 0.82 + uTime * 0.035;
  float warp = 0.5 * sin(vS * 9.0 + z * 0.21) + 1.6 * vnoise(vec2(vS * 2.6, z * 0.16));
  float sA = stripe(flow + warp, vS * 9.0, 0.34);
  float sB = stripe(flow * 0.53 + warp * 0.7 + 4.2, vS * 6.0 + 1.0, 0.3);

  // Hollow and trough are dark with pale streaks; the back is mid blue with dark streaks.
  float hollow = smoothstep(1.04, 1.12, vS) * (1.0 - smoothstep(2.0, 2.25, vS)) * smoothstep(0.1, 0.4, vA);
  vec3 back = mix(uMid, uPrussian, sA * 0.92);
  back = mix(back, uLight, sB * (1.0 - sA) * 0.55);
  vec3 face = mix(uPrussian, uLight, sA * 0.8);
  face = mix(face, uMid, sB * (1.0 - sA) * 0.7);
  vec3 col = mix(back, face, hollow);
  // Bokashi: troughs sink toward Prussian blue.
  col = mix(col, uPrussian, smoothstep(1.2, -1.6, vWp.y) * 0.45 * (1.0 - hollow));
  // Underside of the lip in pale shadow.
  float ceilBand = step(1.0, vS) * (1.0 - smoothstep(1.2, 1.3, vS)) * live;
  col = mix(col, uLight, ceilBand * 0.75);
  float id = mix(0.2, 0.32, ceilBand);

  // Foam lace on the back, below the crest.
  float lace = smoothstep(0.72, 0.92, vS) * (1.0 - step(1.0, vS)) * live;
  float cells = vnoise(vec2(z * 1.9, vS * 70.0)) * vnoise(vec2(z * 4.3 + 9.0, vS * 150.0));
  float dots = smoothstep(0.34, 0.36, cells * (0.6 + lace));
  foam = max(foam, dots * lace);

  col = mix(col, uFoam, foam);
  id = mix(id, 0.9, foam);
  gl_FragColor = vec4(col, id);
}
`;

// ---------------------------------------------------------------------------
// Foam: claws, lobes, spray
// ---------------------------------------------------------------------------

const CLAW_CURL = 1.85;

/** Centre line of the unit claw: a hook that curls toward -y. */
function clawPoint(s: number): { x: number; y: number; angle: number } {
  let x = 0, y = 0;
  const N = 24;
  for (let i = 0; i < N; i++) {
    const u = ((i + 0.5) / N) * s;
    const a = -CLAW_CURL * Math.pow(u, 1.25);
    x += (Math.cos(a) * s) / N;
    y += (Math.sin(a) * s) / N;
  }
  return { x, y, angle: -CLAW_CURL * Math.pow(s, 1.25) };
}

function buildClawGeometry(): THREE.BufferGeometry {
  const SEG = 11, RAD = 7;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const s = i / SEG;
    const c = clawPoint(s);
    const r = 0.2 * Math.pow(1 - s, 0.72) * (0.7 + 0.42 * smoothstep(0, 0.3, s)) + 0.002;
    const nx = -Math.sin(c.angle), ny = Math.cos(c.angle);
    for (let j = 0; j < RAD; j++) {
      const a = (j / RAD) * Math.PI * 2;
      pos.push(c.x + nx * Math.cos(a) * r, c.y + ny * Math.cos(a) * r, Math.sin(a) * r * 0.82);
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

const FOAM_VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform float uWiggle;
uniform float uFall;
varying vec3 vN;
varying vec3 vWp;
void main() {
  vec3 p = position;
  // Claws flex at the knuckle; spray drifts down and loops.
  float w = uWiggle * sin(uTime * 1.1 + aPhase * 6.28);
  p.xy = mat2(cos(w), sin(w), -sin(w), cos(w)) * p.xy;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float cycle = fract(uTime * 0.03 * (0.6 + aPhase) + aPhase * 7.0);
  wp.y -= uFall * cycle * 5.0;
  wp.x += uFall * (cycle * 1.4 + 0.25 * sin(uTime * 0.7 + aPhase * 30.0));
  vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  centre.y -= uFall * cycle * 5.0;
  centre.x += uFall * (cycle * 1.4 + 0.25 * sin(uTime * 0.7 + aPhase * 30.0));
  float fade = mix(1.0, smoothstep(0.0, 0.1, cycle) * smoothstep(1.0, 0.8, cycle), step(0.5, uFall));
  wp.xyz = centre + (wp.xyz - centre) * fade;
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FOAM_FRAG = /* glsl */ `
uniform vec3 uFoam;
uniform vec3 uFoamShade;
uniform float uId;
uniform float uShade;
varying vec3 vN;
varying vec3 vWp;
void main() {
  vec3 n = normalize(vN);
  float lit = dot(n, normalize(vec3(0.45, 0.6, 0.66)));
  float shade = (1.0 - smoothstep(-0.32, -0.26, lit)) * uShade;
  gl_FragColor = vec4(mix(uFoam, uFoamShade, shade), uId - 0.07 * shade);
}
`;

// ---------------------------------------------------------------------------
// The horn: the sculpted near end of the wave
// ---------------------------------------------------------------------------

interface Horn {
  /** Back of the wave from its base up to the lip tip, at z = 0. */
  upper: THREE.Vector3[];
  /** Hollow face from the waterline up the ceiling to the lip tip, at z = 0. */
  lower: THREE.Vector3[];
  geometry: THREE.BufferGeometry;
}

function resample(points: THREE.Vector3[], n: number): THREE.Vector3[] {
  const acc = [0];
  for (let i = 1; i < points.length; i++) acc.push(acc[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = acc[acc.length - 1];
  const out: THREE.Vector3[] = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * total;
    while (k < acc.length - 2 && acc[k + 1] < d) k++;
    out.push(points[k].clone().lerp(points[k + 1], (d - acc[k]) / Math.max(acc[k + 1] - acc[k], 1e-6)));
  }
  return out;
}

/**
 * Ribs join the back curve to the hollow curve. The surface over the ribs
 * bulges toward the viewer, so the wave ends in a rounded, tapering horn.
 */
function buildHorn(sheet: Sheet): Horn {
  const upper: THREE.Vector3[] = [];
  for (let c = sheet.coreStart; c <= sheet.tipColumn; c++) upper.push(sheetPoint(sheet, c, sheet.endRow));
  const face: THREE.Vector3[] = [];
  for (let c = sheet.tipColumn; c < sheet.columns.length; c++) {
    const p = sheetPoint(sheet, c, sheet.endRow);
    face.push(p);
    if (face.length > 20 && p.y < 0.06) break;
  }
  const NT = upper.length, NW = 16;
  const lower = resample(face.reverse(), NT);
  const pos: number[] = [];
  const tw: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < NT; i++) {
    const thick = upper[i].distanceTo(lower[i]);
    const bulge = Math.min(0.42 * thick, 4.4);
    for (let k = 0; k <= NW; k++) {
      const w = k / NW;
      const p = upper[i].clone().lerp(lower[i], w);
      pos.push(p.x, p.y, bulge * Math.pow(Math.sin(Math.PI * w), 0.7));
      tw.push(i / (NT - 1), w);
    }
  }
  for (let i = 0; i < NT - 1; i++) {
    for (let k = 0; k < NW; k++) {
      const a = i * (NW + 1) + k, b = a + 1, c = a + NW + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aTW', new THREE.Float32BufferAttribute(tw, 2));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return { upper, lower, geometry };
}

const HORN_VERT = /* glsl */ `
attribute vec2 aTW;
varying vec2 vTW;
varying vec3 vWp;
void main() {
  vTW = aTW;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const HORN_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uPrussian;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uFoam;
uniform vec3 uFoamShade;
varying vec2 vTW;
varying vec3 vWp;
${GLSL_NOISE}
float stripe(float coord, float along, float width) {
  float row = floor(coord);
  float f = abs(fract(coord) - 0.5) * 2.0;
  float taper = 0.5 + 0.5 * sin(along * 1.7 + hash11(row) * 6.28);
  float w = width * taper * (0.5 + hash11(row + 7.3));
  float aa = fwidth(coord) * 2.0 + 1e-4;
  return 1.0 - smoothstep(w - aa, w + aa, f);
}
void main() {
  float t = vTW.x; float w = vTW.y;
  float along = t * 62.0;
  // Foam band on the crest edge: scalloped, wider toward the lip, solid at the tip.
  float scal = abs(sin(along * 0.85 + 1.5 * vnoise(vec2(along * 0.3, 1.0))));
  float wf = (0.075 + 0.13 * smoothstep(0.5, 1.0, t) + 0.07 * scal + 0.035 * vnoise(vec2(along * 1.7, 5.0))) * smoothstep(0.2, 0.44, t);
  float foam = 1.0 - smoothstep(wf, wf + 0.01, w);
  foam = max(foam, smoothstep(0.962, 0.972, t + 0.02 * vnoise(vec2(w * 9.0, 2.0))));
  // Streaks follow the sweep of the wave from its root to the lip.
  float coord = w * 10.0 + 0.5 * sin(t * 11.0) + 1.3 * vnoise(vec2(t * 5.0, w * 2.2)) - uTime * 0.02;
  float sA = stripe(coord, t * 15.0, 0.36);
  float sB = stripe(coord * 0.57 + 3.3, t * 9.0 + 1.0, 0.3);
  vec3 col = mix(uMid, uPrussian, sA * 0.93);
  col = mix(col, uLight, sB * (1.0 - sA) * 0.62);
  col = mix(col, uPrussian, smoothstep(0.55, 0.97, w) * 0.8);
  col = mix(col, uPrussian, (1.0 - smoothstep(0.0, 0.34, t)) * 0.55);
  // Lace of foam flecks under the band.
  float lace = (1.0 - smoothstep(wf, wf + 0.22, w)) * smoothstep(0.25, 0.5, t);
  float cells = vnoise(vec2(along * 1.9, w * 46.0)) * vnoise(vec2(along * 4.1 + 9.0, w * 95.0));
  foam = max(foam, smoothstep(0.33, 0.35, cells * (0.55 + lace)) * lace);
  // Blue-grey shading strokes inside the foam, as the keyblock carves them.
  float fs = stripe(w * 34.0 + 2.0 * vnoise(vec2(along * 0.8, w * 6.0)), along * 2.3, 0.2);
  vec3 foamCol = mix(uFoam, uFoamShade, fs * 0.85);
  gl_FragColor = vec4(mix(col, foamCol, foam), mix(0.2, 0.9, foam));
}
`;

function buildFoam(sheet: Sheet, horn: Horn): THREE.Matrix4[] {
  const rand = mulberry32(1831);
  const claws: THREE.Matrix4[] = [];
  const Z = new THREE.Vector3(0, 0, 1);

  /** x axis = direction of the finger. It curls away from "out". */
  const pushClaw = (origin: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3, scale: number, depth: number): void => {
    const x = dir.clone().normalize();
    const z = new THREE.Vector3().crossVectors(x, out).normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    const m = new THREE.Matrix4().makeBasis(x.clone().multiplyScalar(scale), y.clone().multiplyScalar(scale), z.clone().multiplyScalar(scale));
    m.setPosition(origin);
    claws.push(m);
    if (depth <= 0) return;
    const n = scale > 2.0 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const s = 0.28 + (i / n) * 0.5 + rand() * 0.1;
      const c = clawPoint(s);
      const p = origin.clone().addScaledVector(x, c.x * scale).addScaledVector(y, c.y * scale);
      const tan = x.clone().multiplyScalar(Math.cos(c.angle)).addScaledVector(y, Math.sin(c.angle));
      const side = rand() < 0.5 ? 1 : -1;
      const d2 = tan.clone().applyAxisAngle(z, 0.45 + rand() * 0.5).applyAxisAngle(y, side * (0.25 + rand() * 0.5));
      pushClaw(p, d2, y.clone().applyAxisAngle(z, 0.6), scale * (0.36 + rand() * 0.16), depth - 1);
    }
  };

  const hand = (base: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3, size: number, fingers: number, spread: number): void => {
    for (let f = 0; f < fingers; f++) {
      const fan = mix(-spread, spread * 0.7, (f + rand() * 0.6) / fingers);
      const d = dir.clone().applyAxisAngle(Z, fan).applyAxisAngle(out, (rand() - 0.5) * 0.8);
      const o = base.clone().add(new THREE.Vector3(0, 0, (rand() - 0.3) * 0.7 * size));
      pushClaw(o, d, out.clone().applyAxisAngle(Z, fan), size * (0.55 + rand() * 0.6), size > 1.5 ? 1 : 0);
    }
  };

  const N = horn.upper.length;
  // Crest edge of the horn: hooks that lean with the wave.
  for (let i = Math.floor(N * 0.4); i < N - 3; ) {
    const t = i / (N - 1);
    const p = horn.upper[i];
    const tan = horn.upper[i + 2].clone().sub(horn.upper[i - 2]).normalize();
    const out = new THREE.Vector3(-tan.y, tan.x, 0);
    const size = 0.9 + 1.8 * Math.pow(smoothstep(0.4, 1.0, t), 1.5) * (0.7 + rand() * 0.6);
    hand(p.clone().addScaledVector(out, -0.3).setZ(0.2 + rand() * 0.9), tan.clone().applyAxisAngle(Z, 0.8), out, size, 2 + Math.floor(rand() * 2), 0.6);
    i += 1 + Math.floor(rand() * 2);
  }
  // The lip tip: the great claw.
  const tip = horn.upper[N - 1];
  const tipTan = tip.clone().sub(horn.upper[N - 4]).normalize();
  hand(tip.clone().setZ(0.5), tipTan, new THREE.Vector3(-tipTan.y, tipTan.x, 0), 2.6, 5, 0.8);
  // Underside of the lip: fingers that hang into the hollow.
  for (let i = N - 3; i > N * 0.84; ) {
    const p = horn.lower[i];
    const d = horn.lower[i - 2].clone().sub(horn.lower[i + 2]).normalize();
    const air = new THREE.Vector3(d.y, -d.x, 0);
    const dir = d.clone().multiplyScalar(-0.35).addScaledVector(air, 1).normalize();
    const size = 0.9 + 1.3 * smoothstep(N * 0.84, N, i) * (0.7 + rand() * 0.6);
    hand(p.clone().setZ(0.2 + rand() * 1.0), dir, new THREE.Vector3(1, 0.25, 0), size, 2 + Math.floor(rand() * 2), 0.45);
    i -= 2 + Math.floor(rand() * 2);
  }
  // Lip of the far wing, receding into the tube.
  for (let z = -1.6; z > -70; ) {
    const a = amplitude(z);
    const row = rowNear(sheet, z);
    const lip = sheetPoint(sheet, sheet.tipColumn, row);
    const before = sheetPoint(sheet, sheet.tipColumn - 3, row);
    const tangent = lip.clone().sub(before).setZ(0).normalize();
    if (a > 0.22) hand(lip, tangent, new THREE.Vector3(-tangent.y, tangent.x, 0), 0.5 + 1.3 * Math.pow(a, 1.4) * (0.7 + rand() * 0.6), 2 + Math.floor(rand() * 2), 0.7);
    z -= (1.1 + rand() * 0.8) * (1.6 - a);
  }
  // The small wave in front: a few hooks on its cap.
  for (let i = 0; i < 16; i++) {
    const ang = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 0.3;
    const x = MOUND.x + Math.cos(ang) * rr * 5.2, z = MOUND.z + Math.sin(ang) * rr * 6.5;
    const dir = new THREE.Vector3(0.8 + rand() * 0.4, 0.55 - rand() * 0.7, (rand() - 0.5) * 0.9);
    pushClaw(new THREE.Vector3(x, swell(x, z) - 0.05, z), dir, new THREE.Vector3(-0.3, 1, 0), 0.45 + rand() * 0.6, 0);
  }
  return claws;
}

function instanced(geometry: THREE.BufferGeometry, material: THREE.ShaderMaterial, matrices: THREE.Matrix4[], seed: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  const rand = mulberry32(seed);
  const phase = new Float32Array(matrices.length);
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    phase[i] = rand();
  });
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Fuji, sky, boats
// ---------------------------------------------------------------------------

const FUJI = { x: 31, z: -262, radius: 40, height: 18.5 };

function buildFuji(): THREE.BufferGeometry {
  const RAD = 72, H = 26;
  const pos: number[] = [];
  const hs: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= H; i++) {
    const t = i / H;
    const r = FUJI.radius * (0.84 * Math.pow(1 - t, 1.75) + 0.16 * (1 - t) + 0.035);
    for (let j = 0; j <= RAD; j++) {
      const a = (j / RAD) * Math.PI * 2;
      const rough = 1 + 0.03 * Math.sin(a * 9 + t * 7) + 0.02 * Math.sin(a * 23);
      pos.push(Math.cos(a) * r * rough, t * FUJI.height - 0.6, Math.sin(a) * r * rough);
      hs.push(t);
    }
  }
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j, b = a + 1, c = a + RAD + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const FUJI_VERT = /* glsl */ `
attribute float aH;
varying float vH;
varying vec3 vLocal;
void main() {
  vH = aH;
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FUJI_FRAG = /* glsl */ `
uniform vec3 uFoam;
varying float vH;
varying vec3 vLocal;
${GLSL_NOISE}
void main() {
  float ang = atan(vLocal.z, vLocal.x);
  // Snow tongues run down the gullies.
  float tongue = 0.16 * abs(sin(ang * 7.0 + 1.3)) + 0.1 * vnoise(vec2(ang * 9.0, 2.0)) + 0.05 * sin(ang * 23.0);
  float snow = smoothstep(0.50, 0.52, vH - tongue + 0.14);
  vec3 rock = mix(vec3(0.10, 0.17, 0.27), vec3(0.20, 0.31, 0.42), smoothstep(0.0, 0.6, vH));
  rock *= 0.93 + 0.14 * vnoise(vec2(ang * 30.0, vH * 40.0));
  gl_FragColor = vec4(mix(rock, uFoam, snow), mix(0.5, 0.62, snow));
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
uniform vec3 uPaper;
uniform vec3 uBand;
uniform vec3 uSea;
uniform float uFujiAz;
varying vec3 vDir;
${GLSL_NOISE}
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0)) * 57.2958;
  // Sumi bokashi: a dark band on the horizon that fades up into bare paper.
  float band = 1.0 - smoothstep(0.0, 13.0, el + 2.0 * vnoise(vec2(az * 3.0, 1.0)));
  vec3 col = mix(uPaper, uBand, band * 0.92);
  // The pale cloud that towers over Fuji.
  vec2 cp = vec2((az - uFujiAz) * 57.2958, el);
  float cloud = fbm(cp * vec2(0.07, 0.11) + vec2(3.0, 0.0)) + 0.35 * exp(-dot(cp * vec2(0.035, 0.05), cp * vec2(0.035, 0.05)) * 0.6);
  float cm = smoothstep(0.62, 0.78, cloud) * smoothstep(1.5, 9.0, el) * (1.0 - smoothstep(26.0, 40.0, el));
  col = mix(col, uPaper * vec3(1.035, 1.03, 1.02), cm * 0.8);
  col = mix(col, uPaper * 0.93, smoothstep(30.0, 85.0, el) * 0.6);
  col = mix(col, uSea, 1.0 - smoothstep(-0.6, -0.1, el));
  gl_FragColor = vec4(col, 0.0);
}
`;

interface BoatSpec { x: number; z: number; heading: number; lift: number }

function buildHull(): THREE.BufferGeometry {
  const ST = 28;
  const pos: number[] = [];
  const kind: number[] = [];
  const idx: number[] = [];
  const HALF = 5.7;
  // Cross-section from port gunwale, round the keel, to starboard gunwale, then the inner floor.
  const section = (t: number): Array<[number, number, number]> => {
    const w = 0.74 * Math.pow(Math.max(1 - Math.pow(Math.abs(t), 2.2), 0), 0.6) + 0.015;
    const sheer = 0.36 + 0.85 * Math.pow(Math.max(-t, 0), 3) + 0.4 * Math.pow(Math.max(t, 0), 2.6);
    const keel = -0.3 + 0.8 * Math.pow(Math.abs(t), 3);
    return [
      [-w, sheer, 0], [-w * 0.86, mix(keel, sheer, 0.45), 0], [-w * 0.45, keel + 0.04, 0], [0, keel, 0],
      [w * 0.45, keel + 0.04, 0], [w * 0.86, mix(keel, sheer, 0.45), 0], [w, sheer, 0],
      [w * 0.86, sheer - 0.08, 1], [w * 0.6, mix(keel, sheer, 0.55), 1], [0, mix(keel, sheer, 0.42), 1],
      [-w * 0.6, mix(keel, sheer, 0.55), 1], [-w * 0.86, sheer - 0.08, 1], [-w, sheer, 1],
    ];
  };
  const N = 13;
  for (let i = 0; i <= ST; i++) {
    const t = (i / ST) * 2 - 1;
    for (const [z, y, k] of section(t)) {
      pos.push(t * HALF, y, z);
      kind.push(k);
    }
  }
  for (let i = 0; i < ST; i++) {
    for (let j = 0; j < N - 1; j++) {
      const a = i * N + j, b = a + 1, c = a + N, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const BOAT_VERT = /* glsl */ `
attribute float aKind;
attribute vec3 aTint;
attribute float aPhase;
uniform float uTime;
varying vec3 vLocal;
varying float vKind;
varying vec3 vTint;
varying vec3 vN;
void main() {
  vLocal = position;
  vKind = aKind;
  vTint = aTint;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  wp.y += 0.16 * sin(uTime * 0.9 + aPhase * 6.28);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const HULL_FRAG = /* glsl */ `
uniform vec3 uWood;
uniform vec3 uWoodDark;
varying vec3 vLocal;
varying float vKind;
varying vec3 vTint;
varying vec3 vN;
void main() {
  // Strakes: two ink-dark plank seams along the hull.
  float seam = step(0.86, fract(vLocal.y * 2.3 + 0.3));
  vec3 col = mix(uWood, uWoodDark, vKind * 0.75);
  col = mix(col, uWoodDark * 0.7, seam * (1.0 - vKind) * 0.8);
  gl_FragColor = vec4(col, mix(0.70, 0.76, vKind));
}
`;

const ROWER_FRAG = /* glsl */ `
varying vec3 vLocal;
varying float vKind;
varying vec3 vTint;
varying vec3 vN;
void main() {
  // The crown of each head is shaved hair-dark.
  float hair = step(0.5, vKind) * smoothstep(0.25, 0.3, vLocal.y) ;
  vec3 col = mix(vTint, vec3(0.08, 0.12, 0.2), hair);
  gl_FragColor = vec4(col, 0.8 + 0.06 * vKind - 0.05 * hair);
}
`;

// ---------------------------------------------------------------------------
// Post: keyblock ink lines and washi paper
// ---------------------------------------------------------------------------

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  vec4 c = texture2D(tScene, vUv);
  // Keyblock line: region id break or depth break.
  float wob = 0.85 + 0.5 * vnoise(cv * 0.05);
  vec2 o = px * 1.15 * wob;
  float e = 0.0;
  e = max(e, abs(texture2D(tScene, vUv + vec2(o.x, 0.0)).a - c.a));
  e = max(e, abs(texture2D(tScene, vUv - vec2(o.x, 0.0)).a - c.a));
  e = max(e, abs(texture2D(tScene, vUv + vec2(0.0, o.y)).a - c.a));
  e = max(e, abs(texture2D(tScene, vUv - vec2(0.0, o.y)).a - c.a));
  e = max(e, abs(texture2D(tScene, vUv + o * 0.7).a - c.a));
  e = max(e, abs(texture2D(tScene, vUv - o * 0.7).a - c.a));
  float line = smoothstep(0.02, 0.05, e);
  line = max(line, smoothstep(0.006, 0.02, depthEdge(vUv, o)));
  vec3 ink = vec3(0.07, 0.12, 0.23);
  vec3 col = mix(c.rgb, ink, line * 0.93);

  // Pigment sits unevenly: baren pressure and wood grain.
  float baren = vnoise(cv * 0.035) * 0.6 + vnoise(cv * 0.011 + 7.0) * 0.4;
  float grain = vnoise(vec2(cv.x * 0.02, cv.y * 1.3));
  col *= 0.94 + 0.08 * baren + 0.025 * grain;
  // Washi: fibres and tooth.
  float fibre = vnoise(vec2(cv.x * 0.9, cv.y * 0.08) + 3.0) * vnoise(vec2(cv.x * 0.07, cv.y * 0.8));
  float tooth = hash21(floor(cv * 1.3));
  col = mix(col, col * vec3(1.03, 1.0, 0.94), 0.5);
  col *= 0.965 + 0.05 * fibre + 0.02 * tooth;
  col *= vignette(vUv, 0.22);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createGreatWave(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 1400;
  const time = { value: 0 };
  const colors = {
    uPrussian: { value: v3(INK.prussian) },
    uMid: { value: v3(INK.mid) },
    uLight: { value: v3(INK.light) },
    uFoam: { value: v3(INK.foam) },
    uFoamShade: { value: v3(INK.foamShade) },
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uPaper: { value: v3(INK.paper) }, uBand: { value: v3(INK.skyBand) }, uSea: { value: v3(INK.prussian) }, uFujiAz: { value: Math.atan2(FUJI.x, 46 - FUJI.z) } },
      side: THREE.BackSide,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const sheet = buildSheet();
  const sea = new THREE.Mesh(
    sheet.geometry,
    new THREE.ShaderMaterial({
      vertexShader: SEA_VERT,
      fragmentShader: SEA_FRAG,
      uniforms: { ...colors, uTime: time, uMound: { value: new THREE.Vector3(MOUND.x, MOUND.z, MOUND.h) } },
      side: THREE.DoubleSide,
    }),
  );
  sea.frustumCulled = false;
  scene.add(sea);

  const horn = buildHorn(sheet);
  const hornMesh = new THREE.Mesh(
    horn.geometry,
    new THREE.ShaderMaterial({ vertexShader: HORN_VERT, fragmentShader: HORN_FRAG, uniforms: { ...colors, uTime: time }, side: THREE.DoubleSide }),
  );
  hornMesh.frustumCulled = false;
  scene.add(hornMesh);

  const foam = buildFoam(sheet, horn);
  const foamMat = (id: number, wiggle: number, fall: number): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({
      vertexShader: FOAM_VERT,
      fragmentShader: FOAM_FRAG,
      uniforms: { ...colors, uTime: time, uId: { value: id }, uWiggle: { value: wiggle }, uFall: { value: fall }, uShade: { value: fall > 0 ? 0 : 1 } },
    });
  scene.add(instanced(buildClawGeometry(), foamMat(0.97, 0.07, 0), foam, 11));

  // Spray: beads of foam thrown off the crest.
  const rand = mulberry32(36);
  const spray: THREE.Matrix4[] = [];
  for (let i = 0; i < 340; i++) {
    const near = rand() < 0.75;
    const x = near ? -1 + rand() * 9 + rand() * 7 : -22 + rand() * 44;
    const y = near ? 3.5 + rand() * 13 : 3 + rand() * 16;
    const z = -9 + rand() * 13;
    const r = 0.045 + Math.pow(rand(), 2.4) * 0.13;
    spray.push(new THREE.Matrix4().makeScale(r, r, r).setPosition(x, y, z));
  }
  scene.add(instanced(new THREE.IcosahedronGeometry(1, 1), foamMat(0.045, 0, 1), spray, 13));

  const fuji = new THREE.Mesh(buildFuji(), new THREE.ShaderMaterial({ vertexShader: FUJI_VERT, fragmentShader: FUJI_FRAG, uniforms: { uFoam: colors.uFoam } }));
  fuji.position.set(FUJI.x, 0, FUJI.z);
  fuji.frustumCulled = false;
  scene.add(fuji);

  // Three oshiokuri-bune, bows into the wave.
  const boats: BoatSpec[] = [
    { x: 11.5, z: 12, heading: 0.07, lift: 0.1 },
    { x: -9, z: 13, heading: -0.3, lift: 0.25 },
    { x: -2.2, z: 22.5, heading: 0.62, lift: 0.05 },
  ];
  const hullM: THREE.Matrix4[] = [];
  const rowerM: THREE.Matrix4[] = [];
  const rowerTint: number[] = [];
  const rowerKind: number[] = [];
  const q = new THREE.Quaternion();
  for (const b of boats) {
    const y = seaHeightAt(sheet, b.x, b.z);
    const slope = (seaHeightAt(sheet, b.x + 3, b.z) - seaHeightAt(sheet, b.x - 3, b.z)) / 6;
    q.setFromEuler(new THREE.Euler(0.05, b.heading, Math.atan(slope) * 0.8, 'YZX'));
    const base = new THREE.Matrix4().compose(new THREE.Vector3(b.x, y + 0.15 + b.lift, b.z), q, new THREE.Vector3(1, 1, 1));
    hullM.push(base);
    for (let r = 0; r < 5; r++) {
      for (const side of [-1, 1]) {
        const lx = -2.6 + r * 1.25 + (side > 0 ? 0.3 : 0);
        const body = new THREE.Matrix4().compose(
          new THREE.Vector3(lx, 0.44, side * 0.33),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.5)),
          new THREE.Vector3(0.5, 0.33, 0.31),
        );
        rowerM.push(base.clone().multiply(body));
        rowerTint.push(...INK.indigo);
        rowerKind.push(0);
        const head = new THREE.Matrix4().compose(new THREE.Vector3(lx - 0.5, 0.5, side * 0.33), new THREE.Quaternion(), new THREE.Vector3(0.19, 0.19, 0.19));
        rowerM.push(base.clone().multiply(head));
        rowerTint.push(...INK.skin);
        rowerKind.push(1);
      }
    }
  }
  const boatUniforms = { uTime: time, uWood: { value: v3(INK.wood) }, uWoodDark: { value: v3(INK.woodDark) } };
  const hullMesh = instanced(buildHull(), new THREE.ShaderMaterial({ vertexShader: BOAT_VERT, fragmentShader: HULL_FRAG, uniforms: boatUniforms, side: THREE.DoubleSide }), hullM, 14);
  const hullPhase = hullMesh.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute;
  hullMesh.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(hullM.length * 3), 3));
  scene.add(hullMesh);

  const rowerGeo = new THREE.IcosahedronGeometry(1, 2);
  const rowers = instanced(rowerGeo, new THREE.ShaderMaterial({ vertexShader: BOAT_VERT, fragmentShader: ROWER_FRAG, uniforms: boatUniforms }), rowerM, 15);
  rowerGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(rowerTint), 3));
  rowerGeo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(rowerKind), 1));
  // Every rower bobs with its own boat.
  const perBoat = rowerM.length / boats.length;
  const rowerPhase = new Float32Array(rowerM.length);
  for (let i = 0; i < rowerM.length; i++) rowerPhase[i] = hullPhase.getX(Math.floor(i / perBoat));
  rowerGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(rowerPhase, 1));
  scene.add(rowers);

  return {
    scene,
    meta: {
      title: 'The Great Wave off Kanagawa',
      artist: 'Katsushika Hokusai · c. 1831',
      technique: 'Spline-profile wave swept into a tube with a sculpted horn end, fractal instanced foam claws, flat bokashi inks, id + depth keyblock lines, washi paper.',
    },
    presets: [
      { name: 'The Print', position: [0, 1.8, 46], target: [0, 6.73, 0], fov: 30 },
      { name: 'Under the Claw', position: [23, 4.2, 27], target: [0, 8.2, 0], fov: 42 },
      { name: 'Down the Barrel', position: [-13, 6.5, 30], target: [-2, 8, -6], fov: 48 },
      { name: 'Above the Fleet', position: [26, 24, 38], target: [-2, 4, 2], fov: 42 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.2,
    far,
    flySpeed: 9,
    maxDistance: 160,
    floorAt: (x, z) => swell(x, z) + 0.7,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
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
