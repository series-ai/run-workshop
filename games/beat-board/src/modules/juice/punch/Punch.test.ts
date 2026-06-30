import { describe, it, expect } from 'vitest';
import { createPunch } from './Punch';

describe('Punch', () => {
  it('trigger() starts active', () => {
    const punch = createPunch();
    punch.trigger();

    expect(punch.isActive()).toBe(true);
  });

  it('value is non-zero during animation', () => {
    const punch = createPunch({ strength: 0.5, vibrato: 6, duration: 300 });
    punch.trigger();

    // Sample several frames during animation
    let hadNonZero = false;
    for (let i = 0; i < 10; i++) {
      const state = punch.update(1 / 60);
      if (Math.abs(state.value) > 0.001) {
        hadNonZero = true;
      }
    }

    expect(hadNonZero).toBe(true);
  });

  it('value returns to ~0 when complete', () => {
    const punch = createPunch({ duration: 300 });
    punch.trigger();

    // Advance past duration
    const state = punch.update(0.5); // 500ms > 300ms duration

    expect(state.value).toBe(0);
    expect(state.active).toBe(false);
  });

  it('isActive() false after duration', () => {
    const punch = createPunch({ duration: 200 });
    punch.trigger();

    // Advance past duration
    punch.update(0.25); // 250ms > 200ms

    expect(punch.isActive()).toBe(false);
  });

  it('higher strength = larger amplitude', () => {
    const punchWeak = createPunch({ strength: 0.1, vibrato: 6, duration: 300 });
    const punchStrong = createPunch({ strength: 0.8, vibrato: 6, duration: 300 });

    punchWeak.trigger();
    punchStrong.trigger();

    // Sample at the same time
    let maxWeak = 0;
    let maxStrong = 0;
    for (let i = 0; i < 15; i++) {
      const sw = punchWeak.update(1 / 60);
      const ss = punchStrong.update(1 / 60);
      maxWeak = Math.max(maxWeak, Math.abs(sw.value));
      maxStrong = Math.max(maxStrong, Math.abs(ss.value));
    }

    expect(maxStrong).toBeGreaterThan(maxWeak);
  });

  it('higher vibrato = more zero crossings', () => {
    const punchLowVibrato = createPunch({ vibrato: 2, duration: 500, strength: 0.5, elasticity: 0 });
    const punchHighVibrato = createPunch({ vibrato: 10, duration: 500, strength: 0.5, elasticity: 0 });

    punchLowVibrato.trigger();
    punchHighVibrato.trigger();

    let crossingsLow = 0;
    let crossingsHigh = 0;
    let prevLow = 0;
    let prevHigh = 0;

    for (let i = 0; i < 28; i++) {
      const sl = punchLowVibrato.update(1 / 60);
      const sh = punchHighVibrato.update(1 / 60);

      if (i > 0) {
        if ((prevLow > 0 && sl.value < 0) || (prevLow < 0 && sl.value > 0)) {
          crossingsLow++;
        }
        if ((prevHigh > 0 && sh.value < 0) || (prevHigh < 0 && sh.value > 0)) {
          crossingsHigh++;
        }
      }

      prevLow = sl.value;
      prevHigh = sh.value;
    }

    expect(crossingsHigh).toBeGreaterThan(crossingsLow);
  });

  it('reset() stops animation', () => {
    const punch = createPunch();
    punch.trigger();
    punch.update(1 / 60);

    punch.reset();

    expect(punch.isActive()).toBe(false);
    const state = punch.update(1 / 60);
    expect(state.value).toBe(0);
    expect(state.active).toBe(false);
  });

  it('multiple triggers restart animation', () => {
    const punch = createPunch({ duration: 300 });
    punch.trigger();

    // Advance partway
    punch.update(0.1); // 100ms
    expect(punch.isActive()).toBe(true);

    // Trigger again — should restart
    punch.trigger();
    expect(punch.isActive()).toBe(true);

    // Should still be active since we just restarted
    const state = punch.update(0.1); // 100ms from restart
    expect(state.active).toBe(true);
  });

  it('trigger with custom strength overrides config', () => {
    const punch = createPunch({ strength: 0.1, vibrato: 4, duration: 300 });
    punch.trigger(0.9);

    let maxVal = 0;
    for (let i = 0; i < 10; i++) {
      const state = punch.update(1 / 60);
      maxVal = Math.max(maxVal, Math.abs(state.value));
    }

    // With strength 0.9 (much larger than default 0.1), amplitude should be substantial
    expect(maxVal).toBeGreaterThan(0.2);
  });

  it('value decays over time', () => {
    const punch = createPunch({ strength: 0.5, vibrato: 8, duration: 500, elasticity: 0.5 });
    punch.trigger();

    // Sample early amplitude
    let maxEarly = 0;
    for (let i = 0; i < 5; i++) {
      const state = punch.update(1 / 60);
      maxEarly = Math.max(maxEarly, Math.abs(state.value));
    }

    // Sample late amplitude
    punch.update(0.2); // skip ahead 200ms
    let maxLate = 0;
    for (let i = 0; i < 5; i++) {
      const state = punch.update(1 / 60);
      maxLate = Math.max(maxLate, Math.abs(state.value));
    }

    // Early amplitude should be larger than late
    expect(maxEarly).toBeGreaterThan(maxLate);
  });

  it('default config produces reasonable behavior', () => {
    const punch = createPunch();
    punch.trigger();

    // Should be active
    expect(punch.isActive()).toBe(true);

    // Should produce non-zero values
    const state = punch.update(1 / 60);
    expect(state.active).toBe(true);

    // Should finish within default duration
    punch.update(0.4); // well past 300ms default
    expect(punch.isActive()).toBe(false);
  });

  describe('intensity multiplier', () => {
    it('scales punch amplitude by intensity', () => {
      const punchFull = createPunch({ strength: 0.5, vibrato: 6, duration: 300 });
      const punchHalf = createPunch({ strength: 0.5, vibrato: 6, duration: 300 });

      punchFull.trigger({ intensity: 1 });
      punchHalf.trigger({ intensity: 0.5 });

      let maxFull = 0;
      let maxHalf = 0;
      for (let i = 0; i < 15; i++) {
        const sf = punchFull.update(1 / 60);
        const sh = punchHalf.update(1 / 60);
        maxFull = Math.max(maxFull, Math.abs(sf.value));
        maxHalf = Math.max(maxHalf, Math.abs(sh.value));
      }

      // Half intensity should produce roughly half the amplitude
      expect(maxFull).toBeGreaterThan(maxHalf * 1.5);
    });

    it('intensity 0 produces no punch', () => {
      const punch = createPunch({ strength: 0.5, duration: 300 });
      punch.trigger({ intensity: 0 });

      for (let i = 0; i < 10; i++) {
        const state = punch.update(1 / 60);
        expect(state.value).toBeCloseTo(0);
      }
    });

    it('can combine strength override with intensity', () => {
      const punch = createPunch({ strength: 0.2, duration: 300 });
      punch.trigger({ strength: 1.0, intensity: 0.5 });

      let maxVal = 0;
      for (let i = 0; i < 10; i++) {
        const state = punch.update(1 / 60);
        maxVal = Math.max(maxVal, Math.abs(state.value));
      }

      // strength=1.0 * intensity=0.5 = effective strength 0.5
      expect(maxVal).toBeGreaterThan(0.1);
    });
  });

  describe('range falloff', () => {
    it('attenuates punch based on distance', () => {
      const punchNear = createPunch({ strength: 0.5, duration: 300, maxRange: 100 });
      const punchFar = createPunch({ strength: 0.5, duration: 300, maxRange: 100 });

      punchNear.trigger({ distance: 10 });  // 10% of max range
      punchFar.trigger({ distance: 80 });    // 80% of max range

      let maxNear = 0;
      let maxFar = 0;
      for (let i = 0; i < 15; i++) {
        const sn = punchNear.update(1 / 60);
        const sf = punchFar.update(1 / 60);
        maxNear = Math.max(maxNear, Math.abs(sn.value));
        maxFar = Math.max(maxFar, Math.abs(sf.value));
      }

      expect(maxNear).toBeGreaterThan(maxFar);
    });

    it('does not trigger when distance >= maxRange', () => {
      const punch = createPunch({ strength: 0.5, duration: 300, maxRange: 100 });
      punch.trigger({ distance: 100 });

      expect(punch.isActive()).toBe(false);
    });

    it('no falloff when maxRange is not set', () => {
      const punch = createPunch({ strength: 0.5, duration: 300 });
      punch.trigger({ distance: 1000 });

      // Should still trigger since maxRange is not configured
      expect(punch.isActive()).toBe(true);
    });

    it('custom rangeFalloff curve is applied', () => {
      // Quadratic falloff: (1-t)^2
      const quadratic = (t: number) => (1 - t) * (1 - t);
      const punch = createPunch({ strength: 0.5, duration: 300, maxRange: 100, rangeFalloff: quadratic });
      punch.trigger({ distance: 50 });

      // At distance 50/100=0.5, quadratic falloff = (1-0.5)^2 = 0.25
      // effective strength = 0.5 * 0.25 = 0.125
      let maxVal = 0;
      for (let i = 0; i < 10; i++) {
        const state = punch.update(1 / 60);
        maxVal = Math.max(maxVal, Math.abs(state.value));
      }

      // Should be attenuated
      expect(maxVal).toBeLessThan(0.2);
      expect(maxVal).toBeGreaterThan(0);
    });
  });
});
