import { applyLook, type LookAngles } from '../render/pointerMapping';
import type { PlayerRenderPose } from '../render/presentation';
import { TOOL, type YardInput } from '../sim/input';

export const TOUCH_LOOK_SENSITIVITY = 0.004;
export type TouchWeapon =
  | { readonly kind: 'idle' }
  | { readonly kind: 'grab-pending'; readonly afterFeedbackFrame: number }
  | { readonly kind: 'holding'; readonly bodyId: string }
  | { readonly kind: 'releasing'; readonly bodyId: string; readonly action: 'throw' | 'drop' };
export interface TouchShot { readonly kind: 'push' | 'throw'; readonly aim: LookAngles }

/** Pointer events produce intent. The frame loop confirms actions from the game. */
export interface TouchInput {
  moveX: -1 | 0 | 1;
  moveZ: -1 | 0 | 1;
  primary: boolean;
  cutQueued: boolean;
  primaryRearm: boolean;
  secondaryRearm: boolean;
  shots: TouchShot[];
  dropQueued: boolean;
  dropUntilFrame: number | null;
  weapon: TouchWeapon;
  feedbackFrame: number;
  onWeaponChange: ((weapon: TouchWeapon) => void) | null;
  view: LookAngles;
  jetpack: boolean;
  use: boolean;
  useQueued: boolean;
  lookX: number;
  lookY: number;
}
export function neutralTouchInput(): TouchInput {
  return { moveX: 0, moveZ: 0, primary: false, cutQueued: false, primaryRearm: false,
    secondaryRearm: false, shots: [], dropQueued: false, dropUntilFrame: null, weapon: { kind: 'idle' },
    feedbackFrame: -1, onWeaponChange: null, view: { yaw: 0, pitch: 0 },
    jetpack: false, use: false, useQueued: false, lookX: 0, lookY: 0 };
}
export function setTouchWeapon(input: TouchInput, weapon: TouchWeapon): void {
  input.weapon = weapon;
  input.onWeaponChange?.(weapon);
}
export function clearTouchWeapon(input: TouchInput): void {
  input.dropQueued ||= input.weapon.kind !== 'idle';
  input.primary = false;
  input.cutQueued = false;
  input.primaryRearm = true;
  input.secondaryRearm = true;
  input.shots = [];
  setTouchWeapon(input, { kind: 'idle' });
}
export function clearTouchInput(input: TouchInput): void {
  const dropQueued = input.dropQueued || input.weapon.kind !== 'idle';
  const { onWeaponChange, view, feedbackFrame, dropUntilFrame } = input;
  Object.assign(input, neutralTouchInput(), { dropQueued, dropUntilFrame, onWeaponChange, view, feedbackFrame });
  setTouchWeapon(input, { kind: 'idle' });
}
export function queueTouchShot(input: TouchInput, kind: TouchShot['kind']): void {
  input.shots.push({ kind, aim: applyLook(input.view, input.lookX, input.lookY, TOUCH_LOOK_SENSITIVITY) });
}
export function touchPrimary(input: TouchInput, tool: YardInput['tool']): boolean {
  if (input.dropQueued || input.primaryRearm) return false;
  if (tool === TOOL.torch) return input.primary || input.cutQueued;
  if (input.shots.some((shot) => shot.kind === 'push')) return false;
  return input.weapon.kind === 'grab-pending' || input.weapon.kind === 'holding'
    || (input.weapon.kind === 'releasing' && input.weapon.action === 'throw' && input.shots.length > 0);
}
/** Syncplay has read this input for a scheduled tick. */
export function consumeTouchSample(input: TouchInput, sent: YardInput, frame: number): void {
  if (!sent.pressed) input.primaryRearm = false;
  if (sent.tool === TOOL.torch && sent.pressed) input.cutQueued = false;
  if (sent.secondary) { input.shots.shift(); input.secondaryRearm = true; }
  else input.secondaryRearm = false;
  input.useQueued = false;
  if (sent.drop && input.dropUntilFrame === null) input.dropUntilFrame = frame + 1;
}
/** Confirm actions from live state, after delayed input and any replay. */
export function syncTouchWeapon(input: TouchInput, frame: number, player: PlayerRenderPose | undefined): void {
  if (!player) return;
  input.feedbackFrame = player.feedback?.frame ?? -1;
  if (input.dropQueued) {
    if (input.dropUntilFrame !== null && Math.floor(frame) >= input.dropUntilFrame && !player.grabbing) {
      input.dropQueued = false;
      input.dropUntilFrame = null;
      input.primaryRearm = true;
      setTouchWeapon(input, { kind: 'idle' });
    }
    return;
  }
  const weapon = input.weapon;
  if (weapon.kind === 'grab-pending' && player.feedback && player.feedback.frame > weapon.afterFeedbackFrame
    && ['grab', 'miss', 'blocked', 'press'].includes(player.feedback.result)) {
    if (player.grabbing) setTouchWeapon(input, { kind: 'holding', bodyId: player.grabbing });
    else { input.primaryRearm = true; setTouchWeapon(input, { kind: 'idle' }); }
  } else if ((weapon.kind === 'holding' || weapon.kind === 'releasing') && !player.grabbing) {
    input.primaryRearm = true;
    // The target can disappear before a queued Throw reaches the game.
    input.shots = input.shots.filter((shot) => shot.kind !== 'throw');
    setTouchWeapon(input, { kind: 'idle' });
  }
}
export function touchAxis(value: number): -1 | 0 | 1 {
  return value > 0.2 ? 1 : value < -0.2 ? -1 : 0;
}
/** Coarse primary input includes tablets whose user agent says desktop. */
export function usesTouchControls(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || new URLSearchParams(window.location.search).get('controls') === 'touch';
}
