import { useEffect, useRef, useState, type CSSProperties } from "react";
import { calculateEyelidPaths } from "./awakeningMath";

export interface AwakeningProps {
  targetProgress: number;
  reducedMotion?: boolean;
}

export function Awakening({
  targetProgress,
  reducedMotion = false,
}: AwakeningProps) {
  const [progress, setProgress] = useState(0);
  const animRef = useRef<number | null>(null);
  const isAwakening = targetProgress > 0;

  useEffect(() => {
    if (reducedMotion) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setProgress(targetProgress);
      return;
    }

    if (!isAwakening) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setProgress(0);
      return;
    }

    let startTime: number | null = null;
    const duration = 2800; // 2.8s smooth awakening sequence

    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);

      // Delicate flutter during the initial thin slit phase
      let flutter = 0;
      if (t > 0.08 && t < 0.22) {
        flutter = Math.sin(((t - 0.08) / 0.14) * Math.PI * 2) * 0.015;
      }

      const nextVal = Math.min(1, Math.max(0, t + flutter));
      setProgress(nextVal);

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      }
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isAwakening, reducedMotion]);

  if (progress >= 1 && targetProgress >= 1) return null;

  const paths = calculateEyelidPaths(progress);

  return (
    <div
      className="awakening"
      aria-hidden="true"
      style={
        {
          opacity: paths.opacity,
          "--eye-open": paths.open,
        } as CSSProperties
      }
    >
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="awakening-svg"
      >
        <defs>
          <filter id="awakening-blur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <path
          className="eyelid upper"
          filter="url(#awakening-blur)"
          d={paths.upper}
        />
        <path
          className="eyelid lower"
          filter="url(#awakening-blur)"
          d={paths.lower}
        />
      </svg>
    </div>
  );
}
