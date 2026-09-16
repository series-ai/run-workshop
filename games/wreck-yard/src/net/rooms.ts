import RundotAPI from '@series-inc/rundot-game-sdk/api';
import {
  createSyncplayRoom,
  joinSyncplayRoomByCode,
  quickMatchSyncplayRoom,
  type SyncplayRoomTransport,
} from '@series-inc/rundot-syncplay/browser';
import { MAX_PLAYERS } from '../sim/constants';
import { yardRoomOptions } from '../sim/session';

export async function createRoomTransport(): Promise<SyncplayRoomTransport> {
  return createSyncplayRoom(RundotAPI.realtime, yardRoomOptions(MAX_PLAYERS));
}

export async function quickMatchTransport(): Promise<SyncplayRoomTransport> {
  return quickMatchSyncplayRoom(RundotAPI.realtime, yardRoomOptions(MAX_PLAYERS));
}

export async function joinRoomTransport(code: string): Promise<SyncplayRoomTransport> {
  return joinSyncplayRoomByCode(RundotAPI.realtime, code);
}
