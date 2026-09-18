import assert from 'node:assert/strict';
import test from 'node:test';
import * as crop from '../src/workspace/cropImage.ts';

function pixels(w, h, points) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const [x, y, alpha] of points) data[(y * w + x) * 4 + 3] = alpha;
  return data;
}

test('Pixel Fix crop bounds include faint stray pixels and tighten when erased', () => {
  assert.equal(typeof crop.findAlphaBounds, 'function');
  const data = pixels(10, 8, [
    [3, 3, 255],
    [5, 5, 255],
    [9, 0, 1],
  ]);
  assert.deepEqual(crop.findAlphaBounds(data, 10, 8), { x: 3, y: 0, w: 7, h: 6 });
  data[(0 * 10 + 9) * 4 + 3] = 0;
  assert.deepEqual(crop.findAlphaBounds(data, 10, 8), { x: 3, y: 3, w: 3, h: 3 });
});

test('empty pixels produce no frame, while tight and edge pixels retain exact bounds', () => {
  assert.equal(crop.findAlphaBounds(pixels(4, 3, []), 4, 3), null);
  assert.deepEqual(
    crop.findAlphaBounds(
      pixels(4, 3, [
        [0, 0, 255],
        [3, 2, 1],
      ]),
      4,
      3,
    ),
    { x: 0, y: 0, w: 4, h: 3 },
  );
  assert.deepEqual(crop.findAlphaBounds(pixels(4, 3, [[3, 2, 255]]), 4, 3), {
    x: 3,
    y: 2,
    w: 1,
    h: 1,
  });
});
