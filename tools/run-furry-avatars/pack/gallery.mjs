// The pack's gallery sheets (Previews/*.webp), rendered from the editor in the pack's toon look.
// usage (serve tools/run-furry-avatars on :8000):  node pack/gallery.mjs <out dir>
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || 'out/gallery');
mkdirSync(OUT, { recursive: true });
const SPECIES = ['wolf', 'husky', 'fox', 'dog', 'cat', 'tiger', 'lion', 'bunny', 'deer', 'horse', 'goat', 'bear', 'raccoon', 'redpanda',
  'otter', 'hyena', 'mouse', 'kangaroo', 'bat', 'dragon', 'lizard', 'shark', 'bird'];
const SHEETS = {
  // every species' face, 3/4, with its name
  species: { cols: 6, cell: [300, 330], cam: 'head', names: true, cells: SPECIES.map((sp) => ({ sp, clip: 'Idle', t: 0.4 })) },
  // the action clips, full body
  action: { cols: 3, cell: [420, 520], cam: '34', cells: [
    { sp: 'wolf', clip: 'Slash R', t: 0.31 }, { sp: 'lion', clip: 'Roar', t: 0.6 }, { sp: 'dragon', clip: 'Bite', t: 0.21 },
    { sp: 'fox', clip: 'Slash combo', t: 0.62 }, { sp: 'husky', clip: 'Bark', t: 0.25 }, { sp: 'tiger', clip: 'Slash L', t: 0.31 }] },
  // moving and resting
  moves: { cols: 3, cell: [420, 520], cam: 'sideup', cells: [
    { sp: 'horse', clip: 'Gallop', t: 0.33 }, { sp: 'bunny', clip: 'Jump', t: 0.4 }, { sp: 'cat', clip: 'All fours', t: 0.5, cam: 'side' },
    { sp: 'redpanda', clip: 'Sit: eat', t: 0.6, cam: '34' }, { sp: 'raccoon', clip: 'Collect', t: 0.5, cam: '34' }, { sp: 'otter', clip: 'Princess wave', t: 0.3, cam: '34' }] },
  // mix and match: whole made-up creatures from parts of different species
  hybrids: { cols: 4, cell: [360, 470], cam: '34', cells: [
    { sp: 'wolf', clip: 'Idle', t: 0.4, parts: { ears: 'bunny', tail: 'dragon', feet: 'hooves', hair: 'swoop' } },
    { sp: 'shark', clip: 'Roar', t: 0.6, parts: { ears: 'fox', hair: 'mohawk', tail: 'fox', cheeks: 'spiky' } },
    { sp: 'cat', clip: 'Wave', t: 0.8, parts: { ears: 'bat', tail: 'lion', feet: 'talons', teeth: 'fangs' } },
    { sp: 'horse', clip: 'Bark', t: 0.25, parts: { ears: 'big_round', tail: 'raccoon', feet: 'paws', hair: 'long' } },
    { sp: 'dragon', clip: 'Idle', t: 0.4, parts: { ears: 'lop', tail: 'bunny', cheeks: 'round', hair: 'crest' } },
    { sp: 'bird', clip: 'Slash R', t: 0.31, parts: { ears: 'cat', tail: 'shark', feet: 'reptile', teeth: 'shark' } },
    { sp: 'bunny', clip: 'Roar', t: 0.6, parts: { ears: 'deer', tail: 'dragon', feet: 'reptile', teeth: 'fangs', cheeks: 'fin' } },
    { sp: 'bear', clip: 'Idle', t: 0.4, parts: { ears: 'fox', tail: 'fox', hair: 'swoop', eyes: 'happy' } }] },
  // mix and match: one body, swapped parts
  mix: { cols: 4, cell: [300, 330], cam: 'head', cells: [
    { sp: 'wolf' }, { sp: 'wolf', parts: { eyes: 'happy', hair: 'swoop', cheeks: 'round' } },
    { sp: 'wolf', parts: { eyes: 'sharp', teeth: 'fangs', hair: 'mohawk' } }, { sp: 'wolf', parts: { ears: 'bunny', eyes: 'round', teeth: 'buck' } },
    { sp: 'dragon' }, { sp: 'dragon', parts: { ears: 'horse', hair: 'long', cheeks: 'spiky' } },
    { sp: 'cat', parts: { ears: 'bat', eyes: 'sleepy', teeth: 'snaggle' } }, { sp: 'shark', parts: { hair: 'crest', ears: 'fin', eyes: 'happy' } }] },
};
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9336;
const chrome = spawn(CH, ['--headless=new', '--use-angle=metal', `--remote-debugging-port=${port}`, '--window-size=1100,1100', `--user-data-dir=/tmp/fz-gal-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
for (let i = 0; i < 50 && !ws; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = t.find((x) => x.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {} await sleep(200); }
if (ws.readyState !== 1) await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
await send('Page.navigate', { url: 'http://localhost:8000/viewer/index.html' });
for (let i = 0; i < 100; i++) { await sleep(300); if (await ev(`!!(window.KIT && document.getElementById('status').textContent.includes('drag'))`)) break; }
await ev(`document.querySelector('aside').style.display='none'; document.getElementById('status').style.display='none'; dispatchEvent(new Event('resize'))`);
const manifest = {};
for (const [name, sh] of Object.entries(SHEETS)) {
  const shots = [];
  for (const c of sh.cells) {
    await ev(`KIT.species(${JSON.stringify(c.sp)})`);
    for (const [k, v] of Object.entries(c.parts || {})) await ev(`KIT.choose(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
    await ev(`KIT.pose(${JSON.stringify(c.clip || 'Idle')}, ${c.t ?? 0.4}, ${JSON.stringify(c.cam || sh.cam)})`);
    await sleep(150);
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const f = path.join(OUT, `_${name}-${shots.length}.png`);
    writeFileSync(f, Buffer.from(s.result.data, 'base64'));
    shots.push({ file: f, label: sh.names ? (c.sp === 'redpanda' ? 'red panda' : c.sp) : '' });
  }
  manifest[name] = { cols: sh.cols, cell: sh.cell, shots };
}
chrome.kill();
writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify(manifest));
const py = spawn('python3', [path.join(path.dirname(new URL(import.meta.url).pathname), 'gallery_stitch.py'), OUT], { stdio: 'inherit' });
await new Promise((r) => py.on('close', r));
process.exit(0);
