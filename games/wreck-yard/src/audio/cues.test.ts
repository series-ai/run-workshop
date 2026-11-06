import { describe, expect, it } from 'vitest';
import { IMPACT_SOUND, impactSounds, SECOND_SOUND_GAIN, YardCueTracker, type ShotCue } from './cues';
import { interpolateYard, projectYard, type YardRender } from '../render/presentation';
import { FLOOR_Y, PLAYER_RADIUS, TANK_SPEC } from '../sim/constants';
import { BUTTONS, DROP_COOLDOWN_TICKS } from '../sim/contraptions';
import { FUEL_DRUM } from '../sim/fuelDrum';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from '../sim/input';
import { physicsStateBodyById, replacePhysicsPose } from '../sim/physics';
import { FLOODLIGHT_MASTS, floodlightLensCenter, mastYaw } from '../sim/setPieces';
import type { YardSim } from '../sim/sim';
import { patchPlayer, patchState, testSim } from '../sim/testSim';

const context = { localSlot: 0, status: 'offline' as const };
const project = (sim: YardSim) => projectYard(sim.state, context);
function steps(sim: YardSim, count: number, input: YardInput = NEUTRAL_INPUT): void {
  for (let i = 0; i < count; i++) sim.step([input]);
}
function aimAt(sim: YardSim, id: string, lift = 0): YardInput {
  const p = physicsStateBodyById(sim.state.world, id)!;
  return { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...quantizeRay([p.x, p.y + 6 + lift, p.z + 0.001], [0, -1, -0.0001]) };
}
function miss(): YardInput {
  return { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...quantizeRay([-3, 2, 10], [0, 1, 0]) };
}
const key = (shots: readonly ShotCue[]) => shots.map(({ id, sound, gain, rate }) => ({ id, sound, gain, rate }));
function renderTrace(trace: readonly YardRender[], rate: number): ShotCue[] {
  const tracker = new YardCueTracker();
  tracker.seed(trace[0]!, 1);
  const shots: ShotCue[] = [];
  for (let tick = 1; tick < trace.length; tick++) {
    for (let sample = 1; sample <= rate / 30; sample++) {
      const render = interpolateYard(trace[tick - 1]!, trace[tick]!, sample / (rate / 30));
      shots.push(...tracker.update(render, 1).shots);
    }
  }
  return shots;
}

