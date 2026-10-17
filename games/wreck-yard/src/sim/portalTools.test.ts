import { describe, expect, it } from 'vitest';
import { meters } from '@series-inc/rundot-syncplay/physics/3d';
import { FLOOR_Y, PLAYER_EYE_OFFSET, PLAYER_RADIUS } from './constants';
import { LIGHT_FACES } from './crateArt';
import { NEUTRAL_INPUT, TOOL, quantizeRay, type YardInput } from './input';
import { addPhysicsBodies, makePhysicsBody, physicsBodyById, physicsStateBodyById, replacePhysicsPose } from './physics';
import { RETURNS_PAIR } from './returns';
import type { YardBody } from './state';
import { patchPlayer, patchState, testSim } from './testSim';
import type { Vec3 } from './math';
import type { YardSim } from './sim';

const TARGET = 'portal-tool-target';
type Side = 'A' | 'B';
type Placement = 'linked' | 'behind' | 'before' | 'outside';

function fixture(side: Side, placement: Placement, face: 'front' | 'back' = 'front') {
  const sim = testSim();
  const entry = side === 'A' ? RETURNS_PAIR.portalA : RETURNS_PAIR.portalB;
  const exit = side === 'A' ? RETURNS_PAIR.portalB : RETURNS_PAIR.portalA;
  const direction = (side === 'A' ? 1 : -1) * (face === 'front' ? 1 : -1);
  const xOffset = placement === 'outside' ? -3.3 : 0;
  const eyeY = FLOOR_Y + PLAYER_RADIUS + PLAYER_EYE_OFFSET;
  const origin: Vec3 = [entry.position.x + xOffset, eyeY, entry.position.z - direction * 2.7];
  const position: Vec3 = placement === 'linked'
    ? [exit.position.x, eyeY, exit.position.z + direction * .8]
    : [entry.position.x + xOffset, eyeY, entry.position.z + direction * (placement === 'before' ? -1.3 : .8)];
  const body: YardBody = { id: TARGET, label: 'Portal tool target', material: 'wood',
    dims: { x: 12, y: 12, z: 12 }, voxels: new Uint8Array(12 ** 3).fill(2),
    motion: 'dynamic', buoyancy: .2, anchorFaces: [], impactCooldownUntil: 0, heat: null,
    renderModel: 'shipping-crate', storageBay: 'returns', crateFaces: LIGHT_FACES };
  sim.edit(physics => addPhysicsBodies(physics, [makePhysicsBody(body, {
    position, rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0],
  })]));
  patchState(sim, state => ({ ...state, bodies: [...state.bodies, body] }));
  patchPlayer(sim, { x: origin[0], y: origin[1] - PLAYER_EYE_OFFSET, z: origin[2],
    vx: 0, vy: 0, vz: 0, grounded: true });
  const input: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true,
    ...quantizeRay(origin, [0, 0, direction]) };
  return { sim, body, entry, direction, origin, position, input };
}

function blockedHoldWithoutImpulse(sim: YardSim, input: YardInput): void {
  const save = sim.save();
  try {
    sim.step([input]);
    const actual = physicsBodyById(sim.physics, TARGET)!;
    expect(sim.state.players[0]!.grab).toBeNull();
    expect(sim.state.players[0]!.feedback?.result).toBe('blocked');
    expect(sim.state.stats.throws).toBe(save.state.stats.throws);
    sim.restore(save);
    sim.step([{ ...input, drop: true }]);
    const control = physicsBodyById(sim.physics, TARGET)!;
    for (const field of ['vx', 'vy', 'vz', 'x', 'y', 'z'] as const) expect(actual[field], field).toBeCloseTo(control[field], 8);
  } finally { sim.release(save); }
}

