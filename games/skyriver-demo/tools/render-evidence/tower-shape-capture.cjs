'use strict';
const fs = require('node:fs'), path = require('node:path');
const R = require('./experiment-runtime.cjs');
const opt = R.args();
if (!opt.url || !opt.out || !opt.cameras) throw Error('Use --url, --out and --cameras.');
if (opt.masks !== undefined && !['true', 'false'].includes(opt.masks)) throw Error('Masks must be true or false.');
if (opt.masks === 'true' && opt.isolate !== 'true') throw Error('Masks need isolate true.');
if (opt.isolate !== undefined && !['true', 'false'].includes(opt.isolate)) throw Error('Isolate must be true or false.');
const input = JSON.parse(fs.readFileSync(opt.cameras, 'utf8'));
if (!input || !Array.isArray(input.rows) || !input.rows.length) throw Error('Camera file needs rows.');
const ids = new Set();
for (const row of input.rows) {
  if (!row || typeof row.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(row.id) || ids.has(row.id)) throw Error('Invalid camera ID.');
  ids.add(row.id);
  if (!Number.isInteger(row.seed) || row.seed < 0 || row.seed > 0xffffffff) throw Error('Camera seed must be an unsigned 32-bit integer.');
  const c = row.camera, route = row.requestedRoutePositionM ?? row.routePositionM;
  if (!Number.isFinite(route) || !c) throw Error('Camera route must be finite.');
  for (const [key, length] of [['position', 3], ['quaternion', 4], ['up', 3]]) {
    if (!Array.isArray(c[key]) || c[key].length !== length || !c[key].every(Number.isFinite)) throw Error('Invalid camera ' + key + '.');
  }
  const near = c.near ?? 1, far = c.far ?? 14000;
  if (!Number.isFinite(near) || !Number.isFinite(far) || near <= 0 || far <= near) throw Error('Invalid camera depth range.');
  if (opt.isolate === 'true' && !Number.isFinite(row.supportCanyon?.materialOwner)) throw Error('Isolated audit needs a finite tower owner.');
  if (Math.abs(Math.hypot(...c.quaternion) - 1) > 0.001 || Math.hypot(...c.up) === 0 || !(c.fov > 0 && c.fov < 179) || !(c.aspect > 0) || !Number.isFinite(c.fov) || !Number.isFinite(c.aspect)) throw Error('Invalid camera projection.');
}
(async () => {
  const unlock = R.gpuLock('R36 fixed shape cameras');
  let run;
  try {
    run = await R.open(opt.url, opt.out);
    const rows = [];
    for (const row of input.rows) {
      await run.page.evaluate(({ camera: c, route }) => {
        const a = window.__skyriver, s = a.scene, camera = s.camera;
        a.suspend(); s.setRoutePosition(route);
        camera.position.set(...c.position); camera.quaternion.set(...c.quaternion); camera.up.set(...c.up);
        camera.fov = c.fov; camera.aspect = c.aspect; camera.near = c.near ?? 1; camera.far = c.far ?? 14000;
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      }, { camera: row.camera, route: row.requestedRoutePositionM ?? row.routePositionM });
      await R.settle(run.page);
      const evidence = await run.page.evaluate(() => {
        const a = window.__skyriver, s = a.scene, c = s.camera;
        return { seed: s.city.layout.seed, source: a.renderState(), routeM: s.routePosition(), stats: a.stats(), settings: s.renderSettings(), adapter: s.glDiagnostics(), camera: { position: c.position.toArray(), quaternion: c.quaternion.toArray(), up: c.up.toArray(), fov: c.fov, aspect: c.aspect, near: c.near, far: c.far }, towers: s.city.towerMesh.count, towerCapacity: s.city.towerMesh.instanceMatrix.count, trims: s.city.trimMesh.count, trimCapacity: s.city.trimMesh.instanceMatrix.count, roofDetail: s.city.getRoofDetailEvidence(), glError: s.renderer.getContext().getError() };
      });
      if (evidence.seed !== row.seed) throw Error('Camera seed differs from the actual city seed.');
      let isolated = null;
      if (opt.isolate === 'true') {
        if (!Number.isFinite(row.supportCanyon?.materialOwner)) throw Error('Isolated audit needs the frozen tower owner.');
        isolated = await run.page.evaluate(owner => {
          const s = window.__skyriver.scene, original = s.city.towerMesh, identity = original.geometry.getAttribute('aMaterial');
          const selected = [];
          for (let i = 0; i < original.count; i++) if (Math.abs(identity.getX(i) - owner) < 0.00000008) selected.push(i);
          if (!selected.length) throw Error('Tower has no actual uploaded rows.');
          const geometry = original.geometry.clone(), mesh = new original.constructor(geometry, original.material, selected.length);
          for (const attribute of Object.values(geometry.attributes)) if (attribute.isInstancedBufferAttribute) {
            const before = attribute.array.slice();
            for (let i = 0; i < selected.length; i++) attribute.array.set(before.subarray(selected[i] * attribute.itemSize, (selected[i] + 1) * attribute.itemSize), i * attribute.itemSize);
            attribute.needsUpdate = true;
          }
          for (let i = 0; i < selected.length; i++) mesh.instanceMatrix.array.set(original.instanceMatrix.array.subarray(selected[i] * 16, (selected[i] + 1) * 16), i * 16);
          mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false;
          const scene = new s.scene.constructor(); scene.fog = s.scene.fog;
          const sky = s.scene.getObjectByName('skyriver.sky'); if (!sky) throw Error('Actual sky mesh is unavailable.');
          scene.add(sky.clone()); scene.add(mesh);
          const precedingCalls = s.renderer.info.render.calls;
          s.renderer.setRenderTarget(null); s.renderer.render(scene, s.camera);
          const result = { owner, selectedDrawRows: selected, count: selected.length, calls: s.renderer.info.render.calls - precedingCalls, protocol: 'Actual production geometry, instance attributes, material, world matrices, and sky. Other city objects hidden. Direct render without bloom or volume. The camera is the frozen 2km camera. This is a shape diagnostic, not a full-city visibility claim.' };
          window.__towerShapeDiagnostic = { scene, mesh, geometry };
          return result;
        }, row.supportCanyon.materialOwner);
      }
      const file = row.id + '.png';
      await run.page.screenshot({ path: path.join(opt.out, file) });
      let mask = null;
      if (opt.masks === 'true') {
        mask = await run.page.evaluate(() => {
          const s = window.__skyriver.scene, d = window.__towerShapeDiagnostic;
          const material = d.mesh.material.clone();
          material.fragmentShader = 'void main() { gl_FragColor = vec4(1.0); }';
          material.fog = false; material.toneMapped = false; material.needsUpdate = true;
          d.mesh.material = material;
          for (const child of [...d.scene.children]) if (child !== d.mesh) d.scene.remove(child);
          window.__towerShapeClearColour ??= Object.values(s.city.towerMaterial.uniforms).find(u => u.value?.isColor)?.value.clone();
          if (!window.__towerShapeClearColour) throw Error('No current Color value found.');
          const oldColour = s.renderer.getClearColor(window.__towerShapeClearColour).clone(), oldAlpha = s.renderer.getClearAlpha();
          const previousCalls = s.renderer.info.render.calls;
          s.renderer.setRenderTarget(null); s.renderer.setClearColor(0x000000, 1); s.renderer.clear(); s.renderer.render(d.scene, s.camera);
          s.renderer.setClearColor(oldColour, oldAlpha);
          const result = { calls: s.renderer.info.render.calls - previousCalls, glError: s.renderer.getContext().getError(), protocol: 'White coverage mask. Actual production vertex shader, geometry, instance attributes, matrices and camera. Only the fragment output changes. No sky, bloom or fog. Other buildings hidden.' };
          material.dispose();
          return result;
        });
      }
      if (mask && (mask.glError || mask.calls !== 1)) throw Error('Invalid mask draw.');
      if (mask) {
        const hiddenHud = await run.page.addStyleTag({ content: '[class^="skyriver-hud"], [class*=" skyriver-hud"] { visibility: hidden !important; }' });
        mask.file = row.id + '-mask.png';
        await run.page.locator('canvas').first().screenshot({ path: path.join(opt.out, mask.file) });
        await hiddenHud.evaluate(element => element.remove());
      }
      if (isolated) await run.page.evaluate(() => { const d = window.__towerShapeDiagnostic; d.geometry.dispose(); d.mesh.dispose(); delete window.__towerShapeDiagnostic; });
      rows.push({ id: row.id, file, requested: row, evidence, isolated, mask });
    }
    R.write(path.join(opt.out, 'captures.json'), { url: opt.url, protocol: 'Fixed source pose. Set each diagnostic camera and route directly. No autopilot, route seeking or backward simulation.', rows, adapterLogs: run.logs, errors: run.errors });
    console.log(JSON.stringify({ out: opt.out, rows: rows.map(r => ({ id: r.id, calls: r.evidence.stats.drawCalls, towers: r.evidence.towers, trims: r.evidence.trims })), errors: run.errors }));
    if (run.errors.length || rows.some(r => r.evidence.glError || r.evidence.stats.drawCalls > 32)) process.exitCode = 1;
  } finally { if (run) await run.browser.close(); unlock(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
