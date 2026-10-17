import { describe, expect, it } from 'vitest';
import { BURNT_MATERIAL, SCORCH_MATERIAL, VOXEL_SIZE } from './constants';
import { NEUTRAL_INPUT, TOOL, quantizeRay, type YardInput } from './input';
import { addPhysicsBodies, makePhysicsBody } from './physics';
import { YardSim } from './sim';
import type { YardBody } from './state';
import { patchState, testSim } from './testSim';

const CENTER = [0, 4, 7] as const;
const FIXTURE = 'mobile-torch-wood';

function fixture(shipping = false, depth = 12) {
  const sim = testSim();
  const fields = {
    id: FIXTURE, label: 'Torch test wood', material: 'wood' as const,
    dims: { x: 24, y: 12, z: depth }, voxels: new Uint8Array(24 * 12 * depth).fill(2),
    motion: 'fixed' as const, buoyancy: 0.2, anchorFaces: ['-x'] as const, impactCooldownUntil: 0, heat: null,
  };
  const body: YardBody = shipping ? { ...fields, renderModel: 'shipping-crate', storageBay: 'storage',
    crateFaces: { east: { tone: 'dark' }, south: { tone: 'dark' }, frame: 'dark' } } : fields;
  sim.edit((physics) => addPhysicsBodies(physics, [makePhysicsBody(body, {
    position: CENTER, rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0],
  })]));
  patchState(sim, (state) => ({ ...state, bodies: [...state.bodies, body] }));
  return { sim, source: body };
}

function inputAt(source: YardBody, x: number): YardInput {
  return { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true,
    ...quantizeRay([CENTER[0] + (x - (source.dims.x - 1) / 2) * VOXEL_SIZE,
      CENTER[1], CENTER[2] + source.dims.z * VOXEL_SIZE / 2 + 0.5], [0, 0, -1]) };
}

function pulse(sim: YardSim, source: YardBody, cells: readonly number[]): void {
  for (const x of cells) sim.step([inputAt(source, x)]);
  expect(sim.state.stats.torchCuts).toBeGreaterThan(0);
}

function remaining(sim: YardSim, source: YardBody): YardBody {
  const body = sim.state.bodies.find((entry) => entry.id === source.id);
  expect(body).toBeDefined();
  expect(body!.dims).toEqual(source.dims);
  return body!;
}

function index(body: YardBody, x: number, y: number, z: number): number {
  return x + y * body.dims.x + z * body.dims.x * body.dims.y;
}

function removedCells(source: YardBody, body: YardBody): number[][] {
  const removed: number[][] = [];
  for (let z = 0; z < source.dims.z; z++) for (let y = 0; y < source.dims.y; y++) for (let x = 0; x < source.dims.x; x++) {
    if (source.voxels[index(source, x, y, z)] && !body.voxels[index(body, x, y, z)]) removed.push([x, y, z]);
  }
  return removed;
}

