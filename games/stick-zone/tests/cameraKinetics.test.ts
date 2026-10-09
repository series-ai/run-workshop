import { describe, expect, it } from 'vitest';
import {
  cameraImpulse,
  createCameraObstacles,
  cameraOnActorSide,
} from '../src/render/cameraKinetics.js';

describe('cameraKinetics', () => {
  describe('cameraImpulse', () => {
    it('returns zero impulse for negative age or age exceeding 200ms', () => {
      expect(cameraImpulse(-0.1, 1.0)).toEqual([0, 0]);
      expect(cameraImpulse(0.2, 1.0)).toEqual([0, 0]);
      expect(cameraImpulse(0.35, 1.0)).toEqual([0, 0]);
    });

    it('generates damped recoil impulses that decay over time', () => {
      const [earlyX, earlyY] = cameraImpulse(0.02, 1.0);
      const [lateX, lateY] = cameraImpulse(0.18, 1.0);

      expect(Math.abs(earlyX) + Math.abs(earlyY)).toBeGreaterThan(0);
      expect(Math.hypot(earlyX, earlyY)).toBeGreaterThan(Math.hypot(lateX, lateY));
    });
  });

  describe('createCameraObstacles', () => {
    it('adapts container bounds to standard 5.2m stacked container height', () => {
      const obstacles = createCameraObstacles([
        { minX: -10, maxX: -5, minZ: 0, maxZ: 10 },
      ]);
      expect(obstacles.length).toBe(1);
      expect(obstacles[0].minY).toBe(0);
      expect(obstacles[0].maxY).toBe(5.2);
      expect(obstacles[0].minX).toBe(-10);
      expect(obstacles[0].maxX).toBe(-5);
    });
  });

  describe('cameraOnActorSide', () => {
    const testObstacles = [
      { minX: -5, maxX: 5, minY: 0, maxY: 5.2, minZ: -5, maxZ: 5 },
    ];

    it('returns unadjusted desired position when line of sight is clear', () => {
      const actor = { x: 10, y: 0, z: 10 };
      const desired = { x: 10, y: 16, z: 16 };

      const result = cameraOnActorSide(actor, desired, testObstacles);
      expect(result.adjusted).toBe(false);
      expect(result.obstacleIndex).toBeNull();
      expect(result.x).toBe(desired.x);
      expect(result.y).toBe(desired.y);
      expect(result.z).toBe(desired.z);
    });

    it('clamps camera distance when an obstacle occludes line of sight', () => {
      // Actor is behind container wall, camera is positioned across the container
      const actor = { x: 0, y: 0, z: -6.5 };
      const desired = { x: 0, y: 2, z: 10.0 };

      const result = cameraOnActorSide(actor, desired, testObstacles);
      expect(result.adjusted).toBe(true);
      expect(result.obstacleIndex).toBe(0);

      // Camera must be clamped on the actor side (z < -5.0)
      expect(result.z).toBeLessThan(-5.0);
      expect(result.z).toBeGreaterThanOrEqual(actor.z);
    });
  });
});
