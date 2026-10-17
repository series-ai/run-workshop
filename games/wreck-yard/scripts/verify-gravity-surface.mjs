// Check the real renderer and WASM game with mouse and keyboard controls.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4487';
const out = process.env.GRAVITY_SHOTS ?? fileURLToPath(new URL('../test-results/gravity-surface/', import.meta.url));
await mkdir(out, { recursive: true });
const results = { url: base, checks: [], errors: [], cases: [], screenshots: [],
  limits: ['The static shader comparison pauses the simulation. It does not isolate moving self-shadow changes in the shared occlusion volume.'] };
const mobileOnly = process.env.GRAVITY_AUDIT_MOBILE_ONLY === '1';
if (mobileOnly) {
  results.limits.push('This run checks mobile only. Desktop results remain in their separate evidence directory.');
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const touchPages = new WeakSet();

function check(value, message) {
  results.checks.push({ message, passed: Boolean(value) });
  assert.ok(value, message);
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
    && window.__DEBUG_THREE__ && window.__SET_LOOK_ANGLES__, null, { timeout: 90000 });
  await page.evaluate(() => {
    const debug = window.__DEBUG_THREE__;
    const renderer = debug.gl;
    const render = renderer.render;
    const audit = { frame: 0, calls: 0, frames: [], capture: null, images: {}, mode: 'normal', monitor: null };
    window.__GRAVITY_SURFACE_AUDIT__ = audit;
    renderer.render = function (scene, camera) {
      const saved = new Map();
      if (scene === debug.scene && audit.mode !== 'normal') {
        scene.traverse(object => {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const uniforms = material?.uniforms?.uGravityHeld ? material.uniforms : material?.userData.gravitySurfaceUniforms;
            if (!uniforms) continue;
            for (const name of ['uGravityHeld', 'uGravityHeldIndices', 'uGravityTime']) {
              const uniform = uniforms[name];
              if (!uniform || saved.has(uniform)) continue;
              saved.set(uniform, uniform.value?.clone ? uniform.value.clone() : uniform.value);
              if (name === 'uGravityTime' || (name === 'uGravityHeld' && audit.mode === 'off')) uniform.value = 0;
              if (name === 'uGravityHeldIndices' && audit.mode === 'off') uniform.value.set(-1, -1, -1, -1);
            }
            if (material.isShaderMaterial) material.uniformsNeedUpdate = true;
          }
        });
      }
      let value;
      try { value = render.call(this, scene, camera); }
      finally {
        for (const [uniform, previous] of saved) {
          if (uniform.value?.copy) uniform.value.copy(previous);
          else uniform.value = previous;
        }
      }
      audit.calls += renderer.info.render.calls;
      if (scene.children?.[0]?.material?.name === 'yard-ink-composite') {
        audit.frame += 1;
        const materials = new Set();
        debug.scene.traverse(object => {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) materials.add(material.id);
        });
        const snapshot = { frame: audit.frame, calls: audit.calls, materials: materials.size,
          programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
        audit.calls = 0;
        const gl = renderer.getContext();
        if (audit.monitor) {
          const { x, y, width, height } = audit.monitor;
          const pixels = new Uint8Array(width * height * 4);
          gl.readPixels(x, gl.drawingBufferHeight - y - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let luma = 0;
          for (let i = 0; i < pixels.length; i += 4) luma += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
          snapshot.meanLuma = luma / (width * height);
        }
        audit.frames.push(snapshot);
        if (audit.frames.length > 2000) audit.frames.shift();
        if (audit.capture) {
          const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          audit.images[audit.capture] = { png: renderer.domElement.toDataURL('image/png'), pixels,
            width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, snapshot };
          audit.capture = null;
        }
      }
      return value;
    };
  });
  if (!touchPages.has(page)) await page.keyboard.press('Digit1');
}

