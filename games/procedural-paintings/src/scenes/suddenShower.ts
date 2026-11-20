// Sudden Shower over Shin-Ōhashi Bridge and Atake — Utagawa Hiroshige, 1857.
//
// The bridge is carpentry: an arched plank deck, railings, girders, and
// trestle piers, all built from beams. Travelers, the timber raft, the banks,
// and the misty tree line of Atake go into the same static mesh, so the scene
// is one draw call plus the river, the sky, and the rain. The rain is
// instanced ink lines that keep one width on screen at any depth and fall
// through a box that follows the camera. Materials write a region id in
// alpha. The post pass inks a sumi keyblock line round the hard regions
// (bridge, figures, raft) and leaves the soft regions (sky, river, far bank)
// as plain bokashi tone blocks, then prints on washi paper.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { hex, mix, mix3, mulberry32, noise2, type RGB } from '../util';

const INK = {
  deck: hex(0xd4b56c),
  rail: hex(0xbf9f5c),
  timber: hex(0x62574a),
  skin: hex(0xd8b28c),
  straw: hex(0xdcc98f),
  strawDark: hex(0xb39a5e),
  indigo: hex(0x2c4868),
  slate: hex(0x3a434d),
  rust: hex(0x9a573b),
  moss: hex(0x586a58),
  umbrellaDark: hex(0x2f3a48),
  log: hex(0xc7ab76),
  land: hex(0x7f8884),
  wall: hex(0x6a7476),
  treeFar: hex(0x7b8487),
  treeFarMist: hex(0xa4aaa2),
  treeNear: hex(0x3d464d),
  treeNearMist: hex(0x6e787a),
  waterPale: hex(0x9aabae),
  waterSlate: hex(0x5d778a),
  waterDeep: hex(0x27476b),
  paper: hex(0xcfcab9),
  storm: hex(0x22252b),
};

/** Region ids below this are tone blocks: the keyblock does not outline them. */
const ID = { sky: 0, tree: 0.04, water: 0.06, land: 0.07, timber: 0.45, deck: 0.56, rail: 0.64, log: 0.7, cloth: 0.78, skin: 0.84, straw: 0.92 };

function v3(c: RGB): THREE.Vector3 {
  return new THREE.Vector3(c[0], c[1], c[2]);
}

// ---------------------------------------------------------------------------
// World layout
// ---------------------------------------------------------------------------

const BRIDGE = { halfLength: 100, halfWidth: 3.6, base: 4.6, rise: 4.6 };
const BANK_TOP = 4.4;
const FAR_TOP = 2.2;
/** The banks reach this far from the bridge, past the edge of the river sheet. */
const LAND_REACH = 2304;

function deckY(x: number): number {
  const u = x / BRIDGE.halfLength;
  return BRIDGE.base + BRIDGE.rise * (1 - u * u);
}

/** Waterline of the Atake bank. It runs at a slant, so the horizon of the print tilts. */
function shoreZ(x: number): number {
  return -172 - 0.26 * x + 6 * Math.sin(x * 0.02);
}

function landHeight(x: number, z: number): number {
  if (Math.abs(x) > BRIDGE.halfLength) return BANK_TOP;
  if (z < shoreZ(x)) return FAR_TOP;
  return 0;
}

// ---------------------------------------------------------------------------
// Mesh builder: flat ink colours, three printed tones per solid
// ---------------------------------------------------------------------------

const LIGHT = new THREE.Vector3(0.35, 0.82, 0.45).normalize();

function tone(n: THREE.Vector3): number {
  const d = n.dot(LIGHT);
  return d > 0.4 ? 1 : d > -0.15 ? 0.86 : 0.7;
}

interface VertexStyle {
  /** 0 flat, 1 deck planks, 2 umbrella ribs. */
  kind?: number;
  uv?: Array<[number, number]>;
  /** 1 for parts that drift with the raft. */
  drift?: number;
  /** Per-vertex colours. They replace the face colour. */
  colors?: RGB[];
  /** Skip the three-tone shading. */
  flat?: boolean;
}

