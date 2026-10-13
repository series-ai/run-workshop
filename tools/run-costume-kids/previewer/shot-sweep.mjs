// Visual sweep: for each slug, open the focus view and capture one moment of every clip into ./sweep/.
// Needs the previewer served on :5205 and Playwright (e.g. run from games/run-voxel-showcase).
//   node shot-sweep.mjs <slug> [<slug> ...]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = new URL("./sweep/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const slugs = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 760 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("http://127.0.0.1:5205/index.html?d=27");
await p.waitForFunction(() => document.querySelectorAll(".cell.loading").length === 0, null, { timeout: 180000 });
for (const s of slugs) {
  await p.fill("#filter", s);
  await p.evaluate((s) => [...document.querySelectorAll(".cell")].find((c) => c.textContent === s)?.click(), s);
  await p.waitForTimeout(300);
  for (const [k, name, waits] of [["1", "idle", [700]], ["2", "walk", [200]], ["3", "run", [130]], ["4", "jump", [560]], ["5", "pick-up", [480]], ["6", "celebrate", [160]]]) {
    await p.keyboard.press(k);
    let i = 0;
    for (const w of waits) { await p.waitForTimeout(w); await p.screenshot({ path: `${OUT}${s}-${name}-${i++}.png` }); }
  }
  await p.keyboard.press("Escape");
}
console.log("ERRORS", JSON.stringify(errs));
await b.close();