async function state(page) {
  return page.evaluate(() => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find(entry => entry.slot === render.localSlot);
    const scene = window.__DEBUG_THREE__.scene;
    const raw = [], batches = [], materials = new Set(), weapon = [];
    scene.traverse(object => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        materials.add(material.id);
        if (material.uniforms?.uGravityHeld) raw.push({ body: object.parent.name, held: material.uniforms.uGravityHeld.value,
          time: material.uniforms.uGravityTime.value, visible: object.visible, depthWrite: material.depthWrite, transparent: material.transparent });
        const gravity = material.userData.gravitySurfaceUniforms;
        if (gravity && object.isInstancedMesh) {
          const matrix = object.matrix.clone();
          const indices = gravity.uGravityHeldIndices.value.toArray();
          const selected = indices.filter(index => index >= 0).map(index => {
            object.getMatrixAt(index, matrix);
            return { index, position: matrix.elements.slice(12, 15) };
          });
          batches.push({ uuid: object.uuid, material: material.id, selected, indices, time: gravity.uGravityTime.value,
            mapped: Boolean(material.map), count: object.count, depthWrite: material.depthWrite, transparent: material.transparent });
        }
      }
    });
    scene.getObjectByName('first-person-tool')?.traverse(object => {
      if (object.material?.transparent) weapon.push({ opacity: object.material.opacity, depthWrite: object.material.depthWrite });
    });
    const held = player.grabbing ? render.bodies.find(body => body.id === player.grabbing) : null;
    const beam = scene.getObjectByName('TractorBeam');
    const beamMeshes = beam?.children.filter(object => object.isInstancedMesh) ?? [];
    const beamMaterials = beam?.children.filter(object => object.material).map(object => ({
      depthWrite: object.material.depthWrite, depthTest: object.material.depthTest,
      transparent: object.material.transparent, blending: object.material.blending,
    })) ?? [];
    return { frame: render.frame, throws: render.stats.throws, player: { position: player.position, grabbing: player.grabbing, yaw: player.yaw,
      pitch: player.pitch, feedback: player.feedback, portalTeleports: player.portalTeleports },
    held: held ? { id: held.id, model: held.renderModel ?? 'voxel', dims: held.dims,
      position: render.poses.get(held.id).position, rotation: render.poses.get(held.id).rotation } : null,
    raw, batches, materials: materials.size, weapon, beam: { present: Boolean(beam),
      instances: beamMeshes.map(object => object.count), materials: beamMaterials,
      visibleEndpoints: beam?.children.filter(object => object.isSprite && object.visible).length ?? 0 } };
  });
}

async function shot(page, name) {
  const path = join(out, `${name}.png`);
  await page.screenshot({ path, animations: 'disabled', timeout: 30000 });
  results.screenshots.push(path);
}

async function aim(page, point) {
  await page.evaluate(target => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find(entry => entry.slot === render.localSlot);
    const dx = target[0] - player.position[0], dy = target[1] - player.position[1] - 1.55, dz = target[2] - player.position[2];
    window.__SET_LOOK_ANGLES__(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
  }, point);
}

async function acquire(page, kind) {
  const candidates = await page.evaluate(kind => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find(entry => entry.slot === render.localSlot);
    return render.bodies.filter(body => body.motion === 'dynamic' && body.id !== 'vehicle-chassis'
      && (kind === 'crate' ? body.storageBay === 'returns' && body.renderModel === 'shipping-crate' : body.renderModel !== 'shipping-crate'))
      .map(body => ({ id: body.id, position: render.poses.get(body.id)?.position }))
      .filter(body => body.position && Math.hypot(body.position[0] - player.position[0], body.position[2] - player.position[2]) < 8
        && (kind !== 'crate' || body.position[0] < 10.8 && body.position[1] > 2.3 && body.position[2] > -17.4))
      .sort((a, b) => Math.hypot(...a.position.map((v, i) => v - player.position[i])) - Math.hypot(...b.position.map((v, i) => v - player.position[i])));
  }, kind);
  for (const candidate of candidates.slice(0, 12)) {
    await aim(page, candidate.position);
    await page.waitForTimeout(120);
    if (touchPages.has(page)) await page.getByLabel('Grab', { exact: true }).tap();
    else {
      const canvas = await page.locator('canvas').first().boundingBox();
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height * 0.3);
      await page.mouse.down();
    }
    try {
      await page.waitForFunction(() => {
        const render = window.__WRECK_YARD_CONTROLLER__.getRender();
        return render.players.find(entry => entry.slot === render.localSlot).grabbing;
      }, null, { timeout: 1800 });
      const held = await state(page);
      if ((kind === 'crate') === (held.held.model === 'shipping-crate')) return held;
    } catch {}
    if (!touchPages.has(page)) await page.mouse.up();
    await page.waitForTimeout(200);
  }
  throw new Error(`No ${kind} could be held with real mouse input: ${JSON.stringify(candidates)}`);
}

