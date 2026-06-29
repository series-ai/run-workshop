import { describe, it, expect } from 'vitest';
import { createBeatSequencer } from './BeatSequencer';

describe('createBeatSequencer', () => {
  it('initializes inactive with beat=0, bar=0, tick=0', () => {
    const seq = createBeatSequencer({ bpm: 120 });
    expect(seq.isActive()).toBe(false);

    const state = seq.update(0);
    expect(state.beat).toBe(0);
    expect(state.bar).toBe(0);
    expect(state.tick).toBe(0);
    expect(state.phase).toBe(0);
    expect(state.active).toBe(false);
  });

  it('start() activates, stop() deactivates', () => {
    const seq = createBeatSequencer({ bpm: 120 });

    seq.start();
    expect(seq.isActive()).toBe(true);

    const stateA = seq.update(0);
    expect(stateA.active).toBe(true);

    seq.stop();
    expect(seq.isActive()).toBe(false);

    const stateB = seq.update(0);
    expect(stateB.active).toBe(false);
  });

  it('beats increment at correct BPM rate', () => {
    // 120 BPM, subdivision=1 → tickDuration = 60/120 = 0.5s per beat
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    seq.start();

    // After 0.5s → tick=1, beat=1
    const s1 = seq.update(0.5);
    expect(s1.tick).toBe(1);
    expect(s1.beat).toBe(1);
    expect(s1.bar).toBe(0);

    // After another 0.5s → tick=2, beat=2
    const s2 = seq.update(0.5);
    expect(s2.tick).toBe(2);
    expect(s2.beat).toBe(2);
    expect(s2.bar).toBe(0);
  });

  it('bar increments when beat count reaches beatsPerBar', () => {
    // 120 BPM, 4 beats per bar, subdivision=1 → bar changes every 4 * 0.5s = 2s
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    seq.start();

    // Advance 4 beats (2 seconds) → bar should be 1
    const s1 = seq.update(2.0);
    expect(s1.tick).toBe(4);
    expect(s1.beat).toBe(0); // wraps back to 0
    expect(s1.bar).toBe(1);

    // Advance another 4 beats (2 more seconds) → bar should be 2
    const s2 = seq.update(2.0);
    expect(s2.tick).toBe(8);
    expect(s2.beat).toBe(0);
    expect(s2.bar).toBe(2);
  });

  it('phase tracks 0..1 within current beat', () => {
    // 120 BPM, subdivision=1 → 0.5s per beat
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    seq.start();

    // After 0.25s → halfway through first beat → phase ~0.5
    const s1 = seq.update(0.25);
    expect(s1.phase).toBeCloseTo(0.5, 5);

    // After another 0.125s → 0.375s total → phase ~0.75
    const s2 = seq.update(0.125);
    expect(s2.phase).toBeCloseTo(0.75, 5);

    // After another 0.125s → 0.5s total → tick advances, phase ~0
    const s3 = seq.update(0.125);
    expect(s3.tick).toBe(1);
    expect(s3.phase).toBeCloseTo(0, 5);
  });

  it('onBeat callback fires on each beat', () => {
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    const beats: Array<{ beat: number; bar: number }> = [];

    seq.onBeat((beat, bar) => {
      beats.push({ beat, bar });
    });

    seq.start();

    // Advance 2 seconds → 4 beats (ticks 1,2,3,4)
    // Beat changes: 0→1, 1→2, 2→3, 3→0
    seq.update(2.0);
    expect(beats).toHaveLength(4);
    expect(beats[0]).toEqual({ beat: 1, bar: 0 });
    expect(beats[1]).toEqual({ beat: 2, bar: 0 });
    expect(beats[2]).toEqual({ beat: 3, bar: 0 });
    expect(beats[3]).toEqual({ beat: 0, bar: 1 });
  });

  it('onBar callback fires on each bar', () => {
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    const bars: number[] = [];

    seq.onBar((bar) => {
      bars.push(bar);
    });

    seq.start();

    // Advance 4 seconds → 8 beats → 2 full bars
    seq.update(4.0);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toBe(1);
    expect(bars[1]).toBe(2);
  });

  it('unsubscribe function removes callback', () => {
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    const beats: number[] = [];

    const unsub = seq.onBeat((beat) => {
      beats.push(beat);
    });

    seq.start();

    // 1 beat (0.5s)
    seq.update(0.5);
    expect(beats).toHaveLength(1);

    // Unsubscribe
    unsub();

    // Another beat — callback should not fire
    seq.update(0.5);
    expect(beats).toHaveLength(1);
  });

  it('subdivision=2 doubles tick rate (eighth notes)', () => {
    // 120 BPM, subdivision=2 → tickDuration = 60 / (120*2) = 0.25s per tick
    // 2 ticks per beat → beat changes every 0.5s (same BPM)
    // But we get 2 ticks per beat
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4, subdivision: 2 });
    seq.start();

    // After 0.25s → 1 tick, still beat 0 (need 2 ticks for beat change)
    const s1 = seq.update(0.25);
    expect(s1.tick).toBe(1);
    expect(s1.beat).toBe(0);

    // After another 0.25s → 2 ticks, beat = 1
    const s2 = seq.update(0.25);
    expect(s2.tick).toBe(2);
    expect(s2.beat).toBe(1);

    // After 2s total (from start) → 8 ticks, bar = 1
    seq.update(1.5);
    const s3 = seq.update(0); // read state without advancing
    expect(s3.tick).toBe(8);
    expect(s3.beat).toBe(0);
    expect(s3.bar).toBe(1);
  });

  it('reset() returns all counters to 0 and deactivates', () => {
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    seq.start();

    // Advance some beats
    seq.update(1.5); // 3 beats
    expect(seq.isActive()).toBe(true);

    const before = seq.update(0);
    expect(before.tick).toBe(3);
    expect(before.beat).toBe(3);

    seq.reset();
    expect(seq.isActive()).toBe(false);

    const after = seq.update(0);
    expect(after.beat).toBe(0);
    expect(after.bar).toBe(0);
    expect(after.tick).toBe(0);
    expect(after.phase).toBe(0);
    expect(after.active).toBe(false);
  });

  it('stop() freezes state, does not advance on update', () => {
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4 });
    seq.start();

    seq.update(0.5); // 1 beat
    seq.stop();

    const frozen = seq.update(1.0); // try advancing 1 second
    expect(frozen.tick).toBe(1);
    expect(frozen.beat).toBe(1);
    expect(frozen.active).toBe(false);
  });

  it('phase is correct with subdivision > 1', () => {
    // 120 BPM, subdivision=2 → tickDuration = 0.25s, ticksPerBeat = 2
    // Beat duration = 0.5s. Phase should span 0..1 across full beat.
    const seq = createBeatSequencer({ bpm: 120, beatsPerBar: 4, subdivision: 2 });
    seq.start();

    // After 0.125s → half of first tick. subTickInBeat=0, accumulator=0.125
    // phase = (0 + 0.125/0.25) / 2 = 0.5/2 = 0.25
    const s1 = seq.update(0.125);
    expect(s1.phase).toBeCloseTo(0.25, 5);

    // After another 0.125s → 1 tick done. subTickInBeat=1, accumulator=0
    // phase = (1 + 0) / 2 = 0.5
    const s2 = seq.update(0.125);
    expect(s2.phase).toBeCloseTo(0.5, 5);

    // After another 0.125s → 1 tick + half. subTickInBeat=1, accumulator=0.125
    // phase = (1 + 0.125/0.25) / 2 = (1 + 0.5) / 2 = 0.75
    const s3 = seq.update(0.125);
    expect(s3.phase).toBeCloseTo(0.75, 5);
  });
});
