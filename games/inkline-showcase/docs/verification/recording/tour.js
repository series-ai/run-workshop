async page => {
  const output = '/Users/pany/.paseo/worktrees/05tg6iwp/fearless-spider/games/inkline-showcase/public/review';
  const chapters = [];
  let overlay;
  const pause = ms => page.waitForTimeout(ms);
  const mode = async name => {
    await page.getByRole('tab', { name }).click();
    await pause(1300);
    await page.getByLabel('Loading scene', { exact: true }).waitFor({ state: 'hidden' });
  };
  const camera = name => page.getByRole('button', { name, exact: true }).click();
  const hold = async (key, ms) => {
    await page.getByRole('application').focus();
    await page.keyboard.down(key); await pause(ms); await page.keyboard.up(key);
  };
  const orbit = async (dx, dy) => {
    const b = await page.getByRole('application').boundingBox();
    const x = b.x + b.width * .5, y = b.y + b.height * .55;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 80; i++) {
      await page.mouse.move(x + dx * i / 80, y + dy * i / 80);
      await pause(35);
    }
    await page.mouse.up();
  };
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await pause(1800);
  await mode(/District Scene/);
  await page.screencast.start({ path: `${output}/inkline-tour.webm`, size: { width: 1600, height: 1000 } });
  const start = Date.now();
  const chapter = async (title, description) => {
    if (overlay) await overlay.dispose();
    chapters.push({ title, description, time: +( (Date.now() - start) / 1000).toFixed(2) });
    overlay = await page.screencast.showOverlay(`<div style="position:absolute;left:248px;top:70px;max-width:820px;padding:15px 22px;background:#171b19;color:#f4f0e8;border-left:4px solid #e45b3b;box-shadow:0 6px 20px #0002;font:15px/1.5 system-ui"><div style="font:11px monospace;color:#ef9277;letter-spacing:2px;margin-bottom:3px">INKLINE / RECORDED DEMO</div><strong style="font-size:21px">${title}</strong><div style="color:#d8d9d3">${description}</div></div>`);
  };
  try {
    await chapter('01 / One industrial district', '148 placed objects. Warehouses, ramps, rails, tanks, pipes, and cargo.');
    await pause(3500);
    await page.screenshot({ path: `${output}/district.png` });
    await orbit(180, -35); await pause(1500);
    await camera('Top-Down'); await pause(4000);
    await camera('Perspective'); await pause(1800);

    await mode(/Parkour Trial/);
    await chapter('02 / Play the level', 'Run, jump, and follow seven checkpoints through the district.');
    await pause(2000);
    await hold('s', 250); await pause(700);
    await hold('d', 975); await pause(300);
    await hold('w', 1100); await pause(900);
    await page.keyboard.press('Space'); await pause(1300);
    await hold('w', 1220); await pause(600);
    await page.screenshot({ path: `${output}/parkour.png` });
    await hold('w', 975); await pause(1800);
    await camera('Side'); await hold('a', 800); await page.keyboard.press('Space'); await pause(1800);

    await mode(/Combat Arena/);
    await chapter('03 / Combat in the district', 'Live movement, attack animations, hit effects, targets, and score.');
    await pause(1800);
    await hold('w', 430);
    for (let i = 0; i < 8; i++) { await page.keyboard.press('j'); await pause(560); }
    await page.screenshot({ path: `${output}/combat.png` });
    await hold('d', 500); await page.keyboard.press('Space'); await pause(1100);
    await hold('Shift', 260); await pause(1500);

    await mode(/Avatar Lab/);
    await camera('Perspective');
    await chapter('04 / Build an avatar', '12 base characters. Change proportions, headwear, colors, and held equipment.');
    await pause(2300);
    await page.getByRole('button', { name: /Stick Heavy/ }).click(); await pause(2000);
    await page.getByRole('button', { name: /Stick Runner/ }).click(); await pause(2000);
    await page.getByRole('radio', { name: 'Cap', exact: true }).click(); await pause(1400);
    await page.getByRole('slider', { name: /Limb Thickness/ }).fill('1.2'); await pause(1400);
    await page.getByLabel('Weapons / Sports / Sci-Fi / Held Props:').selectOption('rifle'); await pause(2000);
    await orbit(110, 0); await pause(1200);
    await page.screenshot({ path: `${output}/avatar.png` });

    await mode(/Combat Arena/);
    await chapter('05 / Equipment works in play', 'The configured avatar carries its rifle into the combat level.');
    await pause(1500);
    await hold('w', 400);
    for (let i = 0; i < 10; i++) { await page.keyboard.press('j'); await pause(360); }
    await pause(1700);

    await mode(/Avatar Lab/);
    await page.getByLabel('Weapons / Sports / Sci-Fi / Held Props:').selectOption('');
    await mode(/Animation Library/);
    await camera('Perspective');
    await chapter('06 / Inspect the motion', '60 clips. Preview actions, change the view, and stop on an exact pose.');
    for (const id of ['run', 'punch-right', 'kick-roundhouse', 'roll']) {
      await page.getByRole('searchbox').fill(id);
      await page.getByRole('option').first().click(); await pause(2800);
    }
    await page.getByRole('searchbox').fill('punch-right');
    await page.getByRole('option').first().click();
    await page.getByRole('slider', { name: 'Animation position', exact: true }).fill('0.2');
    await pause(1800); await orbit(100, 0); await pause(1200);
    await page.screenshot({ path: `${output}/motion.png` });

    await mode(/VFX Catalog/);
    await chapter('07 / Graphic effects', '40 effects. Layered ink strokes, impact stars, dust, rings, and sparks.');
    await page.getByRole('slider', { name: /Effect lifetime/ }).fill('2');
    for (const id of ['heavy-impact', 'sword-slash', 'explosion', 'steam-vent', 'checkpoint']) {
      await page.getByRole('searchbox').fill(id);
      await page.getByRole('option').first().click(); await pause(1600);
      await page.getByRole('button', { name: /TRIGGER/ }).click(); await pause(1400);
    }
    await page.getByRole('button', { name: /TRIGGER/ }).click(); await pause(180);
    await page.screenshot({ path: `${output}/effects.png` }); await pause(1500);

    await mode(/Model Catalog/);
    await chapter('08 / Reusable models', '242 props and 12 characters. Search the catalog and download individual GLB files.');
    for (const id of ['pipe-elbow', 'rifle', 'soccer-goal']) {
      await page.getByRole('searchbox').fill(id);
      await page.getByRole('listbox').getByRole('option').first().click(); await pause(2600);
      await orbit(55, 0);
    }
    await page.getByRole('searchbox').fill(''); await pause(1500);

    await mode(/Performance Stress/);
    await chapter('09 / Load test controls', '100 animated figures. This recording is a desktop capture, not an Android benchmark.');
    await page.getByRole('button', { name: /Max Stress/ }).click(); await pause(6000);
    await page.screenshot({ path: `${output}/stress.png` });
    await mode(/District Scene/); await camera('Perspective');
    await chapter('10 / Ready for review', 'Explore the level. Test the actions. Inspect each asset in the live app.');
    await orbit(-90, -15); await pause(3500);
  } finally {
    if (overlay) await overlay.dispose();
    await page.screencast.stop();
    await page.evaluate(metadata => { window.__inklineTour = metadata; }, { chapters, duration: +((Date.now() - start) / 1000).toFixed(2) });
  }
}
