import assert from 'node:assert/strict';
import test from 'node:test';

const engine = await import('../src/workspace/dotpixel/sampling.ts');

test('selecting an existing pin preserves redo and its influence metadata in either soft mode', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  for (const softSelection of [false, true]) {
    let history = {
      present: { frame: { x: 0, y: 0, w: 320, h: 320 }, anchors: [], softSelection },
      past: [],
      future: [],
    };
    history = editDotDocument(history, {
      type: 'pin',
      anchor: { col: 3, row: 4, x: 41.2, y: 52.3 },
    });
    history = editDotDocument(history, { type: 'settings', settings: { radius: 3 } });
    history = editDotDocument(history, { type: 'undo' });
    const pin = history.present.anchors[0];
    assert.equal(editDotDocument(history, { type: 'pin', anchor: { ...pin } }), history);
    assert.equal(
      editDotDocument(history, {
        type: 'pin',
        anchor: { col: pin.col, row: pin.row, x: pin.x, y: pin.y },
      }),
      history,
    );
    const changed = editDotDocument(history, { type: 'pin', anchor: { ...pin, x: pin.x + 1 } });
    assert.notEqual(changed, history);
    assert.equal(changed.future.length, 0);
    assert.equal(editDotDocument(history, { type: 'redo' }).present.radius, 3);
  }
});

test('unchanged settings use effective defaults and preserve redo', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let history = {
    present: { frame: { x: 0, y: 0, w: 320, h: 320 }, anchors: [] },
    past: [],
    future: [],
  };
  history = editDotDocument(history, { type: 'settings', settings: { levels: 4 } });
  history = editDotDocument(history, { type: 'undo' });
  for (const settings of [
    {},
    { levels: 0 },
    { radius: 2 },
    { strength: 0.8 },
    { softSelection: false },
    { levels: 0, radius: 2, strength: 0.8, softSelection: false },
  ]) {
    assert.equal(editDotDocument(history, { type: 'settings', settings }), history);
  }
  const nonDefault = editDotDocument(history, { type: 'redo' });
  assert.equal(
    editDotDocument(nonDefault, { type: 'settings', settings: { levels: 4 } }),
    nonDefault,
  );
  assert.equal(
    editDotDocument(history, { type: 'settings', settings: { radius: 3 } }).future.length,
    0,
  );
});

test('empty clear and missing remove actions are also no-ops', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let history = {
    present: { frame: { x: 0, y: 0, w: 320, h: 320 }, anchors: [] },
    past: [],
    future: [],
  };
  history = editDotDocument(history, { type: 'settings', settings: { levels: 4 } });
  history = editDotDocument(history, { type: 'undo' });
  for (const edit of [
    { type: 'clear' },
    { type: 'clear-lines' },
    { type: 'remove', col: 3, row: 4 },
  ])
    assert.equal(editDotDocument(history, edit), history);
});

test('identity frame previews return the original document without remapping any points', async () => {
  const { transformDotFrame } = await import('../src/workspace/dotpixel/document.ts');
  const document = {
    frame: { x: 7, y: 11, w: 333, h: 217 },
    anchors: [
      {
        col: 1,
        row: 1,
        x: 29.1,
        y: 47.3,
        dragInfluence: { size: 32, point: { x: 29.2, y: 47.4 } },
      },
    ],
    lines: [
      [
        { x: 17.1, y: 19.3 },
        { x: 57.8, y: 73.9 },
      ],
    ],
  };
  for (let i = 0; i < 20; i++)
    assert.equal(transformDotFrame(document, { ...document.frame }), document);
});

test('unchanged frame adjustments do not consume undo or erase redo history', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let history = {
    present: { frame: { x: 0, y: 0, w: 333, h: 217 }, anchors: [] },
    past: [],
    future: [],
  };
  history = editDotDocument(history, { type: 'pin', anchor: { col: 1, row: 1, x: 29.1, y: 47.3 } });
  history = editDotDocument(history, { type: 'pin', anchor: { col: 2, row: 2, x: 43.7, y: 55.8 } });
  history = editDotDocument(history, { type: 'undo' });
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);
  const untouched = editDotDocument(history, {
    type: 'adjust-frame',
    frame: { ...history.present.frame },
  });
  assert.equal(untouched, history);
  assert.equal(editDotDocument(untouched, { type: 'redo' }).present.anchors.length, 2);
});

