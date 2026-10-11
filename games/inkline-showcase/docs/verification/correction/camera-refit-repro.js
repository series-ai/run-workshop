async page => {
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const ready = () => page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false);
  const state = () => page.evaluate(() => window.inklineAudit.artState());
  const direction = camera => { const values = camera.position.map((value, index) => value - camera.target[index]); const distance = Math.hypot(...values); return values.map(value => value / distance); };
  const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, direction(a).reduce((sum, value, index) => sum + value * direction(b)[index], 0)))) * 180 / Math.PI;
  const outside = (s, points) => points.filter(p => p.x < -.1 || p.y < -.1 || p.x > s.viewport.width + .1 || p.y > s.viewport.height + .1 || p.depth <= -1 || p.depth >= 1).length;
  const extent = (s, points) => ({ x: Math.max(...points.map(p => Math.abs(p.x / s.viewport.width * 2 - 1))), y: Math.max(...points.map(p => Math.abs(p.y / s.viewport.height * 2 - 1))) });
  const orbit = async width => {
    await page.mouse.move(width * .3, 350); await page.mouse.down(); await page.mouse.move(width * .52, 380, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(1800);
  };
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const camera of ['perspective', 'side']) {
      await page.evaluate(camera => { const a = window.inklineAudit; a.set({ mode: 'animations', camera, playing: false, seek: 0, animationId: 'idle', reset: a.state().settings.reset + 1, avatar: { ...a.state().settings.avatar, preset: 'stick-standard', equipment: null, height: 1, thickness: 1, headScale: 1 } }); }, camera);
      await ready(); await orbit(viewport.width);
      const changes = [
        { name: 'clip', patch: { animationId: 'kick-roundhouse' } },
        { name: 'proportions', avatar: { height: 1.15, thickness: 1.3, headScale: 1.2 } },
        { name: 'equipment', avatar: { equipment: 'rifle' } },
        { name: 'body preset', avatar: { preset: 'stick-heavy' } },
      ];
      for (const change of changes) {
        const before = await state();
        await page.evaluate(change => { const a = window.inklineAudit; a.set(change.avatar ? { avatar: { ...a.state().settings.avatar, ...change.avatar } } : change.patch); }, change);
        await ready();
        if (change.name === 'equipment') await page.waitForFunction(() => window.inklineAudit.artState().equipmentContact !== null);
        await page.waitForTimeout(120);
        const after = await state();
        const drift = angle(before.camera, after.camera);
        const points = Object.values(after.actors[0].joints);
        if (after.equipmentContact) points.push(after.equipmentContact);
        results.push({ kind: 'content refit', viewport, camera, change: change.name, angle: drift, outside: outside(after, points), before: before.camera, after: after.camera, pass: drift < .05 && outside(after, points) === 0 });
      }
      await page.screenshot({ path: `games/inkline-showcase/docs/verification/correction/camera-refit-${viewport.width}-${camera}.png` });
    }
  }
  for (const mode of ['animations', 'assets', 'effects', 'district']) {
    for (const camera of ['perspective', 'side']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(({ mode, camera }) => { const a = window.inklineAudit; a.set({ mode, camera, modelId: 'cargo-container', animationId: 'idle', effectId: 'punch-impact', playing: false, reset: a.state().settings.reset + 1 }); }, { mode, camera });
      await ready();
      if (mode !== 'effects') {
        await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
        const fitted = await state(), points = mode === 'animations' ? Object.values(fitted.actors[0].joints) : fitted.sceneFrame;
        results.push({ kind: 'default fit survives phone resize', mode, camera, outside: outside(fitted, points), pass: outside(fitted, points) === 0 });
        await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(200);
        await page.evaluate(() => { const a = window.inklineAudit; a.set({ reset: a.state().settings.reset + 1 }); }); await ready();
      }
      await orbit(1440);
      const before = await state();
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      const phone = await state();
      const drift = angle(before.camera, phone.camera);
      const points = mode === 'animations' ? Object.values(phone.actors[0].joints) : phone.sceneFrame;
      const priorPoints = mode === 'animations' ? Object.values(before.actors[0].joints) : before.sceneFrame;
      const beforeExtent = extent(before, priorPoints), afterExtent = extent(phone, points);
      const addedClipping = ['x', 'y'].some(axis => afterExtent[axis] > Math.max(1, beforeExtent[axis]) + .00001) || points.some(p => !Number.isFinite(p.depth) || p.depth <= -1 || p.depth >= 1);
      results.push({ kind: 'phone resize preserves user orbit framing', mode, camera, angle: drift, beforeOutside: mode === 'effects' ? null : outside(before, priorPoints), outside: mode === 'effects' ? null : outside(phone, points), beforeExtent, afterExtent, framingMeasured: mode !== 'effects', before: before.camera, after: phone.camera, pass: drift < .05 && (mode === 'effects' || !addedClipping) });
      if (mode !== 'animations') await page.screenshot({ path: `games/inkline-showcase/docs/verification/correction/camera-refit-${mode}-phone-${camera}.png` });
      await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(200);
      const wide = await state();
      const distance = Math.hypot(...wide.camera.position.map((value, index) => value - phone.camera.position[index]));
      const unit = s => { const p = s.sceneFrame; return p.length ? (Math.max(...p.map(x => x.y)) - Math.min(...p.map(x => x.y))) / s.viewport.height : 0; };
      const spanChange = unit(wide) - unit(phone);
      results.push({ kind: 'return to desktop', mode, camera, distance, spanChange, pass: distance < .002 && Math.abs(spanChange) < .0001 });
    }
  }
  return { results, errors, pass: results.every(result => result.pass) && errors.length === 0, stats: await page.evaluate(() => window.inklineAudit.state().stats) };
}
