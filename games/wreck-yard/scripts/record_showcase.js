async (page) => {
  console.log('--- STARTING POLISHED SHOWCASE RECORDING ---');

  // Ensure game is live
  await page.waitForFunction(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    return c?.snapshot().status === 'live';
  }, { timeout: 10000 });

  // Move mouse to center of canvas
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  }

  console.log('1. Spawning into the 52m Arena with First-Person Gravity Gun Viewmodel...');
  await page.evaluate(() => {
    window.__SET_LOOK_ANGLES__?.(3.14, 0.1);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: './final-01-spawn-viewmodel.png' });

  console.log('2. Jetpack Thrusters: Flight and Aerial Survey...');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: './final-02-jetpack-flight.png' });
  await page.keyboard.up('Space');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(800); // Landing and refuel

  console.log('3. Gravity Gun: Aiming and Grabbing the Ballast Box...');
  // Query position of ballast box
  const targetAim = await page.evaluate(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    const render = c?.getRender();
    const ballast = render?.poses.get('ballast-box');
    const p = render?.players[0];
    if (!ballast || !p) return null;
    const dx = ballast.position[0] - p.position[0];
    const dy = ballast.position[1] - (p.position[1] + 1.55);
    const dz = ballast.position[2] - p.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    return {
      yaw: Math.atan2(-dx, -dz),
      pitch: Math.atan2(dy, dist),
    };
  });

  if (targetAim) {
    await page.evaluate(({ yaw, pitch }) => window.__SET_LOOK_ANGLES__?.(yaw, pitch), targetAim);
    await page.waitForTimeout(400);

    // Walk up closer to ballast box
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(300);

    // Grab with Left Click
    console.log('Holding Left Click to levitate...');
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: './final-03-gravity-levitate.png' });

    // Turn toward the bowling alley pins
    console.log('Aiming at bowling alley...');
    await page.evaluate(() => {
      window.__SET_LOOK_ANGLES__?.(1.95, 0.12);
    });
    await page.waitForTimeout(600);

    // PUNT WITH SECONDARY FIRE (Right Click)
    console.log('Firing Secondary Punt Impulse!');
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(150);
    await page.mouse.up({ button: 'right' });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: './final-04-punt-launched.png' });
  }

  console.log('4. Visiting Native 3D Fluid Basin (Water Buoyancy & Physics)...');
  await page.evaluate(() => {
    window.__SET_LOOK_ANGLES__?.(4.45, -0.15);
  });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  await page.waitForTimeout(1100);
  await page.keyboard.up('Space');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(800);
  await page.screenshot({ path: './final-05-fluid-basin.png' });

  console.log('5. Equipping Plasma Torch Gun (Viewmodel Switch)...');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(500);
  await page.screenshot({ path: './final-06-torch-viewmodel.png' });

  console.log('6. Slicing Destructible Voxel Tower with Continuous Plasma Beam...');
  const towerAim = await page.evaluate(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    const render = c?.getRender();
    const tower = render?.poses.get('destructible-tower');
    const p = render?.players[0];
    if (!tower || !p) return null;
    const dx = tower.position[0] - p.position[0];
    const dy = tower.position[1] - (p.position[1] + 1.55);
    const dz = tower.position[2] - p.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    return {
      yaw: Math.atan2(-dx, -dz),
      pitch: Math.atan2(dy, dist),
    };
  });

  if (towerAim) {
    await page.evaluate(({ yaw, pitch }) => window.__SET_LOOK_ANGLES__?.(yaw, pitch), towerAim);
    await page.waitForTimeout(400);

    // Jetpack fly across to the tower
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Space');
    await page.waitForTimeout(1200);
    await page.keyboard.up('Space');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(400);

    // Fire plasma torch and slice across the structural pillars!
    console.log('Firing cutting beam...');
    await page.mouse.down({ button: 'left' });
    for (let i = 0; i < 6; i++) {
      const yaw = towerAim.yaw + (i - 2.5) * 0.045;
      const pitch = towerAim.pitch + 0.08;
      await page.evaluate(({ y, p }) => window.__SET_LOOK_ANGLES__?.(y, p), { y: yaw, p: pitch });
      await page.waitForTimeout(300);
    }
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: './final-07-tower-sliced.png' });
  }

  console.log('7. Visiting the Physical Seesaw (Native Revolute Joint)...');
  await page.evaluate(() => {
    window.__SET_LOOK_ANGLES__?.(1.1, 0.05);
  });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  await page.waitForTimeout(1100);
  await page.keyboard.up('Space');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: './final-08-seesaw-contraption.png' });

  const stats = await page.evaluate(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    return c?.getRender()?.stats;
  });
  console.log('--- SHOWCASE COMPLETE --- Stats:', stats);
  return stats;
}
