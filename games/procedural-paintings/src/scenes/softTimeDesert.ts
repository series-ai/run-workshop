// Meridian of Salt and Brass — an original surrealist study.
//
// A low sun rakes a cracked salt plaza above a glass-calm bay. The limestone
// archway and the ruined milestone are distance fields, eroded with noise and
// meshed once at load time. Three soft instruments hang on the stone: a bronze
// astrolabe and a ring-dial pour over the arch ledge, and a pocket chronometer
// lies over the milestone. Each one is a flat dial grid that a drape function
// bends over its support, so the engraved graduations stretch with the metal.
// The dials are drawn in the shader from circles, ticks, and line segments and
// stay crisp at any distance. Shadows are analytic: every fragment casts one
// ray toward the sun against the arch outline, the steps of the sunken dais,
// and a short list of boxes and capsules, so the shadow edges are razor sharp.
// The sea stacks are drawn twice, once mirrored below the bay.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { bakeOcclusion, bakeSun, meshSdf, type Field } from '../sdf';
import { fbm2, fbm3, noise3, smoothstep, type RGB } from '../util';

const SUN = new THREE.Vector3(-0.8, 0.36, -0.42).normalize();
const BAY_Y = -2.2;
const EDGE_Z = -13;
const PLAZA = { halfX: 150, zFront: 80 };

/** Sunken sundial dais: three risers go down to the dial floor. */
const DAIS = { x: 0.6, z: 3.4, radii: [3.1, 2.6, 2.1], step: 0.16 };
const DAIS_FLOOR = -DAIS.step * DAIS.radii.length;

/** Archway, in its own frame: x across the opening, y up, z through the opening. */
const ARCH = { x: 7.4, z: -2.5, yaw: -0.927, halfW: 3.35, height: 6.9, halfD: 0.7, open: 1.65, spring: 4.36, ledgeTop: 7.25, ledgeHalfW: 3.6, ledgeHalfD: 0.95 };
const ARCH_M = new THREE.Matrix4().makeRotationY(ARCH.yaw).setPosition(ARCH.x, 0, ARCH.z);
const ARCH_INV = ARCH_M.clone().invert();

/** Ruined milestone, in its own frame: a slab with a round head. */
const STONE = { x: 4.4, z: 9.0, yaw: -0.927, lean: 0.085, halfW: 0.42, halfD: 0.2, headY: 1.0 };
const STONE_M = new THREE.Matrix4().makeRotationY(STONE.yaw).multiply(new THREE.Matrix4().makeRotationZ(STONE.lean)).setPosition(STONE.x, 0, STONE.z);
const STONE_INV = STONE_M.clone().invert();

/** Tuning fork, in its own frame: the stem and the prongs run along +y. */
const FORK = { stemTop: 2.07, yoke: 2.6, gap: 0.55, prong: 5.4, side: 0.15 };
const FORK_M = ((): THREE.Matrix4 => {
  const y = new THREE.Vector3(2.2, 7.4, -1.0).normalize();
  // The prongs stand side by side across the sun direction, so that each one casts its own shadow.
  const want = new THREE.Vector3().crossVectors(SUN, y);
  const x = want.addScaledVector(y, -want.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(-7.5, 0, 0.5);
})();
const SOCKET = { half: new THREE.Vector3(0.7, 0.26, 0.7), yaw: 0.35 };

const M_SALT = 0, M_STONE = 1, M_DAIS = 2, M_DIAL = 3, M_BRASS = 4, M_FORK = 5, M_DARK = 6;
// Shadow groups. A surface does not test the proxies of its own group.
const G_NONE = 0, G_ARCH = 1, G_FORK = 2, G_STONE = 3, G_STYLE = 4;

type V3 = [number, number, number];

// ---------------------------------------------------------------------------
// Mesh builder: collects every part into one geometry (one draw call).
// ---------------------------------------------------------------------------

class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly dat: number[] = [];
  private readonly mat: number[] = [];
  private readonly grp: number[] = [];

  /** One vertex. The payload carries albedo, baked light, or dial coordinates. */
  vertex(p: THREE.Vector3, n: THREE.Vector3, d: RGB, m: number, group: number): void {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.dat.push(d[0], d[1], d[2]);
    this.mat.push(m);
    this.grp.push(group);
  }

  /** Triangle with vertex normals. The winding follows the normals. */
  tri(p: THREE.Vector3[], n: THREE.Vector3[], d: RGB[], m: number, group: number): void {
    const face = new THREE.Vector3().subVectors(p[1], p[0]).cross(new THREE.Vector3().subVectors(p[2], p[0]));
    const order = face.dot(n[0]) + face.dot(n[1]) + face.dot(n[2]) >= 0 ? [0, 1, 2] : [0, 2, 1];
    for (const i of order) this.vertex(p[i], n[i], d[i], m, group);
  }

  /**
   * Adds a geometry with its normals and disposes it. `local` places the part
   * in the frame of its object and `world` places the object in the scene.
   * With `keepLocal`, the payload is the position in the object frame.
   */
  add(g: THREE.BufferGeometry, local: THREE.Matrix4 | null, world: THREE.Matrix4 | null, payload: RGB, m: number, group: number, keepLocal = false): void {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    if (!n) throw new Error('MeshBuilder.add received a geometry without normals');
    const full = new THREE.Matrix4();
    if (world) full.copy(world);
    if (local) full.multiply(local);
    const nm = new THREE.Matrix3().getNormalMatrix(full);
    for (let i = 0; i < p.count; i++) {
      const at = new THREE.Vector3().fromBufferAttribute(p, i);
      if (local) at.applyMatrix4(local);
      const d: RGB = keepLocal ? [at.x, at.y, at.z] : payload;
      if (world) at.applyMatrix4(world);
      this.vertex(at, new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(nm).normalize(), d, m, group);
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aDat', new THREE.Float32BufferAttribute(this.dat, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute('aGroup', new THREE.Float32BufferAttribute(this.grp, 1));
    return g;
  }
}

// ---------------------------------------------------------------------------
// Distance fields of the stone
// ---------------------------------------------------------------------------

function sdBox(x: number, y: number, z: number, hx: number, hy: number, hz: number): number {
  const dx = Math.abs(x) - hx, dy = Math.abs(y) - hy, dz = Math.abs(z) - hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dy, dz), 0);
}

/** Clean masonry of the archway. The foot goes below the floor. */
const archSolid: Field = (x, y, z) => {
  const wall = sdBox(x, y - (ARCH.height / 2 - 0.2), z, ARCH.halfW, ARCH.height / 2 + 0.2, ARCH.halfD);
  const crown = Math.hypot(x, y - ARCH.spring) - ARCH.open;
  const opening = Math.min(Math.max(Math.abs(x) - ARCH.open, y - ARCH.spring), crown);
  let d = Math.max(wall, -opening);
  // Archivolt: the ring of voussoirs stands a little proud of the wall.
  d = Math.min(d, Math.max(Math.abs(crown - 0.53) - 0.53, ARCH.spring - y, Math.abs(z) - 0.8));
  const pier = (ARCH.halfW + ARCH.open) / 2;
  for (const s of [-1, 1]) {
    d = Math.min(d, sdBox(x - s * pier, y - (ARCH.spring - 0.16), z, 0.95, 0.16, 0.83));
    d = Math.min(d, sdBox(x - s * pier, y - 0.05, z, 0.96, 0.45, 0.85));
  }
  d = Math.min(d, sdBox(x, y - (ARCH.ledgeTop - 0.175), z, ARCH.ledgeHalfW, 0.175, ARCH.ledgeHalfD));
  return d;
};

/** Weathered archway: wind erosion, two broken corners. */
const archField: Field = (x, y, z) => {
  let d = archSolid(x, y, z);
  if (Math.abs(d) > 0.3) return d;
  d += 0.085 * (fbm3(x * 1.1 + 3, y * 1.1, z * 1.1 + 8, 3) - 0.42);
  d += 0.2 * Math.max(fbm3(x * 0.5 + 20, y * 0.5 + 4, z * 0.9, 2) - 0.6, 0);
  d = Math.max(d, 0.78 - Math.hypot(x - 3.8, y - 7.4, z - 0.4));
  d = Math.max(d, 0.5 - Math.hypot(x + 3.55, y - 2.3, z - 0.8));
  return d;
};

/** Clean form of the milestone: a slab with a round head. */
const stoneSolid: Field = (x, y, z) => {
  const body = sdBox(x, y - 0.35, z, STONE.halfW, 0.65, STONE.halfD);
  const head = Math.max(Math.hypot(x, y - STONE.headY) - STONE.halfW, Math.abs(z) - STONE.halfD);
  return Math.min(body, head);
};

/** Ruined milestone: a split shoulder, a chipped foot, pitted faces. */
const stoneField: Field = (x, y, z) => {
  let d = stoneSolid(x, y, z);
  if (Math.abs(d) > 0.15) return d;
  d += 0.035 * (fbm3(x * 3.4 + 5, y * 3.4, z * 3.4 + 2, 3) - 0.42);
  d = Math.max(d, 0.3 - Math.hypot(x + 0.56, y - 0.5, z - 0.22));
  d = Math.max(d, 0.2 - Math.hypot(x - 0.47, y - 0.08, z + 0.2));
  return d;
};

