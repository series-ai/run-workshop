// Contact sheets of clips posed in the editor (one browser session, fast).
// usage: node scripts/clipsheet.mjs out/clips.png "Roar:0,0.25,0.42,0.8,1.2,1.6" "Bite:..." [--cam 34] [--species wolf]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const out = args.shift();
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const cam = opt('--cam', '34'), species = opt('--species', 'wolf'), W = +opt('--w', 300), H = +opt('--h', 400);
const rows = args.map((a) => { const i = a.lastIndexOf(':'); return { name: a.slice(0, i), ts: a.slice(i + 1).split(',').map(Number) }; });   // (names may contain ':')
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9334;
const chrome = spawn(CH, ['--headless=new', '--use-angle=metal', `--remote-debugging-port=${port}`, '--window-size=1220,800', `--user-data-dir=/tmp/fz-cs-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
for (let i = 0; i < 50 && !ws; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = t.find((x) => x.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {} await sleep(200); }
if (ws.readyState !== 1) await new Promise((r) => ws.addEventListener('open', r));   // (it may already be open)
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.navigate', { url: `http://localhost:8000/viewer/index.html?species=${species}&cam=${cam}` });
for (let i = 0; i < 100; i++) { await sleep(300); if (await ev(`!!(window.KIT && document.getElementById('status').textContent.includes('drag'))`)) break; }
await ev(`document.querySelector('aside').style.display='none'; document.getElementById('status').style.display='none'; dispatchEvent(new Event('resize'))`);
const shots = [];
for (const r of rows) for (const t of r.ts) {
  await ev(`KIT.pose(${JSON.stringify(r.name)}, ${t}, ${JSON.stringify(cam)})`);
  await sleep(120);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  shots.push({ name: r.name, t, data: s.result.data });
}
chrome.kill();
// stitch with python (PIL)
const tmp = `/tmp/fz-cs-${process.pid}.json`;
writeFileSync(tmp, JSON.stringify({ shots, cols: Math.max(...rows.map((r) => r.ts.length)), W, H }));
const py = spawn('python3', ['-c', `
import json, base64, io, sys
from PIL import Image, ImageDraw
d = json.load(open(${JSON.stringify(tmp)})); cols, W, H = d['cols'], d['W'], d['H']
names = []
for s in d['shots']:
    if s['name'] not in names: names.append(s['name'])
b = Image.new('RGB', (W * cols, H * len(names)), 'white'); dr = ImageDraw.Draw(b)
idx = {n: 0 for n in names}
for s in d['shots']:
    im = Image.open(io.BytesIO(base64.b64decode(s['data']))).convert('RGB')
    w, h = im.size; side = min(w, h)
    im = im.crop(((w - int(side * 0.75)) // 2, 0, (w + int(side * 0.75)) // 2, side)).resize((W, H))
    r, c = names.index(s['name']), idx[s['name']]; idx[s['name']] += 1
    b.paste(im, (c * W, r * H)); dr.text((c * W + 4, r * H + 4), f"{s['name']} {s['t']:.2f}s", fill='black')
b.save(${JSON.stringify(out)})
`], { stdio: 'inherit' });
await new Promise((r) => py.on('close', r));
console.log('wrote', out);
process.exit(0);
