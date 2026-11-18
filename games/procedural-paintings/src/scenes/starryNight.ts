// The Starry Night — Vincent van Gogh, 1889.
//
// Every surface is paint. The sky is a dome whose colour field and flow field
// are baked once on the CPU (vortices, star halos, a line-integral streak
// pass). The fragment shader then lays three layers of oriented brush dabs
// over those fields; each dab takes one flat pigment colour from the field at
// its centre and slides along the flow. Terrain, village, and trees use the
// same dab function over a chart projected from the painting's viewpoint.

import * as THREE from 'three';
import { GLSL_NOISE, strokeFn } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, fbm2, hex, mix, mix3, mulberry32, noise2, noise3, smoothstep, type RGB } from '../util';

const DEG = Math.PI / 180;
const HERO = new THREE.Vector3(0, 20, 135);
const EL0 = -0.2;
const EL1 = Math.PI / 2;
const MOON_DIR = new THREE.Vector3(Math.sin(21 * DEG) * Math.cos(21 * DEG), Math.sin(21 * DEG), -Math.cos(21 * DEG) * Math.cos(21 * DEG));

/** Painting coordinates (x in [-0.5, 0.5], y in [0, 1]) to sky angles. */
function paintingToSky(px: number, py: number): { az: number; el: number } {
  return { az: px * 52 * DEG, el: (py - 0.36) * 41 * DEG };
}

function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

// ---------------------------------------------------------------------------
// Sky fields
// ---------------------------------------------------------------------------

interface Halo {
  az: number;
  el: number;
  /** Radius of one ring band, radians. */
  r: number;
  kind: 'star' | 'venus' | 'moon';
}

interface Vortex {
  az: number;
  el: number;
  radius: number;
  strength: number;
  spin: 1 | -1;
}

function buildSkyFeatures(): { halos: Halo[]; vortices: Vortex[] } {
  const halos: Halo[] = [];
  const star = (px: number, py: number, rDeg: number, kind: Halo['kind'] = 'star'): void => {
    halos.push({ ...paintingToSky(px, py), r: rDeg * DEG, kind });
  };
  star(-0.215, 0.56, 1.05, 'venus');
  star(-0.445, 0.72, 0.62);
  star(-0.41, 0.95, 0.56);
  star(-0.135, 0.93, 0.74);
  star(-0.02, 0.83, 0.6);
  star(0.075, 0.955, 0.55);
  star(0.2, 0.9, 0.68);
  star(0.265, 0.7, 0.76);
  star(-0.105, 0.69, 0.5);
  star(0.335, 0.53, 0.58);
  star(0.12, 0.74, 0.44);
  star(0.41, 0.865, 1.5, 'moon');

  const vortices: Vortex[] = [
    { ...paintingToSky(0.025, 0.605), radius: 6.6 * DEG, strength: 1, spin: 1 },
    { ...paintingToSky(0.195, 0.5), radius: 4.3 * DEG, strength: 0.85, spin: 1 },
  ];

  // The rest of the dome: more stars and swirls so every direction is painted.
  const rand = mulberry32(1889);
  for (let i = 0; i < 46; i++) {
    const az = (rand() * 2 - 1) * Math.PI;
    const el = (6 + rand() * 62) * DEG;
    if (Math.abs(az) < 30 * DEG && el < 30 * DEG) continue;
    halos.push({ az, el, r: (0.45 + rand() * 0.5) * DEG, kind: 'star' });
  }
  for (let i = 0; i < 14; i++) {
    const az = (rand() * 2 - 1) * Math.PI;
    const el = (10 + rand() * 45) * DEG;
    if (Math.abs(az) < 34 * DEG && el < 32 * DEG) continue;
    vortices.push({ az, el, radius: (4 + rand() * 5) * DEG, strength: 0.7 + rand() * 0.3, spin: rand() < 0.5 ? 1 : -1 });
  }
  return { halos, vortices };
}

/** Apparent top of the hills as seen from the hero viewpoint, in degrees. */
function hillLineDeg(az: number): number {
  const a = az / DEG;
  return 1.2 + 4.2 * smoothstep(-14, 22, a) + 1.1 * Math.sin(a * 0.21 + 0.6) + 0.6 * Math.sin(a * 0.53 + 2.0);
}

const SKY = {
  night: hex(0x0d1540),
  deep: hex(0x18296e),
  cobalt: hex(0x2a4d9e),
  cerulean: hex(0x447cc0),
  light: hex(0x8db9de),
  pale: hex(0xbdd6dc),
  white: hex(0xe6ede0),
  glow: hex(0xdfe2b4),
  yellow: hex(0xf5dc62),
  paleYellow: hex(0xfaf0b4),
  orange: hex(0xf0a030),
  cream: hex(0xdfe9c8),
};
const RING_COLORS: RGB[] = [SKY.yellow, SKY.paleYellow, SKY.cream, SKY.pale, SKY.light, SKY.cerulean, SKY.cobalt];

