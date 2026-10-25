import { describe, expect, it } from 'vitest';
import type { YardBody } from '../sim/state';
import { bodyGeometryChanged, wrapYaw } from './inputPresentation';

const body: YardBody = { id: 'test', label: 'Test', material: 'concrete', dims: { x: 1, y: 1, z: 1 }, voxels: new Uint8Array([1]), motion: 'dynamic', buoyancy: 0, anchorFaces: [], impactCooldownUntil: 0, heat: null };

describe('presentation input', () => {
  it('keeps aim consistent after multiple full turns', () => {
    for (const angle of [-27, -7, 0, 8, 40]) {
      expect(Math.abs(wrapYaw(angle))).toBeLessThanOrEqual(Math.PI);
      expect(Math.sin(wrapYaw(angle))).toBeCloseTo(Math.sin(angle));
      expect(Math.cos(wrapYaw(angle))).toBeCloseTo(Math.cos(angle));
    }
  });

  it('refreshes a surface cut with unchanged body ID and count', () => {
    expect(bodyGeometryChanged([body], [{ ...body, voxels: new Uint8Array([0]) }])).toBe(true);
    expect(bodyGeometryChanged([body], [{ ...body }])).toBe(false);
    expect(bodyGeometryChanged([body], [])).toBe(true);
    expect(bodyGeometryChanged(null, [body])).toBe(true);
  });
});
