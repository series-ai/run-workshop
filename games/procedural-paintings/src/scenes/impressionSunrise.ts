// Impression, Sunrise — Claude Monet, 1872.
//
// The harbour of Le Havre in morning fog. The fog is a distance law: every
// surface fades to the colour of the mist in its view direction, so the ships,
// cranes, and quays stand in layers of falling contrast. The water carries
// instanced brush dashes that always lie level on the picture plane. The
// reflection of the sun is a second set of dashes: each one is shown only
// when it lies on the bearing from the eye to the sun, so the column of
// vermilion bars follows the viewer like real glitter. Loose blended dabs
// hang in the air as smoke and as scumbled haze.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { hex, mulberry32, type RGB } from '../util';

type V3 = [number, number, number];

const SUN_BEARING = (7.5 * Math.PI) / 180;
const SUN_ELEVATION = (3.7 * Math.PI) / 180;
const SUN = new THREE.Vector3(
  Math.sin(SUN_BEARING) * Math.cos(SUN_ELEVATION),
  Math.sin(SUN_ELEVATION),
  -Math.cos(SUN_BEARING) * Math.cos(SUN_ELEVATION),
);
/** Plan position of the eye in the painting. The strokes are laid out around it. */
const EYE: [number, number] = [0, 20];

const BOAT_DARK = hex(0x13242b);
const BOAT_FIGURE = hex(0x0f1c22);
const SHIP = hex(0x2f3a4e);
const SHIP_FAR = hex(0x3a4558);
const IRON = hex(0x2b3447);
const SHED = hex(0x384254);

// ---------------------------------------------------------------------------
// Silhouette mesh: one triangle soup for the boats, ships, cranes, and quays
// ---------------------------------------------------------------------------

class Solid {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];

  vert(p: V3, n: V3, c: RGB): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]);
  }

  tri(a: V3, b: V3, c: V3, col: RGB): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    const n: V3 = [nx, ny, nz];
    this.vert(a, n, col); this.vert(b, n, col); this.vert(c, n, col);
  }

  quad(a: V3, b: V3, c: V3, d: V3, col: RGB): void {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  }

  /** A box turned by yaw about the vertical axis. */
  box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, yaw: number, col: RGB): void {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const p = (x: number, y: number, z: number): V3 => [cx + x * cs - z * sn, cy + y, cz + x * sn + z * cs];
    const v = [p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(-hx, hy, -hz), p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz)];
    this.quad(v[1], v[0], v[3], v[2], col);
    this.quad(v[4], v[5], v[6], v[7], col);
    this.quad(v[0], v[4], v[7], v[3], col);
    this.quad(v[5], v[1], v[2], v[6], col);
    this.quad(v[3], v[7], v[6], v[2], col);
    this.quad(v[0], v[1], v[5], v[4], col);
  }

  /** A round or square spar from a to b. The radius runs from ra to rb. */
  tube(a: V3, b: V3, ra: number, rb: number, sides: number, col: RGB): void {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) throw new Error('Solid.tube needs two different end points');
    const ax: V3 = [dx / len, dy / len, dz / len];
    // Any vector that is not parallel to the axis gives a frame.
    const ref: V3 = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = ax[1] * ref[2] - ax[2] * ref[1], uy = ax[2] * ref[0] - ax[0] * ref[2], uz = ax[0] * ref[1] - ax[1] * ref[0];
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul; uy /= ul; uz /= ul;
    const vx = ax[1] * uz - ax[2] * uy, vy = ax[2] * ux - ax[0] * uz, vz = ax[0] * uy - ax[1] * ux;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const n0: V3 = [ux * Math.cos(a0) + vx * Math.sin(a0), uy * Math.cos(a0) + vy * Math.sin(a0), uz * Math.cos(a0) + vz * Math.sin(a0)];
      const n1: V3 = [ux * Math.cos(a1) + vx * Math.sin(a1), uy * Math.cos(a1) + vy * Math.sin(a1), uz * Math.cos(a1) + vz * Math.sin(a1)];
      const p00: V3 = [a[0] + n0[0] * ra, a[1] + n0[1] * ra, a[2] + n0[2] * ra];
      const p01: V3 = [a[0] + n1[0] * ra, a[1] + n1[1] * ra, a[2] + n1[2] * ra];
      const p10: V3 = [b[0] + n0[0] * rb, b[1] + n0[1] * rb, b[2] + n0[2] * rb];
      const p11: V3 = [b[0] + n1[0] * rb, b[1] + n1[1] * rb, b[2] + n1[2] * rb];
      this.vert(p00, n0, col); this.vert(p01, n1, col); this.vert(p11, n1, col);
      this.vert(p00, n0, col); this.vert(p11, n1, col); this.vert(p10, n0, col);
    }
  }

  ellipsoid(c: V3, r: V3, col: RGB, lat = 7, lon = 10): void {
    const at = (i: number, j: number): [V3, V3] => {
      const th = (i / lat) * Math.PI, ph = (j / lon) * Math.PI * 2;
      const n: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const g: V3 = [n[0] / r[0], n[1] / r[1], n[2] / r[2]];
      const gl = Math.hypot(g[0], g[1], g[2]);
      return [[c[0] + n[0] * r[0], c[1] + n[1] * r[1], c[2] + n[2] * r[2]], [g[0] / gl, g[1] / gl, g[2] / gl]];
    };
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = at(i, j), b = at(i + 1, j), d = at(i, j + 1), e = at(i + 1, j + 1);
        if (i > 0) { this.vert(a[0], a[1], col); this.vert(d[0], d[1], col); this.vert(e[0], e[1], col); }
        if (i < lat - 1) { this.vert(a[0], a[1], col); this.vert(e[0], e[1], col); this.vert(b[0], b[1], col); }
      }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

/** Places local coordinates (x along the keel, z to starboard) in the world. */
function placer(cx: number, cz: number, yaw: number): (x: number, y: number, z: number) => V3 {
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  return (x, y, z) => [cx + x * cs - z * sn, y, cz + x * sn + z * cs];
}

