// The Tree of Life, Stoclet Frieze — Gustav Klimt, 1905–09.
//
// The frieze is a relief panel on a wall. The tree is grown at load time: a
// trunk, then one branch for each spiral site. Each branch leaves an older
// branch along its tangent, meets the circle of its site on a tangent line,
// and winds inward. The branches are half-round ribbons with a brushed
// gold-leaf shader. Its highlight is anisotropic, so each spiral shows two
// bright spokes that turn when the eye or the lamps move. The spaces between
// the spirals hold raised inlays: jewel tiles, Byzantine discs, and eye
// triangles. A meadow of flowers stands along the foot, and crows perch on
// three spirals. The relief casts a baked soft shadow on the tesserae ground.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, hex, mix, mulberry32, smoothstep, type RGB } from '../util';

const X0 = -17, X1 = 17, Y0 = 0.5, Y1 = 11.5;
const PANEL_W = X1 - X0, PANEL_H = Y1 - Y0;
const WALL_Z = -0.3;
const SHADOW_RES = 48;
const TAU = Math.PI * 2;

const KIND_TILE = 0, KIND_DISC = 1, KIND_EYE = 2, KIND_FLOWER = 3, KIND_STEM = 4, KIND_CROW = 5, KIND_FRAME = 6, KIND_GOLD = 7;

/** Top edge of the meadow band at x. */
function meadowTop(x: number): number {
  return 2.3 + 0.22 * Math.sin(x * 0.7 + 0.4) + 0.12 * Math.sin(x * 1.9 + 1.0);
}

// ---------------------------------------------------------------------------
// Free-space lookup: discs in a hash grid.
// ---------------------------------------------------------------------------

class Clearance {
  private static readonly SIZE = 0.6;
  private readonly cells = new Map<number, number[]>();

  private static key(ix: number, iy: number): number {
    return (ix + 512) * 4096 + (iy + 512);
  }

  add(x: number, y: number, r: number): void {
    const S = Clearance.SIZE;
    for (let iy = Math.floor((y - r) / S); iy <= Math.floor((y + r) / S); iy++) {
      for (let ix = Math.floor((x - r) / S); ix <= Math.floor((x + r) / S); ix++) {
        const k = Clearance.key(ix, iy);
        let list = this.cells.get(k);
        if (!list) {
          list = [];
          this.cells.set(k, list);
        }
        list.push(x, y, r);
      }
    }
  }

  /** Gap between the point and the nearest disc. The result is exact up to the cell size and capped there. */
  gap(x: number, y: number): number {
    const S = Clearance.SIZE;
    const cx = Math.floor(x / S), cy = Math.floor(y / S);
    let best = S;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.cells.get(Clearance.key(cx + dx, cy + dy));
        if (!list) continue;
        for (let i = 0; i < list.length; i += 3) {
          const g = Math.hypot(list[i] - x, list[i + 1] - y) - list[i + 2];
          if (g < best) best = g;
        }
      }
    }
    return best;
  }
}

// ---------------------------------------------------------------------------
// Tree growth
// ---------------------------------------------------------------------------

interface Site {
  x: number;
  y: number;
  r: number;
  /** Half width of the ribbon at the top of the outer turn. Set when the spiral is grown. */
  rim: number;
  grown: boolean;
}

/** A point of a finished branch where a new branch can start. */
interface Anchor {
  x: number;
  y: number;
  tx: number;
  ty: number;
  w: number;
  gen: number;
  /** Site whose spiral holds this point, or -1. */
  site: number;
}

/** A ribbon centre line: x, y, half width for each point. */
type Ribbon = number[];

interface Tree {
  ribbons: Ribbon[];
  sites: Site[];
}

function laySites(rand: () => number): Site[] {
  const sites: Site[] = [
    { x: -2.75, y: 6.45, r: 1.15, rim: 0, grown: false },
    { x: 2.85, y: 6.3, r: 1.15, rim: 0, grown: false },
    { x: 0.15, y: 8.55, r: 0.95, rim: 0, grown: false },
  ];
  for (let tries = 0; tries < 14000; tries++) {
    const r = 0.52 + 0.34 * rand();
    const x = X0 + 0.15 + r + rand() * (PANEL_W - 0.3 - 2 * r);
    const y = 2.6 + r + rand() * (Y1 - 0.18 - 2.6 - 2 * r);
    if (y - r < meadowTop(x) + 0.45) continue;
    // The trunk stands here.
    if (Math.abs(x) < 0.95 + r && y < 5.3 + r) continue;
    if (sites.some((s) => Math.hypot(s.x - x, s.y - y) < (s.r + r) * 1.0 + 0.05)) continue;
    sites.push({ x, y, r, rim: 0, grown: false });
  }
  return sites;
}

