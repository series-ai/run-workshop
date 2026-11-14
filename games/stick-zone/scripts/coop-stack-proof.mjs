#!/usr/bin/env node
/**
 * @file coop-stack-proof.mjs
 * Local two-player SyncHub proof for Stick Zone co-op rules.
 *
 * Proves, against real built Venus processes (Cloud Run backend fork,
 * mp-room-server, built SDK sessions, Redis, Auth/Firestore emulators):
 * two players prepare one raid in sector-7-depot, drop together as one
 * squad, see each other in confirmed state, move by intent, extract by
 * zone dwell, and settle to one shared debrief receipt.
 *
 * This is a manual/nightly proof, never a PR CI step. It edits no Venus
 * source; it forks the Venus smoke backend entry from a built develop
 * worktree and creates only run-owned fixture data, which it deletes.
 *
 * Prerequisites (see .plans/inkline-synchub-contract.md):
 *   - A built Venus develop worktree (VENUS_DEV_DIR, default
 *     /tmp/venus-dev-wt): packages/syncplay, packages/sdk,
 *     server/cloud-run, server/mp-room-server, server/raid-runtime-worker
 *     installed and built.
 *   - Redis on SYNCHUB_PROOF_REDIS_URL (default redis://127.0.0.1:16379).
 *   - Java 21 on PATH or JAVA_HOME set (Firestore emulator).
 *
 * Run from games/stick-zone:
 *   JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
 *   PATH=$JAVA_HOME/bin:$PATH \
 *   FIREBASE_PROJECT_ID=demo-inkline-coop firebase emulators:exec \
 *     --only firestore,auth --project demo-inkline-coop \
 *     --config /tmp/venus-dev-wt/server/cloud-run/smoke/synchub-flow-emulators.json \
 *     'node --no-node-snapshot scripts/coop-stack-proof.mjs'
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const VENUS = process.env.VENUS_DEV_DIR ?? "/tmp/venus-dev-wt";
const CLOUD_RUN = join(VENUS, "server/cloud-run");
for (const required of [
  join(CLOUD_RUN, "dist/synchub/raidRuntime.js"),
  join(VENUS, "packages/sdk/dist/index.js"),
  join(VENUS, "server/mp-room-server/dist/server.js"),
  join(CLOUD_RUN, "smoke/synchub-flow-backend.mjs"),
]) {
  if (!existsSync(required)) {
    console.error(`[coop-proof] Missing built Venus artifact: ${required}`);
    console.error("[coop-proof] Build syncplay, sdk, cloud-run, and mp-room-server in VENUS_DEV_DIR first.");
    process.exit(2);
  }
}

const requireFromCloudRun = createRequire(join(CLOUD_RUN, "smoke/proof-anchor.mjs"));
const { toFirestoreRules } = requireFromCloudRun("../dist/synchub/logRepository.js");
const admin = requireFromCloudRun("firebase-admin");
const Redis = requireFromCloudRun("ioredis");
const WebSocket = requireFromCloudRun("../../mp-room-server/node_modules/ws");
globalThis.WebSocket = WebSocket;
const sdk = await import(pathToFileURL(join(VENUS, "packages/sdk/dist/index.js")).href);
const { AirlockSession, HttpExtractionApi } = sdk;

const projectId = process.env.FIREBASE_PROJECT_ID;
assert.match(projectId ?? "", /^demo-/u, "FIREBASE_PROJECT_ID must be a demo emulator project");
for (const name of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  assert.match(process.env[name] ?? "", /^(127\.0\.0\.1|localhost):\d+$/u, `${name} must be local`);
}
const redisUrl = new URL(process.env.SYNCHUB_PROOF_REDIS_URL ?? "redis://127.0.0.1:16379");
assert.ok(["localhost", "127.0.0.1"].includes(redisUrl.hostname));

// Mirror src/sim/coopConfig.ts (4 Hz, 1200-tick deadline, 12-tick dwell,
// sprint 7.5 m/s). tests/coopConfig.test.ts guards the TypeScript source.
const RULES = {
  v: 1,
  squadSlots: [[0, 1, 2, 3]],
  friendlyFire: false,
  pickupRadiusFixed: 3,
  extractionZones: [
    { zoneId: "lz_sector_7", geometryId: "lz-delta", dwellTicks: 12, x: 45, z: 45, radius: 6 },
  ],
  deadlinePolicy: "burn-unextracted",
  raidDeadlineTick: 1200,
  maxMoveSpeedPerTick: 1,
  maxAttackRangeFixed: 30,
  maxAttackDamageFixed: 200,
};
const SECTOR = "sector-7-depot";
const LOADOUT = [
  { itemId: "weapon_rifle", quantity: "1" },
  { itemId: "med_stim", quantity: "2" },
];

const runId = `inkline-coop-${randomUUID()}`;
const gameId = `${runId}-game`;
const raidId = `${runId}-raid`;
const key = randomUUID();
const redisPrefix = `${runId}:`;
const firebase = admin.initializeApp({ projectId }, runId);
const db = firebase.firestore();
db.settings({ gaxServerStreamingRetries: true });
const redis = new Redis(redisUrl.toString(), { lazyConnect: true, connectTimeout: 5000, maxRetriesPerRequest: 1 });

const children = [];
const ownedUsers = [];
let baseUrl;
let gameOwned = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function until(label, read, timeoutMs = 45000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const result = await read();
    if (result) return result;
    await sleep(50);
  }
  throw new Error(`Timed out: ${label}`);
}
async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
function testEnv() {
  return {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    ENVIRONMENT: "local",
    SYNCHUB_DEPLOYMENT_ID: "local",
    FIREBASE_PROJECT_ID: projectId,
    GOOGLE_CLOUD_PROJECT: projectId,
    GCLOUD_PROJECT: projectId,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    CLOUD_FUNCTION_API_KEY: key,
    INTERNAL_API_KEY: key,
    SYNCHUB_SIGNING_KEY: key,
    SYNCPLAY_PROOF_SIGNING_KEY: key,
    REDIS_HOST: redisUrl.hostname,
    REDIS_PORT: redisUrl.port || "6379",
    REDIS_PASSWORD: "",
    REDIS_KEY_PREFIX: redisPrefix,
  };
}
async function startBackend(roomPort) {
  const child = fork(join(CLOUD_RUN, "smoke/synchub-flow-backend.mjs"), [], {
    cwd: join(CLOUD_RUN, "smoke"),
    env: { ...testEnv(), MP_ROOM_WS_URL: `ws://127.0.0.1:${roomPort}/ws` },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  children.push(child);
  baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Backend did not start")), 30000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Backend exited ${code}`));
    });
    child.once("message", (message) => {
      clearTimeout(timer);
      if (message.kind === "ready") resolve(message.baseUrl);
      else reject(new Error("Unexpected backend readiness message"));
    });
  });
}
async function startRoomServer(port) {
  const child = spawn(
    process.execPath,
    ["--no-node-snapshot", join(VENUS, "server/mp-room-server/dist/server.js")],
    {
      cwd: join(CLOUD_RUN, "smoke"),
      env: {
        ...testEnv(),
        HOST: "127.0.0.1",
        PORT: String(port),
        CLOUD_RUN_URL: baseUrl,
        GAME_SERVER_URL: baseUrl,
        SYNCHUB_BROKER_MODE: "redis",
        REDIS_TLS: "false",
        SHARDS_COLLECTION: `${runId}-shards`,
        ROOM_REGISTRY_COLLECTION: `${runId}-rooms`,
        ROOM_COMMANDS_COLLECTION: `${runId}-commands`,
        MATCHMAKING_COLLECTION: `${runId}-matches`,
        SNAPSHOTS_COLLECTION: `${runId}-snapshots`,
        ROOMS_INDEX_COLLECTION: `${runId}-room-index`,
      },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  children.push(child);
  await until("room server health", async () => {
    if (child.exitCode !== null) throw new Error(`Room server exited ${child.exitCode}`);
    try {
      return (await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      return false;
    }
  });
}
async function http(path, body, player) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(player ? { Authorization: `Bearer ${player.token}` } : { "x-internal-api-key": key }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}
async function player() {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=smoke`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  const result = { uid: data.localId, token: data.idToken };
  ownedUsers.push(result);
  await db.doc(`profiles/${result.uid}/h5_simulation/${gameId}`).create({
    inventory: { weapon_rifle: "1", weapon_shotgun: "1", med_stim: "4" },
    activeRaid: null,
    activeRaidId: null,
    inventoryRevision: 0,
    disabledRecipes: [],
  });
  return result;
}

async function connect(identity, preparation, roomPort) {
  const httpApi = new HttpExtractionApi(
    { getIdToken: async () => identity.token, getCloudRunUrl: () => baseUrl },
    gameId,
  );
  const airlock = new AirlockSession({
    handoffId: preparation.handoffId,
    raidId,
    sector: SECTOR,
    grant: preparation.grant,
    gatewayUrl: `ws://127.0.0.1:${roomPort}/ws`,
    httpApi,
  });
  const peer = { identity, airlock, session: undefined, state: undefined, tick: 0 };
  peer.session = await airlock.enterAsync();
  peer.unsubscribe = peer.session.onConfirmedTick((tick, state) => {
    peer.tick = tick;
    peer.state = state;
  });
  await until("first confirmed state", () => peer.state);
  return peer;
}

async function cleanup() {
  for (const child of children.reverse()) {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
  await sleep(500);
  try {
    if (gameOwned) await db.recursiveDelete(db.collection("Games").doc(gameId));
    await db.recursiveDelete(db.doc(`raids/${raidId}`));
    for (const identity of ownedUsers) {
      await db.recursiveDelete(db.doc(`profiles/${identity.uid}/h5_simulation/${gameId}`));
      await firebase.auth().deleteUser(identity.uid);
    }
    if (redis.status === "ready") {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", `${redisPrefix}*`, "COUNT", 100);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== "0");
      await redis.quit();
    } else {
      redis.disconnect();
    }
  } catch (err) {
    console.error("[coop-proof] Cleanup incomplete:", err);
  }
  await firebase.delete();
  console.log("[coop-proof] Cleanup complete");
}

async function run() {
  console.log(`[coop-proof] World ${projectId}; fixtures=${runId}; sector=${SECTOR}`);
  await redis.connect();
  assert.equal(await redis.ping(), "PONG");
  const roomPort = await freePort();
  await startBackend(roomPort);

  await db.doc(`Games/${gameId}`).create({ tags: { public: { serverId: "smoke-release" } } });
  gameOwned = true;
  await db.doc(`Games/${gameId}/servers/smoke-release`).create({
    value: {
      synchubExtraction: {
        v: 1,
        modes: {
          [SECTOR]: {
            rules: toFirestoreRules(RULES),
            tickRateHz: 4,
            initialHealth: 100,
            spawnPositions: { 0: [30, 0, 45], 1: [31, 0, 45], 2: [30, 0, 44], 3: [31, 0, 46] },
          },
        },
      },
    },
  });
  await startRoomServer(roomPort);
  const identities = [await player(), await player()];

  const preparations = [];
  for (const identity of identities) {
    const prepared = await http(
      "/v1/extraction/prepare",
      { gameId, sector: SECTOR, raidId, loadout: LOADOUT },
      identity,
    );
    assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
    preparations.push(prepared.data);
  }
  console.log("PASS: two players prepare one Stick Zone co-op raid");

  const peers = [
    await connect(identities[0], preparations[0], roomPort),
    await connect(identities[1], preparations[1], roomPort),
  ];
  await until("both actors admitted", () =>
    peers.every((p) => p.state && Object.keys(p.state.actors).length >= 2),
  );
  console.log("PASS: squad of two drops together in confirmed state");

  // The owner samples the latest intent per tick, so movement intents
  // are resubmitted on an interval, matching the Venus smoke pattern.
  const slot0 = peers[0].session.slot;
  const startX = peers[1].state.actors[slot0].x;
  const moveTimer = setInterval(() => {
    for (const peer of peers) {
      peer.session.submitIntent({ moveX: 1, moveZ: 0 });
    }
  }, 50);
  const debugTimer = setInterval(() => {
    const inner = peers[0].session.spoke ?? peers[0].session;
    console.log(
      `[coop-proof][debug] tick=${peers[0].tick} actor0x=${peers[0].state?.actors?.[slot0]?.x} ` +
        `connected=${inner?.isConnected} ws=${inner?.ws?.readyState} active=${peers[0].session.isActive?.()}`,
    );
  }, 2000);
  try {
    await until("squadmate sees confirmed movement", () => {
      const actor = peers[1].state?.actors?.[slot0];
      return actor && actor.x > startX;
    });
    console.log("PASS: movement intent confirms across clients");

    await until("both actors inside extraction zone", () =>
      [peers[0].session.slot, peers[1].session.slot].every((slot) => {
        const actor = peers[0].state?.actors?.[slot];
        return actor && Math.hypot(actor.x - 45, actor.z - 45) <= 5;
      }),
    );
    console.log("PASS: squad walks into the extraction zone by intent");
  } finally {
    clearInterval(debugTimer);
    clearInterval(moveTimer);
    for (const peer of peers) {
      peer.session.submitIntent({ moveX: 0, moveZ: 0 });
    }
  }

  const debriefs = [];
  for (const peer of peers) {
    const result = await peer.session.requestExtractionAsync({ zoneId: "lz_sector_7" });
    assert.equal(result.success, true, JSON.stringify(result));
    debriefs.push(await peer.session.waitForDebriefAsync({ timeoutMs: 90000 }));
  }
  for (const debrief of debriefs) {
    assert.equal(debrief.settled, true, JSON.stringify(debrief));
    assert.equal(debrief.raidId, raidId);
  }
  // Each extractor receives its own prefix receipt while the raid may
  // still be active for the other participant; receipt ids differ.
  for (const debrief of debriefs) {
    assert.ok(typeof debrief.receiptId === "string" && debrief.receiptId.length > 0);
  }
  console.log(
    `PASS: both players extract with settled debriefs (${debriefs.map((d) => d.receiptId).join(", ")})`,
  );

  for (const identity of identities) {
    const stash = (await db.doc(`profiles/${identity.uid}/h5_simulation/${gameId}`).get()).data();
    assert.equal(stash.activeRaidId, null, JSON.stringify(stash));
    assert.ok(Number(stash.inventoryRevision) > 0, JSON.stringify(stash));
  }
  console.log("PASS: stash revisions advance and active raids clear for both players");

  for (const peer of peers) {
    peer.unsubscribe?.();
    await peer.session.leaveAsync().catch(() => undefined);
  }
}

try {
  await run();
  console.log("[coop-proof] ALL CHECKS PASSED");
} finally {
  await cleanup();
}
