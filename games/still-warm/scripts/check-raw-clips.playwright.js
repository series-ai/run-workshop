async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4321/proof.html');
  await page.waitForFunction(() => document.querySelector('dd')?.textContent?.includes('Armature'));
  const labels = await page.locator('.sequence').evaluateAll(elements => elements.map(element => element.firstChild.textContent.trim()));
  const results = [];
  for (const label of labels) {
    await page.locator('.sequence').filter({ hasText: label }).first().click();
    await page.waitForFunction(() => document.querySelector('dd')?.textContent?.includes('Armature'));
    const info = await page.locator('dd').allTextContents();
    await page.getByRole('button', {name: 'Restart', exact: true}).click();
    const first = await page.locator('canvas').screenshot();
    await page.waitForTimeout(450);
    const second = await page.locator('canvas').screenshot();
    if (first.equals(second)) throw Error(label + ': animation did not advance');
    await page.getByRole('button', {name: 'Pause', exact: true}).click();
    const paused = await page.locator('canvas').screenshot();
    await page.waitForTimeout(200);
    if (!paused.equals(await page.locator('canvas').screenshot())) throw Error(label + ': pause failed');
    await page.screenshot({path: '/tmp/raw-clip-' + label.replace(/[^a-z0-9]/gi, '-') + '.png'});
    results.push({label, clip: info[0], duration: info[1], tracks: info[2]});
  }
  if (errors.length) throw Error(errors.join('\n'));
  return results;
}
