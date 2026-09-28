import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
const output = path.resolve("public/showcase/audit");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const results = [];
let previous;
try {
  previous = JSON.parse(
    await readFile(path.join(output, "manifest.json"), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const sourceLoadedAt = new Date().toISOString();
let activeEncoder;
const waitForPresentation = () =>
  page.evaluate(() =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )
  );
try {
  await page.goto(
    process.env.AUDIT_URL ??
      "http://127.0.0.1:4402/scripts/mechanics-audit.html",
  );
  await page.waitForFunction(() => window.mechanicsAudit?.ready(), null, {
    timeout: 30000,
  });
  const ids = process.argv.slice(2).length
    ? process.argv.slice(2)
    : await page.evaluate(() => window.mechanicsAudit.ids);
  for (const id of ids) {
    const { total, actionFrame } = await page.evaluate(
      (id) => window.mechanicsAudit.setup(id),
      id,
    );
    const frames = path.join(output, id);
    await mkdir(frames, { recursive: true });
    const encoder = activeEncoder = spawn("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      "30",
      "-vcodec",
      "mjpeg",
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.join(output, `${id}.pending.mp4`),
    ], { stdio: ["pipe", "ignore", "inherit"] });
    let encoderError;
    encoder.stdin.on("error", (e) => encoderError = e);
    for (let i = 0; i <= total; i++) {
      if (i) await page.evaluate(() => window.mechanicsAudit.step());
      await waitForPresentation();
      const frame = await page.screenshot({ type: "jpeg", quality: 90 });
      if (encoderError) throw encoderError;
      if (!encoder.stdin.write(frame)) await once(encoder.stdin, "drain");
      if ([0, actionFrame, total].includes(i)) {
        await page.screenshot({
          path: path.join(
            frames,
            `${i === 0 ? "before" : i === total ? "after" : "action"}.png`,
          ),
        });
      }
    }
    encoder.stdin.end();
    const [code] = await once(encoder, "close");
    if (code !== 0) throw new Error(`Encoder failed: ${code}`);
    activeEncoder = null;
    await rename(
      path.join(output, `${id}.pending.mp4`),
      path.join(output, `${id}.mp4`),
    );
    const result = {
      ...await page.evaluate(() => window.mechanicsAudit.results()),
      sourceLoadedAt,
      capturedAt: new Date().toISOString(),
    };
    results.push({
      ...result,
      video: `audit/${id}.mp4`,
      screenshots: ["before", "action", "after"].map((k) =>
        `audit/${id}/${k}.png`
      ),
    });
    await writeFile(
      path.join(output, `${id}.json`),
      JSON.stringify(result, null, 2),
    );
    console.log(id, JSON.stringify(result.checks));
  }
} finally {
  if (activeEncoder) {
    activeEncoder.stdin.destroy();
    activeEncoder.kill("SIGTERM");
  }
  await browser.close();
}
// Keep unchanged clips when the caller records only selected scenarios.
const recordedIds = new Set(results.map((result) => result.id));
for (const result of previous?.results ?? []) {
  if (!recordedIds.has(result.id)) results.push(result);
}
const order = ["torch", "gravity", "jetpack", "water", "buggy", "impact"];
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const manifest = {
  created: new Date().toISOString(),
  mode:
    "Offline simulation replay. Not a live frame-rate measurement. All setups are disclosed. No simulation pose edits occur after each setup.",
  errors,
  results,
};
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]),
  );
await writeFile(
  path.resolve("public/showcase/audit.html"),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mechanics audit</title><style>body{margin:0;background:#172025;color:#e9e9de;font:16px system-ui}main{max-width:1100px;margin:auto;padding:28px}h1{font-size:32px}article{background:#243038;border:1px solid #526067;border-radius:12px;margin:24px 0;padding:20px}video{display:block;width:100%;background:#000}button{font:inherit;background:#f5c889;color:#172025;border:0;border-radius:6px;padding:12px 20px;cursor:pointer}button:focus-visible{outline:3px solid #fff;outline-offset:3px}.playback{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:12px 0}[role="status"]:empty{display:none}p{line-height:1.5}a{color:#f5c889}.shots{display:flex;gap:10px}.shots a{width:33%}img{width:100%}strong{color:#f5c889}</style><main><h1>Wreck Yard mechanics audit</h1><p>${
    escape(manifest.mode)
  }</p><p>Each video shows the real simulation and game render components at 30 ticks per second. The input ray is an audit overlay. These tests do not verify browser controls or networking. The buggy replay checks loss and recovery of wheel contact over the ramp.</p><p><a href="audit/manifest.json">State samples and checks (JSON)</a> · <a href="audit/live-results.json">Live browser controls</a> · <a href="audit/gpu-results.json">Live GPU samples</a> · <a href="audit/playback-results.json">Video playback checks</a></p>${
    results.map((r) =>
      `<article><h2>${escape(r.title)}</h2><strong>${
        r.passed
          ? "State checks passed"
          : "State check failed — inspect before approval"
      }</strong><p>${escape(r.setup)}</p>${
        r.id === "impact"
          ? "<p>The impact removes a small number of voxels from the underside in this run. The state samples confirm this small change. This clip does not show a large body split or a stack collapse.</p>"
          : ""
      }<video controls playsinline preload="metadata" poster="audit/${r.id}/before.png" src="${r.video}"></video><div class="playback"><button type="button">Play video</button><a href="${r.video}" target="_blank" rel="noopener">Open video</a></div><p role="status"></p><p>${
        Object.entries(r.checks).map(([k, v]) =>
          `${escape(k)}: ${v ? "PASS" : "FAIL"}`
        ).join(" · ")
      }</p><div class="shots">${
        r.screenshots.map((s, i) =>
          `<a href="${s}"><img src="${s}" alt="${
            ["Before", "Action", "After"][i]
          }">${["Before", "Action", "After"][i]}</a>`
        ).join("")
      }</div></article>`
    ).join("")
  }</main><script>
for (const article of document.querySelectorAll('article')) {
  const video = article.querySelector('video');
  const button = article.querySelector('button');
  const status = article.querySelector('[role="status"]');
  button.addEventListener('click', async () => {
    status.textContent = '';
    if (!video.paused) { video.pause(); return; }
    try { await video.play(); }
    catch { status.textContent = 'Playback failed. Use the Open video link below.'; }
  });
  video.addEventListener('play', () => {
    button.textContent = 'Pause video';
    for (const other of document.querySelectorAll('video')) if (other !== video) other.pause();
  });
  video.addEventListener('pause', () => { button.textContent = 'Play video'; });
  video.addEventListener('ended', () => { button.textContent = 'Replay video'; });
  video.addEventListener('error', () => {
    status.textContent = 'Video could not load. Open this gallery in your browser.';
  });
}
</script>`,
);
if (errors.length || results.some((r) => !r.passed)) {
  console.error("Audit has failed checks or browser errors.", errors);
  process.exitCode = 1;
}
