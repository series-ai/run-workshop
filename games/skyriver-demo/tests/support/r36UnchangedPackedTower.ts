import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import * as THREE from 'three';
import type { SkyriverCityLayout } from '../../src/sim/derive';
import { buildingSeedOf, deriveCityMasses } from '../../src/render/city';
import before from '../fixtures/r36-protected-packed-before.json';

const sha = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');

/** Compare unchanged source groups with the actual baseline upload. */
export function assertR36UnchangedPackedTower(
  layout: SkyriverCityLayout,
  tower: THREE.InstancedMesh,
  mode: 'impostor' | 'geometry',
): void {
  const saved = before.rows.find(row => row.seed === layout.seed && row.mode === mode);
  if (!saved) throw new Error('R36_PROTECTED_PACKED_BASELINE_MISSING');
  const ordinary = new Set(layout.towers.map(t => buildingSeedOf(t.x, t.z)));
  const drawn = deriveCityMasses(layout).filter(m => mode === 'geometry' || (m.layer ?? 0) < 2);
  const protectedSlots = drawn.flatMap((mass, slot) => {
    const owner = mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);
    return !mass.baseRecord && !ordinary.has(owner) ? [slot] : [];
  });
  const baseSlots = drawn.flatMap((mass, slot) => mass.baseRecord ? [slot] : []);
  const groups = [
    { name: 'protected', slots: protectedSlots, count: saved.protectedCount, modelSha256: saved.protectedModelSha256,
      instanceMatrixSha256: saved.instanceMatrixSha256, attributes: saved.attributes },
    { name: 'fixed R27', slots: baseSlots, ...saved.base },
  ];
  for (const group of groups) {
    const { slots } = group;
    expect(slots.length, `${group.name}:count`).toBe(group.count);
    expect(sha(JSON.stringify(slots.map(slot => drawn[slot]))), `${group.name}:source rows`).toBe(group.modelSha256);
    const selectedHash = (array: ArrayLike<number>, itemSize: number): string => {
      const selected = new Float32Array(slots.length * itemSize);
      for (const [index, slot] of slots.entries()) {
        for (let component = 0; component < itemSize; component++) {
          selected[index * itemSize + component] = array[slot * itemSize + component]!;
        }
      }
      return sha(new Uint8Array(selected.buffer));
    };
    expect(selectedHash(tower.instanceMatrix.array, 16), `${group.name}:instance matrices`).toBe(group.instanceMatrixSha256);
    const attributes: Readonly<Record<string, { readonly itemSize: number; readonly sha256: string }>> = group.attributes;
    const actualNames = Object.entries(tower.geometry.attributes)
      .filter(([, attribute]) => attribute instanceof THREE.InstancedBufferAttribute).map(([name]) => name).sort();
    expect(actualNames).toEqual(Object.keys(attributes).sort());
    for (const [name, original] of Object.entries(attributes)) {
      const attribute = tower.geometry.getAttribute(name);
      if (!(attribute instanceof THREE.InstancedBufferAttribute)) throw new Error('R36_PROTECTED_INSTANCE_ATTRIBUTE_MISSING');
      expect(attribute.itemSize, name).toBe(original.itemSize);
      expect(selectedHash(attribute.array, attribute.itemSize), `${group.name}:${name}`).toBe(original.sha256);
    }
  }
}
