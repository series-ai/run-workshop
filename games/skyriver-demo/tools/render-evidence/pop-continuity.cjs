'use strict';

// Compare actual traffic buffers without a browser or a render call.
(() => {
  function byCar(samples) {
    const indexed = new Map();
    for (const sample of samples) {
      if (!Number.isInteger(sample.carId) || sample.carId < 0 || indexed.has(sample.carId)) {
        throw new Error('POP_CAR_ID_INVALID');
      }
      indexed.set(sample.carId, sample);
    }
    return indexed;
  }

  function compareStreakFrames(previous, current, project) {
    const old = byCar(previous);
    const now = byCar(current);
    const events = [];
    for (const [carId, sample] of now) {
      const prior = old.get(carId);
      if (!prior) continue;
      const delta = Math.abs(sample.fade - prior.fade);
      if (delta > 0.35 && project(sample.position)) {
        events.push({ type: 'fadeJump', carId, previousFade: prior.fade, currentFade: sample.fade, delta });
      }
    }
    return events;
  }

  function hullKey(sample) {
    return sample.carId === null || sample.carId === undefined
      ? `${sample.mesh}|${sample.slot}` : `car:${sample.carId}`;
  }

  function compareHullFrames(previous, current, project) {
    const old = new Map(previous.map(sample => [hullKey(sample), sample]));
    const oldSlots = new Map(previous.map(sample => [`${sample.mesh}|${sample.slot}`, sample]));
    const events = [];
    for (const sample of current) {
      const slotPrior = oldSlots.get(`${sample.mesh}|${sample.slot}`);
      const identityMissing = sample.carId === null || sample.carId === undefined
        || slotPrior?.carId === null || slotPrior?.carId === undefined;
      const prior = old.get(hullKey(sample)) ?? (identityMissing ? slotPrior : undefined);
      if (!prior) continue;
      const pm = prior.matrix;
      const cm = sample.matrix;
      const sa = Math.hypot(pm[0], pm[1], pm[2]);
      const sb = Math.hypot(cm[0], cm[1], cm[2]);
      const maximumScale = Math.max(sa, sb);
      if (maximumScale < 0.6) continue;
      const pa = project([pm[12], pm[13], pm[14]]);
      const pb = project([cm[12], cm[13], cm[14]]);
      if (!pa && !pb) continue;
      const witness = {
        mesh: sample.mesh, i: sample.slot, carId: sample.carId ?? null,
        identityKnown: sample.carId !== null && sample.carId !== undefined && sample.carId === prior.carId,
        previousMatrix: Array.from(pm), currentMatrix: Array.from(cm),
        previousHullFade: prior.fade, currentHullFade: sample.fade,
        hullDissolve: 'interleaved-gradient-noise',
      };
      const scaleBlink = Math.abs(sa - sb) > 0.5 * maximumScale;
      if (scaleBlink) { events.push({ type: 'blink', ...witness }); continue; }
      if (sa > 0.6 && sb > 0.6 && pa && pb) {
        const dpx = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
        const dm = Math.hypot(pm[12] - cm[12], pm[13] - cm[13], pm[14] - cm[14]);
        if (dpx > 60 && dm > 25) events.push({ type: 'teleport', dpx: +dpx.toFixed(0), dm: +dm.toFixed(0), ...witness });
      }
    }
    return events;
  }

  const api = Object.freeze({ compareStreakFrames, compareHullFrames });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.__skyriverPopContinuity = api;
})();
