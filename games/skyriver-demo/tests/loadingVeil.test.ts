/**
 * @file loadingVeil.test.ts — the startup loading veil reports real boot phases.
 *
 * The veil replaced a single static "Loading city..." line. Its value rests on two promises: every
 * stage names work this build really performs at that boundary, and the step/elapsed readouts stay
 * truthful. This test pins the stage identity and order plus the formatter edges. The DOM rendering
 * is exercised in the browser probes, where a real document exists.
 */
import { describe, expect, it } from 'vitest';

import {
  SKYRIVER_LOADING_STAGE,
  SKYRIVER_LOADING_STAGES,
  formatLoadingElapsed,
  formatLoadingStep,
} from '../src/ui/loadingVeil';

describe('startup loading veil stages', () => {
  it('describes the boot as ordered, distinct phases', () => {
    expect(SKYRIVER_LOADING_STAGES.length).toBeGreaterThanOrEqual(3);
    const labels = SKYRIVER_LOADING_STAGES.map((stage) => stage.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every phase a descriptive label and a detail of what that work is', () => {
    for (const stage of SKYRIVER_LOADING_STAGES) {
      expect(stage.label.length).toBeGreaterThanOrEqual(12);
      expect(stage.label.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
      expect(stage.detail.length).toBeGreaterThanOrEqual(24);
      // R8: no "Megacity" in user-facing strings.
      expect(`${stage.label} ${stage.detail}`.toLowerCase()).not.toContain('megacity');
    }
  });

  it('names each phase by position, so no call site depends on a bare number', () => {
    expect(SKYRIVER_LOADING_STAGE.verifyingSnapshot).toBe(0);
    expect(SKYRIVER_LOADING_STAGE.raisingSkyline).toBe(1);
    expect(SKYRIVER_LOADING_STAGE.warmingFirstFrame).toBe(2);
    expect(SKYRIVER_LOADING_STAGE.raisingSkyline).toBeLessThan(SKYRIVER_LOADING_STAGES.length);
    expect(SKYRIVER_LOADING_STAGE.warmingFirstFrame).toBe(SKYRIVER_LOADING_STAGES.length - 1);
  });

  it('counts steps in one-based terms and clamps an out-of-range index', () => {
    expect(formatLoadingStep(0)).toBe(`Step 1 of ${SKYRIVER_LOADING_STAGES.length}`);
    expect(formatLoadingStep(1)).toBe(`Step 2 of ${SKYRIVER_LOADING_STAGES.length}`);
    expect(formatLoadingStep(99)).toBe(`Step ${SKYRIVER_LOADING_STAGES.length} of ${SKYRIVER_LOADING_STAGES.length}`);
    expect(formatLoadingStep(-4)).toBe('Step 1 of 3');
    expect(formatLoadingStep(Number.NaN)).toBe('Step 1 of 3');
  });

  it('reports elapsed wall time in seconds and minutes, and never invents progress', () => {
    expect(formatLoadingElapsed(0)).toBe('0.0s');
    expect(formatLoadingElapsed(400)).toBe('0.4s');
    expect(formatLoadingElapsed(12500)).toBe('12.5s');
    expect(formatLoadingElapsed(59000)).toBe('59.0s');
    expect(formatLoadingElapsed(65000)).toBe('1m 5s');
    expect(formatLoadingElapsed(Number.NaN)).toBe('0.0s');
    expect(formatLoadingElapsed(-1200)).toBe('0.0s');
  });
});
