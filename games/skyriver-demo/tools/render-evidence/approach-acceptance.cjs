'use strict';

const SCALE_LIMIT = 1e-5;
const INTENSITY_LIMIT = 1e-5;

function smoothstep(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// Use the shipped equations independently of runtime helpers.
function shippedHullResponse(distanceM, sourceTierFade) {
  const hullFade = 1 - smoothstep(750, 1300, distanceM);
  return { hullFade, distanceScale: 0.85 + 0.15 * hullFade,
    lifecycleScale: smoothstep(0, 0.45, sourceTierFade) };
}

function checkPhysicalScale(samples) {
  const rows = samples.map(sample => {
    const response = shippedHullResponse(sample.distanceM, sample.sourceTierFade);
    const expectedScale = sample.baseScale * response.distanceScale * response.lifecycleScale;
    const absoluteError = Math.abs(sample.scale - expectedScale);
    const valid = [sample.distanceM, sample.sourceTierFade, sample.baseScale, sample.scale].every(Number.isFinite)
      && sample.distanceM >= 0 && sample.sourceTierFade >= 0 && sample.baseScale > 0 && sample.scale >= 0;
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

module.exports = { shippedHullResponse, checkPhysicalScale, shippedTrailViewGain, checkTrailIntensity };
