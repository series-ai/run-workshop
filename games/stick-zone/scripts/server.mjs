const FIELD_OBSTACLES = [
  // Spoke Perimeter Boundary Walls (Perimeter: |x| = 80, z: -50 to +80)
  { minX: -80.0, maxX: 80.0, minZ: 79.5, maxZ: 80.5 },
  { minX: -80.5, maxX: -79.5, minZ: -50.0, maxZ: 80.0 },
  { minX: 79.5, maxX: 80.5, minZ: -50.0, maxZ: 80.0 },
  { minX: -80.0, maxX: -4.0, minZ: -50.5, maxZ: -49.5 },
  { minX: 4.0, maxX: 80.0, minZ: -50.5, maxZ: -49.5 },

  // FOB Staging Outpost (z: -85 to -50)
  { minX: -8.0, maxX: 8.0, minZ: -73.6, maxZ: -72.4 },
  { minX: -8.5, maxX: -7.5, minZ: -73.0, maxZ: -52.0 },
  { minX: 7.5, maxX: 8.5, minZ: -73.0, maxZ: -52.0 },
  { minX: -4.5, maxX: -0.6, minZ: -63.2, maxZ: -61.8 },
  { minX: 0.6, maxX: 4.5, minZ: -63.2, maxZ: -61.8 },
  { minX: -5.4, maxX: -3.8, minZ: -71.8, maxZ: -70.2 },
  { minX: 3.8, maxX: 5.4, minZ: -71.8, maxZ: -70.2 },
  { minX: -4.5, maxX: -3.1, minZ: -67.8, maxZ: -66.2 },
  { minX: 3.1, maxX: 4.5, minZ: -67.8, maxZ: -66.2 },

  // Spatial Airlock Flanking Warp Beacons at z = -52
  { minX: -5.2, maxX: -3.8, minZ: -52.8, maxZ: -51.2 },
  { minX: 3.8, maxX: 5.2, minZ: -52.8, maxZ: -51.2 },

  // Emergency Bunker Exfil Bulkhead & Blast Doors at (-45, -45)
  { minX: -49.0, maxX: -41.0, minZ: -48.5, maxZ: -46.5 },
  { minX: -45.6, maxX: -44.4, minZ: -45.4, maxZ: -44.2 },

  // Placed Loot Containers in Sector 7 Depot
  { minX: -9.2, maxX: -6.8, minZ: -6.8, maxZ: -5.3 },
  { minX: 19.4, maxX: 20.6, minZ: -15.6, maxZ: -14.4 },
  { minX: -16.8, maxX: -15.2, minZ: 13.4, maxZ: 14.6 },
  { minX: 29.3, maxX: 30.7, minZ: 21.3, maxZ: 22.7 },
  { minX: -35.8, maxX: -34.2, minZ: -25.8, maxZ: -24.2 },

  // Exfil Zone Warp Beacons (45, 45)
  { minX: 39.0, maxX: 40.6, minZ: 44.2, maxZ: 45.8 },
  { minX: 49.4, maxX: 51.0, minZ: 44.2, maxZ: 45.8 },
];
/**
 * @file server.mjs
 * Production HTTP and WebSocket server for Stick Zone: Exfil.
 * Serves compiled dist/ assets, hosts authoritative /api/settlement/* REST endpoints,
 * and runs real-time WebSocket P2P relay on /syncplay-ws for cross-browser synchronization.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { ServerSettlementAuthority, isValidRaidId, isValidOperativeId, DEPOT_CRATE_LOCATIONS, isPositionInExfilZone } from "./server-settlement.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "../dist");
const PORT = parseInt(process.env.PORT || "5196", 10);



export function checkContainerCollision(x, z, radius = 0.45) {
  for (const box of DEPOT_CONTAINERS) {
    if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
      return true;
    }
  }
  for (const box of FIELD_OBSTACLES) {
    if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
      return true;
    }
  }
  return false;
}

const serverSettlement = new ServerSettlementAuthority();

const RESERVED_IDENTITIES = new Set(["system", "server", "admin", "root"]);

export const activeClaimedSessions = new Set();

function getAuthenticatedCaller(req, settlement) {
  let token = null;
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (req.headers["x-session-token"]) {
    token = String(req.headers["x-session-token"]).trim();
  } else if (req.headers["x-operative-token"]) {
    token = String(req.headers["x-operative-token"]).trim();
  }

  // Reject unauthenticated requests or empty tokens immediately
  if (!token) {
    return null;
  }

  // Operative session token verifies and derives operative ID and raidId
  if (settlement && typeof settlement.resolveOperativeByToken === "function") {
    const resolved = settlement.resolveOperativeByToken(token);
    if (resolved) {
      return { callerId: resolved.operativeId, raidId: resolved.raidId, isSystem: false };
    }
  }

  return null;
}


const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

const DEPOT_CONTAINERS = [
  { minX: -23.5, maxX: -16.5, minZ: -32.0, maxZ: -28.0 },
  { minX: -37.0, maxX: -33.0, minZ: -13.5, maxZ: -6.5 },
  { minX: 7.0, maxX: 13.0, minZ: -41.5, maxZ: -38.5 },
  { minX: 27.0, maxX: 33.0, minZ: -22.5, maxZ: -17.5 },
  { minX: -17.0, maxX: -13.0, minZ: 11.5, maxZ: 18.5 },
  { minX: 2.0, maxX: 8.0, minZ: 28.5, maxZ: 31.5 },
  { minX: -48.5, maxX: -41.5, minZ: 33.0, maxZ: 37.0 },
  // Central Corridor Flanking Industrial Stacks
  { minX: -8.3, maxX: -3.3, minZ: -28.5, maxZ: -21.5 },
  { minX: 3.3, maxX: 8.3, minZ: -28.5, maxZ: -21.5 },
  { minX: -12.0, maxX: -7.0, minZ: 1.5, maxZ: 8.5 },
  { minX: 7.0, maxX: 12.0, minZ: 1.5, maxZ: 8.5 },
  { minX: -12.0, maxX: -7.0, minZ: 31.5, maxZ: 38.5 },
  { minX: 7.0, maxX: 12.0, minZ: 31.5, maxZ: 38.5 },
  // Perimeter Flanking Heavy Stacks
  { minX: -63.5, maxX: -56.5, minZ: -27.5, maxZ: -22.5 },
  { minX: -63.5, maxX: -56.5, minZ: 2.5, maxZ: 7.5 },
  { minX: -63.5, maxX: -56.5, minZ: 32.5, maxZ: 37.5 },
  { minX: 56.5, maxX: 63.5, minZ: -27.5, maxZ: -22.5 },
  { minX: 56.5, maxX: 63.5, minZ: 2.5, maxZ: 7.5 },
  { minX: 56.5, maxX: 63.5, minZ: 32.5, maxZ: 37.5 },
];

function segmentIntersectsAABB3D(x1, y1, z1, x2, y2, z2, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0.0;
  let tmax = 1.0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;

  if (Math.abs(dx) < 1e-7) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    let t1 = (minX - x1) / dx;
    let t2 = (maxX - x1) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dy) < 1e-7) {
    if (y1 < minY || y1 > maxY) return false;
  } else {
    let t1 = (minY - y1) / dy;
    let t2 = (maxY - y1) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-7) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    let t1 = (minZ - z1) / dz;
    let t2 = (maxZ - z1) / dz;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return tmin <= 1.0 && tmax >= 0.0;
}

function checkContainerRayObstruction(x1, z1, x2, z2, y1 = 1.0, y2 = 1.0) {
  for (const box of DEPOT_CONTAINERS) {
    if (segmentIntersectsAABB3D(x1, y1, z1, x2, y2, z2, box.minX, 0, box.minZ, box.maxX, 5.2, box.maxZ)) {
      return true;
    }
  }
  return false;
}

export function checkContainerPathCollision(x1, z1, x2, z2, radius = 0.45) {
  const EPS = 0.001;
  for (const box of DEPOT_CONTAINERS) {
    if (segmentIntersectsAABB3D(
      x1, 1.0, z1,
      x2, 1.0, z2,
      box.minX - radius + EPS, 0, box.minZ - radius + EPS,
      box.maxX + radius - EPS, 5.2, box.maxZ + radius - EPS
    )) {
      return true;
    }
  }
  return false;
}

export function checkLegalMovementPath(x1, z1, x2, z2, radius = 0.45) {
  if (checkContainerCollision(x2, z2, radius)) {
    return false;
  }
  if (!checkContainerPathCollision(x1, z1, x2, z2, radius)) {
    return true;
  }
  if (!checkContainerCollision(x2, z1, radius) &&
      !checkContainerPathCollision(x1, z1, x2, z1, radius) &&
      !checkContainerPathCollision(x2, z1, x2, z2, radius)) {
    return true;
  }
  if (!checkContainerCollision(x1, z2, radius) &&
      !checkContainerPathCollision(x1, z1, x1, z2, radius) &&
      !checkContainerPathCollision(x1, z2, x2, z2, radius)) {
    return true;
  }
  return false;
}

const raidOperativeSeenEvents = new Map();
const raidOperativeAttackTimes = new Map();
function getRaidOperativeAttackTimes(raidId, opId) {
  const opKey = `${raidId}:${opId}`;
  let times = raidOperativeAttackTimes.get(opKey);
  if (!times) {
    times = { kick: 0, rifle: 0 };
    raidOperativeAttackTimes.set(opKey, times);
  }
  return times;
}

const raidOperativeWeaponStates = new Map();
export function getRaidOperativeWeaponState(raidId, opId, settlement = null) {
  const opKey = `${raidId}:${opId}`;
  let wsState = raidOperativeWeaponStates.get(opKey);
  if (!wsState) {
    const s = settlement || serverSettlement;
    const rRec = s && s.getRaidRecord ? s.getRaidRecord(raidId) : null;
    const oRec = rRec?.operatives?.[opId];
    const initialWeapon = oRec?.selectedWeapon === "shotgun" || oRec?.selectedWeapon === "rifle" ? oRec.selectedWeapon : "rifle";
    const initialRifle = typeof oRec?.rifleAmmo === "number" ? oRec.rifleAmmo : 30;
    const initialShotgun = typeof oRec?.shotgunAmmo === "number" ? oRec.shotgunAmmo : 8;
    const initialAmmo = typeof oRec?.ammo === "number" ? oRec.ammo : (initialWeapon === "shotgun" ? initialShotgun : initialRifle);
    wsState = {
      selectedWeapon: initialWeapon,
      rifleAmmo: initialRifle,
      shotgunAmmo: initialShotgun,
      ammo: initialAmmo,
      maxAmmo: initialWeapon === "shotgun" ? 8 : 30,
      isReloading: false,
      reloadEnd: 0,
      reloadingWeapon: null,
    };
    raidOperativeWeaponStates.set(opKey, wsState);
  }
  return wsState;
}
export function findCommittedReceiptForOperative(settlement, raidId, operativeId) {
  if (!settlement || !settlement.auditLog) return null;
  const entries = typeof settlement.auditLog.values === "function"
    ? Array.from(settlement.auditLog.values())
    : Object.values(settlement.auditLog);
  for (const entry of entries) {
    if (!entry) continue;
    const r = entry.receipt || (entry.receiptId ? entry : null);
    if (!r) continue;
    if (r.raidId === raidId) {
      const op = entry.outcomePayload || settlement.auditPayloads?.get(r.receiptId);
      if (op && op.extractedSquad === operativeId) {
        return { receipt: r, outcomePayload: op };
      }
      if (r.transfers?.[0]?.toProfileId === operativeId) {
        return {
          receipt: r,
          outcomePayload: op || {
            raidId: r.raidId,
            verifiedPrefixTick: r.throughTick,
            cutoffTick: 54000,
            isFinalClose: false,
            cashBanked: r.transfers[0]?.quantity ? Number(String(r.transfers[0].quantity).replace(/^BE:/, '')) : 0,
            extractedSquad: operativeId,
            retainedSquads: r.participantResults?.map((p) => p.profileId).filter((id) => id !== operativeId) || [],
          },
        };
      }
      const participant = r.participantResults?.find((p) => p.profileId === operativeId);
      if (participant && participant.activeRaidCleared === true) {
        return {
          receipt: r,
          outcomePayload: op || {
            raidId: r.raidId,
            verifiedPrefixTick: r.throughTick,
            cutoffTick: 54000,
            isFinalClose: false,
            cashBanked: 0,
            extractedSquad: operativeId,
            retainedSquads: r.participantResults?.map((p) => p.profileId).filter((id) => id !== operativeId) || [],
          },
        };
      }
    }
  }
  return null;
}

function applyAuthoritativeCrateGrantToRelay(settlement, raidId, claimantId, prevClaimant) {
  const raidRec = settlement && settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
  const claimantCustody = raidRec?.operatives?.[claimantId];

  const wsState = getRaidOperativeWeaponState(raidId, claimantId, settlement);
  if (claimantCustody && (claimantCustody.selectedWeapon === "shotgun" || claimantCustody.selectedWeapon === "rifle")) {
    wsState.selectedWeapon = claimantCustody.selectedWeapon;
  }
  wsState.rifleAmmo = typeof claimantCustody?.rifleAmmo === "number" ? claimantCustody.rifleAmmo : 30;
  wsState.shotgunAmmo = typeof claimantCustody?.shotgunAmmo === "number" ? claimantCustody.shotgunAmmo : 8;
  wsState.ammo = wsState.selectedWeapon === "shotgun" ? wsState.shotgunAmmo : wsState.rifleAmmo;
  wsState.maxAmmo = wsState.selectedWeapon === "shotgun" ? 8 : 30;
  wsState.isReloading = false;
  wsState.reloadingWeapon = null;
  setAuthoritativeOperativeAmmo(settlement, raidId, claimantId, wsState.ammo);

  if (prevClaimant && prevClaimant !== claimantId) {
    const prevCustody = raidRec?.operatives?.[prevClaimant];
    if (prevCustody) {
      const prevWsState = getRaidOperativeWeaponState(raidId, prevClaimant, settlement);
      if (prevCustody.selectedWeapon === "shotgun" || prevCustody.selectedWeapon === "rifle") {
        prevWsState.selectedWeapon = prevCustody.selectedWeapon;
      }
      if (typeof prevCustody.rifleAmmo === "number") prevWsState.rifleAmmo = prevCustody.rifleAmmo;
      if (typeof prevCustody.shotgunAmmo === "number") prevWsState.shotgunAmmo = prevCustody.shotgunAmmo;
      prevWsState.ammo = prevWsState.selectedWeapon === "shotgun" ? prevWsState.shotgunAmmo : prevWsState.rifleAmmo;
      prevWsState.maxAmmo = prevWsState.selectedWeapon === "shotgun" ? 8 : 30;
      setAuthoritativeOperativeAmmo(settlement, raidId, prevClaimant, prevWsState.ammo);
    }
  }
}

const activeShotgunShots = new Map(); // `${raidId}:${opId}:${shotId}` -> { createdAt, originX, originZ, facing, targetsHit: Set<string> }
function cleanExpiredShotgunShots() {
  if (activeShotgunShots.size > 500) {
    const cutoff = Date.now() - 5000;
    for (const [k, s] of activeShotgunShots.entries()) {
      if (s.createdAt < cutoff) activeShotgunShots.delete(k);
    }
  }
}

function setAuthoritativeOperativeAmmo(settlement, raidId, opId, newAmmo, clearReload = false) {
  const wsState = getRaidOperativeWeaponState(raidId, opId, settlement);
  const prevAmmo = wsState.ammo;
  const prevReloading = wsState.isReloading;
  wsState.ammo = Math.max(0, Math.min(30, Math.floor(newAmmo)));
  if (clearReload) {
    wsState.isReloading = false;
  }
  if (typeof settlement?.recordOperativeAmmo === "function") {
    try {
      settlement.recordOperativeAmmo(
        raidId,
        opId,
        wsState.ammo,
        wsState.rifleAmmo,
        wsState.shotgunAmmo,
        wsState.selectedWeapon
      );
    } catch (err) {
      wsState.ammo = prevAmmo;
      wsState.isReloading = prevReloading;
      throw err;
    }
  }
  return wsState.ammo;
}

// Shared authentication initializer: EVERY WebSocket authentication path (query-token
// and in-band token packets) must restore the authoritative weapon state from settlement
// custody, so a direct token reconnect after a server restart resumes the operator's
// persisted ammunition instead of disagreeing with a cold 30-round default map entry.
function restoreWeaponStateFromCustody(settlement, raidId, opId) {
  try {
    if (typeof settlement?.getRaidRecord !== "function") return;
    const rRec = settlement.getRaidRecord(raidId);
    const oRec = rRec?.operatives?.[opId];
    if (!oRec) return;
    const wsState = getRaidOperativeWeaponState(raidId, opId, settlement);
    if (oRec.selectedWeapon === "rifle" || oRec.selectedWeapon === "shotgun") {
      wsState.selectedWeapon = oRec.selectedWeapon;
    }
    if (typeof oRec.rifleAmmo === "number" && Number.isFinite(oRec.rifleAmmo)) {
      wsState.rifleAmmo = Math.max(0, Math.min(30, Math.floor(oRec.rifleAmmo)));
    }
    if (typeof oRec.shotgunAmmo === "number" && Number.isFinite(oRec.shotgunAmmo)) {
      wsState.shotgunAmmo = Math.max(0, Math.min(8, Math.floor(oRec.shotgunAmmo)));
    }
    const custodyAmmo = oRec.ammo;
    if (typeof custodyAmmo === "number" && Number.isFinite(custodyAmmo) && custodyAmmo >= 0 && custodyAmmo <= 30) {
      if (!wsState.isReloading) {
        wsState.ammo = Math.floor(custodyAmmo);
      }
    } else {
      wsState.ammo = wsState.selectedWeapon === "shotgun" ? wsState.shotgunAmmo : wsState.rifleAmmo;
    }
    if (wsState.isReloading && wsState.reloadEnd <= Date.now()) {
      wsState.isReloading = false;
    }
  } catch {}
}

export function resetServerModuleState() {
  raidOperativeSeenEvents.clear();
  raidOperativeAttackTimes.clear();
  raidOperativeWeaponStates.clear();
  activeShotgunShots.clear();
}

export function createStickZoneServer(customSettlement, existingHttpServer) {
  const settlement = customSettlement || serverSettlement;
  const raidMachines = new Map();
  function getRaidMachines(raidId) {
    const rRecord = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
    if (!raidMachines.has(raidId)) {
      if (rRecord && machineDeploymentValid(rRecord.machineDeployment)) {
      seedVitalsSeqFromDeployment(raidId, rRecord.machineDeployment);
        // Full deployment persistence: restarts rebuild the COMPLETE machine set (placed
        // AND removed machines) from custody — the machine array is truth, the map of
        // health snapshots mirrors it.
        const machines = rRecord.machineDeployment.map((m) => ({
          ...m,
          maxHealth: typeof m.maxHealth === "number" && m.maxHealth > 0 ? m.maxHealth : Math.max(m.health, m.type === "turret" ? 120 : 75),
          vitalsSeq: Math.max(machineVitalsSeq.get(`${raidId}:${m.id}`) || 0, typeof m.vitalsSeq === "number" ? m.vitalsSeq : 0),
          health: (rRecord.machines && rRecord.machines[m.id] && typeof rRecord.machines[m.id].health === "number")
            ? rRecord.machines[m.id].health
            : m.health,
          isAlive: (rRecord.machines && rRecord.machines[m.id])
            ? !!(rRecord.machines[m.id].isAlive && (rRecord.machines[m.id].health ?? m.health) > 0)
            : m.isAlive,
        }));
        raidMachines.set(raidId, machines);
        return machines;
      }
      const defaultMachines = [
        { id: "turret_depot_alpha", type: "turret", x: -5, y: 0, z: 12, facing: Math.PI, health: 120, isAlive: true, cooldownTicks: 0, maxHealth: 120, vitalsSeq: nextVitalsSeq("turret_depot_alpha", raidId) },
        { id: "drone_patrol_beta", type: "drone", x: 14, y: 2.2, z: -8, facing: -Math.PI / 2, health: 75, isAlive: true, cooldownTicks: 0, maxHealth: 75, vitalsSeq: nextVitalsSeq("drone_patrol_beta", raidId) },
      ];
      if (rRecord && rRecord.machines) {
        for (const m of defaultMachines) {
          const persisted = rRecord.machines[m.id];
          if (persisted) {
            m.health = persisted.health;
            m.isAlive = persisted.isAlive;
            // Combat sequences survive via the health map floor: restore continues at
            // or above everything clients applied (never resets to 1).
            if (typeof persisted.vitalsSeq === "number" && Number.isFinite(persisted.vitalsSeq)) {
              m.vitalsSeq = Math.max(m.vitalsSeq || 0, persisted.vitalsSeq);
              const cur = machineVitalsSeq.get(`${raidId}:${m.id}`) || 0;
              if (m.vitalsSeq > cur) machineVitalsSeq.set(`${raidId}:${m.id}`, m.vitalsSeq);
            }
          }
        }
      }
      raidMachines.set(raidId, defaultMachines);
    }
    const list = raidMachines.get(raidId);
    if (rRecord && !rRecord.machines) {
      rRecord.machines = {};
      for (const m of list) {
        rRecord.machines[m.id] = { health: m.health, isAlive: m.isAlive };
      }
    }
    return list;
  }

  // Deterministic machine position authority: turrets are static custody state;
  // drones follow the shared deterministic patrol equation (origin with sine/cosine of
  // raidTick * 0.012) — the server computes positions itself instead of trusting
  // client-claimed target positions during hit geometry validation.
  const DRONE_PATROL = { speed: 0.012, ampX: 5.0, ampZ: 3.5 };
  // Monotonic roster revision per raid: bumped on every committed deployment change;
  // receivers reject rosters older than the last applied revision (no stale regression).
  const raidRosterRevisions = new Map();
  const machineVitalsSeq = new Map(); // `${raidId}:${machineId}` -> seq counter
  // Authoritative vitals sequence: STAMPED on every custody mutation of a machine
  // (deploy, strike, cold-restore build). Receivers treat it as ordered INDEPENDENT of
  // the roster membership revision — fresh vitals at unchanged membership apply; older
  // vitals are rejected regardless of revision equality.
  // Sequence counters are RAID-SCOPED (raid:machine) — machines with equal IDs in
  // different raids cannot contaminate each other's sequences.
  const __seqKey = (raidId, machineId) => `${raidId}:${machineId}`;
  function nextVitalsSeq(machineId, raidId) {
    const r = raidId || globalThis.__stickZoneActiveRaidForSeq || null;
    if (!r) return 1; // no raid context: static floor (never contaminates another raid)
    const k = __seqKey(r, machineId);
    const v = (machineVitalsSeq.get(k) || 0) + 1;
    machineVitalsSeq.set(k, v);
    return v;
  }
  // Restore counters from persisted custody: the deployment record's vitalsSeq is the
  // surviving sequence floor — a restarted server CONTINUES above what clients already
  // applied (never restarts at 1, which would be rejected as stale by live clients).
  function seedVitalsSeqFromDeployment(raidId, deployment) {
    if (!Array.isArray(deployment)) return;
    for (const m of deployment) {
      if (m && typeof m.vitalsSeq === "number" && Number.isFinite(m.vitalsSeq)) {
        const k = __seqKey(raidId, m.id);
        const cur = machineVitalsSeq.get(k) || 0;
        if (m.vitalsSeq > cur) machineVitalsSeq.set(k, m.vitalsSeq);
      }
    }
    // The combat health map carries the LATEST durable per-machine sequences (strikes
    // persist health/isAlive/vitalsSeq in one transaction) — seed from it too so cold
    // restore continues above everything clients ever applied, never regressing.
    const rrForSeed = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
    if (rrForSeed && rrForSeed.machines) {
      for (const [mid, rec] of Object.entries(rrForSeed.machines)) {
        if (rec && typeof rec.vitalsSeq === "number" && Number.isFinite(rec.vitalsSeq)) {
          const k = __seqKey(raidId, mid);
          const cur = machineVitalsSeq.get(k) || 0;
          if (rec.vitalsSeq > cur) machineVitalsSeq.set(k, rec.vitalsSeq);
        }
      }
    }
  }
  function raidRevision(raidId) {
    // Persisted monotonic revision: the surviving source of truth is the ACTIVE RAID
    // CUSTODY record (rRec.machineRosterRevision), so a server restart never rewinds
    // revisions (the receiver keeps its last applied value; stale rosters stay stale).
    const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
    const cur = Math.max((rRec && typeof rRec.machineRosterRevision === "number") ? rRec.machineRosterRevision : 0, raidRosterRevisions.get(raidId) || 0) + 1;
    raidRosterRevisions.set(raidId, cur);
    if (rRec) rRec.machineRosterRevision = cur; // persisted by the deploy transaction's save
    return cur;
  }
  const DRONE_ORIGINS = { drone_patrol_beta: { x: 14, z: -8 } };
  // Deployment-record validation: entries must be dense objects with unique string
  // ids, valid type, bounded geometry, coherent vitals. A corrupt deployment record
  // (e.g. a null entry) is REJECTED (getRaidMachines falls back to health-map rebuild)
  // instead of crashing cold restore at m.id.
  function machineDeploymentValid(deployment) {
    if (!Array.isArray(deployment) || deployment.length > 64) return false;
    const ids = new Set();
    for (const m of deployment) {
      if (!m || typeof m !== "object" || Array.isArray(m)) return false;
      if (typeof m.id !== "string" || !m.id || m.id.length > 64) return false;
      if (ids.has(m.id)) return false;
      ids.add(m.id);
      if (m.type !== "turret" && m.type !== "drone") return false;
      if (typeof m.x !== "number" || !Number.isFinite(m.x) || Math.abs(m.x) > 80) return false;
      if (typeof m.z !== "number" || !Number.isFinite(m.z) || Math.abs(m.z) > 80) return false;
      if (typeof m.health !== "number" || !Number.isFinite(m.health) || m.health < 0 || m.health > 1000) return false;
      if (typeof m.isAlive !== "boolean") return false;
    }
    return true;
  }
  function computeMachineServerPosition(m, raidTick) {
    if (!m || m.type !== "drone") return { x: m.x, z: m.z };
    const originX = typeof m.originX === "number" && Number.isFinite(m.originX) ? m.originX : (DRONE_ORIGINS[m.id] ? DRONE_ORIGINS[m.id].x : m.x);
    const originZ = typeof m.originZ === "number" && Number.isFinite(m.originZ) ? m.originZ : (DRONE_ORIGINS[m.id] ? DRONE_ORIGINS[m.id].z : m.z);
    return {
      x: originX + Math.sin(raidTick * DRONE_PATROL.speed) * DRONE_PATROL.ampX,
      z: originZ + Math.cos(raidTick * DRONE_PATROL.speed) * DRONE_PATROL.ampZ,
    };
  }
  // Bounded latency compensation: a client-claimed drone position is accepted only if
  // it matches the deterministic patrol equation for SOME tick within +/- 30 ticks of
  // the server raid tick (instead of any position inside the patrol ellipse).
  function claimMatchesDeterministicDronePosition(m, serverTick, claimedX, claimedZ) {
    for (let t = serverTick - 30; t <= serverTick + 30; t++) {
      const p = computeMachineServerPosition(m, t);
      if (Math.hypot(p.x - claimedX, p.z - claimedZ) <= 0.5) return true;
    }
    return false;
  }

  function readJsonBody(req, res, callback, maxBytes = 65536) {
    let chunks = [];
    let byteLen = 0;
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      byteLen += len;
      if (byteLen > maxBytes) {
        exceeded = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload Too Large: exceeded 64KB limit" }));
        try { req.resume(); } catch {}
        return;
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        const full = Buffer.concat(chunks).toString("utf8");
        const data = full.trim() ? JSON.parse(full) : {};
        callback(null, data);
      } catch (err) {
        callback(err, null);
      }
    });
    req.on("error", (err) => {
      if (!exceeded) callback(err, null);
    });
  }

  const requestHandler = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // REST Settlement Endpoints
  if (url.pathname === "/api/settlement/active-raid" && req.method === "GET") {
    const requestedRaidId = url.searchParams.get("raidId") || settlement.getActiveRaidId();
    const activeRaidId = requestedRaidId;
    const __arRec = settlement.getRaidRecord ? settlement.getRaidRecord(activeRaidId) : null;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      activeRaidId,
      raidTick: settlement.getCurrentRaidTick(activeRaidId),
      raidStartTime: settlement.getRaidStartTime(activeRaidId),
      machineRosterRevision: (__arRec && typeof __arRec.machineRosterRevision === "number") ? __arRec.machineRosterRevision : raidRosterRevisions.get(activeRaidId) || 0,
      crates: settlement.getRaidCrates(activeRaidId),
      machines: getRaidMachines(activeRaidId),
    }));
    return;
  }

  if ((url.pathname === "/api/settlement/active-raid" || url.pathname === "/api/settlement/redeploy") && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const nextRaidId = data.raidId || ("raid_sector7_" + Date.now());
        const opId = data.operativeId || "op_player";
        if (!isValidRaidId(nextRaidId) || !isValidOperativeId(opId)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid raid or operative ID" }));
          return;
        }

        // Authentication & Session Ownership Verification
        const authCaller = getAuthenticatedCaller(req, settlement);
        const rawBodyCaller = data.token ? settlement.resolveOperativeByToken(data.token) : null;
        const caller = authCaller || (rawBodyCaller ? { callerId: rawBodyCaller.operativeId || rawBodyCaller.callerId, raidId: rawBodyCaller.raidId, isSystem: false } : null);
        if (!caller) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Operative credentials required for redeployment" }));
          return;
        }
        if (caller.callerId !== opId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Forbidden: Operative credentials do not match requested operative" }));
          return;
        }

        const slotKey = `${nextRaidId}:${opId}`;
        const hasActiveSocket = activeSlotSockets.has(slotKey) && activeSlotSockets.get(slotKey)?.readyState === 1;

        // Repeat-safe raid creation / joining:
        if (settlement.hasRaid(nextRaidId)) {
          const targetRaid = settlement.getRaidRecord(nextRaidId);
          if (targetRaid && targetRaid.status === "concluded") {
            res.statusCode = 409;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Cannot redeploy into concluded raid" }));
            return;
          }
          const targetOp = targetRaid?.operatives?.[opId];
          if (targetOp && (targetOp.isExtracted || targetOp.isKia || targetOp.isAlive === false)) {
            res.statusCode = 409;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Cannot redeploy into terminal operative" }));
            return;
          }
          if (hasActiveSocket) {
            res.statusCode = 409;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Operative slot already claimed by an active session in target raid" }));
            return;
          }
          const isTargetSlotOwned = settlement.isSlotClaimed ? settlement.isSlotClaimed(nextRaidId, opId) : Boolean(settlement.getSessionToken(nextRaidId, opId));
          if (isTargetSlotOwned) {
            const targetToken = settlement.getSessionToken(nextRaidId, opId);
            const canAccess = (caller.raidId === nextRaidId && caller.callerId === opId) || (data.token && data.token === targetToken);
            if (!canAccess) {
              res.statusCode = 409;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Target operative slot already claimed by another session in target raid" }));
              return;
            }
          }
        } else {
          if (typeof settlement.initRaid === "function") {
            settlement.initRaid(nextRaidId, 50000, [opId, "op_alpha_1", "op_bravo_1"], opId);
          }
        }

        let token = settlement.getSessionToken(nextRaidId, opId);
        if (!token && typeof settlement.allocateSessionToken === "function") {
          token = settlement.allocateSessionToken(nextRaidId, opId);
        }

        if (typeof settlement.claimSession === "function") {
          settlement.claimSession(nextRaidId, opId, token);
        } else if (typeof settlement.claimSlot === "function") {
          settlement.claimSlot(nextRaidId, opId);
        }

        const targetRec = settlement.getRaidRecord ? settlement.getRaidRecord(nextRaidId) : null;
        const finalOp = targetRec?.operatives?.[opId];
        const resumeKey = finalOp?.resumeKey || `sz_resume_${nextRaidId}_${opId}`;
        if (finalOp && !finalOp.resumeKey) {
          finalOp.resumeKey = resumeKey;
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          success: true,
          raidId: nextRaidId,
          operativeId: opId,
          token,
          resumeKey,
        }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: (err && err.message) || String(err) }));
      }
    });
    return;
  }

  if (url.pathname === "/api/settlement/join" && req.method === "POST") {
    let body = "";
    let byteLen = 0;
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      byteLen += len;
      if (byteLen > 65536) {
        exceeded = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload Too Large: exceeded 64KB limit" }));
        try { req.resume(); } catch {}
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        const data = JSON.parse(body || "{}");
        const raidId = data.raidId || settlement.getActiveRaidId();
        const opId = data.operativeId || data.playerId;
        if (!isValidRaidId(raidId)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid raid ID" }));
          return;
        }
        if (!isValidOperativeId(opId)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Cannot issue token for reserved or invalid operative ID" }));
          return;
        }
        const caller = getAuthenticatedCaller(req, settlement);
        const slotKey = `${raidId}:${opId}`;
        const hasActiveSocket = activeSlotSockets.has(slotKey) && activeSlotSockets.get(slotKey)?.readyState === 1;

        const resumeKey = req.headers["x-resumption-key"] || data.resumeKey;
        const targetRaid = typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(raidId) : null;
        const targetOp = targetRaid?.operatives?.[opId];
        const isResumeValid = Boolean(resumeKey && targetOp?.resumeKey && targetOp.resumeKey === resumeKey);

        // If authenticated caller or valid resumption key is resuming an ongoing session, allow even if ingress is closed!
        if ((caller && caller.callerId === opId && caller.raidId === raidId) || isResumeValid) {
          if (targetRaid && (targetRaid.status === "concluded" || targetOp?.isExtracted || targetOp?.isKia || targetOp?.isAlive === false)) {
            if (targetOp?.failedPersistence === true) {
              try {
                if (typeof settlement.saveToDisk === "function") {
                  settlement.saveToDisk();
                  targetOp.failedPersistence = false;
                }
              } catch (saveErr) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Failed to persist terminal state to disk" }));
                return;
              }
            }
            let receipt = null;
            if (targetOp?.isExtracted && typeof settlement.getCommittedReceiptByExtractor === "function") {
              receipt = settlement.getCommittedReceiptByExtractor(raidId, opId);
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              success: true,
              isTerminal: true,
              isExtracted: !!targetOp?.isExtracted,
              isKia: !!(targetOp?.isKia || targetOp?.isAlive === false),
              extractedAtTick: targetOp?.extractedAtTick || 0,
              receipt,
              raidId,
              operativeId: opId,
              token: settlement.getSessionToken(raidId, opId) || null,
            }));
            return;
          }
          let token = settlement.getSessionToken(raidId, opId);
          if (!token && typeof settlement.allocateSessionToken === "function") {
            token = settlement.allocateSessionToken(raidId, opId);
          }
          settlement.claimSlot(raidId, opId);
          const opAmmo = settlement.getOperativeAmmo ? settlement.getOperativeAmmo(raidId, opId) : (getRaidOperativeWeaponState(raidId, opId).ammo ?? 30);
          getRaidOperativeWeaponState(raidId, opId).ammo = opAmmo;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            success: true,
            token,
            resumeKey: targetOp?.resumeKey,
            operativeId: opId,
            raidId,
            resumed: true,
            ammo: opAmmo,
            holdCompleted: !!targetOp?.holdCompleted,
            holdCompletedAtTick: targetOp?.holdCompletedAtTick || 0,
            isExtracted: !!targetOp?.isExtracted,
            extractedAtTick: targetOp?.extractedAtTick || 0,
          }));
          return;
        }

        if (raidId !== settlement.getActiveRaidId()) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Target raid is not the active raid" }));
          return;
        }

        // New / unauthenticated join checks:
        if (settlement.isIngressClosed(raidId)) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Raid ingress window has closed (exceeded 8-minute limit)" }));
          return;
        }

        if (settlement.isSlotClaimed(raidId, opId) || hasActiveSocket || (typeof settlement.isOperativeOwned === "function" && settlement.isOperativeOwned(raidId, opId))) {
          res.statusCode = 409;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Operative slot already claimed by an active session" }));
          return;
        }

        let token = settlement.getSessionToken(raidId, opId);
        if (!token && typeof settlement.allocateSessionToken === "function") {
          token = settlement.allocateSessionToken(raidId, opId);
        }
        if (!token) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Operative ${opId} not found in raid ${raidId}` }));
          return;
        }

        settlement.claimSlot(raidId, opId);
        const rRec = typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(raidId) : null;
        const rKey = rRec?.operatives?.[opId]?.resumeKey;
        const opAmmo = settlement.getOperativeAmmo ? settlement.getOperativeAmmo(raidId, opId) : (getRaidOperativeWeaponState(raidId, opId).ammo ?? 30);
        getRaidOperativeWeaponState(raidId, opId).ammo = opAmmo;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, token, resumeKey: rKey, operativeId: opId, raidId, ammo: opAmmo }));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: (err && err.message) || String(err) }));
      }
    });
    return;
  }


  if (url.pathname === "/api/settlement/verify-receipt") {
    let receiptId = url.searchParams.get("receiptId");
    const checkVerify = () => {
      const record = settlement.getCommittedReceipt ? settlement.getCommittedReceipt(receiptId) : settlement.auditLog?.get(receiptId);
      if (!record) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ valid: false, error: "Receipt not found in authoritative settlement log" }));
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ valid: true, receipt: record.receipt, outcomePayload: record.outcomePayload }));
    };

    if (req.method === "POST") {
      let body = "";
    let byteLen = 0;
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      byteLen += len;
      if (byteLen > 65536) {
        exceeded = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload Too Large: exceeded 64KB limit" }));
        try { req.resume(); } catch {}
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (exceeded) return;
        try {
          const data = JSON.parse(body || "{}");
          if (!receiptId) receiptId = data.receiptId;
          if (!receiptId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing receiptId parameter" }));
            return;
          }
          checkVerify();
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Malformed request" }));
        }
      });
      return;
    }

    if (!receiptId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Missing receiptId parameter" }));
      return;
    }
    checkVerify();
    return;
  }
  if (url.pathname === "/api/settlement/hold" && req.method === "POST") {
    let body = "";
    let byteLen = 0;
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      byteLen += len;
      if (byteLen > 65536) {
        exceeded = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload Too Large: exceeded 64KB limit" }));
        try { req.resume(); } catch {}
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        const caller = getAuthenticatedCaller(req, settlement);
        if (!caller) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Operative credentials required for hold" }));
          return;
        }
        const data = JSON.parse(body || "{}");
        const opId = data.operativeId || data.playerId;
        const targetRaidId = data.raidId || settlement.getActiveRaidId();

        if (caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }

        if (caller.callerId !== opId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Operative ${caller.callerId} cannot report hold for ${opId}` }));
          return;
        }

        const holdTicksNum = Number(data.holdTicks);
        const currentTickNum = Number(data.currentTick);
        if (!Number.isFinite(holdTicksNum) || !Number.isFinite(currentTickNum) || holdTicksNum < 0 || currentTickNum < 0) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid holdTicks or currentTick: must be finite non-negative numbers", success: false }));
          return;
        }

        const activeWs = activeSlotSockets.get(`${targetRaidId}:${opId}`);
        const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(targetRaidId) : null;
        const oRec = rRec?.operatives?.[opId];

        const isCustodyFresh = oRec && typeof oRec.lastObservedTimestamp === "number" && (Date.now() - oRec.lastObservedTimestamp < 30000);
        const observedPos = (activeWs && activeWs.lastRelayedPos && (Date.now() - activeWs.lastRelayedPos.timestamp < 5000))
          ? activeWs.lastRelayedPos
          : (isCustodyFresh && typeof oRec.lastObservedX === "number" && typeof oRec.lastObservedZ === "number" ? { x: oRec.lastObservedX, z: oRec.lastObservedZ, isAlive: oRec.isAlive, health: oRec.health } : null);

        if (!caller.isSystem && !observedPos) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing fresh physical position evidence stream for extraction hold", success: false }));
          return;
        }

        if (!caller.isSystem && observedPos) {
          if (observedPos.isAlive === false || (typeof observedPos.health === "number" && observedPos.health <= 0)) {
            if (typeof settlement.recordOperativeKia === "function") {
              settlement.recordOperativeKia(targetRaidId, opId, "system");
            }
            if (typeof settlement.recordExtractionHold === "function") {
              settlement.recordExtractionHold(targetRaidId, opId, 0, currentTickNum, { inZone: false, isAlive: false, isKia: true });
            }
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Operative K.I.A. on authoritative position stream", success: false }));
            return;
          }

          const hasKeycard = Boolean(oRec?.hasKeycard);
          const inValidZone = isPositionInExfilZone(observedPos.x, observedPos.z, hasKeycard);
          if (!inValidZone) {
            if (typeof settlement.recordExtractionHold === "function") {
              settlement.recordExtractionHold(targetRaidId, opId, 0, currentTickNum, { inZone: false });
            }
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Operative outside extraction zone on authoritative stream`, success: false }));
            return;
          }

          if (typeof data.x === "number" && typeof data.z === "number") {
            const disc = Math.hypot(data.x - observedPos.x, data.z - observedPos.z);
            if (disc > 4.5) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: `Anomalous position discrepancy between stream and report (${disc.toFixed(1)}m > 4.5m threshold)`, success: false }));
              return;
            }
          }
        }

        const holdKeycard = Boolean(oRec?.hasKeycard);
        let inZone = false;
        if (typeof data.x === "number" && typeof data.z === "number" && Number.isFinite(data.x) && Number.isFinite(data.z)) {
          inZone = isPositionInExfilZone(data.x, data.z, holdKeycard);
        } else if (caller.isSystem) {
          inZone = !!data.inZone;
        } else {
          inZone = false;
        }

        const pendingDamage = (oRec && oRec.unconsumedDamage) ? oRec.unconsumedDamage : Number(data.damageTaken || 0);
        const result = settlement.recordExtractionHold(
          targetRaidId,
          opId,
          holdTicksNum,
          currentTickNum,
          {
            inZone: inZone !== false,
            damageTaken: pendingDamage,
            isAlive: data.isAlive !== false,
            isKia: data.isKia === true,
            x: data.x,
            z: data.z,
            timestamp: (caller.isSystem && typeof data.timestamp === "number") ? data.timestamp : undefined,
            simTickAdvancement: caller.isSystem ? !!data.simTickAdvancement : false,
          }
        );
        if (oRec && oRec.unconsumedDamage && result && result.success) {
          oRec.unconsumedDamage = 0;
        }
        if (result && result.receipt) {
          const exfilPkt = JSON.stringify({
            eventId: `evt_srv_exfil_${Date.now()}`,
            type: "exfil_success",
            senderId: opId,
            senderName: opId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE ALPHA",
            squad: opId === "op_bravo_1" ? "SQUAD BRAVO" : "SQUAD ALPHA",
            raidId: targetRaidId,
            timestamp: Date.now(),
            data: { receipt: result.receipt },
          });
          for (const client of wss.clients) {
            if (client.readyState === 1 && client.authenticated && client.raidId === targetRaidId) {
              try { client.send(exfilPkt); } catch {}
            }
          }
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(typeof data.attemptId === "number" ? { ...result, attemptId: data.attemptId } : result));
      } catch (err) {
        const msg = (err && err.message) || String(err);
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: msg }));
      }
    });
    return;
  }

  if (url.pathname === "/api/settlement/kia" && req.method === "POST") {
    let body = "";
    let byteLen = 0;
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      byteLen += len;
      if (byteLen > 65536) {
        exceeded = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload Too Large: exceeded 64KB limit" }));
        try { req.resume(); } catch {}
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        const caller = getAuthenticatedCaller(req, settlement);
        if (!caller) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Valid operative credentials required" }));
          return;
        }
        const data = JSON.parse(body || "{}");
        const opId = data.operativeId || data.playerId;
        const targetRaidId = data.raidId || settlement.getActiveRaidId();

        if (caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }

        if (caller.callerId !== opId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Operative ${caller.callerId} cannot eliminate ${opId}` }));
          return;
        }

        settlement.recordOperativeKia(targetRaidId, opId, caller.callerId);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, isKia: true }));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: (err && err.message) || String(err) }));
      }
    });
    return;
  }

  if (url.pathname === "/api/settlement/commit" && req.method === "POST") {
    let body = "";
    let byteLen = 0;
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      byteLen += len;
      if (byteLen > 65536) {
        exceeded = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload Too Large: exceeded 64KB limit" }));
        try { req.resume(); } catch {}
        return;
      }
      body += chunk;
    });
    req.on("end", async () => {
      if (exceeded) return;
      try {
        const caller = getAuthenticatedCaller(req, settlement);
        const data = JSON.parse(body || "{}");
        const extractingId = data.playerId || data.extractingId;
        const targetRaidId = data.raidId || settlement.getActiveRaidId();

        if (!caller) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Operative credentials required" }));
          return;
        }
        if (caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }
        if (caller.callerId !== extractingId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Operative ${caller.callerId} cannot commit settlement for ${extractingId}` }));
          return;
        }

        const rRaid = typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(targetRaidId) : null;
        const rOp = rRaid?.operatives?.[extractingId];
        if (rOp && (rOp.isKia || rOp.isAlive === false || rOp.health <= 0)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Cannot commit settlement: Operative ${extractingId} is K.I.A.` }));
          return;
        }
        if (rOp && (rOp.pendingRevocationSave || !rOp.holdCompleted)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Cannot commit settlement: Extraction hold not completed or pending revocation` }));
          return;
        }

        const activeWs = activeSlotSockets.get(`${targetRaidId}:${extractingId}`);
        if (activeWs && activeWs.lastRelayedPos) {
          if (activeWs.lastRelayedPos.isAlive === false || activeWs.lastRelayedPos.health <= 0) {
            if (typeof settlement.recordOperativeKia === "function") {
              settlement.recordOperativeKia(targetRaidId, extractingId, "system");
            }
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Cannot commit settlement: Operative ${extractingId} is K.I.A.` }));
            return;
          }
        }

        const result = await settlement.commitSettlement({
          raidId: targetRaidId,
          extractingId,
          snapshotTick: data.tick,
          snapshotCash: data.cash,
          exfilSubmitted: data.exfilSubmitted === true,
          simTickAdvancement: caller.isSystem ? !!data.simTickAdvancement : false,
        });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      } catch (err) {
        const msg = (err && err.message) || String(err);
        console.error("[SERVER COMMIT REJECTED]", msg);
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: msg }));
      }
    });
    return;
  }

  if (url.pathname === "/api/settlement/loot" && req.method === "POST") {
    let body = "";
    let byteLen = 0;
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      byteLen += len;
      if (byteLen > 65536) {
        exceeded = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload Too Large: exceeded 64KB limit" }));
        try { req.resume(); } catch {}
        return;
      }
      body += chunk;
    });
    req.on("end", async () => {
      if (exceeded) return;
      try {
        const caller = getAuthenticatedCaller(req, settlement);
        const data = JSON.parse(body || "{}");
        const claimantId = data.claimantId;
        const targetRaidId = data.raidId || settlement.getActiveRaidId();

        if (!caller) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Operative credentials required" }));
          return;
        }
        if (caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }
        if (caller.callerId !== claimantId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Operative ${caller.callerId} cannot claim loot for ${claimantId}` }));
          return;
        }
        if (!caller.isSystem) {
          const cratePos = DEPOT_CRATE_LOCATIONS[data.crateId];
          if (cratePos) {
            const activeWs = activeSlotSockets.get(`${targetRaidId}:${claimantId}`);
            const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(targetRaidId) : null;
            const oRec = rRec?.operatives?.[claimantId];
            const isCustodyFresh = oRec && typeof oRec.lastObservedTimestamp === "number" && (Date.now() - oRec.lastObservedTimestamp < 30000);
            const observedPos = (activeWs && activeWs.lastRelayedPos && (Date.now() - activeWs.lastRelayedPos.timestamp < 5000))
              ? activeWs.lastRelayedPos
              : (isCustodyFresh && typeof oRec.lastObservedX === "number" && typeof oRec.lastObservedZ === "number" ? { x: oRec.lastObservedX, z: oRec.lastObservedZ } : null);

            if (!observedPos) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Missing physical position stream evidence for crate looting", success: false }));
              return;
            }

            const distObserved = Math.hypot(observedPos.x - cratePos.x, observedPos.z - cratePos.z);
            if (distObserved > 4.5) {
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: `Out of range for crate ${data.crateId}: observed position is ${distObserved.toFixed(1)}m from crate (> 4.5m limit)`, success: false }));
              return;
            }
            if (typeof data.x === "number" && typeof data.z === "number" && Number.isFinite(data.x) && Number.isFinite(data.z)) {
              const dist = Math.hypot(data.x - cratePos.x, data.z - cratePos.z);
              if (dist > 4.5) {
                res.statusCode = 403;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: `Out of range for crate ${data.crateId}: distance ${dist.toFixed(1)}m > 4.5m`, success: false }));
                return;
              }
            }
          }
        }
        const raidId = targetRaidId;
        const raidRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
        const prevClaimant = raidRec?.crates?.[data.crateId]?.claimedBy;
        const isDuplicate = prevClaimant === claimantId;
        const ok = settlement.recordCrateLoot(
          raidId,
          data.crateId,
          claimantId,
          data.cashValue,
          data.claimTimestamp || Date.now(),
          { x: data.x, z: data.z }
        );
        const isNewClaim = ok && !isDuplicate && !settlement.lastClaimIsDuplicate;
        if (isNewClaim) {
          applyAuthoritativeCrateGrantToRelay(settlement, raidId, claimantId, prevClaimant);
        }
        const targetRaidRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
        const targetOpRec = targetRaidRec?.operatives?.[claimantId];
        const stimsRemaining = typeof targetOpRec?.stimsRemaining === "number" ? targetOpRec.stimsRemaining : 2;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: ok, isNewClaim, stimsRemaining }));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: (err && err.message) || String(err) }));
      }
    });
    return;
  }

  if (url.pathname === "/api/settlement/ledger" && req.method === "GET") {
    const ledger = settlement.getLedger();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(ledger));
    return;
  }

  // Static File Serving: real 404 for missing assets & files, SPA fallback only for extensionless routes
  let filePath = path.join(DIST_DIR, url.pathname === "/" ? "index.html" : url.pathname);
  if (!fs.existsSync(filePath)) {
    if (path.extname(url.pathname) !== "" || url.pathname.startsWith("/assets/")) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("404 Not Found");
      return;
    }
    filePath = path.join(DIST_DIR, "index.html");
  } else if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not Found (dist not built)");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  fs.createReadStream(filePath).pipe(res);
  };

  const server = existingHttpServer || http.createServer(requestHandler);

// WebSocket Server for Multi-Browser Relay with Authenticated Binding & Raid Scope Isolation
let wss;
if (existingHttpServer) {
  wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  existingHttpServer.on("upgrade", (request, socket, head) => {
    try {
      const pathname = request.url ? new URL(request.url, "http://localhost").pathname : "";
      if (pathname === "/syncplay-ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch {}
  });
} else {
  wss = new WebSocketServer({ server, path: "/syncplay-ws", maxPayload: 65536 });
}
const activeSlotSockets = new Map();
const operativeMovementStates = new Map(); // `${raidId}:${opId}` -> persistent movement state across sessions
const SERVER_MAX_MOVEMENT_SPEED = 12.0; // 12 m/s maximum sprint/roll speed (matches ws relay authority)
const SERVER_MAX_BURST_CAP = 12.0; // Maximum accrued movement budget after coordinated placement
settlement.hasActiveSocket = (raidId, opId) => {
  const s = activeSlotSockets.get(`${raidId}:${opId}`);
  if (!s || s.readyState !== 1 || s.superseded) return false;
  if (s.lastActivity && Date.now() - s.lastActivity > 10000) {
    try { s.terminate(); } catch {}
    return false;
  }
  return true;
}; // `${raidId}:${opId}` -> ws

const serverHeartbeatInterval = setInterval(() => {
  const now = Date.now();
  const hbPacket = JSON.stringify({ type: "heartbeat", serverTime: now });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      if (client.lastActivity && now - client.lastActivity > 10000) {
        try { client.terminate(); } catch {}
        continue;
      }
      if (client.bufferedAmount && client.bufferedAmount > 1048576) {
        client.authenticated = false;
        try { client.close(4008, "Slow consumer backpressure limit exceeded"); } catch {}
        continue;
      }
      try {
        client.send(hbPacket);
        client.ping();
      } catch {}
    }
  }
}, 3000);

process.on("SIGINT", () => {
  clearInterval(serverHeartbeatInterval);
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(serverHeartbeatInterval);
  process.exit(0);
});
server.on("close", () => {
  clearInterval(serverHeartbeatInterval);
});

wss.on("connection", (ws, req) => {
  ws.authenticated = false;
  ws.operativeId = null;
  ws.raidId = null;
  ws.lastActivity = Date.now();
  ws.on("pong", () => { ws.lastActivity = Date.now(); });

  let authTimer = null;
  try {
    const reqUrl = new URL(req.url, "http://localhost");
    const queryToken = reqUrl.searchParams.get("token") || req.headers["x-session-token"];
    if (queryToken) {
      const resolved = settlement.resolveOperativeByToken(queryToken);
      if (resolved) {
        const rRaid = settlement.getRaidRecord ? settlement.getRaidRecord(resolved.raidId) : null;
        const rOp = rRaid?.operatives?.[resolved.operativeId];
        const recoveryReceipt = findCommittedReceiptForOperative(settlement, resolved.raidId, resolved.operativeId);
        if (rRaid && (rRaid.status === "concluded" || rOp?.isExtracted || rOp?.isKia || rOp?.isAlive === false)) {
          if (!recoveryReceipt) {
            try { ws.close(4003, "Operative lifecycle concluded"); } catch {}
            return;
          }
        }
        if (typeof settlement.isIngressClosed === "function" && settlement.isIngressClosed(resolved.raidId)) {
          const slotKey = `${resolved.raidId}:${resolved.operativeId}`;
          const isSlotActive = (settlement.claimedSessions && settlement.claimedSessions.has(slotKey)) || activeSlotSockets.has(slotKey);
          if (!isSlotActive && !recoveryReceipt) {
            try { ws.close(4003, "Raid admission cutoff exceeded (8-minute limit)"); } catch {}
            return;
          }
        }
        if (authTimer) clearTimeout(authTimer);
        ws.authenticated = true;
        ws.authenticatedAt = Date.now();
        ws.operativeId = resolved.operativeId;
        ws.raidId = resolved.raidId;
        ws.authToken = queryToken;
        const slotKey = `${ws.raidId}:${ws.operativeId}`;
        const MAX_MOVEMENT_SPEED = 12.0; // 12 m/s maximum sprint/roll speed
        const MAX_MOVEMENT_BUDGET = 2.0; // 2.0m max burst allowance

        let opMoveState = operativeMovementStates.get(slotKey);
        if (!opMoveState) {
          const initSpawnX1 = ws.operativeId === "op_bravo_1" ? 50 : -50;
          const initSpawnZ1 = -50;
          const rRec1 = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const oRec1 = rRec1?.operatives?.[ws.operativeId];
          const lastX1 = (typeof oRec1?.lastObservedX === "number" && Number.isFinite(oRec1.lastObservedX)) ? oRec1.lastObservedX : initSpawnX1;
          const lastZ1 = (typeof oRec1?.lastObservedZ === "number" && Number.isFinite(oRec1.lastObservedZ)) ? oRec1.lastObservedZ : initSpawnZ1;
          opMoveState = {
            x: lastX1,
            z: lastZ1,
            health: oRec1?.health ?? 100,
            armor: oRec1?.armor ?? 100,
            isAlive: oRec1?.isKia ? false : (oRec1?.isAlive ?? true),
            lastServerTime: Date.now(),
            packetTimestamp: 0,
            timestamp: Date.now(),
            budget: MAX_MOVEMENT_BUDGET,
          };
          operativeMovementStates.set(slotKey, opMoveState);
        } else {
          // Reconnecting session: replenish budget from elapsed server time
          const now = Date.now();
          const dt = Math.max(0, (now - opMoveState.lastServerTime) / 1000);
          opMoveState.budget = Math.min(MAX_MOVEMENT_BUDGET, opMoveState.budget + dt * MAX_MOVEMENT_SPEED);
          opMoveState.lastServerTime = now;
        }
        ws.lastRelayedPos = opMoveState;
        try {
          settlement.claimSlot(ws.raidId, ws.operativeId);
        } catch (claimErr) {
          try { ws.close(1011, "Slot claim persistence failed"); } catch {}
          return;
        }
        const prevSocket = activeSlotSockets.get(slotKey);
        if (prevSocket && prevSocket !== ws) {
          prevSocket.superseded = true;
          try { prevSocket.close(4001, "superseded_by_new_session"); } catch {}
        }
        restoreWeaponStateFromCustody(settlement, resolved.raidId, resolved.operativeId);
        activeSlotSockets.set(slotKey, ws);
        const curTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(resolved.raidId) : undefined;
        const activeRaidRec = settlement.getRaidRecord ? settlement.getRaidRecord(resolved.raidId) : null;
        const authOp = activeRaidRec?.operatives?.[resolved.operativeId];
        const authWsState = getRaidOperativeWeaponState(resolved.raidId, resolved.operativeId, settlement);
        try {
          ws.send(JSON.stringify({
            type: "auth_success",
            operativeId: resolved.operativeId,
            raidId: resolved.raidId,
            currentRaidTick: curTick,
            admitted: true,
            data: { admitted: true, operativeId: resolved.operativeId, raidId: resolved.raidId },
            weapon: authWsState.selectedWeapon || "rifle",
            selectedWeapon: authWsState.selectedWeapon || "rifle",
            rifleAmmo: authWsState.rifleAmmo,
            shotgunAmmo: authWsState.shotgunAmmo,
            ammo: authWsState.ammo,
            machineRosterRevision: (activeRaidRec && typeof activeRaidRec.machineRosterRevision === "number") ? activeRaidRec.machineRosterRevision : raidRosterRevisions.get(resolved.raidId) || 0,
            machines: getRaidMachines(resolved.raidId),
            crates: activeRaidRec?.crates || {},
            serverTime: Date.now(),
            health: opMoveState.health,
            armor: opMoveState.armor,
            isAlive: opMoveState.isAlive,
            lastAcceptedPosition: { x: opMoveState.x, z: opMoveState.z },
            holdCompleted: !!authOp?.holdCompleted,
            holdCompletedAtTick: authOp?.holdCompletedAtTick || 0,
            isExtracted: !!authOp?.isExtracted,
            extractedAtTick: authOp?.extractedAtTick || 0,
          }));
        } catch {}
        if (recoveryReceipt) {
          try {
            ws.send(JSON.stringify({
              type: "settlement_committed",
              senderId: "server",
              serverAuthoritative: true,
              recovery: true,
              data: {
                receipt: recoveryReceipt.receipt,
                outcomePayload: recoveryReceipt.outcomePayload,
              },
            }));
          } catch {}
        }
      }
    }
  } catch {}

  authTimer = setTimeout(() => {
    if (!ws.authenticated) {
      try { ws.close(4001, "Authentication timeout"); } catch {}
    }
  }, 3000);

  ws.on("message", async (message) => {
    ws.lastActivity = Date.now();
    // Tx safety latch: any stale suppression from an aborted prior handler is cleared
    // at message entry (a leaked latch must never disable persistence).
    if (settlement.__txSuppressSave) settlement.__txSuppressSave = false;
    try {
      const byteLen = Buffer.isBuffer(message) ? message.length : Buffer.byteLength(message);
      if (byteLen > 65536) {
        try { ws.close(1009, "Message Too Large"); } catch {}
        return;
      }
      const text = typeof message === "string" ? message : message.toString("utf8");
      if (text.length > 65536) return;
      if (ws.superseded) return;
      if (ws.raidId && ws.operativeId) {
        const slotKey = `${ws.raidId}:${ws.operativeId}`;
        if (settlement.slotClaimTimestamps) {
          settlement.slotClaimTimestamps.set(slotKey, Date.now());
        }
        if (activeSlotSockets.get(slotKey) !== ws) return;
      }
      const packet = JSON.parse(text);
      // INGRESS trust boundary: the reserved server-authority stamp is assignable ONLY
      // by the relay's own validated result builders. Any client-supplied copy is
      // deleted BEFORE any handler runs — validated results stamped downstream by the
      // relay pass through untouched, so receivers can trust every stamp they see.
      if (packet && typeof packet === "object" && typeof packet.serverAuthoritative !== "undefined") {
        delete packet.serverAuthoritative;
      }

      if (!ws.authenticated) {
        const authTok = packet.token || (packet.type === "auth" && packet.data?.token);
        if (authTok) {
          const resolved = settlement.resolveOperativeByToken(authTok);
          if (resolved) {
            const rRaid = settlement.getRaidRecord ? settlement.getRaidRecord(resolved.raidId) : null;
            const rOp = rRaid?.operatives?.[resolved.operativeId];
            const recoveryReceipt = findCommittedReceiptForOperative(settlement, resolved.raidId, resolved.operativeId);
            if (rRaid && (rRaid.status === "concluded" || rOp?.isExtracted || rOp?.isKia || rOp?.isAlive === false)) {
              if (!recoveryReceipt) {
                try { ws.close(4003, "Operative lifecycle concluded"); } catch {}
                return;
              }
            }
            if (typeof settlement.isIngressClosed === "function" && settlement.isIngressClosed(resolved.raidId)) {
              const slotKey = `${resolved.raidId}:${resolved.operativeId}`;
              const isSlotActive = (settlement.claimedSessions && settlement.claimedSessions.has(slotKey)) || activeSlotSockets.has(slotKey);
              if (!isSlotActive && !recoveryReceipt) {
                try { ws.close(4003, "Raid admission cutoff exceeded (8-minute limit)"); } catch {}
                return;
              }
            }
            clearTimeout(authTimer);
            ws.authenticated = true;
            ws.authenticatedAt = Date.now();
            ws.operativeId = resolved.operativeId;
            ws.raidId = resolved.raidId;
            ws.authToken = authTok;
            const slotKey = `${ws.raidId}:${ws.operativeId}`;
            const MAX_MOVEMENT_SPEED = 12.0;
            const MAX_MOVEMENT_BUDGET = 2.0;

            let opMoveState = operativeMovementStates.get(slotKey);
            if (!opMoveState) {
              const initSpawnX2 = ws.operativeId === "op_bravo_1" ? 50 : -50;
              const initSpawnZ2 = -50;
              const rRec2 = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
              const oRec2 = rRec2?.operatives?.[ws.operativeId];
              const lastX2 = (typeof oRec2?.lastObservedX === "number" && Number.isFinite(oRec2.lastObservedX)) ? oRec2.lastObservedX : initSpawnX2;
              const lastZ2 = (typeof oRec2?.lastObservedZ === "number" && Number.isFinite(oRec2.lastObservedZ)) ? oRec2.lastObservedZ : initSpawnZ2;
              opMoveState = {
                x: lastX2,
                z: lastZ2,
                health: oRec2?.health ?? 100,
                armor: oRec2?.armor ?? 100,
                isAlive: oRec2?.isKia ? false : (oRec2?.isAlive ?? true),
                lastServerTime: Date.now(),
                packetTimestamp: 0,
                timestamp: Date.now(),
                budget: MAX_MOVEMENT_BUDGET,
              };
              operativeMovementStates.set(slotKey, opMoveState);
            } else {
              const now = Date.now();
              const dt = Math.max(0, (now - opMoveState.lastServerTime) / 1000);
              opMoveState.budget = Math.min(MAX_MOVEMENT_BUDGET, opMoveState.budget + dt * MAX_MOVEMENT_SPEED);
              opMoveState.lastServerTime = now;
            }
            restoreWeaponStateFromCustody(settlement, resolved.raidId, resolved.operativeId);
            ws.lastRelayedPos = opMoveState;
            try {
              settlement.claimSlot(ws.raidId, ws.operativeId);
            } catch (claimErr) {
              try { ws.close(1011, "Slot claim persistence failed"); } catch {}
              return;
            }
            const prevSocket = activeSlotSockets.get(slotKey);
            if (prevSocket && prevSocket !== ws) {
              prevSocket.superseded = true;
              try { prevSocket.close(4001, "superseded_by_new_session"); } catch {}
            }
            activeSlotSockets.set(slotKey, ws);
            const curTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(resolved.raidId) : undefined;
            const authWsState = getRaidOperativeWeaponState(resolved.raidId, resolved.operativeId, settlement);
            (() => {
              const __authRec = settlement.getRaidRecord ? settlement.getRaidRecord(resolved.raidId) : null;
              const authOp = __authRec?.operatives?.[resolved.operativeId];
              try {
                ws.send(JSON.stringify({
                  type: "auth_success",
                  operativeId: resolved.operativeId,
                  raidId: resolved.raidId,
                  currentRaidTick: curTick,
                  admitted: true,
                  data: { admitted: true, operativeId: resolved.operativeId, raidId: resolved.raidId },
                  weapon: authWsState.selectedWeapon || "rifle",
                  selectedWeapon: authWsState.selectedWeapon || "rifle",
                  rifleAmmo: authWsState.rifleAmmo,
                  shotgunAmmo: authWsState.shotgunAmmo,
                  ammo: authWsState.ammo,
                  serverTime: Date.now(),
                  health: opMoveState.health,
                  armor: opMoveState.armor,
                  isAlive: opMoveState.isAlive,
                  machineRosterRevision: (__authRec && typeof __authRec.machineRosterRevision === "number") ? __authRec.machineRosterRevision : raidRosterRevisions.get(resolved.raidId) || 0,
                  machines: getRaidMachines(resolved.raidId),
                  crates: __authRec?.crates || {},
                  lastAcceptedPosition: { x: opMoveState.x, z: opMoveState.z },
                  holdCompleted: !!authOp?.holdCompleted,
                  holdCompletedAtTick: authOp?.holdCompletedAtTick || 0,
                  isExtracted: !!authOp?.isExtracted,
                  extractedAtTick: authOp?.extractedAtTick || 0,
                }));
              } catch {}
              if (recoveryReceipt) {
                try {
                  ws.send(JSON.stringify({
                    type: "settlement_committed",
                    senderId: "server",
                    serverAuthoritative: true,
                    recovery: true,
                    data: {
                      receipt: recoveryReceipt.receipt,
                      outcomePayload: recoveryReceipt.outcomePayload,
                    },
                  }));
                } catch {}
              }
            })();
            return;
          }
        }
        ws.close(4001, "Unauthorized");
        return;
      }

      // Revalidate that session token has not been revoked by raid reset, raid conclusion, or operative extraction/KIA
      const isExfilNotice = packet.type === "exfil_success" || packet.type === "settlement_commit";
      const isRecovery = !!findCommittedReceiptForOperative(settlement, ws.raidId, ws.operativeId);
      const callerRaid = ws.raidId && typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(ws.raidId) : null;
      const callerOp = callerRaid?.operatives?.[ws.operativeId];

      const isTerminalOrConcluded = (callerRaid && callerRaid.status === "concluded") ||
        (callerOp && (callerOp.isExtracted || callerOp.isKia || callerOp.isAlive === false)) ||
        (ws.authToken && !settlement.resolveOperativeByToken(ws.authToken));

      if (isTerminalOrConcluded) {
        if (!isExfilNotice) {
          if (!isRecovery) {
            ws.close(4003, "Session revoked or operative concluded");
          }
          // STRICT TERMINAL CUSTODY: Extracted/KIA operatives and concluded raids are strictly
          // restricted to receipt recovery and settlement retries. ZERO combat, movement, or state authority!
          return;
        }
      }

      if (packet.raidId && packet.raidId !== ws.raidId) {
        return; // Drop packet targeting wrong raid
      }

      // CRITICAL: Prevent malicious client packet relay
      const FORBIDDEN_CLIENT_PACKETS = new Set(["auth", "auth_success", "server_init", "server_handshake", "state_correction", "hit_confirmed", "settlement_committed", "settlement_rejected", "settlement_error"]);
      if (FORBIDDEN_CLIENT_PACKETS.has(packet.type)) return;

      if (ws.authenticated && ws.raidId && ws.operativeId) {
        const slotKey = `${ws.raidId}:${ws.operativeId}`;
        if (typeof settlement.slotClaimTimestamps?.set === "function") {
          settlement.slotClaimTimestamps.set(slotKey, Date.now());
        }
      }

      packet.senderId = ws.operativeId;
      packet.raidId = ws.raidId;

      if (packet.type === "hold_tick") {
        const callerRaid = ws.raidId && typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(ws.raidId) : null;
        const callerOp = callerRaid?.operatives?.[ws.operativeId];
        if (!callerOp || callerOp.isExtracted || callerOp.isKia || callerOp.isAlive === false || callerRaid?.status === "concluded") {
          return;
        }

        const slotKey = `${ws.raidId}:${ws.operativeId}`;
        const activeMove = operativeMovementStates.get(slotKey) || ws.lastRelayedPos;
        const opX = (activeMove && typeof activeMove.x === "number") ? activeMove.x : callerOp.lastObservedX;
        const opZ = (activeMove && typeof activeMove.z === "number") ? activeMove.z : callerOp.lastObservedZ;
        const hasKeycard = Boolean(callerOp.hasKeycard);
        const inZone = (typeof opX === "number" && typeof opZ === "number") ? isPositionInExfilZone(opX, opZ, hasKeycard) : false;

        const holdTicks = typeof packet.data?.holdTicks === "number" ? packet.data.holdTicks : 0;
        const currentTick = typeof packet.data?.currentTick === "number" ? packet.data.currentTick : (settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(ws.raidId) : 0);
        const zoneId = (typeof opX === "number" && typeof opZ === "number" && Math.hypot(opX - (-45.0), opZ - (-45.0)) <= 6.0 && hasKeycard) ? "bunker" : "lz";

        let holdResult = null;
        if (typeof settlement.recordExtractionHold === "function") {
          try {
            holdResult = settlement.recordExtractionHold(
              ws.raidId,
              ws.operativeId,
              holdTicks,
              currentTick,
              {
                inZone,
                zoneId,
                hasKeycard,
                isAlive: !callerOp.isKia && callerOp.isAlive !== false,
                x: opX,
                z: opZ,
              }
            );
          } catch (err) {
            console.error("Error recording extraction hold from WS:", err);
          }
        }

        try {
          ws.send(JSON.stringify({
            type: "hold_tick_ack",
            eventId: packet.eventId,
            senderId: "server",
            serverAuthoritative: true,
            raidId: ws.raidId,
            operativeId: ws.operativeId,
            data: {
              operativeId: ws.operativeId,
              holdTicks: holdResult?.currentHoldTicks ?? holdTicks,
              holdCompleted: Boolean(holdResult?.holdCompleted || callerOp.holdCompleted),
              holdCompletedAtTick: holdResult?.holdCompletedAtTick ?? callerOp.holdCompletedAtTick ?? 0,
              inZone,
              hasKeycard,
            },
          }));
        } catch {}
        return;
      }

      if (packet.type === "settlement_commit") {
        try {
          const extractingId = ws.operativeId || packet.senderId || packet.data?.extractingId || packet.data?.playerId;
          const targetRaidId = ws.raidId || packet.raidId || settlement.getActiveRaidId();
          const rRaid = typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(targetRaidId) : null;
          const rOp = rRaid?.operatives?.[extractingId];

          if (rOp && (rOp.isKia || rOp.isAlive === false || rOp.health <= 0)) {
            ws.send(JSON.stringify({
              type: "settlement_rejected",
              eventId: packet.eventId,
              error: `Cannot commit settlement: Operative ${extractingId} is K.I.A.`,
            }));
            return;
          }

          const result = await settlement.commitSettlement({
            raidId: targetRaidId,
            extractingId,
            snapshotTick: packet.data?.tick,
            snapshotCash: packet.data?.cash,
            exfilSubmitted: packet.data?.exfilSubmitted === true,
          });

          ws.send(JSON.stringify({
            type: "settlement_committed",
            eventId: packet.eventId,
            senderId: "server",
            serverAuthoritative: true,
            recovery: false,
            data: result,
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            type: "settlement_rejected",
            eventId: packet.eventId,
            senderId: "server",
            serverAuthoritative: true,
            error: (err && err.message) || String(err),
          }));
        }
        return;
      }

      if (packet.type === "state" && packet.data) {
        // TRANSACTION OWNER (packet-handler scope): snapshots + latch live here so the
        // commit/rollback logic in any nested block can reference them. The latch is
        // cleared in the finally tail — it can never leak into the next packet (which
        // would silently disable saveToDisk for machine-executor persistence).
        let __txCbMoveBefore = null;
        let __txCbCustodyBefore = null;
        let __txWeaponKeyScoped = null;
        let __txWeaponBeforeScoped = null;
        let __txOpen = false;
        const __txLatch = () => { settlement.__txSuppressSave = true; __txOpen = true; };
        const __txnUnlatch = () => { settlement.__txSuppressSave = false; __txOpen = false; };
        if (!packet.eventId || typeof packet.eventId !== "string" || !packet.eventId.trim()) {
          return;
        }
        const now = Date.now();
        if (
          typeof packet.timestamp !== "number" ||
          !Number.isFinite(packet.timestamp) ||
          packet.timestamp <= 0 ||
          packet.timestamp >= 1e14 ||
          packet.timestamp > now + 2000
        ) {
          return; // Reject packets with non-finite, past-wrap, or future timestamps > 2000ms
        }
        const px = packet.data.x;
        const pz = packet.data.z;
        if (typeof px !== "number" || typeof pz !== "number" || !Number.isFinite(px) || !Number.isFinite(pz)) {
          return;
        }
        // Strict map bounds matching simulation (+-80)
        if (Math.abs(px) > 80 || Math.abs(pz) > 80) {
          return; // Drop packet entirely: do not update position and do not relay to peers!
        }
        const slotKey = `${ws.raidId}:${ws.operativeId}`;
        let moveState = operativeMovementStates.get(slotKey) || ws.lastRelayedPos;
        const MAX_MOVEMENT_SPEED = 12.0;
        const MAX_MOVEMENT_BUDGET = 2.0;

        if (!moveState) {
          if (checkContainerCollision(px, pz)) {
            return;
          }
          moveState = {
            x: px,
            z: pz,
            health: packet.data.health ?? 100,
            isAlive: packet.data.isAlive ?? true,
            lastServerTime: Date.now(),
            packetTimestamp: packet.timestamp,
            timestamp: packet.timestamp || Date.now(),
            budget: MAX_MOVEMENT_BUDGET,
          };
          operativeMovementStates.set(slotKey, moveState);
        } else {
          // Strictly increasing timestamp required: reject out-of-order or duplicate timestamp packets
          if (moveState.packetTimestamp && packet.timestamp <= moveState.packetTimestamp) {
            return;
          }
          // Server elapsed time bounding: budget restores from real elapsed server time across report gaps!
          const dtServer = Math.max(0, (now - moveState.lastServerTime) / 1000);
          const MAX_BURST_CAP = 12.0; // Accommodate report gaps and network jitter up to 1.0s
          moveState.budget = Math.min(MAX_BURST_CAP, moveState.budget + dtServer * MAX_MOVEMENT_SPEED);
          moveState.lastServerTime = now;

          const dist = Math.hypot(px - moveState.x, pz - moveState.z);
          // Sustained movement distance CANNOT exceed the accrued budget
          if (dist > moveState.budget) {
            // Speed violation / teleport: drop relay and send position correction back to client
            try {
              ws.send(JSON.stringify({
                type: "state_correction",
                raidId: ws.raidId,
                operativeId: ws.operativeId,
                x: moveState.x,
                z: moveState.z,
                timestamp: Date.now(),
              }));
            } catch {}
            return;
          }

          // Authoritative physical container collision check (destination and sliding/swept movement path)
          if (!checkLegalMovementPath(moveState.x, moveState.z, px, pz)) {
            try {
              ws.send(JSON.stringify({
                type: "state_correction",
                raidId: ws.raidId,
                operativeId: ws.operativeId,
                x: moveState.x,
                z: moveState.z,
                timestamp: Date.now(),
              }));
            } catch {}
            return;
          }

          // DURABLE TRANSACTION open (packet-scoped owner declared above the if-chain):
          // latch nested recorders (ammo, K.I.A.) so exactly ONE commit at the end of
          // the handler persists the whole transaction atomically.
          __txLatch();
          // DURABLE TRANSACTION: capture the COMPLETE movement state (budget, timestamps,
          // roll state, action) and custody snapshot BEFORE the first mutation, so a
          // failed persistence restores the exact prior world. ONE save commits the
          // accepted packet (all nested per-action saves were removed).
          // Weapon state snapshot assigned to the packet-scoped owners (declared above
          // the if-chain — same scope as the commit tail).
          __txWeaponKeyScoped = `${ws.raidId}:${ws.operativeId}`;
          __txWeaponBeforeScoped = Object.assign({}, raidOperativeWeaponStates.get(__txWeaponKeyScoped) || { ammo: 30, maxAmmo: 30, isReloading: false, reloadEnd: 0 });
          __txCbMoveBefore = Object.assign({}, moveState, {
            rollStartedAt: moveState.rollStartedAt,
            lastRollStartedAt: moveState.lastRollStartedAt,
            action: moveState.action,
          });
          const __txRrec = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const __txOrec = __txRrec?.operatives?.[ws.operativeId];
          __txCbCustodyBefore = __txOrec ? JSON.parse(JSON.stringify(__txOrec)) : null;

          // Deduct consumed distance from budget!
          moveState.budget -= dist;
          moveState.x = px;
          moveState.z = pz;


          moveState.packetTimestamp = packet.timestamp;
          moveState.timestamp = packet.timestamp || Date.now();
          // Authoritative server custody for stims
          const rRecMove = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const oRecMove = rRecMove?.operatives?.[ws.operativeId];
          const serverStims = typeof settlement.getOperativeStims === "function"
            ? settlement.getOperativeStims(ws.raidId, ws.operativeId)
            : (typeof oRecMove?.stimsRemaining === "number" ? oRecMove.stimsRemaining : 2);
          moveState.stimsRemaining = serverStims;

          // Compute damage amounts first
          let acceptedDamageAmount = 0;
          let safeHp = moveState.health ?? 100;
          const preAcceptedHp = moveState.health ?? 100;
          if (typeof packet.data.health === "number" && Number.isFinite(packet.data.health)) {
            safeHp = Math.max(0, Math.min(100, packet.data.health));
            if (safeHp < preAcceptedHp) {
              moveState.health = safeHp;
              acceptedDamageAmount += preAcceptedHp - safeHp;
            }
          }
          if (typeof packet.data.armor === "number" && Number.isFinite(packet.data.armor)) {
            const safeArmor = Math.max(0, Math.min(100, packet.data.armor));
            const preAcceptedArmor = moveState.armor ?? 100;
            moveState.armor = Math.min(preAcceptedArmor, safeArmor);
            if (safeArmor < preAcceptedArmor) acceptedDamageAmount += preAcceptedArmor - safeArmor;
          }

          // Abrupt movement check (roll, slide, sprint, or position jump > 0.25m)
          const hasAbruptMovement = packet.data.action === "roll" ||
            packet.data.action === "slide" ||
            moveState.action === "roll" ||
            moveState.action === "slide" ||
            packet.data.sprint === true ||
            dist > 0.25;

          // Stim treatment verification:
          // 1. Process cancellation FIRST if active channel suffered trauma or abrupt movement
          if (moveState.isUsingStim && (acceptedDamageAmount > 0 || hasAbruptMovement)) {
            moveState.isUsingStim = false;
            moveState.stimChannelStartedAt = 0;
          }

          // 2. Channel completion check (channel duration >= 950ms completed cleanly without trauma/movement)
          if (moveState.isUsingStim && packet.data.isUsingStim !== true) {
            const channelDuration = now - (moveState.stimChannelStartedAt || 0);
            if (channelDuration >= 950 && moveState.stimsRemaining > 0 && acceptedDamageAmount === 0 && !hasAbruptMovement) {
              const consumed = typeof settlement.consumeOperativeStim === "function"
                ? settlement.consumeOperativeStim(ws.raidId, ws.operativeId)
                : false;
              if (consumed) {
                moveState.stimsRemaining = typeof settlement.getOperativeStims === "function"
                  ? settlement.getOperativeStims(ws.raidId, ws.operativeId)
                  : Math.max(0, moveState.stimsRemaining - 1);
                moveState.health = Math.min(100, (moveState.health ?? 100) + 45);
              }
            }
            moveState.isUsingStim = false;
            moveState.stimChannelStartedAt = 0;
          } else if (packet.data.isUsingStim === true) {
            // 3. Initiate channel if not already using stim
            if (!moveState.isUsingStim) {
              if (moveState.stimsRemaining > 0 && !hasAbruptMovement && acceptedDamageAmount === 0) {
                moveState.isUsingStim = true;
                moveState.stimChannelStartedAt = now;
              }
            }
          }

          // 4. Validate client health increase against authoritative state
          if (safeHp > preAcceptedHp) {
            if (moveState.health > preAcceptedHp) {
              moveState.health = Math.min(safeHp, moveState.health);
            } else {
              moveState.health = preAcceptedHp;
            }
          }
          // An ACCEPTED health OR armor decrease is combat damage: authoritatively break
          // the operative's extraction hold custody server-side, so the hold cannot stay
          // intact when a client omits the reset report (machine / environmental damage
          // inside the LZ). Durable transaction: custody vitals, position, and hold
          // revocation are persisted TOGETHER after the full state update completes.
          if (acceptedDamageAmount > 0) {
            const rRecDmg = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
            const oRecDmg = rRecDmg?.operatives?.[ws.operativeId];
            const dmgTick = Math.max(1, moveState.currentTick || 0, (settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(ws.raidId) : 0) || 0);
            if (typeof settlement.recordExtractionHold === "function") {
              settlement.recordExtractionHold(ws.raidId, ws.operativeId, 0, dmgTick, { inZone: false, damageTaken: acceptedDamageAmount, skipSave: true });
            } else if (oRecDmg) {
              oRecDmg.holdTicks = 0;
              oRecDmg.holdStartTick = undefined;
              oRecDmg.lastHoldTimestamp = undefined;
              oRecDmg.holdCompleted = false;
            }
            // Sync custody vitals with the accepted damage IMMEDIATELY (same logical
            // transaction as the movement update above).
            if (oRecDmg) {
              oRecDmg.health = Math.max(0, Math.min(100, moveState.health ?? 100));
              oRecDmg.armor = Math.max(0, Math.min(100, moveState.armor ?? 100));
              oRecDmg.lastDamageTimestamp = Date.now();
              oRecDmg.unconsumedDamage = acceptedDamageAmount;
            }
          }
          if (typeof packet.data.action === "string") {
            if (packet.data.action === "roll") {
              const timeSinceLastRoll = moveState.lastRollStartedAt ? (now - moveState.lastRollStartedAt) : 999999;
              if (moveState.action !== "roll" || timeSinceLastRoll >= 800) {
                if (timeSinceLastRoll >= 800) {
                  moveState.rollStartedAt = now;
                  moveState.lastRollStartedAt = now;
                } else {
                  moveState.rollStartedAt = moveState.lastRollStartedAt;
                }
              }
            } else {
              moveState.rollStartedAt = 0;
            }
            moveState.action = packet.data.action;
          }
          const rollElapsed = moveState.rollStartedAt ? (now - moveState.rollStartedAt) : 999999;
          const validIframes = moveState.action === "roll" && rollElapsed <= 220 && packet.data.isInvulnerable === true;
          moveState.isInvulnerable = validIframes;
          packet.data.isInvulnerable = validIframes;
          if (typeof packet.data.tick === "number") {
            moveState.currentTick = packet.data.tick;
          }
          if (moveState.health <= 0) {
            moveState.isAlive = false;
          } else if (typeof packet.data.isAlive === "boolean") {
            moveState.isAlive = packet.data.isAlive;
          }
        }

        ws.lastRelayedPos = moveState;


        // Weapon state is updated authoritatively ONLY after packet timestamp, bounds, and movement validation have passed!
        const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
        if (packet.data.weapon === "shotgun" || packet.data.weapon === "rifle") {
          weaponState.selectedWeapon = packet.data.weapon;
        }
        const currentWeapon = weaponState.selectedWeapon || "rifle";

        if (packet.data.action === "reload") {
          if (!weaponState.isReloading) {
            weaponState.isReloading = true;
            weaponState.reloadingWeapon = currentWeapon;
            weaponState.reloadEnd = now + 350;
          }
          const reloadedWeapon = weaponState.reloadingWeapon || currentWeapon;
          if (reloadedWeapon === "shotgun") {
            const reportedS = typeof packet.data.shotgunAmmo === "number" ? Math.floor(packet.data.shotgunAmmo) : (typeof packet.data.ammo === "number" ? Math.floor(packet.data.ammo) : 8);
            weaponState.shotgunAmmo = Math.max(0, Math.min(8, Math.max(weaponState.shotgunAmmo, reportedS)));
            if (typeof packet.data.rifleAmmo === "number" && Number.isFinite(packet.data.rifleAmmo)) {
              const rAmmo = Math.max(0, Math.min(30, Math.floor(packet.data.rifleAmmo)));
              if (rAmmo <= weaponState.rifleAmmo) weaponState.rifleAmmo = rAmmo;
            }
          } else {
            const reportedR = typeof packet.data.rifleAmmo === "number" ? Math.floor(packet.data.rifleAmmo) : (typeof packet.data.ammo === "number" ? Math.floor(packet.data.ammo) : 30);
            weaponState.rifleAmmo = Math.max(0, Math.min(30, Math.max(weaponState.rifleAmmo, reportedR)));
            if (typeof packet.data.shotgunAmmo === "number" && Number.isFinite(packet.data.shotgunAmmo)) {
              const sAmmo = Math.max(0, Math.min(8, Math.floor(packet.data.shotgunAmmo)));
              if (sAmmo <= weaponState.shotgunAmmo) weaponState.shotgunAmmo = sAmmo;
            }
          }
          weaponState.ammo = currentWeapon === "shotgun" ? weaponState.shotgunAmmo : weaponState.rifleAmmo;
          setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo);
        } else {
          if (weaponState.isReloading && now >= weaponState.reloadEnd) {
            weaponState.isReloading = false;
            weaponState.reloadingWeapon = null;
          }
          if (!weaponState.isReloading) {
            if (typeof packet.data.rifleAmmo === "number" && Number.isFinite(packet.data.rifleAmmo)) {
              const rAmmo = Math.max(0, Math.min(30, Math.floor(packet.data.rifleAmmo)));
              if (rAmmo <= weaponState.rifleAmmo) {
                weaponState.rifleAmmo = rAmmo;
              }
            }
            if (typeof packet.data.shotgunAmmo === "number" && Number.isFinite(packet.data.shotgunAmmo)) {
              const sAmmo = Math.max(0, Math.min(8, Math.floor(packet.data.shotgunAmmo)));
              if (sAmmo <= weaponState.shotgunAmmo) {
                weaponState.shotgunAmmo = sAmmo;
              }
            }
            if (typeof packet.data.ammo === "number" && Number.isFinite(packet.data.ammo)) {
              const reportedA = Math.max(0, Math.floor(packet.data.ammo));
              if (currentWeapon === "shotgun" && reportedA <= weaponState.shotgunAmmo) {
                weaponState.shotgunAmmo = reportedA;
              } else if (currentWeapon === "rifle" && reportedA <= weaponState.rifleAmmo) {
                weaponState.rifleAmmo = reportedA;
              }
            }
            weaponState.ammo = currentWeapon === "shotgun" ? weaponState.shotgunAmmo : weaponState.rifleAmmo;
            setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo);
          }
        }
        weaponState.ammo = currentWeapon === "shotgun" ? weaponState.shotgunAmmo : weaponState.rifleAmmo;
        weaponState.maxAmmo = currentWeapon === "shotgun" ? 8 : 30;

        // Authoritative life-state clamp for the relayed view
        packet.data.health = moveState.health;
        if (typeof moveState.armor === "number") {
          packet.data.armor = moveState.armor;
        }
        packet.data.isAlive = moveState.isAlive;

        // Synchronize authoritative settlement custody with the accepted packet, then
        // commit the WHOLE transaction (position + observation time + vitals + any
        // hold revocation) with exactly ONE save before relay. On failure the complete
        // pre-transaction snapshots are restored and the packet is dropped — memory
        // never drifts ahead of disk, peers never see uncommitted state.
        const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
        const oRec = rRec?.operatives?.[ws.operativeId];
        if (oRec) {
          oRec.lastObservedX = px;
          oRec.lastObservedZ = pz;
          oRec.hasLiveMovement = true;
          oRec.lastObservedTimestamp = Date.now();
          oRec.health = Math.max(0, Math.min(100, moveState.health ?? 100));
          oRec.armor = Math.max(0, Math.min(100, moveState.armor ?? 100));
          oRec.isAlive = moveState.isAlive;
          if (moveState.health <= 0) oRec.isKia = true;
          delete oRec.pendingRevocationSave; // resolved within this commit

          const inValidExfil = isPositionInExfilZone(px, pz, Boolean(oRec?.hasKeycard));
          if (!inValidExfil) {
            if (typeof settlement.resetOperativeHoldAttempt === "function") {
              settlement.resetOperativeHoldAttempt(ws.raidId, ws.operativeId);
            } else {
              oRec.holdTicks = 0;
              oRec.holdStartTick = undefined;
              oRec.holdStartTimestamp = undefined;
              oRec.lastHoldTimestamp = undefined;
              oRec.holdReportCount = 0;
              oRec.lastReportTick = undefined;
              oRec.holdCompleted = false;
              oRec.corridorStartTime = undefined;
              oRec.holdCompletedAtTick = undefined;
              oRec.holdCompletedTimestamp = undefined;
            }
          }
        }

        if (moveState.health <= 0 || packet.data.isAlive === false || packet.data.isKia === true) {
          if (typeof settlement.recordOperativeKia === "function") {
            try { settlement.recordOperativeKia(ws.raidId, ws.operativeId, "system"); } catch {}
          }
        }

        // SINGLE DURABLE COMMIT of the accepted packet. Order: save FIRST while the
        // latch still suppresses nested recorders (true single save), then unlatch in
        // finally — the latch can NEVER leak into the next packet (leaks would
        // silently disable saveToDisk machine-executor persistence). On failure the
        // COMPLETE pre-transaction snapshots restore and the packet is dropped.
        const __txRollback = () => {
          if (__txCbMoveBefore) {
            for (const __k of Object.keys(moveState)) delete moveState[__k];
            Object.assign(moveState, __txCbMoveBefore);
          }
          if (oRec && __txCbCustodyBefore) {
            for (const __k of Object.keys(oRec)) delete oRec[__k];
            Object.assign(oRec, __txCbCustodyBefore);
          }
        };
        // Unlatch BEFORE the commit save — the latch's own saveToDisk guard would
        // silently no-op this call. Between unlatch and save nothing else runs, so the
        // single-save guarantee is preserved (all nested recorders already finished).
        __txnUnlatch();
        try {
          if (settlement.saveToDisk) settlement.saveToDisk();
        } catch (__txPersistErr) {
          __txRollback();
          if (__txWeaponKeyScoped && __txWeaponBeforeScoped) {
            raidOperativeWeaponStates.set(__txWeaponKeyScoped, __txWeaponBeforeScoped);
          }
          return; // accepted state never relays ahead of disk
        }
      }

      if (packet.senderName === "CENTRAL COMMAND" || packet.senderName === "system" || packet.senderName === "server") {
        packet.senderName = ws.operativeId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE ALPHA";
      }

        const AI_ROSTER = new Map([
          ["scav_boss_warlord", { id: "scav_boss_warlord", name: "SECTOR WARLORD BOSS", type: "boss", health: 100, startingHealth: 100, maxHealth: 100, armor: 100, startingArmor: 100, maxArmor: 100, cash: 6500, ammo: 30, maxAmmo: 30, weapon: "rifle", hasKeycard: true, dropsKeycard: true, originX: 0, originZ: 42, speed: 0.005, ampX: 2.0, ampZ: 1.5 }],
          ["scav_runner_01", { id: "scav_runner_01", name: "SCAV RUNNER // RECON", type: "scav", health: 80, startingHealth: 80, maxHealth: 80, armor: 40, startingArmor: 40, maxArmor: 40, cash: 1800, ammo: 30, maxAmmo: 30, weapon: "rifle", hasKeycard: false, dropsKeycard: false, originX: -25, originZ: 5, speed: 0.006, ampX: 3.0, ampZ: 2.0 }],
          ["scav_enforcer_02", { id: "scav_enforcer_02", name: "SCAV ENFORCER // SHOTGUN", type: "scav", health: 100, startingHealth: 100, maxHealth: 100, armor: 60, startingArmor: 60, maxArmor: 60, cash: 2800, ammo: 6, maxAmmo: 6, weapon: "shotgun", hasKeycard: false, dropsKeycard: false, originX: 18, originZ: 28, speed: 0.004, ampX: 2.5, ampZ: 2.5 }],
          ["op_rogue_ai", { id: "op_rogue_ai", name: "ROGUE EXFIL HUNTER", type: "scav", health: 100, startingHealth: 100, maxHealth: 100, armor: 75, startingArmor: 75, maxArmor: 75, cash: 2500, ammo: 30, maxAmmo: 30, weapon: "rifle", hasKeycard: false, dropsKeycard: false, originX: -45, originZ: 45, speed: 0.005, ampX: 3.5, ampZ: 2.0 }],
        ]);
        const BOSS_CONFIG = AI_ROSTER.get("scav_boss_warlord");

        const computeAIPosition = (targetId, tick) => {
          const cfg = AI_ROSTER.get(targetId) || AI_ROSTER.get("scav_boss_warlord");
          const x = cfg.originX + Math.sin(tick * cfg.speed) * cfg.ampX;
          const z = cfg.originZ + Math.cos(tick * cfg.speed) * cfg.ampZ;
          const vx = Math.cos(tick * cfg.speed) * cfg.ampX * cfg.speed;
          const vz = -Math.sin(tick * cfg.speed) * cfg.ampZ * cfg.speed;
          const facing = Math.atan2(vx, vz);
          return { x, z, facing };
        };

        const computeBossPosition = (tick) => computeAIPosition("scav_boss_warlord", tick);

        // Applies + persists a single validated operative strike (geometry, roll iframes,
        // armor absorption, K.I.A. custody, extraction-hold break, hit_confirmed ack,
        // knockback movement budget). Callers own dedup, damage bounds, cooldown, and ammo.
        const getOrRegisterTargetState = (raidId, targetId) => {
          const targetSlotKey = `${raidId}:${targetId}`;
          let targetMove = operativeMovementStates.get(targetSlotKey);
          let isNewRegistration = false;
          const aiConfig = AI_ROSTER.get(targetId);
          const isBoss = targetId === BOSS_CONFIG.id;
          const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
          const existingCustody = rRec?.operatives?.[targetId];

          if (existingCustody) {
            // Reject strikes against terminal custody
            if (existingCustody.isKia || existingCustody.isAlive === false) {
              if (targetMove) {
                targetMove.isAlive = false;
                targetMove.isKia = true;
                targetMove.health = 0;
              }
              return { targetMove: null, isNewRegistration: false, isTerminal: true };
            }

            // Restore movement state from custody if missing (e.g. after server restart)
            if (!targetMove) {
              const currentRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(raidId) : 0;
              const pos = aiConfig
                ? computeAIPosition(targetId, currentRaidTick)
                : { x: existingCustody.lastObservedX ?? 0, z: existingCustody.lastObservedZ ?? 42 };
              targetMove = {
                x: pos.x,
                z: pos.z,
                health: typeof existingCustody.health === "number" ? existingCustody.health : (aiConfig?.health ?? 100),
                armor: typeof existingCustody.armor === "number" ? existingCustody.armor : (aiConfig?.armor ?? 100),
                isAlive: true,
                isKia: false,
                isInvulnerable: false,
                action: "idle",
                type: aiConfig?.type ?? (isBoss ? "boss" : "operative"),
                dropsKeycard: isBoss ? true : Boolean(existingCustody.dropsKeycard || aiConfig?.dropsKeycard),
                timestamp: existingCustody.lastObservedTimestamp || Date.now(),
              };
              operativeMovementStates.set(targetSlotKey, targetMove);
            } else if (aiConfig) {
              // Update authoritative AI position from deterministic raid tick
              const currentRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(raidId) : 0;
              const pos = computeAIPosition(targetId, currentRaidTick);
              targetMove.x = pos.x;
              targetMove.z = pos.z;
              targetMove.timestamp = Date.now();
            }
            return { targetMove, isNewRegistration: false, isTerminal: false };
          }

          // Restrict target registration strictly to the server raid roster or known AI roster (Map.has check)
          if (!AI_ROSTER.has(targetId)) {
            return { targetMove: null, isNewRegistration: false, isTerminal: false };
          }

          // If no custody exists yet and target is in AI roster, initialize target record
          if (!targetMove) {
            const currentRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(raidId) : 0;
            const pos = computeAIPosition(targetId, currentRaidTick);
            targetMove = {
              x: pos.x,
              z: pos.z,
              health: aiConfig.health,
              armor: aiConfig.armor,
              isAlive: true,
              isKia: false,
              isInvulnerable: false,
              action: "idle",
              type: aiConfig.type,
              dropsKeycard: Boolean(aiConfig.dropsKeycard),
              timestamp: Date.now(),
            };
            operativeMovementStates.set(targetSlotKey, targetMove);
            if (rRec && rRec.operatives && !rRec.operatives[targetId]) {
              rRec.operatives[targetId] = {
                operativeId: targetId,
                admitted: true,
                isExtracted: false,
                cratesLooted: [],
                earnedCash: 0,
                health: aiConfig.health,
                armor: aiConfig.armor,
                extractedAtTick: 0,
                activeRaid: raidId,
                isAlive: true,
                isKia: false,
                dropsKeycard: Boolean(aiConfig.dropsKeycard),
                hasKeycard: Boolean(aiConfig.hasKeycard),
                inventoryRevision: 1,
                lastObservedX: pos.x,
                lastObservedZ: pos.z,
                lastObservedTimestamp: Date.now(),
              };
              isNewRegistration = true;
            }
          }
          return { targetMove, isNewRegistration, isTerminal: false };
        };

        const applyOperativeStrike = (ctx) => {
          const { ws, packet, targetId, kind, dmg, ackEventId } = ctx;
          const currentRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(ws.raidId) : 0;
          if (currentRaidTick > 54000) {
            return; // Raid deadline exceeded (tick 54,000): combat actions rejected
          }

          const slotKey = `${ws.raidId}:${ws.operativeId}`;

          const moveState = operativeMovementStates.get(slotKey) || ws.lastRelayedPos;
          if (!moveState) {
            return; // No accepted movement state on server: drop
          }

          const hasAxField = packet.data && Object.prototype.hasOwnProperty.call(packet.data, "attackerX");
          const hasAzField = packet.data && Object.prototype.hasOwnProperty.call(packet.data, "attackerZ");
          let strikeOriginX = moveState.x;
          let strikeOriginZ = moveState.z;

          if (kind === "shotgun" && ctx.shotRecord) {
            strikeOriginX = ctx.shotRecord.originX;
            strikeOriginZ = ctx.shotRecord.originZ;
          } else if (hasAxField || hasAzField) {
            // Field presence check: if either field was passed, both must be present, valid finite numbers
            if (!hasAxField || !hasAzField) {
              return; // Malformed / incomplete coordinates: drop packet!
            }
            const ax = packet.data.attackerX;
            const az = packet.data.attackerZ;
            if (typeof ax !== "number" || typeof az !== "number" || !Number.isFinite(ax) || !Number.isFinite(az)) {
              return; // Malformed coordinates: drop packet!
            }
            if (Math.abs(ax) > 79.05 || Math.abs(az) > 79.05) {
              return; // Strike origin out of map bounds: drop
            }
            const strikeDist = Math.hypot(ax - moveState.x, az - moveState.z);
            if (strikeDist > 2.0) {
              return; // Attacker coordinate deviates > 2.0m from server accepted position: drop packet!
            }
            strikeOriginX = ax;
            strikeOriginZ = az;
          }

          // 5. Validate target presence, life-state, and geometry
          const targetSlotKey = `${ws.raidId}:${targetId}`;
          const targetLookup = getOrRegisterTargetState(ws.raidId, targetId);
          if (targetLookup?.isTerminal) {
            return; // Reject strike against terminal (K.I.A.) custody!
          }
          const targetMove = targetLookup?.targetMove || operativeMovementStates.get(targetSlotKey);
          const isNewBossRegistration = Boolean(targetLookup?.isNewRegistration);
          if (!targetMove || !targetMove.isAlive) {
            return;
          }
          const distToTarget = Math.hypot(strikeOriginX - targetMove.x, strikeOriginZ - targetMove.z);
          const moveDistToTarget = Math.hypot(moveState.x - targetMove.x, moveState.z - targetMove.z);
          if (kind === "kick" && (distToTarget > 2.5 || moveDistToTarget > 2.5)) return; // Kick out of range
          if (kind === "shotgun" && (distToTarget > 18.0 || moveDistToTarget > 18.0)) return; // Shotgun out of range
          if (kind === "rifle" && (distToTarget > 35.0 || moveDistToTarget > 35.0)) return; // Rifle out of range
          if (checkContainerRayObstruction(strikeOriginX, strikeOriginZ, targetMove.x, targetMove.z, 1.0, 1.0)) {
            return; // Strike line of sight obstructed by container
          }

          // Validate attacker facing for shotgun attacks (cone dot >= 0.6)
          if (kind === "shotgun") {
            const facing = (ctx.shotRecord && typeof ctx.shotRecord.facing === "number")
              ? ctx.shotRecord.facing
              : packet.data?.attackerFacing;
            if (typeof facing === "number" && Number.isFinite(facing)) {
              const dx = targetMove.x - strikeOriginX;
              const dz = targetMove.z - strikeOriginZ;
              const forwardX = Math.sin(facing);
              const forwardZ = Math.cos(facing);
              const dot = (dx * forwardX + dz * forwardZ) / Math.max(0.001, distToTarget);
              if (dot < 0.6) {
                return; // Outside shotgun spread cone
              }
            }
          }

          // Validate attacker facing for kick attacks (symmetrical: forward attack cone dot >= 0.2)
          if (kind === "kick") {
            const facing = packet.data?.attackerFacing;
            if (typeof facing !== "number" || !Number.isFinite(facing)) {
              return;
            }
            const dx = targetMove.x - strikeOriginX;
            const dz = targetMove.z - strikeOriginZ;
            const forwardX = Math.sin(facing);
            const forwardZ = Math.cos(facing);
            const dot = (dx * forwardX + dz * forwardZ) / Math.max(0.001, distToTarget);
            if (dot < 0.2) {
              return; // Reject off-target kick
            }
          }

          // Validate attacker facing for rifle attacks (strictly symmetrical: dot > 0.96 and perpDist <= 1.2 required)
          if (kind === "rifle") {
            const facing = packet.data?.attackerFacing;
            if (typeof facing !== "number" || !Number.isFinite(facing)) {
              return;
            }
            const dx = targetMove.x - strikeOriginX;
            const dz = targetMove.z - strikeOriginZ;
            const forwardX = Math.sin(facing);
            const forwardZ = Math.cos(facing);
            const dot = (dx * forwardX + dz * forwardZ) / Math.max(0.001, distToTarget);
            const perpDist = Math.abs(dx * forwardZ - dz * forwardX);
            if (dot <= 0.96 || perpDist > 1.2) {
              return; // Reject off-target shot
            }
          }

          // Bounded roll invulnerability frames (12 frames ~ 200ms)
          const isRolling = targetMove.action === "roll";
          const rollElapsed = Date.now() - (targetMove.rollStartedAt || 0);
          const hasRollIframes = isRolling && rollElapsed <= 220 && targetMove.isInvulnerable === true;
          if (hasRollIframes) {
            return; // Deflected by active 12-frame roll invulnerability
          }

          // Standardized armor absorption and health damage with COMPLETE ATOMIC PERSISTENCE ROLLBACK
          const preHitHealth = targetMove.health ?? 100;
          const preHitArmor = targetMove.armor ?? 100;
          const preHitAlive = targetMove.isAlive ?? true;
          const preHitKia = targetMove.isKia ?? false;
          const preMoveSnapshot = JSON.parse(JSON.stringify(targetMove));

          const rRecTarget = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const oRecTarget = rRecTarget?.operatives?.[targetId];
          const preCustodySnapshot = oRecTarget ? JSON.parse(JSON.stringify(oRecTarget)) : null;

          targetMove.armor = preHitArmor;
          targetMove.health = preHitHealth;
          const absorbed = Math.min(targetMove.armor, dmg);
          targetMove.armor -= absorbed;
          const leftover = dmg - absorbed;
          targetMove.health = Math.max(0, targetMove.health - leftover);
          // Server combat damage immediately cancels any active stim treatment channel!
          targetMove.isUsingStim = false;
          targetMove.stimChannelStartedAt = 0;

          const callerOpStrike = rRecTarget?.operatives?.[ws.operativeId];
          const preCallerKeycardStrike = callerOpStrike ? Boolean(callerOpStrike.hasKeycard) : false;
          const isBossStrike = targetId === BOSS_CONFIG.id || targetMove.type === "boss" || targetMove.dropsKeycard;
          if (targetMove.health <= 0) {
            targetMove.health = 0;
            targetMove.isAlive = false;
            targetMove.isKia = true;
            if (preHitAlive && isBossStrike && callerOpStrike) {
              callerOpStrike.hasKeycard = true;
            }
          }

          try {
            if (oRecTarget) {
              oRecTarget.health = targetMove.health;
              oRecTarget.armor = targetMove.armor;
              oRecTarget.lastDamageTimestamp = Date.now();
              oRecTarget.unconsumedDamage = dmg;

              // Authoritatively break extraction hold custody in the same atomic transaction
              const curTick = Math.max(1, (targetMove.currentTick || 0), (settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(ws.raidId) : 0), ((oRecTarget?.rawLastReceivedTick || 0) + 1));
              if (typeof settlement.recordExtractionHold === "function") {
                settlement.recordExtractionHold(ws.raidId, targetId, 0, curTick, { inZone: false, damageTaken: dmg, skipSave: true });
              } else {
                oRecTarget.holdTicks = 0;
                oRecTarget.holdStartTick = undefined;
                oRecTarget.lastHoldTimestamp = undefined;
                oRecTarget.holdCompleted = false;
              }

              if (targetMove.health <= 0) {
                if (typeof settlement.recordOperativeKia === "function") {
                  settlement.recordOperativeKia(ws.raidId, targetId, "system");
                } else {
                  oRecTarget.isAlive = false;
                  oRecTarget.isKia = true;
                  if (typeof settlement.saveToDisk === "function") {
                    settlement.saveToDisk();
                  }
                }
              } else {
                if (typeof settlement.saveToDisk === "function") {
                  settlement.saveToDisk();
                }
              }
            }
            const confirmMsg = {
              eventId: `hit_confirm_${packet.eventId}`,
              type: "hit_confirmed",
              senderId: "server",
              senderName: "CENTRAL COMMAND",
              raidId: ws.raidId,
              timestamp: Date.now(),
              data: {
                targetId,
                targetHealth: targetMove.health,
                targetArmor: targetMove.armor,
                targetAlive: targetMove.isAlive,
                targetKia: targetMove.isKia,
                damage: dmg,
                kind: kind,
                killerId: targetMove.health <= 0 ? ws.operativeId : undefined,
              },
            };
            try { ws.send(JSON.stringify(confirmMsg)); } catch {}
            // Send AI life-state updates to all clients in the raid
            if (AI_ROSTER.has(targetId) || targetMove.type === "boss" || targetMove.type === "scav") {
              broadcastToRaid(ws.raidId, confirmMsg, ws);
            }
          } catch (saveErr) {
            // Atomic rollback on persistence failure: restore complete memory & custody snapshot cleanly
            for (const k of Object.keys(targetMove)) {
              delete targetMove[k];
            }
            Object.assign(targetMove, preMoveSnapshot);
            if (callerOpStrike) callerOpStrike.hasKeycard = preCallerKeycardStrike;
            if (isNewBossRegistration) {
              if (rRecTarget?.operatives?.[targetId]) {
                delete rRecTarget.operatives[targetId];
              }
              operativeMovementStates.delete(targetSlotKey);
            } else if (oRecTarget && preCustodySnapshot) {
              for (const k of Object.keys(oRecTarget)) {
                delete oRecTarget[k];
              }
              Object.assign(oRecTarget, preCustodySnapshot);
            }
            return;
          }

          packet.data.targetHealth = targetMove.health;
          packet.data.targetArmor = targetMove.armor;
          packet.data.targetAlive = targetMove.isAlive;
          if (targetMove.health <= 0) {
            packet.data.killerId = ws.operativeId;
          }
          // Authoritative stamp: this strike was validated AND persisted by the relay
          // authority. Receivers apply target vitals ONLY on this marker.
          packet.data.serverAuthoritative = true;

          // 6. Grant target operative movement budget for physical knockback ONLY after complete verification (strictly kick only)

          if (kind === "kick") {
            const rawKnockX = packet.data?.knockX;
            const rawKnockZ = packet.data?.knockZ;
            const knockAllowance = Math.min(5.0, Math.hypot(rawKnockX || 0, rawKnockZ || 0) || 4.5);
            if (!AI_ROSTER.has(targetId)) {
              targetMove.budget = Math.min(8.0, targetMove.budget + knockAllowance);
            }
          }
          return true;
        };

        // Broadcast an authoritative message to every authenticated socket in the raid.
        const broadcastToRaid = (raidId, msg, senderWs) => {
          try {
            const out = JSON.stringify(msg);
            for (const client of wss.clients) {
              if (client !== senderWs && client.readyState === 1 && client.authenticated && client.raidId === raidId) {
                try {
                  client.send(out);
                } catch {}
              }
            }
          } catch {}
        };

      if (packet.type === "hit") {
        const callerRaid = ws.raidId && typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(ws.raidId) : null;
        const callerOp = callerRaid?.operatives?.[ws.operativeId];
        if (!callerOp || callerOp.isExtracted || callerOp.isKia || callerOp.isAlive === false || callerRaid?.status === "concluded") {
          return;
        }
        if (!packet.eventId || typeof packet.eventId !== "string" || !packet.eventId.trim()) {
          return;
        }
        if (typeof packet.timestamp !== "number" || !Number.isFinite(packet.timestamp) || packet.timestamp <= 0 || packet.timestamp > Date.now() + 2000) {
          return;
        }
        const rawKind = packet.data?.kind;
        if (rawKind !== "kick" && rawKind !== "rifle" && rawKind !== "shotgun") {
          return; // Strictly drop hit with missing or invalid attack kind
        }

        // 1. Event deduplication check
        const opKey = `${ws.raidId}:${ws.operativeId}`;
        let seenEvents = raidOperativeSeenEvents.get(opKey);
        if (!seenEvents) {
          seenEvents = new Set();
          raidOperativeSeenEvents.set(opKey, seenEvents);
        }
        if (seenEvents.has(packet.eventId)) return;
        seenEvents.add(packet.eventId);
        if (seenEvents.size > 2000) {
          const first = seenEvents.values().next().value;
          if (first) seenEvents.delete(first);
        }

        // 2. Reject self-target
        const targetId = packet.data?.targetId;
        if (!targetId || typeof targetId !== "string" || targetId === ws.operativeId) {
          return;
        }

        // 3. Validate damage > 0 and bounded strictly by weapon type (rifle <= 24, kick <= 35, shotgun <= 80)
        const maxAllowedDmg = rawKind === "kick" ? 35 : (rawKind === "shotgun" ? 80 : 24);
        const dmg = packet.data?.damage;
        if (typeof dmg !== "number" || !Number.isFinite(dmg) || dmg <= 0 || dmg > maxAllowedDmg) {
          return;
        }

        // 4. Rate-limit attacker cadence with burst allowance for network jitter
        const attackTimes = getRaidOperativeAttackTimes(ws.raidId, ws.operativeId);
        const hitNow = Date.now();
        if (rawKind === "kick") {
          if (!attackTimes.kickBucket) {
            attackTimes.kickBucket = { tokens: 1.5, lastTime: hitNow };
          } else {
            const elapsed = Math.max(0, hitNow - attackTimes.kickBucket.lastTime);
            attackTimes.kickBucket.tokens = Math.min(1.5, attackTimes.kickBucket.tokens + elapsed / 600);
            attackTimes.kickBucket.lastTime = Math.max(attackTimes.kickBucket.lastTime, hitNow);
          }
          if (attackTimes.kickBucket.tokens < 1.0) return;
          attackTimes.kickBucket.tokens -= 1.0;
          attackTimes.kick = hitNow;
        } else if (rawKind === "shotgun") {
          const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
          if (weaponState.isReloading && hitNow < weaponState.reloadEnd) {
            return; // Operative is reloading: cannot fire
          }
          const shotId = packet.data?.shotId;
          const shotKey = shotId ? `${ws.raidId}:${ws.operativeId}:${shotId}` : null;
          let shotRecord = shotKey ? activeShotgunShots.get(shotKey) : null;
          const curMove = operativeMovementStates.get(opKey) || ws.lastRelayedPos;
          const curOriginX = typeof packet.data?.attackerX === "number" ? packet.data.attackerX : (curMove ? curMove.x : 0);
          const curOriginZ = typeof packet.data?.attackerZ === "number" ? packet.data.attackerZ : (curMove ? curMove.z : 0);

          if (shotRecord) {
            if (hitNow - shotRecord.createdAt > 150) return; // Shot expired
            if (shotRecord.targetsHit.has(targetId)) return; // Target already damaged by this shell
            if (shotRecord.targetsHit.size >= 6) return; // Max 6 targets per shell
            const originDist = Math.hypot(curOriginX - shotRecord.originX, curOriginZ - shotRecord.originZ);
            if (originDist > 1.5) return;
          } else {
            if (weaponState.shotgunAmmo <= 0) return;
            if (!attackTimes.shotgunBucket) {
              attackTimes.shotgunBucket = { tokens: 1.5, lastTime: hitNow };
            } else {
              const elapsed = Math.max(0, hitNow - attackTimes.shotgunBucket.lastTime);
              attackTimes.shotgunBucket.tokens = Math.min(2.0, attackTimes.shotgunBucket.tokens + elapsed / 350);
              attackTimes.shotgunBucket.lastTime = Math.max(attackTimes.shotgunBucket.lastTime, hitNow);
            }
            if (attackTimes.shotgunBucket.tokens < 1.0) return;
            attackTimes.shotgunBucket.tokens -= 1.0;
            attackTimes.shotgun = hitNow;
            attackTimes.lastShotgunTime = hitNow;
            if (shotId) attackTimes.lastShotgunShotId = shotId;
            weaponState.shotgunAmmo = Math.max(0, weaponState.shotgunAmmo - 1);
            weaponState.ammo = weaponState.selectedWeapon === "shotgun" ? weaponState.shotgunAmmo : weaponState.rifleAmmo;
            setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo);
          }
        } else {
          const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
          if (weaponState.isReloading && hitNow < weaponState.reloadEnd) {
            return; // Operative is reloading: cannot fire
          }
          if (weaponState.rifleAmmo <= 0) {
            return; // Operative out of rifle ammunition: cannot fire
          }
          if (!attackTimes.rifleBucket) {
            attackTimes.rifleBucket = { tokens: 2.0, lastTime: hitNow };
          } else {
            const elapsed = Math.max(0, hitNow - attackTimes.rifleBucket.lastTime);
            attackTimes.rifleBucket.tokens = Math.min(2.5, attackTimes.rifleBucket.tokens + elapsed / 130);
            attackTimes.rifleBucket.lastTime = Math.max(attackTimes.rifleBucket.lastTime, hitNow);
          }
          if (attackTimes.rifleBucket.tokens < 1.0) return;
          attackTimes.rifleBucket.tokens -= 1.0;
          attackTimes.rifle = hitNow;
          weaponState.rifleAmmo = Math.max(0, weaponState.rifleAmmo - 1);
          weaponState.ammo = weaponState.selectedWeapon === "rifle" ? weaponState.rifleAmmo : weaponState.shotgunAmmo;
          setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo);
        }

        const shotId = packet.data?.shotId;
        const shotKey = shotId ? `${ws.raidId}:${ws.operativeId}:${shotId}` : null;
        const curShotRecord = (rawKind === "shotgun" && shotKey) ? activeShotgunShots.get(shotKey) : null;

        const strikeApplied = applyOperativeStrike({
          ws,
          packet,
          targetId,
          kind: rawKind,
          dmg,
          ackEventId: packet.eventId,
          shotRecord: curShotRecord,
        });

        if (strikeApplied && rawKind === "shotgun") {
          if (curShotRecord) {
            curShotRecord.targetsHit.add(targetId);
          } else if (shotKey) {
            cleanExpiredShotgunShots();
            const curMove = operativeMovementStates.get(opKey) || ws.lastRelayedPos;
            const ax = typeof packet.data?.attackerX === "number" ? packet.data.attackerX : (curMove ? curMove.x : 0);
            const az = typeof packet.data?.attackerZ === "number" ? packet.data.attackerZ : (curMove ? curMove.z : 0);
            const facing = typeof packet.data?.attackerFacing === "number" ? packet.data.attackerFacing : 0;
            activeShotgunShots.set(shotKey, {
              createdAt: hitNow,
              originX: ax,
              originZ: az,
              facing,
              targetsHit: new Set([targetId]),
            });
          }
        }
        if (!strikeApplied) {
          // Validation or persistence FAILED: drop the strike entirely — receivers must
          // never see client-supplied damage that the authoritative relay rejected (not
          // as result-field-carrying packets, and not as predictions either: a rejected
          // strike is a rejected strike).
          return;
        }
      }

      if (packet.type === "kick_action") {
        // ONE kick action = ONE cooldown charge = ONE authoritative validation batch.
        // The client sends the complete target set (machines + rivals) as a single
        // packet so the melee action is validated atomically; per-target packets would
        // re-charge the shared kick cooldown and desync optimistic predictions.
        // Bounded, de-duplicated target lists are validated BEFORE any state mutation
        // (including the cooldown charge), so a malformed batch never consumes the
        // actor's melee recovery.
        if (!packet.eventId || typeof packet.eventId !== "string" || !packet.eventId.trim()) {
          return;
        }
        if (typeof packet.timestamp !== "number" || !Number.isFinite(packet.timestamp) || packet.timestamp <= 0 || packet.timestamp > Date.now() + 2000) {
          return;
        }
        if (typeof packet.raidId !== "string" || packet.raidId !== ws.raidId) {
          return;
        }

        // Event deduplication (covers every target of the action at once)
        const opKey = `${ws.raidId}:${ws.operativeId}`;
        let seenEvents = raidOperativeSeenEvents.get(opKey);
        if (!seenEvents) {
          seenEvents = new Set();
          raidOperativeSeenEvents.set(opKey, seenEvents);
        }
        if (seenEvents.has(packet.eventId)) return;
        seenEvents.add(packet.eventId);
        if (seenEvents.size > 2000) {
          const first = seenEvents.values().next().value;
          if (first) seenEvents.delete(first);
        }

        const currentRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(ws.raidId) : 0;
        if (currentRaidTick > 54000) {
          return; // Raid deadline exceeded (tick 54,000): combat actions rejected
        }

        const moveState = operativeMovementStates.get(`${ws.raidId}:${ws.operativeId}`) || ws.lastRelayedPos;
        if (!moveState) {
          return; // No accepted movement state on server: drop
        }

        // Strike origin: hard server truth by default; client claims must match within 2.0m
        const origX = packet.data?.attackerX;
        const origZ = packet.data?.attackerZ;
        let strikeOriginX = moveState.x;
        let strikeOriginZ = moveState.z;
        if (origX !== undefined || origZ !== undefined) {
          if (typeof origX !== "number" || typeof origZ !== "number" || !Number.isFinite(origX) || !Number.isFinite(origZ) || Math.abs(origX) > 79.05 || Math.abs(origZ) > 79.05) {
            return;
          }
          if (Math.hypot(origX - moveState.x, origZ - moveState.z) > 2.0) {
            return; // Attacker coordinate deviates > 2.0m from server accepted position: drop
          }
          strikeOriginX = origX;
          strikeOriginZ = origZ;
        }
        const facing = packet.data?.attackerFacing;
        if (typeof facing !== "number" || !Number.isFinite(facing)) {
          return;
        }

        // Bounded target lists before ANY mutation: one action cannot exceed physical
        // world size, and repeated target IDs are rejected outright (each entry would
        // multi-apply damage / poison custody result dedup).
        const machinesForBatch = getRaidMachines(ws.raidId);
        const rawMachineTargets = Array.isArray(packet.data?.machineTargets) ? packet.data.machineTargets : [];
        const rawRivalTargets = Array.isArray(packet.data?.rivalTargets) ? packet.data.rivalTargets : [];

        // Authoritative correction for REJECTED batches (oversized / duplicate /
        // invalid targets): clients optimistically predicted damage for every
        // submitted target — return custody truth for each so the misprediction is
        // reconciled immediately, never silently retained.
        const sendRejectedKickCorrection = (reason) => {
          try {
            const corr = {
              eventId: `${packet.eventId}_rej_${Date.now()}`,
              type: "kick_action_rejected",
              senderId: "server",
              senderName: "CENTRAL COMMAND",
              raidId: ws.raidId,
              timestamp: Date.now(),
              serverAuthoritative: true,
              data: {
                actionEventId: packet.eventId,
                reason,
                machineCustody: rawMachineTargets
                  .map((t) => t && t.id)
                  .filter((id) => typeof id === "string")
                  .map((id) => {
                    const m = machinesForBatch.find((x) => x.id === id);
                    return m ? { id, health: m.health, isAlive: m.isAlive, x: m.x, z: m.z, maxHealth: m.maxHealth || m.health, vitalsSeq: m.vitalsSeq || 0 } : null;
                  })
                  .filter(Boolean),
              },
            };
            ws.send(JSON.stringify(corr));
          } catch {}
        };

        if (rawMachineTargets.length > 24 || rawRivalTargets.length > 8) {
          sendRejectedKickCorrection("oversized_batch");
          return;
        }
        const seenIds = new Set();
        for (const t of [...rawMachineTargets, ...rawRivalTargets]) {
          const tid = t && typeof t === "object" ? t.id : undefined;
          if (typeof tid !== "string" || !tid || seenIds.has(tid)) {
            sendRejectedKickCorrection("duplicate_or_invalid_target");
            return;
          }
          seenIds.add(tid);
        }

        // Charge the melee cooldown ONCE for the entire action (600ms bucket, burst 1.5).
        const attackTimes = getRaidOperativeAttackTimes(ws.raidId, ws.operativeId);
        const hitNow = Date.now();
        if (!attackTimes.kickBucket) {
          attackTimes.kickBucket = { tokens: 1.5, lastTime: hitNow };
        } else {
          const elapsed = Math.max(0, hitNow - attackTimes.kickBucket.lastTime);
          attackTimes.kickBucket.tokens = Math.min(1.5, attackTimes.kickBucket.tokens + elapsed / 600);
          attackTimes.kickBucket.lastTime = Math.max(attackTimes.kickBucket.lastTime, hitNow);
        }
        if (attackTimes.kickBucket.tokens < 1.0) {
          sendRejectedKickCorrection("cooldown_rejection");
          return;
        }
        attackTimes.kickBucket.tokens -= 1.0;
        attackTimes.kick = hitNow;

        const machines = machinesForBatch;
        const machineTargets = rawMachineTargets;
        const rivalTargets = rawRivalTargets;

        // ---- Machine targets: geometry validated against SERVER authority ----
        for (const t of machineTargets) {
          if (!t || typeof t !== "object") continue;
          if (typeof t.id !== "string" || !t.id) continue;
          const m = machines.find((x) => x.id === t.id);
          if (!m || !m.isAlive) continue;
          if (typeof t.damage !== "number" || !Number.isFinite(t.damage) || t.damage <= 0) continue;
          const safeDmg = Math.min(50, t.damage);

          // Authoritative target position (drones: deterministic equation; turrets: custody)
          let targetX;
          let targetZ;
          if (m.type === "drone") {
            const p = computeMachineServerPosition(m, currentRaidTick);
            targetX = p.x;
            targetZ = p.z;
          } else {
            targetX = m.x;
            targetZ = m.z;
          }
          const distToM = Math.hypot(strikeOriginX - targetX, strikeOriginZ - targetZ);
          if (distToM <= 0.001 || distToM > 2.8) {
            // Rejected target: correct the client's optimistic prediction with custody
            try {
              ws.send(JSON.stringify({
                eventId: `${packet.eventId}_mrej_${m.id}`,
                type: "machine_hit",
                senderId: ws.operativeId,
                senderName: packet.senderName || "OPERATIVE",
                raidId: ws.raidId,
                timestamp: Date.now(),
                serverAuthoritative: true,
                data: { machineId: m.id, damage: 0, machineHealth: m.health, machineAlive: m.isAlive, kind: "kick", rejected: true, targetX, targetZ, vitalsSeq: m.vitalsSeq || 0, maxHealth: m.maxHealth || m.health },
              }));
            } catch {}
            continue;
          }
          const dx = targetX - strikeOriginX;
          const dz = targetZ - strikeOriginZ;
          const forwardX = Math.sin(facing);
          const forwardZ = Math.cos(facing);
          const dot = (dx * forwardX + dz * forwardZ) / distToM;
          if (dot < 0.2) continue; // Off-target kick (forward attack cone)
          const mY = typeof m.y === "number" ? m.y : 1.0;
          if (checkContainerRayObstruction(strikeOriginX, strikeOriginZ, targetX, targetZ, 1.0, mY)) continue;

          // Atomic custody application with rollback on persistence failure:
          // health + alive + vitalsSeq are captured, mutated, SAVED together, and
          // restored together — the reply (success OR rejection) carries the COMMITTED
          // sequence only; no unsaved authoritative sequence is ever emitted.
          const preDmgHealth = m.health;
          const preDmgAlive = m.isAlive;
          const preDmgSeq = m.vitalsSeq || 0;
          const rRecord = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const callerOpKick = rRecord?.operatives?.[ws.operativeId];
          const preCallerKeycardKick = callerOpKick ? Boolean(callerOpKick.hasKeycard) : false;
          const isBossKick = m.id.includes("boss") || m.type === "boss" || m.dropsKeycard;
          m.health = Math.max(0, m.health - safeDmg);
          m.vitalsSeq = nextVitalsSeq(m.id, ws.raidId);
          if (m.health <= 0) {
            m.isAlive = false;
            if (preDmgAlive && isBossKick && callerOpKick) {
              callerOpKick.hasKeycard = true;
            }
          }
          try {
            if (rRecord) {
              if (!rRecord.machines) rRecord.machines = {};
              rRecord.machines[m.id] = { health: m.health, isAlive: m.isAlive, vitalsSeq: m.vitalsSeq };
              if (typeof settlement.saveToDisk === "function") settlement.saveToDisk();
            }
          } catch (saveErr) {
            m.health = preDmgHealth;
            m.isAlive = preDmgAlive;
            m.vitalsSeq = preDmgSeq;
            if (callerOpKick) callerOpKick.hasKeycard = preCallerKeycardKick;
            if (rRecord?.machines) rRecord.machines[m.id] = { health: preDmgHealth, isAlive: preDmgAlive, vitalsSeq: preDmgSeq };
            // FAILED SAVE = strike rejected: an authoritative correction restores the
            // client's optimistic prediction to COMMITTED custody (pre-save sequence).
            try {
              ws.send(JSON.stringify({
                eventId: `${packet.eventId}_mrej_${m.id}`,
                type: "machine_hit",
                senderId: ws.operativeId,
                senderName: packet.senderName || (ws.operativeId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE GHOST-1"),
                raidId: ws.raidId,
                timestamp: Date.now(),
                serverAuthoritative: true,
                data: { machineId: m.id, damage: 0, machineHealth: preDmgHealth, machineAlive: preDmgAlive, kind: "kick", rejected: true, maxHealth: m.maxHealth || m.health, vitalsSeq: preDmgSeq },
              }));
            } catch {}
            continue;
          }

          // Complete server result contract: rivals validate peer machine hits against
          // the attacker's facing and position (symmetrical combat gauntlet), so the
          // authoritative broadcast must carry the SAME geometric fields the legacy
          // machine_hit stream does — otherwise peers drop server custody updates.
          const machineMsg = {
            eventId: `${packet.eventId}_m_${m.id}`,
            type: "machine_hit",
            senderId: ws.operativeId,
            senderName: packet.senderName || (ws.operativeId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE GHOST-1"),
            raidId: ws.raidId,
            timestamp: Date.now(),
            serverAuthoritative: true,
            data: {
              machineId: m.id,
              damage: safeDmg,
              machineHealth: m.health,
              machineAlive: m.isAlive,
              kind: "kick",
              vitalsSeq: m.vitalsSeq || 0,
              maxHealth: m.maxHealth || m.health,
              attackerFacing: facing,
              attackerX: strikeOriginX,
              attackerZ: strikeOriginZ,
              targetX,
              targetZ,
            },
          };
          try { ws.send(JSON.stringify(machineMsg)); } catch {}
          broadcastToRaid(ws.raidId, machineMsg, ws);
        }

        // ---- Rival targets: authoritative operative strikes (shared validation) ----
        for (const t of rivalTargets) {
          if (!t || typeof t !== "object") continue;
          const targetId = typeof t.id === "string" ? t.id : null;
          if (!targetId || targetId === ws.operativeId) continue;
          const dmgR = typeof t.damage === "number" && Number.isFinite(t.damage) ? Math.min(Math.max(1, t.damage), 35) : 0;
          if (dmgR <= 0) continue;
          const knockX = typeof t.knockX === "number" && Number.isFinite(t.knockX) ? t.knockX : 4.5 * Math.sin(facing);
          const knockZ = typeof t.knockZ === "number" && Number.isFinite(t.knockZ) ? t.knockZ : 4.5 * Math.cos(facing);
          const strikePacket = {
            eventId: `${packet.eventId}_r_${targetId}`,
            type: "hit",
            senderId: ws.operativeId,
            senderName: packet.senderName || (ws.operativeId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE GHOST-1"),
            raidId: ws.raidId,
            timestamp: packet.timestamp,
            data: {
              targetId,
              damage: dmgR,
              knockX,
              knockZ,
              kind: "kick",
              attackerFacing: facing,
              attackerX: strikeOriginX,
              attackerZ: strikeOriginZ,
            },
          };
          const applied = applyOperativeStrike({ ws, packet: strikePacket, targetId, kind: "kick", dmg: dmgR, ackEventId: strikePacket.eventId });
          if (applied) {
            // Peers receive the authoritative result as a classic relayed 'hit' packet
            // (applyOperativeStrike already stamped targetHealth/targetArmor/targetAlive).
            broadcastToRaid(ws.raidId, strikePacket, ws);
          }
        }
        return; // kick_action fully handled: never fall through to the generic relay forward
      }

      if (packet.type === "machine_hit") {
        const callerRaid = ws.raidId && typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(ws.raidId) : null;
        const callerOp = callerRaid?.operatives?.[ws.operativeId];
        if (!callerOp || callerOp.isExtracted || callerOp.isKia || callerOp.isAlive === false || callerRaid?.status === "concluded") {
          return;
        }
        if (!packet.data?.machineId) return;
        delete packet.data.machineHealth;
        delete packet.data.machineAlive;

        const currentRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(ws.raidId) : 0;
        if (currentRaidTick > 54000) {
          return; // Raid deadline exceeded (tick 54,000): machine combat actions rejected
        }

        if (!packet.eventId || typeof packet.eventId !== "string" || !packet.eventId.trim()) {
          return;
        }
        const serverNow = Date.now();
        if (typeof packet.timestamp !== "number" || !Number.isFinite(packet.timestamp) || isNaN(packet.timestamp) || packet.timestamp <= 0 || packet.timestamp > serverNow + 2000) {
          return;
        }
        const opKey = `${ws.raidId}:${ws.operativeId}`;
        let seenEvents = raidOperativeSeenEvents.get(opKey);
        if (!seenEvents) {
          seenEvents = new Set();
          raidOperativeSeenEvents.set(opKey, seenEvents);
        }
        if (seenEvents.has(packet.eventId)) return;
        seenEvents.add(packet.eventId);
        if (seenEvents.size > 2000) {
          const first = seenEvents.values().next().value;
          if (first) seenEvents.delete(first);
        }
        const machines = getRaidMachines(ws.raidId);
        const m = machines.find((x) => x.id === packet.data.machineId);

        const rawKind = packet.data.kind;
        if (rawKind !== "kick" && rawKind !== "rifle" && rawKind !== "shotgun") {
          return; // Strictly reject unknown kind
        }
        const kind = rawKind;

        const sendRejectionSync = (machineObj) => {
          try {
            // Rejection = custody stands: the reply carries the COMMITTED sequence
            // (never an unsaved advance) so the client's prediction reconciles to
            // durable truth without emitting an authoritative version of nothing.
            ws.send(JSON.stringify({
              eventId: packet.eventId,
              type: "machine_hit",
              senderId: ws.operativeId,
              senderName: packet.senderName || (ws.operativeId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE ALPHA"),
              raidId: ws.raidId,
              timestamp: Date.now(),
              serverAuthoritative: true,
              data: {
                machineId: packet.data.machineId,
                damage: 0,
                machineHealth: machineObj ? machineObj.health : 0,
                machineAlive: machineObj ? machineObj.isAlive : false,
                kind,
                rejected: true,
                maxHealth: machineObj ? (machineObj.maxHealth || machineObj.health) : undefined,
                vitalsSeq: machineObj ? machineObj.vitalsSeq : undefined,
              },
            }));
          } catch {}
        };

        if (!m || !m.isAlive) {
          sendRejectionSync(m);
          return;
        }
        const rawDmg = packet.data.damage;
        const facing = packet.data.attackerFacing;
        if (typeof facing !== "number" || !Number.isFinite(facing)) {
          sendRejectionSync(m);
          return;
        }
        if (typeof rawDmg !== "number" || !Number.isFinite(rawDmg) || rawDmg <= 0) {
          sendRejectionSync(m);
          return;
        }
        const safeDmg = kind === "kick" ? Math.min(rawDmg, 50) : (kind === "shotgun" ? Math.min(rawDmg, 80) : Math.min(rawDmg, 24));
        const currentPos = ws.lastRelayedPos || (ws.operativeId === "op_bravo_1" ? { x: 50, z: -50 } : { x: -50, z: -50 });
        let targetX = m.x;
        let targetZ = m.z;
        if (m.type === "drone") {
          // Server-authoritative drone position from the deterministic patrol equation —
          // hit geometry is validated against the computed position, never against a
          // client-claimed position inside the patrol ellipse.
          const serverRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(ws.raidId) : 0;
          const deterministicPos = computeMachineServerPosition(m, serverRaidTick);
          targetX = deterministicPos.x;
          targetZ = deterministicPos.z;
        }
        const distToM = Math.hypot(currentPos.x - targetX, currentPos.z - targetZ);
        let attackTimes = raidOperativeAttackTimes.get(opKey);
        if (!attackTimes) {
          attackTimes = { kick: 0, rifle: 0 };
          raidOperativeAttackTimes.set(opKey, attackTimes);
        }
        const now = Date.now();
        if (kind === "kick") {
          if (distToM > 3.0 || distToM <= 0.001) { sendRejectionSync(m); return; }
          if (!attackTimes.kickBucket) {
            attackTimes.kickBucket = { tokens: 1.5, lastTime: now };
          } else {
            const elapsed = Math.max(0, now - attackTimes.kickBucket.lastTime);
            attackTimes.kickBucket.tokens = Math.min(1.5, attackTimes.kickBucket.tokens + elapsed / 600);
            attackTimes.kickBucket.lastTime = Math.max(attackTimes.kickBucket.lastTime, now);
          }
          if (attackTimes.kickBucket.tokens < 1.0) { sendRejectionSync(m); return; }
          attackTimes.kickBucket.tokens -= 1.0;
          attackTimes.kick = now;
          const dx = targetX - currentPos.x;
          const dz = targetZ - currentPos.z;
          const forwardX = Math.sin(facing);
          const forwardZ = Math.cos(facing);
          const dot = (dx * forwardX + dz * forwardZ) / distToM;
          if (dot < 0.2) { sendRejectionSync(m); return; }
          const mY = typeof m.y === "number" ? m.y : 1.0;
          if (checkContainerRayObstruction(currentPos.x, currentPos.z, targetX, targetZ, 1.0, mY)) { sendRejectionSync(m); return; }
          attackTimes.kick = now;
        } else if (kind === "shotgun") {
          const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
          if (weaponState.isReloading && now < weaponState.reloadEnd) {
            sendRejectionSync(m);
            return; // Operative is reloading: cannot fire
          }
          const shotId = packet.data?.shotId;
          const shotKey = shotId ? `${ws.raidId}:${ws.operativeId}:${shotId}` : null;
          let shotRecord = shotKey ? activeShotgunShots.get(shotKey) : null;
          let isInitialMachineShot = false;

          const attackerX = typeof packet.data?.attackerX === "number" ? packet.data.attackerX : currentPos.x;
          const attackerZ = typeof packet.data?.attackerZ === "number" ? packet.data.attackerZ : currentPos.z;
          const attackerFacing = typeof packet.data?.attackerFacing === "number" ? packet.data.attackerFacing : facing;

          if (shotRecord) {
            if (now - shotRecord.createdAt > 150) { sendRejectionSync(m); return; }
            if (shotRecord.targetsHit.has(m.id)) { sendRejectionSync(m); return; }
            if (shotRecord.targetsHit.size >= 6) { sendRejectionSync(m); return; }
            const originDist = Math.hypot(attackerX - shotRecord.originX, attackerZ - shotRecord.originZ);
            if (originDist > 1.5) { sendRejectionSync(m); return; }
          } else {
            if (weaponState.shotgunAmmo <= 0) {
              sendRejectionSync(m);
              return; // Operative out of shotgun ammunition: cannot fire
            }
            if (!attackTimes.shotgunBucket) {
              attackTimes.shotgunBucket = { tokens: 1.5, lastTime: now };
            } else {
              const elapsed = Math.max(0, now - attackTimes.shotgunBucket.lastTime);
              attackTimes.shotgunBucket.tokens = Math.min(2.0, attackTimes.shotgunBucket.tokens + elapsed / 350);
              attackTimes.shotgunBucket.lastTime = Math.max(attackTimes.shotgunBucket.lastTime, now);
            }
            if (attackTimes.shotgunBucket.tokens < 1.0) { sendRejectionSync(m); return; }
            attackTimes.shotgunBucket.tokens -= 1.0;
            attackTimes.shotgun = now;
            attackTimes.lastShotgunTime = now;
            if (shotId) attackTimes.lastShotgunShotId = shotId;
            weaponState.shotgunAmmo = Math.max(0, weaponState.shotgunAmmo - 1);
            weaponState.ammo = weaponState.selectedWeapon === "shotgun" ? weaponState.shotgunAmmo : weaponState.rifleAmmo;
            setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo);
            isInitialMachineShot = true;
          }

          const effOriginX = shotRecord ? shotRecord.originX : attackerX;
          const effOriginZ = shotRecord ? shotRecord.originZ : attackerZ;
          const effFacing = (shotRecord && typeof shotRecord.facing === "number") ? shotRecord.facing : attackerFacing;

          const distToM = Math.hypot(targetX - effOriginX, targetZ - effOriginZ);
          if (distToM > 18.0 || distToM <= 0.001) { sendRejectionSync(m); return; }

          const dx = targetX - effOriginX;
          const dz = targetZ - effOriginZ;
          const forwardX = Math.sin(effFacing);
          const forwardZ = Math.cos(effFacing);
          const dot = (dx * forwardX + dz * forwardZ) / distToM;
          if (dot < 0.6) {
            sendRejectionSync(m);
            return;
          }
          const mY = typeof m.y === "number" ? m.y : (m.type === "drone" ? 3.5 : 1.0);
          if (checkContainerRayObstruction(effOriginX, effOriginZ, targetX, targetZ, 1.0, mY)) {
            sendRejectionSync(m);
            return;
          }

          if (shotRecord) {
            shotRecord.targetsHit.add(m.id);
          } else if (isInitialMachineShot && shotKey) {
            cleanExpiredShotgunShots();
            activeShotgunShots.set(shotKey, {
              createdAt: now,
              originX: effOriginX,
              originZ: effOriginZ,
              facing: effFacing,
              targetsHit: new Set([m.id]),
            });
          }
        } else {
          const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
          if (weaponState.isReloading && (weaponState.reloadingWeapon === "rifle" || !weaponState.reloadingWeapon) && now < weaponState.reloadEnd) {
            sendRejectionSync(m);
            return; // Operative is reloading: cannot fire
          }
          if (weaponState.rifleAmmo <= 0) {
            sendRejectionSync(m);
            return; // Operative out of rifle ammunition: cannot fire
          }
          if (distToM > 35.0 || distToM <= 0.001) { sendRejectionSync(m); return; }
          if (!attackTimes.rifleBucket) {
            attackTimes.rifleBucket = { tokens: 2.0, lastTime: now };
          } else {
            const elapsed = Math.max(0, now - attackTimes.rifleBucket.lastTime);
            attackTimes.rifleBucket.tokens = Math.min(2.5, attackTimes.rifleBucket.tokens + elapsed / 130);
            attackTimes.rifleBucket.lastTime = Math.max(attackTimes.rifleBucket.lastTime, now);
          }
          if (attackTimes.rifleBucket.tokens < 1.0) { sendRejectionSync(m); return; }
          attackTimes.rifleBucket.tokens -= 1.0;
          attackTimes.rifle = now;
          weaponState.rifleAmmo = Math.max(0, weaponState.rifleAmmo - 1);
          weaponState.ammo = weaponState.selectedWeapon === "rifle" ? weaponState.rifleAmmo : weaponState.shotgunAmmo;
          setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo);
          const dx = targetX - currentPos.x;
          const dz = targetZ - currentPos.z;
          const forwardX = Math.sin(facing);
          const forwardZ = Math.cos(facing);
          const dot = (dx * forwardX + dz * forwardZ) / distToM;
          const perpDist = Math.abs(dx * forwardZ - dz * forwardX);
          if (dot <= 0.96 || perpDist > 1.2) {
            sendRejectionSync(m);
            return;
          }
          const mY = typeof m.y === "number" ? m.y : (m.type === "drone" ? 3.5 : 1.0);
          if (checkContainerRayObstruction(currentPos.x, currentPos.z, targetX, targetZ, 1.0, mY)) {
            sendRejectionSync(m);
            return;
          }
          attackTimes.rifle = now;
        }
        const preDmgHealth = m.health;
        const preDmgAlive = m.isAlive;
        const preDmgSeq = m.vitalsSeq || 0;
        const rRecord = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
        const callerOpMach = rRecord?.operatives?.[ws.operativeId];
        const preCallerKeycard = callerOpMach ? Boolean(callerOpMach.hasKeycard) : false;
        const isBoss = m.id.includes("boss") || m.type === "boss" || m.dropsKeycard;
        m.health = Math.max(0, m.health - safeDmg);
        if (m.health <= 0) {
          m.isAlive = false;
          if (preDmgAlive && isBoss && callerOpMach) {
            callerOpMach.hasKeycard = true;
          }
        }
        // Sequence advances ONCE, BEFORE the durable save — health, alive, and vitalsSeq
        // persist in the SAME transaction; the durable copy can never trail the live
        // sequence (which would make valid recovery updates look stale to clients).
        m.vitalsSeq = nextVitalsSeq(m.id, ws.raidId);
        try {
          if (rRecord) {
            if (!rRecord.machines) rRecord.machines = {};
            rRecord.machines[m.id] = { health: m.health, isAlive: m.isAlive };
            if (rRecord.machines[m.id]) rRecord.machines[m.id].vitalsSeq = m.vitalsSeq;
            if (typeof settlement.saveToDisk === "function") {
              settlement.saveToDisk();
            }
          }
        } catch (saveErr) {
          m.health = preDmgHealth;
          m.isAlive = preDmgAlive;
          m.vitalsSeq = preDmgSeq;
          if (callerOpMach) callerOpMach.hasKeycard = preCallerKeycard;
          if (rRecord?.machines) {
            rRecord.machines[m.id] = { health: preDmgHealth, isAlive: preDmgAlive };
            if (rRecord.machines[m.id]) rRecord.machines[m.id].vitalsSeq = preDmgSeq;
          }
          sendRejectionSync(m);
          return;
        }
        packet.data.vitalsSeq = m.vitalsSeq;
        packet.data.damage = safeDmg;
        packet.data.machineHealth = m.health;
        packet.data.machineAlive = m.isAlive;
        // Server-owned maxHealth: the relayed result carries CUSTODY maxHealth (never
        // a client-supplied value) so adopted custody matches the server on every node.
        packet.data.maxHealth = (typeof m.maxHealth === "number" && m.maxHealth > 0 && Number.isFinite(m.maxHealth)) ? m.maxHealth : undefined;
        packet.data.kind = kind;
        // Relay-validated machine strike: results are authoritative (validated custody);
        // the vitalsSeq displayed here was already advanced+persisted above.
        packet.serverAuthoritative = true;
        try {
          ws.send(JSON.stringify({
            eventId: packet.eventId,
            type: "machine_hit",
            senderId: ws.operativeId,
            senderName: packet.senderName || (ws.operativeId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE ALPHA"),
            raidId: ws.raidId,
            timestamp: Date.now(),
            serverAuthoritative: true,
            data: {
              machineId: m.id,
              damage: safeDmg,
              machineHealth: m.health,
              machineAlive: m.isAlive,
              kind,
              maxHealth: m.maxHealth || m.health,
              vitalsSeq: m.vitalsSeq,
            },
          }));
        } catch {}
      }

      if (packet.type === "crate_looted" || packet.type === "crate_loot_request") {
        const cid = packet.data?.crateId;
        const cratePos = cid ? DEPOT_CRATE_LOCATIONS[cid] : null;
        const px = packet.data?.x;
        const pz = packet.data?.z;
        const hasCoords = typeof px === "number" && typeof pz === "number" && Number.isFinite(px) && Number.isFinite(pz);
        const acceptedPos = ws.lastRelayedPos;
        const hasAcceptedProximity = acceptedPos && cratePos && Math.hypot(acceptedPos.x - cratePos.x, acceptedPos.z - cratePos.z) <= 4.5;
        const inProximity = cratePos && hasCoords && Math.hypot(px - cratePos.x, pz - cratePos.z) <= 4.5 && hasAcceptedProximity;
        if (cid && inProximity) {
          const raidRec = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const prevClaimant = raidRec?.crates?.[cid]?.claimedBy;
          const isDuplicate = prevClaimant === ws.operativeId;
          const lootOk = settlement.recordCrateLoot(
            ws.raidId,
            cid,
            ws.operativeId,
            packet.data?.cashValue || 1250,
            packet.timestamp || Date.now(),
            { x: px, z: pz }
          );
          if (!lootOk) return; // Drop packet forwarding if recordCrateLoot rejected
          const isNewClaim = !isDuplicate && !settlement.lastClaimIsDuplicate;
          if (isNewClaim) {
            applyAuthoritativeCrateGrantToRelay(settlement, ws.raidId, ws.operativeId, prevClaimant);
          }
          const raidRecLoot = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const opRecLoot = raidRecLoot?.operatives?.[ws.operativeId];
          const serverStims = typeof opRecLoot?.stimsRemaining === "number" ? opRecLoot.stimsRemaining : 2;
          packet.data.stimsRemaining = serverStims;
          const curMoveLoot = operativeMovementStates.get(`${ws.raidId}:${ws.operativeId}`);
          if (curMoveLoot) curMoveLoot.stimsRemaining = serverStims;

          const ackMsg = {
            eventId: `crate_looted_ack_${cid}_${Date.now()}`,
            type: "crate_looted_ack",
            senderId: "server",
            senderName: "CENTRAL COMMAND",
            raidId: ws.raidId,
            timestamp: Date.now(),
            serverAuthoritative: true,
            data: {
              crateId: cid,
              claimantId: ws.operativeId,
              stimsRemaining: serverStims,
              cashEarned: opRecLoot?.earnedCash || 0,
            },
          };
          try {
            ws.send(JSON.stringify(ackMsg));
          } catch {}
        } else if (cid && !inProximity) {
          return; // Drop packet forwarding if coordinate or proximity check fails!
        }
      }

      // CRITICAL: Strip token before forwarding to prevent credential disclosure!
      delete packet.token;
      if (packet.data && packet.data.token) {
        delete packet.data.token;
      }
      // Trust boundary: the reserved server-authority stamp is assigned ONLY by the
      // relay's own validated result builders. A client-supplied copy on an ordinary
      // event packet is stripped here (reserved server-only types never take this
      // generic forward path).
      if (packet.type !== "machine_attack" && packet.type !== "machine_roster" && packet.type !== "kick_action_rejected" && packet.type !== "machine_hit" && packet.type !== "hit") {
        delete packet.serverAuthoritative;
      }

      // World-custody strip for forwarded world-state snapshots: crate ownership and
      // rival life-state are settlement-authoritative. The relay replaces those fields
      // with custody values (or clears them when custody has no record) before any
      // snapshot is forwarded, so a peer snapshot cannot fabricate crate claims,
      // rival extraction, or rival K.I.A. on other clients.
      if ((packet.type === "ingress_snapshot" || packet.type === "raid_announce") && packet.data && packet.data.snapshot) {
        try {
          const raidRec = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const custodyCrate = (cid) => {
            const rec = raidRec?.crates?.[cid];
            if (!rec || !rec.claimedBy) return { opened: false, claimedBy: undefined, claimedAt: undefined };
            return { opened: true, claimedBy: rec.claimedBy, claimedAt: rec.claimTimestamp || 0 };
          };
          if (Array.isArray(packet.data.snapshot.crates)) {
            for (const sc of packet.data.snapshot.crates) {
              const custody = custodyCrate(sc.id);
              sc.opened = custody.opened;
              sc.claimedBy = custody.claimedBy;
              sc.claimedAt = custody.claimedAt;
            }
          }
          if (Array.isArray(packet.data.snapshot.crates) && raidRec?.crates) {
            // Include custody-known crates not present in the peer snapshot
            for (const [cid, rec] of Object.entries(raidRec.crates)) {
              if (rec?.claimedBy && !packet.data.snapshot.crates.some((c) => c.id === cid)) {
                packet.data.snapshot.crates.push({ id: cid, opened: true, claimedBy: rec.claimedBy, claimedAt: rec.claimTimestamp || 0 });
              }
            }
          }
          if (Array.isArray(packet.data.snapshot.rivals)) {
            packet.data.snapshot.rivals = packet.data.snapshot.rivals.map((rv) => {
              const opRec = raidRec?.operatives?.[rv.id];
              if (!opRec) return rv;
              return {
                ...rv,
                isAlive: opRec.isKia ? false : (opRec.isAlive ?? rv.isAlive),
                isExtracted: !!opRec.isExtracted,
                health: typeof opRec.health === "number" ? opRec.health : rv.health,
                armor: typeof opRec.armor === "number" ? opRec.armor : (rv.armor ?? 0),
              };
            });
          }
        } catch {}
      }

      packet.serverTime = Date.now();
      const out = JSON.stringify(packet);
      for (const client of wss.clients) {
        if (client !== ws && client.readyState === 1 && client.authenticated && client.raidId === ws.raidId) {
          const cRaid = client.raidId && typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(client.raidId) : null;
          if ((cRaid && cRaid.status === "concluded") || (client.authToken && !settlement.resolveOperativeByToken(client.authToken))) {
            client.authenticated = false;
            try { client.close(4003, "Session revoked"); } catch {}
            continue;
          }
          if (client.bufferedAmount && client.bufferedAmount > 1048576) {
            client.authenticated = false;
            try { client.close(4008, "Slow consumer backpressure limit exceeded"); } catch {}
            continue;
          }
          if (client.bufferedAmount && client.bufferedAmount > 65536) {
            if (packet.type === "state" || packet.type === "hold_tick") {
              continue; // Drop high-frequency transient telemetry when client buffer is congested
            }
          }
          try {
            client.send(out);
          } catch {}
        }
      }
    } catch {}
  });

  const handleSlotRelease = () => {
    clearTimeout(authTimer);
    if (ws.operativeId && ws.raidId) {
      const slotKey = `${ws.raidId}:${ws.operativeId}`;
      if (activeSlotSockets.get(slotKey) === ws) {
        activeSlotSockets.delete(slotKey);
        // Start bounded 30s reconnect lease; do NOT immediately revoke session token
        if (typeof settlement.slotClaimTimestamps?.set === "function") {
          settlement.slotClaimTimestamps.set(slotKey, Date.now());
        }
      }
    }
  };
  ws.on("close", handleSlotRelease);
  ws.on("error", handleSlotRelease);
});

  // ---------------------------------------------------------------------------
  // Server-Side Machine Attack Authority
  // Turrets and drones attack according to their deterministic rules ON THE RELAY
  // (timing, target selection, damage, armor absorption) using accepted operator
  // positions. Machine damage no longer depends on client self-reporting: valid
  // "state" packets from a client omitting machine damage cannot preserve an
  // extraction hold, because the server itself owns machine fire. Victims receive
  // authoritative `machine_attack` broadcasts (server-stamped custody vitals) and
  // apply them without a client-side damage path.
  // ---------------------------------------------------------------------------
  const MACHINE_ATTACK_INTERVAL_MS = 250;  // 15 sim ticks @ 60Hz
  const MACHINE_ATTACKER = {
    turret: { range: 20.0, damage: 14, cooldownMs: 750 },   // 45 ticks
    drone:  { range: 25.0, damage: 10, cooldownMs: 500 },   // 30 ticks
  };
  const machineAttackClock = new Map(); // `${raidId}:${machineId}` -> lastAttackMs
  const machineAttackTimer = setInterval(() => {
    try {
      // Machine authority is CUSTODY-DRIVEN: every ACTIVE raid runs its automated
      // defenses regardless of live socket count — machine fire and extraction hold
      // verification use ONE session-validity basis (active raid custody), so a raid
      // cannot keep verifying holds while silently skipping machine attacks between
      // the last socket drop and its reconnect lease.
      const raidsWithClients = new Set();
      for (const client of wss.clients) {
        if (client.readyState === 1 && client.authenticated && client.raidId) raidsWithClients.add(client.raidId);
      }
      if (settlement.raids) {
        for (const [rid, rrec] of settlement.raids.entries()) {
          if (!(rrec && rrec.status === "active")) continue;
          raidsWithClients.add(rid);
          // Cold restart recovery: the volatile movement-state map starts empty, so
          // rebuild accepted operative states from ACTIVE raid custody (persisted
          // position evidence) BEFORE this tick's machine authority — machine fire
          // and hold verification share the same session-validity basis.
          for (const [copId, cop] of Object.entries(rrec.operatives || {})) {
            if (!cop || cop.isKia || cop.isAlive === false || cop.isExtracted) continue;
            const ckey = `${rid}:${copId}`;
            if (operativeMovementStates.has(ckey)) continue;
            if (typeof cop.lastObservedX !== "number" || typeof cop.lastObservedZ !== "number") continue;
            if (typeof cop.lastObservedTimestamp !== "number" || (Date.now() - cop.lastObservedTimestamp) > 30000) continue;
            operativeMovementStates.set(ckey, {
              x: cop.lastObservedX,
              z: cop.lastObservedZ,
              health: typeof cop.health === "number" ? cop.health : 100,
              armor: typeof cop.armor === "number" ? cop.armor : 100,
              isAlive: true,
              lastServerTime: 0,
              budget: 2.0,
              packetTimestamp: 0,
              timestamp: 0,
            });
          }
        }
      }
      for (const raidId of raidsWithClients) {
        const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
        if (!rRec || rRec.status !== "active") continue;
        const serverRaidTick = settlement.getCurrentRaidTick ? settlement.getCurrentRaidTick(raidId) : 0;
        const machines = getRaidMachines(raidId);
        const now = Date.now();
        for (const m of machines) {
          if (!m || !m.isAlive) continue;
          const spec = MACHINE_ATTACKER[m.type];
          if (!spec) continue;
          const atkKey = `${raidId}:${m.id}`;
          const lastAtk = machineAttackClock.get(atkKey) || 0;
          if (now - lastAtk < spec.cooldownMs) continue;

          // Authoritative machine position (drones: deterministic patrol equation)
          const atkPos = m.type === "drone" ? computeMachineServerPosition(m, serverRaidTick) : { x: m.x, z: m.z };
          if (Number.isNaN(atkPos.x) || Number.isNaN(atkPos.z)) continue;

          // Target: closest ACTIVE human operative (admitted, living, unextracted,
          // non-K.I.A.) by accepted movement state + raid custody — extracted/K.I.A.
          // movement records are excluded so a terminal nearest target can't suppress
          // an attack on an active operative.
          let target = null;
          let targetDist = Infinity;
          for (const [slotKey, st] of operativeMovementStates.entries()) {
            if (!slotKey.startsWith(`${raidId}:`)) continue;
            if (!st || st.isAlive === false) continue;
            const candId = slotKey.slice(raidId.length + 1);
            const candCustody = rRec?.operatives?.[candId];
            if (candCustody && (candCustody.isKia || candCustody.isAlive === false || candCustody.isExtracted)) continue;
            const d = Math.hypot((st.x ?? 0) - atkPos.x, (st.z ?? 0) - atkPos.z);
            if (d <= spec.range && d < targetDist) {
              // Container cover check against the operative's standing height
              const mY = typeof m.y === "number" ? m.y : (m.type === "drone" ? 3.5 : 1.0);
              if (checkContainerRayObstruction(atkPos.x, atkPos.z, st.x ?? 0, st.z ?? 0, mY, 1.0)) continue;
              // Respect bounded roll invulnerability frames
              const isRolling = st.action === "roll";
              const rollElapsed = now - (st.rollStartedAt || 0);
              if (isRolling && rollElapsed <= 220 && st.isInvulnerable === true) continue;
              target = { slotKey, id: slotKey.slice(raidId.length + 1), st: st };
              targetDist = d;
            }
          }
          if (!target) continue;
          machineAttackClock.set(atkKey, now);

          // Authoritative damage with armor absorption against movement-state vitals
          const dmg = spec.damage;
          const preHealth = target.st.health ?? 100;
          const preArmor = target.st.armor ?? 100;
          const absorbed = Math.min(preArmor, dmg);
          target.st.armor = preArmor - absorbed;
          target.st.health = Math.max(0, preHealth - (dmg - absorbed));
          // Machine damage immediately cancels any active stim treatment channel!
          target.st.isUsingStim = false;
          target.st.stimChannelStartedAt = 0;
          const nowAlive = target.st.health > 0;
          if (!nowAlive) {
            target.st.isAlive = false;
            target.st.isKia = true;
          }

          // Custody + extraction-hold break in the same durable transaction
          const oRec = rRec?.operatives?.[target.id];
          const preCustody = oRec ? JSON.parse(JSON.stringify(oRec)) : null;
          try {
            const curTick = Math.max(1, (target.st.currentTick || 0), serverRaidTick || 0, ((oRec?.rawLastReceivedTick || 0) + 1));
            if (typeof settlement.recordExtractionHold === "function") {
              settlement.recordExtractionHold(raidId, target.id, 0, curTick, { inZone: false, damageTaken: dmg, skipSave: true });
            } else if (oRec) {
              oRec.holdTicks = 0;
              oRec.holdStartTick = undefined;
              oRec.holdCompleted = false;
            }
            if (oRec) {
              oRec.health = target.st.health;
              oRec.armor = target.st.armor;
              oRec.lastDamageTimestamp = now;
              oRec.unconsumedDamage = dmg;
            }
            if (!nowAlive && typeof settlement.recordOperativeKia === "function") {
              // Approved internal lifecycle caller ('system') — operative fell to
              // automated facility defenses in an authoritative machine attack.
              settlement.recordOperativeKia(raidId, target.id, "system");
            } else if (!nowAlive) {
              if (oRec) {
                oRec.isAlive = false;
                oRec.isKia = true;
              }
              if (settlement.saveToDisk) settlement.saveToDisk();
            } else if (settlement.saveToDisk) {
              settlement.saveToDisk();
            }
          } catch (persistErr) {
            // Restore the COMPLETE pre-strike life record — a stale isKia flag would
            // let a later hit confirmation declare a living target dead.
            target.st.health = preHealth;
            target.st.armor = preArmor;
            target.st.isAlive = true;
            target.st.isKia = false;
            if (oRec && preCustody) {
              for (const k of Object.keys(oRec)) delete oRec[k];
              Object.assign(oRec, preCustody);
            }
            machineAttackClock.set(atkKey, lastAtk);
            continue;
          }

          // Broadcast authoritative machine attack to every raid client (victim applies
          // custody vitals + hold break; peers see world fire results).
          const attackMsg = {
            eventId: `machine_attack_${m.id}_${target.id}_${now}`,
            type: "machine_attack",
            senderId: "server",
            senderName: "CENTRAL COMMAND",
            raidId,
            timestamp: now,
            serverAuthoritative: true,
            data: {
              machineId: m.id,
              machineType: m.type,
              targetId: target.id,
              damage: dmg,
              targetHealth: target.st.health,
              targetArmor: target.st.armor,
              targetAlive: nowAlive,
              attackX: atkPos.x,
              attackZ: atkPos.z,
            },
          };
          const out = JSON.stringify(attackMsg);
          for (const client of wss.clients) {
            if (client.readyState === 1 && client.authenticated && client.raidId === raidId) {
              try { client.send(out); } catch {}
            }
          }
        }
      }
    } catch {}
  }, MACHINE_ATTACK_INTERVAL_MS);
  machineAttackTimer.unref ? machineAttackTimer.unref() : undefined;

  const origClose = server.close.bind(server);
  server.close = function(cb) {
    try {
      if (machineAttackTimer) clearInterval(machineAttackTimer);
      for (const client of wss.clients) {
        try { client.terminate(); } catch {}
      }
      wss.close();
    } catch {}
    if (typeof server.closeAllConnections === "function") {
      try { server.closeAllConnections(); } catch {}
    }
    return origClose(cb);
  };

  server.deployMachine = function(raidId, data) {
    const action = data.action === "remove" ? "remove" : "place";
    const machineId = typeof data.machineId === "string" ? data.machineId.trim() : "";
    if (!raidId || !machineId || !/^[A-Za-z0-9_-]{2,48}$/.test(machineId)) {
      throw new Error("Invalid payload: raidId and machineId are required");
    }
    if (!settlement.hasRaid || !settlement.hasRaid(raidId)) {
      throw new Error(`Raid ${raidId} does not exist`);
    }

    const __preRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
    const machines = getRaidMachines(raidId);
    const idx = machines.findIndex((m) => m.id === machineId);

    if (action === "remove") {
      if (idx !== -1) machines.splice(idx, 1);
      if (__preRec && __preRec.machines && __preRec.machines[machineId]) {
        delete __preRec.machines[machineId];
      }
      raidRevision(raidId);
      if (__preRec) {
        __preRec.machineDeployment = machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, cooldownTicks: m.cooldownTicks || 0, originX: m.originX, originZ: m.originZ, deployedAtMs: m.deployedAtMs, maxHealth: m.maxHealth, vitalsSeq: m.vitalsSeq || 0 }));
      }
      if (settlement.saveToDisk) settlement.saveToDisk();
      try {
        const out = JSON.stringify({
          eventId: `machine_roster_${raidId}_${Date.now()}`,
          type: "machine_roster",
          senderId: "server",
          senderName: "CENTRAL COMMAND",
          raidId,
          timestamp: Date.now(),
          serverAuthoritative: true,
          data: {
            revision: __preRec && typeof __preRec.machineRosterRevision === "number" ? __preRec.machineRosterRevision : raidRosterRevisions.get(raidId) || 1,
            machines: machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, originX: m.originX, originZ: m.originZ, maxHealth: m.maxHealth, vitalsSeq: m.vitalsSeq || 0 })),
          },
        });
        for (const client of wss.clients) {
          if (client.readyState === 1 && client.authenticated && client.raidId === raidId) {
            try { client.send(out); } catch {}
          }
        }
      } catch {}
      return { success: true, action: "remove", raidId, machineId };
    }

    const type = data.type === "turret" ? "turret" : (data.type === "drone" ? "drone" : null);
    const x = typeof data.x === "number" && Number.isFinite(data.x) ? data.x : NaN;
    const z = typeof data.z === "number" && Number.isFinite(data.z) ? data.z : NaN;
    const health = typeof data.health === "number" && Number.isFinite(data.health) ? Math.min(1000, Math.max(1, Math.floor(data.health))) : (type === "turret" ? 120 : 75);
    if (!type || !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 80 || Math.abs(z) > 80) {
      throw new Error("Invalid payload: type (turret|drone), finite x/z within +/-80 required");
    }
    const now = Date.now();
    const machine = { id: machineId, type, x, y: type === "drone" ? 2.2 : 0, z, facing: 0, health, isAlive: true, cooldownTicks: 0, originX: x, originZ: z, deployedAtMs: now, maxHealth: health, vitalsSeq: nextVitalsSeq(machineId, raidId) };
    if (idx !== -1) machines[idx] = machine;
    else machines.push(machine);

    if (__preRec) {
      if (!__preRec.machines) __preRec.machines = {};
      __preRec.machines[machineId] = { health, isAlive: true };
      raidRevision(raidId);
      __preRec.machineDeployment = machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, cooldownTicks: m.cooldownTicks || 0, originX: m.originX, originZ: m.originZ, deployedAtMs: m.deployedAtMs, maxHealth: m.maxHealth, vitalsSeq: m.vitalsSeq || 0 }));
    }
    if (settlement.saveToDisk) settlement.saveToDisk();

    try {
      const out = JSON.stringify({
        eventId: `machine_roster_${raidId}_${Date.now()}`,
        type: "machine_roster",
        senderId: "server",
        senderName: "CENTRAL COMMAND",
        raidId,
        timestamp: Date.now(),
        serverAuthoritative: true,
        data: {
          revision: __preRec && typeof __preRec.machineRosterRevision === "number" ? __preRec.machineRosterRevision : raidRosterRevisions.get(raidId) || 1,
          machines: machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, originX: m.originX, originZ: m.originZ, maxHealth: m.maxHealth, vitalsSeq: m.vitalsSeq || 0 })),
        },
      });
      for (const client of wss.clients) {
        if (client.readyState === 1 && client.authenticated && client.raidId === raidId) {
          try { client.send(out); } catch {}
        }
      }
    } catch {}
    return { success: true, action: "place", raidId, machine: { id: machineId, type, x, z, health } };
  };

  server.repositionOperative = function(raidId, operativeId, x, z) {
    const slotKey = `${raidId}:${operativeId}`;
    const existing = operativeMovementStates.get(slotKey);
    const now = Date.now();
    const rRecPos = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
    const oRecPos = rRecPos?.operatives?.[operativeId];
    const health = existing?.health ?? oRecPos?.health ?? 100;
    const armor = existing?.armor ?? oRecPos?.armor ?? 100;
    const isAlive = existing?.isAlive ?? oRecPos?.isAlive ?? true;
    const placement = {
      x,
      z,
      health,
      armor,
      isAlive,
      lastServerTime: now,
      packetTimestamp: 0,
      timestamp: now,
      budget: SERVER_MAX_BURST_CAP,
      lastRollStartedAt: existing?.lastRollStartedAt,
      rollStartedAt: existing?.rollStartedAt,
      lastCrateObservedX: existing?.lastCrateObservedX,
      lastCrateObservedZ: existing?.lastCrateObservedZ,
      lastCrateObservedServerTimestamp: existing?.lastCrateObservedServerTimestamp,
      action: existing?.action,
    };
    operativeMovementStates.set(slotKey, placement);
    const activeWs = activeSlotSockets.get(slotKey);
    if (activeWs && activeWs.readyState === 1) {
      activeWs.lastRelayedPos = placement;
    }
    if (oRecPos) {
      oRecPos.lastObservedX = x;
      oRecPos.lastObservedZ = z;
      oRecPos.hasLiveMovement = true;
      oRecPos.lastObservedTimestamp = now;
    }
    return { success: true, raidId, operativeId, x, z };
  };

  server.settlement = settlement;
  server.requestHandler = requestHandler;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const server = createStickZoneServer();
  server.listen(PORT, () => {
    console.log(`Stick Zone production server listening on http://localhost:${PORT} (WebSocket at /syncplay-ws)`);
  });
}
