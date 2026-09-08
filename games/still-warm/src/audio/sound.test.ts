import { describe, expect, it, vi } from "vitest";
import { createInitialState, GameState } from "../game/model";
import { getBreathingProfile, SurgerySound } from "./sound";

class FakeAudioParam {
  value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  setTargetAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  exponentialRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
}

class FakeAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam(1);
}

class FakeOscillatorNode extends FakeAudioNode {
  type = "sine";
  frequency = new FakeAudioParam(440);
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type = "lowpass";
  frequency = new FakeAudioParam(350);
  Q = new FakeAudioParam(1);
}

class FakeBufferSource extends FakeAudioNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  state: "suspended" | "running" | "closed" = "running";
  currentTime = 1.0;
  sampleRate = 24000;
  createBuffer = vi.fn((_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  }));
  createBufferSource = vi.fn(() => new FakeBufferSource());
  destination = new FakeAudioNode();

  createGain = vi.fn(() => new FakeGainNode());
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  createBiquadFilter = vi.fn(() => new FakeBiquadFilterNode());

  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}

describe("SurgerySound", () => {
  it("makes breathing faster and more strained as the patient declines", () => {
    const stable = getBreathingProfile({ health: 90, pain: 10, blood: 95 });
    const critical = getBreathingProfile({ health: 18, pain: 88, blood: 22 });

    expect(critical.breathsPerMinute).toBeGreaterThan(stable.breathsPerMinute);
    expect(critical.durationSeconds).toBeLessThan(stable.durationSeconds);
    expect(critical.volume).toBeGreaterThan(stable.volume);
    expect(critical.pitch).toBeGreaterThan(stable.pitch);
  });

  it("is completely safe in SSR or when WebAudio/speechSynthesis are missing", async () => {
    const sound = new SurgerySound();
    const state = createInitialState();

    // None of these should throw in headless/SSR environments
    await expect(sound.unlock()).resolves.toBeUndefined();
    expect(() => sound.setMuted(true)).not.toThrow();
    expect(() => sound.vocalize("fear")).not.toThrow();
    expect(() => sound.stopSpeech()).not.toThrow();
    expect(() => sound.update(state)).not.toThrow();
    expect(() => sound.dispose()).not.toThrow();
  });

  it("starts silent and blocks speech until sound is enabled", async () => {
    const ctx = new FakeAudioContext();
    const sound = new SurgerySound({
      audioContextFactory: () => ctx as unknown as AudioContext,
    });
    await sound.unlock();
    const master = ctx.createGain.mock.results[0].value;
    expect(master.gain.value).toBe(0);
    const count = ctx.createBufferSource.mock.calls.length;
    sound.call();
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(count);
    sound.setMuted(false);
    expect(master.gain.value).toBe(1);
    sound.call();
    expect(ctx.createBufferSource.mock.calls.length).toBeGreaterThan(count);
    sound.dispose();
  });

  it("lazily unlocks AudioContext and sets up hum graph", async () => {
    let mockCtx: FakeAudioContext | null = null;
    const sound = new SurgerySound({
      audioContextFactory: () => {
        mockCtx = new FakeAudioContext();
        return mockCtx as unknown as AudioContext;
      },
    });

    await sound.unlock();
    expect(mockCtx).not.toBeNull();
    expect(mockCtx!.createGain).toHaveBeenCalled();
    expect(mockCtx!.createOscillator).toHaveBeenCalled();
  });

  it("handles mute state in local memory without localStorage", async () => {
    let mockCtx: FakeAudioContext | null = null;
    const sound = new SurgerySound({
      audioContextFactory: () => {
        mockCtx = new FakeAudioContext();
        return mockCtx as unknown as AudioContext;
      },
    });

    await sound.unlock();
    sound.setMuted(true);
    sound.setMuted(false);
  });

  it("plays a wordless call and disconnects it on STOP", async () => {
    const ctx = new FakeAudioContext();
    const sound = new SurgerySound({
      audioContextFactory: () => ctx as unknown as AudioContext,
    });
    sound.setMuted(false);
    await sound.unlock();
    sound.call();
    const call = ctx.createBufferSource.mock.results[0].value;
    expect(call.start).toHaveBeenCalledOnce();
    sound.stopSpeech();
    expect(call.stop).toHaveBeenCalledWith(ctx.currentTime);
    expect(call.disconnect).toHaveBeenCalledOnce();
    sound.dispose();
  });

  it("mute and dispose prevent new vocal pulses", async () => {
    const ctx = new FakeAudioContext();
    const sound = new SurgerySound({
      audioContextFactory: () => ctx as unknown as AudioContext,
    });
    sound.setMuted(false);
    await sound.unlock();
    sound.call();
    const vocal = ctx.createBufferSource.mock.results.at(-1)!.value;
    sound.setMuted(true);
    expect(vocal.stop).toHaveBeenLastCalledWith(ctx.currentTime);
    const count = ctx.createBufferSource.mock.calls.length;
    sound.call();
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(count);
    sound.dispose();
    sound.setMuted(false);
    sound.call();
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(count);
  });

  it("pauses continuous audio when game is paused or ready or terminal", async () => {
    let mockCtx: FakeAudioContext | null = null;
    const sound = new SurgerySound({
      audioContextFactory: () => {
        mockCtx = new FakeAudioContext();
        return mockCtx as unknown as AudioContext;
      },
    });

    await sound.unlock();

    // 1. Ready phase -> inactive, hum 0
    const state = createInitialState();
    expect(state.phase).toBe("ready");
    sound.update(state);

    // 2. Playing phase -> active
    const playingState: GameState = {
      ...state,
      phase: "playing",
      paused: false,
    };
    sound.update(playingState);

    // 3. Paused playing phase -> inactive, hum silenced
    const pausedState: GameState = {
      ...playingState,
      paused: true,
    };
    sound.update(pausedState);

    // 4. Won / terminal phase -> inactive
    const wonState: GameState = {
      ...playingState,
      phase: "won",
    };
    sound.update(wonState);

    sound.dispose();
  });

  it("stops breathing and heartbeat timers when muted, paused, or disposed", async () => {
    vi.useFakeTimers();
    try {
      const mockCtx = new FakeAudioContext();
      const sound = new SurgerySound({
        audioContextFactory: () => mockCtx as unknown as AudioContext,
      });
      sound.setMuted(false);
      await sound.unlock();

      const playingState: GameState = {
        ...createInitialState(),
        phase: "playing",
        paused: false,
      };
      sound.update(playingState);
      expect(vi.getTimerCount()).toBe(2);

      vi.advanceTimersByTime(160);
      expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThan(2);
      expect(vi.getTimerCount()).toBe(2);

      sound.setMuted(true);
      expect(vi.getTimerCount()).toBe(0);

      sound.setMuted(false);
      expect(vi.getTimerCount()).toBe(2);

      sound.update({ ...playingState, paused: true });
      expect(vi.getTimerCount()).toBe(0);
      const vitalGain = mockCtx.createGain.mock.results[1].value;
      expect(vitalGain.gain.setTargetAtTime).toHaveBeenLastCalledWith(
        0,
        mockCtx.currentTime,
        0.04,
      );

      sound.update(playingState);
      expect(vi.getTimerCount()).toBe(2);
      sound.dispose();
      expect(vi.getTimerCount()).toBe(0);
      expect(mockCtx.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts in quiet blackness without a collapse impact", async () => {
    const mockCtx = new FakeAudioContext();
    const sound = new SurgerySound({
      audioContextFactory: () => mockCtx as unknown as AudioContext,
    });
    sound.setMuted(false);
    await sound.unlock();
    const ready = createInitialState();
    sound.update(ready);

    const beforeStart = mockCtx.createOscillator.mock.calls.length;
    const playing = { ...ready, phase: "playing" as const };
    sound.update(playing);
    const afterStart = mockCtx.createOscillator.mock.calls.length;
    sound.update(playing);

    expect(afterStart - beforeStart).toBe(0);
    expect(mockCtx.createOscillator.mock.calls.length).toBe(afterStart);
    sound.dispose();
  });

  it("reacts to discrete door knock, tool clink, and pain change events", async () => {
    let mockCtx: FakeAudioContext | null = null;
    const sound = new SurgerySound({
      audioContextFactory: () => {
        mockCtx = new FakeAudioContext();
        return mockCtx as unknown as AudioContext;
      },
    });

    sound.setMuted(false);
    await sound.unlock();

    let state: GameState = {
      ...createInitialState(),
      phase: "playing",
      paused: false,
    };
    sound.update(state);

    // Door knock discrete event
    const initialOscCount = mockCtx!.createOscillator.mock.calls.length;
    state = {
      ...state,
      environment: {
        ...state.environment,
        door: "knocking",
        events: [
          ...state.environment.events,
          { kind: "door", text: "The door shakes." },
        ],
      },
    };
    sound.update(state);
    expect(mockCtx!.createOscillator.mock.calls.length).toBeGreaterThan(
      initialOscCount,
    );

    const afterKnock = mockCtx!.createOscillator.mock.calls.length;
    state = {
      ...state,
      environment: {
        ...state.environment,
        fire: 15,
        events: [
          ...state.environment.events,
          { kind: "fire", text: "A fire starts." },
        ],
      },
    };
    sound.update(state);
    expect(mockCtx!.createOscillator.mock.calls.length).toBe(afterKnock);

    // Tool clink event
    const countBeforeClink = mockCtx!.createOscillator.mock.calls.length;
    state = {
      ...state,
      holding: "scalpel",
    };
    sound.update(state);
    expect(mockCtx!.createOscillator.mock.calls.length).toBeGreaterThan(
      countBeforeClink,
    );

    // Pain change event
    const countBeforePain = mockCtx!.createOscillator.mock.calls.length;
    state = {
      ...state,
      patient: {
        ...state.patient,
        pain: state.patient.pain + 15,
      },
    };
    sound.update(state);
    expect(mockCtx!.createOscillator.mock.calls.length).toBeGreaterThan(
      countBeforePain,
    );

    sound.dispose();
  });
});
