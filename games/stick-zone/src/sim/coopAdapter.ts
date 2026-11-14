/**
 * @file coopAdapter.ts
 * Pure mapping between local game input/state and SyncHub confirmed raid
 * state. No SDK calls, no side effects: session plumbing lives in
 * src/platform/synchub.ts. Every function either returns valid data or
 * throws, so a bad intent fails loud at the boundary instead of reaching
 * the server as a silent no-op.
 */
import type {
  PlayerRaidIntent,
  RaidActorState,
  RaidState,
} from "@series-inc/rundot-syncplay/modules/extraction";
import type { SettlementDebrief } from "@series-inc/rundot-game-sdk";

export interface MoveAxes {
  /** Local axis strength, -1..1. */
  dx: number;
  dz: number;
}

function requireFinite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`[coopAdapter] ${name} must be a finite number, got ${String(value)}`);
  }
  return value;
}

function requirePickupId(value: string, name: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    throw new Error(`[coopAdapter] ${name} must be a non-empty id of at most 256 chars`);
  }
  return value;
}

/**
 * Local axis input -> wire movement intent. The gateway schema bounds
 * moveX/moveZ to [-1, 1] and the raid owner applies them unscaled in
 * stepRaidTick, so the wire format is a normalized direction whose
 * magnitude is at most 1 (one meter per tick at full deflection).
 * Anything outside that bound is rejected by the owner, so this
 * function never emits it.
 */
export function movementIntent(axes: MoveAxes): PlayerRaidIntent {
  const dx = Math.max(-1, Math.min(1, requireFinite(axes.dx, "dx")));
  const dz = Math.max(-1, Math.min(1, requireFinite(axes.dz, "dz")));
  const magnitude = Math.hypot(dx, dz);
  if (magnitude > 1) {
    return { moveX: dx / magnitude, moveZ: dz / magnitude };
  }
  return { moveX: dx, moveZ: dz };
}

export function attackIntent(targetSlot: number, damage: number): PlayerRaidIntent {
  if (!Number.isInteger(targetSlot) || targetSlot < 0) {
    throw new Error(`[coopAdapter] attackTargetSlot must be a non-negative integer slot, got ${String(targetSlot)}`);
  }
  const validDamage = requireFinite(damage, "attackDamage");
  if (validDamage <= 0) {
    throw new Error(`[coopAdapter] attackDamage must be positive, got ${validDamage}`);
  }
  return { attackTargetSlot: targetSlot, attackDamage: validDamage };
}

export function corpsePickupIntent(corpseId: string, itemId: string): PlayerRaidIntent {
  return {
    pickupCorpseId: requirePickupId(corpseId, "pickupCorpseId"),
    pickupItemId: requirePickupId(itemId, "pickupItemId"),
  };
}

export function worldPickupIntent(pickupId: string, itemId?: string): PlayerRaidIntent {
  const pickupWorldId = requirePickupId(pickupId, "pickupWorldId");
  return itemId === undefined
    ? { pickupWorldId }
    : { pickupWorldId, pickupItemId: requirePickupId(itemId, "pickupItemId") };
}

export interface ActorView {
  slot: number;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  isExtracted: boolean;
  isCasualty: boolean;
  dwellTicks: number;
  dwellZoneId: string | null;
}

export interface CorpseView {
  corpseId: string;
  originalSlot: number;
  x: number;
  z: number;
  itemIds: string[];
}

export interface WorldPickupView {
  pickupId: string;
  x: number;
  z: number;
  itemIds: string[];
}

export interface ConfirmedView {
  tick: number;
  self: ActorView | undefined;
  squadmates: ActorView[];
  corpses: CorpseView[];
  worldPickups: WorldPickupView[];
  heldItemIds: string[];
}

function toActorView(actor: RaidActorState): ActorView {
  return {
    slot: actor.slot,
    x: actor.x,
    z: actor.z,
    health: actor.health,
    maxHealth: actor.maxHealth,
    isAlive: actor.isAlive,
    isExtracted: actor.isExtracted,
    isCasualty: actor.isCasualty,
    dwellTicks: actor.extractionZoneDwell?.continuousTicks ?? 0,
    dwellZoneId: actor.extractionZoneDwell?.zoneId ?? null,
  };
}

