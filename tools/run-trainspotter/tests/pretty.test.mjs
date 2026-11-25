// node --test tests/pretty.test.mjs: the time-of-day keyframes behave
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, QUALITY, mixPreset } from '../viewer/pretty.js';

test('every preset is reached exactly at its own time', () => {
  for (const p of Object.values(PRESETS)) {
    const m = mixPreset(p.t);
    assert.ok(Math.abs(m.elev - p.elev) < 1e-9 && Math.abs(m.sunI - p.sunI) < 1e-9);
  }
});

test('lamps and windows only light up toward dusk, and the sun swings the short way round', () => {
  assert.equal(mixPreset(0.25).windows, 0);
  assert.ok(mixPreset(0.9).windows > mixPreset(0.6).windows);
  for (let t = 0; t <= 1; t += 0.05) {
    const a = mixPreset(t).azim;
    assert.ok(a >= 100 && a <= 320, `azimuth ${a} at ${t}`);
  }
});

test('lower quality drops the expensive passes', () => {
  assert.equal(QUALITY.Low.ao, false);
  assert.equal(QUALITY.Low.shadows, 0);
  assert.ok(QUALITY.High.dust > QUALITY.Low.dust);
});
