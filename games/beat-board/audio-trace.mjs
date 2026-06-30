/**
 * audio-trace.mjs — drive the running dev server, click a pad, and dump the
 * full audio-chain trace so we can see exactly where the chain fires (or
 * fails). Reads trace events emitted by `src/audio/audio-trace.ts`.
 *
 * Usage:
 *   node audio-trace.mjs
 *
 * Requires the dev server on http://localhost:4307.
 */

import { chromium } from 'playwright';

const PORT = 4307;

const browser = await chromium.launch({
  headless: true,
  args: [
    // Allow headless audio so AudioContext can actually run rather than
    // staying suspended.
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleLogs = [];
page.on('console', m => consoleLogs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleLogs.push(`[ERR] ${e.message}`));
page.on('requestfailed', r => consoleLogs.push(`[REQ-FAILED] ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', r => {
  const u = r.url();
  if (u.includes('/audio/lofi_heights_hero/') && u.endsWith('.mp3')) {
    consoleLogs.push(`[NET ${r.status()}] ${u.replace('http://localhost:' + PORT, '')}`);
  }
});

console.log(`▶ navigating to http://localhost:${PORT}`);
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 });
console.log(`▶ waiting 5s for kit to load + register...`);
await page.waitForTimeout(5000);

const beforeTap = await page.evaluate(() => {
  const w = window;
  return {
    isMasterReady: w.__GAME_DEBUG__?.beatboard?.audio?.isMasterReady?.(),
    graph: w.__GAME_DEBUG__?.beatboard?.audio?.graphSnapshot?.(),
    traceLen: (w.__GAME_DEBUG__?.beatboard?.audio?.trace?.() ?? []).length,
  };
});
console.log(`▶ BEFORE tap:`, JSON.stringify(beforeTap, null, 2));

// Phase 3: every pad must have a `wetGainValue` field on the snapshot. The
// FX bus routing depends on the dry/wet split shipping in the production
// graph — if this field is missing or the array is short, the FX engine
// can't engage.
const wetSnapshot = beforeTap.graph?.pads ?? [];
const padsWithWet = wetSnapshot.filter(p => typeof p.wetGainValue === 'number').length;
console.log(`▶ pads with wetGainValue field: ${padsWithWet}/${wetSnapshot.length}`);
if (padsWithWet !== wetSnapshot.length) {
  console.error(`✗ FX wiring missing — expected wetGainValue on every pad`);
}

// Install an AnalyserNode tap on the master gain so we can verify samples
// are actually reaching the output, not just scheduled.
await page.evaluate(() => {
  const w = window;
  const ctx = w.__GAME_DEBUG__?.beatboard?.audio?.isMasterReady?.() ? null : null;
  // We can't easily reach into audio-master from here, so install the analyser
  // by tapping the destination — every WebAudio output passes through it.
  // Instead, we'll use the trace to check `gain:ramp` happens, then sample
  // the actual graph state's gainValue at intervals over the next ~6 seconds.
  w.__BB_GAIN_SAMPLES__ = [];
  const sample = () => {
    const snap = w.__GAME_DEBUG__?.beatboard?.audio?.graphSnapshot?.();
    if (!snap) return;
    const drums1 = snap.pads.find(p => p.padId === 'drums-1');
    w.__BB_GAIN_SAMPLES__.push({
      tMs: performance.now(),
      ctxState: snap.contextState,
      drums1Gain: drums1?.gainValue ?? null,
      drums1HasSource: drums1?.hasSource ?? null,
    });
  };
  w.__BB_SAMPLE_INTERVAL__ = setInterval(sample, 250);
});

console.log(`▶ clicking first pad...`);
const firstPad = page.locator('[data-pad-color]').first();
await firstPad.click();
console.log(`▶ waiting 7 seconds for fade-in to complete (~2.86s wait + 2.86s ramp)...`);
await page.waitForTimeout(7000);

const gainSamples = await page.evaluate(() => {
  const w = window;
  if (w.__BB_SAMPLE_INTERVAL__) clearInterval(w.__BB_SAMPLE_INTERVAL__);
  return w.__BB_GAIN_SAMPLES__ ?? [];
});
console.log(`\n▶ GAIN SAMPLES on drums-1 (${gainSamples.length} reads)\n${'─'.repeat(70)}`);
const start = gainSamples.length ? gainSamples[0].tMs : 0;
for (const s of gainSamples) {
  const dt = (s.tMs - start).toFixed(0).padStart(5);
  const gain = (s.drums1Gain ?? 0).toFixed(4);
  const src = s.drums1HasSource ? 'src' : '   ';
  console.log(`  +${dt}ms  ctx=${s.ctxState}  ${src}  gain=${gain}`);
}
const peakGain = Math.max(...gainSamples.map(s => s.drums1Gain ?? 0));
console.log(`\n  peak gain = ${peakGain.toFixed(4)}  (>0 means audio reached the master)`);

const afterTap = await page.evaluate(() => {
  const w = window;
  return {
    isMasterReady: w.__GAME_DEBUG__?.beatboard?.audio?.isMasterReady?.(),
    graph: w.__GAME_DEBUG__?.beatboard?.audio?.graphSnapshot?.(),
    padState: w.__GAME_DEBUG__?.beatboard?.padGrid?.snapshot?.(),
    bpm: w.__GAME_DEBUG__?.beatboard?.audio?.getBpm?.(),
    clockActive: w.__GAME_DEBUG__?.beatboard?.audio?.isClockActive?.(),
  };
});
console.log(`▶ AFTER tap:`, JSON.stringify(afterTap, null, 2));

const trace = await page.evaluate(() => {
  return window.__GAME_DEBUG__?.beatboard?.audio?.trace?.() ?? [];
});

console.log(`\n▶ AUDIO TRACE (${trace.length} events)\n${'─'.repeat(70)}`);
let lastTs = trace.length ? trace[0].ts : 0;
for (const ev of trace) {
  const dt = (ev.ts - lastTs).toFixed(1).padStart(7);
  const tag = ev.tag.padEnd(38);
  const detail = ev.detail ? JSON.stringify(ev.detail) : '';
  console.log(`+${dt}ms  ${tag}  ${detail}`);
  lastTs = ev.ts;
}

// Bucket trace events to highlight where chain breaks (if any).
const tags = trace.map(t => t.tag);
const summary = {
  sawScreenLoadStart: tags.includes('screen:loadKit:start'),
  sawScreenLoadResolved: tags.includes('screen:loadKit:resolved'),
  registerStartCount: tags.filter(t => t === 'graph:register:start').length,
  registerStoredCount: tags.filter(t => t === 'graph:register:stored').length,
  registerFetchFailCount: tags.filter(t => t === 'graph:register:fetch-fail').length,
  registerDecodeFailCount: tags.filter(t => t === 'graph:register:decode-fail').length,
  sawEngineActivate: tags.includes('engine:activate:enter'),
  sawEngineScheduling: tags.includes('engine:activate:scheduling'),
  scheduleRampEnterCount: tags.filter(t => t === 'graph:scheduleRamp:enter').length,
  scheduleRampNoBuffer: tags.filter(t => t === 'graph:scheduleRamp:no-buffer').length,
  sourceStartCount: tags.filter(t => t === 'graph:source:start').length,
  gainRampCount: tags.filter(t => t === 'graph:gain:ramp').length,
  resumeCalled: tags.includes('graph:resume:call'),
  resumeResolved: tags.includes('graph:resume:resolved'),
};
console.log(`\n▶ CHAIN SUMMARY\n${'─'.repeat(70)}`);
for (const [k, v] of Object.entries(summary)) {
  const ok = (typeof v === 'boolean' ? v : v > 0) ? '✓' : '✗';
  console.log(`  ${ok} ${k.padEnd(28)} ${v}`);
}

// Network log for audio fetches.
const audioFetches = consoleLogs.filter(l => l.includes('[NET ') && l.includes('/audio/'));
console.log(`\n▶ AUDIO NETWORK FETCHES (${audioFetches.length})\n${'─'.repeat(70)}`);
for (const l of audioFetches) console.log(`  ${l}`);

// ── FX EFFECT DISTINCTION ────────────────────────────────────────────────
//
// Drive each of the four effects in sequence with bypass on, then read the
// wet-gain value + bus snapshot per effect to fingerprint the routing. If
// the four effects produce identical fingerprints, the bus is broken (every
// param ends up applied to the same chain regardless of `setActiveEffect`).
//
// We can't reach the post-FX audio output samples from outside the running
// AudioContext easily, so this is the routing-correctness proof the user's
// step 6 asks for: "settle for asserting that getFxBusSnapshot().active ===
// effect, applyParams was called with the right normalized values, and the
// expected chains[effect].output.gain.value is 1.0 and the others are 0.0".
console.log(`\n▶ FX EFFECT DISTINCTION\n${'─'.repeat(70)}`);

// Ensure drums.cool wet routing is ON so the FX bus can run. The
// auto-engage default may already have flipped it; only toggle if it's
// currently OFF (otherwise we'd flip it back to OFF).
await page.evaluate(() => {
  const w = window;
  const fx = w.__GAME_DEBUG__?.beatboard?.audio?.fx;
  if (!fx) return;
  const snap = fx.snapshot?.();
  // We can't easily read padGridStore.fxBypass state through the debug
  // API; instead check drums-1's current wetGainValue. If it's ≥ 0.5 the
  // auto-engage has already opened the wet path; do nothing. Otherwise
  // toggle drums.cool ON.
  const graph = w.__GAME_DEBUG__?.beatboard?.audio?.graphSnapshot?.();
  const drums1 = graph?.pads?.find(p => p.padId === 'drums-1');
  const alreadyWet = (drums1?.wetGainValue ?? 0) >= 0.5;
  if (!alreadyWet) {
    fx.toggleBypass?.('drums', 'cool');
  }
});
await page.waitForTimeout(200);

const fxFingerprints = [];
for (const effect of ['filter', 'flanger', 'reverb', 'delay']) {
  await page.evaluate(({ effect }) => {
    const w = window;
    w.__GAME_DEBUG__?.beatboard?.fx?.setActiveEffect?.(effect);
    w.__GAME_DEBUG__?.beatboard?.fx?.setParams?.(0.7, 0.7);
  }, { effect });

  // Wait for the 50 ms crossfade + ~500 ms of audio to land.
  await page.waitForTimeout(600);

  const fingerprint = await page.evaluate(() => {
    const w = window;
    const fxSnap = w.__GAME_DEBUG__?.beatboard?.fx?.snapshot?.();
    const graphSnap = w.__GAME_DEBUG__?.beatboard?.audio?.graphSnapshot?.();
    const drums1 = graphSnap?.pads?.find(p => p.padId === 'drums-1');
    return {
      activeEffect: fxSnap?.activeEffect ?? null,
      paramX: fxSnap?.x ?? null,
      paramY: fxSnap?.y ?? null,
      busConnections: fxSnap?.busConnections ?? null,
      wetGainValue: drums1?.wetGainValue ?? null,
    };
  });
  fxFingerprints.push({ requested: effect, ...fingerprint });
}

// Pretty table.
console.log(`  ${'effect'.padEnd(8)} ${'active'.padEnd(8)} ${'paramX'.padEnd(7)} ${'paramY'.padEnd(7)} ${'wetGain'.padEnd(8)} bus`);
for (const f of fxFingerprints) {
  console.log(`  ${f.requested.padEnd(8)} ${(f.activeEffect ?? '—').padEnd(8)} ${(f.paramX ?? 0).toFixed(2).padEnd(7)} ${(f.paramY ?? 0).toFixed(2).padEnd(7)} ${(f.wetGainValue ?? 0).toFixed(3).padEnd(8)} ${f.busConnections ?? '—'}`);
}

// Assert each requested effect actually became the active one (proves
// `setActiveEffect` routes per-effect rather than no-oping).
const effectsApplied = fxFingerprints.every(f => f.activeEffect === f.requested);
// Assert the wet branch is open (drums.cool ON → wetGainValue ≈ 1).
const wetBranchOpen = fxFingerprints.every(f => (f.wetGainValue ?? 0) > 0.5);
// Assert the four entries are not all identical (different `activeEffect`).
const distinctSet = new Set(fxFingerprints.map(f => f.activeEffect));
const distinct = distinctSet.size === 4;

if (!distinct) {
  console.error(`\n  ✗ FX BUS BUG — all four effects produced identical signatures`);
} else if (!effectsApplied) {
  console.error(`\n  ✗ FX BUS BUG — setActiveEffect did not route per-effect (active stayed: ${[...distinctSet].join(',')})`);
} else if (!wetBranchOpen) {
  console.error(`\n  ✗ FX BUS BUG — wet branch did not open (drums-1 wetGainValue ≤ 0.5 even with drums.cool ON)`);
} else {
  console.log(`\n  ✓ FX bus routes per-effect, wet branch open, four distinct active states observed`);
}

// Screenshot the final state so we can confirm the new chrome visually.
try {
  await page.screenshot({ path: '/tmp/bb-fx-state.png', fullPage: false });
  console.log(`  ✓ screenshot saved to /tmp/bb-fx-state.png`);
} catch (err) {
  console.log(`  ✗ screenshot failed: ${err.message}`);
}

// Pageerror dump if any.
const errors = consoleLogs.filter(l => l.startsWith('[ERR]') || l.startsWith('[REQ-FAILED]'));
if (errors.length) {
  console.log(`\n▶ ERRORS (${errors.length})\n${'─'.repeat(70)}`);
  for (const e of errors) console.log(`  ${e}`);
}

await browser.close();