function bakeSky(): { flow: THREE.DataTexture; color: THREE.DataTexture; aux: THREE.DataTexture } {
  const W = 1024;
  const H = 256;
  const { halos, vortices } = buildSkyFeatures();
  const flowF = new Float32Array(W * H * 2);
  const energy = new Float32Array(W * H);
  const size = new Float32Array(W * H);

  for (let y = 0; y < H; y++) {
    const el = EL0 + ((y + 0.5) / H) * (EL1 - EL0);
    const cosEl = Math.max(Math.cos(el), 0.2);
    for (let x = 0; x < W; x++) {
      const az = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const cx = Math.cos(az), sx = Math.sin(az);
      let fx = 1;
      let fy = 0.2 * Math.sin(az * 3 + 0.8) + 0.14 * Math.sin(az * 7 + el * 3 + 2) + (noise3(cx * 2.4, el * 3.3, sx * 2.4) - 0.5) * 1.1;
      let e = 0.2;
      let sz = 0.5;
      for (const v of vortices) {
        const dx = wrapAngle(az - v.az) * cosEl;
        const dy = el - v.el;
        const r2 = dx * dx + dy * dy;
        const lim = v.radius * 2.6;
        if (r2 > lim * lim) continue;
        const r = Math.sqrt(r2) + 1e-5;
        const w = v.strength * Math.exp(-r2 / (v.radius * v.radius));
        fx += w * 7 * ((-dy / r) * v.spin - (dx / r) * 0.32);
        fy += w * 7 * ((dx / r) * v.spin - (dy / r) * 0.32);
        e += w * 0.9;
        sz += w * 0.3;
      }
      for (const h of halos) {
        const dx = wrapAngle(az - h.az) * cosEl;
        const dy = el - h.el;
        const r2 = dx * dx + dy * dy;
        const reach = h.r * (h.kind === 'moon' ? 3.6 : 3.2);
        if (r2 > reach * reach * 2.2) continue;
        const r = Math.sqrt(r2) + 1e-5;
        const w = Math.exp(-r2 / (reach * reach * 0.42));
        fx += w * 12 * (-dy / r);
        fy += w * 12 * (dx / r);
        e += w * 0.5;
        sz -= w * 0.9;
      }
      const zen = smoothstep(52 * DEG, 76 * DEG, el);
      fx = mix(fx, 4, zen);
      fy = mix(fy, 0, zen);
      const len = Math.hypot(fx, fy) + 1e-6;
      const i = y * W + x;
      flowF[i * 2] = fx / len;
      flowF[i * 2 + 1] = fy / len;
      energy[i] = clamp(e, 0, 1);
      size[i] = clamp(sz, 0, 1);
    }
  }

  // Line-integral convolution: streaks of light and dark pigment that follow
  // the flow, so neighbouring dabs along a streamline share a tone.
  const lic = new Float32Array(W * H);
  const STEPS = 18;
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
          sum += w * noise3(Math.cos(az) * 30, el * 34, Math.sin(az) * 30);
          wsum += w;
          px += sgn * flowF[fi] * 1.15;
          py += sgn * flowF[fi + 1] * 1.15;
        }
      }
      lic[y * W + x] = sum / wsum;
    }
  }

  const flow = new Uint8Array(W * H * 4);
  const color = new Uint8Array(W * H * 4);
  const aux = new Uint8Array(W * H * 4);
  const main = vortices[0];
  const second = vortices[1];
  for (let y = 0; y < H; y++) {
    const el = EL0 + ((y + 0.5) / H) * (EL1 - EL0);
    const elDeg = el / DEG;
    const cosEl = Math.max(Math.cos(el), 0.2);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const az = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const azDeg = az / DEG;
      const cx = Math.cos(az), sx = Math.sin(az);

      let c = mix3(SKY.cerulean, SKY.cobalt, smoothstep(2, 15, elDeg));
      c = mix3(c, SKY.deep, smoothstep(13, 38, elDeg) * 0.8);
      c = mix3(c, SKY.night, smoothstep(42, 85, elDeg));
      const big = noise3(cx * 2.1 + 5, el * 3.2, sx * 2.1);
      c = mix3(c, big > 0.5 ? SKY.cerulean : SKY.deep, Math.abs(big - 0.5) * 1.3);

      // Pale band of dawn light that sits on the hills.
      const hill = hillLineDeg(az);
      const band = Math.exp(-Math.pow((elDeg - hill - 1.6) / 2.3, 2));
      const inFrame = 0.35 + 0.65 * smoothstep(-34, -8, azDeg) * (1 - smoothstep(34, 60, azDeg));
      c = mix3(c, SKY.pale, band * 0.62 * inFrame);
      c = mix3(c, SKY.glow, band * band * 0.6 * inFrame * (0.5 + 0.5 * noise3(cx * 9, el * 14, sx * 9)));

      // Flow streaks.
      const l = (lic[i] - 0.5) * 3.2 + 0.5;
      const e = energy[i];
      const lightAmt = smoothstep(0.56, 0.9, l) * (0.22 + 0.62 * e);
      const darkAmt = smoothstep(0.48, 0.16, l) * (0.4 + 0.25 * e);
      c = mix3(c, mix3(SKY.light, SKY.white, e * 0.75), lightAmt);
      c = mix3(c, SKY.deep, darkAmt);

      // The great swirl: a bright spiral arm with a dark eye.
      for (const v of [main, second]) {
        const dx = wrapAngle(az - v.az) * cosEl;
        const dy = el - v.el;
        const r = Math.hypot(dx, dy) / v.radius;
        if (r > 2.2) continue;
        const th = Math.atan2(dy, dx);
        const arm = Math.sin(th * 2 - Math.log(r + 0.08) * 5.2 + 1.2);
        const w = Math.exp(-r * r * 0.8) * 0.8;
        c = mix3(c, arm > 0 ? mix3(SKY.white, SKY.light, smoothstep(0.5, 1.6, r)) : SKY.deep, w * Math.pow(Math.abs(arm), 0.55));
        c = mix3(c, SKY.paleYellow, Math.exp(-r * r * 9) * 0.5);
      }

      // Stars and moon.
      let pulseW = 0;
      let phase = 0;
      for (const h of halos) {
        const dx = wrapAngle(az - h.az) * cosEl;
        const dy = el - h.el;
        const k = Math.hypot(dx, dy) / h.r;
        if (k > 4) continue;
        if (h.kind === 'moon') {
          const cutX = (dx + h.r * 0.42) / (h.r * 0.86);
          const cutY = (dy - h.r * 0.12) / (h.r * 0.86);
          const inDisc = k < 1;
          const inCut = Math.hypot(cutX, cutY) < 1;
          if (inDisc) {
            c = inCut ? mix3(SKY.yellow, SKY.paleYellow, 0.25) : mix3(SKY.orange, SKY.yellow, smoothstep(0.75, 1, k) * 0.5);
          } else {
            const ring = Math.min(Math.floor((k - 1) / 0.42), RING_COLORS.length - 1);
            const w = (1 - smoothstep(1.6, 3.7, k)) * 0.92;
            c = mix3(c, RING_COLORS[ring], w);
          }
        } else {
          const core = h.kind === 'venus' ? SKY.white : mix3(SKY.yellow, SKY.orange, 0.25 + 0.5 * noise2(h.az * 40, h.el * 40));
          if (k < 0.5) {
            c = mix3(SKY.paleYellow, core, smoothstep(0.1, 0.5, k));
          } else {
            const ring = Math.min(Math.floor((k - 0.5) / 0.48) + (h.kind === 'venus' ? 1 : 0), RING_COLORS.length - 1);
            const w = (1 - smoothstep(1.5, 3.5, k)) * 0.9;
            c = mix3(c, RING_COLORS[ring], w);
          }
        }
        const pw = 1 - smoothstep(0.4, 3.4, k);
        if (pw > pulseW) {
          pulseW = pw;
          phase = k / 4;
        }
      }

      color[i * 4] = clamp(c[0], 0, 1) * 255;
      color[i * 4 + 1] = clamp(c[1], 0, 1) * 255;
      color[i * 4 + 2] = clamp(c[2], 0, 1) * 255;
      color[i * 4 + 3] = 255;
      flow[i * 4] = (flowF[i * 2] * 0.5 + 0.5) * 255;
      flow[i * 4 + 1] = (flowF[i * 2 + 1] * 0.5 + 0.5) * 255;
      flow[i * 4 + 2] = size[i] * 255;
      flow[i * 4 + 3] = energy[i] * 255;
      aux[i * 4] = phase * 255;
      aux[i * 4 + 1] = pulseW * 255;
      aux[i * 4 + 3] = 255;
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
  return { flow: tex(flow), color: tex(color), aux: tex(aux) };
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
uniform sampler2D tAux;
uniform float uTime;
uniform float uPixAngle;
uniform vec3 uMoon;
varying vec3 vDir;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${strokeFn('strokeSky', 'tex')}
const float EL0 = -0.2;
const float EL1 = 1.5707963;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(az / K_TAU + 0.5, (el - EL0) / (EL1 - EL0));
  vec3 base = textureLod(tColor, uv, 0.0).rgb;
  vec4 aux = textureLod(tAux, uv, 0.0);
  vec2 ang = vec2(az + K_PI, el - EL0);
  gAccent = vec3(0.90, 0.93, 0.80);
  vec4 acc = vec4(base * 0.74, 0.06);
  const float N1 = 250.0; const float N2 = 390.0; const float N3 = 580.0;
  float D1 = N1 / K_TAU; float D2 = N2 / K_TAU; float D3 = N3 / K_TAU;
  float span = EL1 - EL0;
  acc = strokeSky(ang * D1, vec2(1.0 / N1, 1.0 / (D1 * span)), N1, uPixAngle * D1, 37.0, vec4(0.80, 0.30, 0.97, 0.075), vec4(0.14, 0.05, 0.07, 0.18), uTime, acc);
  acc = strokeSky(ang * D2 + vec2(0.0, 0.37), vec2(1.0 / N2, 1.0 / (D2 * span)), N2, uPixAngle * D2, 91.0, vec4(0.80, 0.26, 0.86, 0.09), vec4(0.17, 0.07, 0.09, 0.22), uTime, acc);
  acc = strokeSky(ang * D3 + vec2(0.0, 0.71), vec2(1.0 / N3, 1.0 / (D3 * span)), N3, uPixAngle * D3, 173.0, vec4(0.78, 0.24, 0.5, 0.11), vec4(0.2, 0.12, 0.05, 0.25), uTime, acc);
  // The moon: an orange crescent inside its yellow disc, drawn at full sharpness.
  vec2 md = vec2((az - uMoon.x) * cos(el), el - uMoon.y) / uMoon.z;
  float mk = length(md);
  if (mk < 1.3) {
    float disc = smoothstep(1.02, 0.95, mk);
    float cut = smoothstep(1.0, 0.93, length((md + vec2(0.46, -0.16)) / 0.82));
    float bris = vnoise(vec2(atan(md.y, md.x) * 7.0, mk * 13.0));
    vec3 orange = vec3(0.96, 0.60, 0.15) * (0.86 + 0.26 * bris);
    vec3 yellow = vec3(1.0, 0.93, 0.56) * (0.92 + 0.14 * bris);
    acc = mix(acc, vec4(mix(orange, yellow, cut), 0.5 + 0.45 * bris), disc);
  }
  float pulse = aux.g * (0.5 + 0.5 * sin(aux.r * 34.0 - uTime * 1.4));
  acc.rgb += pulse * vec3(0.09, 0.085, 0.03);
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

function terrainHeight(x: number, z: number): number {
  let h = 1.6 * (fbm2(x * 0.018 + 3, z * 0.018, 3) - 0.45);
  // The Alpilles: wave-like crests that rise to the right.
  const zr = -150 + 18 * Math.sin(x * 0.011 + 0.7);
  const crest = 27 + 22 * smoothstep(-90, 130, x) + 7 * Math.sin(x * 0.031 + 0.4) + 4.5 * Math.sin(x * 0.073 + 2.0) + 2.2 * Math.sin(x * 0.17 + 1.0);
  const dz = z - zr;
  h += crest * Math.exp(-(dz * dz) / (2 * 40 * 40)) * (0.86 + 0.28 * fbm2(x * 0.03, z * 0.03, 3));
  // Lower blue-green foothills in front.
  const z2 = -84 + 10 * Math.sin(x * 0.021 + 1.1);
  const crest2 = 9 + 5 * Math.sin(x * 0.045 + 1.3) + 3 * Math.sin(x * 0.11 + 0.2);
  h += crest2 * Math.exp(-((z - z2) * (z - z2)) / (2 * 20 * 20));
  // The hillside the painter stands on.
  h += 17.5 * smoothstep(70, 138, z + 0.12 * x) + 16 * smoothstep(138, 240, z);
  h += 2.2 * smoothstep(80, 120, z) * (fbm2(x * 0.06, z * 0.06, 3) - 0.5);
  // Far ring, so the valley is closed in every direction.
  const ring = Math.hypot(x, z + 10);
  h += 46 * smoothstep(215, 310, ring) * (0.75 + 0.5 * fbm2(x * 0.012 + 9, z * 0.012, 3));
  return h;
}

const LAND = {
  blueDark: hex(0x1a2a6c),
  blue: hex(0x2c4c9a),
  blueLight: hex(0x5a8cc6),
  teal: hex(0x27606e),
  green: hex(0x1f4f44),
  greenLight: hex(0x35704f),
  olive: hex(0x5b7a3c),
  wheat: hex(0x9a9648),
  shadow: hex(0x15244f),
  nearDark: hex(0x10231d),
  near: hex(0x1d3b2a),
};

function terrainColor(x: number, z: number, h: number, n: THREE.Vector3): RGB {
  const lit = clamp(0.5 + 0.9 * n.dot(MOON_DIR), 0, 1);
  const patch = fbm2(x * 0.035 + 20, z * 0.035, 3);
  const fine = noise2(x * 0.11, z * 0.11);
  // Valley floor: a patchwork of night-green fields.
  let c = mix3(LAND.green, LAND.greenLight, smoothstep(0.35, 0.65, patch));
  c = mix3(c, LAND.teal, smoothstep(0.55, 0.3, fine) * 0.5);
  c = mix3(c, LAND.olive, smoothstep(0.6, 0.72, patch) * 0.7);
  c = mix3(c, LAND.wheat, smoothstep(0.7, 0.8, patch) * smoothstep(0.4, 0.7, fine) * 0.75);
  c = mix3(c, LAND.shadow, smoothstep(0.42, 0.25, patch) * 0.6);
  // Mountains: ultramarine with lit crests.
  const mountain = smoothstep(4, 15, h) * (1 - smoothstep(48, 80, z));
  let m = mix3(LAND.blueDark, LAND.blue, lit);
  m = mix3(m, LAND.teal, smoothstep(16, 5, h) * 0.55);
  m = mix3(m, LAND.blueLight, smoothstep(0.62, 0.95, lit) * (0.35 + 0.5 * fine));
  c = mix3(c, m, mountain);
  // The painter's hillside: almost black-green.
  const near = smoothstep(62, 100, z + 0.12 * x);
  const nearCol = mix3(LAND.nearDark, LAND.near, smoothstep(0.3, 0.7, patch));
  c = mix3(c, mix3(nearCol, LAND.olive, smoothstep(0.66, 0.8, fine) * 0.35), near);
  return c;
}

const HERO_CHART = /* glsl */ `
uniform vec3 uHero;
uniform float uPixRef;
vec2 heroChart(vec3 wp) {
  vec3 p = wp - uHero;
  return vec2(atan(p.x, -p.z), atan(p.y, length(p.xz)));
}
`;

const TERRAIN_VERT = /* glsl */ `
attribute vec3 color;
attribute vec3 aFlow;
varying vec3 vWp;
varying vec3 vCol;
varying vec2 vDir2;
${HERO_CHART}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vCol = color;
  vec2 d = heroChart(wp.xyz + aFlow * 0.8) - heroChart(wp.xyz - aFlow * 0.8);
  d /= max(length(d), 1e-6);
  vDir2 = vec2(d.x * d.x - d.y * d.y, 2.0 * d.x * d.y);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/** Fragment tail shared by the chart-projected materials. Expects col and dir. */
const CHART_STROKES = /* glsl */ `
  vec2 ch = heroChart(vWp);
  float pxr = clamp(length(fwidth(ch)) * 0.7, 1e-6, 0.05);
  // Octave selection keeps dabs near one size on screen at any distance.
  float lod = log2(uPixRef / pxr);
  float k = floor(lod);
  float D = 34.0 * exp2(k);
  gFlow = vec4(dir * 0.5 + 0.5, 0.5, 0.3);
  gColor = col;
  vec4 acc = vec4(col * 0.7, 0.08);
  acc = strokeVar(ch * D, vec2(1.0), 0.0, pxr * D, 13.0, vec4(0.80, 0.28, 0.95, 0.02), jitA, uTime, acc);
  acc = strokeVar(ch * D * 2.0, vec2(1.0), 0.0, pxr * D * 2.0, 13.0, vec4(0.80, 0.26, 0.8, 0.03), jitB, uTime, acc);
  vec4 fine = strokeVar(ch * D * 4.0, vec2(1.0), 0.0, pxr * D * 4.0, 13.0, vec4(0.80, 0.26, 0.8, 0.03), jitB, uTime, acc);
  acc = mix(acc, fine, smoothstep(0.0, 1.0, lod - k));
  gl_FragColor = acc;
`;

const TERRAIN_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vWp;
varying vec3 vCol;
varying vec2 vDir2;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${HERO_CHART}
${strokeFn('strokeVar', 'var')}
void main() {
  float ang = 0.5 * atan(vDir2.y, vDir2.x);
  vec2 dir = vec2(cos(ang), sin(ang));
  vec3 col = vCol;
  gAccent = vec3(0.56, 0.72, 0.82);
  vec4 jitA = vec4(0.24, 0.07, 0.10, 0.22);
  vec4 jitB = vec4(0.28, 0.09, 0.12, 0.26);
  ${CHART_STROKES}
}
`;

function buildTerrain(): THREE.BufferGeometry {
  const N = 230;
  const x0 = -340, x1 = 340, z0 = -340, z1 = 260;
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const x = mix(x0, x1, i / N);
      const z = mix(z0, z1, j / N);
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
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const nor = geo.getAttribute('normal');
  const col = new Float32Array(pos.length);
  const flow = new Float32Array(pos.length);
  const n = new THREE.Vector3();
  for (let v = 0; v < pos.length / 3; v++) {
    n.fromBufferAttribute(nor, v);
    const x = pos[v * 3], h = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const c = terrainColor(x, z, h, n);
    col.set(c, v * 3);
    // Dabs follow the contour lines; on flat ground they run across the view.
    const wob = (noise2(x * 0.04, z * 0.04) - 0.5) * 0.5;
    let fx = -n.z * 6 + 0.25;
    let fz = n.x * 6 + wob * 0.25;
    if (fx < 0) { fx = -fx; fz = -fz; }
    const fl = Math.hypot(fx, fz);
    fx /= fl; fz /= fl;
    // Tangent on the surface: y follows the slope.
    const fy = -(n.x * fx + n.z * fz) / Math.max(n.y, 0.2);
    flow[v * 3] = fx; flow[v * 3 + 1] = fy; flow[v * 3 + 2] = fz;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 3));
  return geo;
}

