export type UiTool = 'hand' | 'torch' | 'orbit';
export type PlayTool = Exclude<UiTool, 'orbit'>;

/**
 * Keys that fire the thruster. On a Mac keyboard, the key labeled "delete"
 * sends `Backspace`; forward delete sends `Delete`.
 */
const THRUSTER_KEYS: readonly string[] = ['Space', 'Backspace', 'Delete'];
const PLAY_TOOL_KEYS: Readonly<Record<string, PlayTool>> = { Digit1: 'hand', Digit2: 'torch' };
const ORBIT_TOGGLE_KEY = 'KeyO';

export const TOOL_KEY_LABELS: Readonly<Record<UiTool, string>> = { hand: '1', torch: '2', orbit: 'O' };

export function isThrusterHeld(keys: ReadonlySet<string>): boolean {
  return THRUSTER_KEYS.some((code) => keys.has(code));
}

/** Keys the browser must not act on while the canvas has control (Backspace can navigate). */
export function isGameKey(code: string): boolean {
  return THRUSTER_KEYS.includes(code);
}

/**
 * Returns the tool after a key press, or null when the key does not change tools.
 * The orbit key toggles: from orbit it returns to the last play tool.
 */
export function toolForKey(code: string, current: UiTool, lastPlayTool: PlayTool): UiTool | null {
  const playTool = PLAY_TOOL_KEYS[code];
  if (playTool) return playTool;
  if (code === ORBIT_TOGGLE_KEY) return current === 'orbit' ? lastPlayTool : 'orbit';
  return null;
}
