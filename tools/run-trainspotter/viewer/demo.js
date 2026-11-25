// The demo railways shared by the viewer and the cover/gallery shots: track plans from
// layouts.js, with scenery, trains and (for electrics) overhead wires.
import * as THREE from 'three';
import { rotate } from './trackpath.js';
import { LAYOUTS } from './layouts.js';
import * as T from './terrain.js';
import { grassField } from './grass.js';

export { LAYOUTS };
const RAD = Math.PI / 180;
export const OVAL = LAYOUTS['Country junction'].steps;

export const CONSISTS = {
  'Steam express': [{ id: 'steam-express-green' }, { id: 'tender-express' }, { id: 'coach-classic' }, { id: 'coach-classic' }, { id: 'coach-classic' }],
  'Diesel freight': [{ id: 'diesel-streamlined-cab' }, { id: 'wagon-boxcar' }, { id: 'wagon-flatcar', load: 'load-container' }, { id: 'wagon-boxcar', paint: 'teal' }],
  'Bullet set': [{ id: 'highspeed-bullet-power-car' }, { id: 'highspeed-bullet-car' }, { id: 'highspeed-bullet-car' }, { id: 'highspeed-bullet-power-car', flip: true }],
  'Intercity': [{ id: 'diesel-streamlined-cab', paint: 'skin', trim: 'blue', accent: 'red' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }],
  'Streamlined steam': [{ id: 'steam-streamlined-blue' }, { id: 'tender-streamlined-blue' }, { id: 'coach-sleeper' }, { id: 'coach-dining' }, { id: 'coach-sleeper' }],
  'Western 4-4-0': [{ id: 'steam-western-4-4-0' }, { id: 'tender-western' }, { id: 'coach-baggage-mail' }, { id: 'coach-observation' }],
  'Pioneer': [{ id: 'steam-pioneer-0-2-2' }, { id: 'tender-pioneer' }, { id: 'coach-classic' }],
  'Tank engine goods': [{ id: 'steam-tank-0-6-0' }, { id: 'wagon-gondola', load: 'load-coal' }, { id: 'wagon-livestock' }, { id: 'wagon-brake-van' }],
  'Articulated freight': [{ id: 'steam-articulated-giant' }, { id: 'tender-articulated-giant' }, { id: 'wagon-covered-hopper' }, { id: 'wagon-tank' },
    { id: 'wagon-covered-hopper' }, { id: 'wagon-caboose' }],
  'Road switcher freight': [{ id: 'diesel-road-switcher' }, { id: 'wagon-log', load: 'load-logs' }, { id: 'wagon-container-spine', load: 'load-container' },
    { id: 'wagon-refrigerator' }, { id: 'wagon-flatcar', load: 'load-pipes' }, { id: 'wagon-caboose' }],
  'Diesel express': [{ id: 'diesel-express-power-car' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }, { id: 'diesel-express-power-car', flip: true }],
  'Twin-cab mixed': [{ id: 'diesel-twin-cab' }, { id: 'wagon-flatcar', load: 'load-crates' }, { id: 'wagon-crane' }, { id: 'wagon-brake-van' }],
  'Rural railcar': [{ id: 'diesel-rural-railcar' }],
  'Art-deco electric': [{ id: 'electric-streamlined-deco' }, { id: 'coach-dome' }, { id: 'coach-dining' }, { id: 'coach-observation' }],
  'Electric express': [{ id: 'electric-express-blue' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }, { id: 'coach-intercity' }],
  'Modern electric freight': [{ id: 'electric-modern' }, { id: 'wagon-container-spine', load: 'load-container' }, { id: 'wagon-container-spine', load: 'load-container' }],
  'Articulated electric': [{ id: 'electric-articulated-freight' }, { id: 'wagon-boxcar' }, { id: 'wagon-gondola', load: 'load-coal' }],
  'Boxcab local': [{ id: 'electric-boxcab' }, { id: 'coach-classic', paint: 'forest' }, { id: 'coach-classic', paint: 'forest' }],
  'Long-nose set': [{ id: 'highspeed-longnose-power-car' }, { id: 'highspeed-longnose-car' }, { id: 'highspeed-longnose-car' }, { id: 'highspeed-longnose-power-car', flip: true }],
  'Wedge set': [{ id: 'highspeed-wedge-power-car' }, { id: 'highspeed-wedge-car' }, { id: 'highspeed-wedge-car' }, { id: 'highspeed-wedge-power-car', flip: true }],
  'Commuter (stainless)': [{ id: 'commuter-stainless-cab-car' }, { id: 'commuter-stainless-middle-car' }, { id: 'commuter-stainless-middle-car' },
    { id: 'commuter-stainless-cab-car', flip: true }],
  'Commuter (painted)': [{ id: 'commuter-painted-cab-car' }, { id: 'commuter-painted-middle-car' }, { id: 'commuter-painted-cab-car', flip: true }],
  'Metro (rounded)': [{ id: 'metro-rounded-cab-car' }, { id: 'metro-rounded-middle-car' }, { id: 'metro-rounded-cab-car', flip: true }],
  'Metro (retro)': [{ id: 'metro-retro-cab-car' }, { id: 'metro-retro-cab-car', flip: true }],
  'Metro': [{ id: 'metro-cab-car' }, { id: 'metro-middle-car' }, { id: 'metro-middle-car' }, { id: 'metro-cab-car', flip: true }],
  'Double-deck commuter': [{ id: 'commuter-double-deck-cab-car' }, { id: 'coach-double-deck' }, { id: 'coach-double-deck' }],
  'Modern tram': [{ id: 'tram-modern' }],
  'Heritage tram': [{ id: 'tram-heritage' }],
  'Cable car': [{ id: 'cable-car-hill' }],
};

