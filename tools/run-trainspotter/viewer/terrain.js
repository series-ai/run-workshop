// terrain.js: procedural scenery for the demo railways, in the kit's chunky voxel style.
// Mountains are terraced heightfields of voxel columns (one InstancedMesh each) that leave
// real tunnel bores; plus a model-railway baseboard and backdrop, plateaus with retaining
// walls, roads, and stand-in trees, buildings, cars and people for when the kit's own
// scenery models are not there. All units are voxels; +Y up.
import * as THREE from 'three';
import { rotate } from './trackpath.js';

const RAD = Math.PI / 180;

/** A small deterministic random number generator (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const UNIT = new THREE.BoxGeometry(1, 1, 1);

/** Many boxes in one draw call: boxes = [{x, y, z, w, h, d, color}] (centre and size). */
export function boxes(list, material = lambert(0xffffff)) {
  const mesh = new THREE.InstancedMesh(UNIT, material, Math.max(1, list.length));
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  list.forEach((b, i) => {
    m.makeScale(b.w, b.h, b.d);
    m.setPosition(b.x, b.y, b.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(b.color));
  });
  mesh.count = list.length;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** A group placed in a layout step's frame: local -Z runs along the track from connector a, +X to its right. */
export function stepFrame(pc, along = 0, lateral = 0, turn = 0) {
  const g = new THREE.Group();
  const [x, z] = rotate(lateral, -along, pc.theta);
  g.position.set(pc.tx + x, pc.ty, pc.tz + z);
  g.rotation.y = (pc.theta + turn) * RAD;
  return g;
}

const GRASS = [0x6e9c46, 0x78a84d, 0x83b153, 0x8fb85a, 0x9cbf62];
const ROCK = [0x8c8f94, 0x9a9da2, 0xa9acb0];
const SNOW = 0xf1f3f5;

/**
 * A terraced voxel mountain in a frame whose -Z runs along `u` and +X is `l`.
 * opts: u0, u1, l0, l1 (footprint), peak, base, cell, seed, inside(u, l) (extra footprint test),
 * shape(u, l) (a 0..1 height multiplier, e.g. to fall away toward a track),
 * bores: [{ l, half, u0, u1, top }] (tunnels: open below `top` across l±half, lined in black).
 * Returns { group, tops } where tops are terrace points (frame coords) for trees.
 */
export function mountain(opts) {
  const { u0, u1, l0, l1, peak = 220, base = 36, cell = 16, seed = 1, inside = () => true, shape = () => 1, bores = [], rockAt = 170, snowAt = 280 } = opts;
  const r = rng(seed);
  const cols = [];
  const tops = [];
  const hu = (u1 - u0) / 2, hl = (l1 - l0) / 2;
  const uc = (u0 + u1) / 2, lc = (l0 + l1) / 2;
  // a few lumps so the range has several peaks
  const lumps = opts.lumps ?? Array.from({ length: 3 }, () => ({ u: u0 + r() * (u1 - u0), l: l0 + r() * (l1 - l0), h: 0.55 + r() * 0.45, s: 0.35 + r() * 0.3 }));
  for (let u = u0; u < u1; u += cell) {
    for (let l = l0; l < l1; l += cell) {
      const cu = u + cell / 2, cl = l + cell / 2;
      if (!inside(cu, cl)) continue;
      const edge = Math.min(cu - u0, u1 - cu, cl - l0, l1 - cl) / Math.min(hu, hl);
      let h = 0;
      for (const k of lumps) {
        const d = Math.hypot((cu - k.u) / (hu * k.s * 2), (cl - k.l) / (hl * k.s * 2));
        h = Math.max(h, k.h * Math.max(0, 1 - d * d));
      }
      h = base + (peak - base) * Math.min(1, Math.max(h, Math.min(1, edge * 1.4) * 0.45)) + (r() - 0.5) * 18;
      h *= Math.min(1, 0.18 + edge * 2) * shape(cu, cl); // slopes down to the foothills at the edges
      let lo = 0;
      for (const b of bores) {
        const overU = cu > b.u0 - cell && cu < b.u1 + cell;
        const near = Math.abs(cl - b.l) - b.half;
        if (overU && near < cell / 2) lo = Math.max(lo, b.top); // over the bore: open below its top
        // well above the arch over the tunnel, falling away in terraces to either side
        if (overU) h = Math.max(h, near <= 24 ? b.top + 52 : (b.top + 52) * Math.max(0, 1 - (near - 24) / 170));
      }
      h = Math.max(base * 0.6, Math.round(h / 12) * 12);
      if (h <= lo + 4) continue;
      const tone = h >= snowAt ? SNOW : h >= rockAt ? ROCK[Math.floor(r() * ROCK.length)] : GRASS[Math.min(GRASS.length - 1, Math.floor((h / rockAt) * GRASS.length * 0.8 + r() * 1.4))];
      cols.push({ x: cl, y: (lo + h) / 2, z: -cu, w: cell, h: h - lo, d: cell, color: tone });
      if (h < rockAt && r() < 0.16) tops.push([cl + (r() - 0.5) * 8, h, -cu + (r() - 0.5) * 8]);
    }
  }
  const group = new THREE.Group();
  group.add(boxes(cols));
  // black lining inside every bore: walls and roof, so a portal shows a dark tunnel
  const lining = [];
  for (const b of bores) {
    const len = b.u1 - b.u0 - 8, mid = -(b.u0 + b.u1) / 2;
    for (const s of [-1, 1]) lining.push({ x: b.l + s * (b.half + 3), y: b.top / 2, z: mid, w: 6, h: b.top, d: len, color: 0x15161a });
    lining.push({ x: b.l, y: b.top + 3, z: mid, w: b.half * 2 + 24, h: 6, d: len, color: 0x15161a });
  }
  if (lining.length) group.add(boxes(lining, lambert(0xffffff)));
  return { group, tops };
}

/** A flat-topped plateau (raised ground under elevated track) with white retaining walls. */
export function plateau({ x0, x1, z0, z1, top, wall = 0xe6e3da, grass = 0x7aa64e }) {
  const g = new THREE.Group();
  const w = x1 - x0, d = z1 - z0;
  g.add(boxes([
    { x: (x0 + x1) / 2, y: (top - 1) / 2, z: (z0 + z1) / 2, w, h: top - 1, d, color: wall },
    { x: (x0 + x1) / 2, y: top - 0.5, z: (z0 + z1) / 2, w: w + 0.4, h: 1, d: d + 0.4, color: grass },
  ]));
  // wall courses
  const lines = [];
  for (let y = 8; y < top - 4; y += 8) {
    lines.push({ x: (x0 + x1) / 2, y, z: z1 + 0.3, w, h: 1, d: 0.6, color: 0xc9c5ba });
    lines.push({ x: (x0 + x1) / 2, y, z: z0 - 0.3, w, h: 1, d: 0.6, color: 0xc9c5ba });
    lines.push({ x: x0 - 0.3, y, z: (z0 + z1) / 2, w: 0.6, h: 1, d, color: 0xc9c5ba });
    lines.push({ x: x1 + 0.3, y, z: (z0 + z1) / 2, w: 0.6, h: 1, d, color: 0xc9c5ba });
  }
  g.add(boxes(lines));
  return g;
}

/** A model-railway baseboard: the grass top at y = 0, a timber frame with a dark fascia, legs. */
export function baseboard({ x0, x1, z0, z1, thick = 40 }) {
  const g = new THREE.Group();
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  g.add(boxes([
    { x: cx, y: -thick / 2 - 2, z: cz, w, h: thick, d, color: 0x9a6a3e },
    { x: cx, y: -1, z: cz, w: w - 2, h: 1.6, d: d - 2, color: 0x7fae5a }, // grass: top just under the track bed
    { x: cx, y: -thick / 2 - 2, z: z1 + 1, w: w + 4, h: thick + 4, d: 2, color: 0x2e3a2c },
    { x: cx, y: -thick / 2 - 2, z: z0 - 1, w: w + 4, h: thick + 4, d: 2, color: 0x2e3a2c },
    { x: x0 - 1, y: -thick / 2 - 2, z: cz, w: 2, h: thick + 4, d: d + 4, color: 0x2e3a2c },
    { x: x1 + 1, y: -thick / 2 - 2, z: cz, w: 2, h: thick + 4, d: d + 4, color: 0x2e3a2c },
    ...[[x0 + 40, z0 + 40], [x1 - 40, z0 + 40], [x0 + 40, z1 - 40], [x1 - 40, z1 - 40]].map(([x, z]) => ({ x, y: -thick - 200, z, w: 30, h: 400, d: 30, color: 0x7d5532 })),
  ]));
  return g;
}

/** A painted backdrop: sky fading to haze with pale distant hills, standing along the back edge. */
export function backdrop({ x0, x1, z, height = 520, seed = 3, side = false }) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#7fb4e6');
  sky.addColorStop(0.75, '#cfe3f2');
  sky.addColorStop(1, '#e8f1f2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 128);
  const r = rng(seed);
  for (const [tone, base, amp] of [['#b9cfd6', 84, 30], ['#9fbfae', 100, 22], ['#86ad84', 114, 14]]) {
    ctx.fillStyle = tone;
    let y = base;
    for (let x = 0; x < 512; x += 4) {
      y = Math.max(base - amp, Math.min(base + 6, y + (r() - 0.5) * 9));
      ctx.fillRect(x, Math.round(y), 4, 128);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, height), new THREE.MeshBasicMaterial({ map: tex }));
  if (side) { // standing along x = z at the left edge, facing +X; x0..x1 are then z extents
    m.rotation.y = Math.PI / 2;
    m.position.set(z, height / 2 - 40, (x0 + x1) / 2);
  } else m.position.set((x0 + x1) / 2, height / 2 - 40, z);
  return m;
}

/** A road strip from (x0, z0) to (x1, z1) (axis-aligned), width w, with a dashed centre line. */
export function road(x0, z0, x1, z1, w = 40) {
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const list = [{ x: cx, y: 0.15, z: cz, w: along ? len : w, h: 0.3, d: along ? w : len, color: 0x5d6066 }];
  for (const s of [-1, 1]) list.push({ x: cx + (along ? 0 : s * (w / 2 + 3)), y: 0.6, z: cz + (along ? s * (w / 2 + 3) : 0), w: along ? len : 6, h: 1.2, d: along ? 6 : len, color: 0xb8b6ae });
  for (let t = 8; t < len - 8; t += 24) {
    const p = (along ? Math.min(x0, x1) : Math.min(z0, z1)) + t;
    list.push({ x: along ? p : cx, y: 0.35, z: along ? cz : p, w: along ? 10 : 2, h: 0.2, d: along ? 2 : 10, color: 0xeeeeea });
  }
  return boxes(list);
}

// ---------------------------------------------------------------- stand-ins (used only when the kit has no model)
/** Voxel trees: kind 'conifer' | 'deciduous'. points: [[x, y, z, scale?], ...]. */
export function trees(points, seed = 5) {
  const r = rng(seed);
  const list = [];
  const greens = [0x3f7a3a, 0x4a8a3f, 0x568f44, 0x2f6a35, 0x5e9a49];
  for (const [x, y, z, s0 = 1, kind] of points) {
    const s = s0 * (0.8 + r() * 0.5);
    const k = kind ?? (r() < 0.55 ? 'conifer' : 'deciduous');
    list.push({ x, y: y + 6 * s, z, w: 4 * s, h: 12 * s, d: 4 * s, color: 0x6b4a2e });
    const g = greens[Math.floor(r() * greens.length)];
    if (k === 'conifer') {
      [[18, 10, 10], [14, 10, 18], [9, 9, 26], [4, 6, 32]].forEach(([w, h, yy]) => list.push({ x, y: y + yy * s, z, w: w * s, h: h * s, d: w * s, color: g }));
    } else {
      list.push({ x, y: y + 20 * s, z, w: 22 * s, h: 16 * s, d: 22 * s, color: g });
      list.push({ x: x + 3 * s, y: y + 29 * s, z: z - 2 * s, w: 14 * s, h: 8 * s, d: 14 * s, color: greens[(greens.indexOf(g) + 1) % greens.length] });
    }
  }
  return boxes(list);
}

/** Bushes, rocks and flowerbeds as low voxel clumps. points: [[x, y, z, kind]]. */
export function clumps(points, seed = 7) {
  const r = rng(seed);
  const list = [];
  const FLOWERS = [0xe84a5f, 0xf6c94b, 0xf3f0e8, 0xb46fd6, 0xf08a3c];
  for (const [x, y, z, kind] of points) {
    if (kind === 'rock') {
      const s = 6 + r() * 10;
      list.push({ x, y: y + s / 2, z, w: s * 1.4, h: s, d: s * 1.2, color: ROCK[Math.floor(r() * ROCK.length)] });
    } else if (kind === 'flowers') {
      list.push({ x, y: y + 1, z, w: 28, h: 2, d: 14, color: 0x6a4a32 });
      for (let i = 0; i < 10; i++) list.push({ x: x - 12 + r() * 24, y: y + 3, z: z - 5 + r() * 10, w: 3, h: 3, d: 3, color: FLOWERS[Math.floor(r() * FLOWERS.length)] });
    } else {
      const s = 7 + r() * 6;
      list.push({ x, y: y + s / 2, z, w: s * 1.6, h: s, d: s * 1.4, color: [0x4f8b3e, 0x5c9845, 0x467e39][Math.floor(r() * 3)] });
      if (r() < 0.4) list.push({ x: x + 2, y: y + s, z, w: 3, h: 3, d: 3, color: FLOWERS[Math.floor(r() * FLOWERS.length)] });
    }
  }
  return boxes(list);
}

const WALLS = [0xc98b5a, 0xd8b27a, 0xe4d6b8, 0xb56b4a, 0x9fb3c4, 0xe7c9a4, 0xc4c9cf];
const ROOFS = [0x5b5f6b, 0x8a3b2e, 0x6b4a3a, 0x48505c];

/** A stand-in building: walls with window rows, a gable or flat roof. Centre-bottom at (x, z), facing +Z after `turn`. */
export function building({ x, z, w, d, h, turn = 0, seed = 11, flat = false, wall, roof }) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = turn * RAD;
  wall ??= WALLS[Math.floor(r() * WALLS.length)];
  roof ??= ROOFS[Math.floor(r() * ROOFS.length)];
  const list = [{ x: 0, y: h / 2, z: 0, w, h, d, color: wall }];
  for (let y = 10; y < h - 8; y += 14) {
    for (let t = -w / 2 + 8; t <= w / 2 - 8; t += 12) {
      list.push({ x: t, y, z: d / 2 + 0.4, w: 6, h: 8, d: 0.8, color: 0x26324a });
      list.push({ x: t, y, z: -d / 2 - 0.4, w: 6, h: 8, d: 0.8, color: 0x26324a });
    }
  }
  list.push({ x: 0, y: 6, z: d / 2 + 0.6, w: 8, h: 12, d: 1, color: 0x5a3a26 }); // door
  if (flat) {
    list.push({ x: 0, y: h + 1.5, z: 0, w: w + 2, h: 3, d: d + 2, color: 0x8c8f94 });
  } else {
    const rise = Math.min(w, d) * 0.45;
    for (let k = 0; k < 4; k++) list.push({ x: 0, y: h + rise * (k + 0.5) / 4, z: 0, w: w + 4, h: rise / 4, d: (d + 4) * (1 - k / 4), color: roof });
    list.push({ x: w / 4, y: h + rise * 0.9, z: 0, w: 6, h: rise, d: 6, color: 0x8a5a45 }); // chimney
  }
  g.add(boxes(list));
  return g;
}

