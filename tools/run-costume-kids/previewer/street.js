// Trick-or-treat street: a test scene for the neighbourhood kit (neighborhood/glb, copied to street-assets/)
// with the Bobble kids walking the sidewalk and up to the doors.
// Every repeated prop is one InstancedMesh per material, so a prop type costs 1-2 draw calls however many there are.
// Layout (three.js y-up, +z towards the street): road z 16..24, sidewalk z 12..16, fences at z 11.6, houses behind.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone as skinnedClone } from "three/addons/utils/SkeletonUtils.js";

const $ = (id) => document.getElementById(id);
const bust = `?t=${Date.now()}`;
const loader = new GLTFLoader();

// ---------- layout constants ----------
const LOT = 24, LOTS = 6, X0 = -(LOT * LOTS) / 2, X1 = -X0;   // lots span x -72..72
const FENCE_Z = 11.6, WALK_Z0 = 12, WALK_Z1 = 16, ROAD_Z1 = 24;
const WALK_Y = 0.38, GRASS_Y = 0.37;                           // sidewalk tile top / yard level
const HOUSE_Z = -3;
// The kids walk the inner part of the sidewalk; the kerb side is for street furniture (lamps,
// hydrants, the sign), standing on the kerb edge. A kid's centre never goes past LANE_MAX, which
// keeps even a big head or hat (half a unit at the kids' scale) clear of the lamp bases.
const LANES = [12.8, 14.0], LANE_MAX = 14.3;
const KERB_Z = 15.8;                                            // lamps: their 1.6 base spans z 15.0..16.6
const FURNITURE_Z = 15.55;                                      // hydrants and the sign, at the kerb
const HOUSES = [
  { slug: "house-a", fence: "white" }, { slug: "house-06", fence: "dark" }, { slug: "house-b", fence: "white" },
  { slug: "house-07", fence: "white" }, { slug: "house-c", fence: "dark" }, { slug: "house-10", fence: "white" },
];
const KIDS = ["witch", "cupcake", "cardboard-robot", "knight", "ghost", "pumpkin-clown", "dracula", "princess", "superhero",
  "mummy", "skeleton-onesie", "black-cat", "frankenstein", "wizard", "bumblebee", "ninja", "candy-corn", "inflatable-trex"];
const CANDY = ["candy-wrapped", "candy-lollipop", "candy-corn", "candy-chocolate", "candy-gumdrop", "candy-apple"];

// a small seeded random, so the street is the same every load
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- renderer, scene, camera ----------
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1, 1, 900);
const controls = new OrbitControls(cam, canvas);
controls.target.set(-14, 6, 3);
cam.position.copy(controls.target).add(new THREE.Vector3(0.72, 0.4, 1.0).normalize().multiplyScalar(84));
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.update();

const hemi = new THREE.HemisphereLight(0x8a86c8, 0x3a3048, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffa25c, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 60, bottom: -60, near: 1, far: 400 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

function gradientTexture(stops) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 256);
  for (const [t, col] of stops) grad.addColorStop(t, col);
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const SKY = {
  dusk: gradientTexture([[0, "#24244f"], [0.45, "#43407a"], [0.75, "#8a5f86"], [1, "#e0905f"]]),
  day: gradientTexture([[0, "#6fa8dc"], [0.7, "#b9d8ee"], [1, "#eef3ea"]]),
};