const has = (kit, id) => { try { kit.entry(id); return true; } catch { return false; } };

/** The consists whose every car (and load) is in this kit's catalogue. */
export function availableConsists(kit) {
  return Object.fromEntries(Object.entries(CONSISTS).filter(([, cars]) => cars.every((c) => has(kit, c.id) && (!c.load || has(kit, c.load)))));
}

/** Place a model in a layout step's frame, at local (x, y, z), turned extra degrees. */
function atStep(model, pc, local = [0, 0, 0], turn = 0) {
  const [x, z] = rotate(local[0], local[2], pc.theta);
  model.group.position.set(pc.tx + x, pc.ty + local[1], pc.tz + z);
  model.group.rotation.y = (pc.theta + turn) * RAD;
  return model;
}

/**
 * A flat coloured strip in a step's frame (rivers, roads), centred on local (x, z), size w (local x) by d (local z).
 * Returns its world footprint [x0, z0, x1, z1] padded by `pad`, for keeping trees and clumps off it.
 */
function strip(scene, pc, local, w, d, color, y = 0.3, pad = 24) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
  m.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group();
  const [x, z] = rotate(local[0], local[2], pc.theta);
  holder.position.set(pc.tx + x, y, pc.tz + z);
  holder.rotation.y = pc.theta * RAD;
  holder.add(m);
  scene.add(holder);
  const box = new THREE.Box3().setFromObject(holder);
  return [box.min.x - pad, box.min.z - pad, box.max.x + pad, box.max.z + pad];
}

// ---------------------------------------------------------------- scenery helpers
const TREES = ['tree-conifer', 'tree-conifer-tall', 'tree-deciduous', 'tree-deciduous-round', 'tree-birch'];

/** A kit model at a world position, turned degrees about +Y; null when the kit does not have it. */
async function put(kit, scene, id, x, y, z, turn = 0) {
  if (!has(kit, id)) return null;
  const m = await kit.model(id);
  m.group.position.set(x, y, z);
  m.group.rotation.y = turn * RAD;
  scene.add(m.group);
  return m;
}

/** Trees at world points [[x, y, z, scale?]]: the kit's tree models when it has them, else voxel stand-ins. */
async function greenery(kit, scene, pts, seed = 5) {
  const ids = TREES.filter((id) => has(kit, id));
  if (!ids.length) { scene.add(T.trees(pts, seed)); return; }
  const r = T.rng(seed);
  for (const [x, y, z] of pts) await put(kit, scene, ids[Math.floor(r() * ids.length)], x, y, z, r() * 360);
}

/** Bushes, rocks and flowerbeds: kit models when present, else voxel clumps. pts: [[x, y, z, kind]]. */
async function undergrowth(kit, scene, pts, seed = 7) {
  const kitId = { bush: ['bush-round', 'bush-flowering'], rock: ['rock-small', 'rock-large'], flowers: ['flowerbed'] };
  const r = T.rng(seed);
  const fallback = [];
  for (const p of pts) {
    const ids = (kitId[p[3]] ?? []).filter((id) => has(kit, id));
    if (ids.length) await put(kit, scene, ids[Math.floor(r() * ids.length)], p[0], p[1], p[2], r() * 360);
    else fallback.push(p);
  }
  if (fallback.length) scene.add(T.clumps(fallback, seed));
}