/** Stand-in cars and people. points: [[x, z, turn, kind]]. */
export function traffic(points, seed = 13) {
  const r = rng(seed);
  const list = [];
  const CARS = [0xd6453d, 0x3b6fb6, 0xf2c14e, 0xeeeeee, 0x2f8f5b, 0x2b2f36];
  for (const [x, z, turn, kind] of points) {
    const along = Math.abs(Math.sin(turn * RAD)) > 0.5; // runs along x
    if (kind === 'person') {
      list.push({ x, y: 9, z, w: 6, h: 18, d: 4, color: CARS[Math.floor(r() * CARS.length)] });
      list.push({ x, y: 22, z, w: 6, h: 8, d: 6, color: 0xe2b48c });
    } else {
      const c = CARS[Math.floor(r() * CARS.length)];
      list.push({ x, y: 6, z, w: along ? 34 : 16, h: 8, d: along ? 16 : 34, color: c });
      list.push({ x, y: 13, z, w: along ? 18 : 14, h: 7, d: along ? 14 : 18, color: 0x30394a });
    }
  }
  return boxes(list);
}

/** Points scattered over an area, at least `clear` from every track sample and outside the given rectangles. */
export function scatter({ area: [x0, z0, x1, z1], count, avoid = [], rects = [], clear = 56, seed = 17 }) {
  const r = rng(seed);
  const out = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 30) {
    const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
    if (rects.some(([a, b, c, d]) => x > a && x < c && z > b && z < d)) continue;
    if (avoid.some((p) => (p[0] - x) ** 2 + (p[2] - z) ** 2 < clear * clear)) continue;
    out.push([x, 0, z]);
  }
  return out;
}