function growTree(rand: () => number): Tree {
  const sites = laySites(rand);
  const ribbons: Ribbon[] = [];
  const anchors: Anchor[] = [];

  // The trunk: a slow S with a flared foot and a round tip between the first boughs.
  const trunk: Ribbon = [];
  const TRUNK_STEPS = 44;
  const trunkAt = (t: number): [number, number] => [0.24 * Math.sin(t * 2.7 - 0.5) * t + 0.03, 0.72 + t * 4.55];
  for (let i = 0; i <= TRUNK_STEPS; i++) {
    const t = i / TRUNK_STEPS;
    const [x, y] = trunkAt(t);
    const w = (0.56 + 0.6 * Math.exp(-t * 6.5) - 0.07 * t) * (1 - smoothstep(0.86, 1.0, t) * 0.9);
    trunk.push(x, y, w);
    if (t > 0.58 && t < 0.9) {
      const [xa, ya] = trunkAt(t - 0.01);
      const [xb, yb] = trunkAt(t + 0.01);
      const l = Math.hypot(xb - xa, yb - ya);
      anchors.push({ x, y, tx: (xb - xa) / l, ty: (yb - ya) / l, w, gen: 0, site: -1 });
    }
  }
  ribbons.push(trunk);
  const fork = trunkAt(0.8);

  const order = sites.map((_, i) => i).sort((a, b) => Math.hypot(sites[a].x - fork[0], sites[a].y - fork[1]) - Math.hypot(sites[b].x - fork[0], sites[b].y - fork[1]));

  interface Plan { cost: number; anchor: Anchor; spin: 1 | -1; a0: number; px: number; py: number }

  const tryGrow = (index: number): boolean => {
    const site = sites[index];
    const plans: Plan[] = [];
    for (const an of anchors) {
      const dx = an.x - site.x, dy = an.y - site.y;
      const d = Math.hypot(dx, dy);
      if (d < site.r * 1.1 || d > 6.0) continue;
      const psi = Math.atan2(dy, dx);
      const beta = Math.acos(site.r / d);
      for (const spin of [1, -1] as const) {
        const a0 = psi + spin * beta;
        const px = site.x + site.r * Math.cos(a0), py = site.y + site.r * Math.sin(a0);
        const len = Math.hypot(px - an.x, py - an.y);
        if (len < 0.12) continue;
        const align = ((px - an.x) * an.tx + (py - an.y) * an.ty) / len;
        if (align < 0.08) continue;
        plans.push({ cost: len * (1.7 - align) + 0.1 * an.gen, anchor: an, spin, a0, px, py });
      }
    }
    plans.sort((a, b) => a.cost - b.cost);

    for (const plan of plans.slice(0, 80)) {
      const an = plan.anchor;
      const len = Math.hypot(plan.px - an.x, plan.py - an.y);
      const k = len * 0.38;
      // Tangent of the spiral where the stem meets it.
      const ex = -Math.sin(plan.a0) * plan.spin, ey = Math.cos(plan.a0) * plan.spin;
      const bx1 = an.x + an.tx * k, by1 = an.y + an.ty * k;
      const bx2 = plan.px - ex * k, by2 = plan.py - ey * k;
      const stemAt = (u: number): [number, number] => {
        const v = 1 - u;
        return [
          v * v * v * an.x + 3 * v * v * u * bx1 + 3 * v * u * u * bx2 + u * u * u * plan.px,
          v * v * v * an.y + 3 * v * v * u * by1 + 3 * v * u * u * by2 + u * u * u * plan.py,
        ];
      };
      // The stem must stay clear of every other spiral, of the meadow, and of the frame.
      let clear = true;
      for (let s = 1; s <= 9 && clear; s++) {
        const [x, y] = stemAt(s / 10);
        if (y < meadowTop(x) + 0.12 || y > Y1 - 0.1 || Math.abs(x) > X1 - 0.1) clear = false;
        for (let j = 0; j < sites.length && clear; j++) {
          if (j === index) continue;
          const limit = j === an.site ? sites[j].r * 0.96 : sites[j].r + 0.03;
          if (Math.hypot(x - sites[j].x, y - sites[j].y) < limit) clear = false;
        }
      }
      if (!clear) continue;

      const turns = 2.3 + 0.8 * (site.r - 0.5);
      const end = 0.075;
      const pitch = (site.r - end) / turns;
      const coil = pitch * 0.27;
      const w0 = clamp(an.w * 0.78, 0.075, 0.36);
      const wJoin = Math.max(coil, w0 * 0.7);
      const gen = an.gen + 1;
      const ribbon: Ribbon = [];
      const stemSteps = Math.max(6, Math.ceil(len / 0.07));
      for (let s = 0; s < stemSteps; s++) {
        const u = s / stemSteps;
        const [x, y] = stemAt(u);
        const w = mix(w0, wJoin, u);
        ribbon.push(x, y, w);
        if (s >= 3) {
          const [xb, yb] = stemAt(u + 0.01);
          const l = Math.hypot(xb - x, yb - y);
          anchors.push({ x, y, tx: (xb - x) / l, ty: (yb - y) / l, w, gen, site: -1 });
        }
      }
      const total = turns * TAU;
      const steps = Math.ceil(total / (8 * Math.PI / 180));
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const phi = f * total;
        const rad = site.r - (site.r - end) * Math.pow(f, 0.92);
        const a = plan.a0 + plan.spin * phi;
        const x = site.x + rad * Math.cos(a), y = site.y + rad * Math.sin(a);
        const w = mix(wJoin, coil, smoothstep(0, 0.2, f)) * (1 - 0.42 * f) * (1 - 0.75 * smoothstep(0.95, 1, f));
        ribbon.push(x, y, w);
        // New branches leave the outer turn.
        if (phi < 1.5 * Math.PI && s % 2 === 0) {
          anchors.push({ x, y, tx: -Math.sin(a) * plan.spin, ty: Math.cos(a) * plan.spin, w, gen, site: index });
        }
      }
      ribbons.push(ribbon);
      site.grown = true;
      site.rim = mix(wJoin, coil, 0.6);
      return true;
    }
    return false;
  };

  // A site can fail until a neighbour has grown, so repeat until a pass adds nothing.
  for (let pass = 0; pass < 6; pass++) {
    let added = 0;
    for (const i of order) {
      if (!sites[i].grown && tryGrow(i)) added++;
    }
    if (added === 0) break;
  }
  if (ribbons.length < 40) throw new Error(`Tree growth made ${ribbons.length} branches; expected 40 or more`);
  return { ribbons, sites };
}

