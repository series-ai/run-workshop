import { describe, expect, it } from 'vitest';
import { nextSlowWindowCount, selectRenderQuality } from './renderQuality';

describe('selectRenderQuality', () => {
  it('defaults to high on desktop and low on phones', () => {
    expect(selectRenderQuality({ isMobile: false, urlQuality: null })).toBe('high');
    expect(selectRenderQuality({ isMobile: true, urlQuality: null })).toBe('low');
  });

  it('prefers the URL and ignores unknown values', () => {
    expect(selectRenderQuality({ isMobile: true, urlQuality: 'high' })).toBe('high');
    expect(selectRenderQuality({ isMobile: false, urlQuality: 'low' })).toBe('low');
    expect(selectRenderQuality({ isMobile: false, urlQuality: 'ultra' })).toBe('high');
  });
});

describe('nextSlowWindowCount', () => {
  it('counts only consecutive slow windows', () => {
    let count = 0;
    for (const ms of [30, 25, 16, 30, 30, 30]) count = nextSlowWindowCount(count, ms);
    expect(count).toBe(3);
    expect(nextSlowWindowCount(2, 16.7)).toBe(0);
  });
});
