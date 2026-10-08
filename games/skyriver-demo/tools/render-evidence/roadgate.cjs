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
  const measure = () => page.evaluate(() => {
    const a = window.__skyriver; const s = a.scene; const c = s.camera; c.updateMatrixWorld(true);
    let streak = null; s.scene.traverse((o) => { if (o.name === 'skyriver.traffic.streaks') streak = o; });
    const g = streak.geometry; const u = streak.material.uniforms;
    const pos = g.getAttribute('aCarPos').array; const dir = g.getAttribute('aCarDir').array; const fade = g.getAttribute('aCarFade').array;
    const FS = g.getAttribute('aCarFade').itemSize; const n = g.instanceCount;
    const V = c.position.constructor; const A = new V(); const B = new V(); const P = new V(); const Q = new V();
    const carLen = u.uHeadOffset.value + u.uTailOffset.value;
    const px = (p) => { const q = p.clone().project(c); return [(q.x + 1) * 640, (1 - q.y) * 360, q.z]; };
    let maxRatio = 0; let maxTrailPx = 0; let measured = 0; let maxEndShare = 0;
    for (let i = 0; i < n; i += 1) {
      const w = FS > 3 ? fade[i * FS + 3] : 0; if (w <= 0.001 || fade[i * FS] < 0.05) continue;
      const scale = fade[i * FS + 1]; const speed = dir[i * 4 + 3];
      const d = new V(dir[i * 4], dir[i * 4 + 1], dir[i * 4 + 2]);
      let trail = Math.min(speed * u.uTrailSeconds.value, Math.min(u.uTrailMax.value, (u.uTrailCarLengths ? u.uTrailCarLengths.value : 1e9) * carLen * scale));
      A.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).addScaledVector(d, -u.uTailOffset.value * scale);
      B.copy(A).addScaledVector(d, -trail);
      if (u.uTrailCarLengths) {
        // Mirror of the shader's on-screen cap (two refinement steps in view space).
        const vm = c.matrixWorldInverse; const view = (p) => p.clone().applyMatrix4(vm);
        const ch = view(new V(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).addScaledVector(d, u.uHeadOffset.value * scale));
        const ct = view(new V(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).addScaledVector(d, -u.uTailOffset.value * scale));
        const sc = (v) => [v.x / Math.max(-v.z, 1), v.y / Math.max(-v.z, 1)];
        const carS = Math.hypot(sc(ch)[0] - sc(ct)[0], sc(ch)[1] - sc(ct)[1]);
        const v0 = view(A);
        for (let k = 0; k < 2; k += 1) {
          const v1 = view(B);
          const tS = Math.hypot(sc(v0)[0] - sc(v1)[0], sc(v0)[1] - sc(v1)[1]);
          const lim = u.uTrailCarLengths.value * carS;
          if (tS > lim && tS > 0) { trail *= lim / tS; B.copy(A).addScaledVector(d, -trail); }
        }
      }
      P.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).addScaledVector(d, u.uHeadOffset.value * scale);
      Q.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).addScaledVector(d, -u.uTailOffset.value * scale);
      const a0 = px(A); const b0 = px(B); const p0 = px(P); const q0 = px(Q);
      if (a0[2] > 1 || b0[2] > 1 || a0[2] < -1) continue;
      if (Math.abs(a0[0] - 640) > 700 || Math.abs(a0[1] - 360) > 400) continue;
      const tpx = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]);
      const cpx = Math.hypot(p0[0] - q0[0], p0[1] - q0[1]);
      maxTrailPx = Math.max(maxTrailPx, tpx);
      if (cpx > 2) { maxRatio = Math.max(maxRatio, tpx / cpx); measured += 1; }
    }
    maxEndShare = u.uTrailEndWidth ? u.uTrailEndWidth.value : 1;
    return { measured, maxTrailPx: +maxTrailPx.toFixed(1), maxTrailToCarRatio: +maxRatio.toFixed(2), endWidthShare: maxEndShare, capCarLengths: u.uTrailCarLengths ? u.uTrailCarLengths.value : null };
  });
  const report = {};
  report.chase = await measure();
  await page.screenshot({ path: `${out}-chase.png` });
  const render = (cfg) => page.evaluate((cfg) => {
    const a = window.__skyriver; a.suspend();
    const s = a.scene; const c = s.camera; const st = a.renderState();
    c.up.set(...cfg.up); c.fov = cfg.fov; c.updateProjectionMatrix();
    if (cfg.canyon) { const W = window.__skyriverDiag; const p = W.warpCanyon(cfg.canyon[0], cfg.canyon[1], { x: 0, z: 0, heading: 0 }); const q = W.warpCanyon(cfg.canyon[2], cfg.canyon[3], { x: 0, z: 0, heading: 0 }); c.position.set(p.x, cfg.canyon[4], p.z); c.lookAt(q.x, cfg.canyon[5], q.z); }
    else { c.position.set(...cfg.pos); c.lookAt(...cfg.at); }
    c.updateMatrixWorld(true);
    if (cfg.fog !== undefined) s.scene.fog.density = cfg.fog;
    a.traffic.update({ tick: st.current.tick, alpha: st.alpha }, c.position);
    s.renderer.info.reset(); s.composer.render(0);
  }, cfg);
  await render({ pos: [600, 15000, -700], at: [600, 0, -699], up: [0, 0, 1], fov: 40, fog: 0.00002 });
  await page.screenshot({ path: `${out}-top-down-loop.png` });
  await render({ pos: [-200, 2500, 900], at: [-200, 0, 901], up: [0, 0, 1], fov: 70, fog: 0.00012 });
  await page.screenshot({ path: `${out}-top-down-near.png` });
  await render({ canyon: [0, -400, 0, 1400, 1250, 1230], up: [0, 1, 0], fov: 62, fog: 0.00078 });
  report.vanishingPoint = await measure();
  await page.screenshot({ path: `${out}-vanishing-point.png` });
  const ok = [report.chase, report.vanishingPoint].every((r) => Number.isInteger(r.measured) && r.measured > 0 && Number.isFinite(r.capCarLengths) && r.capCarLengths > 0 && Number.isFinite(r.maxTrailToCarRatio) && r.maxTrailToCarRatio <= r.capCarLengths * 1.02 + 1e-6 && Number.isFinite(r.endWidthShare) && r.endWidthShare > 0 && r.endWidthShare <= 0.6);
  report.pass = ok;
  report.logs = logs;
  fs.writeFileSync(`${out}-trails.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report));
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
