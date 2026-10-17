import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createSimulatedSyncplayMatch, type SimulatedSyncplayMatch, type SimulatedSyncplayTransport } from '@series-inc/rundot-syncplay/testing';
import type { SyncplayRoomTransport } from '@series-inc/rundot-syncplay/browser';
import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../sim/constants';
import { encodeYardInput, NEUTRAL_INPUT } from '../sim/input';
import { yardRoomOptions } from '../sim/session';
import { MatchController, type MatchSnapshot } from './match';

const FRAME_MS = 1000 / TICK_RATE;
const EVIDENCE = new URL('../../test-results/seats/', import.meta.url);
const SEAT_POLICY = { recycleVacatedSeats: true, allowHumanClaimBot: false, onHumanLeave: 'empty' as const, initialBotSlots: [] };

function room(): SimulatedSyncplayMatch {
  return createSimulatedSyncplayMatch({ roomConfig: {
    ...yardRoomOptions(4), playerCount: 4, seed: 73, tickRateHz: TICK_RATE,
    hardToleranceTicks: 4, redundancyWindowTicks: 8,
    neutralInput: encodeYardInput(NEUTRAL_INPUT), seatPolicy: SEAT_POLICY,
  } });
}

async function drain() {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
}

function fixture(match: SimulatedSyncplayMatch, id: string, occupancy: number | null = 1) {
  let raw: SimulatedSyncplayTransport | undefined;
  const transport = async (): Promise<SyncplayRoomTransport> => {
    raw = match.openTransport(id);
    const extra = {
      ...raw, roomCode: 'SEATED', isCreator: id === 'owner',
      onConnectionEvent: () => {}, onOccupancyChange: () => () => {}, setSeatingOpen: () => {},
    };
    // The raw runner transport permits absent occupancy. This tests that boundary.
    // It does not claim that the deployed room transport omits this field.
    if (occupancy === null) return extra as unknown as SyncplayRoomTransport;
    return { ...extra, occupancy: { players: [], occupied: occupancy, maxPlayers: 4, full: occupancy === 4, locked: false } };
  };
  const controller = new MatchController({ createRoomTransport: transport, quickMatchTransport: transport, joinRoomTransport: transport });
  controller.setInput(NEUTRAL_INPUT);
  return { controller, transport: () => { if (!raw) throw new Error('Seat transport is not open.'); return raw; } };
}

type Client = ReturnType<typeof fixture>;
function driver(match: SimulatedSyncplayMatch, clients: Client[]) {
  let now = 0;
  return {
    async pump(ticks: number, authority = true) {
      for (let tick = 0; tick < ticks; tick++) {
        if (authority) match.advance(1); else match.settle(1);
        now += FRAME_MS;
        for (const { controller } of clients) controller.pump(now);
        await drain();
      }
    },
    async start(client: Client, confirm = true) {
      let settled = false;
      const pending = client.controller.start({ kind: 'create' });
      pending.then(() => { settled = true; }, () => { settled = true; });
      for (let tick = 0; tick < 50 && (!settled || (confirm && client.controller.snapshot().status !== 'live')); tick++) await this.pump(1, confirm);
      expect(settled, 'The real SDK runner must complete startup.').toBe(true);
      await pending;
      if (confirm) expect(client.controller.snapshot().status).toBe('live');
    },
  };
}

