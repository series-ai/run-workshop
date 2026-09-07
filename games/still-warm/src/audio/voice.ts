export type VoiceStatus = 'unavailable' | 'idle' | 'listening' | 'error';

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((event: unknown) => void) | null;
  onend: ((event: unknown) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getBrowserRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as WindowWithSpeech;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

const STOP_COMMANDS = new Set([
  'stop',
  'stop now',
  'please stop',
  'stop please',
  'stop stop',
]);

export function isIsolatedStopCommand(raw: string): boolean {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return STOP_COMMANDS.has(cleaned);
}

export interface VoiceInputOptions {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onStatus: (status: VoiceStatus, error: string | null) => void;
  onStop: () => void;
  recognitionFactory?: () => SpeechRecognitionLike | null;
}

export class VoiceInput {
  readonly supported: boolean;

  private recognition: SpeechRecognitionLike | null = null;
  private currentSessionId = 0;
  private isListening = false;
  private disposed = false;
  private stopTriggeredForSession = false;
  private sessionHasError = false;
  private deliveredIndexes = new Set<number>();
  private interimStopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: VoiceInputOptions) {
    if (options.recognitionFactory) {
      this.supported = true;
    } else {
      const ctor = getBrowserRecognitionConstructor();
      this.supported = ctor !== null;
    }
    // Avoid calling onStatus during constructor/state initialization
  }

  private clearInterimStopDebounce(): void {
    if (this.interimStopTimer !== null) {
      clearTimeout(this.interimStopTimer);
      this.interimStopTimer = null;
    }
  }

  start(): void {
    if (this.disposed) return;

    if (!this.supported) {
      this.options.onStatus(
        'unavailable',
        'Speech recognition is not supported in this browser.',
      );
      return;
    }

    // Cancel any prior session debounce & state
    this.clearInterimStopDebounce();
    const sessionId = ++this.currentSessionId;
    this.stopTriggeredForSession = false;
    this.sessionHasError = false;
    this.deliveredIndexes.clear();

    // Teardown any existing active recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Safe ignore
      }
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }

    let instance: SpeechRecognitionLike | null = null;
    if (this.options.recognitionFactory) {
      instance = this.options.recognitionFactory();
    } else {
      const ctor = getBrowserRecognitionConstructor();
      if (ctor) {
        try {
          instance = new ctor();
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Could not initialize speech recognition.';
          this.options.onStatus('error', message);
          return;
        }
      }
    }

    if (!instance) {
      this.options.onStatus(
        'unavailable',
        'Speech recognition is not available.',
      );
      return;
    }

    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = 'en-US';

    instance.onstart = () => {
      if (this.disposed || this.currentSessionId !== sessionId) return;
      this.isListening = true;
      this.options.onStatus('listening', null);
    };

    instance.onresult = (event: SpeechRecognitionEventLike) => {
      if (this.disposed || this.currentSessionId !== sessionId) return;

      // 1. Process new final results, tracking delivered indexes to prevent duplicate dispatches
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result && result.isFinal) {
          if (this.deliveredIndexes.has(i)) {
            continue;
          }
          this.deliveredIndexes.add(i);

          // Any finalized result cancels pending interim debounce
          this.clearInterimStopDebounce();

          const text = (result[0]?.transcript ?? '').trim();
          if (text) {
            if (isIsolatedStopCommand(text)) {
              if (!this.stopTriggeredForSession) {
                this.stopTriggeredForSession = true;
                this.options.onStop();
              }
            } else if (!this.stopTriggeredForSession) {
              this.options.onFinal(text);
            }
          }
          this.options.onInterim('');
        }
      }

      // 2. Accumulate any interim text
      let interimAccum = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result && !result.isFinal) {
          interimAccum += result[0]?.transcript ?? '';
        }
      }

      const trimmedInterim = interimAccum.trim();
      if (trimmedInterim) {
        if (isIsolatedStopCommand(trimmedInterim)) {
          if (!this.stopTriggeredForSession) {
            // Debounce isolated interim STOP by 300ms to allow phrase to evolve (e.g. "stop the bleeding")
            this.clearInterimStopDebounce();
            this.options.onInterim(trimmedInterim);
            this.interimStopTimer = setTimeout(() => {
              this.interimStopTimer = null;
              if (
                this.disposed ||
                this.currentSessionId !== sessionId ||
                this.stopTriggeredForSession
              )
                return;
              this.stopTriggeredForSession = true;
              this.options.onStop();
              this.options.onInterim('');
              this.stop();
            }, 300);
          }
        } else {
          // Transcript evolved into non-stop phrase: cancel pending debounce
          this.clearInterimStopDebounce();
          if (!this.stopTriggeredForSession) {
            this.options.onInterim(trimmedInterim);
          }
        }
      } else {
        this.clearInterimStopDebounce();
      }
    };

    instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (this.disposed || this.currentSessionId !== sessionId) return;
      this.isListening = false;
      this.sessionHasError = true;
      this.clearInterimStopDebounce();
      this.options.onInterim('');

      let message = 'Speech recognition failed.';
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        message = 'Microphone permission was denied.';
      } else if (event.error === 'network') {
        message = 'Network error occurred during speech recognition.';
      } else if (event.error === 'no-speech') {
        message = 'No speech detected.';
      } else if (event.error) {
        message = `Speech recognition error: ${event.error}`;
      }
      this.options.onStatus('error', message);
    };

    instance.onend = () => {
      if (this.disposed || this.currentSessionId !== sessionId) return;
      this.isListening = false;
      this.clearInterimStopDebounce();
      this.options.onInterim('');

      // Retain recoverable error status rather than overwriting with idle
      if (!this.sessionHasError) {
        this.options.onStatus('idle', null);
      }
    };

    this.recognition = instance;

    try {
      instance.start();
      this.isListening = true;
      this.options.onStatus('listening', null);
    } catch (err) {
      this.isListening = false;
      this.sessionHasError = true;
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to start microphone recording.';
      this.options.onStatus('error', message);
    }
  }

  stop(): void {
    if (this.disposed || !this.isListening) return;
    this.isListening = false;
    this.clearInterimStopDebounce();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Safe ignore
      }
    }
  }

  cancel(): void {
    if (this.disposed) return;
    this.currentSessionId++;
    this.clearInterimStopDebounce();
    this.deliveredIndexes.clear();
    this.stopTriggeredForSession = false;
    this.sessionHasError = false;
    this.isListening = false;

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Safe ignore
      }
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }

    this.options.onInterim('');
    this.options.onStatus('idle', null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
  }
}
