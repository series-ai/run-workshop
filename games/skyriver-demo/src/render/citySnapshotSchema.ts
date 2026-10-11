import type { SkyriverCitySnapshot } from './city';

type TrimsFamily = SkyriverCitySnapshot['trims'];
type MassesFamily = SkyriverCitySnapshot['masses'];
type MassItem = MassesFamily[number];
type MassSeedOrdinalsFamily = SkyriverCitySnapshot['massSeedOrdinals'];
type RoofDetailsFamily = SkyriverCitySnapshot['roofDetails'];
type RoofDetailRecordItem = RoofDetailsFamily['records'][number];
type ReconciliationFamily = SkyriverCitySnapshot['reconciliation'];
type SourceInventoryItem = ReconciliationFamily['sourceInventory'][number];
type DispositionItem = ReconciliationFamily['dispositions'][number];
type RetainedSupportFamily = SkyriverCitySnapshot['retainedSupport'];
type RetainedSupportItem = RetainedSupportFamily[number];
type FarFamily = SkyriverCitySnapshot['far'];
type FarItem = FarFamily[number];
type MegaFamily = SkyriverCitySnapshot['mega'];
type MegaItem = MegaFamily[number];
type TiersFamily = SkyriverCitySnapshot['tiers'];
type FacadeFacesFamily = SkyriverCitySnapshot['facadeFaces'];
type FacadeFaceItem = FacadeFacesFamily[number];
type LegacyFacesFamily = SkyriverCitySnapshot['legacyFaces'];
type TowerProfilesFamily = SkyriverCitySnapshot['towerProfiles'];
type TowerProfileRowItem = TowerProfilesFamily[number];
type SignsFamily = SkyriverCitySnapshot['signs'];
type SignMountItem = SignsFamily['mount'][number];
type RoofDetailHeroBoxesFamily = SkyriverCitySnapshot['roofDetailHeroBoxes'];
type RoofDetailHeroBoxItem = RoofDetailHeroBoxesFamily[number];
type HeroesFamily = SkyriverCitySnapshot['heroes'];
type HeroItem = HeroesFamily[number];
type TrimOwnerItem = TrimsFamily['owner'][number];
type TrimGeometryItem = DispositionItem['oldGeometry'];

function fail(message: string): never {
  throw new Error(message);
}

function assertRecord(value: unknown, context: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${context}: expected plain record object`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    fail(`${context}: unsupported record prototype`);
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc || desc.get !== undefined || desc.set !== undefined || !('value' in desc)) {
      fail(`${context}: accessor property not supported: ${key}`);
    }
  }
  return value as Record<string, unknown>;
}

function readDataDescriptor(record: Record<string, unknown>, key: string): PropertyDescriptor | undefined {
  const desc = Object.getOwnPropertyDescriptor(record, key);
  if (desc !== undefined) {
    if (desc.get !== undefined || desc.set !== undefined || !('value' in desc)) {
      fail(`Accessor property not supported: ${key}`);
    }
  }
  return desc;
}

function readRequired(record: Record<string, unknown>, key: string, context: string): unknown {
  const desc = readDataDescriptor(record, key);
  if (desc === undefined) {
    fail(`${context}: missing required property '${key}'`);
  }
  if (desc.value === null || desc.value === undefined) {
    fail(`${context}: required property '${key}' cannot be null or undefined`);
  }
  return desc.value;
}

function readNullable(record: Record<string, unknown>, key: string, context: string): unknown {
  const desc = readDataDescriptor(record, key);
  if (desc === undefined) {
    fail(`${context}: missing required property '${key}'`);
  }
  if (desc.value === undefined) {
    fail(`${context}: property '${key}' cannot be undefined`);
  }
  return desc.value;
}

function readOptional(record: Record<string, unknown>, key: string): unknown {
  const desc = readDataDescriptor(record, key);
  if (desc === undefined || desc.value === undefined) {
    return undefined;
  }
  return desc.value;
}

function validateFiniteNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${context}: expected finite number`);
  }
  return value;
}

