import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('Vite routes headless requests, preserves local validation, and blocks config and cross-origin access', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'unity-vite-test-'));
  const configPath = join(root, '.unity-headless.local.json');
  // No real key or Unity service is needed for this integration test.
  await writeFile(
    configPath,
    JSON.stringify({ url: 'http://127.0.0.1:1', apiKey: 'test-only-key' }),
  );
  const server = await createServer({
    root,
    configFile: resolve('vite.config.ts'),
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'silent',
  });
  await server.listen();
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const post = (route, body, headers = {}) =>
    fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  for (const path of [
    '/.unity-headless.local.json',
    '/.unity-headless.local.json?raw',
    '/@fs/' + configPath,
  ]) {
    assert.equal((await fetch(base + path)).status, 403, path);
  }
  for (const operation of ['status', 'models', 'generate']) {
    assert.equal((await fetch(base + '/__unity-' + operation)).status, 405);
    assert.equal(
      (
        await post(
          '/__unity-' + operation,
          { backend: 'headless' },
          { Origin: 'https://untrusted.example' },
        )
      ).status,
      403,
    );
  }
  const local = await post('/__unity-models', { backend: 'local' });
  assert.equal(local.status, 400);
  assert.equal((await local.json()).error, 'Missing projectPath');
  const unsupported = await post('/__unity-generate', {
    backend: 'headless',
    prompt: 'coin',
    model: 'gemini-3.1-flash',
    refImage: { base64: 'invalid' },
  });
  assert.equal(unsupported.status, 400);
  assert.match((await unsupported.json()).error, /not supported/);
  const offline = await post('/__unity-status', { backend: 'headless' });
  assert.equal(offline.status, 502);
  const status = await offline.json();
  assert.equal(status.up, false);
  assert.doesNotMatch(JSON.stringify(status), /test-only-key/);
});
