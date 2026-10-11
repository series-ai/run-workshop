import { describe, expect, it } from 'vitest';
import {
  cameraImpulse,
  createCameraObstacles,
  cameraOnActorSide,
  computeCameraLookAhead,
  computeCameraKineticHeight,
  computeTraumaImpulse,
} from '../src/render/cameraKinetics.js';
import { SectorDepotSimulation, computeGroundAimAngle } from '../src/sim/game.js';

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

  describe("computeCameraLookAhead", () => {
    it("shifts offset in weapon aim direction based on facing angle", () => {
      // Facing South (facing = 0): sin(0)=0, cos(0)=1 -> +Z
      const south = computeCameraLookAhead(0, { x: 0, z: 0 }, { aimLeadDistance: 2.0 });
      expect(Math.abs(south.offsetX)).toBeLessThan(1e-5);
      expect(south.offsetZ).toBeCloseTo(2.0, 4);

      // Facing North (facing = Math.PI): sin(PI)=0, cos(PI)=-1 -> -Z
      const north = computeCameraLookAhead(Math.PI, { x: 0, z: 0 }, { aimLeadDistance: 2.0 });
      expect(Math.abs(north.offsetX)).toBeLessThan(1e-5);
      expect(north.offsetZ).toBeCloseTo(-2.0, 4);

      // Facing East (facing = Math.PI / 2): sin(PI/2)=1, cos(PI/2)=0 -> +X
      const east = computeCameraLookAhead(Math.PI / 2, { x: 0, z: 0 }, { aimLeadDistance: 2.0 });
      expect(east.offsetX).toBeCloseTo(2.0, 4);
      expect(Math.abs(east.offsetZ)).toBeLessThan(1e-5);
    });

    it("applies velocity lead when movement exceeds deadzone threshold", () => {
      const moving = computeCameraLookAhead(0, { x: 5, z: 0 }, {
        aimLeadDistance: 0,
        velocityLeadFactor: 0.3,
        deadZone: 0.4,
      });
      expect(moving.offsetX).toBeCloseTo(1.5, 4);
      expect(moving.offsetZ).toBe(0);

      // Below dead zone
      const stationary = computeCameraLookAhead(0, { x: 0.2, z: 0 }, {
        aimLeadDistance: 0,
        velocityLeadFactor: 0.3,
        deadZone: 0.4,
      });
      expect(stationary.offsetX).toBe(0);
      expect(stationary.offsetZ).toBe(0);
    });

    it("clamps look-ahead to configured maxOffset ceiling", () => {
      const clamped = computeCameraLookAhead(Math.PI / 2, { x: 20, z: 0 }, {
        aimLeadDistance: 5.0,
        velocityLeadFactor: 0.5,
        maxOffset: 4.0,
      });
      const totalDist = Math.hypot(clamped.offsetX, clamped.offsetZ);
      expect(totalDist).toBeCloseTo(4.0, 4);
    });
  });

  describe("computeCameraKineticHeight", () => {
    it("lowers vantage height during slide maneuver", () => {
      const base = 16.0;
      const sliding = computeCameraKineticHeight(base, { isSliding: true });
      expect(sliding).toBeLessThan(base);
      expect(sliding).toBeCloseTo(14.2, 4);
    });

    it("expands vantage height during sprint", () => {
      const base = 16.0;
      const sprinting = computeCameraKineticHeight(base, { isSprinting: true });
      expect(sprinting).toBeGreaterThan(base);
      expect(sprinting).toBeCloseTo(17.2, 4);
    });

    it("tightens height during tactical ADS focus", () => {
      const base = 16.0;
      const ads = computeCameraKineticHeight(base, { isAds: true });
      expect(ads).toBeLessThan(base);
      expect(ads).toBeCloseTo(14.5, 4);
    });
  });

  describe("computeTraumaImpulse", () => {
    it("returns zero displacement when elapsed exceeds duration", () => {
      expect(computeTraumaImpulse(90, 20, 0.4, 0.35)).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("generates directional flinch away from damage source angle", () => {
      // Hit from East (90 deg): impulse should push West (-X)
      const impulse = computeTraumaImpulse(90, 25, 0.05, 0.35);
      expect(impulse.x).toBeLessThan(0);
      expect(Math.abs(impulse.y)).toBeGreaterThan(0);
    });
  });
  describe("computeGroundAimAngle & Camera Tracking", () => {
    it("computes accurate directional angles for Cardinal screen directions", () => {
      const width = 1920;
      const height = 1080;
      const camParam = {
        cameraPos: { x: 0, y: 16, z: 6.46 },
        targetPos: { x: 0, y: 1, z: 0 },
        playerPos: { x: 0, y: 0, z: 0 },
      };

      // Cursor right (East): x > width / 2, y = height / 2 -> positive X (+pi/2)
      const eastAngle = computeGroundAimAngle(width * 0.85, height / 2, width, height, 46, camParam);
      expect(eastAngle).toBeCloseTo(Math.PI / 2, 1);

      // Cursor left (West): x < width / 2, y = height / 2 -> negative X (-pi/2)
      const westAngle = computeGroundAimAngle(width * 0.15, height / 2, width, height, 46, camParam);
      expect(westAngle).toBeCloseTo(-Math.PI / 2, 1);

      // Cursor bottom (South): x = width / 2, y > height / 2 -> positive Z (near 0)
      const southAngle = computeGroundAimAngle(width / 2, height * 0.95, width, height, 46, camParam);
      expect(Math.abs(southAngle)).toBeLessThan(0.4);

      // Cursor top (North): x = width / 2, y < height / 2 -> negative Z (near +/- pi)
      const northAngle = computeGroundAimAngle(width / 2, height * 0.05, width, height, 46, camParam);
      expect(Math.abs(Math.abs(northAngle) - Math.PI)).toBeLessThan(0.4);
    });

    it("simulation initializes cameraPos, cameraTarget, and cameraFov on construction", () => {
      const sim = new SectorDepotSimulation("test_raid", "spoke");
      expect(sim.cameraPos).toBeDefined();
      expect(sim.cameraTarget).toBeDefined();
      expect(sim.cameraFov).toBe(46.0);
      expect(sim.cameraPos?.y).toBe(16.0);
      expect(sim.cameraTarget?.y).toBe(1.0);
    });

    it("tracks aim angle consistently as camera shifts with look-ahead", () => {
      const width = 1920;
      const height = 1080;

      // Base camera vantage
      const baseCam = {
        cameraPos: { x: 0, y: 16, z: 6.46 },
        targetPos: { x: 0, y: 1, z: 0 },
        playerPos: { x: 0, y: 0, z: 0 },
      };
      const angle1 = computeGroundAimAngle(width * 0.75, height * 0.5, width, height, 46, baseCam);

      // Camera shifted forward by look-ahead
      const shiftedCam = {
        cameraPos: { x: 2, y: 16, z: 6.46 },
        targetPos: { x: 2, y: 1, z: 0 },
        playerPos: { x: 0, y: 0, z: 0 },
      };
      const angle2 = computeGroundAimAngle(width * 0.75, height * 0.5, width, height, 46, shiftedCam);

      // Both should resolve to positive X (East / rightward aim)
      expect(angle1).toBeGreaterThan(0);
      expect(angle2).toBeGreaterThan(0);
    });
  });
});