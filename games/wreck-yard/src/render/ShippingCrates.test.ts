import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCrateSpawns } from '../sim/storage';
import type { CrateFaces, YardBody } from '../sim/state';
import { cellUv, crateSkin, skinnedBox } from './ShippingCrates';

function returnsCrate(): YardBody {
  const [spawn] = createCrateSpawns('returns');
  if (!spawn) throw new Error('TEST_NO_RETURNS_CRATE');
  return spawn.body;
}

function crateWith(crateFaces: CrateFaces): YardBody {
  const body = returnsCrate();
  if (!body.storageBay) throw new Error('TEST_RETURNS_CRATE_HAS_NO_BAY');
  return { ...body, crateFaces };
}

describe('crateSkin', () => {
  it('draws each visible face with its own arrow and the other faces as plain light boards', () => {
    const skin = crateSkin(crateWith({ east: { tone: 'light', arrow: 'left' }, south: { tone: 'light', arrow: 'up' }, frame: 'light' }));
    expect(skin).toEqual({ east: 'light-left', south: 'light-up', rest: 'plain-light', frame: 'light' });
  });

  it('draws a maze wall with plain dark boards on the other faces and a dark frame', () => {
    const skin = crateSkin(crateWith({ east: { tone: 'dark' }, south: { tone: 'light', arrow: 'up' }, frame: 'dark' }));
    expect(skin).toEqual({ east: 'dark', south: 'light-up', rest: 'dark', frame: 'dark' });
  });

  it('uses the frame that the faces carry, which the sim sets to the front art on the front row', () => {
    const skin = crateSkin(crateWith({ east: { tone: 'dark' }, south: { tone: 'light', arrow: 'up' }, frame: 'light' }));
    expect(skin).toEqual({ east: 'dark', south: 'light-up', rest: 'dark', frame: 'light' });
  });

  it('refuses a body that has no faces', () => {
    const bare: YardBody = { ...returnsCrate(), renderModel: undefined, storageBay: undefined, crateFaces: undefined };
    expect(() => crateSkin(bare)).toThrow('WRECK_YARD_CRATE_FACES_MISSING');
  });
});

describe('skinnedBox', () => {
  it('gives the east and south faces their art cells, and every other face the plain tone of the crate', () => {
    const geometry = skinnedBox(new THREE.BoxGeometry(1, 1, 1), { east: 'dark', south: 'light-up', rest: 'dark' });
    const uv = geometry.getAttribute('uv');
    const normal = geometry.getAttribute('normal');
    if (!(uv instanceof THREE.BufferAttribute) || !(normal instanceof THREE.BufferAttribute)) throw new Error('TEST_BOX_ATTRIBUTES');
    const inset = 16 / 512;
    for (let index = 0; index < uv.count; index += 1) {
      const nx = normal.getX(index);
      const nz = normal.getZ(index);
      const cell = nx > 0.5 ? 'dark' : nz > 0.5 ? 'light-up' : 'dark';
      const [start, end] = cellUv(cell);
      // UVs are stored as 32-bit floats, so the edges carry a rounding error of about 1e-8.
      expect(uv.getX(index)).toBeGreaterThanOrEqual(start - 1e-6);
      expect(uv.getX(index)).toBeLessThanOrEqual(end + 1e-6);
      expect(uv.getY(index)).toBeGreaterThanOrEqual(inset);
      expect(uv.getY(index)).toBeLessThanOrEqual(1 - inset);
    }
  });
});
