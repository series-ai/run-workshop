import { describe, expect, it } from 'vitest';
import { computeTankBuoyancyResponse, sampleTankWaveHeight, type WaterTankSpec } from './buoyancy';

const tank: WaterTankSpec = {
  center: [3, 0, 0.5],
  innerSize: [4.3, 1.82, 3.15],
  bottomY: -0.78,
  surfaceY: 0.46,
};

describe('tank buoyancy response', () => {
  it('applies no buoyancy outside the tank footprint', () => {
    const response = computeTankBuoyancyResponse(tank, {
      position: [8, 0, 0.5],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.5, 0.5, 0.5],
      buoyancy: 1,
    });

    expect(response.inside).toBe(false);
    expect(response.submerged).toBe(0);
    expect(response.force).toEqual([0, 0, 0]);
  });

  it('pushes a buoyant body upward while damping linear motion', () => {
    const response = computeTankBuoyancyResponse(tank, {
      position: [3.1, -0.1, 0.55],
      linearVelocity: [1.5, -0.4, -0.9],
      angularVelocity: [0.4, 0.2, -0.3],
      halfExtents: [0.56, 0.32, 0.56],
      buoyancy: 1,
    });

    expect(response.inside).toBe(true);
    expect(response.submerged).toBeGreaterThan(0.2);
    expect(response.force[1]).toBeGreaterThan(0);
    expect(response.force[0]).toBeLessThan(0);
    expect(response.force[2]).toBeGreaterThan(0);
    expect(response.torque[0]).not.toBe(0);
    expect(response.angularDamping[0]).toBeGreaterThan(0);
    expect(response.angularDamping[2]).toBeGreaterThan(0);
  });

  it('targets a lower float height for a dense body than for a buoyant one', () => {
    const heavy = computeTankBuoyancyResponse(tank, {
      position: [3, -0.35, 0.5],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.48, 0.48, 0.48],
      buoyancy: 0.08,
    });

    const light = computeTankBuoyancyResponse(tank, {
      position: [3, -0.35, 0.5],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.48, 0.48, 0.48],
      buoyancy: 0.9,
    });

    expect(light.targetY).toBeGreaterThan(heavy.targetY);
    expect(Math.abs(heavy.force[1] - light.force[1])).toBeLessThan(1e-6);
  });

  it('samples a wave height that varies across the tank surface', () => {
    const center = sampleTankWaveHeight(tank, [tank.center[0], tank.center[2]], 0.3);
    const edge = sampleTankWaveHeight(tank, [tank.center[0] + 1.2, tank.center[2] - 0.8], 0.3);

    expect(edge).not.toBe(center);
  });

  it('keeps applying buoyancy when a body overlaps the tank edge even if its center is outside', () => {
    const response = computeTankBuoyancyResponse(tank, {
      position: [tank.center[0] + tank.innerSize[0] * 0.5 + 0.1, -0.12, tank.center[2]],
      linearVelocity: [0.3, -0.2, 0],
      angularVelocity: [0, 0, 0.15],
      halfExtents: [0.32, 0.28, 0.32],
      buoyancy: 0.9,
    });

    expect(response.inside).toBe(true);
    expect(response.submerged).toBeGreaterThan(0);
    expect(response.force[1]).toBeGreaterThan(0);
  });

  it('does not treat a partial edge overlap as fully submerged', () => {
    const mass = 0.25;
    const response = computeTankBuoyancyResponse(tank, {
      position: [tank.center[0] + tank.innerSize[0] * 0.5 + 0.1, -0.12, tank.center[2]],
      linearVelocity: [0, -0.2, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.32, 0.28, 0.32],
      buoyancy: 0.9,
      mass,
      gravity: 13.5,
    });

    expect(response.submerged).toBeLessThan(0.5);
    expect(response.force[1]).toBeLessThan(mass * 13.5);
  });

  it('does not count volume below the tank floor as displaced water', () => {
    const response = computeTankBuoyancyResponse(tank, {
      position: [tank.center[0], tank.bottomY - 0.2, tank.center[2]],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.32, 0.28, 0.32],
      buoyancy: 0.9,
      mass: 0.25,
      gravity: 13.5,
    });

    expect(response.submerged).toBeLessThan(0.2);
  });

  it('uses the animated local wave height when computing float target', () => {
    const left = computeTankBuoyancyResponse(tank, {
      position: [tank.center[0] - 1.1, -0.18, tank.center[2] + 0.6],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.36, 0.28, 0.36],
      buoyancy: 0.8,
      time: 0.42,
    });
    const right = computeTankBuoyancyResponse(tank, {
      position: [tank.center[0] + 1.1, -0.18, tank.center[2] - 0.7],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.36, 0.28, 0.36],
      buoyancy: 0.8,
      time: 0.42,
    });

    expect(left.surfaceY).not.toBe(right.surfaceY);
    expect(left.targetY).not.toBe(right.targetY);
  });
});
