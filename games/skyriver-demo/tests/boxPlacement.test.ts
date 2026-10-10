import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { warpBoxPoint, warpRigid } from '../src/render/city';
import { warpCanyon } from '../src/render/canyonWarp';

describe('box yaw placement', () => {
  it.each([
    { x: 630, z: -960, anchorV: -1280, yawRad: 0.2 },
    { x: -630, z: 640, anchorV: 960, yawRad: -0.15 },
    { x: 670, z: -920, anchorV: -960, yawRad: 0.1, yawAnchor: { x: 650, z: -940 } },
  ])('matches the independent matrix transform for %j', box => {
    const canyon = warpCanyon(0, box.anchorV, { x: 0, z: 0, heading: 0 });
    const pivot = box.yawAnchor ?? box;
    const matrix = new Matrix4().makeTranslation(canyon.x, 0, canyon.z)
      .multiply(new Matrix4().makeRotationY(canyon.heading))
      .multiply(new Matrix4().makeTranslation(0, 0, -box.anchorV))
      .multiply(new Matrix4().makeTranslation(pivot.x, 0, pivot.z))
      .multiply(new Matrix4().makeRotationY(box.yawRad))
      .multiply(new Matrix4().makeTranslation(-pivot.x, 0, -pivot.z));
    for (const [dx, dz] of [[0, 0], [-50, -25], [50, -25], [50, 25], [-50, 25]]) {
      const x = box.x + dx!, z = box.z + dz!;
      const expected = new Vector3(x, 0, z).applyMatrix4(matrix);
      const actual = warpBoxPoint(box, x, z, { x: 0, z: 0, heading: 0 });
      expect(actual.x).toBeCloseTo(expected.x, 10);
      expect(actual.z).toBeCloseTo(expected.z, 10);
      expect(actual.heading).toBeCloseTo(canyon.heading + box.yawRad, 12);
    }
  });

  it('keeps the zero-yaw canyon transform exact', () => {
    const box = { x: 630, z: -960, anchorV: -1280 };
    expect(warpBoxPoint(box, 655, -975, { x: 0, z: 0, heading: 0 }))
      .toEqual(warpRigid(655, -975, box.anchorV, { x: 0, z: 0, heading: 0 }));
  });
});
