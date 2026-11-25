// Trainspotter trailer: 30 s portrait, cut to the song. Every frame is a function of song time t:
// seek(t) finds the shot, re-simulates its trains (and smoke and sparks) from just before the shot
// starts, poses the camera and sets the overlay. Sequential capture steps the simulation forward
// instead of re-running it, which gives the same result.
import * as THREE from 'three';
import { TrainKit, TrainFx } from '../viewer/train-kit.js';
import { CONSISTS, addTrain, buildDemo, layoutTrains, wires } from '../viewer/demo.js';
import { Pretty } from '../viewer/pretty.js';

const W = 1080, H = 1920, FPS = 30, DT = 1 / FPS, PRE = 1.2;
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const T = await (await fetch('../out/trailer/timing.json', { cache: 'no-store' })).json();
const WORDS = T.lines.flatMap((l) => l.words);
const LINES = T.sung; // transcription lines: what was really sung, with clean line breaks
const BEATS = T.grid;
const wordAt = (w, after = 0) => WORDS.find((x) => x.w.replace(/[^a-z]/gi, '').toLowerCase() === w && x.s >= after - 1e-6)?.s ?? after;

// ---------------------------------------------------------------- world
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
$('stage').prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 4, 40000);
const focus = { target: new THREE.Vector3() };
const kit = await TrainKit.load('../out/glb/');
const pretty = new Pretty(renderer, scene, camera, { kit, controls: focus, quality: q.get('quality') ?? 'High' });
const world = new THREE.Group();
scene.add(world);
const demo = await buildDemo(kit, world, { name: 'Grand trainset' });
const L = demo.layout, M = demo.plan.marks;
for (const t of await layoutTrains(kit, world, L, demo.plan)) if ((t.plan?.speed ?? 0) > 0) world.remove(t.group); // we drive our own
const w = await wires(kit, L, demo.plan);
if (w) world.add(w);
pretty.fit(new THREE.Box3().setFromObject(L.group));

const HERO = {};
const NAMES = ['Steam express', 'Streamlined steam', 'Western 4-4-0', 'Articulated freight', 'Bullet set', 'Wedge set', 'Long-nose set', 'Electric express',
  'Commuter (stainless)', 'Commuter (painted)', 'Metro (rounded)', 'Road switcher freight', 'Art-deco electric', 'Diesel freight', 'Rural railcar'];
for (const name of NAMES) {
  if (!CONSISTS[name]) continue;
  const tr = await addTrain(kit, world, L, CONSISTS[name], M.innerLeft, 0);
  for (const c of tr.cars) c.model.mixer.update(3); // pantographs fully up
  tr.group.visible = false;
  HERO[name] = tr;
}
const fx = new TrainFx(scene);
pretty.adopt(scene);

// portals along a line: distances where the track passes a tunnel-portal
const portals = [];
world.traverse((o) => { if (o.name === 'tunnel-portal') portals.push(o.getWorldPosition(new THREE.Vector3())); });

// ---------------------------------------------------------------- track helpers
const edgeOf = (step, dir = 'a') => L.edge(step, dir);
function along(edge, u, d) { // the point d further on (d may be negative) from (edge, u)
  let e = edge, uu = u + d;
  while (uu < 0) { const p = L.prev(e); if (!p) return { edge: e, u: 0 }; e = p; uu += e.route.length; }
  while (uu > e.route.length) { const n = L.next(e); if (!n) return { edge: e, u: e.route.length }; uu -= e.route.length; e = n; }
  return { edge: e, u: uu };
}
function track(step, u = 0, { side = 0, h = 0, dir = 'a' } = {}) { // a world point beside a track, h above the rail
  const a = along(edgeOf(step, dir), 0, u);
  const { p, t } = L.edgeAt(a.edge, a.u);
  const len = Math.hypot(t[0], t[2]);
  return new THREE.Vector3(p[0] - (t[2] / len) * side, p[1] + 8 + h, p[2] + (t[0] / len) * side);
}
function portalAlong(step, dir = 'a', from = 0, reach = 3000) { // distance to the first portal passed after `from`
  for (let d = from; d < reach; d += 6) {
    const p = track(step, d, { dir });
    if (portals.some((v) => Math.hypot(v.x - p.x, v.z - p.z) < 14)) return d;
  }
  return null;
}
const TUN_IN = portalAlong(M.innerBack) ?? 200;
const TUN_OUT = portalAlong(M.innerBack, 'a', TUN_IN + 120) ?? TUN_IN + 512;
const OTUN_IN = portalAlong(M.outerBack, 'b') ?? 200;
const OTUN_OUT = portalAlong(M.outerBack, 'b', OTUN_IN + 120) ?? OTUN_IN + 512;

