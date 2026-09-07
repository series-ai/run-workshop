import { describe, expect, it } from "vitest";
import {
  planSafeRoute,
  segmentCrossesPatient,
  selectContactStance,
} from "./staging";

const CANDIDATE_YAWS = [2.1, Math.PI / 2, 2.5, Math.PI, -Math.PI / 2, 0];

describe("assistant contact staging", () => {
  it("keeps exact horizontal hand contact and a safe stance", () => {
    const target = { x: 0.15, z: 0.08 };
    const palm = { x: -0.130445, z: 0.620265 };
    const stance = selectContactStance({
      target,
      palm,
      scale: 0.9,
      start: { x: -0.72, z: 0.48 },
      home: { x: -0.72, z: 0.48 },
      preferredYaw: 2.1,
      candidateYaws: CANDIDATE_YAWS,
    });
    const cosine = Math.cos(stance.yaw);
    const sine = Math.sin(stance.yaw);
    expect(
      stance.position.x + 0.9 * (palm.x * cosine + palm.z * sine),
    ).toBeCloseTo(target.x, 10);
    expect(
      stance.position.z + 0.9 * (-palm.x * sine + palm.z * cosine),
    ).toBeCloseTo(target.z, 10);
    expect(
      Math.abs(stance.position.x) >= 0.48 || stance.position.z >= 1.25,
    ).toBe(true);
  });

  it("routes around the patient when the direct path crosses the body", () => {
    const stance = selectContactStance({
      target: { x: 1.35, z: 2.35 },
      palm: { x: -0.13, z: 0.62 },
      scale: 0.9,
      start: { x: -0.72, z: 0.48 },
      home: { x: -0.72, z: 0.48 },
      preferredYaw: 2.1,
      candidateYaws: CANDIDATE_YAWS,
    });
    const route = [
      { x: -0.72, z: 0.48 },
      ...stance.waypoints,
      stance.position,
    ];
    expect(stance.waypoints.length).toBeGreaterThan(0);
    for (let index = 1; index < route.length; index++) {
      expect(segmentCrossesPatient(route[index - 1], route[index])).toBe(false);
    }
  });

  it.each([
    ["head", { x: 0, z: -0.7 }, { x: 0.7, z: 0.4 }],
    ["foot", { x: 0, z: 1.4 }, { x: -0.7, z: 0.4 }],
    ["left", { x: -0.7, z: 0.4 }, { x: 0.7, z: 0.4 }],
  ])("keeps every %s route segment outside the patient", (_, start, end) => {
    const route = [start, ...planSafeRoute(start, end), end];
    expect(route.length).toBeGreaterThan(2);
    for (let index = 1; index < route.length; index++) {
      expect(segmentCrossesPatient(route[index - 1], route[index])).toBe(false);
    }
  });

  it("uses a direct route when the actor stays on one side", () => {
    const stance = selectContactStance({
      target: { x: -0.285382, z: -0.164478 },
      palm: { x: -0.142599, z: 0.601718 },
      scale: 0.9,
      start: { x: -0.72, z: 0.48 },
      home: { x: -0.72, z: 0.48 },
      preferredYaw: 2.1,
      candidateYaws: CANDIDATE_YAWS,
    });
    expect(stance.waypoints).toEqual([]);
    expect(segmentCrossesPatient({ x: -0.72, z: 0.48 }, stance.position)).toBe(
      false,
    );
  });

  it.each([
    ["wound", { x: 0, z: 0.08 }, { x: -0.130445, z: 0.620265 }],
    ["door", { x: 1.35, z: 2.35 }, { x: -0.130445, z: 0.620265 }],
  ])("returns safely from the %s contact stance", (_, target, palm) => {
    const home = { x: -0.72, z: 0.48 };
    const stance = selectContactStance({
      target,
      palm,
      scale: 0.9,
      start: home,
      home,
      preferredYaw: 2.1,
      candidateYaws: CANDIDATE_YAWS,
    });
    const route = [
      stance.position,
      ...planSafeRoute(stance.position, home),
      home,
    ];
    for (let index = 1; index < route.length; index++) {
      expect(segmentCrossesPatient(route[index - 1], route[index])).toBe(false);
    }
  });

  it("routes from a tray pickup to blanket contact inside the room", () => {
    const home = { x: -0.72, z: 0.48 };
    const pickup = selectContactStance({
      target: { x: -0.63, z: -0.01 },
      palm: { x: -0.337, z: 0.417931 },
      scale: 0.9,
      start: home,
      home,
      preferredYaw: 2.1,
      candidateYaws: CANDIDATE_YAWS,
    });
    const blanket = selectContactStance({
      target: { x: 0.32, z: -0.44 },
      palm: { x: -0.130445, z: 0.620265 },
      scale: 0.9,
      start: pickup.position,
      home,
      preferredYaw: 2.1,
      candidateYaws: CANDIDATE_YAWS,
    });
    const route = [pickup.position, ...blanket.waypoints, blanket.position];
    expect(blanket.waypoints.length).toBeGreaterThan(0);
    expect(blanket.waypoints.every((point) => point.z >= -0.72)).toBe(true);
    for (let index = 1; index < route.length; index++) {
      expect(segmentCrossesPatient(route[index - 1], route[index])).toBe(false);
    }
  });
});