/** A hull: pointed at both ends. sheer is how much the rail rises to bow and stern. An open boat has no deck. */
function addHull(solid: Solid, cx: number, cz: number, yaw: number, length: number, beam: number, height: number, sheer: number, deck: boolean, col: RGB): void {
  const at = placer(cx, cz, yaw);
  const N = 14;
  const section = (i: number): V3[] => {
    const s = (i / N) * 2 - 1;
    const hb = (beam / 2) * Math.pow(Math.max(1 - Math.pow(Math.abs(s), 2.6), 0), 0.55) + 0.01;
    const top = height * (1 + sheer * s * s);
    const x = (s * length) / 2;
    return [at(x, top, -hb), at(x, top * 0.3, -hb * 0.82), at(x, -height * 0.25, -hb * 0.3), at(x, -height * 0.25, hb * 0.3), at(x, top * 0.3, hb * 0.82), at(x, top, hb)];
  };
  let prev = section(0);
  for (let i = 1; i <= N; i++) {
    const next = section(i);
    for (let j = 0; j < 5; j++) solid.quad(prev[j], next[j], next[j + 1], prev[j + 1], col);
    if (deck) solid.quad(prev[5], next[5], next[0], prev[0], [col[0] * 1.25, col[1] * 1.25, col[2] * 1.25]);
    prev = next;
  }
}

/** A rowing boat with a seated figure and a figure who stands at the stern oar. */
function addRowboat(solid: Solid, cx: number, cz: number, yaw: number, scale: number): void {
  const at = placer(cx, cz, yaw);
  const s = scale;
  addHull(solid, cx, cz, yaw, 4.9 * s, 1.25 * s, 0.26 * s, 1.15, false, BOAT_DARK);
  for (const x of [-1.1, 0.2, 1.3]) {
    const a = at(x * s, 0.24 * s, 0);
    solid.box(a[0], a[1], a[2], 0.09 * s, 0.02 * s, 0.5 * s, yaw, BOAT_DARK);
  }
  // The seated figure, bent a little forward under a soft hat.
  solid.ellipsoid(at(0.25 * s, 0.56 * s, 0), [0.2 * s, 0.33 * s, 0.24 * s], BOAT_FIGURE);
  solid.ellipsoid(at(0.3 * s, 0.98 * s, 0), [0.115 * s, 0.13 * s, 0.115 * s], BOAT_FIGURE);
  solid.ellipsoid(at(0.3 * s, 1.08 * s, 0), [0.15 * s, 0.045 * s, 0.15 * s], BOAT_FIGURE, 5, 10);
  // The standing figure sculls with one long oar over the stern.
  solid.tube(at(-1.52 * s, 0.2 * s, 0.08 * s), at(-1.5 * s, 0.86 * s, 0.07 * s), 0.07 * s, 0.085 * s, 6, BOAT_FIGURE);
  solid.tube(at(-1.48 * s, 0.2 * s, -0.1 * s), at(-1.5 * s, 0.86 * s, -0.07 * s), 0.07 * s, 0.085 * s, 6, BOAT_FIGURE);
  solid.ellipsoid(at(-1.5 * s, 1.18 * s, 0), [0.17 * s, 0.36 * s, 0.21 * s], BOAT_FIGURE);
  solid.ellipsoid(at(-1.47 * s, 1.66 * s, 0), [0.105 * s, 0.125 * s, 0.105 * s], BOAT_FIGURE);
  solid.ellipsoid(at(-1.47 * s, 1.76 * s, 0), [0.14 * s, 0.045 * s, 0.14 * s], BOAT_FIGURE, 5, 10);
  solid.tube(at(-1.5 * s, 1.36 * s, 0.2 * s), at(-1.95 * s, 1.1 * s, 0.1 * s), 0.05 * s, 0.045 * s, 5, BOAT_FIGURE);
  solid.tube(at(-1.3 * s, 1.5 * s, 0.05 * s), at(-3.6 * s, -0.25 * s, 0.25 * s), 0.028 * s, 0.05 * s, 5, BOAT_DARK);
}

interface Plume { origin: V3; height: number; lean: V3; width: number; dark: number }

/** A ship: hull, masts with yards and stays, and funnels that give smoke. */
function addShip(solid: Solid, plumes: Plume[], cx: number, cz: number, yaw: number, length: number, masts: number, funnels: number, mastHeight: number, col: RGB, rand: () => number): void {
  const at = placer(cx, cz, yaw);
  const beam = length * 0.16, free = length * 0.07;
  addHull(solid, cx, cz, yaw, length, beam, free, 0.32, true, col);
  const deckY = free;
  const cabin = at(0, deckY + free * 0.3, 0);
  solid.box(cabin[0], cabin[1], cabin[2], length * 0.16, free * 0.32, beam * 0.3, yaw, col);
  const bow = at(length * 0.5, deckY * 1.3, 0), stern = at(-length * 0.5, deckY * 1.3, 0);
  const tops: V3[] = [];
  for (let m = 0; m < masts; m++) {
    const x = length * (masts === 1 ? 0.12 : -0.34 + (0.68 * m) / (masts - 1));
    const h = mastHeight * (0.82 + 0.3 * rand()) * (m === 0 && masts > 2 ? 0.86 : 1);
    const foot = at(x, deckY, 0), top = at(x + h * 0.03, deckY + h, 0);
    solid.tube(foot, top, length * 0.0075 + 0.1, 0.07, 4, col);
    tops.push(top);
    // Yards cross the mast. The sails are furled.
    const yards = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < yards; k++) {
      const yy = deckY + h * (0.42 + (0.44 * k) / Math.max(yards, 1));
      const half = h * (0.26 - 0.05 * k) * (0.8 + 0.4 * rand());
      const skew = (rand() - 0.5) * 0.5;
      solid.tube(at(x - skew * half * 0.3, yy - half * 0.1 * skew, -half), at(x + skew * half * 0.3, yy + half * 0.1 * skew, half), 0.11, 0.11, 3, col);
    }
    // Shrouds to the two rails.
    solid.tube(top, at(x - h * 0.1, deckY, -beam * 0.45), 0.035, 0.035, 3, col);
    solid.tube(top, at(x - h * 0.1, deckY, beam * 0.45), 0.035, 0.035, 3, col);
  }
  if (tops.length > 0) {
    solid.tube(tops[tops.length - 1], bow, 0.035, 0.035, 3, col);
    solid.tube(tops[0], stern, 0.035, 0.035, 3, col);
    for (let m = 1; m < tops.length; m++) solid.tube(tops[m - 1], tops[m], 0.03, 0.03, 3, col);
  }
  for (let f = 0; f < funnels; f++) {
    const x = length * (funnels === 1 ? -0.03 : -0.1 + 0.16 * f);
    const h = mastHeight * 0.36;
    const foot = at(x, deckY, 0), top = at(x - h * 0.05, deckY + h, 0);
    solid.tube(foot, top, length * 0.022 + 0.25, length * 0.02 + 0.22, 7, col);
    plumes.push({ origin: top, height: 30 + 24 * rand(), lean: [-5 - 7 * rand(), 0, 3 * (rand() - 0.5)], width: 2.2 + 1.2 * rand(), dark: 0.6 });
  }
}