// ---------------------------------------------------------------- camera rigs
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, f) => a + (b - a) * f;
const ease = (f) => f * f * (3 - 2 * f);
const fixed = (eye, look, fov = 40) => () => ({ eye, look, fov });
const dolly = (e0, e1, l0, l1, fov = 40) => (f) => ({ eye: e0.clone().lerp(e1, ease(f)), look: l0.clone().lerp(l1, ease(f)), fov });
function rig(train, car, eye, look, fov = 40, move = null) { // a camera riding with a car (car-local, -Z is its front)
  return (f) => {
    const g = HERO[train].cars[car].group;
    g.updateMatrixWorld(true);
    const e = move ? eye.clone().lerp(move, ease(f)) : eye;
    return { eye: g.localToWorld(e.clone()), look: g.localToWorld(look.clone()), fov };
  };
}

// ---------------------------------------------------------------- shots
// trains: [name, step, dir, mark u, time the front reaches the mark, speed, extras]
const S = [];
const shot = (t0, t1, o) => S.push({ t0, t1, tod: 0.4, tilt: 1.0, trains: [], ...o });
const B = (i) => T.bars[i]; // bar starts: 0.618, 1.989, 3.361, ...
const beat = T.grid[1] - T.grid[0];

shot(0, 0.69, { tod: 0.55, tilt: 1.5, wires: true, trains: [['Steam express', M.innerRight, 'a', 160, 0.6, 90]],
  cam: dolly(track(M.innerRight, 160, { side: -900, h: 700 }), track(M.innerRight, 160, { side: -520, h: 380 }), track(M.innerRight, 160, { side: 120 }), track(M.innerRight, 160, { side: 60 }), 40) });
shot(0.69, B(1), { tod: 0.5, tilt: 0.7, lines: 0.5, shake: 0.6,
  trains: [['Steam express', M.innerRight, 'a', 200, 1.3, 150]],
  cam: rig('Steam express', 0, V(0, 20, -420), V(0, 40, -40), 40, V(0, 16, -130)) });
shot(B(1), B(2), { tod: 0.4, tilt: 0.8,
  trains: [['Commuter (stainless)', M.innerLeft + 2, 'a', 80, B(2) - 0.2, 70]],
  cam: dolly(track(M.innerLeft + 2, 200, { side: -40, h: 46 }), track(M.innerLeft + 2, 180, { side: -38, h: 40 }), track(M.innerLeft + 2, -200, { h: 30 }), track(M.innerLeft + 2, -120, { h: 30 }), 40) });
shot(B(2), B(3), { tod: 0.35, tilt: 0.6, vf: true,
  trains: [['Articulated freight', M.outerFront + 2, 'a', 160, B(2) + 0.9, 80]],
  cam: fixed(track(M.outerFront + 2, 160, { side: -150, h: 36 }), track(M.outerFront + 2, 160, { h: 34 }), 34) });
shot(B(3), B(4), { tod: 0.45, tilt: 1.5, note: true,
  cam: dolly(track(M.roads[1].first + 2, 0, { side: -260, h: 420 }), track(M.roads[1].first + 2, 140, { side: -220, h: 380 }),
    track(M.roads[1].first + 2, 0, { side: 40 }), track(M.roads[1].first + 2, 140, { side: 40 }), 40) });
shot(B(4), B(5), { tod: 0.55, tilt: 0.9,
  trains: [['Streamlined steam', M.upperViaductA, 'a', 60, B(4) + 0.7, 60]],
  cam: dolly(track(M.upperViaductA, -40, { side: -280, h: 40 }), track(M.upperViaductA, 120, { side: -250, h: 60 }), track(M.upperViaductA, 0, { h: 20 }), track(M.upperViaductA, 140, { h: 20 }), 32) });
// drum build: one close-up per beat
const db = B(5);
shot(db, db + beat, { tod: 0.45, tilt: 0.2, trains: [['Steam express', M.innerRight, 'a', 200, db, 50]],
  cam: rig('Steam express', 0, V(-80, 20, 14), V(-14, 12, 0), 34, V(-80, 20, -14)) });
shot(db + beat, db + 2 * beat, { tod: 0.45, tilt: 0.2, trains: [['Steam express', M.innerRight, 'a', 200, db, 50]],
  cam: rig('Steam express', 0, V(-110, 70, -170), V(0, 58, -60), 38) });
shot(db + 2 * beat, db + 3 * beat, { tod: 0.5, tilt: 0.2, trains: [['Electric express', M.innerRight, 'a', 200, db, 120]],
  cam: rig('Electric express', 0, V(-30, 126, 70), V(0, 82, 0), 40) });
shot(db + 3 * beat, B(6), { tod: 0.5, tilt: 0.3, lines: 0.8, trains: [['Bullet set', M.outerFront + 2, 'a', 100, db, 180]],
  cam: rig('Bullet set', 0, V(-40, 16, -150), V(0, 22, -70), 44) });
// chorus
const tr1 = wordAt('trains', 8), tr2 = wordAt('trains', tr1 + 0.3), luv = wordAt('love', 10);
shot(B(6), tr2, { tod: 0.4, tilt: 0.4, lines: 1, shake: 0.4, trains: [['Bullet set', M.outerRight + 2, 'a', 200, tr1 + 0.35, 330]],
  cam: fixed(track(M.outerRight + 2, 200, { side: 44, h: 10 }), track(M.outerRight + 2, 60, { h: 20 }), 52) });
