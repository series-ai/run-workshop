import { buildingSeedOf, type SkyriverFacadeFace, type SkyriverMass, type SkyriverHeroBlade, type SkyriverEligibleTowerProfile, type SkyriverTowerProfileRow } from '../../src/render/city';
import { deriveCityLayout } from '../../src/sim/derive';
import { presentCityLayout } from '../../src/render/presentationLayout';
import beforeArt from '../fixtures/r36-resolved-art-before.json';
import { retainedMassContact } from './retainedMassContact';
import { FACADE_FACE_EDGE_MARGIN_M } from '../../src/render/facadeGeometry';
import { independentMassRoofBox, physicalFacadeRectangles, sectionUnionArea, massSection, sectionUnionBounds, expectedBoundedStageFit, expectedTowerYaw } from './towerProfileGeometry';
import { roofBoxTolerance, roofSupportFailures } from './rooftopDetailsGeometry';

export const ART_CROWN_HEIGHT_M = 200;
export const ART_HERO_MARGIN_M = FACADE_FACE_EDGE_MARGIN_M + 0.25;
export interface ActualHeroRoot { readonly u0: number; readonly u1: number; readonly y0: number; readonly y1: number }

/** Grade actual crown geometry. The old outer top stays fixed. */
export function crownCarveFailures(crown: SkyriverMass, oldGeometry: readonly number[], hosts: readonly SkyriverMass[]): readonly string[] {
  if (oldGeometry.length !== 8 || !oldGeometry.every(Number.isFinite)) throw new Error('R36_ART_OLD_CROWN');
  const errors: string[] = [], tolerance = roofBoxTolerance(independentMassRoofBox(crown));
  const actual = [crown.x, crown.z, crown.y0, crown.width, crown.depth, crown.height, crown.materialOwner ?? crown.building ?? buildingSeedOf(crown.x, crown.z), crown.anchorV ?? crown.z];
  for (const index of (crown.yawRad === undefined ? [0, 1, 3, 4, 6, 7] : [6, 7])) if (actual[index] !== oldGeometry[index]) errors.push(`fixed-field-${index}`);
  if (crown.height !== ART_CROWN_HEIGHT_M) errors.push('prototype-height');
  if (Math.abs(crown.y0 + crown.height - (oldGeometry[2]! + oldGeometry[5]!)) > tolerance) errors.push('outer-top');
  const contacts = hosts.filter(host => roofSupportFailures(independentMassRoofBox(crown), independentMassRoofBox(host), 0).length === 0);
  if (contacts.length === 0) errors.push('actual-roof-contact');
  if (hosts.some(host => host.y0 + host.height > crown.y0 + tolerance)) errors.push('body-not-lowered');
  return errors;
}

/** The final root plus its existing margin must fit real emitted facade surfaces. */
export function actualHeroRootFailures(root: ActualHeroRoot, face: SkyriverFacadeFace, masses: readonly SkyriverMass[]): readonly string[] {
  const requested = { x0: root.u0 - ART_HERO_MARGIN_M, x1: root.u1 + ART_HERO_MARGIN_M, z0: root.y0 - ART_HERO_MARGIN_M, z1: root.y1 + ART_HERO_MARGIN_M };
  const area = (requested.x1 - requested.x0) * (requested.z1 - requested.z0), errors: string[] = [];
  if (!(area > 0)) return ['root-area'];
  if (requested.x0 < face.u0 || requested.x1 > face.u1 || requested.z0 < face.y0 || requested.z1 > face.y1) errors.push('face-fit');
  const { rectangles } = physicalFacadeRectangles(face, masses.map(mass => ({ mass, box: independentMassRoofBox(mass) })), requested);
  if (Math.abs(sectionUnionArea(rectangles) - area) > Math.max(1e-7, area * 1e-10)) errors.push('real-surface-fit');
  return errors;
}

