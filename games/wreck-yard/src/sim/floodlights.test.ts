import { radiansPerSecond, vec3 } from '@series-inc/rundot-syncplay/physics/3d';
import { describe, expect, it } from 'vitest';
import { assertLampFields, decodeState } from './codec';
import { FLOOR_Y, PLAYER_EYE_OFFSET, SHELL_PREFIX, TICK_RATE } from './constants';
import {
  brokenLampIds, damageLamp, FLOODLIGHT, floodlightLensByKey, LAMP_SHOW_TICKS, lampHitDamage, lampsToRelight, LIGHTS_OUT_TICKS, REPAIR_TICKS, wholeLamp,
} from './floodlights';
import { FUEL_DRUM } from './fuelDrum';
import { NEUTRAL_INPUT, quantizeRay, TOOL } from './input';
import { physicsBodyHandle, physicsStateBodyById, readBodyInput, replacePhysicsPose } from './physics';
import { FLOODLIGHT_MASTS, floodlightLensCenter, floodlightLensId, mastYaw } from './setPieces';
import type { YardSim } from './sim';
import { INITIAL_CONTRAPTIONS, NEVER_FRAME, type YardState } from './state';
import { SHELL_BOXES } from './shell';
import { patchPlayer, patchState, testSim } from './testSim';

const [mastX, mastZ] = FLOODLIGHT_MASTS[1]!;
const lensId = floodlightLensId(mastX, mastZ);
const lensKey = `${SHELL_PREFIX}${lensId}`;
const frameKey = `${SHELL_PREFIX}set-mast-frame-${mastX}-${mastZ}`;

/** Hazard drum half-width (m). See makeHazardBarrel in presets.ts: 10 voxels of 0.08 m. */
const DRUM_HALF_WIDTH = 0.4;
/** Clear space (m) between the drum and the lens at spawn, so the drum starts outside the lens. */
const START_CLEARANCE = 0.1;
/** Speeds (m/s): FAST breaks a lens in one hit, MEDIUM makes it flicker, SLOW does nothing. */
const FAST_SPEED = 6;
const MEDIUM_SPEED = 4.3;
const SLOW_SPEED = 1.5;

/**
 * Puts the hazard drum on the yard side of a lens, upright and with no spin, then
 * fires it at the lens at `speed` (m/s). A drum that an earlier shot left tipped
 * and spinning would hit the mast pole first.
 */
function fireAtLens(sim: YardSim, speed: number, [x, z]: readonly [number, number] = [mastX, mastZ]): void {
  const gap = DRUM_HALF_WIDTH + START_CLEARANCE;
  const [lensX, lensY, lensZ] = floodlightLensCenter(x, z);
  const face = { x: Math.sin(mastYaw(x, z)), z: Math.cos(mastYaw(x, z)) };
  sim.edit((physics) => {
    const handle = physicsBodyHandle(physics, 'hazard-drum-1');
    physics.world.edit((edit) => edit.replaceBody(handle, {
      ...readBodyInput(physics, handle),
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: vec3(radiansPerSecond, 0, 0, 0),
    }));
    replacePhysicsPose(physics, 'hazard-drum-1', {
      x: lensX + face.x * gap, y: lensY, z: lensZ + face.z * gap,
      vx: (-face.x * speed) / TICK_RATE, vy: 0, vz: (-face.z * speed) / TICK_RATE,
    });
  });
}

function runTicks(sim: YardSim, ticks: number): YardState {
  let state = sim.state;
  for (let tick = 0; tick < ticks; tick += 1) state = sim.step([NEUTRAL_INPUT]);
  return state;
}

const lampOf = (state: YardState, id = lensId) => state.contraptions.lamps.find((lamp) => lamp.lampId === id)!;