/** A harbour crane: braced legs, a cabin, a long jib, and its tie. */
function addCrane(solid: Solid, cx: number, cz: number, yaw: number, height: number, reach: number, rise: number, col: RGB): void {
  const at = placer(cx, cz, yaw);
  const w = height * 0.2, t = 0.24;
  const head = height * 0.62;
  const legs: V3[] = [at(-w, 0, -w), at(w, 0, -w), at(w, 0, w), at(-w, 0, w)];
  const caps: V3[] = [at(-w * 0.3, head, -w * 0.3), at(w * 0.3, head, -w * 0.3), at(w * 0.3, head, w * 0.3), at(-w * 0.3, head, w * 0.3)];
  for (let i = 0; i < 4; i++) {
    solid.tube(legs[i], caps[i], t, t * 0.8, 4, col);
    // Cross braces between the legs.
    const j = (i + 1) % 4;
    const mid = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    solid.tube(mid(legs[i], caps[i], 0.08), mid(legs[j], caps[j], 0.5), t * 0.5, t * 0.5, 3, col);
    solid.tube(mid(legs[j], caps[j], 0.5), mid(legs[i], caps[i], 0.95), t * 0.5, t * 0.5, 3, col);
  }
  const cabin = at(0, head + height * 0.06, 0);
  solid.box(cabin[0], cabin[1], cabin[2], w * 0.5, height * 0.06, w * 0.42, yaw, col);
  const pivot = at(w * 0.2, head + height * 0.1, 0);
  const tip = at(w * 0.2 + reach, head + height * 0.1 + rise, 0);
  const king = at(-w * 0.15, height, 0);
  solid.tube(pivot, tip, t * 1.1, t * 0.6, 4, col);
  solid.tube(at(-w * 0.15, head + height * 0.1, 0), king, t * 0.8, t * 0.6, 4, col);
  solid.tube(king, tip, 0.07, 0.07, 3, col);
  solid.tube(king, at(-w * 1.1, head + height * 0.08, 0), 0.07, 0.07, 3, col);
  solid.tube(tip, [tip[0], tip[1] - (tip[1] - 2) * 0.7, tip[2]], 0.06, 0.06, 3, col);
}

/** A dock shed with a gable roof. */
function addShed(solid: Solid, cx: number, cz: number, yaw: number, halfLen: number, halfDepth: number, wall: number, col: RGB): void {
  const at = placer(cx, cz, yaw);
  solid.box(cx, wall / 2, cz, halfLen, wall / 2, halfDepth, yaw, col);
  const ridge = wall + halfDepth * 0.55;
  const a = at(-halfLen, wall, -halfDepth), b = at(halfLen, wall, -halfDepth), c = at(halfLen, wall, halfDepth), d = at(-halfLen, wall, halfDepth);
  const r0 = at(-halfLen, ridge, 0), r1 = at(halfLen, ridge, 0);
  const roof: RGB = [col[0] * 0.86, col[1] * 0.86, col[2] * 0.9];
  solid.quad(a, r0, r1, b, roof);
  solid.quad(d, c, r1, r0, roof);
  solid.tri(a, d, r0, col);
  solid.tri(b, r1, c, col);
}

/** A quay deck on a row of timber piles. */
function addQuay(solid: Solid, cx: number, cz: number, yaw: number, halfLen: number, halfDepth: number, col: RGB): void {
  const at = placer(cx, cz, yaw);
  solid.box(cx, 1.05, cz, halfLen, 0.4, halfDepth, yaw, col);
  for (let x = -halfLen + 1; x <= halfLen - 1; x += 5.5) {
    for (const z of [-halfDepth + 0.4, halfDepth - 0.4]) solid.tube(at(x, -0.6, z), at(x, 1.9, z), 0.26, 0.24, 5, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.82]);
  }
}