/** A retained crown must equal the resolved authority and keep real roof support. */
export function retainedCrownFailures(crown: SkyriverMass, oldGeometry: readonly number[], hosts: readonly SkyriverMass[]): readonly string[] {
  if (oldGeometry.length !== 8 || !oldGeometry.every(Number.isFinite)) throw new Error('R36_ART_OLD_CROWN');
  const actual = [crown.x, crown.z, crown.y0, crown.width, crown.depth, crown.height, crown.materialOwner ?? crown.building ?? buildingSeedOf(crown.x, crown.z), crown.anchorV ?? crown.z];
  const errors: string[] = [];
  if ((crown.yawRad === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [2, 5, 6, 7]).some(index => actual[index] !== oldGeometry[index])) errors.push('resolved-geometry');
  if (!hosts.some(host => roofSupportFailures(independentMassRoofBox(crown), independentMassRoofBox(host), 0).length === 0)) errors.push('actual-roof-contact');
  return errors;
}

/** Verify the fixed art patch before assigning its dark emission class. */
export function fixedArtBackingFailures(backing: SkyriverMass, masses: readonly SkyriverMass[], faces: readonly SkyriverFacadeFace[], heroes: readonly SkyriverHeroBlade[]): readonly string[] {
  const role = backing.artBacking;
  if (!role) return ['backing-role'];
  const host = masses[role.hostMassIndex], face = faces.find(face => face.id === role.faceId);
  const matchingHeroes = heroes.filter(hero => hero.faceId === role.faceId);
  if (!host || !face || matchingHeroes.length !== 1) return ['backing-authority'];
  const hero = matchingHeroes[0]!, axisX = face.planeAxis === 'x', half = axisX && hero.kind === 'blade' ? hero.rootHalfWidthM : hero.width / 2;
  const u = axisX ? hero.z : hero.x, bounds = [u - half - ART_HERO_MARGIN_M, u + half + ART_HERO_MARGIN_M, hero.y - hero.height / 2 - ART_HERO_MARGIN_M, hero.y + hero.height / 2 + ART_HERO_MARGIN_M];
  const errors: string[] = [];
  if (!face.id.endsWith(`:art:${hero.compositionId}:${hero.cell}`)) errors.push('art-face-role');
  if ([face.u0, face.u1, face.y0, face.y1].some((value, i) => Math.abs(value - bounds[i]!) > 1e-7)) errors.push('art-face-crop');
  const tangentCentre = axisX ? backing.z : backing.x, tangentSpan = axisX ? backing.depth : backing.width;
  if ([tangentCentre - tangentSpan / 2, tangentCentre + tangentSpan / 2, backing.y0, backing.y0 + backing.height].some((value, i) => Math.abs(value - bounds[i]!) > 1e-7)) errors.push('emitted-patch-crop');
  if ((backing.yawRad ?? 0) !== 0 || (face.owner.yawRad ?? 0) !== 0) errors.push('fixed-art-frame');
  const outside = (axisX ? backing.x : backing.z) + face.outward * (axisX ? backing.width : backing.depth) / 2;
  if (Math.abs(outside - face.plane) > 1e-7) errors.push('inward-depth-only');
  const key = (mass: SkyriverMass) => mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);
  if (host.artBacking || (host.yawRad ?? 0) === 0 || key(host) !== key(backing) || (host.anchorV ?? host.z) !== (backing.anchorV ?? backing.z)) errors.push('backing-host');
  if (retainedMassContact(independentMassRoofBox(backing), independentMassRoofBox(host)) !== 'volume') errors.push('actual-host-contact');
  return errors;
}

