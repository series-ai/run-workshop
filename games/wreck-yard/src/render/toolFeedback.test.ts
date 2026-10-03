import { describe, expect, it } from 'vitest';
import type { ToolFeedback } from '../sim/state';
import { bezierPoint, effectProgress, FEEDBACK_EFFECT_TICKS, feedbackEffect, isTorchFiring, torchVisual, towardCamera, tractorControlPoint } from './toolFeedback';

describe('tool feedback effects', () => {
  it('pushes objects out with a burst, not a beam, on throw and punt', () => {
    expect(feedbackEffect('throw').kind).toBe('burst');
    expect(feedbackEffect('punt').kind).toBe('burst');
    expect(feedbackEffect('punt').recoil).toBeGreaterThan(feedbackEffect('throw').recoil);
    expect(feedbackEffect('grab').kind).toBe('lock');
  });

  it('keeps the red refusal beam for blocked and missed clicks', () => {
    expect(feedbackEffect('blocked')).toMatchObject({ kind: 'refusal', flash: true });
    expect(feedbackEffect('miss')).toMatchObject({ kind: 'refusal', flash: false });
    expect(feedbackEffect('blocked').color).not.toBe(feedbackEffect('throw').color);
    expect(feedbackEffect('cut').kind).toBe('heat');
  });

  it('plays each one-shot effect over its lifetime', () => {
    expect(effectProgress(0)).toBe(0);
    expect(effectProgress(FEEDBACK_EFFECT_TICKS - 1)).toBeLessThan(1);
    expect(effectProgress(FEEDBACK_EFFECT_TICKS)).toBeNull();
    expect(effectProgress(-1)).toBeNull();
  });

  it('keeps the torch flame lit only while fresh torch feedback arrives', () => {
    const scorch = { result: 'scorch' as const, point: [0, 0, 0] as [number, number, number], frame: 100 };
    expect(isTorchFiring(scorch, 101)).toBe(true);
    expect(isTorchFiring(scorch, 104)).toBe(false);
    expect(isTorchFiring({ ...scorch, result: 'grab' }, 100)).toBe(false);
  });

  it('bends the tractor beam from the aim into a lagging object', () => {
    const muzzle = [0, 0, 0] as const;
    const aim = [0, 0, -1] as const;
    const lagging = [2, 0, -4] as const;
    const control = tractorControlPoint(muzzle, aim, lagging);
    expect(bezierPoint(muzzle, control, lagging, 0)).toEqual([0, 0, 0]);
    expect(bezierPoint(muzzle, control, lagging, 1)).toEqual([2, 0, -4]);
    // The beam leaves along the aim (x stays near 0 early), then curves toward the object.
    expect(Math.abs(bezierPoint(muzzle, control, lagging, 0.1)[0])).toBeLessThan(0.05);
    const onAim = tractorControlPoint(muzzle, aim, [0, 0, -4]);
    expect(bezierPoint(muzzle, onAim, [0, 0, -4], 0.5)[0]).toBeCloseTo(0);
  });

  it('streams fire at what the torch hits in range, fizzles when nothing is in range, and shows nothing when it stops', () => {
    const at = (result: ToolFeedback['result'], frame: number): ToolFeedback => ({ result, frame, point: [0, 0, 0] });
    expect(torchVisual(at('cut', 10), 10)).toBe('stream');
    expect(torchVisual(at('scorch', 10), 11)).toBe('stream');
    expect(torchVisual(at('miss', 10), 10)).toBe('fizzle');
    expect(torchVisual(at('miss', 10), 12)).toBeNull();
    expect(torchVisual(at('grab', 10), 10)).toBeNull();
    expect(torchVisual(null, 10)).toBeNull();
  });

  it('moves a hit glow toward the camera by its radius, but never past half the way', () => {
    expect(towardCamera([0, 0, 0], [0, 0, 10], 0.3)).toEqual([0, 0, 0.3]);
    const near = towardCamera([0, 0, 0], [0, 0.4, 0], 0.3);
    expect(near[1]).toBeCloseTo(0.2);
    expect(towardCamera([1, 2, 3], [1, 2, 3], 0.3)).toEqual([1, 2, 3]);
  });
});

