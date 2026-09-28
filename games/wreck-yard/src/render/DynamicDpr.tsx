import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

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
  return mobileRegex.test(ua) || (hasTouch && isSmallScreen);
}

export interface DynamicDprProps {
  /** Target frametime ceiling in milliseconds (33.3ms = 30 FPS). */
  targetFrameMs?: number;
  /** Minimum DPR floor. Defaults to 0.75 on mobile, 1.0 on desktop. */
  minDpr?: number;
  /** Maximum DPR ceiling. Defaults to 1.25 on mobile, 1.5 on desktop. */
  maxDpr?: number;
  /** Step amount for DPR adjustments. Default is 0.25. */
  step?: number;
  /** Number of frames over which to compute rolling average. Default is 20 frames (~0.66s at 30fps). */
  evalIntervalFrames?: number;
  /** Number of consecutive good evaluation intervals required before upscaling. Default is 3. */
  upscaleHysteresis?: number;
}

/**
 * Dynamically adjusts Canvas DPR based on live frame time telemetry.
 * Keeps framerate >= 30 FPS on circa-2022 Android phones (Snapdragon 8 Gen 1 / Adreno 730)
 * by dropping DPR to 1.0 or 0.75 under load, while allowing scale-up to 1.25-1.5 when headroom exists.
 */
export function DynamicDpr({
  targetFrameMs = 33.3,
  minDpr,
  maxDpr,
  step = 0.25,
  evalIntervalFrames = 20,
  upscaleHysteresis = 3,
}: DynamicDprProps) {
  const isMobile = isMobileDevice();
  const resolvedMinDpr = minDpr ?? (isMobile ? 0.75 : 1.0);
  const resolvedMaxDpr = maxDpr ?? (isMobile ? 1.25 : 1.5);

  const { setDpr, viewport } = useThree();
  const currentDpr = useRef(isMobile ? 1.0 : 1.25);
  const frameCount = useRef(0);
  const frameTimeSum = useRef(0);
  const goodIntervals = useRef(0);

  // Set initial DPR on mount
  useEffect(() => {
    setDpr(currentDpr.current);
  }, [setDpr]);

  useFrame((_, delta) => {
    // Delta in milliseconds; clamp outliers like tab backgrounding
    const deltaMs = Math.min(delta * 1000, 100);
    frameCount.current += 1;
    frameTimeSum.current += deltaMs;

    if (frameCount.current >= evalIntervalFrames) {
      const avgMs = frameTimeSum.current / frameCount.current;
      frameCount.current = 0;
      frameTimeSum.current = 0;

      // Severe overload / thermal throttle (>38ms, <26 FPS): aggressive drop towards floor
      if (avgMs > targetFrameMs + 5.0) {
        goodIntervals.current = 0;
        if (currentDpr.current > resolvedMinDpr) {
          const next = Math.max(resolvedMinDpr, Math.round((currentDpr.current - step * 2) * 100) / 100);
          if (next !== currentDpr.current) {
            currentDpr.current = next;
            setDpr(next);
          }
        }
      }
      // Standard downscale threshold: if avg frametime exceeds ceiling (>34.8ms), drop DPR by step
      else if (avgMs > targetFrameMs + 1.5) {
        goodIntervals.current = 0;
        if (currentDpr.current > resolvedMinDpr) {
          const next = Math.max(resolvedMinDpr, Math.round((currentDpr.current - step) * 100) / 100);
          if (next !== currentDpr.current) {
            currentDpr.current = next;
            setDpr(next);
          }
        }
      }
      // Upscale threshold: if avg frametime is comfortably fast (<25ms, >40 FPS)
      else if (avgMs < targetFrameMs - 8.0) {
        goodIntervals.current += 1;
        if (goodIntervals.current >= upscaleHysteresis) {
          goodIntervals.current = 0;
          if (currentDpr.current < resolvedMaxDpr) {
            const next = Math.min(resolvedMaxDpr, Math.round((currentDpr.current + step) * 100) / 100);
            if (next !== currentDpr.current) {
              currentDpr.current = next;
              setDpr(next);
            }
          }
        }
      } else {
        // In the acceptable sweet spot; reset hysteresis count
        goodIntervals.current = 0;
      }

      // Telemetry for performance auditing
      if (typeof window !== 'undefined') {
        (window as unknown as { __PERF_METRICS__?: unknown }).__PERF_METRICS__ = {
          dpr: currentDpr.current,
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
