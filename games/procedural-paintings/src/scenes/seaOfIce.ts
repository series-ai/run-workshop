// The Sea of Ice — Caspar David Friedrich, 1824.
//
// Every ice slab is a faceted plate: an irregular polygon with a thickness,
// placed by an axis and a facing direction. Hero slabs set the pyramid of the
// painting; seeded slabs, debris, and floes fill the pack. The wreck is a
// lofted hull with broken spars. The low polar sun casts real shadows: one
// depth map from the sun and one from the zenith are rendered once at load,
// because nothing in the pack moves. A Kuwahara filter, canvas, craquelure,
// and varnish finish the image.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, mix, mulberry32, smoothstep } from '../util';

const DEG = Math.PI / 180;
const SUN = new THREE.Vector3(-0.64, 0.4, 0.5).normalize();
/** Half size of the square that the two light maps cover, metres. */
const MAP_HALF = 96;
const MAP_CENTRE = new THREE.Vector3(0, 0, 14);
const MAP_SIZE = 2048;

type Rand = () => number;

// ---------------------------------------------------------------------------
// Ice slabs
// ---------------------------------------------------------------------------

interface Slab {
  /** Middle of the low end of the slab. */
  base: THREE.Vector3;
  /** Direction of the long axis. */
  axis: THREE.Vector3;
  /** Direction that the top face turns toward (made square to the axis). */
  face: THREE.Vector3;
  length: number;
  width: number;
  thick: number;
  /** 0 = blunt plate, 1 = pointed shard. */
  taper: number;
  /** 0 = clean blue-white ice, 1 = old ochre ice. */
  ochre: number;
}

const FACE_TOP = 0, FACE_SIDE = 1, FACE_UNDER = 2;

class IceBuilder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly local: number[] = [];
  readonly info: number[] = [];
  private seed = 0;
  private ochre = 0;

  private tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, la: THREE.Vector3, lb: THREE.Vector3, lc: THREE.Vector3, out: THREE.Vector3, kind: number): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const flip = n.dot(out) < 0;
    if (flip) n.negate();
    const order: Array<[THREE.Vector3, THREE.Vector3]> = flip ? [[a, la], [c, lc], [b, lb]] : [[a, la], [b, lb], [c, lc]];
    for (const [p, l] of order) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.local.push(l.x, l.y, l.z);
      this.info.push(kind, this.ochre, this.seed);
    }
  }

  add(s: Slab, rand: Rand): void {
    const X = s.axis.clone().normalize();
    const Y = s.face.clone().addScaledVector(X, -s.face.dot(X)).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    this.seed = rand();
    this.ochre = s.ochre;

    // Outline: straight fracture edges around a stretched, squared ellipse.
    const count = 6 + Math.floor(rand() * 3);
    const start = s.taper > 0.5 ? 0 : 0.5;
    const outline: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const a = ((i + start + (i === 0 ? 0 : (rand() - 0.5) * 0.5)) / count) * Math.PI * 2;
      const cu = Math.cos(a), sv = Math.sin(a);
      const u = (0.5 + 0.5 * Math.sign(cu) * Math.pow(Math.abs(cu), 0.6)) * s.length;
      let v = 0.5 * Math.sign(sv) * Math.pow(Math.abs(sv), 0.6) * s.width * (0.82 + 0.36 * rand());
      v *= 1 - s.taper * 0.8 * smoothstep(0.35, 1, u / s.length);
      outline.push([u, v]);
    }
    let cu = 0, cv = 0;
    for (const [u, v] of outline) { cu += u / count; cv += v / count; }
    // The top face is a little smaller than the underside, so the edges slope.
    const shrink = clamp(1 - (0.25 + 0.75 * rand()) * s.thick / s.width, 0.72, 0.98);

    const world = (u: number, y: number, v: number): THREE.Vector3 => s.base.clone().addScaledVector(X, u).addScaledVector(Y, y).addScaledVector(Z, v);
    const under = outline.map(([u, v]) => world(u, 0, v));
    const underL = outline.map(([u, v]) => new THREE.Vector3(u, 0, v));
    const top = outline.map(([u, v]) => world(cu + (u - cu) * shrink, s.thick, cv + (v - cv) * shrink));
    const topL = outline.map(([u, v]) => new THREE.Vector3(cu + (u - cu) * shrink, s.thick, cv + (v - cv) * shrink));
    const cTop = world(cu, s.thick, cv), cTopL = new THREE.Vector3(cu, s.thick, cv);
    const cUnder = world(cu, 0, cv), cUnderL = new THREE.Vector3(cu, 0, cv);
    const down = Y.clone().negate();
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      this.tri(cTop, top[i], top[j], cTopL, topL[i], topL[j], Y, FACE_TOP);
      this.tri(cUnder, under[i], under[j], cUnderL, underL[i], underL[j], down, FACE_UNDER);
      const eu = outline[j][0] - outline[i][0], ev = outline[j][1] - outline[i][1];
      const out = X.clone().multiplyScalar(ev).addScaledVector(Z, -eu);
      this.tri(under[i], under[j], top[j], underL[i], underL[j], topL[j], out, FACE_SIDE);
      this.tri(under[i], top[j], top[i], underL[i], topL[j], topL[i], out, FACE_SIDE);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aLocal', new THREE.Float32BufferAttribute(this.local, 3));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.info, 3));
    return g;
  }
}

