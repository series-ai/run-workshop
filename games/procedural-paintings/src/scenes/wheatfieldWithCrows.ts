// Wheatfield with Crows — Vincent van Gogh, 1890.
//
// The storm sky is a dome whose colour field and flow field are baked once on
// the CPU (cloud swirls, a line-integral streak pass); three layers of
// oriented brush dabs are laid over those fields. The ground is a rolling
// height sheet whose dabs take flat pigment from a baked map of the three
// earth paths. The wheat is instanced paint strokes: each one is a tapered
// ribbon that turns to the viewer, leans with a travelling wind wave, and
// writes its paint height for the impasto pass. The crows are instanced birds
// that flap in the vertex shader and wheel over the field in flocks.

import * as THREE from 'three';
import { GLSL_NOISE, strokeFn } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, fbm2, hex, mix, mix3, mulberry32, noise2, noise3, smoothstep, type RGB } from '../util';

const DEG = Math.PI / 180;
const HERO = new THREE.Vector3(0, 0, 30);
const HERO_EYE = 2.7;
const WIND = new THREE.Vector2(0.86, -0.51).normalize();

// ---------------------------------------------------------------------------
// Sky fields
// ---------------------------------------------------------------------------

const EL0 = -0.12;
const EL1 = Math.PI / 2;

const SKY = {
  night: hex(0x0a0e24),
  deep: hex(0x13205a),
  cobalt: hex(0x2646a0),
  cerulean: hex(0x3d72ba),
  light: hex(0x7ba6d0),
  pale: hex(0xbfd3d6),
  white: hex(0xe6eadc),
  green: hex(0x5f9c9a),
};

/** Painting coordinates (x in [-0.5, 0.5], y in [0, 1]) to sky angles. */
function paintingToSky(px: number, py: number): { az: number; el: number } {
  return { az: px * 80 * DEG, el: (py - 0.47) * 50 * DEG };
}

function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

interface Swirl {
  az: number;
  el: number;
  radius: number;
  spin: 1 | -1;
  /** 1 for a pale cloud, 0 for a turn of dark air. */
  cloud: number;
}

function buildSwirls(): Swirl[] {
  const swirls: Swirl[] = [
    { ...paintingToSky(-0.11, 0.84), radius: 9.5 * DEG, spin: 1, cloud: 1 },
    { ...paintingToSky(0.2, 0.8), radius: 8.5 * DEG, spin: -1, cloud: 1 },
    { ...paintingToSky(-0.36, 0.7), radius: 5.5 * DEG, spin: 1, cloud: 0.55 },
    { ...paintingToSky(0.42, 0.66), radius: 6 * DEG, spin: -1, cloud: 0 },
    { ...paintingToSky(0.03, 0.62), radius: 5 * DEG, spin: 1, cloud: 0 },
  ];
  // The rest of the dome, so every direction is painted.
  const rand = mulberry32(1890);
  for (let i = 0; i < 22; i++) {
    const az = (rand() * 2 - 1) * Math.PI;
    const el = (8 + rand() * 50) * DEG;
    if (Math.abs(az) < 48 * DEG && el < 34 * DEG) continue;
    swirls.push({ az, el, radius: (5 + rand() * 6) * DEG, spin: rand() < 0.5 ? 1 : -1, cloud: rand() < 0.55 ? 0.5 + rand() * 0.5 : 0 });
  }
  return swirls;
}

