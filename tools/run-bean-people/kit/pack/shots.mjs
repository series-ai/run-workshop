// Screenshot the cover and gallery sheets: node pack/shots.mjs <out dir> [shot ...]
// Needs tools/ served on :5240 (python3 -m http.server 5240 --bind 127.0.0.1) and Playwright
// (resolved from games/run-voxel-showcase, or set PLAYWRIGHT_DIR).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
const require = createRequire(path.resolve(process.env.PLAYWRIGHT_DIR || new URL("../../../../games/run-voxel-showcase/", import.meta.url).pathname) + "/");
const { chromium } = require("playwright");
const [out, ...want] = process.argv.slice(2);
const shots = want.length ? want : ["cover", "weapons", "faces", "outfits", "finishes", "action"];
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
const errs = [];
p.on("pageerror", e => errs.push(String(e)));
p.on("console", m => m.type() === "error" && errs.push(m.text()));
for (const s of shots) {
  await p.goto(`http://127.0.0.1:5240/run-bean-people/kit/pack/cover.html?shot=${s.split("@")[0]}${s.includes("@") ? "&hero=" + s.split("@")[1] : ""}`);
  await p.waitForFunction(() => window.done, null, { timeout: 120000 });
  await p.locator("#card").screenshot({ path: path.join(out, `${s.replace(/[@:]/g, "-")}.png`) });
  console.log(s, JSON.stringify(await p.evaluate(() => window.stats)));
}
console.log("ERRORS", JSON.stringify(errs));
await b.close();
