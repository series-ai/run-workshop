// Run against an isolated Chromium started with --remote-debugging-port=9333.
// All Unity calls in this test are fixtures; generation never spends credits.
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
const button = (text) =>
  `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)})`;
try {
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `
    localStorage.setItem('layout-manager-config', JSON.stringify({showWelcome:false,hermesEnabled:false,unityBackend:'local'}));
    window.__qa = { calls: [], image: 'invalid' };
    const original = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      if (typeof url !== 'string' || !url.startsWith('/__unity-')) return original(url, init);
      const body = JSON.parse(init.body); window.__qa.calls.push({url,body});
      if (url === '/__unity-status') return Response.json({ up:true, project:body.backend === 'headless' ? 'http://fixture.invalid:8080' : '/fixture/local-project', version:'fixture',port:7800 });
      if (url === '/__unity-models') return Response.json({models:[{id:'gemini-3.1-flash', displayName:'QA Image Model', blurb:'Fixture catalog', modalities:['Image'], caps:body.backend === 'headless' ? ['SupportsTextPrompt'] : ['SupportsTextPrompt','SupportsCustomResolutions','SupportsImageReference']}]});
      if (url === '/__unity-generate') {
        const c = document.createElement('canvas'); c.width=32;c.height=32;c.getContext('2d').fillRect(0,0,32,32);
        const dataUrl = window.__qa.image === 'invalid' ? 'data:image/png;base64,iVBORw0KGgo=' : c.toDataURL();
        const image = window.__qa.image === 'empty' ? '' : 'event: image\\ndata: '+JSON.stringify({dataUrl})+'\\n\\n';
        return new Response(image+'event: done\\ndata: {}\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
      }
      throw Error('Unexpected Unity route');
    };
  `,
  });
  await cdp('Page.navigate', { url: app });
  await until(`!!document.querySelector('button[title="Menu"]')`);
  await evaluate(`document.querySelector('button[title="Menu"]').click()`);
  await until(`!!${button('Preferences')}`);
  await evaluate(`${button('Preferences')}.click()`);
  await until(`!!${button('AI')}`);
  await evaluate(`${button('AI')}.click()`);
  await until(
    `Array.from(document.querySelectorAll('.prefs-select-row')).some(e=>e.textContent.includes('Unity connection'))`,
  );
  const select = `Array.from(document.querySelectorAll('.prefs-select-row')).find(e=>e.textContent.includes('Unity connection')).querySelector('select')`;
  assert.equal(await evaluate(`${select}.value`), 'local');
  await evaluate(
    `{const s=${select};s.value='headless';s.dispatchEvent(new Event('change',{bubbles:true}));}`,
  );
  await until(`${select}.value === 'headless'`);
  await evaluate(`${button('Save')}.click()`);
  await until(`!document.querySelector('.prefs-select-row')`);
  await evaluate(`document.querySelector('button[title^="Unity AI"]').click()`);
  await until(`!!document.querySelector('.ai-modal select option')`);
  assert.match(
    await evaluate(`document.querySelector('.ai-modal').innerText`),
    /Unity AI — Headless/,
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('.ai-modal input[inputmode="numeric"]').length`),
    0,
  );
  assert.equal(await evaluate(`${button('Generate')}.disabled`), true);
  await evaluate(
    `{const input=document.querySelector('.ai-modal-textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'QA fixture only');input.dispatchEvent(new Event('input',{bubbles:true}));}`,
  );
  await until(`!${button('Generate')}.disabled`);
  await evaluate(`${button('Generate')}.click()`);
  await until(
    `document.querySelector('.ai-modal-error')?.textContent.includes('could not be decoded')`,
  );
  assert.equal(await evaluate(`${button('Generate')}.disabled`), false);
  await evaluate(`window.__qa.image='empty';${button('Generate')}.click()`);
  await until(
    `document.querySelector('.ai-modal-error')?.textContent.includes('without returning an image')`,
  );
  await evaluate(`window.__qa.image='valid';${button('Generate')}.click()`);
  await until(`!!document.querySelector('.image-node-img') && !!${button('Generate')}`);
  const image = await evaluate(
    `(()=>{const i=document.querySelector('.image-node-img');return {src:i.src,width:i.naturalWidth,height:i.naturalHeight};})()`,
  );
  assert.match(image.src, /^blob:/);
  assert.equal(image.width, 32);
  assert.equal(image.height, 32);
  const calls = await evaluate(`window.__qa.calls.filter(c=>c.url==='/__unity-generate')`);
  assert.equal(calls.length, 3);
  for (const { body } of calls) {
    assert.equal(body.backend, 'headless');
    assert.equal(body.width, 0);
    assert.equal(body.height, 0);
    assert.equal(body.refImage, undefined);
    assert.equal(body.apiKey, undefined);
  }
  for (const width of [1280, 780]) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    const path = `/tmp/layoutmanager-unity-qa-${width}.png`;
    await writeFile(path, Buffer.from(shot.data, 'base64'));
    console.log(`Screenshot: ${path}`);
  }
  // Switch back without closing the Unity panel: it must remount and load
  // the local catalog rather than reuse the remote connection/capabilities.
  await evaluate(`document.querySelector('button[title="Menu"]').click()`);
  await until(`!!${button('Preferences')}`);
  await evaluate(`${button('Preferences')}.click()`);
  await until(`!!${button('AI')}`);
  await evaluate(`${button('AI')}.click()`);
  await until(`!!${select}`);
  await evaluate(
    `{const s=${select};s.value='local';s.dispatchEvent(new Event('change',{bubbles:true}));}`,
  );
  await until(`${select}.value === 'local'`);
  await evaluate(`${button('Save')}.click()`);
  await until(
    `document.querySelector('.ai-modal')?.innerText.includes('local-project') && !!document.querySelector('.ai-modal input[inputmode="numeric"]')`,
  );
  assert.equal(
    await evaluate(`document.querySelector('.ai-modal-textarea').value`),
    'QA fixture only',
  );
  console.log(
    'PASS: local default, headless selection, prompt-only request, decode/empty errors, persisted canvas image, and switch back to local. All Unity responses were test fixtures.',
  );
} finally {
  ws.close();
  await fetch(`${debug}/json/close/${tab.id}`);
}
