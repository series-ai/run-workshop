import type { KinetixSeatState } from '@series-inc/rundot-syncplay/core/runtime';
import { describe, expect, it } from 'vitest';
import { ELEVATOR, STORAGE } from './attractions';
import { decodeState, encodeState } from './codec';
import { FLOOR_Y, PLAYER_HEIGHT, PLAYER_RADIUS, TICK_RATE } from './constants';
import { NEUTRAL_INPUT, TOOL, quantizeRay, type YardInput } from './input';
import { physicsBodyById, physicsStateBodyById, replacePhysicsPose } from './physics';
import { YardSim } from './sim';
import { PLAYER_SPAWN_POINTS, type PlayerState } from './state';
import { patchPlayer, patchState, testSim } from './testSim';

function seat(slot: number, kind: KinetixSeatState['kind'] = 'human', controlEpoch = 1,
  flags: Partial<Pick<KinetixSeatState, 'substituted' | 'connection'>> = {}): KinetixSeatState {
  return { slot, kind, controlEpoch, owner: kind === 'empty' ? null : `seat-${slot}`,
    claimId: kind === 'empty' ? null : `claim-${slot}`, substituted: false,
    connection: kind === 'empty' ? 'disconnected' : 'connected', ...flags };
}

function inputs(count: number, selected = NEUTRAL_INPUT, slot = 0): YardInput[] {
  return Array.from({ length: count }, (_, index) => index === slot ? selected : NEUTRAL_INPUT);
}

function checksum(sim: YardSim): Uint8Array {
  const save = sim.save();
  try { return sim.checksumBytes(save); }
  finally { sim.release(save); }
}

function aimAt(sim: YardSim, id: string): YardInput {
  const body = physicsStateBodyById(sim.state.world, id)!;
  return { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true,
    ...quantizeRay([body.x, body.y + 6, body.z + 0.001], [0, -6, -0.001]) };
}