describe('mobile torch surface cuts with real physics', () => {
  it.each([false, true])('keeps a single pulse local on wood, shipping=%s', (shipping) => {
    const { sim, source } = fixture(shipping);
    pulse(sim, source, [3, 3, 3]);
    const body = remaining(sim, source);
    const removed = removedCells(source, body);
    expect(sim.state.stats.torchCuts).toBe(1);
    expect(removed.length).toBeGreaterThan(0);
    // Independent limits: radius 1.25 cells, inset 0.5 cell, depth 1.75 cells.
    for (const [x, y, z] of removed) {
      expect(Math.abs(x! - 3)).toBeLessThanOrEqual(1.25);
      expect(Math.abs(y! - 5.5)).toBeLessThanOrEqual(1.25);
      expect(source.dims.z - 0.5 - z!).toBeLessThanOrEqual(1.75);
    }
    for (let y = 0; y < source.dims.y; y++) for (let x = 0; x < source.dims.x; x++) {
      expect(body.voxels[index(body, x, y, 0)]).toBeGreaterThan(0);
    }
    expect(body.voxels[index(body, 23, 5, 11)]).toBe(2);
  });

  it('keeps pulse depth equal when the body is deeper', () => {
    for (const depth of [12, 24]) {
      const { sim, source } = fixture(false, depth);
      pulse(sim, source, [11.5, 11.5, 11.5]);
      const removed = removedCells(source, remaining(sim, source));
      expect(removed.length).toBeGreaterThan(0);
      expect(removed.every((cell) => depth - 0.5 - cell[2]! <= 1.75)).toBe(true);
      sim.dispose();
    }
  });

  it('joins nearby surface samples without cutting a remote edge', () => {
    const { sim, source } = fixture();
    pulse(sim, source, [10, 11, 12]);
    const body = remaining(sim, source);
    for (const x of [10, 11, 12]) expect(body.voxels[index(body, x, 5, 11)]).toBe(0);
    expect(body.voxels[index(body, 0, 5, 11)]).toBe(2);
    expect(body.voxels[index(body, 23, 5, 11)]).toBe(2);
  });

  it('starts a new local cut after a discontinuous aim jump', () => {
    const { sim, source } = fixture();
    pulse(sim, source, [3, 3, 20]);
    const body = remaining(sim, source);
    expect(body.voxels[index(body, 20, 5, 11)]).toBe(0);
    expect(body.voxels[index(body, 11, 5, 11)]).toBe(2);
    expect(body.voxels[index(body, 3, 5, 11)]).toBe(2);
  });

  it('advances through the body only after repeated burns at the same point', () => {
    const { sim, source } = fixture();
    pulse(sim, source, [11.5, 11.5, 11.5]);
    expect(remaining(sim, source).voxels[index(source, 11, 5, 0)]).toBeGreaterThan(0);
    for (let tick = 0; tick < 33; tick++) sim.step([inputAt(source, 11.5)]);
    expect(remaining(sim, source).voxels[index(source, 11, 5, 0)]).toBe(0);
    expect(sim.state.stats.torchCuts).toBeGreaterThan(1);
  });

  it('keeps wood and heat data valid, then cools without another shape change', () => {
    const { sim, source } = fixture(true);
    pulse(sim, source, [11.5, 11.5, 11.5]);
    const hot = remaining(sim, source);
    expect(hot.material).toBe('wood');
    expect(hot.storageBay).toBe('storage');
    expect(hot.heat?.frame).toBe(sim.state.frame - 1);
    expect([...hot.voxels]).toContain(SCORCH_MATERIAL);
    const shape = hot.voxels.map((value) => value ? 1 : 0);
    for (let tick = 0; tick < 190; tick++) sim.step([NEUTRAL_INPUT]);
    const cold = remaining(sim, source);
    expect(cold.heat).toBeNull();
    expect(cold.voxels.map((value) => value ? 1 : 0)).toEqual(shape);
    expect([...cold.voxels]).not.toContain(SCORCH_MATERIAL);
    expect([...cold.voxels]).toContain(BURNT_MATERIAL);
  });

  it('replays a surface cut exactly from native and byte saves', () => {
    const { sim, source } = fixture(true);
    const start = sim.save();
    const bytes = YardSim.decode(sim.encode(start));
    try {
      pulse(sim, source, [10, 11, 12]);
      for (let tick = 0; tick < 5; tick++) sim.step([NEUTRAL_INPUT]);
      const final = sim.save();
      try {
        const checksum = sim.checksumBytes(final);
        const encoded = sim.encode(final);
        for (const save of [start, bytes]) {
          sim.restore(save);
          pulse(sim, source, [10, 11, 12]);
          for (let tick = 0; tick < 5; tick++) sim.step([NEUTRAL_INPUT]);
          const replay = sim.save();
          try {
            expect(sim.checksumBytes(replay)).toEqual(checksum);
            expect(sim.encode(replay)).toEqual(encoded);
          } finally { sim.release(replay); }
        }
      } finally { sim.release(final); }
    } finally { sim.release(start); sim.release(bytes); }
  });
});