/** Half-round ribbons along the centre lines. */
function buildTreeGeometry(ribbons: Ribbon[]): THREE.BufferGeometry {
  const K = 7;
  const pos: number[] = [];
  const nor: number[] = [];
  const tan: number[] = [];
  const uv: number[] = [];
  const wid: number[] = [];
  const idx: number[] = [];
  ribbons.forEach((rb, ri) => {
    const n = rb.length / 3;
    const start = pos.length / 3;
    let along = ri * 3.7;
    for (let i = 0; i < n; i++) {
      const a = Math.max(i - 1, 0), b = Math.min(i + 1, n - 1);
      let tx = rb[b * 3] - rb[a * 3], ty = rb[b * 3 + 1] - rb[a * 3 + 1];
      const tl = Math.hypot(tx, ty);
      if (tl < 1e-9) throw new Error(`Ribbon ${ri} has a zero-length step at point ${i}`);
      tx /= tl; ty /= tl;
      if (i > 0) along += Math.hypot(rb[i * 3] - rb[i * 3 - 3], rb[i * 3 + 1] - rb[i * 3 - 2]);
      const x = rb[i * 3], y = rb[i * 3 + 1], w = rb[i * 3 + 2];
      const rise = w * 0.6 + 0.012;
      for (let k = 0; k < K; k++) {
        const ang = (Math.PI * k) / (K - 1);
        const across = Math.cos(ang), up = Math.sin(ang);
        pos.push(x - ty * across * w, y + tx * across * w, up * rise - 0.004);
        // Normal of the half ellipse.
        let nx = across * rise, nz = up * w;
        const nl = Math.hypot(nx, nz);
        nx /= nl; nz /= nl;
        nor.push(-ty * nx, tx * nx, nz);
        tan.push(tx, ty);
        uv.push(across, along);
        wid.push(w);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < K - 1; k++) {
        const a = start + i * K + k, b = a + 1, c = a + K, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 2));
  g.setAttribute('aRib', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWidth', new THREE.Float32BufferAttribute(wid, 1));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// Inlays: one merged mesh of raised pieces.
// ---------------------------------------------------------------------------

type UvOf = (x: number, y: number) => [number, number];

class Inlay {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly colA: number[] = [];
  private readonly colB: number[] = [];
  private readonly meta: number[] = [];
  private readonly idx: number[] = [];
  private a: RGB = [1, 1, 1];
  private b: RGB = [0, 0, 0];
  private kind = 0;
  private seed = 0;

  /** Sets the colours, kind, and seed of the pieces that follow. */
  style(a: RGB, b: RGB, kind: number, seed: number): void {
    this.a = a;
    this.b = b;
    this.kind = kind;
    this.seed = seed;
  }

  private vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number): number {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    this.colA.push(this.a[0], this.a[1], this.a[2]);
    this.colB.push(this.b[0], this.b[1], this.b[2]);
    this.meta.push(this.kind, this.seed);
    return this.pos.length / 3 - 1;
  }

  /** A raised piece with a soft edge and a slightly domed face. The outline is x, y pairs around (cx, cy). */
  pillow(outline: number[], cx: number, cy: number, z0: number, h: number, uvOf: UvOf): void {
    const n = outline.length / 2;
    const rings: number[][] = [[], [], []];
    for (let i = 0; i < n; i++) {
      const x = outline[i * 2], y = outline[i * 2 + 1];
      let ox = x - cx, oy = y - cy;
      const ol = Math.hypot(ox, oy);
      ox /= ol; oy /= ol;
      const ix = cx + (x - cx) * 0.76, iy = cy + (y - cy) * 0.76;
      rings[0].push(this.vert(x, y, z0 - 0.01, ox, oy, 0, ...uvOf(x, y)));
      rings[1].push(this.vert(x, y, z0 + h * 0.7, ox * 0.78, oy * 0.78, 0.62, ...uvOf(x, y)));
      rings[2].push(this.vert(ix, iy, z0 + h, ox * 0.24, oy * 0.24, 0.97, ...uvOf(ix, iy)));
    }
    const centre = this.vert(cx, cy, z0 + h * 1.05, 0, 0, 1, ...uvOf(cx, cy));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (let r = 0; r < 2; r++) {
        this.idx.push(rings[r][i], rings[r][j], rings[r + 1][i], rings[r][j], rings[r + 1][j], rings[r + 1][i]);
      }
      this.idx.push(rings[2][i], rings[2][j], centre);
    }
  }

  /** A flat strip along a path of x, y, z points. */
  strip(path: number[], half: number, uvScale: number): void {
    const n = path.length / 3;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const a = Math.max(i - 1, 0), b = Math.min(i + 1, n - 1);
      let tx = path[b * 3] - path[a * 3], ty = path[b * 3 + 1] - path[a * 3 + 1];
      const tl = Math.hypot(tx, ty);
      tx /= tl; ty /= tl;
      const x = path[i * 3], y = path[i * 3 + 1], z = path[i * 3 + 2];
      const v = (i / (n - 1)) * uvScale;
      const l = this.vert(x - ty * half, y + tx * half, z, -ty * 0.4, tx * 0.4, 0.9, -1, v);
      this.vert(x + ty * half, y - tx * half, z, ty * 0.4, -tx * 0.4, 0.9, 1, v);
      if (prev >= 0) this.idx.push(prev, prev + 1, l, prev + 1, l + 1, l);
      prev = l;
    }
  }

  /** An axis-aligned box. The back face is left out. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, lengthwiseX: boolean): void {
    const quad = (p: number[][], nx: number, ny: number, nz: number): void => {
      const ids = p.map((q) => {
        const u = lengthwiseX ? q[0] : q[1];
        const across = lengthwiseX ? (q[1] - y0) / (y1 - y0) : (q[0] - x0) / (x1 - x0);
        return this.vert(q[0], q[1], q[2], nx, ny, nz, u, across * 2 - 1 + (nz > 0.5 ? 0 : 3));
      });
      this.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    };
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0, 0, 1);
    quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0, -1, 0);
    quad([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], 0, 1, 0);
    quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], 1, 0, 0);
    quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], -1, 0, 0);
  }

  /** Copies a geometry. place maps a local point to the panel; mirror flips x of the normal. */
  copy(geo: THREE.BufferGeometry, place: (x: number, y: number, z: number) => [number, number, number], mirror: boolean): void {
    const p = geo.getAttribute('position');
    const nrm = geo.getAttribute('normal');
    const first = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      const [x, y, z] = place(p.getX(i), p.getY(i), p.getZ(i));
      this.vert(x, y, z, nrm.getX(i) * (mirror ? -1 : 1), nrm.getY(i), nrm.getZ(i), p.getX(i), p.getY(i));
    }
    const index = geo.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) this.idx.push(first + index.getX(i));
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(first + i);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aColA', new THREE.Float32BufferAttribute(this.colA, 3));
    g.setAttribute('aColB', new THREE.Float32BufferAttribute(this.colB, 3));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(this.meta, 2));
    g.setIndex(this.idx);
    return g;
  }
}

const BLACK = hex(0x0e0d10), PEARL = hex(0xece6d2), LAPIS = hex(0x1d3f94), TURQUOISE = hex(0x2a9c96);
const EMERALD = hex(0x2a7a4a), CORAL = hex(0xc8472c), VIOLET = hex(0x6a4a9c), SILVER = hex(0xaeb2b4), AMBER = hex(0xd9892a);
const JEWELS: RGB[] = [LAPIS, TURQUOISE, EMERALD, CORAL, VIOLET, PEARL, BLACK, SILVER, AMBER];
const FLOWER_PETALS: RGB[] = [hex(0x2d58b8), hex(0xf2ecdc), hex(0xd4502e), hex(0x7d55b0), hex(0xe9b83a), hex(0x3aa7a0), hex(0xe88aa0), hex(0xf2ecdc), hex(0x2d58b8)];
const FLOWER_CORES: RGB[] = [hex(0xf0c040), hex(0xf4efe0), hex(0x1a1a22), hex(0xd4502e)];
const STEM_GREENS: RGB[] = [hex(0x2f5a2c), hex(0x4a7030), hex(0x1f4a3a), hex(0x6a7a2e)];

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

function circle(cx: number, cy: number, r: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** Local frame for the pattern of a piece: rotation rot, one unit = scale. */
function frame(cx: number, cy: number, rot: number, scale: number): UvOf {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (x, y) => {
    const dx = (x - cx) / scale, dy = (y - cy) / scale;
    return [c * dx + s * dy, -s * dx + c * dy];
  };
}

/** The crow, facing left. One unit is about the length of the body. */
function crowShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.62, 0.3);
  s.quadraticCurveTo(-0.44, 0.44, -0.31, 0.46);
  s.bezierCurveTo(-0.22, 0.61, 0.03, 0.61, 0.11, 0.42);
  s.bezierCurveTo(0.31, 0.34, 0.47, 0.1, 0.51, -0.18);
  s.lineTo(0.76, -0.62);
  s.lineTo(0.59, -0.67);
  s.bezierCurveTo(0.45, -0.44, 0.35, -0.36, 0.2, -0.38);
  s.bezierCurveTo(-0.06, -0.4, -0.3, -0.22, -0.34, 0.06);
  s.quadraticCurveTo(-0.36, 0.18, -0.41, 0.24);
  s.lineTo(-0.62, 0.3);
  return s;
}

interface Crow { x: number; y: number; size: number; mirror: boolean }

interface Decor {
  geometry: THREE.BufferGeometry;
  /** Discs that cast the baked shadow: x, y, radius, height. */
  casters: number[];
  crows: Crow[];
  counts: { tiles: number; discs: number; eyes: number; flowers: number };
}

