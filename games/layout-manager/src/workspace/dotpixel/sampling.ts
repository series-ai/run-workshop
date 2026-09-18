export interface DotFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DotAnchor {
  col: number;
  row: number;
  x: number;
  y: number;
  /** Stable output-space position, independent of the current pixel resolution. */
  u?: number;
  v?: number;
  /** Resolution at placement: coarse pins keep a broad influence when refining. */
  basisSize?: number;
  basisHeight?: number;
  /** Freeze neighbour influence for isolated edits at this resolution.
   * Null means a newly placed pin has no soft influence yet. Other
   * resolutions still use its actual position for coarse-to-fine guidance. */
  dragInfluence?: { size: number; height?: number; point: { x: number; y: number } | null };
}
export interface DotSource {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type DotLine = { x: number; y: number }[];

/** Posterization is RGB levels per channel, not a palette-size limit. Zero means off. */
export function posterizeSource(source: DotSource, levels: number): DotSource {
  if (levels < 2 || !Number.isFinite(levels)) return source;
  const steps = Math.max(1, Math.min(255, Math.round(levels) - 1));
  const table = Uint8ClampedArray.from({ length: 256 }, (_, i) =>
    Math.round((Math.round((i / 255) * steps) / steps) * 255),
  );
  const data = source.data.slice();
  for (let i = 0; i < data.length; i += 4) {
    data[i] = table[data[i]!]!;
    data[i + 1] = table[data[i + 1]!]!;
    data[i + 2] = table[data[i + 2]!]!;
  }
  return { width: source.width, height: source.height, data };
}

export interface AttractionOptions {
  lines?: DotLine[];
  /** Radius measured in output cells, not screen pixels. */
  radius?: number;
  strength?: number;
}

/** Keep all constraints, but display/sample only one pin per output cell.
 * Coarser pins take priority; equal-level ties prefer the latest edit. */
export function activeAnchors(anchors: DotAnchor[]): DotAnchor[] {
  const cells = new Map<string, DotAnchor>();
  for (const anchor of anchors) {
    const key = `${anchor.col}:${anchor.row}`;
    const previous = cells.get(key);
    const area = (a: DotAnchor) => (a.basisSize ?? 32) * (a.basisHeight ?? a.basisSize ?? 32);
    if (!previous || area(anchor) <= area(previous)) cells.set(key, anchor);
  }
  return [...cells.values()];
}

/** Influence is measured at each pin's original resolution, so coarse work
 * continues to guide newly introduced fine samples. Pins remain exact. */
export function buildSampleGrid(
  frame: DotFrame,
  size: number,
  anchors: DotAnchor[],
  attraction: AttractionOptions = {},
  height = size,
): { x: number; y: number }[] {
  const grid: { x: number; y: number }[] = [];
  const cellW = frame.w / size,
    cellH = frame.h / height;
  const radius = Math.max(0, attraction.radius ?? 2);
  const strength = Math.max(0, Math.min(1, attraction.strength ?? 0.8));
  const pins = new Map(activeAnchors(anchors).map((a) => [a.row * size + a.col, a]));
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < size; col++) {
      const baseX = frame.x + ((col + 0.5) * frame.w) / size;
      const baseY = frame.y + ((row + 0.5) * frame.h) / height;
      const pin = pins.get(row * size + col);
      if (pin) {
        grid.push({ x: pin.x, y: pin.y });
        continue;
      }
      let dx = 0,
        dy = 0,
        weights = 1;
      for (const anchor of anchors) {
        const influence =
          anchor.dragInfluence?.size === size &&
          (anchor.dragInfluence.height ?? anchor.dragInfluence.size) === height
            ? anchor.dragInfluence.point
            : anchor;
        if (!influence) continue;
        const u = anchor.u ?? (anchor.col + 0.5) / size;
        const v = anchor.v ?? (anchor.row + 0.5) / height;
        const distance = Math.max(
          0.001,
          Math.hypot(
            ((col + 0.5) / size - u) * (anchor.basisSize ?? size),
            ((row + 0.5) / height - v) * (anchor.basisHeight ?? anchor.basisSize ?? height),
          ),
        );
        if (distance >= 4) continue;
        const weight = (1 - distance / 4) ** 2 / (distance * distance);
        dx += weight * (influence.x - (frame.x + u * frame.w));
        dy += weight * (influence.y - (frame.y + v * frame.h));
        weights += weight;
      }
      let x = baseX + dx / weights,
        y = baseY + dy / weights;
      let nearest: { x: number; y: number } | null = null;
      let distance = radius;
      // Project in cell space; only the closest line wins. Pins return above.
      if (strength > 0 && radius > 0)
        for (const line of attraction.lines ?? []) {
          for (let i = 1; i < line.length; i++) {
            const a = line[i - 1]!,
              b = line[i]!;
            const vx = (b.x - a.x) / cellW,
              vy = (b.y - a.y) / cellH;
            const length2 = vx * vx + vy * vy;
            if (length2 === 0) continue;
            const t = Math.max(
              0,
              Math.min(1, (((x - a.x) / cellW) * vx + ((y - a.y) / cellH) * vy) / length2),
            );
            const point = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
            const d = Math.hypot((x - point.x) / cellW, (y - point.y) / cellH);
            if (d < distance) {
              distance = d;
              nearest = point;
            }
          }
        }
      if (nearest) {
        const amount = strength * (1 - distance / radius);
        x += (nearest.x - x) * amount;
        y += (nearest.y - y) * amount;
      }
      grid.push({
        x: Math.max(frame.x, Math.min(frame.x + frame.w - 0.0001, x)),
        y: Math.max(frame.y, Math.min(frame.y + frame.h - 0.0001, y)),
      });
    }
  }
  return grid;
}

/** Source coordinates are pixel-edge coordinates; each output samples a cell centre. */
export function sampleDotPixel(
  source: DotSource,
  frame: DotFrame,
  size: number,
  anchors: DotAnchor[],
  attraction: AttractionOptions = {},
  height = size,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(size * height * 4);
  const grid = buildSampleGrid(frame, size, anchors, attraction, height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < size; col++) {
      const sample = grid[row * size + col]!;
      const x = Math.min(source.width - 1, Math.max(0, Math.floor(sample.x)));
      const y = Math.min(source.height - 1, Math.max(0, Math.floor(sample.y)));
      const index = (y * source.width + x) * 4;
      output.set(source.data.subarray(index, index + 4), (row * size + col) * 4);
    }
  }
  return output;
}