describe('audio cues from native simulation', () => {
  it('uses the body material instead of paint color', () => {
    const sim = testSim();
    for (const [label, sound] of [['Wrecked Car', 'metal'], ['Shipping Container', 'metal'], ['Concrete Block', 'concrete'], ['Jersey Barrier', 'concrete'], ['Pallet', 'wood'], ['Tire Stack', 'rubber'], ['Shipping Crate', 'wood']] as const) {
      const bodies = sim.state.bodies.filter(body => body.label === label);
      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) expect(IMPACT_SOUND[body.material], body.id).toBe(sound);
    }
  });

  it('plays the glass sound once when a lens breaks, and a player at the spawn hears it', () => {
    const sim = testSim();
    const [mastX, mastZ] = FLOODLIGHT_MASTS[1]!;
    const [lensX, lensY, lensZ] = floodlightLensCenter(mastX, mastZ);
    // Fire the hazard drum at the lens from 0.5 m on the yard side, at 6 m/s (m/tick below).
    const face = [Math.sin(mastYaw(mastX, mastZ)), Math.cos(mastYaw(mastX, mastZ))] as const;
    sim.edit((physics) => replacePhysicsPose(physics, 'hazard-drum-1', {
      x: lensX + face[0] * 0.5, y: lensY, z: lensZ + face[1] * 0.5, vx: -face[0] * 6 / 30, vy: 0, vz: -face[1] * 6 / 30,
    }));
    const trace = [project(sim)];
    for (let i = 0; i < 20; i++) {
      sim.step([NEUTRAL_INPUT]);
      trace.push(project(sim));
    }
    expect(trace.at(-1)!.stats.lampsSmashed).toBe(1);
    // The spawn is about 40 m from the lens, past the 32 m reach of an impact.
    const glass = renderTrace(trace, 60).filter(shot => shot.sound === 'glassBreak');
    expect(glass).toHaveLength(1);
    expect(glass[0]!.at).toEqual(floodlightLensCenter(mastX, mastZ));
  });

  it('picks the sounds of a hit from both materials: the one you hear most, then the other more quietly', () => {
    expect(impactSounds(['wood', 'concrete'])).toEqual({ first: 'wood', second: null });
    expect(impactSounds(['concrete', 'steel'])).toEqual({ first: 'metal', second: null });
    expect(impactSounds(['wood', 'steel'])).toEqual({ first: 'metal', second: 'wood' });
    expect(impactSounds(['rubber', 'glass'])).toEqual({ first: 'glass', second: 'rubber' });
    expect(impactSounds(['steel', 'steel'])).toEqual({ first: 'metal', second: null });
    expect(SECOND_SOUND_GAIN).toBeLessThan(1);
  });

  it('plays both sounds of a steel and wood hit through the tracker, and each one once', () => {
    const sim = testSim();
    steps(sim, 2);
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    const at: [number, number, number] = [-3, FLOOR_Y + 0.5, 6];
    patchState(sim, state => ({ ...state, impacts: [{ bodyId: 'yard-drum-1', materials: ['wood', 'steel'], at, speed: 6, frame: state.frame }] }));
    sim.step([NEUTRAL_INPUT]);
    const first = tracker.update(project(sim), 1).shots.filter(s => s.id.includes('yard-drum-1'));
    expect(first.map(s => s.sound).sort()).toEqual(['metal', 'wood']);
    expect(first.find(s => s.sound === 'wood')!.gain).toBeCloseTo(first.find(s => s.sound === 'metal')!.gain * SECOND_SOUND_GAIN, 6);
    sim.step([NEUTRAL_INPUT]);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.id.includes('yard-drum-1'))).toEqual([]);
  });

  it('plays a lamp smash that a rollback shows a few frames late, once', () => {
    const sim = testSim();
    steps(sim, 6);
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    const lamp = sim.state.contraptions.lamps[0]!;
    // The smash is stamped 3 frames before the frame the tracker has already seen.
    patchState(sim, state => ({
      ...state,
      contraptions: {
        ...state.contraptions,
        lamps: state.contraptions.lamps.map(entry => (entry.lampId === lamp.lampId ? { ...entry, damage: 1, brokenAt: state.frame - 3 } : entry)),
        lampSmashes: [{ lampId: lamp.lampId, at: [-21, FLOOR_Y + 11.2, -20.7], frame: state.frame - 3 }],
      },
    }));
    sim.step([NEUTRAL_INPUT]);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.sound === 'glassBreak')).toHaveLength(1);
    sim.step([NEUTRAL_INPUT]);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.sound === 'glassBreak')).toEqual([]);
  });

  it('plays a fizz when a lamp flickers, lights out when the fourth lamp breaks, and relamp when they come back', () => {
    const sim = testSim();
    steps(sim, 2);
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    const lampIds = sim.state.contraptions.lamps.map(lamp => lamp.lampId);
    // A flicker on frame f is a lamp hit below a break.
    patchState(sim, state => ({ ...state, contraptions: { ...state.contraptions, lamps: state.contraptions.lamps.map((lamp, index) => (index === 0 ? { ...lamp, damage: 0.5, flickerFrame: state.frame } : lamp)) } }));
    sim.step([NEUTRAL_INPUT]);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.sound === 'lampFizz').map(s => s.id)).toEqual([`fizz:${lampIds[0]}@${sim.state.frame - 1}`]);
    patchState(sim, state => ({ ...state, contraptions: { ...state.contraptions, lightsOutUntil: state.frame + 600 } }));
    sim.step([NEUTRAL_INPUT]);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.sound === 'lightsOut')).toHaveLength(1);
    patchState(sim, state => ({ ...state, contraptions: { ...state.contraptions, lightsOutUntil: null, relitFrame: state.frame } }));
    sim.step([NEUTRAL_INPUT]);
    const shots = tracker.update(project(sim), 1).shots;
    expect(shots.filter(s => s.sound === 'relamp')).toHaveLength(1);
    expect(shots.filter(s => s.sound === 'lightsOut')).toEqual([]);
  });

  it('plays the crate break sound when a FRAGILE crate falls 5 m and breaks', () => {
    const sim = testSim();
    steps(sim, 2);
    patchPlayer(sim, { x: 4, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: 12, vx: 0, vy: 0, vz: 0 });
    const id = sim.state.bodies.find(body => body.storageBay === 'returns')!.id;
    sim.edit(physics => replacePhysicsPose(physics, id, { x: 4, y: FLOOR_Y + 0.6, z: 8, vx: 0, vy: -Math.sqrt(2 * 9.81 * 5) / 30, vz: 0 }));
    const trace = [project(sim)];
    for (let i = 0; i < 15; i++) {
      sim.step([NEUTRAL_INPUT]);
      trace.push(project(sim));
    }
    expect(trace.at(-1)!.stats.fractures).toBe(1);
    expect(renderTrace(trace, 30).filter(shot => shot.sound === 'crateBreak')).toHaveLength(1);
  });

  it('emits the same cues at 30, 60, and 120 render frames per second', () => {
    const sim = testSim();
    steps(sim, 40);
    // Use the clear center aisle. Road barrels block the old walking path.
    patchPlayer(sim, { x: -5, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: 8, vx: 0, vy: 0, vz: 0 });
    const trace = [project(sim)];
    for (let i = 0; i < 90; i++) {
      sim.step([{ ...NEUTRAL_INPUT, tool: i < 45 ? TOOL.hand : TOOL.torch, moveX: 1 }]);
      trace.push(project(sim));
    }
    const baseline = renderTrace(trace, 30);
    expect(baseline.filter(s => s.sound === 'step').length).toBeGreaterThan(2);
    expect(key(renderTrace(trace, 60))).toEqual(key(baseline));
    expect(key(renderTrace(trace, 120))).toEqual(key(baseline));
  });

  it('does not repeat an action after a native checkpoint rollback', () => {
    const sim = testSim();
    steps(sim, 30);
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    const save = sim.save();
    sim.step([miss()]);
    const first = tracker.update(project(sim), 1).shots.filter(s => s.id.includes(':miss@'));
    expect(first).toHaveLength(1);
    steps(sim, 2);
    tracker.update(project(sim), 1);
    sim.restore(save);
    expect(tracker.update(project(sim), 1).shots).toEqual([]);
    sim.step([miss()]);
    expect(tracker.update(project(sim), 1).shots).toEqual([]);
    steps(sim, 3);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.id.includes(':miss@'))).toEqual([]);
    sim.release(save);
  });

  it('allows the same action frame in a new session', () => {
    const sim = testSim();
    steps(sim, 30);
    const save = sim.save();
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    sim.step([miss()]);
    expect(tracker.update(project(sim), 1).shots.some(s => s.id.includes(':miss@'))).toBe(true);
    sim.restore(save);
    tracker.seed(project(sim), 2);
    sim.step([miss()]);
    expect(tracker.update(project(sim), 2).shots.some(s => s.id.includes(':miss@'))).toBe(true);
    sim.release(save);
  });

  it('seeds active feedback without playing it after pause or late join', () => {
    const sim = testSim();
    steps(sim, 30);
    sim.step([miss()]);
    const active = project(sim);
    expect(active.players[0]!.feedback?.result).toBe('miss');
    const tracker = new YardCueTracker();
    tracker.seed(active, 1);
    sim.step([NEUTRAL_INPUT]);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.id.includes(':miss@'))).toEqual([]);
  });

  it('plays two native explosions on the same frame once each', () => {
    const sim = testSim();
    const button = BUTTONS.find(b => b.id === 'dropper')!;
    patchPlayer(sim, { x: button.base[0] + 1.2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: button.base[2], vx: 0, vy: 0, vz: 0 });
    sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    steps(sim, DROP_COOLDOWN_TICKS + 1);
    sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    const ids = sim.state.contraptions.drums.filter(d => d.bodyId.startsWith(FUEL_DRUM.idPrefix)).map(d => d.bodyId);
    expect(ids).toHaveLength(2);
    sim.edit(physics => ids.forEach((id, i) => replacePhysicsPose(physics, id, { x: -3 + i * 4, y: 3, z: 10, vx: 0, vy: 0, vz: 0 })));
    patchPlayer(sim, { x: -3, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: 14 });
    patchState(sim, state => ({ ...state, contraptions: { ...state.contraptions, drums: state.contraptions.drums.map(d => ids.includes(d.bodyId)
      ? { ...d, damage: FUEL_DRUM.maxDamage, detonateAt: state.frame + 1 } : d) } }));
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    sim.step([NEUTRAL_INPUT]);
    expect(sim.state.contraptions.explosions).toHaveLength(2);
    const shots = tracker.update(project(sim), 1).shots.filter(s => s.sound === 'explosion');
    expect(shots).toHaveLength(2);
    expect(new Set(shots.map(s => s.id)).size).toBe(2);
    const joined = new YardCueTracker();
    joined.seed(project(sim), 1);
    sim.step([NEUTRAL_INPUT]);
    expect(tracker.update(project(sim), 1).shots.filter(s => s.sound === 'explosion')).toEqual([]);
    expect(joined.update(project(sim), 1).shots.filter(s => s.sound === 'explosion')).toEqual([]);
  });

  it('does not treat gravity hold or release as a body impact', () => {
    const sim = testSim();
    steps(sim, 30);
    const input = aimAt(sim, 'ballast-box');
    sim.step([input]);
    expect(sim.state.players[0]!.grab?.bodyId).toBe('ballast-box');
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    for (let i = 0; i < 15; i++) {
      sim.step([{ ...input, oy: input.oy + 1500 }]);
      const cues = tracker.update(project(sim), 1);
      expect(cues.shots.filter(s => s.id.startsWith('impact:ballast-box'))).toEqual([]);
      expect(cues.loops.some(loop => loop.sound === 'gravity')).toBe(true);
    }
    sim.step([{ ...input, pressed: false }]);
    expect(sim.state.players[0]!.grab).toBeNull();
    expect(tracker.update(project(sim), 1).shots.filter(s => s.id.startsWith('impact:ballast-box'))).toEqual([]);
  });


  it('starts the buggy loop on mounting and increases its rate while driving', () => {
    const sim = testSim();
    steps(sim, 30);
    const car = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    patchPlayer(sim, { x: car.x + 1.2, y: car.y + 0.5, z: car.z });
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    expect(sim.state.players[0]!.ridingVehicle).toBe(true);
    const mounted = tracker.update(project(sim), 1);
    expect(mounted.shots.some(shot => shot.sound === 'mechanism')).toBe(true);
    const idle = mounted.loops.find(loop => loop.id === 'buggy');
    expect(idle).toBeDefined();
    let rate = idle!.rate;
    for (let tick = 0; tick < 20; tick++) {
      sim.step([{ ...NEUTRAL_INPUT, moveZ: 1 }]);
      rate = tracker.update(project(sim), 1).loops.find(loop => loop.id === 'buggy')!.rate;
    }
    expect(rate).toBeGreaterThan(idle!.rate);
    sim.step([{ ...NEUTRAL_INPUT, jetpack: true }]);
    expect(sim.state.players[0]!.ridingVehicle).toBe(false);
    expect(tracker.update(project(sim), 1).loops.some(loop => loop.id === 'buggy')).toBe(false);
  });

  it.each(['dropper', 'catapult'] as const)('plays the %s mechanism after a real button press', id => {
    const sim = testSim();
    steps(sim, 10);
    const button = BUTTONS.find(entry => entry.id === id)!;
    patchPlayer(sim, { x: button.base[0] + 1.2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: button.base[2], vx: 0, vy: 0, vz: 0 });
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    const frame = id === 'dropper' ? sim.state.contraptions.lastDropFrame : sim.state.contraptions.lastLaunchFrame;
    expect(frame).toBe(sim.state.frame);
    expect(tracker.update(project(sim), 1).shots.some(shot => shot.sound === 'mechanism')).toBe(true);
  });

  it('plays a quench and stops the flame loop when the nozzle is in water', () => {
    const sim = testSim();
    steps(sim, 30);
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    sim.step([{ ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay([TANK_SPEC.center[0], TANK_SPEC.surfaceY - 0.3, TANK_SPEC.center[2]], [1, 0, 0]) }]);
    expect(sim.state.players[0]!.feedback?.result).toBe('quench');
    const cues = tracker.update(project(sim), 1);
    expect(cues.shots.filter(shot => shot.sound === 'quench')).toHaveLength(1);
    expect(cues.loops.some(loop => loop.sound === 'torch')).toBe(false);
  });

  it('does not report an impact during free fall, then reports the landing', () => {
    const sim = testSim();
    steps(sim, 40);
    const id = 'ballast-box';
    sim.edit(physics => replacePhysicsPose(physics, id, { x: 6, y: 9, z: 11, vx: 0, vy: -0.05, vz: 0 }));
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    const shots: ShotCue[] = [];
    for (let i = 0; i < 80; i++) {
      sim.step([NEUTRAL_INPUT]);
      const body = physicsStateBodyById(sim.state.world, id)!;
      const frameShots = tracker.update(project(sim), 1).shots.filter(s => s.id.startsWith(`impact:${id}`));
      if (body.y > 2) expect(frameShots).toEqual([]);
      shots.push(...frameShots);
    }
    expect(shots.length).toBeGreaterThan(0);
  });

  it('limits repeated native water entry while a body bobs', () => {
    const sim = testSim();
    steps(sim, 30);
    const id = 'ballast-box';
    patchPlayer(sim, { x: TANK_SPEC.center[0] - 3, y: 1, z: TANK_SPEC.center[2] });
    const move = (wet: boolean) => sim.edit(physics => replacePhysicsPose(physics, id, { x: TANK_SPEC.center[0], y: TANK_SPEC.surfaceY + (wet ? -0.3 : 4), z: TANK_SPEC.center[2], vx: 0, vy: -0.05, vz: 0 }));
    move(false);
    sim.step([NEUTRAL_INPUT]);
    const tracker = new YardCueTracker();
    tracker.seed(project(sim), 1);
    const shots: ShotCue[] = [];
    let entries = 0;
    let wasWet = false;
    for (let i = 0; i < 12; i++) {
      move(i % 2 === 0);
      sim.step([NEUTRAL_INPUT]);
      const render = project(sim);
      const wet = render.soundMotions!.get(id)!.submerged;
      if (wet && !wasWet) entries++;
      wasWet = wet;
      shots.push(...tracker.update(render, 1).shots.filter(s => s.id.startsWith(`water:${id}`)));
    }
    expect(entries).toBeGreaterThan(2);
    expect(shots).toHaveLength(1);
  });
});