function validateFiniteNonNegative(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${context}: expected finite non-negative number`);
  }
  return value;
}

function validateSafeInteger(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    fail(`${context}: expected safe integer`);
  }
  return value;
}

function validateSafeNonNegativeInteger(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`${context}: expected safe non-negative integer`);
  }
  return value;
}

function validateIndexBound(value: unknown, bound: number, context: string): number {
  const idx = validateSafeNonNegativeInteger(value, context);
  if (idx >= bound) {
    fail(`${context}: index ${idx} out of bounds (${bound})`);
  }
  return idx;
}

function validateString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    fail(`${context}: expected string`);
  }
  return value;
}

function validateBoolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') {
    fail(`${context}: expected boolean`);
  }
  return value;
}

function validateLiteral<T extends string | number | boolean>(value: unknown, allowed: readonly T[], context: string): T {
  for (let i = 0; i < allowed.length; i += 1) {
    if (value === allowed[i]) {
      return value as T;
    }
  }
  fail(`${context}: unexpected literal value ${String(value)}`);
}

function validateDenseArray<T>(
  value: unknown,
  context: string,
  validateItem: (item: unknown, index: number) => T,
): readonly T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail(`${context}: expected dense array`);
  }
  const len = value.length;
  for (let i = 0; i < len; i += 1) {
    const desc = Object.getOwnPropertyDescriptor(value, i);
    if (desc === undefined || desc.get !== undefined || desc.set !== undefined || !('value' in desc)) {
      fail(`${context}: sparse member or accessor at index ${i}`);
    }
    validateItem(desc.value, i);
  }
  return value as unknown as readonly T[];
}

const typedArrayLengthGetter = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  'length',
)?.get;

function getIntrinsicTypedArrayCapacity(value: ArrayBufferView, context: string): number {
  if (typedArrayLengthGetter === undefined) {
    fail(`${context}: TypedArray length descriptor missing`);
  }
  try {
    const len = typedArrayLengthGetter.call(value);
    if (typeof len !== 'number' || !Number.isFinite(len) || len < 0) {
      fail(`${context}: invalid intrinsic TypedArray length`);
    }
    return len;
  } catch {
    fail(`${context}: failed to read intrinsic TypedArray length`);
  }
}

function validateFloat32Array(value: unknown, minLength: number, context: string, minimum = -Infinity): Float32Array {
  if (!(value instanceof Float32Array)) {
    fail(`${context}: expected Float32Array`);
  }
  const capacity = getIntrinsicTypedArrayCapacity(value, context);
  if (capacity < minLength) {
    fail(`${context}: Float32Array capacity too small (${capacity} < ${minLength})`);
  }
  for (let i = 0; i < minLength; i += 1) {
    const v = value[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < minimum) {
      fail(`${context}: invalid Float32Array value at ${i}`);
    }
  }
  return value;
}

function validateFloat64Array(value: unknown, minLength: number, context: string): Float64Array {
  if (!(value instanceof Float64Array)) {
    fail(`${context}: expected Float64Array`);
  }
  const capacity = getIntrinsicTypedArrayCapacity(value, context);
  if (capacity < minLength) {
    fail(`${context}: Float64Array capacity too small (${capacity} < ${minLength})`);
  }
  for (let i = 0; i < minLength; i += 1) {
    const v = value[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      fail(`${context}: non-finite Float64Array value at ${i}`);
    }
  }
  return value;
}

function validateUint8Array(value: unknown, minLength: number, context: string, maxKind = 255): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    fail(`${context}: expected Uint8Array`);
  }
  const capacity = getIntrinsicTypedArrayCapacity(value, context);
  if (capacity < minLength) {
    fail(`${context}: Uint8Array capacity too small (${capacity} < ${minLength})`);
  }
  for (let i = 0; i < minLength; i += 1) {
    const v = value[i];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > maxKind) {
      fail(`${context}: invalid Uint8Array value ${String(v)} at ${i} (expected integer 0..${maxKind})`);
    }
  }
  return value;
}

function validateTrimOwner(value: unknown, context: string, seenOwners: Set<object>): TrimOwnerItem {
  if (value === null || typeof value !== 'object') {
    fail(`${context}: expected trim owner object`);
  }
  if (seenOwners.has(value)) {
    return value as TrimOwnerItem;
  }
  const record = assertRecord(value, context);
  validateFiniteNumber(readRequired(record, 'x', context), `${context}.x`);
  validateFiniteNumber(readRequired(record, 'z', context), `${context}.z`);
  validateFiniteNonNegative(readRequired(record, 'width', context), `${context}.width`);
  validateFiniteNonNegative(readRequired(record, 'depth', context), `${context}.depth`);
  validateFiniteNumber(readRequired(record, 'anchorV', context), `${context}.anchorV`);

  const yawRad = readOptional(record, 'yawRad');
  if (yawRad !== undefined) {
    validateFiniteNumber(yawRad, `${context}.yawRad`);
  }
  const materialOwner = readOptional(record, 'materialOwner');
  if (materialOwner !== undefined) {
    validateFiniteNumber(materialOwner, `${context}.materialOwner`);
  }
  const yawAnchor = readOptional(record, 'yawAnchor');
  if (yawAnchor !== undefined) {
    const yawAnchorRecord = assertRecord(yawAnchor, `${context}.yawAnchor`);
    validateFiniteNumber(readRequired(yawAnchorRecord, 'x', `${context}.yawAnchor`), `${context}.yawAnchor.x`);
    validateFiniteNumber(readRequired(yawAnchorRecord, 'z', `${context}.yawAnchor`), `${context}.yawAnchor.z`);
  }
  seenOwners.add(value);
  return value as TrimOwnerItem;
}

function validateTrimGeometry(value: unknown, context: string): TrimGeometryItem {
  const record = assertRecord(value, context);
  validateFiniteNumber(readRequired(record, 'cx', context), `${context}.cx`);
  validateFiniteNumber(readRequired(record, 'cy', context), `${context}.cy`);
  validateFiniteNumber(readRequired(record, 'cz', context), `${context}.cz`);
  validateFiniteNonNegative(readRequired(record, 'sx', context), `${context}.sx`);
  validateFiniteNonNegative(readRequired(record, 'sy', context), `${context}.sy`);
  validateFiniteNonNegative(readRequired(record, 'sz', context), `${context}.sz`);
  return value as TrimGeometryItem;
}

function validateFacadeFace(value: unknown, context: string, seenOwners: Set<object>): FacadeFaceItem {
  const record = assertRecord(value, context);
  validateString(readRequired(record, 'id', context), `${context}.id`);
  validateString(readRequired(record, 'buildingId', context), `${context}.buildingId`);
  validateLiteral(readRequired(record, 'side', context), [-1, 1] as const, `${context}.side`);
  validateLiteral(readRequired(record, 'planeAxis', context), ['x', 'z'] as const, `${context}.planeAxis`);
  validateFiniteNumber(readRequired(record, 'plane', context), `${context}.plane`);
  validateLiteral(readRequired(record, 'outward', context), [-1, 1] as const, `${context}.outward`);
  validateBoolean(readRequired(record, 'stepBottom', context), `${context}.stepBottom`);
  validateBoolean(readRequired(record, 'stepTop', context), `${context}.stepTop`);
  validateFiniteNumber(readRequired(record, 'u0', context), `${context}.u0`);
  validateFiniteNumber(readRequired(record, 'u1', context), `${context}.u1`);
  validateFiniteNumber(readRequired(record, 'y0', context), `${context}.y0`);
  validateFiniteNumber(readRequired(record, 'y1', context), `${context}.y1`);
  validateFiniteNumber(readRequired(record, 'projection', context), `${context}.projection`);
  validateTrimOwner(readRequired(record, 'owner', context), `${context}.owner`, seenOwners);
  return value as FacadeFaceItem;
}

function validateTrims(value: unknown, seenOwners: Set<object>): TrimsFamily {
  const record = assertRecord(value, 'trims');
  const count = validateSafeNonNegativeInteger(readRequired(record, 'count', 'trims'), 'trims.count');
  validateSafeInteger(readRequired(record, 'seed', 'trims'), 'trims.seed');

  validateFloat32Array(readRequired(record, 'cx', 'trims'), count, 'trims.cx');
  validateFloat32Array(readRequired(record, 'cy', 'trims'), count, 'trims.cy');
  validateFloat32Array(readRequired(record, 'cz', 'trims'), count, 'trims.cz');
  validateFloat32Array(readRequired(record, 'sx', 'trims'), count, 'trims.sx', 0);
  validateFloat32Array(readRequired(record, 'sy', 'trims'), count, 'trims.sy', 0);
  validateFloat32Array(readRequired(record, 'sz', 'trims'), count, 'trims.sz', 0);
  validateFloat32Array(readRequired(record, 'seedValue', 'trims'), count, 'trims.seedValue');
  validateUint8Array(readRequired(record, 'kind', 'trims'), count, 'trims.kind', 9);

  const ownersRaw = readRequired(record, 'owner', 'trims');
  const owners = validateDenseArray(ownersRaw, 'trims.owner', (item, idx) => validateTrimOwner(item, `trims.owner[${idx}]`, seenOwners));
  if (owners.length < count) {
    fail(`trims.owner array length ${owners.length} smaller than count ${count}`);
  }

  const spanToRaw = readRequired(record, 'spanTo', 'trims');
  const spanTo = validateDenseArray(spanToRaw, 'trims.spanTo', (item, idx) => {
    if (item === null) return null;
    return validateTrimOwner(item, `trims.spanTo[${idx}]`, seenOwners);
  });
  if (spanTo.length < count) {
    fail(`trims.spanTo array length ${spanTo.length} smaller than count ${count}`);
  }

  return value as TrimsFamily;
}

function validateMass(value: unknown, index: number, massCount: number, trimCount: number, seenOwners: Set<object>): MassItem {
  const context = `masses[${index}]`;
  const record = assertRecord(value, context);
  validateFiniteNumber(readRequired(record, 'x', context), `${context}.x`);
  validateFiniteNumber(readRequired(record, 'y0', context), `${context}.y0`);
  validateFiniteNumber(readRequired(record, 'z', context), `${context}.z`);
  validateFiniteNonNegative(readRequired(record, 'width', context), `${context}.width`);
  validateFiniteNonNegative(readRequired(record, 'height', context), `${context}.height`);
  validateFiniteNonNegative(readRequired(record, 'depth', context), `${context}.depth`);
  validateSafeInteger(readRequired(record, 'tint', context), `${context}.tint`);

  const yawRad = readOptional(record, 'yawRad');
  if (yawRad !== undefined) validateFiniteNumber(yawRad, `${context}.yawRad`);

  const yawAnchor = readOptional(record, 'yawAnchor');
  if (yawAnchor !== undefined) {
    const yawAnchorRecord = assertRecord(yawAnchor, `${context}.yawAnchor`);
    validateFiniteNumber(readRequired(yawAnchorRecord, 'x', `${context}.yawAnchor`), `${context}.yawAnchor.x`);
    validateFiniteNumber(readRequired(yawAnchorRecord, 'z', `${context}.yawAnchor`), `${context}.yawAnchor.z`);
  }

  const yawWingPart = readOptional(record, 'yawWingPart');
  if (yawWingPart !== undefined) {
    const wingRecord = assertRecord(yawWingPart, `${context}.yawWingPart`);
    validateIndexBound(readRequired(wingRecord, 'roofMassIndex', `${context}.yawWingPart`), massCount, `${context}.yawWingPart.roofMassIndex`);
    validateLiteral(readRequired(wingRecord, 'part', `${context}.yawWingPart`), ['below', 'band', 'roof'] as const, `${context}.yawWingPart.part`);
    validateFiniteNumber(readRequired(wingRecord, 'cutLow', `${context}.yawWingPart`), `${context}.yawWingPart.cutLow`);
    validateFiniteNumber(readRequired(wingRecord, 'cutHigh', `${context}.yawWingPart`), `${context}.yawWingPart.cutHigh`);
  }

  const layer = readOptional(record, 'layer');
  if (layer !== undefined) validateFiniteNumber(layer, `${context}.layer`);

  const anchorV = readOptional(record, 'anchorV');
  if (anchorV !== undefined) validateFiniteNumber(anchorV, `${context}.anchorV`);

  const building = readOptional(record, 'building');
  if (building !== undefined) validateFiniteNumber(building, `${context}.building`);

  const stepBottom = readOptional(record, 'stepBottom');
  if (stepBottom !== undefined) validateBoolean(stepBottom, `${context}.stepBottom`);

  const stepTop = readOptional(record, 'stepTop');
  if (stepTop !== undefined) validateBoolean(stepTop, `${context}.stepTop`);

  const materialOwner = readOptional(record, 'materialOwner');
  if (materialOwner !== undefined) validateFiniteNumber(materialOwner, `${context}.materialOwner`);

  const baseRecord = readOptional(record, 'baseRecord');
  if (baseRecord !== undefined) {
    const baseRec = assertRecord(baseRecord, `${context}.baseRecord`);
    validateLiteral(readRequired(baseRec, 'kind', `${context}.baseRecord`), ['skirt', 'infill', 'link', 'equipment'] as const, `${context}.baseRecord.kind`);
    validateString(readRequired(baseRec, 'towerOwner', `${context}.baseRecord`), `${context}.baseRecord.towerOwner`);
    validateLiteral(readRequired(baseRec, 'cluster', `${context}.baseRecord`), [0, 1, 2, 3] as const, `${context}.baseRecord.cluster`);
  }

  const supportRole = readOptional(record, 'supportRole');
  if (supportRole !== undefined) {
    validateLiteral(supportRole, ['retained-child-bridge', 'yaw-roof-cap', 'yaw-span-ledge'] as const, `${context}.supportRole`);
  }

  const supportHostMassIndex = readOptional(record, 'supportHostMassIndex');
  if (supportHostMassIndex !== undefined) {
    validateIndexBound(supportHostMassIndex, massCount, `${context}.supportHostMassIndex`);
  }

  const supportSourceTrimIndex = readOptional(record, 'supportSourceTrimIndex');
  if (supportSourceTrimIndex !== undefined) {
    validateIndexBound(supportSourceTrimIndex, trimCount, `${context}.supportSourceTrimIndex`);
  }

  const supportSpanEndpoint = readOptional(record, 'supportSpanEndpoint');
  if (supportSpanEndpoint !== undefined) {
    validateLiteral(supportSpanEndpoint, [0, 1] as const, `${context}.supportSpanEndpoint`);
  }

  const crownRole = readOptional(record, 'crownRole');
  if (crownRole !== undefined) {
    validateLiteral(crownRole, ['ordinary-dark-crown'] as const, `${context}.crownRole`);
  }

  const artBacking = readOptional(record, 'artBacking');
  if (artBacking !== undefined) {
    const artRecord = assertRecord(artBacking, `${context}.artBacking`);
    validateIndexBound(readRequired(artRecord, 'hostMassIndex', `${context}.artBacking`), massCount, `${context}.artBacking.hostMassIndex`);
    validateString(readRequired(artRecord, 'faceId', `${context}.artBacking`), `${context}.artBacking.faceId`);
  }

  return value as MassItem;
}

function validateMassSeedOrdinals(value: unknown, massCount: number): MassSeedOrdinalsFamily {
  const ordinals = validateDenseArray(value, 'massSeedOrdinals', (item, idx) => {
    if (item === undefined) {
      return undefined;
    }
    return validateSafeNonNegativeInteger(item, `massSeedOrdinals[${idx}]`);
  });
  if (ordinals.length !== massCount) {
    fail(`massSeedOrdinals length ${ordinals.length} does not match masses length ${massCount}`);
  }
  return value as MassSeedOrdinalsFamily;
}

function validateStratumTuple(value: unknown, context: string): readonly [number, number, number] {
  const tuple = validateDenseArray(value, context, (item, idx) => validateSafeNonNegativeInteger(item, `${context}[${idx}]`));
  if (tuple.length !== 3) {
    fail(`${context}: expected tuple of length 3`);
  }
  return value as unknown as readonly [number, number, number];
}

function validateRoofDetails(value: unknown, massCount: number, trimCount: number): RoofDetailsFamily {
  const record = assertRecord(value, 'roofDetails');
  validateSafeNonNegativeInteger(readRequired(record, 'oldTrimCount', 'roofDetails'), 'roofDetails.oldTrimCount');
  validateSafeNonNegativeInteger(readRequired(record, 'totalTrimCount', 'roofDetails'), 'roofDetails.totalTrimCount');
  validateStratumTuple(readRequired(record, 'requestedByStratum', 'roofDetails'), 'roofDetails.requestedByStratum');
  validateStratumTuple(readRequired(record, 'acceptedByStratum', 'roofDetails'), 'roofDetails.acceptedByStratum');
  validateStratumTuple(readRequired(record, 'rejectedSupportByStratum', 'roofDetails'), 'roofDetails.rejectedSupportByStratum');
  validateStratumTuple(readRequired(record, 'rejectedCollisionByStratum', 'roofDetails'), 'roofDetails.rejectedCollisionByStratum');
  validateStratumTuple(readRequired(record, 'rejectedBudgetByStratum', 'roofDetails'), 'roofDetails.rejectedBudgetByStratum');

  const recordsRaw = readRequired(record, 'records', 'roofDetails');
  validateDenseArray(recordsRaw, 'roofDetails.records', (item, idx) => {
    const itemContext = `roofDetails.records[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateIndexBound(readRequired(rec, 'trimIndex', itemContext), trimCount, `${itemContext}.trimIndex`);
    validateIndexBound(readRequired(rec, 'supportMassIndex', itemContext), massCount, `${itemContext}.supportMassIndex`);
    validateSafeNonNegativeInteger(readRequired(rec, 'clusterId', itemContext), `${itemContext}.clusterId`);
    validateLiteral(readRequired(rec, 'role', itemContext), ['tank', 'vent', 'pipe', 'stairhouse', 'hvac', 'pad', 'mast'] as const, `${itemContext}.role`);
    validateLiteral(readRequired(rec, 'stratum', itemContext), ['grime', 'mid', 'pristine'] as const, `${itemContext}.stratum`);
    return item as RoofDetailRecordItem;
  });

  return value as RoofDetailsFamily;
}