/** Unit vector from a bearing (0 = to the right, 90 = away from the viewer) and an upward tilt, degrees. */
function aim(bearing: number, tilt: number): THREE.Vector3 {
  const b = bearing * DEG, t = tilt * DEG;
  return new THREE.Vector3(Math.cos(b) * Math.cos(t), Math.sin(t), -Math.sin(b) * Math.cos(t));
}

function slab(x: number, y: number, z: number, bearing: number, tilt: number, face: [number, number, number], length: number, width: number, thick: number, taper: number, ochre: number): Slab {
  return { base: new THREE.Vector3(x, y, z), axis: aim(bearing, tilt), face: new THREE.Vector3(...face), length, width, thick, taper, ochre };
}

/** The slabs that set the composition: the leaning pyramid and the ochre steps in front of it. */
const HERO_SLABS: Slab[] = [
  // The great shards lean to the left and carry the apex.
  slab(23, -2, -3, 171, 53, [-0.45, 0.55, 0.7], 45, 17, 2.4, 0.9, 0.25),
  slab(17, -2, -9, 176, 64, [-0.35, 0.4, 0.85], 39, 14, 2.2, 0.95, 0.1),
  slab(27, -2, -14, 178, 58, [-0.3, 0.5, 0.8], 36, 13, 2.0, 0.9, 0.05),
  slab(21, -1.5, 4, 167, 40, [-0.4, 0.75, 0.5], 37, 15, 2.2, 0.8, 0.4),
  slab(8, -1, 10, 173, 27, [-0.2, 0.9, 0.4], 33, 14, 2.0, 0.7, 0.55),
  // The slabs that lean the other way close the right flank.
  slab(-4, -2, -14, 4, 50, [0.4, 0.6, 0.7], 31, 13, 2.0, 0.85, 0.1),
  slab(3, -2, -19, -7, 61, [0.3, 0.45, 0.85], 30, 12, 1.9, 0.9, 0.05),
  slab(12, -1, 13, 24, 30, [0.25, 0.85, 0.45], 25, 11, 1.8, 0.7, 0.45),
  slab(-12, -1.5, -6, 148, 36, [-0.5, 0.7, 0.5], 24, 12, 1.8, 0.8, 0.3),
  // Thinner shards crowd the apex.
  slab(14, -2, -5, 168, 70, [-0.3, 0.35, 0.9], 34, 9, 1.6, 1, 0.05),
  slab(31, -2, -8, 174, 47, [-0.4, 0.6, 0.7], 40, 14, 2.2, 0.9, 0.15),
  slab(6, -2, -1, 160, 58, [-0.4, 0.5, 0.75], 28, 10, 1.6, 1, 0.2),
  slab(-6, -2, -10, 20, 66, [0.35, 0.4, 0.85], 27, 9, 1.5, 1, 0.05),
  // The slabs that pin the wreck: one lies over the bow, one leans on the quarter.
  slab(13, -1, 9, 14, 36, [0.25, 0.85, 0.45], 28, 12, 1.8, 0.75, 0.3),
  slab(52, -1, 2, 158, 28, [-0.3, 0.85, 0.4], 21, 11, 1.6, 0.7, 0.2),
  // The ochre steps: broad plates that climb from the lower left toward the pile.
  slab(-58, -1.0, 44, -6, 5, [0.0, 1.0, 0.15], 40, 17, 1.7, 0.45, 1.0),
  slab(-44, -0.4, 35, 2, 8, [-0.05, 1.0, 0.15], 37, 16, 1.6, 0.5, 0.95),
  slab(-32, 0.3, 27, 8, 12, [-0.1, 1.0, 0.2], 34, 15, 1.6, 0.55, 0.8),
  slab(-20, 1.2, 19, 13, 17, [-0.15, 1.0, 0.2], 30, 14, 1.5, 0.6, 0.65),
  slab(-12, -0.6, 36, 157, 8, [0.1, 1.0, 0.2], 25, 13, 1.4, 0.5, 0.85),
  slab(12, -0.6, 44, 10, 5, [0.0, 1.0, 0.15], 28, 14, 1.4, 0.4, 0.9),
];

/**
 * A pressure pile: slabs that lean on a centre, with debris around it.
 * scale sizes the whole pile; the far bergs are large piles a long way off.
 */
