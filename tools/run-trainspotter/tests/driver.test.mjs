// node --test tests/driver.test.mjs  (needs Python 3 with numpy on PATH as `python`, for the catalogue)
// Station stops, shuttles, keeping apart and signals, on real Train objects with light stand-in cars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { Layout } from '../viewer/trackpath.js';
import { Train } from '../viewer/train-kit.js';
import { Driver, Operations } from '../viewer/driver.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(execFileSync('python', [path.join(here, '..', 'kit', 'catalog.py'), '--family', 'track,civil'], { maxBuffer: 1 << 26 }).toString());

const C = 'track-curve-90-r192';
const S = 'track-straight-128';
// 0-13: an oval; 14-18: a separate line with a buffer stop at each end (14 and 18), running +Z
const STEPS = [
  C, C, S, S, S, S, S, C, C, S, S, S, S, S,
  { piece: 'track-buffer-stop', at: { p: [2000, 0, 0], yaw: 0 } },
  { piece: S, from: [14, 'a'] }, S, S, 'track-buffer-stop',
];

function car(L = 160) {
  return {
    entry: { L, couplers: { f: -L / 2, r: L / 2 }, guides: [-(L / 2 - 28), L / 2 - 28] },
    flip: false,
    group: new THREE.Group(),
    model: { mixer: { update() {} } },
    doors: [],
    pose(p) { this.lastPose = p; },
    setDoors(open) { this.doors.push(open); },
  };
}

function train(lay, step, u, n = 2, dir = 'a') {
  const t = new Train(Array.from({ length: n }, () => car()), 8);
  t.setTrack(lay, lay.edge(step, dir), u);
  return t;
}

function run(ops, trains, seconds, each = () => {}) {
  const dt = 1 / 30;
  for (let i = 0; i < seconds * 30; i++) {
    ops.update(dt);
    for (const t of trains) t.update(dt);
    each(i * dt);
  }
}

test('a train brakes to its station stop, stands with its doors open, then pulls away', () => {
  const lay = new Layout(cat, STEPS);
  const t = train(lay, 2, 10);
  const ops = new Operations({});
  const events = [];
  ops.on((name) => events.push(name));
  const d = ops.addTrain(t, { speed: 90, stops: [{ step: 4, at: 100, dwell: 3 }] });
  let arrivedAt = null;
  run(ops, [t], 30, () => {
    if (d.state === 'dwell' && !arrivedAt) arrivedAt = { piece: t.runner.edge.piece, u: t.runner.u };
  });
  assert.ok(arrivedAt, 'it stopped');
  assert.equal(arrivedAt.piece, 4);
  assert.ok(Math.abs(arrivedAt.u - 100) <= 2, `stopped at ${arrivedAt.u.toFixed(2)}, wanted 100`);
  assert.deepEqual(events.slice(0, 2), ['arrive', 'depart']);
  assert.deepEqual(t.cars[0].doors.slice(0, 2), [true, false], 'doors opened, then closed before leaving');
  assert.ok(t.speed > 0, 'and it is moving again');
});

test('a train stands for the whole dwell, then comes round to the same stop again', () => {
  const lay = new Layout(cat, STEPS);
  const t = train(lay, 2, 10);
  const ops = new Operations({});
  const d = ops.addTrain(t, { speed: 150, stops: [{ step: 4, at: 100, dwell: 2 }] });
  let arrivals = 0;
  let standStart = null;
  ops.on((name) => {
    if (name === 'arrive') { arrivals++; standStart = t.rolled; }
    if (name === 'depart') assert.ok(Math.abs(t.rolled - standStart) < 1e-6, 'did not move while standing');
  });
  run(ops, [t], 60);
  assert.ok(arrivals >= 2, `stopped ${arrivals} time(s) in a minute`);
  assert.notEqual(d.state, 'ended');
});

test('a shuttle stops short of the buffers, reverses, and comes back', () => {
  const lay = new Layout(cat, STEPS);
  const t = train(lay, 16, 60); // heading for the buffer stop at 18
  const ops = new Operations({});
  const events = [];
  ops.on((name, tr, extra) => events.push([name, extra.step]));
  ops.addTrain(t, { speed: 60, shuttle: true, dwellEnd: 2 });
  const faceA = lay.placed[14].connector('a').p[2] - 22; // buffer faces: 22 along each buffer stop from its connector
  const faceB = lay.placed[18].connector('a').p[2] + 22;
  let zMin = Infinity, zMax = -Infinity;
  run(ops, [t], 70, () => {
    const z = t.runner.behind(0).p[2];
    zMin = Math.min(zMin, z);
    zMax = Math.max(zMax, z);
  });
  const reversals = events.filter(([n]) => n === 'reverse').map(([, s]) => s);
  assert.ok(reversals.length >= 2, `reversed ${reversals.length} time(s)`);
  assert.deepEqual(reversals.slice(0, 2), [18, 14], 'at one end, then the other');
  assert.ok(zMax <= faceB + 1e-6 && zMin >= faceA - 1e-6, `front stayed between the buffers (${zMin.toFixed(1)}..${zMax.toFixed(1)})`);
});