/** Maximize crown area at the saved centre. Keep at least half of the saved long axis. */
export function expectedCrownFit(oldGeometry: readonly (readonly number[])[], parent: SkyriverMass, yawRad = parent.yawRad ?? 0): readonly { readonly x: number; readonly z: number; readonly width: number; readonly depth: number }[] {
  if ((parent.yawRad ?? 0) !== 0) throw new Error('YAW_CROWN_CAP_FRAME');
  const bounds = sectionUnionBounds(oldGeometry.map(row => massSection({ x: row[0]!, z: row[1]!, width: row[3]!, depth: row[4]! })));
  const width = bounds.x1 - bounds.x0, depth = bounds.z1 - bounds.z0, x = (bounds.x0 + bounds.x1) / 2, z = (bounds.z0 + bounds.z1) / 2;
  const c = Math.cos(yawRad), s = Math.abs(Math.sin(yawRad)), cap = massSection(parent);
  const longX = width >= depth, oldLong = longX ? width : depth, oldShort = longX ? depth : width;
  const limitX = Math.min(width, 2 * Math.min(x - cap.x0, cap.x1 - x)), limitZ = Math.min(depth, 2 * Math.min(z - cap.z0, cap.z1 - z));
  const longLimit = longX ? limitX : limitZ, shortLimit = longX ? limitZ : limitX;
  // Short length is the minimum of three linear bounds on the chosen long length.
  const lines: readonly (readonly [number, number])[] = [[oldShort, 0], [shortLimit / c, s / c], ...(s > 0 ? [[longLimit / s, c / s] as const] : [])];
  const longMax = s > 0 ? oldLong : Math.min(oldLong, longLimit / c);
  const candidates = [oldLong / 2, longMax];
  for (const [intercept, slope] of lines) if (slope > 0) candidates.push(intercept / (2 * slope));
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i]!, b = lines[j]!;
    if (a[1] !== b[1]) candidates.push((a[0] - b[0]) / (a[1] - b[1]));
  }
  const fits = candidates.filter(length => length >= oldLong / 2 - 1e-9 && length <= longMax + 1e-9).map(length => ({ long: length, short: Math.min(...lines.map(([intercept, slope]) => intercept - slope * length)) })).filter(fit => fit.short > 0);
  fits.sort((a, b) => b.long * b.short - a.long * a.short);
  const best = fits[0];
  if (!best) throw new Error('YAW_CROWN_INVALID_FIT');
  const scaleX = (longX ? best.long : best.short) / width, scaleZ = (longX ? best.short : best.long) / depth;
  return oldGeometry.map(row => ({ x: x + (row[0]! - x) * scaleX, z: z + (row[1]! - z) * scaleZ, width: row[3]! * scaleX, depth: row[4]! * scaleZ }));
}

/** A dark cap must be a four-metre slice of the unturned accepted parent volume. */
export function yawRoofCapFailures(cap: SkyriverMass, tall: SkyriverMass): readonly string[] {
  const errors: string[] = [];
  if (cap.supportRole !== 'yaw-roof-cap' || (cap.yawRad ?? 0) !== 0 || cap.yawAnchor !== undefined || cap.height !== 4 || cap.artBacking || cap.baseRecord) errors.push('cap-role');
  if (cap.y0 + cap.height !== tall.y0 + tall.height || cap.anchorV !== tall.anchorV || cap.materialOwner !== tall.materialOwner || cap.building !== tall.building || cap.tint !== tall.tint) errors.push('cap-parent');
  const outer = massSection(cap), inside = massSection(tall), tolerance = roofBoxTolerance(independentMassRoofBox(cap));
  if (inside.x0 < outer.x0 - tolerance || inside.x1 > outer.x1 + tolerance || inside.z0 < outer.z0 - tolerance || inside.z1 > outer.z1 + tolerance) errors.push('cap-accepted-bounds');
  if (retainedMassContact(independentMassRoofBox(cap), independentMassRoofBox(tall)) !== 'volume') errors.push('cap-physical-contact');
  return errors;
}