/** A building: the kit's model when present (footprint from its catalogue size), else a stand-in box of w x d x h. */
async function house(kit, scene, id, x, z, turn, w, d, h, seed) {
  if (await put(kit, scene, id, x, 0, z, turn)) return;
  scene.add(T.building({ x, z, w, d, h, turn, seed, flat: /apartment|office|factory|warehouse|shop/.test(id) }));
}

/** Scatter trees and undergrowth over an area, off the track and outside rectangles [x0, z0, x1, z1]. */
async function dress(kit, scene, layout, area, { trees = 40, clumps = 30, rects = [], seed = 21, houses = 0 } = {}) {
  const avoid = T.trackPoints(layout);
  if (!area) { // round the railway itself
    const b = new THREE.Box3();
    for (const p of avoid) b.expandByPoint(new THREE.Vector3(...p));
    area = [b.min.x - 360, b.min.z - 360, b.max.x + 360, b.max.z + 360];
  }
  // a few houses in clear spots well off the line, then trees and undergrowth round them
  const r = T.rng(seed + 9);
  const homes = T.scatter({ area, count: houses, avoid, rects, clear: 130, seed: seed + 3 });
  for (const [x, , z] of homes) {
    const big = r() < 0.4;
    await house(kit, scene, big ? 'house-terraced' : 'house-detached', x, z, Math.floor(r() * 4) * 90, big ? 96 : 64, big ? 48 : 60, big ? 46 : 40, Math.floor(x + z));
    rects = [...rects, [x - 70, z - 70, x + 70, z + 70]];
  }
  await greenery(kit, scene, T.scatter({ area, count: trees, avoid, rects, clear: 60, seed }), seed);
  const kinds = ['bush', 'bush', 'rock', 'flowers'];
  const pts = T.scatter({ area, count: clumps, avoid, rects, clear: 44, seed: seed + 1 }).map((p, i) => [...p, kinds[i % kinds.length]]);
  await undergrowth(kit, scene, pts, seed + 2);
}

/**
 * A tunnel: portals at both ends of a run of track `len` long from step `step`, and a terraced
 * mountain over it whose bore stays open below the arch and rises well above the portal.
 * Extra mountain to the sides: l0, l1 (lateral, + is right of travel). Returns the mountain's terrace points (world).
 */
async function tunnel(kit, scene, layout, step, len, { l0 = -170, l1 = 170, peak = 230, seed = 3, bores, inside, rockAt = 250 } = {}) {
  const pc = layout.placed[step];
  const frame = T.stepFrame(pc);
  await extraAt(kit, frame, 'tunnel-portal', [0, 0, 0], 0);
  await extraAt(kit, frame, 'tunnel-portal', [0, 0, -len], 180);
  // the kit's own tunnel hills when they stand well clear of the portal's arch (it is 124 tall), one per 128
  const hillTall = has(kit, 'hill-tunnel') ? (kit.entry('hill-tunnel').height ?? kit.entry('hill-tunnel').size?.[1] ?? 0) : 0;
  if (hillTall >= 150 && !bores) {
    // sections fill the run between the portals' 16-deep face walls (not through them), each
    // stretched a touch along the track so they meet end to end
    const face = 16, n = Math.max(1, Math.round((len - 2 * face) / 128)), piece = (len - 2 * face) / n;
    for (let k = 0; k < n; k++) {
      const hill = await extraAt(kit, frame, 'hill-tunnel', [0, 0, -(face + piece * (k + 0.5))], 0);
      hill?.group.scale.set(1, 1, piece / 128);
    }
    scene.add(frame);
    return [];
  }
  const { group, tops } = T.mountain({ u0: 8, u1: len - 8, l0, l1, peak, seed, inside, rockAt, base: 24,
    bores: bores ?? [{ l: 0, half: 36, u0: 0, u1: len, top: 104 }] });
  frame.add(group);
  scene.add(frame);
  frame.updateMatrixWorld(true);
  return tops.map((t) => new THREE.Vector3(...t).applyMatrix4(frame.matrixWorld).toArray());
}

