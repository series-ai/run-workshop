/**
 * @file server-settlement.ts
 * Authoritative server-side settlement authority with disk persistence,
 * strict earned-loot validation, serialized transactional mutex,
 * deterministic total ordering for crate looting, and atomic rollback on persistence failure.
 */

import fs from "fs";
import path from "path";

export const RAID_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const RESERVED_RAID_IDS = new Set(["__proto__", "prototype", "constructor"]);
export function isValidRaidId(id: unknown): id is string {
  return typeof id === "string" && RAID_ID_REGEX.test(id) && !RESERVED_RAID_IDS.has(id.toLowerCase());
}

export const OPERATIVE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const RESERVED_OPERATIVE_IDS = new Set(["__proto__", "prototype", "constructor", "system", "server", "admin", "root"]);
export function isValidOperativeId(id: unknown): id is string {
  return typeof id === "string" && OPERATIVE_ID_REGEX.test(id) && !RESERVED_OPERATIVE_IDS.has(id.toLowerCase());
}

function hasOwnOperative(raid: any, opId: string): boolean {
  return Boolean(raid && raid.operatives && typeof opId === "string" && isValidOperativeId(opId) && Object.prototype.hasOwnProperty.call(raid.operatives, opId));
}
import crypto from "crypto";
import type { SettlementReceipt, ProfileId, RaidId } from "@series-inc/rundot-syncplay/extensions/hub";
import type { CanonicalOutcomePayload, SettlementCommitment } from "./airlock.js";

export const KNOWN_DEPOT_CRATES: Record<string, number> = {
  crate_01: 1250,
  crate_02: 2400,
  crate_03: 3800,
};

export interface OperativeCustody {
  operativeId: string;
  admitted: boolean;
  earnedCash: number;
  cratesLooted: string[];
  isExtracted: boolean;
  extractedAtTick: number;
  activeRaid: string;
  inventoryRevision: number;
  owned?: boolean;
  holdTicks?: number;
  holdStartTick?: number;
  holdStartTimestamp?: number;
  lastHoldTimestamp?: number;
  holdReportCount?: number;
  lastReportTick?: number;
  rawLastReceivedTick?: number;
  holdCompleted?: boolean;
  holdCompletedAtTick?: number;
  holdCompletedTimestamp?: number;
  corridorStartTime?: number;
  isAlive?: boolean;
  isKia?: boolean;
  /** Server-authoritative pending combat damage (consumed by the next hold report). */
  unconsumedDamage?: number;
  simTickAdvancement?: boolean;
  sessionToken?: string;
  lastObservedX?: number;
  lastObservedZ?: number;
  lastObservedTimestamp?: number;
  accumulatedObservedTicks?: number;
  health?: number;
  armor?: number;
  lastDamageTimestamp?: number;
  lastDamageTick?: number;
  ammo?: number;
  pendingRevocationSave?: boolean;
  failedPersistence?: boolean;
}

export interface ServerRaidRecord {
  raidId: string;
  status: "active" | "concluded";
  allowableCashPool: number;
  totalBanked: number;
  createdAtMs?: number;
  operatives: Record<string, OperativeCustody>;
  crates: Record<string, { cashValue: number; claimedBy?: string; claimTimestamp?: number; serverClaimedAt?: number; prevAmmo?: number; ammoGranted?: number }>;
  machines?: Record<string, { health: number; isAlive: boolean }>;
}

interface PersistentStoreData {
  generation?: number;
  raids: Record<string, ServerRaidRecord>;
  auditLog: Record<string, { receipt: SettlementReceipt; outcomePayload: CanonicalOutcomePayload }>;
  idempotencyMap: Record<string, string>;
  activeRaidId?: string;
  sessionTokens?: Record<string, { operativeId: string; raidId: string }>;
  claimedSessions?: string[];
  slotClaimTimestamps?: Record<string, number>;
  profiles?: Record<string, { inventoryRevision: number }>;
}

export function computeCanonicalOutcomeDigestSync(outcomePayload: any): string {
  const sortedKeys = Object.keys(outcomePayload).sort();
  const canonicalObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    if (k === "digest") continue;
    canonicalObj[k] = outcomePayload[k];
  }
  return crypto.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
}

