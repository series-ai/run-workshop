async page => {
  const errors = [];
  let closestContact = Infinity;
  page.on('pageerror', error => errors.push(error.message));
  const observe = () => page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes('@react-three_fiber.js'));
    const { _roots } = await import(url);
    const root = [..._roots.values()][0];
    const scene = root.store.getState().scene;
    const stack = [root.fiber.current];
    let game;
    while (stack.length) {
      const fiber = stack.pop();
      if (fiber.memoizedProps?.state?.patient) game = fiber.memoizedProps.state;
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    const names = ['WoundCovered', 'WoundOpen', 'EmbeddedShard', 'WoundClosed', 'WoundDressed', 'LegBrace'];
    const torso = scene.getObjectByName('Torso');
    const { PATIENT_LAYOUT } = await import('/src/scene/patientLayout.ts');
    const hand = scene.getObjectByName('generated-assistant-rig').getObjectByName('RightHand');
    const handPosition = hand.position.clone();hand.getWorldPosition(handPosition);
    const touching = game.pending?.action.kind === 'use' && game.pending.action.target === 'wound';
    return {
      touching, contactDistance: handPosition.distanceTo(handPosition.clone().set(...PATIENT_LAYOUT.wound)),
      phase: game.phase, stage: game.stage, pending: !!game.pending, paused: game.paused,
      lantern: game.environment.lanternLit,
      parts: Object.fromEntries(names.map(name => [name, scene.getObjectByName(name)?.visible])),
      crush: torso.morphTargetInfluences[torso.morphTargetDictionary.Crushed],
      beamY: scene.getObjectByName('fallen-ceiling-support').position.y,
    };
  });
  const pause = async () => { await page.keyboard.press('Escape'); };
  const click = async name => { await page.getByRole('button', { name, exact: true }).click(); };
  const settle = async (expected, milliseconds = 9000) => {
    const deadline = Date.now() + milliseconds;
    while (Date.now() < deadline) {
      const state = await observe();
      if(state.touching) closestContact = Math.min(closestContact, state.contactDistance);
      if (state.stage === expected && !state.pending && !state.paused) {
        await page.waitForTimeout(500);
        return state;
      }
      await page.waitForTimeout(200);
    }
    throw Error(`Did not reach ${expected}: ${JSON.stringify(await observe())}`);
  };
  await page.reload();
  await page.getByRole('button', {name:'Offline rehearsal',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', {name:'Rehearsal controls',exact:true}).waitFor({timeout:30000});
  await pause();
  await click('Ask him to light the lantern');
  await page.waitForTimeout(2000);
  const pinned = await observe();
  await page.screenshot({path:'/tmp/patient-floor-pinned.png'});
  await pause();
  await click('Ask him to lift the beam');
  await page.waitForTimeout(450);
  await pause();
  const cancelled = await observe();
  if(cancelled.stage !== 'pinned') throw Error('Cancelled lift changed stage');
  await page.getByRole('button', {name:'Continue',exact:true}).focus();await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const reset = await observe();
  if(reset.crush < .98 || Math.abs(reset.beamY - pinned.beamY) > .01) throw Error('Cancelled lift did not restore body and beam');
  await pause();await click('Ask him to lift the beam');
  await settle('covered');
  await page.screenshot({path:'/tmp/patient-floor-cleared.png'});
  await pause();await click('Next surgical action');
  await settle('exposed');
  const exposed = await observe();
  await page.screenshot({path:'/tmp/patient-floor-exposed.png'});
  await pause();await click('Ask for relief');await page.waitForTimeout(8000);
  await pause();await click('Next surgical action');await settle('extracted');
  const extracted = await observe();
  await page.screenshot({path:'/tmp/patient-floor-extracted.png'});
  await pause();await click('Prepare suture');await page.waitForTimeout(8000);
  await pause();await click('Next surgical action');await settle('closed');
  const closed = await observe();
  await page.screenshot({path:'/tmp/patient-floor-closed.png'});
  await pause();await click('Next surgical action');await settle('dressed');
  const dressed = await observe();
  await page.screenshot({path:'/tmp/patient-floor-dressed.png'});
  await pause();
  if(!pinned.parts.WoundCovered || !exposed.parts.WoundOpen || !exposed.parts.EmbeddedShard || extracted.parts.EmbeddedShard || !closed.parts.WoundClosed || !dressed.parts.WoundDressed || dressed.parts.WoundOpen || errors.length) throw Error(JSON.stringify({pinned,exposed,extracted,closed,dressed,errors}));
  if(closestContact > .04) throw Error(`Hand missed wound by ${closestContact} m`);
  return {pinned,cancelled,reset,exposed,extracted,closed,dressed,closestContact,errors};
}