/** Moves a point out of a stone field until it is `gap` clear of the surface. */
function settle(p: THREE.Vector3, field: Field, toLocal: THREE.Matrix4, toWorld: THREE.Matrix4, gap: number): void {
  const l = p.clone().applyMatrix4(toLocal);
  const e = 0.01;
  for (let i = 0; i < 8; i++) {
    const d = field(l.x, l.y, l.z);
    if (d >= gap) break;
    const g = new THREE.Vector3(
      field(l.x + e, l.y, l.z) - field(l.x - e, l.y, l.z),
      field(l.x, l.y + e, l.z) - field(l.x, l.y - e, l.z),
      field(l.x, l.y, l.z + e) - field(l.x, l.y, l.z - e),
    );
    if (g.lengthSq() < 1e-12) throw new Error('settle() met a flat field gradient');
    l.addScaledVector(g.normalize(), gap - d + 0.002);
  }
  p.copy(l).applyMatrix4(toWorld);
}

/** Meshes a stone field and bakes its occlusion and its own sun shadow into the payload. */
function addStone(b: MeshBuilder, field: Field, solid: Field, min: V3, max: V3, cell: number, world: THREE.Matrix4, group: number, sunReach: number): void {
  const mesh = meshSdf(field, { min, max, cell, bound: (x, y, z) => solid(x, y, z) - 0.25 });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const occlusion = bakeOcclusion(field, p.array, n.array, cell * 1.6);
  // The baked sun shadow is for large forms only. Small forms keep the analytic shadow.
  const sunLocal = SUN.clone().transformDirection(world.clone().invert());
  const lit = sunReach > 0 ? bakeSun(field, p.array, n.array, sunLocal, sunReach) : null;
  const index = g.getIndex();
  if (!index) throw new Error('The stone mesh lost its index');
  const nm = new THREE.Matrix3().getNormalMatrix(world);
  const at = (i: number): { p: THREE.Vector3; n: THREE.Vector3; d: RGB } => ({
    p: new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(world),
    n: new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(nm).normalize(),
    d: [occlusion[i], lit ? lit[i] : 1, 0],
  });
  for (let i = 0; i < index.count; i += 3) {
    const v = [at(index.getX(i)), at(index.getX(i + 1)), at(index.getX(i + 2))];
    for (const k of v) b.vertex(k.p, k.n, k.d, M_STONE, group);
  }
  g.dispose();
}

// ---------------------------------------------------------------------------
// Soft instruments
// ---------------------------------------------------------------------------

/** Maps a point of the flat dial (u, v in the unit disc, the top of the dial at +v) to the draped mid-surface. */
type Drape = (u: number, v: number) => THREE.Vector3;

interface SoftPart {
  drape: Drape;
  thickness: number;
  /** Inner radius of the flat dial. Zero gives a disc, more gives an annulus. */
  inner: number;
  /** Which dial the shader draws on the outward side. */
  dial: number;
  group: number;
  /** Moves a mid-surface point out of its support. */
  clear: (p: THREE.Vector3) => void;
}

/** A sheet that lies flat, turns over an edge with radius rho, then hangs and stretches. Returns [reach past the edge, drop]. */
function pour(s: number, rho: number, stretch: number): [number, number] {
  if (s <= 0) return [s, 0];
  const quarter = rho * Math.PI * 0.5;
  if (s < quarter) return [rho * Math.sin(s / rho), rho * (Math.cos(s / rho) - 1)];
  const hang = s - quarter;
  // The metal thins as it runs: the lower part stretches more than the upper part.
  return [rho, -rho - hang * stretch * (1 + 0.22 * hang)];
}

/**
 * Builds one soft instrument as a thin shell. The outward side is the side
 * where the dial reads the right way round: its normal is dP/du x dP/dv.
 */
function softDisc(b: MeshBuilder, part: SoftPart): void {
  const RINGS = 20, SEGS = 72, e = 0.004;
  interface Node { top: THREE.Vector3; bottom: THREE.Vector3; n: THREE.Vector3; nb: THREE.Vector3; front: RGB; back: RGB }
  const node = (ring: number, seg: number): Node => {
    const r = part.inner + ((1 - part.inner) * ring) / RINGS, a = (seg / SEGS) * Math.PI * 2;
    const u = Math.sin(a) * r, v = Math.cos(a) * r;
    const p = part.drape(u, v);
    const du = part.drape(u + e, v).sub(part.drape(u - e, v));
    const dv = part.drape(u, v + e).sub(part.drape(u, v - e));
    const n = du.cross(dv).normalize();
    part.clear(p);
    // The case swells into a rounded rim at each edge.
    const rim = Math.max(smoothstep(0.8, 0.94, r), part.inner > 0 ? smoothstep(part.inner + 0.1, part.inner + 0.03, r) : 0);
    const edge = Math.max(smoothstep(0.95, 1, r), part.inner > 0 ? smoothstep(part.inner + 0.02, part.inner, r) : 0);
    const t = part.thickness * (0.55 + 0.45 * rim) * (1 - 0.6 * edge);
    return {
      top: p.clone().addScaledVector(n, t / 2), bottom: p.clone().addScaledVector(n, -t / 2),
      n, nb: n.clone().negate(), front: [u, v, 1 + part.dial], back: [u, v, 0],
    };
  };
  const grid: Node[][] = [];
  for (let ring = 0; ring <= RINGS; ring++) {
    const row: Node[] = [];
    for (let seg = 0; seg < SEGS; seg++) row.push(node(ring, seg));
    grid.push(row);
  }
  for (let ring = 0; ring < RINGS; ring++) {
    for (let seg = 0; seg < SEGS; seg++) {
      const a = grid[ring][seg], c = grid[ring][(seg + 1) % SEGS], d = grid[ring + 1][seg], f = grid[ring + 1][(seg + 1) % SEGS];
      b.tri([d.top, f.top, c.top], [d.n, f.n, c.n], [d.front, f.front, c.front], M_DIAL, part.group);
      b.tri([d.bottom, f.bottom, c.bottom], [d.nb, f.nb, c.nb], [d.back, f.back, c.back], M_DIAL, part.group);
      // The innermost ring of a disc is a fan: its second triangle has no area.
      if (ring > 0 || part.inner > 0) {
        b.tri([a.top, d.top, c.top], [a.n, d.n, c.n], [a.front, d.front, c.front], M_DIAL, part.group);
        b.tri([a.bottom, d.bottom, c.bottom], [a.nb, d.nb, c.nb], [a.back, d.back, c.back], M_DIAL, part.group);
      }
    }
  }
  // Edge of the case, and the inner edge of an annulus.
  const edges: Array<[number, number]> = part.inner > 0 ? [[RINGS, RINGS - 1], [0, 1]] : [[RINGS, RINGS - 1]];
  for (const [ring, inside] of edges) {
    for (let seg = 0; seg < SEGS; seg++) {
      const a = grid[ring][seg], c = grid[ring][(seg + 1) % SEGS];
      const na = a.top.clone().sub(grid[inside][seg].top).normalize();
      const nc = c.top.clone().sub(grid[inside][(seg + 1) % SEGS].top).normalize();
      b.tri([a.top, c.top, c.bottom], [na, nc, nc], [a.back, c.back, c.back], M_DIAL, part.group);
      b.tri([a.top, c.bottom, a.bottom], [na, nc, na], [a.back, c.back, a.back], M_DIAL, part.group);
    }
  }
}

/** Drape over the front edge of the arch ledge, in the arch frame. The top of the dial lies on the ledge. */
function ledgeDrape(xAt: number, radius: number, rest: number, stretch: number, tongue: number, seed: number): Drape {
  const rho = 0.1;
  return (u, v) => {
    const s = (rest - v) * radius;
    const middle = (1 - u * u) * (1 - u * u);
    const [reach, drop] = pour(s, rho, stretch + tongue * middle);
    const hang = Math.max(-drop - rho, 0);
    // The hanging part necks in, sways, and curls a little.
    const neck = 1 - 0.1 * smoothstep(0.2, 1.8, hang);
    const sway = 0.1 * hang * hang * Math.sin(seed);
    const curl = 0.05 * Math.sin(u * 4 + hang * 3 + seed) * smoothstep(0.15, 0.8, hang);
    return new THREE.Vector3(xAt + u * radius * neck + sway, ARCH.ledgeTop + 0.035 + drop, ARCH.ledgeHalfD + 0.02 + reach + curl).applyMatrix4(ARCH_M);
  };
}

/** Drape across the round head of the milestone, in the stone frame. A long flap hangs on the front, a short one on the back. */
function headDrape(radius: number): Drape {
  const rho = 0.05, r0 = STONE.halfW + 0.035, rest = 0.62;
  return (u, v) => {
    const sigma = (rest - v) * radius;
    const phi = ((u * radius) / r0) * 0.9;
    const s = Math.abs(sigma) - STONE.halfD;
    const [reach, drop] = pour(s, rho, 1.15 + 0.5 * (1 - u * u));
    const side = sigma >= 0 ? 1 : -1;
    const z = s <= 0 ? sigma : side * (STONE.halfD + reach + 0.012);
    const ripple = 0.02 * Math.sin(u * 6 + drop * 9) * smoothstep(0.1, 0.4, -drop);
    return new THREE.Vector3(Math.sin(phi) * r0, STONE.headY + Math.cos(phi) * r0 + drop, z + side * ripple).applyMatrix4(STONE_M);
  };
}

