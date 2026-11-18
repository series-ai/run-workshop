// Café Terrace at Night — Vincent van Gogh, 1888.
//
// The street corner is built as one mesh: the café and its awning, the
// terrace with tables and chairs, the shuttered houses, the people, the tree.
// Every vertex carries two pigments, a night colour and a lamplight colour.
// The fragment shader mixes them by how much gaslight reaches the surface
// (two lamps under the awning, the awning's own shadow), then lays oriented
// brush dabs over a chart in metres. The pavement is a separate sheet of
// fan-laid cobbles that take the same light. The sky is a baked dome of
// ultramarine with ringed stars. The post pass adds impasto relief and
// Prussian-blue contour lines.

import * as THREE from 'three';
import { GLSL_NOISE, strokeFn } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, hex, mix, mix3, mulberry32, noise3, smoothstep, type RGB } from '../util';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Layout, metres. The street runs along -z; the café is on the left (x < 0).
// ---------------------------------------------------------------------------

const CAFE = { wallX: -6, backX: -15, z0: -20, z1: 4.5, groundTop: 4.5, top: 11.6 };
const AWNING = { wallY: 4.45, edgeX: -1.5, edgeY: 3.55, z0: -19.6, z1: 3.6 };
const TERRACE = { x1: -1.3, z0: -20, z1: 4, top: 0.14 };
const LAMPS: Array<[number, number, number]> = [[-2.75, 3.22, 0.4], [-2.9, 3.3, -8.6], [-2.9, 3.34, -16.4]];
const HERO = { position: [1.4, 1.62, 10.5] as [number, number, number], target: [-0.6, 3.5, -10] as [number, number, number], fov: 50 };

