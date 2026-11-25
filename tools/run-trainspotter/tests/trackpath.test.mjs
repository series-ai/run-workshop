// node --test tests/  (needs Python 3 with numpy on PATH as `python`, for the catalogue)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Layout, Runner, placeConsist, routeAt, crankPin, rodPose } from '../viewer/trackpath.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(execFileSync('python', [path.join(here, '..', 'kit', 'catalog.py'), '--family', 'track,civil'], { maxBuffer: 1 << 26 }).toString());
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const near = (p, q, tol = 1e-6) => assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= tol, `${p} != ${q}`);

// An oval with a passing loop on one side, the layout the viewer shows.
export const OVAL = [
  'track-curve-90-r192', 'track-curve-90-r192',
  'track-straight-128', 'track-straight-128', 'track-straight-128', 'track-straight-128', 'track-straight-128',
  'track-curve-90-r192', 'track-curve-90-r192',
  'track-switch-right', 'track-straight-128', { piece: 'track-switch-left', enter: 'b', leave: 'a' },
  { piece: 'track-straight-128', from: [9, 'c'] },
];

const routed = { ...cat.track, ...Object.fromEntries(Object.entries(cat.civil ?? {}).filter(([, e]) => e.routes)) };
const headingOf = (t) => ((Math.atan2(-t[0], -t[2]) * 180) / Math.PI + 360) % 360;
const yawDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

test('every route runs from its connector to its connector, along their headings (JS maths agree with the Python build)', () => {
  assert.ok(Object.keys(routed).length >= 21, `only ${Object.keys(routed).length} routed pieces`);
  for (const [name, spec] of Object.entries(routed)) {
    for (const r of spec.routes) {
      const a = routeAt(r, 0);
      near(a.p, spec.connectors[r.from].p, 1e-5);
      assert.ok(yawDiff(headingOf(a.t) + 180, spec.connectors[r.from].yaw) < 1e-4, `${name}/${r.id} leaves ${r.from} the wrong way`);
      if (r.to) {
        const b = routeAt(r, r.length);
        near(b.p, spec.connectors[r.to].p, 1e-5);
        assert.ok(yawDiff(headingOf(b.t), spec.connectors[r.to].yaw) < 1e-4, `${name}/${r.id} reaches ${r.to} the wrong way`);
      }
      close(r.segs.reduce((acc, sg) => acc + (sg.t === 'line' ? Math.hypot(sg.p1[0] - sg.p0[0], sg.p1[1] - sg.p0[1], sg.p1[2] - sg.p0[2]) : 0), 0) <= r.length + 1e-6 ? 1 : 0, 1);
    }
  }
});

test('eight 45-degree curves close a circle, and a diagonal run rejoins the grid', () => {
  const circle = [];
  for (let k = 0; k < 4; k++) circle.push('track-curve-45-right', { piece: 'track-curve-45-left', enter: 'b', leave: 'a' });
  assert.deepEqual(new Layout(cat, circle).openEnds(), []);
  const run = new Layout(cat, ['track-curve-45-right', 'track-straight-diagonal', 'track-straight-diagonal', { piece: 'track-curve-45-right', enter: 'b', leave: 'a' }]);
  const end = run.placed[3].connector('a');
  for (const v of end.p) close(v / 32, Math.round(v / 32), 1e-6);
  assert.ok(yawDiff(end.yaw, 0) < 1e-6, `ends facing ${end.yaw}`); // back on the grid, still running -Z
  for (const i of [1, 2]) for (const v of run.placed[i].connector('b').p) close(v / 32, Math.round(v / 32), 1e-6);
});

test('a crossing carries trains straight over on both routes', () => {
  const lay = new Layout(cat, ['track-straight-128', 'track-crossing-90', 'track-straight-128',
    { piece: 'track-straight-128', from: [1, 'c'], enter: 'b', leave: 'a' }, { piece: 'track-straight-128', from: [1, 'd'] }]);
  const along = new Runner(lay, lay.edge(0));
  along.advance(128 + 64);
  assert.equal(along.edge.piece, 1);
  assert.equal(along.edge.route.id, 'main');
  along.advance(128);
  assert.equal(along.edge.piece, 2);
  const across = new Runner(lay, { piece: 3, route: lay.placed[3].spec.routes[0], dir: 1 }); // a -> b, toward the crossing
  across.advance(128 + 64);
  assert.equal(across.edge.route.id, 'cross');
  across.advance(128);
  assert.equal(across.edge.piece, 4);
});

test('a ramp climbs smoothly, cars pitch on it, and it comes back down', () => {
  const lay = new Layout(cat, ['track-straight-128', 'track-ramp-32', 'track-straight-128', { piece: 'track-ramp-32', enter: 'b', leave: 'a' }, 'track-straight-128']);
  close(lay.placed[2].ty, 32);
  close(lay.placed[4].ty, 0);
  const run = new Runner(lay, lay.edge(0));
  const climb = 128 + lay.placed[1].spec.routes[0].length; // the ramp is a little longer than its 256 run
  let prev = 0;
  for (let d = 0; d < climb; d += 8) {
    run.advance(Math.min(8, climb - d));
    const y = run.behind(0).p[1];
    assert.ok(y >= prev - 1e-9, 'climbs without dipping');
    prev = y;
  }
  close(prev, 32, 1e-6);
  const fresh = new Runner(lay, lay.edge(0));
  fresh.advance(128 + 128 + 40); // the coach straddles the middle of the ramp
  const [p] = placeConsist(fresh, [{ couplers: { f: -80, r: 80 }, guides: [-52, 52] }]);
  assert.ok(p.pitch > 3 && p.pitch < 15, `pitch ${p.pitch}`);
  close(p.pos[1] - (p.front[1] + p.rear[1]) / 2, 8);
});

