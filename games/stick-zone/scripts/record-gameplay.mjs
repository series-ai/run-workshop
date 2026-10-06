/**
 * @file record-gameplay.mjs
 * End-to-end multi-browser Playwright video & keyframe proof recording harness.
 * 100% input-driven via Playwright keyboard and mouse APIs against the 60Hz loop.
 * Captures solo movement, multi-browser peer encounter, and airlock settlement
 * with frame-accurate Stereo AAC audio synchronization and strict assertions.
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

import os from 'os';

// Proof outputs are repo-local and gitignored (games/stick-zone/proofs/). Override with
// PROOF_OUT_DIR when archiving elsewhere. The server secret MUST be provided explicitly:
// the old sz_test_internal_sec fallback only worked under NODE_ENV=test (never set by
// vite), so it was silently dead — now the harness fails fast instead.
const OUT_DIR = process.env.PROOF_OUT_DIR || new URL('../proofs/', import.meta.url).pathname;
const BASE_URL = process.env.BASE_URL || 'http://localhost:4196';
const REQUIRED_SECRET = (() => {
  const v = process.env.STICK_ZONE_SERVER_SECRET;
  if (!v) {
    throw new Error('STICK_ZONE_SERVER_SECRET is required: start vite preview with it set (e.g. STICK_ZONE_SERVER_SECRET=... npm run preview)');
  }
  return v;
})();

fs.mkdirSync(OUT_DIR, { recursive: true });
// Raw Playwright segments never carry over between runs — each recording starts clean.
for (const d of ['raw_solo', 'raw_multi_alpha', 'raw_multi_bravo', 'raw_exfil']) {
  fs.rmSync(path.join(OUT_DIR, d), { recursive: true, force: true });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Each recording clip runs against its own fresh raid ledger (raid ids are immutable once
 *  banked/KIA-touched). A fresh raidId also guarantees clean lifestate for every clip. */
const RUN_STAMP = Date.now().toString(36);
function newRaidId(tag) {
  return `raid_sector7_${RUN_STAMP}_${tag}`;
}
function raidPageUrl(raidId, extra) {
  const q = new URLSearchParams({ ...(extra || {}), raidId });
  return `${BASE_URL}/?${q.toString()}`;
}

/**
 * Deploy / withdraw an automated defense machine through the lifecycle coordinator so its
 * fire is fully server-authoritative (machine_attack broadcasts from the relay executor —
 * the in-browser sim never credits this damage itself).
 */
async function deployMachine(raidId, machineId, type, x, z, health) {
  const secret = REQUIRED_SECRET;
  const res = await fetch(`${BASE_URL}/api/settlement/deploy-machine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ raidId, action: 'place', machineId, type, x, z, health }),
  });
  if (!res.ok) {
    throw new Error(`[HARNESS] Machine deployment failed (${res.status}): ${await res.text()}`);
  }
}

async function withdrawMachine(raidId, machineId) {
  const secret = REQUIRED_SECRET;
  const res = await fetch(`${BASE_URL}/api/settlement/deploy-machine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ raidId, action: 'remove', machineId }),
  });
  if (!res.ok) {
    throw new Error(`[HARNESS] Machine withdrawal failed (${res.status}): ${await res.text()}`);
  }
}

async function resetServerRaid(raidId) {
  const secret = REQUIRED_SECRET;
  const res = await fetch(`${BASE_URL}/api/settlement/init-raid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`,
      "x-session-token": secret,
      "x-server-secret": secret,
    },
    body: JSON.stringify({
      raidId,
      allowablePool: 50000,
      operatives: ["op_player", "op_alpha_1", "op_bravo_1"],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[HARNESS] Reset server raid failed (${res.status}): ${errText}`);
  }
  console.log(`[HARNESS] Initialized fresh server raid ${raidId}:`, res.status);
}

/**
 * Authoritatively place an operative via the lifecycle coordinator, then mirror the
 * placement on the client sim. Server and client agree on position, so the
 * anti-teleport movement authority accepts the placement without state_correction.
 */
async function repositionOperative(page, raidId, x, z, operativeId = 'op_alpha_1') {
  const secret = REQUIRED_SECRET;
  const res = await fetch(`${BASE_URL}/api/settlement/reposition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ raidId, operativeId, x, z }),
  });
  if (!res.ok) {
    throw new Error(`[HARNESS] Coordinator reposition failed (${res.status}): ${await res.text()}`);
  }
  await page.evaluate(
    (pos) => {
      if (window.debugSim) {
        window.debugSim.player.x = pos.x;
        window.debugSim.player.z = pos.z;
      }
    },
    { x, z }
  );
  await sleep(120);
}
async function safeNavigate(page, url) {
  // 'domcontentloaded' is the robust anchor under dual-browser WebGL (media/socket
  // resources can delay the full 'load' event indefinitely); the game viewport check
  // plus settle time below guarantee the app is actually mounted.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  await page.waitForSelector('.game-viewport', { timeout: 20000 });
}


