'use strict';
const fs = require('node:fs'), path = require('node:path');
const R = require('./experiment-runtime.cjs');
const opt = R.args();
const directDraw = opt['draw-only'] === 'true';
const includeZero = opt['rebuilt-zero'] === 'true';
const offsets = includeZero ? ['rebuilt-zero',150,300,450] : [150,300,450];
async function select(page, value) { await page.evaluate(v => v === 'rebuilt-zero' ? window.__interiorExperiment.selectRebuilt(0) : window.__interiorExperiment.select(v), value); }
if (!opt.url || !opt.out || !opt.installer) throw Error('Use --url --out --installer.');
const installer = require(path.resolve(opt.installer));
const N = Number(opt.samples || 24);
if (!Number.isInteger(N) || N < 8 || N > 256) throw Error('Samples must be an integer from 8 to 256.');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function query(page, scope) {
  const issued = await page.evaluate(scope => {
    const a = window.__skyriver, s = window.__interiorTimer, gl = s.gl; gl.finish();
    s.scope = scope; s.ids = []; s.draws = 0;
    const state = a.renderState();
    if (scope === 'frame') s.ids.push(s.begin());
    if (scope === 'empty') { s.ids.push(s.begin()); gl.endQuery(s.ext.TIME_ELAPSED_EXT); }
    else a.scene.update(state.current.tick, state.current, state.alpha);
    if (scope === 'frame') gl.endQuery(s.ext.TIME_ELAPSED_EXT);
    s.scope = null; gl.flush();
    if (scope === 'tower' && s.ids.length !== 1) throw Error('Expected one tower query: ' + s.ids.length);
    return { ids: s.ids, calls: a.scene.renderer.info.render.calls, error: gl.getError(), draws: s.draws };
  }, scope);
  for (let i = 0; i < 100; i++) {
    const ready = await page.evaluate(ids => {
      const s = window.__interiorTimer, gl = s.gl;
      if (ids.some(id => !gl.getQueryParameter(s.pending.get(id), gl.QUERY_RESULT_AVAILABLE))) return null;
      const disjoint = gl.getParameter(s.ext.GPU_DISJOINT_EXT);
      const values = ids.map(id => { const q = s.pending.get(id), ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q); s.pending.delete(id); return ms; });
      return { values, disjoint };
    }, issued.ids);
    if (ready) return { ...issued, ...ready };
    await wait(5);
  }
  throw Error('Timer query did not finish.');
}
(async () => {
  const unlock = R.gpuLock('R34 paired interior silhouette ladder'); let session;
  try {
    session = await R.open(opt.url, opt.out); const p = session.page;
    await p.evaluate(source => { window.__interiorExperiment = new Function('app', source)(window.__skyriver); }, installer.installSource);
    const setup = await p.evaluate(directDraw => {
      const a = window.__skyriver, renderer = a.scene.renderer, gl = renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (!ext) throw Error('GPU timer unavailable.');
      const s = { gl, ext, scope: null, ids: [], nextId: 1, pending: new Map(), draws: 0 };
      s.begin = () => { const q = gl.createQuery(), id = s.nextId++; gl.beginQuery(ext.TIME_ELAPSED_EXT, q); s.pending.set(id, q); return id; };
      window.__interiorTimer = s;
      const original = renderer.renderBufferDirect;
      renderer.renderBufferDirect = function(...args) { const tower = args[4]?.name === 'skyriver.city.towers'; if (tower) s.draws++;
        if (s.scope === 'tower' && tower) { const id = s.begin(); try { return original.apply(this, args); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); s.ids.push(id); } }
        return original.apply(this, args);
      };
      if (directDraw) {
        const draw = gl.drawElementsInstanced; let inTower = false;
        gl.drawElementsInstanced = function(...args) {
          if (s.scope === 'tower' && inTower) { const id=s.begin(); try { return draw.apply(this,args); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); s.ids.push(id); } }
          return draw.apply(this,args);
        };
        renderer.renderBufferDirect = function(...args) { const tower=args[4]?.name === 'skyriver.city.towers'; if(tower) s.draws++; inTower=tower; try { return original.apply(this,args); } finally { inTower=false; } };
        s.restore = () => { renderer.renderBufferDirect=original; gl.drawElementsInstanced=draw; };
      } else s.restore = () => { renderer.renderBufferDirect = original; };
      return { settings: a.scene.renderSettings(), buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], dpr: renderer.getPixelRatio(), adapter: a.scene.glDiagnostics() };
    }, directDraw);
    if (setup.dpr !== 1.25 || setup.buffer.join() !== '1600,900') throw Error('DPR or buffer differs.');
    const sections = [];
    for (const target of [2400, 2800, 3200]) {
      const phase = await R.freezeAtRoute(p, target); const dir = path.join(opt.out, 'route-' + target); fs.mkdirSync(dir, { recursive: true });
      for (const offset of [0,...offsets]) { await select(p, offset); await R.settle(p, 24); }
      const evidence = await p.evaluate(async () => ({ variant: await window.__interiorExperiment.evidence(), source: window.__skyriver.scene.presentationInputs(), fog: window.__skyriver.scene.volumeEvidence(), settings: window.__skyriver.scene.renderSettings() }));
      const rows = [];
      for (const scope of ['frame', 'tower']) {
        for (const offset of offsets) {
          for (let block = 0; block < N; block++) for (const x of [0, offset, offset, 0]) {
            await select(p, x);
            rows.push({ scope, pairOffset: offset, offset: x, block, ...await query(p, scope) });
          }
        }
      }
      const empty = []; for (let i = 0; i < 8; i++) empty.push(await query(p, 'empty'));
      for (const offset of [0,...offsets]) { await select(p, offset); await R.settle(p, 24); await p.screenshot({ path: path.join(dir, 'offset-' + offset + '.png') }); }
      const summary = [];
      for (const scope of ['frame','tower']) for (const offset of offsets) {
        const select = value => rows.filter(r => r.scope === scope && r.pairOffset === offset && r.offset === value && !r.disjoint).map(r => r.values[0]);
        const base = select(0), changed = select(offset);
        const pairs = Array.from({ length: N }, (_, block) => { const a = rows.filter(r => r.scope === scope && r.pairOffset === offset && r.block === block); return a.every(r => !r.disjoint) ? (a[1].values[0] + a[2].values[0] - a[0].values[0] - a[3].values[0]) / 2 : null; }).filter(x => x !== null);
        summary.push({ scope, offset, usable: pairs.length > 0, validBlocks: pairs.length, samplesPerVariant: changed.length, baseP50: R.quantile(base,.5), baseP95: R.quantile(base,.95), changedP50: R.quantile(changed,.5), changedP95: R.quantile(changed,.95), pairedDeltaP50: R.quantile(pairs,.5), pairedDeltaP95: R.quantile(pairs,.95), invalid: rows.filter(r => r.scope === scope && r.pairOffset === offset && r.disjoint).length });
      }
      const section = { targetRouteM: target, phase, evidence, rows, empty, summary }; sections.push(section); R.write(path.join(dir,'timing.json'),section);
      console.log(JSON.stringify({ route: target, summary }));
    }
    const receipt = { url: opt.url, setup, sections: sections.map(s => ({ targetRouteM: s.targetRouteM, phase: s.phase, summary: s.summary })), directDraw, includeZero, installerSha: R.sha(installer.installSource), adapter: session.logs, errors: session.errors,
      protocol: 'Frozen source and camera. Warm cached shaders. Paired ABBA. Separate frame and tower queries. gl.finish before each query. No draw skipped. Frame values include command submission gaps. Tower scope is ' + (directDraw ? 'the actual gl.drawElementsInstanced call only' : 'renderBufferDirect setup and draw') + '. No pass sums.' };
    R.write(path.join(opt.out,'ladder.json'),receipt);
    await p.evaluate(() => { window.__interiorExperiment.restore(); window.__interiorTimer.restore(); });
    if (session.errors.length || sections.some(s => s.summary.some(r => !r.usable) || s.rows.some(r => r.error || r.calls > 32))) process.exitCode = 1;
  } finally { if (session) await session.browser.close(); unlock(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
