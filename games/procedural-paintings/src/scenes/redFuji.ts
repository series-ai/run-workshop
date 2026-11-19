// Fine Wind, Clear Morning (Red Fuji) — Katsushika Hokusai, c. 1830.
//
// The mountain is one polar height sheet: an exponential cone, a crater, and
// radial gullies carved near the summit. The fragment shader prints it in flat
// bokashi inks (maroon summit, terracotta body, stippled tree line) and fills
// the gullies with snow streaks. The forest is instanced pines. The mackerel
// sky is banks of instanced flat-shaded puffs that drift in the wind. All
// materials write a region id in alpha; the post pass inks a Prussian-blue
// keyblock line where the id or the depth breaks, then prints on washi paper.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { fbm2, hex, mix3, mulberry32, noise2, smoothstep, type RGB } from '../util';

const DEG = Math.PI / 180;

const INK = {
  maroon: hex(0x6e2a1c),
  red: hex(0xb4432a),
  orange: hex(0xcf6c3e),
  forest: hex(0x3f6e5a),
  forestDark: hex(0x1d4a44),
  haze: hex(0x9dbdb4),
  snow: hex(0xf2ecd9),
  skyDeep: hex(0x1b4878),
  skyMid: hex(0x4d86b2),
  skyPale: hex(0xdfe6d6),
  cloud: hex(0xf4eedc),
  cloudShade: hex(0xc3d5dc),
};

function v3(c: RGB): THREE.Vector3 {
  return new THREE.Vector3(c[0], c[1], c[2]);
}

// ---------------------------------------------------------------------------
// The mountain
// ---------------------------------------------------------------------------

const FUJI = {
  height: 60,
  /** Fall-off length of the cone, world units. */
  lambda: 56,
  /** Radius where the cone meets the plain. */
  reach: 330,
  craterRadius: 3.4,
  /** Number of radial gullies. The shader uses the same count for the snow. */
  gullies: 64,
  meshRadius: 2700,
  /** Radius where the first trees stand, and radius where the forest is closed. */
  treeLine: [70, 138] as [number, number],
};

const HERO = { position: [-30, 8, 336] as [number, number, number], target: [-38, 35, 0] as [number, number, number] };

function coneProfile(r: number): number {
  const floor = Math.exp(-FUJI.reach / FUJI.lambda);
  return (FUJI.height * Math.max(Math.exp(-r / FUJI.lambda) - floor, 0)) / (1 - floor);
}

function fujiHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const th = Math.atan2(z, x);
  const rim = FUJI.craterRadius;
  let h = coneProfile(Math.max(r, rim));
  // Crater bowl and the three small peaks on its rim.
  if (r < rim) h -= 2.6 * (1 - (r / rim) * (r / rim));
  const rimBand = Math.exp(-Math.pow((r - rim) / 1.6, 2));
  h += rimBand * (0.9 * Math.max(Math.sin(th * 3 + 0.4), 0) + 0.5 * Math.sin(th * 7 + 1.9));
  // Radial gullies: deepest just below the summit, gone on the lower slopes.
  const k = Math.round((th / (Math.PI * 2)) * FUJI.gullies);
  const depth = Math.pow(0.5 + 0.5 * Math.sin(k * 12.9898 + 1.3), 1.6);
  const groove = Math.pow(0.5 + 0.5 * Math.cos(th * FUJI.gullies), 2.5);
  h -= 3.4 * depth * groove * smoothstep(2.6, 10, r) * Math.exp(-r / (26 + 30 * depth));
  // Shoulders and foothills.
  h += 2.4 * (fbm2(x * 0.011 + 4, z * 0.011, 3) - 0.5) * smoothstep(24, 130, r);
  h += 9 * fbm2(x * 0.0035 + 9, z * 0.0035, 3) * smoothstep(260, 620, r);
  return h;
}