// ---------------------------------------------------------------------------
// Village
// ---------------------------------------------------------------------------

class FaceBuilder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly kind: number[] = [];
  private readonly m = new THREE.Matrix4();

  setTransform(m: THREE.Matrix4): void {
    this.m.copy(m);
  }

  /** kind: 0 wall, 1 roof, 2 lit window. Points are counter-clockwise. */
  poly(points: Array<[number, number, number]>, color: RGB, kind: number): void {
    const ps = points.map((p) => new THREE.Vector3(...p).applyMatrix4(this.m));
    const n = new THREE.Vector3().subVectors(ps[1], ps[0]).cross(new THREE.Vector3().subVectors(ps[2], ps[0])).normalize();
    for (let i = 1; i < ps.length - 1; i++) {
      for (const p of [ps[0], ps[i], ps[i + 1]]) {
        this.pos.push(p.x, p.y, p.z);
        this.nor.push(n.x, n.y, n.z);
        this.col.push(color[0], color[1], color[2]);
        this.kind.push(kind);
      }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.kind, 1));
    return g;
  }
}

const WALLS: RGB[] = [hex(0x3c5c94), hex(0x5878ac), hex(0x2c4680), hex(0x6e8cb4), hex(0x4a6a8e), hex(0x7a8a72)];
const ROOFS: RGB[] = [hex(0x1b2a5e), hex(0x24386e), hex(0x6a3a2c), hex(0x1f4a52), hex(0x47305a)];
const WINDOW_LIT: RGB[] = [hex(0xf8d24e), hex(0xf4a83a), hex(0xfbe37c)];
const WINDOW_DARK = hex(0x121c44);

