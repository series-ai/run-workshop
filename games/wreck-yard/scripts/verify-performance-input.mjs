import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const outputDir = fileURLToPath(new URL('../test-results/performance/input/', import.meta.url));
const moveCount = 60;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pageErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(baseUrl);
  await page.waitForFunction(() => Boolean(window.__WRECK_YARD_PERF__ && document.querySelector('canvas')), null, { timeout: 120_000 });

  const playButton = page.getByRole('button', { name: 'Click to play' });
  const dragButton = page.getByRole('button', { name: /Play in a window/ });
  const startPlate = page.locator('[aria-label="Start"]');
  for (let attempt = 0; attempt < 2 && await startPlate.count(); attempt += 1) {
    if (await playButton.count()) await playButton.click();
    await page.waitForFunction(() => !document.querySelector('[aria-label="Start"]')
      || [...document.querySelectorAll('button')].some((button) => button.textContent?.includes('Play in a window')), null, { timeout: 8_000 });
    if (await dragButton.count()) {
      await dragButton.click();
      break;
    }
  }
  await page.getByRole('button', { name: 'Leave Match' }).waitFor({ timeout: 20_000 });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 200 && box.height > 200, 'The game canvas must be visible.');
  const centerX = box.x + box.width * 0.5;
  const centerY = box.y + box.height * 0.5;
  await page.mouse.move(centerX, centerY);
  await page.evaluate(() => {
    window.__PERF_INPUT_PROOF_MOVES__ = 0;
    window.addEventListener('mousemove', () => { window.__PERF_INPUT_PROOF_MOVES__ += 1; });
    window.__WRECK_YARD_PERF__.start({ capacity: 32_768, maxDurationMs: 10_000 });
  });

  await page.mouse.down({ button: 'middle' });
  for (let index = 0; index < moveCount; index += 1) {
    const angle = (index / (moveCount - 1)) * Math.PI * 5;
    const x = centerX + Math.sin(angle) * Math.min(150, box.width * 0.16);
    const y = centerY + Math.cos(angle * 0.7) * Math.min(100, box.height * 0.14);
    await page.mouse.move(x, y, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(250);

  const controllerPaused = await page.evaluate(() => {
    const controller = window.__WRECK_YARD_CONTROLLER__;
    if (!controller) return false;
    controller.setPaused(true);
    return controller.isPaused();
  });
  assert.equal(controllerPaused, true, 'The local solo controller must pause before the unapplied key test.');
  await page.waitForTimeout(40);
  const pausedAtMs = await page.evaluate(() => performance.now());
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(160);

  const report = await page.evaluate(() => window.__WRECK_YARD_PERF__.export());
  const observedMouseMoves = await page.evaluate(() => window.__PERF_INPUT_PROOF_MOVES__);
  const timelines = report.inputLatencies;
  const beforePause = timelines.filter((timeline) => timeline.eventAtMs !== undefined && timeline.eventAtMs < pausedAtMs);
  const duringPause = timelines.filter((timeline) => timeline.eventAtMs !== undefined && timeline.eventAtMs >= pausedAtMs);
  const completedBeforePause = beforePause.filter((timeline) => timeline.status === 'complete');
  const incompleteBeforePause = beforePause.filter((timeline) => timeline.status === 'incomplete');
  const pausedWithSample = duringPause.filter((timeline) => timeline.sampleAtMs !== undefined);
  const pausedWithApply = duringPause.filter((timeline) => timeline.applyAtMs !== undefined);
  const pausedWithSubmission = duringPause.filter((timeline) => timeline.renderSubmissionAtMs !== undefined);
  const applyWithoutEventOrSample = timelines.filter((timeline) => timeline.applyAtMs !== undefined
    && (timeline.eventAtMs === undefined || timeline.sampleAtMs === undefined));
  const submissionWithoutApply = timelines.filter((timeline) => timeline.renderSubmissionAtMs !== undefined
    && timeline.applyAtMs === undefined);
  const inputRecords = report.records.filter((record) => record.kind === 'input');
  const inputStageCounts = { event: 0, sample: 0, apply: 0, renderSubmission: 0 };
  for (const record of inputRecords) inputStageCounts[record.stage] += 1;

  const summary = {
    baseUrl,
    requestedMouseMoves: moveCount,
    observedMouseMoves,
    elapsedMs: report.elapsedMs,
    capacity: report.capacity,
    totalRecords: report.totalRecords,
    overwrittenRecords: report.overwrittenRecords,
    inputStageCounts,
    timelineCount: timelines.length,
    completedBeforePause: completedBeforePause.length,
    incompleteBeforePause: incompleteBeforePause.length,
    duringPause: duringPause.length,
    pausedWithSample: pausedWithSample.length,
    pausedWithApply: pausedWithApply.length,
    pausedWithSubmission: pausedWithSubmission.length,
    applyWithoutEventOrSample: applyWithoutEventOrSample.length,
    submissionWithoutApply: submissionWithoutApply.length,
    inputLatencySummary: report.inputLatencySummary,
    pageErrors,
  };

  assert.equal(await page.evaluate(() => window.__WRECK_YARD_PERF__.isActive()), false, 'Export must stop the recorder.');
  assert.equal(report.overwrittenRecords, 0, 'The capture must retain all input records.');
  assert.ok(observedMouseMoves >= moveCount, `Expected at least ${moveCount} delivered mouse events.`);
  assert.ok(inputStageCounts.event >= moveCount, 'The recorder must keep distinct physical events.');
  assert.ok(completedBeforePause.length >= 30, 'At least 30 moving input timelines must complete.');
  assert.ok(duringPause.length >= 1, 'The paused key must have an event record.');
  assert.equal(pausedWithSample.length, 0, 'Paused events must not be sampled.');
  assert.equal(pausedWithApply.length, 0, 'Paused events must not be applied.');
  assert.equal(pausedWithSubmission.length, 0, 'Paused events must not be submitted.');
  assert.equal(applyWithoutEventOrSample.length, 0, 'An apply record must have a matched event and sample.');
  assert.equal(submissionWithoutApply.length, 0, 'A submission record must have a matched apply.');
  assert.deepEqual(pageErrors, []);

  await mkdir(outputDir, { recursive: true });
  await writeFile(`${outputDir}/raw-report.json`, JSON.stringify({ summary, report }, null, 2));
  await writeFile(`${outputDir}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await page.close();
} finally {
  await browser.close();
}
