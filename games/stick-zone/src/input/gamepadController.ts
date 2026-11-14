/**
 * @file gamepadController.ts
 * Universal Gamepad API handler for Xbox, PlayStation, and generic USB/Bluetooth controllers.
 */

export interface GamepadInputState {
  dx: number;
  dz: number;
  aimAngle?: number;
  sprint: boolean;
  slide: boolean;
  roll: boolean;
  kick: boolean;
  shoot: boolean;
  interact: boolean;
  switchWeapon: boolean;
  stim: boolean;
  reload: boolean;
  ads: boolean;
}

export class GamepadController {
  private lastSwapPressed = false;
  private lastReloadPressed = false;
  private lastStimPressed = false;
  private lastLootPressed = false;

  public poll(): GamepadInputState | null {
    if (typeof navigator === "undefined" || !navigator.getGamepads) {
      return null;
    }

    const gamepads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i]?.connected) {
        pad = gamepads[i];
        break;
      }
    }

    if (!pad) return null;

    const deadzone = 0.18;

    // Left Stick: Locomotion
    let lx = pad.axes[0] || 0;
    let lz = pad.axes[1] || 0;
    if (Math.abs(lx) < deadzone) lx = 0;
    if (Math.abs(lz) < deadzone) lz = 0;

    const stickMag = Math.hypot(lx, lz);
    const sprint = stickMag > 0.85 || Boolean(pad.buttons[10]?.pressed); // L3 click or hard push

    // Right Stick: Aiming
    let rx = pad.axes[2] || 0;
    let rz = pad.axes[3] || 0;
    let aimAngle: number | undefined = undefined;
    if (Math.abs(rx) > deadzone || Math.abs(rz) > deadzone) {
      aimAngle = Math.atan2(rx, rz);
    }

    // Triggers & Bumpers
    const shoot = Boolean(pad.buttons[7]?.pressed || pad.buttons[7]?.value > 0.2); // Right Trigger
    const ads = Boolean(pad.buttons[6]?.pressed || pad.buttons[6]?.value > 0.2);   // Left Trigger (ADS)
    const kick = Boolean(pad.buttons[5]?.pressed);                               // Right Bumper (R1)
    const roll = Boolean(pad.buttons[0]?.pressed);                               // Button A (South)
    const slide = Boolean(pad.buttons[1]?.pressed);                              // Button B (East)

    // Single-shot buttons (edge detection)
    const swapPressed = Boolean(pad.buttons[3]?.pressed);                        // Button Y (North)
    const switchWeapon = swapPressed && !this.lastSwapPressed;
    this.lastSwapPressed = swapPressed;

    const stimPressed = Boolean(pad.buttons[4]?.pressed);                        // Left Bumper (L1)
    const stim = stimPressed && !this.lastStimPressed;
    this.lastStimPressed = stimPressed;

    const reloadPressed = Boolean(pad.buttons[2]?.pressed || pad.buttons[13]?.pressed); // Button X (West) or Dpad Down
    const reload = reloadPressed && !this.lastReloadPressed;
    this.lastReloadPressed = reloadPressed;

    const lootPressed = Boolean(pad.buttons[12]?.pressed);                       // Dpad Up
    const interact = lootPressed && !this.lastLootPressed;
    this.lastLootPressed = lootPressed;

    return {
      dx: lx,
      dz: lz,
      aimAngle,
      sprint,
      slide,
      roll,
      kick,
      shoot,
      interact,
      switchWeapon,
      stim,
      reload,
      ads,
    };
  }

  public vibrate(durationMs: number = 80, weak: number = 0.4, strong: number = 0.7): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const pad = gamepads[i];
      if (pad?.vibrationActuator) {
        try {
          (pad.vibrationActuator as any).playEffect("dual-rumble", {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude: weak,
            strongMagnitude: strong,
          });
        } catch {}
      }
    }
  }
}

export const gamepad = new GamepadController();
