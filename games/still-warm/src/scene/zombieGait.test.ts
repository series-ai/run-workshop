import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { ZombieGait } from "./zombieGait";

describe("planted zombie steps", () => {
  it("moves only the swing foot and keeps the other foot fixed in world space", () => {
    const left = new Vector3(-0.15, 0, 0),
      right = new Vector3(0.15, 0, 0);
    const gait = new ZombieGait(left, right, 0);
    const ideal: [Vector3, Vector3] = [left.clone(), right.clone()];
    let swings = 0;
    for (let i = 0; i < 360; i++) {
      ideal.forEach((p) => (p.z += 0.28 / 60));
      const before = gait.feet.map((f) => f.position.clone());
      gait.update(ideal, 0, new Vector3(0, 0, 0.28), 1 / 60);
      const changes = gait.feet.map((f, j) => f.position.distanceTo(before[j]));
      expect(changes.filter((v) => v > 1e-8).length).toBeLessThanOrEqual(1);
      gait.feet.forEach((f) =>
        expect(f.position.y).toBeGreaterThanOrEqual(-1e-8),
      );
      if (gait.activeFoot !== null) swings++;
    }
    expect(swings).toBeGreaterThan(200);
    expect(gait.feet[0].position.z).toBeGreaterThan(1);
    expect(gait.feet[1].position.z).toBeGreaterThan(1);
  });
  it("does not drift at rest or advance on pause and invalid deltas", () => {
    const points: [Vector3, Vector3] = [
      new Vector3(-0.15, 0, 0),
      new Vector3(0.15, 0, 0),
    ];
    const gait = new ZombieGait(...points, 0);
    for (let i = 0; i < 100; i++) gait.update(points, 0, new Vector3(), 1 / 60);
    expect(gait.activeFoot).toBeNull();
    const moved: [Vector3, Vector3] = points.map((p) =>
      p.clone().add(new Vector3(0, 0, 0.4)),
    ) as [Vector3, Vector3];
    gait.update(moved, 1, new Vector3(), 0);
    gait.update(moved, 1, new Vector3(), NaN);
    gait.feet.forEach((f, i) =>
      expect(f.position.equals(points[i])).toBe(true),
    );
  });
});