function observation(client: Client) {
  const snapshot = client.controller.snapshot();
  const render = client.controller.getRender();
  const poses = render ? [...render.poses].sort(([a], [b]) => a.localeCompare(b)) : [];
  return {
    crew: snapshot.crew, status: snapshot.status, localSlot: snapshot.localSlot,
    frame: render?.frame ?? null, avatarSlots: render?.players.length ?? null,
    poseHash: createHash('sha256').update(JSON.stringify(poses)).digest('hex'),
  };
}
async function evidence(name: string, data: unknown) {
  await mkdir(EVIDENCE, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  await writeFile(new URL(`${name}-${stamp}.json`, EVIDENCE), JSON.stringify(data, null, 2));
}

describe('crew seats with the real SDK authority and Yard runtime', () => {
  it('uses transport occupancy until confirmed seat presence is known', async () => {
    const match = room();
    const owner = fixture(match, 'owner');
    const drive = driver(match, [owner]);
    try {
      await drive.start(owner, false);
      const unknownPresence = observation(owner);
      expect(match.room.confirmedThrough).toBe(-1);
      await drive.pump(12);
      const confirmed = observation(owner);
      await evidence('fallback', { unknownPresence, confirmed, authority: match.room.netcodeStats() });
      expect(unknownPresence.crew).toEqual({ occupied: 1, capacity: 4 });
      expect(confirmed.crew).toEqual({ occupied: 1, capacity: 4 });
      expect(confirmed.avatarSlots).toBe(4);
      expect(confirmed.frame).toBeGreaterThan(0);
    } finally { owner.controller.stop(); }
  });

  it('reports unknown occupancy without a metadata fallback before confirmation', async () => {
    const match = room();
    const owner = fixture(match, 'owner', null);
    const drive = driver(match, [owner]);
    try {
      await drive.start(owner, false);
      const unknownPresence = observation(owner);
      expect(match.room.confirmedThrough).toBe(-1);
      await drive.pump(12);
      const confirmed = observation(owner);
      await evidence('unknown', { unknownPresence, confirmed, authority: match.room.netcodeStats() });
      expect(unknownPresence.crew).toEqual({ occupied: null, capacity: 4 });
      expect(confirmed.crew).toEqual({ occupied: 1, capacity: 4 });
    } finally { owner.controller.stop(); }
  });

  it('publishes joins, leaves, reused seats, and occupied substituted inputs', async () => {
    const match = room();
    const owner = fixture(match, 'owner');
    const guest = fixture(match, 'guest', 2);
    const newcomer = fixture(match, 'newcomer', 2);
    const drive = driver(match, [owner, guest, newcomer]);
    const publications: { status: MatchSnapshot['status']; crew: MatchSnapshot['crew'] }[] = [];
    const unsubscribe = owner.controller.subscribe(() => {
      const { status, crew } = owner.controller.snapshot();
      publications.push({ status, crew });
    });
    try {
      await drive.start(owner);
      await drive.pump(12);
      const alone = observation(owner);
      await drive.start(guest);
      await drive.pump(14);
      const joined = observation(owner);
      const guestSlot = guest.controller.snapshot().localSlot;
      guest.controller.stop();
      await drive.pump(14);
      const left = observation(owner);
      await drive.start(newcomer);
      await drive.pump(14);
      const reused = observation(owner);
      const newSlot = newcomer.controller.snapshot().localSlot;
      const beforeLoss = match.room.netcodeStats().substitutedTicksBySlot[newSlot] ?? 0;
      newcomer.transport().uplink.lossRate = 1;
      await drive.pump(16);
      const substituted = observation(owner);
      const stats = match.room.netcodeStats();
      const afterLoss = stats.substitutedTicksBySlot[newSlot] ?? 0;
      const tail = match.room.confirmedTail();
      await evidence('membership', {
        seatPolicy: SEAT_POLICY, alone, joined, left, reused, substituted,
        guestSlot, newSlot, beforeLoss, afterLoss, publications, authority: stats,
        confirmedTailHash: createHash('sha256').update(JSON.stringify(tail)).digest('hex'),
        latestConfirmedFrame: tail.at(-1),
        limits: ['Local simulated authority. This does not prove deployed backend seat policy.'],
      });
      expect(alone.crew).toEqual({ occupied: 1, capacity: 4 });
      expect(joined.crew).toEqual({ occupied: 2, capacity: 4 });
      expect(left.crew).toEqual({ occupied: 1, capacity: 4 });
      expect(newSlot).toBe(guestSlot);
      expect(reused.crew).toEqual({ occupied: 2, capacity: 4 });
      expect(afterLoss).toBeGreaterThan(beforeLoss);
      expect(stats.occupiedSlots).toEqual([0, newSlot]);
      expect(tail.at(-1)?.substitutedSlots).toContain(newSlot);
      expect(substituted.crew).toEqual({ occupied: 2, capacity: 4 });
      expect(publications.some((entry) => entry.status === 'live' && entry.crew?.occupied === 2)).toBe(true);
      const occupiedSequence = publications.filter((entry) => entry.status === 'live').map((entry) => entry.crew?.occupied);
      const firstTwo = occupiedSequence.indexOf(2);
      expect(firstTwo).toBeGreaterThanOrEqual(0);
      expect(occupiedSequence.slice(firstTwo + 1)).toContain(1);
    } finally {
      unsubscribe();
      for (const client of [newcomer, guest, owner]) client.controller.stop();
    }
  });

  it('clears network crew on stop and reports one offline player after restart', async () => {
    const match = room();
    const owner = fixture(match, 'owner');
    const drive = driver(match, [owner]);
    try {
      await drive.start(owner);
      await drive.pump(12);
      const networked = observation(owner);
      owner.controller.stop();
      const stopped = observation(owner);
      await owner.controller.start({ kind: 'solo' });
      for (let tick = 0; tick < 4; tick++) owner.controller.pump(tick * FRAME_MS);
      const solo = observation(owner);
      await evidence('solo-reset', { networked, stopped, solo });
      expect(networked.crew).toEqual({ occupied: 1, capacity: 4 });
      expect(stopped.crew).toEqual({ occupied: null, capacity: 4 });
      expect(solo.crew).toEqual({ occupied: 1, capacity: 1 });
      expect(solo.avatarSlots).toBe(1);
    } finally { owner.controller.stop(); }
  });
});