describe('tool rays stop at open portal apertures', () => {
  it('blocks a grab through A toward its real linked target', () => {
    const { sim, origin, direction, input } = fixture('A', 'linked');
    const linked = sim.physics.world.raycast({ x: meters(origin[0]), y: meters(origin[1]), z: meters(origin[2]),
      dx: 0, dy: 0, dz: direction, maxDistance: meters(8), maxPortalDepth: 1 });
    expect(linked[0]?.bodyKey).toContain(TARGET);
    sim.step([input]);
    expect(sim.state.players[0]!.grab).toBeNull();
    expect(sim.state.players[0]!.feedback?.result).toBe('blocked');
    expect(sim.state.stats.throws).toBe(0);
    expect(physicsBodyById(sim.physics, TARGET)!.vz).toBe(0);
  });

  for (const side of ['A', 'B'] as const) {
    for (const [placement, face] of [['linked', 'front'], ['behind', 'front'], ['behind', 'back']] as const) {
      it.each(['grab', 'punt', 'torch'] as const)(`blocks %s at ${side} ${face}, target=${placement}`, action => {
        const { sim, body, entry, origin, direction, input } = fixture(side, placement, face);
        const hits = sim.physics.world.raycast({ x: meters(origin[0]), y: meters(origin[1]), z: meters(origin[2]),
          dx: 0, dy: 0, dz: direction, maxDistance: meters(8), maxPortalDepth: placement === 'linked' ? 1 : 0 });
        expect(hits[0]?.bodyKey).toContain(TARGET);
        const fire = { ...input, tool: action === 'torch' ? TOOL.torch : TOOL.hand,
          pressed: action !== 'punt', secondary: action === 'punt' };
        for (let tick = 0; tick < (action === 'torch' ? 3 : 1); tick++) sim.step([fire]);
        const player = sim.state.players[0]!;
        expect(player.grab).toBeNull();
        expect(sim.state.stats.throws).toBe(0);
        expect(sim.state.stats.torchCuts).toBe(0);
        const remaining = sim.state.bodies.find(candidate => candidate.id === TARGET)!;
        expect(remaining.voxels).toEqual(body.voxels);
        expect(remaining.heat).toBeNull();
        expect(player.feedback?.point[2]).toBeCloseTo(entry.position.z, 5);
        if (action !== 'torch') expect(player.feedback?.result).toBe('blocked');
        expect(Math.abs(physicsBodyById(sim.physics, TARGET)!.vz)).toBeLessThan(.001);
      });
    }

    for (const placement of ['before', 'outside'] as const) {
      it.each(['grab', 'punt', 'torch'] as const)(`keeps %s usable ${placement} ${side}`, action => {
        const { sim, input } = fixture(side, placement);
        const fire = { ...input, tool: action === 'torch' ? TOOL.torch : TOOL.hand,
          pressed: action !== 'punt', secondary: action === 'punt' };
        for (let tick = 0; tick < (action === 'torch' ? 3 : 1); tick++) sim.step([fire]);
        if (action === 'grab') expect(sim.state.players[0]!.grab?.bodyId).toBe(TARGET);
        else if (action === 'punt') expect(sim.state.stats.throws).toBe(1);
        else expect(sim.state.stats.torchCuts).toBe(1);
      });
    }

    it.each(['held', 'released', 'secondary'] as const)(`drops a held body beyond ${side} without a %s impulse`, action => {
      const { sim, entry, direction, origin, input } = fixture(side, 'before');
      sim.step([input]);
      expect(sim.state.players[0]!.grab?.bodyId).toBe(TARGET);
      sim.edit(physics => replacePhysicsPose(physics, TARGET, {
        x: entry.position.x, y: origin[1], z: entry.position.z + direction * .8,
        vx: .04, vy: 0, vz: direction * .1,
      }));
      const save = sim.save();
      try {
        const beforeThrows = sim.state.stats.throws;
        sim.step([{ ...input, pressed: action !== 'released', secondary: action === 'secondary' }]);
        const player = sim.state.players[0]!;
        const actual = physicsBodyById(sim.physics, TARGET)!;
        const throws = sim.state.stats.throws;
        sim.restore(save);
        sim.step([{ ...input, drop: true }]);
        const control = physicsBodyById(sim.physics, TARGET)!;
        expect(player.grab).toBeNull();
        expect(player.feedback?.result).toBe('blocked');
        expect(throws).toBe(beforeThrows);
        for (const field of ['vx', 'vy', 'vz', 'x', 'y', 'z'] as const) expect(actual[field], field).toBeCloseTo(control[field], 8);
      } finally { sim.release(save); }
    });

    it(`drops a near-side hold before its desired point crosses ${side}`, () => {
      const { sim, origin, position, direction, input, entry } = fixture(side, 'before');
      const from: Vec3 = [origin[0] - 3.3, origin[1], origin[2]];
      patchPlayer(sim, { x: from[0] });
      const acquire = { ...input, ...quantizeRay(from, [position[0] - from[0], 0, position[2] - from[2]]) };
      sim.step([acquire]);
      const grab = sim.state.players[0]!.grab;
      expect(grab?.bodyId).toBe(TARGET);
      expect(grab!.distance).toBeGreaterThan(Math.hypot(1, 2.9) * 2.7 / 2.9);
      expect((physicsBodyById(sim.physics, TARGET)!.z - entry.position.z) * direction).toBeLessThan(0);
      const aimAcross = { ...input, ...quantizeRay(from, [1, 0, direction * 2.9]) };
      const save = sim.save();
      try {
        sim.step([aimAcross]);
        const player = sim.state.players[0]!;
        const actual = physicsBodyById(sim.physics, TARGET)!;
        const throws = sim.state.stats.throws;
        sim.restore(save);
        sim.step([{ ...aimAcross, drop: true }]);
        const control = physicsBodyById(sim.physics, TARGET)!;
        expect(player.grab).toBeNull();
        expect(player.feedback?.result).toBe('blocked');
        expect(throws).toBe(save.state.stats.throws);
        for (const field of ['vx', 'vy', 'vz', 'x', 'y', 'z'] as const) expect(actual[field], field).toBeCloseTo(control[field], 8);
      } finally { sim.release(save); }
    });

    it.each(['release', 'secondary'] as const)(`detaches a held crate after native crossing ${side}, then %s adds no boost`, action => {
      const { sim, entry, direction, origin, input } = fixture(side, 'before');
      const exit = side === 'A' ? RETURNS_PAIR.portalB : RETURNS_PAIR.portalA;
      sim.step([input]);
      expect(sim.state.players[0]!.grab?.bodyId).toBe(TARGET);
      sim.edit(physics => replacePhysicsPose(physics, TARGET, {
        x: entry.position.x, y: origin[1], z: entry.position.z - direction * .6,
        vx: 0, vy: 0, vz: direction * 2,
      }));
      const counter = physicsStateBodyById(sim.state.world, TARGET)!.teleportCounter!;
      const saved = sim.save();
      try {
        const cross = () => {
          sim.step([input]);
          const body = physicsBodyById(sim.physics, TARGET)!;
          expect(sim.physics.world.latest().portalCrossings?.some(row => row.bodyId === sim.physics.bodyIds.get(TARGET))).toBe(true);
          expect(physicsStateBodyById(sim.state.world, TARGET)!.teleportCounter).toBe(counter + 1);
          expect(body.x).toBeCloseTo(exit.position.x, 2);
          expect(sim.state.players[0]!.grab).toBeNull();
          expect(sim.state.players[0]!.feedback?.result).toBe('blocked');
          expect(sim.state.stats.throws).toBe(0);
          return { body, player: sim.state.players[0], digest: sim.physics.world.digest() };
        };
        const expected = cross();
        sim.restore(saved);
        expect(cross()).toEqual(expected);
        const afterCrossing = sim.save();
        try {
          sim.step([{ ...input, pressed: false, secondary: action === 'secondary' }]);
          const actual = physicsBodyById(sim.physics, TARGET)!;
          expect(sim.state.players[0]!.grab).toBeNull();
          expect(sim.state.stats.throws).toBe(0);
          sim.restore(afterCrossing);
          sim.step([{ ...input, drop: true }]);
          const control = physicsBodyById(sim.physics, TARGET)!;
          for (const field of ['vx', 'vy', 'vz', 'x', 'y', 'z'] as const) expect(actual[field], field).toBeCloseTo(control[field], 8);
        } finally { sim.release(afterCrossing); }
      } finally { sim.release(saved); }
    });

    it(`keeps ordinary grab rays usable when ${side} is closed`, () => {
      const { sim, input } = fixture(side, 'behind');
      sim.edit(physics => physics.world.edit(ops => ops.setPortalOpen({ id: RETURNS_PAIR.id }, false)));
      sim.step([input]);
      expect(sim.state.players[0]!.grab?.bodyId).toBe(TARGET);
    });

    it(`keeps a grab ray parallel to ${side} usable`, () => {
      const { sim, input, position } = fixture(side, 'before');
      const from: Vec3 = [position[0] - 2, position[1], position[2]];
      patchPlayer(sim, { x: from[0], z: from[2] });
      sim.step([{ ...input, ...quantizeRay(from, [1, 0, 0]) }]);
      expect(sim.state.players[0]!.grab?.bodyId).toBe(TARGET);
    });

    it(`stops saved hold-point inertia from crossing ${side}`, () => {
      const { sim, input, origin, entry, direction } = fixture(side, 'before');
      sim.step([input]);
      const grab = sim.state.players[0]!.grab!;
      expect(grab.bodyId).toBe(TARGET);
      sim.edit(physics => replacePhysicsPose(physics, TARGET, {
        x: entry.position.x, y: origin[1], z: entry.position.z - direction * .1,
        vx: 0, vy: 0, vz: 0,
      }));
      patchPlayer(sim, { grab: { ...grab, distance: 2.5,
        target: [entry.position.x, origin[1], entry.position.z - direction * .05],
        targetVelocity: [0, 0, direction * .1] } });
      blockedHoldWithoutImpulse(sim, input);
    });

    it(`blocks a floor-clamped hold point beyond ${side}`, () => {
      const { sim, input, origin, direction } = fixture(side, 'before');
      sim.step([input]);
      const grab = sim.state.players[0]!.grab!;
      expect(grab.bodyId).toBe(TARGET);
      patchPlayer(sim, { grab: { ...grab, distance: Math.hypot(3.5, 3.59) } });
      const downward = { ...input, ...quantizeRay(origin, [0, -3.59, direction * 3.5]) };
      blockedHoldWithoutImpulse(sim, downward);
    });
  }
});
