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
import { ServerSettlementAuthority } from "../src/sim/server-settlement.js";

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
  return false;
}

const serverSettlement = new ServerSettlementAuthority();

const RESERVED_IDENTITIES = new Set(["system", "server", "admin", "root"]);
const SERVER_INTERNAL_SECRET = process.env.STICK_ZONE_SERVER_SECRET || (process.env.NODE_ENV === "test" ? "sz_test_internal_sec" : crypto.randomUUID());

export const activeClaimedSessions = new Set();
const SQUAD_CREDENTIALS = {
  op_player: process.env.SZ_SECRET_PLAYER || (process.env.NODE_ENV === "production" ? null : "sz_cred_player_ghost_s7"),
  op_alpha_1: process.env.SZ_SECRET_ALPHA || (process.env.NODE_ENV === "production" ? null : "sz_cred_alpha_ghost_s7"),
  op_bravo_1: process.env.SZ_SECRET_BRAVO || (process.env.NODE_ENV === "production" ? null : "sz_cred_bravo_phantom_s7"),
};

function getAuthenticatedCaller(req, settlement) {
  let token = null;
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (req.headers["x-session-token"]) {
    token = String(req.headers["x-session-token"]).trim();
  } else if (req.headers["x-operative-token"]) {
    token = String(req.headers["x-operative-token"]).trim();
  } else if (req.headers["x-server-secret"]) {
    token = String(req.headers["x-server-secret"]).trim();
  }

  // Reject unauthenticated requests or empty tokens immediately
  if (!token) {
    return null;
  }

  // 1. Privileged internal secret derives "system"
  if (SERVER_INTERNAL_SECRET && token === SERVER_INTERNAL_SECRET) {
    return { callerId: "system", raidId: "*", isSystem: true };
  }

  // 2. Operative session token verifies and derives operative ID and raidId
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
function getRaidOperativeWeaponState(raidId, opId) {
  const opKey = `${raidId}:${opId}`;
  let wsState = raidOperativeWeaponStates.get(opKey);
  if (!wsState) {
    wsState = { ammo: 30, maxAmmo: 30, isReloading: false, reloadEnd: 0 };
    raidOperativeWeaponStates.set(opKey, wsState);
  }
  return wsState;
}

function setAuthoritativeOperativeAmmo(settlement, raidId, opId, newAmmo, clearReload = false) {
  const wsState = getRaidOperativeWeaponState(raidId, opId);
  const prevAmmo = wsState.ammo;
  const prevReloading = wsState.isReloading;
  wsState.ammo = Math.max(0, Math.min(30, Math.floor(newAmmo)));
  if (clearReload) {
    wsState.isReloading = false;
  }
  if (typeof settlement?.recordOperativeAmmo === "function") {
    try {
      settlement.recordOperativeAmmo(raidId, opId, wsState.ammo);
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
    const custodyAmmo = oRec?.ammo;
    if (typeof custodyAmmo === "number" && Number.isFinite(custodyAmmo) && custodyAmmo >= 0 && custodyAmmo <= 30) {
      const wsState = getRaidOperativeWeaponState(raidId, opId);
      if (!wsState.isReloading) {
        wsState.ammo = Math.floor(custodyAmmo);
      }
      if (wsState.isReloading && wsState.reloadEnd <= Date.now()) {
        wsState.isReloading = false;
      }
    }
  } catch {}
}

const CRATE_LOCATIONS = {
  crate_01: { x: -8, z: -6 },
  crate_02: { x: 20, z: -15 },
  crate_03: { x: -18, z: 22 },
};

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
        const RESERVED = new Set(["system", "server", "admin", "root"]);
        if (!opId || RESERVED.has(String(opId).toLowerCase())) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Cannot issue token for reserved operative ID" }));
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
        if ((caller && (caller.callerId === opId || caller.isSystem) && caller.raidId === raidId) || isResumeValid) {
          if (targetRaid && (targetRaid.status === "concluded" || targetOp?.isExtracted || targetOp?.isKia || targetOp?.isAlive === false)) {
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

  if (url.pathname === "/api/settlement/session" && req.method === "POST") {
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
        const RESERVED = new Set(["system", "server", "admin", "root"]);
        if (!opId || RESERVED.has(String(opId).toLowerCase())) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Cannot issue token for reserved operative ID" }));
          return;
        }

        // Authenticate caller: require matching operative secret or authorized coordinator/owner caller
        const caller = getAuthenticatedCaller(req, settlement);
        if (caller && !caller.isSystem && caller.raidId !== raidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot access raid ${raidId}` }));
          return;
        }
        const expectedSecret = SQUAD_CREDENTIALS[opId];
        const suppliedSecret = req.headers["x-operative-secret"] || data.operativeSecret;
        const hasValidSecret = Boolean(expectedSecret && suppliedSecret && suppliedSecret === expectedSecret);
        const isAuthorizedCaller = Boolean(caller && (caller.isSystem || (caller.callerId === opId && caller.raidId === raidId)));

        if (!hasValidSecret && !isAuthorizedCaller) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Operative credentials or coordinator authorization required to obtain session token" }));
          return;
        }

        if (settlement.isIngressClosed(raidId)) {
          const rRaid = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
          const rOp = rRaid?.operatives?.[opId];
          const isPriorAdmitted = rOp?.admitted && (settlement.isSlotClaimed(raidId, opId) || (caller && caller.callerId === opId));
          if (!isPriorAdmitted) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Raid ingress window has closed (exceeded 8-minute limit)" }));
            return;
          }
        }

        const token = settlement.getSessionToken(raidId, opId);
        if (!token) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Operative ${opId} not found in raid ${raidId}` }));
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ token }));
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

        if (!caller.isSystem && caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }

        if (!caller.isSystem && caller.callerId !== opId) {
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

          const distToLz = Math.hypot(observedPos.x - 45.0, observedPos.z - 45.0);
          if (distToLz > 6.0) {
            if (typeof settlement.recordExtractionHold === "function") {
              settlement.recordExtractionHold(targetRaidId, opId, 0, currentTickNum, { inZone: false });
            }
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Operative outside LZ on authoritative stream (${distToLz.toFixed(1)}m > 6.0m LZ radius)`, success: false }));
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

        let inZone = false;
        if (typeof data.x === "number" && typeof data.z === "number" && Number.isFinite(data.x) && Number.isFinite(data.z)) {
          const dist = Math.hypot(data.x - 45.0, data.z - 45.0);
          inZone = dist <= 6.0;
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
            senderId: extractingId,
            senderName: extractingId === "op_bravo_1" ? "INFILTRATOR PHANTOM-1" : "OPERATIVE ALPHA",
            squad: extractingId === "op_bravo_1" ? "SQUAD BRAVO" : "SQUAD ALPHA",
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

        if (!caller.isSystem && caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }

        if (!caller.isSystem && caller.callerId !== opId) {
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
        if (!caller.isSystem && caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }
        if (!caller.isSystem && caller.callerId !== extractingId) {
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
        if (!caller.isSystem && caller.raidId !== targetRaidId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Token for raid ${caller.raidId} cannot mutate raid ${targetRaidId}` }));
          return;
        }
        if (!caller.isSystem && caller.callerId !== claimantId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Forbidden: Operative ${caller.callerId} cannot claim loot for ${claimantId}` }));
          return;
        }
        if (!caller.isSystem) {
          const cratePos = CRATE_LOCATIONS[data.crateId];
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
          const wsState = getRaidOperativeWeaponState(raidId, claimantId);
          wsState.ammo = 30;
          wsState.isReloading = false;
          if (prevClaimant && prevClaimant !== claimantId) {
            const updatedRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
            const prevCustody = updatedRec?.operatives?.[prevClaimant];
            if (prevCustody && typeof prevCustody.ammo === "number") {
              const prevWsState = getRaidOperativeWeaponState(raidId, prevClaimant);
              prevWsState.ammo = prevCustody.ammo;
            }
          }
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: ok, isNewClaim }));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: (err && err.message) || String(err) }));
      }
    });
    return;
  }

  if (url.pathname === "/api/settlement/deploy-machine" && req.method === "POST") {
    // Authoritative lifecycle-coordinator machine deployment: the raid coordinator
    // (system credentials only) may place or withdraw an automated defense machine into
    // raid custody (e.g. facility defense escalation). The machine's fire is then fully
    // server-authoritative via the machine-attack executor.
    readJsonBody(req, res, (err, data) => {
      if (err) {

        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const caller = getAuthenticatedCaller(req, settlement);
      if (!caller || !caller.isSystem) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Forbidden: lifecycle coordinator (system) credentials required" }));
        return;
      }
      const raidId = typeof data.raidId === "string" ? data.raidId : "";
      const action = data.action === "remove" ? "remove" : "place";
      const machineId = typeof data.machineId === "string" ? data.machineId.trim() : "";
      if (!raidId || !machineId || !/^[A-Za-z0-9_-]{2,48}$/.test(machineId)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid payload: raidId and machineId are required" }));
        return;
      }
      if (!settlement.hasRaid || !settlement.hasRaid(raidId)) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: `Raid ${raidId} does not exist` }));
        return;
      }

      // PRE-INITIALIZATION SNAPSHOT: capture custody field presence BEFORE getRaidMachines
      // runs (which lazily creates the optional machines health map). First-deployment
      // failures restore even that lazy initialization.
      const __preRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
      const __machMapExisted = !(__preRec && __preRec.machines === undefined);
      const __machMapSnapshot = __preRec && __preRec.machines ? JSON.parse(JSON.stringify(__preRec.machines)) : null;
      const machines = getRaidMachines(raidId);
      const idx = machines.findIndex((m) => m.id === machineId);
      // Full-transaction snapshot (machine list + health map + deployment record) taken
      // BEFORE any mutation; place/replace/remove all restore through __restoreMachines.
      // Revision stores are restored too — no uncommitted revision may survive a failed save.
      const __revBeforeMap = raidRosterRevisions.get(raidId) || 0;
      const __revRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
      const __revBeforeRec = __revRec && typeof __revRec.machineRosterRevision === "number" ? __revRec.machineRosterRevision : null;
      const __restoreRevisions = () => {
        raidRosterRevisions.set(raidId, __revBeforeMap);
        const rr = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
        if (rr) { if (__revBeforeRec === null) delete rr.machineRosterRevision; else rr.machineRosterRevision = __revBeforeRec; }
      };
      const __mListBefore = machines.map((m) => ({ ...m }));
      const __mRrec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
      // Optional-map rollback: restore deletes a newly created health map when it was
      // absent before the deployment (a failed placement can leave uncommitted state).
      const __machMapRestore = () => {
        // Full optional-map restoration: a failed deployment returns the health map to
        // its PRE-DEPLOYMENT state — including deleting a map lazily created by the
        // getRaidMachines call itself (not just mutations after the snapshot).
        if (__machMapExisted) {
          if (__machMapSnapshot && __mRrec) __mRrec.machines = JSON.parse(JSON.stringify(__machMapSnapshot));
        } else if (__mRrec) {
          delete __mRrec.machines;
        }
      };
      const __mHealthBefore = __mRrec && __mRrec.machines ? JSON.parse(JSON.stringify(__mRrec.machines)) : null;
      const __mDeployBefore = __mRrec && __mRrec.machineDeployment ? JSON.parse(JSON.stringify(__mRrec.machineDeployment)) : null;
      const __restoreMachines = () => {
        machines.length = 0;
        for (const m of __mListBefore) machines.push(m);
        if (__mRrec) {
          if (__mHealthBefore) __mRrec.machines = JSON.parse(JSON.stringify(__mHealthBefore));
          if (__mDeployBefore) __mRrec.machineDeployment = JSON.parse(JSON.stringify(__mDeployBefore));
          else if (__mRrec.machineDeployment !== undefined) delete __mRrec.machineDeployment;
        }
      };

      if (action === "remove") {
        if (idx === -1) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Machine ${machineId} not deployed in raid ${raidId}` }));
          return;
        }
        const [removed] = machines.splice(idx, 1);
        // Revision bump precedes the durable save: the persisted record carries the
        // new revision (an existing client must never see a new change rejected as
        // stale after a restart).
        raidRevision(raidId);
        const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
        if (rRec?.machines) delete rRec.machines[machineId];
        if (rRec) {
          rRec.machineDeployment = machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, cooldownTicks: m.cooldownTicks || 0, originX: m.originX, originZ: m.originZ, deployedAtMs: m.deployedAtMs, maxHealth: m.maxHealth || Math.max(m.health, m.type === "turret" ? 120 : 75), vitalsSeq: m.vitalsSeq || 0 }));
        }
        if (settlement.saveToDisk) {
          try {
            settlement.saveToDisk();
          } catch (removePersistErr) {
            __restoreMachines();
            __machMapRestore();
            __restoreRevisions();
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Machine removal persistence failed; deployment state restored" }));
            return;
          }
        }
        // Versioned full-roster broadcast: connected raid clients reconcile their machine
        // world (membership, geometry, patrol origins, vitals) to the deployment truth.
        const rosterMsg = {
          eventId: `machine_roster_${raidId}_${Date.now()}`,
          type: "machine_roster",
          senderId: "server",
          senderName: "CENTRAL COMMAND",
          raidId,
          timestamp: Date.now(),
          serverAuthoritative: true,
          data: { revision: rRec && typeof rRec.machineRosterRevision === "number" ? rRec.machineRosterRevision : raidRosterRevisions.get(raidId) || 1, machines: machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, originX: m.originX, originZ: m.originZ, maxHealth: m.maxHealth, vitalsSeq: m.vitalsSeq || 0 })) },
        };
        try {
          const __rosterOut = JSON.stringify(rosterMsg);
          for (const client of wss.clients) {
            if (client.readyState === 1 && client.authenticated && client.raidId === raidId) {
              try { client.send(__rosterOut); } catch {}
            }
          }
        } catch {}
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, action, raidId, machineId, removedType: removed.type }));
        return;
      }

      // place
      const type = data.type === "turret" ? "turret" : (data.type === "drone" ? "drone" : null);
      const x = typeof data.x === "number" && Number.isFinite(data.x) ? data.x : NaN;
      const z = typeof data.z === "number" && Number.isFinite(data.z) ? data.z : NaN;
      const health = typeof data.health === "number" && Number.isFinite(data.health) ? Math.min(1000, Math.max(1, Math.floor(data.health))) : (type === "turret" ? 120 : 75);
      if (!type || !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 80 || Math.abs(z) > 80) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid payload: type (turret|drone), finite x/z within +/-80 required" }));
        return;
      }
      const now = Date.now();
      // Shared deployment limit (matches cold-restore validation of 64): NEW insertions
      // are rejected at the boundary; REPLACEMENT of an existing machine id is always
      // allowed (capacity-neutral). A saved deployment can never exceed what cold
      // restore trusts (a >64 list would silently collapse to defaults on restart).
      const isNewInsertion = idx === -1;
      if (isNewInsertion && machines.length >= 64) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Deployment limit reached (64 machines)" }));
        return;
      }
      const machine = { id: machineId, type, x, y: type === "drone" ? 2.2 : 0, z, facing: 0, health, isAlive: true, cooldownTicks: 0, originX: x, originZ: z, deployedAtMs: now, maxHealth: health, vitalsSeq: nextVitalsSeq(machineId, raidId) };
      if (idx !== -1) machines[idx] = machine;
      else machines.push(machine);
      // Persist the COMPLETE deployment set (the machine array is truth) + health map;
      // restarts rebuild exactly this set through getRaidMachines.
      const rRec = settlement.getRaidRecord ? settlement.getRaidRecord(raidId) : null;
      if (rRec) {
        if (!rRec.machines) rRec.machines = {};
        rRec.machines[machineId] = { health, isAlive: true };
        // Revision bump precedes the durable save (the broadcast then re-reads the same
        // committed revision — a restart can never rewind below what clients applied).
        raidRevision(raidId);
        rRec.machineDeployment = machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, cooldownTicks: m.cooldownTicks || 0, originX: m.originX, originZ: m.originZ, deployedAtMs: m.deployedAtMs, maxHealth: m.maxHealth, vitalsSeq: m.vitalsSeq || 0 }));
        if (settlement.saveToDisk) {
          try {
            settlement.saveToDisk();
          } catch (deployPersistErr) {
            // Restore the COMPLETE pre-deployment state (list + health map + deployment
            // record + revision stores) and answer 500: handler-scoped failures take
            // this path — never a thrown exception into the JSON parser's catch.
            __restoreMachines();
            __machMapRestore();
            __restoreRevisions();
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Machine deployment persistence failed; deployment state restored" }));
            return;
          }
        }
      }
      // Versioned full-roster broadcast (place): connected raid clients reconcile their
      // machine world (membership, geometry, patrol origins, vitals) to the deployment truth.
      try {
        const __placeRosterOut = JSON.stringify({
          eventId: `machine_roster_${raidId}_${Date.now()}`,
          type: "machine_roster",
          senderId: "server",
          senderName: "CENTRAL COMMAND",
          raidId,
          timestamp: Date.now(),
          serverAuthoritative: true,
          data: { revision: rRec && typeof rRec.machineRosterRevision === "number" ? rRec.machineRosterRevision : raidRosterRevisions.get(raidId) || 1, machines: machines.map((m) => ({ id: m.id, type: m.type, x: m.x, y: m.y, z: m.z, facing: m.facing, health: m.health, isAlive: m.isAlive, originX: m.originX, originZ: m.originZ, maxHealth: m.maxHealth, vitalsSeq: m.vitalsSeq || 0 })) },
        });
        for (const client of wss.clients) {
          if (client.readyState === 1 && client.authenticated && client.raidId === raidId) {
            try { client.send(__placeRosterOut); } catch {}
          }
        }
      } catch {}
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, action, raidId, machine: { id: machineId, type, x, z, health } }));
    });
    return;
  }

  if (url.pathname === "/api/settlement/reposition" && req.method === "POST") {
    // Authoritative lifecycle-coordinator placement: the raid coordinator (system credentials only)
    // may place an operative at a legal map coordinate (e.g. staged ingress spawn placement).
    // This updates the server-side movement authority so the position is accepted as ground truth
    // and no anti-teleport state_correction is emitted for the coordinated placement.
    readJsonBody(req, res, (err, data) => {
      if (err) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      const caller = getAuthenticatedCaller(req, settlement);
      if (!caller || !caller.isSystem) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Forbidden: lifecycle coordinator (system) credentials required" }));
        return;
      }
      const raidId = typeof data.raidId === "string" ? data.raidId : "";
      const operativeId = typeof data.operativeId === "string" ? data.operativeId : "";
      const x = typeof data.x === "number" && Number.isFinite(data.x) ? data.x : NaN;
      const z = typeof data.z === "number" && Number.isFinite(data.z) ? data.z : NaN;
      if (!raidId || !operativeId || !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 80 || Math.abs(z) > 80) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid reposition payload: raidId, operativeId, and finite x/z within +/-80 are required" }));
        return;
      }
      if (!settlement.hasRaid || !settlement.hasRaid(raidId)) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: `Raid ${raidId} does not exist` }));
        return;
      }
      const slotKey = `${raidId}:${operativeId}`;
      const existing = operativeMovementStates.get(slotKey);
      const now = Date.now();
      // NORMAL-PATH CONSISTENCY: derive combat state from raid custody, falling back to
      // the SAME defaults the authenticated-movement path uses at first registration
      // (health 100, armor 100 on the socket path) — never a zero-armor cold state that
      // disagrees with pre-authentication movement defaults.
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
        packetTimestamp: 0, // next client report is accepted regardless of prior ordering
        timestamp: now,
        budget: SERVER_MAX_BURST_CAP, // full budget after coordinated placement
        lastRollStartedAt: existing?.lastRollStartedAt,
        rollStartedAt: existing?.rollStartedAt,
        lastCrateObservedX: existing?.lastCrateObservedX,
        lastCrateObservedZ: existing?.lastCrateObservedZ,
        lastCrateObservedServerTimestamp: existing?.lastCrateObservedServerTimestamp,
        action: existing?.action,
      };
      operativeMovementStates.set(slotKey, placement);
      // ONE PLACEMENT OPERATION: also update the ACTIVE socket's relayed position and the
      // settlement custody so every authority view agrees immediately (no stale
      // lastRelayedPos snapping a subsequent hold/combat validation back to the old spot).
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
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, raidId, operativeId, x, z }));
    });
    return;
  }

  if ((url.pathname === "/api/settlement/init-raid" || url.pathname === "/api/settlement/new-raid") && req.method === "POST") {
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
        if (!caller) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Lifecycle coordinator credentials required" }));
          return;
        }
        const data = JSON.parse(body || "{}");
        const raidId = data.raidId || `raid_sector7_${Date.now()}`;
        const isResettingExisting = settlement.hasRaid(raidId);

        if (isResettingExisting) {
          if (!caller.isSystem && caller.raidId !== raidId) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Forbidden: Caller from raid ${caller.raidId} cannot reset raid ${raidId}` }));
            return;
          }
          if (!caller.isSystem && caller.callerId !== "op_player" && caller.callerId !== "op_alpha_1") {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Forbidden: Caller ${caller.callerId} is not an authorized lifecycle coordinator` }));
            return;
          }
          if (!caller.isSystem) {
            const activeRaidRec = settlement.getRaidRecord(raidId);
            const op = activeRaidRec?.operatives?.[caller.callerId];
            const isRaidExpired = Boolean(activeRaidRec?.createdAtMs && (Date.now() - activeRaidRec.createdAtMs) > 15 * 60 * 1000);
            const canRedeploy = (op && (op.isExtracted || op.isKia || op.isAlive === false)) || (activeRaidRec && (activeRaidRec.status === "concluded" || isRaidExpired));
            if (!canRedeploy) {
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Forbidden: Operative must be extracted, K.I.A., or raid concluded before resetting raid" }));
              return;
            }
          }
        } else {
          // Starting next raid / redeploying: permitted for system or participants of any recorded raid who are extracted, KIA, or raid concluded
          const callerRaidRec = settlement.getRaidRecord(caller.raidId);
          if (!caller.isSystem && !callerRaidRec) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Forbidden: Caller raid does not exist" }));
            return;
          }
          if (!caller.isSystem) {
            const op = callerRaidRec?.operatives?.[caller.callerId];
            const isRaidExpired = Boolean(callerRaidRec?.createdAtMs && (Date.now() - callerRaidRec.createdAtMs) > 15 * 60 * 1000);
            const canRedeploy = (op && (op.isExtracted || op.isKia || op.isAlive === false)) || (callerRaidRec && (callerRaidRec.status === "concluded" || isRaidExpired));
            if (!canRedeploy) {
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Forbidden: Operative must be extracted, K.I.A., or raid concluded before creating new raid" }));
              return;
            }
          }
        }

        const pool = data.allowablePool || 50000;
        const ops = data.operatives || ["op_player", "op_alpha_1", "op_bravo_1"];
        const oldRaidId = settlement.getActiveRaidId();

        const oldRaidRec = settlement.getRaidRecord(oldRaidId);
        const nowMs = Date.now();
        const hasUnsettledHoldInGrace = oldRaidRec && Object.values(oldRaidRec.operatives || {}).some((o) => {
          return o.holdCompleted && !o.isExtracted && !o.isKia && o.isAlive !== false && oldRaidRec.createdAtMs && (nowMs - oldRaidRec.createdAtMs) <= (15 * 60 + 60) * 1000;
        });
        const isPastFullGrace = oldRaidRec?.createdAtMs && (nowMs - oldRaidRec.createdAtMs) > (15 * 60 + 60) * 1000;
        const allOldOpsConcluded = !oldRaidRec || Object.values(oldRaidRec.operatives || {}).every((o) => o.isExtracted || o.isKia || o.isAlive === false);
        const allOldOpsDone = !hasUnsettledHoldInGrace && (allOldOpsConcluded || isPastFullGrace);

        const callerClaimId = (!caller.isSystem && caller.callerId && ops.includes(caller.callerId)) ? caller.callerId : undefined;
        const shouldConcludeOld = Boolean(oldRaidId && oldRaidId !== raidId && (caller.isSystem || allOldOpsDone));

        // 1. Commit both new raid creation AND old raid conclusion atomically in a SINGLE persistence transaction!
        const raid = settlement.initRaid(raidId, pool, ops, callerClaimId, shouldConcludeOld ? oldRaidId : undefined);
        const tokens = settlement.getSessionTokens(raidId);

        // 2. Snapshot sockets belonging to old raid
        const socketsToClose = [];
        for (const client of wss.clients) {
          if (client.raidId === oldRaidId || client.raidId === raidId) {
            socketsToClose.push(client);
          }
        }

        if (caller.isSystem || allOldOpsDone) {
          // Broadcast restart notification to existing peers
          const restartMsg = JSON.stringify({
            eventId: `sys_restart_${Date.now()}`,
            type: "raid_restart",
            senderId: "system",
            senderName: "CENTRAL COMMAND",
            squad: "SQUAD ALPHA",
            raidId: oldRaidId,
            timestamp: Date.now(),
            data: { newRaidId: raidId },
          });
          for (const client of socketsToClose) {
            try { client.send(restartMsg); } catch {}
            client.authenticated = false;
          }

          // Gracefully close ONLY the snapshotted sockets after 150ms
          setTimeout(() => {
            for (const client of socketsToClose) {
              try { client.close(4003, "Raid reset"); } catch {}
            }
          }, 150);
        } else {
          // Old raid still contains live operatives (e.g. Bravo)! Broadcast raid_restart to live operatives before disconnecting caller
          const restartNotice = JSON.stringify({
            eventId: `server:restart:${Date.now()}`,
            type: "raid_restart",
            senderId: "server",
            senderName: "CENTRAL COMMAND",
            raidId: oldRaidId,
            timestamp: Date.now(),
            data: { newRaidId: raidId },
          });
          for (const client of socketsToClose) {
            if (client.raidId === oldRaidId && client.operativeId !== caller.callerId) {
              try { client.send(restartNotice); } catch {}
            }
          }

          // Disconnect only caller old socket
          for (const client of socketsToClose) {
            if (client.operativeId === caller.callerId && client.raidId === oldRaidId) {
              try { client.close(4003, "Operative redeployed"); } catch {}
            }
          }
        }

        res.setHeader("Content-Type", "application/json");
        if (caller.isSystem) {
          res.end(JSON.stringify({ raid, tokens }));
        } else {
          res.end(JSON.stringify({ raid, token: tokens[caller.callerId] || null }));
        }
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
const wss = new WebSocketServer({ server, path: "/syncplay-ws", maxPayload: 65536 });
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
        if (rRaid && (rRaid.status === "concluded" || rOp?.isExtracted || rOp?.isKia || rOp?.isAlive === false)) {
          try { ws.close(4003, "Operative lifecycle concluded"); } catch {}
          return;
        }
        if (typeof settlement.isIngressClosed === "function" && settlement.isIngressClosed(resolved.raidId)) {
          const slotKey = `${resolved.raidId}:${resolved.operativeId}`;
          const isSlotActive = (settlement.claimedSessions && settlement.claimedSessions.has(slotKey)) || activeSlotSockets.has(slotKey);
          if (!isSlotActive) {
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
        try {
          ws.send(JSON.stringify({
            type: "auth_success",
            operativeId: resolved.operativeId,
            raidId: resolved.raidId,
            currentRaidTick: curTick,
            ammo: getRaidOperativeWeaponState(resolved.raidId, resolved.operativeId).ammo,
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
      }
    }
  } catch {}

  authTimer = setTimeout(() => {
    if (!ws.authenticated) {
      try { ws.close(4001, "Authentication timeout"); } catch {}
    }
  }, 3000);

  ws.on("message", (message) => {
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
            if (rRaid && (rRaid.status === "concluded" || rOp?.isExtracted || rOp?.isKia || rOp?.isAlive === false)) {
              try { ws.close(4003, "Operative lifecycle concluded"); } catch {}
              return;
            }
            if (typeof settlement.isIngressClosed === "function" && settlement.isIngressClosed(resolved.raidId)) {
              const slotKey = `${resolved.raidId}:${resolved.operativeId}`;
              const isSlotActive = (settlement.claimedSessions && settlement.claimedSessions.has(slotKey)) || activeSlotSockets.has(slotKey);
              if (!isSlotActive) {
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
            (() => {
        const __authRec = settlement.getRaidRecord ? settlement.getRaidRecord(resolved.raidId) : null;
        ws.send(JSON.stringify({ type: "auth_success", operativeId: resolved.operativeId, raidId: resolved.raidId, currentRaidTick: curTick, serverTime: Date.now(), health: opMoveState.health, armor: opMoveState.armor, isAlive: opMoveState.isAlive, ammo: getRaidOperativeWeaponState(resolved.raidId, resolved.operativeId).ammo, machineRosterRevision: (__authRec && typeof __authRec.machineRosterRevision === "number") ? __authRec.machineRosterRevision : raidRosterRevisions.get(resolved.raidId) || 0, machines: getRaidMachines(resolved.raidId), lastAcceptedPosition: { x: opMoveState.x, z: opMoveState.z } }));
      })();
            return;
          }
        }
        ws.close(4001, "Unauthorized");
        return;
      }

      // Revalidate that session token has not been revoked by raid reset, raid conclusion, or operative extraction/KIA
      const isExfilNotice = packet.type === "exfil_success";
      const callerRaid = ws.raidId && typeof settlement.getRaidRecord === "function" ? settlement.getRaidRecord(ws.raidId) : null;
      const callerOp = callerRaid?.operatives?.[ws.operativeId];
      if (!isExfilNotice) {
        if (
          (callerRaid && callerRaid.status === "concluded") ||
          (callerOp && (callerOp.isExtracted || callerOp.isKia || callerOp.isAlive === false)) ||
          (ws.authToken && !settlement.resolveOperativeByToken(ws.authToken))
        ) {
          ws.close(4003, "Session revoked or operative concluded");
          return;
        }
      }

      if (packet.raidId && packet.raidId !== ws.raidId) {
        return; // Drop packet targeting wrong raid
      }

      // CRITICAL: Prevent malicious client packet relay
      const FORBIDDEN_CLIENT_PACKETS = new Set(["auth", "auth_success", "server_init", "server_handshake", "state_correction", "hit_confirmed"]);
      if (FORBIDDEN_CLIENT_PACKETS.has(packet.type)) return;

      if (ws.authenticated && ws.raidId && ws.operativeId) {
        const slotKey = `${ws.raidId}:${ws.operativeId}`;
        if (typeof settlement.slotClaimTimestamps?.set === "function") {
          settlement.slotClaimTimestamps.set(slotKey, Date.now());
        }
      }

      packet.senderId = ws.operativeId;
      packet.raidId = ws.raidId;

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
          let acceptedDamageAmount = 0;
          if (typeof packet.data.health === "number" && Number.isFinite(packet.data.health)) {
            const safeHp = Math.max(0, Math.min(100, packet.data.health));
            const preAcceptedHp = moveState.health ?? 100;
            moveState.health = Math.min(preAcceptedHp, safeHp);
            if (safeHp < preAcceptedHp) acceptedDamageAmount += preAcceptedHp - safeHp;
          }
          if (typeof packet.data.armor === "number" && Number.isFinite(packet.data.armor)) {
            const safeArmor = Math.max(0, Math.min(100, packet.data.armor));
            const preAcceptedArmor = moveState.armor ?? 100;
            moveState.armor = Math.min(preAcceptedArmor, safeArmor);
            // Armor absorbs incoming fire FIRST: an accepted armor decrease is combat
            // damage even when health is unchanged — it must break extraction custody
            // exactly like a health decrease.
            if (safeArmor < preAcceptedArmor) acceptedDamageAmount += preAcceptedArmor - safeArmor;
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
        if (typeof packet.data.ammo === "number" && Number.isFinite(packet.data.ammo)) {
          const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
          const reportedAmmo = Math.max(0, Math.min(30, Math.floor(packet.data.ammo)));
          const now = Date.now();
          if (packet.data.action === "reload") {
            if (!weaponState.isReloading) {
              weaponState.isReloading = true;
              weaponState.reloadEnd = now + 1200;
            }
          } else if (weaponState.isReloading && now >= weaponState.reloadEnd) {
            setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, 30, true);
          } else if (!weaponState.isReloading) {
            if (reportedAmmo <= weaponState.ammo) {
              setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, reportedAmmo);
            }
          }
        }

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

          const distToLz = Math.hypot(px - 45.0, pz - 45.0);
          if (distToLz > 6.0) {
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

        // Applies + persists a single validated operative strike (geometry, roll iframes,
        // armor absorption, K.I.A. custody, extraction-hold break, hit_confirmed ack,
        // knockback movement budget). Callers own dedup, damage bounds, cooldown, and ammo.
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

          if (hasAxField || hasAzField) {
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
          const targetMove = operativeMovementStates.get(targetSlotKey);
          if (!targetMove || !targetMove.isAlive) {
            return;
          }
          const distToTarget = Math.hypot(strikeOriginX - targetMove.x, strikeOriginZ - targetMove.z);
          const moveDistToTarget = Math.hypot(moveState.x - targetMove.x, moveState.z - targetMove.z);
          if (kind === "kick" && (distToTarget > 2.5 || moveDistToTarget > 2.5)) return; // Kick out of range
          if (kind === "rifle" && (distToTarget > 35.0 || moveDistToTarget > 35.0)) return; // Rifle out of range
          if (checkContainerRayObstruction(strikeOriginX, strikeOriginZ, targetMove.x, targetMove.z, 1.0, 1.0)) {
            return; // Strike line of sight obstructed by container
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

          const rRecTarget = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
          const oRecTarget = rRecTarget?.operatives?.[targetId];
          const preCustodySnapshot = oRecTarget ? JSON.parse(JSON.stringify(oRecTarget)) : null;

          targetMove.armor = preHitArmor;
          targetMove.health = preHitHealth;
          const absorbed = Math.min(targetMove.armor, dmg);
          targetMove.armor -= absorbed;
          const leftover = dmg - absorbed;
          targetMove.health = Math.max(0, targetMove.health - leftover);
          if (targetMove.health <= 0) {
            targetMove.health = 0;
            targetMove.isAlive = false;
            targetMove.isKia = true;
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
            try {
              ws.send(JSON.stringify({
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
                },
              }));
            } catch {}
          } catch (saveErr) {
            // Atomic rollback on persistence failure: restore complete memory & custody snapshot cleanly
            targetMove.health = preHitHealth;
            targetMove.armor = preHitArmor;
            targetMove.isAlive = preHitAlive;
            targetMove.isKia = preHitKia;
            if (oRecTarget && preCustodySnapshot) {
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
          // Authoritative stamp: this strike was validated AND persisted by the relay
          // authority. Receivers apply target vitals ONLY on this marker.
          packet.data.serverAuthoritative = true;

          // 6. Grant target operative movement budget for physical knockback ONLY after complete verification (strictly kick only)

          if (kind === "kick") {
            const rawKnockX = packet.data?.knockX;
            const rawKnockZ = packet.data?.knockZ;
            const knockAllowance = Math.min(5.0, Math.hypot(rawKnockX || 0, rawKnockZ || 0) || 4.5);
            targetMove.budget = Math.min(8.0, targetMove.budget + knockAllowance);
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
        if (!packet.eventId || typeof packet.eventId !== "string" || !packet.eventId.trim()) {
          return;
        }
        if (typeof packet.timestamp !== "number" || !Number.isFinite(packet.timestamp) || packet.timestamp <= 0 || packet.timestamp > Date.now() + 2000) {
          return;
        }
        const rawKind = packet.data?.kind;
        if (rawKind !== "kick" && rawKind !== "rifle") {
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

        // 3. Validate damage > 0 and bounded strictly by weapon type (rifle <= 24, kick <= 35)
        const maxAllowedDmg = rawKind === "kick" ? 35 : 24;
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
        } else {
          const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
          if (weaponState.isReloading && hitNow < weaponState.reloadEnd) {
            return; // Operative is reloading: cannot fire
          }
          if (weaponState.ammo <= 0) {
            return; // Operative out of ammunition: cannot fire
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
          setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo - 1);
        }

        const strikeApplied = applyOperativeStrike({ ws, packet, targetId, kind: rawKind, dmg, ackEventId: packet.eventId });
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
          m.health = Math.max(0, m.health - safeDmg);
          m.vitalsSeq = nextVitalsSeq(m.id, ws.raidId);
          if (m.health <= 0) m.isAlive = false;
          const rRecord = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
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
        if (rawKind !== "kick" && rawKind !== "rifle") {
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
        const safeDmg = kind === "kick" ? Math.min(rawDmg, 50) : Math.min(rawDmg, 24);
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
        } else {
          const weaponState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
          if (weaponState.isReloading && now < weaponState.reloadEnd) {
            sendRejectionSync(m);
            return; // Operative is reloading: cannot fire
          }
          if (weaponState.ammo <= 0) {
            sendRejectionSync(m);
            return; // Operative out of ammunition: cannot fire
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
          setAuthoritativeOperativeAmmo(settlement, ws.raidId, ws.operativeId, weaponState.ammo - 1);
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
        m.health = Math.max(0, m.health - safeDmg);
        if (m.health <= 0) m.isAlive = false;
        // Sequence advances ONCE, BEFORE the durable save — health, alive, and vitalsSeq
        // persist in the SAME transaction; the durable copy can never trail the live
        // sequence (which would make valid recovery updates look stale to clients).
        m.vitalsSeq = nextVitalsSeq(m.id, ws.raidId);
        const rRecord = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
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
        const CRATE_LOCATIONS = {
          crate_01: { x: -8, z: -6 },
          crate_02: { x: 20, z: -15 },
          crate_03: { x: -18, z: 22 },
        };
        const cratePos = cid ? CRATE_LOCATIONS[cid] : null;
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
            const wsState = getRaidOperativeWeaponState(ws.raidId, ws.operativeId);
            wsState.ammo = 30;
            wsState.isReloading = false;
            if (prevClaimant && prevClaimant !== ws.operativeId) {
              const updatedRec = settlement.getRaidRecord ? settlement.getRaidRecord(ws.raidId) : null;
              const prevCustody = updatedRec?.operatives?.[prevClaimant];
              if (prevCustody && typeof prevCustody.ammo === "number") {
                const prevWsState = getRaidOperativeWeaponState(ws.raidId, prevClaimant);
                prevWsState.ammo = prevCustody.ammo;
              }
            }
          }
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
              if (!nowAlive) oRec.isAlive = false;
            }
            if (nowAlive && typeof settlement.recordOperativeKia === "function") {
              // no-op guard for clarity: K.I.A. only recorded when health reaches 0
            }
            if (!nowAlive && typeof settlement.recordOperativeKia === "function") {
              // Approved internal lifecycle caller ('system') — operative fell to
              // automated facility defenses in an authoritative machine attack.
              settlement.recordOperativeKia(raidId, target.id, "system");
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

  server.settlement = settlement;
  server.requestHandler = requestHandler;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.STICK_ZONE_SERVER_SECRET) {
      console.error("FATAL: STICK_ZONE_SERVER_SECRET environment variable is required to start production server");
      process.exit(1);
    }
    if (!process.env.SZ_SECRET_PLAYER || !process.env.SZ_SECRET_ALPHA || !process.env.SZ_SECRET_BRAVO) {
      console.error("FATAL: SZ_SECRET_PLAYER, SZ_SECRET_ALPHA, and SZ_SECRET_BRAVO environment variables are required in production");
      process.exit(1);
    }
  }
  const server = createStickZoneServer();
  server.listen(PORT, () => {
    console.log(`Stick Zone production server listening on http://localhost:${PORT} (WebSocket at /syncplay-ws)`);
  });
}
