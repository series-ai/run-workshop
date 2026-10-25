import { beforeEach, describe, expect, it, vi } from 'vitest';

const browser = vi.hoisted(() => ({
  createSyncplayRoom: vi.fn(),
  joinSyncplayRoomByCode: vi.fn(),
  quickMatchSyncplayRoom: vi.fn(),
}));

vi.mock('@series-inc/rundot-syncplay/browser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@series-inc/rundot-syncplay/browser')>()),
  ...browser,
}));

import RundotAPI from '@series-inc/rundot-game-sdk/api';
import { createRoomTransport, joinRoomTransport, quickMatchTransport } from './rooms';

describe('rooms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a room through the SDK realtime API with yard options', async () => {
    browser.createSyncplayRoom.mockResolvedValue({ roomCode: 'ABC' });
    await expect(createRoomTransport()).resolves.toEqual({ roomCode: 'ABC' });
    expect(browser.createSyncplayRoom).toHaveBeenCalledWith(RundotAPI.realtime, expect.objectContaining({ maxPlayers: 4 }));
  });

  it('quick matches and joins by code', async () => {
    browser.quickMatchSyncplayRoom.mockResolvedValue({ roomCode: 'Q' });
    browser.joinSyncplayRoomByCode.mockResolvedValue({ roomCode: 'J' });
    await expect(quickMatchTransport()).resolves.toEqual({ roomCode: 'Q' });
    await expect(joinRoomTransport('J')).resolves.toEqual({ roomCode: 'J' });
    expect(browser.joinSyncplayRoomByCode).toHaveBeenCalledWith(RundotAPI.realtime, 'J');
  });
});