/** Track sample points of a whole layout (every route, every 16 voxels), for keeping scenery off the line. */
export function trackPoints(layout) {
  const pts = [];
  for (const e of layout.edges()) for (let u = 0; u <= e.route.length; u += 16) pts.push(layout.edgeAt(e, u).p);
  return pts;
}

/** A pond or lake: water a little above the ground inside a sandy rim (layers kept apart so they never fight). */
export function pond({ x, z, w, d }) {
  return boxes([
    { x, y: 0.8, z, w: w + 20, h: 1.6, d: d + 20, color: 0xc9b98a },
    { x, y: 1.4, z, w, h: 2.8, d, color: 0x3f7fbf },
    { x: x - w * 0.2, y: 3, z: z - d * 0.15, w: w * 0.3, h: 0.4, d: 3, color: 0x8cbbe6 },
  ]);
}

/** A ploughed or cropped field: furrows of two tones in a hedge border, x0..x1 by z0..z1, furrows along x. */
export function field({ x0, x1, z0, z1, tones = [0x9a7a4c, 0x8a6a40], hedge = 0x4f8b3e, seed = 1 }) {
  const list = [{ x: (x0 + x1) / 2, y: 0.5, z: (z0 + z1) / 2, w: x1 - x0, h: 1, d: z1 - z0, color: tones[0] }];
  for (let z = z0 + 6; z < z1 - 6; z += 12) list.push({ x: (x0 + x1) / 2, y: 1.2, z, w: x1 - x0 - 12, h: 1, d: 5, color: tones[1] });
  for (const [x, z, w, d] of [[(x0 + x1) / 2, z0, x1 - x0, 6], [(x0 + x1) / 2, z1, x1 - x0, 6], [x0, (z0 + z1) / 2, 6, z1 - z0], [x1, (z0 + z1) / 2, 6, z1 - z0]]) {
    list.push({ x, y: 4, z, w, h: 8, d, color: hedge });
  }
  return boxes(list);
}
