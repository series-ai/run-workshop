// Click every control in viewer/index.html and report what throws or doesn't take effect.
// usage: node scripts/check-editor.mjs [url]   (serve the tool folder first: python3 -m http.server 8000)
import { spawn } from 'node:child_process';
const URL_ = process.argv[2] || 'http://localhost:8000/viewer/index.html';
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333;
const chrome = spawn(CH, ['--headless=new', '--use-angle=metal', `--remote-debugging-port=${port}`, '--window-size=1400,900', '--user-data-dir=/tmp/fz-cdp-' + process.pid, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const errors = [];
for (let i = 0; i < 50; i++) {
  try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = t.find((x) => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; } } catch {}
  await sleep(200);
}
await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
await send('Runtime.enable');
await send('Page.navigate', { url: URL_ });
for (let i = 0; i < 100; i++) { await sleep(300); if (await ev(`!!(window.KIT && document.getElementById('status').textContent.includes('drag'))`)) break; }
const report = await ev(`(async () => {
  const out = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const K = window.KIT;
  const visibleIn = (kind) => Object.entries(K.kit[kind] || {}).filter(([n, o]) => o.visible).map(([n]) => n);
  // species buttons
  for (const b of document.querySelectorAll('#species button')) {
    b.click(); await wait(30);
    const sp = b.dataset.sp;
    if (K.chosen.head !== sp) out.push('species ' + sp + ': head not chosen (' + K.chosen.head + ')');
    for (const kind of ['head', 'ears', 'cheeks', 'hair', 'eyes', 'tail', 'feet']) {
      const vis = visibleIn(kind), want = K.chosen[kind];
      if (want === 'none' ? vis.length : (vis.length !== 1 || vis[0] !== want)) out.push('species ' + sp + ': ' + kind + ' shows [' + vis + '] want ' + want);
    }
    const tv = Object.values(K.teethObjs).flatMap((m) => Object.values(m)).filter((o) => o.visible).length;
    if ((K.chosen.teeth === 'none') !== (tv === 0) || tv > 1) out.push('species ' + sp + ': teeth visible count ' + tv + ' for ' + K.chosen.teeth);
    if (!b.classList.contains('on')) out.push('species ' + sp + ': button not highlighted');
  }
  // part selects
  document.querySelector('#species button[data-sp="wolf"]').click();
  for (const sel of document.querySelectorAll('select[data-kind]')) {
    const kind = sel.dataset.kind;
    for (const opt of sel.options) {
      sel.value = opt.value; sel.dispatchEvent(new Event('change')); await wait(10);
      if (K.chosen[kind] !== opt.value) { out.push('select ' + kind + '=' + opt.value + ': not chosen'); continue; }
      if (kind === 'teeth') {
        const tv = Object.values(K.teethObjs).flatMap((m) => Object.values(m)).filter((o) => o.visible).length;
        if ((opt.value === 'none') !== (tv === 0)) out.push('select teeth=' + opt.value + ': ' + tv + ' visible');
      } else {
        const vis = visibleIn(kind);
        if (opt.value === 'none' ? vis.length : !(vis.length === 1 && vis[0] === opt.value)) out.push('select ' + kind + '=' + opt.value + ': shows [' + vis + ']');
      }
    }
  }
  // wear toggles
  for (const b of document.querySelectorAll('#wear button')) {
    const w = b.dataset.w;
    const before = w === 'claws' ? K.clawsOn : K.wear[w].visible;
    b.click(); await wait(20);
    const after = w === 'claws' ? K.clawsOn : K.wear[w].visible;
    if (before === after) out.push('wear ' + w + ': toggle had no effect');
    if (b.classList.contains('on') !== after) out.push('wear ' + w + ': button state wrong');
    b.click(); await wait(20);
  }
  // shader
  const sh = document.getElementById('shader');
  for (const opt of sh.options) { sh.value = opt.value; sh.dispatchEvent(new Event('change')); await wait(30); if (K.shader !== opt.value) out.push('shader ' + opt.value + ': not applied'); }
  // animations
  for (const b of document.querySelectorAll('#anims button')) {
    b.click(); await wait(120);
    if (K.anim !== b.textContent) out.push('anim ' + b.textContent + ': not selected');
    const baked = K.BAKED[b.textContent];
    if (baked && !K.clips[baked]) out.push('anim ' + b.textContent + ': clip missing');
    if (baked && K.clips[baked] && !K.clips[baked].enabled) out.push('anim ' + b.textContent + ': clip not enabled');
  }
  // colours
  for (const inp of document.querySelectorAll('#colours input[type=color]')) { inp.value = '#ff0000'; inp.dispatchEvent(new Event('input')); }
  // lineup
  const lb = document.getElementById('lineup-btn');
  lb.click(); await wait(400);
  if (!K.lineup) out.push('lineup: did not open');
  else {
    if (K.lineup.members.length !== document.querySelectorAll('#species button').length) out.push('lineup: ' + K.lineup.members.length + ' members');
    for (const b of document.querySelectorAll('#anims button')) { b.click(); await wait(60); }
    sh.value = 'flat'; sh.dispatchEvent(new Event('change')); await wait(300);
    if (!K.lineup) out.push('lineup: lost after shader change');
    document.querySelector('#wear button[data-w="top"]').click(); await wait(300);
    if (!K.lineup) out.push('lineup: lost after wear toggle');
    document.querySelector('#species button[data-sp="fox"]').click(); await wait(100);
    if (K.lineup) out.push('lineup: species click left the lineup open (the edit is invisible)');
    if (K.chosen.head !== 'fox') out.push('lineup: species click did not apply');
    lb.click(); await wait(400);
    const sel = document.querySelector('select[data-kind="ears"]'); sel.value = 'bat'; sel.dispatchEvent(new Event('change')); await wait(100);
    if (K.lineup) out.push('lineup: part change left the lineup open');
    lb.click(); await wait(400);
    const inp = document.querySelector('#colours input[type=color]'); inp.value = '#00ff00'; inp.dispatchEvent(new Event('input')); await wait(100);
    if (K.lineup) out.push('lineup: colour change left the lineup open');
    lb.click(); await wait(400); lb.click(); await wait(200);
    if (K.lineup) out.push('lineup: did not close');
  }
  return out;
})()`);
console.log(report.length ? report.join('\n') : 'all controls OK');
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no page errors');
chrome.kill();
process.exit(0);