describe('floodlight damage rules', () => {
  it('turns closing speed into damage: none below minHitSpeed, a full break at breakSpeed', () => {
    expect(lampHitDamage(FLOODLIGHT.minHitSpeed)).toBe(0);
    expect(lampHitDamage(SLOW_SPEED)).toBe(0);
    expect(lampHitDamage(MEDIUM_SPEED)).toBeGreaterThan(0.3);
    expect(lampHitDamage(MEDIUM_SPEED)).toBeLessThan(1);
    expect(lampHitDamage(FLOODLIGHT.breakSpeed)).toBe(1);
    expect(lampHitDamage(FAST_SPEED)).toBeGreaterThan(1);
  });

  it('flickers a lamp on a hit below a break, breaks it at full damage, and ignores hits on a broken lamp', () => {
    const hit = damageLamp(wholeLamp(lensId), 0.5, 10);
    expect(hit).toEqual({ lampId: lensId, damage: 0.5, flickerFrame: 10, brokenAt: null });
    const broken = damageLamp(hit, 0.6, 20);
    expect(broken).toMatchObject({ damage: 1, brokenAt: 20, flickerFrame: 10 });
    expect(damageLamp(broken, 1, 30)).toBe(broken);
  });

  it('relights one lamp after REPAIR_TICKS, or all four when lights out ends', () => {
    const lamps = INITIAL_CONTRAPTIONS.lamps.map((lamp, index) => (index === 0 ? { ...lamp, damage: 1, brokenAt: 100 } : lamp));
    expect(lampsToRelight({ lamps, lightsOutUntil: null }, 100 + REPAIR_TICKS - 1)).toEqual([]);
    expect(lampsToRelight({ lamps, lightsOutUntil: null }, 100 + REPAIR_TICKS)).toEqual([lamps[0]!.lampId]);
    const allOut = INITIAL_CONTRAPTIONS.lamps.map((lamp) => ({ ...lamp, damage: 1, brokenAt: 100 }));
    // During lights out the single-lamp timer does not run.
    expect(lampsToRelight({ lamps: allOut, lightsOutUntil: 100 + LIGHTS_OUT_TICKS }, 100 + REPAIR_TICKS)).toHaveLength(4);
    expect(lampsToRelight({ lamps: allOut, lightsOutUntil: 100 + LIGHTS_OUT_TICKS }, 99 + LIGHTS_OUT_TICKS)).toEqual([]);
  });
});

