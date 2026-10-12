'use strict';

const SCALE_LIMIT = 1e-5;
const INTENSITY_LIMIT = 1e-5;

function smoothstep(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// These are CPU scalar checks. They do not prove raster visibility.
function shippedHullResponse(distanceM, sourceTierFade, projectedExtentCssPx = 0) {
  const distanceCoverage = 1 - smoothstep(750, 1300, distanceM);
  const hullFade = sourceTierFade <= 0 ? 0 : smoothstep(0.125, 0.5, projectedExtentCssPx);
  return { hullFade, distanceCoverage,
    lifecyclePresence: sourceTierFade, distanceScale: 1, lifecycleScale: 1 };
}

function checkHullFade(samples) {
  const rows = samples.map(sample => {
    const response = shippedHullResponse(sample.distanceM, sample.sourceTierFade, sample.projectedExtentCssPx ?? 0);
    const expectedFade = response.hullFade;
    const absoluteError = Math.abs(sample.fade - expectedFade);
    const valid = [sample.distanceM, sample.sourceTierFade, sample.fade].every(Number.isFinite)
      && sample.distanceM >= 0 && sample.sourceTierFade >= 0 && sample.sourceTierFade <= 1
      && sample.fade >= 0 && sample.fade <= 1
      && Number.isFinite(sample.projectedExtentCssPx ?? 0) && (sample.projectedExtentCssPx ?? 0) >= 0;
    return { ...sample, ...response, expectedFade, absoluteError, pass: valid && absoluteError < SCALE_LIMIT };
  });
  return { pass: rows.length > 0 && rows.every(row => row.pass), limit: SCALE_LIMIT,
    maxAbsoluteError: rows.length > 0 ? Math.max(...rows.map(row => row.absoluteError)) : null, samples: rows };
}

function checkPhysicalScale(samples) {
  const rows = samples.map(sample => {
    const response = shippedHullResponse(sample.distanceM, sample.sourceTierFade, sample.projectedExtentCssPx ?? 0);
    const expectedScale = sample.baseScale * response.distanceScale * response.lifecycleScale;
    const absoluteError = Math.abs(sample.scale - expectedScale);
    const valid = [sample.distanceM, sample.sourceTierFade, sample.baseScale, sample.scale].every(Number.isFinite)
      && sample.distanceM >= 0 && sample.sourceTierFade >= 0 && sample.sourceTierFade <= 1
      && sample.baseScale > 0 && sample.scale >= 0;
    return { ...sample, ...response, expectedScale, absoluteError, pass: valid && absoluteError < SCALE_LIMIT };
  });
  return { pass: rows.length > 0 && rows.every(row => row.pass), limit: SCALE_LIMIT,
    maxAbsoluteError: rows.length > 0 ? Math.max(...rows.map(row => row.absoluteError)) : null, samples: rows };
}

function shippedTrailViewGain(facing) {
  return 1 - smoothstep(0.72, 0.90, -facing);
}

// Raster energy is a scalar control only at the saturated front and rear endpoints.
function checkTrailIntensity(samples) {
  const rows = samples.map(sample => {
    const viewGain = shippedTrailViewGain(sample.facing);
    const expectedIntensity = sample.ungatedIntensity * viewGain;
    const absoluteError = Math.abs(sample.intensity - expectedIntensity);
    const valid = [sample.facing, sample.ungatedIntensity, sample.intensity].every(Number.isFinite)
      && sample.facing >= -1 && sample.facing <= 1 && sample.ungatedIntensity > 0 && sample.intensity >= 0;
    return { ...sample, viewGain, expectedIntensity, absoluteError, pass: valid && absoluteError < INTENSITY_LIMIT };
  });
  return { pass: rows.length > 0 && rows.every(row => row.pass), limit: INTENSITY_LIMIT, samples: rows };
}

module.exports = { shippedHullResponse, checkPhysicalScale, checkHullFade, shippedTrailViewGain, checkTrailIntensity };
