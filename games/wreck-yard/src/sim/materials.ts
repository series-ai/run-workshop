import type { PhysicsMaterialInput3D } from '@series-inc/rundot-syncplay/physics/3d';

/** The surfaces of the yard. Each body and each static box names one. Physics and sound read the same name. */
export const YARD_MATERIALS = ['steel', 'concrete', 'wood', 'rubber', 'glass'] as const;
export type YardMaterial = (typeof YARD_MATERIALS)[number];

/**
 * The lift car deck. It is tuned so that crates ride the lift: high friction and
 * no bounce. No yard body or box uses it. Its hits sound like steel.
 */
export const LIFT_DECK_MATERIAL = 'lift-deck';
/** Every world material name: the yard materials and the lift deck. */
export type PhysicsMaterialName = YardMaterial | typeof LIFT_DECK_MATERIAL;

/**
 * Contact values of each material. Concrete keeps the values that every surface
 * used before, so the floor and the walls feel the same. Tires bounce: rubber
 * sets the bounce of every rubber contact, because the larger restitution wins.
 */
export const MATERIAL_COEFFICIENTS: Readonly<Record<PhysicsMaterialName, { readonly friction: number; readonly restitution: number }>> = {
  concrete: { friction: 0.82, restitution: 0.08 },
  steel: { friction: 0.62, restitution: 0.1 },
  wood: { friction: 0.72, restitution: 0.12 },
  rubber: { friction: 0.95, restitution: 0.55 },
  glass: { friction: 0.45, restitution: 0.05 },
  [LIFT_DECK_MATERIAL]: { friction: 0.9, restitution: 0 },
};

/**
 * The Syncplay world materials (rc.49 contact materials). A body names one of
 * these keys. The combine rules are the ones that inline bodies use: the
 * geometric mean of the two frictions, and the larger restitution and rolling
 * resistance. No pair rule changes them.
 */
export const PHYSICS_MATERIALS: readonly PhysicsMaterialInput3D[] = (Object.keys(MATERIAL_COEFFICIENTS) as PhysicsMaterialName[])
  .sort()
  .map((key) => ({
    key,
    ...MATERIAL_COEFFICIENTS[key],
    rollingResistance: 0,
    frictionCombine: 'geometricMean',
    restitutionCombine: 'maximum',
    rollingResistanceCombine: 'maximum',
  }));

/** True for a value that names a yard material. Saved bytes are checked with it. */
export function isYardMaterial(value: unknown): value is YardMaterial {
  return YARD_MATERIALS.some((material) => material === value);
}

/** The yard material that a world material sounds and looks like on a hit. Throws for a name the world does not define. */
export function hitMaterialOf(name: string): YardMaterial {
  if (isYardMaterial(name)) return name;
  if (name === LIFT_DECK_MATERIAL) return 'steel';
  throw new Error(`WRECK_YARD_MATERIAL_UNKNOWN: ${name}`);
}