function addPile(b: IceBuilder, rand: Rand, cx: number, cz: number, scale: number, slabs: number, debris: number, rx: number, rz: number, ochre: number): void {
  for (let i = 0; i < slabs; i++) {
    const a = rand() * Math.PI * 2, rr = Math.pow(rand(), 0.7);
    const x = cx + Math.cos(a) * rr * rx * scale, z = cz + Math.sin(a) * rr * rz * scale;
    // Each slab was pushed up against the pile, so it points at the centre; the tilt grows toward it.
    const toward = Math.atan2(-(cz - z), cx - x) / DEG + (rand() - 0.5) * 70;
    const tilt = mix(62, 14, rr) * (0.6 + 0.6 * rand());
    const length = (9 + 15 * rand()) * (1.25 - 0.5 * rr) * scale;
    b.add({
      base: new THREE.Vector3(x, -1.2 * scale, z),
      axis: aim(toward, tilt),
      face: new THREE.Vector3((rand() - 0.5) * 0.9, 0.6 + 0.6 * rand(), 0.2 + 0.7 * rand()),
      length,
      width: length * (0.36 + 0.3 * rand()),
      thick: (0.9 + 1.1 * rand()) * scale,
      taper: 0.5 + 0.5 * rand(),
      ochre: ochre * (0.4 + 0.6 * rand()) * smoothstep(-20, 30, z - cz),
    }, rand);
  }
  for (let i = 0; i < debris; i++) {
    const a = rand() * Math.PI * 2, rr = 0.25 + 0.95 * Math.pow(rand(), 0.6);
    const x = cx + Math.cos(a) * rr * rx * scale * 1.15, z = cz + Math.sin(a) * rr * rz * scale * 1.3;
    const length = (2.2 + 5 * rand()) * scale;
    b.add({
      base: new THREE.Vector3(x, -0.4 * scale, z),
      axis: aim(rand() * 360, rand() * 42),
      face: new THREE.Vector3(rand() - 0.5, 0.5 + rand(), rand() - 0.5),
      length,
      width: length * (0.45 + 0.4 * rand()),
      thick: (0.5 + 0.9 * rand()) * scale,
      taper: rand(),
      ochre: ochre * rand() * smoothstep(-20, 30, z - cz),
    }, rand);
  }
}

function buildIce(): THREE.BufferGeometry {
  const rand = mulberry32(1824);
  const b = new IceBuilder();
  for (const s of HERO_SLABS) b.add(s, rand);
  addPile(b, rand, 6, -6, 1, 84, 170, 34, 17, 0.8);

  // Floes: thin plates that lie almost flat on the sea, thickest in the foreground.
  const placed: Array<{ x: number; z: number; r: number }> = [];
  for (let tries = 0; tries < 4000 && placed.length < 150; tries++) {
    const x = (rand() - 0.5) * 230, z = -40 + rand() * 118;
    const length = 8 + 15 * rand();
    const r = length * 0.42;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r)) continue;
    placed.push({ x, z, r });
    const bearing = rand() * 360;
    const axis = aim(bearing, (rand() - 0.3) * 5);
    b.add({
      base: new THREE.Vector3(x, -0.25, z).addScaledVector(axis, -length / 2),
      axis,
      face: new THREE.Vector3((rand() - 0.5) * 0.08, 1, (rand() - 0.5) * 0.08),
      length,
      width: length * (0.6 + 0.35 * rand()),
      thick: 0.55 + 0.5 * rand(),
      taper: 0.3 * rand(),
      ochre: smoothstep(-5, 50, z) * (0.55 + 0.45 * rand()),
    }, rand);
  }

  // Far bergs: the blue pile to the left of the painting, and others around the horizon.
  addPile(b, rand, -230, -520, 4.2, 26, 20, 22, 14, 0);
  addPile(b, rand, 330, -640, 3.6, 22, 16, 24, 14, 0);
  addPile(b, rand, 90, -900, 5, 20, 12, 26, 14, 0);
  addPile(b, rand, -640, -150, 4.5, 20, 12, 22, 16, 0);
  addPile(b, rand, 620, 60, 4, 18, 12, 22, 16, 0);
  addPile(b, rand, -300, 560, 4.4, 20, 12, 22, 16, 0);
  addPile(b, rand, 360, 520, 4, 18, 12, 22, 16, 0);
  return b.build();
}

// ---------------------------------------------------------------------------
// The wreck
// ---------------------------------------------------------------------------

const SHIP_LENGTH = 27;
const HALF_BEAM = 3.5;
const BULWARK = 1.0;

function deckLevel(s: number): number {
  return 4.2 + 1.7 * Math.pow(1 - Math.min(s / 0.3, 1), 1.5) + 0.9 * Math.pow(Math.max((s - 0.7) / 0.3, 0), 2);
}

function keelLevel(s: number): number {
  return 3.2 * Math.pow(Math.max((s - 0.84) / 0.16, 0), 2) + 1.3 * Math.pow(1 - Math.min(s / 0.15, 1), 2);
}

function halfBreadth(s: number): number {
  const stern = Math.min(1, 0.7 + 3.2 * s);
  const bow = Math.pow(Math.max(1 - Math.pow(Math.max((s - 0.5) / 0.5, 0), 2.4), 0), 0.55);
  return HALF_BEAM * stern * bow;
}

/** Point on the hull shell. s runs stern to bow, t runs keel to rail, side is +1 or -1. */
function hullPoint(s: number, t: number, side: number): THREE.Vector3 {
  const keel = keelLevel(s), rail = deckLevel(s) + BULWARK;
  const z = halfBreadth(s) * Math.pow(Math.sin(t * Math.PI / 2), 0.6) * (1 - 0.1 * smoothstep(0.7, 1, t));
  return new THREE.Vector3(s * SHIP_LENGTH, keel + (rail - keel) * Math.pow(t, 1.25), z * side);
}

const PART_HULL = 0, PART_DECK = 1, PART_SPAR = 2, PART_STERN = 3;

