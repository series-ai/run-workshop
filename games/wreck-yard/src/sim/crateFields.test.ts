import { describe, expect, it } from 'vitest';
import { assertBodyMaterial, assertCrateBodyFields } from './codec';
import { createCrateSpawns } from './storage';

/** A decoded body is untrusted data. The test builds the shapes that a save could hold. */
function decoded(fields: Record<string, unknown>): unknown {
  const [spawn] = createCrateSpawns('returns');
  if (!spawn) throw new Error('TEST_NO_RETURNS_CRATE');
  return { ...spawn.body, ...fields };
}

const FACES = { east: { tone: 'light', arrow: 'up' }, south: { tone: 'light', arrow: 'left' }, frame: 'light' };

describe('assertCrateBodyFields', () => {
  it('accepts a crate with its bay and two valid faces', () => {
    expect(() => assertCrateBodyFields(decoded({ storageBay: 'storage', crateFaces: FACES }))).not.toThrow();
  });

  it('accepts a body with no crate fields', () => {
    expect(() => assertCrateBodyFields(decoded({ renderModel: undefined, storageBay: undefined, crateFaces: undefined }))).not.toThrow();
  });

  it('rejects a shipping crate without a bay', () => {
    const bare = decoded({ storageBay: undefined, crateFaces: undefined, renderModel: 'shipping-crate' });
    expect(() => assertCrateBodyFields(bare)).toThrow('has no bay');
  });

  it('rejects a bay without faces, as an old save with one crateFace would decode', () => {
    const old = decoded({ storageBay: 'storage', crateFaces: undefined, crateFace: { tone: 'dark' } });
    expect(() => assertCrateBodyFields(old)).toThrow('faces of');
  });

  it('rejects an arrow that the renderer does not draw', () => {
    const faces = { east: { tone: 'light', arrow: 'down' }, south: FACES.south, frame: 'light' };
    expect(() => assertCrateBodyFields(decoded({ storageBay: 'storage', crateFaces: faces }))).toThrow('faces of');
  });

  it('rejects a face with extra fields', () => {
    const faces = { east: { tone: 'dark', arrow: 'up' }, south: FACES.south, frame: 'light' };
    expect(() => assertCrateBodyFields(decoded({ storageBay: 'storage', crateFaces: faces }))).toThrow('faces of');
  });

  it('rejects a frame that is not a tone', () => {
    const faces = { ...FACES, frame: 'pink' };
    expect(() => assertCrateBodyFields(decoded({ storageBay: 'storage', crateFaces: faces }))).toThrow('faces of');
  });

  it('rejects a frame that matches neither face', () => {
    const faces = { east: { tone: 'light', arrow: 'up' }, south: { tone: 'light', arrow: 'left' }, frame: 'dark' };
    expect(() => assertCrateBodyFields(decoded({ storageBay: 'storage', crateFaces: faces }))).toThrow('faces of');
  });

  it('rejects a render model that is not a shipping crate', () => {
    expect(() => assertCrateBodyFields(decoded({ storageBay: 'storage', crateFaces: FACES, renderModel: 'foo' }))).toThrow('render model foo');
  });

  it('rejects an unknown bay', () => {
    expect(() => assertCrateBodyFields(decoded({ storageBay: 'docks', crateFaces: FACES }))).toThrow('bay docks');
  });

  it('rejects a body that is not an object', () => {
    expect(() => assertCrateBodyFields(null)).toThrow('body is not an object');
  });
});

describe('assertBodyMaterial', () => {
  it('accepts a body with a yard material', () => {
    expect(() => assertBodyMaterial(decoded({ material: 'rubber' }))).not.toThrow();
  });

  it('rejects a body with no material, as a save from an earlier build would decode', () => {
    expect(() => assertBodyMaterial(decoded({ material: undefined }))).toThrow('material undefined of shipping-returns-0');
  });

  it('rejects a material that the yard does not have', () => {
    expect(() => assertBodyMaterial(decoded({ material: 'lava' }))).toThrow('material lava');
  });
});