function buildHarbour(solid: Solid, plumes: Plume[], rand: () => number): void {
  // Nearest layer, left: steamships at their moorings.
  addShip(solid, plumes, -78, -128, 0.25, 44, 2, 1, 23, SHIP, rand);
  addShip(solid, plumes, -122, -150, -0.1, 52, 3, 1, 27, SHIP, rand);
  addShip(solid, plumes, -42, -176, 0.5, 38, 3, 0, 26, SHIP, rand);
  // Nearest layer, right: the cranes of the outer dock and a ship under them.
  addCrane(solid, 62, -118, Math.PI * 0.86, 21, 17, 8, IRON);
  addCrane(solid, 86, -110, Math.PI * 0.2, 25, 21, 11, IRON);
  addCrane(solid, 112, -126, Math.PI * 1.1, 19, 15, 9, IRON);
  addCrane(solid, 134, -104, Math.PI * 0.7, 28, 22, 6, IRON);
  addShip(solid, plumes, 96, -138, -0.3, 46, 3, 1, 25, SHIP, rand);
  addQuay(solid, 104, -100, 0.1, 62, 6, SHED);
  addShed(solid, 152, -100, 0.1, 13, 5, 4.6, SHED);
  addShed(solid, 122, -99, 0.1, 9, 4.4, 3.4, SHED);
  for (let i = 0; i < 9; i++) {
    // Casks and bales wait on the quay.
    const x = 50 + rand() * 60, z = -100 + (rand() - 0.5) * 7 + (x - 104) * 0.1;
    const h = 0.5 + rand() * 0.7;
    solid.box(x, 1.45 + h, z, 0.6 + rand() * 1.4, h, 0.6 + rand(), rand() * 3, SHED);
  }
  // Second layer: a forest of masts, more cranes.
  for (let i = 0; i < 7; i++) {
    const x = -170 + i * 44 + (rand() - 0.5) * 24;
    if (Math.abs(x - 28) < 18) continue;
    addShip(solid, plumes, x, -188 - rand() * 36, (rand() - 0.5) * 1.2, 40 + rand() * 22, 2 + Math.floor(rand() * 2), rand() < 0.4 ? 1 : 0, 24 + rand() * 9, SHIP_FAR, rand);
  }
  addCrane(solid, 150, -205, Math.PI * 0.9, 30, 24, 10, SHIP_FAR);
  addCrane(solid, 186, -190, Math.PI * 0.3, 26, 20, 12, SHIP_FAR);
  addCrane(solid, -190, -232, Math.PI * 0.1, 27, 20, 10, SHIP_FAR);
  // Third layer: the quays, sheds, and factory stacks of the town.
  solid.box(0, 1.6, -345, 520, 1.6, 6, 0, SHIP_FAR);
  for (let i = 0; i < 16; i++) {
    const x = -420 + i * 56 + (rand() - 0.5) * 30;
    const w = 14 + rand() * 22, h = 2.5 + rand() * 4.5;
    solid.box(x, h, -362 - rand() * 30, w, h, 8, 0, SHIP_FAR);
    // Nothing tall stands in front of the sun.
    if (rand() < 0.45 && Math.abs(x - 48) > 40) {
      const sx = x + (rand() - 0.5) * w, sh = 26 + rand() * 18, sz = -370;
      solid.tube([sx, 0, sz], [sx, sh, sz], 1.7, 1.0, 6, SHIP_FAR);
      plumes.push({ origin: [sx, sh, sz], height: 36 + rand() * 20, lean: [-14 - rand() * 12, 0, 0], width: 4.0, dark: 0.4 });
    }
  }
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const AIR = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uSun;
uniform float uTime;
#define FOG_K 0.0105
// Colour of the mist toward a direction. Warmth gathers on the bearing of the sun.
vec3 hazeColor(vec3 d) {
  float el = clamp(d.y, 0.0, 1.0);
  float toSun = max(dot(normalize(d.xz + vec2(1e-5, 0.0)), normalize(uSun.xz)), 0.0);
  vec3 col = mix(vec3(0.515, 0.565, 0.665), vec3(0.50, 0.575, 0.625), smoothstep(0.0, 0.5, el));
  col = mix(col, vec3(0.76, 0.62, 0.60), pow(toSun, 5.0) * 0.36 * (1.0 - smoothstep(0.0, 0.55, el)));
  // The glow of the sun in the mist.
  float ang = acos(clamp(dot(normalize(d), uSun), -1.0, 1.0));
  col += vec3(0.95, 0.40, 0.20) * (exp(-ang * 13.0) * 0.24 + exp(-ang * 55.0) * 0.2);
  return col;
}
float fogAmount(float dist) { return 1.0 - exp(-dist * FOG_K); }
vec3 fog(vec3 col, vec3 wp) {
  vec3 v = wp - uCam;
  float dist = length(v);
  return mix(col, hazeColor(v / dist), fogAmount(dist));
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
${GLSL_NOISE}
${AIR}
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  vec3 col = hazeColor(d);
  float toSun = dot(normalize(d.xz + vec2(1e-5, 0.0)), normalize(uSun.xz));
  // Long loaded strokes of salmon and rose cross the upper sky. They slant a little.
  vec2 q = vec2(az * 2.6, el * 8.0 + az * 0.7);
  float n1 = fbm(q * vec2(0.9, 2.4) + vec2(uTime * 0.004, 3.0));
  float n2 = fbm(q * vec2(2.6, 7.0) + 11.0);
  float band = smoothstep(0.045, 0.17, el) * (1.0 - smoothstep(0.5, 1.0, el));
  float warm = smoothstep(0.45, 0.70, n1 * 0.75 + n2 * 0.32) * band * (0.25 + 0.75 * smoothstep(-0.2, 0.95, toSun));
  col = mix(col, vec3(0.86, 0.64, 0.53), warm * 0.62);
  // Grey-green scumble higher up.
  float cool = smoothstep(0.48, 0.74, fbm(q * vec2(1.4, 3.6) + 27.0)) * smoothstep(0.1, 0.45, el);
  col = mix(col, vec3(0.41, 0.49, 0.54), cool * 0.42);
  // The sun: a flat vermilion disc with a dabbed edge, and a thin glow in the mist.
  float ang = acos(clamp(dot(d, uSun), -1.0, 1.0));
  float rad = 0.0185 * (1.0 + 0.09 * (vnoise((d.xy - uSun.xy) * 150.0 + 4.0) - 0.5));
  vec3 sunCol = mix(vec3(0.96, 0.36, 0.13), vec3(1.0, 0.53, 0.22), vnoise(d.xy * 240.0 + 9.0));
  col = mix(col, sunCol, 1.0 - smoothstep(rad - 0.0016, rad + 0.0012, ang));
  // Below the horizon the dome is mist over water.
  col = mix(hazeColor(vec3(d.x, 0.0, d.z)), col, smoothstep(-0.02, 0.004, el));
  gl_FragColor = vec4(col, 1.0);
}
`;

const WATER_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */ `
${GLSL_NOISE}
${AIR}
uniform vec4 uBoats[3];
varying vec3 vWp;
void main() {
  vec3 toCam = uCam - vWp;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 p = vWp.xz;
  // The water takes the colour of the mist above it, and turns to deep teal near the eye.
  vec3 R = normalize(vec3(-V.x, max(V.y, 0.0) * 0.6 + 0.03, -V.z));
  vec3 sky = hazeColor(R);
  float graze = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  vec3 col = mix(vec3(0.31, 0.425, 0.475), sky * vec3(0.93, 0.98, 1.0), 0.3 + 0.62 * graze);
  // Thin washes: long level streaks of lighter and darker paint.
  float along = p.x + 0.25 * p.y;
  float toward = p.y;
  float wash = fbm(vec2(along * 0.045, toward * 0.42) + vec2(uTime * 0.012, 0.0));
  float fine = vnoise(vec2(along * 0.22, toward * 2.6) - vec2(uTime * 0.05, 0.0));
  col *= 0.90 + 0.17 * wash + 0.06 * fine;
  // The soft orange stain under the sun.
  float toSun = max(dot(normalize(-V.xz + vec2(1e-5, 0.0)), normalize(uSun.xz)), 0.0);
  col = mix(col, vec3(0.90, 0.52, 0.34), pow(toSun, 900.0) * 0.30 * smoothstep(4.0, 30.0, dist) + pow(toSun, 60.0) * 0.07);
  // Each boat lays a dark, broken reflection toward the eye.
  for (int i = 0; i < 3; i++) {
    vec4 b = uBoats[i];
    vec2 rel = p - b.xy;
    vec2 dirEye = uCam.xz - b.xy;
    float eyeDist = length(dirEye);
    dirEye /= eyeDist;
    float a = dot(rel, dirEye);
    float c = abs(dot(rel, vec2(-dirEye.y, dirEye.x)));
    float reach = eyeDist * b.w / (uCam.y + b.w);
    float m = smoothstep(b.z, b.z * 0.35, c) * smoothstep(-0.6, 0.2, a) * (1.0 - smoothstep(reach * 0.35, reach, a));
    m *= 0.55 + 0.45 * smoothstep(0.3, 0.6, vnoise(vec2(c * 2.0, a * 3.5 / max(reach * 0.2, 0.3)) + vec2(0.0, uTime * 0.12)));
    col = mix(col, vec3(0.13, 0.22, 0.26), m * 0.72);
  }
  // The far water dissolves: no horizon line stands in the mist.
  col = mix(col, hazeColor(vec3(-V.x, 0.0, -V.z)), fogAmount(dist * 1.7));
  gl_FragColor = vec4(col, 1.0);
}
`;

const SOLID_VERT = /* glsl */ `
attribute vec3 aCol;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vCol;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normal;
  vCol = aCol;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SOLID_FRAG = /* glsl */ `
${GLSL_NOISE}
${AIR}
varying vec3 vWp;
varying vec3 vN;
varying vec3 vCol;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // Flat dark paint, a little lighter on top, with a warm edge toward the sun.
  float brush = vnoise3(vWp * vec3(1.6, 4.5, 1.6));
  vec3 col = vCol * (0.78 + 0.22 * n.y) * (0.86 + 0.28 * brush);
  col += vec3(0.80, 0.36, 0.18) * pow(max(dot(n, uSun), 0.0), 2.0) * 0.07;
  gl_FragColor = vec4(fog(col, vWp), 1.0);
}
`;

// Water dashes. The instance matrix holds the record, not a transform.
//   column 0: x, z, seed, kind (0 = ripple, 1 = sun bar)
//             a sun bar holds: distance along the bearing, lateral share (-1 to 1)
//   column 1: colour.rgb, size factor
//   column 2: phase, bend, 0, 0
const DASH_VERT = /* glsl */ `
${GLSL_NOISE}
${AIR}
uniform float uSunBearing;
varying vec3 vColor;
varying vec3 vQ;
void main() {
  vec4 c0 = instanceMatrix[0];
  vec4 c1 = instanceMatrix[1];
  vec4 c2 = instanceMatrix[2];
  float seed = c0.z;
  float kind = c0.w;
  float ph = c2.x;
  // The dash lies level on the picture plane, like a stroke of a flat brush.
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 centre = vec3(c0.x, 0.0, c0.y);
  float grow = 1.0;
  if (kind > 0.5) {
    // The glitter path runs from the eye toward the sun. Each bar takes a site
    // on a lattice that is fixed in the water, so bars light and go out as the
    // path moves across them.
    vec2 sdir = vec2(sin(uSunBearing), -cos(uSunBearing));
    vec2 perp = vec2(-sdir.y, sdir.x);
    float r = c0.x;
    float wide = (0.3 + 0.019 * r) * (0.75 + 0.25 * sin(uTime * 0.9 + ph));
    float cell = 0.085 * pow(r, 0.93) + 0.25;
    vec2 P = uCam.xz + sdir * (r + uTime * 0.05 * cell) + perp * (c0.y * wide);
    vec2 g = floor(P / cell);
    vec2 f = P / cell - g;
    vec3 h = hash23(g + floor(seed * 7.0) * 13.0);
    vec2 site = (g + 0.5 + (h.xy - 0.5) * 0.7) * cell;
    centre = vec3(site.x, 0.0, site.y);
    float lateral = abs(dot(site - uCam.xz, perp));
    grow = 1.0 - smoothstep(wide * (0.35 + 0.7 * h.z), wide * (0.55 + 0.8 * h.z), lateral);
    grow *= smoothstep(0.0, 0.22, f.x) * smoothstep(1.0, 0.78, f.x) * smoothstep(0.0, 0.22, f.y) * smoothstep(1.0, 0.78, f.y);
  }
  vec2 toP = centre.xz - uCam.xz;
  float dist = length(vec3(toP.x, uCam.y, toP.y));
  float dc = clamp(dist, 2.0, 500.0);
  float halfL;
  float halfW;
  vec3 col = c1.rgb;
  if (kind < 0.5) {
    halfL = 0.115 * pow(dc, 0.62) * c1.w;
    halfW = halfL * mix(0.085, 0.05, smoothstep(8.0, 160.0, dc));
    grow = 0.72 + 0.28 * sin(uTime * 0.45 + ph * 3.0);
    vec3 dir = normalize(centre - uCam);
    col = mix(col, hazeColor(vec3(dir.x, 0.0, dir.z)), fogAmount(dist * 1.9));
  } else {
    grow *= smoothstep(2.5, 6.0, dc) * (1.0 - 0.8 * smoothstep(120.0, 300.0, dc));
    halfL = 0.034 * pow(dc, 0.93) * c1.w;
    halfW = halfL * mix(0.22, 0.075, smoothstep(10.0, 200.0, dc));
    vec3 dir = normalize(centre - uCam);
    col = mix(col, hazeColor(dir) + vec3(0.16, 0.02, -0.05), fogAmount(dist) * 0.55);
  }
  centre += right * (sin(uTime * 0.5 + ph) * 0.22 * halfL);
  centre.y = halfW * up.y + 0.03 + kind * 0.03;
  float bend = c2.y * (position.x * position.x - 0.35);
  vec3 p = centre + right * (position.x * halfL * grow) + up * ((position.y + bend) * halfW * grow);
  vQ = vec3(position.xy, seed);
  vColor = col;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const DASH_FRAG = /* glsl */ `
${GLSL_NOISE}
varying vec3 vColor;
varying vec3 vQ;
void main() {
  // Bristle streaks run along the dash. The lower edge holds more paint.
  float bristle = vnoise(vec2(vQ.x * 2.2 + vQ.z * 70.0, vQ.y * 3.4 + vQ.z * 31.0));
  vec3 col = vColor * (0.92 + 0.16 * bristle) * (1.0 + 0.05 * vQ.y);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Dabs that hang in the air: haze and smoke. Blended over the scene.
//   column 0: origin.xyz, half length
//   column 1: tint.rgb (offset from the mist colour), alpha
//   column 2: phase, kind (0 = haze, 1 = smoke), half width, plume height
//   column 3: plume lean.xyz, darkness of the smoke
const DAB_VERT = /* glsl */ `
${AIR}
varying vec4 vColor;
varying vec2 vQ;
void main() {
  vec4 c0 = instanceMatrix[0];
  vec4 c1 = instanceMatrix[1];
  vec4 c2 = instanceMatrix[2];
  vec4 c3 = instanceMatrix[3];
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 centre = c0.xyz;
  float halfL = c0.w;
  float halfW = c2.z;
  float alpha = c1.a;
  float ph = c2.x;
  vec3 col;
  if (c2.y > 0.5) {
    // A puff climbs its plume, widens, and thins out.
    float s = fract(ph + uTime * 0.011);
    float h = c2.w;
    centre += vec3(0.0, h * pow(s, 0.8), 0.0) + c3.xyz * (s * s);
    centre.x += sin(ph * 40.0 + s * 9.0) * halfL * 0.5 * s;
    float swell = 0.5 + 1.1 * s;
    halfL *= swell;
    halfW *= swell;
    alpha *= smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.45, 1.0, s));
    vec3 v = centre - uCam;
    float dist = length(v);
    vec3 mist = hazeColor(v / dist);
    col = mix(mist, vec3(0.30, 0.35, 0.45), c3.w * exp(-dist * FOG_K * 0.6) * (1.0 - 0.6 * s));
  } else {
    centre.x += sin(uTime * 0.05 + ph) * halfL * 0.3;
    vec3 v = centre - uCam;
    float dist = length(v);
    col = hazeColor(v / dist) + c1.rgb;
    // A dab that is close to the eye melts away.
    alpha *= smoothstep(12.0, 55.0, dist);
  }
  vec3 p = centre + right * (position.x * halfL) + up * (position.y * halfW);
  vQ = position.xy;
  vColor = vec4(col, alpha);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const DAB_FRAG = /* glsl */ `
varying vec4 vColor;
varying vec2 vQ;
void main() {
  // Soft at the ends and along the edges, like paint dragged thin.
  float a = vColor.a * (1.0 - vQ.x * vQ.x * vQ.x * vQ.x) * (1.0 - vQ.y * vQ.y);
  gl_FragColor = vec4(vColor.rgb, a);
}
`;

const POST_FRAG = /* glsl */ `
vec3 scene(vec2 uv) { return texture2D(tScene, uv).rgb; }
float luma(vec3 c) { return dot(c, vec3(0.3, 0.6, 0.1)); }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  // Kuwahara: keep the calmest of four neighbourhoods, so tone gathers into touches.
  vec3 best = vec3(0.0);
  float bestVar = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 sgn = vec2(q == 0 || q == 2 ? 1.0 : -1.0, q < 2 ? 1.0 : -1.0);
    vec3 m = vec3(0.0); vec3 m2 = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 3; i++) {
        vec3 c = scene(vUv + sgn * vec2(float(i) * 1.5, float(j)) * px * 1.2);
        m += c; m2 += c * c;
      }
    }
    m /= 9.0; m2 = m2 / 9.0 - m * m;
    float v = m2.r + m2.g + m2.b;
    if (v < bestVar) { bestVar = v; best = m; }
  }
  vec3 col = mix(scene(vUv), best, 0.8);

  // Thin paint: the wash pools and breaks over the canvas, in level drags of the brush.
  float drag = vnoise(cv * vec2(0.012, 0.085) + 3.0) * 0.6 + vnoise(cv * vec2(0.035, 0.24) + 17.0) * 0.4;
  float pool = fbm(cv * 0.011 + 40.0);
  col *= 0.93 + 0.09 * drag + 0.06 * pool;
  col = mix(col, col * vec3(1.03, 1.0, 0.95), smoothstep(0.45, 0.8, pool) * 0.6);

  // Impasto on the loaded strokes, and the weave under everything.
  float l0 = luma(best);
  float lx = luma(scene(vUv + vec2(px.x * 1.6, 0.0))) - l0;
  float ly = luma(scene(vUv + vec2(0.0, px.y * 1.6))) - l0;
  float relief = lx - ly;
  col *= 1.0 + relief * 1.3;
  col += vec3(1.0, 0.95, 0.88) * smoothstep(0.03, 0.14, relief) * 0.05;
  col *= 0.90 + 0.14 * canvasWeave(cv);

  // Grade: keep the greys cool and let the vermilion burn.
  float lum = luma(col);
  float warm = clamp((col.r - col.b) * 2.6, 0.0, 1.0);
  col = mix(vec3(lum), col, 1.06 + 0.3 * warm);
  col = mix(col, col * vec3(0.95, 0.99, 1.05), (1.0 - warm) * 0.5);
  col *= vignette(vUv, 0.3);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Stroke geometry and layout