/** A kit model at local coordinates inside a frame group. */
async function extraAt(kit, frame, id, local, turn = 0) {
  if (!has(kit, id)) return null;
  const m = await kit.model(id);
  m.group.position.set(...local);
  m.group.rotation.y = turn * RAD;
  frame.add(m.group);
  return m;
}

/** A trackside model on the left of a step (the trackside frame turned round), `along` from its start. */
async function besideLeft(kit, scene, layout, step, id, along = 0, length = 64) {
  if (!has(kit, id)) return null;
  const m = atStep(await kit.model(id), layout.placed[step], [0, 0, -(along + length)], 180);
  scene.add(m.group);
  return m;
}

const SCENERY = {
  async 'Country junction'(kit, scene, layout, extra) {
    for (const s of [2, 3, 4, 5]) for (const along of [0, 64]) scene.add((await kit.beside(layout, s, 'platform-side', along)).group);
    scene.add((await kit.beside(layout, 6, 'platform-ramp-end')).group);
    scene.add((await kit.beside(layout, 3, 'station-country')).group);
    if (has(kit, 'platform-canopy')) for (const along of [0, 64]) scene.add((await kit.beside(layout, 4, 'platform-canopy', along)).group);
    for (const s of [2, 5]) await extra('lamp-post', s, [48, 24, -32]);
    await extra('platform-bench', 3, [52, 24, -96], 90);
    await extra('platform-bench', 5, [52, 24, -40], 90);
    await extra('signal-box', 10, [-64, 0, -64], 180);
    await extra('water-crane', 12, [-34, 0, -64], 180);
    await dress(kit, scene, layout, null, { trees: 150, clumps: 110, houses: 5, rects: [[380, -60, 700, 700]], seed: 31 });
    return extra('signal-semaphore', 9, [34, 0, 40]);
  },

  async 'Figure eight'(kit, scene, layout, extra) {
    await extra('water-tower', 3, [-150, 0, -40]);
    await extra('signal-box', 8, [-150, 0, -60]);
    await extra('signal-colour-light', 1, [34, 0, -20]);
    await extra('signal-colour-light', 6, [-34, 0, -20], 180);
    for (const s of [2, 4, 8]) await extra('lamp-post', s, [-60, 0, -40]);
    await dress(kit, scene, layout, null, { trees: 150, clumps: 110, houses: 5, seed: 41 });
    return extra('signal-semaphore', 10, [34, 0, -20]);
  },

  async 'Mountain line'(kit, scene, layout, extra) {
    const P = layout.placed;
    const river = strip(scene, P[9], [0, 0, -96], 3000, 110, 0x3f7fbf); // the river under the truss bridge
    const road = strip(scene, P[11], [0, 0, -32], 3000, 34, 0x6c6e72); // the road over the level crossing
    const tops = await tunnel(kit, scene, layout, 12, 256, { l0: -230, l1: 230, peak: 250, seed: 9 });
    await greenery(kit, scene, tops, 12);
    for (const side of [1, -1]) await extra('crossing-lights', 11, [side * 40, 0, -32 + side * 24], side > 0 ? 0 : 180);
    await extra('crossing-gate', 11, [36, 0, -8]);
    await extra('crossing-gate', 11, [-36, 0, -56], 180);
    for (const along of [0, 64]) if (has(kit, 'platform-side')) scene.add((await kit.beside(layout, 8, 'platform-side', along)).group);
    scene.add((await kit.beside(layout, 8, 'station-country')).group);
    await extra('water-tower', 14, [70, 0, -32]);
    await dress(kit, scene, layout, null, { trees: 150, clumps: 110, houses: 4, seed: 51, rects: [river, road] });
    return extra('signal-semaphore', 7, [34, 0, -150]);
  },

  async 'Big trainset'(kit, scene, layout, extra) {
    for (const s of [4, 5, 6, 7]) for (const along of [0, 64]) scene.add((await kit.beside(layout, s, 'platform-side', along)).group);
    scene.add((await kit.beside(layout, 3, 'platform-ramp-end')).group);
    scene.add((await kit.beside(layout, 5, has(kit, 'station-town') ? 'station-town' : 'station-country')).group);
    if (has(kit, 'platform-canopy')) for (const s of [6, 7]) for (const along of [0, 64]) scene.add((await kit.beside(layout, s, 'platform-canopy', along)).group);
    for (const s of [4, 6, 7]) await extra('lamp-post', s, [50, 24, -32]);
    for (const s of [4, 7]) await extra('platform-bench', s, [54, 24, -96], 90);
    await extra('signal-box', 12, [-120, 0, -96], 180);
    await extra('water-tower', 21, [134, 0, 40]); // clear of the track beside it
    await extra('water-crane', 20, [34, 0, -200]);
    await extra('signal-colour-light', 16, [34, 0, -40]);
    await dress(kit, scene, layout, null, { trees: 170, clumps: 120, houses: 5, seed: 61,
      rects: [[220, -800, 430, 40], [-60, -340, 400, -40]] }); // the station and the yard
    return extra('signal-semaphore', 11, [34, 0, -150]);
  },

  async 'Grand trainset'(kit, scene, layout, extra, plan) {
    const P = layout.placed;
    const M = plan.marks;
    const B = { x0: -560, x1: 2720, z0: -880, z1: 1320 };
    scene.add(T.baseboard(B));
    scene.add(T.backdrop({ x0: B.x0, x1: B.x1, z: B.z0 - 2 }));
    scene.add(T.backdrop({ x0: B.z0, x1: B.z1, z: B.x0 - 2, side: true, seed: 8 }));
    scene.add(T.field({ x0: 2282, x1: 2420, z0: 40, z1: 640, seed: 2 }));
    scene.add(T.field({ x0: 960, x1: 1600, z0: 70, z1: 320, tones: [0xc7b25a, 0xb59e48], seed: 3 }));
    scene.add(T.field({ x0: -480, x1: -230, z0: -260, z1: 40, tones: [0x8fb85a, 0x7aa64e], seed: 4 }));
    const treePts = [];

    // the back range: double-track tunnels on the main line (outer portals at the face, inner ones set back)
    {
      const frame = T.stepFrame(P[M.outerBack + 4]); // x 704, z -256, heading +X; +lateral is toward the front
      // one wide double-track mouth at each end (two single portals side by side would overlap)
      const double = has(kit, 'tunnel-portal-double');
      const mouths = double ? [['tunnel-portal-double', 0, 32, 0], ['tunnel-portal-double', 512, 32, 180]]
        : [['tunnel-portal', 0, 0, 0], ['tunnel-portal', 512, 0, 180], ['tunnel-portal', 20, 64, 0], ['tunnel-portal', 492, 64, 180]];
      for (const [id, u, l, turn] of mouths) await extraAt(kit, frame, id, [l, 0, -u], turn);
      const { group, tops } = T.mountain({
        u0: -1250, u1: 560, l0: -620, l1: 190, peak: 330, base: 40, seed: 101, snowAt: 300, rockAt: 200,
        lumps: [{ u: -700, l: -420, h: 1, s: 0.32 }, { u: -150, l: -480, h: 0.95, s: 0.3 }, { u: 300, l: -300, h: 0.8, s: 0.3 }, { u: -1050, l: -300, h: 0.7, s: 0.25 }],
        bores: double ? [{ l: 32, half: 68, u0: 0, u1: 512, top: 120 }]
          : [{ l: 0, half: 36, u0: 0, u1: 512, top: 104 }, { l: 64, half: 36, u0: 20, u1: 492, top: 104 }],
        // behind the line the range falls away to foothills at the track's edge
        shape: (u, l) => (l < -76 ? Math.min(1, 0.22 + (-76 - l) / 260) : 1),
        inside: (u, l) => {
          if (l < -76) return true; // behind the main line
          if (double || l < 60) return u > 8 && u < 504; // over the tracks: only the tunnel
          return u > 28 && u < 484; // over the inner track and in front of it
        },
      });
      frame.add(group);
      scene.add(frame);
      frame.updateMatrixWorld(true);
      for (const t of tops) treePts.push(new THREE.Vector3(...t).applyMatrix4(frame.matrixWorld).toArray());
    }
    // the upper line: a tunnel on its ground-level straights, a plateau under the curves at the top
    treePts.push(...await tunnel(kit, scene, layout, M.upperTunnel, 256, { l0: -150, l1: 150, peak: 220, seed: 111 }));
    scene.add(T.plateau({ x0: 1660, x1: 1892, z0: -32, z1: 416, top: 64 }));
    treePts.push(...[[1760, 64, 150], [1790, 64, 230], [1740, 64, 200], [1800, 64, 120], [1770, 64, 280]]);
    // the branch: a tunnel through a hill on its way north
    treePts.push(...await tunnel(kit, scene, layout, M.branchTunnel, 256, { l0: -150, l1: 170, peak: 200, seed: 121 }));

    // the through station on the left side: platforms both sides, a town station inside, a country station outside
    for (const k of [0, 1, 2]) for (const along of [0, 64]) {
      if (has(kit, 'platform-side')) scene.add((await kit.beside(layout, M.innerLeft + k, 'platform-side', along)).group);
      await besideLeft(kit, scene, layout, M.outerLeft + k, 'platform-side', along);
    }
    if (has(kit, 'platform-ramp-end')) scene.add((await kit.beside(layout, M.innerLeft + 3, 'platform-ramp-end')).group);
    if (has(kit, 'platform-canopy')) for (const k of [1, 2]) for (const along of [0, 64]) scene.add((await kit.beside(layout, M.innerLeft + k, 'platform-canopy', along)).group);
    scene.add((await kit.beside(layout, M.innerLeft + 1, has(kit, 'station-town') ? 'station-town' : 'station-country')).group);
    await besideLeft(kit, scene, layout, M.outerLeft + 1, 'station-country', 0, 128);
    for (const k of [0, 2]) await extra('lamp-post', M.innerLeft + k, [48, 24, -32]);
    await extra('platform-bench', M.innerLeft + 1, [54, 24, -96], 90);
    const signals = [];
    const s1 = await extra('signal-colour-light', M.innerLeft + 3, [34, 0, -100]);
    if (s1) signals.push({ model: s1, step: M.innerLeft + 3 });
    const s2 = await extra('signal-colour-light', M.outerLeft, [-34, 0, -40], 180);
    if (s2) signals.push({ model: s2, step: M.outerLeft });
    await extra('signal-box', M.innerFront + 13, [66, 0, -64], 180); // on the grass beyond the main lines, clear of the yard

    // the branch terminus in the town, and a halt at the front
    for (const k of [1, 2, 3]) for (const along of [0, 64]) if (has(kit, 'platform-side')) scene.add((await kit.beside(layout, M.branchTown + k, 'platform-side', along)).group);
    await extra('station-terminus', M.branchEnd, [0, 0, -40]);
    for (const along of [0, 64]) if (has(kit, 'platform-side')) scene.add((await kit.beside(layout, M.branchStart, 'platform-side', along)).group);
    await extra('station-nameboard', M.branchStart, [50, 24, -64], 90);

    // the town behind the main line: two streets, rows of buildings, a church and a factory
    scene.add(T.road(1290, -380, 2400, -380));
    scene.add(T.road(1290, -650, 2400, -650));
    scene.add(T.road(2150, -400, 2150, -486));
    scene.add(T.road(1450, -540, 1450, -630));
    const rowA = [['shop-row', 128, 48, 40], ['house-terraced', 96, 48, 46], ['shop-row', 128, 48, 40], ['apartment-block', 96, 64, 70], ['house-terraced', 96, 48, 46], ['shop-row', 128, 48, 40]];
    let x = 1330;
    for (const [id, w, d, h] of rowA) { await house(kit, scene, id, x + w / 2, -330, 180, w, Math.min(d, 52), h, x); x += w + 34; }
    const rowB = [['house-detached', 64, 64, 44], ['house-detached', 64, 64, 40], ['house-terraced', 96, 48, 46], ['house-detached', 64, 64, 44], ['house-terraced', 96, 48, 46]];
    x = 1330;
    for (const [id, w, d, h] of rowB) { if (x + w > 2120 && x < 2180) x = 2180; await house(kit, scene, id, x + w / 2, -440, 0, w, 52, h, x + 7); x += w + 40; }
    const rowC = [['apartment-block', 96, 64, 80], ['office-tower', 64, 64, 130], ['apartment-block', 96, 64, 90]];
    x = 2040;
    for (const [id, w, d, h] of rowC) { await house(kit, scene, id, x + w / 2, -590, 180, w, d, h, x + 3); x += w + 24; }
    await house(kit, scene, 'church', 1560, -760, 0, 96, 128, 70, 77);
    await house(kit, scene, 'factory', 1820, -750, 0, 128, 96, 60, 88);
    await house(kit, scene, 'warehouse', 2030, -740, 0, 128, 64, 50, 99);
    await house(kit, scene, 'office-tower', 2220, -740, 0, 64, 64, 150, 111);
    await house(kit, scene, 'apartment-block', 2350, -740, 0, 96, 64, 96, 121);
    if (!has(kit, 'church')) scene.add(T.boxes([{ x: 1560, y: 110, z: -800, w: 20, h: 80, d: 20, color: 0xd9cdb5 }, { x: 1560, y: 160, z: -800, w: 8, h: 20, d: 8, color: 0x5b5f6b }]));
    if (!has(kit, 'factory')) scene.add(T.boxes([{ x: 1860, y: 100, z: -780, w: 14, h: 120, d: 14, color: 0xa3523a }]));
    // the village inside the loop: a street between the upper line and the front main line
    scene.add(T.road(420, 560, 1660, 560));
    x = 440;
    for (const [id, w, d, h] of [['house-detached', 64, 64, 40], ['house-terraced', 96, 48, 44], ['shop-row', 128, 48, 40], ['house-detached', 64, 64, 42],
      ['house-terraced', 96, 48, 44], ['house-detached', 64, 64, 40], ['shop-row', 128, 48, 40]]) {
      await house(kit, scene, id, x + w / 2, 500, 0, w, 52, h, x + 13);
      if (x < 1400) await house(kit, scene, id === 'shop-row' ? 'house-terraced' : id, x + w / 2 + 20, 626, 180, Math.min(w, 96), 48, h - 4, x + 17);
      x += w + 46;
    }
    // traffic and people
    const cars = [];
    const kitCars = ['car-small', 'car-estate', 'bus', 'delivery-van'].filter((id) => has(kit, id));
    for (const [cx, cz, turn] of [[1400, -370, 90], [1700, -390, 270], [2000, -370, 90], [2300, -390, 270], [1600, -640, 90], [2100, -660, 270], [600, 550, 90], [900, 570, 270], [1300, 550, 90]]) {
      if (kitCars.length) await put(kit, scene, kitCars[cars.length % kitCars.length], cx, 0, cz, turn);
      cars.push([cx, cz, turn, 'car']);
    }
    const people = [];
    for (const [px, pz] of [[44, 300], [50, 240], [40, 180], [-100, 300], [-104, 220], [1500, -410], [1800, -355], [2200, -410], [700, 590], [1100, 530]]) people.push([px, pz, 0, 'person']);
    if (!kitCars.length) scene.add(T.traffic(cars, 5));
    const kitPeople = ['person-standing', 'person-walking'].filter((id) => has(kit, id));
    if (kitPeople.length) { let i = 0; for (const [px, pz] of people) await put(kit, scene, kitPeople[i++ % kitPeople.length], px, (px > 0 && px < 70) || px < -80 ? 24 : 0, pz, i * 47); }
    else scene.add(T.traffic(people.map(([px, pz]) => [px, pz, 0, 'person']), 9));
    for (const sx of [1400, 1700, 2000, 2300]) await put(kit, scene, 'street-lamp', sx, 0, -404, 0) ?? await put(kit, scene, 'lamp-post', sx, 0, -404, 0);
    for (let tz = 860; tz > -300; tz -= 160) await put(kit, scene, 'telegraph-pole', 2420, 0, tz, 0);
    // a pond and a park inside the loop
    scene.add(T.pond({ x: 300, z: 260, w: 150, d: 220 }));
    // a lake in the front right corner, foothills in the front left
    scene.add(T.pond({ x: 2130, z: 1090, w: 380, d: 240 }));
    {
      const { group, tops } = T.mountain({ u0: -1300, u1: -700, l0: -540, l1: -150, peak: 150, base: 24, seed: 131, rockAt: 260 });
      group.rotation.y = 0; // frame: u along -z, l along +x
      scene.add(group);
      treePts.push(...tops);
    }

    // trees and undergrowth everywhere else
    const avoid = T.trackPoints(layout);
    const rects = [[190, 580, 330, 700], [-200, 60, 140, 520], [-220, 60, -80, 520], [1290, -880, 2720, -300], [1300, -620, 2400, -470], [400, 450, 1900, 680], [1920, 950, 2340, 1230],
      [2270, 30, 2430, 650], [950, 60, 1610, 330], [-490, -270, -220, 50],
      [1640, -40, 1900, 420], [200, 140, 400, 380], [-60, 790, 1760, 1200]];
    treePts.push(...T.scatter({ area: [B.x0 + 30, B.z0 + 30, B.x1 - 30, B.z1 - 30], count: 420, avoid, rects, clear: 60, seed: 201 }));
    await greenery(kit, scene, treePts, 31);
    const kinds = ['bush', 'bush', 'rock', 'flowers', 'bush'];
    await undergrowth(kit, scene, T.scatter({ area: [B.x0 + 30, B.z0 + 30, B.x1 - 30, B.z1 - 30], count: 320, avoid, rects, clear: 44, seed: 202 })
      .map((p, i) => [...p, kinds[i % kinds.length]]), 33);
    return { signal: s1 ?? s2, signals };
  },
};