class ShipBuilder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly part: number[] = [];

  /** A smooth surface from a grid of points. */
  grid(rows: THREE.Vector3[][], part: number): void {
    const nr = rows.length, nc = rows[0].length;
    const normalAt = (i: number, j: number): THREE.Vector3 => {
      const du = new THREE.Vector3().subVectors(rows[Math.min(i + 1, nr - 1)][j], rows[Math.max(i - 1, 0)][j]);
      const dv = new THREE.Vector3().subVectors(rows[i][Math.min(j + 1, nc - 1)], rows[i][Math.max(j - 1, 0)]);
      return du.cross(dv).normalize();
    };
    for (let i = 0; i < nr - 1; i++) {
      for (let j = 0; j < nc - 1; j++) {
        for (const [a, c] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i, j + 1]]) {
          const p = rows[a][c], n = normalAt(a, c);
          this.pos.push(p.x, p.y, p.z);
          this.nor.push(n.x, n.y, n.z);
          this.part.push(part);
        }
      }
    }
  }

  /** A flat polygon, as a fan from its first point. */
  flat(points: THREE.Vector3[], part: number): void {
    const n = new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0])).normalize();
    for (let i = 1; i < points.length - 1; i++) {
      for (const p of [points[0], points[i], points[i + 1]]) {
        this.pos.push(p.x, p.y, p.z);
        this.nor.push(n.x, n.y, n.z);
        this.part.push(part);
      }
    }
  }

  /** A round spar between two points. */
  stick(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number): void {
    const RAD = 7;
    const axis = new THREE.Vector3().subVectors(b, a).normalize();
    const ref = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(axis, ref).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    const ring = (end: THREE.Vector3, r: number): THREE.Vector3[] => {
      const out: THREE.Vector3[] = [];
      for (let j = 0; j <= RAD; j++) {
        const ang = (j / RAD) * Math.PI * 2;
        out.push(end.clone().addScaledVector(u, Math.cos(ang) * r).addScaledVector(v, Math.sin(ang) * r));
      }
      return out;
    };
    this.grid([ring(a, ra), ring(b, rb)], PART_SPAR);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    return g;
  }
}