function bakeSky(): { flow: THREE.DataTexture; color: THREE.DataTexture } {
  const W = 768;
  const H = 192;
  const swirls = buildSwirls();
  const flowF = new Float32Array(W * H * 2);
  const energy = new Float32Array(W * H);
  const size = new Float32Array(W * H);

  for (let y = 0; y < H; y++) {
    const el = EL0 + ((y + 0.5) / H) * (EL1 - EL0);
    const cosEl = Math.max(Math.cos(el), 0.2);
    for (let x = 0; x < W; x++) {
      const az = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const cx = Math.cos(az), sx = Math.sin(az);
      // Turbulent air: the direction turns with a slow noise field.
      const turn = (noise3(cx * 4.6 + 2, el * 6.4, sx * 4.6) - 0.5) * 5.2 + 0.5 * Math.sin(az * 5 + el * 6);
      let fx = Math.cos(turn) * 1.5 + 0.9;
      let fy = Math.sin(turn) * 1.5;
      let e = 0.3;
      let sz = 0.55;
      for (const v of swirls) {
        const dx = wrapAngle(az - v.az) * cosEl;
        const dy = el - v.el;
        const r2 = dx * dx + dy * dy;
        const lim = v.radius * 2.4;
        if (r2 > lim * lim) continue;
        const r = Math.sqrt(r2) + 1e-5;
        const w = Math.exp(-r2 / (v.radius * v.radius));
        fx += w * 2.9 * ((-dy / r) * v.spin - (dx / r) * 0.25);
        fy += w * 2.9 * ((dx / r) * v.spin - (dy / r) * 0.25);
        e += w * 0.7;
        sz += w * 0.25;
      }
      // Low on the horizon the strokes lie flat.
      const low = 1 - smoothstep(1 * DEG, 9 * DEG, el);
      fx = mix(fx, 3, low);
      fy = mix(fy, 0.15 * Math.sin(az * 9), low);
      const len = Math.hypot(fx, fy) + 1e-6;
      const i = y * W + x;
      flowF[i * 2] = fx / len;
      flowF[i * 2 + 1] = fy / len;
      energy[i] = clamp(e, 0, 1);
      size[i] = clamp(sz, 0, 1);
    }
  }

  // Line-integral convolution: streaks of light and dark pigment along the flow.
  const lic = new Float32Array(W * H);
  const STEPS = 12;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let wsum = 0;
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        let px = x + 0.5;
        let py = y + 0.5;
        for (let s = 0; s < STEPS; s++) {
          const ix = ((Math.floor(px) % W) + W) % W;
          const iy = clamp(Math.floor(py), 0, H - 1);
          const fi = (iy * W + ix) * 2;
          const az = (px / W - 0.5) * Math.PI * 2;
          const el = EL0 + (py / H) * (EL1 - EL0);
          const w = 1 - s / STEPS;
          sum += w * noise3(Math.cos(az) * 24, el * 28, Math.sin(az) * 24);
          wsum += w;
          px += sgn * flowF[fi] * 1.1;
          py += sgn * flowF[fi + 1] * 1.1;
        }
      }
      lic[y * W + x] = sum / wsum;
    }
  }

  const flow = new Uint8Array(W * H * 4);
  const color = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const el = EL0 + ((y + 0.5) / H) * (EL1 - EL0);
    const elDeg = el / DEG;
    const cosEl = Math.max(Math.cos(el), 0.2);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const az = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const cx = Math.cos(az), sx = Math.sin(az);

      // Cobalt over the wheat, ultramarine above, near black at the top.
      let c = mix3(SKY.cobalt, SKY.deep, smoothstep(2, 13, elDeg) * 0.85);
      c = mix3(c, SKY.night, smoothstep(11, 36, elDeg) * 0.9);
      const big = noise3(cx * 2.6 + 5, el * 3.6, sx * 2.6);
      c = mix3(c, big > 0.5 ? SKY.cerulean : SKY.night, Math.abs(big - 0.5) * 1.5);
      const mid = noise3(cx * 6.3 + 1, el * 8.5, sx * 6.3 + 4);
      c = mix3(c, SKY.cobalt, smoothstep(0.55, 0.8, mid) * 0.5);
      // A lighter band of rain light just above the field.
      const band = Math.exp(-Math.pow((elDeg - 2.4) / 3.0, 2)) * smoothstep(0.35, 0.7, noise3(cx * 4, 1.3, sx * 4));
      c = mix3(c, SKY.cerulean, band * 0.6);

      const l = (lic[i] - 0.5) * 3.2 + 0.5;
      const e = energy[i];
      c = mix3(c, mix3(SKY.cerulean, SKY.light, e), smoothstep(0.58, 0.92, l) * (0.25 + 0.5 * e));
      c = mix3(c, SKY.night, smoothstep(0.46, 0.14, l) * 0.6);

      // Clouds: ragged pale masses, torn by the wind into arms.
      for (const v of swirls) {
        if (v.cloud <= 0) continue;
        const dx = wrapAngle(az - v.az) * cosEl;
        const dy = (el - v.el) * 1.35;
        const r = Math.hypot(dx, dy) / v.radius;
        if (r > 2.3) continue;
        const n1 = noise3(cx * 7.5 + v.az * 3, el * 9.5, sx * 7.5);
        const n2 = noise3(cx * 19 + 2, el * 23 + 4, sx * 19);
        const th = Math.atan2(dy, dx);
        const arm = Math.sin(th * 2 * v.spin - Math.log(r + 0.12) * 3.0 + v.az * 9);
        const body = Math.exp(-r * r * 1.15) * (0.42 + 1.05 * n1) * (0.8 + 0.2 * arm);
        const m = smoothstep(0.36, 0.74, body) * v.cloud;
        let tone = mix3(SKY.pale, SKY.white, smoothstep(0.42, 0.75, n2));
        tone = mix3(tone, SKY.green, smoothstep(0.5, 0.2, n2) * 0.4);
        tone = mix3(tone, SKY.light, smoothstep(0.1, -0.7, arm) * 0.65);
        c = mix3(c, tone, m * (0.62 + 0.38 * smoothstep(0.3, 0.7, l)));
      }

      color[i * 4] = clamp(c[0], 0, 1) * 255;
      color[i * 4 + 1] = clamp(c[1], 0, 1) * 255;
      color[i * 4 + 2] = clamp(c[2], 0, 1) * 255;
      color[i * 4 + 3] = 255;
      flow[i * 4] = (flowF[i * 2] * 0.5 + 0.5) * 255;
      flow[i * 4 + 1] = (flowF[i * 2 + 1] * 0.5 + 0.5) * 255;
      flow[i * 4 + 2] = size[i] * 255;
      flow[i * 4 + 3] = energy[i] * 255;
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
uniform vec3 uGround;
varying vec3 vDir;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${strokeFn('strokeSky', 'tex')}
const float EL0 = -0.12;
const float EL1 = 1.5707963;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(az / K_TAU + 0.5, (el - EL0) / (EL1 - EL0));
  vec3 base = textureLod(tColor, uv, 0.0).rgb;
  vec2 ang = vec2(az + K_PI, el - EL0);
  gAccent = vec3(0.34, 0.52, 0.78);
  vec4 acc = vec4(base * 0.66, 0.06);
  const float N1 = 176.0; const float N2 = 280.0; const float N3 = 420.0;
  float D1 = N1 / K_TAU; float D2 = N2 / K_TAU; float D3 = N3 / K_TAU;
  float span = EL1 - EL0;
  acc = strokeSky(ang * D1, vec2(1.0 / N1, 1.0 / (D1 * span)), N1, uPixAngle * D1, 41.0, vec4(0.80, 0.30, 0.97, 0.11), vec4(0.16, 0.06, 0.15, 0.12), uTime, acc);
  acc = strokeSky(ang * D2 + vec2(0.0, 0.37), vec2(1.0 / N2, 1.0 / (D2 * span)), N2, uPixAngle * D2, 97.0, vec4(0.80, 0.26, 0.86, 0.13), vec4(0.2, 0.07, 0.17, 0.14), uTime, acc);
  acc = strokeSky(ang * D3 + vec2(0.0, 0.71), vec2(1.0 / N3, 1.0 / (D3 * span)), N3, uPixAngle * D3, 181.0, vec4(0.78, 0.24, 0.5, 0.15), vec4(0.22, 0.09, 0.14, 0.16), uTime, acc);
  // Under the horizon the dome is the far field.
  acc = mix(acc, vec4(uGround, 0.1), 1.0 - smoothstep(-0.035, -0.012, el));
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// The three paths
// ---------------------------------------------------------------------------

