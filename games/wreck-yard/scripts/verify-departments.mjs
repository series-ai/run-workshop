// Check the real yard through its development server. This script owns its browser only.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4494';
const baseline = process.argv.includes('--baseline');
const supplemental = process.argv.includes('--supplemental');
const detailsOnly = process.argv.includes('--details-only');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const root = fileURLToPath(new URL('../test-results/departments/browser/', import.meta.url));
const out = process.env.DEPARTMENT_SHOTS ?? join(root, `${baseline ? 'baseline' : 'final'}-${stamp}`);
const baselinePath = process.env.DEPARTMENT_BASELINE;
const views = [
  ['storage', [-7, 6.2, -10], [-13, 3.4, -20.7]],
  ['incoming', [5, 3.8, -7], [0.2, 4.6, -20]],
  ['claims', [13, 3, -14], [13, 3.9, -23]],
  ['roadworthy', [9, 3, -5], [14, 0, 5]],
  ['express', [8, 3, 16], [8.5, 1.2, 23]],
  ['lost-property', [-8.5, 2.5, 16.2], [-8.5, -0.3, 20.8]],
  ['impact', [-5.8, 3, 7], [-8, 1.2, 13]],
  ['assembly', [-14.5, 3, 5.5], [-21, 1.4, 6]],
  ['balance', [-9, 2.2, -2], [-14, 0.2, -6]],
  ['warranty', [-10.5, 2.8, 2.5], [-16, 0.8, 0]],
  ['float', [7.7, 2.8, 5.8], [2.95, 0.5, 0.55]],
  ['delivery', [-2, 2.1, 14], [-2, 1.34, 20]],
  ['directory', [-3, 2, 10], [0, 1, 0]],
];
const layouts = [
  { id: 'desktop1440', viewport: { width: 1440, height: 900 }, quality: 'high' },
  { id: 'mobile390', viewport: { width: 390, height: 844 }, quality: 'low', isMobile: true, hasTouch: true },
  { id: 'mobile-landscape', viewport: { width: 844, height: 390 }, quality: 'low', isMobile: true, hasTouch: true },
];
const sourceFiles = ['src/scene/departments.ts', 'src/render/YardDepartments.tsx', 'src/render/LostPropertyBelt.tsx', 'src/render/YardScene.tsx', 'src/sim/lostProperty.ts', 'src/sim/shell.ts'];
const sourceHash = createHash('sha256');
for (const file of sourceFiles) { try { sourceHash.update(file); sourceHash.update(await readFile(new URL(`../${file}`, import.meta.url))); } catch (error) { if (!baseline) throw error; } }
const source = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), files: sourceFiles, sha256: sourceHash.digest('hex'), workdir: process.cwd(), command: ['node', ...process.argv.slice(1)].join(' ') };
const report = { source, baselinePath, mode: baseline ? 'baseline' : supplemental ? 'supplemental' : detailsOnly ? 'details' : 'final', url: base, out, views, layouts, captures: [], errors: [], limits: ['Desktop Chrome uses the host GPU for phone layouts.', 'Fixed-camera captures show layout. They do not prove gameplay.'] };
await mkdir(out, { recursive: true });
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true }); } catch (error) { await writeFile(join(out, 'launch-failure.json'), JSON.stringify({ source, message: error.message }, null, 2)); throw error; }
report.browser = { engine: 'Chrome', version: browser.version(), headless: true };

async function measure(page) {
  return page.evaluate(async () => {
    const { gl, scene, camera } = window.__DEBUG_THREE__;
    const original = gl.render;
    const samples = [];
    gl.render = function (renderScene, renderCamera) {
      if (renderScene !== scene || gl.clippingPlanes.length > 0) return original.apply(this, arguments);
      const oldReset = gl.info.autoReset;
      gl.info.autoReset = false;
      const before = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
      try {
        const result = original.apply(this, arguments);
        samples.push({ calls: gl.info.render.calls - before.calls, triangles: gl.info.render.triangles - before.triangles });
        return result;
      } finally { gl.info.autoReset = oldReset; }
    };
    try {
      for (let i = 0; i < 16; i++) await new Promise(requestAnimationFrame);
    } finally { gl.render = original; }
    const median = (key) => [...samples].sort((a, b) => a[key] - b[key])[Math.floor(samples.length / 2)]?.[key];
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    return { mainCalls: median('calls'), mainTriangles: median('triangles'), samples, memory: { ...gl.info.memory }, programs: gl.info.programs.length, frame: render.frame, camera: camera.position.toArray(), bodyIds: render.bodies.map((b) => b.id).sort(), storage: render.bodies.filter((b) => b.storageBay === 'storage').length, returns: render.bodies.filter((b) => b.storageBay === 'returns').length };
  });
}