describe('floodlight lens in the live sim', () => {
  it('breaks the lens when a body hits it fast, and removes the lens from the world', () => {
    const sim = testSim(1);
    expect(physicsStateBodyById(sim.state.world, lensKey)).toBeDefined();
    fireAtLens(sim, FAST_SPEED);
    const state = runTicks(sim, 10);
    expect(state.stats.lampsSmashed).toBe(1);
    expect(brokenLampIds(state.contraptions)).toEqual([lensId]);
    expect(state.contraptions.lampSmashes).toHaveLength(1);
    expect(state.contraptions.lampSmashes[0]).toMatchObject({ lampId: lensId, at: floodlightLensCenter(mastX, mastZ) });
    expect(physicsStateBodyById(state.world, lensKey)).toBeUndefined();
  });

  it('leaves the lens whole after a slow touch, and the lens still stops the body', () => {
    const sim = testSim(1);
    fireAtLens(sim, SLOW_SPEED);
    const state = runTicks(sim, 30);
    expect(lampOf(state)).toEqual(wholeLamp(lensId));
    expect(physicsStateBodyById(state.world, lensKey)).toBeDefined();
    const [lensX, , lensZ] = floodlightLensCenter(mastX, mastZ);
    const drum = physicsStateBodyById(state.world, 'hazard-drum-1')!;
    const face = { x: Math.sin(mastYaw(mastX, mastZ)), z: Math.cos(mastYaw(mastX, mastZ)) };
    // Positive: the drum stays on the yard side of the lens.
    expect((drum.x - lensX) * face.x + (drum.z - lensZ) * face.z).toBeGreaterThan(0);
  });

  it('makes the lamp flicker on a medium hit, and a second medium hit breaks it', () => {
    const sim = testSim(1);
    fireAtLens(sim, MEDIUM_SPEED);
    let state = runTicks(sim, 15);
    const first = lampOf(state);
    expect(first.brokenAt).toBeNull();
    expect(first.damage).toBeGreaterThan(0.3);
    expect(first.flickerFrame).not.toBe(NEVER_FRAME);
    expect(physicsStateBodyById(state.world, lensKey)).toBeDefined();
    fireAtLens(sim, MEDIUM_SPEED);
    state = runTicks(sim, 15);
    expect(lampOf(state).brokenAt).not.toBeNull();
    expect(physicsStateBodyById(state.world, lensKey)).toBeUndefined();
  });

  it('adds no second smash: the lens is gone, and the mast frame stays', () => {
    const sim = testSim(1);
    fireAtLens(sim, FAST_SPEED);
    runTicks(sim, 30);
    fireAtLens(sim, FAST_SPEED);
    const state = runTicks(sim, 30);
    expect(state.stats.lampsSmashed).toBe(1);
    expect(brokenLampIds(state.contraptions)).toEqual([lensId]);
    expect(physicsStateBodyById(state.world, frameKey)).toBeDefined();
  });

  it('drops the glass from the show after LAMP_SHOW_TICKS, and the lens stays broken', () => {
    const sim = testSim(1);
    fireAtLens(sim, FAST_SPEED);
    expect(runTicks(sim, 10).contraptions.lampSmashes).toHaveLength(1);
    const state = runTicks(sim, LAMP_SHOW_TICKS);
    expect(state.contraptions.lampSmashes).toEqual([]);
    expect(brokenLampIds(state.contraptions)).toEqual([lensId]);
  });

  it('breaks a lens with a fuel drum blast next to it, and leaves the far lamps whole', () => {
    const sim = testSim(1);
    const [lensX, lensY, lensZ] = floodlightLensCenter(mastX, mastZ);
    const face = { x: Math.sin(mastYaw(mastX, mastZ)), z: Math.cos(mastYaw(mastX, mastZ)) };
    sim.edit((physics) => replacePhysicsPose(physics, 'hazard-drum-1', { x: lensX + face.x * 1.2, y: lensY, z: lensZ + face.z * 1.2, vx: 0, vy: 0, vz: 0 }));
    patchState(sim, (state) => ({
      ...state,
      contraptions: { ...state.contraptions, drums: [{ bodyId: 'hazard-drum-1', damage: FUEL_DRUM.maxDamage, detonateAt: state.frame + 1 }] },
    }));
    const state = runTicks(sim, 3);
    expect(state.stats.explosions).toBe(1);
    expect(brokenLampIds(state.contraptions)).toEqual([lensId]);
    expect(physicsStateBodyById(state.world, lensKey)).toBeUndefined();
  });

  it('relights a broken lamp after REPAIR_TICKS: the lens comes back and flickers on', () => {
    const sim = testSim(1);
    fireAtLens(sim, FAST_SPEED);
    runTicks(sim, 10);
    // Move the break back in time, so the repair is due on the next tick.
    patchState(sim, (state) => ({
      ...state,
      contraptions: { ...state.contraptions, lamps: state.contraptions.lamps.map((lamp) => (lamp.lampId === lensId ? { ...lamp, brokenAt: state.frame - REPAIR_TICKS } : lamp)) },
    }));
    const state = runTicks(sim, 2);
    expect(brokenLampIds(state.contraptions)).toEqual([]);
    expect(physicsStateBodyById(state.world, lensKey)).toBeDefined();
    expect(lampOf(state).flickerFrame).toBe(state.contraptions.relitFrame);
    // The lens is solid again: a fast hit breaks it a second time.
    fireAtLens(sim, FAST_SPEED);
    expect(runTicks(sim, 10).stats.lampsSmashed).toBe(2);
  });

  it('keeps a repaired lens out of the world while a body sits in its space, and puts it back when the space is free', () => {
    const sim = testSim(1);
    fireAtLens(sim, FAST_SPEED);
    runTicks(sim, 10);
    // Hold the drum still in the lens space, as if it rests where the glass was.
    const [lensX, lensY, lensZ] = floodlightLensCenter(mastX, mastZ);
    const hold = () => sim.edit((physics) => replacePhysicsPose(physics, 'hazard-drum-1', { x: lensX, y: lensY, z: lensZ, vx: 0, vy: 0, vz: 0 }));
    patchState(sim, (state) => ({
      ...state,
      contraptions: { ...state.contraptions, lamps: state.contraptions.lamps.map((lamp) => (lamp.lampId === lensId ? { ...lamp, brokenAt: state.frame - REPAIR_TICKS } : lamp)) },
    }));
    hold();
    let state = runTicks(sim, 1);
    expect(brokenLampIds(state.contraptions)).toEqual([lensId]);
    expect(physicsStateBodyById(state.world, lensKey)).toBeUndefined();
    sim.edit((physics) => replacePhysicsPose(physics, 'hazard-drum-1', { x: 0, y: FLOOR_Y + 1, z: 8, vx: 0, vy: 0, vz: 0 }));
    state = runTicks(sim, 2);
    expect(brokenLampIds(state.contraptions)).toEqual([]);
    expect(physicsStateBodyById(state.world, lensKey)).toBeDefined();
  });

  it('starts lights out when the fourth lamp breaks, and relights all four when it ends', () => {
    const sim = testSim(1);
    let state = sim.state;
    for (const mast of FLOODLIGHT_MASTS) {
      fireAtLens(sim, FAST_SPEED, mast);
      state = runTicks(sim, 10);
    }
    expect(brokenLampIds(state.contraptions)).toHaveLength(4);
    const brokeLast = Math.max(...state.contraptions.lamps.map((lamp) => lamp.brokenAt!));
    expect(state.contraptions.lightsOutUntil).toBe(brokeLast + LIGHTS_OUT_TICKS);
    patchState(sim, (current) => ({ ...current, contraptions: { ...current.contraptions, lightsOutUntil: current.frame } }));
    state = runTicks(sim, 2);
    expect(brokenLampIds(state.contraptions)).toEqual([]);
    expect(state.contraptions.lightsOutUntil).toBeNull();
    for (const [x, z] of FLOODLIGHT_MASTS) expect(physicsStateBodyById(state.world, `${SHELL_PREFIX}${floodlightLensId(x, z)}`)).toBeDefined();
  });

  it('ends lights out on time even when a body blocks one lens; that lamp comes back later, and a new smash stays broken', () => {
    const sim = testSim(1);
    for (const mast of FLOODLIGHT_MASTS) {
      fireAtLens(sim, FAST_SPEED, mast);
      runTicks(sim, 10);
    }
    runTicks(sim, LAMP_SHOW_TICKS + 2);
    // A drum sits in the space of lens A when lights out ends.
    const [blockedX, blockedZ] = FLOODLIGHT_MASTS[0]!;
    const blockedId = floodlightLensId(blockedX, blockedZ);
    const [ax, ay, az] = floodlightLensCenter(blockedX, blockedZ);
    sim.edit((physics) => replacePhysicsPose(physics, 'hazard-drum-2', { x: ax, y: ay, z: az, vx: 0, vy: 0, vz: 0 }));
    patchState(sim, (state) => ({ ...state, contraptions: { ...state.contraptions, lightsOutUntil: state.frame } }));
    let state = runTicks(sim, 1);
    expect(state.contraptions.lightsOutUntil).toBeNull();
    expect(brokenLampIds(state.contraptions)).toEqual([blockedId]);
    // Lamp B breaks again. It stays broken: lights out is over, so it waits for its own repair.
    fireAtLens(sim, FAST_SPEED);
    state = runTicks(sim, 10);
    expect(brokenLampIds(state.contraptions)).toContain(lensId);
    expect(physicsStateBodyById(state.world, lensKey)).toBeUndefined();
    // The late-join bytes of this state load.
    const save = sim.save();
    try {
      expect(() => decodeState(sim.encode(save))).not.toThrow();
    } finally {
      sim.release(save);
    }
    // When the drum leaves, lamp A comes back on the next ticks.
    sim.edit((physics) => replacePhysicsPose(physics, 'hazard-drum-2', { x: 0, y: FLOOR_Y + 1, z: 8, vx: 0, vy: 0, vz: 0 }));
    state = runTicks(sim, 2);
    expect(brokenLampIds(state.contraptions)).toEqual([lensId]);
  });

  it('brings the lens back after a rollback to a frame before the smash, and replays the same smash', () => {
    const sim = testSim(1);
    fireAtLens(sim, FAST_SPEED);
    const save = sim.save();
    try {
      const first = runTicks(sim, 10);
      expect(first.stats.lampsSmashed).toBe(1);
      sim.restore(save);
      expect(physicsStateBodyById(sim.state.world, lensKey)).toBeDefined();
      const replay = runTicks(sim, 10);
      expect(replay.contraptions).toEqual(first.contraptions);
      expect(replay.stats).toEqual(first.stats);
      expect(physicsStateBodyById(replay.world, lensKey)).toBeUndefined();
    } finally {
      sim.release(save);
    }
  });

  it('lets a player on the floor break a lens: grab a drum, aim at the lamp, and punt', () => {
    const sim = testSim(1);
    const [lensX, lensY, lensZ] = floodlightLensCenter(mastX, mastZ);
    const face = { x: Math.sin(mastYaw(mastX, mastZ)), z: Math.cos(mastYaw(mastX, mastZ)) };
    // Stand 7 m out from the lens, toward the yard center, and aim at the lens through the eye.
    const feet: [number, number, number] = [lensX + face.x * 7, FLOOR_Y, lensZ + face.z * 7];
    patchPlayer(sim, { x: feet[0], y: feet[1], z: feet[2], vx: 0, vy: 0, vz: 0 });
    const eye: [number, number, number] = [feet[0], feet[1] + PLAYER_EYE_OFFSET, feet[2]];
    const toLens: [number, number, number] = [lensX - eye[0], lensY - eye[1], lensZ - eye[2]];
    const length = Math.hypot(...toLens);
    const direction: [number, number, number] = [toLens[0] / length, toLens[1] / length, toLens[2] / length];
    // The drum floats 4 m along the aim, so the grab ray finds it.
    sim.edit((physics) => replacePhysicsPose(physics, 'hazard-drum-1', {
      x: eye[0] + direction[0] * 4, y: eye[1] + direction[1] * 4, z: eye[2] + direction[2] * 4, vx: 0, vy: 0, vz: 0,
    }));
    const aim = { ...NEUTRAL_INPUT, tool: TOOL.hand, ...quantizeRay(eye, direction) };
    let state = sim.step([{ ...aim, pressed: true }]);
    expect(state.players[0]!.feedback?.result).toBe('grab');
    state = sim.step([{ ...aim, pressed: true }]);
    state = sim.step([{ ...aim, pressed: true, secondary: true }]);
    expect(state.players[0]!.feedback?.result).toBe('punt');
    state = runTicks(sim, 20);
    expect(brokenLampIds(state.contraptions)).toEqual([lensId]);
  });

  it('saves and loads a broken lens: the late-join bytes keep the smash, and the lens stays out of the world', () => {
    const sim = testSim(1);
    fireAtLens(sim, FAST_SPEED);
    runTicks(sim, 10);
    const save = sim.save();
    try {
      const loaded = decodeState(sim.encode(save));
      expect(loaded.state.contraptions.lamps).toEqual(save.state.contraptions.lamps);
      expect(loaded.state.contraptions.lampSmashes).toEqual(save.state.contraptions.lampSmashes);
      expect(physicsStateBodyById(loaded.state.world, lensKey)).toBeUndefined();
    } finally {
      sim.release(save);
    }
  });

  it('names each lens and frame in the collider list, and maps each lens key back to its lens', () => {
    const ids = new Set(SHELL_BOXES.map((box) => box.id));
    for (const [x, z] of FLOODLIGHT_MASTS) {
      expect(ids.has(floodlightLensId(x, z))).toBe(true);
      expect(ids.has(`set-mast-frame-${x}-${z}`)).toBe(true);
      expect(floodlightLensByKey(`${SHELL_PREFIX}${floodlightLensId(x, z)}`)?.lampId).toBe(floodlightLensId(x, z));
    }
    expect(floodlightLensByKey(frameKey)).toBeUndefined();
  });
});

