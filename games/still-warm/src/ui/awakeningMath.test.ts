import { describe, expect, it } from "vitest";
import { calculateEyelidPaths } from "./awakeningMath";

describe("Awakening eyelid math", () => {
  it("covers the full viewport when closed (progress <= 0)", () => {
    const closed = calculateEyelidPaths(0);
    expect(closed.opacity).toBe(1);
    expect(closed.open).toBe(0);
    expect(closed.upper).toContain("L 1100 500 L -100 500 Z");
    expect(closed.lower).toContain("L 1100 500 L -100 500 Z");

    const negative = calculateEyelidPaths(-0.5);
    expect(negative.opacity).toBe(1);
    expect(negative.upper).toBe(closed.upper);
  });

  it("creates a thin horizontal slit during initial crack open (progress < 0.22)", () => {
    const slit = calculateEyelidPaths(0.08);
    expect(slit.opacity).toBe(1);
    expect(slit.open).toBeCloseTo(0.08);

    // Center opening should be a thin slit (within 10 units of center 500)
    // Upper lid curves near y=495, lower lid near y=505
    const upperMatch = slit.upper.match(/Q 500 (\d+) -100 (\d+)/);
    expect(upperMatch).not.toBeNull();
    const [, topY, topEdgeY] = upperMatch!;
    expect(Number(topY)).toBeGreaterThan(490);
    expect(Number(topY)).toBeLessThan(500);

    const lowerMatch = slit.lower.match(/Q 500 (\d+) -100 (\d+)/);
    expect(lowerMatch).not.toBeNull();
    const [, botY, botEdgeY] = lowerMatch!;
    expect(Number(botY)).toBeGreaterThan(500);
    expect(Number(botY)).toBeLessThan(510);

    // Total slit height in center is very thin
    const slitHeight = Number(botY) - Number(topY);
    expect(slitHeight).toBeGreaterThan(0);
    expect(slitHeight).toBeLessThan(20);

    // Edge opening should be even smaller (tapered)
    const edgeGap = Number(botEdgeY) - Number(topEdgeY);
    expect(edgeGap).toBeLessThanOrEqual(slitHeight);
  });

  it("widens significantly when opening up (progress >= 0.5)", () => {
    const half = calculateEyelidPaths(0.5);
    const upperMatch = half.upper.match(/Q 500 (\d+) -100/);
    const lowerMatch = half.lower.match(/Q 500 (\d+) -100/);
    const topY = Number(upperMatch![1]);
    const botY = Number(lowerMatch![1]);

    const openingHeight = botY - topY;
    // Should be open wide (at least 150 units out of 1000)
    expect(openingHeight).toBeGreaterThan(150);
  });

  it("completely clears when fully open (progress >= 1)", () => {
    const open = calculateEyelidPaths(1);
    expect(open.opacity).toBe(0);
    expect(open.open).toBe(1);
    expect(open.upper).toBe("");
    expect(open.lower).toBe("");

    const beyond = calculateEyelidPaths(1.5);
    expect(beyond.opacity).toBe(0);
  });
});