async function supplementalChecks(page) {
  const read = () => page.evaluate(() => {
    const r=window.__WRECK_YARD_CONTROLLER__.getRender();
    const p=r.players.find((entry)=>entry.slot===r.localSlot);
    return {frame:r.frame,player:p.position,grab:p.grabbing,scrap:r.poses.get('scrap-10')?.position,status:window.__WRECK_YARD_CONTROLLER__.snapshot().status};
  });
  const warm = async () => {
    for(const [,position,target] of views){
      await page.evaluate(([p,t])=>window.__SET_CAMERA_OVERRIDE__(p,t),[position,target]);
      await page.waitForTimeout(100);
    }
    return page.evaluate(()=>{
      const {scene,gl}=window.__DEBUG_THREE__;
      const roots=['yard-departments','lost-property-belt'].map((name)=>scene.getObjectByName(name));
      const geometries=new Set(), materials=new Set(), textures=new Set();
      for(const root of roots)root.traverse((object)=>{if(object.isMesh){geometries.add(object.geometry.uuid);materials.add(object.material.uuid);if(object.material.map)textures.add(object.material.map.uuid);}});
      return {owned:{geometries:geometries.size,materials:materials.size,textures:textures.size},global:{...gl.info.memory},programs:gl.info.programs.length};
    });
  };
  const cycles=[];
  for(let cycle=0;cycle<3;cycle++){
    if(cycle){
      await page.evaluate(()=>window.__WRECK_YARD_CONTROLLER__.start({kind:'solo'}));
      await page.waitForFunction(()=>(window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame??0)>=45,null,{timeout:60000});
      await page.evaluate(()=>window.__WRECK_YARD_CONTROLLER__.setPaused(true));
    }
    await warm();
    cycles.push(await warm());
  }
  assert.ok(cycles.every((cycle)=>JSON.stringify(cycle.owned)===JSON.stringify({geometries:6,materials:5,textures:1})),'Owned resources changed across solo resets.');
  assert.ok(cycles[2].global.geometries<=cycles[1].global.geometries+4 && cycles[2].global.textures<=cycles[1].global.textures+4,'Warmed global resources did not reach a short reset plateau.');
  await page.evaluate(()=>{window.__SET_CAMERA_OVERRIDE__(null);window.__WRECK_YARD_CONTROLLER__.setPaused(false);});
  const trace=[];
  const walk=async([x,z])=>{
    for(let i=0;i<48;i++){
      const state=await read();trace.push(state);
      const dx=x-state.player[0],dz=z-state.player[2];
      if(Math.hypot(dx,dz)<.55)return true;
      await page.evaluate(([a,b])=>window.__SET_LOOK_ANGLES__(Math.atan2(-a,-b),0),[dx,dz]);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(100);
    }
    return false;
  };
  const interaction={kind:'keyboard/mouse with deterministic aim hook',waypoints:[[-2,16],[-8.5,17.5]],trace,proof:'No physics setters or direct simulation input calls.'};
  try{
    await page.keyboard.press('Digit1');
    const reached=[];
    for(const waypoint of interaction.waypoints){reached.push(await walk(waypoint));await page.keyboard.up('KeyW');if(!reached.at(-1))break;}
    interaction.reached=reached;
    if(!reached.every(Boolean)) {interaction.limit='The bounded walk did not reach the belt approach.';return {cycles,interaction};}
    const state=await read();
    const [x,y,z]=state.scrap;
    const dx=x-state.player[0],dz=z-state.player[2];
    const pitch=Math.atan2(y-(state.player[1]+1.55),Math.hypot(dx,dz));
    await page.evaluate(([yaw,p])=>window.__SET_LOOK_ANGLES__(yaw,p),[Math.atan2(-dx,-dz),pitch]);
    const canvas=await page.locator('canvas').first().boundingBox();
    await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    interaction.afterGrab=await read();
    if(!interaction.afterGrab.grab){interaction.limit='The mouse grab did not acquire the nearby loose part.';return {cycles,interaction};}
    const current=interaction.afterGrab;
    const target=[-8.5,-.2,20.8];
    const bx=target[0]-current.player[0],bz=target[2]-current.player[2];
    const bp=Math.atan2(target[1]-(current.player[1]+1.55),Math.hypot(bx,bz));
    await page.evaluate(([yaw,p])=>window.__SET_LOOK_ANGLES__(yaw,p),[Math.atan2(-bx,-bz),bp]);
    await page.waitForTimeout(1300);
    interaction.beforeRelease=await read();
    await page.mouse.up();
    await page.waitForTimeout(1300);
    interaction.afterRelease=await read();
    interaction.completed=true;
    interaction.limit='The input path acquired and released a body. The native test supplies the isolated carry and replay proof.';
  } finally {await page.keyboard.up('KeyW');await page.mouse.up();}
  const path=join(out,'desktop-real-input-belt.png');
  await page.screenshot({path});interaction.path=path;
  return {cycles,interaction};
}