function selection(snapshot, kind, label) {
  const selectedRaw = snapshot.raw.filter(entry => entry.held > 0);
  const selectedBatches = snapshot.batches.filter(entry => entry.selected.length > 0);
  check(snapshot.beam.present && snapshot.beam.instances.length === 3 && snapshot.beam.instances.every(count => count > 0)
    && snapshot.beam.visibleEndpoints > 0 && snapshot.beam.materials.length >= 4
    && snapshot.beam.materials.every(material => material.transparent && material.blending === 2 && material.depthTest && !material.depthWrite),
  `${label}: restored beam and endpoint use additive color with depth test and no depth write`);
  check(snapshot.weapon.length >= 2 && snapshot.weapon.every(entry => !entry.depthWrite), `${label}: transparent weapon parts do not write depth`);
  if (kind === 'voxel') {
    check(selectedRaw.length === 2 && selectedRaw.every(entry => entry.body === `voxel-body-${snapshot.held.id}`), `${label}: only held voxel base and copy select the shader`);
    check(selectedBatches.length === 0, `${label}: unheld crate batches stay clear`);
  } else {
    check(selectedRaw.length === 0, `${label}: holding a crate does not select voxel props`);
    check(selectedBatches.length === 2 && selectedBatches.every(batch => batch.selected.length === 1
      && Math.hypot(...batch.selected[0].position.map((v, i) => v - snapshot.held.position[i])) < 0.001), `${label}: only held crate body and frame indices select the shader`);
    check(selectedBatches.some(batch => batch.mapped), `${label}: held crate retains its atlas`);
    check(new Set(snapshot.batches.map(batch => batch.material)).size === snapshot.batches.length, `${label}: crate batches own separate material state`);
  }
  check(snapshot.raw.every(entry => entry.depthWrite && !entry.transparent)
    && snapshot.batches.every(entry => entry.depthWrite && !entry.transparent), `${label}: object surfaces keep opaque depth rules`);
}

async function captured(page, key, mode) {
  await page.evaluate(([key, mode]) => {
    const audit = window.__GRAVITY_SURFACE_AUDIT__;
    audit.mode = mode;
    audit.capture = key;
  }, [key, mode]);
  await page.waitForFunction(key => Boolean(window.__GRAVITY_SURFACE_AUDIT__.images[key]), key);
  const png = await page.evaluate(key => window.__GRAVITY_SURFACE_AUDIT__.images[key].png, key);
  const path = join(out, `${key}.png`);
  await writeFile(path, Buffer.from(png.split(',')[1], 'base64'));
  results.screenshots.push(path);
}

