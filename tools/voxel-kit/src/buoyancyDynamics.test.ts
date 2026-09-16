import { describe, expect, it } from 'vitest';
import { computeTankBuoyancyResponse, type WaterTankSpec } from './buoyancy';

const tank: WaterTankSpec = {
  center: [3, 0, 0.5],
  innerSize: [4.3, 1.82, 3.15],
  bottomY: -0.78,
  surfaceY: 0.46,
  waveAmplitude: 0,
  secondaryWaveAmplitude: 0,
};

function simulateVerticalMotion({
  startY,
  startVy = 0,
  buoyancy,
  mass,
  halfExtents = [0.56, 0.32, 0.56] as [number, number, number],
  x = tank.center[0],
  z = tank.center[2],
  steps = 240,
  dt = 1 / 60,
}: {
  startY: number;
  startVy?: number;
  buoyancy: number;
  mass: number;
  halfExtents?: [number, number, number];
  x?: number;
  z?: number;
  steps?: number;
  dt?: number;
}) {
  let y = startY;
  let vy = startVy;
  const heights: number[] = [];
  const submergedFractions: number[] = [];

  for (let step = 0; step < steps; step += 1) {
    const response = computeTankBuoyancyResponse(tank, {
      position: [x, y, z],
      linearVelocity: [0, vy, 0],
      angularVelocity: [0, 0, 0],
      halfExtents,
      buoyancy,
      mass,
      gravity: 13.5,
      time: step * dt,
    });
    heights.push(response.targetY);
    submergedFractions.push(response.submerged);

    const accelerationY = (response.force[1] / mass) - 13.5;
    vy += accelerationY * dt;
    y += vy * dt;
    heights.push(y);
  }

  return {
    heights: heights.filter((_, index) => index % 2 === 1),
    targets: heights.filter((_, index) => index % 2 === 0),
    submergedFractions,
  };
}

describe('buoyancy dynamics', () => {
  it('settles a buoyant body without sustained springy oscillation', () => {
    const { heights, targets } = simulateVerticalMotion({
      startY: 0.02,
      buoyancy: 1,
      mass: 0.82,
    });

    const tail = heights.slice(-60);
    const tailSpan = Math.max(...tail) - Math.min(...tail);
    const peakHeight = Math.max(...heights);
    const equilibriumHeight = targets.at(-1)!;

    expect(tailSpan).toBeLessThan(0.09);
    expect(peakHeight - equilibriumHeight).toBeLessThan(0.1);
    expect(tail.at(-1)).toBeGreaterThan(tank.bottomY + 0.2);
  });

  it('keeps the float crate mostly in the water instead of riding high above the surface', () => {
    const { heights, submergedFractions } = simulateVerticalMotion({
      startY: 0.04,
      buoyancy: 1,
      mass: 0.29,
      steps: 360,
    });

    const settledHeight = heights.at(-1)!;
    const peakHeight = Math.max(...heights);
    const settledSubmerged = submergedFractions.at(-1)!;

    expect(settledHeight).toBeLessThan(tank.surfaceY + 0.1);
    expect(peakHeight).toBeLessThan(tank.surfaceY + 0.16);
    expect(settledSubmerged).toBeGreaterThan(0.35);
  });

  it('keeps gravity dominant when a body first clips the water at the tank edge', () => {
    const mass = 0.25;
    const response = computeTankBuoyancyResponse(tank, {
      position: [tank.center[0] + tank.innerSize[0] * 0.5 + 0.1, 0.72, tank.center[2]],
      linearVelocity: [0, -1.2, 0],
      angularVelocity: [0, 0, 0],
      halfExtents: [0.32, 0.28, 0.32],
      buoyancy: 0.9,
      mass,
      gravity: 13.5,
    });

    const netAccelerationY = (response.force[1] / mass) - 13.5;

    expect(response.submerged).toBeLessThan(0.05);
    expect(netAccelerationY).toBeLessThan(0);
  });

  it('does not fling a light fragment far above the waterline after entry', () => {
    const { heights } = simulateVerticalMotion({
      startY: 0.08,
      startVy: -2.1,
      buoyancy: 1,
      mass: 0.012,
      halfExtents: [0.16, 0.16, 0.16],
      steps: 480,
    });

    const peakHeight = Math.max(...heights);
    const settledHeight = heights.at(-1)!;

    expect(peakHeight).toBeLessThan(tank.surfaceY + 0.22);
    expect(settledHeight).toBeLessThan(tank.surfaceY + 0.12);
  });

  it('does not rocket a buoyant fragment upward when it grazes the water near a tank wall', () => {
    const { heights } = simulateVerticalMotion({
      startY: 0.1,
      startVy: -1.8,
      buoyancy: 1,
      mass: 0.012,
      halfExtents: [0.16, 0.16, 0.16],
      x: tank.center[0] + tank.innerSize[0] * 0.5 - 0.12,
      steps: 480,
    });

    expect(Math.max(...heights)).toBeLessThan(tank.surfaceY + 0.18);
  });
});