async function finalSceneChecks(page, layout) {
  const details = await page.evaluate(async () => {
    const catalog = await import('/src/scene/departments.ts');
    const { SHELL_BOXES } = await import('/src/sim/shell.ts');
    const { LOST_PROPERTY_BELT } = await import('/src/sim/lostProperty.ts');
    const scene = window.__DEBUG_THREE__.scene;
    const group = scene.getObjectByName('yard-departments');
    const panels = scene.getObjectByName('yard-department-panels');
    const labels = scene.getObjectByName('yard-department-floor-labels');
    const paint = scene.getObjectByName('yard-department-paint');
    const belt = scene.getObjectByName('lost-property-belt');
    const top = scene.getObjectByName('lost-property-belt-surface');
    const check = (value, message) => { if (!value) throw new Error(message); };
    check(group && panels && labels && paint && belt && top, 'Required scene objects are missing.');
    check(catalog.DEPARTMENTS.length === 12, 'The catalog must have 12 departments.');
    const mounts = catalog.DEPARTMENTS.map((department) => {
      const marker = scene.getObjectByName(`yard-department-${department.id}`);
      check(marker && JSON.stringify(marker.userData.text) === JSON.stringify([department.title, department.action, department.joke]), `Text mismatch for ${department.id}`);
      const support = SHELL_BOXES.find((box) => box.id === department.sign.mount);
      check(support, `Missing fixed mount for ${department.id}`);
      const [x,y,z] = department.sign.center;
      const [w,h] = department.sign.size;
      const [cx,cy,cz] = support.center;
      const [sx,sy,sz] = support.size;
      const normal = [Math.sin(department.sign.yaw), 0, Math.cos(department.sign.yaw)];
      const tangent = [Math.cos(department.sign.yaw), 0, -Math.sin(department.sign.yaw)];
      const corners = [-1,1].flatMap((a) => [-1,1].map((b) => [x+tangent[0]*a*w/2,y+b*h/2,z+tangent[2]*a*w/2]));
      const axis = Math.abs(normal[0]) > .5 ? 0 : 2;
      const faceGap = Math.abs([x-cx,y-cy,z-cz][axis]) - [sx,sy,sz][axis]/2;
      check(faceGap >= (support.id.startsWith('wall-') ? .08 : support.id === 'set-deck' ? .045 : -.002) && faceGap < (support.id.startsWith('wall-') ? .101 : support.id === 'set-deck' ? .065 : .035), `Panel ${department.id} does not meet its support face: ${faceGap}`);
      check(corners.every((point) => point.every((v,index) => index===axis || Math.abs(v-support.center[index]) <= support.size[index]/2+.015)), `Panel ${department.id} extends beyond its support.`);
      return { id: department.id, mount: support.id, faceGap, corners };
    });
    const atlas = panels.material.map;
    check(atlas === labels.material.map, 'Panels and floor labels do not share the atlas.');
    check(atlas.image.width === 2048 && atlas.image.height === 2048, 'Unexpected atlas dimensions.');
    const floorYs = [...labels.geometry.attributes.position.array].filter((_, index) => index % 3 === 1);
    check(floorYs.every((y) => Math.abs(y-(-.86+.012))<1e-5), 'Floor label leaves the flat terrain.');
    check(JSON.stringify(belt.userData.center)===JSON.stringify(LOST_PROPERTY_BELT.center), 'Belt center mismatch.');
    check(JSON.stringify(belt.userData.size)===JSON.stringify(LOST_PROPERTY_BELT.size), 'Belt size mismatch.');
    check(JSON.stringify(belt.userData.surfaceVelocity)===JSON.stringify([1.35,0,0]), 'Belt velocity mismatch.');
    const maxTopY = Math.max(...[...top.geometry.attributes.position.array].filter((_,index)=>index%3===1))+belt.position.y;
    check(Math.abs(maxTopY-belt.userData.topY)<1e-6, 'Drawn belt top does not match its native top.');
    const owned = [];
    group.traverse((object) => { if(object.isMesh) owned.push(object.name); });
    belt.traverse((object) => { if(object.isMesh) owned.push(object.name); });
    check(owned.length===6, 'Unexpected added mesh count.');
    return { catalog: catalog.DEPARTMENTS, directory: catalog.DEPARTMENT_DIRECTORY, mounts, ownedMeshes: owned, atlas: {name: atlas.name, width:atlas.image.width,height:atlas.image.height,data:atlas.image.toDataURL()}, belt: {...belt.userData, drawnTopY:maxTopY} };
  });
  const atlasPath = join(out, `${layout.id}-atlas.png`);
  await writeFile(atlasPath, Buffer.from(details.atlas.data.split(',')[1], 'base64'));
  delete details.atlas.data;
  details.atlas.path = atlasPath;
  details.closeups = [];
  for (const department of details.catalog) {
    const [x,y,z] = department.sign.center;
    const portrait = layout.id === 'mobile390';
    const distance = portrait ? department.sign.size[0] / (2 * Math.tan(25*Math.PI/180) * (390/844)) * 1.08 : 4.8;
    const position = [x+Math.sin(department.sign.yaw)*distance, 1.1, z+Math.cos(department.sign.yaw)*distance];
    const safePositions = portrait
      ? { claims:[16,1.1,-25], storage:[-18.4,1.1,-11.5], express:[15,1.1,15], returns:[5.5,1.1,16.5], balance:[-9,1.1,-12], warranty:[-9,1.1,7] }
      : { claims:[21,1.1,-24], balance:[-13.2,1.1,-9], warranty:[-15.6,1.1,4.8], express:[12,1.1,20], returns:[2,1.1,22] };
    if(safePositions[department.id]) position.splice(0,3,...safePositions[department.id]);
    const target = [x,y,z];
    await page.evaluate(([p,t])=>window.__SET_CAMERA_OVERRIDE__(p,t),[position,target]);
    await page.waitForTimeout(120);
    const path = join(out, `${layout.id}-panel-${department.id}.png`);
    await page.screenshot({path});
    details.closeups.push({id:department.id,position,target,distance,path});
  }
  const beltState = () => page.evaluate(()=>{
    const group=window.__DEBUG_THREE__.scene.getObjectByName('lost-property-belt');
    const mesh=window.__DEBUG_THREE__.scene.getObjectByName('lost-property-belt-surface');
    return {...group.userData,diagnosticFrame:group.userData.frame,frame:window.__WRECK_YARD_CONTROLLER__.getRender().frame,uniform:mesh.material.uniforms.travel.value,paused:window.__WRECK_YARD_CONTROLLER__.isPaused()};
  });
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const pausedBefore = await beltState();
  await page.waitForTimeout(280);
  const pausedAfter = await beltState();
  assert.equal(pausedBefore.frame,pausedAfter.frame,'Solo pause did not hold the frame.');
  assert.equal(pausedBefore.uniform,pausedAfter.uniform,'Solo pause did not hold belt phase.');
  await page.evaluate(()=>window.__WRECK_YARD_CONTROLLER__.setPaused(false));
  await page.waitForFunction((frame)=>window.__DEBUG_THREE__.scene.getObjectByName('lost-property-belt').userData.frame>frame+8,pausedAfter.frame,{timeout:10000});
  await page.evaluate(()=>window.__WRECK_YARD_CONTROLLER__.setPaused(true));
  const runningAfter=await beltState();
  assert.ok(runningAfter.frame>pausedAfter.frame);
  assert.ok(Math.abs(runningAfter.uniform-(runningAfter.frame/30*1.35)%25.3)<1e-9);
  details.motion={pausedBefore,pausedAfter,runningAfter};
  return details;
}