// ---------------------------------------------------------------------------
// Shadow proxies
// ---------------------------------------------------------------------------

interface CapsuleProxy { a: THREE.Vector3; b: THREE.Vector3; r: number; group: number }
interface BoxProxy { m: THREE.Matrix4; half: THREE.Vector3; group: number }

function glVec3(v: THREE.Vector3): string {
  return `vec3(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;
}

function glFloat(v: number): string {
  return v.toFixed(4);
}

/** GLSL: visibility of the sun from a point. */
function shadowGlsl(capsules: CapsuleProxy[], boxes: BoxProxy[]): string {
  const boxLines = boxes.map((bx) => {
    const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
    bx.m.extractBasis(x, y, z);
    const c = new THREE.Vector3().setFromMatrixPosition(bx.m);
    return `if (skip != ${bx.group}) vis = min(vis, pastBox(p, ${glVec3(c)}, ${glVec3(x)}, ${glVec3(y)}, ${glVec3(z)}, ${glVec3(bx.half)}));`;
  });
  const capLines = capsules.map((c) => `if (skip != ${c.group}) vis = min(vis, pastCapsule(p, ${glVec3(c.a)}, ${glVec3(c.b)}, ${glFloat(c.r)}));`);
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  ARCH_M.extractBasis(ax, ay, az);
  const risers = DAIS.radii.map((r, k) => `if (p.y < ${glFloat(-DAIS.step * k - 0.002)}) vis = min(vis, insideRim(q, run, ${glFloat(-DAIS.step * k)} - p.y, ${glFloat(r)}));`);
  return /* glsl */ `
// Closest approach of the sun ray to the axis of a capsule.
float pastCapsule(vec3 ro, vec3 a, vec3 b, float r) {
  vec3 ba = b - a;
  vec3 oa = ro - a;
  float baba = dot(ba, ba), bad = dot(ba, uSun);
  float s = clamp((dot(oa, ba) - dot(oa, uSun) * bad) / (baba - bad * bad), 0.0, 1.0);
  float t = max(dot(a + ba * s - ro, uSun), 0.0);
  // One more pass makes the pair of closest points exact at the ends.
  s = clamp(dot(ro + uSun * t - a, ba) / baba, 0.0, 1.0);
  vec3 q = a + ba * s;
  t = max(dot(q - ro, uSun), 0.0);
  float d = length(q - ro - uSun * t) - r;
  float w = min(fwidth(d), 0.2) * 0.75 + 0.002 * t + 1e-4;
  return smoothstep(-w, w, d);
}
// Slab test against an oriented box. The axes are unit vectors in world space.
float pastBox(vec3 ro, vec3 c, vec3 ax, vec3 ay, vec3 az, vec3 h) {
  vec3 v = ro - c;
  vec3 lo = vec3(dot(v, ax), dot(v, ay), dot(v, az));
  vec3 ld = vec3(dot(uSun, ax), dot(uSun, ay), dot(uSun, az));
  vec3 t1 = (-h - lo) / ld;
  vec3 t2 = (h - lo) / ld;
  vec3 lower = min(t1, t2);
  vec3 upper = max(t1, t2);
  float tN = max(max(lower.x, lower.y), max(lower.z, 0.0));
  float span = min(upper.x, min(upper.y, upper.z)) - tN;
  float w = min(fwidth(span), 0.3) * 0.75 + 0.002 * tN + 1e-4;
  return 1.0 - smoothstep(-w, w, span);
}
// Outline of the arch opening in the arch frame: a rectangle under a half circle.
float archOpening(vec2 q) {
  return min(max(abs(q.x) - ${glFloat(ARCH.open)}, q.y - ${glFloat(ARCH.spring)}), length(q - vec2(0.0, ${glFloat(ARCH.spring)})) - ${glFloat(ARCH.open)});
}
// The arch wall is a slab with a convex opening. The part of the sun ray that
// is in the slab is clear only when its two ends are in the opening.
float pastArch(vec3 ro) {
  vec3 v = ro - ${glVec3(new THREE.Vector3(ARCH.x, 0, ARCH.z))};
  vec3 lo = vec3(dot(v, ${glVec3(ax)}), v.y - ${glFloat(ARCH.height / 2)}, dot(v, ${glVec3(az)}));
  vec3 ld = vec3(dot(uSun, ${glVec3(ax)}), uSun.y, dot(uSun, ${glVec3(az)}));
  vec3 h = vec3(${glFloat(ARCH.halfW)}, ${glFloat(ARCH.height / 2)}, ${glFloat(ARCH.halfD)});
  vec3 t1 = (-h - lo) / ld;
  vec3 t2 = (h - lo) / ld;
  vec3 lower = min(t1, t2);
  vec3 upper = max(t1, t2);
  float tN = max(max(lower.x, lower.y), max(lower.z, 0.0));
  float tF = min(upper.x, min(upper.y, upper.z));
  float span = tF - tN;
  vec2 lift = vec2(0.0, ${glFloat(ARCH.height / 2)});
  float stone = max(archOpening(lo.xy + ld.xy * tN + lift), archOpening(lo.xy + ld.xy * tF + lift));
  float ws = min(fwidth(span), 0.3) * 0.75 + 1e-4;
  float wo = min(fwidth(stone), 0.3) * 0.75 + 0.002 * tN + 1e-4;
  return 1.0 - smoothstep(-ws, ws, span) * smoothstep(-wo, wo, stone);
}
// One riser of the sunken dais. The ray is clear when it is inside the rim at the height of the tread above.
float insideRim(vec2 q, vec2 run, float rise, float radius) {
  float d = length(q + run * rise) - radius;
  float w = min(fwidth(d), 0.2) * 0.75 + 1e-4;
  return 1.0 - smoothstep(-w, w, d);
}
float sunVisible(vec3 p, int skip) {
  float vis = 1.0;
  if (skip != ${G_ARCH}) vis = min(vis, pastArch(p));
  ${boxLines.join('\n  ')}
  ${capLines.join('\n  ')}
  vec2 q = p.xz - vec2(${glFloat(DAIS.x)}, ${glFloat(DAIS.z)});
  vec2 run = uSun.xz / uSun.y;
  ${risers.join('\n  ')}
  return vis;
}
`;
}

// ---------------------------------------------------------------------------
// Shaders. Lit colour is stored square-root encoded.
// ---------------------------------------------------------------------------

const SKY = /* glsl */ `
uniform vec3 uSun;
// Clear low-sun sky: cream at the horizon, aqua above it, ultramarine overhead. d.y must not be negative.
vec3 skyGradient(vec3 d) {
  float el = asin(clamp(d.y, 0.0, 1.0));
  vec3 col = mix(vec3(0.99, 0.87, 0.64), vec3(0.84, 0.85, 0.73), smoothstep(0.0, 0.11, el));
  col = mix(col, vec3(0.44, 0.67, 0.80), smoothstep(0.07, 0.30, el));
  col = mix(col, vec3(0.14, 0.34, 0.66), smoothstep(0.24, 0.70, el));
  col = mix(col, vec3(0.05, 0.15, 0.42), smoothstep(0.6, 1.4, el));
  float toSun = max(dot(d, uSun), 0.0);
  return col + vec3(0.55, 0.38, 0.14) * pow(toSun, 8.0) * 0.5;
}
`;

const HAZE = /* glsl */ `
uniform vec3 uCam;
vec3 warmAir(vec3 col, vec3 wp, float density) {
  float f = 1.0 - exp(-length(wp - uCam) * density);
  return mix(col, vec3(0.86, 0.72, 0.5), clamp(f, 0.0, 1.0) * 0.82);
}
`;

const WORLD_VERT = /* glsl */ `
attribute vec3 aDat;
attribute float aMat;
attribute float aGroup;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vDat;
varying float vMat;
varying float vGroup;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normal;
  vDat = aDat;
  vMat = aMat;
  vGroup = aGroup;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

function worldFrag(capsules: CapsuleProxy[], boxes: BoxProxy[]): string {
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  ARCH_M.extractBasis(ax, ay, az);
  const fz = new THREE.Vector3();
  FORK_M.extractBasis(new THREE.Vector3(), new THREE.Vector3(), fz);
  const dialR = DAIS.radii[DAIS.radii.length - 1];
  return /* glsl */ `
uniform float uTime;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vDat;
varying float vMat;
varying float vGroup;
${GLSL_NOISE}
${SKY}
${HAZE}
${shadowGlsl(capsules, boxes)}

float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// Ink coverage of a shape with signed distance d, antialiased over aa.
float ink(float d, float aa) {
  return 1.0 - smoothstep(-aa, aa, d);
}
// Arc distance to the nearest of n radial tick lines.
float tickD(float ang, float n, float r) {
  return abs(fract(ang / K_TAU * n + 0.5) - 0.5) * K_TAU / n * r;
}

// Salt crust: polygon plates. Returns x = distance to the nearest crack,
// y = tone of the plate, zw = direction toward that crack.
vec4 saltPlates(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + hash23(n + g).xy - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  md = 8.0;
  vec2 dir = vec2(1.0, 0.0);
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + hash23(n + g).xy - f;
      vec2 across = r - mr;
      if (dot(across, across) > 1e-5) {
        vec2 e = normalize(across);
        float d = dot(0.5 * (mr + r), e);
        if (d < md) { md = d; dir = e; }
      }
    }
  }
  return vec4(md, hash21(n + mg), dir);
}

// Bronze astrolabe: limb scale, a plate of nested circles, a pierced star map that turns, a sighting rule.
vec3 astrolabe(vec2 uv, out float gloss) {
  float r = length(uv);
  float aa = fwidth(r) * 1.1 + 1e-4;
  float ang = atan(uv.x, uv.y);
  vec3 dark = vec3(0.05, 0.032, 0.016);
  vec3 col = vec3(0.47, 0.30, 0.11) * (0.88 + 0.24 * vnoise(uv * 24.0));
  float cut = max(ink(abs(r - 0.86) - 0.005, aa), ink(abs(r - 0.975) - 0.004, aa));
  // Limb: degrees in ones, fives, and fifteens. The finest ticks fade when the eye is far.
  float band = step(0.86, r) * step(r, 0.975);
  cut = max(cut, ink(tickD(ang, 24.0, r) - 0.007, aa) * band);
  cut = max(cut, ink(tickD(ang, 72.0, r) - 0.004, aa) * band * step(0.9, r));
  cut = max(cut, ink(tickD(ang, 360.0, r) - 0.002, aa) * band * step(0.94, r) * (1.0 - smoothstep(0.0015, 0.005, aa)));
  if (r < 0.86) {
    // Plate: the tropics and the equator, then the circles of equal altitude that close on the zenith.
    cut = max(cut, ink(abs(r - 0.80) - 0.003, aa));
    cut = max(cut, ink(abs(r - 0.56) - 0.003, aa));
    cut = max(cut, ink(abs(r - 0.39) - 0.003, aa));
    vec2 hc = vec2(0.0, 0.06);
    float horizon = length(uv - hc) - 0.60;
    for (int k = 0; k < 6; k++) {
      float fk = float(k);
      cut = max(cut, ink(abs(length(uv - vec2(0.0, 0.06 + 0.062 * fk)) - (0.60 - 0.092 * fk)) - 0.003, aa));
    }
    // Arcs of equal azimuth: circles through the zenith, drawn only above the horizon.
    for (int k = 0; k < 4; k++) {
      float off = 0.3 + 0.42 * float(k);
      float arc = abs(length(vec2(abs(uv.x) - off, uv.y - 0.43)) - off) - 0.0025;
      cut = max(cut, ink(arc, aa) * step(horizon, 0.0));
    }
    cut = max(cut, ink(abs(uv.x) - 0.003, aa));
    cut = max(cut, ink(abs(uv.y) - 0.003, aa));
  }
  col = mix(col, dark, cut * 0.9);

  // Star map: an offset ring, an outer ring, a strap, and nine flame pointers. It turns slowly.
  float ta = uTime * 0.045;
  vec2 q = vec2(cos(ta) * uv.x - sin(ta) * uv.y, sin(ta) * uv.x + cos(ta) * uv.y);
  float web = ink(abs(length(q - vec2(0.0, 0.21)) - 0.50) - 0.03, aa);
  web = max(web, ink(abs(length(q) - 0.80) - 0.013, aa));
  web = max(web, ink(abs(q.y + 0.08) - 0.015, aa) * step(length(q), 0.80));
  web = max(web, ink(abs(q.x) - 0.012, aa) * step(length(q), 0.80) * step(q.y, 0.71));
  for (int i = 0; i < 9; i++) {
    vec3 h = hash23(vec2(float(i) * 3.7, 11.0));
    float a = h.x * K_TAU;
    vec2 root = vec2(sin(a), cos(a)) * mix(0.3, 0.72, h.y);
    vec2 tipv = vec2(sin(a + 1.3 + h.z), cos(a + 1.3 + h.z)) * 0.12;
    float t = clamp(dot(q - root, tipv) / dot(tipv, tipv), 0.0, 1.0);
    web = max(web, ink(length(q - root - tipv * t) - 0.024 * (1.0 - t), aa));
  }
  col = mix(col, vec3(0.97, 0.76, 0.33) * (0.93 + 0.1 * vnoise(q * 60.0)), web);
  float scale = ink(tickD(atan(q.x, q.y - 0.21), 48.0, 0.5) - 0.003, aa) * ink(abs(length(q - vec2(0.0, 0.21)) - 0.512) - 0.012, aa);
  col = mix(col, dark, scale * 0.8);

  // Sighting rule across the centre, and the pin that holds the parts.
  float tb = 0.6 - uTime * 0.02;
  vec2 da = vec2(sin(tb), cos(tb));
  float along = dot(uv, da);
  float across = dot(uv, vec2(-da.y, da.x));
  float rule = ink(max(abs(across) - 0.032 * (1.0 - 0.65 * smoothstep(0.55, 0.93, abs(along))), abs(along) - 0.93), aa);
  col = mix(col, vec3(0.80, 0.62, 0.30), rule);
  col = mix(col, dark, rule * ink(abs(across) - 0.003, aa) * 0.7);
  col = mix(col, vec3(0.95, 0.8, 0.45), ink(r - 0.05, aa));
  col = mix(col, dark, ink(abs(r - 0.05) - 0.004, aa) * 0.7);
  gloss = 0.5 + 0.35 * max(web, rule);
  return col;
}

// Brass ring-dial: lathe-turned band, hours and quarters, punched dots.
vec3 ringDial(vec2 uv, out float gloss) {
  float r = length(uv);
  float aa = fwidth(r) * 1.1 + 1e-4;
  float ang = atan(uv.x, uv.y);
  vec3 dark = vec3(0.10, 0.07, 0.03);
  vec3 col = vec3(0.82, 0.63, 0.26) * (0.93 + 0.12 * vnoise(vec2(ang * 30.0, r * 90.0)));
  float cut = max(ink(abs(r - 0.69) - 0.006, aa), ink(abs(r - 0.955) - 0.006, aa));
  cut = max(cut, ink(abs(r - 0.80) - 0.004, aa));
  cut = max(cut, ink(tickD(ang, 24.0, r) - 0.008, aa) * step(0.80, r) * step(r, 0.955));
  cut = max(cut, ink(tickD(ang, 96.0, r) - 0.004, aa) * step(0.89, r) * step(r, 0.955));
  // One punched dot for each third hour.
  float seat = floor(ang / (K_TAU / 8.0) + 0.5) * (K_TAU / 8.0);
  cut = max(cut, ink(length(uv - vec2(sin(seat), cos(seat)) * 0.745) - 0.02, aa));
  col = mix(col, dark, cut * 0.85);
  gloss = 0.8;
  return col;
}

// Pocket chronometer: enamel dial, railway minute track, batons, small seconds, a reserve arc, blued hands.
vec3 chronometer(vec2 uv, out float gloss, out float metal) {
  float r = length(uv);
  float aa = fwidth(r) * 1.1 + 1e-4;
  float ang = atan(uv.x, uv.y);
  vec3 dark = vec3(0.07, 0.07, 0.10);
  vec3 col = mix(vec3(0.96, 0.94, 0.87), vec3(0.86, 0.85, 0.80), smoothstep(0.2, 0.86, r));
  float cut = max(ink(abs(r - 0.80) - 0.003, aa), ink(abs(r - 0.845) - 0.003, aa));
  cut = max(cut, ink(tickD(ang, 60.0, r) - 0.004, aa) * step(0.80, r) * step(r, 0.845));
  // Batons at the hours. Twelve has two.
  float hour = floor(ang / (K_TAU / 12.0) + 0.5);
  float ha = hour * K_TAU / 12.0;
  vec2 q = vec2(cos(ha) * uv.x - sin(ha) * uv.y, sin(ha) * uv.x + cos(ha) * uv.y);
  float twelve = step(abs(hour), 0.5);
  float baton = max(abs(abs(q.x) - 0.03 * twelve) - 0.017, abs(q.y - 0.68) - 0.075);
  cut = max(cut, ink(baton, aa) * step(0.5, abs(hour - 6.0)) * step(0.5, abs(hour + 6.0)));

  // Small seconds at six.
  vec2 sc = uv - vec2(0.0, -0.42);
  float sr = length(sc);
  float sang = atan(sc.x, sc.y);
  col = mix(col, vec3(0.90, 0.89, 0.84), ink(sr - 0.215, aa));
  cut = max(cut, ink(abs(sr - 0.215) - 0.003, aa));
  cut = max(cut, ink(tickD(sang, 12.0, sr) - 0.005, aa) * step(0.165, sr) * step(sr, 0.215));
  cut = max(cut, ink(tickD(sang, 60.0, sr) - 0.002, aa) * step(0.19, sr) * step(sr, 0.215) * (1.0 - smoothstep(0.002, 0.006, aa)));
  // Reserve arc at twelve.
  vec2 rc = uv - vec2(0.0, 0.40);
  float rr = length(rc);
  float rang = atan(rc.x, rc.y);
  float sector = step(abs(rang), 1.15);
  cut = max(cut, ink(abs(rr - 0.17) - 0.003, aa) * sector);
  cut = max(cut, ink(tickD(rang, 16.0, rr) - 0.004, aa) * sector * step(0.135, rr) * step(rr, 0.17));
  col = mix(col, dark, cut);

  // Hands of blued steel. The watch keeps its own slow time.
  float tm = uTime * 0.03 + 1.9;
  vec3 blue = vec3(0.07, 0.13, 0.36);
  vec2 hm = vec2(sin(tm), cos(tm));
  vec2 hh = vec2(sin(tm / 12.0 + 4.1), cos(tm / 12.0 + 4.1));
  float tmin = clamp(dot(uv, hm) / 0.74, 0.0, 1.0);
  float thr = clamp(dot(uv, hh) / 0.47, 0.0, 1.0);
  float hands = min(length(uv - hm * 0.74 * tmin) - 0.02 * (1.0 - 0.75 * tmin), length(uv - hh * 0.47 * thr) - 0.03 * (1.0 - 0.6 * thr));
  float ts = uTime * 0.7;
  hands = min(hands, segD(sc, vec2(0.0), vec2(sin(ts), cos(ts)) * 0.18) - 0.006);
  hands = min(hands, segD(rc, vec2(0.0), vec2(sin(0.5), cos(0.5)) * 0.15) - 0.006);
  float handInk = ink(hands, aa);
  col = mix(col, blue, handInk);
  col = mix(col, vec3(0.85, 0.66, 0.28), ink(r - 0.04, aa));
  gloss = 0.55;
  metal = handInk * 0.6;
  // Gold case with a coin edge.
  float rim = smoothstep(0.875, 0.885, r);
  vec3 gold = mix(vec3(0.60, 0.40, 0.11), vec3(0.95, 0.75, 0.30), smoothstep(0.885, 0.95, r) * (1.0 - smoothstep(0.965, 1.0, r)));
  gold *= 0.9 + 0.1 * step(0.5, fract(ang / K_TAU * 90.0)) * step(0.955, r);
  col = mix(col, gold, rim);
  gloss = mix(gloss, 0.85, rim);
  metal = max(metal, rim);
  return col;
}

// Limestone: bedded, pitted, warm.
vec3 limestone(vec3 p) {
  float bed = fbm3(vec3(p.x * 0.5, p.y * 2.6, p.z * 0.5));
  vec3 c = mix(vec3(0.58, 0.50, 0.38), vec3(0.76, 0.70, 0.57), smoothstep(0.3, 0.72, bed));
  return c * (0.9 + 0.16 * vnoise3(p * 9.0));
}

void main() {
  vec3 p = vWp;
  vec3 n = normalize(vN);
  vec3 V = normalize(uCam - p);
  int m = int(vMat + 0.5);
  int group = int(vGroup + 0.5);
  vec3 albedo = vec3(0.8);
  float gloss = 0.0;
  float metal = 0.0;
  float occlusion = 1.0;
  float baked = 1.0;
  float film = 0.0;

  if (m == ${M_SALT}) {
    // Cracked salt crust: pale plates, a raised lip at each crack, a dark hairline in it.
    vec2 x = p.xz * 0.92 + 0.35 * vec2(vnoise(p.xz * 0.6), vnoise(p.xz * 0.6 + 13.0));
    vec4 s = saltPlates(x);
    float fe = max(fwidth(s.x), 1e-4);
    float fine = clamp(0.022 / fe, 0.0, 1.0);
    float crack = (1.0 - smoothstep(-fe, fe, s.x - 0.008)) * fine;
    float h1 = smoothstep(0.07, 0.025, s.x + 0.006) * smoothstep(0.0, 0.012, s.x + 0.006);
    float h0 = smoothstep(0.07, 0.025, s.x - 0.006) * smoothstep(0.0, 0.012, s.x - 0.006);
    float slope = (h1 - h0) / 0.012;
    n = normalize(vec3(s.z * slope * 0.004 * fine, 1.0, s.w * slope * 0.004 * fine));
    albedo = vec3(0.93, 0.90, 0.83) * (0.955 + 0.06 * s.y * fine);
    albedo *= 0.92 + 0.13 * fbm(p.xz * 0.21);
    albedo *= 0.985 + 0.03 * vnoise(p.xz * 7.0);
    albedo = mix(albedo, vec3(0.99, 0.975, 0.94), smoothstep(0.06, 0.02, s.x) * 0.35 * fine);
    albedo = mix(albedo, vec3(0.50, 0.43, 0.36), crack * 0.8);
    // A thin film of brine lies in the low places and shows the sky.
    film = smoothstep(0.56, 0.7, fbm(p.xz * 0.075 + 4.0)) * (1.0 - crack);
  } else if (m == ${M_STONE}) {
    albedo = limestone(p);
    occlusion = vDat.x;
    baked = vDat.y;
    // Grain of the weathered face: it shows under the raking sun.
    vec3 gq = p * 14.0;
    float g0 = vnoise3(gq);
    n = normalize(n - 0.22 * (vec3(vnoise3(gq + vec3(0.6, 0.0, 0.0)), vnoise3(gq + vec3(0.0, 0.6, 0.0)), vnoise3(gq + vec3(0.0, 0.0, 0.6))) - g0));
    albedo *= 0.8 + 0.2 * occlusion;
    if (group == ${G_ARCH}) {
      // Masonry joints of the archway: courses, staggered heads, and the radial joints of the voussoirs.
      vec3 o = p - ${glVec3(new THREE.Vector3(ARCH.x, 0, ARCH.z))};
      vec3 l = vec3(dot(o, ${glVec3(ax)}), o.y, dot(o, ${glVec3(az)}));
      float facing = abs(dot(n, ${glVec3(az)}));
      float aa = fwidth(l.y) + fwidth(l.x) + 1e-4;
      float course = (0.5 - abs(fract(l.y / 0.58) - 0.5)) * 0.58;
      float joint = ink(course - 0.012, aa);
      vec2 c = l.xy - vec2(0.0, ${glFloat(ARCH.spring)});
      float rr = length(c);
      if (facing > 0.6) {
        float head = (0.5 - abs(fract(l.x / 1.06 + 0.5 * mod(floor(l.y / 0.58), 2.0)) - 0.5)) * 1.06;
        joint = max(joint, ink(head - 0.012, aa));
        if (c.y > 0.0 && rr < ${glFloat(ARCH.open + 1.07)}) {
          float wedge = (0.5 - abs(fract(atan(c.y, c.x) / (K_PI / 13.0)) - 0.5)) * (K_PI / 13.0) * rr;
          joint = ink(wedge - 0.012, aa);
        }
      }
      albedo *= 1.0 - 0.3 * joint * step(l.y, ${glFloat(ARCH.height - 0.4)});
    } else if (group == ${G_NONE}) {
      // Kerb at the edge of the plaza.
      float head = (0.5 - abs(fract(p.x / 1.7) - 0.5)) * 1.7;
      albedo *= 1.0 - 0.3 * ink(head - 0.015, fwidth(p.x) + 1e-4);
    }
  } else if (m == ${M_DAIS}) {
    // Sunken dais. The floor is a slate dial with engraved hour lines.
    vec2 d = p.xz - vec2(${glFloat(DAIS.x)}, ${glFloat(DAIS.z)});
    float rad = length(d);
    float ang = atan(d.x, -d.y);
    if (p.y < ${glFloat(DAIS_FLOOR + 0.01)}) {
      vec2 uv = d / ${glFloat(dialR)};
      float r = length(uv);
      float aa = fwidth(r) * 1.1 + 1e-4;
      albedo = vec3(0.52, 0.52, 0.50) * (0.9 + 0.18 * fbm(d * 2.2));
      float cut = max(ink(abs(r - 0.93) - 0.006, aa), ink(abs(r - 0.78) - 0.004, aa));
      cut = max(cut, ink(abs(r - 0.30) - 0.004, aa));
      cut = max(cut, ink(tickD(ang, 24.0, r) - 0.006, aa) * step(0.30, r) * step(r, 0.93));
      cut = max(cut, ink(tickD(ang, 96.0, r) - 0.003, aa) * step(0.78, r) * step(r, 0.93));
      // Eight-point wind rose at the centre.
      float petal = abs(fract(ang / K_TAU * 8.0 + 0.5) - 0.5);
      cut = max(cut, ink(r - 0.27 * (1.0 - 1.75 * petal), aa) * 0.6);
      albedo = mix(albedo, vec3(0.2, 0.2, 0.21), cut * 0.85);
      gloss = 0.25;
    } else {
      albedo = limestone(p) * 0.97;
      float head = tickD(ang, 20.0, rad);
      albedo *= 1.0 - 0.28 * ink(head - 0.012, fwidth(rad) + 1e-4);
    }
  } else if (m == ${M_DIAL}) {
    metal = 1.0;
    if (vDat.z > 2.5) {
      albedo = chronometer(vDat.xy, gloss, metal);
    } else if (vDat.z > 1.5) {
      albedo = ringDial(vDat.xy, gloss);
    } else if (vDat.z > 0.5) {
      albedo = astrolabe(vDat.xy, gloss);
    } else {
      // Case back: turned metal.
      albedo = vec3(0.70, 0.50, 0.19) * (0.86 + 0.14 * vnoise(vec2(length(vDat.xy) * 80.0, 2.0)));
      gloss = 0.6;
    }
  } else if (m == ${M_BRASS}) {
    albedo = vDat;
    metal = 1.0;
    gloss = 0.8;
  } else if (m == ${M_FORK}) {
    // Brass fork. The broad faces of the prongs carry a scale, like a meridian rule.
    albedo = vec3(0.85, 0.65, 0.27) * (0.94 + 0.08 * vnoise(vec2(vDat.x * 70.0, vDat.y * 3.0)));
    metal = 1.0;
    gloss = 0.85;
    if (vDat.y > ${glFloat(FORK.yoke + 0.25)} && abs(dot(n, ${glVec3(fz)})) > 0.7) {
      float across = abs(vDat.x) - ${glFloat(FORK.gap)};
      float aa = fwidth(vDat.y) + 1e-4;
      float small = ink(abs(fract(vDat.y / 0.1) - 0.5) * 0.1 - 0.006, aa) * step(across, -0.02) * (1.0 - smoothstep(0.004, 0.012, aa));
      float large = ink(abs(fract(vDat.y / 0.5) - 0.5) * 0.5 - 0.011, aa) * step(across, 0.055);
      albedo = mix(albedo, vec3(0.12, 0.08, 0.03), max(small, large) * 0.85);
    }
  } else if (m == ${M_DARK}) {
    albedo = vDat;
    gloss = 0.3;
  }

  float vis = sunVisible(p + n * 0.012, group) * baked;
  vec3 sunCol = vec3(1.0, 0.85, 0.60) * 2.25;
  vec3 direct = sunCol * max(dot(n, uSun), 0.0) * vis;
  vec3 skyFill = vec3(0.17, 0.215, 0.31) * (0.55 + 0.45 * n.y) * occlusion;
  // The white floor throws warm light back onto every face that looks down or sideways.
  vec3 bounce = vec3(0.30, 0.25, 0.165) * (0.5 - 0.5 * n.y) * occlusion;
  vec3 col = albedo * (direct + skyFill + bounce);
  vec3 R = reflect(-V, n);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 5.0);
  float glint = pow(max(dot(R, uSun), 0.0), mix(24.0, 260.0, gloss)) * vis;
  // What a mirror sees: the sky above, the bright salt below.
  vec3 env = mix(vec3(0.80, 0.75, 0.66), skyGradient(vec3(R.x, max(R.y, 0.0), R.z)), smoothstep(-0.1, 0.12, R.y));
  if (metal > 0.0) {
    vec3 polished = albedo * (env * 0.36 + direct * 0.66 + skyFill * 0.45 + bounce * 0.7 + 0.06) + sunCol * glint * (0.3 + 1.6 * gloss) * mix(albedo, vec3(1.0), 0.45) + env * fres * 0.3;
    col = mix(col, polished, metal);
  } else {
    col += sunCol * glint * gloss * 0.5 + env * fres * gloss * 0.25;
  }
  col = mix(col, env * (0.75 + 0.25 * vis), film * (0.22 + 0.6 * fres));
  col = warmAir(col, p, 0.0034);
  gl_FragColor = vec4(sqrt(max(col, 0.0)), 1.0);
}
`;
}

const STACK_VERT = /* glsl */ `
attribute float aKind;
varying vec3 vObj;
varying vec3 vObjN;
varying vec3 vWp;
varying float vKind;
void main() {
  vObj = position;
  vObjN = normal;
  vKind = aKind;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const STACK_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vObjN;
varying vec3 vWp;
varying float vKind;
${GLSL_NOISE}
${SKY}
${HAZE}
void main() {
  // The mirrored copy shows only the part that stands above the bay.
  if (vObj.y < ${glFloat(BAY_Y)}) discard;
  vec3 p = vObj;
  vec3 n = normalize(vObjN);
  vec3 albedo;
  if (vKind > 0.5) {
    // Retaining wall of the plaza.
    albedo = vec3(0.66, 0.60, 0.48) * (0.88 + 0.2 * fbm(vec2(p.x * 0.4, p.y * 2.0)));
    albedo *= 1.0 - 0.25 * step(0.46, abs(fract(p.y / 0.55) - 0.5));
  } else {
    // Red-ochre sandstone in level beds, with a pale band and a dark varnish of desert stain.
    float warp = fbm(vec2(p.x * 0.03, p.z * 0.03)) * 2.2;
    float bed = fbm(vec2(p.y * 0.55 + warp, 3.0 + (p.x + p.z) * 0.01));
    albedo = mix(vec3(0.56, 0.20, 0.09), vec3(0.84, 0.42, 0.17), smoothstep(0.3, 0.7, bed));
    albedo = mix(albedo, vec3(0.93, 0.78, 0.56), smoothstep(0.42, 0.5, abs(fract(p.y * 0.115 + warp * 0.05) - 0.5)) * 0.7);
    albedo = mix(albedo, vec3(0.30, 0.13, 0.08), smoothstep(0.62, 0.8, vnoise3(vec3(p.x * 0.3, p.y * 0.07, p.z * 0.3))) * 0.5);
    // Talus at the foot is paler.
    albedo = mix(vec3(0.78, 0.56, 0.36), albedo, smoothstep(${glFloat(BAY_Y)}, ${glFloat(BAY_Y + 3.5)}, p.y));
    vec3 g = vec3(vnoise3(p * 0.4 + vec3(0.3, 0.0, 0.0)), vnoise3(p * vec3(0.4, 1.3, 0.4) + vec3(0.0, 0.3, 0.0)), vnoise3(p * 0.4 + vec3(0.0, 0.0, 0.3))) - vnoise3(p * 0.4);
    n = normalize(n - 1.2 * g);
  }
  float ndl = max(dot(n, uSun) * 0.92 + 0.08, 0.0);
  vec3 col = albedo * (vec3(1.0, 0.85, 0.60) * 2.1 * ndl + vec3(0.17, 0.215, 0.31) * (0.6 + 0.4 * n.y) + vec3(0.1, 0.07, 0.04));
  col = warmAir(col, vWp, 0.0015);
  gl_FragColor = vec4(sqrt(max(col, 0.0)), 1.0);
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
varying vec3 vDir;
${GLSL_NOISE}
${SKY}
void main() {
  vec3 d = normalize(vDir);
  // The lower half is the sky as the bay mirrors it.
  float mirrored = step(d.y, 0.0);
  d.y = abs(d.y);
  vec3 col = skyGradient(d);
  // Flat lens clouds with hard lower edges, low over the horizon.
  float el = asin(d.y);
  float az = atan(d.x, -d.z);
  float sheet = fbm(vec2(az * 1.5 + uTime * 0.004, el * 62.0));
  float lens = smoothstep(0.585, 0.62, sheet) * smoothstep(0.05, 0.1, el) * (1.0 - smoothstep(0.22, 0.33, el));
  float under = smoothstep(0.62, 0.74, sheet);
  col = mix(col, mix(vec3(1.0, 0.88, 0.70), vec3(0.78, 0.64, 0.62), under), lens * 0.8);
  float toSun = max(dot(d, uSun), 0.0);
  col = mix(col, vec3(1.0, 0.96, 0.80), smoothstep(0.99925, 0.9996, toSun));
  col += (hash21(gl_FragCoord.xy) - 0.5) * 0.008;
  col = mix(col, col * vec3(0.85, 0.93, 0.97) + vec3(0.0, 0.012, 0.028), mirrored);
  gl_FragColor = vec4(col, 1.0);
}
`;

const BAY_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BAY_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vWp;
${GLSL_NOISE}
${HAZE}
void main() {
  vec3 toCam = uCam - vWp;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  // The bay is glass. The mirror image shows through; the body colour comes in where the eye looks down.
  float fres = pow(1.0 - max(V.y, 0.0), 5.0);
  float lane = vnoise(vWp.xz * vec2(0.025, 0.3) + vec2(uTime * 0.015, uTime * 0.04));
  float breath = smoothstep(0.58, 0.82, lane) * smoothstep(60.0, 420.0, dist);
  vec3 body = mix(vec3(0.09, 0.27, 0.33), vec3(0.78, 0.86, 0.84), breath * 0.8);
  float alpha = clamp(mix(0.74, 0.08, fres) + 0.4 * breath, 0.0, 1.0);
  gl_FragColor = vec4(sqrt(body), alpha);
}
`;

const POST_FRAG = /* glsl */ `
vec3 tap(vec2 uv) { return texture2D(tScene, uv).rgb; }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  // Enamel surface: one ring of symmetric nearest-neighbour taps melts the pixel grain and keeps every edge.
  vec3 c0 = tap(vUv);
  vec3 sum = c0;
  for (int i = 0; i < 4; i++) {
    float a = (float(i) + 0.5) * K_PI / 4.0;
    vec2 o = vec2(cos(a), sin(a)) * 1.05 * px;
    vec3 a1 = tap(vUv + o);
    vec3 a2 = tap(vUv - o);
    vec3 d1 = a1 - c0;
    vec3 d2 = a2 - c0;
    sum += dot(d1, d1) < dot(d2, d2) ? a1 : a2;
  }
  vec3 col = mix(c0, sum / 5.0, 0.5);
  col *= 0.97 + 0.045 * canvasWeave(cv * 1.35);

  // Hairline cracks in the varnish: the ridges of a folded noise. They show in the darks.
  vec2 w = cv * 0.02 + 1.5 * vec2(vnoise(cv * 0.006), vnoise(cv * 0.006 + 7.0));
  float fold = abs(vnoise(w) - 0.5) + 0.5 * abs(vnoise(w * 2.3 + 4.0) - 0.5);
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col *= 1.0 - (1.0 - smoothstep(0.0, 0.012, fold)) * 0.08 * (1.0 - smoothstep(0.2, 0.65, lum));

  // Grade: honey varnish in the lights, cool violet in the shadows.
  col = mix(col, col * vec3(1.04, 1.0, 0.9), smoothstep(0.35, 0.95, lum));
  col = mix(col, col * vec3(0.97, 0.97, 1.05), 1.0 - smoothstep(0.0, 0.35, lum));
  col = mix(vec3(lum), col, 1.1);
  col *= vignette(vUv, 0.46);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 31.0) - 0.5) * 0.009;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Far scenery