shot(tr2, luv - 0.02, { tod: 0.4, tilt: 0.4, lines: 1, shake: 0.4, trains: [['Road switcher freight', M.innerRight + 2, 'a', 200, tr2 + 0.3, 230]],
  cam: fixed(track(M.innerRight + 2, 200, { side: -44, h: 10 }), track(M.innerRight + 2, 330, { h: 20 }), 52) });
shot(luv - 0.02, LINES[4]?.s ?? 11.46, { tod: 0.45, tilt: 1.6, wires: true,
  trains: [['Steam express', M.innerLeft, 'a', 120, luv, 90], ['Electric express', M.outerLeft, 'b', 120, luv, 110], ['Western 4-4-0', M.upperTop, 'a', 40, luv, 60]],
  cam: dolly(track(M.innerLeft, 120, { side: -900, h: 760 }), track(M.innerLeft, 260, { side: -760, h: 620 }), track(M.innerLeft, 120, { side: 300 }), track(M.innerLeft, 260, { side: 300 }), 42) });
shot(LINES[4]?.s ?? 11.46, B(9), { tod: [0.3, 0.84], tilt: 0.9,
  trains: [['Commuter (painted)', M.innerRight, 'a', 200, 12.2, 60]],
  cam: rig('Commuter (painted)', 0, V(-170, 70, 120), V(0, 30, -40), 38, V(-150, 60, -40)) });
// roster parade: a different train past the same spot on every beat, with its name
const PARADE = [['Bullet set', 'BULLET'], ['Wedge set', 'WEDGE'], ['Long-nose set', 'LONG NOSE'], ['Commuter (stainless)', 'COMMUTER'], ['Metro (rounded)', 'METRO'],
  ['Art-deco electric', 'ART DECO'], ['Western 4-4-0', '4-4-0']];
const p0 = B(9);
PARADE.forEach(([name, label], i) => {
  const a = p0 + i * beat, b = a + beat;
  shot(a, b, { tod: 0.42, tilt: 0.5, chip: label, lines: 0.4, trains: [[name, M.outerRight + 2, 'b', 150, a + beat * 0.3, 240]],
    cam: fixed(track(M.outerRight + 2, 150, { side: 190, h: 46, dir: 'b' }), track(M.outerRight + 2, 120, { h: 24, dir: 'b' }), 46) });
});
const horn = wordAt('hear', 15);
shot(p0 + PARADE.length * beat, B(12), { tod: 0.55, tilt: 0.3, rings: horn, heart: wordAt('heart', 16), trains: [['Diesel freight', M.outerBack + 6, 'b', 0, horn, 70]],
  cam: rig('Diesel freight', 0, V(0, 26, -190), V(0, 30, -40), 34, V(0, 22, -150)) });
const sig = demo.signals?.find((s) => s.model)?.model;
shot(B(12), B(13), { tod: 0.58, tilt: 0.8, signal: true, trains: [['Steam express', M.innerLeft + 2, 'a', 160, B(12) + 0.6, 55]],
  cam: rig('Steam express', 0, V(-70, 40, -230), V(0, 30, -20), 38, V(-80, 34, -120)) });
const ts1 = wordAt('trainspotter', 18.5), ts2 = wordAt('trainspotter', ts1 + 0.3);
shot(B(13), ts2 - 0.02, { tod: 0.5, tilt: 0.5, lines: 0.7, trains: [['Steam express', M.innerRight, 'a', 200, B(13) + 0.4, 120]],
  cam: rig('Steam express', 1, V(-90, 26, 60), V(0, 30, -20), 40, V(-90, 26, 200)) });
shot(ts2 - 0.02, wordAt('catch', 20.4), { tod: 0.5, tilt: 0.5, lines: 0.9, trains: [['Wedge set', M.outerRight, 'a', 200, ts2 + 0.3, 240]],
  cam: rig('Wedge set', 0, V(70, 20, -40), V(0, 26, -90), 42, V(70, 20, 140)) });
shot(wordAt('catch', 20.4), wordAt('got', 21.5) - 0.02, { tod: 0.52, tilt: 0.6,
  trains: [['Rural railcar', M.branchTown, 'a', 140, 21.6, 70, { brake: 21.1 }]],
  cam: fixed(track(M.branchTown, 260, { side: 30, h: 26 }), track(M.branchTown, 140, { h: 24 }), 38) });
const got = wordAt('got', 21.5);
// the photo: a wide, scenic frame with the whole train in it (the same in both cuts)
shot(got - 0.02, B(16), { tod: 0.55, tilt: 1.3, polaroid: true, freeze: got, trains: [['Streamlined steam', M.upperViaductA, 'a', 120, got, 60]],
  cam: fixed(track(M.upperViaductA, 60, { side: -900, h: 260 }), track(M.upperViaductA, 60, { h: -20 }), 34) });
shot(B(16), B(17), { tod: 0.6, tilt: 0.3, shake: 1, lines: 0.8, trains: [['Articulated freight', M.innerFront, 'a', 120, B(16), 110]],
  cam: rig('Articulated freight', 0, V(-24, 20, -200), V(0, 36, -40), 46, V(-24, 18, -150)) });
