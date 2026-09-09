async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4320/play.html');
  await page.getByRole('button', {name:'Begin',exact:true}).waitFor();
  await page.clock.install();
  await page.getByRole('button', {name:'Begin',exact:true}).click();
  const advance = page.getByRole('button', {name:'Reveal text or continue',exact:true});
  const line = () => page.locator('.opening-story .sr-only').innerText();
  const first = await line();
  await advance.click();
  const reveal = await page.locator('.opening-story .typewriter-hidden').allTextContents();
  if (reveal.join('') !== '') throw new Error('Click did not reveal the whole line.');
  if (await line() !== first) throw new Error('Reveal skipped the current line.');
  await page.clock.fastForward(12000);
  if (await line() !== first) throw new Error('Line advanced without a click.');
  await advance.click();
  if (await line() !== "I try to move.... I can't.") throw new Error('Second click did not advance one line.');
  await page.clock.runFor(3000);
  await page.clock.fastForward(12000);
  if (await line() !== "I try to move.... I can't.") throw new Error('Second line advanced without a click.');
  await advance.focus();
  await page.keyboard.press('Enter');
  if (await line() !== "The cabinet. It's pinning me.") throw new Error('Keyboard did not advance.');
  let clicks = 0;
  while (await advance.isVisible()) {
    await advance.click();
    if (++clicks > 12) throw new Error('Opening did not complete.');
  }
  await page.getByRole('button', {name:'You can do it. Lift the cabinet.',exact:true}).waitFor();
  if (!(await page.getByRole('button', {name:'Sound off',exact:true}).isVisible())) throw new Error('Sound state changed.');
  if (errors.length) throw new Error(errors.join('\n'));
  return {revealKeepsLine:true, waitsForClick:true, keyboardAdvance:true, reachedCabinet:true, soundOff:true, errors};
}