test('bridges are track: a train runs over the girder, truss and viaduct spans', () => {
  const lay = new Layout(cat, ['track-straight-64', 'bridge-girder', 'bridge-truss', 'bridge-viaduct-arch', 'bridge-viaduct-arch', 'track-straight-64']);
  const run = new Runner(lay, lay.edge(0));
  run.advance(64 + 128 + 192 + 256 + 32);
  assert.equal(run.edge.piece, 5);
  close(run.behind(0).p[1], 0);
});

test('turntable: the bridge lines up a-b or c-d', () => {
  const lay = new Layout(cat, ['track-straight-64', 'track-turntable', 'track-straight-64', { piece: 'track-straight-64', from: [1, 'c'] }]);
  const ab = new Runner(lay, lay.edge(0));
  ab.advance(64 + 100);
  assert.equal(ab.edge.route.id, 'ab');
  lay.setSwitch(1, 'open');
  const cd = new Runner(lay, { piece: 3, route: lay.placed[3].spec.routes[0], dir: -1 });
  cd.advance(64 + 100);
  assert.equal(cd.edge.route.id, 'cd');
  assert.equal(cat.track['track-turntable'].turntable.turn.open, 90);
});

test('the oval closes and the passing loop meets the second points', () => {
  const lay = new Layout(cat, OVAL);
  const open = lay.openEnds();
  assert.deepEqual(open, [], `open ends: ${JSON.stringify(open)}`);
});

test('a runner goes all the way round and comes back to where it started', () => {
  const lay = new Layout(cat, OVAL);
  const run = new Runner(lay, lay.edge(0));
  const total = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].reduce((a, i) => a + lay.placed[i].spec.routes[0].length, 0);
  const start = run.behind(0).p;
  run.advance(total);
  near(run.behind(0).p, start, 1e-4);
  assert.equal(run.stopped, false);
});

test('switching the points sends the train round the loop line instead', () => {
  const lay = new Layout(cat, OVAL);
  const a = new Runner(lay, lay.edge(9));
  a.advance(300);
  assert.equal(a.edge.piece, 10, 'points set for the main line: on the main-line straight');
  lay.setSwitch(9, 'open');
  const b = new Runner(lay, lay.edge(9));
  b.advance(300);
  assert.equal(b.edge.piece, 12, 'points set for the loop: on the loop-line straight');
  b.advance(128 + 100); // 33.5 into the loop straight + 228: well into the second points
  assert.equal(b.edge.piece, 11, 'the loop line runs back through the second points');
  b.advance(300);
  assert.equal(b.edge.piece, 0, 'and on round the oval');
  // the loop line is one track spacing (64) from the main line
  const mid = (r) => r.layout.edgeAt(r.edge, r.edge.route.length / 2).p;
  const m = new Runner(lay, { piece: 10, route: lay.placed[10].spec.routes[0], dir: 1 });
  const l = new Runner(lay, { piece: 12, route: lay.placed[12].spec.routes[0], dir: 1 });
  close(Math.hypot(mid(m)[0] - mid(l)[0], mid(m)[2] - mid(l)[2]), 64, 1e-6);
});

test('cars keep both guides on the rails and their couplers together, round a curve', () => {
  const lay = new Layout(cat, OVAL);
  const run = new Runner(lay, lay.edge(2));
  run.advance(600); // well into the second pair of curves, with history behind
  const coach = { couplers: { f: -80, r: 80 }, guides: [-52, 52] };
  const cars = [coach, coach, { ...coach, flip: true }, coach];
  const poses = placeConsist(run, cars);
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i];
    close(Math.hypot(p.front[0] - p.rear[0], p.front[2] - p.rear[2]), 104, 1e-4);
    if (i) {
      // the previous rear coupler and this front coupler sit within a voxel of each other
      const prev = poses[i - 1];
      const dirP = [prev.front[0] - prev.rear[0], prev.front[2] - prev.rear[2]].map((c) => c / 104);
      const dirC = [p.front[0] - p.rear[0], p.front[2] - p.rear[2]].map((c) => c / 104);
      const rearCoupler = [prev.rear[0] - dirP[0] * 28, prev.rear[2] - dirP[1] * 28];
      const frontCoupler = [p.front[0] + dirC[0] * 28, p.front[2] + dirC[1] * 28];
      assert.ok(Math.hypot(rearCoupler[0] - frontCoupler[0], rearCoupler[1] - frontCoupler[1]) < 1.0);
    }
  }
});

test('steam rods: crank pins go round at the throw, quartered sides, and close after a turn', () => {
  for (const th of [0, 0.7, 2, 4]) {
    const [y, z] = crankPin(th, 5, 0);
    close(Math.hypot(y, z), 5);
  }
  const rods = { crank: 5, slideY: 20, mainLen: 42 };
  const a = rodPose(0, rods, 12, 0);
  const b = rodPose(2 * Math.PI, rods, 12, 0);
  close(a.crosshead, b.crosshead);
  close(a.main[2], b.main[2]);
  close(a.crosshead, 0);
});
