async (page) => {
  const base = 'http://127.0.0.1:4430';
  const requests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(`${base}/`)) requests.push(url.slice(base.length).split('?')[0]);
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  const checks = [];
  for (const blockProfile of [false, true]) {
    requests.length = 0;
    if (blockProfile) await page.route('**/*physics-profile-wasm*', (route) => route.abort());
    await page.goto(`${base}/?capture=off`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) >= 30, null, { timeout: 60000 });
    const before = await page.evaluate(() => {
      const render = window.__WRECK_YARD_CONTROLLER__.getRender();
      return { frame: render.frame, position: render.players[0].position };
    });
    await page.keyboard.down('KeyW');
    await page.waitForFunction((frame) => window.__WRECK_YARD_CONTROLLER__.getRender().frame >= frame + 20, before.frame);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('Space');
    await page.waitForFunction((frame) => window.__WRECK_YARD_CONTROLLER__.getRender().frame >= frame + 40, before.frame);
    await page.keyboard.up('Space');
    const after = await page.evaluate(() => {
      const render = window.__WRECK_YARD_CONTROLLER__.getRender();
      return { frame: render.frame, position: render.players[0].position };
    });
    const profileRequests = requests.filter((path) => path.includes('physics-profile-wasm'));
    if (profileRequests.length) throw new Error('Gameplay requested the profiling artifact');
    if (after.frame < before.frame + 40) throw new Error('Simulation did not advance');
    if (Math.hypot(...after.position.map((value, index) => value - before.position[index])) <= 0.5) throw new Error('Player did not move');
    checks.push({ blockProfile, before, after, profileRequests, requests: [...new Set(requests)] });
  }
  const result = { build: 'dist', cacheDisabled: true, checks };
  return result;
}
