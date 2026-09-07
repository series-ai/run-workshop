import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { CORPSE_HOME, CORPSE_SPEED, CorpseMotion } from "./corpseMotion";

describe("corpse floor movement", () => {
  it("does not rise, crouch, or travel for bedside tools and surgery", () => {
    const motion = new CorpseMotion();
    for (const target of [
      new Vector3(-0.72, -0.02, -0.25),
      new Vector3(0, -0.1, 0.28),
      new Vector3(0, 0.8, 0.28),
    ]) {
      motion.approach(target);
      for (let i = 0; i < 100; i++) expect(motion.step(0.016)).toBe(false);
      expect(motion.position.toArray()).toEqual([...CORPSE_HOME]);
    }
  });

  it("walks around the foot of the bed at a bounded speed and stays there", () => {
    const motion = new CorpseMotion();
    motion.approach(new Vector3(1.35, 0.4, 2.35));
    for (let i = 0; i < 1200; i++) {
      const before = motion.position.clone();
      motion.step(0.016);
      expect(motion.position.y).toBe(CORPSE_HOME[1]);
      expect(motion.position.distanceTo(before)).toBeLessThanOrEqual(
        CORPSE_SPEED * 0.016 + 1e-10,
      );
      if (before.x < 0 && motion.position.x >= 0)
        expect(motion.position.z).toBeGreaterThanOrEqual(1.65);
    }
    expect(
      motion.position.distanceTo(new Vector3(1.35, -0.9, 1.85)),
    ).toBeLessThan(0.0001);
    const settled = motion.position.clone();
    for (let i = 0; i < 200; i++) motion.step(0.016);
    expect(motion.position.equals(settled)).toBe(true);
  });

  it("does not jump after pause or an invalid time delta", () => {
    const motion = new CorpseMotion();
    motion.approach(new Vector3(1.35, 0.4, 2.35));
    const before = motion.position.clone();
    motion.step(0);
    motion.step(NaN);
    expect(motion.position.equals(before)).toBe(true);
    motion.step(30);
    expect(motion.position.distanceTo(before)).toBeLessThanOrEqual(
      CORPSE_SPEED * 0.1 + 1e-10,
    );
  });
});