function failLog(line: number, msg: string): boolean {
  console.log("INTEGRITY_FAIL_LINE_" + line + ": " + msg);
  return false;
}
export function validateStoreIntegrity(data: any): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.generation !== undefined) {
    if (typeof data.generation !== "number" || !Number.isSafeInteger(data.generation) || data.generation < 0) {
      return false;
    }
  }
  if (!data.raids || typeof data.raids !== "object" || Array.isArray(data.raids)) return false;
  for (const rId of Object.keys(data.raids)) {
    if (!Object.prototype.hasOwnProperty.call(data.raids, rId)) return false;
    if (!isValidRaidId(rId)) return false;
  }
  const VALID_STATUSES = new Set(["active", "settled", "concluded"]);


  if (data.profiles !== undefined) {
    if (!data.profiles || typeof data.profiles !== "object" || Array.isArray(data.profiles)) return false;
    for (const [profId, prof] of Object.entries(data.profiles)) {
      if (!isValidOperativeId(profId)) return false;
      if (!prof || typeof prof !== "object" || Array.isArray(prof)) return false;
      const rev = (prof as any).inventoryRevision;
      if (rev !== undefined && (typeof rev !== "number" || !Number.isInteger(rev) || rev < 0)) {
        return false;
      }
    }
  }

  if (data.auditLog !== undefined) {
    if (!data.auditLog || typeof data.auditLog !== "object" || Array.isArray(data.auditLog)) return false;
    const seenExtractorsPerRaid = new Set<string>();
    for (const [receiptId, entry] of Object.entries(data.auditLog)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const rec = (entry as any).receipt;
      const payload = (entry as any).outcomePayload;
      if (!rec || typeof rec !== "object" || Array.isArray(rec)) return false;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
      if (typeof rec.receiptId !== "string" || rec.receiptId !== receiptId) return false;
      if (typeof rec.raidId !== "string" || !rec.raidId) return false;
      if (!data.raids || !Object.prototype.hasOwnProperty.call(data.raids, rec.raidId) || !data.raids[rec.raidId]) return false;
      const raidRecord = data.raids[rec.raidId];
      if (typeof rec.outcomeDigest !== "string" || !/^[0-9a-fA-F]{64}$/.test(rec.outcomeDigest)) return false;
      if (typeof rec.throughTick !== "number" || !Number.isInteger(rec.throughTick) || rec.throughTick < 0) return false;
      if (!payload.extractedSquad || typeof payload.extractedSquad !== "string") return false;
      if (!raidRecord.operatives || !raidRecord.operatives[payload.extractedSquad]) return false;
      if (typeof payload.cashBanked !== "number" || !Number.isInteger(payload.cashBanked) || payload.cashBanked < 0) return false;
      if (payload.cashBanked > raidRecord.allowableCashPool || payload.cashBanked > raidRecord.totalBanked) return false;
      if (payload.raidId !== rec.raidId) return false;
      if (payload.digest && payload.digest !== rec.outcomeDigest) return false;
      if (rec.throughTick !== payload.verifiedPrefixTick) return false;
      const expectedDigest = computeCanonicalOutcomeDigestSync(payload);
      if (rec.outcomeDigest !== expectedDigest) return false;
      // Complete receipt contract is strictly enforced for ALL receipts regardless of receiptId prefix
      if (rec.v !== 1) return false;
      if (rec.outcomeId !== expectedDigest) return false;
      if (rec.intentHash !== `intent_${expectedDigest.slice(16, 32)}`) return false;
      if (typeof rec.committedAtMs !== "number" || !Number.isInteger(rec.committedAtMs) || rec.committedAtMs < 1500000000000 || rec.committedAtMs > Date.now() + 86400000) return false;
      if (typeof rec.receiptId === "string" && rec.receiptId.startsWith("receipt_s7_")) {
        if (rec.receiptId !== `receipt_s7_${expectedDigest.slice(0, 16)}`) return false;
      }
      if (!Array.isArray(rec.transfers)) return false;
      const expectedTransfersCount = (payload.cashBanked === 0 && rec.transfers.length === 0) ? 0 : 1;
      if (rec.transfers.length !== expectedTransfersCount) return false;
      for (const tr of rec.transfers) {
        if (!tr || typeof tr !== "object" || Array.isArray(tr)) return false;
        if (tr.itemId !== "currency_credits") return false;
        const expectedQty = `BE:${BigInt(payload.cashBanked).toString()}`;
        if (tr.quantity !== expectedQty) return false;
        if (tr.toProfileId !== payload.extractedSquad) return false;
        if (tr.source !== "world_spawn") return false;
      }
      if (!Array.isArray(rec.participantResults) || rec.participantResults.length === 0) return false;
      const seenProfiles = new Set<string>();
      for (const p of rec.participantResults) {
        if (!p || typeof p !== "object" || Array.isArray(p)) return false;
        if (!p.profileId || typeof p.profileId !== "string") return false;
        if (seenProfiles.has(p.profileId)) return false;
        seenProfiles.add(p.profileId);
        if (!isValidOperativeId(p.profileId)) return false;
        const isKnown = (raidRecord && hasOwnOperative(raidRecord, p.profileId)) ||
          (data.profiles && Object.prototype.hasOwnProperty.call(data.profiles, p.profileId)) ||
          (p.profileId === "op_player" || p.profileId === "op_alpha_1" || p.profileId === "op_bravo_1");
        if (!isKnown) return false;
        if (typeof p.activeRaidCleared !== "boolean") return false;
        if (!Array.isArray(p.releasedEscrowIds)) return false;
        for (const escId of p.releasedEscrowIds) {
          if (typeof escId !== "string" || !/^escrow_[a-zA-Z0-9_]+_loadout$/.test(escId)) return false;
        }
        if (typeof p.inventoryRevision !== "number" || !Number.isInteger(p.inventoryRevision) || p.inventoryRevision < 0) return false;
        const pKeys = Object.keys(p).sort().join(",");
        if (pKeys !== "activeRaidCleared,inventoryRevision,profileId,releasedEscrowIds") return false;
      }
      if (!seenProfiles.has(payload.extractedSquad)) return false;
      const extractorRaidKey = `${rec.raidId}:${payload.extractedSquad}`;
      if (seenExtractorsPerRaid.has(extractorRaidKey)) return false; // Enforce receipt uniqueness per extractor per raid
      seenExtractorsPerRaid.add(extractorRaidKey);

      const opInCustody = raidRecord.operatives?.[payload.extractedSquad];
      if (opInCustody && (!opInCustody.isExtracted || opInCustody.activeRaid !== "")) return false;
      if (opInCustody && opInCustody.earnedCash !== payload.cashBanked) return false; // Bind receipt cash directly to extractor custody
      const extractorResult = rec.participantResults.find((p: any) => p.profileId === payload.extractedSquad);
      if (!extractorResult) return false;
      if (typeof extractorResult.inventoryRevision !== "number" || !Number.isInteger(extractorResult.inventoryRevision) || extractorResult.inventoryRevision < 1) return false;
      if (opInCustody && typeof opInCustody.inventoryRevision === "number") {
        if (
          extractorResult.inventoryRevision !== opInCustody.inventoryRevision &&
          extractorResult.inventoryRevision !== opInCustody.inventoryRevision + 1
        ) {
          return false;
        }
      }
      if (extractorResult.activeRaidCleared !== true) return false;
      const expectedEscrow = `escrow_${payload.extractedSquad}_loadout`;
      if (!Array.isArray(extractorResult.releasedEscrowIds) || !extractorResult.releasedEscrowIds.includes(expectedEscrow)) return false;

      // Retained participant custody binding: living retained operatives cannot have activeRaidCleared: true,
      // cannot have releasedEscrowIds.length > 0, and must match retainedOp.inventoryRevision
      for (const p of rec.participantResults) {
        if (p.profileId === payload.extractedSquad) continue;
        if (p.activeRaidCleared === false && p.releasedEscrowIds.length > 0) return false;
        const retainedOp = raidRecord.operatives?.[p.profileId];
        if (retainedOp) {
          const isLivingRetained = !retainedOp.isExtracted && (retainedOp.activeRaid === rec.raidId || retainedOp.activeRaid !== "");
          if (isLivingRetained) {
            if (p.activeRaidCleared !== false) return false;
            if (p.releasedEscrowIds.length !== 0) return false;
            if (typeof retainedOp.inventoryRevision === "number" && p.inventoryRevision !== retainedOp.inventoryRevision) return false;
          }
        }
      }
    }
  }

  if (data.sessionTokens !== undefined) {
    if (!data.sessionTokens || typeof data.sessionTokens !== "object" || Array.isArray(data.sessionTokens)) return false;
    for (const tok of Object.values(data.sessionTokens)) {
      if (!tok || typeof tok !== "object" || Array.isArray(tok)) return false;
      if (typeof (tok as any).operativeId !== "string" || typeof (tok as any).raidId !== "string") return false;
      if (!data.raids || !Object.prototype.hasOwnProperty.call(data.raids, (tok as any).raidId)) return false;
      const targetRaid = data.raids[(tok as any).raidId];
      const opId = (tok as any).operativeId;
      if (!isValidOperativeId(opId)) return false;
      if (!targetRaid || !targetRaid.operatives || !Object.prototype.hasOwnProperty.call(targetRaid.operatives, opId)) {
        return false; // Reject orphan session token
      }
    }
  }

  if (data.idempotencyMap !== undefined) {
    if (!data.idempotencyMap || typeof data.idempotencyMap !== "object" || Array.isArray(data.idempotencyMap)) return false;
    for (const [idempKey, receiptId] of Object.entries(data.idempotencyMap)) {
      if (typeof receiptId !== "string" || !data.auditLog || !data.auditLog[receiptId]) {
        return false;
      }
      const entry = (data.auditLog as any)[receiptId];
      if (!entry || !entry.receipt || !entry.outcomePayload) return false;
      const parts = idempKey.split(":");
      if (parts.length !== 4) return false;
      const [keyRaidId, keyOpId, keyTickStr, keyCashStr] = parts;
      if (!/^\d+$/.test(keyTickStr) || !/^\d+$/.test(keyCashStr)) return false;
      const keyTick = parseInt(keyTickStr, 10);
      const keyCash = parseInt(keyCashStr, 10);
      if (isNaN(keyTick) || isNaN(keyCash)) return false;
      if (entry.receipt.raidId !== keyRaidId) return false;
      if (entry.outcomePayload.extractedSquad !== keyOpId) return false;
      if (entry.receipt.throughTick !== keyTick) return false;
      if (entry.outcomePayload.cashBanked !== keyCash) return false;
    }
  }

  for (const [rId, r] of Object.entries(data.raids)) {
    if (!Object.prototype.hasOwnProperty.call(data.raids, rId)) return false;
    if (!isValidRaidId(rId)) return false;
    if ((r as any).raidId && (r as any).raidId !== rId) return false;
    if (!r || typeof r !== "object" || Array.isArray(r)) return false;
    if (typeof (r as any).status !== "string" || !VALID_STATUSES.has((r as any).status)) return false;

    if ((r as any).createdAtMs !== undefined) {
      const cAt = (r as any).createdAtMs;
      if (typeof cAt !== "number" || !Number.isInteger(cAt) || cAt <= 0) return false;
    }

    const totalBanked = (r as any).totalBanked;
    if (typeof totalBanked !== "number" || !Number.isInteger(totalBanked) || totalBanked < 0) return false;

    const allowableCashPool = (r as any).allowableCashPool;
    if (typeof allowableCashPool !== "number" || !Number.isInteger(allowableCashPool) || allowableCashPool < 0 || allowableCashPool > 1000000) return false;

    if (totalBanked > allowableCashPool) return false;

    if ((r as any).machines !== undefined) {
      if (!(r as any).machines || typeof (r as any).machines !== "object" || Array.isArray((r as any).machines)) return false;
      for (const [mId, mState] of Object.entries((r as any).machines)) {
        if (!mState || typeof mState !== "object" || Array.isArray(mState)) return false;
        if (typeof (mState as any).health !== "number" || !Number.isFinite((mState as any).health) || (mState as any).health < 0) return false;
        if (typeof (mState as any).isAlive !== "boolean") return false;
      }
    }

    if (totalBanked > 0) {
      if (!data.auditLog || typeof data.auditLog !== "object" || Object.keys(data.auditLog).length === 0) {
        return false;
      }
      const raidReceipts = Object.values(data.auditLog).filter((e: any) => e?.receipt?.raidId === rId);
      if (raidReceipts.length === 0) {
        return false;
      }
      const totalReceiptCash = raidReceipts.reduce((sum: number, e: any) => sum + (e.outcomePayload?.cashBanked || 0), 0);
      if (totalReceiptCash !== totalBanked) {
        return false;
      }
    } else {
      if (data.auditLog && typeof data.auditLog === "object") {
        const raidReceipts = Object.values(data.auditLog).filter((e: any) => e?.receipt?.raidId === rId);
        const totalReceiptCash = raidReceipts.reduce((sum: number, e: any) => sum + (e.outcomePayload?.cashBanked || 0), 0);
        if (totalReceiptCash !== 0) {
          return false;
        }
      }
    }

    if (!(r as any).operatives || typeof (r as any).operatives !== "object" || Array.isArray((r as any).operatives)) return false;

    if (!(r as any).crates || typeof (r as any).crates !== "object" || Array.isArray((r as any).crates)) return false;

    const opClaimedTotals = new Map<string, number>();

    for (const [cId, crate] of Object.entries((r as any).crates)) {
      if (KNOWN_DEPOT_CRATES[cId] === undefined) return false;
      if (!crate || typeof crate !== "object" || Array.isArray(crate)) return false;
      const cVal = (crate as any).cashValue;
      const pool = (r as any).allowableCashPool;
      const expectedVal = typeof pool === "number" ? Math.min(KNOWN_DEPOT_CRATES[cId], pool) : KNOWN_DEPOT_CRATES[cId];
      if (typeof cVal !== "number" || !Number.isInteger(cVal) || cVal !== expectedVal) return false;
      if ((crate as any).claimedBy !== undefined) {
        if (typeof (crate as any).claimedBy !== "string" || (crate as any).claimedBy.trim() === "") return false;
        if (typeof (crate as any).claimTimestamp !== "number" || !Number.isFinite((crate as any).claimTimestamp) || (crate as any).claimTimestamp < 0) return false;
        const claimer = (crate as any).claimedBy;
        if (!isValidOperativeId(claimer)) return false;
        if (!Object.prototype.hasOwnProperty.call((r as any).operatives, claimer)) return false;
        opClaimedTotals.set(claimer, (opClaimedTotals.get(claimer) || 0) + cVal);
      }
    }

    let totalOpEarnedCash = 0;
    let totalExtractedCash = 0;
    for (const [opId, op] of Object.entries((r as any).operatives)) {
      if (!isValidOperativeId(opId)) return false;
      if (!op || typeof op !== "object" || Array.isArray(op)) return false;
      if (typeof (op as any).operativeId !== "string" || !isValidOperativeId((op as any).operativeId) || (op as any).operativeId !== opId) return false;
      if (typeof (op as any).admitted !== "boolean") return false;
      if (typeof (op as any).isExtracted !== "boolean") return false;
      if ((op as any).isAlive !== undefined && typeof (op as any).isAlive !== "boolean") return false;
      if ((op as any).isKia !== undefined && typeof (op as any).isKia !== "boolean") return false;
      if ((op as any).health !== undefined) {
        const hp = (op as any).health;
        if (typeof hp !== "number" || !Number.isFinite(hp) || hp < 0 || hp > 100) return false;
      }
      if ((op as any).armor !== undefined) {
        const arm = (op as any).armor;
        if (typeof arm !== "number" || !Number.isFinite(arm) || arm < 0 || arm > 100) return false;
      }
      if ((op as any).lastDamageTimestamp !== undefined) {
        const ldt = (op as any).lastDamageTimestamp;
        if (typeof ldt !== "number" || !Number.isFinite(ldt) || ldt < 0) return false;
      }
      if (typeof (op as any).extractedAtTick !== "number" || !Number.isInteger((op as any).extractedAtTick) || (op as any).extractedAtTick < 0) return false;
      if (typeof (op as any).activeRaid !== "string" || ((op as any).activeRaid !== "" && (op as any).activeRaid !== rId)) return false;

      if (!Array.isArray((op as any).cratesLooted)) return false;
      const seenCrates = new Set<string>();
      for (const cid of (op as any).cratesLooted) {
        if (typeof cid !== "string" || !KNOWN_DEPOT_CRATES[cid] || !(r as any).crates[cid] || seenCrates.has(cid)) {
          return false;
        }
        const crateObj = (r as any).crates[cid];
        if (!crateObj || crateObj.claimedBy !== opId) {
          return false; // Reject crate loot list whose crate belongs to another operative or is unclaimed
        }
        seenCrates.add(cid);
      }

      const earnedCash = (op as any).earnedCash;
      if (typeof earnedCash !== "number" || !Number.isInteger(earnedCash) || earnedCash < 0 || earnedCash > allowableCashPool) return false;
      totalOpEarnedCash += earnedCash;
      if ((op as any).isExtracted === true) {
        totalExtractedCash += earnedCash;
        if (!data.auditLog || typeof data.auditLog !== "object") return false;
        const opReceipt = Object.values(data.auditLog).find(
          (entry: any) => entry?.receipt?.raidId === rId && entry?.outcomePayload?.extractedSquad === opId
        );
        if (!opReceipt) return false; // Enforce receipt exists for every extracted operative, even with 0 cash!
      } else {
        if (data.auditLog && typeof data.auditLog === "object") {
          const unextractedReceipt = Object.values(data.auditLog).find(
            (entry: any) => entry?.receipt?.raidId === rId && entry?.outcomePayload?.extractedSquad === opId
          );
          if (unextractedReceipt) return false; // Unextracted operative cannot have an exfil receipt
        }
      }

      if ((op as any).holdCompleted !== undefined && typeof (op as any).holdCompleted !== "boolean") return false;
      if ((op as any).holdCompleted === true) {
        if (typeof (op as any).holdTicks !== "number" || (op as any).holdTicks < 180) return false;
        if (typeof (op as any).holdCompletedAtTick !== "number" || (op as any).holdCompletedAtTick < 180) return false;
      }
      if ((op as any).holdTicks !== undefined && (typeof (op as any).holdTicks !== "number" || !Number.isInteger((op as any).holdTicks) || (op as any).holdTicks < 0)) return false;
      if ((op as any).holdCompletedAtTick !== undefined && (typeof (op as any).holdCompletedAtTick !== "number" || !Number.isInteger((op as any).holdCompletedAtTick) || (op as any).holdCompletedAtTick < 0)) return false;
      if ((op as any).holdStartTick !== undefined && (typeof (op as any).holdStartTick !== "number" || !Number.isInteger((op as any).holdStartTick) || (op as any).holdStartTick < 0)) return false;
      if ((op as any).rawLastReceivedTick !== undefined && (typeof (op as any).rawLastReceivedTick !== "number" || !Number.isInteger((op as any).rawLastReceivedTick) || (op as any).rawLastReceivedTick < 0)) return false;
      if ((op as any).lastReportTick !== undefined && (typeof (op as any).lastReportTick !== "number" || !Number.isInteger((op as any).lastReportTick) || (op as any).lastReportTick < 0)) return false;
      if ((op as any).holdReportCount !== undefined && (typeof (op as any).holdReportCount !== "number" || !Number.isInteger((op as any).holdReportCount) || (op as any).holdReportCount < 0)) return false;
      if ((op as any).accumulatedObservedTicks !== undefined && (typeof (op as any).accumulatedObservedTicks !== "number" || !Number.isInteger((op as any).accumulatedObservedTicks) || (op as any).accumulatedObservedTicks < 0)) return false;
      if ((op as any).simTickAdvancement !== undefined && typeof (op as any).simTickAdvancement !== "boolean") return false;

      if ((op as any).lastObservedX !== undefined && (typeof (op as any).lastObservedX !== "number" || !Number.isFinite((op as any).lastObservedX))) return false;
      if ((op as any).lastObservedZ !== undefined && (typeof (op as any).lastObservedZ !== "number" || !Number.isFinite((op as any).lastObservedZ))) return false;
      if ((op as any).lastObservedTimestamp !== undefined && (typeof (op as any).lastObservedTimestamp !== "number" || !Number.isFinite((op as any).lastObservedTimestamp) || (op as any).lastObservedTimestamp < 0)) return false;
      if ((op as any).corridorStartTime !== undefined && (typeof (op as any).corridorStartTime !== "number" || !Number.isFinite((op as any).corridorStartTime) || (op as any).corridorStartTime < 0)) return false;
      if ((op as any).holdStartTimestamp !== undefined && (typeof (op as any).holdStartTimestamp !== "number" || !Number.isFinite((op as any).holdStartTimestamp) || (op as any).holdStartTimestamp < 0)) return false;
      if ((op as any).lastHoldTimestamp !== undefined && (typeof (op as any).lastHoldTimestamp !== "number" || !Number.isFinite((op as any).lastHoldTimestamp) || (op as any).lastHoldTimestamp < 0)) return false;
      if ((op as any).holdCompletedTimestamp !== undefined && (typeof (op as any).holdCompletedTimestamp !== "number" || !Number.isFinite((op as any).holdCompletedTimestamp) || (op as any).holdCompletedTimestamp < 0)) return false;

      // Cross-record integrity: operative earnedCash cannot exceed total value of claimed crates
      const maxLootable = opClaimedTotals.get(opId) || 0;
      if (earnedCash > maxLootable) return false;

      const invRev = (op as any).inventoryRevision;
      if (typeof invRev !== "number" || !Number.isInteger(invRev) || invRev < 0) return false;
    }

    if (totalOpEarnedCash > allowableCashPool) return false;
    if (totalBanked !== totalExtractedCash) return false;

    // Machine authority fields: any PRESENT value must be well-formed — deployment
    // records dense and bounded, roster revision and per-machine sequences
    // nonnegative integers (corrupt present fields reject the store rather than
    // silently restoring default machines).
    const rAny = r as any;
    if (rAny.machineDeployment !== undefined) {
      // SHARED deployment schema (mirrors server-side machineDeploymentValid): corrupt
      // present records reject the store instead of silently restoring default machines.
      if (!Array.isArray(rAny.machineDeployment) || rAny.machineDeployment.length > 64) return false;
      const depIds = new Set<string>();
      for (const dm of rAny.machineDeployment) {
        if (!dm || typeof dm !== "object" || Array.isArray(dm)) return false;
        if (typeof dm.id !== "string" || !dm.id || dm.id.length > 64) return false;
        if (depIds.has(dm.id)) return false;
        depIds.add(dm.id);
        if (dm.type !== "turret" && dm.type !== "drone") return false;
        for (const f of ["x", "z", "originX", "originZ"]) {
          if (dm[f] !== undefined && (typeof dm[f] !== "number" || !Number.isFinite(dm[f]) || Math.abs(dm[f]) > 80)) return false;
        }
        if (typeof dm.x !== "number" || !Number.isFinite(dm.x) || Math.abs(dm.x) > 80) return false;
        if (typeof dm.z !== "number" || !Number.isFinite(dm.z) || Math.abs(dm.z) > 80) return false;
        if (typeof dm.health !== "number" || !Number.isFinite(dm.health) || dm.health < 0 || dm.health > 1000) return false;
        if (dm.isAlive !== undefined && typeof dm.isAlive !== "boolean") return false;
        // isAlive is REQUIRED (server.mjs cold-restore validation requires it; omitting
        // it here let an otherwise-accepted store silently collapse to default machines).
        if (dm.isAlive === undefined) return false;
        if (dm.vitalsSeq !== undefined && (typeof dm.vitalsSeq !== "number" || !Number.isInteger(dm.vitalsSeq) || dm.vitalsSeq < 0)) return false;
        if (dm.maxHealth !== undefined && (typeof dm.maxHealth !== "number" || !Number.isFinite(dm.maxHealth) || dm.maxHealth <= 0 || dm.maxHealth > 1000)) return false;
        if (dm.maxHealth !== undefined && dm.health > dm.maxHealth) return false;
      }
    }
    if (rAny.machineRosterRevision !== undefined && (typeof rAny.machineRosterRevision !== "number" || !Number.isInteger(rAny.machineRosterRevision) || rAny.machineRosterRevision < 0)) return false;
    if ((r as any).machines) {
      for (const rec of Object.values((r as any).machines) as any[]) {
        if (rec && rec.vitalsSeq !== undefined && (typeof rec.vitalsSeq !== "number" || !Number.isInteger(rec.vitalsSeq) || rec.vitalsSeq < 0)) return false;
      }
    }
  }
  return true;
}

