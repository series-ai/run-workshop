import { describe, expect, it } from 'vitest';
import { SHELL_PREFIX } from './constants';
import { isYardMaterial, MATERIAL_COEFFICIENTS, type YardMaterial } from './materials';
import { launchPhysicsBody, physicsBodyHandle, replacePhysicsPose, setPhysicsBodyLinearDamping } from './physics';
import { FLOODLIGHT_MASTS, floodlightLensId } from './setPieces';
import { SHELL_BOXES } from './shell';
import { initialState, testSim } from './testSim';

function shellMaterial(id: string): YardMaterial {
  const box = SHELL_BOXES.find((entry) => entry.id === id);
  if (!box) throw new Error(`TEST_NO_SHELL_BOX:${id}`);
  return box.material;
}

describe('yard materials', () => {
  it('gives every static box and every starting body a known material', () => {
    // A cast can hide a missing field from the compiler. This check runs on the real lists.
    for (const box of SHELL_BOXES) expect(isYardMaterial(box.material), box.id).toBe(true);
    for (const body of initialState().bodies) expect(isYardMaterial(body.material), body.id).toBe(true);
  });

  it('uses the surface that the player sees on the static parts', () => {
    for (const [x, z] of FLOODLIGHT_MASTS) {
      expect(shellMaterial(floodlightLensId(x, z))).toBe('glass');
      expect(shellMaterial(`set-mast-frame-${x}-${z}`)).toBe('steel');
      expect(shellMaterial(`set-mast-pier-${x}-${z}`)).toBe('concrete');
    }
    expect(shellMaterial('floor')).toBe('concrete');
    expect(shellMaterial('wall-north')).toBe('concrete');
    expect(shellMaterial('tank-floor')).toBe('concrete');
    expect(shellMaterial('tank-west')).toBe('glass');
    expect(shellMaterial('set-conveyor-belt')).toBe('rubber');
    expect(shellMaterial('set-conveyor-rail-1')).toBe('steel');
    expect(shellMaterial('set-crane-beam-north')).toBe('steel');
    expect(shellMaterial('storage-landing-0')).toBe('steel');
  });

  it('uses the surface that the player sees on the movable bodies', () => {
    const bodies = initialState().bodies;
    const materialsOf = (match: (label: string, id: string) => boolean) =>
      new Set(bodies.filter((body) => match(body.label, body.id)).map((body) => body.material));
    expect(materialsOf((label) => label === 'Tire Stack')).toEqual(new Set(['rubber']));
    expect(materialsOf((label) => label === 'Shipping Crate')).toEqual(new Set(['wood']));
    expect(materialsOf((label) => label === 'Pallet' || label === 'Timber Pallet')).toEqual(new Set(['wood']));
    expect(materialsOf((label) => label === 'Concrete Block' || label === 'Jersey Barrier')).toEqual(new Set(['concrete']));
    expect(materialsOf((label) => /Drum/.test(label))).toEqual(new Set(['steel']));
    expect(materialsOf((label) => label === 'Wrecked Car' || label === 'Shipping Container' || label === 'Scrap Bale')).toEqual(new Set(['steel']));
    expect(materialsOf((_, id) => id.startsWith('bowling-pin-'))).toEqual(new Set(['wood']));
  });

  it('names each material on the Syncplay body, and the world resolves its friction and restitution', () => {
    const sim = testSim(1);
    const tire = sim.state.bodies.find((body) => body.label === 'Tire Stack');
    if (!tire) throw new Error('TEST_NO_TIRE_STACK');
    const lensKey = `${SHELL_PREFIX}${floodlightLensId(...FLOODLIGHT_MASTS[0]!)}`;
    const read: Record<string, { source: unknown; friction: number; restitution: number }> = {};
    sim.edit((physics) => {
      for (const id of [tire.id, lensKey, `${SHELL_PREFIX}floor`, 'storage-elevator']) {
        const body = physics.world.readBody(physicsBodyHandle(physics, id));
        read[id] = { source: body.materialSource, friction: body.friction, restitution: body.restitution };
      }
    });
    expect(read[tire.id]).toEqual({ source: { kind: 'named', material: 'rubber' }, ...MATERIAL_COEFFICIENTS.rubber });
    expect(read[lensKey]).toEqual({ source: { kind: 'named', material: 'glass' }, ...MATERIAL_COEFFICIENTS.glass });
    expect(read[`${SHELL_PREFIX}floor`]).toEqual({ source: { kind: 'named', material: 'concrete' }, ...MATERIAL_COEFFICIENTS.concrete });
    expect(read['storage-elevator']).toEqual({ source: { kind: 'named', material: 'lift-deck' }, ...MATERIAL_COEFFICIENTS['lift-deck'] });
  });

  it('keeps the named material when the yard moves or launches a body', () => {
    const sim = testSim(1);
    let source: unknown;
    sim.edit((physics) => {
      replacePhysicsPose(physics, 'hazard-drum-1', { x: 0, y: 3, z: 8, vx: 0, vy: 0, vz: 0 });
      launchPhysicsBody(physics, 'hazard-drum-1', [0, 4, 8], [1, 2, 0], [0, 0, 0], 0);
      setPhysicsBodyLinearDamping(physics, 'hazard-drum-1', 0.5);
      source = physics.world.readBody(physicsBodyHandle(physics, 'hazard-drum-1')).materialSource;
    });
    expect(source).toEqual({ kind: 'named', material: 'steel' });
  });
});