async function surfaceProof(page, label) {
  const held = (await state(page)).held;
  // Keep bead flow fixed while the matched images change only the object shader.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(position => {
    window.__WRECK_YARD_CONTROLLER__.setPaused(true);
    window.__SET_CAMERA_OVERRIDE__([position[0] + 2.5, position[1] + 1.3, position[2] + 3], position);
  }, held.position);
  await page.waitForTimeout(250);
  const region = await page.evaluate(() => {
    const gl = window.__DEBUG_THREE__.gl.getContext();
    const width = Math.floor(gl.drawingBufferWidth * 0.22), height = Math.floor(gl.drawingBufferHeight * 0.30);
    const region = { x: Math.floor((gl.drawingBufferWidth - width) / 2), y: Math.floor((gl.drawingBufferHeight - height) / 2), width, height };
    const audit = window.__GRAVITY_SURFACE_AUDIT__;
    audit.monitor = region;
    audit.frames = [];
    return region;
  });
  await page.waitForFunction(() => window.__GRAVITY_SURFACE_AUDIT__.frames.length >= 20, null, { timeout: 30000 });
  const frames = await page.evaluate(() => window.__GRAVITY_SURFACE_AUDIT__.frames.slice());
  const luminance = frames.map(frame => frame.meanLuma);
  check(Math.min(...luminance) >= Math.max(...luminance) * 0.85, `${label}: static held surface has no large dark pulse over 20 frames`);
  check(new Set(frames.map(frame => frame.materials)).size === 1 && new Set(frames.map(frame => frame.programs)).size === 1
    && new Set(frames.map(frame => frame.geometries)).size === 1, `${label}: warm hold creates no material, program, or geometry churn`);
  await captured(page, `${label}-shader-on`, 'on');
  await captured(page, `${label}-shader-off`, 'off');
  const matched = await page.evaluate(([on, off, region]) => {
    const audit = window.__GRAVITY_SURFACE_AUDIT__;
    const a = audit.images[on], b = audit.images[off];
    let brighter = 0, darkDrops = 0, sum = 0, maxGain = 0;
    for (let y = region.y; y < region.y + region.height; y += 1) for (let x = region.x; x < region.x + region.width; x += 1) {
      const i = ((a.height - 1 - y) * a.width + x) * 4;
      const gain = (a.pixels[i] - b.pixels[i]) * 0.2126 + (a.pixels[i + 1] - b.pixels[i + 1]) * 0.7152 + (a.pixels[i + 2] - b.pixels[i + 2]) * 0.0722;
      if (gain > 1) brighter += 1;
      if (gain < -20) darkDrops += 1;
      sum += gain;
      maxGain = Math.max(maxGain, gain);
    }
    audit.mode = 'normal';
    audit.monitor = null;
    return { brighter, darkDrops, meanGain: sum / (region.width * region.height), maxGain,
      pixels: region.width * region.height, onCalls: a.snapshot.calls, offCalls: b.snapshot.calls,
      onPrograms: a.snapshot.programs, offPrograms: b.snapshot.programs };
  }, [`${label}-shader-on`, `${label}-shader-off`, region]);
  check(matched.brighter > 10 && matched.meanGain > 0, `${label}: matched shader image adds visible light`);
  check(matched.darkDrops < matched.pixels * 0.01, `${label}: matched shader image has no large dark surface region`);
  check(matched.onCalls === matched.offCalls && matched.onPrograms === matched.offPrograms, `${label}: shader adds no draw call or program`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  const reduced = await state(page);
  check(reduced.raw.every(entry => entry.time === 0) && reduced.batches.every(entry => entry.time === 0), `${label}: reduced motion freezes object shader time`);
  await shot(page, `${label}-reduced`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    window.__SET_CAMERA_OVERRIDE__(null);
    window.__WRECK_YARD_CONTROLLER__.setPaused(false);
  });
  return { frames, matched, reduced };
}

