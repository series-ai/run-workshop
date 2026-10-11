'use strict';

// Impostor sequence capture tool (R42 verification method).
// Captures sampled frames with a single scene.update and composer render per frame.
// Records raw PNG frames, gzipped tracking checkpoints, lamp centers, and interior uniforms.
// Does not certify pop-free sequences from counts.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const R = require('./experiment-runtime.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const VALID_CASES = ['ring', 'tier', 'seam', 'approach', 'lane'];
const VALID_DPRS = [1, 1.25];
const VALID_TIERS = ['high', 'medium', 'low'];

function validateBoundaryInputs(args, env) {
  const [url, out, caseName, dprArg] = args;

  if (!url || typeof url !== 'string') {
    throw new Error('URL must be specified.');
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL: ' + url);
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('URL protocol must be http: or https:');
  }

  if (!out || typeof out !== 'string') {
    throw new Error('Output path must be specified.');
  }
  const resolvedOut = path.resolve(out);
  if (fs.existsSync(resolvedOut) && fs.readdirSync(resolvedOut).length > 0) {
    throw new Error('Output directory must be new or empty: ' + resolvedOut);
  }

  if (!caseName || !VALID_CASES.includes(caseName)) {
    throw new Error('Invalid caseName: ' + caseName + '. Must be one of: ' + VALID_CASES.join(', '));
  }

  const dpr = Number(dprArg || 1.25);
  if (!VALID_DPRS.includes(dpr)) {
    throw new Error('Invalid DPR: ' + dpr + '. Must be one of: ' + VALID_DPRS.join(', '));
  }

  let expectedSeed = null;
  if (env.R42_SEED !== undefined && env.R42_SEED !== '') {
    expectedSeed = Number(env.R42_SEED);
    if (!Number.isInteger(expectedSeed) || expectedSeed < 0 || expectedSeed > 0xffffffff) {
      throw new Error('R42_SEED must be an unsigned 32-bit integer.');
    }
  }

  let expectedCount = null;
  if (env.R42_COUNT !== undefined && env.R42_COUNT !== '') {
    expectedCount = Number(env.R42_COUNT);
    if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0) {
      throw new Error('R42_COUNT must be a positive integer.');
    }
  }

  let onlyGpuCar = null;
  if (env.R42_ONLY_GPU_CAR !== undefined && env.R42_ONLY_GPU_CAR !== '') {
    onlyGpuCar = Number(env.R42_ONLY_GPU_CAR);
    if (!Number.isSafeInteger(onlyGpuCar) || onlyGpuCar < 0) {
      throw new Error('R42_ONLY_GPU_CAR must be a non-negative integer.');
    }
  }

  let cameraOverride = null;
  if (env.R42_CAMERA) {
    try {
      cameraOverride = JSON.parse(env.R42_CAMERA);
    } catch {
      throw new Error('R42_CAMERA must be valid JSON.');
    }
    if (typeof cameraOverride !== 'object' || cameraOverride === null) {
      throw new Error('R42_CAMERA must be an object.');
    }
    const { position, quaternion, fov } = cameraOverride;
    if (!Array.isArray(position) || position.length !== 3 || position.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new Error('Camera override position must be an array of 3 finite numbers.');
    }
    if (!Array.isArray(quaternion) || quaternion.length !== 4 || quaternion.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new Error('Camera override quaternion must be an array of 4 finite numbers.');
    }
    const qLenSq = quaternion.reduce((sum, v) => sum + v * v, 0);
    if (Math.abs(qLenSq - 1.0) > 0.02) {
      throw new Error('Camera override quaternion must be normalized.');
    }
    if (typeof fov !== 'number' || !Number.isFinite(fov) || fov <= 0 || fov >= 180) {
      throw new Error('Camera override fov must be a finite positive number less than 180.');
    }
  }

  let tierSchedule = [
    { frame: 30, tier: 'low' },
    { frame: 55, tier: 'medium' },
    { frame: 80, tier: 'high' }
  ];
  if (env.R42_TIER_SCHEDULE) {
    try {
      tierSchedule = JSON.parse(env.R42_TIER_SCHEDULE);
    } catch {
      throw new Error('R42_TIER_SCHEDULE must be valid JSON.');
    }
  }
  if (!Array.isArray(tierSchedule)) {
    throw new Error('tierSchedule must be an array.');
  }
  const seenFrames = new Set();
  let prevFrame = -1;
  for (const entry of tierSchedule) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('tierSchedule entry must be an object.');
    }
    if (!Number.isInteger(entry.frame) || entry.frame < 0 || entry.frame > 179) {
      throw new Error('tierSchedule frame must be an integer between 0 and 179: got ' + entry.frame);
    }
    if (seenFrames.has(entry.frame)) {
      throw new Error('tierSchedule frame must be unique: ' + entry.frame);
    }
    seenFrames.add(entry.frame);
    if (entry.frame < prevFrame) {
      throw new Error('tierSchedule must be sorted by frame in ascending order.');
    }
    prevFrame = entry.frame;
    if (!VALID_TIERS.includes(entry.tier)) {
      throw new Error('Invalid tier in tierSchedule: ' + entry.tier);
    }
  }

  const preserveFadeEnv = env.R42_PRESERVE_FADE;
  if (preserveFadeEnv !== undefined && preserveFadeEnv !== '' && !['0', '1', 'true', 'false'].includes(preserveFadeEnv)) {
    throw new Error('R42_PRESERVE_FADE must be a valid boolean flag (0, 1, true, false).');
  }
  const preserveFade = preserveFadeEnv === '1' || preserveFadeEnv === 'true';

  const blankSourceEnv = env.R42_BLANK;
  if (blankSourceEnv !== undefined && blankSourceEnv !== '' && !['0', '1', 'true', 'false'].includes(blankSourceEnv)) {
    throw new Error('R42_BLANK must be a valid boolean flag (0, 1, true, false).');
  }
  const blankSource = blankSourceEnv === '1' || blankSourceEnv === 'true';

  return {
    url,
    out: resolvedOut,
    caseName,
    dpr,
    expectedSeed,
    expectedCount,
    onlyGpuCar,
    cameraOverride,
    tierSchedule,
    preserveFade,
    blankSource
  };
}