// instrumental montage: a cut every half bar
const mt = B(17), half = (T.bars[18] - T.bars[17]) / 2;
const MONT = [
  { tod: 0.82, tilt: 0.8, trains: [['Commuter (painted)', M.innerRight, 'a', 200, mt + 0.4, 70]],
    cam: rig('Commuter (painted)', 0, V(-170, 64, 60), V(0, 30, -40), 38, V(-160, 60, -60)) },
  { tod: 0.45, tilt: 1.5, cam: dolly(track(M.roads[0].first + 3, 0, { side: -260, h: 420 }), track(M.roads[0].first + 3, 160, { side: -240, h: 400 }),
    track(M.roads[0].first + 3, 0, { side: 60 }), track(M.roads[0].first + 3, 160, { side: 60 }), 42) },
  { tod: 0.5, tilt: 0.6, trains: [['Western 4-4-0', M.upperViaductB, 'a', 60, mt + 2 * half + 0.3, 70]],
    cam: fixed(track(M.upperViaductB, 60, { side: 150, h: -40 }), track(M.upperViaductB, 60, { h: 20 }), 44) },
  { tod: 0.45, tilt: 0.4, doors: true, trains: [['Metro (rounded)', M.innerLeft + 2, 'a', 110, mt + 3 * half - 1, 0]],
    cam: rig('Metro (rounded)', 1, V(-70, 40, 50), V(0, 34, -20), 40) },
  { tod: 0.66, tilt: 0.6, trains: [['Electric express', M.outerBack, 'b', OTUN_OUT, mt + 4 * half + 0.25, 120]],
    cam: fixed(track(M.outerBack, OTUN_OUT + 160, { side: -50, h: 24, dir: 'b' }), track(M.outerBack, OTUN_OUT, { h: 40, dir: 'b' }), 42) },
  { tod: 0.6, tilt: 0.3, sparks: true, trains: [['Wedge set', M.innerRight, 'a', 200, mt + 5 * half, 180, { brake: mt + 5 * half - 0.5 }]],
    cam: rig('Wedge set', 0, V(-90, 22, -20), V(0, 14, 20), 38) },
];
MONT.forEach((o, i) => shot(mt + i * half, i === MONT.length - 1 ? B(20) : mt + (i + 1) * half, o));
const hit = T.onsets.filter((o) => o > 28.2).sort((a, b) => a - b)[0] ?? 28.58;
shot(B(20), hit, { tod: 0.5, tilt: 0.5, lines: 1, trains: [['Steam express', M.innerFront, 'a', 200, B(20), 140]],
  cam: rig('Steam express', 0, V(-60, 40, -260), V(0, 40, -60), 50, V(-20, 34, -150)) });
shot(hit, T.duration + 0.1, { tod: 0.52, tilt: 1.6, card: hit, wires: true,
  trains: [['Steam express', M.innerLeft, 'a', 200, hit, 70], ['Electric express', M.outerLeft, 'b', 200, hit, 80]],
  cam: dolly(track(M.innerLeft, 200, { side: -700, h: 520 }), track(M.innerLeft, 230, { side: -640, h: 470 }), track(M.innerLeft, 200, { side: 200 }), track(M.innerLeft, 230, { side: 200 }), 40) });