describe('saved floodlight fields', () => {
  const valid = () => ({
    ...INITIAL_CONTRAPTIONS,
    lamps: INITIAL_CONTRAPTIONS.lamps.map((lamp) => (lamp.lampId === lensId ? { ...lamp, damage: 1, brokenAt: 5 } : lamp)),
    lampSmashes: [{ lampId: lensId, at: [1, 2, 3], frame: 5 }],
  });

  it('accepts lamps in mast order with a recent smash of a broken lamp', () => {
    expect(() => assertLampFields(valid())).not.toThrow();
  });

  it('rejects lamps out of order, a broken lamp below full damage, and extra fields', () => {
    expect(() => assertLampFields({ ...valid(), lamps: [...valid().lamps].reverse() })).toThrow('lamps');
    expect(() => assertLampFields({ ...valid(), lamps: valid().lamps.map((lamp) => ({ ...lamp, damage: 0.5 })) })).toThrow('lamps');
    expect(() => assertLampFields({ ...valid(), lamps: valid().lamps.map((lamp) => ({ ...lamp, extra: 1 })) })).toThrow('lamps');
  });

  it('rejects a smash of a whole lamp, and lights out with every lamp whole', () => {
    expect(() => assertLampFields({ ...valid(), lampSmashes: [{ lampId: floodlightLensId(...FLOODLIGHT_MASTS[0]!), at: [1, 2, 3], frame: 5 }] })).toThrow('lamp smashes');
    expect(() => assertLampFields({ ...INITIAL_CONTRAPTIONS, lightsOutUntil: 100 })).toThrow('lights out');
    expect(() => assertLampFields({ ...valid(), relitFrame: 1.5 })).toThrow('relit frame');
  });
});
