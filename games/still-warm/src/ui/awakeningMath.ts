export interface EyelidPaths {
  upper: string;
  lower: string;
  opacity: number;
  open: number;
}

export function calculateEyelidPaths(progress: number): EyelidPaths {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) {
    return {
      upper: "M -100 -50 L 1100 -50 L 1100 500 L -100 500 Z",
      lower: "M -100 1050 L 1100 1050 L 1100 500 L -100 500 Z",
      opacity: 1,
      open: 0,
    };
  }
  if (p >= 1) {
    return {
      upper: "",
      lower: "",
      opacity: 0,
      open: 1,
    };
  }

  const opacity = p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;

  let openH: number;
  let edgeH: number;

  if (p < 0.22) {
    // Stage 1: Thinner line across vision (horizontal slit)
    const t = p / 0.22;
    openH = t * 14; // narrow line in center (up to 1.4% height)
    edgeH = t * 2;  // tapered at corners
  } else {
    // Stage 2: Smoothly arching and opening up
    const t = (p - 0.22) / 0.78;
    const eased = t * t;
    openH = 14 + eased * 580;
    edgeH = 2 + eased * 520;
  }

  const mid = 500;
  const topY = Math.round(mid - openH);
  const botY = Math.round(mid + openH);
  const topEdgeY = Math.round(mid - edgeH);
  const botEdgeY = Math.round(mid + edgeH);

  return {
    upper: `M -100 -50 L 1100 -50 L 1100 ${topEdgeY} Q 500 ${topY} -100 ${topEdgeY} Z`,
    lower: `M -100 1050 L 1100 1050 L 1100 ${botEdgeY} Q 500 ${botY} -100 ${botEdgeY} Z`,
    opacity,
    open: p,
  };
}