// ---------- ground (plain planes, 1 draw call each) ----------
const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f6e38, roughness: 1 });
function plane(w, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
plane(400, 200, 0, GRASS_Y, WALK_Z0 - 100, grassMat);          // yards and beyond
plane(400, 120, 0, GRASS_Y, ROAD_Z1 + 4 + 60, grassMat);       // across the street
plane(1200, 1200, 0, -0.05, 0, new THREE.MeshStandardMaterial({ color: 0x4a5434, roughness: 1 }));

// ---------- loading + instancing ----------
const cache = new Map();
const load = (url) => { if (!cache.has(url)) cache.set(url, loader.loadAsync(url + bust)); return cache.get(url); };
const glowMats = new Set();
// the meshes of a prop GLB, with node transforms baked in
async function propParts(slug) {
  const g = await load(`street-assets/${slug}.glb`);
  g.scene.updateMatrixWorld(true);
  const parts = [];
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const mat = o.material;
    if (mat.name === "GLOW") { glowMats.add(mat); mat.userData.base ??= mat.emissiveIntensity; }
    parts.push({ geo, mat });
  });
  return parts;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function matrixOf(t) {
  _q.setFromEuler(_e.set(t.rx || 0, t.ry || 0, t.rz || 0));
  const s = t.s ?? 1;
  _s.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
  return _m.compose(_p.set(t.x, t.y ?? GRASS_Y, t.z), _q, _s);
}
const placements = new Map();   // slug -> [{x, y, z, ry, s}]
const obstacles = [];          // kerb furniture the kids must keep clear of: {slug, x, z}
const place = (slug, t) => { if (!placements.has(slug)) placements.set(slug, []); placements.get(slug).push(t); };
const instanced = new Map();    // slug -> [InstancedMesh]
async function buildInstances() {
  for (const [slug, list] of placements) {
    const parts = await propParts(slug);
    const meshes = parts.map(({ geo, mat }) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => im.setMatrixAt(i, matrixOf(t)));
      im.castShadow = !slug.startsWith("road") && !slug.startsWith("sidewalk");
      im.receiveShadow = true;
      im.computeBoundingSphere();
      scene.add(im);
      return im;
    });
    instanced.set(slug, meshes);
  }
}