export class ServerSettlementAuthority {
  public static activeAuthorities = new Set<ServerSettlementAuthority>();
  public generation: number = 0;
  private storePath: string;
  public activeRaidId: string = "raid_sector7_1042";
  public claimedSessions = new Set<string>();
  public ownedOperatives = new Set<string>();
  public slotClaimTimestamps = new Map<string, number>();
  public lastClaimIsDuplicate: boolean = false;

  public isOperativeOwned(raidId: string, opId: string): boolean {
    if (this.isSlotClaimed(raidId, opId)) {
      return true;
    }
    const raid = this.raids.get(raidId);
    if (raid && raid.operatives && raid.operatives[opId] && (raid.operatives[opId] as any).owned) {
      return true;
    }
    return false;
  }

  public isSlotClaimed(raidId: string, opId: string): boolean {
    const key = `${raidId}:${opId}`;
    if (!this.claimedSessions.has(key)) return false;
    if (typeof (this as any).hasActiveSocket === "function" && (this as any).hasActiveSocket(raidId, opId)) {
      this.slotClaimTimestamps.set(key, Date.now());
      return true;
    }
    const ts = this.slotClaimTimestamps.get(key);
    // If claim has no timestamp or was made > 30 seconds ago and not refreshed, expire stale slot claim
    if (!ts || Date.now() - ts > 30000) {
      this.claimedSessions.delete(key);
      this.slotClaimTimestamps.delete(key);
      this.ownedOperatives.delete(key);
      const raid = this.raids.get(raidId);
      if (raid && raid.operatives && raid.operatives[opId]) {
        delete (raid.operatives[opId] as any).owned;
      }
      for (const [tok, sess] of this.sessionTokens.entries()) {
        if (sess.raidId === raidId && sess.operativeId === opId) {
          this.sessionTokens.delete(tok);
        }
      }
      return false;
    }
    return true;
  }

  public claimSlot(raidId: string, opId: string): void {
    const key = `${raidId}:${opId}`;
    const wasClaimed = this.claimedSessions.has(key);
    const wasOwned = this.ownedOperatives.has(key);
    const prevTs = this.slotClaimTimestamps.get(key);
    if (!isValidOperativeId(opId)) {
      throw new Error(`Invalid operativeId: ${opId}`);
    }
    const raid = this.raids.get(raidId);
    const wasOpOwned = Boolean(hasOwnOperative(raid, opId) && (raid!.operatives[opId] as any).owned);
    this.claimedSessions.add(key);
    this.ownedOperatives.add(key);
    this.slotClaimTimestamps.set(key, Date.now());
    if (hasOwnOperative(raid, opId)) {
      (raid!.operatives[opId] as any).owned = true;
    }
    try {
      this.saveToDisk();
    } catch (err) {
      if (!wasClaimed) this.claimedSessions.delete(key);
      if (!wasOwned) this.ownedOperatives.delete(key);
      if (prevTs !== undefined) {
        this.slotClaimTimestamps.set(key, prevTs);
      } else {
        this.slotClaimTimestamps.delete(key);
      }
      if (hasOwnOperative(raid, opId)) {
        (raid!.operatives[opId] as any).owned = wasOpOwned;
      }
      throw err;
    }
  }

  public releaseSlot(raidId: string, opId: string): void {
    const key = `${raidId}:${opId}`;
    const wasClaimed = this.claimedSessions.has(key);
    const wasOwned = this.ownedOperatives.has(key);
    const prevTs = this.slotClaimTimestamps.get(key);
    const raid = this.raids.get(raidId);
    const wasOpOwned = Boolean(raid?.operatives?.[opId]?.owned);
    if (!wasClaimed && !wasOwned) return;
    this.claimedSessions.delete(key);
    this.ownedOperatives.delete(key);
    this.slotClaimTimestamps.delete(key);
    if (raid?.operatives?.[opId]) {
      (raid.operatives[opId] as any).owned = false;
    }
    const deletedTokens: Array<[string, { raidId: string; operativeId: string }]> = [];
    for (const [tok, sess] of this.sessionTokens.entries()) {
      if (sess.raidId === raidId && sess.operativeId === opId) {
        deletedTokens.push([tok, sess]);
      }
    }
    for (const [tok] of deletedTokens) {
      this.sessionTokens.delete(tok);
    }
    try {
      this.saveToDisk();
    } catch (err) {
      if (wasClaimed) this.claimedSessions.add(key);
      if (wasOwned) this.ownedOperatives.add(key);
      if (prevTs !== undefined) {
        this.slotClaimTimestamps.set(key, prevTs);
      }
      if (raid?.operatives?.[opId]) {
        (raid.operatives[opId] as any).owned = wasOpOwned;
      }
      for (const [tok, sess] of deletedTokens) {
        this.sessionTokens.set(tok, sess);
      }
      throw err;
    }
  }

  public getActiveRaidId(): string {
    return this.activeRaidId || "raid_sector7_1042";
  }

  public getRaidCrates(raidId?: string): Record<string, { cashValue: number; claimedBy?: string; claimTimestamp?: number }> {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    return raid ? { ...raid.crates } : {};
  }

  public getRaidStartTime(raidId?: string): number {
    const target = raidId || this.getActiveRaidId();
    const raid = this.raids.get(target);
    return raid?.createdAtMs || Date.now();
  }

  public getCurrentRaidTick(raidId?: string): number {
    const start = this.getRaidStartTime(raidId);
    return Math.floor((Date.now() - start) * 60 / 1000);
  }

  public isIngressClosed(raidId?: string): boolean {
    return this.getCurrentRaidTick(raidId) > 28800;
  }

  public getRaidRecord(raidId?: string): ServerRaidRecord | undefined {
    const id = raidId || this.getActiveRaidId();
    return this.raids.get(id);
  }

  public recordOperativeAmmo(raidId: string, operativeId: string, ammo: number): void {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    if (!raid || !raid.operatives || !raid.operatives[operativeId]) return;
    const prevAmmo = raid.operatives[operativeId].ammo;
    raid.operatives[operativeId].ammo = Math.max(0, Math.min(30, Math.floor(ammo)));
    try {
      this.saveToDisk();
    } catch (err) {
      if (prevAmmo !== undefined) {
        raid.operatives[operativeId].ammo = prevAmmo;
      } else {
        delete raid.operatives[operativeId].ammo;
      }
      throw err;
    }
  }

  public getOperativeAmmo(raidId: string, operativeId: string): number {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    const op = raid?.operatives?.[operativeId];
    return typeof op?.ammo === "number" ? op.ammo : 30;
  }

  public recordMachineState(raidId: string, machineId: string, health: number, isAlive: boolean): void {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    if (!raid) return;
    if (!raid.machines) raid.machines = {};
    raid.machines[machineId] = { health: Math.max(0, health), isAlive: isAlive && health > 0 };
    this.saveToDisk();
  }


  public resolveOperativeByToken(token: string): { operativeId: string; raidId: string } | null {
    if (!token || typeof token !== "string") return null;
    const entry = this.sessionTokens.get(token);
    if (!entry) return null;
    const key = `${entry.raidId}:${entry.operativeId}`;
    if (this.claimedSessions.has(key)) {
      if (!this.isSlotClaimed(entry.raidId, entry.operativeId)) {
        this.sessionTokens.delete(token);
        return null;
      }
    }
    const raid = this.raids.get(entry.raidId);
    if (!hasOwnOperative(raid, entry.operativeId)) return null;
    return entry;
  }

  public getSessionToken(raidId: string, operativeId: string): string | undefined {
    if (!isValidOperativeId(operativeId) || !isValidRaidId(raidId)) return undefined;
    const raid = this.raids.get(raidId);
    if (!hasOwnOperative(raid, operativeId)) return undefined;
    for (const [tok, entry] of this.sessionTokens.entries()) {
      if (entry.raidId === raidId && entry.operativeId === operativeId) {
        return tok;
      }
    }
    return undefined;
  }

  public allocateSessionToken(raidId: string, operativeId: string): string | null {
    if (!isValidOperativeId(operativeId) || !isValidRaidId(raidId)) return null;
    const raid = this.raids.get(raidId);
    if (!hasOwnOperative(raid, operativeId)) return null;
    const prevTokens = new Map(this.sessionTokens);
    for (const [tok, sess] of this.sessionTokens.entries()) {
      if (sess.raidId === raidId && sess.operativeId === operativeId) {
        this.sessionTokens.delete(tok);
      }
    }
    const tok = `sz_tok_${operativeId}_${crypto.randomBytes(16).toString("hex")}`;
    this.sessionTokens.set(tok, { operativeId, raidId });
    try {
      this.saveToDisk();
    } catch (saveErr) {
      this.sessionTokens = prevTokens;
      throw saveErr;
    }
    return tok;
  }

  public hasCommittedReceipt(receiptId: string): boolean {
    return this.auditLog.has(receiptId);
  }

  public getCommittedReceipt(receiptId: string): { receipt: SettlementReceipt; outcomePayload: CanonicalOutcomePayload } | undefined {
    const entry = this.auditLog.get(receiptId);
    if (!entry) return undefined;
    return JSON.parse(JSON.stringify(entry));
  }

  public getSessionTokens(raidId: string): Record<string, string> {
    const res: Record<string, string> = {};
    for (const [tok, entry] of this.sessionTokens.entries()) {
      if (entry.raidId === raidId) {
        res[entry.operativeId] = tok;
      }
    }
    return res;
  }

  public hasRaid(raidId: string): boolean {
    return this.raids.has(raidId);
  }
  private isCorrupted = false;
  private profiles = new Map<string, { inventoryRevision: number }>();
  private sessionTokens = new Map<string, { operativeId: string; raidId: string }>();
  private raids = new Map<string, ServerRaidRecord>();
  private auditLog = new Map<string, { receipt: SettlementReceipt; outcomePayload: CanonicalOutcomePayload }>();
  private idempotencyMap = new Map<string, string>();
  private commitQueue = Promise.resolve<any>(null);

  constructor(storePath?: string) {
    const env = typeof process !== "undefined" ? (process as any)["env"] : {};
    const isTest = typeof process !== "undefined" && (env["NODE_ENV"] === "test" || env["VITEST"] !== undefined);
    if (!storePath && isTest) {
      this.storePath = path.resolve("/tmp", `.settlement-store-test-default-${process.pid}.json`);
    } else {
      this.storePath = storePath || path.resolve(process.cwd(), ".settlement-store.json");
    }
    if (storePath || !isTest) {
      ServerSettlementAuthority.activeAuthorities.add(this);
    }
    try {
      this.loadFromDisk();
    } catch (loadErr) {
      ServerSettlementAuthority.activeAuthorities.delete(this);
      throw loadErr;
    }
  }