function addHouse(b: FaceBuilder, rand: () => number, w: number, d: number, hw: number, hr: number, lit: number): void {
  const wall = WALLS[Math.floor(rand() * WALLS.length)];
  const roof = ROOFS[Math.floor(rand() * ROOFS.length)];
  const x = w / 2, z = d / 2;
  b.poly([[-x, 0, z], [x, 0, z], [x, hw, z], [-x, hw, z]], wall, 0);
  b.poly([[x, 0, -z], [-x, 0, -z], [-x, hw, -z], [x, hw, -z]], wall, 0);
  b.poly([[x, 0, z], [x, 0, -z], [x, hw, -z], [x, hw + hr, 0], [x, hw, z]], mix3(wall, [0, 0, 0], 0.18), 0);
  b.poly([[-x, 0, -z], [-x, 0, z], [-x, hw, z], [-x, hw + hr, 0], [-x, hw, -z]], mix3(wall, [0, 0, 0], 0.18), 0);
  const ov = 0.3, ex = x + 0.22, drop = (hr * ov) / z;
  b.poly([[-ex, hw - drop, z + ov], [ex, hw - drop, z + ov], [ex, hw + hr, 0], [-ex, hw + hr, 0]], roof, 1);
  b.poly([[ex, hw - drop, -z - ov], [-ex, hw - drop, -z - ov], [-ex, hw + hr, 0], [ex, hw + hr, 0]], mix3(roof, [0, 0, 0], 0.2), 1);
  // Windows on the long walls and one on each gable end.
  const count = Math.max(1, Math.round(w / 1.5));
  for (const side of [1, -1]) {
    for (let i = 0; i < count; i++) {
      const wx = mix(-x, x, (i + 0.5) / count) + (rand() - 0.5) * 0.2;
      const wy = hw * (0.5 + rand() * 0.12);
      const ww = 0.26 + rand() * 0.1, wh = 0.36 + rand() * 0.14;
      const isLit = rand() < lit;
      const c = isLit ? WINDOW_LIT[Math.floor(rand() * WINDOW_LIT.length)] : WINDOW_DARK;
      const zz = side * (z + 0.03);
      const pts: Array<[number, number, number]> = [[wx - ww, wy - wh, zz], [wx + ww, wy - wh, zz], [wx + ww, wy + wh, zz], [wx - ww, wy + wh, zz]];
      if (side < 0) pts.reverse();
      b.poly(pts, c, isLit ? 2 : 0);
    }
  }
  for (const side of [1, -1]) {
    const isLit = rand() < lit;
    const c = isLit ? WINDOW_LIT[Math.floor(rand() * WINDOW_LIT.length)] : WINDOW_DARK;
    const xx = side * (x + 0.03), wy = hw * 0.58;
    const pts: Array<[number, number, number]> = [[xx, wy - 0.4, 0.3], [xx, wy - 0.4, -0.3], [xx, wy + 0.4, -0.3], [xx, wy + 0.4, 0.3]];
    if (side < 0) pts.reverse();
    b.poly(pts, c, isLit ? 2 : 0);
  }
}

