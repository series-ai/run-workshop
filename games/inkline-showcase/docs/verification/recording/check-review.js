async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:4197/review/index.html');
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
  await page.locator('#comparison').evaluate(video => video.load());
  await page.waitForFunction(() => document.querySelector('#comparison')?.readyState >= 1);
  const comparison = await page.locator('#comparison').evaluate(video => ({duration:video.duration,width:video.videoWidth,height:video.videoHeight}));
  if (comparison.duration < 28 || comparison.width !== 1600 || comparison.height !== 1000) throw new Error('Unexpected comparison video metadata.');
  await page.locator('#phone-tour').evaluate(video => video.load());
  await page.waitForFunction(() => document.querySelector('#phone-tour')?.readyState >= 1);
  const phoneVideo = await page.locator('#phone-tour').evaluate(video => ({duration:video.duration,width:video.videoWidth,height:video.videoHeight}));
  if (phoneVideo.duration < 25 || phoneVideo.width !== 390 || phoneVideo.height !== 844) throw new Error('Unexpected phone video metadata.');
  const chapters = page.locator('.chapter');
  if (await chapters.count() !== 9) throw new Error('Expected nine video chapters.');
  const metadata = await page.locator('#tour').evaluate(video => ({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, source: video.currentSrc }));
  if (metadata.duration < 100 || metadata.width !== 1600 || metadata.height !== 1000) throw new Error('Unexpected video metadata.');
  await chapters.nth(1).click();
  await page.waitForTimeout(1200);
  const playback = await page.locator('#tour').evaluate(video => ({ time: video.currentTime, paused: video.paused, error: video.error?.message ?? null }));
  if (playback.paused || playback.error || playback.time < 10) throw new Error(`Video chapter playback failed: ${JSON.stringify(playback)}`);
  await page.locator('#tour').evaluate(video => video.pause());
  for (const index of [3, 6, 8]) {
    await chapters.nth(index).click();
    await page.waitForTimeout(500);
    await page.locator('#tour').evaluate(video => video.pause());
    if (await chapters.nth(index).getAttribute('aria-current') !== 'true') throw new Error('Chapter selection failed.');
  }
  for (const selector of ['#comparison', '#phone-tour']) {
    await page.locator(selector).evaluate(video => video.play());
    await page.waitForTimeout(700);
    const result = await page.locator(selector).evaluate(video => ({time:video.currentTime,paused:video.paused,error:video.error?.message ?? null}));
    if (result.paused || result.time < .2 || result.error) throw new Error(`${selector}: playback failed.`);
    await page.locator(selector).evaluate(video => video.pause());
  }
  await page.locator('img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  const imageCount = await page.locator('img').count();
  if (imageCount !== 16) throw new Error('Expected sixteen review images.');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await chapters.first().click();
  await page.waitForTimeout(500);
  await page.locator('#tour').evaluate(video => video.pause());
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'docs/verification/recording/review-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  const phone = await page.evaluate(() => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }));
  if (phone.pageWidth > phone.viewport) throw new Error('The review page overflows on a phone.');
  await page.screenshot({ path: 'docs/verification/recording/review-phone.png', fullPage: true });
  const library = await page.context().newPage();
  let motionLibrary;
  try {
    await library.setViewportSize({ width: 390, height: 844 });
    await library.goto('http://localhost:4197/review/motion-library.html');
    await library.waitForFunction(() => [...document.querySelectorAll('video')].every(video => video.readyState >= 1));
    motionLibrary = await library.evaluate(() => ({ clips: document.querySelectorAll('li').length, videos: [...document.querySelectorAll('video')].map(video => ({ duration: video.duration, width: video.videoWidth, height: video.videoHeight })), viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }));
    if (motionLibrary.clips !== 85 || motionLibrary.videos.length !== 3 || motionLibrary.videos.some(video => video.duration < 30 || video.width !== 800 || video.height !== 450) || motionLibrary.pageWidth > motionLibrary.viewport) throw new Error('The full motion review did not pass its metadata or phone layout check.');
    await library.screenshot({ path: 'docs/verification/recording/motion-library-phone.png', fullPage: true });
  } finally { await library.close(); }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.evaluate(result => { window.__reviewCheck = result; }, { metadata, comparison, phoneVideo, playback, phone, chapters: 9, imageCount, motionLibrary, errors });
}
