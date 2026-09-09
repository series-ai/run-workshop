// Check the real live UI and controller with a fake session. No RUN connection. Audio stays muted.
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.route('**/src/agent/runtime.ts', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export async function initializeRun() { throw new Error("RUN is disabled in this UI check"); }',
  }));
  await page.route('**/src/agent/liveSession.ts', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function createLiveSession(store, hooks) {
      return {
        beginInput() {},
        async close() {},
        session: {
          subscribe() { return () => {}; },
          abort() {},
          async send(input) {
            await Promise.resolve();
            if (input.text.startsWith('PLAYER COMMAND:')) {
              await store.run({kind: 'react', stimulus: 'reassure'});
              hooks.onResponse(input.text.includes('Can you hear me?')
                ? 'That low sound again. I think he hears me.'
                : 'His moan softens when he hears my voice.');
            }
            return {turns: 1, finishReason: 'stop', text: 'RAW MODEL TEXT MUST STAY HIDDEN'};
          }
        }
      };
    }`,
  }));
  await page.goto('http://127.0.0.1:4320/index.html');
  await page.getByRole('button', {name: 'Begin', exact: true}).click();
  const next = page.getByRole('button', {name: 'Reveal text or continue', exact: true});
  await next.waitFor();
  let clicks = 0;
  while (await next.isVisible()) {
    await next.click();
    if (++clicks > 14) throw new Error('Opening did not finish.');
  }
  const input = page.getByRole('textbox', {name: 'Your instruction', exact: true});
  await input.fill('I am here. You are safe.');
  await page.getByRole('button', {name: 'Send instruction', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('.inner-voice .sr-only')?.textContent === 'His moan softens when he hears my voice.');
  await page.clock.fastForward(10000);
  const retained = await page.locator('.inner-voice .sr-only').innerText();
  if (retained !== 'His moan softens when he hears my voice.') throw new Error('A timed hint replaced the response: ' + retained);
  await input.fill('Can you hear me?');
  await page.getByRole('button', {name: 'Send instruction', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('.inner-voice .sr-only')?.textContent === 'That low sound again. I think he hears me.');
  const result = await page.evaluate(() => ({
    thought: document.querySelector('.inner-voice .sr-only')?.textContent,
    storyAreas: document.querySelectorAll('.inner-voice,.room-caption,.transcript').length,
    stockHint: document.body.textContent.includes('I can ask him to lift the cabinet.'),
    rawText: document.body.textContent.includes('RAW MODEL TEXT MUST STAY HIDDEN'),
    audioOff: document.querySelector('.sound-toggle')?.getAttribute('aria-pressed') === 'false',
  }));
  if (result.storyAreas !== 1 || result.stockHint || result.rawText || !result.audioOff || errors.length) throw new Error(JSON.stringify({result, errors}));
  return {retained, ...result, errors, boundary: 'Fake session; real App and CreatureController'};
}
