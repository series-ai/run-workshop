// The Scream — Edvard Munch, 1893.
//
// Every surface is paint. The sky is a dome whose ribbons are baked once on
// the CPU: a warped elevation gives each band one pigment, and the flow field
// follows the bands. Three layers of oriented brush dabs slide along that
// flow. The land, the fjord, the bridge, and the figures share one painted
// material: each fragment gets a band coordinate, takes its pigment from the
// band, and aims its dabs along the band. The dabs live in a chart projected
// from the painting's viewpoint. The screaming figure is a signed distance
// field, meshed once with surface nets.

import * as THREE from 'three';
import { GLSL_NOISE, strokeFn } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { meshSdf } from '../sdf';
import { clamp, fbm2, hex, mix, noise3, smoothstep, type RGB } from '../util';

const DEG = Math.PI / 180;
const HERO = new THREE.Vector3(0.9, 1.9, 0);
const SEA = -60;
/** Half width of the deck, and the two ends of the bridge along z. */
const DECK_HALF = 2.75;
const RAIL_X = 2.6;
const BRIDGE_NEAR = 16;
const BRIDGE_FAR = -170;
/** Where the screaming figure stands, and the bearing it faces (toward the painter). */
const FIGURE = new THREE.Vector3(2.18, 0, -1.91);
const FIGURE_YAW = Math.atan2(HERO.x - FIGURE.x, HERO.z - FIGURE.z);

const K_LAND = 0, K_DECK = 1, K_RAIL = 2, K_DARK = 3, K_ROBE = 4, K_SKIN = 5, K_SHIP = 6;

// ---------------------------------------------------------------------------
// Sky: baked ribbons
// ---------------------------------------------------------------------------

const SKY_EL0 = -0.12;
const SKY_EL1 = Math.PI / 2;
const BAND_GAIN = 7.5;

/** Largest amount that skyWarp can add to the elevation. */
const WARP_MAX = 0.075 + 0.04 + 0.06;

/**
 * Elevation after the wave warp. The ribbons are lines of equal warped
 * elevation. The waves are small at the horizon and sweep wide overhead.
 * The bearing terms use whole multiples, so the dome has no seam.
 */
function skyWarp(az: number, el: number): number {
  const lift = 0.3 + 0.7 * smoothstep(0, 0.4, el);
  return el + lift * (0.075 * Math.sin(az * 6 + 0.6 + el * 2.5) + 0.04 * Math.sin(az * 11 + 1.9 - el * 5)
    + 0.12 * (noise3(Math.cos(az) * 1.7, el * 2.4, Math.sin(az) * 1.7) - 0.5));
}

/** Band coordinate: the ribbons are thin at the horizon and broad overhead. */
function skyBand(az: number, el: number): number {
  return BAND_GAIN * Math.log(1 + 10 * Math.max(skyWarp(az, el) + 0.03, 0));
}

