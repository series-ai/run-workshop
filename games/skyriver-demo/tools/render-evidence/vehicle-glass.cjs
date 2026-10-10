'use strict';
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const R = require('./experiment-runtime.cjs');
const [url, directory] = process.argv.slice(2);
if (!url || !directory) throw Error('Provide URL and output directory.');
(async () => {
  const release = R.gpuLock('R39 actual pane reflection controls');
  let runtime;
  try {
    runtime = await R.open(url, directory);
    const bundle = await esbuild.build({ stdin: { contents: 'export * from "three";', resolveDir: path.resolve(__dirname, '../..') }, bundle: true, platform: 'browser', format: 'esm', write: false });
    await runtime.page.route('**/__glass-three.mjs', route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
    await runtime.page.clock.runFor(12000 - await runtime.page.evaluate(() => performance.now()));
    await runtime.page.evaluate(() => window.__skyriver.suspend());
    await R.settle(runtime.page, 8);
    const result = await runtime.page.evaluate(async () => {
      const T = await import('/__glass-three.mjs');
      const app = window.__skyriver, renderer = app.scene.renderer, gl = renderer.getContext();
      app.scene.city.towerMesh.material.uniforms.uSkyFogDensityHigh.value = 0;
      renderer.setPixelRatio(1); renderer.setSize(512, 512, false);
      const scene = new T.Scene(); scene.background = new T.Color(0, 0, 0); scene.fog = new T.FogExp2(0, 0);
      const camera = new T.PerspectiveCamera(24, 1, 0.1, 14000);
      const width = 512, pixels = new Uint8Array(width * width * 4), rows = [], captures = [];
      const names = ['cab', 'interceptor', 'commuter', 'van', 'bus', 'flatbed'];
      function png(data) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = width;
        const ctx = canvas.getContext('2d'), image = ctx.createImageData(width, width);
        for (let y = 0; y < width; y++) image.data.set(data.subarray((width - y - 1) * width * 4, (width - y) * width * 4), y * width * 4);
        ctx.putImageData(image, 0, 0); return canvas.toDataURL('image/png');
      }
      for (const name of names) {
        const original = app.scene.scene.getObjectByName('skyriver.traffic.' + name);
        const geometry = original.geometry.clone(), pane = geometry.getAttribute('aGlass'), index = geometry.index;
        const paneIndex = [], bodyIndex = [];
        for (let i = 0; i < index.count; i += 3) {
          const target = pane.getX(index.getX(i)) === 1 ? paneIndex : bodyIndex;
          target.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
        }
        geometry.setIndex(paneIndex); geometry.getAttribute('aHullCoverage').setX(0, 1);
        const material = original.material.clone(); material.onBeforeCompile = original.material.onBeforeCompile;
        let shader;
        const compile = material.onBeforeCompile;
        material.onBeforeCompile = (program, engine) => { compile.call(material, program, engine); shader = program; };
        material.customProgramCacheKey = () => original.material.customProgramCacheKey() + '-glass-control-' + name;
        const mesh = new T.InstancedMesh(geometry, material, 1); mesh.frustumCulled = false; mesh.setColorAt(0, new T.Color(1, 1, 1)); scene.add(mesh);
        const views = [new T.Vector3(0.62, 0.34, 0.74).normalize(), new T.Vector3(0.8, 0.08, 0.6).normalize()];
        const fields = [];
        for (const [id, view, position] of [['view-a', views[0], new T.Vector3()], ['view-b', views[1], new T.Vector3()], ['world-shift', views[1], new T.Vector3(2.7, 0, 1.35)]]) {
          mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(position.x, position.y, position.z)); mesh.instanceMatrix.needsUpdate = true;
          camera.position.copy(position).addScaledVector(view, 24); camera.lookAt(position); camera.updateMatrixWorld(true);
          renderer.render(scene, camera);
          if (!shader?.uniforms.uTrafficGlassReflection) throw Error('Actual pane reflection shader is absent.');
          const read = strength => { shader.uniforms.uTrafficGlassReflection.value = strength; renderer.render(scene, camera); gl.readPixels(0, 0, width, width, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels.slice(); };
          const off = read(0), on = read(1), response = new Float64Array(width * width);
          let support = 0, positive = 0, energy = 0, chroma = 0;
          for (let p = 0; p < on.length; p += 4) {
            if (on[p] + on[p + 1] + on[p + 2] > 0 || off[p] + off[p + 1] + off[p + 2] > 0) {
              support++;
              const delta = (on[p] - off[p] + on[p + 1] - off[p + 1] + on[p + 2] - off[p + 2]) / 3;
              response[p / 4] = delta; energy += delta; if (delta > 0) positive++;
              chroma = Math.max(chroma, Math.max(on[p], on[p + 1], on[p + 2]) - Math.min(on[p], on[p + 1], on[p + 2]));
            }
          }
          const row = { name, id, source: app.renderState(), camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov }, worldPosition: position.toArray(), supportPixels: support, changedPixels: positive, meanReflectionLdr: energy / Math.max(support, 1), maxChannelSpreadLdr: chroma, glError: gl.getError(), shaderCacheKey: original.material.customProgramCacheKey() };
          rows.push(row); fields.push(response);
          captures.push({ name: name + '-' + id + '-on.png', data: png(on) }, { name: name + '-' + id + '-off.png', data: png(off) });
        }
        let worldChange = 0, worldSupport = 0;
        for (let p = 0; p < fields[0].length; p++) if (fields[1][p] !== 0 || fields[2][p] !== 0) { worldChange += Math.abs(fields[1][p] - fields[2][p]); worldSupport++; }
        const group = rows.slice(-3);
        const viewDelta = Math.abs(group[0].meanReflectionLdr - group[1].meanReflectionLdr);
        geometry.setIndex(bodyIndex);
        shader.uniforms.uTrafficGlassReflection.value = 0; renderer.render(scene, camera); gl.readPixels(0, 0, width, width, gl.RGBA, gl.UNSIGNED_BYTE, pixels); const bodyOff = pixels.slice();
        shader.uniforms.uTrafficGlassReflection.value = 1; renderer.render(scene, camera); gl.readPixels(0, 0, width, width, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let bodyChange = 0; for (let p = 0; p < pixels.length; p++) bodyChange += Math.abs(pixels[p] - bodyOff[p]);
        const meanWorldChange = worldChange / Math.max(worldSupport, 1);
        const acceptance = { visiblePane: group.every(r => r.supportPixels > 50), realResponse: group.slice(1).every(r => r.changedPixels > 10 && r.meanReflectionLdr > 0.05), neutral: group.every(r => r.maxChannelSpreadLdr <= 1), viewResponse: viewDelta > 0.02, worldDetail: meanWorldChange > 0.02, paneOnly: bodyChange === 0, gl: group.every(r => r.glError === 0) };
        group[0].audit = { viewMeanDifferenceLdr: viewDelta, meanWorldChangeLdr: meanWorldChange, nonPaneAbsoluteDifference: bodyChange, acceptance, pass: Object.values(acceptance).every(Boolean) };
        scene.remove(mesh); geometry.dispose(); material.dispose();
      }
      return { method: 'Actual production pane geometry and material. Source clock 12 s. Pane-only indexed faces. Uniform off and on controls. Same relative camera at two world positions. Two view angles. RGB values are display readback values.', rows, captures, pass: rows.filter(r => r.audit).every(r => r.audit.pass) };
    });
    for (const capture of result.captures) fs.writeFileSync(path.join(directory, capture.name), Buffer.from(capture.data.split(',')[1], 'base64'));
    delete result.captures; result.errors = runtime.errors; result.pass = result.pass && runtime.errors.length === 0;
    R.write(path.join(directory, 'glass.json'), result);
    console.log(JSON.stringify(result.rows.filter(r => r.audit).map(r => ({ name: r.name, ...r.audit }))));
    if (!result.pass) process.exitCode = 1;
  } finally { if (runtime) await runtime.browser.close(); release(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
