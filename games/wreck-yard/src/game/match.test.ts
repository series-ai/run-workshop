import { createSimulatedSyncplayMatch } from '@series-inc/rundot-syncplay/testing';
import type { SyncplayRoomTransport } from '@series-inc/rundot-syncplay/browser';
import { describe, expect, it, vi } from 'vitest';
import { TICK_RATE } from '../sim/constants';
import { encodeYardInput, NEUTRAL_INPUT, TOOL } from '../sim/input';
import { yardRoomOptions } from '../sim/session';
import { YardSim } from '../sim/sim';
import { MatchController, type MatchDeps } from './match';

function deps(overrides: Partial<MatchDeps> = {}): MatchDeps {
  return {
    createRoomTransport: async () => { throw new Error('no transport in test'); },
    quickMatchTransport: async () => { throw new Error('no transport in test'); },
    joinRoomTransport: async () => { throw new Error('no transport in test'); },
    ...overrides,
  };
}

describe('MatchController', () => {
  it('starts solo play live on slot 0 and advances with wall-clock pumps', async () => {
    const controller = new MatchController(deps());
    await controller.start({ kind: 'solo' });
    expect(controller.snapshot().status).toBe('live');
    expect(controller.snapshot().localSlot).toBe(0);
    controller.setInput({ ...NEUTRAL_INPUT, tool: TOOL.hand });
    for (let i = 0; i <= 30; i += 1) controller.pump(i * 33.4);
    expect(controller.snapshot().render?.frame ?? 0).toBeGreaterThanOrEqual(28);
    controller.stop();
    expect(controller.snapshot().status).toBe('idle');
  });

  it('keeps simulation time when display frames take 50 milliseconds', async () => {
    const controller = new MatchController(deps());
    await controller.start({ kind: 'solo' });
    try {
      controller.setInput(NEUTRAL_INPUT);
      for (let i = 0; i <= 20; i++) controller.pump(i * 50);
      expect(controller.snapshot().render?.frame ?? 0).toBeGreaterThanOrEqual(28);
    } finally { controller.stop(); }
  });

  it('shows a failed step as an error status, and rethrows it', async () => {
    const controller = new MatchController(deps());
    await controller.start({ kind: 'solo' });
    const step = vi.spyOn(YardSim.prototype, 'step').mockImplementation(() => {
      throw new Error('WRECK_YARD_TEST_STEP_FAILED');
    });
    try {
      expect(() => {
        for (let i = 0; i <= 3; i += 1) controller.pump(i * 34);
      }).toThrow();
      expect(controller.snapshot().status).toBe('error');
      expect(controller.snapshot().error).toContain('WRECK_YARD_TEST_STEP_FAILED');
    } finally {
      step.mockRestore();
      controller.stop();
    }
  });

  it('holds a paused solo match still, and resumes with no burst of frames', async () => {
    const controller = new MatchController(deps());
    await controller.start({ kind: 'solo' });
    try {
      controller.setInput(NEUTRAL_INPUT);
      for (let i = 0; i <= 10; i += 1) controller.pump(i * 33.4);
      const before = controller.snapshot().render!.frame;
      controller.setPaused(true);
      expect(controller.isPaused()).toBe(true);
      for (let i = 11; i <= 100; i += 1) controller.pump(i * 33.4);
      expect(controller.snapshot().render!.frame).toBe(before);
      controller.setPaused(false);
      // Three seconds passed while paused; the first pump after resume must not catch up.
      controller.pump(101 * 33.4);
      controller.pump(102 * 33.4);
      expect(controller.snapshot().render!.frame - before).toBeLessThanOrEqual(1);
    } finally { controller.stop(); }
  });

  it('clears the pause on a new start, and never pauses a room', async () => {
    const controller = new MatchController(deps({ joinRoomTransport: () => new Promise(() => { /* never connects */ }) }));
    await controller.start({ kind: 'solo' });
    controller.setPaused(true);
    await controller.start({ kind: 'solo' });
    expect(controller.isPaused()).toBe(false);
    void controller.start({ kind: 'join', code: 'ROOM' });
    controller.setPaused(true);
    expect(controller.isPaused()).toBe(false);
    controller.stop();
  });

  it('surfaces a rejected transport as an error with the message', async () => {
    const controller = new MatchController(deps({ createRoomTransport: async () => { throw new Error('room rejected'); } }));
    await controller.start({ kind: 'create' });
    expect(controller.snapshot().status).toBe('error');
    expect(controller.snapshot().error).toBe('room rejected');
    expect(controller.snapshot().errorDetails?.isServerError).toBe(true);
    expect(controller.snapshot().errorDetails?.title).toBe('Multiplayer Connection Failed');
  });

  it('surfaces runner start-aborted errors with helpful multiplayer server details', async () => {
    const abortErr = new Error('Runner start was aborted. Start the runner again when the required resources are available.');
    Object.assign(abortErr, { code: 'runner.start-aborted' });
    const controller = new MatchController(deps({ quickMatchTransport: async () => { throw abortErr; } }));
    await controller.start({ kind: 'quick' });
    expect(controller.snapshot().status).toBe('error');
    expect(controller.snapshot().error).toContain('Runner start was aborted');
    expect(controller.snapshot().errorDetails?.isServerError).toBe(true);
    expect(controller.snapshot().errorDetails?.title).toBe('Multiplayer Server Unavailable');
    expect(controller.snapshot().errorDetails?.message).toContain('retry or create a new room');
  });

  it('allows dismissing errors and resets state to idle', async () => {
    const controller = new MatchController(deps({ createRoomTransport: async () => { throw new Error('room rejected'); } }));
    await controller.start({ kind: 'create' });
    expect(controller.snapshot().status).toBe('error');
    controller.dismissError();
    expect(controller.snapshot().status).toBe('idle');
    expect(controller.snapshot().error).toBeNull();
    expect(controller.snapshot().errorDetails).toBeNull();
  });

  it('does not let an aborted earlier start overwrite a newer start', async () => {
    let rejectFirst!: () => void;
    const controller = new MatchController(deps({
      quickMatchTransport: () => new Promise((_, reject) => {
        rejectFirst = () => reject(new Error('Runner start was aborted.'));
      }),
    }));

    const first = controller.start({ kind: 'quick' });
    const second = controller.start({ kind: 'solo' });
    rejectFirst();
    await Promise.all([first, second]);

    expect(controller.snapshot().status).toBe('live');
    expect(controller.snapshot().error).toBeNull();
    controller.stop();
  });

  it('stays live across multi-tick authority bursts instead of bouncing back to connecting', async () => {
    const match = createSimulatedSyncplayMatch({
      roomConfig: {
        ...yardRoomOptions(4),
        playerCount: 4,
        seed: 73,
        tickRateHz: TICK_RATE,
        hardToleranceTicks: 2,
        redundancyWindowTicks: 8,
        neutralInput: encodeYardInput(NEUTRAL_INPUT),
      },
    });
    let reconnectingHandler: (() => void) | undefined;
    const transport = async (): Promise<SyncplayRoomTransport> => {
      const raw = match.openTransport('owner');
      return {
        ...raw,
        roomCode: 'STABLE',
        isCreator: true,
        occupancy: { players: [], occupied: 1, maxPlayers: 4, full: false, locked: false },
        onConnectionEvent: (handler) => {
          reconnectingHandler = () => handler({ kind: 'reconnecting' });
        },
        onOccupancyChange: () => () => {},
        setSeatingOpen: () => {},
        reportSettlement: () => {},
        onSettlementRejected: () => () => {},
      };
    };
    const controller = new MatchController(deps({ createRoomTransport: transport }));
    try {
      const pending = controller.start({ kind: 'create' });
      let now = 0;
      for (let i = 0; i < 10; i += 1) {
        match.advance(1);
        now += 1000 / TICK_RATE;
        controller.pump(now);
        await Promise.resolve();
      }
      await pending;
      expect(controller.snapshot().status).toBe('live');

      // Simulate a frame hiccup / transport reconnect catch-up where the runner enters 'syncing'.
      reconnectingHandler?.();
      expect(controller.snapshot().status).toBe('live');
      match.advance(8);
      now += 1000 / TICK_RATE;
      controller.pump(now);
      expect(controller.snapshot().status).toBe('live');
    } finally {
      controller.stop();
    }
  });
});
