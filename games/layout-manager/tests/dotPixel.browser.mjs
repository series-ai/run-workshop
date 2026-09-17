// Run with a dev server and PLAYWRIGHT_MODULE pointing to playwright's index.mjs.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem('layout-manager-config', JSON.stringify({ showWelcome: false })),
  );
  await page.goto(process.env.DOTPIXEL_URL || 'http://127.0.0.1:5173');
  await page.waitForSelector('.toolbar');
  assert.equal(
    await page.getByRole('button', { name: 'DotPixel', exact: true }).count(),
    1,
    'DotPixel entry point exists',
  );
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < 512; y += 8)
      for (let x = 0; x < 512; x += 8) {
        ctx.fillStyle = `rgb(${x / 2},${y / 2},80)`;
        ctx.fillRect(x, y, 8, 8);
      }
    return canvas.toDataURL().split(',')[1];
  });
  await page
    .locator('input[type=file][accept*="image/"]')
    .first()
    .setInputFiles({
      name: 'dotpixel-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
  await page
    .locator('.image-node')
    .filter({ has: page.getByAltText('dotpixel-test.png', { exact: true }) })
    .click();
  await page.getByRole('button', { name: 'DotPixel', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'DotPixel' });
  await dialog.waitFor();
  const source = dialog.locator('svg.dotpixel-source');
  await source.waitFor();
  assert.equal(
    await page
      .locator('.lock-icon-btn')
      .first()
      .evaluate((button) => {
        const b = button.getBoundingClientRect();
        return !!document
          .elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
          ?.closest('.dotpixel-editor');
      }),
    true,
    'workspace controls cannot appear above DotPixel',
  );
  const preview = dialog.locator('canvas');
  assert.equal(await dialog.getByRole('button', { name: 'Rows', exact: true }).count(), 1);
  assert.equal(await dialog.getByRole('button', { name: 'Columns', exact: true }).count(), 1);
  const allSamples = () =>
    dialog.locator('[data-sample]').evaluateAll((nodes) =>
      nodes
        .map((n) => ({
          id: Number(n.getAttribute('data-sample')),
          x: Number(n.getAttribute('x')),
          y: Number(n.getAttribute('y')),
        }))
        .sort((a, b) => a.id - b.id),
    );
  const dragSample = async (id, dx, dy, cancel = false) => {
    const b = await dialog.locator(`[data-sample="${id}"]`).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 5 });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
  };
  for (const [tool, axis] of [
    ['Rows', 'row'],
    ['Columns', 'column'],
  ]) {
    await dialog.getByRole('button', { name: tool, exact: true }).click();
    const baseline = await allSamples();
    await dragSample(5 * 32 + 5, 12, 12);
    const changed = await allSamples();
    for (let i = 0; i < baseline.length; i++) {
      const inBand = axis === 'row' ? Math.floor(i / 32) === 5 : i % 32 === 5;
      assert.equal(changed[i][axis === 'row' ? 'x' : 'y'], baseline[i][axis === 'row' ? 'x' : 'y']);
      if (inBand)
        assert.ok(changed[i][axis === 'row' ? 'y' : 'x'] > baseline[i][axis === 'row' ? 'y' : 'x']);
      else assert.deepEqual(changed[i], baseline[i]);
    }
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual(await allSamples(), baseline);
    await dragSample(5 * 32 + 5, 12, 12, true);
    assert.equal(await dialog.count(), 1, 'Escape during a drag must not close the editor');
    assert.deepEqual(await allSamples(), baseline, 'Escape cancels the whole band drag');
    await dialog.getByRole('checkbox', { name: 'Soft selection', exact: true }).check();
    await dragSample(5 * 32 + 5, 12, 12);
    const soft = await allSamples();
    const near = axis === 'row' ? 6 * 32 + 5 : 5 * 32 + 6;
    assert.notDeepEqual(soft[near], baseline[near]);
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'Soft selection', exact: true }).uncheck();
  }
  await dialog.getByRole('button', { name: 'Anchors', exact: true }).click();
  assert.equal(
    await dialog.getByRole('spinbutton', { name: 'Custom width', exact: true }).count(),
    1,
  );
  assert.equal(
    await dialog.getByRole('checkbox', { name: 'Soft selection', exact: true }).count(),
    1,
  );
  assert.equal(
    await dialog.getByRole('checkbox', { name: 'Soft selection', exact: true }).isChecked(),
    false,
  );
  assert.equal(
    await dialog.getByRole('slider', { name: 'Output resolution', exact: true }).count(),
    1,
  );
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [32, 32]);
  const before = await preview.evaluate((c) => c.toDataURL());
  assert.equal(
    await dialog.locator('rect[data-sample]').count(),
    1024,
    'all sample points are colour-filled squares',
  );
  await source.click({ position: { x: 100, y: 100 } });
  assert.equal(await dialog.locator('[data-anchor]').count(), 1);
  const anchor = dialog.locator('[data-anchor]').first();
  assert.equal(await anchor.evaluate((node) => node.tagName), 'rect');
  assert.match(await anchor.getAttribute('fill'), /^rgba?\(/);
  const box = await anchor.boundingBox();
  const neighbourPositions = () =>
    dialog
      .locator('[data-sample]:not([data-anchor])')
      .evaluateAll((nodes) =>
        nodes.map((n) => [n.getAttribute('data-sample'), n.getAttribute('x'), n.getAttribute('y')]),
      );
  const isolatedBefore = await neighbourPositions();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 25, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await preview.evaluate((c) => c.toDataURL()), before);
  assert.deepEqual(
    await neighbourPositions(),
    isolatedBefore,
    'default drag changes only its own sample',
  );
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await dialog.locator('[data-anchor]').count(), 1);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await dialog.locator('[data-anchor]').count(), 0);
  assert.equal(await preview.evaluate((c) => c.toDataURL()), before);
  await dialog.getByRole('button', { name: 'Redo', exact: true }).click();
  const dragCurrentPin = async () => {
    const b = await anchor.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 25, b.y + b.height / 2, { steps: 4 });
    await page.mouse.up();
  };
  await dialog.getByRole('checkbox', { name: 'Soft selection', exact: true }).check();
  const beforeSoftDrag = await neighbourPositions();
  await dragCurrentPin();
  assert.notDeepEqual(await neighbourPositions(), beforeSoftDrag);
  await dialog.getByRole('checkbox', { name: 'Soft selection', exact: true }).uncheck();
  const beforeIsolatedDrag = await neighbourPositions();
  await dragCurrentPin();
  assert.deepEqual(await neighbourPositions(), beforeIsolatedDrag);
  await dialog.getByRole('button', { name: 'New frame', exact: true }).click();
  const sourceBox = await source.boundingBox();
  await page.mouse.move(sourceBox.x + 40, sourceBox.y + 40);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + 260, sourceBox.y + 260, { steps: 4 });
  await page.mouse.up();
  assert.equal(await dialog.locator('[data-anchor]').count(), 0);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await dialog.locator('[data-anchor]').count(), 1);
  await dialog.getByRole('button', { name: 'Frame', exact: true }).click();
  const frameBefore = await dialog.locator('[data-frame-border]').getAttribute('width');
  const resize = await dialog.locator('[data-frame-handle="se"]').boundingBox();
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x - 80, resize.y - 80, { steps: 5 });
  await page.mouse.up();
  assert.ok(
    Number(await dialog.locator('[data-frame-border]').getAttribute('width')) < Number(frameBefore),
  );
  assert.equal(await dialog.locator('[data-anchor]').count(), 1, 'resizing retains pins');
  const moveBox = await dialog.locator('[data-frame-border]').boundingBox();
  await page.mouse.move(moveBox.x + 100, moveBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(moveBox.x + 130, moveBox.y + 130, { steps: 3 });
  await page.mouse.up();
  assert.ok(Number(await dialog.locator('[data-frame-border]').getAttribute('x')) > 0);
  await dialog.getByRole('button', { name: 'Attract lines', exact: true }).click();
  const fixed = await anchor.evaluate((r) => [r.getAttribute('x'), r.getAttribute('y')]);
  const beforeLines = await preview.evaluate((c) => c.toDataURL());
  const sb = await source.boundingBox();
  await page.mouse.move(sb.x + 150, sb.y + 100);
  await page.mouse.down();
  await page.mouse.move(sb.x + 175, sb.y + 230, { steps: 12 });
  await page.mouse.up();
  assert.equal(await dialog.locator('[data-attraction-line]').count(), 1);
  assert.deepEqual(await anchor.evaluate((r) => [r.getAttribute('x'), r.getAttribute('y')]), fixed);
  assert.notEqual(await preview.evaluate((c) => c.toDataURL()), beforeLines);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await dialog.locator('[data-attraction-line]').count(), 0);
  await dialog.getByRole('button', { name: 'Redo', exact: true }).click();
  const beforePosterize = await preview.evaluate((c) => c.toDataURL());
  const sourceBefore = await source.locator('image').getAttribute('href');
  await dialog.getByLabel('Posterize', { exact: true }).check();
  assert.notEqual(await preview.evaluate((c) => c.toDataURL()), beforePosterize);
  assert.notEqual(await source.locator('image').getAttribute('href'), sourceBefore);
  await dialog.getByLabel('Posterize', { exact: true }).uncheck();
  assert.equal(await preview.evaluate((c) => c.toDataURL()), beforePosterize);
  await dialog.getByLabel('Posterize', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Clear anchors', exact: true }).click();
  await dialog.getByRole('button', { name: '4 × 4', exact: true }).click();
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [4, 4]);
  assert.equal(await dialog.locator('[data-sample]').count(), 16);
  await dialog.getByRole('button', { name: 'Anchors', exact: true }).click();
  await dialog.locator('[data-sample="5"]').click();
  const coarseAnchor = dialog.locator('[data-anchor]').first();
  const coarseBox = await coarseAnchor.boundingBox();
  await page.mouse.move(coarseBox.x + coarseBox.width / 2, coarseBox.y + coarseBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    coarseBox.x + coarseBox.width / 2 + 40,
    coarseBox.y + coarseBox.height / 2,
    { steps: 3 },
  );
  await page.mouse.up();
  const centerOfPin = () =>
    coarseAnchor.evaluate((r) => [
      Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2,
      Number(r.getAttribute('y')) + Number(r.getAttribute('height')) / 2,
    ]);
  const centre = await centerOfPin();
  const coarseOutput = await preview.evaluate((c) => c.toDataURL());
  for (const size of [8, 16, 2, 4]) {
    await dialog.getByRole('button', { name: `${size} × ${size}`, exact: true }).click();
    assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [size, size]);
    assert.equal(await dialog.locator('[data-sample]').count(), size * size);
    const point = await centerOfPin();
    assert.ok(point.every((v, i) => Math.abs(v - centre[i]) < 0.00001));
    assert.equal(await dialog.locator('[data-attraction-line]').count(), 1);
  }
  assert.equal(await preview.evaluate((c) => c.toDataURL()), coarseOutput);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [2, 2]);
  await dialog.getByRole('button', { name: 'Redo', exact: true }).click();
  await dialog.getByRole('button', { name: '8 × 8', exact: true }).click();
  await dialog.getByRole('slider', { name: 'Output resolution', exact: true }).press('ArrowRight');
  assert.deepEqual(
    await preview.evaluate((c) => [c.width, c.height]),
    [9, 9],
    'resolution can rise one pixel at a time',
  );
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [8, 8]);
  const customWidth = dialog.getByRole('spinbutton', { name: 'Custom width', exact: true });
  const customHeight = dialog.getByRole('spinbutton', { name: 'Custom height', exact: true });
  await customWidth.fill('24');
  await customHeight.fill('40');
  await dialog.getByRole('button', { name: 'Apply size', exact: true }).click();
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [24, 40]);
  assert.equal(await dialog.locator('[data-sample]').count(), 960);
  const rectangularPin = await centerOfPin();
  assert.ok(rectangularPin.every((v, i) => Math.abs(v - centre[i]) < 0.00001));
  const previewBounds = await preview.boundingBox();
  assert.ok(Math.abs(previewBounds.width / previewBounds.height - 24 / 40) < 0.01);
  await customWidth.fill('129');
  await dialog.getByRole('button', { name: 'Apply size', exact: true }).click();
  assert.equal(await customWidth.evaluate((input) => input.validity.rangeOverflow), true);
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [24, 40]);
  await customWidth.fill('24');
  await customHeight.fill('129');
  await dialog.getByRole('button', { name: 'Apply size', exact: true }).click();
  assert.equal(await customHeight.evaluate((input) => input.validity.rangeOverflow), true);
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [24, 40]);
  await customHeight.fill('40');
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [8, 8]);
  await dialog.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await customHeight.inputValue(), '40');
  for (const [w, h] of [
    [128, 128],
    [1, 128],
    [128, 1],
    [24, 40],
  ]) {
    await customWidth.fill(String(w));
    await customHeight.fill(String(h));
    await dialog.getByRole('button', { name: 'Apply size', exact: true }).click();
    assert.deepEqual(await preview.evaluate((c) => [c.width, c.height]), [w, h]);
    assert.equal(await dialog.locator('[data-sample]').count(), w * h);
  }
  const expectedOutput = await preview.evaluate((c) => c.toDataURL());
  await dialog.getByRole('button', { name: 'Add to workspace', exact: true }).click();
  await dialog.getByText('Added to workspace.', { exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/dotpixel-smoke.png' });
  await page.setViewportSize({ width: 1024, height: 768 });
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
    'editor fits a 1024px viewport',
  );
  assert.equal(
    await dialog.locator('.dotpixel-tools').evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
    'tools wrap without horizontal overflow',
  );
  page.on('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  const added = page.getByAltText('dotpixel-test-dotpixel.png', { exact: true });
  await added.waitFor();
  assert.deepEqual(await added.evaluate((img) => [img.naturalWidth, img.naturalHeight]), [24, 40]);
  assert.equal(
    await added.getAttribute('src'),
    expectedOutput,
    'workspace output exactly matches preview',
  );
  assert.equal(
    await page.locator('.image-node').getByAltText('dotpixel-test.png', { exact: true }).count(),
    1,
  );
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'PASS: axis-locked rows/columns, soft selection off/on, one-step undo and Escape cancellation, custom 24×40 export, size limits and existing editor controls; no page errors.',
  );
} finally {
  await browser.close();
}
