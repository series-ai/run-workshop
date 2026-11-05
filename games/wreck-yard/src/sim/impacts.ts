import type { PhysicsContactData3D, PhysicsContactEvents3D, PhysicsMaterialSnapshot3D } from '@series-inc/rundot-syncplay/physics/3d';
import type { Vec3 } from './math';
import { hitMaterialOf, type YardMaterial } from './materials';
import type { Impact, YardBody } from './state';

/**
 * Closing speed (m/s) from which a contact counts as a hit that you hear and see.
 * Props that settle at spawn meet at up to about 1.9 m/s, so they make no hit.
 */
export const IMPACT_MIN_SPEED = 2;
/** The strongest hits that one tick keeps. A falling stack makes many contacts at once. */
export const MAX_IMPACTS_PER_TICK = 12;
/** Ticks that a hit stays in the state, so a render that skips a tick still sees it. */
export const IMPACT_SHOW_TICKS = 4;

/**
 * The hit material of one side of a contact. Every body in the yard world names
 * its material (physics.ts YardPhysicsBodyInput3D), so an inline side is an error.
 */
function sideMaterial(snapshot: PhysicsMaterialSnapshot3D, key: string | undefined): YardMaterial {
  if (snapshot.source.kind !== 'named') throw new Error(`WRECK_YARD_CONTACT_MATERIAL_NOT_NAMED: ${key}`);
  return hitMaterialOf(snapshot.source.material);
}

/**
 * One contact for each body pair, as up to Syncplay rc.77. Syncplay rc.78 (Box3D) has one
 * event for each touching shape pair, so a voxel body with many child shapes would give
 * many events for one hit. The lists come in body pair order, so equal pairs are next to
 * each other. The event with the highest approach speed stands for the pair; a tie keeps
 * the first, so every client keeps the same event.
 */
export function onePerBodyPair(events: readonly PhysicsContactData3D[]): PhysicsContactData3D[] {
  const out: PhysicsContactData3D[] = [];
  for (const event of events) {
    const last = out[out.length - 1];
    if (last && last.bodyA === event.bodyA && last.bodyB === event.bodyB) {
      if (event.approachSpeed > last.approachSpeed) out[out.length - 1] = event;
      continue;
    }
    out.push(event);
  }
  return out;
}

/**
 * The contacts of one step, one per body pair. `began` replaces the rc.77 'enter' contacts.
 * `touching` replaces 'enter' and 'stay': the pairs that began, and the pairs that touch with
 * a hit event (approach speed above the world hit threshold, 1 m/s). Yard bodies enable both
 * events (physics.ts makePhysicsBody). A sensor pair never has contact events.
 */
export interface StepContacts {
  readonly began: readonly PhysicsContactData3D[];
  readonly touching: readonly PhysicsContactData3D[];
}

export function stepContacts(events: PhysicsContactEvents3D): StepContacts {
  const began = onePerBodyPair(events.begin);
  return { began, touching: [...began, ...onePerBodyPair(events.hit)] };
}

/**
 * The hard contacts that began this tick, strongest first and at most
 * MAX_IMPACTS_PER_TICK. Each one has a yard body. Syncplay reports the material
 * of both sides on the contact (rc.49 contact materials). A sensor pair has no
 * contact event, so it is never here.
 */
export function collectImpacts(contacts: readonly PhysicsContactData3D[], bodyOf: (key: string | undefined) => YardBody | undefined, frame: number): Impact[] {
  const found: Impact[] = [];
  for (const contact of contacts) {
    if (contact.approachSpeed < IMPACT_MIN_SPEED) continue;
    const yard = bodyOf(contact.bodyKeyA) ?? bodyOf(contact.bodyKeyB);
    if (!yard) continue;
    const material = contact.material;
    if (!material || material.kind === 'legacyUnknown') throw new Error(`WRECK_YARD_CONTACT_MATERIAL_MISSING: ${yard.id}`);
    if (material.kind === 'suppressed') continue;
    const at: Vec3 = [contact.point.x, contact.point.y, contact.point.z];
    const materials = [sideMaterial(material.materialA, contact.bodyKeyA), sideMaterial(material.materialB, contact.bodyKeyB)] as const;
    found.push({ bodyId: yard.id, materials, at, speed: contact.approachSpeed, frame });
  }
  // Ties keep the engine order, so every client keeps the same hits.
  return found.map((impact, index) => ({ impact, index }))
    .sort((p, q) => q.impact.speed - p.impact.speed || p.index - q.index)
    .slice(0, MAX_IMPACTS_PER_TICK)
    .map(({ impact }) => impact);
}

/** Hits from the last IMPACT_SHOW_TICKS ticks, with this tick's hits added. */
export function keepImpacts(previous: readonly Impact[], added: readonly Impact[], frame: number): Impact[] {
  return [...previous.filter((impact) => frame - impact.frame < IMPACT_SHOW_TICKS), ...added];
}
