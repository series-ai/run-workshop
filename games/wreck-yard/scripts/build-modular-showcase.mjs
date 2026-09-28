import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../public/showcase/', import.meta.url));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const legacy = [
  ['proof-01-plasma-torch', 'Plasma torch'],
  ['proof-02-gravity-gun', 'Gravity gun'],
  ['proof-03-jetpack-flight', 'Jetpack'],
  ['proof-04-water-buoyancy', 'Water'],
  ['proof-05-buggy-stunt-drive', 'Buggy'],
  ['proof-06-structural-collapse', 'Structure'],
];
const cards = await Promise.all(legacy.map(async ([file, title]) => {
  try { await fs.access(path.join(output, `${file}.mp4`)); } catch { return ''; }
  return `<article><h2>${escapeHtml(title)}</h2><video controls playsinline preload="none"><source src="./${file}.mp4" type="video/mp4"></video><p>Earlier capture. This clip does not establish a successful action or live frame rate.</p><a href="./${file}.mp4">Open video</a></article>`;
}));
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wreck Yard · Visual audit</title>
<style>
:root{color-scheme:dark;--bg:#11191b;--surface:#1b2629;--text:#eef2e9;--muted:#b6c4c2;--accent:#eeb568}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:40px 24px}h1{font-size:clamp(28px,5vw,48px);margin:8px 0}h2{font-size:20px}p{max-width:76ch;color:var(--muted)}a{color:var(--accent)}a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.label{letter-spacing:.14em;font-size:12px;color:var(--accent)}.primary{display:inline-block;padding:12px 18px;border:1px solid var(--accent);border-radius:8px;margin:12px 0 24px;text-decoration:none;font-weight:650}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:20px}article{padding:20px;background:var(--surface);border:1px solid #354346;border-radius:12px}video{display:block;width:100%;aspect-ratio:16/9;background:#05090a;border-radius:6px}summary{cursor:pointer;padding:18px 0;font-weight:650}footer{margin-top:32px;border-top:1px solid #354346;padding-top:16px}
</style></head><body><main><div class="label">WRECK YARD / EVIDENCE</div><h1>Mechanics and visual audit</h1>
<p>The audit checks simulation results and shows the action from a clear camera. Offline replay clips show simulation behavior. Live browser measurements report performance separately.</p>
<a class="primary" href="./audit.html">Open current audit</a>
<p>Video controls are native browser controls. Open this folder through the local preview server if your document viewer blocks media.</p>
<details><summary>Earlier recordings · unverified</summary><p>These captures are kept for comparison. Their 60 FPS file labels do not establish 60 distinct rendered frames per second.</p><div class="grid">${cards.join('\n')}</div></details>
<footer><a href="../../">Open game</a></footer></main></body></html>`;
await fs.mkdir(output, { recursive: true });
for (const file of ['index.html', '01-video.html']) await fs.writeFile(path.join(output, file), page);
// Retire pages that contained fixed performance and test claims.
for (const file of ['02-comparison.html', '03-weapons.html', '04-playground.html', '05-telemetry.html']) {
  await fs.writeFile(path.join(output, file), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wreck Yard audit</title></head><body><p>This report has been replaced with measured evidence.</p><a href="./audit.html">Open the current audit</a></body></html>');
}
console.log(`Showcase pages written to ${output}`);