function validateReconciliation(value: unknown, massCount: number, seenOwners: Set<object>): ReconciliationFamily {
  const record = assertRecord(value, 'reconciliation');
  validateSafeInteger(readRequired(record, 'seed', 'reconciliation'), 'reconciliation.seed');
  validateSafeNonNegativeInteger(readRequired(record, 'sourceCount', 'reconciliation'), 'reconciliation.sourceCount');
  validateSafeNonNegativeInteger(readRequired(record, 'finalCount', 'reconciliation'), 'reconciliation.finalCount');
  validateString(readRequired(record, 'inventoryIdentity', 'reconciliation'), 'reconciliation.inventoryIdentity');
  validateSafeNonNegativeInteger(readRequired(record, 'unchangedCount', 'reconciliation'), 'reconciliation.unchangedCount');
  validateSafeNonNegativeInteger(readRequired(record, 'rehostedCount', 'reconciliation'), 'reconciliation.rehostedCount');
  validateSafeNonNegativeInteger(readRequired(record, 'roofRowsDeferred', 'reconciliation'), 'reconciliation.roofRowsDeferred');
  validateSafeNonNegativeInteger(readRequired(record, 'spanRowsDeferred', 'reconciliation'), 'reconciliation.spanRowsDeferred');

  const sourceRaw = readRequired(record, 'sourceInventory', 'reconciliation');
  validateDenseArray(sourceRaw, 'reconciliation.sourceInventory', (item, idx) => {
    const itemContext = `reconciliation.sourceInventory[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateSafeNonNegativeInteger(readRequired(rec, 'sourceIndex', itemContext), `${itemContext}.sourceIndex`);
    validateSafeNonNegativeInteger(readRequired(rec, 'kind', itemContext), `${itemContext}.kind`);
    validateFiniteNumber(readRequired(rec, 'cx', itemContext), `${itemContext}.cx`);
    validateFiniteNumber(readRequired(rec, 'cy', itemContext), `${itemContext}.cy`);
    validateFiniteNumber(readRequired(rec, 'cz', itemContext), `${itemContext}.cz`);
    validateFiniteNonNegative(readRequired(rec, 'sx', itemContext), `${itemContext}.sx`);
    validateFiniteNonNegative(readRequired(rec, 'sy', itemContext), `${itemContext}.sy`);
    validateFiniteNonNegative(readRequired(rec, 'sz', itemContext), `${itemContext}.sz`);
    validateFiniteNumber(readRequired(rec, 'seedValue', itemContext), `${itemContext}.seedValue`);
    validateFiniteNumber(readRequired(rec, 'seedBits', itemContext), `${itemContext}.seedBits`);
    validateFiniteNumber(readRequired(rec, 'canonicalOwner', itemContext), `${itemContext}.canonicalOwner`);
    validateTrimOwner(readRequired(rec, 'owner', itemContext), `${itemContext}.owner`, seenOwners);
    const spanTo = readNullable(rec, 'spanTo', itemContext);
    if (spanTo !== null) {
      validateTrimOwner(spanTo, `${itemContext}.spanTo`, seenOwners);
    }
    return item as SourceInventoryItem;
  });

  const dispRaw = readRequired(record, 'dispositions', 'reconciliation');
  validateDenseArray(dispRaw, 'reconciliation.dispositions', (item, idx) => {
    const itemContext = `reconciliation.dispositions[${idx}]`;
    const rec = assertRecord(item, itemContext);
    const kind = validateLiteral(
      readRequired(rec, 'kind', itemContext),
      ['unchanged', 'side-rehosted', 'roof-rehosted', 'inherited-roof-unsupported', 'span-rehosted', 'inherited-span-unsupported'] as const,
      `${itemContext}.kind`,
    );
    validateSafeNonNegativeInteger(readRequired(rec, 'sourceIndex', itemContext), `${itemContext}.sourceIndex`);
    validateSafeNonNegativeInteger(readRequired(rec, 'finalIndex', itemContext), `${itemContext}.finalIndex`);
    validateBoolean(readRequired(rec, 'heroFiltered', itemContext), `${itemContext}.heroFiltered`);

    const heroIdsRaw = readRequired(rec, 'blockingHeroIds', itemContext);
    validateDenseArray(heroIdsRaw, `${itemContext}.blockingHeroIds`, (idItem, idIdx) =>
      validateString(idItem, `${itemContext}.blockingHeroIds[${idIdx}]`),
    );

    validateTrimGeometry(readRequired(rec, 'oldGeometry', itemContext), `${itemContext}.oldGeometry`);
    validateTrimGeometry(readRequired(rec, 'newGeometry', itemContext), `${itemContext}.newGeometry`);

    if (kind === 'side-rehosted') {
      validateIndexBound(readRequired(rec, 'hostMassIndex', itemContext), massCount, `${itemContext}.hostMassIndex`);
      validateString(readRequired(rec, 'faceId', itemContext), `${itemContext}.faceId`);
    } else if (kind === 'roof-rehosted') {
      validateIndexBound(readRequired(rec, 'hostMassIndex', itemContext), massCount, `${itemContext}.hostMassIndex`);
      validateFiniteNumber(readRequired(rec, 'horizontalScale', itemContext), `${itemContext}.horizontalScale`);
    } else if (kind === 'span-rehosted') {
      const hostsRaw = readRequired(rec, 'hosts', itemContext);
      const hosts = validateDenseArray(hostsRaw, `${itemContext}.hosts`, (hostItem, hostIdx) => {
        const hostRec = assertRecord(hostItem, `${itemContext}.hosts[${hostIdx}]`);
        validateIndexBound(readRequired(hostRec, 'massIndex', `${itemContext}.hosts[${hostIdx}]`), massCount, `${itemContext}.hosts[${hostIdx}].massIndex`);
        validateFiniteNumber(readRequired(hostRec, 'canonicalOwner', `${itemContext}.hosts[${hostIdx}]`), `${itemContext}.hosts[${hostIdx}].canonicalOwner`);
        validateFiniteNumber(readRequired(hostRec, 'anchorV', `${itemContext}.hosts[${hostIdx}]`), `${itemContext}.hosts[${hostIdx}].anchorV`);
        return hostItem;
      });
      if (hosts.length !== 2) fail(`${itemContext}.hosts: expected 2 host entries`);

      const validateWorldMetrics = (wmVal: unknown, wmCtx: string): void => {
        const wmRec = assertRecord(wmVal, wmCtx);
        const epRaw = readRequired(wmRec, 'endpoints', wmCtx);
        const eps = validateDenseArray(epRaw, `${wmCtx}.endpoints`, (epItem, epIdx) => {
          const epRec = assertRecord(epItem, `${wmCtx}.endpoints[${epIdx}]`);
          validateFiniteNumber(readRequired(epRec, 'x', `${wmCtx}.endpoints[${epIdx}]`), `${wmCtx}.endpoints[${epIdx}].x`);
          validateFiniteNumber(readRequired(epRec, 'y', `${wmCtx}.endpoints[${epIdx}]`), `${wmCtx}.endpoints[${epIdx}].y`);
          validateFiniteNumber(readRequired(epRec, 'z', `${wmCtx}.endpoints[${epIdx}]`), `${wmCtx}.endpoints[${epIdx}].z`);
          return epItem;
        });
        if (eps.length !== 2) fail(`${wmCtx}.endpoints: expected 2 endpoint entries`);
        validateFiniteNumber(readRequired(wmRec, 'sourceLengthM', wmCtx), `${wmCtx}.sourceLengthM`);
        validateFiniteNumber(readRequired(wmRec, 'worldLengthM', wmCtx), `${wmCtx}.worldLengthM`);
        validateFiniteNumber(readRequired(wmRec, 'exposedLengthM', wmCtx), `${wmCtx}.exposedLengthM`);
      };

      validateWorldMetrics(readRequired(rec, 'oldWorld', itemContext), `${itemContext}.oldWorld`);
      validateWorldMetrics(readRequired(rec, 'newWorld', itemContext), `${itemContext}.newWorld`);

      const contactsRaw = readRequired(rec, 'endpointContacts', itemContext);
      const contacts = validateDenseArray(contactsRaw, `${itemContext}.endpointContacts`, (cItem, cIdx) => {
        const cRec = assertRecord(cItem, `${itemContext}.endpointContacts[${cIdx}]`);
        validateFiniteNumber(readRequired(cRec, 'crossOverlapM', `${itemContext}.endpointContacts[${cIdx}]`), `${itemContext}.endpointContacts[${cIdx}].crossOverlapM`);
        validateFiniteNumber(readRequired(cRec, 'verticalOverlapM', `${itemContext}.endpointContacts[${cIdx}]`), `${itemContext}.endpointContacts[${cIdx}].verticalOverlapM`);
        return cItem;
      });
      if (contacts.length !== 2) fail(`${itemContext}.endpointContacts: expected 2 contact entries`);
    }

    return item as DispositionItem;
  });

  return value as ReconciliationFamily;
}

function validateRetainedSupport(value: unknown, massCount: number): RetainedSupportFamily {
  return validateDenseArray(value, 'retainedSupport', (item, idx) => {
    const itemContext = `retainedSupport[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateIndexBound(readRequired(rec, 'supportMassIndex', itemContext), massCount, `${itemContext}.supportMassIndex`);
    validateSafeNonNegativeInteger(readRequired(rec, 'childSourceIndex', itemContext), `${itemContext}.childSourceIndex`);
    validateSafeNonNegativeInteger(readRequired(rec, 'childFinalIndex', itemContext), `${itemContext}.childFinalIndex`);
    validateIndexBound(readRequired(rec, 'hostMassIndex', itemContext), massCount, `${itemContext}.hostMassIndex`);
    validateFiniteNumber(readRequired(rec, 'owner', itemContext), `${itemContext}.owner`);
    validateFiniteNumber(readRequired(rec, 'anchorV', itemContext), `${itemContext}.anchorV`);

    const geomRecord = assertRecord(readRequired(rec, 'geometry', itemContext), `${itemContext}.geometry`);
    const geomKind = validateLiteral(readRequired(geomRecord, 'kind', `${itemContext}.geometry`), ['strict-clear', 'original-owner-contained'] as const, `${itemContext}.geometry.kind`);
    if (geomKind === 'original-owner-contained') {
      const srcRaw = readRequired(geomRecord, 'sourceMassIndices', `${itemContext}.geometry`);
      validateDenseArray(srcRaw, `${itemContext}.geometry.sourceMassIndices`, (srcIdxVal, srcIdxKey) =>
        validateSafeNonNegativeInteger(srcIdxVal, `${itemContext}.geometry.sourceMassIndices[${srcIdxKey}]`),
      );
    }
    return item as RetainedSupportItem;
  });
}

function validateFar(value: unknown): FarFamily {
  return validateDenseArray(value, 'far', (item, idx) => {
    const itemContext = `far[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateFiniteNumber(readRequired(rec, 'x', itemContext), `${itemContext}.x`);
    validateFiniteNumber(readRequired(rec, 'v', itemContext), `${itemContext}.v`);
    validateFiniteNonNegative(readRequired(rec, 'width', itemContext), `${itemContext}.width`);
    validateFiniteNumber(readRequired(rec, 'top', itemContext), `${itemContext}.top`);
    validateFiniteNumber(readRequired(rec, 'layer', itemContext), `${itemContext}.layer`);
    validateSafeNonNegativeInteger(readRequired(rec, 'shape', itemContext), `${itemContext}.shape`);
    return item as FarItem;
  });
}

function validateMega(value: unknown): MegaFamily {
  return validateDenseArray(value, 'mega', (item, idx) => {
    const itemContext = `mega[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateFiniteNumber(readRequired(rec, 'x', itemContext), `${itemContext}.x`);
    validateFiniteNumber(readRequired(rec, 'v', itemContext), `${itemContext}.v`);
    return item as MegaItem;
  });
}

function validateTiers(value: unknown, seenOwners: Set<object>): TiersFamily {
  if (!(value instanceof Map) || Object.getPrototypeOf(value) !== Map.prototype) {
    fail('tiers: expected Map instance');
  }
  for (const [key, tierArray] of Map.prototype.entries.call(value)) {
    validateString(key, 'tiers map key');
    validateDenseArray(tierArray, `tiers[${key}]`, (tierItem, tierIdx) => {
      const tierRec = assertRecord(tierItem, `tiers[${key}][${tierIdx}]`);
      validateFacadeFace(readRequired(tierRec, 'face', `tiers[${key}][${tierIdx}]`), `tiers[${key}][${tierIdx}].face`, seenOwners);
      return tierItem;
    });
  }
  return value as TiersFamily;
}

function validateFacadeFaces(value: unknown, context: string, seenOwners: Set<object>): FacadeFacesFamily {
  return validateDenseArray(value, context, (item, idx) => validateFacadeFace(item, `${context}[${idx}]`, seenOwners));
}

function validateTowerProfiles(value: unknown, massCount: number, seenOwners: Set<object>): TowerProfilesFamily {
  return validateDenseArray(value, 'towerProfiles', (item, idx) => {
    const itemContext = `towerProfiles[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateSafeNonNegativeInteger(readRequired(rec, 'towerIndex', itemContext), `${itemContext}.towerIndex`);
    validateString(readRequired(rec, 'towerKey', itemContext), `${itemContext}.towerKey`);
    validateFiniteNumber(readRequired(rec, 'building', itemContext), `${itemContext}.building`);
    validateFiniteNumber(readRequired(rec, 'materialOwner', itemContext), `${itemContext}.materialOwner`);

    const eligRecord = assertRecord(readRequired(rec, 'eligibility', itemContext), `${itemContext}.eligibility`);
    const eligKind = validateLiteral(readRequired(eligRecord, 'kind', `${itemContext}.eligibility`), ['eligible', 'excluded'] as const, `${itemContext}.eligibility.kind`);
    validateString(readRequired(eligRecord, 'reason', `${itemContext}.eligibility`), `${itemContext}.eligibility.reason`);

    if (eligKind === 'excluded') {
      validateLiteral(
        readRequired(rec, 'archetype', itemContext),
        ['plain', 'complex', 'ziggurat', 'setback', 'crown', 'spire', 'plateau'] as const,
        `${itemContext}.archetype`,
      );
    } else {
      validateLiteral(
        readRequired(rec, 'family', itemContext),
        ['offset-decks', 'broad-shelf', 'thin-slab-companion', 'supported-spine'] as const,
        `${itemContext}.family`,
      );

      const companionRaw = readRequired(rec, 'companionMassIndices', itemContext);
      validateDenseArray(companionRaw, `${itemContext}.companionMassIndices`, (cIdxVal, cIdxKey) =>
        validateIndexBound(cIdxVal, massCount, `${itemContext}.companionMassIndices[${cIdxKey}]`),
      );

      const spineVal = readNullable(rec, 'supportSpineIndex', itemContext);
      if (spineVal !== null) {
        validateIndexBound(spineVal, massCount, `${itemContext}.supportSpineIndex`);
      }

      validateFacadeFace(readRequired(rec, 'hostFace', itemContext), `${itemContext}.hostFace`, seenOwners);

      const stagesRaw = readRequired(rec, 'stages', itemContext);
      validateDenseArray(stagesRaw, `${itemContext}.stages`, (stageItem, stageIdx) => {
        const stageCtx = `${itemContext}.stages[${stageIdx}]`;
        const stageRec = assertRecord(stageItem, stageCtx);
        validateSafeNonNegativeInteger(readRequired(stageRec, 'stageIndex', stageCtx), `${stageCtx}.stageIndex`);

        const massIdxRaw = readRequired(stageRec, 'massIndices', stageCtx);
        validateDenseArray(massIdxRaw, `${stageCtx}.massIndices`, (mVal, mKey) =>
          validateIndexBound(mVal, massCount, `${stageCtx}.massIndices[${mKey}]`),
        );

        const fpRec = assertRecord(readRequired(stageRec, 'footprint', stageCtx), `${stageCtx}.footprint`);
        validateFiniteNumber(readRequired(fpRec, 'x', `${stageCtx}.footprint`), `${stageCtx}.footprint.x`);
        validateFiniteNumber(readRequired(fpRec, 'z', `${stageCtx}.footprint`), `${stageCtx}.footprint.z`);
        validateFiniteNonNegative(readRequired(fpRec, 'width', `${stageCtx}.footprint`), `${stageCtx}.footprint.width`);
        validateFiniteNonNegative(readRequired(fpRec, 'depth', `${stageCtx}.footprint`), `${stageCtx}.footprint.depth`);

        const vbRec = assertRecord(readRequired(stageRec, 'verticalBounds', stageCtx), `${stageCtx}.verticalBounds`);
        validateFiniteNumber(readRequired(vbRec, 'y0', `${stageCtx}.verticalBounds`), `${stageCtx}.verticalBounds.y0`);
        validateFiniteNumber(readRequired(vbRec, 'y1', `${stageCtx}.verticalBounds`), `${stageCtx}.verticalBounds.y1`);
        validateFiniteNonNegative(readRequired(vbRec, 'height', `${stageCtx}.verticalBounds`), `${stageCtx}.verticalBounds.height`);

        const offsetVal = readNullable(stageRec, 'offset', stageCtx);
        if (offsetVal !== null) {
          const offRec = assertRecord(offsetVal, `${stageCtx}.offset`);
          validateLiteral(readRequired(offRec, 'axis', `${stageCtx}.offset`), ['x', 'z'] as const, `${stageCtx}.offset.axis`);
          validateLiteral(readRequired(offRec, 'parentKind', `${stageCtx}.offset`), ['stage', 'original-footprint'] as const, `${stageCtx}.offset.parentKind`);
          validateSafeInteger(readRequired(offRec, 'parentStageIndex', `${stageCtx}.offset`), `${stageCtx}.offset.parentStageIndex`);
          validateFiniteNumber(readRequired(offRec, 'parentSpanM', `${stageCtx}.offset`), `${stageCtx}.offset.parentSpanM`);
          validateFiniteNumber(readRequired(offRec, 'deltaM', `${stageCtx}.offset`), `${stageCtx}.offset.deltaM`);
          validateFiniteNumber(readRequired(offRec, 'ratio', `${stageCtx}.offset`), `${stageCtx}.offset.ratio`);
        }
        return stageItem;
      });

      const crownRec = assertRecord(readRequired(rec, 'crown', itemContext), `${itemContext}.crown`);
      const crownKind = validateLiteral(readRequired(crownRec, 'kind', `${itemContext}.crown`), ['split', 'unsplit-fin'] as const, `${itemContext}.crown.kind`);
      validateLiteral(readRequired(crownRec, 'axis', `${itemContext}.crown`), ['x', 'z'] as const, `${itemContext}.crown.axis`);
      validateFiniteNumber(readRequired(crownRec, 'crownSpanM', `${itemContext}.crown`), `${itemContext}.crown.crownSpanM`);

      const boundsRec = assertRecord(readRequired(crownRec, 'bounds', `${itemContext}.crown`), `${itemContext}.crown.bounds`);
      validateFiniteNumber(readRequired(boundsRec, 'y0', `${itemContext}.crown.bounds`), `${itemContext}.crown.bounds.y0`);
      validateFiniteNumber(readRequired(boundsRec, 'y1', `${itemContext}.crown.bounds`), `${itemContext}.crown.bounds.y1`);
      validateFiniteNonNegative(readRequired(boundsRec, 'width', `${itemContext}.crown.bounds`), `${itemContext}.crown.bounds.width`);
      validateFiniteNonNegative(readRequired(boundsRec, 'height', `${itemContext}.crown.bounds`), `${itemContext}.crown.bounds.height`);
      validateFiniteNonNegative(readRequired(boundsRec, 'depth', `${itemContext}.crown.bounds`), `${itemContext}.crown.bounds.depth`);

      if (crownKind === 'split') {
        validateFiniteNumber(readRequired(crownRec, 'gapM', `${itemContext}.crown`), `${itemContext}.crown.gapM`);
        const cMasses = validateDenseArray(readRequired(crownRec, 'massIndices', `${itemContext}.crown`), `${itemContext}.crown.massIndices`, (cmVal, cmKey) =>
          validateIndexBound(cmVal, massCount, `${itemContext}.crown.massIndices[${cmKey}]`),
        );
        if (cMasses.length !== 2) fail(`${itemContext}.crown.massIndices: expected 2 indices`);
      } else {
        validateLiteral(readRequired(crownRec, 'gapM', `${itemContext}.crown`), [0] as const, `${itemContext}.crown.gapM`);
        const cMasses = validateDenseArray(readRequired(crownRec, 'massIndices', `${itemContext}.crown`), `${itemContext}.crown.massIndices`, (cmVal, cmKey) =>
          validateIndexBound(cmVal, massCount, `${itemContext}.crown.massIndices[${cmKey}]`),
        );
        if (cMasses.length !== 1) fail(`${itemContext}.crown.massIndices: expected 1 index`);
      }

      const leanVal = readNullable(rec, 'lean', itemContext);
      if (leanVal !== null) {
        const leanRec = assertRecord(leanVal, `${itemContext}.lean`);
        validateLiteral(readRequired(leanRec, 'axis', `${itemContext}.lean`), ['z'] as const, `${itemContext}.lean.axis`);
        validateFiniteNumber(readRequired(leanRec, 'angleDeg', `${itemContext}.lean`), `${itemContext}.lean.angleDeg`);
        validateFiniteNumber(readRequired(leanRec, 'riseM', `${itemContext}.lean`), `${itemContext}.lean.riseM`);
        validateFiniteNumber(readRequired(leanRec, 'totalOffsetM', `${itemContext}.lean`), `${itemContext}.lean.totalOffsetM`);
      }
    }

    return item as TowerProfileRowItem;
  });
}

function validateSigns(value: unknown, massCount: number, trimCount: number, seenOwners: Set<object>): SignsFamily {
  const record = assertRecord(value, 'signs');
  const count = validateSafeNonNegativeInteger(readRequired(record, 'count', 'signs'), 'signs.count');
  validateSafeInteger(readRequired(record, 'seed', 'signs'), 'signs.seed');
  const ordinaryCount = validateSafeNonNegativeInteger(readRequired(record, 'ordinaryCount', 'signs'), 'signs.ordinaryCount');
  const heroCount = validateSafeNonNegativeInteger(readRequired(record, 'heroCount', 'signs'), 'signs.heroCount');
  if (ordinaryCount + heroCount !== count) {
    fail(`signs: ordinaryCount (${ordinaryCount}) + heroCount (${heroCount}) !== count (${count})`);
  }

  validateFloat32Array(readRequired(record, 'cx', 'signs'), count, 'signs.cx');
  validateFloat32Array(readRequired(record, 'cy', 'signs'), count, 'signs.cy');
  validateFloat32Array(readRequired(record, 'cz', 'signs'), count, 'signs.cz');
  validateFloat32Array(readRequired(record, 'nx', 'signs'), count, 'signs.nx');
  validateFloat32Array(readRequired(record, 'nz', 'signs'), count, 'signs.nz');
  validateFloat32Array(readRequired(record, 'sw', 'signs'), count, 'signs.sw', 0);
  validateFloat32Array(readRequired(record, 'sh', 'signs'), count, 'signs.sh', 0);
  validateFloat32Array(readRequired(record, 'color', 'signs'), count * 3, 'signs.color');
  validateFloat32Array(readRequired(record, 'seedValue', 'signs'), count, 'signs.seedValue');
  validateFloat32Array(readRequired(record, 'rootHalfWidthM', 'signs'), count, 'signs.rootHalfWidthM');
  validateUint8Array(readRequired(record, 'kind', 'signs'), count, 'signs.kind', 2);
  validateFloat64Array(readRequired(record, 'anchorV', 'signs'), count, 'signs.anchorV');

  const faceIds = validateDenseArray(readRequired(record, 'faceId', 'signs'), 'signs.faceId', (item, idx) => {
    if (item === null) return null;
    return validateString(item, `signs.faceId[${idx}]`);
  });
  if (faceIds.length < count) fail(`signs.faceId length ${faceIds.length} smaller than count ${count}`);

  const buildingIds = validateDenseArray(readRequired(record, 'buildingId', 'signs'), 'signs.buildingId', (item, idx) => {
    if (item === null) return null;
    return validateString(item, `signs.buildingId[${idx}]`);
  });
  if (buildingIds.length < count) fail(`signs.buildingId length ${buildingIds.length} smaller than count ${count}`);

  const compIds = validateDenseArray(readRequired(record, 'compositionId', 'signs'), 'signs.compositionId', (item, idx) => {
    if (item === null) return null;
    return validateString(item, `signs.compositionId[${idx}]`);
  });
  if (compIds.length < count) fail(`signs.compositionId length ${compIds.length} smaller than count ${count}`);

  const owners = validateDenseArray(readRequired(record, 'owner', 'signs'), 'signs.owner', (item, idx) => {
    if (item === null) return null;
    return validateTrimOwner(item, `signs.owner[${idx}]`, seenOwners);
  });
  if (owners.length < count) fail(`signs.owner length ${owners.length} smaller than count ${count}`);

  const mounts = validateDenseArray(readRequired(record, 'mount', 'signs'), 'signs.mount', (item, idx) => {
    const itemContext = `signs.mount[${idx}]`;
    const mountRec = assertRecord(item, itemContext);
    validateLiteral(readRequired(mountRec, 'mode', itemContext), ['panel', 'blade'] as const, `${itemContext}.mode`);
    validateSafeInteger(readRequired(mountRec, 'edgeIndex', itemContext), `${itemContext}.edgeIndex`);

    const hostRec = assertRecord(readRequired(mountRec, 'host', itemContext), `${itemContext}.host`);
    const hostKind = validateLiteral(readRequired(hostRec, 'kind', `${itemContext}.host`), ['mass', 'trim'] as const, `${itemContext}.host.kind`);
    if (hostKind === 'mass') {
      validateIndexBound(readRequired(hostRec, 'index', `${itemContext}.host`), massCount, `${itemContext}.host.index`);
    } else {
      validateIndexBound(readRequired(hostRec, 'index', `${itemContext}.host`), trimCount, `${itemContext}.host.index`);
    }

    const validatePoint = (ptVal: unknown, ptCtx: string): void => {
      const ptRec = assertRecord(ptVal, ptCtx);
      validateFiniteNumber(readRequired(ptRec, 'x', ptCtx), `${ptCtx}.x`);
      validateFiniteNumber(readRequired(ptRec, 'y', ptCtx), `${ptCtx}.y`);
      validateFiniteNumber(readRequired(ptRec, 'z', ptCtx), `${ptCtx}.z`);
    };

    const edgePoints = validateDenseArray(readRequired(mountRec, 'edge', itemContext), `${itemContext}.edge`, (pt, pIdx) => {
      validatePoint(pt, `${itemContext}.edge[${pIdx}]`);
      return pt;
    });
    if (edgePoints.length !== 2) fail(`${itemContext}.edge: expected 2 points`);

    const rootPoints = validateDenseArray(readRequired(mountRec, 'root', itemContext), `${itemContext}.root`, (pt, pIdx) => {
      validatePoint(pt, `${itemContext}.root[${pIdx}]`);
      return pt;
    });
    if (rootPoints.length !== 2) fail(`${itemContext}.root: expected 2 points`);

    return item as SignMountItem;
  });
  if (mounts.length < count) fail(`signs.mount length ${mounts.length} smaller than count ${count}`);

  validateDenseArray(readRequired(record, 'acceptedByLoopSection', 'signs'), 'signs.acceptedByLoopSection', (secVal, secIdx) =>
    validateFiniteNumber(secVal, `signs.acceptedByLoopSection[${secIdx}]`),
  );

  return value as SignsFamily;
}

function validateRoofDetailHeroBoxes(value: unknown, massCount: number): RoofDetailHeroBoxesFamily {
  return validateDenseArray(value, 'roofDetailHeroBoxes', (item, idx) => {
    const itemContext = `roofDetailHeroBoxes[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateFiniteNumber(readRequired(rec, 'x', itemContext), `${itemContext}.x`);
    validateFiniteNumber(readRequired(rec, 'y', itemContext), `${itemContext}.y`);
    validateFiniteNumber(readRequired(rec, 'z', itemContext), `${itemContext}.z`);
    validateFiniteNonNegative(readRequired(rec, 'halfX', itemContext), `${itemContext}.halfX`);
    validateFiniteNonNegative(readRequired(rec, 'halfY', itemContext), `${itemContext}.halfY`);
    validateFiniteNonNegative(readRequired(rec, 'halfZ', itemContext), `${itemContext}.halfZ`);
    validateFiniteNumber(readRequired(rec, 'ux', itemContext), `${itemContext}.ux`);
    validateFiniteNumber(readRequired(rec, 'uz', itemContext), `${itemContext}.uz`);
    validateFiniteNumber(readRequired(rec, 'vx', itemContext), `${itemContext}.vx`);
    validateFiniteNumber(readRequired(rec, 'vz', itemContext), `${itemContext}.vz`);
    validateFiniteNumber(readRequired(rec, 'minX', itemContext), `${itemContext}.minX`);
    validateFiniteNumber(readRequired(rec, 'maxX', itemContext), `${itemContext}.maxX`);
    validateFiniteNumber(readRequired(rec, 'minZ', itemContext), `${itemContext}.minZ`);
    validateFiniteNumber(readRequired(rec, 'maxZ', itemContext), `${itemContext}.maxZ`);
    validateFiniteNumber(readRequired(rec, 'coordinateUlpM', itemContext), `${itemContext}.coordinateUlpM`);

    const footprintVal = readOptional(rec, 'footprint');
    if (footprintVal !== undefined) {
      validateDenseArray(footprintVal, `${itemContext}.footprint`, (ptVal, ptIdx) => {
        const ptTuple = validateDenseArray(ptVal, `${itemContext}.footprint[${ptIdx}]`, (numVal, numIdx) =>
          validateFiniteNumber(numVal, `${itemContext}.footprint[${ptIdx}][${numIdx}]`),
        );
        if (ptTuple.length !== 2) fail(`${itemContext}.footprint[${ptIdx}]: expected 2D point tuple`);
        return ptVal;
      });
    }

    const vbVal = readOptional(rec, 'verticalBounds');
    if (vbVal !== undefined) {
      const vbTuple = validateDenseArray(vbVal, `${itemContext}.verticalBounds`, (numVal, numIdx) =>
        validateFiniteNumber(numVal, `${itemContext}.verticalBounds[${numIdx}]`),
      );
      if (vbTuple.length !== 2) fail(`${itemContext}.verticalBounds: expected tuple of 2 bounds`);
    }

    const massIndexVal = readOptional(rec, 'massIndex');
    if (massIndexVal !== undefined) {
      validateIndexBound(massIndexVal, massCount, `${itemContext}.massIndex`);
    }

    return item as RoofDetailHeroBoxItem;
  });
}

function validateHeroes(value: unknown, seenOwners: Set<object>): HeroesFamily {
  return validateDenseArray(value, 'heroes', (item, idx) => {
    const itemContext = `heroes[${idx}]`;
    const rec = assertRecord(item, itemContext);
    validateLiteral(readRequired(rec, 'kind', itemContext), ['blade', 'panel', 'brand'] as const, `${itemContext}.kind`);
    validateSafeInteger(readRequired(rec, 'cell', itemContext), `${itemContext}.cell`);
    validateFiniteNumber(readRequired(rec, 'x', itemContext), `${itemContext}.x`);
    validateFiniteNumber(readRequired(rec, 'y', itemContext), `${itemContext}.y`);
    validateFiniteNumber(readRequired(rec, 'z', itemContext), `${itemContext}.z`);
    validateFiniteNonNegative(readRequired(rec, 'width', itemContext), `${itemContext}.width`);
    validateFiniteNonNegative(readRequired(rec, 'height', itemContext), `${itemContext}.height`);
    validateFiniteNonNegative(readRequired(rec, 'rootHalfWidthM', itemContext), `${itemContext}.rootHalfWidthM`);
    validateSafeInteger(readRequired(rec, 'color', itemContext), `${itemContext}.color`);
    validateFiniteNumber(readRequired(rec, 'seed', itemContext), `${itemContext}.seed`);
    validateString(readRequired(rec, 'buildingId', itemContext), `${itemContext}.buildingId`);
    validateString(readRequired(rec, 'faceId', itemContext), `${itemContext}.faceId`);
    validateString(readRequired(rec, 'compositionId', itemContext), `${itemContext}.compositionId`);
    validateTrimOwner(readRequired(rec, 'owner', itemContext), `${itemContext}.owner`, seenOwners);
    return item as HeroItem;
  });
}

/**
 * Validates external snapshot value across all 15 cached families.
 * Preserves the exact original object graph, references, and property descriptors.
 */
export function parseCitySnapshot(value: unknown): SkyriverCitySnapshot {
  const root = assertRecord(value, 'SkyriverCitySnapshot');

  const trimsRaw = readRequired(root, 'trims', 'SkyriverCitySnapshot');
  const massesRaw = readRequired(root, 'masses', 'SkyriverCitySnapshot');
  const massSeedOrdinalsRaw = readRequired(root, 'massSeedOrdinals', 'SkyriverCitySnapshot');
  const roofDetailsRaw = readRequired(root, 'roofDetails', 'SkyriverCitySnapshot');
  const reconciliationRaw = readRequired(root, 'reconciliation', 'SkyriverCitySnapshot');
  const retainedSupportRaw = readRequired(root, 'retainedSupport', 'SkyriverCitySnapshot');
  const farRaw = readRequired(root, 'far', 'SkyriverCitySnapshot');
  const megaRaw = readRequired(root, 'mega', 'SkyriverCitySnapshot');
  const tiersRaw = readRequired(root, 'tiers', 'SkyriverCitySnapshot');
  const facadeFacesRaw = readRequired(root, 'facadeFaces', 'SkyriverCitySnapshot');
  const legacyFacesRaw = readRequired(root, 'legacyFaces', 'SkyriverCitySnapshot');
  const towerProfilesRaw = readRequired(root, 'towerProfiles', 'SkyriverCitySnapshot');
  const signsRaw = readRequired(root, 'signs', 'SkyriverCitySnapshot');
  const roofDetailHeroBoxesRaw = readRequired(root, 'roofDetailHeroBoxes', 'SkyriverCitySnapshot');
  const heroesRaw = readRequired(root, 'heroes', 'SkyriverCitySnapshot');

  const seenOwners = new Set<object>();

  const trims = validateTrims(trimsRaw, seenOwners);
  const trimCount = trims.count;

  if (!Array.isArray(massesRaw) || Object.getPrototypeOf(massesRaw) !== Array.prototype) {
    fail('masses: expected dense array');
  }
  const massCount = massesRaw.length;

  validateDenseArray(massesRaw, 'masses', (item, idx) => validateMass(item, idx, massCount, trimCount, seenOwners));
  validateMassSeedOrdinals(massSeedOrdinalsRaw, massCount);
  validateRoofDetails(roofDetailsRaw, massCount, trimCount);
  validateReconciliation(reconciliationRaw, massCount, seenOwners);
  validateRetainedSupport(retainedSupportRaw, massCount);
  validateFar(farRaw);
  validateMega(megaRaw);
  validateTiers(tiersRaw, seenOwners);
  validateFacadeFaces(facadeFacesRaw, 'facadeFaces', seenOwners);
  validateFacadeFaces(legacyFacesRaw, 'legacyFaces', seenOwners);
  validateTowerProfiles(towerProfilesRaw, massCount, seenOwners);
  validateSigns(signsRaw, massCount, trimCount, seenOwners);
  validateRoofDetailHeroBoxes(roofDetailHeroBoxesRaw, massCount);
  validateHeroes(heroesRaw, seenOwners);

  return value as SkyriverCitySnapshot;
}