try {
  for (const layout of layouts) {
    if (supplemental && layout.id !== 'desktop1440') continue;
    const context = await browser.newContext({ viewport: layout.viewport, deviceScaleFactor: 1, isMobile: layout.isMobile ?? false, hasTouch: layout.hasTouch ?? false });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ layout: layout.id, kind: 'pageerror', message: error.message }));
    page.on('console', (message) => { if (message.type() === 'error' && /shader|webgl|THREE/i.test(message.text())) report.errors.push({ layout: layout.id, kind: 'console', message: message.text() }); });
    await page.goto(`${base}/?quality=${layout.quality}&capture=off`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) >= 45 && window.__SET_CAMERA_OVERRIDE__, null, { timeout: 60000 });
    await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
    for (const [id, position, target] of (supplemental || detailsOnly) ? [] : views) {
      await page.evaluate(([p, t]) => window.__SET_CAMERA_OVERRIDE__(p, t), [position, target]);
      await page.waitForTimeout(200);
      const metrics = await measure(page);
      assert.ok(Number.isFinite(metrics.mainCalls) && metrics.mainCalls > 0, `No main-scene samples at ${layout.id}/${id}`);
      assert.equal(metrics.storage, 400);
      assert.equal(metrics.returns, 36);
      const screenshot = join(out, `${layout.id}-${id}.png`);
      await page.screenshot({ path: screenshot, animations: 'disabled' });
      report.captures.push({ layout: layout.id, id, position, target, screenshot, ...metrics });
    }
    report[`${layout.id}-hud`] = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, controls: [...document.querySelectorAll('.yard-touch button, .yard-toolbar button')].filter((node) => node.getBoundingClientRect().width > 0).map((node) => ({ label: node.getAttribute('aria-label') ?? node.textContent, x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })) }));
    if (!baseline && !supplemental && !detailsOnly) report[`${layout.id}-scene`] = await finalSceneChecks(page, layout);
    if (supplemental) report.supplemental = await supplementalChecks(page);
    if (detailsOnly) {
      const {DEPARTMENTS}=await page.evaluate(async()=>{const c=await import('/src/scene/departments.ts');return {DEPARTMENTS:c.DEPARTMENTS};});
      const warranty=DEPARTMENTS.find((entry)=>entry.id==='warranty');
      const portrait=layout.id==='mobile390';
      const details=[['warranty-north',portrait?[-9,1.1,-7]:[-15.6,1.1,-4.8],warranty.sign.center],['incoming-floor',portrait?[-.2,6.8,-8.5]:[-.2,1.1,-7.8],[-.2,-.848,-11]]];
      report[`${layout.id}-details`]=[];
      for(const [id,position,target] of details){
        await page.evaluate(([p,t])=>window.__SET_CAMERA_OVERRIDE__(p,t),[position,target]);
        await page.waitForTimeout(200);
        const path=join(out,`${layout.id}-${id}.png`);
        await page.screenshot({path});
        report[`${layout.id}-details`].push({id,position,target,path});
      }
    }
    await context.close();
  }
  for (const layout of layouts) {
    if (supplemental && layout.id !== 'desktop1440') continue;
    const hud=report[`${layout.id}-hud`];
    assert.ok(hud.scroll.width<=hud.viewport.width, `${layout.id} has horizontal overflow.`);
    assert.ok(hud.controls.every((box)=>box.x>=-.5 && box.y>=-.5 && box.x+box.width<=hud.viewport.width+.5 && box.y+box.height<=hud.viewport.height+.5), `${layout.id} has a control outside the viewport.`);
  }
  assert.deepEqual(report.errors, []);
  if (!baseline && !supplemental && !detailsOnly) {
    assert.ok(baselinePath, 'Set DEPARTMENT_BASELINE to a saved baseline results.json.');
    const before = JSON.parse(await readFile(baselinePath, 'utf8'));
    report.comparison = report.captures.map((capture) => {
      const previous = before.captures.find((entry) => entry.layout === capture.layout && entry.id === capture.id);
      assert.ok(previous, `No baseline for ${capture.layout}/${capture.id}`);
      assert.deepEqual(capture.bodyIds, previous.bodyIds, 'Initial dynamic bodies changed.');
      const extra = capture.mainCalls - previous.mainCalls;
      assert.ok(extra <= 12, `${capture.layout}/${capture.id} adds ${extra} main-scene calls.`);
      return { layout: capture.layout, id: capture.id, before: previous.mainCalls, after: capture.mainCalls, extra };
    });
  }
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  await writeFile(join(out, 'results.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ out, passed: report.passed, captures: report.captures.length, failure: report.failure?.message }));
}
