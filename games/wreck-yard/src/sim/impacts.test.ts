import type { PhysicsBodyId3D, PhysicsContactData3D } from '@series-inc/rundot-syncplay/physics/3d';
import { describe, expect, it } from 'vitest';
import { assertImpacts } from './codec';
import { FLOOR_Y, SHELL_PREFIX, TICK_RATE } from './constants';
import { collectImpacts, IMPACT_SHOW_TICKS, keepImpacts, MAX_IMPACTS_PER_TICK, onePerBodyPair, stepContacts } from './impacts';
import { NEUTRAL_INPUT } from './input';
import { replacePhysicsPose } from './physics';
import type { Impact } from './state';
import { initialState, testSim } from './testSim';

const bodies = initialState().bodies;
const bodyOf = (key: string | undefined) => bodies.find((body) => body.id === key);
const drum = bodies.find((body) => body.id === 'hazard-drum-1')!;
const pallet = bodies.find((body) => body.label === 'Pallet')!;

/** The material that the engine reports for each fixture key: the yard material name, or inline for a player. */
const MATERIAL_OF_KEY: Readonly<Record<string, string | null>> = {
  [drum.id]: 'steel', [pallet.id]: 'wood', [`${SHELL_PREFIX}floor`]: 'concrete', [`${SHELL_PREFIX}wall-north`]: 'concrete',
  [`${SHELL_PREFIX}tank-west`]: 'glass', 'storage-elevator': 'lift-deck',
};

function snapshot(key: string | undefined) {
  const name = key === undefined ? null : MATERIAL_OF_KEY[key];
  if (name === undefined) throw new Error(`TEST_NO_MATERIAL_FOR:${key}`);
  return { source: name === null ? { kind: 'inline' } : { kind: 'named', material: name } };
}

/**
 * A contact event as the engine reports it. Only the fields that collectImpacts and
 * onePerBodyPair read matter. The material output names both sides, as Syncplay rc.49 does.
 */
function contact(a: string | undefined, b: string | undefined, approachSpeed: number, response: 'resolved' | 'suppressed' = 'resolved', ids: readonly [number, number] = [1, 2]): PhysicsContactData3D {
  const material = { kind: response, materialA: snapshot(a), materialB: snapshot(b) };
  return { bodyA: BigInt(ids[0]) as PhysicsBodyId3D, bodyB: BigInt(ids[1]) as PhysicsBodyId3D, bodyKeyA: a, bodyKeyB: b, approachSpeed, point: { x: 1, y: 2, z: 3 }, material } as unknown as PhysicsContactData3D;
}