// ---------- houses: door position and porch height profile, from the geometry ----------
const ray = new THREE.Raycaster();
async function houseInfo(slug) {
  const parts = await propParts(slug);
  const pal = parts.find((p) => p.mat.name !== "GLOW");
  const pos = pal.geo.getAttribute("position");
  let maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) maxZ = Math.max(maxZ, pos.getZ(i));
  let lo = Infinity, hi = -Infinity;        // the front steps: the lowest, front-most geometry
  for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > maxZ - 0.3 && pos.getY(i) < 1) { lo = Math.min(lo, pos.getX(i)); hi = Math.max(hi, pos.getX(i)); }
  const doorX = (lo + hi) / 2;
  const meshes = parts.map((p) => new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  // height under the door column, sampled every 0.2 from just in front of the steps back to the door
  const prof = [];
  let deck = 0;
  for (let z = maxZ + 0.6; z > maxZ - 9; z -= 0.2) {
    ray.set(new THREE.Vector3(doorX, 5.2, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(meshes, false)[0];
    const y = hit ? 5.2 - hit.distance : 0;
    if (y - deck > 0.6) break;              // a wall or the porch roof, not a step
    prof.push({ z, y });
    deck = Math.max(deck, y);
  }
  ray.set(new THREE.Vector3(doorX, deck + 1.6, maxZ + 1), new THREE.Vector3(0, 0, -1));
  const wall = ray.intersectObjects(meshes, false)[0];
  const doorZ = wall ? maxZ + 1 - wall.distance : maxZ - 4;
  return { doorX, maxZ, deck, doorZ, prof: prof.filter((p) => p.z > doorZ) };
}
function profileY(h, zLocal) {           // walking height on a house's path / steps / porch (house-local z)
  const p = h.info.prof;
  if (zLocal >= p[0].z) return 0;
  for (let i = 1; i < p.length; i++) if (p[i].z <= zLocal) return Math.max(p[i - 1].y, p[i].y);
  return p[p.length - 1].y;
}

// ---------- lay out the street ----------
const houses = [];
async function layout() {
  const infos = await Promise.all(HOUSES.map((h) => houseInfo(h.slug)));
  HOUSES.forEach((h, i) => {
    const x0 = X0 + i * LOT, gateX = x0 + 10, info = infos[i];
    const hx = gateX - info.doorX;
    houses.push({ ...h, info, x0, gateX, hx, busy: false });
    place(h.slug, { x: hx, z: HOUSE_Z });
    // picket fence: six 4-wide sections per lot, with an open gap at the path (no gate to walk through),
    // finished with an end post on each side of the gap
    for (let k = 0; k < 6; k++) {
      const cx = x0 + 2 + 4 * k;
      if (k === 2) {
        place(`fence-${h.fence}-post`, { x: cx - 1.9, z: FENCE_Z });
        place(`fence-${h.fence}-post`, { x: cx + 1.9, z: FENCE_Z });
      } else place(`fence-${h.fence}`, { x: cx, z: FENCE_Z });
    }
    // front path from the gate to the steps (sidewalk tiles, flattened)
    const z0 = HOUSE_Z + info.maxZ, len = FENCE_Z - z0;
    place("sidewalk", { x: gateX, y: GRASS_Y - 0.07, z: z0 + len / 2, sx: 0.72, sy: 0.25, sz: len / 4 });
    // jack-o'-lanterns: one on the porch by the door, one at the foot of the steps
    const dz = HOUSE_Z + info.doorZ;
    place(i % 2 ? "jack-small" : "jack-medium", { x: gateX + 2.3, y: GRASS_Y + info.deck, z: dz + 1.1, ry: -0.3 + rnd() * 0.6, s: 0.8 });
    place(["jack-medium", "jack-large", "jack-small"][i % 3], { x: gateX - 3.0, z: z0 + 1.2, ry: 0.4 - rnd() * 0.5 });
    // bushes along the foundation
    place(i % 2 ? "hedge" : "bush", { x: hx + (info.doorX > 0 ? -4.5 : 4.5), z: HOUSE_Z + info.maxZ - 3.4, ry: (rnd() - 0.5) * 0.4 });
  });
  place("fence-white-post", { x: X1, z: FENCE_Z });
  place("fence-white-post", { x: X0 - 0.01, z: FENCE_Z });

  // yard decorations, per lot (x relative to the lot's left edge)
  const L = (i) => X0 + i * LOT;
  place("mailbox", { x: L(0) + 6.5, z: FENCE_Z - 1.0 });
  place("leaf-pile", { x: L(0) + 18.5, z: 8.2, ry: 0.4 });
  place("tombstone-round", { x: L(1) + 3.6, z: 8.6, ry: 0.15 });
  place("tombstone-cross", { x: L(1) + 6.6, z: 7.4, ry: -0.2 });
  place("tombstone-round", { x: L(1) + 19.5, z: 8.8, ry: -0.25, s: 0.85 });
  place("crow-post", { x: L(1) + 22.6, z: 9.8, ry: -0.6 });
  place("hay-bale", { x: L(2) + 18, z: 8.4, ry: -0.25 });
  place("mailbox", { x: L(2) + 6.5, z: FENCE_Z - 1.0 });
  place("leaf-pile", { x: L(3) + 4.6, z: 8.6, ry: -0.5, s: 0.9 });
  place("mailbox", { x: L(3) + 13.5, z: FENCE_Z - 1.0 });
  place("tombstone-cross", { x: L(4) + 17.0, z: 8.2, ry: 0.3 });
  place("tombstone-round", { x: L(4) + 20.2, z: 7.4, ry: -0.1 });
  place("crow-post", { x: L(4) + 4.0, z: 9.6, ry: 0.5 });
  place("hay-bale", { x: L(5) + 4.4, z: 8.4, ry: 0.3 });
  place("leaf-pile", { x: L(5) + 19, z: 8.4, ry: 1.1 });
  place("hydrant", { x: L(1) + 15, y: WALK_Y, z: FURNITURE_Z });
  place("hydrant", { x: L(4) + 6, y: WALK_Y, z: FURNITURE_Z });
  place("street-sign", { x: X1 - 1.5, y: WALK_Y, z: FURNITURE_Z, ry: -0.3 });
  obstacles.push({ slug: "hydrant", x: L(1) + 15, z: FURNITURE_Z }, { slug: "hydrant", x: L(4) + 6, z: FURNITURE_Z },
    { slug: "street-sign", x: X1 - 1.5, z: FURNITURE_Z });

  // trees: between the houses, in the front yards, plus a ragged row behind
  const TREES = ["tree-gnarled", "tree-leaning", "tree-forked"];
  for (let i = 0; i <= LOTS; i++) place(TREES[i % 3], { x: X0 + i * LOT + (rnd() - 0.5) * 2, z: 5 + rnd() * 3, ry: rnd() * 6.28, s: 0.85 + rnd() * 0.2 });
  for (let i = 0; i < LOTS; i++) place(TREES[(i + 1) % 3], { x: X0 + i * LOT + 14 + rnd() * 6, z: -16 - rnd() * 4, ry: rnd() * 6.28, s: 0.9 + rnd() * 0.2 });

  // street lamps on the kerb edge, one per lot boundary, outside the walking lanes
  for (let i = 0; i <= LOTS; i++) {
    const slug = i % 3 === 1 ? "lamp-double" : "lamp-single";
    place(slug, { x: X0 + i * LOT + 4, y: WALK_Y, z: KERB_Z });
    obstacles.push({ slug, x: X0 + i * LOT + 4, z: KERB_Z });
  }

  // ground tiles: sidewalks either side, road between
  for (let x = X0 - 24 + 2; x < X1 + 24; x += 4) {
    place("sidewalk", { x, y: 0, z: 14 });
    place("sidewalk", { x, y: 0, z: 26, ry: Math.PI });
  }
  for (let x = X0 - 24 + 8; x < X1 + 24; x += 16) place("road", { x, y: 0, z: 20, ry: Math.PI / 2 });

  // parked cars at the kerb, between the lamps (whose bases now reach over the kerb edge)
  place("car-sedan", { x: X0 + 40, y: 0, z: 18.1, ry: Math.PI / 2 });
  place("car-wagon", { x: X0 + 88, y: 0, z: 18.1, ry: Math.PI / 2 });
  place("car-bug", { x: X0 + 136, y: 0, z: 18.1, ry: -Math.PI / 2 });
}

// ---------- fake light pools (no real lights): additive discs under lamps and in front of doors ----------
function poolTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,190,110,0.55)"); grad.addColorStop(0.5, "rgba(255,150,70,0.18)"); grad.addColorStop(1, "rgba(255,140,60,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let pools;
function buildPools() {
  const spots = [];
  for (let i = 0; i <= LOTS; i++) spots.push([X0 + i * LOT + 4, WALK_Y + 0.03, KERB_Z - 1.2, 13]);
  for (const h of houses) spots.push([h.gateX, GRASS_Y + 0.04, HOUSE_Z + h.info.maxZ + 1.5, 9]);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  pools = new THREE.InstancedMesh(geo, mat, spots.length);
  spots.forEach(([x, y, z, s], i) => pools.setMatrixAt(i, matrixOf({ x, y, z, s })));
  pools.renderOrder = 2;
  scene.add(pools);
}

// ---------- candy pickups: spin and bob along the sidewalk ----------
const candies = [];
function buildCandy() {
  for (let i = 0; i < 14; i++) {
    const slug = CANDY[i % CANDY.length];
    candies.push({ slug, x: X0 + 8 + i * ((X1 - X0 - 16) / 13) + (rnd() - 0.5) * 3, z: LANES[i % 2] + (rnd() - 0.5) * 0.6, ph: rnd() * 6.28 });
    place(slug, { x: 0, z: 0 });
  }
}
function updateCandy(t) {
  const idx = {};
  for (const c of candies) {
    const i = (idx[c.slug] = (idx[c.slug] ?? -1) + 1);
    const m = matrixOf({ x: c.x, y: WALK_Y + 0.35 + 0.25 * Math.sin(t * 2.2 + c.ph), z: c.z, ry: t * 1.6 + c.ph, s: 1.5 });
    for (const im of instanced.get(c.slug)) { im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; }
  }
}

// ---------- kids ----------
// The kids go round in little packs. A pack walks (or runs) down the sidewalk together; at a free
// house it files in through the fence gap and queues up the path, the first kid at the foot of the
// steps. One at a time the head of the queue climbs the steps, knocks, gets candy and walks back out
// to the sidewalk, and the line shuffles forward. The ones who are done wait on the sidewalk; when
// the whole pack is out they set off together for the next house.
const kids = [];
const packs = [];
const KID_SCALE = 0.4;   // the costume kids at 40% of their modelled size on the street
const WALK_SPEED = 1.3;  // stride matched to the scale so the feet don't skate
const RUN_SPEED = 2.7;
const GAP = 1.15;        // spacing between kids in a queue
const PACK_SIZES = [5, 5, 4, 4];
function groundY(x, z) {
  if (z >= WALK_Z0) return WALK_Y;
  for (const h of houses) if (Math.abs(x - h.gateX) < 1.6) return GRASS_Y + 0.04 + profileY(h, z - HOUSE_Z);
  return GRASS_Y;
}
function setClip(k, name, fade = 0.25) {
  if (k.clip === name) return;
  const next = k.actions[name] || k.actions.idle;
  next.reset().fadeIn(fade).play();
  if (k.current) k.current.fadeOut(fade);
  k.current = next;
  k.clip = name;
}
function locomote(k, speed) {           // walk or run by how fast the kid is going; feet keep pace
  if (speed < 0.12) { setClip(k, k.restClip || "idle"); k.current.timeScale = 1; return; }
  const mid = (WALK_SPEED + RUN_SPEED) / 2;   // switch with a margin, so a kid near the line doesn't flicker
  const run = k.clip === "run" ? speed > mid - 0.35 : speed > mid + 0.35;
  setClip(k, run ? "run" : "walk");
  k.current.timeScale = Math.min(1.5, Math.max(0.6, speed / (run ? RUN_SPEED : WALK_SPEED)));
}
function stepToward(k, tx, tz, speed, dt) {   // move at `speed` toward (tx, tz); true when there
  const dx = tx - k.x, dz = tz - k.z, d = Math.hypot(dx, dz), step = speed * dt;
  if (d < 1e-3) return true;
  k.yawTo = Math.atan2(dx, dz);
  if (d <= step) { k.x = tx; k.z = tz; return true; }
  k.x += (dx / d) * step; k.z += (dz / d) * step;
  return false;
}
function followPath(k, speed, dt) {     // walk a list of [x, z] waypoints; true when the last is reached
  while (k.path.length) {
    const [tx, tz] = k.path[0];
    if (!stepToward(k, tx, tz, speed, dt)) { locomote(k, speed); return false; }
    k.path.shift();
  }
  return true;
}
// a house's queue: kid i of the line stands i places back from the foot of the steps, up the path and,
// if the line is long, out along the sidewalk
const footZ = (h) => HOUSE_Z + h.info.maxZ + 0.45;
const doorZ = (h) => HOUSE_Z + h.info.doorZ + 0.7;
const mouthZ = FENCE_Z + 0.7;
const IN_X = 0.6, OUT_X = -0.65;        // keep right: the queue and the way in on one side of the path, the way out on the other
function queueSpot(h, i) {
  const z = footZ(h) + i * GAP;
  if (z < FENCE_Z - 0.4) return [h.gateX + IN_X, z];
  const j = Math.round((z - (FENCE_Z - 0.4)) / GAP) + 1;
  return [h.gateX - h.pack.dir * j * GAP, mouthZ];
}
function waitSpot(h, k) {               // a loose cluster on the sidewalk beside the gap
  const n = h.pack.kids.indexOf(k);
  return [h.gateX + h.pack.dir * (1.6 + (n % 3) * 1.2), Math.min(LANE_MAX, LANES[0] + 0.2 + Math.floor(n / 3) * 1.0)];
}
function nextHouse(pack) {              // the next free, unvisited house ahead of the pack
  const ahead = houses.filter((h) => !h.pack && !pack.visited.has(h) && (h.gateX - pack.x) * pack.dir > -0.5);
  ahead.sort((a, b) => (a.gateX - b.gateX) * pack.dir);
  return ahead[0] || null;
}
function startVisit(pack, h) {
  h.pack = pack; pack.house = h; pack.state = "visit"; pack.visited.add(h);
  h.line = [...pack.kids].sort(() => rnd() - 0.5);
  h.atDoor = null;
  h.line.forEach((k, i) => {            // file in one after another, along the in-lane
    k.state = "queue"; k.restClip = "idle"; k.delay = i * 0.5;
    k.path = [[h.gateX + IN_X, mouthZ + 0.4]];
  });
}
function updatePack(pack, dt) {
  if (pack.state === "travel") {
    pack.x += pack.dir * pack.speed * dt;
    const h = nextHouse(pack);
    if (h && (h.gateX - pack.x) * pack.dir <= 0) startVisit(pack, h);   // reached its gap
    if ((pack.timer -= dt) <= 0) {        // now and then the pack speeds up or ambles
      pack.timer = 4 + rnd() * 5;
      pack.speed = rnd() < 0.35 ? RUN_SPEED * 0.9 : WALK_SPEED * (0.85 + rnd() * 0.3);
    }
    if (pack.x > X1 + 18 || pack.x < X0 - 18) {   // round the block: back in at the other end
      const shift = pack.x > 0 ? -(X1 - X0 + 36) : X1 - X0 + 36;
      pack.x += shift; pack.visited.clear();
      for (const k of pack.kids) k.x += shift;
    }
  } else if (pack.state === "visit") {
    const h = pack.house;
    if (h.line.length === 0 && pack.kids.every((k) => k.state === "wait" && !k.path.length)) {
      h.pack = null; pack.house = null; pack.state = "travel"; pack.x = h.gateX + pack.dir * 2;
      pack.timer = 0;
      for (const k of pack.kids) { k.state = "pack"; k.restClip = null; k.vx = k.vz = 0; }
    }
  }
}
function slotOf(pack, k) {              // a kid's place in the travelling pack (rows of two)
  const i = pack.kids.indexOf(k);
  return [pack.x - pack.dir * (Math.floor(i / 2) * 1.3 + k.jx), Math.min(LANE_MAX, LANES[i % 2] + k.jz)];
}
function updateKid(k, dt) {
  const pack = k.pack, h = pack.house;
  switch (k.state) {
    case "pack": {
      if ((k.fidget -= dt) <= 0) {      // kids drift about in the pack; the bouncy ones dash ahead
        k.fidget = 2 + rnd() * 4;
        k.jx = (rnd() - 0.5) * (k.bouncy ? 3.5 : 1.2); k.jz = (rnd() - 0.5) * 0.6;
      }
      // follow the pack's own velocity, plus a gentle pull toward your slot: no stop-start
      const [tx, tz] = slotOf(pack, k);
      let vx = pack.dir * pack.speed + (tx - k.x) * 1.6, vz = (tz - k.z) * 1.6;
      let v = Math.hypot(vx, vz);
      const vmax = RUN_SPEED * 1.15;
      if (v > vmax) { vx *= vmax / v; vz *= vmax / v; v = vmax; }
      k.vx = k.vx === undefined ? vx : k.vx + (vx - k.vx) * Math.min(1, dt * 4);   // ease speed changes
      k.vz = k.vz === undefined ? vz : k.vz + (vz - k.vz) * Math.min(1, dt * 4);
      k.x += k.vx * dt; k.z = Math.min(LANE_MAX, k.z + k.vz * dt);   // never out into the kerb furniture
      const sp = Math.hypot(k.vx, k.vz);
      if (sp > 0.1) k.yawTo = Math.atan2(k.vx, k.vz);
      locomote(k, sp);
      break;
    }
    case "queue": {                     // walk in through the gap, then keep to your place in line
      const i = h.line.indexOf(k);
      if (k.delay > 0) { k.delay -= dt; locomote(k, 0); break; }
      if (!followPath(k, WALK_SPEED, dt)) break;
      const [tx, tz] = queueSpot(h, i);
      if (!stepToward(k, tx, tz, WALK_SPEED, dt)) { locomote(k, WALK_SPEED); break; }
      k.yawTo = Math.atan2(h.gateX - k.x, footZ(h) - 3 - k.z);   // face the house
      locomote(k, 0);
      if (i === 0 && !h.atDoor) { h.atDoor = k; k.state = "up"; k.path = [[h.gateX + IN_X * 0.5, footZ(h) - 0.4], [h.gateX, doorZ(h)]]; }
      break;
    }
    case "up":
      if (followPath(k, WALK_SPEED * 1.25, dt)) { k.state = "knock"; k.t = 0.8; }
      break;
    case "knock":                       // knock knock (a wave at the door)
      setClip(k, "wave"); k.current.timeScale = 1.3; k.yawTo = Math.PI;
      if ((k.t -= dt) <= 0) { k.state = "treat"; k.t = 1.6; }
      break;
    case "treat":                       // bucket out: candy!
      setClip(k, "trick-or-treat"); k.current.timeScale = 1; k.yawTo = Math.PI;
      if ((k.t -= dt) <= 0) {
        k.state = "leave";
        h.line.shift(); h.atDoor = null;
        k.path = [[h.gateX + OUT_X, footZ(h)], [h.gateX + OUT_X, mouthZ + 0.2], waitSpot(h, k)];
      }
      break;
    case "leave":
      if (followPath(k, WALK_SPEED * 1.3, dt)) { k.state = "wait"; k.t = 0; k.path = []; }
      break;
    case "wait":                        // done: hang about on the sidewalk till the pack is ready
      if ((k.t -= dt) <= 0) {
        k.t = 2 + rnd() * 3;
        k.restClip = ["idle", "eat-candy", "idle-look", "wave", "idle-peek"][Math.floor(rnd() * 5)];
        k.yawTo = Math.atan2(h.gateX - k.x, footZ(h) - k.z) + (rnd() - 0.5) * 1.2;
      }
      locomote(k, 0);
      break;
  }
  if (k.yawTo !== undefined) {          // turn smoothly toward the heading
    let d = k.yawTo - k.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    k.yaw += d * Math.min(1, dt * 8);
  }
  const y = groundY(k.x, k.z);
  k.y = k.y === undefined ? y : k.y + (y - k.y) * Math.min(1, dt * 12);
  k.obj.position.set(k.x, k.y, k.z);
  k.obj.rotation.y = k.yaw;
}
async function spawnKids() {
  const srcs = await Promise.all(KIDS.map((s) => load(`chars/${s}.glb`)));
  let n = 0;
  PACK_SIZES.forEach((size, p) => {
    const dir = p % 2 ? -1 : 1;
    const pack = { kids: [], dir, x: X0 + 14 + p * ((X1 - X0 - 28) / PACK_SIZES.length), speed: WALK_SPEED,
      state: "travel", timer: rnd() * 3, house: null, visited: new Set() };
    packs.push(pack);
    for (let j = 0; j < size && n < srcs.length; j++, n++) {
      const g = srcs[n];
      const obj = skinnedClone(g.scene);
      obj.scale.setScalar(KID_SCALE);  // kid-sized next to the houses: even tall hats fit under a porch roof
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      scene.add(obj);
      const mixer = new THREE.AnimationMixer(obj);
      const actions = Object.fromEntries(g.animations.map((a) => [a.name, mixer.clipAction(a)]));
      const k = { slug: KIDS[n], obj, mixer, actions, clip: null, pack, state: "pack", path: [], t: 0,
        jx: 0, jz: 0, fidget: rnd() * 2, bouncy: rnd() < 0.35, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
      pack.kids.push(k);
      [k.x, k.z] = slotOf(pack, k);
      setClip(k, "walk", 0);
      k.current.time = rnd() * k.current.getClip().duration;
      kids.push(k);
    }
  });
}

// ---------- day / dusk ----------
const MODES = {
  dusk: { sky: SKY.dusk, fog: 0x55467a, hemi: [0x8a86c8, 0x3a3048, 1.25], sun: [0xff9a55, 1.5], sunPos: [-60, 40, -40], glow: 1.6, pools: true },
  day: { sky: SKY.day, fog: 0xc6dceb, hemi: [0xfff6ea, 0x8f8a70, 1.5], sun: [0xffffff, 2.3], sunPos: [40, 90, 60], glow: 0.6, pools: false },
};
function setMode(name) {
  const m = MODES[name];
  scene.background = m.sky;
  scene.fog = new THREE.Fog(m.fog, 160, 420);
  hemi.color.set(m.hemi[0]); hemi.groundColor.set(m.hemi[1]); hemi.intensity = m.hemi[2];
  sun.color.set(m.sun[0]); sun.intensity = m.sun[1];
  sun.position.set(...m.sunPos); sun.target.position.set(0, 0, 0);
  for (const mat of glowMats) mat.emissiveIntensity = mat.userData.base * m.glow;
  if (pools) pools.visible = m.pools;
  $("dusk").classList.toggle("on", name === "dusk");
  $("day").classList.toggle("on", name === "day");
}
$("dusk").onclick = () => setMode("dusk");
$("day").onclick = () => setMode("day");
$("shadows").onclick = () => {
  sun.castShadow = !sun.castShadow;
  $("shadows").classList.toggle("on", sun.castShadow);
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
};
let paused = false;
$("pause").onclick = () => { paused = !paused; $("pause").classList.toggle("on", paused); $("pause").textContent = paused ? "Play" : "Pause"; };

// ---------- go ----------
await layout();
buildCandy();
await buildInstances();
buildPools();
await spawnKids();
const mode = new URLSearchParams(location.search).get("mode") || "dusk";
setMode(mode);
$("msg").remove();

const clock = new THREE.Clock();
let frames = 0, acc = 0, time = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!paused) {
    time += dt;
    for (const pk of packs) updatePack(pk, dt);
    for (const k of kids) { updateKid(k, dt); k.mixer.update(dt); }
    updateCandy(time);
  }
  controls.update();
  const W = innerWidth, H = innerHeight;
  if (canvas.width !== Math.floor(W * renderer.getPixelRatio())) { renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }
  renderer.info.reset();
  renderer.render(scene, cam);
  frames++; acc += dt;
  if (acc > 0.5) {
    $("fps").textContent = Math.round(frames / acc);
    $("ms").textContent = `${(1000 * acc / frames).toFixed(1)} ms/frame`;
    const r = renderer.info.render;
    $("stats").textContent = `${r.calls} draw calls · ${(r.triangles / 1000).toFixed(0)}k triangles · ${kids.length} kids`;
    frames = 0; acc = 0;
  }
  requestAnimationFrame(frame);
}
window.__street = { kids, packs, houses, obstacles, LANE_MAX, renderer, scene, cam, controls, setMode };
frame();