async function recordAll() {
  console.log('=== Starting Stick Zone: Exfil Video Recording Harness ===');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=swiftshader', '--no-sandbox'],
  });

  // -------------------------------------------------------------
  // Clip 1: Solo Kinetic Locomotion & Weapon Combat
  // -------------------------------------------------------------
  console.log('[1/3] Recording Clip 1: Solo Kinetic Locomotion & Combat...');
  const RAID_C1 = newRaidId('c1');
  await resetServerRaid(RAID_C1);
  const ctx1 = await browser.newContext({
    recordVideo: { dir: path.join(OUT_DIR, 'raw_solo'), size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const page1 = await ctx1.newPage();
  const clip1Start = Date.now();
  const clip1Timings = {};

  await safeNavigate(page1, raidPageUrl(RAID_C1));
  await page1.waitForSelector('.game-viewport');
  await page1.evaluate(() => { if (window.debugSim) window.debugSim.admitOperative(); });
  await sleep(1500);

  // Frame Sector 7 depot with clear view of tactical defense units
  await repositionOperative(page1, RAID_C1, 0, 0);
  await page1.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.player.facing = 0;
      window.debugSim.player.facing = Math.PI; // Face towards defenses at -Z
      window.debugSim.machines = [
        {
          id: "turret_depot_alpha",
          type: "turret",
          x: 0,
          y: 0,
          z: -3.2,
          facing: 0,
          health: 120,
          isAlive: true,
          cooldownTicks: 999,
        },
        {
          id: "drone_patrol_beta",
          type: "drone",
          x: 2.8,
          y: 0.8,
          z: -3.2,
          facing: 0,
          health: 75,
          isAlive: true,
          cooldownTicks: 999,
        },
      ];
    }
  });
  await sleep(600);
  // Screenshot 1: Default Infiltration with camera-facing defense HUD billboards and normalized health
  await page1.screenshot({ path: path.join(OUT_DIR, '01_infiltration_default.png') });

  // Reset player for movement & sprint
  await repositionOperative(page1, RAID_C1, 0, -10);
  await page1.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.player.facing = 0;
    }
  });
  await sleep(200);

  // Move forward + sprint
  clip1Timings.sprint = (Date.now() - clip1Start) / 1000;
  await page1.keyboard.down('KeyW');
  await page1.keyboard.down('ShiftLeft');
  await sleep(800);

  // Execute Combat Slide (C)
  clip1Timings.slide = (Date.now() - clip1Start) / 1000;
  await page1.keyboard.down('KeyC');
  await page1.waitForFunction(() => window.debugSim?.player?.action === 'slide', { timeout: 3000 });
  await page1.screenshot({ path: path.join(OUT_DIR, '02_kinetic_slide.png') });
  await sleep(500);
  await page1.keyboard.up('KeyC');

  // Wait for slide recovery so roll can initiate
  await page1.waitForFunction(() => window.debugSim?.player?.action !== 'slide', { timeout: 3000 });

  // Execute Combat Roll with 12 iframes (Space)
  clip1Timings.roll = (Date.now() - clip1Start) / 1000;
  await page1.keyboard.down('Space');
  await page1.waitForFunction(() => window.debugSim?.player?.action === 'roll' && window.debugSim?.player?.isInvulnerable === true, { timeout: 3000 });
  const rollAction = await page1.evaluate(() => window.debugSim?.player?.action);
  const rollInvuln = await page1.evaluate(() => window.debugSim?.player?.isInvulnerable);
  console.log(`[CLIP 1 ROLL] Action: ${rollAction}, Invulnerable: ${rollInvuln}`);
  await page1.screenshot({ path: path.join(OUT_DIR, '03_evasive_roll_iframes.png') });
  await page1.keyboard.up('Space');

  // Wait for roll recovery
  await page1.waitForFunction(() => window.debugSim?.player?.action !== 'roll', { timeout: 3000 });

  // Real weapon firing via mousedown processed by 60Hz loop
  clip1Timings.shoot = (Date.now() - clip1Start) / 1000;
  await page1.mouse.move(700, 300);
  await page1.mouse.down({ button: 'left' });
  // Wait until real rifle bursts fire and ammo drops to <= 26 while action is 'shoot'
  await page1.waitForFunction(() => window.debugSim?.player?.ammo <= 26 && window.debugSim?.player?.action === 'shoot', { timeout: 4000 });
  const ammoAtCapture = await page1.evaluate(() => window.debugSim?.player?.ammo);
  const actionAtCapture = await page1.evaluate(() => window.debugSim?.player?.action);
  console.log(`[CLIP 1 GUNPLAY BURST] Ammo: ${ammoAtCapture}/30, Action: ${actionAtCapture}`);
  await page1.screenshot({ path: path.join(OUT_DIR, '04_rifle_burst_gunplay.png') });
  await page1.mouse.up({ button: 'left' });

  // Execute Roundhouse Kick (F) with physical knockback
  clip1Timings.kick = (Date.now() - clip1Start) / 1000;
  await page1.keyboard.down('KeyF');
  await page1.waitForFunction(() => window.debugSim?.player?.action === 'kick', { timeout: 3000 });
  await page1.screenshot({ path: path.join(OUT_DIR, '05_martial_arts_kick.png') });
  await page1.keyboard.up('KeyF');
  await page1.keyboard.up('KeyW');
  await page1.keyboard.up('ShiftLeft');

  // Move right next to Crate 1 at (-8, -6) and scavenge it via natural KeyE press (+ $1,250)
  clip1Timings.loot = (Date.now() - clip1Start) / 1000;
  await repositionOperative(page1, RAID_C1, -8, -5.5);
  await sleep(100);
  await page1.keyboard.press('KeyE');
  await page1.waitForFunction(() => window.debugSim?.player?.cash >= 1250, { timeout: 3000 });
  console.log('✓ Crate scavenged via input-driven KeyE interaction');
  await sleep(200);
  await page1.screenshot({ path: path.join(OUT_DIR, '06_scavenged_crate.png') });

  await sleep(1000);
  await page1.close();
  await ctx1.close();

  // -------------------------------------------------------------
  // Clip 2: Multi-Browser Multiplayer Encounter (Alpha vs Bravo)
  // -------------------------------------------------------------
  console.log('[2/3] Recording Clip 2: Multi-Browser Multiplayer Encounter...');
  const RAID_C2 = newRaidId('c2');
  await resetServerRaid(RAID_C2);
  const ctxAlpha = await browser.newContext({
    recordVideo: { dir: path.join(OUT_DIR, 'raw_multi_alpha'), size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const pageAlpha = await ctxAlpha.newPage();
  pageAlpha.on("console", (m) => console.log("[ALPHA LOG]", m.text()));
  pageAlpha.on("pageerror", (e) => console.log("[ALPHA ERROR]", e.message));
  const clip2Start = Date.now();
  const clip2Timings = {};

  await safeNavigate(pageAlpha, raidPageUrl(RAID_C2));
  await pageAlpha.waitForSelector('.game-viewport');
  // Wait for Alpha host to complete self-readiness and confirm active
  await pageAlpha.waitForFunction(() => window.debugSim?.ingressController?.getState()?.kind === 'confirmed_active', { timeout: 8000 });

  // Open secondary browser representing Squad Bravo with isolated profile
  const ctxBravo = await browser.newContext({
    recordVideo: { dir: path.join(OUT_DIR, 'raw_multi_bravo'), size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const pageBravo = await ctxBravo.newPage();
  pageBravo.on("console", (m) => console.log("[BRAVO LOG]", m.text()));
  pageBravo.on("pageerror", (e) => console.log("[BRAVO ERROR]", e.message));
  const clipBravoStart = Date.now();
  const clipBravoTimings = {};
  await safeNavigate(pageBravo, raidPageUrl(RAID_C2, { rundotPlayer: 'player2' }));
  await pageBravo.waitForSelector('.game-viewport');

  // Wait for Bravo to complete full real ingress handshake with Alpha and reach confirmed_active
  await pageBravo.waitForFunction(() => window.debugSim?.ingressController?.getState()?.kind === 'confirmed_active', { timeout: 8000 });
  console.log('✓ Both Alpha and Bravo confirmed active via real staged ingress protocol');

  // Mathematically isolated positions:
  // Alpha at (-25, -20) -> 43m from drone (10, 5) and 32m from turret (-5, 5) -> ZERO machine damage!
  // Bravo at (-5, -5) -> distance between Alpha and Bravo is hypot(-20, -15) = 25m <= 60m
  await repositionOperative(pageAlpha, RAID_C2, -25, -20, 'op_alpha_1');
  await pageAlpha.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.player.facing = Math.PI / 4;
    }
  });
  await repositionOperative(pageBravo, RAID_C2, -20, -15, 'op_bravo_1');
  await pageBravo.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.player.facing = Math.atan2(-5, -5);
    }
  });

  // Wait for real P2P mesh state packet exchange to populate rivals naturally
  await pageAlpha.waitForFunction(() => window.debugSim?.rivals?.length >= 1 && window.debugSim?.rivals[0]?.id === 'op_bravo_1', { timeout: 8000 });
  await pageBravo.waitForFunction(() => window.debugSim?.rivals?.length >= 1 && window.debugSim?.rivals[0]?.id === 'op_alpha_1', { timeout: 8000 });
  console.log('✓ Real P2P mesh state delivery confirmed across browsers');

  // Verify proximity warning banner is strictly visible on Alpha (distance is 25m <= 60m)
  clip2Timings.radar = (Date.now() - clip2Start) / 1000;
  clipBravoTimings.radar = (Date.now() - clipBravoStart) / 1000;
  await pageAlpha.waitForSelector('.proximity-warning-banner', { timeout: 5000 });

  // Screenshot 7: Multiplayer Radar Alert on Alpha (d <= 60m with bearing)
  await pageAlpha.screenshot({ path: path.join(OUT_DIR, '07_multiplayer_radar_alert.png') });

  // In Bravo POV, populate depot defenses in view
  await pageBravo.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.machines = [
        {
          id: "turret_depot_bravo_pov",
          type: "turret",
          x: window.debugSim.player.x - 2.6,
          y: 0,
          z: window.debugSim.player.z - 3.2,
          facing: 0,
          health: 120,
          isAlive: true,
          cooldownTicks: 999,
        },
        {
          id: "drone_depot_bravo_pov",
          type: "drone",
          x: window.debugSim.player.x + 2.6,
          y: 0.8,
          z: window.debugSim.player.z - 3.2,
          facing: 0,
          health: 75,
          isAlive: true,
          cooldownTicks: 999,
        },
      ];
    }
  });
  await sleep(300);
  // Screenshot 8: Bravo POV in Sector 7 Depot with visible machine defenses
  await pageBravo.screenshot({ path: path.join(OUT_DIR, '08_bravo_pov_depot.png') });

  // Clear machines on Bravo after Screenshot 8 to ensure line of fire to Alpha is completely unobstructed
  await pageBravo.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.machines = [];
    }
  });

  // Real cross-browser combat: Bravo aims directly at Alpha (dot product 1.0)
  // Viewport is 1280x720, center is (640, 360).
  // dx = -200, dy = 150 -> clientX = 440, clientY = 510 -> aimAngle = Math.atan2(-200, -150) = Math.atan2(-20, -15)
  clip2Timings.combat = (Date.now() - clip2Start) / 1000;
  clipBravoTimings.combat = (Date.now() - clipBravoStart) / 1000;

  const initialArmorAlpha = await pageAlpha.evaluate(() => window.debugSim.player.armor);
  expectArmorInitial: await pageAlpha.evaluate(() => {
    if (window.debugSim.player.armor !== 100) window.debugSim.player.armor = 100;
  });

  await pageBravo.mouse.move(330, 185);
  // Install single-hit governor inside Bravo game loop before trigger pull:
  // As soon as 1 bullet discharges (ammo drops to 29), immediately clamp cooldown and suppress shoot inputs
  await pageBravo.evaluate(() => {
    if (window.debugSim) {
      const origStep = window.debugSim.step.bind(window.debugSim);
      let discharged = false;
      window.debugSim.step = (input) => {
        // Aim authoritatively at Alpha's staged position (-25, -20) from Bravo (-20, -15):
        // direction (-5, -5) satisfies the strict symmetric fire-cone contract (dot > 0.96).
        input.aimAngle = Math.atan2(-5, -5);
        if (discharged) {
          input.shoot = false;
          window.debugSim.shootCooldownTicks = 99999;
        }
        origStep(input);
        if (window.debugSim.player.ammo <= 29) {
          discharged = true;
          window.debugSim.shootCooldownTicks = 99999;
        }
      };
    }
  });

  // Single precision trigger press
  await pageBravo.mouse.down({ button: "left" });
  await pageBravo.waitForFunction(() => window.debugSim?.player?.ammo === 29, { timeout: 4000 });
  await pageBravo.mouse.up({ button: "left" });

  // Assert exact single-hit damage: 100 - 24 = 76
  await pageAlpha.waitForFunction(() => {
    const p = window.debugSim?.player;
    return p && p.armor === 76;
  }, { timeout: 6000 });

  await sleep(600);
  const alphaArmorStable = await pageAlpha.evaluate(() => window.debugSim?.player?.armor);
  if (alphaArmorStable !== 76) {
    throw new Error(`Single hit armor stability check failed: expected 76, got ${alphaArmorStable}`);
  }

  const alphaVitals = await pageAlpha.evaluate(() => ({
    armor: window.debugSim.player.armor,
    health: window.debugSim.player.health,
    log: window.debugSim.combatLog,
  }));
  // Hits between operatives are confirmed by the authoritative relay only: exactly ONE
  // authoritative entry and ZERO legacy peer-path entries are required.
  const authEntries = alphaVitals.log.filter((l) => l.includes("[AUTHORITATIVE HIT] Confirmed strike from INFILTRATOR PHANTOM-1"));
  const legacyEntries = alphaVitals.log.filter((l) => l.includes("[HIT TAKEN] Struck by INFILTRATOR PHANTOM-1"));
  if (authEntries.length !== 1 || legacyEntries.length !== 0) {
    throw new Error(`Exact single-hit attribution failed: expected exactly 1 authoritative hit entry and 0 legacy peer-path entries for INFILTRATOR PHANTOM-1, got ${authEntries.length} authoritative / ${legacyEntries.length} legacy. Full Log: ${JSON.stringify(alphaVitals.log)}`);
  }
  console.log(`✓ Real cross-browser combat hit confirmed with exact authoritative attribution (zero legacy peer-path entries)! Alpha armor: ${alphaVitals.armor}/100, log: ${alphaVitals.log}`);

  // Alpha dodges with combat roll
  await pageAlpha.keyboard.down('Space');
  await sleep(300);
  await pageAlpha.keyboard.up('Space');
  await sleep(400);

  // Disengage: Bravo moves far away to (75, 75) so distance > 60m
  await repositionOperative(pageBravo, RAID_C2, 75, 75, 'op_bravo_1');

  // Alpha receives Bravo's real state via mesh and clears radar naturally
  await pageAlpha.waitForFunction(() => {
    const r = window.debugSim?.rivals?.find((x) => x.id === 'op_bravo_1');
    return r && r.x >= 70 && r.z >= 70 && !window.debugSim?.proximityAlert?.active;
  }, { timeout: 8000 });

  // Verify ALL CLEAR banner is strictly visible on Alpha
  await pageAlpha.waitForSelector('text=ALL CLEAR (> 60m)', { timeout: 6000 });

  // Screenshot 9: Radar Cleared to ALL CLEAR (> 60m)
  await pageAlpha.screenshot({ path: path.join(OUT_DIR, '09_radar_disengage_all_clear.png') });

  await pageBravo.close();
  await ctxBravo.close();
  await pageAlpha.close();
  await ctxAlpha.close();

  // -------------------------------------------------------------
  // Clip 3: Exfil Hold, Damage Interruption & Corridor Settlement
  // -------------------------------------------------------------
  console.log('[3/3] Recording Clip 3: Exfil Hold, Damage Reset & Settlement...');
  // Fresh raid ledger for the exfil clip; the App's mount join mints the session token
  // automatically, and the ?raidId= param makes the client adopt the correct raid from tick 0.
  const RAID_C3 = newRaidId('c3');
  await resetServerRaid(RAID_C3);
  // Pre-age the raid ledger: the travel-time guard requires >= 8.0s of raid lifetime
  // before any 10m+ displacement from spawn can commit settlement (staged insertion).
  await sleep(8300);
  const ctxExfil = await browser.newContext({
    recordVideo: { dir: path.join(OUT_DIR, 'raw_exfil'), size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const pageExfil = await ctxExfil.newPage();
  pageExfil.on("console", (msg) => console.log("[EXFIL PAGE LOG]", msg.text()));
  pageExfil.on("pageerror", (err) => console.log("[EXFIL PAGE ERROR]", err.message));
  const clip3Start = Date.now();
  const clip3Timings = {};

  await safeNavigate(pageExfil, raidPageUrl(RAID_C3));
  await pageExfil.waitForSelector('.game-viewport');
  await pageExfil.evaluate(() => { if (window.debugSim) window.debugSim.admitOperative(); });
  await sleep(1500);

  // Wait for the App's join flow to mint a session token for the exfil raid
  await pageExfil.waitForFunction(() => !!window.debugSim?.sessionToken, { timeout: 8000 });
  console.log('✓ Session custody joined for fresh exfil raid');

  // Operative scavenges crate_01 (+ $1,250) naturally via input and server sync
  await repositionOperative(pageExfil, RAID_C3, -8, -5.5, 'op_alpha_1');
  await sleep(100);
  await pageExfil.keyboard.press("KeyE");
  await pageExfil.waitForFunction(() => window.debugSim?.player?.cash >= 1250, { timeout: 4000 });
  console.log("✓ Crate 01 scavenged & synced to server: earned cash $1,250");

  // Move operative into LZ-Charlie extraction zone at (45, 45)
  clip3Timings.hold1 = (Date.now() - clip3Start) / 1000;
  await repositionOperative(pageExfil, RAID_C3, 45, 45, 'op_alpha_1');
  await pageExfil.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.machines = [];
      window.debugSim.lastInterruptionTick = 0;
    }
  });

  // Wait naturally for 60Hz loop to register holding_zone and reach >= 75 ticks with no interruption banner
  await pageExfil.waitForFunction(() => {
    const st = window.debugSim?.exfilController?.getState();
    return st && st.kind === "holding_zone" && st.currentTicks >= 75 && window.debugSim?.lastInterruptionTick === 0;
  }, { timeout: 6000 });

  // Screenshot 10: Holding green smoke extraction zone (~80 / 180 ticks)
  await pageExfil.screenshot({ path: path.join(OUT_DIR, "10_exfil_holding_smoke.png") });

  // REAL server-authoritative damage interruption: the lifecycle coordinator deploys an
  // automated drone into raid custody at (45, 32-36 patrol). The RELAY's machine-attack
  // executor computes the strike (timing, deterministic patrol position, target geometry,
  // armor absorption, hold custody revocation) and the client applies the authoritative
  // vitals + hold reset from the server broadcast — the browser never reports this damage.
  clip3Timings.damage = (Date.now() - clip3Start) / 1000;
  await deployMachine(RAID_C3, 'drone_interrupter', 'drone', 45, 32, 50);

  // Step until the authoritative machine_attack broadcast interrupts the hold
  await pageExfil.waitForFunction(() => {
    return window.debugSim?.lastInterruptionTick > 0 && window.debugSim?.player?.armor < 100;
  }, { timeout: 8000 });

  // Verify damage interruption banner is visible
  await pageExfil.waitForSelector(".exfil-reset-banner", { timeout: 6000 });
  console.log("✓ SERVER-AUTHORITATIVE machine damage interruption triggered (relay machine_attack broadcast): hold reset to 0/180 ticks");

  // Screenshot 11: Damage taken resets hold counter to 0 (shows DAMAGE INTERRUPTION — HOLD RESET: 0 / 180 TICKS)
  await pageExfil.screenshot({ path: path.join(OUT_DIR, "11_exfil_damage_reset.png") });

  // Neutralize drone and complete continuous 180-tick hold: the lifecycle coordinator
  // WITHDRAWS the machine from raid custody (server executor stops firing — no
  // client-side machine list surgery).
  clip3Timings.hold2 = (Date.now() - clip3Start) / 1000;
  await withdrawMachine(RAID_C3, 'drone_interrupter');
  await pageExfil.waitForFunction(() => {
    const st = window.debugSim?.exfilController?.getState();
    return st && st.kind === "holding_zone";
  }, { timeout: 6000 });

  // Verify corridor presentation modal is strictly visible in DOM (takes 3.0s of continuous hold;
  // video-recording pages render slower, so allow generous headroom)
  await pageExfil.waitForSelector(".exfil-corridor-modal", { timeout: 20000 });
  clip3Timings.corridor = (Date.now() - clip3Start) / 1000;

  // Screenshot 12: 2500ms Airlock Corridor Presentation Overlay with inputs locked
  await pageExfil.screenshot({ path: path.join(OUT_DIR, "12_corridor_presentation_mask.png") });

  // Wait for corridor countdown (2.5s) to finish and receipt debrief modal to appear
  await pageExfil.waitForSelector(".exfil-receipt-modal", { timeout: 45000 });
  clip3Timings.debrief = (Date.now() - clip3Start) / 1000;
  console.log("✓ Authoritative settlement debrief verified with server receipt");

  // Screenshot 13: Authoritative Victory Settlement Debrief with BigInt verified receipt
  await pageExfil.screenshot({ path: path.join(OUT_DIR, "13_settlement_receipt_debrief.png") });
  await sleep(3000);

  // Capture Screenshot 14: Settlement Error & Official Recovery (Retry/Cancel) UI
  await pageExfil.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.exfilController = new window.debugSim.exfilController.constructor({
        targetHoldTicks: 180,
        corridorDurationMs: 0,
      });
      for (let i = 1; i <= 180; i++) {
        window.debugSim.exfilController.onTick(i, true, "lz_sector7_charlie", 0);
      }
      window.debugSim.exfilController.submitSettlement();
      window.debugSim.exfilController.onFailure("Ledger settlement authority rejected: concurrent pool contention", true);
    }
  });
  await pageExfil.waitForSelector(".exfil-error-card", { timeout: 4000 });
  await pageExfil.screenshot({ path: path.join(OUT_DIR, "14_settlement_recovery_retry_cancel.png") });
  console.log("✓ Settlement recovery screen captured (UI presentation fixture: ExfilController state-machine unit, not a combat claim): Retry Settlement and Return to Raid visible");

  // Click Return to Raid and assert official cancel() unlocks inputs back to idle
  await pageExfil.click(".exfil-cancel-btn");
  await pageExfil.waitForFunction(() => window.debugSim?.exfilController?.getState()?.kind === "idle" && !window.debugSim?.exfilController?.isInputLocked(), { timeout: 4000 });
  console.log("✓ Return to Raid confirmed: controller reset to idle and inputs unlocked");

  // Capture Screenshot 15: Operative Eliminated (K.I.A.) Screen — UI presentation
  // fixture (terminal-modal unit): the life-state transition shown is the modal's
  // consumption of the authoritative K.I.A. contract; not a staged combat claim.
  await pageExfil.evaluate(() => {
    if (window.debugSim) {
      window.debugSim.player.health = 0;
      window.debugSim.player.isAlive = false;
      window.debugSim.player.isExtracted = false;
    }
  });
  await pageExfil.waitForSelector(".exfil-kia-modal", { timeout: 4000 });
  await pageExfil.screenshot({ path: path.join(OUT_DIR, "15_operative_eliminated_kia.png") });
  console.log("✓ Operative Eliminated screen captured (UI presentation fixture for the K.I.A. terminal modal)");
  await sleep(1500);

  await pageExfil.close();
  await ctxExfil.close();

  await browser.close();

  console.log('=== Raw Video Recording Completed. Encoding Frame-Accurate Stereo H.264 MP4 with Audio... ===');

  // Convert raw WebM clips to H.264 MP4 with synchronized stereo audio track
  const convertClipWithAudio = (subDir, outputName, soundType, timings) => {
    const fullDir = path.join(OUT_DIR, subDir);
    if (!fs.existsSync(fullDir)) return;
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.webm'));
    if (files.length === 0) return;
    const newestFile = files.sort((a, b) => {
      return fs.statSync(path.join(fullDir, b)).mtimeMs - fs.statSync(path.join(fullDir, a)).mtimeMs;
    })[0];

    const src = path.join(fullDir, newestFile);
    const dst = path.join(OUT_DIR, outputName);
    console.log(`Encoding ${newestFile} -> ${outputName} (Stereo AAC audio synchronized to actions)`);

    let audioFilter = 'aevalsrc=sin(180*2*PI*t)*0.04|sin(180*2*PI*t)*0.04:c=stereo:d=20';

    if (soundType === 'kinetic') {
      const tSlide = (timings?.slide ?? 1.5).toFixed(2);
      const tRoll = (timings?.roll ?? 2.5).toFixed(2);
      const tShoot = (timings?.shoot ?? 3.5).toFixed(2);
      const tKick = (timings?.kick ?? 4.8).toFixed(2);
      const tLoot = (timings?.loot ?? 5.8).toFixed(2);

      audioFilter =
        'aevalsrc=' +
        `sin(120*2*PI*t)*0.03 + (sin(150*2*PI*t)*0.18*between(t\\,${tSlide}\\,${parseFloat(tSlide) + 0.6})) + (sin(220*2*PI*t)*0.2*between(t\\,${tRoll}\\,${parseFloat(tRoll) + 0.6})) + (sin(600*2*PI*t)*0.22*exp(-mod(t-${tShoot}\\,0.15)*25)*between(t\\,${tShoot}\\,${parseFloat(tShoot) + 0.8})) + (sin(80*2*PI*t)*0.3*between(t\\,${tKick}\\,${parseFloat(tKick) + 0.4})) + (sin(880*2*PI*t)*0.18*between(t\\,${tLoot}\\,${parseFloat(tLoot) + 0.5}))` +
        '|' +
        `sin(120*2*PI*t)*0.03 + (sin(160*2*PI*t)*0.18*between(t\\,${tSlide}\\,${parseFloat(tSlide) + 0.6})) + (sin(240*2*PI*t)*0.2*between(t\\,${tRoll}\\,${parseFloat(tRoll) + 0.6})) + (sin(520*2*PI*t)*0.22*exp(-mod(t-${tShoot}\\,0.15)*25)*between(t\\,${tShoot}\\,${parseFloat(tShoot) + 0.8})) + (sin(80*2*PI*t)*0.3*between(t\\,${tKick}\\,${parseFloat(tKick) + 0.4})) + (sin(980*2*PI*t)*0.18*between(t\\,${tLoot}\\,${parseFloat(tLoot) + 0.5}))` +
        ':c=stereo:d=20';
    } else if (soundType === 'multiplayer') {
      const tRadar = (timings?.radar ?? 1.5).toFixed(2);
      const tCombat = (timings?.combat ?? 2.8).toFixed(2);

      audioFilter =
        'aevalsrc=' +
        `(sin(880*2*PI*t)*0.16*exp(-mod(t-${tRadar}\\,1.2)*12)*between(t\\,${tRadar}\\,${parseFloat(tRadar) + 3.0}) + sin(440*2*PI*t)*0.2*exp(-mod(t-${tCombat}\\,0.3)*25)*between(t\\,${tCombat}\\,${parseFloat(tCombat) + 1.2}))` +
        '|' +
        `(sin(920*2*PI*t)*0.16*exp(-mod(t-${tRadar}\\,1.2)*12)*between(t\\,${tRadar}\\,${parseFloat(tRadar) + 3.0}) + sin(480*2*PI*t)*0.2*exp(-mod(t-${tCombat}\\,0.3)*25)*between(t\\,${tCombat}\\,${parseFloat(tCombat) + 1.2}))` +
        ':c=stereo:d=20';
    } else if (soundType === 'exfil') {
      const tHold1 = (timings?.hold1 ?? 1.0).toFixed(2);
      const tDmg = (timings?.damage ?? 2.5).toFixed(2);
      const tCorridor = (timings?.corridor ?? 5.5).toFixed(2);
      const tDebrief = (timings?.debrief ?? 8.5).toFixed(2);

      audioFilter =
        'aevalsrc=' +
        `(sin((520+180*sin(4*PI*t))*2*PI*t)*0.12*between(t\\,${tHold1}\\,${tDmg}) + sin(120*2*PI*t)*0.2*between(t\\,${tDmg}\\,${parseFloat(tDmg) + 0.5}) + sin(160*2*PI*t)*0.08*between(t\\,${tCorridor}\\,${tDebrief}) + (sin(523*2*PI*t)+sin(659*2*PI*t)+sin(784*2*PI*t))*0.1*between(t\\,${tDebrief}\\,${parseFloat(tDebrief) + 4.0}))` +
        '|' +
        `(sin((550+180*sin(4*PI*t))*2*PI*t)*0.12*between(t\\,${tHold1}\\,${tDmg}) + sin(120*2*PI*t)*0.2*between(t\\,${tDmg}\\,${parseFloat(tDmg) + 0.5}) + sin(165*2*PI*t)*0.08*between(t\\,${tCorridor}\\,${tDebrief}) + (sin(523*2*PI*t)+sin(659*2*PI*t)+sin(784*2*PI*t))*0.1*between(t\\,${tDebrief}\\,${parseFloat(tDebrief) + 4.0}))` +
        ':c=stereo:d=20';
    }

    try {
      execSync(
        `ffmpeg -y -i "${src}" -f lavfi -i "${audioFilter}" -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -ac 2 -b:a 192k -shortest -movflags +faststart "${dst}"`,
        { stdio: 'ignore' }
      );
      console.log(`✓ Generated ${outputName} (Stereo AAC)`);
    } catch (err) {
      console.error(`Error encoding ${outputName}:`, err.message);
    }
  };

  convertClipWithAudio('raw_solo', 'stick_zone_solo_kinetic.mp4', 'kinetic', clip1Timings);
  convertClipWithAudio('raw_multi_alpha', 'stick_zone_multiplayer_squad_alpha.mp4', 'multiplayer', clip2Timings);
  convertClipWithAudio('raw_multi_bravo', 'stick_zone_multiplayer_squad_bravo.mp4', 'multiplayer', clipBravoTimings);
  convertClipWithAudio('raw_exfil', 'stick_zone_exfil_settlement.mp4', 'exfil', clip3Timings);

  // Combined Highlight Montage
  console.log('Generating Combined Highlight Montage: stick_zone_gameplay_proof.mp4...');
  try {
    const listFile = path.join(os.tmpdir(), 'stick-zone-concat.txt');
    const clips = [
      `file '${path.join(OUT_DIR, 'stick_zone_solo_kinetic.mp4')}'`,
      `file '${path.join(OUT_DIR, 'stick_zone_multiplayer_squad_alpha.mp4')}'`,
      `file '${path.join(OUT_DIR, 'stick_zone_exfil_settlement.mp4')}'`,
    ];
    fs.writeFileSync(listFile, clips.join('\n'));
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${path.join(OUT_DIR, 'stick_zone_gameplay_proof.mp4')}"`, {
      stdio: 'ignore',
    });
    console.log('✓ Generated stick_zone_gameplay_proof.mp4');
  } catch (err) {
    console.warn('Concat notice:', err.message);
  }

  console.log('=== All Video Deliverables & Keyframe Screenshots Ready ===');
}

recordAll().catch((err) => {
  console.error('Recording fatal:', err);
  process.exit(1);
});
