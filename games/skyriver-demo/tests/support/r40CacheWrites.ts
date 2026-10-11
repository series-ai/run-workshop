import { installCitySnapshot, type SkyriverCitySnapshot } from '../../src/render/city';
import type { SkyriverCityLayout } from '../../src/sim/derive';

export interface CacheWrite {
  readonly family: string;
  readonly operation: 'set' | 'delete';
}

/** Identify the real cache Maps from a valid atomic installation. */
export function identifyCityCacheMaps(layout: SkyriverCityLayout, snapshot: SkyriverCitySnapshot): ReadonlyMap<Map<unknown, unknown>, string> {
  const maps = new Map<Map<unknown, unknown>, string>();
  const original = Map.prototype.set;
  Map.prototype.set = function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
    if (key === layout.seed) {
      const family = value instanceof WeakMap ? 'massSeedOrdinals'
        : Object.keys(snapshot).find(name => Reflect.get(snapshot, name) === value);
      if (family !== undefined) original.call(maps, this, family);
    }
    return original.call(this, key, value);
  };
  try { installCitySnapshot(layout, snapshot); }
  finally { Map.prototype.set = original; }
  if (maps.size !== 15 || new Set(maps.values()).size !== 15) throw new Error('R40_ALL_REAL_CACHE_MAPS_REQUIRED');
  return maps;
}

/** Observe real cache operations. Run every original Map operation unchanged. */
export function observeCityCacheWrites(maps: ReadonlyMap<Map<unknown, unknown>, string>, action: () => void): { readonly rejected: boolean; readonly writes: readonly CacheWrite[] } {
  const writes: CacheWrite[] = [];
  const set = Map.prototype.set, remove = Map.prototype.delete;
  Map.prototype.set = function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
    const family = maps.get(this);
    if (family !== undefined) writes.push({ family, operation: 'set' });
    return set.call(this, key, value);
  };
  Map.prototype.delete = function (this: Map<unknown, unknown>, key: unknown) {
    const family = maps.get(this);
    if (family !== undefined) writes.push({ family, operation: 'delete' });
    return remove.call(this, key);
  };
  let rejected = false;
  try { action(); } catch { rejected = true; }
  finally { Map.prototype.set = set; Map.prototype.delete = remove; }
  return { rejected, writes };
}

/** Observe the same real Maps across the asynchronous common loader boundary. */
export async function observeCityCacheWritesAsync<T>(maps: ReadonlyMap<Map<unknown, unknown>, string>, action: () => Promise<T>): Promise<{ readonly value: T | undefined; readonly rejected: boolean; readonly writes: readonly CacheWrite[] }> {
  const writes: CacheWrite[] = [];
  const set = Map.prototype.set, remove = Map.prototype.delete;
  Map.prototype.set = function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
    const family = maps.get(this);
    if (family !== undefined) writes.push({ family, operation: 'set' });
    return set.call(this, key, value);
  };
  Map.prototype.delete = function (this: Map<unknown, unknown>, key: unknown) {
    const family = maps.get(this);
    if (family !== undefined) writes.push({ family, operation: 'delete' });
    return remove.call(this, key);
  };
  let rejected = false, value: T | undefined;
  try { value = await action(); } catch { rejected = true; }
  finally { Map.prototype.set = set; Map.prototype.delete = remove; }
  return { value, rejected, writes };
}