function bandHash(i: number, k: number): number {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const SKY = {
  yellow: hex(0xf2c94e),
  paleYellow: hex(0xf0dc8c),
  orange: hex(0xee8a1f),
  vermilion: hex(0xd9431c),
  red: hex(0xb3261a),
  deepRed: hex(0x7a1814),
  greyBlue: hex(0x8fa3a6),
  prussian: hex(0x1d3557),
  darkBlue: hex(0x14213d),
};
// One pigment for each ribbon, from below the horizon to the zenith. Ribbons 2 to 10 fill the sky of the
// painting: a yellow glow on the hills, vermilion and cadmium orange above it, one grey-blue streak, and
// Prussian blue at the top edge.
const RIBBONS: RGB[] = [
  SKY.darkBlue, SKY.darkBlue, SKY.paleYellow, SKY.orange, SKY.yellow, SKY.vermilion, SKY.orange, SKY.greyBlue,
  SKY.vermilion, SKY.orange, SKY.red, SKY.prussian, SKY.vermilion, SKY.deepRed, SKY.orange, SKY.red,
  SKY.darkBlue, SKY.vermilion, SKY.deepRed, SKY.prussian, SKY.red, SKY.deepRed, SKY.deepRed, SKY.deepRed,
];

function ribbonColor(i: number): RGB {
  const c = RIBBONS[i];
  if (!c) throw new Error(`Ribbon ${i} has no pigment; RIBBONS holds ${RIBBONS.length}`);
  return c;
}

function bakeSky(): { flow: THREE.DataTexture; color: THREE.DataTexture } {
  const W = 1024, H = 256;
  const flow = new Uint8Array(W * H * 4);
  const color = new Uint8Array(W * H * 4);
  // The highest band coordinate needs a pigment, and so does the ribbon above it for the last seam.
  ribbonColor(Math.floor(BAND_GAIN * Math.log(1 + 10 * (SKY_EL1 + WARP_MAX + 0.03))) + 1);
  const eAz = (Math.PI * 2) / W, eEl = (SKY_EL1 - SKY_EL0) / H;
  for (let y = 0; y < H; y++) {
    const el = SKY_EL0 + ((y + 0.5) / H) * (SKY_EL1 - SKY_EL0);
    for (let x = 0; x < W; x++) {
      const az = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const i = (y * W + x) * 4;
      const b = skyBand(az, el);
      const bi = Math.floor(b), bf = b - bi;
      let c = ribbonColor(bi);
      // A soft seam, where the wet edge of one ribbon was dragged into the next.
      const seam = smoothstep(0.78, 1, bf);
      const next = ribbonColor(bi + 1);
      c = [mix(c[0], next[0], seam), mix(c[1], next[1], seam), mix(c[2], next[2], seam)];
      // Streaks of thinner and thicker pigment inside each ribbon.
      const streak = noise3(Math.cos(az) * 4, b * 2.6, Math.sin(az) * 4);
      const tone = 0.86 + 0.28 * streak;
      // A second thin line of pale pigment runs down the middle of some ribbons.
      const core = bandHash(bi, 2) > 0.55 ? smoothstep(0.16, 0.04, Math.abs(bf - 0.45)) * smoothstep(0.35, 0.6, streak) * 0.55 : 0;
      const pale = bandHash(bi, 3) > 0.4 ? SKY.paleYellow : SKY.greyBlue;
      c = [mix(c[0] * tone, pale[0], core), mix(c[1] * tone, pale[1], core), mix(c[2] * tone, pale[2], core)];
      // Below the horizon the dome is the far side of the fjord.
      const under = smoothstep(-0.005, -0.03, el);
      c = [mix(c[0], SKY.darkBlue[0], under), mix(c[1], SKY.darkBlue[1], under), mix(c[2], SKY.darkBlue[2], under)];

      // The dabs run along the ribbon: square to the gradient of the band coordinate.
      const gAz = (skyBand(az + eAz, el) - skyBand(az - eAz, el)) / (2 * eAz);
      const gEl = (skyBand(az, el + eEl) - skyBand(az, el - eEl)) / (2 * eEl);
      let fx = gEl, fy = -gAz;
      if (fx < 0) { fx = -fx; fy = -fy; }
      const len = Math.hypot(fx, fy);
      if (len < 1e-6) { fx = 1; fy = 0; } else { fx /= len; fy /= len; }

      color[i] = clamp(c[0], 0, 1) * 255;
      color[i + 1] = clamp(c[1], 0, 1) * 255;
      color[i + 2] = clamp(c[2], 0, 1) * 255;
      color[i + 3] = 255;
      flow[i] = (fx * 0.5 + 0.5) * 255;
      flow[i + 1] = (fy * 0.5 + 0.5) * 255;
      flow[i + 2] = (0.5 + 0.3 * streak) * 255;
      flow[i + 3] = (0.3 + 0.4 * bandHash(bi, 4)) * 255;
    }
  }
  const tex = (data: Uint8Array): THREE.DataTexture => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { flow: tex(flow), color: tex(color) };
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform sampler2D tFlow;
uniform sampler2D tColor;
uniform float uTime;
uniform float uPixAngle;
varying vec3 vDir;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${strokeFn('strokeSky', 'tex')}
const float EL0 = ${SKY_EL0.toFixed(4)};
const float EL1 = 1.5707963;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(az / K_TAU + 0.5, (el - EL0) / (EL1 - EL0));
  vec3 base = textureLod(tColor, uv, 0.0).rgb;
  vec2 ang = vec2(az + K_PI, el - EL0);
  gAccent = vec3(0.95, 0.82, 0.45);
  // Thin underpaint: the cardboard shows between the dabs.
  vec4 acc = vec4(mix(base, vec3(0.6, 0.47, 0.33), 0.35) * 0.9, 0.05);
  const float N1 = 150.0; const float N2 = 250.0; const float N3 = 400.0;
  float D1 = N1 / K_TAU; float D2 = N2 / K_TAU; float D3 = N3 / K_TAU;
  float span = EL1 - EL0;
  acc = strokeSky(ang * D1, vec2(1.0 / N1, 1.0 / (D1 * span)), N1, uPixAngle * D1, 37.0, vec4(0.9, 0.24, 0.97, 0.05), vec4(0.1, 0.04, 0.05, 0.08), uTime, acc);
  acc = strokeSky(ang * D2 + vec2(0.0, 0.37), vec2(1.0 / N2, 1.0 / (D2 * span)), N2, uPixAngle * D2, 91.0, vec4(0.9, 0.19, 0.9, 0.06), vec4(0.12, 0.05, 0.06, 0.1), uTime, acc);
  acc = strokeSky(ang * D3 + vec2(0.0, 0.71), vec2(1.0 / N3, 1.0 / (D3 * span)), N3, uPixAngle * D3, 173.0, vec4(0.9, 0.17, 0.6, 0.08), vec4(0.14, 0.07, 0.04, 0.12), uTime, acc);
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// Land and fjord
// ---------------------------------------------------------------------------

/** Ground height. The road runs along a hillside: the hill rises on the left and falls to the fjord on the right. */
function terrainHeight(x: number, z: number): number {
  const n1 = fbm2(x * 0.004 + 5, z * 0.004, 3);
  const n2 = fbm2(x * 0.02, z * 0.02 + 3, 3);
  // Broad, round forms for the far hills: the mesh is coarse out there.
  const far = fbm2(x * 0.0011 + 2, z * 0.0011 + 8, 2);
  let h = -0.6;
  if (x > 3.2) {
    const s = x - 3.2;
    // Width of the slope down to the shore. Far ahead and far behind, the land swings out and closes the bay.
    // The shore winds in and out in small bays.
    const reach = 125 + 180 * (n1 - 0.5) + 34 * Math.sin(z * 0.013 + 1) + 20 * Math.sin(z * 0.037 + 4)
      + 1500 * smoothstep(-350, -1300, z) + 600 * smoothstep(250, 900, z);
    const t = s / reach;
    h = t < 1 ? -0.6 + (SEA - 3 + 0.6) * (1 - Math.pow(1 - t, 1.6)) : SEA - 3;
    h += 7 * (n2 - 0.5) * smoothstep(0, 40, s) * (1 - smoothstep(0.7, 1, t));
    // The far shore of the fjord.
    h = Math.max(h, SEA + 300 * smoothstep(1900, 3000, x + 700 * (n1 - 0.5)) * (0.55 + 0.9 * far));
    // The headland, and a skerry beyond it.
    const d = Math.hypot((x - 900) / 320, (z + 650) / 130);
    if (d < 1) h = Math.max(h, SEA + 46 * Math.pow(1 - d * d, 0.8) * (0.7 + 0.6 * n2));
    const d2 = Math.hypot((x - 1350) / 150, (z + 330) / 60);
    if (d2 < 1) h = Math.max(h, SEA + 20 * Math.pow(1 - d2 * d2, 0.8));
  } else if (x < -3.2) {
    h = Math.min(-0.6 + 0.42 * (-x - 3.2) * (0.8 + 0.4 * n1), 95 + 40 * n1);
  }
  // A ring of hills closes the world.
  const r = Math.hypot(x, z);
  h = Math.max(h, SEA + 360 * smoothstep(2900, 4000, r) * (0.55 + 0.9 * far));
  return Math.max(h, SEA);
}

// ---------------------------------------------------------------------------
// World geometry: everything that is painted with the shared material
// ---------------------------------------------------------------------------

class WorldBuilder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly kind: number[] = [];
  readonly obj: number[] = [];
  readonly idx: number[] = [];

  /** Adds an indexed mesh. obj keeps the position before the transform. kinds is one value or one value per vertex. */
  add(positions: ArrayLike<number>, normals: ArrayLike<number>, indices: ArrayLike<number>, kinds: number | ArrayLike<number>, m?: THREE.Matrix4): void {
    const base = this.pos.length / 3;
    const nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    const count = positions.length / 3;
    for (let v = 0; v < count; v++) {
      p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      n.set(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
      this.obj.push(p.x, p.y, p.z);
      if (m && nm) {
        p.applyMatrix4(m);
        n.applyMatrix3(nm).normalize();
      }
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.kind.push(typeof kinds === 'number' ? kinds : kinds[v]);
    }
    for (let i = 0; i < indices.length; i++) this.idx.push(indices[i] + base);
  }

  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, kind: number): void {
    const pos: number[] = [], nor: number[] = [], idx: number[] = [];
    const face = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => {
      const at = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d);
      nor.push(...n, ...n, ...n, ...n);
      idx.push(at, at + 1, at + 2, at, at + 2, at + 3);
    };
    face([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    face([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    face([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    face([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    this.add(pos, nor, idx, kind);
  }

  /** A solid of revolution from a profile of [radius, height] pairs, bottom to top. depth squashes it front to back. */
  lathe(profile: Array<[number, number]>, depth: number, kind: number, m: THREE.Matrix4): void {
    const RAD = 12;
    const g = new THREE.BufferGeometry();
    const pos: number[] = [], idx: number[] = [];
    for (const [r, y] of profile) {
      for (let j = 0; j < RAD; j++) {
        const a = (j / RAD) * Math.PI * 2;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r * depth);
      }
    }
    for (let i = 0; i < profile.length - 1; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = i * RAD + j, b = i * RAD + ((j + 1) % RAD), c = a + RAD, d = b + RAD;
        idx.push(a, c, b, b, c, d);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.add(pos, g.getAttribute('normal').array, idx, kind, m);
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.kind, 1));
    g.setAttribute('aObj', new THREE.Float32BufferAttribute(this.obj, 3));
    g.setIndex(this.idx);
    return g;
  }
}

function addTerrain(b: WorldBuilder): void {
  const NR = 230, NT = 480, R0 = 3.3, R1 = 4500;
  const pos = new Float32Array(((NR + 1) * NT + 1) * 3);
  for (let i = 0; i <= NR; i++) {
    const r = R0 * Math.pow(R1 / R0, i / NR);
    for (let j = 0; j < NT; j++) {
      const a = (j / NT) * Math.PI * 2;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r;
      pos.set([x, terrainHeight(x, z), z], (i * NT + j) * 3);
    }
  }
  const centre = (NR + 1) * NT;
  pos.set([0, terrainHeight(0, 0), 0], centre * 3);
  const idx: number[] = [];
  for (let j = 0; j < NT; j++) idx.push(centre, (j + 1) % NT, j);
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NT; j++) {
      const a = i * NT + j, c = i * NT + ((j + 1) % NT), d = a + NT, e = c + NT;
      idx.push(a, c, d, c, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.add(pos, g.getAttribute('normal').array, idx, K_LAND);
  g.dispose();
}

function addBridge(b: WorldBuilder): void {
  b.box(-DECK_HALF, DECK_HALF, -0.3, 0, BRIDGE_FAR, BRIDGE_NEAR, K_DECK);
  for (const side of [1, -1]) {
    const x = RAIL_X * side;
    b.box(x - 0.1, x + 0.1, 0.97, 1.11, BRIDGE_FAR, BRIDGE_NEAR, K_RAIL);
    b.box(x - 0.06, x + 0.06, 0.63, 0.74, BRIDGE_FAR, BRIDGE_NEAR, K_RAIL);
    b.box(x - 0.06, x + 0.06, 0.3, 0.41, BRIDGE_FAR, BRIDGE_NEAR, K_RAIL);
    for (let z = BRIDGE_NEAR - 1.3; z > BRIDGE_FAR; z -= 2.6) b.box(x - 0.065, x + 0.065, 0, 0.98, z - 0.065, z + 0.065, K_RAIL);
  }
}

/** A man in a long coat and a top hat, seen far off. */
function addStroller(b: WorldBuilder, x: number, z: number, height: number, yaw: number): void {
  const profile: Array<[number, number]> = [
    [0.02, 0], [0.13, 0.01], [0.14, 0.5], [0.17, 0.9], [0.2, 1.2], [0.21, 1.42], [0.16, 1.51], [0.06, 1.56],
    [0.085, 1.6], [0.1, 1.67], [0.085, 1.75], [0.15, 1.77], [0.15, 1.79], [0.092, 1.8], [0.098, 1.95], [0.01, 1.96],
  ];
  const s = height / 1.96;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0.03)), new THREE.Vector3(s, s, s));
  b.lathe(profile, 0.72, K_DARK, m);
}

/** A small sailing boat on the fjord. */
function addBoat(b: WorldBuilder, x: number, z: number, yaw: number, size: number): void {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, SEA, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(size, size, size));
  // Hull: a double-ended wedge. Sails: two flat triangles.
  const hull = [-1, 0.16, 0, -0.5, 0.16, 0.2, 0.5, 0.16, 0.2, 1, 0.2, 0, 0.5, 0.16, -0.2, -0.5, 0.16, -0.2, -0.5, -0.05, 0, 0.5, -0.05, 0];
  const hullIdx = [0, 1, 5, 1, 2, 5, 2, 4, 5, 2, 3, 4, 0, 6, 1, 1, 6, 7, 1, 7, 2, 2, 7, 3, 0, 5, 6, 5, 7, 6, 5, 4, 7, 4, 3, 7];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(hull, 3));
  g.setIndex(hullIdx);
  g.computeVertexNormals();
  b.add(hull, g.getAttribute('normal').array, hullIdx, K_DARK, m);
  g.dispose();
  const sail = [0.02, 0.2, 0, 0.62, 0.3, 0, 0.02, 1.5, 0, -0.04, 0.3, 0, -0.04, 1.3, 0, -0.7, 0.28, 0];
  const sailNor = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  b.add(sail, sailNor, [0, 1, 2, 3, 4, 5], K_SHIP, m);
}

// ---------------------------------------------------------------------------
// The screaming figure
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

/** Sideways sway of the body's centre line: the figure bends like the lines of the landscape. */
function sway(y: number): number {
  return 0.075 * Math.sin((Math.min(y, 1.4) - 0.2) * 3);
}
const HEAD_SWAY = sway(1.4);

let figureKind = K_ROBE;

function figureField(x: number, y: number, z: number): number {
  const xs = x - sway(y);
  // The robe: narrow at the waist, round at the shoulders, wide at the hem.
  let rx: number;
  if (y < 0.9) rx = mix(0.17, 0.105, y / 0.9);
  else if (y < 1.25) rx = mix(0.105, 0.165, (y - 0.9) / 0.35);
  else rx = 0.165 * Math.sqrt(Math.max(1 - Math.pow((y - 1.25) / 0.15, 2), 0.0004));
  const rz = rx * 0.58;
  let robe = Math.max((Math.hypot(xs / rx, z / rz) - 1) * rz, -y, y - 1.4);
  robe += 0.006 * Math.sin(xs * 60 + y * 5);
  robe = smin(robe, capsule(xs, y, z, 0, 1.34, 0, 0, 1.46, 0.012, 0.05, 0.045), 0.04);
  // Sleeves: elbows out, forearms up to the cheeks.
  for (const side of [1, -1]) {
    robe = smin(robe, capsule(xs, y, z, 0.14 * side, 1.3, 0, 0.19 * side, 1.17, 0.06, 0.05, 0.046), 0.04);
    robe = smin(robe, capsule(xs, y, z, 0.19 * side, 1.17, 0.06, 0.11 * side, 1.43, 0.06, 0.046, 0.034), 0.03);
  }
  // The head: a bare skull, wide above and narrow at the jaw.
  let skin = smin(ellipsoid(xs, y, z, 0, 1.59, 0.02, 0.088, 0.1, 0.098), ellipsoid(xs, y, z, 0, 1.478, 0.034, 0.056, 0.078, 0.07), 0.06);
  // Eye sockets and the open mouth.
  skin = Math.max(skin, -(Math.hypot(Math.abs(xs) - 0.034, y - 1.6, z - 0.112) - 0.022));
  skin = Math.max(skin, -ellipsoid(xs, y, z, 0, 1.476, 0.108, 0.021, 0.036, 0.034));
  // Long hands, cupped to the cheeks.
  const ax = Math.abs(xs);
  skin = smin(skin, ellipsoid(ax, y, z, 0.1, 1.52, 0.048, 0.03, 0.088, 0.052), 0.02);
  figureKind = skin < robe ? K_SKIN : K_ROBE;
  return Math.min(robe, skin);
}

function addFigure(b: WorldBuilder): void {
  const mesh = meshSdf(figureField, {
    min: [-0.38, -0.02, -0.2],
    max: [0.38, 1.72, 0.24],
    cell: 0.012,
    bound: (x, y, z) => Math.hypot(x * 0.75, z, Math.max(Math.abs(y - 0.85) - 0.6, 0)) - 0.34,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeVertexNormals();
  const kinds = new Float32Array(mesh.positions.length / 3);
  for (let v = 0; v < kinds.length; v++) {
    figureField(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
    kinds[v] = figureKind;
  }
  const m = new THREE.Matrix4().compose(FIGURE, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, FIGURE_YAW, 0)), new THREE.Vector3(1, 1, 1));
  b.add(mesh.positions, g.getAttribute('normal').array, mesh.indices, kinds, m);
  g.dispose();
}

// ---------------------------------------------------------------------------
// The painted material
// ---------------------------------------------------------------------------

const PAINT_VERT = /* glsl */ `
attribute float aKind;
attribute vec3 aObj;
uniform float uTime;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vObj;
varying float vKind;
void main() {
  vec3 p = position;
  // The screaming figure wavers, as if the cry passed through it.
  if (aKind > 3.5 && aKind < 5.5) {
    float wave = 0.011 * sin(uTime * 0.9 + aObj.y * 4.4) * smoothstep(0.0, 1.0, aObj.y);
    p.x += wave * ${Math.cos(FIGURE_YAW).toFixed(4)};
    p.z -= wave * ${Math.sin(FIGURE_YAW).toFixed(4)};
  }
  vWp = p;
  vN = normal;
  vObj = aObj;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const PAINT_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uHero;
uniform float uPixRef;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vObj;
varying float vKind;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${strokeFn('strokeVar', 'var')}
vec2 heroChart(vec3 wp) {
  vec3 p = wp - uHero;
  return vec2(atan(p.x, -p.z), atan(p.y, length(p.xz)));
}
vec3 pick(vec3 a, vec3 b, vec3 c, vec3 d, float h) {
  return h < 0.25 ? a : (h < 0.5 ? b : (h < 0.75 ? c : d));
}
/** Pigment of one band. h selects one of four pigments of the palette that fits the surface. */
vec3 pigment(float h, float kind, vec3 wp, float fromHero) {
  if (kind < 0.5) {
    if (wp.y < ${(SEA + 0.25).toFixed(2)}) {
      // The fjord.
      return pick(vec3(0.09, 0.19, 0.36), vec3(0.14, 0.28, 0.46), vec3(0.2, 0.36, 0.52), vec3(0.07, 0.13, 0.28), h);
    }
    vec3 slope = pick(vec3(0.36, 0.42, 0.2), vec3(0.56, 0.55, 0.28), vec3(0.48, 0.31, 0.16), vec3(0.14, 0.24, 0.16), h);
    vec3 shore = pick(vec3(0.8, 0.74, 0.42), vec3(0.7, 0.56, 0.28), vec3(0.62, 0.68, 0.42), vec3(0.86, 0.8, 0.58), h);
    vec3 farHill = pick(vec3(0.1, 0.17, 0.3), vec3(0.17, 0.27, 0.42), vec3(0.2, 0.22, 0.38), vec3(0.12, 0.25, 0.3), h);
    vec3 hill = pick(vec3(0.12, 0.2, 0.16), vec3(0.3, 0.34, 0.18), vec3(0.36, 0.24, 0.14), vec3(0.08, 0.11, 0.16), h);
    vec3 c = mix(slope, shore, smoothstep(${(SEA + 14).toFixed(1)}, ${(SEA + 2).toFixed(1)}, wp.y));
    c = mix(c, hill, smoothstep(-2.0, -5.0, wp.x));
    return mix(c, farHill, smoothstep(700.0, 1500.0, fromHero));
  }
  if (kind < 1.5) return pick(vec3(0.62, 0.38, 0.19), vec3(0.8, 0.55, 0.26), vec3(0.4, 0.25, 0.16), vec3(0.42, 0.42, 0.44), h);
  if (kind < 2.5) return pick(vec3(0.5, 0.3, 0.16), vec3(0.72, 0.47, 0.22), vec3(0.3, 0.2, 0.16), vec3(0.25, 0.27, 0.36), h);
  if (kind < 3.5) return pick(vec3(0.07, 0.08, 0.13), vec3(0.1, 0.11, 0.18), vec3(0.05, 0.06, 0.1), vec3(0.13, 0.12, 0.16), h);
  if (kind < 4.5) return pick(vec3(0.08, 0.09, 0.14), vec3(0.13, 0.15, 0.22), vec3(0.06, 0.07, 0.1), vec3(0.18, 0.17, 0.2), h);
  if (kind < 5.5) return pick(vec3(0.86, 0.78, 0.5), vec3(0.78, 0.72, 0.52), vec3(0.9, 0.84, 0.6), vec3(0.72, 0.7, 0.5), h);
  return pick(vec3(0.92, 0.86, 0.6), vec3(0.82, 0.72, 0.46), vec3(0.95, 0.9, 0.72), vec3(0.75, 0.68, 0.5), h);
}
void main() {
  vec3 n = normalize(vN);
  vec2 ch = heroChart(vWp);
  float fromHero = length(vWp - uHero);

  // Band coordinate. Land and water: lines of equal elevation in the painter's view, bent into waves.
  float warp = 0.035 * sin(ch.x * 7.0 + ch.y * 16.0 + 1.0) + 0.07 * (fbm(vec2(ch.x * 2.4, ch.y * 7.0) + 3.0) - 0.5);
  bool water = vKind < 0.5 && vWp.y < ${(SEA + 0.25).toFixed(2)};
  float bandLand = water ? (ch.y + 0.6 * warp + 0.03 * sin(ch.x * 4.0 + 2.0)) * 34.0 : (ch.y + warp) * 46.0;
  // Deck: planks along the bridge. Rail: along the bar. Figures: down the body, in waves.
  float bandDeck = vWp.x * 3.6 + 0.35 * sin(vWp.z * 0.21);
  float bandRail = vWp.y * 11.0 + vWp.x * 5.0;
  float bandBody = (vObj.x + 0.02 * sin(vObj.y * 9.0)) * 26.0 + vObj.z * 9.0;
  float band = vKind < 0.5 ? bandLand : (vKind < 1.5 ? bandDeck : (vKind < 2.5 ? bandRail : bandBody));

  float bi = floor(band);
  float seam = smoothstep(0.72, 1.0, band - bi);
  float salt = floor(vKind + 0.5) * 31.0;
  vec3 col = mix(pigment(hash11(bi * 1.37 + salt), vKind, vWp, fromHero), pigment(hash11((bi + 1.0) * 1.37 + salt), vKind, vWp, fromHero), seam);

  if (vKind > 4.5 && vKind < 5.5) {
    // The face: round staring eyes, two nostrils, the open mouth.
    vec2 f = vec2(vObj.x - ${HEAD_SWAY.toFixed(4)}, vObj.y);
    float front = step(0.045, vObj.z);
    float eye = length(vec2(abs(f.x) - 0.034, f.y - 1.6));
    float mouth = length((f - vec2(0.0, 1.476)) / vec2(0.02, 0.035));
    float nostril = length(vec2(abs(f.x) - 0.009, f.y - 1.537));
    vec3 dark = vec3(0.2, 0.13, 0.1);
    // The hands: more ochre than the face, with a line where they meet the cheeks.
    float hand = smoothstep(0.066, 0.074, abs(f.x)) * smoothstep(1.4, 1.44, f.y);
    col = mix(col, col * vec3(0.9, 0.8, 0.62), hand);
    col = mix(col, vec3(0.3, 0.26, 0.2), front * smoothstep(0.006, 0.003, abs(abs(f.x) - 0.07)) * smoothstep(1.43, 1.47, f.y) * smoothstep(1.62, 1.56, f.y));
    col = mix(col, vec3(0.9, 0.86, 0.66), front * smoothstep(0.019, 0.016, eye));
    col = mix(col, dark, front * smoothstep(0.022, 0.02, eye) * smoothstep(0.014, 0.017, eye));
    col = mix(col, dark, front * smoothstep(0.0065, 0.0045, eye));
    col = mix(col, dark, front * smoothstep(1.0, 0.85, mouth));
    col = mix(col, dark, front * smoothstep(0.0048, 0.0032, nostril));
    // Green-grey shadow under the cheekbones and around the jaw.
    col = mix(col, vec3(0.5, 0.56, 0.44), 0.4 * smoothstep(0.5, -0.1, n.z * ${Math.cos(FIGURE_YAW).toFixed(4)} + n.x * ${Math.sin(FIGURE_YAW).toFixed(4)}));
  }
  // A little form: light from the glow of the sky.
  col *= 0.8 + 0.28 * max(dot(n, normalize(vec3(-0.35, 0.7, 0.6))), 0.0);
  if (vKind < 0.5) col *= 0.9 + 0.2 * fbm(vWp.xz * 0.02 + 9.0);

  // Dabs run along the band: square to its gradient in the chart.
  mat2 jac = mat2(dFdx(ch), dFdy(ch));
  vec2 grad = vec2(dFdx(band), dFdy(band));
  vec2 dir = vec2(1.0, 0.0);
  if (abs(determinant(jac)) > 1e-14) {
    vec2 g = inverse(transpose(jac)) * grad;
    float gl = length(g);
    if (gl > 1e-6) dir = vec2(g.y, -g.x) / gl;
  }
  if (dir.x < 0.0) dir = -dir;

  gAccent = water ? vec3(0.9, 0.62, 0.24) : (vKind < 0.5 ? vec3(0.78, 0.7, 0.4) : (vKind < 2.5 ? vec3(0.92, 0.72, 0.36) : vec3(0.34, 0.4, 0.5)));
  vec4 jitA = vec4(0.14, 0.05, 0.06, 0.08);
  vec4 jitB = vec4(0.18, 0.07, 0.07, 0.12);

  float pxr = clamp(length(fwidth(ch)) * 0.7, 1e-6, 0.05);
  // Octave selection keeps the dabs near one size on screen at any distance.
  float lod = log2(uPixRef / pxr);
  float k = floor(lod);
  float D = 30.0 * exp2(k);
  gFlow = vec4(dir * 0.5 + 0.5, 0.55, 0.3);
  gColor = col;
  // Thin underpaint: the cardboard shows between the dabs.
  vec4 acc = vec4(mix(col, vec3(0.6, 0.47, 0.33), 0.3) * 0.82, 0.06);
  acc = strokeVar(ch * D, vec2(1.0), 0.0, pxr * D, 13.0, vec4(0.86, 0.26, 0.95, 0.02), jitA, uTime, acc);
  acc = strokeVar(ch * D * 2.0, vec2(1.0), 0.0, pxr * D * 2.0, 13.0, vec4(0.86, 0.24, 0.8, 0.03), jitB, uTime, acc);
  vec4 fine = strokeVar(ch * D * 4.0, vec2(1.0), 0.0, pxr * D * 4.0, 13.0, vec4(0.86, 0.24, 0.8, 0.03), jitB, uTime, acc);
  acc = mix(acc, fine, smoothstep(0.0, 1.0, lod - k));
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// Post: matte tempera and crayon on cardboard, dark contour lines.
// ---------------------------------------------------------------------------

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec4 c = texture2D(tScene, vUv);
  vec2 cv = gl_FragCoord.xy / s;

  // Paint height in alpha: a low relief, lit from the upper left. The medium is matte.
  float hL = texture2D(tScene, vUv - vec2(px.x, 0.0)).a;
  float hR = texture2D(tScene, vUv + vec2(px.x, 0.0)).a;
  float hD = texture2D(tScene, vUv - vec2(0.0, px.y)).a;
  float hU = texture2D(tScene, vUv + vec2(0.0, px.y)).a;
  vec3 n = normalize(vec3((hL - hR) * 1.3, (hD - hU) * 1.3, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  vec3 col = c.rgb * (1.0 + (dot(n, L) - L.z) * 0.8);

  // Where the paint is thin, the fibres of the cardboard show through.
  float fibre = 0.55 * vnoise(cv * 0.3) + 0.45 * vnoise(cv * 1.1 + 7.0);
  float thin = (1.0 - smoothstep(0.1, 0.5, c.a)) * smoothstep(0.5, 0.8, fibre);
  col = mix(col, vec3(0.66, 0.53, 0.38) * (0.8 + 0.3 * fibre), thin * 0.4);

  // Contour: a dark blue crayon line where the depth breaks.
  float wob = 0.7 + 0.9 * vnoise(cv * 0.045);
  float edge = smoothstep(0.012, 0.05, depthEdge(vUv, px * 1.6 * wob));
  col = mix(col, vec3(0.06, 0.07, 0.17), edge * 0.82);

  col *= 0.95 + 0.07 * fibre;
  col *= vignette(vUv, 0.45);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

function onBridge(x: number, z: number): boolean {
  return Math.abs(x) < DECK_HALF && z < BRIDGE_NEAR && z > BRIDGE_FAR;
}

export function createTheScream(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 9000;
  const time = { value: 0 };

  const skyTex = bakeSky();
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { tFlow: { value: skyTex.flow }, tColor: { value: skyTex.color }, uTime: time, uPixAngle: { value: 0.001 } },
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(far * 0.9, 48, 24), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = 10;
  scene.add(sky);

  const b = new WorldBuilder();
  addTerrain(b);
  addBridge(b);
  addFigure(b);
  // Two men walk away along the bridge.
  addStroller(b, -0.45, -14.4, 1.86, 0.2);
  addStroller(b, 0.35, -15.2, 1.94, -0.15);
  addBoat(b, 520, -540, 0.5, 13);
  addBoat(b, 700, -400, -0.3, 11);

  const pixRef = { value: 0.001 };
  const paintMat = new THREE.ShaderMaterial({
    vertexShader: PAINT_VERT,
    fragmentShader: PAINT_FRAG,
    uniforms: { uTime: time, uHero: { value: HERO }, uPixRef: pixRef },
  });
  const world = new THREE.Mesh(b.build(), paintMat);
  world.frustumCulled = false;
  scene.add(world);

  // The painting looks 28.8 degrees to the right of the bridge and 6 degrees down,
  // so the vanishing point of the planks sits near the left edge.
  const yaw = 28.8 * DEG, pitch = -6 * DEG;
  const heroTarget: [number, number, number] = [
    HERO.x + 10 * Math.sin(yaw) * Math.cos(pitch),
    HERO.y + 10 * Math.sin(pitch),
    HERO.z - 10 * Math.cos(yaw) * Math.cos(pitch),
  ];
  const front = new THREE.Vector3(Math.sin(FIGURE_YAW), 0, Math.cos(FIGURE_YAW));

  return {
    scene,
    meta: {
      title: 'The Scream',
      artist: 'Edvard Munch · 1893',
      technique: 'Baked sky ribbons with a band-following flow field, 3 layers of animated oriented brush dabs, band-painted land, fjord, and bridge, SDF-sculpted figure, crayon contour lines on cardboard.',
    },
    presets: [
      { name: 'The Painting', position: [HERO.x, HERO.y, HERO.z], target: heroTarget, fov: 50 },
      { name: 'Face to Face', position: [FIGURE.x + front.x * 1.1, 1.56, FIGURE.z + front.z * 1.1], target: [FIGURE.x, 1.52, FIGURE.z], fov: 42 },
      { name: 'The Two Strollers', position: [2.0, 1.7, -25], target: [0.5, 1.3, -3], fov: 44 },
      { name: 'Above the Fjord', position: [-5, 10, 10], target: [30, -14, -50], fov: 56 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.15,
    far,
    flySpeed: 9,
    maxDistance: 600,
    floorAt: (x, z) => (onBridge(x, z) ? 0.4 : terrainHeight(x, z) + 1.2),
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      skyMat.uniforms.uPixAngle.value = (2 * Math.tan((ctx.camera.fov * DEG) / 2)) / ctx.height;
      pixRef.value = 0.9 / ctx.height;
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      skyTex.flow.dispose();
      skyTex.color.dispose();
    },
  };
}
