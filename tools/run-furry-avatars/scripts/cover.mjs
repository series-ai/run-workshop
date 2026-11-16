// Render the pack cover's 3D scene through the editor's cover mode, then hand off to cover_title.py.
// usage: node scripts/cover.mjs out/cover-render.png   (serve tools/run-furry-avatars on :8000)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2] || 'out/cover-render.png';
// a brawl: two teams charging into each other across the middle, seen from a high three-quarter angle
// (these characters read best from above and from the side, not head on). Each faces the other team,
// turned a little toward the camera; poses are caught mid-attack.
const L = Math.PI / 2, R = -Math.PI / 2;   // facing +x (left team) / -x (right team), before the diagonal turn
// Six fighters, big. A front pair locked in combat at the centre (the wolf's slash landing, the lion lunging
// to bite back), and behind each of them a backer: one roaring, one barking or winding up an attack. Everyone
// is turned 3/4 TOWARD the camera (no backs); left side faces right, right side faces left.
const TL = Math.PI / 2 - 0.55, TR = -Math.PI / 2 + 0.55;
const CAST = [
  { sp: 'wolf', clip: 'slash_r', t: 0.33, x: -0.8, z: 1.35, ry: TL - 0.25 },     // the swipe, turned more toward the viewer
  { sp: 'lion', clip: 'hurt', t: 0.1, x: 0.65, z: 2.0, ry: TR - 0.1 },           // reeling from it (as approved)
  { sp: 'dragon', clip: 'bite', t: 0.21, x: 0.2, z: -0.9, ry: -0.3 },         // between them, mostly facing us: rearing to bite
  { sp: 'tiger', clip: 'slash_l', t: 0.33, x: -1.2, z: -1.15, ry: TL - 0.05 },    // left-paw swipe, left side
  { sp: 'fox', clip: 'slash_l', t: 0.33, x: 1.45, z: -1.05, ry: TR + 0.45 },       // and mirrored, right side (orange on both sides)
];

// turn the fight onto a diagonal (equivalently, orbit the camera clockwise): the lion's pack faces the camera
// 3/4, the wolf's pack is seen 3/4 from behind (three.js: +y rotation turns +z toward +x)
const DIAG = +(process.env.DIAG || 0), SPREAD = +(process.env.SPREAD || 1.0);
for (const c of CAST) {
  const x = c.x * SPREAD, z = c.z * SPREAD;
  c.x = x * Math.cos(DIAG) + z * Math.sin(DIAG);
  c.z = -x * Math.sin(DIAG) + z * Math.cos(DIAG);
  c.ry += DIAG;
}
const mid = CAST.reduce((a, c) => [a[0] + c.x / CAST.length, a[1] + c.z / CAST.length], [0, 0]);
const CAM = { pos: JSON.parse(process.env.CAM_POS || JSON.stringify([mid[0], 5.2, mid[1] + 8.0])), target: JSON.parse(process.env.CAM_TGT || JSON.stringify([mid[0], 1.0, mid[1]])), fov: +(process.env.CAM_FOV || 28), bg: '#f3e6dc', lift: 0, fit: JSON.parse(process.env.CAM_FIT || '[-1.2, -0.78, 1.2, 0.92]'), panX: +(process.env.CAM_PANX || 0.03), zoom: +(process.env.CAM_ZOOM || 1.15) };   // fit the crowd above the logo
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9335;
const chrome = spawn(CH, ['--headless=new', '--use-angle=metal', `--remote-debugging-port=${port}`, '--window-size=1400,1400', `--user-data-dir=/tmp/fz-cov-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
for (let i = 0; i < 50 && !ws; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = t.find((x) => x.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {} await sleep(200); }
if (ws.readyState !== 1) await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result?.result?.value; };
const look = process.env.LOOK ? '&look=' + encodeURIComponent(process.env.LOOK) : '';   // a look link's ?look= JSON
await send('Page.navigate', { url: 'http://localhost:8000/viewer/index.html?shader=' + (process.env.SHADER || 'toonline') + look });
for (let i = 0; i < 100; i++) { await sleep(300); if (await ev(`!!(window.KIT && document.getElementById('status').textContent.includes('drag'))`)) break; }
const url = await ev(`KIT.cover(${JSON.stringify(CAST)}, ${JSON.stringify(CAM)}, 2048)`);
writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
console.log('hidden %', JSON.stringify(await ev('window.COVER_OVERLAP')));
chrome.kill();
console.log('wrote', OUT);
process.exit(0);
