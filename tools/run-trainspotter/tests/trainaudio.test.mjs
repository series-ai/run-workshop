import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossings, axleOffsets, JOINT } from '../viewer/train-audio.js';

test('crossings: every joint once, at its exact fraction of the move, in either direction', () => {
  assert.deepEqual(crossings(0, 100, 128), []);
  assert.deepEqual(crossings(100, 160, 128), [{ k: 1, f: 28 / 60 }]);
  assert.deepEqual(crossings(0, 300, 128, 10).map((c) => c.k), [0, 1, 2]);
  assert.deepEqual(crossings(160, 100, 128), [{ k: 1, f: 32 / 60 }]);
  assert.deepEqual(crossings(50, 50, 128), []);
});

test('a train at constant speed clacks at a constant rhythm, however the frames fall', () => {
  // one axle, 75 voxels/s, ragged frame times: hits land a whole joint apart in time
  const v = 75;
  let s = 0, t = 0;
  const hits = [];
  for (const dt of Array.from({ length: 600 }, (_, i) => [0.016, 0.009, 0.033, 0.021][i % 4])) {
    for (const { f } of crossings(s, s + v * dt, JOINT, 17)) hits.push(t + f * dt);
    s += v * dt; t += dt;
  }
  const gaps = hits.slice(1).map((h, i) => h - hits[i]);
  assert.ok(gaps.length > 3);
  for (const g of gaps) assert.ok(Math.abs(g - JOINT / v) < 1e-9);
});

test('axle offsets run back along the train, mirrored for a reversed car', () => {
  const car = (flip) => ({ flip, entry: { couplers: { f: -80, r: 80 } } });
  const z = () => [-60, -44, 44, 60];
  assert.deepEqual(axleOffsets([car(false), car(true)], z).map((a) => a.d).sort((a, b) => a - b), [20, 36, 124, 140, 180, 196, 284, 300]);
});