// ---------------------------------------------------------------- cut B: wider and more scenic
// Same song, words and overlays; fewer close-ups. Trains are seen whole in the landscape, cameras ride
// alongside at a distance, and the polaroid frames a wide scene. Select with ?cut=b.
const CUT = (q.get('cut') ?? 'a').toLowerCase();
if (CUT === 'b') {
  S.length = 0;
  const side = (train, x, y, z, lx = 0, ly = 30, lz = 0, fov = 36, move = null) => rig(train, 0, V(x, y, z), V(lx, ly, lz), fov, move);
  shot(0, 0.69, { tod: 0.55, tilt: 1.6, wires: true, trains: [['Steam express', M.innerRight, 'a', 160, 0.6, 90]],
    cam: dolly(track(M.innerRight, 160, { side: -1100, h: 820 }), track(M.innerRight, 160, { side: -760, h: 560 }), track(M.innerRight, 160, { side: 160 }), track(M.innerRight, 160, { side: 100 }), 40) });
  shot(0.69, B(1), { tod: 0.5, tilt: 0.9, lines: 0.3, trains: [['Steam express', M.innerRight, 'a', 220, 1.3, 120]],
    cam: side('Steam express', -230, 80, -420, 0, 30, -60, 38, V(-200, 70, -300)) });
  shot(B(1), B(2), { tod: 0.42, tilt: 1.2, trains: [['Commuter (stainless)', M.innerLeft + 2, 'a', 80, B(2) - 0.2, 70]],
    cam: dolly(track(M.innerLeft + 2, 260, { side: -260, h: 170 }), track(M.innerLeft + 2, 200, { side: -240, h: 150 }), track(M.innerLeft + 2, 60, { h: 20 }), track(M.innerLeft + 2, 40, { h: 20 }), 38) });
  shot(B(2), B(3), { tod: 0.38, tilt: 1.0, vf: true, trains: [['Articulated freight', M.outerFront + 2, 'a', 160, B(2) + 0.9, 80]],
    cam: fixed(track(M.outerFront + 2, 160, { side: -340, h: 90 }), track(M.outerFront + 2, 160, { h: 30 }), 34) });
  shot(B(3), B(4), { tod: 0.45, tilt: 1.6, note: true,
    cam: dolly(track(M.roads[1].first + 2, 0, { side: -420, h: 560 }), track(M.roads[1].first + 2, 160, { side: -380, h: 520 }),
      track(M.roads[1].first + 2, 0, { side: 60 }), track(M.roads[1].first + 2, 160, { side: 60 }), 40) });
  shot(B(4), B(5), { tod: 0.55, tilt: 1.2, trains: [['Streamlined steam', M.upperViaductA, 'a', 60, B(4) + 0.7, 60]],
    cam: dolly(track(M.upperViaductA, -60, { side: -460, h: 90 }), track(M.upperViaductA, 140, { side: -420, h: 110 }), track(M.upperViaductA, 0, { h: 10 }), track(M.upperViaductA, 160, { h: 10 }), 34) });
  // drum build: one real close-up (the driving wheel), then a pass
  const db2 = B(5);
  shot(db2, db2 + 2 * beat, { tod: 0.45, tilt: 0.3, trains: [['Steam express', M.innerRight, 'a', 200, db2, 50]],
    cam: rig('Steam express', 0, V(-110, 26, 20), V(-14, 14, 0), 34, V(-110, 26, -30)) });
  shot(db2 + 2 * beat, B(6), { tod: 0.5, tilt: 0.8, lines: 0.6, trains: [['Bullet set', M.outerRight + 2, 'a', 180, db2 + 2.6 * beat, 240]],
    cam: fixed(track(M.outerRight + 2, 180, { side: 230, h: 70 }), track(M.outerRight + 2, 150, { h: 20 }), 40) });
  shot(B(6), tr2, { tod: 0.4, tilt: 0.8, lines: 0.8, shake: 0.2, trains: [['Wedge set', M.outerRight + 2, 'a', 200, tr1 + 0.35, 300]],
    cam: fixed(track(M.outerRight + 2, 200, { side: 200, h: 60 }), track(M.outerRight + 2, 150, { h: 20 }), 42) });
  shot(tr2, luv - 0.02, { tod: 0.4, tilt: 0.8, lines: 0.8, shake: 0.2, trains: [['Road switcher freight', M.innerRight + 2, 'a', 200, tr2 + 0.3, 220]],
    cam: fixed(track(M.innerRight + 2, 200, { side: -220, h: 60 }), track(M.innerRight + 2, 260, { h: 20 }), 42) });
  shot(luv - 0.02, LINES[4]?.s ?? 11.46, { tod: 0.45, tilt: 1.6, wires: true,
    trains: [['Steam express', M.innerLeft, 'a', 120, luv, 90], ['Electric express', M.outerLeft, 'b', 120, luv, 110], ['Western 4-4-0', M.upperTop, 'a', 40, luv, 60]],
    cam: dolly(track(M.innerLeft, 120, { side: -1000, h: 820 }), track(M.innerLeft, 260, { side: -860, h: 680 }), track(M.innerLeft, 120, { side: 320 }), track(M.innerLeft, 260, { side: 320 }), 42) });
  shot(LINES[4]?.s ?? 11.46, B(9), { tod: [0.3, 0.84], tilt: 1.4, trains: [['Commuter (painted)', M.innerRight, 'a', 200, 12.2, 60]],
    cam: side('Commuter (painted)', 380, 260, 200, 0, 20, -60, 40, V(340, 230, -60)) });
  PARADE.forEach(([name, label], i) => {
    const a = p0 + i * beat;
    shot(a, a + beat, { tod: 0.42, tilt: 0.9, chip: label, lines: 0.3, trains: [[name, M.outerRight + 2, 'b', 150, a + beat * 0.25, 220]],
      cam: fixed(track(M.outerRight + 2, 150, { side: 300, h: 80, dir: 'b' }), track(M.outerRight + 2, 110, { h: 20, dir: 'b' }), 40) });
  });
  shot(p0 + PARADE.length * beat, B(12), { tod: 0.55, tilt: 0.8, rings: horn, heart: wordAt('heart', 16), trains: [['Diesel freight', M.innerRight, 'a', 200, horn, 70]],
    cam: side('Diesel freight', 170, 70, -340, 0, 30, -40, 34, V(150, 60, -270)) });
  shot(B(12), B(13), { tod: 0.58, tilt: 1.3, trains: [['Steam express', M.innerLeft + 2, 'a', 160, B(12) + 0.6, 55]],
    cam: dolly(track(M.innerLeft + 2, 340, { side: -320, h: 200 }), track(M.innerLeft + 2, 300, { side: -300, h: 180 }), track(M.innerLeft + 2, 150, { h: 20 }), track(M.innerLeft + 2, 190, { h: 20 }), 38) });
  shot(B(13), ts2 - 0.02, { tod: 0.5, tilt: 0.9, lines: 0.4, trains: [['Steam express', M.innerRight, 'a', 200, B(13) + 0.4, 120]],
    cam: side('Steam express', 280, 150, 120, 0, 30, 60, 36, V(280, 150, 320)) });
  shot(ts2 - 0.02, wordAt('catch', 20.4), { tod: 0.5, tilt: 0.9, lines: 0.5, trains: [['Wedge set', M.outerRight, 'a', 200, ts2 + 0.3, 220]],
    cam: side('Wedge set', 280, 200, 40, 0, 30, 100, 38, V(280, 200, 260)) });
  shot(wordAt('catch', 20.4), got - 0.02, { tod: 0.52, tilt: 1.0, trains: [['Rural railcar', M.branchTown, 'a', 140, 21.6, 70, { brake: 21.1 }]],
    cam: fixed(track(M.branchTown, 360, { side: 120, h: 260 }), track(M.branchTown, 150, { h: 20 }), 36) });
  // the photo: a wide, scenic frame with the whole train in it
  shot(got - 0.02, B(16), { tod: 0.55, tilt: 1.3, polaroid: true, freeze: got, trains: [['Streamlined steam', M.upperViaductA, 'a', 120, got, 60]],
    cam: fixed(track(M.upperViaductA, 60, { side: -900, h: 260 }), track(M.upperViaductA, 60, { h: -20 }), 34) });
  shot(B(16), B(17), { tod: 0.6, tilt: 0.7, shake: 0.5, lines: 0.5, trains: [['Articulated freight', M.innerFront, 'a', 120, B(16), 110]],
    cam: side('Articulated freight', -150, 50, -360, 0, 34, -40, 40, V(-130, 40, -260)) });
  const MONT_B = [
    { tod: 0.84, tilt: 1.4, trains: [['Commuter (painted)', M.innerRight, 'a', 200, mt + 0.4, 70]],
      cam: side('Commuter (painted)', 380, 260, 160, 0, 20, -40, 40) },
    { tod: 0.45, tilt: 1.6, cam: dolly(track(M.roads[0].first + 3, 0, { side: -420, h: 560 }), track(M.roads[0].first + 3, 160, { side: -400, h: 540 }),
      track(M.roads[0].first + 3, 0, { side: 60 }), track(M.roads[0].first + 3, 160, { side: 60 }), 42) },
    { tod: 0.5, tilt: 0.9, trains: [['Western 4-4-0', M.upperViaductB, 'a', 60, mt + 2 * half + 0.3, 70]],
      cam: fixed(track(M.upperViaductB, 60, { side: 300, h: -10 }), track(M.upperViaductB, 60, { h: 10 }), 40) },
    { tod: 0.45, tilt: 1.0, doors: true, trains: [['Metro (rounded)', M.innerLeft + 2, 'a', 110, mt + 3 * half - 1, 0]],
      cam: side('Metro (rounded)', -200, 110, 120, 0, 30, -20, 38) },
    { tod: 0.66, tilt: 1.2, trains: [['Electric express', M.outerBack, 'b', OTUN_OUT, mt + 4 * half + 0.25, 120]],
      cam: fixed(track(M.outerBack, OTUN_OUT + 320, { side: -240, h: 140, dir: 'b' }), track(M.outerBack, OTUN_OUT + 60, { h: 30, dir: 'b' }), 40) },
    { tod: 0.6, tilt: 0.8, sparks: true, trains: [['Wedge set', M.innerRight, 'a', 200, mt + 5 * half, 180, { brake: mt + 5 * half - 0.5 }]],
      cam: side('Wedge set', -200, 60, -80, 0, 20, 40, 38) },
  ];
  MONT_B.forEach((o, i) => shot(mt + i * half, i === MONT_B.length - 1 ? B(20) : mt + (i + 1) * half, o));
  shot(B(20), hit, { tod: 0.5, tilt: 0.7, lines: 0.6, trains: [['Steam express', M.innerFront, 'a', 200, B(20), 140]],
    cam: side('Steam express', -140, 60, -420, 0, 36, -60, 42, V(-90, 46, -280)) });
  shot(hit, T.duration + 0.1, { tod: 0.52, tilt: 1.6, card: hit, wires: true,
    trains: [['Steam express', M.innerLeft, 'a', 200, hit, 70], ['Electric express', M.outerLeft, 'b', 200, hit, 80]],
    cam: dolly(track(M.innerLeft, 200, { side: -800, h: 600 }), track(M.innerLeft, 230, { side: -740, h: 550 }), track(M.innerLeft, 200, { side: 200 }), track(M.innerLeft, 230, { side: 200 }), 40) });
}

