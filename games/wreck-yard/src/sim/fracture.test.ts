import { describe, expect, it } from 'vitest';
import { makeEmptyVoxelField, stampBox } from 'voxel-kit';
import { fractureBody, type FractureContact } from './fracture';
import { TORCH_RADIUS } from './constants';
import { IDENTITY_QUAT } from './math';
import type { YardBody } from './state';

function bar(motion: 'dynamic' | 'fixed'): YardBody {
  // 30 long, 12 deep in y and z: thick enough that a cut must span a real
  // cross-section, which is the case the torch has to handle.
  const dims = { x: 30, y: 12, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 29, y: 11, z: 11 }, 3);
  return { id: 'bar', label: 'Bar', dims, voxels, motion, buoyancy: 0.1, anchorFaces: motion === 'fixed' ? ['-x'] : [], impactCooldownUntil: 0 };
}

const pose = { position: [0, 1, 0] as const, rotation: IDENTITY_QUAT, linearVelocity: [0.01, 0, 0] as const, angularVelocity: [0, 0, 0] as const };

function cutThrough(x: number): FractureContact {
  // A torch stroke that severs the bar across its length: the visible stroke
  // down the front face, plus the same stroke carried out the far side.
  return {
    start: [x, 13, 10.65],
    end: [x, -2, 10.65],
    through: [x, 13, -3],
    throughEnd: [x, -2, -3],
    radius: 2.15,
    worldPoint: [0, 1, 0],
    impulseBoost: 0,
  };
}

