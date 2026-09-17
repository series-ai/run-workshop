import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Exercise the actual private reducer without widening the application's API.
// Vite's existing esbuild dependency bundles its local TS imports for Node.
const source = new URL('../src/workspace/useWorkspaceState.ts', import.meta.url);
const { outputFiles } = await build({
  stdin: {
    contents:
      (await readFile(source, 'utf8')) + '\nexport { historyReducer, initialHistoryState };',
    resolveDir: fileURLToPath(new URL('../src/workspace/', import.meta.url)),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  write: false,
});
const require = createRequire(import.meta.url);
const module = { exports: {} };
new Function('require', 'module', 'exports', 'localStorage', outputFiles[0].text)(
  (id) => {
    // Image encoding is unrelated to history/navigation and needs browser WASM.
    if (id === '@jsquash/oxipng/optimise')
      return () => {
        throw new Error('Unexpected image encoding in history test');
      };
    return require(id);
  },
  module,
  module.exports,
  { getItem: () => null },
);
const { historyReducer: reduce, initialHistoryState: initial } = module.exports;
const edit = (h, color) => reduce(h, { type: 'SET_CANVAS_BG_COLOR', color });
const pan = (h, x, y) => reduce(h, { type: 'SET_PAN', pan: { x, y } });
const zoom = (h, value, x, y) => reduce(h, { type: 'SET_ZOOM', zoom: value, pan: { x, y } });

test('pan and zoom alone add no undo entries', () => {
  const h = zoom(pan(initial, 120, -40), 2, 90, 70);
  assert.equal(h.past.length, 0);
  assert.equal(h.future.length, 0);
  assert.equal(reduce(h, { type: 'UNDO' }), h);
});

test('undo reverses the edit without restoring its old pan and zoom', () => {
  let h = edit(initial, '#123456');
  h = zoom(pan(h, 120, -40), 2, 90, 70);
  h = reduce(h, { type: 'UNDO' });
  assert.equal(h.current.canvasBgColor, null);
  assert.deepEqual(h.current.pan, { x: 90, y: 70 });
  assert.equal(h.current.zoom, 2);
  assert.equal(h.past.length, 0);
  assert.equal(h.future.length, 1);
});

test('navigation after undo preserves redo and redo preserves the latest view', () => {
  let h = reduce(edit(initial, '#123456'), { type: 'UNDO' });
  h = zoom(pan(h, -300, 400), 0.5, -80, 200);
  assert.equal(h.past.length, 0);
  assert.equal(h.future.length, 1);
  h = reduce(h, { type: 'REDO' });
  assert.equal(h.current.canvasBgColor, '#123456');
  assert.deepEqual(h.current.pan, { x: -80, y: 200 });
  assert.equal(h.current.zoom, 0.5);
  assert.equal(h.past.length, 1);
  assert.equal(h.future.length, 0);
});
