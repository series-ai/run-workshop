async page => {
  const output = '/Users/pany/.paseo/worktrees/05tg6iwp/fearless-spider/games/inkline-showcase/public/review';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4197');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const ready = () => page.getByLabel('Loading scene', { exact: true }).waitFor({ state: 'hidden' });
  const pause = ms => page.waitForTimeout(ms);
  const touch = async (name, duration = 65) => {
    const button = page.getByRole('button', { name, exact: true }).first();
    await button.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await pause(duration);
    await button.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  };
  await ready();
  await page.getByRole('tab', { name: /Combat/ }).click(); await ready();
  await pause(1200);
  await page.screencast.start({ path: `${output}/inkline-phone.webm`, size: { width: 390, height: 844 } });
  const start = Date.now();
  let score = 0;
  try {
    await pause(1200);
    await touch('Move Forward (W / Up)', 560);
    for (let index = 0; index < 3; index++) { await touch('Attack (J)'); await pause(1100); }
    score = Number(await page.locator('.ink-stage-gamepad-overlay .ink-hud-score').textContent());
    if (score <= 0) throw new Error('The phone control sequence did not score a hit.');
    await page.getByRole('button', { name: 'Side', exact: true }).click(); await pause(1800);
    await touch('Jump (Space)'); await pause(1800);
    await page.getByRole('tab', { name: /Motion/ }).click(); await ready();
    await page.getByRole('button', { name: 'Open control panel', exact: true }).click();
    await page.getByRole('searchbox').fill('staff-thrust');
    await page.getByRole('listbox', { name: 'Animation Clips', exact: true }).getByRole('option').first().click();
    await page.getByLabel('Preview equipment', { exact: true }).selectOption('staff');
    await page.getByRole('button', { name: 'Close control panel', exact: true }).click();
    await pause(6500);
    await page.getByRole('button', { name: 'Open control panel', exact: true }).click();
    await page.getByRole('searchbox').fill('sword-overhead');
    await page.getByRole('listbox', { name: 'Animation Clips', exact: true }).getByRole('option').first().click();
    await page.getByLabel('Preview equipment', { exact: true }).selectOption('sword');
    await page.getByRole('button', { name: 'Close control panel', exact: true }).click();
    await pause(6500);
    await page.getByRole('button', { name: 'Perspective', exact: true }).click(); await pause(4500);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('The phone layout overflows.');
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await page.screencast.stop();
    await page.evaluate(result => { window.__phoneTour = result; }, { duration: (Date.now() - start) / 1000, width: 390, height: 844, score, errors, physicalAndroid: 'UNVERIFIED' });
  }
}
