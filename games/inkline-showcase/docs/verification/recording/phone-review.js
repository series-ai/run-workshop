async page => {
  const output = '/Users/pany/.paseo/worktrees/05tg6iwp/fearless-spider/games/inkline-showcase/public/review';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4197');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const ready = () => page.getByLabel('Loading scene', { exact: true }).waitFor({ state: 'hidden' });
  await ready();
  await page.getByRole('tab', { name: /Combat/ }).click(); await ready();
  await page.waitForTimeout(1600);
  const forward = page.getByRole('button', { name: 'Move Forward (W / Up)', exact: true }).first();
  await forward.dispatchEvent('pointerdown', { pointerId: 1 }); await page.waitForTimeout(560); await forward.dispatchEvent('pointerup', { pointerId: 1 });
  await page.getByRole('application').focus(); await page.keyboard.press('j'); await page.waitForTimeout(310);
  await page.screenshot({ path: `${output}/phone-combat.png` });
  await page.getByRole('tab', { name: /Motion/ }).click(); await ready();
  await page.getByRole('button', { name: 'Open control panel', exact: true }).click();
  await page.getByRole('searchbox').fill('staff-thrust');
  await page.getByRole('listbox', { name: 'Animation Clips', exact: true }).getByRole('option').first().click();
  await page.getByLabel('Preview equipment', { exact: true }).selectOption('staff');
  await page.getByRole('slider', { name: 'Animation position', exact: true }).fill('0.33');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${output}/phone-animation.png` });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Phone page overflows.');
}