/**
 * Confirmed RaidState -> render snapshot for one local player. Squadmates
 * share the self actor's squadIndex. Held items include extracted custody,
 * matching extractRaidOutcome.
 */
export function confirmedView(state: RaidState, selfSlot: number): ConfirmedView {
  const selfActor = state.actors[selfSlot];
  const squadmates: ActorView[] = [];
  if (selfActor) {
    for (const actor of Object.values(state.actors)) {
      if (actor.slot !== selfSlot && actor.squadIndex === selfActor.squadIndex) {
        squadmates.push(toActorView(actor));
      }
    }
    squadmates.sort((a, b) => a.slot - b.slot);
  }

  const corpses: CorpseView[] = Object.values(state.corpses)
    .map((corpse) => ({
      corpseId: corpse.corpseId,
      originalSlot: corpse.originalSlot,
      x: corpse.x,
      z: corpse.z,
      itemIds: Object.values(state.items)
        .filter((item) => item.holder.kind === "corpse" && item.holder.corpseId === corpse.corpseId)
        .map((item) => String(item.itemId))
        .sort(),
    }))
    .sort((a, b) => a.corpseId.localeCompare(b.corpseId));

  const worldPickups: WorldPickupView[] = Object.values(state.worldPickups)
    .map((pickup) => ({
      pickupId: pickup.pickupId,
      x: pickup.x,
      z: pickup.z,
      itemIds: Object.values(state.items)
        .filter((item) => item.holder.kind === "world" && item.holder.pickupId === pickup.pickupId)
        .map((item) => String(item.itemId))
        .sort(),
    }))
    .sort((a, b) => a.pickupId.localeCompare(b.pickupId));

  const heldItemIds = Object.values(state.items)
    .filter(
      (item) =>
        (item.holder.kind === "player" && item.holder.slot === selfSlot) ||
        (item.holder.kind === "extracted" && item.holder.slot === selfSlot),
    )
    .map((item) => String(item.itemId))
    .sort();

  return {
    tick: state.tick,
    self: selfActor ? toActorView(selfActor) : undefined,
    squadmates,
    corpses,
    worldPickups,
    heldItemIds,
  };
}

/**
 * Debrief as the server sends it. The published SDK 5.36 types omit the
 * void `resolution` variant that Venus develop defines, so the adapter
 * accepts the wider wire shape and narrows it at this boundary.
 */
export type DebriefInput = Omit<SettlementDebrief, "outcomeId" | "outcomeDigest"> & {
  outcomeId?: string;
  outcomeDigest?: string;
  resolution?: {
    kind: "void";
    reason: string;
    refundedProfiles: readonly string[];
    refunds: readonly { profileId: string; items: Readonly<Record<string, string>> }[];
  };
};

export interface DebriefSummary {
  settled: boolean;
  voided: boolean;
  voidReason: string | null;
  gainedItems: Array<{ itemId: string; quantity: string }>;
  refundedItems: Array<{ itemId: string; quantity: string }>;
  escrowReleased: number;
  inventoryRevision: number | undefined;
  activeRaidCleared: boolean;
}

/**
 * SettlementDebrief -> per-profile result. A void is a refund of the
 * unsettled loadout, never gains; the two item lists stay separate so UI
 * cannot present a refund as loot.
 */
export function summarizeDebrief(debrief: DebriefInput, profileId: string): DebriefSummary {
  const participant = debrief.participantResults.find((result) => result.profileId === profileId);
  const resolution = debrief.resolution;
  const voided = resolution?.kind === "void";
  const refund = voided
    ? resolution.refunds.find((entry) => entry.profileId === profileId)
    : undefined;

  return {
    settled: debrief.settled,
    voided,
    voidReason: voided ? resolution.reason : null,
    gainedItems: voided
      ? []
      : debrief.transfers
          .filter((transfer) => transfer.toProfileId === profileId)
          .map((transfer) => ({ itemId: transfer.itemId, quantity: transfer.quantity })),
    refundedItems: refund
      ? Object.entries(refund.items)
          .map(([itemId, quantity]) => ({ itemId, quantity }))
          .sort((a, b) => a.itemId.localeCompare(b.itemId))
      : [],
    escrowReleased: participant?.releasedEscrowIds.length ?? 0,
    inventoryRevision: participant?.inventoryRevision,
    activeRaidCleared: participant?.activeRaidCleared ?? false,
  };
}
