// Uses an isolated Chromium CDP session and synthetic PaintEditor fixture.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const app = process.env.LM_TEST_URL ?? 'http://127.0.0.1:5181';
const debug = process.env.LM_TEST_CDP ?? 'http://127.0.0.1:9333';
const tab = await (await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  }
});
async function cdp(method, params = {}) {
  const number = ++id;
  const promise = new Promise((resolve) => pending.set(number, resolve));
  ws.send(JSON.stringify({ id: number, method, params }));
  const response = await promise;
  if (response.error) throw new Error(JSON.stringify(response.error));
  return response.result;
}
async function evaluate(expression) {
  const response = await cdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function until(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${expression}`);
}
try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: app });
  await until(`!!document.querySelector('button[title="Menu"]')`);
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Continue')?.click()`,
  );
  await evaluate(`import('/tests/fixtures/pixelFixHarness.tsx')`);
  await until(`document.querySelectorAll('.paint-layer-item').length === 2`);
  assert.equal(
    await evaluate(`!!document.querySelector('button[aria-label="Pixel Fix mode"]')`),
    true,
    'Mask layer needs a Pixel Fix toggle',
  );
  await until(`document.querySelector('.mask-display-canvas')?.width === 320`);
  // A view-only toggle must not silently redirect subsequent painting to Mask.
  await evaluate(
    `Array.from(document.querySelectorAll('.paint-layer-item')).find(row=>row.querySelector('.paint-layer-name')?.textContent.trim()==='Background').click()`,
  );
  await until(
    `document.querySelector('.paint-layer-item-active .paint-layer-name')?.textContent.trim() === 'Background'`,
  );
  const originalPreview = await evaluate(
    `document.querySelector('.mask-display-canvas').toDataURL()`,
  );
  await evaluate(`document.querySelector('button[aria-label="Pixel Fix mode"]').click()`);
  await until(
    `document.querySelector('button[aria-label="Pixel Fix mode"]').getAttribute('aria-pressed') === 'true'`,
  );
  assert.equal(
    await evaluate(`!!document.querySelector('.paint-pixel-fix-canvas')`),
    true,
    'Pixel Fix needs a separate diagnostic canvas',
  );
  assert.equal(
    await evaluate(
      `document.querySelector('.paint-layer-item-active .paint-layer-name')?.textContent.trim()`,
    ),
    'Background',
    'Enabling Pixel Fix must preserve the active layer',
  );
  await evaluate(`document.querySelector('button[aria-label="Pixel Fix mode"]').click()`);
  await until(`!document.querySelector('.paint-pixel-fix-canvas')`);
  assert.equal(
    await evaluate(
      `document.querySelector('.paint-layer-item-active .paint-layer-name')?.textContent.trim()`,
    ),
    'Background',
    'Disabling Pixel Fix must preserve the active layer',
  );
  await evaluate(`document.querySelector('button[aria-label="Pixel Fix mode"]').click()`);
  await until(`!!document.querySelector('.paint-pixel-fix-canvas')`);
  assert.equal(
    await evaluate(`document.querySelector('.mask-display-canvas').toDataURL()`),
    originalPreview,
    'Diagnostic pixels must not contaminate the regular preview',
  );
  assert.equal(
    await evaluate(`window.pixelFixQa.history.canUndo`),
    false,
    'Toggling a view aid must not enter paint history',
  );
  const sample = (x, y) =>
    evaluate(
      `Array.from(document.querySelector('.paint-pixel-fix-canvas').getContext('2d').getImageData(${x + 2},${y + 2},1,1).data)`,
    );
  assert.deepEqual(
    await sample(282, 30),
    [255, 0, 0, 255],
    'Faint stray pixel needs a solid 2px outside highlight',
  );
  assert.equal((await sample(283, 30))[3], 0, 'Stroke must stop after two source pixels');
  assert.ok(
    (await sample(170, 30))[3] > 0,
    'Auto-crop frame must span the stray pixel and main element',
  );
  assert.deepEqual(await sample(98, 120), [255, 0, 0, 255]);
  await evaluate(`document.querySelector('button[title="Show checkerboard"]').click()`);
  await until(`!!document.querySelector('button[title="Show workspace behind"]')`);
  assert.equal((await sample(0, 0))[3], 0, 'Checkerboard must not count as image content');
  // Pure preview helper: crop bounds and edge padding must agree with Auto Crop.
  const helper = await evaluate(`(async()=>{
    const {renderPixelFixPreview}=await import('/src/workspace/paint/pixelFixPreview.ts');
    const {autoCropImage}=await import('/src/workspace/cropImage.ts');
    const src=document.createElement('canvas');src.width=10;src.height=10;
    const ctx=src.getContext('2d');ctx.fillRect(0,0,1,1);ctx.fillRect(5,5,2,2);
    const original=src.toDataURL();const target=document.createElement('canvas');
    const edgeBounds=renderPixelFixPreview(src,target,null,1);
    const border=Array.from(target.getContext('2d').getImageData(0,2,1,1).data);
    const crop={x:3,y:3,w:6,h:6};
    const cropped=renderPixelFixPreview(src,target,crop,1);
    const auto=await autoCropImage({...window.pixelFixQa.image,src:src.toDataURL(),naturalWidth:10,naturalHeight:10,cropRect:crop});
    const unchanged=src.toDataURL()===original;
    ctx.clearRect(0,0,10,10);
    const empty=renderPixelFixPreview(src,target,null,1);
    const emptyAlpha=target.getContext('2d').getImageData(0,0,target.width,target.height).data.some((v,i)=>i%4===3&&v>0);
    return {edgeBounds,border,cropped,auto,unchanged,empty,emptyAlpha};
  })()`);
  assert.deepEqual(helper.edgeBounds, { x: 0, y: 0, w: 7, h: 7 });
  assert.deepEqual(
    helper.border,
    [255, 0, 0, 255],
    'Outside stroke must remain visible at image borders',
  );
  assert.deepEqual(helper.cropped, helper.auto);
  assert.deepEqual(helper.cropped, { x: 5, y: 5, w: 2, h: 2 });
  assert.equal(helper.unchanged, true);
  assert.equal(helper.empty, null);
  assert.equal(helper.emptyAlpha, false);
  // Erase the stray pixel and inspect while the pointer is still down.
  await evaluate(
    `Array.from(document.querySelectorAll('.paint-layer-item')).find(row=>row.querySelector('.paint-layer-name')?.textContent.trim()==='Mask').click()`,
  );
  await until(
    `document.querySelector('.paint-layer-item-active .paint-layer-name')?.textContent.trim() === 'Mask'`,
  );
  await cdp('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 620,
    y: 210,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await until(
    `document.querySelector('.paint-pixel-fix-canvas').getContext('2d').getImageData(284,32,1,1).data[3] === 0`,
  );
  await cdp('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 620,
    y: 210,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  assert.equal((await sample(170, 30))[3], 0, 'Frame must tighten after removing the outlier');
  assert.ok((await sample(150, 80))[3] > 0);
  await evaluate(`window.pixelFixQa.history.undo()`);
  await until(
    `document.querySelector('.paint-pixel-fix-canvas').getContext('2d').getImageData(284,32,1,1).data[3] === 255`,
  );
  await evaluate(`window.pixelFixQa.history.redo()`);
  await until(
    `document.querySelector('.paint-pixel-fix-canvas').getContext('2d').getImageData(284,32,1,1).data[3] === 0`,
  );
  await evaluate(`document.querySelector('button[aria-label="Pixel Fix mode"]').click()`);
  await until(`!document.querySelector('.paint-pixel-fix-canvas')`);
  await evaluate(`document.querySelector('button[aria-label="Pixel Fix mode"]').click()`);
  await until(`!!document.querySelector('.paint-pixel-fix-canvas')`);
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile('/tmp/layoutmanager-pixel-fix.png', Buffer.from(shot.data, 'base64'));
  // Apply while Pixel Fix is still on. Only the real mask edit may survive.
  await evaluate(
    `document.activeElement?.blur();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
  );
  await until(`!!window.pixelFixQa.applied && !document.querySelector('.paint-editor')`);
  assert.equal(await evaluate(`!!document.querySelector('.paint-pixel-fix-canvas')`), false);
  const saved = await evaluate(`window.pixelFixQa.applied`);
  assert.ok(saved[0], 'The real mask edit must be saved');
  assert.equal(saved[3], null, 'Source image must be unchanged');
  assert.ok(
    !(saved[1] ?? []).some((layer) => layer.strokeEffect?.enabled),
    'Temporary stroke must not be serialized',
  );
  assert.deepEqual(
    await evaluate(
      `(async()=>{const {autoCropImage}=await import('/src/workspace/cropImage.ts');return autoCropImage({...window.pixelFixQa.image,maskDataUrl:window.pixelFixQa.applied[0]});})()`,
    ),
    { x: 100, y: 80, w: 100, h: 100 },
  );
  await evaluate(
    `window.pixelFixQa.mount({maskDataUrl:window.pixelFixQa.applied[0],paintLayers:window.pixelFixQa.applied[1]})`,
  );
  await until(`!!document.querySelector('button[aria-label="Pixel Fix mode"]')`);
  assert.equal(
    await evaluate(
      `document.querySelector('button[aria-label="Pixel Fix mode"]').getAttribute('aria-pressed')`,
    ),
    'false',
    'Pixel Fix must start off on re-entry',
  );
  await evaluate(`document.querySelector('button[aria-label="Pixel Fix mode"]').click()`);
  await until(`!!document.querySelector('.paint-pixel-fix-canvas')`);
  await evaluate(
    `document.activeElement?.blur();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
  );
  await until(`window.pixelFixQa.cancelled && !document.querySelector('.paint-pixel-fix-canvas')`);
  await evaluate(
    `window.pixelFixQa.mount({paintLayers:[{name:'Background',dataUrl:'',visible:true,opacity:1,strokeEffect:{enabled:true,color:'#00ff00',thickness:3,opacity:0.8,position:'outside'}},{name:'Mask',dataUrl:'',visible:true,opacity:1}]})`,
  );
  await until(`!!document.querySelector('button[aria-label="Pixel Fix mode"]')`);
  const styledPreview = await evaluate(
    `document.querySelector('.mask-display-canvas').toDataURL()`,
  );
  await evaluate(`document.querySelector('button[aria-label="Pixel Fix mode"]').click()`);
  await until(`!!document.querySelector('.paint-pixel-fix-canvas')`);
  assert.equal(
    await evaluate(`document.querySelector('.mask-display-canvas').toDataURL()`),
    styledPreview,
  );
  for (const width of [1280, 780]) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const capture = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(
      `/tmp/layoutmanager-pixel-fix-${width}.png`,
      Buffer.from(capture.data, 'base64'),
    );
  }
  await evaluate(
    `document.activeElement?.blur();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
  );
  await until(`!!window.pixelFixQa.applied && !document.querySelector('.paint-editor')`);
  assert.deepEqual(
    await evaluate(
      `window.pixelFixQa.applied[1].find(layer=>layer.name==='Background').strokeEffect`,
    ),
    { enabled: true, color: '#00ff00', thickness: 3, opacity: 0.8, position: 'outside' },
  );
  console.log(
    'PASS: Pixel Fix toggle, exact red outside stroke, live bounds, undo/redo, clean apply, and reset on re-entry. Screenshot: /tmp/layoutmanager-pixel-fix.png',
  );
} finally {
  ws.close();
  await fetch(`${debug}/json/close/${tab.id}`);
}
