import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',
  'base64',
);

test('download tickets serve Unicode and unusual filenames without invalid HTTP headers', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'download-test-'));
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
  for (const name of [
    'character.png',
    'Knight — “idle” 🗡️.png',
    "角色 élan (1)'s.png",
    'bad\u0000\r\n\t"/\\name.png',
  ]) {
    await t.test(JSON.stringify(name), async () => {
      const id = randomUUID();
      await fetch(`${base}/__download-fulfill/${id}`, { method: 'POST', body: png });
      try {
        const response = await fetch(`${base}/__download/${id}/${encodeURIComponent(name)}`);
        assert.equal(response.status, 200, 'filename must not trigger a Vite 500 overlay');
        assert.equal(response.headers.get('content-type'), 'image/png');
        const disposition = response.headers.get('content-disposition');
        assert.match(disposition, /^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
        const encoded = disposition.split("filename*=UTF-8''")[1];
        assert.equal(decodeURIComponent(encoded), name.replace(/[/\\"\x00-\x1f\x7f]/g, '_'));
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      } finally {
        // Drain a ticket left behind by a failing header write, without waiting for its TTL.
        await fetch(`${base}/__download-fulfill/${id}`, { method: 'POST', body: '' });
        await fetch(`${base}/__download/${id}/cleanup.png`);
      }
    });
  }
  const malformed = await fetch(`${base}/__download/${randomUUID()}/bad%ZZ.png`);
  assert.equal(malformed.status, 400, 'malformed URL encoding is a client error, not an overlay');
});