export function verifiedYawRoofCapIds(profiles: readonly SkyriverTowerProfileRow[], masses: readonly SkyriverMass[], seed: number): ReadonlySet<number> {
  const ids = new Set<number>();
  for (const row of profiles) {
    if (row.eligibility.kind !== 'eligible' || !('stages' in row)) continue;
    const stage = row.stages.at(-1)!, caps = stage.massIndices.filter(index => masses[index]!.supportRole === 'yaw-roof-cap');
    const tall = stage.massIndices.filter(index => masses[index]!.supportRole !== 'yaw-roof-cap');
    if (caps.length !== 1 || tall.length !== 1 || ids.has(caps[0]!) || masses[caps[0]!]!.supportHostMassIndex !== tall[0] || yawRoofCapFailures(masses[caps[0]!]!, masses[tall[0]!]!).length > 0) throw new Error('YAW_ROOF_CAP_GEOMETRY');
    const cap = masses[caps[0]!]!, approved = approvedYawHostEnvelope(masses[tall[0]!]!, tall[0]!, profiles, seed, masses);
    if (cap.x !== approved.x || cap.z !== approved.z || cap.width !== approved.width || cap.depth !== approved.depth) throw new Error('YAW_ROOF_CAP_SAVED_BOUNDS');
    ids.add(caps[0]!);
  }
  if (masses.some((mass, index) => mass.supportRole === 'yaw-roof-cap' && !ids.has(index))) throw new Error('YAW_ROOF_CAP_PROFILE_ROLE');
  return ids;
}

/** A ledge extends contact only inside the body's independently accepted old envelope. */
export function yawSpanLedgeFailures(ledge: SkyriverMass, host: SkyriverMass, approved: SkyriverMass): readonly string[] {
  const errors: string[] = [], box = independentMassRoofBox(ledge), tolerance = roofBoxTolerance(box);
  if (ledge.supportRole !== 'yaw-span-ledge' || (ledge.yawRad ?? 0) !== 0 || ledge.yawAnchor !== undefined || !(ledge.height > 0 && ledge.height <= 4) || ledge.baseRecord || ledge.artBacking) errors.push('ledge-role');
  const actual = massSection(ledge), bounds = massSection(approved);
  if (actual.x0 < bounds.x0 - tolerance || actual.x1 > bounds.x1 + tolerance || actual.z0 < bounds.z0 - tolerance || actual.z1 > bounds.z1 + tolerance || ledge.y0 < approved.y0 - tolerance || ledge.y0 + ledge.height > approved.y0 + approved.height + tolerance) errors.push('ledge-approved-crop');
  if (host.artBacking || host.supportRole || (host.yawRad ?? 0) === 0 || ledge.materialOwner !== host.materialOwner || ledge.building !== host.building || (ledge.anchorV ?? ledge.z) !== (host.anchorV ?? host.z) || ledge.tint !== host.tint) errors.push('ledge-host');
  if (retainedMassContact(box, independentMassRoofBox(host)) !== 'volume') errors.push('ledge-body-contact');
  return errors;
}

