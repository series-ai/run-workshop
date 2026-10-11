'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { checkPhysicalScale, checkTrailIntensity } = require('./approach-acceptance.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [url, directory] = process.argv.slice(2);
const closingVelocity = Number(process.env.CLOSING_VELOCITY || 250);
const hullType = process.env.HULL_TYPE || '';
const visibilityControl = process.env.HULL_VISIBILITY_CONTROL || '';
if (visibilityControl && !['hidden', 'drop-frame'].includes(visibilityControl)) throw Error('Invalid HULL_VISIBILITY_CONTROL.');
if (hullType && !['cab', 'interceptor', 'commuter', 'van', 'bus', 'flatbed'].includes(hullType)) throw Error('Invalid HULL_TYPE.');
if (!url || !directory || !(closingVelocity > 0)) throw Error('Provide URL, output directory, and positive CLOSING_VELOCITY.');
(async () => {
  fs.mkdirSync(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.__skyriver?.stats().firstFrameMs != null, null, { timeout: 60000 });
    const result = await page.evaluate(({ closingVelocity, hullType, visibilityControl }) => {
      const app = window.__skyriver; app.suspend();
      const { renderer, camera, scene } = app.scene;
      const traffic = app.traffic;
      const time = 10;
      traffic.update(time, camera.position);
      const streak = traffic.objects.find(o => o.name === 'skyriver.traffic.streaks');
      const g = streak.geometry, ids = g.getAttribute('aCarLod'), positions = g.getAttribute('aCarPos');
      const types = ['cab', 'interceptor', 'commuter', 'van', 'bus', 'flatbed'];
      const shape = g.getAttribute('aCarShape');
      const row = Array.from({ length: g.instanceCount }, (_, i) => i).find(i => hullType ? types[shape.getX(i)] === hullType : ids.getZ(i) === 100);
      if (row === undefined) throw Error('Car 100 is absent.');
      const carId = ids.getZ(row);
      const pos = camera.position.clone().set(positions.getX(row), positions.getY(row), positions.getZ(row));
      const dirA = g.getAttribute('aCarDir');
      const dir = pos.clone().set(dirA.getX(row), dirA.getY(row), dirA.getZ(row)).normalize();
      const hulls = traffic.objects.filter(o => o.isInstancedMesh);
      let hull, slot;
      for (const mesh of hulls) for (let i = 0; i < mesh.count; i++) {
        const a = mesh.instanceMatrix.array, j = i * 16;
        if (Math.hypot(a[j + 12] - pos.x, a[j + 13] - pos.y, a[j + 14] - pos.z) < 0.01) { hull = mesh; slot = i; }
      }
      if (!hull) throw Error('Actual hull is absent.');
      const originalStats = traffic.stats();
      const trafficScene = new scene.constructor(); trafficScene.fog = scene.fog;
      for (const object of traffic.objects) trafficScene.add(object);
      renderer.info.reset(); renderer.setRenderTarget(null); renderer.render(trafficScene, camera);
      const trafficDraws = renderer.info.render.calls;
      const hullStage = { userData: hull.userData, transparent: hull.material.transparent,
        depthWrite: hull.material.depthWrite, depthTest: hull.material.depthTest };
      scene.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) o.visible = false; });
      for (let p = hull.parent; p; p = p.parent) p.visible = true;
      const isolated = new scene.constructor(); isolated.fog = scene.fog; isolated.add(hull, streak);
      renderer.autoClear = true; renderer.setClearColor(0x000000, 1);
      renderer.setPixelRatio(1); renderer.setSize(1280, 720, false);
      camera.aspect = 1280 / 720; camera.updateProjectionMatrix();
      const pixels = new Uint8Array(1280 * 720 * 4), gl = renderer.getContext();
      const captures = [];
      function image() {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext('2d'), im = ctx.createImageData(1280, 720);
        for (let y = 0; y < 720; y++) im.data.set(pixels.subarray((719 - y) * 5120, (720 - y) * 5120), y * 5120);
        ctx.putImageData(im, 0, 0); return canvas.toDataURL('image/png');
      }
      function render(distance, angle = 180, trails = false) {
        const radians = angle * Math.PI / 180;
        const right = dir.clone().set(dir.z, 0, -dir.x).normalize();
        camera.position.copy(pos).addScaledVector(dir, distance * Math.cos(radians)).addScaledVector(right, distance * Math.sin(radians));
        camera.lookAt(pos); camera.updateMatrixWorld(true);
        traffic.update(time, camera.position);
        if (ids.getZ(row) !== carId) throw Error('The uploaded car row changed identity.');
        const fadeAttribute = g.getAttribute('aCarFade');
        const baseScale = fadeAttribute.getY(row);
        const lightAlpha = ids.getX(row) + ids.getY(row);
        if (!(lightAlpha > 0)) throw Error('The uploaded source and tier fade cannot be recovered from zero light alpha.');
        const sourceTierFade = fadeAttribute.getX(row) / lightAlpha;
        const ma = hull.instanceMatrix.array, ca = hull.instanceColor.array;
        ma.copyWithin(0, slot * 16, slot * 16 + 16); ca.copyWithin(0, slot * 3, slot * 3 + 3);
        const alpha = hull.geometry.getAttribute('aFade');
        if (alpha) { alpha.array[0] = alpha.array[slot]; alpha.needsUpdate = true; }
        hull.count = 1; hull.instanceMatrix.needsUpdate = true; hull.instanceColor.needsUpdate = true;
        hull.visible = !trails && visibilityControl !== 'hidden' && !(visibilityControl === 'drop-frame' && Math.abs(distance - 950) < 0.1); streak.visible = trails;
        if (trails) {
          for (const name of ['aCarPos', 'aCarDir', 'aCarFade', 'aCarShape', 'aCarLod']) {
            const a = g.getAttribute(name); a.array.copyWithin(0, row * a.itemSize, (row + 1) * a.itemSize); a.needsUpdate = true;
          }
          // Isolate the actual trail quad. Keep the production shader and attributes.
          g.setDrawRange(12, 6); g.instanceCount = 1;
        }
        renderer.info.reset(); renderer.setRenderTarget(null); renderer.render(isolated, camera);
        gl.readPixels(0, 0, 1280, 720, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let litPixels = 0, energy = 0;
        for (let i = 0; i < pixels.length; i += 4) { const v = pixels[i] + pixels[i + 1] + pixels[i + 2]; if (v > 0) litPixels++; energy += v; }
        const actualDraws = renderer.info.render.calls;
        let trailControl = null;
        if (trails) {
          const actualPixels = pixels.slice();
          const productionMaterial = streak.material;
          const signedTerm = 'vIntensity *= 1.0 - smoothstep( 0.72, 0.90, - facing );';
          if (productionMaterial.vertexShader.split(signedTerm).length !== 2) throw Error('The shipped signed trail term is absent or repeated.');
          const referenceMaterial = productionMaterial.clone();
          referenceMaterial.vertexShader = referenceMaterial.vertexShader.replace(signedTerm, '');
          referenceMaterial.uniforms = productionMaterial.uniforms;
          referenceMaterial.onBeforeCompile = productionMaterial.onBeforeCompile;
          referenceMaterial.customProgramCacheKey = productionMaterial.customProgramCacheKey;
          try {
            streak.material = referenceMaterial;
            renderer.info.reset(); renderer.render(isolated, camera);
            gl.readPixels(0, 0, 1280, 720, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            let referenceLitPixels = 0, referenceEnergy = 0, mismatchedReferenceChannels = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              const v = pixels[i] + pixels[i + 1] + pixels[i + 2];
              if (v > 0) referenceLitPixels++;
              referenceEnergy += v;
              for (let channel = 0; channel < 3; channel++) if (pixels[i + channel] !== actualPixels[i + channel]) mismatchedReferenceChannels++;
            }
            trailControl = { referenceLitPixels, referenceEnergy, mismatchedReferenceChannels,
              facing: Math.max(-1, Math.min(1, dir.dot(camera.position.clone().sub(pos).normalize()))),
              facingOrigin: 'Uploaded car centre. Use only saturated front and rear endpoint checks.',
              method: 'Same uploaded attributes, camera, fog, and uniforms. Remove only the shipped signed trail intensity term in the reference shader.' };
          } finally {
            streak.material = productionMaterial;
            referenceMaterial.dispose(); pixels.set(actualPixels);
          }
        }
        const scale = Math.hypot(ma[0], ma[1], ma[2]);
        const measuredDistanceM = Math.hypot(ma[12] - camera.position.x, ma[13] - camera.position.y, ma[14] - camera.position.z);
        const verts = hull.geometry.getAttribute('position'), index = hull.geometry.index;
        const matrix = hull.matrixWorld.clone().fromArray(ma), point = pos.clone();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const projected = [];
        for (let i = 0; i < verts.count; i++) {
          point.set(verts.getX(i), verts.getY(i), verts.getZ(i)).applyMatrix4(matrix).project(camera);
          const x = (point.x + 1) * 640, y = (point.y + 1) * 360;
          projected.push([x, y]); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        let rawTriangleAreaPx2 = 0;
        for (let i = 0; i < index.count; i += 3) {
          const a = projected[index.getX(i)], b = projected[index.getX(i + 1)], c = projected[index.getX(i + 2)];
          rawTriangleAreaPx2 += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * 0.5;
        }
        return { distanceM: distance, measuredDistanceM, scale, baseScale, sourceTierFade,
          sourceTierFadeMethod: 'aCarFade.x / (aCarLod.x + aCarLod.y). The upload does not expose the two fade factors separately.',
          trailControl, hullFade: alpha?.array[0] ?? null, rawTriangleAreaPx2,
          normalizedRawArea: rawTriangleAreaPx2 * distance * distance, extentPx: Math.max(maxX - minX, maxY - minY), litPixels, energy, draws: actualDraws };
      }
      const frames = [];
      for (let frame = 0; frame <= Math.ceil(700 / closingVelocity * 60); frame++) {
        const distance = Math.max(600, 1300 - frame * closingVelocity / 60);
        const value = render(distance); frames.push({ frame, timeS: frame / 60, ...value });
        if (frame % 12 === 0 || distance === 600) captures.push({ name: `rear-${frame}-${distance.toFixed(1)}m.png`, image: image() });
      }
      const rear200 = render(200); captures.push({ name: 'rear-200m.png', image: image() });
      const trails = [];
      for (const angle of [180, 170, 155, 90, 0]) { trails.push({ angle, ...render(200, angle, true) }); captures.push({ name: `trail-${angle}-200m.png`, image: image() }); }
      return { url: location.href, visibilityControl, sourceTimeS: time, cameraFov: camera.fov, closingVelocity, fps: 60, originalStats, trafficDraws, hullStage, hull: hull.name, carId, frames, rear200, trails, captures, glError: gl.getError() };
    }, { closingVelocity, hullType, visibilityControl });
    for (const capture of result.captures) fs.writeFileSync(path.join(directory, capture.name), Buffer.from(capture.image.split(',')[1], 'base64'));
    delete result.captures; result.errors = errors;
    result.physicalScale = checkPhysicalScale([...result.frames, result.rear200, ...result.trails].map(frame => ({
      distanceM: frame.measuredDistanceM, scale: frame.scale, baseScale: frame.baseScale, sourceTierFade: frame.sourceTierFade,
    })));
    const front = result.trails.find(frame => frame.angle === 0);
    const rear = result.trails.find(frame => frame.angle === 180);
    result.trailIntensity = checkTrailIntensity([front, rear].map(frame => ({
      facing: frame.trailControl.facing, ungatedIntensity: frame.trailControl.referenceEnergy, intensity: frame.energy,
    })));
    result.trailIntensity.method = 'Actual readback RGB energy versus the controlled ungated shader. Scalar comparison applies only to saturated endpoint gains 1 and 0.';
    const area = result.frames.map(frame => frame.normalizedRawArea);
    const maxAreaStep = Math.max(...area.slice(1).map((value, i) => Math.abs(value - area[i]) / Math.max(value, area[i], 1)));
    const peakPixels = Math.max(...result.frames.map(frame => frame.litPixels));
    const maxPixelStep = Math.max(...result.frames.slice(1).map((frame, i) => Math.abs(frame.litPixels - result.frames[i].litPixels))) / Math.max(peakPixels, 1);
    result.pixelContinuity = { maxAdjacentStepOverPeak: maxPixelStep, limit: 0.15,
      method: 'Actual readback lit-pixel count. Absolute adjacent change divided by the 600 to 1300 m peak. The 15 percent limit permits small raster steps in a 5 to 15 pixel wide hull. Full coverage at 600 and 200 m must remain visible.' };
    result.acceptance = { visibleNearHull: result.frames.at(-1).hullFade > 0.99 && result.frames.at(-1).litPixels >= 10 && result.frames.at(-1).energy > 500 && result.rear200.hullFade > 0.99 && result.rear200.litPixels >= 50 && result.rear200.energy > 3000,
      noFullCoverageGap: result.frames.filter(frame => frame.hullFade > 0.99).every(frame => frame.litPixels > 0),
      pixelContinuity: maxPixelStep < 0.15,
      shippedPhysicalScale: result.physicalScale.pass,
      normalizedAreaStep: maxAreaStep < 0.015, maxNormalizedAreaStep: maxAreaStep,
      zeroRearTrail: rear.litPixels === 0 && rear.energy === 0 && rear.trailControl.referenceLitPixels > 0 && rear.trailControl.referenceEnergy > 0,
      preservedFrontTrail: front.litPixels > 0 && front.energy > 0 && front.trailControl.referenceLitPixels > 0
        && front.trailControl.mismatchedReferenceChannels === 0,
      signedTrailIntensity: result.trailIntensity.pass,
      trafficDrawBudget: result.trafficDraws <= 8, gl: result.glError === 0 && errors.length === 0 };
    result.pass = Object.entries(result.acceptance).filter(([name]) => name !== 'maxNormalizedAreaStep').every(([, value]) => value === true);
    fs.writeFileSync(path.join(directory, 'closure.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ frames: result.frames.length, glError: result.glError, errors, first: result.frames[0], middle: result.frames[26], last: result.frames.at(-1), rear200: result.rear200, trails: result.trails }));
    if (!result.pass) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