interface PathSegment { ax: number; az: number; bx: number; bz: number; wa: number; wb: number }

interface PathHit {
  /** Distance to the centre line over the half width there. 99 when no path is near. */
  t: number;
  tx: number;
  tz: number;
}

/** Control points: x, z, half width. */
const PATH_POINTS: Array<Array<[number, number, number]>> = [
  [[0.5, 52, 3.0], [0, 38, 2.9], [-0.2, 27, 2.7], [-1.4, 15, 2.5], [-5, 1, 2.3], [-7.5, -14, 2.1], [-4, -31, 2.0], [4.5, -48, 1.9], [13, -65, 1.8], [15.5, -85, 1.6], [11, -105, 1.3], [6, -124, 0.7]],
  [[-0.4, 25.5, 2.2], [-4, 22.6, 2.3], [-8.5, 20.4, 2.4], [-14, 18.7, 2.5], [-24, 17.3, 2.6], [-40, 17.7, 2.6], [-62, 16, 2.5], [-95, 18, 2.3], [-135, 15, 1.9], [-180, 17, 1.1]],
  [[0.4, 25.5, 2.2], [4.5, 23, 2.3], [9.5, 21.2, 2.4], [16, 19.8, 2.5], [27, 18.8, 2.6], [44, 19.6, 2.6], [66, 17.6, 2.5], [98, 20, 2.3], [138, 17, 1.9], [182, 19, 1.1]],
];

function buildPaths(): PathSegment[][] {
  return PATH_POINTS.map((points) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[2], p[1])), false, 'centripetal');
    const samples = curve.getSpacedPoints(points.length * 7);
    const segments: PathSegment[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i], b = samples[i + 1];
      segments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, wa: a.y, wb: b.y });
    }
    return segments;
  });
}

/** Past this distance from a centre line the ground is plain field. */
const PATH_REACH = 5;

/** Segments bucketed on a grid, so a lookup tests only the few that are near. */
const PATH_GRID = { cell: 10, x0: -210, z0: -150, nx: 42, nz: 22 };

function buildPathIndex(): PathSegment[][] {
  const buckets: PathSegment[][] = Array.from({ length: PATH_GRID.nx * PATH_GRID.nz }, () => []);
  for (const path of buildPaths()) {
    for (const seg of path) {
      const i0 = Math.floor((Math.min(seg.ax, seg.bx) - PATH_REACH - PATH_GRID.x0) / PATH_GRID.cell);
      const i1 = Math.floor((Math.max(seg.ax, seg.bx) + PATH_REACH - PATH_GRID.x0) / PATH_GRID.cell);
      const j0 = Math.floor((Math.min(seg.az, seg.bz) - PATH_REACH - PATH_GRID.z0) / PATH_GRID.cell);
      const j1 = Math.floor((Math.max(seg.az, seg.bz) + PATH_REACH - PATH_GRID.z0) / PATH_GRID.cell);
      if (i0 < 0 || j0 < 0 || i1 >= PATH_GRID.nx || j1 >= PATH_GRID.nz) throw new Error(`A path segment at (${seg.ax.toFixed(1)}, ${seg.az.toFixed(1)}) leaves the path grid`);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) buckets[j * PATH_GRID.nx + i].push(seg);
    }
  }
  return buckets;
}

const PATH_INDEX = buildPathIndex();
const NO_PATH: PathHit = { t: 99, tx: 1, tz: 0 };