/** Build a demo railway into `scene`: track, scenery and signals. Returns {layout, signal, signals, plan}. */
export async function buildDemo(kit, scene, { ground = true, name = 'Country junction', grass = 'High' } = {}) {
  const plan = LAYOUTS[name];
  if (ground && !plan.baseboard) {
    // wide enough to reach the horizon; the viewer's look fades it into the sky (userData.horizonFade)
    // polygon offset: anything lying flat on it (rivers, roads, fields) always wins the depth test
    const g = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: 0x7fae5a, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.05;
    g.receiveShadow = true;
    g.userData.horizonFade = true;
    scene.add(g);
  }
  const layout = await kit.layout(plan.steps);
  scene.add(layout.group);
  const extra = async (id, step, local, turn = 0) => {
    if (!has(kit, id)) return null;
    const m = atStep(await kit.model(id), layout.placed[step], local, turn);
    scene.add(m.group);
    return m;
  };
  const got = await SCENERY[name](kit, scene, layout, extra, plan);
  const signal = got?.signal !== undefined ? got.signal : got;
  const signals = got?.signals ?? (signal ? [{ model: signal, step: null }] : []);
  // swaying grass and wild flowers on the green, laid last so it sees everything else
  let meadow = null;
  if (grass) {
    const pts = T.trackPoints(layout);
    const b = plan.baseboard ? new THREE.Box3().setFromObject(scene) : new THREE.Box3();
    if (!plan.baseboard) {
      for (const p of pts) b.expandByPoint(new THREE.Vector3(...p));
      b.expandByVector(new THREE.Vector3(650, 0, 650)); // room for the soft edge to thin out
    }
    meadow = grassField(scene, { area: [b.min.x, b.min.z, b.max.x, b.max.z], avoid: pts, quality: grass, soft: !plan.baseboard });
    scene.add(meadow.mesh);
  }
  return { layout, signal, signals, plan, grass: meadow };
}

