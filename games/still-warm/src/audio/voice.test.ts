import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isIsolatedStopCommand,
  SpeechRecognitionAlternativeLike,
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
  SpeechRecognitionResultLike,
  SpeechRecognitionResultListLike,
  VoiceInput,
} from './voice';

class FakeSpeechRecognition implements SpeechRecognitionLike {
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: ((event: unknown) => void) | null = null;
  onend: ((event: unknown) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;

  started = false;
  stopped = false;
  aborted = false;

  start(): void {
    this.started = true;
    this.onstart?.({});
  }

  stop(): void {
    this.stopped = true;
  }

  abort(): void {
    this.aborted = true;
    this.onend?.({});
  }

  emitEnd(): void {
    this.onend?.({});
  }

  emitResult(
    entries: Array<{ transcript: string; isFinal: boolean }>,
    resultIndex = 0,
  ): void {
    const resultsArray: SpeechRecognitionResultLike[] = entries.map((item) => {
      const alt: SpeechRecognitionAlternativeLike = {
        transcript: item.transcript,
        confidence: 0.95,
      };
      const res: SpeechRecognitionResultLike = {
        isFinal: item.isFinal,
        length: 1,
        0: alt,
        item: (idx: number) =>
          idx === 0 ? alt : ({} as SpeechRecognitionAlternativeLike),
      };
      return res;
    });

    const list: SpeechRecognitionResultListLike = {
      length: resultsArray.length,
      item: (idx: number) => resultsArray[idx],
    };
    for (let i = 0; i < resultsArray.length; i++) {
      (list as unknown as Record<number, SpeechRecognitionResultLike>)[i] =
        resultsArray[i];
    }

    this.onresult?.({
      resultIndex,
      results: list,
    });
  }

  emitError(error: string, message?: string): void {
    this.onerror?.({ error, message });
  }
}

describe('isIsolatedStopCommand', () => {
  it('detects isolated STOP phrases correctly', () => {
    expect(isIsolatedStopCommand('STOP')).toBe(true);
    expect(isIsolatedStopCommand('stop')).toBe(true);
    expect(isIsolatedStopCommand('Stop.')).toBe(true);
    expect(isIsolatedStopCommand('stop!')).toBe(true);
    expect(isIsolatedStopCommand('stop now')).toBe(true);
    expect(isIsolatedStopCommand('STOP NOW!')).toBe(true);
    expect(isIsolatedStopCommand('please stop')).toBe(true);
    expect(isIsolatedStopCommand('Please, stop!')).toBe(true);
    expect(isIsolatedStopCommand('stop please')).toBe(true);
    expect(isIsolatedStopCommand('stop stop')).toBe(true);
  });

  it('rejects commands where stop is part of a larger sentence', () => {
    expect(isIsolatedStopCommand('dont stop')).toBe(false);
    expect(isIsolatedStopCommand("don't stop")).toBe(false);
    expect(isIsolatedStopCommand('stop the bleeding')).toBe(false);
    expect(isIsolatedStopCommand('stop cutting')).toBe(false);
    expect(isIsolatedStopCommand('can you stop')).toBe(false);
    expect(isIsolatedStopCommand('please dont stop')).toBe(false);
    expect(isIsolatedStopCommand('')).toBe(false);
  });
});

describe('VoiceInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports unavailable on start without calling onStatus in constructor', () => {
    const onStatus = vi.fn();
    const voice = new VoiceInput({
      onFinal: vi.fn(),
      onInterim: vi.fn(),
      onStatus,
      onStop: vi.fn(),
    });

    expect(voice.supported).toBe(false);
    // Must NOT call onStatus in constructor during React useState init
    expect(onStatus).not.toHaveBeenCalled();

    // Calling start notifies unavailable
    voice.start();
    expect(onStatus).toHaveBeenCalledWith('unavailable', expect.any(String));
  });

