'use strict';
const path = require('node:path');
const fs = require('node:fs');
const R = require('./experiment-runtime.cjs');
const opt = R.args(), N = Number(opt.samples ?? 32);
if (!opt.url || !opt.out || !Number.isInteger(N) || N < 8 || N > 256) throw Error('Use --url and --out. Samples must be 8–256.');
const targets = [2400, 2800, 3200];
const reference = opt['reference-timing'] ? JSON.parse(fs.readFileSync(opt['reference-timing'], 'utf8')) : null;
if (reference) {
  if (!Array.isArray(reference.sections) || reference.sections.length !== targets.length) throw Error('Invalid reference sections.');
  reference.sections.forEach((section, i) => {
    const p = section.phase;
    if (section.target !== targets[i] || !p || !['routeM', 'tick', 'alpha', 'clockMs', 'fov', 'aspect'].every(k => Number.isFinite(p[k]))) throw Error('Invalid reference phase.');
    for (const [key, n] of [['position', 3], ['quaternion', 4], ['up', 3]]) if (!Array.isArray(p[key]) || p[key].length !== n || !p[key].every(Number.isFinite)) throw Error('Invalid reference camera.');
    if (Math.abs(Math.hypot(...p.quaternion) - 1) > .001 || Math.hypot(...p.up) === 0 || p.fov <= 0 || p.fov >= 179 || p.aspect <= 0) throw Error('Invalid reference projection.');
  });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function query(page, scope) {
  const issued = await page.evaluate(scope => {
    const a = window.__skyriver, t = window.__shapeTimer, gl = t.gl;
    const checkCamera = () => {
      const c = a.scene.camera;
      const actual = { position: c.position.toArray(), quaternion: c.quaternion.toArray(), up: c.up.toArray(), fov: c.fov, aspect: c.aspect };
      if (JSON.stringify(actual) !== JSON.stringify(t.expectedCamera)) throw Error('Camera changed during timing.');
    };
    checkCamera();
    gl.finish(); t.scope = scope; t.ids = [];
    const state = a.renderState();
    if (scope === 'frame' || scope === 'empty') t.ids.push(t.begin());
    if (scope !== 'empty') a.scene.update(state.current.tick, state.current, state.alpha);
    if (scope === 'frame' || scope === 'empty') gl.endQuery(t.ext.TIME_ELAPSED_EXT);
    t.scope = null; gl.flush();
    checkCamera();
    if (t.ids.length !== 1) throw Error('Expected one query: ' + t.ids.length);
    return { ids: t.ids, calls: a.scene.renderer.info.render.calls, glError: gl.getError() };
  }, scope);
  for (let i = 0; i < 100; i++) {
    const ready = await page.evaluate(ids => {
      const t = window.__shapeTimer, gl = t.gl;
      if (!ids.every(id => gl.getQueryParameter(t.pending.get(id), gl.QUERY_RESULT_AVAILABLE))) return null;
      const disjoint = gl.getParameter(t.ext.GPU_DISJOINT_EXT);
      const values = ids.map(id => { const q = t.pending.get(id), ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q); t.pending.delete(id); return ms; });
      return { values, disjoint };
    }, issued.ids);
    if (ready) return { ...issued, ...ready };
    await wait(5);
  }
  throw Error('Timer query did not finish.');
}
(async () => {
  const unlock = R.gpuLock('R36 tower and full-frame timing'); let run;
  try {
    run = await R.open(opt.url, opt.out);
    const setup = await run.page.evaluate(() => {
      const a = window.__skyriver, renderer = a.scene.renderer, gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) throw Error('Timer queries unavailable.');
      const t = { gl, ext, scope: null, ids: [], next: 1, pending: new Map() };
      t.begin = () => { const q = gl.createQuery(), id = t.next++; gl.beginQuery(ext.TIME_ELAPSED_EXT, q); t.pending.set(id, q); return id; };
      window.__shapeTimer = t;
      const render = renderer.renderBufferDirect, draw = gl.drawElementsInstanced; let inTower = false;
      renderer.renderBufferDirect = function(...args) { inTower = args[4]?.name === 'skyriver.city.towers'; try { return render.apply(this, args); } finally { inTower = false; } };
      gl.drawElementsInstanced = function(...args) { if (t.scope === 'tower' && inTower) { const id = t.begin(); try { return draw.apply(this, args); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); t.ids.push(id); } } return draw.apply(this, args); };
      t.restore = () => { renderer.renderBufferDirect = render; gl.drawElementsInstanced = draw; };
      return { adapter: a.scene.glDiagnostics(), settings: a.scene.renderSettings(), buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], dpr: renderer.getPixelRatio() };
    });
    if (setup.dpr !== 1.25 || setup.buffer.join() !== '1600,900') throw Error('DPR or buffer differs.');
    const sections = []; let invalidQuery = false;
    for (const target of targets) {
      let phase = await R.freezeAtRoute(run.page, target);
      const naturalCamera = { position: phase.position, quaternion: phase.quaternion, up: phase.up, fov: phase.fov, aspect: phase.aspect };
      if (reference) {
        const saved = reference.sections.find(s => s.target === target).phase;
        if (!['routeM', 'tick', 'alpha', 'clockMs'].every(k => phase[k] === saved[k])) throw Error('Reference source phase differs.');
        const camera = await run.page.evaluate(p => {
          const c = window.__skyriver.scene.camera;
          c.position.set(...p.position); c.quaternion.set(...p.quaternion); c.up.set(...p.up);
          c.fov = p.fov; c.aspect = p.aspect; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
          return { position: c.position.toArray(), quaternion: c.quaternion.toArray(), up: c.up.toArray(), fov: c.fov, aspect: c.aspect };
        }, saved);
        phase = { ...phase, ...camera };
      }
      await run.page.evaluate(p => {
        window.__shapeTimer.expectedCamera = { position: p.position, quaternion: p.quaternion, up: p.up, fov: p.fov, aspect: p.aspect };
      }, phase);
      await R.settle(run.page);
      const rows = [];
      for (let block = 0; block < N; block++) for (const scope of (block % 2 ? ['tower', 'frame'] : ['frame', 'tower'])) rows.push({ scope, block, ...await query(run.page, scope) });
      for (let i = 0; i < 8; i++) rows.push({ scope: 'empty', block: i, ...await query(run.page, 'empty') });
      if (rows.some(r => r.glError || r.calls > 32)) invalidQuery = true;
      const summary = ['frame', 'tower', 'empty'].map(scope => { const valid = rows.filter(r => r.scope === scope && !r.disjoint).map(r => r.values[0]); return { scope, valid: valid.length, p50Ms: R.quantile(valid, .5), p95Ms: R.quantile(valid, .95) }; });
      const dir = path.join(opt.out, 'route-' + target); R.write(path.join(dir, 'timing.json'), { target, phase, rows, summary });
      await run.page.screenshot({ path: path.join(dir, 'frame.png') });
      const counts = await run.page.evaluate(() => ({ tower: window.__skyriver.scene.city.towerMesh.count, trim: window.__skyriver.scene.city.trimMesh.count }));
      sections.push({ target, phase, naturalCamera, summary, counts }); console.log(JSON.stringify(sections.at(-1)));
    }
    R.write(path.join(opt.out, 'timing.json'), { url: opt.url, referenceTiming: opt['reference-timing'] ?? null, setup, sections, adapterLogs: run.logs, errors: run.errors, protocol: 'Separate full-frame and raw tower draw queries. Source and camera held at each route. Camera equality is checked before and after every query. An optional reference fixes the base camera and requires the same source phase. Same shaders and DPR. gl.finish precedes each query. Full-frame results include driver submission gaps. Independent artifact runs are not a paired in-frame A/B. No pass sums.' });
    await run.page.evaluate(() => window.__shapeTimer.restore());
    if (invalidQuery || run.errors.length || sections.some(s => s.summary.some(x => x.valid === 0))) process.exitCode = 1;
  } finally { if (run) await run.browser.close(); unlock(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
