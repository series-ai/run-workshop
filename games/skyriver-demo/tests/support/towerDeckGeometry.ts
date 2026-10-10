import { buildingSeedOf, type SkyriverMass } from '../../src/render/city';
import { roofBoxTolerance } from './rooftopDetailsGeometry';
import { retainedMassContact } from './retainedMassContact';
import { physicalFootprint, artVolumeBox, addedVolumeCells } from './towerAddedVolume';
import { independentMassRoofBox, physicalSectionUnionArea, sourceBoxSection } from './towerProfileGeometry';

const owner = (mass: SkyriverMass) => mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);

/** Measure drawn members at the wing roof. A detached connector adds no deck area. */
export function physicalDeckSection(bodies: readonly SkyriverMass[], connectors: readonly SkyriverMass[], spine: SkyriverMass, roof: number) {
  const errors: string[] = [], spineBox = independentMassRoofBox(spine), bodyBoxes = bodies.map(independentMassRoofBox);
  if (!(spine.width >= 1 && spine.depth > 0 && spine.height > 0)) errors.push('spine-dimensions');
  const roofMember = (mass: SkyriverMass) => {
    const epsilon = roofBoxTolerance(independentMassRoofBox(mass));
    return mass.y0 < roof - epsilon && Math.abs(mass.y0 + mass.height - roof) <= epsilon;
  };
  for (const [index, body] of bodies.entries()) {
    if (!roofMember(body)) errors.push(`body${index}:roof-section`);
    if (!(Math.min(body.width, body.depth, body.height) > 0)) errors.push(`body${index}:dimensions`);
    if (owner(body) !== owner(spine) || (body.anchorV ?? body.z) !== (spine.anchorV ?? spine.z)) errors.push(`body${index}:frame`);
    if (spine.y0 > body.y0 || spine.y0 + spine.height < roof + 8) errors.push(`body${index}:continuous-spine`);
  }
  const admitted = connectors.flatMap((connector, index) => {
    const box = independentMassRoofBox(connector), faults: string[] = [];
    if (!roofMember(connector)) faults.push('roof-section');
    if (!(Math.min(connector.width, connector.depth, connector.height) > 0 && connector.height <= 4)) faults.push('dimensions');
    if (owner(connector) !== owner(spine) || (connector.anchorV ?? connector.z) !== (spine.anchorV ?? spine.z)) faults.push('frame');
    if (retainedMassContact(box, spineBox) === null) faults.push('spine-contact');
    if (!bodyBoxes.some(body => retainedMassContact(box, body) !== null)) faults.push('body-contact');
    errors.push(...faults.map(fault => `connector${index}:${fault}`));
    return faults.length === 0 ? [{ index, mass: connector, box }] : [];
  });
  for (const [index, body] of bodyBoxes.entries()) {
    if (retainedMassContact(body, spineBox) === null && !admitted.some(connector => retainedMassContact(body, connector.box) !== null)) errors.push(`body${index}:spine-path`);
  }
  const roofBodies = bodies.filter(roofMember), members = [...roofBodies, ...admitted.map(connector => connector.mass)];
  const bodyArea = physicalSectionUnionArea(roofBodies), deckArea = physicalSectionUnionArea(members), spineArea = physicalSectionUnionArea([spine]);
  if (!(deckArea > 0)) errors.push('empty-deck');
  if (!(spineArea < deckArea * .25)) errors.push('spine-share');
  return { errors, members, connectorIndices: admitted.map(connector => connector.index), bodyArea, deckArea, spineArea,
    bodySpineShare: spineArea / bodyArea, deckSpineShare: spineArea / deckArea };
}

/** Each upper member needs a path made from actual positive-area contacts. */
export function physicalTowerStageSupport(stages: readonly (readonly SkyriverMass[])[], spine: SkyriverMass, connectors: readonly SkyriverMass[] = []) {
  const members = [spine, ...stages.flat(), ...connectors], boxes = members.map(independentMassRoofBox), neighbours = boxes.map(() => [] as number[]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (retainedMassContact(boxes[i]!, boxes[j]!) !== null) { neighbours[i]!.push(j); neighbours[j]!.push(i); }
  }
  const paths = new Map<number, readonly number[]>([[0, [0]]]), queue = [0];
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]!;
    for (const to of neighbours[from]!) if (!paths.has(to)) { paths.set(to, [...paths.get(from)!, to]); queue.push(to); }
  }
  let offset = 1;
  const stagePaths = stages.map(stage => stage.map(() => paths.get(offset++) ?? null));
  const errors = stagePaths.flatMap((stage, stageIndex) => stage.flatMap((path, memberIndex) => path === null ? [`stage${stageIndex}:member${memberIndex}:spine-path`] : []));
  const adjacentContacts = stages.slice(1).map((stage, index) => stage.flatMap((upper, upperIndex) => stages[index]!.flatMap((lower, lowerIndex) => {
    const contact = retainedMassContact(independentMassRoofBox(lower), independentMassRoofBox(upper));
    return contact === null ? [] : [{ lowerIndex, upperIndex, contact }];
  })));
  return { errors, stagePaths, adjacentContacts };
}

/** Include the whole drawn deck above its tested roof. */
export function physicalDeckRoofAir(members: readonly SkyriverMass[], spine: SkyriverMass, roof: number) {
  const spineBox = { ...artVolumeBox(spine, owner(spine)), y0: roof, height: 8 };
  return members.flatMap(member => addedVolumeCells({ ...artVolumeBox(member, owner(member)), y0: roof, height: 8 }, [spineBox]));
}

/** Use the saved host volume and the existing physical float tolerance. */
export function deckMemberContainmentFailures(member: SkyriverMass, approved: SkyriverMass): readonly string[] {
  const bounds = sourceBoxSection(approved), epsilon = Math.max(roofBoxTolerance(independentMassRoofBox(member)), roofBoxTolerance(independentMassRoofBox(approved)));
  const errors: string[] = [];
  if (owner(member) !== owner(approved) || (member.anchorV ?? member.z) !== (approved.anchorV ?? approved.z)) errors.push('source-frame');
  if ((approved.yawRad ?? 0) !== 0 || approved.yawAnchor !== undefined) errors.push('source-yaw');
  if (member.y0 < approved.y0 - epsilon || member.y0 + member.height > approved.y0 + approved.height + epsilon) errors.push('source-height');
  if (physicalFootprint(artVolumeBox(member, owner(member))).some(([x, z]) => x < bounds.x0 - epsilon || x > bounds.x1 + epsilon || z < bounds.z0 - epsilon || z > bounds.z1 + epsilon)) errors.push('source-footprint');
  return errors;
}