/** Shared by the town and the pavement: how much gaslight reaches a point. */
const CAFE_LIGHT = /* glsl */ `
uniform vec3 uLamps[3];
uniform float uTime;
float warmLight(vec3 p, vec3 n) {
  float sum = 0.0;
  for (int i = 0; i < 3; i++) {
    vec3 d = uLamps[i] - p;
    float dist = length(d);
    float facing = dot(n, d / dist);
    // The canvas of the awning glows all over: it is lit from below at every angle.
    float wrap = n.y < -0.5 ? 1.0 : smoothstep(-0.35, 0.75, facing);
    // The awning throws its shadow on everything above the line from the lamp
    // past its edge. Its own underside is always lit.
    float side = p.x - uLamps[i].x;
    float limit = uLamps[i].y + (side > 0.0 ? 0.16 : 0.34) * abs(side);
    float shadow = n.y < -0.5 ? 1.0 : 1.0 - smoothstep(limit - 0.2, limit + 0.35, p.y);
    float flick = 0.94 + 0.06 * sin(uTime * (2.3 + float(i) * 0.9) + float(i) * 2.1);
    sum += flick * wrap * shadow * 1.05 / (1.0 + dist * dist / 42.0);
  }
  return clamp(sum, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

const EL0 = -0.1;
const EL1 = Math.PI / 2;

const SKY = {
  night: hex(0x0b1244),
  deep: hex(0x152670),
  cobalt: hex(0x24449c),
  cerulean: hex(0x3d6cb8),
  light: hex(0x86aad6),
  pale: hex(0xc9dbe2),
  white: hex(0xf2f1dc),
  yellow: hex(0xf7e282),
};
const RING: RGB[] = [SKY.white, SKY.yellow, SKY.pale, SKY.light, SKY.cerulean, SKY.cobalt];

interface Star { az: number; el: number; r: number }

function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

function buildStars(): Star[] {
  const stars: Star[] = [];
  // The stars of the painting: the wedge of sky between the roofs.
  const hero: Array<[number, number, number]> = [
    [-6, 27, 1.0], [-1.5, 21.5, 0.8], [3.5, 26, 1.15], [8, 20.5, 0.7], [1, 15.5, 0.85], [-3.5, 13, 0.55],
    [6, 13.5, 0.95], [10.5, 26.5, 0.6], [4.5, 9.5, 0.6], [-9, 20, 0.6], [13, 16, 0.75], [0.5, 31, 0.7],
  ];
  const heroAz = Math.atan2(HERO.target[0] - HERO.position[0], -(HERO.target[2] - HERO.position[2]));
  for (const [az, el, r] of hero) stars.push({ az: heroAz + az * DEG, el: el * DEG, r: r * DEG });
  const rand = mulberry32(1888);
  for (let i = 0; i < 110; i++) {
    const az = (rand() * 2 - 1) * Math.PI;
    const el = (3.5 + rand() * 80) * DEG;
    if (Math.abs(wrapAngle(az - heroAz)) < 20 * DEG && el < 36 * DEG) continue;
    stars.push({ az, el, r: (0.45 + rand() * 0.75) * DEG });
  }
  return stars;
}

function bakeSky(): { flow: THREE.DataTexture; color: THREE.DataTexture; aux: THREE.DataTexture } {
  const W = 1024;
  const H = 256;
  const stars = buildStars();
  const flow = new Uint8Array(W * H * 4);
  const color = new Uint8Array(W * H * 4);
  const aux = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const el = EL0 + ((y + 0.5) / H) * (EL1 - EL0);
    const elDeg = el / DEG;
    const cosEl = Math.max(Math.cos(el), 0.2);
    // Only the stars whose halo reaches this row of the map.
    const near = stars.filter((s) => Math.abs(el - s.el) < 4.4 * s.r);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const az = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const cx = Math.cos(az), sx = Math.sin(az);
      const n1 = noise3(cx * 2.3 + 5, el * 3.4, sx * 2.3);
      const n2 = noise3(cx * 9 + 1, el * 12, sx * 9);
      // Ultramarine: lighter over the roofs, near black overhead.
      let c = mix3(SKY.cobalt, SKY.deep, smoothstep(6, 30, elDeg));
      c = mix3(c, SKY.night, smoothstep(30, 80, elDeg));
      c = mix3(c, n1 > 0.5 ? SKY.cerulean : SKY.night, Math.abs(n1 - 0.5) * 0.9);
      c = mix3(c, SKY.cobalt, smoothstep(0.55, 0.85, n2) * 0.45);

      let fx = 1;
      let fy = (n1 - 0.5) * 1.6 + 0.25 * Math.sin(az * 6 + el * 4);
      let sz = 0.52;
      let energy = 0.2;
      let pulseW = 0;
      let phase = 0;
      for (const s of near) {
        const dx = wrapAngle(az - s.az) * cosEl;
        const dy = el - s.el;
        const k = Math.hypot(dx, dy) / s.r;
        if (k > 4.4) continue;
        // Strokes turn round each star.
        const w = Math.exp(-(k * k) / 5.5);
        const r = k * s.r + 1e-5;
        fx += w * 9 * (-dy / r);
        fy += w * 9 * (dx / r);
        sz -= w * 0.85;
        energy += w * 0.5;
        if (k < 0.55) {
          c = mix3(SKY.white, SKY.yellow, smoothstep(0.2, 0.55, k) * 0.7);
        } else {
          const ring = Math.min(Math.floor((k - 0.55) / 0.55) + 1, RING.length - 1);
          c = mix3(c, RING[ring], (1 - smoothstep(1.3, 3.6, k)) * 0.86);
        }
        const pw = 1 - smoothstep(0.4, 3.6, k);
        if (pw > pulseW) {
          pulseW = pw;
          phase = k / 4.4;
        }
      }
      const len = Math.hypot(fx, fy) + 1e-6;
      color[i * 4] = clamp(c[0], 0, 1) * 255;
      color[i * 4 + 1] = clamp(c[1], 0, 1) * 255;
      color[i * 4 + 2] = clamp(c[2], 0, 1) * 255;
      color[i * 4 + 3] = 255;
      flow[i * 4] = ((fx / len) * 0.5 + 0.5) * 255;
      flow[i * 4 + 1] = ((fy / len) * 0.5 + 0.5) * 255;
      flow[i * 4 + 2] = clamp(sz, 0, 1) * 255;
      flow[i * 4 + 3] = clamp(energy, 0, 1) * 255;
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
varying vec3 vDir;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${strokeFn('strokeSky', 'tex')}
const float EL0 = -0.1;
const float EL1 = 1.5707963;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(az / K_TAU + 0.5, (el - EL0) / (EL1 - EL0));
  vec3 base = textureLod(tColor, uv, 0.0).rgb;
  vec4 aux = textureLod(tAux, uv, 0.0);
  vec2 ang = vec2(az + K_PI, el - EL0);
  gAccent = vec3(0.42, 0.6, 0.86);
  vec4 acc = vec4(base * 0.72, 0.06);
  const float N1 = 230.0; const float N2 = 360.0; const float N3 = 540.0;
  float D1 = N1 / K_TAU; float D2 = N2 / K_TAU; float D3 = N3 / K_TAU;
  float span = EL1 - EL0;
  acc = strokeSky(ang * D1, vec2(1.0 / N1, 1.0 / (D1 * span)), N1, uPixAngle * D1, 29.0, vec4(0.80, 0.30, 0.97, 0.05), vec4(0.14, 0.05, 0.08, 0.1), uTime, acc);
  acc = strokeSky(ang * D2 + vec2(0.0, 0.37), vec2(1.0 / N2, 1.0 / (D2 * span)), N2, uPixAngle * D2, 83.0, vec4(0.80, 0.26, 0.86, 0.06), vec4(0.17, 0.06, 0.1, 0.12), uTime, acc);
  acc = strokeSky(ang * D3 + vec2(0.0, 0.71), vec2(1.0 / N3, 1.0 / (D3 * span)), N3, uPixAngle * D3, 167.0, vec4(0.78, 0.24, 0.5, 0.08), vec4(0.2, 0.1, 0.06, 0.14), uTime, acc);
  // Each star breathes: a ring of light travels out through its halo.
  float pulse = aux.g * (0.5 + 0.5 * sin(aux.r * 30.0 - uTime * 1.6));
  acc.rgb += pulse * vec3(0.1, 0.1, 0.06);
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// Town mesh builder
// ---------------------------------------------------------------------------

type Pt = [number, number, number];

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Surface kinds: how the fragment shader paints a face. */
const KIND = { wall: 0, flat: 1, window: 2, foliage: 3, glow: 4 };

class TownBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly night: number[] = [];
  private readonly warm: number[] = [];
  private readonly kind: number[] = [];
  private readonly uv: number[] = [];
  private readonly m = new THREE.Matrix4();

  setTransform(m: THREE.Matrix4): void {
    this.m.copy(m);
  }

  resetTransform(): void {
    this.m.identity();
  }

  /** A convex polygon, counter-clockwise seen from outside. The chart is in metres. */
  poly(points: Pt[], night: RGB, warm: RGB, kind = KIND.wall): void {
    const ps = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(this.m));
    const n = new THREE.Vector3().subVectors(ps[1], ps[0]).cross(new THREE.Vector3().subVectors(ps[2], ps[0])).normalize();
    const flat = Math.abs(n.y) > 0.82;
    const u = flat ? AXIS_X : new THREE.Vector3().crossVectors(AXIS_Y, n).normalize();
    const v = flat ? AXIS_Z : new THREE.Vector3().crossVectors(n, u);
    for (let i = 1; i < ps.length - 1; i++) {
      for (const p of [ps[0], ps[i], ps[i + 1]]) {
        this.pos.push(p.x, p.y, p.z);
        this.nor.push(n.x, n.y, n.z);
        this.night.push(night[0], night[1], night[2]);
        this.warm.push(warm[0], warm[1], warm[2]);
        this.kind.push(kind);
        this.uv.push(p.dot(u), p.dot(v));
      }
    }
  }

  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, night: RGB, warm: RGB, side = KIND.wall, top = KIND.flat): void {
    this.poly([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], night, warm, side);
    this.poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], night, warm, side);
    this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], night, warm, side);
    this.poly([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], night, warm, side);
    this.poly([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], night, warm, top);
    this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], night, warm, top);
  }

  /** A tapered prism from a to b. */
  prism(a: Pt, b: Pt, r0: number, r1: number, sides: number, night: RGB, warm: RGB, kind = KIND.wall): void {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(vb, va).normalize();
    const ref = Math.abs(dir.y) > 0.95 ? AXIS_X : AXIS_Y;
    const u = new THREE.Vector3().crossVectors(ref, dir).normalize();
    const w = new THREE.Vector3().crossVectors(dir, u);
    const ring = (c: THREE.Vector3, r: number): Pt[] => {
      const out: Pt[] = [];
      for (let j = 0; j < sides; j++) {
        const ang = ((j + 0.5) / sides) * Math.PI * 2;
        const p = c.clone().addScaledVector(u, Math.cos(ang) * r).addScaledVector(w, Math.sin(ang) * r);
        out.push([p.x, p.y, p.z]);
      }
      return out;
    };
    const ra = ring(va, r0), rb = ring(vb, r1);
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides;
      this.poly([ra[j], ra[k], rb[k], rb[j]], night, warm, kind);
    }
    this.poly(rb, night, warm, kind);
    this.poly([...ra].reverse(), night, warm, kind);
  }

  /** Triangles of a ready geometry, placed by a matrix. */
  solid(geo: THREE.BufferGeometry, place: THREE.Matrix4, night: RGB, warm: RGB, kind: number): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute('position');
    const saved = this.m.clone();
    this.m.multiply(place);
    for (let i = 0; i < p.count; i += 3) {
      this.poly([[p.getX(i), p.getY(i), p.getZ(i)], [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)]], night, warm, kind);
    }
    this.m.copy(saved);
    if (g !== geo) g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.night, 3));
    g.setAttribute('aWarm', new THREE.Float32BufferAttribute(this.warm, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.kind, 1));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

// ---------------------------------------------------------------------------
// Pigments: [night, lamplight]
// ---------------------------------------------------------------------------

type Pair = [RGB, RGB];

const PAINT = {
  cafeWall: [hex(0x7c8440), hex(0xf6d23c)] as Pair,
  cafeTrim: [hex(0x24545a), hex(0x4f9a86)] as Pair,
  awningUnder: [hex(0x8a8436), hex(0xf4c02c)] as Pair,
  // The canvas glows: lamplight comes through it.
  awningTop: [hex(0xa3943a), hex(0xd9b93a)] as Pair,
  valance: [hex(0xd9a72c), hex(0xf3c232)] as Pair,
  terrace: [hex(0x54406a), hex(0xf09a36)] as Pair,
  terraceEdge: [hex(0x2c2650), hex(0xb86a30)] as Pair,
  upper: [hex(0x263a8c), hex(0x6a72a4)] as Pair,
  shutter: [hex(0x1d4a4c), hex(0x4f8c6c)] as Pair,
  glass: [hex(0x0d1338), hex(0x40406a)] as Pair,
  sill: [hex(0x4a5aa0), hex(0xa8a090)] as Pair,
  roof: [hex(0x10183f), hex(0x302c50)] as Pair,
  iron: [hex(0x10142e), hex(0x5a4a2c)] as Pair,
  tableTop: [hex(0x9fb2cc), hex(0xf6f1d2)] as Pair,
  chairWood: [hex(0x3c2a22), hex(0xc8822c)] as Pair,
  chairSeat: [hex(0x6a6a40), hex(0xe6c860)] as Pair,
  apron: [hex(0xaab6ca), hex(0xf7f1de)] as Pair,
  coat: [hex(0x14163a), hex(0x4a3828)] as Pair,
  rust: [hex(0x5e2630), hex(0xc4542c)] as Pair,
  green: [hex(0x1c4638), hex(0x5e8a44)] as Pair,
  skin: [hex(0x8a6e78), hex(0xf0c48c)] as Pair,
  leaf: [hex(0x123a2c), hex(0x5a9038)] as Pair,
  leafLight: [hex(0x1f5a3a), hex(0x8ab844)] as Pair,
  bark: [hex(0x1a1630), hex(0x5a4028)] as Pair,
};
const HOUSE_WALLS: Pair[] = [
  [hex(0x1b2a6e), hex(0x5a4a72)], [hex(0x243680), hex(0x66557c)], [hex(0x221c56), hex(0x4c3a66)],
  [hex(0x172152), hex(0x45386a)], [hex(0x2c4290), hex(0x6c6490)], [hex(0x2c2a6e), hex(0x5c4878)],
];
const WINDOW_LIT: RGB[] = [hex(0xf6b83c), hex(0xf08c2c), hex(0xfbd65c), hex(0xf2a244)];
const LAMP_GLOW = hex(0xfff3ac);

// ---------------------------------------------------------------------------
// Houses
// ---------------------------------------------------------------------------

interface FacadeStyle {
  wall: Pair;
  /** Height of the ground floor. */
  ground: number;
  /** Chance that an upper window is lit. */
  lit: number;
  /** A lit shop front across the ground floor. */
  shop?: boolean;
  /** Skip the wall face below this height (the café paints its own front). */
  wallFrom?: number;
}

/**
 * One street face of a house: the wall, rows of shuttered windows, and doors.
 * origin is the lower left corner seen from the street; right runs along the wall.
 */
function addFacade(b: TownBuilder, rand: () => number, origin: THREE.Vector3, normal: THREE.Vector3, width: number, height: number, style: FacadeStyle): void {
  const right = new THREE.Vector3().crossVectors(AXIS_Y, normal).normalize();
  const at = (u: number, v: number, out = 0): Pt => {
    const p = origin.clone().addScaledVector(right, u).addScaledVector(AXIS_Y, v).addScaledVector(normal, out);
    return [p.x, p.y, p.z];
  };
  const rect = (u0: number, u1: number, v0: number, v1: number, out: number, pair: Pair, kind = KIND.wall): void => {
    b.poly([at(u0, v0, out), at(u1, v0, out), at(u1, v1, out), at(u0, v1, out)], pair[0], pair[1], kind);
  };
  const from = style.wallFrom ?? 0;
  rect(0, width, from, height, 0, style.wall);
  // Cornice.
  rect(-0.15, width + 0.15, height - 0.35, height, 0.22, [mix3(style.wall[0], [1, 1, 1], 0.1), style.wall[1]]);
  b.poly([at(-0.15, height, 0.22), at(width + 0.15, height, 0.22), at(width + 0.15, height, 0), at(-0.15, height, 0)], style.wall[0], style.wall[1], KIND.flat);

  const columns = Math.max(1, Math.floor(width / 2.7));
  const pitch = width / columns;
  const floors = Math.max(1, Math.floor((height - style.ground - 0.6) / 2.9));
  const floorH = (height - style.ground - 0.5) / floors;
  for (let f = 0; f < floors; f++) {
    const v0 = style.ground + f * floorH + 0.75;
    const v1 = v0 + Math.min(1.75, floorH - 1.1);
    for (let c = 0; c < columns; c++) {
      const uc = (c + 0.5) * pitch + (rand() - 0.5) * 0.15;
      const hw = 0.5 + rand() * 0.08;
      const lit = rand() < style.lit;
      if (lit) {
        const glow = WINDOW_LIT[Math.floor(rand() * WINDOW_LIT.length)];
        rect(uc - hw, uc + hw, v0, v1, 0.03, [glow, glow], KIND.window);
      } else {
        rect(uc - hw, uc + hw, v0, v1, 0.03, PAINT.glass);
      }
      // Shutters: folded back flat on the wall, or half closed over a dark window.
      const open = lit || rand() < 0.6;
      const sw = hw * 0.92;
      if (open) {
        rect(uc - hw - sw, uc - hw - 0.03, v0 - 0.04, v1 + 0.04, 0.07, PAINT.shutter);
        rect(uc + hw + 0.03, uc + hw + sw, v0 - 0.04, v1 + 0.04, 0.07, PAINT.shutter);
      } else {
        rect(uc - hw, uc - 0.02, v0 - 0.04, v1 + 0.04, 0.08, PAINT.shutter);
        rect(uc + 0.02, uc + hw, v0 - 0.04, v1 + 0.04, 0.08, PAINT.shutter);
      }
      rect(uc - hw - 0.08, uc + hw + 0.08, v0 - 0.16, v0 - 0.04, 0.12, PAINT.sill);
    }
  }
  if (from > 0) return;
  // Ground floor: a lit shop front, or doors and dark windows.
  if (style.shop) {
    const u0 = width * 0.12, u1 = width * 0.88;
    rect(u0 - 0.2, u1 + 0.2, 0.25, style.ground - 0.5, 0.05, PAINT.cafeTrim);
    const bays = Math.max(2, Math.round((u1 - u0) / 2.4));
    for (let k = 0; k < bays; k++) {
      const a = mix(u0, u1, k / bays) + 0.12, c = mix(u0, u1, (k + 1) / bays) - 0.12;
      const glow = WINDOW_LIT[k % WINDOW_LIT.length];
      rect(a, c, 0.5, style.ground - 0.75, 0.09, [glow, glow], KIND.window);
    }
  } else {
    for (let c = 0; c < columns; c++) {
      const uc = (c + 0.5) * pitch;
      if (rand() < 0.4) {
        rect(uc - 0.55, uc + 0.55, 0, Math.min(2.5, style.ground - 0.6), 0.05, PAINT.cafeTrim);
        rect(uc - 0.42, uc + 0.42, 0.1, Math.min(2.35, style.ground - 0.75), 0.09, PAINT.glass);
      } else if (rand() < 0.7) {
        rect(uc - 0.55, uc + 0.55, 1.0, Math.min(2.6, style.ground - 0.5), 0.04, PAINT.glass);
        rect(uc - 0.55, uc - 0.02, 0.96, Math.min(2.64, style.ground - 0.46), 0.08, PAINT.shutter);
        rect(uc + 0.02, uc + 0.55, 0.96, Math.min(2.64, style.ground - 0.46), 0.08, PAINT.shutter);
      }
    }
  }
}

/** A gable roof over a footprint. The ridge runs along the long side. */
function addRoof(b: TownBuilder, x0: number, x1: number, z0: number, z1: number, y: number, rise: number): void {
  const o = 0.35;
  const [night, warm] = PAINT.roof;
  const dark = mix3(night, [0, 0, 0], 0.25);
  if (z1 - z0 >= x1 - x0) {
    const xm = (x0 + x1) / 2;
    b.poly([[x1 + o, y, z1 + o], [x1 + o, y, z0 - o], [xm, y + rise, z0 - o], [xm, y + rise, z1 + o]], night, warm, KIND.flat);
    b.poly([[x0 - o, y, z0 - o], [x0 - o, y, z1 + o], [xm, y + rise, z1 + o], [xm, y + rise, z0 - o]], dark, warm, KIND.flat);
    b.poly([[x0, y, z1], [x1, y, z1], [xm, y + rise, z1]], dark, warm);
    b.poly([[x1, y, z0], [x0, y, z0], [xm, y + rise, z0]], dark, warm);
  } else {
    const zm = (z0 + z1) / 2;
    b.poly([[x0 - o, y, z1 + o], [x1 + o, y, z1 + o], [x1 + o, y + rise, zm], [x0 - o, y + rise, zm]], night, warm, KIND.flat);
    b.poly([[x1 + o, y, z0 - o], [x0 - o, y, z0 - o], [x0 - o, y + rise, zm], [x1 + o, y + rise, zm]], dark, warm, KIND.flat);
    b.poly([[x1, y, z1], [x1, y, z0], [x1, y + rise, zm]], dark, warm);
    b.poly([[x0, y, z0], [x0, y, z1], [x0, y + rise, zm]], dark, warm);
  }
}

interface House { x0: number; x1: number; z0: number; z1: number; height: number; wall: number; lit: number; shopEast?: boolean; shopWest?: boolean; shopSouth?: boolean }

function addHouse(b: TownBuilder, rand: () => number, h: House): void {
  const wall = HOUSE_WALLS[h.wall % HOUSE_WALLS.length];
  const ground = 3.6 + rand() * 0.5;
  const style = (shop: boolean | undefined): FacadeStyle => ({ wall, ground, lit: h.lit, shop });
  addFacade(b, rand, new THREE.Vector3(h.x1, 0, h.z1), AXIS_X, h.z1 - h.z0, h.height, style(h.shopEast));
  addFacade(b, rand, new THREE.Vector3(h.x0, 0, h.z0), AXIS_X.clone().negate(), h.z1 - h.z0, h.height, style(h.shopWest));
  addFacade(b, rand, new THREE.Vector3(h.x0, 0, h.z1), AXIS_Z, h.x1 - h.x0, h.height, style(h.shopSouth));
  addFacade(b, rand, new THREE.Vector3(h.x1, 0, h.z0), AXIS_Z.clone().negate(), h.x1 - h.x0, h.height, style(false));
  addRoof(b, h.x0, h.x1, h.z0, h.z1, h.height, 1.6 + rand() * 1.2);
}

// ---------------------------------------------------------------------------
// The café
// ---------------------------------------------------------------------------

function addCafe(b: TownBuilder, rand: () => number): void {
  const { wallX, backX, z0, z1, groundTop, top } = CAFE;
  const upper: FacadeStyle = { wall: PAINT.upper, ground: groundTop, lit: 0.22, wallFrom: groundTop };
  addFacade(b, rand, new THREE.Vector3(wallX, 0, z1), AXIS_X, z1 - z0, top, upper);
  addFacade(b, rand, new THREE.Vector3(backX, 0, z0), AXIS_X.clone().negate(), z1 - z0, top, { wall: PAINT.upper, ground: 3.8, lit: 0.1 });
  addFacade(b, rand, new THREE.Vector3(backX, 0, z1), AXIS_Z, wallX - backX, top, { wall: PAINT.upper, ground: 3.8, lit: 0.15 });
  addFacade(b, rand, new THREE.Vector3(wallX, 0, z0), AXIS_Z.clone().negate(), wallX - backX, top, { wall: PAINT.upper, ground: 3.8, lit: 0.1 });
  addRoof(b, backX, wallX, z0, z1, top, 2.3);

  // The lit front under the awning: yellow wall, tall glazed doors in green frames.
  const [wallN, wallW] = PAINT.cafeWall;
  b.poly([[wallX, 0, z1], [wallX, 0, z0], [wallX, groundTop, z0], [wallX, groundTop, z1]], wallN, wallW);
  for (const zc of [1.2, -4.6, -10.4, -16.2]) {
    const hw = 1.25;
    b.box(wallX, wallX + 0.08, 0.14, 3.5, zc - hw - 0.16, zc + hw + 0.16, PAINT.cafeTrim[0], PAINT.cafeTrim[1]);
    for (const s of [-1, 1]) {
      const a = zc + s * 0.08, c = zc + s * hw;
      const glow = WINDOW_LIT[Math.floor(rand() * WINDOW_LIT.length)];
      b.poly([[wallX + 0.1, 0.3, Math.max(a, c)], [wallX + 0.1, 0.3, Math.min(a, c)], [wallX + 0.1, 3.3, Math.min(a, c)], [wallX + 0.1, 3.3, Math.max(a, c)]], glow, glow, KIND.window);
    }
  }
  // Wainscot along the foot of the wall.
  b.box(wallX, wallX + 0.05, 0.14, 0.95, z0, z1, mix3(PAINT.cafeTrim[0], [0, 0, 0], 0.2), mix3(PAINT.cafeTrim[1], PAINT.cafeWall[1], 0.3));

  // Awning: a sheet from the wall down to its outer edge, with a hanging valance.
  const a = AWNING;
  b.poly([[wallX, a.wallY, a.z1], [a.edgeX, a.edgeY, a.z1], [a.edgeX, a.edgeY, a.z0], [wallX, a.wallY, a.z0]], PAINT.awningTop[0], PAINT.awningTop[1], KIND.flat);
  b.poly([[wallX, a.wallY - 0.05, a.z0], [a.edgeX, a.edgeY - 0.05, a.z0], [a.edgeX, a.edgeY - 0.05, a.z1], [wallX, a.wallY - 0.05, a.z1]], PAINT.awningUnder[0], PAINT.awningUnder[1], KIND.flat);
  b.box(a.edgeX - 0.03, a.edgeX + 0.03, a.edgeY - 0.38, a.edgeY, a.z0, a.z1, PAINT.valance[0], PAINT.valance[1]);
  for (const z of [a.z0, a.z1]) {
    const s = z === a.z1 ? 1 : -1;
    const pts: Pt[] = [[wallX, a.wallY - 0.4, z], [a.edgeX, a.edgeY - 0.38, z], [a.edgeX, a.edgeY, z], [wallX, a.wallY, z]];
    b.poly(s > 0 ? pts : [...pts].reverse(), PAINT.valance[0], PAINT.valance[1]);
  }
  for (const z of [a.z1 - 0.15, -4.4, -12.4, a.z0 + 0.15]) b.box(a.edgeX - 0.035, a.edgeX + 0.035, TERRACE.top, a.edgeY - 0.3, z - 0.035, z + 0.035, PAINT.iron[0], PAINT.iron[1]);

  // Terrace floor.
  b.box(wallX, TERRACE.x1, 0, TERRACE.top, TERRACE.z0, TERRACE.z1, PAINT.terraceEdge[0], PAINT.terraceEdge[1], KIND.wall, KIND.flat);
  b.poly([[wallX, TERRACE.top + 0.002, TERRACE.z1], [TERRACE.x1, TERRACE.top + 0.002, TERRACE.z1], [TERRACE.x1, TERRACE.top + 0.002, TERRACE.z0], [wallX, TERRACE.top + 0.002, TERRACE.z0]], PAINT.terrace[0], PAINT.terrace[1], KIND.flat);

  // Gas lamps: a glowing globe on a rod, under a small iron shade.
  const globe = new THREE.IcosahedronGeometry(1, 1);
  LAMPS.forEach(([x, y, z], i) => {
    // The first lamp is the great lamp of the painting.
    const size = i === 0 ? 1.45 : 1;
    const roofY = mix(a.wallY, a.edgeY, (x - wallX) / (a.edgeX - wallX)) - 0.05;
    b.box(x - 0.02, x + 0.02, y + 0.2, roofY, z - 0.02, z + 0.02, PAINT.iron[0], PAINT.iron[1]);
    b.prism([x, y + 0.2, z], [x, y + 0.34, z], 0.3, 0.06, 8, PAINT.iron[0], PAINT.iron[1]);
    b.solid(globe, new THREE.Matrix4().makeScale(0.21 * size, 0.24 * size, 0.21 * size).setPosition(x, y, z), LAMP_GLOW, LAMP_GLOW, KIND.glow);
  });
  globe.dispose();
}

// ---------------------------------------------------------------------------
// Furniture and people
// ---------------------------------------------------------------------------

function addTable(b: TownBuilder, x: number, z: number): void {
  const y = TERRACE.top;
  const [n, w] = PAINT.tableTop;
  b.prism([x, y + 0.71, z], [x, y + 0.75, z], 0.43, 0.43, 12, n, w, KIND.flat);
  b.prism([x, y + 0.02, z], [x, y + 0.71, z], 0.035, 0.03, 5, PAINT.iron[0], PAINT.iron[1]);
  for (let k = 0; k < 3; k++) {
    const ang = k * 2.094 + x * 3.1;
    b.prism([x, y + 0.05, z], [x + Math.cos(ang) * 0.3, y + 0.02, z + Math.sin(ang) * 0.3], 0.03, 0.022, 4, PAINT.iron[0], PAINT.iron[1]);
  }
}

/** A rush-seat café chair at (x, z), its back turned to the heading angle. */
function addChair(b: TownBuilder, x: number, z: number, heading: number): void {
  b.setTransform(new THREE.Matrix4().makeRotationY(heading).setPosition(x, TERRACE.top, z));
  const [wn, ww] = PAINT.chairWood;
  const t = 0.022;
  for (const sx of [-0.19, 0.19]) {
    b.box(sx - t, sx + t, 0, 0.46, 0.19 - t, 0.19 + t, wn, ww);
    b.box(sx - t, sx + t, 0, 0.94, -0.19 - t, -0.19 + t, wn, ww);
    b.box(sx - t, sx + t, 0.2, 0.24, -0.19, 0.19, wn, ww);
  }
  b.box(-0.22, 0.22, 0.44, 0.48, -0.21, 0.22, PAINT.chairSeat[0], PAINT.chairSeat[1], KIND.wall, KIND.flat);
  for (const y of [0.62, 0.82]) b.box(-0.19, 0.19, y, y + 0.07, -0.2, -0.18, wn, ww);
  b.box(-0.19, 0.19, 0.2, 0.235, 0.18, 0.2, wn, ww);
  b.resetTransform();
}

interface Person { x: number; z: number; ground: number; heading: number; lower: Pair; upper: Pair; seated?: boolean; skirt?: boolean; hat?: Pair; scale?: number }

function addPerson(b: TownBuilder, p: Person): void {
  const s = p.scale ?? 1;
  b.setTransform(new THREE.Matrix4().makeRotationY(p.heading).multiply(new THREE.Matrix4().makeScale(s, s, s)).setPosition(p.x, p.ground, p.z));
  const hip = p.seated ? 0.52 : 0.92;
  if (p.seated) {
    // Thighs forward on the chair, shins down.
    b.prism([0, hip, 0], [0, hip, 0.42], 0.15, 0.12, 6, p.lower[0], p.lower[1]);
    b.prism([0, hip, 0.42], [0, 0.02, 0.46], 0.11, 0.09, 6, p.lower[0], p.lower[1]);
  } else if (p.skirt) {
    b.prism([0, 0.03, 0], [0, hip, 0], 0.34, 0.17, 8, p.lower[0], p.lower[1]);
  } else {
    b.prism([0.09, 0.02, 0.05], [0.07, hip, 0], 0.075, 0.11, 6, p.lower[0], p.lower[1]);
    b.prism([-0.09, 0.02, -0.07], [-0.07, hip, 0], 0.075, 0.11, 6, p.lower[0], p.lower[1]);
  }
  b.prism([0, hip - 0.05, 0], [0, hip + 0.56, 0.02], 0.2, 0.23, 8, p.upper[0], p.upper[1]);
  b.prism([0, hip + 0.52, 0.02], [0, hip + 0.6, 0.02], 0.22, 0.09, 8, p.upper[0], p.upper[1]);
  b.prism([0, hip + 0.6, 0.02], [0, hip + 0.83, 0.03], 0.1, 0.105, 7, PAINT.skin[0], PAINT.skin[1]);
  if (p.hat) {
    b.prism([0, hip + 0.8, 0.03], [0, hip + 0.83, 0.03], 0.2, 0.2, 9, p.hat[0], p.hat[1], KIND.flat);
    b.prism([0, hip + 0.83, 0.03], [0, hip + 0.93, 0.03], 0.11, 0.1, 7, p.hat[0], p.hat[1]);
  }
  // Arms.
  for (const sx of [-1, 1]) b.prism([sx * 0.24, hip + 0.5, 0.02], [sx * 0.27, hip + 0.02, p.seated ? 0.2 : 0.06], 0.065, 0.05, 5, p.upper[0], p.upper[1]);
  b.resetTransform();
}

function addTerraceLife(b: TownBuilder, rand: () => number): void {
  const seats: Array<{ x: number; z: number; heading: number }> = [];
  for (const x of [-4.75, -2.85]) {
    for (let k = 0; k < 7; k++) {
      const tz = 2.3 - k * 3.2 + (rand() - 0.5) * 0.5;
      const tx = x + (rand() - 0.5) * 0.3;
      addTable(b, tx, tz);
      const turn = rand() * Math.PI;
      for (const side of [0, Math.PI]) {
        if (rand() < 0.12) continue;
        const ang = turn + side + (rand() - 0.5) * 0.5;
        const cx = tx + Math.sin(ang) * 0.72, cz = tz + Math.cos(ang) * 0.72;
        // The chair faces the table: its back points away from it.
        const heading = ang + Math.PI + (rand() - 0.5) * 0.4;
        addChair(b, cx, cz, heading);
        seats.push({ x: cx, z: cz, heading });
      }
    }
  }
  // Late guests at the far tables.
  const tones: Array<[Pair, Pair]> = [[PAINT.coat, PAINT.coat], [PAINT.rust, PAINT.coat], [PAINT.green, PAINT.rust], [PAINT.coat, PAINT.green]];
  let guests = 0;
  for (const seat of seats) {
    if (seat.z > -5.5 || rand() < 0.42) continue;
    const [lower, upper] = tones[guests % tones.length];
    addPerson(b, { x: seat.x, z: seat.z, ground: TERRACE.top + 0.02, heading: seat.heading, lower, upper, seated: true, hat: guests % 3 === 0 ? PAINT.coat : undefined });
    guests++;
  }
  // The waiter in his long white apron.
  addPerson(b, { x: -3.75, z: -5.6, ground: TERRACE.top, heading: 2.4, lower: PAINT.apron, upper: PAINT.apron, skirt: true, scale: 1.04 });
  // People in the street.
  addPerson(b, { x: 1.5, z: -12.6, ground: 0, heading: 0.3, lower: PAINT.rust, upper: PAINT.rust, skirt: true, hat: PAINT.coat });
  addPerson(b, { x: 2.15, z: -13.1, ground: 0, heading: 0.2, lower: PAINT.coat, upper: PAINT.coat, hat: PAINT.coat, scale: 1.05 });
  addPerson(b, { x: -1.6, z: -24.5, ground: 0, heading: 3.0, lower: PAINT.green, upper: PAINT.coat, skirt: true });
  addPerson(b, { x: 3.4, z: -34, ground: 0, heading: 0.4, lower: PAINT.coat, upper: PAINT.coat, hat: PAINT.coat });
  addPerson(b, { x: 2.7, z: -34.4, ground: 0, heading: 0.5, lower: PAINT.rust, upper: PAINT.green, skirt: true });
  addPerson(b, { x: 4.2, z: -20.5, ground: 0, heading: -1.2, lower: PAINT.coat, upper: PAINT.coat });
}

function addTree(b: TownBuilder): void {
  const rand = mulberry32(8);
  // A plane tree on the right: its boughs reach over the street.
  b.prism([5.15, 0, 5.6], [5.0, 4.5, 4.8], 0.25, 0.17, 7, PAINT.bark[0], PAINT.bark[1]);
  b.prism([5.0, 4.5, 4.8], [3.6, 7.0, -1.2], 0.16, 0.06, 6, PAINT.bark[0], PAINT.bark[1]);
  b.prism([5.0, 4.5, 4.8], [4.9, 8.0, 2.4], 0.15, 0.06, 6, PAINT.bark[0], PAINT.bark[1]);
  const lump = new THREE.IcosahedronGeometry(1, 2);
  const p = lump.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(0.78 + 0.5 * noise3(v.x * 1.9 + 3, v.y * 1.9, v.z * 1.9));
    p.setXYZ(i, v.x, v.y * 0.8, v.z);
  }
  const clumps: Array<[number, number, number, number]> = [
    [3.6, 7.0, -1.6, 1.5], [2.6, 7.8, -3.0, 1.2], [4.5, 8.2, -0.2, 1.6], [3.4, 8.8, 1.4, 1.4], [4.9, 6.9, -2.4, 1.3],
    [5.0, 8.5, 2.6, 1.5], [2.1, 6.8, -0.6, 0.95], [4.0, 9.5, -1.0, 1.3], [1.7, 8.1, -3.6, 0.85], [5.3, 9.3, 0.6, 1.4],
  ];
  const q = new THREE.Quaternion();
  for (const [x, y, z, r] of clumps) {
    q.setFromEuler(new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28));
    const pair = rand() < 0.4 ? PAINT.leafLight : PAINT.leaf;
    b.solid(lump, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, r * 0.85, r)), pair[0], pair[1], KIND.foliage);
  }
  lump.dispose();
}

function buildTown(): THREE.BufferGeometry {
  const rand = mulberry32(88);
  const b = new TownBuilder();
  addCafe(b, rand);
  addTerraceLife(b, rand);
  addTree(b);
  const houses: House[] = [
    // Right side of the street, near to far.
    { x0: 5.4, x1: 14, z0: -6, z1: 16, height: 10.2, wall: 2, lit: 0.08 },
    { x0: 5.1, x1: 14, z0: -20, z1: -6, height: 12.6, wall: 0, lit: 0.2, shopWest: true },
    { x0: 5.6, x1: 14, z0: -34, z1: -20, height: 10.6, wall: 3, lit: 0.18 },
    { x0: 5.0, x1: 14, z0: -48, z1: -34, height: 13.2, wall: 1, lit: 0.3 },
    { x0: 5.5, x1: 14, z0: -63, z1: -48, height: 11.2, wall: 5, lit: 0.25 },
    // Left side, past the café and the side alley.
    { x0: -14, x1: -5.2, z0: -40, z1: -23, height: 11.0, wall: 4, lit: 0.3, shopEast: true },
    { x0: -14, x1: -5.7, z0: -63, z1: -40, height: 12.4, wall: 1, lit: 0.25 },
    // The end of the street and the houses behind the painter.
    { x0: -7.5, x1: 8, z0: -76, z1: -66, height: 12.8, wall: 4, lit: 0.35, shopSouth: true },
    { x0: -15, x1: -7.6, z0: 6.2, z1: 17, height: 10.4, wall: 3, lit: 0.1 },
    { x0: -15, x1: 14, z0: 22, z1: 32, height: 11.4, wall: 0, lit: 0.15 },
    // The quarter round the corner: back rows and cross streets.
    { x0: 17.5, x1: 27, z0: -18, z1: 14, height: 11.8, wall: 5, lit: 0.12 },
    { x0: 17.5, x1: 27, z0: -44, z1: -21, height: 10.4, wall: 3, lit: 0.15 },
    { x0: 17.5, x1: 27, z0: -70, z1: -47, height: 12.6, wall: 0, lit: 0.12 },
    { x0: -28, x1: -18.5, z0: -14, z1: 16, height: 11.2, wall: 1, lit: 0.12 },
    { x0: -27, x1: -17.5, z0: -40, z1: -17, height: 12.4, wall: 2, lit: 0.15 },
    { x0: -27, x1: -17.5, z0: -70, z1: -43, height: 10.8, wall: 5, lit: 0.12 },
    { x0: -30, x1: -10.5, z0: -93, z1: -80, height: 11.6, wall: 3, lit: 0.12 },
    { x0: 10.5, x1: 30, z0: -93, z1: -80, height: 12.2, wall: 1, lit: 0.12 },
    { x0: -34, x1: -18, z0: 20, z1: 34, height: 10.6, wall: 5, lit: 0.1 },
    { x0: 17.5, x1: 34, z0: 18, z1: 34, height: 11.6, wall: 2, lit: 0.1 },
    { x0: 30.5, x1: 42, z0: -62, z1: 12, height: 10.9, wall: 4, lit: 0.08 },
    { x0: -42, x1: -31, z0: -62, z1: 14, height: 11.5, wall: 0, lit: 0.08 },
  ];
  for (const h of houses) addHouse(b, rand, h);
  // The belfry beyond the roofs.
  const tower = HOUSE_WALLS[4];
  b.box(0.8, 4.6, 0, 22, -82, -78.2, tower[0], tower[1]);
  b.poly([[0.5, 22, -77.9], [4.9, 22, -77.9], [2.7, 28.5, -80.1]], PAINT.roof[0], PAINT.roof[1], KIND.flat);
  b.poly([[4.9, 22, -77.9], [4.9, 22, -82.3], [2.7, 28.5, -80.1]], PAINT.roof[0], PAINT.roof[1], KIND.flat);
  b.poly([[4.9, 22, -82.3], [0.5, 22, -82.3], [2.7, 28.5, -80.1]], PAINT.roof[0], PAINT.roof[1], KIND.flat);
  b.poly([[0.5, 22, -82.3], [0.5, 22, -77.9], [2.7, 28.5, -80.1]], PAINT.roof[0], PAINT.roof[1], KIND.flat);
  b.poly([[2.0, 17.5, -78.15], [3.4, 17.5, -78.15], [3.4, 20, -78.15], [2.0, 20, -78.15]], WINDOW_LIT[2], WINDOW_LIT[2], KIND.window);
  return b.build();
}

const TOWN_VERT = /* glsl */ `
attribute vec3 color;
attribute vec3 aWarm;
attribute float aKind;
attribute vec2 aUv;
varying vec3 vWp;
varying vec3 vNight;
varying vec3 vWarm;
varying vec3 vN;
varying float vKind;
varying vec2 vUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vNight = color;
  vWarm = aWarm;
  vN = normalize(mat3(modelMatrix) * normal);
  vKind = aKind;
  vUv = aUv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/** Fragment tail shared by the town and the pavement. Expects ch, col, dir, jitA, jitB. */