describe('fractureBody', () => {
  it('splits a fixed bar and keeps the anchored piece fixed under the parent id', () => {
    const result = fractureBody(bar('fixed'), pose, cutThrough(15), 7);
    expect(result.fragments).toHaveLength(2);
    const anchored = result.fragments.find((f) => f.body.motion === 'fixed');
    const loose = result.fragments.find((f) => f.body.motion === 'dynamic');
    expect(anchored?.body.id).toBe('bar');
    expect(anchored?.body.anchorFaces).toEqual(['-x']);
    expect(loose?.body.id).toBe('bar-p7');
    expect(loose?.physics.body.kind).toBe('dynamic');
    expect(result.nextSerial).toBe(8);
  });

  it('splits a dynamic bar into two dynamic pieces that inherit velocity', () => {
    const result = fractureBody(bar('dynamic'), pose, cutThrough(15), 0);
    expect(result.fragments).toHaveLength(2);
    for (const fragment of result.fragments) {
      expect(fragment.body.motion).toBe('dynamic');
      expect(fragment.physics.body.linearVelocity?.x).toBeCloseTo(0.3, 6);
    }
  });

  it('detaches a severed fixed piece instead of freezing it under the parent id', () => {
    // Cut the body just in front of its anchor face, so nothing anchored
    // survives. The remaining piece must become dynamic under a new id rather
    // than keep 'bar' frozen to an anchor it is no longer attached to.
    const removedAnchor = fractureBody(bar('fixed'), pose, cutThrough(1.5), 42);
    expect(removedAnchor.fragments.length).toBeGreaterThan(0);
    for (const fragment of removedAnchor.fragments) {
      expect(fragment.body.anchorFaces).toEqual([]);
    }
    expect(removedAnchor.fragments.some((f) => f.body.motion === 'dynamic')).toBe(true);
    expect(removedAnchor.nextSerial).toBeGreaterThan(42);
  });

  it('scatters fragments when an impulse boost is given', () => {
    const result = fractureBody(bar('dynamic'), pose, { ...cutThrough(15), impulseBoost: 2 }, 0);
    const speeds = result.fragments.map((fragment) => {
      const velocity = fragment.physics.body.linearVelocity!;
      return Math.abs(velocity.x) + Math.abs(velocity.y) + Math.abs(velocity.z);
    });
    expect(Math.max(...speeds)).toBeGreaterThan(0.3);
  });

  it('returns no fragments when the cut removes everything', () => {
    const tiny: YardBody = { ...bar('dynamic'), dims: { x: 3, y: 3, z: 3 }, voxels: new Uint8Array(27).fill(2) };
    const result = fractureBody(tiny, pose, {
      start: [1, 1, 1], end: [1, 1, 1], through: [1, 1, 1], throughEnd: [1, 1, 1], radius: 5, worldPoint: [0, 1, 0], impulseBoost: 0,
    }, 0);
    expect(result.fragments).toEqual([]);
  });

  it('separates a body on either axis, not just the one the stroke happens to cross', () => {
    // The same body cut vertically and horizontally at its midpoint must come
    // apart both ways. A surface gouge alone left the halves joined behind the
    // cut, which is what made vertical and horizontal strokes behave differently.
    const slab = bar('dynamic');
    const zIn = 12 - 1 - 1.35;
    const vertical: FractureContact = {
      start: [15, 13, zIn], end: [15, -2, zIn], through: [15, 13, -3], throughEnd: [15, -2, -3],
      radius: TORCH_RADIUS, worldPoint: [0, 1, 0], impulseBoost: 0,
    };
    const horizontal: FractureContact = {
      start: [-1, 6, zIn], end: [31, 6, zIn], through: [-1, 6, -3], throughEnd: [31, 6, -3],
      radius: TORCH_RADIUS, worldPoint: [0, 1, 0], impulseBoost: 0,
    };
    expect(fractureBody(slab, pose, vertical, 0).fragments.length).toBeGreaterThan(1);
    expect(fractureBody(slab, pose, horizontal, 0).fragments.length).toBeGreaterThan(1);
  });

  it('does not separate a body when the stroke is only a surface gouge', () => {
    // The same stroke without the through cut stays a groove: this is the
    // behaviour the fix replaces, and pinning it down keeps the through cut
    // from silently regressing to a no-op.
    const gouge: FractureContact = {
      start: [15, 13, 10.65], end: [15, -2, 10.65], through: [15, 13, 10.65], throughEnd: [15, -2, 10.65],
      radius: TORCH_RADIUS, worldPoint: [0, 1, 0], impulseBoost: 0,
    };
    expect(fractureBody(bar('dynamic'), pose, gouge, 0).fragments).toHaveLength(1);
  });

  it('leaves a thin cut and preserves the majority of the body volume', () => {
    const original = bar('dynamic');
    const result = fractureBody(original, pose, cutThrough(15), 0);
    expect(result.fragments).toHaveLength(2);
    let survivingVoxels = 0;
    for (const frag of result.fragments) {
      for (let i = 0; i < frag.body.voxels.length; i += 1) {
        if (frag.body.voxels[i] !== 0) survivingVoxels += 1;
      }
    }
    const originalVoxels = 30 * 12 * 12; // 4320
    expect(survivingVoxels).toBeGreaterThan(originalVoxels * 0.8);
  });

  it('splits an anchored bar horizontally and yields exactly one fixed piece and dynamic piece', () => {
    const fixedBar = bar('fixed');
    const zIn = 12 - 1 - 1.35;
    const horizontalCut: FractureContact = {
      start: [-1, 6, zIn], end: [31, 6, zIn], through: [-1, 6, -3], throughEnd: [31, 6, -3],
      radius: TORCH_RADIUS, worldPoint: [0, 1, 0], impulseBoost: 0,
    };
    const result = fractureBody(fixedBar, pose, horizontalCut, 10);
    expect(result.fragments).toHaveLength(2);
    const fixedFragments = result.fragments.filter((f) => f.body.motion === 'fixed');
    const dynamicFragments = result.fragments.filter((f) => f.body.motion === 'dynamic');
    expect(fixedFragments).toHaveLength(1);
    expect(fixedFragments[0]!.body.id).toBe('bar');
    expect(dynamicFragments).toHaveLength(1);
    expect(dynamicFragments[0]!.body.id).toBe('bar-p10');
    expect(dynamicFragments[0]!.physics.body.kind).toBe('dynamic');
  });
});