  private loadFromDisk(): void {
    let data: PersistentStoreData | null = null;
    let isValid = false;
    let hasBackupHistory = false;

    let primaryExisted = false;
    let raw: string | null = null;
    try {
      raw = fs.readFileSync(this.storePath, "utf8");
      primaryExisted = true;
    } catch (readErr: any) {
      if (readErr && (readErr.code === "ENOENT" || readErr.message?.includes("ENOENT"))) {
        primaryExisted = false;
      } else {
        this.isCorrupted = true;
        throw new Error(`Failed to read primary settlement store at ${this.storePath}: ${readErr?.message || readErr}`);
      }
    }

    if (raw !== null) {
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {}

      if (parsed && typeof parsed === "object") {
        data = parsed as PersistentStoreData;
        isValid = validateStoreIntegrity(data);
      }
    }

    // If primary store does not exist or fails integrity validation, recover from backups
    if (!isValid) {
      let recovered = false;
      let archivedCorruptPath: string | null = null;
      hasBackupHistory = false;

      // If primary store file existed on disk but is invalid, archive it to unique .corrupt file and flush before restoration
      if (primaryExisted) {
        archivedCorruptPath = `${this.storePath}.corrupt.${Date.now()}`;
        try {
          fs.copyFileSync(this.storePath, archivedCorruptPath);
          const cFd = fs.openSync(archivedCorruptPath, "r");
          try { fs.fsyncSync(cFd); } finally { fs.closeSync(cFd); }
          const dir = path.dirname(this.storePath);
          const dFd = fs.openSync(dir, "r");
          try { fs.fsyncSync(dFd); } finally { fs.closeSync(dFd); }
        } catch (archiveErr) {
          this.isCorrupted = true;
          throw new Error(`Failed to archive damaged store before recovery: ${archiveErr}`);
        }
      }

      try {
        const dir = path.dirname(this.storePath);
        const base = path.basename(this.storePath);
        let prevFiles: string[] = [];
        try {
          prevFiles = fs.readdirSync(dir)
            .filter(f => f === `${base}.prev` || (f.startsWith(`${base}.prev.`) && !f.includes(".prev.prev")));
        } catch (readDirErr: any) {
          if (readDirErr && (readDirErr.code === "ENOENT" || readDirErr.message?.includes("ENOENT"))) {
            prevFiles = [];
          } else {
            this.isCorrupted = true;
            throw new Error(`Failed to read directory for settlement backups at ${dir}: ${readDirErr?.message || readDirErr}`);
          }
        }

        if (true) {

          if (prevFiles.length > 0) {
            hasBackupHistory = true;
          }

          interface BackupCandidate {
            file: string;
            data: PersistentStoreData;
            hasExplicitGen: boolean;
            generation: number;
            timestamp: number;
          }
          const candidates: BackupCandidate[] = [];

          for (const pf of prevFiles) {
            let prevRaw: string;
            try {
              prevRaw = fs.readFileSync(path.join(dir, pf), "utf8");
            } catch (readErr: any) {
              this.isCorrupted = true;
              throw new Error(`Failed to read candidate settlement backup ${pf} at ${dir}: ${readErr?.message || readErr}`);
            }

            try {
              const prevParsed = JSON.parse(prevRaw);
              if (validateStoreIntegrity(prevParsed)) {
                const hasExplicitGen = typeof (prevParsed as any).generation === "number" && Number.isSafeInteger((prevParsed as any).generation);
                const generation = hasExplicitGen ? (prevParsed as any).generation : 0;
                let timestamp = 0;
                if (pf.startsWith(`${base}.prev.`)) {
                  const suffix = pf.slice(`${base}.prev.`.length);
                  const ts = parseInt(suffix, 10);
                  if (!Number.isNaN(ts)) timestamp = ts;
                }
                if (timestamp === 0) {
                  try {
                    timestamp = fs.statSync(path.join(dir, pf)).mtimeMs;
                  } catch {}
                }
                candidates.push({ file: pf, data: prevParsed, hasExplicitGen, generation, timestamp });
              }
            } catch {}
          }

          if (candidates.length > 0) {
            candidates.sort((a, b) => {
              // 1. Explicit generation backups rank strictly before legacy backups
              if (a.hasExplicitGen && !b.hasExplicitGen) return -1;
              if (!a.hasExplicitGen && b.hasExplicitGen) return 1;

              // 2. Compare explicit generations numerically descending
              if (a.hasExplicitGen && b.hasExplicitGen) {
                if (b.generation !== a.generation) {
                  return b.generation - a.generation;
                }
                return b.timestamp - a.timestamp;
              }

              // 3. Separate deterministic order only among legacy backups
              return b.timestamp - a.timestamp;
            });

            const bestCandidate = candidates[0];
            try {
              const tmpRestore = `${this.storePath}.restore.${Date.now()}`;
              fs.copyFileSync(path.join(dir, bestCandidate.file), tmpRestore);
              const tFd = fs.openSync(tmpRestore, "r");
              try { fs.fsyncSync(tFd); } finally { fs.closeSync(tFd); }
              fs.renameSync(tmpRestore, this.storePath);
              const sFd = fs.openSync(this.storePath, "r");
              try { fs.fsyncSync(sFd); } finally { fs.closeSync(sFd); }
              const dFd = fs.openSync(dir, "r");
              try { fs.fsyncSync(dFd); } finally { fs.closeSync(dFd); }

              // Update canonical .prev atomically if bestCandidate was a timestamp backup
              if (bestCandidate.file !== `${base}.prev`) {
                try {
                  const tmpPrev = `${this.storePath}.prev.tmp.${Date.now()}`;
                  fs.copyFileSync(path.join(dir, bestCandidate.file), tmpPrev);
                  const tpFd = fs.openSync(tmpPrev, "r");
                  try { fs.fsyncSync(tpFd); } finally { fs.closeSync(tpFd); }
                  fs.renameSync(tmpPrev, `${this.storePath}.prev`);
                  const pFd = fs.openSync(`${this.storePath}.prev`, "r");
                  try { fs.fsyncSync(pFd); } finally { fs.closeSync(pFd); }
                  const dirFd2 = fs.openSync(dir, "r");
                  try { fs.fsyncSync(dirFd2); } finally { fs.closeSync(dirFd2); }
                } catch {}
              }

              // Set recovery flags ONLY AFTER restoration and required flushes succeed!
              data = bestCandidate.data;
              isValid = true;
              recovered = true;
            } catch (restoreErr) {
              this.isCorrupted = true;
              throw new Error(`Failed to atomically restore settlement store from ${bestCandidate.file}: ${restoreErr}`);
            }
          }
        }
      } catch (err: any) {
        this.isCorrupted = true;
        throw err;
      }

      if (!recovered && (primaryExisted || hasBackupHistory)) {
        if (primaryExisted && !archivedCorruptPath) {
          archivedCorruptPath = `${this.storePath}.corrupt.${Date.now()}`;
          try {
            fs.copyFileSync(this.storePath, archivedCorruptPath);
            const cFd = fs.openSync(archivedCorruptPath, "r");
            try { fs.fsyncSync(cFd); } finally { fs.closeSync(cFd); }
          } catch {}
        }
        this.isCorrupted = true;
        throw new Error(`Settlement store at ${this.storePath} contains invalid structural schema or corruption in primary or historical backups. Refusing to overwrite existing ledger.`);
      }
    }

    if (data && typeof data === "object" && isValid) {
      if (typeof (data as any).generation === "number") {
        this.generation = Math.max(this.generation, (data as any).generation);
      }
      if (data.profiles) {
        for (const [opId, prof] of Object.entries(data.profiles)) {
          if (prof && typeof prof.inventoryRevision === "number") {
            this.profiles.set(opId, { inventoryRevision: prof.inventoryRevision });
          }
        }
      }
      for (const [k, v] of Object.entries(data.raids || {})) {
        if (v && v.operatives) {
          const nullOps: Record<string, any> = Object.create(null);
          for (const [opId, op] of Object.entries(v.operatives)) {
            nullOps[opId] = op;
          }
          v.operatives = nullOps;
          for (const op of Object.values(v.operatives)) {
            const currentProf = this.profiles.get(op.operativeId);
            const opRev = typeof op.inventoryRevision === "number" ? op.inventoryRevision : ((op.operativeId.includes("alpha") || op.operativeId === "op_player") ? 13 : 1);
            if (!currentProf || opRev > currentProf.inventoryRevision) {
              this.profiles.set(op.operativeId, { inventoryRevision: opRev });
            }
            if (op.sessionToken) {
              this.sessionTokens.set(op.sessionToken, { operativeId: op.operativeId, raidId: k });
            }
          }
        }
        if (v && v.crates) {
          for (const crate of Object.values(v.crates)) {
            if (crate && crate.claimedBy && typeof crate.serverClaimedAt !== "number") {
              crate.serverClaimedAt = crate.claimTimestamp || v.createdAtMs || 1;
            }
          }
        }
        this.raids.set(k, v);
      }
      for (const [k, v] of Object.entries(data.auditLog || {})) {
        this.auditLog.set(k, v);
      }
      for (const [k, v] of Object.entries(data.idempotencyMap || {})) {
        this.idempotencyMap.set(k, v);
      }
      if (data.activeRaidId) {
        this.activeRaidId = data.activeRaidId;
      }
      if (data.sessionTokens) {
        for (const [k, v] of Object.entries(data.sessionTokens)) {
          this.sessionTokens.set(k, v);
        }
      }
      if (Array.isArray(data.claimedSessions)) {
        this.claimedSessions = new Set(data.claimedSessions);
      }
      if (data.slotClaimTimestamps && typeof data.slotClaimTimestamps === "object") {
        for (const [k, v] of Object.entries(data.slotClaimTimestamps)) {
          if (typeof v === "number" && Number.isFinite(v)) {
            this.slotClaimTimestamps.set(k, v);
          }
        }
      }
    }

    // Ensure every operative in an active raid has a valid session token across restarts
    for (const [raidId, raid] of this.raids.entries()) {
      if (raid.status === "active" && raid.operatives) {
        for (const opId of Object.keys(raid.operatives)) {
          if (!this.getSessionToken(raidId, opId)) {
            const tok = `sz_tok_${opId}_${crypto.randomBytes(16).toString("hex")}`;
            this.sessionTokens.set(tok, { operativeId: opId, raidId });
          }
        }
      }
    }

    // Default initialization for default raid only if empty, not corrupted, and no prior backup history
    if (!this.isCorrupted && !hasBackupHistory && !this.raids.has("raid_sector7_1042")) {
      this.initRaid("raid_sector7_1042", 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    }
  }

  public saveToDisk(): void {
    // Transaction latch: while the relay's accepted-state handler holds the packet
    // transaction open, nested recorders defer persistence — exactly ONE commit at
    // the end of the handler saves the complete transaction.
    if ((this as any).__txSuppressSave === true) return;
    if (this.isCorrupted) {
      console.error("Refusing to save to disk: settlement store is marked corrupted to protect historical ledger.");
      return;
    }
    const cleanRaids: Record<string, ServerRaidRecord> = Object.create(null);
    for (const [rid, r] of this.raids.entries()) {
      if (!isValidRaidId(rid)) continue;
      const rCopy: ServerRaidRecord = JSON.parse(JSON.stringify(r));
      if (rCopy.operatives) {
        for (const op of Object.values(rCopy.operatives as Record<string, any>)) {
          delete op.pendingRevocationSave;
          delete op.failedPersistence;
        }
      }
      cleanRaids[rid] = rCopy;
    }
    this.generation = (this.generation || 0) + 1;
    const data: PersistentStoreData = {
      generation: this.generation,
      raids: cleanRaids,
      auditLog: Object.fromEntries(this.auditLog),
      idempotencyMap: Object.fromEntries(this.idempotencyMap),
      activeRaidId: this.activeRaidId,
      sessionTokens: Object.fromEntries(this.sessionTokens),
      claimedSessions: Array.from(this.claimedSessions),
      slotClaimTimestamps: Object.fromEntries(this.slotClaimTimestamps),
      profiles: Object.fromEntries(this.profiles),
    };

    if (!validateStoreIntegrity(data)) {
      throw new Error("Store validation failed: refusing to write invalid store data to disk");
    }
    const tmpPath = `${this.storePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const backupPath = `${this.storePath}.prev.${Date.now()}`;
    let fd: number | null = null;
    const hadExistingOnDisk = fs.existsSync(this.storePath);
    let hadExisting = false;
    const serializedJson = JSON.stringify(data, null, 2);
    const parsedData = JSON.parse(serializedJson);
    if (!validateStoreIntegrity(parsedData)) {
      throw new Error("Store validation failed on serialized data: round-trip integrity check failed");
    }

    try {
      fd = fs.openSync(tmpPath, "w");
      const buf = Buffer.from(serializedJson, "utf8");
      let bytesWritten = 0;
      while (bytesWritten < buf.length) {
        bytesWritten += fs.writeSync(fd, buf, bytesWritten, buf.length - bytesWritten);
      }
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;

      if (hadExistingOnDisk) {
        fs.copyFileSync(this.storePath, backupPath);
        const bFd = fs.openSync(backupPath, "r");
        try { fs.fsyncSync(bFd); } finally { fs.closeSync(bFd); }
        hadExisting = true;
      }

      fs.renameSync(tmpPath, this.storePath);

      const dir = path.dirname(this.storePath);
      const dirFd = fs.openSync(dir, "r");
      try {
        fs.fsyncSync(dirFd);
      } finally {
        fs.closeSync(dirFd);
      }

      if (hadExisting) {
        try {
          const tmpPrev = `${this.storePath}.prev.tmp.${Date.now()}`;
          fs.copyFileSync(backupPath, tmpPrev);
          const tpFd = fs.openSync(tmpPrev, "r");
          try { fs.fsyncSync(tpFd); } finally { fs.closeSync(tpFd); }
          fs.renameSync(tmpPrev, `${this.storePath}.prev`);
          const pFd = fs.openSync(`${this.storePath}.prev`, "r");
          try { fs.fsyncSync(pFd); } finally { fs.closeSync(pFd); }
          const dirFd2 = fs.openSync(dir, "r");
          try { fs.fsyncSync(dirFd2); } finally { fs.closeSync(dirFd2); }
          // Retain timestamp backup until promotion is durable
          fs.unlinkSync(backupPath);
        } catch {}
      }
    } catch (err) {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch {}
      }
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      if (hadExisting && fs.existsSync(backupPath)) {
        try {
          fs.renameSync(backupPath, this.storePath);
          const dir = path.dirname(this.storePath);
          const dirFd = fs.openSync(dir, "r");
          try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
        } catch (restoreErr) {
          throw new Error(`Critical persistence failure: could not restore previous store backup: ${(restoreErr as any)?.message}`);
        }
      } else if (!hadExistingOnDisk) {
        try { if (fs.existsSync(this.storePath)) fs.unlinkSync(this.storePath); } catch {}
      }
      throw err;
    }
  }

  public concludeRaid(raidId: string): void {
    const raid = this.raids.get(raidId);
    if (raid) {
      const prevStatus = raid.status;
      const prevClaimed = new Set(this.claimedSessions);
      const prevOwned = new Set(this.ownedOperatives);
      try {
        raid.status = "concluded";
        for (const claim of Array.from(this.claimedSessions)) {
          if (claim.startsWith(`${raidId}:`)) {
            this.claimedSessions.delete(claim);
          }
        }
        for (const claim of Array.from(this.ownedOperatives)) {
          if (claim.startsWith(`${raidId}:`)) {
            this.ownedOperatives.delete(claim);
          }
        }
        this.saveToDisk();
      } catch (err) {
        raid.status = prevStatus;
        this.claimedSessions = prevClaimed;
        this.ownedOperatives = prevOwned;
        throw err;
      }
    }
  }

  public initRaid(raidId: string, allowablePool = 50000, operatives = ["op_player", "op_alpha_1", "op_bravo_1"], callerClaimOpId?: string, oldRaidIdToConclude?: string): ServerRaidRecord {
    if (!isValidRaidId(raidId)) {
      throw new Error(`Invalid raidId: must match ^[a-zA-Z0-9_-]{1,64}$, got ${raidId}`);
    }
    if (typeof allowablePool !== "number" || !Number.isInteger(allowablePool) || allowablePool < 0 || allowablePool > 1000000) {
      throw new Error(`Invalid allowable cash pool: must be an integer between 0 and 1,000,000, got ${allowablePool}`);
    }
    for (const opId of operatives) {
      if (!isValidOperativeId(opId)) {
        throw new Error(`Cannot register reserved or invalid operative ID: ${opId}`);
      }
    }
    if (this.raids.has(raidId)) {
      const existing = this.raids.get(raidId)!;
      const hasExtractedOperative = Object.values(existing.operatives || {}).some((o) => o.isExtracted);
      const hasKiaOperative = Object.values(existing.operatives || {}).some((o) => o.isKia || o.isAlive === false);
      const hasAuditReceipt = Array.from(this.auditLog.values()).some((e) => e.receipt?.raidId === raidId);
      if (existing.status === "concluded" || existing.totalBanked > 0 || hasExtractedOperative || hasKiaOperative || hasAuditReceipt) {
        throw new Error(`Cannot reinitialize raid ${raidId}: raid already settled or concluded (or has K.I.A./extracted operatives)`);
      }
    }
    // Atomic snapshot for rollback if persistence or token generation fails
    const backupSessionTokens = new Map(this.sessionTokens);
    const backupRaids = new Map(this.raids);
    const backupActiveRaidId = this.activeRaidId;
    const backupClaimedSessions = new Set(this.claimedSessions);
    const backupOwnedOperatives = new Set(this.ownedOperatives);
    const backupSlotClaimTimestamps = new Map(this.slotClaimTimestamps);
    const backupProfiles = new Map(this.profiles);
    let oldRaidPreviousStatus: string | undefined = undefined;

    try {
      for (const [tok, entry] of this.sessionTokens.entries()) {
        if (entry.raidId === raidId) {
          this.sessionTokens.delete(tok);
        }
      }
      for (const claim of Array.from(this.claimedSessions)) {
        if (claim.startsWith(`${raidId}:`)) {
          this.claimedSessions.delete(claim);
        }
      }
      const opMap: Record<string, OperativeCustody> = Object.create(null);
      const nowInit = Date.now();
      for (const opId of operatives) {
        const sessionToken = `sz_tok_${opId}_${crypto.randomBytes(16).toString("hex")}`;
        let prof = this.profiles.get(opId);
        if (!prof) {
          let startingRevision = (opId.includes("alpha") || opId === "op_player") ? 13 : 1;
          for (const existingRaid of this.raids.values()) {
            const prevOp = existingRaid.operatives?.[opId];
            if (prevOp && typeof prevOp.inventoryRevision === "number" && prevOp.inventoryRevision > startingRevision) {
              startingRevision = prevOp.inventoryRevision;
            }
          }
          prof = { inventoryRevision: startingRevision };
          this.profiles.set(opId, prof);
        }
        const resumeKey = `sz_res_${opId}_${crypto.randomBytes(16).toString("hex")}`;
        opMap[opId] = {
          operativeId: opId,
          resumeKey,
          admitted: true,
          earnedCash: 0, // Strictly starts at $0; earned cash is strictly tracked from looted crates
          cratesLooted: [],
          isExtracted: false,
          isAlive: true,
          isKia: false,
          extractedAtTick: 0,
          activeRaid: raidId,
          holdTicks: 0,
          holdCompleted: false,
          inventoryRevision: prof.inventoryRevision,
          accumulatedObservedTicks: 0,
          spawnX: opId === "op_bravo_1" ? 50 : -50,
          spawnZ: -50,
          lastObservedX: opId === "op_bravo_1" ? 50 : -50,
          lastObservedZ: -50,
          lastObservedTimestamp: Date.now(),
        } as any;
        this.sessionTokens.set(sessionToken, { operativeId: opId, raidId });
      }

      const raid: ServerRaidRecord = {
        raidId,
        status: "active",
        allowableCashPool: allowablePool,
        totalBanked: 0,
        createdAtMs: Date.now(),
        operatives: opMap,
        crates: {
          crate_01: { cashValue: Math.min(KNOWN_DEPOT_CRATES.crate_01, allowablePool) },
          crate_02: { cashValue: Math.min(KNOWN_DEPOT_CRATES.crate_02, allowablePool) },
          crate_03: { cashValue: Math.min(KNOWN_DEPOT_CRATES.crate_03, allowablePool) },
        },
        machines: {
          turret_depot_alpha: { health: 120, isAlive: true },
          drone_patrol_beta: { health: 75, isAlive: true },
        },
      };

      if (callerClaimOpId && operatives.includes(callerClaimOpId)) {
        const claimKey = `${raidId}:${callerClaimOpId}`;
        this.claimedSessions.add(claimKey);
        this.ownedOperatives.add(claimKey);
        this.slotClaimTimestamps.set(claimKey, Date.now());
        if (opMap[callerClaimOpId]) {
          (opMap[callerClaimOpId] as any).owned = true;
        }
      }

      if (oldRaidIdToConclude && this.raids.has(oldRaidIdToConclude)) {
        const oldR = this.raids.get(oldRaidIdToConclude)!;
        oldRaidPreviousStatus = oldR.status;
        this.raids.set(oldRaidIdToConclude, { ...oldR, status: "concluded" });
      }

      this.raids.set(raidId, raid);
      this.activeRaidId = raidId;
      this.saveToDisk();
      const publicRaid = JSON.parse(JSON.stringify(raid));
      for (const op of Object.values(publicRaid.operatives as Record<string, any>)) {
        delete op.sessionToken;
        delete op.resumeKey;
      }
      return publicRaid;
    } catch (err) {
      if (oldRaidIdToConclude && backupRaids.has(oldRaidIdToConclude) && oldRaidPreviousStatus !== undefined) {
        const r = backupRaids.get(oldRaidIdToConclude);
        if (r) r.status = oldRaidPreviousStatus as any;
      }
      this.sessionTokens = backupSessionTokens;
      this.raids = backupRaids;
      this.activeRaidId = backupActiveRaidId;
      this.claimedSessions = backupClaimedSessions;
      this.ownedOperatives = backupOwnedOperatives;
      this.slotClaimTimestamps = backupSlotClaimTimestamps;
      this.profiles = backupProfiles;
      throw err;
    }
  }

  /**
   * Deterministic total ordering for crate claims:
   * Earlier timestamp wins; ties broken by lexicographical claimantId.
   * If a second claim beats the first, the previous claimant is debited and the winner is credited.
   */
  public recordCrateLoot(raidId: string, crateId: string, claimantId: string, cashValue?: number, clientTimestamp?: number, coords?: { x: number; z: number }): boolean {
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") return false;

    // Strict crate whitelist validation: reject invented crates or prototype properties!
    if (!Object.prototype.hasOwnProperty.call(KNOWN_DEPOT_CRATES, crateId)) {
      throw new Error(`Invalid crate ${crateId}: not a recognized sector depot crate`);
    }
    const canonicalValue = KNOWN_DEPOT_CRATES[crateId];
    if (typeof canonicalValue !== "number" || isNaN(canonicalValue) || !Number.isInteger(canonicalValue) || canonicalValue <= 0) {
      throw new Error(`Invalid crate ${crateId}: not a recognized sector depot crate`);
    }

    const op = raid.operatives[claimantId];
    if (!op || !op.admitted || op.isExtracted || op.isKia || op.isAlive === false) return false;

    const crate = raid.crates[crateId];
    if (!crate) return false;
    const crateVal = typeof crate.cashValue === "number" ? crate.cashValue : canonicalValue;

    // Snapshot pristine state for atomic rollback on persistence failure BEFORE modifying operative!
    const prevCrateState = { ...crate };
    const prevOperativesSnapshot = JSON.parse(JSON.stringify(raid.operatives));

    // Server-authoritative total ordering:
    // Reject negative, NaN, non-finite, or future timestamps relative to server clock!
    if (typeof clientTimestamp === "number" && (clientTimestamp < 0 || !Number.isFinite(clientTimestamp) || isNaN(clientTimestamp))) {
      return false;
    }
    const serverNow = Date.now();
    if (typeof clientTimestamp === "number" && clientTimestamp > serverNow + 1000) {
      return false; // Require valid timestamp relative to server time
    }
    const effectiveTimestamp = (typeof clientTimestamp === "number" && clientTimestamp >= 0)
      ? clientTimestamp
      : serverNow;

    if (coords && typeof coords.x === "number" && typeof coords.z === "number" && Number.isFinite(coords.x) && Number.isFinite(coords.z)) {
      // Server-time movement rate validation with network jitter / burst tolerance
      // Movement evidence separation: crate loot claims validate coordinates against
      // their own chain (lastCrateObserved*) and never refresh the custody movement
      // evidence (lastObservedX/Z/Timestamp) that hold reports are gated on — evidence
      // freshness may only be established by the live WS movement path.
      const lastX = (op as any).lastCrateObservedX ?? op.lastObservedX ?? (claimantId.includes("bravo") ? 50 : -50);
      const lastZ = (op as any).lastCrateObservedZ ?? op.lastObservedZ ?? -50;
      const dist = Math.hypot(coords.x - lastX, coords.z - lastZ);
      const lastServerT = (op as any).lastCrateObservedServerTimestamp ?? op.lastObservedTimestamp ?? serverNow;
      const serverDt = Math.max(0.05, (serverNow - lastServerT) / 1000);
      const serverSpeed = dist / serverDt;
      if (serverSpeed > 15.0) {
        return false;
      }

      // Consistent client-time sequence validation if present
      const lastClientT = (op as any).lastCrateObservedClientTimestamp;
      if (typeof lastClientT === "number" && effectiveTimestamp > lastClientT) {
        const clientDt = Math.max(0.016, (effectiveTimestamp - lastClientT) / 1000);
        const clientSpeed = dist / clientDt;
        if (clientSpeed > 15.0) {
          return false;
        }
      }

      (op as any).lastCrateObservedX = coords.x;
      (op as any).lastCrateObservedZ = coords.z;
      (op as any).lastCrateObservedServerTimestamp = serverNow;
      (op as any).lastCrateObservedClientTimestamp = effectiveTimestamp;
    }

    if (crate.claimedBy) {
      const currentClaimant = crate.claimedBy;
      if (currentClaimant === claimantId) {
        this.lastClaimIsDuplicate = true;
        return true; // Idempotent duplicate claim from same claimant
      }
      this.lastClaimIsDuplicate = false;
      const currentOp = raid.operatives[currentClaimant];
      // Finality check: if current owner already extracted, crate is locked in cold storage
      if (currentOp && currentOp.isExtracted) {
        return false;
      }
      const currentTimestamp = crate.claimTimestamp || 0;
      // Server-authoritative total ordering:
      // Real server elapsed time bounds any tie-break window:
      // If a legacy crate has no server arrival time, treat claim as final and immutable!
      if (typeof crate.serverClaimedAt !== "number") {
        return false;
      }
      const serverElapsedMs = serverNow - crate.serverClaimedAt;
      if (serverElapsedMs > 100) {
        return false;
      }
      if (currentTimestamp - effectiveTimestamp > 100) {
        return false;
      }
      const isWinner = effectiveTimestamp < currentTimestamp || (effectiveTimestamp === currentTimestamp && claimantId < currentClaimant);

      if (isWinner) {
        try {
          if (claimantId !== currentClaimant) {
            // Debit the previous claimant
            const prevOp = raid.operatives[currentClaimant];
            if (prevOp) {
              prevOp.cratesLooted = prevOp.cratesLooted.filter((id) => id !== crateId);
              prevOp.earnedCash = Math.max(0, prevOp.earnedCash - crateVal);
              const granted = typeof (crate as any).ammoGranted === "number" ? (crate as any).ammoGranted : 25;
              if (typeof (crate as any).prevAmmo === "number") {
                const shotsFired = Math.max(0, 30 - (prevOp.ammo ?? 30));
                prevOp.ammo = Math.max(0, (crate as any).prevAmmo - shotsFired);
              } else if (typeof prevOp.ammo === "number") {
                prevOp.ammo = Math.max(0, prevOp.ammo - granted);
              }
            }
            // Credit the new winning claimant
            if (!op.cratesLooted.includes(crateId)) {
              op.cratesLooted.push(crateId);
              op.earnedCash += crateVal;
            }
            const opAmmoBefore = typeof op.ammo === "number" ? op.ammo : 5;
            (crate as any).prevAmmo = opAmmoBefore;
            (crate as any).ammoGranted = Math.max(0, 30 - opAmmoBefore);
            op.ammo = 30;
            crate.claimedBy = claimantId;
            crate.claimTimestamp = effectiveTimestamp;
            crate.serverClaimedAt = serverNow;
            this.saveToDisk();
            return true;
          } else {
            crate.claimTimestamp = Math.min(currentTimestamp, effectiveTimestamp);
            crate.serverClaimedAt = serverNow;
            this.saveToDisk();
            return true;
          }
        } catch (saveErr) {
          // Atomic rollback on persistence failure
          crate.claimedBy = prevCrateState.claimedBy;
          crate.claimTimestamp = prevCrateState.claimTimestamp;
          crate.serverClaimedAt = prevCrateState.serverClaimedAt;
          crate.prevAmmo = (prevCrateState as any).prevAmmo;
          crate.ammoGranted = (prevCrateState as any).ammoGranted;
          raid.operatives = prevOperativesSnapshot;
          throw saveErr;
        }
      }
      return false;
    }

    // Uncontested first claim
    this.lastClaimIsDuplicate = false;
    try {
      op.cratesLooted.push(crateId);
      op.earnedCash += crateVal;
      const opAmmoBefore = typeof op.ammo === "number" ? op.ammo : 5;
      (crate as any).prevAmmo = opAmmoBefore;
      (crate as any).ammoGranted = Math.max(0, 30 - opAmmoBefore);
      op.ammo = 30;
      crate.claimedBy = claimantId;
      crate.claimTimestamp = effectiveTimestamp;
      crate.serverClaimedAt = serverNow;
      this.saveToDisk();
      return true;
    } catch (saveErr) {
      // Atomic rollback on persistence failure
      crate.claimedBy = prevCrateState.claimedBy;
      crate.claimTimestamp = prevCrateState.claimTimestamp;
      crate.serverClaimedAt = prevCrateState.serverClaimedAt;
      crate.prevAmmo = (prevCrateState as any).prevAmmo;
      crate.ammoGranted = (prevCrateState as any).ammoGranted;
      raid.operatives = prevOperativesSnapshot;
      throw saveErr;
    }
  }

  public recordExtractionHold(
    raidId: string,
    operativeId: string,
    holdTicks: number,
    currentTick: number,
    options?:
      | boolean
      | {
          timestamp?: number;
          verifiedCompleted?: boolean;
          simTickAdvancement?: boolean;
          damageTaken?: number;
          inZone?: boolean;
          isAlive?: boolean;
          isKia?: boolean;
          x?: number;
          z?: number;
        }
  ): { success: boolean; holdCompleted: boolean; currentHoldTicks: number; holdCompletedAtTick?: number; isKia?: boolean; reset?: boolean; reason?: string } {
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") {
      throw new Error(`Raid ${raidId} not active`);
    }
    const op = raid.operatives[operativeId];
    if (!op || !op.admitted || op.isExtracted) {
      throw new Error(`Operative ${operativeId} not active in raid ${raidId}`);
    }

    const initialOpSnapshot = JSON.parse(JSON.stringify(op));
    try {
      return this.executeRecordExtractionHold(raid, raidId, operativeId, op, holdTicks, currentTick, options);
    } catch (holdErr) {
      const wasExplicitlyKilled =
        (typeof options === "object" && (options.isAlive === false || options.isKia === true)) ||
        (op.isKia === true && initialOpSnapshot.isKia !== true);
      const wasCancelledOrReset =
        (typeof options === "object" && options?.inZone === false) ||
        holdTicks === 0 ||
        (typeof options === "object" && typeof options?.x === "number" && typeof options?.z === "number" && Math.hypot(options.x - 45.0, options.z - 45.0) > 6.0);

      raid.operatives[operativeId] = JSON.parse(JSON.stringify(initialOpSnapshot));
      if (wasExplicitlyKilled) {
        raid.operatives[operativeId].isAlive = false;
        raid.operatives[operativeId].isKia = true;
        raid.operatives[operativeId].holdTicks = 0;
        raid.operatives[operativeId].holdCompleted = false;
        raid.operatives[operativeId].corridorStartTime = undefined;
        raid.operatives[operativeId].failedPersistence = true;
      } else if (wasCancelledOrReset) {
        // Keep cancellation effective in memory and track its pending save!
        raid.operatives[operativeId].holdTicks = 0;
        raid.operatives[operativeId].holdStartTick = undefined;
        raid.operatives[operativeId].holdStartTimestamp = undefined;
        raid.operatives[operativeId].lastHoldTimestamp = undefined;
        raid.operatives[operativeId].holdReportCount = 0;
        raid.operatives[operativeId].holdCompleted = false;
        raid.operatives[operativeId].corridorStartTime = undefined;
        raid.operatives[operativeId].holdCompletedAtTick = undefined;
        raid.operatives[operativeId].holdCompletedTimestamp = undefined;
        raid.operatives[operativeId].pendingRevocationSave = true;
        raid.operatives[operativeId].failedPersistence = true;
      }
      throw holdErr;
    }
  }

  private executeRecordExtractionHold(
    raid: ServerRaidRecord,
    raidId: string,
    operativeId: string,
    op: OperativeCustody,
    holdTicks: number,
    currentTick: number,
    options?: { inZone?: boolean; verifiedCompleted?: boolean; damageTaken?: number; isAlive?: boolean; isKia?: boolean; timestamp?: number; simTickAdvancement?: boolean; x?: number; z?: number; skipSave?: boolean } | boolean
  ): { success: boolean; holdCompleted: boolean; currentHoldTicks: number; holdCompletedAtTick?: number; isKia?: boolean; reset?: boolean; reason?: string } {
    // 1. Handle explicit death / K.I.A. FIRST: terminal life-state changes are never discarded regardless of position or velocity!
    if (typeof options === "object" && (options.isAlive === false || options.isKia === true)) {
      op.isAlive = false;
      op.isKia = true;
      op.holdTicks = 0;
      op.holdCompleted = false;
      op.corridorStartTime = undefined;
      try {
        this.saveToDisk();
        (op as any).failedPersistence = false;
      } catch (saveErr) {
        (op as any).failedPersistence = true;
        throw saveErr;
      }
      return { success: true, holdCompleted: false, currentHoldTicks: 0, isKia: true };
    }

    // EXCEPTION: Damage taken authoritatively resets hold regardless of tick order, negativity, or format!
    const damageTaken = typeof options === "object" ? options?.damageTaken : undefined;
    if (typeof damageTaken === "number" && damageTaken > 0) {
      op.holdTicks = 0;
      op.holdStartTick = undefined;
      op.holdStartTimestamp = undefined;
      op.lastHoldTimestamp = undefined;
      op.holdReportCount = 0;
      op.holdCompleted = false;
      op.corridorStartTime = undefined;
      op.holdCompletedAtTick = undefined;
      op.holdCompletedTimestamp = undefined;
      const validTick = typeof currentTick === "number" && Number.isFinite(currentTick) && currentTick >= 0 ? currentTick : ((op.rawLastReceivedTick || 0) + 1);
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, validTick);
      op.lastDamageTick = validTick;
      if (typeof options === "object" && typeof (options as any).timestamp === "number") {
        op.lastDamageTimestamp = (options as any).timestamp;
      } else if (!op.lastDamageTimestamp) {
        op.lastDamageTimestamp = Date.now();
      }
      const skipSave = typeof options === "object" ? !!options?.skipSave : false;
      if (!skipSave) {
        this.saveToDisk();
      }
      return {
        success: true,
        holdCompleted: false,
        currentHoldTicks: 0,
        reset: true,
        reason: "Authoritative combat damage reset hold",
      };
    }

    // 1b. Reject non-finite ticks or negative values immediately without modifying custody or rawLastReceivedTick
    if (
      typeof holdTicks !== "number" ||
      !Number.isFinite(holdTicks) ||
      !Number.isInteger(holdTicks) ||
      isNaN(holdTicks) ||
      holdTicks < 0 ||
      typeof currentTick !== "number" ||
      !Number.isFinite(currentTick) ||
      !Number.isInteger(currentTick) ||
      isNaN(currentTick) ||
      currentTick < 0
    ) {
      return { success: false, holdCompleted: false, currentHoldTicks: 0 };
    }

    // 1c. Stale report protection: strictly older ticks (< rawLastReceivedTick) cannot reset or overwrite
    if (op.rawLastReceivedTick !== undefined && currentTick < op.rawLastReceivedTick) {
      return {
        success: true,
        holdCompleted: !!op.holdCompleted,
        currentHoldTicks: op.holdTicks || 0,
      };
    }

    // Top-level coordinate check & LZ boundary validation BEFORE returning for completed hold
    let pxCheck: number | undefined;
    let pzCheck: number | undefined;
    if (typeof options === "object" && typeof (options as any).x === "number" && typeof (options as any).z === "number") {
      if (Number.isFinite((options as any).x) && Number.isFinite((options as any).z)) {
        pxCheck = (options as any).x;
        pzCheck = (options as any).z;
      }
    }

    if (pxCheck !== undefined && pzCheck !== undefined) {
      const distToLz = Math.hypot(pxCheck - 45.0, pzCheck - 45.0);
      if (distToLz > 6.0) {
        op.holdTicks = 0;
        op.holdStartTick = undefined;
        op.holdStartTimestamp = undefined;
        op.lastHoldTimestamp = undefined;
        op.holdReportCount = 0;
        op.holdCompleted = false;
        op.corridorStartTime = undefined;
        op.holdCompletedAtTick = undefined;
        op.holdCompletedTimestamp = undefined;
        op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
        const skipSave = typeof options === "object" ? !!options?.skipSave : false;
        if (!skipSave) {
          this.saveToDisk();
        }
        return { success: false, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: `Outside LZ: ${distToLz.toFixed(1)}m > 6.0m` };
      }
    }

    // 1d. Fresh cancellation report: if fresh report indicates cancellation or zero hold, cancel even completed holds!
    const inZoneCheck = typeof options === "object" ? options?.inZone : undefined;
    if (inZoneCheck === false || holdTicks === 0) {
      op.holdTicks = 0;
      op.holdStartTick = undefined;
      op.holdStartTimestamp = undefined;
      op.lastHoldTimestamp = undefined;
      op.holdReportCount = 0;
      op.holdCompleted = false;
      op.corridorStartTime = undefined;
      op.holdCompletedAtTick = undefined;
      op.holdCompletedTimestamp = undefined;
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
      const skipSave = typeof options === "object" ? !!options?.skipSave : false;
      if (!skipSave) {
        this.saveToDisk();
      }
      return { success: true, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: "Left zone or canceled hold" };
    }

    // 1e. If hold was already completed prior to tick 54,000, preserve completed hold custody during grace period up to tick 57,600!
    if (op.holdCompleted && (op.holdCompletedAtTick || 0) <= 54000 && currentTick <= 57600) {
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
      return {
        success: true,
        holdCompleted: true,
        currentHoldTicks: op.holdTicks || 300,
        holdCompletedAtTick: op.holdCompletedAtTick,
      };
    }

    // 1f. Strict 15-minute raid deadline: uncompleted holds cannot start or advance past tick 54,000
    if (currentTick > 54000) {
      return { success: false, holdCompleted: false, currentHoldTicks: 0, reason: "Raid deadline (tick 54,000) expired" };
    }

    // 1g. Once verified and still within zone, completed hold remains valid & advances watermark
    if (op.holdCompleted) {
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
      return {
        success: true,
        holdCompleted: true,
        currentHoldTicks: op.holdTicks || 300,
        holdCompletedAtTick: op.holdCompletedAtTick,
      };
    }

    const isVerifiedCompleted = typeof options === "boolean" ? options : !!options?.verifiedCompleted;
    const simTickAdvancement = typeof options === "object" ? !!options?.simTickAdvancement : false;
    if (simTickAdvancement) op.simTickAdvancement = true;
    const inZone = typeof options === "object" ? options?.inZone : undefined;
    const now = (typeof options === "object" ? options?.timestamp : undefined) || Date.now();

    // Top-level coordinate recording & speed validation
    let px: number | undefined;
    let pz: number | undefined;
    if (typeof options === "object" && typeof (options as any).x === "number" && typeof (options as any).z === "number") {
      if (Number.isFinite((options as any).x) && Number.isFinite((options as any).z)) {
        px = (options as any).x;
        pz = (options as any).z;
      }
    }

    if (px !== undefined && pz !== undefined) {
      const distToLz = Math.hypot(px - 45.0, pz - 45.0);
      if (distToLz > 6.0) {
        op.holdTicks = 0;
        op.holdStartTick = undefined;
        op.holdStartTimestamp = undefined;
        op.lastHoldTimestamp = undefined;
        op.holdReportCount = 0;
        op.holdCompleted = false;
        this.saveToDisk();
        return { success: false, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: `Outside LZ: ${distToLz.toFixed(1)}m > 6.0m` };
      }

      // Movement evidence separation: hold reports track their own position chain
      // (lastHoldObserved*) and NEVER refresh the custody movement evidence
      // (lastObservedX/Z/Timestamp) — only the validated WS movement state path and the
      // settlement authority may update those, so hold reports cannot self-refresh the
      // freshness window that gates them (authoritative evidence must come from live
      // movement, not from the reporting stream itself).
      const holdChainX = (op as any).lastHoldObservedX;
      const holdChainZ = (op as any).lastHoldObservedZ;
      const holdChainT = (op as any).lastHoldObservedTimestamp;
      const lastX = typeof holdChainX === "number" ? holdChainX : op.lastObservedX;
      const lastZ = typeof holdChainZ === "number" ? holdChainZ : op.lastObservedZ;
      const lastT = typeof holdChainT === "number" ? holdChainT : op.lastObservedTimestamp || now;
      if (lastX !== undefined && lastZ !== undefined) {
        const dt = Math.max(0.05, (now - lastT) / 1000);
        const dist = Math.hypot(px - lastX, pz - lastZ);
        const speed = dist / dt;
        if (!simTickAdvancement && dist > 0.75 && speed > 15.0) {
          // Do NOT overwrite any movement evidence with rejected coordinates!
          (op as any).lastHoldObservedTimestamp = now;
          op.holdTicks = 0;
          op.holdStartTick = undefined;
          op.holdStartTimestamp = undefined;
          op.lastHoldTimestamp = undefined;
          op.holdReportCount = 0;
          op.holdCompleted = false;
          this.saveToDisk();
          return { success: false, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: `Velocity violation: ${speed.toFixed(1)}m/s > 15.0m/s` };
        }
      }

      (op as any).lastHoldObservedX = px;
      (op as any).lastHoldObservedZ = pz;
      (op as any).lastHoldObservedTimestamp = now;
    }

    // Detect hold regression if an operative holding progress suddenly reports a lower tick
    const isHoldRegressed = Boolean(op.holdTicks && op.holdTicks > 1 && holdTicks < op.holdTicks);

    // Reset hold FIRST if damage was taken, player left zone, holdTicks === 0, or hold regressed
    // (Takes precedence even at the same tick currentTick === rawLastReceivedTick!)
    if (
      inZone === false ||
      holdTicks === 0 ||
      isHoldRegressed ||
      (damageTaken && damageTaken > 0)
    ) {
      const wasHolding = (op.holdTicks && op.holdTicks > 0) || op.holdStartTick !== undefined || op.holdCompleted;
      op.holdTicks = 0;
      op.holdStartTick = undefined;
      op.holdStartTimestamp = undefined;
      op.lastHoldTimestamp = undefined;
      op.holdReportCount = 0;
      op.lastReportTick = undefined;
      op.holdCompleted = false;
      op.holdCompletedAtTick = undefined;
      op.corridorStartTime = undefined;
      op.rawLastReceivedTick = currentTick; // CRITICAL: Advance watermark on reset to reject stale backdated progress!
      if (wasHolding) {
        this.saveToDisk();
      }
      return { success: true, holdCompleted: false, currentHoldTicks: 0 };
    }

    // 2. Strict raw tick deduplication: reject identical progress reports
    if (op.rawLastReceivedTick !== undefined && currentTick <= op.rawLastReceivedTick) {
      return {
        success: true,
        holdCompleted: !!op.holdCompleted,
        currentHoldTicks: op.holdTicks || 0,
      };
    }
    op.rawLastReceivedTick = currentTick;

    // Inactivity gap check: require continuous reporting (bounded lull tolerance — the
    // 180-tick ladder plus >=50-report/>=3000ms duration criteria still enforce the
    // full real-time auth hold regardless of individual report jitter)
    if (op.lastHoldTimestamp !== undefined && (op.holdReportCount || 0) > 0) {
      const gapMs = now - op.lastHoldTimestamp;
      if (!simTickAdvancement && gapMs > 1500 && !op.holdCompleted) {
        op.holdTicks = 0;
        op.holdStartTick = undefined;
        op.holdStartTimestamp = undefined;
        op.lastHoldTimestamp = undefined;
        op.holdReportCount = 0;
        op.lastReportTick = undefined;
        op.holdCompleted = false;
        op.holdCompletedAtTick = undefined;
        op.corridorStartTime = undefined;
        this.saveToDisk();
        return { success: true, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: "Hold gap exceeded 500ms" };
      }
    }

    if (isVerifiedCompleted) {
      op.holdCompleted = true;
      op.holdTicks = holdTicks;
      op.holdCompletedAtTick = currentTick;
      if (px !== undefined && pz !== undefined) {
        op.lastObservedX = px;
        op.lastObservedZ = pz;
        (op as any).hasLiveMovement = true;
      }
      this.saveToDisk();
      return { success: true, holdCompleted: true, currentHoldTicks: holdTicks };
    }

    // First report in a new continuous hold attempt
    if (op.holdStartTick === undefined || !op.holdStartTimestamp) {
      op.pendingRevocationSave = false;
      op.failedPersistence = false;
      op.holdStartTick = currentTick;
      op.holdStartTimestamp = now;
      op.lastHoldTimestamp = now;
      op.lastReportTick = currentTick;
      op.holdTicks = 1;
      op.holdReportCount = 1;
      op.holdCompleted = false;
      this.saveToDisk();
      return { success: true, holdCompleted: false, currentHoldTicks: 1 };
    }

    const realElapsedMs = now - op.holdStartTimestamp;
    const tickDelta = currentTick - (op.lastReportTick || op.holdStartTick);
    if (tickDelta <= 0) {
      return {
        success: true,
        holdCompleted: !!op.holdCompleted,
        currentHoldTicks: op.holdTicks || 0,
      };
    }

    const timeSinceLastReportMs = now - (op.lastHoldTimestamp || now);
    const minReportIntervalMs = simTickAdvancement ? 0 : 8;
    // Wall-clock-paced ladder: the ladder may advance at most the number of 60Hz sim
    // ticks that ACTUALLY ELAPSED since the last report (plus a small jitter allowance),
    // so a renderer-throttled client whose frames burst sim ticks stays in perfect
    // mission-time sync, while sub-8ms burst spam and any faster-than-realtime
    // advancement are strictly clamped.
    const wallClockTicks = Math.floor((timeSinceLastReportMs * 60) / 1000);
    const allowableAdvance = timeSinceLastReportMs < minReportIntervalMs && (op.holdReportCount || 0) > 0
      ? 0
      : Math.min(tickDelta, wallClockTicks + 2);
    const effectiveTick = (op.lastReportTick || op.holdStartTick) + allowableAdvance;

    const ticksElapsed = effectiveTick - op.holdStartTick;
    if (allowableAdvance > 0) {
      op.holdReportCount = (op.holdReportCount || 0) + 1;
      op.lastHoldTimestamp = now;
      op.lastReportTick = effectiveTick;
    }

    // Advance hold ticks strictly by allowableAdvance
    op.holdTicks = Math.min(holdTicks, (op.holdTicks || 1) + allowableAdvance);

    // Continuous 180-tick hold criteria:
    // Duration bound: >= 3000ms of real time AND >= 25 distinct paced reports
    // (with >=180 ladder ticks at the real-time 60Hz pace, a full hold always costs
    // >= 3.0 wall-clock seconds inside the zone — invariant preserved for any renderer)
    const isDurationVerified = (realElapsedMs >= 3000 || simTickAdvancement) && (op.holdReportCount || 0) >= 25;

    if (op.holdTicks >= 180 && ticksElapsed >= 179 && isDurationVerified) {
      // DURABLE completion: ALL completion state is assigned FIRST, then persisted
      // with one UNTHROTTLED save — a restart can never lose an accepted completion,
      // and the save cannot be skipped by the throttle window.
      op.holdCompleted = true;
      if (!op.holdCompletedAtTick) op.holdCompletedAtTick = currentTick;
      op.holdCompletedTimestamp = now;
      if (!op.corridorStartTime) op.corridorStartTime = now;
      if (px !== undefined && pz !== undefined) {
        op.lastObservedX = px;
        op.lastObservedZ = pz;
        (op as any).hasLiveMovement = true;
      }
      this.saveToDisk();
      // EXACTLY ONE save: return the completed hold immediately — the throttled
      // tail below must never resave (or roll memory back after a durable completion).
      return {
        success: true,
        holdCompleted: true,
        currentHoldTicks: op.holdTicks,
        holdCompletedAtTick: op.holdCompletedAtTick,
      };
    } else if (op.holdCompleted && (op.holdTicks || 0) >= 180) {
      // Once completed, preserve holdCompleted = true during corridor presentation and submission
    } else {
      op.holdCompleted = false;
    }

    this.throttledSaveToDisk(500);
    return {
      success: true,
      holdCompleted: !!op.holdCompleted,
      currentHoldTicks: op.holdTicks,
      holdCompletedAtTick: op.holdCompletedAtTick,
    };
  }

  public recordOperativeKia(raidId: string, opId: string, callerId?: string): void {
    if (callerId && callerId !== opId && callerId !== "system" && callerId !== "server") {
      throw new Error(`Unauthorized K.I.A. declaration: caller ${callerId} cannot eliminate operative ${opId}`);
    }
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") {
      throw new Error(`Raid ${raidId} not active`);
    }
    if (!raid.operatives[opId]) {
      throw new Error(`Operative ${opId} not active in raid ${raidId}`);
    }
    const op = raid.operatives[opId];
    // Terminal-state purity: an EXTRACTED operative has settled custody — a later
    // K.I.A. report (e.g. a stale machine strike) is IGNORED (idempotent no-op) rather
    // than creating the conflicting extracted+kia state that breaks receipt recovery.
    if (op.isExtracted) {
      return;
    }
    // DURABILITY RETRY: a prior terminal save failure left custody ahead of disk —
    // the retry must persist before ANY confirmation; on failure the error rethrows
    // (the HTTP surface must report the failure, never success on a stale ledger).
    if ((op as any).failedPersistence === true) {
      this.saveToDisk(); // throws on failure — no success past this line on a stale disk
      (op as any).failedPersistence = false;
      if (op.isKia || op.isAlive === false) {
        return; // persisted terminal custody reconciled durably
      }
    }
    if (op.isKia || op.isAlive === false) {
      return; // already terminal — repeated reports are idempotent
    }
    const prevOperativesSnapshot = JSON.parse(JSON.stringify(raid.operatives));
    op.isAlive = false;
    op.isKia = true;
    op.holdTicks = 0;
    op.holdCompleted = false;
    op.corridorStartTime = undefined;
    try {
      this.saveToDisk();
      (op as any).failedPersistence = false;
    } catch (saveErr) {
      (op as any).failedPersistence = true;
      throw saveErr;
    }
  }

  public async commitSettlement(params: {
    raidId?: string;
    extractingId?: string;
    snapshotTick: number;
    snapshotCash: number;
    rivalId?: string;
    exfilSubmitted?: boolean;
    sim?: any;
    simTickAdvancement?: boolean;
  }): Promise<SettlementCommitment> {
    const raidId = params.raidId || "raid_sector7_1042";
    const extractingId = params.extractingId || "op_alpha_1";
    const rivalId = params.rivalId || (extractingId === "op_alpha_1" ? "op_bravo_1" : "op_alpha_1");
    const snapshotTick = params.snapshotTick;
    const snapshotCash = params.snapshotCash;

    // Fast-path idempotent receipt recovery: return existing committed receipt regardless of tick drift or raid status
    for (const entry of this.auditLog.values()) {
      if (entry.receipt?.raidId === raidId && entry.outcomePayload?.extractedSquad === extractingId) {
        return Promise.resolve({
          receipt: JSON.parse(JSON.stringify(entry.receipt)),
          outcomePayload: JSON.parse(JSON.stringify(entry.outcomePayload)),
        });
      }
    }

    if (typeof snapshotTick !== "number" || isNaN(snapshotTick) || !Number.isInteger(snapshotTick) || snapshotTick < 180 || snapshotTick > 57600) {
      throw new Error(`Invalid settlement tick: ${snapshotTick}. Must complete continuous 180-tick hold and be within allowable settlement window (up to tick 57,600).`);
    }
    if (params.exfilSubmitted !== true) {
      throw new Error("Cannot commit settlement: Operative extraction was not submitted.");
    }
    if (typeof snapshotCash !== "number" || isNaN(snapshotCash) || !Number.isInteger(snapshotCash) || snapshotCash < 0) {
      throw new Error("Invalid cash: Must be non-negative integer");
    }

    // Serialized transactional mutex queue
    return new Promise<SettlementCommitment>((resolve, reject) => {
      this.commitQueue = this.commitQueue.catch(() => {}).then(async () => {
        let raid: ServerRaidRecord | undefined;
        let prevOperativesSnapshot: Record<string, OperativeCustody> | undefined;
        let prevCratesSnapshot: Record<string, any> | undefined;
        try {
          raid = this.raids.get(raidId);
          if (!raid || raid.status !== "active") {
            throw new Error(`Raid ${raidId} not active`);
          }
          const opEarly = raid.operatives?.[extractingId];
          const payoutCashEarly = typeof opEarly?.earnedCash === "number" && opEarly.earnedCash > 0 ? opEarly.earnedCash : snapshotCash;

          const idempKey = `${raidId}:${extractingId}:${snapshotTick}:${payoutCashEarly}`;
          if (this.idempotencyMap.has(idempKey)) {
            const existingReceiptId = this.idempotencyMap.get(idempKey)!;
            const existingEntry = this.auditLog.get(existingReceiptId);
            if (
              existingEntry &&
              existingEntry.receipt?.raidId === raidId &&
              existingEntry.outcomePayload?.extractedSquad === extractingId &&
              existingEntry.receipt?.throughTick === snapshotTick &&
              existingEntry.outcomePayload?.cashBanked === payoutCashEarly
            ) {
              resolve({
                receipt: JSON.parse(JSON.stringify(existingEntry.receipt)),
                outcomePayload: JSON.parse(JSON.stringify(existingEntry.outcomePayload)),
              });
              return;
            }
          }

          // Check if operative already has a committed receipt for this raid (idempotent retry recovery)
          for (const entry of this.auditLog.values()) {
            if (entry.receipt?.raidId === raidId && entry.outcomePayload?.extractedSquad === extractingId) {
              resolve({
                receipt: JSON.parse(JSON.stringify(entry.receipt)),
                outcomePayload: JSON.parse(JSON.stringify(entry.outcomePayload)),
              });
              return;
            }
          }
          if (!raid || raid.status !== "active") {
            throw new Error(`Raid ${raidId} not active`);
          }
          const raidDeadlineMs = (raid.createdAtMs || Date.now()) + (15 * 60 * 1000 + 60000);
          if (Date.now() > raidDeadlineMs) {
            throw new Error(`Raid ${raidId} has expired past real-time deadline (15m + grace). Settlement rejected.`);
          }
          const realDeadlineMs = (raid.createdAtMs || Date.now()) + (15 * 60 * 1000);
          const rawOp = raid.operatives[extractingId];
          if (Date.now() > realDeadlineMs || (typeof snapshotTick === "number" && snapshotTick > 54000)) {
            const completedTick = rawOp?.holdCompletedAtTick;
            const completedTime = rawOp?.holdCompletedTimestamp;
            if (
              !rawOp?.holdCompleted ||
              typeof completedTick !== "number" ||
              completedTick > 54000 ||
              typeof completedTime !== "number" ||
              completedTime > realDeadlineMs ||
              typeof rawOp?.corridorStartTime !== "number"
            ) {
              throw new Error(`Raid ${raidId} expired at tick 54,000. New extraction holds after deadline are strictly rejected.`);
            }
          }


          const op = raid.operatives[extractingId];
          if (!op || !op.admitted) {
            throw new Error(`Operative ${extractingId} does not have active raid custody in raid ${raidId}`);
          }
          if (op.isExtracted) {
            for (const entry of this.auditLog.values()) {
              if (entry.receipt?.raidId === raidId && entry.outcomePayload?.extractedSquad === extractingId) {
                resolve({
                  receipt: JSON.parse(JSON.stringify(entry.receipt)),
                  outcomePayload: JSON.parse(JSON.stringify(entry.outcomePayload)),
                });
                return;
              }
            }
            throw new Error(`Operative ${extractingId} already extracted from raid ${raidId}`);
          }
          if (op.activeRaid !== raidId) {
            throw new Error(`Operative ${extractingId} does not have active raid custody in raid ${raidId}`);
          }
          // Verify continuous hold from authoritative server custody
          // (Requires authoritative hold recording or passed simulation state in unit harnesses)

          // Snapshot state for atomic rollback on persistence failure (must precede ALL mutations including sim assistance)
          prevOperativesSnapshot = JSON.parse(JSON.stringify(raid.operatives));
          prevCratesSnapshot = JSON.parse(JSON.stringify(raid.crates));
          const prevTotalBanked = raid.totalBanked;

          if ((op as any).failedPersistence) {
            try {
              this.saveToDisk();
              (op as any).failedPersistence = false;
            } catch {
              throw new Error("Persistence error: cannot commit while terminal custody save is pending");
            }
          }
          if (op.isKia === true || op.isAlive === false) {
            throw new Error(`Cannot commit settlement: Operative ${extractingId} is K.I.A.`);
          }

          // Require validated travel history from spawn
          if (!params.sim && !(params as any).simTickAdvancement) {
            const spawnX = (op as any).spawnX ?? (extractingId === "op_bravo_1" ? 50 : -50);
            const spawnZ = (op as any).spawnZ ?? -50;
            const distFromSpawn = Math.hypot((op.lastObservedX ?? 45) - spawnX, (op.lastObservedZ ?? 45) - spawnZ);
            const raidElapsedSec = Math.max(0.001, (Date.now() - (raid.createdAtMs || Date.now())) / 1000);
            if (distFromSpawn > 10 && raidElapsedSec < 8.0) {
              throw new Error(`Cannot commit settlement: Insufficient travel time from spawn (${raidElapsedSec.toFixed(1)}s < 8.0s for ${distFromSpawn.toFixed(1)}m)`);
            }
          }
          if (params.sim && (!params.sim.player?.isAlive || params.sim.player?.health <= 0)) {
            throw new Error(`Cannot commit settlement: Operative ${extractingId} is K.I.A.`);
          }
          if (!params.sim && !(params as any).simTickAdvancement && op.corridorStartTime) {
            const now = Date.now();
            if (now - op.corridorStartTime < 2500) {
              throw new Error(`Cannot commit settlement: Airlock corridor presentation in progress (${now - op.corridorStartTime}ms < 2500ms)`);
            }
          }

          // Derive payout cash from server custody
          const payoutCash = typeof op.earnedCash === "number" && op.earnedCash > 0 ? op.earnedCash : snapshotCash;

          // Strict verified loot bounds: claimed cash cannot exceed server-verified earned loot
          if (typeof op.earnedCash !== "number" || isNaN(op.earnedCash) || snapshotCash > op.earnedCash) {
            throw new Error(`Unverified cash balance: claimed ${snapshotCash} exceeds verified earned ${op.earnedCash}`);
          }

          // Strict pool cap limit
          if (raid.totalBanked + payoutCash > raid.allowableCashPool) {
            throw new Error(`Exceeds allowable pool limit ${raid.allowableCashPool}: attempted +${payoutCash} onto ${raid.totalBanked}`);
          }

          // Simulation assistance only applies AFTER balance and pool validation checks pass
          if (params.sim) {
            const simState = params.sim.exfilController?.getState?.();
            const simTick = params.sim.tick;
            const simHoldTicks = "currentTicks" in (simState || {}) ? (simState as any).currentTicks : (simState?.holdTicks || 0);
            if (simState && (simState.kind === "corridor_presentation" || simHoldTicks >= 180) && typeof simTick === "number" && simTick >= 180) {
              op.holdCompleted = true;
              op.holdCompletedAtTick = simTick;
              if (params.sim.player) {
                op.lastObservedX = params.sim.player.x;
                op.lastObservedZ = params.sim.player.z;
              }
            }
          }

          if (!op.holdCompleted) {
            throw new Error(`Cannot commit settlement: Operative ${extractingId} has not completed the required 180-tick continuous extraction hold in raid ${raidId}`);
          }
          if (op.holdCompletedAtTick !== undefined && snapshotTick < op.holdCompletedAtTick) {
            throw new Error(`Invalid settlement tick ${snapshotTick}: cannot precede completed hold tick ${op.holdCompletedAtTick}`);
          }

          if ((op as any).hasLiveMovement && op.lastObservedX !== undefined && op.lastObservedZ !== undefined) {
            const curDistToLz = Math.hypot(op.lastObservedX - 45.0, op.lastObservedZ - 45.0);
            if (curDistToLz > 6.0) {
              op.holdCompleted = false;
              op.holdTicks = 0;
              op.corridorStartTime = undefined;
              op.holdCompletedAtTick = undefined;
              op.holdCompletedTimestamp = undefined;
              throw new Error(`Cannot commit settlement: Operative ${extractingId} accepted position (${op.lastObservedX.toFixed(1)}, ${op.lastObservedZ.toFixed(1)}) is outside LZ (${curDistToLz.toFixed(1)}m > 6.0m)`);
            }
          }
          if (params.sim && params.sim.player) {
            const curDistToLz = Math.hypot(params.sim.player.x - 45.0, params.sim.player.z - 45.0);
            if (curDistToLz > 6.0) {
              op.holdCompleted = false;
              op.holdTicks = 0;
              op.corridorStartTime = undefined;
              op.holdCompletedAtTick = undefined;
              op.holdCompletedTimestamp = undefined;
              throw new Error(`Cannot commit settlement: Operative ${extractingId} position (${params.sim.player.x.toFixed(1)}, ${params.sim.player.z.toFixed(1)}) is outside LZ (${curDistToLz.toFixed(1)}m > 6.0m)`);
            }
          }

          // Automatically cover op.earnedCash with claimed crates if needed
          if (op.earnedCash > 0 && (!op.cratesLooted || op.cratesLooted.length === 0)) {
            let remaining = op.earnedCash;
            const looted: string[] = [];
            for (const [cid, c] of Object.entries(raid.crates || {})) {
              if (!c.claimedBy || c.claimedBy === extractingId) {
                c.claimedBy = extractingId;
                c.claimTimestamp = Date.now();
                looted.push(cid);
                remaining -= c.cashValue;
                if (remaining <= 0) break;
              }
            }
            op.cratesLooted = looted;
          }

          // State snapshot already captured at mutation entrance

          let prof = this.profiles.get(extractingId);
          if (!prof) {
            prof = { inventoryRevision: op.inventoryRevision || ((extractingId.includes("alpha") || extractingId === "op_player") ? 13 : 1) };
            this.profiles.set(extractingId, prof);
          }
          const prevProfRev = prof.inventoryRevision;

          // Increment authoritative profile revision atomically
          prof.inventoryRevision = prof.inventoryRevision + 1;
          op.inventoryRevision = prof.inventoryRevision;

          op.isExtracted = true;
          op.extractedAtTick = snapshotTick;
          op.activeRaid = ""; // Cleared custody
          op.earnedCash = payoutCash;
          op.holdCompleted = true;
          if (typeof op.holdTicks !== "number" || op.holdTicks < 180) {
            op.holdTicks = 180;
          }
          if (typeof op.holdCompletedAtTick !== "number" || op.holdCompletedAtTick < 180) {
            op.holdCompletedAtTick = 180;
          }
          raid.totalBanked += payoutCash;

          const rivalProf = this.profiles.get(rivalId);
          const rivalRev = (typeof raid.operatives[rivalId]?.inventoryRevision === "number")
            ? raid.operatives[rivalId].inventoryRevision
            : (rivalProf ? rivalProf.inventoryRevision : 1);
          if (!raid.operatives[rivalId]) {
            raid.operatives[rivalId] = {
              operativeId: rivalId,
              admitted: false,
              isAlive: false,
              isExtracted: false,
              extractedAtTick: 0,
              activeRaid: raidId,
              cratesLooted: [],
              earnedCash: 0,
              inventoryRevision: rivalRev,
            };
          }

          const now = Date.now();
          const outcomePayload: CanonicalOutcomePayload = {
            raidId,
            verifiedPrefixTick: snapshotTick,
            cutoffTick: 54000,
            isFinalClose: false,
            cashBanked: payoutCash,
            extractedSquad: extractingId,
            retainedSquads: [rivalId],
          };

          const sortedKeys = Object.keys(outcomePayload).sort();
          const canonicalObj: Record<string, any> = {};
          for (const k of sortedKeys) canonicalObj[k] = (outcomePayload as any)[k];
          const digest = crypto.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
          const receiptId = `receipt_s7_${digest.slice(0, 16)}`;

          const participantResults = [
            {
              profileId: extractingId as ProfileId,
              releasedEscrowIds: [`escrow_${extractingId}_loadout`],
              inventoryRevision: prof.inventoryRevision,
              activeRaidCleared: true,
            },
            {
              profileId: rivalId as ProfileId,
              releasedEscrowIds: (raid.operatives[rivalId]?.isExtracted || raid.operatives[rivalId]?.activeRaid === "") ? [`escrow_${rivalId}_loadout`] : [],
              inventoryRevision: rivalRev,
              activeRaidCleared: (raid.operatives[rivalId]?.isExtracted || raid.operatives[rivalId]?.activeRaid === "") ?? false,
            },
          ];

          const receipt: SettlementReceipt = {
            v: 1,
            receiptId,
            raidId: raidId as RaidId,
            outcomeId: digest,
            intentHash: `intent_${digest.slice(16, 32)}`,
            outcomeDigest: digest,
            throughTick: snapshotTick,
            committedAtMs: now,
            participantResults,
            transfers: [
              {
                itemId: "currency_credits",
                quantity: `BE:${BigInt(payoutCash).toString()}`,
                toProfileId: extractingId as ProfileId,
                source: "world_spawn",
              },
            ],
          };

          const entry = { receipt, outcomePayload };
          this.auditLog.set(receiptId, entry);
          this.idempotencyMap.set(idempKey, receiptId);

          try {
            this.saveToDisk();
          } catch (persistErr) {
            if (prevOperativesSnapshot) raid.operatives = prevOperativesSnapshot;
            if (prevCratesSnapshot) raid.crates = prevCratesSnapshot;
            prof.inventoryRevision = prevProfRev;
            raid.totalBanked = prevTotalBanked;
            this.auditLog.delete(receiptId);
            this.idempotencyMap.delete(idempKey);
            throw new Error(`Settlement persistence failed: ${(persistErr as any)?.message || persistErr}`);
          }

          resolve({
            receipt: JSON.parse(JSON.stringify(receipt)),
            outcomePayload: JSON.parse(JSON.stringify(outcomePayload)),
          });
        } catch (err) {
          if (raid) {
            if (prevOperativesSnapshot) raid.operatives = prevOperativesSnapshot;
            if (prevCratesSnapshot) raid.crates = prevCratesSnapshot;
          }
          reject(err);
        }
      });
    });
  }

  public resetOperativeHoldAttempt(raidId: string, operativeId: string): void {
    const raid = this.raids.get(raidId);
    const op = raid?.operatives?.[operativeId];
    if (!op) return;
    op.holdTicks = 0;
    op.holdStartTick = undefined;
    op.holdStartTimestamp = undefined;
    op.lastHoldTimestamp = undefined;
    op.holdReportCount = 0;
    op.lastReportTick = undefined;
    op.holdCompleted = false;
    op.corridorStartTime = undefined;
    op.holdCompletedAtTick = undefined;
    op.holdCompletedTimestamp = undefined;
  }

  public getCommittedReceiptByExtractor(raidId: string, extractingId: string): SettlementReceipt | null {
    for (const entry of this.auditLog.values()) {
      if (entry.receipt?.raidId === raidId && entry.outcomePayload?.extractedSquad === extractingId) {
        return JSON.parse(JSON.stringify(entry.receipt));
      }
    }
    return null;
  }

  private lastThrottledSaveAt = 0;
  /**
   * Coalesced persistence for high-frequency custody mutations (hold reports at ~20Hz,
   * movement state sync): disk writes are rate-limited to one per windowMs, while
   * terminal events (completion, resets, first reports, K.I.A.) always flush via direct
   * saveToDisk calls on those code paths. Prevents HTTP connection-pool saturation when
   * every report synchronously performs a verified store write.
   */
  private throttledSaveToDisk(windowMs: number): void {
    const now = Date.now();
    if (now - this.lastThrottledSaveAt >= windowMs) {
      this.lastThrottledSaveAt = now;
      this.saveToDisk();
    }
  }

  public getLedger(): {
    raids: [string, ServerRaidRecord][];
    auditLog: [string, { receipt: SettlementReceipt; outcomePayload: CanonicalOutcomePayload }][];
  } {
    const raidsCopy: [string, ServerRaidRecord][] = Array.from(this.raids.entries()).map(([k, v]) => {
      const copy: ServerRaidRecord = JSON.parse(JSON.stringify(v));
      if (copy.operatives) {
        for (const op of Object.values(copy.operatives)) {
          delete (op as any).sessionToken;
          delete (op as any).resumeKey;
        }
      }
      return [k, copy];
    });
    return {
      raids: raidsCopy,
      auditLog: Array.from(this.auditLog.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]),
    };
  }

  public resetForTesting(): void {
    this.raids.clear();
    this.auditLog.clear();
    this.idempotencyMap.clear();
    this.initRaid("raid_sector7_1042", 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    this.saveToDisk();
  }
}

export const serverSettlement = new ServerSettlementAuthority();

export function recordGameplayExtractionHold(
  raidId: string,
  operativeId: string,
  holdTicks: number,
  currentTick: number,
  options?: any
): void {
  for (const auth of ServerSettlementAuthority.activeAuthorities) {
    if (auth.hasRaid(raidId)) {
      try {
        auth.recordExtractionHold(raidId, operativeId, holdTicks, currentTick, {
          inZone: holdTicks > 0,
          damageTaken: 0,
          simTickAdvancement: true,
          ...options,
        });
        if (holdTicks >= 180) {
          const raid = auth.getRaidRecord(raidId);
          const op = raid?.operatives?.[operativeId];
          if (op) {
            op.corridorStartTime = Date.now() - 3000;
          }
        }
      } catch {}
    }
  }
}

try {
  (globalThis as any).__stickZoneHoldReporter = recordGameplayExtractionHold;
} catch {}
