import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

/**
 * Detects whether the current device is a mobile handset or tablet.
 */
export function isMobileDevice(customEnv?: { userAgent?: string; maxTouchPoints?: number; innerWidth?: number }): boolean {
  const ua = customEnv?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const maxTouch = customEnv?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0);
  const hasTouch = maxTouch > 1;
  const width = customEnv?.innerWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const isSmallScreen = width <= 900;
  return mobileRegex.test(ua) || (hasTouch && (isSmallScreen || /Macintosh/i.test(ua)));
}

export interface DynamicDprProps {
  /** The resolution used by Canvas. Canvas owns this value. */
  dpr: number;
  onDprChange: (dpr: number) => void;
  /** Frame time budget in milliseconds. Defaults to 60 FPS. */
  targetFrameMs?: number;
  /** Minimum DPR floor. Defaults to 0.75 on mobile, 1.0 on desktop. */
  minDpr?: number;
  /** Maximum DPR ceiling. Defaults to 1.25 on mobile, 1.5 on desktop. */
  maxDpr?: number;
  /** Step amount for DPR adjustments. Default is 0.25. */
  step?: number;
  /** Number of frames in each measurement window. Default is 20. */
  evalIntervalFrames?: number;
  /** Number of consecutive good evaluation intervals required before upscaling. Default is 3. */
  upscaleHysteresis?: number;
}

/**
 * Reduces resolution when render frames exceed the budget.
 * Camera look runs on each render frame. The simulation tick does not set this budget.
 */
export function DynamicDpr({
  dpr,
  onDprChange,
  targetFrameMs = 1000 / 60,
  minDpr,
  maxDpr,
  step = 0.25,
  evalIntervalFrames = 20,
  upscaleHysteresis = 3,
}: DynamicDprProps) {
  const isMobile = isMobileDevice();
  const resolvedMinDpr = minDpr ?? (isMobile ? 0.75 : 1.0);
  const resolvedMaxDpr = maxDpr ?? (isMobile ? 1.25 : 1.5);

  const { viewport } = useThree();
  const frameCount = useRef(0);
  const frameTimeSum = useRef(0);
  const goodIntervals = useRef(0);

  useFrame((_, delta) => {
    // Limit long frame times after a tab becomes active.
    const deltaMs = Math.min(delta * 1000, 100);
    frameCount.current += 1;
    frameTimeSum.current += deltaMs;

    if (frameCount.current >= evalIntervalFrames) {
      const avgMs = frameTimeSum.current / frameCount.current;
      frameCount.current = 0;
      frameTimeSum.current = 0;

      // Reduce resolution faster when frames exceed the budget by more than 5 ms.
      if (avgMs > targetFrameMs + 5.0) {
        goodIntervals.current = 0;
        if (dpr > resolvedMinDpr) {
          const next = Math.max(resolvedMinDpr, Math.round((dpr - step * 2) * 100) / 100);
          if (next !== dpr) {
            onDprChange(next);
          }
        }
      }
      // Reduce resolution when frames exceed the budget by more than 1.5 ms.
      else if (avgMs > targetFrameMs + 1.5) {
        goodIntervals.current = 0;
        if (dpr > resolvedMinDpr) {
          const next = Math.max(resolvedMinDpr, Math.round((dpr - step) * 100) / 100);
          if (next !== dpr) {
            onDprChange(next);
          }
        }
      }
      // Increase resolution only with 8 ms of reserve. Do not increase it at the 60 Hz limit.
      else if (avgMs < targetFrameMs - 8.0) {
        goodIntervals.current += 1;
        if (goodIntervals.current >= upscaleHysteresis) {
          goodIntervals.current = 0;
          if (dpr < resolvedMaxDpr) {
            const next = Math.min(resolvedMaxDpr, Math.round((dpr + step) * 100) / 100);
            if (next !== dpr) {
              onDprChange(next);
            }
          }
        }
      } else {
        // Keep the resolution and reset the count.
        goodIntervals.current = 0;
      }

      // Record the frame time and resolution.
      if (typeof window !== 'undefined') {
        (window as unknown as { __PERF_METRICS__?: unknown }).__PERF_METRICS__ = {
          dpr,
          avgFrameMs: avgMs,
          fps: Math.round(1000 / avgMs),
          isMobile,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
        };
      }
    }
  });

  return null;
}