test('row and column drags move the whole band on one axis, leaving neighbours alone by default', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  const initial = {
    size: 6,
    outputHeight: 4,
    frame: { x: 10, y: 20, w: 240, h: 160 },
    anchors: [],
  };
  const original = { present: initial, past: [], future: [] };
  const grid = (d) =>
    engine.buildSampleGrid(d.frame, d.size, d.anchors, { lines: d.lines }, d.outputHeight);
  const before = grid(initial);
  for (const axis of ['row', 'column']) {
    const changed = editDotDocument(original, { type: 'band', axis, index: 1, delta: 15 });
    const after = grid(changed.present);
    for (let i = 0; i < before.length; i++) {
      const selected = axis === 'row' ? Math.floor(i / 6) === 1 : i % 6 === 1;
      assert.deepEqual(after[i], {
        x: before[i].x + (selected && axis === 'column' ? 15 : 0),
        y: before[i].y + (selected && axis === 'row' ? 15 : 0),
      });
    }
    assert.equal(changed.present.anchors.length, axis === 'row' ? 6 : 4);
    assert.equal(changed.past.length, 1);
    assert.deepEqual(editDotDocument(changed, { type: 'undo' }).present, initial);
    assert.deepEqual(
      editDotDocument(editDotDocument(changed, { type: 'undo' }), { type: 'redo' }).present,
      changed.present,
    );
    assert.equal(editDotDocument(original, { type: 'band', axis, index: 1, delta: 0 }), original);
    assert.equal(
      editDotDocument(original, { type: 'band', axis, index: 999, delta: 15 }),
      original,
    );
  }
});

test('band soft selection influences nearby automatic samples but preserves other manual pins', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let h = {
    present: { size: 8, frame: { x: 0, y: 0, w: 320, h: 320 }, anchors: [] },
    past: [],
    future: [],
  };
  h = editDotDocument(h, { type: 'pin', anchor: { col: 0, row: 2, x: 20, y: 100 } });
  h = editDotDocument(h, { type: 'settings', settings: { softSelection: true } });
  h = editDotDocument(h, { type: 'band', axis: 'row', index: 3, delta: 20 });
  const grid = engine.buildSampleGrid(h.present.frame, 8, h.present.anchors);
  assert.ok(grid[2 * 8 + 3].y > 100);
  assert.deepEqual(grid[2 * 8], { x: 20, y: 100 });
  assert.deepEqual(grid[7 * 8 + 3], { x: 140, y: 300 });
  h = editDotDocument(h, { type: 'settings', settings: { softSelection: false } });
  h = editDotDocument(h, { type: 'band', axis: 'row', index: 3, delta: 10 });
  const isolated = engine.buildSampleGrid(h.present.frame, 8, h.present.anchors);
  assert.deepEqual(isolated[2 * 8 + 3], grid[2 * 8 + 3]);
});

test('band movement clamps as a group and retains a deformed row shape and pin importance', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let h = {
    present: { size: 4, frame: { x: 0, y: 0, w: 320, h: 320 }, anchors: [] },
    past: [],
    future: [],
  };
  h = editDotDocument(h, { type: 'pin', anchor: { col: 1, row: 1, x: 150, y: 130 } });
  h = editDotDocument(h, { type: 'resolution', size: 8 });
  const before = engine.buildSampleGrid(h.present.frame, 8, h.present.anchors);
  h = editDotDocument(h, { type: 'band', axis: 'row', index: 3, delta: -999 });
  const after = engine.buildSampleGrid(h.present.frame, 8, h.present.anchors);
  const delta = -Math.min(...before.slice(24, 32).map((p) => p.y));
  for (let i = 24; i < 32; i++) {
    assert.equal(after[i].x, before[i].x);
    assert.ok(Math.abs(after[i].y - before[i].y - delta) < 0.00001);
    assert.ok(after[i].y >= 0 && after[i].y < 320);
  }
  assert.equal(h.present.anchors.find((a) => a.col === 3 && a.row === 3).basisSize, 4);
});

