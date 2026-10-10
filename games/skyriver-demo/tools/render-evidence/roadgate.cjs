// Road gate (R17): the classic POVs (top-down loop, top-down near, vanishing point, depths) plus a
// trail-rod assertion. For every live trail in the chase frame and the vanishing-point frame, the
// on-screen trail length (lamp to end, the shader's formula from the material's uniforms) is
// compared with the same car's on-screen length; the max ratio must be <= TRAIL_MAX_CAR_LENGTHS
// (+2%), and the end width must taper (end/head <= 0.6). Exit code 1 when either fails.
// usage: node roadgate.cjs URL OUTPREFIX
const { createRequire } = require('module');
const req = require;
const { chromium } = req(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const [url, out] = [process.argv[2], process.argv[3]];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.text().includes('gl adapter')) logs.push(m.text()); });
  page.on('pageerror', e => logs.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__skyriver && window.__skyriver.stats().firstFrameMs !== null, null, { timeout: 20000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.__skyriver.suspend());
  const measure = () => page.evaluate(() => {
    const a = window.__skyriver; const s = a.scene; const c = s.camera; c.updateMatrixWorld(true);
    let streak = null; s.scene.traverse((o) => { if (o.name === 'skyriver.traffic.streaks') streak = o; });
    const g = streak.geometry; const u = streak.material.uniforms;
    const pos = g.getAttribute('aCarPos').array; const dir = g.getAttribute('aCarDir').array; const fade = g.getAttribute('aCarFade').array;
    const shape = g.getAttribute('aCarShape');
    const FS = g.getAttribute('aCarFade').itemSize; const n = g.instanceCount;
    const V = c.position.constructor; const A = new V(); const B = new V(); const P = new V(); const Q = new V();
    const shader = streak.material.vertexShader;
    const profileSource = 'TrafficLampShape trafficLampProfile(float type, bool front)';
    const parseLampProfiles = (source) => {
      const start = source.indexOf(profileSource);
      if (start < 0) return null;
      const bodyStart = source.indexOf('{', start);
      if (bodyStart < 0) throw new Error('Lamp profile function has no body.');
      let depth = 0, bodyEnd = -1;
      for (let i = bodyStart; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}' && --depth === 0) { bodyEnd = i; break; }
      }
      if (bodyEnd < 0) throw new Error('Lamp profile function is not closed.');
      const body = source.slice(bodyStart + 1, bodyEnd);
      const number = '([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)';
      const row = new RegExp(`if\\s*\\(\\s*type\\s*<\\s*${number}\\s*\\)\\s*\\{\\s*if\\s*\\(\\s*front\\s*\\)\\s*return\\s+TrafficLampShape\\(\\s*vec4\\(([^)]*)\\)\\s*,\\s*${number}\\s*\\)\\s*;\\s*return\\s+TrafficLampShape\\(\\s*vec4\\(([^)]*)\\)\\s*,\\s*${number}\\s*\\)\\s*;\\s*\\}`, 'g');
      const rows = [...body.matchAll(row)];
      if (rows.length !== 6) throw new Error(`Expected six live lamp profiles. Found ${rows.length}.`);
      const shape = (dimensions, y) => {
        const values = dimensions.split(',').map((value) => Number(value.trim()));
        if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || !Number.isFinite(y)) throw new Error('Live lamp profile contains invalid values.');
        return { sideCenterM: values[0], widthParamM: values[1], heightM: values[2], zM: values[3], yM: y };
      };
      return rows.map((match, index) => ({ index, threshold: Number(match[1]), front: shape(match[2], Number(match[3])), rear: shape(match[4], Number(match[5])) }));
    };
    const profiles = parseLampProfiles(shader);
    const legacy = !profiles && Number.isFinite(u.uHeadOffset?.value) && Number.isFinite(u.uTailOffset?.value);
    if (!profiles && !legacy) throw new Error('Live streak shader has no lamp profile table and no legacy offsets.');
    if (profiles && (!shape || shape.itemSize !== 2)) throw new Error('Profile shader requires aCarShape(type, bank).');
    const fallbackFrontZ = legacy ? u.uHeadOffset.value : 0;
    const fallbackRearZ = legacy ? -u.uTailOffset.value : 0;
    const px = (p) => { const q = p.clone().project(c); return [(q.x + 1) * 640, (1 - q.y) * 360, q.z]; };
    const view = (p) => p.clone().applyMatrix4(c.matrixWorldInverse);
    const screenPoint = (p) => { const v = view(p); const d = Math.max(-v.z, 1); return [v.x / d, v.y / d]; };
    const screenDistance = (p, q) => { const a = screenPoint(p); const b = screenPoint(q); return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const typeCounts = {};
    let maxRatio = 0; let maxTrailPx = 0; let measured = 0; let maxEndShare = 0;
    for (let i = 0; i < n; i += 1) {
      const w = FS > 3 ? fade[i * FS + 3] : 0; if (w <= 0.001 || fade[i * FS] < 0.05) continue;
      const scale = fade[i * FS + 1]; const speed = dir[i * 4 + 3];
      const d = new V(dir[i * 4], clamp(dir[i * 4 + 1], -0.35, 0.35), dir[i * 4 + 2]).normalize();
      const typeIndex = shape ? Math.round(shape.array[i * shape.itemSize]) : -1;
      const bank = shape ? shape.array[i * shape.itemSize + 1] : 0;
      const profile = profiles?.[typeIndex];
      if (profiles && !profile) throw new Error(`No live lamp profile for type index ${typeIndex}.`);
      const front = profile?.front;
      const rear = profile?.rear;
      const frontZ = front?.zM ?? fallbackFrontZ;
      const rearZ = rear?.zM ?? fallbackRearZ;
      const rearY = rear?.yM ?? 0;
      const carLen = frontZ - rearZ;
      if (!(carLen > 0)) throw new Error(`Invalid live car length for type index ${typeIndex}.`);
      const right0 = new V(d.z, 0, -d.x).normalize();
      const up0 = new V().crossVectors(d, right0);
      const cos = Math.cos(bank); const sin = Math.sin(bank);
      const rightW = right0.clone().multiplyScalar(cos).addScaledVector(up0, sin);
      const upW = up0.clone().multiplyScalar(cos).addScaledVector(right0, -sin);
      const scaleBase = new V(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      A.copy(scaleBase).addScaledVector(d, rearZ * scale).addScaledVector(upW, rearY * scale);
      let trail = Math.min(speed * u.uTrailSeconds.value, Math.min(u.uTrailMax.value,
        (u.uTrailCarLengths ? u.uTrailCarLengths.value : 1e9) * carLen * scale));
      B.copy(A).addScaledVector(d, -trail);
      if (u.uTrailCarLengths) {
        // Mirror of the shader's on-screen cap (two refinement steps in view space).
        const ch = scaleBase.clone().addScaledVector(d, frontZ * scale);
        const ct = scaleBase.clone().addScaledVector(d, rearZ * scale);
        const carS = screenDistance(ch, ct);
        for (let k = 0; k < 2; k += 1) {
          const tS = screenDistance(A, B);
          const lim = u.uTrailCarLengths.value * carS;
          if (tS > lim && tS > 0) { trail *= lim / tS; B.copy(A).addScaledVector(d, -trail); }
        }
      }
      P.copy(scaleBase).addScaledVector(d, frontZ * scale);
      Q.copy(scaleBase).addScaledVector(d, rearZ * scale);
      const a0 = px(A); const b0 = px(B); const p0 = px(P); const q0 = px(Q);
      if (a0[2] > 1 || b0[2] > 1 || a0[2] < -1) continue;
      if (Math.abs(a0[0] - 640) > 700 || Math.abs(a0[1] - 360) > 400) continue;
      const tpx = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]);
      const cpx = Math.hypot(p0[0] - q0[0], p0[1] - q0[1]);
      maxTrailPx = Math.max(maxTrailPx, tpx);
      if (cpx > 2) {
        maxRatio = Math.max(maxRatio, tpx / cpx); measured += 1;
        const key = profiles ? String(typeIndex) : 'legacy';
        typeCounts[key] = (typeCounts[key] || 0) + 1;
      }
    }
    maxEndShare = u.uTrailEndWidth ? u.uTrailEndWidth.value : 1;
    const forward = new V(0, 0, -1).applyQuaternion(c.quaternion);
    const camera = { position: c.position.toArray(), up: c.up.toArray(), quaternion: c.quaternion.toArray(), forward: forward.toArray(), fov: c.fov, suspended: a.suspended };
    return { measured, maxTrailPx: +maxTrailPx.toFixed(1), maxTrailToCarRatio: +maxRatio.toFixed(4), endWidthShare: maxEndShare, capCarLengths: u.uTrailCarLengths ? u.uTrailCarLengths.value : null,
      profileSource: profiles ? 'live streak vertexShader trafficLampProfile' : 'legacy uHeadOffset/uTailOffset fallback', profileCount: profiles?.length ?? null,
      perTypeMeasured: typeCounts, maxKernelWidthsFromLiveProfile: profiles ? profiles.map((p) => ({ typeIndex: p.index, frontZ: p.front.zM, rearZ: p.rear.zM, rearY: p.rear.yM, lengthM: p.front.zM - p.rear.zM })) : null, camera, source: a.renderState(), captureClockMs: performance.now(), settings: s.renderSettings(), glError: s.renderer.getContext().getError() };
  });
  const report = {};
  report.chase = await measure();
  await page.screenshot({ path: `${out}-chase.png` });
  const render = (cfg) => page.evaluate((cfg) => {
    const a = window.__skyriver; a.suspend();
    const s = a.scene; const c = s.camera; const st = a.renderState();
    const state = () => { c.updateMatrixWorld(true); return { position: c.position.toArray(), up: c.up.toArray(), quaternion: c.quaternion.toArray(), fov: c.fov, projection: c.projectionMatrix.toArray() }; };
    c.up.set(...cfg.up); c.fov = cfg.fov; c.updateProjectionMatrix();
    if (cfg.canyon) { const W = window.__skyriverDiag; const p = W.warpCanyon(cfg.canyon[0], cfg.canyon[1], { x: 0, z: 0, heading: 0 }); const q = W.warpCanyon(cfg.canyon[2], cfg.canyon[3], { x: 0, z: 0, heading: 0 }); c.position.set(p.x, cfg.canyon[4], p.z); c.lookAt(q.x, cfg.canyon[5], q.z); }
    else { c.position.set(...cfg.pos); c.lookAt(...cfg.at); }
    const expected = state();
    if (cfg.fog !== undefined) s.scene.fog.density = cfg.fog;
    if (!st) throw new Error('Render state is not ready.');
    s.update(st.current.tick, st.current, st.alpha);
    const afterUpdate = state();
    const passAudit = s.composer.passes.map((pass) => ({ type: pass.constructor.name, enabled: pass.enabled, renderToScreen: pass.renderToScreen,
      sameScene: pass.scene === s.scene, sameCamera: pass.camera === c, cameraName: pass.camera?.name ?? null, sceneName: pass.scene?.name ?? null }));
    s.renderer.info.reset(); s.composer.render(0);
    const afterRender = state();
    return { expected, afterUpdate, afterRender, passAudit, suspended: a.suspended };
  }, cfg);
  const cameraDelta = (a, b) => ({
    positionM: Math.hypot(...a.position.map((x, i) => x - b.position[i])),
    up: Math.hypot(...a.up.map((x, i) => x - b.up[i])),
    quaternion: Math.hypot(...a.quaternion.map((x, i) => x - b.quaternion[i])),
    fov: Math.abs(a.fov - b.fov),
    projection: Math.hypot(...a.projection.map((x, i) => x - b.projection[i])),
  });
  const screenshotCamera = () => page.evaluate(() => { const a = window.__skyriver, c = a.scene.camera; c.updateMatrixWorld(true); const V = c.position.constructor; return { position: c.position.toArray(), up: c.up.toArray(), quaternion: c.quaternion.toArray(), fov: c.fov, projection: c.projectionMatrix.toArray(), forward: new V(0, 0, -1).applyQuaternion(c.quaternion).toArray(), suspended: a.suspended }; });
  const recordView = async (name, cfg, filename) => {
    const renderState = await render(cfg);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${out}-${filename}.png` });
    const afterScreenshot = await screenshotCamera();
    const expected = renderState.expected;
    const checks = { afterUpdate: cameraDelta(expected, renderState.afterUpdate), afterRender: cameraDelta(expected, renderState.afterRender), afterScreenshot: cameraDelta(expected, afterScreenshot), suspendedThroughCapture: renderState.suspended && afterScreenshot.suspended };
    const pass = checks.suspendedThroughCapture && Object.entries(checks).filter(([key]) => key !== 'suspendedThroughCapture').every(([, d]) => d.positionM < 1e-5 && d.up < 1e-6 && d.quaternion < 1e-6 && d.fov < 1e-6 && d.projection < 1e-6);
    report.cameraProof ??= {};
    report.cameraProof[name] = { expected, afterUpdate: renderState.afterUpdate, afterRender: renderState.afterRender, afterScreenshot, passAudit: renderState.passAudit, checks, pass };
    return pass;
  };
  await recordView('topDownLoop', { pos: [600, 15000, -700], at: [600, 0, -699], up: [0, 0, 1], fov: 40, fog: 0.00002 }, 'top-down-loop');
  report.topDownLoop = await measure();
  await recordView('topDownNear', { pos: [-200, 2500, 900], at: [-200, 0, 901], up: [0, 0, 1], fov: 70, fog: 0.00012 }, 'top-down-near');
  report.topDownNear = await measure();
  await recordView('vanishingPoint', { canyon: [0, -400, 0, 1400, 1250, 1230], up: [0, 1, 0], fov: 62, fog: 0.00078 }, 'vanishing-point');
  report.vanishingPoint = await measure();
  await recordView('depthDeckCorridor', { canyon: [0, -400, 0, 1400, 1450, 1200], up: [0, 1, 0], fov: 62, fog: 0.00078 }, 'depth-deck-corridor');
  report.depthDeckCorridor = await measure();
  const ok = [report.chase, report.vanishingPoint, report.depthDeckCorridor].every((r) => Number.isInteger(r.measured) && r.measured > 0 && Number.isFinite(r.capCarLengths) && r.capCarLengths > 0 && Number.isFinite(r.maxTrailToCarRatio) && r.maxTrailToCarRatio <= r.capCarLengths * 1.02 + 1e-6 && Number.isFinite(r.endWidthShare) && r.endWidthShare > 0 && r.endWidthShare <= 0.6) && Object.values(report.cameraProof).every((r) => r.pass);
  report.pass = ok;
  report.logs = logs;
  fs.writeFileSync(`${out}-trails.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report));
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