function addChurch(b: FaceBuilder): void {
  const wall = hex(0x4a6498);
  const dark = hex(0x2a3c74);
  const roof = hex(0x1a2658);
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: RGB): void => {
    b.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c, 0);
    b.poly([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], mix3(c, [0, 0, 0], 0.25), 0);
    b.poly([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], mix3(c, [1, 1, 1], 0.08), 0);
    b.poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], mix3(c, [0, 0, 0], 0.2), 0);
  };
  // Nave with a steep roof.
  box(-3, 3, 0, 5.4, -11, 0, wall);
  b.poly([[-3.3, 5.2, 0.3], [0, 9, 0.3], [0, 9, -11.3], [-3.3, 5.2, -11.3]], roof, 1);
  b.poly([[3.3, 5.2, -11.3], [0, 9, -11.3], [0, 9, 0.3], [3.3, 5.2, 0.3]], mix3(roof, [1, 1, 1], 0.06), 1);
  b.poly([[-3, 5.4, 0], [3, 5.4, 0], [0, 9, 0]], wall, 0);
  b.poly([[3, 5.4, -11], [-3, 5.4, -11], [0, 9, -11]], dark, 0);
  // Tower and the tall spire that crosses the hill line.
  box(-1.8, 1.8, 0, 12.5, 0, 3.6, mix3(wall, [1, 1, 1], 0.05));
  const s = 2.1, top = 29.5, y = 12.5, cz = 1.8;
  b.poly([[-s, y, cz + s], [s, y, cz + s], [0, top, cz]], roof, 1);
  b.poly([[s, y, cz + s], [s, y, cz - s], [0, top, cz]], mix3(roof, [1, 1, 1], 0.1), 1);
  b.poly([[s, y, cz - s], [-s, y, cz - s], [0, top, cz]], mix3(roof, [0, 0, 0], 0.3), 1);
  b.poly([[-s, y, cz - s], [-s, y, cz + s], [0, top, cz]], mix3(roof, [0, 0, 0], 0.2), 1);
  // Lit windows.
  const lit = WINDOW_LIT[0];
  b.poly([[-0.45, 8.6, 3.64], [0.45, 8.6, 3.64], [0.45, 10.6, 3.64], [-0.45, 10.6, 3.64]], lit, 2);
  b.poly([[-0.4, 2.2, 3.64], [0.4, 2.2, 3.64], [0.4, 4.0, 3.64], [-0.4, 4.0, 3.64]], WINDOW_LIT[1], 2);
  for (let i = 0; i < 4; i++) {
    const z = -1.6 - i * 2.5;
    b.poly([[3.04, 1.8, z], [3.04, 1.8, z - 0.8], [3.04, 3.9, z - 0.8], [3.04, 3.9, z]], WINDOW_LIT[i % 3], 2);
    b.poly([[-3.04, 1.8, z - 0.8], [-3.04, 1.8, z], [-3.04, 3.9, z], [-3.04, 3.9, z - 0.8]], WINDOW_LIT[(i + 1) % 3], 2);
  }
}