function pathAt(x: number, z: number): PathHit {
  const i = Math.floor((x - PATH_GRID.x0) / PATH_GRID.cell);
  const j = Math.floor((z - PATH_GRID.z0) / PATH_GRID.cell);
  if (i < 0 || j < 0 || i >= PATH_GRID.nx || j >= PATH_GRID.nz) return NO_PATH;
  const bucket = PATH_INDEX[j * PATH_GRID.nx + i];
  if (bucket.length === 0) return NO_PATH;
  let best = 99, tx = 1, tz = 0;
  for (const s of bucket) {
    const ex = s.bx - s.ax, ez = s.bz - s.az;
    const u = clamp(((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez), 0, 1);
    const d = Math.hypot(x - s.ax - ex * u, z - s.az - ez * u);
    const t = d / mix(s.wa, s.wb, u);
    if (t < best) {
      best = t;
      const len = Math.hypot(ex, ez);
      tx = ex / len;
      tz = ez / len;
    }
  }
  return { t: best, tx, tz };
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

function fieldHeight(x: number, z: number): number {
  let h = 2.6 * (fbm2(x * 0.011 + 3, z * 0.011, 3) - 0.47);
  h += 1.3 * Math.sin(x * 0.021 + 0.5) * Math.sin(z * 0.017 + 1.2);
  // The field climbs gently to the horizon.
  h += 3.4 * smoothstep(0, -190, z);
  // Far swells, so the horizon is not a ruled line.
  h += 13 * (fbm2(x * 0.0034 + 7, z * 0.0034, 2) - 0.45) * smoothstep(150, 520, Math.hypot(x, z));
  return h;
}

function terrainHeight(x: number, z: number): number {
  const p = pathAt(x, z);
  // The paths are worn a little below the field.
  return fieldHeight(x, z) - 0.22 * (1 - smoothstep(0.7, 1.25, p.t));
}

const EARTH = {
  wheatDeep: hex(0x6e5214),
  wheatMid: hex(0xa07c1e),
  wheatGold: hex(0xc8a02c),
  olive: hex(0x6c7426),
  rust: hex(0xa8522c),
  brick: hex(0x8e3a22),
  maroon: hex(0x5a2418),
  clay: hex(0xc07a3e),
  grassDark: hex(0x24512a),
  grass: hex(0x3f7a2e),
  grassLight: hex(0x86a83e),
};

const FAR_GOLD: [RGB, RGB] = [hex(0xb88c22), hex(0xdcae30)];

/** Flat pigment of the ground at a point, and the direction its strokes run. */
function groundAt(x: number, z: number): { color: RGB; fx: number; fz: number; size: number } {
  const fine = noise2(x * 0.35, z * 0.35);
  const fromFork = Math.hypot(x - HERO.x, z - HERO.z);
  if (fromFork > 262) {
    // Far from the fork the strokes of wheat are too small to see: the ground
    // takes the gold of the standing crop.
    const ang = (noise2(x * 0.02, z * 0.02 + 7) - 0.5) * 1.2;
    return { color: mix3(FAR_GOLD[0], FAR_GOLD[1], smoothstep(0.3, 0.75, fine)), fx: Math.cos(ang), fz: Math.sin(ang), size: 0.5 };
  }
  const p = pathAt(x, z);
  const patch = fbm2(x * 0.03 + 11, z * 0.03, 3);
  // Under the wheat: brown-gold earth and stubble, so gaps between strokes read as depth.
  let c = mix3(EARTH.wheatDeep, EARTH.wheatMid, smoothstep(0.3, 0.62, patch));
  c = mix3(c, EARTH.wheatGold, smoothstep(0.55, 0.85, fine) * 0.6);
  c = mix3(c, EARTH.olive, smoothstep(0.62, 0.78, noise2(x * 0.045 + 40, z * 0.045)) * 0.5);
  const ang = (noise2(x * 0.02, z * 0.02 + 7) - 0.5) * 2.6;
  let fx = Math.cos(ang) * WIND.x - Math.sin(ang) * WIND.y;
  let fz = Math.sin(ang) * WIND.x + Math.cos(ang) * WIND.y;
  let size = 0.5;
  if (p.t < 1.35) {
    // Cross-section of a path: grass strip, red earth ruts, grass verge.
    const wob = p.t + 0.22 * (noise2(x * 0.5 + 3, z * 0.5) - 0.5);
    let earth = mix3(EARTH.brick, EARTH.rust, smoothstep(0.3, 0.7, fine));
    earth = mix3(earth, EARTH.maroon, smoothstep(0.62, 0.9, noise2(x * 0.9 + 9, z * 0.9)) * 0.75);
    earth = mix3(earth, EARTH.clay, smoothstep(0.7, 0.95, noise2(x * 0.6, z * 0.6 + 21)) * 0.6);
    let grass = mix3(EARTH.grassDark, EARTH.grass, smoothstep(0.25, 0.6, fine));
    grass = mix3(grass, EARTH.grassLight, smoothstep(0.6, 0.9, noise2(x * 0.8 + 5, z * 0.8)) * 0.8);
    const strip = (1 - smoothstep(0.1, 0.26, wob)) * smoothstep(0.3, 0.5, noise2(x * 0.16, z * 0.16 + 13));
    const verge = smoothstep(0.74, 0.92, wob);
    const road = mix3(mix3(earth, grass, strip), grass, verge);
    c = mix3(road, c, smoothstep(1.12, 1.32, wob));
    // Strokes run along the path.
    const along = 1 - smoothstep(1.0, 1.35, p.t);
    fx = mix(fx, p.tx, along);
    fz = mix(fz, p.tz, along);
    size = mix(size, 0.72, along);
  }
  const farField = smoothstep(110, 260, fromFork);
  c = mix3(c, mix3(FAR_GOLD[0], FAR_GOLD[1], smoothstep(0.3, 0.75, fine)), farField);
  const len = Math.hypot(fx, fz) + 1e-6;
  return { color: c, fx: fx / len, fz: fz / len, size };
}

const FIELD_MAP = { extent: 880, resolution: 1024 };

function bakeGround(): { flow: THREE.DataTexture; color: THREE.DataTexture } {
  const N = FIELD_MAP.resolution;
  const flow = new Uint8Array(N * N * 4);
  const color = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) {
    const z = ((j + 0.5) / N - 0.5) * FIELD_MAP.extent;
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / N - 0.5) * FIELD_MAP.extent;
      const g = groundAt(x, z);
      const k = (j * N + i) * 4;
      color[k] = clamp(g.color[0], 0, 1) * 255;
      color[k + 1] = clamp(g.color[1], 0, 1) * 255;
      color[k + 2] = clamp(g.color[2], 0, 1) * 255;
      color[k + 3] = 255;
      flow[k] = (g.fx * 0.5 + 0.5) * 255;
      flow[k + 1] = (g.fz * 0.5 + 0.5) * 255;
      flow[k + 2] = g.size * 255;
      flow[k + 3] = 40;
    }
  }
  const tex = (data: Uint8Array): THREE.DataTexture => {
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    // The map mirrors past its edge, so the far field has no seam.
    t.wrapS = THREE.MirroredRepeatWrapping;
    t.wrapT = THREE.MirroredRepeatWrapping;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { flow: tex(flow), color: tex(color) };
}

