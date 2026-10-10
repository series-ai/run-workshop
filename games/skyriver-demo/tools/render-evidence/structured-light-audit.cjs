'use strict';
const fs = require('node:fs');
const path = require('node:path');
const R = require('./experiment-runtime.cjs');
const { probe } = require('./structured-light-probe.cjs');

const limits = Object.freeze({ edge: 1e-7, edgePeakFraction: 1e-5, outerGradientPeakFraction: .05, tileCV: .03, radiusM: 200, tailFraction: .05 });
function rangeMetrics(effect) {
  const peak = Math.max(...effect.range.map(row => row.max));
  const tailMax = Math.max(...effect.range.filter(row => row.distance >= limits.radiusM).map(row => row.max));
  const boundary = effect.range.filter(row => row.distance >= 199 && row.distance <= 200.5);
  const boundaryStep = Math.max(...boundary.slice(1).map((row, i) => Math.abs(row.max - boundary[i].max)));
  return { peak, tailMax, tailFraction: tailMax / peak, boundaryStepPeakFraction: boundaryStep / peak };
}
function audit(before, after) {
  const rows = [];
  function check(effect, requirement, expectedBaseline, beforePass, afterPass, measured) {
    const baselineMatches = expectedBaseline === 'not applicable' || Boolean(beforePass) === (expectedBaseline === 'pass');
    rows.push({ effect, requirement, expectedBaseline, beforePass: beforePass === null ? null : Boolean(beforePass), afterPass: Boolean(afterPass), baselineMatches, pass: Boolean(afterPass) && baselineMatches, measured });
  }
  const finite = m => m.peak > 0 && m.tailMax <= limits.edge && m.tailFraction <= limits.tailFraction;
  const noise = m => m.minimum >= limits.tileCV;
  const card = m => m.max > 0 && m.edge <= limits.edge && m.edge / m.max <= limits.edgePeakFraction;
  const gradient = m => m.max > 0 && m.outerGradientPeakFraction <= limits.outerGradientPeakFraction;
  for (const effect of ['city', 'volume', 'landmark']) {
    const a = after[effect], b = before[effect], am = rangeMetrics(a), bm = rangeMetrics(b);
    check(effect, 'Range closes at 200 m. Tail is at most 5% of peak.', 'failure', finite(bm), finite(am), { before: bm, after: am });
    check(effect, 'Each normalized 32-pixel tile has at least 3% variation.', 'failure', noise(b.noise32), noise(a.noise32), { before: b.noise32, after: a.noise32 });
    check(effect, 'The outer range boundary has no step above 5% of peak per 0.5 m.', 'pass', bm.boundaryStepPeakFraction <= .05, am.boundaryStepPeakFraction <= .05, { before: bm.boundaryStepPeakFraction, after: am.boundaryStepPeakFraction, bandM: [199,200.5], stepM: .5 });
    check(effect, 'Source-off response is zero.', 'pass', b.off.max <= limits.edge, a.off.max <= limits.edge, { beforeMax: b.off.max, afterMax: a.off.max });
  }
  const wet = d => d.facadeSourceOff.maxChroma <= limits.edge && d.wetMicro.mean > 0 && d.wetMicro.std / d.wetMicro.mean >= .05;
  check('wet facade', 'Source-off wet sheen is neutral. Wet microdetail has at least 5% variation.', 'failure', wet(before), wet(after), { beforeChroma: before.facadeSourceOff.maxChroma, afterChroma: after.facadeSourceOff.maxChroma, beforeMicroCV: before.wetMicro.std / before.wetMicro.mean, afterMicroCV: after.wetMicro.std / after.wetMicro.mean });
  check('sign cards', 'The complete sign shader reaches zero at the outer edge.', 'failure', card(before.signEdge), card(after.signEdge), { before: before.signEdge, after: after.signEdge });
  check('sign cards', 'The outer 5% card band has no adjacent step above 5% of peak.', 'pass', gradient(before.signEdge), gradient(after.signEdge), { before: before.signEdge.outerGradientPeakFraction, after: after.signEdge.outerGradientPeakFraction, bandPixels: 13, widthPixels: 256 });
  check('sign halo', 'Each normalized illuminated 32-pixel tile has at least 3% variation.', 'failure', noise(before.signHalo.noise32), noise(after.signHalo.noise32), { before: before.signHalo.noise32, after: after.signHalo.noise32, gaussianAndCardEnvelopeRemoved: true });
  check('sign halo', 'A physical card bounds the halo below 200 m. Source-off is zero.', 'pass', before.signHalo.extentM <= 200 && before.signHalo.off.max <= limits.edge, after.signHalo.extentM <= 200 && after.signHalo.off.max <= limits.edge, { before: {extentM: before.signHalo.extentM, offMax: before.signHalo.off.max}, after: {extentM: after.signHalo.extentM, offMax: after.signHalo.off.max} });
  for (let kind = 0; kind < 4; kind++) {
    const a = after.plumeRows[kind], b = before.plumeRows[kind];
    check('plume ' + kind, 'Visible additive contribution reaches zero at the outer edge.', 'failure', card(b.visible), card(a.visible), { blend: a.blend, beforeRawEdgeRGBA: b.raw.edgeRGBA, afterRawEdgeRGBA: a.raw.edgeRGBA, before: b.visible, after: a.visible });
    check('plume ' + kind, 'The outer 5% card band has no adjacent step above 5% of peak.', kind === 0 || kind === 3 ? 'failure' : 'pass', gradient(b.visible), gradient(a.visible), { before: b.visible.outerGradientPeakFraction, after: a.visible.outerGradientPeakFraction, bandPixels: 13, widthPixels: 256 });
    if (kind !== 2) check('plume ' + kind, 'Each normalized illuminated 32-pixel tile has at least 3% variation.', 'failure', noise(b.noise32), noise(a.noise32), { before: b.noise32, after: a.noise32, method: 'Divide actual additive field by the same production field with only its jet-noise factor disabled. The Gaussian, throat, shock phase, fade, and blend cancel.' });
  }
  check('boost scratches', 'Boost adds no screen-space scratches.', 'failure', before.boostScratch.maxDifference <= limits.edge, after.boostScratch.maxDifference <= limits.edge, { before: before.boostScratch, after: after.boostScratch });
  const p = after.pickup;
  check('hull reflection', 'The complete source-off body has no baked magenta reflection.', 'failure', before.hullOff.magentaBodyPixels === 0, after.hullOff.magentaBodyPixels === 0, { beforePixels: before.hullOff.magentaBodyPixels, afterPixels: after.hullOff.magentaBodyPixels });
  check('hull reflection', 'A source lights the body. The streak moves with the source. Source-off and far controls are zero.', 'not applicable', null, p && p.on.max > .005 && p.movedMeanAbsoluteChange > p.on.mean * .1 && p.off.max <= limits.edge && p.far.max <= limits.edge, p && { on: p.on, off: p.off, far: p.far, movedMeanAbsoluteChange: p.movedMeanAbsoluteChange });
  const pm = p && rangeMetrics(p);
  check('hull reflection', 'Range closes at 200 m. Tail is at most 5% of peak.', 'not applicable', null, pm && finite(pm), pm);
  check('hull reflection', 'Each normalized 32-pixel tile has at least 3% variation.', 'not applicable', null, p && noise(p.noise32), p && p.noise32);
  check('hull reflection', 'The outer range boundary has no step above 5% of peak per 0.5 m.', 'not applicable', null, pm && pm.boundaryStepPeakFraction <= .05, pm);
  const rims = d => d.landmark.rimStages.length === 12 && d.landmark.rimStages.every(stage => stage.rims.length === 4 && stage.rims.every(rim => rim.offsetError < .03));
  check('landmark geometry', 'Each named tower stage has four actual emitting rim strips at the shader offsets.', 'pass', rims(before), rims(after), { stages: after.landmark.rimStages.length, rims: after.landmark.rimStages.reduce((n, stage) => n + stage.rims.length, 0), toleranceM: .03 });
  const geometryEqual = JSON.stringify(before.identity) === JSON.stringify(after.identity);
  check('geometry and lamps', 'Every city geometry identity remains equal.', 'pass', geometryEqual, geometryEqual, { before: before.identity, after: after.identity });
  const hullEqual = before.hullInvariant.lampTriangles > 0 && JSON.stringify(before.hullInvariant) === JSON.stringify(after.hullInvariant);
  check('hull geometry and lamps', 'Expanded hull positions, normals, and actual emitting lamp triangles remain equal.', 'pass', hullEqual, hullEqual, { before: before.hullInvariant, after: after.hullInvariant });
  const gpu = d => d.glError === 0 && d.errors.length === 0;
  check('GPU', 'Both real shader runs have no GL or browser errors.', 'pass', gpu(before), gpu(after), { beforeError: before.glError, afterError: after.glError, beforeMessages: before.errors, afterMessages: after.errors });
  return { pass: rows.every(row => row.pass), limits, rows };
}

async function main() {
  const opt = R.args();
  if (!opt.before || !opt.after || !opt.out) throw Error('Use --before URL --after URL --out DIRECTORY. Set PLAYWRIGHT_MODULE to the installed browser package.');
  const out = path.resolve(opt.out);
  fs.mkdirSync(out, { recursive: true });
  const before = await probe(opt.before, path.join(out, 'before'));
  const after = await probe(opt.after, path.join(out, 'after'));
  const result = audit(before, after);
  R.write(path.join(out, 'audit.json'), result);
  for (const row of result.rows) console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.effect}: ${row.requirement} (baseline expected ${row.expectedBaseline}, measured ${row.beforePass})`);
  if (!result.pass) process.exitCode = 1;
}
module.exports = { audit, limits };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
