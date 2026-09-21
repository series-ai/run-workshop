import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const adapter = await import('../server/unityHeadless.ts').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('parses the live API pipe catalog with escaped newlines and exposes only supported prompt models', () => {
  assert.equal(typeof adapter.parseHeadlessModels, 'function');
  const output =
    'gemini-3.1-flash | Gemini Nano Banana 2, Image generation., Modalities: Image, SupportsTextPrompt, SupportsImageReference, SupportsCustomResolutions.\\nscenario-upscale-v3 | Upscale V3, Flux-based upscaling model., Modalities: Image, SupportsTextPrompt, SupportsImageReference.\\ngpt-image-1-5-recolor | Recolor, Palette tool., Modalities: Image, SupportsImageReference.\\n';
  assert.deepEqual(adapter.parseHeadlessModels(output), [
    {
      id: 'gemini-3.1-flash',
      displayName: 'Gemini Nano Banana 2',
      blurb: 'Image generation.',
      modalities: ['Image'],
      caps: ['SupportsTextPrompt'],
    },
  ]);
});

async function fixture(t, upstream) {
  const remote = createServer(upstream);
  remote.listen(0, '127.0.0.1');
  await once(remote, 'listening');
  const directory = await mkdtemp(join(tmpdir(), 'unity-headless-test-'));
  const configPath = join(directory, 'config.json');
  await writeFile(
    configPath,
    JSON.stringify({ url: `http://127.0.0.1:${remote.address().port}`, apiKey: 'test-only-key' }),
  );
  const bridge = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    await adapter.handleUnityHeadless(
      req.url.slice(1),
      JSON.parse(Buffer.concat(chunks)),
      res,
      configPath,
    );
  });
  bridge.listen(0, '127.0.0.1');
  await once(bridge, 'listening');
  t.after(async () => {
    bridge.closeAllConnections();
    remote.closeAllConnections();
    await Promise.all([
      new Promise((resolve) => bridge.close(resolve)),
      new Promise((resolve) => remote.close(resolve)),
    ]);
    await rm(directory, { recursive: true, force: true });
  });
  return (operation, params = {}) =>
    fetch(`http://127.0.0.1:${bridge.address().port}/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend: 'headless', ...params }),
    });
}

test('headless generation authenticates, uses explicit image settings, and streams downloaded PNG bytes', async (t) => {
  assert.equal(typeof adapter.handleUnityHeadless, 'function');
  const seen = [];
  // A real PNG fixture, not a generated asset or a claimed live result.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  const post = await fixture(t, async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer test-only-key');
    seen.push(req.url);
    if (req.url === '/generate') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      assert.deepEqual(JSON.parse(Buffer.concat(chunks)), {
        kind: 'image',
        prompt: 'gold coin',
        model: 'gemini-3.1-flash',
        remove_bg: false,
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          job_id: 'job1',
          download: ['/exports/job1/coin.png'],
          files: ['job1/coin.png'],
        }),
      );
    } else if (req.url === '/exports/job1/coin.png') {
      res.setHeader('Content-Type', 'image/png');
      res.end(png);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const response = await post('generate', { prompt: 'gold coin', model: 'gemini-3.1-flash' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const text = await response.text();
  assert.match(text, /event: progress/);
  assert.ok(text.includes(`data:image/png;base64,${png.toString('base64')}`));
  assert.match(text, /event: done/);
  assert.doesNotMatch(text, /test-only-key|event: error/);
  assert.deepEqual(seen, ['/generate', '/exports/job1/coin.png']);
});

test('status requires a valid Unity session, not just a connected Editor', async (t) => {
  let valid = false;
  const seen = [];
  const post = await fixture(t, (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer test-only-key');
    seen.push(req.url);
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        req.url === '/health'
          ? { editor_connected: true }
          : { session_valid: valid, expired_session: !valid },
      ),
    );
  });
  const expired = await (await post('status')).json();
  assert.equal(expired.up, false);
  assert.match(expired.error, /session.*expired/i);
  valid = true;
  const ready = await (await post('status')).json();
  assert.equal(ready.up, true);
  assert.equal(ready.backend, 'headless');
  assert.deepEqual(seen, ['/health', '/ready', '/health', '/ready']);
});

test('models endpoint translates the authenticated image catalog for the existing panel', async (t) => {
  const post = await fixture(t, (req, res) => {
    assert.equal(req.url, '/models?kind=image');
    assert.equal(req.headers.authorization, 'Bearer test-only-key');
    res.end(
      JSON.stringify({
        output:
          'gemini-3.1-flash | Nano Banana 2, Image model., Modalities: Image, SupportsTextPrompt.\n',
      }),
    );
  });
  const response = await post('models');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).models[0].id, 'gemini-3.1-flash');
});

test('rejects unsupported inputs before spending credits rather than silently ignoring them', async (t) => {
  let calls = 0;
  const post = await fixture(t, (req, res) => {
    calls++;
    res.end(JSON.stringify({ download: [] }));
  });
  for (const unsupported of [
    { refImage: { base64: 'abc' } },
    { width: 512 },
    { height: 512 },
    { kind: 'mesh' },
    { model: 'scenario-upscale-v3' },
  ]) {
    const response = await post('generate', {
      prompt: 'coin',
      model: 'gemini-3.1-flash',
      ...unsupported,
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /support/i);
  }
  assert.equal(calls, 0);
});

test('leaves default and explicit local requests untouched', async () => {
  assert.equal(await adapter.handleUnityHeadless('status', {}, null, '/does-not-exist'), false);
  assert.equal(
    await adapter.handleUnityHeadless('models', { backend: 'local' }, null, '/does-not-exist'),
    false,
  );
});

test('does not retry a busy server or expose its key in an error', async (t) => {
  let calls = 0;
  const post = await fixture(t, (req, res) => {
    calls++;
    res.writeHead(409);
    res.end(JSON.stringify({ detail: 'Another generation is running test-only-key' }));
  });
  const text = await (await post('generate', { prompt: 'coin', model: 'gemini-3.1-flash' })).text();
  assert.match(text, /event: error/);
  assert.match(text, /409.*Another generation/);
  assert.doesNotMatch(text, /test-only-key/);
  assert.equal(calls, 1);
});

test('rejects unsafe exports, redirects, and non-PNG files without leaking bearer auth', async (t) => {
  let path = 'http://attacker.invalid/stolen.png';
  let exportCalls = 0;
  const post = await fixture(t, (req, res) => {
    if (req.url === '/generate') res.end(JSON.stringify({ download: [path] }));
    else {
      exportCalls++;
      if (path.endsWith('redirect.png')) {
        res.writeHead(302, { Location: 'http://attacker.invalid/stolen.png' });
        res.end();
      } else res.end('<html>not an image</html>');
    }
  });
  for (const unsafe of [
    'http://attacker.invalid/stolen.png',
    '/exports/../private.png',
    '/exports/%2e%2e/private.png',
    '/exports/test/redirect.png',
    '/exports/test/invalid.png',
  ]) {
    path = unsafe;
    const text = await (
      await post('generate', { prompt: 'coin', model: 'gemini-3.1-flash' })
    ).text();
    assert.match(text, /event: error/);
    assert.doesNotMatch(text, /event: image|test-only-key/);
  }
  assert.equal(exportCalls, 2);
});