/** Decode an accepted pre-yaw stage only from saved inputs and the bounded recipe choices. */
export function independentApprovedStages(row: SkyriverEligibleTowerProfile, masses: readonly SkyriverMass[], seed: number): readonly (readonly (readonly number[])[])[] {
  const saved = beforeArt.rows.find(item => item.seed === seed)?.towers.find(tower => tower.towerIndex === row.towerIndex);
  if (!saved) throw new Error('YAW_SAVED_STAGE_INPUT');
  const tower = presentCityLayout(deriveCityLayout(seed)).towers[row.towerIndex]!;
  const originals: (readonly (readonly number[])[])[] = [];
  const crownBounds = sectionUnionBounds(saved.crown.boxes.map(old => massSection({ x: old[0]!, z: old[1]!, width: old[3]!, depth: old[4]! })));
  for (const [stageIndex, stage] of row.stages.entries()) {
    const ids = stage.massIndices.filter(index => masses[index]!.supportRole !== 'yaw-roof-cap'), actual = masses[ids[0]!]!;
    if (stageIndex < 2) { originals.push(saved.stages[stageIndex]!.boxes); continue; }
    const savedBox = saved.stages[stageIndex]?.boxes[0];
    const parent = originals[stageIndex - 1]![0]!, candidates: number[][] = [];
    if (savedBox && row.stages.length === saved.stages.length && actual.y0 === savedBox[2]) candidates.push([savedBox[0]!, savedBox[1]!, actual.y0, savedBox[3]!, savedBox[4]!, actual.height, saved.owner, saved.anchorV]);
    const preserveOldBoundary = saved.stages.length > 2 && Math.abs(actual.y0 - saved.stages[1]!.actual.y1) < 1e-7 && stageIndex === 2;
    if (preserveOldBoundary) { const old = saved.stages.at(-1)!.boxes[0]!; candidates.push([old[0]!, old[1]!, actual.y0, old[3]!, old[4]!, actual.height, saved.owner, saved.anchorV]); }
    for (const axis of ['x', 'z'] as const) for (const sign of [-1, 1]) for (const ratio of [.085, .14, .22, .30]) {
      const x = parent[0]! + (axis === 'x' ? sign * ratio * parent[3]! : 0), z = parent[1]! + (axis === 'z' ? sign * ratio * parent[4]! : 0);
      if (preserveOldBoundary) { const old = saved.stages.at(-1)!.boxes[0]!; candidates.push([x, z, actual.y0, old[3]!, old[4]!, actual.height, saved.owner, saved.anchorV]); }
      else for (const factor of [.55, .42, .25]) {
        const last = stageIndex === row.stages.length - 1;
        candidates.push([x, z, actual.y0, Math.max(Math.round(parent[3]! * factor), last ? 2 * Math.max(Math.abs(x - crownBounds.x0), Math.abs(crownBounds.x1 - x)) : 0),
          Math.max(Math.round(parent[4]! * factor), last ? 2 * Math.max(Math.abs(z - crownBounds.z0), Math.abs(crownBounds.z1 - z)) : 0), actual.height, saved.owner, saved.anchorV]);
      }
    }
    const cap = stage.massIndices.map(index => masses[index]!).find(mass => mass.supportRole === 'yaw-roof-cap');
    const offset = stage.offset; if (!offset) throw new Error('YAW_STAGE_SOURCE_OFFSET');
    const parentBounds = offset.parentKind === 'original-footprint' ? massSection(tower) : sectionUnionBounds(row.stages[offset.parentStageIndex]!.massIndices.map(index => massSection(masses[index]!)));
    const yaw = expectedTowerYaw(seed, tower, 170 + stageIndex * 17, actual.y0 + actual.height < 600);
    const selected = candidates.find(old => {
      if (cap && (cap.x !== old[0] || cap.z !== old[1] || cap.width !== old[3] || cap.depth !== old[4])) return false;
      const next = row.stages[stageIndex + 1], child = next?.offset;
      const nextCap = next?.massIndices.map(index => masses[index]!).find(mass => mass.supportRole === 'yaw-roof-cap');
      let nextCentres: readonly (number | undefined)[] = child?.parentKind === 'stage' && child.parentStageIndex === stageIndex
        ? [.085, .14, .22, .30].flatMap(ratio => [-1, 1].map(sign => old[child.axis === 'x' ? 0 : 1]! + sign * ratio * old[child.axis === 'x' ? 3 : 4]!)) : [undefined];
      if (nextCap && child) {
        const axisX = child.axis === 'x';
        const legalChild = [.085, .14, .22, .30].some(ratio => [-1, 1].some(sign => {
          const x = old[0]! + (axisX ? sign * ratio * old[3]! : 0), z = old[1]! + (axisX ? 0 : sign * ratio * old[4]!);
          return x === nextCap.x && z === nextCap.z && [.55, .42, .25].some(factor =>
            Math.max(Math.round(old[3]! * factor), 2 * Math.max(Math.abs(x - crownBounds.x0), Math.abs(crownBounds.x1 - x))) === nextCap.width
            && Math.max(Math.round(old[4]! * factor), 2 * Math.max(Math.abs(z - crownBounds.z0), Math.abs(crownBounds.z1 - z))) === nextCap.depth);
        }));
        const savedChild = saved.stages[stageIndex + 1]?.boxes[0];
        const oldParentKept = savedBox && [0, 1, 3, 4].every(field => old[field] === savedBox[field]);
        const savedChildKept = oldParentKept && savedChild && [nextCap.x, nextCap.z, nextCap.width, nextCap.depth].every((value, index) => value === savedChild[[0, 1, 3, 4][index]!]!);
        if (!legalChild && !savedChildKept) return false;
        nextCentres = [nextCap[child.axis]];
      }
      return nextCentres.some(nextCentre => {
        const context = stageIndex === row.stages.length - 1 ? undefined : { parent: parentBounds, axis: offset.axis, direction: Math.sign(offset.deltaM),
          ...(nextCentre === undefined || child === undefined || child === null ? {} : { next: { axis: child.axis, centre: nextCentre, direction: Math.sign(child.deltaM) } }) };
        let fit: ReturnType<typeof expectedBoundedStageFit>;
        try { fit = expectedBoundedStageFit({ x: old[0]!, z: old[1]!, width: old[3]!, depth: old[4]! }, yaw, context); } catch (error) { if (error instanceof Error && error.message === 'INDEPENDENT_SIZE_NO_FEASIBLE_AREA') return false; throw error; }
        return Math.abs(actual.x - fit.x) < 1e-7 && Math.abs(actual.z - fit.z) < 1e-7 && Math.abs(actual.width - fit.width) < 1e-7 && Math.abs(actual.depth - fit.depth) < 1e-7;
      });
    });
    if (!selected) throw new Error(`YAW_STAGE_SAVED_RECIPE_FIT:${seed}:${row.towerIndex}:${stageIndex}`);
    originals.push([selected]);
  }
  return originals;
}

