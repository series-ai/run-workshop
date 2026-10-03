import type { PhysicsVector3D } from '@series-inc/rundot-syncplay/physics/3d';
import type { Vec3 } from './math';

/**
 * Syncplay (6.0.0-rc.20) types its physics inputs with SI unit brands. The
 * game keeps plain numbers; it brands them only where it calls the SDK, with
 * the SDK's own constructors (they reject a non-finite value).
 */
export type Unit<Quantity extends number> = (value: number) => Quantity;

export function vec<Quantity extends number>(unit: Unit<Quantity>, x: number, y: number, z: number): PhysicsVector3D<Quantity> {
  return { x: unit(x), y: unit(y), z: unit(z) };
}

export function fromVec3<Quantity extends number>(unit: Unit<Quantity>, value: Vec3, scale = 1): PhysicsVector3D<Quantity> {
  return { x: unit(value[0] * scale), y: unit(value[1] * scale), z: unit(value[2] * scale) };
}