// ---------------------------------------------------------------------------

interface StackSpec { x: number; z: number; radius: number; height: number; squash: number; seed: number }

const STACKS: StackSpec[] = [
  { x: -62, z: -118, radius: 11, height: 22, squash: 0.8, seed: 1.3 },
  { x: -30, z: -172, radius: 24, height: 15, squash: 0.7, seed: 5.9 },
  { x: 16, z: -138, radius: 7.5, height: 19, squash: 1.0, seed: 9.2 },
  { x: 52, z: -196, radius: 31, height: 13, squash: 0.6, seed: 13.7 },
  { x: 98, z: -152, radius: 13, height: 24, squash: 0.9, seed: 17.1 },
  { x: -118, z: -214, radius: 36, height: 20, squash: 0.65, seed: 21.4 },
  { x: 4, z: -270, radius: 28, height: 10, squash: 0.7, seed: 25.8 },
  { x: -13, z: -92, radius: 4.2, height: 6.5, squash: 1.0, seed: 29.5 },
  { x: 150, z: -250, radius: 40, height: 17, squash: 0.6, seed: 33.3 },
];

/** Sea stacks and the retaining wall of the plaza. The mesh is drawn twice: once upright, once mirrored in the bay. */
function buildBackdrop(): THREE.BufferGeometry {
  const pos: number[] = [], kind: number[] = [], idx: number[] = [];
  const NU = 44, NV = 20;
  const foot = BAY_Y - 3;
  for (const st of STACKS) {
    const first = pos.length / 3;
    const radiusAt = (a: number, v: number): number => {
      const lobes = 0.78 + 0.44 * fbm2(Math.cos(a) * 1.3 + st.seed, Math.sin(a) * 1.3 + st.seed * 0.3, 3);
      // Talus skirt at the foot, a cliff with ledges, a cap that overhangs a little.
      const skirt = 1 + 0.7 * Math.pow(1 - smoothstep(0, 0.3, v), 2);
      const ledge = 1 - 0.09 * Math.floor(v * 5) - 0.1 * fbm2(a * 2.5 + st.seed, v * 5, 2) + 0.07 * smoothstep(0.86, 1, v);
      return st.radius * lobes * skirt * ledge;
    };
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      for (let i = 0; i < NU; i++) {
        const a = (i / NU) * Math.PI * 2;
        const r = radiusAt(a, v);
        pos.push(st.x + Math.cos(a) * r, foot + v * (st.height - foot), st.z + Math.sin(a) * r * st.squash);
        kind.push(0);
      }
    }
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const i1 = (i + 1) % NU;
        const a = first + j * NU + i, c = first + j * NU + i1, d = first + (j + 1) * NU + i, e = first + (j + 1) * NU + i1;
        idx.push(a, d, c, c, d, e);
      }
    }
    // Flat cap with its own vertices, so that the rim is a hard edge.
    const cap = pos.length / 3;
    pos.push(st.x, st.height + 0.4, st.z);
    kind.push(0);
    for (let i = 0; i < NU; i++) {
      const a = (i / NU) * Math.PI * 2;
      const r = radiusAt(a, 1);
      pos.push(st.x + Math.cos(a) * r, st.height, st.z + Math.sin(a) * r * st.squash);
      kind.push(0);
    }
    for (let i = 0; i < NU; i++) idx.push(cap, cap + 1 + ((i + 1) % NU), cap + 1 + i);
  }
  // Retaining wall under the far edge of the plaza. It looks toward the bay.
  const wall = pos.length / 3;
  const zw = EDGE_Z - 0.5;
  pos.push(-PLAZA.halfX, BAY_Y - 1, zw, PLAZA.halfX, BAY_Y - 1, zw, PLAZA.halfX, 0.05, zw, -PLAZA.halfX, 0.05, zw);
  kind.push(1, 1, 1, 1);
  idx.push(wall, wall + 2, wall + 1, wall, wall + 3, wall + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // The first stack must have normals that point away from its axis, and the wall must look toward -z.
  const n = g.getAttribute('normal'), p = g.getAttribute('position');
  const probe = Math.floor(NV / 2) * NU;
  const outward = (p.getX(probe) - STACKS[0].x) * n.getX(probe) + (p.getZ(probe) - STACKS[0].z) * n.getZ(probe);
  if (outward <= 0) throw new Error('The sea stack normals point inward');
  if (n.getZ(wall) >= 0) throw new Error('The plaza wall normal does not look toward the bay');
  return g;
}