interface Plot { x: number; z: number; r: number }

function buildVillage(): { geometry: THREE.BufferGeometry; plots: Plot[] } {
  const rand = mulberry32(53);
  const b = new FaceBuilder();
  const plots: Plot[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const church = { x: 6, z: -14 };
  m.compose(new THREE.Vector3(church.x, terrainHeight(church.x, church.z) - 0.2, church.z), q.setFromEuler(new THREE.Euler(0, 0.35, 0)), new THREE.Vector3(1, 1, 1));
  b.setTransform(m);
  addChurch(b);
  plots.push({ x: church.x, z: church.z - 4, r: 8.5 });

  let tries = 0;
  while (plots.length < 58 && tries < 4000) {
    tries++;
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand());
    const x = 20 + Math.cos(a) * rr * 62;
    const z = -8 + Math.sin(a) * rr * 34;
    const w = 3.0 + rand() * 2.2, d = 2.8 + rand() * 1.4;
    const r = Math.max(w, d) * 0.72;
    if (plots.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 0.8)) continue;
    plots.push({ x, z, r });
    const ry = (rand() < 0.7 ? 0.3 : 0.3 + Math.PI / 2) + (rand() - 0.5) * 0.5;
    // A small tilt: no wall in this village is plumb.
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.07, ry, (rand() - 0.5) * 0.07));
    m.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.25, z), q, new THREE.Vector3(1, 1, 1));
    b.setTransform(m);
    addHouse(b, rand, w, d, 2.1 + rand() * 1.3, 1.3 + rand() * 0.9, 0.62);
  }
  return { geometry: b.build(), plots };
}

const VILLAGE_VERT = /* glsl */ `
attribute vec3 color;
attribute float aKind;
varying vec3 vWp;
varying vec3 vCol;
varying vec3 vN;
varying float vKind;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vCol = color;
  vN = normalize(mat3(modelMatrix) * normal);
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const VILLAGE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uMoon;
varying vec3 vWp;
varying vec3 vCol;
varying vec3 vN;
varying float vKind;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${HERO_CHART}
${strokeFn('strokeVar', 'var')}
void main() {
  if (vKind > 1.5) {
    // Lamplight: a flat warm dab that breathes.
    float f = 0.9 + 0.1 * sin(uTime * (1.3 + hash21(floor(vWp.xz)) * 2.0) + vWp.x);
    gl_FragColor = vec4(vCol * f, 0.9);
    return;
  }
  vec3 n = normalize(vN);
  float lit = 0.74 + 0.36 * max(dot(n, uMoon), 0.0) + 0.1 * n.y;
  vec3 col = vCol * lit;
  vec2 dir = vKind > 0.5 ? normalize(vec2(1.0, 0.35)) : normalize(vec2(0.25, 1.0));
  gAccent = vec3(0.62, 0.74, 0.86);
  vec4 jitA = vec4(0.2, 0.06, 0.08, 0.15);
  vec4 jitB = vec4(0.22, 0.08, 0.1, 0.2);
  ${CHART_STROKES}
}
`;

// ---------------------------------------------------------------------------
// Trees and bushes
// ---------------------------------------------------------------------------

const BUSH_VERT = /* glsl */ `
attribute vec3 aTint;
varying vec3 vWp;
varying vec3 vCol;
varying vec3 vN;
varying vec2 vCenter;
${HERO_CHART}
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vCol = aTint;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vCenter = heroChart((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BUSH_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uMoon;
varying vec3 vWp;
varying vec3 vCol;
varying vec3 vN;
varying vec2 vCenter;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${HERO_CHART}
${strokeFn('strokeVar', 'var')}
void main() {
  vec3 n = normalize(vN);
  float lit = 0.62 + 0.5 * max(dot(n, uMoon), 0.0) + 0.22 * n.y;
  vec3 col = vCol * lit;
  // Dabs curl around the crown of each tree.
  vec2 rel = heroChart(vWp) - vCenter;
  vec2 dir = normalize(vec2(-rel.y, rel.x) + vec2(0.012, 0.004));
  if (dir.x < 0.0) dir = -dir;
  gAccent = vec3(0.50, 0.66, 0.42);
  vec4 jitA = vec4(0.3, 0.1, 0.12, 0.3);
  vec4 jitB = vec4(0.34, 0.12, 0.14, 0.35);
  ${CHART_STROKES}
}
`;

function buildBushGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const lump = 0.72 + 0.5 * noise3(v.x * 1.7 + 4, v.y * 1.7, v.z * 1.7) + 0.16 * noise3(v.x * 4.5, v.y * 4.5 + 2, v.z * 4.5);
    v.multiplyScalar(lump);
    v.y = v.y * 0.85 + 0.55;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const BUSH_TINTS: RGB[] = [hex(0x163626), hex(0x1f4a30), hex(0x12302e), hex(0x2c5a34), hex(0x1a3a4a), hex(0x3b5a2a), hex(0x0f2622)];