function buildShip(): THREE.BufferGeometry {
  const b = new ShipBuilder();
  const NS = 30, NT = 10;
  for (const side of [1, -1]) {
    const rows: THREE.Vector3[][] = [];
    for (let i = 0; i <= NS; i++) {
      const row: THREE.Vector3[] = [];
      for (let j = 0; j <= NT; j++) row.push(hullPoint(i / NS, j / NT, side));
      rows.push(row);
    }
    b.grid(rows, PART_HULL);
  }
  // The deck lies one bulwark below the rail.
  const deckT = (s: number): number => Math.pow((deckLevel(s) - keelLevel(s)) / (deckLevel(s) + BULWARK - keelLevel(s)), 1 / 1.25);
  const deck: THREE.Vector3[][] = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS;
    const edge = hullPoint(s, deckT(s), 1);
    deck.push([new THREE.Vector3(edge.x, edge.y, -edge.z), new THREE.Vector3(edge.x, edge.y + 0.12, 0), edge]);
  }
  b.grid(deck, PART_DECK);
  // The flat stern.
  const stern: THREE.Vector3[] = [];
  for (let j = 0; j <= NT; j++) stern.push(hullPoint(0, j / NT, 1));
  for (let j = NT; j >= 0; j--) stern.push(hullPoint(0, j / NT, -1));
  b.flat(stern, PART_STERN);
  b.flat([new THREE.Vector3(-0.9, 0.3, 0.1), new THREE.Vector3(0, 0.6, 0.1), new THREE.Vector3(0, 4.6, 0.1), new THREE.Vector3(-0.5, 4.6, 0.1)], PART_STERN);

  // Broken masts, a fallen topmast, yards, and what is left of the shrouds.
  const at = (s: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(s * SHIP_LENGTH, deckLevel(s) + y, z);
  const mizzenTop = at(0.2, 7.5, 0.3);
  const mainTop = at(0.47, 13, -0.4);
  b.stick(at(0.2, -0.5, 0), mizzenTop, 0.3, 0.22);
  b.stick(at(0.47, -0.5, 0), mainTop, 0.38, 0.27);
  b.stick(mainTop, at(0.66, 5.5, -5.2), 0.24, 0.14);
  b.stick(at(0.41, 9.2, -5.4), at(0.52, 8.6, 5.2), 0.19, 0.15);
  b.stick(at(0.17, 5.4, -3.6), at(0.24, 4.8, 3.9), 0.16, 0.12);
  b.stick(at(0.05, 0.6, -2.2), at(0.36, 1.5, 3.6), 0.17, 0.13);
  for (const side of [1, -1]) {
    for (const s of [0.4, 0.44, 0.5]) {
      const foot = hullPoint(s, 1, side);
      b.stick(foot, mainTop.clone().lerp(at(0.47, 0, 0), 0.25), 0.05, 0.05);
    }
    const foot = hullPoint(0.17, 1, side);
    b.stick(foot, mizzenTop.clone().lerp(at(0.2, 0, 0), 0.2), 0.05, 0.05);
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Shaders. Light is summed in linear values; the scene colour is stored
// square-root encoded for 8-bit precision.
// ---------------------------------------------------------------------------

const LIGHT = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uSun;
uniform float uTime;
uniform sampler2D tShadow;
uniform sampler2D tTop;
uniform mat4 uShadowMatrix;
uniform mat4 uTopMatrix;
uniform float uTopRange;
vec3 lin(float r, float g, float b) { return vec3(r * r, g * g, b * b); }
vec3 hazeColor() { return lin(0.73, 0.79, 0.85); }
const vec3 SUN_COLOR = vec3(1.45, 1.22, 0.94);
vec3 skyLight(vec3 n) {
  return lin(0.5, 0.62, 0.8) * (0.4 + 0.6 * n.y) + lin(0.52, 0.56, 0.6) * (0.5 - 0.5 * n.y) * 0.55;
}
/** 1 where the sun reaches the point, from the depth map rendered at load. */
float sunShadow(vec3 p, vec3 n) {
  vec4 sc = uShadowMatrix * vec4(p + n * 0.22, 1.0);
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0) return 1.0;
  float lit = 0.0;
  float o = 0.75 / ${MAP_SIZE.toFixed(1)};
  lit += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(o, o)).r);
  lit += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(-o, o)).r);
  lit += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(o, -o)).r);
  lit += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(-o, -o)).r);
  return lit * 0.25;
}
/** 1 under open sky, less under an overhang: the depth map from the zenith tells how much ice is above. */
float skyOpen(vec3 p) {
  vec4 tc = uTopMatrix * vec4(p, 1.0);
  if (tc.x < 0.0 || tc.x > 1.0 || tc.y < 0.0 || tc.y > 1.0) return 1.0;
  float above = (tc.z - texture2D(tTop, tc.xy).r) * uTopRange;
  return 1.0 - 0.62 * smoothstep(0.5, 6.0, above);
}
/** Sunlight that reaches the point: a bank of cloud keeps the foreground of the painting in shade. */
float sunReach(vec3 p) {
  return mix(1.0, 0.16, smoothstep(40.0, 74.0, p.z + 0.2 * p.x) * (1.0 - smoothstep(110.0, 170.0, p.z)));
}
vec3 haze(vec3 col, vec3 wp) {
  float dist = length(wp - uCam);
  return mix(col, hazeColor(), 1.0 - exp(-dist * 0.0011));
}
`;

const ICE_VERT = /* glsl */ `
attribute vec3 aLocal;
attribute vec3 aInfo;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vInfo;
void main() {
  vWp = position;
  vN = normal;
  vLocal = aLocal;
  vInfo = aInfo;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const ICE_FRAG = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vInfo;
${GLSL_NOISE}
${LIGHT}
void main() {
  vec3 n = normalize(vN);
  vec3 p = vWp;
  vec3 V = normalize(uCam - p);
  float kind = vInfo.x;
  float ochre = vInfo.y;
  float seed = vInfo.z * 97.0;
  vec2 q = vLocal.xz + seed;
  float broad = fbm(q * 0.11);
  float fine = fbm(q * 0.7 + 3.0);
  vec3 albedo;
  float gloss;
  float glow;
  if (kind < 0.5) {
    // Top face: wind-packed snow over blue ice, or old ochre ice with dark seams.
    vec3 clean = mix(lin(0.74, 0.84, 0.9), lin(0.96, 0.96, 0.94), smoothstep(0.35, 0.65, broad));
    vec3 old = mix(lin(0.4, 0.33, 0.24), lin(0.76, 0.66, 0.48), smoothstep(0.3, 0.7, broad));
    old = mix(old, lin(0.93, 0.91, 0.84), smoothstep(0.5, 0.75, fine) * 0.55);
    albedo = mix(clean, old, ochre);
    // Stress cracks: straight fractures that divide the face into plates.
    vec2 cq = q * 0.28 + 0.5 * vec2(fine, broad);
    vec2 ci = floor(cq); vec2 cf = fract(cq);
    float d1 = 9.0; float d2 = 9.0; float id = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 gg = vec2(float(i), float(j));
        vec2 o = gg + hash23(ci + gg).xy - cf;
        float dd = abs(o.x) + abs(o.y);
        if (dd < d1) { d2 = d1; d1 = dd; id = hash21(ci + gg + 1.3); } else if (dd < d2) { d2 = dd; }
      }
    }
    albedo *= 0.93 + 0.14 * id;
    albedo *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.06, d2 - d1)) * step(0.45, id + 0.5 * broad);
    gloss = 0.35 * (1.0 - smoothstep(0.35, 0.65, broad));
    glow = 0.12;
  } else if (kind < 1.5) {
    // Fracture edge: layers of clear blue-green ice and white frozen snow.
    float layer = vnoise(vec2(vLocal.y * 5.5 + seed, (vLocal.x + vLocal.z) * 0.08));
    vec3 clear = mix(lin(0.3, 0.56, 0.64), lin(0.62, 0.84, 0.88), layer);
    vec3 old = mix(lin(0.26, 0.21, 0.15), lin(0.56, 0.46, 0.31), layer);
    albedo = mix(clear, old, ochre * 0.85);
    albedo = mix(albedo, lin(0.92, 0.94, 0.94), smoothstep(0.6, 0.85, fine) * 0.35 * (1.0 - ochre));
    gloss = 0.5;
    glow = 0.5 * (1.0 - 0.7 * ochre);
  } else {
    albedo = mix(lin(0.42, 0.58, 0.66), lin(0.36, 0.28, 0.18), ochre * 0.8);
    gloss = 0.2;
    glow = 0.3 * (1.0 - 0.7 * ochre);
  }
  // A gentle swell breaks up the flat planes.
  vec2 e = vec2(0.35, 0.0);
  vec2 g = vec2(fbm((q + e.xy) * 0.11) - broad, fbm((q + e.yx) * 0.11) - broad);
  vec3 nb = normalize(n + 0.55 * (dFdx(vWp) * g.x + dFdy(vWp) * g.y) / max(length(dFdx(vWp)), 1e-4));

  float shadow = sunShadow(p, n) * sunReach(p);
  float open = skyOpen(p);
  float ndl = max(dot(nb, uSun), 0.0);
  vec3 col = albedo * (SUN_COLOR * ndl * shadow + skyLight(nb) * open);
  // Sunlight that passes through the ice lights the faces that turn away from the sun.
  col += glow * lin(0.45, 0.78, 0.82) * pow(max(dot(-n, uSun), 0.0), 1.3) * (0.35 + 0.65 * shadow) * 0.5;
  // Wet sheen, and the cold sky mirrored at grazing angles.
  float fres = pow(1.0 - max(dot(nb, V), 0.0), 4.0);
  col += gloss * SUN_COLOR * pow(max(dot(reflect(-uSun, nb), V), 0.0), 36.0) * shadow * 0.55;
  col = mix(col, lin(0.6, 0.72, 0.84) * open, gloss * fres * 0.6);
  // The ice near the water line is dark and wet.
  col *= mix(0.55, 1.0, smoothstep(-0.2, 1.6, p.y + 0.6 * fine));
  gl_FragColor = vec4(sqrt(haze(col, p)), 1.0);
}
`;

const GROUND_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const GROUND_FRAG = /* glsl */ `
varying vec3 vWp;
${GLSL_NOISE}
${LIGHT}
void main() {
  vec3 p = vWp;
  vec2 xz = p.xz;
  float dist = length(p - uCam);
  vec3 V = (uCam - p) / dist;
  // The pack: floes with dark leads of open water between them.
  vec2 q = xz / 12.0 + 0.7 * vec2(fbm(xz * 0.025), fbm(xz * 0.025 + 7.0));
  vec2 ci = floor(q); vec2 cf = fract(q);
  float d1 = 9.0; float d2 = 9.0; float id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      float dd = length(g + hash23(ci + g).xy - cf);
      if (dd < d1) { d2 = d1; d1 = dd; id = hash21(ci + g + 3.7); } else if (dd < d2) { d2 = dd; }
    }
  }
  float fromFront = length(xz - vec2(0.0, 60.0));
  float lead = mix(0.015, 0.2, smoothstep(190.0, 40.0, fromFront)) * (0.5 + id);
  float water = 1.0 - smoothstep(lead, lead + 0.035 + dist * 0.0004, d2 - d1);
  water *= 1.0 - smoothstep(350.0, 900.0, dist);

  float broad = fbm(xz * 0.06 + id * 13.0);
  float fine = fbm(xz * 0.45);
  vec3 ice = mix(lin(0.66, 0.76, 0.84), lin(0.95, 0.95, 0.93), smoothstep(0.3, 0.7, broad));
  vec3 old = mix(lin(0.36, 0.3, 0.22), lin(0.7, 0.61, 0.45), smoothstep(0.3, 0.7, broad + 0.3 * fine - 0.15));
  ice = mix(ice, old, smoothstep(130.0, 30.0, fromFront) * (0.45 + 0.55 * id));
  // Pressure ridges: thin lines of rubble with a blue shadow side.
  float ridge = vnoise(vec2(xz.x * 0.05 + 3.0 * vnoise(xz * 0.02), xz.y * 0.4));
  ice *= 1.0 - 0.3 * smoothstep(0.7, 0.78, ridge) * (1.0 - smoothstep(0.78, 0.9, ridge));

  vec3 n = normalize(vec3((fine - 0.5) * 0.25, 1.0, (fbm(xz * 0.45 + 11.0) - 0.5) * 0.25));
  float shadow = sunShadow(p, vec3(0.0, 1.0, 0.0)) * sunReach(p);
  float open = skyOpen(p + vec3(0.0, 0.3, 0.0));
  vec3 col = ice * (SUN_COLOR * max(dot(n, uSun), 0.0) * shadow + skyLight(n) * open);
  float fres = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
  vec3 sea = mix(lin(0.1, 0.13, 0.15), lin(0.5, 0.62, 0.74), fres) * (0.55 + 0.45 * open);
  col = mix(col, sea, water);
  gl_FragColor = vec4(sqrt(haze(col, p)), 1.0);
}
`;

const SHIP_VERT = /* glsl */ `
attribute float aPart;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vLocal;
varying float vPart;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vLocal = position;
  vPart = aPart;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SHIP_FRAG = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