/** Overhead wires for a demo railway (built once, then shown or hidden). */
export async function wires(kit, layout, plan) {
  if (!has(kit, 'catenary-mast')) return null;
  const skip = new Set(plan.noWires ?? []);
  return kit.catenary(layout, { skip: (pc) => skip.has(layout.placed.indexOf(pc)) || pc.spec.kind === 'turntable' });
}

/** A consist on the layout, its front coupler `u` along step `step` (run backwards with reverse). Loads ride their wagon's socket-load. */
export async function addTrain(kit, scene, layout, cars, step = 4, u = 120, { reverse = false } = {}) {
  const train = await kit.consist(cars);
  for (let i = 0; i < cars.length; i++) {
    if (!cars[i].load) continue;
    const sock = train.cars[i].group.getObjectByName('socket-load');
    if (sock) sock.add((await kit.model(cars[i].load)).group);
  }
  // anything with a pantograph runs with it up (electrics, trams), doors stay shut
  for (const car of train.cars) if (car.hasPanto) car.setPantograph(true);
  scene.add(train.group);
  train.setTrack(layout, layout.edge(step, reverse ? 'b' : 'a'), u);
  return train;
}

/** The layout's own trains (besides the chosen one), started at their speeds. */
export async function layoutTrains(kit, scene, layout, plan) {
  const out = [];
  for (const t of plan.trains ?? []) {
    const cars = t.cars ?? CONSISTS[t.consist];
    if (!cars || !cars.every((c) => has(kit, c.id))) continue;
    const train = await addTrain(kit, scene, layout, cars, t.step, t.u, { reverse: t.reverse });
    train.plan = t; // stops, shuttle and cruise speed, for the driver
    if (t.speed && train.go) train.go(t.speed);
    else train.speed = t.speed ?? 0;
    out.push(train);
  }
  return out;
}

/** Does any car of these trains collect current from overhead wires? */
export const needsWires = (trains) => trains.some((t) => t.cars.some((c) => c.hasPanto));
