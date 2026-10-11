async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { const api = window.inklineAudit; api.set({ mode: 'parkour', camera: 'third-person', motion: 'full', playing: true, reset: api.state().settings.reset + 1 }); });
  await page.waitForFunction(() => !window.inklineAudit.state().stats?.loading);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const active = new Set();
  const input = (action, pressed) => page.evaluate(detail => window.dispatchEvent(new CustomEvent('inkline-input', { detail })), { action, pressed });
  const waypoints = [[[0, 9]], [[4, 9], [4, 4.5]], [[4, -.5]], [[4, -4.5]], [[0, -7]]];
  const route = [];
  for (const [index, points] of waypoints.entries()) {
    let waypoint = 0;
    const start = Date.now();
    while (true) {
      const state = await page.evaluate(() => window.inklineAudit.artState());
      route.push({ checkpoint: state.checkpoint, body: state.body.position, camera: state.camera });
      if (state.checkpoint > index) break;
      if (Date.now() - start > 12000) throw new Error(`Route checkpoint ${index + 1} timed out at ${JSON.stringify(state.body.position)}.`);
      const [x, z] = points[waypoint], dx = x - state.body.position.x, dz = z - state.body.position.z;
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= .14 && waypoint < points.length - 1) {
        for (const action of active) await input(action, false);
        active.clear(); waypoint++; continue;
      }
      const next = new Set();
      if (Math.abs(dx) > .14) next.add(dx > 0 ? 'right' : 'left');
      if (Math.abs(dz) > .14) next.add(dz > 0 ? 'back' : 'forward');
      for (const action of active) if (!next.has(action)) await input(action, false);
      for (const action of next) if (!active.has(action)) await input(action, true);
      active.clear(); next.forEach(action => active.add(action));
      await page.waitForTimeout(Math.hypot(dx, dz) < .5 ? 20 : 80);
    }
    for (const action of active) await input(action, false);
    active.clear();
  }
  const views = [];
  for (const camera of ['third-person', 'top', 'side', 'perspective']) {
    await page.evaluate(camera => window.inklineAudit.set({ camera }), camera);
    await page.waitForTimeout(2000);
    views.push({ camera, art: await page.evaluate(() => window.inklineAudit.artState()) });
    await page.screenshot({ path: `games/inkline-showcase/docs/verification/correction/camera-low-ceiling-${camera}.png` });
  }
  return { route, views, errors, stats: await page.evaluate(() => window.inklineAudit.state().stats) };
}
