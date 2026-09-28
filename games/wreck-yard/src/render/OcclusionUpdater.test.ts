import { describe, expect, it } from 'vitest';
import { PoseCache } from './OcclusionUpdater';
import type { YardBody } from '../sim/state';
import type { RenderPose } from './presentation';

describe('PoseCache zero-allocation pose tracking', () => {
  const dummyBody = (id: string): YardBody => ({
    id,
    label: id,
    dims: { x: 2, y: 2, z: 2 },
    voxels: new Uint8Array(8),
    motion: 'dynamic',
    buoyancy: 1.0,
    anchorFaces: [],
    impactCooldownUntil: 0,
  });

  const dummyPose = (px: number, py: number, pz: number): RenderPose => ({
    position: [px, py, pz],
    rotation: [0, 0, 0, 1],
  });

  it('detects changes when body count or ids change', () => {
    const cache = new PoseCache();
    const bodies = [dummyBody('box-1')];
    const poses = new Map<string, RenderPose>([['box-1', dummyPose(0, 0, 0)]]);

    expect(cache.hasChanges(bodies, poses)).toBe(true);
    cache.update(bodies, poses);

    expect(cache.hasChanges(bodies, poses)).toBe(false);

    // Add another body
    const bodies2 = [dummyBody('box-1'), dummyBody('box-2')];
    const poses2 = new Map<string, RenderPose>([
      ['box-1', dummyPose(0, 0, 0)],
      ['box-2', dummyPose(1, 1, 1)],
    ]);
    expect(cache.hasChanges(bodies2, poses2)).toBe(true);
  });

  it('detects positional changes beyond tolerance', () => {
    const cache = new PoseCache();
    const bodies = [dummyBody('box-1')];
    const poses = new Map<string, RenderPose>([['box-1', dummyPose(0, 0, 0)]]);
    cache.update(bodies, poses);

    // Small jitter below tolerance (0.01 < 0.035)
    const jitteredPoses = new Map<string, RenderPose>([['box-1', dummyPose(0.01, 0, 0)]]);
    expect(cache.hasChanges(bodies, jitteredPoses)).toBe(false);

    // Movement above tolerance (0.05 > 0.035)
    const movedPoses = new Map<string, RenderPose>([['box-1', dummyPose(0.05, 0, 0)]]);
    expect(cache.hasChanges(bodies, movedPoses)).toBe(true);
  });

  it('detects rotational changes beyond tolerance', () => {
    const cache = new PoseCache();
    const bodies = [dummyBody('box-1')];
    const poses = new Map<string, RenderPose>([
      ['box-1', { position: [0, 0, 0], rotation: [0, 0, 0, 1] }],
    ]);
    cache.update(bodies, poses);

    // Significant rotation (e.g. 45 degrees around Y)
    const angle = Math.PI / 4;
    const rotatedPoses = new Map<string, RenderPose>([
      ['box-1', { position: [0, 0, 0], rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)] }],
    ]);
    expect(cache.hasChanges(bodies, rotatedPoses)).toBe(true);
  });
  it('rebuilds shadows after a cut on a stationary body', () => {
    const cache = new PoseCache();
    const body = dummyBody('fixed-beam');
    const poses = new Map([['fixed-beam', dummyPose(0, 0, 0)]]);
    cache.update([body], poses);
    const cutBody = { ...body, voxels: body.voxels.slice() };
    expect(cache.hasChanges([cutBody], poses)).toBe(true);
    cache.update([cutBody], poses);
    expect(cache.hasChanges([cutBody], poses)).toBe(false);
  });

  it('keeps pose slots aligned when an earlier body has no pose', () => {
    const cache = new PoseCache();
    const bodies = [dummyBody('missing'), dummyBody('present')];
    const poses = new Map([['present', dummyPose(4, 0, 0)]]);
    cache.update(bodies, poses);
    poses.set('missing', dummyPose(0, 0, 0));
    expect(cache.hasChanges(bodies, poses)).toBe(true);
    cache.update(bodies, poses);
    expect(cache.hasChanges(bodies, poses)).toBe(false);
  });

});
