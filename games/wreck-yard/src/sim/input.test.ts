import { describe, expect, it } from 'vitest';
import { decodeRay, decodeYardInput, encodeYardInput, NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';

describe('yard input codec', () => {
  it('round trips a full input', () => {
    const input: YardInput = {
      tool: TOOL.torch,
      pressed: true,
      secondary: false,
      jetpack: true,
      moveX: 1,
      moveZ: -1,
      yaw: 1570,
      pitch: -350,
      ox: -1234,
      oy: 2500,
      oz: 99,
      dx: 7071,
      dy: -7071,
      dz: 0,
    };
    expect(decodeYardInput(encodeYardInput(input))).toEqual(input);
  });

  it('decodes canonical null to the neutral input', () => {
    expect(decodeYardInput(null)).toEqual(NEUTRAL_INPUT);
    expect(NEUTRAL_INPUT.tool).toBe(TOOL.none);
    expect(NEUTRAL_INPUT.pressed).toBe(false);
  });

  it('quantizes and decodes a ray with a unit direction', () => {
    const q = quantizeRay([1.23456, -0.5, 8.9], [0.3, -0.4, 0.866]);
    const ray = decodeRay({ ...NEUTRAL_INPUT, ...q });
    expect(ray).not.toBeNull();
    expect(ray!.origin[0]).toBeCloseTo(1.235, 3);
    const [dx, dy, dz] = ray!.direction;
    expect(Math.sqrt(dx * dx + dy * dy + dz * dz)).toBeCloseTo(1, 6);
  });

  it('returns null for a zero direction', () => {
    expect(decodeRay(NEUTRAL_INPUT)).toBeNull();
  });
});