// ---------------------------------------------------------------- simulation
let state = { shot: null, t: -1 };
function enter(s) {
  for (const tr of Object.values(HERO)) { tr.group.visible = false; fx.detach(tr); }
  fx.clear();
  s.live = s.trains.map(([name, step, dir, mark, when, speed, extra = {}]) => {
    const tr = HERO[name];
    const ts = s.t0 - PRE;
    const start = along(edgeOf(step, dir), mark, -speed * (when - ts));
    tr.setTrack(L, start.edge, start.u);
    Object.assign(tr, { target: null, speed, accel: 0, rolled: 0, prevRolled: 0 });
    tr.group.visible = true;
    if (s.doors) for (const c of tr.cars) c.setDoors?.(false);
    fx.attach(tr);
    return { tr, extra };
  });
  if (s.signal && sig) { sig.play('close'); sig.mixer.setTime(1); }
  state = { shot: s, t: s.t0 - PRE, doorsOpened: false, signalCleared: false };
}
function stepTo(t) {
  const s = state.shot;
  while (state.t < t - 1e-6) {
    const dt = Math.min(DT, t - state.t);
    for (const { tr, extra } of s.live) {
      if (extra.brake !== undefined && state.t >= extra.brake) tr.target = 0;
      tr.update(dt);
    }
    if (s.doors && !state.doorsOpened && state.t >= s.t0 + 0.05) { state.doorsOpened = true; for (const { tr } of s.live) for (const c of tr.cars) c.setDoors?.(true); }
    if (s.signal && sig && !state.signalCleared && state.t >= s.t0 + 0.15) { state.signalCleared = true; sig.play('open'); }
    if (s.signal && sig) sig.mixer.update(dt);
    fx.update(dt);
    state.t += dt;
  }
}