function buildGround(): THREE.BufferGeometry {
  const N = 230;
  const HALF = 900;
  // The grid is fine at the fork and coarse at the horizon.
  const axis = (i: number): number => {
    const u = (i / N) * 2 - 1;
    return HALF * (0.1 * u + 0.9 * u * u * u);
  };
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const x = axis(i), z = axis(j);
      const k = (j * (N + 1) + i) * 3;
      pos[k] = x;
      pos[k + 1] = terrainHeight(x, z);
      pos[k + 2] = z;
    }
  }
  const idx = new Uint32Array(N * N * 6);
  let t = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const GROUND_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const GROUND_FRAG = /* glsl */ `
uniform sampler2D tFlow;
uniform sampler2D tColor;
uniform float uTime;
uniform float uCell;
uniform float uExtent;
varying vec3 vWp;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${strokeFn('strokeGround', 'tex')}
void main() {
  vec2 ch = vWp.xz + 0.5 * uExtent;
  // Metres per pixel. Octave selection keeps dabs near one size on screen.
  float mpp = clamp(sqrt(length(dFdx(ch)) * length(dFdy(ch))), 1e-4, 6.0);
  float lod = -log2(uCell * mpp);
  float k = floor(lod);
  float D = exp2(k);
  vec2 inv = vec2(1.0 / (D * uExtent));
  gAccent = vec3(0.93, 0.78, 0.34);
  vec4 acc = vec4(texture2D(tColor, ch / uExtent).rgb * 0.7, 0.08);
  vec4 jitA = vec4(0.2, 0.05, 0.09, 0.06);
  vec4 jitB = vec4(0.24, 0.07, 0.11, 0.08);
  acc = strokeGround(ch * D, inv, 0.0, mpp * D, 13.0, vec4(0.80, 0.28, 0.95, 0.03), jitA, uTime, acc);
  acc = strokeGround(ch * D * 2.0, inv * 0.5, 0.0, mpp * D * 2.0, 13.0, vec4(0.80, 0.26, 0.8, 0.04), jitB, uTime, acc);
  vec4 fine = strokeGround(ch * D * 4.0, inv * 0.25, 0.0, mpp * D * 4.0, 13.0, vec4(0.80, 0.26, 0.8, 0.04), jitB, uTime, acc);
  acc = mix(acc, fine, smoothstep(0.0, 1.0, lod - k));
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// Wheat
// ---------------------------------------------------------------------------

const WHEAT_TINTS: Array<[RGB, number]> = [
  [hex(0xe9b92e), 5], [hex(0xf3d04c), 4], [hex(0xd69c1f), 5], [hex(0xba7b1a), 3],
  [hex(0xe58a22), 1.4], [hex(0x8c6a1a), 1.6], [hex(0x707c24), 0.8], [hex(0xf7e588), 1.2],
];
const GRASS_TINTS: RGB[] = [EARTH.grassDark, EARTH.grass, EARTH.grassLight, hex(0x5f9434), hex(0x1c4426)];

function pick<T>(rand: () => number, items: Array<[T, number]>): T {
  let total = 0;
  for (const it of items) total += it[1];
  let r = rand() * total;
  for (const it of items) {
    r -= it[1];
    if (r <= 0) return it[0];
  }
  return items[items.length - 1][0];
}

const WHEAT_VERT = /* glsl */ `
attribute vec4 aRoot;
attribute vec4 aLean;
attribute vec4 aTint;
uniform float uTime;
uniform vec2 uWind;
varying vec3 vCol;
varying vec3 vUv;
void main() {
  float a = position.y;
  // A wind wave crosses the field. Each stroke also flutters on its own.
  vec2 across = vec2(-uWind.y, uWind.x);
  float front = dot(aRoot.xz, uWind) * 0.085 + 1.6 * sin(dot(aRoot.xz, across) * 0.031 + 1.0);
  float gust = 0.5 + 0.5 * sin(front - uTime * 1.25);
  gust *= 0.65 + 0.35 * sin(dot(aRoot.xz, across) * 0.047 + uTime * 0.31);
  float flutter = sin(uTime * 4.4 + aLean.w * 43.0) * 0.07;
  vec2 lean = aLean.xy + uWind * (0.1 + 0.62 * gust) * aTint.a + across * flutter;
  vec3 axis = normalize(vec3(lean.x, 1.0, lean.y));
  vec3 droop = vec3(lean.x, -0.3, lean.y) * 0.38;
  // Strokes high on the stalk travel farther than strokes at its foot.
  vec3 root = aRoot.xyz;
  root.xz += uWind * (0.1 + 0.62 * gust) * aLean.w * 0.55;
  vec3 p = root + (axis * a + droop * a * a) * aRoot.w;
  vec3 tangent = normalize(axis + 2.0 * droop * a);
  vec3 side = normalize(cross(tangent, cameraPosition - p));
  // An ear of wheat: full in the upper half, pointed at the tip.
  float w = aLean.z * (0.55 + 0.45 * smoothstep(0.0, 0.5, a)) * (1.0 - 0.9 * smoothstep(0.72, 1.0, a));
  p += side * position.x * w;
  vUv = vec3(position.x * 2.0, a, aLean.w * 61.0 + aRoot.x);
  vec3 tint = aTint.rgb * (0.8 + 0.2 * a);
  // The crest of the wave shows the pale side of the ears.
  vCol = mix(tint, vec3(0.98, 0.9, 0.52), 0.22 * gust * aTint.a) * (0.9 + 0.2 * gust);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const WHEAT_FRAG = /* glsl */ `
varying vec3 vCol;
varying vec3 vUv;
${GLSL_NOISE}
void main() {
  // One loaded brush stroke: a ridge of paint, combed by the bristles.
  float ridge = 1.0 - vUv.x * vUv.x;
  float bristle = vnoise(vec2(vUv.x * 3.4 + vUv.z, vUv.y * 1.6 + vUv.z * 0.37));
  vec3 col = vCol * (0.76 + 0.2 * ridge + 0.16 * bristle);
  gl_FragColor = vec4(col, 0.22 + 0.62 * ridge * (0.45 + 0.55 * bristle));
}
`;

function buildWheat(time: THREE.IUniform<number>): THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> {
  const rand = mulberry32(27);
  const roots: number[] = [];
  const leans: number[] = [];
  const tints: number[] = [];
  const add = (x: number, z: number, scale: number, grass: boolean): void => {
    const ground = terrainHeight(x, z);
    // A stalk is painted as strokes at several heights. Low strokes sit in shade.
    const lift = grass ? 0 : Math.pow(rand(), 1.5) * 0.62 * scale;
    const length = (grass ? 0.22 + rand() * 0.3 : 0.56 + rand() * 0.4) * scale;
    const leanAngle = rand() * Math.PI * 2;
    const leanSize = (grass ? 0.25 : 0.42) * Math.pow(rand(), 0.7);
    const shade = grass ? 0.8 + rand() * 0.3 : mix(0.66, 1.08, lift / (0.62 * scale)) * (0.88 + rand() * 0.24);
    const tint = grass ? GRASS_TINTS[Math.floor(rand() * GRASS_TINTS.length)] : pick(rand, WHEAT_TINTS);
    roots.push(x, ground + lift - 0.04, z, length);
    leans.push(Math.cos(leanAngle) * leanSize, Math.sin(leanAngle) * leanSize, (grass ? 0.05 + rand() * 0.04 : 0.06 + rand() * 0.055) * scale, grass ? 0 : lift / scale + rand() * 0.3);
    tints.push(tint[0] * shade, tint[1] * shade, tint[2] * shade, grass ? 0.45 : 1);
  };

  // Strokes are dense round the fork, where the painting is made, and grow
  // larger and sparser toward the horizon, as paint strokes do.
  const place = (count: number, sample: () => [number, number]): void => {
    let placed = 0;
    let tries = 0;
    while (placed < count) {
      if (++tries > count * 60) throw new Error(`Wheat placement stalled at ${placed} of ${count} strokes`);
      const [x, z] = sample();
      const p = pathAt(x, z);
      if (p.t < 0.3 && rand() < 0.5) {
        add(x, z, 1, true);
        placed++;
        continue;
      }
      if (p.t < 0.86) continue;
      const d = Math.hypot(x - HERO.x, z - HERO.z);
      if (d < 3.2) continue;
      const scale = clamp(d / 26, 1, 3.3);
      if (rand() > 1 / (scale * scale)) continue;
      if (p.t < 1.22) {
        add(x, z, Math.min(scale, 1.6), true);
      } else {
        add(x, z, scale, false);
      }
      placed++;
    }
  };
  // Round the fork: log-uniform in distance, so the nearest wheat is the densest.
  place(64000, () => {
    const d = 2.2 * Math.pow(70 / 2.2, rand());
    const a = rand() * Math.PI * 2;
    return [HERO.x + Math.sin(a) * d, HERO.z - Math.cos(a) * d];
  });
  // The view of the painting: a wedge that reaches to the horizon.
  place(52000, () => {
    const d = 30 + Math.pow(rand(), 0.75) * 250;
    const a = (rand() - 0.5) * 124 * DEG;
    return [HERO.x + Math.sin(a) * d, HERO.z - Math.cos(a) * d];
  });
  // The rest of the field.
  place(26000, () => {
    const d = 40 + Math.sqrt(rand()) * 210;
    const a = rand() * Math.PI * 2;
    return [HERO.x + Math.sin(a) * d, HERO.z - Math.cos(a) * d];
  });

  const g = new THREE.InstancedBufferGeometry();
  // A ribbon of four segments: x is across the stroke, y runs along it.
  const SEG = 4;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG; i++) pos.push(-0.5, i / SEG, 0, 0.5, i / SEG, 0);
  for (let i = 0; i < SEG; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(roots), 4));
  g.setAttribute('aLean', new THREE.InstancedBufferAttribute(new Float32Array(leans), 4));
  g.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tints), 4));
  g.instanceCount = roots.length / 4;
  const mesh = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({ vertexShader: WHEAT_VERT, fragmentShader: WHEAT_FRAG, uniforms: { uTime: time, uWind: { value: WIND } }, side: THREE.DoubleSide }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Crows
// ---------------------------------------------------------------------------

function buildCrowGeometry(): THREE.InstancedBufferGeometry {
  const pos: number[] = [];
  const wing: number[] = [];
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number], wa = 0, wb = 0, wc = 0): void => {
    pos.push(...a, ...b, ...c);
    wing.push(wa, wb, wc);
  };
  // Body: a spindle with a beak and a fan tail. x points along the flight.
  const nose: [number, number, number] = [0.46, 0.01, 0];
  const tail: [number, number, number] = [-0.38, 0.02, 0];
  const ring: Array<[number, number, number]> = [[0.06, 0.11, 0], [0.06, 0, 0.12], [0.06, -0.1, 0], [0.06, 0, -0.12]];
  for (let i = 0; i < 4; i++) {
    tri(nose, ring[i], ring[(i + 1) % 4]);
    tri(tail, ring[(i + 1) % 4], ring[i]);
  }
  tri([-0.28, 0.02, 0], [-0.7, 0.03, 0.17], [-0.7, 0.03, -0.17]);
  // Wings: four stations from root to tip. The shader bends them at the wrist.
  const stations: Array<[number, number, number]> = [[0, 0.26, -0.3], [0.45, 0.31, -0.26], [0.8, 0.14, -0.3], [1, -0.14, -0.2]];
  for (const side of [-1, 1]) {
    for (let i = 0; i < stations.length - 1; i++) {
      const [s0, le0, te0] = stations[i];
      const [s1, le1, te1] = stations[i + 1];
      const z0 = side * (0.04 + s0), z1 = side * (0.04 + s1);
      tri([le0, 0.02, z0], [te0, 0.02, z0], [le1, 0.02, z1], side * Math.max(s0, 0.001), side * Math.max(s0, 0.001), side * s1);
      tri([te0, 0.02, z0], [te1, 0.02, z1], [le1, 0.02, z1], side * Math.max(s0, 0.001), side * s1, side * s1);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  return g;
}

const CROW_VERT = /* glsl */ `
attribute float aWing;
attribute vec4 aOrbit;
attribute vec4 aFly;
uniform float uTime;
varying float vTop;
void main() {
  float theta = aFly.x + uTime * aFly.y;
  float turn = sign(aFly.y);
  // The bird wheels round its own centre: the flock keeps its shape.
  vec3 centre = vec3(aOrbit.x + aOrbit.z * cos(theta), aOrbit.w, aOrbit.y + aOrbit.z * sin(theta));
  centre.y += 1.4 * sin(theta * 3.0 + aFly.w * 6.28) + 0.5 * sin(uTime * 0.7 + aFly.w * 20.0);
  vec3 fwd = turn * vec3(-sin(theta), 0.0, cos(theta));
  vec3 right = vec3(-fwd.z, 0.0, fwd.x);
  float bank = turn * 0.32;
  vec3 up = vec3(0.0, cos(bank), 0.0) + right * sin(bank);
  right = right * cos(bank) - vec3(0.0, sin(bank), 0.0);

  // Flap, then glide, then flap. The hand of the wing lags the arm.
  float phase = uTime * (5.2 + 2.0 * aFly.w) + aFly.w * 31.0;
  float effort = mix(0.22, 1.0, smoothstep(-0.25, 0.35, sin(uTime * 0.27 + aFly.w * 17.0)));
  float beat = sin(phase) * effort;
  float s = abs(aWing);
  vec3 l = position;
  if (s > 0.0) {
    float a1 = 0.72 * beat + 0.14;
    float a2 = a1 + effort * 0.85 * sin(phase - 1.15) - 0.42;
    float inner = min(s, 0.45);
    float outer = max(s - 0.45, 0.0);
    vec2 yz = vec2(sin(a1), cos(a1)) * inner + vec2(sin(a2), cos(a2)) * outer;
    l.y += yz.x;
    l.z = sign(aWing) * (0.04 + yz.y);
  } else {
    l.y -= 0.07 * beat;
  }
  vec3 wp = centre + aFly.z * (fwd * l.x + up * l.y + right * l.z);
  vTop = s;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const CROW_FRAG = /* glsl */ `
varying float vTop;
void main() {
  // Black paint with a little Prussian blue worked into the wing tips.
  vec3 col = mix(vec3(0.02, 0.02, 0.035), vec3(0.05, 0.065, 0.15), smoothstep(0.4, 1.0, vTop) * 0.6);
  gl_FragColor = vec4(col, 0.6);
}
`;

function buildCrows(time: THREE.IUniform<number>): THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> {
  const rand = mulberry32(90);
  const orbit: number[] = [];
  const fly: number[] = [];
  /**
   * A flock wheels round a point over the field. Every bird has the same
   * angular speed, so the flock keeps its shape: a ragged arc of birds.
   */
  const flock = (count: number, cx: number, cz: number, radius: number, height: number, turn: 1 | -1, speed: number, angle: number, arc: number): void => {
    for (let i = 0; i < count; i++) {
      const theta = angle + (rand() - 0.5) * arc;
      orbit.push(cx + (rand() - 0.5) * 14, cz + (rand() - 0.5) * 14, radius + (rand() - 0.5) * 20, height + (rand() - 0.5) * 9);
      fly.push(theta, (turn * speed) / radius, 1.9 + rand() * 1.6, rand());
    }
  };
  // The flocks of the painting circle inside its view, so the sky is never empty.
  flock(17, 12, -72, 46, 23, 1, 7.5, 0.5, 2.3);
  flock(10, -30, -108, 42, 15, -1, 6.5, 2.6, 2.0);
  flock(10, 10, -172, 62, 13, 1, 7, 4.2, 2.6);
  flock(6, 34, -22, 28, 27, -1, 6, 5.6, 1.6);
  // Birds elsewhere over the field.
  flock(8, -120, 70, 60, 20, -1, 7, 1.0, 2.4);
  flock(7, 100, 120, 55, 24, 1, 7, 3.0, 2.4);

  const g = buildCrowGeometry();
  g.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(new Float32Array(orbit), 4));
  g.setAttribute('aFly', new THREE.InstancedBufferAttribute(new Float32Array(fly), 4));
  g.instanceCount = orbit.length / 4;
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: CROW_VERT, fragmentShader: CROW_FRAG, uniforms: { uTime: time }, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Post: impasto relief, dark contour lines, canvas, varnish.
// ---------------------------------------------------------------------------

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec4 c = texture2D(tScene, vUv);
  vec2 cv = gl_FragCoord.xy / s;
  float weave = canvasWeave(cv);

  // Paint height in alpha: light it from the upper left.
  float hL = texture2D(tScene, vUv - vec2(px.x, 0.0)).a;
  float hR = texture2D(tScene, vUv + vec2(px.x, 0.0)).a;
  float hD = texture2D(tScene, vUv - vec2(0.0, px.y)).a;
  float hU = texture2D(tScene, vUv + vec2(0.0, px.y)).a;
  vec3 n = normalize(vec3((hL - hR) * 1.9, (hD - hU) * 1.9, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  float diff = dot(n, L) - L.z;
  vec3 col = c.rgb * (1.0 + diff * 0.9);
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 46.0);
  col += spec * 0.15 * c.a * vec3(1.0, 0.97, 0.9);

  // Contour: a dark umber line where the depth breaks between strokes.
  float wob = 0.7 + 0.9 * vnoise(cv * 0.045);
  float edge = smoothstep(0.02, 0.085, depthEdge(vUv, px * 1.3 * wob));
  col = mix(col, vec3(0.1, 0.075, 0.06), edge * 0.5);

  col *= 0.93 + 0.11 * weave;
  col *= vignette(vUv, 0.4);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createWheatfieldWithCrows(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 2600;
  const time: THREE.IUniform<number> = { value: 0 };

  const skyTex = bakeSky();
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { tFlow: { value: skyTex.flow }, tColor: { value: skyTex.color }, uTime: time, uPixAngle: { value: 0.001 }, uGround: { value: new THREE.Vector3(...EARTH.wheatMid) } },
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(far * 0.9, 48, 24), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  const groundTex = bakeGround();
  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: { tFlow: { value: groundTex.flow }, tColor: { value: groundTex.color }, uTime: time, uCell: { value: 24 }, uExtent: { value: FIELD_MAP.extent } },
  });
  const ground = new THREE.Mesh(buildGround(), groundMat);
  ground.frustumCulled = false;
  scene.add(ground);

  scene.add(buildWheat(time));
  scene.add(buildCrows(time));

  const eye = fieldHeight(HERO.x, HERO.z) + HERO_EYE;

  return {
    scene,
    meta: {
      title: 'Wheatfield with Crows',
      artist: 'Vincent van Gogh · 1890',
      technique: 'Baked storm-sky flow + colour fields under 3 layers of oriented brush dabs, 140k instanced wheat strokes in a travelling wind wave, baked path pigment map, flapping instanced crows, impasto relief lighting.',
    },
    presets: [
      { name: 'The Painting', position: [HERO.x, eye, HERO.z], target: [0.16, eye + 0.38, 5], fov: 50 },
      { name: 'Among the Wheat', position: [-6.9, fieldHeight(-6.9, -9) + 1.15, -9], target: [-2.4, fieldHeight(-2.4, -24.4) + 2.2, -24.4], fov: 58 },
      { name: 'With the Crows', position: [46, 30, 10], target: [6, 13, -100], fov: 52 },
      { name: 'Above the Fork', position: [-24, 44, 78], target: [2, 0, 6], fov: 44 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.15,
    far,
    flySpeed: 16,
    maxDistance: 320,
    floorAt: (x, z) => fieldHeight(x, z) + 0.7,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      skyMat.uniforms.uPixAngle.value = (2 * Math.tan((ctx.camera.fov * DEG) / 2)) / ctx.height;
      // Pixels per dab cell: constant on the print, whatever the canvas size.
      groundMat.uniforms.uCell.value = 24 * (ctx.height / 760);
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
      groundTex.flow.dispose();
      groundTex.color.dispose();
    },
  };
}