class InkBuilder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly id: number[] = [];
  private readonly uv: number[] = [];
  private readonly kind: number[] = [];
  private readonly drift: number[] = [];

  /** A convex polygon as a triangle fan. It winds counter-clockwise seen from outside. */
  poly(points: THREE.Vector3[], color: RGB, id: number, style: VertexStyle = {}): void {
    const n = new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0])).normalize();
    const k = style.flat ? 1 : tone(n);
    for (let i = 1; i < points.length - 1; i++) {
      for (const j of [0, i, i + 1]) {
        const p = points[j];
        const c = style.colors ? style.colors[j] : color;
        this.pos.push(p.x, p.y, p.z);
        this.col.push(c[0] * k, c[1] * k, c[2] * k);
        this.id.push(id);
        const t = style.uv ? style.uv[j] : [0, 0];
        this.uv.push(t[0], t[1]);
        this.kind.push(style.kind ?? 0);
        this.drift.push(style.drift ?? 0);
      }
    }
  }

  /** A tapered prism from a to b. Faces wind outward. */
  prism(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, sides: number, color: RGB, id: number, style: VertexStyle = {}): void {
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const ref = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(ref, dir).normalize();
    const w = new THREE.Vector3().crossVectors(dir, u);
    const ring = (c: THREE.Vector3, r: number): THREE.Vector3[] => {
      const out: THREE.Vector3[] = [];
      for (let j = 0; j < sides; j++) {
        const ang = ((j + 0.5) / sides) * Math.PI * 2;
        out.push(c.clone().addScaledVector(u, Math.cos(ang) * r).addScaledVector(w, Math.sin(ang) * r));
      }
      return out;
    };
    const ra = ring(a, r0), rb = ring(b, r1);
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides;
      this.poly([ra[j], ra[k], rb[k], rb[j]], color, id, style);
    }
    this.poly(rb, color, id, style);
    this.poly([...ra].reverse(), color, id, style);
  }

  /** A square-section timber from a to b: w across, h deep. */
  beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, color: RGB, id: number, style: VertexStyle = {}): void {
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const ref = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(dir, ref).normalize();
    const up = new THREE.Vector3().crossVectors(side, dir);
    const corner = (c: THREE.Vector3, s: number, t: number): THREE.Vector3 => c.clone().addScaledVector(side, s * w * 0.5).addScaledVector(up, t * h * 0.5);
    const a0 = corner(a, -1, -1), a1 = corner(a, 1, -1), a2 = corner(a, 1, 1), a3 = corner(a, -1, 1);
    const b0 = corner(b, -1, -1), b1 = corner(b, 1, -1), b2 = corner(b, 1, 1), b3 = corner(b, -1, 1);
    this.poly([a3, a2, b2, b3], color, id, style);
    this.poly([a1, a0, b0, b1], color, id, style);
    this.poly([a2, a1, b1, b2], color, id, style);
    this.poly([a0, a3, b3, b0], color, id, style);
    this.poly([a0, a1, a2, a3], color, id, style);
    this.poly([b1, b0, b3, b2], color, id, style);
  }

  /** An open cone: umbrellas and straw hats. Rib lines are drawn by the shader. */
  cone(apex: THREE.Vector3, centre: THREE.Vector3, radius: number, sides: number, color: RGB, id: number, drift = 0): void {
    const axis = new THREE.Vector3().subVectors(centre, apex).normalize();
    const ref = Math.abs(axis.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(ref, axis).normalize();
    const w = new THREE.Vector3().crossVectors(axis, u);
    const rim = (j: number): THREE.Vector3 => {
      const ang = (j / sides) * Math.PI * 2;
      return centre.clone().addScaledVector(u, Math.cos(ang) * radius).addScaledVector(w, Math.sin(ang) * radius);
    };
    for (let j = 0; j < sides; j++) {
      this.poly([apex, rim(j), rim(j + 1)], color, id, { kind: 2, uv: [[j + 0.5, 0], [j, radius], [j + 1, radius]], drift, flat: true });
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aId', new THREE.Float32BufferAttribute(this.id, 1));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.kind, 1));
    g.setAttribute('aDrift', new THREE.Float32BufferAttribute(this.drift, 1));
    return g;
  }
}

const P = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

function addBridge(b: InkBuilder): void {
  const L = BRIDGE.halfLength, W = BRIDGE.halfWidth;
  const SEG = 80;
  const xs: number[] = [];
  const arc: number[] = [0];
  for (let i = 0; i <= SEG; i++) xs.push(mix(-L, L, i / SEG));
  for (let i = 1; i <= SEG; i++) arc.push(arc[i - 1] + Math.hypot(xs[i] - xs[i - 1], deckY(xs[i]) - deckY(xs[i - 1])));

  for (let i = 0; i < SEG; i++) {
    const x0 = xs[i], x1 = xs[i + 1];
    const y0 = deckY(x0), y1 = deckY(x1);
    // Plank deck. The shader draws the seams between the boards.
    b.poly([P(x0, y0, W), P(x1, y1, W), P(x1, y1, -W), P(x0, y0, -W)], INK.deck, ID.deck, { kind: 1, uv: [[arc[i], W], [arc[i + 1], W], [arc[i + 1], -W], [arc[i], -W]], flat: true });
    b.poly([P(x0, y0 - 0.3, -W), P(x1, y1 - 0.3, -W), P(x1, y1 - 0.3, W), P(x0, y0 - 0.3, W)], INK.timber, ID.timber);
    for (const s of [-1, 1]) {
      const z = s * W;
      // Fascia board on the edge of the deck, then the three girders below.
      b.beam(P(x0, y0 - 0.12, z), P(x1, y1 - 0.12, z), 0.14, 0.5, INK.rail, ID.rail);
      // Railing: top rail and mid rail.
      const zr = s * (W - 0.18);
      b.beam(P(x0, y0 + 1.08, zr), P(x1, y1 + 1.08, zr), 0.16, 0.14, INK.rail, ID.rail);
      b.beam(P(x0, y0 + 0.56, zr), P(x1, y1 + 0.56, zr), 0.1, 0.1, INK.rail, ID.rail);
    }
    for (const z of [-2.5, 0, 2.5]) b.beam(P(x0, y0 - 0.62, z), P(x1, y1 - 0.62, z), 0.46, 0.6, INK.timber, ID.timber);
  }
  // Railing posts.
  for (let i = 0; i <= SEG; i++) {
    const x = xs[i], y = deckY(x);
    for (const s of [-1, 1]) {
      const z = s * (W - 0.18);
      b.beam(P(x, y, z), P(x, y + (i % 4 === 0 ? 1.34 : 1.12), z), i % 4 === 0 ? 0.24 : 0.14, i % 4 === 0 ? 0.24 : 0.14, INK.rail, ID.rail);
    }
  }
  // Trestle piers: four splayed posts, a cap beam, two ties, and a cross brace.
  for (let x = -84; x <= 84.01; x += 14) {
    const cap = deckY(x) - 1.2;
    b.beam(P(x, cap, -4.3), P(x, cap, 4.3), 0.56, 0.56, INK.timber, ID.timber);
    for (const z of [-3.3, -1.1, 1.1, 3.3]) b.prism(P(x, -2, z * 1.22), P(x, cap - 0.2, z), 0.3, 0.26, 7, INK.timber, ID.timber);
    const mid = mix(1.2, cap, 0.52);
    b.beam(P(x - 0.34, 1.2, -4.5), P(x - 0.34, 1.2, 4.5), 0.2, 0.34, INK.timber, ID.timber);
    b.beam(P(x - 0.34, mid, -4.2), P(x - 0.34, mid, 4.2), 0.2, 0.34, INK.timber, ID.timber);
    b.beam(P(x + 0.34, 1.3, -4.0), P(x + 0.34, cap - 0.5, 3.4), 0.16, 0.26, INK.timber, ID.timber);
    b.beam(P(x + 0.52, 1.3, 4.0), P(x + 0.52, cap - 0.5, -3.4), 0.16, 0.26, INK.timber, ID.timber);
  }
}

// ---------------------------------------------------------------------------
// Travelers and the raft
// ---------------------------------------------------------------------------

interface Traveler {
  x: number;
  z: number;
  /** +1 walks toward +x, -1 toward -x. */
  heading: 1 | -1;
  robe: RGB;
  cover: 'umbrella' | 'darkUmbrella' | 'hat' | 'none';
  /** Forward lean, radians. */
  lean: number;
  scale: number;
}

function addTraveler(b: InkBuilder, t: Traveler, ground: number, drift = 0): void {
  const s = t.scale;
  const at = (fwd: number, up: number, side = 0): THREE.Vector3 => P(t.x + t.heading * fwd * s, ground + up * s, t.z + side * s);
  const style: VertexStyle = { drift };
  const hip = at(0, 0.78);
  const shoulder = at(0.62 * Math.sin(t.lean), 0.78 + 0.62 * Math.cos(t.lean));
  // Bare legs in mid stride, robe tucked up out of the wet.
  b.prism(at(0.3, 0), at(0.06, 0.8, 0.09), 0.055, 0.085, 5, INK.skin, ID.skin, style);
  b.prism(at(-0.28, 0), at(-0.04, 0.8, -0.09), 0.055, 0.085, 5, INK.skin, ID.skin, style);
  b.prism(at(-0.02, 0.5), hip.clone().lerp(shoulder, 0.25), 0.3, 0.25, 7, t.robe, ID.cloth, style);
  b.prism(hip.clone().lerp(shoulder, 0.2), shoulder, 0.25, 0.2, 7, mix3(t.robe, [1, 1, 1], 0.08), ID.cloth, style);
  const head = shoulder.clone().add(P(t.heading * 0.1 * s, 0.17 * s, 0));
  b.prism(head.clone().add(P(0, -0.1 * s, 0)), head.clone().add(P(0, 0.11 * s, 0)), 0.1 * s, 0.1 * s, 6, INK.skin, ID.skin, style);
  if (t.cover === 'hat') {
    const apex = head.clone().add(P(t.heading * 0.02 * s, 0.3 * s, 0));
    b.cone(apex, apex.clone().add(P(t.heading * 0.07 * s, -0.2 * s, 0)), 0.46 * s, 12, INK.straw, ID.straw, drift);
  } else if (t.cover !== 'none') {
    // The umbrella leans into the rain. Its shaft runs down to the hands.
    const apex = head.clone().add(P(t.heading * 0.2 * s, 0.62 * s, 0));
    const colour = t.cover === 'umbrella' ? INK.straw : INK.umbrellaDark;
    b.cone(apex, apex.clone().add(P(t.heading * 0.12 * s, -0.3 * s, 0.02)), 0.92 * s, 14, colour, t.cover === 'umbrella' ? ID.straw : ID.straw - 0.06, drift);
    b.beam(shoulder.clone().add(P(t.heading * 0.26 * s, -0.2 * s, 0.1 * s)), apex, 0.035, 0.035, INK.timber, ID.timber, style);
    b.prism(shoulder.clone().add(P(0, -0.08 * s, 0.12 * s)), shoulder.clone().add(P(t.heading * 0.28 * s, -0.18 * s, 0.1 * s)), 0.07, 0.06, 5, t.robe, ID.cloth, style);
  }
}

const RAFT = { x: -30, z: -62, heading: 0.42 };

function addRaft(b: InkBuilder): void {
  const cs = Math.cos(RAFT.heading), sn = Math.sin(RAFT.heading);
  const at = (along: number, y: number, across: number): THREE.Vector3 => P(RAFT.x + along * cs - across * sn, y, RAFT.z + along * sn + across * cs);
  const style: VertexStyle = { drift: 1 };
  // Two rafts of logs lashed end to end.
  for (const [start, count, len] of [[-11, 7, 11], [1, 6, 10]] as Array<[number, number, number]>) {
    for (let i = 0; i < count; i++) {
      const across = (i - (count - 1) / 2) * 0.52;
      const stagger = ((i * 7) % 5) * 0.22;
      b.prism(at(start - stagger, 0.12, across), at(start + len + stagger * 0.6, 0.12, across), 0.25, 0.22, 6, mix3(INK.log, INK.strawDark, (i % 3) * 0.3), ID.log, style);
    }
    for (const k of [0.18, 0.82]) b.beam(at(start + len * k, 0.4, -2.1), at(start + len * k, 0.4, 2.1), 0.16, 0.12, INK.timber, ID.timber, style);
  }
  // The raftsman: straw cape, sedge hat, and a long pole.
  const foot = at(9.2, 0.36, 0.4);
  const shoulder = foot.clone().add(P(0.18 * cs, 1.32, 0.18 * sn));
  b.prism(foot.clone().add(P(0, 0.05, 0)), foot.clone().add(P(0, 0.72, 0)), 0.14, 0.2, 6, INK.indigo, ID.cloth, style);
  b.prism(foot.clone().add(P(0, 0.6, 0)), shoulder, 0.46, 0.2, 8, INK.strawDark, ID.straw - 0.05, style);
  const apex = shoulder.clone().add(P(0.06 * cs, 0.42, 0.06 * sn));
  b.prism(shoulder, shoulder.clone().add(P(0.03, 0.2, 0)), 0.1, 0.1, 6, INK.skin, ID.skin, style);
  b.cone(apex, apex.clone().add(P(0.05 * cs, -0.2, 0.05 * sn)), 0.5, 12, INK.straw, ID.straw, 1);
  b.beam(at(5.4, 3.5, 0.9), at(13.6, -1.2, 0.1), 0.07, 0.07, INK.timber, ID.timber, style);
}

// ---------------------------------------------------------------------------
// Banks and the tree line of Atake
// ---------------------------------------------------------------------------

/** Silhouette height along a shore: pine crowns, a few boathouse roofs. */
function skyline(length: number, seed: number, low: number, tall: number): Float32Array {
  const STEP = 0.5;
  const n = Math.ceil(length / STEP) + 1;
  const h = new Float32Array(n).fill(low);
  const rand = mulberry32(seed);
  for (let s = rand() * 4; s < length; ) {
    const w = 3 + rand() * 6.5;
    const top = low + tall * (0.3 + 0.7 * rand() * rand());
    const flat = 0.08 + rand() * 0.3;
    for (let i = Math.max(0, Math.floor((s - w) / STEP)); i <= Math.min(n - 1, Math.ceil((s + w) / STEP)); i++) {
      const d = Math.abs(i * STEP - s) / w;
      if (d >= 1) continue;
      // Pine crowns are flat-topped pads with rounded shoulders.
      const crown = d < flat ? 1 : Math.pow(1 - Math.pow((d - flat) / (1 - flat), 2.2), 0.5);
      h[i] = Math.max(h[i], low + (top - low) * crown);
    }
    s += w * (0.45 + rand() * 1.2);
  }
  for (let s = 20 + rand() * 60; s < length - 20; s += 70 + rand() * 120) {
    const w = 5 + rand() * 5, ridge = low + 2.6 + rand() * 2.4;
    for (let i = Math.max(0, Math.floor((s - w) / STEP)); i <= Math.min(n - 1, Math.ceil((s + w) / STEP)); i++) {
      const d = Math.abs(i * STEP - s) / w;
      h[i] = Math.max(h[i], ridge - Math.max(d - 0.25, 0) * 3.4);
    }
  }
  for (let i = 0; i < n; i++) h[i] += (noise2(i * 0.9 + seed, 3.1) - 0.5) * 0.9 + (noise2(i * 0.21, seed) - 0.5) * 1.4;
  return h;
}

/** A vertical cut-out that follows a path on the ground. Dark at the crown, mist at the foot. */
function addTreeLine(b: InkBuilder, path: (s: number) => [number, number, number], length: number, seed: number, low: number, tall: number, top: RGB, mist: RGB): void {
  const h = skyline(length, seed, low, tall);
  for (let i = 0; i < h.length - 1; i++) {
    const p0 = path(i * 0.5), p1 = path((i + 1) * 0.5);
    b.poly(
      [P(p0[0], p0[1], p0[2]), P(p1[0], p1[1], p1[2]), P(p1[0], p1[1] + h[i + 1], p1[2]), P(p0[0], p0[1] + h[i], p0[2])],
      top, ID.tree,
      { flat: true, colors: [mist, mist, mix3(mist, top, Math.min(h[i + 1] / 9, 1)), mix3(mist, top, Math.min(h[i] / 9, 1))] },
    );
  }
}

function addBanks(b: InkBuilder): void {
  const L = BRIDGE.halfLength;
  const land: VertexStyle = { flat: true };
  // The Atake bank: a low shelf behind the slanted waterline.
  const STEP = 16;
  for (let x = -LAND_REACH; x < LAND_REACH; x += STEP) {
    const za = shoreZ(x), zb = shoreZ(x + STEP);
    b.poly([P(x, FAR_TOP, za), P(x + STEP, FAR_TOP, zb), P(x + STEP, FAR_TOP, -LAND_REACH), P(x, FAR_TOP, -LAND_REACH)], INK.land, ID.land, land);
    b.poly([P(x, -0.5, za), P(x + STEP, -0.5, zb), P(x + STEP, FAR_TOP, zb), P(x, FAR_TOP, za)], INK.wall, ID.land, land);
  }
  // The embankments where the bridge lands.
  for (const s of [-1, 1]) {
    const x0 = s * L, x1 = s * LAND_REACH;
    b.poly([P(x0, BANK_TOP, LAND_REACH), P(x1, BANK_TOP, LAND_REACH), P(x1, BANK_TOP, -LAND_REACH), P(x0, BANK_TOP, -LAND_REACH)], INK.land, ID.land, land);
    b.poly([P(x0, -0.5, LAND_REACH), P(x0, BANK_TOP, LAND_REACH), P(x0, BANK_TOP, -LAND_REACH), P(x0, -0.5, -LAND_REACH)], INK.wall, ID.land, land);
    // Trees and sheds along each embankment, with a gap for the bridge road.
    for (const [from, to, seed] of [[9, 700, 11], [-9, shoreZ(s * L) - 40, 23]] as Array<[number, number, number]>) {
      const len = Math.abs(to - from);
      const dir = Math.sign(to - from);
      // The lines weave, so no view along the bank sees them edge-on.
      addTreeLine(b, (d) => [s * (L + 4 + 9 * (1 + Math.sin(d * 0.045 + seed))), BANK_TOP, from + dir * d], len, seed + s * 3, 2.2, 10, INK.treeNear, INK.treeNearMist);
      addTreeLine(b, (d) => [s * (L + 38 + 12 * (1 + Math.sin(d * 0.03 + seed * 2))), BANK_TOP, from + dir * d], len, seed + s * 5 + 40, 5, 14, INK.treeFar, INK.treeFarMist);
    }
  }
  // Atake: a dark line of pines and boathouses, and a paler line behind it.
  const span = 1800;
  addTreeLine(b, (d) => [d - 900, FAR_TOP, shoreZ(d - 900) - 1.5], span, 1857, 2.4, 12, INK.treeNear, INK.treeNearMist);
  addTreeLine(b, (d) => [d - 900, FAR_TOP, shoreZ(d - 900) - 34], span, 97, 6, 15, INK.treeFar, INK.treeFarMist);
  // Two more lines inland, each paler: the town fades into the rain.
  addTreeLine(b, (d) => [d - 900, FAR_TOP, shoreZ(d - 900) - 95], span, 411, 7, 16, mix3(INK.treeFar, INK.land, 0.45), mix3(INK.treeFarMist, INK.land, 0.6));
  addTreeLine(b, (d) => [d - 900, FAR_TOP, shoreZ(d - 900) - 190], span, 733, 8, 18, mix3(INK.treeFar, INK.land, 0.7), mix3(INK.treeFarMist, INK.land, 0.8));
}

function buildStatic(): THREE.BufferGeometry {
  const b = new InkBuilder();
  addBridge(b);
  const travelers: Traveler[] = [
    { x: 9.5, z: 0.5, heading: -1, robe: INK.indigo, cover: 'darkUmbrella', lean: 0.3, scale: 1.22 },
    { x: 8.6, z: 1.3, heading: -1, robe: INK.rust, cover: 'none', lean: 0.34, scale: 1.16 },
    { x: 19.5, z: -0.9, heading: 1, robe: INK.slate, cover: 'hat', lean: 0.55, scale: 1.2 },
    { x: 28.2, z: 1.2, heading: 1, robe: INK.moss, cover: 'umbrella', lean: 0.36, scale: 1.24 },
    { x: 29.3, z: 0.3, heading: 1, robe: INK.indigo, cover: 'none', lean: 0.42, scale: 1.18 },
    { x: 32.6, z: -0.8, heading: 1, robe: INK.rust, cover: 'hat', lean: 0.5, scale: 1.2 },
    { x: -18, z: -1.4, heading: -1, robe: INK.slate, cover: 'umbrella', lean: 0.3, scale: 1.2 },
    { x: -52, z: 0.8, heading: 1, robe: INK.indigo, cover: 'hat', lean: 0.48, scale: 1.2 },
  ];
  for (const t of travelers) addTraveler(b, t, deckY(t.x));
  addRaft(b);
  addBanks(b);
  return b.build();
}

const STATIC_VERT = /* glsl */ `
attribute vec3 color;
attribute float aId;
attribute vec2 aUv;
attribute float aKind;
attribute float aDrift;
uniform float uTime;
uniform vec2 uDriftDir;
varying vec3 vCol;
varying float vId;
varying vec2 vUv;
varying float vKind;
void main() {
  vCol = color; vId = aId; vUv = aUv; vKind = aKind;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  // The raft slides down the river and rocks on the swell.
  wp.xz += aDrift * uDriftDir * 5.0 * sin(uTime * 0.07);
  wp.y += aDrift * 0.05 * sin(uTime * 1.1);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const STATIC_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vId;
varying vec2 vUv;
varying float vKind;
${GLSL_NOISE}
void main() {
  vec3 col = vCol;
  if (vKind > 0.5 && vKind < 1.5) {
    // Deck boards run across the bridge. Each board takes its own tone.
    float u = vUv.x / 0.46;
    float board = floor(u);
    float aa = fwidth(u) * 1.2 + 1e-4;
    float seam = 1.0 - smoothstep(0.05 - aa, 0.05 + aa, abs(fract(u) - 0.5) * -1.0 + 0.5);
    col *= 0.93 + 0.12 * hash11(board + 3.0);
    col = mix(col, col * 0.58, seam * (1.0 - smoothstep(0.25, 0.6, aa)));
    // Wet wheel ruts down the middle of the deck.
    col *= 1.0 - 0.1 * smoothstep(1.6, 0.4, abs(abs(vUv.y) - 1.1));
  } else if (vKind > 1.5) {
    // Umbrella ribs.
    float u = fract(vUv.x);
    float d = min(u, 1.0 - u) * vUv.y;
    float aa = fwidth(d) + 1e-4;
    col = mix(col * 0.55, col, smoothstep(0.016 - aa, 0.016 + aa, d));
    col *= 1.0 - 0.25 * smoothstep(0.75, 1.0, vUv.y / 0.92) * step(0.6, vUv.y);
  }
  gl_FragColor = vec4(col, vId);
}
`;

// ---------------------------------------------------------------------------
// River and sky
// ---------------------------------------------------------------------------

const WATER_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uPale;
uniform vec3 uSlate;
uniform vec3 uDeep;
uniform float uId;
varying vec3 vWp;
${GLSL_NOISE}
float shoreZ(float x) { return -172.0 - 0.26 * x + 6.0 * sin(x * 0.02); }
void main() {
  vec2 p = vWp.xz;
  float toShore = p.y - shoreZ(p.x);
  // Bokashi: deep Prussian blue wiped along the far bank, slate at the foot of the print.
  float wipe = toShore + 16.0 * (vnoise(p * 0.02) - 0.5);
  float band = 1.0 - smoothstep(2.0, 78.0, wipe);
  vec3 col = mix(uPale, uSlate, smoothstep(-40.0, 95.0, p.y + 10.0 * vnoise(p * 0.015 + 9.0)) * 0.85);
  col = mix(col, uDeep, band * 0.92);
  // Rain-beaten water: short pale dashes that drift with the current.
  vec2 q = vec2(p.x * 0.16 + uTime * 0.05, p.y * 0.9);
  float row = floor(q.y);
  float dash = vnoise(vec2(q.x + hash11(row) * 40.0, row * 0.37));
  float aa = fwidth(q.y) * 1.5;
  float lineY = 1.0 - smoothstep(0.1, 0.1 + aa + 0.02, abs(fract(q.y) - 0.5));
  float mark = lineY * smoothstep(0.62, 0.7, dash) * (1.0 - smoothstep(0.3, 0.9, aa));
  col = mix(col, mix(col, uPale, 0.5) * 1.05, mark * 0.4);
  gl_FragColor = vec4(col, uId);
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
uniform vec3 uStorm;
uniform vec3 uLand;
varying vec3 vDir;
${GLSL_NOISE}
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0)) * 57.2958;
  // The storm: sumi wiped across the top of the block with a wet brush. Its
  // lower edge is ragged and streaked.
  float edge = 2.7 + 2.2 * vnoise(vec2(az * 3.1, 0.7)) + 0.9 * vnoise(vec2(az * 11.0, 4.0));
  float streak = vnoise(vec2(az * 46.0, el * 0.5 + 3.0)) - 0.5;
  float storm = smoothstep(edge, edge + 5.0, el + streak * 1.8);
  vec3 col = mix(uPaper, uStorm, storm * 0.96);
  // A faint grey veil of rain under the cloud.
  col = mix(col, uPaper * 0.9, (1.0 - storm) * smoothstep(-1.0, 3.0, el) * 0.5);
  col = mix(col, uLand, 1.0 - smoothstep(-1.5, -0.1, el));
  gl_FragColor = vec4(col, 0.0);
}
`;

// ---------------------------------------------------------------------------
// Rain
// ---------------------------------------------------------------------------

const RAIN = { count: 3800, box: new THREE.Vector3(150, 90, 150), speed: 21 };

const RAIN_VERT = /* glsl */ `
attribute vec3 aBase;
attribute vec4 aRain;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uBox;
uniform vec3 uDirA;
uniform vec3 uDirB;
uniform float uSpeed;
uniform float uAspect;
uniform float uWidth;
varying float vAlong;
varying float vTone;
void main() {
  // Two families of lines at two slants, as the two rain blocks print them.
  vec3 dir = aRain.y < 0.5 ? uDirA : uDirB;
  vec3 c = aBase + dir * uTime * uSpeed * (0.8 + 0.4 * aRain.z);
  // The rain box follows the camera. A streak wraps as one piece.
  c = mod(c - uCam + 0.5 * uBox, uBox) - 0.5 * uBox + uCam;
  vec4 c0 = projectionMatrix * viewMatrix * vec4(c - dir * aRain.x * 0.5, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(c + dir * aRain.x * 0.5, 1.0);
  vAlong = position.y;
  vTone = aRain.w;
  if (c0.w < 0.3 || c1.w < 0.3) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  // One line width on screen at any depth.
  vec2 d = (c1.xy / c1.w - c0.xy / c0.w) * vec2(uAspect, 1.0);
  vec2 n = normalize(vec2(-d.y, d.x) + vec2(1e-6, 0.0));
  n.x /= uAspect;
  vec4 cp = mix(c0, c1, position.y);
  cp.xy += n * position.x * uWidth * (0.8 + 0.5 * aRain.z) * cp.w;
  gl_Position = cp;
}
`;

const RAIN_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uSilver;
varying float vAlong;
varying float vTone;
void main() {
  float fade = smoothstep(0.0, 0.18, vAlong) * smoothstep(1.0, 0.82, vAlong);
  float silver = step(0.72, vTone);
  gl_FragColor = vec4(mix(uInk, uSilver, silver), fade * mix(0.5, 0.42, silver));
}
`;

function buildRain(time: THREE.IUniform<number>): THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> {
  const rand = mulberry32(57);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const base = new Float32Array(RAIN.count * 3);
  const rain = new Float32Array(RAIN.count * 4);
  for (let i = 0; i < RAIN.count; i++) {
    base[i * 3] = rand() * RAIN.box.x;
    base[i * 3 + 1] = rand() * RAIN.box.y;
    base[i * 3 + 2] = rand() * RAIN.box.z;
    rain[i * 4] = 16 + rand() * 30;
    rain[i * 4 + 1] = rand() < 0.6 ? 0 : 1;
    rain[i * 4 + 2] = rand();
    rain[i * 4 + 3] = rand();
  }
  g.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
  g.setAttribute('aRain', new THREE.InstancedBufferAttribute(rain, 4));
  g.instanceCount = RAIN.count;
  const material = new THREE.ShaderMaterial({
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms: {
      uTime: time,
      uCam: { value: new THREE.Vector3() },
      uBox: { value: RAIN.box },
      uDirA: { value: new THREE.Vector3(-0.2, -1, 0.05).normalize() },
      uDirB: { value: new THREE.Vector3(-0.36, -1, -0.04).normalize() },
      uSpeed: { value: RAIN.speed },
      uAspect: { value: 1 },
      uWidth: { value: 0.003 },
      uInk: { value: new THREE.Vector3(0.15, 0.18, 0.23) },
      uSilver: { value: new THREE.Vector3(0.8, 0.83, 0.84) },
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    // The rain inks colour only: the region id in alpha stays as the scene wrote it.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

// ---------------------------------------------------------------------------
// Post: sumi keyblock lines on the hard regions, washi paper
// ---------------------------------------------------------------------------

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  vec4 c = texture2D(tScene, vUv);
  float wob = 0.85 + 0.5 * vnoise(cv * 0.05);
  vec2 o = px * 1.1 * wob;
  float e = 0.0; float hard = c.a;
  float a;
  a = texture2D(tScene, vUv + vec2(o.x, 0.0)).a; e = max(e, abs(a - c.a)); hard = max(hard, a);
  a = texture2D(tScene, vUv - vec2(o.x, 0.0)).a; e = max(e, abs(a - c.a)); hard = max(hard, a);
  a = texture2D(tScene, vUv + vec2(0.0, o.y)).a; e = max(e, abs(a - c.a)); hard = max(hard, a);
  a = texture2D(tScene, vUv - vec2(0.0, o.y)).a; e = max(e, abs(a - c.a)); hard = max(hard, a);
  a = texture2D(tScene, vUv + o * 0.7).a; e = max(e, abs(a - c.a)); hard = max(hard, a);
  a = texture2D(tScene, vUv - o * 0.7).a; e = max(e, abs(a - c.a)); hard = max(hard, a);
  // Tone blocks (sky, river, far bank) carry no keyblock line.
  float keyed = smoothstep(0.1, 0.2, hard);
  float line = smoothstep(0.02, 0.05, e) * keyed;
  line = max(line, smoothstep(0.012, 0.035, depthEdge(vUv, o)) * smoothstep(0.1, 0.2, c.a));
  vec3 ink = vec3(0.09, 0.1, 0.13);
  vec3 col = mix(c.rgb, ink, line * 0.92);

  // Pigment sits unevenly: baren pressure and wood grain.
  float baren = vnoise(cv * 0.035) * 0.6 + vnoise(cv * 0.011 + 7.0) * 0.4;
  float grain = vnoise(vec2(cv.x * 0.02, cv.y * 1.3));
  col *= 0.94 + 0.08 * baren + 0.03 * grain;
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

export function createSuddenShower(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 2600;
  const time: THREE.IUniform<number> = { value: 0 };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uPaper: { value: v3(INK.paper) }, uStorm: { value: v3(INK.storm) }, uLand: { value: v3(INK.land) } },
      side: THREE.BackSide,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const waterGeo = new THREE.PlaneGeometry(4400, 4400);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: { uTime: time, uPale: { value: v3(INK.waterPale) }, uSlate: { value: v3(INK.waterSlate) }, uDeep: { value: v3(INK.waterDeep) }, uId: { value: ID.water } },
    }),
  );
  water.frustumCulled = false;
  scene.add(water);

  const stage = new THREE.Mesh(
    buildStatic(),
    new THREE.ShaderMaterial({
      vertexShader: STATIC_VERT,
      fragmentShader: STATIC_FRAG,
      uniforms: { uTime: time, uDriftDir: { value: new THREE.Vector2(Math.cos(RAFT.heading), Math.sin(RAFT.heading)) } },
      side: THREE.DoubleSide,
    }),
  );
  stage.frustumCulled = false;
  scene.add(stage);

  const rain = buildRain(time);
  scene.add(rain);

  return {
    scene,
    meta: {
      title: 'Sudden Shower over Shin-Ōhashi Bridge and Atake',
      artist: 'Utagawa Hiroshige · 1857',
      technique: 'Beam-built arched timber bridge and travelers in one mesh, bokashi river and storm sky, instanced constant-width ink rain, keyblock lines on hard regions only, washi paper.',
    },
    presets: [
      { name: 'The Painting', position: [40, 20, 26], target: [2, 7.6, -14], fov: 50 },
      { name: 'On the Bridge', position: [63, deckY(63) + 1.75, 1.6], target: [32, deckY(32) + 1.1, -0.4], fov: 56 },
      { name: 'From the Raft', position: [-36, 2.6, -74], target: [-14, 6.5, 0], fov: 52 },
      { name: 'Above the Sumida', position: [-62, 40, 96], target: [10, 4, -30], fov: 44 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.2,
    far,
    flySpeed: 14,
    maxDistance: 280,
    floorAt: (x, z) => landHeight(x, z) + 0.6,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      const u = rain.material.uniforms;
      (u.uCam.value as THREE.Vector3).copy(ctx.camera.position);
      u.uAspect.value = ctx.width / ctx.height;
      // About 1.4 pixels at 760 lines, in clip units. A small canvas takes a thinner line.
      u.uWidth.value = (2 * 1.4 * Math.max(ctx.height / 760, 0.75)) / ctx.height;
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