// ---------------------------------------------------------------- overlay
const pulse = (t, times, decay = 0.09) => { let best = 0; for (const b of times) if (b <= t) best = Math.exp(-(t - b) / decay); return best; };
const noise = (t, k) => Math.sin(t * 37.1 + k * 3.7) * 0.5 + Math.sin(t * 61.7 + k * 1.3) * 0.3 + Math.sin(t * 13.3 + k) * 0.2;
const SLAMS = [
  ['HERE', wordAt('here', 0), -8, '#ffd23f'], ['IT', wordAt('it', 1), 6, '#ffd23f'], ['COMES!', wordAt('comes', 1), -4, '#ff8a1f'],
  ['TRAINS!', tr1, -6, '#ffd23f'], ['TRAINS!', tr2, 6, '#7ad3ff'], ['I LOVE', luv - 0.02, -3, '#ff6fa8'], ['TRAINS!', wordAt('trains', luv), 4, '#ffd23f'],
  ['HONK!', horn, -5, '#ffd23f'], ['TRAIN', ts1, -5, '#ffd23f'], ['SPOTTER', ts1 + 0.32, 4, '#ff8a1f'], ['TRAINSPOTTER', ts2, -3, '#7ad3ff'],
];
const wordsEl = $('words');
const slamEls = SLAMS.map(([text, , rot, col]) => {
  const d = document.createElement('div');
  d.className = 'word';
  d.textContent = text;
  d.style.color = col;
  if (text.length > 8) d.style.fontSize = `${Math.floor(960 / (text.length * 0.86))}px`; // long words fit the frame
  d.dataset.rot = rot;
  wordsEl.appendChild(d);
  return d;
});
function overlay(t, s) {
  const tl = t - s.t0;
  // flashes on cuts, bars and the hit
  const cutFlash = Math.exp(-Math.max(0, tl) / 0.06) * 0.55;
  const hitFlash = pulse(t, [hit], 0.18);
  $('flash').style.opacity = Math.min(1, cutFlash + hitFlash + (s.vf ? pulse(t, [wordAt('hand', 4)], 0.1) : 0));
  $('lines').style.opacity = (s.lines ?? 0) * (0.55 + 0.45 * pulse(t, BEATS, 0.12));
  $('lines').style.transform = `rotate(${(t * 40) % 3.6}deg) scale(1.6)`;
  $('vf').style.opacity = s.vf ? 1 : 0;
  $('vf').querySelector('.rec b').style.opacity = Math.floor(t * 3) % 2 ? 1 : 0.2;
  const note = $('note');
  note.style.opacity = s.note ? Math.min(1, tl / 0.15) : 0;
  note.querySelectorAll('.n').forEach((n, i) => { n.style.opacity = s.note && t >= s.t0 + 0.08 + i * beat ? 1 : 0; });
  const chip = $('chip');
  chip.textContent = s.chip ?? '';
  chip.style.opacity = s.chip ? 1 : 0;
  chip.style.transform = `translateX(-50%) scale(${1 + 0.25 * Math.exp(-tl / 0.08)}) rotate(-3deg)`;
  $('rings').style.opacity = s.rings && t > s.rings ? 0.7 * Math.exp(-(t - s.rings) / 0.9) : 0;
  $('rings').style.transform = s.rings ? `scale(${1 + ((t - s.rings) * 1.4) % 1})` : '';
  $('tint').style.background = s.heart && t > s.heart ? '#ff3b7a' : '#000';
  $('tint').style.opacity = s.heart && t > s.heart ? 0.35 * Math.exp(-(t - s.heart) / 0.25) : s.card ? 0.25 : 0;
  // polaroid
  const pol = $('polaroid');
  pol.style.opacity = s.polaroid ? 1 : 0;
  if (s.polaroid) {
    const k = Math.exp(-tl / 0.1);
    pol.style.transform = `rotate(${-4 + 6 * k}deg) scale(${1 + 0.15 * k})`;
  }
  // title card
  const card = $('card');
  card.style.opacity = s.card ? 1 : 0;
  $('burst').style.opacity = s.card ? 0.22 : 0;
  $('burst').style.transform = `rotate(${t * 12}deg) scale(2.2)`;
  if (s.card) {
    const k = Math.exp(-(t - s.card) / 0.09);
    card.querySelector('.t').style.transform = `scale(${1 + 1.4 * k}) rotate(${-3 * k}deg)`;
    card.querySelector('.s').style.transform = `translateY(${Math.max(0, 1 - (t - s.card) / 0.25) * 400}px)`;
    card.querySelector('.f').style.opacity = Math.min(1, Math.max(0, (t - s.card - 0.3) / 0.25));
  }
  // word slams
  SLAMS.forEach(([, at, rot], i) => {
    const el = slamEls[i];
    const next = SLAMS[i + 1]?.[1] ?? Infinity;
    const live = t >= at && t < Math.min(at + 0.85, next) && !s.card;
    el.style.opacity = live ? 1 : 0;
    if (!live) return;
    const k = t - at;
    const sc = k < 0.09 ? lerp(2.6, 0.92, k / 0.09) : 0.92 + 0.08 * Math.exp(-(k - 0.09) / 0.05) + k * 0.06;
    el.style.transform = `translate(-50%, -50%) translateY(-260px) rotate(${rot}deg) scale(${sc})`;
  });
  // lyrics: the sung line, its current word popped
  const line = LINES.find((l) => t >= l.s - 0.05 && t <= l.e + 0.35);
  const lyr = $('lyric');
  if (!line || s.card || s.polaroid) { lyr.innerHTML = ''; return; }
  const ws = WORDS.filter((x) => x.s >= line.s - 0.3 && x.s < line.e - 0.05);
  lyr.innerHTML = ws.map((x) => {
    const on = t >= x.s && t < x.e + 0.08;
    const k = on ? Math.exp(-(t - x.s) / 0.12) : 0;
    return `<span style="color:${on ? '#ffd23f' : t >= x.s ? '#fff' : '#ffffff88'};transform:scale(${1 + 0.16 * k}) translateY(${-10 * k}px)">${x.w.toUpperCase()}</span>`;
  }).join(' ');
}

