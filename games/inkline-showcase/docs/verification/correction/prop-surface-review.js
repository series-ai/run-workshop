async page => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('tab', { name: 'Model Catalog' }).click();
  await page.getByRole('button', { name: 'Props & Kit' }).click();

  const cases = [
    { label: 'Low Industrial Ramp', file: 'ramp-low' },
    { label: 'Low Platform', file: 'platform-low' },
    { label: 'Vertical Pipe Riser', file: 'pipe-riser' },
    { label: 'Toxic Hazmat Drum', file: 'barrel-toxic' },
    { label: 'Wall Electrical Panel', file: 'electrical-panel-wall' },
    { label: 'Vault Rail', file: 'vault-rail' },
  ];

  const search = page.getByRole('searchbox', { name: 'Search models' });
  const results = [];
  for (const item of cases) {
    await search.fill(item.label);
    const option = page.getByRole('option', { name: new RegExp(`^${item.label} prop`) });
    await option.waitFor({ state: 'visible' });
    await option.click();
    await page.getByRole('heading', { name: item.label }).waitFor({ state: 'visible' });
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Reset stage', exact: true }).click();
    await page.waitForTimeout(250);

    const closePath = `docs/verification/correction/prop-surface-${item.file}-close.png`;
    await page.screenshot({ path: closePath, scale: 'device', type: 'png' });

    await page.mouse.move(550, 430);
    await page.mouse.down();
    await page.mouse.move(650, 385, { steps: 8 });
    await page.mouse.move(720, 455, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const orbitPath = `docs/verification/correction/prop-surface-${item.file}-orbit.png`;
    await page.screenshot({ path: orbitPath, scale: 'device', type: 'png' });

    await page.mouse.move(550, 430);
    await page.mouse.wheel(0, 560);
    await page.waitForTimeout(250);
    const districtPath = `docs/verification/correction/prop-surface-${item.file}-district.png`;
    await page.screenshot({ path: districtPath, scale: 'device', type: 'png' });

    results.push({
      id: item.file,
      label: item.label,
      close: closePath,
      orbit: orbitPath,
      district: districtPath,
    });
  }

  return { cases: results, normalOrbit: true, distanceViews: ['close', 'district'] };
}