varying vec3 vLocal;
varying float vPart;
${GLSL_NOISE}
${LIGHT}
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 p = vWp;
  float grain = fbm(vLocal.xy * vec2(0.6, 5.0) + vLocal.z);
  vec3 albedo;
  if (vPart < 0.5) {
    // Tarred planking with one ochre strake below the rail.
    float plank = smoothstep(0.86, 0.97, fract(vLocal.y * 2.6));
    albedo = mix(lin(0.13, 0.11, 0.095), lin(0.25, 0.2, 0.15), grain);
    float rail = vLocal.y - (4.2 + 1.7 * pow(1.0 - min(vLocal.x / 8.1, 1.0), 1.5));
    float strake = smoothstep(-0.75, -0.68, rail) * (1.0 - smoothstep(-0.3, -0.23, rail));
    albedo = mix(albedo, lin(0.62, 0.48, 0.24) * (0.8 + 0.4 * grain), strake);
    albedo = mix(albedo, lin(0.36, 0.2, 0.13), smoothstep(-2.6, -3.0, rail) * 0.7);
    albedo *= 1.0 - 0.4 * plank;
  } else if (vPart < 1.5) {
    float plank = smoothstep(0.88, 0.98, fract(vLocal.z * 3.2));
    albedo = mix(lin(0.42, 0.36, 0.28), lin(0.6, 0.53, 0.42), grain) * (1.0 - 0.4 * plank);
  } else if (vPart < 2.5) {
    albedo = mix(lin(0.3, 0.23, 0.16), lin(0.48, 0.38, 0.26), grain);
  } else {
    // The stern: dark panels and a row of blind cabin windows.
    albedo = mix(lin(0.22, 0.16, 0.11), lin(0.36, 0.27, 0.17), grain);
    vec2 w = vec2(fract(vLocal.z * 0.85 + 0.5), (vLocal.y - 4.3) / 0.9);
    float pane = step(0.18, w.x) * step(w.x, 0.82) * step(0.0, w.y) * step(w.y, 1.0);
    albedo = mix(albedo, lin(0.1, 0.12, 0.14), pane * 0.85);
    albedo = mix(albedo, lin(0.62, 0.47, 0.22), step(abs(vLocal.y - 3.9), 0.12) * 0.8);
  }
  // Snow lies on everything that faces the sky.
  float snow = smoothstep(0.55, 0.85, n.y + 0.25 * (fbm(vLocal.xz * 1.3) - 0.5));
  albedo = mix(albedo, lin(0.9, 0.92, 0.93), snow * 0.8);
  float shadow = sunShadow(p, n) * sunReach(p);
  vec3 col = albedo * (SUN_COLOR * max(dot(n, uSun), 0.0) * shadow + skyLight(n) * skyOpen(p));
  gl_FragColor = vec4(sqrt(haze(col, p)), 1.0);
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
${LIGHT}
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float h = clamp(el / 1.2, 0.0, 1.0);
  float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  // Polar sky: pale and a little warm at the horizon, hard cold blue overhead.
  vec3 hor = mix(lin(0.78, 0.82, 0.84), lin(0.92, 0.86, 0.72), pow(toSun, 3.0) * 0.7);
  vec3 col = mix(hor, lin(0.5, 0.66, 0.82), smoothstep(0.0, 0.26, h));
  col = mix(col, lin(0.19, 0.33, 0.55), smoothstep(0.18, 0.85, h));
  // Thin streaks of cloud, and a paler rift above the pile.
  vec2 cp = d.xz / (d.y + 0.25);
  float rift = fbm(cp * vec2(0.5, 1.2) + vec2(uTime * 0.002, 0.0));
  float streak = fbm(cp * vec2(0.9, 3.4) + vec2(5.0 - uTime * 0.003, 2.0));
  col = mix(col, lin(0.7, 0.8, 0.9), smoothstep(0.48, 0.74, rift) * 0.55 * smoothstep(0.04, 0.3, h));
  col = mix(col, lin(0.15, 0.24, 0.4), smoothstep(0.52, 0.76, streak * 0.65 + rift * 0.4) * 0.5 * smoothstep(0.08, 0.5, h));
  col = mix(col, lin(0.9, 0.9, 0.86), smoothstep(0.62, 0.8, streak) * 0.35 * smoothstep(0.02, 0.2, h) * (1.0 - smoothstep(0.3, 0.6, h)));
  col = mix(hazeColor(), col, smoothstep(-0.01, 0.035, el));
  gl_FragColor = vec4(sqrt(col), 1.0);
}
`;

const POST_FRAG = /* glsl */ `
vec3 scene(vec2 uv) { return texture2D(tScene, uv).rgb; }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  // Kuwahara: keep the calmest of four neighbourhoods. Flat planes stay flat and edges stay hard.
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

  float l0 = dot(best, vec3(0.3, 0.6, 0.1));
  float lx = dot(scene(vUv + vec2(px.x * 1.5, 0.0)), vec3(0.3, 0.6, 0.1)) - l0;
  float ly = dot(scene(vUv + vec2(0.0, px.y * 1.5)), vec3(0.3, 0.6, 0.1)) - l0;
  col *= 1.0 + (lx - ly) * 0.7;
  col *= 0.95 + 0.075 * canvasWeave(cv);

  // Craquelure: a fine net of age cracks.
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
  col *= 1.0 - crackle * (0.035 + 0.07 * (1.0 - smoothstep(0.1, 0.6, l0)));

  // Grade: yellowed varnish in the lights, cold blue in the darks.
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col = mix(col, col * vec3(1.04, 1.0, 0.9), smoothstep(0.35, 0.9, lum));
  col = mix(col, col * vec3(0.92, 0.99, 1.04) + vec3(0.004, 0.01, 0.016), 1.0 - smoothstep(0.0, 0.32, lum));
  col = mix(vec3(lum), col, 1.08);
  col *= vignette(vUv, 0.55);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

