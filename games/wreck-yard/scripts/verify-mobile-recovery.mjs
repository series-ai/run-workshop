// Use real Chrome touch events. Read app state without changing simulation state.
import assert from 'node:assert/strict';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const args = process.argv.slice(2);
const value = name => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1) ?? args[args.indexOf(name) + 1];
const phase = args.includes('--capture-ui') ? 'capture' : args.includes('--phase') || args.some(arg => arg.startsWith('--phase=')) ? value('--phase') : 'input';
assert.ok(['input', 'torch', 'protocol', 'capture'].includes(phase), '--phase must be input, torch, protocol, or capture');
const landscape = args.includes('--landscape');
const webkitTaps = args.includes('--webkit');
const only = args.includes('--only') || args.some(arg => arg.startsWith('--only=')) ? value('--only').split(',') : [];
const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4490';
const out = process.env.MOBILE_REPAIR_OUT ?? process.env.MOBILE_RECOVERY_OUT ?? `test-results/mobile-recovery/${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(out, { recursive: true });
const result = { started: new Date().toISOString(), base, phase, landscape, only, webkitTaps, actions: [], checks: [], segments: [], errors: [], passed: false,
  limits: [webkitTaps ? 'The current WebKit check uses complete native touchscreen taps only.' : 'All movement and tool controls use CDP touch. The existing look hook sets route aim only.',
    'Desktop Chrome touch emulation does not prove physical-phone behavior.',
    'Input correctness runs may overlap native correctness tests. Their timings are observations only.',
    'CPU phases can be inclusive. Do not add sim.nativeStep to its step/latest subphases. Public native API time is not pure solver time.',
    'Touch owners and raw keyboard state are read from React refs. This is read-only harness inspection, not a public app diagnostic.',
    'The harness reads the controller runner handle. Network records use public SDK snapshot fields.',
    'A lost-capture case calls the DOM capture-release API on a real active touch. It does not dispatch a fake pointer event.'] };
let browser, page, cdp, activeSegment;
const fingers = new Map();
const timeline = [];
const save = () => writeFile(join(out, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
const record = async (name, detail = {}) => {
  const entry = { at: new Date().toISOString(), name, ...detail };
  result.actions.push(entry); await appendFile(join(out, 'actions.ndjson'), `${JSON.stringify(entry)}\n`); await save();
};
const check = (condition, name, evidence) => { result.checks.push({ name, passed: Boolean(condition), evidence }); };

async function install() {
  await page.evaluate(async()=>{
    const entry=performance.getEntriesByType('resource').find(entry=>entry.name.includes('/@react-three_fiber.js'));
    if(entry)window.__MOBILE_RECOVERY_ROOTS__=(await import(entry.name))._roots;
  });
  await page.evaluate(() => {
    const label = target => target instanceof Element ? target.closest('[aria-label]')?.getAttribute('aria-label') ?? target.tagName : 'window';
    const refs = () => {
      const element = document.querySelector('.yard-touch');
      const key = element && Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      let fiber = key ? element[key] : null;
      while (fiber && fiber.type?.name !== 'TouchControls') fiber = fiber.return;
      const input = fiber?.memoizedProps.input?.current;
      const refs = []; for (let hook = fiber?.memoizedState; hook; hook = hook.next) if (hook.memoizedState?.current !== undefined) refs.push(hook.memoizedState.current);
      const gestures = refs.find(ref => ref instanceof Map);
      const stick = refs.find(ref => typeof ref?.anchored === 'function' && typeof ref?.vector === 'function');
      let root = window.__MOBILE_RECOVERY_ROOTS__?.get(document.querySelector('canvas'))?.fiber?.current;
      let keySet = null;
      const visit = node => {
        if (!node || keySet) return;
        if (node.type?.name === 'PointerInput') for (let hook = node.memoizedState; hook; hook = hook.next) if (hook.memoizedState?.current instanceof Set) keySet = [...hook.memoizedState.current];
        visit(node.child); visit(node.sibling);
      };
      visit(root);
      return { input: input ? { moveX: input.moveX, moveZ: input.moveZ, primary: input.primary, cutQueued: input.cutQueued,
        jetpack: input.jetpack, use: input.use, weapon: input.weapon, dropQueued: input.dropQueued, lookX: input.lookX, lookY: input.lookY } : null,
        gestures: gestures ? [...gestures].map(([id, gesture]) => ({ id, kind: gesture.kind, target: label(gesture.target), capture: gesture.target.hasPointerCapture(id) })) : null,
        stick: stick ? { anchored: stick.anchored('left'), vector: stick.vector('left') } : null, keys: keySet };
    };
    const rect = selector => { const node=document.querySelector(selector);if(!node)return null;const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,touchAction:getComputedStyle(node).touchAction}; };
    const state = () => {
      const controller = window.__WRECK_YARD_CONTROLLER__, render = controller?.getRender();
      const player = render?.players.find(entry => entry.slot === render.localSlot), camera = window.__DEBUG_THREE__?.camera;
      const viewport = visualViewport, runner = controller?.runner;
      return { atMs: performance.now(), timeOrigin: performance.timeOrigin, frame: render?.frame, status: controller?.snapshot().status, paused: controller?.isPaused(),
        netcode: runner ? { status: runner.status, lifecycle: runner.lifecycle.state, connection: runner.lifecycle.connection ?? null,
          ready: runner.ready, appliedThrough: runner.appliedThrough, predictedThrough: runner.predictedThrough, netStats: runner.netStats } : null,
        input: controller ? { ...controller.input } : null, player: player ? { position: player.position, yaw: player.yaw, pitch: player.pitch,
          grabbing: player.grabbing, portalTeleports: player.portalTeleports, activeTool: player.activeTool, feedback: player.feedback } : null,
        stats: render?.stats, bodyCount: render?.bodies.length,
        storageBodies: render?.bodies.filter(body=>body.storageBay==='storage').length,
        wholeShippingCrates: render?.bodies.filter(body=>body.renderModel==='shipping-crate').length,
        camera: camera ? { fov: camera.fov, zoom: camera.zoom, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.elements.slice() } : null,
        viewport: { innerWidth, innerHeight, width: viewport?.width, height: viewport?.height, scale: viewport?.scale,
          offsetLeft: viewport?.offsetLeft, offsetTop: viewport?.offsetTop, orientation: screen.orientation?.type },
        hud:{pause:rect('[aria-label="Pause"]'),primary:rect('.yard-touch-action--main'),move:rect('.yard-touch-stick')},touch: refs() };
    };
    const audit = { events: [], samples: [], heap: [], state, beginMs: performance.now(), focus: { blur: 0, hidden: 0 } };
    window.__MOBILE_RECOVERY__ = audit;
    let previousRunnerStatus;
    window.__WRECK_YARD_CONTROLLER__?.runner?.subscribe(snapshot => {
      const signature = `${snapshot.status}:${snapshot.connection}:${snapshot.ready}:${snapshot.netStats?.recoveryPhase}`;
      if (signature === previousRunnerStatus) return;
      previousRunnerStatus = signature;
      audit.events.push({ type: 'syncplay-status', atMs: performance.now(), status: snapshot.status, connection: snapshot.connection,
        ready: snapshot.ready, appliedThrough: snapshot.appliedThrough, predictedThrough: snapshot.predictedThrough,
        rollbackCount: snapshot.rollbackCount, netStats: snapshot.netStats ? structuredClone(snapshot.netStats) : null,
        error: snapshot.error ? { message: snapshot.error.message, code: snapshot.error.code } : null });
    });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keyup']) {
      document.addEventListener(type, event => {
        const entry = { atMs: performance.now(), type, target: label(event.target), pointerId: event.pointerId, pointerType: event.pointerType,
          controlText:event.target instanceof Element?event.target.closest('button,summary')?.textContent?.trim():undefined,
          primary: event.isPrimary, trusted: event.isTrusted, x: event.clientX, y: event.clientY, buttons: event.buttons, code: event.code,
          touches: event.touches ? [...event.touches].map(touch => ({ id: touch.identifier, x: touch.clientX, y: touch.clientY })) : undefined,
          changed: event.changedTouches ? [...event.changedTouches].map(touch => ({ id: touch.identifier, x: touch.clientX, y: touch.clientY })) : undefined };
        audit.events.push(entry);
        queueMicrotask(() => { entry.prevented = event.defaultPrevented; entry.after = { frame: window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame, touch: refs() }; });
      }, { capture: true, passive: true });
    }
    window.addEventListener('blur', () => { audit.focus.blur++; audit.events.push({ type: 'blur', atMs: performance.now() }); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) audit.focus.hidden++; audit.events.push({ type: 'visibilitychange', hidden: document.hidden, atMs: performance.now() }); });
    visualViewport?.addEventListener('resize', () => audit.events.push({ type: 'viewport-resize', atMs: performance.now(), scale: visualViewport.scale, width: visualViewport.width, height: visualViewport.height }));
    const renderer = window.__DEBUG_THREE__.gl, original = renderer.render;
    renderer.render = function (scene, camera) {
      const value = original.call(this, scene, camera);
      if (scene.children?.[0]?.material?.name === 'yard-ink-composite') {
        const controller = window.__WRECK_YARD_CONTROLLER__, render = controller.getRender(), camera = window.__DEBUG_THREE__.camera;
        const player = render?.players.find(entry => entry.slot === render.localSlot);
        audit.samples.push({ atMs: performance.now(), frame: render?.frame, pressed: controller.input.pressed, tool: controller.input.tool,
          moveX: controller.input.moveX, moveZ: controller.input.moveZ, grabbing: player?.grabbing, yaw: player?.yaw, pitch: player?.pitch,
          fov: camera.fov, zoom: camera.zoom, scale: visualViewport?.scale, torchCuts: render?.stats.torchCuts, bodyCount: render?.bodies.length });
        if (audit.samples.length > 15000) audit.samples.shift();
        const second=Math.floor(performance.now()/1000);
        if(second!==audit.lastHeapSecond){audit.lastHeapSecond=second;audit.heap.push({atMs:performance.now(),usedBytes:performance.memory?.usedJSHeapSize??null,
          totalBytes:performance.memory?.totalJSHeapSize??null,wasmBytes:window.__WRECK_WASM_MEMORY_BYTES__?.()??null});}
      }
      return value;
    };
  });
}
async function read() {
  const state = await page.evaluate(() => window.__MOBILE_RECOVERY__.state());
  if (state.status === 'error' || !state.player?.position.every(Number.isFinite) || result.errors.length) {
    const error = new Error('Engine or browser fault.'); error.engineFault = true; error.evidence = state; throw error;
  }
  return state;
}
async function wait(ms = 140) { await page.waitForTimeout(ms); return read(); }
async function frames(count = 4) {
  const first = await read(), end = Date.now() + 12000;
  let state = first;
  while (Date.now() < end && state.frame < first.frame + count) state = await wait(60);
  assert.ok(state.frame >= first.frame + count, 'Simulation frame progress stopped.'); return state;
}
async function point(label) {
  const locator = label === 'Move pad' ? page.locator('.yard-touch-stick') : label === 'Primary action' ? page.locator('.yard-touch-action--main') : ['Pause','Resume'].includes(label) ? page.getByRole('button',{name:label,exact:true}) : page.getByLabel(label, { exact: true });
  const rect = await locator.boundingBox(); assert.ok(rect, `${label} is missing.`);
  return { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * (label === 'Look pad' ? 0.2 : 0.5) };
}
async function send(type, points, detail) {
  await record('touch-command', { type, points, detail, before: await read() });
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}
async function down(label, id, position) { const p = position ?? await point(label); fingers.set(id, { ...p, id }); await send('touchStart', [...fingers.values()], { label, id }); }
async function move(id, dx, dy) { const p = fingers.get(id); assert.ok(p, `Touch ${id} is absent.`); p.x += dx; p.y += dy; await send('touchMove', [...fingers.values()], { id, dx, dy }); }
async function up(id, settleMs = 140) {
  const p = fingers.get(id); assert.ok(p, `Touch ${id} is absent.`); fingers.delete(id);
  // Chrome delivers this listed changed point as the released touch. The first
  // phase verifies the actual pointerup target before the app checks run.
  await send('touchEnd', [p], { id, remaining: [...fingers.keys()] }); if (settleMs) await wait(settleMs);
}
async function cancel() { fingers.clear(); await send('touchCancel', [], {}); await wait(); }
async function tap(label, id = 99) { await down(label, id); await wait(80); await up(id); if (!(await read()).paused) await frames(2); }
async function shot(name) { const path = join(out, `${name}.png`); await page.screenshot({ path, timeout: 15000 }); return path; }
async function neutral(name) {
  const state = await frames(3);
  check(state.input.moveX === 0 && state.input.moveZ === 0 && !state.input.jetpack && !state.input.use, name, state);
  return state;
}
async function fresh() {
  fingers.clear();
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DEBUG_THREE__ && window.__SET_LOOK_ANGLES__ && window.__WRECK_YARD_PERF__
    && (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35, null, { timeout: 90000 });
  await page.getByLabel('Move pad', { exact: true }).waitFor(); await install();
}
function oneSecondTimeline(name, report, data, timeOrigin) {
  const bins=new Map();
  const get=at=>{const second=Math.floor((at-report.startedAtMs)/1000);if(second<0)return null;
    if(!bins.has(second))bins.set(second,{phase:name,timeOrigin,startMs:report.startedAtMs+second*1000,endMs:report.startedAtMs+(second+1)*1000,cpu:{},gpu:{},counters:{},frames:{count:0,pressed:0,moving:0},heap:null});return bins.get(second);};
  const add=(group,label,value)=>{const entry=group[label]??={count:0,total:0,min:value,max:value,last:value};entry.count++;entry.total+=value;entry.min=Math.min(entry.min,value);entry.max=Math.max(entry.max,value);entry.last=value;};
  for(const r of report.records){const bin=get(r.timestampMs);if(!bin)continue;if(r.kind==='phase')add(bin.cpu,r.label,r.durationMs);if(r.kind==='counter')add(bin.counters,r.label,r.value);}
  for(const r of report.gpu.records){if(r.status==='valid'&&Number.isFinite(r.durationMs)){const bin=get(r.startedAtMs);if(bin)add(bin.gpu,r.phase,r.durationMs);}}
  for(const s of data.samples){if(s.atMs<report.startedAtMs||s.atMs>report.stoppedAtMs)continue;const bin=get(s.atMs);if(!bin)continue;bin.frames.count++;bin.frames.pressed+=Number(s.pressed);bin.frames.moving+=Number(s.moveX!==0||s.moveZ!==0);bin.frames.last=s;}
  for(const s of data.heap??[]){if(s.atMs<report.startedAtMs||s.atMs>report.stoppedAtMs)continue;const bin=get(s.atMs);if(bin)bin.heap=s;}
  for(const bin of bins.values())for(const group of [bin.cpu,bin.gpu,bin.counters])for(const v of Object.values(group))v.mean=v.total/v.count;
  return {source:report.timeline?'native full timeline plus retained raw/GPU/frame detail':'retained raw/GPU/frame detail',nativeTimeline:report.timeline??null,
    overwrittenRecords:report.overwrittenRecords,gpuOverwrittenRecords:report.gpu.overwrittenRecords,bins:[...bins.values()]};
}
async function test(name, work, reload = true) {
  if(only.length&&!only.includes(name)&&name!=='protocol-partial-release')return;
  if (reload) await fresh();
  activeSegment = name;
  const before = await read(), checkStart = result.checks.length;
  await record('phase-start', { phase: name, before });
  await page.evaluate(() => window.__WRECK_YARD_PERF__.start({ capacity: 65536, maxDurationMs: 60000 }));
  let details, error;
  try { details = await work(before); }
  catch (cause) { error = cause; }
  finally {
    const report = await page.evaluate(() => window.__WRECK_YARD_PERF__.stop()).catch(() => null);
    const data = await page.evaluate(() => ({ events: window.__MOBILE_RECOVERY__.events, samples: window.__MOBILE_RECOVERY__.samples, heap:window.__MOBILE_RECOVERY__.heap })).catch(() => null);
    const after = await read().catch(() => null);
    await writeFile(join(out, `${name}-events.json`), JSON.stringify(data, null, 2));
    if (report) await writeFile(join(out, `${name}-perf.json`), JSON.stringify(report, null, 2));
    if(report&&data){const bins=oneSecondTimeline(name,report,data,before.timeOrigin);timeline.push(...bins.bins);await writeFile(join(out,`${name}-timeline.json`),JSON.stringify(bins,null,2));}
    result.segments.push({ name, passed: !error && result.checks.slice(checkStart).every(entry => entry.passed), before, after, details,
      error: error ? String(error.stack ?? error) : undefined, evidence: error?.evidence,
      performance: report ? { phaseSummary: report.phaseSummary, gpuPhaseSummary: report.gpuPhaseSummary, counterSummary: report.counterSummary,
        elapsedMs: report.elapsedMs, overwrittenRecords: report.overwrittenRecords, jsHeap: report.jsHeap, wasmMemory: report.wasmMemory,
        webglResources: report.webglResources,timeline:report.timeline??null,gpuOverwrittenRecords:report.gpu.overwrittenRecords } : null, screenshot: await shot(name).catch(() => null) });
    await record('phase-end', { phase: name, passed: result.segments.at(-1).passed });
    if (fingers.size) await cancel().catch(() => {});
  }
  if (error?.engineFault) throw error;
}
async function aimAt(position) {
  const { camera } = await read();
  const delta = position.map((v, axis) => v - camera.position[axis]);
  const yaw = Math.atan2(-delta[0], -delta[2]), pitch = Math.atan2(delta[1], Math.hypot(delta[0], delta[2]));
  await record('aim-hook', { position, yaw, pitch });
  await page.evaluate(([yaw, pitch]) => window.__SET_LOOK_ANGLES__(yaw, pitch), [yaw, pitch]); await frames(2);
}
async function target(storage = false, id = null) {
  return page.evaluate(({storage,id}) => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender(), player = render.players.find(p => p.slot === render.localSlot);
    return render.bodies.filter(b => b.motion === 'dynamic' && b.id !== 'vehicle-chassis' && (storage ? b.storageBay === 'storage' : !b.storageBay) && (!id||b.id===id))
      .map(b => ({ id: b.id, position: render.poses.get(b.id)?.position, dims: b.dims, count: b.voxels.reduce((n,v) => n + Number(v !== 0), 0) }))
      .filter(b => b.position).sort((a,b) => Math.hypot(...a.position.map((v,i)=>v-player.position[i]))-Math.hypot(...b.position.map((v,i)=>v-player.position[i])))[0];
  }, {storage,id});
}
async function walkTo(goal, radius = 0.6, counter = null) {
  await down('Move pad', 70); await move(70, 0, -40);
  const deadline = Date.now() + 40000;
  try {
    while (Date.now() < deadline) {
      const state = await read(), p = state.player.position;
      if (counter !== null && state.player.portalTeleports > counter || counter === null && Math.hypot(goal[0]-p[0],goal[1]-p[2]) < radius) return state;
      await page.evaluate(([x,z]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x,-z),0), [goal[0]-p[0],goal[1]-p[2]]);
      await page.waitForTimeout(120);
    }
    throw new Error('The real touch route did not reach its target.');
  } finally { await up(70); }
}
async function touchElement(locator,id){
  let box=await locator.boundingBox();assert.ok(box,'The UI control is missing.');
  for(let attempt=0;attempt<5;attempt++){
    const size=page.viewportSize();if(box.y>=10&&box.y+box.height<=size.height-10)break;
    const panel=await page.locator('.yard-plate--paused').boundingBox();const x=(panel?.x??20)+5;
    const direction=box.y<10?1:-1;await down('capture-scroll',301,{x,y:direction>0?80:size.height-55});
    for(let step=0;step<5;step++)await move(301,0,direction*30);await up(301);await wait(200);box=await locator.boundingBox();
    await record('capture-scroll-result',{attempt,box});
  }
  const size=page.viewportSize();assert.ok(box.y>=0&&box.y+box.height<=size.height,'The capture control is not reachable after real touch scrolling.');
  await down('capture-ui-control',id,{x:box.x+box.width/2,y:box.y+box.height/2});await page.waitForTimeout(60);await up(id);
}
async function captureUI(){
  await fresh();activeSegment='capture-ui';const requests=[];
  const watch=request=>{const body=request.postData()??'';if(request.method()!=='GET')requests.push({method:request.method(),pathname:new URL(request.url()).pathname,
    performancePayload:/"phaseSummary"|"gpuPhaseSummary"|"overwrittenRecords"/.test(body)});};page.on('request',watch);
  const before=await read();await record('capture-ui-start',{before});
  try{
    await walkTo([-3,4],0.5);const body=await target(false,'ballast-box');await aimAt(body.position);await tap('Equip torch');
    await tap('Pause');assert.ok((await read()).paused,'The primary Pause tap must stop play.');
    await touchElement(page.locator('.yard-performance > summary'),201);
    const initial=await page.evaluate(()=>window.__WRECK_YARD_PERF__.status());
    check(!initial.active&&initial.totalRecords===0,'Capture UI starts with an empty recorder',initial);
    await touchElement(page.getByRole('button',{name:'Record performance',exact:true}),202);
    const recording=await page.evaluate(()=>window.__WRECK_YARD_PERF__.status());
    check(recording.active,'Record performance starts the recorder through actual touch',recording);
    const contextStart=await page.evaluate(()=>({userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,
      viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,scale:visualViewport?.scale??1}}));
    result.captureGeometry=await page.locator('.yard-plate--paused').evaluate(panel=>({panel:(()=>{const r=panel.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})(),
      scroll:(()=>{const gate=panel.closest('.yard-gate');return gate?{height:gate.clientHeight,contentHeight:gate.scrollHeight,overflowY:getComputedStyle(gate).overflowY}:null;})(),viewportWidth:innerWidth,
      controls:[...panel.querySelectorAll('button,summary')].filter(node=>node.getBoundingClientRect().width>0).map(node=>{const r=node.getBoundingClientRect();return{text:node.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,fullyVisible:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};})}));
    check(result.captureGeometry.controls.every(control=>control.width<=result.captureGeometry.viewportWidth)&&(result.captureGeometry.controls.every(control=>control.fullyVisible)
      ||result.captureGeometry.scroll?.contentHeight>result.captureGeometry.scroll?.height&&result.captureGeometry.scroll?.overflowY==='auto'),
      'Expanded capture controls fit the viewport or its native vertical scroll area',result.captureGeometry);
    await shot('capture-recording');await touchElement(page.getByRole('button',{name:'Resume',exact:true}),207);await frames(3);
    const cuttingBefore=await read();await down('Cut',203);await frames(8);await up(203);const released=await frames(3);
    check(released.stats.torchCuts>cuttingBefore.stats.torchCuts,'The UI recording includes a real touch cut',{cuttingBefore,released});
    const releaseMs=await page.evaluate(()=>window.__MOBILE_RECOVERY__.events.filter(e=>e.type==='pointerup'&&e.target==='Cut').at(-1).atMs);
    await wait(10000);await tap('Pause');await touchElement(page.locator('.yard-performance > summary'),204);
    await touchElement(page.getByRole('button',{name:'Stop recording',exact:true}),205);
    const stopped=await page.evaluate(()=>window.__WRECK_YARD_PERF__.status());check(!stopped.active,'Stop recording ends capture through actual touch',stopped);
    const viewportAtExport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,scale:visualViewport?.scale??1}));
    result.shareCapabilities=await page.evaluate(()=>({share:typeof navigator.share,canShare:typeof navigator.canShare,
      canShareJson:navigator.canShare?.({files:[new File(['{}'],'test.json',{type:'application/json'})]})??false}));
    const downloading=page.waitForEvent('download',{timeout:15000});await touchElement(page.getByRole('button',{name:'Save report',exact:true}),206);
    const download=await downloading;const file=join(out,'capture-report.json');await download.saveAs(file);const report=JSON.parse(await readFile(file,'utf8'));
    await page.waitForFunction(()=>document.querySelector('.yard-performance [role="status"]')?.textContent.includes('Report ready.'),null,{timeout:5000});
    const savedStatus=await page.locator('.yard-performance [role="status"]').innerText();
    const end=report.startedAtMs+(report.timeline?.bins.at(-1)?.endOffsetMs??0);
    check(report.schemaVersion===1&&report.timeline?.binDurationMs===1000&&report.timeline.bins.length>0,'Saved report retains usable one-second timeline and schema',
      {schemaVersion:report.schemaVersion,timelineBins:report.timeline?.bins.length});
    const identity=JSON.parse(await readFile(new URL('../src/sim/identity.generated.json',import.meta.url),'utf8')).runtimeIdentity;
    const captureContext=report.context;
    const contextKeys=['capturedAt','deterministicVersion','engineIdentityHash','hardwareConcurrency','userAgent','viewportAtStart','viewportAtExport'];
    check(captureContext&&JSON.stringify(Object.keys(captureContext).sort())===JSON.stringify(contextKeys.sort())
      &&Number.isFinite(Date.parse(captureContext.capturedAt))&&Date.parse(captureContext.capturedAt)<=Date.now()
      &&captureContext.deterministicVersion===identity.deterministicVersion&&captureContext.engineIdentityHash===identity.engineIdentityHash
      &&captureContext.userAgent===contextStart.userAgent&&captureContext.hardwareConcurrency===contextStart.hardwareConcurrency
      &&JSON.stringify(captureContext.viewportAtStart)===JSON.stringify(contextStart.viewport)
      &&JSON.stringify(captureContext.viewportAtExport)===JSON.stringify(viewportAtExport),
      'The downloaded schema1 report has exact browser and identity context without URL fields',{captureContext,expected:{...contextStart,viewportAtExport,identity}});
    check(end-releaseMs>=9000,'Saved report includes at least nine seconds after Cut release',{end,releaseMs,postReleaseMs:end-releaseMs});
    check(!requests.some(request=>request.performancePayload),'Saving the report sends no observed performance payload to a service',requests);
    await shot('capture-saved');result.captureUI={before,body,recording,stopped,releaseMs,postReleaseMs:end-releaseMs,reportFile:file,savedStatus,captureContext,
      report:{elapsedMs:report.elapsedMs,recordCount:report.recordCount,overwrittenRecords:report.overwrittenRecords,timelineBins:report.timeline?.bins.length},requests};
  }finally{page.off('request',watch);await record('capture-ui-end',{after:await read()});}
}

try {
  browser = webkitTaps?await webkit.launch({headless:true}):await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-precise-memory-info'] });
  const context = await browser.newContext({ viewport: landscape ? { width: 844, height: 390 } : { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    userAgent: webkitTaps?'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  page = await context.newPage(); cdp = webkitTaps?null:await context.newCDPSession(page);
  result.browser = { engine: webkitTaps?'webkit':'chromium', version: browser.version(), hostOS: process.platform,
    emulation:webkitTaps?'iPhone iOS17 user-agent and viewport in current desktop WebKit. This is not iOS17.':'Android touch user agent, desktop Chrome engine',exactIOS17Available:false };
  page.on('pageerror', error => result.errors.push({ phase: activeSegment, kind: 'page', message: error.message }));
  page.on('console', message => { if (message.type() === 'error' && /shader|webgl|compile|KINETIX|runtime.*failed/i.test(message.text())) result.errors.push({ phase: activeSegment, kind: 'shader-or-session', message: message.text() }); });
  if(webkitTaps){
    result.limits.push('Current desktop WebKit exposes native complete taps only. It cannot run this CDP multi-touch, partial-release, pinch, or held-Cut protocol. It does not validate iOS17 native gestures.');
    await test('webkit-native-tap-scale',async before=>{
      const p=await point('Primary action');
      for(let n=0;n<4;n++){await record('webkit-native-tap',{point:p});await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(70);}
      const tapped=await read();check(before.viewport.scale===tapped.viewport.scale&&before.camera.fov===tapped.camera.fov&&before.camera.zoom===tapped.camera.zoom,
        'Current WebKit native primary taps retain browser and camera scale',{before,tapped});
      const pause=await point('Pause');await page.touchscreen.tap(pause.x,pause.y);await wait(250);const paused=await read();
      check(paused.paused,'Current WebKit native Pause tap stops play',paused);
      if(paused.paused){const p=await point('Resume');await page.touchscreen.tap(p.x,p.y);await frames(4);}
      const after=await read();return {before,tapped,paused,after};
    });
  }else if(phase==='capture'){
    await captureUI();
  }else{
  await test('protocol-partial-release', async () => {
    await down('Move pad', 11); await move(11, 0, -40); await down('Jet', 12); await frames(3);
    const held = await read(); await up(11); await frames(3);
    const events = await page.evaluate(() => window.__MOBILE_RECOVERY__.events.filter(e => e.type === 'pointerup' || e.type === 'touchend'));
    const expected = events.some(e => e.type === 'pointerup' && e.target === 'Move pad');
    check(expected, 'CDP partial release delivers pointerup to the removed Move pad touch', events);
    if (!expected) throw new Error('CDP partial release calibration failed. Do not grade app release behavior.');
    const after = await read(); check(after.input.moveX === 0 && after.input.moveZ === 0 && after.input.jetpack, 'Move ends while the independent Jet touch remains active', { held, after });
    await up(12); await neutral('All touches clear after both protocol fingers lift'); return { events };
  });
  assert.ok(result.segments[0].passed, 'Touch protocol calibration must pass before app checks.');
  if (phase === 'input') {
    for (const reverse of [false, true]) await test(`move-grab-release-${reverse ? 'grab-first' : 'move-first'}`, async before => {
      await walkTo([-3,4],0.5);const candidate = await target(false,'ballast-box'); await aimAt(candidate.position);
      await down('Move pad', 21); await move(21, 0, -35); await frames(3); await aimAt(candidate.position);
      await down('Grab', 22); await frames(5); const held = await read();
      check(Boolean(held.player.grabbing), 'Real touch Grab acquires a prop while Move is held', held);
      await up(reverse ? 22 : 21); const partial = await frames(4);
      check(reverse ? partial.input.moveZ !== 0 : partial.input.moveX === 0 && partial.input.moveZ === 0,
        reverse ? 'Move stays active after the Grab finger lifts' : 'Move clears after its finger lifts while Grab stays down', partial);
      if (!reverse) { await move(22, 30, 0); await frames(3); }
      await up(reverse ? 21 : 22); const released = await neutral('Movement clears after both Move and Grab fingers lift');
      check(Math.abs(released.camera.fov-before.camera.fov)<1e-6 && Math.abs(released.camera.zoom-before.camera.zoom)<1e-6 && Math.abs(released.viewport.scale-before.viewport.scale)<1e-6,
        'Grab sequence retains camera FOV, camera zoom, and browser scale', { before, held, released });
      await down('Move pad', 23); await move(23, 25, -30); await frames(3); await up(23); await neutral('A new Move finger can acquire and release after Grab');
      return { candidate, held, partial, released };
    });
    await test('move-release-outside', async () => {
      await down('Move pad', 31); await move(31, 220, -350); await frames(3); const moving = await read();
      await up(31); return { moving, released: await neutral('Move clears after release outside its original pad') };
    });
    await test('touch-cancel', async () => {
      await down('Move pad', 41); await move(41, 0, -40); await down('Grab', 42); await frames(4); await cancel();
      const after = await neutral('Touch cancel clears Move and action input'); check(!after.input.pressed, 'Touch cancel stops the primary action', after); return after;
    });
    await test('lost-capture', async () => {
      await down('Move pad', 51); await move(51, 0, -40); await frames(3);
      const owner = (await read()).touch.gestures?.find(g => g.kind === 'move'); assert.ok(owner, 'Move owner ref is readable.');
      await record('release-pointer-capture', { pointerId: owner.id, method: 'DOM API on actual CDP touch' });
      await page.evaluate(id => document.querySelector('[aria-label="Move pad"]').releasePointerCapture(id), owner.id);
      await move(51, 1, 0); const after = await neutral('Lost pointer capture clears the Move owner'); await up(51); return { owner, after };
    });
    await test('move-cut-tool-change', async () => {
      await tap('Equip torch'); await down('Move pad', 61); await move(61, 0, -35); await down('Cut', 62); await move(62, -70, -30); await frames(8);
      const held = await read(); check(held.input.moveZ!==0 && held.input.pressed && held.input.tool===1, 'Independent Move and Cut fingers remain active', held);
      await tap('Equip gravity gun', 63); const switched=await frames(4); check(switched.input.moveZ!==0 && !switched.input.pressed && switched.input.tool===0, 'Tool change clears Cut while Move keeps its owner', switched);
      await up(62); await up(61); await neutral('Move clears after a tool change'); return { held, switched };
    });
    await test('move-look-pinch-grab', async before => {
      const candidate = await target(); await aimAt(candidate.position);
      await down('Move pad', 71); await down('Grab', 72); await frames(4);
      await move(71, -25, -65); await move(72, 45, 30); await frames(5); const spread=await read();
      await up(71); await up(72); await neutral('Two-finger spread does not retain movement');
      if ((await read()).player.grabbing) await tap('Drop',73);
      for(let i=0;i<3;i++){ await tap('Grab',74+i); if((await read()).player.grabbing) await tap('Drop',84+i); }
      const after=await read(); check(before.camera.fov===after.camera.fov && before.camera.zoom===after.camera.zoom && before.viewport.scale===after.viewport.scale,
        'Two-finger spread and repeated Grab retain browser and camera scale', { before, spread, after }); return { before, spread, after };
    });
    await test('pause-recovery', async () => {
      await down('Move pad',81); await move(81,0,-40); await down('Grab',82); await frames(4);
      await tap('Pause',83); const paused=await wait(300); const pausedAgain=await wait(300);
      check(paused.paused && paused.frame===pausedAgain.frame && paused.input.moveX===0 && paused.input.moveZ===0, 'Pause activates and clears movement while other touch owners are active', { paused, pausedAgain });
      await up(81); await up(82);if(!(await read()).paused)await tap('Pause',85);
      const primaryPaused=await wait(250);const stopped=await wait(250);
      check(primaryPaused.paused&&primaryPaused.frame===stopped.frame,'Primary-finger Pause stops the simulation after other fingers lift',{primaryPaused,stopped});
      await tap('Resume',84); const resumed=await frames(5);
      check(!resumed.paused && resumed.input.moveX===0 && resumed.input.moveZ===0 && !resumed.input.pressed, 'Resume starts without retained touch input',resumed); return { paused, resumed };
    });
    await test('focus-delivery', async () => {
      await down('Move pad',91); await move(91,0,-40); await frames(3);
      const other=await context.newPage(); await other.goto('about:blank'); await other.bringToFront(); await page.waitForTimeout(200); await page.bringToFront(); await other.close();
      const delivery=await page.evaluate(()=>window.__MOBILE_RECOVERY__.focus); const after=await read();
      if(delivery.blur+delivery.hidden>0) check(after.input.moveX===0&&after.input.moveZ===0,'Delivered browser focus loss clears movement',after);
      else result.limits.push('This headless run delivered no window blur or document-hidden event. OS focus recovery is not proved. No synthetic blur was dispatched.');
      await up(91); await neutral('Move clears after the focus attempt'); return { delivery, after };
    });
    await test('short-cut-50ms', async () => {
      await walkTo([-3,4],0.5);const candidate=await target(false,'ballast-box'); await aimAt(candidate.position); await tap('Equip torch'); const before=await read();
      const p={...await point('Cut'),id:101};await record('short-cut-request',{requestedHoldMs:50,point:p,before});
      fingers.set(101,p);
      const startCommand=cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
      const endCommand=new Promise((resolve,reject)=>setTimeout(()=>{
        fingers.delete(101);cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p]}).then(resolve,reject);
      },50));
      await Promise.all([startCommand,endCommand]);
      const after=await frames(10);
      const samples=await page.evaluate(()=>window.__MOBILE_RECOVERY__.samples);
      const pressedFrames=[...new Set(samples.filter(sample=>sample.pressed&&sample.tool===1).map(sample=>sample.frame))];
      check(!after.input.pressed,'A 50 ms Cut tap releases sampled input',after);
      const events=await page.evaluate(()=>window.__MOBILE_RECOVERY__.events.filter(e=>e.type==='pointerdown'&&e.target==='Cut'||e.type==='pointerup'&&e.target==='Cut'));
      const actualHoldMs=events.length>=2?events.at(-1).atMs-events.at(-2).atMs:null;
      return {candidate,before,after,requestedHoldMs:50,actualHoldMs,pressedFrames,torchCutsDelta:after.stats.torchCuts-before.stats.torchCuts};
    });
    await test('short-cut-cancel',async()=>{
      await walkTo([-3,4],0.5);const candidate=await target(false,'ballast-box');await aimAt(candidate.position);await tap('Equip torch');const before=await read();
      const p={...await point('Cut'),id:109};await record('short-cut-cancel-request',{point:p,before});fingers.set(109,p);
      const startCommand=cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
      const cancelCommand=new Promise((resolve,reject)=>setTimeout(()=>{fingers.clear();cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).then(resolve,reject);},0));
      await Promise.all([startCommand,cancelCommand]);const after=await frames(10);
      check(!after.input.pressed&&after.stats.torchCuts===before.stats.torchCuts,'An immediately cancelled real Cut touch produces no queued ghost pulse',{before,after});return {candidate,before,after};
    });
    await test('rapid-primary-with-move', async before => {
      const candidate=await target();await aimAt(candidate.position);await down('Move pad',121);await move(121,0,-30);
      for(let n=0;n<5;n++){await down('Primary action',122+n);await page.waitForTimeout(40);await up(122+n,0);await page.waitForTimeout(60);}
      await up(121);const after=await neutral('Rapid primary taps do not retain the Move owner');
      check(before.viewport.scale===after.viewport.scale&&before.camera.fov===after.camera.fov&&before.camera.zoom===after.camera.zoom,
        'Rapid primary taps while moving do not change browser or camera scale',{before,after});return {before,after};
    });
    await test('hud-native-pinch',async before=>{
      const pause=await point('Pause');await down('Pause',141,{x:pause.x-10,y:pause.y});await down('Pause',142,{x:pause.x+10,y:pause.y});
      for(let n=0;n<5;n++){await move(141,-4,0);await move(142,4,0);await page.waitForTimeout(40);}
      await up(141,0);await up(142,0);const after=await wait(400);
      check(before.viewport.scale===after.viewport.scale,'A native two-finger spread on HUD does not change browser scale',{before,after});
      return {before,after};
    });
  }
  if (phase === 'torch') {
    await test('torch-storage-route', async before => {
      await walkTo([-2,22],0.5,before.player.portalTeleports);
      for(const goal of [[6.8,-19.8],[-1,-19.8],[-7.35,-19.8],[-7.8,-17.6]]) await walkTo(goal);
      return read();
    });
    assert.ok(result.segments.find(segment=>segment.name==='torch-storage-route')?.passed,'The touch route must pass before the torch recovery trace.');
    await tap('Equip torch'); const crate=await target(true); assert.ok(crate,'A real storage crate is reachable.'); await aimAt(crate.position);
    await test('torch-idle-10s', async()=>{await wait(10000);return read();},false);
    await test('torch-held-edge-10s',async()=>{
      const before=await read(); await down('Cut',111);
      for(let n=0;n<10;n++){await move(111,n%2?3:-3,n%2?1:-1);await wait(1000);}
      const held=await read(); await up(111); const released=await frames(3);
      result.cutReleaseAtMs=await page.evaluate(()=>window.__MOBILE_RECOVERY__.events.filter(event=>event.type==='pointerup'&&event.target==='Cut').at(-1)?.atMs??performance.now());
      check(held.input.pressed,'Cut stays pressed through the held touch stroke',held);
      check(held.stats.torchCuts>before.stats.torchCuts||held.stats.fractures>before.stats.fractures,'The held touch stroke produces a real cut or fracture',{before,held});
      check(released.input.pressed===false,'Cut releases after the touch ends',released);
      return {crate,before,held,released};
    },false);
    for(let n=1;n<=6;n++) await test(`torch-settle-${n}-10s`,async()=>{await wait(10000);return read();},false);
  }
  }
  result.passed=result.segments.every(segment=>segment.passed)&&result.checks.every(entry=>entry.passed)&&result.errors.length===0;
} catch(error) { result.failure={message:String(error.stack??error),evidence:error.evidence};
  if(page&&!page.isClosed()){result.failure.screenshot=await shot('failure').catch(()=>null);result.failure.visibleCaptureStatus=await page.locator('.yard-performance').innerText().catch(()=>null);
    result.failure.perfStatus=await page.evaluate(()=>window.__WRECK_YARD_PERF__?.status()).catch(()=>null);}
}
finally { if(page&&!page.isClosed()&&fingers.size) await cancel().catch(()=>{});
  if(phase==='capture'&&page&&!page.isClosed()){const events=await page.evaluate(()=>({events:window.__MOBILE_RECOVERY__?.events,samples:window.__MOBILE_RECOVERY__?.samples})).catch(()=>null);await writeFile(join(out,'capture-ui-events.json'),JSON.stringify(events,null,2));}
  await browser?.close(); result.browserClosed=true; result.finished=new Date().toISOString();
  await writeFile(join(out,'timeline-1s.json'),JSON.stringify({cutReleaseAtMs:result.cutReleaseAtMs,bins:timeline.map(bin=>({...bin,afterCutReleaseMs:result.cutReleaseAtMs===undefined?null:bin.startMs-result.cutReleaseAtMs}))},null,2));await save(); }
console.log(JSON.stringify({passed:result.passed,phase,checks:result.checks.length,failed:result.checks.filter(entry=>!entry.passed).map(entry=>entry.name),
  segments:result.segments.map(({name,passed,error})=>({name,passed,error})),errors:result.errors,failure:result.failure,browserClosed:result.browserClosed,out},null,2));
if(!result.passed)process.exitCode=1;
