#!/usr/bin/env node
/**
 * @file coop-host-proof.mjs
 * Hosted two-context browser proof for Stick Zone co-op.
 *
 * A local parent page mounts the real game in an iframe with the RUN
 * host mount params (_pid, _parent, _nonce), so the SDK builds its
 * RemoteHost. The parent answers the bridge protocol exactly like the
 * Venus hosted smoke client: INITIALIZE_SDK returns the room server URL
 * and profile, H5_EXTRACTION_HTTP forwards to the local backend with the
 * player's emulator token. Two browser contexts Deploy into one raid;
 * the proof asserts both reach a live spoke and that confirmed movement
 * crosses contexts. Everything runs on loopback: no shared dev contact.
 *
 * Prerequisites match scripts/coop-stack-proof.mjs (built Venus develop
 * worktree, Redis, Java 21, emulators via firebase emulators:exec), plus
 * the asset pack staged (INKLINE_PACK_DIR) for the game dev server.
 *
 * Install the published SDK 5.38.0 or later. Its RemoteHost uses the
 * real extraction RPC transport. No packed SDK override is required.
 *
 * Run from games/stick-zone:
 *   JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
 *   PATH=$JAVA_HOME/bin:$PATH INKLINE_PACK_DIR=<run-inkline dir> \
 *   FIREBASE_PROJECT_ID=demo-inkline-coop firebase emulators:exec \
 *     --only firestore,auth --project demo-inkline-coop \
 *     --config /tmp/venus-dev-wt/server/cloud-run/smoke/synchub-flow-emulators.json \
 *     'node --no-node-snapshot scripts/coop-host-proof.mjs'
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { createRequire } from "node:module";
import { join } from "node:path";
import { chromium } from "playwright";

const VENUS = process.env.VENUS_DEV_DIR ?? "/tmp/venus-dev-wt";
const CLOUD_RUN = join(VENUS, "server/cloud-run");
const GAME_DIR = join(import.meta.dirname, "..");
const GAME_PORT = 58392;
const GAME_ORIGIN = `http://localhost:${GAME_PORT}`;
// Fixed so the backend CORS allowlist can name the host origin exactly.
const HOST_PORT = 41730;
const HOST_ORIGIN = `http://127.0.0.1:${HOST_PORT}`;
for (const required of [
  join(CLOUD_RUN, "dist/synchub/raidRuntime.js"),
  join(VENUS, "server/mp-room-server/dist/server.js"),
]) {
  if (!existsSync(required)) {
    console.error(`[coop-host-proof] Missing built Venus artifact: ${required}`);
    process.exit(2);
  }
}

const requireFromCloudRun = createRequire(join(CLOUD_RUN, "smoke/proof-anchor.mjs"));
const { toFirestoreRules } = requireFromCloudRun("../dist/synchub/logRepository.js");
const admin = requireFromCloudRun("firebase-admin");
const Redis = requireFromCloudRun("ioredis");

const projectId = process.env.FIREBASE_PROJECT_ID;
assert.match(projectId ?? "", /^demo-/u);
const redisUrl = new URL(process.env.SYNCHUB_PROOF_REDIS_URL ?? "redis://127.0.0.1:16379");

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

const runId = `inkline-host-${randomUUID()}`;
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
let browser;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function until(label, read, timeoutMs = 60000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const result = await read();
    if (result) return result;
    await sleep(100);
  }
  throw new Error(`Timed out: ${label}`);
}
async function freePort() {
  const server = createNetServer();
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
    ALLOWED_ORIGINS: HOST_ORIGIN,
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

const NONCE = "coop-host-proof-nonce";

function hostHtml(cfg) {
  // The hosted SDK constructs its CDN base from the page URL and only
  // accepts the per-app subdomain or legacy /{bucket}/{gameId}/{version}/
  // shapes, so the iframe mounts under the legacy path.
  const gameUrl =
    `${GAME_ORIGIN}/bucket/${encodeURIComponent(gameId)}/v1/?_pid=coop-host-proof&_parent=${encodeURIComponent(cfg.hostOrigin)}` +
    `&_appId=${encodeURIComponent(gameId)}&_nonce=${NONCE}`;
  return `<!doctype html>
<meta charset="utf-8"><title>Stick Zone co-op host proof</title>
<body style="margin:0;background:#0b0f16">
<iframe id="game" src="${gameUrl}" style="border:0;width:100vw;height:100vh;display:block"></iframe>
<script>
const CFG = ${JSON.stringify(cfg)};
const frame = document.getElementById('game');
function respond(message, value, error) {
  const envelope = {
    type: 'H5_RESPONSE', direction: 'APP_TO_H5', instanceId: 'coop-host-proof',
    timestamp: Date.now(), nonce: '${NONCE}',
    data: { requestId: message.data.requestId, success: !error, value: value, ...(error ? { error: String(error.message || error) } : {}) },
  };
  frame.contentWindow.postMessage(JSON.stringify(envelope), CFG.gameOrigin);
}
window.addEventListener('message', (event) => {
  if (event.origin !== CFG.gameOrigin) return;
  let message;
  try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
  if (!message || !message.data || !message.data.requestId) return;
  (async () => {
    let value = {};
    if (message.type === 'INITIALIZE_SDK') {
      value = {
        instanceId: 'coop-host-proof', roomServerUrl: CFG.roomServerUrl,
        profile: { id: CFG.uid, username: 'CoopProof', isAnonymous: false },
        device: {}, environment: {}, locale: 'en-US', languageCode: 'en',
        launchParams: {}, shareParams: {},
      };
    } else if (message.type === 'H5_GAMEPAD_SUBSCRIBE') {
      value = { supported: false };
    } else if (message.type === 'H5_EXTRACTION_HTTP') {
      const { method, path, body } = message.data;
      const response = await fetch(CFG.baseUrl + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CFG.token },
        ...(method === 'POST' ? { body: JSON.stringify(path.endsWith('/prepare') ? { ...body, gameId: CFG.gameId, raidId: CFG.raidId } : body) } : {}),
      });
      value = { status: response.status, body: await response.text() };
    }
    respond(message, value);
  })().catch((error) => respond(message, undefined, error));
});
</script>`;
}

function startHostServer(identities, roomPort) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const index = Number(url.searchParams.get("p") ?? "0");
      const identity = identities[index] ?? identities[0];
      const hostOrigin = `http://127.0.0.1:${server.address().port}`;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        hostHtml({
          hostOrigin,
          gameOrigin: GAME_ORIGIN,
          baseUrl,
          roomServerUrl: `http://127.0.0.1:${roomPort}`,
          gameId,
          raidId,
          uid: identity.uid,
          token: identity.token,
        }),
      );
    });
    server.listen(HOST_PORT, "127.0.0.1", () => resolve(server));
  });
}

function startGameDevServer() {
  // Stage assets exactly like predev, then run Vite directly: spawning
  // the npm shim fails with ENOEXEC under emulators:exec.
  const stage = spawnSync(process.execPath, ["scripts/stage-inkline-assets.mjs"], {
    cwd: GAME_DIR,
    env: { ...process.env },
    stdio: "inherit",
  });
  if (stage.status !== 0) throw new Error(`Asset staging failed with ${stage.status}`);
  const child = spawn(process.execPath, [join(GAME_DIR, "node_modules/vite/bin/vite.js"), "--port", String(GAME_PORT)], {
    cwd: GAME_DIR,
    env: { ...process.env },
    stdio: ["ignore", "inherit", "inherit"],
  });
  children.push(child);
  return until("game dev server", async () => {
    if (child.exitCode !== null) throw new Error(`Game dev server exited ${child.exitCode}`);
    try {
      return (await fetch(`${GAME_ORIGIN}/`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      return false;
    }
  });
}

async function cleanup(hostServer) {
  try {
    await browser?.close();
  } catch {}
  hostServer?.close();
  for (const child of [...children].reverse()) {
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
    console.error("[coop-host-proof] Cleanup incomplete:", err);
  }
  await firebase.delete();
  console.log("[coop-host-proof] Cleanup complete");
}

let hostServer;
try {
  console.log(`[coop-host-proof] World ${projectId}; fixtures=${runId}`);
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
  await startGameDevServer();
  hostServer = await startHostServer(identities, roomPort);
  const hostOrigin = HOST_ORIGIN;

  browser = await chromium.launch();
  const pages = [];
  for (const index of [0, 1]) {
    const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
    const page = await context.newPage();
    page.on("pageerror", (err) => console.log(`[host-proof][p${index}] pageerror:`, err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`[host-proof][p${index}] console.${msg.type()}:`, msg.text().slice(0, 300));
      }
    });
    await page.goto(`${hostOrigin}/?p=${index}`);
    const frame = page.frameLocator("#game");
    await frame.locator("canvas").first().waitFor({ timeout: 60000 });
    pages.push({ context, page, frame });
  }
  console.log("PASS: both hosted game frames boot");
  const hostDiag = await pages[0].frame.locator("body").evaluate(() =>
    JSON.stringify({
      search: window.location.search,
      rundotConfig: (window).__rundotConfig ?? null,
      playgroundFactory: typeof (globalThis).__RUNDOT_PLAYGROUND_HOST_FACTORY__,
      rnwv: typeof window.ReactNativeWebView,
      bootstrap: (window).RundotGameAPI?._bootstrap ?? null,
      hostName: (window).RundotGameAPI?.host?.constructor?.name ?? null,
      extractionName: (window).RundotGameAPI?.extraction?.constructor?.name ?? null,
      hostExtractionName: (window).RundotGameAPI?.host?.extraction?.constructor?.name ?? null,
      sameExtraction: (window).RundotGameAPI?.extraction === (window).RundotGameAPI?.host?.extraction,
    }),
  );
  console.log("[host-proof][diag] host selection:", hostDiag);

  for (const [index, entry] of pages.entries()) {
    await entry.frame.getByRole("button", { name: "ARSENAL [TAB]" }).evaluate((button) => button.click());
    await entry.frame.getByRole("button", { name: "DEPLOY TO SECTOR 7" }).evaluate((button) => button.click());
    try {
      await until(`player ${index} co-op live`, async () =>
        entry.frame.locator("body").evaluate(() => {
          const log = (window).__STICK_ZONE_TEST__?.sim?.combatLog ?? [];
          return log.some((line) => line.includes("[CO-OP] SyncHub raid"));
        }),
      );
    } catch (err) {
      const tail = await entry.frame
        .locator("body")
        .evaluate(() => (window).__STICK_ZONE_TEST__?.sim?.combatLog?.slice(-8) ?? ["<no harness>"]);
      console.log(`[host-proof][p${index}] combatLog tail:`, JSON.stringify(tail));
      throw err;
    }
  }
  console.log("PASS: both browsers Deploy into one live co-op raid");

  const rivalOf = async (entry) =>
    entry.frame.locator("body").evaluate(() => {
      const rival = window.__STICK_ZONE_TEST__?.sim?.rivals?.find((r) =>
        String(r.id).startsWith("coop-slot-"),
      );
      return rival ? { id: rival.id, x: rival.x, z: rival.z } : null;
    });
  await until("squadmate visible in second context", async () => rivalOf(pages[1]));
  const before = await rivalOf(pages[1]);
  await pages[0].page.locator("#game").focus();
  await pages[0].page.keyboard.down("KeyS");
  try {
    await until("squadmate confirmed movement across contexts", async () => {
      const now = await rivalOf(pages[1]);
      return now && Math.abs(now.z - before.z) + Math.abs(now.x - before.x) > 0.5;
    });
  } finally {
    await pages[0].page.keyboard.up("KeyS");
  }
  console.log("PASS: confirmed squadmate movement crosses browser contexts");

  for (const [index, entry] of pages.entries()) {
    await entry.page.locator("#game").focus();
    const held = new Set();
    try {
      await until(`player ${index} walks to the extraction center`, async () => {
        const pos = await entry.frame.locator("body").evaluate(() => {
          const sim = window.__STICK_ZONE_TEST__.sim;
          return { x: sim.player.x, z: sim.player.z, alive: sim.player.isAlive };
        });
        assert.ok(pos.alive, `Player ${index} died during the movement proof`);
        const dx = 45 - pos.x;
        const dz = 45 - pos.z;
        const arrived = Math.hypot(dx, dz) <= 2;
        const wanted = new Set();
        if (!arrived) {
          if (Math.abs(dx) > 1) wanted.add(dx > 0 ? "KeyD" : "KeyA");
          if (Math.abs(dz) > 1) wanted.add(dz > 0 ? "KeyS" : "KeyW");
        }
        for (const key of held) if (!wanted.has(key)) await entry.page.keyboard.up(key);
        for (const key of wanted) if (!held.has(key)) await entry.page.keyboard.down(key);
        held.clear();
        for (const key of wanted) held.add(key);
        return arrived;
      });
    } finally {
      for (const key of held) await entry.page.keyboard.up(key);
    }
    await until(`player ${index} renders the live settled debrief`, () =>
      entry.frame.locator("body").evaluate(() => !!document.querySelector('[data-completion="settled"]')),
    );
    const completion = await entry.frame.locator('[data-completion="settled"]').innerText();
    assert.ok(completion.includes("SYNCHUB DEBRIEF SETTLED"));
    assert.ok(!/cryptographic|verified/i.test(completion));
    console.log(`PASS: player ${index} renders the live settled debrief`);
  }

  await pages[0].page.screenshot({ path: "/tmp/inkline-browser-artifacts/hosted-coop-a.png" });
  await pages[1].page.screenshot({ path: "/tmp/inkline-browser-artifacts/hosted-coop-b.png" });
  console.log("[coop-host-proof] ALL CHECKS PASSED");
} finally {
  await cleanup(hostServer);
}