/** Depth target for one of the two light maps. */
function makeDepthTarget(): THREE.WebGLRenderTarget {
  const depth = new THREE.DepthTexture(MAP_SIZE, MAP_SIZE);
  depth.type = THREE.UnsignedIntType;
  return new THREE.WebGLRenderTarget(MAP_SIZE, MAP_SIZE, { depthTexture: depth, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
}

/** World position to map texture coordinates and depth, all in 0..1. */
function mapMatrix(cam: THREE.OrthographicCamera): THREE.Matrix4 {
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  return bias.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
}

export function createSeaOfIce(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 5000;

  // Light maps: one camera at the sun, one at the zenith. Both see the whole pack.
  const sunCam = new THREE.OrthographicCamera(-MAP_HALF, MAP_HALF, MAP_HALF, -MAP_HALF, 10, 420);
  sunCam.position.copy(MAP_CENTRE).addScaledVector(SUN, 220);
  sunCam.lookAt(MAP_CENTRE);
  const topCam = new THREE.OrthographicCamera(-MAP_HALF, MAP_HALF, MAP_HALF, -MAP_HALF, 1, 121);
  topCam.position.set(MAP_CENTRE.x, 120, MAP_CENTRE.z);
  topCam.up.set(0, 0, -1);
  topCam.lookAt(MAP_CENTRE.x, 0, MAP_CENTRE.z);
  const shadowTarget = makeDepthTarget();
  const topTarget = makeDepthTarget();
  const depthOnly = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  let mapsBaked = false;

  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uSun: { value: SUN },
    uTime: { value: 0 },
    tShadow: { value: shadowTarget.depthTexture },
    tTop: { value: topTarget.depthTexture },
    uShadowMatrix: { value: mapMatrix(sunCam) },
    uTopMatrix: { value: mapMatrix(topCam) },
    uTopRange: { value: topCam.far - topCam.near },
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms, side: THREE.BackSide }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = 10;
  scene.add(sky);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(far * 0.85, 64), new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms }));
  ground.rotation.x = -Math.PI / 2;
  ground.frustumCulled = false;
  ground.renderOrder = 5;
  scene.add(ground);

  const ice = new THREE.Mesh(buildIce(), new THREE.ShaderMaterial({ vertexShader: ICE_VERT, fragmentShader: ICE_FRAG, uniforms }));
  ice.frustumCulled = false;
  scene.add(ice);

  // The wreck lies on its side at the right of the pile, bow under the ice.
  const ship = new THREE.Mesh(buildShip(), new THREE.ShaderMaterial({ vertexShader: SHIP_VERT, fragmentShader: SHIP_FRAG, uniforms, side: THREE.DoubleSide }));
  const bow = new THREE.Vector3(-0.8, -0.28, -0.5).normalize();
  const deckUp = new THREE.Vector3(-0.3, 0.62, 0.72);
  deckUp.addScaledVector(bow, -deckUp.dot(bow)).normalize();
  ship.matrixAutoUpdate = false;
  ship.matrix.makeBasis(bow, deckUp, new THREE.Vector3().crossVectors(bow, deckUp)).setPosition(41, 5.2, 9);
  ship.frustumCulled = false;
  scene.add(ship);

  return {
    scene,
    meta: {
      title: 'The Sea of Ice',
      artist: 'Caspar David Friedrich · 1824',
      technique: 'Faceted ice plates placed by axis and facing, lofted wreck hull, sun and zenith depth maps rendered once for cast shadows and overhang shade, light through the ice edges, Kuwahara oil filter.',
    },
    presets: [
      { name: 'The Painting', position: [0, 6.5, 104], target: [-1, 15.5, 0], fov: 30 },
      { name: 'The Wreck', position: [62, 8, 44], target: [33, 7, 4], fov: 40 },
      { name: 'Among the Shards', position: [25, 2.4, 33], target: [5, 19, -6], fov: 62 },
      { name: 'Above the Pack', position: [84, 88, 128], target: [2, 6, 0], fov: 40 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.3,
    far,
    flySpeed: 16,
    maxDistance: 420,
    floorAt: () => 1.2,
    update(ctx: FrameContext): void {
      uniforms.uTime.value = ctx.time;
      uniforms.uCam.value.copy(ctx.camera.position);
      sky.position.copy(ctx.camera.position);
    },
    prePass(ctx: FrameContext): void {
      // The pack is static, so the two light maps render once.
      if (mapsBaked) return;
      mapsBaked = true;
      sky.visible = false;
      ground.visible = false;
      scene.overrideMaterial = depthOnly;
      for (const [target, cam] of [[shadowTarget, sunCam], [topTarget, topCam]] as const) {
        ctx.renderer.setRenderTarget(target);
        ctx.renderer.clear();
        ctx.renderer.render(scene, cam);
      }
      scene.overrideMaterial = null;
      sky.visible = true;
      ground.visible = true;
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      depthOnly.dispose();
      shadowTarget.dispose();
      topTarget.dispose();
    },
  };
}