test('custom dimensions remap both axes independently, preserve pins and cap each side', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let h = {
    present: { size: 4, frame: { x: 0, y: 0, w: 320, h: 320 }, anchors: [] },
    past: [],
    future: [],
  };
  h = editDotDocument(h, { type: 'pin', anchor: { col: 1, row: 2, x: 100, y: 180 } });
  const original = h.present;
  h = editDotDocument(h, { type: 'resolution', size: 24, height: 40 });
  assert.equal(h.present.size, 24);
  assert.equal(h.present.outputHeight, 40);
  assert.deepEqual(
    h.present.anchors.map((a) => [a.col, a.row, a.x, a.y]),
    [[9, 25, 100, 180]],
  );
  const beforePin = engine.buildSampleGrid(h.present.frame, 24, h.present.anchors, {}, 40);
  h = editDotDocument(h, { type: 'pin', anchor: { ...h.present.anchors[0], x: 110 } });
  const afterPin = engine.buildSampleGrid(h.present.frame, 24, h.present.anchors, {}, 40);
  assert.deepEqual(
    afterPin[25 * 24 + 10],
    beforePin[25 * 24 + 10],
    'soft selection stays off for rectangular output',
  );
  for (const [size, height] of [
    [129, 40],
    [24, 129],
    [0, 40],
    [24, 0],
    [24.5, 40],
    [24, NaN],
    [Infinity, 40],
  ]) {
    assert.equal(editDotDocument(h, { type: 'resolution', size, height }), h);
  }
  h = editDotDocument(h, { type: 'undo' });
  h = editDotDocument(h, { type: 'undo' });
  assert.deepEqual(h.present, original);
  h = editDotDocument(h, { type: 'resolution', size: 128, height: 128 });
  assert.equal(h.present.outputHeight, 128);
});

test('rectangular sampling produces width times height RGBA pixels, including narrow outputs', () => {
  const source = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) };
  for (let i = 0; i < 64; i++) source.data.set([i, 0, 0, 255], i * 4);
  const frame = { x: 0, y: 0, w: 8, h: 8 };
  const output = engine.sampleDotPixel(source, frame, 2, [], {}, 4);
  assert.equal(output.length, 2 * 4 * 4);
  assert.deepEqual(
    Array.from(output).filter((_, i) => i % 4 === 0),
    [10, 14, 26, 30, 42, 46, 58, 62],
  );
  assert.equal(engine.buildSampleGrid(frame, 1, [], {}, 128).length, 128);
  assert.equal(engine.sampleDotPixel(source, frame, 128, [], {}, 1).length, 128 * 4);
});

test('soft selection defaults off, toggles on for dragging, and freezes neighbours when switched off', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  const frame = { x: 0, y: 0, w: 320, h: 320 };
  let h = { present: { size: 8, frame, anchors: [] }, past: [], future: [] };
  const grid = () => engine.buildSampleGrid(frame, h.present.size, h.present.anchors);
  const initial = grid();
  h = editDotDocument(h, { type: 'pin', anchor: { col: 3, row: 3, x: 180, y: 140 } });
  assert.deepEqual(grid()[3 * 8 + 4], initial[3 * 8 + 4]);
  h = editDotDocument(h, { type: 'pin', anchor: { ...h.present.anchors[0], x: 200 } });
  assert.deepEqual(grid()[3 * 8 + 4], initial[3 * 8 + 4]);
  assert.deepEqual(grid()[3 * 8 + 3], { x: 200, y: 140 });
  h = editDotDocument(h, { type: 'settings', settings: { softSelection: true } });
  h = editDotDocument(h, { type: 'pin', anchor: { ...h.present.anchors[0], x: 210 } });
  assert.ok(grid()[3 * 8 + 4].x > initial[3 * 8 + 4].x);
  const influenced = grid();
  h = editDotDocument(h, { type: 'settings', settings: { softSelection: false } });
  h = editDotDocument(h, { type: 'pin', anchor: { ...h.present.anchors[0], x: 230 } });
  assert.deepEqual(grid()[3 * 8 + 4], influenced[3 * 8 + 4]);
  assert.deepEqual(grid()[3 * 8 + 3], { x: 230, y: 140 });
  h = editDotDocument(h, { type: 'undo' });
  assert.deepEqual(grid(), influenced);
});

test('isolated dragging preserves inherited refinement and frame transforms carry frozen influence', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  const frame = { x: 0, y: 0, w: 320, h: 320 };
  let h = { present: { size: 4, frame, anchors: [] }, past: [], future: [] };
  h = editDotDocument(h, { type: 'pin', anchor: { col: 1, row: 1, x: 150, y: 130 } });
  h = editDotDocument(h, { type: 'resolution', size: 16 });
  const before = engine.buildSampleGrid(frame, 16, h.present.anchors);
  assert.ok(before[6 * 16 + 8].x > 185);
  h = editDotDocument(h, { type: 'pin', anchor: { ...h.present.anchors[0], x: 200 } });
  const after = engine.buildSampleGrid(frame, 16, h.present.anchors);
  assert.deepEqual(after[6 * 16 + 8], before[6 * 16 + 8]);
  h = editDotDocument(h, { type: 'adjust-frame', frame: { ...frame, x: 10, y: 10 } });
  const moved = engine.buildSampleGrid(h.present.frame, 16, h.present.anchors);
  assert.ok(Math.abs(moved[6 * 16 + 8].x - before[6 * 16 + 8].x - 10) < 0.00001);
});