const METRE_STROKES = /* glsl */ `
  float mpp = clamp(sqrt(length(dFdx(ch)) * length(dFdy(ch))), 1e-5, 4.0);
  // Octave selection keeps dabs near one size on screen at any distance.
  float lod = -log2(uCell * mpp);
  float k = floor(lod);
  float D = exp2(k);
  gFlow = vec4(dir * 0.5 + 0.5, 0.5, 0.25);
  gColor = col;
  vec4 acc = vec4(col * 0.72, 0.08);
  acc = strokeVar(ch * D, vec2(1.0), 0.0, mpp * D, 13.0, vec4(0.80, 0.28, 0.95, 0.02), jitA, uTime, acc);
  acc = strokeVar(ch * D * 2.0, vec2(1.0), 0.0, mpp * D * 2.0, 13.0, vec4(0.80, 0.26, 0.8, 0.03), jitB, uTime, acc);
  vec4 fine = strokeVar(ch * D * 4.0, vec2(1.0), 0.0, mpp * D * 4.0, 13.0, vec4(0.80, 0.26, 0.8, 0.03), jitB, uTime, acc);
  acc = mix(acc, fine, smoothstep(0.0, 1.0, lod - k));
`;

const TOWN_FRAG = /* glsl */ `
uniform float uCell;
varying vec3 vWp;
varying vec3 vNight;
varying vec3 vWarm;
varying vec3 vN;
varying float vKind;
varying vec2 vUv;
vec4 gFlow; vec3 gColor; vec3 gAccent;
${GLSL_NOISE}
${CAFE_LIGHT}
${strokeFn('strokeVar', 'var')}
void main() {
  if (vKind > 3.5) {
    // The gas globe: flat light.
    gl_FragColor = vec4(vNight * (0.96 + 0.04 * sin(uTime * 3.1 + vWp.z)), 0.95);
    return;
  }
  if (vKind > 1.5 && vKind < 2.5) {
    // A lit window: lamplight behind glazing bars. It breathes.
    vec2 pane = vUv / vec2(0.46, 0.62);
    vec2 bar = abs(fract(pane) - 0.5);
    float aa = length(fwidth(pane)) + 1e-4;
    float glass = 1.0 - smoothstep(0.41 - aa, 0.41 + aa, max(bar.x, bar.y));
    float f = 0.9 + 0.1 * sin(uTime * (1.1 + hash21(floor(vWp.xz * 0.5)) * 1.7) + vWp.y * 2.0);
    vec3 lit = vNight * f * (0.86 + 0.2 * vnoise(vUv * 5.0));
    vec3 col = mix(lit * vec3(0.5, 0.33, 0.2), lit, mix(1.0, glass, 1.0 - smoothstep(0.2, 0.6, aa)));
    gl_FragColor = vec4(col, 0.55 + 0.35 * glass);
    return;
  }
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float warm = warmLight(vWp, n);
  // Starlight: tops and street faces are a little lighter than the rest.
  vec3 col = mix(vNight, vWarm, warm) * (0.9 + 0.1 * n.y + 0.05 * n.x);
  vec2 ch = vUv;
  vec2 dir;
  if (vKind > 2.5) {
    // Foliage: one chart for the whole crown, and dabs that fan out like leaves.
    float a = vnoise(vWp.xy * 0.9 + vWp.z) * 6.28;
    dir = vec2(cos(a), sin(a));
    ch = vec2(vWp.x + vWp.z * 0.7, vWp.y + vWp.z * 0.2) * 1.25;
    col = vNight * (0.82 + 0.5 * vnoise(vWp.xy * 0.55 + vWp.z * 0.4));
  } else if (vKind > 0.5) {
    dir = normalize(vec2(1.0, 0.22));
  } else {
    dir = normalize(vec2(0.3 * sin(vUv.x * 0.7 + vWp.y * 0.4), 1.0));
  }
  if (dir.x < 0.0) dir = -dir;
  gAccent = mix(vec3(0.28, 0.4, 0.74), vec3(1.0, 0.9, 0.55), warm);
  vec4 jitA = vec4(0.22, 0.07, 0.09, 0.14);
  vec4 jitB = vec4(0.26, 0.09, 0.11, 0.18);
  ${METRE_STROKES}
  gl_FragColor = acc;
}
`;

