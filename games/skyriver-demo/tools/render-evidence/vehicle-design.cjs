const fs = require('node:fs'),
  path = require('node:path'),
  esbuild = require('esbuild');
const R = require('./experiment-runtime.cjs');
(async () => {
  const [url, out, recipeFile] = process.argv.slice(2),
    release = R.gpuLock('R39 vehicle before/after cameras');
  let r;
  try {
    r = await R.open(url, out);
    const bundle = await esbuild.build({
      stdin: { contents: 'export * from "three";', resolveDir: path.resolve(__dirname, '../..') },
      bundle: true,
      platform: 'browser',
      format: 'esm',
      write: false,
    });
    await r.page.route('**/__vehicle-audit-three.mjs', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }),
    );
    const recipe = recipeFile ? JSON.parse(fs.readFileSync(recipeFile)) : null,
      clock = recipe?.sourceClockMs ?? 12000,
      now = await r.page.evaluate(() => performance.now());
    await r.page.clock.runFor(clock - now);
    await r.page.evaluate(() => window.__skyriver.suspend());
    await R.settle(r.page, 8);
    const source = await r.page.evaluate(() => window.__skyriver.renderState());
    const sceneReceipt = await r.page.evaluate(() => {
      const a = window.__skyriver,
        s = a.scene,
        seen = new Set();
      let bytes = 0;
      s.scene.traverse((o) => {
        for (const q of [o.instanceMatrix, o.instanceColor]) {
          if (q && !seen.has(q.array.buffer)) {
            seen.add(q.array.buffer);
            bytes += q.array.buffer.byteLength;
          }
        }
        for (const q of Object.values(o.geometry?.attributes ?? {}))
          if (q.isInstancedBufferAttribute && !seen.has(q.array.buffer)) {
            seen.add(q.array.buffer);
            bytes += q.array.buffer.byteLength;
          }
      });
      return {
        stats: a.stats(),
        render: { ...s.renderer.info.render },
        instanceBytes: bytes,
        settings: s.renderSettings(),
        gl: s.glDiagnostics(),
        glError: s.renderer.getContext().getError(),
      };
    });
    const plans =
      recipe?.rows ??
      ['cab', 'van', 'bus', 'flatbed', 'interceptor', 'commuter']
        .flatMap((type) =>
          ['near', 'silhouette'].map((view) => ({
            id: type + '-' + view,
            type,
            view,
            scale: 2,
            distanceM: view === 'near' ? 75 : 180,
            angle: [0.62, 0.34, 0.74],
            fov: view === 'near' ? 18 : 20,
          })),
        )
        .concat([
          { id: 'player-front', type: 'player', view: 'near', scale: 1, distanceM: 60, angle: [0.62, 0.34, 0.74], fov: 22 },
          { id: 'player-rear', type: 'player', view: 'near', scale: 1, distanceM: 60, angle: [-0.62, 0.34, -0.74], fov: 22 },
          { id: 'player-below', type: 'player', view: 'near', scale: 1, distanceM: 60, angle: [0.62, -0.5, 0.6], fov: 22 },
        ]);
    const rows = [];
    for (const plan of plans) {
      const receipt = await r.page.evaluate(async (p) => {
        const T = await import('/__vehicle-audit-three.mjs');
        const s = window.__skyriver.scene,
          renderer = s.renderer,
          original = s.scene.getObjectByName(p.type === 'player' ? 'skyriver.shuttle.hull' : 'skyriver.traffic.' + p.type);
        if (!original) throw Error('Missing real vehicle ' + p.type);
        const scene = new T.Scene();
        scene.background = new T.Color(0.11, 0.18, 0.27);
        scene.fog = new T.FogExp2(new T.Color(0.11, 0.18, 0.27), 0);
        s.city.towerMesh.material.uniforms.uSkyFogDensityHigh.value = 0;
        const material = original.material.clone(),
          originalCompile = original.material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          originalCompile.call(original.material, shader, renderer);
          if (shader.uniforms.uPickupCount) shader.uniforms.uPickupCount.value = 0;
        };
        material.customProgramCacheKey = original.material.customProgramCacheKey;
        const geometry = original.geometry.clone();
        let model;
        if (p.type === 'player') {
          model = new T.Mesh(geometry, material);
          model.scale.setScalar(p.scale);
        } else {
          geometry.getAttribute('aHullCoverage').setX(0, 1);
          geometry.getAttribute('aHullCoverage').needsUpdate = true;
          model = new T.InstancedMesh(geometry, material, 1);
          model.setMatrixAt(0, new T.Matrix4().makeScale(p.scale, p.scale, p.scale));
          const tint =
            p.tint ??
            (p.palette ? [original.instanceColor.getX(0), original.instanceColor.getY(0), original.instanceColor.getZ(0)] : [1, 1, 1]);
          model.setColorAt(0, new T.Color(...tint));
          p.tint = tint;
          model.count = 1;
        }
        model.frustumCulled = false;
        scene.add(model);
        const c = new T.PerspectiveCamera(p.fov, 1280 / 720, 1, 14000);
        if (p.camera) {
          c.position.fromArray(p.camera.position);
          c.quaternion.fromArray(p.camera.quaternion);
          c.up.fromArray(p.camera.up);
        } else {
          c.position.fromArray(p.angle).normalize().multiplyScalar(p.distanceM);
          c.lookAt(0, 0, 0);
        }
        c.updateProjectionMatrix();
        c.updateMatrixWorld(true);
        renderer.setRenderTarget(null);
        renderer.info.reset();
        renderer.render(scene, c);
        renderer.getContext().finish();
        geometry.computeBoundingBox();
        let geometryBytes = geometry.index?.array.byteLength ?? 0;
        for (const [name, attr] of Object.entries(geometry.attributes))
          if (!attr.isInstancedBufferAttribute) geometryBytes += attr.array.byteLength;
        const identities = {};
        for (const [name, attr] of Object.entries(geometry.attributes))
          if (!attr.isInstancedBufferAttribute) identities[name] = Array.from(attr.array);
        identities.index = Array.from(geometry.index?.array ?? []);
        const result = {
          camera: { position: c.position.toArray(), quaternion: c.quaternion.toArray(), up: c.up.toArray(), fov: c.fov },
          triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
          geometryBytes,
          bounds: [...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray()],
          identities,
          render: { ...renderer.info.render },
          glError: renderer.getContext().getError(),
          tint: p.tint ?? [1, 1, 1],
          controls: {
            sourceOff: true,
            instanceTint: p.tint ?? [1, 1, 1],
            instanceCoverage: 1,
            bloom: false,
            fogDensity: 0,
            highFogDensity: 0,
            skyLinear: [0.11, 0.18, 0.27],
            toneMapping: renderer.toneMapping,
            exposure: renderer.toneMappingExposure,
          },
        };
        window.__r39Isolated = { scene, c, model };
        return result;
      }, plan);
      await r.page.screenshot({ path: path.join(out, plan.id + '.png') });
      for (const [name, v] of Object.entries(receipt.identities)) receipt.identities[name] = R.sha(JSON.stringify(v));
      rows.push({ ...plan, ...receipt });
    }
    const report = {
      url,
      sourceClockMs: clock,
      captureClockMs: await r.page.evaluate(() => performance.now()),
      source,
      sceneReceipt,
      method:
        'Actual uploaded hull geometry and actual material hook. One true instanced car. Fixed neutral tint. Full coverage. No fog or bloom. Neutral sky. Source-off player material. Same held camera per before/after plan.',
      rows,
      errors: r.errors,
    };
    R.write(path.join(out, 'captures.json'), report);
    console.log(
      JSON.stringify({
        rows: rows.map((p) => ({ id: p.id, triangles: p.triangles, bytes: p.geometryBytes, glError: p.glError })),
        scene: sceneReceipt.stats,
        errors: r.errors,
      }),
    );
    const sourceMatches = !recipe || JSON.stringify(source) === JSON.stringify(recipe.source);
    report.sourceMatches = sourceMatches;
    R.write(path.join(out, 'captures.json'), report);
    if (r.errors.length || rows.some((p) => p.glError) || !sourceMatches) process.exitCode = 1;
  } finally {
    if (r) await r.browser.close();
    release();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
