import { describe, expect, it } from 'vitest';
import { RAMP_PARTS, type BoxPart } from './rampParts';

const EPSILON = 1e-4;

/**
 * Two boxes z-fight where a face of one lies in the same plane as a face of
 * the other, both face the same way, and the two faces overlap with area.
 */
function coplanarOverlaps(parts: readonly BoxPart[]): string[] {
  const found: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const a = parts[i]!;
      const b = parts[j]!;
      for (let axis = 0; axis < 3; axis += 1) {
        for (const side of [-1, 1]) {
          const planeA = a.center[axis]! + side * a.size[axis]! / 2;
          const planeB = b.center[axis]! + side * b.size[axis]! / 2;
          if (Math.abs(planeA - planeB) > EPSILON) continue;
          const overlaps = [0, 1, 2].filter((other) => other !== axis).every((other) => {
            const lo = Math.max(a.center[other]! - a.size[other]! / 2, b.center[other]! - b.size[other]! / 2);
            const hi = Math.min(a.center[other]! + a.size[other]! / 2, b.center[other]! + b.size[other]! / 2);
            return hi - lo > EPSILON;
          });
          if (overlaps) found.push(`${a.name}/${b.name} axis ${axis} side ${side}`);
        }
      }
    }
  }
  return found;
}

describe('ramp parts', () => {
  it('has no same-facing coplanar faces', () => {
    expect(coplanarOverlaps(RAMP_PARTS)).toEqual([]);
  });

  it('keeps every trim part on the deck', () => {
    const deck = RAMP_PARTS.find((part) => part.name === 'deck')!;
    for (const part of RAMP_PARTS) {
      for (const axis of [0, 2]) {
        expect(Math.abs(part.center[axis]!) + part.size[axis]! / 2, part.name).toBeLessThanOrEqual(deck.size[axis]! / 2);
      }
    }
  });
});