(async () => {
  const config = validateBoundaryInputs(process.argv.slice(2), process.env);
  const { url, out, caseName, dpr, expectedSeed, expectedCount, onlyGpuCar, cameraOverride, tierSchedule, preserveFade, blankSource } = config;

  let unlock;
  let browser;
  let page;
  const frames = [];
  const errors = [];

  try {
    unlock = R.gpuLock('R42 impostor sequence');
    fs.mkdirSync(path.join(out, 'frames'), { recursive: true });

    browser = await chromium.launch({
      headless: true,
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: dpr
    });

    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });

    const epoch = new Date('2026-10-07T00:00:00Z');
    await page.clock.install({ time: epoch });
    await page.clock.pauseAt(epoch);
    await page.goto(url);

    for (let i = 0; i < 100 && !await page.evaluate(() => window.__skyriver?.stats().firstFrameMs != null); i++) {
      await page.clock.runFor(100);
    }

    const setup = await page.evaluate(({ caseName, dpr, onlyGpuCar, cameraOverride, tierSchedule, preserveFade, blankSource, expectedSeed, expectedCount }) => {
      const a = window.__skyriver;
      if (!a) throw new Error('App absent');
      a.suspend();
      a.scene.renderer.setPixelRatio(dpr);
      a.scene.resize(1280, 720);

      const s = a.scene;
      const c = s.camera;
      const D = window.__skyriverDiag;
      const imp = s.scene.getObjectByName('skyriver.traffic.impostors');

      c.up.set(0, 1, 0);
      c.fov = 62;
      c.updateProjectionMatrix();

      if (caseName === 'lane') {
        c.up.set(0, 0, 1);
        c.position.set(-286.79531181324506, 4192.756045387566, -1242.8593109860267);
        c.lookAt(-286.79531181324506, 2692.756045387566, -1242.8593109860267);
      }
      if (caseName === 'ring') {
        c.position.set(500, 6600, -1000);
        c.lookAt(0, 10300, 500);
      }
      if (caseName === 'seam') {
        const w = D.warpCanyon(0, 0, { x: 0, z: 0, heading: 0 });
        const p = D.warpCanyon(0, 900, { x: 0, z: 0, heading: 0 });
        c.position.set(w.x, 1100, w.z);
        c.lookAt(p.x, 1100, p.z);
      }
      if (caseName === 'approach') {
        c.position.set(0, 1500, 0);
        c.lookAt(0, 1500, 1300);
      }
      if (cameraOverride) {
        c.position.fromArray(cameraOverride.position);
        c.quaternion.fromArray(cameraOverride.quaternion);
        c.fov = cameraOverride.fov;
        c.updateProjectionMatrix();
      }
      c.updateMatrixWorld(true);

      const loadedSeed = a.session?.seed;
      if (!Number.isInteger(loadedSeed) || loadedSeed < 0 || loadedSeed > 0xffffffff) {
        throw new Error('Valid application session.seed is required.');
      }
      const aImpAttr = imp?.geometry?.getAttribute('aImp');
      if (!aImpAttr || !Number.isInteger(aImpAttr.count) || aImpAttr.count <= 0) {
        throw new Error('Valid aImp attribute with positive count is required.');
      }
      const loadedPopulation = aImpAttr.count;

      if (expectedSeed !== null && loadedSeed !== expectedSeed) {
        throw new Error('Seed mismatch: requested ' + expectedSeed + ', loaded ' + loadedSeed);
      }
      if (expectedCount !== null && (!Number.isSafeInteger(expectedCount) || loadedPopulation !== expectedCount)) {
        throw new Error('Population mismatch: requested ' + expectedCount + ', loaded ' + loadedPopulation);
      }

      if (onlyGpuCar !== null) {
        if (!Number.isSafeInteger(onlyGpuCar) || onlyGpuCar < 0 || onlyGpuCar >= loadedPopulation) {
          throw new Error('Selected onlyGpuCar out of bounds: ' + onlyGpuCar + ' >= ' + loadedPopulation);
        }
        window.__r42OriginalTrafficUpdate = a.traffic.update;
        window.__r42 = window.__r42 || {};
        window.__r42.originalTrafficUpdate = a.traffic.update;
        const original = a.traffic.update;
        a.traffic.update = function (...args) {
          original.apply(this, args);
          for (const object of a.traffic.objects) {
            if (object !== imp) object.visible = false;
          }
          const fade = imp.geometry.getAttribute('aFromAlpha');
          const u = imp.material.uniforms;
          const saved = {
            array: fade.array.slice(),
            count: imp.geometry.instanceCount,
            visible: imp.visible,
            target: u.uTargetCount.value,
            k: u.uFadeK.value
          };
          const alpha = preserveFade
            ? saved.array[onlyGpuCar] * (1 - saved.k) + (onlyGpuCar < saved.target ? 1 : 0) * saved.k
            : 1;
          window.__r42.liveTierState = {
            targetCount: saved.target,
            fadeK: saved.k,
            impostorCount: saved.count,
            selectedPresence: alpha
          };
          const restore = () => {
            fade.array.set(saved.array);
            fade.needsUpdate = true;
            imp.geometry.instanceCount = saved.count;
            imp.visible = saved.visible;
            u.uTargetCount.value = saved.target;
            u.uFadeK.value = saved.k;
          };
          window.__r42.restoreGpu = restore;
          let mutated = false;
          try {
            mutated = true;
            fade.array.fill(0);
            fade.array[onlyGpuCar] = blankSource ? 0 : alpha;
            fade.needsUpdate = true;
            imp.geometry.instanceCount = onlyGpuCar + 1;
            imp.visible = true;
            u.uTargetCount.value = 0;
            u.uFadeK.value = 0;
          } catch (error) {
            if (mutated) {
              restore();
              window.__r42.restoreGpu = null;
            }
            throw error;
          }
        };
      }

      const attr = D.deriveImpostorAttributes(loadedSeed, loadedPopulation);
      for (const [name, key, expectedItemSize] of [
        ['aImp', 'pathArcPhaseSeed', 4],
        ['aFlow', 'flow', 4],
        ['aRoute', 'route', 4]
      ]) {
        const attribute = imp.geometry.getAttribute(name);
        if (!attribute) {
          throw new Error('Missing geometry attribute ' + name);
        }
        if (attribute.itemSize !== expectedItemSize) {
          throw new Error('Attribute ' + name + ' itemSize mismatch: expected ' + expectedItemSize + ', got ' + attribute.itemSize);
        }
        if (attribute.count !== loadedPopulation) {
          throw new Error('Attribute ' + name + ' count mismatch: expected ' + loadedPopulation + ', got ' + attribute.count);
        }
        const live = attribute.array;
        const expected = attr[key] || attr.streamArcPhaseSeed;
        if (!expected) {
          throw new Error('Missing derived attribute key ' + key);
        }
        if (live.length !== expected.length) {
          throw new Error(`Attribute ${name} length mismatch: live ${live.length}, expected ${expected.length}`);
        }
        if (live.length !== loadedPopulation * expectedItemSize) {
          throw new Error(`Attribute ${name} buffer size mismatch: length ${live.length} != ${loadedPopulation * expectedItemSize}`);
        }
        for (let i = 0; i < live.length; i++) {
          if (live[i] !== expected[i]) {
            throw new Error(`Attribute ${name} mismatch at index ${i}: live ${live[i]} !== expected ${expected[i]}`);
          }
        }
      }

      const re = /if\s*\(type < ([\d.]+)\)\s*\{ if\s*\(front\) return TrafficLampShape\(vec4\(([^)]+)\), ([\d.-]+)\); return TrafficLampShape\(vec4\(([^)]+)\), ([\d.-]+)\); \}/g;
      const profiles = [...imp.material.vertexShader.matchAll(re)].map(m => ({
        head: { v: m[2].split(',').map(Number), y: Number(m[3]) },
        tail: { v: m[4].split(',').map(Number), y: Number(m[5]) }
      }));
      if (profiles.length !== 6) throw new Error('Live lamp profile parse failed');

      window.__r42 = {
        ...window.__r42,
        profiles,
        caseName,
        dpr,
        onlyGpuCar,
        tierSchedule,
        attr,
        loadedSeed,
        loadedPopulation,
        frame: 0,
        t0: caseName === 'lane' ? 37.15 : caseName === 'seam' ? 79 : 12,
        cam: { position: c.position.toArray(), quaternion: c.quaternion.toArray(), fov: c.fov },
        buffers: [],
        source: [],
        settings: s.renderSettings()
      };

      return {
        camera: window.__r42.cam,
        source: a.renderState(),
        settings: s.renderSettings(),
        adapter: s.glDiagnostics(),
        shader: imp.material.vertexShader,
        loadedSeed,
        loadedPopulation,
        uploadedImpostorAttributes: Object.fromEntries(
          ['aImp', 'aFlow', 'aRoute', 'aAppearance'].map(name => [name, Array.from(imp.geometry.getAttribute(name).array)])
        ),
        drawnSolids: ['skyriver.city.towers', 'skyriver.city.trim'].map(name => {
          const m = s.scene.getObjectByName(name);
          return m?.isInstancedMesh ? { name, count: m.count, matrices: Array.from(m.instanceMatrix.array.slice(0, m.count * 16)) } : null;
        })
      };
    }, {
      caseName,
      dpr,
      cameraOverride,
      preserveFade,
      blankSource,
      tierSchedule,
      onlyGpuCar,
      expectedSeed,
      expectedCount
    });

    for (let frame = 0; frame < 180; frame++) {
      await page.clock.runFor(frame % 3 === 2 ? 16 : 17);
      const result = await page.evaluate(({ frame }) => {
        const a = window.__skyriver;
        const s = a.scene;
        const c = s.camera;
        const h = window.__r42;
        const D = window.__skyriverDiag;
        const time = h.t0 + frame / 60;

        if (h.caseName === 'tier') {
          const pin = h.tierSchedule.find(p => p.frame === frame);
          if (pin) a.tiers.pin(pin.tier);
        }

        c.position.fromArray(h.cam.position);
        c.quaternion.fromArray(h.cam.quaternion);
        c.fov = h.cam.fov;
        c.updateProjectionMatrix();
        c.updateMatrixWorld(true);

        if (h.caseName === 'approach') {
          const elapsed = frame / 60;
          c.position.z += 340 * elapsed;
          c.updateMatrixWorld(true);
          a.traffic.setAnchor(0, 1500, 1240 + 90 * elapsed, 0, 90, 0, 0);
        }

        const tick = Math.floor(time * 30);
        const alpha = time * 30 - tick;
        s.update(tick, a.renderState().current, alpha);

        try {
          const gl = s.renderer.getContext();
          const W = gl.drawingBufferWidth;
          const H = gl.drawingBufferHeight;
          const pixels = new Uint8Array(W * H * 4);
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext('2d');
          const im = ctx.createImageData(W, H);
          for (let y = 0; y < H; y++) {
            im.data.set(pixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
          }
          ctx.putImageData(im, 0, 0);

          const imp = s.scene.getObjectByName('skyriver.traffic.impostors');
          const streak = s.scene.getObjectByName('skyriver.traffic.streaks');
          const u = imp.material.uniforms;
          const rows = [];
          const V = c.position.constructor;
          const pv = new V();
          const q = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };

          const smooth = (lo, hi, v) => {
            const k = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
            return k * k * (3 - 2 * k);
          };

          const measure = (id, p, dir, fade, slot, kind, scale, profileIndex, bank = 0) => {
            pv.set(...p).project(c);
            if (pv.z < -1 || pv.z > 1 || Math.abs(pv.x) > 0.96 || Math.abs(pv.y) > 0.92) return;
            const x = (pv.x + 1) * 640;
            const y = (1 - pv.y) * 360;
            const bx = Math.round(x * W / 1280);
            const by = Math.round(y * H / 720);
            let peak = 0;
            let energy = 0;
            let bright = 0;
            const bodyRadius = Math.round(4 * W / 1280);
            for (let dy = -bodyRadius; dy <= bodyRadius; dy++) {
              for (let dx = -bodyRadius; dx <= bodyRadius; dx++) {
                const xx = bx + dx;
                const yy = by + dy;
                if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
                const o = ((H - 1 - yy) * W + xx) * 4;
                const l = 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2];
                peak = Math.max(peak, l);
                energy += l;
                if (l >= 170) bright++;
              }
            }
            const forward = new V(...dir).normalize();
            const right0 = new V(forward.z, 0, -forward.x).normalize();
            const up0 = new V().crossVectors(forward, right0);
            const upW = up0.clone().multiplyScalar(Math.cos(bank)).addScaledVector(right0, -Math.sin(bank));
            const profile = h.profiles[profileIndex];
            const lamps = [];
            for (const name of ['head', 'tail']) {
              const patch = profile[name];
              const lp = new V(...p).addScaledVector(forward, patch.v[3] * scale).addScaledVector(upW, patch.y * scale);
              const screen = lp.clone().project(c);
              const lx = (screen.x + 1) * 640;
              const ly = (1 - screen.y) * 360;
              const dx = Math.round(lx * W / 1280);
              const dy = Math.round(ly * H / 720);
              let lpeak = 0;
              let lenergy = 0;
              let lbright = 0;
              const lampRadius = Math.round(2.4 * W / 1280);
              for (let yy = -lampRadius; yy <= lampRadius; yy++) {
                for (let xx = -lampRadius; xx <= lampRadius; xx++) {
                  const ix = dx + xx;
                  const iy = dy + yy;
                  if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
                  const o = ((H - 1 - iy) * W + ix) * 4;
                  const ll = 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2];
                  lpeak = Math.max(lpeak, ll);
                  lenergy += ll;
                  if (ll >= 170) lbright++;
                }
              }
              const facing = forward.dot(new V().subVectors(c.position, lp).normalize());
              lamps.push({
                id: id + ':' + name,
                world: lp.toArray(),
                screenCss: [lx, ly],
                patchPeak: lpeak,
                patchEnergy: lenergy,
                patchEnergyCss: lenergy / (W / 1280) ** 2,
                patchBrightPixels: lbright,
                patchBrightAreaCss: lbright / (W / 1280) ** 2,
                patchRadiusPhysical: lampRadius,
                facing,
                sourceFade: fade,
                group: name
              });
            }
            rows.push({
              id,
              slot,
              kind,
              profileIndex,
              bank,
              lamps,
              position: p,
              direction: dir,
              fade,
              scale,
              screenCss: [x, y],
              distance: Math.hypot(...p.map((v, i) => v - c.position.toArray()[i])),
              patchPeak: peak,
              patchEnergy: energy,
              patchEnergyCss: energy / (W / 1280) ** 2,
              patchBrightPixels: bright,
              patchBrightAreaCss: bright / (W / 1280) ** 2,
              patchRadiusPhysical: bodyRadius
            });
          };

          for (let i = 0; i < imp.geometry.instanceCount; i++) {
            D.impostorPosition(h.attr, i, time, q);
            const offset = i * 4;
            const k = (h.attr.pathArcPhaseSeed || h.attr.streamArcPhaseSeed)[offset];
            const p = [q.x, q.y, q.z];
            const d = Math.hypot(q.x - c.position.x, q.y - c.position.y, q.z - c.position.z);
            const presence = imp.geometry.getAttribute('aFromAlpha').getX(i) * (1 - u.uFadeK.value) + (i < u.uTargetCount.value ? 1 : 0) * u.uFadeK.value;
            const band = u.uBand.value;
            const far = u.uFarFalloff.value;
            const packed = imp.geometry.getAttribute('aAppearance').getX(i);
            measure('gpu:' + i, p, [q.dx, q.dy, q.dz], presence * smooth(band.x, band.y, d) * (1 - smooth(far.x, far.y, d)), i, k < 8 ? 'stream' : k < 14 ? 'lane' : 'ring', (packed - Math.floor(packed)) * 8, Math.floor(packed));
          }

          const g = streak.geometry;
          const P = g.getAttribute('aCarPos');
          const F = g.getAttribute('aCarFade');
          const L = g.getAttribute('aCarLod');
          const Q = g.getAttribute('aCarDir');
          for (let i = 0; i < g.instanceCount; i++) {
            measure('cpu:' + L.getZ(i), [P.getX(i), P.getY(i), P.getZ(i)], [Q.getX(i), Q.getY(i), Q.getZ(i)], F.getX(i), i, 'cpu', F.getY(i), g.getAttribute('aCarShape').getX(i), g.getAttribute('aCarShape').getY(i));
          }

          const tm = s.scene.getObjectByName('skyriver.city.towers').material;
          const tp = s.renderer.properties.get(tm).currentProgram.program;
          const actualInteriorUniforms = {
            strength: gl.getUniform(tp, gl.getUniformLocation(tp, 'uInteriorStrength')),
            fade: Array.from(gl.getUniform(tp, gl.getUniformLocation(tp, 'uInteriorFade')))
          };
          const liveTierState = h.liveTierState ?? null;
          const submitted = {
            impostorCount: imp.geometry.instanceCount,
            fadeK: u.uFadeK.value,
            targetCount: u.uTargetCount.value
          };

          return {
            png: canvas.toDataURL('image/png').split(',')[1],
            record: {
              frame,
              time,
              liveTierState,
              actualInteriorUniforms,
              interiorState: { mode: s.city.currentRoomMode(), ...s.city.interiorFade() },
              tier: a.stats().tier,
              track: rows,
              calls: s.renderer.info.render.calls,
              glError: gl.getError(),
              camera: { position: c.position.toArray(), quaternion: c.quaternion.toArray() },
              buffer: [W, H],
              ...submitted
            }
          };
        } finally {
          try {
            if (typeof h.restoreGpu === 'function') {
              h.restoreGpu();
            }
          } finally {
            h.restoreGpu = null;
          }
        }
      }, { frame });

      const stem = String(frame).padStart(4, '0');
      fs.writeFileSync(path.join(out, 'frames', stem + '.png'), Buffer.from(result.png, 'base64'));
      fs.writeFileSync(path.join(out, 'frames', stem + '.json.gz'), zlib.gzipSync(JSON.stringify(result.record)));

      const { track, ...summary } = result.record;
      frames.push({ ...summary, trackCount: track.length, trackingFile: 'frames/' + stem + '.json.gz' });

      if (frame % 30 === 0) {
        process.stdout.write(caseName + ' ' + frame + '\n');
      }
    }

    const report = {
      caseName,
      dpr,
      preserveFade,
      blankSource,
      tierSchedule,
      samplingHz: 60,
      frameCount: 180,
      durationS: 3,
      cameraFixed: caseName !== 'approach',
      cameraOrientationFixed: true,
      isolatedGpuCar: onlyGpuCar,
      diagnosticTag: onlyGpuCar !== null
        ? (blankSource ? 'isolated_car_blank' : (preserveFade ? 'isolated_car_preserve_fade' : 'isolated_car_explicit_source'))
        : 'production_all_cars',
      sourceMotion: caseName === 'approach'
        ? 'Observer rig moves +340m/s; escort anchor moves +90m/s with +Z heading. Closing speed is 250m/s. Camera orientation is fixed. Camera position is NOT world-fixed. Production escort motion remains active.'
        : 'Production paths and seeded populations. Camera is world-fixed.',
      pixels: 'Final composited RGB after one scene.update. CSS-normalized area and energy from a 4 CSS-pixel radius body patch and a 2.4 CSS-pixel radius lamp patch is a source-neighborhood observation, not an isolated sprite contribution.',
      setup: {
        ...setup,
        shaderHash: crypto.createHash('sha256').update(setup.shader).digest('hex'),
        shader: undefined
      },
      sourceBindings: {
        seed: setup.loadedSeed,
        population: setup.loadedPopulation,
        initialCamera: setup.camera,
        shaderHash: crypto.createHash('sha256').update(setup.shader).digest('hex'),
        uploadedImpostorAttributes: Object.keys(setup.uploadedImpostorAttributes),
        drawnSolids: setup.drawnSolids.map(d => ({ name: d.name, count: d.count }))
      },
      invocation: {
        url,
        out,
        caseName,
        dpr,
        onlyGpuCar,
        preserveFade,
        blankSource,
        tierSchedule,
        cameraOverride,
        timestamp: new Date().toISOString()
      },
      limitations: [
        'Counts cannot certify a pop-free sequence.',
        'Current nearest-body candidate attribution and tower-only CPU occlusion lack full raster ownership.',
        'Attributed candidates and patch measurements are neighborhood observations, not full raster claims.'
      ],
      frames,
      errors
    };

    fs.writeFileSync(path.join(out, 'sequence.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(out, 'source-bindings.json'), JSON.stringify(report.sourceBindings, null, 2));
    fs.writeFileSync(path.join(out, 'invocation.json'), JSON.stringify(report.invocation, null, 2));

    if (
      errors.length ||
      frames.some(f => f.glError || f.calls > 32) ||
      frames.some(f => JSON.stringify(f.camera.quaternion) !== JSON.stringify(frames[0].camera.quaternion) || (caseName !== 'approach' && JSON.stringify(f.camera.position) !== JSON.stringify(frames[0].camera.position)))
    ) {
      throw new Error('Capture guard failed');
    }
  } catch (error) {
    try {
      if (frames.length > 0 && !fs.existsSync(path.join(out, 'sequence.json'))) {
        const failureReport = {
          failed: true,
          error: error.message,
          caseName,
          dpr,
          framesCaptured: frames.length,
          frames,
          errors: [...errors, error.message]
        };
        fs.writeFileSync(path.join(out, 'sequence.json'), JSON.stringify(failureReport, null, 2));
      }
    } catch (_) {}
    throw error;
  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.evaluate(() => {
          const a = window.__skyriver;
          const h = window.__r42;
          if (typeof h?.restoreGpu === 'function') {
            try {
              h.restoreGpu();
            } finally {
              h.restoreGpu = null;
            }
          }
          const orig = window.__r42OriginalTrafficUpdate || h?.originalTrafficUpdate;
          if (orig && a?.traffic) {
            a.traffic.update = orig;
            window.__r42OriginalTrafficUpdate = null;
            if (h) h.originalTrafficUpdate = null;
          }
        });
      }
    } catch (_) {
      // Ignore teardown evaluation failure to let browser close and unlock run.
    } finally {
      try {
        if (browser) await browser.close();
      } finally {
        if (unlock) unlock();
      }
    }
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