test('new fine samples strongly inherit coarse anchor displacement rather than a reset grid', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  const frame = { x: 0, y: 0, w: 320, h: 320 };
  let h = { present: { size: 4, frame, anchors: [] }, past: [], future: [] };
  h = editDotDocument(h, { type: 'pin', anchor: { col: 1, row: 1, x: 150, y: 130 } });
  h = editDotDocument(h, { type: 'resolution', size: 16 });
  const grid = engine.buildSampleGrid(frame, 16, h.present.anchors);
  assert.deepEqual(grid[6 * 16 + 6], { x: 150, y: 130 });
  assert.ok(
    grid[6 * 16 + 8].x > 185,
    'new neighbours inherit most of the coarse 30px displacement',
  );
  const fine = engine.buildSampleGrid(
    frame,
    16,
    h.present.anchors.map((a) => ({ ...a, basisSize: 16 })),
  );
  assert.ok(
    grid[6 * 16 + 8].x > fine[6 * 16 + 8].x,
    'coarse pins retain broader influence than later fine pins',
  );
});

test('lowering resolution retains colliding fine pins and prioritizes coarse ones', async () => {
  assert.equal(typeof engine.activeAnchors, 'function');
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let h = {
    present: { size: 4, frame: { x: 0, y: 0, w: 320, h: 320 }, anchors: [] },
    past: [],
    future: [],
  };
  h = editDotDocument(h, { type: 'pin', anchor: { col: 1, row: 1, x: 150, y: 130 } });
  h = editDotDocument(h, { type: 'resolution', size: 16 });
  h = editDotDocument(h, { type: 'pin', anchor: { col: 7, row: 7, x: 180, y: 170 } });
  h = editDotDocument(h, { type: 'resolution', size: 2 });
  assert.equal(h.present.anchors.length, 2);
  assert.equal(engine.activeAnchors(h.present.anchors).length, 1);
  const coarse = engine.activeAnchors(h.present.anchors)[0];
  assert.equal(coarse.basisSize, 4);
  h = editDotDocument(h, { type: 'pin', anchor: { ...coarse, x: 155 } });
  assert.equal(
    h.present.anchors.length,
    2,
    'editing a coarse pin must not discard overlapping fine pins',
  );
  h = editDotDocument(h, { type: 'resolution', size: 16 });
  assert.equal(engine.activeAnchors(h.present.anchors).length, 2);
  assert.equal(h.present.anchors.find((a) => a.basisSize === 16).x, 180);
  h = editDotDocument(h, { type: 'resolution', size: 2 });
  h = editDotDocument(h, { type: 'remove', col: 0, row: 0 });
  assert.equal(h.present.anchors.length, 1);
  assert.equal(h.present.anchors[0].basisSize, 16);
});