// ---------------------------------------------------------------------------

export function createSoftTimeDesert(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 3200;
  const time = { value: 0 };
  const b = new MeshBuilder();
  const capsules: CapsuleProxy[] = [];
  const boxes: BoxProxy[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const none: RGB = [0, 0, 0];
  const plain: RGB = [1, 1, 0];

  // Plaza floor: one sheet with a round hole for the dais.
  {
    const sheet = new THREE.Shape();
    sheet.moveTo(-PLAZA.halfX, -PLAZA.zFront);
    sheet.lineTo(PLAZA.halfX, -PLAZA.zFront);
    sheet.lineTo(PLAZA.halfX, -EDGE_Z);
    sheet.lineTo(-PLAZA.halfX, -EDGE_Z);
    sheet.closePath();
    const hole = new THREE.Path();
    hole.absarc(DAIS.x, -DAIS.z, DAIS.radii[0], 0, Math.PI * 2, false);
    sheet.holes.push(hole);
    const flat = new THREE.ShapeGeometry(sheet, 48);
    // The shape lies in the x-y plane. Turn it so that shape y is world -z.
    b.add(flat, new THREE.Matrix4().makeRotationX(-Math.PI / 2), null, none, M_SALT, G_NONE);
  }

  // Dais: three risers and treads, then the dial floor.
  {
    const SEG = 72;
    const at = (r: number, a: number, y: number): THREE.Vector3 => new THREE.Vector3(DAIS.x + Math.cos(a) * r, y, DAIS.z + Math.sin(a) * r);
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2;
      const n0 = new THREE.Vector3(-Math.cos(a0), 0, -Math.sin(a0)), n1 = new THREE.Vector3(-Math.cos(a1), 0, -Math.sin(a1));
      DAIS.radii.forEach((r, k) => {
        const yTop = -DAIS.step * k, yLow = -DAIS.step * (k + 1);
        b.tri([at(r, a0, yTop), at(r, a1, yTop), at(r, a1, yLow)], [n0, n1, n1], [none, none, none], M_DAIS, G_NONE);
        b.tri([at(r, a0, yTop), at(r, a1, yLow), at(r, a0, yLow)], [n0, n1, n0], [none, none, none], M_DAIS, G_NONE);
        const inner = k + 1 < DAIS.radii.length ? DAIS.radii[k + 1] : 0;
        b.tri([at(r, a0, yLow), at(r, a1, yLow), at(inner, a1, yLow)], [up, up, up], [none, none, none], M_DAIS, G_NONE);
        if (inner > 0) b.tri([at(r, a0, yLow), at(inner, a1, yLow), at(inner, a0, yLow)], [up, up, up], [none, none, none], M_DAIS, G_NONE);
      });
    }
    // Brass style of the dial: a slanted rod with a ball at its tip.
    const foot = new THREE.Vector3(DAIS.x, DAIS_FLOOR, DAIS.z);
    const tip = foot.clone().addScaledVector(new THREE.Vector3(0.24, 0.74, -0.62).normalize(), 1.5);
    const rod = new THREE.Matrix4().compose(foot.clone().add(tip).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, tip.clone().sub(foot).normalize()), new THREE.Vector3(1, 1, 1));
    b.add(new THREE.CylinderGeometry(0.03, 0.04, foot.distanceTo(tip), 10), null, rod, [0.85, 0.65, 0.27], M_BRASS, G_STYLE);
    b.add(new THREE.SphereGeometry(0.075, 14, 10), null, new THREE.Matrix4().makeTranslation(tip.x, tip.y, tip.z), [0.85, 0.65, 0.27], M_BRASS, G_STYLE);
    b.add(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 20), null, new THREE.Matrix4().makeTranslation(foot.x, foot.y + 0.03, foot.z), [0.85, 0.65, 0.27], M_BRASS, G_STYLE);
    capsules.push({ a: foot, b: tip, r: 0.035, group: G_STYLE });
    capsules.push({ a: tip, b: tip.clone().add(new THREE.Vector3(0, 0.001, 0)), r: 0.075, group: G_STYLE });
  }

  // Kerb at the far edge of the plaza.
  b.add(new THREE.BoxGeometry(PLAZA.halfX * 2, 0.5, 0.6), null, new THREE.Matrix4().makeTranslation(0, 0.0, EDGE_Z - 0.2), plain, M_STONE, G_NONE);

  // The archway and the milestone: eroded distance fields.
  addStone(b, archField, archSolid, [-3.95, -0.21, -1.2], [3.95, 7.5, 1.2], 0.075, ARCH_M, G_ARCH, 12);
  addStone(b, stoneField, stoneSolid, [-0.6, -0.12, -0.34], [0.6, 1.56, 0.34], 0.03, STONE_M, G_STONE, 0);
  boxes.push({ m: new THREE.Matrix4().makeTranslation(0, ARCH.ledgeTop - 0.175, 0).premultiply(ARCH_M), half: new THREE.Vector3(ARCH.ledgeHalfW, 0.175, ARCH.ledgeHalfD), group: G_ARCH });
  boxes.push({ m: new THREE.Matrix4().makeTranslation(0, 0.5, 0).premultiply(STONE_M), half: new THREE.Vector3(STONE.halfW, 0.5, STONE.halfD), group: G_STONE });
  {
    const head = new THREE.Vector3(0, STONE.headY, 0).applyMatrix4(STONE_M);
    capsules.push({ a: head, b: head.clone().add(new THREE.Vector3(0, 0.001, 0)), r: 0.37, group: G_STONE });
  }

  // Soft astrolabe and ring-dial over the arch ledge.
  const clearArch = (p: THREE.Vector3): void => settle(p, archField, ARCH_INV, ARCH_M, 0.05);
  softDisc(b, { drape: ledgeDrape(-0.85, 1.15, 0.3, 0.92, 0.3, 0.4), thickness: 0.07, inner: 0, dial: 0, group: G_ARCH, clear: clearArch });
  softDisc(b, { drape: ledgeDrape(2.15, 0.64, 0.5, 1.1, 0.45, 2.6), thickness: 0.075, inner: 0.62, dial: 1, group: G_ARCH, clear: clearArch });
  // Shackle of the astrolabe: it lies on the ledge behind the dial.
  b.add(new THREE.TorusGeometry(0.17, 0.035, 8, 22).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(-0.85, ARCH.ledgeTop + 0.06, ARCH.ledgeHalfD - 0.3 * 1.15 - 1.15 - 0.1), ARCH_M, [0.62, 0.43, 0.17], M_BRASS, G_ARCH);

  // Soft chronometer over the milestone.
  softDisc(b, { drape: headDrape(0.5), thickness: 0.05, inner: 0, dial: 2, group: G_STONE, clear: (p) => settle(p, stoneField, STONE_INV, STONE_M, 0.03) });

  // Tuning fork: stem, yoke, two square prongs, and a plumb line from one tip.
  {
    const brass: RGB = [0.85, 0.65, 0.27];
    const local = (x: number, y: number, z: number): THREE.Matrix4 => new THREE.Matrix4().makeTranslation(x, y, z);
    const world = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z).applyMatrix4(FORK_M);
    b.add(new THREE.CylinderGeometry(0.13, 0.15, FORK.stemTop + 0.4, 14), local(0, (FORK.stemTop - 0.4) / 2, 0), FORK_M, brass, M_FORK, G_FORK, true);
    b.add(new THREE.SphereGeometry(0.23, 16, 12), local(0, 1.05, 0), FORK_M, brass, M_FORK, G_FORK, true);
    b.add(new THREE.TorusGeometry(FORK.gap, FORK.side, 10, 26, Math.PI).rotateZ(Math.PI), local(0, FORK.yoke, 0), FORK_M, brass, M_FORK, G_FORK, true);
    for (const s of [-1, 1]) {
      b.add(new THREE.BoxGeometry(FORK.side * 2, FORK.prong, FORK.side * 2), local(s * FORK.gap, FORK.yoke + FORK.prong / 2, 0), FORK_M, brass, M_FORK, G_FORK, true);
      boxes.push({ m: local(s * FORK.gap, FORK.yoke + FORK.prong / 2, 0).premultiply(FORK_M), half: new THREE.Vector3(FORK.side, FORK.prong / 2, FORK.side), group: G_FORK });
    }
    capsules.push({ a: world(0, 0, 0), b: world(0, FORK.stemTop, 0), r: 0.14, group: G_FORK });
    capsules.push({ a: world(0, 1.05, 0), b: world(0, 1.051, 0), r: 0.23, group: G_FORK });
    for (let i = 0; i < 5; i++) {
      const a0 = Math.PI + (i / 5) * Math.PI, a1 = Math.PI + ((i + 1) / 5) * Math.PI;
      capsules.push({ a: world(Math.cos(a0) * FORK.gap, FORK.yoke + Math.sin(a0) * FORK.gap, 0), b: world(Math.cos(a1) * FORK.gap, FORK.yoke + Math.sin(a1) * FORK.gap, 0), r: FORK.side, group: G_FORK });
    }
    // Limestone socket at the foot.
    const socket = new THREE.Matrix4().makeRotationY(SOCKET.yaw).setPosition(world(0, 0, 0).setY(SOCKET.half.y));
    b.add(new THREE.BoxGeometry(SOCKET.half.x * 2, SOCKET.half.y * 2, SOCKET.half.z * 2), null, socket, plain, M_STONE, G_FORK);
    boxes.push({ m: socket, half: SOCKET.half, group: G_NONE });
    // Plumb line: it hangs true from the tip of the leaning fork.
    const tip = world(FORK.gap, FORK.yoke + FORK.prong - 0.04, 0);
    const bobTop = new THREE.Vector3(tip.x, 0.72, tip.z);
    b.add(new THREE.CylinderGeometry(0.012, 0.012, tip.y - bobTop.y, 5), null, new THREE.Matrix4().makeTranslation(tip.x, (tip.y + bobTop.y) / 2, tip.z), [0.1, 0.085, 0.07], M_DARK, G_FORK);
    b.add(new THREE.ConeGeometry(0.085, 0.36, 14).rotateX(Math.PI), null, new THREE.Matrix4().makeTranslation(tip.x, bobTop.y - 0.18, tip.z), brass, M_BRASS, G_FORK);
    b.add(new THREE.CylinderGeometry(0.03, 0.085, 0.05, 14), null, new THREE.Matrix4().makeTranslation(tip.x, bobTop.y + 0.025, tip.z), brass, M_BRASS, G_FORK);
    capsules.push({ a: tip, b: bobTop, r: 0.016, group: G_FORK });
    capsules.push({ a: bobTop.clone().setY(bobTop.y - 0.06), b: bobTop.clone().setY(bobTop.y - 0.3), r: 0.055, group: G_FORK });
  }

  const shared = { uSun: { value: SUN }, uCam: { value: new THREE.Vector3() }, uTime: time };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 32),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: shared, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const world = new THREE.Mesh(b.build(), new THREE.ShaderMaterial({ vertexShader: WORLD_VERT, fragmentShader: worldFrag(capsules, boxes), uniforms: shared }));
  world.frustumCulled = false;
  scene.add(world);

  const stacks = new THREE.InstancedMesh(
    buildBackdrop(),
    new THREE.ShaderMaterial({ vertexShader: STACK_VERT, fragmentShader: STACK_FRAG, uniforms: shared, side: THREE.DoubleSide }),
    2,
  );
  stacks.setMatrixAt(0, new THREE.Matrix4());
  stacks.setMatrixAt(1, new THREE.Matrix4().makeScale(1, -1, 1).setPosition(0, 2 * BAY_Y, 0));
  stacks.frustumCulled = false;
  scene.add(stacks);

  const bay = new THREE.Mesh(
    new THREE.CircleGeometry(far * 0.85, 48),
    new THREE.ShaderMaterial({ vertexShader: BAY_VERT, fragmentShader: BAY_FRAG, uniforms: shared, transparent: true, depthWrite: false }),
  );
  bay.rotation.x = -Math.PI / 2;
  bay.position.y = BAY_Y;
  bay.frustumCulled = false;
  bay.renderOrder = 1;
  scene.add(bay);

  return {
    scene,
    meta: {
      title: 'Meridian of Salt and Brass',
      artist: 'Original Surrealist Study · Hard-Edge Desert',
      technique: 'Drape-deformed bronze astrolabe, ring-dial, and chronometer with shader-drawn graduations, SDF-eroded limestone arch and milestone, analytic razor-sharp sun shadows across cracked salt and a sunken dial, mirrored sea stacks on a glass bay, enamel-smooth varnish.',
    },
    presets: [
      { name: 'The Meridian', position: [0.5, 3.8, 17], target: [0.8, 2.0, 0], fov: 44 },
      { name: 'The Soft Astrolabe', position: [1.8, 3.3, 2.1], target: [6.4, 5.5, -2.5], fov: 42 },
      { name: 'The Chronometer', position: [1.7, 1.45, 11.3], target: [4.45, 0.95, 9.0], fov: 40 },
      { name: 'Salt and Bay', position: [-3, 13, 27], target: [1.5, 0.5, -2], fov: 44 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.12,
    far,
    flySpeed: 6,
    maxDistance: 140,
    floorAt: (x, z) => {
      if (z < EDGE_Z - 0.5 || Math.abs(x) > PLAZA.halfX || z > PLAZA.zFront) return BAY_Y + 0.35;
      return Math.hypot(x - DAIS.x, z - DAIS.z) < DAIS.radii[0] ? DAIS_FLOOR + 0.35 : 0.3;
    },
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      shared.uCam.value.copy(ctx.camera.position);
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