test('reversing puts the front where the rear was, keeping the wheels turned as they were', () => {
  const lay = new Layout(cat, STEPS);
  const t = train(lay, 3, 50, 3);
  t.update(0);
  const rear = t.runner.behind(t.tailDistance).p;
  const last = t.cars[t.cars.length - 1];
  t.reverse();
  const front = t.runner.behind(0).p;
  assert.ok(Math.hypot(front[0] - rear[0], front[2] - rear[2]) < 1.5, 'the new front is the old rear coupler');
  assert.equal(t.cars[0], last, 'the old rear car leads');
  assert.equal(t.cars[0].flip, true);
  // the new runner's history is the track the train just covered: the rest of the train lies on it
  const tail = t.runner.behind(t.length);
  const onTrack = lay.edges().some((e) => {
    for (let u = 0; u <= e.route.length; u += 1) {
      const q = lay.edgeAt(e, u).p;
      if (Math.hypot(q[0] - tail.p[0], q[2] - tail.p[2]) < 1) return true;
    }
    return false;
  });
  assert.ok(onTrack);
});

test('a fast train catches a slow one on the same loop but never runs into it', () => {
  const lay = new Layout(cat, STEPS);
  const slow = train(lay, 9, 60);
  const fast = train(lay, 2, 60);
  const ops = new Operations({});
  ops.addTrain(slow, { speed: 25 });
  ops.addTrain(fast, { speed: 140 });
  let closest = Infinity;
  run(ops, [slow, fast], 90, () => {
    const a = fast.runner.spans(fast.tailDistance);
    const b = slow.runner.spans(slow.tailDistance);
    for (const x of a) for (const y of b) {
      if (x.piece !== y.piece || x.route !== y.route) continue;
      assert.ok(x.hi <= y.lo + 1e-6 || y.hi <= x.lo + 1e-6, 'the two trains overlap');
      closest = Math.min(closest, Math.max(y.lo - x.hi, x.lo - y.hi));
    }
  });
  assert.ok(closest < 200, 'the fast train did catch up');
});

test('a station exit signal clears as the train leaves, and goes back to danger behind it', () => {
  const lay = new Layout(cat, STEPS);
  const t = train(lay, 2, 10);
  const plays = [];
  const signal = { play: (n) => plays.push([n, Math.round(t.rolled)]) };
  const ops = new Operations({ signals: [{ model: signal, step: 4 }] });
  ops.addTrain(t, { speed: 90, stops: [{ step: 4, at: 100, dwell: 2 }] });
  let departedAt = null;
  ops.on((name) => { if (name === 'depart' && departedAt === null) departedAt = Math.round(t.rolled); });
  run(ops, [t], 20);
  assert.deepEqual(plays.map(([n]) => n).slice(0, 2), ['open', 'close']);
  assert.equal(plays[0][1], departedAt, 'clear as it departs');
  // back to danger once the whole train is past the step: front 28 left of the step, plus its length
  assert.ok(plays[1][1] - departedAt >= 28 + t.length - 2, 'danger only after the tail has passed');
});

test('a manual train is left alone but kept clear of', () => {
  const lay = new Layout(cat, STEPS);
  const parked = train(lay, 5, 100);
  const runner = train(lay, 2, 10);
  const ops = new Operations({});
  const d = ops.addTrain(parked, { manual: true });
  ops.addTrain(runner, { speed: 100 });
  parked.speed = 0;
  run(ops, [parked, runner], 20);
  assert.equal(parked.speed, 0);
  assert.equal(d.state, 'run');
  const gap = runner.runner.spans(runner.tailDistance);
  assert.ok(runner.speed < 1, 'the running train has stopped behind the parked one');
  assert.ok(gap.length > 0);
});

test('Driver works on its own too', () => {
  const lay = new Layout(cat, STEPS);
  const t = train(lay, 2, 10);
  const d = new Driver(t, { speed: 80, stops: [{ step: 3, at: 64, dwell: 1 }] });
  for (let i = 0; i < 300; i++) { d.update(1 / 30, [t]); t.update(1 / 30); }
  assert.ok(['run', 'dwell'].includes(d.state));
});