  it('delivers repeated identical final events exactly once', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onFinal = vi.fn();
    const onInterim = vi.fn();

    const voice = new VoiceInput({
      onFinal,
      onInterim,
      onStatus: vi.fn(),
      onStop: vi.fn(),
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    // 1st event
    fakeInstance!.emitResult([
      { transcript: 'cut with scalpel', isFinal: true },
    ]);
    expect(onFinal).not.toHaveBeenCalled();

    // Identical 2nd event with same length and index
    fakeInstance!.emitResult([
      { transcript: 'cut with scalpel', isFinal: true },
    ]);
    expect(onFinal).not.toHaveBeenCalled();

    fakeInstance!.emitEnd();
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('cut with scalpel');
  });

  it('stop finishes push-to-talk and accepts late final result', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onFinal = vi.fn();
    const onStatus = vi.fn();

    const voice = new VoiceInput({
      onFinal,
      onInterim: vi.fn(),
      onStatus,
      onStop: vi.fn(),
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    expect(onStatus).toHaveBeenCalledWith('listening', null);

    // Push-to-talk button released -> stop()
    voice.stop();
    expect(fakeInstance!.stopped).toBe(true);

    // Engine delivers late final after stop()
    fakeInstance!.emitResult([
      { transcript: 'clamp the bleeder', isFinal: true },
    ]);
    expect(onFinal).not.toHaveBeenCalled();

    fakeInstance!.emitEnd();
    expect(onFinal).toHaveBeenCalledWith('clamp the bleeder');
    expect(onStatus).toHaveBeenLastCalledWith('idle', null);
  });

  it('joins final indexes and delayed stop results into one command', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onFinal = vi.fn();
    const voice = new VoiceInput({
      onFinal,
      onInterim: vi.fn(),
      onStatus: vi.fn(),
      onStop: vi.fn(),
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    fakeInstance!.emitResult([
      { transcript: 'pick up', isFinal: true },
      { transcript: 'the', isFinal: false },
    ]);
    fakeInstance!.emitResult([
      { transcript: 'pick up', isFinal: true },
      { transcript: 'the clean', isFinal: true },
    ], 1);
    expect(onFinal).not.toHaveBeenCalled();

    voice.stop();
    fakeInstance!.emitResult([
      { transcript: 'pick up', isFinal: true },
      { transcript: 'the clean', isFinal: true },
      { transcript: 'cloth', isFinal: true },
    ], 2);
    expect(onFinal).not.toHaveBeenCalled();

    fakeInstance!.emitEnd();
    expect(onFinal).toHaveBeenCalledOnce();
    expect(onFinal).toHaveBeenCalledWith('pick up the clean cloth');
  });

  it('cancel invalidates current session and rejects late final result without dispatch', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onFinal = vi.fn();
    const onStatus = vi.fn();

    const voice = new VoiceInput({
      onFinal,
      onInterim: vi.fn(),
      onStatus,
      onStop: vi.fn(),
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    expect(onStatus).toHaveBeenCalledWith('listening', null);

    fakeInstance!.emitResult([
      { transcript: 'clamp the bleeder', isFinal: true },
    ]);
    expect(onFinal).not.toHaveBeenCalled();

    // Parent cancels on pause/blackout/restart
    voice.cancel();
    expect(fakeInstance!.aborted).toBe(true);
    expect(onStatus).toHaveBeenLastCalledWith('idle', null);

    // Stale late final arrives
    fakeInstance!.emitResult([
      { transcript: 'clamp the bleeder', isFinal: true },
    ]);
    fakeInstance!.emitEnd();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('never submits partial interim sentences on onend', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onFinal = vi.fn();
    const onInterim = vi.fn();

    const voice = new VoiceInput({
      onFinal,
      onInterim,
      onStatus: vi.fn(),
      onStop: vi.fn(),
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    fakeInstance!.emitResult([
      { transcript: 'partial sentence without final', isFinal: false },
    ]);
    expect(onInterim).toHaveBeenCalledWith('partial sentence without final');

    // onend fires without final result
    fakeInstance!.emitEnd();
    expect(onFinal).not.toHaveBeenCalled();
    expect(onInterim).toHaveBeenLastCalledWith('');
  });

  it('debounces interim STOP by 300ms, and evolving into "stop the bleeding" cancels debounce with no false intercept', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onFinal = vi.fn();
    const onStop = vi.fn();
    const onInterim = vi.fn();

    const voice = new VoiceInput({
      onFinal,
      onInterim,
      onStatus: vi.fn(),
      onStop,
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();

    // Player starts saying "stop..."
    fakeInstance!.emitResult([{ transcript: 'stop', isFinal: false }]);
    expect(onInterim).toHaveBeenCalledWith('stop');
    expect(onStop).not.toHaveBeenCalled();

    // 150ms later, player continues "...the bleeding"
    vi.advanceTimersByTime(150);
    fakeInstance!.emitResult([
      { transcript: 'stop the bleeding', isFinal: false },
    ]);
    expect(onInterim).toHaveBeenCalledWith('stop the bleeding');
    expect(onStop).not.toHaveBeenCalled();

    // 350ms passes (total > 300ms from original "stop")
    vi.advanceTimersByTime(350);
    expect(onStop).not.toHaveBeenCalled();

    // Final result arrives
    fakeInstance!.emitResult([
      { transcript: 'stop the bleeding', isFinal: true },
    ]);
    expect(onStop).not.toHaveBeenCalled();
    expect(onFinal).not.toHaveBeenCalled();
    fakeInstance!.emitEnd();
    expect(onFinal).toHaveBeenCalledWith('stop the bleeding');
  });

  it('triggers debounced interim STOP after 300ms if speech stops', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onStop = vi.fn();
    const onFinal = vi.fn();

    const voice = new VoiceInput({
      onFinal,
      onInterim: vi.fn(),
      onStatus: vi.fn(),
      onStop,
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();

    fakeInstance!.emitResult([{ transcript: 'please stop', isFinal: false }]);
    expect(onStop).not.toHaveBeenCalled();

    // Advance past 300ms
    vi.advanceTimersByTime(300);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('triggers instant isolated STOP on final without debounce', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onStop = vi.fn();
    const onFinal = vi.fn();

    const voice = new VoiceInput({
      onFinal,
      onInterim: vi.fn(),
      onStatus: vi.fn(),
      onStop,
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();

    // Final isolated STOP fires instantly
    fakeInstance!.emitResult([{ transcript: 'stop now!', isFinal: true }]);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).not.toHaveBeenCalled();
    fakeInstance!.emitEnd();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('final STOP discards command segments collected in the same hold', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onFinal = vi.fn();
    const onStop = vi.fn();
    const voice = new VoiceInput({
      onFinal,
      onInterim: vi.fn(),
      onStatus: vi.fn(),
      onStop,
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    fakeInstance!.emitResult([
      { transcript: 'move the clamp', isFinal: true },
      { transcript: 'stop', isFinal: true },
    ]);

    expect(onStop).toHaveBeenCalledOnce();
    expect(onFinal).not.toHaveBeenCalled();
    fakeInstance!.emitEnd();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('preserves recoverable error status when onerror is immediately followed by onend', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onStatus = vi.fn();

    const voice = new VoiceInput({
      onFinal: vi.fn(),
      onInterim: vi.fn(),
      onStatus,
      onStop: vi.fn(),
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    expect(onStatus).toHaveBeenCalledWith('listening', null);

    // Browser fires onerror then onend
    fakeInstance!.emitError('not-allowed');
    expect(onStatus).toHaveBeenCalledWith(
      'error',
      'Microphone permission was denied.',
    );

    fakeInstance!.emitEnd();
    // Must retain error status, not clear it back to idle
    expect(onStatus).toHaveBeenLastCalledWith(
      'error',
      'Microphone permission was denied.',
    );

    // Recoverable: can call start again
    voice.start();
    expect(onStatus).toHaveBeenLastCalledWith('listening', null);
  });

  it('cancel clears pending interim stop debounce', () => {
    let fakeInstance: FakeSpeechRecognition | null = null;
    const onStop = vi.fn();

    const voice = new VoiceInput({
      onFinal: vi.fn(),
      onInterim: vi.fn(),
      onStatus: vi.fn(),
      onStop,
      recognitionFactory: () => {
        fakeInstance = new FakeSpeechRecognition();
        return fakeInstance;
      },
    });

    voice.start();
    fakeInstance!.emitResult([{ transcript: 'stop', isFinal: false }]);

    // Cancel while debounce is pending
    voice.cancel();
    vi.advanceTimersByTime(350);

    expect(onStop).not.toHaveBeenCalled();
  });
});