async function holdCase(page, kind, label) {
  await shot(page, `${label}-before`);
  const acquired = await acquire(page, kind);
  await page.waitForTimeout(350);
  const held = await state(page);
  selection(held, kind, label);
  await shot(page, `${label}-held`);
  await page.evaluate(([yaw, pitch]) => window.__SET_LOOK_ANGLES__(yaw + 0.25, pitch + 0.08), [held.player.yaw, held.player.pitch]);
  await page.waitForTimeout(400);
  const moved = await state(page);
  check(moved.player.grabbing === held.held.id && Math.hypot(...moved.held.position.map((v, i) => v - held.held.position[i])) > 0.05,
    `${label}: held body follows a real aim change`);
  await shot(page, `${label}-moved`);
  const proof = await surfaceProof(page, label);
  if (kind === 'crate' && !touchPages.has(page)) {
    const position = (await state(page)).player.position;
    await page.evaluate(position => window.__SET_LOOK_ANGLES__(Math.atan2(-(7 - position[0]), -(-21 - position[2])), 0.4), position);
    await page.waitForFunction(id => {
      const controller = window.__WRECK_YARD_CONTROLLER__;
      const render = controller.getRender();
      if (!render.portalStraddlers?.some(entry => entry.bodyId === id)) return false;
      controller.setPaused(true);
      return true;
    }, held.held.id, { timeout: 12000, polling: 'raf' });
    await page.waitForFunction(id => window.__DEBUG_THREE__.scene.getObjectByName(`crate-${id}-exit`), held.held.id);
    proof.portal = await page.evaluate(id => {
      const scene = window.__DEBUG_THREE__.scene;
      return ['entry', 'exit'].map(end => ({ end, materials: scene.getObjectByName(`crate-${id}-${end}`).children.map(mesh => ({
        held: mesh.material.userData.gravitySurfaceUniforms?.uGravityHeld.value,
        key: mesh.material.customProgramCacheKey(), map: mesh.material.map?.uuid ?? null,
        clipped: mesh.material.clippingPlanes?.length, depthWrite: mesh.material.depthWrite,
      })) }));
    }, held.held.id);
    check(proof.portal.every(half => half.materials.length === 2 && half.materials.every(material => material.held === 1
      && material.key.endsWith('|gravity-surface-v1') && material.clipped === 1 && material.depthWrite)),
    `${label}: both native portal halves use the held surface shader and clipping`);
    check(proof.portal[0].materials[0].map && proof.portal[0].materials[0].map === proof.portal[1].materials[0].map,
      `${label}: portal halves share the original crate atlas`);
    await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__([7, 3.1, -12], [7, 1.2, -21]));
    await page.waitForTimeout(150);
    await shot(page, `${label}-portal-halves`);
    await page.evaluate(() => {
      window.__SET_CAMERA_OVERRIDE__(null);
      window.__WRECK_YARD_CONTROLLER__.setPaused(false);
    });
  }
  if (touchPages.has(page)) await page.getByLabel('Throw', { exact: true }).tap();
  else await page.mouse.up();
  await page.waitForFunction(touch => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find(entry => entry.slot === render.localSlot);
    return player.grabbing === null && player.feedback?.result === (touch ? 'punt' : 'throw');
  }, touchPages.has(page), { timeout: 10000 });
  await shot(page, `${label}-thrown`);
  const released = await state(page);
  check(released.throws === acquired.throws + 1, `${label}: release launches the held object once`);
  check(released.raw.every(entry => entry.held === 0) && released.batches.every(batch => batch.indices.every(index => index === -1)),
    `${label}: release clears all object hold state`);
  results.cases.push({ label, acquired, held, moved, proof, released });
}