// ---------------------------------------------------------------------------

/** One level dash of a flat brush: x runs -1 to 1 along it, y is the signed half width. */
function buildDashGeometry(): THREE.BufferGeometry {
  const profile = [0.22, 0.72, 0.96, 1.0, 0.94, 0.78, 0.3];
  const pos: number[] = [];
  const idx: number[] = [];
  profile.forEach((w, i) => {
    const t = (i / (profile.length - 1)) * 2 - 1;
    pos.push(t, -w, 0, t, w, 0);
  });
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const RIPPLE_DARK: RGB[] = [hex(0x24424c), hex(0x1c3640), hex(0x2d4f58), hex(0x284352), hex(0x35555c)];
const RIPPLE_MID: RGB[] = [hex(0x4c6a78), hex(0x56707f), hex(0x466673)];
const RIPPLE_LIGHT: RGB[] = [hex(0x7f95a4), hex(0x8a9eaa), hex(0x9097ac), hex(0x7a929b)];
const BAR: RGB[] = [hex(0xf2622b), hex(0xf47a35), hex(0xe9532a), hex(0xf8904a), hex(0xdd4a2c)];

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.min(Math.floor(rand() * list.length), list.length - 1)];
}

interface Boat { x: number; z: number; yaw: number; scale: number }
const BOATS: Boat[] = [
  { x: -2.1, z: -4.5, yaw: 0.22, scale: 1.25 },
  { x: -14, z: -33, yaw: -0.15, scale: 1.05 },
  { x: -32, z: -64, yaw: 0.3, scale: 1.1 },
];

