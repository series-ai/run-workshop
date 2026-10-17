// Run against the development server. Movement uses the normal keyboard path.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4486';
const out = process.env.PORTAL_SHOTS ?? fileURLToPath(new URL('../test-results/portal-finish/', import.meta.url));
await mkdir(out, { recursive: true });
const results = { url: base, errors: [], screenshots: [], views: {}, crossings: [], checks: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });

function check(condition, message) {
  results.checks.push({ message, passed: Boolean(condition) });
  assert.ok(condition, message);
}

async function ready(page, quality) {
  page.on('pageerror', error => results.errors.push({ kind: 'page', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|webgl|gl_invalid|compile|link program/i.test(message.text())) {
      results.errors.push({ kind: 'shader', message: message.text() });
    }
  });
  await page.goto(`${base}/?quality=${quality}&capture=off&record`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35
    && window.__SET_LOOK_ANGLES__ && window.__SET_CAMERA_OVERRIDE__ && window.__DEBUG_THREE__, null, { timeout: 90000 });
  await page.evaluate(() => {
    const debug = window.__DEBUG_THREE__;
    const renderer = debug.gl;
    const render = renderer.render;
    const audit = { samples: [], styles: [], copies: [], alpha: [], latest: null, lastScene: null, filmBlend: null };
    window.__PORTAL_FINISH_AUDIT__ = audit;
    renderer.render = function (scene, camera) {
      const material = scene.children?.[0]?.material;
      if (scene === debug.scene) {
        audit.lastScene = { projection: camera.projectionMatrix.elements.slice(), world: camera.matrixWorld.elements.slice() };
        const film = debug.scene.getObjectByName('returns-film-a')?.material;
        if (film) audit.filmBlend = { blending: film.blending, srcAlpha: film.blendSrcAlpha, dstAlpha: film.blendDstAlpha };
      }
      if (material?.name === 'yard-portal-depth-style') {
        const u = material.uniforms;
        const inverse = u.uInverseProjection.value.elements;
        const projection = audit.lastScene?.projection;
        let inverseError = 0;
        if (projection) {
          for (let column = 0; column < 4; column += 1) {
            for (let row = 0; row < 4; row += 1) {
              let value = 0;
              for (let k = 0; k < 4; k += 1) value += projection[k * 4 + row] * inverse[column * 4 + k];
              inverseError = Math.max(inverseError, Math.abs(value - Number(row === column)));
            }
          }
        }
        audit.styles.push({ linear: u.uLinearOutput.value, bloom: u.uEnableBloom.value,
          inverse: inverse.slice(), world: u.uCameraWorld.value.elements.slice(), projection, inverseError });
        if (audit.styles.length > 40) audit.styles.shift();
      }
      if (material?.name === 'yard-portal-style-copy') {
        audit.copies.push({ stencilRef: material.stencilRef, stencilFunc: material.stencilFunc,
          depthTest: material.depthTest, depthWrite: material.depthWrite, blending: material.blending });
        if (audit.copies.length > 40) audit.copies.shift();
      }
      const value = render.call(this, scene, camera);
      if (material?.name === 'yard-ink-composite') {
        const state = window.__WRECK_YARD_CONTROLLER__.getRender();
        const player = state?.players.find(entry => entry.slot === state.localSlot);
        const films = ['a', 'b'].map(end => {
          const u = debug.scene.getObjectByName(`returns-film-${end}`)?.material.uniforms;
          return u ? { time: u.uTime.value, pulse: u.uPulse.value, contact: u.uContact.value } : null;
        });
        const u = material.uniforms;
        const sample = { frame: state?.frame, counter: player?.portalTeleports ?? 0,
          position: player?.position, transit: u.uPortalTransit.value, distortion: u.uPortalDistortion.value,
          time: u.uPortalTime.value, films };
        audit.latest = sample;
        audit.samples.push(sample);
        if (audit.samples.length > 3000) audit.samples.shift();
        if (audit.captureTransit && sample.transit > 0 && !audit.transitImage) {
          audit.transitImage = { data: renderer.domElement.toDataURL('image/png'), sample };
        }
        if (audit.readAlpha) {
          const context = renderer.getContext();
          const pixel = new Uint8Array(4);
          context.readPixels(Math.floor(context.drawingBufferWidth / 2), Math.floor(context.drawingBufferHeight / 2),
            1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
          audit.alpha.push(Array.from(pixel));
          audit.readAlpha = false;
        }
      }
      return value;
    };
  });
  await page.waitForFunction(() => window.__PORTAL_FINISH_AUDIT__.latest);
}

const sample = page => page.evaluate(() => window.__PORTAL_FINISH_AUDIT__.latest);

async function screenshot(page, name) {
  const path = join(out, `${name}.png`);
  await page.screenshot({ path, animations: 'disabled', timeout: 30000 });
  results.screenshots.push(path);
  return path;
}

async function view(page, name, position, lookAt) {
  await page.evaluate(([p, target]) => {
    window.__PORTAL_FINISH_AUDIT__.styles = [];
    window.__PORTAL_FINISH_AUDIT__.copies = [];
    window.__PORTAL_FINISH_AUDIT__.readAlpha = true;
    window.__SET_CAMERA_OVERRIDE__(p, target);
  }, [position, lookAt]);
  await page.waitForFunction(() => window.__PORTAL_FINISH_AUDIT__.styles.length >= 2, null, { timeout: 30000 });
  await screenshot(page, name);
  const state = await page.evaluate(() => {
    const audit = window.__PORTAL_FINISH_AUDIT__;
    const { gl, scene, camera } = window.__DEBUG_THREE__;
    return { styles: audit.styles, copies: audit.copies, alpha: audit.alpha, filmBlend: audit.filmBlend,
      camera: camera.position.toArray(), eyeInverse: camera.projectionMatrixInverse.elements.slice(),
      filmCount: scene.getObjectByName('returns-portal-effects')?.children.length,
      renderCalls: gl.info.render.calls, drawingBuffer: [gl.domElement.width, gl.domElement.height] };
  });
  check(state.styles.every(entry => entry.linear === 1 && entry.bloom === 0), `${name}: portal color stays linear without bloom`);
  check(state.styles.every(entry => entry.inverseError < 1e-7), `${name}: inverse projection matches the active view`);
  check(state.styles.some(entry => entry.inverse.some((value, index) => Math.abs(value - state.eyeInverse[index]) > 1e-5)), `${name}: portal projection differs from eye projection`);
  check(state.copies.length > 0 && state.copies.every(entry => !entry.depthWrite && !entry.depthTest && entry.blending === 0
    && entry.stencilRef > 0 && entry.stencilFunc === 514), `${name}: copy keeps stencil and depth rules`);
  check(state.alpha.length > 0 && state.alpha.every(pixel => pixel[3] === 255), `${name}: final framebuffer alpha is opaque`);
  check(state.filmCount === 2, `${name}: both portal films exist`);
  check(state.filmBlend?.srcAlpha === 200 && state.filmBlend?.dstAlpha === 201, `${name}: transparent film preserves the processing marker`);
  results.views[name] = state;
}

async function walk(page, target, radius = 0.3) {
  for (let step = 0; step < 360; step += 1) {
    const state = await sample(page);
    const dx = target[0] - state.position[0];
    const dz = target[1] - state.position[2];
    if (Math.hypot(dx, dz) < radius) {
      await page.keyboard.up('KeyW');
      return;
    }
    await page.evaluate(([x, z]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x, -z), 0), [dx, dz]);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(60);
  }
  await page.keyboard.up('KeyW');
  throw new Error(`Could not walk to ${target}: ${JSON.stringify(await sample(page))}`);
}

