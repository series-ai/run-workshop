// Keyboard + touch input manager

export type GameKey = 'up' | 'down' | 'left' | 'right' | 'action';

const keyMap: Record<string, GameKey> = {
  w: 'up', arrowup: 'up',
  s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right',
  ' ': 'action', space: 'action', spacebar: 'action', enter: 'action',
};

// Fallback for browsers/automation that send e.code instead of e.key.
const codeMap: Record<string, GameKey> = {
  keyw: 'up', keya: 'left', keys: 'down', keyd: 'right',
  arrowup: 'up', arrowleft: 'left', arrowdown: 'down', arrowright: 'right',
  space: 'action', enter: 'action', numpadenter: 'action',
};

class InputManager {
  private pressed = new Set<GameKey>();
  private justPressed = new Set<GameKey>();
  private previousFrame = new Set<GameKey>();

  constructor() {
    const resolve = (e: KeyboardEvent): GameKey | undefined =>
      keyMap[e.key.toLowerCase()] ?? codeMap[e.code.toLowerCase()];

    // 2026-05-30 (v1.618) — Ignore keys while focus is inside a text
    // input. The global preventDefault below was eating W/A/S/D/space/
    // enter/arrows from ANY focused <textarea> or <input>, which made
    // typing in CreateTab's custom-prompt feel like keys were being
    // dropped (because they literally were). Mike: "missing keys like
    // crazy and super delayed" — turned out to be this, not a React
    // render issue. The fix: bail out when the event target is an
    // editable element so the browser's native input behavior runs
    // unimpeded; the overworld only cares about keys pressed against
    // the document/canvas, never against form controls.
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    };

    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      const key = resolve(e);
      if (key) {
        e.preventDefault();
        this.pressed.add(key);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (isTypingTarget(e.target)) return;
      const key = resolve(e);
      if (key) this.pressed.delete(key);
    });
  }

  /** Call once per frame before reading input */
  update() {
    this.justPressed.clear();
    for (const key of this.pressed) {
      if (!this.previousFrame.has(key)) {
        this.justPressed.add(key);
      }
    }
    this.previousFrame = new Set(this.pressed);
  }

  isDown(key: GameKey): boolean {
    return this.pressed.has(key);
  }

  wasPressed(key: GameKey): boolean {
    return this.justPressed.has(key);
  }

  isAnyDirectionDown(): boolean {
    return this.isDown('up') || this.isDown('down') || this.isDown('left') || this.isDown('right');
  }

  /** For touch controls */
  simulateDown(key: GameKey) {
    this.pressed.add(key);
  }

  simulateUp(key: GameKey) {
    this.pressed.delete(key);
  }

  /**
   * Wipe all currently-held keys. Used after a dialog closes, when focus may
   * have stolen the keyup so our listener never saw it.
   */
  clear() {
    this.pressed.clear();
    this.justPressed.clear();
    this.previousFrame.clear();
  }
}

export const input = new InputManager();