function layDashes(rand: () => number): { data: Float32Array; ripples: number; bars: number } {
  const out: number[] = [];
  const add = (x: number, z: number, kind: number, col: RGB, size: number): void => {
    out.push(x, z, rand(), kind, col[0], col[1], col[2], size, rand() * 6.283, (rand() - 0.5) * 0.9, 0, 0, 0, 0, 0, 1);
  };
  const ripple = (x: number, z: number, r: number): void => {
    // Near the eye most dashes are dark; in the distance they pale into the mist.
    const k = rand();
    const far = Math.min(r / 140, 1);
    const col = k < 0.66 - 0.3 * far ? pick(RIPPLE_DARK, rand) : k < 0.9 ? pick(RIPPLE_MID, rand) : pick(RIPPLE_LIGHT, rand);
    add(x, z, 0, col, 0.45 + 1.0 * rand());
  };
  let ripples = 0;
  // The foreground, where the painter set the dashes thick.
  for (let i = 0; i < 3400; i++) {
    const r = 2.5 + 120 * Math.pow(rand(), 2.0);
    const az = (rand() - 0.5) * 1.7;
    ripple(EYE[0] + Math.sin(az) * r, EYE[1] - Math.cos(az) * r, r);
    ripples++;
  }
  // The rest of the harbour, thinner.
  for (let i = 0; i < 9000; i++) {
    const r = 3 + 300 * Math.pow(rand(), 1.5);
    const az = rand() * Math.PI * 2;
    ripple(EYE[0] + Math.sin(az) * r, EYE[1] - Math.cos(az) * r, r);
    ripples++;
  }
  // The docks, where the eye can also go.
  for (let i = 0; i < 4500; i++) {
    const r = 230 * Math.sqrt(rand());
    const az = rand() * Math.PI * 2;
    ripple(40 + Math.sin(az) * r, -70 - Math.cos(az) * r, 60);
    ripples++;
  }
  // Dark dashes break the reflection under each boat.
  for (const b of BOATS) {
    const dx = EYE[0] - b.x, dz = EYE[1] - b.z;
    const d = Math.hypot(dx, dz);
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.min(d * 0.36, 9) - 0.3;
      const c = (rand() - 0.5) * 3.6 * b.scale;
      add(b.x + (dx / d) * a - (dz / d) * c, b.z + (dz / d) * a + (dx / d) * c, 0, pick(RIPPLE_DARK, rand), 0.5 + 0.7 * rand());
      ripples++;
    }
  }
  let bars = 0;
  for (let i = 0; i < 520; i++) {
    add(3.5 + 270 * Math.pow(rand(), 2.2), rand() * 2 - 1, 1, pick(BAR, rand), 0.5 + 0.9 * rand());
    bars++;
  }
  return { data: new Float32Array(out), ripples, bars };
}