async function walk(page, target, radius = 0.3, counter = null) {
  const routeState=()=>page.evaluate(()=>{const controller=window.__WRECK_YARD_CONTROLLER__,render=controller.getRender();
    const player=render.players.find(p=>p.slot===render.localSlot);return{atMs:performance.now(),frame:render.frame,status:controller.snapshot().status,
      paused:controller.isPaused(),position:player.position,yaw:player.yaw,pitch:player.pitch,portalTeleports:player.portalTeleports,input:{...controller.input}};});
  const route={target,radius,counter,inputMode:touchPages.has(page)?'CDP touch':'keyboard',start:await routeState(),progress:[],commands:[]};
  results.routes??=[];results.routes.push(route);
  let touch, touchPoint;
  await page.evaluate(([dx,dz])=>window.__SET_LOOK_ANGLES__(Math.atan2(-dx,-dz),0),[target[0]-route.start.position[0],target[1]-route.start.position[2]]);
  const touchAxis=async value=>{route.commands.push({at:new Date().toISOString(),moveZ:value,deflectionPx:value?40:0});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touchPoint,y:touchPoint.y-(value?40:0)}]});};
  if (touchPages.has(page)) {
    touch = await page.context().newCDPSession(page);
    const box = await page.getByLabel('Move pad', { exact: true }).boundingBox();
    touchPoint = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 30 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
    await touchAxis(counter===null&&Math.hypot(target[0]-route.start.position[0],target[1]-route.start.position[2])<1.5?0:1);
  }
  for (let step = 0; step < 400; step += 1) {
    if(step%20===0)route.progress.push({iteration:step,...await routeState()});
    const current = (await state(page)).player;
    if (counter !== null && current.portalTeleports > counter) break;
    const dx = target[0] - current.position[0], dz = target[1] - current.position[2];
    if (counter === null && Math.hypot(dx, dz) < radius) break;
    await page.evaluate(([dx, dz]) => window.__SET_LOOK_ANGLES__(Math.atan2(-dx, -dz), 0), [dx, dz]);
    if(touch&&counter===null&&Math.hypot(dx,dz)<1.5){
      await touchAxis(0);await page.waitForTimeout(120);
      await touchAxis(1);await page.waitForTimeout(60);await touchAxis(0);await page.waitForTimeout(120);
      route.progress.push({iteration:step,kind:'after-neutral-pulse',...await routeState()});continue;
    }
    if (!touch) await page.keyboard.down('KeyW');
    await page.waitForTimeout(60);
  }
  route.beforeRelease=await routeState();
  if (touch) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  } else await page.keyboard.up('KeyW');
  const final = (await state(page)).player;
  route.end=await routeState();
  route.reached=counter===null?Math.hypot(final.position[0]-target[0],final.position[2]-target[1])<radius+0.5:final.portalTeleports===counter+1;
  await shot(page,`route-${results.routes.length}-${route.reached?'passed':'failed'}`);
  check(counter === null ? Math.hypot(final.position[0] - target[0], final.position[2] - target[1]) < radius + 0.5
    : final.portalTeleports === counter + 1, 'keyboard route reaches its destination');
}

try {
  for (const [label, width, height, quality] of [['desktop1440-high', 1440, 900, 'high'], ['mobile390-low', 390, 844, 'low']]) {
    if (mobileOnly && width !== 390) continue;
    const mobile = width === 390;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
      ...(mobile ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' } : {}) });
    const page = await context.newPage();
    if (mobile) touchPages.add(page);
    await ready(page, quality);
    const initial = await state(page);
    check(initial.raw.every(entry => entry.held === 0) && initial.batches.every(batch => batch.indices.every(index => index === -1)), `${label}: initial object state is clear`);
    await holdCase(page, 'voxel', `${label}-voxel`);
    // Walk through the actual delivery portal to the exposed Returns crate row.
    if (quality === 'high') await page.locator('.yard-switch').click();
    await walk(page, [-2, 22], 0.3, (await state(page)).player.portalTeleports);
    await walk(page, [6.8, -18.2]);
    if (quality === 'high') await page.locator('.yard-switch').click();
    await holdCase(page, 'crate', `${label}-crate`);
    if (mobile) {
      await page.getByLabel('Pause', { exact: true }).tap();
      await page.getByRole('button', { name: /^Leave match$/i }).tap();
      await page.getByRole('button', { name: 'Play Solo', exact: true }).tap();
    } else {
      await page.getByRole('button', { name: 'Leave Match', exact: true }).click();
      await page.getByRole('button', { name: 'Play Solo', exact: true }).click();
    }
    await page.waitForFunction(() => {
      const render = window.__WRECK_YARD_CONTROLLER__?.getRender();
      return render?.frame > 10 && render.players[0]?.portalTeleports === 0;
    }, null, { timeout: 60000 });
    const reset = await state(page);
    check(reset.player.grabbing === null && reset.raw.every(entry => entry.held === 0)
      && reset.batches.every(batch => batch.indices.every(index => index === -1)), `${label}: session reset clears all object hold state`);
    await context.close();
  }
  check(results.errors.length === 0, 'no page or shader error occurs');
  results.passed = true;
} catch (error) {
  results.passed = false;
  results.failure = String(error.stack ?? error);
  throw error;
} finally {
  try { await writeFile(join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`); }
  finally { await browser.close(); }
}
console.log(JSON.stringify({ passed: results.passed, checks: results.checks.length, cases: results.cases.map(entry => ({ label: entry.label, matched: entry.proof.matched })), errors: results.errors }, null, 2));