// ---------------------------------------------------------------------------
// Pavement
// ---------------------------------------------------------------------------

const PAVE_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const PAVE_FRAG = /* glsl */ `
varying vec3 vWp;
${GLSL_NOISE}
${CAFE_LIGHT}
vec3 pick(float h, vec3 a, vec3 b, vec3 c, vec3 d) {
  return h < 0.3 ? a : h < 0.58 ? b : h < 0.82 ? c : d;
}
void main() {
  // Setts laid in fans: each course is an arc, and the courses break joint.
  vec2 q = vWp.xz / 0.27;
  float bay = q.x / 9.0;
  float arc = abs(fract(bay) - 0.5) * 2.0;
  q.y += 2.6 * (1.0 - arc * arc);
  float course = floor(q.y);
  q.x += hash11(course) * 9.0 + 0.5 * mod(course, 2.0);
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  vec3 h = hash23(cell + 7.0);
  vec2 d = abs(f + (h.xy - 0.5) * 0.07) / vec2(0.41 + 0.06 * h.x, 0.39 + 0.07 * h.y);
  float sd = pow(d.x * d.x * d.x + d.y * d.y * d.y, 0.3333);
  float aa = length(fwidth(q)) * 1.2 + 1e-4;
  float stone = 1.0 - smoothstep(0.9 - aa, 0.9 + aa, sd);
  float dome = clamp(1.0 - sd * sd, 0.0, 1.0);

  float warm = warmLight(vWp, vec3(0.0, 1.0, 0.0));
  // The whole café front glows on the street, past the reach of the lamps.
  float glow = exp(-max(vWp.x + 1.4, 0.0) / 6.5) * smoothstep(-27.0, -17.0, vWp.z) * (1.0 - smoothstep(3.0, 11.0, vWp.z));
  warm = clamp(warm * 1.1 + 0.55 * glow, 0.0, 1.0);
  // The lit shop fronts down the street warm the setts in front of them.
  warm = max(warm, 0.5 * exp(-abs(vWp.x - 3.2) / 3.0) * exp(-pow((vWp.z + 13.0) / 5.5, 2.0)));
  warm = max(warm, 0.55 * exp(-abs(vWp.x + 3.4) / 3.2) * exp(-pow((vWp.z + 31.0) / 6.0, 2.0)));

  float hh = fract(h.z * 13.7 + h.x * 5.3);
  vec3 night = pick(hh, vec3(0.16, 0.22, 0.52), vec3(0.25, 0.22, 0.48), vec3(0.12, 0.18, 0.4), vec3(0.3, 0.36, 0.58));
  night = mix(night, vec3(0.15, 0.36, 0.42), step(0.93, h.y));
  vec3 lit = pick(hh, vec3(0.95, 0.7, 0.26), vec3(0.92, 0.52, 0.24), vec3(0.87, 0.64, 0.46), vec3(0.97, 0.84, 0.48));
  // Some setts stay lilac in the light: the complement of the yellow.
  lit = mix(lit, vec3(0.6, 0.5, 0.72), step(0.8, h.y));
  vec3 col = mix(night, lit, warm * (0.72 + 0.28 * h.x));
  col *= 0.82 + 0.3 * dome * (0.6 + 0.4 * vnoise(q * 3.0));
  vec3 joint = mix(vec3(0.05, 0.07, 0.24), vec3(0.36, 0.2, 0.16), warm * 0.7);
  col = mix(joint, col, stone);
  // Far setts are smaller than a pixel: paint their mean.
  float far = smoothstep(0.35, 1.1, aa);
  vec3 mean = mix(vec3(0.17, 0.2, 0.44), vec3(0.86, 0.62, 0.32), warm * 0.86);
  col = mix(col, mean, far);
  // Past the last houses the ground sinks into the night.
  col = mix(col, vec3(0.07, 0.1, 0.3), smoothstep(46.0, 100.0, length(vWp.xz - vec2(0.0, -28.0))));
  gl_FragColor = vec4(col, mix(0.12 + 0.62 * dome * stone, 0.3, far));
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
  vec3 col = c.rgb * (1.0 + diff * 0.9);
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 46.0);
  col += spec * 0.15 * c.a * vec3(1.0, 0.97, 0.9);

  // Cloisonnist contour: a dark blue line where the depth breaks.
  float wob = 0.7 + 0.9 * vnoise(cv * 0.045);
  float edge = smoothstep(0.012, 0.05, depthEdge(vUv, px * 1.4 * wob));
  col = mix(col, vec3(0.04, 0.06, 0.2), edge * 0.84);

  col *= 0.93 + 0.11 * weave;
  col *= vignette(vUv, 0.4);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createCafeTerrace(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 900;
  const time: THREE.IUniform<number> = { value: 0 };
  const lamps = { value: LAMPS.map((l) => new THREE.Vector3(l[0], l[1], l[2])) };
  const cell: THREE.IUniform<number> = { value: 22 };

  const skyTex = bakeSky();
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { tFlow: { value: skyTex.flow }, tColor: { value: skyTex.color }, tAux: { value: skyTex.aux }, uTime: time, uPixAngle: { value: 0.001 } },
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(far * 0.9, 48, 24), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  const paveGeo = new THREE.PlaneGeometry(240, 240);
  paveGeo.rotateX(-Math.PI / 2);
  const pavement = new THREE.Mesh(paveGeo, new THREE.ShaderMaterial({ vertexShader: PAVE_VERT, fragmentShader: PAVE_FRAG, uniforms: { uTime: time, uLamps: lamps } }));
  pavement.position.set(0, 0, -25);
  pavement.frustumCulled = false;
  scene.add(pavement);

  const town = new THREE.Mesh(
    buildTown(),
    new THREE.ShaderMaterial({ vertexShader: TOWN_VERT, fragmentShader: TOWN_FRAG, uniforms: { uTime: time, uLamps: lamps, uCell: cell }, side: THREE.DoubleSide }),
  );
  town.frustumCulled = false;
  scene.add(town);

  return {
    scene,
    meta: {
      title: 'Café Terrace at Night',
      artist: 'Vincent van Gogh · 1888',
      technique: 'One-mesh street corner with night + lamplight pigment per vertex, gaslight with awning shadow, fan-laid cobble shader, baked ringed-star sky under 3 layers of brush dabs, impasto relief, contour lines.',
    },
    presets: [
      { name: 'The Painting', position: HERO.position, target: HERO.target, fov: HERO.fov },
      { name: 'Under the Awning', position: [-3.7, 1.62, 3.2], target: [-3.9, 1.7, -12], fov: 62 },
      { name: 'Down the Street', position: [2.4, 1.7, -31], target: [-2.6, 2.8, -6], fov: 54 },
      { name: 'Roofs and Stars', position: [3.2, 19.5, 25], target: [-2, 10, -30], fov: 48 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.1,
    far,
    flySpeed: 6,
    maxDistance: 90,
    floorAt: () => 0.5,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      skyMat.uniforms.uPixAngle.value = (2 * Math.tan((ctx.camera.fov * DEG) / 2)) / ctx.height;
      // Pixels per dab cell: constant on the canvas, whatever its size.
      cell.value = 22 * (ctx.height / 760);
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