/** Recover saved crown and lower-wing inputs before testing the cropped structural ledge. */
export function approvedYawHostEnvelope(host: SkyriverMass, hostIndex: number, profiles: readonly SkyriverTowerProfileRow[], seed: number, masses: readonly SkyriverMass[]): SkyriverMass {
  const row = profiles.find(profile => profile.eligibility.kind === 'eligible' && 'stages' in profile && [...profile.crown.massIndices, ...profile.stages.flatMap(stage => [...stage.massIndices]), ...profile.companionMassIndices].includes(hostIndex));
  if (!row || row.eligibility.kind !== 'eligible' || !('stages' in row)) throw new Error('YAW_LEDGE_UNPUBLISHED_HOST');
  const saved = beforeArt.rows.find(item => item.seed === seed)?.towers.find(tower => tower.towerIndex === row.towerIndex);
  if (!saved) throw new Error('YAW_LEDGE_SAVED_HOST');
  const crownOrdinal = row.crown.massIndices.indexOf(hostIndex);
  if (crownOrdinal >= 0) {
    const old = saved.crown.boxes[crownOrdinal]; if (!old) throw new Error('YAW_LEDGE_CROWN_INPUT');
    return { ...host, x: old[0]!, z: old[1]!, y0: old[2]!, width: old[3]!, depth: old[4]!, height: old[5]!, yawRad: 0, yawAnchor: undefined };
  }
  const stageIndex = row.stages.findIndex(stage => stage.massIndices.includes(hostIndex));
  const stageIds = stageIndex >= 0 ? row.stages[stageIndex]!.massIndices.filter(index => masses[index]!.supportRole !== 'yaw-roof-cap' && (!masses[index]!.yawWingPart || masses[index]!.yawWingPart!.part === 'roof')) : [];
  const rootHostIndex = host.yawWingPart?.roofMassIndex ?? hostIndex;
  const old = stageIndex >= 0 ? independentApprovedStages(row, masses, seed)[stageIndex]![stageIds.indexOf(rootHostIndex)] : saved.companions[row.companionMassIndices.indexOf(hostIndex)];
  if (!old) throw new Error('YAW_LEDGE_SAVED_HOST_BOX');
  return { ...host, x: old[0]!, z: old[1]!, y0: old[2]!, width: old[3]!, depth: old[4]!, height: old[5]!, yawRad: 0, yawAnchor: undefined };
}
