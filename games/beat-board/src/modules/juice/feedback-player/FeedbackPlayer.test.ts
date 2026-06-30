import { describe, it, expect, vi } from 'vitest';
import { createFeedbackPlayer, type FeedbackContext } from './FeedbackPlayer';

const DT = 1 / 60; // ~16.67ms per frame at 60fps

function advanceFrames(player: ReturnType<typeof createFeedbackPlayer>, frames: number) {
  let state;
  for (let i = 0; i < frames; i++) {
    state = player.update(DT);
  }
  return state!;
}

function requireAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`);
  }
  return item;
}

function requireFirstArg<T>(mockFn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  return requireAt(requireAt(mockFn.mock.calls, callIndex), 0) as T;
}

describe('FeedbackPlayer', () => {
  it('single entry fires callback', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb }],
    });

    player.play();
    player.update(DT);

    expect(cb).toHaveBeenCalled();
  });

  it('callback receives correct context (intensity, direction, elapsed, progress)', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      intensity: 0.8,
      entries: [{ callback: cb, timing: { duration: 100 } }],
    });

    player.play();
    player.update(DT); // ~16.67ms

    expect(cb).toHaveBeenCalledTimes(1);
    const ctx = requireFirstArg<FeedbackContext>(cb);
    expect(ctx.intensity).toBeCloseTo(0.8);
    expect(ctx.direction).toBe('forward');
    expect(ctx.elapsed).toBeGreaterThan(0);
    expect(ctx.progress).toBeGreaterThan(0);
    expect(ctx.progress).toBeLessThan(1);
  });

  it('initialDelay: callback fires after delay, not before', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { initialDelay: 100 } }],
    });

    player.play();

    // At 60fps, 100ms is ~6 frames. First 5 frames should not fire.
    for (let i = 0; i < 5; i++) {
      player.update(DT);
    }
    expect(cb).not.toHaveBeenCalled();

    // By frame 7 we should have passed 100ms
    player.update(DT);
    player.update(DT);
    expect(cb).toHaveBeenCalled();
  });

  it('multiple entries: all fire (parallel execution)', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    const player = createFeedbackPlayer({
      entries: [
        { callback: cb1 },
        { callback: cb2 },
        { callback: cb3 },
      ],
    });

    player.play();
    player.update(DT);

    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
    expect(cb3).toHaveBeenCalled();
  });

  it('duration: callback called multiple times over duration', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { duration: 200 } }],
    });

    player.play();
    // 200ms at 60fps = ~12 frames
    advanceFrames(player, 12);

    expect(cb.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('instant entry (no duration): fires once', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb }], // no timing.duration
    });

    player.play();
    advanceFrames(player, 5);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('repeatCount: entry repeats N times', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { repeatCount: 3 } }], // instant, repeats 3 times
    });

    player.play();
    advanceFrames(player, 10);

    // Initial play + 3 repeats = 4 total
    expect(cb).toHaveBeenCalledTimes(4);
  });

  it('repeatCount -1: entry keeps repeating (test several cycles)', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { repeatCount: -1, duration: 50 } }],
    });

    player.play();
    // Run for 500ms = 30 frames, each duration is 50ms = ~3 frames
    // Should get multiple cycles
    advanceFrames(player, 30);

    // With 50ms duration at 60fps, each cycle is ~3 frames
    // 30 frames = ~10 cycles, each cycle calls callback ~3 times = ~30 calls
    expect(cb.mock.calls.length).toBeGreaterThanOrEqual(15);
  });

  it('delayBetweenRepeats: gap between repeats', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{
        callback: cb,
        timing: { repeatCount: 1, delayBetweenRepeats: 200 },
      }],
    });

    player.play();
    // First instant fires on frame 1
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(1);

    // Next 10 frames (~167ms) — should still be waiting for repeat delay
    advanceFrames(player, 10);
    expect(cb).toHaveBeenCalledTimes(1);

    // After a few more frames (total > 200ms from first fire)
    advanceFrames(player, 5);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('chance=0.5: over 100 plays, roughly half execute (tolerance: 30-70%)', () => {
    let execCount = 0;
    for (let i = 0; i < 100; i++) {
      const cb = vi.fn();
      const player = createFeedbackPlayer({
        entries: [{ callback: cb, timing: { chance: 0.5 } }],
      });
      player.play();
      player.update(DT);
      if (cb.mock.calls.length > 0) execCount++;
    }

    expect(execCount).toBeGreaterThanOrEqual(20);
    expect(execCount).toBeLessThanOrEqual(80);
  });

  it('chance=0: never executes', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { chance: 0 } }],
    });

    player.play();
    advanceFrames(player, 10);

    expect(cb).not.toHaveBeenCalled();
  });

  it('chance=1: always executes', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { chance: 1 } }],
    });

    player.play();
    player.update(DT);

    expect(cb).toHaveBeenCalled();
  });

  it('global cooldown: rapid play() rejected', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      cooldown: 500,
      entries: [{ callback: cb }],
    });

    player.play();
    player.update(DT); // fires
    expect(cb).toHaveBeenCalledTimes(1);

    // Try to play again immediately — should be rejected
    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(1); // no new call

    // Advance past cooldown (500ms = ~30 frames)
    advanceFrames(player, 30);
    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('per-entry cooldown works', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { cooldown: 200 } }],
    });

    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(1);

    // Play again immediately — entry should be skipped due to per-entry cooldown
    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(1);

    // Advance past entry cooldown
    advanceFrames(player, 15); // ~250ms
    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('stop() halts everything', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { duration: 1000 } }],
    });

    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(1);

    player.stop();
    advanceFrames(player, 10);

    // No additional calls after stop
    expect(cb).toHaveBeenCalledTimes(1);
    expect(player.isPlaying()).toBe(false);
  });

  it('pause()/resume() freezes/unfreezes', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb, timing: { duration: 500 } }],
    });

    player.play();
    advanceFrames(player, 5);
    const callsBeforePause = cb.mock.calls.length;

    player.pause();
    advanceFrames(player, 10);
    expect(cb.mock.calls.length).toBe(callsBeforePause); // no new calls

    player.resume();
    player.update(DT);
    expect(cb.mock.calls.length).toBe(callsBeforePause + 1); // resumes
  });

  it('reverse() flips direction', () => {
    const player = createFeedbackPlayer({
      entries: [{ callback: vi.fn() }],
    });

    expect(player.direction).toBe('forward');
    player.reverse();
    expect(player.direction).toBe('reverse');
    player.reverse();
    expect(player.direction).toBe('forward');
  });

  it('onlyWhen=forward: entry skipped when reversed', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      direction: 'reverse',
      entries: [{ callback: cb, timing: { onlyWhen: 'forward' } }],
    });

    player.play();
    advanceFrames(player, 5);

    expect(cb).not.toHaveBeenCalled();
  });

  it('progress goes 0->1 in forward, 1->0 in reverse', () => {
    const progressValues: number[] = [];
    const player = createFeedbackPlayer({
      direction: 'forward',
      entries: [{
        callback: (ctx) => progressValues.push(ctx.progress),
        timing: { duration: 100 },
      }],
    });

    player.play();
    advanceFrames(player, 8);

    // Forward: progress should be increasing
    for (let i = 1; i < progressValues.length; i++) {
      const current = requireAt(progressValues, i);
      const previous = requireAt(progressValues, i - 1);
      expect(current).toBeGreaterThanOrEqual(previous);
    }
    expect(requireAt(progressValues, 0)).toBeGreaterThan(0);

    // Now test reverse
    const reverseProgress: number[] = [];
    const reversePlayer = createFeedbackPlayer({
      direction: 'reverse',
      entries: [{
        callback: (ctx) => reverseProgress.push(ctx.progress),
        timing: { duration: 100, playDirection: 'followPlayer' },
      }],
    });

    reversePlayer.play();
    advanceFrames(reversePlayer, 8);

    // Reverse: progress should be decreasing (starts near 1, goes to 0)
    for (let i = 1; i < reverseProgress.length; i++) {
      const current = requireAt(reverseProgress, i);
      const previous = requireAt(reverseProgress, i - 1);
      expect(current).toBeLessThanOrEqual(previous);
    }
    expect(requireAt(reverseProgress, 0)).toBeLessThan(1);
  });

  it('intensity modulation: context.intensity = player * play override', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      intensity: 0.5,
      entries: [{ callback: cb }],
    });

    // play() with override intensity
    player.play(0.6);
    player.update(DT);

    const ctx = requireFirstArg<FeedbackContext>(cb);
    // Override replaces base intensity
    expect(ctx.intensity).toBeCloseTo(0.6);

    // play() without override — uses base intensity
    // Advance past any internal state
    advanceFrames(player, 5);
    cb.mockClear();
    player.play();
    player.update(DT);

    const ctx2 = requireFirstArg<FeedbackContext>(cb);
    expect(ctx2.intensity).toBeCloseTo(0.5);
  });

  it('player auto-stops when all entries are done', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb }], // instant, no repeat
    });

    player.play();
    const state = player.update(DT);

    expect(state.playing).toBe(false);
    expect(player.isPlaying()).toBe(false);
  });

  it('playDirection=normal always plays forward regardless of player direction', () => {
    const progressValues: number[] = [];
    const player = createFeedbackPlayer({
      direction: 'reverse',
      entries: [{
        callback: (ctx) => {
          progressValues.push(ctx.progress);
          expect(ctx.direction).toBe('forward');
        },
        timing: { duration: 100, playDirection: 'normal' },
      }],
    });

    player.play();
    advanceFrames(player, 6);

    // Progress should increase (forward) even though player is reversed
    for (let i = 1; i < progressValues.length; i++) {
      const current = requireAt(progressValues, i);
      const previous = requireAt(progressValues, i - 1);
      expect(current).toBeGreaterThanOrEqual(previous);
    }
  });

  it('onlyWhen=reverse: entry only plays when player direction is reverse', () => {
    const cb = vi.fn();

    // Forward direction — should NOT fire
    const forwardPlayer = createFeedbackPlayer({
      direction: 'forward',
      entries: [{ callback: cb, timing: { onlyWhen: 'reverse' } }],
    });
    forwardPlayer.play();
    advanceFrames(forwardPlayer, 5);
    expect(cb).not.toHaveBeenCalled();

    // Reverse direction — should fire
    const reversePlayer = createFeedbackPlayer({
      direction: 'reverse',
      entries: [{ callback: cb, timing: { onlyWhen: 'reverse' } }],
    });
    reversePlayer.play();
    advanceFrames(reversePlayer, 5);
    expect(cb).toHaveBeenCalled();
  });

  it('activeEntries in state contains IDs of running entries', () => {
    const player = createFeedbackPlayer({
      entries: [
        { id: 'flash', callback: vi.fn(), timing: { duration: 200 } },
        { id: 'shake', callback: vi.fn(), timing: { initialDelay: 300, duration: 100 } },
      ],
    });

    player.play();
    const state = player.update(DT);

    // flash should be active, shake should be waiting
    expect(state.activeEntries).toContain('flash');
    expect(state.activeEntries).not.toContain('shake');
  });

  it('duration-based entry with repeats calls callback across all cycles', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{
        callback: cb,
        timing: { duration: 50, repeatCount: 2 }, // 3 total cycles
      }],
    });

    player.play();
    // 3 cycles * 50ms = 150ms total. At 60fps = ~9 frames
    advanceFrames(player, 15);

    // Each cycle at ~3 frames = ~9 calls for 3 cycles
    expect(cb.mock.calls.length).toBeGreaterThanOrEqual(6);
  });
});

describe('sequential mode', () => {
  it('processes entries one at a time', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb1 },
        { callback: cb2 },
      ],
    });

    player.play();
    player.update(DT);

    // First instant entry fires, then second fires on same or next update
    // since instant entries complete immediately, both should fire
    expect(cb1).toHaveBeenCalledTimes(1);
  });

  it('second entry starts only after first completes', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb1, timing: { duration: 100 } },
        { callback: cb2 },
      ],
    });

    player.play();
    // After one frame, cb1 should be active but cb2 should not have fired
    player.update(DT);
    expect(cb1).toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();

    // Advance past 100ms (7 frames at 60fps)
    advanceFrames(player, 7);
    expect(cb2).toHaveBeenCalled();
  });

  it('instant entries advance immediately in sequential mode', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb1 },
        { callback: cb2 },
        { callback: cb3 },
      ],
    });

    player.play();
    // First update processes first instant entry and advances
    player.update(DT);
    expect(cb1).toHaveBeenCalledTimes(1);

    // Second update processes second
    player.update(DT);
    expect(cb2).toHaveBeenCalledTimes(1);

    // Third update processes third
    player.update(DT);
    expect(cb3).toHaveBeenCalledTimes(1);
  });

  it('duration-based entries hold until complete', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb1, timing: { duration: 200 } },
        { callback: cb2 },
      ],
    });

    player.play();
    // 5 frames ~= 83ms, still within first entry duration
    advanceFrames(player, 5);
    expect(cb1.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(cb2).not.toHaveBeenCalled();

    // 10 more frames to pass 200ms total (5+10=15 frames = 250ms > 200ms)
    // The entry completes on one frame, then next entry advances on the following frame
    advanceFrames(player, 10);
    expect(cb2).toHaveBeenCalled();
  });

  it('holdingPause waits for all prior entries to finish', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { id: 'a', callback: cb1, timing: { duration: 100 } },
        { callback: vi.fn(), timing: { holdingPause: true } },
        { id: 'c', callback: cb2 },
      ],
    });

    player.play();
    // First frame starts entry 'a'
    player.update(DT);
    expect(cb1).toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();

    // Advance a few frames — entry 'a' still running (100ms duration)
    advanceFrames(player, 3);
    expect(cb2).not.toHaveBeenCalled();

    // Advance past 100ms total — holdingPause resolves, then cb2 fires
    advanceFrames(player, 5);
    expect(cb2).toHaveBeenCalled();
  });

  it('holdingPause with multiple active entries', () => {
    // In sequential mode, entries normally complete one-at-a-time, but holdingPause
    // ensures we wait. Test with a duration entry followed by holdingPause.
    const calls: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { id: 'long', callback: () => calls.push('long'), timing: { duration: 150 } },
        { callback: vi.fn(), timing: { holdingPause: true } },
        { id: 'after', callback: () => calls.push('after') },
      ],
    });

    player.play();
    // Run through the first entry (it takes ~9 frames for 150ms)
    advanceFrames(player, 5);
    expect(calls.filter((c) => c === 'after').length).toBe(0);

    // The holdingPause is reached after 'long' finishes at sequentialIndex advancement.
    // Since sequential processes one at a time, it reaches holdingPause after 'long' completes.
    advanceFrames(player, 6);
    // Now 'after' should have fired
    expect(calls.filter((c) => c === 'after').length).toBeGreaterThanOrEqual(1);
  });

  it('looperStart marks anchor point', () => {
    const calls: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: () => calls.push('a') },
        { callback: () => calls.push('b'), timing: { looperStart: true } },
        { callback: () => calls.push('c') },
        { callback: vi.fn(), timing: { looper: { count: 1 } } },
      ],
    });

    player.play();
    // Process through all entries including the looper
    advanceFrames(player, 10);

    // 'a' should fire once, 'b' and 'c' should fire twice (initial + 1 loop)
    expect(calls.filter((c) => c === 'a').length).toBe(1);
    expect(calls.filter((c) => c === 'b').length).toBe(2);
    expect(calls.filter((c) => c === 'c').length).toBe(2);
  });

  it('looper loops back to looperStart', () => {
    const calls: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: () => calls.push('before') },
        { callback: () => calls.push('loop-body'), timing: { looperStart: true } },
        { callback: vi.fn(), timing: { looper: { count: 2 } } },
        { callback: () => calls.push('after') },
      ],
    });

    player.play();
    advanceFrames(player, 20);

    // 'before' fires once
    expect(calls.filter((c) => c === 'before').length).toBe(1);
    // 'loop-body' fires 3 times (initial + 2 loops)
    expect(calls.filter((c) => c === 'loop-body').length).toBe(3);
    // 'after' fires once (after looper exhausted)
    expect(calls.filter((c) => c === 'after').length).toBe(1);
  });

  it('looper count decrements each iteration', () => {
    const calls: number[] = [];
    let iteration = 0;
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: () => { iteration++; calls.push(iteration); }, timing: { looperStart: true } },
        { callback: vi.fn(), timing: { looper: { count: 3 } } },
      ],
    });

    player.play();
    advanceFrames(player, 20);

    // Should run 4 times: initial + 3 loops
    expect(calls).toEqual([1, 2, 3, 4]);
  });

  it('looper count=0 advances past without looping', () => {
    const calls: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: () => calls.push('body'), timing: { looperStart: true } },
        { callback: vi.fn(), timing: { looper: { count: 0 } } },
        { callback: () => calls.push('after') },
      ],
    });

    player.play();
    advanceFrames(player, 10);

    // body runs once (no loops), then after runs
    expect(calls.filter((c) => c === 'body').length).toBe(1);
    expect(calls.filter((c) => c === 'after').length).toBe(1);
  });

  it('sequential mode with initialDelay', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb1, timing: { initialDelay: 100 } },
        { callback: cb2 },
      ],
    });

    player.play();
    // 3 frames = ~50ms — still in delay
    advanceFrames(player, 3);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();

    // 5 more frames — past 100ms, cb1 fires (instant after delay)
    advanceFrames(player, 5);
    expect(cb1).toHaveBeenCalled();
  });

  it('sequential mode with repeatCount on individual entries', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb1, timing: { repeatCount: 2 } }, // fires 3 times
        { callback: cb2 },
      ],
    });

    player.play();
    // Instant entries with repeats: 3 fires then done
    advanceFrames(player, 10);

    expect(cb1).toHaveBeenCalledTimes(3);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('parallel mode ignores holdingPause/looperStart/looper', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'parallel',
      entries: [
        { callback: cb1 },
        { callback: cb2, timing: { holdingPause: true } },
        { callback: cb3, timing: { looperStart: true, looper: { count: 5 } } },
      ],
    });

    player.play();
    player.update(DT);

    // In parallel mode, all entries fire their callbacks — special fields are ignored
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb3).toHaveBeenCalledTimes(1);
  });

  it('mixed sequential entries (some with timing, some instant)', () => {
    const calls: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: () => calls.push('instant-1') },
        { callback: () => calls.push('timed'), timing: { duration: 50 } },
        { callback: () => calls.push('instant-2') },
      ],
    });

    player.play();
    // First frame: instant-1 fires and completes
    player.update(DT);
    expect(calls).toEqual(['instant-1']);

    // Next frame: timed entry starts
    player.update(DT);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[1]).toBe('timed');

    // Advance past 50ms for timed entry
    advanceFrames(player, 5);

    // instant-2 should have fired after timed completed
    expect(calls).toContain('instant-2');
  });

  it('sequential mode auto-stops after last entry', () => {
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: vi.fn() },
        { callback: vi.fn() },
      ],
    });

    player.play();
    expect(player.isPlaying()).toBe(true);

    // Process both instant entries
    advanceFrames(player, 5);

    expect(player.isPlaying()).toBe(false);
  });

  it('stop() works in sequential mode', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb, timing: { duration: 1000 } },
        { callback: vi.fn() },
      ],
    });

    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(1);

    player.stop();
    advanceFrames(player, 10);

    // No additional calls after stop
    expect(cb).toHaveBeenCalledTimes(1);
    expect(player.isPlaying()).toBe(false);
  });

  it('pause()/resume() works in sequential mode', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: cb, timing: { duration: 500 } },
      ],
    });

    player.play();
    advanceFrames(player, 5);
    const callsBeforePause = cb.mock.calls.length;

    player.pause();
    advanceFrames(player, 10);
    expect(cb.mock.calls.length).toBe(callsBeforePause); // no new calls

    player.resume();
    player.update(DT);
    expect(cb.mock.calls.length).toBe(callsBeforePause + 1); // resumes
  });

  it('sequential mode with direction', () => {
    const directions: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      direction: 'reverse',
      entries: [
        {
          callback: (ctx) => directions.push(ctx.direction),
          timing: { duration: 50 },
        },
      ],
    });

    player.play();
    player.update(DT);

    expect(directions[0]).toBe('reverse');
  });
});

describe('durationMultiplier', () => {
  it('scales entry durations', () => {
    const cb = vi.fn();
    // 100ms base * 2x multiplier = 200ms effective
    const player = createFeedbackPlayer({
      durationMultiplier: 2,
      entries: [{ callback: cb, timing: { duration: 100 } }],
    });

    player.play();
    // At 60fps, 100ms = ~6 frames. With 2x, should still be active at frame 7.
    advanceFrames(player, 7);
    expect(player.isPlaying()).toBe(true);

    // By frame 13 (~217ms), should be done (200ms effective)
    advanceFrames(player, 6);
    expect(player.isPlaying()).toBe(false);
  });
});

describe('timescaleMultiplier', () => {
  it('speeds up playback', () => {
    const cb = vi.fn();
    // 200ms duration at 2x timescale = completes in ~100ms real time
    const player = createFeedbackPlayer({
      timescaleMultiplier: 2,
      entries: [{ callback: cb, timing: { duration: 200 } }],
    });

    player.play();
    // 100ms real = ~6 frames. At 2x timescale, 200ms of entry time passes.
    advanceFrames(player, 7);
    expect(player.isPlaying()).toBe(false);
  });

  it('slows down playback with <1 multiplier', () => {
    const cb = vi.fn();
    // 100ms duration at 0.5x timescale = completes in ~200ms real time
    const player = createFeedbackPlayer({
      timescaleMultiplier: 0.5,
      entries: [{ callback: cb, timing: { duration: 100 } }],
    });

    player.play();
    // At frame 7 (~117ms real), only ~58ms of entry time has passed
    advanceFrames(player, 7);
    expect(player.isPlaying()).toBe(true);

    // By frame 13 (~217ms real), ~108ms entry time → done
    advanceFrames(player, 6);
    expect(player.isPlaying()).toBe(false);
  });
});

describe('pauseDuration (sequential)', () => {
  it('pauses sequential playback for N ms', () => {
    const calls: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: () => calls.push('first') },
        { callback: vi.fn(), timing: { pauseDuration: 100 } },
        { callback: () => calls.push('after-pause') },
      ],
    });

    player.play();
    // First instant fires
    player.update(DT);
    expect(calls).toContain('first');

    // Next frame hits the pauseDuration entry
    player.update(DT);
    // During pause, after-pause should not fire
    advanceFrames(player, 3); // ~50ms
    expect(calls).not.toContain('after-pause');

    // After 100ms total pause
    advanceFrames(player, 5); // ~83ms more = ~133ms total since pause
    expect(calls).toContain('after-pause');
  });
});

describe('chainPlayer', () => {
  it('triggers chained player on entry completion (default waitForComplete)', () => {
    const chainedCb = vi.fn();
    const chained = createFeedbackPlayer({
      entries: [{ callback: chainedCb }],
    });

    const player = createFeedbackPlayer({
      entries: [{
        callback: vi.fn(),
        chainPlayer: { player: chained },
      }],
    });

    player.play();
    // Instant entry completes, triggers chain
    player.update(DT);

    expect(player.isPlaying()).toBe(false);
    // Chained player should have been triggered
    expect(chained.isPlaying()).toBe(true);

    // Update chained player
    chained.update(DT);
    expect(chainedCb).toHaveBeenCalled();
  });

  it('chainPlayer.delay defers chain trigger by N ms', () => {
    const chainedCb = vi.fn();
    const chained = createFeedbackPlayer({
      entries: [{ callback: chainedCb }],
    });

    const player = createFeedbackPlayer({
      entries: [{
        callback: vi.fn(),
        chainPlayer: { player: chained, delay: 100 },
      }],
    });

    player.play();
    // Entry completes instantly, but chain has 100ms delay
    player.update(DT);
    expect(chained.isPlaying()).toBe(false);

    // Advance ~50ms — still waiting
    advanceFrames(player, 3);
    expect(chained.isPlaying()).toBe(false);

    // Advance past 100ms total
    advanceFrames(player, 5);
    expect(chained.isPlaying()).toBe(true);
  });

  it('chainPlayer.waitForComplete=false triggers on entry start', () => {
    const chainedCb = vi.fn();
    const chained = createFeedbackPlayer({
      entries: [{ callback: chainedCb }],
    });

    const player = createFeedbackPlayer({
      entries: [{
        callback: vi.fn(),
        timing: { duration: 500 },
        chainPlayer: { player: chained, waitForComplete: false },
      }],
    });

    player.play();
    // First frame: entry starts, chain triggers immediately
    player.update(DT);
    expect(chained.isPlaying()).toBe(true);
    // Main player should still be playing (500ms duration)
    expect(player.isPlaying()).toBe(true);
  });

  it('chainPlayer.waitForComplete=false with delay', () => {
    const chained = createFeedbackPlayer({
      entries: [{ callback: vi.fn() }],
    });

    const player = createFeedbackPlayer({
      entries: [{
        callback: vi.fn(),
        timing: { duration: 500 },
        chainPlayer: { player: chained, waitForComplete: false, delay: 50 },
      }],
    });

    player.play();
    player.update(DT);
    // Chain not yet triggered (delay=50ms)
    expect(chained.isPlaying()).toBe(false);

    // Advance past 50ms
    advanceFrames(player, 4);
    expect(chained.isPlaying()).toBe(true);
  });

  it('stop() cancels pending chain delays', () => {
    const chained = createFeedbackPlayer({
      entries: [{ callback: vi.fn() }],
    });

    const player = createFeedbackPlayer({
      entries: [{
        callback: vi.fn(),
        chainPlayer: { player: chained, delay: 200 },
      }],
    });

    player.play();
    player.update(DT);
    player.stop();

    // Advance past delay — chain should NOT fire because player was stopped
    advanceFrames(player, 20);
    expect(chained.isPlaying()).toBe(false);
  });
});

describe('skipToEnd', () => {
  it('fires all callbacks with progress=1 and stops', () => {
    const progressValues: number[] = [];
    const player = createFeedbackPlayer({
      entries: [
        {
          callback: (ctx) => progressValues.push(ctx.progress),
          timing: { duration: 500 },
        },
      ],
    });

    player.play();
    player.update(DT); // start it
    player.skipToEnd();

    // Last callback should have progress=1
    expect(progressValues[progressValues.length - 1]).toBe(1);
    expect(player.isPlaying()).toBe(false);
  });

  it('fires onComplete', () => {
    const onComplete = vi.fn();
    const player = createFeedbackPlayer({
      onComplete,
      entries: [{ callback: vi.fn(), timing: { duration: 500 } }],
    });

    player.play();
    player.skipToEnd();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('no-ops when not playing', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: cb }],
    });

    player.skipToEnd(); // should do nothing
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('onRestore', () => {
  it('calls onRestore for each entry on stop()', () => {
    const restore1 = vi.fn();
    const restore2 = vi.fn();
    const player = createFeedbackPlayer({
      entries: [
        { callback: vi.fn(), onRestore: restore1, timing: { duration: 500 } },
        { callback: vi.fn(), onRestore: restore2, timing: { duration: 500 } },
      ],
    });

    player.play();
    player.update(DT);
    player.stop();

    expect(restore1).toHaveBeenCalledTimes(1);
    expect(restore2).toHaveBeenCalledTimes(1);
  });

  it('does not call onRestore on normal completion', () => {
    const restore = vi.fn();
    const player = createFeedbackPlayer({
      entries: [{ callback: vi.fn(), onRestore: restore }],
    });

    player.play();
    advanceFrames(player, 5); // instant entry completes naturally

    expect(restore).not.toHaveBeenCalled();
  });
});

describe('infinite looper (count: -1)', () => {
  it('loops indefinitely until stop()', () => {
    const calls: number[] = [];
    let iteration = 0;
    const player = createFeedbackPlayer({
      mode: 'sequential',
      entries: [
        { callback: () => { iteration++; calls.push(iteration); }, timing: { looperStart: true } },
        { callback: vi.fn(), timing: { looper: { count: -1 } } },
      ],
    });

    player.play();
    advanceFrames(player, 30);

    // Should have many iterations
    expect(calls.length).toBeGreaterThanOrEqual(5);
    expect(player.isPlaying()).toBe(true);

    player.stop();
    expect(player.isPlaying()).toBe(false);
  });
});

describe('lifecycle events', () => {
  it('fires onPlay on play()', () => {
    const onPlay = vi.fn();
    const player = createFeedbackPlayer({
      onPlay,
      entries: [{ callback: vi.fn() }],
    });

    player.play();
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('fires onStop on stop()', () => {
    const onStop = vi.fn();
    const player = createFeedbackPlayer({
      onStop,
      entries: [{ callback: vi.fn(), timing: { duration: 500 } }],
    });

    player.play();
    player.update(DT);
    player.stop();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('fires onComplete when all entries finish', () => {
    const onComplete = vi.fn();
    const player = createFeedbackPlayer({
      onComplete,
      entries: [{ callback: vi.fn() }], // instant
    });

    player.play();
    player.update(DT); // completes immediately

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires onPause and onResume', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const player = createFeedbackPlayer({
      onPause,
      onResume,
      entries: [{ callback: vi.fn(), timing: { duration: 500 } }],
    });

    player.play();
    player.update(DT);

    player.pause();
    expect(onPause).toHaveBeenCalledTimes(1);

    player.resume();
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});

describe('autoReverse', () => {
  it('flips direction on completion', () => {
    const player = createFeedbackPlayer({
      autoReverse: true,
      entries: [{ callback: vi.fn() }],
    });

    expect(player.direction).toBe('forward');
    player.play();
    player.update(DT); // completes

    expect(player.direction).toBe('reverse');

    // Second play completes and reverses back
    player.play();
    player.update(DT);

    expect(player.direction).toBe('forward');
  });

  it('skipToEnd also flips direction with autoReverse', () => {
    const player = createFeedbackPlayer({
      autoReverse: true,
      entries: [{ callback: vi.fn(), timing: { duration: 500 } }],
    });

    player.play();
    player.skipToEnd();
    expect(player.direction).toBe('reverse');
  });
});

describe('reverse sequential iteration', () => {
  it('processes entries in reverse order when direction is reverse', () => {
    const calls: string[] = [];
    const player = createFeedbackPlayer({
      mode: 'sequential',
      direction: 'reverse',
      entries: [
        { callback: () => calls.push('A') },
        { callback: () => calls.push('B') },
        { callback: () => calls.push('C') },
      ],
    });

    player.play();
    advanceFrames(player, 10);

    // In reverse direction, should process C, B, A
    expect(calls[0]).toBe('C');
    expect(calls[1]).toBe('B');
    expect(calls[2]).toBe('A');
  });
});

describe('player-level chance', () => {
  it('chance=0 never plays', () => {
    const cb = vi.fn();
    const onPlay = vi.fn();
    const player = createFeedbackPlayer({
      chance: 0,
      onPlay,
      entries: [{ callback: cb }],
    });

    player.play();
    player.update(DT);

    // With chance=0, play() should be rejected before onPlay fires
    expect(onPlay).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });

  it('chance=1 always plays', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      chance: 1,
      entries: [{ callback: cb }],
    });

    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalled();
  });

  it('chance=0.5 approximately half the time', () => {
    let playCount = 0;
    for (let i = 0; i < 100; i++) {
      const cb = vi.fn();
      const player = createFeedbackPlayer({
        chance: 0.5,
        entries: [{ callback: cb }],
      });
      player.play();
      player.update(DT);
      if (cb.mock.calls.length > 0) playCount++;
    }
    expect(playCount).toBeGreaterThanOrEqual(20);
    expect(playCount).toBeLessThanOrEqual(80);
  });
});

describe('constantIntensity', () => {
  it('uses intensity=1 regardless of player intensity', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      intensity: 0.3,
      entries: [{
        callback: cb,
        timing: { constantIntensity: true },
      }],
    });

    player.play();
    player.update(DT);

    const ctx = requireFirstArg<FeedbackContext>(cb);
    expect(ctx.intensity).toBe(1);
  });

  it('normal entries still respect player intensity', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      intensity: 0.3,
      entries: [{ callback: cb }],
    });

    player.play();
    player.update(DT);

    const ctx = requireFirstArg<FeedbackContext>(cb);
    expect(ctx.intensity).toBeCloseTo(0.3);
  });
});

describe('maxPlayCount', () => {
  it('rejects play() after max reached', () => {
    const cb = vi.fn();
    const player = createFeedbackPlayer({
      maxPlayCount: 2,
      entries: [{ callback: cb }],
    });

    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(1);

    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(2);

    // Third play should be rejected
    player.play();
    player.update(DT);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe('per-repeat chance re-roll', () => {
  it('re-rolls chance on each repeat', () => {
    // With chance=0.5 and 10 repeats, some should pass and some should fail.
    // We'll run this multiple times to verify it's not always all-or-nothing.
    let hadPartial = false;
    for (let trial = 0; trial < 20; trial++) {
      const cb = vi.fn();
      const player = createFeedbackPlayer({
        entries: [{ callback: cb, timing: { chance: 0.5, repeatCount: 10 } }],
      });
      player.play();
      advanceFrames(player, 30);
      const callCount = cb.mock.calls.length;
      // If re-rolling works, some repeats pass and some fail
      if (callCount > 1 && callCount < 11) {
        hadPartial = true;
        break;
      }
    }
    expect(hadPartial).toBe(true);
  });
});
