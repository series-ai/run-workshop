export interface ChillAudioState {
  enabled: boolean;
  playing: boolean;
  paused: boolean;
  supported: boolean;
}

const AUDIO_SRC = './audio/gymnopedie-1.mp3';
const TARGET_VOLUME = 0.55;
const RAMP_MS = 350;

export class ChillAudio {
  onStateChange: ((state: ChillAudioState) => void) | null = null;

  private readonly el: HTMLAudioElement;
  private enabled = true;
  private paused = false;
  private supported = true;
  private activated = false;
  private disposed = false;
  private fadeRaf = 0;
  private gesturesBound = false;

  constructor() {
    this.el = new Audio(AUDIO_SRC);
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.volume = 0;

    this.el.addEventListener('error', this.onAudioError);
    this.el.addEventListener('play', this.onMediaEvent);
    this.el.addEventListener('pause', this.onMediaEvent);

    this.bindGestureListeners();
  }

  getState(): ChillAudioState {
    return {
      enabled: this.enabled,
      playing: !this.el.paused && this.supported,
      paused: this.paused,
      supported: this.supported,
    };
  }

  setPaused(paused: boolean): void {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.stopNow();
      this.emit();
      return;
    }
    if (this.enabled && this.supported && this.activated) {
      this.tryStart();
    } else {
      this.emit();
    }
  }

  toggleFromButton(): void {
    if (this.disposed || !this.supported) return;

    if (this.paused) {
      this.enabled = !this.enabled;
      if (!this.enabled) {
        this.stopNow();
      }
      this.emit();
      return;
    }

    if (!this.enabled) {
      this.enabled = true;
      this.tryStart();
      return;
    }

    if (this.el.paused) {
      this.tryStart();
      return;
    }

    this.enabled = false;
    this.stopNow();
    this.emit();
  }

  setSceneMood(_sceneId: string): void {
    // Single curated CC0 solo piano soundtrack across all 21 scenes.
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelFade();
    this.removeGestureListeners();
    this.el.removeEventListener('error', this.onAudioError);
    this.el.removeEventListener('play', this.onMediaEvent);
    this.el.removeEventListener('pause', this.onMediaEvent);
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    this.onStateChange = null;
  }

  private readonly onAudioError = (): void => {
    if (this.disposed) return;
    this.supported = false;
    this.cancelFade();
    this.el.volume = 0;
    this.emit();
  };

  private readonly onMediaEvent = (): void => {
    if (this.disposed) return;
    this.emit();
  };

  private readonly onFirstGesture = (e: Event): void => {
    if (this.disposed || !this.enabled || this.paused || !this.supported || !this.el.paused) return;
    const target = e.target;
    if (target instanceof Element && target.closest('#btn-audio')) return;
    if (e instanceof KeyboardEvent) {
      if (e.code === 'KeyM' || e.metaKey || e.ctrlKey || e.altKey) return;
    }
    this.tryStart();
  };

  private bindGestureListeners(): void {
    if (this.gesturesBound) return;
    this.gesturesBound = true;
    window.addEventListener('pointerdown', this.onFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', this.onFirstGesture, { capture: true, passive: true });
  }

  private removeGestureListeners(): void {
    if (!this.gesturesBound) return;
    this.gesturesBound = false;
    window.removeEventListener('pointerdown', this.onFirstGesture, true);
    window.removeEventListener('keydown', this.onFirstGesture, true);
  }

  private tryStart(): void {
    if (this.disposed || !this.enabled || this.paused || !this.supported) return;
    this.activated = true;
    this.cancelFade();
    this.el.volume = 0;
    try {
      const playResult = this.el.play();
      this.emit();
      if (playResult && typeof playResult.then === 'function') {
        playResult.then(
          () => {
            if (this.disposed || !this.enabled || this.paused || this.el.paused) return;
            this.removeGestureListeners();
            this.rampVolume();
            this.emit();
          },
          (err: unknown) => {
            if (this.disposed) return;
            const name = err instanceof DOMException ? err.name : '';
            if (name === 'NotAllowedError') {
              this.activated = false;
            } else if (name === 'NotSupportedError') {
              this.supported = false;
              this.activated = false;
            }
            this.cancelFade();
            this.el.volume = 0;
            this.emit();
          },
        );
      } else {
        this.removeGestureListeners();
        this.rampVolume();
        this.emit();
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError') {
        this.activated = false;
      } else if (name === 'NotSupportedError') {
        this.supported = false;
        this.activated = false;
      }
      this.cancelFade();
      this.el.volume = 0;
      this.emit();
    }
  }

  private stopNow(): void {
    this.cancelFade();
    this.el.volume = 0;
    this.el.pause();
  }

  private rampVolume(): void {
    this.cancelFade();
    const start = performance.now();
    const step = (now: number): void => {
      if (this.disposed || !this.enabled || this.paused || this.el.paused) {
        this.fadeRaf = 0;
        return;
      }
      const t = Math.min(1, (now - start) / RAMP_MS);
      this.el.volume = TARGET_VOLUME * t;
      if (t < 1) {
        this.fadeRaf = requestAnimationFrame(step);
      } else {
        this.fadeRaf = 0;
      }
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  private cancelFade(): void {
    if (this.fadeRaf) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = 0;
    }
  }

  private emit(): void {
    this.onStateChange?.(this.getState());
  }
}
