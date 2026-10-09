// Visible-pop and camera-clip detector (R15 vocabulary + R17 cameraInsideBuilding).
// In-page, every rendered frame of an autopilot run:
//   - hull instances (per mesh slot): blink = on-screen scale change > 50% of max with max > 0.6;
//     teleport = both scales > 0.6 and the slot moved > 60 px and > 25 m in one frame;
//   - light streaks: fadeJump = on-screen fade change > 0.35 in one frame; countChange = instance
//     count change of a hull mesh;
//   - cameraInsideBuilding (R17): the camera position, expanded by a 1.5 m near-plane margin, lies
//     inside any tower-batch box (instance matrices of skyriver.city.towers). Counted per frame.
//   - R19 impostor/light pops (screen-cell light-blob tracking): every rendered frame is read back
//     (readPixels right after the frame's draw), reduced to 4x4-CSS-px cells of max Rec.709 luma. A small
//     light blob (a cell >= HI with <= 8 bright cells in its 5x5 block, so signs and walls of light do
//     not count) is a lightPopIn when the previous frame had nothing >= LO within 3 cells (12 CSS px) of
//     it; lightPopOut is the mirror; lightFlicker = on -> off -> on at one spot over three frames.
//     HUD bands (top/bottom 10%, right 12%) and a left 10% band (screen entry while the camera yaws) are excluded. Events carry the tick for lap attribution.
// usage: node popdetect.cjs URL OUT.json [seconds] ; env TIER_TEST=1 pins medium@3s, low@7s, high@11s.
const { createRequire } = require('module');
const req = require;
const { chromium } = req(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const [url, out, secs] = [process.argv[2], process.argv[3], +(process.argv[4] || 50)];
(async () => {
  let browser;
  try {
  const proofDpr = +(process.env.PROOF_DPR || 1);
  if (![1, 1.25].includes(proofDpr)) throw new Error('PROOF_DPR must be 1 or 1.25');
  browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: proofDpr });
  const page = await context.newPage();
  const logs = []; page.on('console', m => { if (m.type() === 'error' || m.text().includes('gl adapter')) logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR '+e.message));
  await page.goto(url);
  await page.evaluate((e) => { window.__POP_LAYER = e.LAYER || ''; window.__POP_ONLY = e.ONLY || ''; window.__POP_DUMP = e.DUMP || ''; window.__POP_NOCARDS = e.NOCARDS || ''; }, { NOCARDS: process.env.NOCARDS, LAYER: process.env.LAYER, ONLY: process.env.ONLY, DUMP: process.env.DUMP });
  await page.waitForFunction(() => window.__skyriver && window.__skyriver.stats().firstFrameMs !== null, null, { timeout: 20000 });
  if (process.env.TIER_TEST) await page.evaluate(() => { const t = window.__skyriver.tiers; setTimeout(() => t.pin('medium'), 3000); setTimeout(() => t.pin('low'), 7000); setTimeout(() => t.pin('high'), 11000); });
  const result = await page.evaluate(async (secs) => {
    const a = window.__skyriver; const s = a.scene; const cam = s.camera;
    const hulls = []; let streak = null; let towers = null;
    s.scene.traverse((o) => {
      if (o.name && o.name.startsWith('skyriver.traffic.') && o.isInstancedMesh) hulls.push(o);
      if (o.name === 'skyriver.traffic.streaks') streak = o;
      if (o.name === 'skyriver.city.towers') towers = o;
    });
    // Tower boxes as inverse matrices (static city): local = M^-1 * p, unit box [-0.5, 0.5]^3.
    const M = towers.instanceMatrix.array; const n = towers.count;
    const inv = []; const sc = [];
    const Mat = cam.matrixWorld.constructor; const m = new Mat(); const im = new Mat();
    for (let i = 0; i < n; i += 1) {
      m.fromArray(M, i * 16); im.copy(m).invert(); inv.push(im.clone());
      sc.push([Math.hypot(M[i * 16], M[i * 16 + 1], M[i * 16 + 2]), Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6]), Math.hypot(M[i * 16 + 8], M[i * 16 + 9], M[i * 16 + 10])]);
    }
    const V = cam.position.constructor; const p = new V(); const q = new V();
    const MARGIN = 1.5;
    const inside = () => {
      let hit = -1;
      for (let i = 0; i < n && hit < 0; i += 1) {
        q.copy(cam.position).applyMatrix4(inv[i]);
        const [sx, sy, sz] = sc[i];
        if (Math.abs(q.x) * sx < sx * 0.5 + MARGIN && Math.abs(q.y) * sy < sy * 0.5 + MARGIN && Math.abs(q.z) * sz < sz * 0.5 + MARGIN) hit = i;
      }
      return hit;
    };
    const counts = { teleport: 0, blink: 0, fadeJump: 0, countChange: 0, cameraInsideBuilding: 0, frames: 0, lightPopIn: 0, lightPopOut: 0, lightFlicker: 0, readbacks: 0 };
    const HI = +(window.__POP_HI || 170); const LO = +(window.__POP_LO || 60); const C = 4; const R = 3;
    const gl = a.scene.renderer.getContext();
    const cssSize = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this; } };
    s.renderer.getSize(cssSize);
    let W = 0; let H = 0; let cssW = Math.max(1, cssSize.x); let cssH = Math.max(1, cssSize.y); let scaleX = 1; let scaleY = 1; let cellW = C; let cellH = C; let cw = Math.floor(cssW / C); let ch = Math.floor(cssH / C); let buf = null; let cells = null; let prevCells = null; let prev2 = null;
    const proj = (x, y, z) => { p.set(x, y, z).project(cam); return p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 ? [(p.x + 1) * cssW / 2, (1 - p.y) * cssH / 2] : null; };
    const lightEvents = [];
    const nbMax = (arr, cx, cy, r) => { let m = 0; for (let y = Math.max(0, cy - r); y <= Math.min(ch - 1, cy + r); y += 1) for (let x = Math.max(0, cx - r); x <= Math.min(cw - 1, cx + r); x += 1) { const v = arr[y * cw + x]; if (v > m) m = v; } return m; };
    const small = (arr, cx, cy) => { let n = 0; for (let y = Math.max(0, cy - 2); y <= Math.min(ch - 1, cy + 2); y += 1) for (let x = Math.max(0, cx - 2); x <= Math.min(cw - 1, cx + 2); x += 1) if (arr[y * cw + x] >= HI) n += 1; return n <= 8; };
    const isPeak = (arr, cx, cy) => { const v = arr[cy * cw + cx]; for (let y = Math.max(0, cy - 1); y <= Math.min(ch - 1, cy + 1); y += 1) for (let x = Math.max(0, cx - 1); x <= Math.min(cw - 1, cx + 1); x += 1) { const u = arr[y * cw + x]; if (u > v || (u === v && y * cw + x < cy * cw + cx)) return false; } return true; };
    // Camera-motion compensation: a pixel's ray, taken to MC_DEPTH metres, re-projected into the other
    // frame's camera. Exact for rotation, within ~3 px of parallax for lights beyond ~450 m.
    const MC_DEPTH = 1500; const V3m = cam.position.constructor; const mv = new V3m();
    let vpPrev = null; let invVPPrev = null; let camPrevPos = null; let vpCur = null; let invVPCur = null;
    const remap = (cx, cy, fromInv, fromPos, toVP) => {
      if (!fromInv) return [cx, cy];
      const nx = ((cx + 0.5) * C) / cssW * 2 - 1; const ny = 1 - ((cy + 0.5) * C) / cssH * 2; // cy is top-down here
      mv.set(nx, ny, 0.5).applyMatrix4(fromInv).sub(fromPos).normalize().multiplyScalar(MC_DEPTH).add(fromPos).applyMatrix4(toVP);
      return [Math.round(((mv.x + 1) / 2 * cssW) / C - 0.5), Math.round(((1 - mv.y) / 2 * cssH) / C - 0.5)];
    };
    const analyze = (tick) => {
      cam.updateMatrixWorld(); vpCur = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse); invVPCur = vpCur.clone().invert(); const camCurPos = cam.position.clone();
      s.renderer.getSize(cssSize);
      const nextW = Math.max(1, cssSize.x); const nextH = Math.max(1, cssSize.y);
      if (gl.drawingBufferWidth !== W || gl.drawingBufferHeight !== H || nextW !== cssW || nextH !== cssH) { W = gl.drawingBufferWidth; H = gl.drawingBufferHeight; cssW = nextW; cssH = nextH; scaleX = W / cssW; scaleY = H / cssH; cellW = C * scaleX; cellH = C * scaleY; cw = Math.floor(cssW / C); ch = Math.floor(cssH / C); buf = new Uint8Array(W * H * 4); prevCells = null; prev2 = null; }
      if (window.__POP_DUMP) { if (!window.__prevBuf || window.__prevBuf.length !== buf.length) window.__prevBuf = new Uint8Array(buf.length); window.__prevBuf.set(buf); }
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      counts.readbacks += 1;
      cells = new Uint8Array(cw * ch);
      for (let y = 0; y < H; y += 1) { const cy = ch - 1 - Math.min(ch - 1, Math.floor(y / cellH)); const row = y * W * 4; for (let x = 0; x < W; x += 1) { const o = row + x * 4; const l = (0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2]) | 0; const ci = cy * cw + Math.min(cw - 1, Math.floor(x / cellW)); if (l > cells[ci]) cells[ci] = l; } }
      const y0 = Math.floor(ch * 0.1); const y1 = Math.ceil(ch * 0.9); const x1 = Math.floor(cw * 0.88);
      if (prevCells) {
        for (let cy = y0; cy < y1; cy += 1) for (let cx = Math.ceil(cw * 0.1); cx < x1; cx += 1) {
          const i = cy * cw + cx;
          if (cells[i] >= HI && isPeak(cells, cx, cy) && small(cells, cx, cy) && (() => { const [px2, py2] = remap(cx, cy, invVPCur, camCurPos, vpPrev ?? vpCur); return nbMax(prevCells, px2, py2, R) < LO; })()) {
            counts.lightPopIn += 1; if (lightEvents.length < 3000) lightEvents.push({ tick, type: 'lightPopIn', px: [cx * C, cy * C], v: cells[i] });
            if (prev2 && nbMax(prev2, cx, cy, R) >= HI) { counts.lightFlicker += 1; if (lightEvents.length < 3000) lightEvents.push({ tick, type: 'lightFlicker', px: [cx * C, cy * C], v: cells[i] }); }
          }
          if (prevCells[i] >= HI && isPeak(prevCells, cx, cy) && small(prevCells, cx, cy) && (() => { const [px2, py2] = remap(cx, cy, invVPPrev, camPrevPos, vpCur); return nbMax(cells, px2, py2, R) < LO; })()) { counts.lightPopOut += 1; if (lightEvents.length < 3000) lightEvents.push({ tick, type: 'lightPopOut', px: [cx * C, cy * C], v: prevCells[i] }); }
        }
      }
      prev2 = prevCells; prevCells = cells;
      vpPrev = vpCur; invVPPrev = invVPCur; camPrevPos = camCurPos;
      if (window.__POP_LAYER === 'traffic' && lightEvents.length > attributed) attribute();
      prevCam = [cam.position.x, cam.position.y, cam.position.z]; prevT = impMesh.material.uniforms.uTime.value; prevVP = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
    };
    // Attribution: for each new event pixel, the nearest projected light source within 10 CSS px — an
    // impostor (CPU mirror at the shader's uTime) or a CPU streak lamp — with its camera distance and
    // class (stream / lane / ring / free / cpu). Prev-frame events (popOut) use this frame's sources.
    let attributed = 0;
    const D = window.__skyriverDiag; const impMesh = s.scene.getObjectByName('skyriver.traffic.impostors');
    let attrs = null; const ip = { x: 0, y: 0, z: 0, dx: 0, dz: 0 }; const V3 = cam.position.constructor; const pv = new V3();
    const segOccluded = (ax, ay, az, bx, by, bz) => {
      // Segment camera->source against every tower box (unit box in instance space), 2 m short of the source.
      const L = Math.hypot(bx - ax, by - ay, bz - az); const k = Math.max(0, (L - 2) / L);
      bx = ax + (bx - ax) * k; by = ay + (by - ay) * k; bz = az + (bz - az) * k;
      for (let i = 0; i < n; i += 1) {
        const e = inv[i].elements;
        const p0x = e[0] * ax + e[4] * ay + e[8] * az + e[12], p0y = e[1] * ax + e[5] * ay + e[9] * az + e[13], p0z = e[2] * ax + e[6] * ay + e[10] * az + e[14];
        const p1x = e[0] * bx + e[4] * by + e[8] * bz + e[12], p1y = e[1] * bx + e[5] * by + e[9] * bz + e[13], p1z = e[2] * bx + e[6] * by + e[10] * bz + e[14];
        let t0 = 0, t1 = 1; let ok = true;
        for (const [o, d] of [[p0x, p1x - p0x], [p0y, p1y - p0y], [p0z, p1z - p0z]]) {
          if (Math.abs(d) < 1e-9) { if (o < -0.5 || o > 0.5) { ok = false; break; } continue; }
          let u0 = (-0.5 - o) / d, u1 = (0.5 - o) / d; if (u0 > u1) { const tt = u0; u0 = u1; u1 = tt; }
          t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) { ok = false; break; }
        }
        if (ok) return true;
      }
      return false;
    };
    let prevCam = null; let prevT = 0; let prevVP = null;
    const attribute = () => {
      const n = impMesh.geometry.instanceCount; const t = impMesh.material.uniforms.uTime.value;
      if (!attrs || attrs.count < n) attrs = D.deriveImpostorAttributes(424242, Math.max(n, 1));
      const src = [];
      const useImp = !only || only.has('skyriver.traffic.impostors'); const useCpu = !only || only.has('skyriver.traffic.streaks');
      if (useImp) for (let i = 0; i < n; i += 1) { D.impostorPosition(attrs, i, t, ip); pv.set(ip.x, ip.y, ip.z).project(cam); if (pv.z < 1 && Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05) { const k = (attrs.pathArcPhaseSeed || attrs.streamArcPhaseSeed)[i * 4]; src.push([(pv.x + 1) * cssW / 2, (pv.y + 1) * cssH / 2, Math.hypot(ip.x - cam.position.x, ip.y - cam.position.y, ip.z - cam.position.z), k < 8 ? 'stream' : k < 14 ? 'lane' : k < 20 ? 'ring' : 'free', i, ip.x, ip.y, ip.z]); } }
      const g = streak.geometry; const P = g.getAttribute('aCarPos').array; const L = g.getAttribute('aCarLod')?.array;
      if (useCpu) for (let i = 0; i < g.instanceCount; i += 1) { pv.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).project(cam); if (pv.z < 1 && Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05) src.push([(pv.x + 1) * cssW / 2, (pv.y + 1) * cssH / 2, Math.hypot(P[i * 3] - cam.position.x, P[i * 3 + 1] - cam.position.y, P[i * 3 + 2] - cam.position.z), L && L[i * 3 + 1] > 0.001 ? 'same_car_impostor' : 'cpu', -1, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); }
      for (; attributed < lightEvents.length; attributed += 1) {
        const e = lightEvents[attributed]; const ex = e.px[0] + C / 2; const ey = cssH - e.px[1] - C / 2;
        let best = null; let bd = 100;
        for (const q of src) { const d2 = (q[0] - ex) ** 2 + (q[1] - ey) ** 2; if (d2 < bd) { bd = d2; best = q; } }
        if (best) {
          e.dist = Math.round(best[2]); e.cls = best[3];
          if (window.__POP_DUMP && e.type === 'lightPopIn' && e.dist > 450 && e.dist < 1300 && (window.__dumps ??= []).length < +window.__POP_DUMP) {
            const centreBuffer = [(e.px[0] + C / 2) * scaleX, H - (e.px[1] + C / 2) * scaleY];
            const crop = (b) => { const out = []; for (let y = 0; y < 48; y += 1) for (let x = 0; x < 48; x += 1) { const px = Math.min(W - 1, Math.max(0, Math.round(centreBuffer[0] - 24 + x))); const py = Math.min(H - 1, Math.max(0, Math.round(centreBuffer[1] + 23 - y))); const o = (py * W + px) * 4; out.push(b[o], b[o + 1], b[o + 2]); } return out; };
            window.__dumps.push({ e: { ...e }, cropSpace: '48x48 drawing-buffer pixels', centreBufferPx: centreBuffer, prev: crop(window.__prevBuf), cur: crop(buf) });
          }
          // Occlusion reveal / hide: popIn whose source was behind a tower last frame, popOut whose
          // source is behind one now. Those are correct occlusion, not pops.
          if (best[4] >= 0 && prevVP) { D.impostorPosition(attrs, best[4], prevT, ip); const q = new V3(ip.x, ip.y, ip.z).applyMatrix4(prevVP); e.idx = best[4]; e.prevPx = [Math.round((q.x + 1) * cssW / 2), Math.round((1 - q.y) * cssH / 2)]; e.prevDist = Math.round(Math.hypot(ip.x - prevCam[0], ip.y - prevCam[1], ip.z - prevCam[2])); e.curPxTop = [Math.round(best[0]), Math.round(cssH - best[1])]; e.t = [prevT, impMesh.material.uniforms.uTime.value]; e.prevLumaAtSrc = e.type === 'lightPopIn' && prev2 ? nbMax(prev2, Math.round(e.prevPx[0] / C), Math.round(e.prevPx[1] / C), 1) : null; }
          if (e.type === 'lightPopOut') e.occluded = segOccluded(cam.position.x, cam.position.y, cam.position.z, best[5], best[6], best[7]);
          else if (prevCam) { let q = [best[5], best[6], best[7]]; if (best[4] >= 0) { D.impostorPosition(attrs, best[4], prevT, ip); q = [ip.x, ip.y, ip.z]; } e.occluded = segOccluded(prevCam[0], prevCam[1], prevCam[2], q[0], q[1], q[2]); }
        } else e.cls = 'none';
      }
    };
    const origUpdate = a.scene.update;
    // LAYER=traffic: after the real frame, re-render only the traffic lights (CPU streaks + GPU
    // impostors) with the opaque city as occluders (towers, far-city cards, hulls), sky/signs/trims/
    // beams/rain/shuttle hidden, and track blobs on that layer. Isolates traffic-light pops.
    const keep = new Set([...(window.__POP_NOCARDS ? [] : ['skyriver.city.impostors']), 'skyriver.city.towers', 'skyriver.traffic.streaks', 'skyriver.traffic.impostors', 'skyriver.traffic.cab', 'skyriver.traffic.interceptor', 'skyriver.traffic.commuter', 'skyriver.traffic.van', 'skyriver.traffic.saucer', 'skyriver.traffic.bus', 'skyriver.traffic.flatbed']);
    const only = window.__POP_ONLY ? new Set(window.__POP_ONLY.split(',')) : null;
    const layerRender = () => {
      const hidden = [];
      s.scene.traverse((o) => { if (o.isMesh && o.visible && !keep.has(o.name)) { o.visible = false; hidden.push(o); } if (o.isMesh && o.visible && only && o.name.startsWith('skyriver.traffic.') && !only.has(o.name)) { o.visible = false; hidden.push(o); } });
      const bg = s.scene.background; s.scene.background = null;
      // Occluders draw depth only: their windows/light patches would add their own sparkle.
      const masked = [];
      s.scene.traverse((o) => { if (o.isMesh && o.visible && !(o.name === 'skyriver.traffic.streaks' || o.name === 'skyriver.traffic.impostors') && o.material.colorWrite !== false) { o.material.colorWrite = false; masked.push(o.material); } });
      s.composer.render(0);
      for (const m of masked) m.colorWrite = true;
      for (const o of hidden) o.visible = true; s.scene.background = bg;
    };
    a.scene.update = function (tick, proj, alpha) { origUpdate.call(this, tick, proj, alpha); if (window.__POP_LAYER === 'traffic') layerRender(); if (!window.__POP_NO_LIGHT) analyze(tick); };
    const events = [];
    let prev = null;
    const end = performance.now() + secs * 1000;
    await new Promise((done) => {
      const frame = () => {
        const tick = a.stats().tick;
        const cur = hulls.map((h) => ({ count: h.count, arr: h.instanceMatrix.array.slice(0, h.count * 16) }));
        const FS = streak.geometry.getAttribute('aCarFade').itemSize;
        const fadeArr = streak.geometry.getAttribute('aCarFade').array.slice(0, streak.geometry.instanceCount * FS);
        const posArr = streak.geometry.getAttribute('aCarPos').array.slice(0, streak.geometry.instanceCount * 3);
        counts.frames += 1;
        const hit = inside();
        if (hit >= 0) { counts.cameraInsideBuilding += 1; if (events.length < 400) events.push({ tick, type: 'cameraInsideBuilding', box: hit, cam: [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(1)) }); }
        if (prev) {
          for (let mi = 0; mi < hulls.length; mi += 1) {
            const P = prev.m[mi]; const C = cur[mi];
            if (P.count !== C.count) { counts.countChange += 1; events.push({ tick, type: 'countChange', mesh: hulls[mi].name, from: P.count, to: C.count }); }
            const k = Math.min(P.count, C.count);
            for (let i = 0; i < k; i += 1) {
              const o = i * 16;
              const sa = Math.hypot(P.arr[o], P.arr[o + 1], P.arr[o + 2]); const sb = Math.hypot(C.arr[o], C.arr[o + 1], C.arr[o + 2]);
              const mx = Math.max(sa, sb); if (mx < 0.6) continue;
              const pa = proj(P.arr[o + 12], P.arr[o + 13], P.arr[o + 14]); const pb = proj(C.arr[o + 12], C.arr[o + 13], C.arr[o + 14]);
              if (!pa && !pb) continue;
              if (Math.abs(sa - sb) > 0.5 * mx) { counts.blink += 1; if (events.length < 400) events.push({ tick, type: 'blink', mesh: hulls[mi].name, i }); continue; }
              if (sa > 0.6 && sb > 0.6 && pa && pb) {
                const dpx = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
                const dm = Math.hypot(P.arr[o + 12] - C.arr[o + 12], P.arr[o + 13] - C.arr[o + 13], P.arr[o + 14] - C.arr[o + 14]);
                if (dpx > 60 && dm > 25) { counts.teleport += 1; if (events.length < 400) events.push({ tick, type: 'teleport', mesh: hulls[mi].name, i, dpx: +dpx.toFixed(0), dm: +dm.toFixed(0) }); }
              }
            }
          }
          const nf = Math.min(prev.f.length, fadeArr.length) / FS;
          for (let i = 0; i < nf; i += 1) {
            const dj = Math.abs(fadeArr[i * FS] - prev.f[i * FS]);
            if (dj > 0.35 && proj(posArr[i * 3], posArr[i * 3 + 1], posArr[i * 3 + 2])) { counts.fadeJump += 1; if (events.length < 400) events.push({ tick, type: 'fadeJump', i }); }
          }
        }
        prev = { m: cur, f: fadeArr };
        if (performance.now() < end) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
    a.scene.update = origUpdate;
    const impostorEvents = lightEvents.filter(e => ['stream','lane','ring','free','same_car_impostor'].includes(e.cls) && e.occluded === false).map(e => ({...e, eventClass: 'impostorPop'}));
    counts.impostorPop = window.__POP_LAYER === 'traffic' ? impostorEvents.length : null;
    return { counts, impostorAttributionEnabled: window.__POP_LAYER === 'traffic', events, lightEvents, impostorEvents, endTick: a.stats().tick, towers: n, dumps: window.__dumps || [] };
  }, secs);
  result.display = await page.evaluate(() => {
    const a = window.__skyriver; const r = a.scene.renderer; const gl = r.getContext();
    const size = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this; } };
    r.getSize(size);
    return { devicePixelRatio: window.devicePixelRatio, rendererPixelRatio: r.getPixelRatio(), cssSize: [size.x, size.y], drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], maxPixelRatio: a.scene.renderSettings().maxPixelRatio };
  });
  result.settings = { cellUnit: 'CSS px', eventCoordinateUnit: 'CSS px', sourceCoordinateUnit: 'CSS px', previousSourceCoordinateUnit: 'CSS px', cellCssPx: 4, neighborRadiusCells: 3, searchRadiusCssPx: 12, attributionRadiusCssPx: 10, HI: 170, LO: 60 };
  result.logs = logs; result.adapter = logs.find(x => x.includes('gl adapter')); fs.writeFileSync(out, JSON.stringify(result, null, 1));
  const ticks = result.events.filter((e) => e.type === 'cameraInsideBuilding').map((e) => e.tick);
  console.log(JSON.stringify(result.counts), 'insideTicks', ticks.length ? `${Math.min(...ticks)}..${Math.max(...ticks)} (${[...new Set(ticks.map((t) => (t / 30).toFixed(1)))].join(',')}s)` : 'none');
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