function layDabs(plumes: Plume[], rand: () => number): Float32Array {
  const out: number[] = [];
  const LIGHT: RGB = [0.055, 0.055, 0.05], BLUE: RGB = [-0.06, -0.04, -0.005], WARM: RGB = [0.17, 0.03, -0.05], LILAC: RGB = [0.03, -0.012, 0.055];
  const sunDir: [number, number] = [Math.sin(SUN_BEARING), -Math.cos(SUN_BEARING)];
  for (let i = 0; i < 1500; i++) {
    const front = rand() < 0.68;
    const az = front ? (rand() - 0.5) * 1.8 : rand() * Math.PI * 2;
    const r = 55 + 470 * Math.pow(rand(), 1.3);
    const el = 0.52 * Math.pow(rand(), 1.5);
    const x = EYE[0] + Math.sin(az) * r, z = EYE[1] - Math.cos(az) * r;
    const toSun = Math.max(Math.sin(az) * sunDir[0] - Math.cos(az) * sunDir[1], 0);
    const k = rand();
    const warmShare = 0.12 + 0.5 * toSun * toSun * (el > 0.05 ? 1 : 0.2);
    const tint = k < warmShare ? WARM : k < warmShare + 0.3 ? LIGHT : k < warmShare + 0.55 ? BLUE : LILAC;
    const halfL = r * (0.035 + 0.05 * rand());
    out.push(x, 1 + r * Math.tan(el), z, halfL, tint[0], tint[1], tint[2], 0.14 + 0.26 * rand(), rand() * 6.283, 0, halfL * (0.11 + 0.1 * rand()), 0, 0, 0, 0, 0);
  }
  for (const p of plumes) {
    for (let i = 0; i < 38; i++) {
      const w = p.width * (0.7 + 0.6 * rand());
      out.push(p.origin[0], p.origin[1], p.origin[2], w * 1.3, 0, 0, 0, 0.16 + 0.2 * rand(), rand(), 1, w, p.height * (0.8 + 0.4 * rand()),
        p.lean[0] * (0.7 + 0.6 * rand()), 0, p.lean[2] + (rand() - 0.5) * 3, p.dark);
    }
  }
  return new Float32Array(out);
}