function buildDecor(tree: Tree, rand: () => number): Decor {
  const inlay = new Inlay();
  const casters: number[] = [];
  const space = new Clearance();
  for (const rb of tree.ribbons) {
    for (let i = 0; i < rb.length; i += 3) {
      space.add(rb[i], rb[i + 1], rb[i + 2]);
      casters.push(rb[i], rb[i + 1], rb[i + 2], rb[i + 2] * 0.6 + 0.012);
    }
  }

  // Crows perch on the top of three spirals.
  const crows: Crow[] = [];
  const crowGeo = new THREE.ExtrudeGeometry(crowShape(), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2, curveSegments: 10 });
  const perches: Array<[number, number, number, boolean]> = [[4.7, 7.6, 0.98, false], [-6.6, 8.4, 0.82, true], [10.6, 6.2, 0.86, false]];
  const taken = new Set<number>();
  for (const [tx, ty, size, mirror] of perches) {
    let best = -1, bestD = 1e9;
    tree.sites.forEach((s, i) => {
      const d = Math.hypot(s.x - tx, s.y - ty);
      if (s.grown && !taken.has(i) && s.y + s.r + size * 1.2 < Y1 - 0.2 && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) throw new Error(`No grown spiral is free for the crow near ${tx}, ${ty}`);
    taken.add(best);
    const site = tree.sites[best];
    const perch = site.y + site.r + site.rim * 0.6;
    const sx = mirror ? -1 : 1;
    const cx = site.x - sx * 0.08 * size, cy = perch + (0.17 + 0.38) * size;
    crows.push({ x: cx, y: cy, size, mirror });
    inlay.style(BLACK, PEARL, KIND_CROW, rand());
    inlay.copy(crowGeo, (x, y, z) => [cx + sx * x * size, cy + y * size, 0.13 + z], mirror);
    // Legs. Their pattern coordinates lie far outside the body, so they stay plain.
    for (const lx of [-0.06, 0.13]) {
      inlay.box(cx + sx * lx * size - 0.014, cx + sx * lx * size + 0.014, perch - 0.02, cy - 0.36 * size, 0.1, 0.17, false);
    }
    for (const [bx, by, br] of [[0.08, 0.05, 0.4], [-0.25, 0.32, 0.24], [0.5, -0.42, 0.2], [-0.5, 0.33, 0.1]]) {
      space.add(cx + sx * bx * size, cy + by * size, br * size);
      casters.push(cx + sx * bx * size, cy + by * size, br * size, 0.2);
    }
  }
  crowGeo.dispose();

  const counts = { tiles: 0, discs: 0, eyes: 0, flowers: 0 };
  const inField = (x: number, y: number, r: number): boolean =>
    x - r > X0 + 0.08 && x + r < X1 - 0.08 && y + r < Y1 - 0.08 && y - r > meadowTop(x) + 0.14;

  // Byzantine discs in the larger gaps.
  for (let tries = 0; tries < 9000 && counts.discs < 84; tries++) {
    const r = 0.15 + 0.16 * rand();
    const x = X0 + rand() * PANEL_W, y = 2.2 + rand() * (Y1 - 2.2);
    if (!inField(x, y, r) || space.gap(x, y) < r + 0.05) continue;
    const a = pick(JEWELS.slice(0, 5), rand);
    inlay.style(a, pick([PEARL, BLACK, AMBER, CORAL, a], rand), KIND_DISC, rand());
    inlay.pillow(circle(x, y, r, 20), x, y, 0, 0.05 + r * 0.22, frame(x, y, rand() * TAU, r));
    space.add(x, y, r);
    casters.push(x, y, r, 0.1);
    counts.discs++;
  }

  // Eye triangles.
  for (let tries = 0; tries < 16000 && counts.eyes < 170; tries++) {
    const s = 0.2 + 0.15 * rand();
    const x = X0 + rand() * PANEL_W, y = 2.2 + rand() * (Y1 - 2.2);
    if (!inField(x, y, s * 0.7) || space.gap(x, y) < s * 0.68 + 0.03) continue;
    const rot = (rand() < 0.62 ? 0 : Math.PI) + (rand() - 0.5) * 0.7;
    const c = Math.cos(rot), sn = Math.sin(rot);
    const outline: number[] = [];
    for (const [lx, ly] of [[0, 0.62], [-0.58, -0.38], [0.58, -0.38]]) outline.push(x + (c * lx - sn * ly) * s, y + (sn * lx + c * ly) * s);
    inlay.style(pick([EMERALD, LAPIS, TURQUOISE, CORAL, VIOLET], rand), pick([BLACK, LAPIS, EMERALD], rand), KIND_EYE, rand());
    inlay.pillow(outline, x, y, 0, 0.055, frame(x, y, rot, s));
    space.add(x, y, s * 0.6);
    casters.push(x, y, s * 0.5, 0.06);
    counts.eyes++;
  }

  // Jewel tiles, laid in short rows.
  for (let tries = 0; tries < 40000 && counts.tiles < 900; tries++) {
    const r = 0.05 + 0.045 * rand();
    let x = X0 + rand() * PANEL_W, y = 2.2 + rand() * (Y1 - 2.2);
    const dir = rand() < 0.5 ? (rand() < 0.5 ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.3 : rand() * TAU;
    const family = [pick(JEWELS, rand), pick(JEWELS, rand)];
    const run = 1 + Math.floor(rand() * 6);
    for (let k = 0; k < run; k++) {
      if (!inField(x, y, r * 1.42) || space.gap(x, y) < r * 1.42 + 0.018) break;
      const c = Math.cos(dir), sn = Math.sin(dir);
      const outline: number[] = [];
      for (const [lx, ly] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) outline.push(x + (c * lx - sn * ly) * r, y + (sn * lx + c * ly) * r);
      const gold = rand() < 0.22;
      inlay.style(gold ? AMBER : family[k % 2], BLACK, gold ? KIND_GOLD : KIND_TILE, rand());
      inlay.pillow(outline, x, y, 0, 0.035 + 0.03 * rand(), frame(x, y, dir, r));
      space.add(x, y, r * 1.2);
      casters.push(x, y, r * 1.1, 0.05);
      counts.tiles++;
      x += c * (2 * r + 0.022);
      y += sn * (2 * r + 0.022);
    }
  }

  // The meadow: flower heads on thin stems, at several heights above the ground.
  const heads: number[] = [];
  for (let tries = 0; tries < 5000 && counts.flowers < 330; tries++) {
    const x = X0 + 0.25 + rand() * (PANEL_W - 0.5);
    const top = meadowTop(x);
    const y = 0.78 + (top + 1.25 - 0.78) * Math.pow(rand(), 1.25);
    const r = 0.075 + 0.12 * rand() * (0.5 + 0.5 * smoothstep(0.8, 2.6, y));
    // The foot of the trunk stays open.
    if (Math.abs(x) < 1.35 + r && y > 0.5) continue;
    if (y > top && space.gap(x, y) < r + 0.03) continue;
    let crowded = false;
    for (let i = 0; i < heads.length; i += 3) {
      if (Math.hypot(heads[i] - x, heads[i + 1] - y) < (heads[i + 2] + r) * 0.72) { crowded = true; break; }
    }
    if (crowded) continue;
    heads.push(x, y, r);
    const lift = 0.03 + 0.15 * rand();
    const green = pick(STEM_GREENS, rand);
    // Stem: a slow curve from the foot of the panel.
    const x0 = x + (rand() - 0.5) * 0.5, bend = (rand() - 0.5) * 0.4;
    const path: number[] = [];
    const STEPS = 7;
    for (let s = 0; s <= STEPS; s++) {
      const u = s / STEPS, v = 1 - u;
      path.push(v * v * x0 + 2 * v * u * (x0 + bend) + u * u * x, v * v * (Y0 + 0.02) + 2 * v * u * ((Y0 + y) / 2) + u * u * y, 0.006 + (lift - 0.012) * u);
    }
    inlay.style(green, green, KIND_STEM, rand());
    inlay.strip(path, 0.014 + 0.012 * rand(), 1);
    // One or two leaves on the stem.
    const leaves = y > 1.3 ? 1 + Math.floor(rand() * 2) : 0;
    for (let l = 0; l < leaves; l++) {
      const u = 0.3 + 0.4 * rand();
      const k = Math.min(Math.floor(u * STEPS), STEPS - 1);
      const lx = path[k * 3], ly = path[k * 3 + 1], lz = path[k * 3 + 2];
      const side = l === 0 ? 1 : -1;
      const rot = Math.PI / 2 - side * (0.6 + 0.5 * rand());
      const len = 0.09 + 0.08 * rand();
      const c = Math.cos(rot), sn = Math.sin(rot);
      const mx = lx + c * len, my = ly + sn * len;
      const outline: number[] = [];
      for (const [px, py] of [[1, 0], [0.3, 0.42], [-0.6, 0.3], [-1, 0], [-0.6, -0.3], [0.3, -0.42]]) outline.push(mx + (c * px - sn * py) * len, my + (sn * px + c * py) * len);
      inlay.pillow(outline, mx, my, lz, 0.02, frame(mx, my, rot, len));
    }
    inlay.style(pick(FLOWER_PETALS, rand), pick(FLOWER_CORES, rand), KIND_FLOWER, rand());
    inlay.pillow(circle(x, y, r, 16), x, y, lift, 0.03 + r * 0.25, frame(x, y, rand() * TAU, r));
    casters.push(x, y, r, lift + 0.06);
    counts.flowers++;
  }

  // A bronze frame around the frieze. The seed gives the brush direction: 0 along x, 1 along y.
  const F = 0.55, FZ = 0.5;
  inlay.style(AMBER, BLACK, KIND_FRAME, 0);
  inlay.box(X0 - F, X1 + F, Y1, Y1 + F, WALL_Z, FZ, true);
  inlay.box(X0 - F, X1 + F, Y0 - F + 0.05, Y0, WALL_Z, FZ, true);
  inlay.style(AMBER, BLACK, KIND_FRAME, 1);
  inlay.box(X0 - F, X0, Y0, Y1, WALL_Z, FZ, false);
  inlay.box(X1, X1 + F, Y0, Y1, WALL_Z, FZ, false);

  return { geometry: inlay.build(), casters, crows, counts };
}

/** Soft shadow of the relief on the ground, thrown down and to the right. */
function bakeShadow(casters: number[]): THREE.DataTexture {
  const W = Math.round(PANEL_W * SHADOW_RES), H = Math.round(PANEL_H * SHADOW_RES);
  const data = new Uint8Array(W * H);
  for (let i = 0; i < casters.length; i += 4) {
    const h = casters[i + 3];
    const r = casters[i + 2];
    const cx = (casters[i] + h * 0.55 - X0) * SHADOW_RES;
    const cy = (casters[i + 1] - h * 0.75 - Y0) * SHADOW_RES;
    const soft = (0.05 + h * 0.5) * SHADOW_RES;
    const inner = Math.max(r * SHADOW_RES - soft * 0.35, 0);
    const outer = r * SHADOW_RES + soft;
    const strength = 255 * clamp(0.5 + h * 1.4, 0, 0.92);
    const x0 = Math.max(Math.floor(cx - outer), 0), x1 = Math.min(Math.ceil(cx + outer), W - 1);
    const y0 = Math.max(Math.floor(cy - outer), 0), y1 = Math.min(Math.ceil(cy + outer), H - 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d >= outer) continue;
        const t = 1 - (d - inner) / (outer - inner);
        const v = strength * (t >= 1 ? 1 : t * t * (3 - 2 * t));
        const k = y * W + x;
        if (v > data[k]) data[k] = v;
      }
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const GOLD = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uL1;
uniform vec3 uL2;
uniform float uTime;
const vec3 GOLD_DEEP = vec3(0.30, 0.18, 0.045);
const vec3 GOLD_MID = vec3(0.80, 0.57, 0.14);
const vec3 GOLD_LIGHT = vec3(0.98, 0.83, 0.38);
// Brushed gold leaf. T is the brush direction on the surface. The highlight is
// narrow along T and wide across it, so it turns with the eye and the lamps.
vec3 goldLeaf(vec3 wp, vec3 N, vec3 T, float gloss) {
  vec3 V = normalize(uCam - wp);
  // Squares of leaf: each lies at its own small tilt and tone.
  vec2 lq = wp.xy * 2.3 + vec2(0.31, 0.17);
  vec2 lf = fract(lq);
  vec3 lh = hash23(floor(lq));
  N = normalize(N + vec3(lh.xy - 0.5, 0.0) * 0.13);
  float seam = smoothstep(0.0, 0.04, min(min(lf.x, 1.0 - lf.x), min(lf.y, 1.0 - lf.y)));
  T = normalize(T - N * dot(T, N));
  vec3 La = normalize(uL1 - wp);
  vec3 Lb = normalize(uL2 - wp);
  vec3 Ha = normalize(La + V);
  vec3 Hb = normalize(Lb + V);
  float ta = dot(T, Ha), tb = dot(T, Hb);
  float spec = pow(max(1.0 - ta * ta, 0.0), 46.0) * pow(max(dot(N, Ha), 0.0), 5.0);
  spec += 0.6 * pow(max(1.0 - tb * tb, 0.0), 46.0) * pow(max(dot(N, Hb), 0.0), 5.0);
  float diff = max(dot(N, La), 0.0) * 0.72 + max(dot(N, Lb), 0.0) * 0.4;
  // The room in the metal: dark below, light above.
  vec3 R = reflect(-V, N);
  float env = smoothstep(-0.6, 0.9, R.y) * 0.62 + 0.38 * vnoise(R.xy * 2.6 + R.z * 1.7);
  vec3 col = mix(GOLD_DEEP, GOLD_MID, clamp(diff * 0.62 + env * 0.42, 0.0, 1.0));
  col = mix(col, GOLD_LIGHT, clamp(spec * 0.9 * gloss, 0.0, 1.0));
  col += vec3(1.0, 0.93, 0.70) * spec * spec * 0.42 * gloss;
  return col * (0.9 + 0.2 * lh.z) * (0.84 + 0.16 * seam);
}
`;

const TREE_VERT = /* glsl */ `
attribute vec2 aTan;
attribute vec2 aRib;
attribute float aWidth;
varying vec3 vWp;
varying vec3 vN;
varying vec2 vTan;
varying vec2 vRib;
varying float vWidth;
void main() {
  vWp = position;
  vN = normal;
  vTan = aTan;
  vRib = aRib;
  vWidth = aWidth;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const TREE_FRAG = /* glsl */ `
${GLSL_NOISE}
${GOLD}
varying vec3 vWp;
varying vec3 vN;
varying vec2 vTan;
varying vec2 vRib;
varying float vWidth;
void main() {
  vec3 N = normalize(vN);
  vec3 T = normalize(vec3(vTan, 0.0));
  // Brush lines along the branch.
  float streak = vnoise(vec2(vRib.x * (5.0 + vWidth * 60.0), vRib.y * 1.6));
  N = normalize(N + vec3(-T.y, T.x, 0.0) * (streak - 0.5) * 0.22);
  vec3 col = goldLeaf(vWp, N, T, 1.0) * (0.9 + 0.2 * streak);

  // The trunk and the thick boughs carry inlaid blocks.
  float deco = smoothstep(0.15, 0.27, vWidth);
  if (deco > 0.0) {
    float band = floor(vRib.y * 2.7);
    vec2 q = vec2(vRib.y * 2.7, vRib.x * 1.55 + 0.5 + hash11(band + 3.0));
    vec2 id = floor(q);
    vec2 f = fract(q);
    vec3 h = hash23(id + 7.0);
    float inset = smoothstep(0.07, 0.13, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    vec3 block = col;
    float on = 1.0;
    if (h.x < 0.30) block = vec3(0.17, 0.10, 0.055);
    else if (h.x < 0.43) block = vec3(0.91, 0.88, 0.78);
    else if (h.x < 0.53) block = vec3(0.05, 0.05, 0.06);
    else if (h.x < 0.60) block = vec3(0.12, 0.25, 0.58);
    else if (h.x < 0.66) block = vec3(0.16, 0.48, 0.30);
    else if (h.x < 0.71) block = vec3(0.78, 0.28, 0.17);
    else on = 0.0;
    // Some dark blocks hold a gold dot.
    float dotMask = step(h.y, 0.4) * step(h.x, 0.30) * (1.0 - smoothstep(0.16, 0.2, length(f - 0.5)));
    vec3 V = normalize(uCam - vWp);
    vec3 L = normalize(uL1 - vWp);
    float lit = 0.5 + 0.6 * max(dot(N, L), 0.0);
    float gl = pow(max(dot(N, normalize(L + V)), 0.0), 60.0);
    block = block * lit + gl * 0.35;
    float m = on * inset * deco * (1.0 - smoothstep(0.66, 0.8, abs(vRib.x))) * (1.0 - dotMask);
    col = mix(col, block, m);
  }

  // The drawn outline: a bronze edge.
  float edge = smoothstep(0.6, 0.97, abs(vRib.x));
  col = mix(col, col * vec3(0.40, 0.27, 0.15), edge * 0.86);
  gl_FragColor = vec4(col, 1.0);
}
`;

const GROUND_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vWp = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GROUND_FRAG = /* glsl */ `
${GLSL_NOISE}
${GOLD}
uniform sampler2D tShadow;
varying vec3 vWp;
float meadowTop(float x) {
  return 2.3 + 0.22 * sin(x * 0.7 + 0.4) + 0.12 * sin(x * 1.9 + 1.0);
}
void main() {
  vec2 p = vWp.xy;
  vec3 V = normalize(uCam - vWp);
  // Tesserae in rows that waver.
  vec2 q = p * 8.5;
  q.y += 0.35 * sin(p.x * 1.3) + 0.2 * sin(p.x * 3.7 + 1.0);
  float row = floor(q.y);
  q.x += hash11(row) * 7.0;
  vec2 id = vec2(floor(q.x), row);
  vec2 f = fract(q);
  vec3 h = hash23(id);
  // The pixel footprint comes from p: q jumps from row to row.
  float fw = max(fwidth(p.x), fwidth(p.y)) * 8.5;
  // Far away the single tiles fade into their mean tone.
  float detail = 1.0 - smoothstep(0.3, 0.8, fw);
  float grout = smoothstep(0.03, 0.09 + fw, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  float big = fbm(p * 0.33 + 4.0);
  float top = meadowTop(p.x);
  float meadow = smoothstep(top + 0.05, top - 0.05, p.y);

  float t = big + (h.x - 0.5) * 0.45 * detail + (p.y - 6.0) * 0.035;
  vec3 c = mix(vec3(0.89, 0.72, 0.37), vec3(0.96, 0.89, 0.69), smoothstep(0.34, 0.62, t));
  c = mix(c, vec3(0.66, 0.46, 0.19), smoothstep(0.34, 0.18, t) * 0.5);
  vec3 mc = mix(vec3(0.13, 0.25, 0.13), vec3(0.36, 0.43, 0.16), smoothstep(0.3, 0.7, big + (h.x - 0.5) * 0.6 * detail));
  mc = mix(mc, vec3(0.10, 0.30, 0.28), step(0.8, h.y) * 0.8 * detail);
  mc = mix(mc, vec3(0.64, 0.50, 0.17), step(h.y, 0.12) * 0.8 * detail);
  c = mix(c, mc, meadow);

  // Gold tesserae: each has its own tilt, so they flash one after another.
  float isGold = step(0.86, h.z) * (1.0 - 0.55 * meadow);
  vec3 Nt = normalize(vec3((h.xy - 0.5) * 0.55 * detail, 1.0));
  vec3 La = normalize(uL1 - vWp);
  vec3 Lb = normalize(uL2 - vWp);
  float glint = pow(max(dot(Nt, normalize(La + V)), 0.0), 60.0) + 0.6 * pow(max(dot(Nt, normalize(Lb + V)), 0.0), 60.0);
  vec3 gold = mix(vec3(0.74, 0.53, 0.15), vec3(1.0, 0.91, 0.56), clamp(glint * 1.3, 0.0, 1.0));
  c = mix(c, gold, isGold * mix(0.3, 0.86, detail));
  c *= mix(1.0, 0.93 + 0.14 * h.y, detail);
  c += (1.0 - isGold) * glint * 0.05;
  c = mix(c * vec3(0.66, 0.55, 0.40), c, mix(1.0, grout, detail));
  // A gold line closes the meadow.
  c = mix(c, vec3(0.52, 0.34, 0.10), (1.0 - smoothstep(0.03, 0.065, abs(p.y - top))) * 0.85);

  float sh = texture2D(tShadow, (p - vec2(${X0.toFixed(1)}, ${Y0.toFixed(1)})) / vec2(${PANEL_W.toFixed(1)}, ${PANEL_H.toFixed(1)})).r;
  c *= mix(vec3(1.0), vec3(0.46, 0.36, 0.27), sh * 0.66);
  c *= 0.84 + 0.2 * La.z;
  gl_FragColor = vec4(c, 1.0);
}
`;

const INLAY_VERT = /* glsl */ `
attribute vec2 aUv;
attribute vec3 aColA;
attribute vec3 aColB;
attribute vec2 aMeta;
varying vec3 vWp;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vA;
varying vec3 vB;
varying vec2 vMeta;
void main() {
  vWp = position;
  vN = normal;
  vUv = aUv;
  vA = aColA;
  vB = aColB;
  vMeta = aMeta;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const INLAY_FRAG = /* glsl */ `
${GLSL_NOISE}
${GOLD}
varying vec3 vWp;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vA;
varying vec3 vB;
varying vec2 vMeta;
// 1 inside the edge e, with a one-pixel soft step.
float inside(float x, float e) {
  float aa = fwidth(x) * 1.2 + 1e-5;
  return 1.0 - smoothstep(e - aa, e + aa, x);
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vWp);
  float kind = floor(vMeta.x + 0.5);
  float seed = vMeta.y;
  vec3 La = normalize(uL1 - vWp);
  vec3 Lb = normalize(uL2 - vWp);
  float diff = 0.44 + 0.56 * (max(dot(N, La), 0.0) * 0.8 + max(dot(N, Lb), 0.0) * 0.36);
  float spec = pow(max(dot(N, normalize(La + V)), 0.0), 70.0) + 0.5 * pow(max(dot(N, normalize(Lb + V)), 0.0), 70.0);
  vec3 col = vA;
  float gloss = 0.5;
  // Share of the fragment that is gold leaf.
  float metal = 0.0;
  vec3 T = vec3(1.0, 0.0, 0.0);
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);

  if (kind < 0.5) {
    // Glass tile.
    col = vA * (0.86 + 0.26 * vnoise(vUv * 3.0 + seed * 31.0));
    gloss = 0.95;
  } else if (kind < 1.5) {
    // Byzantine disc: rings around a core. The gold is brushed around the centre.
    T = normalize(vec3(-vUv.y, vUv.x, 0.0) + vec3(1e-4, 0.0, 0.0));
    float ticks = 8.0 + floor(seed * 9.0);
    float tick = step(0.5, fract(ang / K_TAU * ticks));
    vec3 bandCol = mix(vA, vA * 0.55 + 0.06, tick);
    if (seed < 0.36) {
      // A gold spiral on the colour.
      float arm = abs(fract(r * 2.6 - ang / K_TAU) - 0.5);
      bandCol = vA;
      metal = (1.0 - smoothstep(0.15, 0.21, arm)) * inside(r, 0.66) * (1.0 - inside(r, 0.2));
    }
    col = vec3(0.05, 0.045, 0.05);
    col = mix(col, bandCol, inside(r, 0.68));
    col = mix(col, vec3(0.93, 0.90, 0.80), inside(r, 0.36));
    col = mix(col, vB, inside(r, 0.25));
    metal = max(metal, 1.0 - inside(r, 0.8));
    gloss = 0.8;
  } else if (kind < 2.5) {
    // Eye triangle: nested bands and an eye.
    T = normalize(vec3(cos(seed * 6.28), sin(seed * 6.28), 0.0));
    float d = min(vUv.y + 0.38, dot(vec2(abs(vUv.x), vUv.y) - vec2(0.58, -0.38), vec2(-0.865, -0.502)));
    col = vA;
    col = mix(col, vec3(0.93, 0.90, 0.80), inside(d, 0.145));
    col = mix(col, vec3(0.05, 0.045, 0.05), inside(d, 0.1));
    metal = max(inside(d, 0.05), 1.0 - inside(d, 0.19));
    vec2 e = vUv - vec2(0.0, -0.085);
    float lid = abs(e.y) / 0.082 + (e.x * e.x) / (0.165 * 0.165);
    float eye = inside(lid, 1.0) * (1.0 - inside(d, 0.19));
    col = mix(col, vec3(0.95, 0.93, 0.86), eye);
    col = mix(col, vB, eye * inside(length(e), 0.062));
    col = mix(col, vec3(0.02), eye * inside(length(e), 0.028));
    metal *= 1.0 - eye;
    // A dark line around the eye.
    col = mix(col, vec3(0.04), (1.0 - inside(d, 0.19)) * inside(lid, 1.28) * (1.0 - inside(lid, 1.0)));
    metal *= 1.0 - (1.0 - inside(d, 0.19)) * inside(lid, 1.28) * (1.0 - inside(lid, 1.0));
    gloss = 0.7;
  } else if (kind < 3.5) {
    // Flower head.
    float petals = 5.0 + floor(seed * 4.0);
    float lobe = 0.80 + 0.17 * cos(ang * petals);
    col = vA * 0.42;
    vec3 petal = vA * (0.78 + 0.3 * smoothstep(0.2, 0.9, r)) * (0.9 + 0.1 * cos(ang * petals * 2.0));
    col = mix(col, vec3(0.96, 0.94, 0.86), inside(r, lobe));
    col = mix(col, petal, inside(r, lobe - 0.09));
    col = mix(col, vec3(0.07, 0.06, 0.05), inside(r, 0.33));
    col = mix(col, vB, inside(r, 0.26));
    gloss = 0.5;
  } else if (kind < 4.5) {
    // Stem or leaf.
    col = vA * (0.82 + 0.3 * abs(vUv.x)) * (0.9 + 0.2 * vnoise(vUv * 4.0 + seed * 9.0));
    gloss = 0.25;
  } else if (kind < 5.5) {
    // Crow: black with a blue sheen, wing feathers, and a ringed eye.
    col = vec3(0.022, 0.022, 0.028);
    vec2 wv = (vUv - vec2(0.2, -0.04)) / vec2(0.34, 0.25);
    float wing = 1.0 - smoothstep(0.75, 1.0, length(wv));
    float feather = abs(fract((vUv.x * 1.1 - vUv.y * 0.9) * 8.0) - 0.5);
    col += vec3(0.05, 0.055, 0.085) * wing * smoothstep(0.34, 0.46, feather);
    float tail = smoothstep(0.42, 0.6, vUv.x) * smoothstep(-0.2, -0.45, vUv.y);
    col += vec3(0.035, 0.04, 0.06) * tail * step(0.5, fract((vUv.x + vUv.y * 0.55) * 14.0));
    col = mix(col, vec3(0.30, 0.24, 0.12), smoothstep(-0.40, -0.47, vUv.x) * step(vUv.x, 2.0));
    float de = length(vUv - vec2(-0.19, 0.405));
    col = mix(col, vec3(0.94, 0.89, 0.72), inside(de, 0.068));
    col = mix(col, vec3(0.02), inside(de, 0.036));
    spec = pow(max(dot(N, normalize(La + V)), 0.0), 36.0) + 0.6 * pow(max(dot(N, normalize(Lb + V)), 0.0), 36.0);
    diff = 0.6 + 0.4 * diff;
    col += spec * vec3(0.05, 0.06, 0.11);
    gloss = 0.0;
  } else if (kind < 6.5) {
    // Frame: brushed along its length, with two dark grooves on the face.
    T = seed < 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    metal = 1.0;
    gloss = 0.7;
  } else {
    // Gold tile.
    T = normalize(vec3(cos(seed * 40.0), sin(seed * 40.0), 0.0));
    metal = 1.0;
    gloss = 1.0;
  }

  col = col * diff + spec * gloss * vec3(1.0, 0.96, 0.86);
  if (metal > 0.001) {
    vec3 g = goldLeaf(vWp, N, T, gloss);
    if (kind > 5.5 && kind < 6.5) {
      float groove = smoothstep(0.08, 0.0, abs(abs(vUv.y) - 0.55)) * step(abs(vUv.y), 1.5);
      g *= vec3(0.62, 0.50, 0.36) * (1.0 - 0.6 * groove);
    }
    col = mix(col, g, metal);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const ROOM_VERT = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
void main() {
  vWp = position;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ROOM_FRAG = /* glsl */ `
${GLSL_NOISE}
varying vec3 vWp;
varying vec3 vN;
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
void main() {
  vec3 col;
  if (vN.z > 0.5) {
    // Dark wall. The gold throws a warm light around the frame.
    float d = sdBox(vWp.xy - vec2(0.0, ${((Y0 + Y1) / 2).toFixed(1)}), vec2(${(PANEL_W / 2 + 0.55).toFixed(2)}, ${(PANEL_H / 2 + 0.55).toFixed(2)}));
    col = vec3(0.105, 0.078, 0.070) * (0.9 + 0.2 * fbm(vWp.xy * 0.8));
    col += vec3(0.30, 0.19, 0.07) * exp(-max(d, 0.0) * 0.42) * 0.55;
    col *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 0.5, d));
  } else {
    // Dark polished floor with the glow of the frieze in it.
    float streak = 0.6 + 0.4 * vnoise(vec2(vWp.x * 1.3, vWp.z * 0.15));
    col = vec3(0.060, 0.047, 0.040) * (0.85 + 0.3 * vnoise(vWp.xz * 2.0));
    col += vec3(0.36, 0.24, 0.08) * exp(-max(vWp.z, 0.0) * 0.16) * 0.42 * streak * (1.0 - smoothstep(14.0, 26.0, abs(vWp.x)));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec3 col = texture2D(tScene, vUv).rgb;

  // The drawn line: dark umber where the relief breaks.
  float edge = smoothstep(0.0016, 0.007, depthEdge(vUv, px * 1.1));
  col = mix(col, col * vec3(0.30, 0.20, 0.12), edge * 0.6);

  // Bright gold glows a little.
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854 + 0.3;
    vec2 o = vec2(cos(a), sin(a)) * px * (i == 1 || i == 3 || i == 5 || i == 7 ? 7.0 : 3.5);
    glow += max(texture2D(tScene, vUv + o).rgb - 0.8, 0.0);
  }
  col += glow * 0.19 * vec3(1.0, 0.86, 0.55);

  // A warm varnish: deep umber darks, honey lights.
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col = mix(col, col * vec3(1.03, 0.97, 0.86) + vec3(0.012, 0.004, 0.0), 0.6);
  col = mix(vec3(lum), col, 1.08);
  col *= 0.95 + 0.07 * canvasWeave(gl_FragCoord.xy / s);
  col *= vignette(vUv, 0.34);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 43.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

function buildRoom(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const X = 80, TOP = 40, DEPTH = 80;
  const pos = [
    -X, 0, WALL_Z, X, 0, WALL_Z, X, TOP, WALL_Z, -X, 0, WALL_Z, X, TOP, WALL_Z, -X, TOP, WALL_Z,
    -X, 0, DEPTH, X, 0, DEPTH, X, 0, WALL_Z, -X, 0, DEPTH, X, 0, WALL_Z, -X, 0, WALL_Z,
  ];
  const nor = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function createTreeOfLife(): PaintingScene {
  const scene = new THREE.Scene();
  // Values are display colours. No colour-space conversion runs on them.
  scene.background = new THREE.Color().setRGB(0.04, 0.032, 0.03);
  const rand = mulberry32(1905);

  const tree = growTree(rand);
  const decor = buildDecor(tree, rand);
  const shadow = bakeShadow(decor.casters);

  const lights = {
    uCam: { value: new THREE.Vector3() },
    uL1: { value: new THREE.Vector3(-8, 15, 13) },
    uL2: { value: new THREE.Vector3(9, 3.5, 9) },
    uTime: { value: 0 },
  };

  const groundGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
  groundGeo.translate((X0 + X1) / 2, (Y0 + Y1) / 2, 0);
  const ground = new THREE.Mesh(groundGeo, new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: { ...lights, tShadow: { value: shadow } } }));
  ground.frustumCulled = false;
  ground.renderOrder = 2;
  scene.add(ground);

  const treeMesh = new THREE.Mesh(buildTreeGeometry(tree.ribbons), new THREE.ShaderMaterial({ vertexShader: TREE_VERT, fragmentShader: TREE_FRAG, uniforms: lights, side: THREE.DoubleSide }));
  treeMesh.frustumCulled = false;
  scene.add(treeMesh);

  const inlays = new THREE.Mesh(decor.geometry, new THREE.ShaderMaterial({ vertexShader: INLAY_VERT, fragmentShader: INLAY_FRAG, uniforms: lights, side: THREE.DoubleSide }));
  inlays.frustumCulled = false;
  inlays.renderOrder = 1;
  scene.add(inlays);

  // Both sides draw, so the wall also closes the view from behind the frieze.
  const room = new THREE.Mesh(buildRoom(), new THREE.ShaderMaterial({ vertexShader: ROOM_VERT, fragmentShader: ROOM_FRAG, side: THREE.DoubleSide }));
  room.frustumCulled = false;
  room.renderOrder = 3;
  scene.add(room);

  const spirals = tree.ribbons.length - 1;
  const crow = decor.crows[0];
  const midY = (Y0 + Y1) / 2;

  return {
    scene,
    meta: {
      title: 'The Tree of Life',
      artist: 'Gustav Klimt · Stoclet Frieze, 1905–09',
      technique: `A grown tree of ${spirals} tangent spirals as half-round ribbons with anisotropic brushed gold leaf, ${decor.counts.tiles + decor.counts.discs + decor.counts.eyes} raised inlays (jewel tiles, Byzantine discs, eye triangles), ${decor.counts.flowers} meadow flowers, baked relief shadow on a tesserae ground.`,
    },
    presets: [
      { name: 'The Painting', position: [0, midY, 19.6], target: [0, midY, 0], fov: 30 },
      { name: 'Gilded Spirals', position: [-7.6, 8.1, 3.4], target: [-3.7, 7.6, 0], fov: 44 },
      { name: "The Crow's Perch", position: [crow.x + 2.3, crow.y - 0.9, 2.5], target: [crow.x - 0.1, crow.y - 0.15, 0.1], fov: 40 },
      { name: 'Along the Frieze', position: [14.6, 4.3, 4.4], target: [1.0, 6.4, 0], fov: 50 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.1,
    far: 400,
    flySpeed: 5,
    maxDistance: 60,
    floorAt: () => 0.3,
    update(ctx: FrameContext): void {
      const t = ctx.time;
      lights.uTime.value = t;
      lights.uCam.value.copy(ctx.camera.position);
      // The lamps sway a little, so the gold is never still.
      lights.uL1.value.set(-8 + 4 * Math.sin(t * 0.21), 15, 13 + 2 * Math.cos(t * 0.17));
      lights.uL2.value.set(9 + 3 * Math.sin(t * 0.13 + 2), 3.5 + Math.sin(t * 0.19), 9);
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      shadow.dispose();
    },
  };
}
