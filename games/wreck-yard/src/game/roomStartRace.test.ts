import { mkdir, writeFile } from 'node:fs/promises';
import { createSimulatedSyncplayMatch, type SimulatedSyncplayMatch, type SimulatedSyncplayTransport } from '@series-inc/rundot-syncplay/testing';
import type { SyncplayRoomTransport } from '@series-inc/rundot-syncplay/browser';
import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../sim/constants';
import { encodeYardInput, NEUTRAL_INPUT } from '../sim/input';
import { yardRoomOptions } from '../sim/session';
import { MatchController } from './match';

const FRAME_MS = 1000 / TICK_RATE;
const OUTPUT = new URL('../../test-results/seats/', import.meta.url);

function room() {
  return createSimulatedSyncplayMatch({ roomConfig: {
    ...yardRoomOptions(4), playerCount: 4, seed: 79, tickRateHz: TICK_RATE,
    hardToleranceTicks: 4, redundancyWindowTicks: 8, neutralInput: encodeYardInput(NEUTRAL_INPUT),
  } });
}

function transport(raw: SimulatedSyncplayTransport, code: string): SyncplayRoomTransport {
  return {
    ...raw, roomCode: code, isCreator: true,
    occupancy: { players: [], occupied: 1, maxPlayers: 4, full: false, locked: false },
    onConnectionEvent: () => {}, onOccupancyChange: () => () => {}, setSeatingOpen: () => {},
  };
}

function delayedRoom(match: SimulatedSyncplayMatch) {
  const raw = match.openTransport('stale-owner');
  // Production has joined the room before its transport promise resolves.
  // This registers a real authority seat without constructing a fake client.
  raw.onMessage(() => {});
  const stale = transport(raw, 'STALE');
  let resolve: (value: SyncplayRoomTransport) => void = () => { throw new Error('Transport resolver is not ready.'); };
  const pending = new Promise<SyncplayRoomTransport>((done) => { resolve = done; });
  return { raw, stale, pending, resolve: () => resolve(stale) };
}

async function drain() {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
}

function driver(match: SimulatedSyncplayMatch, controller: MatchController) {
  let now = 0;
  return async (ticks: number) => {
    for (let tick = 0; tick < ticks; tick++) {
      match.advance(1);
      controller.pump(now += FRAME_MS);
      await drain();
    }
  };
}

async function startLive(controller: MatchController, pump: (ticks: number) => Promise<void>) {
  let settled = false;
  const pending = controller.start({ kind: 'create' });
  pending.then(() => { settled = true; }, () => { settled = true; });
  for (let tick = 0; tick < 50 && (!settled || controller.snapshot().status !== 'live'); tick++) await pump(1);
  expect(settled).toBe(true);
  await pending;
  expect(controller.snapshot().status).toBe('live');
}

async function evidence(name: string, value: unknown) {
  await mkdir(OUTPUT, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  await writeFile(new URL(`${name}-${stamp}.json`, OUTPUT), JSON.stringify(value, null, 2));
}

function metadata(controller: MatchController) {
  const { status, roomCode, crew } = controller.snapshot();
  return { status, roomCode, crew, frame: controller.getRender()?.frame ?? null };
}

describe('room startup with the real SDK authority', () => {
  it('closes a delayed room that resolves after stop', async () => {
    const match = room();
    const delayed = delayedRoom(match);
    const deps = { createRoomTransport: () => delayed.pending, quickMatchTransport: () => delayed.pending, joinRoomTransport: () => delayed.pending };
    const controller = new MatchController(deps);
    const pending = controller.start({ kind: 'create' });
    try {
      expect(match.room.netcodeStats().occupiedSlots).toEqual([0]);
      controller.stop();
      const stopped = metadata(controller);
      delayed.resolve();
      await pending;
      await drain();
      const after = metadata(controller);
      const occupiedSlots = match.room.netcodeStats().occupiedSlots;
      await evidence('race-stop', { stopped, after, occupiedSlots });
      expect(after).toEqual(stopped);
      expect(after.status).toBe('idle');
      expect(after.roomCode).toBeNull();
      expect(occupiedSlots).toEqual([]);
    } finally {
      delayed.resolve();
      await pending;
      controller.stop();
      delayed.raw.close();
      await drain();
    }
  });

  it('releases the old room without replacing a live restart', async () => {
    const match = room();
    const delayed = delayedRoom(match);
    let calls = 0;
    const connect = async () => ++calls === 1 ? delayed.pending : transport(match.openTransport('fresh-owner'), 'FRESH');
    const controller = new MatchController({ createRoomTransport: connect, quickMatchTransport: connect, joinRoomTransport: connect });
    const pump = driver(match, controller);
    const codes: (string | null)[] = [];
    const unsubscribe = controller.subscribe(() => { codes.push(controller.snapshot().roomCode); });
    const staleStart = controller.start({ kind: 'create' });
    try {
      expect(match.room.netcodeStats().occupiedSlots).toEqual([0]);
      controller.stop();
      await startLive(controller, pump);
      await pump(8);
      const before = metadata(controller);
      const freshSlot = controller.snapshot().localSlot;
      expect(match.room.netcodeStats().occupiedSlots).toEqual([0, freshSlot]);
      delayed.resolve();
      await staleStart;
      await pump(10);
      const after = metadata(controller);
      const occupiedSlots = match.room.netcodeStats().occupiedSlots;
      await evidence('race-restart', { before, after, freshSlot, occupiedSlots, codes, authority: match.room.netcodeStats(), latestConfirmed: match.room.confirmedTail().at(-1) });
      expect(after.status).toBe('live');
      expect(after.roomCode).toBe('FRESH');
      expect(after.frame).toBeGreaterThan(before.frame!);
      expect(codes).not.toContain('STALE');
      expect(occupiedSlots).toEqual([freshSlot]);
    } finally {
      delayed.resolve();
      await staleStart;
      unsubscribe();
      controller.stop();
      delayed.raw.close();
      await drain();
    }
  });

  it('keeps a real network match running while local pause is requested', async () => {
    const match = room();
    const connect = async () => transport(match.openTransport('pause-owner'), 'PAUSED');
    const controller = new MatchController({ createRoomTransport: connect, quickMatchTransport: connect, joinRoomTransport: connect });
    const pump = driver(match, controller);
    try {
      await startLive(controller, pump);
      await pump(8);
      const before = metadata(controller);
      controller.setPaused(true);
      await pump(12);
      const after = metadata(controller);
      await evidence('network-pause', { before, after, paused: controller.isPaused(), authority: match.room.netcodeStats() });
      expect(controller.isPaused()).toBe(false);
      expect(after.status).toBe('live');
      expect(after.frame).toBeGreaterThan(before.frame!);
      expect(match.room.netcodeStats().occupiedSlots).toEqual([0]);
    } finally { controller.stop(); await drain(); }
  });
});