describe('impacts from contacts', () => {
  it('names both surfaces: a yard body by its material, and a static box by its own', () => {
    const [impact] = collectImpacts([contact(drum.id, `${SHELL_PREFIX}floor`, 4)], bodyOf, 9);
    expect(impact).toEqual({ bodyId: drum.id, materials: ['steel', 'concrete'], at: [1, 2, 3], speed: 4, frame: 9 });
    expect(collectImpacts([contact(`${SHELL_PREFIX}tank-west`, pallet.id, 3)], bodyOf, 9)[0]!.materials).toEqual(['glass', 'wood']);
  });

  it('skips slow contacts and contacts with no yard body', () => {
    expect(collectImpacts([contact(drum.id, `${SHELL_PREFIX}floor`, 1)], bodyOf, 0)).toEqual([]);
    expect(collectImpacts([contact(`${SHELL_PREFIX}floor`, `${SHELL_PREFIX}wall-north`, 5)], bodyOf, 0)).toEqual([]);
    // A suppressed contact (no collision response) makes no hit.
    expect(collectImpacts([contact(drum.id, `${SHELL_PREFIX}floor`, 5, 'suppressed')], bodyOf, 0)).toEqual([]);
  });

  it('keeps one event per body pair: the fastest shape pair, and the first one on a tie', () => {
    const slow = contact(drum.id, `${SHELL_PREFIX}floor`, 2, 'resolved', [1, 2]);
    const fast = contact(drum.id, `${SHELL_PREFIX}floor`, 6, 'resolved', [1, 2]);
    const tie = contact(drum.id, `${SHELL_PREFIX}floor`, 6, 'resolved', [1, 2]);
    const other = contact(pallet.id, `${SHELL_PREFIX}floor`, 3, 'resolved', [1, 3]);
    const kept = onePerBodyPair([slow, fast, tie, other]);
    expect(kept).toHaveLength(2);
    expect(kept[0]).toBe(fast);
    expect(kept[1]).toBe(other);
  });

  it('begins only with begin events, and touches with begin and hit events', () => {
    const began = contact(drum.id, `${SHELL_PREFIX}floor`, 4, 'resolved', [1, 2]);
    const hit = contact(pallet.id, `${SHELL_PREFIX}floor`, 9, 'resolved', [1, 3]);
    const contacts = stepContacts({ begin: [began], end: [], hit: [hit] });
    expect(contacts.began).toEqual([began]);
    expect(contacts.touching).toEqual([began, hit]);
  });

  it('sounds the lift deck as steel, and fails loudly when a side of a contact has no named material', () => {
    expect(collectImpacts([contact(drum.id, 'storage-elevator', 4)], bodyOf, 0)[0]!.materials).toEqual(['steel', 'steel']);
    const unnamed = { ...contact(drum.id, `${SHELL_PREFIX}floor`, 4), material: { kind: 'resolved', materialA: snapshot(drum.id), materialB: { source: { kind: 'inline' } } } } as unknown as PhysicsContactData3D;
    expect(() => collectImpacts([unnamed], bodyOf, 0)).toThrow('WRECK_YARD_CONTACT_MATERIAL_NOT_NAMED');
    const missing = { ...contact(drum.id, `${SHELL_PREFIX}floor`, 4), material: undefined } as unknown as PhysicsContactData3D;
    expect(() => collectImpacts([missing], bodyOf, 0)).toThrow('WRECK_YARD_CONTACT_MATERIAL_MISSING');
  });

  it('keeps the strongest hits of a tick, at most MAX_IMPACTS_PER_TICK, in a fixed order', () => {
    const many = Array.from({ length: MAX_IMPACTS_PER_TICK + 5 }, (_, index) => contact(drum.id, `${SHELL_PREFIX}floor`, 2 + index));
    const kept = collectImpacts(many, bodyOf, 0);
    expect(kept).toHaveLength(MAX_IMPACTS_PER_TICK);
    expect(kept[0]!.speed).toBe(2 + MAX_IMPACTS_PER_TICK + 4);
    expect(kept.map((impact) => impact.speed)).toEqual([...kept.map((impact) => impact.speed)].sort((p, q) => q - p));
  });

  it('keeps each hit for IMPACT_SHOW_TICKS ticks', () => {
    const old: Impact = { bodyId: 'a', materials: ['steel', 'steel'], at: [0, 0, 0], speed: 3, frame: 10 };
    expect(keepImpacts([old], [], 10 + IMPACT_SHOW_TICKS - 1)).toEqual([old]);
    expect(keepImpacts([old], [], 10 + IMPACT_SHOW_TICKS)).toEqual([]);
  });

  it('records a steel drum landing on the concrete floor in the live sim', () => {
    const sim = testSim(1);
    sim.edit((physics) => replacePhysicsPose(physics, drum.id, { x: 4, y: FLOOR_Y + 1.5, z: 8, vx: 0, vy: -5 / TICK_RATE, vz: 0 }));
    const seen: Impact[] = [];
    for (let tick = 0; tick < 20; tick++) seen.push(...sim.step([NEUTRAL_INPUT]).impacts.filter((impact) => impact.bodyId === drum.id));
    expect(seen.some((impact) => impact.materials.includes('steel') && impact.materials.includes('concrete') && impact.speed > 4)).toBe(true);
  });

  it('rejects saved impacts with an unknown material, a bad point, or extra fields', () => {
    const good: Impact = { bodyId: 'a', materials: ['steel', 'wood'], at: [0, 1, 2], speed: 3, frame: 4 };
    expect(() => assertImpacts([good])).not.toThrow();
    expect(() => assertImpacts([{ ...good, materials: ['steel', 'lava'] }])).toThrow('impacts');
    expect(() => assertImpacts([{ ...good, at: [0, 1] }])).toThrow('impacts');
    expect(() => assertImpacts([{ ...good, extra: 1 }])).toThrow('impacts');
    expect(() => assertImpacts(undefined)).toThrow('impacts');
  });
});
