async page => {
  const output = '/Users/pany/.paseo/worktrees/05tg6iwp/fearless-spider/games/inkline-showcase/public/review';
  const chapters = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let overlay;
  const pause = ms => page.waitForTimeout(ms);
  const focus = async enabled => {
    const button = page.getByRole('button', { name: enabled ? 'Expand stage' : 'Exit stage view', exact: true });
    if (await button.count()) await button.click();
  };
  const mode = async name => {
    await focus(false);
    await page.getByRole('tab', { name }).click();
    await page.getByLabel('Loading scene', { exact: true }).waitFor({ state: 'hidden' });
    await pause(600);
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
    for (let i = 1; i <= 50; i++) { await page.mouse.move(x + dx * i / 50, y + dy * i / 50); await pause(25); }
    await page.mouse.up();
  };
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await pause(1500);
  await page.getByRole('button', { name: /Q:.*MOBILE/ }).click();
  await camera('Side'); await focus(true);
  await page.screencast.start({ path: `${output}/inkline-tour.webm`, size: { width: 1600, height: 1000 } });
  const start = Date.now();
  const chapter = async (title, description) => {
    if (overlay) await overlay.dispose();
    chapters.push({ title, description, time: +((Date.now() - start) / 1000).toFixed(2) });
    overlay = await page.screencast.showOverlay(`<div style="position:absolute;left:24px;top:78px;max-width:340px;padding:12px 16px;background:#151716ed;color:#eeece5;border-left:3px solid #d45538;font:13px/1.45 system-ui"><strong style="display:block;font-size:17px;margin-bottom:4px">${title}</strong>${description}</div>`);
    await pause(2200); await overlay.dispose(); overlay = null;
  };
  try {
    await chapter('01 / Clear figures. Decisive action.', 'Normal-speed playback. Weighted poses, short tool trails, target travel, and brief contact holds.');
    await pause(6500); await page.screenshot({path:`${output}/overview.png`});
    await camera('Perspective'); await pause(5500);

    await mode(/Parkour Trial/); await focus(true);
    await chapter('02 / One complete industrial level', 'Light decks and quiet seams keep the figure clear. Follow seven checkpoints through the district.');
    await hold('s', 240); await pause(250);
    await hold('d', 980); await hold('w', 1100); await pause(450);
    await hold('w', 1220); await pause(400);
    await page.screenshot({path:`${output}/parkour.png`});
    await hold('w', 975); await pause(500);
    await hold('a', 975); await hold('w', 600); await pause(300);
    await page.getByRole('application').focus(); await page.keyboard.press('Space'); await hold('a', 730); await pause(350);
    await hold('s', 950); await pause(500); await hold('s', 1700);
    await page.getByText('Route complete. Press R to run again.', { exact: true }).first().waitFor({ state: 'visible', timeout: 3000 });
    await pause(1500); await camera('Side'); await pause(1200);

    await mode(/Combat Arena/); await camera('Third-Person'); await focus(true);
    await chapter('03 / Contact drives the hit', 'The strike pose, damage, impact mark, and target response share one authored contact time.');
    await hold('w', 560);
    await page.keyboard.press('j'); await pause(330); await page.screenshot({path:`${output}/combat.png`}); await pause(700);
    for (let i=0;i<3;i++) { await page.keyboard.press('j'); await pause(850); }
    await camera('Top-Down'); await pause(1500);
    for (let i=0;i<4;i++) { await page.keyboard.press('j'); await pause(850); }
    await pause(700);

    await mode(/Animation Library/); await camera('Side');
    await chapter('04 / Read each phase', 'Inspect preparation, contact, and recovery with reduced accents. All 12 figures have 85 clips. Shared branch points, planted feet, clear strikes, and separate forward recovery.');
    await page.getByLabel('Motion accents', {exact:true}).selectOption('reduced');
    for (const id of ['punch-heavy','kick-roundhouse','sprint','ledge-climb']) {
      await page.getByRole('searchbox').fill(id); await page.getByRole('listbox',{name:'Animation Clips',exact:true}).getByRole('option').first().click(); await pause(2600);
    }
    for (const [clip, gear] of [['sword-overhead', 'sword'], ['staff-sweep', 'staff']]) {
      await page.getByRole('searchbox').fill(clip); await page.getByRole('listbox',{name:'Animation Clips',exact:true}).getByRole('option').first().click();
      await page.getByLabel('Preview equipment', { exact: true }).selectOption(gear); await pause(2500);
    }
    await page.getByLabel('Motion accents', {exact:true}).selectOption('full');
    await page.getByLabel('Preview equipment', { exact: true }).selectOption('');
    await page.getByRole('searchbox').fill('kick-roundhouse'); await page.getByRole('listbox',{name:'Animation Clips',exact:true}).getByRole('option').first().click();
    await page.getByRole('slider',{name:'Animation position',exact:true}).fill('0.37'); await pause(1000);
    await page.screenshot({path:`${output}/motion.png`});

    await mode(/Avatar Lab/);
    await chapter('05 / A consistent character family', 'Six body families. Twelve role kits. Edit proportions, color, headwear, and equipment.');
    await page.getByRole('button',{name:/Stick Heavy/}).click(); await page.getByRole('button',{name:'Apply Heavy kit',exact:true}).click(); await pause(1500);
    await page.getByRole('button',{name:/Staff Adept/}).first().click(); await page.getByRole('button',{name:'Apply Staff Adept kit',exact:true}).click(); await pause(1800);
    await page.getByRole('button',{name:/Stick Sentinel/}).click(); await page.getByRole('button',{name:'Apply Sentinel kit',exact:true}).click(); await pause(1800);
    await page.getByRole('button',{name:/Stick Worker/}).click(); await page.getByRole('button',{name:'Apply Worker kit',exact:true}).click(); await pause(1800);
    await page.getByRole('button',{name:/Stick Runner/}).click(); await page.getByRole('button',{name:'Apply Runner kit',exact:true}).click(); await pause(1500);
    await page.getByRole('button',{name:'Select body color #faf9f5',exact:true}).click(); await pause(1800);
    await page.getByRole('button',{name:'Select body color #151716',exact:true}).click();
    await page.getByRole('radio',{name:'Headband',exact:true}).click();
    await page.getByLabel('Weapons / Sports / Sci-Fi / Held Props:').selectOption('rifle'); await pause(2000);
    await page.screenshot({path:`${output}/avatar.png`});
    await orbit(65,0);

    await page.getByRole('button',{name:/Staff Adept/}).first().click();
    await page.getByRole('button',{name:'Apply Staff Adept kit',exact:true}).click(); await pause(800);
    await mode(/Combat Arena/); await camera('Third-Person'); await focus(true);
    await chapter('06 / Equipment in play', 'Staff and shield attacks use distinct moves. Rifle shots use short traces and the nearest visible target.');
    await hold('w',430);
    for(let i=0;i<4;i++){await page.keyboard.press('j');await pause(950);}
    await pause(600);
    if (Number(await page.locator('.ink-stage-gamepad-overlay .ink-hud-score').textContent()) <= 0) throw new Error('The staff sequence did not score a hit.');
    await mode(/Avatar Lab/);
    await page.getByRole('button',{name:/Stick Sentinel/}).click();
    await page.getByRole('button',{name:'Apply Sentinel kit',exact:true}).click(); await pause(900);
    await mode(/Combat Arena/); await focus(true); await hold('w',510);
    for(let i=0;i<3;i++){await page.keyboard.press('j');await pause(950);}
    await pause(800);
    if (Number(await page.locator('.ink-stage-gamepad-overlay .ink-hud-score').textContent()) <= 0) throw new Error('The shield sequence did not score a hit.');

    await mode(/Avatar Lab/);
    await page.getByRole('button',{name:/Stick Agent/}).click();
    await page.getByRole('button',{name:'Apply Agent kit',exact:true}).click();
    await page.getByLabel('Weapons / Sports / Sci-Fi / Held Props:').selectOption('rifle'); await pause(700);
    await mode(/Combat Arena/); await camera('Third-Person'); await focus(true);
    for(let i=0;i<4;i++){await page.getByRole('application').focus();await page.keyboard.press('j');await pause(650);}
    await pause(700);
    if (Number(await page.locator('.ink-stage-gamepad-overlay .ink-hud-score').textContent()) <= 0) throw new Error('The rifle sequence did not score a hit.');

    await mode(/VFX Catalog/);
    await chapter('07 / Small, graphic impact marks', '64 procedural effects. Dark stars, paper cores, tapered trails, open dust strokes, and sparks.');
    for(const id of ['blade-contact','welding-arc','steam-burst','electric-arc','guard-shock','hard-stop']){
      await page.getByRole('searchbox').fill(id);await page.getByRole('option').first().click();await pause(700);
      await page.getByRole('button',{name:/TRIGGER/}).click();await pause(100);await page.screenshot({path:`${output}/effect-${id}.png`});await pause(1000);
    }

    await mode(/District Scene/);
    await chapter('08 / The full environment kit', '291 props and 185 industrial parts. Three assembled scenes: District, Service Yard, and Roof Works.');
    await focus(true); await pause(1000); await page.screenshot({path:`${output}/district.png`});
    await orbit(100,-15); await camera('Top-Down'); await pause(1600);
    for(const [label,id] of [['Service Yard','service-yard'],['Roof Works','roof-works']]) {
      await focus(false); await page.getByRole('radio',{name:label,exact:true}).click();
      await page.getByLabel('Loading scene',{exact:true}).waitFor({state:'hidden'});
      await camera('Perspective'); await focus(true); await pause(2000);
      await page.screenshot({path:`${output}/${id}.png`}); await orbit(70,-10); await pause(1400);
    }
    await mode(/Model Catalog/);
    for(const id of ['roof-access-hatch','loading-platform','pipe-manifold']){await page.getByRole('searchbox').fill(id);await page.getByRole('listbox',{name:'3D Model Catalog',exact:true}).getByRole('option').first().click();await pause(1400);}

    await mode(/Overview/);await focus(true);await camera('Side');
    await chapter('09 / Review the actual assets', 'Open the live demo or download the updated pack. This is a desktop recording; Android testing is still required.');
    await pause(5000);
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    if(overlay)await overlay.dispose();
    await page.screencast.stop();
    await page.evaluate(metadata=>{window.__inklineTour=metadata;},{chapters,duration:+((Date.now()-start)/1000).toFixed(2),errors});
  }
}
