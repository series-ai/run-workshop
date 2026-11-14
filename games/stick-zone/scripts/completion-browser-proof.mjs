// Browser check for raid completion screens. Run from games/stick-zone:
//   npm run build && npm run preview
//   node scripts/completion-browser-proof.mjs [output-directory]
// This check uses a test debrief. It does not prove live settlement.
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const outDir = process.argv[2] ?? "proofs/completion";
fs.mkdirSync(outDir, { recursive: true });
const URL = process.env.PROOF_URL ?? "http://127.0.0.1:48392/";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};

// Poll the DOM from Node. Visibility waits poll on animation frames,
// which software WebGL starves in headless runs.
async function waitForDom(page, selector, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await page.evaluate((sel) => !!document.querySelector(sel), selector)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timeout waiting for ${selector}`);
}

const browser = await chromium.launch({ headless: true, args: ["--use-gl=swiftshader", "--enable-webgl"] });

async function openPage(viewport, label) {
  const context = await browser.newContext({ viewport, recordVideo: { dir: outDir } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.debugSim, null, { timeout: 30000 });
  return { page, context, errors, label };
}

// Hold the zone for the full dwell so the controller enters the corridor.
const driveToCorridor = (page) => page.evaluate(() => {
  const sim = window.debugSim;
  for (let t = 1; t <= 180; t++) sim.exfilController.onTick(100000 + t, true, "lz_sector7_charlie", 0);
  return sim.exfilController.getState().kind;
});

// 1. Offline practice, desktop.
{
  const { page, context, errors } = await openPage({ width: 1440, height: 900 }, "desktop");
  const before = await page.evaluate(() => window.debugSim.player.cash);
  check("practice: corridor entered", (await driveToCorridor(page)) === "corridor_presentation");
  await waitForDom(page, '[data-completion="practice"]', 15000);
  const text = await page.locator('[data-completion="practice"]').innerText();
  check("practice: title shown", text.includes("PRACTICE RUN COMPLETE"));
  check("practice: nothing banked copy", /no cash, items, or xp banked/i.test(text));
  check("practice: no cryptographic claim", !/cryptographic/i.test(text));
  check("practice: no banked payout tile", !/BANKED PAYOUT/.test(text));
  const log = await page.evaluate(() => window.debugSim.combatLog.filter((l) => l.startsWith("[PRACTICE]")));
  check("practice: logged once", log.length === 1, JSON.stringify(log));
  check("practice: run cash unchanged", (await page.evaluate(() => window.debugSim.player.cash)) === before);
  await page.screenshot({ path: path.join(outDir, "practice-desktop.png") });
  check("practice: no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

// 2. Co-op failure, retry, settle, mobile 390px.
{
  const { page, context, errors } = await openPage({ width: 390, height: 844 }, "mobile");
  await page.evaluate(() => {
    const sim = window.debugSim;
    window.__requests = 0;
    window.__fail = true;
    sim.coopDebriefRequest = () => {
      window.__requests += 1;
      if (window.__fail) return Promise.reject(new Error("debrief poll timed out"));
      return new Promise((resolve) => setTimeout(() => resolve({
        v: 1, settled: true, raidId: sim.raidId, receiptId: "rcpt-browser-1", outcomeId: "o", outcomeDigest: "d",
        throughTick: 90, transfers: [{ itemId: "currency_credits", quantity: "900", toProfileId: "p", source: "world_spawn" }],
        participantResults: [], committedAtMs: 1,
      }), 600));
    };
  });
  check("coop: corridor entered", (await driveToCorridor(page)) === "corridor_presentation");
  await waitForDom(page, ".exfil-error-card", 15000);
  await page.evaluate(() => {
    window.debugSim.player.health = 0;
    window.debugSim.player.isAlive = false;
  });
  await waitForDom(page, ".exfil-retry-btn", 5000);
  check("coop: local death keeps debrief recovery visible", (await page.locator(".exfil-retry-btn").count()) === 1);
  const failText = await page.locator(".exfil-error-card").innerText();
  check("coop: failure shows debrief reason", failText.includes("debrief poll timed out"), failText.replace(/\n/g, " / "));
  check("coop: hideout exit remains available", (await page.locator(".exfil-exit-btn").count()) === 1);
  check("coop: no return to raid after failure", (await page.locator(".exfil-cancel-btn").count()) === 0);
  check("coop: one request before retry", (await page.evaluate(() => window.__requests)) === 1);
  await page.screenshot({ path: path.join(outDir, "coop-failed-mobile.png") });

  await page.evaluate(() => { window.__fail = false; });
  // Double click: the flow must run one attempt.
  await page.locator(".exfil-retry-btn").click();
  await waitForDom(page, "#settling-dialog-title", 5000);
  const waitingText = await page.locator("#settling-dialog-title").innerText();
  check("coop: waiting screen names the debrief", waitingText.includes("WAITING FOR SYNCHUB DEBRIEF"), waitingText);
  await page.evaluate(() => window.debugSim.raidCompletion.retry());
  await waitForDom(page, '[data-completion="settled"]', 15000);
  const text = await page.locator('[data-completion="settled"]').innerText();
  check("coop: settled stamp", text.includes("SYNCHUB DEBRIEF SETTLED"));
  check("coop: receipt id shown", text.includes("rcpt-browser-1"));
  check("coop: no cryptographic or verified claim", !/cryptographic|verified/i.test(text));
  check("coop: two requests total", (await page.evaluate(() => window.__requests)) === 2);
  const settledLogs = await page.evaluate(() => window.debugSim.combatLog.filter((l) => l.includes("Debrief settled")));
  check("coop: settled logged once", settledLogs.length === 1, JSON.stringify(settledLogs));
  await page.screenshot({ path: path.join(outDir, "coop-settled-mobile.png") });
  const realErrors = errors.filter((e) => !e.includes("Stash refresh") && !e.includes("Hydration after debrief"));
  check("coop: no unexpected console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
  console.log("coop console errors (all):", JSON.stringify(errors.slice(0, 5)));
  await context.close();
}

// 3. A server refusal permits a return to the raid.
{
  const { page, context, errors } = await openPage({ width: 390, height: 844 }, "refused");
  await page.evaluate(() => {
    const sim = window.debugSim;
    sim.exfilController = new sim.exfilController.constructor({ targetHoldTicks: 2, corridorDurationMs: 0 });
    sim.exfilController.onTick(1, true, "lz_sector_7");
    sim.exfilController.onTick(2, true, "lz_sector_7");
    sim.exfilController.submitSettlement();
    sim.exfilController.onFailure("Server refused extraction", true, true);
  });
  await waitForDom(page, ".exfil-cancel-btn", 5000);
  check("refused: return to raid offered", (await page.locator(".exfil-cancel-btn").innerText()) === "Return to Raid");
  await page.screenshot({ path: path.join(outDir, "coop-refused-mobile.png") });
  await page.locator(".exfil-cancel-btn").click();
  check("refused: controller returns to idle", (await page.evaluate(() => window.debugSim.exfilController.getState().kind)) === "idle");
  check("refused: no console errors", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