function buildFuji(): THREE.BufferGeometry {
  const RINGS = 150;
  const SECTORS = 512;
  const pos = new Float32Array((RINGS + 1) * (SECTORS + 1) * 3);
  for (let i = 0; i <= RINGS; i++) {
    // Rings crowd the summit, where the gullies need them.
    const r = FUJI.meshRadius * Math.pow(i / RINGS, 2.6);
    for (let j = 0; j <= SECTORS; j++) {
      const a = (j / SECTORS) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const k = (i * (SECTORS + 1) + j) * 3;
      pos[k] = x;
      pos[k + 1] = fujiHeight(x, z);
      pos[k + 2] = z;
    }
  }
  const idx = new Uint32Array(RINGS * SECTORS * 6);
  let t = 0;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SECTORS; j++) {
      const a = i * (SECTORS + 1) + j, b = a + 1, c = a + SECTORS + 1, d = c + 1;
      idx[t++] = a; idx[t++] = b; idx[t++] = c;
      idx[t++] = b; idx[t++] = d; idx[t++] = c;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const FUJI_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FUJI_FRAG = /* glsl */ `
uniform vec3 uMaroon;
uniform vec3 uRed;
uniform vec3 uOrange;
uniform vec3 uForest;
uniform vec3 uForestDark;
uniform vec3 uHaze;
uniform vec3 uSnow;
uniform float uHeight;
uniform float uGullies;
uniform vec2 uTreeLine;
varying vec3 vWp;
${GLSL_NOISE}
// Hand-cut dots: one jittered dot in each cell, present with the given density.
float stipple(vec2 p, float density) {
  vec2 c = floor(p); vec2 f = fract(p);
  float aa = length(fwidth(p)) * 0.7 + 1e-4;
  float m = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec3 h = hash23(c + g);
      float on = step(fract(h.z * 17.3 + h.x * 3.1), density);
      vec2 d = g + 0.5 + (h.xy - 0.5) * 0.7 - f;
      float r = 0.2 + 0.2 * h.z;
      m = max(m, on * (1.0 - smoothstep(r - aa, r + aa, length(d * vec2(1.0, 0.75)))));
    }
  }
  // Far away the dots are smaller than a pixel: print their average tone.
  return mix(m, density * 0.3, smoothstep(0.5, 1.6, aa));
}
void main() {
  float r = length(vWp.xz);
  float f = vWp.y / uHeight;
  float ang = atan(vWp.z, vWp.x);
  float u = ang / K_TAU * uGullies;
  float k = floor(u + 0.5);
  float fu = u - k;
  float kk = mod(k, uGullies);

  // Bokashi: orange foot, terracotta body, maroon summit broken into dots.
  vec3 col = mix(uOrange, uRed, smoothstep(0.16, 0.5, f));
  float dark = smoothstep(0.6, 0.97, f);
  float summitDots = stipple(vWp.xz * 1.7 + vec2(ang * 5.0, 0.0), dark * 0.95);
  col = mix(col, uMaroon, max(summitDots, smoothstep(0.84, 0.99, f)) * 0.9);
  // The gully floors print one tone darker.
  float depth = pow(0.5 + 0.5 * sin(k * 12.9898 + 1.3), 1.6);
  float groove = pow(0.5 + 0.5 * cos(fu * K_TAU), 2.5) * depth * smoothstep(2.6, 10.0, r) * exp(-r / (26.0 + 30.0 * depth));
  col = mix(col, uMaroon, groove * 0.6);

  // Snow streaks lie in the gullies and run down from the summit.
  float len = 0.07 + 0.3 * pow(hash11(kk + 3.7), 1.6) + 0.05 * hash11(kk * 1.7 + 9.1);
  float along = (1.0 - f) / len;
  float halfW = (0.4 - 0.3 * along) * (0.5 + 0.5 * hash11(kk + 11.1));
  float wig = fu + 0.07 * sin((1.0 - f) * 46.0 + kk * 2.1);
  float aa = fwidth(u) + 1e-4;
  float snow = (1.0 - smoothstep(halfW - aa, halfW + aa, abs(wig))) * (1.0 - smoothstep(0.86, 1.0, along)) * smoothstep(3.0, 4.6, r);
  col = mix(col, uSnow, snow);

  // Tree line: dots of forest that thicken into a solid mass.
  float edge = r + 30.0 * (vnoise(vWp.xz * 0.028 + 5.0) - 0.5) + 9.0 * (vnoise(vWp.xz * 0.11) - 0.5);
  float cover = smoothstep(uTreeLine.x, uTreeLine.y, edge);
  float trees = stipple(vWp.xz * 0.42, cover * 1.5);
  float solid = smoothstep(mix(uTreeLine.x, uTreeLine.y, 0.62), uTreeLine.y + 14.0, edge);
  vec3 forest = mix(uForest, uForestDark, stipple(vWp.xz * 0.55 + 7.3, 0.55) * 0.85);
  col = mix(col, uForestDark, trees * (1.0 - solid));
  col = mix(col, forest, solid);
  // The plain fades into morning haze.
  col = mix(col, uHaze, smoothstep(380.0, 1900.0, r));
  // The far plain has no keyblock line: its id fades into the sky's.
  gl_FragColor = vec4(col, 0.5 * (1.0 - smoothstep(900.0, 2300.0, r)));
}
`;

// ---------------------------------------------------------------------------
// Pines
// ---------------------------------------------------------------------------

function buildPineGeometry(): THREE.BufferGeometry {
  const SIDES = 5;
  const pos: number[] = [];
  const tier = (y0: number, y1: number, radius: number): void => {
    for (let j = 0; j < SIDES; j++) {
      const a0 = (j / SIDES) * Math.PI * 2, a1 = ((j + 1) / SIDES) * Math.PI * 2;
      pos.push(Math.cos(a0) * radius, y0, Math.sin(a0) * radius, 0, y1, 0, Math.cos(a1) * radius, y0, Math.sin(a1) * radius);
    }
  };
  tier(0, 0.66, 0.5);
  tier(0.4, 1, 0.36);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

const PINE_VERT = /* glsl */ `
attribute vec3 aTint;
varying vec3 vCol;
void main() {
  // The upper tier catches the morning: one tone lighter.
  vCol = aTint * (0.9 + 0.22 * step(0.67, position.y));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const PINE_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, 0.5);
}
`;

function buildPines(): THREE.InstancedMesh {
  const rand = mulberry32(1830);
  const COUNT = 24000;
  const geo = buildPineGeometry();
  const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ vertexShader: PINE_VERT, fragmentShader: PINE_FRAG, side: THREE.DoubleSide }), COUNT);
  const tints = new Float32Array(COUNT * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const hero = new THREE.Vector2(HERO.position[0], HERO.position[2]);
  let n = 0;
  let tries = 0;
  while (n < COUNT) {
    if (++tries > COUNT * 40) throw new Error(`Pine placement stalled at ${n} of ${COUNT} trees`);
    const a = rand() * Math.PI * 2;
    const r = 70 + Math.pow(rand(), 0.8) * 350;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = fujiHeight(x, z);
    // Trees thin out toward the tree line.
    const keep = smoothstep(FUJI.treeLine[0], FUJI.treeLine[1], r + 30 * (noise2(x * 0.028, z * 0.028) - 0.5));
    if (rand() > keep) continue;
    // The print stipples the forest at one size, with no perspective: trees
    // near the print's viewpoint are smaller and stand closer together.
    const d = Math.hypot(x - hero.x, z - hero.y);
    if (d < 40) continue;
    const near = Math.min(Math.max(d / 230, 0.3), 1.1);
    if (rand() > 0.09 / (near * near)) continue;
    const s = (1.3 + rand() * 1.1) * near;
    e.set((rand() - 0.5) * 0.12, rand() * Math.PI * 2, (rand() - 0.5) * 0.12);
    m.compose(new THREE.Vector3(x, h - 0.1, z), q.setFromEuler(e), new THREE.Vector3(s, s * (1.3 + rand() * 0.7), s));
    mesh.setMatrixAt(n, m);
    tints.set(mix3(INK.forestDark, [0.06, 0.2, 0.24], rand() * 0.6), n * 3);
    n++;
  }
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Mackerel sky
// ---------------------------------------------------------------------------

/** Half the arc, seen from the print's viewpoint, that the cloud banks cover. */
const CLOUD_ARC = 128 * DEG;

const CLOUD_VERT = /* glsl */ `
attribute vec2 aBank;
uniform float uTime;
uniform float uArc;
uniform vec3 uHero;
varying float vShade;
void main() {
  vec3 centre = instanceMatrix[3].xyz;
  vec3 scale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  // A bank drifts along its arc around the print's viewpoint and wraps at the
  // ends. A puff shrinks to nothing before it wraps.
  float phi = mod(aBank.x + uTime * aBank.y + uArc, 2.0 * uArc) - uArc;
  float fade = smoothstep(0.0, 0.2, uArc - abs(phi));
  float turn = phi - aBank.x;
  vec3 rel = centre - uHero + mat3(instanceMatrix) * (position * fade);
  float cs = cos(turn); float sn = sin(turn);
  vec3 p = uHero + vec3(rel.x * cs - rel.z * sn, rel.y, rel.x * sn + rel.z * cs);
  vec3 n = normalize(position / scale);
  vShade = 1.0 - smoothstep(-0.74, -0.62, n.y);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform vec3 uCloud;
uniform vec3 uCloudShade;
varying float vShade;
void main() {
  // Flat shading: paper white, with one pale blue tone on the underside.
  gl_FragColor = vec4(mix(uCloud, uCloudShade, step(0.5, vShade)), 0.3);
}
`;

interface Puff { phi: number; dist: number; y: number; rx: number; ry: number; rz: number; turnRate: number }

function buildCloudBanks(): Puff[] {
  const rand = mulberry32(36);
  const puffs: Puff[] = [];
  const BANKS = 19;
  for (let b = 0; b < BANKS; b++) {
    // Each bank is an arc at one elevation in the print's view: the banks stack
    // into horizontal stripes that close up toward the horizon.
    const el = (2.0 + 1.0 * b + 0.055 * b * b) * DEG;
    const dist = 520 + 30 * b;
    const y = HERO.position[1] + dist * Math.tan(el);
    const size = (dist / 520) * (0.62 + 0.02 * b);
    const turnRate = (0.9 + 0.7 * rand()) / dist;
    const span = CLOUD_ARC * dist;
    let s = -span + rand() * 80;
    while (s < span - 60) {
      const length = 60 + rand() * 190;
      const count = Math.max(3, Math.round(length / (8.4 * size)));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        // Fat in the middle of a cluster, thin at its ends.
        const swell = 0.5 + 0.6 * Math.sin(Math.PI * t) + 0.25 * rand();
        const ps = s + t * length + (rand() - 0.5) * 5;
        puffs.push({ phi: ps / dist, dist: dist + (rand() - 0.5) * 16, y: y + (rand() - 0.5) * 2.2 * size, rx: (9 + rand() * 6) * size * swell, ry: (3.2 + rand() * 1.6) * size * swell, rz: 7 * size, turnRate });
        // A second, smaller row of scallops on top.
        if (rand() < 0.4 && t > 0.15 && t < 0.85) {
          puffs.push({ phi: (ps + (rand() - 0.5) * 8) / dist, dist: dist + 3 + (rand() - 0.5) * 8, y: y + (2.6 + rand() * 1.6) * size * swell, rx: (5.5 + rand() * 4) * size, ry: (2.4 + rand() * 1.2) * size, rz: 5 * size, turnRate });
        }
      }
      s += length + 18 + rand() * 80;
    }
  }
  return puffs;
}