test('resolution changes preserve source pins and round-trip without coordinate drift', async () => {
  const { editDotDocument } = await import('../src/workspace/dotpixel/document.ts');
  let h = {
    present: {
      size: 4,
      frame: { x: 0, y: 0, w: 320, h: 320 },
      anchors: [],
      lines: [
        [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
      ],
      levels: 4,
    },
    past: [],
    future: [],
  };
  h = editDotDocument(h, { type: 'pin', anchor: { col: 1, row: 1, x: 150, y: 130 } });
  const coarse = h.present;
  h = editDotDocument(h, { type: 'resolution', size: 16 });
  assert.equal(h.present.size, 16);
  assert.equal(h.present.anchors[0].col, 6);
  assert.equal(h.present.anchors[0].row, 6);
  assert.equal(h.present.anchors[0].x, 150);
  assert.equal(h.present.anchors[0].y, 130);
  assert.equal(h.present.anchors[0].basisSize, 4);
  assert.deepEqual(h.present.lines, coarse.lines);
  assert.equal(h.present.levels, 4);
  assert.deepEqual(editDotDocument(h, { type: 'undo' }).present, coarse);
  for (const size of [7, 2, 32, 4]) h = editDotDocument(h, { type: 'resolution', size });
  assert.deepEqual(h.present.anchors, coarse.anchors);
  for (const size of [NaN, Infinity, 0, -4, 129, 3.5])
    assert.equal(editDotDocument(h, { type: 'resolution', size }), h);
});

test('adjusting a frame carries pins and outlines with it and is undoable', async () => {
  const model = await import('../src/workspace/dotpixel/document.ts');
  const initial = {
    frame: { x: 0, y: 0, w: 100, h: 100 },
    anchors: [{ col: 2, row: 2, x: 20, y: 30 }],
    lines: [
      [
        { x: 10, y: 10 },
        { x: 50, y: 60 },
      ],
    ],
    levels: 4,
  };
  const history = { present: initial, past: [], future: [] };
  const adjusted = model.editDotDocument(history, {
    type: 'adjust-frame',
    frame: { x: 10, y: 20, w: 200, h: 200 },
  });
  assert.deepEqual(adjusted.present.anchors, [{ col: 2, row: 2, x: 50, y: 80 }]);
  assert.deepEqual(adjusted.present.lines, [
    [
      { x: 30, y: 40 },
      { x: 110, y: 140 },
    ],
  ]);
  assert.equal(adjusted.present.levels, 4);
  assert.deepEqual(model.editDotDocument(adjusted, { type: 'undo' }).present, initial);
});

test('outline and colour controls participate in undo and survive a new frame', async () => {
  const model = await import('../src/workspace/dotpixel/document.ts');
  let history = {
    present: { frame: { x: 0, y: 0, w: 100, h: 100 }, anchors: [], lines: [] },
    past: [],
    future: [],
  };
  const line = [
    { x: 10, y: 10 },
    { x: 50, y: 60 },
  ];
  history = model.editDotDocument(history, { type: 'line', line });
  assert.deepEqual(history.present.lines, [line]);
  history = model.editDotDocument(history, {
    type: 'settings',
    settings: { levels: 4, radius: 3, strength: 0.5 },
  });
  assert.equal(history.present.levels, 4);
  history = model.editDotDocument(history, { type: 'clear-lines' });
  assert.deepEqual(history.present.lines, []);
  history = model.editDotDocument(history, { type: 'undo' });
  assert.deepEqual(history.present.lines, [line]);
  history = model.editDotDocument(history, { type: 'frame', frame: { x: 0, y: 0, w: 80, h: 80 } });
  assert.equal(history.present.levels, 4);
  assert.deepEqual(history.present.lines, []);
});

test('posterize reduces RGB levels without modifying original pixels or alpha; off restores source', () => {
  assert.equal(typeof engine.posterizeSource, 'function');
  const source = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([40, 100, 240, 127, 0, 128, 255, 0]),
  };
  const reduced = engine.posterizeSource(source, 3);
  assert.deepEqual(Array.from(reduced.data), [0, 128, 255, 127, 0, 128, 255, 0]);
  assert.equal(source.data[0], 40);
  assert.deepEqual(engine.posterizeSource(source, 0), source);
});

