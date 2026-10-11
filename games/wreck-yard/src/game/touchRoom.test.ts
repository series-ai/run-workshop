import { createSyncplayRunner, type SyncplayRoomTransport } from '@series-inc/rundot-syncplay/browser';
import { createSimulatedSyncplayMatch } from '@series-inc/rundot-syncplay/testing';
import { describe, expect, it } from 'vitest';
import { interpolateYard, projectYard, type YardRender } from '../render/presentation';
import { TICK_RATE } from '../sim/constants';
import { decodeYardInput, encodeYardInput, NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from '../sim/input';
import { createYardRuntime, yardRoomOptions } from '../sim/session';
import type { YardState } from '../sim/state';
import { clearTouchInput, consumeTouchSample, neutralTouchInput, queueTouchShot, setTouchWeapon, syncTouchWeapon, touchPrimary } from '../ui/touchInput';
import { MatchController } from './match';

const FRAME_MS = 1000 / TICK_RATE;

function room() {
  return createSimulatedSyncplayMatch({
    roomConfig: {
      ...yardRoomOptions(1), playerCount: 1, seed: 19, tickRateHz: TICK_RATE,
      hardToleranceTicks: 8, redundancyWindowTicks: 8, neutralInput: encodeYardInput(NEUTRAL_INPUT),
    },
  });
}

async function drain() {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
}

async function startRoom(delay: number) {
  const match = room();
  const samples: { input: YardInput; frame: number }[] = [];
  let input = NEUTRAL_INPUT;
  const runner = createSyncplayRunner<YardState, YardInput, unknown, YardState, YardRender>({
    runtimeFactory: createYardRuntime,
    defaultInput: NEUTRAL_INPUT,
    encodeInput: encodeYardInput,
    decodeInput: decodeYardInput,
    localInputForTick: (_slot, frame) => { samples.push({ input, frame }); return input; },
    presentation: { project: projectYard, interpolate: interpolateYard },
    pacing: { targetLeadTicks: 2, maxStepsPerPump: 2 },
    inputDelay: { minTicks: delay, maxTicks: delay },
  });
  let settled = false;
  const pending = runner.start({ mode: 'networked', connect: async () => match.openTransport('thumb') });
  pending.then(() => { settled = true; }, () => { settled = true; });
  for (let tick = 0; tick < 40 && (!settled || runner.status !== 'live'); tick++) {
    match.advance(1);
    runner.update(FRAME_MS);
    await drain();
  }
  await pending;
  expect(runner.status).toBe('live');
  return {
    runner,
    setInput(next: YardInput) { input = next; },
    pump(delta: number, authority = true) {
      samples.length = 0;
      if (authority) match.advance(1);
      runner.update(delta);
      return samples.at(-1);
    },
  };
}

describe('touch actions in a real room', () => {
  it('reports no current sample when the controller advances an already scheduled frame', async () => {
    const match = room();
    const transport = async (): Promise<SyncplayRoomTransport> => ({
      ...match.openTransport('controller'), roomCode: 'THUMBS', isCreator: true,
      occupancy: { players: [], occupied: 1, maxPlayers: 1, full: true, locked: false },
      onConnectionEvent: () => {}, onOccupancyChange: () => () => {}, setSeatingOpen: () => {},
    });
    const controller = new MatchController({
      createRoomTransport: transport, quickMatchTransport: transport, joinRoomTransport: transport,
    });
    let settled = false;
    let now = 0;
    const pending = controller.start({ kind: 'create' });
    pending.then(() => { settled = true; });
    try {
      for (let tick = 0; tick < 40 && (!settled || controller.snapshot().status !== 'live'); tick++) {
        match.advance(1);
        controller.pump(now += FRAME_MS);
        await drain();
      }
      await pending;
      expect(controller.snapshot().status).toBe('live');
      controller.setInput(NEUTRAL_INPUT);
      controller.pump(now);
      const before = controller.getRender()!.frame;
      const tap = { ...NEUTRAL_INPUT, tool: TOOL.hand, secondary: true };
      controller.setInput(tap);
      controller.pump(now += FRAME_MS + 0.01);
      expect(controller.getRender()!.frame).toBeGreaterThan(before);
      expect(controller.sampledInput).toBeNull();
      for (let tick = 0; tick < 5 && controller.sampledInput?.input !== tap; tick++) {
        match.advance(1);
        controller.pump(now += FRAME_MS);
      }
      expect(controller.sampledInput?.input).toBe(tap);
      const sampledFrame = controller.sampledInput!.frame;
      const renderedFrame = controller.getRender()!.frame;
      // A zero-time pump can sample the next input without a simulation step.
      controller.pump(now);
      expect(controller.getRender()!.frame).toBe(renderedFrame);
      if (controller.sampledInput !== null) {
        expect(controller.sampledInput.input).toBe(tap);
        expect(controller.sampledInput.frame).toBeGreaterThan(sampledFrame);
      }
      // The same frontier is now scheduled. This pump must clear the sample.
      controller.pump(now);
      expect(controller.getRender()!.frame).toBe(renderedFrame);
      expect(controller.sampledInput).toBeNull();
    } finally { controller.stop(); }
  });

  it.each([1, 2, 3])('keeps short Push and Cut actions until sampling with %i ticks of input delay', async (delay) => {
    const game = await startRoom(delay);
    const touch = neutralTouchInput();
    try {
      for (let tick = 0; tick < 30; tick++) game.pump(FRAME_MS);
      const target = game.runner.getRenderState()!.poses.get('ballast-box')!.position;
      const ray = quantizeRay([target[0], target[1] + 6, target[2] + 0.001], [0, -1, 0]);
      const beforeThrows = game.runner.getRenderState()!.stats.throws;
      game.setInput(NEUTRAL_INPUT);
      game.pump(0, false);
      queueTouchShot(touch, 'push');
      queueTouchShot(touch, 'push');
      const nextInput = () => ({
        ...NEUTRAL_INPUT, ...ray, tool: TOOL.hand,
        secondary: touch.shots.length > 0 && !touch.secondaryRearm,
      });
      const tap = nextInput();
      game.setInput(tap);
      const beforeFrame = game.runner.getRenderState()!.frame;
      const sample = game.pump(FRAME_MS + 0.01, false);
      expect(game.runner.getRenderState()!.frame).toBeGreaterThan(beforeFrame);
      expect(sample).toBeUndefined();
      expect(touch.shots).toHaveLength(2);
      for (let tick = 0; tick < delay + 12; tick++) {
        const sent = nextInput();
        game.setInput(sent);
        const read = game.pump(FRAME_MS);
        if (read?.input === sent) consumeTouchSample(touch, sent, read.frame);
      }
      expect(touch.shots).toHaveLength(0);
      expect(game.runner.getRenderState()!.stats.throws).toBe(beforeThrows + 2);

      const torchTarget = game.runner.getRenderState()!.poses.get('steel-case')!.position;
      const torchRay = quantizeRay([torchTarget[0], torchTarget[1] + 2, torchTarget[2] + 0.001], [0, -1, 0]);
      const beforeCutFrame = game.runner.getRenderState()!.players[0]!.feedback?.frame ?? -1;
      game.setInput(NEUTRAL_INPUT);
      game.pump(0, false);
      touch.cutQueued = true;
      const cut = { ...NEUTRAL_INPUT, ...torchRay, tool: TOOL.torch, pressed: touchPrimary(touch, TOOL.torch) };
      game.setInput(cut);
      const cutSample = game.pump(FRAME_MS + 0.01, false);
      expect(cutSample).toBeUndefined();
      expect(touch.cutQueued).toBe(true);
      for (let tick = 0; tick < delay + 8; tick++) {
        const sent = { ...cut, pressed: touchPrimary(touch, TOOL.torch) };
        game.setInput(sent);
        const read = game.pump(FRAME_MS);
        if (read?.input === sent) consumeTouchSample(touch, sent, read.frame);
      }
      expect(touch.cutQueued).toBe(false);
      const feedback = game.runner.getRenderState()!.players[0]!.feedback;
      expect(feedback?.result).toBe('cut');
      expect(feedback!.frame).toBeGreaterThan(beforeCutFrame);
    } finally { game.runner.stop(); }
  });

  it.each([1, 2, 3])('drops a canceled Grab before its delayed tick with %i ticks of input delay', async (delay) => {
    const game = await startRoom(delay);
    const touch = neutralTouchInput();
    try {
      for (let tick = 0; tick < 30; tick++) game.pump(FRAME_MS);
      const target = game.runner.getRenderState()!.poses.get('ballast-box')!.position;
      const ray = quantizeRay([target[0], target[1] + 6, target[2] + 0.001], [0, -1, 0]);
      const beforeThrows = game.runner.getRenderState()!.stats.throws;
      setTouchWeapon(touch, { kind: 'grab-pending', afterFeedbackFrame: -1 });
      const grab = { ...NEUTRAL_INPUT, ...ray, tool: TOOL.hand, pressed: true };
      game.setInput(grab);
      const grabSample = game.pump(0, false);
      expect(grabSample?.input).toBe(grab);
      expect(game.runner.getRenderState()!.frame).toBeLessThan(grabSample!.frame + 1);
      expect(game.runner.getRenderState()!.players[0]!.grabbing).toBeNull();
      clearTouchInput(touch);
      expect(touch.dropQueued).toBe(true);
      const drop = { ...NEUTRAL_INPUT, ...ray, tool: TOOL.hand, drop: true };
      game.setInput(drop);
      const dropSample = game.pump(FRAME_MS + 0.01, false) ?? game.pump(0, false);
      expect(dropSample?.input).toBe(drop);
      consumeTouchSample(touch, drop, dropSample!.frame);
      const pendingRender = game.runner.getRenderState()!;
      expect(pendingRender.frame).toBeLessThan(touch.dropUntilFrame!);
      expect(pendingRender.players[0]!.grabbing).toBeNull();
      syncTouchWeapon(touch, pendingRender.frame, pendingRender.players[0]);
      expect(touch.dropQueued).toBe(true);
      for (let tick = 0; tick < delay + 12; tick++) {
        const sent = { ...NEUTRAL_INPUT, ...ray, tool: TOOL.hand, drop: touch.dropQueued };
        game.setInput(sent);
        const read = game.pump(FRAME_MS);
        if (read?.input === sent) consumeTouchSample(touch, sent, read.frame);
        const render = game.runner.getRenderState()!;
        syncTouchWeapon(touch, render.frame, render.players[0]);
      }
      expect(touch.dropQueued).toBe(false);
      expect(game.runner.getRenderState()!.players[0]!.grabbing).toBeNull();
      expect(game.runner.getRenderState()!.stats.throws).toBe(beforeThrows);
    } finally { game.runner.stop(); }
  });
});