function buildClouds(time: THREE.IUniform<number>): THREE.InstancedMesh {
  const puffs = buildCloudBanks();
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const hero = new THREE.Vector3(HERO.position[0], 0, HERO.position[2]);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: { uTime: time, uArc: { value: CLOUD_ARC }, uHero: { value: hero }, uCloud: { value: v3(INK.cloud) }, uCloudShade: { value: v3(INK.cloudShade) } },
    }),
    puffs.length,
  );
  const bank = new Float32Array(puffs.length * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  puffs.forEach((p, i) => {
    // The long axis of a puff lies along its arc.
    q.setFromAxisAngle(up, -p.phi);
    m.compose(new THREE.Vector3(hero.x + Math.sin(p.phi) * p.dist, p.y, hero.z - Math.cos(p.phi) * p.dist), q, new THREE.Vector3(p.rx, p.ry, p.rz));
    mesh.setMatrixAt(i, m);
    bank[i * 2] = p.phi;
    bank[i * 2 + 1] = p.turnRate;
  });
  geo.setAttribute('aBank', new THREE.InstancedBufferAttribute(bank, 2));
  mesh.frustumCulled = false;
  return mesh;
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uPale;
uniform vec3 uHaze;
varying vec3 vDir;
${GLSL_NOISE}
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0)) * 57.2958;
  // Bokashi: indigo wiped from the top of the block down into pale morning.
  float wipe = el + 1.6 * (vnoise(vec2(az * 2.4, 3.0)) - 0.5);
  vec3 col = mix(uPale, uMid, smoothstep(0.5, 9.0, wipe));
  col = mix(col, uDeep, smoothstep(7.0, 24.0, wipe));
  col = mix(col, uDeep * 0.82, smoothstep(40.0, 90.0, el));
  col = mix(col, uHaze, 1.0 - smoothstep(-2.0, 0.2, el));
  gl_FragColor = vec4(col, 0.0);
}
`;

// ---------------------------------------------------------------------------
// Post: Prussian-blue keyblock lines and washi paper
// ---------------------------------------------------------------------------

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  vec4 c = texture2D(tScene, vUv);
  // Keyblock line: region id break, or a depth break inside one region.
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
  line = max(line, smoothstep(0.01, 0.03, depthEdge(vUv, o)) * step(0.1, c.a));
  vec3 ink = vec3(0.09, 0.19, 0.36);
  vec3 col = mix(c.rgb, ink, line * 0.9);

  // Pigment sits unevenly: baren pressure and the grain of the cherry block.
  float baren = vnoise(cv * 0.035) * 0.6 + vnoise(cv * 0.011 + 7.0) * 0.4;
  float grain = vnoise(vec2(cv.x * 0.012, cv.y * 1.1)) * 0.6 + vnoise(vec2(cv.x * 0.05, cv.y * 2.3 + 5.0)) * 0.4;
  col *= 0.93 + 0.08 * baren + 0.05 * grain;
  // Washi: fibres and tooth.
  float fibre = vnoise(vec2(cv.x * 0.9, cv.y * 0.08) + 3.0) * vnoise(vec2(cv.x * 0.07, cv.y * 0.8));
  float tooth = hash21(floor(cv * 1.3));
  col = mix(col, col * vec3(1.03, 1.0, 0.94), 0.5);
  col *= 0.965 + 0.05 * fibre + 0.02 * tooth;
  col *= vignette(vUv, 0.2);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createRedFuji(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 6000;
  const time: THREE.IUniform<number> = { value: 0 };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uDeep: { value: v3(INK.skyDeep) }, uMid: { value: v3(INK.skyMid) }, uPale: { value: v3(INK.skyPale) }, uHaze: { value: v3(INK.haze) } },
      side: THREE.BackSide,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const fuji = new THREE.Mesh(
    buildFuji(),
    new THREE.ShaderMaterial({
      vertexShader: FUJI_VERT,
      fragmentShader: FUJI_FRAG,
      uniforms: {
        uMaroon: { value: v3(INK.maroon) },
        uRed: { value: v3(INK.red) },
        uOrange: { value: v3(INK.orange) },
        uForest: { value: v3(INK.forest) },
        uForestDark: { value: v3(INK.forestDark) },
        uHaze: { value: v3(INK.haze) },
        uSnow: { value: v3(INK.snow) },
        uHeight: { value: FUJI.height },
        uGullies: { value: FUJI.gullies },
        uTreeLine: { value: new THREE.Vector2(FUJI.treeLine[0], FUJI.treeLine[1]) },
      },
    }),
  );
  fuji.frustumCulled = false;
  scene.add(fuji);

  const pines = buildPines();
  scene.add(pines);
  const clouds = buildClouds(time);
  scene.add(clouds);

  return {
    scene,
    meta: {
      title: 'Fine Wind, Clear Morning (Red Fuji)',
      artist: 'Katsushika Hokusai · c. 1830',
      technique: 'Polar height sheet with carved summit gullies and snow streaks, stippled tree line, instanced pines, drifting banks of flat-shaded cloud puffs, id + depth keyblock lines, washi paper.',
    },
    presets: [
      { name: 'The Painting', position: HERO.position, target: HERO.target, fov: 20.5 },
      { name: 'Summit Gullies', position: [34, 64, 46], target: [0, 54, 0], fov: 46 },
      { name: 'Among the Pines', position: [-150, 13, 170], target: [0, 50, 0], fov: 44 },
      { name: 'Above the Clouds', position: [-190, 150, 330], target: [20, 40, -60], fov: 40 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.5,
    far,
    flySpeed: 48,
    maxDistance: 900,
    floorAt: (x, z) => fujiHeight(x, z) + 1.5,
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
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
    },
  };
}