test('outline attraction pulls nearby automatic samples, not pins or distant cells', () => {
  const f = { x: 0, y: 0, w: 320, h: 320 };
  const pins = [{ col: 5, row: 5, x: 55, y: 55 }];
  const lines = [
    [
      { x: 60, y: 0 },
      { x: 60, y: 320 },
    ],
  ];
  const plain = engine.buildSampleGrid(f, 32, pins);
  const pulled = engine.buildSampleGrid(f, 32, pins, { lines, radius: 2, strength: 1 });
  assert.ok(pulled[4 * 32 + 5].x > plain[4 * 32 + 5].x);
  assert.ok(pulled[4 * 32 + 5].x <= 60);
  assert.deepEqual(pulled[5 * 32 + 5], pins.map(({ x, y }) => ({ x, y }))[0]);
  assert.deepEqual(pulled[31 * 32 + 31], plain[31 * 32 + 31]);
  assert.deepEqual(engine.buildSampleGrid(f, 32, pins, { lines, radius: 2, strength: 0 }), plain);
  const degenerate = engine.buildSampleGrid(f, 32, [], {
    lines: [
      [
        { x: 60, y: 60 },
        { x: 60, y: 60 },
      ],
    ],
    radius: 2,
    strength: 1,
  });
  assert.ok(degenerate.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test('existing frame moves and resizes within image bounds', async () => {
  const geometry = await import('../src/workspace/dotpixel/frameGeometry.ts').catch(() => ({}));
  assert.equal(typeof geometry.adjustFrame, 'function');
  const f = { x: 40, y: 30, w: 100, h: 100 };
  assert.deepEqual(geometry.adjustFrame(f, 'move', 500, -100, 512, 512, true), {
    x: 412,
    y: 0,
    w: 100,
    h: 100,
  });
  assert.deepEqual(geometry.adjustFrame(f, 'se', 50, 20, 512, 512, false), {
    x: 40,
    y: 30,
    w: 150,
    h: 120,
  });
  assert.deepEqual(geometry.adjustFrame(f, 'nw', -20, -20, 512, 512, true), {
    x: 20,
    y: 10,
    w: 120,
    h: 120,
  });
  const clamped = geometry.adjustFrame(f, 'nw', 200, 200, 512, 512, false);
  assert.ok(clamped.w >= 1 && clamped.h >= 1);
  const square = geometry.adjustFrame(f, 'e', 1000, 0, 512, 512, true);
  assert.equal(square.w, square.h);
  assert.ok(
    square.x >= 0 && square.y >= 0 && square.x + square.w <= 512 && square.y + square.h <= 512,
  );
});

test('DotPixel samples crop cell centres without averaging source colours or alpha', () => {
  assert.equal(typeof engine.sampleDotPixel, 'function');
  const source = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) };
  for (let i = 0; i < 64; i++) source.data.set([i, 255 - i, 20, i % 2 ? 255 : 0], i * 4);
  const output = engine.sampleDotPixel(source, { x: 2, y: 2, w: 4, h: 4 }, 2, []);
  assert.deepEqual(
    Array.from(output),
    [27, 228, 20, 255, 29, 226, 20, 255, 43, 212, 20, 255, 45, 210, 20, 255],
  );
});

test('anchors pin exact source samples, bend nearby samples, and leave distant cells alone', () => {
  assert.equal(typeof engine.buildSampleGrid, 'function');
  const frame = { x: 0, y: 0, w: 320, h: 320 };
  const anchors = [{ col: 5, row: 5, x: 65, y: 52 }];
  const grid = engine.buildSampleGrid(frame, 32, anchors);
  assert.deepEqual(grid[5 * 32 + 5], { x: 65, y: 52 });
  assert.ok(grid[5 * 32 + 6].x > 65);
  assert.ok(grid[5 * 32 + 6].x < 75);
  assert.deepEqual(grid[31 * 32 + 31], { x: 315, y: 315 });
  const source = { width: 320, height: 320, data: new Uint8ClampedArray(320 * 320 * 4) };
  source.data.set([250, 20, 70, 123], (52 * 320 + 65) * 4);
  const output = engine.sampleDotPixel(source, frame, 32, anchors);
  assert.deepEqual(
    Array.from(output.slice((5 * 32 + 5) * 4, (5 * 32 + 5) * 4 + 4)),
    [250, 20, 70, 123],
  );
});

test('editing replaces occupied cells and undo restores anchors and framing', async () => {
  const model = await import('../src/workspace/dotpixel/document.ts').catch(() => ({}));
  assert.equal(typeof model.editDotDocument, 'function');
  const initial = { frame: { x: 0, y: 0, w: 512, h: 512 }, anchors: [] };
  let history = { present: initial, past: [], future: [] };
  const anchor = { col: 1, row: 2, x: 25, y: 40 };
  history = model.editDotDocument(history, { type: 'pin', anchor });
  history = model.editDotDocument(history, { type: 'pin', anchor: { ...anchor, x: 30 } });
  assert.equal(history.present.anchors.length, 1);
  assert.equal(history.present.anchors[0].x, 30);
  history = model.editDotDocument(history, { type: 'undo' });
  assert.equal(history.present.anchors[0].x, 25);
  history = model.editDotDocument(history, { type: 'redo' });
  assert.equal(history.present.anchors[0].x, 30);
  history = model.editDotDocument(history, {
    type: 'frame',
    frame: { x: 20, y: 20, w: 100, h: 100 },
  });
  assert.equal(history.present.anchors.length, 0);
  history = model.editDotDocument(history, { type: 'undo' });
  assert.deepEqual(history.present.frame, initial.frame);
  assert.equal(history.present.anchors.length, 1);
  history = model.editDotDocument(history, { type: 'remove', col: 1, row: 2 });
  assert.equal(history.present.anchors.length, 0);
  assert.equal(history.future.length, 0);
});
