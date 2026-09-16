import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, TOOL } from '../sim/input';
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
    expect(controller.snapshot().errorDetails?.message).toContain('Solo mode');
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
});