function buildBushes(plots: Plot[]): THREE.InstancedMesh {
  const rand = mulberry32(77);
  const items: Array<{ x: number; z: number; s: number; tall: number; tint: RGB }> = [];
  const tint = (): RGB => {
    const c = BUSH_TINTS[Math.floor(rand() * BUSH_TINTS.length)];
    return mix3(c, [0, 0, 0], rand() * 0.2);
  };
  // Trees between the houses.
  let tries = 0;
  while (items.length < 120 && tries < 5000) {
    tries++;
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand());
    const x = 20 + Math.cos(a) * rr * 76, z = -6 + Math.sin(a) * rr * 44;
    const s = 1.2 + rand() * 1.5;
    if (plots.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + s * 0.6)) continue;
    items.push({ x, z, s, tall: 0.9 + rand() * 0.6, tint: tint() });
  }
  // Olive rows across the fields.
  for (let row = 0; row < 7; row++) {
    const z = 30 + row * 6.5 + rand() * 3;
    const x0 = -95 + rand() * 40, n = 9 + Math.floor(rand() * 9);
    for (let i = 0; i < n; i++) {
      items.push({ x: x0 + i * (5.5 + rand() * 2) + row * 9, z: z + (rand() - 0.5) * 3 - i * 0.6, s: 1.6 + rand() * 1.2, tall: 0.8 + rand() * 0.4, tint: tint() });
    }
  }
  // Scrub on the painter's hillside.
  for (let i = 0; i < 90; i++) {
    const x = -60 + rand() * 130, z = 78 + rand() * 62;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 9) continue;
    if (Math.abs(x) < 5 && z > 100) continue;
    items.push({ x, z, s: 1.2 + rand() * 2.4, tall: 0.7 + rand() * 0.5, tint: mix3(tint(), [0, 0, 0], 0.3) });
  }
  const mesh = new THREE.InstancedMesh(
    buildBushGeometry(),
    new THREE.ShaderMaterial({
      vertexShader: BUSH_VERT,
      fragmentShader: BUSH_FRAG,
      uniforms: { uTime: { value: 0 }, uHero: { value: HERO }, uMoon: { value: MOON_DIR }, uPixRef: { value: 0.001 } },
    }),
    items.length,
  );
  const tints = new Float32Array(items.length * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  items.forEach((it, i) => {
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, rand() * 6.28, (rand() - 0.5) * 0.3));
    m.compose(new THREE.Vector3(it.x, terrainHeight(it.x, it.z) - it.s * 0.25, it.z), q, new THREE.Vector3(it.s, it.s * it.tall, it.s));
    mesh.setMatrixAt(i, m);
    tints.set(it.tint, i * 3);
  });
  mesh.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Cypress
// ---------------------------------------------------------------------------

const CYPRESS_COLORS: RGB[] = [hex(0x0c1712), hex(0x14291b), hex(0x241d10), hex(0x263717), hex(0x0a1220), hex(0x1a3220), hex(0x33250f), hex(0x0f1f18)];

/** One flame tongue: a tapered, lobed, swaying tube. */
function addTongue(
  out: { pos: number[]; col: number[]; chart: number[]; wrap: number[]; idx: number[] },
  rand: () => number, bx: number, bz: number, baseY: number, height: number, radius: number, lean: number, tongueId: number,
): void {
  const SEG = 30, RAD = 11, DENSITY = 2.3;
  const start = out.pos.length / 3;
  const ph1 = rand() * 6.28, ph2 = rand() * 6.28, w1 = 6 + rand() * 5, amp = 0.1 + rand() * 0.14;
  const leanA = rand() * 6.28;
  const colA = CYPRESS_COLORS[Math.floor(rand() * CYPRESS_COLORS.length)];
  const colB = CYPRESS_COLORS[Math.floor(rand() * CYPRESS_COLORS.length)];
  const twist = (rand() - 0.5) * 5;
  const cells = Math.max(6, Math.round(Math.PI * 2 * radius * 0.7 * DENSITY));
  const spine = (t: number): THREE.Vector3 => {
    const sway = amp * Math.pow(t, 0.8);
    return new THREE.Vector3(
      bx * (1 - 0.45 * t) + Math.sin(t * w1 + ph1) * sway * radius * 2.2 + Math.cos(leanA) * lean * 2 * t * t * t,
      baseY + t * height,
      bz * (1 - 0.45 * t) + Math.cos(t * w1 * 0.9 + ph2) * sway * radius * 2.2 + Math.sin(leanA) * lean * 2 * t * t * t,
    );
  };
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const c = spine(t);
    const tan = spine(Math.min(t + 0.01, 1)).sub(spine(Math.max(t - 0.01, 0))).normalize();
    const nx = new THREE.Vector3(1, 0, 0).addScaledVector(tan, -tan.x).normalize();
    const nz = new THREE.Vector3().crossVectors(tan, nx);
    const r = radius * Math.pow(1 - t, 0.7) * (0.45 + 0.55 * smoothstep(-0.1, 0.28, t)) * (1 + 0.2 * Math.sin(t * 8 + ph1) + 0.1 * Math.sin(t * 19 + ph2));
    const shade = mix3(colA, colB, 0.5 + 0.5 * Math.sin(t * 5 + ph2));
    for (let j = 0; j <= RAD; j++) {
      const a = (j / RAD) * Math.PI * 2;
      const lobe = 1 + 0.2 * Math.cos(a * 3 + twist * t * 6.28) + 0.08 * Math.cos(a * 5 - t * 11);
      const p = c.clone().addScaledVector(nx, Math.cos(a) * r * lobe).addScaledVector(nz, Math.sin(a) * r * lobe);
      out.pos.push(p.x, p.y, p.z);
      out.col.push(shade[0], shade[1], shade[2]);
      out.chart.push((j / RAD) * cells, t * height * DENSITY + tongueId * 41.7);
      out.wrap.push(cells);
    }
  }
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = start + i * (RAD + 1) + j, b = a + 1, c = a + RAD + 1, d = c + 1;
      out.idx.push(a, b, c, b, d, c);
    }
  }
}

function buildCypress(): THREE.BufferGeometry {
  const rand = mulberry32(1853);
  const out = { pos: [] as number[], col: [] as number[], chart: [] as number[], wrap: [] as number[], idx: [] as number[] };
  let id = 0;
  // Main tree: one dominant tongue and a ring of shorter ones around it.
  // One dense flame: a fat core, a ring of tall tongues, a skirt of short ones.
  addTongue(out, rand, 0, 0, -1, 21.6, 2.2, 0.25, id++);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
    const d = 0.8 + rand() * 0.5;
    addTongue(out, rand, Math.cos(a) * d, Math.sin(a) * d, -1, 13.5 + rand() * 6, 1.2 + rand() * 0.45, 0.3 + rand() * 0.5, id++);
  }
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + rand() * 0.4;
    const d = 1.4 + rand() * 0.9;
    addTongue(out, rand, Math.cos(a) * d, Math.sin(a) * d, -1, 6 + rand() * 7.5, 0.65 + rand() * 0.4, 0.3 + rand() * 0.6, id++);
  }
  // The small companion tree at its foot.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const d = i === 0 ? 0 : 0.4 + rand() * 0.3;
    addTongue(out, rand, 3.3 + Math.cos(a) * d, 0.6 + Math.sin(a) * d, -1.2, i === 0 ? 8.6 : 4 + rand() * 3.4, 0.5 + rand() * 0.28, rand() * 0.5, id++);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  g.setAttribute('aChart', new THREE.Float32BufferAttribute(out.chart, 2));
  g.setAttribute('aWrap', new THREE.Float32BufferAttribute(out.wrap, 1));
  g.setIndex(out.idx);
  g.computeVertexNormals();
  return g;
}

