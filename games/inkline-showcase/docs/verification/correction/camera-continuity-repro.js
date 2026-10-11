async page => {
  const viewport = { width: 1440, height: 900 };
  const motion = 'reduced';
  await page.setViewportSize(viewport);
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false);
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const camera of ['third-person', 'side', 'top', 'perspective']) {
    await page.evaluate(({ camera, motion }) => {
      const api = window.inklineAudit;
      api.set({ mode: 'combat', camera, playing: true, motion, reset: api.state().settings.reset + 1 });
    }, { camera, motion });
    await page.waitForFunction(() => !window.inklineAudit.state().stats?.loading);
    await page.waitForTimeout(800);
    results.push(await page.evaluate(async ({ camera, motion, viewport }) => {
      const api = window.inklineAudit;
      const rows = [];
      const started = performance.now();
      let previous = '';
      const input = (action, pressed) => window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action, pressed } }));
      await new Promise(resolve => {
        function frame(now) {
          const t = (now - started) / 1000;
          const action = t < .8 ? '' : t < 2.2 ? 'forward' : t < 2.9 ? 'right' : t < 5.3 ? '' : t < 6.7 ? 'back' : t < 7.4 ? 'left' : '';
          if (action !== previous) {
            if (previous) input(previous, false);
            if (action) input(action, true);
            previous = action;
          }
          const state = api.artState();
          const actor = state.actors[0];
          const names = points => Object.entries(points).filter(([, blocked]) => blocked).map(([name]) => name);
          const outside = Object.entries(actor.joints).filter(([, point]) => point.x < 0 || point.x > viewport.width || point.y < 0 || point.y > viewport.height || point.depth <= -1 || point.depth >= 1).map(([name]) => name);
          rows.push({ t, action, position: state.camera.position, target: state.camera.target, occluded: state.camera.occluded, cutaway: state.camera.cutaway, body: state.body.position, clip: actor.clip, joints: actor.joints, blocked: actor.blocked, geometricBlocked: names(actor.blocked), outside });
          if (t < 8.5) requestAnimationFrame(frame);
          else { if (previous) input(previous, false); resolve(); }
        }
        requestAnimationFrame(frame);
      });
      const direction = row => {
        const values = row.position.map((value, index) => value - row.target[index]);
        const length = Math.hypot(...values);
        return values.map(value => value / length);
      };
      const steps = rows.slice(1).map((row, index) => {
        const before = rows[index], elapsed = row.t - before.t;
        const distance = Math.hypot(...row.position.map((value, axis) => value - before.position[axis]));
        const first = direction(before), second = direction(row);
        const angle = Math.acos(Math.max(-1, Math.min(1, first.reduce((sum, value, axis) => sum + value * second[axis], 0)))) * 180 / Math.PI;
        return { index: index + 1, distance, speed: distance / elapsed, angle, elapsed };
      });
      return { viewport, camera, motion, frames: rows.length, maxDistance: Math.max(...steps.map(step => step.distance)), maxSpeed: Math.max(...steps.map(step => step.speed)), maxAngle: Math.max(...steps.map(step => step.angle)), outsideFrames: rows.filter(row => row.outside.length).length, cutawayFrames: rows.filter(row => row.cutaway > .2).length, geometricBlockedFrames: rows.filter(row => row.geometricBlocked.length).length, worst: steps.sort((a, b) => b.distance - a.distance).slice(0, 5), rows };
    }, { camera, motion, viewport }));
  }
  return { results, errors, stats: await page.evaluate(() => window.inklineAudit.state().stats) };
}
