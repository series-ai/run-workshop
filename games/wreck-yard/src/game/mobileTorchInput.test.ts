import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, TOOL, quantizeRay, type Tool } from '../sim/input';
import {
  clearTouchInput, clearTouchWeapon, consumeTouchSample, neutralTouchInput, queueTouchCut, touchPrimary,
} from '../ui/touchInput';
import { MatchController } from './match';

async function game() {
  const unusedTransport = async (): Promise<never> => { throw new Error('Solo torch test requested a transport'); };
  const controller = new MatchController({ createRoomTransport: unusedTransport,
    quickMatchTransport: unusedTransport, joinRoomTransport: unusedTransport });
  const touch = neutralTouchInput();
  let clockMs = 0;
  try {
    await controller.start({ kind: 'solo' });
    const target = controller.getRender()!.poses.get('shipping-storage-32')!.position;
    const ray = quantizeRay([target[0], target[1], target[2] + 2], [0, 0, -1]);
    const pump = (deltaMs: number, tool: Tool = TOOL.torch) => {
      const input = { ...NEUTRAL_INPUT, ...ray, tool, pressed: touchPrimary(touch, tool) };
      controller.setInput(input);
      clockMs += deltaMs;
      controller.pump(clockMs);
      const sample = controller.sampledInput;
      if (sample?.input === input) consumeTouchSample(touch, input, sample.frame);
      expect(controller.snapshot().status).toBe('live');
      return { pressed: input.pressed, sampledFrame: sample?.frame };
    };
    pump(0);
    pump(34);
    return { controller, touch, pump, cuts: () => controller.getRender()!.stats.torchCuts };
  } catch (error) {
    controller.stop();
    throw error;
  }
}

describe('mobile torch input with the real solo runtime', () => {
  it.each([
    { name: 'one tick per pump', deltas: [34] },
    { name: 'mixed zero, short, and two-tick pumps', deltas: [0, 10, 25, 66, 5, 1, 70] },
    { name: 'two ticks per pump', deltas: [100] },
    { name: '200 ms stalled pumps', deltas: [200] },
    { name: '500 ms stalled pumps', deltas: [500] },
    { name: '1000 ms stalled pumps', deltas: [1000] },
  ])('completes one released short tap with $name', async ({ deltas }) => {
    const current = await game();
    try {
      const before = current.cuts();
      queueTouchCut(current.touch);
      current.touch.primary = false;
      const samples = [];
      for (let pump = 0; pump < 24; pump++) {
        const sampled = current.pump(deltas[pump % deltas.length]!);
        if (pump < 6) samples.push({ ...sampled, cuts: current.cuts() - before,
          queued: current.touch.cutQueued, cutUntilFrame: current.touch.cutUntilFrame });
      }
      if (deltas[0]! >= 200) console.info(JSON.stringify({ name: deltas[0], samples, finalCuts: current.cuts() - before }));
      expect(current.cuts()).toBe(before + 1);
      expect(current.touch.cutQueued).toBe(false);
      expect(current.touch.cutUntilFrame).toBeNull();
      for (let pump = 0; pump < 8; pump++) expect(current.pump(34).pressed).toBe(false);
      expect(current.cuts()).toBe(before + 1);
    } finally { current.controller.stop(); }
  });

  it('keeps a tap queued while no simulation tick samples it', async () => {
    const current = await game();
    try {
      queueTouchCut(current.touch);
      current.touch.primary = false;
      for (let pump = 0; pump < 4; pump++) {
        expect(current.pump(0).sampledFrame).toBeUndefined();
        expect(current.touch.cutQueued).toBe(true);
      }
      for (let pump = 0; pump < 8; pump++) current.pump(34);
      expect(current.cuts()).toBe(1);
      expect(current.touch.cutQueued).toBe(false);
    } finally { current.controller.stop(); }
  });

  it('does not queue another pulse when a held torch is released after its first pulse', async () => {
    const current = await game();
    try {
      queueTouchCut(current.touch);
      for (let pump = 0; pump < 4; pump++) current.pump(34);
      expect(current.cuts()).toBe(1);
      expect(current.touch.cutQueued).toBe(false);
      current.touch.primary = false;
      for (let pump = 0; pump < 10; pump++) expect(current.pump(34).pressed).toBe(false);
      expect(current.cuts()).toBe(1);
    } finally { current.controller.stop(); }
  });

  it.each(['cancel', 'tool change'] as const)('clears an incomplete tap on %s', async (terminal) => {
    const current = await game();
    try {
      queueTouchCut(current.touch);
      current.touch.primary = false;
      for (let pump = 0; pump < 2; pump++) current.pump(34);
      expect(current.cuts()).toBe(0);
      if (terminal === 'cancel') clearTouchInput(current.touch);
      else clearTouchWeapon(current.touch);
      expect(current.touch.cutQueued).toBe(false);
      expect(current.touch.cutUntilFrame).toBeNull();
      expect(current.touch.primary).toBe(false);
      for (let pump = 0; pump < 8; pump++) current.pump(34, terminal === 'cancel' ? TOOL.torch : TOOL.hand);
      expect(current.cuts()).toBe(0);
      for (let pump = 0; pump < 4; pump++) expect(current.pump(34).pressed).toBe(false);
      expect(current.cuts()).toBe(0);
    } finally { current.controller.stop(); }
  });
});
