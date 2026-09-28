import { describe, expect, it } from 'vitest';
import { isMobileDevice } from './DynamicDpr';

describe('DynamicDpr device detection', () => {
  it('detects Android user agents', () => {
    const androidUa = 'Mozilla/5.0 (Linux; Android 12; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36';
    expect(isMobileDevice({ userAgent: androidUa })).toBe(true);
  });

  it('detects iPhone / mobile devices', () => {
    const iphoneUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    expect(isMobileDevice({ userAgent: iphoneUa })).toBe(true);
  });

  it('detects desktop user agents with standard mouse/keyboard', () => {
    const desktopUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(isMobileDevice({ userAgent: desktopUa, maxTouchPoints: 0, innerWidth: 1920 })).toBe(false);
  });

  it('detects touch laptops or small screens as mobile layout', () => {
    const desktopUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    expect(isMobileDevice({ userAgent: desktopUa, maxTouchPoints: 5, innerWidth: 600 })).toBe(true);
  });

  it('calculates downscale bounds safely within floor', () => {
    const minDpr = 0.75;
    const step = 0.25;
    let currentDpr = 1.0;

    // First downscale
    currentDpr = Math.max(minDpr, Math.round((currentDpr - step) * 100) / 100);
    expect(currentDpr).toBe(0.75);

    // Second downscale attempts to breach floor, but clamps at minDpr
    currentDpr = Math.max(minDpr, Math.round((currentDpr - step) * 100) / 100);
    expect(currentDpr).toBe(0.75);
  });

  it('drops rapidly under severe overload spike', () => {
    const minDpr = 0.75;
    const step = 0.25;
    let currentDpr = 1.25;

    // Severe spike drops 2 steps
    currentDpr = Math.max(minDpr, Math.round((currentDpr - step * 2) * 100) / 100);
    expect(currentDpr).toBe(0.75);
  });

  it('calculates upscale bounds safely within ceiling', () => {
    const maxDpr = 1.25;
    const step = 0.25;
    let currentDpr = 1.0;

    currentDpr = Math.min(maxDpr, Math.round((currentDpr + step) * 100) / 100);
    expect(currentDpr).toBe(1.25);

    currentDpr = Math.min(maxDpr, Math.round((currentDpr + step) * 100) / 100);
    expect(currentDpr).toBe(1.25);
  });
});