async function cross(page, end, reduced = false) {
  const before = await sample(page);
  const target = end === 'A' ? [-2, 22] : [7, -23];
  const prefix = `${reduced ? 'reduced-' : ''}cross-${end.toLowerCase()}`;
  await screenshot(page, `${prefix}-before`);
  await page.evaluate(() => {
    const audit = window.__PORTAL_FINISH_AUDIT__;
    audit.samples = [];
    audit.captureTransit = true;
    audit.transitImage = null;
  });
  for (let step = 0; step < 400; step += 1) {
    const state = await sample(page);
    if (state.counter > before.counter) break;
    const dx = target[0] - state.position[0];
    const dz = target[1] - state.position[2];
    await page.evaluate(([x, z]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x, -z), 0), [dx, dz]);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(45);
  }
  await page.keyboard.up('KeyW');
  const atCrossing = await sample(page);
  check(atCrossing.counter === before.counter + 1, `${prefix}: real keyboard passage increments the teleport counter once`);
  const captured = await page.evaluate(() => {
    const audit = window.__PORTAL_FINISH_AUDIT__;
    audit.captureTransit = false;
    return audit.transitImage;
  });
  check(captured?.sample.transit > 0, `${prefix}: image records the actual pulse frame`);
  const duringPath = join(out, `${prefix}-during.png`);
  await writeFile(duringPath, Buffer.from(captured.data.split(',')[1], 'base64'));
  results.screenshots.push(duringPath);
  await page.waitForFunction(() => {
    const latest = window.__PORTAL_FINISH_AUDIT__.latest;
    return latest.transit === 0 && latest.distortion === 0 && latest.films.every(film => film.pulse === 0);
  }, null, { timeout: 15000 });
  await screenshot(page, `${prefix}-after`);
  const samples = await page.evaluate(() => window.__PORTAL_FINISH_AUDIT__.samples);
  const peak = Math.max(...samples.map(entry => entry.transit));
  const distortion = Math.max(...samples.map(entry => entry.distortion));
  check(peak > 0, `${prefix}: passage produces a visible pulse`);
  check(reduced ? distortion === 0 : distortion > 0, `${prefix}: distortion follows the motion setting`);
  if (reduced) check(samples.every(entry => entry.films.every(film => film.time === 0)), `${prefix}: reduced motion stops film time`);
  const final = await sample(page);
  check(final.transit === 0 && final.distortion === 0 && final.films.every(film => film.pulse === 0),
    `${prefix}: passage and film pulses fully stop`);
  check(end === 'A' ? final.position[0] > 4 && final.position[2] < -15 : final.position[0] < 1 && final.position[2] > 15,
    `${prefix}: passage reaches the linked door`);
  results.crossings.push({ end, reduced, before, atCrossing, capturedFrame: captured.sample, final, peak, distortion, samples });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await ready(page, 'high');
  check((await sample(page)).transit === 0, 'initial frame has no passage pulse');
  await page.getByRole('button', { name: 'Orbit (O)', exact: true }).click();
  await view(page, 'desktop1440-high-delivery', [-2, 2.1, 14.5], [-2, 1.34, 20.3]);
  await view(page, 'desktop1440-high-returns', [7, 2.1, -15.5], [7, 1.34, -21.3]);
  await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  await page.keyboard.press('Digit1');
  // Low quality keeps the movement check fast. High quality is checked above.
  await page.locator('.yard-switch').click();
  await cross(page, 'A');
  await walk(page, [7, -18.8]);
  await cross(page, 'B');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__PORTAL_FINISH_AUDIT__.latest.films.every(film => film.time === 0));
  await walk(page, [-2, 18]);
  await cross(page, 'A', true);

  await page.getByRole('button', { name: 'Leave Match', exact: true }).click();
  await page.getByRole('button', { name: 'Play Solo', exact: true }).click();
  await page.waitForFunction(() => {
    const audit = window.__PORTAL_FINISH_AUDIT__;
    return audit.latest?.counter === 0 && audit.latest.frame > 10;
  }, null, { timeout: 60000 });
  results.reset = await sample(page);
  check(results.reset.transit === 0 && results.reset.distortion === 0, 'new solo session has no passage pulse');
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const mobile = await mobileContext.newPage();
  await ready(mobile, 'low');
  await view(mobile, 'mobile390-low-delivery', [-2, 2.1, 6], [-2, 1.34, 20.3]);
  await view(mobile, 'mobile390-low-returns', [7, 2.1, -7], [7, 1.34, -21.3]);
  await mobileContext.close();
  check(results.errors.length === 0, 'browser and shader checks have no errors');
  results.passed = true;
} catch (error) {
  results.passed = false;
  results.failure = String(error.stack ?? error);
  throw error;
} finally {
  await writeFile(join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}
console.log(JSON.stringify({ passed: results.passed, checks: results.checks, screenshots: results.screenshots }, null, 2));
