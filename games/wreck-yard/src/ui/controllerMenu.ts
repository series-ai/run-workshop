import type { ControllerButton, ControllerPad } from '../game/controllerInput';

function visible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

/** Only the top open menu owns controller focus. Nearby attraction panels do not. */
export function controllerMenuRoot(): HTMLElement | null {
  const roots = [...document.querySelectorAll<HTMLElement>('[data-controller-keypad], .yard-modal, .yard-gate')].filter(visible);
  return roots.find(root => root.hasAttribute('data-controller-keypad'))
    ?? roots.find(root => root.classList.contains('yard-modal')) ?? roots.at(-1) ?? null;
}

function items(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('button, input, select, summary')]
    .filter(element => !element.matches(':disabled') && visible(element));
}

export class ControllerMenu {
  private remembered = new WeakMap<HTMLElement, HTMLElement>();
  private direction = '';
  private repeatAt = 0;
  private waitForStick = true;
  private waitForDpad = true;

  clear(): void {
    document.querySelectorAll('[data-controller-focused]').forEach(element => element.removeAttribute('data-controller-focused'));
    this.direction = '';
    this.waitForStick = true;
    this.waitForDpad = true;
  }

  step(root: HTMLElement, pad: ControllerPad, edges: ReadonlySet<ControllerButton>, now: number): void {
    const candidates = items(root);
    if (!candidates.length) return;
    let focused = candidates.find(element => element === document.activeElement);
    if (!focused) {
      const preferred = this.remembered.get(root);
      focused = preferred && candidates.includes(preferred) ? preferred
        : candidates.find(element => element.hasAttribute('data-controller-default')) ?? candidates[0]!;
      this.focus(root, focused);
    }
    if (edges.has('b')) {
      root.querySelector<HTMLElement>('[data-controller-back]:not(:disabled)')?.click();
      return;
    }
    if (edges.has('a')) { focused.click(); return; }
    const x = pad.axes.leftX, y = pad.axes.leftY;
    const dpad = pad.buttons.dpadUp.pressed ? 'up' : pad.buttons.dpadDown.pressed ? 'down'
      : pad.buttons.dpadLeft.pressed ? 'left' : pad.buttons.dpadRight.pressed ? 'right' : '';
    const stickNeutral = Math.max(Math.abs(x), Math.abs(y)) < 0.45;
    if (stickNeutral) this.waitForStick = false;
    if (!dpad) this.waitForDpad = false;
    const direction = !this.waitForDpad && dpad ? dpad : this.waitForStick || stickNeutral ? ''
      : Math.abs(y) >= Math.abs(x) ? y < 0 ? 'up' : 'down' : x < 0 ? 'left' : 'right';
    const move = direction && (direction !== this.direction || now >= this.repeatAt);
    if (direction !== this.direction) this.repeatAt = now + 280;
    else if (move) this.repeatAt = now + 140;
    this.direction = direction;
    if (!move) return;
    if ((direction === 'left' || direction === 'right') && focused instanceof HTMLInputElement && focused.type === 'range') {
      if (direction === 'right') focused.stepUp(); else focused.stepDown();
      focused.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const box = focused.getBoundingClientRect();
    let next = focused, best = Infinity;
    for (const candidate of candidates) {
      if (candidate === focused) continue;
      const target = candidate.getBoundingClientRect();
      const dx = target.x + target.width / 2 - box.x - box.width / 2;
      const dy = target.y + target.height / 2 - box.y - box.height / 2;
      const along = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
      if (along <= 5) continue;
      const across = direction === 'left' || direction === 'right'
        ? Math.max(0, target.top - box.bottom, box.top - target.bottom)
        : Math.max(0, target.left - box.right, box.left - target.right);
      const score = along + across * 3;
      if (score < best) { best = score; next = candidate; }
    }
    this.focus(root, next);
  }

  private focus(root: HTMLElement, element: HTMLElement): void {
    document.querySelectorAll('[data-controller-focused]').forEach(item => item.removeAttribute('data-controller-focused'));
    element.setAttribute('data-controller-focused', 'true');
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.remembered.set(root, element);
  }
}
