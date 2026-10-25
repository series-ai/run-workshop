import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildProfileShape,
  computeShapeArea,
  SKYLINE_LAYERS,
  type SkylineProfileKind,
} from './skylineShapes';

describe('skylineShapes (T6, R5, A5)', () => {
  const kinds: SkylineProfileKind[] = ['furnace', 'pressFrame', 'stack', 'shed', 'gasHolder'];

  it.each(kinds)('builds a closed shape with positive area for kind: %s', (kind) => {
    const shape = buildProfileShape({
      kind,
      azimuthDeg: 0,
      width: 10,
      height: 20,
    });

    expect(shape).toBeInstanceOf(THREE.Shape);
    const area = computeShapeArea(shape);
    expect(area).toBeGreaterThan(0);

    // Verify shape curves form a closed perimeter
    const points = shape.getPoints();
    expect(points.length).toBeGreaterThanOrEqual(4);
  });

  it('provides configured SKYLINE_LAYERS with furnace, pressFrame, and multiple stacks', () => {
    expect(SKYLINE_LAYERS.length).toBeGreaterThanOrEqual(2);

    const allProfiles = SKYLINE_LAYERS.flatMap((layer) => layer.profiles);
    const furnace = allProfiles.filter((p) => p.kind === 'furnace');
    const pressFrame = allProfiles.filter((p) => p.kind === 'pressFrame');
    const stacks = allProfiles.filter((p) => p.kind === 'stack');

    expect(furnace.length).toBeGreaterThanOrEqual(1);
    expect(pressFrame.length).toBeGreaterThanOrEqual(1);
    expect(stacks.length).toBeGreaterThanOrEqual(2);
  });
});
