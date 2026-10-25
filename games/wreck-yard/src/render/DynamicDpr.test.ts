import { describe, expect, it } from 'vitest';
import { isMobileDevice } from './DynamicDpr';

describe('DynamicDpr device detection', () => {
  it('detects an iPad with a desktop user agent and a wide screen', () => {
    expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5, innerWidth: 1024 })).toBe(true);
  });
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

});
