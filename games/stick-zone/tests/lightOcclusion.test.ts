import { describe, it, expect } from "vitest";
import {
  rayAABBIntersection,
  computeVisibilityPolygon,
  normalizeAngle,
  type ObstacleAABB,
} from "../src/render/lightOcclusion.js";

describe("Dynamic Light Occlusion", () => {
  const testBox: ObstacleAABB = {
    minX: -2.0,
    maxX: 2.0,
    minZ: 6.0,
    maxZ: 12.0,
  };

  it("calculates accurate ray-AABB intersection distance", () => {
    // Forward ray towards box
    const distHit = rayAABBIntersection(0, 0, 0, 1, testBox, 30);
    expect(distHit).toBeCloseTo(6.0, 3);

    // Ray aiming backwards away from box
    const distMiss = rayAABBIntersection(0, 0, 0, -1, testBox, 30);
    expect(distMiss).toBe(30);

    // Ray passing to the left of the box
    const distLeft = rayAABBIntersection(0, 0, -1, 0, testBox, 30);
    expect(distLeft).toBe(30);
  });

  it("normalizes angles across PI boundaries", () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI * 2)).toBeCloseTo(0);
    expect(Math.abs(normalizeAngle(Math.PI))).toBeCloseTo(Math.PI);
    expect(Math.abs(normalizeAngle(-Math.PI * 3))).toBeCloseTo(Math.PI);
  });

  it("generates a closed occluded visibility polygon with shadow edges", () => {
    const ox = 0;
    const oz = 0;
    const facing = 0; // facing +Z
    const obstacles: ObstacleAABB[] = [testBox];

    const result = computeVisibilityPolygon(ox, oz, facing, obstacles, {
      maxRange: 20.0,
      halfAngle: 0.5,
      baseRayCount: 32,
    });

    expect(result.vertexCount).toBeGreaterThan(30);
    expect(result.triangleCount).toBe(result.vertexCount - 2);
    expect(result.positions.length).toBe(result.vertexCount * 3);
    expect(result.colors.length).toBe(result.vertexCount * 4);
    expect(result.indices.length).toBe(result.triangleCount * 3);

    // Origin vertex must match player position
    expect(result.positions[0]).toBe(ox);
    expect(result.positions[1]).toBeCloseTo(0.03, 3);
    expect(result.positions[2]).toBe(oz);

    // Check that at least one ray stopped at the container (Z ~= 6.0)
    let foundContainerHit = false;
    for (let i = 1; i < result.vertexCount; i++) {
      const z = result.positions[i * 3 + 2];
      if (Math.abs(z - 6.0) < 0.2) {
        foundContainerHit = true;
        break;
      }
    }
    expect(foundContainerHit).toBe(true);

    // Check that step discontinuity shadow edge lines were detected around the box corners
    expect(result.edgeLineCount).toBeGreaterThanOrEqual(1);
    expect(result.edgeLines.length).toBe(result.edgeLineCount * 6);
  });

  it("handles empty obstacle list gracefully", () => {
    const result = computeVisibilityPolygon(10, 10, Math.PI / 4, [], {
      maxRange: 15.0,
      halfAngle: 0.4,
      baseRayCount: 16,
    });

    expect(result.vertexCount).toBe(18); // 17 rays + origin
    expect(result.triangleCount).toBe(16);
    expect(result.edgeLineCount).toBe(0); // No obstacles -> no shadow steps
  });
});
