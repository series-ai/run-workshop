import { expect, it } from "vitest";
import { renderCreatureCall } from "./creatureVoice";

it("makes finite, quiet breath calls with a gap between efforts", () => {
  const rate = 24000;
  const data = renderCreatureCall(rate, 713);
  expect(data.length).toBe(rate * 2.6);
  expect(data.every(Number.isFinite)).toBe(true);
  expect(data.every((sample) => Math.abs(sample) <= 0.16)).toBe(true);
  const energy = (from: number, to: number) => {
    const part = data.slice(from * rate, to * rate);
    return part.reduce((sum, sample) => sum + sample * sample, 0) / part.length;
  };
  expect(energy(0.3, 0.8)).toBeGreaterThan(0.0001);
  expect(energy(1.05, 1.25)).toBeLessThan(0.0000001);
  expect(energy(1.6, 2.2)).toBeGreaterThan(0.0001);
  expect(data).not.toEqual(renderCreatureCall(rate, 714));
});
