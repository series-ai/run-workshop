import { expect, it } from "vitest";
import { renderCreatureCall } from "./creatureVoice";
import { VOCAL_CUES } from "../game/model";

it("makes finite, quiet breath calls with a gap between efforts", () => {
  const rate = 24000;
  const data = renderCreatureCall(rate, "fear", 713);
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
  expect(data).not.toEqual(renderCreatureCall(rate, "fear", 714));
});

it.each(VOCAL_CUES)(
  "keeps the %s call quiet, finite, and repeatable",
  (cue) => {
    const data = renderCreatureCall(24000, cue, 713);
    expect(data.every(Number.isFinite)).toBe(true);
    expect(data.every((sample) => Math.abs(sample) <= 0.16)).toBe(true);
    expect(Math.abs(data[0])).toBe(0);
    expect(Math.abs(data[data.length - 1])).toBe(0);
    expect(data).toEqual(renderCreatureCall(24000, cue, 713));
  },
);

it("gives pain a short call and anger one sustained effort", () => {
  const rate = 24000;
  const pain = renderCreatureCall(rate, "pain", 713);
  const anger = renderCreatureCall(rate, "anger", 713);
  const relief = renderCreatureCall(rate, "relief", 713);
  expect(pain.length).toBeLessThan(anger.length);
  expect(pain.length).toBeLessThan(relief.length);
  const middle = anger.slice(rate, rate * 1.2);
  expect(middle.some((sample) => Math.abs(sample) > 0.01)).toBe(true);
});
