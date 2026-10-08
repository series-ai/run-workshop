import { describe, expect, it } from 'vitest';

import { SKYRIVER_EMISSIVE_GAIN } from '../src/render/atmosphere';
import { SKYRIVER_INTERIOR_FADE } from '../src/render/city';
import {
  SKYRIVER_INTERIOR_AVERAGE_GAIN,
  SKYRIVER_INTERIOR_DARKROOM_SPILL,
  SKYRIVER_INTERIOR_DIM_SHARE,
  SKYRIVER_INTERIOR_SCREEN_BLUE_FLOOR,
  SKYRIVER_INTERIOR_SCREEN_RGB,
  SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE,
  SKYRIVER_INTERIOR_SHEEN_GAIN,
  interiorAverageScreenInput,
  interiorDepthWeight,
  interiorPaneScreenInput,
  interiorScreenBlueEnergy,
  interiorScreenSource,
  interiorScreenMean,
  interiorScreenScale,
  interiorScreenTraceBlend,
} from '../src/render/interiorResponse';

describe('city interior response', () => {
  it('uses the approved view-depth bands', () => {
    expect(SKYRIVER_INTERIOR_FADE.full).toEqual([300, 900]);
    expect(SKYRIVER_INTERIOR_FADE.near).toEqual([120, 600]);
  });

  it('keeps the full and near fades continuous and monotone at both ends', () => {
    for (const [start, end] of [SKYRIVER_INTERIOR_FADE.full, SKYRIVER_INTERIOR_FADE.near]) {
      expect(interiorDepthWeight(start, start, end)).toBe(1);
      expect(interiorDepthWeight(end, start, end)).toBe(0);
      expect(interiorDepthWeight(start - 0.01, start, end)).toBe(1);
      expect(interiorDepthWeight(end + 0.01, start, end)).toBe(0);
      expect(interiorDepthWeight(start + 0.01, start, end)).toBeCloseTo(1, 8);
      expect(interiorDepthWeight(end - 0.01, start, end)).toBeCloseTo(0, 8);
      expect(interiorDepthWeight((start + end) / 2, start, end)).toBeLessThan(0.5);

      let previous = 1;
      for (let depth = start; depth <= end; depth += 10) {
        const weight = interiorDepthWeight(depth, start, end);
        expect(weight).toBeLessThanOrEqual(previous);
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
        previous = weight;
      }
    }
  });

  it('keeps fractional fade powers finite near the far limit at float precision', () => {
    const f = Math.fround;
    for (const [start, end] of [SKYRIVER_INTERIOR_FADE.full, SKYRIVER_INTERIOR_FADE.near]) {
      for (const delta of [0, 0.00001, 0.001, 0.01, 0.1, 0.5, 1]) {
        const depth = end - delta;
        const weight = interiorDepthWeight(depth, start, end);
        expect(Number.isFinite(weight)).toBe(true);
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
        const t = f(f(depth - start) / f(end - start));
        const smoother = f(f(f(t * t) * t) * f(f(t * f(f(t * 6) - 15)) + 10));
        const shaderWeight = Math.pow(Math.min(1, Math.max(0, f(1 - smoother))), 1.5);
        expect(Number.isFinite(shaderWeight)).toBe(true);
        expect(shaderWeight).toBeGreaterThanOrEqual(0);
        expect(shaderWeight).toBeLessThanOrEqual(1);
      }
    }
  });

  it('matches screen blue energy across pane and average paths', () => {
    const far = interiorScreenBlueEnergy(0, 1, 1, 1);
    const near = interiorScreenBlueEnergy(1, 1, 1, 1);
    expect(far).toBe(SKYRIVER_INTERIOR_SCREEN_BLUE_FLOOR);
    expect(near / far).toBeCloseTo(SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE, 12);
    expect(interiorScreenScale(0)).toBe(1);
    expect(interiorScreenScale(1)).toBeCloseTo(SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE, 12);
    expect(interiorScreenBlueEnergy(0, 1, 1, 0)).toBe(0);
    expect(interiorScreenBlueEnergy(0, 0, 1, 1)).toBe(0);
    expect(interiorScreenBlueEnergy(0, 1, 0, 1)).toBe(0);

    const paneOutput = interiorPaneScreenInput(far, SKYRIVER_EMISSIVE_GAIN) * SKYRIVER_EMISSIVE_GAIN;
    const averageOutput = interiorAverageScreenInput(far) * SKYRIVER_INTERIOR_AVERAGE_GAIN;
    expect(paneOutput).toBeCloseTo(far, 12);
    expect(averageOutput).toBeCloseTo(far, 12);
    expect(paneOutput).toBeCloseTo(averageOutput, 12);
  });

  it('scales the original screen source to one third near and blends from the pane mean', () => {
    const farSource = interiorScreenSource(0, 0);
    const nearSource = interiorScreenSource(1, 0);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(farSource[channel]).toBeCloseTo(SKYRIVER_INTERIOR_SCREEN_RGB[channel]! * 0.5, 12);
      expect(nearSource[channel] / farSource[channel]!).toBeCloseTo(1 / 3, 12);
    }

    const paneMean = interiorScreenMean(interiorPaneScreenInput(SKYRIVER_INTERIOR_SCREEN_BLUE_FLOOR, SKYRIVER_EMISSIVE_GAIN));
    expect(interiorScreenTraceBlend(0, paneMean, nearSource)).toEqual(paneMean);
    expect(interiorScreenTraceBlend(1, paneMean, nearSource)).toEqual(nearSource);
    const middle = interiorScreenTraceBlend(0.5, paneMean, nearSource);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(middle[channel]).toBeCloseTo((paneMean[channel]! + nearSource[channel]!) / 2, 12);
    }
  });

  it('keeps dim-room shares low and in range', () => {
    expect(SKYRIVER_INTERIOR_DIM_SHARE).toEqual({ mid: 0.3, grime: 0.36, pristine: 0.18 });
    for (const share of Object.values(SKYRIVER_INTERIOR_DIM_SHARE)) {
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...SKYRIVER_INTERIOR_DARKROOM_SPILL)).toBeLessThanOrEqual(0.16);
    expect(SKYRIVER_INTERIOR_SHEEN_GAIN).toBeLessThan(0.16);
  });
});