// ---------------------------------------------------------------------------

export function createImpressionSunrise(): PaintingScene {
  const scene = new THREE.Scene();
  const near = 0.3, far = 3000;
  const rand = mulberry32(1872);
  const air = { uCam: { value: new THREE.Vector3() }, uSun: { value: SUN }, uTime: { value: 0 } };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: air, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const boatUniform = BOATS.map((b) => new THREE.Vector4(b.x, b.z, 1.5 * b.scale, 1.5 * b.scale));
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(far * 0.85, 64),
    new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: { ...air, uBoats: { value: boatUniform } },
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 4,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.frustumCulled = false;
  scene.add(water);

  const solid = new Solid();
  const plumes: Plume[] = [];
  for (const b of BOATS) addRowboat(solid, b.x, b.z, b.yaw, b.scale);
  buildHarbour(solid, plumes, rand);
  const solidMesh = new THREE.Mesh(
    solid.build(),
    new THREE.ShaderMaterial({ vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG, uniforms: air, side: THREE.DoubleSide }),
  );
  solidMesh.frustumCulled = false;
  scene.add(solidMesh);

  const dashGeometry = buildDashGeometry();
  const dashes = layDashes(rand);
  const dashCount = dashes.data.length / 16;
  const dashMesh = new THREE.InstancedMesh(
    dashGeometry,
    new THREE.ShaderMaterial({
      vertexShader: DASH_VERT,
      fragmentShader: DASH_FRAG,
      uniforms: { ...air, uSunBearing: { value: SUN_BEARING } },
      side: THREE.DoubleSide,
    }),
    dashCount,
  );
  (dashMesh.instanceMatrix.array as Float32Array).set(dashes.data);
  dashMesh.instanceMatrix.needsUpdate = true;
  dashMesh.frustumCulled = false;
  scene.add(dashMesh);

  const dabData = layDabs(plumes, rand);
  const dabCount = dabData.length / 16;
  const dabMesh = new THREE.InstancedMesh(
    dashGeometry.clone(),
    new THREE.ShaderMaterial({
      vertexShader: DAB_VERT,
      fragmentShader: DAB_FRAG,
      uniforms: air,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    }),
    dabCount,
  );
  (dabMesh.instanceMatrix.array as Float32Array).set(dabData);
  dabMesh.instanceMatrix.needsUpdate = true;
  dabMesh.frustumCulled = false;
  dabMesh.renderOrder = 2;
  scene.add(dabMesh);

  const lead = BOATS[0];

  return {
    scene,
    meta: {
      title: 'Impression, Sunrise',
      artist: 'Claude Monet · 1872',
      technique: `Distance-law fog that fades every layer to the mist colour of its bearing, ${Math.round(dashes.ripples / 1000)}k level brush dashes on the water, ${dashes.bars} vermilion sun bars that relight on a water lattice along the bearing of the sun, blended smoke and haze dabs, Kuwahara wash with canvas weave.`,
    },
    presets: [
      { name: 'The Painting', position: [0, 2.4, 20], target: [0, 2.0, 0], fov: 36 },
      { name: 'Beside the Oarsman', position: [lead.x - 1.3, 0.9, lead.z + 9.2], target: [lead.x + 0.3, 1.0, lead.z], fov: 50 },
      { name: 'Among the Cranes', position: [93, 4.5, -62], target: [106, 15, -190], fov: 56 },
      { name: 'Above the Rowboats', position: [-15, 14, 24], target: [-5, 0, -16], fov: 46 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near,
    far,
    flySpeed: 14,
    maxDistance: 320,
    floorAt: () => 0.45,
    update(ctx: FrameContext): void {
      air.uTime.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      air.uCam.value.copy(ctx.camera.position);
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
