import type RundotAPI from '@series-inc/rundot-game-sdk/api';

export type ControllerPad = ReturnType<typeof RundotAPI.gamepad.getGamepads>[number];
export type ControllerButton = keyof ControllerPad['buttons'];

export function controllerStick(x: number, y: number): readonly [number, number] {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 0.18) return [0, 0];
  const scale = Math.min(1, (magnitude - 0.18) / 0.82) / magnitude;
  return [x * scale, y * scale];
}

export interface ControllerFrame {
  readonly moveX: number;
  readonly moveZ: number;
  readonly lookX: number;
  readonly lookY: number;
  readonly primary: boolean;
  readonly secondary: boolean;
  readonly jetpack: boolean;
  readonly use: boolean;
  readonly drop: boolean;
  readonly useEdge: boolean;
  readonly tool: 'hand' | 'torch' | 'orbit' | null;
  readonly floor: 0 | 1 | 2 | 3 | null;
}

const EMPTY_FRAME: ControllerFrame = {
  moveX: 0, moveZ: 0, lookX: 0, lookY: 0,
  primary: false, secondary: false, jetpack: false, use: false, drop: false,
  useEdge: false, tool: null, floor: null,
};
const ACTIONS = ['rightTrigger', 'leftTrigger', 'a', 'x', 'b'] as const;

/** Keep short presses until Syncplay samples them. A reset requires neutral input. */
export class ControllerInputState {
  frame = EMPTY_FRAME;
  edges = new Set<ControllerButton>();
  down = new Set<ControllerButton>();
  private pending = new Set<ControllerButton>();
  private armed = false;
  private seeded = false;

  update(pad: ControllerPad): boolean {
    const down = new Set<ControllerButton>();
    for (const name of Object.keys(pad.buttons) as ControllerButton[]) {
      const button = pad.buttons[name];
      if (button.pressed || button.value >= 0.5) down.add(name);
    }
    const left = controllerStick(pad.axes.leftX, pad.axes.leftY);
    const right = controllerStick(pad.axes.rightX, pad.axes.rightY);
    const neutral = down.size === 0 && left[0] === 0 && left[1] === 0 && right[0] === 0 && right[1] === 0;
    this.edges = new Set(this.seeded ? [...down].filter(name => !this.down.has(name)) : []);
    this.seeded = true;
    this.down = down;
    if (!this.armed) {
      this.armed = neutral;
      this.frame = EMPTY_FRAME;
      return this.edges.size > 0;
    }
    for (const name of ACTIONS) if (this.edges.has(name)) this.pending.add(name);
    const held = (name: ControllerButton) => down.has(name) || this.pending.has(name);
    const axis = (value: number) => value > 0.2 ? 1 : value < -0.2 ? -1 : 0;
    this.frame = {
      moveX: axis(left[0]), moveZ: axis(-left[1]), lookX: right[0], lookY: right[1],
      primary: held('rightTrigger'), secondary: held('leftTrigger'), jetpack: held('a'), use: held('x'), drop: held('b'),
      useEdge: this.edges.has('x'),
      tool: this.edges.has('leftBumper') ? 'hand' : this.edges.has('rightBumper') ? 'torch' : this.edges.has('select') ? 'orbit' : null,
      floor: this.edges.has('dpadDown') ? 0 : this.edges.has('dpadLeft') ? 1 : this.edges.has('dpadUp') ? 2 : this.edges.has('dpadRight') ? 3 : null,
    };
    return !neutral;
  }

  consume(): void { this.pending.clear(); }

  suppress(): void {
    this.frame = EMPTY_FRAME;
    this.pending.clear();
  }

  clear(): void {
    this.suppress();
    this.armed = false;
    this.seeded = false;
    this.down.clear();
    this.edges.clear();
  }
}