// ---------------------------------------------------------------- seek / render
function shotAt(t) { return S.find((s) => t >= s.t0 && t < s.t1) ?? S[S.length - 1]; }
async function seek(t) {
  const s = shotAt(t);
  if (state.shot !== s || t < state.t - 1e-6) enter(s);
  stepTo(s.freeze ? Math.min(t, s.freeze) : t);
  const f = (t - s.t0) / Math.max(1e-6, s.t1 - s.t0);
  const pose = s.cam(Math.min(1, Math.max(0, s.freeze ? 0 : f)));
  // beat punch and shake
  const punch = s.card ? 0 : pulse(t, BEATS, 0.08); // the title card holds steady
  const sh = (s.shake ?? 0) * (6 + 10 * punch);
  const eye = pose.eye.clone().add(V(noise(t, 1) * sh, noise(t, 2) * sh, noise(t, 3) * sh));
  camera.position.copy(eye);
  camera.fov = pose.fov - 3 * punch;
  camera.updateProjectionMatrix();
  camera.lookAt(pose.look);
  focus.target.copy(pose.look);
  if (w) w.visible = !!s.wires;
  pretty.setDust(s.tilt >= 0.9);
  const tod = Array.isArray(s.tod) ? lerp(s.tod[0], s.tod[1], ease(f)) : s.tod;
  if (pretty.time !== tod) pretty.setTime(tod);
  pretty.setTilt(s.tilt);
  pretty.clock = t;
  overlay(t, s);
  demo.grass?.setTime(t); // the wind follows song time, so every frame is exact
  pretty.render(0);
  await new Promise((r) => requestAnimationFrame(() => r()));
}

window.__trailer = { duration: T.duration, fps: FPS, seek, ready: true, shots: S.length };
$('ui').textContent = q.has('capture') ? '' : `${S.length} shots · ?t=seconds to jump · Space plays`;
if (q.has('capture')) $('ui').remove();
else {
  let t = Number(q.get('t') ?? 0), playing = false, last = 0;
  const audio = new Audio('../out/trailer/song.m4a');
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    playing = !playing;
    if (playing) { audio.currentTime = t; audio.play(); } else audio.pause();
  });
  const loop = async (now) => {
    if (playing) t = audio.currentTime;
    if (playing || now - last > 500) { last = now; await seek(Math.min(t, T.duration - 0.01)); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
