import { describe, expect, it } from 'vitest';
import { FLOOR_Y, PLAYER_RADIUS } from './constants';
import { BUTTONS } from './contraptions';
import { NEUTRAL_INPUT, quantizeRay, TOOL } from './input';
import { physicsStateBodyById } from './physics';
import { patchPlayer, testSim } from './testSim';

/** E and F are "use" (buttons, the buggy); the right mouse button is the gravity gun's punt. */
describe('use and punt are separate', () => {
  const atDropButton = () => {
    const sim = testSim(1);
    const button = BUTTONS.find((entry) => entry.id === 'dropper')!;
    patchPlayer(sim, { x: button.base[0] + 1.2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: button.base[2], vx: 0, vy: 0, vz: 0 });
    return sim;
  };

  it('use at a button presses it', () => {
    const sim = atDropButton();
    const state = sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    expect(state.players[0]!.feedback?.result).toBe('press');
    expect(state.contraptions.drums).toHaveLength(1);
  });

  it('a right click at a button does not press it', () => {
    const sim = atDropButton();
    const state = sim.step([{ ...NEUTRAL_INPUT, secondary: true }]);
    expect(state.contraptions.drums).toHaveLength(0);
  });

  it('use does not punt what the gravity gun aims at', () => {
    const sim = testSim(1);
    for (let i = 0; i < 20; i += 1) sim.step([NEUTRAL_INPUT]);
    const box = physicsStateBodyById(sim.state.world, 'ballast-box')!;
    const aim = quantizeRay([box.x, box.y + 3, box.z + 0.001], [0, -1, 0]);
    const state = sim.step([{ ...NEUTRAL_INPUT, tool: TOOL.hand, use: true, ...aim }]);
    expect(state.stats.throws).toBe(0);
    expect(state.players[0]!.feedback?.result).not.toBe('punt');
    const punted = sim.step([{ ...NEUTRAL_INPUT, tool: TOOL.hand, secondary: true, ...aim }]);
    expect(punted.stats.throws).toBe(1);
  });

  it('use gets in and out of the buggy; a right click does not get in', () => {
    const sim = testSim(1);
    for (let i = 0; i < 20; i += 1) sim.step([NEUTRAL_INPUT]);
    const car = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    patchPlayer(sim, { x: car.x + 1.2, y: car.y + 0.5, z: car.z });
    expect(sim.step([{ ...NEUTRAL_INPUT, secondary: true }]).players[0]!.ridingVehicle).toBeFalsy();
    sim.step([NEUTRAL_INPUT]);
    expect(sim.step([{ ...NEUTRAL_INPUT, use: true }]).players[0]!.ridingVehicle).toBe(true);
    sim.step([NEUTRAL_INPUT]);
    expect(sim.step([{ ...NEUTRAL_INPUT, use: true }]).players[0]!.ridingVehicle).toBe(false);
  });
});
