// node --test tests/trainfx.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chuffsBetween, chuffInterval } from '../viewer/train-fx.js';

test('four exhaust beats per driver turn, however the distance is split into frames', () => {
  const r = 12;
  const turn = 2 * Math.PI * r;
  assert.equal(chuffsBetween(0, turn, r), 4);
  assert.equal(chuffsBetween(0, 3 * turn, r), 12);
  // the same distance in many small frames gives the same count
  let n = 0;
  let prev = 0;
  for (let k = 1; k <= 1000; k++) {
    const d = (3 * turn * k) / 1000;
    n += chuffsBetween(prev, d, r);
    prev = d;
  }
  assert.equal(n, 12);
  assert.equal(chuffsBetween(5, 5, r), 0);
});

test('beat interval shortens with speed and is infinite at a stand', () => {
  assert.equal(chuffInterval(0, 12), Infinity);
  const slow = chuffInterval(30, 12);
  const fast = chuffInterval(120, 12);
  assert.ok(Math.abs(slow / fast - 4) < 1e-9);
  assert.ok(Math.abs(chuffInterval(75.398, 12) - (2 * Math.PI * 12) / 4 / 75.398) < 1e-12);
});