describe('player seats in the real native yard', () => {
  it('keeps direct and solo fixtures active when seat metadata is absent', () => {
    const sim = testSim(4);
    expect(sim.state.players.map(player => [player.active, player.controlEpoch]))
      .toEqual([[true, null], [true, null], [true, null], [true, null]]);
    for (let tick = 0; tick < 4; tick++) sim.step(inputs(4, { ...NEUTRAL_INPUT, jetpack: true }, 2), []);
    expect(sim.state.players).toHaveLength(4);
    expect(sim.state.players[2]!.fuel).toBeLessThan(100);
    expect(sim.state.players.every(player => player.active && player.controlEpoch === null)).toBe(true);
  });

  it('uses seat slot IDs with reordered metadata and keeps empty and bot slots inert', () => {
    const sim = testSim(4);
    const roster = [seat(3, 'human', 7, { substituted: true, connection: 'disconnected' }),
      seat(1, 'empty', 2), seat(0, 'human', 4), seat(2, 'bot', 6)];
    const fire = { ...NEUTRAL_INPUT, jetpack: true, moveX: 1, moveZ: 1, tool: TOOL.torch,
      pressed: true, secondary: true, use: true, attraction: 4 as const, attractionRequest: 1 };
    const commands = [NEUTRAL_INPUT, fire, fire, { ...NEUTRAL_INPUT, jetpack: true }];
    sim.step(commands, roster);
    const empty = sim.state.players[1]!;
    const bot = sim.state.players[2]!;
    for (let tick = 0; tick < 5; tick++) sim.step(commands, roster);
    expect(sim.state.players.map(player => player.active)).toEqual([true, false, false, true]);
    expect(sim.state.players.map(player => player.controlEpoch)).toEqual([4, 2, 6, 7]);
    expect(sim.state.players[1]).toEqual(empty);
    expect(sim.state.players[2]).toEqual(bot);
    expect(sim.state.players[3]!.fuel).toBeLessThan(100);
    expect(sim.state.players[1]!.fuel).toBe(100);
    expect(sim.state.players[2]!.fuel).toBe(100);
    expect(sim.state.stats.torchCuts).toBe(0);
  });

  it.each([
    { name: 'missing slot', roster: [seat(0)] },
    { name: 'duplicate slot', roster: [seat(0), seat(0)] },
    { name: 'out-of-range slot', roster: [seat(0), seat(2)] },
  ])('rejects a nonempty roster with $name before changing the world', ({ roster }) => {
    const sim = testSim(2);
    const before = sim.state;
    const digest = sim.physics.world.digest();
    const revision = sim.revision;
    expect(() => sim.step(inputs(2), roster)).toThrow();
    expect(sim.state).toBe(before);
    expect(sim.revision).toBe(revision);
    expect(sim.physics.world.digest()).toBe(digest);
  });

  it('preserves the same human epoch during input substitution and a retained disconnect', () => {
    const sim = testSim();
    sim.step([NEUTRAL_INPUT], [seat(0, 'human', 3)]);
    patchPlayer(sim, { x: 8, y: 5, z: 4, fuel: 33, vx: 0, vy: 0, vz: 0 });
    const save = sim.save();
    try {
      sim.step([NEUTRAL_INPUT], [seat(0, 'human', 3)]);
      const expected = checksum(sim);
      const expectedPlayer = sim.state.players[0];
      sim.restore(save);
      sim.step([NEUTRAL_INPUT], [seat(0, 'human', 3, { substituted: true, connection: 'disconnected' })]);
      expect(checksum(sim)).toEqual(expected);
      expect(sim.state.players[0]).toEqual(expectedPlayer);
      expect(sim.state.players[0]!.active).toBe(true);
      expect(sim.state.players[0]!.controlEpoch).toBe(3);
      expect(sim.state.players[0]!.x).toBeGreaterThan(6);
      expect(sim.state.players[0]!.fuel).toBeLessThan(90);
    } finally { sim.release(save); }
  });

  it('starts a new control epoch at the slot spawn and preserves later ticks of that epoch', () => {
    const sim = testSim(2);
    sim.step(inputs(2), [seat(0), seat(1, 'empty', 1)]);
    patchPlayer(sim, { x: 20, y: 10, z: 20, fuel: 17, yaw: 1, pitch: 0.4,
      ridingVehicle: true, jetpackActive: true, wasPressed: true, wasUsePressed: true }, 1);
    sim.step(inputs(2), [seat(0), seat(1, 'human', 2)]);
    const joined = sim.state.players[1]!;
    expect(joined.active).toBe(true);
    expect(joined.controlEpoch).toBe(2);
    expect(joined.x).toBeCloseTo(PLAYER_SPAWN_POINTS[1]![0], 7);
    expect(joined.z).toBeCloseTo(PLAYER_SPAWN_POINTS[1]![2], 7);
    expect(joined.fuel).toBe(100);
    expect(joined.ridingVehicle).toBeFalsy();
    expect(joined.grab).toBeNull();
    expect(joined.torch).toBeNull();
    patchPlayer(sim, { x: 8, y: 5, z: 4, fuel: 23, vx: 0, vy: 0, vz: 0 }, 1);
    sim.step(inputs(2), [seat(0), seat(1, 'human', 2)]);
    expect(sim.state.players[1]!.x).toBeGreaterThan(6);
    expect(sim.state.players[1]!.fuel).toBeLessThan(90);
    sim.step(inputs(2), [seat(0), seat(1, 'human', 3)]);
    expect(sim.state.players[1]!.x).toBeCloseTo(PLAYER_SPAWN_POINTS[1]![0], 7);
    expect(sim.state.players[1]!.fuel).toBe(100);
    expect(sim.state.players[1]!.controlEpoch).toBe(3);
  });

  it('releases a vacated grab without a throw or an extra native impulse', () => {
    const sim = testSim();
    const occupied = [seat(0, 'human', 5)];
    sim.step([NEUTRAL_INPUT], occupied);
    const hold = aimAt(sim, 'ballast-box');
    sim.step([hold], occupied);
    expect(sim.state.players[0]!.grab?.bodyId).toBe('ballast-box');
    const save = sim.save();
    try {
      sim.step([hold], [seat(0, 'empty', 6)]);
      const vacant = sim.state.players[0]!;
      const nativeDigest = sim.physics.world.digest();
      expect(vacant.active).toBe(false);
      expect(vacant.grab).toBeNull();
      expect(vacant.torch).toBeNull();
      expect(vacant.ridingVehicle).toBeFalsy();
      expect(sim.state.stats.throws).toBe(save.state.stats.throws);
      sim.restore(save);
      sim.step([{ ...hold, drop: true }], occupied);
      expect(sim.physics.world.digest()).toBe(nativeDigest);
    } finally { sim.release(save); }
  });

  it('stops a vacated torch before its scheduled pulse can carve', () => {
    const sim = testSim();
    const occupied = [seat(0)];
    sim.step([NEUTRAL_INPUT], occupied);
    const target = physicsStateBodyById(sim.state.world, 'shipping-storage-32')!;
    const fire = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true,
      ...quantizeRay([target.x, target.y, target.z + 2], [0, 0, -1]) };
    for (let tick = 0; tick < 2; tick++) sim.step([fire], occupied);
    expect(sim.state.stats.torchCuts).toBe(0);
    expect(sim.state.players[0]!.torch).not.toBeNull();
    const cuts = sim.state.stats.torchCuts;
    for (let tick = 0; tick < 8; tick++) sim.step([fire], [seat(0, 'empty', 2)]);
    expect(sim.state.players[0]!.active).toBe(false);
    expect(sim.state.players[0]!.torch).toBeNull();
    expect(sim.state.players[0]!.torchTicks).toBe(0);
    expect(sim.state.stats.torchCuts).toBe(cuts);
  });

  it('lets another human mount after the driver seat becomes empty', () => {
    const sim = testSim(2);
    const occupied = [seat(0), seat(1)];
    sim.step(inputs(2), occupied);
    let buggy = physicsBodyById(sim.physics, 'vehicle-chassis')!;
    patchPlayer(sim, { x: buggy.x + 1.2, y: buggy.y + 0.5, z: buggy.z, ridingVehicle: false });
    sim.step(inputs(2, { ...NEUTRAL_INPUT, use: true }), occupied);
    expect(sim.state.players[0]!.ridingVehicle).toBe(true);
    sim.step(inputs(2), [seat(0, 'empty', 2), seat(1)]);
    expect(sim.state.players[0]!.active).toBe(false);
    expect(sim.state.players[0]!.ridingVehicle).toBeFalsy();
    buggy = physicsBodyById(sim.physics, 'vehicle-chassis')!;
    patchPlayer(sim, { x: buggy.x + 1.2, y: buggy.y + 0.5, z: buggy.z, ridingVehicle: false }, 1);
    sim.step(inputs(2, { ...NEUTRAL_INPUT, use: true }, 1), [seat(0, 'empty', 2), seat(1)]);
    expect(sim.state.players[1]!.ridingVehicle).toBe(true);
  });

  it('ignores an inactive player inside the storage reset volume', () => {
    const sim = testSim(2);
    sim.step(inputs(2), [seat(0), seat(1, 'empty', 2)]);
    patchPlayer(sim, { x: ELEVATOR.resetButton[0], y: FLOOR_Y + PLAYER_RADIUS,
      z: ELEVATOR.resetButton[2] + 0.8, vx: 0, vy: 0, vz: 0 });
    patchPlayer(sim, { x: STORAGE.center[0], y: FLOOR_Y + PLAYER_RADIUS,
      z: STORAGE.center[2], vx: 0, vy: 0, vz: 0 }, 1);
    const count = sim.state.bodies.filter(body => body.storageBay === 'storage').length;
    sim.step(inputs(2, { ...NEUTRAL_INPUT, attraction: 5, attractionRequest: 1 }),
      [seat(0), seat(1, 'empty', 2)]);
    expect(sim.state.attractions.resetStatus).toBe('ready');
    expect(sim.state.attractions.resetFrame).toBe(sim.state.frame);
    expect(sim.state.bodies.filter(body => body.storageBay === 'storage')).toHaveLength(count);
    expect(sim.state.players[1]!.active).toBe(false);
  });

  it('does not stop the elevator for an inactive player below its car', () => {
    const sim = testSim(2);
    sim.step(inputs(2), [seat(0), seat(1, 'empty', 2)]);
    const top = FLOOR_Y + PLAYER_HEIGHT + ELEVATOR.size[1] + 0.04;
    sim.edit(physics => replacePhysicsPose(physics, ELEVATOR.id,
      { y: top - ELEVATOR.size[1] / 2, vx: 0, vy: -ELEVATOR.speed / TICK_RATE, vz: 0 }));
    patchState(sim, state => ({ ...state, attractions: { ...state.attractions,
      elevator: { y: top, velocity: -ELEVATOR.speed, target: 0, status: 'moving' } } }));
    patchPlayer(sim, { x: ELEVATOR.x, y: FLOOR_Y + PLAYER_RADIUS + 0.01,
      z: ELEVATOR.z, vx: 0, vy: 0, vz: 0, grounded: true }, 1);
    sim.step(inputs(2), [seat(0), seat(1, 'empty', 2)]);
    expect(sim.state.attractions.elevator.status).toBe('moving');
    expect(sim.state.attractions.elevator.y).toBeLessThan(top);
    expect(sim.state.players[1]!.y).toBe(FLOOR_Y + PLAYER_RADIUS + 0.01);
  });

  it('restores seat flags and replays ownership changes through both checkpoint forms', () => {
    const sim = testSim(2);
    sim.step(inputs(2), [seat(0, 'human', 3), seat(1, 'human', 3)]);
    const save = sim.save();
    const hydrated = YardSim.decode(sim.encode(save));
    const roster = [
      [seat(0, 'human', 3), seat(1, 'empty', 4)],
      [seat(0, 'human', 3), seat(1, 'human', 5)],
      [seat(0, 'human', 3), seat(1, 'human', 5, { substituted: true, connection: 'disconnected' })],
      [seat(0, 'human', 3), seat(1, 'bot', 6)],
    ];
    const advance = () => roster.map(seats => {
      sim.step(inputs(2, { ...NEUTRAL_INPUT, moveZ: 1 }, 1), seats);
      return { players: sim.state.players, native: sim.physics.world.digest(), checksum: checksum(sim) };
    });
    try {
      expect(hydrated.state.players.map(player => [player.active, player.controlEpoch]))
        .toEqual([[true, 3], [true, 3]]);
      const expected = advance();
      expect(expected.map(row => row.players[1]!.active)).toEqual([false, true, true, false]);
      for (const checkpoint of [save, hydrated]) {
        sim.restore(checkpoint);
        expect(sim.state.players).toEqual(save.state.players);
        expect(advance()).toEqual(expected);
      }
    } finally { sim.release(hydrated); sim.release(save); }
  });

  it.each([
    { field: 'active', value: undefined }, { field: 'active', value: 'false' },
    { field: 'controlEpoch', value: undefined }, { field: 'controlEpoch', value: -1 },
    { field: 'controlEpoch', value: 0.5 }, { field: 'controlEpoch', value: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid saved $field=$value', ({ field, value }) => {
    const sim = testSim();
    const save = sim.save();
    try {
      const { checkpoint } = decodeState(sim.encode(save));
      const player: Record<string, unknown> = { ...save.state.players[0]! };
      if (value === undefined) delete player[field];
      else player[field] = value;
      const bytes = encodeState({ checkpoint, state: { ...save.state,
        players: [player] as unknown as readonly PlayerState[] } });
      expect(() => YardSim.decode(bytes)).toThrow('WRECK_YARD_STATE_BYTES_INVALID');
    } finally { sim.release(save); }
  });
});