const CYPRESS_VERT = /* glsl */ `
attribute vec3 color;
attribute vec2 aChart;
attribute float aWrap;
varying vec3 vCol;
varying vec3 vN;
varying vec2 vChart;
varying float vWrap;
void main() {
  vCol = color;
  vN = normalize(mat3(modelMatrix) * normal);
  vChart = aChart;
  vWrap = aWrap;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CYPRESS_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uMoon;
varying vec3 vCol;
varying vec3 vN;
varying vec2 vChart;
varying float vWrap;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${strokeFn('strokeVar', 'var')}
void main() {
  vec3 n = normalize(vN);
  float lit = 0.8 + 0.55 * max(dot(n, uMoon), 0.0);
  vec3 col = vCol * lit;
  // Flame strokes: they climb and sway.
  vec2 dir = normalize(vec2(0.42 * sin(vChart.y * 0.33 + vChart.x * 0.5), 1.0));
  gFlow = vec4(dir * 0.5 + 0.5, 0.6, 0.5);
  gColor = col;
  gAccent = vec3(0.42, 0.44, 0.16);
  float px = length(fwidth(vChart)) * 0.7;
  vec4 acc = vec4(col * 0.6, 0.08);
  acc = strokeVar(vChart, vec2(1.0), vWrap, px, 5.0, vec4(0.8, 0.26, 0.96, 0.03), vec4(0.34, 0.1, 0.14, 0.3), uTime, acc);
  acc = strokeVar(vChart * 1.7 + 3.1, vec2(1.0), vWrap * 1.7, px * 1.7, 29.0, vec4(0.8, 0.22, 0.6, 0.04), vec4(0.4, 0.14, 0.12, 0.35), uTime, acc);
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// Post: impasto relief, Prussian-blue contour lines, canvas, varnish.
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
  vec3 col = c.rgb * (1.0 + diff * 0.95);
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 46.0);
  col += spec * 0.16 * c.a * vec3(1.0, 0.97, 0.9);

  // Cloisonnist contour: a dark line where the depth breaks.
  float wob = 0.7 + 0.9 * vnoise(cv * 0.045);
  float edge = smoothstep(0.012, 0.05, depthEdge(vUv, px * 1.5 * wob));
  col = mix(col, vec3(0.045, 0.07, 0.19), edge * 0.86);

  col *= 0.93 + 0.11 * weave;
  col *= vignette(vUv, 0.42);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createStarryNight(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 2400;
  const time = { value: 0 };

  const skyTex = bakeSky();
  const moonSky = paintingToSky(0.41, 0.865);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { tFlow: { value: skyTex.flow }, tColor: { value: skyTex.color }, tAux: { value: skyTex.aux }, uTime: time, uPixAngle: { value: 0.001 }, uMoon: { value: new THREE.Vector3(moonSky.az, moonSky.el, 1.5 * DEG) } },
    side: THREE.BackSide,
    depthWrite: true,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(far * 0.9, 48, 24), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  const pixRef = { value: 0.001 };
  const shared = { uTime: time, uHero: { value: HERO }, uMoon: { value: MOON_DIR }, uPixRef: pixRef };
  const terrain = new THREE.Mesh(buildTerrain(), new THREE.ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: shared }));
  terrain.frustumCulled = false;
  scene.add(terrain);

  const village = buildVillage();
  const villageMesh = new THREE.Mesh(village.geometry, new THREE.ShaderMaterial({ vertexShader: VILLAGE_VERT, fragmentShader: VILLAGE_FRAG, uniforms: shared }));
  villageMesh.frustumCulled = false;
  scene.add(villageMesh);

  const bushes = buildBushes(village.plots);
  (bushes.material as THREE.ShaderMaterial).uniforms.uTime = time;
  (bushes.material as THREE.ShaderMaterial).uniforms.uPixRef = pixRef;
  scene.add(bushes);

  const cypress = new THREE.Mesh(buildCypress(), new THREE.ShaderMaterial({ vertexShader: CYPRESS_VERT, fragmentShader: CYPRESS_FRAG, uniforms: shared }));
  const cx = -6.4, cz = 113.5;
  cypress.position.set(cx, terrainHeight(cx, cz), cz);
  cypress.frustumCulled = false;
  scene.add(cypress);

  const heroTarget: [number, number, number] = [0, 20 + 100 * Math.tan(8.2 * DEG), 35];

  return {
    scene,
    meta: {
      title: 'The Starry Night',
      artist: 'Vincent van Gogh · 1889',
      technique: 'Baked flow + colour fields, 3 layers of animated oriented brush dabs, impasto relief lighting, depth-edge contour lines.',
    },
    presets: [
      { name: 'The Painting', position: [HERO.x, HERO.y, HERO.z], target: heroTarget, fov: 44 },
      { name: 'Under the Cypress', position: [2.5, 17.2, 127], target: [-9, 27, 100], fov: 58 },
      { name: 'Village Lane', position: [34, 4.2, 30], target: [6, 13, -14], fov: 50 },
      { name: 'Above the Valley', position: [-70, 78, 150], target: [18, 12, -40], fov: 42 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.3,
    far,
    flySpeed: 22,
    maxDistance: 420,
    floorAt: (x, z) => terrainHeight(x, z) + 1.2,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      skyMat.uniforms.uPixAngle.value = (2 * Math.tan((ctx.camera.fov * DEG) / 2)) / ctx.height;
      pixRef.value = 0.78 / ctx.height;
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
      skyTex.aux.dispose();
    },
  };
}
